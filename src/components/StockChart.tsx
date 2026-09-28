import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CandlestickSeries,
  ColorType,
  createChart,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type Time,
} from 'lightweight-charts';
import { bollinger, ema, macd, rsi, sma, type Series } from '../../shared/indicators';
import type { Bar } from '../../shared/types';
import { useTheme } from '../lib/theme';
import { cx } from '../lib/format';

type Overlay = 'sma20' | 'sma50' | 'ema200' | 'bb';
type Lower = 'rsi' | 'macd';
type Range = '3M' | '6M' | '1Y' | 'All';

const RANGE_DAYS: Record<Range, number> = { '3M': 63, '6M': 126, '1Y': 252, All: Infinity };

const OVERLAYS: { key: Overlay; label: string; colorVar: string }[] = [
  { key: 'sma20', label: 'SMA 20', colorVar: '--line-1' },
  { key: 'sma50', label: 'SMA 50', colorVar: '--line-2' },
  { key: 'ema200', label: 'EMA 200', colorVar: '--line-3' },
  { key: 'bb', label: 'Bollinger', colorVar: '--muted' },
];

function cssVar(name: string) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888';
}

function line(bars: Bar[], s: Series) {
  return bars.map((b, i) => (s[i] === null ? { time: b.t as Time } : { time: b.t as Time, value: s[i]! }));
}

function Toggle({ on, onClick, children, color }: { on: boolean; onClick: () => void; children: string; color?: string }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={cx('flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium', on ? 'border-line bg-surface-2 text-text' : 'border-transparent text-muted hover:text-text')}
    >
      {color && <span className="h-2 w-2 rounded-full" style={{ background: on ? `var(${color})` : 'var(--line)' }} />}
      {children}
    </button>
  );
}

