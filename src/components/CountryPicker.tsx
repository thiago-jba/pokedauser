import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Flag } from './Flag';
import { COUNTRIES } from '../countries';

const TOP_COUNTRIES = ['BR', 'US', 'JP'];
import { colors } from '../theme';
import { matchesQuery } from '../variants';

/** Escolha do país da carta, com busca pelo nome (sem precisar de acento). */
export function CountryPicker({
  visible,
  current,
  onPick,
  onClose,
}: {
  visible: boolean;
  current?: string;
  onPick: (code: string) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState('');
  // Brasil, Estados Unidos e Japão sempre primeiro; do 4º em diante, ordem alfabética
  const list = useMemo(() => {
    const filtered = q.trim() ? COUNTRIES.filter(([code, name]) => matchesQuery(`${name} ${code}`, q)) : COUNTRIES;
    const top = TOP_COUNTRIES.map((c) => filtered.find(([code]) => code === c)).filter((x): x is [string, string] => !!x);
    return [...top, ...filtered.filter(([c]) => !TOP_COUNTRIES.includes(c))];
  }, [q]);

  const close = () => {
    setQ('');
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.box} onPress={() => {}}>
          <Text style={styles.title}>País da carta</Text>
          <TextInput
            value={q}
            onChangeText={setQ}
            placeholder="Buscar país (ex.: Japão, Estados Unidos)"
            placeholderTextColor={colors.textFaint}
            style={styles.input}
            autoCorrect={false}
            autoFocus
          />
          <FlatList
            data={list}
            keyExtractor={([c]) => c}
            keyboardShouldPersistTaps="handled"
            initialNumToRender={20}
            ListEmptyComponent={<Text style={styles.empty}>Nenhum país encontrado.</Text>}
            renderItem={({ item: [code, name] }) => (
              <Pressable
                style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface }]}
                onPress={() => {
                  onPick(code);
                  close();
                }}
              >
                <Flag code={code} size={24} />
                <Text style={[styles.name, code === current && { color: colors.gold, fontWeight: '800' }]}>{name}</Text>
                {code === current ? <Text style={styles.tick}>✓</Text> : null}
              </Pressable>
            )}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 20 },
  box: { backgroundColor: colors.sheet, borderRadius: 26, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, padding: 14, height: '80%' },
  title: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 10 },
  input: {
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 6, borderRadius: 8, gap: 12 },
  flag: { fontSize: 24 },
  name: { color: colors.text, fontSize: 15, flex: 1 },
  tick: { color: colors.gold, fontWeight: '900', fontSize: 16 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 20 },
});
