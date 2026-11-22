import React from 'react';
import { HeroUINativeProvider } from 'heroui-native';

import { AppSettingsProvider } from '@/contexts/AppSettingsContext';
import { AppToastProvider } from '@/contexts/AppToastContext';
import { ChoirSessionProvider } from '@/contexts/ChoirSessionContext';
import { LiveProvider } from '@/contexts/LiveContext';
import LocalLiveBridge from '@/components/live/LocalLiveBridge';
import { OTAProvider } from '@/contexts/OTAContext';
import { OverlayStackProvider } from '@/contexts/OverlayStackContext';
import { SelectedSongsProvider } from '@/contexts/SelectedSongsContext';
import { VersionGateProvider } from '@/contexts/VersionGateContext';
import UniwindThemeBridge from '@/components/UniwindThemeBridge';

/**
 * La torre de providers de la app, en su orden exacto.
 *
 * **Por qué está aquí y no en `app/_layout.tsx`.** El orden importa y hace
 * falta reconstruirlo igual en `__tests__/screenSmoke.test.tsx`, que monta las
 * pantallas DENTRO de los providers de verdad (es la única forma de que un
 * test se entere de una pantalla que peta al montar). Teniéndolo en un solo
 * componente, añadir un provider lo mete en la app Y en el test a la vez.
 *
 * MCM Cantoral no tiene perfiles, login, notificaciones ni eventos: solo lo
 * que usa el cantoral (`docs/planes/fork-cantoral/01-arranque-y-poda.md`
 * §2.3).
 *
 * Fuera de aquí se quedan, a propósito, `ErrorBoundary`,
 * `GestureHandlerRootView` y `SafeAreaProvider`: son la cáscara de la app y
 * en un test se quieren controlar a mano.
 */
export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <HeroUINativeProvider config={{ devInfo: { stylingPrinciples: false } }}>
      <AppToastProvider>
        <OverlayStackProvider>
          <AppSettingsProvider>
            <UniwindThemeBridge />
            <SelectedSongsProvider>
              <ChoirSessionProvider>
                <LiveProvider>
                  <LocalLiveBridge />
                  <OTAProvider>
                    <VersionGateProvider>{children}</VersionGateProvider>
                  </OTAProvider>
                </LiveProvider>
              </ChoirSessionProvider>
            </SelectedSongsProvider>
          </AppSettingsProvider>
        </OverlayStackProvider>
      </AppToastProvider>
    </HeroUINativeProvider>
  );
}
