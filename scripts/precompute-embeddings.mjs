// Embeds every corpus paper once, using the app's own embedding service inside headless
// Chromium (same model + same WebAssembly runtime as the live app). Resumable.
// Usage: start `npx vite --port 3000`, then `node scripts/precompute-embeddings.mjs`
import { createRequire } from 'node:module';
import { appendFileSync, existsSync, renameSync, statSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const DIM = 384, CHUNK = 100;
const PART = 'public/data/embeddings.partial.bin', FINAL = 'public/data/embeddings.bin';
const URL = process.env.APP_URL ?? 'http://localhost:3000';

async function openPage(browser) {
  const page = await browser.newPage();
  page.on('pageerror', (e) => console.log('PAGE ERROR:', e.message));
  await page.goto(`${URL}/precompute.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  return page;
}

const browser = await chromium.launch();
let page = await openPage(browser);
const total = await page.evaluate(() => window.__count);
console.log('crossOriginIsolated:', await page.evaluate(() => crossOriginIsolated), '| papers:', total);

let start = existsSync(PART) ? Math.floor(statSync(PART).size / (DIM * 4)) : 0;
if (start === 0) writeFileSync(PART, '');
console.log('starting at', start);
const t0 = Date.now();
let a = start;
while (a < total) {
  const b = Math.min(a + CHUNK, total);
  try {
    const b64 = await page.evaluate(([x, y]) => window.__embedRange(x, y), [a, b]);
    appendFileSync(PART, Buffer.from(b64, 'base64'));
  } catch (e) {
    // The dev server reloads the page when source files change; reopen and redo this chunk.
    console.log('chunk failed, reopening page:', String(e.message).split('\n')[0]);
    await new Promise((r) => setTimeout(r, 2000));
    page = await openPage(browser);
    continue;
  }
  const done = b - start, el = (Date.now() - t0) / 1000;
  console.log(`${b}/${total}  ${(el / done).toFixed(3)} s/paper  eta ${(((total - b) * el) / done / 60).toFixed(1)} min`);
  a = b;
}
await browser.close();
if (statSync(PART).size !== total * DIM * 4) throw new Error('size mismatch');
renameSync(PART, FINAL);
console.log('wrote', FINAL);
