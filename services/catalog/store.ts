/**
 * `CatalogStore`: el almacén único del cantoral en el dispositivo
 * (`02-datos-offline.md` §3). Las pantallas leen de aquí, nunca de Firebase.
 *
 *  - **Nunca vacío**: arranca con lo guardado o con la semilla del binario
 *    (lo más nuevo de los dos, nodo a nodo).
 *  - **Nunca re-baja** lo que ya tiene: solo si el `updatedAt` remoto es
 *    mayor (comparación numérica).
 *  - **Escritura atómica**: `nuevo.json.tmp` → se relee y valida → el actual
 *    pasa a `anterior.json` → el temporal pasa a `actual.json` → `meta`. Un
 *    corte a mitad deja el catálogo anterior intacto.
 *  - **No se congela en directo** (D-21): un cantoral nuevo se aplica al
 *    momento; quien pinta una canción la repinta en el mismo sitio.
 *
 * Todo lo externo (disco, red, reloj, esperas, semilla) entra por
 * constructor: `__tests__/catalogStore.test.ts` lo prueba sin nada de eso.
 */
import { logger } from '@/utils/logger';
import type { SongsData } from '@/utils/filterSongsData';
import type { CatalogFiles } from './filesTypes';
import {
  countSongs,
  diffSongs,
  DOWNLOAD_TIMEOUT_MS,
  mergeNewest,
  parseCatalog,
  retryDelay,
  shouldCheck,
  shouldDownload,
  toMs,
  validateSongs,
} from './logic';
import {
  CATALOG_NODES,
  NODE_PATHS,
  type Catalog,
  type CatalogDiff,
  type CatalogMeta,
  type CatalogNodeName,
  type CatalogRemoteMeta,
} from './types';

export const FILE_CURRENT = 'actual.json';
export const FILE_META = 'actual.meta.json';
export const FILE_PREVIOUS = 'anterior.json';
export const FILE_TMP = 'nuevo.json.tmp';

/** Lo que el almacén necesita de Firebase (o de un doble en los tests). */
export interface CatalogRemote {
  /** El valor de una ruta (`songs/updatedAt`, `songs/data`…); `null` si no hay. */
  read(path: string): Promise<unknown>;
}

export interface CatalogDeps {
  files: CatalogFiles;
  remote: CatalogRemote;
  /** La semilla empaquetada (puede venir vacía en desarrollo). */
  seed: () => Catalog | null;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  timeoutMs?: number;
}

export interface CatalogState {
  catalog: Catalog | null;
  /** Ya se ha leído lo local (o la semilla): se puede pintar. */
  ready: boolean;
  /** Mirando la nube ahora mismo. */
  checking: boolean;
  /** La última vez que se miró la nube (con o sin éxito). */
  lastCheckAt: number | null;
  /** La última comprobación falló por red. */
  offline: boolean;
  /** Último cambio aplicado (para el aviso discreto). */
  lastDiff: CatalogDiff | null;
  /** Sube en cada cambio: sirve de clave para memorizar. */
  version: number;
}

export type RefreshResult =
  | { status: 'skipped' }
  | { status: 'unchanged' }
  | { status: 'updated'; nodes: CatalogNodeName[]; diff: CatalogDiff | null }
  | { status: 'rejected'; reason: string }
  | { status: 'offline' };

class TimeoutError extends Error {
  constructor() {
    super('timeout');
    this.name = 'TimeoutError';
  }
}

export class CatalogStore {
  private state: CatalogState = {
    catalog: null,
    ready: false,
    checking: false,
    lastCheckAt: null,
    offline: false,
    lastDiff: null,
    version: 0,
  };
  private listeners = new Set<() => void>();
  private initPromise: Promise<void> | null = null;
  private refreshPromise: Promise<RefreshResult> | null = null;
  private readonly deps: Required<CatalogDeps>;

  constructor(deps: CatalogDeps) {
    this.deps = {
      now: () => Date.now(),
      sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
      timeoutMs: DOWNLOAD_TIMEOUT_MS,
      ...deps,
    };
  }

  getState = (): CatalogState => this.state;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  private set(patch: Partial<CatalogState>) {
    this.state = { ...this.state, ...patch, version: this.state.version + 1 };
    this.listeners.forEach((l) => l());
  }

