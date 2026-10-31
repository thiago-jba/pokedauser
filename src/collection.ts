// Junta as variantes da API, as correções do app e as adicionadas à mão,
// e calcula os números de progresso.
import type { StoredCard, StoredSet } from './api';
import { EXTRA_CARDS, EXTRA_VARIANTS } from './corrections';
import { buildVariants, classifyDetailed } from './variants';
import type { ApiVariantDetailed, CardVariant } from './variants';

export const ownedKey = (cardId: string, variantKey: string) => `${cardId}#${variantKey}`;

/** variantes adicionadas à mão: cardId -> lista */
export type CustomForSet = Record<string, ApiVariantDetailed[]>;

export interface Entry {
  key: string;
  card: StoredCard;
  variant: CardVariant;
}

/** principal = coleção normal (base + reverse); especial = todas as variações */
export type SetMode = 'principal' | 'especial';

/** Preferências de uma coleção. Chaves de variante no formato "cardId#variantKey". */
export interface SetPrefs {
  custom?: CustomForSet;
  mode?: SetMode;
  /** variações extras que o usuário incluiu (no modo principal) */
  included?: string[];
  /** variações que o usuário ocultou */
  excluded?: string[];
}

// Coleções especiais conhecidas (subconjuntos ".5", celebrações, coleções clássicas…)
const SPECIAL_IDS = new Set(['30th', 'cel25', 'cel25c', 'swsh12.5', 'swsh4.5', 'swsh3.5', 'sv03.5', 'sv04.5', 'sv06.5', 'sv08.5', 'me02.5']);

/** Modo sugerido pelo app; o usuário pode trocar na tela da coleção. */
export function defaultMode(set: Pick<StoredSet, 'id' | 'nameEn' | 'isPromoSet'>): SetMode {
  if (set.isPromoSet) return 'especial';
  if (SPECIAL_IDS.has(set.id) || /\.5[a-z]?$/i.test(set.id)) return 'especial';
  if (/celebration|collection|promo|trainer kit|black star|futsal|mcdonald/i.test(set.nameEn ?? '')) return 'especial';
  return 'principal';
}

export const modeOf = (set: StoredSet, prefs?: SetPrefs): SetMode => prefs?.mode ?? defaultMode(set);

/** Raridades que ganham uma Reverse no modo principal. */
const REVERSE_RARITIES = new Set(['comum', 'incomum', 'rara', 'rara holo', 'common', 'uncommon', 'rare', 'rare holo', 'holo rare']);

/** Todas as variações conhecidas da carta (API + correções do app + adicionadas à mão). */
export function allVariants(set: StoredSet, card: StoredCard, custom?: CustomForSet): CardVariant[] {
  const raw = [...card.raw, ...(EXTRA_VARIANTS[card.id] ?? []), ...(custom?.[card.id] ?? []).map((v) => ({ ...v, custom: true }))];
  return buildVariants(raw, set.isPromoSet, new Set(set.ignoredStamps ?? []), card.rarity);
}

/**
 * Variações que fazem parte da coleção do usuário.
 * Principal: 1 Normal (versão base) por carta; + 1 Reverse para Comum/Incomum/Rara numeradas
 * até o total oficial; cartas acima do total oficial: só 1. Mais as extras que o usuário incluiu
 * e as adicionadas à mão. Especial: todas as variações. Nos dois modos, as ocultadas saem.
 */
export function cardVariants(set: StoredSet, card: StoredCard, prefs?: SetPrefs): CardVariant[] {
  const full = allVariants(set, card, prefs?.custom);
  const excluded = new Set(prefs?.excluded ?? []);
  const keep = (c: CardVariant) => !excluded.has(ownedKey(card.id, c.key));
  if (modeOf(set, prefs) === 'especial') return full.filter(keep);

  const ign = new Set(set.ignoredStamps ?? []);
  const base =
    full.find((c) => c.category === 'normal' && !c.custom) ??
    full.find((c) => c.category !== 'reverse' && c.category !== 'reverse_especial' && !c.custom) ??
    classifyDetailed({ type: 'normal' }, false, ign);
  const list: CardVariant[] = [base.category === 'normal' ? base : { ...base, category: 'normal', label: 'Normal' }];

  const n = /^\d+$/.test(card.localId) ? parseInt(card.localId, 10) : NaN;
  const withinOfficial = !isNaN(n) && (!set.official || n <= set.official);
  if (withinOfficial && REVERSE_RARITIES.has((card.rarity ?? '').toLowerCase())) {
    list.push(full.find((c) => c.category === 'reverse') ?? classifyDetailed({ type: 'reverse' }, false, ign));
  }

  const included = new Set(prefs?.included ?? []);
  for (const c of full) {
    if (list.some((x) => x.key === c.key)) continue;
    if (c.custom || included.has(ownedKey(card.id, c.key))) list.push(c);
  }
  return list.filter(keep);
}

