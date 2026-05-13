import React, { useState } from 'react';
import { Activity, Clock, Search, Globe, ChevronRight, Zap } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { useMarketData } from '../hooks/useMarketData';

export const MarketTerminal: React.FC = () => {
  const { stocks, loading, error } = useMarketData(true);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredData = stocks.filter(item => 
    item.symbol.toLowerCase().includes(searchQuery.toLowerCase()) ||
    item.name.toLowerCase().includes(searchQuery.toLowerCase())
  ).slice(0, 15); // Show top 15 in terminal

  const lastUpdated = new Date(); // In a real app we'd get this from the hook

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
              {loading ? 'Syncing...' : lastUpdated.toLocaleTimeString()}
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
          className="p-1.5 hover:bg-slate-800 rounded text-slate-500 hover:text-emerald-400 transition-colors"
          title="Force Re-Sync"
          onClick={() => window.location.reload()}
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
      <div className="flex-grow overflow-y-auto bg-slate-950 custom-scrollbar min-h-[400px]">
        {loading && stocks.length === 0 ? (
          <div className="p-4 space-y-3">
            {[...Array(12)].map((_, i) => (
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
              onClick={() => window.location.reload()}
              className="text-[9px] font-bold bg-slate-800 hover:bg-slate-700 px-4 py-1.5 rounded transition-all uppercase"
            >
              Retry Connection
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-900">
            <AnimatePresence mode="popLayout">
              {filteredData.map((stock) => {
                const change = stock.currentPrice - stock.anchorPrice;
                const percentageChange = (change / stock.anchorPrice) * 100;
                const isPositive = change >= 0;

                return (
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
                      {(stock.name || '').toLowerCase()}
                    </span>
                    <span className={cn(
                      "text-[10px] font-mono text-right tabular-nums transition-colors duration-500",
                      stock.previousPrice && stock.currentPrice > stock.previousPrice ? "text-emerald-400" : 
                      stock.previousPrice && stock.currentPrice < stock.previousPrice ? "text-rose-400" : "text-slate-300"
                    )}>
                      {stock.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                    <span className={cn(
                      "text-[10px] font-mono text-right tabular-nums",
                      isPositive ? "text-emerald-500" : "text-rose-500"
                    )}>
                      {isPositive ? "+" : ""}{percentageChange.toFixed(2)}%
                    </span>
                  </motion.div>
                );
              })}
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
            <span className="text-[10px] font-mono text-slate-400">{stocks.length} Stocks</span>
          </div>
          <div className="flex flex-col border-l border-slate-800 pl-4">
            <span className="text-[7px] font-bold text-slate-600 uppercase tracking-widest">Market Feed</span>
            <span className="text-[10px] font-mono text-emerald-500 animate-pulse uppercase">Active Simulation</span>
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
