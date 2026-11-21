/**
 * Subcategorías, «también en» (`alsoIn`), orden de categorías y duración: la
 * Fase 1 de Navidad (`docs/planes/fork-cantoral/02-datos-offline.md` §4).
 * El generador del cantoral ya publica estos campos; aquí solo hay lógica
 * PURA para usarlos (zona espejo: vale igual para MCM App).
 *
 * Formato que se acepta (tolerante, por si el generador cambia de idea):
 *  - Categoría: `subcategories: { <slug>: { title, order?, short?, emoji?,
 *    description? } }` y `order?: number`.
 *  - Canción: `subcategory?: <slug>`, `duration?: "m:ss"` y `alsoIn?` como
 *    lista de `"<categoría>"`, `"<categoría>/<subcategoría>"` o
 *    `{ category, subcategory? }`.
 *
 * La canción se ve en las categorías de `alsoIn` **sin duplicarse**: su casa
 * (favoritos, búsqueda, ediciones, repertorios) es siempre su categoría de
 * origen + `filename`.
 */

export interface Subcategory {
  slug: string;
  title: string;
  order: number;
  short?: string;
  emoji?: string;
  description?: string;
}

export type AlsoInEntry = string | { category?: string; subcategory?: string };

interface CategoryLike {
  categoryTitle?: string;
  order?: unknown;
  subcategories?: unknown;
  songs?: SongLike[];
}

interface SongLike {
  title?: string;
  filename?: string;
  subcategory?: unknown;
  alsoIn?: unknown;
  duration?: unknown;
}

