import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Appearance } from 'react-native';

import { writeFolderBackup, type Snapshot } from '@/lib/backup';
import { normalizeExpenses, normalizeSettings } from '@/lib/migrate';
import { deleteReceipt, persistReceipt, type ReceiptDraft } from '@/lib/receipts';
import type { Bank, Currency, Expense, ExpenseInput, Settings, ThemeMode } from '@/lib/types';

// Keys stay at v1: older saved shapes are upgraded on load by normalizeExpenses/normalizeSettings.
const EXPENSES_KEY = 'money-tracker/expenses/v1';
const SETTINGS_KEY = 'money-tracker/settings/v1';
const BACKUP_DEBOUNCE_MS = 1500;

const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export type ReceiptChange = { kind: 'keep' } | { kind: 'remove' } | { kind: 'replace'; draft: ReceiptDraft };

export interface BackupStatus {
  state: 'idle' | 'saving' | 'error';
  error?: string;
}

interface Store {
  ready: boolean;
  expenses: Expense[];
  settings: Settings;
  backupStatus: BackupStatus;
  addExpense: (input: ExpenseInput, receipt: ReceiptDraft | null) => Expense;
  updateExpense: (id: string, input: ExpenseInput, receipt: ReceiptChange) => void;
  deleteExpense: (id: string) => void;
  setTheme: (theme: ThemeMode) => void;
  setDefaultCurrency: (currency: Currency) => void;
  /** Pass undefined (or 0) to clear the budget for that currency. */
  setMonthlyBudget: (currency: Currency, amount: number | undefined) => void;
  addBank: (name: string) => void;
  renameBank: (id: string, name: string) => void;
  removeBank: (id: string) => void;
  setBackupFolder: (uri: string | undefined) => void;
  /** Replaces all expenses (and portable settings) with a restored backup. */
  restore: (snapshot: Snapshot) => void;
  snapshot: () => Snapshot;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [settings, setSettings] = useState<Settings>(() => ({
    theme: Appearance.getColorScheme() === 'dark' ? 'dark' : 'light',
    banks: [],
    defaultCurrency: 'JPY',
    monthlyBudget: {},
  }));
  const [backupStatus, setBackupStatus] = useState<BackupStatus>({ state: 'idle' });

