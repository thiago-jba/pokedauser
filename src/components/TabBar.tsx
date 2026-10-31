import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { GlassShine } from './Glass';

export type Tab = 'colecao' | 'pokedex';

/** Altura ocupada pelo rodapé (para as listas não ficarem escondidas atrás dele). */
export const TAB_BAR_SPACE = 92;

const TABS: { value: Tab; label: string; icon: string }[] = [
  { value: 'colecao', label: 'Minha Coleção', icon: '▦' },
  { value: 'pokedex', label: 'Pokédex', icon: '◉' },
];

/** Rodapé flutuante de vidro com as duas áreas do app. */
export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 10) + 6 }]}>
      <View style={styles.bar}>
        <GlassShine r={999} />
        {TABS.map((t) => {
          const on = t.value === tab;
          return (
            <Pressable
              key={t.value}
              onPress={() => onChange(t.value)}
              style={[styles.item, on && styles.itemOn]}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
            >
              <Text style={[styles.icon, on && { color: colors.accent }]}>{t.icon}</Text>
              <Text style={[styles.label, on && { color: colors.text }]}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  bar: {
    flexDirection: 'row',
    gap: 6,
    padding: 6,
    borderRadius: 999,
    backgroundColor: 'rgba(22,24,42,0.86)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    elevation: 12,
  },
  item: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999 },
  itemOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  icon: { color: colors.textFaint, fontSize: 16 },
  label: { color: colors.textDim, fontSize: 14, fontWeight: '800' },
});
