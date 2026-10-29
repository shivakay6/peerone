import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AuthorRecord, InvitationStatus, Manuscript, PipelineResult, RankedReviewer, ReviewStatus, TrackedReviewer,
} from './types';
import { Corpus, makeCoiChecker, runPipeline } from './services/pipeline';
import { warmConcepts } from './services/concepts';
import { expertiseFor } from './services/expertise';
import { ENGINE_CONFIG } from './services/config';
import { loadCorpus } from './services/dataService';
import { embedManuscript, loadEmbeddingModel } from './services/embeddingService';
import { resetSamples } from './services/samples';
import Header from './components/Header';
import IntakeScreen, { CorpusStats } from './components/IntakeScreen';
import ProcessingScreen, { StageResult } from './components/ProcessingScreen';
import ResultsScreen from './components/ResultsScreen';
import ReviewerDrawer, { DrawerSubject } from './components/ReviewerDrawer';
import EmailModal, { EmailCtx } from './components/EmailModal';
import { Button } from './components/ui';

type Phase = 'intake' | 'processing' | 'results';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
// Each stage stays on screen at least this long so the run is legible. The numbers shown are real.
const STAGE_DWELL_MS = 520;
const uid = () => Math.random().toString(36).slice(2, 11);

function inviteBody(author: AuthorRecord, m: Manuscript, reviewer?: RankedReviewer): string {
  const closest = reviewer?.evidence[0];
  return [
    `Dear ${author.name},`,
    '',
    `On behalf of the editorial team, I would like to invite you to review a manuscript titled "${m.title}".`,
    '',
    closest
      ? `We are writing to you because of your recent work, including "${closest.title}" (${closest.year}), which is closely related to the submission.`
      : 'We are writing to you because of your expertise in the subject area of the submission.',
    '',
    `Abstract: ${m.abstract}`,
    '',
    'Please let us know within seven days whether you are able to review. If you accept, we will share the full manuscript and ask for your report within three weeks. If you are unable to review, a suggestion for another qualified reviewer would be very welcome.',
    '',
    'Kind regards,',
    'The Editorial Team',
  ].join('\n');
}

