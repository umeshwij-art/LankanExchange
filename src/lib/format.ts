const lkr = new Intl.NumberFormat('en-LK', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const int = new Intl.NumberFormat('en-LK', { maximumFractionDigits: 0 });
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

export const money = (n: number | null | undefined) => (n === null || n === undefined || !isFinite(n) ? '—' : lkr.format(n));
export const lkrText = (n: number | null | undefined) => (n === null || n === undefined ? '—' : `LKR ${money(n)}`);
export const whole = (n: number | null | undefined) => (n === null || n === undefined ? '—' : int.format(n));
export const short = (n: number | null | undefined) => (n === null || n === undefined ? '—' : compact.format(n));

export function signed(n: number, digits = 2) {
  const s = Math.abs(n).toFixed(digits);
  return n > 0 ? `+${s}` : n < 0 ? `−${s}` : s;
}

export const pct = (n: number | null | undefined, digits = 2) => (n === null || n === undefined || !isFinite(n) ? '—' : `${signed(n, digits)}%`);

export const tone = (n: number | null | undefined) =>
  n === null || n === undefined || n === 0 ? 'text-flat' : n > 0 ? 'text-up' : 'text-down';

/** "JKH.N0000" → "JKH" for compact display */
export const ticker = (symbol: string) => symbol.split('.')[0];

export function timeAgo(iso: string) {
  if (!iso) return '';
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

export function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(' ');
}
