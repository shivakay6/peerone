import React from 'react';
import { AuthorRecord, CoiFlag, InvitationStatus, TrackedReviewer } from '../types';
import { Button, Chip } from './ui';
import { Avatar, CoiChip, NameLink, tableCard, tableHead, tableRow, ExpertiseChips, statusLabel, statusTone } from './ReviewerBits';

interface Props {
  items: TrackedReviewer[];
  expertise: (a: AuthorRecord) => string[];
  onOpen: (a: AuthorRecord) => void;
  onFollowUp: (t: TrackedReviewer) => void;
  onCancel: (t: TrackedReviewer) => void;
  onInviteAgain: (t: TrackedReviewer) => void;
  onReply: (t: TrackedReviewer, reply: InvitationStatus.ACCEPTED | InvitationStatus.DECLINED) => void;
  onInviteBackup: (t: TrackedReviewer) => void;
}

const COLS = 'lg:grid-cols-[minmax(230px,1.2fr)_minmax(0,1.2fr)_88px_92px_minmax(0,0.6fr)_minmax(190px,0.9fr)]';

const TrackList: React.FC<Props> = ({ items, expertise, onOpen, onFollowUp, onCancel, onInviteAgain, onReply, onInviteBackup }) => {
  if (items.length === 0) {
    return (
      <div className="border-y border-rule py-12 text-center">
        <p className="text-[15px] font-semibold">No invitations yet</p>
        <p className="mt-1 text-sm text-ink-2">Invite a reviewer, or mark a few as backups, and they will be tracked here.</p>
      </div>
    );
  }
  const count = (s: InvitationStatus) => items.filter((i) => i.invitationStatus === s).length;
  const cancelled = count(InvitationStatus.CANCELLED);
  return (
    <div>
      <p className="mb-3 text-sm text-ink-2">
        <b className="tnum text-ink">{count(InvitationStatus.PENDING)}</b> awaiting reply, <b className="tnum text-ink">{count(InvitationStatus.ACCEPTED)}</b> accepted,{' '}
        <b className="tnum text-ink">{count(InvitationStatus.DECLINED)}</b> declined, <b className="tnum text-ink">{count(InvitationStatus.BACKUP)}</b> on backup
        {cancelled > 0 && <>, <b className="tnum text-ink">{cancelled}</b> cancelled</>}.
      </p>
      <div className={tableCard}>
      <div className={`${tableHead} ${COLS}`}>
        <span>Reviewer</span><span>Expertise</span><span>Invitation</span><span>Review</span><span>Last activity</span><span />
      </div>
      <ul className="divide-y divide-rule">
        {items.map((t) => {
          const coi: CoiFlag[] = t.coi ?? [];
          const st = t.invitationStatus;
          return (
            <li key={t.instanceId} className={`${tableRow} ${COLS}`}>
              <div className="flex min-w-0 items-start gap-3">
                <Avatar name={t.author.name} />
                <div className="min-w-0">
                  <NameLink name={t.author.name} size="text-[17px]" onOpen={() => onOpen(t.author)} />
                  <p className="mt-0.5 text-[13px] leading-snug text-ink-2">{t.author.affiliation}</p>
                  {coi.length > 0 && <div className="mt-2"><CoiChip flags={coi} /></div>}
                </div>
              </div>
              <ExpertiseChips topics={expertise(t.author)} />
              <div><Chip tone={statusTone(st)} className="px-2.5 py-1 text-[13px]">{statusLabel(st)}</Chip></div>
              <span className="pt-1 text-[13px] text-ink-2">{t.reviewStatus}</span>
              <span className="pt-1 text-[13px] text-ink-2">{t.lastActivity}</span>
              <div className="flex flex-col items-start gap-1.5 lg:items-end">
                {st === InvitationStatus.PENDING && (
                  <>
                    <div className="flex gap-1.5">
                      <Button small onClick={() => onFollowUp(t)}>Send reminder</Button>
                      <Button small variant="danger" onClick={() => onCancel(t)}>Cancel</Button>
                    </div>
                    <p className="text-xs text-ink-3" title="Demo: record the reply a reviewer would send">
                      Record reply:{' '}
                      <button className="font-medium text-brand hover:underline" onClick={() => onReply(t, InvitationStatus.ACCEPTED)}>accepted</button>
                      {' · '}
                      <button className="font-medium text-brand hover:underline" onClick={() => onReply(t, InvitationStatus.DECLINED)}>declined</button>
                    </p>
                  </>
                )}
                {st === InvitationStatus.ACCEPTED && <Button small variant="danger" onClick={() => onCancel(t)}>Cancel</Button>}
                {st === InvitationStatus.BACKUP && <Button small variant="primary" onClick={() => onInviteBackup(t)}>Invite now</Button>}
                {st === InvitationStatus.CANCELLED && <Button small variant="primary" onClick={() => onInviteAgain(t)}>Invite again</Button>}
              </div>
            </li>
          );
        })}
      </ul>
      </div>
    </div>
  );
};

export default TrackList;
