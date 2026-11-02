import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAppDimensions } from '../dimensions';
import { Alert } from '../alert';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchFullSet, StoredCard, StoredSet } from '../api';
import { allCards, applySavedFilters, Entry, formatPct, modeOf, ownedKey, progress, setEntries } from '../collection';
import { SetCodeBadge } from '../components/CollectionCards';
import { GlassShine } from '../components/Glass';
import { SetLogo } from '../components/SetLogo';
import { CARD_SORTS, cardSortLabel, normalizeCardSort, sortEntries } from '../cardSort';
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
  const { width } = useAppDimensions();
  const { isOwned, ownedCountry, toggleOwned, setOwned, upsertCollection, setRarityFilter, setCategoryFilter, setCardSort, patchCollection, prefsFor, setSetMode, excludeVariants, restoreExcluded, data } = useStore();
  const [bulkOpen, setBulkOpen] = useState(false);
  const [modePicker, setModePicker] = useState(false);
  const entry = data.collections.find((c) => c.setId === setId);
  const [editingDate, setEditingDate] = useState<string | null>(null);
  const [setPrices, setSetPrices] = useState<SetPrices | null>(() => loadSetPrices(setId));
  const [priceProgress, setPriceProgress] = useState<string | null>(null);
  const [rates, setRates] = useState<Rates | null>(() => cachedRates());
  const [set, setSet] = useState<StoredSet | null>(() => loadSet(setId));
  const [status, setStatus] = useState<Status>('todas');
  const [rarityPicker, setRarityPicker] = useState(false);
  const [sortPicker, setSortPicker] = useState(false);
  const [text, setText] = useState('');
  const [detail, setDetail] = useState<StoredCard | null>(null);
  const [busy, setBusy] = useState<{ title: string; done?: number; total?: number } | null>(null);

  const prefs = useMemo(() => prefsFor(setId), [prefsFor, setId]);
  const allEntries: Entry[] = useMemo(() => (set ? setEntries(set, prefs) : []), [set, prefs]);

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
  const matchText = useCallback(
    (e: Entry) => {
      if (!text.trim()) return true;
      const t = text.trim().replace(/^#/, '');
      if (/^\d+$/.test(t)) return String(parseInt(e.card.localId, 10)) === String(parseInt(t, 10)) || e.card.localId === t;
      return matchesQuery(`${e.card.name} ${e.variant.label}`, text);
    },
    [text],
  );
  const base = useMemo(() => saved.list.filter(matchText), [saved, matchText]);

  // Números ao lado de cada filtro: consideram os OUTROS filtros aplicados.
  // Ex.: com 5 raridades escolhidas, o "Normal" mostra quantas Normais existem nessas raridades.
  const rarityOk = (e: Entry) => !raritySet.size || raritySet.has(e.card.rarity ?? 'Sem raridade');
  const catOk = (e: Entry) => !catSet.size || catSet.has(e.variant.category);
  const chipCounts = useMemo(() => {
    const m = new Map<VariantCategory, number>();
    let all = 0;
    for (const e of allEntries) {
      if (!rarityOk(e) || !matchText(e)) continue;
      all++;
      m.set(e.variant.category, (m.get(e.variant.category) ?? 0) + 1);
    }
    return { m, all };
  }, [allEntries, raritySet, matchText]); // eslint-disable-line react-hooks/exhaustive-deps
  const rarityCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const e of allEntries) {
      if (!catOk(e) || !matchText(e)) continue;
      const r = e.card.rarity ?? 'Sem raridade';
      m.set(r, (m.get(r) ?? 0) + 1);
    }
    return m;
  }, [allEntries, catSet, matchText]); // eslint-disable-line react-hooks/exhaustive-deps

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

  // ordenação das cartas (lembrada por coleção); por valor só quando a coleção tem preços
  const hasPrices = !!setPrices && Object.keys(setPrices.cards).length > 0;
  const savedSort = normalizeCardSort(data.filters[setId]?.sort);
  const cardSort = CARD_SORTS.find((o) => o.value === savedSort)?.needsPrice && !hasPrices ? 'num_asc' : savedSort;
  const shown = useMemo(
    () => sortEntries(filtered, cardSort, (e) => setPrices?.cards[e.card.id]?.[e.variant.key]),
    [filtered, cardSort, setPrices],
  );
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
    if (filtered.length) setBulkOpen(true);
  };
  const bulkKeys = () => filtered.map((e) => e.key);
  const hiddenCount = (prefs.excluded ?? []).length;

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

  const cols = width >= 900 ? 6 : width >= 600 ? 5 : 3;
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
                : `${value.priced} de ${value.ownedCount} com preço · preço de mercado`)}
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
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.infoEra} numberOfLines={1}>
            {eraPt(entry?.serieName ?? set.serieName)}
          </Text>
          <Pressable onPress={() => setModePicker(true)} hitSlop={6} style={styles.modePill}>
            <Text style={styles.modePillText}>{modeOf(set, prefs) === 'principal' ? 'Coleção principal ▾' : 'Coleção especial ▾'}</Text>
          </Pressable>
        </View>
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
        <Chip label="Todas" count={chipCounts.all} active={catSet.size === 0} onPress={() => setCategoryFilter(setId, [])} />
        {CATEGORY_ORDER.filter((c) => catCounts.has(c)).map((c) => (
          <Chip
            key={c}
            label={CATEGORY_LABELS[c]}
            count={chipCounts.m.get(c) ?? 0}
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
        <Pressable style={styles.sortPill} onPress={() => setSortPicker(true)} hitSlop={6}>
          <Text style={styles.sortPillText} numberOfLines={1}>
            ⇅ {cardSortLabel(cardSort)}
          </Text>
        </Pressable>
        <Pressable onPress={bulk} hitSlop={8}>
          <Text style={styles.bulk}>Lote</Text>
        </Pressable>
      </View>
      <Text style={styles.countText}>{`${filtered.length} na tela · toque para marcar, segure para ver detalhes`}</Text>
      {hiddenCount > 0 ? (
        <Pressable
          style={styles.hiddenRow}
          onPress={() =>
            Alert.alert('Variações ocultas', `Voltar a mostrar as ${hiddenCount} variações ocultas desta coleção?`, [
              { text: 'Cancelar', style: 'cancel' },
              { text: 'Mostrar de novo', onPress: () => restoreExcluded(setId) },
            ])
          }
        >
          <Text style={styles.hiddenText}>{`${hiddenCount} ${hiddenCount === 1 ? 'variação oculta' : 'variações ocultas'} · `}</Text>
          <Text style={styles.hiddenLink}>mostrar de novo</Text>
        </Pressable>
      ) : null}
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
        data={shown}
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
                const n = rarityCounts.get(r) ?? 0;
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

      <Modal visible={bulkOpen} transparent animationType="fade" onRequestClose={() => setBulkOpen(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setBulkOpen(false)}>
          <Pressable style={[styles.picker, { paddingHorizontal: 18 }]} onPress={() => {}}>
            <Text style={[styles.pickerTitle, { paddingHorizontal: 0 }]}>Ação em lote</Text>
            <Text style={[styles.pickerHint, { paddingHorizontal: 0 }]}>
              {`Vale para as ${filtered.length} cartas que estão na tela agora (com os filtros aplicados).`}
            </Text>
            {(
              [
                ['Marcar como tenho', () => setOwned(setId, bulkKeys(), true), colors.text],
                ['Desmarcar', () => setOwned(setId, bulkKeys(), false), colors.text],
                [
                  'Ocultar da coleção',
                  () =>
                    Alert.alert(
                      'Ocultar da coleção',
                      `As ${filtered.length} cartas da tela deixam de aparecer e de contar nesta coleção. Dá para mostrar de novo depois.`,
                      [
                        { text: 'Cancelar', style: 'cancel' },
                        { text: 'Ocultar', style: 'destructive', onPress: () => excludeVariants(setId, bulkKeys()) },
                      ],
                    ),
                  colors.accent,
                ],
              ] as const
            ).map(([label, action, color]) => (
              <Pressable
                key={label}
                style={styles.bulkItem}
                onPress={() => {
                  setBulkOpen(false);
                  action();
                }}
              >
                <Text style={[styles.bulkText, { color }]}>{label}</Text>
              </Pressable>
            ))}
            <Text style={[styles.pickerHint, { paddingHorizontal: 0, marginTop: 6 }]}>
              Dica: para tirar todas as Promo / Extras, filtre o Tipo de carta "Promo / Extra" e use "Ocultar da coleção".
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={modePicker} transparent animationType="fade" onRequestClose={() => setModePicker(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setModePicker(false)}>
          <Pressable style={[styles.picker, { paddingHorizontal: 18 }]} onPress={() => {}}>
            <Text style={[styles.pickerTitle, { paddingHorizontal: 0 }]}>Tipo de coleção</Text>
            {(
              [
                ['principal', 'Coleção principal', 'Por carta: 1 Normal; + 1 Reverse nas Comuns, Incomuns e Raras numeradas. Raras Duplas, ACE SPEC e cartas acima do total oficial: só 1. Outras variações você inclui na tela da carta (segure o dedo).'],
                ['especial', 'Coleção especial', 'Todas as variações que existem (Poké Bola, Master Bola, Cosmos, carimbos…). As que não interessam você oculta na tela da carta.'],
              ] as const
            ).map(([value, title, desc]) => {
              const on = modeOf(set, prefs) === value;
              return (
                <Pressable
                  key={value}
                  style={[styles.modeOption, on && { borderColor: colors.accent }]}
                  onPress={() => {
                    setSetMode(setId, value);
                    setModePicker(false);
                  }}
                >
                  <Text style={[styles.modeTitle, on && { color: colors.accent }]}>{`${on ? '✓ ' : ''}${title}`}</Text>
                  <Text style={styles.modeDesc}>{desc}</Text>
                </Pressable>
              );
            })}
            <Text style={[styles.pickerHint, { paddingHorizontal: 0, marginTop: 8 }]}>
              Trocar o tipo não apaga nenhuma marcação: as cartas que você já tem voltam a contar quando aparecem de novo.
            </Text>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={sortPicker} transparent animationType="fade" onRequestClose={() => setSortPicker(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setSortPicker(false)}>
          <Pressable style={styles.picker} onPress={() => {}}>
            <Text style={styles.pickerTitle}>Ordenar cartas</Text>
            <Text style={styles.pickerHint}>
              {hasPrices ? 'Fica salvo para esta coleção.' : 'As opções por valor aparecem quando esta coleção tiver preços.'}
            </Text>
            <ScrollView>
              {CARD_SORTS.filter((o) => !o.needsPrice || hasPrices).map((o) => (
                <Pressable
                  key={o.value}
                  style={styles.pickerItem}
                  onPress={() => {
                    setCardSort(setId, o.value);
                    setSortPicker(false);
                  }}
                >
                  <Text style={[styles.pickerText, o.value === cardSort && { color: colors.text, fontWeight: '800' }]}>{o.label}</Text>
                  {o.value === cardSort ? <Text style={{ color: colors.accent, fontWeight: '900' }}>✓</Text> : null}
                </Pressable>
              ))}
            </ScrollView>
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

      <CardDetail set={set} prefs={prefs} card={detail} onClose={() => setDetail(null)} />
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
  infoEra: { color: colors.gold, fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  modePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  modePillText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  modeOption: { borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, marginTop: 10, backgroundColor: colors.surface },
  modeTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  modeDesc: { color: colors.textDim, fontSize: 12, marginTop: 4, lineHeight: 17 },
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
  hiddenRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 6 },
  hiddenText: { color: colors.textFaint, fontSize: 12 },
  hiddenLink: { color: colors.accent, fontSize: 12, fontWeight: '800' },
  bulkItem: { paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  bulkText: { fontSize: 16, fontWeight: '700' },
  sortPill: {
    flex: 1,
    marginRight: 12,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  sortPillText: { color: colors.text, fontSize: 13, fontWeight: '700' },
  countText: { color: colors.textFaint, fontSize: 12, marginHorizontal: 16, marginBottom: 6 },
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
