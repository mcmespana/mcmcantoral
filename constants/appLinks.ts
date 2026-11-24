/**
 * Enlaces e identificadores públicos de MCM Cantoral (D-03, D-13).
 *
 * Son los que se GENERAN (compartir un repertorio, el QR de un directo…). Para
 * LEER no hace falta nada de aquí: `utils/qrScan.ts` y las rutas reconocen
 * por el path, así que los enlaces y QR de MCM App (`mcm.expo.app`,
 * `mcmapp://`) siguen valiendo, y los de aquí valen en MCM App.
 */

/** Web de la app (EAS Hosting). Los universal links cuelgan de aquí. */
export const WEB_BASE_URL = 'https://mcmcantoral.expo.app';

/** Esquema propio (`app.json` → `scheme`). */
export const APP_SCHEME = 'mcmcantoral://';

/** UTI del fichero `.mcm` del que esta app es dueña (`app.json`). */
export const PLAYLIST_UTI = 'com.mcmespana.mcmcantoral.playlist';

export const APP_NAME = 'MCM Cantoral';
