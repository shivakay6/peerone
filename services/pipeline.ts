/**
 * PeerOne Smart Reviewer Discovery — core engine.
 *
 * Pure functions only (no DOM, no model, no network) so every step is unit-testable.
 * The embedding of the manuscript happens elsewhere (embeddingService.ts) and its
 * vector is passed in. Pipeline, as designed:
 *
 *   manuscript vector
 *     -> cosine vs every corpus paper            (brute force; HNSW/Vespa at 50M scale)
 *     -> top-K papers                            (recall-oriented candidate retrieval)
 *     -> authors of those papers                 (candidate pool)
 *     -> per author: re-score THEIR OWN papers in the look-back window
 *          Author Relevance = 0.60*Similarity + 0.25*Depth + 0.15*Recency
 *     -> COI checks (hard exclude / soft flag)
 *     -> grounded explanation, ranked top-N
 *
 * Ranking and COI are deterministic. The explanation is template-built from the
 * author's own retrieved papers only (nothing is inferred beyond that evidence).
 */
import {
  AuthorRecord,
  CoiFlag,
  EvidencePaper,
  Explanation,
  Manuscript,
  ManuscriptAuthor,
  Paper,
  PaperNote,
  PipelineConfig,
  PipelineResult,
  RankedReviewer,
  ScoreBreakdown,
} from '../types';
import { paperText, sharedConcepts, termsOf } from './concepts';

export const DEFAULT_CONFIG: PipelineConfig = {
  topKPapers: 50,
  similarityTopN: 5,
  similarityFloor: 0, // 0 = use raw cosine; the app's calibrated rescaling lives in services/config.ts
  similarityCeiling: 1,
  depthThreshold: 0.8,
  depthCap: 5,
  windowYears: 5,
  weights: { similarity: 0.6, depth: 0.25, recency: 0.15 },
  coiCoauthorYears: 5,
  resultCount: 10,
  evidenceFloor: 0,
};

export interface Corpus {
  papers: Paper[];
  authors: AuthorRecord[];
  embeddings: Float32Array; // row-major, papers.length x dim, L2-normalised
  dim: number;
  authorsById: Map<string, AuthorRecord>;
  authorsByName: Map<string, AuthorRecord[]>;
  authorsByOrcid: Map<string, AuthorRecord>;
}

const MS_PER_YEAR = 365.25 * 24 * 3600 * 1000;

// ---------------------------------------------------------------- math

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  const d = Math.sqrt(na) * Math.sqrt(nb);
  return d === 0 ? 0 : dot / d;
}

export function ageYears(dateIso: string, now: Date): number {
  return (now.getTime() - new Date(dateIso).getTime()) / MS_PER_YEAR;
}

/** <=1y 1.0 | <=2y 0.8 | <=3y 0.6 | <=4y 0.4 | <=5y 0.2 | >5y 0 */
export function recencyScore(dateIso: string, now: Date): number {
  const age = ageYears(dateIso, now);
  if (age <= 1) return 1.0;
  if (age <= 2) return 0.8;
  if (age <= 3) return 0.6;
  if (age <= 4) return 0.4;
  if (age <= 5) return 0.2;
  return 0;
}

export function combineScore(
  similarity: number,
  depth: number,
  recency: number,
  w: PipelineConfig['weights'],
): number {
  return w.similarity * similarity + w.depth * depth + w.recency * recency;
}

function mean(xs: number[]): number {
  return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : 0;
}

/**
 * Match strength of the query against every corpus row, 0..1. Cosine is rescaled so `floor` maps to 0
 * and `ceiling` maps to 1: this embedding model rates almost any two medical-imaging papers 0.8+, so raw
 * cosine would leave every score within a few points of each other.
 */
export function similarities(
  query: Float32Array,
  corpus: Pick<Corpus, 'embeddings' | 'dim' | 'papers'>,
  floor = 0,
  ceiling = 1,
): Float32Array {
  const n = corpus.papers.length;
  const out = new Float32Array(n);
  const q = query;
  let qn = 0;
  for (let i = 0; i < q.length; i++) qn += q[i] * q[i];
  qn = Math.sqrt(qn) || 1;
  for (let r = 0; r < n; r++) {
    const off = r * corpus.dim;
    let dot = 0;
    let rn = 0;
    for (let i = 0; i < corpus.dim; i++) {
      const v = corpus.embeddings[off + i];
      dot += q[i] * v;
      rn += v * v;
    }
    const cos = dot / (qn * (Math.sqrt(rn) || 1));
    out[r] = floor > 0 ? Math.min(1, Math.max(0, (cos - floor) / (ceiling - floor))) : cos;
  }
  return out;
}

