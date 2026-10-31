import assert from 'node:assert/strict';
import { sortEntries } from '../src/cardSort.ts';

const e = (localId: string, name: string, key = 'normal') => ({ card: { id: `s-${localId}`, localId, name }, variant: { key } });
const list = [
  e('010', 'Pikachu'),
  e('002', 'Ábra'),
  e('002', 'Ábra', 'reverse'),
  e('TG02', 'Zeraora'),
  e('100', 'charizard'),
  e('TG01', 'Mew'),
  e('R', 'Mew'),
  e('G', 'Mew'),
  e('B', 'Mew'),
];
const ids = (l: typeof list) => l.map((x) => `${x.card.localId}${x.variant.key === 'reverse' ? 'r' : ''}`).join(' ');
const none = () => undefined;

// números puros, depois prefixos (TG), depois só letras; variantes da mesma carta juntas
assert.equal(ids(sortEntries(list, 'num_asc', none)), '002 002r 010 100 TG01 TG02 B G R');
assert.equal(ids(sortEntries(list, 'num_desc', none)), 'R G B TG02 TG01 100 010 002 002r');
// alfabética sem diferenciar acento/maiúscula; empate pelo número
assert.equal(ids(sortEntries(list, 'nome_asc', none)), '002 002r 100 TG01 B G R 010 TG02');
assert.equal(ids(sortEntries(list, 'nome_desc', none)), 'TG02 010 TG01 B G R 100 002 002r');

// valor: cada variante pelo seu preço; sem preço vai para o fim
const prices: Record<string, { tcg?: number; cm?: number }> = {
  's-010|normal': { tcg: 5, cm: 1 },
  's-002|normal': { tcg: 0.5 },
  's-002|reverse': { tcg: 2, cm: 3 },
  's-100|normal': { tcg: 120, cm: 90 },
};
const pf = (x: (typeof list)[number]) => prices[`${x.card.id}|${x.variant.key}`];
assert.equal(ids(sortEntries(list, 'tcg_desc', pf)).split(' ').slice(0, 4).join(' '), '100 010 002r 002');
assert.equal(ids(sortEntries(list, 'tcg_asc', pf)).split(' ').slice(0, 4).join(' '), '002 002r 010 100');
assert.equal(ids(sortEntries(list, 'cm_asc', pf)).split(' ').slice(0, 4).join(' '), '010 002r 100 002');
console.log('OK: ordenação das cartas');
