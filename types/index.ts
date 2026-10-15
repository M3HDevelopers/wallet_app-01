// Shared domain types for Personal Wallet Manager

export type TxType =
  | 'opening_balance'
  | 'earned_income'
  | 'gift_allowance'
  | 'family_money'
  | 'person_money'
  | 'borrowed_in'
  | 'repayment_received'
  | 'other_income'
  | 'expense'
  | 'repayment_out';

export type CategoryKind = 'income' | 'expense' | 'general';

export interface Category {
  id: number;
  name: string;
  kind: CategoryKind;
  isDefault: number;
}

export interface Person {
  id: number;
  name: string;
  notes: string | null;
}

export interface Transaction {
  id: number;
  type: TxType;
  amountMinor: number; // minor units (paise); always > 0 except opening balance >= 0
  currency: string;
  categoryId: number | null;
  category?: string | null;
  personId: number | null;
  person?: string | null;
  description: string;
  notes: string | null;
  date: string; // YYYY-MM-DD
  createdAt: string;
  updatedAt: string;
  debtId: number | null;
}

export type DebtStatus = 'open' | 'settled';

export interface Debt {
  id: number;
  personId: number;
  personName?: string;
  originalAmountMinor: number;
  borrowedDate: string;
  dueDate: string | null;
  notes: string | null;
  status: DebtStatus;
  repaidMinor: number;
  outstandingMinor: number;
  createdAt: string;
  updatedAt: string;
}

export interface Repayment {
  id: number;
  debtId: number;
  amountMinor: number;
  date: string;
  notes: string | null;
  createdAt: string;
}

export interface Totals {
  receivedMinor: number; // lifetime money in (all inflow types incl. borrowing & opening)
  earnedMinor: number; // lifetime earned income only
  expenseMinor: number; // lifetime expenses
  outstandingMinor: number; // lifetime open debt
  repaidMinor: number; // lifetime repayments made
  borrowedTotalMinor: number; // lifetime borrowed
  balanceMinor: number; // current available balance
}

export interface PeriodSummary {
  inflowMinor: number;
  earnedMinor: number;
  expenseMinor: number;
  borrowedInMinor: number;
  repaidOutMinor: number;
  netMinor: number;
}

export interface CategoryBreakdownItem {
  category: string;
  totalMinor: number;
}

export const CASH_IN_TYPES: TxType[] = [
  'opening_balance',
  'earned_income',
  'gift_allowance',
  'family_money',
  'person_money',
  'borrowed_in',
  'repayment_received',
  'other_income',
];

export const CASH_OUT_TYPES: TxType[] = ['expense', 'repayment_out'];

export function txTypeName(t: TxType): string {
  switch (t) {
    case 'opening_balance': return 'Opening Balance';
    case 'earned_income': return 'Earned Income';
    case 'gift_allowance': return 'Gift / Allowance';
    case 'family_money': return 'Money from Family';
    case 'person_money': return 'Money from Person';
    case 'borrowed_in': return 'Borrowed Money';
    case 'repayment_received': return 'Repayment Received';
    case 'other_income': return 'Other Money Received';
    case 'expense': return 'Expense';
    case 'repayment_out': return 'Repayment Made';
  }
}

export function isCashIn(t: TxType): boolean {
  return CASH_IN_TYPES.includes(t);
}
