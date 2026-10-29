import React, { useEffect, useRef, useState } from 'react';
import { Button, Icon } from './ui';

export interface EmailCtx {
  title: string;
  to: string;
  subject: string;
  body: string;
  sendLabel: string;
  onSend: () => void;
}

const field = 'w-full rounded-lg border border-rule-strong bg-surface px-3.5 py-2.5 text-[15px] focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20';

const EmailModal: React.FC<{ ctx: EmailCtx | null; onClose: () => void }> = ({ ctx, onClose }) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const first = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!ctx) return;
    setSubject(ctx.subject);
    setBody(ctx.body);
    const previous = document.activeElement as HTMLElement | null;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); previous?.focus?.(); };
  }, [ctx, onClose]);

  if (!ctx) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="email-title">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className="relative flex max-h-[92vh] w-full max-w-2xl flex-col rounded-xl bg-surface shadow-2xl">
        <header className="flex items-center justify-between border-b border-rule px-6 py-4">
          <h2 id="email-title" className="text-lg font-semibold">{ctx.title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-ink-2 hover:bg-paper"><Icon.Close /></button>
        </header>
        <div className="space-y-4 overflow-y-auto px-6 py-5">
          <div>
            <label htmlFor="em-to" className="mb-1 block text-sm font-semibold">To</label>
            <input id="em-to" className={`${field} bg-paper text-ink-2`} value={ctx.to} readOnly />
          </div>
          <div>
            <label htmlFor="em-sub" className="mb-1 block text-sm font-semibold">Subject</label>
            <input id="em-sub" ref={first} className={field} value={subject} onChange={(e) => setSubject(e.target.value)} />
          </div>
          <div>
            <label htmlFor="em-body" className="mb-1 block text-sm font-semibold">Message</label>
            <textarea id="em-body" rows={13} className={`${field} resize-y font-serif leading-relaxed`} value={body} onChange={(e) => setBody(e.target.value)} />
          </div>
          <p className="flex items-start gap-2 text-[13px] text-ink-3">
            <Icon.Info size={15} className="mt-0.5 shrink-0" /> This is a prototype. No email is sent; the invitation is only recorded under Invitations.
          </p>
        </div>
        <footer className="flex justify-end gap-2 border-t border-rule px-6 py-4">
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={() => { ctx.onSend(); onClose(); }}><Icon.Mail size={16} /> {ctx.sendLabel}</Button>
        </footer>
      </div>
    </div>
  );
};

export default EmailModal;
