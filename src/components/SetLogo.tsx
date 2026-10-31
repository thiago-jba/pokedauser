import { Image } from 'expo-image';
import React, { useMemo, useState } from 'react';
import { StyleProp, Text, View, ViewStyle } from 'react-native';
import { colors } from '../theme';

// Logos oficiais em português do site tcg.pokemon.com/pt-br.
// O nome do arquivo segue o código da coleção ("sv08", "me01"; "sv08.5" vira "sv08pt5").
const OFFICIAL_BASE = 'https://d1i787aglh9bmb.cloudfront.net/assets/img/global/logos/pt-br/';
const OFFICIAL_ALIAS: Record<string, string> = { '30th': 'thirty' };

export function officialLogoUrl(setId: string): string {
  const code = OFFICIAL_ALIAS[setId] ?? setId.replace(/\.5$/, 'pt5');
  return `${OFFICIAL_BASE}${code}.png`;
}

/**
 * Logo da coleção. Tenta, em ordem: logo oficial em português (site da Pokémon),
 * logo da TCGdex em português, em inglês, e o símbolo da coleção.
 * Se nenhum existir, mostra a sigla da coleção.
 */
export function SetLogo({
  setId,
  logo,
  symbol,
  style,
  fit = 'contain',
  blurRadius,
  hideFallbackText,
}: {
  setId: string;
  logo?: string;
  symbol?: string;
  style: StyleProp<ViewStyle>;
  fit?: 'contain' | 'cover';
  blurRadius?: number;
  /** quando é só o fundo desfocado, não mostra a sigla se não houver imagem */
  hideFallbackText?: boolean;
}) {
  const fallbackText = setId;
  const candidates = useMemo(() => {
    const list: string[] = [officialLogoUrl(setId)];
    if (logo) {
      list.push(`${logo}.webp`, `${logo}.png`);
      const en = logo.replace(/assets\.tcgdex\.net\/[a-z-]+\//, 'assets.tcgdex.net/en/');
      if (en !== logo) list.push(`${en}.webp`, `${en}.png`);
    }
    if (symbol) list.push(`${symbol}.webp`, `${symbol}.png`);
    return list;
  }, [setId, logo, symbol]);
  const [idx, setIdx] = useState(0);

  if (idx >= candidates.length) {
    if (hideFallbackText) return null;
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
        contentFit={fit}
        blurRadius={blurRadius}
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
