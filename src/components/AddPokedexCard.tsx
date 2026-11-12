import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchAllSets, SetSummary } from '../api';
import { fetchCardDetail, fetchPokemonCards, fetchSetCards, matchesCardNumber, matchFooter, parseFooter } from '../pokedex';
import type { CardDetailInfo, PokemonCardBrief } from '../pokedex';
import { loadSetsCacheAnyAge, saveSetsCache } from '../storage';
import { useStore } from '../store';
import { CARD_RATIO, colors } from '../theme';
import { matchesQuery, normalize } from '../variants';
import { CardPickerGrid } from './CardPickerGrid';
import { CardScanner } from './CardScanner';
import { ocrAvailable } from '../ocr';
import { Chip } from './ui';

export interface Suggestion {
  key: string;
  title: string;
  subtitle?: string;
}

/** Campo com sugestões que aparecem enquanto você digita. */
export function AutoField({
  label,
  placeholder,
  text,
  onText,
  suggestions,
  onPick,
  disabled,
}: {
  label: string;
  placeholder: string;
  text: string;
  onText: (t: string) => void;
  suggestions: Suggestion[];
  onPick: (key: string) => void;
  disabled?: boolean;
}) {
  const [focused, setFocused] = useState(false);
  return (
    <View style={{ marginTop: 12, opacity: disabled ? 0.5 : 1 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={text}
        onChangeText={onText}
        onFocus={() => setFocused(true)}
        onBlur={() => setTimeout(() => setFocused(false), 150)}
        placeholder={placeholder}
        placeholderTextColor={colors.textFaint}
        style={styles.input}
        editable={!disabled}
        autoCorrect={false}
      />
      {focused && suggestions.length > 0 ? (
        <View style={styles.suggestBox}>
          {suggestions.map((s) => (
            <Pressable key={s.key} style={({ pressed }) => [styles.suggest, pressed && { backgroundColor: colors.surface2 }]} onPress={() => onPick(s.key)}>
              <Text style={styles.suggestTitle} numberOfLines={1}>
                {s.title}
              </Text>
              {s.subtitle ? (
                <Text style={styles.suggestSub} numberOfLines={1}>
                  {s.subtitle}
                </Text>
              ) : null}
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

export function AddPokedexCard({
  visible,
  dexId,
  pokemonName,
  onClose,
  prefill,
}: {
  visible: boolean;
  dexId: number;
  pokemonName: string;
  onClose: () => void;
  /** carta já identificada pela câmera da tela principal da Pokédex */
  prefill?: PokemonCardBrief;
}) {
  const { addPokedexCard, data } = useStore();
  const [sets, setSets] = useState<SetSummary[]>(() => loadSetsCacheAnyAge() ?? []);
  const [pokemonCards, setPokemonCards] = useState<PokemonCardBrief[]>([]);
  const [setText, setSetText] = useState('');
  const [setId, setSetId] = useState<string | null>(null);
  const [setCards, setSetCards] = useState<PokemonCardBrief[]>([]);
  const [cardText, setCardText] = useState('');
  const [card, setCard] = useState<PokemonCardBrief | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scanMsg, setScanMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<CardDetailInfo | null>(null);
  const [variantKey, setVariantKey] = useState<string | null>(null);

  // versões da carta escolhida (Normal, Reverse…): começa na versão base
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

  // dados: lista de coleções e todas as cartas deste Pokémon
  useEffect(() => {
    if (!visible) return;
    if (!sets.length)
      fetchAllSets()
        .then((l) => {
          setSets(l);
          saveSetsCache(l);
        })
        .catch(() => {});
    setLoading(true);
    fetchPokemonCards(dexId)
      .then(setPokemonCards)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [visible, dexId]); // eslint-disable-line react-hooks/exhaustive-deps

  // carta lida na tela principal: já vem preenchida
  useEffect(() => {
    if (!visible || !prefill) return;
    setSetId(prefill.setId);
    setSetText(setById.get(prefill.setId)?.namePt ?? setById.get(prefill.setId)?.nameEn ?? prefill.setId);
    setCard(prefill);
    setCardText(cardTitle(prefill));
    setScanMsg('Carta lida pela câmera — confira o tipo e toque em Adicionar.');
  }, [visible, prefill?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // cartas da coleção escolhida
  useEffect(() => {
    if (!setId) return setSetCards([]);
    fetchSetCards(setId).then(setSetCards).catch(() => setSetCards([]));
  }, [setId]);

  const setById = useMemo(() => new Map(sets.map((s) => [s.id, s])), [sets]);
  const setName = (id: string) => setById.get(id)?.namePt ?? setById.get(id)?.nameEn ?? id;
  const setsWithPokemon = useMemo(() => new Set(pokemonCards.map((c) => c.setId)), [pokemonCards]);
  // código impresso nas cartas (só conhecido para as coleções que já estão em "Minha Coleção")
  const codeOf = (id: string) => data.collections.find((c) => c.setId === id)?.code;

  const setSuggestions: Suggestion[] = useMemo(() => {
    if (setId) return [];
    const list = sets.filter((s) => !setText.trim() || matchesQuery(`${s.namePt ?? ''} ${s.nameEn} ${s.id}`, setText));
    // coleções que têm este Pokémon vêm primeiro
    list.sort((a, b) => Number(setsWithPokemon.has(b.id)) - Number(setsWithPokemon.has(a.id)));
    return list.slice(0, 8).map((s) => ({
      key: s.id,
      title: s.namePt ?? s.nameEn,
      subtitle: setsWithPokemon.has(s.id) ? `tem ${pokemonName}` : s.nameEn !== (s.namePt ?? s.nameEn) ? s.nameEn : undefined,
    }));
  }, [sets, setText, setId, setsWithPokemon, pokemonName]);

  // Só cartas deste Pokémon: as da busca por Pokémon e, na coleção escolhida, as que têm o nome dele
  // (cobre cartas recentes que a fonte ainda não ligou ao número da Pokédex).
  const candidates = useMemo(() => {
    const base = setId ? pokemonCards.filter((c) => c.setId === setId) : pokemonCards;
    const ids = new Set(base.map((c) => c.id));
    const byName = setId ? setCards.filter((c) => !ids.has(c.id) && normalize(c.name).includes(normalize(pokemonName))) : [];
    return [...base, ...byName];
  }, [setId, pokemonCards, setCards, pokemonName]);

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
      .slice(0, 12)
      .map((c) => ({ key: c.id, title: cardTitle(c), subtitle: setId ? undefined : setName(c.setId) }));
  }, [card, candidates, cardText, setId, setById]); // eslint-disable-line react-hooks/exhaustive-deps

  const pickSet = (id: string) => {
    setSetId(id);
    setSetText(setName(id));
    setCard(null);
    setCardText('');
  };
  const pickCard = (id: string) => {
    const c = [...pokemonCards, ...setCards].find((x) => x.id === id);
    if (!c) return;
    setCard(c);
    // escolher a carta já preenche a coleção
    setSetId(c.setId);
    setSetText(setName(c.setId));
    setCardText(cardTitle(c));
  };

  const onRead = (text: string) => {
    setScanning(false);
    const read = parseFooter(text);
    const found = matchFooter(read, pokemonCards, (id) => ({ official: setById.get(id)?.official, code: codeOf(id) }));
    if (!found.length) {
      setScanMsg(
        read.number !== undefined
          ? `Li ${read.promo ?? `${read.number}/${read.total ?? '?'}`}, mas não achei uma carta de ${pokemonName} com esse número. Preencha abaixo.`
          : 'Não consegui ler o número da carta. Preencha abaixo ou tente de novo.',
      );
      return;
    }
    const c = found[0];
    setSetId(c.setId);
    setSetText(setName(c.setId));
    setCard(c);
    setCardText(cardTitle(c));
    setScanMsg(
      found.length > 1
        ? `Encontrei ${found.length} possibilidades; confira a coleção.`
        : `Li ${read.promo ?? `${read.number}/${read.total ?? '?'}`} — confira e toque em Adicionar.`,
    );
  };

  const reset = () => {
    setSetText('');
    setSetId(null);
    setCardText('');
    setCard(null);
    setScanMsg(null);
  };
  const close = () => {
    reset();
    onClose();
  };
  const save = () => {
    if (!card) return;
    const v = detail?.variants.find((x) => x.key === variantKey);
    addPokedexCard(dexId, {
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
    });
    close();
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18 }}>
            <Text style={styles.title}>{`Adicionar carta de ${pokemonName}`}</Text>

            {ocrAvailable ? (
            <Pressable style={styles.camBtn} onPress={() => setScanning(true)}>
              <Text style={styles.camIcon}>📷</Text>
              <View style={{ flex: 1 }}>
                <Text style={styles.camTitle}>Ler pela câmera</Text>
                <Text style={styles.camSub}>Aponte para o rodapé da carta</Text>
              </View>
            </Pressable>
            ) : null}
            {scanMsg ? <Text style={styles.scanMsg}>{scanMsg}</Text> : null}
            {loading ? <ActivityIndicator color={colors.accent} style={{ marginTop: 8 }} /> : null}

            <AutoField
              label="Coleção"
              placeholder="Digite o nome da coleção"
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
            <AutoField
              label="Carta"
              placeholder={setId ? 'Filtrar as miniaturas por número ou nome (opcional)' : `Todas as cartas de ${pokemonName} — digite o número ou o nome`}
              text={cardText}
              onText={(t) => {
                setCardText(t);
                setCard(null);
              }}
              suggestions={cardSuggestions}
              onPick={pickCard}
            />

            {setId && !card ? (
              <CardPickerGrid
                cards={gridCards}
                onPick={(c) => pickCard(c.id)}
                emptyText={cardText.trim() ? 'Nenhuma carta com esse número ou nome.' : `Nenhuma carta de ${pokemonName} nesta expansão.`}
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
                <Text style={styles.label}>Tipo de carta</Text>
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
              </View>
            ) : null}

            {card?.image ? (
              <Image source={{ uri: `${card.image}/high.webp` }} style={styles.preview} contentFit="contain" cachePolicy="disk" />
            ) : null}

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
  input: {
    color: colors.text,
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
  },
  suggestBox: { marginTop: 6, borderRadius: 14, backgroundColor: colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.border, overflow: 'hidden' },
  suggest: { paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border },
  suggestTitle: { color: colors.text, fontWeight: '600' },
  suggestSub: { color: colors.textFaint, fontSize: 11, marginTop: 1 },
  rarity: { color: colors.textDim, fontSize: 12, marginTop: 8 },
  preview: { width: 180, height: 180 * CARD_RATIO, alignSelf: 'center', marginTop: 16, borderRadius: 10 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999, backgroundColor: colors.surface },
});
