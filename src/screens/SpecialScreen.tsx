import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddSpecialCard } from '../components/AddSpecialCard';
import { CountryPicker } from '../components/CountryPicker';
import { Flag } from '../components/Flag';
import { GlassShine } from '../components/Glass';
import { PokedexCardDetail } from '../components/PokedexCardDetail';
import { IconButton } from '../components/ui';
import { ValueSummary } from '../components/ValueSummary';
import { useSpecialPrices } from '../useSpecialPrices';
import { useAppDimensions } from '../dimensions';
import { specialSubtitle } from '../specials';
import type { SpecialCard } from '../storage';
import { useStore } from '../store';
import { CARD_RATIO, colors } from '../theme';
import { matchesQuery } from '../variants';
import { SpecialCover } from './SpecialsScreen';

/** Uma Coleção Especial: as cartas registradas, com país e versão. */
export function SpecialScreen({ uid, onBack }: { uid: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useAppDimensions();
  const { data, removeSpecialCard, setSpecialCardCountry, renameSpecial } = useStore();
  const col = (data.specials ?? []).find((c) => c.uid === uid);
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<SpecialCard | null>(null);
  const [countryFor, setCountryFor] = useState<SpecialCard | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [q, setQ] = useState('');

  const colCards = useMemo(() => col?.cards ?? [], [col?.cards]);
  const money = useSpecialPrices(colCards);

  // mais recentes primeiro
  const cards = useMemo(() => {
    const all = [...(col?.cards ?? [])].reverse();
    const t = q.trim();
    return t ? all.filter((c) => matchesQuery(`${c.name} ${c.setName} ${c.localId} ${c.variantLabel ?? ''}`, t)) : all;
  }, [col?.cards, q]);

  if (!col) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingHorizontal: 16 }]}>
        <IconButton label="←" onPress={onBack} accessibilityLabel="Voltar" />
        <Text style={styles.empty}>Esta coleção foi apagada.</Text>
      </View>
    );
  }

  const cols = width >= 900 ? 4 : width >= 600 ? 3 : 2;
  const w = (width - 16 * 2 - 12 * (cols - 1)) / cols;
  const total = col.cards.length;
  const countries = new Set(col.cards.map((c) => c.country)).size;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <IconButton label="←" onPress={onBack} accessibilityLabel="Voltar" />
      </View>

      <FlatList
        data={cards}
        keyExtractor={(c) => c.uid}
        key={`especial-${cols}`}
        numColumns={cols}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16 }}>
            <View style={styles.hero}>
              <GlassShine r={26} />
              <SpecialCover col={col} size={96} />
              <View style={{ flex: 1 }}>
                <Pressable onPress={() => setRenaming(col.name)} hitSlop={6}>
                  <Text style={styles.name} numberOfLines={2}>
                    {`${col.name} ✎`}
                  </Text>
                </Pressable>
                <Text style={styles.sub}>{specialSubtitle(col)}</Text>
                <Text style={styles.count}>
                  {total === 0 ? 'Nenhuma carta ainda' : `${total} ${total === 1 ? 'carta' : 'cartas'} · ${countries} ${countries === 1 ? 'país' : 'países'}`}
                </Text>
              </View>
            </View>
            {total ? (
              <ValueSummary
                kicker="VALOR DA COLEÇÃO"
                countLabel="Cartas"
                count={total}
                tcg={money.tcg}
                cm={money.cm}
                rates={money.rates}
                baskets={money.baskets}
                version={money.version}
                hint="todas as cartas desta coleção"
              />
            ) : null}
            <Pressable style={styles.addBtn} onPress={() => setAdding(true)}>
              <Text style={styles.addText}>+ Adicionar carta</Text>
              <Text style={styles.addSub}>pela câmera ou escolhendo a expansão e a carta</Text>
            </Pressable>
            {total > 6 ? (
              <View style={styles.searchBox}>
                <Text style={styles.searchIcon}>⌕</Text>
                <TextInput
                  value={q}
                  onChangeText={setQ}
                  placeholder="Buscar por nome, expansão, número ou versão"
                  placeholderTextColor={colors.textFaint}
                  style={styles.searchInput}
                  autoCorrect={false}
                />
                {q ? (
                  <Pressable onPress={() => setQ('')} hitSlop={10}>
                    <Text style={{ color: colors.textDim, fontSize: 16 }}>✕</Text>
                  </Pressable>
                ) : null}
              </View>
            ) : null}
            {total ? <Text style={styles.hint}>Toque numa carta para ver preços ou remover; segure o dedo para trocar o país.</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => setDetail(item)} onLongPress={() => setCountryFor(item)} delayLongPress={350} style={{ width: w }}>
            <View style={[styles.cardFrame, { height: w * CARD_RATIO }]}>
              {item.image ? (
                <Image source={{ uri: `${item.image}/high.webp` }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: colors.textDim, textAlign: 'center' }}>{item.name}</Text>
                </View>
              )}
              <View style={styles.flag}>
                <Flag code={item.country} size={16} />
              </View>
            </View>
            <Text style={styles.cardSet} numberOfLines={1}>
              {item.setName}
            </Text>
            <Text style={styles.cardNum} numberOfLines={1}>
              {`${item.localId}${item.official && /^\d+$/.test(item.localId) ? `/${item.official}` : ''} · ${item.name}`}
            </Text>
            <Text style={styles.cardType} numberOfLines={1}>
              {[item.variantLabel ?? 'Normal', item.rarity].filter(Boolean).join(' · ')}
            </Text>
          </Pressable>
        )}
      />

      <PokedexCardDetail
        card={detail}
        onClose={() => setDetail(null)}
        onRemove={() => {
          if (detail) removeSpecialCard(col.uid, detail.uid);
          setDetail(null);
        }}
      />
      <CountryPicker
        visible={!!countryFor}
        current={countryFor?.country}
        onPick={(code) => countryFor && setSpecialCardCountry(col.uid, countryFor.uid, code)}
        onClose={() => setCountryFor(null)}
      />
      <AddSpecialCard visible={adding} col={col} onClose={() => setAdding(false)} />

      <Modal visible={renaming !== null} transparent animationType="fade" onRequestClose={() => setRenaming(null)}>
        <Pressable style={styles.backdrop} onPress={() => setRenaming(null)}>
          <Pressable style={styles.renameBox} onPress={() => {}}>
            <Text style={styles.renameTitle}>Nome da coleção</Text>
            <TextInput value={renaming ?? ''} onChangeText={setRenaming} style={styles.input} autoFocus selectTextOnFocus />
            <View style={styles.actions}>
              <Pressable onPress={() => setRenaming(null)} style={styles.btn}>
                <Text style={{ color: colors.textDim, fontWeight: '700' }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  if (renaming?.trim()) renameSpecial(col.uid, renaming.trim());
                  setRenaming(null);
                }}
                style={[styles.btn, { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>Salvar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  topBar: { paddingHorizontal: 16, marginBottom: 8, flexDirection: 'row' },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 30 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    padding: 16,
    borderRadius: 26,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  name: { color: colors.text, fontSize: 26, fontWeight: '900', letterSpacing: -0.4 },
  sub: { color: colors.textDim, fontSize: 13, marginTop: 2 },
  count: { color: colors.gold, marginTop: 6, fontWeight: '800' },
  addBtn: { marginTop: 12, marginBottom: 10, padding: 14, borderRadius: 20, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent, alignItems: 'center' },
  addText: { color: colors.text, fontWeight: '900', fontSize: 16 },
  addSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  searchIcon: { color: colors.textDim, fontSize: 20, marginRight: 6 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 10 },
  hint: { color: colors.textFaint, fontSize: 12, marginBottom: 6 },
  cardFrame: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.gold },
  flag: { position: 'absolute', top: 6, right: 6, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 8, paddingHorizontal: 4, paddingVertical: 2 },
  cardSet: { color: colors.textDim, fontSize: 11, marginTop: 6 },
  cardNum: { color: colors.text, fontSize: 12, fontWeight: '700' },
  cardType: { color: colors.textFaint, fontSize: 11 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  renameBox: { backgroundColor: colors.sheet, borderRadius: 24, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  renameTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 12 },
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
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 16 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999, backgroundColor: colors.surface },
});
