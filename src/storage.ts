// Armazenamento local no celular (arquivos JSON na pasta privada do app).
import { kvDelete, kvReadJson, kvWrite, readPickedFile, writeTempFile } from './kv';
import type { SetSummary, StoredSet } from './api';
import { ApiVariantDetailed, detectSetWideStamps, keyToVariant } from './variants';

export interface CollectionEntry {
  setId: string;
  namePt?: string;
  nameEn: string;
  logo?: string;
  symbol?: string;
  releaseDate?: string;
  serieName?: string;
  addedAt: string;
  /** código impresso nas cartas (ex.: "30C") */
  code?: string;
  /** true quando a data de lançamento foi corrigida à mão (não é sobrescrita ao atualizar) */
  releaseDateManual?: boolean;
  totalVariants?: number;
  totalCards?: number;
}

export interface AppData {
  version: 1;
  collections: CollectionEntry[];
  /** setId -> "cardId#variantKey" -> país da carta que eu tenho (código ISO, ex.: "BR") */
  owned: Record<string, Record<string, string>>;
  /** setId -> cardId -> variantes adicionadas à mão */
  custom: Record<string, Record<string, ApiVariantDetailed[]>>;
  /** setId -> último filtro de raridade usado */
  filters: Record<string, { rarities?: string[]; categories?: string[]; sort?: string }>;
  /** ordenação escolhida na tela inicial */
  homeSort?: string;
  /** visualização da tela inicial: quadros ou lista */
  homeView?: 'grade' | 'lista';
  /** eras recolhidas na tela inicial */
  collapsedEras?: string[];
  /** configurações do app */
  settings?: AppSettings;
  /** setId -> modo da coleção e variações incluídas/ocultadas pelo usuário */
  prefs?: Record<string, { mode?: 'principal' | 'especial'; included?: string[]; excluded?: string[]; imageEn?: string[] }>;
  /** Pokédex: número do Pokémon -> cartas que tenho dele */
  pokedex?: Record<string, PokedexCard[]>;
  /** filtros salvos da tela da Pokédex */
  pokedexFilters?: { categories?: string[]; rarities?: string[] };
  /** Coleções Especiais (Pikachu's, Energias…) — separadas das expansões e da Pokédex */
  specials?: SpecialCollection[];
}

export type SpecialKind = 'pokemon' | 'energia' | 'nome';

export interface SpecialCollection {
  uid: string;
  name: string;
  /** pokemon: cartas do Pokémon (número da Pokédex + nome); energia: cartas de Energia; nome: qualquer carta com o termo no nome */
  kind: SpecialKind;
  dexId?: number;
  /** nome procurado nas cartas (ex.: "Pikachu") */
  term?: string;
  createdAt: string;
  cards: SpecialCard[];
}

export interface SpecialCard extends PokedexCard {
  /** país da carta (código ISO, ex.: "BR") */
  country: string;
}

export interface PokedexCard {
  /** identificador único desta entrada (posso ter a mesma carta duas vezes) */
  uid: string;
  cardId: string;
  setId: string;
  setName: string;
  localId: string;
  name: string;
  /** URL base da imagem da TCGdex (sem /low.webp) */
  image?: string;
  official?: number;
  addedAt: string;
  /** versão escolhida (Normal, Reverse, Holo…) */
  variantKey?: string;
  variantLabel?: string;
  /** categoria da versão (normal, reverse, holo, promo…), usada no filtro "Tipo de carta" */
  category?: string;
  /** raridade em português */
  rarity?: string;
  /** nome em inglês (links das lojas) */
  nameEn?: string;
}

export interface AppSettings {
  /** país usado ao marcar uma carta com um toque (código ISO, ex.: "BR") */
  defaultCountry?: string;
}

export const emptyData = (): AppData => ({ version: 1, collections: [], owned: {}, custom: {}, filters: {} });

const MAIN = 'colecao.json';
const SETS_CACHE = 'lista_expansoes.json';
const safeName = (id: string) => id.replace(/[^a-zA-Z0-9._-]/g, '_');
const setPath = (id: string) => `sets/${safeName(id)}.json`;

export function loadData(): AppData {
  return normalizeData(kvReadJson<AppData>(MAIN));
}

/** Garante todos os campos (dados antigos, vindos da nuvem ou de backup). */
export function normalizeData(d: any): AppData {
  if (!d || !Array.isArray(d.collections)) return emptyData();
  return {
    version: 1,
    collections: d.collections,
    owned: migrateOwned(d.owned),
    custom: d.custom ?? {},
    filters: d.filters ?? {},
    homeSort: d.homeSort,
    homeView: d.homeView,
    collapsedEras: d.collapsedEras ?? [],
    settings: d.settings ?? {},
    prefs: d.prefs ?? {},
    pokedex: d.pokedex ?? {},
    pokedexFilters: d.pokedexFilters ?? {},
    specials: (d.specials ?? []).map((c: any) => ({ ...c, cards: c.cards ?? [] })),
  };
}

