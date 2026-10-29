import React from 'react';
import { AuthorRecord, CoiFlag, InvitationStatus, ReviewerStats, TrackedReviewer } from '../types';
import { Button, Chip, Icon, cx } from './ui';
import { acceptanceRate, statsFor } from '../services/stats';

export const statusTone = (s: InvitationStatus) =>
  s === InvitationStatus.ACCEPTED ? 'good'
    : s === InvitationStatus.DECLINED ? 'bad'
    : s === InvitationStatus.BACKUP ? 'warn'
    : s === InvitationStatus.CANCELLED ? 'neutral'
    : 'brand';

export const statusLabel = (s: InvitationStatus) => (s === InvitationStatus.PENDING ? 'Invited' : s);

/** One colour for every score; the shade deepens as the score rises. */
export const shadeFor = (value: number) => (value >= 0.65 ? 'bg-brand' : value >= 0.5 ? 'bg-brand/70' : 'bg-brand/45');

export const RelevanceBar: React.FC<{ value: number; large?: boolean }> = ({ value, large }) => {
  const shade = shadeFor(value);
  return (
    <div className="flex items-center gap-3">
      <div
        role="img"
        aria-label={`Relevance score ${Math.round(value * 100)} out of 100`}
        className={cx('relative flex-1 overflow-hidden rounded-full bg-paper ring-1 ring-inset ring-rule', large ? 'h-3' : 'h-2.5')}
      >
        <div className={cx('grow-x absolute inset-y-0 left-0 rounded-full', shade)} style={{ width: `${Math.min(value, 1) * 100}%` }} />
      </div>
      <span className={cx('tnum text-right font-semibold text-ink', large ? 'w-12 text-2xl' : 'w-8 text-[15px]')}>{Math.round(value * 100)}</span>
    </div>
  );
};

/** Shared look for the three tables: one white card, a tinted header row, and roomy rows. */
export const tableCard = 'overflow-hidden rounded-2xl border border-rule bg-surface';
export const tableHead = 'hidden grid-cols-1 items-center gap-x-6 border-b border-rule bg-paper px-5 py-3 text-[13px] font-semibold text-ink-2 lg:grid';
export const tableRow = 'grid gap-x-6 gap-y-3 px-5 py-5 transition-colors hover:bg-paper/60 lg:items-start';

const TITLES = new Set(['dr', 'dr.', 'mr', 'mr.', 'mrs', 'mrs.', 'ms', 'ms.', 'prof', 'prof.', 'professor']);
export const initialsOf = (name: string) => {
  const parts = name.split(/\s+/).filter((p) => p && !TITLES.has(p.toLowerCase()));
  if (parts.length === 0) return '?';
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
};

export const Avatar: React.FC<{ name: string; size?: 'md' | 'lg' }> = ({ name, size = 'md' }) => (
  <span
    aria-hidden="true"
    className={cx(
      'inline-flex shrink-0 select-none items-center justify-center rounded-full bg-brand-tint font-semibold text-brand-deep',
      size === 'lg' ? 'h-12 w-12 text-[16px]' : 'h-10 w-10 text-[13px]',
    )}
  >
    {initialsOf(name)}
  </span>
);

export const CoiChip: React.FC<{ flags: CoiFlag[] }> = ({ flags }) =>
  flags.length === 0 ? null : (
    <Chip tone="warn" title={flags.map((f) => f.reason).join('\n')}>
      <Icon.Warn size={12} /> Conflict of interest
    </Chip>
  );

/** Where the researcher comes from, plus a conflict label when there is one. */
/** Keeps the arrow glued to the last word so it never wraps onto a line of its own. */
const NameParts: React.FC<{ name: string }> = ({ name }) => {
  const i = name.lastIndexOf(' ');
  const head = i > 0 ? name.slice(0, i + 1) : '';
  const last = i > 0 ? name.slice(i + 1) : name;
  const line = 'underline decoration-brand/40 decoration-2 underline-offset-4 group-hover:decoration-brand';
  return (
    <>
      {head && <span className={line}>{head.trimEnd()}</span>}
      {head && ' '}
      <span className="whitespace-nowrap">
        <span className={line}>{last}</span>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="ml-1 inline-block translate-y-[1px] transition-transform group-hover:translate-x-0.5" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
      </span>
    </>
  );
};

