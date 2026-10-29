import React, { useMemo, useRef, useState } from 'react';
import { AuthorRecord, CoiFlag, InvitationStatus, Manuscript, PipelineConfig, PipelineResult, RankedReviewer, TrackedReviewer } from '../types';
import { Corpus } from '../services/pipeline';
import { expertiseFor } from '../services/expertise';
import { Button, Chip, Icon, cx } from './ui';
import ReviewerList from './ReviewerList';
import PoolList from './PoolList';
import TrackList from './TrackList';

interface Props {
  manuscript: Manuscript;
  result: PipelineResult;
  config: PipelineConfig;
  corpus: Corpus;
  tracked: TrackedReviewer[];
  coiOf: (a: AuthorRecord) => CoiFlag[];
  onEdit: () => void;
  onOpenReviewer: (r: RankedReviewer) => void;
  onOpenAuthor: (a: AuthorRecord, opts?: { ranked: boolean }) => void;
  onInvite: (a: AuthorRecord, r?: RankedReviewer) => void;
  onBackup: (a: AuthorRecord, relevance?: number) => void;
  onFollowUp: (t: TrackedReviewer) => void;
  onCancel: (t: TrackedReviewer) => void;
  onInviteAgain: (t: TrackedReviewer) => void;
  onReply: (t: TrackedReviewer, reply: InvitationStatus.ACCEPTED | InvitationStatus.DECLINED) => void;
  onInviteBackup: (t: TrackedReviewer) => void;
}

type Tab = 'suggested' | 'database' | 'invitations';

const Stat: React.FC<{ icon: React.ReactNode; tone?: string; children: React.ReactNode }> = ({ icon, tone, children }) => (
  <span className="inline-flex items-center gap-2">
    <span className={cx('shrink-0', tone)}>{icon}</span>
    <span>{children}</span>
  </span>
);

