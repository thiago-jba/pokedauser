import assert from 'node:assert/strict';
import { cardPrices, fmtMoney, jornadaUrl, ligaUrl } from '../src/priceUtil.ts';

// Resposta real da TCGdex para Exeggcute de Evoluções Prismáticas (sv08.5-001), resumida
const tcg = (low: number) => ({ lowPrice: low, marketPrice: 9 });
const exeggcute = {
  name: 'Exeggcute',
  variants_detailed: [
    { type: 'normal', pricing: { cardmarket: { low: 0.02, 'low-holo': 0.02 }, tcgplayer: { normal: tcg(0.01), 'reverse-holofoil': tcg(0.03) } } },
    { type: 'reverse', pricing: { cardmarket: { low: 0.02, 'low-holo': 0.05 }, tcgplayer: { normal: tcg(0.01), 'reverse-holofoil': tcg(0.03) } } },
    { type: 'reverse', foil: 'pokeball', pricing: { cardmarket: { low: 0.02, 'low-holo': 0.02 }, tcgplayer: { holofoil: tcg(0.09) } } },
    { type: 'reverse', foil: 'masterball', pricing: { cardmarket: { low: 0.7, 'low-holo': 0.7 }, tcgplayer: { holofoil: tcg(0.25) } } },
  ],
};
const p = cardPrices(exeggcute);
assert.deepEqual(p['normal'], { tcg: 0.01, cm: 0.02 });
assert.deepEqual(p['reverse'], { tcg: 0.03, cm: 0.05 });
assert.deepEqual(p['reverse|||pokeball'], { tcg: 0.09, cm: 0.02 });
assert.deepEqual(p['reverse|||masterball'], { tcg: 0.25, cm: 0.7 });

// Coleção nova sem preço (ex.: 30 anos): nada é inventado
assert.deepEqual(cardPrices({ variants_detailed: [{ type: 'normal', size: 'standard' }], pricing: { cardmarket: null, tcgplayer: null } }), {});

// Carta antiga só com true/false usa o preço geral da carta
const old = cardPrices({ variants: { holo: true, normal: false, reverse: true }, pricing: { tcgplayer: { holofoil: tcg(12.5), 'reverse-holofoil': tcg(3) }, cardmarket: { low: 1, 'low-holo': 2 } } });
assert.deepEqual(old, { holo: { tcg: 12.5, cm: 2 }, reverse: { tcg: 3, cm: 2 } });

assert.equal(fmtMoney(1234.5, 'R$'), 'R$ 1.234,50');
assert.equal(fmtMoney(0.05, 'US$'), 'US$ 0,05');

// Links das lojas (formatos conferidos nos sites)
const set: any = { id: '30th', official: 128, cards: [] };
const eevee: any = { id: '30th-116', localId: '116', name: 'Eevee', nameEn: 'Eevee', raw: [] };
assert.equal(ligaUrl(eevee, set, '30C'), 'https://www.ligapokemon.com.br/?view=cards/card&card=Eevee%20(116%2F128)&ed=30C&num=116');
assert.equal(jornadaUrl(eevee, set), 'https://www.jornadagames.com/search?q=Eevee%20116%2F128');
const pre: any = { id: 'sv08.5', official: 131 };
const exe: any = { id: 'sv08.5-001', localId: '001', name: 'Exeggcute', raw: [] };
assert.equal(ligaUrl(exe, pre, 'PRE', 'Exeggcute'), 'https://www.ligapokemon.com.br/?view=cards/card&card=Exeggcute%20(001%2F131)&ed=PRE&num=001');
const mew: any = { id: '30th-R', localId: 'R', name: 'Mew', raw: [] };
assert.equal(jornadaUrl(mew, set), 'https://www.jornadagames.com/search?q=Mew');
console.log('OK: preços e links');
