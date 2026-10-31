import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AddPokedexCard } from '../components/AddPokedexCard';
import { GlassShine } from '../components/Glass';
import { PokedexCardDetail } from '../components/PokedexCardDetail';
import { IconButton } from '../components/ui';
import { artworkUrl, dexNumber, loadSpeciesCache } from '../pokedex';
import type { PokedexCard } from '../storage';
import { useStore } from '../store';
import { CARD_RATIO, colors } from '../theme';

export function PokemonScreen({ dexId, onBack }: { dexId: number; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data, removePokedexCard } = useStore();
  const [adding, setAdding] = useState(false);
  const [detail, setDetail] = useState<PokedexCard | null>(null);
  const name = loadSpeciesCache()?.find((s) => s.id === dexId)?.name ?? dexNumber(dexId);
  const cards = data.pokedex?.[dexId] ?? [];
  const cols = 2;
  const w = (width - 16 * 2 - 12) / cols;

  const remove = (c: PokedexCard) =>
    Alert.alert('Remover carta', `Remover "${c.name}" (${c.setName}) da Pokédex?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removePokedexCard(dexId, c.uid) },
    ]);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <IconButton label="←" onPress={onBack} accessibilityLabel="Voltar" />
      </View>

      <FlatList
        data={cards}
        keyExtractor={(c) => c.uid}
        numColumns={cols}
        columnWrapperStyle={{ gap: 12, paddingHorizontal: 16 }}
        contentContainerStyle={{ gap: 12, paddingBottom: insets.bottom + 32 }}
        ListHeaderComponent={
          <View style={{ paddingHorizontal: 16 }}>
            <View style={styles.hero}>
              <GlassShine r={26} />
              <Image source={{ uri: artworkUrl(dexId) }} style={styles.art} contentFit="contain" cachePolicy="disk" />
              <View style={{ flex: 1 }}>
                <Text style={styles.num}>{dexNumber(dexId)}</Text>
                <Text style={styles.name} numberOfLines={2}>
                  {name}
                </Text>
                <Text style={styles.count}>{cards.length === 0 ? 'Nenhuma carta ainda' : `${cards.length} ${cards.length === 1 ? 'carta' : 'cartas'}`}</Text>
              </View>
            </View>
            <Pressable style={styles.addBtn} onPress={() => setAdding(true)}>
              <Text style={styles.addText}>+ Adicionar carta</Text>
              <Text style={styles.addSub}>pela câmera ou digitando a coleção e a carta</Text>
            </Pressable>
            {cards.length ? <Text style={styles.hint}>Toque numa carta para ver preços; segure o dedo para remover.</Text> : null}
          </View>
        }
        renderItem={({ item }) => (
          <Pressable onPress={() => setDetail(item)} onLongPress={() => remove(item)} delayLongPress={350} style={{ width: w }}>
            <View style={[styles.cardFrame, { height: w * CARD_RATIO }]}>
              {item.image ? (
                <Image source={{ uri: `${item.image}/high.webp` }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" />
              ) : (
                <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center' }]}>
                  <Text style={{ color: colors.textDim, textAlign: 'center' }}>{item.name}</Text>
                </View>
              )}
            </View>
            <Text style={styles.cardSet} numberOfLines={1}>
              {item.setName}
            </Text>
            <Text style={styles.cardNum} numberOfLines={1}>
              {`${item.localId}${item.official ? `/${item.official}` : ''} · ${item.name}`}
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
          if (detail) removePokedexCard(dexId, detail.uid);
          setDetail(null);
        }}
      />
      <AddPokedexCard visible={adding} dexId={dexId} pokemonName={name} onClose={() => setAdding(false)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  topBar: { paddingHorizontal: 16, marginBottom: 8, flexDirection: 'row' },
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
  art: { width: 110, height: 110 },
  num: { color: colors.textFaint, fontSize: 14, fontWeight: '800' },
  name: { color: colors.text, fontSize: 28, fontWeight: '900', letterSpacing: -0.4 },
  count: { color: colors.textDim, marginTop: 4 },
  addBtn: { marginTop: 12, marginBottom: 8, padding: 14, borderRadius: 20, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent, alignItems: 'center' },
  addText: { color: colors.text, fontWeight: '900', fontSize: 16 },
  addSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  hint: { color: colors.textFaint, fontSize: 12, marginBottom: 6 },
  cardFrame: { borderRadius: 12, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 2, borderColor: colors.gold },
  cardSet: { color: colors.textDim, fontSize: 11, marginTop: 6 },
  cardNum: { color: colors.text, fontSize: 12, fontWeight: '700' },
  cardType: { color: colors.textFaint, fontSize: 11 },
});
