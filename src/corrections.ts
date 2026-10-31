// Dados que existem de verdade mas ainda não chegaram na API da TCGdex.
// Quando a API passar a ter o item, a repetição é descartada automaticamente.
import type { StoredCard } from './api';
import { rarityPt } from './variants';
import type { ApiVariantDetailed } from './variants';

/** Variantes que faltam. Chave = ID da carta na API ("<id da coleção>-<número>"). */
export const EXTRA_VARIANTS: Record<string, ApiVariantDetailed[]> = {
  // Celebração de 30 Anos — Eevee 116 Cosmos Holo (promo de blister)
  '30th-116': [{ type: 'holo', foil: 'cosmos', stamp: ['30th-anniversary'], promo: true }],
};

const mewRgb = (letter: 'R' | 'G' | 'B'): StoredCard => ({
  id: `30th-${letter}`,
  localId: letter,
  name: 'Mew',
  // a TCGdex ainda não publicou a foto; se publicar neste endereço, aparece sozinha
  image: `https://assets.tcgdex.net/en/me/30th/${letter}`,
  rarity: rarityPt('RGB Rare'),
  category: 'Pokemon',
  raw: [{ type: 'holo' }],
});

/** Cartas que faltam, adicionadas ao final da coleção. Chave = ID da coleção. */
export const EXTRA_CARDS: Record<string, StoredCard[]> = {
  // Celebração de 30 Anos — os 3 Mew RGB (sem numeração)
  '30th': [mewRgb('R'), mewRgb('G'), mewRgb('B')],
};
