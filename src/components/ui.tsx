import React from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

export function ProgressBar({ value, total, height = 6 }: { value: number; total: number; height?: number }) {
  const pct = total > 0 ? Math.min(1, value / total) : 0;
  return (
    <View style={[styles.track, { height, borderRadius: height }]}>
      <View
        style={{
          width: `${pct * 100}%`,
          height,
          borderRadius: height,
          backgroundColor: pct >= 1 ? colors.gold : colors.accent,
        }}
      />
    </View>
  );
}

export function Chip({
  label,
  count,
  active,
  onPress,
  color,
  check,
}: {
  label: string;
  count?: number;
  active: boolean;
  onPress: () => void;
  color?: string;
  /** mostra ✓ quando ativo (para filtros de múltipla escolha) */
  check?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.chip,
        active && { backgroundColor: color ?? colors.accent, borderColor: color ?? colors.accent },
      ]}
    >
      <Text style={[styles.chipText, active && { color: '#fff' }]}>
        {check && active ? '✓ ' : ''}
        {label}
        {count !== undefined ? <Text style={styles.chipCount}>{`  ${count}`}</Text> : null}
      </Text>
    </Pressable>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  style,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  style?: ViewStyle;
}) {
  return (
    <View style={[styles.seg, style]}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segItem, value === o.value && styles.segActive]}>
          <Text style={[styles.segText, value === o.value && { color: colors.text }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function BusyModal({ visible, title, done, total }: { visible: boolean; title: string; done?: number; total?: number }) {
  return (
    <Modal visible={visible} transparent animationType="fade" statusBarTranslucent>
      <View style={styles.backdrop}>
        <View style={styles.busyBox}>
          <ActivityIndicator color={colors.accent} size="large" />
          <Text style={styles.busyTitle}>{title}</Text>
          {total ? (
            <>
              <Text style={styles.busySub}>{`${done ?? 0} de ${total} cartas`}</Text>
              <View style={{ width: '100%', marginTop: 12 }}>
                <ProgressBar value={done ?? 0} total={total} height={8} />
              </View>
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

export function IconButton({ label, onPress, accessibilityLabel }: { label: string; onPress: () => void; accessibilityLabel: string }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityLabel={accessibilityLabel} style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.6 }]}>
      <Text style={styles.iconBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: colors.surface2, overflow: 'hidden', width: '100%' },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginRight: 8,
  },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '600' },
  chipCount: { fontWeight: '400', opacity: 0.8 },
  seg: { flexDirection: 'row', backgroundColor: colors.surface, borderRadius: 10, padding: 3, borderWidth: 1, borderColor: colors.border },
  segItem: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 8 },
  segActive: { backgroundColor: colors.surface2 },
  segText: { color: colors.textFaint, fontWeight: '600', fontSize: 13 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: 32 },
  busyBox: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', width: '100%', maxWidth: 360 },
  busyTitle: { color: colors.text, fontSize: 16, fontWeight: '700', marginTop: 14, textAlign: 'center' },
  busySub: { color: colors.textDim, marginTop: 6 },
  iconBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  iconBtnText: { color: colors.text, fontSize: 20, fontWeight: '700' },
});
