import { Image } from 'expo-image';
import React, { useCallback, useMemo, useState } from 'react';
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
import { assetUrl, fetchFullSet, StoredCard, StoredSet } from '../api';
import { CardDetail } from '../components/CardDetail';
import { CardTile } from '../components/CardTile';
import { BusyModal, Chip, IconButton, ProgressBar, Segmented } from '../components/ui';
import { loadSet } from '../storage';
import { ownedKey, useStore } from '../store';
import { colors, finishColors } from '../theme';
import { CardVariant, CATEGORY_LABELS, CATEGORY_ORDER, matchesQuery, VariantCategory } from '../variants';

type Status = 'todas' | 'tenho' | 'faltam';
interface Entry {
  key: string;
  card: StoredCard;
  variant: CardVariant;
}

const CATEGORY_COLOR: Partial<Record<VariantCategory, string>> = {
  holo: finishColors.holo.bg,
  reverse: finishColors.reverse.bg,
  reverse_especial: finishColors.special.bg,
};

export function SetScreen({ setId, onBack }: { setId: string; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { isOwned, ownedCount, toggleOwned, setOwned, upsertCollection, data } = useStore();
  const [set, setSet] = useState<StoredSet | null>(() => loadSet(setId));
  const [category, setCategory] = useState<VariantCategory | 'todas'>('todas');
  const [status, setStatus] = useState<Status>('todas');
  const [rarity, setRarity] = useState<string | null>(null);
  const [rarityPicker, setRarityPicker] = useState(false);
  const [text, setText] = useState('');
  const [detail, setDetail] = useState<StoredCard | null>(null);
  const [busy, setBusy] = useState<{ title: string; done?: number; total?: number } | null>(null);

  const entry = data.collections.find((c) => c.setId === setId);
  const allEntries: Entry[] = useMemo(
    () => (set?.cards ?? []).flatMap((card) => card.variants.map((variant) => ({ key: ownedKey(card.id, variant.key), card, variant }))),
    [set],
  );

  const catCounts = useMemo(() => {
    const m = new Map<VariantCategory, number>();
    for (const e of allEntries) m.set(e.variant.category, (m.get(e.variant.category) ?? 0) + 1);
    return m;
  }, [allEntries]);

  const rarities = useMemo(() => [...new Set((set?.cards ?? []).map((c) => c.rarity).filter(Boolean) as string[])], [set]);

  const filtered = useMemo(
    () =>
      allEntries.filter((e) => {
        if (category !== 'todas' && e.variant.category !== category) return false;
        if (rarity && e.card.rarity !== rarity) return false;
        if (status !== 'todas') {
          const o = isOwned(setId, e.key);
          if (status === 'tenho' ? !o : o) return false;
        }
        if (text.trim()) {
          const t = text.trim().replace(/^#/, '');
          if (/^\d+$/.test(t)) {
            if (String(parseInt(e.card.localId, 10)) !== String(parseInt(t, 10)) && e.card.localId !== t) return false;
          } else if (!matchesQuery(`${e.card.name} ${e.variant.label}`, text)) return false;
        }
        return true;
      }),
    [allEntries, category, rarity, status, text, isOwned, setId],
  );

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
  const owned = ownedCount(setId);
  const total = entry?.totalVariants ?? allEntries.length;

  const header = (
    <View>
      <View style={styles.summary}>
        {set.logo ? <Image source={{ uri: assetUrl(set.logo) }} style={styles.logo} contentFit="contain" cachePolicy="disk" /> : null}
        <View style={{ flex: 1 }}>
          <Text style={styles.summaryBig}>{`${owned} de ${total}`}</Text>
          <Text style={styles.summarySub}>{`variantes · ${set.cards.length} cartas${set.releaseDate ? ` · ${set.releaseDate.slice(0, 4)}` : ''}`}</Text>
          <View style={{ marginTop: 8 }}>
            <ProgressBar value={owned} total={total} height={8} />
          </View>
        </View>
      </View>

      <View style={styles.searchBox}>
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

      <Text style={styles.label}>Tipo de carta</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }} style={{ marginBottom: 10 }}>
        <Chip label="Todas" count={allEntries.length} active={category === 'todas'} onPress={() => setCategory('todas')} />
        {CATEGORY_ORDER.filter((c) => catCounts.has(c)).map((c) => (
          <Chip
            key={c}
            label={CATEGORY_LABELS[c]}
            count={catCounts.get(c)}
            active={category === c}
            color={CATEGORY_COLOR[c]}
            onPress={() => setCategory(c)}
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
        <Pressable onPress={() => setRarityPicker(true)} style={[styles.rarityBtn, rarity && { borderColor: colors.accent }]}>
          <Text style={styles.rarityText} numberOfLines={1}>
            {rarity ?? 'Raridade ▾'}
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
          <CardTile card={item.card} variant={item.variant} owned={isOwned(setId, item.key)} width={tileW} onToggle={onToggle} onOpen={onOpen} />
        )}
      />

      <Modal visible={rarityPicker} transparent animationType="fade" onRequestClose={() => setRarityPicker(false)}>
        <Pressable style={styles.pickerBackdrop} onPress={() => setRarityPicker(false)}>
          <View style={styles.picker}>
            <ScrollView>
              {[null, ...rarities].map((r) => (
                <Pressable
                  key={r ?? 'all'}
                  style={styles.pickerItem}
                  onPress={() => {
                    setRarity(r);
                    setRarityPicker(false);
                  }}
                >
                  <Text style={[styles.pickerText, r === rarity && { color: colors.accent }]}>{r ?? 'Todas as raridades'}</Text>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>

      <CardDetail setId={setId} card={detail} onClose={() => setDetail(null)} />
      <BusyModal visible={!!busy} title={busy?.title ?? ''} done={busy?.done} total={busy?.total} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  topBar: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 8 },
  title: { color: colors.text, fontSize: 19, fontWeight: '800' },
  subtitle: { color: colors.textDim, fontSize: 12 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: 14, marginHorizontal: 16, padding: 14, backgroundColor: colors.surface, borderRadius: 14, marginBottom: 12 },
  logo: { width: 96, height: 48 },
  summaryBig: { color: colors.text, fontSize: 20, fontWeight: '800' },
  summarySub: { color: colors.textDim, fontSize: 12 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    backgroundColor: colors.surface,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 15, paddingVertical: 10 },
  label: { color: colors.textFaint, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6, marginHorizontal: 16, marginBottom: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, marginHorizontal: 16 },
  rarityBtn: { maxWidth: 140, paddingHorizontal: 12, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  rarityText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  countRow: { flexDirection: 'row', alignItems: 'center', marginHorizontal: 16, marginTop: 12, marginBottom: 6 },
  countText: { color: colors.textFaint, fontSize: 12, flex: 1 },
  bulk: { color: colors.accent, fontWeight: '700', fontSize: 13 },
  empty: { color: colors.textDim, textAlign: 'center', marginTop: 40 },
  retry: { backgroundColor: colors.accent, paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10 },
  pickerBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: 32 },
  picker: { backgroundColor: colors.surface2, borderRadius: 14, maxHeight: '70%', paddingVertical: 6 },
  pickerItem: { paddingHorizontal: 18, paddingVertical: 13 },
  pickerText: { color: colors.text, fontSize: 15 },
});
