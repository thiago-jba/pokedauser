// Coleções Especiais: coleções por personagem (Pikachu's, Charizard's…) ou por tipo de carta (Energias).
// Ficam separadas das expansões ("Minha Coleção") e da Pokédex: nenhuma alimenta a outra.
import { fetchCardsByName, fetchEnergyCards, fetchPokemonCards } from './pokedex';
import type { PokemonCardBrief } from './pokedex';
import type { SpecialCard, SpecialCollection } from './storage';
import { normalize } from './variants';

type Preset = Omit<SpecialCollection, 'createdAt' | 'cards'>;

/** Sugestões prontas (identificador fixo: criar no celular e no computador não duplica). */
export const PRESETS: Preset[] = [
  { uid: 'pokemon-25', name: "Pikachu's", kind: 'pokemon', dexId: 25, term: 'Pikachu' },
  { uid: 'pokemon-6', name: "Charizard's", kind: 'pokemon', dexId: 6, term: 'Charizard' },
  { uid: 'pokemon-143', name: "Snorlax's", kind: 'pokemon', dexId: 143, term: 'Snorlax' },
  { uid: 'energia', name: "Energia's", kind: 'energia' },
];

/** Descrição curta do que a coleção procura. */
export function specialSubtitle(c: Pick<SpecialCollection, 'kind' | 'term'>): string {
  if (c.kind === 'energia') return 'Todas as cartas de Energia';
  if (c.kind === 'pokemon') return `Cartas de ${c.term}`;
  return `Cartas com "${c.term}" no nome`;
}

/** A carta (pelo nome) é do personagem/tipo da coleção? Usado para filtrar as cartas de uma expansão. */
export function matchesSpecial(c: Pick<SpecialCollection, 'kind' | 'term'>, cardName: string): boolean {
  if (c.kind === 'energia') return /\benergy$|^energia\b/i.test(cardName.trim());
  return !!c.term && normalize(cardName).includes(normalize(c.term));
}

/** Junta listas de cartas sem repetir. */
export function uniqueCards(...lists: PokemonCardBrief[][]): PokemonCardBrief[] {
  const seen = new Set<string>();
  const out: PokemonCardBrief[] = [];
  for (const l of lists)
    for (const x of l) {
      if (seen.has(x.id)) continue;
      seen.add(x.id);
      out.push(x);
    }
  return out;
}

/** Todas as cartas (de todas as expansões) que entram nesta coleção. */
export async function fetchSpecialCandidates(c: Pick<SpecialCollection, 'kind' | 'term' | 'dexId'>): Promise<PokemonCardBrief[]> {
  if (c.kind === 'energia') return fetchEnergyCards();
  const lists = await Promise.all([
    c.term ? fetchCardsByName(c.term).catch(() => []) : Promise.resolve([]),
    c.kind === 'pokemon' && c.dexId ? fetchPokemonCards(c.dexId).catch(() => []) : Promise.resolve([]),
  ]);
  return uniqueCards(...lists);
}

// ---------- tela de uma Coleção Especial: cartas separadas por expansão ----------

export type SpecialView = 'tenho' | 'todas';

export type SpecialTile =
  | { kind: 'owned'; key: string; card: SpecialCard }
  | { kind: 'missing'; key: string; card: PokemonCardBrief };

export interface SpecialSection {
  setId: string;
  setName: string;
  tiles: SpecialTile[];
  /** cartas diferentes que tenho nesta expansão */
  ownedCards: number;
  /** cartas da coleção nesta expansão (só no modo "todas") */
  totalCards?: number;
}

const numKey = (localId: string) => (/^\d+$/.test(localId) ? localId.padStart(6, '0') : `~${localId}`);

/**
 * Monta as seções (uma por expansão).
 * - "tenho": só as cartas que tenho; com país escolhido, só as daquele país.
 * - "todas": todas as cartas do personagem/tipo; as que não tenho vêm como "missing" (foto apagada).
 * Expansões mais novas primeiro (ordem da lista de expansões); dentro de cada uma, pelo número.
 */
export function buildSpecialSections(
  owned: SpecialCard[],
  candidates: PokemonCardBrief[],
  opts: { view: SpecialView; country?: string },
  setInfo: (setId: string) => { name?: string; order?: number },
): SpecialSection[] {
  const view: SpecialView = opts.country ? 'tenho' : opts.view;
  const mine = opts.country ? owned.filter((c) => c.country === opts.country) : owned;
  const bySet = new Map<string, { setName: string; tiles: SpecialTile[]; ownedIds: Set<string>; total?: number }>();
  const sec = (setId: string, fallbackName: string) => {
    let s = bySet.get(setId);
    if (!s) {
      s = { setName: setInfo(setId).name ?? fallbackName, tiles: [], ownedIds: new Set() };
      bySet.set(setId, s);
    }
    return s;
  };
  for (const c of mine) {
    const s = sec(c.setId, c.setName);
    s.tiles.push({ kind: 'owned', key: c.uid, card: c });
    s.ownedIds.add(c.cardId);
  }
  if (view === 'todas') {
    const ownedIds = new Set(owned.map((c) => c.cardId));
    const totals = new Map<string, Set<string>>();
    for (const c of candidates) {
      totals.set(c.setId, (totals.get(c.setId) ?? new Set()).add(c.id));
      if (ownedIds.has(c.id)) continue;
      sec(c.setId, c.setId).tiles.push({ kind: 'missing', key: `falta-${c.id}`, card: c });
    }
    for (const [setId, s] of bySet) {
      const t = totals.get(setId) ?? new Set();
      for (const id of s.ownedIds) t.add(id); // cartas incluídas à mão (personagem no fundo) também contam
      s.total = t.size;
    }
  }
  const localOf = (t: SpecialTile) => (t.kind === 'owned' ? t.card.localId : t.card.localId);
  const order = (id: string) => setInfo(id).order ?? -1;
  return [...bySet.entries()]
    .map(([setId, s]) => ({
      setId,
      setName: s.setName,
      tiles: s.tiles.sort((a, b) => numKey(localOf(a)).localeCompare(numKey(localOf(b))) || (a.kind === 'owned' ? (a.card as SpecialCard).addedAt : '').localeCompare(b.kind === 'owned' ? (b.card as SpecialCard).addedAt : '')),
      ownedCards: s.ownedIds.size,
      totalCards: s.total,
    }))
    .sort((a, b) => order(b.setId) - order(a.setId) || a.setName.localeCompare(b.setName, 'pt-BR'));
}
