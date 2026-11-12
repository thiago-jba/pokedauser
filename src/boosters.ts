// Boosters: estampas dos pacotes de cada expansão, a partir da galeria da Bulbapedia (bulbapedia.bulbagarden.net).
// A Bulbapedia guarda as imagens de cada pacote com nomes como "SV8_Booster_Pikachu.png";
// o app lê a lista de imagens da página da expansão e mostra só as dos pacotes.
// As imagens da Bulbapedia não abrem se o pedido informar outro site como origem (Referer):
// no celular isso não acontece; no navegador o app desliga o envio (App.tsx).
import { kvReadJson, kvWriteJson } from './kv';

export interface BoosterArt {
  /** nome do arquivo na Bulbapedia (identifica a estampa) */
  file: string;
  /** nome da estampa, ex.: "Pikachu", "Mega Charizard X" */
  label: string;
  /** idioma do pacote quando não é o internacional (inglês), ex.: "japonês", "português" */
  lang?: string;
  /** miniatura (300 px de largura) */
  image?: string;
}

const API = 'https://bulbapedia.bulbagarden.net/w/api.php?format=json&origin=*&';
const TCG = 'https://api.tcgdex.net/v2/en';
const CACHE_DAYS = 30;

const LANGS: Record<string, string> = {
  japanese: 'japonês',
  jp: 'japonês',
  ja: 'japonês',
  korean: 'coreano',
  ko: 'coreano',
  kr: 'coreano',
  chinese: 'chinês',
  zh: 'chinês',
  thai: 'tailandês',
  th: 'tailandês',
  indonesian: 'indonésio',
  id: 'indonésio',
  de: 'alemão',
  german: 'alemão',
  es: 'espanhol',
  spanish: 'espanhol',
  fr: 'francês',
  french: 'francês',
  it: 'italiano',
  italian: 'italiano',
  br: 'português',
  pt: 'português',
  portuguese: 'português',
  en: 'inglês',
  english: 'inglês',
};

/** É imagem de um pacote (e não de caixa, display, coleção…)? */
export function isBoosterFile(file: string): boolean {
  return /booster|_pack\b|_pack\./i.test(file) && !/booster_?box|display|bundle|art_scan|blister|case|tin|elite|sleeve/i.test(file);
}

const hasDigit = (s: string) => /\d/.test(s);

/** "SV8_Booster_Pikachu.png" -> { label: "Pikachu" }; "Base_Set_Booster_Charizard_BR.jpg" -> { label: "Charizard", lang: "português" } */
export function parseBoosterFile(file: string): { label: string; lang?: string } {
  const name = file.replace(/\.(png|jpe?g|webp|gif)$/i, '').replace(/ /g, '_');
  const tokens = name.split('_').filter(Boolean);
  const bi = tokens.findIndex((t) => /^booster$/i.test(t));
  let lang: string | undefined;
  const last = tokens[tokens.length - 1];
  if (last && LANGS[last.toLowerCase()]) {
    lang = LANGS[last.toLowerCase()];
    tokens.pop();
  }
  let words: string[];
  if (bi >= 0) {
    words = tokens.slice(bi + 1);
    // sem nome depois de "Booster": usa o que vem antes, sem o código da expansão (ex.: "SV10.5_BLK_Booster" -> "BLK")
    if (!words.length) words = tokens.slice(0, bi).filter((t, i) => !(i === 0 && hasDigit(t)));
  } else {
    // "SV1S_pack_Japanese", "S7D_Skyscraping_Perfection_pack": pacotes japoneses (padrão da Bulbapedia)
    words = tokens.filter((t) => !/^pack$/i.test(t));
    if (!lang) lang = 'japonês';
  }
  if (lang === 'inglês') lang = undefined;
  const label = words.join(' ').trim() || 'Estampa única';
  return { label, lang };
}

/** Nome para mostrar: "Charizard (português)". */
export const artTitle = (a: { label: string; lang?: string }) => (a.lang ? `${a.label} (${a.lang})` : a.label);

const api = async (q: string) => {
  const r = await fetch(API + q);
  if (!r.ok) throw new Error(`Bulbapedia ${r.status}`);
  return r.json();
};

/** Página da expansão na Bulbapedia: "<nome> (TCG)", depois a sigla (que redireciona), depois a busca. */
async function findPage(nameEn: string, abbr?: string): Promise<string | null> {
  for (const cand of [`${nameEn} (TCG)`, abbr].filter(Boolean) as string[]) {
    const j = await api(`action=query&redirects=1&titles=${encodeURIComponent(cand)}`);
    const p: any = Object.values(j.query?.pages ?? {})[0];
    if (p && !('missing' in p) && /\(TCG\)$/.test(p.title)) return p.title;
  }
  const s = await api(`action=query&list=search&srlimit=8&srsearch=${encodeURIComponent(`${nameEn} TCG expansion`)}`);
  return s.query?.search?.map((x: any) => x.title).find((t: string) => /\(TCG\)$/.test(t)) ?? null;
}

interface Cached {
  fetchedAt: string;
  page: string | null;
  arts: BoosterArt[];
}
const cachePath = (setId: string) => `boosters/${setId.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`;

/** Estampas de booster de uma expansão (guardadas no aparelho por 30 dias). */
export async function fetchBoosterArts(setId: string, force = false): Promise<{ page: string | null; arts: BoosterArt[] }> {
  const hit = kvReadJson<Cached>(cachePath(setId));
  if (hit && !force && Date.now() - new Date(hit.fetchedAt).getTime() < CACHE_DAYS * 86400000 && hit.arts.length) return hit;

  const set = await (await fetch(`${TCG}/sets/${encodeURIComponent(setId)}`)).json();
  const page = await findPage(set.name, set.abbreviation?.official);
  if (!page) return { page: null, arts: [] };
  const parsed = await api(`action=parse&prop=images&page=${encodeURIComponent(page)}`);
  const files: string[] = [...new Set<string>((parsed.parse?.images ?? []).filter(isBoosterFile))];

  // miniaturas, até 40 por pedido
  const thumbs = new Map<string, string>();
  for (let i = 0; i < files.length; i += 40) {
    const titles = files.slice(i, i + 40).map((f) => `File:${f}`).join('|');
    const j = await api(`action=query&prop=imageinfo&iiprop=url&iiurlwidth=300&titles=${encodeURIComponent(titles)}`);
    for (const p of Object.values<any>(j.query?.pages ?? {})) {
      const url = p.imageinfo?.[0]?.thumburl ?? p.imageinfo?.[0]?.url;
      if (url) thumbs.set(String(p.title).replace(/^File:/, '').replace(/ /g, '_'), url);
    }
  }
  const arts: BoosterArt[] = files.map((file) => ({ file, ...parseBoosterFile(file), image: thumbs.get(file.replace(/ /g, '_')) }));
  // internacionais primeiro, depois os outros idiomas (mantendo a ordem da galeria)
  arts.sort((a, b) => Number(!!a.lang) - Number(!!b.lang));
  const out: Cached = { fetchedAt: new Date().toISOString(), page, arts };
  if (arts.length) kvWriteJson(cachePath(setId), out);
  return out;
}

/** Endereço da página da expansão na Bulbapedia. */
export const bulbapediaUrl = (page: string) => `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(page.replace(/ /g, '_'))}`;
