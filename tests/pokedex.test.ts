import assert from 'node:assert/strict';
import { matchFooter, nameFromSlug, parseFooter } from '../src/pokedex.ts';

assert.equal(nameFromSlug('great-tusk'), 'Great Tusk');
assert.equal(nameFromSlug('ho-oh'), 'Ho-Oh');
assert.equal(nameFromSlug('jangmo-o'), 'Jangmo-o');
assert.equal(nameFromSlug('nidoran-f'), 'Nidoran♀');
assert.equal(nameFromSlug('pikachu'), 'Pikachu');

// rodapé típico de uma carta da Celebração de 30 Anos
const r1 = parseFooter('Illus. Wintr Wandr\nJ 30C EN 116/128 ●\n©2026 Pokémon');
assert.deepEqual([r1.number, r1.total], [116, 128]);
assert.ok(r1.codes.includes('30C'));
// leitura com erros: "O" no lugar de zero e barra lida como "l"
const r2 = parseFooter('H SCR 0O3 l 142');
assert.deepEqual([r2.number, r2.total], [3, 142]);
assert.equal(parseFooter('sem números aqui').number, undefined);

const cards = [
  { id: 'sv07-003', setId: 'sv07', localId: '003', name: 'Eevee' },
  { id: 'sv08.5-003', setId: 'sv08.5', localId: '003', name: 'Eevee' },
  { id: '30th-116', setId: '30th', localId: '116', name: 'Eevee' },
];
const info: Record<string, { official: number; code: string }> = {
  sv07: { official: 142, code: 'SCR' },
  'sv08.5': { official: 131, code: 'PRE' },
  '30th': { official: 128, code: '30C' },
};
const si = (id: string) => info[id];
assert.deepEqual(matchFooter(r1, cards, si).map((c) => c.id), ['30th-116']);
assert.deepEqual(matchFooter(r2, cards, si).map((c) => c.id), ['sv07-003']); // total 142 desempata
assert.deepEqual(matchFooter({ number: 3, codes: ['PRE'] }, cards, si).map((c) => c.id), ['sv08.5-003']); // código desempata
console.log('OK: pokédex (nomes e leitura do rodapé)');
