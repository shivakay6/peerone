// Lists the authors of each sample manuscript's 50 closest papers (output: data-pipeline/candidate_author_ids.json).
import { readFileSync, writeFileSync } from 'node:fs';
import { MANUSCRIPTS } from './manuscripts.mjs';
import { buildCorpus, similarities } from '../services/pipeline';
import { ENGINE_CONFIG } from '../services/config';
const j = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8'));
const buf = readFileSync('public/data/embeddings.bin');
const corpus = buildCorpus(j('papers.json'), j('authors.json'), new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4), 384);
const vecs: number[][] = JSON.parse(readFileSync('scripts/.manuscript-vectors.json', 'utf8'));
const ids = new Set<string>();
vecs.forEach((v) => {
  const s = similarities(Float32Array.from(v), corpus, ENGINE_CONFIG.similarityFloor, ENGINE_CONFIG.similarityCeiling);
  const top = Array.from(s.keys()).sort((a, b) => s[b] - s[a]).slice(0, 50);
  top.forEach((i) => corpus.papers[i].authors.forEach((a) => ids.add(a.id)));
});
writeFileSync('data-pipeline/candidate_author_ids.json', JSON.stringify([...ids]));
console.log('candidate authors', ids.size);
