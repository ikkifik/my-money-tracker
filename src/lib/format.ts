import type { Currency, Expense } from './types';

const CURRENCY_FORMAT: Record<Currency, { symbol: string; separator: string }> = {
  JPY: { symbol: '¥', separator: ',' },
  IDR: { symbol: 'Rp', separator: '.' },
};

export function currencySymbol(currency: Currency): string {
  return CURRENCY_FORMAT[currency].symbol;
}

/** 1234567 → "1,234,567" (JPY) or "1.234.567" (IDR). Done by hand so it doesn't depend on the device's Intl data. */
export function groupDigits(amount: number, currency: Currency): string {
  return String(Math.trunc(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, CURRENCY_FORMAT[currency].separator);
}

export function formatMoney(amount: number, currency: Currency): string {
  const { symbol } = CURRENCY_FORMAT[currency];
  return currency === 'IDR' ? `${symbol} ${groupDigits(amount, currency)}` : `${symbol}${groupDigits(amount, currency)}`;
}

/** Re-formats whatever was typed into the amount field: keeps digits only, then adds separators. */
export function formatAmountInput(text: string, currency: Currency): string {
  const digits = text.replace(/\D/g, '').replace(/^0+(?=\d)/, '').slice(0, 15);
  return digits ? groupDigits(Number(digits), currency) : '';
}

export function parseAmountInput(text: string): number {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pad = (n: number) => String(n).padStart(2, '0');

/** "Thu, 16 Oct 2026" */
export function formatDate(d: Date): string {
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`;
}

/** "14:05" */
export function formatTime(d: Date): string {
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Local date → "YYYY-MM-DD". */
export function toDateKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** "YYYY-MM-DD" → local midnight. (`new Date('2026-10-16')` would parse as UTC.) */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

/** Monday 00:00 (local time) of the week containing `d`. */
export function startOfWeek(d: Date): Date {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (start.getDay() + 6) % 7; // Mon=0 … Sun=6
  start.setDate(start.getDate() - offset);
  return start;
}

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** Oldest month the app lets you browse (and the earliest date an expense can have). */
export const FIRST_MONTH = '2026-08';

/** "YYYY-MM" for the month containing `d`. */
export function toMonthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** "2026-10" → "October 2026" */
export function formatMonth(monthKey: string): string {
  const [y, m] = monthKey.split('-').map(Number);
  return `${MONTHS_LONG[m - 1]} ${y}`;
}

/** Shifts a "YYYY-MM" key by `delta` months. */
export function addMonths(monthKey: string, delta: number): string {
  const [y, m] = monthKey.split('-').map(Number);
  return toMonthKey(new Date(y, m - 1 + delta, 1));
}

/** Every "YYYY-MM" from `from` to `to`, inclusive, oldest first. */
export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  for (let m = from; m <= to; m = addMonths(m, 1)) out.push(m);
  return out;
}

/** First and last day (local midnight) of a "YYYY-MM" month. */
export function monthRange(monthKey: string): { start: Date; end: Date } {
  const [y, m] = monthKey.split('-').map(Number);
  return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
}

export type Totals = Partial<Record<Currency, number>>;

export function totalsOf(expenses: Expense[]): Totals {
  const totals: Totals = {};
  for (const e of expenses) totals[e.currency] = (totals[e.currency] ?? 0) + e.amount;
  return totals;
}

export interface WeekGroup {
  key: string;
  /** Full Monday–Sunday week. */
  start: Date;
  end: Date;
  /** Part of the week actually shown (a week can straddle two months). */
  shownStart: Date;
  shownEnd: Date;
  title: string;
  /** Totals per currency, only for currencies used that week. */
  totals: Totals;
  data: Expense[];
}

function weekTitle(start: Date, end: Date): string {
  const thisWeek = startOfWeek(new Date()).getTime();
  const week = 7 * 24 * 60 * 60 * 1000;
  if (start.getTime() === thisWeek) return 'This week';
  if (start.getTime() === thisWeek - week) return 'Last week';
  const sameYear = start.getFullYear() === end.getFullYear();
  const from = `${start.getDate()} ${MONTHS[start.getMonth()]}${sameYear ? '' : ` ${start.getFullYear()}`}`;
  return `${from} – ${end.getDate()} ${MONTHS[end.getMonth()]} ${end.getFullYear()}`;
}

/**
 * Groups expenses into Monday–Sunday weeks, newest week and newest expense first.
 * With `clip` (e.g. a month), `shownStart`/`shownEnd` are trimmed to it.
 */
export function groupByWeek(expenses: Expense[], clip?: { start: Date; end: Date }): WeekGroup[] {
  const sorted = [...expenses].sort(
    (a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt),
  );
  const groups = new Map<number, WeekGroup>();
  for (const expense of sorted) {
    const start = startOfWeek(fromDateKey(expense.date));
    let group = groups.get(start.getTime());
    if (!group) {
      const end = new Date(start);
      end.setDate(end.getDate() + 6);
      const shownStart = clip && clip.start > start ? clip.start : start;
      const shownEnd = clip && clip.end < end ? clip.end : end;
      group = {
        key: String(start.getTime()),
        start,
        end,
        shownStart,
        shownEnd,
        title: weekTitle(start, end),
        totals: {},
        data: [],
      };
      groups.set(start.getTime(), group);
    }
    group.data.push(expense);
    group.totals[expense.currency] = (group.totals[expense.currency] ?? 0) + expense.amount;
  }
  return [...groups.values()];
}
