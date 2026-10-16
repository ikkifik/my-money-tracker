import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { currencySymbol, formatAmountInput, groupDigits, parseAmountInput, toDateKey } from '@/lib/format';
import { receiptUri } from '@/lib/receipts';
import { CURRENCIES, PAYMENT_METHODS, type Currency, type Expense, type ExpenseInput, type PaymentMethod } from '@/lib/types';
import { useStore, type ReceiptChange } from '@/state/store';

import { DateField } from './DateField';
import { ReceiptField } from './Receipt';
import { AppText, Button, Chip, Field, Input, Segmented, usePalette } from './ui';

interface Props {
  initial?: Expense;
  submitLabel: string;
  onSubmit: (input: ExpenseInput, receipt: ReceiptChange) => void;
}

export function ExpenseForm({ initial, submitLabel, onSubmit }: Props) {
  const p = usePalette();
  const { banks, defaultCurrency } = useStore().settings;

  const [name, setName] = useState(initial?.name ?? '');
  const [currency, setCurrency] = useState<Currency>(initial?.currency ?? defaultCurrency);
  const [amount, setAmount] = useState(initial ? groupDigits(initial.amount, initial.currency) : '');
  const [date, setDate] = useState(initial?.date ?? toDateKey(new Date()));
  const [method, setMethod] = useState<PaymentMethod>(initial?.method ?? 'cash');
  const [bankName, setBankName] = useState(initial?.bankName ?? banks[0]?.name ?? '');
  const [note, setNote] = useState(initial?.note ?? '');
  const [receipt, setReceipt] = useState<ReceiptChange>({ kind: 'keep' });
  const [showErrors, setShowErrors] = useState(false);

  const parsedAmount = parseAmountInput(amount);
  const errors = {
    name: name.trim() ? null : 'Enter what you spent on.',
    amount: parsedAmount > 0 ? null : 'Enter an amount above 0.',
    bank: method !== 'bank_transfer' || bankName ? null : 'Pick the bank you transferred from.',
  };
  const valid = !errors.name && !errors.amount && !errors.bank;

  // Keep a bank that was later removed from settings selectable when editing an old expense.
  const bankOptions = banks.map((b) => b.name);
  if (initial?.bankName && !bankOptions.includes(initial.bankName)) bankOptions.push(initial.bankName);

  const shownReceipt =
    receipt.kind === 'replace'
      ? receipt.draft
      : receipt.kind === 'keep' && initial?.receipt
        ? { uri: receiptUri(initial.receipt), sizeKB: initial.receipt.sizeKB }
        : null;

  const changeCurrency = (next: Currency) => {
    setCurrency(next);
    setAmount((a) => formatAmountInput(a, next)); // swap "," ↔ "." separators
  };

  const submit = () => {
    if (!valid) {
      setShowErrors(true);
      return;
    }
    onSubmit(
      {
        name: name.trim(),
        amount: parsedAmount,
        currency,
        date,
        method,
        bankName: method === 'bank_transfer' ? bankName : undefined,
        note: note.trim() || undefined,
      },
      receipt,
    );
  };

  const error = (msg: string | null) =>
    showErrors && msg ? (
      <AppText size={12} color={p.danger} style={{ marginTop: 4 }}>
        {msg}
      </AppText>
    ) : null;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Field label="Expense name">
          <Input value={name} onChangeText={setName} placeholder="e.g. Groceries at Aeon" autoFocus={!initial} />
          {error(errors.name)}
        </Field>

        <Field label="Currency">
          <Segmented options={CURRENCIES} value={currency} onChange={changeCurrency} />
        </Field>

        <Field label="Amount">
          <View style={styles.amountRow}>
            <AppText weight="semibold" size={18} muted style={styles.symbol}>
              {currencySymbol(currency)}
            </AppText>
            <Input
              value={amount}
              onChangeText={(text) => setAmount(formatAmountInput(text, currency))}
              placeholder="0"
              keyboardType="number-pad"
              style={styles.amountInput}
            />
          </View>
          {error(errors.amount)}
        </Field>

        <Field label="Date">
          <DateField value={date} onChange={setDate} />
        </Field>

        <Field label="Payment method">
          <Segmented options={PAYMENT_METHODS} value={method} onChange={setMethod} />
        </Field>

        {method === 'bank_transfer' ? (
          <Field label="Bank">
            {bankOptions.length ? (
              <View style={styles.chips}>
                {bankOptions.map((b) => (
                  <Chip key={b} label={b} selected={b === bankName} onPress={() => setBankName(b)} />
                ))}
              </View>
            ) : (
              <AppText muted size={14}>
                No banks yet.{' '}
                <Link href="/settings">
                  <AppText size={14} weight="semibold" color={p.primary}>
                    Add one in Settings
                  </AppText>
                </Link>
              </AppText>
            )}
            {error(errors.bank)}
          </Field>
        ) : null}

        <Field label="Receipt (optional)">
          <ReceiptField current={shownReceipt} onChange={setReceipt} />
        </Field>

        <Field label="Note (optional)">
          <Input value={note} onChangeText={setNote} placeholder="Anything worth remembering" multiline style={styles.note} />
        </Field>

        <Button title={submitLabel} onPress={submit} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  note: { minHeight: 80, textAlignVertical: 'top' },
  amountRow: { flexDirection: 'row', alignItems: 'center' },
  symbol: { position: 'absolute', left: 12, zIndex: 1 },
  amountInput: { flex: 1, paddingLeft: 44, fontSize: 18 },
});
