const UA = { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36' };
const tests = [
  ['bulba-api-UA', 'https://bulbapedia.bulbagarden.net/w/api.php?format=json&origin=*&action=parse&prop=images&page=Scarlet_%26_Violet_(TCG)', /Booster[^"|]*/g],
  ['bulba-mobile', 'https://m.bulbapedia.bulbagarden.net/wiki/Scarlet_%26_Violet_(TCG)', /[A-Za-z0-9_]*Booster[A-Za-z0-9_]*\.(png|jpg)/g],
  ['bulba-archives-img', 'https://archives.bulbagarden.net/wiki/File:SV1_Booster_Koraidon.png', /media\/upload\/[^"]*SV1_Booster_Koraidon\.png/g],
  ['serebii-sv', 'https://www.serebii.net/card/scarletviolet/', /[^"' ]*(booster|pack)[^"' ]*\.(jpg|png)/gi],
  ['serebii-151', 'https://www.serebii.net/card/151/', /[^"' ]*(booster|pack)[^"' ]*\.(jpg|png)/gi],
  ['pokemon-tcg-sv', 'https://tcg.pokemon.com/en-us/expansions/scarlet-violet/', /[^"' ]*(booster|pack)[^"' ]*\.(jpg|png|webp)/gi],
  ['pokemon-tcg-pt', 'https://tcg.pokemon.com/pt-br/expansions/scarlet-violet/', /[^"' ]*(booster|pack)[^"' ]*\.(jpg|png|webp)/gi],
];
for (const [name, url, re] of tests) {
  let line = `${name}: `;
  try {
    const r = await fetch(url, { headers: UA });
    const t = await r.text();
    const hits = [...new Set(t.match(re) ?? [])].slice(0, 12);
    line += `HTTP ${r.status}, ${t.length} chars, cloudflare=${/Just a moment|cf-chl/i.test(t)} :: ${hits.join(' , ')}`;
  } catch (e) { line += 'ERRO ' + e; }
  console.log(`::notice title=${name}::${line.replace(/%/g, '%25').slice(0, 3000)}`);
}
