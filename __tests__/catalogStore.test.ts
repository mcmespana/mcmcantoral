/**
 * `CatalogStore` (`services/catalog/store.ts`) con disco, red y reloj falsos.
 * Lo que importa (`02-datos-offline.md` §3):
 *  - nunca vacío: arranca con lo guardado o con la semilla;
 *  - nunca re-baja lo que ya tiene; baja solo si es más nuevo;
 *  - un corte a mitad de guardar deja el catálogo anterior intacto;
 *  - un catálogo roto no sustituye a uno bueno;
 *  - lo que llega por la wifi del coro se aplica igual (solo si es más nuevo).
 */
import {
  CatalogStore,
  FILE_CURRENT,
  FILE_PREVIOUS,
  FILE_TMP,
} from '@/services/catalog/store';
import { memoryFiles } from '@/services/catalog/filesTypes';
import type { Catalog } from '@/services/catalog/types';

const songs = (n: number, tag = '') => ({
  entrada: {
    categoryTitle: 'A. Entrada',
    songs: Array.from({ length: n }, (_, i) => ({
      title: `Canción ${i}${tag}`,
      filename: `c${i}.cho`,
      content: `[C]letra ${i}${tag}`,
    })),
  },
});

const T1 = 1_700_000_000_000;
const T2 = 1_800_000_000_000;

function makeRemote(db: Record<string, unknown>) {
  const read = jest.fn(async (path: string) => (path in db ? db[path] : null));
  return { read };
}

function make(opts: {
  files?: ReturnType<typeof memoryFiles>;
  db?: Record<string, unknown>;
  seed?: Catalog | null;
  now?: () => number;
}) {
  const files = opts.files ?? memoryFiles();
  const remote = makeRemote(opts.db ?? {});
  const store = new CatalogStore({
    files,
    remote,
    seed: () => opts.seed ?? null,
    now: opts.now ?? (() => T2),
    sleep: async () => {},
    timeoutMs: 50,
  });
  return { store, files, remote };
}

const seedCatalog: Catalog = {
  v: 1,
  songs: { updatedAt: T1, data: songs(3) },
};

describe('arranque', () => {
  it('sin nada guardado usa la semilla y la copia al disco', async () => {
    const { store, files } = make({ seed: seedCatalog });
    await store.init();
    expect(store.getState().ready).toBe(true);
    expect(store.getState().catalog?.songs?.updatedAt).toBe(T1);
    expect(JSON.parse(files.files.get(FILE_CURRENT)!).songs.updatedAt).toBe(T1);
  });

  it('con lo guardado más nuevo que la semilla, lo guardado', async () => {
    const files = memoryFiles({
      [FILE_CURRENT]: JSON.stringify({
        v: 1,
        songs: { updatedAt: T2, data: songs(5) },
      }),
    });
    const { store } = make({ files, seed: seedCatalog });
    await store.init();
    expect(store.getState().catalog?.songs?.updatedAt).toBe(T2);
  });

  it('si se cortó entre quitar el actual y poner el nuevo, usa el temporal', async () => {
    const files = memoryFiles({
      [FILE_TMP]: JSON.stringify({
        v: 1,
        songs: { updatedAt: T2, data: songs(4) },
      }),
      [FILE_PREVIOUS]: JSON.stringify({
        v: 1,
        songs: { updatedAt: T1, data: songs(3) },
      }),
    });
    const { store } = make({ files });
    await store.init();
    expect(store.getState().catalog?.songs?.updatedAt).toBe(T2);
  });

  it('un actual corrupto cae al anterior', async () => {
    const files = memoryFiles({
      [FILE_CURRENT]: '{"v":1,"songs":',
      [FILE_PREVIOUS]: JSON.stringify({
        v: 1,
        songs: { updatedAt: T1, data: songs(3) },
      }),
    });
    const { store } = make({ files });
    await store.init();
    expect(store.getState().catalog?.songs?.updatedAt).toBe(T1);
  });
});

