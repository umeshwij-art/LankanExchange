import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buyCost, FEE_RATE, sellProceeds, STARTING_CASH } from '../shared/fees.js';
import { eligibleFromFor, fillPrice, OrderError, planOrder, resolveOrder, validateRequest } from '../shared/trading.js';
import { addTradingDays, colomboClock, isAwaitingClose, sessionState } from '../shared/calendar.js';
import type { Quote } from '../shared/types.js';

const quote: Quote = {
  symbol: 'JKH.N0000', name: 'JOHN KEELLS', close: 20, previousClose: 19.5, open: 19.6, high: 20.2, low: 19.4,
  change: 0.5, changePct: 2.56, volume: 1_000_000, turnover: 20_000_000, trades: 900,
};
const fresh = { cash: STARTING_CASH, reservedCash: 0, realizedPL: 0 };

// Colombo = UTC+5:30. 2026-09-26 is a Saturday; 2026-09-28 a Monday.
const SAT_NOON = new Date('2026-09-26T06:30:00Z');
const MON_0900 = new Date('2026-09-28T03:30:00Z'); // 09:00 Colombo
const MON_1100 = new Date('2026-09-28T05:30:00Z'); // 11:00 Colombo
const MON_1600 = new Date('2026-09-28T10:30:00Z'); // 16:00 Colombo

test('calendar: colombo clock and trading days', () => {
  assert.deepEqual(colomboClock(MON_1100), { date: '2026-09-28', minutes: 660, weekday: 1 });
  assert.equal(addTradingDays('2026-09-25', 1), '2026-09-28'); // Fri → Mon
  assert.equal(addTradingDays('2026-09-28', 5), '2026-10-05');
});

test('calendar: awaiting-close window', () => {
  assert.equal(isAwaitingClose('2026-09-25', SAT_NOON), false);
  assert.equal(isAwaitingClose('2026-09-25', MON_0900), false);
  assert.equal(isAwaitingClose('2026-09-25', MON_1100), true);
  assert.equal(isAwaitingClose('2026-09-25', MON_1600), true); // prices not in yet
  assert.equal(isAwaitingClose('2026-09-28', MON_1600), false); // today's close ingested
  assert.equal(sessionState('2026-09-25', MON_1100), 'open');
  assert.equal(sessionState('2026-09-28', MON_1600), 'closed');
});

test('fees: round trip costs about 2.27%', () => {
  assert.equal(buyCost(100, 20), 2022.4);
  assert.equal(sellProceeds(100, 20), 1977.6);
  assert.equal(FEE_RATE, 0.0112);
});

test('validateRequest rejects junk', () => {
  assert.throws(() => validateRequest({ symbol: 'JKH', side: 'buy', type: 'market', quantity: 1 }), OrderError);
  assert.throws(() => validateRequest({ symbol: 'JKH.N0000', side: 'buy', type: 'market', quantity: 1.5 }), /whole number/);
  assert.throws(() => validateRequest({ symbol: 'JKH.N0000', side: 'buy', type: 'limit', quantity: 1 }), /Limit price/);
  assert.deepEqual(validateRequest({ symbol: ' jkh.n0000 ', side: 'sell', type: 'limit', quantity: '10', limitPrice: '21.456' }), {
    symbol: 'JKH.N0000', side: 'sell', type: 'limit', quantity: 10, limitPrice: 21.46,
  });
});

test('market buy outside the session fills at the last close', () => {
  const plan = planOrder({ symbol: 'JKH.N0000', side: 'buy', type: 'market', quantity: 100 },
    { account: fresh, position: null, quote, lastTradeDate: '2026-09-25', now: SAT_NOON });
  assert.equal(plan.kind, 'fill');
  if (plan.kind !== 'fill') return;
  assert.equal(plan.trade.price, 20);
  assert.equal(plan.account.cash, 100_000 - 2022.4);
  assert.equal(plan.position!.quantity, 100);
  assert.equal(plan.position!.avgCost, 20.224); // fees baked into cost basis
});

test('cannot overspend', () => {
  assert.throws(
    () => planOrder({ symbol: 'JKH.N0000', side: 'buy', type: 'market', quantity: 5000 },
      { account: fresh, position: null, quote, lastTradeDate: '2026-09-25', now: SAT_NOON }),
    /Not enough cash/,
  );
});

