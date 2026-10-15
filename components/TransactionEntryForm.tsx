// Shared entry form used by Add Money / Add Expense flows.
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { ChevronDown, Plus } from 'lucide-react-native';
import { AmountInput, Button, Field, Input, Screen, SectionTitle } from '../components/ui';
import { DatePickerField, isValidISODate } from '../components/DatePicker';
import { useApp } from '../hooks/useAppContext';
import { listCategories, upsertCategory } from '../database/repositories';
import { Category, CategoryKind, TxType, txTypeName } from '../types';
import { colors, font, spacing } from '../utils/theme';
import { currencySymbol, todayISO } from '../utils/format';

export interface EntryPreset { type: TxType; title: string; kind: CategoryKind; }

interface Props {
  presetTypes: EntryPreset[];
  initialType?: TxType;
  successMessage: string;
}

export function TransactionEntryForm({ presetTypes, initialType, successMessage }: Props) {
  const router = useRouter();
  const { fmtMoney, fmtDate, toMinor, notifyDataChanged, allowNegative, currency } = useApp();
  const [type, setType] = useState<TxType>(initialType ?? presetTypes[0].type);
  const [amountStr, setAmountStr] = useState('');
  const [amountErr, setAmountErr] = useState<string | null>(null);
  const [date, setDate] = useState(todayISO());
  const [dateErr, setDateErr] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [notes, setNotes] = useState('');
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [showNewCat, setShowNewCat] = useState(false);
  const [newCat, setNewCat] = useState('');
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(false);

  const kind = presetTypes.find((p) => p.type === type)?.kind ?? 'general';

  useEffect(() => {
    listCategories(kind === 'general' ? undefined : kind).then((cats) => {
      setCategories(cats.filter((c) => c.kind === kind || c.kind === 'general'));
    });
  }, [kind]);

  const amountMinor = toMinor(amountStr);
  const valid = amountMinor != null && amountMinor > 0 && isValidISODate(date) && !dateErr;

  const save = async () => {
    if (busy || !valid || amountMinor == null) {
      if (amountMinor == null || amountMinor <= 0) setAmountErr('Enter a valid amount greater than zero');
      if (!isValidISODate(date)) setDateErr('Use format YYYY-MM-DD (e.g. 2026-10-15)');
      return;
    }
    setBusy(true);
    try {
      const { insertTransaction } = require('../database/repositories');
      await insertTransaction({
        type, amountMinor, currency,
        categoryId, description: description.trim() || txTypeName(type),
        notes: notes.trim() || null, date,
      });
      notifyDataChanged();
      setToast(true);
      setTimeout(() => router.back(), 450);
    } catch (e) {
      setAmountErr(e instanceof Error ? e.message : 'Failed to save');
      setBusy(false);
    }
  };

  const addCategory = async () => {
    const name = newCat.trim();
    if (!name) return;
    const id = await upsertCategory(name, kind === 'general' ? 'general' : kind);
    setCategories(await listCategories(kind === 'general' ? undefined : kind));
    setCategoryId(id);
    setNewCat(''); setShowNewCat(false);
  };

  return (
    <Screen scroll>
      <View style={{ paddingTop: spacing.xxl, paddingHorizontal: spacing.lg }}>
        <Text style={font.screenTitle}>{presetTypes.find((p) => p.type === type)?.title ?? presetTypes[0].title}</Text>
        <Text style={[font.caption, { marginTop: 4 }]}>All amounts are recorded in minor units internally for exact totals.</Text>

        <SectionTitle title="Type" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: 0 }}>
          {presetTypes.map((p) => (
            <Pressable key={p.type} onPress={() => setType(p.type)} style={[styles.chip, type === p.type && styles.chipActive]}>
              <Text style={[styles.chipText, type === p.type && { color: colors.white }]}>{txTypeName(p.type)}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={{ marginTop: spacing.xl }}>
          <Field label="Amount" required error={amountErr ?? undefined}>
            <AmountInput value={amountStr} onChangeText={(t) => { setAmountStr(t); setAmountErr(null); }}
              currencyDisplay={currencySymbol(currency)} large testID="tx-amount"
              onBlur={() => { if (amountStr && (amountMinor == null || amountMinor <= 0)) setAmountErr('Enter a valid amount greater than zero'); }} />
          </Field>

          <Field label="Date" required error={dateErr ?? undefined}>
            <DatePickerField value={date} onChange={(v) => { setDate(v); setDateErr(isValidISODate(v) ? null : 'Invalid date'); }} />
          </Field>

          <Field label="Description" hint="Optional - shown in lists">
            <Input value={description} onChangeText={setDescription} placeholder={txTypeName(type)} maxLength={120} />
          </Field>

          <Field label="Category">
            <View style={{ gap: spacing.sm }}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
                {categories.map((c) => (
                  <Pressable key={c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)}
                    style={[styles.chip, categoryId === c.id && styles.chipActive]}>
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

          <Field label="Notes" hint="Optional">
            <TextInput value={notes} onChangeText={setNotes} multiline placeholder="Anything to remember"
              style={[styles.notes, { borderColor: colors.border, borderWidth: 1, padding: spacing.md, minHeight: 84, fontSize: 15, color: colors.text, textAlignVertical: 'top', backgroundColor: colors.surface }]} />
          </Field>

          <Button label="Save Transaction" onPress={save} disabled={!valid} loading={busy} testID="tx-save" />
          <View style={{ height: spacing.md }} />
          <Button label="Cancel" variant="ghost" onPress={() => router.back()} />
        </View>
      </View>
      {toast ? (
        <Animated.View entering={FadeIn.duration(180)} pointerEvents="none" style={styles.toast}><Text style={{ color: colors.white, fontWeight: '600', fontSize: 13 }}>{successMessage}</Text></Animated.View>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 0 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  toast: { position: 'absolute', bottom: 110, alignSelf: 'center', backgroundColor: colors.text, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
});
