// Evolução do valor das cartas que eu tenho, a partir do histórico diário de preços guardado no celular.
// Compara sempre o MESMO conjunto de cartas (as que tenho hoje, com os filtros), para que
// comprar ou marcar carta nova não apareça como "valorização".

/** preços de um dia: cardId -> chave da variante -> [TCGplayer US$, Cardmarket €] */
export type DayPrices = Record<string, Record<string, [number | null, number | null]>>;
/** histórico de uma coleção: "AAAA-MM-DD" -> preços do dia */
export type History = Record<string, DayPrices>;

export interface Basket {
  setId: string;
  items: { cardId: string; variantKey: string }[];
}

export type Source = 'tcg' | 'cm';

export interface Evolution {
  points: { date: string; value: number }[];
  /** primeiro e último dia com dados dentro do período */
  startDate?: string;
  endDate?: string;
  start: number;
  end: number;
  delta: number;
  pct: number;
  /** quantos dias do período escolhido já têm histórico */
  coveredDays: number;
  /** cartas que entram na conta (têm preço no começo do período) */
  itemsCounted: number;
}

export function localDate(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return localDate(new Date(y, m - 1, d + days, 12));
}

export function daysBetween(a: string, b: string): number {
  const [y1, m1, d1] = a.split('-').map(Number);
  const [y2, m2, d2] = b.split('-').map(Number);
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86400000);
}

export function evolution(
  baskets: Basket[],
  histories: Record<string, History | null | undefined>,
  source: Source,
  rangeDays: number,
  today: string = localDate(),
): Evolution {
  const empty: Evolution = { points: [], start: 0, end: 0, delta: 0, pct: 0, coveredDays: 0, itemsCounted: 0 };
  const from = addDays(today, -rangeDays);
  const idx = source === 'tcg' ? 0 : 1;

  // dias com dados dentro do período (de todas as coleções)
  const dateSet = new Set<string>();
  for (const b of baskets) for (const d of Object.keys(histories[b.setId] ?? {})) if (d >= from && d <= today) dateSet.add(d);
  const dates = [...dateSet].sort();
  if (!dates.length) return empty;

  // preço de uma variante num dia: o último registro até aquele dia (dias sem abrir o app repetem o anterior)
  const sortedDays: Record<string, string[]> = {};
  for (const b of baskets) sortedDays[b.setId] = Object.keys(histories[b.setId] ?? {}).sort();
  const priceAt = (setId: string, cardId: string, key: string, date: string): number | null => {
    const h = histories[setId];
    const days = sortedDays[setId];
    if (!h || !days) return null;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i] > date) continue;
      const v = h[days[i]]?.[cardId]?.[key]?.[idx];
      if (typeof v === 'number' && v > 0) return v;
    }
    return null;
  };

  // cesta fixa: só cartas que já tinham preço no primeiro dia do período
  const first = dates[0];
  const counted: { setId: string; cardId: string; key: string }[] = [];
  for (const b of baskets)
    for (const it of b.items) if (priceAt(b.setId, it.cardId, it.variantKey, first) !== null) counted.push({ setId: b.setId, cardId: it.cardId, key: it.variantKey });
  if (!counted.length) return { ...empty, startDate: first, endDate: dates[dates.length - 1], coveredDays: daysBetween(first, today) };

  const points = dates.map((date) => {
    let value = 0;
    for (const c of counted) value += priceAt(c.setId, c.cardId, c.key, date) ?? 0;
    return { date, value };
  });
  const start = points[0].value;
  const end = points[points.length - 1].value;
  return {
    points,
    startDate: first,
    endDate: dates[dates.length - 1],
    start,
    end,
    delta: end - start,
    pct: start > 0 ? ((end - start) / start) * 100 : 0,
    coveredDays: daysBetween(first, today),
    itemsCounted: counted.length,
  };
}

/** Converte os preços salvos de uma coleção para o formato compacto do histórico. */
export function toDayPrices(cards: Record<string, Record<string, { tcg?: number; cm?: number }>>): DayPrices {
  const out: DayPrices = {};
  for (const [cardId, vars] of Object.entries(cards)) {
    out[cardId] = {};
    for (const [k, p] of Object.entries(vars)) out[cardId][k] = [p.tcg ?? null, p.cm ?? null];
  }
  return out;
}
