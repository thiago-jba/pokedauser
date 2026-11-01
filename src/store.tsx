import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { StoredSet } from './api';
import { allPossibleKeys, ownedKey } from './collection';
import type { SetMode, SetPrefs } from './collection';
import { deleteSetPrices } from './prices';
import { AppData, CollectionEntry, deleteSet, loadData, PokedexCard, saveData, saveSet } from './storage';
import { DEFAULT_COUNTRY } from './countries';
import { ApiVariantDetailed, variantKey } from './variants';

export { ownedKey };

interface Store {
  data: AppData;
  isOwned: (setId: string, key: string) => boolean;
  /** país da carta que eu tenho (undefined = não tenho) */
  ownedCountry: (setId: string, key: string) => string | undefined;
  setCountry: (setId: string, key: string, country: string) => void;
  setOwned: (setId: string, keys: string[], value: boolean) => void;
  toggleOwned: (setId: string, key: string) => void;
  upsertCollection: (set: StoredSet) => void;
  removeCollection: (setId: string) => void;
  addCustomVariant: (setId: string, cardId: string, v: ApiVariantDetailed) => void;
  removeCustomVariant: (setId: string, cardId: string, key: string) => void;
  setRarityFilter: (setId: string, rarities: string[]) => void;
  setCategoryFilter: (setId: string, categories: string[]) => void;
  setCardSort: (setId: string, sort: string) => void;
  /** preferências da coleção (modo, variações incluídas/ocultadas, adicionadas à mão) */
  prefsFor: (setId: string) => SetPrefs;
  setSetMode: (setId: string, mode: SetMode) => void;
  includeVariant: (setId: string, key: string) => void;
  excludeVariant: (setId: string, key: string) => void;
  /** oculta várias variações de uma vez (as que estão na tela) */
  excludeVariants: (setId: string, keys: string[]) => void;
  /** volta a mostrar todas as variações ocultas da coleção */
  restoreExcluded: (setId: string) => void;
  setHomeSort: (sort: string) => void;
  addPokedexCard: (dexId: number, card: Omit<PokedexCard, 'uid' | 'addedAt'>) => void;
  removePokedexCard: (dexId: number, uid: string) => void;
  setPokedexFilters: (f: { categories?: string[]; rarities?: string[] }) => void;
  /** país padrão ao marcar uma carta (Configurações) */
  defaultCountry: string;
  setDefaultCountry: (code: string) => void;
  setHomeView: (view: 'grade' | 'lista') => void;
  toggleEra: (era: string) => void;
  patchCollection: (setId: string, fields: Partial<CollectionEntry>) => void;
  reload: () => void;
}

