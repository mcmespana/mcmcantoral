/**
 * Protocolo del DIRECTO (`docs/planes/fork-cantoral/04-directo.md` §3):
 * un **estado** autoritativo del maestro (lo último manda por `seq`) más
 * **eventos** sueltos (avisos, reacciones, fin). Los dos caminos —la nube
 * (`/choirSessions/<clave>`) y la wifi del coro (TCP + Bonjour)— solo
 * transportan estos mensajes; un reductor puro decide qué se queda.
 *
 * Lógica PURA: sin red, sin reloj, sin React (`__tests__/liveProtocol.test.ts`).
 */

/** Instrumento de quien sigue (avisos dirigidos y capas de apuntes, `05`). */
export const INSTRUMENTOS = [
  'voz',
  'guitarra',
  'bajo',
  'percusion',
  'teclado',
  'viento',
  'cuerda',
] as const;
export type Instrumento = (typeof INSTRUMENTOS)[number];

export const INSTRUMENTO_LABEL: Record<Instrumento, string> = {
  voz: 'Voces',
  guitarra: 'Guitarras',
  bajo: 'Bajos',
  percusion: 'Percusión',
  teclado: 'Teclados',
  viento: 'Viento',
  cuerda: 'Cuerda',
};

export type LiveTransport = 'local' | 'cloud';

/** La canción del directo (lo que el seguidor abre solo). */
export interface LiveSong {
  /** Categoría de CASA. */
  category: string;
  filename: string;
  /** Huella del contenido del maestro (`contentHash`): si no coincide con la
   *  del catálogo del seguidor, se pinta el `content` que viaja aquí. */
  contentHash: string;
  title?: string;
  author?: string;
  key?: string;
  capo?: number;
  /** El ChordPro del maestro: nunca se queda nadie en blanco. */
  content?: string;
  transpose?: number;
  capoOverride?: number | null;
}

export interface LiveRepertorioItem {
  category: string;
  filename: string;
  title?: string;
  transpose?: number;
  capo?: number;
  notes?: string;
}

/** «Ahora hacemos esta estrofa / este puente» (`04` §10). */
export interface SectionCue {
  section: number;
  label: string;
  at: number;
}

/** Cuenta atrás al cambio de bloque (I-06). */
export interface Countdown {
  label: string;
  /** Instante en que llega a cero (ms). */
  endsAt: number;
}

export interface LiveState {
  sessionId: string;
  /** Sube en cada cambio del maestro: lo último manda. */
  seq: number;
  repertorio: { id: string; name: string; items: LiveRepertorioItem[] };
  /** Posición en el repertorio (−1 = una canción suelta). */
  index: number;
  song: LiveSong | null;
  /** Sección que se está cantando (índice de `buildSheet`). */
  section?: number | null;
  sectionCue?: SectionCue | null;
  countdown?: Countdown | null;
  by: { deviceId: string; name?: string };
  /** Versión del cantoral del maestro (ms): si es más nueva, se ofrece. */
  catalogUpdatedAt: number;
  /** Por dónde va el directo (D-23). */
  transports: LiveTransport[];
  /** Reacciones apagadas para todos por el maestro. */
  reactionsOff?: boolean;
  at: number;
}

export type AvisoKind = 'cinta' | 'destello' | 'cuenta';

export interface Aviso {
  t: 'aviso';
  id: string;
  kind: AvisoKind;
  text: string;
  preset?: string;
  /** A todos o a un instrumento. */
  to?: 'todos' | Instrumento;
  ttlMs: number;
  from: string;
  at: number;
}

export interface Reaccion {
  t: 'reaccion';
  /** Emoji. */
  e: string;
  from: string;
  at: number;
}

export interface Fin {
  t: 'fin';
  at: number;
}

/**
 * Un apunte que quien dirige manda al directo (`05` §2: «bajo: aquí
 * entras»). Su contenido lo valida quien lo recibe (`parseApunte`).
 */
export interface ApunteEvento {
  t: 'apunte';
  id: string;
  apunte: Record<string, unknown>;
  from: string;
  at: number;
}

export type LiveEvent = Aviso | Reaccion | Fin | ApunteEvento;

/** Lo que viaja por cualquiera de los dos caminos. */
export type LiveMessage =
  { type: 'state'; state: LiveState } | { type: 'event'; event: LiveEvent };

// ─── Huellas ─────────────────────────────────────────────────────────────────

/**
 * Huella corta y estable de un texto (FNV-1a de 32 bits, en base 36). No es
 * criptográfica: solo dice si el maestro y el seguidor tienen la misma letra.
 */
