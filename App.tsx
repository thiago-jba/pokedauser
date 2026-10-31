import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { BackHandler, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { UpdateBanner } from './src/components/UpdateBanner';
import { HomeScreen } from './src/screens/HomeScreen';
import { SetScreen } from './src/screens/SetScreen';
import { StoreProvider } from './src/store';
import { colors } from './src/theme';

type Route = { name: 'home' } | { name: 'set'; setId: string };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });

  // botão "voltar" do Android
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route.name !== 'home') {
        setRoute({ name: 'home' });
        return true;
      }
      return false;
    });
    return () => sub.remove();
  }, [route]);

  return (
    <SafeAreaProvider>
      <StoreProvider>
        <View style={{ flex: 1, backgroundColor: colors.bg }}>
          <StatusBar style="light" />
          <ErrorBoundary onReset={() => setRoute({ name: 'home' })}>
            {route.name === 'home' ? (
              <HomeScreen openSet={(setId) => setRoute({ name: 'set', setId })} />
            ) : (
              <SetScreen key={route.setId} setId={route.setId} onBack={() => setRoute({ name: 'home' })} />
            )}
          </ErrorBoundary>
          <UpdateBanner />
        </View>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
