import React, { useEffect, useRef } from 'react';
import { Icon } from './ui';

export interface AbstractView { title: string; year: number; abstract: string; doi: string | null }

/** Scrollable abstract popup. It sits above the reviewer panel and closes on its own Escape. */
const AbstractModal: React.FC<{ paper: AbstractView | null; onClose: () => void }> = ({ paper, onClose }) => {
  const closeBtn = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!paper) return;
    const previous = document.activeElement as HTMLElement | null;
    closeBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.stopImmediatePropagation(); // keep the reviewer panel open underneath
      onClose();
    };
    window.addEventListener('keydown', onKey, true);
    return () => { window.removeEventListener('keydown', onKey, true); previous?.focus?.(); };
  }, [paper, onClose]);

  if (!paper) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="abstract-title">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className="relative flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl bg-surface shadow-2xl">
        <header className="flex items-start gap-4 border-b border-rule px-6 py-4">
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-ink-3">Abstract · {paper.year}</p>
            <h2 id="abstract-title" className="mt-0.5 font-serif text-[19px] font-semibold leading-snug">{paper.title}</h2>
          </div>
          <button ref={closeBtn} onClick={onClose} aria-label="Close abstract" className="rounded-lg p-2 text-ink-2 hover:bg-paper"><Icon.Close /></button>
        </header>
        <div className="overflow-y-auto px-6 py-5">
          {paper.abstract ? (
            <p className="font-serif text-[16px] leading-relaxed text-ink">{paper.abstract}</p>
          ) : (
            <p className="text-sm text-ink-2">No abstract is available for this paper.</p>
          )}
        </div>
        {paper.doi && (
          <footer className="border-t border-rule px-6 py-3.5 text-sm">
            <a href={paper.doi} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-brand hover:underline">
              Open the paper <Icon.External size={13} />
            </a>
          </footer>
        )}
      </div>
    </div>
  );
};

export default AbstractModal;
