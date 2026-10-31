import * as Updates from 'expo-updates';
import React, { useEffect, useRef } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

/** Procura atualização ao abrir/voltar para o app e oferece reiniciar quando ela já foi baixada. */
export function UpdateBanner() {
  const insets = useSafeAreaInsets();
  const { isUpdatePending } = Updates.useUpdates();
  const checking = useRef(false);

  useEffect(() => {
    if (!Updates.isEnabled) return;
    const check = async () => {
      if (checking.current) return;
      checking.current = true;
      try {
        const r = await Updates.checkForUpdateAsync();
        if (r.isAvailable) await Updates.fetchUpdateAsync();
      } catch {
        // sem internet: tenta de novo na próxima vez que abrir o app
      } finally {
        checking.current = false;
      }
    };
    const sub = AppState.addEventListener('change', (s) => s === 'active' && check());
    return () => sub.remove();
  }, []);

  if (!isUpdatePending) return null;
  return (
    <View style={[styles.wrap, { bottom: insets.bottom + 90 }]}>
      <Text style={styles.text}>Nova versão do app pronta!</Text>
      <Pressable onPress={() => Updates.reloadAsync().catch(() => {})} style={styles.btn}>
        <Text style={styles.btnText}>Atualizar agora</Text>
      </Pressable>
    </View>
  );
}

export function versionLabel(): string {
  if (!Updates.isEnabled) return 'modo desenvolvimento';
  const u = Updates.createdAt;
  if (Updates.isEmbeddedLaunch || !u) return 'versão instalada pelo APK';
  const d = new Date(u);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `atualizada em ${pad(d.getDate())}/${pad(d.getMonth() + 1)} às ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.sheet,
    borderRadius: 14,
    paddingVertical: 10,
    paddingLeft: 16,
    paddingRight: 10,
    borderWidth: 1,
    borderColor: colors.gold,
    elevation: 8,
  },
  text: { color: colors.text, fontWeight: '700', flex: 1 },
  btn: { backgroundColor: colors.gold, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  btnText: { color: '#1a1300', fontWeight: '800' },
});
