import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { BackupError } from './backup';
import { PAYMENT_METHODS, type Expense } from './types';

const HEADER = ['Date', 'Expense', 'Amount', 'Currency', 'Payment method', 'Bank', 'Note'];

/** Quotes a field when it contains a comma, quote or line break (RFC 4180). */
function escape(value: string | number | undefined): string {
  const text = value === undefined ? '' : String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** Records only — receipt photos stay in the app. Oldest first, as a report reads. */
export function buildCsv(expenses: Expense[]): string {
  const rows = [...expenses]
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.localeCompare(b.createdAt))
    .map((e) => [
      e.date,
      e.name,
      e.amount, // plain number so spreadsheets can sum it
      e.currency,
      PAYMENT_METHODS.find((m) => m.value === e.method)?.label ?? e.method,
      e.method === 'bank_transfer' ? e.bankName : '',
      e.note,
    ]);
  // BOM so Excel opens UTF-8 (¥, Japanese/Indonesian text) correctly.
  return '﻿' + [HEADER, ...rows].map((r) => r.map(escape).join(',')).join('\r\n') + '\r\n';
}

/** Saves `<fileName>.csv` and opens the share sheet (native) or downloads it (web). */
export async function exportCsv(fileName: string, expenses: Expense[]): Promise<void> {
  const csv = buildCsv(expenses);
  const name = `${fileName}.csv`;

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }

  const file = new File(Paths.cache, name);
  if (file.exists) file.delete();
  file.create();
  file.writeSync(csv);
  if (!(await Sharing.isAvailableAsync())) throw new BackupError('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: `Save ${name}`,
  });
}
