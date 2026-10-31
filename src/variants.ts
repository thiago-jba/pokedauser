// Classificação das variantes de cada carta.
// Os dados vêm da API TCGdex em inglês (valores "crus", ex.: type "reverse", foil "pokeball"),
// e aqui são traduzidos para português e agrupados nas categorias usadas no filtro.

export type VariantCategory =
  | 'normal'
  | 'holo'
  | 'reverse'
  | 'reverse_especial'
  | 'primeira_edicao'
  | 'promo'
  | 'outras';

export const CATEGORY_LABELS: Record<VariantCategory, string> = {
  normal: 'Normal',
  holo: 'Holo',
  reverse: 'Reverse Foil',
  reverse_especial: 'Reverse Especial',
  primeira_edicao: '1ª Edição',
  promo: 'Promo / Carimbada',
  outras: 'Outras',
};

export const CATEGORY_ORDER: VariantCategory[] = [
  'normal',
  'holo',
  'reverse',
  'reverse_especial',
  'primeira_edicao',
  'promo',
  'outras',
];

/** Variante no formato da API (em inglês). Os dois últimos campos são do próprio app. */
export interface ApiVariantDetailed {
  type?: string;
  subtype?: string;
  size?: string;
  stamp?: string[];
  foil?: string;
  variantId?: string;
  /** força a categoria Promo (ex.: carta de blister que a API não marca como promo) */
  promo?: boolean;
  /** variante adicionada à mão pelo usuário */
  custom?: boolean;
}

export interface ApiVariantsBooleans {
  normal?: boolean;
  reverse?: boolean;
  holo?: boolean;
  firstEdition?: boolean;
  wPromo?: boolean;
}

export interface CardVariant {
  /** chave única dentro da carta (usada para marcar "tenho") */
  key: string;
  category: VariantCategory;
  /** rótulo curto mostrado no selo da carta, ex.: "Reverse Poké Bola" */
  label: string;
  /** tipo de brilho, para o efeito visual na tela */
  finish: 'normal' | 'holo' | 'reverse' | 'special';
  custom?: boolean;
}

export const FOIL_PT: Record<string, string> = {
  pokeball: 'Poké Bola',
  greatball: 'Great Bola',
  ultraball: 'Ultra Bola',
  masterball: 'Master Bola',
  gold: 'Ouro',
  cosmos: 'Cosmos',
  galaxy: 'Galáxia',
  starlight: 'Luz Estelar',
  energy: 'Energia',
  'cracked-ice': 'Gelo Rachado',
  mirror: 'Espelhado',
  league: 'Liga',
  'player-reward': 'Recompensa',
  'professor-program': 'Programa Professor',
  tinsel: 'Tinsel',
  loveball: 'Bola do Amor',
  friendball: 'Bola da Amizade',
  quickball: 'Bola Rápida',
  duskball: 'Bola Crepúsculo',
  'team-rocket': 'Equipe Rocket',
  rainbow: 'Arco-íris',
  glitter: 'Cintilante',
};

const STAMP_PT: Record<string, string> = {
  '1st-edition': '1ª Edição',
  'w-promo': 'Promo W',
  'pre-release': 'Pré-lançamento',
  'pokemon-center': 'Pokémon Center',
  'set-logo': 'Carimbo da Coleção',
  staff: 'Staff',
  'professor-program': 'Programa Professor',
  'player-rewards-program': 'Player Rewards',
  snowflake: 'Floco de Neve',
  'trick-or-trade': 'Trick or Trade',
  'ace-trainer': 'Ace Trainer',
  pokeball: 'Carimbo Poké Bola',
  '30th-anniversary': '30 Anos',
};

const TYPE_PT: Record<string, string> = {
  normal: 'Normal',
  holo: 'Holo',
  reverse: 'Reverse',
  metal: 'Metal',
  lenticular: 'Lenticular',
};

function prettify(raw: string): string {
  return raw
    .split('-')
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(' ');
}

const foilPt = (f: string) => FOIL_PT[f.toLowerCase()] ?? prettify(f);
const stampPt = (s: string) => STAMP_PT[s.toLowerCase()] ?? prettify(s);

