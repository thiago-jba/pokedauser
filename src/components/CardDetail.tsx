import { Image } from 'expo-image';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { cardImage, StoredCard, StoredSet } from '../api';
import { cardVariants, otherVariants, ownedKey } from '../collection';
import type { SetPrefs } from '../collection';
import { countryName, flagEmoji } from '../countries';
import { CountryPicker } from './CountryPicker';
import {
  cachedRates,
  fetchCardPrices,
  fmtMoney,
  getRates,
  jornadaUrl,
  ligaUrl,
  loadSetPrices,
} from '../prices';
import type { Rates, VariantPrice } from '../prices';
import { useStore } from '../store';
import { CARD_RATIO, colors, finishColors } from '../theme';
import { ApiVariantDetailed, CATEGORY_LABELS, classifyDetailed, FOIL_PT } from '../variants';
import { Chip } from './ui';

const TYPES: { value: string; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'holo', label: 'Holo' },
  { value: 'reverse', label: 'Reverse' },
];
const FOILS = ['cosmos', 'pokeball', 'masterball', 'galaxy', 'cracked-ice', 'gold', 'rainbow', 'energy', 'team-rocket'];

export function CardDetail({ set, prefs, card, onClose }: { set: StoredSet; prefs: SetPrefs; card: StoredCard | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const { ownedCountry, toggleOwned, setCountry, data, addCustomVariant, removeCustomVariant, includeVariant, excludeVariant } = useStore();
  const [pickingFor, setPickingFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState('holo');
  const [foil, setFoil] = useState<string | null>(null);
  const [promo, setPromo] = useState(true);
  const [livePrices, setLivePrices] = useState<Record<string, VariantPrice> | null>(null);
  const [nameEn, setNameEn] = useState<string | undefined>(undefined);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [rates, setRates] = useState<Rates | null>(() => cachedRates());

  // preços atualizados direto da fonte sempre que abre a carta
  useEffect(() => {
    if (!card) return;
    let alive = true;
    setLivePrices(null);
    setLoadingPrices(true);
    fetchCardPrices(card.id)
      .then((r) => {
        if (!alive || !r) return;
        setLivePrices(r.prices);
        setNameEn(r.name);
      })
      .finally(() => alive && setLoadingPrices(false));
    getRates().then((r) => alive && r && setRates(r));
    return () => {
      alive = false;
    };
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!card) return null;
  const setId = set.id;
  const imgW = Math.min(width - 48, (height * 0.5) / CARD_RATIO);
  const variants = cardVariants(set, card, prefs);
  const others = otherVariants(set, card, prefs);
  const cached = loadSetPrices(setId);
  const prices = livePrices ?? cached?.cards[card.id] ?? {};
  const code = data.collections.find((c) => c.setId === setId)?.code ?? set.code;
  const enName = card.nameEn ?? nameEn ?? cached?.names[card.id];
  const brl = (v: number | undefined, rate: number | undefined) => (v && rate ? ` (${fmtMoney(v * rate, 'R$')})` : '');
  const open = (url: string) => Linking.openURL(url).catch(() => Alert.alert('Não foi possível abrir o site'));

  const draft: ApiVariantDetailed = { type, ...(foil ? { foil } : {}), ...(promo ? { promo: true } : {}) };
  const draftLabel = classifyDetailed(draft, set.isPromoSet).label;

  const close = () => {
    setAdding(false);
    onClose();
  };

  return (
    <Modal visible animationType="fade" transparent onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView contentContainerStyle={{ alignItems: 'center', padding: 16 }}>
            {cardImage(card, 'high') ? (
              <Image
                source={{ uri: cardImage(card, 'high') }}
                placeholder={{ uri: cardImage(card, 'low') }}
                style={{ width: imgW, height: imgW * CARD_RATIO, borderRadius: 12 }}
                contentFit="contain"
                cachePolicy="disk"
              />
            ) : null}
            <Text style={styles.title}>{card.name}</Text>
            <Text style={styles.sub}>
              {[`Nº ${card.localId}`, card.rarity, card.category === 'Pokemon' ? 'Pokémon' : card.category === 'Trainer' ? 'Treinador' : card.category === 'Energy' ? 'Energia' : card.category]
                .filter(Boolean)
                .join('  ·  ')}
            </Text>

            <Text style={styles.section}>Variantes desta carta</Text>
            {variants.map((v) => {
              const k = ownedKey(card.id, v.key);
              const country = ownedCountry(setId, k);
              const owned = !!country;
              const fc = finishColors[v.finish];
              return (
                <Pressable key={v.key} style={styles.row} onPress={() => toggleOwned(setId, k)}>
                  <View style={[styles.dot, { backgroundColor: fc.bg }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{v.label}</Text>
                    <Text style={styles.rowSub}>
                      {CATEGORY_LABELS[v.category]}
                      {v.custom ? ' · adicionada por você' : ''}
                    </Text>
                    {v.custom ? (
                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          Alert.alert('Remover variante', `Remover "${v.label}" desta carta?`, [
                            { text: 'Cancelar', style: 'cancel' },
                            { text: 'Remover', style: 'destructive', onPress: () => removeCustomVariant(setId, card.id, v.key) },
                          ])
                        }
                      >
                        <Text style={styles.remove}>Remover</Text>
                      </Pressable>
                    ) : (
                      <Pressable
                        hitSlop={8}
                        onPress={() =>
                          Alert.alert(
                            'Ocultar da coleção',
                            `"${v.label}" deixa de aparecer e de contar nesta coleção. Dá para incluir de novo em "Outras versões desta carta".`,
                            [
                              { text: 'Cancelar', style: 'cancel' },
                              { text: 'Ocultar', style: 'destructive', onPress: () => excludeVariant(setId, k) },
                            ],
                          )
                        }
                      >
                        <Text style={styles.hide}>Ocultar da coleção</Text>
                      </Pressable>
                    )}
                    {(() => {
                      const vp = prices[v.key];
                      if (!vp) return <Text style={styles.priceNone}>{loadingPrices ? 'buscando preço…' : 'sem preço no TCGplayer/Cardmarket'}</Text>;
                      return (
                        <View style={styles.priceBox}>
                          {vp.tcg ? (
                            <Text style={styles.priceLine}>
                              <Text style={styles.priceSrc}>TCGplayer </Text>
                              {fmtMoney(vp.tcg, 'US$')}
                              <Text style={styles.priceBrl}>{brl(vp.tcg, rates?.usd)}</Text>
                            </Text>
                          ) : null}
                          {vp.cm ? (
                            <Text style={styles.priceLine}>
                              <Text style={styles.priceSrc}>Cardmarket </Text>
                              {fmtMoney(vp.cm, '€')}
                              <Text style={styles.priceBrl}>{brl(vp.cm, rates?.eur)}</Text>
                            </Text>
                          ) : null}
                        </View>
                      );
                    })()}
                    {country ? (
                      <Pressable hitSlop={6} onPress={() => setPickingFor(k)} style={styles.countryBtn}>
                        <Text style={styles.countryFlag}>{flagEmoji(country)}</Text>
                        <Text style={styles.countryName} numberOfLines={1}>
                          {countryName(country)}
                        </Text>
                        <Text style={styles.countryChange}>trocar ▸</Text>
                      </Pressable>
                    ) : null}
                  </View>
                  <View style={[styles.toggle, owned && styles.toggleOn]}>
                    <Text style={[styles.toggleText, owned && { color: '#1a1300' }]}>{owned ? 'Tenho' : 'Não tenho'}</Text>
                  </View>
                </Pressable>
              );
            })}

            {others.length ? (
              <>
                <Text style={styles.section}>Outras versões desta carta</Text>
                <Text style={styles.othersHint}>Existem, mas não fazem parte da sua coleção. Toque para incluir.</Text>
                {others.map((v) => {
                  const k = ownedKey(card.id, v.key);
                  const fc = finishColors[v.finish];
                  return (
                    <Pressable key={v.key} style={styles.row} onPress={() => includeVariant(setId, k)}>
                      <View style={[styles.dot, { backgroundColor: fc.bg, opacity: 0.6 }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.rowTitle, { color: colors.textDim }]}>{v.label}</Text>
                        <Text style={styles.rowSub}>{CATEGORY_LABELS[v.category]}</Text>
                      </View>
                      <View style={styles.includeBtn}>
                        <Text style={styles.includeText}>+ Incluir</Text>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            ) : null}

            <Text style={styles.priceNote}>Preço de mercado: média das vendas recentes (TCGplayer) e tendência de preço (Cardmarket). Em reais pela cotação do dia.</Text>

            <Text style={styles.section}>Preço no Brasil</Text>
            <View style={styles.storeRow}>
              <Pressable style={styles.storeBtn} onPress={() => open(ligaUrl(card, set, code, enName))}>
                <Text style={styles.storeName}>Liga Pokémon</Text>
                <Text style={styles.storeHint}>abrir a carta no site ↗</Text>
              </Pressable>
              <Pressable style={styles.storeBtn} onPress={() => open(jornadaUrl(card, set, enName))}>
                <Text style={styles.storeName}>Jornada Games</Text>
                <Text style={styles.storeHint}>buscar a carta no site ↗</Text>
              </Pressable>
            </View>

            {!adding ? (
              <Pressable onPress={() => setAdding(true)} style={styles.addLink}>
                <Text style={styles.addLinkText}>+ Adicionar variante que está faltando</Text>
              </Pressable>
            ) : (
              <View style={styles.addBox}>
                <Text style={styles.addTitle}>Nova variante</Text>
                <Text style={styles.addLabel}>Tipo</Text>
                <View style={styles.wrap}>
                  {TYPES.map((t) => (
                    <Chip key={t.value} label={t.label} active={type === t.value} onPress={() => setType(t.value)} />
                  ))}
                </View>
                <Text style={styles.addLabel}>Brilho especial</Text>
                <View style={styles.wrap}>
                  <Chip label="Nenhum" active={!foil} onPress={() => setFoil(null)} />
                  {FOILS.map((f) => (
                    <Chip key={f} label={FOIL_PT[f] ?? f} active={foil === f} onPress={() => setFoil(f)} />
                  ))}
                </View>
                <Pressable style={styles.promoRow} onPress={() => setPromo((p) => !p)}>
                  <View style={[styles.checkbox, promo && styles.checkboxOn]}>{promo ? <Text style={styles.tick}>✓</Text> : null}</View>
                  <Text style={styles.promoText}>É promocional (blister, caixa, evento)</Text>
                </Pressable>
                <Text style={styles.preview}>{`Vai aparecer como: ${draftLabel}`}</Text>
                <View style={styles.addActions}>
                  <Pressable onPress={() => setAdding(false)} style={styles.btn}>
                    <Text style={{ color: colors.textDim, fontWeight: '700' }}>Cancelar</Text>
                  </Pressable>
                  <Pressable
                    onPress={() => {
                      addCustomVariant(setId, card.id, draft);
                      setAdding(false);
                    }}
                    style={[styles.btn, { backgroundColor: colors.accent }]}
                  >
                    <Text style={{ color: '#fff', fontWeight: '700' }}>Adicionar</Text>
                  </Pressable>
                </View>
              </View>
            )}

            <Pressable onPress={close} style={styles.close}>
              <Text style={styles.closeText}>Fechar</Text>
            </Pressable>
          </ScrollView>
          <CountryPicker
            visible={!!pickingFor}
            current={pickingFor ? ownedCountry(setId, pickingFor) : undefined}
            onPick={(code) => pickingFor && setCountry(setId, pickingFor, code)}
            onClose={() => setPickingFor(null)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 12 },
  sheet: { backgroundColor: colors.sheet, borderRadius: 28, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden', maxHeight: '92%' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  sub: { color: colors.textDim, marginTop: 4, textAlign: 'center' },
  section: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', alignSelf: 'flex-start', marginTop: 18, marginBottom: 6, letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, width: '100%', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  rowTitle: { color: colors.text, fontWeight: '600' },
  rowSub: { color: colors.textFaint, fontSize: 12 },
  priceBox: { marginTop: 4, gap: 1 },
  priceLine: { color: colors.text, fontSize: 12, fontWeight: '700' },
  priceSrc: { color: colors.textFaint, fontWeight: '600' },
  priceBrl: { color: colors.textDim, fontWeight: '600' },
  priceNone: { color: colors.textFaint, fontSize: 11, marginTop: 4 },
  priceNote: { color: colors.textFaint, fontSize: 11, alignSelf: 'flex-start', marginTop: 8 },
  storeRow: { flexDirection: 'row', gap: 10, width: '100%' },
  storeBtn: { flex: 1, backgroundColor: colors.surface2, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 12, borderWidth: 1, borderColor: colors.border },
  storeName: { color: colors.text, fontWeight: '800', fontSize: 14 },
  storeHint: { color: colors.accent, fontSize: 11, fontWeight: '700', marginTop: 2 },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    marginTop: 6,
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.surface2,
    maxWidth: '100%',
  },
  countryFlag: { fontSize: 16 },
  countryName: { color: colors.text, fontSize: 13, fontWeight: '600', flexShrink: 1 },
  countryChange: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  hide: { color: colors.textFaint, fontSize: 12, fontWeight: '700', marginTop: 4 },
  othersHint: { color: colors.textFaint, fontSize: 11, alignSelf: 'flex-start', marginBottom: 4 },
  includeBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: colors.accentDim },
  includeText: { color: colors.accent, fontWeight: '800', fontSize: 12 },
  remove: { color: colors.accent, fontSize: 12, fontWeight: '700', marginTop: 2 },
  toggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  toggleOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  toggleText: { color: colors.textDim, fontWeight: '700', fontSize: 12 },
  addLink: { alignSelf: 'flex-start', paddingVertical: 12 },
  addLinkText: { color: colors.accent, fontWeight: '700' },
  addBox: { width: '100%', backgroundColor: colors.surface2, borderRadius: 12, padding: 12, marginTop: 12 },
  addTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  addLabel: { color: colors.textDim, fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 },
  promoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 12 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  tick: { color: '#fff', fontWeight: '900', fontSize: 13 },
  promoText: { color: colors.text, flex: 1 },
  preview: { color: colors.gold, marginTop: 12, fontWeight: '600' },
  addActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 12 },
  btn: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surface },
  close: { marginTop: 18, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 20, backgroundColor: colors.surface2 },
  closeText: { color: colors.text, fontWeight: '700' },
});
