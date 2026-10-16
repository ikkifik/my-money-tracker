import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText, Button, usePalette } from './ui';

export interface DialogAction<T> {
  label: string;
  value: T;
  style?: 'primary' | 'secondary' | 'danger';
}

interface DialogOptions<T> {
  title: string;
  message?: string;
  actions: DialogAction<T>[];
}

interface DialogApi {
  /** Shows a themed modal and resolves with the chosen action's value, or undefined if dismissed. */
  show: <T>(options: DialogOptions<T>) => Promise<T | undefined>;
  /** Yes/no confirmation. Resolves true only when the confirm button is pressed. */
  confirm: (options: { title: string; message?: string; confirmLabel?: string; destructive?: boolean }) => Promise<boolean>;
  /** Message with a single OK button. */
  alert: (title: string, message?: string) => Promise<void>;
}

const DialogContext = createContext<DialogApi | null>(null);

type Pending = DialogOptions<unknown> & { resolve: (value: unknown) => void };

/** In-app replacement for Alert.alert / window.confirm so dialogs match the app's theme and font. */
export function DialogProvider({ children }: { children: ReactNode }) {
  const p = usePalette();
  const [pending, setPending] = useState<Pending | null>(null);
  const pendingRef = useRef<Pending | null>(null);

  const close = useCallback((value: unknown) => {
    pendingRef.current?.resolve(value);
    pendingRef.current = null;
    setPending(null);
  }, []);

  const show = useCallback(<T,>(options: DialogOptions<T>) => {
    pendingRef.current?.resolve(undefined); // only one dialog at a time
    return new Promise<T | undefined>((resolve) => {
      const next = { ...options, resolve: resolve as (value: unknown) => void } as Pending;
      pendingRef.current = next;
      setPending(next);
    });
  }, []);

  const api = useRef<DialogApi>({
    show,
    confirm: async ({ title, message, confirmLabel = 'OK', destructive }) =>
      (await show({
        title,
        message,
        actions: [
          { label: 'Cancel', value: false, style: 'secondary' },
          { label: confirmLabel, value: true, style: destructive ? 'danger' : 'primary' },
        ],
      })) === true,
    alert: async (title, message) => {
      await show({ title, message, actions: [{ label: 'OK', value: true }] });
    },
  }).current;

  const stacked = (pending?.actions.length ?? 0) > 2;

  return (
    <DialogContext.Provider value={api}>
      {children}
      <Modal
        visible={!!pending}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={() => close(undefined)}
      >
        <Pressable style={styles.backdrop} onPress={() => close(undefined)} accessibilityLabel="Dismiss">
          {/* Inner Pressable swallows taps so touching the card doesn't dismiss it. */}
          <Pressable style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => {}}>
            <AppText weight="bold" size={18} accessibilityRole="header">
              {pending?.title}
            </AppText>
            {pending?.message ? (
              <AppText muted style={styles.message}>
                {pending.message}
              </AppText>
            ) : null}
            <View style={[styles.actions, stacked && styles.actionsStacked]}>
              {pending?.actions.map((a) => (
                <Button
                  key={a.label}
                  title={a.label}
                  variant={a.style ?? 'primary'}
                  onPress={() => close(a.value)}
                  style={stacked ? undefined : styles.action}
                />
              ))}
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialog(): DialogApi {
  const api = useContext(DialogContext);
  if (!api) throw new Error('useDialog must be used inside <DialogProvider>');
  return api;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: { width: '100%', maxWidth: 400, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  message: { marginTop: 8, lineHeight: 21 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 20 },
  actionsStacked: { flexDirection: 'column-reverse' },
  action: { flex: 1 },
});
