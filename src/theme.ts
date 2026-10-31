import type { CardVariant } from './variants';

// Identidade visual "vidro líquido": fundo colorido desfocado fixo e painéis translúcidos por cima.
export const colors = {
  /** cor sólida de reserva (o fundo real é o papel de parede em assets/wallpaper.jpg) */
  bg: '#0B0C18',
  /** painel de vidro (translúcido) */
  surface: 'rgba(255,255,255,0.075)',
  /** vidro mais claro: botões, itens selecionados */
  surface2: 'rgba(255,255,255,0.13)',
  /** folhas e janelas sobre o conteúdo: vidro escuro quase opaco, para leitura */
  sheet: 'rgba(22,24,42,0.94)',
  /** borda fina clara do vidro */
  border: 'rgba(255,255,255,0.16)',
  /** reflexo no topo dos painéis */
  highlight: 'rgba(255,255,255,0.10)',
  text: '#F7F8FC',
  textDim: 'rgba(235,238,250,0.72)',
  textFaint: 'rgba(225,230,250,0.45)',
  accent: '#FF5A6E',
  accentDim: 'rgba(255,90,110,0.22)',
  gold: '#FFD66B',
  success: '#45E0A0',
};

export const radius = { sm: 10, md: 16, lg: 22, pill: 999 };

export const finishColors: Record<CardVariant['finish'], { bg: string; fg: string }> = {
  normal: { bg: 'rgba(255,255,255,0.22)', fg: '#FFFFFF' },
  holo: { bg: 'rgba(70,130,255,0.85)', fg: '#FFFFFF' },
  reverse: { bg: 'rgba(20,200,185,0.85)', fg: '#FFFFFF' },
  special: { bg: 'rgba(160,90,255,0.88)', fg: '#FFFFFF' },
};

export const CARD_RATIO = 88 / 63; // altura / largura de uma carta
