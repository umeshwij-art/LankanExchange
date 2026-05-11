
import cron from 'node-cron';
import { db } from '../firebase-admin.ts';

const CSE_API_URL = "https://www.cse.lk/api/tradeSummary";

async function fetchWithRetry(url: string, options: any, retries = 3): Promise<any> {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error(`Attempt ${i + 1} failed: ${error}`);
      if (i === retries - 1) throw error;
      // Wait 2 seconds before retry
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }
}

export async function syncAnchorPrices() {
  console.log(`[Cron] Starting Daily Anchor Price Sync at ${new Date().toISOString()}`);
  
  try {
    const data = await fetchWithRetry(CSE_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Referer': 'https://www.cse.lk/',
        'Origin': 'https://www.cse.lk',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({})
    });

    const stocks = data.reqTradeSummery || [];
    console.log(`[Cron] Fetched ${stocks.length} stocks from CSE`);

    let updatedCount = 0;
    for (const stock of stocks) {
      const symbol = stock.symbol;
      const lastTradedPrice = stock.price;

      if (symbol && lastTradedPrice !== undefined) {
        try {
          // Update the anchorPrice in Firestore using Admin SDK
          const stockRef = db.doc(`stocks/${symbol}`);
          await stockRef.set({
            anchorPrice: lastTradedPrice,
            lastSyncAt: new Date().toISOString()
          }, { merge: true });
          updatedCount++;
        } catch (e) {
          // console.warn(`Could not update anchorPrice for ${symbol}: ${e}`);
        }
      }
    }

    console.log(`[Cron] Successfully updated anchorPrice for ${updatedCount} stocks.`);
  } catch (error) {
    console.error("[Cron] Critical error during anchor price sync:", error);
  }
}

// Schedule the task for 3:30 PM Sri Lanka Time
// 30 15 * * * = 15:30 (3:30 PM)
cron.schedule('30 15 * * *', () => {
  syncAnchorPrices();
}, {
  timezone: "Asia/Colombo"
});

console.log("[Cron] Anchor Price Sync scheduled for 15:30 Asia/Colombo");