const App: React.FC = () => {
  const [corpus, setCorpus] = useState<Corpus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [engineReady, setEngineReady] = useState(false);

  const [phase, setPhase] = useState<Phase>('intake');
  const [resetKey, setResetKey] = useState(0);
  const [draft, setDraft] = useState<Manuscript | undefined>();
  const [manuscript, setManuscript] = useState<Manuscript | null>(null);
  const [done, setDone] = useState<StageResult[]>([]);
  const [procError, setProcError] = useState<string | null>(null);
  const [result, setResult] = useState<PipelineResult | null>(null);

  const [tracked, setTracked] = useState<TrackedReviewer[]>([]);
  const [count, setCount] = useState(10);
  const [drawer, setDrawer] = useState<DrawerSubject | null>(null);
  const [email, setEmail] = useState<EmailCtx | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  // Load the static corpus and warm up the embedding model in parallel.
  useEffect(() => {
    let cancelled = false;
    loadCorpus()
      .then((c) => {
        if (cancelled) return;
        setCorpus(c);
        window.setTimeout(() => warmConcepts(c.papers), 50); // build word statistics before the first search
      })
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? e.message : String(e)));
    loadEmbeddingModel()
      .then(() => !cancelled && setEngineReady(true))
      .catch((e) => !cancelled && setLoadError(e instanceof Error ? `The embedding model could not be loaded: ${e.message}` : String(e)));
    return () => { cancelled = true; };
  }, []);

  const stats: CorpusStats | null = useMemo(() => {
    if (!corpus) return null;
    const years = corpus.papers.map((p) => p.year);
    return {
      papers: corpus.papers.length,
      authors: corpus.authors.length,
      poolSize: corpus.authors.filter((a) => a.inPool).length,
      from: Math.min(...years),
      to: Math.max(...years),
    };
  }, [corpus]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 3200);
  }, []);

  // ---------------------------------------------------------------- run

  const handleSubmit = async (m: Manuscript, n: number) => {
    if (!corpus) return;
    setCount(n);
    setManuscript(m);
    setDraft(m);
    setResult(null);
    setDone([]);
    setProcError(null);
    setTracked([]);
    setDrawer(null);
    setPhase('processing');

    const push = async (detail: string, ms?: number) => {
      setDone((d) => [...d, { detail, ms }]);
      await sleep(STAGE_DWELL_MS);
    };

    try {
      await sleep(200);
      await push(
        `Title, ${m.abstract.length.toLocaleString()} characters of abstract, ${m.keywords.length} keyword${m.keywords.length === 1 ? '' : 's'} and ${m.authors.length} author${m.authors.length === 1 ? '' : 's'}. Authors are kept aside for conflict checks.`,
      );

      const t = performance.now();
      const vec = await embedManuscript(m);
      await push('Turned into a 384-number vector by a language model running in this browser. Nothing was sent anywhere.', performance.now() - t);

      const res = runPipeline(m, vec, corpus, { ...ENGINE_CONFIG, resultCount: n });
      const f = res.funnel;
      await push(
        `Compared against ${f.corpusSize.toLocaleString()} papers and kept the ${f.topPapers} closest. The closest: "${res.topPaperTitles[0]}"`,
      );
      await push(`${f.candidateAuthors} researchers wrote those ${f.topPapers} papers. They are the candidate pool.`);
      await push(
        `${f.scored} had published in the last ${ENGINE_CONFIG.windowYears} years. Each was scored on similarity (${ENGINE_CONFIG.weights.similarity * 100}%), depth (${ENGINE_CONFIG.weights.depth * 100}%) and recency (${ENGINE_CONFIG.weights.recency * 100}%).`,
      );
      await push(
        m.authors.length === 0
          ? 'No authors were entered, so this check was skipped.'
          : f.hardExcluded + f.softFlagged === 0
            ? `No conflicts found across ${m.authors.length} manuscript author${m.authors.length === 1 ? '' : 's'}.`
            : `${f.hardExcluded} excluded as a manuscript author. ${f.softFlagged} of the shortlist flagged for a shared institution or recent co-authorship.`,
      );
      await push(`${f.shown} reviewers recommended, each with an explanation written from their own papers.`, res.computeMs);

      setResult(res);
      await sleep(300);
      setPhase('results');
    } catch (e) {
      setProcError(e instanceof Error ? e.message : String(e));
    }
  };

  // ---------------------------------------------------------------- workflow

  const coiOf = useMemo(
    () => (manuscript && corpus ? makeCoiChecker(manuscript, corpus, ENGINE_CONFIG) : () => []),
    [manuscript, corpus],
  );

  const upsertTracked = (author: AuthorRecord, patch: Pick<TrackedReviewer, 'invitationStatus' | 'reviewStatus' | 'lastActivity'>, relevance?: number) =>
    setTracked((cur) => {
      const existing = cur.find((t) => t.author.id === author.id);
      const coi = coiOf(author);
      if (existing) return cur.map((t) => (t === existing ? { ...t, ...patch, coi, relevance: relevance ?? t.relevance } : t));
      return [...cur, { instanceId: uid(), author, relevance, coi, ...patch }];
    });

  const openInvite = (author: AuthorRecord, reviewer?: RankedReviewer) => {
    if (!manuscript) return;
    const again = tracked.find((t) => t.author.id === author.id)?.invitationStatus === InvitationStatus.CANCELLED;
    setEmail({
      title: 'Invitation to review',
      to: author.email,
      subject: `Invitation to review: ${manuscript.title}`,
      body: inviteBody(author, manuscript, reviewer),
      sendLabel: again ? 'Send invitation again' : 'Send invitation',
      onSend: () => {
        upsertTracked(
          author,
          { invitationStatus: InvitationStatus.PENDING, reviewStatus: ReviewStatus.NOT_STARTED, lastActivity: again ? 'Invitation sent again today' : 'Invitation sent today' },
          reviewer?.score.final,
        );
        showToast(`Invitation sent to ${author.name}`);
      },
    });
  };

  const markBackup = (author: AuthorRecord, relevance?: number) => {
    if (tracked.some((t) => t.author.id === author.id && t.invitationStatus !== InvitationStatus.CANCELLED)) return;
    upsertTracked(author, { invitationStatus: InvitationStatus.BACKUP, reviewStatus: ReviewStatus.NOT_STARTED, lastActivity: 'Marked as backup today' }, relevance);
    showToast(`${author.name} marked as backup`);
  };

  const followUp = (t: TrackedReviewer) =>
    setEmail({
      title: 'Reminder',
      to: t.author.email,
      subject: `Reminder: invitation to review "${manuscript?.title ?? ''}"`,
      body: `Dear ${t.author.name},\n\nI am following up on our invitation to review "${manuscript?.title ?? 'a manuscript'}". We have not heard back yet and would value your expertise. Could you let us know whether you are able to review?\n\nKind regards,\nThe Editorial Team`,
      sendLabel: 'Send reminder',
      onSend: () => {
        setTracked((cur) => cur.map((x) => (x.instanceId === t.instanceId ? { ...x, lastActivity: 'Reminder sent today' } : x)));
        showToast(`Reminder sent to ${t.author.name}`);
      },
    });

  const cancelInvite = (t: TrackedReviewer) =>
    setEmail({
      title: 'Cancel invitation',
      to: t.author.email,
      subject: 'Update on your review invitation',
      body: `Dear ${t.author.name},\n\nThank you for considering our invitation to review "${manuscript?.title ?? 'a manuscript'}". We have now reached the number of reviewers we need, so we are cancelling this invitation. We hope to work with you on a future submission.\n\nKind regards,\nThe Editorial Team`,
      sendLabel: 'Send cancellation',
      onSend: () => {
        setTracked((cur) =>
          cur.map((x) => (x.instanceId === t.instanceId ? { ...x, invitationStatus: InvitationStatus.CANCELLED, reviewStatus: ReviewStatus.CANCELLED, lastActivity: 'Cancelled today' } : x)),
        );
        showToast(`Invitation to ${t.author.name} cancelled`);
      },
    });

  const recordReply = (t: TrackedReviewer, reply: InvitationStatus.ACCEPTED | InvitationStatus.DECLINED) =>
    setTracked((cur) =>
      cur.map((x) =>
        x.instanceId === t.instanceId
          ? {
              ...x,
              invitationStatus: reply,
              reviewStatus: reply === InvitationStatus.ACCEPTED ? ReviewStatus.IN_PROGRESS : ReviewStatus.CANCELLED,
              lastActivity: reply === InvitationStatus.ACCEPTED ? 'Accepted today' : 'Declined today',
            }
          : x,
      ),
    );

  const rankedFor = (a: AuthorRecord) => result?.reviewers.find((r) => r.author.id === a.id);
  const openReviewer = (r: RankedReviewer) => setDrawer({ author: r.author, reviewer: r, coi: r.coi });
  const openAuthor = (a: AuthorRecord, opts?: { ranked: boolean }) => {
    const reviewer = opts?.ranked ? rankedFor(a) : undefined;
    setDrawer({ author: a, reviewer, coi: reviewer?.coi ?? coiOf(a) });
  };

  const resetAll = () => {
    resetSamples();
    setPhase('intake');
    setDraft(undefined);
    setManuscript(null);
    setResult(null);
    setDone([]);
    setProcError(null);
    setTracked([]);
    setCount(10);
    setDrawer(null);
    setEmail(null);
    setResetKey((k) => k + 1);
    window.scrollTo({ top: 0 });
  };

  const trackedFor = (a: AuthorRecord | undefined) => (a ? tracked.find((t) => t.author.id === a.id) : undefined);
  const engineError = loadError;
  const drawerExpertise = useMemo(
    () => (drawer && corpus ? expertiseFor(drawer.author, corpus, drawer.reviewer?.evidence) : []),
    [drawer, corpus],
  );

  return (
    <div className="min-h-screen pb-10">
      <Header ready={engineReady && !!corpus} error={!!engineError} onReset={resetAll} />

      {phase === 'intake' && (
        <IntakeScreen key={resetKey} stats={stats} engineReady={engineReady} engineError={engineError} initial={draft} initialCount={count} onSubmit={handleSubmit} />
      )}

      {phase === 'processing' && manuscript && (
        <>
          <ProcessingScreen manuscript={manuscript} done={done} error={procError} />
          {procError && (
            <div className="mx-auto max-w-6xl px-5 pb-10">
              <Button onClick={() => setPhase('intake')}>Back to the manuscript</Button>
            </div>
          )}
        </>
      )}

      {phase === 'results' && manuscript && result && corpus && (
        <ResultsScreen
          manuscript={manuscript}
          result={result}
          config={ENGINE_CONFIG}
          corpus={corpus}
          tracked={tracked}
          coiOf={coiOf}
          onEdit={() => { setDrawer(null); setPhase('intake'); }}
          onOpenReviewer={openReviewer}
          onOpenAuthor={openAuthor}
          onInvite={openInvite}
          onBackup={markBackup}
          onFollowUp={followUp}
          onCancel={cancelInvite}
          onInviteAgain={(t) => openInvite(t.author, rankedFor(t.author))}
          onReply={recordReply}
          onInviteBackup={(t) => openInvite(t.author, rankedFor(t.author))}
        />
      )}

      <ReviewerDrawer
        subject={drawer}
        manuscript={manuscript}
        config={ENGINE_CONFIG}
        corpus={corpus}
        expertise={drawerExpertise}
        tracked={trackedFor(drawer?.author)}
        onClose={() => setDrawer(null)}
        onInvite={(a, r) => { setDrawer(null); openInvite(a, r); }}
        onBackup={(a, rel) => { markBackup(a, rel); setDrawer(null); }}
      />

      <EmailModal ctx={email} onClose={() => setEmail(null)} />

      {toast && (
        <div role="status" aria-live="polite" className="fixed bottom-6 left-1/2 z-[90] -translate-x-1/2 rounded-lg bg-ink px-4 py-2.5 text-sm font-medium text-white shadow-lg">
          {toast}
        </div>
      )}
    </div>
  );
};

export default App;
