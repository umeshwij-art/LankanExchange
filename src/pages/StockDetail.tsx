import React, { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { 
  ArrowLeft, 
  ArrowUpRight, 
  ArrowDownRight, 
  Info, 
  BarChart3, 
  Globe, 
  ShieldCheck, 
  Maximize2, 
  Minimize2, 
  Heart, 
  FileText, 
  Newspaper as NewsIcon,
  Lock,
  ExternalLink,
  Star,
  TrendingUp,
  Activity,
  Search,
  Sparkles,
  ShoppingCart,
  Wallet,
  CheckCircle2,
  AlertCircle,
  CandlestickChart as CandlestickIcon, 
  LineChart as LineIcon,
  Zap
} from "lucide-react";
import { toast } from "sonner";
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { GoogleGenAI, Type } from "@google/genai";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "../lib/AuthContext";
import { motion, AnimatePresence } from "motion/react";
import { StockChart } from "../components/StockChart";
import { AdvancedStockChart } from "../components/AdvancedStockChart";
import { placeOrder, cancelOrder, checkLimitOrders, executeTrade as executeMarketTrade } from "../lib/tradingEngine";
import { db, collection, query, where, onSnapshot, orderBy, limit } from "../lib/firebase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

interface StockData {
  quote: {
    symbol: string;
    fullName: string;
    price: number;
    change: number;
    changePercent: number;
    currency: string;
    marketCap: number;
    high: number;
    low: number;
    volume: number;
    prevClose: number;
    open: number;
    sector: string;
    board: string;
  };
  history: {
    time: number;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
  }[];
}

const Candlestick = (props: any) => {
  const { x, width, payload, yAxis } = props;
  
  if (!yAxis || !yAxis.scale || !payload) return null;

  const { open, close, high, low } = payload;
  const isPositive = close >= open;
  const color = isPositive ? "#10b981" : "#ef4444";

  const openY = yAxis.scale(open);
  const closeY = yAxis.scale(close);
  const highY = yAxis.scale(high);
  const lowY = yAxis.scale(low);

  const bodyY = Math.min(openY, closeY);
  const bodyHeight = Math.max(Math.abs(openY - closeY), 1);
  const wickX = x + width / 2;

  return (
    <g key={`candle-${props.index}`}>
      <line
        x1={wickX}
        y1={lowY}
        x2={wickX}
        y2={highY}
        stroke={color}
        strokeWidth={2}
      />
      <rect
        x={x + width * 0.15}
        y={bodyY}
        width={width * 0.7}
        height={bodyHeight}
        fill={color}
        stroke={color}
        strokeWidth={1}
      />
    </g>
  );
};

export default function StockDetail() {
  const { symbol } = useParams();
  const navigate = useNavigate();
  const { profile, updateProfile, login } = useAuth();
  const [data, setData] = useState<StockData | null>(null);
  const [loading, setLoading] = useState(true);
  const [reports, setReports] = useState<any[]>([]);
  const [loadingReports, setLoadingReports] = useState(false);
  const [searchingReport, setSearchingReport] = useState(false);
  const [searchResult, setSearchResult] = useState<{title: string, link: string} | null>(null);
  const [switching, setSwitching] = useState(false);
  const [timeframe, setTimeframe] = useState("1M");
  const [chartType, setChartType] = useState<"line" | "candle">("candle");
  const [useAdvancedChart, setUseAdvancedChart] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const fullscreenRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick" | "Area"> | null>(null);

  const [aiInsight, setAiInsight] = useState<{
    bullets: string[];
    riskRating: 'Low' | 'Medium' | 'High';
    dividendImpact: string;
  } | null>(null);
  const [summarizing, setSummarizing] = useState(false);
  const [showWaitlist, setShowWaitlist] = useState(false);
  const [waitlistTier, setWaitlistTier] = useState<'pro' | 'ultimate'>('pro');
  const [waitlistEmail, setWaitlistEmail] = useState(profile?.email || '');
  const [waitlistLoading, setWaitlistLoading] = useState(false);

  // Trade State
  const [tradeType, setTradeType] = useState<'buy' | 'sell'>('buy');
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [limitPrice, setLimitPrice] = useState(0);
  const [tradeQuantity, setTradeQuantity] = useState(1);
  const [executingTrade, setExecutingTrade] = useState(false);
  const [tradeFeedback, setTradeFeedback] = useState<{ success: boolean, message: string } | null>(null);

  // Portfolio & Orders State
  const [positions, setPositions] = useState<any[]>([]);
  const [openOrders, setOpenOrders] = useState<any[]>([]);
  const [tradeHistory, setTradeHistory] = useState<any[]>([]);
  const [portfolioValue, setPortfolioValue] = useState(0);

  const isPro = profile?.tier === 'pro' || profile?.tier === 'ultimate';
  const isInWatchlist = profile?.watchlist?.includes(symbol || '');

  const currentPosition = positions.find(p => p.symbol === symbol);
  const sellableQuantity = currentPosition ? (currentPosition.quantity - (currentPosition.reservedQuantity || 0)) : 0;

  const toggleWatchlist = async () => {
    if (!profile) {
      login();
      return;
    }
    const currentWatchlist = profile.watchlist || [];
    const newWatchlist = isInWatchlist 
      ? currentWatchlist.filter(s => s !== symbol)
      : [...currentWatchlist, symbol || ''];
    
    await updateProfile({ watchlist: newWatchlist });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      fullscreenRef.current?.requestFullscreen().catch(err => {
        console.error(`Error attempting to enable full-screen mode: ${err.message}`);
      });
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  const handleDeepSearch = async () => {
    if (!symbol || !data) return;
    setSearchingReport(true);
    setSearchResult(null);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Find the most recent official Annual Report PDF download link for ${data.quote.fullName} (${symbol}) listed on the Colombo Exchange. Search for the 2024 or 2025 report. Return only a JSON object with "title" and "link" fields. Ensure the link is a direct PDF download if possible.`,
        config: {
          tools: [{ googleSearch: {} }],
          responseMimeType: "application/json"
        }
      });
      const result = JSON.parse(response.text);
      setSearchResult(result);
    } catch (error) {
      console.error("Deep search failed:", error);
    } finally {
      setSearchingReport(false);
    }
  };

  const handleSummarize = async (text: string) => {
    setSummarizing(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze the following stock market disclosure: "${text}". 
        Provide:
        1. Exactly 3 concise bullet points summarizing the key facts.
        2. A risk rating (Low, Medium, or High).
        3. A one-sentence assessment of the impact on dividends.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              bullets: {
                type: Type.ARRAY,
                items: { type: Type.STRING }
              },
              riskRating: { type: Type.STRING, enum: ['Low', 'Medium', 'High'] },
              dividendImpact: { type: Type.STRING }
            },
            required: ["bullets", "riskRating", "dividendImpact"]
          }
        }
      });
      const result = JSON.parse(response.text);
      setAiInsight(result);
    } catch (error) {
      console.error("Summarization failed:", error);
    } finally {
      setSummarizing(false);
    }
  };

  useEffect(() => {
    if (data?.quote?.price && !limitPrice) {
      setLimitPrice(data.quote.price);
    }
  }, [data]);

  // Real-time Listeners
  useEffect(() => {
    if (!profile?.uid) return;

    const qPositions = query(collection(db, 'positions'), where('uid', '==', profile.uid));
    const unsubscribePositions = onSnapshot(qPositions, (snapshot) => {
      setPositions(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error listening to positions:", error);
    });

    const qOrders = query(collection(db, 'orders'), where('uid', '==', profile.uid), where('status', '==', 'pending'));
    const unsubscribeOrders = onSnapshot(qOrders, (snapshot) => {
      setOpenOrders(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      console.error("Error listening to orders:", error);
    });

    // Client-side sorting for trades to avoid missing index errors in some environments
    const qHistory = query(collection(db, 'trades'), where('uid', '==', profile.uid), limit(50));
    const unsubscribeHistory = onSnapshot(qHistory, (snapshot) => {
      const trades = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort manually by timestamp desc
      trades.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      setTradeHistory(trades);
    }, (error) => {
      console.error("Error listening to trade history:", error);
    });

    return () => {
      unsubscribePositions();
      unsubscribeOrders();
      unsubscribeHistory();
    };
  }, [profile?.uid]);

  // Limit Order Watcher
  useEffect(() => {
    if (!data?.quote?.price || !profile) return;

    const interval = setInterval(() => {
      // In a real app, we'd have a map of all stock prices. 
      // Here we only have the current stock's price.
      const currentPrices: Record<string, number> = {
        [symbol || '']: data.quote.price
      };
      checkLimitOrders(currentPrices, profile);
    }, 5000);

    return () => clearInterval(interval);
  }, [data?.quote?.price, profile, symbol]);

  const handleTrade = async () => {
    if (!profile || !data) {
      login();
      return;
    }

    setExecutingTrade(true);
    setTradeFeedback(null);

    try {
      const result = await placeOrder({
        symbol: symbol || '',
        type: tradeType,
        orderType: orderType,
        quantity: tradeQuantity,
        limitPrice: orderType === 'limit' ? limitPrice : data.quote.price
      }, profile);

      toast.success(tradeType === 'buy' ? "Buy order placed" : "Sell order placed", {
        description: (result as any).aiCritique || (result as any).message || "Order processed successfully"
      });
      
      setTradeFeedback({ success: true, message: (result as any).aiCritique || (result as any).message || "Order placed successfully" });
      setTimeout(() => setTradeFeedback(null), 8000);
    } catch (error: any) {
      toast.error("Trade Failed", {
        description: error.message
      });
      setTradeFeedback({ success: false, message: error.message });
    } finally {
      setExecutingTrade(false);
    }
  };

  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    if (data?.history) {
      setChartData(data.history.map(d => ({
        time: d.time,
        open: d.open,
        high: d.high,
        low: d.low,
        close: d.close
      })));
    }
  }, [data]);

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  useEffect(() => {
    if (!data) setLoading(true);
    else setSwitching(true);

    fetch(`/api/stocks/${symbol}?range=${timeframe}`, {
      headers: {
        'x-user-tier': profile?.tier || 'free'
      }
    })
      .then((res) => res.json())
      .then((data) => {
        setData(data);
        setLoading(false);
        setSwitching(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
        setSwitching(false);
      });
  }, [symbol, timeframe]);

  useEffect(() => {
    if (isPro && symbol) {
      setLoadingReports(true);
      fetch(`/api/stocks/${symbol}/reports`, {
        headers: {
          'x-user-tier': profile?.tier || 'free'
        }
      })
        .then(res => res.json())
        .then(data => {
          setReports(data);
          setLoadingReports(false);
        })
        .catch(err => {
          console.error(err);
          setLoadingReports(false);
        });
    }
  }, [isPro, symbol]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2
    }).format(val);
  };

  const formatCompact = (val: number) => {
    return new Intl.NumberFormat('en-LK', {
      notation: 'compact',
      compactDisplay: 'short'
    }).format(val);
  };

  const handleWaitlist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!waitlistEmail) return;
    setWaitlistLoading(true);
    try {
      const { doc, setDoc, serverTimestamp } = await import('firebase/firestore');
      const { db } = await import('../lib/firebase');
      await setDoc(doc(db, 'waitlist', waitlistEmail), {
        email: waitlistEmail,
        tier: waitlistTier,
        timestamp: serverTimestamp(),
        source: 'stock_detail'
      });
      alert(`Success! You've been added to the ${waitlistTier.toUpperCase()} waitlist.`);
      setShowWaitlist(false);
    } catch (err) {
      console.error(err);
      alert('Failed to join waitlist. Please try again.');
    } finally {
      setWaitlistLoading(false);
    }
  };

  useEffect(() => {
    if (!positions.length) {
      setPortfolioValue(0);
      return;
    }

    const total = positions.reduce((acc, pos) => {
      const price = pos.symbol === symbol ? data?.quote?.price || pos.avgPrice : pos.avgPrice;
      return acc + (pos.quantity * price);
    }, 0);
    setPortfolioValue(total);
  }, [positions, data?.quote?.price, symbol]);

  const totalPL = (profile?.totalRealizedPL || 0) + (portfolioValue - positions.reduce((acc, pos) => acc + (pos.totalCost || 0), 0));

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-12">
        <Skeleton className="h-12 w-48 mb-8 bg-black/5" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="lg:col-span-2">
            <Skeleton className="h-[400px] w-full bg-black/5 mb-8" />
            <Skeleton className="h-64 w-full bg-black/5" />
          </div>
          <Skeleton className="h-[600px] w-full bg-black/5" />
        </div>
      </div>
    );
  }

  if (!data || !data.quote) return <div className="p-12 text-center">Stock not found</div>;

  const isPositive = (data.quote.change || 0) >= 0;

  return (
    <div className="min-h-screen bg-background pb-12">
      {/* Header Bar */}
      <div className="bg-card border-b border-border py-4 sticky top-16 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-4">
            <button 
              onClick={() => navigate(-1)}
              className="p-2 hover:bg-muted rounded-full transition-colors"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold tracking-tight">{data.quote.symbol}</h1>
                <div className="flex gap-2">
                  <Badge variant="secondary" className="text-[10px] font-bold uppercase">{data.quote.board}</Badge>
                  <Badge variant="outline" className="text-[10px] font-bold uppercase border-primary/20 text-primary">{data.quote.sector}</Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground font-medium">{data.quote.fullName}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-3 mr-4">
              <button 
                onClick={toggleWatchlist}
                className={`p-2.5 rounded-full border transition-all ${isInWatchlist ? 'bg-red-50 border-red-200 text-red-500' : 'bg-card border-border text-muted-foreground hover:text-red-500 hover:border-red-200'}`}
                title={isInWatchlist ? "Remove from Watchlist" : "Add to Watchlist"}
              >
                <Heart className={`h-5 w-5 ${isInWatchlist ? 'fill-current' : ''}`} />
              </button>
            </div>
            <div className="text-right">
              <div className="text-3xl font-mono font-bold tracking-tight">
                {formatCurrency(data.quote.price)}
              </div>
              <div className={`flex items-center justify-end gap-1.5 font-mono font-bold text-sm ${isPositive ? 'text-green-600' : 'text-red-600'}`}>
                {isPositive ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}
                {isPositive ? '+' : ''}{data.quote.change.toFixed(2)} ({data.quote.changePercent.toFixed(2)}%)
              </div>
            </div>
            <div className="hidden sm:flex flex-col items-end border-l border-border pl-8">
              <div className="flex items-center gap-1.5 mb-1">
                <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Market Open</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">{new Date().toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', hour12: true })} SLT</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            {/* Chart Card */}
            <div 
              ref={fullscreenRef}
              className={`bg-card border border-border rounded-xl p-6 shadow-sm transition-all ${isFullscreen ? 'fixed inset-0 z-[100] rounded-none' : 'relative'}`}
            >
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-sm uppercase tracking-wider">Price Performance</h3>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex bg-muted p-1 rounded-lg gap-1">
                    {['1D', '1W', '1M', '3M', '1Y', 'ALL'].map((range) => (
                      <button 
                        key={range}
                        onClick={() => setTimeframe(range)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${range === timeframe ? 'bg-card shadow-sm text-primary' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        {range}
                      </button>
                    ))}
                  </div>
                  
                  <ToggleGroup 
                    value={[chartType]} 
                    onValueChange={(val) => val?.[0] && setChartType(val[0] as any)}
                    className="bg-muted p-1 rounded-lg"
                  >
                    <ToggleGroupItem 
                      value="line" 
                      aria-label="Line Chart" 
                      className="h-7 w-7 p-0 data-[state=on]:bg-card data-[state=on]:text-primary data-[state=on]:shadow-sm"
                    >
                      <LineIcon className="h-4 w-4" />
                    </ToggleGroupItem>
                    <ToggleGroupItem 
                      value="candle" 
                      aria-label="Candlestick Chart" 
                      className="h-7 w-7 p-0 data-[state=on]:bg-card data-[state=on]:text-primary data-[state=on]:shadow-sm"
                    >
                      <CandlestickIcon className="h-4 w-4" />
                    </ToggleGroupItem>
                  </ToggleGroup>

                  <button 
                    onClick={toggleFullscreen}
                    className="p-2 hover:bg-muted rounded-lg transition-colors text-muted-foreground hover:text-foreground"
                    title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
                  >
                    {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  </button>

                  <button 
                    onClick={() => setUseAdvancedChart(!useAdvancedChart)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border transition-all text-[10px] font-bold uppercase tracking-wider ${useAdvancedChart ? 'bg-primary/10 border-primary/20 text-primary' : 'bg-muted border-transparent text-muted-foreground hover:text-foreground'}`}
                  >
                    <Zap className={`h-3 w-3 ${useAdvancedChart ? 'fill-current' : ''}`} />
                    Advanced
                  </button>
                </div>
              </div>
              
              <div className={`${isFullscreen ? 'h-[calc(100vh-120px)]' : 'h-[450px]'} w-full relative`}>
                {switching && (
                  <div className="absolute inset-0 bg-background/20 backdrop-blur-[1px] z-10 flex items-center justify-center rounded-lg">
                    <div className="bg-card border border-border px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce" />
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:0.2s]" />
                      <div className="h-2 w-2 bg-primary rounded-full animate-bounce [animation-delay:0.4s]" />
                    </div>
                  </div>
                )}
                {useAdvancedChart ? (
                  <AdvancedStockChart symbol={symbol || ''} />
                ) : (
                  <StockChart 
                    symbol={symbol || ''} 
                    data={chartData} 
                    chartType={chartType} 
                    isFullscreen={isFullscreen} 
                  />
                )}
              </div>
            </div>

            {/* Order Book UI */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <Tabs defaultValue="positions" className="w-full">
                <TabsList className="bg-muted/50 border-b border-border w-full justify-start rounded-none h-auto p-0">
                  <TabsTrigger value="positions" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Positions</TabsTrigger>
                  <TabsTrigger value="orders" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Open Orders ({openOrders.length})</TabsTrigger>
                  <TabsTrigger value="history" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Trade History</TabsTrigger>
                </TabsList>
                
                <TabsContent value="positions" className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border">
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider">Ticker</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Qty</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Reserved</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Avg. Price</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Current</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">P/L %</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {positions.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="text-center py-8 text-muted-foreground text-xs">No active positions</TableCell>
                        </TableRow>
                      ) : (
                        positions.map((pos) => {
                          const currentPrice = pos.symbol === symbol ? data?.quote?.price || pos.avgPrice : pos.avgPrice;
                          const plPercent = ((currentPrice - pos.avgPrice) / pos.avgPrice) * 100;
                          return (
                            <TableRow key={pos.id} className="border-border">
                              <TableCell className="font-bold text-xs">{pos.symbol}</TableCell>
                              <TableCell className="text-right font-mono text-xs">{pos.quantity}</TableCell>
                              <TableCell className="text-right font-mono text-xs text-amber-600">{pos.reservedQuantity || 0}</TableCell>
                              <TableCell className="text-right font-mono text-xs">{formatCurrency(pos.avgPrice)}</TableCell>
                              <TableCell className="text-right font-mono text-xs">{formatCurrency(currentPrice)}</TableCell>
                              <TableCell className={`text-right font-mono text-xs font-bold ${plPercent >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {plPercent >= 0 ? '+' : ''}{plPercent.toFixed(2)}%
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="orders" className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border">
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider">Type</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider">Ticker</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Qty</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Limit Price</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {openOrders.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">No open orders</TableCell>
                        </TableRow>
                      ) : (
                        openOrders.map((order) => (
                          <TableRow key={order.id} className="border-border">
                            <TableCell>
                              <Badge variant="outline" className={`text-[8px] font-bold uppercase ${order.type === 'buy' ? 'border-green-200 text-green-600' : 'border-red-200 text-red-600'}`}>
                                {order.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-bold text-xs">{order.symbol}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{order.quantity}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatCurrency(order.limitPrice)}</TableCell>
                            <TableCell className="text-right">
                              <button 
                                onClick={() => cancelOrder(order.id, profile)}
                                className="text-[10px] font-bold text-red-600 hover:underline uppercase"
                              >
                                Cancel
                              </button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>

                <TabsContent value="history" className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow className="hover:bg-transparent border-border">
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider">Date</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider">Type</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider">Ticker</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Qty</TableHead>
                        <TableHead className="text-[10px] font-bold uppercase tracking-wider text-right">Price</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tradeHistory.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground text-xs">No trade history</TableCell>
                        </TableRow>
                      ) : (
                        tradeHistory.map((trade) => (
                          <TableRow key={trade.id} className="border-border">
                            <TableCell className="text-[10px] text-muted-foreground">
                              {new Date(trade.timestamp).toLocaleDateString()}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary" className={`text-[8px] font-bold uppercase ${trade.type === 'buy' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                {trade.type}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-bold text-xs">{trade.symbol}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{trade.quantity}</TableCell>
                            <TableCell className="text-right font-mono text-xs">{formatCurrency(trade.price)}</TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </TabsContent>
              </Tabs>
            </div>

            {/* Details Tabs */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="bg-muted/50 border-b border-border w-full justify-start rounded-none h-auto p-0">
                  <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Overview</TabsTrigger>
                  <TabsTrigger value="financials" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Financials</TabsTrigger>
                  <TabsTrigger value="news" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-6 py-4 font-bold uppercase tracking-wider text-[10px]">Market News</TabsTrigger>
                  <TabsTrigger value="pro" className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-primary px-6 py-4 font-bold uppercase tracking-wider text-[10px] flex items-center gap-2">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" /> Pro Tools
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="overview" className="p-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <div className="space-y-6">
                      <div className="flex items-center gap-2">
                        <Info className="h-4 w-4 text-primary" />
                        <h4 className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Company Profile</h4>
                      </div>
                      <p className="text-sm leading-relaxed text-muted-foreground">
                        {data.quote.fullName} is a premier constituent of the Colombo Exchange. 
                        As a cornerstone of the Sri Lankan economy, it maintains a robust presence across 
                        strategic industrial sectors, driving innovation and sustainable growth.
                      </p>
                      <div className="flex flex-wrap gap-6 pt-2">
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-primary hover:underline cursor-pointer">
                          <Globe className="h-3.5 w-3.5" /> Corporate Website
                        </div>
                        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-green-600">
                          <ShieldCheck className="h-3.5 w-3.5" /> Verified Issuer
                        </div>
                      </div>
                    </div>
                    <div className="space-y-6">
                      <h4 className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Valuation Metrics</h4>
                      <div className="grid grid-cols-2 gap-y-6 gap-x-8">
                        <div>
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">P/E Ratio</div>
                          <div className="font-mono font-bold text-lg">12.4x</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Div. Yield</div>
                          <div className="font-mono font-bold text-lg text-green-600">4.2%</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">EPS (TTM)</div>
                          <div className="font-mono font-bold text-lg">LKR 18.50</div>
                        </div>
                        <div>
                          <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Beta</div>
                          <div className="font-mono font-bold text-lg">1.05</div>
                        </div>
                      </div>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="financials" className="p-8">
                  {isPro ? (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <div className="space-y-1">
                          <h4 className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Financial Intelligence</h4>
                          <p className="text-xs text-muted-foreground">Access official filings and AI-powered report discovery.</p>
                        </div>
                        <Badge variant="outline" className="text-[8px] font-bold border-green-200 text-green-600">PRO ACCESS</Badge>
                      </div>

                      {/* AI Deep Search Section */}
                      <div className="p-6 rounded-2xl bg-primary/5 border border-primary/10 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                          <Search className="h-24 w-24 -rotate-12" />
                        </div>
                        <div className="relative z-10">
                          <div className="flex items-center gap-2 mb-4">
                            <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
                              <Globe className="h-4 w-4" />
                            </div>
                            <h5 className="font-bold text-sm">AI Report Discovery</h5>
                          </div>
                          <p className="text-xs text-muted-foreground mb-6 max-w-md">
                            Can't find the latest report? Our AI can search the web and company portals to find the most recent official PDF for you.
                          </p>
                          
                          {searchResult ? (
                            <motion.div 
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="flex items-center justify-between p-4 bg-card border border-primary/20 rounded-xl shadow-sm"
                            >
                              <div className="flex items-center gap-3">
                                <div className="h-10 w-10 rounded-lg bg-green-50 flex items-center justify-center text-green-600">
                                  <FileText className="h-5 w-5" />
                                </div>
                                <div>
                                  <div className="text-sm font-bold text-primary">{searchResult.title}</div>
                                  <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Discovered via AI Deep Search</div>
                                </div>
                              </div>
                              <a 
                                href={searchResult.link} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="p-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </a>
                            </motion.div>
                          ) : (
                            <button 
                              onClick={handleDeepSearch}
                              disabled={searchingReport}
                              className="flex items-center gap-2 px-6 py-2.5 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/20"
                            >
                              {searchingReport ? (
                                <>
                                  <div className="h-3 w-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                  Searching Web...
                                </>
                              ) : (
                                <>
                                  <Search className="h-3.5 w-3.5" />
                                  Search Latest Annual Report
                                </>
                              )}
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="space-y-6">
                        <h4 className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Recent Filings (CSE)</h4>
                        {loadingReports ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-20 w-full" />)}
                          </div>
                        ) : reports.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {reports.map((report, i) => (
                              <a 
                                key={i} 
                                href={report.link}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center justify-between p-4 rounded-xl border border-border hover:bg-muted/50 transition-all group cursor-pointer"
                              >
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 rounded-lg bg-red-50 flex items-center justify-center text-red-500">
                                    <FileText className="h-5 w-5" />
                                  </div>
                                  <div>
                                    <div className="text-sm font-bold group-hover:text-primary transition-colors line-clamp-1">{report.title}</div>
                                    <div className="text-[10px] text-muted-foreground font-medium">{report.date} • {report.size}</div>
                                  </div>
                                </div>
                                <ExternalLink className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                              </a>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-12 bg-muted/20 rounded-xl border border-dashed border-border">
                            <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-3" />
                            <p className="text-xs text-muted-foreground">No recent financial reports found for this symbol.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
                      <Lock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                      <h4 className="font-bold text-sm mb-2">Pro Feature: Financial Reports</h4>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-6">Upgrade to Pro to access full PDF financial statements, interim reports, and historical filings directly on this page.</p>
                      <button 
                        onClick={() => {
                          setWaitlistTier('pro');
                          setShowWaitlist(true);
                        }}
                        className="px-6 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-all"
                      >
                        Upgrade to Pro
                      </button>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="news" className="p-8">
                  {isPro ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                      <div className="md:col-span-2 space-y-6">
                        <h4 className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Recent News & Disclosures</h4>
                        <div className="space-y-6">
                          {[
                            { title: 'Appointment of New Independent Director', date: '2 hours ago', source: 'CSE.lk', type: 'Disclosure', link: 'https://www.cse.lk/home/company-announcements', description: 'The Board of Directors has approved the appointment of Mr. Sarath Kumara as an Independent Non-Executive Director with immediate effect.' },
                            { title: 'Quarterly Financial Results Analysis', date: '1 day ago', source: 'Daily FT', type: 'News', link: 'https://www.ft.lk/financial-services/54', description: 'Revenue grew by 15% YoY despite macroeconomic challenges, driven by strong performance in the export segment.' },
                            { title: 'Expansion into Renewable Energy Sector', date: '3 days ago', source: 'Daily FT', type: 'News', link: 'https://www.ft.lk/business/34', description: 'The company is set to invest LKR 500 million in a new solar power project in the North-Central province.' },
                          ].map((news, i) => (
                            <a 
                              key={i} 
                              href={news.link}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block pb-6 border-b border-border last:border-0 group"
                            >
                              <div className="flex items-center gap-2 mb-2">
                                <Badge variant="secondary" className="text-[8px] font-bold uppercase tracking-tighter">{news.type}</Badge>
                                <span className="text-[10px] font-bold text-muted-foreground uppercase">{news.source} • {news.date}</span>
                              </div>
                              <h5 className="font-bold text-sm group-hover:text-primary transition-colors mb-2">{news.title}</h5>
                              <p className="text-xs text-muted-foreground leading-relaxed mb-4">{news.description || "The company announced today a strategic shift in its operational focus, aiming to capitalize on emerging market trends..."}</p>
                              
                              {aiInsight && i === 0 ? (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0 }}
                                  animate={{ opacity: 1, height: 'auto' }}
                                  className="p-4 bg-primary/5 border border-primary/10 rounded-xl mb-4 space-y-4"
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <Sparkles className="h-3.5 w-3.5 text-primary" />
                                      <span className="text-[10px] font-bold uppercase tracking-widest text-primary">AI Intelligence Hub</span>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] font-bold uppercase text-muted-foreground">Risk Rating:</span>
                                      <Badge 
                                        variant="outline" 
                                        className={`text-[8px] font-bold ${
                                          aiInsight.riskRating === 'Low' ? 'border-green-200 text-green-600' :
                                          aiInsight.riskRating === 'Medium' ? 'border-yellow-200 text-yellow-600' :
                                          'border-red-200 text-red-600'
                                        }`}
                                      >
                                        {aiInsight.riskRating.toUpperCase()}
                                      </Badge>
                                    </div>
                                  </div>

                                  <ul className="space-y-2">
                                    {aiInsight.bullets.map((bullet, idx) => (
                                      <li key={idx} className="text-xs text-muted-foreground flex gap-2">
                                        <span className="text-primary font-bold">•</span> {bullet}
                                      </li>
                                    ))}
                                  </ul>

                                  <div className="pt-3 border-t border-primary/10">
                                    <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Dividend Impact</div>
                                    <p className="text-xs text-muted-foreground italic">"{aiInsight.dividendImpact}"</p>
                                  </div>
                                </motion.div>
                              ) : (
                                <button 
                                  onClick={(e) => {
                                    e.preventDefault();
                                    handleSummarize(news.title + ". " + (news.description || ""));
                                  }}
                                  disabled={summarizing}
                                  className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg text-[10px] font-bold hover:bg-primary/20 transition-all disabled:opacity-50"
                                >
                                  {summarizing ? (
                                    <>
                                      <div className="h-2 w-2 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                                      Summarizing...
                                    </>
                                  ) : (
                                    <>
                                      <Sparkles className="h-3 w-3" />
                                      AI Summarize
                                    </>
                                  )}
                                </button>
                              )}
                            </a>
                          ))}
                        </div>
                      </div>
                      <div className="space-y-6">
                        <h4 className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">CSE Disclosures</h4>
                        <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-4">
                          {[
                            'Director Resignation: Mr. A. Perera',
                            'Dividend Announcement: LKR 2.50',
                            'Annual General Meeting Notice',
                            'Change in Directorate'
                          ].map((disc, i) => (
                            <div key={i} className="flex items-start gap-3 group cursor-pointer">
                              <div className="h-1.5 w-1.5 rounded-full bg-primary mt-1.5 flex-shrink-0" />
                              <span className="text-xs font-medium group-hover:text-primary transition-colors">{disc}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
                      <Lock className="h-10 w-10 text-muted-foreground/30 mx-auto mb-4" />
                      <h4 className="font-bold text-sm mb-2">Pro Feature: Market News & Disclosures</h4>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-6">Upgrade to Pro to view company-specific news, regulatory disclosures, and real-time market announcements.</p>
                      <button 
                        onClick={() => {
                          setWaitlistTier('pro');
                          setShowWaitlist(true);
                        }}
                        className="px-6 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-all"
                      >
                        Upgrade to Pro
                      </button>
                    </div>
                  )}
                </TabsContent>
                <TabsContent value="pro" className="p-8">
                  {isPro ? (
                    <div className="space-y-8">
                      <div className="flex items-center justify-between">
                        <h4 className="font-bold uppercase text-[10px] tracking-widest text-muted-foreground">Advanced Technical Indicators</h4>
                        <Badge className="bg-yellow-400 text-yellow-900 border-none font-bold text-[8px]">PRO ACTIVE</Badge>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
                          <h5 className="font-bold text-sm mb-4 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-primary" /> Moving Averages (SMA/EMA)
                          </h5>
                          <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">SMA (50)</span>
                              <span className="font-mono font-bold">LKR 142.50</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">SMA (200)</span>
                              <span className="font-mono font-bold">LKR 138.20</span>
                            </div>
                            <div className="pt-2 border-t border-border">
                              <div className="text-[10px] font-bold text-green-600 uppercase">Golden Cross Detected</div>
                            </div>
                          </div>
                        </div>
                        <div className="p-6 rounded-2xl border border-border bg-card shadow-sm">
                          <h5 className="font-bold text-sm mb-4 flex items-center gap-2">
                            <Activity className="h-4 w-4 text-primary" /> Oscillators (RSI/MACD)
                          </h5>
                          <div className="space-y-3">
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">RSI (14)</span>
                              <span className="font-mono font-bold">54.2 (Neutral)</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-muted-foreground">MACD Signal</span>
                              <span className="font-mono font-bold text-green-600">Bullish Divergence</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-20 bg-muted/20 rounded-xl border border-dashed border-border">
                      <Star className="h-10 w-10 text-yellow-400/30 mx-auto mb-4" />
                      <h4 className="font-bold text-sm mb-2">Pro Feature: Advanced Analytics</h4>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto mb-6">Unlock professional charting tools, automated technical signals, and deep-dive valuation models.</p>
                      <button 
                        onClick={() => {
                          setWaitlistTier('pro');
                          setShowWaitlist(true);
                        }}
                        className="px-6 py-2 bg-primary text-white rounded-lg text-xs font-bold hover:bg-primary/90 transition-all"
                      >
                        Upgrade to Pro
                      </button>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </div>
          </div>

          <div className="space-y-8">
            {/* Mock Money Engine Card */}
            <div id="trading-desk" className="bg-card border border-border rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <h3 className="font-bold text-sm uppercase tracking-wider">Mock Money Engine</h3>
                </div>
                <Badge variant="outline" className="text-[8px] font-bold border-primary/20 text-primary uppercase">Virtual Trading</Badge>
              </div>

              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-2 p-1 bg-muted rounded-lg">
                  <button 
                    onClick={() => setTradeType('buy')}
                    className={`py-2 text-[10px] font-bold rounded-md transition-all ${tradeType === 'buy' ? 'bg-green-600 text-white shadow-lg shadow-green-600/20' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    BUY
                  </button>
                  <button 
                    onClick={() => setTradeType('sell')}
                    className={`py-2 text-[10px] font-bold rounded-md transition-all ${tradeType === 'sell' ? 'bg-red-600 text-white shadow-lg shadow-red-600/20' : 'text-muted-foreground hover:text-foreground'}`}
                  >
                    SELL
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">Order Type</span>
                    <ToggleGroup 
                      value={[orderType]} 
                      onValueChange={(val) => val?.[0] && setOrderType(val[0] as any)}
                      className="bg-muted p-1 rounded-lg"
                    >
                      <ToggleGroupItem value="market" className="text-[10px] h-7 px-3 data-[state=on]:bg-card data-[state=on]:text-primary">Market</ToggleGroupItem>
                      <ToggleGroupItem value="limit" className="text-[10px] h-7 px-3 data-[state=on]:bg-card data-[state=on]:text-primary">Limit</ToggleGroupItem>
                    </ToggleGroup>
                  </div>

                  {orderType === 'limit' && (
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                        <span>Limit Price</span>
                        <span>LKR</span>
                      </div>
                      <input 
                        type="number" 
                        value={limitPrice}
                        onChange={(e) => setLimitPrice(Number(e.target.value))}
                        className="w-full bg-muted border border-border rounded-lg px-4 py-2 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <div className="flex justify-between text-[10px] font-bold uppercase text-muted-foreground">
                      <span>Quantity</span>
                      <span className="flex items-center gap-1">
                        {tradeType === 'sell' && (
                          <span className="text-amber-600">Sellable: {sellableQuantity}</span>
                        )}
                        <span>Shares</span>
                      </span>
                    </div>
                    <input 
                      type="number" 
                      value={tradeQuantity}
                      onChange={(e) => setTradeQuantity(Math.max(1, parseInt(e.target.value) || 0))}
                      className="w-full bg-muted border border-border rounded-lg px-4 py-2 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                    />
                  </div>
                </div>

                <div className="pt-2 space-y-2">
                  <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                    <span>Est. Price</span>
                    <span className="font-mono">{formatCurrency(orderType === 'limit' ? limitPrice : data.quote.price)}</span>
                  </div>
                  <div className="flex justify-between text-[10px] font-medium text-muted-foreground">
                    <span>Commission (0.112%)</span>
                    <span className="font-mono">{formatCurrency(tradeQuantity * (orderType === 'limit' ? limitPrice : data.quote.price) * 0.00112)}</span>
                  </div>
                  <div className="flex justify-between text-xs font-bold text-primary pt-2 border-t border-border">
                    <span>Total {tradeType === 'buy' ? 'Cost' : 'Credit'}</span>
                    <span className="font-mono">{formatCurrency(tradeQuantity * (orderType === 'limit' ? limitPrice : data.quote.price) * (tradeType === 'buy' ? 1.00112 : 0.99888))}</span>
                  </div>
                </div>

                <button 
                  onClick={handleTrade}
                  disabled={executingTrade || !profile || (tradeType === 'sell' && sellableQuantity <= 0)}
                  className={`w-full py-3 rounded-xl font-bold text-xs transition-all flex items-center justify-center gap-2 shadow-lg ${
                    tradeType === 'buy' 
                      ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-600/20' 
                      : 'bg-red-600 hover:bg-red-700 text-white shadow-red-600/20'
                  } disabled:opacity-50`}
                >
                  {executingTrade ? (
                    <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  ) : (
                    <>
                      {tradeType === 'buy' 
                        ? `PLACE BUY ${orderType.toUpperCase()} ORDER` 
                        : (sellableQuantity <= 0 ? 'NO HOLDINGS TO SELL' : `PLACE SELL ${orderType.toUpperCase()} ORDER`)}
                    </>
                  )}
                </button>

                <AnimatePresence>
                  {tradeFeedback && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className={`p-4 rounded-xl border flex gap-3 ${
                        tradeFeedback.success ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
                      }`}
                    >
                      {tradeFeedback.success ? <CheckCircle2 className="h-5 w-5 shrink-0" /> : <AlertCircle className="h-5 w-5 shrink-0" />}
                      <div className="space-y-1">
                        <div className="text-[10px] font-bold uppercase tracking-wider">
                          {tradeFeedback.success ? 'Order Confirmation' : 'Trade Error'}
                        </div>
                        <p className="text-xs leading-relaxed font-medium italic">
                          "{tradeFeedback.message}"
                        </p>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Market Stats Card */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 bg-muted/30 border-b border-border">
                <h3 className="font-bold text-xs uppercase tracking-widest">Market Statistics</h3>
              </div>
              <div className="p-6 space-y-4">
                {[
                  { label: 'Market Cap', value: formatCompact(data.quote.marketCap) },
                  { label: 'Day Range', value: `${data.quote.low.toFixed(2)} - ${data.quote.high.toFixed(2)}` },
                  { label: 'Volume', value: formatCompact(data.quote.volume) },
                  { label: 'Open', value: data.quote.open.toFixed(2) },
                  { label: 'Prev Close', value: data.quote.prevClose.toFixed(2) },
                ].map((stat, i) => (
                  <div key={i} className="flex justify-between items-center pb-3 border-b border-border last:border-0 last:pb-0">
                    <span className="text-[10px] font-bold uppercase text-muted-foreground">{stat.label}</span>
                    <span className="font-mono font-bold text-sm">{stat.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Technical Analysis Card */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 bg-muted/30 border-b border-border">
                <h3 className="font-bold text-xs uppercase tracking-widest">Technical Analysis</h3>
              </div>
              <div className="p-6 space-y-5">
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">RSI (14)</span>
                  <Badge variant="secondary" className="bg-orange-100 text-orange-700 border-orange-200 font-bold">Neutral (54)</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">MACD</span>
                  <Badge variant="secondary" className="bg-green-100 text-green-700 border-green-200 font-bold">Bullish</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase text-muted-foreground">SMA (50)</span>
                  <span className="font-mono font-bold text-xs">LKR 142.50</span>
                </div>
                <div className="pt-4 border-t border-border">
                  <div className="text-[10px] font-bold uppercase text-muted-foreground mb-2">Overall Sentiment</div>
                  <div className="h-2 w-full bg-muted rounded-full overflow-hidden flex">
                    <div className="h-full bg-green-500 w-[65%]" />
                    <div className="h-full bg-orange-400 w-[20%]" />
                    <div className="h-full bg-red-500 w-[15%]" />
                  </div>
                  <div className="flex justify-between mt-1 text-[8px] font-bold uppercase opacity-60">
                    <span>Buy</span>
                    <span>Hold</span>
                    <span>Sell</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* Waitlist Modal */}
      <AnimatePresence>
        {showWaitlist && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-card border border-border w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-8">
                <div className="h-16 w-16 bg-primary/10 rounded-2xl flex items-center justify-center mb-6">
                  <Zap className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-2xl font-bold mb-2">Join the {waitlistTier.toUpperCase()} Waitlist</h3>
                <p className="text-muted-foreground text-sm mb-8">
                  We're currently in Public Beta with simulated data. Real-time CSE integration and AI features are rolling out soon to Pro users.
                </p>

                <form onSubmit={handleWaitlist} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground ml-1">Email Address</label>
                    <input 
                      type="email" 
                      required
                      value={waitlistEmail}
                      onChange={(e) => setWaitlistEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="w-full bg-muted/50 border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                  </div>
                  <button 
                    type="submit"
                    disabled={waitlistLoading}
                    className="w-full bg-primary text-white font-bold py-4 rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 disabled:opacity-50"
                  >
                    {waitlistLoading ? 'Joining...' : `Get Early Access to ${waitlistTier.toUpperCase()}`}
                  </button>
                  <button 
                    type="button"
                    onClick={() => setShowWaitlist(false)}
                    className="w-full text-muted-foreground text-xs font-bold py-2 hover:text-foreground transition-colors"
                  >
                    Maybe Later
                  </button>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
