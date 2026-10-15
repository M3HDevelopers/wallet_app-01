// Financial calculation tests: balance, edits, deletions, borrowing,
// repayments, opening balances, and date-filtered reports.
import {
  cashEffect, computeBalance, computeBalanceAsOf, computeTotals,
  periodSummary, outstandingAsOf, categoryBreakdown, LedgerEntry,
} from '../utils/ledger';

const e = (type: LedgerEntry['type'], amountMinor: number, date: string, extra: object = {}): LedgerEntry & typeof extra =>
  ({ type, amountMinor, date, ...extra } as any);

describe('cash effects', () => {
  test('income types add cash, expense/repay subtract, opening adds', () => {
    expect(cashEffect('earned_income', 5000)).toBe(5000);
    expect(cashEffect('gift_allowance', 1000)).toBe(1000);
    expect(cashEffect('family_money', 1000)).toBe(1000);
    expect(cashEffect('borrowed_in', 9000)).toBe(9000);
    expect(cashEffect('opening_balance', 20000)).toBe(20000);
    expect(cashEffect('expense', 4000)).toBe(-4000);
    expect(cashEffect('repayment_out', 3000)).toBe(-3000);
  });

  test('rejects negative stored amounts', () => {
    expect(() => cashEffect('expense', -1)).toThrow();
  });
});

describe('balance derivation', () => {
  const entries = [
    e('opening_balance', 100000, '2026-01-01'),
    e('earned_income', 50000, '2026-01-05'),
    e('gift_allowance', 20000, '2026-01-06'),
    e('borrowed_in', 30000, '2026-01-07'),
    e('expense', 45000, '2026-01-08'),
    e('repayment_out', 10000, '2026-01-09'),
  ];

  test('current balance = inflows - outflows', () => {
    expect(computeBalance(entries)).toBe(100000 + 50000 + 20000 + 30000 - 45000 - 10000);
  });

  test('as-of balance excludes later transactions', () => {
    expect(computeBalanceAsOf(entries, '2026-01-07')).toBe(200000);
    expect(computeBalanceAsOf(entries, '2026-01-05')).toBe(150000);
  });

  test('editing an amount changes the derived balance', () => {
    const edited = entries.map((x) => (x === entries[4] ? e('expense', 50000, x.date) : x));
    expect(computeBalance(edited)).toBe(computeBalance(entries) - 5000);
  });

  test('deleting a transaction re-derives the balance', () => {
    const deleted = entries.filter((_, i) => i !== 3); // remove borrowed_in
    expect(computeBalance(deleted)).toBe(computeBalance(entries) - 30000);
  });

  test('many transactions keep exact integer precision', () => {
    const many: LedgerEntry[] = [];
    for (let i = 0; i < 10000; i++) many.push(e(i % 2 ? 'expense' : 'earned_income', 33, '2026-02-01'));
    const bal = computeBalance(many);
    expect(bal).toBe(5000 * 33 - 5000 * 33);
    // classic float trap: 0.1+0.2 style errors cannot occur in minor units
    expect(computeBalance([e('gift_allowance', 10, 'd'), e('gift_allowance', 20, 'd')])).toBe(30);
  });
});

describe('totals separation', () => {
  const entries = [
    e('opening_balance', 100000, '2026-01-01'),
    e('earned_income', 50000, '2026-01-05'),
    e('family_money', 20000, '2026-01-06'),
    e('borrowed_in', 30000, '2026-01-07'),
    e('expense', 45000, '2026-01-08'),
    e('repayment_out', 10000, '2026-01-09'),
  ];
  const debts = [{ originalAmountMinor: 30000 }];
  const reps = [{ amountMinor: 10000 }];
  const t = computeTotals(entries, debts, reps);

  test('opening balance is not counted as received income', () => {
    expect(t.receivedMinor).toBe(50000 + 20000 + 30000);
  });

  test('borrowing is separate from earned income', () => {
    expect(t.earnedMinor).toBe(50000);
    expect(t.borrowedTotalMinor).toBe(30000);
    expect(t.outstandingMinor).toBe(20000);
  });

  test('balance includes all cash movements', () => {
    expect(t.balanceMinor).toBe(145000);
  });
});

describe('period reports', () => {
  const entries = [
    e('earned_income', 100000, '2026-01-15'),
    e('expense', 40000, '2026-01-20', { category: 'Food' }),
    e('expense', 10000, '2026-02-01', { category: 'Food' }),
    e('borrowed_in', 50000, '2026-01-25'),
    e('repayment_out', 20000, '2026-01-28'),
  ];

  test('monthly totals use only the selected dates', () => {
    const jan = periodSummary(entries, '2026-01-01', '2026-01-31');
    expect(jan.inflowMinor).toBe(150000);
    expect(jan.earnedMinor).toBe(100000);
    expect(jan.expenseMinor).toBe(40000);
    expect(jan.borrowedInMinor).toBe(50000);
    expect(jan.repaidOutMinor).toBe(20000);
    expect(jan.netMinor).toBe(90000);
  });

  test('custom range boundaries are inclusive', () => {
    const r = periodSummary(entries, '2026-01-20', '2026-02-01');
    expect(r.expenseMinor).toBe(50000);
  });

  test('category breakdown per period', () => {
    const b = categoryBreakdown(entries as any, '2026-01-01', '2026-01-31');
    expect(b).toEqual([{ category: 'Food', totalMinor: 40000 }]);
  });

  test('outstanding debt as of a date', () => {
    const debts = [{ originalAmountMinor: 50000, borrowedDate: '2026-01-25' }];
    const reps = [{ amountMinor: 20000, date: '2026-01-28', debtId: 1 }];
    expect(outstandingAsOf(debts, reps, '2026-01-26')).toBe(50000);
    expect(outstandingAsOf(debts, reps, '2026-01-31')).toBe(30000);
    expect(outstandingAsOf(debts, reps, '2026-01-20')).toBe(0);
  });
});
