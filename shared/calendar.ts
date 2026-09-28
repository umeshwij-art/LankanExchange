// Colombo market calendar helpers. Sri Lanka is UTC+05:30 with no DST,
// so a fixed offset is exact and avoids Intl/timezone-data differences
// between browsers and serverless runtimes.

const COLOMBO_OFFSET_MIN = 5 * 60 + 30;

export const MARKET_OPEN_MIN = 9 * 60 + 30; // 09:30
export const MARKET_CLOSE_MIN = 14 * 60 + 30; // 14:30

export interface ColomboClock {
  /** YYYY-MM-DD in Colombo */
  date: string;
  /** Minutes since Colombo midnight */
  minutes: number;
  /** 0 = Sunday … 6 = Saturday */
  weekday: number;
}

export function colomboClock(now: Date = new Date()): ColomboClock {
  const shifted = new Date(now.getTime() + COLOMBO_OFFSET_MIN * 60_000);
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
    weekday: shifted.getUTCDay(),
  };
}

export const isWeekday = (weekday: number) => weekday >= 1 && weekday <= 5;

function parseDate(d: string): Date {
  return new Date(`${d}T00:00:00Z`);
}

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Adds n weekdays to a YYYY-MM-DD date (public holidays are not modelled). */
export function addTradingDays(date: string, n: number): string {
  const d = parseDate(date);
  let added = 0;
  while (added < n) {
    d.setUTCDate(d.getUTCDate() + 1);
    if (isWeekday(d.getUTCDay())) added++;
  }
  return fmt(d);
}

/**
 * True while the real market is trading or has closed today but our
 * end-of-day prices haven't landed yet. Filling a market order at the
 * *previous* close during this window would let users trade on prices
 * they can already see moving on cse.lk, so such orders wait for today's
 * close instead.
 */
export function isAwaitingClose(lastTradeDate: string | null, now: Date = new Date()): boolean {
  const c = colomboClock(now);
  if (!isWeekday(c.weekday)) return false;
  if (c.minutes < MARKET_OPEN_MIN) return false;
  return lastTradeDate !== c.date;
}

export type SessionState = 'pre-open' | 'open' | 'closed-awaiting-prices' | 'closed' | 'weekend';

export function sessionState(lastTradeDate: string | null, now: Date = new Date()): SessionState {
  const c = colomboClock(now);
  if (!isWeekday(c.weekday)) return 'weekend';
  if (c.minutes < MARKET_OPEN_MIN) return 'pre-open';
  if (c.minutes <= MARKET_CLOSE_MIN) return 'open';
  return lastTradeDate === c.date ? 'closed' : 'closed-awaiting-prices';
}

/** "Fri 26 Sep 2026" */
export function formatTradeDate(date: string): string {
  const d = parseDate(date);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${days[d.getUTCDay()]} ${d.getUTCDate()} ${months[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
