// Junta as variantes da API, as correções do app e as adicionadas à mão,
// e calcula os números de progresso.
import type { StoredCard, StoredSet } from './api';
import { EXTRA_VARIANTS } from './corrections';
import { ApiVariantDetailed, buildVariants, CardVariant } from './variants';

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

export function setEntries(set: StoredSet, custom?: CustomForSet): Entry[] {
  return set.cards.flatMap((card) =>
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
