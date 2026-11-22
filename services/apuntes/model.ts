/**
 * Apuntes por capas (`docs/planes/fork-cantoral/05-apuntes-y-partituras.md`):
 * lo que cada uno se anota encima de la hoja —«respira aquí», «bajo: aquí
 * entras», «el 2º estribillo a capela»— sin tocar nunca el ChordPro.
 *
 * Un apunte se ANCLA a una línea del `.cho` por su número y por la huella de
 * su texto (normalizado), para seguir en su sitio cuando la canción cambia
 * (`reanchorNotes`). Lógica PURA, sin disco ni React.
 */
import {
  INSTRUMENTO_LABEL,
  contentHash,
  type Instrumento,
} from '@/services/live/protocol';

/** Para quién es un apunte (§2). */
export type ApunteLayer = 'yo' | 'todos' | `inst:${Instrumento}`;

/** Qué es (§3). El resaltado y los riffs ABC llegarán después. */
export type ApunteKind = 'texto' | 'marca' | 'acorde';

/** Marcas de un toque (§3). */
export const MARCAS = [
  'p',
  'mf',
  'f',
  'cresc.',
  'dim.',
  'a capela',
  'solo',
  'x2',
  '⟲',
] as const;

export interface ApunteSong {
  /** Categoría de CASA. */
  category: string;
  filename: string;
}

export interface Apunte {
  id: string;
  song: ApunteSong;
  /** Línea del `.cho` (índice de `content.split(/\r?\n/)`, como `data-line`). */
  line: number;
  /** Huella del texto normalizado de esa línea. */
  lineHash: string;
  /** El texto normalizado de la línea (para recolocar por parecido). */
  lineText: string;
  layer: ApunteLayer;
  kind: ApunteKind;
  text: string;
  author?: { deviceId?: string; name?: string };
  updatedAt: number;
  /** No se encontró su línea: se enseña al final («¿Dónde iba esto?»). */
  orphan?: boolean;
}

/** Clave de una canción para guardar sus apuntes. */
export function songKey(song: ApunteSong): string {
  return `${song.category || '_'}/${song.filename}`;
}

/** Las líneas del `.cho` como las numera la hoja. */
export function choLines(content: string): string[] {
  return content.split(/\r?\n/);
}

/**
 * Texto de una línea para compararla: sin acordes, directivas ni marcado, en
 * minúsculas, sin signos y con los espacios juntos.
 */
export function normalizeLine(raw: string | undefined): string {
  if (!raw) return '';
  const s = raw.trim();
  if (/^\{.*\}$/.test(s) || s.startsWith('#')) return '';
  return s
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/<\/?[a-z]+>/gi, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** El ancla de una línea de una canción. */
export function anchorFor(
  content: string,
  line: number,
): Pick<Apunte, 'line' | 'lineHash' | 'lineText'> {
  const text = normalizeLine(choLines(content)[line]);
  return { line, lineText: text, lineHash: contentHash(text) };
}

/** Etiqueta de una capa («Solo yo», «Todos», «Bajos»). */
export function layerLabel(layer: ApunteLayer): string {
  if (layer === 'yo') return 'Solo yo';
  if (layer === 'todos') return 'Todos';
  const inst = layer.slice(5) as Instrumento;
  return INSTRUMENTO_LABEL[inst] ?? inst;
}

/** Capas que se ven por defecto: Todos + mis instrumentos + Solo yo (§2). */
export function defaultVisibleLayers(inst: Instrumento[]): ApunteLayer[] {
  return ['todos', ...inst.map((i) => `inst:${i}` as ApunteLayer), 'yo'];
}

/** Los que se comparten dentro de un repertorio: Todos y de instrumento (§6). */
export function isShareable(a: Apunte): boolean {
  return a.layer !== 'yo';
}

/** Lo que llega de fuera (repertorio importado, directo) con forma de apunte. */
export function parseApunte(raw: unknown): Apunte | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const song = r.song as Record<string, unknown> | undefined;
  const layer = r.layer;
  const kind = r.kind;
  const validLayer =
    layer === 'yo' ||
    layer === 'todos' ||
    (typeof layer === 'string' &&
      layer.startsWith('inst:') &&
      layer.slice(5) in INSTRUMENTO_LABEL);
  if (
    typeof r.id !== 'string' ||
    !song ||
    typeof song.filename !== 'string' ||
    typeof r.line !== 'number' ||
    typeof r.text !== 'string' ||
    !validLayer ||
    (kind !== 'texto' && kind !== 'marca' && kind !== 'acorde')
  ) {
    return null;
  }
  return {
    id: r.id,
    song: {
      category: typeof song.category === 'string' ? song.category : '',
      filename: song.filename,
    },
    line: r.line,
    lineHash: typeof r.lineHash === 'string' ? r.lineHash : '',
    lineText: typeof r.lineText === 'string' ? r.lineText : '',
    layer: layer as ApunteLayer,
    kind,
    text: r.text.slice(0, 200),
    author:
      r.author && typeof r.author === 'object'
        ? (r.author as Apunte['author'])
        : undefined,
    updatedAt: typeof r.updatedAt === 'number' ? r.updatedAt : 0,
  };
}

