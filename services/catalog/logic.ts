/**
 * Lógica PURA del catálogo offline: cuándo bajar, qué aceptar y qué ha
 * cambiado. Sin red, sin disco y sin reloj: todo entra por parámetro, para
 * poder probarlo entero (`__tests__/catalogLogic.test.ts`).
 *
 * Reglas (`02-datos-offline.md` §3.3):
 *  - Se baja un nodo SOLO si su `updatedAt` remoto es MAYOR que el local
 *    (comparación numérica: igual o menor → nada).
 *  - Antes de aceptar: JSON con categorías con canciones, no menos del 80 %
 *    de canciones que el anterior (salvo que `songs/meta.count` lo confirme) y
 *    el sha256 si `songs/meta` lo trae en formato canónico.
 */
import { sha256Hex } from '@/utils/sha256';
import { updatedAtToMs } from '@/utils/updatedAt';
import type { SongsData } from '@/utils/filterSongsData';
import {
  CATALOG_NODES,
  type Catalog,
  type CatalogDiff,
  type CatalogRemoteMeta,
} from './types';

/** Cada cuánto, como mucho, se mira si hay cantoral nuevo (al volver a primer plano). */
export const CHECK_INTERVAL_MS = 15 * 60 * 1000;
/** Tiempo máximo de una descarga antes de darla por perdida. */
export const DOWNLOAD_TIMEOUT_MS = 20_000;
/** Esperas entre reintentos: 1, 3 y 9 s. */
export const RETRY_DELAYS_MS = [1000, 3000, 9000];
/** Un catálogo nuevo con menos de esta fracción de canciones se rechaza. */
export const MIN_KEEP_RATIO = 0.8;

/** `updatedAt` remoto a milisegundos; lo que no se entienda cuenta como 0. */
export function toMs(value: unknown): number {
  return updatedAtToMs(value) ?? 0;
}

/** ¿Hay que bajar el nodo? Solo si el remoto es estrictamente más nuevo. */
export function shouldDownload(localMs: number, remote: unknown): boolean {
  const remoteMs = updatedAtToMs(remote);
  if (remoteMs === null) return false;
  return remoteMs > localMs;
}

/** ¿Toca mirar? Como mucho cada `CHECK_INTERVAL_MS`, salvo que se fuerce. */
export function shouldCheck(
  lastCheckAt: number | null,
  now: number,
  force = false,
): boolean {
  if (force || lastCheckAt === null) return true;
  return now - lastCheckAt >= CHECK_INTERVAL_MS;
}

/** Número de canciones de un `songs/data`. */
export function countSongs(data: unknown): number {
  if (!data || typeof data !== 'object') return 0;
  let n = 0;
  for (const cat of Object.values(data as Record<string, unknown>)) {
    const songs = (cat as { songs?: unknown })?.songs;
    if (Array.isArray(songs)) n += songs.filter(Boolean).length;
  }
  return n;
}

/**
 * JSON canónico: claves ordenadas y sin espacios. Es lo que hay que hashear
 * en el generador para que `songs/meta.sha256` se pueda comprobar aquí
 * (`json.dumps(data, sort_keys=True, separators=(',', ':'),
 * ensure_ascii=False)` en Python).
 */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalJson(v === undefined ? null : v)).join(',')}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj)
    .filter((k) => obj[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(obj[k])}`).join(',')}}`;
}

export type ValidationResult = { ok: true } | { ok: false; reason: string };

/**
 * ¿Se puede aceptar este `songs/data`? Nunca se cambia un catálogo bueno por
 * uno roto: vacío, sin canciones, o con muchas menos que el que hay.
 */
export function validateSongs(
  next: unknown,
  previousCount: number,
  meta?: CatalogRemoteMeta | null,
): ValidationResult {
  if (!next || typeof next !== 'object' || Array.isArray(next)) {
    return { ok: false, reason: 'formato' };
  }
  const categories = Object.values(next as Record<string, unknown>);
  const withSongs = categories.filter((c) => {
    const songs = (c as { songs?: unknown })?.songs;
    return Array.isArray(songs) && songs.length > 0;
  });
  if (withSongs.length === 0) return { ok: false, reason: 'vacío' };
  const count = countSongs(next);
  const metaCount =
    meta && typeof meta.count === 'number' && meta.count > 0
      ? meta.count
      : null;
  if (metaCount !== null && count !== metaCount) {
    return { ok: false, reason: 'incompleto' };
  }
  if (
    metaCount === null &&
    previousCount > 0 &&
    count < previousCount * MIN_KEEP_RATIO
  ) {
    return { ok: false, reason: 'demasiado pequeño' };
  }
  if (
    meta?.hashAlgo === 'sha256-canonical-v1' &&
    typeof meta.sha256 === 'string' &&
    sha256Hex(canonicalJson(next)) !== meta.sha256.toLowerCase()
  ) {
    return { ok: false, reason: 'huella' };
  }
  return { ok: true };
}

