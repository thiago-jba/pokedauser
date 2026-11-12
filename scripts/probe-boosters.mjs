// Teste: encontra na Bulbapedia as estampas de booster de algumas expansões.
const API = 'https://bulbapedia.bulbagarden.net/w/api.php?format=json&origin=*&';
const api = async (q) => (await fetch(API + q, { headers: { 'user-agent': 'pokecolecao-probe/1.0' } })).json();
const sets = [['Scarlet & Violet', 'SVI'], ['151', 'MEW'], ['Prismatic Evolutions', 'PRE'], ['Sword & Shield', 'SSH'], ['Evolving Skies', 'EVS'], ['Base Set', 'BS'], ['Mega Evolution', 'MEG'], ['Surging Sparks', 'SSP'], ['Crown Zenith', 'CRZ'], ['Sun & Moon', 'SUM'], ['XY', 'XY']];
for (const [name, abbr] of sets) {
  let line = `${name}: `;
  try {
    let title = null;
    for (const cand of [`${name} (TCG)`, abbr]) {
      const j = await api(`action=query&redirects=1&titles=${encodeURIComponent(cand)}`);
      const p = Object.values(j.query?.pages ?? {})[0];
      if (p && !('missing' in p) && /\(TCG\)$/.test(p.title)) { title = p.title; break; }
    }
    if (!title) {
      const s = await api(`action=query&list=search&srlimit=5&srsearch=${encodeURIComponent(name + ' TCG expansion')}`);
      title = s.query?.search?.map((x) => x.title).find((t) => /\(TCG\)$/.test(t)) ?? null;
      line += '[busca] ';
    }
    line += `${title} -> `;
    const im = await api(`action=parse&prop=images&page=${encodeURIComponent(title)}`);
    const files = (im.parse?.images ?? []).filter((f) => /booster|pack/i.test(f));
    line += files.join(' | ');
    if (files[0]) {
      const ii = await api(`action=query&prop=imageinfo&iiprop=url&iiurlwidth=300&titles=File:${encodeURIComponent(files[0])}`);
      line += ` || ex.: ${Object.values(ii.query.pages)[0].imageinfo?.[0]?.thumburl}`;
    }
  } catch (e) { line += 'ERRO ' + e; }
  console.log(line);
  console.log(`::notice title=${name}::${line.replace(/%/g, '%25')}`);
}