const Ctx = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<AppData>(() => loadData());
  const first = useRef(true);

  // grava no celular a cada alteração (agrupando toques rápidos)
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const t = setTimeout(() => {
      try {
        saveData(data);
      } catch (e) {
        console.warn('Falha ao salvar', e);
      }
    }, 250);
    return () => clearTimeout(t);
  }, [data]);

  const owned = data.owned;
  const isOwned = useCallback((setId: string, key: string) => !!owned[setId]?.[key], [owned]);
  const ownedCountry = useCallback((setId: string, key: string) => owned[setId]?.[key], [owned]);

  // marcar = país padrão das Configurações (Brasil, se não escolheu outro); quem já tem país mantém o seu
  const setOwned = useCallback((setId: string, keys: string[], value: boolean) => {
    setData((d) => {
      const cur = { ...(d.owned[setId] ?? {}) };
      for (const k of keys) {
        if (value) cur[k] = cur[k] ?? d.settings?.defaultCountry ?? DEFAULT_COUNTRY;
        else delete cur[k];
      }
      return { ...d, owned: { ...d.owned, [setId]: cur } };
    });
  }, []);

  const toggleOwned = useCallback((setId: string, key: string) => {
    setData((d) => {
      const cur = { ...(d.owned[setId] ?? {}) };
      if (cur[key]) delete cur[key];
      else cur[key] = d.settings?.defaultCountry ?? DEFAULT_COUNTRY;
      return { ...d, owned: { ...d.owned, [setId]: cur } };
    });
  }, []);

  const setCountry = useCallback((setId: string, key: string, country: string) => {
    setData((d) => ({ ...d, owned: { ...d.owned, [setId]: { ...(d.owned[setId] ?? {}), [key]: country } } }));
  }, []);

  const upsertCollection = useCallback((set: StoredSet) => {
    saveSet(set);
    setData((d) => {
      const prev = d.collections.find((c) => c.setId === set.id);
      const entry: CollectionEntry = {
        ...prev,
        setId: set.id,
        namePt: set.namePt,
        nameEn: set.nameEn,
        logo: set.logo,
        symbol: set.symbol,
        // data corrigida à mão tem prioridade sobre a da fonte de dados
        releaseDate: prev?.releaseDateManual ? prev.releaseDate : set.releaseDate,
        serieName: set.serieName,
        code: set.code ?? prev?.code,
        addedAt: prev?.addedAt ?? new Date().toISOString(),
        totalCards: set.cards.length,
      };
      // remove marcações de variantes que deixaram de existir
      const valid = allPossibleKeys(set, d.custom[set.id]);
      const owned = Object.fromEntries(Object.entries(d.owned[set.id] ?? {}).filter(([k]) => valid.has(k)));
      const others = d.collections.filter((c) => c.setId !== set.id);
      return { ...d, collections: [entry, ...others], owned: { ...d.owned, [set.id]: owned } };
    });
  }, []);

  const removeCollection = useCallback((setId: string) => {
    deleteSet(setId);
    deleteSetPrices(setId);
    setData((d) => {
      const owned = { ...d.owned };
      const custom = { ...d.custom };
      const filters = { ...d.filters };
      delete owned[setId];
      delete custom[setId];
      delete filters[setId];
      return { ...d, collections: d.collections.filter((c) => c.setId !== setId), owned, custom, filters };
    });
  }, []);

  const addCustomVariant = useCallback((setId: string, cardId: string, v: ApiVariantDetailed) => {
    setData((d) => {
      const forSet = { ...(d.custom[setId] ?? {}) };
      const list = forSet[cardId] ?? [];
      if (list.some((x) => variantKey(x) === variantKey(v))) return d;
      forSet[cardId] = [...list, v];
      return { ...d, custom: { ...d.custom, [setId]: forSet } };
    });
  }, []);

  const removeCustomVariant = useCallback((setId: string, cardId: string, key: string) => {
    setData((d) => {
      const forSet = { ...(d.custom[setId] ?? {}) };
      forSet[cardId] = (forSet[cardId] ?? []).filter((x) => variantKey(x) !== key);
      const owned = { ...(d.owned[setId] ?? {}) };
      delete owned[ownedKey(cardId, key)];
      return { ...d, custom: { ...d.custom, [setId]: forSet }, owned: { ...d.owned, [setId]: owned } };
    });
  }, []);

  const setRarityFilter = useCallback((setId: string, rarities: string[]) => {
    setData((d) => ({ ...d, filters: { ...d.filters, [setId]: { ...d.filters[setId], rarities } } }));
  }, []);

  const setCategoryFilter = useCallback((setId: string, categories: string[]) => {
    setData((d) => ({ ...d, filters: { ...d.filters, [setId]: { ...d.filters[setId], categories } } }));
  }, []);

  const prefsMap = data.prefs;
  const customMap = data.custom;
  const prefsFor = useCallback(
    (setId: string): SetPrefs => ({ custom: customMap[setId], ...(prefsMap?.[setId] ?? {}) }),
    [prefsMap, customMap],
  );
  const updPrefs = (setId: string, f: (p: NonNullable<AppData['prefs']>[string]) => NonNullable<AppData['prefs']>[string]) =>
    setData((d) => ({ ...d, prefs: { ...(d.prefs ?? {}), [setId]: f({ ...(d.prefs?.[setId] ?? {}) }) } }));
  const setSetMode = useCallback((setId: string, mode: SetMode) => updPrefs(setId, (p) => ({ ...p, mode })), []); // eslint-disable-line react-hooks/exhaustive-deps
  // incluir: tira das ocultadas; se não estava oculta, entra como extra incluída
  const includeVariant = useCallback(
    (setId: string, key: string) =>
      updPrefs(setId, (p) =>
        (p.excluded ?? []).includes(key)
          ? { ...p, excluded: p.excluded!.filter((k) => k !== key) }
          : { ...p, included: [...new Set([...(p.included ?? []), key])] },
      ),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  // ocultar: tira das incluídas; se fazia parte da coleção pela regra, vai para as ocultadas
  const excludeVariant = useCallback(
    (setId: string, key: string) =>
      updPrefs(setId, (p) =>
        (p.included ?? []).includes(key)
          ? { ...p, included: p.included!.filter((k) => k !== key) }
          : { ...p, excluded: [...new Set([...(p.excluded ?? []), key])] },
      ),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const excludeVariants = useCallback(
    (setId: string, keys: string[]) =>
      updPrefs(setId, (p) => {
        const ks = new Set(keys);
        const included = (p.included ?? []).filter((k) => !ks.has(k));
        const wasIncluded = new Set(p.included ?? []);
        // as que eram extras incluídas só saem das incluídas; as demais vão para as ocultas
        const toExclude = keys.filter((k) => !wasIncluded.has(k));
        return { ...p, included, excluded: [...new Set([...(p.excluded ?? []), ...toExclude])] };
      }),
    [], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const restoreExcluded = useCallback((setId: string) => updPrefs(setId, (p) => ({ ...p, excluded: [] })), []); // eslint-disable-line react-hooks/exhaustive-deps
  const setCardSort = useCallback((setId: string, sort: string) => {
    setData((d) => ({ ...d, filters: { ...d.filters, [setId]: { ...d.filters[setId], sort } } }));
  }, []);
  const addPokedexCard = useCallback((dexId: number, card: Omit<PokedexCard, 'uid' | 'addedAt'>) => {
    const entry: PokedexCard = { ...card, uid: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, addedAt: new Date().toISOString() };
    setData((d) => ({ ...d, pokedex: { ...(d.pokedex ?? {}), [dexId]: [...(d.pokedex?.[dexId] ?? []), entry] } }));
  }, []);
  const removePokedexCard = useCallback((dexId: number, uid: string) => {
    setData((d) => ({ ...d, pokedex: { ...(d.pokedex ?? {}), [dexId]: (d.pokedex?.[dexId] ?? []).filter((c) => c.uid !== uid) } }));
  }, []);
  const setPokedexFilters = useCallback(
    (f: { categories?: string[]; rarities?: string[] }) => setData((d) => ({ ...d, pokedexFilters: { ...d.pokedexFilters, ...f } })),
    [],
  );
  const setHomeSort = useCallback((homeSort: string) => setData((d) => ({ ...d, homeSort })), []);
  const defaultCountry = data.settings?.defaultCountry ?? DEFAULT_COUNTRY;
  const setDefaultCountry = useCallback(
    (code: string) => setData((d) => ({ ...d, settings: { ...d.settings, defaultCountry: code } })),
    [],
  );
  const setHomeView = useCallback((homeView: 'grade' | 'lista') => setData((d) => ({ ...d, homeView })), []);
  const toggleEra = useCallback((era: string) => {
    setData((d) => {
      const cur = new Set(d.collapsedEras ?? []);
      cur.has(era) ? cur.delete(era) : cur.add(era);
      return { ...d, collapsedEras: [...cur] };
    });
  }, []);
  const patchCollection = useCallback((setId: string, fields: Partial<CollectionEntry>) => {
    setData((d) => ({
      ...d,
      collections: d.collections.map((c) => (c.setId === setId ? { ...c, ...fields } : c)),
    }));
  }, []);

  const reload = useCallback(() => setData(loadData()), []);

  const value = useMemo(
    () => ({
      data,
      isOwned,
      ownedCountry,
      setCountry,
      setOwned,
      toggleOwned,
      upsertCollection,
      removeCollection,
      addCustomVariant,
      removeCustomVariant,
      setRarityFilter,
      setCategoryFilter,
      setCardSort,
      prefsFor,
      setSetMode,
      includeVariant,
      excludeVariant,
      excludeVariants,
      restoreExcluded,
      setHomeSort,
      addPokedexCard,
      removePokedexCard,
      setPokedexFilters,
      defaultCountry,
      setDefaultCountry,
      setHomeView,
      toggleEra,
      patchCollection,
      reload,
    }),
    [data, isOwned, ownedCountry, setCountry, setOwned, toggleOwned, upsertCollection, removeCollection, addCustomVariant, removeCustomVariant, setRarityFilter, setCategoryFilter, setCardSort, prefsFor, setSetMode, includeVariant, excludeVariant, excludeVariants, restoreExcluded, setHomeSort, addPokedexCard, removePokedexCard, setPokedexFilters, defaultCountry, setDefaultCountry, setHomeView, toggleEra, patchCollection, reload],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider ausente');
  return s;
}
