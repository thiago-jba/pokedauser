import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { StoredSet } from './api';
import { ownedKey, setEntries } from './collection';
import { AppData, CollectionEntry, deleteSet, loadData, saveData, saveSet } from './storage';
import { ApiVariantDetailed, variantKey } from './variants';

export { ownedKey };

interface Store {
  data: AppData;
  isOwned: (setId: string, key: string) => boolean;
  setOwned: (setId: string, keys: string[], value: boolean) => void;
  toggleOwned: (setId: string, key: string) => void;
  upsertCollection: (set: StoredSet) => void;
  removeCollection: (setId: string) => void;
  addCustomVariant: (setId: string, cardId: string, v: ApiVariantDetailed) => void;
  removeCustomVariant: (setId: string, cardId: string, key: string) => void;
  setRarityFilter: (setId: string, rarities: string[]) => void;
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

  const ownedSets = useMemo(() => {
    const m: Record<string, Set<string>> = {};
    for (const [k, v] of Object.entries(data.owned)) m[k] = new Set(v);
    return m;
  }, [data.owned]);

  const isOwned = useCallback((setId: string, key: string) => !!ownedSets[setId]?.has(key), [ownedSets]);

  const setOwned = useCallback((setId: string, keys: string[], value: boolean) => {
    setData((d) => {
      const cur = new Set(d.owned[setId] ?? []);
      for (const k of keys) value ? cur.add(k) : cur.delete(k);
      return { ...d, owned: { ...d.owned, [setId]: [...cur] } };
    });
  }, []);

  const toggleOwned = useCallback((setId: string, key: string) => {
    setData((d) => {
      const cur = new Set(d.owned[setId] ?? []);
      cur.has(key) ? cur.delete(key) : cur.add(key);
      return { ...d, owned: { ...d.owned, [setId]: [...cur] } };
    });
  }, []);

  const upsertCollection = useCallback((set: StoredSet) => {
    saveSet(set);
    setData((d) => {
      const entry: CollectionEntry = {
        setId: set.id,
        namePt: set.namePt,
        nameEn: set.nameEn,
        logo: set.logo,
        symbol: set.symbol,
        releaseDate: set.releaseDate,
        serieName: set.serieName,
        addedAt: d.collections.find((c) => c.setId === set.id)?.addedAt ?? new Date().toISOString(),
        totalCards: set.cards.length,
      };
      // remove marcações de variantes que deixaram de existir
      const valid = new Set(setEntries(set, d.custom[set.id]).map((e) => e.key));
      const owned = (d.owned[set.id] ?? []).filter((k) => valid.has(k));
      const others = d.collections.filter((c) => c.setId !== set.id);
      return { ...d, collections: [entry, ...others], owned: { ...d.owned, [set.id]: owned } };
    });
  }, []);

  const removeCollection = useCallback((setId: string) => {
    deleteSet(setId);
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
      const owned = (d.owned[setId] ?? []).filter((k) => k !== ownedKey(cardId, key));
      return { ...d, custom: { ...d.custom, [setId]: forSet }, owned: { ...d.owned, [setId]: owned } };
    });
  }, []);

  const setRarityFilter = useCallback((setId: string, rarities: string[]) => {
    setData((d) => ({ ...d, filters: { ...d.filters, [setId]: { ...d.filters[setId], rarities } } }));
  }, []);

  const reload = useCallback(() => setData(loadData()), []);

  const value = useMemo(
    () => ({
      data,
      isOwned,
      setOwned,
      toggleOwned,
      upsertCollection,
      removeCollection,
      addCustomVariant,
      removeCustomVariant,
      setRarityFilter,
      reload,
    }),
    [data, isOwned, setOwned, toggleOwned, upsertCollection, removeCollection, addCustomVariant, removeCustomVariant, setRarityFilter, reload],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useStore(): Store {
  const s = useContext(Ctx);
  if (!s) throw new Error('StoreProvider ausente');
  return s;
}
