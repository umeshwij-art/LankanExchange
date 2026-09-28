// The daily job: pull the day's closing prices from cse.lk, store them,
// settle resting orders against the new bars, and rebuild the leaderboard.
// Safe to run more than once for the same day.

import { FieldValue } from 'firebase-admin/firestore';
import { db } from './firebaseAdmin.js';
import { fetchTradeSummary } from './cse.js';
import { refs, writeAccount, writePosition, SCHEMA_VERSION } from './accounts.js';
import { isStale, quoteToBar, upsertBar } from '../shared/cseParse.js';
import { colomboClock, isWeekday, MARKET_CLOSE_MIN } from '../shared/calendar.js';
import { round2 } from '../shared/fees.js';
import { resolveOrder } from '../shared/trading.js';
import type { Bar, MarketSnapshot, Order, Quote } from '../shared/types.js';

export interface EodOptions {
  /** Ignore the weekend / market-hours / already-done guards */
  force?: boolean;
  now?: Date;
}

export interface EodResult {
  status: 'done' | 'skipped';
  reason?: string;
  tradeDate?: string;
  securities?: number;
  orders?: { filled: number; expired: number; rejected: number; waiting: number };
  leaderboard?: number;
}

async function writeHistory(tradeDate: string, bars: Map<string, Bar>) {
  const symbols = [...bars.keys()];
  const writer = db().bulkWriter();
  for (let i = 0; i < symbols.length; i += 100) {
    const slice = symbols.slice(i, i + 100);
    const snaps = await db().getAll(...slice.map(s => refs.history(s)));
    snaps.forEach((snap, j) => {
      const symbol = slice[j];
      const existing = (snap.get('bars') as Bar[] | undefined) ?? [];
      writer.set(refs.history(symbol), { symbol, bars: upsertBar(existing, bars.get(symbol)!), updatedAt: tradeDate });
    });
  }
  await writer.close();
}

async function settleOrders(tradeDate: string, bars: Map<string, Bar>) {
  const tally = { filled: 0, expired: 0, rejected: 0, waiting: 0 };
  const users = await db().collection('users').where('openOrderCount', '>', 0).get();

  for (const user of users.docs) {
    const open = await refs.orders(user.id).where('status', '==', 'open').get();
    for (const o of open.docs) {
      // One transaction per order keeps each settlement atomic and small.
      const outcome = await db().runTransaction(async tx => {
        const orderSnap = await tx.get(o.ref);
        const order = orderSnap.data() as Order | undefined;
        if (!order || order.status !== 'open') return 'gone';
        const userSnap = await tx.get(refs.user(user.id));
        const posRef = refs.position(user.id, order.symbol);
        const posSnap = await tx.get(posRef);

        const res = resolveOrder(
          order,
          bars.get(order.symbol) ?? null,
          tradeDate,
          { cash: userSnap.get('cash'), reservedCash: userSnap.get('reservedCash'), realizedPL: userSnap.get('realizedPL') },
          posSnap.exists
            ? { quantity: posSnap.get('quantity'), reservedQuantity: posSnap.get('reservedQuantity') ?? 0, avgCost: posSnap.get('avgCost') }
            : null,
        );
        if (res.kind === 'skip') return 'waiting';

        const closedAt = new Date().toISOString();
        writeAccount(tx, user.id, res.account, { openOrderCount: FieldValue.increment(-1) });
        writePosition(tx, posRef, order.symbol, res.position);
        if (res.kind === 'fill') {
          tx.create(refs.trades(user.id).doc(), { ...res.trade, createdAt: closedAt });
          tx.update(o.ref, { status: 'filled', fillPrice: res.price, fillDate: tradeDate, closedAt });
          return 'filled';
        }
        tx.update(o.ref, { status: res.status, closedAt, note: res.note });
        return res.status;
      });
      if (outcome in tally) tally[outcome as keyof typeof tally]++;
    }
  }
  return tally;
}

