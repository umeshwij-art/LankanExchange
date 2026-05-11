import React, { useState, useEffect, useMemo } from "react";
import { 
  Newspaper, 
  ExternalLink, 
  Clock, 
  Activity, 
  Sparkles, 
  Zap, 
  FileText, 
  Download, 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown,
  ChevronRight,
  Info,
  Briefcase
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "../lib/AuthContext";
import { motion } from "motion/react";
import { GoogleGenAI, Type } from "@google/genai";
import { Badge } from "@/components/ui/badge";
import { Helmet } from "react-helmet-async";
import { cn } from "@/lib/utils";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "../lib/firebase";

interface NewsItem {
  id: string;
  title: string;
  link: string;
  date: string;
  summary: string;
  source: string;
  symbol?: string;
  sector?: string;
  sentiment?: 'bullish' | 'bearish' | 'neutral';
  aiBullets?: string[];
  trend?: number[]; // Mock sparkline data
  detectedCategory?: string;
}

interface Disclosure {
  id: string;
  symbol: string;
  title: string;
  type: string;
  date: string;
  pdfUrl: string | null;
  impactAnalysis?: {
    revenue: string;
    risk: string;
    tone: string;
  };
}

const CATEGORIES = ["All", "Banking", "Energy", "Consumer", "Manufacturing", "Real Estate", "General"];

export default function News() {
  const [news, setNews] = useState<NewsItem[]>([]);
  const [disclosures, setDisclosures] = useState<Disclosure[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [filterPortfolio, setFilterPortfolio] = useState(false);
  const [userHoldings, setUserHoldings] = useState<string[]>([]);
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [summaries, setSummaries] = useState<Record<string, any>>({});
  
  const { profile, user } = useAuth();
  const isPro = profile?.tier === 'pro' || profile?.tier === 'ultimate';

  const mockSparkline = () => Array.from({ length: 10 }, () => Math.floor(Math.random() * 100));

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (user) {
          const posRef = collection(db, 'positions');
          const q = query(posRef, where('uid', '==', user.uid));
          const snap = await getDocs(q);
          const holdings = snap.docs.map(doc => doc.data().symbol);
          setUserHoldings(holdings);
        }

        const annRes = await fetch("/api/announcements");
        const annData = await annRes.json();
        if (Array.isArray(annData)) {
          setDisclosures(annData.map((a: any) => ({
            ...a,
            id: a.id || Math.random().toString(36).substr(2, 9)
          })));
        } else {
          console.warn("Announcements data is not an array:", annData);
          setDisclosures([]);
        }

        const newsRes = await fetch("/api/news");
        const newsData = await newsRes.json();
        
        if (Array.isArray(newsData)) {
          const enhancedNews = newsData.map((item: any, idx: number) => ({
            ...item,
            id: item.id || `news-${idx}`,
            summary: item.contentSnippet || item.summary || '',
            trend: mockSparkline()
          }));
          setNews(enhancedNews);
        } else {
          console.warn("News data is not an array:", newsData);
          setNews([]);
        }

      } catch (err) {
        console.error("Terminal Data Fetch Error:", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [user]);

  const filteredNews = useMemo(() => {
    return news.filter(item => {
      const matchesSearch = item.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            item.symbol?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            item.detectedCategory?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPortfolio = !filterPortfolio || (item.symbol && userHoldings.includes(item.symbol));
      const matchesCategory = selectedCategory === "All" || item.detectedCategory === selectedCategory;
      return matchesSearch && matchesPortfolio && matchesCategory;
    });
  }, [news, searchQuery, filterPortfolio, userHoldings, selectedCategory]);

  const handleDeepDive = async (disclosure: Disclosure) => {
    if (!process.env.GEMINI_API_KEY) return;
    setAnalyzingId(disclosure.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Act as a senior financial analyst. Perform a "3-Point Impact Analysis" on this CSE disclosure: "${disclosure.title}". 
        Focus on:
        1. Impact on Revenue (High/Medium/Low with reason)
        2. Risk Level (Assessment of potential downsides)
        3. Management Tone (Confident/Cautious/Neutral)
        
        Return in JSON format.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              revenue: { type: Type.STRING },
              risk: { type: Type.STRING },
              tone: { type: Type.STRING }
            },
            required: ["revenue", "risk", "tone"]
          }
        }
      });
      const result = JSON.parse(response.text);
      setDisclosures(prev => prev.map(d => d.id === disclosure.id ? { ...d, impactAnalysis: result } : d));
    } catch (err) {
      console.error("AI Deep Dive Error:", err);
    } finally {
      setAnalyzingId(null);
    }
  };

  const handleAiSummary = async (item: NewsItem) => {
    if (!process.env.GEMINI_API_KEY) return;
    setAnalyzingId(item.id);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Analyze this news snippet and provide a 3-bullet summary: "Quick Take", "Potential Market Impact", and "Sentiment (Bullish/Bearish)". Snippet: "${item.summary || item.title}"`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              quickTake: { type: Type.STRING },
              impact: { type: Type.STRING },
              sentiment: { type: Type.STRING, enum: ["Bullish", "Bearish", "Neutral"] }
            },
            required: ["quickTake", "impact", "sentiment"]
          }
        }
      });
      const result = JSON.parse(response.text);
      setSummaries(prev => ({ ...prev, [item.id]: result }));
    } catch (err) {
      console.error("AI Summary Error:", err);
    } finally {
      setAnalyzingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#09090b] text-[#e4e4e7] selection:bg-primary/30">
      <Helmet>
        <title>Intel Terminal | Colombo Exchange</title>
      </Helmet>

      {/* Terminal Header */}
      <div className="border-b border-[#18181b] bg-[#09090b]/80 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-[1600px] mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 px-3 py-1 bg-primary/10 border border-primary/20 rounded text-primary text-[10px] font-bold uppercase tracking-widest">
              <Zap className="h-3 w-3 fill-current" /> Intel Terminal v4.2
            </div>
            
            <div className="h-8 w-px bg-[#27272a]" />

            <div className="flex items-center gap-2">
              <Newspaper className="h-4 w-4 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white">Market Intel & Disclosures</span>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center bg-[#18181b] border border-[#27272a] rounded p-0.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={cn(
                    "px-3 py-1.5 text-[9px] font-bold uppercase tracking-widest transition-all rounded",
                    selectedCategory === cat 
                      ? "bg-primary text-white shadow-lg shadow-primary/20" 
                      : "text-muted-foreground hover:text-white"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground group-focus-within:text-primary transition-colors" />
              <input 
                type="text" 
                placeholder="Filter Terminal..."
                className="bg-[#18181b] border border-[#27272a] rounded h-9 pl-9 pr-4 text-xs w-[250px] focus:outline-none focus:border-primary/50 transition-all font-mono"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <button 
              onClick={() => setFilterPortfolio(!filterPortfolio)}
              className={cn(
                "flex items-center gap-2 h-9 px-4 rounded text-[10px] font-bold uppercase tracking-widest transition-all border",
                filterPortfolio 
                  ? "bg-primary/10 border-primary/40 text-primary shadow-[0_0_15px_rgba(0,85,255,0.1)]" 
                  : "bg-[#18181b] border-[#27272a] text-muted-foreground hover:border-[#3f3f46]"
              )}
            >
              <Briefcase className="h-3 w-3" />
              Portfolio Only
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-4 py-6">
        <motion.div 
          id="terminal-feed"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-12 gap-6"
        >
          
          {/* COLUMN 1: Official Pulse (40%) */}
          <div className="col-span-12 lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Official Pulse / CSE Disclosures</h2>
              </div>
              <Badge variant="outline" className="text-[8px] bg-emerald-500/5 text-emerald-500 border-emerald-500/20">LIVE FEED</Badge>
            </div>

            <div className="space-y-3 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                Array(5).fill(0).map((_, i) => (
                  <div key={i} className="bg-[#18181b] border border-[#27272a] p-4 rounded animate-pulse">
                    <div className="h-3 w-24 bg-[#27272a] mb-3" />
                    <div className="h-4 w-full bg-[#27272a]" />
                  </div>
                ))
              ) : disclosures.length === 0 ? (
                <div className="text-center py-20 border border-dashed border-[#27272a] rounded">
                  <p className="text-xs text-muted-foreground font-mono">No official disclosures found.</p>
                </div>
              ) : (
                disclosures.map((disc) => (
                  <motion.div 
                    key={disc.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="group bg-[#18181b] border border-[#27272a] hover:border-[#3f3f46] p-4 rounded transition-all relative overflow-hidden"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-2">
                        <div className="bg-primary/20 p-1.5 rounded">
                          <FileText className="h-3.5 w-3.5 text-primary" />
                        </div>
                        <span className="text-[10px] font-mono font-bold text-primary">{disc.symbol}</span>
                        <span className="text-[10px] font-mono text-muted-foreground">/ {disc.type}</span>
                      </div>
                      <span className="text-[9px] font-mono text-muted-foreground">{disc.date}</span>
                    </div>

                    <h3 className="text-sm font-bold leading-tight mb-4 group-hover:text-white transition-colors">
                      {disc.title}
                    </h3>

                    {disc.impactAnalysis && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }} 
                        animate={{ opacity: 1, height: 'auto' }}
                        className="mb-4 p-3 bg-primary/5 border border-primary/10 rounded space-y-3"
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Sparkles className="h-3 w-3 text-primary" />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-primary">AI Impact Analysis</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="space-y-1">
                            <span className="text-[7px] uppercase font-bold text-muted-foreground block">Revenue Impact</span>
                            <span className="text-[9px] font-bold text-white block">{disc.impactAnalysis.revenue}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[7px] uppercase font-bold text-muted-foreground block">Risk Level</span>
                            <span className="text-[9px] font-bold text-white block">{disc.impactAnalysis.risk}</span>
                          </div>
                          <div className="space-y-1">
                            <span className="text-[7px] uppercase font-bold text-muted-foreground block">Mgmt Tone</span>
                            <span className="text-[9px] font-bold text-white block">{disc.impactAnalysis.tone}</span>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    <div className="flex items-center gap-2">
                      {disc.pdfUrl && (
                        <a 
                          href={disc.pdfUrl} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 px-3 py-1.5 bg-[#27272a] hover:bg-[#3f3f46] text-white rounded text-[9px] font-bold transition-all"
                        >
                          <Download className="h-3 w-3" /> VIEW PDF
                        </a>
                      )}
                      <button 
                        onClick={() => handleDeepDive(disc)}
                        disabled={analyzingId === disc.id}
                        className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 rounded text-[9px] font-bold transition-all disabled:opacity-50"
                      >
                        {analyzingId === disc.id ? (
                          <>
                            <div className="h-2 w-2 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                            ANALYZING...
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" /> AI DEEP DIVE
                          </>
                        )}
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* COLUMN 2: Market Narrative (60%) */}
          <div className="col-span-12 lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Newspaper className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Market Narrative / Financial News</h2>
              </div>
              <div className="flex items-center gap-4 text-[9px] font-mono text-muted-foreground">
                <span>SOURCES: DAILY FT, ECONOMYNEXT, DAILY MIRROR</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[calc(100vh-200px)] overflow-y-auto pr-2 custom-scrollbar">
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <div key={i} className="bg-[#18181b] border border-[#27272a] p-6 rounded h-[250px] animate-pulse" />
                ))
              ) : filteredNews.length === 0 ? (
                <div className="col-span-full text-center py-40 border border-dashed border-[#27272a] rounded">
                  <Info className="h-8 w-8 text-muted-foreground/20 mx-auto mb-4" />
                  <p className="text-xs text-muted-foreground font-mono">No news matching your filters.</p>
                </div>
              ) : (
                filteredNews.map((item) => (
                  <motion.div 
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.98 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="group bg-[#18181b] border border-[#27272a] hover:border-primary/30 p-5 rounded-lg transition-all flex flex-col justify-between relative overflow-hidden"
                  >
                    {/* Sentiment Glow */}
                    <div className={cn(
                      "absolute top-0 right-0 w-32 h-32 -mr-16 -mt-16 blur-[60px] opacity-10 transition-opacity group-hover:opacity-20",
                      item.sentiment === 'bullish' ? "bg-emerald-500" : "bg-rose-500"
                    )} />

                    <div>
                      <div className="flex justify-between items-start mb-4 relative z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                            {item.source}
                          </span>
                          {item.sentiment && (
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[8px] font-bold uppercase border-none px-2",
                                item.sentiment === 'bullish' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                              )}
                            >
                              {item.sentiment}
                            </Badge>
                          )}
                        </div>
                        <span className="text-[9px] font-mono text-muted-foreground flex items-center gap-1.5">
                          <Clock className="h-3 w-3" /> {item.date}
                        </span>
                      </div>

                      <h3 className="text-sm font-bold leading-snug mb-4 group-hover:text-white transition-colors line-clamp-2">
                        {item.title}
                      </h3>

                      {item.symbol && (
                        <div className="flex items-center gap-3 mb-4 p-2 bg-[#09090b] rounded border border-[#27272a]">
                          <div className="flex flex-col">
                            <span className="text-[10px] font-mono font-bold text-primary">${item.symbol}</span>
                            <span className="text-[8px] font-mono text-muted-foreground uppercase">Ticker</span>
                          </div>
                          {/* Mock Sparkline */}
                          <div className="flex items-end gap-0.5 h-6 flex-grow px-2">
                            {item.trend?.map((h, i) => (
                              <div 
                                key={i} 
                                className={cn(
                                  "w-full rounded-t-[1px]",
                                  item.sentiment === 'bullish' ? "bg-emerald-500/40" : "bg-rose-500/40"
                                )}
                                style={{ height: `${h}%` }}
                              />
                            ))}
                          </div>
                        </div>
                      )}

                      {summaries[item.id] ? (
                        <motion.div 
                          initial={{ opacity: 0, y: 10 }} 
                          animate={{ opacity: 1, y: 0 }}
                          className="mb-6 p-3 bg-slate-700/30 border border-slate-700/50 rounded space-y-2"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="flex items-center gap-2">
                              <Sparkles className="h-3 w-3 text-primary" />
                              <span className="text-[9px] font-bold uppercase tracking-widest text-primary">AI Quick Take</span>
                            </div>
                            <Badge 
                              variant="outline" 
                              className={cn(
                                "text-[7px] font-bold uppercase border-none px-1.5 h-4",
                                summaries[item.id].sentiment === 'Bullish' ? "bg-emerald-500/10 text-emerald-500" : "bg-rose-500/10 text-rose-500"
                              )}
                            >
                              {summaries[item.id].sentiment}
                            </Badge>
                          </div>
                          <div className="space-y-1.5">
                            <div className="text-[10px] text-white leading-relaxed">
                              <span className="font-bold text-primary mr-1">Take:</span> {summaries[item.id].quickTake}
                            </div>
                            <div className="text-[10px] text-muted-foreground leading-relaxed">
                              <span className="font-bold text-primary mr-1">Impact:</span> {summaries[item.id].impact}
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        item.aiBullets && (
                          <div className="space-y-2 mb-6">
                            {item.aiBullets.map((bullet, idx) => (
                              <div key={idx} className="flex gap-2 text-[11px] text-muted-foreground leading-relaxed">
                                <div className={cn(
                                  "h-1 w-1 rounded-full mt-1.5 shrink-0",
                                  item.sentiment === 'bullish' ? "bg-emerald-500" : "bg-rose-500"
                                )} />
                                {bullet}
                              </div>
                            ))}
                          </div>
                        )
                      )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-slate-700 relative z-10">
                      <div className="flex items-center gap-2">
                        <a 
                          href={item.link} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground hover:text-white transition-colors uppercase tracking-widest"
                        >
                          Read Full Story <ExternalLink className="h-3 w-3" />
                        </a>
                        {!summaries[item.id] && (
                          <button 
                            onClick={() => handleAiSummary(item)}
                            disabled={analyzingId === item.id}
                            className="text-[9px] font-bold text-primary hover:underline uppercase tracking-widest disabled:opacity-50"
                          >
                            {analyzingId === item.id ? "Analyzing..." : "AI Summary"}
                          </button>
                        )}
                      </div>
                      <button className="p-1.5 text-muted-foreground hover:text-primary transition-colors">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </div>
        </motion.div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: transparent;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #27272a;
          border-radius: 10px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #3f3f46;
        }
      `}} />
    </div>
  );
}