  useEffect(() => {
    (async () => {
      try {
        const [rawExpenses, rawSettings] = await Promise.all([
          AsyncStorage.getItem(EXPENSES_KEY),
          AsyncStorage.getItem(SETTINGS_KEY),
        ]);
        if (rawExpenses) setExpenses(normalizeExpenses(JSON.parse(rawExpenses)));
        if (rawSettings) {
          const parsed = JSON.parse(rawSettings);
          setSettings((s) => ({
            ...s,
            ...normalizeSettings(parsed),
            backupFolderUri: parsed.backupFolderUri,
            lastBackupAt: parsed.lastBackupAt,
          }));
        }
      } catch (e) {
        console.warn('Failed to load saved data', e);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  // Persist after the initial load so defaults never overwrite saved data.
  useEffect(() => {
    if (ready) AsyncStorage.setItem(EXPENSES_KEY, JSON.stringify(expenses)).catch(console.warn);
  }, [ready, expenses]);
  useEffect(() => {
    if (ready) AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)).catch(console.warn);
  }, [ready, settings]);

  const { theme, banks, defaultCurrency, monthlyBudget, backupFolderUri } = settings;
  const snapshotRef = useRef<Snapshot>({ expenses, settings: { theme, banks, defaultCurrency, monthlyBudget } });
  snapshotRef.current = { expenses, settings: { theme, banks, defaultCurrency, monthlyBudget } };
  const snapshot = useCallback(() => snapshotRef.current, []);

  // Mirror data into the Android backup folder shortly after anything changes.
  // `lastBackupAt` is deliberately not a dependency, so recording it doesn't trigger another backup.
  useEffect(() => {
    if (!ready || !backupFolderUri) return;
    const timer = setTimeout(async () => {
      setBackupStatus({ state: 'saving' });
      try {
        await writeFolderBackup(backupFolderUri, snapshotRef.current);
        setBackupStatus({ state: 'idle' });
        setSettings((s) => ({ ...s, lastBackupAt: new Date().toISOString() }));
      } catch (e) {
        console.warn('Backup failed', e);
        setBackupStatus({
          state: 'error',
          error: 'Could not write to the backup folder. Choose the folder again in Settings.',
        });
      }
    }, BACKUP_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [ready, backupFolderUri, expenses, theme, banks, defaultCurrency, monthlyBudget]);

  const addExpense = useCallback((input: ExpenseInput, draft: ReceiptDraft | null) => {
    const now = new Date().toISOString();
    const expense: Expense = {
      ...input,
      id: newId(),
      receipt: draft ? persistReceipt(draft) : undefined,
      createdAt: now,
      updatedAt: now,
    };
    setExpenses((list) => [expense, ...list]);
    return expense;
  }, []);

  const expensesRef = useRef(expenses);
  expensesRef.current = expenses;

  const updateExpense = useCallback((id: string, input: ExpenseInput, change: ReceiptChange) => {
    const current = expensesRef.current.find((e) => e.id === id);
    if (!current) return;
    let receipt = current.receipt;
    if (change.kind !== 'keep') {
      if (current.receipt) deleteReceipt(current.receipt);
      receipt = change.kind === 'replace' ? persistReceipt(change.draft) : undefined;
    }
    const now = new Date().toISOString();
    setExpenses((list) => list.map((e) => (e.id === id ? { ...e, ...input, receipt, updatedAt: now } : e)));
  }, []);

  const deleteExpense = useCallback((id: string) => {
    const current = expensesRef.current.find((e) => e.id === id);
    if (current?.receipt) deleteReceipt(current.receipt);
    setExpenses((list) => list.filter((e) => e.id !== id));
  }, []);

  const setTheme = useCallback((theme: ThemeMode) => setSettings((s) => ({ ...s, theme })), []);
  const setDefaultCurrency = useCallback(
    (defaultCurrency: Currency) => setSettings((s) => ({ ...s, defaultCurrency })),
    [],
  );

  const setMonthlyBudget = useCallback((currency: Currency, amount: number | undefined) => {
    setSettings((s) => {
      const monthlyBudget = { ...s.monthlyBudget };
      if (amount && amount > 0) monthlyBudget[currency] = amount;
      else delete monthlyBudget[currency];
      return { ...s, monthlyBudget };
    });
  }, []);

  const addBank = useCallback((name: string) => {
    const bank: Bank = { id: newId(), name: name.trim() };
    setSettings((s) => ({ ...s, banks: [...s.banks, bank] }));
  }, []);

  const renameBank = useCallback((id: string, name: string) => {
    setSettings((s) => ({ ...s, banks: s.banks.map((b) => (b.id === id ? { ...b, name: name.trim() } : b)) }));
  }, []);

  const removeBank = useCallback((id: string) => {
    setSettings((s) => ({ ...s, banks: s.banks.filter((b) => b.id !== id) }));
  }, []);

  const setBackupFolder = useCallback((uri: string | undefined) => {
    setBackupStatus({ state: 'idle' });
    setSettings((s) => ({ ...s, backupFolderUri: uri, lastBackupAt: uri ? s.lastBackupAt : undefined }));
  }, []);

  const restore = useCallback((snap: Snapshot) => {
    for (const e of expensesRef.current) {
      // Drop local receipt files the restored data no longer references.
      if (e.receipt && !snap.expenses.some((r) => r.receipt?.name === e.receipt?.name)) deleteReceipt(e.receipt);
    }
    setExpenses(snap.expenses);
    setSettings((s) => ({ ...s, ...snap.settings }));
  }, []);

  const value = useMemo<Store>(
    () => ({
      ready,
      expenses,
      settings,
      backupStatus,
      addExpense,
      updateExpense,
      deleteExpense,
      setTheme,
      setDefaultCurrency,
      setMonthlyBudget,
      addBank,
      renameBank,
      removeBank,
      setBackupFolder,
      restore,
      snapshot,
    }),
    [
      ready,
      expenses,
      settings,
      backupStatus,
      addExpense,
      updateExpense,
      deleteExpense,
      setTheme,
      setDefaultCurrency,
      setMonthlyBudget,
      addBank,
      renameBank,
      removeBank,
      setBackupFolder,
      restore,
      snapshot,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error('useStore must be used inside <StoreProvider>');
  return store;
}
