// Generates the sample .docx manuscripts into public/manuscripts/ plus an index.json.
// Run: node scripts/make-manuscripts.mjs
import { Document, HeadingLevel, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DISCLAIMER, MANUSCRIPTS } from './manuscripts.mjs';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'manuscripts');
mkdirSync(OUT, { recursive: true });

const FONT = 'Calibri';
const run = (text, o = {}) => new TextRun({ text, font: FONT, ...o });

function build(m) {
  const children = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.LEFT,
      spacing: { after: 240 },
      children: [run(m.title, { bold: true, size: 36 })],
    }),
    ...m.authors.map(
      (a) =>
        new Paragraph({
          spacing: { after: 60 },
          children: [run(a.name, { bold: true }), run(`, ${a.affiliation} (${a.email})`)],
        }),
    ),
    new Paragraph({ spacing: { before: 280, after: 80 }, heading: HeadingLevel.HEADING_1, children: [run('Abstract', { bold: true, size: 28 })] }),
    new Paragraph({ spacing: { after: 160 }, children: [run(m.abstract)] }),
    new Paragraph({
      spacing: { after: 280 },
      children: [run('Keywords: ', { bold: true }), run(m.keywords.join('; '))],
    }),
    new Paragraph({ spacing: { before: 200, after: 80 }, heading: HeadingLevel.HEADING_1, children: [run('1. Introduction', { bold: true, size: 28 })] }),
    new Paragraph({ spacing: { after: 160 }, children: [run(m.intro)] }),
    new Paragraph({
      spacing: { before: 400 },
      children: [run(DISCLAIMER, { italics: true, size: 18, color: '777777' })],
    }),
  ];
  return new Document({
    creator: 'PeerOne demo',
    title: m.title,
    sections: [{ children }],
  });
}

for (const m of MANUSCRIPTS) {
  const buf = await Packer.toBuffer(build(m));
  writeFileSync(join(OUT, m.file), buf);
  console.log(`wrote ${m.file} (${(buf.length / 1024).toFixed(1)} KB)`);
}
writeFileSync(
  join(OUT, 'index.json'),
  JSON.stringify(MANUSCRIPTS.map(({ file, label, title }) => ({ file, label, title })), null, 2),
);
console.log('wrote index.json');
