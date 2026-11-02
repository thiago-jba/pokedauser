import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useAppDimensions } from '../dimensions';
import { Alert } from '../alert';
import { fetchSetInfo } from '../api';
import type { StoredCard, StoredSet } from '../api';
import { fetchCardDetail } from '../pokedex';
import { cachedRates, fmtMoney, getRates, jornadaUrl, ligaUrl, loadSetPrices, POKEDEX_PRICES_ID, pokedexCardPrice } from '../prices';
import type { Rates, VariantPrice } from '../prices';
import type { PokedexCard } from '../storage';
import { CARD_RATIO, colors } from '../theme';
import { CATEGORY_LABELS } from '../variants';
import type { VariantCategory } from '../variants';

/** Detalhe de uma carta da Pokédex: foto grande, tipo, raridade, preços e atalhos para as lojas. */
export function PokedexCardDetail({ card, onClose, onRemove }: { card: PokedexCard | null; onClose: () => void; onRemove: () => void }) {
  const { width, height } = useAppDimensions();
  const [price, setPrice] = useState<VariantPrice | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [rates, setRates] = useState<Rates | null>(() => cachedRates());
  const [code, setCode] = useState<string | undefined>(undefined);
  const [nameEn, setNameEn] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (!card) return;
    let alive = true;
    setPrice(pokedexCardPrice(loadSetPrices(POKEDEX_PRICES_ID), card.cardId, card.variantKey));
    setLoading(true);
    // preço atualizado na hora
    fetchCardDetail(card.cardId)
      .then((d) => {
        if (!alive) return;
        setNameEn(d.nameEn);
        const key = card.variantKey ?? (d.variants.find((v) => v.category === 'normal') ?? d.variants[0])?.key;
        if (key && d.prices[key]) setPrice(d.prices[key]);
      })
      .catch(() => {})
      .finally(() => alive && setLoading(false));
    // código da coleção para o link da Liga Pokémon
    fetchSetInfo(card.setId)
      .then((i) => alive && setCode(i.code))
      .catch(() => {});
    getRates().then((r) => alive && r && setRates(r));
    return () => {
      alive = false;
    };
  }, [card?.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!card) return null;
  const imgW = Math.min(width - 48, (height * 0.5) / CARD_RATIO);
  // formatos mínimos que as funções dos links usam
  const asCard = { id: card.cardId, localId: card.localId, name: card.name, nameEn: card.nameEn ?? nameEn, raw: [] } as StoredCard;
  const asSet = { id: card.setId, official: card.official } as StoredSet;
  const brl = (v: number | undefined, rate: number | undefined) => (v && rate ? ` (${fmtMoney(v * rate, 'R$')})` : '');
  const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('Não foi possível abrir o site'));

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 16 }}>
            {card.image ? (
              <Image
                source={{ uri: `${card.image}/high.webp` }}
                placeholder={{ uri: `${card.image}/low.webp` }}
                style={{ width: imgW, height: imgW * CARD_RATIO, borderRadius: 12 }}
                contentFit="contain"
                cachePolicy="disk"
              />
            ) : null}
            <Text style={styles.title}>{card.name}</Text>
            <Text style={styles.sub}>{`${card.setName} · ${card.localId}${card.official ? `/${card.official}` : ''}`}</Text>
            <Text style={styles.sub}>
              {[card.variantLabel ?? 'Normal', card.category ? CATEGORY_LABELS[card.category as VariantCategory] : null, card.rarity]
                .filter(Boolean)
                .join('  ·  ')}
            </Text>

            <Text style={styles.section}>Preço de mercado</Text>
            {price?.tcg || price?.cm ? (
              <View style={{ alignSelf: 'flex-start', gap: 2 }}>
                {price.tcg ? (
                  <Text style={styles.priceLine}>
                    <Text style={styles.priceSrc}>TCGplayer </Text>
                    {fmtMoney(price.tcg, 'US$')}
                    <Text style={styles.priceBrl}>{brl(price.tcg, rates?.usd)}</Text>
                  </Text>
                ) : null}
                {price.cm ? (
                  <Text style={styles.priceLine}>
                    <Text style={styles.priceSrc}>Cardmarket </Text>
                    {fmtMoney(price.cm, '€')}
                    <Text style={styles.priceBrl}>{brl(price.cm, rates?.eur)}</Text>
                  </Text>
                ) : null}
              </View>
            ) : (
              <Text style={styles.none}>{loading ? 'buscando preço…' : 'sem preço no TCGplayer/Cardmarket'}</Text>
            )}

            <Text style={styles.section}>Preço no Brasil</Text>
            <View style={styles.storeRow}>
              <Pressable style={styles.storeBtn} onPress={() => open(ligaUrl(asCard, asSet, code, asCard.nameEn))}>
                <Text style={styles.storeName}>Liga Pokémon</Text>
                <Text style={styles.storeHint}>abrir a carta no site ↗</Text>
              </Pressable>
              <Pressable style={styles.storeBtn} onPress={() => open(jornadaUrl(asCard, asSet, asCard.nameEn))}>
                <Text style={styles.storeName}>Jornada Games</Text>
                <Text style={styles.storeHint}>buscar a carta no site ↗</Text>
              </Pressable>
            </View>

            <View style={styles.actions}>
              <Pressable
                onPress={() =>
                  Alert.alert('Remover carta', `Remover "${card.name}" (${card.setName}) da Pokédex?`, [
                    { text: 'Cancelar', style: 'cancel' },
                    { text: 'Remover', style: 'destructive', onPress: onRemove },
                  ])
                }
                style={styles.btn}
              >
                <Text style={{ color: colors.accent, fontWeight: '800' }}>Remover</Text>
              </Pressable>
              <Pressable onPress={onClose} style={styles.btn}>
                <Text style={{ color: colors.text, fontWeight: '800' }}>Fechar</Text>
              </Pressable>
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 12 },
  sheet: { backgroundColor: colors.sheet, borderRadius: 28, maxHeight: '92%', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  sub: { color: colors.textDim, marginTop: 4, textAlign: 'center' },
  section: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', alignSelf: 'flex-start', marginTop: 18, marginBottom: 6, letterSpacing: 0.6 },
  priceLine: { color: colors.text, fontSize: 14, fontWeight: '700' },
  priceSrc: { color: colors.textFaint, fontWeight: '600' },
  priceBrl: { color: colors.textDim, fontWeight: '600' },
  none: { color: colors.textFaint, alignSelf: 'flex-start' },
  storeRow: { flexDirection: 'row', gap: 10, width: '100%' },
  storeBtn: { flex: 1, backgroundColor: colors.surface2, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  storeName: { color: colors.text, fontWeight: '800', fontSize: 14 },
  storeHint: { color: colors.accent, fontSize: 11, fontWeight: '700', marginTop: 2 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', width: '100%', marginTop: 20 },
  btn: { paddingHorizontal: 20, paddingVertical: 11, borderRadius: 999, backgroundColor: colors.surface2 },
});
