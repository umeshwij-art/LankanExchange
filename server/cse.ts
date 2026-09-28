// Network access to cse.lk. These are the JSON endpoints the cse.lk website
// itself calls; there is no official public API, so keep requests few and
// polite (one bulk call per day for prices).

import { chartPointsToBars, normalizeQuotes } from '../shared/cseParse.js';
import type { Bar, Quote } from '../shared/types.js';

const BASE = 'https://www.cse.lk/api';

const HEADERS = {
  Accept: 'application/json, text/plain, */*',
  'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
  Origin: 'https://www.cse.lk',
  Referer: 'https://www.cse.lk/',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36',
};

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

export async function csePost(path: string, form: Record<string, string> = {}, retries = 3): Promise<unknown> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${BASE}/${path}`, {
        method: 'POST',
        headers: HEADERS,
        body: new URLSearchParams(form).toString(),
        signal: AbortSignal.timeout(20_000),
      });
      if (!res.ok) throw new Error(`cse.lk ${path} → HTTP ${res.status}`);
      return await res.json();
    } catch (e) {
      lastError = e;
      console.warn(`[cse] ${path} attempt ${attempt}/${retries} failed:`, e instanceof Error ? e.message : e);
      if (attempt < retries) await sleep(1500 * attempt);
    }
  }
  throw lastError;
}

/** Every listed security's price summary for the current/latest session. */
export async function fetchTradeSummary(): Promise<Quote[]> {
  const payload = await csePost('tradeSummary');
  const quotes = normalizeQuotes(payload);
  if (quotes.length === 0) {
    const keys = payload && typeof payload === 'object' ? Object.keys(payload as object).join(', ') : typeof payload;
    throw new Error(`cse.lk tradeSummary returned no usable rows (top-level keys: ${keys})`);
  }
  return quotes;
}

/** Looks up cse.lk's internal numeric id for a symbol (needed for chart history). */
export async function fetchStockId(symbol: string): Promise<number | null> {
  const payload = (await csePost('companyInfoSummery', { symbol })) as Record<string, any>;
  const info = payload?.reqSymbolInfo ?? payload?.symbolInfo ?? payload;
  const id = Number(info?.id ?? info?.securityId ?? info?.stockId);
  return Number.isFinite(id) && id > 0 ? id : null;
}

/**
 * Best-effort daily history for a symbol. cse.lk's chart endpoint takes a
 * period code; we try the longer ones and keep whichever returns most days.
 */
export async function fetchHistory(symbol: string): Promise<Bar[]> {
  const stockId = await fetchStockId(symbol);
  if (!stockId) throw new Error(`No cse.lk id for ${symbol}`);
  let best: Bar[] = [];
  for (const period of ['5', '4', '3']) {
    try {
      const bars = chartPointsToBars(await csePost('companyChartDataByStock', { stockId: String(stockId), period }, 2));
      if (bars.length > best.length) best = bars;
      if (best.length >= 200) break;
    } catch {
      // try the next period
    }
  }
  return best;
}

export interface Announcement {
  id: string;
  symbol: string;
  company: string;
  title: string;
  category: string;
  date: string;
  url: string | null;
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const results = await Promise.allSettled([csePost('approvedAnnouncement', {}, 2), csePost('getFinancialAnnouncement', {}, 2)]);
  const rows: Record<string, any>[] = [];
  for (const r of results) {
    if (r.status !== 'fulfilled') continue;
    const p = r.value as Record<string, any>;
    for (const key of ['reqApprovedAnnouncement', 'reqFinancialAnnouncement', 'approvedAnnouncement', 'data']) {
      if (Array.isArray(p?.[key])) rows.push(...p[key]);
    }
  }
  const seen = new Set<string>();
  const out: Announcement[] = [];
  for (const a of rows) {
    const id = String(a.announcementId ?? a.id ?? `${a.symbol}-${a.dateOfAnnouncement}-${a.remarks}`);
    if (seen.has(id)) continue;
    seen.add(id);
    const file = a.fileUrl ?? a.path ?? a.filePath;
    const rawDate = a.dateOfAnnouncement ?? a.createdDate ?? a.uploadedDate ?? a.date;
    const d = rawDate ? new Date(typeof rawDate === 'number' ? rawDate : String(rawDate)) : null;
    out.push({
      id,
      symbol: String(a.symbol ?? '').toUpperCase(),
      company: String(a.company ?? a.name ?? a.companyName ?? ''),
      title: String(a.remarks ?? a.announcementCategory ?? a.fileText ?? 'Announcement'),
      category: String(a.announcementCategory ?? a.category ?? 'Announcement'),
      date: d && !isNaN(+d) ? d.toISOString() : '',
      url: file ? (String(file).startsWith('http') ? String(file) : `https://cdn.cse.lk/${String(file).replace(/^\//, '')}`) : null,
    });
  }
  return out.sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 100);
}
