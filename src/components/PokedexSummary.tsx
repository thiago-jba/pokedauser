import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatPct } from '../collection';
import type { Basket } from '../evolution';
import { fmtMoney } from '../prices';
import type { Rates } from '../prices';
import { colors } from '../theme';
import { Donut } from './Donut';
import { EvolutionPanel } from './EvolutionPanel';
import { GlassShine } from './Glass';
import { fmtInt } from './SummaryCard';

/**
 * Resumo da Pokédex na tela "Minha Coleção".
 * Progresso: conta cada Pokémon uma vez só (mesmo com várias cartas dele).
 * Valor e evolução: somam todas as cartas adicionadas na Pokédex.
 */
export function PokedexSummary({
  ownedSpecies,
  totalSpecies,
  cardsCount,
  tcg,
  cm,
  rates,
  baskets,
  version,
}: {
  ownedSpecies: number;
  totalSpecies: number;
  cardsCount: number;
  tcg: number;
  cm: number;
  rates: Rates | null;
  baskets: Basket[];
  version: number;
}) {
  const pct = totalSpecies ? (ownedSpecies / totalSpecies) * 100 : 0;
  return (
    <View style={styles.card}>
      <GlassShine r={28} />
      <Text style={styles.kicker}>POKÉDEX</Text>
      <View style={styles.top}>
        <View style={{ flex: 1 }}>
          <Text style={styles.big}>{fmtInt(ownedSpecies)}</Text>
          <Text style={styles.of}>{`de ${fmtInt(totalSpecies)} Pokémon`}</Text>
        </View>
        <Donut pct={pct} size={92} stroke={13} color={colors.gold} track="rgba(255,214,107,0.18)" label={formatPct(pct)} labelColor={colors.text} />
      </View>
      <View style={styles.rows}>
        <Row label="Cartas na Pokédex" value={fmtInt(cardsCount)} />
        <Row
          label="Valor da Pokédex (TCGplayer)"
          value={rates ? fmtMoney(tcg * rates.usd, 'R$') : fmtMoney(tcg, 'US$')}
          hint={`${fmtMoney(tcg, 'US$')} · todas as cartas adicionadas`}
        />
        <Row
          label="Valor da Pokédex (Cardmarket)"
          value={rates ? fmtMoney(cm * rates.eur, 'R$') : fmtMoney(cm, '€')}
          hint={`${fmtMoney(cm, '€')} · todas as cartas adicionadas`}
        />
      </View>
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
  kicker: { color: colors.gold, fontSize: 12, fontWeight: '900', letterSpacing: 1.2, marginBottom: 6 },
  top: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  big: { color: colors.text, fontSize: 44, fontWeight: '900', letterSpacing: -1 },
  of: { color: colors.textDim, fontSize: 15, fontWeight: '700' },
  rows: { marginTop: 14, gap: 10 },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowLabel: { color: colors.text, fontSize: 15, fontWeight: '700' },
  rowHint: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
  rowValue: { color: colors.text, fontSize: 15, fontWeight: '800' },
});
