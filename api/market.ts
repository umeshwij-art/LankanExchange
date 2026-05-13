import axios from 'axios';
import { Request, Response } from 'express';

export async function getMarketData(req: Request, res: Response) {
  try {
    const response = await axios.post('https://www.cse.lk/api/tradeSummary', { symbol: "" }, {
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://www.cse.lk/',
        'Origin': 'https://www.cse.lk',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      timeout: 10000
    });

    // Add CORS headers as requested
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    return res.json(response.data);
  } catch (error: any) {
    console.error('Market Proxy Error:', error.message);
    return res.status(500).json({ 
      error: 'Failed to fetch market data from CSE',
      message: error.message 
    });
  }
}
