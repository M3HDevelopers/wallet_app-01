// Transaction history: virtualized list, debounced search, type/category/date
// filters, pagination. Kept light so thousands of rows scroll smoothly.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useFocusEffect } from 'expo-router';
import { X } from 'lucide-react-native';
import { StatusBarBand } from '../../components/StatusBarBand';
import { TransactionRow } from '../../components/TransactionRow';
import { Button, EmptyState, Input } from '../../components/ui';
import { useApp } from '../../hooks/useAppContext';
import { useDebouncedValue } from '../../hooks/useDebouncedValue';
import { useDefaultBack } from '../../hooks/useBackHandler';
import { countTransactions, listCategories, queryTransactions } from '../../database/repositories';
import { Category, TxType } from '../../types';
import { colors, font, spacing } from '../../utils/theme';
import { todayISO } from '../../utils/format';

const PAGE = 50;

const TYPE_FILTERS: { label: string; types?: TxType[] }[] = [
  { label: 'All' },
  { label: 'Income', types: ['earned_income', 'gift_allowance', 'family_money', 'person_money', 'other_income'] },
  { label: 'Expense', types: ['expense'] },
  { label: 'Borrowed', types: ['borrowed_in'] },
  { label: 'Repaid', types: ['repayment_out'] },
];

export default function TransactionsScreen() {
  const router = useRouter();
  const { fmtMoney, fmtDate, refreshTick } = useApp();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search, 250);
  const [typeIdx, setTypeIdx] = useState(0);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [rows, setRows] = useState<TxPage | null>(null);

  useDefaultBack(); // Android back leaves history -> previous screen

  useEffect(() => { listCategories().then(setCategories); }, []);

  const activeFilterCount = (categoryId != null ? 1 : 0) + (from ? 1 : 0) + (to ? 1 : 0);

  const load = useCallback(async () => {
    const types = TYPE_FILTERS[typeIdx].types;
    const [list, total] = await Promise.all([
      queryTransactions({ search: debouncedSearch, types, categoryId: categoryId ?? undefined, from: from || undefined, to: to || undefined, limit: PAGE, offset: 0 }),
      countTransactions(),
    ]);
    setRows({ list, total, offset: list.length });
  }, [debouncedSearch, typeIdx, categoryId, from, to]);

  // Reload on focus and whenever data changes elsewhere in the app.
  useFocusEffect(useCallback(() => { load(); }, [load, refreshTick]));
  useEffect(() => { load(); }, [load, refreshTick]);

  const loadMore = async () => {
    if (!rows || rows.list.length >= rows.total) return;
    const more = await queryTransactions({
      search: debouncedSearch, types: TYPE_FILTERS[typeIdx].types,
      categoryId: categoryId ?? undefined, from: from || undefined, to: to || undefined,
      limit: PAGE, offset: rows.offset,
    });
    if (!more.length) return;
    setRows({ list: [...rows.list, ...more], total: rows.total, offset: rows.offset + more.length });
  };

  const clearAll = () => { setSearch(''); setTypeIdx(0); setCategoryId(null); setFrom(''); setTo(''); };
  const hasAnyFilter = !!search || typeIdx !== 0 || activeFilterCount > 0;

  const emptyMessage = useMemo(() => (hasAnyFilter ? 'No transactions match your filters.' : 'Record your first transaction to see it here.'), [hasAnyFilter]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <StatusBarBand title="Transactions" subtitle={rows ? `${rows.list.length} shown of ${rows.total}` : undefined}
        right={<Pressable onPress={() => router.push('/add-money')} hitSlop={8} accessibilityLabel="Add money"><Text style={{ color: colors.white, fontWeight: '700', fontSize: 14 }}>+ Add</Text></Pressable>} />

      <View style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: spacing.sm }}>
        <Input value={search} onChangeText={setSearch} placeholder="Search description, person, notes..." accessibilityLabel="Search transactions" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {TYPE_FILTERS.map((f, i) => (
            <Pressable key={f.label} onPress={() => setTypeIdx(i)} style={[styles.chip, typeIdx === i && styles.chipActive]}>
              <Text style={[styles.chipText, typeIdx === i && { color: colors.white }]}>{f.label}</Text>
            </Pressable>
          ))}
          <Pressable onPress={() => setShowFilters((s) => !s)} style={[styles.chip, showFilters && styles.chipActive, { flexDirection: 'row', gap: 6, alignItems: 'center' }]}>
            <Text style={[styles.chipText, showFilters && { color: colors.white }]}>More{activeFilterCount ? ` (${activeFilterCount})` : ''}</Text>
          </Pressable>
        </ScrollView>

        {showFilters ? (
          <Animated.View entering={FadeIn.duration(180)} style={{ gap: spacing.sm, paddingVertical: spacing.sm }}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
              {categories.map((c) => (
                <Pressable key={c.id} onPress={() => setCategoryId(categoryId === c.id ? null : c.id)} style={[styles.chip, categoryId === c.id && styles.chipActive]}>
                  <Text style={[styles.chipText, categoryId === c.id && { color: colors.white }]}>{c.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <View style={{ flexDirection: 'row', gap: spacing.sm }}>
              <Input style={{ flex: 1 }} value={from} onChangeText={(t) => setFrom(/^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '')} placeholder={`From (YYYY-MM-DD)`} maxLength={10} />
              <Input style={{ flex: 1 }} value={to} onChangeText={(t) => setTo(/^\d{4}-\d{2}-\d{2}$/.test(t) ? t : '')} placeholder={`To - e.g. ${todayISO()}`} maxLength={10} />
            </View>
          </Animated.View>
        ) : null}

        {hasAnyFilter ? (
          <Pressable onPress={clearAll} style={styles.clearRow} accessibilityRole="button">
            <X size={14} color={colors.expense} /><Text style={{ color: colors.expense, fontSize: 13, fontWeight: '600' }}>Clear all filters</Text>
          </Pressable>
        ) : null}
      </View>

      {!rows ? (
        <Text style={[font.body, { color: colors.textMuted, padding: spacing.lg }]}>Loading...</Text>
      ) : rows.list.length === 0 ? (
        <EmptyState title="Nothing here" message={emptyMessage} actionLabel={hasAnyFilter ? 'Clear filters' : 'Add first transaction'}
          onAction={hasAnyFilter ? clearAll : () => router.push('/add-money')} />
      ) : (
        <FlatList
          data={rows.list}
          keyExtractor={(item) => String(item.id)}
          initialNumToRender={16}
          maxToRenderPerBatch={16}
          windowSize={9}
          removeClippedSubviews
          contentContainerStyle={{ paddingBottom: spacing.xxl, marginTop: spacing.md }}
          ItemSeparatorComponent={() => <View style={{ height: 0 }} />}
          renderItem={({ item }) => (
            <TransactionRow tx={item} fmtMoney={fmtMoney} fmtDate={fmtDate}
              onPress={() => router.push({ pathname: '/tx-details', params: { id: item.id } })} />
          )}
          onEndReachedThreshold={0.4}
          onEndReached={loadMore}
          ListFooterComponent={rows.list.length < rows.total ? <Button label="Load more" variant="ghost" onPress={loadMore} /> : null}
        />
      )}
    </View>
  );
}

interface TxPage { list: import('../../types').Transaction[]; total: number; offset: number; }

const styles = StyleSheet.create({
  chip: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm + 2, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 0 },
  chipActive: { backgroundColor: colors.accent, borderColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: '600', color: colors.text },
  clearRow: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'flex-start', paddingVertical: spacing.xs },
});