// ---------------------------------------------------------------- corpus

export function normalizeName(n: string): string {
  return n
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\b(dr|prof|professor|mr|mrs|ms)\b\.?/g, ' ')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function buildCorpus(
  papers: Paper[],
  authors: AuthorRecord[],
  embeddings: Float32Array,
  dim: number,
): Corpus {
  const authorsById = new Map<string, AuthorRecord>();
  const authorsByName = new Map<string, AuthorRecord[]>();
  const authorsByOrcid = new Map<string, AuthorRecord>();
  for (const a of authors) {
    authorsById.set(a.id, a);
    const key = normalizeName(a.name);
    const list = authorsByName.get(key);
    if (list) list.push(a);
    else authorsByName.set(key, [a]);
    if (a.orcid) authorsByOrcid.set(a.orcid.toLowerCase(), a);
  }
  return { papers, authors, embeddings, dim, authorsById, authorsByName, authorsByOrcid };
}

// ---------------------------------------------------------------- scoring

export function scoreAuthor(
  author: Pick<AuthorRecord, 'paperIdx'>,
  papers: Paper[],
  sims: ArrayLike<number>,
  now: Date,
  cfg: PipelineConfig,
): { score: ScoreBreakdown; evidence: EvidencePaper[] } | null {
  const inWindow = author.paperIdx
    .filter((i) => ageYears(papers[i].date, now) <= cfg.windowYears)
    .map((i) => ({ i, sim: sims[i] }))
    .sort((a, b) => b.sim - a.sim);
  if (inWindow.length === 0) return null;

  const similarity = mean(inWindow.slice(0, cfg.similarityTopN).map((x) => x.sim));
  const relevant = inWindow.filter((x) => x.sim >= cfg.depthThreshold);
  const depth = Math.min(relevant.length / cfg.depthCap, 1);
  const recency = mean(relevant.map((x) => recencyScore(papers[x.i].date, now)));

  const evidence: EvidencePaper[] = inWindow.slice(0, 5).map((x) => ({
    paperIdx: x.i,
    title: papers[x.i].title,
    year: papers[x.i].year,
    date: papers[x.i].date,
    similarity: x.sim,
    doi: papers[x.i].doi,
    keywords: papers[x.i].keywords,
  }));

  return {
    score: {
      similarity,
      depth,
      recency,
      final: combineScore(similarity, depth, recency, cfg.weights),
      relevantCount: relevant.length,
      windowPaperCount: inWindow.length,
    },
    evidence,
  };
}

// ---------------------------------------------------------------- COI

const INSTITUTION_STOP = new Set(['of', 'the', 'and', 'for', 'at', 'de', 'in', 'la', 'le']);
const INSTITUTION_GENERIC = new Set([
  'university', 'institute', 'hospital', 'college', 'center', 'centre', 'school',
  'medical', 'medicine', 'department', 'national', 'research', 'health', 'clinic',
]);

function institutionTokens(s: string): string[] {
  return s
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ') // "(United States)"
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((t) => t && !INSTITUTION_STOP.has(t));
}

/** Same institution if one token set is contained in the other and the smaller one
 *  carries at least one distinctive (non-generic) token. */
export function sameInstitution(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (/independent|not listed/i.test(a) || /independent|not listed/i.test(b)) return false;
  const ta = new Set(institutionTokens(a));
  const tb = new Set(institutionTokens(b));
  if (ta.size === 0 || tb.size === 0) return false;
  const [small, big] = ta.size <= tb.size ? [ta, tb] : [tb, ta];
  const distinctive = [...small].filter((t) => !INSTITUTION_GENERIC.has(t));
  if (distinctive.length === 0) return false;
  return [...small].every((t) => big.has(t));
}

