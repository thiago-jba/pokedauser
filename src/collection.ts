// Junta as variantes da API, as correções do app e as adicionadas à mão,
// e calcula os números de progresso.
import type { StoredCard, StoredSet } from './api';
import { EXTRA_CARDS, EXTRA_VARIANTS } from './corrections';
import { buildVariants } from './variants';
import type { ApiVariantDetailed, CardVariant } from './variants';

export const ownedKey = (cardId: string, variantKey: string) => `${cardId}#${variantKey}`;

/** variantes adicionadas à mão: cardId -> lista */
export type CustomForSet = Record<string, ApiVariantDetailed[]>;

export interface Entry {
  key: string;
  card: StoredCard;
  variant: CardVariant;
}

export function cardVariants(set: StoredSet, card: StoredCard, custom?: CustomForSet): CardVariant[] {
  const raw = [...card.raw, ...(EXTRA_VARIANTS[card.id] ?? []), ...(custom?.[card.id] ?? []).map((v) => ({ ...v, custom: true }))];
  return buildVariants(raw, set.isPromoSet, new Set(set.ignoredStamps ?? []));
}

/** Cartas da coleção: as da API mais as que o app sabe que faltam (no final da lista). */
export function allCards(set: StoredSet): StoredCard[] {
  const extras = EXTRA_CARDS[set.id];
  if (!extras) return set.cards;
  const have = new Set(set.cards.map((c) => c.id));
  return [...set.cards, ...extras.filter((c) => !have.has(c.id))];
}

export function setEntries(set: StoredSet, custom?: CustomForSet): Entry[] {
  return allCards(set).flatMap((card) =>
    cardVariants(set, card, custom).map((variant) => ({ key: ownedKey(card.id, variant.key), card, variant })),
  );
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