/** Variações que existem mas não estão na coleção do usuário (para "+ Incluir"). */
export function otherVariants(set: StoredSet, card: StoredCard, prefs?: SetPrefs): CardVariant[] {
  const shown = new Set(cardVariants(set, card, prefs).map((c) => c.key));
  return allVariants(set, card, prefs?.custom).filter((c) => !shown.has(c.key));
}

/** Cartas da coleção: as da API mais as que o app sabe que faltam (no final da lista). */
export function allCards(set: StoredSet): StoredCard[] {
  const extras = EXTRA_CARDS[set.id];
  if (!extras) return set.cards;
  const byId = new Map(extras.map((c) => [c.id, c]));
  // carta que já veio da API mas ainda sem foto: usa a foto conhecida
  const api = set.cards.map((c) => (!c.image && byId.get(c.id)?.imageFull ? { ...c, imageFull: byId.get(c.id)!.imageFull } : c));
  const have = new Set(set.cards.map((c) => c.id));
  return [...api, ...extras.filter((c) => !have.has(c.id))];
}

export function setEntries(set: StoredSet, prefs?: SetPrefs): Entry[] {
  return allCards(set).flatMap((card) =>
    cardVariants(set, card, prefs).map((variant) => ({ key: ownedKey(card.id, variant.key), card, variant })),
  );
}

/** Todas as chaves possíveis da coleção (nos dois modos), para não apagar marcações ao atualizar. */
export function allPossibleKeys(set: StoredSet, custom?: CustomForSet): Set<string> {
  const keys = new Set<string>();
  for (const mode of ['principal', 'especial'] as const)
    for (const e of setEntries(set, { custom, mode })) keys.add(e.key);
  return keys;
}

export function progress(entries: Entry[], isOwned: (key: string) => boolean) {
  const total = entries.length;
  let owned = 0;
  for (const e of entries) if (isOwned(e.key)) owned++;
  const pct = total ? (owned / total) * 100 : 0;
  return { owned, total, pct };
}

/** Percentual com uma casa decimal, sem mostrar 100% antes de completar de verdade. */
export function formatPct(pct: number): string {
  if (pct >= 100) return '100%';
  const v = Math.floor(pct * 10) / 10;
  return `${v.toFixed(v % 1 ? 1 : 0).replace('.', ',')}%`;
}

export interface SavedFilters {
  categories?: string[];
  rarities?: string[];
}

/**
 * Aplica os filtros salvos da coleção (tipo de carta e raridade).
 * Escolhas que não existem mais na coleção são ignoradas.
 * Usado tanto na tela da coleção quanto na tela inicial, para os números baterem.
 */
export function applySavedFilters(entries: Entry[], f?: SavedFilters) {
  const cats = new Set(entries.map((e) => e.variant.category as string));
  const rars = new Set(entries.map((e) => e.card.rarity ?? 'Sem raridade'));
  const catSet = new Set((f?.categories ?? []).filter((c) => cats.has(c)));
  const raritySet = new Set((f?.rarities ?? []).filter((r) => rars.has(r)));
  const list =
    catSet.size || raritySet.size
      ? entries.filter(
          (e) =>
            (!catSet.size || catSet.has(e.variant.category)) &&
            (!raritySet.size || raritySet.has(e.card.rarity ?? 'Sem raridade')),
        )
      : entries;
  return { list, catSet, raritySet, active: catSet.size > 0 || raritySet.size > 0 };
}
