import { StyleSheet, View } from 'react-native';

import { formatMoney, totalsOf } from '@/lib/format';
import { CURRENCIES, type Currency, type Expense } from '@/lib/types';

import { AppText, usePalette } from './ui';

/** Monthly total per currency, measured against the monthly budget (red when exceeded). */
export function MonthTotals({
  expenses,
  budget,
}: {
  expenses: Expense[];
  budget: Partial<Record<Currency, number>>;
}) {
  const p = usePalette();
  const totals = totalsOf(expenses);
  // Show a currency if it was spent this month or has a budget; fall back to yen for an empty month.
  let shown = CURRENCIES.filter((c) => totals[c.value] !== undefined || budget[c.value]);
  if (!shown.length) shown = CURRENCIES.filter((c) => c.value === 'JPY');

  return (
    <View>
      {shown.map((c) => {
        const total = totals[c.value] ?? 0;
        const limit = budget[c.value];
        const over = !!limit && total > limit;
        const ratio = limit ? Math.min(total / limit, 1) : 0;
        return (
          <View key={c.value} style={{ marginTop: 10 }}>
            <AppText weight="bold" size={26} color={over ? p.danger : p.text}>
              {formatMoney(total, c.value)}
            </AppText>
            {limit ? (
              <>
                <View style={[styles.track, { backgroundColor: p.border }]}>
                  <View style={[styles.fill, { width: `${ratio * 100}%`, backgroundColor: over ? p.danger : p.primary }]} />
                </View>
                <AppText size={12} color={over ? p.danger : p.muted} weight={over ? 'semibold' : 'regular'}>
                  {over
                    ? `Over budget by ${formatMoney(total - limit, c.value)} (budget ${formatMoney(limit, c.value)})`
                    : `${formatMoney(limit - total, c.value)} left of ${formatMoney(limit, c.value)} budget`}
                </AppText>
              </>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

/** Totals per currency on one line, e.g. "¥12,300 · Rp 45.000". */
export function TotalsLine({ expenses, color }: { expenses: Expense[]; color?: string }) {
  const totals = totalsOf(expenses);
  const parts = CURRENCIES.filter((c) => totals[c.value] !== undefined).map((c) => formatMoney(totals[c.value]!, c.value));
  return (
    <AppText weight="semibold" color={color} style={{ textAlign: 'right' }}>
      {parts.join('\n') || '—'}
    </AppText>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: 3, overflow: 'hidden', marginTop: 8, marginBottom: 6 },
  fill: { height: '100%', borderRadius: 3 },
});
