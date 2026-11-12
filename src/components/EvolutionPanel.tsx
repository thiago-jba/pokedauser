import React, { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { formatDateBr } from '../eras';
import { evolution } from '../evolution';
import type { Basket, Source } from '../evolution';
import { fmtMoney, loadHistory } from '../prices';
import type { Rates } from '../prices';
import { colors } from '../theme';
import { LineChart } from './LineChart';
import { Segmented } from './ui';

const RANGES = [
  { value: '7', label: '7 dias' },
  { value: '15', label: '15 dias' },
  { value: '30', label: '1 mês' },
  { value: '60', label: '2 meses' },
] as const;
type Range = (typeof RANGES)[number]['value'];

/**
 * Quanto as cartas que eu tenho (com os filtros de cada coleção) valorizaram ou desvalorizaram no período.
 * Usa o histórico diário de preços guardado no celular.
 */
export function EvolutionPanel({
  baskets,
  rates,
  version,
  tcgOnly,
  itemWord = 'cartas',
}: {
  baskets: Basket[];
  rates: Rates | null;
  version: number;
  /** só há preço do TCGplayer (ex.: boosters): esconde a escolha da loja */
  tcgOnly?: boolean;
  itemWord?: string;
}) {
  const [range, setRange] = useState<Range>('30');
  const [source, setSource] = useState<Source>('tcg');

  const evo = useMemo(() => {
    const histories = Object.fromEntries(baskets.map((b) => [b.setId, loadHistory(b.setId)]));
    return evolution(baskets, histories, source, Number(range));
  }, [baskets, source, range, version]);

  const rate = source === 'tcg' ? rates?.usd : rates?.eur;
  const toBrl = (v: number) => (rate ? fmtMoney(v * rate, 'R$') : fmtMoney(v, source === 'tcg' ? 'US$' : '€'));
  const up = evo.delta > 0.004;
  const down = evo.delta < -0.004;
  const tone = up ? colors.success : down ? colors.accent : colors.textDim;
  const sign = up ? '+' : down ? '−' : '';
  const pctTxt = `${sign}${Math.abs(evo.pct).toFixed(1).replace('.', ',')}%`;
  const enough = evo.points.length >= 2;

  return (
    <View style={styles.wrap}>
      <View style={styles.header}>
        <Text style={styles.title}>Evolução do valor</Text>
        {tcgOnly ? <Text style={styles.sub}>TCGplayer</Text> : (
        <Segmented<Source>
          style={{ width: 170 }}
          value={source}
          onChange={setSource}
          options={[
            { value: 'tcg', label: 'TCGplayer' },
            { value: 'cm', label: 'Cardmarket' },
          ]}
        />
        )}
      </View>

      <Segmented<Range> value={range} onChange={setRange} options={RANGES.map((r) => ({ value: r.value, label: r.label }))} />

      {enough ? (
        <>
          <View style={styles.deltaRow}>
            <Text style={[styles.delta, { color: tone }]}>
              {sign}
              {toBrl(Math.abs(evo.delta))}
            </Text>
            <View style={[styles.pill, { backgroundColor: up ? 'rgba(69,224,160,0.18)' : down ? 'rgba(255,90,110,0.18)' : colors.surface2 }]}>
              <Text style={[styles.pillText, { color: tone }]}>{pctTxt}</Text>
            </View>
          </View>
          <Text style={styles.sub}>{`${toBrl(evo.start)} → ${toBrl(evo.end)} · ${evo.itemsCounted} ${itemWord} com preço`}</Text>
          <View style={{ marginTop: 10 }}>
            <LineChart points={evo.points} color={up ? colors.success : down ? colors.accent : colors.gold} formatDate={(d) => formatDateBr(d).slice(0, 5)} />
          </View>
          {evo.coveredDays < Number(range) ? (
            <Text style={styles.note}>{`O histórico começou em ${formatDateBr(evo.startDate)}: este período ainda tem ${evo.coveredDays} de ${range} dias.`}</Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.empty}>
          {evo.points.length === 1
            ? `O app começou a guardar os preços em ${formatDateBr(evo.startDate)}. A partir de amanhã o gráfico mostra quanto suas ${itemWord} subiram ou caíram.`
            : 'Os preços ainda não foram baixados. Abra uma coleção ou use ⋮ → Atualizar preços para começar o histórico.'}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: 16, paddingTop: 14, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, gap: 10 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  title: { color: colors.text, fontSize: 15, fontWeight: '800', flex: 1 },
  deltaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 2 },
  delta: { fontSize: 26, fontWeight: '900' },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontWeight: '800', fontSize: 13 },
  sub: { color: colors.textDim, fontSize: 12 },
  note: { color: colors.textFaint, fontSize: 11 },
  empty: { color: colors.textDim, fontSize: 12, lineHeight: 18 },
});
