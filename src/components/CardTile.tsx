import { Image } from 'expo-image';
import React, { memo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { imageUrl, StoredCard } from '../api';
import { countryName, flagEmoji } from '../countries';
import { CARD_RATIO, colors, finishColors } from '../theme';
import type { CardVariant } from '../variants';

interface Props {
  card: StoredCard;
  variant: CardVariant;
  /** país da carta que eu tenho; vazio = não tenho */
  country?: string;
  width: number;
  onToggle: (card: StoredCard, variant: CardVariant) => void;
  onOpen: (card: StoredCard) => void;
}

function CardTileBase({ card, variant, country, width, onToggle, onOpen }: Props) {
  const owned = !!country;
  const fc = finishColors[variant.finish];
  const h = width * CARD_RATIO;
  const [failed, setFailed] = useState(false);
  const uri = failed ? undefined : imageUrl(card.image, 'low');

  return (
    <Pressable
      onPress={() => onToggle(card, variant)}
      onLongPress={() => onOpen(card)}
      delayLongPress={300}
      style={({ pressed }) => [{ width, margin: 4 }, pressed && { transform: [{ scale: 0.97 }] }]}
      accessibilityLabel={`${card.name} ${variant.label}, ${country ? `tenho, ${countryName(country)}` : 'não tenho'}`}
    >
      <View style={[styles.frame, { height: h, borderColor: owned ? colors.gold : variant.finish === 'normal' ? 'transparent' : fc.bg }]}>
        {uri ? (
          <Image
            source={{ uri }}
            style={[StyleSheet.absoluteFill, !owned && { opacity: 0.35 }]}
            contentFit="cover"
            cachePolicy="disk"
            transition={150}
            recyclingKey={card.id}
            onError={() => setFailed(true)}
          />
        ) : (
          <View style={[StyleSheet.absoluteFill, styles.noImg, !owned && { opacity: 0.5 }]}>
            <Text style={styles.noImgNum} numberOfLines={1}>
              {card.localId}
            </Text>
            <Text style={styles.noImgText} numberOfLines={2}>
              {card.name}
            </Text>
            <Text style={styles.noImgHint}>foto ainda não disponível</Text>
          </View>
        )}
        {variant.finish !== 'normal' && (
          <View pointerEvents="none" style={[styles.sheen, { backgroundColor: fc.bg }]} />
        )}
        {country ? (
          <View style={styles.flag}>
            <Text style={styles.flagText}>{flagEmoji(country)}</Text>
          </View>
        ) : null}
      </View>
      <View style={[styles.badge, { backgroundColor: fc.bg }]}>
        <Text style={[styles.badgeText, { color: fc.fg }]} numberOfLines={1}>
          {variant.label}
        </Text>
      </View>
      <Text style={[styles.name, !owned && { color: colors.textFaint }]} numberOfLines={1}>
        {`#${card.localId} ${card.name}`}
      </Text>
    </Pressable>
  );
}

export const CardTile = memo(CardTileBase);

const styles = StyleSheet.create({
  frame: {
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    borderWidth: 2,
  },
  sheen: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, opacity: 0.9 },
  noImg: { alignItems: 'center', justifyContent: 'center', padding: 6 },
  noImgNum: { color: colors.text, fontSize: 26, fontWeight: '900' },
  noImgText: { color: colors.text, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 2 },
  noImgHint: { color: colors.textFaint, fontSize: 9, textAlign: 'center', marginTop: 6 },
  flag: {
    position: 'absolute',
    top: 3,
    right: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
    borderRadius: 6,
    backgroundColor: 'rgba(17,18,28,0.75)',
  },
  flagText: { fontSize: 17, lineHeight: 21 },
  badge: { marginTop: 4, borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700' },
  name: { color: colors.text, fontSize: 11, marginTop: 2 },
});
