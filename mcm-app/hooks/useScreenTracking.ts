// Seguimiento automático de pantallas.
//
// Se engancha una sola vez, en el layout raíz, y cubre TODA la app —incluidas
// las pantallas que aún no existen— porque escucha la ruta de expo-router.
// También es el sitio donde se arranca Aptabase (apagada sin clave, D-15).

import { usePathname } from 'expo-router';
import { useEffect, useRef } from 'react';

import { normalizeRoute } from '@/constants/analyticsEvents';
import { initAnalytics, trackEvent } from '@/utils/analytics';

export function useScreenTracking(): void {
  const pathname = usePathname();

  // Última ruta registrada. Evita duplicar el evento cuando `usePathname`
  // vuelve a emitir el mismo valor (pasa al cambiar params o al remontar).
  const lastRoute = useRef<string | null>(null);
  const bootstrapped = useRef(false);

  useEffect(() => {
    if (bootstrapped.current) return;
    bootstrapped.current = true;
    initAnalytics();
    trackEvent('app_abierta');
  }, []);

  useEffect(() => {
    const route = normalizeRoute(pathname);
    if (route === lastRoute.current) return;
    lastRoute.current = route;
    trackEvent('pantalla_vista', { ruta: route });
  }, [pathname]);
}
