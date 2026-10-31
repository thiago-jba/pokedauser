// Preços de mercado de cada variante e links de busca nas lojas brasileiras.
//  - TCGplayer (EUA, US$) e Cardmarket (Europa, €): vêm da TCGdex, sempre o MENOR preço anunciado.
//  - Liga Pokémon e Jornada Games: não têm acesso aberto aos dados, então o app abre a página
//    da carta no site, onde aparece o preço atual em reais.
import { Directory, File, Paths } from 'expo-file-system';
import type { StoredSet } from './api';
import { cardPrices } from './priceUtil';
import type { VariantPrice } from './priceUtil';

export { fmtMoney, jornadaUrl, ligaUrl } from './priceUtil';
export type { VariantPrice } from './priceUtil';

const BASE = 'https://api.tcgdex.net/v2/en';
const RATES_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL,EUR-BRL';

export interface SetPrices {
  fetchedAt: string;
  /** nome em inglês de cada carta (usado nos links das lojas) */
  names: Record<string, string>;
  /** cardId -> chave da variante -> preços */
  cards: Record<string, Record<string, VariantPrice>>;
}

export interface Rates {
  usd: number;
  eur: number;
  fetchedAt: string;
}

async function getJson(url: string): Promise<any | null> {
  for (let i = 0; i < 2; i++) {
    try {
      const r = await fetch(url);
      if (r.status === 404) return null;
      if (r.ok) return await r.json();
    } catch {}
    await new Promise((res) => setTimeout(res, 500));
  }
  return null;
}

/** Preços de uma carta, direto da API (usado na tela da carta). */
export async function fetchCardPrices(cardId: string): Promise<{ name?: string; prices: Record<string, VariantPrice> } | null> {
  const d = await getJson(`${BASE}/cards/${encodeURIComponent(cardId)}`);
  if (!d) return null;
  return { name: d.name, prices: cardPrices(d) };
}

/** Preços de todas as cartas de uma coleção. */
export async function fetchSetPrices(set: StoredSet, onProgress?: (done: number, total: number) => void): Promise<SetPrices> {
  const result: SetPrices = { fetchedAt: new Date().toISOString(), names: {}, cards: {} };
  const cards = set.cards;
  let next = 0;
  let done = 0;
  const worker = async () => {
    while (next < cards.length) {
      const c = cards[next++];
      const d = await getJson(`${BASE}/cards/${encodeURIComponent(c.id)}`);
      if (d) {
        if (d.name) result.names[c.id] = d.name;
        const p = cardPrices(d);
        if (Object.keys(p).length) result.cards[c.id] = p;
      }
      done++;
      onProgress?.(done, cards.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(8, cards.length) }, worker));
  return result;
}

// ---------- armazenamento ----------

const pricesDir = () => new Directory(Paths.document, 'precos');
const pricesFile = (id: string) => new File(pricesDir(), `${id.replace(/[^a-zA-Z0-9._-]/g, '_')}.json`);
const ratesFile = () => new File(Paths.document, 'cotacao.json');
const priceCache = new Map<string, SetPrices | null>();

function readJson<T>(f: File): T | null {
  try {
    return f.exists ? (JSON.parse(f.textSync()) as T) : null;
  } catch {
    return null;
  }
}
function writeJson(f: File, data: unknown) {
  if (!f.exists) f.create({ intermediates: true } as any);
  f.write(JSON.stringify(data));
}

export function loadSetPrices(setId: string): SetPrices | null {
  if (priceCache.has(setId)) return priceCache.get(setId) ?? null;
  const p = readJson<SetPrices>(pricesFile(setId));
  priceCache.set(setId, p);
  return p;
}

export function saveSetPrices(setId: string, p: SetPrices) {
  const d = pricesDir();
  if (!d.exists) d.create({ intermediates: true, idempotent: true } as any);
  writeJson(pricesFile(setId), p);
  priceCache.set(setId, p);
}

export function deleteSetPrices(setId: string) {
  try {
    const f = pricesFile(setId);
    if (f.exists) f.delete();
  } catch {}
  priceCache.delete(setId);
}

export const PRICES_MAX_AGE_H = 24;
export function pricesAreStale(p: SetPrices | null): boolean {
  return !p || Date.now() - new Date(p.fetchedAt).getTime() > PRICES_MAX_AGE_H * 3600000;
}

/** Cotação do dólar e do euro em reais (atualizada a cada 12h). */
export async function getRates(): Promise<Rates | null> {
  const cached = readJson<Rates>(ratesFile());
  if (cached && Date.now() - new Date(cached.fetchedAt).getTime() < 12 * 3600000) return cached;
  try {
    const j = await (await fetch(RATES_URL)).json();
    const r: Rates = { usd: parseFloat(j.USDBRL.bid), eur: parseFloat(j.EURBRL.bid), fetchedAt: new Date().toISOString() };
    if (r.usd > 0 && r.eur > 0) {
      writeJson(ratesFile(), r);
      return r;
    }
  } catch {}
  return cached;
}

export function cachedRates(): Rates | null {
  return readJson<Rates>(ratesFile());
}


/** Soma o menor preço das variantes que eu tenho (só as da lista recebida, já filtrada). */
export function collectionValue(
  entries: { key: string; card: { id: string }; variant: { key: string } }[],
  isOwned: (key: string) => boolean,
  prices: SetPrices | null,
) {
  let tcg = 0;
  let cm = 0;
  let ownedCount = 0;
  let priced = 0;
  for (const e of entries) {
    if (!isOwned(e.key)) continue;
    ownedCount++;
    const vp = prices?.cards[e.card.id]?.[e.variant.key];
    if (vp?.tcg) tcg += vp.tcg;
    if (vp?.cm) cm += vp.cm;
    if (vp?.tcg || vp?.cm) priced++;
  }
  return { tcg, cm, ownedCount, priced };
}
