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
