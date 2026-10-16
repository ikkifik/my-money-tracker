import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { FIRST_MONTH, monthsBetween } from '@/lib/format';

import { AppText, Button, usePalette } from './ui';

const SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

interface Props {
  visible: boolean;
  selected: string;
  currentMonth: string;
  /** Number of expenses per "YYYY-MM", shown under each month. */
  counts: Record<string, number>;
  onSelect: (month: string) => void;
  onClose: () => void;
}

/** Grid of months from FIRST_MONTH to the current month, grouped by year (newest year first). */
export function MonthPicker({ visible, selected, currentMonth, counts, onSelect, onClose }: Props) {
  const p = usePalette();
  const byYear = new Map<string, string[]>();
  for (const m of monthsBetween(FIRST_MONTH, currentMonth)) {
    const year = m.slice(0, 4);
    byYear.set(year, [...(byYear.get(year) ?? []), m]);
  }
  const years = [...byYear.keys()].reverse();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close month picker">
        <Pressable style={[styles.card, { backgroundColor: p.card, borderColor: p.border }]} onPress={() => {}}>
          <AppText weight="bold" size={18} accessibilityRole="header">
            Jump to month
          </AppText>
          <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ paddingVertical: 8 }}>
            {years.map((year) => (
              <View key={year} style={{ marginTop: 12 }}>
                <AppText muted size={13} weight="semibold">
                  {year}
                </AppText>
                <View style={styles.grid}>
                  {byYear.get(year)!.map((m) => {
                    const isSelected = m === selected;
                    const count = counts[m] ?? 0;
                    return (
                      <Pressable
                        key={m}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isSelected }}
                        accessibilityLabel={`${SHORT[Number(m.slice(5)) - 1]} ${year}, ${count} expenses`}
                        onPress={() => {
                          onSelect(m);
                          onClose();
                        }}
                        style={[
                          styles.cell,
                          {
                            borderColor: isSelected ? p.primary : m === currentMonth ? p.primary : p.border,
                            backgroundColor: isSelected ? p.primary : p.card,
                          },
                        ]}
                      >
                        <AppText weight="semibold" color={isSelected ? p.onPrimary : p.text}>
                          {SHORT[Number(m.slice(5)) - 1]}
                        </AppText>
                        <AppText size={11} color={isSelected ? p.onPrimary : p.muted}>
                          {count ? `${count} item${count === 1 ? '' : 's'}` : '—'}
                        </AppText>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ))}
          </ScrollView>
          <View style={styles.actions}>
            {selected !== currentMonth ? (
              <Button
                title="This month"
                variant="secondary"
                style={{ flex: 1 }}
                onPress={() => {
                  onSelect(currentMonth);
                  onClose();
                }}
              />
            ) : null}
            <Button title="Close" variant="secondary" style={{ flex: 1 }} onPress={onClose} />
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 400, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  cell: { width: '30%', flexGrow: 1, maxWidth: '32%', borderWidth: 1, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
});
