// Ordenação das cartas dentro de uma coleção.
import type { VariantPrice } from './priceUtil';
import { normalize } from './variants';

export type CardSort = 'num_asc' | 'num_desc' | 'nome_asc' | 'nome_desc' | 'tcg_asc' | 'tcg_desc' | 'cm_asc' | 'cm_desc';

export const CARD_SORTS: { value: CardSort; label: string; needsPrice?: boolean }[] = [
  { value: 'num_asc', label: '# na coleção (0-9)' },
  { value: 'num_desc', label: '# na coleção (9-0)' },
  { value: 'nome_asc', label: 'Alfabética (A-Z)' },
  { value: 'nome_desc', label: 'Alfabética (Z-A)' },
  { value: 'tcg_asc', label: 'Valor TCGplayer (menor → maior)', needsPrice: true },
  { value: 'tcg_desc', label: 'Valor TCGplayer (maior → menor)', needsPrice: true },
  { value: 'cm_asc', label: 'Valor Cardmarket (menor → maior)', needsPrice: true },
  { value: 'cm_desc', label: 'Valor Cardmarket (maior → menor)', needsPrice: true },
];

export const cardSortLabel = (s: CardSort) => CARD_SORTS.find((o) => o.value === s)?.label ?? '';

export function normalizeCardSort(s?: string): CardSort {
  return CARD_SORTS.some((o) => o.value === s) ? (s as CardSort) : 'num_asc';
}

/**
 * Chave do número da carta: números puros primeiro (1, 2, … 200), depois códigos com letras
 * agrupados pelo prefixo (TG01, TG02 … ; GG01 …) e por fim só letras (R, G, B).
 */
function numKey(localId: string): [number, string, number, string] {
  const m = localId.match(/^([A-Za-z]*)(\d+)([A-Za-z]*)$/);
  if (m && !m[1]) return [0, '', Number(m[2]), m[3]];
  if (m) return [1, m[1].toUpperCase(), Number(m[2]), m[3]];
  return [2, localId.toUpperCase(), 0, ''];
}

function compareNum(a: string, b: string): number {
  const ka = numKey(a);
  const kb = numKey(b);
  return ka[0] - kb[0] || ka[1].localeCompare(kb[1]) || ka[2] - kb[2] || ka[3].localeCompare(kb[3]);
}

interface SortableEntry {
  card: { id: string; localId: string; name: string };
  variant: { key: string };
}

/**
 * Ordena as cartas da tela. Variantes da mesma carta ficam juntas na ordem original
 * (exceto na ordenação por valor, em que cada variante vale o seu próprio preço).
 * Cartas sem preço vão sempre para o fim na ordenação por valor.
 */
export function sortEntries<T extends SortableEntry>(
  entries: T[],
  sort: CardSort,
  priceOf: (e: T) => VariantPrice | undefined,
): T[] {
  const indexed = entries.map((e, i) => ({ e, i }));
  // sem acento e sem diferenciar maiúsculas (não depende do idioma do celular)
  const nameKey = new Map(entries.map((e) => [e.card.id, normalize(e.card.name)]));
  const byName = (a: T, b: T) => {
    const x = nameKey.get(a.card.id)!;
    const y = nameKey.get(b.card.id)!;
    return x < y ? -1 : x > y ? 1 : 0;
  };

  const cmp = (x: { e: T; i: number }, y: { e: T; i: number }): number => {
    const a = x.e;
    const b = y.e;
    switch (sort) {
      case 'num_desc':
        return compareNum(b.card.localId, a.card.localId) || x.i - y.i;
      case 'nome_asc':
        return byName(a, b) || compareNum(a.card.localId, b.card.localId) || x.i - y.i;
      case 'nome_desc':
        return byName(b, a) || compareNum(a.card.localId, b.card.localId) || x.i - y.i;
      case 'tcg_asc':
      case 'tcg_desc':
      case 'cm_asc':
      case 'cm_desc': {
        const field = sort.startsWith('tcg') ? 'tcg' : 'cm';
        const pa = priceOf(a)?.[field];
        const pb = priceOf(b)?.[field];
        if (pa === undefined && pb === undefined) return compareNum(a.card.localId, b.card.localId) || x.i - y.i;
        if (pa === undefined) return 1;
        if (pb === undefined) return -1;
        const d = sort.endsWith('asc') ? pa - pb : pb - pa;
        return d || compareNum(a.card.localId, b.card.localId) || x.i - y.i;
      }
      default:
        return compareNum(a.card.localId, b.card.localId) || x.i - y.i;
    }
  };
  return indexed.sort(cmp).map((x) => x.e);
}
