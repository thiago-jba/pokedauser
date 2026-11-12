// Coleções Especiais: coleções por personagem (Pikachu's, Charizard's…) ou por tipo de carta (Energias).
// Ficam separadas das expansões ("Minha Coleção") e da Pokédex: nenhuma alimenta a outra.
import { fetchCardsByName, fetchEnergyCards, fetchPokemonCards } from './pokedex';
import type { PokemonCardBrief } from './pokedex';
import type { SpecialCollection } from './storage';
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
