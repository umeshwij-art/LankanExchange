// npm run backfill [-- JKH.N0000 COMB.N0000 …]
//
// Seeds history/{symbol} with past daily bars from cse.lk's chart endpoint
// so indicators work from day one instead of after 200 trading days.
// With no arguments it backfills every symbol in market/snapshot, so run
// `npm run eod -- --force` once first. Polite: one symbol at a time.
import { config } from 'dotenv';
import { db } from '../server/firebaseAdmin.js';
import { fetchHistory } from '../server/cse.js';
import { mergeHistory } from '../server/eod.js';

config({ path: '.env.local' });
config();

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function main() {
  let symbols = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (symbols.length === 0) {
    const snap = await db().doc('market/snapshot').get();
    symbols = Object.keys(snap.get('quotes') ?? {}).sort();
    if (symbols.length === 0) throw new Error('market/snapshot is empty — run `npm run eod -- --force` first');
  }

  let ok = 0;
  const failed: string[] = [];
  for (const [i, symbol] of symbols.entries()) {
    try {
      const bars = await fetchHistory(symbol);
      if (bars.length === 0) throw new Error('no chart data');
      const total = await mergeHistory(symbol, bars);
      ok++;
      console.log(`[${i + 1}/${symbols.length}] ${symbol}: +${bars.length} bars (${bars[0].t} → ${bars[bars.length - 1].t}), ${total} stored`);
    } catch (e) {
      failed.push(symbol);
      console.warn(`[${i + 1}/${symbols.length}] ${symbol}: skipped — ${e instanceof Error ? e.message : e}`);
    }
    await sleep(700);
  }
  console.log(`\nDone: ${ok} backfilled, ${failed.length} skipped${failed.length ? `: ${failed.join(', ')}` : ''}`);
}

main().then(() => process.exit(0), e => (console.error(e), process.exit(1)));
