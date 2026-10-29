import React from 'react';

export const cx = (...c: Array<string | false | null | undefined>) => c.filter(Boolean).join(' ');

type IconProps = { className?: string; size?: number };
const base = (size = 18) => ({
  width: size, height: size, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.9, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true,
});

export const Icon = {
  Search: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>),
  Upload: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><path d="M12 16V4m0 0-4 4m4-4 4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>),
  Download: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><path d="M12 4v12m0 0-4-4m4 4 4-4" /><path d="M4 20h16" /></svg>),
  File: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><path d="M14 3H7a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V7z" /><path d="M14 3v4h4M9 13h6M9 17h4" /></svg>),
  Check: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><path d="m5 12.5 4.5 4.5L19 7.5" /></svg>),
  Close: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><path d="M6 6l12 12M18 6 6 18" /></svg>),
  Warn: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><path d="M12 3 2.5 20h19z" /><path d="M12 10v4.5M12 17.5v.01" /></svg>),
  Info: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 8v.01" /></svg>),
  Chevron: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><path d="m6 9 6 6 6-6" /></svg>),
  Reset: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><path d="M4 12a8 8 0 1 0 2.6-5.9L4 8.5" /><path d="M4 4v4.5h4.5" /></svg>),
  Mail: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></svg>),
  Plus: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><path d="M12 5v14M5 12h14" /></svg>),
  Trash: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><path d="M4 7h16M10 11v6M14 11v6M6 7l1 12a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-12M9 7V4h6v3" /></svg>),
  External: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></svg>),
  Star: ({ className, size }: IconProps) => (<svg {...base(size)} className={className} fill="currentColor" strokeWidth={1}><path d="m12 3 2.7 5.6 6.1.8-4.5 4.2 1.1 6-5.4-2.9-5.4 2.9 1.1-6L3.2 9.4l6.1-.8z" /></svg>),
  People: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><circle cx="9" cy="8" r="3.2" /><path d="M3 19c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5" /><path d="M16 5.2a3.2 3.2 0 0 1 0 6M17.5 14c2.3.6 3.5 2.4 3.5 5" /></svg>),
  Shield: ({ className, size }: IconProps) => (<svg {...base(size)} className={className}><path d="M12 3 5 6v5c0 4.5 3 8.2 7 10 4-1.8 7-5.5 7-10V6z" /><path d="m9 12 2 2 4-4" /></svg>),
};

export const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <span className={cx('spin inline-block h-4 w-4 rounded-full border-2 border-current border-t-transparent', className)} role="status" aria-label="Loading" />
);

export const Logo: React.FC<{ className?: string }> = ({ className }) => (
  <div className={cx('flex items-center gap-2.5 select-none', className)}>
    <svg viewBox="0 0 40 40" className="h-8 w-8" aria-hidden>
      <defs>
        <linearGradient id="po-g" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
          <stop stopColor="#5F259F" /><stop offset=".6" stopColor="#7C3AED" /><stop offset="1" stopColor="#2563EB" />
        </linearGradient>
      </defs>
      <rect width="40" height="40" rx="11" fill="url(#po-g)" />
      <path d="M14 28V12H21C24.3 12 27 14.7 27 18C27 21.3 24.3 24 21 24H14" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="27" cy="18" r="2.5" fill="#38BDF8" /><circle cx="14" cy="12" r="2" fill="#F472B6" />
    </svg>
    <span className="text-[19px] font-bold tracking-tight text-ink">PeerOne</span>
  </div>
);

export const Chip: React.FC<{ tone?: 'neutral' | 'brand' | 'good' | 'warn' | 'bad'; children: React.ReactNode; title?: string; className?: string }> = ({
  tone = 'neutral', children, title, className,
}) => (
  <span
    title={title}
    className={cx(
      'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium leading-5',
      tone === 'neutral' && 'bg-paper text-ink-2 ring-1 ring-inset ring-rule',
      tone === 'brand' && 'bg-brand-tint text-brand-deep',
      tone === 'good' && 'bg-good-tint text-good',
      tone === 'warn' && 'bg-warn-tint text-warn',
      tone === 'bad' && 'bg-bad-tint text-bad',
      className,
    )}
  >
    {children}
  </span>
);

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; small?: boolean };
export const Button: React.FC<BtnProps> = ({ variant = 'secondary', small, className, children, ...rest }) => (
  <button
    {...rest}
    className={cx(
      'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50',
      small ? 'px-3 py-1.5 text-[13px]' : 'px-4 py-2.5 text-sm',
      variant === 'primary' && 'bg-brand text-white hover:bg-brand-deep',
      variant === 'secondary' && 'bg-surface text-ink ring-1 ring-inset ring-rule-strong hover:bg-paper',
      variant === 'ghost' && 'text-ink-2 hover:bg-brand-tint hover:text-brand-deep',
      variant === 'danger' && 'text-bad hover:bg-bad-tint',
      className,
    )}
  >
    {children}
  </button>
);

export const pct = (x: number, digits = 0) => `${(x * 100).toFixed(digits)}`;
