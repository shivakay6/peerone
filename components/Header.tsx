import React from 'react';
import { Button, Icon, Logo, Spinner } from './ui';

interface Props { ready: boolean; error: boolean; onReset: () => void }

const Header: React.FC<Props> = ({ ready, error, onReset }) => (
  <header className="sticky top-0 z-30 border-b border-rule bg-surface/95 backdrop-blur">
    <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5">
      <Logo />
      <span className="hidden h-5 w-px bg-rule-strong sm:block" />
      <span className="hidden text-sm font-medium text-ink-2 sm:block">Smart Reviewer Discovery</span>
      <div className="ml-auto flex items-center gap-3">
        <span className="hidden items-center gap-2 text-[13px] text-ink-2 md:flex" role="status">
          {error ? (
            <><span className="h-2 w-2 rounded-full bg-bad" /> Search engine unavailable</>
          ) : ready ? (
            <><span className="h-2 w-2 rounded-full bg-good" /> Search engine ready</>
          ) : (
            <><Spinner className="text-brand" /> Loading search engine</>
          )}
        </span>
        <Button small onClick={onReset} title="Clear everything and start the demo again">
          <Icon.Reset size={15} /> Reset demo
        </Button>
      </div>
    </div>
  </header>
);

export default Header;
