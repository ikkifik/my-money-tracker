import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

import type { Receipt } from './types';

/** Compressed receipts aim to stay under this size. */
const TARGET_KB = 200;
/** Width/quality steps tried in order until the image fits TARGET_KB. */
const STEPS = [
  { width: 1280, compress: 0.6 },
  { width: 1080, compress: 0.5 },
  { width: 900, compress: 0.45 },
  { width: 720, compress: 0.4 },
];

export const RECEIPT_PREFIX = 'mt-receipt-';

export const isWeb = Platform.OS === 'web';

/** A photo that was taken and compressed but isn't attached to a saved expense yet. */
export interface ReceiptDraft {
  /** Cache file URI on native, data URI on web. */
  uri: string;
  sizeKB: number;
}

export function receiptsDir(): Directory {
  const dir = new Directory(Paths.document, 'receipts');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  return dir;
}

const kbFromBase64 = (b64: string) => Math.ceil((b64.length * 3) / 4 / 1024);

export type CaptureResult = { draft: ReceiptDraft } | { error: 'permission' | 'failed' } | null;

export type ReceiptSource = 'camera' | 'library';

/**
 * Takes a photo or lets the user pick a picture, then returns it as a compressed JPEG (KB-sized),
 * or null if cancelled. The library picker (system photo picker) needs no permission.
 */
export async function captureReceipt(source: ReceiptSource): Promise<CaptureResult> {
  if (!isWeb && source === 'camera') {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) return { error: 'permission' };
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 1, exif: false };
  const shot =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);
  if (shot.canceled || !shot.assets[0]) return null;
  try {
    return { draft: await compress(shot.assets[0].uri, shot.assets[0].width) };
  } catch (e) {
    console.warn('Receipt compression failed', e);
    return { error: 'failed' };
  }
}

async function compress(sourceUri: string, sourceWidth: number): Promise<ReceiptDraft> {
  let result: { uri: string; base64: string } | null = null;
  for (const step of STEPS) {
    const context = ImageManipulator.manipulate(sourceUri);
    if (sourceWidth > step.width) context.resize({ width: step.width });
    const image = await context.renderAsync();
    const saved = await image.saveAsync({ compress: step.compress, format: SaveFormat.JPEG, base64: true });
    if (!saved.base64) throw new Error('Image manipulator returned no data');
    result = { uri: saved.uri, base64: saved.base64 };
    if (kbFromBase64(saved.base64) <= TARGET_KB) break;
  }
  if (!result) throw new Error('No compression step ran');
  return {
    uri: isWeb ? `data:image/jpeg;base64,${result.base64}` : result.uri,
    sizeKB: kbFromBase64(result.base64),
  };
}

/** Moves a draft into permanent storage and returns the reference saved on the expense. */
export function persistReceipt(draft: ReceiptDraft): Receipt {
  const name = `${RECEIPT_PREFIX}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}.jpg`;
  if (isWeb) return { name, sizeKB: draft.sizeKB, dataUri: draft.uri };
  new File(draft.uri).moveSync(new File(receiptsDir(), name));
  return { name, sizeKB: draft.sizeKB };
}

export function receiptUri(receipt: Receipt): string {
  return receipt.dataUri ?? new File(receiptsDir(), receipt.name).uri;
}

export function deleteReceipt(receipt: Receipt) {
  if (isWeb) return;
  try {
    const file = new File(receiptsDir(), receipt.name);
    if (file.exists) file.delete();
  } catch (e) {
    console.warn('Failed to delete receipt', e);
  }
}