/** Reviewer name styled as an obvious link: brand colour, underline, and an arrow that nudges on hover. */
export const NameLink: React.FC<{ name: string; onOpen: () => void; size?: string }> = ({ name, onOpen, size = 'text-[18px]' }) => (
  <button
    type="button"
    onClick={onOpen}
    title="View reviewer profile"
    className={cx('group max-w-full cursor-pointer text-left font-serif font-semibold leading-snug text-brand-deep hover:text-brand focus-visible:text-brand', size)}
  >
    <NameParts name={name} />
  </button>
);

export const Affiliation: React.FC<{ author: AuthorRecord; coi: CoiFlag[]; onOpen: () => void }> = ({ author, coi, onOpen }) => (
  <div className="flex min-w-0 items-start gap-3">
    <Avatar name={author.name} />
    <div className="min-w-0">
      <NameLink name={author.name} onOpen={onOpen} />
      <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{author.affiliation}</p>
      <div className="mt-2 flex flex-col items-start gap-1.5">
        {author.inPool ? <Chip tone="brand">In your database</Chip> : <Chip>External researcher</Chip>}
        <CoiChip flags={coi} />
      </div>
    </div>
  </div>
);

export const ExpertiseChips: React.FC<{ topics: string[]; className?: string }> = ({ topics, className }) =>
  topics.length === 0 ? (
    <span className="text-[13px] text-ink-3">No topics listed</span>
  ) : (
    <div className={cx('flex flex-wrap gap-1.5', className)}>
      {topics.map((t) => (<Chip key={t} className="max-w-full">{t}</Chip>))}
    </div>
  );

/** Compact track record for table rows. */
export const TrackRecord: React.FC<{ author: Pick<AuthorRecord, 'id' | 'stats'> }> = ({ author }) => {
  const s = statsFor(author);
  const items: Array<[string, React.ReactNode]> = [
    ['Rating', (<span className="inline-flex items-center gap-1">{s.avgRating.toFixed(1)} <Icon.Star size={12} className="text-sig-recency" /></span>)],
    ['Acceptance', `${acceptanceRate(s)}%`],
    ['Turnaround', `${s.avgTat} days`],
    ['Reviews done', s.completedReviews],
  ];
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1.5">
      {items.map(([label, value]) => (
        <div key={label}>
          <dt className="text-[11.5px] leading-tight text-ink-3">{label}</dt>
          <dd className="tnum text-[14px] font-semibold leading-snug text-ink">{value}</dd>
        </div>
      ))}
    </dl>
  );
};

/** Full track record for the detail panel. */
export const TrackRecordCard: React.FC<{ author: Pick<AuthorRecord, 'id' | 'stats'> }> = ({ author }) => {
  const s: ReviewerStats = statsFor(author);
  const items: Array<[string, React.ReactNode]> = [
    ['Avg. turnaround', `${s.avgTat} days`],
    ['Rating', (<span className="inline-flex items-center gap-1">{s.avgRating.toFixed(1)} <Icon.Star size={15} className="text-sig-recency" /></span>)],
    ['Completed', s.completedReviews],
    ['Acceptance rate', `${acceptanceRate(s)}%`],
  ];
  return (
    <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {items.map(([k, v]) => (
        <div key={k} className="rounded-xl bg-paper px-3.5 py-3.5">
          <dt className="text-[12.5px] text-ink-3">{k}</dt>
          <dd className="tnum mt-1 text-[20px] font-semibold leading-tight text-ink">{v}</dd>
        </div>
      ))}
    </dl>
  );
};

/** Invite / backup buttons that follow the invitation through its life. */
export const InviteActions: React.FC<{
  tracked: TrackedReviewer | undefined;
  onInvite: () => void;
  onBackup: () => void;
}> = ({ tracked: t, onInvite, onBackup }) => {
  if (!t) {
    return (
      <div className="flex items-center gap-2 lg:justify-end">
        <Button small variant="primary" onClick={onInvite}><Icon.Mail size={14} /> Invite</Button>
        <Button small variant="ghost" onClick={onBackup}>Backup</Button>
      </div>
    );
  }
  const again = t.invitationStatus === InvitationStatus.CANCELLED;
  const backup = t.invitationStatus === InvitationStatus.BACKUP;
  return (
    <div className="flex flex-col items-start gap-1.5 lg:items-end">
      <Chip tone={statusTone(t.invitationStatus)} className="px-2.5 py-1 text-[13px]">{statusLabel(t.invitationStatus)}</Chip>
      {again && <Button small variant="primary" onClick={onInvite}><Icon.Mail size={14} /> Invite again</Button>}
      {backup && <Button small variant="primary" onClick={onInvite}><Icon.Mail size={14} /> Invite</Button>}
    </div>
  );
};
