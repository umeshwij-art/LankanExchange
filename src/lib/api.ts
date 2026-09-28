import { auth } from './firebase';
import type { PlaceOrderRequest } from '../../shared/types';
import type { NewsItem } from '../../shared/rss';

async function authed(path: string, init: RequestInit = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error('Sign in to trade');
  const token = await user.getIdToken();
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...(init.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? `Request failed (${res.status})`);
  return body;
}

export type OrderResult =
  | { status: 'filled'; price: number; quantity: number; tradeDate: string }
  | { status: 'queued'; orderId: string; eligibleFrom: string; expiresOn: string | null };

export const placeOrder = (req: PlaceOrderRequest): Promise<OrderResult> =>
  authed('/api/orders', { method: 'POST', body: JSON.stringify(req) });

export const cancelOrder = (id: string): Promise<{ status: 'cancelled' }> =>
  authed(`/api/orders?id=${encodeURIComponent(id)}`, { method: 'DELETE' });

export interface Announcement {
  id: string;
  symbol: string;
  company: string;
  title: string;
  category: string;
  date: string;
  url: string | null;
}

export interface NewsPayload {
  news: NewsItem[];
  announcements: Announcement[];
  failedSources: string[];
  fetchedAt: string;
}

export async function fetchNews(): Promise<NewsPayload> {
  const res = await fetch('/api/news');
  if (!res.ok) throw new Error('News is unavailable right now');
  return res.json();
}
