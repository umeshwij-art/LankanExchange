import type { ReactNode } from 'react';
import type { Verdict } from '../../shared/indicators';
import { cx } from '../lib/format';

export function Stat({ label, value, sub, className }: { label: string; value: ReactNode; sub?: ReactNode; className?: string }) {
  return (
    <div className={cx('card p-4', className)}>
      <div className="label">{label}</div>
      <div className="num mt-1 text-xl font-semibold">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="font-semibold">{title}</div>
      {children && <div className="max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx('animate-pulse rounded-lg bg-surface-2', className)} />;
}

const VERDICT_TONE: Record<Verdict, string> = {
  'Strong Buy': 'bg-up text-white',
  Buy: 'bg-up-soft text-up',
  Neutral: 'bg-surface-2 text-muted',
  Sell: 'bg-down-soft text-down',
  'Strong Sell': 'bg-down text-white',
};

export function VerdictBadge({ verdict, size = 'sm' }: { verdict: Verdict | null; size?: 'sm' | 'lg' }) {
  if (!verdict) return <span className="text-xs text-muted">Not enough data</span>;
  return (
    <span className={cx('inline-block rounded-md font-semibold', VERDICT_TONE[verdict], size === 'lg' ? 'px-3 py-1.5 text-base' : 'px-2 py-0.5 text-xs')}>
      {verdict}
    </span>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
}: {
  value: T;
  options: { value: T; label: string; tone?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={cx('inline-flex rounded-lg bg-surface-2 p-1', className)} role="tablist">
      {options.map(o => (
        <button
          key={o.value}
          role="tab"
          aria-selected={value === o.value}
          onClick={() => onChange(o.value)}
          className={cx(
            'flex-1 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors',
            value === o.value ? cx('bg-surface shadow-sm', o.tone ?? 'text-text') : 'text-muted hover:text-text',
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
