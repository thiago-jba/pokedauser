import { Image } from 'expo-image';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchAllSets, SetSummary } from '../api';
import { artTitle, bulbapediaUrl, fetchBoosterArts } from '../boosters';
import type { BoosterArt } from '../boosters';
import { countryName } from '../countries';
import { loadSetsCacheAnyAge, saveSetsCache } from '../storage';
import { useStore } from '../store';
import { colors } from '../theme';
import { matchesQuery } from '../variants';
import { AutoField } from './AddPokedexCard';
import type { Suggestion } from './AddPokedexCard';
import { CountryPicker } from './CountryPicker';
import { Flag } from './Flag';

/** Proporção altura/largura das imagens de booster da Bulbapedia (300 x 550). */
export const BOOSTER_RATIO = 550 / 300;

/** Inclusão de boosters: escolhe a expansão, toca na estampa, escolhe o país. Fica aberta para incluir vários. */
export function AddBooster({ visible, onClose, initialSetId }: { visible: boolean; onClose: () => void; initialSetId?: string }) {
  const { addBooster, data, defaultCountry } = useStore();
  const [sets, setSets] = useState<SetSummary[]>(() => loadSetsCacheAnyAge() ?? []);
  const [setText, setSetText] = useState('');
  const [setId, setSetId] = useState<string | null>(null);
  const [arts, setArts] = useState<BoosterArt[]>([]);
  const [page, setPage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [art, setArt] = useState<BoosterArt | null>(null);
  const [country, setCountry] = useState(defaultCountry);
  const [pickingCountry, setPickingCountry] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [w, setW] = useState(0);

  const setById = useMemo(() => new Map(sets.map((s) => [s.id, s])), [sets]);
  const setName = (id: string) => setById.get(id)?.namePt ?? setById.get(id)?.nameEn ?? id;

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
    if (initialSetId) pickSet(initialSetId);
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const load = (id: string, force = false) => {
    setLoading(true);
    setError(null);
    setArts([]);
    setPage(null);
    fetchBoosterArts(id, force)
      .then((r) => {
        setArts(r.arts);
        setPage(r.page);
        if (!r.arts.length) setError(r.page ? 'A Bulbapedia não tem fotos dos boosters desta expansão.' : 'Não achei esta expansão na Bulbapedia.');
      })
      .catch(() => setError('Não foi possível buscar as estampas agora (Bulbapedia). Toque para tentar de novo.'))
      .finally(() => setLoading(false));
  };

  const pickSet = (id: string) => {
    setSetId(id);
    setSetText(setName(id));
    setArt(null);
    setDone(null);
    load(id);
  };

  const suggestions: Suggestion[] = useMemo(() => {
    if (setId) return [];
    const t = setText.trim();
    if (!t) return [];
    return sets
      .filter((s) => matchesQuery(`${s.namePt ?? ''} ${s.nameEn} ${s.id}`, t))
      .slice(0, 8)
      .map((s) => ({ key: s.id, title: s.namePt ?? s.nameEn, subtitle: s.nameEn !== (s.namePt ?? s.nameEn) ? s.nameEn : undefined }));
  }, [sets, setText, setId]);

  // quantos de cada estampa já tenho
  const have = useMemo(() => {
    const m = new Map<string, number>();
    for (const b of data.boosters ?? []) if (b.setId === setId) m.set(b.file, (m.get(b.file) ?? 0) + 1);
    return m;
  }, [data.boosters, setId]);

  const close = () => {
    setSetText('');
    setSetId(null);
    setArts([]);
    setArt(null);
    setError(null);
    setDone(null);
    onClose();
  };
  const save = () => {
    if (!art || !setId) return;
    addBooster({ setId, setName: setName(setId), file: art.file, label: art.label, lang: art.lang, image: art.image, country });
    setDone(`✓ Adicionado: ${artTitle(art)} · ${countryName(country)}. Escolha outro ou toque em Concluir.`);
    setArt(null);
  };

  const cols = w >= 600 ? 5 : w >= 420 ? 4 : 3;
  const gap = 10;
  const tile = w ? (w - gap * (cols - 1)) / cols : 0;
  const intl = arts.filter((a) => !a.lang);
  const others = arts.filter((a) => a.lang);

  const grid = (list: BoosterArt[]) => (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap }}>
      {list.map((a) => {
        const on = art?.file === a.file;
        const n = have.get(a.file) ?? 0;
        return (
          <Pressable
            key={a.file}
            style={{ width: tile }}
            onPress={() => {
              setArt(on ? null : a);
              setDone(null);
            }}
          >
            <View style={[styles.frame, { height: tile * BOOSTER_RATIO }, on && styles.frameOn]}>
              {a.image ? <Image source={{ uri: a.image }} style={StyleSheet.absoluteFill} contentFit="contain" cachePolicy="disk" /> : null}
              {n ? (
                <View style={styles.have}>
                  <Text style={styles.haveText}>{`tenho ${n}`}</Text>
                </View>
              ) : null}
              {on ? (
                <View style={styles.check}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              ) : null}
            </View>
            <Text style={[styles.artName, on && { color: colors.text }]} numberOfLines={2}>
              {artTitle(a)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <Pressable style={styles.backdrop} onPress={close}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 18 }}>
            <Text style={styles.title}>Adicionar booster</Text>
            <AutoField
              label="Expansão"
              placeholder="Digite o nome da expansão"
              text={setText}
              onText={(t) => {
                setSetText(t);
                setSetId(null);
                setArts([]);
                setArt(null);
                setError(null);
              }}
              suggestions={suggestions}
              onPick={pickSet}
            />

            <View onLayout={(e) => setW(e.nativeEvent.layout.width)} style={{ marginTop: 14 }}>
              {loading ? <ActivityIndicator color={colors.accent} /> : null}
              {error ? (
                <Pressable onPress={() => setId && load(setId, true)}>
                  <Text style={styles.error}>{error}</Text>
                </Pressable>
              ) : null}
              {tile && intl.length ? (
                <>
                  <Text style={styles.label}>{`Estampas (${intl.length})`}</Text>
                  {grid(intl)}
                </>
              ) : null}
              {tile && others.length ? (
                <>
                  <Text style={[styles.label, { marginTop: 14 }]}>{`Outros idiomas (${others.length})`}</Text>
                  {grid(others)}
                </>
              ) : null}
              {page && arts.length ? (
                <Pressable onPress={() => Linking.openURL(bulbapediaUrl(page)).catch(() => {})} style={{ marginTop: 10 }}>
                  <Text style={styles.source}>Fotos: Bulbapedia ›</Text>
                </Pressable>
              ) : null}
            </View>

            {art ? (
              <View style={{ marginTop: 14 }}>
                <Text style={styles.label}>País do booster</Text>
                <Pressable style={styles.countryBtn} onPress={() => setPickingCountry(true)}>
                  <Flag code={country} size={20} />
                  <Text style={styles.countryText}>{countryName(country)}</Text>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              </View>
            ) : null}
            {done ? <Text style={styles.done}>{done}</Text> : null}

            <View style={styles.actions}>
              <Pressable onPress={close} style={styles.btn}>
                <Text style={{ color: colors.textDim, fontWeight: '700' }}>{done ? 'Concluir' : 'Cancelar'}</Text>
              </Pressable>
              <Pressable onPress={save} disabled={!art} style={[styles.btn, { backgroundColor: art ? colors.accent : colors.surface }]}>
                <Text style={{ color: art ? '#fff' : colors.textFaint, fontWeight: '800' }}>Adicionar</Text>
              </Pressable>
            </View>
          </ScrollView>
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
  label: { color: colors.textFaint, fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 },
  error: { color: colors.gold, fontSize: 13 },
  frame: { borderRadius: 8, overflow: 'hidden', backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent' },
  frameOn: { borderColor: colors.accent },
  check: { position: 'absolute', top: 4, right: 4, width: 22, height: 22, borderRadius: 11, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center' },
  checkText: { color: '#fff', fontWeight: '900', fontSize: 12 },
  have: { position: 'absolute', bottom: 4, left: 4, backgroundColor: colors.gold, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 1 },
  haveText: { color: '#1a1300', fontWeight: '900', fontSize: 10 },
  artName: { color: colors.textDim, fontSize: 11, marginTop: 4, textAlign: 'center', fontWeight: '700' },
  source: { color: colors.textFaint, fontSize: 11 },
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
  done: { color: colors.success, marginTop: 12, fontSize: 13, fontWeight: '700' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10, marginTop: 18 },
  btn: { paddingHorizontal: 18, paddingVertical: 11, borderRadius: 999, backgroundColor: colors.surface },
});
