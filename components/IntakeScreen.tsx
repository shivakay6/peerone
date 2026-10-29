import React, { useEffect, useRef, useState } from 'react';
import { Manuscript, ManuscriptAuthor } from '../types';
import { parseManuscriptFile } from '../services/manuscriptParser';
import { SampleInfo, advanceSample, loadSamples, nextSampleIndex, triggerDownload } from '../services/samples';
import { Button, Chip, Icon, Spinner, cx } from './ui';

export interface CorpusStats { papers: number; authors: number; poolSize: number; from: number; to: number }

interface Props {
  stats: CorpusStats | null;
  engineReady: boolean;
  engineError: string | null;
  initial?: Manuscript;
  initialCount?: number;
  onSubmit: (m: Manuscript, count: number) => void;
}

type Row = ManuscriptAuthor & { key: number };
let rowKey = 1;
const blankRow = (): Row => ({ key: rowKey++, name: '', email: '', affiliation: '', orcid: '' });

const fieldBase =
  'w-full rounded-lg border bg-surface px-3.5 py-2.5 text-[15px] text-ink placeholder:text-ink-3 transition-colors focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

type Feedback =
  | { kind: 'ok'; file: string; found: string[]; warnings: string[] }
  | { kind: 'fail'; file: string; errors: string[] }
  | null;

