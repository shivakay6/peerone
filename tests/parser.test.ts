import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import mammoth from 'mammoth';
// @ts-ignore - plain ESM data module
import { MANUSCRIPTS } from '../scripts/manuscripts.mjs';
import { parseManuscriptText } from '../services/manuscriptParser';

const ABS = 'We study a problem. '.repeat(15); // > 200 chars

for (const m of MANUSCRIPTS) {
  test(`round-trips real .docx: ${m.file}`, async () => {
    const buf = readFileSync(`public/manuscripts/${m.file}`);
    const { value } = await mammoth.extractRawText({ buffer: buf });
    const r = parseManuscriptText(value);
    assert.ok(r.ok, r.ok ? '' : r.errors.join('; '));
    if (!r.ok) return;
    assert.equal(r.manuscript.title, m.title);
    assert.equal(r.manuscript.abstract, m.abstract);
    assert.deepEqual(r.manuscript.keywords, m.keywords);
    assert.equal(r.manuscript.authors.length, m.authors.length);
    m.authors.forEach((a: any, i: number) => {
      assert.equal(r.manuscript.authors[i].name, a.name);
      assert.equal(r.manuscript.authors[i].email, a.email);
      assert.equal(r.manuscript.authors[i].affiliation, a.affiliation);
    });
    assert.deepEqual(r.warnings, []);
  });
}

test('fails (does not guess) when keywords are missing', () => {
  const r = parseManuscriptText(`A Reasonable Manuscript Title Here\nAbstract\n${ABS}\n1. Introduction\nText.`);
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => /Keywords/i.test(e)));
});

test('fails when there is no abstract section', () => {
  const r = parseManuscriptText('A Reasonable Manuscript Title Here\nKeywords: alpha; beta\nSome body text.');
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => /Abstract/i.test(e)));
});

test('fails on a too-short abstract', () => {
  const r = parseManuscriptText('A Reasonable Manuscript Title Here\nAbstract: Tiny.\nKeywords: alpha; beta');
  assert.equal(r.ok, false);
  if (!r.ok) assert.ok(r.errors.some((e) => /too short/i.test(e)));
});

test('handles inline "Abstract—" and "Keywords" with the list on the next line', () => {
  const r = parseManuscriptText(
    `Deep Learning for Something Important\nJane Roe, Some University (jane@x.example)\nAbstract— ${ABS}\nKey words\nalpha, beta; gamma.\nI. INTRODUCTION\nBody.`,
  );
  assert.ok(r.ok);
  if (r.ok) {
    assert.deepEqual(r.manuscript.keywords, ['alpha', 'beta', 'gamma']);
    assert.equal(r.manuscript.authors[0].name, 'Jane Roe');
    assert.equal(r.manuscript.authors[0].email, 'jane@x.example');
  }
});

test('missing authors is a warning, not a failure', () => {
  const r = parseManuscriptText(`Deep Learning for Something Important\nAbstract\n${ABS}\nKeywords: alpha; beta`);
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.manuscript.authors.length, 0);
    assert.ok(r.warnings.length > 0);
  }
});

test('skips affiliation-only lines and noise headers', () => {
  const r = parseManuscriptText(
    `Original Article\nDeep Learning for Something Important\nAuthors\nJane Roe (jane@x.example)\nDepartment of Radiology, Some University\nAbstract\n${ABS}\nKeywords: alpha; beta`,
  );
  assert.ok(r.ok);
  if (r.ok) {
    assert.equal(r.manuscript.title, 'Deep Learning for Something Important');
    assert.equal(r.manuscript.authors.length, 1);
  }
});
