// Armazenamento local no celular (arquivos JSON na pasta privada do app).
import { Directory, File, Paths } from 'expo-file-system';
import type { SetSummary, StoredSet } from './api';

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
  /** setId -> lista de "cardId#variantKey" que eu tenho */
  owned: Record<string, string[]>;
}

export const emptyData = (): AppData => ({ version: 1, collections: [], owned: {} });

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
  return { version: 1, collections: d.collections, owned: d.owned ?? {} };
}

export function saveData(data: AppData) {
  writeText(mainFile(), JSON.stringify(data));
}

export function loadSet(id: string): StoredSet | null {
  return readJson<StoredSet>(setFile(id));
}

export function saveSet(set: StoredSet) {
  ensureDirs();
  writeText(setFile(set.id), JSON.stringify(set));
}

export function deleteSet(id: string) {
  try {
    const f = setFile(id);
    if (f.exists) f.delete();
  } catch {}
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
  for (const s of b.sets ?? []) saveSet(s);
  saveData({ version: 1, collections: b.data.collections, owned: b.data.owned ?? {} });
}
