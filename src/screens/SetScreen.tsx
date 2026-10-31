import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchFullSet, StoredCard, StoredSet } from '../api';
import { allCards, applySavedFilters, Entry, formatPct, ownedKey, progress, setEntries } from '../collection';
import { SetCodeBadge } from '../components/CollectionCards';
import { GlassShine } from '../components/Glass';
import { SetLogo } from '../components/SetLogo';
import { eraPt, formatDateBr, parseDateBr } from '../eras';
import {
  cachedRates,
  collectionValue,
  fetchSetPrices,
  fmtMoney,
  getRates,
  loadSetPrices,
  pricesAreStale,
  saveSetPrices,
} from '../prices';
import type { Rates, SetPrices } from '../prices';
import { CardDetail } from '../components/CardDetail';
import { CardTile } from '../components/CardTile';
import { BusyModal, Chip, IconButton, ProgressBar, Segmented } from '../components/ui';
import { loadSet } from '../storage';
import { useStore } from '../store';
import { colors, finishColors } from '../theme';
import { CardVariant, CATEGORY_LABELS, CATEGORY_ORDER, matchesQuery, VariantCategory } from '../variants';

type Status = 'todas' | 'tenho' | 'faltam';

const CATEGORY_COLOR: Partial<Record<VariantCategory, string>> = {
  holo: finishColors.holo.bg,
  reverse: finishColors.reverse.bg,
  reverse_especial: finishColors.special.bg,
};

