// Variantes que existem de verdade mas ainda não estão cadastradas na TCGdex.
// Chave = ID da carta na API ("<id da coleção>-<número>").
// Quando a TCGdex passar a ter a variante, a repetição é descartada automaticamente.
import type { ApiVariantDetailed } from './variants';

export const EXTRA_VARIANTS: Record<string, ApiVariantDetailed[]> = {
  // Celebração de 30 Anos — Eevee 116 Cosmos Holo (promo de blister)
  '30th-116': [{ type: 'holo', foil: 'cosmos', stamp: ['30th-anniversary'], promo: true }],
};
