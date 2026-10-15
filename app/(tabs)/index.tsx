// Home dashboard: greeting, current balance, lifetime + month summaries, quick actions, recent transactions.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, Eye, EyeOff, HandCoins, Lock, Plus, Repeat } from 'lucide-react-native';
import { Button, Card, EmptyState, SectionTitle } from '../../components/ui';
import { TransactionRow } from '../../components/TransactionRow';
import { AnimatedAmount } from '../../components/AnimatedAmount';
import { useApp } from '../../hooks/useAppContext';
import { useLedger } from '../../hooks/useLedger';
import { useAuth } from '../auth/AuthContext';
import { colors, font, spacing } from '../../utils/theme';
import { currentMonthRange, greetingForNow, todayISO } from '../../utils/format';
import { periodSummary } from '../../utils/ledger';
import { getSetting, setSetting } from '../../database/db';

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { fmtMoney, fmtDate, hideBalancesDefault, refreshTick } = useApp();
  const { lockNow } = useAuth();
  const { totals, entries, loading, error } = useLedger();
  const [hidden, setHidden] = useState(hideBalancesDefault);
  const [setupDismissed, setSetupDismissed] = useState(true);

  useEffect(() => { setHidden(hideBalancesDefault); }, [hideBalancesDefault]);
  useEffect(() => {
    getSetting('setup_complete').then((v) => setSetupDismissed(v === '1'));
  }, [refreshTick]);

  const month = useMemo(() => {
    if (!entries) return null;
    const { start, end } = currentMonthRange();
    return periodSummary(entries.map((t) => ({ type: t.type, amountMinor: t.amountMinor, date: t.date })), start, end);
  }, [entries]);

  const recent = useMemo(() => (entries ?? []).slice().reverse().slice(0, 8), [entries]);
  const hasAny = (entries?.length ?? 0) > 0;

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={{ paddingBottom: spacing.xxxl * 2 }}>
      <View style={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg }}>
        {/* Header */}
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={[font.body, { color: colors.textMuted }]}>{greetingForNow()}</Text>
            <Text style={styles.date}>{fmtDate(todayISO())}</Text>
          </View>
          <Pressable onPress={() => router.push('/settings')} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel="Settings">
            <Lock size={18} color={colors.text} />
          </Pressable>
        </View>

        {/* Current balance */}
        <Card style={{ marginTop: spacing.xl }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text style={font.label}>CURRENT BALANCE</Text>
            <Pressable onPress={() => setHidden((h) => !h)} hitSlop={8} accessibilityRole="button" accessibilityLabel={hidden ? 'Show balance' : 'Hide balance'}>
              {hidden ? <EyeOff size={16} color={colors.textMuted} /> : <Eye size={16} color={colors.textMuted} />}
            </Pressable>
          </View>
          <AnimatedAmount
            value={totals.balanceMinor}
            hidden={hidden}
            format={(v) => fmtMoney(v)}
            style={[font.balance, { marginTop: spacing.sm }, totals.balanceMinor < 0 ? { color: colors.expense } : undefined]}
          />
          {!setupDismissed && hasAny !== undefined && !loading ? (
            <Pressable onPress={() => router.push('/setup-balance')} style={{ marginTop: spacing.md }}>
              <Text style={{ color: colors.accent, fontWeight: '600', fontSize: 13 }}>Set your opening balance - View</Text>
            </Pressable>
          ) : null}
        </Card>

        {/* Quick actions */}
        <View style={styles.actionsGrid}>
          <QuickAction icon={ArrowDownLeft} label="Add Money" onPress={() => router.push('/add-money')} testID="qa-add-money" />
          <QuickAction icon={ArrowUpRight} label="Add Expense" onPress={() => router.push('/add-expense')} testID="qa-add-expense" />
          <QuickAction icon={HandCoins} label="Borrowing" onPress={() => router.push('/borrow')} testID="qa-borrow" />
          <QuickAction icon={Repeat} label="Repayment" onPress={() => router.push('/repay')} testID="qa-repay" />
        </View>

        {/* Lifetime summary */}
        <SectionTitle title="Lifetime Summary" />
        <Card style={{ paddingVertical: spacing.sm }}>
          <SummaryLine label="Total money received" value={fmtMoney(totals.receivedMinor)} hidden={hidden} />
          <SummaryLine label="Earned income" value={fmtMoney(totals.earnedMinor)} hidden={hidden} color={colors.income} />
          <SummaryLine label="Total expenses" value={fmtMoney(totals.expenseMinor)} hidden={hidden} color={colors.expense} />
          <SummaryLine label="Outstanding borrowed" value={fmtMoney(totals.outstandingMinor)} hidden={hidden} color={totals.outstandingMinor > 0 ? colors.expense : undefined} last />
        </Card>

        {/* Month summary */}
        {month ? (
          <>
            <SectionTitle title="This Month" />
            <Card style={{ paddingVertical: spacing.sm }}>
              <SummaryLine label="Received this month" value={fmtMoney(month.inflowMinor)} hidden={hidden} />
              <SummaryLine label="Earned this month" value={fmtMoney(month.earnedMinor)} hidden={hidden} />
              <SummaryLine label="Spent this month" value={fmtMoney(month.expenseMinor)} hidden={hidden} />
              <SummaryLine label="Net movement" value={fmtMoney(month.netMinor, { sign: true })} hidden={hidden} color={month.netMinor >= 0 ? colors.income : colors.expense} last />
            </Card>
          </>
        ) : null}

        {/* Borrowed money entry point */}
        <SectionTitle title="Borrowed Money" action="Manage" onAction={() => router.push('/debts')} />
        <Pressable onPress={() => router.push('/debts')}>
          <Card style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View>
              <Text style={font.bodyMedium}>
                {totals.outstandingMinor > 0 ? `${fmtMoney(totals.outstandingMinor)} outstanding` : 'No outstanding debt'}
              </Text>
              <Text style={[font.caption, { color: colors.textMuted, marginTop: 2 }]}>
                Borrowed {fmtMoney(totals.borrowedTotalMinor)} total - Repaid {fmtMoney(totals.repaidMinor)}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textMuted} />
          </Card>
        </Pressable>

        {/* Recent transactions */}
        <SectionTitle title="Recent Transactions" action={hasAny ? 'View All' : undefined} onAction={() => router.push('/(tabs)/transactions')} />
        {loading ? (
          <Text style={[font.body, { color: colors.textMuted, paddingHorizontal: spacing.lg }]}>Loading...</Text>
        ) : error ? (
          <Text style={[font.body, { color: colors.expense, paddingHorizontal: spacing.lg }]}>{error}</Text>
        ) : !hasAny ? (
          <EmptyState
            title="No transactions yet"
            message="Start by recording money you have received or spent. Your balance will update automatically."
            actionLabel="Add first transaction"
            onAction={() => router.push('/add-money')}
          />
        ) : (
          <View style={{ backgroundColor: colors.surface, borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.border }}>
            {recent.map((tx, i) => (
              <TransactionRow key={tx.id} tx={tx} animate={i === 0} fmtMoney={fmtMoney} fmtDate={fmtDate}
                onPress={() => router.push({ pathname: '/tx-details', params: { id: tx.id } })} />
            ))}
          </View>
        )}

        <View style={{ paddingHorizontal: spacing.lg, marginTop: spacing.xl }}>
          <Button label="Add Transaction" onPress={() => router.push('/add-money')} testID="home-add" />
        </View>

        <View style={{ height: 40, alignItems: 'center', justifyContent: 'flex-end', marginTop: spacing.lg }}>
          <Pressable onPress={lockNow} hitSlop={10}>
            <Text style={{ color: colors.textMuted, fontSize: 12 }}>Lock app</Text>
          </Pressable>
        </View>
      </View>
    </ScrollView>
  );
}

