import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { colors } from '../theme';

interface State {
  error: Error | null;
}

/** Em vez de fechar o app quando algo dá errado, mostra o erro na tela. */
export class ErrorBoundary extends React.Component<{ children: React.ReactNode; onReset?: () => void }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, padding: 24, paddingTop: 64 }}>
        <Text style={{ color: colors.text, fontSize: 20, fontWeight: '800', marginBottom: 8 }}>Ops, algo deu errado</Text>
        <Text style={{ color: colors.textDim, marginBottom: 16 }}>
          Sua coleção continua salva. Tire um print desta tela e mande para quem está desenvolvendo o app.
        </Text>
        <ScrollView style={{ maxHeight: 260, backgroundColor: colors.surface, borderRadius: 10, padding: 12 }}>
          <Text selectable style={{ color: colors.textDim, fontSize: 12 }}>
            {`${error.name}: ${error.message}\n\n${(error.stack ?? '').slice(0, 1500)}`}
          </Text>
        </ScrollView>
        <Pressable
          onPress={() => {
            this.setState({ error: null });
            this.props.onReset?.();
          }}
          style={{ marginTop: 20, backgroundColor: colors.accent, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}
        >
          <Text style={{ color: '#fff', fontWeight: '700' }}>Voltar ao início</Text>
        </Pressable>
      </View>
    );
  }
}
