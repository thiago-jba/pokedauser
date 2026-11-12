import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Alert } from '../alert';
import { artTitle, BOOSTER_SORTS, byArt, groupBoosters } from '../boosters';
import type { BoosterSort } from '../boosters';
import { AddBooster, BOOSTER_RATIO } from '../components/AddBooster';
import { CountryPicker } from '../components/CountryPicker';
import { Flag } from '../components/Flag';
import { GlassShine } from '../components/Glass';
import { SetLogo } from '../components/SetLogo';
import { loadSetsCacheAnyAge } from '../storage';
import { ValueSummary } from '../components/ValueSummary';
import { boosterBasket, boosterPrice, refreshBoosterPrices } from '../boosterPrices';
import { cachedRates, fmtMoney, getRates } from '../prices';
import type { Rates } from '../prices';
import { TAB_BAR_SPACE } from '../components/TabBar';
import { countryName } from '../countries';
import { useAppDimensions } from '../dimensions';
import type { BoosterEntry } from '../storage';
import { useStore } from '../store';
import { colors } from '../theme';

/** Coleção de boosters (pacotes), agrupados por expansão. Separada das outras coleções. */
export function BoostersScreen() {
  const insets = useSafeAreaInsets();
  const { width } = useAppDimensions();
  const { data, removeBooster, setBoosterCountry, setBoostersSort, toggleBoosterSet, setBoostersCollapsed } = useStore();
  const [sorting, setSorting] = useState(false);
  const sort = (BOOSTER_SORTS.some((o) => o.value === data.boostersSort) ? data.boostersSort : 'recentes') as BoosterSort;
  const collapsed = new Set(data.boostersCollapsed ?? []);
  const [adding, setAdding] = useState<{ setId?: string } | null>(null);
  const [detail, setDetail] = useState<BoosterEntry | null>(null);
  const [picking, setPicking] = useState(false);
  const list = data.boosters ?? [];

  // preços (TCGplayer, 1x por dia) e cotação do dólar
  const [priceVersion, setPriceVersion] = useState(0);
  const [rates, setRates] = useState<Rates | null>(() => cachedRates());
  useEffect(() => {
    let alive = true;
    getRates().then((r) => alive && r && setRates(r));
    refreshBoosterPrices()
      .then((changed) => alive && changed && setPriceVersion((v) => v + 1))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);
  const money = (usd: number) => (rates ? fmtMoney(usd * rates.usd, 'R$') : fmtMoney(usd, 'US$'));
  const value = useMemo(() => {
    let usd = 0;
    let priced = 0;
    for (const b of list) {
      const p = boosterPrice(b.setId);
      if (p) {
        usd += p;
        priced++;
      }
    }
    return { usd, priced, baskets: boosterBasket(list) };
  }, [list, priceVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  // expansões na ordenação escolhida (data de lançamento: a salva no booster ou a da expansão em "Coleção")
  const groups = useMemo(
    () => groupBoosters(list, sort, (id) => data.collections.find((c) => c.setId === id)?.releaseDate),
    [list, sort, data.collections],
  );
  // logo de cada expansão (lista de expansões guardada no aparelho)
  const setInfo = useMemo(() => new Map((loadSetsCacheAnyAge() ?? []).map((x) => [x.id, x])), [list.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const allCollapsed = groups.length > 0 && groups.every((g) => collapsed.has(g.setId));
  const countries = new Set(list.map((b) => b.country)).size;

  const cols = width >= 900 ? 7 : width >= 600 ? 5 : 4;
  const gap = 10;
  const tile = (width - 16 * 2 - 28 - gap * (cols - 1)) / cols;
  const current = detail ? list.find((b) => b.uid === detail.uid) ?? null : null;

  // um booster: imagem com a bandeira; na visão por estampa, o nome do país embaixo
  const renderTile = (b: BoosterEntry, showCountry: boolean) => (
    <Pressable key={b.uid} style={{ width: tile }} onPress={() => setDetail(b)}>
      <View style={[styles.frame, { height: tile * BOOSTER_RATIO }]}>
        {b.image ? <Image source={{ uri: b.image }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="disk" /> : null}
        <View style={styles.flag}>
          <Flag code={b.country} size={14} />
        </View>
      </View>
      <Text style={styles.artName} numberOfLines={2}>
        {showCountry ? countryName(b.country) : artTitle(b)}
      </Text>
    </Pressable>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + TAB_BAR_SPACE }}>
        <Text style={styles.h1}>Boosters</Text>
        {list.length ? (
          <View style={styles.summary}>
            <GlassShine r={24} />
            <Stat value={list.length} label={list.length === 1 ? 'booster' : 'boosters'} />
            <Stat value={groups.length} label={groups.length === 1 ? 'expansão' : 'expansões'} />
            <Stat value={countries} label={countries === 1 ? 'país' : 'países'} />
          </View>
        ) : null}
        {list.length ? (
          <ValueSummary
            kicker="VALOR DOS BOOSTERS"
            countLabel={value.priced < list.length ? `Boosters (${value.priced} com preço)` : 'Boosters'}
            count={list.length}
            tcg={value.usd}
            rates={rates}
            baskets={value.baskets}
            version={priceVersion}
            hint="preço do booster de cada expansão"
            itemWord="boosters"
          />
        ) : null}
        <Pressable style={styles.addBtn} onPress={() => setAdding({})}>
          <Text style={styles.addText}>+ Adicionar booster</Text>
          <Text style={styles.addSub}>escolha a expansão e a estampa do pacote</Text>
        </Pressable>
        {!list.length ? <Text style={styles.empty}>Nenhum booster ainda. Toque em “Adicionar booster” para começar.</Text> : null}
        {list.length ? (
          <>
            <View style={styles.toolRow}>
              <Pressable style={styles.sortPill} onPress={() => setSorting(true)}>
                <Text style={styles.sortText} numberOfLines={1}>{`⇅ ${BOOSTER_SORTS.find((o) => o.value === sort)?.label}`}</Text>
              </Pressable>
              <Pressable style={styles.sortPill} onPress={() => setBoostersCollapsed(allCollapsed ? [] : groups.map((g) => g.setId))}>
                <Text style={styles.sortText}>{allCollapsed ? '▾ Mostrar todas' : '▸ Recolher todas'}</Text>
              </Pressable>
            </View>
            <Text style={styles.hint}>Toque no nome da expansão para recolher ou mostrar; toque num booster para trocar o país ou remover.</Text>
          </>
        ) : null}

        {groups.map((g) => (
          <View key={g.setId} style={styles.group}>
            <GlassShine r={22} />
            <View style={[styles.groupHead, collapsed.has(g.setId) && { marginBottom: 0 }]}>
              <Pressable style={styles.groupToggle} onPress={() => toggleBoosterSet(g.setId)} hitSlop={6}>
                <Text style={styles.arrow}>{collapsed.has(g.setId) ? '▸' : '▾'}</Text>
                <SetLogo setId={g.setId} logo={setInfo.get(g.setId)?.logo} symbol={setInfo.get(g.setId)?.symbol} style={styles.groupLogo} />
                <Text style={styles.groupName} numberOfLines={2}>
                  {g.setName}
                </Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.groupCount}>{g.items.length}</Text>
                  {boosterPrice(g.setId) ? <Text style={styles.groupValue}>{money(boosterPrice(g.setId)! * g.items.length)}</Text> : null}
                </View>
              </Pressable>
              <Pressable onPress={() => setAdding({ setId: g.setId })} hitSlop={8} style={styles.plus}>
                <Text style={styles.plusText}>+</Text>
              </Pressable>
            </View>
            {collapsed.has(g.setId) ? null : sort === 'estampa' ? (
              <View style={{ gap: 14 }}>
                {byArt(g.items).map((a) => (
                  <View key={a.file}>
                    <Text style={styles.artRowTitle} numberOfLines={1}>
                      {`${artTitle(a.items[0])} · ${a.items.length} ${a.items.length === 1 ? 'booster' : 'boosters'}`}
                    </Text>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>{a.items.map((b) => renderTile(b, true))}</View>
                  </View>
                ))}
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>{g.items.map((b) => renderTile(b, false))}</View>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal visible={sorting} transparent animationType="fade" onRequestClose={() => setSorting(false)}>
        <Pressable style={styles.backdrop} onPress={() => setSorting(false)}>
          <View style={styles.sheet}>
            <Text style={styles.sortTitle}>Ordenar expansões</Text>
            {BOOSTER_SORTS.map((o) => (
              <Pressable
                key={o.value}
                style={styles.sortItem}
                onPress={() => {
                  setBoostersSort(o.value);
                  setSorting(false);
                }}
              >
                <Text style={[styles.sortItemText, o.value === sort && { color: colors.accent, fontWeight: '900' }]}>
                  {`${o.value === sort ? '● ' : ''}${o.label}`}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
      <AddBooster visible={!!adding} initialSetId={adding?.setId} onClose={() => setAdding(null)} />

      <Modal visible={!!current} transparent animationType="fade" onRequestClose={() => setDetail(null)}>
        <Pressable style={styles.backdrop} onPress={() => setDetail(null)}>
          {current ? (
            <Pressable style={styles.sheet} onPress={() => {}}>
              {current.image ? (
                <Image source={{ uri: current.image }} style={{ width: 170, height: 170 * BOOSTER_RATIO, alignSelf: 'center' }} contentFit="contain" cachePolicy="disk" />
              ) : null}
              <Text style={styles.detailTitle}>{artTitle(current)}</Text>
              <Text style={styles.detailSub}>{current.setName}</Text>
              <Text style={styles.detailPrice}>
                {boosterPrice(current.setId)
                  ? `Booster desta expansão: ${money(boosterPrice(current.setId)!)} (TCGplayer, preço de mercado)`
                  : 'Sem preço do TCGplayer para o booster desta expansão.'}
              </Text>
              <Pressable style={styles.countryBtn} onPress={() => setPicking(true)}>
                <Flag code={current.country} size={20} />
                <Text style={styles.countryText}>{countryName(current.country)}</Text>
                <Text style={styles.chevron}>trocar ›</Text>
              </Pressable>
              <View style={styles.actions}>
                <Pressable
                  style={styles.btn}
                  onPress={() =>
                    Alert.alert('Remover booster', `Remover "${artTitle(current)}" (${countryName(current.country)}) da coleção?`, [
                      { text: 'Cancelar', style: 'cancel' },
                      {
                        text: 'Remover',
                        style: 'destructive',
                        onPress: () => {
                          removeBooster(current.uid);
                          setDetail(null);
                        },
                      },
                    ])
                  }
                >
                  <Text style={{ color: colors.accent, fontWeight: '800' }}>Remover</Text>
                </Pressable>
                <Pressable style={[styles.btn, { backgroundColor: colors.surface2 }]} onPress={() => setDetail(null)}>
                  <Text style={{ color: colors.text, fontWeight: '800' }}>Fechar</Text>
                </Pressable>
              </View>
            </Pressable>
          ) : null}
        </Pressable>
      </Modal>
      <CountryPicker
        visible={picking}
        current={current?.country}
        onPick={(code) => current && setBoosterCountry(current.uid, code)}
        onClose={() => setPicking(false)}
      />
    </View>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  h1: { color: colors.text, fontSize: 30, fontWeight: '900', letterSpacing: -0.5, marginBottom: 12 },
  summary: {
    flexDirection: 'row',
    padding: 16,
    marginBottom: 12,
    borderRadius: 24,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  statValue: { color: colors.gold, fontSize: 26, fontWeight: '900' },
  statLabel: { color: colors.textDim, fontSize: 12 },
  addBtn: { marginBottom: 12, padding: 14, borderRadius: 20, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent, alignItems: 'center' },
  addText: { color: colors.text, fontWeight: '900', fontSize: 16 },
  addSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 20, paddingHorizontal: 24 },
  hint: { color: colors.textFaint, fontSize: 12, marginBottom: 8 },
  group: {
    padding: 14,
    marginBottom: 12,
    borderRadius: 22,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  groupHead: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  groupToggle: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  arrow: { color: colors.textDim, fontSize: 14, width: 14 },
  groupLogo: { width: 96, height: 40 },
  groupName: { color: colors.text, fontSize: 16, fontWeight: '900', flex: 1 },
  toolRow: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  sortPill: {
    flexShrink: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  sortText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  artRowTitle: { color: colors.text, fontSize: 13, fontWeight: '800', marginBottom: 6 },
  sortTitle: { color: colors.text, fontSize: 18, fontWeight: '900', marginBottom: 8 },
  sortItem: { paddingVertical: 11 },
  sortItemText: { color: colors.text, fontSize: 15 },
  groupCount: { color: colors.gold, fontWeight: '900' },
  groupValue: { color: colors.textDim, fontSize: 11, fontWeight: '700' },
  detailPrice: { color: colors.textDim, textAlign: 'center', fontSize: 12, marginTop: -6, marginBottom: 12 },
  plus: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.surface2, alignItems: 'center', justifyContent: 'center' },
  plusText: { color: colors.text, fontSize: 18, fontWeight: '900', marginTop: -2 },
  frame: { borderRadius: 8, overflow: 'hidden', backgroundColor: 'rgba(0,0,0,0.15)' },
  flag: { position: 'absolute', top: 4, right: 4, backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 6, paddingHorizontal: 3, paddingVertical: 1 },
  artName: { color: colors.textDim, fontSize: 11, marginTop: 4, textAlign: 'center', fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 24 },
  sheet: { backgroundColor: colors.sheet, borderRadius: 24, padding: 18, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, maxWidth: 420, width: '100%', alignSelf: 'center' },
  detailTitle: { color: colors.text, fontSize: 20, fontWeight: '900', textAlign: 'center', marginTop: 12 },
  detailSub: { color: colors.textDim, textAlign: 'center', marginTop: 2, marginBottom: 12 },
  countryBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 14,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  countryText: { color: colors.text, fontWeight: '700', flex: 1 },
  chevron: { color: colors.textFaint, fontSize: 13 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 16 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999, backgroundColor: colors.surface },
});
