import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';
import { GlassShine } from './Glass';

export type Tab = 'colecao' | 'pokedex' | 'especiais' | 'boosters';

/** Altura ocupada pelo rodapé (para as listas não ficarem escondidas atrás dele). */
export const TAB_BAR_SPACE = 92;

const TABS: { value: Tab; label: string; icon: string }[] = [
  { value: 'colecao', label: 'Coleção', icon: '▦' },
  { value: 'pokedex', label: 'Pokédex', icon: '◉' },
  { value: 'especiais', label: 'Especiais', icon: '★' },
  { value: 'boosters', label: 'Boosters', icon: '◫' },
];

/** Rodapé flutuante de vidro com as áreas do app (ícone em cima, nome embaixo, para caberem as três). */
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
              <Text style={[styles.label, on && { color: colors.text }]} numberOfLines={1}>{t.label}</Text>
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
    gap: 4,
    padding: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(22,24,42,0.86)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    elevation: 12,
  },
  item: { alignItems: 'center', gap: 1, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 999, minWidth: 74 },
  itemOn: { backgroundColor: 'rgba(255,255,255,0.14)' },
  icon: { color: colors.textFaint, fontSize: 15 },
  label: { color: colors.textDim, fontSize: 11, fontWeight: '800' },
});
