import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useDialog } from '@/components/Dialog';
import { MonthTotals, TotalsLine } from '@/components/MonthTotals';
import { AppText, Button, Card, usePalette } from '@/components/ui';
import { BackupError } from '@/lib/backup';
import { exportCsv } from '@/lib/csv';
import { formatDate, formatMonth, groupByWeek, monthRange, toDateKey, type WeekGroup } from '@/lib/format';
import { PAYMENT_METHODS, type Expense } from '@/lib/types';
import { useStore } from '@/state/store';

const plural = (n: number) => `${n} expense${n === 1 ? '' : 's'}`;

/** Detailed monthly report: month total vs budget, weekly totals, and a breakdown by payment method. */
export default function MonthlyReportScreen() {
  const p = usePalette();
  const dialog = useDialog();
  const { month } = useLocalSearchParams<{ month: string }>();
  const { expenses, settings } = useStore();

  const monthExpenses = useMemo(() => expenses.filter((e) => e.date.startsWith(`${month}-`)), [expenses, month]);
  // Oldest week first reads naturally in a report.
  const weeks = useMemo(() => groupByWeek(monthExpenses, monthRange(month)).reverse(), [monthExpenses, month]);
  const byMethod = useMemo(
    () =>
      PAYMENT_METHODS.map((m) => ({ ...m, items: monthExpenses.filter((e) => e.method === m.value) })).filter(
        (m) => m.items.length,
      ),
    [monthExpenses],
  );

  const runExport = async (fileName: string, rows: Expense[]) => {
    try {
      await exportCsv(fileName, rows);
    } catch (e) {
      console.warn(e);
      await dialog.alert('Export failed', e instanceof BackupError ? e.message : 'The CSV file could not be created.');
    }
  };

  /** Exports the whole Monday–Sunday week, including days that fall in the neighbouring month. */
  const exportWeek = (week: WeekGroup) => {
    const from = toDateKey(week.start);
    const to = toDateKey(week.end);
    runExport(`money-tracker-week-${from}`, expenses.filter((e) => e.date >= from && e.date <= to));
  };

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <Stack.Screen options={{ title: formatMonth(month) }} />

      <Card style={styles.card}>
        <AppText muted size={12} weight="semibold" style={styles.label}>
          MONTHLY TOTAL · {plural(monthExpenses.length).toUpperCase()}
        </AppText>
        <MonthTotals expenses={monthExpenses} budget={settings.monthlyBudget} />
      </Card>

      <AppText muted size={12} weight="semibold" style={[styles.label, styles.sectionLabel]}>
        WEEKLY TOTALS
      </AppText>
      {weeks.length ? (
        <Card>
          {weeks.map((w, i) => (
            <View key={w.key} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }]}>
              <View style={{ flex: 1 }}>
                <AppText weight="semibold">
                  {formatDate(w.shownStart).slice(5)} – {formatDate(w.shownEnd).slice(5)}
                </AppText>
                <AppText muted size={12}>
                  {plural(w.data.length)}
                  {w.title === 'This week' || w.title === 'Last week' ? ` · ${w.title}` : ''}
                </AppText>
              </View>
              <TotalsLine expenses={w.data} />
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Export week of ${formatDate(w.start)} as CSV`}
                onPress={() => exportWeek(w)}
                hitSlop={8}
                style={styles.icon}
              >
                <Ionicons name="download-outline" size={20} color={p.primary} />
              </Pressable>
            </View>
          ))}
        </Card>
      ) : (
        <AppText muted>No expenses this month.</AppText>
      )}
      {weeks.length ? (
        <AppText muted size={12} style={{ marginTop: 6 }}>
          The download icon exports that whole Monday–Sunday week as CSV.
        </AppText>
      ) : null}

      {byMethod.length ? (
        <>
          <AppText muted size={12} weight="semibold" style={[styles.label, styles.sectionLabel]}>
            BY PAYMENT METHOD
          </AppText>
          <Card>
            {byMethod.map((m, i) => (
              <View key={m.value} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }]}>
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold">{m.label}</AppText>
                  <AppText muted size={12}>
                    {plural(m.items.length)}
                  </AppText>
                </View>
                <TotalsLine expenses={m.items} />
              </View>
            ))}
          </Card>
        </>
      ) : null}

      <Button
        title={`Export ${formatMonth(month)} as CSV`}
        onPress={() => runExport(`money-tracker-month-${month}`, monthExpenses)}
        disabled={!monthExpenses.length}
        style={{ marginTop: 24 }}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  card: { padding: 16 },
  label: { letterSpacing: 0.5 },
  sectionLabel: { marginTop: 24, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  icon: { padding: 2 },
});