test('cannot sell what you do not hold, or shares reserved for orders', () => {
  const ctx = { account: fresh, quote, lastTradeDate: '2026-09-25', now: SAT_NOON };
  assert.throws(() => planOrder({ symbol: 'JKH.N0000', side: 'sell', type: 'market', quantity: 1 }, { ...ctx, position: null }), /don't have/);
  assert.throws(
    () => planOrder({ symbol: 'JKH.N0000', side: 'sell', type: 'market', quantity: 60 },
      { ...ctx, position: { quantity: 100, reservedQuantity: 50, avgCost: 18 } }),
    /at most 50/,
  );
});

test('market sell books realized P&L net of fees', () => {
  const plan = planOrder({ symbol: 'JKH.N0000', side: 'sell', type: 'market', quantity: 100 },
    { account: fresh, position: { quantity: 100, reservedQuantity: 0, avgCost: 18 }, quote, lastTradeDate: '2026-09-25', now: SAT_NOON });
  assert.equal(plan.kind, 'fill');
  if (plan.kind !== 'fill') return;
  assert.equal(plan.trade.realizedPL, 177.6);
  assert.equal(plan.position, null);
});

test('market order during the session waits for today\'s close and reserves cash with a band', () => {
  const plan = planOrder({ symbol: 'JKH.N0000', side: 'buy', type: 'market', quantity: 100 },
    { account: fresh, position: null, quote, lastTradeDate: '2026-09-25', now: MON_1100 });
  assert.equal(plan.kind, 'queue');
  if (plan.kind !== 'queue') return;
  assert.equal(plan.order.eligibleFrom, '2026-09-28');
  assert.equal(plan.order.expiresOn, '2026-09-28');
  assert.equal(plan.order.reservedCash, buyCost(100, 22));
  assert.equal(plan.account.reservedCash, plan.order.reservedCash);

  // Today's bar closes at 21 → fills, refunds the unused reservation.
  const res = resolveOrder({ ...plan.order }, { t: '2026-09-28', o: 20, h: 21.5, l: 19.8, c: 21, v: 5000 }, '2026-09-28', plan.account, null);
  assert.equal(res.kind, 'fill');
  if (res.kind !== 'fill') return;
  assert.equal(res.price, 21);
  assert.equal(res.account.reservedCash, 0);
  assert.equal(res.account.cash, 100_000 - buyCost(100, 21));
});

test('limit orders placed mid-session are not eligible until the next day', () => {
  assert.equal(eligibleFromFor('limit', MON_0900), '2026-09-28');
  assert.equal(eligibleFromFor('limit', MON_1100), '2026-09-29');
  assert.equal(eligibleFromFor('limit', SAT_NOON), '2026-09-28');
  const order = {
    symbol: 'JKH.N0000', side: 'buy' as const, type: 'limit' as const, quantity: 10, limitPrice: 19,
    reservedCash: buyCost(10, 19), eligibleFrom: '2026-09-29', expiresOn: '2026-10-26',
  };
  const acct = { cash: 100_000 - order.reservedCash, reservedCash: order.reservedCash, realizedPL: 0 };
  const bar = { t: '2026-09-28', o: 20, h: 20, l: 18, c: 19.5, v: 100 };
  assert.equal(resolveOrder(order, bar, '2026-09-28', acct, null).kind, 'skip');
});

test('limit fills: at limit, better on a gap, never on a no-trade day', () => {
  const buy = { type: 'limit' as const, side: 'buy' as const, limitPrice: 19 };
  assert.equal(fillPrice(buy, { t: 'x', o: 20, h: 20, l: 18.9, c: 19.5, v: 10 }), 19);
  assert.equal(fillPrice(buy, { t: 'x', o: 18.5, h: 19.2, l: 18.2, c: 19, v: 10 }), 18.5);
  assert.equal(fillPrice(buy, { t: 'x', o: 20, h: 20, l: 19.1, c: 19.5, v: 10 }), null);
  assert.equal(fillPrice(buy, { t: 'x', o: 18, h: 18, l: 18, c: 18, v: 0 }), null);
  const sell = { type: 'limit' as const, side: 'sell' as const, limitPrice: 21 };
  assert.equal(fillPrice(sell, { t: 'x', o: 21.5, h: 22, l: 21, c: 21.8, v: 10 }), 21.5);
});

test('unfilled limit orders expire and release their reservation', () => {
  const order = {
    symbol: 'JKH.N0000', side: 'sell' as const, type: 'limit' as const, quantity: 10, limitPrice: 30,
    reservedCash: 0, eligibleFrom: '2026-09-28', expiresOn: '2026-09-29',
  };
  const pos = { quantity: 10, reservedQuantity: 10, avgCost: 20 };
  const bar = { t: '2026-09-29', o: 20, h: 21, l: 19, c: 20, v: 100 };
  const res = resolveOrder(order, bar, '2026-09-29', fresh, pos);
  assert.equal(res.kind, 'close');
  if (res.kind !== 'close') return;
  assert.equal(res.status, 'expired');
  assert.equal(res.position!.reservedQuantity, 0);
});
