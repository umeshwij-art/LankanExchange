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
    // Forward the payload exactly to the unofficial CSE endpoint
    // Using the full URL as 'cse.lk' alone might resolve incorrectly or fail in some environments
    const response = await axios.post('https://www.cse.lk/api/tradeSummary', {}, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Referer': 'https://www.cse.lk/',
        'Origin': 'https://www.cse.lk'
      },
      timeout: 10000
    });

    // Send the anchored CSE pricing payload safely to your app
    return res.status(200).json(response.data);
  } catch (error: any) {
    console.error("Proxy Error:", error.message);
    return res.status(500).json({ 
      error: 'Failed fetching data from CSE',
      details: error.message 
    });
  }
}