/** ¿El fichero leído del disco es un catálogo con forma de catálogo? */
export function parseCatalog(text: string | null): Catalog | null {
  if (!text) return null;
  try {
    const parsed = JSON.parse(text) as Catalog;
    if (!parsed || typeof parsed !== 'object' || parsed.v !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

/** ¿El catálogo trae canciones de verdad? (La semilla de desarrollo, no.) */
export function hasSongs(catalog: Catalog | null): boolean {
  return countSongs(catalog?.songs?.data) > 0;
}

type SongLike = { filename?: string; title?: string; content?: string };

function index(
  data: SongsData | undefined,
): Map<string, SongLike & { category: string }> {
  const out = new Map<string, SongLike & { category: string }>();
  if (!data) return out;
  for (const [category, cat] of Object.entries(data)) {
    for (const s of cat?.songs ?? []) {
      if (!s?.filename) continue;
      out.set(`${category}/${s.filename}`, { ...s, category });
    }
  }
  return out;
}

/**
 * Qué ha cambiado entre dos `songs/data`: canciones nuevas, modificadas
 * (contenido o título) y cuántas se han ido. Para el aviso discreto
 * «Cantoral actualizado · 3 canciones nuevas» y para saber si la canción que
 * se está viendo hay que repintarla.
 */
export function diffSongs(
  prev: SongsData | undefined,
  next: SongsData | undefined,
): CatalogDiff {
  const a = index(prev);
  const b = index(next);
  const diff: CatalogDiff = { added: [], changed: [], removed: 0 };
  for (const [key, song] of b) {
    const old = a.get(key);
    const item = {
      category: song.category,
      filename: song.filename!,
      title: song.title ?? song.filename!,
    };
    if (!old) diff.added.push(item);
    else if (old.content !== song.content || old.title !== song.title) {
      diff.changed.push(item);
    }
  }
  for (const key of a.keys()) if (!b.has(key)) diff.removed += 1;
  return diff;
}

/** Texto del aviso discreto tras aplicar un cantoral nuevo. */
export function describeDiff(diff: CatalogDiff): string {
  const parts: string[] = [];
  if (diff.added.length) {
    parts.push(
      `${diff.added.length} ${diff.added.length === 1 ? 'canción nueva' : 'canciones nuevas'}`,
    );
  }
  if (diff.changed.length) {
    parts.push(
      `${diff.changed.length} ${diff.changed.length === 1 ? 'corregida' : 'corregidas'}`,
    );
  }
  return parts.length
    ? `Cantoral actualizado · ${parts.join(' · ')}`
    : 'Cantoral actualizado';
}

/**
 * Con qué catálogo se arranca: nodo a nodo, el más nuevo entre el guardado
 * en el dispositivo y la semilla que trae el binario. Así una app que lleva
 * meses sin abrirse y se actualiza por la tienda estrena la semilla nueva, y
 * una que ya bajó algo más reciente no retrocede. Las canciones de la semilla
 * solo cuentan si las tiene (la de desarrollo va vacía).
 */
export function mergeNewest(
  local: Catalog | null,
  seed: Catalog | null,
): Catalog | null {
  if (!local && !seed) return null;
  const out: Catalog = { v: 1 };
  for (const node of CATALOG_NODES) {
    const l = local?.[node];
    const s = seed?.[node];
    const sUsable = node === 'songs' ? countSongs(s?.data) > 0 : !!s;
    const lUsable = node === 'songs' ? countSongs(l?.data) > 0 : !!l;
    let pick = l;
    if (sUsable && (!lUsable || (s!.updatedAt ?? 0) > (l!.updatedAt ?? 0))) {
      pick = s;
    }
    if (pick) (out as unknown as Record<string, unknown>)[node] = pick;
  }
  return out;
}

/** Espera de reintento número `attempt` (0, 1, 2…); `null` = no más. */
export function retryDelay(attempt: number): number | null {
  return attempt < RETRY_DELAYS_MS.length ? RETRY_DELAYS_MS[attempt] : null;
}
