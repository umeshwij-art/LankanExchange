// Pure order-handling rules. No I/O — the server wraps these in Firestore
// transactions, and the tests exercise them directly.

import { buyCost, fees, LIMIT_ORDER_TRADING_DAYS, PRICE_BAND, round2, sellProceeds } from './fees.js';
import { addTradingDays, colomboClock, isAwaitingClose, isWeekday, MARKET_OPEN_MIN } from './calendar.js';
import type { Bar, Order, PlaceOrderRequest, Quote, Side, Trade } from './types.js';

export class OrderError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface AccountState {
  cash: number;
  reservedCash: number;
  realizedPL: number;
}

export interface PositionState {
  quantity: number;
  reservedQuantity: number;
  avgCost: number;
}

export const MAX_QUANTITY = 10_000_000;

/** Validates shape only; balance checks happen in planOrder. */
export function validateRequest(raw: unknown): PlaceOrderRequest {
  const r = raw as Partial<PlaceOrderRequest> | null;
  if (!r || typeof r !== 'object') throw new OrderError('Missing order body');
  const symbol = typeof r.symbol === 'string' ? r.symbol.trim().toUpperCase() : '';
  if (!/^[A-Z0-9]{1,10}\.[A-Z0-9]{4,6}$/.test(symbol)) throw new OrderError('Invalid symbol');
  if (r.side !== 'buy' && r.side !== 'sell') throw new OrderError('Side must be buy or sell');
  if (r.type !== 'market' && r.type !== 'limit') throw new OrderError('Type must be market or limit');
  const quantity = Number(r.quantity);
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
    throw new OrderError('Quantity must be a whole number of shares');
  }
  let limitPrice: number | undefined;
  if (r.type === 'limit') {
    limitPrice = Number(r.limitPrice);
    if (!Number.isFinite(limitPrice) || limitPrice <= 0) throw new OrderError('Limit price must be above zero');
    limitPrice = round2(limitPrice);
  }
  return { symbol, side: r.side, type: r.type, quantity, limitPrice };
}

export interface PlanContext {
  account: AccountState;
  position: PositionState | null;
  quote: Quote;
  /** Date of the latest ingested close */
  lastTradeDate: string;
  now: Date;
}

export type Plan =
  | {
      kind: 'fill';
      account: AccountState;
      position: PositionState | null; // null → delete
      trade: Omit<Trade, 'createdAt'>;
    }
  | {
      kind: 'queue';
      account: AccountState;
      position: PositionState | null;
      order: Omit<Order, 'id' | 'createdAt'>;
    };

/** First date whose bar may fill a resting order placed `now`. */
export function eligibleFromFor(type: 'market' | 'limit', now: Date): string {
  const c = colomboClock(now);
  if (type === 'market') return c.date; // market-on-close: today's close
  if (isWeekday(c.weekday) && c.minutes < MARKET_OPEN_MIN) return c.date;
  return addTradingDays(c.date, 1);
}

export function planOrder(req: PlaceOrderRequest, ctx: PlanContext): Plan {
  const { quote } = ctx;
  if (!(quote.close > 0)) throw new OrderError(`${req.symbol} has no closing price to trade against yet`);

  const acct = { ...ctx.account };
  const pos: PositionState | null = ctx.position ? { ...ctx.position } : null;
  const freeShares = pos ? pos.quantity - pos.reservedQuantity : 0;

  if (req.side === 'sell' && freeShares < req.quantity) {
    throw new OrderError(
      freeShares <= 0
        ? `You don't have any ${req.symbol} shares available to sell`
        : `You can sell at most ${freeShares} shares (others are held for open orders)`,
    );
  }

  const awaiting = isAwaitingClose(ctx.lastTradeDate, ctx.now);

  // Instant fill at the last official close.
  if (req.type === 'market' && !awaiting) {
    return fillNow(req.side, req.quantity, quote.close, acct, pos, ctx.lastTradeDate, req.symbol);
  }

  // Otherwise the order rests until an end-of-day bar fills it.
  const refPrice = req.type === 'limit' ? req.limitPrice! : quote.close * (1 + PRICE_BAND);
  let reservedCash = 0;
  if (req.side === 'buy') {
    reservedCash = buyCost(req.quantity, refPrice);
    if (acct.cash < reservedCash) {
      throw new OrderError(
        `Not enough cash: this order needs LKR ${reservedCash.toLocaleString('en-US')} set aside` +
          (req.type === 'market' ? ' (last close + 10% price band, plus fees)' : ' (limit price plus fees)'),
      );
    }
    acct.cash = round2(acct.cash - reservedCash);
    acct.reservedCash = round2(acct.reservedCash + reservedCash);
  } else {
    pos!.reservedQuantity += req.quantity;
  }

  const eligibleFrom = eligibleFromFor(req.type, ctx.now);
  return {
    kind: 'queue',
    account: acct,
    position: pos,
    order: {
      symbol: req.symbol,
      side: req.side,
      type: req.type,
      quantity: req.quantity,
      limitPrice: req.type === 'limit' ? req.limitPrice! : null,
      reservedCash,
      status: 'open',
      eligibleFrom,
      expiresOn: req.type === 'market' ? eligibleFrom : addTradingDays(eligibleFrom, LIMIT_ORDER_TRADING_DAYS - 1),
    },
  };
}