/** Dataset authors that a manuscript author corresponds to (ORCID > email > exact name). */
export function matchManuscriptAuthor(m: ManuscriptAuthor, corpus: Corpus): AuthorRecord[] {
  const out = new Map<string, AuthorRecord>();
  if (m.orcid) {
    const hit = corpus.authorsByOrcid.get(m.orcid.toLowerCase());
    if (hit) out.set(hit.id, hit);
  }
  if (m.email) {
    const e = m.email.trim().toLowerCase();
    for (const a of corpus.authors) if (a.email.toLowerCase() === e) out.set(a.id, a);
  }
  for (const a of corpus.authorsByName.get(normalizeName(m.name)) ?? []) out.set(a.id, a);
  return [...out.values()];
}

export function checkCoi(
  candidate: AuthorRecord,
  manuscriptAuthors: ManuscriptAuthor[],
  matched: Map<number, AuthorRecord[]>, // manuscript author index -> dataset authors
  corpus: Corpus,
  now: Date,
  cfg: PipelineConfig,
): CoiFlag[] {
  const flags: CoiFlag[] = [];
  const candName = normalizeName(candidate.name);

  manuscriptAuthors.forEach((m, mi) => {
    const sameOrcid = !!(m.orcid && candidate.orcid && m.orcid.toLowerCase() === candidate.orcid.toLowerCase());
    const sameEmail = !!(m.email && m.email.trim().toLowerCase() === candidate.email.toLowerCase());
    const sameName = normalizeName(m.name) === candName;
    const sameInst = sameInstitution(m.affiliation, candidate.affiliation);

    // ---- same person
    if (sameOrcid || sameEmail) {
      flags.push({
        type: 'same-person',
        severity: 'hard',
        reason: `Is manuscript author ${m.name} (${sameOrcid ? 'ORCID' : 'email'} match)`,
      });
    } else if (sameName && sameInst) {
      flags.push({
        type: 'same-person',
        severity: 'hard',
        reason: `Is manuscript author ${m.name} (name and institution match)`,
      });
    } else if (sameName) {
      flags.push({
        type: 'same-person',
        severity: 'soft',
        reason: `Same name as manuscript author ${m.name} but a different institution - verify identity`,
      });
    }

    // ---- same institution
    if (sameInst && !sameName) {
      flags.push({
        type: 'same-institution',
        severity: 'soft',
        reason: `Same institution as ${m.name} (${candidate.affiliation})`,
      });
    }

    // ---- recent co-authorship (needs the manuscript author to exist in the corpus)
    for (const ds of matched.get(mi) ?? []) {
      if (ds.id === candidate.id) continue;
      const shared = candidate.paperIdx
        .map((i) => corpus.papers[i])
        .filter(
          (p) =>
            ageYears(p.date, now) <= cfg.coiCoauthorYears &&
            p.authors.some((a) => a.id === ds.id),
        )
        .sort((x, y) => y.date.localeCompare(x.date));
      if (shared.length) {
        const p = shared[0];
        flags.push({
          type: 'recent-coauthor',
          severity: 'soft',
          reason: `Co-authored "${truncate(p.title, 70)}" (${p.year}) with ${m.name}`,
        });
      }
    }
  });

  // de-duplicate identical reasons
  const seen = new Set<string>();
  return flags.filter((f) => (seen.has(f.reason) ? false : (seen.add(f.reason), true)));
}

// ---------------------------------------------------------------- explanation

function truncate(s: string, n: number): string {
  if (s.length <= n) return s;
  const cut = s.slice(0, n - 1);
  return cut.slice(0, Math.max(cut.lastIndexOf(' '), n * 0.6)).trimEnd() + '…';
}

export const INSUFFICIENT_EVIDENCE = 'INSUFFICIENT_EVIDENCE';

const listJoin = (xs: string[]) =>
  xs.length <= 1 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')} and ${xs[xs.length - 1]}`;

const strength = (sim: number) =>
  sim >= 0.75 ? 'A very close match' : sim >= 0.5 ? 'A strong match' : sim >= 0.3 ? 'A partial match' : 'A loose match';

/**
 * Plain-language case for a reviewer, written only from the manuscript and the reviewer's own
 * papers. Every concept it names appears in both texts. Without enough evidence it says so.
 */
