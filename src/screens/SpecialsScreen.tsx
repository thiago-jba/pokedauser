import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from '../alert';
import { AutoField } from '../components/AddPokedexCard';
import { GlassShine } from '../components/Glass';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { Segmented } from '../components/ui';
import { ValueSummary } from '../components/ValueSummary';
import { cardListValue, fmtMoney, loadSetPrices, SPECIALS_PRICES_ID } from '../prices';
import { useSpecialPrices } from '../useSpecialPrices';
import { artworkUrl, getSpecies, loadSpeciesCache } from '../pokedex';
import type { Species } from '../pokedex';
import { PRESETS, specialSubtitle } from '../specials';
import type { SpecialCollection, SpecialKind } from '../storage';
import { useStore } from '../store';
import { CARD_RATIO, colors } from '../theme';
import { matchesQuery } from '../variants';

/** Imagem de capa: arte oficial do Pokémon; nas outras, a última carta adicionada. */
export function SpecialCover({ col, size }: { col: SpecialCollection; size: number }) {
  if (col.kind === 'pokemon' && col.dexId)
    return <Image source={{ uri: artworkUrl(col.dexId) }} style={{ width: size, height: size }} contentFit="contain" cachePolicy="disk" />;
  const last = [...col.cards].reverse().find((c) => c.image);
  if (last)
    return (
      <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
        <Image source={{ uri: `${last.image}/low.webp` }} style={{ width: size / CARD_RATIO, height: size, borderRadius: 6 }} contentFit="cover" cachePolicy="disk" />
      </View>
    );
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.55 }}>{col.kind === 'energia' ? '⚡' : '★'}</Text>
    </View>
  );
}

