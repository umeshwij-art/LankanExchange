import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bollinger, ema, macd, rsi, sma, stochastic, summarize } from '../shared/indicators.js';
import type { Bar } from '../shared/types.js';

const close = (xs: number[]) => xs.map((c, i) => ({ t: `2026-01-${String(i + 1).padStart(2, '0')}`, o: c, h: c + 1, l: c - 1, c, v: 100 }));

test('sma aligns with input and warms up with nulls', () => {
  assert.deepEqual(sma([1, 2, 3, 4, 5], 3), [null, null, 2, 3, 4]);
});

test('ema is seeded by the sma and then smooths', () => {
  const e = ema([1, 2, 3, 4, 5], 3);
  assert.deepEqual(e.slice(0, 2), [null, null]);
  assert.equal(e[2], 2);
  assert.equal(e[3], 3); // 4*0.5 + 2*0.5
  assert.equal(e[4], 4);
});

test('rsi matches the classic Wilder worked example', () => {
  // Closes from the StockCharts RSI worked example. They round the averages
  // (0.2385 / 0.0995 → 70.53); unrounded Wilder gives 3.34/14 ÷ 1.40/14.
  const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.0];
  const r = rsi(closes, 14);
  assert.equal(r[13], null);
  assert.ok(Math.abs(r[14]! - (100 - 100 / (1 + 3.34 / 1.4))) < 1e-9, `got ${r[14]}`);
  assert.ok(Math.abs(r[15]! - 66.32) < 0.3, `got ${r[15]}`);
});

test('rsi is 100 on a straight rise and 0 on a straight fall', () => {
  const up = Array.from({ length: 20 }, (_, i) => 10 + i);
  assert.equal(rsi(up)[19], 100);
  const down = up.slice().reverse();
  assert.equal(rsi(down)[19], 0);
});

test('macd line, signal and histogram line up', () => {
  const xs = Array.from({ length: 60 }, (_, i) => 100 + Math.sin(i / 4) * 5 + i * 0.2);
  const m = macd(xs);
  assert.equal(m.macd[24], null);
  assert.notEqual(m.macd[25], null);
  assert.equal(m.signal[32], null);
  assert.notEqual(m.signal[33], null);
  const i = 50;
  assert.ok(Math.abs(m.histogram[i]! - (m.macd[i]! - m.signal[i]!)) < 1e-9);
});

test('bollinger bands are symmetric around the sma', () => {
  const xs = Array.from({ length: 30 }, (_, i) => 50 + (i % 5));
  const b = bollinger(xs, 20, 2);
  const i = 29;
  assert.ok(Math.abs(b.upper[i]! - b.middle[i]! - (b.middle[i]! - b.lower[i]!)) < 1e-9);
  assert.ok(b.upper[i]! > b.middle[i]!);
});

test('stochastic is 100 at the top of the range', () => {
  const bars: Bar[] = close(Array.from({ length: 20 }, (_, i) => 10 + i)).map(b => ({ ...b, h: b.c, l: b.c - 0.5 }));
  const s = stochastic(bars);
  assert.equal(s.k[19], 100);
  assert.notEqual(s.d[19], null);
});

test('summary is bullish for a steady uptrend and flags missing history', () => {
  const bars = close(Array.from({ length: 60 }, (_, i) => 100 + i));
  const s = summarize(bars);
  assert.equal(s.maVerdict, 'Strong Buy');
  const sma200 = s.movingAverages.find(m => m.key === 'sma200')!;
  assert.equal(sma200.action, null);
  assert.match(sma200.reason, /200 days/);
  assert.equal(s.oscillators.find(o => o.key === 'rsi14')!.action, 'Sell'); // overbought
});

test('summary copes with no history', () => {
  const s = summarize([]);
  assert.equal(s.overall, null);
  assert.equal(s.counts.buy, 0);
});
