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
