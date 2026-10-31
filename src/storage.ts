// Armazenamento local no celular (arquivos JSON na pasta privada do app).
import { Directory, File, Paths } from 'expo-file-system';
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
  filters: Record<string, { rarities?: string[]; categories?: string[] }>;
  /** ordenação escolhida na tela inicial */
  homeSort?: string;
}

export const emptyData = (): AppData => ({ version: 1, collections: [], owned: {}, custom: {}, filters: {} });

const setsDir = () => new Directory(Paths.document, 'sets');
const mainFile = () => new File(Paths.document, 'colecao.json');
const setsCacheFile = () => new File(Paths.document, 'lista_expansoes.json');
const safeName = (id: string) => id.replace(/[^a-zA-Z0-9._-]/g, '_');
const setFile = (id: string) => new File(setsDir(), `${safeName(id)}.json`);

function writeText(file: File, text: string) {
  if (!file.exists) file.create({ intermediates: true } as any);
  file.write(text);
}

function readJson<T>(file: File): T | null {
  try {
    if (!file.exists) return null;
    return JSON.parse(file.textSync()) as T;
  } catch {
    return null;
  }
}

function ensureDirs() {
  const d = setsDir();
  if (!d.exists) d.create({ intermediates: true, idempotent: true } as any);
}

export function loadData(): AppData {
  const d = readJson<AppData>(mainFile());
  if (!d || !Array.isArray(d.collections)) return emptyData();
  return {
    version: 1,
    collections: d.collections,
    owned: migrateOwned(d.owned),
    custom: d.custom ?? {},
    filters: d.filters ?? {},
    homeSort: d.homeSort,
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
  writeText(mainFile(), JSON.stringify(data));
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
  let s = readJson<any>(setFile(id));
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
  ensureDirs();
  writeText(setFile(set.id), JSON.stringify(set));
  setCache.set(set.id, set);
}

export function deleteSet(id: string) {
  try {
    const f = setFile(id);
    if (f.exists) f.delete();
  } catch {}
  setCache.delete(id);
}

const SETS_CACHE_DAYS = 3;

export function loadSetsCache(): SetSummary[] | null {
  const c = readJson<{ fetchedAt: string; list: SetSummary[] }>(setsCacheFile());
  if (!c) return null;
  const age = Date.now() - new Date(c.fetchedAt).getTime();
  return age < SETS_CACHE_DAYS * 86400000 ? c.list : null;
}

export function loadSetsCacheAnyAge(): SetSummary[] | null {
  return readJson<{ fetchedAt: string; list: SetSummary[] }>(setsCacheFile())?.list ?? null;
}

export function saveSetsCache(list: SetSummary[]) {
  writeText(setsCacheFile(), JSON.stringify({ fetchedAt: new Date().toISOString(), list }));
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
  const f = new File(Paths.cache, `backup-colecao-pokemon-${stamp}.json`);
  if (f.exists) f.delete();
  writeText(f, JSON.stringify(backup));
  return f.uri;
}

export async function readBackupFile(uri: string): Promise<BackupFile> {
  const text = await new File(uri).text();
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
  });
}
