import axios from 'axios';
import { Request, Response } from 'express';

export async function getMarketData(req: Request, res: Response) {
  // Clear CORS for your front-end domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Fetch data from the unofficial CSE endpoint
    // We add a desktop User-Agent header so the CSE servers don't flag the request as a bot
    const cseResponse = await axios.post('https://www.cse.lk/api/tradeSummary', {}, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.cse.lk/',
        'Origin': 'https://www.cse.lk'
      },
      timeout: 10000 // 10 second timeout protection
    });

    // 2. Format the response array cleanly for your Stochastic/GBM algorithm
    const rawStocks = cseResponse.data.reqTradeSummery || cseResponse.data.reqTradeSummary || cseResponse.data.tradeSummary || [];
    const formattedData = rawStocks.map((stock: any) => ({
      symbol: stock.symbol || 'UNKNOWN',
      name: stock.companyName || stock.name || '',
      anchorPrice: parseFloat(stock.lastTradedPrice || stock.price || 0),
      high: parseFloat(stock.high || 0),
      low: parseFloat(stock.low || 0),
      volume: parseInt(stock.volume || stock.sharevolume || 0)
    }));

    // Return the clean anchor price payload to your application
    return res.status(200).json({ success: true, data: formattedData });
  } catch (error: any) {
    console.error("CSE Connection Error:", error.message);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to securely fetch live anchors from Colombo Stock Exchange' 
    });
  }
}
