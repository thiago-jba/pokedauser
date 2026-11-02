// No navegador não há leitura pela câmera: adicione as cartas digitando.
export const ocrAvailable = false;

export async function readTextFromImage(_uri: string): Promise<string> {
  throw new Error('Leitura pela câmera disponível só no celular.');
}
