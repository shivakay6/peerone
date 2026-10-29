import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_CONFIG,
  buildCorpus,
  combineScore,
  cosine,
  explain,
  recencyScore,
  runPipeline,
  sameInstitution,
  scoreAuthor,
} from '../services/pipeline';
import { AuthorRecord, Manuscript, Paper } from '../types';

const NOW = new Date('2026-10-29T00:00:00Z');
const near = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} !~ ${b}`);

/** 2-D unit vector whose cosine with the query (1,0) is exactly `s`. */
const vecFor = (s: number): number[] => [s, Math.sqrt(1 - s * s)];
const QUERY = new Float32Array([1, 0]);

function mkPaper(id: string, date: string, authorIds: string[], keywords: string[] = []): Paper {
  return {
    id, title: `Paper ${id}`, abstract: 'x'.repeat(250), keywords, date,
    year: Number(date.slice(0, 4)), doi: null,
    authors: authorIds.map((a) => ({ id: a, name: a, affiliation: '' })),
  };
}
function mkAuthor(id: string, name: string, paperIdx: number[], extra: Partial<AuthorRecord> = {}): AuthorRecord {
  return {
    id, name, orcid: null, affiliation: 'Somewhere Univ', paperIdx,
    email: `${id}@demo.peerone.example`, inPool: false, ...extra,
  };
}
function flat(sims: number[]): Float32Array {
  return new Float32Array(sims.flatMap(vecFor));
}

// ------------------------------------------------------------ design-doc examples

test('cosine basics', () => {
  near(cosine([1, 0], [1, 0]), 1);
  near(cosine([1, 0], [0, 1]), 0);
  near(cosine([1, 1], [2, 2]), 1);
});

test('recency decay table from the design doc', () => {
  assert.equal(recencyScore('2026-06-01', NOW), 1.0); // 0.4y
  assert.equal(recencyScore('2025-06-01', NOW), 0.8); // 1.4y
  assert.equal(recencyScore('2024-06-01', NOW), 0.6); // 2.4y
  assert.equal(recencyScore('2023-06-01', NOW), 0.4); // 3.4y
  assert.equal(recencyScore('2022-06-01', NOW), 0.2); // 4.4y
  assert.equal(recencyScore('2021-06-01', NOW), 0);   // 5.4y
});

test('final score worked example: 0.60*0.90 + 0.25*0.80 + 0.15*0.80 = 0.86', () => {
  near(combineScore(0.9, 0.8, 0.8, DEFAULT_CONFIG.weights), 0.86);
});

test('similarity worked example: avg(.95,.92,.89,.84,.78) = 0.876; 4 of 5 >= .80 => depth 0.8', () => {
  const sims = [0.95, 0.92, 0.89, 0.84, 0.78];
  const papers = sims.map((_, i) => mkPaper(`p${i}`, '2026-03-01', ['a']));
  const author = mkAuthor('a', 'A', [0, 1, 2, 3, 4]);
  const r = scoreAuthor(author, papers, sims, NOW, DEFAULT_CONFIG)!;
  near(r.score.similarity, 0.876);
  near(r.score.depth, 0.8);
  assert.equal(r.score.relevantCount, 4);
  near(r.score.recency, 1.0);
  assert.equal(r.evidence[0].similarity, 0.95); // most similar first
});

test('depth: 3 relevant = 0.6, 7 relevant caps at 1.0', () => {
  const mk = (n: number) => {
    const sims = Array(n).fill(0.9);
    const papers = sims.map((_, i) => mkPaper(`p${i}`, '2026-01-01', ['a']));
    return scoreAuthor(mkAuthor('a', 'A', sims.map((_, i) => i)), papers, sims, NOW, DEFAULT_CONFIG)!;
  };
  near(mk(3).score.depth, 0.6);
  near(mk(7).score.depth, 1.0);
});

test('fewer than 5 papers: similarity averages only what exists', () => {
  const sims = [0.9, 0.7, 0.5];
  const papers = sims.map((_, i) => mkPaper(`p${i}`, '2026-01-01', ['a']));
  const r = scoreAuthor(mkAuthor('a', 'A', [0, 1, 2]), papers, sims, NOW, DEFAULT_CONFIG)!;
  near(r.score.similarity, 0.7);
});

test('papers older than the 5-year window are ignored; none in window => null', () => {
  const papers = [mkPaper('old', '2019-01-01', ['a']), mkPaper('new', '2026-01-01', ['a'])];
  const both = scoreAuthor(mkAuthor('a', 'A', [0, 1]), papers, [0.99, 0.6], NOW, DEFAULT_CONFIG)!;
  assert.equal(both.score.windowPaperCount, 1);
  near(both.score.similarity, 0.6);
  assert.equal(scoreAuthor(mkAuthor('a', 'A', [0]), papers, [0.99, 0.6], NOW, DEFAULT_CONFIG), null);
});

test('recency averages only the relevant papers', () => {
  const papers = [
    mkPaper('r1', '2026-05-01', ['a']), // 1.0, relevant
    mkPaper('r2', '2024-06-01', ['a']), // 0.6, relevant
    mkPaper('x', '2022-06-01', ['a']),  // 0.2, NOT relevant -> must not drag the average
  ];
  const r = scoreAuthor(mkAuthor('a', 'A', [0, 1, 2]), papers, [0.9, 0.85, 0.5], NOW, DEFAULT_CONFIG)!;
  near(r.score.recency, 0.8);
});

// ------------------------------------------------------------ COI

test('institution matching', () => {
  assert.ok(sameInstitution('Stanford University', 'Stanford University School of Medicine'));
  assert.ok(sameInstitution('Microsoft (United States)', 'Microsoft'));
  assert.ok(!sameInstitution("King's College London", 'Imperial College London'));
  assert.ok(!sameInstitution('University of Oxford', 'University of Cambridge'));
  assert.ok(!sameInstitution('Affiliation not listed', 'Affiliation not listed'));
  assert.ok(!sameInstitution('University', 'University of Oxford')); // generic-only never matches
});

function coiFixture() {
  // paper0 (recent): cand + msAuthor-in-corpus co-authored; paper1 (old): cand + "ghost"
  const papers = [
    mkPaper('p0', '2025-03-01', ['cand', 'msd']),
    mkPaper('p1', '2018-03-01', ['cand', 'ghost']),
    mkPaper('p2', '2026-01-01', ['other']),
  ];
  const authors = [
    mkAuthor('cand', 'Cara Candidate', [0, 1], { affiliation: 'Radboud University Medical Center', orcid: '0000-0000-0000-0001' }),
    mkAuthor('msd', 'Mia Submitter', [0], { affiliation: 'Elsewhere Institute' }),
    mkAuthor('ghost', 'Gus Ghost', [1]),
    mkAuthor('other', 'Olly Other', [2], { affiliation: 'Stanford University' }),
  ];
  const corpus = buildCorpus(papers, authors, flat([0.9, 0.9, 0.9]), 2);
  const base: Manuscript = { title: 't', abstract: 'a', keywords: [], authors: [] };
  return { corpus, base };
}

test('COI: ORCID match hard-excludes; email match hard-excludes; name+institution hard-excludes', () => {
  const { corpus, base } = coiFixture();
  const run = (m: Manuscript) => runPipeline(m, QUERY, corpus, DEFAULT_CONFIG, NOW);

  let r = run({ ...base, authors: [{ name: 'Someone Else', email: 'x@y.z', affiliation: 'Z', orcid: '0000-0000-0000-0001' }] });
  assert.ok(r.hardExcluded.some((h) => h.name === 'Cara Candidate'));
  assert.ok(!r.reviewers.some((x) => x.author.id === 'cand'));

  r = run({ ...base, authors: [{ name: 'Someone Else', email: 'CAND@demo.peerone.example', affiliation: 'Z' }] });
  assert.ok(r.hardExcluded.some((h) => h.name === 'Cara Candidate'));

  r = run({ ...base, authors: [{ name: 'cara  candidate', email: 'q@q.q', affiliation: 'Radboud University Medical Center' }] });
  assert.ok(r.hardExcluded.some((h) => h.name === 'Cara Candidate'));
});

test('COI: same name but different institution is a soft flag, not an exclusion', () => {
  const { corpus, base } = coiFixture();
  const r = runPipeline({ ...base, authors: [{ name: 'Cara Candidate', email: 'q@q.q', affiliation: 'Mars University' }] }, QUERY, corpus, DEFAULT_CONFIG, NOW);
  const f = r.reviewers.find((x) => x.author.id === 'cand');
  assert.ok(f, 'candidate should stay in the list, flagged');
  assert.equal(f!.coi[0].severity, 'soft');
  assert.equal(r.hardExcluded.length, 0);
});

test('COI: same institution is soft-flagged but stays in the ranked list, with its flag', () => {
  const { corpus, base } = coiFixture();
  const r = runPipeline({ ...base, authors: [{ name: 'New Person', email: 'n@p.q', affiliation: 'Stanford University School of Medicine' }] }, QUERY, corpus, DEFAULT_CONFIG, NOW);
  assert.ok(r.reviewers.some((x) => x.author.id === 'other' && x.coi[0].type === 'same-institution'));
  assert.equal(r.funnel.softFlagged, 1);
});

test('COI: recent co-authorship flags; co-authorship older than 5 years does not', () => {
  const { corpus, base } = coiFixture();
  // manuscript author is Mia (in corpus, co-authored p0 in 2025 with cand)
  let r = runPipeline({ ...base, authors: [{ name: 'Mia Submitter', email: 'm@s.q', affiliation: 'Unrelated Org' }] }, QUERY, corpus, DEFAULT_CONFIG, NOW);
  const f = r.reviewers.find((x) => x.author.id === 'cand');
  assert.ok(f && f.coi.some((c) => c.type === 'recent-coauthor'), 'recent co-author must flag');

  // manuscript author is Gus (co-authored only in 2018) -> no flag
  r = runPipeline({ ...base, authors: [{ name: 'Gus Ghost', email: 'g@g.q', affiliation: 'Unrelated Org' }] }, QUERY, corpus, DEFAULT_CONFIG, NOW);
  const c = r.reviewers.find((x) => x.author.id === 'cand');
  assert.ok(c && !c.coi.some((x) => x.type === 'recent-coauthor'), 'old co-authorship must not flag');
});

// ------------------------------------------------------------ explanation guardrail

test('explanation: INSUFFICIENT_EVIDENCE path when evidence is absent or below the floor', () => {
  const m: Manuscript = { title: 't', abstract: 'a', keywords: [], authors: [] };
  const score = { similarity: 0, depth: 0, recency: 0, final: 0, relevantCount: 0, windowPaperCount: 0 };
  assert.equal(explain('X', m, [], score, DEFAULT_CONFIG).sufficient, false);
  const ev = [{ paperIdx: 0, title: 'T', year: 2025, date: '2025-01-01', similarity: 0.3, doi: null, keywords: [] }];
  assert.equal(explain('X', m, ev, score, { ...DEFAULT_CONFIG, evidenceFloor: 0.5 }).sufficient, false);
});

test('explanation only cites topics present in BOTH manuscript and the author papers', () => {
  const m: Manuscript = { title: 'Deep learning for chest X-ray triage', abstract: 'We study radiology.', keywords: ['Radiology'], authors: [] };
  const score = { similarity: 0.9, depth: 0.6, recency: 1, final: 0.9, relevantCount: 3, windowPaperCount: 4 };
  const ev = [
    { paperIdx: 0, title: 'Chest X-ray AI', year: 2026, date: '2026-01-01', similarity: 0.9, doi: null, keywords: ['Radiology', 'Quantum chemistry', 'Deep learning'] },
  ];
  const e = explain('Dr. Ng', m, ev, score, DEFAULT_CONFIG);
  assert.ok(e.sufficient);
  assert.deepEqual(e.sharedTopics.sort(), ['Deep learning', 'Radiology']);
  assert.ok(!e.text.includes('Quantum'), 'must not mention topics absent from the manuscript');
});

// ------------------------------------------------------------ end to end (tiny corpus)

test('pipeline: ranks by author relevance, not by single best paper', () => {
  // A: one very similar paper only (thin). B: five strong recent papers (deep).
  const papers = [
    mkPaper('a1', '2026-05-01', ['A']),
    ...['b1', 'b2', 'b3', 'b4', 'b5'].map((id) => mkPaper(id, '2026-04-01', ['B'])),
  ];
  const sims = [0.97, 0.9, 0.9, 0.9, 0.9, 0.9];
  const authors = [mkAuthor('A', 'Thin Author', [0]), mkAuthor('B', 'Deep Author', [1, 2, 3, 4, 5])];
  const corpus = buildCorpus(papers, authors, flat(sims), 2);
  const r = runPipeline({ title: 't', abstract: 'a', keywords: [], authors: [] }, QUERY, corpus, DEFAULT_CONFIG, NOW);
  assert.deepEqual(r.reviewers.map((x) => x.author.name), ['Deep Author', 'Thin Author']);
  near(r.reviewers[0].score.depth, 1);
  near(r.reviewers[1].score.depth, 0.2);
  assert.equal(r.funnel.candidateAuthors, 2);
});

test('pipeline: resultCount decides how many reviewers come back (fewer available is fine)', () => {
  const papers = ['a', 'b', 'c', 'd'].map((id) => mkPaper(id, '2026-04-01', [id]));
  const authors = ['a', 'b', 'c', 'd'].map((id, i) => mkAuthor(id, `Author ${id}`, [i]));
  const corpus = buildCorpus(papers, authors, flat([0.95, 0.93, 0.91, 0.9]), 2);
  const m: Manuscript = { title: 't', abstract: 'a', keywords: [], authors: [] };
  assert.equal(runPipeline(m, QUERY, corpus, { ...DEFAULT_CONFIG, resultCount: 2 }, NOW).reviewers.length, 2);
  assert.equal(runPipeline(m, QUERY, corpus, { ...DEFAULT_CONFIG, resultCount: 25 }, NOW).reviewers.length, 4);
});

test('track record is stable per researcher and honours stored stats', async () => {
  const { statsFor, acceptanceRate } = await import('../services/stats');
  const a = statsFor({ id: 'A123' });
  assert.deepEqual(a, statsFor({ id: 'A123' }));
  assert.notDeepEqual(a, statsFor({ id: 'A124' }));
  assert.ok(a.avgRating >= 3.6 && a.avgRating <= 4.9 && acceptanceRate(a) <= 100);
  const stored = { avgTat: 9, avgRating: 4.5, completedReviews: 10, pendingReviews: 0, declinedInvites: 0, pendingInvites: 0 };
  assert.equal(statsFor({ id: 'x', stats: stored }), stored);
});

test('explanation: paper-by-paper notes name only concepts found in both texts', () => {
  const mk = (id: string, title: string, abstract: string, keywords: string[]): Paper => ({
    id, title, abstract, keywords, date: '2026-03-01', year: 2026, doi: null, authors: [],
  });
  const papers = [
    mk('p1', 'Attention-based multiple instance learning for whole-slide breast histopathology', 'We classify whole-slide images with attention-based multiple instance learning for breast cancer.', ['Breast cancer']),
    mk('p2', 'Quantum chemistry of catalysts', 'Density functional theory of catalytic surfaces and reaction barriers.', ['Catalysis']),
    ...Array.from({ length: 400 }, (_, i) => mk(`f${i}`, `Filler ${i}`, 'Generic filler text about unrelated subjects number ' + i, [])),
  ];
  const m: Manuscript = { title: 'Weakly supervised whole-slide breast cancer classification', abstract: 'Attention-based multiple instance learning on whole-slide images of breast cancer.', keywords: ['Breast cancer'], authors: [] };
  const score = { similarity: 0.8, depth: 0.2, recency: 1, final: 0.7, relevantCount: 1, windowPaperCount: 2 };
  const ev = [
    { paperIdx: 0, title: papers[0].title, year: 2026, date: '2026-03-01', similarity: 0.8, doi: null, keywords: papers[0].keywords },
    { paperIdx: 1, title: papers[1].title, year: 2026, date: '2026-03-01', similarity: 0.1, doi: null, keywords: papers[1].keywords },
  ];
  const e = explain('Dr. Ng', m, ev, score, DEFAULT_CONFIG, papers);
  assert.equal(e.paperNotes.length, 2);
  assert.ok(e.paperNotes[0].topics.length >= 2, 'strong paper should share specific concepts');
  assert.ok(e.paperNotes[0].text.startsWith('A very close match on'));
  assert.deepEqual(e.paperNotes[1].topics, [], 'unrelated paper shares nothing');
  assert.ok(!e.text.toLowerCase().includes('density functional'));
  assert.ok(e.paperNotes[0].topics.some((t) => t.includes('multiple instance learning')), 'overlapping phrases merge');
});
