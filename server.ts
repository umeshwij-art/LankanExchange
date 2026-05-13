import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import * as cheerio from 'cheerio';
import axios from 'axios';
import { simulator } from './src/lib/simulator/engine.ts';
import './src/lib/simulator/cronSync.ts';
import cron from 'node-cron';
import { syncAnnouncements } from './src/lib/announcementSync.ts';
import Parser from 'rss-parser';
import { getMarketData } from './api/market.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Health Check for Deployment
  app.get('/health', (req, res) => {
    res.status(200).send('OK');
  });

  // Basic Health Check at root (optional but requested)
  app.get('/', (req, res, next) => {
    // If it's a request for the root and we are in production, we might want to serve index.html
    // but the user asked for a 200 status health check. 
    // To avoid breaking the SPA, we'll only respond to requests that aren't expecting HTML if possible,
    // or just provide the route as requested.
    if (req.headers.accept && req.headers.accept.includes('text/html')) {
      return next();
    }
    res.status(200).send('Colombo Exchange Service is Healthy');
  });

  // Start Simulator Engine
  simulator.start();

  // Schedule Announcement Sync (every 6 hours)
  cron.schedule('0 */6 * * *', () => {
    syncAnnouncements();
  });
  
  // Initial sync
  syncAnnouncements();

  // DataSwitch Logic: Simulate 20-min delay for free tier
  app.use((req, res, next) => {
    const tier = req.headers['x-user-tier'] || 'free';
    if (tier === 'free' && req.path.startsWith('/api/stocks')) {
      // In a real app, we'd serve 20-min old data. 
      // Here we simulate latency to represent "Delayed Data"
      setTimeout(next, 800); 
    } else {
      next();
    }
  });

  // Colombo Exchange API Integration
const CSE_API_URL = "https://www.cse.lk/api/tradeSummary";

interface CseStock {
  symbol: string;
  name: string;
  price: number;
  change: number;
  percentageChange: number;
  high?: number;
  low?: number;
  sharevolume: number;
  tradevolume?: number;
  turnover?: number;
  marketCap?: number;
  previousClose?: number;
  open?: number;
  lastTradedTime?: number | string;
  lastupdated?: string;
  sector?: string;
  board?: string;
}

