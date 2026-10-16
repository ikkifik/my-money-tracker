import { toDateKey } from './format';
import type { Expense, Settings } from './types';

/**
 * Upgrades expenses saved by older versions of the app (or older backups):
 * v1 stored a full `timestamp` and had no `currency`.
 */
export function normalizeExpense(raw: any): Expense {
  const { timestamp, ...rest } = raw ?? {};
  return {
    ...rest,
    currency: rest.currency === 'IDR' ? 'IDR' : 'JPY',
    date: typeof rest.date === 'string' ? rest.date : toDateKey(timestamp ? new Date(timestamp) : new Date()),
    amount: Math.max(0, Math.round(Number(rest.amount) || 0)),
  };
}

export function normalizeExpenses(raw: unknown): Expense[] {
  return Array.isArray(raw) ? raw.filter((e) => e && typeof e.id === 'string').map(normalizeExpense) : [];
}

/** Settings fields that travel with backups (device-specific ones like the backup folder do not). */
export type PortableSettings = Pick<Settings, 'theme' | 'banks' | 'defaultCurrency' | 'monthlyBudget'>;

export function normalizeSettings(raw: any): Partial<PortableSettings> {
  const out: Partial<PortableSettings> = {};
  if (raw?.theme === 'light' || raw?.theme === 'dark') out.theme = raw.theme;
  if (Array.isArray(raw?.banks)) out.banks = raw.banks.filter((b: any) => b && typeof b.name === 'string');
  if (raw?.defaultCurrency === 'JPY' || raw?.defaultCurrency === 'IDR') out.defaultCurrency = raw.defaultCurrency;
  if (raw?.monthlyBudget && typeof raw.monthlyBudget === 'object') {
    out.monthlyBudget = {};
    for (const c of ['JPY', 'IDR'] as const) {
      const v = Number(raw.monthlyBudget[c]);
      if (v > 0) out.monthlyBudget[c] = Math.round(v);
    }
  }
  return out;
}
