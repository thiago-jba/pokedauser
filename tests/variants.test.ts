import { buildVariants, matchesQuery, rarityPt } from '../src/variants.ts';
import assert from 'node:assert/strict';

// Carta comum de Evoluções Prismáticas (formato da API em inglês)
const exeggcute = buildVariants([
  { type: 'normal', variantId: 'a' },
  { type: 'reverse', variantId: 'b' },
  { type: 'reverse', foil: 'pokeball', variantId: 'c' },
  { type: 'reverse', foil: 'masterball', variantId: 'd' },
], undefined, false);
console.table(exeggcute);
assert.deepEqual(exeggcute.map(v => v.category), ['normal','reverse','reverse_especial','reverse_especial']);
assert.deepEqual(exeggcute.map(v=>v.key), ['normal','reverse','reverse|||pokeball','reverse|||masterball']);
assert.equal(exeggcute[2].label, 'Reverse Poké Bola');
assert.equal(exeggcute[3].label, 'Reverse Master Bola');

// Sem variantId: chaves continuam únicas
const nokey = buildVariants([{ type: 'reverse' }, { type: 'reverse', foil: 'pokeball' }], undefined, false);
assert.notEqual(nokey[0].key, nokey[1].key);

// Base Set antigo via booleanos
const base = buildVariants(undefined, { normal: false, holo: true, reverse: false, firstEdition: true }, false);
console.table(base);
assert.deepEqual(base.map(v => v.category), ['holo','primeira_edicao']);
assert.equal(base[1].label, '1ª Ed. Holo');

// Carimbos e promo
const stamped = buildVariants([{ type: 'holo', stamp: ['pre-release'] }, { type: 'normal' }], undefined, true);
assert.deepEqual(stamped.map(v => v.category), ['promo','promo']);
assert.equal(stamped[0].label, 'Holo Pré-lançamento');

// Sem dados nenhum
assert.equal(buildVariants(undefined, undefined, false).length, 1);

// Busca sem acento e por palavras soltas
assert.ok(matchesQuery('Evoluções Prismáticas', 'evolucoes'));
assert.ok(matchesQuery('Evoluções Prismáticas', 'prism evo'));
assert.ok(!matchesQuery('Evoluções Prismáticas', 'faiscas'));
assert.equal(rarityPt('Special illustration rare'), 'Ilustração Rara Especial');
console.log('OK: todos os testes passaram');
