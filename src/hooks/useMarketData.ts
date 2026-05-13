import { useState, useEffect } from 'react';

export interface MarketStock {
  symbol: string;
  name: string;
  anchorPrice: number;
  currentPrice: number;
  previousPrice?: number;
  high: number;
  low: number;
  volume: number;
  volatility: number;
  drift: number;
}

export const useMarketData = (isBetaMode = true) => {
  const [stocks, setStocks] = useState<MarketStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Stock Profile Volatility Definitions (The "Personalities" we configured)
  const stockProfiles: Record<string, { volatility: number; drift: number }> = {
    "BIL.N0000": { volatility: 0.035, drift: 0.0005 },
    "LIOC.N0000": { volatility: 0.018, drift: 0.0002 },
    "SAMP.N0000": { volatility: 0.007, drift: 0.0001 }
  };

  useEffect(() => {
    const initializeMarket = async () => {
      try {
        // Call your local serverless route instead of cse.lk directly
        const response = await fetch('/api/market');
        const result = await response.json();

        if (!result.success) throw new Error(result.error);

        // Map incoming real-world closing prices to our custom mock engine
        const initializedStocks: MarketStock[] = result.data.map((stock: any) => {
          const profile = stockProfiles[stock.symbol] || { volatility: 0.015, drift: 0.0002 }; // Default profile fallback
          return {
            ...stock,
            currentPrice: stock.anchorPrice, // Start the mock session from yesterday's real close
            volatility: profile.volatility,
            drift: profile.drift
          };
        });

        setStocks(initializedStocks);
        setLoading(false);
      } catch (err: any) {
        setError(err.message);
        setLoading(false);
      }
    };

    initializeMarket();
  }, []);

  // Live Simulated Tick Engine (Runs continuously during the session)
  useEffect(() => {
    if (loading || error || !isBetaMode || stocks.length === 0) return;

    const tickInterval = setInterval(() => {
      setStocks(prevStocks => 
        prevStocks.map(stock => {
          // Geometric Brownian Motion Logic: NextPrice = Price * (1 + Drift + (Volatility * RandomShock))
          const randomShock = (Math.random() - 0.5) * 2; // Value between -1 and 1
          const changePercent = stock.drift + (stock.volatility * randomShock);
          const nextPrice = stock.currentPrice * (1 + changePercent);

          return {
            ...stock,
            previousPrice: stock.currentPrice,
            currentPrice: Math.max(0.01, nextPrice) // Enforce price floor protection
          };
        })
      );
    }, 4000); // Ticks every 4 seconds to maintain server fluidity

    return () => clearInterval(tickInterval);
  }, [loading, error, isBetaMode, stocks.length]);

  return { stocks, loading, error };
};
