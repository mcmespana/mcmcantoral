// utils/cantoralRoutes.ts
// Traduce los NOMBRES de pantalla del cantoral (`'SongDetail'`…) a rutas de
// expo-router. Con expo-router 58 cada pantalla es un fichero de ruta
// (`app/cancionero/`); los nombres se conservan como API y aquí, y solo aquí,
// se sabe a qué ruta corresponde cada uno. Los params de una canción y su
// lista se arman en `utils/songNavList.ts`.
//
// Los parámetros de ruta viajan por URL: son TEXTO. Nada de objetos.

/** Params de ruta: solo texto. Se descartan `undefined`/`null`. */
export type RouteParams = Record<string, string | number | boolean | undefined>;

export function toRouteParams(
  params?: Record<string, unknown>,
): Record<string, string> | undefined {
  if (!params) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'object') continue; // los objetos no viajan por URL
    out[key] = String(value);
  }
  return Object.keys(out).length ? out : undefined;
}

export interface ScreenHref {
  pathname: string;
  params?: Record<string, string>;
}

const join = (base: string, slug: string) => (slug ? `${base}/${slug}` : base);

/** Último trozo de una ruta (`/mas/horario?x=1` → `horario`). */
export function lastSegment(pathname: string): string {
  const clean = pathname.split(/[?#]/)[0].replace(/\/+$/, '');
  return clean.slice(clean.lastIndexOf('/') + 1);
}

export const CANTORAL_BASE = '/cancionero';

export const CANTORAL_SLUGS = {
  Categories: '',
  SongsList: 'categoria',
  SongDetail: 'cancion',
  SongFullscreen: 'pantalla-completa',
  SelectedSongs: 'seleccion',
  Tuner: 'afinador',
  SongEditor: 'editar',
  SongReorder: 'ordenar',
  SundaySongs: 'domingo',
  Repertorios: 'repertorios',
  Repertorio: 'repertorio',
} as const;

export type CantoralScreenName = keyof typeof CANTORAL_SLUGS;

/** Ruta de una pantalla del cantoral. */
export function cantoralHref(
  screen: CantoralScreenName,
  params?: Record<string, unknown>,
): ScreenHref {
  const query = toRouteParams(params);
  return {
    pathname: join(CANTORAL_BASE, CANTORAL_SLUGS[screen]),
    ...(query && { params: query }),
  };
}
