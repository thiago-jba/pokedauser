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

export interface ApiVariantDetailed {
  type?: string;
  subtype?: string;
  size?: string;
  stamp?: string[];
  foil?: string;
  variantId?: string;
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
}

const FOIL_PT: Record<string, string> = {
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

/** Classifica uma variante detalhada (formato da API em inglês). */
export function classifyDetailed(v: ApiVariantDetailed, isPromoSet: boolean): CardVariant {
  const type = (v.type ?? 'normal').toLowerCase();
  const foil = v.foil?.toLowerCase();
  const stamps = (v.stamp ?? []).map((s) => s.toLowerCase());
  const size = v.size?.toLowerCase();

  // chave estável montada a partir dos campos (não depende de IDs internos da API,
  // para que as marcações "tenho" sobrevivam a atualizações da coleção)
  const key = [type, v.subtype ?? '', size && size !== 'standard' ? size : '', foil ?? '', [...stamps].sort().join('+')]
    .join('|')
    .replace(/\|+$/, '');

  const extras: string[] = [];
  if (foil) extras.push(foilPt(foil));
  for (const s of stamps) if (s !== '1st-edition') extras.push(stampPt(s));
  if (v.subtype) extras.push(prettify(v.subtype));
  if (size === 'jumbo') extras.push('Jumbo');

  let category: VariantCategory;
  let finish: CardVariant['finish'];

  if (stamps.includes('1st-edition')) {
    category = 'primeira_edicao';
  } else if (stamps.length > 0 || size === 'jumbo') {
    category = 'promo';
  } else if (type === 'reverse') {
    category = foil ? 'reverse_especial' : 'reverse';
  } else if (type === 'holo') {
    category = 'holo';
  } else if (type === 'normal') {
    category = isPromoSet ? 'promo' : 'normal';
  } else {
    category = 'outras';
  }

  if (type === 'reverse') finish = foil ? 'special' : 'reverse';
  else if (type === 'holo') finish = foil ? 'special' : 'holo';
  else if (type === 'normal') finish = 'normal';
  else finish = 'special';

  const base = category === 'primeira_edicao' ? `1ª Ed. ${TYPE_PT[type] ?? prettify(type)}` : TYPE_PT[type] ?? prettify(type);
  const label = [base, ...extras].join(' ');

  return { key, category, label, finish };
}

/** Converte as variantes de uma carta da API para a lista usada no app. */
export function buildVariants(
  detailed: ApiVariantDetailed[] | undefined,
  booleans: ApiVariantsBooleans | undefined,
  isPromoSet: boolean,
): CardVariant[] {
  let list: CardVariant[] = [];

  if (detailed && detailed.length > 0) {
    list = detailed.map((v) => classifyDetailed(v, isPromoSet));
  } else if (booleans) {
    const b = booleans;
    if (b.normal) list.push(classifyDetailed({ type: 'normal' }, isPromoSet));
    if (b.holo) list.push(classifyDetailed({ type: 'holo' }, isPromoSet));
    if (b.reverse) list.push(classifyDetailed({ type: 'reverse' }, isPromoSet));
    if (b.firstEdition) {
      list.push(classifyDetailed({ type: b.holo ? 'holo' : 'normal', stamp: ['1st-edition'] }, isPromoSet));
    }
    if (b.wPromo) list.push(classifyDetailed({ type: 'holo', stamp: ['w-promo'] }, isPromoSet));
  }

  // nenhuma informação de variante: assume que existe ao menos a versão básica
  if (list.length === 0) list.push(classifyDetailed({ type: 'normal' }, isPromoSet));

  // remove chaves duplicadas (algumas cartas repetem a mesma variante com IDs de loja diferentes)
  const seen = new Set<string>();
  return list.filter((v) => (seen.has(v.key) ? false : (seen.add(v.key), true)));
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
