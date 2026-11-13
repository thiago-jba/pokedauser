import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddSpecialCard } from '../components/AddSpecialCard';
import { CountryPicker } from '../components/CountryPicker';
import { Flag } from '../components/Flag';
import { GlassShine } from '../components/Glass';
import { PokedexCardDetail } from '../components/PokedexCardDetail';
import { IconButton, Segmented } from '../components/ui';
import { SetLogo } from '../components/SetLogo';
import { countryName } from '../countries';
import type { PokemonCardBrief } from '../pokedex';
import { loadSetsCacheAnyAge } from '../storage';
import { ValueSummary } from '../components/ValueSummary';
import { useSpecialPrices } from '../useSpecialPrices';
import { useAppDimensions } from '../dimensions';
import { buildSpecialSections, fetchSpecialCandidates, specialSubtitle } from '../specials';
import type { SpecialView } from '../specials';
import type { SpecialCard } from '../storage';
import { useStore } from '../store';
import { CARD_RATIO, colors } from '../theme';
import { matchesQuery } from '../variants';
import { SpecialCover } from './SpecialsScreen';

/** Uma Coleção Especial: cartas separadas por expansão, com filtros "só as que tenho / todas" e por país. */
export function SpecialScreen({ uid, onBack }: { uid: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useAppDimensions();
  const { data, removeSpecialCard, setSpecialCardCountry, renameSpecial, setSpecialFilters } = useStore();
  const col = (data.specials ?? []).find((c) => c.uid === uid);
  const [adding, setAdding] = useState<{ prefill?: PokemonCardBrief } | null>(null);
  const [detail, setDetail] = useState<SpecialCard | null>(null);
  const [countryFor, setCountryFor] = useState<SpecialCard | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [candidates, setCandidates] = useState<PokemonCardBrief[] | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const colCards = useMemo(() => col?.cards ?? [], [col?.cards]);
  const money = useSpecialPrices(colCards);
  const country = col?.country || '';
  const view: SpecialView = country ? 'tenho' : col?.view ?? 'tenho';

  // todas as cartas do personagem/tipo (só quando pedir "todas")
  useEffect(() => {
    if (!col || view !== 'todas' || candidates) return;
    let alive = true;
    setLoadingAll(true);
    setLoadError(false);
    fetchSpecialCandidates(col)
      .then((l) => alive && setCandidates(l))
      .catch(() => alive && setLoadError(true))
      .finally(() => alive && setLoadingAll(false));
    return () => {
      alive = false;
    };
  }, [view, col?.uid, candidates]); // eslint-disable-line react-hooks/exhaustive-deps

  // nome e ordem (mais nova primeiro) de cada expansão, pela lista de expansões guardada no aparelho
  const setsList = useMemo(() => loadSetsCacheAnyAge() ?? [], []);
  const setById = useMemo(() => new Map(setsList.map((x, i) => [x.id, { s: x, order: i }])), [setsList]);

  const sections = useMemo(() => {
    const all = buildSpecialSections(colCards, candidates ?? [], { view, country: country || undefined }, (id) => ({
      name: setById.get(id)?.s.namePt ?? setById.get(id)?.s.nameEn,
      order: setById.get(id)?.order,
    }));
    const t = q.trim();
    if (!t) return all;
    return all
      .map((sec) => ({
        ...sec,
        tiles: sec.tiles.filter((x) =>
          matchesQuery(`${x.card.name} ${sec.setName} ${x.card.localId} ${x.kind === 'owned' ? x.card.variantLabel ?? '' : ''}`, t),
        ),
      }))
      .filter((sec) => sec.tiles.length);
  }, [colCards, candidates, view, country, setById, q]);

  // países das cartas que tenho, com quantas de cada (BR, US, JP primeiro)
  const countryList = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of colCards) m.set(c.country, (m.get(c.country) ?? 0) + 1);
    const rank = (c: string) => (['BR', 'US', 'JP'].indexOf(c) + 1 || 9) + c;
    return [...m.entries()].sort((a, b) => rank(a[0]).localeCompare(rank(b[0])));
  }, [colCards]);

  if (!col) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8, paddingHorizontal: 16 }]}>
        <IconButton label="←" onPress={onBack} accessibilityLabel="Voltar" />
        <Text style={styles.empty}>Esta coleção foi apagada.</Text>
      </View>
    );
  }

  const cols = width >= 900 ? 6 : width >= 600 ? 4 : 3;
  const inner = width - 16 * 2 - 14 * 2;
  const w = (inner - 10 * (cols - 1)) / cols;
  const total = col.cards.length;
  const countries = countryList.length;
  const what = col.kind === 'energia' ? 'Energias' : col.term ?? col.name;

  const ownedTile = (c: SpecialCard) => (
    <Pressable key={c.uid} onPress={() => setDetail(c)} onLongPress={() => setCountryFor(c)} delayLongPress={350} style={{ width: w }}>
      <View style={[styles.cardFrame, { height: w * CARD_RATIO }]}>
        {c.image ? (
          <Image source={{ uri: `${c.image}/low.webp` }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
        ) : (
          <View style={styles.noImg}>
            <Text style={styles.noImgText}>{c.name}</Text>
          </View>
        )}
        <View style={styles.flag}>
          <Flag code={c.country} size={14} />
        </View>
      </View>
      <Text style={styles.cardNum} numberOfLines={1}>
        {`${c.localId}${c.official && /^\d+$/.test(c.localId) ? `/${c.official}` : ''} · ${c.name}`}
      </Text>
      <Text style={styles.cardType} numberOfLines={1}>
        {c.variantLabel ?? 'Normal'}
      </Text>
    </Pressable>
  );
  const missingTile = (c: PokemonCardBrief, key: string) => (
    <Pressable key={key} onPress={() => setAdding({ prefill: c })} style={{ width: w }}>
      <View style={[styles.cardFrame, styles.cardMissing, { height: w * CARD_RATIO }]}>
        {c.image ? (
          <Image source={{ uri: `${c.image}/low.webp` }} style={[StyleSheet.absoluteFill, { opacity: 0.3 }]} contentFit="cover" cachePolicy="disk" />
        ) : (
          <View style={styles.noImg}>
            <Text style={styles.noImgText}>{c.name}</Text>
          </View>
        )}
        <View style={styles.plus}>
          <Text style={styles.plusText}>+</Text>
        </View>
      </View>
      <Text style={[styles.cardNum, { color: colors.textFaint }]} numberOfLines={1}>
        {`${c.localId} · ${c.name}`}
      </Text>
      <Text style={styles.cardType} numberOfLines={1}>
        não tenho
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <IconButton label="←" onPress={onBack} accessibilityLabel="Voltar" />
      </View>

      <FlatList
        data={sections}
        keyExtractor={(sec) => sec.setId}
        contentContainerStyle={{ paddingHorizontal: 16, gap: 12, paddingBottom: insets.bottom + 32 }}
        keyboardShouldPersistTaps="handled"
        initialNumToRender={4}
        windowSize={7}
        ListHeaderComponent={
          <View>
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
            <Pressable style={styles.addBtn} onPress={() => setAdding({})}>
              <Text style={styles.addText}>+ Adicionar carta</Text>
              <Text style={styles.addSub}>pela câmera ou escolhendo a expansão e a carta</Text>
            </Pressable>

            <Segmented<SpecialView>
              value={view}
              onChange={(v) => setSpecialFilters(col.uid, { view: v, country: '' })}
              options={[
                { value: 'tenho', label: 'Só as que tenho' },
                { value: 'todas', label: `Todas de ${what}` },
              ]}
            />
            {countryList.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.countryRow}>
                <Pressable style={[styles.chip, !country && styles.chipOn]} onPress={() => setSpecialFilters(col.uid, { country: '' })}>
                  <Text style={[styles.chipText, !country && styles.chipTextOn]}>{`Todos os países · ${total}`}</Text>
                </Pressable>
                {countryList.map(([code, n]) => (
                  <Pressable
                    key={code}
                    style={[styles.chip, country === code && styles.chipOn]}
                    onPress={() => setSpecialFilters(col.uid, { country: country === code ? '' : code })}
                  >
                    <Flag code={code} size={14} />
                    <Text style={[styles.chipText, country === code && styles.chipTextOn]}>{`${countryName(code)} · ${n}`}</Text>
                  </Pressable>
                ))}
              </ScrollView>
            ) : null}
            {country ? <Text style={styles.hint}>{`Mostrando só as cartas que você tem do país ${countryName(country)}.`}</Text> : null}

            {total > 6 || view === 'todas' ? (
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
            {view === 'todas' && loadingAll ? <ActivityIndicator color={colors.accent} style={{ marginVertical: 12 }} /> : null}
            {view === 'todas' && loadError ? (
              <Pressable onPress={() => setCandidates(null)}>
                <Text style={styles.error}>Não foi possível buscar as cartas agora. Toque para tentar de novo.</Text>
              </Pressable>
            ) : null}
            {sections.length ? (
              <Text style={styles.hint}>
                {view === 'todas'
                  ? 'Cartas apagadas são as que você não tem: toque para adicionar. Toque numa carta sua para ver preços ou remover; segure para trocar o país.'
                  : 'Toque numa carta para ver preços ou remover; segure o dedo para trocar o país.'}
              </Text>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          !loadingAll && total ? <Text style={styles.empty}>Nenhuma carta com esses filtros.</Text> : null
        }
        renderItem={({ item: sec }) => (
          <View style={styles.section}>
            <GlassShine r={22} />
            <View style={styles.secHead}>
              <SetLogo setId={sec.setId} logo={setById.get(sec.setId)?.s.logo} symbol={setById.get(sec.setId)?.s.symbol} style={styles.secLogo} />
              <Text style={styles.secName} numberOfLines={2}>
                {sec.setName}
              </Text>
              <Text style={styles.secCount}>
                {sec.totalCards !== undefined ? `${sec.ownedCards} de ${sec.totalCards}` : `${sec.tiles.length}`}
              </Text>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
              {sec.tiles.map((t) => (t.kind === 'owned' ? ownedTile(t.card) : missingTile(t.card, t.key)))}
            </View>
          </View>
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
      <AddSpecialCard visible={!!adding} col={col} prefill={adding?.prefill} onClose={() => setAdding(null)} />

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
  section: {
    padding: 14,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  secHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  secLogo: { width: 84, height: 36 },
  secName: { color: colors.text, fontSize: 15, fontWeight: '900', flex: 1 },
  secCount: { color: colors.gold, fontWeight: '900' },
  cardMissing: { borderColor: colors.border, borderStyle: 'dashed' },
  noImg: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4 },
  noImgText: { color: colors.textDim, textAlign: 'center', fontSize: 11 },
  plus: { position: 'absolute', alignSelf: 'center', top: '40%', width: 30, height: 30, borderRadius: 15, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center' },
  plusText: { color: '#fff', fontSize: 20, fontWeight: '900', marginTop: -2 },
  countryRow: { gap: 8, paddingVertical: 10 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  chipOn: { backgroundColor: colors.accentDim, borderColor: colors.accent },
  chipText: { color: colors.textDim, fontSize: 13, fontWeight: '700' },
  chipTextOn: { color: colors.text },
  error: { color: colors.gold, fontSize: 13, marginVertical: 8 },
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
