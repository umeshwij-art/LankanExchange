import * as React from "react";
import { useState, useEffect } from "react";
import { useAuth } from "../lib/AuthContext";
import { Wallet, TrendingUp, TrendingDown, PieChart } from "lucide-react";
import { cn } from "../lib/utils";
import { db, collection, query, where, onSnapshot } from "../lib/firebase";

export function PortfolioBanner() {
  const { profile, user } = useAuth();
  const [portfolioValue, setPortfolioValue] = useState(0);
  const [totalCost, setTotalCost] = useState(0);

  useEffect(() => {
    if (!user) {
      setPortfolioValue(0);
      setTotalCost(0);
      return;
    }

    // Subscribe to positions in real-time
    const q = query(collection(db, 'positions'), where('uid', '==', user.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let total = 0;
      let cost = 0;
      
      snapshot.docs.forEach(docSnap => {
        const pos = docSnap.data();
        // Use avgPrice as fallback for value calculation in the banner
        total += pos.quantity * (pos.currentPrice || pos.avgPrice);
        cost += pos.totalCost || (pos.quantity * pos.avgPrice);
      });
      
      setPortfolioValue(total);
      setTotalCost(cost);
    }, (error) => {
      console.error("Error listening to positions in PortfolioBanner:", error);
    });

    return () => unsubscribe();
  }, [user]);

  if (!user || !profile) return null;

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(val);
  };

  const unrealizedPL = portfolioValue - totalCost;
  const totalPL = (profile.totalRealizedPL || 0) + unrealizedPL;
  const isPositive = totalPL >= 0;

  return (
    <div className="bg-[#0B0E11] border-b border-[#2B2F36] py-2 sticky top-16 z-40">
      <div className="max-w-7xl mx-auto px-4 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-6 overflow-x-auto no-scrollbar py-1">
          {/* Available Cash */}
          <div className="flex flex-col min-w-fit">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <Wallet className="h-2.5 w-2.5" /> Available Cash
            </span>
            <span className="font-mono text-xs font-bold text-emerald-500 tabular-nums">
              {formatCurrency(profile.availableCash || 0)}
            </span>
          </div>

          {/* Reserved */}
          <div className="flex flex-col min-w-fit border-l border-[#2B2F36] pl-6">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <Lock className="h-2.5 w-2.5" /> Reserved
            </span>
            <span className="font-mono text-xs font-bold text-amber-500 tabular-nums">
              {formatCurrency(profile.reservedCash || 0)}
            </span>
          </div>

          {/* Portfolio Value */}
          <div className="flex flex-col min-w-fit border-l border-[#2B2F36] pl-6">
            <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1">
              <PieChart className="h-2.5 w-2.5" /> Portfolio Value
            </span>
            <span className="font-mono text-xs font-bold text-white tabular-nums">
              {formatCurrency(portfolioValue)}
            </span>
          </div>
        </div>

        {/* Total P/L */}
        <div className="flex items-center gap-3 bg-[#161A1E] px-3 py-1.5 rounded border border-[#2B2F36]">
          <div className="flex flex-col items-end">
            <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Total P/L</span>
            <div className={cn(
              "flex items-center gap-1 font-mono text-xs font-bold tabular-nums",
              isPositive ? "text-emerald-500" : "text-rose-500"
            )}>
              {isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {isPositive ? '+' : ''}{formatCurrency(totalPL)}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Lock({ className }: { className?: string }) {
  return (
    <svg 
      xmlns="http://www.w3.org/2000/svg" 
      width="24" 
      height="24" 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="2" 
      strokeLinecap="round" 
      strokeLinejoin="round" 
      className={className}
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}
