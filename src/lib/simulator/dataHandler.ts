
import { simulator } from './engine.ts';

export type UserTier = 'Free' | 'Beta' | 'Pro' | 'Ultimate';

export class DataHandler {
  private tier: UserTier;

  constructor(tier: UserTier = 'Free') {
    this.tier = tier;
    // Start simulator if not already running
    simulator.start();
  }

  public setTier(tier: UserTier) {
    this.tier = tier;
  }

  public async getStockPrice(symbol: string) {
    if (this.tier === 'Free' || this.tier === 'Beta') {
      // Return simulated/delayed data
      const simulated = simulator.getStockData(symbol);
      if (simulated) {
        return {
          price: simulated.currentPrice,
          source: 'Simulated (Delayed)',
          timestamp: simulated.lastUpdated
        };
      }
    }

    if (this.tier === 'Pro' || this.tier === 'Ultimate') {
      // Placeholder for Real-Time WebSocket connection
      console.log(`[WebSocket] Connecting to real-time feed for ${symbol}...`);
      
      // For now, return simulated data but mark as "Real-Time"
      const simulated = simulator.getStockData(symbol);
      return {
        price: simulated?.currentPrice,
        source: 'Real-Time (WebSocket Placeholder)',
        timestamp: Date.now()
      };
    }

    return null;
  }

  public getMarketStatus() {
    return {
      isMarketOpen: true, // Simplified for UI
      nextSync: "09:30 AM Asia/Colombo"
    };
  }
}

export const dataHandler = new DataHandler();
