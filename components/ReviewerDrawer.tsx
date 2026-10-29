import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AuthorRecord, CoiFlag, InvitationStatus, Manuscript, PipelineConfig, RankedReviewer, TrackedReviewer } from '../types';
import { Corpus } from '../services/pipeline';
import { Button, Chip, Icon, pct } from './ui';
import { Avatar, ExpertiseChips, TrackRecordCard, shadeFor, statusLabel, statusTone } from './ReviewerBits';
import AbstractModal, { AbstractView } from './AbstractModal';

export interface DrawerSubject {
  author: AuthorRecord;
  reviewer?: RankedReviewer; // present when opened from the suggestions: adds score and explanation
  coi: CoiFlag[];
}

interface Props {
  subject: DrawerSubject | null;
  manuscript: Manuscript | null;
  config: PipelineConfig;
  corpus: Corpus | null;
  expertise: string[];
  tracked: TrackedReviewer | undefined;
  onClose: () => void;
  onInvite: (a: AuthorRecord, r?: RankedReviewer) => void;
  onBackup: (a: AuthorRecord, relevance?: number) => void;
}

const card = 'rounded-2xl border border-rule bg-surface p-5';

const H: React.FC<{ children: React.ReactNode; aside?: React.ReactNode }> = ({ children, aside }) => (
  <div className="mb-3 flex items-baseline justify-between gap-3">
    <h3 className="text-[15px] font-semibold">{children}</h3>
    {aside && <span className="text-xs text-ink-3">{aside}</span>}
  </div>
);

interface PubItem { paperIdx: number; title: string; year: number; doi: string | null; keywords: string[]; similarity?: number; note?: string }

