import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/** Janela de escolha múltipla (caixinhas), com "Limpar" e "Pronto". */
export function MultiPicker({
  visible,
  title,
  hint,
  options,
  selected,
  onChange,
  onClose,
}: {
  visible: boolean;
  title: string;
  hint?: string;
  options: { value: string; label: string; count?: number }[];
  selected: string[];
  onChange: (values: string[]) => void;
  onClose: () => void;
}) {
  const sel = new Set(selected);
  const toggle = (v: string) => onChange(sel.has(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.box} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          {hint ? <Text style={styles.hint}>{hint}</Text> : null}
          <ScrollView>
            {options.length === 0 ? <Text style={styles.empty}>Nada para filtrar ainda.</Text> : null}
            {options.map((o) => {
              const on = sel.has(o.value);
              return (
                <Pressable key={o.value} style={styles.item} onPress={() => toggle(o.value)}>
                  <View style={[styles.check, on && styles.checkOn]}>{on ? <Text style={styles.tick}>✓</Text> : null}</View>
                  <Text style={[styles.text, on && { color: colors.text, fontWeight: '700' }]}>{o.label}</Text>
                  {o.count !== undefined ? <Text style={styles.count}>{o.count}</Text> : null}
                </Pressable>
              );
            })}
          </ScrollView>
          <View style={styles.actions}>
            <Pressable onPress={() => onChange([])} style={styles.btn}>
              <Text style={{ color: colors.textDim, fontWeight: '700' }}>Limpar</Text>
            </Pressable>
            <Pressable onPress={onClose} style={[styles.btn, { backgroundColor: colors.accent }]}>
              <Text style={{ color: '#fff', fontWeight: '700' }}>Pronto</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 28 },
  box: { backgroundColor: colors.sheet, borderRadius: 24, maxHeight: '75%', paddingTop: 16, paddingBottom: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  title: { color: colors.text, fontSize: 17, fontWeight: '800', paddingHorizontal: 18 },
  hint: { color: colors.textDim, fontSize: 12, paddingHorizontal: 18, marginTop: 2, marginBottom: 8 },
  empty: { color: colors.textFaint, paddingHorizontal: 18, paddingVertical: 12 },
  item: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 11, gap: 12 },
  check: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tick: { color: '#fff', fontWeight: '900', fontSize: 13 },
  text: { color: colors.textDim, fontSize: 15, flex: 1 },
  count: { color: colors.textFaint, fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 18, paddingTop: 10 },
  btn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 999, backgroundColor: colors.surface },
});