function fillNow(
  side: Side,
  quantity: number,
  price: number,
  acct: AccountState,
  pos: PositionState | null,
  tradeDate: string,
  symbol: string,
  orderType: 'market' | 'limit' = 'market',
): Extract<Plan, { kind: 'fill' }> {
  const fee = fees(quantity, price);
  if (side === 'buy') {
    const cost = buyCost(quantity, price);
    if (acct.cash < cost) {
      throw new OrderError(`Not enough cash: ${quantity} × LKR ${price} plus fees is LKR ${cost.toLocaleString('en-US')}`);
    }
    acct.cash = round2(acct.cash - cost);
    const held = pos?.quantity ?? 0;
    const newQty = held + quantity;
    const avgCost = (held * (pos?.avgCost ?? 0) + cost) / newQty;
    return {
      kind: 'fill',
      account: acct,
      position: { quantity: newQty, reservedQuantity: pos?.reservedQuantity ?? 0, avgCost: round4(avgCost) },
      trade: { symbol, side, orderType, quantity, price, fees: fee, netAmount: cost, realizedPL: null, tradeDate },
    };
  }
  const proceeds = sellProceeds(quantity, price);
  const realized = round2(proceeds - quantity * pos!.avgCost);
  acct.cash = round2(acct.cash + proceeds);
  acct.realizedPL = round2(acct.realizedPL + realized);
  const remaining = pos!.quantity - quantity;
  return {
    kind: 'fill',
    account: acct,
    position: remaining > 0 ? { ...pos!, quantity: remaining } : null,
    trade: { symbol, side, orderType, quantity, price, fees: fee, netAmount: proceeds, realizedPL: realized, tradeDate },
  };
}

const round4 = (n: number) => Math.round(n * 10_000) / 10_000;

/** Price an order would fill at against this bar, or null if it doesn't trade. */
export function fillPrice(order: Pick<Order, 'type' | 'side' | 'limitPrice'>, bar: Bar): number | null {
  if (!(bar.c > 0) || !(bar.v > 0)) return null; // no trades that day → nothing to match against
  if (order.type === 'market') return bar.c;
  const limit = order.limitPrice!;
  const open = bar.o > 0 ? bar.o : null;
  const low = bar.l > 0 ? bar.l : bar.c;
  const high = bar.h > 0 ? bar.h : bar.c;
  if (order.side === 'buy') {
    if (low > limit) return null;
    return open !== null && open < limit ? open : limit; // gap down → better price
  }
  if (high < limit) return null;
  return open !== null && open > limit ? open : limit; // gap up → better price
}

export type Resolution =
  | { kind: 'skip' } // not yet eligible
  | { kind: 'fill'; account: AccountState; position: PositionState | null; trade: Omit<Trade, 'createdAt'>; price: number }
  | { kind: 'close'; status: 'expired' | 'rejected'; account: AccountState; position: PositionState | null; note: string };

/**
 * Decide what happens to a resting order given the bar for `bar.t`.
 * Releases the order's reservations before settling, so the returned
 * account/position are final.
 */
export function resolveOrder(
  order: Pick<Order, 'symbol' | 'side' | 'type' | 'quantity' | 'limitPrice' | 'reservedCash' | 'eligibleFrom' | 'expiresOn'>,
  bar: Bar | null,
  tradeDate: string,
  account: AccountState,
  position: PositionState | null,
): Resolution {
  if (tradeDate < order.eligibleFrom) return { kind: 'skip' };

  // Release reservations first.
  const acct = { ...account };
  let pos: PositionState | null = position ? { ...position } : null;
  if (order.side === 'buy') {
    acct.cash = round2(acct.cash + order.reservedCash);
    acct.reservedCash = round2(Math.max(0, acct.reservedCash - order.reservedCash));
  } else if (pos) {
    pos.reservedQuantity = Math.max(0, pos.reservedQuantity - order.quantity);
  }

  const price = bar ? fillPrice(order, bar) : null;
  const expired = order.expiresOn !== null && tradeDate >= order.expiresOn;

  if (price === null) {
    if (!expired) return { kind: 'skip' };
    return {
      kind: 'close',
      status: 'expired',
      account: acct,
      position: pos,
      note: bar ? 'Limit price was not reached before expiry' : 'No trades in this security before expiry',
    };
  }

  try {
    const filled = fillNow(order.side, order.quantity, price, acct, pos, tradeDate, order.symbol, order.type);
    return { kind: 'fill', account: filled.account, position: filled.position, trade: filled.trade, price };
  } catch (e) {
    return {
      kind: 'close',
      status: 'rejected',
      account: acct,
      position: pos,
      note: e instanceof Error ? e.message : 'Could not fill',
    };
  }
}

/** Marks a position to market. */
export function positionValue(quantity: number, close: number): number {
  return round2(quantity * close);
}
