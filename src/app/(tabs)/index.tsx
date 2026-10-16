import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, SectionList, StyleSheet, View } from 'react-native';

import { MonthPicker } from '@/components/MonthPicker';
import { MonthTotals } from '@/components/MonthTotals';
import { AppText, Button, usePalette } from '@/components/ui';
import { supportsFileBackup } from '@/lib/backup';
import {
  addMonths,
  FIRST_MONTH,
  formatDate,
  formatMoney,
  formatMonth,
  fromDateKey,
  groupByWeek,
  monthRange,
  toMonthKey,
} from '@/lib/format';
import { methodLabel, type Currency, type Expense } from '@/lib/types';
import { useStore } from '@/state/store';

export default function ExpensesScreen() {
  const p = usePalette();
  const { expenses, settings } = useStore();
  const currentMonth = toMonthKey(new Date());
  const [month, setMonth] = useState(currentMonth);

  const range = useMemo(() => monthRange(month), [month]);
  const monthExpenses = useMemo(() => expenses.filter((e) => e.date.startsWith(`${month}-`)), [expenses, month]);
  const weeks = useMemo(() => groupByWeek(monthExpenses, range), [monthExpenses, range]);
  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const e of expenses) out[e.date.slice(0, 7)] = (out[e.date.slice(0, 7)] ?? 0) + 1;
    return out;
  }, [expenses]);
  const addExpense = () => router.push('/expense/new');

  return (
    <View style={{ flex: 1 }}>
      <MonthBar month={month} onChange={setMonth} currentMonth={currentMonth} counts={counts} />
      <SectionList
        sections={weeks}
        keyExtractor={(e) => e.id}
        contentContainerStyle={styles.list}
        stickySectionHeadersEnabled={false}
        ListHeaderComponent={
          <MonthSummary
            expenses={monthExpenses}
            budget={settings.monthlyBudget}
            onPress={() => router.push({ pathname: '/report/[month]', params: { month } })}
          />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="receipt-outline" size={44} color={p.muted} />
            <AppText weight="semibold" size={17} style={{ marginTop: 12 }}>
              No expenses in {formatMonth(month)}
            </AppText>
            {month === currentMonth ? (
              <>
                <AppText muted style={{ marginTop: 4, textAlign: 'center' }}>
                  Tap the + button to record one.
                </AppText>
                <Button title="Add expense" onPress={addExpense} style={{ marginTop: 20, alignSelf: 'stretch' }} />
              </>
            ) : null}
            {supportsFileBackup && !expenses.length ? (
              <Button
                title="Restore from a backup"
                variant="secondary"
                onPress={() => router.push('/settings')}
                style={{ marginTop: 10, alignSelf: 'stretch' }}
              />
            ) : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          // Weekly totals live in the monthly report; the list only labels each week.
          <View style={styles.sectionHeader}>
            <AppText weight="bold" size={15}>
              {section.title}
            </AppText>
            <AppText muted size={12}>
              {formatDate(section.shownStart)} – {formatDate(section.shownEnd)}
            </AppText>
          </View>
        )}
        renderItem={({ item, index, section }) => {
          const first = index === 0;
          const last = index === section.data.length - 1;
          return (
            <Pressable
              onPress={() => router.push({ pathname: '/expense/[id]', params: { id: item.id } })}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed ? p.chip : p.card,
                  borderColor: p.border,
                  borderTopLeftRadius: first ? 12 : 0,
                  borderTopRightRadius: first ? 12 : 0,
                  borderBottomLeftRadius: last ? 12 : 0,
                  borderBottomRightRadius: last ? 12 : 0,
                  borderBottomWidth: last ? StyleSheet.hairlineWidth : 0,
                },
              ]}
            >
              <View style={{ flex: 1 }}>
                <AppText weight="semibold" numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText muted size={12} numberOfLines={1}>
                  {formatDate(fromDateKey(item.date))} · {methodLabel(item)}
                </AppText>
              </View>
              {item.receipt ? (
                <Ionicons name="receipt-outline" size={16} color={p.muted} accessibilityLabel="Has receipt" />
              ) : null}
              <AppText weight="semibold">{formatMoney(item.amount, item.currency)}</AppText>
            </Pressable>
          );
        }}
      />

      {/* Not wrapped in <Link asChild>: its Slot drops function-style props, which hid this button. */}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add expense"
        onPress={addExpense}
        style={({ pressed }) => [styles.fab, { backgroundColor: p.primary, opacity: pressed ? 0.85 : 1 }]}
      >
        <Ionicons name="add" size={30} color={p.onPrimary} />
      </Pressable>
    </View>
  );
}

