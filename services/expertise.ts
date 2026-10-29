import { AuthorRecord, EvidencePaper } from '../types';
import { Corpus } from './pipeline';

// Broad OpenAlex fields say little about a person's expertise.
const GENERIC = new Set([
  'computer science', 'medicine', 'biology', 'engineering', 'mathematics', 'physics', 'chemistry',
  'psychology', 'business', 'geography', 'materials science', 'environmental science', 'artificial intelligence',
  'machine learning', 'pattern recognition (psychology)', 'process (computing)', 'software', 'internal medicine',
  'radiology', 'medical physics', 'data science',
]);

const tidy = (k: string) => k.trim().replace(/\s+/g, ' ');
const show = (k: string) => (k === k.toUpperCase() || /[A-Z]/.test(k.slice(1)) ? k : k.charAt(0).toUpperCase() + k.slice(1));

/**
 * A researcher's main topics, from the keywords of their own papers. Papers that matched the
 * manuscript count double, so a reviewer's expertise leans toward what they were recommended for.
 */
export function expertiseFor(author: AuthorRecord, corpus: Corpus, evidence: EvidencePaper[] = [], n = 4): string[] {
  const matched = new Set(evidence.map((e) => e.paperIdx));
  const counts = new Map<string, { label: string; n: number }>();
  for (const i of author.paperIdx) {
    const weight = matched.has(i) ? 2 : 1;
    for (const raw of corpus.papers[i].keywords) {
      const label = tidy(raw);
      const key = label.toLowerCase();
      if (key.length < 4 || GENERIC.has(key)) continue;
      const cur = counts.get(key);
      if (cur) cur.n += weight;
      else counts.set(key, { label, n: weight });
    }
  }
  const ranked = [...counts.values()].sort((a, b) => b.n - a.n || a.label.localeCompare(b.label));
  // fall back to the broad fields when that is all there is
  if (ranked.length === 0) {
    const broad = new Set<string>();
    for (const i of author.paperIdx) for (const k of corpus.papers[i].keywords) broad.add(tidy(k));
    return [...broad].slice(0, n).map(show);
  }
  return ranked.slice(0, n).map((x) => show(x.label));
}
