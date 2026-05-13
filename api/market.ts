import axios from 'axios';

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle browser preflight options request
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    // 1. Fetch data from the live verified exchange endpoint using Axios (standard Node runtime)
    const cseResponse = await axios.post('https://cse.lk/api/todaySharePrice', {}, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.cse.lk/'
      },
      timeout: 15000 
    });

    // 2. Format the response payload from 'reqTodaySharePrice'
    const rawStocks = cseResponse.data.reqTodaySharePrice || [];
    const formattedData = rawStocks.map((stock: any) => ({
      symbol: stock.symbol || 'UNKNOWN',
      name: stock.name || stock.companyName || '',
      anchorPrice: parseFloat(stock.lastTradedPrice || stock.tradePrice || 0),
      high: parseFloat(stock.high || 0),
      low: parseFloat(stock.low || 0),
      volume: parseInt(stock.volume || stock.sharevolume || 0)
    }));

    // Return the clean anchor price payload
    return res.status(200).json({ success: true, data: formattedData });

  } catch (error: any) {
    console.error("CSE Connection Error:", error.message);
    return res.status(500).json({ 
      success: false, 
      error: 'Failed to securely fetch live anchors from Colombo Stock Exchange' 
    });
  }
}
