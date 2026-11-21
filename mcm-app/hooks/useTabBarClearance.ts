// Espacio que hay que dejar libre al final de una pantalla.
//
// MCM Cantoral no tiene barra de pestañas (T-05): lo único que hay abajo es el
// área segura del sistema (la barra de inicio del iPhone, la de gestos de
// Android). El nombre se conserva para no reescribir a la vez los ~10 sitios
// que lo usan (reproductor flotante, metrónomo, controles de canción…).

import { useSafeAreaInsets } from 'react-native-safe-area-context';
import spacing from '@/constants/spacing';

/**
 * @param extra Espacio adicional por encima del área segura (por ejemplo si
 *   la pantalla tiene además una barra de acciones flotante).
 */
export function useTabBarClearance(extra = 0): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + extra;
}

/**
 * `paddingBottom` del final de una lista o scroll: el área segura más el
 * respiro normal de la pantalla. Igual en todas las plataformas.
 */
export function tabBarPaddingBottom(
  _os: string,
  insetBottom: number,
  padding: number,
): number {
  return insetBottom + padding;
}

/** Hook de `tabBarPaddingBottom` con el área segura actual. */
export function useTabBarPaddingBottom(padding: number = spacing.lg): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + padding;
}

export default useTabBarClearance;
