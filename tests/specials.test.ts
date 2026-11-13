import assert from 'node:assert/strict';
import { matchesSpecial, uniqueCards } from '../src/specials.ts';
import { merge3 } from '../src/sync/merge.ts';

const pika = { kind: 'pokemon' as const, term: 'Pikachu' };
assert.ok(matchesSpecial(pika, 'Pikachu ex'));
assert.ok(matchesSpecial(pika, "Ash's Pikachu"));
assert.ok(!matchesSpecial(pika, 'Raichu'));
const en = { kind: 'energia' as const };
assert.ok(matchesSpecial(en, 'Fire Energy'));
assert.ok(matchesSpecial(en, 'Double Turbo Energy'));
assert.ok(!matchesSpecial(en, 'Energy Retrieval'));
assert.equal(uniqueCards([{ id: 'a' } as any], [{ id: 'a' } as any, { id: 'b' } as any]).length, 2);
console.log('OK: coleções especiais (busca por personagem e Energias)');

// sincronização: carta adicionada no celular e outra no computador na mesma coleção => as duas ficam
const col = { uid: 'pokemon-25', name: "Pikachu's", kind: 'pokemon', term: 'Pikachu', createdAt: 'x', cards: [] as any[] };
const card = (uid: string) => ({ uid, cardId: uid, setId: 's', setName: 's', localId: '1', name: 'Pikachu', addedAt: 'x', country: 'BR' });
const base = { version: 1, collections: [], specials: [col] };
const local = { ...base, specials: [{ ...col, cards: [card('c1')] }] };
const remote = { ...base, specials: [{ ...col, cards: [card('c2')] }] };
const m = merge3(base, local, remote) as any;
assert.deepEqual(m.specials[0].cards.map((c: any) => c.uid).sort(), ['c1', 'c2']);
// coleção apagada de um lado e intacta no outro => sai
const gone = merge3(base, { ...base, specials: [] }, base) as any;
assert.equal(gone.specials.length, 0);
console.log('OK: coleções especiais sincronizam carta a carta');

// versão antiga do app envia a coleção sem as partes novas: não pode apagar as Coleções Especiais
import { protectMissingParts } from '../src/sync/merge.ts';
const withSp = { version: 1, collections: [], specials: [{ ...col, cards: [card('c1')] }], boosters: [{ uid: 'b1' }] };
const oldClient = { version: 1, collections: [{ setId: 'x' }] }; // versão antiga: sem specials/boosters
const kept = merge3(withSp, withSp, protectMissingParts(withSp, oldClient)) as any;
assert.equal(kept.specials.length, 1);
assert.equal(kept.boosters.length, 1);
assert.equal(kept.collections.length, 1); // a mudança feita no outro aparelho continua valendo
// apagar de verdade (lista vazia) continua funcionando
const emptied = merge3(withSp, withSp, protectMissingParts(withSp, { ...withSp, specials: [] })) as any;
assert.equal(emptied.specials.length, 0);
console.log('OK: versão antiga do app não apaga partes novas da coleção');

import { buildSpecialSections } from '../src/specials.ts';
const own = (uid: string, cardId: string, setId: string, localId: string, country: string) => ({ ...card(uid), cardId, setId, setName: setId, localId, country });
const owned = [own('o1', 'sv1-025', 'sv1', '025', 'BR'), own('o2', 'sv1-025', 'sv1', '025', 'JP'), own('o3', 'base-58', 'base', '58', 'US'), own('o4', 'sv1-099', 'sv1', '099', 'BR')];
const cands = [
  { id: 'sv1-025', localId: '025', setId: 'sv1', name: 'Pikachu' },
  { id: 'sv1-100', localId: '100', setId: 'sv1', name: 'Pikachu ex' },
  { id: 'sv1-003', localId: '003', setId: 'sv1', name: 'Pikachu' },
  { id: 'sv2-010', localId: '010', setId: 'sv2', name: 'Pikachu' },
  { id: 'base-58', localId: '58', setId: 'base', name: 'Pikachu' },
] as any[];
const info = (id: string) => ({ name: id.toUpperCase(), order: { sv2: 0, sv1: 1, base: 5 }[id] });
const tenho = buildSpecialSections(owned as any, cands, { view: 'tenho' }, info);
assert.deepEqual(tenho.map((s) => s.setId), ['sv1', 'base']);
assert.equal(tenho[0].tiles.length, 3);
const todas = buildSpecialSections(owned as any, cands, { view: 'todas' }, info);
assert.deepEqual(todas.map((s) => s.setId), ['sv2', 'sv1', 'base']);
assert.deepEqual(todas[1].tiles.map((t) => `${t.kind}:${t.card.localId}`), ['missing:003', 'owned:025', 'owned:025', 'owned:099', 'missing:100']);
assert.equal(todas[1].ownedCards, 2);
assert.equal(todas[1].totalCards, 4); // 3 da coleção + 1 incluída à mão (personagem no fundo)
const br = buildSpecialSections(owned as any, cands, { view: 'todas', country: 'BR' }, info);
assert.deepEqual(br.map((s) => s.setId), ['sv1']);
assert.deepEqual(br[0].tiles.map((t) => t.key), ['o1', 'o4']);
console.log('OK: coleção especial separada por expansão, com todas/tenho e filtro de país');
