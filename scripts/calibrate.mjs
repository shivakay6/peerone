// Step 1 of calibration: embed the sample manuscripts with the app's own embedding service.
// Needs `npx vite --port 3000` running. Then run: npx tsx scripts/calibrate-analyze.ts
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { MANUSCRIPTS } from './manuscripts.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const URL = process.env.APP_URL ?? 'http://localhost:3000';
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`${URL}/precompute.html`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 180000 });
const out = [];
for (const m of MANUSCRIPTS) {
  const text = `${m.title}. ${m.abstract} Keywords: ${m.keywords.join(', ')}`;
  out.push(await page.evaluate((t) => window.__single(t), text));
}
await browser.close();
writeFileSync('scripts/.manuscript-vectors.json', JSON.stringify(out));
console.log('embedded', out.length, 'manuscripts');
