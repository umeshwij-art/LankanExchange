// Shared domain types used by both the browser app and the serverless API.
// Keep this file dependency-free.

/** One daily OHLCV bar. `t` is the Colombo trading date, YYYY-MM-DD. */
export interface Bar {
  t: string;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

/** Latest end-of-day quote for one security. */
export interface Quote {
  symbol: string;
  name: string;
  /** Official close for `tradeDate` */
  close: number;
  previousClose: number;
  open: number;
  high: number;
  low: number;
  change: number;
  changePct: number;
  /** Shares traded */
  volume: number;
  /** LKR turnover */
  turnover: number;
  trades: number;
}

/** market/snapshot document — every quote in one read. */
export interface MarketSnapshot {
  tradeDate: string;
  updatedAt: string;
  count: number;
  quotes: Record<string, Quote>;
}

export type Side = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'open' | 'filled' | 'cancelled' | 'expired' | 'rejected';

/** users/{uid} */
export interface Account {
  uid: string;
  displayName: string;
  photoURL: string | null;
  startingCash: number;
  /** Spendable cash */
  cash: number;
  /** Cash held against open buy orders */
  reservedCash: number;
  realizedPL: number;
  createdAt: string;
  schemaVersion: number;
}

/** users/{uid}/positions/{symbol} */
export interface Position {
  symbol: string;
  quantity: number;
  /** Shares held against open sell orders */
  reservedQuantity: number;
  /** Average cost per share, fees included */
  avgCost: number;
  updatedAt: string;
}

/** users/{uid}/orders/{id} */
export interface Order {
  id: string;
  symbol: string;
  side: Side;
  type: OrderType;
  quantity: number;
  /** Required for limit orders */
  limitPrice: number | null;
  /** Cash set aside for a buy (price estimate + fees) */
  reservedCash: number;
  status: OrderStatus;
  createdAt: string;
  /** First trading date whose bar may fill this order (prevents look-ahead) */
  eligibleFrom: string;
  /** Last trading date the order can fill on (limit orders) */
  expiresOn: string | null;
  /** When the order was filled, cancelled, expired or rejected */
  closedAt?: string;
  fillPrice?: number;
  fillDate?: string;
  note?: string;
}

/** users/{uid}/trades/{id} — executed fills */
export interface Trade {
  symbol: string;
  side: Side;
  orderType: OrderType;
  quantity: number;
  price: number;
  fees: number;
  /** Cash out for buys, cash in for sells */
  netAmount: number;
  realizedPL: number | null;
  tradeDate: string;
  createdAt: string;
}

/** leaderboard/{uid} */
export interface LeaderboardEntry {
  uid: string;
  displayName: string;
  photoURL: string | null;
  equity: number;
  returnPct: number;
  positions: number;
  updatedAt: string;
}

export interface PlaceOrderRequest {
  symbol: string;
  side: Side;
  type: OrderType;
  quantity: number;
  limitPrice?: number;
}