export function StockChart({ bars }: { bars: Bar[] }) {
  const el = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { theme } = useTheme();
  const [range, setRange] = useState<Range>('6M');
  const [overlays, setOverlays] = useState<Set<Overlay>>(new Set(['sma20', 'sma50']));
  const [lower, setLower] = useState<Set<Lower>>(new Set(['rsi', 'macd']));

  // Indicators are computed on the full history so the visible window has warm values.
  const calc = useMemo(() => {
    const closes = bars.map(b => b.c);
    return { sma20: sma(closes, 20), sma50: sma(closes, 50), ema200: ema(closes, 200), bb: bollinger(closes), rsi: rsi(closes), macd: macd(closes) };
  }, [bars]);

  useEffect(() => {
    if (!el.current || bars.length === 0) return;
    const text = cssVar('--chart-text');
    const grid = cssVar('--chart-grid');
    const up = cssVar('--up');
    const down = cssVar('--down');
    const border = cssVar('--line');

    const chart = createChart(el.current, {
      autoSize: true,
      layout: { background: { type: ColorType.Solid, color: 'transparent' }, textColor: text, fontFamily: 'Inter, sans-serif', panes: { separatorColor: border } },
      grid: { vertLines: { color: grid }, horzLines: { color: grid } },
      rightPriceScale: { borderColor: border },
      timeScale: { borderColor: border },
      crosshair: { mode: 0 },
    });
    chartRef.current = chart;

    const candles = chart.addSeries(CandlestickSeries, {
      upColor: up,
      downColor: down,
      borderVisible: false,
      wickUpColor: up,
      wickDownColor: down,
      priceFormat: { type: 'price', precision: 2, minMove: 0.1 },
    });
    candles.setData(bars.map(b => ({ time: b.t as Time, open: b.o, high: b.h, low: b.l, close: b.c })));

    const volume = chart.addSeries(HistogramSeries, { priceScaleId: 'vol', priceFormat: { type: 'volume' }, lastValueVisible: false, priceLineVisible: false });
    volume.priceScale().applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });
    volume.setData(bars.map(b => ({ time: b.t as Time, value: b.v, color: (b.c >= b.o ? up : down) + '55' })));

    const addLine = (s: Series, color: string, width = 2, pane = 0, style: LineStyle = LineStyle.Solid) => {
      const series = chart.addSeries(LineSeries, { color, lineWidth: width as 1 | 2, lineStyle: style, lastValueVisible: false, priceLineVisible: false, crosshairMarkerVisible: false }, pane);
      series.setData(line(bars, s));
      return series;
    };

    if (overlays.has('sma20')) addLine(calc.sma20, cssVar('--line-1'));
    if (overlays.has('sma50')) addLine(calc.sma50, cssVar('--line-2'));
    if (overlays.has('ema200')) addLine(calc.ema200, cssVar('--line-3'));
    if (overlays.has('bb')) {
      const c = cssVar('--muted');
      addLine(calc.bb.upper, c, 1, 0, LineStyle.Dashed);
      addLine(calc.bb.middle, c, 1, 0, LineStyle.Dotted);
      addLine(calc.bb.lower, c, 1, 0, LineStyle.Dashed);
    }

    let pane = 1;
    if (lower.has('rsi')) {
      const r = addLine(calc.rsi, cssVar('--line-3'), 2, pane);
      for (const level of [70, 30]) {
        r.createPriceLine({ price: level, color: level === 70 ? down : up, lineWidth: 1, lineStyle: LineStyle.Dashed, axisLabelVisible: true, title: '' });
      }
      pane++;
    }
    if (lower.has('macd')) {
      const hist = chart.addSeries(HistogramSeries, { lastValueVisible: false, priceLineVisible: false }, pane);
      hist.setData(bars.map((b, i) => {
        const v = calc.macd.histogram[i];
        return v === null ? { time: b.t as Time } : { time: b.t as Time, value: v, color: (v >= 0 ? up : down) + '99' };
      }));
      addLine(calc.macd.macd, cssVar('--line-1'), 2, pane);
      addLine(calc.macd.signal, cssVar('--line-2'), 1, pane);
      pane++;
    }
    const panes = chart.panes();
    for (let i = 1; i < panes.length; i++) panes[i].setHeight(110);

    const n = RANGE_DAYS[range];
    if (isFinite(n) && bars.length > n) chart.timeScale().setVisibleLogicalRange({ from: bars.length - n, to: bars.length + 2 });
    else chart.timeScale().fitContent();

    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, [bars, calc, overlays, lower, range, theme]);

  const flip = <T,>(set: Set<T>, v: T, setter: (s: Set<T>) => void) => {
    const next = new Set(set);
    next.has(v) ? next.delete(v) : next.add(v);
    setter(next);
  };

  const height = 360 + lower.size * 118;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-1">
        {(['3M', '6M', '1Y', 'All'] as Range[]).map(r => (
          <Toggle key={r} on={range === r} onClick={() => setRange(r)}>
            {r}
          </Toggle>
        ))}
        <span className="mx-2 h-4 w-px bg-line" />
        {OVERLAYS.map(o => (
          <Toggle key={o.key} on={overlays.has(o.key)} color={o.colorVar} onClick={() => flip(overlays, o.key, setOverlays)}>
            {o.label}
          </Toggle>
        ))}
        <span className="mx-2 h-4 w-px bg-line" />
        <Toggle on={lower.has('rsi')} onClick={() => flip(lower, 'rsi', setLower)}>
          RSI
        </Toggle>
        <Toggle on={lower.has('macd')} onClick={() => flip(lower, 'macd', setLower)}>
          MACD
        </Toggle>
      </div>
      <div ref={el} style={{ height }} className="w-full" />
      {bars.length < 30 && (
        <p className="mt-2 text-xs text-muted">
          Only {bars.length} day{bars.length === 1 ? '' : 's'} of history so far — indicators fill in as more closes are recorded.
        </p>
      )}
    </div>
  );
}