const IntakeScreen: React.FC<Props> = ({ stats, engineReady, engineError, initial, initialCount = 10, onSubmit }) => {
  const [count, setCount] = useState(String(initialCount));
  const [title, setTitle] = useState(initial?.title ?? '');
  const [abstract, setAbstract] = useState(initial?.abstract ?? '');
  const [keywords, setKeywords] = useState<string[]>(initial?.keywords ?? []);
  const [kwDraft, setKwDraft] = useState('');
  const [rows, setRows] = useState<Row[]>(
    initial?.authors.length ? initial.authors.map((a) => ({ ...a, key: rowKey++ })) : [blankRow()],
  );
  const [errors, setErrors] = useState<{ title?: string; abstract?: string; keywords?: string; count?: string }>({});
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [flash, setFlash] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [samples, setSamples] = useState<SampleInfo[]>([]);
  const [sampleIdx, setSampleIdx] = useState(0);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadSamples()
      .then((s) => { setSamples(s); setSampleIdx(nextSampleIndex(s.length)); })
      .catch(() => setSamples([]));
  }, []);

  const addKeywords = (raw: string) => {
    const parts = raw.split(/[,;\n]/).map((k) => k.trim()).filter(Boolean);
    if (!parts.length) return;
    setKeywords((cur) => {
      const seen = new Set(cur.map((k) => k.toLowerCase()));
      return [...cur, ...parts.filter((k) => !seen.has(k.toLowerCase()) && seen.add(k.toLowerCase()))];
    });
    setKwDraft('');
    setErrors((e) => ({ ...e, keywords: undefined }));
  };

  const applyManuscript = (m: Partial<Manuscript>) => {
    if (m.title !== undefined) setTitle(m.title);
    if (m.abstract !== undefined) setAbstract(m.abstract);
    if (m.keywords) setKeywords(m.keywords);
    if (m.authors?.length) setRows(m.authors.map((a) => ({ ...a, orcid: a.orcid ?? '', key: rowKey++ })));
    setErrors({});
    setFlash(true);
    window.setTimeout(() => setFlash(false), 1600);
  };

  const handleFile = async (file: File | undefined | null) => {
    if (!file) return;
    const res = await parseManuscriptFile(file);
    if (res.ok) {
      const m = res.manuscript;
      applyManuscript(m);
      setFeedback({
        kind: 'ok',
        file: file.name,
        found: [
          'title',
          'abstract',
          `${m.keywords.length} keyword${m.keywords.length === 1 ? '' : 's'}`,
          `${m.authors.length} author${m.authors.length === 1 ? '' : 's'}`,
        ],
        warnings: res.warnings,
      });
    } else {
      // keep whatever was found so the editor only completes the rest
      applyManuscript(res.partial);
      setFeedback({ kind: 'fail', file: file.name, errors: res.errors });
    }
  };

  const downloadSample = () => {
    if (!samples.length) return;
    triggerDownload(samples[sampleIdx].file);
    advanceSample(samples.length);
    setSampleIdx(nextSampleIndex(samples.length));
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const kws = kwDraft.trim() ? [...keywords, kwDraft.trim()] : keywords;
    const next: typeof errors = {};
    if (!title.trim()) next.title = 'Enter the manuscript title.';
    if (abstract.trim().length < 100) next.abstract = 'Enter the abstract (at least 100 characters) so matching has enough to work with.';
    if (kws.length === 0) next.keywords = 'Add at least one keyword.';
    const n = Number(count);
    if (!Number.isInteger(n) || n < 1 || n > 50) next.count = 'Enter a whole number from 1 to 50.';
    setErrors(next);
    if (Object.keys(next).length) return;
    onSubmit({
      title: title.trim(),
      abstract: abstract.trim(),
      keywords: kws,
      authors: rows
        .filter((r) => r.name.trim())
        .map(({ key: _k, ...a }) => ({ ...a, name: a.name.trim(), email: a.email.trim(), affiliation: a.affiliation.trim(), orcid: a.orcid?.trim() || undefined })),
    }, n);
  };

  const setRow = (key: number, patch: Partial<ManuscriptAuthor>) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const tint = flash ? 'bg-brand-tint' : '';

  return (
    <main className="mx-auto grid max-w-6xl gap-x-12 gap-y-8 px-5 py-9 lg:grid-cols-[minmax(0,1fr)_340px]">
      <aside className="space-y-6 lg:order-2">
        <section aria-labelledby="start-file">
          <h2 id="start-file" className="text-[15px] font-semibold">Start from a file</h2>
          <div
            onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => { e.preventDefault(); setDragging(false); void handleFile(e.dataTransfer.files?.[0]); }}
            className={cx(
              'mt-2.5 flex flex-col items-center rounded-xl border-2 border-dashed px-5 py-7 text-center transition-colors',
              dragging ? 'border-brand bg-brand-tint' : 'border-rule-strong bg-surface',
            )}
          >
            <Icon.Upload className="text-brand" size={22} />
            <p className="mt-2.5 text-sm text-ink-2">Drop a Word manuscript here</p>
            <Button className="mt-3" small onClick={() => fileInput.current?.click()} type="button">Choose a .docx file</Button>
            <input
              ref={fileInput}
              type="file"
              accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              className="sr-only"
              aria-label="Upload a .docx manuscript"
              onChange={(e) => { void handleFile(e.target.files?.[0]); e.target.value = ''; }}
            />
          </div>

          <div aria-live="polite" className="mt-3">
            {feedback?.kind === 'ok' && (
              <div className="rounded-lg bg-good-tint p-3 text-[13px] text-good">
                <p className="flex items-start gap-1.5 break-all font-semibold [&>svg]:mt-0.5 [&>svg]:shrink-0"><Icon.Check size={15} /> <span>Read {feedback.file}</span></p>
                <p className="mt-0.5">Found the {feedback.found.join(', ')}. Review the fields, then find reviewers.</p>
                {feedback.warnings.map((w) => (<p key={w} className="mt-1 text-warn">{w}</p>))}
              </div>
            )}
            {feedback?.kind === 'fail' && (
              <div className="rounded-lg bg-bad-tint p-3 text-[13px] text-bad">
                <p className="flex items-center gap-1.5 font-semibold"><Icon.Warn size={15} /> Could not read {feedback.file}</p>
                <ul className="mt-1 list-disc pl-5">{feedback.errors.map((er) => (<li key={er}>{er}</li>))}</ul>
                <p className="mt-1.5 text-ink-2">Anything that was found is filled in. Complete the rest by hand.</p>
              </div>
            )}
          </div>
        </section>

        <section aria-labelledby="try-sample" className="border-t border-rule pt-5">
          <h2 id="try-sample" className="text-[15px] font-semibold">No manuscript to hand?</h2>
          <p className="mt-1 text-sm text-ink-2">
            Download a sample, then drop it into the box above. Each download is a different one.
          </p>
          <Button className="mt-3" onClick={downloadSample} disabled={!samples.length} type="button">
            <Icon.Download size={16} /> Download sample manuscript
          </Button>
        </section>

      </aside>

      <form onSubmit={submit} noValidate className="space-y-6 lg:order-1">
        <header>
          <h1 className="font-serif text-[34px] font-semibold leading-tight tracking-tight">Find the right reviewers for your manuscript</h1>
          <p className="mt-2 max-w-[68ch] text-[15px] leading-relaxed text-ink-2">
            PeerOne semantically matches your manuscript to published research, checks for conflicts of interest, and recommends the most relevant,
            active reviewers.
          </p>
        </header>

        <div>
          <label htmlFor="ms-title" className="mb-1.5 block text-sm font-semibold">Title</label>
          <input
            id="ms-title"
            className={cx(fieldBase, 'font-serif text-lg', errors.title ? 'border-bad' : 'border-rule-strong', tint)}
            value={title}
            aria-invalid={!!errors.title}
            onChange={(e) => { setTitle(e.target.value); setErrors((x) => ({ ...x, title: undefined })); }}
            placeholder="Deep learning for chest X-ray triage"
          />
          {errors.title && <p className="mt-1 text-[13px] text-bad">{errors.title}</p>}
        </div>

        <div>
          <div className="mb-1.5 flex items-baseline justify-between">
            <label htmlFor="ms-abstract" className="text-sm font-semibold">Abstract</label>
            <span className="tnum text-xs text-ink-3">{abstract.length.toLocaleString()} characters</span>
          </div>
          <textarea
            id="ms-abstract"
            rows={9}
            className={cx(fieldBase, 'resize-y font-serif leading-relaxed', errors.abstract ? 'border-bad' : 'border-rule-strong', tint)}
            value={abstract}
            aria-invalid={!!errors.abstract}
            onChange={(e) => { setAbstract(e.target.value); setErrors((x) => ({ ...x, abstract: undefined })); }}
            placeholder="Paste the abstract"
          />
          {errors.abstract && <p className="mt-1 text-[13px] text-bad">{errors.abstract}</p>}
        </div>

        <div>
          <label htmlFor="ms-kw" className="mb-1.5 block text-sm font-semibold">Keywords</label>
          <div className={cx('flex flex-wrap items-center gap-1.5 rounded-lg border bg-surface p-2 focus-within:border-brand focus-within:ring-2 focus-within:ring-brand/20', errors.keywords ? 'border-bad' : 'border-rule-strong', tint)}>
            {keywords.map((k) => (
              <Chip key={k} tone="brand" className="py-1 pl-2.5 pr-1 text-[13px]">
                {k}
                <button type="button" aria-label={`Remove ${k}`} onClick={() => setKeywords((c) => c.filter((x) => x !== k))} className="rounded-full p-0.5 hover:bg-brand/10">
                  <Icon.Close size={13} />
                </button>
              </Chip>
            ))}
            <input
              id="ms-kw"
              className="min-w-[10rem] flex-1 bg-transparent px-1.5 py-1 text-[15px] placeholder:text-ink-3 focus:outline-none"
              value={kwDraft}
              placeholder={keywords.length ? 'Add another' : 'Type a keyword, then press Enter'}
              onChange={(e) => (e.target.value.includes(',') ? addKeywords(e.target.value) : setKwDraft(e.target.value))}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addKeywords(kwDraft); } if (e.key === 'Backspace' && !kwDraft) setKeywords((c) => c.slice(0, -1)); }}
              onBlur={() => addKeywords(kwDraft)}
            />
          </div>
          {errors.keywords && <p className="mt-1 text-[13px] text-bad">{errors.keywords}</p>}
        </div>

        <fieldset>
          <legend className="text-sm font-semibold">Authors</legend>
          <p className="mb-2.5 mt-0.5 text-[13px] text-ink-3">Used only to check conflicts of interest. They do not affect matching.</p>
          <div className="divide-y divide-rule rounded-lg border border-rule-strong bg-surface">
            {rows.map((r, i) => (
              <div key={r.key} className={cx('grid gap-2 p-3 sm:grid-cols-2', tint)}>
                <input aria-label={`Author ${i + 1} name`} className={cx(fieldBase, 'border-rule-strong')} placeholder="Full name" value={r.name} onChange={(e) => setRow(r.key, { name: e.target.value })} />
                <input aria-label={`Author ${i + 1} email`} type="email" className={cx(fieldBase, 'border-rule-strong')} placeholder="Email" value={r.email} onChange={(e) => setRow(r.key, { email: e.target.value })} />
                <input aria-label={`Author ${i + 1} affiliation`} className={cx(fieldBase, 'border-rule-strong')} placeholder="Institution" value={r.affiliation} onChange={(e) => setRow(r.key, { affiliation: e.target.value })} />
                <div className="flex gap-2">
                  <input aria-label={`Author ${i + 1} ORCID`} className={cx(fieldBase, 'border-rule-strong')} placeholder="ORCID (optional)" value={r.orcid ?? ''} onChange={(e) => setRow(r.key, { orcid: e.target.value })} />
                  {rows.length > 1 && (
                    <button type="button" aria-label={`Remove author ${i + 1}`} onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))} className="rounded-lg px-2.5 text-ink-3 hover:bg-bad-tint hover:text-bad">
                      <Icon.Trash size={16} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <Button type="button" variant="ghost" small className="mt-2" onClick={() => setRows((rs) => [...rs, blankRow()])}>
            <Icon.Plus size={15} /> Add author
          </Button>
        </fieldset>

        <div className="border-t border-rule pt-5">
          <label htmlFor="ms-count" className="mb-1.5 block text-sm font-semibold">Number of reviewers to suggest</label>
          <div className="flex flex-wrap items-center gap-3">
            <input
              id="ms-count"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={count}
              aria-invalid={!!errors.count}
              onChange={(e) => { setCount(e.target.value); setErrors((x) => ({ ...x, count: undefined })); }}
              className={cx(fieldBase.replace('w-full', 'w-28'), 'tnum', errors.count ? 'border-bad' : 'border-rule-strong')}
            />
            <p className="text-[13px] text-ink-3">If fewer qualified reviewers exist, PeerOne shows all it finds.</p>
          </div>
          {errors.count && <p className="mt-1 text-[13px] text-bad">{errors.count}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" variant="primary" className="px-6 py-3 text-[15px]" disabled={!engineReady || !stats}>
            {engineReady && stats ? 'Find reviewers' : (<><Spinner /> Preparing the search engine</>)}
          </Button>
          {engineError && <p className="max-w-md text-[13px] text-bad">{engineError}</p>}
          {!engineError && !engineReady && <p className="text-[13px] text-ink-3">The language model loads once and then runs on this device.</p>}
        </div>
      </form>
    </main>
  );
};

export default IntakeScreen;
