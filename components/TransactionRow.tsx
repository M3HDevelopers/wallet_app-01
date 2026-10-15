// Shared transaction list row. Compact, consistent height, aligned amounts.
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { colors, font, spacing } from '../utils/theme';
import { Transaction, txTypeName } from '../types';

interface Props {
  tx: Transaction;
  onPress?: () => void;
  fmtMoney: (minor: number, opts?: { sign?: boolean }) => string;
  fmtDate: (iso: string) => string;
  animate?: boolean;
}

export function TransactionRow({ tx, onPress, fmtMoney, fmtDate, animate }: Props) {
  const inflow = tx.type !== 'expense' && tx.type !== 'repayment_out';
  const amountStr = `${inflow ? '+' : '-'} ${fmtMoney(tx.amountMinor)}`;
  const sub = [tx.category ?? txTypeName(tx.type), tx.person].filter(Boolean).join(' - ');
  const content = (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={font.bodyMedium} numberOfLines={1}>{tx.description || txTypeName(tx.type)}</Text>
        <Text style={styles.sub} numberOfLines={1}>{sub}</Text>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <Text style={[font.amount, { color: inflow ? colors.income : colors.expense }]}>{amountStr}</Text>
        <Text style={styles.date}>{fmtDate(tx.date)}</Text>
      </View>
    </View>
  );
  if (!onPress) return animate ? <Animated.View entering={FadeInDown.duration(200)}>{content}</Animated.View> : content;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [{ backgroundColor: pressed ? colors.surfaceAlt : undefined }]}>
      {animate ? <Animated.View entering={FadeInDown.duration(200)}>{content}</Animated.View> : content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg, gap: spacing.md, borderBottomWidth: 1, borderBottomColor: colors.border,
  },
  sub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  date: { fontSize: 12, color: colors.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] },
});