export function contentHash(text: string | undefined | null): string {
  let h = 0x811c9dc5;
  const s = text ?? '';
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

// ─── Reductor ────────────────────────────────────────────────────────────────

export interface LiveView {
  state: LiveState | null;
  /** Avisos vistos (para no repetir el mismo que llega por los dos caminos). */
  avisos: Aviso[];
  /** Reacciones del último minuto (agregadas en la UI). */
  reacciones: Reaccion[];
  /** Apuntes mandados al directo (los últimos `MAX_APUNTES`). */
  apuntes: ApunteEvento[];
  ended: boolean;
}

export const EMPTY_VIEW: LiveView = {
  state: null,
  avisos: [],
  reacciones: [],
  apuntes: [],
  ended: false,
};

/** Cuántos apuntes de directo se recuerdan. */
export const MAX_APUNTES = 50;

/** Cuántos avisos se recuerdan (historial corto del seguidor). */
export const MAX_AVISOS = 20;
/** Ventana de reacciones (ms). */
export const REACTION_WINDOW_MS = 60_000;

/**
 * Aplica un mensaje. El estado nuevo solo entra si su `seq` es MAYOR (o el
 * mismo `seq` con `at` posterior, el relevo de un maestro): así da igual por
 * qué camino llegue primero o si llega dos veces. Los eventos se deduplican.
 */
export function liveReducer(
  view: LiveView,
  msg: LiveMessage,
  now: number,
): LiveView {
  if (msg.type === 'state') {
    const next = msg.state;
    const cur = view.state;
    if (cur && cur.sessionId === next.sessionId) {
      if (next.seq < cur.seq) return view;
      if (next.seq === cur.seq && next.at <= cur.at) return view;
    }
    return { ...view, state: next, ended: false };
  }
  const ev = msg.event;
  if (ev.t === 'fin') return { ...view, ended: true };
  if (ev.t === 'apunte') {
    if (view.apuntes.some((a) => a.id === ev.id)) return view;
    return { ...view, apuntes: [...view.apuntes, ev].slice(-MAX_APUNTES) };
  }
  if (ev.t === 'aviso') {
    if (view.avisos.some((a) => a.id === ev.id)) return view;
    const avisos = [...view.avisos, ev]
      .sort((a, b) => a.at - b.at)
      .slice(-MAX_AVISOS);
    return { ...view, avisos };
  }
  // Reacción: la misma (emoji + quién + instante) por los dos caminos cuenta 1.
  if (
    view.reacciones.some(
      (r) => r.e === ev.e && r.from === ev.from && r.at === ev.at,
    )
  ) {
    return view;
  }
  const reacciones = [...view.reacciones, ev].filter(
    (r) => now - r.at <= REACTION_WINDOW_MS,
  );
  return { ...view, reacciones };
}

/** ¿Este aviso es para mí? (Todos, o mi instrumento.) */
export function avisoEsParaMi(
  aviso: Aviso,
  misInstrumentos: Instrumento[],
): boolean {
  if (!aviso.to || aviso.to === 'todos') return true;
  return misInstrumentos.includes(aviso.to);
}

/** Avisos vivos ahora (no caducados), los más recientes al final. */
export function avisosVivos(
  avisos: Aviso[],
  now: number,
  misInstrumentos: Instrumento[],
): Aviso[] {
  return avisos.filter(
    (a) => now - a.at < a.ttlMs && avisoEsParaMi(a, misInstrumentos),
  );
}

/** Reacciones agregadas («🔥×12»), las más numerosas primero, máximo 5. */
export function agregarReacciones(
  reacciones: Reaccion[],
  now: number,
  windowMs = 8_000,
): { e: string; n: number }[] {
  const counts = new Map<string, number>();
  for (const r of reacciones) {
    if (now - r.at > windowMs) continue;
    counts.set(r.e, (counts.get(r.e) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([e, n]) => ({ e, n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
}

// ─── El maestro ──────────────────────────────────────────────────────────────

/** El estado siguiente del maestro: `seq` + 1 y su firma. */
export function nextState(
  prev: LiveState,
  patch: Partial<Omit<LiveState, 'seq' | 'sessionId' | 'at' | 'by'>>,
  by: LiveState['by'],
  now: number,
): LiveState {
  return { ...prev, ...patch, seq: prev.seq + 1, by, at: now };
}

/** El estado de arranque de un directo. */
export function initialState(o: {
  sessionId: string;
  repertorio: LiveState['repertorio'];
  by: LiveState['by'];
  catalogUpdatedAt: number;
  transports: LiveTransport[];
  now: number;
}): LiveState {
  return {
    sessionId: o.sessionId,
    seq: 1,
    repertorio: o.repertorio,
    index: -1,
    song: null,
    section: null,
    sectionCue: null,
    countdown: null,
    by: o.by,
    catalogUpdatedAt: o.catalogUpdatedAt,
    transports: o.transports,
    at: o.now,
  };
}

/** Avance de canción dentro del repertorio (−1/+1), con los límites. */
export function stepIndex(state: LiveState, delta: number): number {
  const n = state.repertorio.items.length;
  if (n === 0) return -1;
  const from = state.index < 0 ? (delta > 0 ? -1 : n) : state.index;
  return Math.max(0, Math.min(n - 1, from + delta));
}

/**
 * Lo marcado de serie en «por dónde va el directo» (D-23, `04` §2 bis): con
 * datos y sin wifi, solo internet; en una wifi sin internet, solo la wifi del
 * coro; en una wifi con internet, los dos.
 */
export function defaultTransports(net: {
  isWifi: boolean;
  internet: boolean;
}): LiveTransport[] {
  if (net.isWifi && net.internet) return ['local', 'cloud'];
  if (net.isWifi) return ['local'];
  return ['cloud'];
}

/**
 * Huella del PIN de maestro (4 cifras, D-08). La comprueba quien recibe la
 * orden (el equipo base, cualquier seguidor), por la nube o por la wifi. No
 * protege de un ataque (son 10.000 PIN): evita que alguien dirija sin querer.
 */
export function pinHash(pin: string, sessionId: string): string {
  return contentHash(`${sessionId}:${pin.trim()}`);
}

export function isValidPin(pin: string): boolean {
  return /^\d{4}$/.test(pin.trim());
}

// ─── Relevo y presencia ──────────────────────────────────────────────────────

/** Latido del servidor local y de la presencia. */
export const HEARTBEAT_MS = 5_000;
/** Tras estos latidos perdidos, el servidor se da por caído (`04` §5.2). */
export const MISSED_BEATS = 3;

/**
 * ¿Quién sirve tras caer el servidor? El maestro con prioridad más alta (el
 * que entró antes) que siga vivo. Todos los maestros calculan lo mismo con lo
 * mismo, así que solo uno abre servidor.
 */
export function relayWinner(
  masters: { deviceId: string; joinedAt: number; lastSeen: number }[],
  deadServer: string | null,
  now: number,
): string | null {
  const alive = masters
    .filter((m) => m.deviceId !== deadServer)
    .filter((m) => now - m.lastSeen < HEARTBEAT_MS * MISSED_BEATS)
    .sort(
      (a, b) => a.joinedAt - b.joinedAt || a.deviceId.localeCompare(b.deviceId),
    );
  return alive[0]?.deviceId ?? null;
}

export interface PresenceEntry {
  name?: string;
  inst?: Instrumento[];
  app?: 'cantoral' | 'mcmapp';
  via?: LiveTransport;
  at: number;
}

/** Quién sigue ahora (visto en el último minuto), con su instrumento. */
export function presenceSummary(
  presence: Record<string, PresenceEntry> | null | undefined,
  now: number,
): {
  total: number;
  byInstrument: Partial<Record<Instrumento, number>>;
  byVia: Record<LiveTransport, number>;
} {
  const out = {
    total: 0,
    byInstrument: {} as Partial<Record<Instrumento, number>>,
    byVia: { local: 0, cloud: 0 } as Record<LiveTransport, number>,
  };
  for (const p of Object.values(presence ?? {})) {
    if (!p || now - p.at > 60_000) continue;
    out.total += 1;
    out.byVia[p.via ?? 'cloud'] += 1;
    for (const i of p.inst ?? []) {
      out.byInstrument[i] = (out.byInstrument[i] ?? 0) + 1;
    }
  }
  return out;
}

// ─── Resumen al acabar (I-07) ────────────────────────────────────────────────

export interface SungEntry {
  filename: string;
  title?: string;
  startedAt: number;
  endedAt?: number;
}

/**
 * Apunta cada canción con su hora de inicio y fin a partir de los estados
 * que han ido llegando (solo cambia de canción si cambia el fichero).
 */
export function logSong(
  log: SungEntry[],
  song: LiveSong | null,
  now: number,
): SungEntry[] {
  const last = log[log.length - 1];
  if (!song) {
    if (last && !last.endedAt) {
      return [...log.slice(0, -1), { ...last, endedAt: now }];
    }
    return log;
  }
  if (last && last.filename === song.filename && !last.endedAt) return log;
  const closed =
    last && !last.endedAt
      ? [...log.slice(0, -1), { ...last, endedAt: now }]
      : log;
  return [
    ...closed,
    { filename: song.filename, title: song.title, startedAt: now },
  ];
}

/** Resumen: canciones cantadas y duración real. */
export function summarize(
  log: SungEntry[],
  now: number,
): { songs: number; totalMs: number; entries: (SungEntry & { ms: number })[] } {
  const entries = log.map((e) => ({
    ...e,
    ms: Math.max(0, (e.endedAt ?? now) - e.startedAt),
  }));
  return {
    songs: entries.length,
    totalMs: entries.reduce((a, e) => a + e.ms, 0),
    entries,
  };
}