async function rebuildLeaderboard(quotes: Record<string, Quote>) {
  const users = await db().collection('users').where('schemaVersion', '==', SCHEMA_VERSION).get();

  // Per-user reads avoid needing a collection-group index.
  const holdings = new Map<string, { value: number; count: number }>();
  for (let i = 0; i < users.docs.length; i += 20) {
    const slice = users.docs.slice(i, i + 20);
    const snaps = await Promise.all(slice.map(u => u.ref.collection('positions').get()));
    snaps.forEach((ps, j) => {
      const h = { value: 0, count: 0 };
      for (const p of ps.docs) {
        const close = quotes[p.get('symbol')]?.close ?? p.get('avgCost');
        h.value += p.get('quantity') * close;
        h.count++;
      }
      holdings.set(slice[j].id, h);
    });
  }

  const writer = db().bulkWriter();
  const updatedAt = new Date().toISOString();
  for (const u of users.docs) {
    const h = holdings.get(u.id) ?? { value: 0, count: 0 };
    const equity = round2(u.get('cash') + u.get('reservedCash') + h.value);
    const start = u.get('startingCash') || 100_000;
    writer.set(refs.leaderboard(u.id), {
      uid: u.id,
      displayName: u.get('displayName') ?? 'Anonymous trader',
      photoURL: u.get('photoURL') ?? null,
      equity,
      returnPct: round2((equity / start - 1) * 100),
      positions: h.count,
      updatedAt,
    });
  }
  await writer.close();
  return users.size;
}

export async function runEndOfDay(opts: EodOptions = {}): Promise<EodResult> {
  const now = opts.now ?? new Date();
  const clock = colomboClock(now);

  if (!opts.force && !isWeekday(clock.weekday)) return { status: 'skipped', reason: 'Weekend' };
  if (!opts.force && clock.minutes < MARKET_CLOSE_MIN + 15) {
    return { status: 'skipped', reason: 'Market has not closed yet (runs after 14:45 Colombo)' };
  }

  const tradeDate = clock.date;
  const current = (await refs.snapshot().get()).data() as MarketSnapshot | undefined;
  if (!opts.force && current?.tradeDate === tradeDate) {
    return { status: 'skipped', reason: `Already ingested ${tradeDate}`, tradeDate };
  }

  const quotes = await fetchTradeSummary();
  const totalVolume = quotes.reduce((s, q) => s + q.volume, 0);
  if (!opts.force && totalVolume === 0) {
    return { status: 'skipped', reason: 'No trades reported today — likely a market holiday', tradeDate };
  }

  // On holidays cse.lk keeps serving the previous session's numbers.
  if (!opts.force && current && isStale(quotes, current)) {
    return { status: 'skipped', reason: `Prices unchanged since ${current.tradeDate} — likely a market holiday`, tradeDate };
  }

  const quoteMap: Record<string, Quote> = {};
  const bars = new Map<string, Bar>();
  for (const q of quotes) {
    quoteMap[q.symbol] = q;
    bars.set(q.symbol, quoteToBar(q, tradeDate));
  }

  // History first, then the snapshot: the snapshot's tradeDate is what
  // the app (and the guard above) treat as "today is done".
  await writeHistory(tradeDate, bars);
  const orders = await settleOrders(tradeDate, bars);

  const snapshot: MarketSnapshot = { tradeDate, updatedAt: now.toISOString(), count: quotes.length, quotes: quoteMap };
  await refs.snapshot().set(snapshot);

  const leaderboard = await rebuildLeaderboard(quoteMap);
  const result: EodResult = { status: 'done', tradeDate, securities: quotes.length, orders, leaderboard };
  await db().doc('market/lastRun').set({ ...result, ranAt: now.toISOString() });
  return result;
}

/** Writes a batch of historical bars (used by the backfill script). */
export async function mergeHistory(symbol: string, bars: Bar[]) {
  const ref = refs.history(symbol);
  const snap = await ref.get();
  let merged = (snap.get('bars') as Bar[] | undefined) ?? [];
  for (const b of bars) merged = upsertBar(merged, b);
  await ref.set({ symbol, bars: merged, updatedAt: merged[merged.length - 1]?.t ?? null });
  return merged.length;
}
