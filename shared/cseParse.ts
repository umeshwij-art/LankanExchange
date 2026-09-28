// Parsing for cse.lk's JSON endpoints. Pure so it can be unit-tested
// against captured payloads.
//
// cse.lk has no documented public API; these are the endpoints its own
// website calls. Field names have drifted over time, so every field is
// read through a list of known aliases.

import type { Bar, MarketSnapshot, Quote } from './types.js';

type Raw = Record<string, unknown>;

function num(raw: Raw, ...keys: string[]): number {
  for (const k of keys) {
    const v = raw[k];
    if (v === null || v === undefined || v === '') continue;
    const n = typeof v === 'number' ? v : parseFloat(String(v).replace(/,/g, ''));
    if (Number.isFinite(n)) return n;
  }
  return 0;
}

function str(raw: Raw, ...keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return '';
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/** Extracts the row array from a tradeSummary / todaySharePrice response. */
export function extractRows(payload: unknown): Raw[] {
  if (Array.isArray(payload)) return payload as Raw[];
  const p = (payload ?? {}) as Raw;
  for (const key of ['reqTradeSummery', 'reqTradeSummary', 'tradeSummary', 'reqTodaySharePrice', 'data']) {
    if (Array.isArray(p[key])) return p[key] as Raw[];
  }
  return [];
}

export function normalizeQuote(raw: Raw): Quote | null {
  const symbol = str(raw, 'symbol', 'ticker', 'stockCode').toUpperCase();
  if (!symbol) return null;

  const last = num(raw, 'closingPrice', 'price', 'lastTradedPrice', 'lastPrice', 'tradePrice');
  const change = num(raw, 'change', 'netChange');
  let previousClose = num(raw, 'previousClose', 'prevClose', 'previousClosingPrice');
  if (!previousClose && last) previousClose = r2(last - change);
  const close = last || previousClose;
  if (!(close > 0)) return null;

  const high = num(raw, 'high', 'highPrice', 'maxPrice') || close;
  const low = num(raw, 'low', 'lowPrice', 'minPrice') || close;
  const open = num(raw, 'open', 'openPrice', 'openingPrice');
  const pct = num(raw, 'percentageChange', 'percentChange', 'pChange', 'changePercentage');

  return {
    symbol,
    name: str(raw, 'name', 'companyName', 'stockName', 'securityName') || symbol,
    close: r2(close),
    previousClose: r2(previousClose),
    open: r2(open),
    high: r2(Math.max(high, close)),
    low: r2(Math.min(low, close)),
    change: r2(change || close - previousClose),
    changePct: r2(pct || (previousClose ? ((close - previousClose) / previousClose) * 100 : 0)),
    volume: Math.round(num(raw, 'sharevolume', 'shareVolume', 'volume', 'qty', 'quantity')),
    turnover: r2(num(raw, 'turnover', 'turnOver')),
    trades: Math.round(num(raw, 'tradevolume', 'tradeVolume', 'trades', 'noOfTrades')),
  };
}

export function normalizeQuotes(payload: unknown): Quote[] {
  const seen = new Set<string>();
  const out: Quote[] = [];
  for (const row of extractRows(payload)) {
    const q = normalizeQuote(row);
    if (q && !seen.has(q.symbol)) {
      seen.add(q.symbol);
      out.push(q);
    }
  }
  return out;
}

/** Turns an EOD quote into the daily bar we store. No trades → flat bar at close, v=0. */
export function quoteToBar(q: Quote, tradeDate: string): Bar {
  if (q.volume <= 0) return { t: tradeDate, o: q.close, h: q.close, l: q.close, c: q.close, v: 0 };
  const o = q.open > 0 ? q.open : q.previousClose || q.close;
  return {
    t: tradeDate,
    o,
    h: Math.max(q.high, o, q.close),
    l: Math.min(q.low > 0 ? q.low : q.close, o, q.close),
    c: q.close,
    v: q.volume,
  };
}

/**
 * Merges a bar into an ascending history, replacing any bar with the same
 * date (so re-running the daily job is idempotent) and trimming to `max`.
 */
export function upsertBar(history: Bar[], bar: Bar, max = 800): Bar[] {
  const out = history.filter(b => b.t !== bar.t);
  out.push(bar);
  out.sort((a, b) => (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
  return out.length > max ? out.slice(out.length - max) : out;
}

/**
 * Parses cse.lk chart data (companyChartDataByStock) into daily bars.
 * Points look like {t|d: epoch-ms, p|price, h, l, q|volume}. Multiple
 * points on one day are folded into one OHLC bar.
 */
export function chartPointsToBars(payload: unknown): Bar[] {
  const p = (payload ?? {}) as Raw;
  const points = (Array.isArray(p.chartData) ? p.chartData : Array.isArray(payload) ? payload : []) as Raw[];
  const byDay = new Map<string, Bar>();
  for (const pt of points) {
    const ts = num(pt, 't', 'd', 'time', 'tradeDate');
    const price = num(pt, 'p', 'price', 'c', 'close');
    if (!ts || !(price > 0)) continue;
    // Shift to Colombo time before taking the date.
    const day = new Date(ts + (5 * 60 + 30) * 60_000).toISOString().slice(0, 10);
    const hi = num(pt, 'h', 'high') || price;
    const lo = num(pt, 'l', 'low') || price;
    const vol = num(pt, 'q', 'qty', 'volume', 'v');
    const o = num(pt, 'o', 'open') || price;
    const b = byDay.get(day);
    if (!b) byDay.set(day, { t: day, o, h: Math.max(hi, price), l: Math.min(lo, price), c: price, v: vol });
    else {
      b.h = Math.max(b.h, hi, price);
      b.l = Math.min(b.l, lo, price);
      b.c = price;
      b.v += vol;
    }
  }
  return [...byDay.values()].sort((a, b) => (a.t < b.t ? -1 : 1));
}

/** True when (nearly) every traded security matches the stored snapshot exactly. */
export function isStale(quotes: Quote[], previous: MarketSnapshot): boolean {
  const traded = quotes.filter(q => q.volume > 0);
  if (traded.length === 0) return true;
  const same = traded.filter(q => {
    const p = previous.quotes[q.symbol];
    return p && p.close === q.close && p.volume === q.volume && p.turnover === q.turnover;
  }).length;
  return same / traded.length >= 0.95;
}
