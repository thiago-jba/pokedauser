import React, { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { CountryPicker } from '../components/CountryPicker';
import { GlassShine } from '../components/Glass';
import { IconButton } from '../components/ui';
import { countryName, flagEmoji } from '../countries';
import { useStore } from '../store';
import { colors } from '../theme';

/** Configurações do app. Novas opções entram aqui como novas linhas. */
export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { defaultCountry, setDefaultCountry } = useStore();
  const [picking, setPicking] = useState(false);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <IconButton label="←" onPress={onBack} accessibilityLabel="Voltar" />
        <Text style={styles.title}>Configurações</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}>
        <Text style={styles.section}>Ao marcar uma carta</Text>
        <View style={styles.group}>
          <GlassShine r={20} />
          <Pressable style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]} onPress={() => setPicking(true)}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>País padrão</Text>
              <Text style={styles.rowHint}>
                Usado quando você toca numa carta para incluí-la na coleção. Dá para trocar o país de cada carta depois, segurando o dedo
                sobre ela.
              </Text>
            </View>
            <View style={styles.value}>
              <Text style={styles.flag}>{flagEmoji(defaultCountry)}</Text>
              <Text style={styles.valueText} numberOfLines={1}>
                {countryName(defaultCountry)}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
        </View>
        <Text style={styles.footnote}>As cartas que você já marcou não mudam de país ao trocar esta opção.</Text>
      </ScrollView>

      <CountryPicker visible={picking} current={defaultCountry} onPick={setDefaultCountry} onClose={() => setPicking(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  topBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, marginBottom: 12 },
  title: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4 },
  section: {
    color: colors.textFaint,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 8,
    marginLeft: 4,
  },
  group: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 14 },
  rowTitle: { color: colors.text, fontSize: 16, fontWeight: '700' },
  rowHint: { color: colors.textFaint, fontSize: 12, marginTop: 3, lineHeight: 16 },
  value: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: '45%' },
  flag: { fontSize: 22 },
  valueText: { color: colors.text, fontSize: 15, fontWeight: '700', flexShrink: 1 },
  chevron: { color: colors.textFaint, fontSize: 24, marginLeft: 2 },
  footnote: { color: colors.textFaint, fontSize: 12, marginTop: 10, marginLeft: 4 },
});