export function SetScreen({ setId, onBack }: { setId: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isOwned, ownedCountry, toggleOwned, setOwned, upsertCollection, setRarityFilter, setCategoryFilter, patchCollection, data } = useStore();
  const entry = data.collections.find((c) => c.setId === setId);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [setPrices, setSetPrices] = useState<SetPrices | null>(() => loadSetPrices(setId));
  const [priceProgress, setPriceProgress] = useState<string | null>(null);
  const [rates, setRates] = useState<Rates | null>(() => cachedRates());
  const [set, setSet] = useState<StoredSet | null>(() => loadSet(setId));
  const [status, setStatus] = useState<Status>('todas');
  const [rarityPicker, setRarityPicker] = useState(false);
  const [text, setText] = useState('');
  const [detail, setDetail] = useState<StoredCard | null>(null);
  const [busy, setBusy] = useState<{ title: string; done?: number; total?: number } | null>(null);

  const custom = data.custom[setId];
  const allEntries: Entry[] = useMemo(() => (set ? setEntries(set, custom) : []), [set, custom]);

  // filtro de raridade (várias escolhas), lembrado por coleção
  const selectedRarities = useMemo(() => data.filters[setId]?.rarities ?? [], [data.filters, setId]);
  const toggleRarity = (r: string) =>
    setRarityFilter(setId, raritySet.has(r) ? selectedRarities.filter((x) => x !== r) : [...selectedRarities, r]);

  // filtro de tipo de carta (várias escolhas), lembrado por coleção
  const selectedCategories = useMemo(
    () => (data.filters[setId]?.categories ?? []) as VariantCategory[],
    [data.filters, setId],
  );
  const toggleCategory = (c: VariantCategory) =>
    setCategoryFilter(setId, catSet.has(c) ? selectedCategories.filter((x) => x !== c) : [...selectedCategories, c]);

  const catCounts = useMemo(() => {
    const m = new Map<VariantCategory, number>();
    for (const e of allEntries) m.set(e.variant.category, (m.get(e.variant.category) ?? 0) + 1);
    return m;
  }, [allEntries]);

  const rarities = useMemo(() => [...new Set((set ? allCards(set) : []).map((c) => c.rarity ?? 'Sem raridade'))], [set]);
  // tipo + raridade salvos (mesma regra usada na contagem da tela inicial)
  const saved = useMemo(() => applySavedFilters(allEntries, data.filters[setId]), [allEntries, data.filters, setId]);
  const catSet = saved.catSet as Set<VariantCategory>;
  const raritySet = saved.raritySet;

  // Base da contagem: tipo + raridade + texto (o filtro Tenho/Faltam só muda o que aparece na tela,
  // senão "Tenho" daria sempre 100% e "Faltam" sempre 0%).
  const base = useMemo(
    () =>
      saved.list.filter((e) => {
        if (text.trim()) {
          const t = text.trim().replace(/^#/, '');
          if (/^\d+$/.test(t)) {
            if (String(parseInt(e.card.localId, 10)) !== String(parseInt(t, 10)) && e.card.localId !== t) return false;
          } else if (!matchesQuery(`${e.card.name} ${e.variant.label}`, text)) return false;
        }
        return true;
      }),
    [saved, text],
  );

  const filtered = useMemo(
    () =>
      status === 'todas'
        ? base
        : base.filter((e) => {
            const o = isOwned(setId, e.key);
            return status === 'tenho' ? o : !o;
          }),
    [base, status, isOwned, setId],
  );

  const stats = useMemo(() => progress(base, (k) => isOwned(setId, k)), [base, isOwned, setId]);
  const value = useMemo(() => collectionValue(base, (k) => isOwned(setId, k), setPrices), [base, isOwned, setId, setPrices]);

  // preços: atualiza em segundo plano uma vez por dia
  useEffect(() => {
    getRates().then((r) => r && setRates(r));
    if (!set || !pricesAreStale(setPrices)) return;
    let alive = true;
    setPriceProgress('atualizando preços…');
    fetchSetPrices(set, (d, t) => alive && setPriceProgress(`atualizando preços ${d}/${t}`))
      .then((p) => {
        saveSetPrices(setId, p);
        if (alive) setSetPrices(p);
      })
      .catch(() => {})
      .finally(() => alive && setPriceProgress(null));
    return () => {
      alive = false;
    };
  }, [set?.fetchedAt]); // eslint-disable-line react-hooks/exhaustive-deps
  const hasFilter = catSet.size > 0 || raritySet.size > 0 || !!text.trim();

  const onToggle = useCallback((card: StoredCard, v: CardVariant) => toggleOwned(setId, ownedKey(card.id, v.key)), [toggleOwned, setId]);
  const onOpen = useCallback((card: StoredCard) => setDetail(card), []);

  const refresh = async () => {
    const title = 'Atualizando cartas da coleção…';
    setBusy({ title });
    try {
      const full = await fetchFullSet(setId, (done, total) => setBusy({ title, done, total }));
      upsertCollection(full);
      setSet(full);
      setBusy(null);
    } catch {
      setBusy(null);
      Alert.alert('Sem conexão', 'Não foi possível atualizar agora.');
    }
  };

  const bulk = () => {
    const keys = filtered.map((e) => e.key);
    if (!keys.length) return;
    Alert.alert('Marcar em lote', `Aplicar às ${keys.length} cartas que estão na tela agora:`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Desmarcar', onPress: () => setOwned(setId, keys, false) },
      { text: 'Marcar como tenho', onPress: () => setOwned(setId, keys, true) },
    ]);
  };

  if (!set) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 8, alignItems: 'center', justifyContent: 'center' }]}>
        <Text style={{ color: colors.textDim, marginBottom: 16 }}>Os dados desta coleção não estão no celular.</Text>
        <Pressable onPress={refresh} style={styles.retry}>
          <Text style={{ color: '#fff', fontWeight: '700' }}>Baixar novamente</Text>
        </Pressable>
        <Pressable onPress={onBack} style={{ marginTop: 16 }}>
          <Text style={{ color: colors.textDim }}>Voltar</Text>
        </Pressable>
        <BusyModal visible={!!busy} title={busy?.title ?? ''} done={busy?.done} total={busy?.total} />
      </View>
    );
  }

  const cols = width >= 600 ? 5 : 3;
  const tileW = (width - 16 * 2 - cols * 8) / cols;
  const rarityLabel =
    selectedRarities.length === 0 ? 'Raridade ▾' : selectedRarities.length === 1 ? selectedRarities[0] : `${selectedRarities.length} raridades`;

  const header = (
    <View>
      <View style={styles.summary}>
        <GlassShine r={24} />
        <SetLogo setId={set.id} logo={set.logo} symbol={set.symbol} style={styles.logo} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' }}>
            <Text style={styles.summaryBig}>{`${stats.owned} de ${stats.total}`}</Text>
            <Text style={[styles.pct, stats.pct >= 100 && { color: colors.gold }]}>{formatPct(stats.pct)}</Text>
          </View>
          <Text style={styles.summarySub}>{hasFilter ? 'cartas com os filtros aplicados' : 'cartas no master set'}</Text>
          <View style={{ marginTop: 8 }}>
            <ProgressBar value={stats.owned} total={stats.total} height={8} />
          </View>
        </View>
      </View>

      <View style={styles.valueBox}>
        <GlassShine r={20} />
        <View style={{ flex: 1 }}>
          <Text style={styles.valueLabel}>{hasFilter ? 'Valor do que tenho (com filtros)' : 'Valor do que tenho'}</Text>
          <Text style={styles.valueHint}>
            {priceProgress ??
              (value.ownedCount === 0
                ? 'marque cartas para ver o valor'
                : `${value.priced} de ${value.ownedCount} com preço · menor preço anunciado`)}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.valueLine}>
            <Text style={styles.valueSrc}>TCGplayer </Text>
            {rates && value.tcg ? fmtMoney(value.tcg * rates.usd, 'R$') : fmtMoney(value.tcg || undefined, 'US$')}
          </Text>
          <Text style={styles.valueLine}>
            <Text style={styles.valueSrc}>Cardmarket </Text>
            {rates && value.cm ? fmtMoney(value.cm * rates.eur, 'R$') : fmtMoney(value.cm || undefined, '€')}
          </Text>
        </View>
      </View>

      <View style={styles.infoRow}>
        <SetCodeBadge code={entry?.code ?? set.code} />
        <Text style={styles.infoEra} numberOfLines={1}>
          {eraPt(entry?.serieName ?? set.serieName)}
        </Text>
        <Pressable
          style={styles.infoDate}
          hitSlop={6}
          onPress={() => setEditingDate(formatDateBr(entry?.releaseDate ?? set.releaseDate))}
        >
          <Text style={styles.infoDateLabel}>Lançamento</Text>
          <Text style={styles.infoDateValue}>
            {formatDateBr(entry?.releaseDate ?? set.releaseDate) || 'definir'} ✎
          </Text>
        </Pressable>
      </View>

      <View style={styles.searchBox}>
        <GlassShine r={999} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Filtrar por nome ou número"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
          autoCorrect={false}
        />
        {text ? (
          <Pressable onPress={() => setText('')} hitSlop={10}>
            <Text style={{ color: colors.textDim, fontSize: 16 }}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      <Text style={styles.label}>Tipo de carta · pode escolher vários</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }} style={{ marginBottom: 10 }}>
        <Chip label="Todas" count={allEntries.length} active={catSet.size === 0} onPress={() => setCategoryFilter(setId, [])} />
        {CATEGORY_ORDER.filter((c) => catCounts.has(c)).map((c) => (
          <Chip
            key={c}
            label={CATEGORY_LABELS[c]}
            count={catCounts.get(c)}
            active={catSet.has(c)}
            check
            color={CATEGORY_COLOR[c]}
            onPress={() => toggleCategory(c)}
          />
        ))}
      </ScrollView>

      <View style={styles.row}>
        <Segmented<Status>
          style={{ flex: 1 }}
          value={status}
          onChange={setStatus}
          options={[
            { value: 'todas', label: 'Todas' },
            { value: 'tenho', label: 'Tenho' },
            { value: 'faltam', label: 'Faltam' },
          ]}
        />
        <Pressable onPress={() => setRarityPicker(true)} style={[styles.rarityBtn, selectedRarities.length > 0 && { borderColor: colors.accent }]}>
          <Text style={styles.rarityText} numberOfLines={1}>
            {rarityLabel}
          </Text>
        </Pressable>
      </View>

      <View style={styles.countRow}>
        <Text style={styles.countText}>{`${filtered.length} na tela · toque para marcar, segure para ver detalhes`}</Text>
        <Pressable onPress={bulk} hitSlop={8}>
          <Text style={styles.bulk}>Lote</Text>
        </Pressable>
      </View>
    </View>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.topBar}>
        <IconButton label="←" onPress={onBack} accessibilityLabel="Voltar" />
        <View style={{ flex: 1, marginHorizontal: 12 }}>
          <Text style={styles.title} numberOfLines={1}>
            {set.namePt ?? set.nameEn}
          </Text>
          {set.namePt && set.namePt !== set.nameEn ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {set.nameEn}
            </Text>
          ) : null}
        </View>
        <IconButton label="⟳" onPress={refresh} accessibilityLabel="Atualizar coleção" />
      </View>

      <FlatList
        data={filtered}
        key={cols}
        numColumns={cols}
        keyExtractor={(e) => e.key}
        extraData={data.owned}
        ListHeaderComponent={header}
        columnWrapperStyle={{ paddingHorizontal: 12 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        initialNumToRender={18}
        windowSize={7}
        removeClippedSubviews
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma carta com esses filtros.</Text>}
        renderItem={({ item }) => (
          <CardTile card={item.card} variant={item.variant} country={ownedCountry(setId, item.key)} width={tileW} onToggle={onToggle} onOpen={onOpen} />
        )}
      />

      <Modal visible={rarityPicker} transparent animationType="fade" onRequestClose={() => setRarityPicker(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setRarityPicker(false)}>
          <Pressable style={styles.picker} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Raridades</Text>
            <Text style={styles.pickerHint}>Escolha uma ou mais. Fica salvo para esta coleção.</Text>
            <ScrollView>
              {rarities.map((r) => {
                const on = raritySet.has(r);
                const n = allEntries.filter((e) => (e.card.rarity ?? 'Sem raridade') === r).length;
                return (
                  <Pressable key={r} style={styles.pickerItem} onPress={() => toggleRarity(r)}>
                    <View style={[styles.checkbox, on && styles.checkboxOn]}>{on ? <Text style={styles.checkboxTick}>✓</Text> : null}</View>
                    <Text style={[styles.pickerText, on && { color: colors.text, fontWeight: '700' }]}>{r}</Text>
                    <Text style={styles.pickerCount}>{n}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <View style={styles.pickerActions}>
              <Pressable onPress={() => setRarityFilter(setId, [])} style={styles.pickerBtn}>
                <Text style={{ color: colors.textDim, fontWeight: '700' }}>Limpar</Text>
              </Pressable>
              <Pressable onPress={() => setRarityPicker(false)} style={[styles.pickerBtn, { backgroundColor: colors.accent }]}>
                <Text style={{ color: '#fff', fontWeight: '700' }}>Pronto</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={editingDate !== null} transparent animationType="fade" onRequestClose={() => setEditingDate(null)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setEditingDate(null)}>
          <Pressable style={[styles.picker, { paddingHorizontal: 18 }]} onPress={() => {}}>
            <Text style={[styles.pickerTitle, { paddingHorizontal: 0 }]}>Data de lançamento</Text>
            <Text style={[styles.pickerHint, { paddingHorizontal: 0 }]}>
              Vem da TCGdex (lançamento oficial). Se a data no Brasil for outra, corrija aqui (DD/MM/AAAA).
            </Text>
            <TextInput
              value={editingDate ?? ''}
              onChangeText={setEditingDate}
              placeholder="16/09/2026"
              placeholderTextColor={colors.textFaint}
              keyboardType="numbers-and-punctuation"
              style={styles.dateInput}
              autoFocus
            />
            <View style={[styles.pickerActions, { paddingHorizontal: 0 }]}>
              <Pressable onPress={() => setEditingDate(null)} style={styles.pickerBtn}>
                <Text style={{ color: colors.textDim, fontWeight: '700' }}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => {
                  const iso = parseDateBr(editingDate ?? '');
                  if (!iso) {
                    Alert.alert('Data inválida', 'Use o formato DD/MM/AAAA, por exemplo 16/09/2026.');
                    return;
                  }
                  patchCollection(setId, { releaseDate: iso, releaseDateManual: true });
                  setEditingDate(null);
                }}
                style={[styles.pickerBtn, { backgroundColor: colors.accent }]}
              >
                <Text style={{ color: '#fff', fontWeight: '700' }}>Salvar</Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      <CardDetail set={set} card={detail} onClose={() => setDetail(null)} />
      <BusyModal visible={!!busy} title={busy?.title ?? ''} done={busy?.done} total={busy?.total} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'transparent' },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  title: { color: colors.text, fontSize: 19, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: 12 },
  summary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginHorizontal: 16,
    padding: 16,
    backgroundColor: colors.surface,
    borderRadius: 24,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
    marginBottom: 12,
  },
  logo: { width: 96, height: 48 },
  summaryBig: { color: colors.text, fontSize: 20, fontWeight: '800' },
  pct: { color: colors.accent, fontSize: 20, fontWeight: '800' },
  summarySub: { color: colors.textDim, fontSize: 12 },
  valueBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginTop: -4,
    marginBottom: 12,
    padding: 14,
    backgroundColor: colors.surface,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  valueLabel: { color: colors.text, fontWeight: '800', fontSize: 13 },
  valueHint: { color: colors.textFaint, fontSize: 11, marginTop: 2 },
  valueLine: { color: colors.text, fontWeight: '800', fontSize: 13 },
  valueSrc: { color: colors.textFaint, fontWeight: '600', fontSize: 11 },
  infoRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginTop: -4, marginBottom: 12 },
  infoEra: { color: colors.gold, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5, flex: 1 },
  infoDate: { alignItems: 'flex-end' },
  infoDateLabel: { color: colors.textFaint, fontSize: 10 },
  infoDateValue: { color: colors.text, fontSize: 13, fontWeight: '700' },
  dateInput: {
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 18,
    marginTop: 6,
  },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 16,
    backgroundColor: colors.surface,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 11 },
  label: { color: colors.textFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginHorizontal: 16, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16 },
  rarityBtn: { maxWidth: 140, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, backgroundColor: colors.surface },
  rarityText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  countRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, marginBottom: 6 },
  countText: { color: colors.textFaint, fontSize: 12, flex: 1 },
  bulk: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40 },
  retry: { backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 32 },
  picker: { backgroundColor: colors.sheet, borderRadius: 24, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, maxHeight: '75%', paddingTop: 16, paddingBottom: 12 },
  pickerTitle: { color: colors.text, fontSize: 17, fontWeight: '800', paddingHorizontal: 18 },
  pickerHint: { color: colors.textDim, fontSize: 12, paddingHorizontal: 18, marginTop: 2, marginBottom: 8 },
  pickerItem: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingVertical: 11, gap: 12 },
  pickerText: { color: colors.textDim, fontSize: 15, flex: 1 },
  pickerCount: { color: colors.textFaint, fontSize: 13 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  checkboxOn: { backgroundColor: colors.accent, borderColor: colors.accent },
  checkboxTick: { color: '#fff', fontWeight: '900', fontSize: 13 },
  pickerActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, paddingHorizontal: 18, paddingTop: 10 },
  pickerBtn: { paddingHorizontal: 18, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.surface },
});
