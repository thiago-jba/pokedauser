import assert from 'node:assert/strict';
import { addDays, daysBetween, evolution } from '../src/evolution.ts';

const today = '2026-12-30';
const d = (n: number) => addDays(today, -n);
assert.equal(d(7), '2026-12-23');
assert.equal(addDays('2026-10-31', 1), '2026-11-01');
assert.equal(daysBetween('2026-10-31', '2026-12-30'), 60);

// Coleção A: Charizard subiu de 10 para 15 (US$); Pikachu 2 -> 2. Coleção B: Mew 5 -> 4.
const hist: any = {
  A: {
    [d(40)]: { c1: { holo: [9, 8] }, c2: { normal: [2, 1] } },
    [d(20)]: { c1: { holo: [10, 9] }, c2: { normal: [2, 1] } },
    [d(5)]: { c1: { holo: [12, 10] } }, // dia em que o Pikachu não veio: repete o anterior
    [d(0)]: { c1: { holo: [15, 11] }, c2: { normal: [2, 1] }, c3: { normal: [50, 40] } },
  },
  B: {
    [d(20)]: { m1: { holo: [5, 6] } },
    [d(0)]: { m1: { holo: [4, 6] } },
  },
};
const baskets = [
  { setId: 'A', items: [{ cardId: 'c1', variantKey: 'holo' }, { cardId: 'c2', variantKey: 'normal' }, { cardId: 'c3', variantKey: 'normal' }] },
  { setId: 'B', items: [{ cardId: 'm1', variantKey: 'holo' }] },
];

// 30 dias: começa em d(20). c3 não tinha preço em d(20) => fica de fora (não conta como valorização)
const e30 = evolution(baskets, hist, 'tcg', 30, today);
assert.equal(e30.startDate, d(20));
assert.equal(e30.itemsCounted, 3);
assert.deepEqual(e30.points.map((p) => p.value), [10 + 2 + 5, 12 + 2 + 5, 15 + 2 + 4]);
assert.equal(e30.delta, 4);
assert.equal(Math.round(e30.pct * 100) / 100, 23.53);
assert.equal(e30.coveredDays, 20);

// 7 dias: começa em d(5); preço de m1 em d(5) vem do registro de d(20)
const e7 = evolution(baskets, hist, 'tcg', 7, today);
assert.equal(e7.startDate, d(5));
assert.deepEqual(e7.points.map((p) => p.value), [12 + 2 + 5, 15 + 2 + 4]);

// Cardmarket usa a segunda coluna
const ecm = evolution(baskets, hist, 'cm', 60, today);
assert.equal(ecm.start, 8 + 1); // em d(40) só a coleção A tinha registro
assert.equal(ecm.end, 11 + 1);

// sem histórico nenhum
assert.equal(evolution(baskets, {}, 'tcg', 7, today).points.length, 0);
console.log('OK: evolução');
