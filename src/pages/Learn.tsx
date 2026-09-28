import { FEE_RATE, LIMIT_ORDER_TRADING_DAYS, roundTripBreakEven, STARTING_CASH } from '../../shared/fees';
import { GUIDE } from '../lib/guide';
import { whole } from '../lib/format';

export default function Learn() {
  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Learn</h1>
        <p className="mt-1 text-muted">How the simulator works, and how to read the indicators on every stock page.</p>
      </header>

      <section className="card space-y-3 p-5 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">How the simulator works</h2>
        <ul className="list-disc space-y-2 pl-5">
          <li>You start with <b>LKR {whole(STARTING_CASH)}</b> of practice money.</li>
          <li>
            Prices are the <b>official daily closes</b> from the Colombo Stock Exchange, loaded shortly after the market shuts
            at 2:30pm Sri Lanka time. There are no live intraday prices.
          </li>
          <li>
            <b>Market orders</b> placed while the market is closed fill immediately at the last close. Placed while it's open
            (9:30am–2:30pm, Mon–Fri), they fill at <i>that day's</i> close — otherwise you could buy at yesterday's price after
            watching today's move.
          </li>
          <li>
            <b>Limit orders</b> wait for up to {LIMIT_ORDER_TRADING_DAYS} trading days. A buy fills if the day's low reaches your
            price; a sell fills if the day's high does. If the stock opens past your price you get the better opening price.
          </li>
          <li>
            Every trade costs <b>{(FEE_RATE * 100).toFixed(2)}%</b> in fees, roughly what CSE brokers charge all-in. A round trip
            needs about a <b>{(roundTripBreakEven() * 100).toFixed(2)}%</b> move just to break even — frequent trading is expensive.
          </li>
          <li>You can't sell shares you don't own (no short selling) or spend more cash than you have (no margin).</li>
        </ul>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Reading the indicators</h2>
        <p className="text-sm text-muted">
          The technical summary on each stock tallies these indicators the way sites like investing.com do: each one votes Buy,
          Sell or Neutral by its textbook rule, and the votes are counted. It's a way to see what the chart is saying — not a
          prediction.
        </p>
        {GUIDE.map(g => (
          <article key={g.key} className="card p-5 text-sm leading-relaxed">
            <h3 className="text-base font-semibold">{g.name}</h3>
            <p className="mt-1 text-muted">{g.short}</p>
            <p className="mt-3">{g.what}</p>
            <h4 className="label mt-4">How to read it</h4>
            <ul className="mt-1 list-disc space-y-1 pl-5">
              {g.read.map(r => (
                <li key={r}>{r}</li>
              ))}
            </ul>
            <h4 className="label mt-4">Watch out</h4>
            <p className="mt-1">{g.watchOut}</p>
          </article>
        ))}
      </section>

      <section className="card p-5 text-sm leading-relaxed">
        <h2 className="text-lg font-semibold">A few habits worth practising</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5">
          <li>Write down why you're buying before you buy. Check back after a month: was the reason right, or were you lucky?</li>
          <li>Look at turnover before trading a stock. Many CSE counters trade only a few thousand rupees a day — real orders there move the price.</li>
          <li>Don't put the whole LKR 100,000 into one stock. Watch how a spread of 5–10 holdings behaves compared with one.</li>
          <li>When indicators disagree (trend says Buy, RSI says overbought), that's information too — it usually means wait.</li>
        </ul>
      </section>
    </div>
  );
}
