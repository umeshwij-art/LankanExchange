
import React, { useEffect, useRef } from 'react';
import Datafeed from '../lib/simulator/datafeed';

declare global {
  interface Window {
    TradingView: any;
  }
}

interface AdvancedStockChartProps {
  symbol: string;
}

export const AdvancedStockChart: React.FC<AdvancedStockChartProps> = ({ symbol }) => {
  const chartContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Dynamically load the charting library script if not present
    const scriptId = 'tradingview-charting-lib';
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    const initWidget = () => {
      if (!window.TradingView) return;

      const widgetOptions = {
        symbol: symbol,
        datafeed: Datafeed,
        interval: 'D' as any,
        container: chartContainerRef.current!,
        library_path: '/charting_library/',
        locale: 'en' as any,
        disabled_features: ['use_localstorage_for_settings'],
        enabled_features: [
          'study_templates', 
          'drawing_toolbar', 
          'side_toolbar', 
          'header_indicators',
          'header_chart_type',
          'header_settings',
          'header_resolutions',
          'header_screenshot',
          'header_symbol_search',
          'header_undo_redo',
          'header_compare',
          'header_fullscreen_button',
        ],
        charts_storage_url: 'https://savelayout.tradingview.com',
        charts_storage_api_version: '1.1',
        client_id: 'lankatrade.ai',
        user_id: 'user_123', // In real app, use actual user ID
        fullscreen: false,
        autosize: true,
        theme: 'Dark' as any,
        style: '1' as any,
        toolbar_bg: '#0f172a',
        loading_screen: { backgroundColor: "#0f172a" },
        overrides: {
          "paneProperties.background": "#0f172a",
          "paneProperties.vertGridProperties.color": "#1e293b",
          "paneProperties.horzGridProperties.color": "#1e293b",
          "symbolWatermarkProperties.transparency": 90,
          "scalesProperties.textColor": "#94a3b8",
          "mainSeriesProperties.candleStyle.upColor": "#10b981",
          "mainSeriesProperties.candleStyle.downColor": "#ef4444",
          "mainSeriesProperties.candleStyle.drawWick": true,
          "mainSeriesProperties.candleStyle.drawBorder": true,
          "mainSeriesProperties.candleStyle.borderColor": "#10b981",
          "mainSeriesProperties.candleStyle.borderUpColor": "#10b981",
          "mainSeriesProperties.candleStyle.borderDownColor": "#ef4444",
          "mainSeriesProperties.candleStyle.wickUpColor": "#10b981",
          "mainSeriesProperties.candleStyle.wickDownColor": "#ef4444",
        },
      };

      const tvWidget = new window.TradingView.widget(widgetOptions);

      tvWidget.onChartReady(() => {
        console.log('[AdvancedStockChart] Chart is ready');
      });
    };

    if (!window.TradingView) {
      if (!script) {
        script = document.createElement('script');
        script.id = scriptId;
        script.src = '/charting_library/charting_library.js';
        script.type = 'text/javascript';
        script.onload = initWidget;
        document.head.appendChild(script);
      } else {
        script.addEventListener('load', initWidget);
      }
    } else {
      initWidget();
    }

    return () => {
      // Cleanup if necessary
    };
  }, [symbol]);

  return (
    <div className="relative w-full h-[600px] bg-slate-900 rounded-xl overflow-hidden border border-slate-800 shadow-2xl">
      <div 
        ref={chartContainerRef} 
        className="w-full h-full" 
      />
      {!window.TradingView && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm z-10">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-slate-400 text-sm font-medium">Initializing Advanced Charting Engine...</p>
          </div>
        </div>
      )}
    </div>
  );
};
