// Armazenamento de arquivos do app no CELULAR (pasta privada do app).
// A versão para navegador fica em kv.web.ts, com as mesmas funções.
import { Directory, File, Paths } from 'expo-file-system';

const parts = (path: string) => path.split('/').filter(Boolean);

function fileOf(path: string): File {
  return new File(Paths.document, ...parts(path));
}

/** No celular os arquivos já estão prontos; no navegador é preciso carregar antes. */
export async function initKv(): Promise<void> {}

export function kvRead(path: string): string | null {
  try {
    const f = fileOf(path);
    return f.exists ? f.textSync() : null;
  } catch {
    return null;
  }
}

export function kvWrite(path: string, text: string): void {
  const p = parts(path);
  if (p.length > 1) {
    const dir = new Directory(Paths.document, ...p.slice(0, -1));
    if (!dir.exists) dir.create({ intermediates: true, idempotent: true } as any);
  }
  const f = fileOf(path);
  if (!f.exists) f.create({ intermediates: true } as any);
  f.write(text);
}

export function kvDelete(path: string): void {
  try {
    const f = fileOf(path);
    if (f.exists) f.delete();
  } catch {}
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

/** Arquivo temporário para compartilhar (backup). Devolve o endereço do arquivo. */
export function writeTempFile(name: string, text: string): string {
  const f = new File(Paths.cache, name);
  if (f.exists) f.delete();
  f.create({ intermediates: true } as any);
  f.write(text);
  return f.uri;
}

/** Lê um arquivo escolhido pelo usuário (ex.: backup). */
export async function readPickedFile(uri: string): Promise<string> {
  return new File(uri).text();
}

/** Apaga um arquivo temporário (ex.: a foto da câmera depois da leitura). */
export function deleteTempFile(uri: string): void {
  try {
    new File(uri).delete();
  } catch {}
}
