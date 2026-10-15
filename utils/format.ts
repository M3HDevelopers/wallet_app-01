// Money and date utilities. All arithmetic uses integer minor units (paise).

export const CURRENCIES: Record<string, { symbol: string; label: string }> = {
  PKR: { symbol: 'Rs.', label: 'PKR' },
  INR: { symbol: 'Rs.', label: 'INR' },
  USD: { symbol: '$', label: 'USD' },
  EUR: { symbol: '\u20ac', label: 'EUR' },
  GBP: { symbol: '\u00a3', label: 'GBP' },
  AED: { symbol: 'AED', label: 'AED' },
};

/** Convert a rupee/dollar-style decimal string to integer minor units. Returns null when invalid. */
export function parseAmountToMinor(input: string): number | null {
  const s = (input || '').trim().replace(/[\s,]/g, '');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const [whole, frac = ''] = s.split('.');
  const cents = parseInt((frac + '00').slice(0, 2), 10);
  const value = parseInt(whole, 10) * 100 + cents;
  if (!Number.isSafeInteger(value)) return null;
  return value;
}

/** Format minor units as an amount string without the currency symbol, e.g. "12,450.00" */
export function formatMinor(minor: number, opts?: { sign?: boolean }): string {
  const neg = minor < 0;
  const abs = Math.abs(minor);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const wholeStr = String(whole).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const base = `${wholeStr}.${String(frac).padStart(2, '0')}`;
  if (neg) return `-${base}`;
  if (opts?.sign) return `+${base}`;
  return base;
}

/** Format minor units with currency prefix, e.g. "Rs. 12,450.00" */
export function formatMoney(minor: number, currencyCode = 'PKR', opts?: { sign?: boolean }): string {
  const c = CURRENCIES[currencyCode] ?? CURRENCIES.PKR;
  return `${c.symbol} ${formatMinor(minor, opts)}`;
}

export function currencySymbol(currencyCode = 'PKR'): string {
  return (CURRENCIES[currencyCode] ?? CURRENCIES.PKR).symbol;
}

// ---- Dates --------------------------------------------------------------

export function todayISO(): string {
  const d = new Date();
  return toISODate(d);
}

export function toISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTHS_FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

export type DateFormat = 'iso' | 'dmy' | 'mdy' | 'long';

/** Format a YYYY-MM-DD string according to the user's chosen date format. */
export function formatDate(iso: string, fmt: DateFormat = 'dmy'): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  const [, y, mo, d] = m;
  switch (fmt) {
    case 'iso': return `${y}-${mo}-${d}`;
    case 'mdy': return `${MONTHS[parseInt(mo, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
    case 'long': return `${parseInt(d, 10)} ${MONTHS_FULL[parseInt(mo, 10) - 1]} ${y}`;
    case 'dmy':
    default: return `${d} ${MONTHS[parseInt(mo, 10) - 1]} ${y}`;
  }
}

export function currentMonthRange(now = new Date()): { start: string; end: string } {
  const y = now.getFullYear();
  const m = now.getMonth();
  const start = toISODate(new Date(y, m, 1));
  const end = toISODate(new Date(y, m + 1, 0));
  return { start, end };
}

export function monthLabel(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${MONTHS_FULL[parseInt(m[2], 10) - 1]} ${m[1]}`;
}

export function greetingForNow(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}
