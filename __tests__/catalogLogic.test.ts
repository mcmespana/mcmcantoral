/**
 * Lógica pura del catálogo offline (`services/catalog/logic.ts`,
 * `02-datos-offline.md` §3.3): cuándo bajar, qué aceptar y qué ha cambiado.
 */
import {
  canonicalJson,
  countSongs,
  describeDiff,
  diffSongs,
  mergeNewest,
  shouldCheck,
  shouldDownload,
  validateSongs,
  CHECK_INTERVAL_MS,
} from '@/services/catalog/logic';
import { sha256Hex } from '@/utils/sha256';
import type { Catalog } from '@/services/catalog/types';

const songs = (n: number, cat = 'entrada') => ({
  [cat]: {
    categoryTitle: 'A. Entrada',
    songs: Array.from({ length: n }, (_, i) => ({
      title: `Canción ${i}`,
      filename: `c${i}.cho`,
      content: `[C]letra ${i}`,
    })),
  },
});

describe('shouldDownload: comparación numérica', () => {
  it('no baja si es igual', () => {
    expect(shouldDownload(1_700_000_000_000, 1_700_000_000_000)).toBe(false);
    // El mismo instante en segundos tampoco.
    expect(shouldDownload(1_700_000_000_000, 1_700_000_000)).toBe(false);
  });
  it('no baja si es menor', () => {
    expect(shouldDownload(1_700_000_000_000, 1_600_000_000_000)).toBe(false);
  });
  it('baja si es mayor (s, ms o ISO)', () => {
    expect(shouldDownload(1_700_000_000_000, 1_700_000_001)).toBe(true);
    expect(shouldDownload(0, '2026-11-21T10:00:00Z')).toBe(true);
  });
  it('un updatedAt ilegible o ausente no fuerza descarga', () => {
    expect(shouldDownload(5, null)).toBe(false);
    expect(shouldDownload(5, 'fixture')).toBe(false);
  });
});

describe('shouldCheck: como mucho cada 15 min', () => {
  it('la primera vez sí; antes de 15 min no; después sí', () => {
    expect(shouldCheck(null, 1000)).toBe(true);
    expect(shouldCheck(0, CHECK_INTERVAL_MS - 1)).toBe(false);
    expect(shouldCheck(0, CHECK_INTERVAL_MS)).toBe(true);
  });
  it('tirar para actualizar lo fuerza', () => {
    expect(shouldCheck(0, 1, true)).toBe(true);
  });
});

describe('validateSongs', () => {
  it('rechaza un catálogo vacío o sin canciones', () => {
    expect(validateSongs({}, 0)).toEqual({ ok: false, reason: 'vacío' });
    expect(validateSongs({ a: { categoryTitle: 'A', songs: [] } }, 0).ok).toBe(
      false,
    );
    expect(validateSongs(null, 0).ok).toBe(false);
    expect(validateSongs([1, 2], 0).ok).toBe(false);
  });
  it('rechaza uno con menos del 80 % de canciones que el anterior', () => {
    expect(validateSongs(songs(79), 100).ok).toBe(false);
    expect(validateSongs(songs(80), 100).ok).toBe(true);
  });
  it('si songs/meta dice cuántas hay, manda eso (y no el 80 %)', () => {
    expect(validateSongs(songs(50), 100, { count: 50 }).ok).toBe(true);
    expect(validateSongs(songs(49), 100, { count: 50 })).toEqual({
      ok: false,
      reason: 'incompleto',
    });
  });
  it('comprueba la huella solo en formato canónico', () => {
    const data = songs(3);
    const good = sha256Hex(canonicalJson(data));
    expect(
      validateSongs(data, 0, { sha256: good, hashAlgo: 'sha256-canonical-v1' })
        .ok,
    ).toBe(true);
    expect(
      validateSongs(data, 0, { sha256: 'mal', hashAlgo: 'sha256-canonical-v1' }),
    ).toEqual({ ok: false, reason: 'huella' });
    // Sin formato declarado no se compara (no sería comparable byte a byte).
    expect(validateSongs(data, 0, { sha256: 'mal' }).ok).toBe(true);
  });
});

it('canonicalJson ordena las claves y no deja espacios', () => {
  expect(canonicalJson({ b: 1, a: [true, null, 'x'] })).toBe(
    '{"a":[true,null,"x"],"b":1}',
  );
});

describe('diffSongs', () => {
  it('nuevas, corregidas y quitadas', () => {
    const prev = songs(3);
    const next = songs(4);
    next.entrada.songs[1] = { ...next.entrada.songs[1], content: 'otra' };
    const d = diffSongs(prev, next);
    expect(d.added.map((s) => s.filename)).toEqual(['c3.cho']);
    expect(d.changed.map((s) => s.filename)).toEqual(['c1.cho']);
    expect(d.removed).toBe(0);
    expect(diffSongs(next, prev).removed).toBe(1);
    expect(describeDiff(d)).toBe(
      'Cantoral actualizado · 1 canción nueva · 1 corregida',
    );
  });
});

describe('mergeNewest: con qué se arranca', () => {
  const cat = (at: number, n: number): Catalog => ({
    v: 1,
    songs: { updatedAt: at, data: songs(n) },
  });
  it('sin nada, nada; solo semilla, la semilla', () => {
    expect(mergeNewest(null, null)).toBeNull();
    expect(mergeNewest(null, cat(1, 2))?.songs?.updatedAt).toBe(1);
  });
  it('lo guardado gana si es igual o más nuevo', () => {
    expect(mergeNewest(cat(5, 2), cat(4, 9))?.songs?.updatedAt).toBe(5);
    expect(mergeNewest(cat(5, 2), cat(5, 9))?.songs?.updatedAt).toBe(5);
  });
  it('una semilla más nueva (app actualizada por la tienda) gana', () => {
    expect(mergeNewest(cat(5, 2), cat(6, 2))?.songs?.updatedAt).toBe(6);
  });
  it('una semilla vacía (la de desarrollo) nunca pisa canciones', () => {
    const empty: Catalog = { v: 1, songs: { updatedAt: 99, data: {} } };
    expect(countSongs(mergeNewest(cat(5, 2), empty)?.songs?.data)).toBe(2);
  });
  it('nodo a nodo: config de la semilla, canciones de lo guardado', () => {
    const local = cat(5, 2);
    const seed: Catalog = {
      v: 1,
      cantoralConfig: { updatedAt: 3, data: { mode: 'navidad' } },
    };
    const m = mergeNewest(local, seed)!;
    expect(m.songs?.updatedAt).toBe(5);
    expect(m.cantoralConfig?.data).toEqual({ mode: 'navidad' });
  });
});
