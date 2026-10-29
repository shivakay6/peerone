/**
 * Local, in-browser text embeddings. No API key, no server, no per-call cost.
 *
 * Model: e5-small-v2 (384-d, 512-token context), 8-bit quantised ONNX, bundled in /models.
 * The ONNX Runtime WebAssembly files are bundled in /ort. After the first page load the
 * browser caches both, and every embedding is computed on the user's own device.
 *
 * E5 models are trained with a text prefix. This task is symmetric (manuscript vs paper), for
 * which the E5 authors recommend the "query: " prefix on BOTH sides, so the corpus was embedded
 * with the same prefix and the same text template used here.
 */
import { env, pipeline } from '@huggingface/transformers';
import type { Manuscript } from '../types';

export const MODEL_ID = 'Xenova/e5-small-v2';
export const EMBED_DIM = 384;
const PREFIX = 'query: ';

let extractor: Promise<any> | null = null;

/** The one text template used for BOTH corpus papers and manuscripts. */
export function buildEmbeddingText(p: { title: string; abstract: string; keywords: string[] }): string {
  return `${p.title}. ${p.abstract} Keywords: ${p.keywords.join(', ')}`;
}

export function manuscriptEmbeddingText(m: Manuscript): string {
  return buildEmbeddingText(m);
}

export function loadEmbeddingModel(onProgress?: (fraction: number) => void): Promise<any> {
  if (!extractor) {
    const base = import.meta.env.BASE_URL;
    env.allowRemoteModels = false; // never reach out to a model hub at runtime
    env.allowLocalModels = true;
    env.localModelPath = `${base}models/`;
    const wasm = (env.backends as any).onnx?.wasm;
    // Pin the plain CPU build (14 MB). By default the runtime asks for a 27 MB GPU-capable build
    // we do not need.
    if (wasm) {
      wasm.wasmPaths = {
        mjs: `${base}ort/ort-wasm-simd-threaded.mjs`,
        wasm: `${base}ort/ort-wasm-simd-threaded.wasm`,
      };
    }

    extractor = pipeline('feature-extraction', MODEL_ID, {
      dtype: 'q8',
      device: 'wasm',
      progress_callback: (e: any) => {
        if (onProgress && e?.status === 'progress' && typeof e.progress === 'number') onProgress(e.progress / 100);
      },
    }).catch((err) => {
      extractor = null; // allow a retry
      throw err;
    });
  }
  return extractor;
}

/** L2-normalised embedding for already-templated text. */
export async function embedText(text: string): Promise<Float32Array> {
  const ex = await loadEmbeddingModel();
  const out = await ex(PREFIX + text, { pooling: 'mean', normalize: true });
  return Float32Array.from(out.data as ArrayLike<number>);
}

export async function embedManuscript(m: Manuscript): Promise<Float32Array> {
  return embedText(manuscriptEmbeddingText(m));
}
