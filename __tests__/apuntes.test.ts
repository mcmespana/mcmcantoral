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
import {
  collectShareableApuntes,
  importSharedApuntes,
  readSharedApuntes,
} from '@/services/apuntes/share';
import { memoryFiles } from '@/services/catalog/filesTypes';
import { apuntesScript, toPainted } from '@/utils/apuntesScript';
import { EMPTY_VIEW, liveReducer } from '@/services/live/protocol';
import { parseWire } from '@/services/live/local/framing';
import { readCloudExtras } from '@/services/live/cloud';

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

describe('pintar en la hoja', () => {
  it('es JS válido y el texto no puede cerrar el <script>', () => {
    const js = apuntesScript(
      toPainted([
        { ...note(1), text: '</script><img src=x onerror=alert(1)>' },
      ]),
    );
    expect(() => new Function(js)).not.toThrow();
    expect(js).not.toContain('</script>');
    expect(js).toContain('textContent');
  });
});

describe('apuntes en directo', () => {
  const ev = {
    t: 'apunte' as const,
    id: 'a1-1',
    apunte: { ...note(2), layer: 'inst:bajo' },
    from: 'm',
    at: 5,
  };

  it('llega una vez aunque venga por los dos caminos', () => {
    let v = liveReducer(EMPTY_VIEW, { type: 'event', event: ev }, 0);
    v = liveReducer(v, { type: 'event', event: ev }, 0);
    expect(v.apuntes).toHaveLength(1);
    expect(parseApunte(v.apuntes[0].apunte)?.layer).toBe('inst:bajo');
  });

  it('pasa por el cable de la wifi y por la nube', () => {
    expect(parseWire({ type: 'event', event: ev })).not.toBeNull();
    expect(
      parseWire({ type: 'event', event: { ...ev, apunte: 3 } }),
    ).toBeNull();
    expect(readCloudExtras({ apuntes: { x: ev, y: 1 } }).apuntes).toHaveLength(
      1,
    );
  });
});

describe('apuntes dentro del repertorio (`05` §6)', () => {
  const items = [
    { category: 'alabanza', filename: 'alabare.cho' },
    { type: 'break' as const, title: 'Pausa' },
    { category: 'alabanza', filename: 'alabare.cho' },
  ];

  it('se comparten los de Todos e instrumento, sin «Solo yo» ni repetir', async () => {
    const s = new ApuntesStore(memoryFiles());
    s.upsert({ ...note(1), id: 'a', layer: 'todos', orphan: true });
    s.upsert({ ...note(2), id: 'b', layer: 'yo' });
    s.upsert({ ...note(5), id: 'c', layer: 'inst:bajo' });
    const out = await collectShareableApuntes(items, s);
    expect(out.map((a) => a.id).sort()).toEqual(['a', 'c']);
    expect(out[0]).not.toHaveProperty('orphan');
  });

  it('al importar llegan; lo mal formado o «Solo yo» no', async () => {
    const s = new ApuntesStore(memoryFiles());
    const raw = {
      songs: [],
      apuntes: [
        { ...note(1), id: 'x', layer: 'todos' },
        { ...note(2), id: 'y', layer: 'yo' },
        { basura: true },
      ],
    };
    expect(readSharedApuntes(raw)).toHaveLength(1);
    expect(readSharedApuntes({ apuntes: 'no' })).toEqual([]);
    expect(await importSharedApuntes(raw, s)).toBe(1);
  });
});
