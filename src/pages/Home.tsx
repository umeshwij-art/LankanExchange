import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ArrowUpRight, ArrowDownRight, Activity, Clock, Lock, Unlock, TrendingUp, BarChart3, Globe, X, Newspaper, Trophy } from "lucide-react";
import { Leaderboard } from "../components/Leaderboard";
import { SimulatorStatus } from "../components/SimulatorStatus";
import { PortfolioBanner } from "../components/PortfolioBanner";
import { Input } from "@/components/ui/input";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const MOCK_ASPI_DATA = [
  { time: '09:30', value: 12410 },
  { time: '10:00', value: 12425 },
  { time: '10:30', value: 12415 },
  { time: '11:00', value: 12435 },
  { time: '11:30', value: 12455 },
  { time: '12:00', value: 12445 },
  { time: '12:30', value: 12460 },
  { time: '13:00', value: 12475 },
  { time: '13:30', value: 12465 },
  { time: '14:00', value: 12485 },
  { time: '14:30', value: 12450 },
];
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../lib/AuthContext";

interface Stock {
  symbol: string;
  fullName: string;
  price: number;
  change: number;
  changePercent: number;
  currency: string;
  marketCap: number;
  sector: string;
  board: string;
}

interface SearchResult {
  symbol: string;
  name: string;
}

