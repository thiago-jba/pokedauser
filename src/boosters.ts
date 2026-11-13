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
/** suba quando mudar isBoosterFile/parseBoosterFile (2: Giratina era descartada por conter "tin") */
const CACHE_VERSION = 2;

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
// palavras que indicam outro produto (caixa, display, lata…). Comparação por PALAVRA INTEIRA do nome do arquivo:
// "Giratina" contém "tin" e "Tinkaton" também, mas não são latas.
const NOT_PACK = new Set(['box', 'display', 'bundle', 'blister', 'case', 'tin', 'tins', 'elite', 'sleeve', 'sleeved', 'scan', 'etb']);

export function isBoosterFile(file: string): boolean {
  const words = file
    .replace(/\.(png|jpe?g|webp|gif)$/i, '')
    .split(/[_\s.-]+/)
    .map((w) => w.toLowerCase());
  if (!words.some((w) => w === 'booster' || w === 'pack')) return false;
  return !words.some((w) => NOT_PACK.has(w));
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
  /** versão das regras de leitura; guardado com regra antiga é buscado de novo */
  v?: number;
  page: string | null;
  arts: BoosterArt[];
  /** data de lançamento da expansão (AAAA-MM-DD), para ordenar */
  releaseDate?: string;
}
const cachePath = (setId: string) => `boosters/${setId.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`;

/** Estampas de booster de uma expansão (guardadas no aparelho por 30 dias). */
export async function fetchBoosterArts(
  setId: string,
  force = false,
): Promise<{ page: string | null; arts: BoosterArt[]; releaseDate?: string }> {
  const hit = kvReadJson<Cached>(cachePath(setId));
  if (hit && !force && hit.v === CACHE_VERSION && hit.releaseDate && Date.now() - new Date(hit.fetchedAt).getTime() < CACHE_DAYS * 86400000 && hit.arts.length) return hit;

  const set = await (await fetch(`${TCG}/sets/${encodeURIComponent(setId)}`)).json();
  const releaseDate: string | undefined = set.releaseDate;
  const page = await findPage(set.name, set.abbreviation?.official);
  if (!page) return { page: null, arts: [], releaseDate };
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
  const out: Cached = { fetchedAt: new Date().toISOString(), v: CACHE_VERSION, page, arts, releaseDate };
  if (arts.length) kvWriteJson(cachePath(setId), out);
  return out;
}

/** Endereço da página da expansão na Bulbapedia. */
export const bulbapediaUrl = (page: string) => `https://bulbapedia.bulbagarden.net/wiki/${encodeURIComponent(page.replace(/ /g, '_'))}`;

export const BOOSTER_SORTS = [
  { value: 'recentes', label: 'Adicionados por último' },
  { value: 'lancamento_desc', label: 'Lançamento: mais nova primeiro' },
  { value: 'lancamento_asc', label: 'Lançamento: mais antiga primeiro' },
  { value: 'nome_asc', label: 'Expansão: A → Z' },
  { value: 'nome_desc', label: 'Expansão: Z → A' },
  { value: 'qtd_desc', label: 'Mais boosters primeiro' },
  { value: 'qtd_asc', label: 'Menos boosters primeiro' },
] as const;
export type BoosterSort = (typeof BOOSTER_SORTS)[number]['value'];

export interface BoosterGroup<T> {
  setId: string;
  setName: string;
  releaseDate?: string;
  items: T[];
  /** momento em que o último booster da expansão foi adicionado */
  lastAdded: string;
}

/** Agrupa os boosters por expansão e ordena os grupos. Dentro de cada grupo: mais recentes primeiro. */
export function groupBoosters<T extends { setId: string; setName: string; addedAt: string; releaseDate?: string }>(
  list: T[],
  sort: BoosterSort,
  releaseOf: (setId: string) => string | undefined = () => undefined,
): BoosterGroup<T>[] {
  const m = new Map<string, BoosterGroup<T>>();
  for (const b of list) {
    const g = m.get(b.setId) ?? { setId: b.setId, setName: b.setName, items: [], lastAdded: '', releaseDate: undefined };
    g.items.push(b);
    if (b.addedAt > g.lastAdded) g.lastAdded = b.addedAt;
    g.releaseDate = g.releaseDate ?? b.releaseDate ?? releaseOf(b.setId);
    m.set(b.setId, g);
  }
  const groups = [...m.values()];
  for (const g of groups) g.items.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
  const name = (a: BoosterGroup<T>, b: BoosterGroup<T>) => a.setName.localeCompare(b.setName, 'pt-BR');
  const date = (g: BoosterGroup<T>) => g.releaseDate ?? '';
  const cmp: Record<BoosterSort, (a: BoosterGroup<T>, b: BoosterGroup<T>) => number> = {
    recentes: (a, b) => b.lastAdded.localeCompare(a.lastAdded),
    lancamento_desc: (a, b) => date(b).localeCompare(date(a)) || name(a, b),
    lancamento_asc: (a, b) => (date(a) || '9999').localeCompare(date(b) || '9999') || name(a, b),
    nome_asc: name,
    nome_desc: (a, b) => name(b, a),
    qtd_desc: (a, b) => b.items.length - a.items.length || name(a, b),
    qtd_asc: (a, b) => a.items.length - b.items.length || name(a, b),
  };
  return groups.sort(cmp[sort] ?? cmp.recentes);
}

const COUNTRY_FIRST = ['BR', 'US', 'JP'];
const countryRank = (c: string) => {
  const i = COUNTRY_FIRST.indexOf(c);
  return i >= 0 ? String(i) : `9${c}`;
};

/** Boosters de uma expansão separados por estampa; dentro de cada estampa, um por país (BR, US, JP, depois A-Z). */
export function byArt<T extends { file: string; country: string; addedAt: string }>(items: T[]): { file: string; items: T[] }[] {
  const m = new Map<string, T[]>();
  // estampas na ordem em que apareceram pela primeira vez
  for (const b of [...items].sort((a, b) => a.addedAt.localeCompare(b.addedAt))) m.set(b.file, [...(m.get(b.file) ?? []), b]);
  return [...m.entries()].map(([file, list]) => ({
    file,
    items: list.sort((a, b) => countryRank(a.country).localeCompare(countryRank(b.country)) || a.addedAt.localeCompare(b.addedAt)),
  }));
}

/** Ordenação dentro de cada expansão (escolhida em cada uma). */
export const INNER_SORTS = [
  { value: 'recentes', label: 'Recentes' },
  { value: 'pais', label: 'Por país' },
  { value: 'estampa', label: 'Por estampa' },
] as const;
export type InnerSort = (typeof INNER_SORTS)[number]['value'];

/** Boosters de uma expansão separados por país (BR, US, JP, depois A-Z); dentro de cada país, por estampa. */
export function byCountry<T extends { file: string; country: string; addedAt: string }>(items: T[]): { country: string; items: T[] }[] {
  const artOrder = new Map(byArt(items).map((a, i) => [a.file, i]));
  const m = new Map<string, T[]>();
  for (const b of items) m.set(b.country, [...(m.get(b.country) ?? []), b]);
  return [...m.entries()]
    .sort((a, b) => countryRank(a[0]).localeCompare(countryRank(b[0])))
    .map(([country, list]) => ({
      country,
      items: list.sort((a, b) => (artOrder.get(a.file) ?? 0) - (artOrder.get(b.file) ?? 0) || a.addedAt.localeCompare(b.addedAt)),
    }));
}
