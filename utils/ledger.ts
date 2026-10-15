// Pure financial ledger calculations. No React Native imports so this module
// can be unit tested directly with ts-jest.
import { TxType } from '../types';

export const CASH_IN: TxType[] = [
  'opening_balance',
  'earned_income',
  'gift_allowance',
  'family_money',
  'person_money',
  'borrowed_in',
  'repayment_received',
  'other_income',
];

export const CASH_OUT: TxType[] = ['expense', 'repayment_out'];

/** Signed cash effect of a transaction, in minor units. */
export function cashEffect(type: TxType, amountMinor: number): number {
  if (amountMinor < 0) throw new Error('Transaction amounts must be non-negative');
  if (CASH_IN.includes(type)) return amountMinor;
  if (CASH_OUT.includes(type)) return -amountMinor;
  return 0;
}

export interface LedgerEntry {
  type: TxType;
  amountMinor: number;
  date: string; // YYYY-MM-DD
}

/** Current balance = sum of all cash effects. Integer arithmetic only. */
export function computeBalance(entries: LedgerEntry[]): number {
  let bal = 0;
  for (const e of entries) bal += cashEffect(e.type, e.amountMinor);
  return bal;
}

/** Balance as of the end of `asOfDate` (inclusive). */
export function computeBalanceAsOf(entries: LedgerEntry[], asOfDate: string): number {
  let bal = 0;
  for (const e of entries) {
    if (e.date <= asOfDate) bal += cashEffect(e.type, e.amountMinor);
  }
  return bal;
}

export interface TotalsResult {
  receivedMinor: number;   // lifetime money received (all inflows except opening balance)
  earnedMinor: number;     // lifetime earned income only
  expenseMinor: number;    // lifetime expenses
  borrowedTotalMinor: number; // lifetime borrowed principal
  repaidMinor: number;     // lifetime repayments made
  outstandingMinor: number; // borrowed minus repaid
  balanceMinor: number;    // current available balance
}

export function computeTotals(
  entries: LedgerEntry[],
  debts: { originalAmountMinor: number }[] = [],
  repayments: { amountMinor: number }[] = []
): TotalsResult {
  let received = 0, earned = 0, expense = 0, borrowedIn = 0, repaidOut = 0;
  for (const e of entries) {
    switch (e.type) {
      case 'earned_income': earned += e.amountMinor; received += e.amountMinor; break;
      case 'gift_allowance':
      case 'family_money':
      case 'person_money':
      case 'repayment_received':
      case 'other_income': received += e.amountMinor; break;
      case 'borrowed_in': borrowedIn += e.amountMinor; received += e.amountMinor; break;
      case 'expense': expense += e.amountMinor; break;
      case 'repayment_out': repaidOut += e.amountMinor; break;
      default: break; // opening_balance excluded from "received"
    }
  }
  const totalBorrowed = debts.reduce((s, d) => s + d.originalAmountMinor, 0);
  const totalRepaid = repayments.reduce((s, r) => s + r.amountMinor, 0);
  return {
    receivedMinor: received,
    earnedMinor: earned,
    expenseMinor: expense,
    borrowedTotalMinor: totalBorrowed,
    repaidMinor: totalRepaid,
    outstandingMinor: totalBorrowed - totalRepaid,
    balanceMinor: computeBalance(entries),
  };
}

export interface PeriodResult {
  inflowMinor: number;
  earnedMinor: number;
  expenseMinor: number;
  borrowedInMinor: number;
  repaidOutMinor: number;
  netMinor: number;
}

/** Totals for transactions whose date is within [start, end] inclusive. */
export function periodSummary(entries: LedgerEntry[], start: string, end: string): PeriodResult {
  const res: PeriodResult = {
    inflowMinor: 0, earnedMinor: 0, expenseMinor: 0,
    borrowedInMinor: 0, repaidOutMinor: 0, netMinor: 0,
  };
  for (const e of entries) {
    if (e.date < start || e.date > end) continue;
    const eff = cashEffect(e.type, e.amountMinor);
    res.netMinor += eff;
    switch (e.type) {
      case 'earned_income': res.earnedMinor += e.amountMinor; res.inflowMinor += e.amountMinor; break;
      case 'borrowed_in': res.borrowedInMinor += e.amountMinor; res.inflowMinor += e.amountMinor; break;
      case 'expense': res.expenseMinor += e.amountMinor; break;
      case 'repayment_out': res.repaidOutMinor += e.amountMinor; break;
      default:
        if (eff > 0) res.inflowMinor += e.amountMinor;
        break;
    }
  }
  return res;
}

/** Outstanding debt as of a reporting date, using debt/borrow dates and repayment dates. */
export function outstandingAsOf(
  debts: { originalAmountMinor: number; borrowedDate: string }[],
  repayments: { amountMinor: number; date: string; debtId: number }[],
  asOfDate: string
): number {
  let out = 0;
  for (const d of debts) {
    if (d.borrowedDate <= asOfDate) out += d.originalAmountMinor;
  }
  for (const r of repayments) {
    if (r.date <= asOfDate) out -= r.amountMinor;
  }
  return Math.max(out, 0);
}

/** Category breakdown of expenses within a period. Key: category name. */
export function categoryBreakdown(
  entries: (LedgerEntry & { category?: string | null })[],
  start: string,
  end: string
): { category: string; totalMinor: number }[] {
  const map = new Map<string, number>();
  for (const e of entries) {
    if (e.type !== 'expense') continue;
    if (e.date < start || e.date > end) continue;
    const key = e.category && e.category.length ? e.category : 'Uncategorized';
    map.set(key, (map.get(key) ?? 0) + e.amountMinor);
  }
  return Array.from(map.entries())
    .map(([category, totalMinor]) => ({ category, totalMinor }))
    .sort((a, b) => b.totalMinor - a.totalMinor);
}
