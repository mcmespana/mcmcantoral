// app/_layout.tsx

// Sentry el PRIMERO de todos los imports: se arranca como efecto de cargar el
// módulo, así que cuanto antes se importe, más crashes de arranque captura.
// Sin `EXPO_PUBLIC_SENTRY_DSN` no hace absolutamente nada (D-15: apagado).
import { wrapRoot } from '@/utils/sentry';

import React, { useCallback, useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  ThemeProvider as NavThemeProvider,
  DarkTheme,
  DefaultTheme,
} from 'expo-router/react-navigation';
import { usePathname, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useStatusBarTheme } from '@/hooks/useStatusBarTheme';
import { fromShared, newId, repertoriosStore } from '@/services/repertorios';
import { useIncomingPlaylist } from '@/hooks/useIncomingPlaylist';
import { useRegisterServiceWorker } from '@/hooks/useRegisterServiceWorker';
import { useScreenTracking } from '@/hooks/useScreenTracking';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';
import { useCantoralConfig } from '@/hooks/useCantoralConfig';
import { trackEvent } from '@/utils/analytics';
import { tramoTamano } from '@/constants/analyticsEvents';
import AddToHomeBanner from '@/components/AddToHomeBanner';
import CatalogUpdater from '@/components/CatalogUpdater';
import CommandPalette from '@/components/CommandPalette';
import LiveSummarySheet from '@/components/live/LiveSummarySheet';
import { importApuntesFrom } from '@/services/apuntes';
import ErrorBoundary from '@/components/ErrorBoundary';
import MaintenanceScreen from '@/components/MaintenanceScreen';
import UpdateRequiredScreen from '@/components/UpdateRequiredScreen';
import FirebaseConfigErrorScreen from '@/components/FirebaseConfigErrorScreen';
import { useToast } from '@/contexts/AppToastContext';
import { useVersionGate } from '@/contexts/VersionGateContext';
import { getFirebaseApp } from '@/utils/firebaseApp';
// Importar iconos para asegurar que se incluyan en el build
import '@/constants/iconAssets';
import AppProviders from '@/components/AppProviders';
import { holdSplash, releaseSplash } from '@/utils/splashGate';

// El splash nativo se queda hasta que el layout sabe qué pintar (ver
// `utils/splashGate.ts`, que además lo suelta solo si algo se cuelga).
holdSplash();

/**
 * Firebase mal configurado en el build (faltan las `EXPO_PUBLIC_FIREBASE_*`).
 * Se resuelve una vez: es un fallo del build, no algo que cambie en marcha.
 */
function readFirebaseConfigError(): string | null {
  try {
    getFirebaseApp();
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function RootLayout() {
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          {/* La torre de providers vive en `components/AppProviders.tsx`:
              el orden importa y hace falta montarla igual en los tests de
              humo de pantallas. */}
          <AppProviders>
            <InnerLayout />
          </AppProviders>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}

/**
 * Una sola pila, sin pestañas ni FAB (T-05, DIV-001): `/` entra directo en el
 * cantoral (`app/index.tsx`) y las rutas `/cancionero/*` se conservan para que
 * los enlaces de MCM App sigan valiendo.
 */
function InnerLayout() {
  const scheme = useColorScheme();
  const pathname = usePathname();
  const [firebaseConfigError] = useState(readFirebaseConfigError);
  const config = useCantoralConfig();
  const {
    updateRequired,
    updateSkipped,
    canSkip,
    skipsLeft,
    skipUpdate,
    currentVersion: appVersion,
    minAppVersion,
  } = useVersionGate();
  const { toast } = useToast();

  // Ficheros .mcm que llegan de fuera (WhatsApp, Archivos…): entran como
  // repertorio NUEVO y activo (con pausas y notas si vienen de MCM Cantoral).
  const handleIncomingPlaylist = useCallback(
    (songs: string[], raw?: unknown) => {
      const now = Date.now();
      const rep = fromShared(
        raw ?? {
          songs: songs.map((filename, order) => ({
            filename,
            order,
            transpose: 0,
          })),
        },
        {
          id: newId(now),
          now,
          source: { kind: 'file', ref: 'mcm' },
          name: 'Repertorio recibido',
        },
      );
      if (rep) repertoriosStore.create(rep);
      if (raw) importApuntesFrom(raw);
      trackEvent('playlist_usada', {
        accion: 'importada',
        tamano: tramoTamano(songs.length),
      });
      toast.show({
        label: `«${rep?.name ?? 'Repertorio'}» importado (${songs.length} ${songs.length === 1 ? 'canción' : 'canciones'})`,
        actionLabel: 'OK',
        onActionPress: ({ hide }) => hide(),
      });
    },
    [toast],
  );
  useIncomingPlaylist(handleIncomingPlaylist);

  useStatusBarTheme(pathname);
  // Analítica: sin EXPO_PUBLIC_APTABASE_KEY no hace nada (D-15).
  useScreenTracking();
  // Web: título de la pestaña del navegador según la pantalla.
  useDocumentTitle();
  // Registra el service worker en web (PWA).
  useRegisterServiceWorker();

  // Sin bienvenida ni onboarding: en cuanto hay layout, fuera el splash.
  useEffect(() => {
    releaseSplash();
  }, []);

  const navigationTheme = scheme === 'dark' ? DarkTheme : DefaultTheme;

  if (firebaseConfigError) {
    return <FirebaseConfigErrorScreen error={firebaseConfigError} />;
  }

  // Interruptores remotos propios del cantoral (`songs/cantoralConfig`).
  if (config.maintenance) {
    return <MaintenanceScreen message={config.maintenanceMessage} />;
  }
  if (updateRequired && !updateSkipped) {
    return (
      <UpdateRequiredScreen
        minVersion={minAppVersion}
        currentVersion={appVersion}
        skipsLeft={skipsLeft}
        onSkip={canSkip ? skipUpdate : undefined}
      />
    );
  }

  return (
    <NavThemeProvider value={navigationTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="cancionero" />
        <Stack.Screen name="playlist" />
        <Stack.Screen name="coro" />
        {/* Enlace a una canción (`/cancion?f=…`): puente al cantoral. */}
        <Stack.Screen name="cancion" />
      </Stack>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <CatalogUpdater />
      <AddToHomeBanner />
      <CommandPalette />
      <LiveSummarySheet />
    </NavThemeProvider>
  );
}

// `wrapRoot` es la identidad cuando Sentry está apagado (sin DSN).
export default wrapRoot(RootLayout);