export function explain(
  authorName: string,
  manuscript: Manuscript,
  evidence: EvidencePaper[],
  score: ScoreBreakdown,
  cfg: PipelineConfig,
  papers?: Paper[],
): Explanation {
  if (evidence.length === 0 || evidence[0].similarity < cfg.evidenceFloor) {
    return {
      text: 'The available publications do not provide enough evidence to establish relevance to this manuscript.',
      sufficient: false,
      sharedTopics: [],
      paperNotes: [],
    };
  }

  const manuscriptText = `${manuscript.title} ${manuscript.abstract} ${manuscript.keywords.join(' ')}`.toLowerCase();
  const msTerms = papers ? termsOf(paperText(manuscript)) : null;

  // concepts per paper: shared author keywords first, then rarer phrases found in both texts
  const topicsFor = (ev: EvidencePaper): string[] => {
    const kws = ev.keywords.filter((k) => k.length >= 4 && manuscriptText.includes(k.toLowerCase()));
    const out = [...new Set(kws.map((k) => k))].slice(0, 2);
    if (papers && msTerms) {
      for (const c of sharedConcepts(msTerms, papers[ev.paperIdx], papers, 3)) {
        if (out.length >= 3) break;
        if (out.some((o) => o.toLowerCase().includes(c) || c.includes(o.toLowerCase()))) continue;
        out.push(c);
      }
    }
    return out;
  };

  const counts = new Map<string, { label: string; n: number }>();
  for (const ev of evidence.slice(0, 3)) {
    for (const k of ev.keywords) {
      const key = k.toLowerCase();
      if (key.length < 4) continue;
      if (manuscriptText.includes(key)) {
        const cur = counts.get(key);
        if (cur) cur.n += 1;
        else counts.set(key, { label: k, n: 1 });
      }
    }
  }
  const keywordTopics = [...counts.values()]
    .sort((a, b) => b.n - a.n || a.label.localeCompare(b.label))
    .slice(0, 4)
    .map((x) => x.label);

  const paperNotes: PaperNote[] = evidence.map((ev) => {
    const topics = topicsFor(ev);
    const text = topics.length
      ? `${strength(ev.similarity)} on ${listJoin(topics)}.`
      : `${strength(ev.similarity)} in overall subject area; no specific shared term stands out.`;
    return { paperIdx: ev.paperIdx, text, topics };
  });

  const sharedTopics = [...keywordTopics];
  for (const n of paperNotes.slice(0, 3)) {
    for (const t of n.topics) {
      if (sharedTopics.length >= 5) break;
      if (!sharedTopics.some((x) => x.toLowerCase().includes(t.toLowerCase()) || t.toLowerCase().includes(x.toLowerCase()))) sharedTopics.push(t);
    }
  }

  const rc = score.relevantCount;
  const wc = score.windowPaperCount;
  const sentences: string[] = [];
  sentences.push(
    wc === 1
      ? `${authorName} has one publication from the last ${cfg.windowYears} years in the index, and it ${rc > 0 ? 'is a strong match' : 'is not a strong match'} for this manuscript.`
      : `${authorName} has ${wc} publications from the last ${cfg.windowYears} years in the index` +
          (rc > 0
            ? `, ${rc === wc ? 'all' : rc} of which ${rc === 1 ? 'is a strong match' : 'are strong matches'} for this manuscript.`
            : ', none of which is a strong match for this manuscript.'),
  );

  const best = evidence[0];
  const t0 = paperNotes[0].topics;
  sentences.push(
    `Their closest work, "${truncate(best.title, 150)}" (${best.year}), ` +
      (t0.length ? `covers ${listJoin(t0)}, which this manuscript also deals with.` : 'is on a closely related subject.'),
  );

  if (evidence.length > 1) {
    const t1 = paperNotes[1].topics.filter((t) => !t0.includes(t));
    sentences.push(
      `They also published "${truncate(evidence[1].title, 150)}" (${evidence[1].year})` + (t1.length ? `, which adds ${listJoin(t1)}.` : '.'),
    );
  }

  const strong = evidence.filter((e) => e.similarity >= cfg.depthThreshold);
  const latest = [...(strong.length ? strong : evidence)].sort((a, b) => b.date.localeCompare(a.date))[0];
  const latestAge = ageYears(latest.date, new Date());
  if (wc === 1) {
    sentences.push('Because this is their only recent paper in the index, the match rests on one publication.');
  } else if (rc >= 3) {
    sentences.push(
      `With ${rc} strong matches, this looks like sustained work on the topic. Their latest related paper is from ${latest.year}` +
        (latestAge <= 1 ? ', so they are actively publishing in this area.' : '.'),
    );
  } else {
    sentences.push(
      `Their latest related paper is from ${latest.year}` + (latestAge <= 1 ? ', so they are actively publishing in this area.' : '.'),
    );
  }
  return { text: sentences.join(' '), sufficient: true, sharedTopics, paperNotes };
}

