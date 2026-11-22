import React, { useEffect, useRef } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Stack, router, useGlobalSearchParams, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColorScheme } from '@/hooks/useColorScheme';
import { SettingsProvider } from '@/contexts/SettingsContext';
import { MetronomeProvider } from '@/contexts/MetronomeContext';
import MetronomeFloating from '@/components/tuner/MetronomeFloating';
import KeepMetronomePrompt from '@/components/tuner/KeepMetronomePrompt';
import { themeColors } from '@/constants/colors';
import {
  cantoralHeaderBackground,
  cantoralHeaderTint,
} from '@/utils/cantoralHeader';
import { radii } from '@/constants/uiStyles';
import { useLive } from '@/contexts/LiveContext';
import { extractSongMedia } from '@/types/songMedia';
import {
  CANTORAL_BASE,
  CANTORAL_SLUGS,
  cantoralHref,
  lastSegment,
} from '@/utils/cantoralRoutes';
import { songRouteParams } from '@/utils/songNavList';

// expo-router 58: el arranque del stack se declara así, no con `initialRouteName`.
export const unstable_settings = { anchor: 'index' };

const isIOS = Platform.OS === 'ios';
const isWeb = Platform.OS === 'web';

/**
 * Stack del Cantoral: Categorías → lista (categoría, etiqueta o búsqueda) →
 * canción → pantalla completa, más «Tu selección». Cada pantalla es un fichero
 * de esta carpeta; los nombres de siempre (`'SongDetail'`…) se traducen a
 * rutas en `utils/eventRoutes.ts` y los params de una canción (texto) se arman
 * en `utils/songNavList.ts`.
 */
export default function CancioneroLayout() {
  const insets = useSafeAreaInsets();
  const webStatusBarHeight = isWeb ? insets.top : undefined;
  const scheme = useColorScheme();
  const isDark = scheme === 'dark';

  useChoirFollower();

  return (
    <SettingsProvider>
      {/* El metrónomo vive aquí y no en su hoja: puede seguir sonando al
          cerrarla, con su botón flotante encima de cualquier pantalla del
          cantoral (y la pregunta de si dejarlo sonando). */}
      <MetronomeProvider>
        <View style={layoutStyles.fill}>
          <Stack
            screenOptions={{
              // La cabecera es la del fondo de la pantalla: vidrio en iOS,
              // sólida del color del fondo en Android y web (sin barra de
              // color: aquí no hay territorios).
              headerStyle: isIOS
                ? { backgroundColor: 'transparent' }
                : isWeb
                  ? ({
                      backgroundColor: cantoralHeaderBackground(isDark),
                      borderBottomWidth: StyleSheet.hairlineWidth,
                      borderBottomColor: themeColors(isDark).separator,
                    } as never)
                  : { backgroundColor: cantoralHeaderBackground(isDark) },
              headerTintColor: cantoralHeaderTint(isDark),
              headerTitleStyle: {
                fontWeight: '700' as const,
                fontSize: 17,
                color: themeColors(isDark).text,
                letterSpacing: -0.3,
              } as never,
              ...(isWeb &&
                ({ headerStatusBarHeight: webStatusBarHeight } as object)),
              headerTransparent: isIOS,
              // iOS 26+ aplica su propio efecto glass via scrollEdgeEffects;
              // combinarlo con headerBlurEffect provoca solape (warning RNScreens).
              headerBlurEffect:
                isIOS && parseInt(String(Platform.Version), 10) < 26
                  ? 'systemChromeMaterial'
                  : undefined,
              headerShadowVisible: false,
              headerBackButtonDisplayMode: 'minimal' as const,
              // Prevents screens from appearing transparent during swipe-back
              // gestures. headerTransparent:true makes the card itself transparent
              // so we must set an explicit background on the content area.
              contentStyle: {
                backgroundColor: themeColors(isDark).background,
              },
            }}
          >
            <Stack.Screen name="index" options={{ title: 'Cantoral' }} />
            <Stack.Screen
              name={CANTORAL_SLUGS.SongsList}
              options={({ route }) => ({
                title:
                  (route.params as { categoryName?: string } | undefined)
                    ?.categoryName || 'Canciones',
              })}
            />
            <Stack.Screen
              name={CANTORAL_SLUGS.SongDetail}
              options={{ title: 'Letra y Acordes' }}
            />
            <Stack.Screen
              name={CANTORAL_SLUGS.SongFullscreen}
              options={{ headerShown: false, presentation: 'fullScreenModal' }}
            />
            <Stack.Screen
              name={CANTORAL_SLUGS.SelectedSongs}
              options={{ title: 'Editar repertorio' }}
            />
            <Stack.Screen
              name={CANTORAL_SLUGS.Repertorios}
              options={{ title: 'Repertorios' }}
            />
            <Stack.Screen
              name={CANTORAL_SLUGS.Repertorio}
              options={{ title: 'Repertorio' }}
            />
            <Stack.Screen
              name={CANTORAL_SLUGS.SundaySongs}
              options={{ title: 'Cantos del domingo' }}
            />
            {/* El afinador va en hoja: se abre encima de la canción y al
            cerrarla sigues donde estabas. */}
            <Stack.Screen
              name={CANTORAL_SLUGS.Tuner}
              options={{
                title: 'Afinador',
                presentation: 'formSheet',
                sheetAllowedDetents: [0.82, 1],
                sheetGrabberVisible: true,
                sheetCornerRadius: radii.xl,
                headerTransparent: false,
                contentStyle: {
                  backgroundColor: themeColors(isDark).background,
                },
              }}
            />
            {/* Editor de canciones (solo administradores): a pantalla completa,
            con su X y su «Guardar». */}
            <Stack.Screen
              name={CANTORAL_SLUGS.SongEditor}
              options={{
                title: 'Editar canción',
                presentation: 'fullScreenModal',
                headerTransparent: false,
                headerBackVisible: false,
                gestureEnabled: false,
                contentStyle: {
                  backgroundColor: themeColors(isDark).background,
                },
              }}
            />
            <Stack.Screen
              name={CANTORAL_SLUGS.SongReorder}
              options={{
                title: 'Ordenar canciones',
                presentation: 'fullScreenModal',
                headerTransparent: false,
                headerBackVisible: false,
                contentStyle: {
                  backgroundColor: themeColors(isDark).background,
                },
              }}
            />
          </Stack>
          <MetronomeFloating />
          <KeepMetronomePrompt />
        </View>
      </MetronomeProvider>
    </SettingsProvider>
  );
}

