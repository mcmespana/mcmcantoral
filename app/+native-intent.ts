/**
 * Reescritura de los deep links que entran en la app (expo-router).
 *
 * Se ejecuta FUERA del runtime de la app (no hay contexto ni navegación
 * todavía), así que aquí solo se traduce una URL en otra ruta.
 *
 * En MCM Cantoral solo hay un caso especial: los ficheros `.mcm` (repertorios)
 * que se abren con la app llegan como `file://` o `content://`. No son una
 * ruta: si se le pasan al router tal cual, aterrizan en «ruta no encontrada».
 * El repertorio lo importa `useIncomingPlaylist` (en el layout raíz); aquí
 * solo hay que dejar a la persona en el cantoral. Lo demás (`/playlist`,
 * `/coro`, `/cancion`) son rutas de verdad y pasan sin tocar.
 */

/** Destino de un fichero de repertorio abierto con la app. */
const CANTORAL_ROUTE = '/cancionero';

/** ¿Es la URL de un fichero (y no un enlace)? */
function isFileUrl(url: string): boolean {
  return /^(file|content):\/\//i.test(url);
}

export function redirectSystemPath({
  path,
}: {
  path: string;
  initial: boolean;
}): string {
  try {
    if (isFileUrl(path)) return CANTORAL_ROUTE;
    return path;
  } catch {
    // Nunca reventar por un enlace raro: mejor abrir la app por su inicio.
    return '/';
  }
}