// ─── Re-anclaje (§4) ─────────────────────────────────────────────────────────

/** Parecido de dos líneas por palabras (1 = iguales), con distancia de edición. */
export function lineSimilarity(a: string, b: string): number {
  const wa = a ? a.split(' ') : [];
  const wb = b ? b.split(' ') : [];
  if (!wa.length && !wb.length) return 1;
  if (!wa.length || !wb.length) return 0;
  let prev = Array.from({ length: wb.length + 1 }, (_, j) => j);
  for (let i = 1; i <= wa.length; i++) {
    const cur = [i];
    for (let j = 1; j <= wb.length; j++) {
      cur[j] = Math.min(
        prev[j] + 1,
        cur[j - 1] + 1,
        prev[j - 1] + (wa[i - 1] === wb[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return 1 - prev[wb.length] / Math.max(wa.length, wb.length);
}

/** Por debajo de esto, un apunte se queda huérfano (§4.3). */
export const REANCHOR_MIN = 0.7;

/**
 * Recoloca los apuntes en la versión actual de la canción (§4):
 *  1. misma línea con la misma huella → se queda;
 *  2. si no, la línea más parecida (≥ 70 %; a igualdad, la más cercana) →
 *     se mueve allí;
 *  3. si nada se parece → huérfano.
 * Devuelve apuntes nuevos (no toca los de entrada).
 */
export function reanchorNotes(notes: Apunte[], content: string): Apunte[] {
  const lines = choLines(content).map(normalizeLine);
  const hashes = lines.map((l) => contentHash(l));
  return notes.map((n) => {
    if (n.line >= 0 && n.line < lines.length && hashes[n.line] === n.lineHash) {
      return n.orphan ? { ...n, orphan: false } : n;
    }
    // Una línea vacía (o una directiva) no tiene con qué compararse.
    if (!n.lineText) return { ...n, orphan: true };
    let best = -1;
    let bestScore = 0;
    for (let i = 0; i < lines.length; i++) {
      if (!lines[i]) continue;
      const score =
        hashes[i] === n.lineHash ? 1 : lineSimilarity(n.lineText, lines[i]);
      if (
        score > bestScore ||
        (score === bestScore &&
          best >= 0 &&
          Math.abs(i - n.line) < Math.abs(best - n.line))
      ) {
        best = i;
        bestScore = score;
      }
    }
    if (best >= 0 && bestScore >= REANCHOR_MIN) {
      return {
        ...n,
        line: best,
        lineHash: hashes[best],
        lineText: lines[best],
        orphan: false,
      };
    }
    return { ...n, orphan: true };
  });
}