/**
 * ‹ October 2026 ⌄ › — left/right step one month (between FIRST_MONTH and the current month);
 * tapping the title opens a picker to jump to any month.
 */
function MonthBar({
  month,
  onChange,
  currentMonth,
  counts,
}: {
  month: string;
  onChange: (month: string) => void;
  currentMonth: string;
  counts: Record<string, number>;
}) {
  const p = usePalette();
  const [picking, setPicking] = useState(false);
  const canGoBack = month > FIRST_MONTH;
  const canGoNext = month < currentMonth;

  return (
    <View style={[styles.monthBar, { backgroundColor: p.card, borderColor: p.border }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Previous month, ${formatMonth(addMonths(month, -1))}`}
        accessibilityState={{ disabled: !canGoBack }}
        disabled={!canGoBack}
        onPress={() => onChange(addMonths(month, -1))}
        hitSlop={8}
        style={styles.monthArrow}
      >
        <Ionicons name="chevron-back" size={24} color={canGoBack ? p.primary : p.border} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${formatMonth(month)}. Tap to choose a month`}
        onPress={() => setPicking(true)}
        style={styles.monthTitle}
      >
        <View style={styles.monthTitleRow}>
          <AppText weight="bold" size={17}>
            {formatMonth(month)}
          </AppText>
          <Ionicons name="chevron-down" size={16} color={p.primary} />
        </View>
        {month !== currentMonth ? (
          <AppText size={11} muted>
            Tap to choose another month
          </AppText>
        ) : null}
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Next month, ${formatMonth(addMonths(month, 1))}`}
        accessibilityState={{ disabled: !canGoNext }}
        disabled={!canGoNext}
        onPress={() => onChange(addMonths(month, 1))}
        hitSlop={8}
        style={styles.monthArrow}
      >
        <Ionicons name="chevron-forward" size={24} color={canGoNext ? p.primary : p.border} />
      </Pressable>

      <MonthPicker
        visible={picking}
        selected={month}
        currentMonth={currentMonth}
        counts={counts}
        onSelect={onChange}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

/** Monthly total card; tapping it opens the detailed monthly report (weekly totals live there). */
function MonthSummary({
  expenses,
  budget,
  onPress,
}: {
  expenses: Expense[];
  budget: Partial<Record<Currency, number>>;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Monthly total. Tap for the detailed monthly report"
      onPress={onPress}
      style={({ pressed }) => [
        styles.summary,
        { backgroundColor: pressed ? p.chip : p.card, borderColor: p.border },
      ]}
    >
      <View style={styles.summaryHeader}>
        <AppText muted size={12} weight="semibold" style={{ letterSpacing: 0.5, flex: 1 }}>
          MONTHLY TOTAL
        </AppText>
        <AppText size={13} weight="semibold" color={p.primary}>
          View report
        </AppText>
        <Ionicons name="chevron-forward" size={16} color={p.primary} />
      </View>
      <MonthTotals expenses={expenses} budget={budget} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  list: { padding: 16, paddingBottom: 100, flexGrow: 1 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 32 },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  monthArrow: { padding: 8 },
  monthTitle: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  monthTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  summary: { padding: 16, marginBottom: 4, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth },
  summaryHeader: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  sectionHeader: { marginTop: 16, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
  },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 24,
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
