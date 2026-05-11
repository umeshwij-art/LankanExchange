
import { db, auth, doc, setDoc, collection, addDoc, getDocs, query, where, updateDoc, deleteDoc, getDoc, OperationType, handleFirestoreError } from './firebase';
import { GoogleGenAI } from "@google/genai";

const COMMISSION_RATE = 0.00112; // 0.112%

export interface OrderRequest {
  symbol: string;
  type: 'buy' | 'sell';
  orderType: 'market' | 'limit';
  quantity: number;
  limitPrice?: number;
}

export const placeOrder = async (request: OrderRequest, currentProfile: any) => {
  if (!auth.currentUser) throw new Error("Authentication required");

  const { symbol, type, orderType, quantity, limitPrice } = request;
  
  if (orderType === 'limit' && !limitPrice) {
    throw new Error("Limit price is required for limit orders");
  }

  // CSE Rules: Check holdings for ALL sell orders
  if (type === 'sell') {
    const q = query(collection(db, 'positions'), where('uid', '==', auth.currentUser.uid), where('symbol', '==', symbol));
    const posSnap = await getDocs(q);
    
    if (posSnap.empty) {
      throw new Error("You do not own this security in your portfolio.");
    }
    
    const posData = posSnap.docs[0].data();
    const availableQty = posData.quantity - (posData.reservedQuantity || 0);
    
    if (availableQty < quantity) {
      throw new Error(`Insufficient sellable quantity. Available: ${availableQty}`);
    }

    if (orderType === 'limit') {
      // Lock shares for sell limit order
      await updateDoc(posSnap.docs[0].ref, {
        reservedQuantity: (posData.reservedQuantity || 0) + quantity
      });
    }
  }

  if (orderType === 'market') {
    return executeTrade({
      symbol,
      type,
      quantity,
      price: request.limitPrice || 0,
      orderType: 'market'
    }, currentProfile);
  }

  // Limit Order Logic (Buy)
  if (type === 'buy') {
    const totalValue = quantity * (limitPrice || 0);
    const commission = totalValue * COMMISSION_RATE;
    const totalCost = totalValue + commission;

    if (currentProfile.availableCash < totalCost) {
      throw new Error("Insufficient available cash");
    }

    try {
      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userDocRef, {
        availableCash: currentProfile.availableCash - totalCost,
        reservedCash: currentProfile.reservedCash + totalCost
      });

      await addDoc(collection(db, 'orders'), {
        uid: auth.currentUser.uid,
        symbol,
        type: 'buy',
        orderType: 'limit',
        quantity,
        limitPrice,
        status: 'pending',
        timestamp: new Date().toISOString()
      });

      return { success: true, message: "Buy limit order placed" };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
      throw error;
    }
  } else {
    // Sell Limit Order (Holdings already checked and locked above)
    try {
      await addDoc(collection(db, 'orders'), {
        uid: auth.currentUser.uid,
        symbol,
        type: 'sell',
        orderType: 'limit',
        quantity,
        limitPrice,
        status: 'pending',
        timestamp: new Date().toISOString()
      });

      return { success: true, message: "Sell limit order placed" };
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'orders');
      throw error;
    }
  }
};

export const cancelOrder = async (orderId: string, currentProfile: any) => {
  if (!auth.currentUser) throw new Error("Authentication required");

  try {
    const orderRef = doc(db, 'orders', orderId);
    const orderSnap = await getDoc(orderRef);
    if (!orderSnap.exists()) throw new Error("Order not found");
    
    const order = orderSnap.data();
    if (order.status !== 'pending') throw new Error("Order cannot be cancelled");

    if (order.type === 'buy') {
      const totalValue = order.quantity * order.limitPrice;
      const commission = totalValue * COMMISSION_RATE;
      const totalCost = totalValue + commission;

      const userDocRef = doc(db, 'users', auth.currentUser.uid);
      await updateDoc(userDocRef, {
        availableCash: currentProfile.availableCash + totalCost,
        reservedCash: currentProfile.reservedCash - totalCost
      });
    } else if (order.type === 'sell' && order.orderType === 'limit') {
      // Release locked shares
      const q = query(collection(db, 'positions'), where('uid', '==', auth.currentUser.uid), where('symbol', '==', order.symbol));
      const posSnap = await getDocs(q);
      if (!posSnap.empty) {
        const posDoc = posSnap.docs[0];
        await updateDoc(posDoc.ref, {
          reservedQuantity: Math.max(0, (posDoc.data().reservedQuantity || 0) - order.quantity)
        });
      }
    }

    await updateDoc(orderRef, { status: 'cancelled' });
    return { success: true };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'orders');
    throw error;
  }
};

