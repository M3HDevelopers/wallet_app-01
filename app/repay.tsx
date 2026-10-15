// Repayment flow: pick an open debt, record a partial or full repayment.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Check } from 'lucide-react-native';
import { AmountInput, Button, EmptyState, Field, Input, Screen, SectionTitle } from '../components/ui';
import { DatePickerField, isValidISODate } from '../components/DatePicker';
import { useApp } from '../hooks/useAppContext';
import { createRepayment, listDebts } from '../database/repositories';
import { Debt } from '../types';
import { colors, font, spacing } from '../utils/theme';
import { currencySymbol, todayISO } from '../utils/format';

export default function RepayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { toMinor, notifyDataChanged, currency, fmtMoney } = useApp();
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtId, setDebtId] = useState<number | null>(null);
  const [amountStr, setAmountStr] = useState('');
  const [amountErr, setAmountErr] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { listDebts('open').then(setDebts); }, []);

  const debt = useMemo(() => debts.find((d) => d.id === debtId) ?? null, [debts, debtId]);
  const amountMinor = toMinor(amountStr);
  const valid = debt != null && amountMinor != null && amountMinor > 0 && amountMinor <= debt.outstandingMinor && isValidISODate(date);

  const save = async () => {
    if (busy || !debt) return;
    if (amountMinor == null || amountMinor <= 0) { setAmountErr('Enter a valid amount greater than zero'); return; }
    if (amountMinor > debt.outstandingMinor) { setAmountErr(`Maximum is ${fmtMoney(debt.outstandingMinor)} (remaining outstanding)`); return; }
    if (!isValidISODate(date)) { setError('Repayment date is invalid'); return; }
    setBusy(true);
    try {
      await createRepayment({ debtId: debt.id, amountMinor, date, notes: notes.trim() || null });
      notifyDataChanged();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save');
      setBusy(false);
    }
  };

  return (
    <Screen>
      <View style={{ paddingTop: insets.top + spacing.lg, paddingHorizontal: spacing.lg }}>
        <Text style={font.screenTitle}>Make a Repayment</Text>
        <Text style={[font.body, { color: colors.textMuted, marginTop: spacing.sm, lineHeight: 21 }]}>
          Select the borrowing and enter how much you are paying back. Outstanding balance updates automatically.
        </Text>

        <SectionTitle title="Borrowing" />
        {debts.length === 0 ? (
          <EmptyState title="No open borrowings" message="You have no outstanding debts to repay. Record a borrowing first." actionLabel="Record Borrowing" onAction={() => router.push('/borrow')} />
        ) : (
          <View style={{ gap: spacing.sm }}>
            {debts.map((d) => {
              const active = d.id === debtId;
              return (
                <Pressable key={d.id} onPress={() => { setDebtId(d.id); setAmountErr(null); }} style={({ pressed }) => [styles.debtRow, active && styles.debtActive, pressed && { backgroundColor: colors.surfaceAlt }]}>
                  <View style={{ flex: 1 }}>
                    <Text style={font.bodyMedium}>{d.personName}</Text>
                    <Text style={[font.caption, { color: colors.textMuted, marginTop: 2 }]}>
                      Borrowed {fmtMoney(d.originalAmountMinor)} on {d.borrowedDate} - Outstanding {fmtMoney(d.outstandingMinor)}
                    </Text>
                  </View>
                  {active ? <Check size={18} color={colors.white} /> : null}
                </Pressable>
              );
            })}
          </View>
        )}

        {debt ? (
          <Animated.View entering={FadeIn.duration(200)}>
            <View style={{ marginTop: spacing.xl }}>
              <Field label="Repayment amount" required error={amountErr ?? undefined} hint={`Remaining outstanding: ${fmtMoney(debt.outstandingMinor)}`}>
                <AmountInput value={amountStr} onChangeText={(t) => { setAmountStr(t); setAmountErr(null); }} currencyDisplay={currencySymbol(currency)} large testID="repay-amount" />
              </Field>
              <Button label="Pay full remaining" variant="secondary" onPress={() => { setAmountStr((debt.outstandingMinor / 100).toFixed(2)); setAmountErr(null); }} style={{ marginBottom: spacing.lg }} />
              <Field label="Date" required>
                <DatePickerField value={date} onChange={setDate} />
              </Field>
              <Field label="Notes" hint="Optional">
                <Input value={notes} onChangeText={setNotes} placeholder="e.g. paid in cash" maxLength={200} />
              </Field>
              {error ? <Text style={styles.error}>{error}</Text> : null}
              <Button label="Save Repayment" onPress={save} disabled={!valid} loading={busy} testID="repay-save" />
              <View style={{ height: spacing.md }} />
              <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
            </View>
          </Animated.View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  debtRow: { flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, padding: spacing.md, borderRadius: 0, gap: spacing.md },
  debtActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  error: { color: colors.expense, fontSize: 13, fontWeight: '500', marginBottom: spacing.md },
});
