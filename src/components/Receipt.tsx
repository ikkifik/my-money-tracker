import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { captureReceipt, type ReceiptSource } from '@/lib/receipts';
import type { ReceiptChange } from '@/state/store';

import { useDialog } from './Dialog';
import { AppText, Button, usePalette } from './ui';

/** Thumbnail that opens the receipt full screen when tapped. */
export function ReceiptThumbnail({ uri, sizeKB, height = 180 }: { uri: string; sizeKB: number; height?: number }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  return (
    <>
      <Pressable
        accessibilityRole="imagebutton"
        accessibilityLabel="Receipt photo. Tap to view full screen"
        onPress={() => setOpen(true)}
        style={[styles.thumb, { height, borderColor: p.border, backgroundColor: p.card }]}
      >
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} />
        <View style={styles.badge}>
          <AppText size={11} weight="semibold" color="#fff">
            {sizeKB} KB
          </AppText>
        </View>
      </Pressable>
      <ReceiptViewer uri={uri} visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

function ReceiptViewer({ uri, visible, onClose }: { uri: string; visible: boolean; onClose: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.viewer}>
        <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="contain" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close receipt"
          onPress={onClose}
          hitSlop={12}
          style={[styles.close, { top: insets.top + 12 }]}
        >
          <Ionicons name="close" size={26} color="#fff" />
        </Pressable>
      </View>
    </Modal>
  );
}

interface FieldProps {
  /** URI of the receipt currently shown (existing or newly taken), if any. */
  current: { uri: string; sizeKB: number } | null;
  onChange: (change: ReceiptChange) => void;
}

/** Take a photo or upload a picture as the receipt; replace or remove it. Always compressed to KB size. */
export function ReceiptField({ current, onChange }: FieldProps) {
  const dialog = useDialog();
  const [busy, setBusy] = useState(false);

  const take = async (source: ReceiptSource) => {
    setBusy(true);
    try {
      const result = await captureReceipt(source);
      if (!result) return;
      if ('draft' in result) onChange({ kind: 'replace', draft: result.draft });
      else if (result.error === 'permission')
        await dialog.alert('Camera access needed', 'Allow camera access for Money Tracker in your phone settings to photograph receipts.');
      else await dialog.alert('Could not use picture', 'Something went wrong while compressing the receipt. Please try another picture.');
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (await dialog.confirm({ title: 'Remove receipt?', message: 'The photo will be removed from this expense.', confirmLabel: 'Remove', destructive: true })) {
      onChange({ kind: 'remove' });
    }
  };

  if (busy) {
    return (
      <View style={styles.busy}>
        <ActivityIndicator />
        <AppText muted size={14}>
          Compressing photo…
        </AppText>
      </View>
    );
  }

  const sources = (
    <View style={styles.row}>
      <Button title={current ? 'Retake photo' : 'Take photo'} variant="secondary" style={{ flex: 1 }} onPress={() => take('camera')} />
      <Button title={current ? 'Upload other' : 'Upload picture'} variant="secondary" style={{ flex: 1 }} onPress={() => take('library')} />
    </View>
  );

  if (!current) return sources;

  return (
    <View style={{ gap: 10 }}>
      <ReceiptThumbnail uri={current.uri} sizeKB={current.sizeKB} />
      {sources}
      <Button title="Remove receipt" variant="danger" onPress={remove} />
    </View>
  );
}

const styles = StyleSheet.create({
  thumb: { borderRadius: 12, borderWidth: 1, overflow: 'hidden' },
  badge: {
    position: 'absolute',
    right: 8,
    bottom: 8,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  viewer: { flex: 1, backgroundColor: '#000' },
  close: {
    position: 'absolute',
    right: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  busy: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  row: { flexDirection: 'row', gap: 10 },
});
