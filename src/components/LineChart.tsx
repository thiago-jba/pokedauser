import React, { useState } from 'react';
import { LayoutChangeEvent, StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';

/**
 * Gráfico de linha simples, desenhado com Views (segmentos girados), sem biblioteca nativa.
 * Mostra a primeira e a última data embaixo.
 */
export function LineChart({
  points,
  color,
  height = 110,
  formatDate,
}: {
  points: { date: string; value: number }[];
  color: string;
  height?: number;
  formatDate: (iso: string) => string;
}) {
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const pad = 6;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || Math.max(1, max * 0.1);
  const lo = min - span * 0.15;
  const hi = max + span * 0.15;

  const xy = points.map((p, i) => ({
    x: points.length === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (points.length - 1),
    y: pad + (1 - (p.value - lo) / (hi - lo)) * (height - pad * 2),
  }));

  return (
    <View>
      <View style={{ height }} onLayout={onLayout}>
        {/* linhas de grade */}
        {[0.25, 0.5, 0.75].map((f) => (
          <View key={f} style={[styles.grid, { top: f * height }]} />
        ))}
        {width > 0 &&
          xy.slice(1).map((b, i) => {
            const a = xy[i];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            const angle = (Math.atan2(dy, dx) * 180) / Math.PI;
            return (
              <View
                key={i}
                style={{
                  position: 'absolute',
                  left: (a.x + b.x) / 2 - len / 2,
                  top: (a.y + b.y) / 2 - 1.5,
                  width: len,
                  height: 3,
                  borderRadius: 2,
                  backgroundColor: color,
                  transform: [{ rotate: `${angle}deg` }],
                }}
              />
            );
          })}
        {width > 0 &&
          xy.map((p, i) =>
            i === 0 || i === xy.length - 1 || xy.length <= 16 ? (
              <View
                key={`d${i}`}
                style={[
                  styles.dot,
                  { left: p.x - 4, top: p.y - 4, backgroundColor: i === xy.length - 1 ? color : colors.sheet, borderColor: color },
                ]}
              />
            ) : null,
          )}
      </View>
      {points.length > 0 && (
        <View style={styles.axis}>
          <Text style={styles.axisText}>{formatDate(points[0].date)}</Text>
          {points.length > 1 ? <Text style={styles.axisText}>{formatDate(points[points.length - 1].date)}</Text> : null}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.10)' },
  dot: { position: 'absolute', width: 8, height: 8, borderRadius: 4, borderWidth: 2 },
  axis: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4 },
  axisText: { color: colors.textFaint, fontSize: 10 },
});
