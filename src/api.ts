// Acesso à API gratuita TCGdex (https://tcgdex.dev).
// Português do Brasil = código "pt". Os dados técnicos (variantes, raridade) vêm do
// endpoint em inglês, que traz os valores sem tradução e é sempre o mais completo.

import { ApiVariantDetailed, cleanRaw, detectSetWideStamps, rarityPt } from './variants';

const BASE = 'https://api.tcgdex.net/v2';
const PT = 'pt';
const EN = 'en';

export interface SetSummary {
  id: string;
  namePt?: string;
  nameEn: string;
  logo?: string;
  symbol?: string;
  total: number;
  official?: number;
}

export interface StoredCard {
  id: string;
  localId: string;
  name: string;
  /** nome em inglês (usado nos links da Liga Pokémon e Jornada Games) */
  nameEn?: string;
  /** URL base da imagem (sem /low.webp); prefere a versão em português */
  image?: string;
  rarity?: string;
  category?: string;
  /** variantes no formato da API (a classificação é feita na hora de mostrar) */
  raw: ApiVariantDetailed[];
}

export interface StoredSet {
  schema: 2;
  id: string;
  isPromoSet: boolean;
  /** carimbos que estão na coleção inteira (ex.: "30th-anniversary") */
  ignoredStamps: string[];
  namePt?: string;
  nameEn: string;
  serieName?: string;
  releaseDate?: string;
  /** código impresso no canto inferior esquerdo das cartas (ex.: "30C", "PRE") */
  code?: string;
  logo?: string;
  symbol?: string;
  official?: number;
  cards: StoredCard[];
  fetchedAt: string;
}

async function getJson<T>(url: string, tries = 3): Promise<T> {
  let lastErr: unknown;
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 404) throw Object.assign(new Error('not-found'), { notFound: true });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return (await res.json()) as T;
    } catch (e: any) {
      lastErr = e;
      if (e?.notFound) throw e;
      await new Promise((r) => setTimeout(r, 600 * (i + 1)));
    }
  }
  throw lastErr;
}

async function getJsonOrNull<T>(url: string): Promise<T | null> {
  try {
    return await getJson<T>(url);
  } catch (e: any) {
    if (e?.notFound) return null;
    throw e;
  }
}

/** Sets do Pokémon TCG Pocket (jogo de celular) ficam de fora: não são cartas físicas. */
const isPocketSet = (id: string) => /^([AB]\d|P-[A-Z])/.test(id);

interface ApiSetBrief {
  id: string;
  name: string;
  logo?: string;
  symbol?: string;
  cardCount?: { total?: number; official?: number };
}

/** Lista todas as expansões, juntando os nomes em português e inglês. */
export async function fetchAllSets(): Promise<SetSummary[]> {
  const [en, pt] = await Promise.all([
    getJson<ApiSetBrief[]>(`${BASE}/${EN}/sets`),
    getJsonOrNull<ApiSetBrief[]>(`${BASE}/${PT}/sets`),
  ]);
  const ptById = new Map((pt ?? []).map((s) => [s.id, s]));
  const list: SetSummary[] = en
    .filter((s) => !isPocketSet(s.id))
    .map((s) => {
      const p = ptById.get(s.id);
      return {
        id: s.id,
        nameEn: s.name,
        namePt: p?.name,
        logo: p?.logo ?? s.logo,
        symbol: s.symbol ?? p?.symbol,
        total: s.cardCount?.total ?? 0,
        official: s.cardCount?.official,
      };
    });
  // mais recentes primeiro (a API devolve em ordem de lançamento)
  return list.reverse();
}

interface ApiSetFull extends ApiSetBrief {
  releaseDate?: string;
  serie?: { id: string; name: string };
  abbreviation?: { official?: string; localized?: string };
  cards: { id: string; localId: string; name: string; image?: string }[];
}

interface ApiCard {
  id: string;
  localId: string;
  name: string;
  image?: string;
  rarity?: string;
  category?: string;
  variants?: Record<string, boolean>;
  variants_detailed?: any[];
}

async function pool<T, R>(items: T[], size: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(size, items.length) }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return out;
}

/** Baixa uma expansão completa com todas as cartas e variantes. */
export async function fetchFullSet(
  setId: string,
  onProgress?: (done: number, total: number) => void,
): Promise<StoredSet> {
  const [en, pt] = await Promise.all([
    getJson<ApiSetFull>(`${BASE}/${EN}/sets/${encodeURIComponent(setId)}`),
    getJsonOrNull<ApiSetFull>(`${BASE}/${PT}/sets/${encodeURIComponent(setId)}`),
  ]);
  const ptCards = new Map((pt?.cards ?? []).map((c) => [c.id, c]));
  const isPromoSet = /promo/i.test(en.name) || /promo/i.test(en.serie?.name ?? '');

  let done = 0;
  const total = en.cards.length;
  onProgress?.(0, total);

  const cards = await pool(en.cards, 8, async (brief) => {
    const detail = await getJsonOrNull<ApiCard>(`${BASE}/${EN}/cards/${encodeURIComponent(brief.id)}`);
    const p = ptCards.get(brief.id);
    done++;
    onProgress?.(done, total);
    const card: StoredCard = {
      id: brief.id,
      localId: String(brief.localId),
      name: p?.name ?? brief.name,
      nameEn: brief.name,
      image: p?.image ?? brief.image ?? detail?.image,
      rarity: rarityPt(detail?.rarity),
      category: detail?.category,
      raw: cleanRaw(detail?.variants_detailed, detail?.variants),
    };
    return card;
  });

  return {
    schema: 2,
    id: en.id,
    isPromoSet,
    ignoredStamps: detectSetWideStamps(cards),
    nameEn: en.name,
    namePt: pt?.name,
    serieName: pt?.serie?.name ?? en.serie?.name,
    releaseDate: en.releaseDate,
    code: pt?.abbreviation?.localized ?? en.abbreviation?.official ?? pt?.abbreviation?.official,
    logo: pt?.logo ?? en.logo,
    symbol: en.symbol,
    official: en.cardCount?.official,
    cards,
    fetchedAt: new Date().toISOString(),
  };
}

/** Dados básicos da coleção (data, era, código), sem baixar as cartas. */
export async function fetchSetInfo(setId: string): Promise<{ releaseDate?: string; serieName?: string; code?: string }> {
  const [en, pt] = await Promise.all([
    getJson<ApiSetFull>(`${BASE}/${EN}/sets/${encodeURIComponent(setId)}`),
    getJsonOrNull<ApiSetFull>(`${BASE}/${PT}/sets/${encodeURIComponent(setId)}`),
  ]);
  return {
    releaseDate: en.releaseDate,
    serieName: pt?.serie?.name ?? en.serie?.name,
    code: pt?.abbreviation?.localized ?? en.abbreviation?.official ?? pt?.abbreviation?.official,
  };
}

export const imageUrl = (base: string | undefined, quality: 'low' | 'high') =>
  base ? `${base}/${quality}.webp` : undefined;

export const assetUrl = (base: string | undefined) => (base ? `${base}.webp` : undefined);
