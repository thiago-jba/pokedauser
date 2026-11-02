// Junta duas versões da coleção (a deste aparelho e a da nuvem) a partir da última versão em comum.
// Regra: o que só um lado mudou, vale a mudança; se os dois mudaram a mesma coisa, vale a deste aparelho.
// Assim, marcar uma carta no celular e outra no computador ao mesmo tempo mantém as duas.

const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);

export function deepEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (Array.isArray(a) && Array.isArray(b)) return a.length === b.length && a.every((x, i) => deepEqual(x, b[i]));
  if (isObj(a) && isObj(b)) {
    const ka = Object.keys(a);
    const kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => deepEqual(a[k], b[k]));
  }
  return false;
}

/** Chave de identidade dos itens de uma lista (coleções por setId, cartas da Pokédex por uid). */
function itemId(x: unknown): string | null {
  if (!isObj(x)) return null;
  if (typeof x.uid === 'string') return `uid:${x.uid}`;
  if (typeof x.setId === 'string') return `set:${x.setId}`;
  return null;
}

function mergeArray(base: unknown[] | undefined, local: unknown[], remote: unknown[]): unknown[] {
  const b = base ?? [];
  // lista de textos (ex.: variações ocultas, filtros): junta como conjunto
  if ([...local, ...remote, ...b].every((x) => typeof x === 'string' || typeof x === 'number')) {
    const bs = new Set(b);
    const ls = new Set(local);
    const rs = new Set(remote);
    const out: unknown[] = [];
    for (const x of [...local, ...remote]) {
      if (out.includes(x)) continue;
      const inL = ls.has(x);
      const inR = rs.has(x);
      const inB = bs.has(x);
      // removido de um lado e intacto no outro => sai
      if (inB && (!inL || !inR)) continue;
      out.push(x);
    }
    return out;
  }
  // lista de objetos com identidade: junta item a item
  if ([...local, ...remote, ...b].every((x) => itemId(x) !== null)) {
    const bm = new Map(b.map((x) => [itemId(x)!, x]));
    const lm = new Map(local.map((x) => [itemId(x)!, x]));
    const rm = new Map(remote.map((x) => [itemId(x)!, x]));
    const ids: string[] = [];
    for (const x of [...local, ...remote]) {
      const id = itemId(x)!;
      if (!ids.includes(id)) ids.push(id);
    }
    const out: unknown[] = [];
    for (const id of ids) {
      const v = merge3(bm.get(id), lm.get(id), rm.get(id));
      if (v !== undefined) out.push(v);
    }
    return out;
  }
  // outras listas: vale a deste aparelho
  return local;
}

/**
 * Junta `local` e `remote` tendo `base` como a última versão sincronizada.
 * `undefined` significa "não existe" (ex.: carta desmarcada).
 */
export function merge3(base: unknown, local: unknown, remote: unknown): unknown {
  if (deepEqual(local, remote)) return local;
  if (deepEqual(local, base)) return remote;
  if (deepEqual(remote, base)) return local;
  // os dois lados mudaram
  if ((local === undefined || isObj(local)) && (remote === undefined || isObj(remote)) && (local !== undefined || remote !== undefined)) {
    // um lado apagou o objeto inteiro e o outro mexeu dentro: mantém o que mexeu
    if (local === undefined) return remote;
    if (remote === undefined) return local;
    const b = isObj(base) ? base : {};
    const out: Record<string, unknown> = {};
    for (const k of new Set([...Object.keys(local), ...Object.keys(remote)])) {
      const v = merge3(b[k], local[k], remote[k]);
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  if (Array.isArray(local) && Array.isArray(remote)) return mergeArray(Array.isArray(base) ? base : undefined, local, remote);
  return local;
}