/** Una canción vista desde una categoría (la suya o una prestada). */
export type CategorySong<S> = S & {
  /** Categoría de casa: la que manda para todo lo que se guarda. */
  homeCategory: string;
  /** Subcategoría EN ESTA categoría (la propia o la del préstamo). */
  subcategorySlug: string | null;
  /** Viene de otra categoría por `alsoIn`. */
  borrowed: boolean;
};

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/** Subcategorías de una categoría, ordenadas por `order` y luego por título. */
export function readSubcategories(category: unknown): Subcategory[] {
  const raw = (category as CategoryLike | null)?.subcategories;
  if (!raw || typeof raw !== 'object') return [];
  const out: Subcategory[] = [];
  for (const [slug, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const title = str(v.title) ?? slug;
    out.push({
      slug,
      title,
      order: typeof v.order === 'number' ? v.order : Number.MAX_SAFE_INTEGER,
      ...(str(v.short) ? { short: str(v.short) } : {}),
      ...(str(v.emoji) ? { emoji: str(v.emoji) } : {}),
      ...(str(v.description) ? { description: str(v.description) } : {}),
    });
  }
  return out.sort(
    (a, b) => a.order - b.order || a.title.localeCompare(b.title, 'es'),
  );
}

/** `alsoIn` de una canción, normalizado a `{ category, subcategory }`. */
export function readAlsoIn(
  song: unknown,
): { category: string; subcategory: string | null }[] {
  const raw = (song as SongLike | null)?.alsoIn;
  const list: unknown[] = Array.isArray(raw)
    ? raw
    : typeof raw === 'string'
      ? [raw]
      : [];
  const out: { category: string; subcategory: string | null }[] = [];
  for (const entry of list) {
    if (typeof entry === 'string') {
      const [category, subcategory] = entry.split('/').map((s) => s.trim());
      if (category) out.push({ category, subcategory: subcategory || null });
    } else if (entry && typeof entry === 'object') {
      const e = entry as { category?: unknown; subcategory?: unknown };
      const category = str(e.category);
      if (category)
        out.push({ category, subcategory: str(e.subcategory) ?? null });
    }
  }
  return out;
}

const sameKey = (a: string, b: string) =>
  a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * Canciones que se ven en `categoryKey`: las suyas y las que otras
 * categorías le prestan con `alsoIn`. Cada una dice cuál es su casa.
 */
export function songsForCategory<S extends SongLike>(
  data: Record<string, CategoryLike | undefined> | null | undefined,
  categoryKey: string,
): CategorySong<S>[] {
  if (!data) return [];
  const home = Object.keys(data).find((k) => sameKey(k, categoryKey));
  const out: CategorySong<S>[] = [];
  const seen = new Set<string>();
  if (home) {
    for (const song of (data[home]?.songs ?? []) as S[]) {
      if (!song) continue;
      if (song.filename) seen.add(`${home}/${song.filename}`);
      out.push({
        ...song,
        homeCategory: home,
        subcategorySlug: str(song.subcategory) ?? null,
        borrowed: false,
      });
    }
  }
  for (const [key, cat] of Object.entries(data)) {
    if (home && key === home) continue;
    for (const song of (cat?.songs ?? []) as S[]) {
      if (!song) continue;
      const hit = readAlsoIn(song).find((a) =>
        sameKey(a.category, categoryKey),
      );
      if (!hit) continue;
      const id = `${key}/${song.filename}`;
      if (seen.has(id)) continue;
      seen.add(id);
      out.push({
        ...song,
        homeCategory: key,
        subcategorySlug: hit.subcategory,
        borrowed: true,
      });
    }
  }
  return out;
}

export interface SubcategoryGroup<T> {
  /** `null` = canciones sin subcategoría («Otras»). */
  subcategory: Subcategory | null;
  songs: T[];
}

/**
 * Agrupa por subcategoría, en el orden de la categoría. Las que no tienen (o
 * apuntan a una que no existe) van al final, en «Otras». Dentro de cada grupo
 * se respeta el orden que traen. Sin subcategorías: un solo grupo.
 */
export function groupBySubcategory<
  T extends { subcategorySlug: string | null },
>(songs: T[], subcategories: Subcategory[]): SubcategoryGroup<T>[] {
  if (subcategories.length === 0) return [{ subcategory: null, songs }];
  const bySlug = new Map(subcategories.map((s) => [s.slug, [] as T[]]));
  const rest: T[] = [];
  for (const song of songs) {
    const bucket = song.subcategorySlug
      ? bySlug.get(song.subcategorySlug)
      : undefined;
    if (bucket) bucket.push(song);
    else rest.push(song);
  }
  const groups: SubcategoryGroup<T>[] = subcategories
    .map((sub) => ({ subcategory: sub, songs: bySlug.get(sub.slug)! }))
    .filter((g) => g.songs.length > 0);
  if (rest.length) groups.push({ subcategory: null, songs: rest });
  return groups;
}

/**
 * Orden de las categorías: `order` si lo traen (lo emite el generador desde
 * `indice.json`) y si no, el título («A. …», «B. …»).
 */
export function sortCategoryKeys(
  data: Record<string, CategoryLike | undefined> | null | undefined,
): string[] {
  if (!data) return [];
  return Object.keys(data).sort((a, b) => {
    const oa = data[a]?.order;
    const ob = data[b]?.order;
    const na = typeof oa === 'number' ? oa : null;
    const nb = typeof ob === 'number' ? ob : null;
    if (na !== null && nb !== null && na !== nb) return na - nb;
    if (na !== null && nb === null) return -1;
    if (na === null && nb !== null) return 1;
    const ta = data[a]?.categoryTitle ?? a;
    const tb = data[b]?.categoryTitle ?? b;
    return ta.localeCompare(tb, 'es');
  });
}

/** `"3:20"` → 200 s; lo que no se entienda, `null`. */
export function parseDuration(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return Math.round(value);
  }
  if (typeof value !== 'string') return null;
  const m = value.trim().match(/^(?:(\d+):)?(\d{1,3}):(\d{2})$/);
  if (!m) return null;
  const h = m[1] ? Number(m[1]) : 0;
  const min = Number(m[2]);
  const s = Number(m[3]);
  if (s >= 60) return null;
  return h * 3600 + min * 60 + s;
}

/** 200 → `"3:20"`; 3725 → `"1:02:05"`. */
export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
}

/** «~38 min» para un repertorio: suma lo que se sepa y dice cuánto falta. */
export function sumDurations(values: unknown[]): {
  seconds: number;
  known: number;
  unknown: number;
} {
  let seconds = 0;
  let known = 0;
  for (const v of values) {
    const d = parseDuration(v);
    if (d === null) continue;
    seconds += d;
    known += 1;
  }
  return { seconds, known, unknown: values.length - known };
}