const SECTOR_MAPPING: Record<string, string> = {
  'JKH': 'Capital Goods',
  'DIAL': 'Telecommunication Services',
  'SAMP': 'Banks',
  'COMB': 'Banks',
  'HNB': 'Banks',
  'LOLC': 'Diversified Financials',
  'BIL': 'Food, Beverage & Tobacco',
  'EXPO': 'Transportation',
  'HAYL': 'Capital Goods',
  'MELS': 'Food, Beverage & Tobacco',
  'LIOC': 'Energy',
  'ACL': 'Capital Goods',
  'SINS': 'Retailing',
  'TILE': 'Materials',
  'LWL': 'Materials',
  'RCL': 'Materials',
  'HHL': 'Capital Goods',
  'NEST': 'Food, Beverage & Tobacco',
  'CTC': 'Food, Beverage & Tobacco',
  'LION': 'Food, Beverage & Tobacco',
  'SLTL': 'Telecommunication Services',
  'NDB': 'Banks',
  'NTB': 'Banks',
  'PABC': 'Banks',
  'SEYB': 'Banks',
  'DFCC': 'Banks',
  'UBC': 'Banks',
  'VONE': 'Capital Goods',
  'RICH': 'Capital Goods',
  'SPEN': 'Capital Goods',
  'SUN': 'Food, Beverage & Tobacco',
  'WATA': 'Food, Beverage & Tobacco',
  'KGAL': 'Food, Beverage & Tobacco',
  'ELPL': 'Food, Beverage & Tobacco',
  'TPL': 'Food, Beverage & Tobacco',
  'NAMU': 'Food, Beverage & Tobacco',
  'HAPU': 'Food, Beverage & Tobacco',
  'UDPL': 'Food, Beverage & Tobacco',
  'BOPL': 'Food, Beverage & Tobacco',
  'MASK': 'Food, Beverage & Tobacco',
  'MAL': 'Food, Beverage & Tobacco',
  'BALA': 'Food, Beverage & Tobacco',
  'KOTA': 'Food, Beverage & Tobacco',
  'AGAL': 'Food, Beverage & Tobacco',
  'LMF': 'Food, Beverage & Tobacco',
  'KFP': 'Food, Beverage & Tobacco',
  'TAFL': 'Food, Beverage & Tobacco',
  'GRAN': 'Food, Beverage & Tobacco',
  'BFL': 'Food, Beverage & Tobacco',
  'SOY': 'Food, Beverage & Tobacco',
  'HVA': 'Food, Beverage & Tobacco',
  'RAL': 'Food, Beverage & Tobacco',
  'COCO': 'Food, Beverage & Tobacco',
  'CERA': 'Materials',
  'DPL': 'Materials',
  'PARQ': 'Materials',
  'TKYO': 'Materials',
  'GLAS': 'Materials',
  'ALUM': 'Materials',
  'LALU': 'Materials',
  'ACME': 'Materials',
  'JAT': 'Materials',
  'BPPL': 'Materials',
  'PACK': 'Materials',
  'SIRA': 'Capital Goods',
  'KCAB': 'Capital Goods',
  'APLA': 'Capital Goods',
  'CIND': 'Capital Goods',
  'LUMX': 'Capital Goods',
  'DOCK': 'Capital Goods',
  'AEL': 'Capital Goods',
  'MTL': 'Capital Goods',
  'MHDL': 'Real Estate',
  'OSEA': 'Real Estate',
  'CLND': 'Real Estate',
  'CTLD': 'Real Estate',
  'RIL': 'Real Estate',
  'PLR': 'Real Estate',
  'MDL': 'Real Estate',
  'ETWO': 'Real Estate',
  'YORK': 'Real Estate',
  'ONAL': 'Real Estate',
  'EAST': 'Real Estate',
  'ASCO': 'Real Estate',
  'CABO': 'Real Estate',
  'AHPL': 'Consumer Services',
  'AHUN': 'Consumer Services',
  'EDEN': 'Consumer Services',
  'STAF': 'Consumer Services',
  'KHL': 'Consumer Services',
  'TAJ': 'Consumer Services',
  'TANG': 'Consumer Services',
  'RPBH': 'Consumer Services',
  'SIGV': 'Consumer Services',
  'HSIG': 'Consumer Services',
  'BERU': 'Consumer Services',
  'MARA': 'Consumer Services',
  'CITW': 'Consumer Services',
  'CITH': 'Consumer Services',
  'REEF': 'Consumer Services',
  'CHOT': 'Consumer Services',
  'SHOT': 'Consumer Services',
  'PEG': 'Consumer Services',
  'RFL': 'Consumer Services',
  'RHTL': 'Consumer Services',
  'SERV': 'Consumer Services',
  'TRAN': 'Consumer Services',
  'KHC': 'Consumer Services',
  'LHL': 'Consumer Services',
  'NEH': 'Consumer Services',
  'JETS': 'Consumer Services',
  'HUNA': 'Consumer Services',
  'MRH': 'Consumer Services',
  'ASIR': 'Health Care Equipment & Services',
  'AMSL': 'Health Care Equipment & Services',
  'CHL': 'Health Care Equipment & Services',
  'NHL': 'Health Care Equipment & Services',
  'LHCL': 'Health Care Equipment & Services',
  'SINH': 'Health Care Equipment & Services',
  'AAIC': 'Insurance',
  'JINS': 'Insurance',
  'UAL': 'Insurance',
  'CINS': 'Insurance',
  'PINS': 'Insurance',
  'HASU': 'Insurance',
  'COOP': 'Insurance',
  'LGIL': 'Insurance',
  'LFIN': 'Diversified Financials',
  'CFIN': 'Diversified Financials',
  'PLC': 'Diversified Financials',
  'CDB': 'Diversified Financials',
  'LOFC': 'Diversified Financials',
  'COCR': 'Diversified Financials',
  'SFIN': 'Diversified Financials',
  'MBSL': 'Diversified Financials',
  'AFSL': 'Diversified Financials',
  'AMF': 'Diversified Financials',
  'CALF': 'Diversified Financials',
  'HNBF': 'Diversified Financials',
  'SDF': 'Diversified Financials',
  'UBF': 'Diversified Financials',
  'CRL': 'Diversified Financials',
  'SCAP': 'Diversified Financials',
  'VFIN': 'Diversified Financials',
  'PMB': 'Diversified Financials',
  'ALLI': 'Diversified Financials',
  'CFVF': 'Diversified Financials',
  'FCT': 'Diversified Financials',
  'CALT': 'Diversified Financials',
  'WLTH': 'Diversified Financials',
  'GUAR': 'Diversified Financials',
  'CINV': 'Diversified Financials',
  'CFI': 'Diversified Financials',
  'CIT': 'Diversified Financials',
  'WAPO': 'Diversified Financials',
  'VPEL': 'Utilities',
  'VLL': 'Utilities',
  'HPWR': 'Utilities',
  'PAP': 'Utilities',
  'LVEF': 'Utilities',
  'WIND': 'Utilities',
  'LPL': 'Utilities',
  'HPFL': 'Utilities',
  'LGL': 'Utilities',
  'ODEL': 'Retailing',
  'RCH': 'Consumer Services',
  'RENU': 'Consumer Services',
  'HUNT': 'Consumer Durables & Apparel',
  'HELA': 'Consumer Durables & Apparel',
  'TJL': 'Consumer Durables & Apparel',
  'MGT': 'Consumer Durables & Apparel',
  'HEXP': 'Consumer Durables & Apparel',
  'TYRE': 'Consumer Durables & Apparel',
  'DIMO': 'Capital Goods',
  'UML': 'Capital Goods',
  'ASHO': 'Capital Goods',
  'SMOT': 'Capital Goods',
  'AUTO': 'Capital Goods',
  'GEST': 'Commercial & Professional Services',
  'LPRT': 'Commercial & Professional Services',
  'EML': 'Commercial & Professional Services',
  'EXT': 'Commercial & Professional Services',
  'HBS': 'Software & Services',
  'ECL': 'Software & Services',
  'PKME': 'Software & Services',
};

