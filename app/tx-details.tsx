// Transaction details: all recorded fields, edit and delete actions.
// Deleting a debt-linked transaction warns about dependent records.
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { StatusBarBand } from '../components/StatusBarBand';
import { Button, Card, ConfirmDialog, InfoRow, Toast } from '../components/ui';
import { useApp } from '../hooks/useAppContext';
import { useDefaultBack } from '../hooks/useBackHandler';
import { deleteTransaction, getTransaction, listRepaymentsForDebt } from '../database/repositories';
import { Transaction, txTypeName } from '../types';
import { colors, font, spacing } from '../utils/theme';

export default function TxDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { fmtMoney, fmtDate, notifyDataChanged } = useApp();
  const [tx, setTx] = useState<Transaction | null | undefined>(undefined);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [linkedRepayments, setLinkedRepayments] = useState(0);

  useDefaultBack();

  useEffect(() => {
    const numId = parseInt(id ?? '', 10);
    if (Number.isNaN(numId)) { setTx(null); return; }
    getTransaction(numId).then(async (t) => {
      setTx(t);
      if (t?.debtId) {
        try { setLinkedRepayments((await listRepaymentsForDebt(t.debtId)).length); } catch { /* ignore */ }
      }
    }).catch(() => setTx(null));
  }, [id]);

  const doDelete = async () => {
    if (!tx || busy) return;
    setBusy(true);
    try {
      await deleteTransaction(tx.id);
      notifyDataChanged();
      setBusy(false);
      router.back();
    } catch (e) {
      setBusy(false);
      setConfirmDelete(false);
      setToast(e instanceof Error ? e.message : 'Delete failed');
      setTimeout(() => setToast(null), 2000);
    }
  };

  const inflow = tx ? tx.type !== 'expense' && tx.type !== 'repayment_out' : true;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBarBand title="Transaction" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl * 2 }}>
        {tx === undefined ? (
          <Text style={[font.body, { color: colors.textMuted }]}>Loading...</Text>
        ) : tx === null ? (
          <Text style={font.body}>This transaction no longer exists.</Text>
        ) : (
          <>
            <Card style={{ alignItems: 'center', paddingVertical: spacing.xxl }}>
              <Text style={[font.label]}>AMOUNT</Text>
              <Text style={[font.balance, { marginTop: spacing.sm, color: inflow ? colors.income : colors.expense, fontSize: 32 }]}>
                {inflow ? '+' : '-'} {fmtMoney(tx.amountMinor)}
              </Text>
              <Text style={[font.caption, { marginTop: spacing.sm }]}>{txTypeName(tx.type)} - {fmtDate(tx.date)}</Text>
            </Card>

            <Card style={{ paddingVertical: spacing.sm, marginTop: spacing.lg }}>
              <InfoRow label="Description" value={tx.description || txTypeName(tx.type)} />
              <InfoRow label="Type" value={txTypeName(tx.type)} />
              <InfoRow label="Category" value={tx.category ?? '-'} />
              <InfoRow label="Person" value={tx.person ?? '-'} />
              <InfoRow label="Date" value={fmtDate(tx.date)} />
              <InfoRow label="Notes" value={tx.notes ?? '-'} />
              <InfoRow label="Recorded" value={fmtDate(tx.createdAt.slice(0, 10))} />
              <InfoRow label="Last updated" value={fmtDate(tx.updatedAt.slice(0, 10))} />
            </Card>

            {tx.debtId ? (
              <Text style={[font.caption, { marginTop: spacing.md, color: colors.textMuted }]}>
                Linked to borrowing record #{tx.debtId}. {linkedRepayments > 0 ? `That debt has ${linkedRepayments} repayment(s) on file.` : ''}
                Deleting this entry does not delete the debt itself - manage debts from the Home screen.
              </Text>
            ) : null}

            <View style={{ marginTop: spacing.xl, gap: spacing.sm }}>
              <Button label="Edit transaction" onPress={() => router.push({ pathname: '/edit-tx', params: { id: tx.id } })} testID="edit-tx" />
              <Button label="Delete transaction" variant="secondary" onPress={() => setConfirmDelete(true)} testID="delete-tx" />
              <Button label="Back" variant="ghost" onPress={() => router.back()} />
            </View>
          </>
        )}
      </ScrollView>

      <ConfirmDialog visible={confirmDelete} title="Delete this transaction?"
        message="Your balance and all reports will be recalculated immediately after deletion. This cannot be undone unless you have a backup."
        confirmLabel="Delete" danger busy={busy} onConfirm={doDelete} onCancel={() => setConfirmDelete(false)} />

      <Toast message={toast ?? ''} visible={!!toast} />
    </View>
  );
}

const styles = StyleSheet.create({});
