import assert from 'node:assert/strict';
import {
  buildVariants,
  cleanRaw,
  detectSetWideStamps,
  keyToVariant,
  matchesQuery,
  rarityPt,
  variantKey,
} from '../src/variants.ts';
import { EXTRA_VARIANTS } from '../src/corrections.ts';

// Carta comum de Evoluções Prismáticas (formato da API em inglês)
const exeggcute = buildVariants(
  cleanRaw(
    [{ type: 'normal' }, { type: 'reverse' }, { type: 'reverse', foil: 'pokeball' }, { type: 'reverse', foil: 'masterball' }],
    undefined,
  ),
  false,
);
assert.deepEqual(exeggcute.map((v) => v.category), ['normal', 'reverse', 'reverse_especial', 'reverse_especial']);
assert.deepEqual(exeggcute.map((v) => v.key), ['normal', 'reverse', 'reverse|||pokeball', 'reverse|||masterball']);
assert.equal(exeggcute[2].label, 'Reverse Poké Bola');

// Base Set antigo via true/false
const base = buildVariants(cleanRaw(undefined, { normal: false, holo: true, reverse: false, firstEdition: true }), false);
assert.deepEqual(base.map((v) => v.category), ['holo', 'primeira_edicao']);
assert.equal(base[1].label, '1ª Ed. Holo');

// Carimbo de evento continua sendo promo
const stamped = buildVariants([{ type: 'holo', stamp: ['pre-release'] }], false);
assert.equal(stamped[0].category, 'promo');
assert.equal(stamped[0].label, 'Holo Pré-lançamento');

// ---- Celebração de 30 Anos: carimbo em todas as cartas = marca da coleção ----
const set30 = [
  ...Array.from({ length: 68 }, () => ({ raw: [{ type: 'normal', stamp: ['30th-anniversary'] }] })),
  ...Array.from({ length: 30 }, () => ({ raw: [{ type: 'holo', stamp: ['30th-anniversary'] }] })),
  ...Array.from({ length: 3 }, () => ({ raw: [{ type: 'holo' }] })),
];
const ignore = new Set(detectSetWideStamps(set30));
assert.deepEqual([...ignore], ['30th-anniversary']);

const eeveeRaw = [{ type: 'normal', stamp: ['30th-anniversary'] }, ...EXTRA_VARIANTS['30th-116']];
const eevee = buildVariants(eeveeRaw, false, ignore);
console.table(eevee);
assert.equal(eevee.length, 2, 'Eevee 116 aparece 2 vezes');
assert.deepEqual(eevee.map((v) => v.category), ['normal', 'promo']);
assert.deepEqual(eevee.map((v) => v.label), ['Normal', 'Holo Cosmos']);
// a chave da versão normal não muda (as marcações já feitas continuam valendo)
assert.equal(eevee[0].key, 'normal||||30th-anniversary');

// Se a fonte de dados passar a ter a Cosmos, não duplica
const dup = buildVariants([...eeveeRaw, { type: 'holo', foil: 'cosmos', stamp: ['30th-anniversary'] }], false, ignore);
assert.equal(dup.length, 2);

// Migração de dados salvos: chave -> variante -> mesma chave
for (const k of ['normal', 'reverse|||pokeball', 'holo||||1st-edition', 'normal||||30th-anniversary', 'holo||jumbo||pre-release+staff']) {
  assert.equal(variantKey(keyToVariant(k)), k);
}

// Busca sem acento e por palavras soltas
assert.ok(matchesQuery('Evoluções Prismáticas', 'evolucoes'));
assert.ok(matchesQuery('Evoluções Prismáticas', 'prism evo'));
assert.ok(matchesQuery('Celebração de 30 Anos', 'celebracao 30'));
assert.ok(!matchesQuery('Evoluções Prismáticas', 'faiscas'));
assert.equal(rarityPt('Special illustration rare'), 'Ilustração Rara Especial');
console.log('OK: todos os testes passaram');

// ---- Mew RGB entram no final da Celebração de 30 Anos ----
import { allCards, setEntries } from '../src/collection.ts';
const fakeSet: any = {
  schema: 2, id: '30th', isPromoSet: false, ignoredStamps: ['30th-anniversary'], nameEn: '30th Celebration',
  cards: [
    { id: '30th-116', localId: '116', name: 'Eevee', raw: [{ type: 'normal', stamp: ['30th-anniversary'] }] },
    { id: '30th-158', localId: '158', name: 'Mew ex', raw: [{ type: 'holo', stamp: ['30th-anniversary'] }] },
  ],
};
assert.deepEqual(allCards(fakeSet).map((c) => c.localId), ['116', '158', 'R', 'G', 'B']);
assert.equal(setEntries(fakeSet).length, 2 + 1 + 3, 'Eevee x2 + Mew ex + 3 Mew RGB');
// se a API passar a ter o Mew R, não duplica
fakeSet.cards.push({ id: '30th-R', localId: 'R', name: 'Mew', raw: [{ type: 'holo' }] });
assert.equal(allCards(fakeSet).filter((c) => c.localId === 'R').length, 1);
// ...e continua com a foto enviada enquanto a TCGdex não tiver a imagem
assert.ok(allCards(fakeSet).find((c) => c.localId === 'R')!.imageFull!.includes('me55%2FR.png'));
console.log('OK: cartas extras');
