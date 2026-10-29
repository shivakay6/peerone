import { AuthorRecord, Paper } from '../types';
import { Corpus, buildCorpus } from './pipeline';
import { EMBED_DIM } from './embeddingService';

async function getJson<T>(url: string): Promise<T> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`Could not load ${url} (${r.status})`);
  return r.json();
}

/** Load the static, pre-embedded corpus shipped with the app. */
export async function loadCorpus(onProgress?: (label: string) => void): Promise<Corpus> {
  const base = `${import.meta.env.BASE_URL}${import.meta.env.VITE_DATA_DIR ?? 'data'}/`;
  onProgress?.('Loading publication corpus');
  const [papers, authors] = await Promise.all([
    getJson<Paper[]>(`${base}papers.json`),
    getJson<AuthorRecord[]>(`${base}authors.json`),
  ]);
  onProgress?.('Loading embeddings');
  const broken = 'The publication index is missing or damaged. Reload the page; if it persists, rebuild the embeddings.';
  const res = await fetch(`${base}embeddings.bin`);
  // A static host answers a missing file with its HTML fallback page and status 200.
  if (!res.ok || (res.headers.get('content-type') ?? '').includes('text/html')) throw new Error(broken);
  const buf = await res.arrayBuffer();
  if (buf.byteLength % 4 !== 0) throw new Error(broken);
  const embeddings = new Float32Array(buf);
  if (embeddings.length !== papers.length * EMBED_DIM) throw new Error(broken);
  return buildCorpus(papers, authors, embeddings, EMBED_DIM);
}
