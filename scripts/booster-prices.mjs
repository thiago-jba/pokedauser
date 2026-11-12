// Preço de mercado do "Booster Pack" de cada expansão no TCGplayer (via tcgcsv.com, cópia diária e gratuita
// do catálogo do TCGplayer). Roda no GitHub Actions uma vez por dia e grava public/boosters-precos.json,
// que é publicado junto com a versão web; o app (celular e computador) lê esse arquivo.
// O TCGplayer tem um preço só por expansão (não separa estampa nem país).
import { mkdirSync, writeFileSync } from 'node:fs';

const UA = { headers: { 'user-agent': 'PokeColecao/1.0 (app pessoal de colecao)' } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function get(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, UA);
      if (r.ok) return await r.json();
    } catch {}
    await sleep(1500);
  }
  return null;
}
const notice = (title, msg) => console.log(`::notice title=${title}::${String(msg).replace(/%/g, '%25').replace(/\n/g, '%0A').slice(0, 3800)}`);

const norm = (s) =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/&/g, 'and')
    .replace(/pokemon/g, '')
    .replace(/[^a-z0-9]/g, '');
// "SV08: Surging Sparks" -> "Surging Sparks"
const groupTitle = (name) => name.replace(/^[^:]{1,14}:\s*/, '');

const groups = (await get('https://tcgcsv.com/tcgplayer/3/groups'))?.results ?? [];
const tcgdex = (await get('https://api.tcgdex.net/v2/en/sets')) ?? [];
if (!groups.length || !tcgdex.length) {
  console.log('::error::Sem dados do TCGplayer ou da TCGdex');
  process.exit(1);
}

// cada expansão da TCGdex -> grupo do TCGplayer (nome igual; senão, o nome do grupo termina com o da expansão)
const byNorm = new Map();
for (const g of groups) {
  const k = norm(groupTitle(g.name));
  if (!byNorm.has(k)) byNorm.set(k, []);
  byNorm.get(k).push(g);
}
const pairs = [];
for (const s of tcgdex) {
  const k = norm(s.name);
  if (k.length < 3) continue;
  let gs = byNorm.get(k) ?? [];
  if (!gs.length) gs = groups.filter((g) => norm(groupTitle(g.name)).endsWith(k) && norm(groupTitle(g.name)).length - k.length <= 20);
  for (const g of gs) pairs.push({ setId: s.id, setName: s.name, group: g });
}

const isPack = (n) => /booster pack/i.test(n) && !/box|bundle|display|case|blister|code card|set of|lot|tin|collection/i.test(n);

const out = {};
const queue = [...pairs];
async function worker() {
  while (queue.length) {
    const { setId, group } = queue.shift();
    if (out[setId]) continue;
    const prods = (await get(`https://tcgcsv.com/tcgplayer/3/${group.groupId}/products`))?.results ?? [];
    const packs = prods.filter((p) => isPack(p.name));
    if (!packs.length) continue;
    const prices = (await get(`https://tcgcsv.com/tcgplayer/3/${group.groupId}/prices`))?.results ?? [];
    const priceOf = (id) => {
      const ps = prices.filter((p) => p.productId === id);
      const v = ps.map((p) => p.marketPrice ?? p.midPrice).filter((x) => typeof x === 'number' && x > 0);
      return v.length ? Math.min(...v) : null;
    };
    // pacote comum (sem "Sleeved"); se houver vários (ex.: edições do Set Base), o de menor preço
    const ranked = packs
      .map((p) => ({ p, usd: priceOf(p.productId), sleeved: /sleeved/i.test(p.name) }))
      .filter((x) => x.usd)
      .sort((a, b) => Number(a.sleeved) - Number(b.sleeved) || a.usd - b.usd);
    if (ranked.length) out[setId] = { usd: Math.round(ranked[0].usd * 100) / 100, product: ranked[0].p.name, productId: ranked[0].p.productId };
    await sleep(150);
  }
}
await Promise.all(Array.from({ length: 4 }, worker));

mkdirSync('public', { recursive: true });
writeFileSync('public/boosters-precos.json', JSON.stringify({ updatedAt: new Date().toISOString(), source: 'TCGplayer (tcgcsv.com)', sets: out }));
const ids = Object.keys(out);
notice('Preços de boosters', `${ids.length} expansões com preço (de ${tcgdex.length} na TCGdex, ${pairs.length} ligações com o TCGplayer)`);
notice(
  'Exemplos',
  ['sv01', 'sv03.5', 'sv08', 'sv08.5', 'swsh7', 'base1', 'me01', 'me02', 'sm1', 'xy1']
    .map((id) => `${id}: ${out[id] ? `US$ ${out[id].usd} (${out[id].product})` : '—'}`)
    .join('\n'),
);