function getSector(symbol: string): string {
  const baseSymbol = symbol.split('.')[0];
  return SECTOR_MAPPING[baseSymbol] || 'Other';
}

function getBoard(symbol: string): string {
  if (symbol.includes('.N')) return 'Main Board';
  if (symbol.includes('.C')) return 'Diri Savi Board';
  return 'Other';
}

let cseCache: {
  data: CseStock[];
  timestamp: number;
} | null = null;

const CACHE_DURATION = 60 * 1000; // 1 minute

async function getCseData(): Promise<CseStock[]> {
  if (cseCache && Date.now() - cseCache.timestamp < CACHE_DURATION) {
    return cseCache.data;
  }

  try {
    const response = await axios.post(CSE_API_URL, { symbol: "" }, {
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://www.cse.lk/',
        'Origin': 'https://www.cse.lk',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    const result = response.data;
    
    const rawStocks = result.reqTradeSummery || result.reqTradeSummary || result.tradeSummary || [];
    
    if (rawStocks.length === 0) {
      throw new Error("Empty stock data from CSE API");
    }

    const stocks: CseStock[] = rawStocks.map((s: any) => ({
      symbol: s.symbol || s.ticker || s.stockCode || "",
      name: s.name || s.companyName || s.stockName || "",
      price: parseFloat(s.price || s.lastTradedPrice || s.lastPrice || 0),
      change: parseFloat(s.change || s.netChange || 0),
      percentageChange: parseFloat(s.percentageChange || s.percentChange || s.pChange || 0),
      high: parseFloat(s.high || s.maxPrice || 0),
      low: parseFloat(s.low || s.minPrice || 0),
      sharevolume: parseFloat(s.sharevolume || s.volume || s.qty || 0),
      marketCap: parseFloat(s.marketCap || s.mktCap || 0),
      previousClose: parseFloat(s.previousClose || s.prevClose || 0),
      open: parseFloat(s.open || s.openPrice || 0),
      lastTradedTime: s.lastTradedTime || Date.now(),
      sector: s.sector,
      board: s.board
    }));
    
    cseCache = {
      data: stocks,
      timestamp: Date.now()
    };
    
    return stocks;
  } catch (error) {
    console.error("Error fetching CSE data with axios, using fallback:", error);
    if (cseCache) return cseCache.data;
    
    const fallbackStocks: CseStock[] = [
      { symbol: "SAMP.N0000", name: "SAMPATH BANK PLC", price: 78.50, change: 1.20, percentageChange: 1.55, sharevolume: 1200000, tradevolume: 450, turnover: 94200000, lastupdated: new Date().toISOString(), sector: 'Banking', board: 'Main Board' },
      { symbol: "JKH.N0000", name: "JOHN KEELLS HOLDINGS PLC", price: 195.00, change: -2.50, percentageChange: -1.27, sharevolume: 850000, tradevolume: 320, turnover: 165750000, lastupdated: new Date().toISOString(), sector: 'Capital Goods', board: 'Main Board' },
      { symbol: "COMB.N0000", name: "COMMERCIAL BANK OF CEYLON PLC", price: 92.30, change: 0.80, percentageChange: 0.87, sharevolume: 980000, tradevolume: 280, turnover: 90454000, lastupdated: new Date().toISOString(), sector: 'Banking', board: 'Main Board' },
      { symbol: "LIOC.N0000", name: "LANKA IOC PLC", price: 112.00, change: 4.50, percentageChange: 4.19, sharevolume: 2500000, tradevolume: 1200, turnover: 280000000, lastupdated: new Date().toISOString(), sector: 'Energy', board: 'Main Board' }
    ];
    return fallbackStocks;
  }
}

  // API Routes
  app.all("/api/market", getMarketData);

  interface NewsItem {
  title: string;
  link: string;
  date: string;
  summary: string;
  source: string;
}

let newsCache: {
  data: NewsItem[];
  timestamp: number;
} | null = null;

const parser = new Parser();

const RSS_SOURCES = [
  { name: 'EconomyNext', url: 'https://economynext.com/feed/' },
  { name: 'Daily FT', url: 'https://www.ft.lk/rss/stock-market' },
  { name: 'Daily Mirror Business', url: 'https://www.dailymirror.lk/rss/business' },
  { name: 'Ada Derana Biz', url: 'http://www.adaderana.lk/rss.php?cid=4' },
  { name: 'Lanka Business Online', url: 'https://www.lankabusinessonline.com/feed/' }
];

const FALLBACK_NEWS = [
  {
    title: "CSE indices close in green amidst high retail participation",
    link: "https://www.ft.lk/stock-market",
    contentSnippet: "The Colombo Exchange indices showed positive momentum today as retail investors continued to show interest in mid-cap stocks. Banking and Energy sectors led the gains.",
    pubDate: new Date().toISOString(),
    source: "Daily FT",
    category: "Banking"
  },
  {
    title: "Central Bank maintains policy rates to support economic recovery",
    link: "https://economynext.com",
    contentSnippet: "The Monetary Board of the Central Bank of Sri Lanka decided to maintain the Standing Deposit Facility Rate (SDFR) and the Standing Lending Facility Rate (SLFR) at their current levels.",
    pubDate: new Date().toISOString(),
    source: "EconomyNext",
    category: "Banking"
  },
  {
    title: "LIOC expands fuel distribution network in Northern Province",
    link: "https://www.dailymirror.lk/business",
    contentSnippet: "Lanka IOC has announced the opening of three new fuel stations in the Northern Province as part of its strategic expansion to meet increasing energy demands.",
    pubDate: new Date().toISOString(),
    source: "Daily Mirror Business",
    category: "Energy"
  }
];

async function fetchAndConsolidate() {
  const feedPromises = RSS_SOURCES.map(async (source) => {
    try {
      const feed = await parser.parseURL(source.url);
      return feed.items.map(item => ({
        title: item.title || '',
        link: item.link || '',
        contentSnippet: item.contentSnippet || item.content || '',
        pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
        source: source.name,
        category: (item.categories && item.categories[0]) || 'General'
      }));
    } catch (error) {
      console.error(`Error fetching RSS from ${source.name}:`, error);
      return [];
    }
  });

  const results = await Promise.all(feedPromises);
  const consolidated = results.flat().sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime());
  
  return consolidated.length > 0 ? consolidated : FALLBACK_NEWS;
}

const CATEGORY_KEYWORDS: Record<string, string[]> = {
  'Banking': ['COMB', 'SAMP', 'HNB', 'NDB', 'interest rates', 'central bank', 'banking', 'finance', 'loan'],
  'Energy': ['LIOC', 'fuel', 'electricity', 'CPC', 'power', 'energy', 'petroleum', 'solar'],
  'Consumer': ['NEST', 'CTC', 'LION', 'retail', 'consumer', 'food', 'beverage', 'supermarket'],
  'Manufacturing': ['ACL', 'TILE', 'LWL', 'RCL', 'manufacturing', 'factory', 'industrial', 'production'],
  'Real Estate': ['OSEA', 'CLND', 'CTLD', 'real estate', 'property', 'construction', 'apartment', 'housing']
};

function getCategoryFromContent(title: string, snippet: string): string {
  const text = (title + ' ' + snippet).toLowerCase();
  for (const [category, keywords] of Object.entries(CATEGORY_KEYWORDS)) {
    if (keywords.some(k => text.includes(k.toLowerCase()))) {
      return category;
    }
  }
  return 'General';
}

  // Simulator Engine API
  app.get("/api/simulator/stocks", (req, res) => {
    try {
      res.json(simulator.getAllStocks());
    } catch (error) {
      console.error("Error in /api/simulator/stocks:", error);
      res.status(500).json({ error: "Simulator data unavailable" });
    }
  });

  app.get("/api/simulator/stocks/:symbol", (req, res) => {
    try {
      const stock = simulator.getStockData(req.params.symbol.toUpperCase());
      if (!stock) return res.status(404).json({ error: "Stock not found" });
      res.json(stock);
    } catch (error) {
      console.error(`Error in /api/simulator/stocks/${req.params.symbol}:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/simulator/history/:symbol", (req, res) => {
    try {
      const { from, to, resolution } = req.query;
      const bars = simulator.getHistoricalBars(
        req.params.symbol.toUpperCase(),
        Number(from),
        Number(to),
        String(resolution)
      );
      res.json(bars);
    } catch (error) {
      console.error(`Error in /api/simulator/history/${req.params.symbol}:`, error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  app.get("/api/news/aggregated", async (req, res) => {
  try {
    const rawNews = await fetchAndConsolidate();
    const categorizedNews = rawNews.map(item => ({
      ...item,
      detectedCategory: getCategoryFromContent(item.title, item.contentSnippet)
    }));
    res.json(categorizedNews);
  } catch (error) {
    res.status(500).json({ error: "Failed to aggregate news" });
  }
});

app.get("/api/market-status", async (req, res) => {
  try {
    const [statusRes, stocks] = await Promise.all([
      axios.post("https://www.cse.lk/api/marketStatus", {}, {
        headers: {
          'Content-Type': 'application/json',
          'Referer': 'https://www.cse.lk/',
          'Origin': 'https://www.cse.lk',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      }),
      getCseData()
    ]);

    const statusData = statusRes.data;
    
    // Calculate summary stats
    const gainers = stocks.filter(s => s.change > 0).length;
    const losers = stocks.filter(s => s.change < 0).length;
    const unchanged = stocks.filter(s => s.change === 0).length;
    const totalTurnover = stocks.reduce((acc, s) => acc + (s.price * s.sharevolume), 0);

    res.json({
      ...statusData,
      gainers,
      losers,
      unchanged,
      totalTurnover
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch market status" });
  }
});

app.get("/api/news", async (req, res) => {
  try {
    const rawNews = await fetchAndConsolidate();
    const categorizedNews = rawNews.map(item => ({
      ...item,
      detectedCategory: getCategoryFromContent(item.title, item.contentSnippet)
    }));
    res.json(categorizedNews);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch news" });
  }
});

app.get("/api/stocks/top", async (req, res) => {
    try {
      const stocks = await getCseData();
      // Sort by percentage change descending for top gainers
      const topGainers = [...stocks]
        .sort((a, b) => b.percentageChange - a.percentageChange)
        .slice(0, 100) // Fetch more to allow filtering on frontend
        .map(stock => ({
          symbol: stock.symbol,
          fullName: stock.name,
          price: stock.price,
          change: stock.change,
          changePercent: stock.percentageChange,
          currency: "LKR",
          marketCap: stock.marketCap,
          sector: getSector(stock.symbol),
          board: getBoard(stock.symbol),
        }));
      
      res.json(topGainers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch top stocks" });
    }
  });

  app.get("/api/stocks/search", async (req, res) => {
    const query = (req.query.q as string || "").toUpperCase();
    if (!query) return res.json([]);
    
    try {
      const stocks = await getCseData();
      const filtered = stocks.filter(s => 
        s.symbol.toUpperCase().includes(query) || 
        s.name.toUpperCase().includes(query)
      ).slice(0, 10);
      
      res.json(filtered.map(s => ({
        symbol: s.symbol,
        name: s.name,
        exchange: "CSE"
      })));
    } catch (error) {
      res.status(500).json({ error: "Search failed" });
    }
  });

  app.get("/api/stocks/:symbol", async (req, res) => {
    const symbol = req.params.symbol.toUpperCase();
    const range = (req.query.range as string || "1M").toUpperCase();
    
    try {
      const stocks = await getCseData();
      const stock = stocks.find(s => s.symbol.startsWith(symbol));
      
      if (!stock) {
        return res.status(404).json({ error: "Stock not found" });
      }

      // Generate simulated historical data based on range
      const history = [];
      const now = new Date();
      
      let points = 30;
      let intervalDays = 1;
      let isIntraday = false;

      switch(range) {
        case '1D': points = 24; isIntraday = true; break;
        case '1W': points = 7; intervalDays = 1; break;
        case '1M': points = 30; intervalDays = 1; break;
        case '3M': points = 90; intervalDays = 1; break;
        case '1Y': points = 250; intervalDays = 1; break;
        case 'ALL': points = 500; intervalDays = 2; break;
        default: points = 30; intervalDays = 1;
      }

      let currentPrice = stock.previousClose || stock.price;
      const volatility = 0.015; // 1.5% max change per point

      for (let i = points; i >= 0; i--) {
        const date = new Date(now);
        if (isIntraday) {
          date.setHours(date.getHours() - i, 0, 0, 0);
        } else {
          date.setDate(date.getDate() - i * intervalDays);
          date.setHours(0, 0, 0, 0);
        }

        const change = currentPrice * (Math.random() - 0.5) * volatility;
        const open = currentPrice;
        const close = currentPrice + change;
        const high = Math.max(open, close) + (Math.random() * currentPrice * 0.005);
        const low = Math.min(open, close) - (Math.random() * currentPrice * 0.005);
        
        history.push({
          time: Math.floor(date.getTime() / 1000),
          open: parseFloat(open.toFixed(2)),
          high: parseFloat(high.toFixed(2)),
          low: parseFloat(low.toFixed(2)),
          close: parseFloat(close.toFixed(2)),
          volume: Math.floor(Math.random() * stock.sharevolume / points * 2)
        });

        currentPrice = close;
      }

      // Adjust the last point to match current price
      if (history.length > 0) {
        history[history.length - 1].close = stock.price;
      }

      res.json({
        quote: {
          symbol: stock.symbol.split('.')[0],
          fullName: stock.name,
          price: stock.price,
          change: stock.change,
          changePercent: stock.percentageChange,
          currency: "LKR",
          marketCap: stock.marketCap,
          high: stock.high,
          low: stock.low,
          volume: stock.sharevolume,
          prevClose: stock.previousClose,
          open: stock.open,
          sector: getSector(stock.symbol),
          board: getBoard(stock.symbol),
        },
        history: history
      });
    } catch (error) {
      res.status(404).json({ error: "Stock not found" });
    }
  });

  app.get("/api/stocks/:symbol/reports", async (req, res) => {
    const fullSymbol = req.params.symbol.toUpperCase();
    const baseSymbol = fullSymbol.split('.')[0];
    
    const fetchAnnouncementsList = async (sym: string) => {
      try {
        const response = await axios.post("https://www.cse.lk/api/getAnnouncementByCompany", `symbol=${sym}`, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://www.cse.lk/',
            'Origin': 'https://www.cse.lk',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        
        return response.data.reqCompanyAnnouncement || [];
      } catch (e) {
        console.error(`Error fetching announcements list for ${sym}:`, e);
        return null;
      }
    };

    const fetchAnnouncementDetails = async (announcementId: string) => {
      try {
        const response = await axios.post("https://www.cse.lk/api/getGeneralAnnouncementById", `announcementId=${announcementId}`, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Referer': 'https://www.cse.lk/',
            'Origin': 'https://www.cse.lk',
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        });
        
        const data = response.data;
        if (data.reqAnnouncementDocs && data.reqAnnouncementDocs.length > 0) {
          return `https://cdn.cse.lk/${data.reqAnnouncementDocs[0].fileUrl}`;
        }
        return null;
      } catch (e) {
        console.error(`Error fetching announcement details for ${announcementId}:`, e);
        return null;
      }
    };

    try {
      let announcements = await fetchAnnouncementsList(fullSymbol);
      if (!announcements || announcements.length === 0) {
        announcements = await fetchAnnouncementsList(baseSymbol);
      }

      if (!announcements || announcements.length === 0) {
        throw new Error("No announcements found");
      }

      // Filter for reports and get top 10
      const reportAnnouncements = announcements.filter((a: any) => 
        a.announcementCategory === 'FINANCIAL STATEMENTS' ||
        a.announcementCategory === 'ANNUAL REPORT' ||
        a.announcementCategory === 'INTERIM FINANCIAL STATEMENTS' ||
        a.remarks?.toLowerCase().includes('report') ||
        a.remarks?.toLowerCase().includes('financial statements')
      ).slice(0, 10);

      // Fetch details for each report to get the PDF link
      const reports = await Promise.all(reportAnnouncements.map(async (a: any) => {
        const pdfLink = await fetchAnnouncementDetails(a.announcementId);
        return {
          title: a.remarks || a.announcementCategory || "Announcement",
          date: a.dateOfAnnouncement,
          link: pdfLink || "https://www.cse.lk/home/company-announcements",
          size: "PDF"
        };
      }));

      res.json(reports);
    } catch (error) {
      console.warn(`Error fetching real reports for ${fullSymbol}, providing mock data:`, error);
      
      const mockReports = [
        { title: `${fullSymbol} Annual Report 2023/24`, date: "2024-06-15", link: "https://www.cse.lk/home/company-announcements", size: "2.4 MB" },
        { title: `${fullSymbol} Interim Financials - Q3`, date: "2024-02-10", link: "https://www.cse.lk/home/company-announcements", size: "1.1 MB" },
        { title: `${fullSymbol} Interim Financials - Q2`, date: "2023-11-05", link: "https://www.cse.lk/home/company-announcements", size: "1.2 MB" },
        { title: `${fullSymbol} Annual Report 2022/23`, date: "2023-06-20", link: "https://www.cse.lk/home/company-announcements", size: "2.8 MB" },
      ];
      
      res.json(mockReports);
    }
  });

  app.post("/api/admin/sync-anchor-prices", async (req, res) => {
    const { syncAnchorPrices } = await import("./src/lib/simulator/cronSync.ts");
    try {
      await syncAnchorPrices();
      res.json({ message: "Sync triggered successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to trigger sync" });
    }
  });

  app.post("/api/admin/sync-announcements", async (req, res) => {
    try {
      await syncAnnouncements();
      res.json({ message: "Announcement sync triggered successfully" });
    } catch (error) {
      res.status(500).json({ error: "Failed to trigger announcement sync" });
    }
  });

  app.get("/api/announcements", async (req, res) => {
    try {
      const { db } = await import("./src/lib/firebase-admin.ts");
      const snapshot = await db.collection('announcements').orderBy('date', 'desc').limit(50).get();
      const announcements = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      res.json(announcements);
    } catch (error) {
      console.error("Error fetching announcements from Firestore:", error);
      res.status(500).json({ error: "Failed to fetch announcements", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Colombo Exchange ready on ${port}`);
  });
}

startServer();
