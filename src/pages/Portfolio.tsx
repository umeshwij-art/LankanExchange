import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { formatTradeDate } from '../../shared/calendar';
import type { Order } from '../../shared/types';
import { cancelOrder } from '../lib/api';
import { useAuth } from '../lib/auth';
import { useMarket, usePortfolio } from '../lib/data';
import { cx, lkrText, money, pct, signed, ticker, tone, whole } from '../lib/format';
import { Empty, Skeleton, Stat } from '../components/ui';

const STATUS_TONE: Record<Order['status'], string> = {
  open: 'text-brand',
  filled: 'text-up',
  cancelled: 'text-muted',
  expired: 'text-muted',
  rejected: 'text-down',
};

export default function Portfolio() {
  const { user, login } = useAuth();
  const { snapshot } = useMarket();
  const p = usePortfolio();

  if (!user) {
    return (
      <Empty title="Your practice portfolio">
        Sign in to get LKR 100,000 of play money and start building a portfolio.
        <div className="mt-4">
          <button className="btn-primary" onClick={login}>Sign in</button>
        </div>
      </Empty>
    );
  }
  if (p.loading || !p.account) return <Skeleton className="h-96" />;

  const quotes = snapshot?.quotes ?? {};
  const rows = p.positions.map(pos => {
    const close = quotes[pos.symbol]?.close ?? pos.avgCost;
    const value = pos.quantity * close;
    const cost = pos.quantity * pos.avgCost;
    return { ...pos, close, value, cost, pl: value - cost, dayChange: (quotes[pos.symbol]?.change ?? 0) * pos.quantity };
  });
  const invested = rows.reduce((s, r) => s + r.value, 0);
  const unreal = rows.reduce((s, r) => s + r.pl, 0);
  const day = rows.reduce((s, r) => s + r.dayChange, 0);
  const equity = p.account.cash + p.account.reservedCash + invested;
  const ret = (equity / p.account.startingCash - 1) * 100;
  const closed = p.recentOrders.filter(o => o.status !== 'open').slice(0, 10);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Portfolio</h1>
        <p className="text-sm text-muted">Valued at the close on {snapshot ? formatTradeDate(snapshot.tradeDate) : '—'}.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Stat label="Total value" value={lkrText(equity)} sub={<span className={tone(ret)}>{pct(ret)} since start</span>} />
        <Stat label="Cash" value={lkrText(p.account.cash)} sub={p.account.reservedCash > 0 ? `${lkrText(p.account.reservedCash)} held for orders` : 'Available to trade'} />
        <Stat label="Unrealised P&L" value={<span className={tone(unreal)}>{signed(unreal)}</span>} sub={<span className={tone(day)}>{signed(day)} today</span>} />
        <Stat label="Realised P&L" value={<span className={tone(p.account.realizedPL)}>{signed(p.account.realizedPL)}</span>} sub="After fees, from closed trades" />
      </div>

      <section className="card overflow-hidden">
        <h2 className="border-b border-line p-4 font-semibold">Holdings</h2>
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted">No holdings yet. <Link className="text-brand underline" to="/">Find a stock</Link> to buy.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Security</th>
                  <th className="px-3 py-2 text-right font-medium">Shares</th>
                  <th className="px-3 py-2 text-right font-medium">Avg cost</th>
                  <th className="px-3 py-2 text-right font-medium">Close</th>
                  <th className="px-3 py-2 text-right font-medium">Value</th>
                  <th className="px-3 py-2 text-right font-medium">P&L</th>
                  <th className="px-3 py-2 text-right font-medium">Weight</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.symbol} className="border-t border-line">
                    <td className="px-3 py-2"><Link to={`/stock/${r.symbol}`} className="font-semibold hover:text-brand">{ticker(r.symbol)}</Link></td>
                    <td className="num px-3 py-2 text-right">{whole(r.quantity)}{r.reservedQuantity > 0 && <span className="text-xs text-muted"> ({whole(r.reservedQuantity)} held)</span>}</td>
                    <td className="num px-3 py-2 text-right">{money(r.avgCost)}</td>
                    <td className="num px-3 py-2 text-right">{money(r.close)}</td>
                    <td className="num px-3 py-2 text-right">{money(r.value)}</td>
                    <td className={cx('num px-3 py-2 text-right', tone(r.pl))}>{signed(r.pl)}<span className="block text-xs">{pct((r.pl / r.cost) * 100)}</span></td>
                    <td className="num px-3 py-2 text-right">{((r.value / equity) * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {p.openOrders.length > 0 && (
        <section className="card overflow-hidden">
          <h2 className="border-b border-line p-4 font-semibold">Open orders</h2>
          <ul className="divide-y divide-line text-sm">
            {p.openOrders.map(o => (
              <li key={o.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                <span>
                  <span className={cx('font-semibold', o.side === 'buy' ? 'text-up' : 'text-down')}>{o.side.toUpperCase()}</span>{' '}
                  {whole(o.quantity)} <Link to={`/stock/${o.symbol}`} className="font-semibold hover:text-brand">{ticker(o.symbol)}</Link>{' '}
                  {o.type === 'limit' ? `limit ${money(o.limitPrice)}` : 'at the close'}
                  <span className="block text-xs text-muted">
                    Active {formatTradeDate(o.eligibleFrom)}
                    {o.expiresOn && o.expiresOn !== o.eligibleFrom ? ` → ${formatTradeDate(o.expiresOn)}` : ''}
                    {o.reservedCash > 0 && ` · ${lkrText(o.reservedCash)} held`}
                  </span>
                </span>
                <button className="btn-ghost px-3 py-1 text-xs" onClick={() => cancelOrder(o.id).then(() => toast('Order cancelled'), e => toast.error(e.message))}>
                  Cancel
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="card overflow-hidden">
        <h2 className="border-b border-line p-4 font-semibold">Trade history</h2>
        {p.trades.length === 0 ? (
          <p className="p-6 text-sm text-muted">Your fills will appear here.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-muted">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">Date</th>
                  <th className="px-3 py-2 text-left font-medium">Trade</th>
                  <th className="px-3 py-2 text-right font-medium">Price</th>
                  <th className="px-3 py-2 text-right font-medium">Fees</th>
                  <th className="px-3 py-2 text-right font-medium">Net</th>
                  <th className="px-3 py-2 text-right font-medium">Realised</th>
                </tr>
              </thead>
              <tbody>
                {p.trades.map(t => (
                  <tr key={t.id} className="border-t border-line">
                    <td className="px-3 py-2 text-muted">{formatTradeDate(t.tradeDate)}</td>
                    <td className="px-3 py-2">
                      <span className={t.side === 'buy' ? 'text-up' : 'text-down'}>{t.side === 'buy' ? 'Bought' : 'Sold'}</span> {whole(t.quantity)}{' '}
                      <Link to={`/stock/${t.symbol}`} className="font-semibold hover:text-brand">{ticker(t.symbol)}</Link>
                    </td>
                    <td className="num px-3 py-2 text-right">{money(t.price)}</td>
                    <td className="num px-3 py-2 text-right">{money(t.fees)}</td>
                    <td className="num px-3 py-2 text-right">{t.side === 'buy' ? '−' : '+'}{money(t.netAmount)}</td>
                    <td className={cx('num px-3 py-2 text-right', tone(t.realizedPL))}>{t.realizedPL === null ? '—' : signed(t.realizedPL)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {closed.length > 0 && (
        <section className="card p-4 text-sm">
          <h2 className="font-semibold">Recent orders</h2>
          <ul className="mt-2 divide-y divide-line">
            {closed.map(o => (
              <li key={o.id} className="flex justify-between gap-3 py-2">
                <span>
                  {o.side.toUpperCase()} {whole(o.quantity)} {ticker(o.symbol)} {o.type === 'limit' ? `@ ${money(o.limitPrice)}` : 'at close'}
                  {o.note && <span className="block text-xs text-muted">{o.note}</span>}
                </span>
                <span className={cx('font-semibold capitalize', STATUS_TONE[o.status])}>
                  {o.status}
                  {o.fillPrice ? ` @ ${money(o.fillPrice)}` : ''}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
