import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatPct } from '../collection';
import { colors } from '../theme';
import { Donut } from './Donut';

/** 12345 -> "12.345" */
export const fmtInt = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

/**
 * Resumo geral da coleção na tela inicial.
 * Os números somam todas as coleções, cada uma com o seu último filtro (tipo de carta, raridade).
 */
export function SummaryCard({
  owned,
  total,
  collections,
  complete,
  filteredCount,
  extraRows,
}: {
  owned: number;
  total: number;
  collections: number;
  complete: number;
  filteredCount: number;
  extraRows?: { label: string; value: string; hint?: string }[];
}) {
  const pct = total ? (owned / total) * 100 : 0;
  return (
    <View style={styles.card}>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <View style={styles.bigRow}>
            <Text style={styles.big} numberOfLines={1} adjustsFontSizeToFit>
              {fmtInt(owned)}
            </Text>
            <View style={{ marginLeft: 10, flexShrink: 1 }}>
              <Text style={styles.kicker}>OBTIDAS</Text>
              <Text style={styles.of}>{`de ${fmtInt(total)}`}</Text>
              <Text style={styles.unit}>cartas</Text>
            </View>
          </View>
        </View>
        <Donut pct={pct} size={92} stroke={13} color={colors.accent} track={colors.accentDim} label={formatPct(pct)} labelColor={colors.text} />
      </View>

      <View style={styles.rows}>
        <Row label="Coleções" value={fmtInt(collections)} />
        <Row label="Coleções completas" value={fmtInt(complete)} />
        {extraRows?.map((r) => (
          <Row key={r.label} label={r.label} value={r.value} hint={r.hint} />
        ))}
      </View>
      {filteredCount > 0 ? (
        <Text style={styles.note}>
          {`Considera o último filtro de tipo/raridade de ${filteredCount} ${filteredCount === 1 ? 'coleção' : 'coleções'}.`}
        </Text>
      ) : null}
    </View>
  );
}

function Row({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1 }}>
        <Text style={styles.rowLabel}>{label}</Text>
        {hint ? <Text style={styles.rowHint}>{hint}</Text> : null}
      </View>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 16,
    marginBottom: 6,
  },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bigRow: { flexDirection: 'row', alignItems: 'center' },
  big: { color: colors.text, fontSize: 52, fontWeight: '900', letterSpacing: -1, maxWidth: '60%' },
  kicker: { color: colors.accent, fontSize: 12, fontWeight: '900', letterSpacing: 1.2 },
  of: { color: colors.text, fontSize: 20, fontWeight: '800' },
  unit: { color: colors.textDim, fontSize: 13 },
  rows: { marginTop: 16, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowHint: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
  rowValue: { color: colors.text, fontSize: 15, fontWeight: '800' },
  note: { color: colors.textFaint, fontSize: 11, marginTop: 12 },
});
