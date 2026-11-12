const UA = { 'user-agent': 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36' };
const show = (name, list) => {
  const chunks = [];
  for (let i = 0; i < list.length; i += 25) chunks.push(list.slice(i, i + 25));
  chunks.forEach((c, i) => console.log(`::notice title=${name} ${i}::${c.join(' , ').replace(/%/g, '%25')}`));
};
const imgs = (t, re) => [...new Set(t.match(re) ?? [])];
for (const [name, url, re] of [
  ['oficial-pt', 'https://tcg.pokemon.com/pt-br/expansions/scarlet-violet/', /https:\/\/d1i787aglh9bmb\.cloudfront\.net\/[^"' )]+\.(png|jpg|webp)/g],
  ['serebii-sv', 'https://www.serebii.net/card/scarletviolet/', /(src|href)="[^"]+\.(jpg|png)"/g],
  ['oficial-lista', 'https://tcg.pokemon.com/pt-br/expansions/', /\/pt-br\/expansions\/[a-z0-9-]+\//g],
]) {
  const t = await (await fetch(url, { headers: UA })).text();
  show(name, imgs(t, re).filter((x) => !/-2x\./.test(x)));
}
