// Partes "puras" dos preços (sem acesso a arquivos), para poder testar no computador.
import type { StoredCard, StoredSet } from './api';
import { booleansToDetailed, variantKey } from './variants';

export interface VariantPrice {
  /** TCGplayer, menor preço (US$) */
  tcg?: number;
  /** Cardmarket, menor preço (€) */
  cm?: number;
}

// ---------- leitura dos preços da API ----------

const num = (x: any): number | undefined => (typeof x === 'number' && x > 0 ? x : undefined);

function pickPrice(pricing: any, type: string, foil: string | undefined, stamps: string[], variantOwnPricing: boolean): VariantPrice {
  const t = pricing?.tcgplayer;
  const cm = pricing?.cardmarket;
  const first = stamps.includes('1st-edition');

  let keys: string[];
  if (type === 'normal') keys = first ? ['1st-edition', '1st-edition-normal'] : ['normal', 'unlimited'];
  else if (type === 'reverse' && !foil) keys = ['reverse-holofoil'];
  else keys = first ? ['1st-edition-holofoil'] : ['holofoil', 'unlimited-holofoil'];

  let tcg: number | undefined;
  for (const k of keys) {
    tcg = num(t?.[k]?.lowPrice);
    if (tcg) break;
  }
  // preço específico da variante (ex.: Poké Bola) com uma única entrada: é dela
  if (!tcg && variantOwnPricing && t) {
    const subs = Object.values(t).filter((x: any) => x && typeof x === 'object');
    if (subs.length === 1) tcg = num((subs[0] as any).lowPrice);
  }

  const cmv = type === 'normal' ? num(cm?.low) : num(cm?.['low-holo']) ?? num(cm?.low);
  return { tcg, cm: cmv };
}

export function cardPrices(detail: any): Record<string, VariantPrice> {
  const out: Record<string, VariantPrice> = {};
  const detailed: any[] = detail?.variants_detailed?.length ? detail.variants_detailed : booleansToDetailed(detail?.variants);
  for (const v of detailed) {
    const type = (v.type ?? 'normal').toLowerCase();
    const stamps = (v.stamp ?? []).map((s: string) => s.toLowerCase());
    const own = !!v.pricing && (v.pricing.tcgplayer || v.pricing.cardmarket);
    const p = pickPrice(own ? v.pricing : detail?.pricing, type, v.foil?.toLowerCase(), stamps, !!own);
    if (p.tcg || p.cm) out[variantKey(v)] = p;
  }
  return out;
}

// ---------- formatação ----------

export function fmtMoney(v: number | undefined, prefix: string): string {
  if (v === undefined || isNaN(v)) return '—';
  const [int, dec] = v.toFixed(2).split('.');
  return `${prefix} ${int.replace(/\B(?=(\d{3})+(?!\d))/g, '.')},${dec}`;
}

// ---------- links das lojas brasileiras ----------

function cardRef(card: StoredCard, set: StoredSet, nameEn?: string) {
  const name = card.nameEn ?? nameEn ?? card.name;
  const numeric = /^\d+$/.test(card.localId);
  const official = set.official ? String(set.official).padStart(Math.max(3, card.localId.length), '0') : undefined;
  return { name, number: numeric && official ? `${card.localId}/${official}` : undefined };
}

export function ligaUrl(card: StoredCard, set: StoredSet, code?: string, nameEn?: string): string {
  const { name, number } = cardRef(card, set, nameEn);
  if (number && code) {
    const q = `card=${encodeURIComponent(`${name} (${number})`)}&ed=${encodeURIComponent(code)}&num=${encodeURIComponent(card.localId)}`;
    return `https://www.ligapokemon.com.br/?view=cards/card&${q}`;
  }
  return `https://www.ligapokemon.com.br/?view=cards/search&card=${encodeURIComponent(name)}`;
}

export function jornadaUrl(card: StoredCard, set: StoredSet, nameEn?: string): string {
  const { name, number } = cardRef(card, set, nameEn);
  return `https://www.jornadagames.com/search?q=${encodeURIComponent(number ? `${name} ${number}` : name)}`;
}
