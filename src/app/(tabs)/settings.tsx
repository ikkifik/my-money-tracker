import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { useDialog } from '@/components/Dialog';
import { AppText, Button, Card, Field, Input, Segmented, usePalette } from '@/components/ui';
import {
  BackupError,
  chooseBackupFolder,
  exportBackupFile,
  importBackupFile,
  readFolderBackup,
  supportsFileBackup,
  supportsFolderBackup,
  type Snapshot,
} from '@/lib/backup';
import {
  currencySymbol,
  formatAmountInput,
  formatDate,
  formatTime,
  groupDigits,
  parseAmountInput,
  toDateKey,
} from '@/lib/format';
import { exportCsv } from '@/lib/csv';
import { CURRENCIES, type Bank, type ThemeMode } from '@/lib/types';
import { useStore } from '@/state/store';

const THEMES: { value: ThemeMode; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function SettingsScreen() {
  const p = usePalette();
  const dialog = useDialog();
  const { expenses, settings, setTheme, setDefaultCurrency, setMonthlyBudget, addBank, renameBank, removeBank } = useStore();
  const [newBank, setNewBank] = useState('');

  const exists = (name: string, exceptId?: string) =>
    settings.banks.some((b) => b.id !== exceptId && b.name.toLowerCase() === name.trim().toLowerCase());

  const canAdd = newBank.trim().length > 0 && !exists(newBank);
  const submitNewBank = () => {
    if (!canAdd) return;
    addBank(newBank);
    setNewBank('');
  };

  return (
    <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      <Field label="Appearance">
        <Segmented options={THEMES} value={settings.theme} onChange={setTheme} />
      </Field>

      <Field label="Default currency" hint="Pre-selected for new expenses. Each expense can still use either currency.">
        <Segmented options={CURRENCIES} value={settings.defaultCurrency} onChange={setDefaultCurrency} />
      </Field>

      <Field
        label="Monthly budget"
        hint="The month's total on the Expenses tab turns red once spending goes over this. Leave empty for no limit."
      >
        <View style={{ gap: 8 }}>
          {CURRENCIES.map((c) => (
            <View key={c.value} style={styles.budgetRow}>
              <AppText weight="semibold" size={16} muted style={styles.budgetSymbol}>
                {currencySymbol(c.value)}
              </AppText>
              <Input
                value={settings.monthlyBudget[c.value] ? groupDigits(settings.monthlyBudget[c.value]!, c.value) : ''}
                onChangeText={(text) => setMonthlyBudget(c.value, parseAmountInput(formatAmountInput(text, c.value)))}
                placeholder={`No limit (${c.label})`}
                keyboardType="number-pad"
                accessibilityLabel={`Monthly budget in ${c.label}`}
                style={styles.budgetInput}
              />
            </View>
          ))}
        </View>
      </Field>

      <Field label="Banks" hint="Used when an expense is paid by bank transfer. Names only — nothing is connected.">
        {settings.banks.length ? (
          <Card style={{ marginBottom: 10 }}>
            {settings.banks.map((bank, i) => (
              <BankRow
                key={bank.id}
                bank={bank}
                first={i === 0}
                isDuplicate={(name) => exists(name, bank.id)}
                onRename={(name) => renameBank(bank.id, name)}
                onRemove={async () => {
                  const ok = await dialog.confirm({
                    title: 'Remove bank?',
                    message: `"${bank.name}" will be removed from the list. Existing expenses keep it.`,
                    confirmLabel: 'Remove',
                    destructive: true,
                  });
                  if (ok) removeBank(bank.id);
                }}
              />
            ))}
          </Card>
        ) : (
          <AppText muted size={14} style={{ marginBottom: 10 }}>
            No banks added yet.
          </AppText>
        )}
        <View style={styles.addRow}>
          <Input
            value={newBank}
            onChangeText={setNewBank}
            onSubmitEditing={submitNewBank}
            placeholder="Bank name, e.g. Shizuoka Bank"
            returnKeyType="done"
            style={{ flex: 1 }}
          />
          <Button title="Add" onPress={submitNewBank} disabled={!canAdd} />
        </View>
        {newBank.trim() && exists(newBank) ? (
          <AppText size={12} color={p.danger} style={{ marginTop: 4 }}>
            That bank is already in the list.
          </AppText>
        ) : null}
      </Field>

      <Field
        label="Export records"
        hint="Every expense in one CSV file (date, name, amount, currency, payment method, bank, note). Receipt pictures are not included."
      >
        <Button
          title="Export all records (CSV)"
          variant="secondary"
          disabled={!expenses.length}
          onPress={async () => {
            try {
              await exportCsv(`money-tracker-all-${toDateKey(new Date())}`, expenses);
            } catch (e) {
              console.warn(e);
              await dialog.alert('Export failed', e instanceof BackupError ? e.message : 'The CSV file could not be created.');
            }
          }}
        />
      </Field>

      <BackupSection />

      <AppText muted size={12} style={{ textAlign: 'center', marginTop: 12 }}>
        My Money Tracker · works fully offline
      </AppText>
    </ScrollView>
  );
}

function folderLabel(uri: string): string {
  // SAF tree URIs end in e.g. "primary%3ADocuments%2FMoneyTracker".
  const tail = decodeURIComponent(uri.split('/').pop() ?? uri);
  return tail.replace(/^primary:/, 'Internal storage/');
}

function BackupSection() {
  const p = usePalette();
  const dialog = useDialog();
  const { expenses, settings, backupStatus, setBackupFolder, restore, snapshot } = useStore();
  const [busy, setBusy] = useState<string | null>(null);

  const run = async (label: string, task: () => Promise<void>) => {
    setBusy(label);
    try {
      await task();
    } catch (e) {
      console.warn(e);
      await dialog.alert(
        'Something went wrong',
        e instanceof BackupError ? e.message : 'The backup could not be read or written. Please try again.',
      );
    } finally {
      setBusy(null);
    }
  };

  /** Confirms before replacing this phone's data with a backup. */
  const confirmRestore = async (snap: Snapshot) => {
    if (!expenses.length) return true;
    return dialog.confirm({
      title: 'Replace data on this phone?',
      message: `The backup has ${plural(snap.expenses.length, 'expense')}. It will replace the ${plural(expenses.length, 'expense')} currently on this phone.`,
      confirmLabel: 'Restore',
      destructive: true,
    });
  };

  const chooseFolder = () =>
    run('folder', async () => {
      const uri = await chooseBackupFolder();
      if (!uri) return;
      let existing: Snapshot | null = null;
      try {
        existing = await readFolderBackup(uri);
      } catch (e) {
        if (!(e instanceof BackupError)) throw e; // BackupError = empty folder, which is fine
      }
      if (existing) {
        // Never silently overwrite an existing backup (e.g. right after reinstalling the app).
        const choice = await dialog.show({
          title: 'Backup found',
          message: `This folder already has a backup with ${plural(existing.expenses.length, 'expense')}. What would you like to do?`,
          actions: [
            { label: 'Cancel', value: 'cancel', style: 'secondary' },
            { label: "Overwrite with this phone's data", value: 'overwrite', style: 'danger' },
            { label: 'Restore it to this phone', value: 'restore', style: 'primary' },
          ],
        });
        if (choice === 'restore') restore(existing);
        else if (choice !== 'overwrite') return;
      }
      setBackupFolder(uri);
    });

  const restoreFromFolder = () =>
    run('restore', async () => {
      if (!settings.backupFolderUri) return;
      const snap = await readFolderBackup(settings.backupFolderUri);
      if (await confirmRestore(snap)) {
        restore(snap);
        await dialog.alert('Restored', `${plural(snap.expenses.length, 'expense')} restored from the backup folder.`);
      }
    });

  const turnOff = async () => {
    const ok = await dialog.confirm({
      title: 'Turn off auto-backup?',
      message: 'Files already in the folder are kept, but new changes will no longer be saved there.',
      confirmLabel: 'Turn off',
      destructive: true,
    });
    if (ok) setBackupFolder(undefined);
  };

  const exportFile = () => run('export', () => exportBackupFile(snapshot()));

  const importFile = () =>
    run('import', async () => {
      const snap = await importBackupFile();
      if (!snap) return;
      if (await confirmRestore(snap)) {
        restore(snap);
        await dialog.alert('Restored', `${plural(snap.expenses.length, 'expense')} restored from the backup file.`);
      }
    });

  if (!supportsFileBackup) {
    return (
      <Field label="Backup">
        <AppText muted size={14}>
          Backups are available in the phone app. In the browser, data is kept in this browser only.
        </AppText>
      </Field>
    );
  }

  return (
    <Field
      label="Backup"
      hint="Your data is kept through app updates. Uninstalling the app erases its own storage, so keep a backup outside the app."
    >
      {supportsFolderBackup ? (
        <Card style={{ padding: 14, marginBottom: 12, gap: 10 }}>
          <View style={styles.statusRow}>
            <Ionicons
              name={settings.backupFolderUri ? (backupStatus.state === 'error' ? 'warning' : 'cloud-done-outline') : 'cloud-offline-outline'}
              size={20}
              color={settings.backupFolderUri ? (backupStatus.state === 'error' ? p.danger : p.primary) : p.muted}
            />
            <AppText weight="semibold" style={{ flex: 1 }}>
              {settings.backupFolderUri ? 'Auto-backup is on' : 'Auto-backup is off'}
            </AppText>
            {backupStatus.state === 'saving' ? <ActivityIndicator size="small" /> : null}
          </View>
          {settings.backupFolderUri ? (
            <>
              <AppText muted size={13}>
                Folder: {folderLabel(settings.backupFolderUri)}
                {settings.lastBackupAt
                  ? `\nLast saved ${formatDate(new Date(settings.lastBackupAt))} ${formatTime(new Date(settings.lastBackupAt))}`
                  : ''}
              </AppText>
              {backupStatus.state === 'error' ? (
                <AppText size={13} color={p.danger}>
                  {backupStatus.error}
                </AppText>
              ) : null}
              <View style={styles.buttonRow}>
                <Button title="Change folder" variant="secondary" style={{ flex: 1 }} onPress={chooseFolder} disabled={!!busy} />
                <Button title="Turn off" variant="danger" style={{ flex: 1 }} onPress={turnOff} disabled={!!busy} />
              </View>
              <Button title="Restore from backup folder" variant="secondary" onPress={restoreFromFolder} disabled={!!busy} />
            </>
          ) : (
            <>
              <AppText muted size={13}>
                Pick a folder on your phone (for example Documents › MoneyTracker). Every change is saved there
                automatically, including receipt photos, and stays after the app is uninstalled. After reinstalling,
                choose the same folder to restore everything.
              </AppText>
              <Button title="Choose backup folder" onPress={chooseFolder} disabled={!!busy} />
            </>
          )}
        </Card>
      ) : null}

      <View style={styles.buttonRow}>
        <Button title="Export backup file" variant="secondary" style={{ flex: 1 }} onPress={exportFile} disabled={!!busy} />
        <Button title="Import backup file" variant="secondary" style={{ flex: 1 }} onPress={importFile} disabled={!!busy} />
      </View>
      {busy ? (
        <View style={[styles.statusRow, { marginTop: 8 }]}>
          <ActivityIndicator size="small" />
          <AppText muted size={13}>
            Working…
          </AppText>
        </View>
      ) : null}
    </Field>
  );
}

function BankRow({
  bank,
  first,
  isDuplicate,
  onRename,
  onRemove,
}: {
  bank: Bank;
  first: boolean;
  isDuplicate: (name: string) => boolean;
  onRename: (name: string) => void;
  onRemove: () => void;
}) {
  const p = usePalette();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(bank.name);
  const valid = draft.trim().length > 0 && !isDuplicate(draft);

  const save = () => {
    if (!valid) return;
    onRename(draft);
    setEditing(false);
  };

  return (
    <View style={[styles.bankRow, !first && { borderTopWidth: StyleSheet.hairlineWidth, borderColor: p.border }]}>
      {editing ? (
        <>
          <Input value={draft} onChangeText={setDraft} onSubmitEditing={save} autoFocus style={styles.inlineInput} />
          <IconButton name="checkmark" color={valid ? p.primary : p.muted} label="Save" onPress={save} />
          <IconButton
            name="close"
            color={p.muted}
            label="Cancel"
            onPress={() => {
              setDraft(bank.name);
              setEditing(false);
            }}
          />
        </>
      ) : (
        <>
          <Ionicons name="business-outline" size={18} color={p.muted} />
          <AppText style={{ flex: 1 }}>{bank.name}</AppText>
          <IconButton name="create-outline" color={p.primary} label={`Rename ${bank.name}`} onPress={() => setEditing(true)} />
          <IconButton name="trash-outline" color={p.danger} label={`Remove ${bank.name}`} onPress={onRemove} />
        </>
      )}
    </View>
  );
}

function IconButton({
  name,
  color,
  label,
  onPress,
}: {
  name: keyof typeof Ionicons.glyphMap;
  color: string;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} hitSlop={8} style={styles.iconButton}>
      <Ionicons name={name} size={20} color={color} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: 16, paddingBottom: 40 },
  addRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  bankRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, minHeight: 52 },
  inlineInput: { flex: 1, paddingVertical: 6, marginVertical: 6 },
  iconButton: { padding: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  buttonRow: { flexDirection: 'row', gap: 10 },
  budgetRow: { flexDirection: 'row', alignItems: 'center' },
  budgetSymbol: { position: 'absolute', left: 12, zIndex: 1 },
  budgetInput: { flex: 1, paddingLeft: 40 },
});
