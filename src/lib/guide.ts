// Plain-English explanations shown next to each indicator and on the Learn page.

export interface GuideEntry {
  key: string;
  name: string;
  short: string;
  what: string;
  read: string[];
  watchOut: string;
}

export const GUIDE: GuideEntry[] = [
  {
    key: 'ma',
    name: 'Moving averages (SMA & EMA)',
    short: 'The average closing price over the last N days — a smoothed trend line.',
    what:
      'A Simple Moving Average (SMA) adds up the last N closes and divides by N. An Exponential Moving Average (EMA) does the same but gives recent days more weight, so it turns faster. Short averages (10, 20 days) track the recent swing; long ones (100, 200 days) show the big-picture trend.',
    read: [
      'Price above the average → the trend over that window is up (counted as Buy).',
      'Price below the average → the trend is down (counted as Sell).',
      'When a short average crosses above a long one (e.g. 50 over 200) traders call it a “golden cross”; the reverse is a “death cross”.',
    ],
    watchOut:
      'Averages lag — they confirm a trend after it starts. In a sideways market price whips back and forth across them, giving false signals. Thinly traded CSE stocks can sit on the same price for days, which flattens averages.',
  },
  {
    key: 'rsi14',
    name: 'RSI — Relative Strength Index',
    short: 'Momentum gauge from 0 to 100: how strong recent gains are versus recent losses.',
    what:
      'RSI compares the size of up-days to down-days over the last 14 sessions (with Wilder’s smoothing). A reading near 100 means almost every recent move was up; near 0 means almost every move was down.',
    read: [
      'Above 70 → “overbought”: the rally may be stretched (counted as Sell).',
      'Below 30 → “oversold”: the fall may be overdone (counted as Buy).',
      'Between 30 and 70 → neutral.',
    ],
    watchOut:
      'Strong trends can stay overbought or oversold for weeks. RSI works better for spotting exhaustion in a range than for calling the top of a real rally.',
  },
  {
    key: 'macd',
    name: 'MACD — Moving Average Convergence Divergence',
    short: 'The gap between a fast and slow EMA, compared with its own average.',
    what:
      'The MACD line is the 12-day EMA minus the 26-day EMA. The signal line is a 9-day EMA of the MACD line. The histogram shows the distance between the two.',
    read: [
      'MACD above its signal line → momentum is turning up (counted as Buy).',
      'MACD below its signal line → momentum is fading (counted as Sell).',
      'A growing histogram means the move is accelerating; a shrinking one means it is losing steam.',
    ],
    watchOut: 'Built from moving averages, so it lags too, and crossovers are frequent in choppy markets.',
  },
  {
    key: 'stoch',
    name: 'Stochastic oscillator',
    short: 'Where today’s close sits within the last 14 days’ high–low range.',
    what:
      '%K = (close − 14-day low) ÷ (14-day high − 14-day low) × 100. %D is a 3-day average of %K. 100 means the stock closed at its two-week high; 0 means at its two-week low.',
    read: ['Above 80 → overbought (counted as Sell).', 'Below 20 → oversold (counted as Buy).', '%K crossing %D is often used as a timing trigger.'],
    watchOut: 'Very sensitive — it swings to the extremes easily, so it is best used alongside a trend tool.',
  },
  {
    key: 'bb',
    name: 'Bollinger Bands',
    short: 'A 20-day average with bands two standard deviations above and below.',
    what:
      'The bands widen when prices are volatile and squeeze together when they are calm. Roughly 95% of closes fall inside the bands if prices behave “normally”. The value shown is %B: 0 = on the lower band, 100 = on the upper band.',
    read: [
      'Close above the upper band → unusually strong, possibly stretched (counted as Sell).',
      'Close below the lower band → unusually weak, possibly oversold (counted as Buy).',
      'A tight “squeeze” often comes before a big move — but not which direction.',
    ],
    watchOut: 'In a strong trend, price can “walk the band” for a long time. Touching a band is not a reversal by itself.',
  },
];

export const GUIDE_BY_KEY: Record<string, GuideEntry> = Object.fromEntries(GUIDE.map(g => [g.key, g]));

export function guideFor(indicatorKey: string): GuideEntry | undefined {
  if (/^(sma|ema)\d+$/.test(indicatorKey)) return GUIDE_BY_KEY.ma;
  return GUIDE_BY_KEY[indicatorKey];
}
