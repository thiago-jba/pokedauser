import React, { useState } from 'react';
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Flag } from '../components/Flag';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from '../alert';
import { CountryPicker } from '../components/CountryPicker';
import { GlassShine } from '../components/Glass';
import { IconButton } from '../components/ui';
import { countryName } from '../countries';
import { useStore } from '../store';
import { WEB_URL } from '../sync/config';
import { colors } from '../theme';

/** Configurações do app. Novas opções entram aqui como novas linhas. */
export function SettingsScreen({ onBack }: { onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { defaultCountry, setDefaultCountry, cloud, cloudSignIn, cloudSignOut, cloudSyncNow } = useStore();
  const [picking, setPicking] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const enter = async (create: boolean) => {
    if (!email.trim() || password.length < 6) {
      setMsg('Preencha o e-mail e uma senha de pelo menos 6 caracteres.');
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      await cloudSignIn(email, password, create);
      setPassword('');
    } catch (e: any) {
      setMsg(e?.message ?? 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  };

  const when = (iso?: string) => {
    if (!iso) return 'ainda não sincronizou';
    const d = new Date(iso);
    const p = (n: number) => String(n).padStart(2, '0');
    return `última sincronização: ${p(d.getDate())}/${p(d.getMonth() + 1)} às ${p(d.getHours())}:${p(d.getMinutes())}`;
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <IconButton label="←" onPress={onBack} accessibilityLabel="Voltar" />
        <Text style={styles.title}>Configurações</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }} keyboardShouldPersistTaps="handled">
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
              <Flag code={defaultCountry} size={22} />
              <Text style={styles.valueText} numberOfLines={1}>
                {countryName(defaultCountry)}
              </Text>
              <Text style={styles.chevron}>›</Text>
            </View>
          </Pressable>
        </View>
        <Text style={styles.footnote}>As cartas que você já marcou não mudam de país ao trocar esta opção.</Text>

        <Text style={[styles.section, { marginTop: 24 }]}>Sincronização na nuvem</Text>
        <View style={[styles.group, { padding: 16 }]}>
          <GlassShine r={20} />
          {!cloud.configured ? (
            <Text style={styles.rowHint}>A nuvem ainda não foi configurada neste app.</Text>
          ) : cloud.email ? (
            <>
              <Text style={styles.rowTitle}>{`☁︎ Conectado como ${cloud.email}`}</Text>
              <Text style={styles.rowHint}>
                {cloud.syncing ? 'sincronizando…' : when(cloud.lastSync)}
                {Platform.OS === 'web' ? '' : ` · no computador, abra ${WEB_URL} e entre com o mesmo e-mail e senha`}
              </Text>
              {cloud.error ? <Text style={styles.error}>{cloud.error}</Text> : null}
              <View style={styles.btnRow}>
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={cloudSyncNow} disabled={cloud.syncing}>
                  {cloud.syncing ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Sincronizar agora</Text>}
                </Pressable>
                <Pressable
                  style={styles.btn}
                  onPress={() =>
                    Alert.alert('Sair da nuvem', 'A coleção continua salva neste aparelho e na nuvem, mas este aparelho para de sincronizar.', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Sair', style: 'destructive', onPress: cloudSignOut },
                    ])
                  }
                >
                  <Text style={styles.btnText}>Sair</Text>
                </Pressable>
              </View>
            </>
          ) : (
            <>
              <Text style={styles.rowTitle}>Entrar para sincronizar</Text>
              <Text style={styles.rowHint}>
                Com a mesma conta no celular e no computador, as coleções, marcações, países e a Pokédex ficam iguais nos dois. Na primeira vez,
                o que já está neste aparelho é enviado para a nuvem.
              </Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="seu e-mail"
                placeholderTextColor={colors.textFaint}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                style={styles.input}
              />
              <TextInput
                value={password}
                onChangeText={setPassword}
                placeholder="senha (mínimo 6 caracteres)"
                placeholderTextColor={colors.textFaint}
                secureTextEntry
                style={styles.input}
              />
              {msg ? <Text style={styles.error}>{msg}</Text> : null}
              <View style={styles.btnRow}>
                <Pressable style={[styles.btn, styles.btnPrimary]} onPress={() => enter(false)} disabled={busy}>
                  {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.btnPrimaryText}>Entrar</Text>}
                </Pressable>
                <Pressable style={styles.btn} onPress={() => enter(true)} disabled={busy}>
                  <Text style={styles.btnText}>Criar conta</Text>
                </Pressable>
              </View>
            </>
          )}
        </View>
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
  input: {
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    marginTop: 10,
  },
  error: { color: colors.accent, fontSize: 13, marginTop: 10 },
  btnRow: { flexDirection: 'row', gap: 10, marginTop: 14 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999, backgroundColor: colors.surface2, minWidth: 90, alignItems: 'center' },
  btnPrimary: { backgroundColor: colors.accent },
  btnText: { color: colors.text, fontWeight: '800' },
  btnPrimaryText: { color: '#fff', fontWeight: '800' },
});
