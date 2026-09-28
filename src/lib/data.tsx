import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { collection, doc, getDoc, limit, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from './firebase';
import { useAuth } from './auth';
import type { Account, Bar, LeaderboardEntry, MarketSnapshot, Order, Position, Quote, Trade } from '../../shared/types';

// ---------------------------------------------------------------- market

interface MarketState {
  snapshot: MarketSnapshot | null;
  quotes: Quote[];
  loading: boolean;
  error: string | null;
}

const MarketCtx = createContext<MarketState>({ snapshot: null, quotes: [], loading: true, error: null });

export function MarketProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<MarketState>({ snapshot: null, quotes: [], loading: true, error: null });
  useEffect(
    () =>
      onSnapshot(
        doc(db, 'market', 'snapshot'),
        snap => {
          const data = snap.data() as MarketSnapshot | undefined;
          setState({
            snapshot: data ?? null,
            quotes: data ? Object.values(data.quotes).sort((a, b) => a.symbol.localeCompare(b.symbol)) : [],
            loading: false,
            error: null,
          });
        },
        err => setState(s => ({ ...s, loading: false, error: err.message })),
      ),
    [],
  );
  return <MarketCtx.Provider value={state}>{children}</MarketCtx.Provider>;
}

export const useMarket = () => useContext(MarketCtx);

// ---------------------------------------------------------------- history

const historyCache = new Map<string, Bar[]>();

export function useHistory(symbol: string | undefined, tradeDate: string | undefined) {
  const key = `${symbol}@${tradeDate}`;
  const [bars, setBars] = useState<Bar[] | null>(historyCache.get(key) ?? null);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!symbol) return;
    if (historyCache.has(key)) {
      setBars(historyCache.get(key)!);
      return;
    }
    let cancelled = false;
    setBars(null);
    getDoc(doc(db, 'history', symbol))
      .then(snap => {
        const b = (snap.get('bars') as Bar[] | undefined) ?? [];
        historyCache.set(key, b);
        if (!cancelled) setBars(b);
      })
      .catch(e => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
    };
  }, [symbol, key]);
  return { bars, error };
}

// ---------------------------------------------------------------- account

export interface PortfolioState {
  account: Account | null;
  positions: Position[];
  openOrders: Order[];
  recentOrders: Order[];
  trades: (Trade & { id: string })[];
  loading: boolean;
}

const empty: PortfolioState = { account: null, positions: [], openOrders: [], recentOrders: [], trades: [], loading: false };

export function usePortfolio(): PortfolioState {
  const { user, accountReady } = useAuth();
  const [state, setState] = useState<PortfolioState>({ ...empty, loading: true });

  useEffect(() => {
    if (!user) {
      setState(empty);
      return;
    }
    if (!accountReady) return;
    const uid = user.uid;
    const base = `users/${uid}`;
    const unsubs = [
      onSnapshot(doc(db, base), s => setState(p => ({ ...p, account: (s.data() as Account) ?? null, loading: false }))),
      onSnapshot(collection(db, `${base}/positions`), s =>
        setState(p => ({ ...p, positions: s.docs.map(d => d.data() as Position).sort((a, b) => a.symbol.localeCompare(b.symbol)) })),
      ),
      onSnapshot(query(collection(db, `${base}/orders`), where('status', '==', 'open')), s =>
        setState(p => ({
          ...p,
          openOrders: s.docs.map(d => ({ ...(d.data() as Order), id: d.id })).sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
        })),
      ),
      onSnapshot(query(collection(db, `${base}/orders`), orderBy('createdAt', 'desc'), limit(30)), s =>
        setState(p => ({ ...p, recentOrders: s.docs.map(d => ({ ...(d.data() as Order), id: d.id })) })),
      ),
      onSnapshot(query(collection(db, `${base}/trades`), orderBy('createdAt', 'desc'), limit(100)), s =>
        setState(p => ({ ...p, trades: s.docs.map(d => ({ ...(d.data() as Trade), id: d.id })) })),
      ),
    ];
    return () => unsubs.forEach(u => u());
  }, [user, accountReady]);

  return state;
}

// ---------------------------------------------------------------- leaderboard

export function useLeaderboard(n = 50) {
  const [rows, setRows] = useState<LeaderboardEntry[] | null>(null);
  useEffect(
    () =>
      onSnapshot(query(collection(db, 'leaderboard'), orderBy('returnPct', 'desc'), limit(n)), s =>
        setRows(s.docs.map(d => d.data() as LeaderboardEntry)),
      ),
    [n],
  );
  return rows;
}
