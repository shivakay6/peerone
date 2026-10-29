import { readFileSync } from 'node:fs';
import { MANUSCRIPTS } from './manuscripts.mjs';
import { buildCorpus, runPipeline, similarities } from '../services/pipeline';
import { ENGINE_CONFIG } from '../services/config';
const j = (f: string) => JSON.parse(readFileSync(`public/data/${f}`, 'utf8'));
const buf = readFileSync('public/data/embeddings.bin');
const emb = new Float32Array(buf.buffer, buf.byteOffset, buf.byteLength / 4);
const corpus = buildCorpus(j('papers.json'), j('authors.json'), emb, 384);
const vecs: number[][] = JSON.parse(readFileSync('scripts/.manuscript-vectors.json', 'utf8'));
const q = (a: number[], p: number) => a[Math.floor(p * (a.length - 1))].toFixed(3);
vecs.forEach((v, i) => {
  const m = MANUSCRIPTS[i];
  const s = Array.from(similarities(Float32Array.from(v), corpus, 0)).sort((a, b) => b - a);
  console.log(`\n#${i + 1} ${m.title.slice(0, 60)}\n corpus sims: max ${q(s, 0)} top50 ${s[49].toFixed(3)} p90 ${q(s, 0.1)} median ${q(s, 0.5)} min ${q(s, 1)}`);
  for (const th of [0.4, 0.5, 0.6]) {
    const cfg = { ...ENGINE_CONFIG, depthThreshold: th };
    const r = runPipeline({ ...m, authors: m.authors.map((a: any) => ({ ...a, orcid: '' })) } as any, Float32Array.from(v), corpus, cfg);
    const sc = r.reviewers.map((x) => x.score.final);
    if (th === 0.5) { const names = ['radboud','stanford','mayo']; const all = [...r.reviewers, ...r.flagged]; console.log('  coi:', r.flagged.map((x) => x.author.name + ' ' + x.coi.map((c: any) => c.reason ?? c.kind).join('/')).join(' ; ') || 'none', '| top authors from', names.map((n) => n + ':' + all.filter((x) => x.author.affiliation.toLowerCase().includes(n)).length).join(' ')); }
    console.log(` th ${th}: scores ${sc.map((x) => Math.round(x * 100)).join(',')} | relevant ${r.reviewers.map((x) => x.score.relevantCount).join('')} | flagged ${r.flagged.length} excl ${r.hardExcluded.length}`);
  }
});
if (process.env.LIST) vecs.forEach((v, i) => {
  const r = runPipeline({ ...MANUSCRIPTS[i], authors: [] } as any, Float32Array.from(v), corpus, ENGINE_CONFIG);
  console.log(`\n#${i + 1}`); r.reviewers.forEach((x, k) => console.log(` ${k + 1}. ${x.author.name} | ${x.author.affiliation} | ${Math.round(x.score.final * 100)} n=${x.score.windowPaperCount}`));
});
