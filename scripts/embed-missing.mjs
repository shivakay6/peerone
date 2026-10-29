// Embeds only the papers listed in data-pipeline/missing_idx.json -> data-pipeline/new_embeddings.bin (resumable).
// Needs `npx vite --port 3000`. Then run data-pipeline/05_merge_embeddings.py.
import { createRequire } from 'node:module';
import { appendFileSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = 'data-pipeline/new_embeddings.bin', DIM = 384, CHUNK = 100;
const URL = process.env.APP_URL ?? 'http://localhost:3000';
const missing = JSON.parse(readFileSync('data-pipeline/missing_idx.json', 'utf8'));
async function openPage(browser) {
  const page = await browser.newPage();
  await page.goto(`${URL}/precompute.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
  return page;
}
const browser = await chromium.launch();
let page = await openPage(browser);
let a = existsSync(OUT) ? Math.floor(statSync(OUT).size / (DIM * 4)) : 0;
if (a === 0) writeFileSync(OUT, '');
const start = a, t0 = Date.now();
console.log('to embed', missing.length, 'starting at', a);
while (a < missing.length) {
  const b = Math.min(a + CHUNK, missing.length);
  try {
    const b64 = await page.evaluate((idx) => window.__embedIdx(idx), missing.slice(a, b));
    appendFileSync(OUT, Buffer.from(b64, 'base64'));
  } catch (e) {
    console.log('chunk failed, reopening page');
    await new Promise((r) => setTimeout(r, 2000));
    page = await openPage(browser);
    continue;
  }
  a = b;
  const el = (Date.now() - t0) / 1000, done = a - start;
  console.log(`${a}/${missing.length}  eta ${(((missing.length - a) * el) / done / 60).toFixed(1)} min`);
}
await browser.close();
if (statSync(OUT).size !== missing.length * DIM * 4) throw new Error('size mismatch');
console.log('wrote', OUT);
