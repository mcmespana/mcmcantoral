/**
 * Configuración remota de MCM Cantoral: `songs/cantoralConfig/data`.
 *
 * La publica el repo del cantoral (`config/cantoral.json`, plan
 * `docs/planes/fork-cantoral/02-datos-offline.md` §7) y la app la trata como
 * el catálogo: semilla empaquetada, copia local y comparación numérica de
 * `updatedAt`. Aquí solo vive la lógica PURA: leer lo que llegue sin fiarse de
 * su forma y decidir el modo efectivo para una fecha.
 *
 * Mantenimiento y versión mínima son PROPIOS del fork: los de
 * `/profileConfig` son de MCM App y su `minAppVersion` (2.5.x) bloquearía a
 * MCM Cantoral 1.0 (`01` §2.1).
 */

export type CantoralMode = 'normal' | 'navidad';

/** Por dónde va un directo (D-23, `04` §2 bis). */
export type LiveTransportChoice = 'both' | 'local' | 'cloud';

/** Cómo se ve un aviso del maestro en quien sigue (`04` §6). */
export type AvisoKind = 'cinta' | 'destello' | 'cuenta';

export interface LivePreset {
  id: string;
  text: string;
  kind: AvisoKind;
}

export interface CantoralEvent {
  title: string;
  place?: string;
  /** `YYYY-MM-DD`. */
  date?: string;
  /** Ids de `songs/packs` en el orden del día. */
  packs: string[];
  /** Clave fija del directo del evento en `/choirSessions`. */
  liveKey?: string;
  liveTransport?: LiveTransportChoice;
}

export interface CantoralConfig {
  mode: CantoralMode;
  /** `YYYY-MM-DD`: fuera de `from`–`to` el modo vuelve solo a `normal`. */
  from?: string;
  to?: string;
  /** Categoría que encabeza el cantoral en modo Navidad (clave de `songs/data`). */
  featuredCategory?: string;
  event?: CantoralEvent;
  livePresets: LivePreset[];
  reactions: string[];
  maintenance: boolean;
  maintenanceMessage?: string;
  minAppVersion: string;
  /**
   * `null` = se puede saltar la pantalla de «actualiza» sin límite; `0` =
   * estricto; `N` = N veces y luego estricto (igual que en MCM App).
   */
  minAppVersionSkips: number | null;
  /** Interruptor remoto de los botones de volumen como pedal (D-17). */
  volumeButtons: { ios: boolean; android: boolean };
}

/** Avisos de 1 toque por defecto (`04` §6). */
export const DEFAULT_LIVE_PRESETS: LivePreset[] = [
  { id: 'fuerte', text: '¡Más fuerte!', kind: 'destello' },
  { id: 'suave', text: 'Más suave', kind: 'cinta' },
  { id: 'estribillo', text: 'Repetimos estribillo', kind: 'cinta' },
  { id: 'ultima', text: 'Última estrofa', kind: 'cinta' },
  { id: 'voces', text: 'Solo voces', kind: 'cinta' },
  { id: 'todos', text: 'Todos', kind: 'cinta' },
  { id: 'atencion', text: '¡Atención!', kind: 'destello' },
  { id: 'pausa', text: 'Pausa', kind: 'cinta' },
  { id: 'seguimos', text: 'Seguimos', kind: 'cinta' },
  { id: 'tono', text: 'Cambio de tono', kind: 'destello' },
];

export const DEFAULT_REACTIONS = ['🔥', '🙌', '👏', '😂', '❤️'];

