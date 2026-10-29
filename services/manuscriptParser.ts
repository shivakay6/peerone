/**
 * Extract title / abstract / keywords / authors from the plain text of a manuscript.
 *
 * Contract: title, abstract and keywords are REQUIRED. If any cannot be found with
 * confidence the parse fails with a specific message (the UI then asks for manual entry)
 * rather than guessing. Authors are best-effort: missing authors only produce a warning,
 * because author blocks are formatted very differently across journals.
 */
import { Manuscript, ManuscriptAuthor } from '../types';

export type ParseResult =
  | { ok: true; manuscript: Manuscript; warnings: string[] }
  | { ok: false; errors: string[]; partial: Partial<Manuscript> };

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+/;
const ABSTRACT_HEAD = /^abstract\b\s*[:.\-–—]?\s*(.*)$/i;
const KEYWORD_HEAD = /^(?:key\s*-?\s*words?|index\s+terms)\b\s*[:.\-–—]?\s*(.*)$/i;
const SECTION_HEAD = /^(?:(?:\d+|[IVX]+)[.)]?\s+)?(?:introduction|background|methods?|materials and methods|related work|results|1\.)\b/i;
const TITLE_NOISE = /^(?:title(?:\s+page)?|manuscript|original (?:article|research)|research article|running (?:head|title)|submission)\s*:?\s*$/i;
const AUTHOR_HEAD = /^(?:authors?|author information|affiliations?|corresponding author)\s*:?\s*$/i;
const AFFIL_WORDS = /\b(universit\w*|institut\w*|hospital|department|college|cent(?:er|re)|school|laborator\w*|clinic|academy|faculty)\b/i;
const NAME_LIKE = /^[\p{Lu}][\p{L}'’.-]+(?:\s+[\p{Lu}][\p{L}'’.-]+){1,3}$/u;

const clean = (s: string) => s.replace(/\s+/g, ' ').trim();

function splitKeywords(s: string): string[] {
  const seen = new Set<string>();
  return s
    .split(/[;,·•|]/)
    .map((k) => clean(k).replace(/[.\s]+$/, ''))
    .filter((k) => k.length > 1 && !seen.has(k.toLowerCase()) && (seen.add(k.toLowerCase()), true));
}

function parseAuthorLine(line: string): ManuscriptAuthor | null {
  const email = line.match(EMAIL)?.[0] ?? '';
  let rest = clean(line.replace(EMAIL, '').replace(/[()<>\[\]]/g, ' ').replace(/\s*[,;]\s*$/, ''));
  if (!rest) return null;

  // Split at the FIRST separator only; the affiliation keeps its own punctuation verbatim.
  const m = rest.match(/^(.*?)(?:\s+[|–—]\s+|\s+-\s+|,\s*)(.*)$/);
  const head = m ? m[1] : rest;
  const name = clean(head.replace(/[\d*†‡§¹²³⁴⁵]+$/g, ''));
  const affiliation = clean(m ? m[2] : '');
  if (!email && !NAME_LIKE.test(name)) return null;
  if (AFFIL_WORDS.test(name) && !email) return null; // an affiliation-only line
  return { name, email, affiliation };
}

function parseAuthors(lines: string[]): ManuscriptAuthor[] {
  const out: ManuscriptAuthor[] = [];
  for (const raw of lines) {
    if (AUTHOR_HEAD.test(raw)) continue;
    const hasEmail = EMAIL.test(raw);
    const single = parseAuthorLine(raw);
    if (single && (hasEmail || raw.includes(',') || NAME_LIKE.test(clean(raw)))) {
      out.push(single);
      continue;
    }
    // "A. Name, B. Name and C. Name" style byline
    if (!hasEmail && !AFFIL_WORDS.test(raw)) {
      const parts = raw.split(/,|\band\b|&/).map((p) => clean(p.replace(/[\d*†‡§¹²³⁴⁵]+/g, '')));
      if (parts.length >= 2 && parts.every((p) => NAME_LIKE.test(p))) {
        parts.forEach((p) => out.push({ name: p, email: '', affiliation: '' }));
      }
    }
  }
  return out;
}

export function parseManuscriptText(text: string): ParseResult {
  const lines = text.split(/\r?\n/).map(clean).filter(Boolean);
  const errors: string[] = [];
  const warnings: string[] = [];

  // ---- abstract
  const aIdx = lines.findIndex((l) => ABSTRACT_HEAD.test(l));
  let abstract = '';
  let abstractEnd = aIdx;
  if (aIdx >= 0) {
    const inline = lines[aIdx].match(ABSTRACT_HEAD)![1];
    const parts: string[] = inline ? [inline] : [];
    for (let i = aIdx + 1; i < lines.length; i++) {
      if (KEYWORD_HEAD.test(lines[i]) || SECTION_HEAD.test(lines[i])) break;
      parts.push(lines[i]);
      abstractEnd = i;
    }
    abstract = clean(parts.join(' '));
  }

  // ---- keywords (prefer the first occurrence at/after the abstract)
  let keywords: string[] = [];
  const kIdx = lines.findIndex((l, i) => i >= Math.max(aIdx, 0) && KEYWORD_HEAD.test(l));
  if (kIdx >= 0) {
    const inline = lines[kIdx].match(KEYWORD_HEAD)![1];
    keywords = splitKeywords(inline || lines[kIdx + 1] || '');
  }

  // ---- title: first meaningful line before the abstract
  const head = (aIdx >= 0 ? lines.slice(0, aIdx) : lines.slice(0, 6)).filter((l) => !TITLE_NOISE.test(l));
  const titleLine = head.find((l) => l.length >= 10 && !EMAIL.test(l) && !AUTHOR_HEAD.test(l));
  const title = titleLine ? clean(titleLine.replace(/^title\s*:\s*/i, '')) : '';

  if (!title) errors.push('Could not find a title (expected as the first line of the document).');
  if (aIdx < 0) errors.push('Could not find an "Abstract" section.');
  else if (abstract.length < 200) errors.push('The abstract looks too short (under 200 characters) to match reliably.');
  if (keywords.length === 0) errors.push('Could not find a "Keywords:" line.');

  // ---- authors: the lines between title and abstract
  const titleIdx = titleLine ? lines.indexOf(titleLine) : 0;
  const authorLines = lines.slice(titleIdx + 1, aIdx >= 0 ? aIdx : titleIdx + 8);
  const authors = parseAuthors(authorLines);
  if (authors.length === 0) warnings.push('No authors detected - add them below so conflict-of-interest checks can run.');
  else if (authors.some((a) => !a.email || !a.affiliation))
    warnings.push('Some authors are missing an e-mail or affiliation; conflict checks will be less precise.');

  if (errors.length) {
    return { ok: false, errors, partial: { title, abstract, keywords, authors } };
  }
  return { ok: true, manuscript: { title, abstract, keywords, authors }, warnings };
}

/** Browser entry point: read a .docx File and parse it. */
export async function parseManuscriptFile(file: File): Promise<ParseResult> {
  if (!/\.docx$/i.test(file.name)) {
    return { ok: false, errors: ['Please upload a Word (.docx) file.'], partial: {} };
  }
  try {
    const mammoth = await import('mammoth');
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return parseManuscriptText(value);
  } catch {
    return { ok: false, errors: ['The file could not be read. Is it a valid .docx?'], partial: {} };
  }
}
