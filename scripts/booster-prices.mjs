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
// sigla oficial de cada expansão (ex.: SVI, DRI), que o TCGplayer também usa na maioria dos grupos
const abbrOf = new Map();
{
  const q = tcgdex.map((s) => s.id);
  await Promise.all(
    Array.from({ length: 8 }, async () => {
      while (q.length) {
        const id = q.shift();
        const d = await get(`https://api.tcgdex.net/v2/en/sets/${encodeURIComponent(id)}`);
        const a = d?.abbreviation?.official;
        if (a) abbrOf.set(id, String(a).toUpperCase());
      }
    }),
  );
}
const byAbbr = new Map();
for (const g of groups) if (g.abbreviation) byAbbr.set(String(g.abbreviation).toUpperCase(), [...(byAbbr.get(String(g.abbreviation).toUpperCase()) ?? []), g]);

// nomes que não batem por regra
const ALIASES = { sm1: /^SM Base Set$/i, xy1: /^XY Base Set$/i, swsh1: /Sword & Shield Base Set/i, bw1: /^Black and White$/i };

const pairs = [];
for (const s of tcgdex) {
  const k = norm(s.name);
  const gs = new Set();
  // 1) mesma sigla; 2) mesmo nome; 3) nome do grupo = nome + "Base Set"; 4) nome do grupo termina com o nome
  for (const g of byAbbr.get(abbrOf.get(s.id)) ?? []) gs.add(g);
  for (const g of groups) if (ALIASES[s.id]?.test(g.name)) gs.add(g);
  if (k.length >= 3) {
    for (const g of byNorm.get(k) ?? []) gs.add(g);
    for (const g of byNorm.get(`${k}baseset`) ?? []) gs.add(g);
    if (!gs.size)
      for (const g of groups) {
        const t = norm(groupTitle(g.name));
        if (t.endsWith(k) && t.length - k.length <= 20) gs.add(g);
      }
  }
  for (const g of gs) pairs.push({ setId: s.id, setName: s.name, group: g });
}

// palavras inteiras (\b): "Destiny" não é "tin", "Legendary Collection" é nome de expansão
const isPack = (n) => /booster pack/i.test(n) && !/\b(box|bundle|display|case|blister|code card|set of|lot|tin|art bundle)\b/i.test(n);

const out = {};
const diag = [];
const queue = [...pairs];
async function worker() {
  while (queue.length) {
    const { setId, group } = queue.shift();
    if (out[setId]) continue;
    const prods = (await get(`https://tcgcsv.com/tcgplayer/3/${group.groupId}/products`))?.results ?? [];
    const packs = prods.filter((p) => isPack(p.name));
    if (!packs.length) {
      const near = prods.filter((p) => /booster|pack/i.test(p.name)).map((p) => p.name).slice(0, 8);
      if (near.length) diag.push(`${setId} <- ${group.name}: ${near.join(' | ')}`);
      continue;
    }
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

// produtos com booster próprio que não são expansões na TCGdex (mesmos ids de src/boosters.ts → EXTRA_BOOSTER_SETS)
const EXTRAS = [
  { id: 'parceiros-iniciais-2026', product: /first partner (illustration )?collection.*booster pack/i },
  ...[2022, 2023, 2024, 2025].map((y) => ({ id: `tot${y}`, product: new RegExp(`trick or trade.*${y}.*booster pack|trick or trade.*booster pack.*${y}`, 'i') })),
];
const extraGroups = groups.filter((g) => /trick or trade|first partner|miscellaneous|promo|mega evolution|me:|sv:/i.test(g.name));
const extraFound = [];
for (const g of extraGroups) {
  if (EXTRAS.every((x) => out[x.id])) break;
  const prods = (await get(`https://tcgcsv.com/tcgplayer/3/${g.groupId}/products`))?.results ?? [];
  const hits = EXTRAS.filter((x) => !out[x.id]).map((x) => ({ x, ps: prods.filter((p) => x.product.test(p.name) && !/\b(bundle|box|display|case|blister|set of|lot)\b/i.test(p.name)) }));
  if (!hits.some((h) => h.ps.length)) continue;
  const prices = (await get(`https://tcgcsv.com/tcgplayer/3/${g.groupId}/prices`))?.results ?? [];
  for (const { x, ps } of hits) {
    const priced = ps
      .map((p) => ({ p, usd: Math.min(...prices.filter((q) => q.productId === p.productId).map((q) => q.marketPrice ?? q.midPrice).filter((v) => v > 0)) }))
      .filter((v) => Number.isFinite(v.usd))
      .sort((a, b) => a.usd - b.usd);
    if (priced.length) {
      out[x.id] = { usd: Math.round(priced[0].usd * 100) / 100, product: priced[0].p.name, productId: priced[0].p.productId };
      extraFound.push(`${x.id}: US$ ${out[x.id].usd} (${priced[0].p.name} — ${g.name})`);
    }
  }
  await sleep(150);
}
notice('Produtos extras (Trick or Trade, Parceiros Iniciais)', extraFound.join('\n') || 'nenhum preço encontrado');

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
notice('Sem Booster Pack reconhecido', diag.slice(0, 40).join('\n') || 'nenhum');
notice('Sem ligação com o TCGplayer', tcgdex.filter((s) => !pairs.some((p) => p.setId === s.id)).map((s) => `${s.id}=${s.name}[${abbrOf.get(s.id) ?? ''}]`).join(', '));
