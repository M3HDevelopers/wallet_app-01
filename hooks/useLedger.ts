// Loads all ledger entries + debts + repayments and derives totals.
import { useCallback, useEffect, useState } from 'react';
import { getAllLedgerEntries, listAllRepayments, listDebts } from '../database/repositories';
import { computeTotals, TotalsResult } from '../utils/ledger';
import { Debt, Repayment, Transaction } from '../types';
import { useApp } from './useAppContext';

export function useLedger() {
  const { refreshTick } = useApp();
  const [entries, setEntries] = useState<Transaction[] | null>(null);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [repayments, setRepayments] = useState<(Repayment & { personName: string })[]>([]);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const [e, d, r] = await Promise.all([getAllLedgerEntries(), listDebts(), listAllRepayments()]);
      setEntries(e); setDebts(d); setRepayments(r); setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    }
  }, []);

  useEffect(() => { reload(); }, [reload, refreshTick]);

  const totals: TotalsResult = entries
    ? computeTotals(entries.map((t) => ({ type: t.type, amountMinor: t.amountMinor, date: t.date })), debts, repayments)
    : { receivedMinor: 0, earnedMinor: 0, expenseMinor: 0, borrowedTotalMinor: 0, repaidMinor: 0, outstandingMinor: 0, balanceMinor: 0 };

  return { entries, debts, repayments, totals, loading: entries === null, error, reload };
}
