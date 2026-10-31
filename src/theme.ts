import type { CardVariant } from './variants';

export const colors = {
  bg: '#11121C',
  surface: '#1B1D2C',
  surface2: '#25283B',
  border: '#33374F',
  text: '#F2F3F8',
  textDim: '#9DA2BB',
  textFaint: '#666B86',
  accent: '#E84545',
  accentDim: '#5A2230',
  gold: '#F5C84A',
  success: '#3CC48A',
};

export const finishColors: Record<CardVariant['finish'], { bg: string; fg: string }> = {
  normal: { bg: '#3A3F57', fg: '#E6E8F2' },
  holo: { bg: '#2D5BD2', fg: '#FFFFFF' },
  reverse: { bg: '#18A39A', fg: '#FFFFFF' },
  special: { bg: '#8B4FE0', fg: '#FFFFFF' },
};

export const CARD_RATIO = 88 / 63; // altura / largura de uma carta
