
import type { Stock, SimulatorState } from './types.ts';
import stockData from './stockDatabase.json';

class SimulatorEngine {
  private state: SimulatorState;
  private intervalId: NodeJS.Timeout | null = null;

  constructor() {
    const stocks: Record<string, Stock> = {};
    stockData.forEach((s: any) => {
      stocks[s.symbol] = {
        ...s,
        currentPrice: s.lastClose,
        lastUpdated: Date.now()
      };
    });

    this.state = {
      stocks,
      isMarketOpen: false,
      lastSync: Date.now()
    };
  }

  public start() {
    if (this.intervalId) return;
    
    // Initial sync
    this.syncWithRealClose();

    // Run every 5 seconds
    this.intervalId = setInterval(() => {
      this.updateMarketStatus();
      if (this.state.isMarketOpen) {
        this.generatePriceMovement();
      }
      
      // Check for daily reset at 9:30 AM Colombo
      this.checkDailyReset();
    }, 5000);
  }

  public stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private updateMarketStatus() {
    const now = new Date();
    const colomboTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
    const hours = colomboTime.getHours();
    const minutes = colomboTime.getMinutes();
    const day = colomboTime.getDay();

    // Market hours: 9:30 AM to 2:30 PM, Monday to Friday
    const isWeekday = day >= 1 && day <= 5;
    const isAfterOpen = (hours > 9) || (hours === 9 && minutes >= 30);
    const isBeforeClose = (hours < 14) || (hours === 14 && minutes <= 30);

    this.state.isMarketOpen = isWeekday && isAfterOpen && isBeforeClose;
  }

  private checkDailyReset() {
    const now = new Date();
    const colomboTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
    const hours = colomboTime.getHours();
    const minutes = colomboTime.getMinutes();

    // Reset exactly at 9:30 AM
    if (hours === 9 && minutes === 30) {
      const lastSyncDate = new Date(this.state.lastSync);
      if (lastSyncDate.getDate() !== colomboTime.getDate()) {
        this.syncWithRealClose();
      }
    }
  }

  public syncWithRealClose() {
    console.log("Syncing with real-world closing prices...");
    Object.keys(this.state.stocks).forEach(symbol => {
      const stock = this.state.stocks[symbol];
      stock.currentPrice = stock.lastClose;
      stock.lastUpdated = Date.now();
    });
    this.state.lastSync = Date.now();
  }

  private generatePriceMovement() {
    const dt = 5 / (365 * 24 * 60 * 60); // 5 seconds in years

    Object.keys(this.state.stocks).forEach(symbol => {
      const stock = this.state.stocks[symbol];
      
      // Calculate deviation before move
      this.calculateMarketDeviation(stock.currentPrice, stock.lastClose, stock);

      const { baseVolatility, baseDrift } = stock.profile;

      // Geometric Brownian Motion: dS = S * (mu*dt + sigma*dW)
      // S_new = S_old * exp((mu - 0.5 * sigma^2) * dt + sigma * sqrt(dt) * epsilon)
      const epsilon = this.boxMullerTransform();
      
      // Special shock for high-volume stocks like BIL
      let shock = 1.0;
      if (symbol.startsWith('BIL')) {
        if (Math.random() > 0.8) { // 20% chance of a retail shock
          shock = 1 + (Math.random() - 0.5) * 0.005; // +/- 0.5% shock
        }
      }

      const drift = (baseDrift - 0.5 * Math.pow(baseVolatility, 2)) * dt;
      const diffusion = baseVolatility * Math.sqrt(dt) * epsilon;
      
      stock.currentPrice = stock.currentPrice * Math.exp(drift + diffusion) * shock;
      stock.lastUpdated = Date.now();
    });
  }

  private calculateMarketDeviation(simulatedPrice: number, realClose: number, stock: Stock): string {
    const deviation = ((simulatedPrice - realClose) / realClose) * 100;
    
    const now = new Date();
    const colomboTime = new Date(now.toLocaleString("en-US", { timeZone: "Asia/Colombo" }));
    const hours = colomboTime.getHours();
    const minutes = colomboTime.getMinutes();

    // 4-hour mark (Open at 9:30 AM -> 1:30 PM)
    const isFourHourMark = (hours === 13 && minutes >= 30 && minutes <= 45);
    // Before day close (Market closes at 2:30 PM, start dampening from 2:00 PM)
    const isDayCloseApproaching = (hours === 14 && minutes <= 30);

    if (Math.abs(deviation) > 5.0 || isFourHourMark || isDayCloseApproaching) {
        console.warn(`ALERT: ${stock.symbol} price deviation context active [${hours}:${minutes}]. Managing volatility.`);
        
        // If deviating too much or near close, pull towards real close
        const pullFactor = isDayCloseApproaching ? 0.05 : 0.02;
        stock.currentPrice = stock.currentPrice + (realClose - stock.currentPrice) * pullFactor;
        
        // Dynamic sigma dampening
        stock.profile.baseVolatility *= 0.95;
    }
    return deviation.toFixed(2) + "%";
  }

  private boxMullerTransform(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);
  }

  public getStockData(symbol: string): Stock | undefined {
    return this.state.stocks[symbol];
  }

  public getAllStocks(): Stock[] {
    return Object.values(this.state.stocks);
  }

  public getHistoricalBars(symbol: string, from: number, to: number, resolution: string) {
    const stock = this.state.stocks[symbol];
    if (!stock) return [];

    const bars = [];
    // Simple mock: generate bars between from and to
    // resolution is 'D', '1', '5', etc.
    const intervalMs = resolution === 'D' ? 24 * 60 * 60 * 1000 : parseInt(resolution) * 60 * 1000 || 60 * 60 * 1000;
    
    let current = from * 1000;
    let price = stock.lastClose;

    // Seed randomness with symbol to get consistent-ish history
    let seed = 0;
    for (let i = 0; i < symbol.length; i++) seed += symbol.charCodeAt(i);
    
    const seededRandom = () => {
      seed = (seed * 9301 + 49297) % 233280;
      return seed / 233280;
    };

    while (current <= to * 1000 && current <= Date.now()) {
      const vol = stock.profile.baseVolatility * 0.02;
      const open = price;
      const close = open * (1 + (seededRandom() - 0.5) * vol);
      const high = Math.max(open, close) * (1 + seededRandom() * 0.005);
      const low = Math.min(open, close) * (1 - seededRandom() * 0.005);
      
      bars.push({
        time: current,
        open,
        high,
        low,
        close,
        volume: Math.floor(seededRandom() * 1000000)
      });
      
      price = close;
      current += intervalMs;
    }

    return bars;
  }
}

export const simulator = new SimulatorEngine();