const ResultsScreen: React.FC<Props> = (p) => {
  const { manuscript: m, result, corpus } = p;
  const [tab, setTab] = useState<Tab>('suggested');
  const [query, setQuery] = useState('');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const trackedMap = useMemo(() => new Map(p.tracked.map((t) => [t.author.id, t])), [p.tracked]);
  const expertise = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const r of result.reviewers) map.set(r.author.id, expertiseFor(r.author, corpus, r.evidence));
    return map;
  }, [result, corpus]);
  const expertiseOf = (a: AuthorRecord) => expertise.get(a.id) ?? expertiseFor(a, corpus);

  const q = query.trim().toLowerCase();
  const suggested = result.reviewers.filter(
    (r) => !q || `${r.author.name} ${r.author.affiliation} ${(expertise.get(r.author.id) ?? []).join(' ')}`.toLowerCase().includes(q),
  );
  const trackedShown = q ? p.tracked.filter((t) => `${t.author.name} ${t.author.affiliation}`.toLowerCase().includes(q)) : p.tracked;

  const f = result.funnel;
  const tabs: Array<{ id: Tab; label: string; count: number }> = [
    { id: 'suggested', label: 'Suggested reviewers', count: result.reviewers.length },
    { id: 'database', label: 'Reviewer database', count: corpus.authors.filter((a) => a.inPool).length },
    { id: 'invitations', label: 'Invitations', count: p.tracked.length },
  ];

  const onTabKey = (e: React.KeyboardEvent, i: number) => {
    const next = e.key === 'ArrowRight' ? (i + 1) % tabs.length : e.key === 'ArrowLeft' ? (i - 1 + tabs.length) % tabs.length : -1;
    if (next >= 0) { e.preventDefault(); setTab(tabs[next].id); tabRefs.current[next]?.focus(); }
  };

  return (
    <main className="mx-auto max-w-6xl px-5 py-8">
      <section aria-label="Manuscript" className="flex flex-wrap items-start justify-between gap-x-8 gap-y-3">
        <div className="min-w-0 max-w-[70ch]">
          <h1 className="font-serif text-[27px] font-semibold leading-tight tracking-tight">{m.title}</h1>
          {m.authors.length > 0 && <p className="mt-1.5 text-sm text-ink-2">{m.authors.map((a) => a.name).join(', ')}</p>}
          <div className="mt-3 flex flex-wrap gap-1.5">{m.keywords.map((k) => (<Chip key={k} tone="brand">{k}</Chip>))}</div>
        </div>
        <Button onClick={p.onEdit}>Edit manuscript</Button>
      </section>

      <section aria-label="Reviewer matching summary" className="mt-6 rounded-xl border border-rule bg-surface px-5 py-4">
        <h2 className="text-[15px] font-semibold">Reviewer matching summary</h2>
        <p className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[15px] text-ink">
          <Stat icon={<Icon.People size={18} />} tone="text-brand"><b className="tnum font-semibold">{f.scored}</b> active researchers evaluated</Stat>
          <span className="text-ink-3" aria-hidden>·</span>
          {f.softFlagged > 0 ? (
            <Stat icon={<Icon.Warn size={17} />} tone="text-warn"><b className="tnum font-semibold">{f.softFlagged}</b> potential conflict{f.softFlagged === 1 ? '' : 's'} flagged</Stat>
          ) : (
            <Stat icon={<Icon.Shield size={17} />} tone="text-good">No potential conflicts flagged</Stat>
          )}
          <span className="text-ink-3" aria-hidden>·</span>
          <Stat icon={<Icon.Check size={18} />} tone="text-good"><b className="tnum font-semibold">{f.shown}</b> relevant reviewer{f.shown === 1 ? '' : 's'} recommended</Stat>
        </p>
        {f.hardExcluded > 0 && (
          <details className="mt-2 text-sm text-ink-2">
            <summary className="cursor-pointer font-medium text-brand">{f.hardExcluded} excluded because {f.hardExcluded === 1 ? 'they are' : 'they match'} a manuscript author</summary>
            <ul className="mt-1.5 space-y-0.5">
              {result.hardExcluded.map((h) => (<li key={h.name}><b className="text-ink">{h.name}</b>: {h.reason}</li>))}
            </ul>
          </details>
        )}
        {m.authors.length === 0 && (
          <p className="mt-2 flex items-center gap-1.5 text-sm text-warn"><Icon.Warn size={15} /> No authors were entered, so conflict-of-interest checks did not run.</p>
        )}
      </section>

      <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-b border-rule">
        <div role="tablist" aria-label="Reviewer views" className="-mb-px flex flex-wrap gap-x-6">
          {tabs.map((t, i) => (
            <button
              key={t.id}
              ref={(el) => { tabRefs.current[i] = el; }}
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              onClick={() => setTab(t.id)}
              onKeyDown={(e) => onTabKey(e, i)}
              className={cx(
                'flex items-center gap-2 border-b-2 pb-3 pt-1 text-[15px] font-semibold transition-colors',
                tab === t.id ? 'border-brand text-ink' : 'border-transparent text-ink-3 hover:text-ink',
              )}
            >
              {t.label}
              <span className={cx('tnum rounded-full px-2 text-xs leading-5', tab === t.id ? 'bg-brand text-white' : 'bg-rule text-ink-2')}>{t.count}</span>
            </button>
          ))}
        </div>
        <div className="relative mb-2.5 w-full sm:w-72">
          <Icon.Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-3" />
          <input
            aria-label="Filter reviewers"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Filter by name, institution or topic"
            className="w-full rounded-lg border border-rule-strong bg-surface py-2 pl-9 pr-3 text-sm placeholder:text-ink-3 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </div>
      </div>

      <div className="mt-4" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 'suggested' && (
          <ReviewerList
            items={suggested}
            expertise={expertise}
            tracked={trackedMap}
            onOpen={p.onOpenReviewer}
            onInvite={p.onInvite}
            onBackup={p.onBackup}
            emptyText={
              result.reviewers.length === 0
                ? 'No researchers in the index are a close enough match. Try adding keywords or editing the abstract.'
                : 'No one in the suggestions matches that filter.'
            }
          />
        )}
        {tab === 'database' && (
          <PoolList
            corpus={corpus}
            query={query}
            tracked={trackedMap}
            coiOf={p.coiOf}
            onOpen={(a) => p.onOpenAuthor(a, { ranked: false })}
            onInvite={(a) => p.onInvite(a)}
            onBackup={(a) => p.onBackup(a)}
          />
        )}
        {tab === 'invitations' && (
          <TrackList
            items={trackedShown}
            expertise={expertiseOf}
            onOpen={(a) => p.onOpenAuthor(a, { ranked: true })}
            onFollowUp={p.onFollowUp}
            onCancel={p.onCancel}
            onInviteAgain={p.onInviteAgain}
            onReply={p.onReply}
            onInviteBackup={p.onInviteBackup}
          />
        )}
      </div>
    </main>
  );
};

export default ResultsScreen;