/** Chave estável da variante: não muda entre atualizações, para não perder as marcações. */
export function variantKey(v: ApiVariantDetailed): string {
  const type = (v.type ?? 'normal').toLowerCase();
  const size = v.size?.toLowerCase();
  const stamps = (v.stamp ?? []).map((s) => s.toLowerCase());
  return [type, v.subtype ?? '', size && size !== 'standard' ? size : '', v.foil?.toLowerCase() ?? '', [...stamps].sort().join('+')]
    .join('|')
    .replace(/\|+$/, '');
}

/** Caminho inverso de variantKey (usado para migrar dados salvos de versões antigas). */
export function keyToVariant(key: string): ApiVariantDetailed {
  const [type, subtype, size, foil, stamps] = key.split('|');
  return {
    type: type || 'normal',
    subtype: subtype || undefined,
    size: size || undefined,
    foil: foil || undefined,
    stamp: stamps ? stamps.split('+') : undefined,
  };
}

/**
 * Classifica uma variante.
 * @param ignoreStamps carimbos que aparecem na coleção inteira (ex.: "30 anos"):
 *   fazem parte da identidade da coleção, então não tornam a carta "promo".
 */
export function classifyDetailed(
  v: ApiVariantDetailed,
  isPromoSet: boolean,
  ignoreStamps: ReadonlySet<string> = new Set(),
): CardVariant {
  const type = (v.type ?? 'normal').toLowerCase();
  const foil = v.foil?.toLowerCase();
  const allStamps = (v.stamp ?? []).map((s) => s.toLowerCase());
  const stamps = allStamps.filter((s) => !ignoreStamps.has(s));
  const size = v.size?.toLowerCase();
  const key = variantKey(v);

  const extras: string[] = [];
  if (foil) extras.push(foilPt(foil));
  for (const s of stamps) if (s !== '1st-edition') extras.push(stampPt(s));
  if (v.subtype) extras.push(prettify(v.subtype));
  if (size === 'jumbo') extras.push('Jumbo');

  let category: VariantCategory;
  if (stamps.includes('1st-edition')) category = 'primeira_edicao';
  else if (v.promo || stamps.length > 0 || size === 'jumbo') category = 'promo';
  else if (type === 'reverse') category = foil ? 'reverse_especial' : 'reverse';
  else if (type === 'holo') category = 'holo';
  else if (type === 'normal') category = isPromoSet ? 'promo' : 'normal';
  else category = 'outras';

  let finish: CardVariant['finish'];
  if (type === 'reverse') finish = foil ? 'special' : 'reverse';
  else if (type === 'holo') finish = foil ? 'special' : 'holo';
  else if (type === 'normal') finish = 'normal';
  else finish = 'special';

  const base = category === 'primeira_edicao' ? `1ª Ed. ${TYPE_PT[type] ?? prettify(type)}` : TYPE_PT[type] ?? prettify(type);
  const label = [base, ...extras].join(' ');

  return { key, category, label, finish, custom: v.custom };
}

/** Converte o formato antigo da API (true/false) para a lista detalhada. */
export function booleansToDetailed(b: ApiVariantsBooleans | undefined): ApiVariantDetailed[] {
  if (!b) return [];
  const list: ApiVariantDetailed[] = [];
  if (b.normal) list.push({ type: 'normal' });
  if (b.holo) list.push({ type: 'holo' });
  if (b.reverse) list.push({ type: 'reverse' });
  if (b.firstEdition) list.push({ type: b.holo ? 'holo' : 'normal', stamp: ['1st-edition'] });
  if (b.wPromo) list.push({ type: 'holo', stamp: ['w-promo'] });
  return list;
}

/** Deixa só os campos que importam e garante pelo menos uma variante. */
export function cleanRaw(detailed: ApiVariantDetailed[] | undefined, booleans: ApiVariantsBooleans | undefined): ApiVariantDetailed[] {
  const src = detailed && detailed.length > 0 ? detailed : booleansToDetailed(booleans);
  const list = src.map((v) => ({
    type: v.type,
    ...(v.subtype ? { subtype: v.subtype } : {}),
    ...(v.size && v.size !== 'standard' ? { size: v.size } : {}),
    ...(v.foil ? { foil: v.foil } : {}),
    ...(v.stamp && v.stamp.length ? { stamp: v.stamp } : {}),
  }));
  return list.length ? list : [{ type: 'normal' }];
}