export function SpecialsScreen({ openSpecial }: { openSpecial: (uid: string) => void }) {
  const insets = useSafeAreaInsets();
  const { data, addSpecial, removeSpecial } = useStore();
  const [creating, setCreating] = useState(false);
  const list = data.specials ?? [];
  const missingPresets = PRESETS.filter((p) => !list.some((c) => c.uid === p.uid));
  const allCards = useMemo(() => list.flatMap((c) => c.cards), [list]);
  const money = useSpecialPrices(allCards);
  const prices = useMemo(() => loadSetPrices(SPECIALS_PRICES_ID), [money.version]); // eslint-disable-line react-hooks/exhaustive-deps
  const colValue = (c: SpecialCollection) => {
    const v = cardListValue(prices, c.cards);
    return money.rates ? fmtMoney(v.tcg * money.rates.usd, 'R$') : fmtMoney(v.tcg, 'US$');
  };

  const remove = (c: SpecialCollection) =>
    Alert.alert('Apagar coleção', `Apagar "${c.name}" e as ${c.cards.length} cartas registradas nela?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Apagar', style: 'destructive', onPress: () => removeSpecial(c.uid) },
    ]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <FlatList
        data={list}
        keyExtractor={(c) => c.uid}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 10, paddingBottom: insets.bottom + TAB_BAR_SPACE }}
        ListHeaderComponent={
          <View>
            <View style={styles.titleRow}>
              <Text style={styles.h1}>Coleções Especiais</Text>
            </View>
            <Pressable style={styles.newBtn} onPress={() => setCreating(true)}>
              <Text style={styles.newText}>+ Nova coleção especial</Text>
              <Text style={styles.newSub}>de um Pokémon, de Energias ou de qualquer nome</Text>
            </Pressable>
            {allCards.length ? (
              <ValueSummary
                kicker="COLEÇÕES ESPECIAIS"
                countLabel="Cartas nas coleções especiais"
                count={allCards.length}
                tcg={money.tcg}
                cm={money.cm}
                rates={money.rates}
                baskets={money.baskets}
                version={money.version}
                hint="todas as coleções especiais"
              />
            ) : null}
            {missingPresets.length ? (
              <View style={{ marginBottom: 6 }}>
                <Text style={styles.section}>Sugestões</Text>
                <View style={styles.presetRow}>
                  {missingPresets.map((p) => (
                    <Pressable key={p.uid} style={styles.preset} onPress={() => addSpecial(p)}>
                      <Text style={styles.presetText}>{`+ ${p.name}`}</Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            ) : null}
            {list.length ? <Text style={styles.hint}>Toque para abrir; segure o dedo para apagar a coleção.</Text> : null}
          </View>
        }
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma coleção especial ainda. Use as sugestões acima ou crie uma nova.</Text>}
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openSpecial(item.uid)}
            onLongPress={() => remove(item)}
            delayLongPress={400}
            style={({ pressed }) => [styles.row, pressed && { opacity: 0.85 }]}
          >
            <GlassShine r={22} />
            <SpecialCover col={item} size={64} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={styles.sub} numberOfLines={1}>
                {specialSubtitle(item)}
              </Text>
            </View>
            <View style={styles.count}>
              <Text style={styles.countNum}>{item.cards.length}</Text>
              <Text style={styles.countLabel}>{item.cards.length === 1 ? 'carta' : 'cartas'}</Text>
              {item.cards.length ? <Text style={styles.countValue}>{colValue(item)}</Text> : null}
            </View>
          </Pressable>
        )}
      />
      <CreateSpecial
        visible={creating}
        onClose={() => setCreating(false)}
        onCreated={(uid) => {
          setCreating(false);
          openSpecial(uid);
        }}
      />
    </View>
  );
}

/** Janela para criar uma Coleção Especial. */
function CreateSpecial({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (uid: string) => void }) {
  const { data, addSpecial } = useStore();
  const [kind, setKind] = useState<SpecialKind>('pokemon');
  const [species, setSpecies] = useState<Species[]>(() => loadSpeciesCache() ?? []);
  const [pkText, setPkText] = useState('');
  const [pk, setPk] = useState<Species | null>(null);
  const [term, setTerm] = useState('');
  const [name, setName] = useState('');
  const [nameTouched, setNameTouched] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    if (visible && !species.length) getSpecies().then(setSpecies).catch(() => {});
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  // nome sugerido: "Pikachu's", "Energia's"… (dá para trocar)
  const suggested = kind === 'energia' ? "Energia's" : kind === 'pokemon' ? (pk ? `${pk.name}'s` : '') : term.trim() ? `${term.trim()}'s` : '';
  const finalName = nameTouched ? name : suggested;

  const suggestions = useMemo(() => {
    if (pk) return [];
    const t = pkText.trim().replace(/^#/, '');
    if (!t) return [];
    return species
      .filter((s) => (/^\d+$/.test(t) ? String(s.id) === String(Number(t)) : matchesQuery(s.name, t)))
      .slice(0, 8)
      .map((s) => ({ key: String(s.id), title: s.name, subtitle: `#${String(s.id).padStart(3, '0')}` }));
  }, [species, pkText, pk]);

  const reset = () => {
    setKind('pokemon');
    setPkText('');
    setPk(null);
    setTerm('');
    setName('');
    setNameTouched(false);
    setMsg(null);
  };
  const close = () => {
    reset();
    onClose();
  };
  const ready = !!finalName.trim() && (kind === 'energia' || (kind === 'pokemon' ? !!pk : !!term.trim()));
  const create = () => {
    if (!ready) return;
    const uid =
      kind === 'energia' ? 'energia' : kind === 'pokemon' ? `pokemon-${pk!.id}` : `nome-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const existing = (data.specials ?? []).find((c) => c.uid === uid);
    if (existing) {
      setMsg(`Você já tem a coleção "${existing.name}".`);
      return;
    }
    addSpecial({
      uid,
      name: finalName.trim(),
      kind,
      dexId: kind === 'pokemon' ? pk!.id : undefined,
      term: kind === 'pokemon' ? pk!.name : kind === 'nome' ? term.trim() : undefined,
    });
    reset();
    onCreated(uid);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18 }}>
            <Text style={styles.sheetTitle}>Nova coleção especial</Text>
            <Segmented<SpecialKind>
              style={{ marginTop: 14 }}
              value={kind}
              onChange={(k) => {
                setKind(k);
                setMsg(null);
              }}
              options={[
                { value: 'pokemon', label: 'Pokémon' },
                { value: 'energia', label: 'Energias' },
                { value: 'nome', label: 'Outro nome' },
              ]}
            />
            {kind === 'pokemon' ? (
              <AutoField
                label="Pokémon"
                placeholder="Digite o nome ou o número (ex.: Pikachu, 25)"
                text={pkText}
                onText={(t) => {
                  setPkText(t);
                  setPk(null);
                }}
                suggestions={suggestions}
                onPick={(id) => {
                  const s = species.find((x) => String(x.id) === id);
                  if (!s) return;
                  setPk(s);
                  setPkText(s.name);
                }}
              />
            ) : kind === 'nome' ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.label}>Procurar cartas com este nome</Text>
                <TextInput
                  value={term}
                  onChangeText={setTerm}
                  placeholder="Ex.: Team Rocket, Eevee, Professor"
                  placeholderTextColor={colors.textFaint}
                  style={styles.input}
                  autoCorrect={false}
                />
                <Text style={styles.small}>Use o nome em inglês, como aparece na carta em inglês.</Text>
              </View>
            ) : (
              <Text style={[styles.small, { marginTop: 12 }]}>Inclui as Energias básicas e as especiais de todas as expansões.</Text>
            )}

            <View style={{ marginTop: 12 }}>
              <Text style={styles.label}>Nome da coleção</Text>
              <TextInput
                value={finalName}
                onChangeText={(t) => {
                  setName(t);
                  setNameTouched(true);
                }}
                placeholder="Ex.: Pikachu's"
                placeholderTextColor={colors.textFaint}
                style={styles.input}
              />
            </View>
            {msg ? <Text style={styles.error}>{msg}</Text> : null}

            <View style={styles.actions}>
              <Pressable onPress={close} style={styles.btn}>
                <Text style={{ color: colors.textDim, fontWeight: '700' }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={create} disabled={!ready} style={[styles.btn, { backgroundColor: ready ? colors.accent : colors.surface }]}>
                <Text style={{ color: ready ? '#fff' : colors.textFaint, fontWeight: '800' }}>Criar</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  h1: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.5 },
  newBtn: { marginBottom: 12, padding: 14, borderRadius: 20, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent, alignItems: 'center' },
  newText: { color: colors.text, fontWeight: '900', fontSize: 16 },
  newSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  section: { color: colors.textFaint, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8, marginLeft: 4 },
  presetRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  preset: { paddingHorizontal: 14, paddingVertical: 9, borderRadius: 999, backgroundColor: colors.surface2, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  presetText: { color: colors.text, fontWeight: '800' },
  hint: { color: colors.textFaint, fontSize: 12, marginBottom: 4, marginTop: 4 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 24, paddingHorizontal: 24 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 12,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  name: { color: colors.text, fontSize: 18, fontWeight: '900' },
  sub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  count: { alignItems: 'center', minWidth: 70 },
  countNum: { color: colors.gold, fontSize: 22, fontWeight: '900' },
  countLabel: { color: colors.textFaint, fontSize: 11 },
  countValue: { color: colors.textDim, fontSize: 11, fontWeight: '800', marginTop: 2 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 12 },
  sheet: { backgroundColor: colors.sheet, borderRadius: 28, maxHeight: '92%', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  sheetTitle: { color: colors.text, fontSize: 20, fontWeight: '900' },
  label: { color: colors.textFaint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  input: {
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  small: { color: colors.textFaint, fontSize: 12, marginTop: 6 },
  error: { color: colors.accent, fontSize: 13, marginTop: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999, backgroundColor: colors.surface },
});
