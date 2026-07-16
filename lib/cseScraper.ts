/**
 * cseScraper.ts
 *
 * Pulls live trade summary data from the Colombo Stock Exchange's
 * internal API (the same endpoint cse.lk's own site uses to render
 * its live board — no auth required, but it does check Referer/Origin).
 *
 * Drop this file into src/lib/, then in server.ts replace your
 * existing getCseData() with: import { getCseData } from './src/lib/cseScraper.ts'
 */

import axios from 'axios';

const CSE_TRADE_SUMMARY_URL = "https://www.cse.lk/api/tradeSummary";
const CSE_MARKET_STATUS_URL = "https://www.cse.lk/api/marketStatus";

const CACHE_DURATION_MS = 60 * 1000; // 1 minute — CSE data doesn't update faster than this anyway
const REQUEST_TIMEOUT_MS = 10000;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1500;

export interface CseStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  percentageChange: number;
  high?: number;
  low?: number;
  sharevolume: number;
  tradevolume?: number;
  turnover?: number;
  marketCap?: number;
  previousClose?: number;
  open?: number;
  lastTradedTime?: number | string;
  sector?: string;
  board?: string;
}

let cache: { data: CseStock[]; timestamp: number } | null = null;

// CSE's site fronts these requests with a browser-like fingerprint.
// Missing or wrong Referer/Origin is the #1 reason this returns 403/empty.
const CSE_HEADERS = {
  'Content-Type': 'application/json',
  'Referer': 'https://www.cse.lk/',
  'Origin': 'https://www.cse.lk',
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*',
};

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Normalizes CSE's raw response shape into a consistent CseStock[].
 * CSE occasionally changes field names between reqTradeSummery /
 * reqTradeSummary — this checks both plus a few common alternates.
 */
function normalizeStocks(rawStocks: any[]): CseStock[] {
  return rawStocks.map((s: any) => ({
    symbol: s.symbol || s.ticker || s.stockCode || "",
    name: s.name || s.companyName || s.stockName || "",
    price: parseFloat(s.price ?? s.lastTradedPrice ?? s.lastPrice ?? 0),
    change: parseFloat(s.change ?? s.netChange ?? 0),
    percentageChange: parseFloat(s.percentageChange ?? s.percentChange ?? s.pChange ?? 0),
    high: parseFloat(s.high ?? s.maxPrice ?? 0),
    low: parseFloat(s.low ?? s.minPrice ?? 0),
    sharevolume: parseFloat(s.sharevolume ?? s.volume ?? s.qty ?? 0),
    tradevolume: parseFloat(s.tradevolume ?? s.trades ?? 0),
    turnover: parseFloat(s.turnover ?? 0),
    marketCap: parseFloat(s.marketCap ?? s.mktCap ?? 0),
    previousClose: parseFloat(s.previousClose ?? s.prevClose ?? 0),
    open: parseFloat(s.open ?? s.openPrice ?? 0),
    lastTradedTime: s.lastTradedTime || Date.now(),
    sector: s.sector,
    board: s.board,
  }));
}

/**
 * Fetches live trade summary data with retry + exponential backoff.
 * Falls back to the last good cached response if every retry fails,
 * so a transient CSE outage doesn't blank out your whole site.
 */
export async function getCseData(forceRefresh = false): Promise<CseStock[]> {
  if (!forceRefresh && cache && Date.now() - cache.timestamp < CACHE_DURATION_MS) {
    return cache.data;
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      const response = await axios.post(
        CSE_TRADE_SUMMARY_URL,
        {},
        { headers: CSE_HEADERS, timeout: REQUEST_TIMEOUT_MS }
      );

      const result = response.data;
      const rawStocks =
        result.reqTradeSummery || result.reqTradeSummary || result.tradeSummary || [];

      if (!Array.isArray(rawStocks) || rawStocks.length === 0) {
        throw new Error("CSE API returned no trade summary rows");
      }

      const stocks = normalizeStocks(rawStocks);
      cache = { data: stocks, timestamp: Date.now() };
      return stocks;

    } catch (error) {
      lastError = error;
      const status = axios.isAxiosError(error) ? error.response?.status : undefined;
      console.error(`[cseScraper] Attempt ${attempt}/${MAX_RETRIES} failed${status ? ` (HTTP ${status})` : ''}:`,
        axios.isAxiosError(error) ? error.message : error);

      if (attempt < MAX_RETRIES) {
        await sleep(RETRY_DELAY_MS * attempt); // 1.5s, 3s, 4.5s
      }
    }
  }

  console.error("[cseScraper] All retries exhausted.", lastError);

  // Serve stale cache rather than nothing, if we have it
  if (cache) {
    console.warn("[cseScraper] Serving stale cached data as fallback.");
    return cache.data;
  }

  // Last resort — no cache, all retries failed. Throw so the caller
  // (your API route) can decide how to respond, rather than silently
  // serving fabricated placeholder prices to users.
  throw new Error("Unable to fetch live CSE data and no cache available");
}

/**
 * Checks whether the CSE market is currently open.
 * Useful for showing a "Market Closed" banner instead of stale prices.
 */
export async function getMarketStatus(): Promise<{ isOpen: boolean; raw: any }> {
  try {
    const response = await axios.post(
      CSE_MARKET_STATUS_URL,
      {},
      { headers: CSE_HEADERS, timeout: REQUEST_TIMEOUT_MS }
    );
    const raw = response.data;
    // CSE's status field name has been observed as one of these —
    // log `raw` once in your own environment to confirm the exact
    // shape currently in use, then trim this fallback chain down.
    const isOpen = Boolean(raw?.status === 'Open' || raw?.isOpen || raw?.marketStatus === 'OPEN');
    return { isOpen, raw };
  } catch (error) {
    console.error("[cseScraper] Failed to fetch market status:", error);
    return { isOpen: false, raw: null };
  }
}
