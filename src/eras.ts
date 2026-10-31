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

// Ordem fixa das eras na tela inicial (mais recente primeiro).
const ERA_ORDER = [
  'Megaevolução',
  'Escarlate e Violeta',
  'Espada e Escudo',
  'Sol e Lua',
  'XY',
  'Preto e Branco',
  'Chamado das Lendas',
  'HeartGold e SoulSilver',
  'Platina',
  'Diamante e Pérola',
  'POP',
  'EX',
  'E-Card',
  'Legendary Collection',
  'Neo',
  'Gym',
  'Base',
];

/** Posição da era na tela inicial; eras desconhecidas e "Diversos" vão para o fim. */
export function eraRank(era: string): number {
  const i = ERA_ORDER.indexOf(era);
  return i === -1 ? ERA_ORDER.length : i;
}

export type HomeSort = 'lancamento_desc' | 'lancamento_asc' | 'pct_desc' | 'pct_asc';

export const HOME_SORTS: { value: HomeSort; label: string }[] = [
  { value: 'lancamento_desc', label: 'Data de publicação (mais nova primeiro)' },
  { value: 'lancamento_asc', label: 'Data de publicação (mais antiga primeiro)' },
  { value: 'pct_desc', label: '% completado (maior primeiro)' },
  { value: 'pct_asc', label: '% completado (menor primeiro)' },
];

export function normalizeSort(s?: string): HomeSort {
  return HOME_SORTS.some((o) => o.value === s) ? (s as HomeSort) : 'lancamento_desc';
}

export const sortLabel = (s: HomeSort) => HOME_SORTS.find((o) => o.value === s)?.label ?? '';

/** "2026-09-16" -> "16/09/2026" */
export function formatDateBr(iso?: string): string {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-');
  return d && m && y ? `${d}/${m}/${y}` : iso;
}

/** "16/09/2026" -> "2026-09-16" (ou null se inválida) */
export function parseDateBr(br: string): string | null {
  const m = br.trim().match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  const [, d, mo, y] = m;
  const iso = `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  const dt = new Date(`${iso}T12:00:00`);
  return isNaN(dt.getTime()) || dt.getMonth() + 1 !== Number(mo) ? null : iso;
}
