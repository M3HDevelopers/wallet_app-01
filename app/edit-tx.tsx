// Edit an existing transaction. All balances/summaries recalculate from the
// ledger automatically after saving (they are derived, never cached).
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus } from 'lucide-react-native';
import { StatusBarBand } from '../components/StatusBarBand';
import { AmountInput, Button, Field, Input, SectionTitle } from '../components/ui';
import { DatePickerField, isValidISODate } from '../components/DatePicker';
import { useApp } from '../hooks/useAppContext';
import { useDefaultBack } from '../hooks/useBackHandler';
import { getTransaction, listCategories, listPeople, updateTransaction, upsertCategory, upsertPerson } from '../database/repositories';
import { Category, Person, TxType, txTypeName } from '../types';
import { colors, font, spacing } from '../utils/theme';
import { currencySymbol } from '../utils/format';

const EDITABLE_TYPES: TxType[] = [
  'opening_balance', 'earned_income', 'gift_allowance', 'family_money', 'person_money',
  'borrowed_in', 'repayment_received', 'other_income', 'expense',
];

export default function EditTxScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { toMinor, fmtMoney, notifyDataChanged, currency } = useApp();
  const [loaded, setLoaded] = useState(false);
  const [notFound, setNotFound] = useState(false);

  const [type, setType] = useState<TxType>('expense');
  const [amountStr, setAmountStr] = useState('');
  const [amountErr, setAmountErr] = useState<string | null>(null);
  const [date, setDate] = useState('');
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [people, setPeople] = useState<Person[]>([]);
  const [personId, setPersonId] = useState<number | null>(null);
  const [newPerson, setNewPerson] = useState('');
  const [showNewPerson, setShowNewPerson] = useState(false);
  const [debtId, setDebtId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useDefaultBack();

  useEffect(() => {
    const numId = parseInt(id ?? '', 10);
    if (Number.isNaN(numId)) { setNotFound(true); return; }
    (async () => {
      try {
        const tx = await getTransaction(numId);
        if (!tx) { setNotFound(true); return; }
        setType(tx.type);
        setAmountStr((tx.amountMinor / 100).toFixed(2));
        setDate(tx.date);
        setDescription(tx.description);
        setNotes(tx.notes ?? '');
        setCategoryId(tx.categoryId);
        setPersonId(tx.personId);
        setDebtId(tx.debtId);
      } finally {
        setLoaded(true);
      }
    })();
  }, [id]);

  const kind = type === 'expense' ? 'expense' : 'income';
  useEffect(() => {
    listCategories(kind === 'expense' ? undefined : undefined).then((cats) =>
      setCategories(cats.filter((c) => c.kind === kind || c.kind === 'general')));
  }, [kind]);
  useEffect(() => { listPeople().then(setPeople); }, []);

  const amountMinor = toMinor(amountStr);
  const valid = amountMinor != null && amountMinor > 0 && isValidISODate(date);

  const save = async () => {
    const numId = parseInt(id ?? '', 10);
    if (busy || Number.isNaN(numId) || !valid || amountMinor == null) {
      if (amountMinor == null || amountMinor <= 0) setAmountErr('Enter a valid amount greater than zero');
      return;
    }
    setBusy(true);
    try {
      let finalPersonId = personId;
      if (showNewPerson && newPerson.trim()) {
        finalPersonId = await upsertPerson(newPerson.trim());
      }
      await updateTransaction(numId, {
        type, amountMinor, currency,
        categoryId, personId: finalPersonId,
        description: description.trim() || txTypeName(type),
        notes: notes.trim() || null, date, debtId,
      });
      notifyDataChanged();
      router.back();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save changes');
      setBusy(false);
    }
  };

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    const cid = await upsertCategory(name, kind);
    setCategories(await listCategories());
    setCategoryId(cid);
    setNewCat(''); setShowNewCat(false);
  };

  if (notFound) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBarBand title="Edit Transaction" />
        <Text style={[font.body, { padding: spacing.lg }]}>Transaction not found.</Text>
      </View>
    );
  }
  if (!loaded) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <StatusBarBand title="Edit Transaction" />
        <Text style={[font.body, { color: colors.textMuted, padding: spacing.lg }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBarBand title="Edit Transaction" subtitle="Balance and reports update after saving" />
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: spacing.xxxl * 2 }} keyboardShouldPersistTaps="handled">
        <SectionTitle title="Type" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {EDITABLE_TYPES.map((t) => (
            <Pressable key={t} onPress={() => setType(t)} style={[styles.chip, type === t && styles.chipActive]}>
              <Text style={[styles.chipText, type === t && { color: colors.white }]}>{txTypeName(t)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ marginTop: spacing.xl }}>
          <Field label={`Amount (${currencySymbol(currency)})`} required error={amountErr ?? undefined}>
            <AmountInput value={amountStr} onChangeText={(t) => { setAmountStr(t); setAmountErr(null); }}
              currencyDisplay={currencySymbol(currency)} large testID="edit-amount" />
          </Field>
          {amountMinor != null && amountMinor > 0 ? (
            <Text style={[font.caption, { marginTop: -6 }]}>Parses to {fmtMoney(amountMinor)}</Text>
          ) : null}

          <Field label="Date" required>
            <DatePickerField value={date} onChange={setDate} />
          </Field>

          <Field label="Description">
            <Input value={description} onChangeText={setDescription} maxLength={120} placeholder={txTypeName(type)} />
          </Field>

          <Field label="Person (source / recipient)">
            <View style={{ gap: spacing.sm }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {people.map((p) => (
                  <Pressable key={p.id} onPress={() => setPersonId(personId === p.id ? null : p.id)} style={[styles.chip, personId === p.id && styles.chipActive]}>
                    <Text style={[styles.chipText, personId === p.id && { color: colors.white }]}>{p.name}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => setShowNewPerson((s) => !s)} style={[styles.chip, { flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
                  <Plus size={14} color={colors.accent} /><Text style={[styles.chipText, { color: colors.accent }]}>New</Text>
                </Pressable>
              </ScrollView>
              {showNewPerson ? <Input value={newPerson} onChangeText={setNewPerson} placeholder="Person name" maxLength={60} autoFocus /> : null}
            </View>
          </Field>

          <Field label="Category">
            <View style={{ gap: spacing.sm }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {categories.map((c) => (
                  <Pressable key={c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} style={[styles.chip, categoryId === c.id && styles.chipActive]}>
                    <Text style={[styles.chipText, categoryId === c.id && { color: colors.white }]}>{c.name}</Text>
                  </Pressable>
                ))}
                <Pressable onPress={() => setShowNewCat((s) => !s)} style={[styles.chip, { flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
                  <Plus size={14} color={colors.accent} /><Text style={[styles.chipText, { color: colors.accent }]}>New</Text>
                </Pressable>
              </ScrollView>
              {showNewCat ? (
                <Animated.View entering={FadeIn.duration(180)} style={{ flexDirection: 'row', gap: spacing.sm }}>
                  <Input style={{ flex: 1 }} value={newCat} onChangeText={setNewCat} placeholder="Category name" maxLength={40} autoFocus />
                  <Button label="Add" onPress={addCategory} variant="secondary" style={{ width: 90 }} />
                </Animated.View>
              ) : null}
            </View>
          </Field>

          <Field label="Notes">
            <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Optional"
              style={styles.multiline} />
          </Field>

          {error ? <Text style={{ color: colors.expense, marginBottom: spacing.md }}>{error}</Text> : null}

          <Button label="Save changes" onPress={save} disabled={!valid} loading={busy} testID="edit-save" />
          <View style={{ height: spacing.sm }} />
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 0 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  multiline: {
    borderColor: colors.border, borderWidth: 1, padding: spacing.md, minHeight: 84, fontSize: 15,
    color: colors.text, textAlignVertical: 'top', backgroundColor: colors.surface, borderRadius: 0,
  },
});