export default function Home() {
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [selectedSector, setSelectedSector] = useState("All Sectors");
  const [selectedBoard, setSelectedBoard] = useState("All Boards");
  const [marketStatus, setMarketStatus] = useState<any>(null);
  const navigate = useNavigate();
  const { profile } = useAuth();

  const sectors = ["All Sectors", ...Array.from(new Set(stocks.map(s => s.sector))).sort()];
  const boards = ["All Boards", ...Array.from(new Set(stocks.map(s => s.board))).sort()];

  const filteredStocks = stocks.filter(s => 
    (selectedSector === "All Sectors" || s.sector === selectedSector) &&
    (selectedBoard === "All Boards" || s.board === selectedBoard)
  ).slice(0, 15);

  useEffect(() => {
    fetch("/api/stocks/top", {
      headers: {
        'x-user-tier': profile?.tier || 'free'
      }
    })
      .then((res) => res.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setStocks(data);
        } else {
          console.warn("Top stocks data is not an array:", data);
          setStocks([]);
        }
        setLoading(false);
      })
      .catch((err) => {
        console.error(err);
        setLoading(false);
      });

    fetch("/api/market-status")
      .then((res) => res.json())
      .then((data) => setMarketStatus(data))
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(() => {
      setSearching(true);
      fetch(`/api/stocks/search?q=${searchQuery}`)
        .then((res) => res.json())
        .then((data) => {
          setSearchResults(data);
          setSearching(false);
        })
        .catch(() => setSearching(false));
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

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

  return (
    <div className="min-h-screen bg-background">
      {/* Market Ticker Bar */}
      <div className="bg-card border-b border-border py-2 overflow-hidden relative">
        <div className="flex items-center gap-8 [--duration:40s] [--gap:2rem] animate-marquee">
          {/* Static Indices */}
          <div className="flex items-center gap-2 border-r border-border pr-8 shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ASPI</span>
            <span className="text-sm font-mono font-bold">12,450.20</span>
            <span className="text-[10px] font-bold text-green-500">+0.45%</span>
          </div>
          <div className="flex items-center gap-2 border-r border-border pr-8 shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">S&P SL20</span>
            <span className="text-sm font-mono font-bold">3,680.15</span>
            <span className="text-[10px] font-bold text-green-500">+1.24%</span>
          </div>

          {/* Dynamic Stocks */}
          {stocks.slice(0, 20).map((stock) => (
            <div key={stock.symbol} className="flex items-center gap-2 border-r border-border pr-8 shrink-0 cursor-pointer hover:text-primary transition-colors" onClick={() => navigate(`/stock/${stock.symbol}`)}>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stock.symbol}</span>
              <span className="text-sm font-mono font-bold">{stock.price.toFixed(2)}</span>
              <span className={`text-[10px] font-bold ${stock.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </span>
            </div>
          ))}

          {/* Duplicate for seamless loop */}
          <div className="flex items-center gap-2 border-r border-border pr-8 shrink-0">
            <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ASPI</span>
            <span className="text-sm font-mono font-bold">12,450.20</span>
            <span className="text-[10px] font-bold text-green-500">+0.45%</span>
          </div>
          {stocks.slice(0, 20).map((stock) => (
            <div key={`${stock.symbol}-dup`} className="flex items-center gap-2 border-r border-border pr-8 shrink-0 cursor-pointer hover:text-primary transition-colors" onClick={() => navigate(`/stock/${stock.symbol}`)}>
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">{stock.symbol}</span>
              <span className="text-sm font-mono font-bold">{stock.price.toFixed(2)}</span>
              <span className={`text-[10px] font-bold ${stock.change >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                {stock.change >= 0 ? '+' : ''}{stock.changePercent.toFixed(2)}%
              </span>
            </div>
          ))}
        </div>

        {marketStatus && (
          <div className="absolute right-0 top-0 bottom-0 bg-card/95 backdrop-blur-sm pl-4 pr-4 flex items-center gap-2 z-10 border-l border-border">
            <div className={`h-2 w-2 rounded-full ${marketStatus.status.toLowerCase().includes('open') ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {marketStatus.status} • {new Date().toLocaleTimeString('en-LK', { hour: '2-digit', minute: '2-digit', hour12: true })} SLT
            </span>
          </div>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Main Content */}
          <div className="lg:col-span-3 space-y-8">
            {/* Hero Section */}
            <div id="main-chart" className="bg-card border border-border rounded-xl p-8 shadow-sm relative overflow-hidden">
              <div className="absolute top-0 right-0 w-1/2 h-full opacity-20 pointer-events-none">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={MOCK_ASPI_DATA}>
                    <defs>
                      <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Area 
                      type="monotone" 
                      dataKey="value" 
                      stroke="#0ea5e9" 
                      fillOpacity={1} 
                      fill="url(#colorValue)" 
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-4">
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-500 border-emerald-500/20 text-[10px] font-bold uppercase tracking-widest">
                    Live Market Pulse
                  </Badge>
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">ASPI: 12,450.20 (+0.45%)</span>
                </div>
                <h1 className="text-4xl font-bold tracking-tight mb-2">
                  Colombo <span className="text-primary">Exchange</span>
                </h1>
                <p className="text-muted-foreground max-w-xl mb-8">
                  Professional-grade market data, technical analysis, and screening tools for the Sri Lankan equity market.
                </p>
                
                <div className="max-w-xl relative">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input 
                    placeholder="Search symbols or companies..." 
                    className="h-12 pl-12 pr-12 text-base rounded-lg border-border bg-muted/50 focus-visible:ring-primary/20 focus-visible:border-primary transition-all"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setSearchQuery("");
                        setSearchResults([]);
                      }}
                      className="absolute right-4 top-1/2 -translate-y-1/2 p-1 hover:bg-muted rounded-full text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </button>
                  )}
                  
                  {searchQuery.length >= 2 && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-card border border-border rounded-lg z-50 shadow-2xl overflow-hidden">
                      {searching ? (
                        <div className="p-4 text-center text-sm text-muted-foreground">Searching...</div>
                      ) : searchResults.length > 0 ? (
                        searchResults.map((res) => (
                          <button
                            key={res.symbol}
                            onClick={() => navigate(`/stock/${res.symbol}`)}
                            className="w-full p-4 text-left hover:bg-muted transition-colors border-b border-border last:border-0 flex justify-between items-center group"
                          >
                            <div>
                              <span className="font-mono font-bold text-primary group-hover:underline">{res.symbol}</span>
                              <span className="ml-3 text-sm text-muted-foreground">{res.name}</span>
                            </div>
                            <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" />
                          </button>
                        ))
                      ) : (
                        <div className="p-4 text-center text-sm text-muted-foreground">No results found</div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Market Leaders Section */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Activity className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">Market Leaders</h2>
                    <p className="text-xs text-muted-foreground">Top gainers and active movers</p>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center gap-3">
                  <select 
                    className="bg-muted border border-transparent rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary transition-all"
                    value={selectedSector}
                    onChange={(e) => setSelectedSector(e.target.value)}
                  >
                    {sectors.map(sector => (
                      <option key={sector} value={sector}>{sector}</option>
                    ))}
                  </select>

                  <select 
                    className="bg-muted border border-transparent rounded-lg px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-primary transition-all"
                    value={selectedBoard}
                    onChange={(e) => setSelectedBoard(e.target.value)}
                  >
                    {boards.map(board => (
                      <option key={board} value={board}>{board}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-muted/30">
                      <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Symbol</th>
                      <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Price</th>
                      <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Change</th>
                      <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">% Change</th>
                      <th className="p-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Market Cap</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      Array(10).fill(0).map((_, i) => (
                        <tr key={i} className="border-b border-border">
                          <td colSpan={5} className="p-4"><Skeleton className="h-6 w-full" /></td>
                        </tr>
                      ))
                    ) : filteredStocks.length > 0 ? (
                      filteredStocks.map((stock) => (
                        <tr 
                          key={stock.symbol} 
                          className="border-b border-border hover:bg-slate-700/50 transition-colors cursor-pointer group"
                          onClick={() => navigate(`/stock/${stock.symbol}`)}
                        >
                          <td className="p-4">
                            <div className="flex flex-col">
                              <span className="font-mono font-bold text-primary group-hover:underline">{stock.symbol}</span>
                              <span className="text-[10px] text-muted-foreground uppercase truncate max-w-[120px]">{stock.sector}</span>
                            </div>
                          </td>
                          <td className="p-4 font-mono font-bold">{formatCurrency(stock.price)}</td>
                          <td className={`p-4 font-mono font-bold ${stock.change >= 0 ? 'price-up' : 'price-down'}`}>
                            {stock.change >= 0 ? '+' : ''}{stock.change.toFixed(2)}
                          </td>
                          <td className="p-4">
                            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded font-mono font-bold text-xs ${stock.changePercent >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                              {stock.changePercent >= 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                              {Math.abs(stock.changePercent).toFixed(2)}%
                            </div>
                          </td>
                          <td className="p-4 font-mono text-muted-foreground">{formatCompact(stock.marketCap)}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={5} className="p-12 text-center text-muted-foreground italic">
                          No stocks found matching your criteria
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
            {/* News Feed Section */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-6 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 p-2 rounded-lg">
                    <Newspaper className="h-5 w-5 text-primary" />
                  </div>
                  <h2 className="text-lg font-bold">Latest Market News</h2>
                </div>
                <button 
                  onClick={() => navigate('/news')}
                  className="text-[10px] font-bold uppercase tracking-widest text-primary hover:underline"
                >
                  View All
                </button>
              </div>
              <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                {[
                  { title: "CSE sees steady growth in retail participation", source: "Daily FT", date: "2 hours ago", link: "https://www.ft.lk/financial-services/54" },
                  { title: "Banking sector resilience remains strong amidst economic shifts", source: "Daily FT", date: "5 hours ago", link: "https://www.ft.lk/business/34" }
                ].map((item, i) => (
                  <a 
                    key={i} 
                    href={item.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group p-4 rounded-xl border border-border hover:border-primary/20 hover:bg-muted/30 transition-all"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[9px] font-bold uppercase tracking-widest text-primary">{item.source}</span>
                      <span className="text-[9px] font-bold text-muted-foreground">• {item.date}</span>
                    </div>
                    <h3 className="text-sm font-bold group-hover:text-primary transition-colors line-clamp-2">{item.title}</h3>
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-8">
            {/* Simulator Engine Status */}
            <SimulatorStatus />

            {/* Leaderboard Card */}
            <div className="bg-card border border-border rounded-xl shadow-sm overflow-hidden">
              <div className="p-5 bg-muted/30 border-b border-border flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-yellow-500" />
                  <h3 className="font-bold text-xs uppercase tracking-widest">Top Traders (ROI)</h3>
                </div>
                <Badge variant="outline" className="text-[8px] font-bold border-primary/20 text-primary">PUBLIC BETA</Badge>
              </div>
              <div className="p-4">
                <Leaderboard />
              </div>
            </div>

            {/* Market Summary Card */}
            <div className="bg-primary text-white rounded-xl p-6 shadow-lg shadow-primary/20">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-sm font-bold uppercase tracking-widest opacity-80">Market Summary</h3>
                <BarChart3 className="h-5 w-5 opacity-80" />
              </div>
              
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/10 rounded-lg p-3">
                    <span className="text-[9px] uppercase font-bold opacity-60 block mb-1">Gainers</span>
                    <span className="text-xl font-mono font-bold text-green-300">{marketStatus?.gainers || 0}</span>
                  </div>
                  <div className="bg-white/10 rounded-lg p-3">
                    <span className="text-[9px] uppercase font-bold opacity-60 block mb-1">Losers</span>
                    <span className="text-xl font-mono font-bold text-red-300">{marketStatus?.losers || 0}</span>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="opacity-60">Unchanged</span>
                    <span className="font-mono font-bold">{marketStatus?.unchanged || 0}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="opacity-60">Turnover</span>
                    <span className="font-mono font-bold">{formatCompact(marketStatus?.totalTurnover || 0)}</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-white/10">
                  <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest ${marketStatus?.status.toLowerCase().includes('open') ? 'bg-green-500 text-white' : 'bg-red-500 text-white'}`}>
                    {marketStatus?.status.toLowerCase().includes('open') ? <Unlock className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    {marketStatus?.status}
                  </div>
                </div>
              </div>
            </div>

            {/* Top Gainers Sidebar */}
            <div className="bg-card border border-border rounded-xl shadow-sm p-6">
              <div className="flex items-center gap-2 mb-6">
                <TrendingUp className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-bold uppercase tracking-widest">Top Gainers</h3>
              </div>
              <div className="space-y-4">
                {stocks.sort((a, b) => b.changePercent - a.changePercent).slice(0, 5).map(stock => (
                  <div 
                    key={stock.symbol} 
                    className="flex justify-between items-center group cursor-pointer" 
                    onClick={() => navigate(`/stock/${stock.symbol}`)}
                  >
                    <div>
                      <div className="font-mono font-bold text-primary group-hover:underline">{stock.symbol}</div>
                      <div className="text-[10px] text-muted-foreground uppercase truncate max-w-[100px]">{stock.fullName}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-mono font-bold text-green-600">+{stock.changePercent.toFixed(2)}%</div>
                      <div className="text-[10px] text-muted-foreground">{formatCurrency(stock.price)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Educational Card */}
            <div className="bg-muted/50 border border-border rounded-xl p-6">
              <h4 className="text-xs font-bold uppercase tracking-widest mb-3">About the Exchange</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                The Colombo Exchange is the main stock exchange in Sri Lanka. 
                It is one of the most modern exchanges in South Asia, providing a fully automated trading platform.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
