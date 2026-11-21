/**
 * Subcategorías, «también en» y duración (`utils/songCategories.ts`, Fase 1
 * de Navidad, `02-datos-offline.md` §4).
 */
import {
  formatDuration,
  groupBySubcategory,
  parseDuration,
  readAlsoIn,
  readSubcategories,
  songsForCategory,
  sortCategoryKeys,
  sumDurations,
} from '@/utils/songCategories';

const DATA = {
  navidad: {
    categoryTitle: 'N. Navidad',
    order: 14,
    subcategories: {
      populares: { title: 'Populares', order: 2, emoji: '🔔' },
      nuevas: { title: 'Nuevas', order: 1 },
    },
    songs: [
      { title: 'Noche de paz', filename: 'paz.cho', subcategory: 'populares' },
      { title: 'Nueva 1', filename: 'n1.cho', subcategory: 'nuevas' },
      { title: 'Suelta', filename: 'suelta.cho' },
      { title: 'Rara', filename: 'rara.cho', subcategory: 'no-existe' },
    ],
  },
  entrada: {
    categoryTitle: 'A. Entrada',
    order: 1,
    songs: [
      {
        title: 'Ven, Señor',
        filename: 'ven.cho',
        alsoIn: ['navidad/nuevas', 'adviento'],
      },
      { title: 'Solo entrada', filename: 'solo.cho' },
    ],
  },
  ofertorio: {
    categoryTitle: 'E. Ofertorio',
    songs: [
      {
        title: 'Pan de vida',
        filename: 'pan.cho',
        alsoIn: [{ category: 'Navidad', subcategory: 'populares' }],
      },
    ],
  },
};

describe('readSubcategories', () => {
  it('ordena por order y luego por título; sin datos, ninguna', () => {
    expect(readSubcategories(DATA.navidad).map((s) => s.slug)).toEqual([
      'nuevas',
      'populares',
    ]);
    expect(readSubcategories(DATA.entrada)).toEqual([]);
    expect(readSubcategories(null)).toEqual([]);
  });
});

describe('readAlsoIn', () => {
  it('acepta "cat", "cat/sub" y objetos', () => {
    expect(readAlsoIn(DATA.entrada.songs[0])).toEqual([
      { category: 'navidad', subcategory: 'nuevas' },
      { category: 'adviento', subcategory: null },
    ]);
    expect(readAlsoIn(DATA.ofertorio.songs[0])).toEqual([
      { category: 'Navidad', subcategory: 'populares' },
    ]);
    expect(readAlsoIn({ alsoIn: 42 })).toEqual([]);
  });
});

describe('songsForCategory', () => {
  it('las suyas y las prestadas, cada una con su casa y sin duplicar', () => {
    const list = songsForCategory(DATA, 'navidad');
    expect(list.map((s) => `${s.homeCategory}/${s.filename}`)).toEqual([
      'navidad/paz.cho',
      'navidad/n1.cho',
      'navidad/suelta.cho',
      'navidad/rara.cho',
      'entrada/ven.cho',
      'ofertorio/pan.cho',
    ]);
    const ven = list.find((s) => s.filename === 'ven.cho')!;
    expect(ven.borrowed).toBe(true);
    expect(ven.subcategorySlug).toBe('nuevas');
  });

  it('en su casa la canción prestada sigue siendo suya', () => {
    const list = songsForCategory(DATA, 'entrada');
    expect(list).toHaveLength(2);
    expect(list.every((s) => !s.borrowed)).toBe(true);
  });
});

describe('groupBySubcategory', () => {
  it('en el orden de la categoría, con «Otras» al final', () => {
    const groups = groupBySubcategory(
      songsForCategory(DATA, 'navidad'),
      readSubcategories(DATA.navidad),
    );
    expect(groups.map((g) => g.subcategory?.slug ?? null)).toEqual([
      'nuevas',
      'populares',
      null,
    ]);
    expect(groups[0].songs.map((s) => s.filename)).toEqual([
      'n1.cho',
      'ven.cho',
    ]);
    expect(groups[2].songs.map((s) => s.filename)).toEqual([
      'suelta.cho',
      'rara.cho',
    ]);
  });

  it('sin subcategorías es un solo grupo', () => {
    const songs = songsForCategory(DATA, 'entrada');
    expect(groupBySubcategory(songs, [])).toEqual([
      { subcategory: null, songs },
    ]);
  });
});

it('sortCategoryKeys: primero las que traen order; luego por título', () => {
  expect(sortCategoryKeys(DATA)).toEqual(['entrada', 'navidad', 'ofertorio']);
});

describe('duración', () => {
  it('parsea m:ss y h:mm:ss; lo raro es null', () => {
    expect(parseDuration('3:20')).toBe(200);
    expect(parseDuration('1:02:05')).toBe(3725);
    expect(parseDuration('3:75')).toBeNull();
    expect(parseDuration('tres')).toBeNull();
    expect(parseDuration(undefined)).toBeNull();
  });
  it('formatea y suma lo que se sabe', () => {
    expect(formatDuration(200)).toBe('3:20');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(sumDurations(['3:20', undefined, '1:40'])).toEqual({
      seconds: 300,
      known: 2,
      unknown: 1,
    });
  });
});
