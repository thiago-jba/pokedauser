// Preços dos boosters: arquivo publicado 1x por dia junto com a versão web (scripts/booster-prices.mjs).
// O preço é do "Booster Pack" da expansão no TCGplayer (US$, preço de mercado): um por expansão,
// sem separar estampa nem país. Fica guardado como "__boosters" para entrar no histórico da evolução.
import type { Basket } from './evolution';
import { localDate } from './evolution';
import { loadSetPrices, pricesAreStale, saveSetPrices } from './prices';
import { WEB_URL } from './sync/config';

export const BOOSTERS_PRICES_ID = '__boosters';
const KEY = 'booster';

export async function refreshBoosterPrices(): Promise<boolean> {
  if (!pricesAreStale(loadSetPrices(BOOSTERS_PRICES_ID))) return false;
  const r = await fetch(`${WEB_URL}/boosters-precos.json?d=${localDate()}`);
  if (!r.ok) throw new Error(`preços ${r.status}`);
  const j = await r.json();
  const cards: Record<string, Record<string, { tcg?: number }>> = {};
  for (const [setId, v] of Object.entries<any>(j.sets ?? {})) if (typeof v?.usd === 'number') cards[setId] = { [KEY]: { tcg: v.usd } };
  if (!Object.keys(cards).length) return false;
  saveSetPrices(BOOSTERS_PRICES_ID, { fetchedAt: new Date().toISOString(), names: {}, cards });
  return true;
}

/** Preço (US$) de um booster da expansão, ou undefined se o TCGplayer não tiver. */
export const boosterPrice = (setId: string): number | undefined => loadSetPrices(BOOSTERS_PRICES_ID)?.cards[setId]?.[KEY]?.tcg;

/** "Cesta" para o gráfico de evolução: um item por booster que tenho. */
export const boosterBasket = (list: { setId: string }[]): Basket[] => [
  { setId: BOOSTERS_PRICES_ID, items: list.map((b) => ({ cardId: b.setId, variantKey: KEY })) },
];
