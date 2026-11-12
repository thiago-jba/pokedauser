const UA = { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36', accept: 'text/html,application/json' };
const tests = [
  ['pokellector', 'https://www.pokellector.com/Scarlet-Violet-Expansion/', /[^"' ]*(pack|booster)[^"' ]*\.(png|jpg|webp)/gi],
  ['pokellector-sets', 'https://www.pokellector.com/sets', /[^"' ]*(pack|booster)[^"' ]*\.(png|jpg|webp)/gi],
  ['pricecharting', 'https://www.pricecharting.com/console/pokemon-scarlet-&-violet', /[^"' <>]*booster[^"'<>]*/gi],
  ['cardmarket', 'https://www.cardmarket.com/en/Pokemon/Products/Boosters/Scarlet-Violet-Booster', /[^"' ]*\.(png|jpg|webp)/gi],
  ['tcgcsv-groups', 'https://tcgcsv.com/tcgplayer/3/groups', /"name":"Scarlet & Violet[^"]*"[^}]*/g],
  ['tcgcsv-sv1-products', 'https://tcgcsv.com/tcgplayer/3/22873/products', /"name":"[^"]*(Booster|Pack)[^"]*"/g],
];
for (const [name, url, re] of tests) {
  let line = `${name}: `;
  try {
    const r = await fetch(url, { headers: UA });
    const t = await r.text();
    line += `HTTP ${r.status}, ${t.length} chars, cf=${/Just a moment|cf-chl/i.test(t)} :: ${[...new Set(t.match(re) ?? [])].slice(0, 30).join(' , ')}`;
  } catch (e) { line += 'ERRO ' + e; }
  console.log(`::notice title=${name}::${line.replace(/%/g, '%25').slice(0, 4000)}`);
}
