import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchAllSets, SetSummary } from '../api';
import { countryName } from '../countries';
import { ocrAvailable } from '../ocr';
import { fetchCardDetail, fetchSetCards, identifyCard, matchesCardNumber, parseFooter } from '../pokedex';
import type { CardDetailInfo, PokemonCardBrief } from '../pokedex';
import { fetchSpecialCandidates, matchesSpecial, uniqueCards } from '../specials';
import { loadSetsCacheAnyAge, saveSetsCache } from '../storage';
import type { SpecialCollection } from '../storage';
import { useStore } from '../store';
import { CARD_RATIO, colors } from '../theme';
import { matchesQuery } from '../variants';
import { AutoField } from './AddPokedexCard';
import type { Suggestion } from './AddPokedexCard';
import { CardPickerGrid } from './CardPickerGrid';
import { CardScanner } from './CardScanner';
import { CountryPicker } from './CountryPicker';
import { Flag } from './Flag';
import { Chip, Segmented } from './ui';

/** Inclusão de carta numa Coleção Especial: pela câmera ou escolhendo a expansão e a carta. */
export function AddSpecialCard({
  visible,
  col,
  onClose,
  prefill,
}: {
  visible: boolean;
  col: SpecialCollection;
  onClose: () => void;
  /** carta já escolhida (tocar numa carta que falta, na tela da coleção) */
  prefill?: PokemonCardBrief | null;
}) {
  const { addSpecialCard, data, defaultCountry } = useStore();
  const [sets, setSets] = useState<SetSummary[]>(() => loadSetsCacheAnyAge() ?? []);
  const [related, setRelated] = useState<PokemonCardBrief[]>([]);
  const [loading, setLoading] = useState(false);
  const [setText, setSetText] = useState('');
  const [setId, setSetId] = useState<string | null>(null);
  const [setCards, setSetCards] = useState<PokemonCardBrief[]>([]);
  /** mostra todas as cartas da expansão (o personagem pode estar só no fundo da arte) */
  const [allOfSet, setAllOfSet] = useState(false);
  const [cardText, setCardText] = useState('');
  const [card, setCard] = useState<PokemonCardBrief | null>(null);
  const [extra, setExtra] = useState<PokemonCardBrief[]>([]);
  const [detail, setDetail] = useState<CardDetailInfo | null>(null);
  const [variantKey, setVariantKey] = useState<string | null>(null);
  const [country, setCountry] = useState(defaultCountry);
  const [pickingCountry, setPickingCountry] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [identifying, setIdentifying] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setCountry(defaultCountry);
    if (!sets.length)
      fetchAllSets()
        .then((l) => {
          setSets(l);
          saveSetsCache(l);
        })
        .catch(() => {});
    if (prefill) {
      setExtra([prefill]);
      choose(prefill);
    }
    setLoading(true);
    fetchSpecialCandidates(col)
      .then(setRelated)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, col.uid]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!setId) return setSetCards([]);
    fetchSetCards(setId).then(setSetCards).catch(() => setSetCards([]));
  }, [setId]);

  // versões da carta (Normal, Reverse, Holo…): começa na versão base
  useEffect(() => {
    setDetail(null);
    setVariantKey(null);
    if (!card) return;
    let alive = true;
    fetchCardDetail(card.id)
      .then((d) => {
        if (!alive) return;
        setDetail(d);
        setVariantKey((d.variants.find((v) => v.category === 'normal') ?? d.variants[0])?.key ?? null);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [card?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const setById = useMemo(() => new Map(sets.map((s) => [s.id, s])), [sets]);
  const setName = (id: string) => setById.get(id)?.namePt ?? setById.get(id)?.nameEn ?? id;
  const setsWith = useMemo(() => new Set(related.map((c) => c.setId)), [related]);
  const what = col.kind === 'energia' ? 'Energias' : col.term ?? col.name;

  const setSuggestions: Suggestion[] = useMemo(() => {
    if (setId) return [];
    const list = sets.filter((s) => !setText.trim() || matchesQuery(`${s.namePt ?? ''} ${s.nameEn} ${s.id}`, setText));
    // expansões que têm cartas da coleção vêm primeiro
    list.sort((a, b) => Number(setsWith.has(b.id)) - Number(setsWith.has(a.id)));
    return list.slice(0, 8).map((s) => ({
      key: s.id,
      title: s.namePt ?? s.nameEn,
      subtitle: setsWith.has(s.id) ? `tem ${what}` : s.nameEn !== (s.namePt ?? s.nameEn) ? s.nameEn : undefined,
    }));
  }, [sets, setText, setId, setsWith, what]);

  // cartas oferecidas: só as do personagem/tipo; com "todas as cartas" ligado, a expansão inteira
  const candidates = useMemo(() => {
    if (setId && allOfSet) return setCards;
    if (!setId) return related;
    const fromSet = setCards.filter((c) => matchesSpecial(col, c.name));
    return uniqueCards(
      related.filter((c) => c.setId === setId),
      fromSet,
    );
  }, [setId, allOfSet, setCards, related, col]);

  // miniaturas: as cartas da expansão escolhida (no filtro atual), em ordem de número
  const gridCards = useMemo(() => {
    if (!setId || card) return [];
    const t = cardText.trim();
    const num = (x: string) => (/^\d+$/.test(x) ? Number(x) : Infinity);
    return candidates
      .filter((c) => c.setId === setId && (!t || matchesCardNumber(c.localId, t) || matchesQuery(`${c.name} ${c.localId}`, t)))
      .sort((a, b) => num(a.localId) - num(b.localId) || a.localId.localeCompare(b.localId));
  }, [setId, card, candidates, cardText]);

  const cardTitle = (c: PokemonCardBrief) => {
    const official = setById.get(c.setId)?.official;
    return `${c.localId}${official && /^\d+$/.test(c.localId) ? `/${official}` : ''} · ${c.name}`;
  };

  const cardSuggestions: Suggestion[] = useMemo(() => {
    if (card || setId) return [];
    const t = cardText.trim();
    return candidates
      .filter((c) => !t || matchesCardNumber(c.localId, t) || matchesQuery(`${c.name} ${c.localId}`, t))
      .slice(0, 15)
      .map((c) => ({ key: c.id, title: cardTitle(c), subtitle: setId ? undefined : setName(c.setId) }));
  }, [card, candidates, cardText, setId, setById]); // eslint-disable-line react-hooks/exhaustive-deps

  const choose = (c: PokemonCardBrief) => {
    setCard(c);
    setSetId(c.setId);
    setSetText(setName(c.setId));
    setCardText(cardTitle(c));
  };
  const pickSet = (id: string) => {
    setSetId(id);
    setSetText(setName(id));
    setCard(null);
    setCardText('');
  };
  const pickCard = (id: string) => {
    const c = [...candidates, ...related, ...setCards, ...extra].find((x) => x.id === id);
    if (c) choose(c);
  };

  // câmera: identifica a carta pelo rodapé; se não for do personagem (ele pode estar só no fundo), avisa e deixa incluir
  const onRead = async (text: string) => {
    setScanning(false);
    const read = parseFooter(text);
    if (read.number === undefined && !read.promo) {
      setScanMsg('Não consegui ler o número da carta. Tente de novo com mais luz ou preencha abaixo.');
      return;
    }
    const label = read.promo ?? `${read.number}/${read.total ?? '?'}`;
    setIdentifying(true);
    try {
      let list = sets;
      if (!list.length) {
        list = await fetchAllSets();
        saveSetsCache(list);
        setSets(list);
      }
      const byId = new Map(list.map((x) => [x.id, x]));
      const found = (
        await identifyCard(read, (id) => ({ official: byId.get(id)?.official, code: data.collections.find((c) => c.setId === id)?.code }), true)
      ).map((f) => f.card);
      if (!found.length) {
        setScanMsg(`Li ${label}, mas não achei a carta. Preencha abaixo.`);
        return;
      }
      const relatedIds = new Set(related.map((c) => c.id));
      const best = found.find((c) => relatedIds.has(c.id) || matchesSpecial(col, c.name)) ?? found[0];
      setExtra(found);
      setAllOfSet(!relatedIds.has(best.id) && !matchesSpecial(col, best.name));
      choose(best);
      const isRelated = relatedIds.has(best.id) || matchesSpecial(col, best.name);
      setScanMsg(
        isRelated
          ? found.length > 1
            ? `Li ${label} — achei ${found.length} possibilidades; confira a expansão.`
            : `Li ${label} — confira a versão e o país e toque em Adicionar.`
          : `Li ${label}: é "${best.name}", que não tem ${what} no nome. Se ${what} aparece na arte, pode adicionar mesmo assim.`,
      );
    } catch {
      setScanMsg('Sem conexão para identificar a carta agora.');
    } finally {
      setIdentifying(false);
    }
  };

  const close = () => {
    setSetText('');
    setSetId(null);
    setCardText('');
    setCard(null);
    setScanMsg(null);
    setAllOfSet(false);
    setExtra([]);
    onClose();
  };
  const save = () => {
    if (!card) return;
    const v = detail?.variants.find((x) => x.key === variantKey);
    addSpecialCard(col.uid, {
      variantKey: v?.key,
      variantLabel: v?.label,
      category: v?.category,
      rarity: detail?.rarity,
      nameEn: detail?.nameEn,
      cardId: card.id,
      setId: card.setId,
      setName: setName(card.setId),
      localId: card.localId,
      name: card.name,
      image: card.image,
      official: setById.get(card.setId)?.official,
      country,
    });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18 }}>
            <Text style={styles.title}>{`Adicionar em ${col.name}`}</Text>

            {ocrAvailable ? (
              <Pressable style={styles.camBtn} onPress={() => setScanning(true)} disabled={identifying}>
                <Text style={styles.camIcon}>📷</Text>
                <View style={{ flex: 1 }}>
                  <Text style={styles.camTitle}>Ler pela câmera</Text>
                  <Text style={styles.camSub}>Aponte para o rodapé da carta</Text>
                </View>
                {identifying ? <ActivityIndicator color={colors.text} /> : null}
              </Pressable>
            ) : null}
            {scanMsg ? <Text style={styles.scanMsg}>{scanMsg}</Text> : null}
            {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} /> : null}

            <AutoField
              label="Expansão"
              placeholder="Digite o nome da expansão"
              text={setText}
              onText={(t) => {
                setSetText(t);
                setSetId(null);
                setCard(null);
                setCardText('');
              }}
              suggestions={setSuggestions}
              onPick={pickSet}
            />

            <Segmented
              style={{ marginTop: 12 }}
              options={[
                { value: 'so', label: `Só de ${what}` },
                { value: 'todas', label: 'Todas da expansão' },
              ]}
              value={allOfSet ? 'todas' : 'so'}
              onChange={(v) => {
                setAllOfSet(v === 'todas');
                setCard(null);
                setCardText('');
              }}
            />
            <Text style={styles.hint}>
              {allOfSet
                ? setId
                  ? `Mostrando todas as cartas da expansão — para quando ${what} aparece só no fundo da arte.`
                  : 'Escolha a expansão para ver todas as cartas dela.'
                : `Use "Todas da expansão" quando ${what} aparece só no fundo da arte de outra carta.`}
            </Text>

            <AutoField
              label="Carta"
              placeholder={setId ? 'Filtrar as miniaturas por número ou nome (opcional)' : `Todas as cartas de ${what} — digite o número ou o nome`}
              text={cardText}
              onText={(t) => {
                setCardText(t);
                setCard(null);
              }}
              suggestions={cardSuggestions}
              onPick={pickCard}
              disabled={allOfSet && !setId}
            />

            {setId && !card ? (
              <CardPickerGrid
                cards={gridCards}
                onPick={(c) => pickCard(c.id)}
                emptyText={cardText.trim() ? 'Nenhuma carta com esse número ou nome.' : `Nenhuma carta de ${what} nesta expansão.`}
              />
            ) : null}
            {setId && card ? (
              <Pressable
                onPress={() => {
                  setCard(null);
                  setCardText('');
                }}
                hitSlop={6}
                style={{ marginTop: 8, alignSelf: 'flex-start' }}
              >
                <Text style={{ color: colors.accent, fontWeight: '800', fontSize: 13 }}>‹ Escolher outra carta desta expansão</Text>
              </Pressable>
            ) : null}

            {card ? (
              <View style={{ marginTop: 12 }}>
                <Text style={styles.label}>Versão</Text>
                {!detail ? (
                  <ActivityIndicator color={colors.accent} style={{ alignSelf: 'flex-start' }} />
                ) : (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', rowGap: 8 }}>
                    {detail.variants.map((v) => (
                      <Chip key={v.key} label={v.label} active={variantKey === v.key} onPress={() => setVariantKey(v.key)} />
                    ))}
                  </View>
                )}
                {detail?.rarity ? <Text style={styles.rarity}>{`Raridade: ${detail.rarity}`}</Text> : null}

                <Text style={[styles.label, { marginTop: 14 }]}>País</Text>
                <Pressable style={styles.countryBtn} onPress={() => setPickingCountry(true)}>
                  <Flag code={country} size={20} />
                  <Text style={styles.countryText}>{countryName(country)}</Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              </View>
            ) : null}

            {card?.image ? <Image source={{ uri: `${card.image}/high.webp` }} style={styles.preview} contentFit="contain" cachePolicy="disk" /> : null}

            <View style={styles.actions}>
              <Pressable onPress={close} style={styles.btn}>
                <Text style={{ color: colors.textDim, fontWeight: '700' }}>Cancelar</Text>
              </Pressable>
              <Pressable onPress={save} disabled={!card} style={[styles.btn, { backgroundColor: card ? colors.accent : colors.surface }]}>
                <Text style={{ color: card ? '#fff' : colors.textFaint, fontWeight: '800' }}>Adicionar</Text>
              </Pressable>
            </View>
          </ScrollView>
          <CardScanner visible={scanning} onClose={() => setScanning(false)} onRead={onRead} />
          <CountryPicker visible={pickingCountry} current={country} onPick={setCountry} onClose={() => setPickingCountry(false)} />
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.75)', justifyContent: 'center', padding: 12 },
  sheet: { backgroundColor: colors.sheet, borderRadius: 28, maxHeight: '92%', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  title: { color: colors.text, fontSize: 20, fontWeight: '900' },
  camBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14, padding: 14, borderRadius: 18, backgroundColor: colors.accentDim, borderWidth: 1, borderColor: colors.accent },
  camIcon: { fontSize: 26 },
  camTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  camSub: { color: colors.textDim, fontSize: 12 },
  scanMsg: { color: colors.gold, marginTop: 10, fontSize: 13 },
  label: { color: colors.textFaint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 6 },
  hint: { color: colors.textFaint, fontSize: 12, marginTop: 6 },
  rarity: { color: colors.textDim, fontSize: 12, marginTop: 8 },
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
  chevron: { color: colors.textFaint, fontSize: 22 },
  preview: { width: 180, height: 180 * CARD_RATIO, alignSelf: 'center', marginTop: 16, borderRadius: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999, backgroundColor: colors.surface },
});
