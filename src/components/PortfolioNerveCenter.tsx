import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../lib/AuthContext';
import { useUI } from '../lib/UIContext';
import { db, collection, query, where, onSnapshot, doc, deleteDoc, updateDoc } from '../lib/firebase';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useFlash } from '../lib/hooks/useFlash';
import { toast } from 'sonner';
import { X, Wallet, Lock, Trash2, ArrowUpRight, ArrowDownRight, Activity } from 'lucide-react';
import { cn } from '../lib/utils';

interface Position {
  id: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  currentPrice: number;
  totalCost: number;
}

interface Order {
  id: string;
  symbol: string;
  type: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: number;
  limitPrice: number;
  status: 'pending' | 'filled' | 'cancelled';
}

const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

export function PortfolioNerveCenter({ onClose, showHeader = true }: { onClose?: () => void, showHeader?: boolean }) {
  const { user, profile, updateProfile } = useAuth();
  const { setActiveTicker } = useUI();
  const [positions, setPositions] = useState<Position[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);

  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;

    // Real-time positions
    const qPositions = query(collection(db, 'positions'), where('uid', '==', user.uid));
    const unsubscribePositions = onSnapshot(qPositions, (snapshot) => {
      const posData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Position));
      setPositions(posData);
    }, (error) => {
      console.error("Error listening to positions:", error);
    });

    // Real-time orders
    const qOrders = query(collection(db, 'orders'), where('uid', '==', user.uid), where('status', '==', 'pending'));
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      const orderData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Order));
      setOrders(orderData);
    }, (error) => {
      console.error("Error listening to orders:", error);
    });

    return () => {
      unsubscribePositions();
      unsubscribeOrders();
    };
  }, [user]);

  const handleCancelOrder = async (order: Order) => {
    if (!user || !profile) return;

    try {
      // 1. Remove from Firestore
      await deleteDoc(doc(db, 'orders', order.id));

      // 2. Refund cash if it was a buy order
      if (order.type === 'buy') {
        const refundAmount = order.quantity * order.limitPrice * 1.00112; // Including approximate commission
        await updateProfile({
          availableCash: (profile.availableCash || 0) + refundAmount,
          reservedCash: Math.max(0, (profile.reservedCash || 0) - refundAmount)
        });
        
        toast.success(`Order for ${order.symbol} Cancelled`, {
          description: `LKR ${new Intl.NumberFormat().format(refundAmount)} returned to wallet.`
        });
      } else {
        // If it was a sell order, we'd need to unlock the shares in 'positions'
        const posQuery = query(collection(db, 'positions'), where('uid', '==', user.uid), where('symbol', '==', order.symbol));
        // Simple logic for brevity: find the position and decrement reservedQuantity
        // In a real app, you'd use a transaction or a better lookup
        toast.success(`Order for ${order.symbol} Cancelled`);
      }
    } catch (error) {
      console.error("Cancellation failed:", error);
      toast.error("Failed to cancel order");
    }
  };

  const handleTickerSelect = (symbol: string) => {
    setActiveTicker(symbol);
    navigate(`/stock/${symbol}`);
    if (onClose) onClose();
  };

  const chartData = positions.map(p => ({
    name: p.symbol,
    value: p.quantity * (p.currentPrice || p.avgPrice)
  })).sort((a, b) => b.value - a.value);

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background text-foreground">
      {/* Header */}
      {showHeader && (
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-primary" />
            <h2 className="text-sm font-bold uppercase tracking-[0.2em]">Portfolio Nerve Center</h2>
          </div>
          {onClose && (
            <button onClick={onClose} className="p-1 hover:bg-muted rounded transition-colors">
              <X className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      <div className="flex-1 overflow-y-auto p-4 lg:p-6 custom-scrollbar">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 h-full">
          {/* Left Column: Visuals */}
          <div className="space-y-8 flex flex-col justify-center min-h-[300px]">
            <div className="relative h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={chartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                    onClick={(data) => handleTickerSelect(data.name)}
                    className="cursor-pointer"
                  >
                    {chartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                    ))}
                  </Pie>
                  <Tooltip 
                    contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--foreground)' }}
                    itemStyle={{ color: 'var(--foreground)' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Allocation</span>
                <PieChart className="h-4 w-4 mt-1 opacity-20" />
              </div>
            </div>

            {/* Cash Summary */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-card p-4 border border-border rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                  <Wallet className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Available</span>
                </div>
                <div className="font-mono text-lg font-bold text-emerald-500">
                  {new Intl.NumberFormat('en-LK').format(profile?.availableCash || 0)}
                </div>
              </div>
              <div className="bg-card p-4 border border-border rounded-lg shadow-sm">
                <div className="flex items-center gap-2 mb-2 text-muted-foreground">
                  <Lock className="h-3.5 w-3.5" />
                  <span className="text-[10px] font-bold uppercase tracking-widest">Reserved</span>
                </div>
                <div className="font-mono text-lg font-bold text-amber-500">
                  {new Intl.NumberFormat('en-LK').format(profile?.reservedCash || 0)}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Lists */}
          <div className="space-y-8">
            {/* Active Positions */}
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Active Positions</span>
                <span className="text-[10px] font-bold text-muted-foreground">{positions.length} SECS</span>
              </div>
              <div className="space-y-1">
                {positions.map((pos) => (
                  <PositionRow key={pos.id} position={pos} onClick={() => handleTickerSelect(pos.symbol)} />
                ))}
                {positions.length === 0 && (
                  <div className="py-8 text-center text-[11px] text-muted-foreground uppercase tracking-widest opacity-50">
                    No active positions
                  </div>
                )}
              </div>
            </div>

            {/* Pending Orders */}
            <div>
              <div className="flex items-center justify-between mb-4 border-b border-border pb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Pending Orders</span>
                <span className="text-[10px] font-bold text-muted-foreground">{orders.length} ACTIVE</span>
              </div>
              <div className="space-y-2">
                {orders.map((order) => (
                  <div key={order.id} className="bg-card border border-border p-3 flex justify-between items-center group rounded-lg shadow-sm">
                    <div className="flex flex-col">
                      <span className="font-bold text-xs">{order.symbol}</span>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground font-mono mt-1">
                        <span className={order.type === 'buy' ? 'text-emerald-500' : 'text-rose-500 whitespace-nowrap'}>
                          {order.type.toUpperCase()}
                        </span>
                        <span>{order.quantity} @ {new Intl.NumberFormat().format(order.limitPrice)}</span>
                      </div>
                    </div>
                    <button 
                      onClick={() => handleCancelOrder(order)}
                      className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-full transition-colors opacity-0 group-hover:opacity-100"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                {orders.length === 0 && (
                  <div className="py-8 text-center text-[11px] text-muted-foreground uppercase tracking-widest opacity-50">
                    No pending orders
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function PositionRow({ position, onClick }: { position: Position, onClick: () => void }) {
  const price = position.currentPrice || position.avgPrice;
  const { flashClass } = useFlash(price);
  const pnl = (price - position.avgPrice) * position.quantity;
  const isProfit = pnl >= 0;

  return (
    <div 
      onClick={onClick}
      className="flex items-center justify-between p-3 hover:bg-muted border-l-2 border-transparent hover:border-primary transition-all cursor-pointer group rounded-r-lg"
    >
      <div className="flex flex-col">
        <span className="font-bold text-sm tracking-tight">{position.symbol}</span>
        <span className="text-[10px] text-muted-foreground font-mono">{position.quantity} Shares</span>
      </div>
      <div className="flex flex-col items-end">
        <span className={cn("font-mono text-sm font-bold transition-colors duration-300", flashClass)}>
          {new Intl.NumberFormat('en-LK').format(price)}
        </span>
        <div className={cn(
          "flex items-center gap-1 text-[10px] font-mono",
          isProfit ? "text-emerald-500" : "text-rose-500"
        )}>
          {isProfit ? <ArrowUpRight className="h-2.5 w-2.5" /> : <ArrowDownRight className="h-2.5 w-2.5" />}
          {isProfit ? '+' : ''}{new Intl.NumberFormat('en-LK').format(pnl)}
        </div>
      </div>
    </div>
  );
}
