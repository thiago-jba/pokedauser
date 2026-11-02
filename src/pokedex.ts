// Pokédex: lista de Pokémon (baixada da PokéAPI e guardada no celular) e cartas de cada Pokémon (TCGdex).
import { kvReadJson, kvWriteJson } from './kv';
import { cardPrices } from './priceUtil';
import type { VariantPrice } from './priceUtil';
import { buildVariants, cleanRaw, detectSetWideStamps, rarityPt } from './variants';
import type { CardVariant } from './variants';

export interface Species {
  id: number;
  name: string;
}

export interface PokemonCardBrief {
  id: string;
  setId: string;
  localId: string;
  name: string;
  image?: string;
}

const SPECIES_URL = 'https://pokeapi.co/api/v2/pokemon-species?limit=3000';
const NAMES_GRAPHQL = 'https://beta.pokeapi.co/graphql/v1beta';
const TCG = 'https://api.tcgdex.net/v2/en';

export const artworkUrl = (id: number) =>
  `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;

export const dexNumber = (id: number) => `#${String(id).padStart(3, '0')}`;

// ---------- nomes ----------

const SPECIAL_NAMES: Record<string, string> = {
  'nidoran-f': 'Nidoran♀',
  'nidoran-m': 'Nidoran♂',
  'mr-mime': 'Mr. Mime',
  'mime-jr': 'Mime Jr.',
  'mr-rime': 'Mr. Rime',
  farfetchd: 'Farfetch’d',
  sirfetchd: 'Sirfetch’d',
  'type-null': 'Type: Null',
  flabebe: 'Flabébé',
};
// nomes que mantêm o hífen (Ho-Oh, Porygon-Z, Jangmo-o, Wo-Chien…)
const KEEP_HYPHEN = /^(ho-oh|porygon-z|jangmo-o|hakamo-o|kommo-o|wo-chien|chien-pao|ting-lu|chi-yu)$/;

/** "great-tusk" -> "Great Tusk"; casos especiais à parte. */
export function nameFromSlug(slug: string): string {
  if (SPECIAL_NAMES[slug]) return SPECIAL_NAMES[slug];
  const cap = (w: string) => (w ? w[0].toUpperCase() + w.slice(1) : w);
  if (KEEP_HYPHEN.test(slug)) return slug.split('-').map(cap).join('-').replace(/-O$/, '-o');
  return slug.split('-').map(cap).join(' ');
}

// ---------- lista de Pokémon ----------

const SPECIES = 'pokedex_especies.json';

export function loadSpeciesCache(): Species[] | null {
  const j = kvReadJson<{ list: Species[] }>(SPECIES);
  return j && Array.isArray(j.list) && j.list.length ? j.list : null;
}

function speciesCacheAgeDays(): number {
  const j = kvReadJson<{ fetchedAt: string }>(SPECIES);
  return j ? (Date.now() - new Date(j.fetchedAt).getTime()) / 86400000 : Infinity;
}

/** Lista todas as espécies em ordem da Pokédex nacional, com o nome oficial. */
export async function fetchSpecies(): Promise<Species[]> {
  const res = await fetch(SPECIES_URL);
  const j = await res.json();
  const list: Species[] = j.results
    .map((r: { name: string; url: string }) => ({ id: Number(r.url.match(/\/(\d+)\/?$/)?.[1]), name: nameFromSlug(r.name) }))
    .filter((s: Species) => s.id > 0)
    .sort((a: Species, b: Species) => a.id - b.id);

  // nomes oficiais (com acentos, pontuação etc.); se falhar, fica o nome montado a partir do código
  try {
    const q = { query: 'query{pokemon_v2_pokemonspeciesname(where:{language_id:{_eq:9}}){pokemon_species_id name}}' };
    const g = await (await fetch(NAMES_GRAPHQL, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(q) })).json();
    const names = new Map<number, string>(g.data.pokemon_v2_pokemonspeciesname.map((x: any) => [x.pokemon_species_id, x.name]));
    for (const s of list) s.name = names.get(s.id) ?? s.name;
  } catch {}

  kvWriteJson(SPECIES, { fetchedAt: new Date().toISOString(), list });
  return list;
}

