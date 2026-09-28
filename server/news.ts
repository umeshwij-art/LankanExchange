import { parseFeed, type NewsItem } from '../shared/rss.js';

export const NEWS_SOURCES = [
  { name: 'EconomyNext', url: 'https://economynext.com/feed/' },
  { name: 'Daily FT', url: 'https://www.ft.lk/rss/stock-market' },
  { name: 'Daily Mirror Business', url: 'https://www.dailymirror.lk/rss/business' },
  { name: 'Ada Derana Biz', url: 'https://www.adaderana.lk/rss.php?cid=4' },
  { name: 'Lanka Business Online', url: 'https://www.lankabusinessonline.com/feed/' },
];

export async function fetchNews(): Promise<{ items: NewsItem[]; failed: string[] }> {
  const failed: string[] = [];
  const results = await Promise.all(
    NEWS_SOURCES.map(async src => {
      try {
        const res = await fetch(src.url, {
          headers: { 'User-Agent': 'ColomboExchangeSimulator/1.0 (+news reader)' },
          signal: AbortSignal.timeout(8000),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return parseFeed(await res.text(), src.name);
      } catch (e) {
        failed.push(src.name);
        console.warn(`[news] ${src.name}:`, e instanceof Error ? e.message : e);
        return [];
      }
    }),
  );
  const seen = new Set<string>();
  const items = results
    .flat()
    .filter(i => (seen.has(i.link) ? false : (seen.add(i.link), true)))
    .sort((a, b) => (a.published < b.published ? 1 : -1))
    .slice(0, 80);
  return { items, failed };
}
