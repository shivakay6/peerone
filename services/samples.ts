/** Rotating sample manuscripts: each download serves the next of the five. */
export interface SampleInfo { file: string; label: string; title: string }

const KEY = 'peerone.sampleIndex';
let memory = 0; // fallback when storage is unavailable (private windows etc.)

function read(): number {
  try { const v = window.localStorage.getItem(KEY); if (v !== null) return parseInt(v, 10) || 0; } catch { /* ignore */ }
  return memory;
}
function write(n: number) {
  memory = n;
  try { window.localStorage.setItem(KEY, String(n)); } catch { /* ignore */ }
}

export async function loadSamples(): Promise<SampleInfo[]> {
  const r = await fetch(`${import.meta.env.BASE_URL}manuscripts/index.json`);
  if (!r.ok) throw new Error('Sample list unavailable');
  return r.json();
}

/** Index of the sample the NEXT download will serve. */
export const nextSampleIndex = (count: number) => (count ? read() % count : 0);
export const advanceSample = (count: number) => write((nextSampleIndex(count) + 1) % Math.max(count, 1));
export const resetSamples = () => write(0);

export function triggerDownload(file: string) {
  const a = document.createElement('a');
  a.href = `${import.meta.env.BASE_URL}manuscripts/${file}`;
  a.download = file;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
