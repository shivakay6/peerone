import { Paper } from '../types';

/**
 * Finds the specific concepts a manuscript and a paper have in common, using only words that
 * appear in both texts. Concepts are single words or two-word phrases, weighted by how rare they
 * are across the corpus, so "attention-based multiple" outranks "deep learning".
 */

const STOP = new Set(
  `a about above across after again against all also although among an and any are as at be because been before being between both but by can could did do does during each either else even few for from further had has have having here how however i if in into is it its itself just may might more most much must no nor not of off on once only or other our out over own per same shall should so some such than that the their them then there these they this those through thus to too under until up upon use used uses using very via was we were what when where whether which while who whom why will with within without would yet
   study studies paper papers approach method methods methodology result results show shows showed shown present presents proposed propose novel new based work works article research analysis data model models system systems performance accuracy high higher low different various several recent due well among two three one first second finally furthermore moreover overall including include includes provide provides provided demonstrate demonstrated demonstrates achieve achieved achieves improve improved improves compared compare significant significantly existing current potential important key main major large small number set sets case cases problem problems task tasks need needs key background objective objectives conclusion conclusions introduction purpose aim aims evaluate evaluated evaluation developed develop development contain contains contained containing consist consists given given enable enables enabled allow allows allowed make makes made help helps able`
    .split(/\s+/),
);

export function termsOf(text: string): Set<string> {
  const out = new Set<string>();
  const words = text.toLowerCase().replace(/[^a-z0-9\- ]+/g, ' ').split(/\s+/).filter(Boolean);
  let prev: string | null = null;
  for (const w0 of words) {
    const w = w0.replace(/^-+|-+$/g, '');
    if (w.length < 3 || STOP.has(w) || /^\d+$/.test(w)) { prev = null; continue; }
    out.add(w);
    if (prev) out.add(`${prev} ${w}`);
    prev = w;
  }
  return out;
}

export const paperText = (p: Pick<Paper, 'title' | 'abstract' | 'keywords'>) =>
  `${p.title}. ${p.abstract} ${p.keywords.join(' ')}`;

const dfCache = new WeakMap<Paper[], Map<string, number>>();
function documentFrequency(papers: Paper[]): Map<string, number> {
  let df = dfCache.get(papers);
  if (df) return df;
  df = new Map();
  for (const p of papers) for (const t of termsOf(paperText(p))) df.set(t, (df.get(t) ?? 0) + 1);
  dfCache.set(papers, df);
  return df;
}

export interface Concept { label: string; weight: number }

/** Concepts present in both texts, rarest first. */
export function sharedConcepts(manuscriptTerms: Set<string>, paper: Paper, corpus: Paper[], max = 3): string[] {
  const df = documentFrequency(corpus);
  const N = Math.max(corpus.length, 1);
  const theirs = termsOf(paperText(paper));
  const found: Concept[] = [];
  for (const t of theirs) {
    if (!manuscriptTerms.has(t)) continue;
    const share = (df.get(t) ?? 1) / N;
    const bigram = t.includes(' ');
    if (share > (bigram ? 0.03 : 0.008)) continue; // common background vocabulary
    if (!bigram && t.length < 7) continue;
    found.push({ label: t, weight: Math.log((N + 1) / ((df.get(t) ?? 1) + 1)) + (bigram ? 1.5 : 0) });
  }
  found.sort((a, b) => b.weight - a.weight || a.label.localeCompare(b.label));
  const picked: string[] = [];
  for (const c of found) {
    if (picked.some((p) => p.includes(c.label))) continue; // already covered by a longer pick
    picked.push(c.label);
    if (picked.length >= max * 2) break;
  }
  return mergeChains(picked).slice(0, max);
}

/** "multiple instance" + "instance learning" read better as "multiple instance learning". */
function mergeChains(list: string[]): string[] {
  let out = [...list];
  for (let changed = true; changed; ) {
    changed = false;
    outer: for (const a of out) {
      for (const b of out) {
        if (a === b) continue;
        const wa = a.split(' ');
        const wb = b.split(' ');
        for (let k = Math.min(wa.length, wb.length) - 1; k >= 1; k--) {
          if (wa.slice(-k).join(' ') === wb.slice(0, k).join(' ')) {
            const merged = [...wa, ...wb.slice(k)].join(' ');
            out = out.filter((x) => x !== a && x !== b && !merged.includes(x));
            out.unshift(merged);
            changed = true;
            break outer;
          }
        }
      }
    }
  }
  // drop words that are fully contained in another phrase
  return out.filter((x) => !out.some((y) => y !== x && y.includes(x)));
}

/** Build the corpus-wide word statistics ahead of the first search. */
export function warmConcepts(papers: Paper[]): void {
  documentFrequency(papers);
}
