import React, { useMemo } from 'react';
import { AuthorRecord, CoiFlag, TrackedReviewer } from '../types';
import { Corpus } from '../services/pipeline';
import { expertiseFor } from '../services/expertise';
import { Affiliation, ExpertiseChips, InviteActions, TrackRecord, tableCard, tableHead, tableRow } from './ReviewerBits';

interface Props {
  corpus: Corpus;
  query: string;
  tracked: Map<string, TrackedReviewer>;
  coiOf: (a: AuthorRecord) => CoiFlag[];
  onOpen: (a: AuthorRecord) => void;
  onInvite: (a: AuthorRecord) => void;
  onBackup: (a: AuthorRecord) => void;
}

const COLS = 'lg:grid-cols-[minmax(230px,1.2fr)_minmax(0,1.5fr)_196px_140px]';

const PoolList: React.FC<Props> = ({ corpus, query, tracked, coiOf, onOpen, onInvite, onBackup }) => {
  const rows = useMemo(
    () =>
      corpus.authors
        .filter((a) => a.inPool)
        .map((a) => ({ a, topics: expertiseFor(a, corpus), coi: coiOf(a) }))
        .sort((x, y) => x.a.name.localeCompare(y.a.name)),
    [corpus, coiOf],
  );
  const q = query.trim().toLowerCase();
  const shown = q ? rows.filter(({ a, topics }) => `${a.name} ${a.affiliation} ${topics.join(' ')}`.toLowerCase().includes(q)) : rows;

  if (shown.length === 0) return <p className="border-y border-rule py-12 text-center text-[15px] text-ink-2">No one in your reviewer database matches that filter.</p>;
  return (
    <div>
      <p className="mb-3 text-sm text-ink-2">{rows.length} researchers your journal has worked with. Select a name to see their recent publications.</p>
      <div className={tableCard}>
      <div className={`${tableHead} ${COLS}`}>
        <span>Reviewer</span><span>Expertise</span><span>Track record</span><span />
      </div>
      <ul className="divide-y divide-rule">
        {shown.map(({ a, topics, coi }) => (
          <li key={a.id} className={`${tableRow} ${COLS}`}>
            <Affiliation author={a} coi={coi} onOpen={() => onOpen(a)} />
            <ExpertiseChips topics={topics} />
            <TrackRecord author={a} />
            <InviteActions tracked={tracked.get(a.id)} onInvite={() => onInvite(a)} onBackup={() => onBackup(a)} />
          </li>
        ))}
      </ul>
      </div>
    </div>
  );
};

export default PoolList;
