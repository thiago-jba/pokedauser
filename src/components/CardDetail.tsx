import { Image } from 'expo-image';
import React from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { imageUrl, StoredCard } from '../api';
import { ownedKey, useStore } from '../store';
import { CARD_RATIO, colors, finishColors } from '../theme';
import { CATEGORY_LABELS } from '../variants';

export function CardDetail({ setId, card, onClose }: { setId: string; card: StoredCard | null; onClose: () => void }) {
  const { width, height } = useWindowDimensions();
  const { isOwned, toggleOwned } = useStore();
  if (!card) return null;
  const imgW = Math.min(width - 48, (height * 0.55) / CARD_RATIO);

  return (
    <Modal visible animationType="fade" transparent onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={onClose}>
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
            {card.variants.map((v) => {
              const k = ownedKey(card.id, v.key);
              const owned = isOwned(setId, k);
              const fc = finishColors[v.finish];
              return (
                <Pressable key={v.key} style={styles.row} onPress={() => toggleOwned(setId, k)}>
                  <View style={[styles.dot, { backgroundColor: fc.bg }]} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.rowTitle}>{v.label}</Text>
                    <Text style={styles.rowSub}>{CATEGORY_LABELS[v.category]}</Text>
                  </View>
                  <View style={[styles.toggle, owned && styles.toggleOn]}>
                    <Text style={[styles.toggleText, owned && { color: '#1a1300' }]}>{owned ? 'Tenho' : 'Não tenho'}</Text>
                  </View>
                </Pressable>
              );
            })}
            <Pressable onPress={onClose} style={styles.close}>
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
  toggle: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.border },
  toggleOn: { backgroundColor: colors.gold, borderColor: colors.gold },
  toggleText: { color: colors.textDim, fontWeight: '700', fontSize: 12 },
  close: { marginTop: 18, paddingVertical: 10, paddingHorizontal: 28, borderRadius: 20, backgroundColor: colors.surface2 },
  closeText: { color: colors.text, fontWeight: '700' },
});
