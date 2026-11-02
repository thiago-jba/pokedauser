/// <reference lib="dom" />
// Armazenamento de arquivos do app no NAVEGADOR (IndexedDB).
// Tudo é carregado para a memória ao abrir (initKv), para as leituras serem imediatas,
// e cada gravação é salva em segundo plano.

const DB = 'pokecolecao';
const STORE = 'arquivos';
const mem = new Map<string, string>();
let db: IDBDatabase | null = null;

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function initKv(): Promise<void> {
  try {
    db = await openDb();
    await new Promise<void>((resolve) => {
      const tx = db!.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).openCursor();
      req.onsuccess = () => {
        const cur = req.result;
        if (!cur) return resolve();
        mem.set(String(cur.key), String(cur.value));
        cur.continue();
      };
      req.onerror = () => resolve();
    });
  } catch {
    db = null; // modo privado do navegador: funciona só enquanto a aba estiver aberta
  }
}

function persist(path: string, value: string | null) {
  if (!db) return;
  try {
    const tx = db.transaction(STORE, 'readwrite');
    const st = tx.objectStore(STORE);
    if (value === null) st.delete(path);
    else st.put(value, path);
  } catch {}
}

export function kvRead(path: string): string | null {
  return mem.has(path) ? mem.get(path)! : null;
}

export function kvWrite(path: string, text: string): void {
  mem.set(path, text);
  persist(path, text);
}

export function kvDelete(path: string): void {
  mem.delete(path);
  persist(path, null);
}

export function kvReadJson<T>(path: string): T | null {
  const t = kvRead(path);
  if (t === null) return null;
  try {
    return JSON.parse(t) as T;
  } catch {
    return null;
  }
}

export function kvWriteJson(path: string, data: unknown): void {
  kvWrite(path, JSON.stringify(data));
}

/** No navegador o backup é baixado direto como arquivo. */
export function writeTempFile(name: string, text: string): string {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return url;
}

export async function readPickedFile(uri: string): Promise<string> {
  return (await fetch(uri)).text();
}

export function deleteTempFile(_uri: string): void {}
