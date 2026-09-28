// Account and order operations. Every balance change happens here, inside a
// Firestore transaction, using prices from our own end-of-day snapshot — the
// browser never supplies a price or writes a balance.

import { FieldValue, type DocumentReference, type Transaction } from 'firebase-admin/firestore';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { db } from './firebaseAdmin.js';
import { STARTING_CASH, round2 } from '../shared/fees.js';
import { OrderError, planOrder, type AccountState, type PositionState } from '../shared/trading.js';
import type { Account, MarketSnapshot, Order, PlaceOrderRequest, Position } from '../shared/types.js';

export const SCHEMA_VERSION = 2;

export const refs = {
  snapshot: () => db().doc('market/snapshot'),
  user: (uid: string) => db().doc(`users/${uid}`),
  position: (uid: string, symbol: string) => db().doc(`users/${uid}/positions/${symbol}`),
  orders: (uid: string) => db().collection(`users/${uid}/orders`),
  trades: (uid: string) => db().collection(`users/${uid}/trades`),
  history: (symbol: string) => db().doc(`history/${symbol}`),
  leaderboard: (uid: string) => db().doc(`leaderboard/${uid}`),
};

/** "Umesh Wijesinghe" → "Umesh W." so the public leaderboard doesn't expose full names. */
export function publicName(name: string | undefined | null): string {
  const parts = (name ?? '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'Anonymous trader';
  return parts.length === 1 ? parts[0] : `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function freshAccount(user: DecodedIdToken): Account & { openOrderCount: number } {
  return {
    uid: user.uid,
    displayName: publicName(user.name),
    photoURL: user.picture ?? null,
    startingCash: STARTING_CASH,
    cash: STARTING_CASH,
    reservedCash: 0,
    realizedPL: 0,
    openOrderCount: 0,
    createdAt: new Date().toISOString(),
    schemaVersion: SCHEMA_VERSION,
  };
}

/**
 * Creates the account on first sign-in. Accounts from the old app
 * (no schemaVersion) are reset to a fresh LKR 100,000.
 */
export async function ensureAccount(user: DecodedIdToken): Promise<{ created: boolean }> {
  const ref = refs.user(user.uid);
  return db().runTransaction(async tx => {
    const snap = await tx.get(ref);
    if (snap.exists && snap.get('schemaVersion') === SCHEMA_VERSION) return { created: false };
    tx.set(ref, freshAccount(user));
    return { created: true };
  });
}

async function readState(tx: Transaction, uid: string, symbol: string) {
  const [userSnap, posSnap, marketSnap] = await Promise.all([
    tx.get(refs.user(uid)),
    tx.get(refs.position(uid, symbol)),
    tx.get(refs.snapshot()),
  ]);
  if (!userSnap.exists || userSnap.get('schemaVersion') !== SCHEMA_VERSION) {
    throw new OrderError('Your account is still being set up — refresh and try again', 409);
  }
  const market = marketSnap.data() as MarketSnapshot | undefined;
  if (!market) throw new OrderError('Market prices have not been loaded yet', 503);
  const account: AccountState = {
    cash: userSnap.get('cash'),
    reservedCash: userSnap.get('reservedCash'),
    realizedPL: userSnap.get('realizedPL'),
  };
  const position: PositionState | null = posSnap.exists
    ? { quantity: posSnap.get('quantity'), reservedQuantity: posSnap.get('reservedQuantity') ?? 0, avgCost: posSnap.get('avgCost') }
    : null;
  return { account, position, market };
}

export function writePosition(tx: Transaction, ref: DocumentReference, symbol: string, p: PositionState | null) {
  if (!p || p.quantity <= 0) {
    tx.delete(ref);
    return;
  }
  const doc: Position = { symbol, quantity: p.quantity, reservedQuantity: p.reservedQuantity, avgCost: p.avgCost, updatedAt: new Date().toISOString() };
  tx.set(ref, doc);
}

export function writeAccount(tx: Transaction, uid: string, a: AccountState, extra: Record<string, unknown> = {}) {
  tx.update(refs.user(uid), { cash: round2(a.cash), reservedCash: round2(a.reservedCash), realizedPL: round2(a.realizedPL), ...extra });
}

export async function placeOrder(uid: string, req: PlaceOrderRequest, now = new Date()) {
  return db().runTransaction(async tx => {
    const { account, position, market } = await readState(tx, uid, req.symbol);
    const quote = market.quotes[req.symbol];
    if (!quote) throw new OrderError(`${req.symbol} isn't in today's price list`);

    const plan = planOrder(req, { account, position, quote, lastTradeDate: market.tradeDate, now });
    const createdAt = now.toISOString();
    writePosition(tx, refs.position(uid, req.symbol), req.symbol, plan.position);

    if (plan.kind === 'fill') {
      writeAccount(tx, uid, plan.account);
      tx.create(refs.trades(uid).doc(), { ...plan.trade, createdAt });
      return { status: 'filled' as const, price: plan.trade.price, quantity: plan.trade.quantity, tradeDate: plan.trade.tradeDate };
    }

    writeAccount(tx, uid, plan.account, { openOrderCount: FieldValue.increment(1) });
    const orderRef = refs.orders(uid).doc();
    tx.create(orderRef, { ...plan.order, id: orderRef.id, createdAt });
    return { status: 'queued' as const, orderId: orderRef.id, eligibleFrom: plan.order.eligibleFrom, expiresOn: plan.order.expiresOn };
  });
}

export async function cancelOrder(uid: string, orderId: string) {
  if (!/^[A-Za-z0-9]{10,40}$/.test(orderId)) throw new OrderError('Invalid order id');
  return db().runTransaction(async tx => {
    const orderRef = refs.orders(uid).doc(orderId);
    const orderSnap = await tx.get(orderRef);
    if (!orderSnap.exists) throw new OrderError('Order not found', 404);
    const order = orderSnap.data() as Order;
    if (order.status !== 'open') throw new OrderError(`This order is already ${order.status}`);

    const userSnap = await tx.get(refs.user(uid));
    const posRef = refs.position(uid, order.symbol);
    const posSnap = order.side === 'sell' ? await tx.get(posRef) : null;

    if (order.side === 'buy') {
      tx.update(refs.user(uid), {
        cash: round2(userSnap.get('cash') + order.reservedCash),
        reservedCash: round2(Math.max(0, userSnap.get('reservedCash') - order.reservedCash)),
        openOrderCount: FieldValue.increment(-1),
      });
    } else {
      tx.update(refs.user(uid), { openOrderCount: FieldValue.increment(-1) });
      if (posSnap?.exists) {
        tx.update(posRef, { reservedQuantity: Math.max(0, (posSnap.get('reservedQuantity') ?? 0) - order.quantity) });
      }
    }
    tx.update(orderRef, { status: 'cancelled', closedAt: new Date().toISOString(), note: 'Cancelled by you' });
    return { status: 'cancelled' as const };
  });
}
