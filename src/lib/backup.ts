/**
 * Keeping data after the app is uninstalled.
 *
 * Everything the app saves normally lives in its private storage, which survives app updates but is
 * wiped on uninstall. To outlive an uninstall the data has to sit somewhere the user owns:
 *
 * - Android: the user picks a folder once (Storage Access Framework). The app then mirrors its data
 *   (`money-tracker-data-<time>.json`) and receipt photos (`mt-receipt-*.jpg`) into it after every
 *   change. After reinstalling, "Restore from backup folder" reads it back.
 * - iOS (and Android too): "Export backup file" writes one JSON file — receipts embedded — and opens
 *   the share sheet so it can be saved to Files / iCloud Drive / Google Drive. "Import backup file"
 *   restores it. iOS doesn't let an app keep writing to an outside folder across launches.
 */
import { Directory, File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';

import { toDateKey } from './format';
import { normalizeExpenses, normalizeSettings, type PortableSettings } from './migrate';
import { RECEIPT_PREFIX, receiptsDir } from './receipts';
import type { Expense } from './types';

const DATA_PREFIX = 'money-tracker-data-';
const BACKUP_VERSION = 2;

export const supportsFolderBackup = Platform.OS === 'android';
export const supportsFileBackup = Platform.OS === 'android' || Platform.OS === 'ios';

export interface Snapshot {
  expenses: Expense[];
  settings: Partial<PortableSettings>;
}

interface BackupFile extends Snapshot {
  app: 'money-tracker';
  version: number;
  savedAt: string;
  /** Only in exported single-file backups: receipt name → JPEG base64. */
  receipts?: Record<string, string>;
}

export class BackupError extends Error {}

function serialize(snapshot: Snapshot, receipts?: Record<string, string>): string {
  const file: BackupFile = {
    app: 'money-tracker',
    version: BACKUP_VERSION,
    savedAt: new Date().toISOString(),
    ...snapshot,
    receipts,
  };
  return JSON.stringify(file);
}

function parse(text: string): BackupFile {
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    throw new BackupError("That file isn't a Money Tracker backup.");
  }
  if (data?.app !== 'money-tracker' || !Array.isArray(data.expenses)) {
    throw new BackupError("That file isn't a Money Tracker backup.");
  }
  return { ...data, expenses: normalizeExpenses(data.expenses), settings: normalizeSettings(data.settings) };
}

const receiptNames = (expenses: Expense[]) =>
  new Set(expenses.flatMap((e) => (e.receipt && !e.receipt.dataUri ? [e.receipt.name] : [])));

const isFile = (entry: File | Directory): entry is File => entry instanceof File;

// ---------- Android backup folder ----------

/** Asks the user for a folder. Returns its URI, or null if they cancelled. */
export async function chooseBackupFolder(): Promise<string | null> {
  try {
    const dir = await Directory.pickDirectoryAsync();
    return dir.uri;
  } catch {
    return null;
  }
}

/** Mirrors the snapshot and all receipt photos into the backup folder. */
export async function writeFolderBackup(folderUri: string, snapshot: Snapshot): Promise<void> {
  const dir = new Directory(folderUri);
  const entries = dir.list().filter(isFile);
  const present = new Set(entries.map((f) => f.name));
  const wanted = receiptNames(snapshot.expenses);

  for (const name of wanted) {
    if (present.has(name)) continue; // receipts never change once taken, so existing copies are current
    const local = new File(receiptsDir(), name);
    if (local.exists) await dir.createFile(name, 'image/jpeg').write(local.bytesSync());
  }

  // Always write a fresh data file, then remove the older ones. Overwriting in place is unsafe:
  // some Android storage providers don't truncate, which would leave a corrupt JSON tail.
  const dataName = `${DATA_PREFIX}${Date.now()}.json`;
  await dir.createFile(dataName, 'application/json').write(serialize(snapshot));

  for (const entry of entries) {
    const staleData = entry.name.startsWith(DATA_PREFIX) && entry.name !== dataName;
    const staleReceipt = entry.name.startsWith(RECEIPT_PREFIX) && !wanted.has(entry.name);
    if (staleData || staleReceipt) {
      try {
        entry.delete();
      } catch (e) {
        console.warn('Could not remove old backup file', entry.name, e);
      }
    }
  }
}

/** Reads the newest data file in the folder and copies its receipt photos back into the app. */
export async function readFolderBackup(folderUri: string): Promise<Snapshot> {
  const entries = new Directory(folderUri).list().filter(isFile);
  const dataFiles = entries
    .filter((f) => f.name.startsWith(DATA_PREFIX) && f.name.endsWith('.json'))
    .sort((a, b) => b.name.localeCompare(a.name));
  if (!dataFiles.length) throw new BackupError('No Money Tracker backup was found in that folder.');

  const backup = parse(await dataFiles[0].text());
  const byName = new Map(entries.map((f) => [f.name, f]));
  for (const name of receiptNames(backup.expenses)) {
    const source = byName.get(name);
    const target = new File(receiptsDir(), name);
    if (source && !target.exists) target.writeSync(source.bytesSync());
  }
  return { expenses: backup.expenses, settings: backup.settings };
}

// ---------- Single-file export / import ----------

/** Writes one self-contained backup file and opens the share sheet to save it somewhere safe. */
export async function exportBackupFile(snapshot: Snapshot): Promise<void> {
  const receipts: Record<string, string> = {};
  for (const name of receiptNames(snapshot.expenses)) {
    const local = new File(receiptsDir(), name);
    if (local.exists) receipts[name] = local.base64Sync();
  }
  const file = new File(Paths.cache, `money-tracker-backup-${toDateKey(new Date())}.json`);
  if (file.exists) file.delete();
  file.create();
  file.writeSync(serialize(snapshot, receipts));
  if (!(await Sharing.isAvailableAsync())) throw new BackupError('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, {
    mimeType: 'application/json',
    UTI: 'public.json',
    dialogTitle: 'Save Money Tracker backup',
  });
}

/** Lets the user pick a backup file. Returns null if they cancelled. */
export async function importBackupFile(): Promise<Snapshot | null> {
  const picked = await File.pickFileAsync({ mimeTypes: ['application/json', 'text/plain', '*/*'] });
  if (picked.canceled) return null;
  const backup = parse(await picked.result.text());
  for (const [name, b64] of Object.entries(backup.receipts ?? {})) {
    if (!name.startsWith(RECEIPT_PREFIX) || name.includes('/')) continue;
    const target = new File(receiptsDir(), name);
    if (!target.exists) target.writeSync(b64, { encoding: 'base64' });
  }
  return { expenses: backup.expenses, settings: backup.settings };
}
