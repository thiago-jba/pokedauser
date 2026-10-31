import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { formatPct } from '../collection';
import { formatDateBr } from '../eras';
import type { CollectionEntry } from '../storage';
import { colors } from '../theme';
import { GlassShine } from './Glass';
import { SetLogo, SetSymbol } from './SetLogo';
import { ProgressBar } from './ui';

export interface Stats {
  owned: number;
  total: number;
  pct: number;
  filtered: boolean;
}

/** Código da coleção como aparece impresso no canto inferior esquerdo das cartas: fundo preto, letras brancas. */
export function SetCodeBadge({ code, size = 'md' }: { code?: string; size?: 'sm' | 'md' }) {
  const sm = size === 'sm';
  return (
    <View style={[styles.code, sm && styles.codeSm]}>
      <Text style={[styles.codeText, sm && styles.codeTextSm]} numberOfLines={1}>
        {code || '—'}
      </Text>
    </View>
  );
}

interface CardProps {
  item: CollectionEntry;
  st: Stats;
  onPress: () => void;
  onLongPress: () => void;
}

/** Quadro grande, com o logo de fundo. */
export function CollectionTile({ item, st, onPress, onLongPress, width }: CardProps & { width: number }) {
  return (
    <Pressable
      style={({ pressed }) => [styles.tile, { width, height: width * 1.18 }, pressed && { opacity: 0.85 }]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      {/* fundo: o próprio logo ampliado e desfocado */}
      <SetLogo
        setId={item.setId}
        logo={item.logo}
        symbol={item.symbol}
        style={[StyleSheet.absoluteFill, { opacity: 0.45, transform: [{ scale: 1.6 }] }]}
        fit="cover"
        blurRadius={14}
        hideFallbackText
      />
      <View style={[StyleSheet.absoluteFill, styles.tileTint]} />
      <GlassShine r={24} />
      <SetLogo setId={item.setId} logo={item.logo} symbol={item.symbol} style={styles.tileLogo} />
      {st.filtered ? (
        <View style={styles.filterBadge}>
          <Text style={styles.filterBadgeText}>filtro</Text>
        </View>
      ) : null}
      <View style={styles.tileInfo}>
        <View style={styles.tileTopRow}>
          <SetCodeBadge code={item.code} size="sm" />
          <Text style={styles.tileDate} numberOfLines={1}>
            {formatDateBr(item.releaseDate)}
          </Text>
        </View>
        <View style={styles.tileNameRow}>
          <SetSymbol symbol={item.symbol} size={14} />
          <Text style={styles.tileName} numberOfLines={1}>
            {item.namePt ?? item.nameEn}
          </Text>
        </View>
        <View style={styles.statsRow}>
          <Text style={styles.sub}>{`${st.owned} / ${st.total}`}</Text>
          <Text style={[styles.pct, st.pct >= 100 && { color: colors.gold }]}>{formatPct(st.pct)}</Text>
        </View>
        <ProgressBar value={st.owned} total={st.total} height={5} />
      </View>
    </Pressable>
  );
}

/** Linha compacta da visualização em lista. */
export function CollectionRow({ item, st, onPress, onLongPress }: CardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surface2 }]}
      onPress={onPress}
      onLongPress={onLongPress}
    >
      <GlassShine r={20} />
      <SetCodeBadge code={item.code} />
      <View style={{ flex: 1 }}>
        <View style={styles.rowTop}>
          <Text style={styles.rowName} numberOfLines={1}>
            {item.namePt ?? item.nameEn}
          </Text>
          <Text style={[styles.pct, st.pct >= 100 && { color: colors.gold }]}>{formatPct(st.pct)}</Text>
        </View>
        <View style={styles.rowBottom}>
          <Text style={styles.sub} numberOfLines={1}>
            {`${st.owned} / ${st.total}`}
            {item.releaseDate ? `  ·  ${formatDateBr(item.releaseDate)}` : ''}
          </Text>
          {st.filtered ? <Text style={styles.filterInline}>filtro</Text> : null}
        </View>
        <View style={{ marginTop: 6 }}>
          <ProgressBar value={st.owned} total={st.total} height={4} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  code: {
    backgroundColor: '#000',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 3,
    minWidth: 46,
    alignItems: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#3a3a3a',
  },
  codeSm: { paddingHorizontal: 4, paddingVertical: 1, minWidth: 0, borderRadius: 3 },
  codeText: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.5 },
  codeTextSm: { fontSize: 10 },

  tile: { backgroundColor: colors.surface, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  tileTint: { backgroundColor: 'rgba(17,18,28,0.35)' },
  tileLogo: { position: 'absolute', top: 10, left: 10, right: 10, bottom: 86 },
  tileInfo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: 'rgba(14,15,30,0.62)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.18)',
  },
  tileTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  tileDate: { color: colors.textDim, fontSize: 10, fontWeight: '600' },
  tileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  tileName: { color: colors.text, fontWeight: '800', fontSize: 13, flex: 1 },
  statsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 3, marginBottom: 5 },
  sub: { color: colors.textDim, fontSize: 12, flexShrink: 1 },
  pct: { color: colors.text, fontSize: 13, fontWeight: '800' },
  filterBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  rowTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 },
  rowName: { color: colors.text, fontWeight: '700', fontSize: 15, flex: 1 },
  rowBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  filterInline: { color: colors.accent, fontSize: 11, fontWeight: '800' },
});
