import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chartPointsToBars, normalizeQuotes, quoteToBar, upsertBar } from '../shared/cseParse.js';
import { parseFeed } from '../shared/rss.js';

test('normalizes tradeSummary rows with drifting field names', () => {
  const qs = normalizeQuotes({
    reqTradeSummery: [
      { symbol: 'JKH.N0000', name: 'JOHN KEELLS HOLDINGS PLC', price: 20.1, change: 0.3, percentageChange: 1.52,
        high: 20.5, low: 19.7, sharevolume: 1234567, turnover: '24,800,000.50', tradevolume: 812, previousClose: 19.8, open: 19.9 },
      { ticker: 'abc.n0000', lastTradedPrice: '5.5', netChange: '-0.5', volume: 0 },
      { symbol: 'JKH.N0000', price: 99 }, // duplicate ignored
      { symbol: 'DEAD.N0000', price: 0 }, // no price → dropped
    ],
  });
  assert.equal(qs.length, 2);
  assert.equal(qs[0].turnover, 24_800_000.5);
  assert.equal(qs[0].open, 19.9);
  assert.equal(qs[1].symbol, 'ABC.N0000');
  assert.equal(qs[1].previousClose, 6);
  assert.equal(qs[1].changePct, -8.33);
});

test('bars: flat on no-trade days, idempotent upsert', () => {
  const [q] = normalizeQuotes([{ symbol: 'X.N0000', price: 10, previousClose: 10, sharevolume: 0 }]);
  assert.deepEqual(quoteToBar(q, '2026-09-28'), { t: '2026-09-28', o: 10, h: 10, l: 10, c: 10, v: 0 });
  let h = [{ t: '2026-09-25', o: 1, h: 1, l: 1, c: 1, v: 1 }];
  h = upsertBar(h, { t: '2026-09-28', o: 2, h: 2, l: 2, c: 2, v: 2 });
  h = upsertBar(h, { t: '2026-09-28', o: 3, h: 3, l: 3, c: 3, v: 3 });
  assert.equal(h.length, 2);
  assert.equal(h[1].c, 3);
  assert.equal(upsertBar(h, { t: '2026-09-29', o: 1, h: 1, l: 1, c: 1, v: 1 }, 2)[0].t, '2026-09-28');
});

test('chart points fold into daily bars in Colombo time', () => {
  const t0 = Date.parse('2026-09-24T04:00:00Z'); // 09:30 Colombo
  const bars = chartPointsToBars({
    chartData: [
      { t: t0, p: 10, h: 10.2, l: 9.9, q: 100 },
      { t: t0 + 3 * 3600e3, p: 10.5, q: 50 },
      { t: t0 + 24 * 3600e3, p: 11, q: 10 },
    ],
  });
  assert.equal(bars.length, 2);
  assert.deepEqual(bars[0], { t: '2026-09-24', o: 10, h: 10.5, l: 9.9, c: 10.5, v: 150 });
});

test('rss parser handles CDATA, entities and atom links', () => {
  const rss = `<rss><channel><item><title><![CDATA[CSE ends week &amp; ASPI up]]></title>
    <link>https://example.lk/a</link><pubDate>Fri, 26 Sep 2026 10:00:00 +0530</pubDate>
    <description>&lt;p&gt;Markets rose&lt;/p&gt;</description></item>
    <item><title>No link</title></item></channel></rss>`;
  const items = parseFeed(rss, 'Test');
  assert.equal(items.length, 1);
  assert.equal(items[0].title, 'CSE ends week & ASPI up');
  assert.equal(items[0].summary, 'Markets rose');
  assert.equal(items[0].published, '2026-09-26T04:30:00.000Z');
  const atom = `<feed><entry><title>A</title><link href="https://x.lk/1"/><updated>2026-09-26T00:00:00Z</updated></entry></feed>`;
  assert.equal(parseFeed(atom, 'Atom')[0].link, 'https://x.lk/1');
});

test('holiday detection: unchanged numbers are stale', async () => {
  const { isStale } = await import('../shared/cseParse.js');
  const q = normalizeQuotes([{ symbol: 'A.N0000', price: 10, sharevolume: 5, turnover: 50 }, { symbol: 'B.N0000', price: 3, sharevolume: 0 }]);
  const snap = { tradeDate: '2026-09-25', updatedAt: '', count: 2, quotes: Object.fromEntries(q.map(x => [x.symbol, x])) };
  assert.equal(isStale(q, snap), true);
  assert.equal(isStale([{ ...q[0], volume: 6 }, q[1]], snap), false);
});
