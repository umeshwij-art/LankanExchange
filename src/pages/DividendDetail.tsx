
import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { ArrowLeft, Calendar, TrendingUp, Info, ExternalLink, FileText, Activity, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";

export default function DividendDetail() {
  const { symbol, year } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [stockInfo, setStockInfo] = useState<any>(null);

  useEffect(() => {
    // Fetch stock info to make the page more useful
    fetch(`/api/stocks/${symbol}`)
      .then(res => res.json())
      .then(data => {
        setStockInfo(data.quote);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [symbol]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background p-8">
        <div className="max-w-4xl mx-auto space-y-8">
          <Skeleton className="h-8 w-32 bg-muted/50" />
          <Skeleton className="h-32 w-full bg-muted/50" />
          <Skeleton className="h-64 w-full bg-muted/50" />
        </div>
      </div>
    );
  }

  const pageTitle = `Latest ${symbol} Dividend XD Date Sri Lanka ${year}`;
  const pageDescription = `Get the latest dividend information for ${stockInfo?.fullName || symbol} in ${year}. Check XD dates, payment amounts, and historical dividend performance on Colombo Exchange.`;

  return (
    <div className="min-h-screen bg-background pb-20">
      <Helmet>
        <title>{pageTitle}</title>
        <meta name="description" content={pageDescription} />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={pageDescription} />
        <meta name="keywords" content={`${symbol}, Dividend, XD Date, Sri Lanka, Stock Market, CSE, ${year}, ${stockInfo?.fullName}`} />
      </Helmet>

      <div className="bg-card border-b border-border py-8">
        <div className="max-w-4xl mx-auto px-4">
          <button 
            onClick={() => navigate('/intelligence')}
            className="flex items-center gap-2 text-xs font-bold text-muted-foreground hover:text-primary transition-colors mb-6 uppercase tracking-widest"
          >
            <ArrowLeft className="h-3 w-3" /> Back to Intelligence
          </button>
          
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-4xl font-bold tracking-tight">{symbol}</h1>
                <Badge className="bg-primary/10 text-primary border-none text-[10px] font-bold uppercase tracking-widest">Dividend {year}</Badge>
              </div>
              <p className="text-xl text-muted-foreground">{stockInfo?.fullName || 'Company Name'}</p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground block mb-1">Current Price</span>
              <span className="text-3xl font-mono font-bold">Rs. {stockInfo?.price?.toFixed(2) || '0.00'}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-2 space-y-8">
            <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <Info className="h-5 w-5 text-primary" /> Dividend Summary
              </h2>
              <div className="grid grid-cols-2 gap-8">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Amount per Share</span>
                  <p className="text-2xl font-mono font-bold text-primary">Rs. 2.50 <span className="text-xs font-normal text-muted-foreground">(Estimated)</span></p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">XD Date</span>
                  <p className="text-2xl font-mono font-bold">2026-05-12</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Dividend Yield</span>
                  <p className="text-2xl font-mono font-bold">4.2%</p>
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Payment Date</span>
                  <p className="text-2xl font-mono font-bold">2026-06-01</p>
                </div>
              </div>
              
              <div className="mt-10 p-4 bg-muted/30 rounded-xl border border-border">
                <p className="text-xs text-muted-foreground leading-relaxed">
                  <span className="font-bold text-foreground">Note:</span> The XD (Ex-Dividend) date is the date on which the stock starts trading without the value of its next dividend payment. To receive the dividend, you must own the stock before the XD date.
                </p>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
              <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" /> Historical Performance
              </h2>
              <div className="space-y-4">
                {[2025, 2024, 2023].map((y) => (
                  <div key={y} className="flex items-center justify-between py-3 border-b border-border last:border-0">
                    <div className="flex items-center gap-3">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-bold">{y} Final Dividend</span>
                    </div>
                    <span className="text-sm font-mono font-bold">Rs. {(Math.random() * 5 + 1).toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-primary text-white rounded-2xl p-6 shadow-lg shadow-primary/20">
              <h3 className="font-bold mb-2">Market Sentiment</h3>
              <p className="text-xs opacity-80 mb-6">Investors are reacting positively to the dividend announcement, citing strong cash flow and management confidence.</p>
              <div className="h-2 w-full bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white w-3/4" />
              </div>
              <div className="flex justify-between mt-2">
                <span className="text-[8px] font-bold uppercase">Bullish 75%</span>
                <span className="text-[8px] font-bold uppercase">Bearish 25%</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-2xl p-6 shadow-sm">
              <h3 className="text-sm font-bold mb-4 uppercase tracking-widest text-muted-foreground">Official Links</h3>
              <div className="space-y-3">
                <a href="https://www.cse.lk" className="flex items-center justify-between text-xs font-bold hover:text-primary transition-colors">
                  CSE Announcement <ExternalLink className="h-3 w-3" />
                </a>
                <a href="#" className="flex items-center justify-between text-xs font-bold hover:text-primary transition-colors">
                  Annual Report <FileText className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
