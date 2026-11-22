/**
 * Apuntes (`05` §4 y §7): la parte frágil es que no se pierdan cuando la
 * canción cambia (`reanchorNotes`). Y que «Solo yo» nunca salga del móvil.
 */
import {
  anchorFor,
  defaultVisibleLayers,
  isShareable,
  layerLabel,
  lineSimilarity,
  normalizeLine,
  parseApunte,
  reanchorNotes,
  type Apunte,
} from '@/services/apuntes/model';
import { ApuntesStore, fileFor, mergeById } from '@/services/apuntes/store';
import { memoryFiles } from '@/services/catalog/filesTypes';

const SONG_V1 = [
  '{title: Prueba}', // 0
  '[C]Alabaré, ala[G]baré', // 1
  '[Am]alabaré a mi [F]Señor', // 2
  '', // 3
  '{soc}', // 4
  '[F]Juan vio el [C]número', // 5
  '{eoc}', // 6
].join('\n');

const note = (line: number, content = SONG_V1, extra: Partial<Apunte> = {}) =>
  ({
    id: `n${line}`,
    song: { category: 'alabanza', filename: 'alabare.cho' },
    ...anchorFor(content, line),
    layer: 'yo',
    kind: 'texto',
    text: 'respira aquí',
    updatedAt: 1,
    ...extra,
  }) as Apunte;

describe('normalizar una línea', () => {
  it('sin acordes, marcado, tildes ni signos', () => {
    expect(normalizeLine('[Am]Ala<i>ba</i>ré, a mi [F]Señor!')).toBe(
      'ala ba re a mi senor',
    );
  });
  it('las directivas y comentarios no tienen texto', () => {
    expect(normalizeLine('{soc}')).toBe('');
    expect(normalizeLine('# nota')).toBe('');
    expect(normalizeLine(undefined)).toBe('');
  });
});

it('parecido por palabras', () => {
  expect(lineSimilarity('a b c d', 'a b c d')).toBe(1);
  expect(lineSimilarity('a b c d', 'a b x d')).toBe(0.75);
  expect(lineSimilarity('', 'a')).toBe(0);
});

describe('reanchorNotes', () => {
  it('misma línea, misma huella: se queda', () => {
    const n = note(2);
    const [r] = reanchorNotes([n], SONG_V1);
    expect(r).toBe(n);
  });

  it('se añaden líneas arriba: el apunte se mueve con su línea', () => {
    const v2 = [
      '{title: Prueba}',
      '{key: C}',
      '{capo: 2}',
      ...SONG_V1.split('\n').slice(1),
    ].join('\n');
    const [r] = reanchorNotes([note(2)], v2);
    expect(r.line).toBe(4);
    expect(r.orphan).toBe(false);
  });

  it('cambia una palabra: sigue en la más parecida (≥ 70 %)', () => {
    const v2 = SONG_V1.replace('alabaré a mi [F]Señor', 'alabaré a mi [F]Dios');
    const [r] = reanchorNotes([note(2)], v2);
    // 3 de 4 palabras iguales = 75 %: se queda en su sitio.
    expect(r.line).toBe(2);
    expect(r.orphan).toBe(false);
    expect(r.lineText).toBe('alabare a mi dios');
  });

  it('si nada se parece: huérfano (no se pierde)', () => {
    const v2 = SONG_V1.replace(
      '[Am]alabaré a mi [F]Señor',
      'otra cosa distinta del todo',
    );
    const [r] = reanchorNotes([note(2)], v2);
    expect(r.orphan).toBe(true);
    expect(r.text).toBe('respira aquí');
  });

  it('un huérfano vuelve a su sitio si la línea reaparece', () => {
    const orphan = { ...note(2), orphan: true };
    const [r] = reanchorNotes([orphan], SONG_V1);
    expect(r.orphan).toBe(false);
  });

  it('a igual parecido, la línea más cercana a la original', () => {
    const rep = ['[C]Juan vio', 'x', 'y', 'z', '[C]Juan vio'].join('\n');
    const n = note(4, rep, { lineHash: 'otra' });
    const [r] = reanchorNotes([n], rep);
    expect(r.line).toBe(4);
  });
});

describe('capas', () => {
  it('etiquetas y las que se ven de serie', () => {
    expect(layerLabel('yo')).toBe('Solo yo');
    expect(layerLabel('inst:bajo')).toBe('Bajos');
    expect(defaultVisibleLayers(['bajo'])).toEqual([
      'todos',
      'inst:bajo',
      'yo',
    ]);
  });
  it('«Solo yo» no se comparte', () => {
    expect(isShareable(note(1))).toBe(false);
    expect(isShareable({ ...note(1), layer: 'todos' })).toBe(true);
  });
});

it('lo que llega de fuera se valida', () => {
  expect(parseApunte({ ...note(1) })).toMatchObject({ id: 'n1', line: 1 });
  expect(parseApunte({ ...note(1), layer: 'inst:gaita' })).toBeNull();
  expect(parseApunte({ ...note(1), kind: 'abc' })).toBeNull();
  expect(parseApunte(null)).toBeNull();
  expect(parseApunte({ ...note(1), text: 'x'.repeat(500) })?.text).toHaveLength(
    200,
  );
});

describe('ApuntesStore', () => {
  const song = { category: 'alabanza', filename: 'alabare.cho' };

  it('guarda un fichero por canción y lo vuelve a leer', async () => {
    const files = memoryFiles();
    const a = new ApuntesStore(files);
    await a.load(song);
    a.upsert(note(1));
    await Promise.resolve();
    expect(files.files.has(fileFor(song))).toBe(true);
    const b = new ApuntesStore(files);
    expect(await b.load(song)).toHaveLength(1);
    b.remove(song, 'n1');
    await Promise.resolve();
    expect(files.files.has(fileFor(song))).toBe(false);
  });

  it('importar junta por id (gana el más nuevo) y nunca mete «Solo yo»', async () => {
    const s = new ApuntesStore(memoryFiles());
    s.upsert({ ...note(1), layer: 'todos', text: 'viejo', updatedAt: 1 });
    const added = await s.importMany([
      { ...note(1), layer: 'todos', text: 'nuevo', updatedAt: 2 },
      { ...note(2), layer: 'yo' },
      { ...note(5), id: 'z', layer: 'inst:bajo' },
    ]);
    expect(added).toBe(1);
    const list = s.get(song);
    expect(list.map((x) => x.text).sort()).toEqual(['nuevo', 'respira aquí']);
  });

  it('mergeById', () => {
    expect(
      mergeById([note(1)], [{ ...note(1), updatedAt: 0, text: 'x' }])[0].text,
    ).toBe('respira aquí');
  });

  it('fichero seguro aunque la categoría tenga barras', () => {
    expect(fileFor({ category: 'a/b', filename: 'c d.cho' })).toBe(
      'a~b~c%20d.cho.json',
    );
  });
});
