// Leitura de texto da foto (Google ML Kit), só no celular. No navegador: ocr.web.ts.
import TextRecognition from '@react-native-ml-kit/text-recognition';

export const ocrAvailable = true;

export async function readTextFromImage(uri: string): Promise<string> {
  const r = await TextRecognition.recognize(uri);
  return r.text ?? '';
}
