import assert from 'node:assert/strict';
import { merge3 } from '../src/sync/merge.ts';

const base: any = {
  collections: [{ setId: 'sv07', nameEn: 'Stellar Crown' }],
  owned: { sv07: { 'sv07-001#normal': 'BR', 'sv07-002#normal': 'BR' } },
  prefs: { sv07: { excluded: ['a', 'b'] } },
  pokedex: { 4: [{ uid: 'u1', cardId: 'swshp-SWSH232' }] },
  settings: { defaultCountry: 'BR' },
};
// celular: marcou 003, desmarcou 002, ocultou 'c', adicionou carta na Pokédex
const phone: any = structuredClone(base);
phone.owned.sv07['sv07-003#normal'] = 'BR';
delete phone.owned.sv07['sv07-002#normal'];
phone.prefs.sv07.excluded.push('c');
phone.pokedex[4].push({ uid: 'u2', cardId: 'svp-047' });
// computador: mudou o país da 001, adicionou coleção, removeu 'a' das ocultas, adicionou outra carta na Pokédex
const pc: any = structuredClone(base);
pc.owned.sv07['sv07-001#normal'] = 'JP';
pc.collections.push({ setId: 'sv08', nameEn: 'Surging Sparks' });
pc.owned.sv08 = { 'sv08-010#normal': 'BR' };
pc.prefs.sv07.excluded = ['b'];
pc.pokedex[25] = [{ uid: 'u3', cardId: 'x-1' }];

const m: any = merge3(base, phone, pc);
assert.deepEqual(m.owned.sv07, { 'sv07-001#normal': 'JP', 'sv07-003#normal': 'BR' });
assert.deepEqual(m.owned.sv08, { 'sv08-010#normal': 'BR' });
assert.deepEqual(m.collections.map((c: any) => c.setId), ['sv07', 'sv08']);
assert.deepEqual(m.prefs.sv07.excluded.sort(), ['b', 'c']);
assert.deepEqual(m.pokedex[4].map((c: any) => c.uid), ['u1', 'u2']);
assert.deepEqual(m.pokedex[25].map((c: any) => c.uid), ['u3']);
assert.deepEqual(m.settings, { defaultCountry: 'BR' });

// coleção removida num lado e intacta no outro: sai
const removed: any = structuredClone(base);
removed.collections = [];
delete removed.owned.sv07;
const m2: any = merge3(base, structuredClone(base), removed);
assert.deepEqual(m2.collections, []);
assert.equal(m2.owned.sv07, undefined);

// conflito na mesma coisa: vale a deste aparelho
const a: any = structuredClone(base); a.settings.defaultCountry = 'US';
const b: any = structuredClone(base); b.settings.defaultCountry = 'JP';
assert.equal((merge3(base, a, b) as any).settings.defaultCountry, 'US');

// primeira sincronização (sem base): junta os dois
const first: any = merge3(undefined, { owned: { x: { k1: 'BR' } } }, { owned: { x: { k2: 'BR' } } });
assert.deepEqual(first.owned.x, { k1: 'BR', k2: 'BR' });
console.log('OK: sincronização (junção de alterações)');
