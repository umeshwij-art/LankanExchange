import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { formatTradeDate } from '../../shared/calendar';
import { cancelOrder } from '../lib/api';
import { useHistory, useMarket, usePortfolio } from '../lib/data';
import { cx, lkrText, money, pct, short, signed, ticker, tone, whole } from '../lib/format';
import { StockChart } from '../components/StockChart';
import { TechnicalPanel } from '../components/TechnicalPanel';
import { OrderTicket } from '../components/OrderTicket';
import { Empty, Skeleton } from '../components/ui';
import { toast } from 'sonner';

export default function Stock() {
  const { symbol = '' } = useParams();
  const sym = symbol.toUpperCase();
  const { snapshot, loading } = useMarket();
  const quote = snapshot?.quotes[sym];
  const { bars } = useHistory(quote ? sym : undefined, snapshot?.tradeDate);
  const portfolio = usePortfolio();

  if (loading) return <Skeleton className="h-96" />;
  if (!quote || !snapshot) {
    return (
      <Empty title={`${sym} not found`}>
        It isn't in the latest CSE price list. <Link to="/" className="text-brand underline">Back to markets</Link>
      </Empty>
    );
  }

  const position = portfolio.positions.find(p => p.symbol === sym);
  const orders = portfolio.openOrders.filter(o => o.symbol === sym);
  const value = position ? position.quantity * quote.close : 0;
  const unreal = position ? value - position.quantity * position.avgCost : 0;

  return (
    <div className="space-y-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft className="h-4 w-4" /> Markets
      </Link>

      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {ticker(sym)} <span className="text-base font-normal text-muted">{sym}</span>
          </h1>
          <p className="text-muted">{quote.name}</p>
        </div>
        <div className="text-right">
          <div className="num text-3xl font-semibold">{money(quote.close)}</div>
          <div className={cx('num text-sm font-semibold', tone(quote.change))}>
            {signed(quote.change)} ({pct(quote.changePct)})
          </div>
          <div className="text-xs text-muted">Close · {formatTradeDate(snapshot.tradeDate)}</div>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line text-sm sm:grid-cols-3 lg:grid-cols-6">
        {[
          ['Open', quote.open ? money(quote.open) : '—'],
          ['High', money(quote.high)],
          ['Low', money(quote.low)],
          ['Prev. close', money(quote.previousClose)],
          ['Volume', whole(quote.volume)],
          ['Turnover', `LKR ${short(quote.turnover)}`],
        ].map(([k, v]) => (
          <div key={k} className="bg-surface px-4 py-3">
            <dt className="label">{k}</dt>
            <dd className="num mt-0.5">{v}</dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <section className="card p-4">{bars === null ? <Skeleton className="h-[500px]" /> : <StockChart bars={bars} />}</section>
          {bars && <TechnicalPanel bars={bars} />}
        </div>

        <aside className="space-y-4">
          <OrderTicket quote={quote} tradeDate={snapshot.tradeDate} portfolio={portfolio} />

          {position && (
            <div className="card p-4 text-sm">
              <h3 className="font-semibold">Your position</h3>
              <dl className="mt-2 space-y-1">
                <div className="flex justify-between"><dt className="text-muted">Shares</dt><dd className="num">{whole(position.quantity)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Avg cost (incl. fees)</dt><dd className="num">{money(position.avgCost)}</dd></div>
                <div className="flex justify-between"><dt className="text-muted">Market value</dt><dd className="num">{lkrText(value)}</dd></div>
                <div className="flex justify-between">
                  <dt className="text-muted">Unrealised P&L</dt>
                  <dd className={cx('num', tone(unreal))}>{signed(unreal)} ({pct((unreal / (position.quantity * position.avgCost)) * 100)})</dd>
                </div>
              </dl>
            </div>
          )}

          {orders.length > 0 && (
            <div className="card p-4 text-sm">
              <h3 className="font-semibold">Open orders</h3>
              <ul className="mt-2 divide-y divide-line">
                {orders.map(o => (
                  <li key={o.id} className="flex items-center justify-between gap-2 py-2">
                    <span>
                      <span className={o.side === 'buy' ? 'text-up' : 'text-down'}>{o.side.toUpperCase()}</span> {whole(o.quantity)}
                      {o.type === 'limit' ? ` @ ${money(o.limitPrice)}` : ' at close'}
                      <span className="block text-xs text-muted">from {formatTradeDate(o.eligibleFrom)}</span>
                    </span>
                    <button
                      className="btn-ghost px-2 py-1 text-xs"
                      onClick={() => cancelOrder(o.id).then(() => toast('Order cancelled'), e => toast.error(e.message))}
                    >
                      Cancel
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
