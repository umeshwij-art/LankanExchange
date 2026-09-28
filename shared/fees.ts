// Trading constants and fee maths.
//
// CSE equity trades carry roughly 1.12% in combined brokerage, exchange,
// CDS and SEC fees (for trades up to LKR 100M). We apply one flat rate on
// both sides so learners see the real cost of churning a position.
// Confirm against your broker's current fee sheet and adjust here only.

export const STARTING_CASH = 100_000;
export const FEE_RATE = 0.0112;

/** Buffer applied when reserving cash for a buy that fills at a future close. */
export const PRICE_BAND = 0.1;

/** Limit orders stay open for this many trading days. */
export const LIMIT_ORDER_TRADING_DAYS = 20;

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function fees(quantity: number, price: number): number {
  return round2(quantity * price * FEE_RATE);
}

/** Total cash needed to buy (gross + fees). */
export function buyCost(quantity: number, price: number): number {
  return round2(quantity * price + fees(quantity, price));
}

/** Cash received from a sale (gross − fees). */
export function sellProceeds(quantity: number, price: number): number {
  return round2(quantity * price - fees(quantity, price));
}

/** Break-even move needed to cover a round trip's fees, as a fraction. */
export function roundTripBreakEven(): number {
  return (1 + FEE_RATE) / (1 - FEE_RATE) - 1;
}
