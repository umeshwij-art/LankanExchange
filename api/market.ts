import axios from 'axios';
import { Request, Response } from 'express';

export default async function handler(req: Request, res: Response) {
  // Clear CORS restrictions so your React frontend can talk to this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle browser preflight options request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Fetch data from the unofficial CSE endpoint
    // We target cse.lk directly as per infrastructure requirements
    const cseResponse = await axios.post('https://cse.lk/api/todaySharePrice', {}, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://www.cse.lk',
        'Referer': 'https://www.cse.lk/'
      },
      timeout: 15000 
    });

    // 2. Format the response payload primarily from 'reqTodaySharePrice'
    const rawStocks = cseResponse.data.reqTodaySharePrice || [];
    const formattedData = rawStocks.map((stock: any) => ({
      symbol: stock.symbol || 'UNKNOWN',
      name: stock.name || stock.companyName || '',
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