export const executeTrade = async (trade: any, currentProfile: any) => {
  const { symbol, type, quantity, price, orderType, orderId } = trade;
  const uid = auth.currentUser?.uid || trade.uid;
  if (!uid) throw new Error("User ID required");

  const totalValue = quantity * price;
  const commission = totalValue * COMMISSION_RATE;
  const totalCost = type === 'buy' ? totalValue + commission : totalValue - commission;

  try {
    const q = query(collection(db, 'positions'), where('uid', '==', uid), where('symbol', '==', symbol));
    const posSnap = await getDocs(q);
    
    if (type === 'buy') {
      if (!posSnap.empty) {
        const posDoc = posSnap.docs[0];
        const existing = posDoc.data();
        const newQuantity = existing.quantity + quantity;
        const newAvgPrice = ((existing.avgPrice * existing.quantity) + (price * quantity)) / newQuantity;
        await updateDoc(posDoc.ref, {
          quantity: newQuantity,
          avgPrice: newAvgPrice,
          totalCost: existing.totalCost + totalCost,
          lastUpdated: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'positions'), {
          uid,
          symbol,
          quantity,
          reservedQuantity: 0,
          avgPrice: price,
          totalCost: totalCost,
          lastUpdated: new Date().toISOString()
        });
      }

      const userDocRef = doc(db, 'users', uid);
      if (orderType === 'limit') {
        const reservedUsed = (quantity * trade.limitPrice) * (1 + COMMISSION_RATE);
        await updateDoc(userDocRef, {
          reservedCash: currentProfile.reservedCash - reservedUsed
        });
      } else {
        await updateDoc(userDocRef, {
          availableCash: currentProfile.availableCash - totalCost
        });
      }
    } else {
      // Sell
      if (posSnap.empty) throw new Error("No position to sell");
      const posDoc = posSnap.docs[0];
      const existing = posDoc.data();
      const newQuantity = existing.quantity - quantity;
      const newReservedQuantity = orderType === 'limit' ? Math.max(0, (existing.reservedQuantity || 0) - quantity) : (existing.reservedQuantity || 0);
      
      const realizedPL = (price - existing.avgPrice) * quantity - commission;

      if (newQuantity <= 0) {
        await deleteDoc(posDoc.ref);
      } else {
        await updateDoc(posDoc.ref, {
          quantity: newQuantity,
          reservedQuantity: newReservedQuantity,
          lastUpdated: new Date().toISOString()
        });
      }

      const userDocRef = doc(db, 'users', uid);
      await updateDoc(userDocRef, {
        availableCash: currentProfile.availableCash + totalCost,
        totalRealizedPL: (currentProfile.totalRealizedPL || 0) + realizedPL
      });
    }

    // AI Coach Critique
    let aiCritique = "Trade executed successfully.";
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: `Provide a 1-sentence behavioral critique for this mock trade: ${type.toUpperCase()} ${quantity} shares of ${symbol} at LKR ${price}.`,
        config: {
          systemInstruction: "You are a professional trading coach. Be concise and insightful."
        }
      });
      aiCritique = response.text || aiCritique;
    } catch (error) {
      console.error("AI Coaching failed:", error);
    }

    await addDoc(collection(db, 'trades'), {
      uid,
      symbol,
      type,
      quantity,
      price,
      commission,
      total: totalCost,
      aiCritique,
      timestamp: new Date().toISOString()
    });

    if (orderId) {
      await updateDoc(doc(db, 'orders', orderId), { status: 'filled' });
    }

    return { success: true, aiCritique };
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'trades');
    throw error;
  }
};

export const checkLimitOrders = async (currentPrices: Record<string, number>, currentProfile: any) => {
  if (!auth.currentUser) return;

  const q = query(
    collection(db, 'orders'), 
    where('uid', '==', auth.currentUser.uid), 
    where('status', '==', 'pending')
  );
  
  const querySnapshot = await getDocs(q);
  
  for (const orderDoc of querySnapshot.docs) {
    const order = orderDoc.data();
    const currentPrice = currentPrices[order.symbol];
    
    if (!currentPrice) continue;

    let shouldExecute = false;
    if (order.type === 'buy' && currentPrice <= order.limitPrice) {
      shouldExecute = true;
    } else if (order.type === 'sell' && currentPrice >= order.limitPrice) {
      shouldExecute = true;
    }

    if (shouldExecute) {
      console.log(`Executing limit order for ${order.symbol} at ${currentPrice}`);
      await executeTrade({
        ...order,
        price: currentPrice,
        orderId: orderDoc.id
      }, currentProfile);
    }
  }
};
