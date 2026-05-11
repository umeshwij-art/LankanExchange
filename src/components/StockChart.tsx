import React, { useEffect, useRef, useState } from 'react';
import { createChart, ColorType, IChartApi, ISeriesApi, SeriesMarker, CandlestickSeries, AreaSeries } from 'lightweight-charts';
import { useAuth } from '../lib/AuthContext';
import { db, collection, query, where, getDocs, orderBy } from '../lib/firebase';

interface StockChartProps {
  symbol: string;
  data: any[];
  chartType: 'line' | 'candle';
  isFullscreen?: boolean;
}

export const StockChart: React.FC<StockChartProps> = ({ symbol, data, chartType, isFullscreen }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick" | "Area"> | null>(null);
  const { user } = useAuth();
  const [trades, setTrades] = useState<any[]>([]);

  // 1. Fetch Trades
  useEffect(() => {
    const fetchTrades = async () => {
      if (!user || !symbol) return;
      try {
        const q = query(
          collection(db, 'trades'),
          where('uid', '==', user.uid),
          where('symbol', '==', symbol),
          orderBy('timestamp', 'asc')
        );
        const querySnapshot = await getDocs(q);
        const tradeData = querySnapshot.docs.map(doc => ({
          ...doc.data(),
          id: doc.id
        }));
        setTrades(tradeData);
      } catch (error) {
        console.error("Error fetching trades for chart:", error);
      }
    };
    fetchTrades();
  }, [user, symbol]);

  // 2. Initialize Chart
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const chart = createChart(chartContainerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: 'transparent' },
        textColor: '#64748b',
      },
      grid: {
        vertLines: { color: 'rgba(148, 163, 184, 0.05)' },
        horzLines: { color: 'rgba(148, 163, 184, 0.05)' },
      },
      width: chartContainerRef.current.clientWidth || 800,
      height: isFullscreen ? window.innerHeight - 150 : 450,
      timeScale: {
        borderColor: 'rgba(148, 163, 184, 0.1)',
        timeVisible: true,
        secondsVisible: false,
      },
    });

    chartRef.current = chart;

    const handleResize = () => {
      if (chartContainerRef.current && chartRef.current) {
        chartRef.current.applyOptions({ 
          width: chartContainerRef.current.clientWidth,
          height: isFullscreen ? window.innerHeight - 150 : 450
        });
        // Ensure data is visible after resize
        chartRef.current.timeScale().fitContent();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, [isFullscreen]);

  // 3. Update Series, Data and Markers
  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    // Remove old series if type changed
    if (seriesRef.current) {
      chartRef.current.removeSeries(seriesRef.current);
      seriesRef.current = null;
    }

    let series: any;
    if (chartType === 'candle') {
      series = chartRef.current.addSeries(CandlestickSeries, {
        upColor: '#10b981',
        downColor: '#ef4444',
        borderVisible: false,
        wickUpColor: '#10b981',
        wickDownColor: '#ef4444',
      });
      series.setData(data);
    } else {
      series = chartRef.current.addSeries(AreaSeries, {
        lineColor: '#10b981',
        topColor: 'rgba(16, 185, 129, 0.2)',
        bottomColor: 'rgba(16, 185, 129, 0)',
      });
      series.setData(data.map(d => ({ time: d.time, value: d.close })));
    }

    seriesRef.current = series;

    // Apply markers if trades exist
    if (trades.length > 0 && series && typeof series.setMarkers === 'function') {
      const markers: SeriesMarker<any>[] = trades.map(trade => {
        const tradeDate = new Date(trade.timestamp);
        const tradeTs = Math.floor(tradeDate.getTime() / 1000);
        
        return {
          time: tradeTs as any,
          position: trade.type === 'buy' ? 'belowBar' : 'aboveBar',
          color: trade.type === 'buy' ? '#10b981' : '#ef4444',
          shape: trade.type === 'buy' ? 'arrowUp' : 'arrowDown',
          text: trade.type.toUpperCase(),
        };
      });
      series.setMarkers(markers);
    }

    chartRef.current.timeScale().fitContent();
  }, [data, chartType, trades]);

  return <div ref={chartContainerRef} className="w-full h-full" />;
};
