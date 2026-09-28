// Technical indicators computed from daily bars.
//
// Every series function returns an array aligned 1:1 with its input, with
// `null` during the warm-up period, so results can be zipped with bar dates
// for charting.

import type { Bar } from './types.js';

export type Series = (number | null)[];

export function sma(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (period <= 0) return out;
  let sum = 0;
  for (let i = 0; i < values.length; i++) {
    sum += values[i];
    if (i >= period) sum -= values[i - period];
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/** Exponential moving average, seeded with the SMA of the first `period` values. */
export function ema(values: number[], period: number): Series {
  const out: Series = new Array(values.length).fill(null);
  if (period <= 0 || values.length < period) return out;
  const k = 2 / (period + 1);
  let prev = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = prev;
  for (let i = period; i < values.length; i++) {
    prev = values[i] * k + prev * (1 - k);
    out[i] = prev;
  }
  return out;
}

/** EMA over a series that starts with nulls. */
function emaOfSeries(series: Series, period: number): Series {
  const start = series.findIndex(v => v !== null);
  const out: Series = new Array(series.length).fill(null);
  if (start < 0) return out;
  const tail = ema(series.slice(start) as number[], period);
  tail.forEach((v, i) => (out[start + i] = v));
  return out;
}

/** Relative Strength Index with Wilder's smoothing. */
export function rsi(closes: number[], period = 14): Series {
  const out: Series = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d;
    else loss -= d;
  }
  let avgGain = gain / period;
  let avgLoss = loss / period;
  const calc = () => (avgLoss === 0 ? (avgGain === 0 ? 50 : 100) : 100 - 100 / (1 + avgGain / avgLoss));
  out[period] = calc();
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = calc();
  }
  return out;
}

export interface MacdResult {
  macd: Series;
  signal: Series;
  histogram: Series;
}

export function macd(closes: number[], fast = 12, slow = 26, signalPeriod = 9): MacdResult {
  const f = ema(closes, fast);
  const s = ema(closes, slow);
  const line: Series = closes.map((_, i) => (f[i] !== null && s[i] !== null ? f[i]! - s[i]! : null));
  const signal = emaOfSeries(line, signalPeriod);
  const histogram: Series = line.map((v, i) => (v !== null && signal[i] !== null ? v - signal[i]! : null));
  return { macd: line, signal, histogram };
}

export interface BollingerResult {
  middle: Series;
  upper: Series;
  lower: Series;
}

export function bollinger(closes: number[], period = 20, mult = 2): BollingerResult {
  const middle = sma(closes, period);
  const upper: Series = new Array(closes.length).fill(null);
  const lower: Series = new Array(closes.length).fill(null);
  for (let i = period - 1; i < closes.length; i++) {
    const m = middle[i]!;
    let variance = 0;
    for (let j = i - period + 1; j <= i; j++) variance += (closes[j] - m) ** 2;
    const sd = Math.sqrt(variance / period);
    upper[i] = m + mult * sd;
    lower[i] = m - mult * sd;
  }
  return { middle, upper, lower };
}

export interface StochasticResult {
  k: Series;
  d: Series;
}

/** Slow-ish stochastic: raw %K over `period`, %D = SMA(%K, smooth). */
export function stochastic(bars: Bar[], period = 14, smooth = 3): StochasticResult {
  const k: Series = new Array(bars.length).fill(null);
  for (let i = period - 1; i < bars.length; i++) {
    let hi = -Infinity;
    let lo = Infinity;
    for (let j = i - period + 1; j <= i; j++) {
      hi = Math.max(hi, bars[j].h);
      lo = Math.min(lo, bars[j].l);
    }
    k[i] = hi === lo ? 50 : ((bars[i].c - lo) / (hi - lo)) * 100;
  }
  const start = period - 1;
  const d: Series = new Array(bars.length).fill(null);
  if (bars.length >= start + smooth) {
    const dTail = sma(k.slice(start) as number[], smooth);
    dTail.forEach((v, i) => (d[start + i] = v));
  }
  return { k, d };
}

// ---------------------------------------------------------------------------
// Signal summary (investing.com-style tally)
// ---------------------------------------------------------------------------

export type Action = 'Buy' | 'Sell' | 'Neutral';
export type Verdict = 'Strong Buy' | 'Buy' | 'Neutral' | 'Sell' | 'Strong Sell';

export interface IndicatorReading {
  key: string;
  label: string;
  value: number | null;
  action: Action | null; // null = not enough history
  reason: string;
}