/** Usa a lista guardada; atualiza em segundo plano a cada 30 dias. */
export async function getSpecies(): Promise<Species[]> {
  const cached = loadSpeciesCache();
  if (cached && speciesCacheAgeDays() < 30) return cached;
  try {
    return await fetchSpecies();
  } catch (e) {
    if (cached) return cached;
    throw e;
  }
}

// ---------- cartas de um Pokémon ----------

const cardsCache = new Map<number, PokemonCardBrief[]>();

/** Todas as cartas da TCGdex em que o Pokémon aparece (pelo número da Pokédex). */
export async function fetchPokemonCards(dexId: number): Promise<PokemonCardBrief[]> {
  const hit = cardsCache.get(dexId);
  if (hit) return hit;
  const r = await fetch(`${TCG}/cards?dexId=eq:${dexId}`);
  const list: any[] = r.ok ? await r.json() : [];
  const out = list.map((c) => ({
    id: c.id,
    localId: String(c.localId),
    setId: String(c.id).slice(0, String(c.id).length - String(c.localId).length - 1),
    name: c.name,
    image: c.image,
  }));
  cardsCache.set(dexId, out);
  return out;
}

const setCardsCache = new Map<string, PokemonCardBrief[]>();

/** Todas as cartas de uma coleção (para o campo "Carta" depois de escolher a coleção). */
export async function fetchSetCards(setId: string): Promise<PokemonCardBrief[]> {
  const hit = setCardsCache.get(setId);
  if (hit) return hit;
  const r = await fetch(`${TCG}/sets/${encodeURIComponent(setId)}`);
  const j = r.ok ? await r.json() : { cards: [] };
  const out = (j.cards ?? []).map((c: any) => ({ id: c.id, localId: String(c.localId), setId, name: c.name, image: c.image }));
  setCardsCache.set(setId, out);
  return out;
}

// ---------- leitura do rodapé da carta (câmera) ----------

export interface FooterRead {
  /** número da carta e total impressos, ex.: 116 e 128 */
  number?: number;
  total?: number;
  /** código de carta promocional, ex.: "SWSH232", "SM210", "SVP085" (sem zeros à esquerda: "SVP85") */
  promo?: string;
  /** possíveis códigos de coleção lidos (ex.: "30C", "SCR") */
  codes: string[];
}

/** "SWSH232" / "SWSH 232" / "SVP 085" -> "SWSH232" / "SVP85" (sem espaço nem zeros à esquerda) */
export const promoKey = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^([A-Z]+)0+(?=\d)/, '$1');

const PROMO_RE = /\b(SWSH|SM|XY|BW|DP|HGSS|SVP|SV|MEP|ME)\s?-?\s?(\d{1,3})\b/;

/** Extrai "116/128" (ou o código de promo, ex.: SWSH232) e o código da coleção do texto lido pela câmera. */
export function parseFooter(text: string): FooterRead {
  // erros comuns da leitura: letra O no lugar de zero e barra lida como | ou l
  const clean = text
    .replace(/(\d)[Oo]/g, '$10')
    .replace(/[Oo](\d)/g, '0$1')
    .replace(/(\d)\s*[|Il]\s*(\d{2,3})\b/g, '$1/$2');
  const m = [...clean.matchAll(/(\d{1,3})\s*\/\s*(\d{2,3})/g)];
  // o padrão número/total costuma ser o último que aparece no rodapé
  const best = m.length ? m[m.length - 1] : null;
  const codes = [...new Set([...text.matchAll(/\b([A-Z]{3}|\d{2}[A-Z]|[A-Z]{2}\d)\b/g)].map((x) => x[1]))].filter(
    (c) => !/^(HP|PV|EX|GX|LV)$/.test(c),
  );
  const promo = !best ? clean.toUpperCase().match(PROMO_RE) : null;
  if (best) return { number: Number(best[1]), total: Number(best[2]), codes };
  if (promo) return { promo: promoKey(promo[1] + promo[2]), number: Number(promo[2]), codes };
  return { codes };
}

/**
 * Cartas do Pokémon que batem com o rodapé lido.
 * Promo: confere o código (SWSH232). Demais: número da carta e total oficial; o código lido desempata.
 */
