import 'react-native-get-random-values';
import { useFonts } from 'expo-font';
import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import 'react-native-reanimated';
import '../global.css';

import { useColorScheme } from '@/components/useColorScheme';
import { useAuthStore } from '@/src/store';

export {
  // Catch any errors thrown by the Layout component.
  ErrorBoundary,
} from 'expo-router';

export const unstable_settings = {
  // Ensure that reloading on `/modal` keeps a back button present.
  initialRouteName: '(tabs)',
};

import { initializeDb } from '@/src/database';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function useHydration() {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const unsub = useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    setHydrated(useAuthStore.persist.hasHydrated());

    return unsub;
  }, []);

  return hydrated;
}

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  const hydrated = useHydration();

  // Expo Router uses Error Boundaries to catch errors in the navigation tree.
  useEffect(() => {
    if (error) throw error;
  }, [error]);

  useEffect(() => {
    if (loaded && hydrated) {
      try {
        initializeDb();
      } catch (dbError) {
        console.error('Failed to initialize SQLite database on boot:', dbError);
      }
      SplashScreen.hideAsync();
    }
  }, [loaded, hydrated]);

  if (!loaded || !hydrated) {
    return null;
  }

  return <RootLayoutNav />;
}


import { useRouter, useSegments } from 'expo-router';

function RootLayoutNav() {
  const colorScheme = useColorScheme();
  const { isLoggedIn } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();
  const segmentsJoined = segments.join('/');

  useEffect(() => {
    // Só prossegue se o router já terminou a montagem inicial dos segmentos
    if ((segments.length as number) === 0) return;

    const inAuthGroup = segments[0] === 'login' || segments[0] === 'register';
    
    // Executa de forma assíncrona para não competir com ciclos de render/mount do Navigator
    const timer = setTimeout(() => {
      if (!isLoggedIn && !inAuthGroup) {
        router.replace('/login');
      } else if (isLoggedIn && inAuthGroup) {
        router.replace('/(tabs)');
      }
    }, 0);

    return () => clearTimeout(timer);
  }, [isLoggedIn, segmentsJoined]);

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="modal" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}
