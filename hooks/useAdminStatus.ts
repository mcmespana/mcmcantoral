/**
 * ¿Este dispositivo es administrador del cantoral?
 *
 * MCM Cantoral no tiene inicio de sesión. El admin llega con el «código de
 * administrador» (D-09, `docs/planes/fork-cantoral/06-administracion.md`);
 * mientras no esté, nadie es admin y el editor y «Ordenar» se esconden.
 */
export function useAdminStatus(): { isAdmin: boolean; loading: boolean } {
  // Solo en desarrollo con datos de ejemplo (`EXPO_PUBLIC_FIREBASE_FIXTURES=1`,
  // que no llevan ni las builds de tienda ni la web publicada): hay que poder
  // ver las pantallas de administración.
  if (process.env.EXPO_PUBLIC_FIREBASE_FIXTURES === '1') {
    return { isAdmin: true, loading: false };
  }
  return { isAdmin: false, loading: false };
}