// ---------------------------------------------------------------- orchestration

/** Conflict checker for one manuscript, usable on any researcher (suggestions, database, invitations). */
export function makeCoiChecker(
  manuscript: Manuscript,
  corpus: Corpus,
  cfg: PipelineConfig = DEFAULT_CONFIG,
  now: Date = new Date(),
): (author: AuthorRecord) => CoiFlag[] {
  const matched = new Map<number, AuthorRecord[]>();
  manuscript.authors.forEach((m, i) => matched.set(i, matchManuscriptAuthor(m, corpus)));
  return (author) => checkCoi(author, manuscript.authors, matched, corpus, now, cfg);
}

export function runPipeline(
  manuscript: Manuscript,
  queryVec: Float32Array,
  corpus: Corpus,
  cfg: PipelineConfig = DEFAULT_CONFIG,
  now: Date = new Date(),
): PipelineResult {
  const t0 = performance.now();
  const sims = similarities(queryVec, corpus, cfg.similarityFloor, cfg.similarityCeiling);

  // 1) top-K papers
  const order = Array.from({ length: corpus.papers.length }, (_, i) => i).sort((a, b) => sims[b] - sims[a]);
  const topPapers = order.slice(0, cfg.topKPapers);

  // 2) candidate authors (+ how many top papers each surfaced through)
  const surfaced = new Map<string, number>();
  for (const pi of topPapers) {
    for (const pa of corpus.papers[pi].authors) {
      if (corpus.authorsById.has(pa.id)) surfaced.set(pa.id, (surfaced.get(pa.id) ?? 0) + 1);
    }
  }

  const coiOf = makeCoiChecker(manuscript, corpus, cfg, now);

  // 3-4) score and check conflicts. The manuscript's own authors are excluded outright.
  const scored: Array<{ author: AuthorRecord; score: ScoreBreakdown; evidence: EvidencePaper[]; coi: CoiFlag[]; count: number }> = [];
  const hardExcluded: { name: string; reason: string }[] = [];
  let scoredCount = 0;

  for (const [aid, count] of surfaced) {
    const author = corpus.authorsById.get(aid)!;
    const s = scoreAuthor(author, corpus.papers, sims, now, cfg);
    if (!s) continue;
    scoredCount += 1;
    const coi = coiOf(author);
    const hard = coi.find((f) => f.severity === 'hard');
    if (hard) {
      hardExcluded.push({ name: author.name, reason: hard.reason });
      continue;
    }
    scored.push({ author, score: s.score, evidence: s.evidence, coi, count });
  }

  // 5) rank, keep the top N (soft conflicts stay in, labelled), then explain only those
  scored.sort((a, b) => b.score.final - a.score.final || b.score.similarity - a.score.similarity);
  const reviewers: RankedReviewer[] = scored.slice(0, cfg.resultCount).map((x) => ({
    author: x.author,
    score: x.score,
    evidence: x.evidence,
    coi: x.coi,
    explanation: explain(x.author.name, manuscript, x.evidence, x.score, cfg, corpus.papers),
    surfacedByPapers: x.count,
  }));

  return {
    reviewers,
    hardExcluded,
    funnel: {
      corpusSize: corpus.papers.length,
      topPapers: topPapers.length,
      candidateAuthors: surfaced.size,
      scored: scoredCount,
      hardExcluded: hardExcluded.length,
      softFlagged: reviewers.filter((r) => r.coi.length > 0).length,
      shown: reviewers.length,
    },
    topPaperTitles: topPapers.slice(0, 5).map((i) => corpus.papers[i].title),
    computeMs: performance.now() - t0,
  };
}
