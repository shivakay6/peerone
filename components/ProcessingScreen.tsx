import React from 'react';
import { Manuscript } from '../types';
import { Chip, Icon, Spinner, cx } from './ui';

export interface StageResult { detail: string; ms?: number }

export const STAGE_TITLES = [
  'Read the manuscript',
  'Embed it on this device',
  'Search the publication index',
  'Find candidate researchers',
  'Score each researcher',
  'Check conflicts of interest',
  'Rank and explain',
] as const;

interface Props {
  manuscript: Manuscript;
  done: StageResult[]; // completed stages, in order
  error?: string | null;
}

const ProcessingScreen: React.FC<Props> = ({ manuscript, done, error }) => {
  const active = error ? -1 : done.length;
  return (
    <main className="mx-auto grid max-w-6xl gap-x-14 gap-y-8 px-5 py-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
      <section aria-label="Manuscript being analysed">
        <p className="text-sm font-semibold text-ink-2">Analysing</p>
        <h1 className="mt-1.5 font-serif text-[28px] font-semibold leading-tight tracking-tight">{manuscript.title}</h1>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {manuscript.keywords.map((k) => (<Chip key={k} tone="brand">{k}</Chip>))}
        </div>
        {manuscript.authors.length > 0 && (
          <p className="mt-4 text-sm text-ink-2">
            {manuscript.authors.map((a) => a.name).join(', ')}
          </p>
        )}
        <p className="mt-6 max-w-[56ch] text-[13px] leading-relaxed text-ink-3">
          Every step below runs in this browser. Nothing about the manuscript leaves your device.
        </p>
      </section>

      <section aria-label="Progress" aria-live="polite">
        <ol className="divide-y divide-rule border-y border-rule">
          {STAGE_TITLES.map((title, i) => {
            const result = done[i];
            const isDone = i < done.length;
            const isActive = i === active;
            return (
              <li key={title} className={cx('flex gap-3.5 py-4', !isDone && !isActive && 'opacity-45')}>
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center">
                  {isDone ? (
                    <span className="tick-in flex h-5 w-5 items-center justify-center rounded-full bg-good text-white"><Icon.Check size={13} /></span>
                  ) : isActive ? (
                    <Spinner className="text-brand" />
                  ) : (
                    <span className="h-3 w-3 rounded-full border-2 border-rule-strong" />
                  )}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[15px] font-semibold">{title}</p>
                  {isDone && <p className="mt-0.5 text-sm leading-snug text-ink-2">{result.detail}</p>}
                </div>
                {isDone && result.ms !== undefined && (
                  <span className="tnum shrink-0 pt-0.5 text-xs text-ink-3">{result.ms < 1 ? '<1' : Math.round(result.ms)} ms</span>
                )}
              </li>
            );
          })}
        </ol>
        {error && (
          <div role="alert" className="mt-5 rounded-lg bg-bad-tint p-4 text-sm text-bad">
            <p className="flex items-center gap-1.5 font-semibold"><Icon.Warn size={16} /> The analysis stopped</p>
            <p className="mt-1">{error}</p>
          </div>
        )}
      </section>
    </main>
  );
};

export default ProcessingScreen;
