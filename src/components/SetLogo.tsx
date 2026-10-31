import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

/**
 * Logo da coleção. Tenta, em ordem: logo em português, logo em inglês, símbolo da coleção.
 * Se nenhum existir, mostra a sigla da coleção.
 */
export function SetLogo({
  logo,
  symbol,
  fallbackText,
  style,
}: {
  logo?: string;
  symbol?: string;
  fallbackText: string;
  style: StyleProp<ViewStyle>;
}) {
  const candidates = useMemo(() => {
    const list: string[] = [];
    if (logo) {
      list.push(`${logo}.webp`, `${logo}.png`);
      const en = logo.replace(/assets\.tcgdex\.net\/[a-z-]+\//, 'assets.tcgdex.net/en/');
      if (en !== logo) list.push(`${en}.webp`, `${en}.png`);
    }
    if (symbol) list.push(`${symbol}.webp`, `${symbol}.png`);
    return list;
  }, [logo, symbol]);
  const [idx, setIdx] = useState(0);

  if (idx >= candidates.length) {
    return (
      <View style={[style, { alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.textDim, fontWeight: '800', fontSize: 16 }}>{fallbackText.toUpperCase()}</Text>
      </View>
    );
  }
  return (
    <View style={style}>
      <Image
        source={{ uri: candidates[idx] }}
        style={{ width: '100%', height: '100%' }}
        contentFit="contain"
        cachePolicy="disk"
        onError={() => setIdx((i) => i + 1)}
      />
    </View>
  );
}

/** Símbolo pequeno da coleção (o desenho que aparece no canto das cartas). */
export function SetSymbol({ symbol, size = 18 }: { symbol?: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  if (!symbol || failed) return null;
  return (
    <Image
      source={{ uri: `${symbol}.webp` }}
      style={{ width: size, height: size }}
      contentFit="contain"
      cachePolicy="disk"
      onError={() => setFailed(true)}
    />
  );
}