export const DEFAULT_CANTORAL_CONFIG: CantoralConfig = {
  mode: 'normal',
  livePresets: DEFAULT_LIVE_PRESETS,
  reactions: DEFAULT_REACTIONS,
  maintenance: false,
  minAppVersion: '0.0.0',
  minAppVersionSkips: null,
  volumeButtons: { ios: true, android: true },
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function date(v: unknown): string | undefined {
  const s = str(v);
  return s && DATE_RE.test(s) ? s : undefined;
}

function parseKind(v: unknown): AvisoKind {
  return v === 'destello' || v === 'cuenta' ? v : 'cinta';
}

function parseTransport(v: unknown): LiveTransportChoice | undefined {
  return v === 'both' || v === 'local' || v === 'cloud' ? v : undefined;
}

function parsePresets(v: unknown): LivePreset[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const out: LivePreset[] = [];
  const seen = new Set<string>();
  v.forEach((raw, i) => {
    if (typeof raw === 'string') {
      const text = str(raw);
      if (!text) return;
      const id = `p${i}`;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({ id, text, kind: 'cinta' });
      return;
    }
    if (!raw || typeof raw !== 'object') return;
    const r = raw as Record<string, unknown>;
    const text = str(r.text);
    if (!text) return;
    const id = str(r.id) ?? `p${i}`;
    if (seen.has(id)) return;
    seen.add(id);
    out.push({ id, text, kind: parseKind(r.kind) });
  });
  return out.length ? out : undefined;
}

function parseEvent(v: unknown): CantoralEvent | undefined {
  if (!v || typeof v !== 'object') return undefined;
  const r = v as Record<string, unknown>;
  const title = str(r.title);
  if (!title) return undefined;
  const packs = Array.isArray(r.packs)
    ? r.packs.map(str).filter((p): p is string => !!p)
    : [];
  return {
    title,
    place: str(r.place),
    date: date(r.date),
    packs,
    liveKey: str(r.liveKey),
    liveTransport: parseTransport(r.liveTransport),
  };
}

/**
 * Lee lo que haya en `songs/cantoralConfig/data` sin fiarse: cualquier campo
 * raro cae a su valor por defecto. Nunca lanza.
 */
export function parseCantoralConfig(raw: unknown): CantoralConfig {
  if (!raw || typeof raw !== 'object') return DEFAULT_CANTORAL_CONFIG;
  const r = raw as Record<string, unknown>;
  const reactions = Array.isArray(r.reactions)
    ? r.reactions.map(str).filter((e): e is string => !!e)
    : [];
  const skips =
    typeof r.minAppVersionSkips === 'number' &&
    Number.isFinite(r.minAppVersionSkips) &&
    r.minAppVersionSkips >= 0
      ? Math.floor(r.minAppVersionSkips)
      : null;
  const vb =
    r.volumeButtons && typeof r.volumeButtons === 'object'
      ? (r.volumeButtons as Record<string, unknown>)
      : {};
  return {
    mode: r.mode === 'navidad' ? 'navidad' : 'normal',
    from: date(r.from),
    to: date(r.to),
    featuredCategory: str(r.featuredCategory),
    event: parseEvent(r.event),
    livePresets: parsePresets(r.livePresets) ?? DEFAULT_LIVE_PRESETS,
    reactions: reactions.length ? reactions.slice(0, 8) : DEFAULT_REACTIONS,
    maintenance: r.maintenance === true,
    maintenanceMessage: str(r.maintenanceMessage),
    minAppVersion: str(r.minAppVersion) ?? '0.0.0',
    minAppVersionSkips: skips,
    volumeButtons: {
      ios: vb.ios !== false,
      android: vb.android !== false,
    },
  };
}

/** `YYYY-MM-DD` de una fecha en hora local. */
export function localIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Modo que manda HOY: `navidad` solo dentro de `from`–`to` (si vienen). Fuera
 * de la ventana vuelve solo a `normal`, sin que nadie tenga que tocar nada.
 */
export function effectiveMode(
  config: CantoralConfig,
  today: string,
): CantoralMode {
  if (config.mode !== 'navidad') return 'normal';
  if (config.from && today < config.from) return 'normal';
  if (config.to && today > config.to) return 'normal';
  return 'navidad';
}
