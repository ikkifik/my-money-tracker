import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { useDialog } from '@/components/Dialog';
import { NotFound } from '@/components/NotFound';
import { ReceiptThumbnail } from '@/components/Receipt';
import { AppText, Button, Card, usePalette } from '@/components/ui';
import { formatDate, formatMoney, formatTime, fromDateKey } from '@/lib/format';
import { receiptUri } from '@/lib/receipts';
import { CURRENCIES, PAYMENT_METHODS } from '@/lib/types';
import { useStore } from '@/state/store';

export default function ExpenseDetailScreen() {
  const p = usePalette();
  const dialog = useDialog();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { expenses, deleteExpense } = useStore();
  const expense = expenses.find((e) => e.id === id);

  if (!expense) return <NotFound />;

  const method = PAYMENT_METHODS.find((m) => m.value === expense.method)?.label ?? expense.method;
  const currency = CURRENCIES.find((c) => c.value === expense.currency)?.label ?? expense.currency;

  const rows: { icon: keyof typeof Ionicons.glyphMap; label: string; value: string }[] = [
    { icon: 'calendar-outline', label: 'Date', value: formatDate(fromDateKey(expense.date)) },
    { icon: 'cash-outline', label: 'Currency', value: currency },
    { icon: 'card-outline', label: 'Payment method', value: method },
  ];
  if (expense.method === 'bank_transfer') {
    rows.push({ icon: 'business-outline', label: 'Bank', value: expense.bankName || '—' });
  }

  const remove = async () => {
    const ok = await dialog.confirm({
      title: 'Delete expense?',
      message: `"${expense.name}"${expense.receipt ? ' and its receipt photo' : ''} will be permanently removed.`,
      confirmLabel: 'Delete',
      destructive: true,
    });
    if (!ok) return;
    deleteExpense(expense.id);
    router.back();
  };

  const stamp = (iso: string) => `${formatDate(new Date(iso))} ${formatTime(new Date(iso))}`;

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <AppText muted size={14}>
          {expense.name}
        </AppText>
        <AppText weight="bold" size={36} style={{ marginTop: 4 }}>
          {formatMoney(expense.amount, expense.currency)}
        </AppText>
      </View>

      <Card>
        {rows.map((row, i) => (
          <View key={row.label} style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }]}>
            <Ionicons name={row.icon} size={18} color={p.muted} />
            <AppText muted style={{ flex: 1 }}>
              {row.label}
            </AppText>
            <AppText weight="semibold">{row.value}</AppText>
          </View>
        ))}
      </Card>

      {expense.receipt ? (
        <View style={{ marginTop: 16 }}>
          <AppText muted size={12} weight="semibold" style={styles.sectionLabel}>
            RECEIPT
          </AppText>
          <ReceiptThumbnail uri={receiptUri(expense.receipt)} sizeKB={expense.receipt.sizeKB} height={240} />
        </View>
      ) : null}

      {expense.note ? (
        <Card style={{ marginTop: 16, padding: 14 }}>
          <AppText muted size={12} weight="semibold" style={{ marginBottom: 4 }}>
            NOTE
          </AppText>
          <AppText>{expense.note}</AppText>
        </Card>
      ) : null}

      <AppText muted size={12} style={{ marginTop: 12, textAlign: 'center' }}>
        Added {stamp(expense.createdAt)}
        {expense.updatedAt !== expense.createdAt ? ` · edited ${stamp(expense.updatedAt)}` : ''}
      </AppText>

      <View style={styles.actions}>
        <Button
          title="Edit"
          style={{ flex: 1 }}
          onPress={() => router.push({ pathname: '/expense/edit/[id]', params: { id: expense.id } })}
        />
        <Button title="Delete" variant="danger" style={{ flex: 1 }} onPress={remove} />
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 24 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 14 },
  sectionLabel: { marginBottom: 6, letterSpacing: 0.5 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 24 },
});
