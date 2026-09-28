import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowDown, ArrowUp } from 'lucide-react';
import type { Quote } from '../../shared/types';
import { useMarket } from '../lib/data';
import { useAuth } from '../lib/auth';
import { cx, money, pct, short, ticker, tone, whole } from '../lib/format';
import { MarketStatus } from '../components/MarketStatus';
import { Empty, Skeleton, Stat } from '../components/ui';

type SortKey = 'symbol' | 'close' | 'changePct' | 'volume' | 'turnover';

function Movers({ title, rows, metric }: { title: string; rows: Quote[]; metric: (q: Quote) => ReactNode }) {
  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      <ul className="mt-2 divide-y divide-line">
        {rows.map(q => (
          <li key={q.symbol}>
            <Link to={`/stock/${q.symbol}`} className="flex items-center justify-between gap-3 py-2 text-sm hover:text-brand">
              <span className="min-w-0">
                <span className="font-semibold">{ticker(q.symbol)}</span>
                <span className="block truncate text-xs text-muted">{q.name}</span>
              </span>
              <span className="num shrink-0 text-right">{metric(q)}</span>
            </Link>
          </li>
        ))}
        {rows.length === 0 && <li className="py-4 text-sm text-muted">Nothing traded.</li>}
      </ul>
    </div>
  );
}

export default function Markets() {
  const { snapshot, quotes, loading } = useMarket();
  const { user, login } = useAuth();
  const [filter, setFilter] = useState('');
  const [tradedOnly, setTradedOnly] = useState(true);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'turnover', dir: -1 });

  const traded = useMemo(() => quotes.filter(q => q.volume > 0), [quotes]);
  const breadth = useMemo(
    () => ({
      up: traded.filter(q => q.change > 0).length,
      down: traded.filter(q => q.change < 0).length,
      flat: traded.filter(q => q.change === 0).length,
      turnover: traded.reduce((s, q) => s + q.turnover, 0),
    }),
    [traded],
  );

  const gainers = [...traded].sort((a, b) => b.changePct - a.changePct).slice(0, 5).filter(q => q.changePct > 0);
  const losers = [...traded].sort((a, b) => a.changePct - b.changePct).slice(0, 5).filter(q => q.changePct < 0);
  const active = [...traded].sort((a, b) => b.turnover - a.turnover).slice(0, 5);

  const rows = useMemo(() => {
    const f = filter.trim().toUpperCase();
    return (tradedOnly ? traded : quotes)
      .filter(q => !f || q.symbol.includes(f) || q.name.toUpperCase().includes(f))
      .sort((a, b) => {
        const av = a[sort.key];
        const bv = b[sort.key];
        return (typeof av === 'string' ? av.localeCompare(bv as string) : (av as number) - (bv as number)) * sort.dir;
      });
  }, [quotes, traded, tradedOnly, filter, sort]);

  const th = (key: SortKey, label: string, right = true) => (
    <th className={cx('px-3 py-2 font-medium', right && 'text-right')}>
      <button
        className="inline-flex items-center gap-1 hover:text-text"
        onClick={() => setSort(s => ({ key, dir: s.key === key ? ((-s.dir) as 1 | -1) : key === 'symbol' ? 1 : -1 }))}
      >
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />)}
      </button>
    </th>
  );

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-14" />
        <div className="grid gap-4 md:grid-cols-3">
          <Skeleton className="h-60" />
          <Skeleton className="h-60" />
          <Skeleton className="h-60" />
        </div>
      </div>
    );
  }

  if (!snapshot) {
    return (
      <Empty title="No market data yet">
        Prices load after the first end-of-day run. If you're the admin, run <code>npm run eod -- --force</code> or trigger
        <code> /api/cron/eod?force=1</code>.
      </Empty>
    );
  }

  return (
    <div className="space-y-6">
      {!user && (
        <section className="card flex flex-col gap-4 bg-gradient-to-br from-brand/10 to-accent/10 p-6 sm:flex-row sm:items-center">
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">Learn to trade the Colombo Stock Exchange — risk free.</h1>
            <p className="mt-1 text-muted">
              Start with LKR 100,000 of practice money. Real CSE closing prices, real fees, real indicators. Every day's
              close moves your portfolio.
            </p>
          </div>
          <button className="btn-primary px-6 py-3" onClick={login}>
            Start trading
          </button>
        </section>
      )}

      <MarketStatus />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Advancing" value={<span className="text-up">{breadth.up}</span>} />
        <Stat label="Declining" value={<span className="text-down">{breadth.down}</span>} />
        <Stat label="Unchanged" value={breadth.flat} sub={`${quotes.length - traded.length} didn't trade`} />
        <Stat label="Turnover" value={`LKR ${short(breadth.turnover)}`} sub={`${traded.length} securities traded`} />
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Movers title="Top gainers" rows={gainers} metric={q => <span className="text-up">{pct(q.changePct)}</span>} />
        <Movers title="Top losers" rows={losers} metric={q => <span className="text-down">{pct(q.changePct)}</span>} />
        <Movers title="Most active (turnover)" rows={active} metric={q => <span>LKR {short(q.turnover)}</span>} />
      </div>

      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-center gap-3 border-b border-line p-4">
          <h2 className="font-semibold">All securities</h2>
          <input className="input max-w-xs" placeholder="Filter…" value={filter} onChange={e => setFilter(e.target.value)} />
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={tradedOnly} onChange={e => setTradedOnly(e.target.checked)} />
            Traded today only
          </label>
          <span className="ml-auto text-xs text-muted">{rows.length} shown</span>
        </div>
        <div className="max-h-[70vh] overflow-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-surface text-xs text-muted">
              <tr>
                {th('symbol', 'Security', false)}
                {th('close', 'Close')}
                {th('changePct', 'Change')}
                {th('volume', 'Volume')}
                {th('turnover', 'Turnover')}
              </tr>
            </thead>
            <tbody>
              {rows.map(q => (
                <tr key={q.symbol} className="border-t border-line hover:bg-surface-2">
                  <td className="px-3 py-2">
                    <Link to={`/stock/${q.symbol}`} className="block">
                      <span className="font-semibold">{ticker(q.symbol)}</span>
                      <span className="ml-2 hidden text-muted sm:inline">{q.name}</span>
                    </Link>
                  </td>
                  <td className="num px-3 py-2 text-right">{money(q.close)}</td>
                  <td className={cx('num px-3 py-2 text-right', tone(q.change))}>{pct(q.changePct)}</td>
                  <td className="num px-3 py-2 text-right">{whole(q.volume)}</td>
                  <td className="num px-3 py-2 text-right">{short(q.turnover)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
