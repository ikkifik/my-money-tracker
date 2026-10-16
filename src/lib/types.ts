export type PaymentMethod = 'cash' | 'paypay' | 'bank_transfer';

export const PAYMENT_METHODS: { value: PaymentMethod; label: string }[] = [
  { value: 'cash', label: 'Cash' },
  { value: 'paypay', label: 'PayPay' },
  { value: 'bank_transfer', label: 'Bank transfer' },
];

export type Currency = 'JPY' | 'IDR';

export const CURRENCIES: { value: Currency; label: string }[] = [
  { value: 'JPY', label: 'Yen (¥)' },
  { value: 'IDR', label: 'Rupiah (Rp)' },
];

export interface Receipt {
  /** File name inside the app's receipts folder (and the backup folder). */
  name: string;
  sizeKB: number;
  /** Web only: the image itself, since web has no file system. */
  dataUri?: string;
}

export interface Expense {
  id: string;
  name: string;
  /** Whole units of `currency` (no decimals for either yen or rupiah). */
  amount: number;
  currency: Currency;
  /** Local calendar date, "YYYY-MM-DD". */
  date: string;
  method: PaymentMethod;
  /** Bank name, stored by value so history survives renaming/removing a bank. Only set for bank transfers. */
  bankName?: string;
  note?: string;
  receipt?: Receipt;
  createdAt: string;
  updatedAt: string;
}

export type ExpenseInput = Omit<Expense, 'id' | 'createdAt' | 'updatedAt' | 'receipt'>;

export interface Bank {
  id: string;
  name: string;
}

export type ThemeMode = 'light' | 'dark';

export interface Settings {
  theme: ThemeMode;
  banks: Bank[];
  defaultCurrency: Currency;
  /** Monthly spending limit per currency. The month total turns red once it is exceeded. */
  monthlyBudget: Partial<Record<Currency, number>>;
  /** Android only: SAF folder the app mirrors its data into, so it survives uninstalling the app. */
  backupFolderUri?: string;
  lastBackupAt?: string;
}

export function methodLabel(expense: Pick<Expense, 'method' | 'bankName'>): string {
  const base = PAYMENT_METHODS.find((m) => m.value === expense.method)?.label ?? expense.method;
  return expense.method === 'bank_transfer' && expense.bankName ? `${base} · ${expense.bankName}` : base;
}
