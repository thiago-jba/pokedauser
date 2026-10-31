import { Image } from 'expo-image';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Modal, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { CardScanner } from '../components/CardScanner';
import { fetchAllSets } from '../api';
import { loadSetsCacheAnyAge, saveSetsCache } from '../storage';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassShine } from '../components/Glass';
import { MultiPicker } from '../components/MultiPicker';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { ProgressBar, Segmented } from '../components/ui';
import { artworkUrl, dexNumber, getSpecies, identifyCard, loadSpeciesCache, parseFooter } from '../pokedex';
import type { PokemonCardBrief, Species } from '../pokedex';
import type { PokedexCard } from '../storage';
import { useStore } from '../store';
import { CARD_RATIO, colors } from '../theme';
import { CATEGORY_LABELS, CATEGORY_ORDER, matchesQuery } from '../variants';
import type { VariantCategory } from '../variants';

type Status = 'todos' | 'tenho' | 'faltam';

export function PokedexScreen({ openPokemon }: { openPokemon: (id: number, prefill?: PokemonCardBrief) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data, setPokedexFilters } = useStore();
  const [picker, setPicker] = useState<'tipo' | 'raridade' | null>(null);
  const [scanning, setScanning] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [choices, setChoices] = useState<{ card: PokemonCardBrief; dexIds: number[] }[] | null>(null);

  // Câmera na tela principal: descobre qual é a carta (e o Pokémon) e abre a inclusão já preenchida
  const onRead = async (text: string) => {
    setScanning(false);
    const read = parseFooter(text);
    if (read.number === undefined && !read.promo) {
      Alert.alert('Não consegui ler', 'Não achei o número da carta no rodapé. Tente de novo com mais luz ou adicione pelo Pokémon.');
      return;
    }
    setIdentifying(true);
    try {
      // o total oficial de cada coleção é o que separa "116/128" das outras cartas 116
      let sets = loadSetsCacheAnyAge() ?? [];
      if (!sets.length) {
        sets = await fetchAllSets();
        saveSetsCache(sets);
      }
      const byId = new Map(sets.map((x) => [x.id, x]));
      const found = await identifyCard(read, (id) => ({
        official: byId.get(id)?.official,
        code: data.collections.find((c) => c.setId === id)?.code,
      }));
      if (!found.length) {
        Alert.alert('Carta não encontrada', `Li ${read.promo ?? `${read.number}/${read.total ?? '?'}`}, mas não achei a carta. Adicione pelo Pokémon, digitando a coleção e a carta.`);
      } else if (found.length === 1) {
        openPokemon(found[0].dexIds[0], found[0].card);
      } else {
        setChoices(found);
      }
    } catch {
      Alert.alert('Sem conexão', 'Não foi possível identificar a carta agora.');
    } finally {
      setIdentifying(false);
    }
  };
  const setLabel = (id: string) => {
    const x = loadSetsCacheAnyAge()?.find((s) => s.id === id);
    return x?.namePt ?? x?.nameEn ?? id;
  };
  const [species, setSpecies] = useState<Species[] | null>(() => loadSpeciesCache());
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<Status>('todos');

  const load = () => {
    setError(null);
    getSpecies()
      .then(setSpecies)
      .catch(() => setError('Sem conexão para baixar a lista de Pokémon. Toque para tentar de novo.'));
  };
  useEffect(load, []); // eslint-disable-line react-hooks/exhaustive-deps

  const allDex = data.pokedex ?? {};

  // filtros (escolha múltipla): só oferecem o que existe nas minhas cartas da Pokédex
  const myCards = useMemo(() => Object.values(allDex).flat(), [allDex]);
  const catOf = (c: PokedexCard) => c.category ?? 'normal';
  const rarOf = (c: PokedexCard) => c.rarity ?? 'Sem raridade';
  const typeOptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of myCards) m.set(catOf(c), (m.get(catOf(c)) ?? 0) + 1);
    return CATEGORY_ORDER.filter((c) => m.has(c)).map((c) => ({ value: c, label: CATEGORY_LABELS[c as VariantCategory], count: m.get(c) }));
  }, [myCards]);
  const rarityOptions = useMemo(() => {
    const m = new Map<string, number>();
    for (const c of myCards) m.set(rarOf(c), (m.get(rarOf(c)) ?? 0) + 1);
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([r, n]) => ({ value: r, label: r, count: n }));
  }, [myCards]);
  const selTypes = (data.pokedexFilters?.categories ?? []).filter((t) => typeOptions.some((o) => o.value === t));
  const selRars = (data.pokedexFilters?.rarities ?? []).filter((r) => rarityOptions.some((o) => o.value === r));
  const filtering = selTypes.length > 0 || selRars.length > 0;

  // cartas de cada Pokémon que passam pelos filtros
  const dex = useMemo(() => {
    if (!filtering) return allDex;
    const out: Record<string, PokedexCard[]> = {};
    for (const [id, cards] of Object.entries(allDex)) {
      const ok = cards.filter((c) => (!selTypes.length || selTypes.includes(catOf(c))) && (!selRars.length || selRars.includes(rarOf(c))));
      if (ok.length) out[id] = ok;
    }
    return out;
  }, [allDex, filtering, selTypes.join(), selRars.join()]); // eslint-disable-line react-hooks/exhaustive-deps
  const ownedCount = useMemo(() => (species ?? []).filter((s) => (dex[s.id]?.length ?? 0) > 0).length, [species, dex]);

  const list = useMemo(() => {
    const t = q.trim().replace(/^#/, '');
    return (species ?? []).filter((s) => {
      const has = (dex[s.id]?.length ?? 0) > 0;
      if (status === 'tenho' && !has) return false;
      if (status === 'faltam' && has) return false;
      if (!t) return true;
      if (/^\d+$/.test(t)) return String(s.id).includes(String(Number(t)));
      return matchesQuery(s.name, t);
    });
  }, [species, dex, q, status]);

  const cols = width >= 600 ? 5 : 3;
  const tileW = (width - 16 * 2 - cols * 8) / cols;
  const total = species?.length ?? 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <FlatList
        key={`dex-${cols}`}
        data={list}
        numColumns={cols}
        keyExtractor={(s) => String(s.id)}
        extraData={dex}
        columnWrapperStyle={{ paddingHorizontal: 12 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + TAB_BAR_SPACE }}
        initialNumToRender={24}
        windowSize={9}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16 }}>
            <View style={styles.titleRow}>
              <Text style={styles.h1}>Pokédex</Text>
              <Pressable style={styles.scanBtn} onPress={() => setScanning(true)} disabled={identifying}>
                {identifying ? <ActivityIndicator color={colors.text} /> : <Text style={styles.scanText}>📷 Ler carta</Text>}
              </Pressable>
            </View>
            <View style={styles.summary}>
              <GlassShine r={24} />
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Text style={styles.big}>{`${ownedCount} de ${total || '…'}`}</Text>
                <Text style={styles.pct}>{total ? `${Math.floor((ownedCount / total) * 1000) / 10}`.replace('.', ',') + '%' : ''}</Text>
              </View>
              <Text style={styles.sub}>{filtering ? 'Pokémon com carta nos filtros escolhidos' : 'Pokémon com pelo menos uma carta'}</Text>
              <View style={{ marginTop: 8 }}>
                <ProgressBar value={ownedCount} total={total} height={8} />
              </View>
            </View>
            <View style={styles.searchBox}>
              <GlassShine r={999} />
              <Text style={styles.searchIcon}>⌕</Text>
              <TextInput
                value={q}
                onChangeText={setQ}
                placeholder="Buscar Pokémon por nome ou número"
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
            <View style={styles.filterRow}>
              <Pressable style={[styles.filterPill, selTypes.length > 0 && styles.filterOn]} onPress={() => setPicker('tipo')}>
                <Text style={styles.filterText} numberOfLines={1}>
                  {selTypes.length === 0 ? 'Tipo de carta ▾' : selTypes.length === 1 ? CATEGORY_LABELS[selTypes[0] as VariantCategory] : `${selTypes.length} tipos`}
                </Text>
              </Pressable>
              <Pressable style={[styles.filterPill, selRars.length > 0 && styles.filterOn]} onPress={() => setPicker('raridade')}>
                <Text style={styles.filterText} numberOfLines={1}>
                  {selRars.length === 0 ? 'Raridade ▾' : selRars.length === 1 ? selRars[0] : `${selRars.length} raridades`}
                </Text>
              </Pressable>
            </View>
            <Segmented<Status>
              value={status}
              onChange={setStatus}
              style={{ marginBottom: 10 }}
              options={[
                { value: 'todos', label: 'Todos' },
                { value: 'tenho', label: 'Tenho' },
                { value: 'faltam', label: 'Faltam' },
              ]}
            />
          </View>
        }
        ListEmptyComponent={
          <Pressable onPress={error ? load : undefined}>
            <Text style={styles.empty}>{error ?? (species ? 'Nenhum Pokémon encontrado.' : 'Baixando a lista de Pokémon…')}</Text>
          </Pressable>
        }
        renderItem={({ item }) => (
          <PokedexTile species={item} cards={dex[item.id] ?? []} width={tileW} onPress={() => openPokemon(item.id)} />
        )}
      />
      <CardScanner visible={scanning} onClose={() => setScanning(false)} onRead={onRead} />
      <Modal visible={!!choices} transparent animationType="fade" onRequestClose={() => setChoices(null)}>
        <Pressable style={styles.choiceBackdrop} onPress={() => setChoices(null)}>
          <View style={styles.choiceBox}>
            <Text style={styles.choiceTitle}>Qual destas é a sua carta?</Text>
            {(choices ?? []).map(({ card, dexIds }) => (
              <Pressable
                key={card.id}
                style={styles.choiceItem}
                onPress={() => {
                  setChoices(null);
                  openPokemon(dexIds[0], card);
                }}
              >
                {card.image ? <Image source={{ uri: `${card.image}/low.webp` }} style={styles.choiceImg} contentFit="cover" /> : null}
                <View style={{ flex: 1 }}>
                  <Text style={styles.choiceName}>{card.name}</Text>
                  <Text style={styles.choiceSub}>{`${setLabel(card.setId)} · ${card.localId}`}</Text>
                </View>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
      <MultiPicker
        visible={picker === 'tipo'}
        title="Tipo de carta"
        hint="Só aparecem os tipos que você tem na Pokédex. Fica salvo."
        options={typeOptions}
        selected={selTypes}
        onChange={(v) => setPokedexFilters({ categories: v })}
        onClose={() => setPicker(null)}
      />
      <MultiPicker
        visible={picker === 'raridade'}
        title="Raridade"
        hint="Só aparecem as raridades que você tem na Pokédex. Fica salvo."
        options={rarityOptions}
        selected={selRars}
        onChange={(v) => setPokedexFilters({ rarities: v })}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

/** Quadro de um Pokémon: arte oficial apagada se não tenho; a carta (ou as cartas, compactas) se tenho. */
const PokedexTile = memo(function PokedexTile({
  species,
  cards,
  width,
  onPress,
}: {
  species: Species;
  cards: PokedexCard[];
  width: number;
  onPress: () => void;
}) {
  const h = width * CARD_RATIO;
  const owned = cards.length > 0;
  const shown = cards.slice(0, 3);
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [{ width, margin: 4 }, pressed && { transform: [{ scale: 0.97 }] }]}>
      <View style={[styles.frame, { height: h }, owned && { borderColor: colors.gold }]}>
        {!owned ? (
          <Image source={{ uri: artworkUrl(species.id) }} style={[StyleSheet.absoluteFill, { opacity: 0.3, margin: 8 }]} contentFit="contain" cachePolicy="disk" />
        ) : shown.length === 1 ? (
          <CardImage card={shown[0]} style={StyleSheet.absoluteFill} />
        ) : (
          // várias cartas: em leque, compactas
          shown.map((c, i) => {
            const w = width * 0.66;
            const step = (width - w - 8) / Math.max(1, shown.length - 1);
            return (
              <CardImage
                key={c.uid}
                card={c}
                style={{
                  position: 'absolute',
                  width: w,
                  height: w * CARD_RATIO,
                  left: 4 + i * step,
                  top: 4 + i * ((h - w * CARD_RATIO - 8) / Math.max(1, shown.length - 1)),
                  borderRadius: 6,
                  borderWidth: 1,
                  borderColor: 'rgba(0,0,0,0.5)',
                }}
              />
            );
          })
        )}
        {cards.length > 1 ? (
          <View style={styles.countBadge}>
            <Text style={styles.countText}>{`×${cards.length}`}</Text>
          </View>
        ) : null}
      </View>
      <Text style={[styles.name, !owned && { color: colors.textFaint }]} numberOfLines={1}>
        {`${dexNumber(species.id)} ${species.name}`}
      </Text>
    </Pressable>
  );
});

function CardImage({ card, style }: { card: PokedexCard; style: any }) {
  const [failed, setFailed] = useState(false);
  if (!card.image || failed)
    return (
      <View style={[style, styles.noImg]}>
        <Text style={styles.noImgText} numberOfLines={3}>{`${card.name}\n${card.setName}`}</Text>
      </View>
    );
  return (
    <Image
      source={{ uri: `${card.image}/low.webp` }}
      style={style}
      contentFit="cover"
      cachePolicy="disk"
      recyclingKey={card.uid}
      onError={() => setFailed(true)}
    />
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  h1: { color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -0.5 },
  titleRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  scanBtn: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.accentDim,
    borderWidth: 1,
    borderColor: colors.accent,
    minWidth: 120,
    alignItems: 'center',
  },
  scanText: { color: colors.text, fontWeight: '800' },
  choiceBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 },
  choiceBox: { backgroundColor: colors.sheet, borderRadius: 24, padding: 16, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, gap: 6 },
  choiceTitle: { color: colors.text, fontSize: 17, fontWeight: '800', marginBottom: 6 },
  choiceItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 8 },
  choiceImg: { width: 46, height: 64, borderRadius: 6 },
  choiceName: { color: colors.text, fontWeight: '700' },
  choiceSub: { color: colors.textDim, fontSize: 12 },
  summary: {
    padding: 16,
    marginBottom: 12,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  big: { color: colors.text, fontSize: 24, fontWeight: '900' },
  pct: { color: colors.accent, fontSize: 22, fontWeight: '900' },
  sub: { color: colors.textDim, fontSize: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  searchIcon: { color: colors.textDim, fontSize: 20, marginRight: 6 },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 11 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 30, paddingHorizontal: 24 },
  filterRow: { flexDirection: 'row', gap: 8, marginBottom: 10 },
  filterPill: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  filterOn: { borderColor: colors.accent, borderWidth: 1 },
  filterText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  frame: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  name: { color: colors.text, fontSize: 11, marginTop: 4, fontWeight: '600' },
  countBadge: { position: 'absolute', top: 4, right: 4, backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 7, paddingVertical: 2 },
  countText: { color: '#1a1300', fontWeight: '900', fontSize: 11 },
  noImg: { alignItems: 'center', justifyContent: 'center', padding: 6, backgroundColor: colors.surface2 },
  noImgText: { color: colors.text, fontSize: 10, textAlign: 'center' },
});
