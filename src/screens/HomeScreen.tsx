import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchAllSets, fetchFullSet, SetSummary } from '../api';
import { applySavedFilters, formatPct, progress, setEntries } from '../collection';
import { eraPt, HOME_SORTS, HomeSort, sortLabel } from '../eras';
import { SetLogo, SetSymbol } from '../components/SetLogo';
import { BusyModal, IconButton, ProgressBar } from '../components/ui';
import { versionLabel } from '../components/UpdateBanner';
import {
  buildBackup,
  CollectionEntry,
  loadSet,
  loadSetsCache,
  loadSetsCacheAnyAge,
  readBackupFile,
  restoreBackup,
  saveSetsCache,
  writeBackupFile,
} from '../storage';
import { useStore } from '../store';
import { colors } from '../theme';
import { matchesQuery } from '../variants';

export function HomeScreen({ openSet }: { openSet: (setId: string) => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { data, isOwned, upsertCollection, removeCollection, reload, setHomeSort } = useStore();
  const [sortPicker, setSortPicker] = useState(false);
  const sort = (data.homeSort as HomeSort) ?? 'adicionada';

  // progresso de cada coleção: todas as variantes (inclusive correções e as adicionadas à mão),
  // com o último filtro de tipo/raridade aplicado naquela coleção — igual à tela da coleção
  const stats = useMemo(() => {
    const m: Record<string, { owned: number; total: number; pct: number; filtered: boolean }> = {};
    for (const c of data.collections) {
      const set = loadSet(c.setId);
      if (!set) continue;
      const f = applySavedFilters(setEntries(set, data.custom[c.setId]), data.filters[c.setId]);
      m[c.setId] = { ...progress(f.list, (k) => isOwned(c.setId, k)), filtered: f.active };
    }
    return m;
  }, [data.collections, data.custom, data.filters, isOwned]);

  const sorted = useMemo(() => {
    const list = [...data.collections];
    const date = (s?: string) => s ?? '';
    const name = (c: CollectionEntry) => c.namePt ?? c.nameEn;
    const pct = (c: CollectionEntry) => stats[c.setId]?.pct ?? 0;
    switch (sort) {
      case 'lancamento_desc':
        return list.sort((a, b) => date(b.releaseDate).localeCompare(date(a.releaseDate)));
      case 'lancamento_asc':
        return list.sort((a, b) => (date(a.releaseDate) || '9999').localeCompare(date(b.releaseDate) || '9999'));
      case 'pct_desc':
        return list.sort((a, b) => pct(b) - pct(a) || name(a).localeCompare(name(b)));
      case 'pct_asc':
        return list.sort((a, b) => pct(a) - pct(b) || name(a).localeCompare(name(b)));
      case 'nome':
        return list.sort((a, b) => name(a).localeCompare(name(b)));
      case 'era': {
        // eras mais recentes primeiro; dentro da era, coleção mais nova primeiro
        const eraNewest: Record<string, string> = {};
        for (const c of list) {
          const e = eraPt(c.serieName);
          if (date(c.releaseDate) > (eraNewest[e] ?? '')) eraNewest[e] = date(c.releaseDate);
        }
        return list.sort((a, b) => {
          const ea = eraPt(a.serieName);
          const eb = eraPt(b.serieName);
          if (ea !== eb) return (eraNewest[eb] ?? '').localeCompare(eraNewest[ea] ?? '') || ea.localeCompare(eb);
          return date(b.releaseDate).localeCompare(date(a.releaseDate));
        });
      }
      default:
        return list; // adicionadas por último (ordem em que foram incluídas)
    }
  }, [data.collections, sort, stats]);
  const [query, setQuery] = useState('');
  const [allSets, setAllSets] = useState<SetSummary[] | null>(() => loadSetsCache());
  const [setsError, setSetsError] = useState<string | null>(null);
  const [busy, setBusy] = useState<{ title: string; done?: number; total?: number } | null>(null);
  const [menu, setMenu] = useState(false);

  const loadSets = useCallback(async () => {
    setSetsError(null);
    try {
      const list = await fetchAllSets();
      setAllSets(list);
      saveSetsCache(list);
    } catch {
      const old = loadSetsCacheAnyAge();
      if (old) setAllSets(old);
      else setSetsError('Sem conexão para buscar as expansões. Toque para tentar de novo.');
    }
  }, []);

  useEffect(() => {
    if (!allSets) loadSets();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const addedIds = useMemo(() => new Set(data.collections.map((c) => c.setId)), [data.collections]);

  const results = useMemo(() => {
    if (!query.trim() || !allSets) return [];
    return allSets.filter((s) => matchesQuery(`${s.namePt ?? ''} ${s.nameEn} ${s.id}`, query)).slice(0, 80);
  }, [query, allSets]);

  const addSet = async (s: SetSummary) => {
    Keyboard.dismiss();
    if (addedIds.has(s.id)) {
      setQuery('');
      openSet(s.id);
      return;
    }
    const title = `Baixando ${s.namePt ?? s.nameEn}…`;
    setBusy({ title });
    try {
      const full = await fetchFullSet(s.id, (done, total) => setBusy({ title, done, total }));
      upsertCollection(full);
      setBusy(null);
      setQuery('');
      openSet(full.id);
    } catch (e) {
      setBusy(null);
      Alert.alert('Não foi possível baixar', 'Verifique a internet e tente de novo.');
    }
  };

  const confirmRemove = (c: CollectionEntry) => {
    Alert.alert('Remover coleção', `Remover "${c.namePt ?? c.nameEn}" e todas as marcações dela?`, [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Remover', style: 'destructive', onPress: () => removeCollection(c.setId) },
    ]);
  };

  const exportBackup = async () => {
    setMenu(false);
    try {
      const uri = writeBackupFile(buildBackup(data));
      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(uri, { mimeType: 'application/json', dialogTitle: 'Salvar backup da coleção' });
      } else {
        Alert.alert('Backup criado', uri);
      }
    } catch {
      Alert.alert('Erro', 'Não foi possível gerar o backup.');
    }
  };

  const importBackup = async () => {
    setMenu(false);
    const res = await DocumentPicker.getDocumentAsync({ type: ['application/json', '*/*'], copyToCacheDirectory: true });
    if (res.canceled || !res.assets?.[0]) return;
    try {
      const b = await readBackupFile(res.assets[0].uri);
      Alert.alert(
        'Restaurar backup',
        `Backup de ${b.exportedAt.slice(0, 10)} com ${b.data.collections.length} coleções. Isso substitui tudo o que está no app agora.`,
        [
          { text: 'Cancelar', style: 'cancel' },
          {
            text: 'Restaurar',
            style: 'destructive',
            onPress: () => {
              restoreBackup(b);
              reload();
            },
          },
        ],
      );
    } catch (e: any) {
      Alert.alert('Arquivo inválido', e?.message ?? 'Não consegui ler o backup.');
    }
  };

  const colW = (width - 16 * 2 - 12) / 2;
  const searching = query.trim().length > 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.h1}>Minha Coleção</Text>
          <Text style={styles.h2}>
            {data.collections.length === 0
              ? 'Nenhuma expansão adicionada'
              : `${data.collections.length} ${data.collections.length === 1 ? 'expansão' : 'expansões'}`}
          </Text>
        </View>
        <IconButton label="⋮" onPress={() => setMenu(true)} accessibilityLabel="Menu" />
      </View>

      <View style={styles.searchBox}>
        <Text style={styles.searchIcon}>⌕</Text>
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar expansão para adicionar…"
          placeholderTextColor={colors.textFaint}
          style={styles.searchInput}
          autoCorrect={false}
          returnKeyType="search"
        />
        {query ? (
          <Pressable onPress={() => setQuery('')} hitSlop={10}>
            <Text style={styles.clear}>✕</Text>
          </Pressable>
        ) : null}
      </View>

      {!searching && data.collections.length > 1 ? (
        <Pressable style={styles.sortRow} onPress={() => setSortPicker(true)} hitSlop={6}>
          <Text style={styles.sortLabel}>Ordenar:</Text>
          <Text style={styles.sortValue} numberOfLines={1}>
            {sortLabel(sort)} ▾
          </Text>
        </Pressable>
      ) : null}

      {searching ? (
        <FlatList
          key="resultados"
          data={results}
          keyExtractor={(s) => s.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24 }}
          ListEmptyComponent={
            <Pressable onPress={setsError ? loadSets : undefined}>
              <Text style={styles.empty}>
                {setsError ?? (allSets ? 'Nenhuma expansão encontrada com esse nome.' : 'Carregando lista de expansões…')}
              </Text>
            </Pressable>
          }
          renderItem={({ item }) => (
            <Pressable style={({ pressed }) => [styles.result, pressed && { backgroundColor: colors.surface2 }]} onPress={() => addSet(item)}>
              <SetLogo setId={item.id} logo={item.logo} symbol={item.symbol} style={styles.resultLogo} />
              <View style={{ flex: 1 }}>
                <Text style={styles.resultName} numberOfLines={2}>
                  {item.namePt ?? item.nameEn}
                </Text>
                <Text style={styles.resultSub} numberOfLines={1}>
                  {[item.namePt && item.namePt !== item.nameEn ? item.nameEn : null, `${item.total} cartas`].filter(Boolean).join('  ·  ')}
                </Text>
              </View>
              <Text style={[styles.addTag, addedIds.has(item.id) && styles.addedTag]}>{addedIds.has(item.id) ? 'Abrir' : '+ Adicionar'}</Text>
            </Pressable>
          )}
        />
      ) : (
        <FlatList
          key="colecoes"
          data={sorted}
          keyExtractor={(c) => c.setId}
          numColumns={2}
          columnWrapperStyle={{ gap: 12 }}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 24, gap: 12 }}
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.emptyTitle}>Comece sua coleção</Text>
              <Text style={styles.empty}>Digite o nome de uma expansão no campo acima, por exemplo “Evoluções Prismáticas” ou “Fagulhas Impetuosas”.</Text>
            </View>
          }
          renderItem={({ item }) => {
            const st = stats[item.setId] ?? { owned: 0, total: 0, pct: 0, filtered: false };
            return (
              <Pressable
                style={({ pressed }) => [styles.tile, { width: colW, height: colW * 1.18 }, pressed && { opacity: 0.85 }]}
                onPress={() => openSet(item.setId)}
                onLongPress={() => confirmRemove(item)}
              >
                {/* fundo: o próprio logo ampliado e desfocado */}
                <SetLogo
                  setId={item.setId}
                  logo={item.logo}
                  symbol={item.symbol}
                  style={[StyleSheet.absoluteFill, { opacity: 0.45, transform: [{ scale: 1.6 }] }]}
                  fit="cover"
                  blurRadius={14}
                  hideFallbackText
                />
                <View style={[StyleSheet.absoluteFill, styles.tileTint]} />
                {/* logo grande, ocupando o quadrado */}
                <SetLogo setId={item.setId} logo={item.logo} symbol={item.symbol} style={styles.tileLogo} />
                {st.filtered ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>filtro</Text>
                  </View>
                ) : null}
                <View style={styles.tileInfo}>
                  <Text style={styles.tileEra} numberOfLines={1}>
                    {eraPt(item.serieName)}
                    {item.releaseDate ? ` · ${item.releaseDate.slice(0, 4)}` : ''}
                  </Text>
                  <View style={styles.tileNameRow}>
                    <SetSymbol symbol={item.symbol} size={14} />
                    <Text style={styles.tileName} numberOfLines={1}>
                      {item.namePt ?? item.nameEn}
                    </Text>
                  </View>
                  <View style={styles.tileStatsRow}>
                    <Text style={styles.tileSub}>{`${st.owned} / ${st.total}`}</Text>
                    <Text style={[styles.tilePct, st.pct >= 100 && { color: colors.gold }]}>{formatPct(st.pct)}</Text>
                  </View>
                  <ProgressBar value={st.owned} total={st.total} height={5} />
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Modal visible={sortPicker} transparent animationType="fade" onRequestClose={() => setSortPicker(false)}>
        <Pressable style={styles.sortBackdrop} onPress={() => setSortPicker(false)}>
          <View style={styles.sortBox}>
            <Text style={styles.sortTitle}>Ordenar coleções por</Text>
            {HOME_SORTS.map((o) => (
              <Pressable
                key={o.value}
                style={styles.sortItem}
                onPress={() => {
                  setHomeSort(o.value);
                  setSortPicker(false);
                }}
              >
                <Text style={[styles.sortItemText, o.value === sort && { color: colors.accent, fontWeight: '800' }]}>{o.label}</Text>
                {o.value === sort ? <Text style={{ color: colors.accent, fontWeight: '900' }}>✓</Text> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={menu} transparent animationType="fade" onRequestClose={() => setMenu(false)}>
        <Pressable style={styles.menuBackdrop} onPress={() => setMenu(false)}>
          <View style={[styles.menu, { top: insets.top + 56 }]}>
            <Pressable style={styles.menuItem} onPress={exportBackup}>
              <Text style={styles.menuText}>Exportar backup</Text>
              <Text style={styles.menuSub}>Salvar no Drive, WhatsApp, e-mail…</Text>
            </Pressable>
            <Pressable style={styles.menuItem} onPress={importBackup}>
              <Text style={styles.menuText}>Importar backup</Text>
              <Text style={styles.menuSub}>Restaurar a partir de um arquivo</Text>
            </Pressable>
            <Pressable
              style={styles.menuItem}
              onPress={() => {
                setMenu(false);
                setAllSets(null);
                loadSets();
              }}
            >
              <Text style={styles.menuText}>Atualizar lista de expansões</Text>
              <Text style={styles.menuSub}>Busca lançamentos novos</Text>
            </Pressable>
            <View style={styles.menuItem}>
              <Text style={styles.menuSub}>Dica: segure o dedo sobre uma coleção para removê-la. Dados das cartas: TCGdex.</Text>
              <Text style={[styles.menuSub, { marginTop: 8 }]}>{`App ${versionLabel()}`}</Text>
            </View>
          </View>
        </Pressable>
      </Modal>

      <BusyModal visible={!!busy} title={busy?.title ?? ''} done={busy?.done} total={busy?.total} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  h1: { color: colors.text, fontSize: 26, fontWeight: '800' },
  h2: { color: colors.textDim, marginTop: 2 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 14,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchIcon: { color: colors.textDim, fontSize: 20, marginRight: 6 },
  searchInput: { flex: 1, color: colors.text, fontSize: 16, paddingVertical: 12 },
  clear: { color: colors.textDim, fontSize: 16, paddingLeft: 8 },
  result: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 8, borderRadius: 10, gap: 12 },
  resultLogo: { width: 72, height: 36 },
  resultName: { color: colors.text, fontWeight: '700', fontSize: 15 },
  resultSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
  addTag: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  addedTag: { color: colors.success },
  tile: { backgroundColor: colors.surface, borderRadius: 14, borderWidth: 1, borderColor: colors.border, overflow: 'hidden' },
  tileTint: { backgroundColor: 'rgba(17,18,28,0.35)' },
  tileLogo: { position: 'absolute', top: 10, left: 10, right: 10, bottom: 86 },
  tileInfo: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 10,
    paddingTop: 8,
    paddingBottom: 10,
    backgroundColor: 'rgba(12,13,22,0.82)',
  },
  tileEra: { color: colors.gold, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  tileNameRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  tileName: { color: colors.text, fontWeight: '800', fontSize: 13, flex: 1 },
  tileStatsRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 3, marginBottom: 5 },
  tileSub: { color: colors.textDim, fontSize: 12 },
  tilePct: { color: colors.text, fontSize: 13, fontWeight: '800' },
  filterBadge: { position: 'absolute', top: 8, right: 8, backgroundColor: colors.accent, borderRadius: 6, paddingHorizontal: 6, paddingVertical: 2 },
  filterBadgeText: { color: '#fff', fontSize: 10, fontWeight: '800' },
  sortRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginHorizontal: 16, marginTop: -4, marginBottom: 12 },
  sortLabel: { color: colors.textFaint, fontSize: 13 },
  sortValue: { color: colors.text, fontSize: 13, fontWeight: '700', flexShrink: 1 },
  sortBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 28 },
  sortBox: { backgroundColor: colors.surface2, borderRadius: 14, paddingVertical: 12 },
  sortTitle: { color: colors.text, fontSize: 16, fontWeight: '800', paddingHorizontal: 18, marginBottom: 6 },
  sortItem: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 12 },
  sortItemText: { color: colors.text, fontSize: 15 },
  emptyBox: { paddingTop: 40, alignItems: 'center', paddingHorizontal: 20 },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: 6 },
  empty: { color: colors.textDim, textAlign: 'center', lineHeight: 20, marginTop: 16 },
  menuBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)' },
  menu: { position: 'absolute', right: 16, width: 270, backgroundColor: colors.surface2, borderRadius: 12, paddingVertical: 4 },
  menuItem: { paddingHorizontal: 16, paddingVertical: 12 },
  menuText: { color: colors.text, fontWeight: '700' },
  menuSub: { color: colors.textDim, fontSize: 12, marginTop: 2 },
});