  /** Lee lo guardado y la semilla. Idempotente: se puede llamar mil veces. */
  init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.load();
    return this.initPromise;
  }

  private async readCatalogFile(name: string): Promise<Catalog | null> {
    try {
      return parseCatalog(await this.deps.files.read(name));
    } catch (e) {
      logger.warn(`[catálogo] no se pudo leer ${name}`, e);
      return null;
    }
  }

  private async load(): Promise<void> {
    // El actual; si se cortó justo entre quitarlo y poner el nuevo, el
    // temporal (ya validado antes de moverlo) o el anterior.
    let local = await this.readCatalogFile(FILE_CURRENT);
    if (!local) local = await this.readCatalogFile(FILE_TMP);
    if (!local) local = await this.readCatalogFile(FILE_PREVIOUS);
    let seed: Catalog | null = null;
    try {
      seed = this.deps.seed();
    } catch (e) {
      logger.warn('[catálogo] semilla ilegible', e);
    }
    const catalog = mergeNewest(local, seed);
    const fromSeed =
      !!catalog?.songs &&
      catalog.songs === seed?.songs &&
      catalog.songs !== local?.songs;
    this.set({ catalog, ready: true });
    // La primera vez (o con una semilla más nueva que lo guardado) se copia
    // al disco, para no depender del binario la próxima vez.
    if (catalog && (fromSeed || !local)) {
      await this.persist(catalog, fromSeed ? 'seed' : 'local').catch((e) =>
        logger.warn('[catálogo] no se pudo guardar la semilla', e),
      );
    }
  }

  /** Escritura atómica (ver cabecera). Lanza si algo falla: lo de antes queda. */
  private async persist(
    catalog: Catalog,
    source: CatalogMeta['source'],
  ): Promise<void> {
    const { files } = this.deps;
    const text = JSON.stringify(catalog);
    await files.write(FILE_TMP, text);
    const back = parseCatalog(await files.read(FILE_TMP));
    if (!back) throw new Error('el temporal no se relee');
    const current = await files.read(FILE_CURRENT);
    if (current !== null) await files.move(FILE_CURRENT, FILE_PREVIOUS);
    await files.move(FILE_TMP, FILE_CURRENT);
    const meta: CatalogMeta = {
      songsUpdatedAt: catalog.songs?.updatedAt ?? 0,
      count: countSongs(catalog.songs?.data),
      savedAt: this.deps.now(),
      source,
    };
    await files.write(FILE_META, JSON.stringify(meta));
  }

  private async withTimeout<T>(p: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new TimeoutError()), this.deps.timeoutMs);
    });
    try {
      return await Promise.race([p, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  /** Lee una ruta con tiempo máximo y reintentos con espera creciente. */
  private async readRemote(path: string): Promise<unknown> {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.withTimeout(this.deps.remote.read(path));
      } catch (e) {
        const delay = retryDelay(attempt);
        if (delay === null) throw e;
        await this.deps.sleep(delay);
      }
    }
  }

  /**
   * Mira la nube y aplica lo que sea más nuevo. Como mucho cada 15 min salvo
   * `force` (tirar para actualizar). Nunca rechaza: devuelve qué pasó.
   */
  refresh(opts: { force?: boolean } = {}): Promise<RefreshResult> {
    if (this.refreshPromise) return this.refreshPromise;
    const now = this.deps.now();
    if (!shouldCheck(this.state.lastCheckAt, now, opts.force)) {
      return Promise.resolve({ status: 'skipped' });
    }
    this.refreshPromise = this.doRefresh().finally(() => {
      this.refreshPromise = null;
    });
    return this.refreshPromise;
  }

  private async doRefresh(): Promise<RefreshResult> {
    await this.init();
    this.set({ checking: true });
    try {
      const current = this.state.catalog ?? { v: 1 as const };
      // Solo los `updatedAt` (bytes): lo que no ha cambiado no se baja.
      const remoteDates = await Promise.all(
        CATALOG_NODES.map((n) => this.readRemote(`${NODE_PATHS[n]}/updatedAt`)),
      );
      const pending = CATALOG_NODES.filter((n, i) =>
        shouldDownload(current[n]?.updatedAt ?? 0, remoteDates[i]),
      );
      if (pending.length === 0) {
        this.set({ checking: false, offline: false, lastCheckAt: this.deps.now() });
        return { status: 'unchanged' };
      }
      const next: Catalog = { ...current };
      const applied: CatalogNodeName[] = [];
      for (const node of pending) {
        const data = await this.readRemote(`${NODE_PATHS[node]}/data`);
        if (data === null || data === undefined) continue;
        if (node === 'songs') {
          const meta = (await this.readRemote('songs/meta').catch(
            () => null,
          )) as CatalogRemoteMeta | null;
          const check = validateSongs(
            data,
            countSongs(current.songs?.data),
            meta,
          );
          if (!check.ok) {
            logger.warn(`[catálogo] cantoral rechazado: ${check.reason}`);
            this.set({ checking: false, lastCheckAt: this.deps.now() });
            return { status: 'rejected', reason: check.reason };
          }
        }
        const idx = CATALOG_NODES.indexOf(node);
        (next as unknown as Record<string, unknown>)[node] = {
          updatedAt: toMs(remoteDates[idx]),
          data,
        };
        applied.push(node);
      }
      if (applied.length === 0) {
        this.set({ checking: false, offline: false, lastCheckAt: this.deps.now() });
        return { status: 'unchanged' };
      }
      return await this.apply(next, applied, 'cloud');
    } catch (e) {
      logger.warn('[catálogo] sin conexión con la nube', e);
      this.set({ checking: false, offline: true, lastCheckAt: this.deps.now() });
      return { status: 'offline' };
    }
  }

  /** Guarda (atómico) y publica un catálogo nuevo; calcula qué cambió. */
  private async apply(
    next: Catalog,
    nodes: CatalogNodeName[],
    source: CatalogMeta['source'],
  ): Promise<RefreshResult> {
    const prev = this.state.catalog;
    const diff = nodes.includes('songs')
      ? diffSongs(prev?.songs?.data, next.songs?.data as SongsData | undefined)
      : null;
    try {
      await this.persist(next, source);
    } catch (e) {
      // Sin disco se sigue con el nuevo en memoria: mejor que nada.
      logger.warn('[catálogo] no se pudo guardar; queda en memoria', e);
    }
    this.set({
      catalog: next,
      checking: false,
      offline: false,
      lastCheckAt: this.deps.now(),
      lastDiff: diff,
    });
    return { status: 'updated', nodes, diff };
  }

  /**
   * Un catálogo que llega por otro camino (el maestro o el equipo base por la
   * wifi del coro, `04` §5.6). Se aplica nodo a nodo solo si es más nuevo y
   * pasa la misma validación. Devuelve si cambió algo.
   */
  async applyExternal(incoming: Catalog): Promise<boolean> {
    await this.init();
    const current = this.state.catalog ?? { v: 1 as const };
    const next: Catalog = { ...current };
    const nodes: CatalogNodeName[] = [];
    for (const node of CATALOG_NODES) {
      const inc = incoming[node];
      if (!inc) continue;
      if (inc.updatedAt <= (current[node]?.updatedAt ?? 0)) continue;
      if (node === 'songs') {
        const check = validateSongs(inc.data, countSongs(current.songs?.data));
        if (!check.ok) continue;
      }
      (next as unknown as Record<string, unknown>)[node] = inc;
      nodes.push(node);
    }
    if (!nodes.length) return false;
    await this.apply(next, nodes, 'local');
    return true;
  }

  /** Solo para tests: deja el catálogo tal cual, ya listo, sin disco ni red. */
  __setForTests(catalog: Catalog | null): void {
    this.initPromise = Promise.resolve();
    this.refreshPromise = null;
    this.set({
      catalog,
      ready: true,
      checking: false,
      offline: false,
      lastCheckAt: this.deps.now(),
      lastDiff: null,
    });
  }

  /**
   * Cambia `songs/data` en memoria YA (lo que uno mismo acaba de editar), sin
   * tocar `updatedAt`: en cuanto la nube publique la versión buena, manda ella.
   */
  patchSongs(patch: (data: SongsData) => SongsData | undefined): void {
    const current = this.state.catalog;
    if (!current?.songs) return;
    const data = patch(current.songs.data);
    if (data === undefined) return;
    this.set({
      catalog: { ...current, songs: { ...current.songs, data } },
    });
  }
}
