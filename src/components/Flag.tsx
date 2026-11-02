import { Image } from 'expo-image';
import React from 'react';
import { Platform, Text } from 'react-native';
import { flagEmoji } from '../countries';

/**
 * Bandeira do país. No celular usa o emoji (o Android desenha as bandeiras);
 * no navegador usa uma imagem, porque o Windows mostra só as letras ("BR") no lugar do emoji.
 */
export function Flag({ code, size }: { code: string; size: number }) {
  if (Platform.OS !== 'web') return <Text style={{ fontSize: size, lineHeight: size * 1.25 }}>{flagEmoji(code)}</Text>;
  const w = Math.round(size * 1.35);
  return (
    <Image
      source={{ uri: `https://flagcdn.com/w80/${code.toLowerCase()}.png` }}
      style={{ width: w, height: Math.round(w * 0.7), borderRadius: 2 }}
      contentFit="cover"
      cachePolicy="disk"
      accessibilityLabel={code}
    />
  );
}
