import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, TrendingDown, Clock, Search, Filter, Globe, ChevronRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface MarketPrice {
  symbol: string;
  name: string;
  price: number;
  change: number;
  percentageChange: number;
  sharevolume: number;
  marketCap?: number;
}

export const MarketTerminal: React.FC = () => {
  const [data, setData] = useState<MarketPrice[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const fetchMarketPrices = async () => {
    try {
      const response = await fetch('/api/market');
      if (!response.ok) throw new Error('Failed to fetch from proxy');
      const marketData = await response.json();
      
      const rawStocks = marketData.reqTradeSummery || marketData.reqTradeSummary || marketData.tradeSummary || [];
      const parsedData: MarketPrice[] = rawStocks.map((s: any) => ({
        symbol: s.symbol || "",
        name: s.name || s.companyName || "",
        price: parseFloat(s.price || s.lastTradedPrice || 0),
        change: parseFloat(s.change || 0),
        percentageChange: parseFloat(s.percentageChange || 0),
        sharevolume: parseFloat(s.sharevolume || s.volume || 0),
        marketCap: parseFloat(s.marketCap || 0)
      }));

      setData(parsedData);
      setLastUpdated(new Date());
      setLoading(false);
    } catch (err: any) {
      console.error("Market Proxy Error:", err);
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMarketPrices();
    const interval = setInterval(fetchMarketPrices, 30000); // 30s auto-refresh
    return () => clearInterval(interval);
  }, []);

  const filteredData = data.filter(item => 
    item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 15); // Show top 15 in terminal

  return (
    <div className="bg-card border border-border rounded-lg overflow-hidden flex flex-col h-full shadow-2xl">
      {/* Terminal Header */}
      <div className="bg-slate-900 border-b border-slate-800 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
          <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">CSE Live Terminal</h2>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Globe className="h-3 w-3 text-slate-500" />
            <span className="text-[9px] font-mono text-slate-500">PROXY: ON</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Clock className="h-3 w-3 text-slate-500" />
            <span className="text-[9px] font-mono text-slate-500 uppercase">
              {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Syncing...'}
            </span>
          </div>
        </div>
      </div>

      {/* Terminal Controls */}
      <div className="bg-slate-900/50 border-b border-slate-800 px-4 py-2 flex items-center gap-3">
        <div className="relative flex-grow">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-600" />
          <input 
            type="text" 
            placeholder="FILTER TICKER..." 
            className="w-full bg-slate-950 border border-slate-800 rounded px-8 py-1.5 text-[10px] font-mono text-emerald-500 placeholder:text-slate-700 outline-none focus:border-emerald-500/30 transition-all"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <button 
          onClick={() => fetchMarketPrices()}
          className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-emerald-400 transition-colors"
          title="Force Re-Sync"
        >
          <Zap className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Table Headers */}
      <div className="grid grid-cols-[80px_1fr_80px_80px] bg-slate-900/30 px-4 py-1.5 border-b border-slate-800">
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest">Symbol</span>
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest text-center">Name</span>
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest text-right">Last Price</span>
        <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest text-right">Change%</span>
      </div>

      {/* Terminal Body */}
      <div className="flex-grow overflow-y-auto bg-slate-950 custom-scrollbar">
        {loading && data.length === 0 ? (
          <div className="p-4 space-y-3">
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex justify-between gap-4">
                <Skeleton className="h-3 w-16 bg-slate-800" />
                <Skeleton className="h-3 w-full bg-slate-800" />
                <Skeleton className="h-3 w-12 bg-slate-800" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-4">
            <Activity className="h-8 w-8 text-rose-500 opacity-50" />
            <div className="space-y-1">
              <p className="text-[9px] font-bold text-rose-400 uppercase tracking-widest">Initialization Failed</p>
              <p className="text-[10px] text-slate-600 font-mono">{error}</p>
            </div>
            <button 
              onClick={() => fetchMarketPrices()}
              className="text-[9px] font-bold bg-slate-800 hover:bg-slate-700 px-4 py-1.5 rounded transition-all uppercase"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-900">
            <AnimatePresence mode="popLayout">
              {filteredData.map((stock) => (
                <motion.div 
                  key={stock.symbol}
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="grid grid-cols-[80px_1fr_80px_80px] px-4 py-2 hover:bg-slate-900 group cursor-pointer transition-colors"
                >
                  <span className="text-[10px] font-bold text-slate-300 group-hover:text-emerald-400 transition-colors font-mono tracking-tighter">
                    {stock.symbol}
                  </span>
                  <span className="text-[9px] text-slate-500 truncate px-2 group-hover:text-slate-300 transition-colors capitalize">
                    {stock.name.toLowerCase()}
                  </span>
                  <span className="text-[10px] font-mono text-slate-300 text-right tabular-nums">
                    {stock.price.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                  <span className={cn(
                    "text-[10px] font-mono text-right tabular-nums",
                    stock.change > 0 ? "text-emerald-500" : stock.change < 0 ? "text-rose-500" : "text-slate-500"
                  )}>
                    {stock.change > 0 ? "+" : ""}{stock.percentageChange.toFixed(2)}%
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {filteredData.length === 0 && (
              <div className="py-20 text-center">
                <p className="text-[9px] font-bold text-slate-700 uppercase tracking-widest">No Matches Found</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Terminal Footer */}
      <div className="bg-slate-900 border-t border-slate-800 px-4 py-1.5 flex items-center justify-between">
        <div className="flex gap-4">
          <div className="flex flex-col">
            <span className="text-[7px] font-bold text-slate-600 uppercase tracking-widest">Total Samples</span>
            <span className="text-[10px] font-mono text-slate-400">{data.length} Stocks</span>
          </div>
          <div className="flex flex-col border-l border-slate-800 pl-4">
            <span className="text-[7px] font-bold text-slate-600 uppercase tracking-widest">Market Feed</span>
            <span className="text-[10px] font-mono text-emerald-500 animate-pulse">STREAMING</span>
          </div>
        </div>
        <button className="flex items-center gap-1.5 text-[9px] font-bold text-slate-500 hover:text-white transition-colors group">
          FULL SCAN <ChevronRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 2px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #1e293b;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #334155;
        }
      `}} />
    </div>
  );
};