describe('refresco', () => {
  it('no baja si el remoto es igual', async () => {
    const { store, remote } = make({
      seed: seedCatalog,
      db: { 'songs/updatedAt': T1, 'songs/data': songs(9) },
    });
    const r = await store.refresh();
    expect(r.status).toBe('unchanged');
    expect(remote.read).not.toHaveBeenCalledWith('songs/data');
  });

  it('no baja si el remoto es menor', async () => {
    const { store, remote } = make({
      seed: { v: 1, songs: { updatedAt: T2, data: songs(3) } },
      db: { 'songs/updatedAt': T1, 'songs/data': songs(9) },
    });
    expect((await store.refresh()).status).toBe('unchanged');
    expect(remote.read).not.toHaveBeenCalledWith('songs/data');
  });

  it('baja si es mayor, lo guarda y dice qué hay de nuevo', async () => {
    const { store, files } = make({
      seed: seedCatalog,
      db: { 'songs/updatedAt': T2 / 1000, 'songs/data': songs(4) },
    });
    const r = await store.refresh();
    expect(r.status).toBe('updated');
    if (r.status === 'updated') expect(r.diff?.added).toHaveLength(1);
    expect(store.getState().catalog?.songs?.updatedAt).toBe(T2);
    expect(JSON.parse(files.files.get(FILE_CURRENT)!).songs.updatedAt).toBe(T2);
    expect(JSON.parse(files.files.get(FILE_PREVIOUS)!).songs.updatedAt).toBe(
      T1,
    );
  });

  it('un cantoral vacío o mucho más pequeño se rechaza y se queda el bueno', async () => {
    const { store } = make({
      seed: { v: 1, songs: { updatedAt: T1, data: songs(10) } },
      db: { 'songs/updatedAt': T2, 'songs/data': songs(2) },
    });
    const r = await store.refresh();
    expect(r).toEqual({ status: 'rejected', reason: 'demasiado pequeño' });
    expect(store.getState().catalog?.songs?.updatedAt).toBe(T1);
  });

  it('un corte al guardar deja el catálogo anterior en el disco', async () => {
    const files = memoryFiles();
    const { store } = make({
      files,
      seed: seedCatalog,
      db: { 'songs/updatedAt': T2, 'songs/data': songs(4) },
    });
    await store.init();
    const before = files.files.get(FILE_CURRENT);
    // El disco «se corta» al mover el temporal a su sitio.
    files.move = jest.fn(async () => {
      throw new Error('corte');
    });
    await store.refresh();
    expect(files.files.get(FILE_CURRENT)).toBe(before);
  });

  it('sin red: lo que hay sigue y avisa de que no hay conexión', async () => {
    const { store, remote } = make({ seed: seedCatalog });
    remote.read.mockRejectedValue(new Error('sin red'));
    const r = await store.refresh();
    expect(r.status).toBe('offline');
    expect(store.getState().offline).toBe(true);
    expect(store.getState().catalog?.songs?.updatedAt).toBe(T1);
  });

  it('una red colgada se corta por tiempo y se reintenta', async () => {
    const { store, remote } = make({ seed: seedCatalog });
    remote.read.mockImplementation(() => new Promise(() => {}));
    const r = await store.refresh();
    expect(r.status).toBe('offline');
    // 1 intento + 3 reintentos de `songs/updatedAt`, como mínimo.
    expect(
      remote.read.mock.calls.filter((c) => c[0] === 'songs/updatedAt').length,
    ).toBe(4);
  });

  it('como mucho cada 15 min, salvo que se fuerce', async () => {
    let now = T2;
    const { store, remote } = make({
      seed: seedCatalog,
      db: { 'songs/updatedAt': T1 },
      now: () => now,
    });
    await store.refresh();
    const calls = remote.read.mock.calls.length;
    now += 60_000;
    expect((await store.refresh()).status).toBe('skipped');
    expect(remote.read.mock.calls.length).toBe(calls);
    expect((await store.refresh({ force: true })).status).toBe('unchanged');
  });

  it('en directo: la canción que se ve cambia de contenido pero no de sitio', async () => {
    const { store } = make({
      seed: seedCatalog,
      db: { 'songs/updatedAt': T2, 'songs/data': songs(3, ' corregida') },
    });
    await store.init();
    const before = store.getState().catalog!.songs!.data.entrada.songs[1];
    await store.refresh();
    const after = store.getState().catalog!.songs!.data.entrada.songs[1];
    expect(after.filename).toBe(before.filename);
    expect(after.content).toContain('corregida');
    expect(store.getState().lastDiff?.changed).toHaveLength(3);
  });
});

describe('cantoral que llega por la wifi del coro', () => {
  it('se aplica si es más nuevo y no si es igual o más viejo', async () => {
    const { store } = make({ seed: seedCatalog });
    expect(
      await store.applyExternal({
        v: 1,
        songs: { updatedAt: T1, data: songs(5) },
      }),
    ).toBe(false);
    expect(
      await store.applyExternal({
        v: 1,
        songs: { updatedAt: T2, data: songs(5) },
      }),
    ).toBe(true);
    expect(store.getState().catalog?.songs?.updatedAt).toBe(T2);
  });
});