/** Carimbos presentes em pelo menos 60% das variantes da coleção = marca da coleção. */
export function detectSetWideStamps(cards: { raw: ApiVariantDetailed[] }[]): string[] {
  let total = 0;
  const count = new Map<string, number>();
  for (const c of cards)
    for (const v of c.raw) {
      total++;
      for (const s of new Set((v.stamp ?? []).map((x) => x.toLowerCase()))) count.set(s, (count.get(s) ?? 0) + 1);
    }
  if (total === 0) return [];
  return [...count.entries()].filter(([s, n]) => s !== '1st-edition' && n / total >= 0.6).map(([s]) => s);
}

/** Lista final de variantes de uma carta (dados da API + correções + adicionadas à mão), sem repetir. */
export function buildVariants(
  raw: ApiVariantDetailed[],
  isPromoSet: boolean,
  ignoreStamps: ReadonlySet<string> = new Set(),
): CardVariant[] {
  const seen = new Set<string>();
  const out: CardVariant[] = [];
  for (const v of raw.length ? raw : [{ type: 'normal' }]) {
    const c = classifyDetailed(v, isPromoSet, ignoreStamps);
    if (seen.has(c.key)) continue;
    seen.add(c.key);
    out.push(c);
  }
  return out;
}

const RARITY_PT: Record<string, string> = {
  'ACE SPEC Rare': 'ACE SPEC Rara',
  'Amazing Rare': 'Rara Incrível',
  'Classic Collection': 'Coleção Clássica',
  Common: 'Comum',
  'Double rare': 'Rara Dupla',
  'Full Art Trainer': 'Treinador Arte Completa',
  'Holo Rare': 'Rara Holo',
  'Holo Rare V': 'Rara Holo V',
  'Holo Rare VMAX': 'Rara Holo VMAX',
  'Holo Rare VSTAR': 'Rara Holo VSTAR',
  'Hyper rare': 'Hiper Rara',
  'Illustration rare': 'Ilustração Rara',
  LEGEND: 'LEGEND',
  None: 'Sem raridade',
  'Radiant Rare': 'Rara Radiante',
  Rare: 'Rara',
  'Rare Holo': 'Rara Holo',
  'Rare Holo LV.X': 'Rara Holo LV.X',
  'Rare PRIME': 'Rara Prime',
  'Secret Rare': 'Rara Secreta',
  'Shiny rare': 'Rara Brilhante',
  'Shiny rare V': 'Rara Brilhante V',
  'Shiny rare VMAX': 'Rara Brilhante VMAX',
  'Shiny Ultra Rare': 'Ultra Rara Brilhante',
  'Special illustration rare': 'Ilustração Rara Especial',
  'Ultra Rare': 'Ultra Rara',
  Uncommon: 'Incomum',
  'Black White Rare': 'Rara Preto e Branco',
  'RGB Rare': 'Rara RGB',
  'Pikachu Rare': 'Rara Pikachu',
  'Futuristic Rare': 'Rara Futurista',
  'Mega Hyper Rare': 'Mega Hiper Rara',
  'Mega Attack Rare': 'Mega Ataque Rara',
  Promo: 'Promo',
};

export function rarityPt(r?: string): string | undefined {
  if (!r) return undefined;
  return RARITY_PT[r] ?? r;
}

/** Remove acentos e deixa em minúsculas, para a busca. */
const ACCENTS: Record<string, string> = {
  á: 'a', à: 'a', â: 'a', ã: 'a', ä: 'a', é: 'e', è: 'e', ê: 'e', ë: 'e', í: 'i', ì: 'i', î: 'i', ï: 'i',
  ó: 'o', ò: 'o', ô: 'o', õ: 'o', ö: 'o', ú: 'u', ù: 'u', û: 'u', ü: 'u', ç: 'c', ñ: 'n',
};

export function normalize(s: string): string {
  // não depende de String.normalize, que pode não existir em todos os celulares
  return s.toLowerCase().replace(/[^\u0000-\u007f]/g, (ch) => ACCENTS[ch] ?? ch).trim();
}

/** Todas as palavras digitadas precisam aparecer no texto (em qualquer ordem). */
export function matchesQuery(text: string, query: string): boolean {
  const words = normalize(query).split(/\s+/).filter(Boolean);
  if (words.length === 0) return true;
  const t = normalize(text);
  return words.every((w) => t.includes(w));
}
