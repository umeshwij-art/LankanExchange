import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { buyCost, fees, FEE_RATE, LIMIT_ORDER_TRADING_DAYS, PRICE_BAND, sellProceeds } from '../../shared/fees';
import { formatTradeDate } from '../../shared/calendar';
import type { Quote, Side } from '../../shared/types';
import { placeOrder } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { PortfolioState } from '../lib/data';
import { cx, lkrText, money, whole } from '../lib/format';
import { Segmented } from './ui';
import { useSession } from './MarketStatus';

export function OrderTicket({ quote, tradeDate, portfolio }: { quote: Quote; tradeDate: string; portfolio: PortfolioState }) {
  const { user, login, accountReady } = useAuth();
  const session = useSession();
  const [side, setSide] = useState<Side>('buy');
  const [type, setType] = useState<'market' | 'limit'>('market');
  const [qtyText, setQtyText] = useState('');
  const [limitText, setLimitText] = useState(String(quote.close));
  const [busy, setBusy] = useState(false);

  useEffect(() => setLimitText(String(quote.close)), [quote.symbol, quote.close]);

  const position = portfolio.positions.find(p => p.symbol === quote.symbol);
  const freeShares = position ? position.quantity - position.reservedQuantity : 0;
  const cash = portfolio.account?.cash ?? 0;
  const qty = Math.floor(Number(qtyText) || 0);
  const limit = Number(limitText) || 0;

  const instant = type === 'market' && (session === 'pre-open' || session === 'closed' || session === 'weekend');
  const estPrice = type === 'limit' ? limit : quote.close;
  // What the server will set aside (market orders that wait reserve a 10% band).
  const reservePrice = type === 'limit' ? limit : instant ? quote.close : quote.close * (1 + PRICE_BAND);

  const maxBuy = useMemo(() => {
    if (!(reservePrice > 0)) return 0;
    return Math.max(0, Math.floor(cash / (reservePrice * (1 + FEE_RATE))));
  }, [cash, reservePrice]);

  const gross = qty * estPrice;
  const fee = fees(qty, estPrice);
  const total = side === 'buy' ? buyCost(qty, estPrice) : sellProceeds(qty, estPrice);
  const needed = side === 'buy' ? buyCost(qty, reservePrice) : 0;

  let problem: string | null = null;
  if (qty <= 0) problem = 'Enter a quantity';
  else if (type === 'limit' && !(limit > 0)) problem = 'Enter a limit price';
  else if (side === 'buy' && needed > cash) problem = `Not enough cash (max ${whole(maxBuy)} shares)`;
  else if (side === 'sell' && qty > freeShares) problem = freeShares > 0 ? `You can sell up to ${whole(freeShares)}` : `You don't hold ${quote.symbol}`;

  const timing =
    type === 'limit'
      ? `Rests for up to ${LIMIT_ORDER_TRADING_DAYS} trading days. Fills at your price (or better) on the first day the stock trades through it.`
      : instant
        ? `Fills now at the last close, LKR ${money(quote.close)} (${formatTradeDate(tradeDate)}).`
        : `The market is ${session === 'open' ? 'open' : 'closing'} — this fills at today's closing price once it's published (~3:15pm SL). We set aside the last close +10% to cover the move; the rest comes back.`;

  async function submit() {
    if (problem) return;
    setBusy(true);
    try {
      const res = await placeOrder({ symbol: quote.symbol, side, type, quantity: qty, limitPrice: type === 'limit' ? limit : undefined });
      if (res.status === 'filled') {
        toast.success(`${side === 'buy' ? 'Bought' : 'Sold'} ${whole(res.quantity)} ${quote.symbol} at LKR ${money(res.price)}`);
      } else {
        toast.success(`Order placed — waiting for the ${type === 'market' ? 'close' : 'price to be reached'}`, {
          description: res.expiresOn ? `Active from ${formatTradeDate(res.eligibleFrom)} until ${formatTradeDate(res.expiresOn)}` : undefined,
        });
      }
      setQtyText('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Order failed');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card p-4">
      <Segmented
        className="w-full"
        value={side}
        onChange={setSide}
        options={[
          { value: 'buy', label: 'Buy', tone: 'text-up' },
          { value: 'sell', label: 'Sell', tone: 'text-down' },
        ]}
      />

      <div className="mt-4 flex items-center justify-between">
        <span className="label">Order type</span>
        <Segmented
          value={type}
          onChange={setType}
          options={[
            { value: 'market', label: 'Market' },
            { value: 'limit', label: 'Limit' },
          ]}
        />
      </div>

      <label className="mt-4 block">
        <span className="label">Shares</span>
        <div className="mt-1 flex gap-2">
          <input className="input num" inputMode="numeric" placeholder="0" value={qtyText} onChange={e => setQtyText(e.target.value.replace(/[^\d]/g, ''))} />
          <button
            className="btn-ghost px-3 text-xs"
            onClick={() => setQtyText(String(side === 'buy' ? maxBuy : freeShares))}
            disabled={!user}
            type="button"
          >
            Max
          </button>
        </div>
        <span className="mt-1 block text-xs text-muted">
          {side === 'buy' ? <>Cash {lkrText(cash)} · up to {whole(maxBuy)} shares</> : <>You hold {whole(position?.quantity ?? 0)}{position?.reservedQuantity ? ` (${whole(position.reservedQuantity)} in orders)` : ''}</>}
        </span>
      </label>

      {type === 'limit' && (
        <label className="mt-3 block">
          <span className="label">Limit price (LKR)</span>
          <input className="input num mt-1" inputMode="decimal" value={limitText} onChange={e => setLimitText(e.target.value.replace(/[^\d.]/g, ''))} />
          <span className="mt-1 block text-xs text-muted">
            {side === 'buy' ? 'Highest price you will pay.' : 'Lowest price you will accept.'} Last close {money(quote.close)}.
          </span>
        </label>
      )}

      <dl className="mt-4 space-y-1.5 rounded-lg bg-surface-2 p-3 text-sm">
        <div className="flex justify-between">
          <dt className="text-muted">{type === 'limit' ? 'At limit' : 'Est. price'}</dt>
          <dd className="num">{money(estPrice)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Value</dt>
          <dd className="num">{money(gross)}</dd>
        </div>
        <div className="flex justify-between">
          <dt className="text-muted">Fees ({(FEE_RATE * 100).toFixed(2)}%)</dt>
          <dd className="num">{money(fee)}</dd>
        </div>
        <div className="flex justify-between border-t border-line pt-1.5 font-semibold">
          <dt>{side === 'buy' ? 'Total cost' : 'You receive'}</dt>
          <dd className="num">{money(total)}</dd>
        </div>
      </dl>

      <p className="mt-3 text-xs text-muted">{timing}</p>

      {user ? (
        <button
          className={cx('btn mt-4 w-full text-white', side === 'buy' ? 'bg-up' : 'bg-down', 'hover:opacity-90')}
          disabled={!!problem || busy || !accountReady}
          onClick={submit}
        >
          {busy ? 'Placing…' : problem ?? `${side === 'buy' ? 'Buy' : 'Sell'} ${whole(qty)} ${quote.symbol.split('.')[0]}`}
        </button>
      ) : (
        <button className="btn-primary mt-4 w-full" onClick={login}>
          Sign in to trade with LKR 100,000
        </button>
      )}
    </div>
  );
}
