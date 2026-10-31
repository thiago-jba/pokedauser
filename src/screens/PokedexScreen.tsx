import { Image } from 'expo-image';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { GlassShine } from '../components/Glass';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { ProgressBar, Segmented } from '../components/ui';
import { artworkUrl, dexNumber, getSpecies, loadSpeciesCache, Species } from '../pokedex';
import type { PokedexCard } from '../storage';
import { useStore } from '../store';
import { CARD_RATIO, colors } from '../theme';
import { matchesQuery } from '../variants';

type Status = 'todos' | 'tenho' | 'faltam';

export function PokedexScreen({ openPokemon }: { openPokemon: (id: number) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data } = useStore();
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

  const dex = data.pokedex ?? {};
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
            <Text style={styles.h1}>Pokédex</Text>
            <View style={styles.summary}>
              <GlassShine r={24} />
              <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
                <Text style={styles.big}>{`${ownedCount} de ${total || '…'}`}</Text>
                <Text style={styles.pct}>{total ? `${Math.floor((ownedCount / total) * 1000) / 10}`.replace('.', ',') + '%' : ''}</Text>
              </View>
              <Text style={styles.sub}>Pokémon com pelo menos uma carta</Text>
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
  h1: { color: colors.text, fontSize: 34, fontWeight: '900', letterSpacing: -0.5, marginBottom: 12 },
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
