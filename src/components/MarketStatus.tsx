import { Clock } from 'lucide-react';
import { useEffect, useState } from 'react';
import { formatTradeDate, sessionState, type SessionState } from '../../shared/calendar';
import { useMarket } from '../lib/data';
import { cx } from '../lib/format';

const COPY: Record<SessionState, { label: string; tone: string; detail: string }> = {
  'pre-open': { label: 'Pre-open', tone: 'bg-accent', detail: 'Market orders fill instantly at the last close until 9:30am.' },
  open: { label: 'Market open', tone: 'bg-up', detail: 'Market orders placed now fill at today’s closing price (~3:15pm SL).' },
  'closed-awaiting-prices': { label: 'Closed · updating', tone: 'bg-accent', detail: 'Today’s closing prices are on their way. New market orders fill at today’s close.' },
  closed: { label: 'Closed', tone: 'bg-flat', detail: 'Market orders fill instantly at the last close.' },
  weekend: { label: 'Weekend', tone: 'bg-flat', detail: 'Market orders fill instantly at the last close.' },
};

export function useSession() {
  const { snapshot } = useMarket();
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);
  return sessionState(snapshot?.tradeDate ?? null, now);
}

export function MarketStatus({ className }: { className?: string }) {
  const { snapshot } = useMarket();
  const state = useSession();
  const c = COPY[state];
  return (
    <div className={cx('card flex flex-col gap-1 px-4 py-3 text-sm sm:flex-row sm:items-center sm:gap-4', className)}>
      <span className="flex items-center gap-2 font-semibold">
        <span className={cx('h-2 w-2 rounded-full', c.tone)} />
        {c.label}
      </span>
      <span className="flex items-center gap-1.5 text-muted">
        <Clock className="h-3.5 w-3.5" />
        {snapshot ? <>Prices as of close on <b className="font-semibold text-text">{formatTradeDate(snapshot.tradeDate)}</b></> : 'No prices loaded yet'}
      </span>
      <span className="text-muted sm:ml-auto">{c.detail}</span>
    </div>
  );
}
