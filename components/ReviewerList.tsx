import React from 'react';
import { AuthorRecord, RankedReviewer, TrackedReviewer } from '../types';
import { Affiliation, ExpertiseChips, InviteActions, RelevanceBar, TrackRecord, tableCard, tableHead, tableRow } from './ReviewerBits';

export const SUGGESTED_COLS = 'lg:grid-cols-[28px_minmax(230px,1.2fr)_minmax(0,1.3fr)_140px_196px_140px]';

interface Props {
  items: RankedReviewer[];
  expertise: Map<string, string[]>;
  tracked: Map<string, TrackedReviewer>;
  emptyText: string;
  onOpen: (r: RankedReviewer) => void;
  onInvite: (a: AuthorRecord, r?: RankedReviewer) => void;
  onBackup: (a: AuthorRecord, relevance?: number) => void;
}

const ReviewerList: React.FC<Props> = ({ items, expertise, tracked, emptyText, onOpen, onInvite, onBackup }) => {
  if (items.length === 0) return <p className="border-y border-rule py-12 text-center text-[15px] text-ink-2">{emptyText}</p>;
  return (
    <div className={tableCard}>
      <div className={`${tableHead} ${SUGGESTED_COLS}`}>
        <span /> <span>Reviewer</span> <span>Expertise</span> <span>Relevance score</span> <span>Track record</span> <span />
      </div>
      <ul className="divide-y divide-rule">
        {items.map((r, i) => (
          <li key={r.author.id} data-testid="reviewer-row" className={`${tableRow} ${SUGGESTED_COLS}`}>
            <span className="tnum hidden pt-1 text-sm font-semibold text-ink-3 lg:block">{i + 1}</span>
            <Affiliation author={r.author} coi={r.coi} onOpen={() => onOpen(r)} />
            <ExpertiseChips topics={expertise.get(r.author.id) ?? []} className="lg:pt-0.5" />
            <div className="pt-1.5"><RelevanceBar value={r.score.final} /></div>
            <TrackRecord author={r.author} />
            <InviteActions tracked={tracked.get(r.author.id)} onInvite={() => onInvite(r.author, r)} onBackup={() => onBackup(r.author, r.score.final)} />
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ReviewerList;
