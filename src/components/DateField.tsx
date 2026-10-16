import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { createElement, useState } from 'react';
import { Modal, Platform, Pressable, StyleSheet, View } from 'react-native';

import { FIRST_MONTH, formatDate, fromDateKey, toDateKey } from '@/lib/format';
import { fonts } from '@/lib/theme';
import { useStore } from '@/state/store';

import { AppText, Button, usePalette } from './ui';

interface Props {
  /** "YYYY-MM-DD" */
  value: string;
  onChange: (value: string) => void;
}

/** Earliest selectable date: the first day of FIRST_MONTH, so every expense falls in a browsable month. */
const MIN_DATE = `${FIRST_MONTH}-01`;

/** Date-only selector: native calendar on Android/iOS, the browser's date picker on web. Future dates are blocked. */
export function DateField({ value, onChange }: Props) {
  if (Platform.OS === 'web') return <WebDateField value={value} onChange={onChange} />;
  return <NativeDateField value={value} onChange={onChange} />;
}

function NativeDateField({ value, onChange }: Props) {
  const p = usePalette();
  const { theme } = useStore().settings;
  const [iosOpen, setIosOpen] = useState(false);
  const [iosDraft, setIosDraft] = useState(() => fromDateKey(value));
  const date = fromDateKey(value);

  const open = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: date,
        mode: 'date',
        maximumDate: new Date(),
        minimumDate: fromDateKey(MIN_DATE),
        onValueChange: (_, picked) => onChange(toDateKey(picked)),
      });
    } else {
      setIosDraft(date);
      setIosOpen(true);
    }
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Date, ${formatDate(date)}. Tap to change`}
        onPress={open}
        style={[styles.button, { borderColor: p.border, backgroundColor: p.card }]}
      >
        <Ionicons name="calendar-outline" size={18} color={p.primary} />
        <AppText style={{ flex: 1 }}>{formatDate(date)}</AppText>
        {value === toDateKey(new Date()) ? (
          <AppText size={12} muted>
            Today
          </AppText>
        ) : null}
      </Pressable>

      {Platform.OS === 'ios' ? (
        <Modal visible={iosOpen} transparent animationType="fade" onRequestClose={() => setIosOpen(false)}>
          <Pressable style={styles.backdrop} onPress={() => setIosOpen(false)}>
            <Pressable style={[styles.sheet, { backgroundColor: p.card }]} onPress={() => {}}>
              <DateTimePicker
                value={iosDraft}
                mode="date"
                display="inline"
                themeVariant={theme}
                accentColor={p.primary}
                maximumDate={new Date()}
                minimumDate={fromDateKey(MIN_DATE)}
                onValueChange={(_, picked) => setIosDraft(picked)}
              />
              <View style={styles.sheetActions}>
                <Button title="Cancel" variant="secondary" style={{ flex: 1 }} onPress={() => setIosOpen(false)} />
                <Button
                  title="Done"
                  style={{ flex: 1 }}
                  onPress={() => {
                    onChange(toDateKey(iosDraft));
                    setIosOpen(false);
                  }}
                />
              </View>
            </Pressable>
          </Pressable>
        </Modal>
      ) : null}
    </>
  );
}

function WebDateField({ value, onChange }: Props) {
  const p = usePalette();
  const { theme } = useStore().settings;
  // react-native-web renders through react-dom, so a real <input type="date"> gives the browser's calendar.
  return createElement('input', {
    type: 'date',
    value,
    max: toDateKey(new Date()),
    min: MIN_DATE,
    'aria-label': 'Date',
    onChange: (e: { target: { value: string } }) => {
      if (e.target.value) onChange(e.target.value);
    },
    style: {
      fontFamily: fonts.regular,
      fontSize: 16,
      padding: '10px 12px',
      borderRadius: 10,
      border: `1px solid ${p.border}`,
      backgroundColor: p.card,
      color: p.text,
      colorScheme: theme,
      outline: 'none',
    },
  });
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
  },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', padding: 16 },
  sheet: { borderRadius: 16, padding: 12 },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
});
