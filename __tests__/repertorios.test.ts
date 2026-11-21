/**
 * Repertorios (`services/repertorios`, `02-datos-offline.md` §5-§6): varios,
 * con pausas y notas, compatibles con lo que lee MCM App, y los bloques del
 * cantoral como repertorios de solo lectura.
 */
import {
  applySelection,
  duplicate,
  fromShared,
  newRepertorio,
  parsePacks,
  repertorioSeconds,
  toSelection,
  toShareFields,
  type Repertorio,
} from '@/services/repertorios/model';
import { RepertoriosStore } from '@/services/repertorios/store';
import { memoryFiles } from '@/services/catalog/filesTypes';

const rep = (): Repertorio => ({
  id: 'r1',
  name: 'Misa',
  items: [
    { category: 'entrada', filename: 'a.cho', notes: '🎺', key: 'Am' },
    { type: 'break', title: 'Homilía', minutes: 5 },
    { category: 'ofertorio', filename: 'b.cho', capo: 2 },
    { category: 'salida', filename: 'c.cho', duration: '3:00' },
  ],
  updatedAt: 1,
});

describe('selección ⇄ repertorio', () => {
  it('toSelection: solo canciones, con tono y cejilla, en orden', () => {
    expect(toSelection(rep())).toEqual([
      expect.objectContaining({ filename: 'a.cho', order: 0, transpose: 0 }),
      expect.objectContaining({
        filename: 'b.cho',
        order: 1,
        capoOverride: 2,
        categoryHint: 'ofertorio',
      }),
      expect.objectContaining({ filename: 'c.cho', order: 2 }),
    ]);
  });

  it('applySelection conserva pausas y notas al reordenar', () => {
    const sel = toSelection(rep());
    // c, a, b
    const reordered = [
      { ...sel[2], order: 0 },
      { ...sel[0], order: 1 },
      { ...sel[1], order: 2 },
    ];
    const next = applySelection(rep(), reordered, 9);
    expect(
      next.items.map((i) => (i.type === 'break' ? '|' : i.filename)),
    ).toEqual(['c.cho', 'a.cho', '|', 'b.cho']);
    expect(next.items[1]).toMatchObject({ notes: '🎺', key: 'Am' });
    expect(next.updatedAt).toBe(9);
  });

  it('applySelection: quitar una canción no se lleva su pausa; añadir va al final', () => {
    const sel = toSelection(rep()).filter((s) => s.filename !== 'b.cho');
    sel.push({
      filename: 'd.cho',
      transpose: 3,
      order: 9,
      addedAt: 0,
      categoryHint: 'comunion',
    });
    const next = applySelection(rep(), sel, 2);
    expect(
      next.items.map((i) => (i.type === 'break' ? '|' : i.filename)),
    ).toEqual(['a.cho', 'c.cho', 'd.cho', '|']);
    expect(next.items[2]).toMatchObject({ category: 'comunion', transpose: 3 });
  });

  it('quitar la cejilla en la selección la quita del repertorio', () => {
    const sel = toSelection(rep()).map((s) => ({ ...s, capoOverride: null }));
    const next = applySelection(rep(), sel, 2);
    expect(
      next.items.find((i) => i.type !== 'break' && i.filename === 'b.cho'),
    ).not.toHaveProperty('capo');
  });
});

describe('bloques del cantoral (songs/packs)', () => {
  const PACKS = {
    'hucha-2026-manana-1': {
      title: 'Mañana 1',
      event: 'Villancicos Solidarios 2026',
      date: '2026-12-19',
      targetMinutes: 60,
      items: [
        {
          category: 'navidad',
          filename: 'himno.cho',
          title: 'Himno',
          key: 'Am',
          capo: 1,
          notes: '🎺',
          duration: '3:20',
        },
        { type: 'break', title: 'Presentación de la hucha', minutes: 3 },
        { filename: '' },
        'basura',
      ],
    },
  };

  it('son repertorios de solo lectura con su evento y fecha', () => {
    const [pack] = parsePacks(PACKS);
    expect(pack).toMatchObject({
      id: 'pack:hucha-2026-manana-1',
      name: 'Mañana 1',
      event: 'Villancicos Solidarios 2026',
      date: '2026-12-19',
      readOnly: true,
      source: { kind: 'pack', ref: 'hucha-2026-manana-1' },
    });
    expect(pack.items).toHaveLength(2);
    expect(repertorioSeconds(pack)).toEqual({
      seconds: 200 + 180,
      unknownSongs: 0,
    });
  });

  it('duplicar un bloque da una copia editable', () => {
    const [pack] = parsePacks(PACKS);
    const copy = duplicate(pack, 5, 'x');
    expect(copy).toMatchObject({
      id: 'x',
      readOnly: undefined,
      name: 'Mañana 1',
    });
    expect(copy.items).toEqual(pack.items);
    expect(copy.items[0]).not.toBe(pack.items[0]);
  });
});

