/**
 * Almacén de repertorios: un fichero por repertorio (`repertorios/<id>.json`)
 * y un índice (`repertorios/indice.json`) con el orden y cuál está activo
 * (`02-datos-offline.md` §5). El activo es el que editan las pantallas de
 * siempre («Tu selección»): `SelectedSongsContext` lo lee y lo escribe.
 *
 * La primera vez migra la selección de MCM App (`@mcm_playlist_v2`) a un
 * repertorio, para que nadie pierda lo que tenía.
 *
 * Disco y reloj por constructor (`__tests__/repertoriosStore.test.ts`).
 */
import { logger } from '@/utils/logger';
import type { CatalogFiles } from '@/services/catalog/filesTypes';
import {
  duplicate as duplicateModel,
  newRepertorio,
  type Repertorio,
} from './model';

const INDEX = 'indice.json';

interface StoredIndex {
  v: 1;
  ids: string[];
  activeId: string | null;
}

export interface RepertoriosState {
  ready: boolean;
  /** Los del dispositivo, en su orden (el primero, el más reciente). */
  list: Repertorio[];
  activeId: string | null;
  version: number;
}

export interface RepertoriosDeps {
  files: CatalogFiles;
  now?: () => number;
  /** Lo que había en MCM App, para migrarlo la primera vez. */
  legacy?: () => Promise<Repertorio | null>;
}

const fileOf = (id: string) => `${id.replace(/[^a-zA-Z0-9_-]/g, '_')}.json`;

export class RepertoriosStore {
  private state: RepertoriosState = {
    ready: false,
    list: [],
    activeId: null,
    version: 0,
  };
  private listeners = new Set<() => void>();
  private initPromise: Promise<void> | null = null;
  private writes: Promise<void> = Promise.resolve();
  private readonly deps: Required<Omit<RepertoriosDeps, 'legacy'>> &
    Pick<RepertoriosDeps, 'legacy'>;

  constructor(deps: RepertoriosDeps) {
    this.deps = { now: () => Date.now(), ...deps };
  }

  getState = (): RepertoriosState => this.state;

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  private set(patch: Partial<RepertoriosState>) {
    this.state = { ...this.state, ...patch, version: this.state.version + 1 };
    this.listeners.forEach((l) => l());
  }

  init(): Promise<void> {
    if (!this.initPromise) this.initPromise = this.load();
    return this.initPromise;
  }

  private async load(): Promise<void> {
    const { files } = this.deps;
    let index: StoredIndex | null = null;
    try {
      const raw = await files.read(INDEX);
      index = raw ? (JSON.parse(raw) as StoredIndex) : null;
    } catch (e) {
      logger.warn('[repertorios] índice ilegible', e);
    }
    const list: Repertorio[] = [];
    for (const id of index?.ids ?? []) {
      try {
        const raw = await files.read(fileOf(id));
        if (raw) list.push(JSON.parse(raw) as Repertorio);
      } catch (e) {
        logger.warn(`[repertorios] ${id} ilegible`, e);
      }
    }
    let activeId = index?.activeId ?? null;
    if (!index) {
      // Primera vez: lo de MCM App (o uno vacío) pasa a ser el repertorio activo.
      const legacy = (await this.deps.legacy?.().catch(() => null)) ?? null;
      const first = legacy ?? newRepertorio('Mi repertorio', this.deps.now());
      list.push(first);
      activeId = first.id;
      this.set({ list, activeId, ready: true });
      this.persistAll();
      return;
    }
    if (activeId && !list.some((r) => r.id === activeId)) {
      activeId = list[0]?.id ?? null;
    }
    this.set({ list, activeId, ready: true });
  }

  /** Escrituras en cola: nunca dos a la vez sobre el mismo fichero. */
  private enqueue(job: () => Promise<void>) {
    this.writes = this.writes.then(job).catch((e) => {
      logger.warn('[repertorios] no se pudo guardar', e);
    });
    return this.writes;
  }

  private persistIndex() {
    const index: StoredIndex = {
      v: 1,
      ids: this.state.list.map((r) => r.id),
      activeId: this.state.activeId,
    };
    return this.enqueue(() =>
      this.deps.files.write(INDEX, JSON.stringify(index)),
    );
  }

  private persistOne(rep: Repertorio) {
    return this.enqueue(async () => {
      const name = fileOf(rep.id);
      await this.deps.files.write(`${name}.tmp`, JSON.stringify(rep));
      await this.deps.files.move(`${name}.tmp`, name);
    });
  }

  private persistAll() {
    this.state.list.forEach((r) => void this.persistOne(r));
    return this.persistIndex();
  }

  /** Espera a que se haya guardado todo (tests y al salir). */
  flush(): Promise<void> {
    return this.writes;
  }

  get(id: string | null): Repertorio | undefined {
    return id ? this.state.list.find((r) => r.id === id) : undefined;
  }

  getActive(): Repertorio | undefined {
    return this.get(this.state.activeId);
  }

  /** Crea uno (vacío o a partir de otro) y lo deja activo y el primero. */
  create(
    nameOrRep: string | Repertorio,
    opts: { activate?: boolean } = { activate: true },
  ): Repertorio {
    const now = this.deps.now();
    const rep =
      typeof nameOrRep === 'string'
        ? newRepertorio(nameOrRep, now)
        : { ...nameOrRep, readOnly: undefined, updatedAt: now };
    const list = [rep, ...this.state.list.filter((r) => r.id !== rep.id)];
    this.set({
      list,
      activeId: opts.activate === false ? this.state.activeId : rep.id,
    });
    void this.persistOne(rep);
    void this.persistIndex();
    return rep;
  }

  /** Copia editable (de un bloque del cantoral, por ejemplo). */
  duplicate(rep: Repertorio): Repertorio {
    return this.create(duplicateModel(rep, this.deps.now()));
  }

  update(id: string, fn: (rep: Repertorio) => Repertorio): void {
    const current = this.get(id);
    if (!current || current.readOnly) return;
    const next = { ...fn(current), id, updatedAt: this.deps.now() };
    this.set({
      list: this.state.list.map((r) => (r.id === id ? next : r)),
    });
    void this.persistOne(next);
  }

  rename(id: string, name: string): void {
    const clean = name.trim();
    if (!clean) return;
    this.update(id, (r) => ({ ...r, name: clean }));
  }

  setActive(id: string): void {
    if (!this.get(id) || this.state.activeId === id) return;
    this.set({ activeId: id });
    void this.persistIndex();
  }

  remove(id: string): void {
    const list = this.state.list.filter((r) => r.id !== id);
    let activeId = this.state.activeId;
    if (activeId === id) activeId = list[0]?.id ?? null;
    if (list.length === 0) {
      // Siempre queda uno donde ir añadiendo canciones.
      const empty = newRepertorio('Mi repertorio', this.deps.now());
      list.push(empty);
      activeId = empty.id;
      void this.persistOne(empty);
    }
    this.set({ list, activeId });
    void this.enqueue(() => this.deps.files.remove(fileOf(id)));
    void this.persistIndex();
  }

  /** Solo para tests: vuelve a empezar (con otro disco si se da). */
  __reset(files?: CatalogFiles): void {
    if (files) (this.deps as { files: CatalogFiles }).files = files;
    this.initPromise = null;
    this.writes = Promise.resolve();
    this.state = { ready: false, list: [], activeId: null, version: 0 };
    this.listeners.forEach((l) => l());
  }
}
