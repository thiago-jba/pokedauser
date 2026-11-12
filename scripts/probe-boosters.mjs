const j = async (u) => (await fetch(u)).json();
const groups = (await j('https://tcgcsv.com/tcgplayer/3/groups')).results;
console.log(`::notice title=grupos::${groups.length} grupos; exemplo: ${JSON.stringify(groups[0])}`);
const pick = (re) => groups.find((g) => re.test(g.name));
for (const re of [/^SV01/, /151/, /Prismatic/, /^SWSH01|Sword & Shield$/, /Evolving Skies/, /^Base Set$/, /^ME01|Mega Evolution$/]) {
  const g = pick(re);
  if (!g) { console.log(`::notice title=${re}::grupo não achado`); continue; }
  const r = await fetch(`https://tcgcsv.com/tcgplayer/3/${g.groupId}/products`);
  const cors = r.headers.get('access-control-allow-origin');
  const prods = (await r.json()).results.filter((p) => /booster|pack/i.test(p.name) && !/box|bundle|display|case|blister|code card/i.test(p.name));
  console.log(`::notice title=${g.name} (${g.groupId}, ${g.abbreviation})::cors=${cors} :: ${prods.map((p) => `${p.name} => ${p.imageUrl}`).join(' ; ').slice(0, 3500)}`);
}
