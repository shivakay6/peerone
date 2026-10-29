import { readFileSync } from 'node:fs';
import { MANUSCRIPTS } from './manuscripts.mjs';
import { buildCorpus, runPipeline } from '../services/pipeline';
import { ENGINE_CONFIG } from '../services/config';
const j = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8'));
const buf = readFileSync('public/data/embeddings.bin');
const corpus = buildCorpus(j('papers.json'), j('authors.json'), new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4), 384);
const vecs: number[][] = JSON.parse(readFileSync('scripts/.manuscript-vectors.json', 'utf8'));
const which = Number(process.env.S ?? 3) - 1;
const t = performance.now();
const r = runPipeline({ ...MANUSCRIPTS[which], authors: MANUSCRIPTS[which].authors } as any, Float32Array.from(vecs[which]), corpus, { ...ENGINE_CONFIG, resultCount: Number(process.env.N ?? 4) });
console.log('ms', Math.round(performance.now() - t));
for (const x of r.reviewers) { console.log('\n##', x.author.name, Math.round(x.score.final * 100), x.coi.map((c) => c.reason)); console.log(x.explanation.text); x.explanation.paperNotes.slice(0, 3).forEach((n) => console.log('  -', n.text)); }