const ReviewerDrawer: React.FC<Props> = ({ subject, manuscript, config: cfg, corpus, expertise, tracked, onClose, onInvite, onBackup }) => {
  const closeBtn = useRef<HTMLButtonElement>(null);
  const [abstract, setAbstract] = useState<AbstractView | null>(null);
  const author = subject?.author;

  useEffect(() => {
    if (!subject) return;
    setAbstract(null);
    const previous = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [subject, onClose]);

  const pubs: PubItem[] = useMemo(() => {
    if (!subject || !corpus) return [];
    const r = subject.reviewer;
    if (r) {
      const notes = new Map(r.explanation.paperNotes.map((n) => [n.paperIdx, n.text]));
      return r.evidence.map((e) => ({ paperIdx: e.paperIdx, title: e.title, year: e.year, doi: e.doi, keywords: e.keywords, similarity: e.similarity, note: r.explanation.sufficient ? notes.get(e.paperIdx) : undefined }));
    }
    return [...subject.author.paperIdx]
      .sort((a, b) => corpus.papers[b].date.localeCompare(corpus.papers[a].date))
      .slice(0, 5)
      .map((i) => ({ paperIdx: i, title: corpus.papers[i].title, year: corpus.papers[i].year, doi: corpus.papers[i].doi, keywords: corpus.papers[i].keywords }));
  }, [subject, corpus]);

  if (!subject || !author) return null;
  const r = subject.reviewer;
  const msKeywords = new Set((manuscript?.keywords ?? []).map((k) => k.toLowerCase()));
  const shared = new Set((r?.explanation.sharedTopics ?? []).map((k) => k.toLowerCase()));
  const allPapers = corpus ? author.paperIdx.map((i) => corpus.papers[i]).sort((a, b) => b.date.localeCompare(a.date)) : [];
  const rc = r?.score.relevantCount ?? 0;
  const wc = r?.score.windowPaperCount ?? 0;
  const fit =
    wc === 0 ? ''
    : rc === 0 ? `Matches on ${wc} recent paper${wc === 1 ? '' : 's'}, but none is a strong fit for this manuscript.`
    : rc === wc ? `Matches on ${wc} recent paper${wc === 1 ? '' : 's'}, ${wc === 1 ? 'and it is a strong fit' : 'all of them strong fits'} for this manuscript.`
    : `Matches on ${wc} recent papers, but only ${rc} ${rc === 1 ? 'is a strong fit' : 'are strong fits'} for this manuscript.`;

  const openAbstract = (p: PubItem) =>
    setAbstract({ title: p.title, year: p.year, doi: p.doi, abstract: corpus?.papers[p.paperIdx]?.abstract ?? '' });

  const cancelled = tracked?.invitationStatus === InvitationStatus.CANCELLED;
  const onBackupList = tracked?.invitationStatus === InvitationStatus.BACKUP;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <div className="absolute inset-0 bg-ink/40" onClick={onClose} />
      <aside className="drawer-in relative flex h-full w-full max-w-[620px] flex-col bg-surface shadow-2xl">
        <header className="flex items-start gap-4 border-b border-rule px-6 py-5">
          <Avatar name={author.name} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 id="drawer-title" className="font-serif text-[24px] font-semibold leading-tight tracking-tight">{author.name}</h2>
            <p className="mt-1 text-sm text-ink-2">{author.affiliation}</p>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              {author.inPool ? <Chip tone="brand">In your database</Chip> : <Chip>External researcher</Chip>}
              {subject.coi.length > 0 && <Chip tone="warn"><Icon.Warn size={12} /> Conflict of interest</Chip>}
              {author.orcid && (
                <a href={`https://orcid.org/${author.orcid}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-brand hover:underline">
                  ORCID {author.orcid} <Icon.External size={12} />
                </a>
              )}
            </div>
            <div className="mt-3.5">
              <p className="mb-1.5 text-[13px] font-medium text-ink-2">Expertise</p>
              <ExpertiseChips topics={expertise} />
            </div>
          </div>
          <button ref={closeBtn} onClick={onClose} aria-label="Close details" className="rounded-lg p-2 text-ink-2 hover:bg-paper">
            <Icon.Close />
          </button>
        </header>

        <div className="flex-1 space-y-4 overflow-y-auto bg-paper px-5 py-5">
          {r && (
            <section aria-label="Relevance score" className={card}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <H>Relevance score</H>
                  {fit && <p className="-mt-1 text-sm leading-snug text-ink-2">{fit}</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="tnum text-[40px] font-semibold leading-none text-brand">{pct(r.score.final)}</p>
                  <p className="mt-1.5 text-xs font-medium text-ink-3">Overall score</p>
                </div>
              </div>
              <div role="img" aria-label={`Overall score ${pct(r.score.final)} out of 100`} className="mt-4 h-2.5 overflow-hidden rounded-full bg-paper ring-1 ring-inset ring-rule">
                <div className={`h-full rounded-full ${shadeFor(r.score.final)}`} style={{ width: `${Math.min(r.score.final, 1) * 100}%` }} />
              </div>
              <dl className="tnum mt-4 grid grid-cols-3 gap-3">
                {([
                  ['Similarity', cfg.weights.similarity, r.score.similarity],
                  ['Depth', cfg.weights.depth, r.score.depth],
                  ['Recency', cfg.weights.recency, r.score.recency],
                ] as const).map(([label, w, v]) => (
                  <div key={label} className="rounded-xl bg-paper px-3.5 py-3">
                    <dt className="text-[13px] text-ink-2">{label} <span className="text-ink-3">· {pct(w)}%</span></dt>
                    <dd className="mt-1 text-[22px] font-semibold leading-tight">{pct(v)}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {r && (
            <section aria-label="Why this reviewer" className={card}>
              <H>Why this reviewer</H>
              {r.explanation.sufficient ? (
                <>
                  <p className="font-serif text-[16px] leading-relaxed">{r.explanation.text}</p>
                  {r.explanation.sharedTopics.length > 0 && (
                    <div className="mt-3">
                      <p className="mb-1.5 text-[13px] font-medium text-ink-2">Shared with this manuscript</p>
                      <div className="flex flex-wrap gap-1.5">{r.explanation.sharedTopics.map((t) => (<Chip key={t} tone="brand">{t}</Chip>))}</div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex gap-2.5 rounded-lg bg-paper p-3.5 text-sm text-ink-2">
                  <Icon.Info size={17} className="mt-0.5 shrink-0" />
                  <p><b className="text-ink">Not enough evidence.</b> {r.explanation.text}</p>
                </div>
              )}
            </section>
          )}

          <section aria-label="Conflicts of interest" className={card}>
            <H>Conflicts of interest</H>
            {subject.coi.length === 0 ? (
              <div className="flex gap-2.5 rounded-lg bg-good-tint p-3.5 text-sm text-good">
                <Icon.Shield size={17} className="mt-0.5 shrink-0" />
                <p>
                  {manuscript && manuscript.authors.length > 0
                    ? `No conflicts found against ${manuscript.authors.length} manuscript author${manuscript.authors.length === 1 ? '' : 's'}. Checked identity, shared institution, and co-authorship in the last ${cfg.coiCoauthorYears} years.`
                    : 'No authors were entered for this manuscript, so conflict checks could not run.'}
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {subject.coi.map((f) => (
                  <li key={f.reason} className="flex items-start gap-2.5 rounded-lg bg-warn-tint p-3.5 text-sm text-warn">
                    <Icon.Warn size={17} className="mt-0.5 shrink-0" />
                    <p>{f.reason}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section aria-label={r ? 'Closest publications' : 'Recent publications'} className={card}>
            <H aside={r ? '% similar to the manuscript' : undefined}>{r ? 'Closest publications' : 'Recent publications'}</H>
            {pubs.length === 0 ? (
              <p className="text-sm text-ink-2">No publications for this researcher in the index.</p>
            ) : (
              <ol className="space-y-3">
                {pubs.map((p) => (
                  <li key={p.paperIdx} className="flex gap-4 rounded-xl border border-rule p-4">
                    {p.similarity !== undefined && (
                      <div className="w-12 shrink-0">
                        <p className="tnum text-[22px] font-semibold leading-none text-brand">{pct(p.similarity)}</p>
                        <div className="mt-2 h-1 overflow-hidden rounded-full bg-paper ring-1 ring-inset ring-rule">
                          <div className={`h-full rounded-full ${shadeFor(p.similarity)}`} style={{ width: `${Math.min(p.similarity, 1) * 100}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-serif text-[15px] font-semibold leading-snug">{p.title}</p>
                      <p className="tnum mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[13px] text-ink-2">
                        <span>{p.year}</span>
                        {p.similarity !== undefined && p.similarity >= cfg.depthThreshold && <span className="font-medium text-brand">Strong match</span>}
                        <button
                          onClick={() => openAbstract(p)}
                          className="rounded-md px-2 py-0.5 text-xs font-semibold text-brand ring-1 ring-inset ring-brand/30 hover:bg-brand-tint"
                        >
                          Abstract
                        </button>
                        {p.doi && (
                          <a href={p.doi} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 text-brand hover:underline">DOI <Icon.External size={11} /></a>
                        )}
                      </p>
                      <div className="mt-2.5 flex flex-wrap gap-1">
                        {p.keywords.slice(0, 6).map((k) => (
                          <Chip key={k} tone={msKeywords.has(k.toLowerCase()) || shared.has(k.toLowerCase()) ? 'brand' : 'neutral'} className="text-[11px]">{k}</Chip>
                        ))}
                      </div>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {r && allPapers.length > r.evidence.length && (
              <details className="mt-4 text-sm">
                <summary className="cursor-pointer font-medium text-brand">All {allPapers.length} papers by this researcher in the index</summary>
                <ul className="mt-2 space-y-1.5 text-[13px] text-ink-2">
                  {allPapers.map((p) => (<li key={p.id}><span className="tnum text-ink-3">{p.year}</span> {p.title}</li>))}
                </ul>
              </details>
            )}
          </section>

          <section aria-label="Track record" className={card}>
            <H>Track record</H>
            <TrackRecordCard author={author} />
          </section>
        </div>

        <footer className="flex flex-wrap items-center justify-end gap-2 border-t border-rule bg-surface px-6 py-4">
          {tracked && !cancelled && !onBackupList ? (
            <Chip tone={statusTone(tracked.invitationStatus)} className="px-3 py-1 text-sm">
              {tracked.invitationStatus === InvitationStatus.PENDING ? 'Invitation sent' : statusLabel(tracked.invitationStatus)}
            </Chip>
          ) : cancelled ? (
            <>
              <Chip tone="neutral" className="px-3 py-1 text-sm">Cancelled</Chip>
              <Button variant="primary" onClick={() => onInvite(author, r)}><Icon.Mail size={16} /> Invite again</Button>
            </>
          ) : onBackupList ? (
            <>
              <Chip tone="warn" className="px-3 py-1 text-sm">Backup</Chip>
              <Button variant="primary" onClick={() => onInvite(author, r)}><Icon.Mail size={16} /> Send invitation</Button>
            </>
          ) : (
            <>
              <Button variant="ghost" onClick={() => onBackup(author, r?.score.final)}>Mark as backup</Button>
              <Button variant="primary" onClick={() => onInvite(author, r)}><Icon.Mail size={16} /> Send invitation</Button>
            </>
          )}
        </footer>
      </aside>
      <AbstractModal paper={abstract} onClose={() => setAbstract(null)} />
    </div>
  );
};

export default ReviewerDrawer;
