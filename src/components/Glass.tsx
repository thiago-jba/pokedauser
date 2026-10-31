import React from 'react';
import { StyleProp, StyleSheet, View, ViewStyle } from 'react-native';
import { colors, radius } from '../theme';

/**
 * Painel de "vidro": fundo translúcido, borda clara fina e um reflexo suave na parte de cima.
 * O fundo colorido do app aparece através dele.
 */
export function Glass({
  children,
  style,
  strong,
  r = radius.lg,
}: {
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  strong?: boolean;
  r?: number;
}) {
  return (
    <View
      style={[
        styles.base,
        { borderRadius: r, backgroundColor: strong ? colors.surface2 : colors.surface },
        style,
      ]}
    >
      <GlassShine r={r} />
      {children}
    </View>
  );
}

/** Reflexo de luz na metade de cima de um painel de vidro (pode ser usado em qualquer View com overflow hidden). */
export function GlassShine({ r = radius.lg }: { r?: number }) {
  return (
    <>
      <View
        pointerEvents="none"
        style={[styles.shine, { borderTopLeftRadius: r, borderTopRightRadius: r }]}
      />
      <View pointerEvents="none" style={[styles.edge, { borderRadius: r }]} />
    </>
  );
}

const styles = StyleSheet.create({
  base: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  shine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '45%',
    backgroundColor: colors.highlight,
    opacity: 0.55,
  },
  edge: {
    ...StyleSheet.absoluteFillObject,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.28)',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: 'rgba(255,255,255,0.14)',
  },
});
