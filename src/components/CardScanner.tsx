import { CameraView, useCameraPermissions } from 'expo-camera';
import { deleteTempFile } from '../kv';
import { readTextFromImage } from '../ocr';
import React, { useRef, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '../theme';

/**
 * Câmera para ler o rodapé da carta (número/total e código da coleção).
 * O reconhecimento de texto roda no próprio celular (Google ML Kit), sem internet.
 * A foto é apagada logo depois da leitura: ela não é usada como imagem da carta.
 */
export function CardScanner({ visible, onClose, onRead }: { visible: boolean; onClose: () => void; onRead: (text: string) => void }) {
  const insets = useSafeAreaInsets();
  const [permission, requestPermission] = useCameraPermissions();
  const cam = useRef<CameraView>(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const capture = async () => {
    if (!cam.current || busy) return;
    setBusy(true);
    setMsg(null);
    try {
      const photo = await cam.current.takePictureAsync({ quality: 0.8 });
      if (!photo?.uri) throw new Error('sem foto');
      const text = await readTextFromImage(photo.uri);
      deleteTempFile(photo.uri);
      if (!text.trim()) {
        setMsg('Não consegui ler nada. Aproxime o rodapé da carta e evite reflexo.');
        return;
      }
      onRead(text);
    } catch {
      setMsg('Não foi possível ler a carta. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {!permission ? null : !permission.granted ? (
          <View style={styles.center}>
            <Text style={styles.title}>Permitir a câmera</Text>
            <Text style={styles.text}>O app usa a câmera só para ler o número e o código impressos no rodapé da carta.</Text>
            <Pressable style={styles.primary} onPress={requestPermission}>
              <Text style={styles.primaryText}>Permitir</Text>
            </Pressable>
            <Pressable onPress={onClose} style={{ marginTop: 16 }}>
              <Text style={styles.text}>Cancelar</Text>
            </Pressable>
          </View>
        ) : (
          <>
            <CameraView ref={cam} style={StyleSheet.absoluteFill} facing="back" autofocus="on" />
            {/* guia: o rodapé da carta deve ficar dentro da faixa */}
            <View pointerEvents="none" style={styles.overlay}>
              <View style={styles.guide} />
              <Text style={styles.guideText}>Enquadre o rodapé da carta (ex.: 30C · 116/128) dentro da faixa</Text>
            </View>
            <View style={[styles.top, { paddingTop: insets.top + 12 }]}>
              <Pressable onPress={onClose} style={styles.close} hitSlop={10}>
                <Text style={styles.closeText}>✕</Text>
              </Pressable>
            </View>
            <View style={[styles.bottom, { paddingBottom: insets.bottom + 24 }]}>
              {msg ? <Text style={styles.msg}>{msg}</Text> : null}
              <Pressable onPress={capture} style={[styles.shutter, busy && { opacity: 0.6 }]} disabled={busy}>
                {busy ? <ActivityIndicator color="#000" /> : <View style={styles.shutterInner} />}
              </Pressable>
              <Text style={styles.hint}>Incline um pouco a carta se o brilho atrapalhar</Text>
            </View>
          </>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32 },
  title: { color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 8 },
  text: { color: colors.textDim, textAlign: 'center' },
  primary: { marginTop: 20, backgroundColor: colors.accent, paddingHorizontal: 28, paddingVertical: 12, borderRadius: 999 },
  primaryText: { color: '#fff', fontWeight: '800' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  guide: { width: '86%', height: 90, borderRadius: 14, borderWidth: 3, borderColor: colors.gold, backgroundColor: 'rgba(255,214,107,0.06)' },
  guideText: { color: '#fff', marginTop: 12, textAlign: 'center', paddingHorizontal: 32, fontWeight: '600', textShadowColor: '#000', textShadowRadius: 6 },
  top: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: 16, flexDirection: 'row' },
  close: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(0,0,0,0.5)', alignItems: 'center', justifyContent: 'center' },
  closeText: { color: '#fff', fontSize: 18, fontWeight: '800' },
  bottom: { position: 'absolute', left: 0, right: 0, bottom: 0, alignItems: 'center', gap: 12 },
  msg: { color: '#fff', backgroundColor: 'rgba(255,90,110,0.85)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 12, marginHorizontal: 24, textAlign: 'center' },
  shutter: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: 'rgba(255,255,255,0.4)' },
  shutterInner: { width: 58, height: 58, borderRadius: 29, backgroundColor: '#fff', borderWidth: 2, borderColor: '#000' },
  hint: { color: 'rgba(255,255,255,0.8)', fontSize: 12 },
});
