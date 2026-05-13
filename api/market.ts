export const config = {
  runtime: 'edge',
};

export default async function handler(req: Request) {
  // CORS Headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };

  // Handle browser preflight options request
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers });
  }

  try {
    // 1. Fetch data from the live verified exchange endpoint using native fetch for Edge compatibility
    const cseResponse = await fetch('https://cse.lk/api/todaySharePrice', {
      method: 'POST',
      body: JSON.stringify({}),
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Origin': 'https://www.cse.lk',
        'Referer': 'https://www.cse.lk/'
      }
    });

    if (!cseResponse.ok) {
      throw new Error(`CSE API responded with ${cseResponse.status}`);
    }

    const data = await cseResponse.json();

    // 2. Format the response payload primarily from 'reqTodaySharePrice'
    const rawStocks = data.reqTodaySharePrice || [];
    const formattedData = rawStocks.map((stock: any) => ({
      symbol: stock.symbol || 'UNKNOWN',
      name: stock.name || stock.companyName || '',
      anchorPrice: parseFloat(stock.lastTradedPrice || stock.price || 0),
      high: parseFloat(stock.high || 0),
      low: parseFloat(stock.low || 0),
      volume: parseInt(stock.volume || stock.sharevolume || 0)
    }));

    // Return the clean anchor price payload to your application
    return new Response(JSON.stringify({ success: true, data: formattedData }), {
      status: 200,
      headers
    });

  } catch (error: any) {
    console.error("CSE Connection Error:", error.message);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to securely fetch live anchors from Colombo Stock Exchange via Edge' 
    }), {
      status: 500,
      headers
    });
  }
}
