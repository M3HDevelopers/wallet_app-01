// Borrowing flow: create a debt record + matching borrowed_in transaction atomically.
import React, { useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { AmountInput, Button, Field, Input, Screen, SectionTitle } from '../components/ui';
import { DatePickerField, isValidISODate } from '../components/DatePicker';
import { useApp } from '../hooks/useAppContext';
import { listPeople, upsertPerson } from '../database/repositories';
import { createDebt } from '../database/repositories';
import { colors, font, spacing } from '../utils/theme';
import { currencySymbol, todayISO } from '../utils/format';

export default function BorrowScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { toMinor, notifyDataChanged, currency, fmtMoney } = useApp();
  const [personName, setPersonName] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [amountErr, setAmountErr] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [due, setDue] = useState('');
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const amountMinor = toMinor(amountStr);
  const valid = personName.trim().length > 0 && amountMinor != null && amountMinor > 0 && isValidISODate(date) && (!due || isValidISODate(due));

  const save = async () => {
    if (busy) return;
    if (!personName.trim()) { setError('Enter the person you borrowed from'); return; }
    if (amountMinor == null || amountMinor <= 0) { setAmountErr('Enter a valid amount greater than zero'); return; }
    if (!isValidISODate(date)) { setError('Borrow date is invalid'); return; }
    if (due && !isValidISODate(due)) { setError('Due date is invalid'); return; }
    setBusy(true);
    try {
      await createDebt({
        personName: personName.trim(),
        originalAmountMinor: amountMinor,
        borrowedDate: date,
        dueDate: due || null,
        notes: notes.trim() || null,
        currencyCode: currency,
      });
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
        <Text style={font.screenTitle}>Money Borrowed</Text>
        <Text style={[font.body, { color: colors.textMuted, marginTop: spacing.sm, lineHeight: 21 }]}>
          Records both the cash received and the debt you owe. Outstanding balance updates automatically.
        </Text>

        <SectionTitle title="Details" />
        <Field label="Borrowed from" required>
          <Input value={personName} onChangeText={(t) => { setPersonName(t); setError(null); }} placeholder="Person's name" maxLength={60} autoCapitalize="words" testID="borrow-person" />
        </Field>
        <Field label="Amount" required error={amountErr ?? undefined}>
          <AmountInput value={amountStr} onChangeText={(t) => { setAmountStr(t); setAmountErr(null); }} currencyDisplay={currencySymbol(currency)} large testID="borrow-amount" />
        </Field>
        <Field label="Date borrowed" required>
          <DatePickerField value={date} onChange={setDate} />
        </Field>
        <Field label="Expected repayment date" hint="Optional - shown on the debts screen">
          <DatePickerField value={due} onChange={setDue} error={due && !isValidISODate(due) ? 'Invalid date' : undefined} />
        </Field>
        <Field label="Notes" hint="Optional">
          <Input value={notes} onChangeText={setNotes} placeholder="e.g. for hospital expenses" maxLength={200} />
        </Field>

        {error ? <Animated.Text entering={FadeIn.duration(160)} style={styles.error}>{error}</Animated.Text> : null}

        <Button label="Save Borrowing" onPress={save} disabled={!valid} loading={busy} testID="borrow-save" />
        <View style={{ height: spacing.md }} />
        <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  error: { color: colors.expense, fontSize: 13, fontWeight: '500', marginBottom: spacing.md },
});
