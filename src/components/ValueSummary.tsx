import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { Basket } from '../evolution';
import { fmtMoney } from '../prices';
import type { Rates } from '../prices';
import { colors } from '../theme';
import { EvolutionPanel } from './EvolutionPanel';
import { GlassShine } from './Glass';
import { fmtInt } from './SummaryCard';

/** Quadro de valor (TCGplayer e Cardmarket em R$) com o gráfico de evolução. Usado nas Coleções Especiais. */
export function ValueSummary({
  kicker,
  countLabel,
  count,
  tcg,
  cm,
  rates,
  baskets,
  version,
  hint,
  extra,
}: {
  kicker: string;
  countLabel: string;
  count: number;
  tcg: number;
  cm: number;
  rates: Rates | null;
  baskets: Basket[];
  version: number;
  hint: string;
  extra?: React.ReactNode;
}) {
  return (
    <View style={styles.card}>
      <GlassShine r={28} />
      <Text style={styles.kicker}>{kicker}</Text>
      <View style={styles.rows}>
        <Row label={countLabel} value={fmtInt(count)} />
        <Row label="Valor (TCGplayer)" value={rates ? fmtMoney(tcg * rates.usd, 'R$') : fmtMoney(tcg, 'US$')} hint={`${fmtMoney(tcg, 'US$')} · ${hint}`} />
        <Row label="Valor (Cardmarket)" value={rates ? fmtMoney(cm * rates.eur, 'R$') : fmtMoney(cm, '€')} hint={`${fmtMoney(cm, '€')} · ${hint}`} />
      </View>
      {extra}
      <EvolutionPanel baskets={baskets} rates={rates} version={version} />
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
    borderRadius: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    padding: 18,
    marginTop: 6,
    marginBottom: 6,
  },
  kicker: { color: colors.gold, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, marginBottom: 2 },
  rows: { marginTop: 10, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowHint: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
  rowValue: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
