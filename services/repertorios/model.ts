/**
 * Repertorios (`docs/planes/fork-cantoral/02-datos-offline.md` §5-§6): lo que
 * en MCM App es «Tu selección», pero varios, con nombre, fecha, evento, coro,
 * pausas y notas por canción. Es el MISMO formato que los bloques de
 * villancicos (`songs/packs`), así un bloque **es** un repertorio de solo
 * lectura que se puede duplicar.
 *
 * Lógica PURA: conversión con la selección de siempre (`SelectedSong`), con
 * los packs y con lo que se comparte (v2 de MCM App + v3 aditivo).
 */
import type { SelectedSong } from '@/contexts/SelectedSongsContext';
import { parseDuration } from '@/utils/songCategories';

export type RepertorioSongItem = {
  type?: 'song';
  /** Categoría de CASA de la canción. */
  category: string;
  filename: string;
  /** Título que traía (para pintar sin catálogo y para los packs). */
  title?: string;
  /** Tono del día (texto, como en los packs: «Am»). */
  key?: string;
  /** Cejilla del día. */
  capo?: number;
  /** Semitonos sobre el tono original. */
  transpose?: number;
  /** Nota de ese día («🎺», «solo voces»). */
  notes?: string;
  duration?: string;
};

export type RepertorioBreakItem = {
  type: 'break';
  title: string;
  minutes?: number;
};

export type RepertorioItem = RepertorioSongItem | RepertorioBreakItem;

/**
 * Enlace de un repertorio con la nube (`/playlistShares/<código>`): de dónde
 * vino o dónde se subió. Cada repertorio tiene el suyo.
 */
export interface PlaylistLink {
  /** Código de 4 dígitos bajo el que vive en `/playlistShares`. */
  code: string;
  /** Nombre con el que se subió («Eucaristía 7 ago»). */
  name?: string;
  choirId?: string;
  choirName?: string;
  /**
   * Firma (`playlistSignature`) de la selección en el momento de subirla o
   * importarla. Si la firma actual difiere, hay cambios sin guardar.
   */
  signature: string;
  /** Cuándo se sincronizó por última vez. */
  syncedAt: number;
  /** ¿La subimos desde este dispositivo? Entonces actualizarla no pide contraseña. */
  owned: boolean;
}

export interface Repertorio {
  id: string;
  name: string;
  event?: string;
  /** `YYYY-MM-DD`. */
  date?: string;
  choir?: { id: string; name: string };
  targetMinutes?: number;
  items: RepertorioItem[];
  source?: { kind: 'pack' | 'cloud' | 'live' | 'file'; ref: string };
  /** Los bloques del cantoral no se editan: se duplican. */
  readOnly?: boolean;
  /** Enlace con la nube (repertorio compartido o importado). */
  link?: PlaylistLink | null;
  updatedAt: number;
}

export const isBreak = (i: RepertorioItem): i is RepertorioBreakItem =>
  i.type === 'break';
export const isSong = (i: RepertorioItem): i is RepertorioSongItem =>
  i.type !== 'break';

/** Id corto y suficientemente único para un dispositivo. */
export function newId(now: number, rand: () => number = Math.random): string {
  return `${now.toString(36)}${Math.floor(rand() * 1e8)
    .toString(36)
    .padStart(5, '0')}`;
}

export function newRepertorio(
  name: string,
  now: number,
  id: string = newId(now),
): Repertorio {
  return { id, name: name.trim() || 'Repertorio', items: [], updatedAt: now };
}

// ─── Selección de siempre ⇄ repertorio ───────────────────────────────────────

/**
 * Las canciones del repertorio como la selección de MCM App (lo que pintan y
 * editan las pantallas heredadas). Las pausas no salen aquí: se conservan en
 * el repertorio.
 */
export function toSelection(rep: Repertorio, now = 0): SelectedSong[] {
  return rep.items.filter(isSong).map((s, order) => ({
    filename: s.filename,
    transpose: s.transpose ?? 0,
    capoOverride: s.capo ?? null,
    order,
    categoryHint: s.category || undefined,
    addedAt: now + order,
  }));
}

