// Self-host the ONNX Runtime WebAssembly files so the app never fetches them from a CDN.
// The files are already shipped in public/ort; this only refreshes them when node_modules has them.
import { copyFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const src = join(root, 'node_modules', 'onnxruntime-web', 'dist');
const dst = join(root, 'public', 'ort');
mkdirSync(dst, { recursive: true });
for (const f of ['ort-wasm-simd-threaded.mjs', 'ort-wasm-simd-threaded.wasm']) {
  if (existsSync(join(src, f))) {
    copyFileSync(join(src, f), join(dst, f));
    console.log('copied', f);
  } else if (existsSync(join(dst, f))) {
    console.log('using bundled', f);
  } else {
    throw new Error(`missing ${f}: not in node_modules/onnxruntime-web/dist or public/ort`);
  }
}
