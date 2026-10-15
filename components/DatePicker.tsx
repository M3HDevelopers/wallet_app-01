// Simple, dependency-free date selector: text field (YYYY-MM-DD) plus quick buttons.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Input } from './ui';
import { colors, spacing } from '../utils/theme';
import { todayISO } from '../utils/format';

function addDays(iso: string, n: number): string {
  const d = new Date(`${iso}T00:00:00`);
  d.setDate(d.getDate() + n);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isValidISODate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00`);
  return !Number.isNaN(d.getTime()) && s === `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

interface Props {
  value: string;              // YYYY-MM-DD
  onChange: (v: string) => void;
  label?: string;
  error?: string;
}

export function DatePickerField({ value, onChange, error }: Props) {
  const quick = [
    { label: 'Today', v: todayISO() },
    { label: 'Yesterday', v: addDays(todayISO(), -1) },
  ];
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: spacing.sm }}>
        <Input
          style={{ flex: 1 }}
          value={value}
          onChangeText={onChange}
          placeholder="YYYY-MM-DD"
          keyboardType="numbers-and-punctuation"
          maxLength={10}
          invalid={!!error}
          accessibilityLabel="Date"
        />
        {quick.map((q) => (
          <Pressable key={q.label} onPress={() => onChange(q.v)} style={[styles.quick, value === q.v && styles.quickActive]}>
            <Text style={[styles.quickText, value === q.v && { color: colors.white }]}>{q.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  quick: {
    paddingHorizontal: spacing.md, justifyContent: 'center', borderWidth: 1,
    borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 0,
  },
  quickActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  quickText: { fontSize: 13, fontWeight: '600', color: colors.text },
});