const layoutStyles = StyleSheet.create({ fill: { flex: 1 } });

/**
 * Modo coro - ESCLAVO: cuando el líder cambia la canción, se abre aquí con los
 * datos que ha publicado (puede no estar en el cantoral propio). Si ya se está
 * en el detalle se cambia la canción en el sitio; desde otra pantalla del
 * cantoral se apila. En pantalla completa la sigue la propia pantalla.
 *
 * Antes el stack era un navegador montado a mano y esto navegaba en él aunque
 * se estuviera en otra pestaña. Ahora navegar al cantoral cambia de pestaña,
 * así que fuera de él la canción del líder queda pendiente y se abre al volver.
 */
function useChoirFollower() {
  const live = useLive();
  const pathname = usePathname();
  const { filename: openFilename } = useGlobalSearchParams<{
    filename?: string;
  }>();
  const inCantoral =
    pathname === CANTORAL_BASE || pathname.startsWith(`${CANTORAL_BASE}/`);
  const handledRef = useRef<string | null>(null);

  // «Ir por libre»: no se le mueve. Al volver, se le lleva a la del maestro.
  const remote = live.free ? null : live.remote;
  const remoteKey = remote?.filename
    ? `${remote.filename}@${remote.updatedAt}`
    : null;

  useEffect(() => {
    if (!remote || !remoteKey || !inCantoral) {
      if (!remote) handledRef.current = null;
      return;
    }
    if (handledRef.current === remoteKey) return;
    handledRef.current = remoteKey;
    const slug = lastSegment(pathname);
    if (slug === CANTORAL_SLUGS.SongFullscreen) return;
    if (slug === CANTORAL_SLUGS.SongDetail && openFilename === remote.filename)
      return;
    const params = songRouteParams({
      filename: remote.filename,
      list: [
        {
          filename: remote.filename,
          title: remote.title ?? remote.filename,
          author: remote.author,
          key: remote.songKey,
          capo: remote.capo,
          content: remote.content ?? '',
          media: extractSongMedia(remote) ?? undefined,
        },
      ],
      currentIndex: 0,
      source: 'selection',
      firebaseCategory: remote.firebaseCategory,
    });
    if (slug === CANTORAL_SLUGS.SongDetail) {
      router.setParams({ firebaseCategory: undefined, ...params });
    } else {
      router.push(cantoralHref('SongDetail', params) as never);
    }
    // Solo cuando el líder cambia de canción o la re-publica (`remoteKey`), o
    // al volver al cantoral con una pendiente. Leer `remote` entero aquí
    // re-dispararía con cada latido de la sesión.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remoteKey, inCantoral]);
}
