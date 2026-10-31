import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

/**
 * Gráfico de rosca (percentual) feito só com Views, sem biblioteca de desenho:
 * duas meias-argolas giradas, cada uma recortada por uma metade do círculo.
 */
export function Donut({
  pct,
  size = 96,
  stroke = 14,
  color,
  track,
  label,
  labelColor,
}: {
  pct: number;
  size?: number;
  stroke?: number;
  color: string;
  track: string;
  label: string;
  labelColor: string;
}) {
  const p = Math.max(0, Math.min(100, pct));
  const deg = p * 3.6;
  const half = size / 2;
  const ring = { width: size, height: size, borderRadius: half, borderWidth: stroke, position: 'absolute' as const };

  // meia-argola esquerda (lados esquerdo+inferior coloridos, girada 45°): aparece na metade direita ao girar
  const rightDeg = Math.min(deg, 180);
  // meia-argola direita (lados superior+direito coloridos, girada 45°): aparece na metade esquerda depois de 180°
  const leftDeg = Math.max(deg - 180, 0);

  return (
    <View style={{ width: size, height: size }}>
      <View style={[ring, { borderColor: track }]} />

      {p > 0 && (
        <View style={[styles.mask, { left: half, width: half, height: size }]}>
          <View
            style={[
              ring,
              {
                left: -half,
                borderColor: 'transparent',
                borderLeftColor: color,
                borderBottomColor: color,
                transform: [{ rotate: `${45 + rightDeg}deg` }],
              },
            ]}
          />
        </View>
      )}

      {p > 50 && (
        <View style={[styles.mask, { left: 0, width: half, height: size }]}>
          <View
            style={[
              ring,
              {
                left: 0,
                borderColor: 'transparent',
                borderTopColor: color,
                borderRightColor: color,
                transform: [{ rotate: `${45 + leftDeg}deg` }],
              },
            ]}
          />
        </View>
      )}

      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Text style={[styles.label, { color: labelColor, fontSize: size * 0.2 }]}>{label}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mask: { position: 'absolute', top: 0, overflow: 'hidden' },
  center: { alignItems: 'center', justifyContent: 'center' },
  label: { fontWeight: '800' },
});
