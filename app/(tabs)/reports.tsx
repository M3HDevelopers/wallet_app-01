// Reports: daily summary, monthly summary (with month picker), expense
// category breakdown with a flat bar chart, and custom date-range totals.
import React, { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { StatusBarBand } from '../../components/StatusBarBand';
import { Card, EmptyState, InfoRow, SectionTitle } from '../../components/ui';
import { useApp } from '../../hooks/useAppContext';
import { useLedger } from '../../hooks/useLedger';
import { useDefaultBack } from '../../hooks/useBackHandler';
import { colors, font, spacing } from '../../utils/theme';
import { currentMonthRange, monthLabel, toISODate, todayISO } from '../../utils/format';
import { categoryBreakdown, computeBalanceAsOf, outstandingAsOf, periodSummary } from '../../utils/ledger';

type Tab = 'daily' | 'monthly' | 'categories' | 'custom';

function shiftMonth(d: Date, delta: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + delta, 1);
}

export default function ReportsScreen() {
  const { fmtMoney, fmtDate } = useApp();
  const { entries, debts, repayments, totals, loading } = useLedger();
  const [tab, setTab] = useState<Tab>('daily');
  const [monthAnchor, setMonthAnchor] = useState(() => new Date());
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  useDefaultBack();

  const ledger = useMemo(
    () => (entries ?? []).map((t) => ({ type: t.type, amountMinor: t.amountMinor, date: t.date, category: t.category })),
    [entries]
  );

  const today = todayISO();
  const daily = useMemo(() => periodSummary(ledger, today, today), [ledger, today]);

  const mStart = toISODate(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth(), 1));
  const mEnd = toISODate(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + 1, 0));
  const monthly = useMemo(() => periodSummary(ledger, mStart, mEnd), [ledger, mStart, mEnd]);
  const debtOutstandingAsOfMonthEnd = useMemo(
    () => outstandingAsOf(debts.map((d) => ({ originalAmountMinor: d.originalAmountMinor, borrowedDate: d.borrowedDate })), repayments, mEnd),
    [debts, repayments, mEnd]
  );
  const balanceAsOfMonthEnd = useMemo(() => computeBalanceAsOf(ledger, mEnd), [ledger, mEnd]);

  const breakdown = useMemo(() => categoryBreakdown(ledger, mStart, mEnd), [ledger, mStart, mEnd]);
  const breakdownMax = breakdown.length ? breakdown[0].totalMinor : 1;

  const customValid = /^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from <= to;
  const custom = useMemo(() => (customValid ? periodSummary(ledger, from, to) : null), [ledger, customValid, from, to]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'daily', label: 'Daily' },
    { key: 'monthly', label: 'Monthly' },
    { key: 'categories', label: 'Categories' },
    { key: 'custom', label: 'Custom' },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBarBand title="Reports" subtitle="Period totals never mix with lifetime balance" />

      <View style={styles.tabRow}>
        {tabs.map((t) => (
          <Pressable key={t.key} onPress={() => setTab(t.key)} style={[styles.tab, tab === t.key && styles.tabActive]}>
            <Text style={[styles.tabText, tab === t.key && { color: colors.white }]}>{t.label}</Text>
          </Pressable>
        ))}
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl * 2 }}>
        {loading ? <Text style={[font.body, { color: colors.textMuted }]}>Loading...</Text>
        : !entries?.length ? (
          <EmptyState title="No data yet" message="Reports appear once you record transactions." />
        ) : tab === 'daily' ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <SectionTitle title={`Today - ${fmtDate(today)}`} />
            <Card style={{ paddingVertical: spacing.sm }}>
              <InfoRow label="Money received" value={fmtMoney(daily.inflowMinor)} />
              <InfoRow label="Earned income" value={fmtMoney(daily.earnedMinor)} />
              <InfoRow label="Expenses" value={fmtMoney(daily.expenseMinor)} valueColor={colors.expense} />
              <InfoRow label="Borrowed received" value={fmtMoney(daily.borrowedInMinor)} />
              <InfoRow label="Repayments made" value={fmtMoney(daily.repaidOutMinor)} />
              <InfoRow label="Net cash movement" value={fmtMoney(daily.netMinor, { sign: true })} valueColor={daily.netMinor >= 0 ? colors.income : colors.expense} />
            </Card>
          </Animated.View>
        ) : tab === 'monthly' ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <View style={styles.monthNav}>
              <Pressable onPress={() => setMonthAnchor((d) => shiftMonth(d, -1))} hitSlop={10} accessibilityLabel="Previous month"><ChevronLeft size={20} color={colors.text} /></Pressable>
              <Text style={font.section}>{monthLabel(mStart)}</Text>
              <Pressable onPress={() => setMonthAnchor((d) => (shiftMonth(d, 1) > new Date() ? d : shiftMonth(d, 1)))} hitSlop={10} accessibilityLabel="Next month"><ChevronRight size={20} color={colors.text} /></Pressable>
            </View>
            <Card style={{ paddingVertical: spacing.sm, marginTop: spacing.md }}>
              <InfoRow label="Total received" value={fmtMoney(monthly.inflowMinor)} />
              <InfoRow label="Earned income" value={fmtMoney(monthly.earnedMinor)} />
              <InfoRow label="Total expenses" value={fmtMoney(monthly.expenseMinor)} valueColor={colors.expense} />
              <InfoRow label="Borrowed funds received" value={fmtMoney(monthly.borrowedInMinor)} />
              <InfoRow label="Repayments made" value={fmtMoney(monthly.repaidOutMinor)} />
              <InfoRow label="Net cash movement" value={fmtMoney(monthly.netMinor, { sign: true })} valueColor={monthly.netMinor >= 0 ? colors.income : colors.expense} />
            </Card>
            <SectionTitle title="Position at month end" />
            <Card style={{ paddingVertical: spacing.sm }}>
              <InfoRow label="Balance as of date" value={fmtMoney(balanceAsOfMonthEnd)} />
              <InfoRow label="Outstanding debt as of date" value={fmtMoney(debtOutstandingAsOfMonthEnd)} valueColor={debtOutstandingAsOfMonthEnd > 0 ? colors.expense : undefined} />
            </Card>
            <Text style={[font.caption, { marginTop: spacing.sm }]}>Current lifetime balance: {fmtMoney(totals.balanceMinor)} - shown separately so periods are never confused with totals.</Text>
          </Animated.View>
        ) : tab === 'categories' ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <SectionTitle title={`Expense categories - ${monthLabel(mStart)}`} />
            {breakdown.length === 0 ? (
              <Text style={[font.body, { color: colors.textMuted }]}>No expenses recorded this month.</Text>
            ) : (
              <Card>
                {breakdown.map((b, i) => (
                  <View key={b.category} style={{ marginBottom: i === breakdown.length - 1 ? 0 : spacing.md }}>
                    <View style={styles.barHead}>
                      <Text style={font.bodyMedium}>{b.category}</Text>
                      <Text style={[font.amount, { color: colors.expense }]}>{fmtMoney(b.totalMinor)}</Text>
                    </View>
                    <View style={styles.barTrack}>
                      <View style={[styles.barFill, { width: `${Math.max(4, Math.round((b.totalMinor / breakdownMax) * 100))}%` }]} />
                    </View>
                  </View>
                ))}
              </Card>
            )}
            <Text style={[font.caption, { marginTop: spacing.md }]}>Use the arrows on the Monthly tab to change the reported month.</Text>
          </Animated.View>
        ) : (
          <Animated.View entering={FadeIn.duration(200)}>
            <SectionTitle title="Custom date range" />
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <View style={{ flex: 1 }}>
                <Text style={font.label}>FROM</Text>
                <Pressable onPress={() => setFrom(currentMonthRange().start)}><Text style={[font.caption, { color: colors.accent, marginTop: 4 }]}>Tap to use start of this month</Text></Pressable>
                <Text style={[font.bodyMedium, { marginTop: 4 }]}>{from || 'YYYY-MM-DD'}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={font.label}>TO</Text>
                <Pressable onPress={() => setTo(todayISO())}><Text style={[font.caption, { color: colors.accent, marginTop: 4 }]}>Tap to use today</Text></Pressable>
                <Text style={[font.bodyMedium, { marginTop: 4 }]}>{to || 'YYYY-MM-DD'}</Text>
              </View>
            </View>
            <Text style={[font.caption, { marginTop: spacing.sm }]}>Enter dates above in YYYY-MM-DD format using quick buttons, or edit below:</Text>
            <View style={{ flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm }}>
              <DateField value={from} onChange={setFrom} placeholder="From (YYYY-MM-DD)" />
              <DateField value={to} onChange={setTo} placeholder="To (YYYY-MM-DD)" />
            </View>
            {custom ? (
              <Card style={{ paddingVertical: spacing.sm, marginTop: spacing.lg }}>
                <InfoRow label="Received" value={fmtMoney(custom.inflowMinor)} />
                <InfoRow label="Earned income" value={fmtMoney(custom.earnedMinor)} />
                <InfoRow label="Expenses" value={fmtMoney(custom.expenseMinor)} valueColor={colors.expense} />
                <InfoRow label="Borrowed" value={fmtMoney(custom.borrowedInMinor)} />
                <InfoRow label="Repaid" value={fmtMoney(custom.repaidOutMinor)} />
                <InfoRow label="Net movement" value={fmtMoney(custom.netMinor, { sign: true })} valueColor={custom.netMinor >= 0 ? colors.income : colors.expense} />
              </Card>
            ) : (
              <Text style={[font.body, { color: colors.textMuted, marginTop: spacing.lg }]}>Set a valid start and end date to see totals for that period.</Text>
            )}
          </Animated.View>
        )}
      </ScrollView>
    </View>
  );
}

function DateField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <TextInput
      style={styles.rangeInput}
      value={value}
      onChangeText={(t) => onChange(/^\d{0,4}-?\d{0,2}-?\d{0,2}$/.test(t) ? t.slice(0, 10) : value)}
      placeholder={placeholder}
      maxLength={10}
      keyboardType="numbers-and-punctuation"
      accessibilityLabel={placeholder}
    />
  );
}

const styles = StyleSheet.create({
  tabRow: { flexDirection: 'row', paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm },
  tab: { flex: 1, paddingVertical: spacing.sm + 2, borderWidth: 1, borderColor: colors.border, alignItems: 'center', backgroundColor: colors.surface, borderRadius: 0 },
  tabActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.text },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.xxl },
  barHead: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6, gap: spacing.md },
  barTrack: { height: 8, backgroundColor: colors.surfaceAlt, borderRadius: 0 },
  barFill: { height: 8, backgroundColor: colors.expense, borderRadius: 0 },
  rangeInput: { flex: 1, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 14, color: colors.text, borderRadius: 0 },
});
