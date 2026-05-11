
export interface OHLCData {
  time: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export const generateMockOHLC = (symbol: string, days: number = 100): OHLCData[] => {
  const data: OHLCData[] = [];
  const now = new Date();
  
  let basePrice = 100;
  if (symbol === 'JKH') basePrice = 195;
  if (symbol === 'COMB') basePrice = 115;
  if (symbol === 'DIAL') basePrice = 12;

  let currentPrice = basePrice;
  const volatility = 0.02;

  for (let i = days; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    
    const timeStr = date.toISOString().split('T')[0];
    
    const change = currentPrice * (Math.random() - 0.5) * volatility;
    const open = currentPrice;
    const close = currentPrice + change;
    const high = Math.max(open, close) + (Math.random() * currentPrice * 0.01);
    const low = Math.min(open, close) - (Math.random() * currentPrice * 0.01);
    const volume = Math.floor(Math.random() * 1000000) + 500000;

    data.push({
      time: timeStr,
      open: parseFloat(open.toFixed(2)),
      high: parseFloat(high.toFixed(2)),
      low: parseFloat(low.toFixed(2)),
      close: parseFloat(close.toFixed(2)),
      volume
    });

    currentPrice = close;
  }

  return data;
};
