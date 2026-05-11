
import fs from 'fs';

async function generateDatabase() {
  const url = "https://www.cse.lk/api/tradeSummary";
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://www.cse.lk/',
        'Origin': 'https://www.cse.lk',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({})
    });
    
    const data = await response.json();
    const stocks = data.reqTradeSummery;
    
    const profiles = {
      'Banks': { baseVolatility: 0.15, baseDrift: 0.05 },
      'Energy': { baseVolatility: 0.25, baseDrift: 0.08 },
      'Speculative': { baseVolatility: 0.45, baseDrift: 0.12 },
      'Capital Goods': { baseVolatility: 0.20, baseDrift: 0.06 },
      'Food, Beverage & Tobacco': { baseVolatility: 0.18, baseDrift: 0.04 },
      'Materials': { baseVolatility: 0.22, baseDrift: 0.07 },
      'Diversified Financials': { baseVolatility: 0.28, baseDrift: 0.09 },
      'Telecommunication Services': { baseVolatility: 0.12, baseDrift: 0.03 },
      'Retailing': { baseVolatility: 0.30, baseDrift: 0.10 },
      'Insurance': { baseVolatility: 0.18, baseDrift: 0.05 },
      'Real Estate': { baseVolatility: 0.25, baseDrift: 0.06 },
      'Utilities': { baseVolatility: 0.10, baseDrift: 0.02 },
      'Default': { baseVolatility: 0.20, baseDrift: 0.05 }
    };

    const sectorMapping = {
      'JKH': 'Capital Goods',
      'DIAL': 'Telecommunication Services',
      'SAMP': 'Banks',
      'COMB': 'Banks',
      'HNB': 'Banks',
      'LOLC': 'Diversified Financials',
      'BIL': 'Speculative', // BIL is often speculative in retail eyes
      'EXPO': 'Transportation',
      'HAYL': 'Capital Goods',
      'MELS': 'Food, Beverage & Tobacco',
      'LIOC': 'Energy',
      // ... more can be added or inferred
    };

    const database = stocks.map(s => {
      const baseSymbol = s.symbol.split('.')[0];
      let sector = sectorMapping[baseSymbol] || 'Default';
      
      // Heuristic for sector if not mapped
      if (sector === 'Default') {
        if (s.name.includes('BANK')) sector = 'Banks';
        else if (s.name.includes('FINANCE')) sector = 'Diversified Financials';
        else if (s.name.includes('ENERGY') || s.name.includes('POWER')) sector = 'Energy';
        else if (s.name.includes('HOTEL')) sector = 'Speculative';
        else if (s.name.includes('PLANTATION')) sector = 'Food, Beverage & Tobacco';
      }

      return {
        symbol: s.symbol,
        name: s.name,
        sector: sector,
        profile: profiles[sector] || profiles['Default'],
        lastClose: s.price || s.previousClose || 0
      };
    });

    fs.writeFileSync('src/lib/simulator/stockDatabase.json', JSON.stringify(database, null, 2));
    console.log(`Generated database with ${database.length} stocks.`);
  } catch (e) {
    console.error("Error generating database:", e);
  }
}

generateDatabase();
