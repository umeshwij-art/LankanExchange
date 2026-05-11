
export const configurationData = {
  supported_resolutions: ['1', '5', '15', '30', '60', '1D', '1W', '1M'],
  exchanges: [{
    value: 'CSE',
    name: 'Colombo Exchange',
    desc: 'CSE'
  }],
  symbols_types: [{
    name: 'crypto',
    value: 'crypto'
  }]
};

export default {
  onReady: (callback: any) => {
    console.log('[Datafeed] onReady called');
    setTimeout(() => callback(configurationData));
  },

  searchSymbols: async (userInput: string, exchange: string, symbolType: string, onResultReadyCallback: any) => {
    console.log('[Datafeed] searchSymbols called');
    const response = await fetch(`/api/stocks/search?q=${userInput}`);
    const data = await response.json();
    onResultReadyCallback(data.map((s: any) => ({
      symbol: s.symbol,
      full_name: s.name,
      description: s.name,
      exchange: 'CSE',
      type: 'stock'
    })));
  },

  resolveSymbol: async (symbolName: string, onSymbolResolvedCallback: any, onResolveErrorCallback: any) => {
    console.log('[Datafeed] resolveSymbol called', symbolName);
    const response = await fetch(`/api/simulator/stocks/${symbolName}`);
    const data = await response.json();

    if (data.error) {
      onResolveErrorCallback('Cannot resolve symbol');
      return;
    }

    const symbolInfo = {
      ticker: data.symbol,
      name: data.symbol,
      description: data.name,
      type: 'stock',
      session: '0930-1430',
      timezone: 'Asia/Colombo',
      exchange: 'CSE',
      minmov: 1,
      pricescale: 100,
      has_intraday: true,
      has_no_volume: false,
      has_weekly_and_monthly: true,
      supported_resolutions: configurationData.supported_resolutions,
      volume_precision: 2,
      data_status: 'streaming',
    };

    onSymbolResolvedCallback(symbolInfo);
  },

  getBars: async (symbolInfo: any, resolution: string, periodParams: any, onHistoryCallback: any, onErrorCallback: any) => {
    const { from, to, firstDataRequest } = periodParams;
    console.log('[Datafeed] getBars called', symbolInfo.name, resolution, new Date(from * 1000).toISOString(), new Date(to * 1000).toISOString());

    try {
      const response = await fetch(`/api/simulator/history/${symbolInfo.name}?from=${from}&to=${to}&resolution=${resolution}`);
      const bars = await response.json();

      if (bars.length === 0) {
        onHistoryCallback([], { noData: true });
        return;
      }

      onHistoryCallback(bars, { noData: false });
    } catch (error) {
      console.log('[Datafeed] getBars error', error);
      onErrorCallback(error);
    }
  },

  subscribeBars: (symbolInfo: any, resolution: string, onRealtimeCallback: any, subscriberUID: string, onResetCacheNeededCallback: any) => {
    console.log('[Datafeed] subscribeBars called', subscriberUID);
    // For Beta, we'll just poll the current price every 5 seconds
    const intervalId = setInterval(async () => {
      const response = await fetch(`/api/simulator/stocks/${symbolInfo.name}`);
      const data = await response.json();
      
      onRealtimeCallback({
        time: Date.now(),
        open: data.currentPrice,
        high: data.currentPrice,
        low: data.currentPrice,
        close: data.currentPrice,
        volume: 0
      });
    }, 5000);

    // Store intervalId to clear it later
    (window as any)._tv_intervals = (window as any)._tv_intervals || {};
    (window as any)._tv_intervals[subscriberUID] = intervalId;
  },

  unsubscribeBars: (subscriberUID: string) => {
    console.log('[Datafeed] unsubscribeBars called', subscriberUID);
    const intervalId = (window as any)._tv_intervals?.[subscriberUID];
    if (intervalId) {
      clearInterval(intervalId);
      delete (window as any)._tv_intervals[subscriberUID];
    }
  }
};
