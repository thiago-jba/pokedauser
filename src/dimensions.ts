// Tamanho útil da tela. No computador o app fica centralizado com largura máxima,
// então as colunas são calculadas sobre essa largura, não sobre a janela inteira.
import { Platform, useWindowDimensions } from 'react-native';

export const MAX_APP_WIDTH = 1100;

export function useAppDimensions() {
  const d = useWindowDimensions();
  return Platform.OS === 'web' ? { ...d, width: Math.min(d.width, MAX_APP_WIDTH) } : d;
}
