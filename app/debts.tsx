// Borrowed money: outstanding summary, open + settled debts with repayment history.
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { Button, Card, ConfirmDialog, Divider, EmptyState, LoadingScreen, Screen, SectionTitle } from '../components/ui';
import { useApp } from '../hooks/useAppContext';
import { deleteDebt, getDebt, listDebts, listRepaymentsForDebt } from '../database/repositories';
import { Debt, Repayment } from '../types';
import { colors, font, spacing } from '../utils/theme';

export default function DebtsScreen() {
  const insets = useSafeAreaInsets();
  const { fmtMoney, notifyDataChanged, refreshTick } = useApp();
  const [debts, setDebts] = useState<Debt[] | null>(null);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [history, setHistory] = useState<Repayment[]>([]);
  const [confirmDelete, setConfirmDelete] = useState<Debt | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(() => { listDebts().then(setDebts); }, []);
  useEffect(() => { load(); }, [load, refreshTick]);

  const toggle = async (d: Debt) => {
    if (expanded === d.id) { setExpanded(null); return; }
    setExpanded(d.id);
    setHistory(await listRepaymentsForDebt(d.id));
  };

  const doDelete = async () => {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      await deleteDebt(confirmDelete.id);
      notifyDataChanged();
      setConfirmDelete(null);
      load();
    } finally { setDeleting(false); }
  };

  if (!debts) return <LoadingScreen />;

  const open = debts.filter((d) => d.status === 'open');
  const settled = debts.filter((d) => d.status === 'settled');
  const totalOutstanding = open.reduce((s, d) => s + d.outstandingMinor, 0);

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg }}>
        <Text style={font.screenTitle}>Borrowed Money</Text>

        <Card style={{ marginTop: spacing.lg, backgroundColor: colors.surfaceAlt }}>
          <Text style={font.label}>TOTAL OUTSTANDING</Text>
          <Text style={[font.balance, { marginTop: spacing.sm }, totalOutstanding > 0 ? { color: colors.expense } : undefined]}>
            {fmtMoney(totalOutstanding)}
          </Text>
        </Card>

        <View style={{ flexDirection: 'row', gap: spacing.md, marginTop: spacing.lg }}>
          <View style={{ flex: 1 }}><Button label="Record Borrowing" onPress={() => router.push('/borrow')} testID="debts-add" /></View>
          <View style={{ flex: 1 }}><Button label="Make Repayment" variant="secondary" onPress={() => router.push('/repay')} disabled={open.length === 0} /></View>
        </View>

        <SectionTitle title={`Open (${open.length})`} />
        {open.length === 0 ? (
          <EmptyState title="No open borrowings" message="When you borrow money, record it here to keep track of what you owe." />
        ) : open.map((d) => (
          <DebtCard key={d.id} debt={d} expanded={expanded === d.id} history={expanded === d.id ? history : []}
            onToggle={() => toggle(d)} fmtMoney={fmtMoney} onDelete={() => setConfirmDelete(d)} />
        ))}

        {settled.length > 0 ? (
          <>
            <SectionTitle title={`Settled (${settled.length})`} />
            {settled.map((d) => (
              <DebtCard key={d.id} debt={d} expanded={expanded === d.id} history={expanded === d.id ? history : []}
                onToggle={() => toggle(d)} fmtMoney={fmtMoney} onDelete={() => setConfirmDelete(d)} />
            ))}
          </>
        ) : null}
      </View>

      <ConfirmDialog visible={!!confirmDelete} title="Delete borrowing?"
        message={`This removes the debt record for ${confirmDelete?.personName ?? ''} and its repayments. The related cash transactions will remain in your history. This cannot be undone.`}
        confirmLabel="Delete" danger busy={deleting}
        onCancel={() => setConfirmDelete(null)} onConfirm={doDelete} />
    </Screen>
  );
}

function DebtCard({ debt, expanded, history, onToggle, fmtMoney, onDelete }: {
  debt: Debt; expanded: boolean; history: Repayment[]; onToggle: () => void;
  fmtMoney: (m: number) => string; onDelete: () => void;
}) {
  const progress = debt.originalAmountMinor > 0 ? Math.min(1, debt.repaidMinor / debt.originalAmountMinor) : 1;
  const overdue = debt.status === 'open' && debt.dueDate != null && debt.dueDate < new Date().toISOString().slice(0, 10);
  return (
    <Animated.View entering={FadeInDown.duration(200)} style={{ marginBottom: spacing.md }}>
      <Card style={{ padding: 0 }}>
        <Pressable onPress={onToggle} style={{ padding: spacing.lg, flexDirection: 'row', alignItems: 'center', gap: spacing.md }} accessibilityRole="button">
          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              <Text style={font.bodyMedium}>{debt.personName}</Text>
              {debt.status === 'settled' ? <Text style={styles.badgeSettled}>SETTLED</Text> : overdue ? <Text style={styles.badgeOverdue}>OVERDUE</Text> : null}
            </View>
            <Text style={[font.caption, { color: colors.textMuted, marginTop: 3 }]}>
              Borrowed {fmtMoney(debt.originalAmountMinor)} - Outstanding {fmtMoney(debt.outstandingMinor)}{debt.dueDate ? ` - Due ${debt.dueDate}` : ''}
            </Text>
            <View style={styles.progressTrack}><View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: debt.status === 'settled' ? colors.income : colors.accent }]} /></View>
          </View>
          {expanded ? <ChevronDown size={18} color={colors.textMuted} /> : <ChevronRight size={18} color={colors.textMuted} />}
        </Pressable>
        {expanded ? (
          <View style={{ borderTopWidth: 1, borderColor: colors.border, padding: spacing.lg }}>
            <Text style={font.label}>REPAYMENT HISTORY</Text>
            {history.length === 0 ? (
              <Text style={[font.body, { color: colors.textMuted, marginTop: spacing.sm }]}>No repayments recorded yet.</Text>
            ) : history.map((r, i) => (
              <View key={r.id}>
                {i > 0 ? <Divider /> : null}
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingVertical: spacing.sm }}>
                  <Text style={font.body}>{r.date}{r.notes ? ` - ${r.notes}` : ''}</Text>
                  <Text style={[font.amount, { color: colors.income }]}>{fmtMoney(r.amountMinor)}</Text>
                </View>
              </View>
            ))}
            <View style={{ marginTop: spacing.md }}>
              <Button label="Delete record" variant="danger" onPress={onDelete} />
            </View>
          </View>
        ) : null}
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badgeSettled: { fontSize: 10, fontWeight: '700', color: colors.income, borderWidth: 1, borderColor: colors.income, paddingHorizontal: 6, paddingVertical: 1 },
  badgeOverdue: { fontSize: 10, fontWeight: '700', color: colors.expense, borderWidth: 1, borderColor: colors.expense, paddingHorizontal: 6, paddingVertical: 1 },
  progressTrack: { height: 4, backgroundColor: colors.border, marginTop: spacing.sm },
  progressFill: { height: 4 },
});
