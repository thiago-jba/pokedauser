import assert from 'node:assert/strict';
import { cardVariants, defaultMode, otherVariants, ownedKey, setEntries } from '../src/collection.ts';

// Coroa Estelar (sv07): 142 oficiais, 175 no total — formato real dos dados
const sv07: any = {
  schema: 2, id: 'sv07', nameEn: 'Stellar Crown', isPromoSet: false, ignoredStamps: [], official: 142,
  cards: [
    { id: 'sv07-001', localId: '001', name: 'Bulbasaur ex', rarity: 'Rara Dupla', raw: [{ type: 'holo' }, { type: 'holo', stamp: ['set-logo'] }] },
    { id: 'sv07-002', localId: '002', name: 'Comum', rarity: 'Comum', raw: [{ type: 'normal' }, { type: 'reverse' }] },
    { id: 'sv07-003', localId: '003', name: 'Rara', rarity: 'Rara', raw: [{ type: 'holo' }, { type: 'reverse' }, { type: 'normal' }] },
    { id: 'sv07-006', localId: '006', name: 'Rara2', rarity: 'Rara', raw: [{ type: 'reverse' }, { type: 'holo' }, { type: 'reverse', foil: 'pokeball' }] },
    { id: 'sv07-060', localId: '060', name: 'Sem variantes', rarity: 'Comum', raw: [] },
    { id: 'sv07-107', localId: '107', name: 'Muitas', rarity: 'Rara', raw: [{ type: 'holo' }, { type: 'reverse' }, { type: 'holo', stamp: ['gamestop'] }, { type: 'holo', foil: 'cosmos' }, { type: 'normal', foil: 'league' }] },
    { id: 'sv07-134', localId: '134', name: 'Ace', rarity: 'ACE SPEC Rara', raw: [{ type: 'holo' }] },
    { id: 'sv07-143', localId: '143', name: 'IR', rarity: 'Ilustração Rara', raw: [{ type: 'holo' }] },
    { id: 'sv07-174', localId: '174', name: 'HR', rarity: 'Hiper Rara', raw: [{ type: 'holo', foil: 'gold' }] },
  ],
};
assert.equal(defaultMode(sv07), 'principal');
const labels = (cardIdx: number, prefs?: any) => cardVariants(sv07, sv07.cards[cardIdx], prefs).map((v) => `${v.category}:${v.label}`);
assert.deepEqual(labels(0), ['normal:Normal']); // Rara Dupla: só 1
assert.deepEqual(labels(1), ['normal:Normal', 'reverse:Reverse']); // Comum: Normal + Reverse
assert.deepEqual(labels(2), ['normal:Normal', 'reverse:Reverse']); // Rara: a Holo promocional fica de fora
assert.deepEqual(labels(3), ['normal:Normal', 'reverse:Reverse']); // Poké Bola fica de fora
assert.deepEqual(labels(4), ['normal:Normal', 'reverse:Reverse']); // sem dados: Reverse criada pela regra
assert.deepEqual(labels(5), ['normal:Normal', 'reverse:Reverse']);
assert.deepEqual(labels(6), ['normal:Normal']); // ACE SPEC: só 1
assert.deepEqual(labels(7), ['normal:Normal']); // acima de 142: 1 de cada
assert.deepEqual(labels(8), ['normal:Normal Ouro']);
assert.equal(setEntries(sv07).length, 1 + 2 + 2 + 2 + 2 + 2 + 1 + 1 + 1);

// "Outras versões" e incluir/ocultar
const c107 = sv07.cards[5];
assert.deepEqual(otherVariants(sv07, c107).map((v) => v.label), ['Holo GameStop', 'Holo Cosmos', 'Normal Liga']);
const cosmosKey = ownedKey(c107.id, 'holo|||cosmos');
assert.deepEqual(labels(5, { included: [cosmosKey] }), ['normal:Normal', 'reverse:Reverse', 'promo:Holo Cosmos']);
assert.deepEqual(labels(5, { excluded: [ownedKey(c107.id, 'reverse')] }), ['normal:Normal']);
// Poké Bola incluída na carta 006
assert.deepEqual(labels(3, { included: [ownedKey('sv07-006', 'reverse|||pokeball')] }), ['normal:Normal', 'reverse:Reverse', 'reverse_especial:Reverse Poké Bola']);
// variante adicionada à mão entra sempre
assert.deepEqual(labels(1, { custom: { 'sv07-002': [{ type: 'reverse', foil: 'masterball' }] } }), ['normal:Normal', 'reverse:Reverse', 'reverse_especial:Reverse Master Bola']);

// Modo especial: todas as variações, com ocultar
assert.equal(defaultMode({ id: '30th', nameEn: '30th Celebration', isPromoSet: false }), 'especial');
assert.equal(defaultMode({ id: 'sv08.5', nameEn: 'Prismatic Evolutions', isPromoSet: false }), 'especial');
assert.deepEqual(labels(5, { mode: 'especial' }), ['normal:Normal', 'reverse:Reverse', 'promo:Holo GameStop', 'promo:Holo Cosmos', 'promo:Normal Liga']);
assert.deepEqual(labels(5, { mode: 'especial', excluded: [ownedKey(c107.id, 'holo||||gamestop')] }), ['normal:Normal', 'reverse:Reverse', 'promo:Holo Cosmos', 'promo:Normal Liga']);
console.log('OK: modos principal/especial');
