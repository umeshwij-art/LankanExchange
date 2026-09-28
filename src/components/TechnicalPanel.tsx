import { useMemo, useState } from 'react';
import { ChevronDown, Info } from 'lucide-react';
import { summarize, type Action, type IndicatorReading } from '../../shared/indicators';
import type { Bar } from '../../shared/types';
import { guideFor } from '../lib/guide';
import { cx, money } from '../lib/format';
import { VerdictBadge } from './ui';

const ACTION_TONE: Record<Action, string> = { Buy: 'text-up', Sell: 'text-down', Neutral: 'text-muted' };

function Row({ r, open, onToggle, format }: { r: IndicatorReading; open: boolean; onToggle: () => void; format: (v: number) => string }) {
  const g = guideFor(r.key);
  return (
    <>
      <tr className="border-t border-line">
        <td className="py-2 pr-2">
          <button className="flex items-center gap-1 text-left font-medium hover:text-brand" onClick={onToggle} aria-expanded={open}>
            {r.label}
            <ChevronDown className={cx('h-3.5 w-3.5 text-muted transition-transform', open && 'rotate-180')} />
          </button>
        </td>
        <td className="num py-2 pr-2 text-right">{r.value === null ? '—' : format(r.value)}</td>
        <td className={cx('py-2 text-right font-semibold', r.action ? ACTION_TONE[r.action] : 'text-muted')}>{r.action ?? '—'}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={3} className="pb-3 text-xs text-muted">
            <p className="mb-1 text-text">{r.reason}.</p>
            {g && (
              <>
                <p>{g.short}</p>
                <p className="mt-1">
                  <span className="font-semibold text-text">Caution: </span>
                  {g.watchOut}
                </p>
              </>
            )}
          </td>
        </tr>
      )}
    </>
  );
}

export function TechnicalPanel({ bars }: { bars: Bar[] }) {
  const s = useMemo(() => summarize(bars), [bars]);
  const [open, setOpen] = useState<string | null>(null);
  const toggle = (k: string) => setOpen(o => (o === k ? null : k));

  return (
    <div className="card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="label">Technical summary · daily</div>
          <div className="mt-2">
            <VerdictBadge verdict={s.overall} size="lg" />
          </div>
        </div>
        <div className="flex gap-4 text-sm">
          <span>
            <b className="num text-up">{s.counts.buy}</b> <span className="text-muted">buy</span>
          </span>
          <span>
            <b className="num text-muted">{s.counts.neutral}</b> <span className="text-muted">neutral</span>
          </span>
          <span>
            <b className="num text-down">{s.counts.sell}</b> <span className="text-muted">sell</span>
          </span>
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-2">
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Moving averages</h3>
            <VerdictBadge verdict={s.maVerdict} />
          </div>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {s.movingAverages.map(r => (
                <Row key={r.key} r={r} open={open === r.key} onToggle={() => toggle(r.key)} format={money} />
              ))}
            </tbody>
          </table>
        </div>
        <div>
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Oscillators</h3>
            <VerdictBadge verdict={s.oscVerdict} />
          </div>
          <table className="mt-2 w-full text-sm">
            <tbody>
              {s.oscillators.map(r => (
                <Row key={r.key} r={r} open={open === r.key} onToggle={() => toggle(r.key)} format={v => v.toFixed(2)} />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="mt-4 flex gap-2 rounded-lg bg-surface-2 p-3 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        Signals are mechanical tallies of each indicator's textbook rule — a starting point for reading the chart, not a
        recommendation. Tap any indicator to see what it measures and where it misleads.
      </p>
    </div>
  );
}
