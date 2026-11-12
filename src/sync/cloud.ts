// Sincronização com a nuvem (Supabase), usando a API web direto (sem biblioteca nativa).
// A coleção inteira fica numa linha da tabela "colecao", com um número de versão.
// Cada aparelho guarda a última versão sincronizada ("base") para conseguir juntar alterações.
import { kvDelete, kvReadJson, kvWriteJson } from '../kv';
import { SUPABASE_KEY, SUPABASE_URL } from './config';
import { deepEqual, merge3, protectMissingParts } from './merge';

const SESSION = 'nuvem_sessao.json';
const BASE = 'nuvem_base.json';

export interface Session {
  access_token: string;
  refresh_token: string;
  /** segundos desde 1970 */
  expires_at: number;
  user: { id: string; email?: string };
}

interface Base {
  version: number;
  data: unknown;
  syncedAt: string;
}

export class CloudError extends Error {}

const headers = (token?: string) => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${token ?? SUPABASE_KEY}`,
  'Content-Type': 'application/json',
});

function authMessage(j: any, status: number): string {
  const raw = String(j?.msg ?? j?.error_description ?? j?.message ?? j?.error ?? '');
  if (/invalid login credentials/i.test(raw)) return 'E-mail ou senha incorretos.';
  if (/already registered|already exists/i.test(raw)) return 'Este e-mail já tem conta. Use "Entrar".';
  if (/email not confirmed/i.test(raw)) return 'Confirme o e-mail (link enviado) e depois entre.';
  if (/password/i.test(raw) && /(6|characters|weak)/i.test(raw)) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (/rate limit/i.test(raw)) return 'Muitas tentativas. Espere um pouco e tente de novo.';
  return raw || `Erro ${status} ao falar com a nuvem.`;
}

function toSession(j: any): Session {
  return {
    access_token: j.access_token,
    refresh_token: j.refresh_token,
    expires_at: j.expires_at ?? Math.floor(Date.now() / 1000) + (j.expires_in ?? 3600),
    user: { id: j.user?.id, email: j.user?.email },
  };
}

// ---------- conta ----------

export function loadSession(): Session | null {
  return kvReadJson<Session>(SESSION);
}

export async function signIn(email: string, password: string, create: boolean): Promise<Session> {
  const url = create ? `${SUPABASE_URL}/auth/v1/signup` : `${SUPABASE_URL}/auth/v1/token?grant_type=password`;
  const r = await fetch(url, { method: 'POST', headers: headers(), body: JSON.stringify({ email: email.trim(), password }) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new CloudError(authMessage(j, r.status));
  if (!j.access_token) {
    throw new CloudError(create ? 'Conta criada. Confirme o e-mail pelo link enviado e depois toque em "Entrar".' : 'Não foi possível entrar.');
  }
  const s = toSession(j);
  kvWriteJson(SESSION, s);
  kvDelete(BASE); // conta nova neste aparelho: a primeira sincronização junta tudo
  return s;
}

export function signOut() {
  kvDelete(SESSION);
  kvDelete(BASE);
}

/** Sessão válida (renova o acesso quando está perto de expirar). */
async function validSession(): Promise<Session> {
  const s = loadSession();
  if (!s) throw new CloudError('Você não está conectado à nuvem.');
  if (s.expires_at - 60 > Date.now() / 1000) return s;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ refresh_token: s.refresh_token }),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || !j.access_token) {
    if (r.status === 400 || r.status === 401) signOut();
    throw new CloudError('Sua sessão expirou. Entre de novo nas Configurações.');
  }
  const n = toSession(j);
  kvWriteJson(SESSION, n);
  return n;
}

// ---------- dados ----------

async function pull(s: Session): Promise<{ version: number; data: unknown } | null> {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/colecao?select=version,data&user_id=eq.${s.user.id}`, { headers: headers(s.access_token) });
  if (!r.ok) throw new CloudError(await tableError(r));
  const rows = await r.json();
  return rows[0] ?? null;
}

/** Grava só se a nuvem ainda estiver na versão esperada (senão alguém mudou antes: junta e tenta de novo). */
async function push(s: Session, data: unknown, expected: number | null): Promise<boolean> {
  const now = new Date().toISOString();
  if (expected === null) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/colecao`, {
      method: 'POST',
      headers: { ...headers(s.access_token), Prefer: 'return=minimal' },
      body: JSON.stringify({ user_id: s.user.id, data, version: 1, updated_at: now }),
    });
    if (r.status === 409) return false;
    if (!r.ok) throw new CloudError(await tableError(r));
    return true;
  }
  const r = await fetch(`${SUPABASE_URL}/rest/v1/colecao?user_id=eq.${s.user.id}&version=eq.${expected}`, {
    method: 'PATCH',
    headers: { ...headers(s.access_token), Prefer: 'return=representation' },
    body: JSON.stringify({ data, version: expected + 1, updated_at: now }),
  });
  if (!r.ok) throw new CloudError(await tableError(r));
  const rows = await r.json();
  return rows.length > 0;
}

async function tableError(r: Response): Promise<string> {
  const j = await r.json().catch(() => ({}));
  if (r.status === 404 || /relation .* does not exist|could not find the table/i.test(j?.message ?? '')) {
    return 'A tabela "colecao" ainda não existe no Supabase. Rode o comando SQL de configuração.';
  }
  if (r.status === 401) return 'Sua sessão expirou. Entre de novo nas Configurações.';
  return j?.message ?? `Erro ${r.status} ao falar com a nuvem.`;
}

/**
 * Sincroniza: junta a coleção deste aparelho com a da nuvem e grava o resultado nos dois lados.
 * Devolve a coleção juntada (que o app passa a usar).
 */
export async function syncNow<T>(local: T): Promise<{ data: T; syncedAt: string }> {
  const s = await validSession();
  for (let attempt = 0; attempt < 4; attempt++) {
    const remote = await pull(s);
    const base = kvReadJson<Base>(BASE);
    const done = (version: number, data: T) => {
      const syncedAt = new Date().toISOString();
      kvWriteJson(BASE, { version, data, syncedAt });
      return { data, syncedAt };
    };

    if (!remote) {
      if (await push(s, local, null)) return done(1, local);
      continue;
    }
    if (base && remote.version === base.version) {
      if (deepEqual(local, base.data)) return done(base.version, local);
      if (await push(s, local, base.version)) return done(base.version + 1, local);
      continue;
    }
    // a nuvem tem alterações de outro aparelho
    const merged = merge3(base?.data, local, protectMissingParts(base?.data, remote.data)) as T;
    if (deepEqual(merged, remote.data)) return done(remote.version, merged);
    if (await push(s, merged, remote.version)) return done(remote.version + 1, merged);
  }
  throw new CloudError('A coleção mudou ao mesmo tempo em outro aparelho. Tente sincronizar de novo.');
}

export function lastSyncedAt(): string | undefined {
  return kvReadJson<Base>(BASE)?.syncedAt;
}