export function matchFooter(
  read: FooterRead,
  cards: PokemonCardBrief[],
  setInfo: (setId: string) => { official?: number; code?: string } | undefined,
): PokemonCardBrief[] {
  if (read.promo) {
    const exact = cards.filter((c) => promoKey(c.localId) === read.promo);
    if (exact.length) return exact;
    // promos da era Escarlate e Violeta são numeradas sem prefixo (svp-085)
    return cards.filter((c) => /^svp$|^mep$/i.test(c.setId) && Number(c.localId) === read.number);
  }
  if (read.number === undefined) return [];
  const byNumber = cards.filter((c) => /^\d+$/.test(c.localId) && Number(c.localId) === read.number);
  const byTotal = byNumber.filter((c) => setInfo(c.setId)?.official === read.total);
  const pool = byTotal.length ? byTotal : byNumber;
  const withCode = pool.filter((c) => {
    const code = setInfo(c.setId)?.code;
    return code && read.codes.includes(code.toUpperCase());
  });
  return withCode.length ? withCode : pool;
}

/** A busca digitada bate com o número da carta? "232" acha "SWSH232"; "116" acha "116". */
export function matchesCardNumber(localId: string, typed: string): boolean {
  const t = typed.trim().replace(/^#/, '');
  if (!t) return true;
  if (/^\d+$/.test(t)) {
    const digits = localId.replace(/\D/g, '');
    return digits !== '' && String(Number(digits)).startsWith(String(Number(t)));
  }
  return promoKey(localId).startsWith(promoKey(t));
}

/**
 * Identifica uma carta qualquer pelo rodapé lido (usado na câmera da tela principal da Pokédex).
 * Busca na TCGdex todas as cartas com aquele número e confere o total oficial / código.
 */
export async function identifyCard(
  read: FooterRead,
  setInfo: (setId: string) => { official?: number; code?: string } | undefined,
): Promise<{ card: PokemonCardBrief; dexIds: number[] }[]> {
  if (read.number === undefined && !read.promo) return [];
  const ids = read.promo
    ? [read.promo, read.promo.replace(/(\d+)$/, (d) => d.padStart(3, '0'))]
    : [String(read.number), String(read.number).padStart(3, '0'), String(read.number).padStart(2, '0')];
  const seen = new Set<string>();
  const found: PokemonCardBrief[] = [];
  for (const id of [...new Set(ids)]) {
    try {
      const r = await fetch(`${TCG}/cards?localId=eq:${encodeURIComponent(id)}`);
      const list: any[] = r.ok ? await r.json() : [];
      for (const c of list) {
        if (seen.has(c.id)) continue;
        seen.add(c.id);
        const localId = String(c.localId);
        found.push({ id: c.id, localId, setId: String(c.id).slice(0, String(c.id).length - localId.length - 1), name: c.name, image: c.image });
      }
    } catch {}
  }
  const matched = matchFooter(read, found, setInfo).slice(0, 6);
  const out: { card: PokemonCardBrief; dexIds: number[] }[] = [];
  for (const card of matched) {
    try {
      const d = await (await fetch(`${TCG}/cards/${encodeURIComponent(card.id)}`)).json();
      if (Array.isArray(d?.dexId) && d.dexId.length) out.push({ card, dexIds: d.dexId });
    } catch {}
  }
  return out;
}

// ---------- detalhes de uma carta (versões, raridade, preço) ----------

export interface CardDetailInfo {
  nameEn?: string;
  rarity?: string;
  variants: CardVariant[];
  prices: Record<string, VariantPrice>;
}

const detailCache = new Map<string, CardDetailInfo>();

/**
 * Versões que a carta tem (com a versão base já marcada como Normal), raridade e preços.
 * Carimbo presente em quase todas as versões da carta (ex.: "30 anos") é a marca da coleção e é ignorado.
 */
export async function fetchCardDetail(cardId: string): Promise<CardDetailInfo> {
  const hit = detailCache.get(cardId);
  if (hit) return hit;
  const r = await fetch(`${TCG}/cards/${encodeURIComponent(cardId)}`);
  const d = r.ok ? await r.json() : null;
  const raw = cleanRaw(d?.variants_detailed, d?.variants);
  const ignore = new Set(detectSetWideStamps([{ raw }]));
  const info: CardDetailInfo = {
    nameEn: d?.name,
    rarity: rarityPt(d?.rarity),
    variants: buildVariants(raw, false, ignore),
    prices: d ? cardPrices(d) : {},
  };
  detailCache.set(cardId, info);
  return info;
}