/**
 * Aplica una selección editada al repertorio SIN perder lo que la selección
 * no sabe guardar: pausas (en su sitio relativo), notas, tono y duración.
 * Las canciones nuevas se añaden; las quitadas, fuera; el orden de las
 * canciones es el de la selección y cada pausa se queda delante de la
 * canción que tenía detrás.
 */
export function applySelection(
  rep: Repertorio,
  selection: SelectedSong[],
  now: number,
): Repertorio {
  const sorted = [...selection].sort((a, b) => a.order - b.order);
  const old = new Map(
    rep.items.filter(isSong).map((s) => [s.filename, s] as const),
  );
  // Pausas ancladas a la canción que las sigue (o al final).
  const breaksBefore = new Map<string | null, RepertorioBreakItem[]>();
  let pending: RepertorioBreakItem[] = [];
  for (const item of rep.items) {
    if (isBreak(item)) pending.push(item);
    else {
      if (pending.length) breaksBefore.set(item.filename, pending);
      pending = [];
    }
  }
  if (pending.length) breaksBefore.set(null, pending);

  const items: RepertorioItem[] = [];
  const placed = new Set<string>();
  for (const sel of sorted) {
    const prev = old.get(sel.filename);
    const anchored = breaksBefore.get(sel.filename);
    if (anchored) {
      items.push(...anchored);
      placed.add(sel.filename);
    }
    items.push({
      ...(prev ?? {}),
      category: prev?.category || sel.categoryHint || '',
      filename: sel.filename,
      // La selección lleva el tono y la cejilla actuales: mandan ellos.
      transpose: sel.transpose || undefined,
      capo: sel.capoOverride ?? undefined,
      ...(prev?.type ? { type: prev.type } : {}),
    });
  }
  // Pausas cuya canción se ha quitado: al final, para no perderlas.
  for (const [anchor, list] of breaksBefore) {
    if (anchor !== null && !placed.has(anchor)) items.push(...list);
  }
  items.push(...(breaksBefore.get(null) ?? []));
  return { ...rep, items: clean(items), updatedAt: now };
}

/** Quita `undefined` (Firebase y JSON no los quieren) y `capo: null`. */
function clean(items: RepertorioItem[]): RepertorioItem[] {
  return items.map((it) => {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(it)) {
      // `category` va siempre (aunque vacía: canción de MCM App sin pista).
      if (k === 'category' || (v !== undefined && v !== null && v !== '')) {
        out[k] = v ?? '';
      }
    }
    return out as RepertorioItem;
  });
}

// ─── Bloques del cantoral (`songs/packs`) ────────────────────────────────────

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function parseItem(raw: unknown): RepertorioItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (r.type === 'break') {
    const title = str(r.title);
    if (!title) return null;
    return {
      type: 'break',
      title,
      ...(typeof r.minutes === 'number' ? { minutes: r.minutes } : {}),
    };
  }
  const filename = str(r.filename);
  if (!filename) return null;
  const item: RepertorioSongItem = {
    category: str(r.category) ?? '',
    filename,
  };
  if (str(r.title)) item.title = str(r.title);
  if (str(r.key)) item.key = str(r.key);
  if (typeof r.capo === 'number' && r.capo > 0) item.capo = r.capo;
  if (typeof r.transpose === 'number' && r.transpose !== 0) {
    item.transpose = r.transpose;
  }
  if (str(r.notes)) item.notes = str(r.notes);
  if (str(r.duration)) item.duration = str(r.duration);
  return item;
}

