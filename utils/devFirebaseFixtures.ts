/**
 * Datos de prueba de Firebase para DESARROLLO (simulador y capturas).
 *
 * Solo se usan si el build se lanza con `EXPO_PUBLIC_FIREBASE_FIXTURES=1`
 * (ver `hooks/useFirebaseData.ts`). Las builds de tienda y la web publicada no
 * llevan la variable: ahí este fichero no se lee y todo sigue yendo a Firebase.
 *
 * Es contenido inventado a propósito (no son canciones reales): sirve
 * para ver las pantallas con datos sin tocar la base de verdad.
 */

const SONGS = {
  ordinario: {
    categoryTitle: 'Ordinario de la misa',
    songs: [
      {
        title: '01. Señor, ten piedad',
        filename: '01.senor_ten_piedad.cho',
        author: 'Letra de prueba',
        key: 'Am',
        content:
          '{title: Señor, ten piedad}\n{key: Am}\n\n{start_of_verse}\n[Am]Señor, ten pie[G]dad,\n[F]Cristo, ten pie[E]dad,\n[Am]Señor, ten pie[G]dad[Am]\n{end_of_verse}',
      },
      {
        title: '02. Gloria a Dios',
        filename: '02.gloria_a_dios.cho',
        author: 'Letra de prueba',
        key: 'D',
        content:
          '{title: Gloria a Dios}\n{key: D}\n\n{start_of_chorus}\n[D]Gloria a Dios en el [A]cielo,\ny en la [Bm]tierra paz a los [G]hombres\n{end_of_chorus}\n\n{start_of_verse}\n[D]Te alabamos, te ben[A]decimos,\n[Bm]te adoramos, te glori[G]ficamos[D]\n{end_of_verse}',
      },
    ],
  },
  entrada: {
    categoryTitle: 'Entrada',
    songs: [
      {
        title: 'Venid y cantemos',
        filename: 'venid_y_cantemos.cho',
        author: 'Letra de prueba',
        key: 'G',
        capo: 2,
        content:
          '{title: Venid y cantemos}\n{key: G}\n\n{start_of_chorus}\n[G]Venid y can[D]temos al [Em]Señor,\n[C]aclamemos a la [D]Roca de nuestra sal[G]vación\n{end_of_chorus}\n\n{start_of_verse}\n[G]Entremos en su pre[D]sencia con ac[Em]ción de gracias,\n[C]con cantos de ale[D]gría ale[G]mos\n{end_of_verse}',
      },
      {
        title: 'Un pueblo en camino',
        filename: 'un_pueblo_en_camino.cho',
        author: 'Letra de prueba',
        key: 'C',
        content:
          '{title: Un pueblo en camino}\n{key: C}\n\n{start_of_verse}\n[C]Caminamos jun[F]tos hacia la ca[G]sa del [C]Padre,\n[Am]con la mochila [F]llena de espe[G]ranza[C]\n{end_of_verse}',
      },
    ],
  },
  comunion: {
    categoryTitle: 'Comunión',
    songs: [
      {
        title: 'Pan de vida',
        filename: 'pan_de_vida.cho',
        author: 'Letra de prueba',
        key: 'E',
        content:
          '{title: Pan de vida}\n{key: E}\n\n{start_of_chorus}\n[E]Pan de vi[B]da, pan com[C#m]partido,\n[A]alimento del cami[B]nante[E]\n{end_of_chorus}',
      },
    ],
  },
};

/** Navidad de prueba: una categoría con subcategorías y un préstamo. */
const SONGS_NAVIDAD = {
  ...SONGS,
  navidad: {
    categoryTitle: 'N. Navidad 🎄',
    subcategories: {
      populares: { title: 'Populares', order: 1, emoji: '🔔' },
      nuevas: { title: 'Nuevas', order: 2 },
    },
    songs: [
      {
        title: 'Campana sobre campana',
        filename: 'campana.cho',
        author: 'Popular',
        key: 'G',
        subcategory: 'populares',
        duration: '2:40',
        content:
          '{title: Campana sobre campana}\n{key: G}\n\n{start_of_verse}\n[G]Campana sobre cam[D]pana,\ny sobre campana [G]una,\n<i>asómate a la ven[D]tana</i>\n[*CLAP]verás al niño en la [G]cuna.\n{end_of_verse}\n\n{start_of_chorus}\n[C]Belén, campanas de Be[G]lén,\nque los [D]ángeles tocan, ¿qué nuevas me [G]traéis?\n{end_of_chorus}',
      },
      {
        title: 'Noche de paz',
        filename: 'noche_de_paz.cho',
        author: 'F. X. Gruber',
        key: 'C',
        subcategory: 'populares',
        duration: '3:20',
        content:
          '{title: Noche de paz}\n{key: C}\n\n{start_of_verse}\n[C]Noche de paz, noche de a[C7]mor,\n[F]todo duerme en derre[C]dor.\n{end_of_verse}',
      },
    ],
  },
};
SONGS_NAVIDAD.entrada = {
  ...SONGS.entrada,
  songs: SONGS.entrada.songs.map((s, i) =>
    i === 0 ? { ...s, alsoIn: ['navidad/nuevas'] } : s,
  ),
};

const PACKS = {
  'hucha-manana-1': {
    title: 'Mañana 1',
    event: 'Villancicos Solidarios',
    date: '2026-12-19',
    targetMinutes: 60,
    items: [
      {
        category: 'navidad',
        filename: 'campana.cho',
        key: 'A',
        notes: '🎺 entra la trompeta',
      },
      { type: 'break', title: 'Presentación de la hucha', minutes: 3 },
      { category: 'navidad', filename: 'noche_de_paz.cho', capo: 2 },
    ],
  },
  'hucha-manana-2': {
    title: 'Mañana 2',
    event: 'Villancicos Solidarios',
    date: '2026-12-19',
    items: [{ category: 'navidad', filename: 'noche_de_paz.cho' }],
  },
};

const CONFIG_NAVIDAD = {
  mode: 'navidad',
  featuredCategory: 'navidad',
  event: {
    title: 'Villancicos Solidarios',
    place: 'Cuatro Esquinas',
    date: '2026-12-19',
    packs: ['hucha-manana-1', 'hucha-manana-2'],
    liveKey: 'villancicos-prueba',
  },
};

const FIXTURES: Record<string, unknown> = {
  songs: SONGS,
};

/**
 * Catálogo offline de prueba (semilla) para capturas y simulador: canciones,
 * Navidad con subcategorías, bloques del evento y modo Navidad encendido.
 */
export function devCatalogFixture() {
  const at = 1_700_000_000_000;
  return {
    v: 1 as const,
    songs: { updatedAt: at, data: SONGS_NAVIDAD },
    packs: { updatedAt: at, data: PACKS },
    cantoralConfig: { updatedAt: at, data: CONFIG_NAVIDAD },
  };
}

/** `undefined` = no hay dato de prueba para ese nodo (se va a Firebase). */
export function devFixtureFor(path: string): unknown {
  return FIXTURES[path];
}