function QuickAction({ icon: Icon, label, onPress, testID }: { icon: React.ComponentType<any>; label: string; onPress: () => void; testID?: string }) {
  return (
    <Animated.View entering={FadeInDown.duration(220)} style={{ flex: 1 }}>
      <Pressable testID={testID} onPress={onPress} accessibilityRole="button" style={({ pressed }) => [styles.action, pressed && { backgroundColor: colors.surfaceAlt }]}>
        <Icon size={20} color={colors.accent} />
        <Text style={styles.actionLabel}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

function SummaryLine({ label, value, hidden, color, last }: { label: string; value: string; hidden: boolean; color?: string; last?: boolean }) {
  return (
    <View style={[styles.summaryLine, !last && styles.summaryBorder]}>
      <Text style={[font.body, { color: colors.textMuted, flex: 1 }]}>{label}</Text>
      <Text style={[font.amount, { color: hidden ? colors.textMuted : (color ?? colors.text) }]}>{hidden ? '••••••' : value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  date: { ...font.section, marginTop: 2 },
  iconBtn: { width: 40, height: 40, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  actionsGrid: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.lg },
  action: {
    flex: 1, aspectRatio: 1.05, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    alignItems: 'center', justifyContent: 'center', gap: spacing.sm, borderRadius: 0,
  },
  actionLabel: { fontSize: 11.5, fontWeight: '600', color: colors.text, textAlign: 'center', paddingHorizontal: 2 },
  summaryLine: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md, gap: spacing.md },
  summaryBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
});
