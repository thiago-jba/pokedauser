// Nome da era (série) em português. A TCGdex às vezes só tem o nome em inglês.
const ERA_PT: Record<string, string> = {
  'Mega Evolution': 'Megaevolução',
  'Scarlet & Violet': 'Escarlate e Violeta',
  'Sword & Shield': 'Espada e Escudo',
  'Sun & Moon': 'Sol e Lua',
  XY: 'XY',
  'Black & White': 'Preto e Branco',
  'Call of Legends': 'Chamado das Lendas',
  'HeartGold & SoulSilver': 'HeartGold e SoulSilver',
  Platinum: 'Platina',
  'Diamond & Pearl': 'Diamante e Pérola',
  POP: 'POP',
  EX: 'EX',
  'E-Card': 'E-Card',
  Neo: 'Neo',
  Gym: 'Gym',
  Base: 'Base',
  'Legendary Collection': 'Legendary Collection',
  Miscellaneous: 'Diversos',
  "McDonald's Collection": "Coleção McDonald's",
  'Trainer kits': 'Kits de Treinador',
};

export function eraPt(name?: string): string {
  if (!name) return 'Era desconhecida';
  return ERA_PT[name] ?? name;
}

export type HomeSort = 'adicionada' | 'lancamento_desc' | 'lancamento_asc' | 'era' | 'pct_desc' | 'pct_asc' | 'nome';

export const HOME_SORTS: { value: HomeSort; label: string }[] = [
  { value: 'adicionada', label: 'Adicionadas por último' },
  { value: 'lancamento_desc', label: 'Lançamento (mais nova primeiro)' },
  { value: 'lancamento_asc', label: 'Lançamento (mais antiga primeiro)' },
  { value: 'era', label: 'Era' },
  { value: 'pct_desc', label: '% completado (maior primeiro)' },
  { value: 'pct_asc', label: '% completado (menor primeiro)' },
  { value: 'nome', label: 'Nome (A–Z)' },
];

export const sortLabel = (s: HomeSort) => HOME_SORTS.find((o) => o.value === s)?.label ?? '';
