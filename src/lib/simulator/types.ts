
export interface SectorProfile {
  baseVolatility: number;
  baseDrift: number;
}

export interface Stock {
  symbol: string;
  name: string;
  sector: string;
  profile: SectorProfile;
  lastClose: number;
  currentPrice: number;
  lastUpdated: number;
}

export interface SimulatorState {
  stocks: Record<string, Stock>;
  isMarketOpen: boolean;
  lastSync: number;
}