describe('compartir sin romper MCM App', () => {
  it('lleva el songs v2 de siempre y además items', () => {
    const shared = toShareFields(rep());
    expect(shared.songs.map((s) => s.filename)).toEqual([
      'a.cho',
      'b.cho',
      'c.cho',
    ]);
    expect(shared.items).toHaveLength(4);
  });

  it('lee items si vienen y songs si no (lo que sube MCM App)', () => {
    const fromCantoral = fromShared(toShareFields(rep()), {
      id: 'n',
      now: 1,
      source: undefined,
    });
    expect(fromCantoral?.items).toHaveLength(4);
    const fromApp = fromShared(
      {
        name: 'Misa del domingo',
        songs: [
          { filename: 'b.cho', order: 1, transpose: 2, categoryHint: 'x' },
          { filename: 'a.cho', order: 0, transpose: 0, capoOverride: 3 },
          { filename: 'a.cho', order: 2, transpose: 0 },
        ],
      },
      { id: 'n', now: 1, source: { kind: 'cloud', ref: '1234' } },
    );
    expect(fromApp?.name).toBe('Misa del domingo');
    expect(fromApp?.items).toEqual([
      { category: '', filename: 'a.cho', capo: 3 },
      { category: 'x', filename: 'b.cho', transpose: 2 },
    ]);
    expect(fromShared(null, { id: 'n', now: 1, source: undefined })).toBeNull();
  });
});

describe('RepertoriosStore', () => {
  it('la primera vez migra lo de MCM App y lo deja activo', async () => {
    const legacy = {
      ...newRepertorio('Mi repertorio', 1, 'old'),
      items: [{ category: 'a', filename: 'x.cho' }],
    };
    const store = new RepertoriosStore({
      files: memoryFiles(),
      legacy: async () => legacy,
      now: () => 5,
    });
    await store.init();
    expect(store.getState().activeId).toBe('old');
    expect(store.getActive()?.items).toHaveLength(1);
  });

  it('crear, renombrar, activar, borrar; siempre queda uno', async () => {
    const files = memoryFiles();
    const store = new RepertoriosStore({ files, now: () => 5 });
    await store.init();
    const a = store.create('Ensayo');
    expect(store.getState().activeId).toBe(a.id);
    store.rename(a.id, '  Ensayo jueves ');
    expect(store.get(a.id)?.name).toBe('Ensayo jueves');
    for (const r of [...store.getState().list]) store.remove(r.id);
    expect(store.getState().list).toHaveLength(1);
    await store.flush();
    // Lo que queda está en el disco con su índice.
    const index = JSON.parse(files.files.get('indice.json')!);
    expect(index.ids).toEqual([store.getState().list[0].id]);
  });

  it('un bloque no se edita: se duplica', async () => {
    const store = new RepertoriosStore({ files: memoryFiles(), now: () => 5 });
    await store.init();
    const [pack] = parsePacks({ p: { title: 'Mañana 1', items: [] } });
    const copy = store.duplicate(pack);
    expect(copy.readOnly).toBeUndefined();
    expect(store.getState().activeId).toBe(copy.id);
  });

  it('lo guardado se vuelve a leer igual', async () => {
    const files = memoryFiles();
    const a = new RepertoriosStore({ files, now: () => 5 });
    await a.init();
    const r = a.create('Vigilia');
    a.update(r.id, (x) => ({
      ...x,
      items: [{ type: 'break', title: 'Silencio' }],
    }));
    await a.flush();
    const b = new RepertoriosStore({ files, now: () => 6 });
    await b.init();
    expect(b.getState().activeId).toBe(r.id);
    expect(b.getActive()?.items).toEqual([
      { type: 'break', title: 'Silencio' },
    ]);
  });
});

describe('tono del día de los bloques', () => {
  it('semitonesBetween va por el camino corto y entiende cifrado y latino', () => {
    const { semitonesBetween, keyRoot } = jest.requireActual(
      '@/services/repertorios/model',
    );
    expect(semitonesBetween('C', 'D')).toBe(2);
    expect(semitonesBetween('G', 'Am')).toBe(2);
    expect(semitonesBetween('A', 'G')).toBe(-2);
    expect(semitonesBetween('Do', 'Sol')).toBe(-5);
    expect(semitonesBetween('Mib', 'F#m')).toBe(3);
    expect(semitonesBetween('?', 'C')).toBe(0);
    expect(keyRoot('Bb')).toBe(10);
  });

  it('materialize pone el transporte del día y respeta el que ya hubiera', () => {
    const { materialize } = jest.requireActual('@/services/repertorios/model');
    const r = materialize(
      {
        id: 'p',
        name: 'Bloque',
        items: [
          { category: 'n', filename: 'a.cho', key: 'Am' },
          { category: 'n', filename: 'b.cho', key: 'C', transpose: 1 },
          { type: 'break', title: 'Pausa' },
        ],
        updatedAt: 0,
      },
      () => 'Gm',
    );
    expect(r.items[0].transpose).toBe(2);
    expect(r.items[1].transpose).toBe(1);
  });
});