export interface TechnicalSummary {
  bars: number;
  movingAverages: IndicatorReading[];
  oscillators: IndicatorReading[];
  maVerdict: Verdict | null;
  oscVerdict: Verdict | null;
  overall: Verdict | null;
  counts: { buy: number; sell: number; neutral: number };
}

const last = (s: Series): number | null => (s.length ? s[s.length - 1] : null);

function verdict(readings: IndicatorReading[]): Verdict | null {
  const scored = readings.filter(r => r.action !== null);
  if (scored.length === 0) return null;
  const buy = scored.filter(r => r.action === 'Buy').length;
  const sell = scored.filter(r => r.action === 'Sell').length;
  const score = (buy - sell) / scored.length;
  if (score >= 0.5) return 'Strong Buy';
  if (score >= 0.1) return 'Buy';
  if (score <= -0.5) return 'Strong Sell';
  if (score <= -0.1) return 'Sell';
  return 'Neutral';
}

export const MA_PERIODS = [10, 20, 50, 100, 200] as const;

export function summarize(bars: Bar[]): TechnicalSummary {
  const closes = bars.map(b => b.c);
  const price = closes[closes.length - 1] ?? null;

  const movingAverages: IndicatorReading[] = [];
  for (const p of MA_PERIODS) {
    for (const [kind, fn] of [['SMA', sma], ['EMA', ema]] as const) {
      const v = last(fn(closes, p));
      movingAverages.push({
        key: `${kind.toLowerCase()}${p}`,
        label: `${kind} (${p})`,
        value: v,
        action: v === null || price === null ? null : price > v ? 'Buy' : price < v ? 'Sell' : 'Neutral',
        reason:
          v === null
            ? `Needs ${p} days of history`
            : price! > v
              ? 'Price is above the average'
              : price! < v
                ? 'Price is below the average'
                : 'Price is sitting on the average',
      });
    }
  }

  const oscillators: IndicatorReading[] = [];

  const r = last(rsi(closes, 14));
  oscillators.push({
    key: 'rsi14',
    label: 'RSI (14)',
    value: r,
    action: r === null ? null : r < 30 ? 'Buy' : r > 70 ? 'Sell' : 'Neutral',
    reason: r === null ? 'Needs 15 days of history' : r < 30 ? 'Oversold (below 30)' : r > 70 ? 'Overbought (above 70)' : 'Between 30 and 70',
  });

  const m = macd(closes);
  const ml = last(m.macd);
  const ms = last(m.signal);
  oscillators.push({
    key: 'macd',
    label: 'MACD (12,26,9)',
    value: ml,
    action: ml === null || ms === null ? null : ml > ms ? 'Buy' : ml < ms ? 'Sell' : 'Neutral',
    reason: ml === null || ms === null ? 'Needs 34 days of history' : ml > ms ? 'MACD above its signal line' : 'MACD below its signal line',
  });

  const st = stochastic(bars);
  const sk = last(st.k);
  oscillators.push({
    key: 'stoch',
    label: 'Stochastic %K (14,3)',
    value: sk,
    action: sk === null ? null : sk < 20 ? 'Buy' : sk > 80 ? 'Sell' : 'Neutral',
    reason: sk === null ? 'Needs 14 days of history' : sk < 20 ? 'Oversold (below 20)' : sk > 80 ? 'Overbought (above 80)' : 'Between 20 and 80',
  });

  const bb = bollinger(closes);
  const up = last(bb.upper);
  const lo = last(bb.lower);
  oscillators.push({
    key: 'bb',
    label: 'Bollinger Bands (20,2)',
    value: up !== null && lo !== null && price !== null && up !== lo ? ((price - lo) / (up - lo)) * 100 : null,
    action: up === null || lo === null || price === null ? null : price < lo ? 'Buy' : price > up ? 'Sell' : 'Neutral',
    reason:
      up === null || lo === null
        ? 'Needs 20 days of history'
        : price! < lo
          ? 'Closed below the lower band'
          : price! > up
            ? 'Closed above the upper band'
            : 'Inside the bands',
  });

  const all = [...movingAverages, ...oscillators];
  const scored = all.filter(x => x.action !== null);
  return {
    bars: bars.length,
    movingAverages,
    oscillators,
    maVerdict: verdict(movingAverages),
    oscVerdict: verdict(oscillators),
    overall: verdict(all),
    counts: {
      buy: scored.filter(x => x.action === 'Buy').length,
      sell: scored.filter(x => x.action === 'Sell').length,
      neutral: scored.filter(x => x.action === 'Neutral').length,
    },
  };
}