/** Versões até 31/10 guardavam só a lista do que eu tenho: tudo vira carta nacional (Brasil). */
function migrateOwned(owned: any): AppData['owned'] {
  const out: AppData['owned'] = {};
  for (const [setId, v] of Object.entries(owned ?? {})) {
    if (Array.isArray(v)) out[setId] = Object.fromEntries(v.map((k: string) => [k, 'BR']));
    else if (v && typeof v === 'object') out[setId] = v as Record<string, string>;
  }
  return out;
}

export function saveData(data: AppData) {
  kvWrite(MAIN, JSON.stringify(data));
}

const setCache = new Map<string, StoredSet>();

/** Converte coleções salvas pela versão 1.0.1–1.0.3 do app (sem precisar de internet). */
function migrateSet(old: any): StoredSet {
  const cards = (old.cards ?? []).map((c: any) => ({
    id: c.id,
    localId: c.localId,
    name: c.name,
    image: c.image,
    rarity: c.rarity,
    category: c.category,
    raw: c.raw ?? (c.variants ?? []).map((v: any) => keyToVariant(v.key)),
  }));
  const isPromoSet = /promo/i.test(old.nameEn ?? '') || /promo/i.test(old.serieName ?? '');
  return { ...old, schema: 2, cards, isPromoSet, ignoredStamps: detectSetWideStamps(cards) };
}

export function loadSet(id: string): StoredSet | null {
  const cached = setCache.get(id);
  if (cached) return cached;
  let s = kvReadJson<any>(setPath(id));
  if (!s) return null;
  if (s.schema !== 2) {
    s = migrateSet(s);
    try {
      saveSet(s);
    } catch {}
  }
  setCache.set(id, s);
  return s;
}

export function saveSet(set: StoredSet) {
  kvWrite(setPath(set.id), JSON.stringify(set));
  setCache.set(set.id, set);
}

export function deleteSet(id: string) {
  kvDelete(setPath(id));
  setCache.delete(id);
}

const SETS_CACHE_DAYS = 3;

export function loadSetsCache(): SetSummary[] | null {
  const c = kvReadJson<{ fetchedAt: string; list: SetSummary[] }>(SETS_CACHE);
  if (!c) return null;
  const age = Date.now() - new Date(c.fetchedAt).getTime();
  return age < SETS_CACHE_DAYS * 86400000 ? c.list : null;
}

export function loadSetsCacheAnyAge(): SetSummary[] | null {
  return kvReadJson<{ fetchedAt: string; list: SetSummary[] }>(SETS_CACHE)?.list ?? null;
}

export function saveSetsCache(list: SetSummary[]) {
  kvWrite(SETS_CACHE, JSON.stringify({ fetchedAt: new Date().toISOString(), list }));
}

// ---------- Backup ----------

export interface BackupFile {
  app: 'pokecolecao';
  version: 1;
  exportedAt: string;
  data: AppData;
  sets: StoredSet[];
}

export function buildBackup(data: AppData): BackupFile {
  const sets = data.collections.map((c) => loadSet(c.setId)).filter((s): s is StoredSet => !!s);
  return { app: 'pokecolecao', version: 1, exportedAt: new Date().toISOString(), data, sets };
}

/** Grava o backup num arquivo temporário e devolve o caminho para compartilhar. */
export function writeBackupFile(backup: BackupFile): string {
  const stamp = backup.exportedAt.slice(0, 10);
  return writeTempFile(`backup-colecao-pokemon-${stamp}.json`, JSON.stringify(backup));
}

export async function readBackupFile(uri: string): Promise<BackupFile> {
  const text = await readPickedFile(uri);
  const parsed = JSON.parse(text);
  if (parsed?.app !== 'pokecolecao' || !parsed?.data?.collections) {
    throw new Error('Este arquivo não é um backup do app.');
  }
  return parsed as BackupFile;
}

export function restoreBackup(b: BackupFile) {
  for (const s of b.sets ?? []) saveSet((s as any).schema === 2 ? s : migrateSet(s));
  saveData({
    version: 1,
    collections: b.data.collections,
    owned: migrateOwned(b.data.owned),
    custom: b.data.custom ?? {},
    filters: b.data.filters ?? {},
    homeSort: b.data.homeSort,
    homeView: b.data.homeView,
    collapsedEras: b.data.collapsedEras ?? [],
    settings: b.data.settings ?? {},
    prefs: b.data.prefs ?? {},
    pokedex: b.data.pokedex ?? {},
    pokedexFilters: b.data.pokedexFilters ?? {},
    specials: b.data.specials ?? [],
  });
}
