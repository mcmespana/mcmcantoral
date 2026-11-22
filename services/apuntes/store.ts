/**
 * Almacén de apuntes (`05` §7): un fichero JSON por canción
 * (`apuntes/<categoría>~<fichero>.json`) más `capas.json` con las capas
 * escondidas. Se carga por canción al abrirla; en memoria, un índice.
 */
import type { CatalogFiles } from '@/services/catalog/filesTypes';
import { logger } from '@/utils/logger';
import {
  parseApunte,
  songKey,
  type Apunte,
  type ApunteLayer,
  type ApunteSong,
} from './model';

export interface ApuntesState {
  /** Apuntes por canción (`songKey`), los cargados. */
  bySong: Record<string, Apunte[]>;
  /** Capas que este dispositivo NO quiere ver. */
  hidden: ApunteLayer[];
  version: number;
}

const LAYERS_FILE = 'capas.json';

/** Nombre de fichero seguro para una canción. */
export function fileFor(song: ApunteSong): string {
  return `${encodeURIComponent(songKey(song)).replace(/%2F/gi, '~')}.json`;
}

export class ApuntesStore {
  private state: ApuntesState = { bySong: {}, hidden: [], version: 0 };
  private listeners = new Set<() => void>();
  private loading = new Map<string, Promise<Apunte[]>>();
  private layersLoaded: Promise<void> | null = null;

  constructor(private readonly files: CatalogFiles) {}

  getState = (): ApuntesState => this.state;

  subscribe = (l: () => void): (() => void) => {
    this.listeners.add(l);
    return () => {
      this.listeners.delete(l);
    };
  };

  private set(patch: Partial<ApuntesState>) {
    this.state = { ...this.state, ...patch, version: this.state.version + 1 };
    this.listeners.forEach((l) => l());
  }

  /** Lo de una canción (lo cargado; vacío si aún no). */
  get(song: ApunteSong): Apunte[] {
    return this.state.bySong[songKey(song)] ?? [];
  }

  /** Carga los apuntes de una canción (una vez) y las capas. */
  load(song: ApunteSong): Promise<Apunte[]> {
    void this.loadLayers();
    const key = songKey(song);
    if (this.state.bySong[key]) return Promise.resolve(this.state.bySong[key]);
    let p = this.loading.get(key);
    if (!p) {
      p = this.files
        .read(fileFor(song))
        .then((text) => {
          const list = text ? this.parseList(text) : [];
          // Si mientras tanto se añadió algo, se juntan.
          const now = this.state.bySong[key] ?? [];
          const merged = mergeById(list, now);
          this.set({ bySong: { ...this.state.bySong, [key]: merged } });
          return merged;
        })
        .catch((e) => {
          logger.warn('[apuntes] leer', e);
          return [];
        });
      this.loading.set(key, p);
    }
    return p;
  }

  private parseList(text: string): Apunte[] {
    try {
      const raw = JSON.parse(text) as unknown;
      const arr = Array.isArray(raw) ? raw : [];
      return arr
        .map((r) => {
          const a = parseApunte(r);
          if (a && (r as Apunte).orphan) a.orphan = true;
          return a;
        })
        .filter((a): a is Apunte => !!a);
    } catch {
      return [];
    }
  }

  private persist(song: ApunteSong) {
    const list = this.get(song);
    const name = fileFor(song);
    const op = list.length
      ? this.files.write(name, JSON.stringify(list))
      : this.files.remove(name);
    op.catch((e) => logger.warn('[apuntes] guardar', e));
  }

  /** Sustituye los de una canción (p. ej. tras recolocarlos). */
  replace(song: ApunteSong, list: Apunte[]): void {
    const key = songKey(song);
    this.set({ bySong: { ...this.state.bySong, [key]: list } });
    this.persist(song);
  }

  upsert(a: Apunte): void {
    const list = this.get(a.song);
    const i = list.findIndex((x) => x.id === a.id);
    const next =
      i >= 0 ? list.map((x) => (x.id === a.id ? a : x)) : [...list, a];
    this.replace(a.song, next);
  }

  remove(song: ApunteSong, id: string): void {
    this.replace(
      song,
      this.get(song).filter((x) => x.id !== id),
    );
  }

  /**
   * Apuntes que llegan de fuera (repertorio importado, directo): se juntan
   * por `id`, gana el más reciente. Nunca entran los de «Solo yo» ajenos.
   */
  async importMany(list: Apunte[]): Promise<number> {
    const bySong = new Map<string, Apunte[]>();
    for (const a of list) {
      if (a.layer === 'yo') continue;
      const k = songKey(a.song);
      bySong.set(k, [...(bySong.get(k) ?? []), a]);
    }
    let n = 0;
    for (const items of bySong.values()) {
      const song = items[0].song;
      const current = await this.load(song);
      const merged = mergeById(current, items);
      n += merged.length - current.length;
      this.replace(song, merged);
    }
    return n;
  }

  // ── Capas visibles ──
  private loadLayers(): Promise<void> {
    if (!this.layersLoaded) {
      this.layersLoaded = this.files
        .read(LAYERS_FILE)
        .then((text) => {
          if (!text) return;
          const raw = JSON.parse(text) as unknown;
          if (Array.isArray(raw)) {
            this.set({
              hidden: raw.filter(
                (x): x is ApunteLayer => typeof x === 'string',
              ),
            });
          }
        })
        .catch(() => {});
    }
    return this.layersLoaded;
  }

  setHidden(hidden: ApunteLayer[]): void {
    this.set({ hidden });
    this.files
      .write(LAYERS_FILE, JSON.stringify(hidden))
      .catch((e) => logger.warn('[apuntes] capas', e));
  }
}

/** Junta dos listas por `id`: gana el `updatedAt` mayor. */
export function mergeById(a: Apunte[], b: Apunte[]): Apunte[] {
  const map = new Map<string, Apunte>();
  for (const x of [...a, ...b]) {
    const prev = map.get(x.id);
    if (!prev || x.updatedAt >= prev.updatedAt) map.set(x.id, x);
  }
  return [...map.values()];
}