/** Los bloques publicados en `songs/packs/data`, como repertorios de solo lectura. */
export function parsePacks(raw: unknown): Repertorio[] {
  if (!raw || typeof raw !== 'object') return [];
  const out: Repertorio[] = [];
  for (const [id, value] of Object.entries(raw as Record<string, unknown>)) {
    if (!value || typeof value !== 'object') continue;
    const v = value as Record<string, unknown>;
    const items = Array.isArray(v.items)
      ? v.items.map(parseItem).filter((x): x is RepertorioItem => !!x)
      : [];
    out.push({
      id: `pack:${id}`,
      name: str(v.title) ?? id,
      ...(str(v.event) ? { event: str(v.event) } : {}),
      ...(str(v.date) ? { date: str(v.date) } : {}),
      ...(typeof v.targetMinutes === 'number'
        ? { targetMinutes: v.targetMinutes }
        : {}),
      items,
      source: { kind: 'pack', ref: id },
      readOnly: true,
      updatedAt: 0,
    });
  }
  return out;
}

/** Copia editable de un repertorio (un bloque, uno compartido…). */
export function duplicate(
  rep: Repertorio,
  now: number,
  id?: string,
): Repertorio {
  return {
    ...rep,
    id: id ?? newId(now),
    name: rep.readOnly ? rep.name : `${rep.name} (copia)`,
    readOnly: undefined,
    link: undefined,
    items: rep.items.map((i) => ({ ...i })),
    updatedAt: now,
  };
}

// ─── Duración ────────────────────────────────────────────────────────────────

/**
 * Duración de un repertorio: canciones (la del día o la del catálogo) +
 * pausas. `lookup` da la del catálogo si el elemento no la trae.
 */
export function repertorioSeconds(
  rep: Repertorio,
  lookup?: (item: RepertorioSongItem) => string | undefined,
): { seconds: number; unknownSongs: number } {
  let seconds = 0;
  let unknownSongs = 0;
  for (const item of rep.items) {
    if (isBreak(item)) {
      seconds += (item.minutes ?? 0) * 60;
      continue;
    }
    const d = parseDuration(item.duration ?? lookup?.(item));
    if (d === null) unknownSongs += 1;
    else seconds += d;
  }
  return { seconds, unknownSongs };
}

// ─── Compartir sin romper MCM App ────────────────────────────────────────────

/**
 * Lo que se sube a `/playlistShares/<código>` o va en un `.mcm`: el `songs`
 * v2 que lee MCM App **y** `items` con lo nuevo (pausas, notas, evento).
 * MCM App ignora lo que no conoce.
 */
export function toShareFields(rep: Repertorio): {
  songs: SelectedSong[];
  items: RepertorioItem[];
  name: string;
  event?: string;
  date?: string;
} {
  return {
    songs: toSelection(rep),
    items: clean(rep.items),
    name: rep.name,
    ...(rep.event ? { event: rep.event } : {}),
    ...(rep.date ? { date: rep.date } : {}),
  };
}

/**
 * Lee lo compartido: `items` si viene (MCM Cantoral), y si no, el `songs`
 * v2 de MCM App.
 */
export function fromShared(
  raw: unknown,
  opts: {
    id: string;
    now: number;
    source: Repertorio['source'];
    name?: string;
  },
): Repertorio | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  let items: RepertorioItem[] = [];
  if (Array.isArray(r.items)) {
    items = r.items.map(parseItem).filter((x): x is RepertorioItem => !!x);
  } else if (Array.isArray(r.songs)) {
    const seen = new Set<string>();
    items = (r.songs as Partial<SelectedSong>[])
      .filter((s) => s && typeof s.filename === 'string')
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      // Sin duplicados (se colaban al importar en MCM App).
      .filter((s) => (seen.has(s.filename!) ? false : !!seen.add(s.filename!)))
      .map((s) => ({
        category: s.categoryHint ?? '',
        filename: s.filename!,
        ...(s.transpose ? { transpose: s.transpose } : {}),
        ...(typeof s.capoOverride === 'number' ? { capo: s.capoOverride } : {}),
      }));
  } else {
    return null;
  }
  return {
    id: opts.id,
    name: str(r.name) ?? opts.name ?? 'Repertorio importado',
    ...(str(r.event) ? { event: str(r.event) } : {}),
    ...(str(r.date) ? { date: str(r.date) } : {}),
    items: clean(items),
    source: opts.source,
    updatedAt: opts.now,
  };
}
