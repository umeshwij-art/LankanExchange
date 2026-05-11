import { db, auth, doc, setDoc, collection, addDoc, OperationType, handleFirestoreError } from './firebase';
import { GoogleGenAI, Type } from "@google/genai";

const COMMISSION_RATE = 0.00112; // 0.112%

export interface TradeRequest {
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price: number;
}

export const executeTrade = async (request: TradeRequest, currentProfile: any) => {
  if (!auth.currentUser) throw new Error("Authentication required");

  const { symbol, type, quantity, price } = request;
  const totalValue = quantity * price;
  const commission = totalValue * COMMISSION_RATE;
  const totalCost = type === 'buy' ? totalValue + commission : totalValue - commission;

  // 1. Validate funds/holdings
  if (type === 'buy' && currentProfile.virtualBalance < totalCost) {
    throw new Error("Insufficient virtual balance");
  }

  if (type === 'sell') {
    const holding = currentProfile.portfolio.find((p: any) => p.symbol === symbol);
    if (!holding || holding.quantity < quantity) {
      throw new Error("Insufficient stock holdings");
    }
  }

  // 2. AI Coach Critique (Gemini)
  let aiCritique = "Trade executed successfully.";
  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: `Provide a 1-sentence behavioral critique for this mock trade: ${type.toUpperCase()} ${quantity} shares of ${symbol} at LKR ${price}. Current balance: LKR ${currentProfile.virtualBalance}.`,
      config: {
        systemInstruction: "You are a professional trading coach. Be concise, insightful, and slightly critical if the trade seems impulsive or poorly timed. If it's a good trade, be encouraging."
      }
    });
    aiCritique = response.text || aiCritique;
  } catch (error) {
    console.error("AI Coaching failed:", error);
  }

  // 3. Update Portfolio
  const newPortfolio = [...currentProfile.portfolio];
  const holdingIndex = newPortfolio.findIndex((p: any) => p.symbol === symbol);

  if (type === 'buy') {
    if (holdingIndex >= 0) {
      const existing = newPortfolio[holdingIndex];
      const newQuantity = existing.quantity + quantity;
      const newAvgPrice = ((existing.avgPrice * existing.quantity) + (price * quantity)) / newQuantity;
      newPortfolio[holdingIndex] = { ...existing, quantity: newQuantity, avgPrice: newAvgPrice };
    } else {
      newPortfolio.push({ symbol, quantity, avgPrice: price });
    }
  } else {
    const existing = newPortfolio[holdingIndex];
    const newQuantity = existing.quantity - quantity;
    if (newQuantity === 0) {
      newPortfolio.splice(holdingIndex, 1);
    } else {
      newPortfolio[holdingIndex] = { ...existing, quantity: newQuantity };
    }
  }

  // 4. Update Firestore
  const userDocRef = doc(db, 'users', auth.currentUser.uid);
  const newBalance = type === 'buy' ? currentProfile.virtualBalance - totalCost : currentProfile.virtualBalance + totalCost;

  try {
    // Update User Profile
    await setDoc(userDocRef, {
      virtualBalance: newBalance,
      portfolio: newPortfolio
    }, { merge: true });

    // Record Trade History
    await addDoc(collection(db, 'trades'), {
      uid: auth.currentUser.uid,
      symbol,
      type,
      quantity,
      price,
      commission,
      total: totalCost,
      aiCritique,
      timestamp: new Date().toISOString()
    });

    return { success: true, aiCritique };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `trades`);
    throw error;
  }
};
