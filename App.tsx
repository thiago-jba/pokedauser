import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import { BackHandler, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from './src/components/ErrorBoundary';
import { UpdateBanner } from './src/components/UpdateBanner';
import { HomeScreen } from './src/screens/HomeScreen';
import { SetScreen } from './src/screens/SetScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { PokedexScreen } from './src/screens/PokedexScreen';
import { PokemonScreen } from './src/screens/PokemonScreen';
import { TabBar } from './src/components/TabBar';
import type { PokemonCardBrief } from './src/pokedex';
import { StoreProvider } from './src/store';
import { colors } from './src/theme';

type Route =
  | { name: 'home' }
  | { name: 'set'; setId: string }
  | { name: 'settings' }
  | { name: 'pokedex' }
  | { name: 'pokemon'; dexId: number; prefill?: PokemonCardBrief };

export default function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });

  // botão "voltar" do Android
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (route.name === 'pokemon') {
        setRoute({ name: 'pokedex' });
        return true;
      }
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
          {/* papel de parede fixo: o "vidro" dos painéis deixa ele aparecer */}
          <Image source={require('./assets/wallpaper.jpg')} style={StyleSheet.absoluteFill} contentFit="cover" />
          <StatusBar style="light" />
          <ErrorBoundary onReset={() => setRoute({ name: 'home' })}>
            {route.name === 'home' ? (
              <HomeScreen
                openSet={(setId) => setRoute({ name: 'set', setId })}
                openSettings={() => setRoute({ name: 'settings' })}
              />
            ) : route.name === 'settings' ? (
              <SettingsScreen onBack={() => setRoute({ name: 'home' })} />
            ) : route.name === 'pokedex' ? (
              <PokedexScreen openPokemon={(dexId, prefill) => setRoute({ name: 'pokemon', dexId, prefill })} />
            ) : route.name === 'pokemon' ? (
              <PokemonScreen
                key={`${route.dexId}-${route.prefill?.id ?? ''}`}
                dexId={route.dexId}
                prefill={route.prefill}
                onBack={() => setRoute({ name: 'pokedex' })}
              />
            ) : (
              <SetScreen key={route.setId} setId={route.setId} onBack={() => setRoute({ name: 'home' })} />
            )}
          </ErrorBoundary>
          {route.name === 'home' || route.name === 'pokedex' ? (
            <TabBar
              tab={route.name === 'home' ? 'colecao' : 'pokedex'}
              onChange={(t) => setRoute(t === 'colecao' ? { name: 'home' } : { name: 'pokedex' })}
            />
          ) : null}
          <UpdateBanner />
        </View>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
