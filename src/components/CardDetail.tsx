import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { imageUrl, StoredCard, StoredSet } from '../api';
import { cardVariants, ownedKey } from '../collection';
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

export function CardDetail({ set, card, onClose }: { set: StoredSet; card: StoredCard | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const { isOwned, toggleOwned, data, addCustomVariant, removeCustomVariant } = useStore();
  const [adding, setAdding] = useState(false);
  const [type, setType] = useState('holo');
  const [foil, setFoil] = useState<string | null>(null);
  const [promo, setPromo] = useState(true);

  if (!card) return null;
  const setId = set.id;
  const imgW = Math.min(width - 48, (height * 0.5) / CARD_RATIO);
  const variants = cardVariants(set, card, data.custom[setId]);

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
            {card.image ? (
              <Image
                source={{ uri: imageUrl(card.image, 'high') }}
                placeholder={{ uri: imageUrl(card.image, 'low') }}
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
              const owned = isOwned(setId, k);
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
                    ) : null}
                  </View>
                  <View style={[styles.toggle, owned && styles.toggleOn]}>
                    <Text style={[styles.toggleText, owned && { color: '#1a1300' }]}>{owned ? 'Tenho' : 'Não tenho'}</Text>
                  </View>
                </Pressable>
              );
            })}

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
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 12 },
  sheet: { backgroundColor: colors.surface, borderRadius: 18, maxHeight: '92%' },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginTop: 14, textAlign: 'center' },
  sub: { color: colors.textDim, marginTop: 4, textAlign: 'center' },
  section: { color: colors.textDim, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', alignSelf: 'flex-start', marginTop: 18, marginBottom: 6, letterSpacing: 0.6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, width: '100%', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  dot: { width: 12, height: 12, borderRadius: 6, marginRight: 12 },
  rowTitle: { color: colors.text, fontWeight: '600' },
  rowSub: { color: colors.textFaint, fontSize: 12 },
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
