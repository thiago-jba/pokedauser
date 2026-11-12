import { Image } from 'expo-image';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { PokemonCardBrief } from '../pokedex';
import { CARD_RATIO, colors } from '../theme';

/** Miniaturas das cartas disponíveis para escolher com um toque (a escolhida fica destacada). */
export function CardPickerGrid({
  cards,
  selectedId,
  onPick,
  emptyText,
}: {
  cards: PokemonCardBrief[];
  selectedId?: string;
  onPick: (c: PokemonCardBrief) => void;
  emptyText: string;
}) {
  const [w, setW] = useState(0);
  const cols = w >= 700 ? 6 : w >= 480 ? 5 : 4;
  const gap = 8;
  const tile = w ? (w - gap * (cols - 1)) / cols : 0;

  return (
    <View style={{ marginTop: 12 }} onLayout={(e) => setW(e.nativeEvent.layout.width)}>
      <Text style={styles.label}>{`Cartas disponíveis (${cards.length})`}</Text>
      {!cards.length ? (
        <Text style={styles.empty}>{emptyText}</Text>
      ) : tile ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
          {cards.map((c) => {
            const on = c.id === selectedId;
            return (
              <Pressable key={c.id} onPress={() => onPick(c)} style={{ width: tile }}>
                <View style={[styles.frame, { height: tile * CARD_RATIO }, on && styles.frameOn]}>
                  {c.image ? (
                    <Image source={{ uri: `${c.image}/low.webp` }} style={StyleSheet.absoluteFill} contentFit="cover" cachePolicy="disk" recyclingKey={c.id} />
                  ) : (
                    <View style={styles.noImg}>
                      <Text style={styles.noImgText} numberOfLines={4}>
                        {c.name}
                      </Text>
                    </View>
                  )}
                  {on ? (
                    <View style={styles.check}>
                      <Text style={styles.checkText}>✓</Text>
                    </View>
                  ) : null}
                </View>
                <Text style={[styles.num, on && { color: colors.text }]} numberOfLines={1}>
                  {c.localId}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { color: colors.textFaint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  empty: { color: colors.textDim, fontSize: 13 },
  frame: { borderRadius: 7, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent' },
  frameOn: { borderColor: colors.accent },
  noImg: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 4, backgroundColor: colors.surface2 },
  noImgText: { color: colors.text, fontSize: 10, textAlign: 'center' },
  check: { position: 'absolute', top: 4, right: 4, width: 20, height: 20, borderRadius: 10, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  num: { color: colors.textFaint, fontSize: 10, textAlign: 'center', marginTop: 2, fontWeight: '700' },
});
