/**
 * ¿Este dispositivo es administrador del cantoral?
 *
 * MCM Cantoral no tiene inicio de sesión: el admin llega con el «código de
 * administrador» (D-09, `docs/planes/fork-cantoral/06-administracion.md`),
 * que comprueba una función en el servidor y deja la marca
 * `users/<uid>/isAdmin` del `uid` anónimo de esta instalación. Aquí solo se
 * lee esa marca (`services/adminService.ts`).
 */
import { useSyncExternalStore } from 'react';
import { adminStore } from '@/services/adminService';

const noopSubscribe = () => () => {};

export function useAdminStatus(): { isAdmin: boolean; loading: boolean } {
  // Solo en desarrollo con datos de ejemplo (`EXPO_PUBLIC_FIREBASE_FIXTURES=1`,
  // que no llevan ni las builds de tienda ni la web publicada): hay que poder
  // ver las pantallas de administración sin Firebase de verdad.
  const fixtures = process.env.EXPO_PUBLIC_FIREBASE_FIXTURES === '1';
  const state = useSyncExternalStore(
    fixtures ? noopSubscribe : adminStore.subscribe,
    adminStore.getState,
    adminStore.getState,
  );
  if (fixtures) return { isAdmin: true, loading: false };
  return { isAdmin: state.isAdmin, loading: state.loading };
}
