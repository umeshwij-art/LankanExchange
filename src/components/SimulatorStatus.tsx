
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Activity, Zap, Shield, Clock } from 'lucide-react';

export const SimulatorStatus: React.FC = () => {
  const [stocks, setStocks] = useState<any[]>([]);
  const [tier, setTier] = useState('Free');

  useEffect(() => {
    const fetchStocks = async () => {
      try {
        const response = await fetch('/api/simulator/stocks');
        const data = await response.json();
        // Show top 5 most active
        setStocks(data.slice(0, 5));
      } catch (e) {
        console.error("Failed to fetch simulator stocks", e);
      }
    };

    fetchStocks();
    const interval = setInterval(fetchStocks, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-4 bg-slate-900/50 border border-slate-800 rounded-xl backdrop-blur-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400 animate-pulse" />
          <h3 className="font-semibold text-slate-100">Universal Simulator Engine</h3>
        </div>
        <div className="flex gap-2">
          {['Free', 'Pro'].map((t) => (
            <button
              key={t}
              onClick={() => setTier(t)}
              className={`px-3 py-1 text-xs rounded-full transition-all ${
                tier === t 
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/50' 
                  : 'bg-slate-800 text-slate-400 border border-transparent'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {stocks.map((stock) => (
          <div key={stock.symbol} className="flex items-center justify-between group">
            <div>
              <div className="text-sm font-medium text-slate-200">{stock.symbol}</div>
              <div className="text-[10px] text-slate-500">{stock.sector}</div>
            </div>
            <div className="text-right">
              <div className="text-sm font-mono text-emerald-400">
                Rs. {stock.currentPrice.toFixed(2)}
              </div>
              <div className="flex items-center gap-1 justify-end">
                {tier === 'Pro' ? (
                  <span className="flex items-center gap-0.5 text-[9px] text-amber-400">
                    <Zap className="w-2.5 h-2.5" /> Real-Time
                  </span>
                ) : (
                  <span className="flex items-center gap-0.5 text-[9px] text-slate-500">
                    <Clock className="w-2.5 h-2.5" /> Delayed
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-slate-800/50 flex items-center justify-between text-[10px] text-slate-500">
        <div className="flex items-center gap-1">
          <Shield className="w-3 h-3" />
          GBM Stochastic Engine Active
        </div>
        <div>Next Sync: 09:30 AM</div>
      </div>
    </div>
  );
};
