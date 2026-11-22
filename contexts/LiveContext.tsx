/**
 * El DIRECTO por encima del «modo coro» (`docs/planes/fork-cantoral/04-directo.md`).
 *
 * `ChoirSessionContext` sigue llevando lo de siempre (la clave, el modo, el
 * nodo `/choirSessions/<clave>` con `current` y `playlist`, que es lo que lee
 * MCM App). Aquí se monta encima el protocolo nuevo (`services/live/`):
 *
 *  - **Una vista** (`LiveView`) que junta lo que llega por los dos caminos
 *    —la nube y la wifi del coro— con el reductor puro: lo último manda por
 *    `seq` y los duplicados no cuentan.
 *  - **Quien dirige** publica un estado completo (canción, sección, cuenta
 *    atrás…) por los caminos elegidos, manda avisos y apunta lo cantado para
 *    el resumen. Sigue escribiendo `current` para MCM App.
 *  - **Quien sigue** recibe `remote` (la canción del maestro, con la forma de
 *    siempre), avisos dirigidos a su instrumento y reacciones; puede «ir por
 *    libre» y volver; deja su presencia (con latido) para que el maestro sepa
 *    cuántos le siguen.
 *
 * El reloj de los avisos NO vive aquí (un tic por segundo repintaría toda la
 * app): lo llevan los componentes de `components/live/`.
 */
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import {
  fetchLiveChoirSession,
  type ChoirCurrentSong,
} from '@/services/choirSessionService';
import {
  heartbeatPresence,
  presenceEntry,
  publishLiveState,
  readCloudExtras,
  registerMaster,
  registerPresence,
  removePresence,
  sendAviso as cloudSendAviso,
  sendReaccion as cloudSendReaccion,
  unregisterMaster,
} from '@/services/live/cloud';
import {
  EMPTY_VIEW,
  contentHash,
  initialState,
  liveReducer,
  logSong,
  nextState,
  pinHash,
  summarize,
  type Aviso,
  type AvisoKind,
  type Instrumento,
  type LiveMessage,
  type LiveRepertorioItem,
  type LiveSong,
  type LiveState,
  type LiveTransport,
  type LiveView,
  type PresenceEntry,
  type SungEntry,
} from '@/services/live/protocol';
import { isSong, toSelection, type Repertorio } from '@/services/repertorios';
import { catalogStore } from '@/services/catalog';
import { logger } from '@/utils/logger';
import { LOCAL_LIVE_AVAILABLE } from '@/services/live/local/native';

export type LiveRole = 'off' | 'master' | 'follower';

/** Preferencias de quien sigue (en este dispositivo). */
export interface LivePrefs {
  /** Instrumentos: los avisos dirigidos solo llegan a quien toca. */
  inst: Instrumento[];
  /** Reacciones escondidas en este dispositivo. */
  reactionsMuted: boolean;
  /** Cantoral más nuevo del maestro: aplicarlo sin preguntar. */
  autoCatalog: boolean;
}

export const DEFAULT_LIVE_PREFS: LivePrefs = {
  inst: [],
  reactionsMuted: false,
  autoCatalog: false,
};

const PREFS_KEY = '@cantoral_live_prefs_v1';
/** Latido de la presencia en la nube (`04` §4). */
export const PRESENCE_HEARTBEAT_MS = 30_000;
/** Lo que dura una cinta si nadie la toca (`04` §6). */
export const AVISO_TTL_MS = 8_000;

export interface LiveSummary {
  name: string;
  songs: number;
  totalMs: number;
  entries: (SungEntry & { ms: number })[];
  items: LiveRepertorioItem[];
}

export interface StartLiveOptions {
  code: string;
  repertorio: Repertorio;
  pin: string;
  transports: LiveTransport[];
  choirName?: string;
}

export type JoinMasterResult = 'ok' | 'bad-pin' | 'no-live' | 'no-pin';

/**
 * Un camino extra (la wifi del coro): lo engancha `services/live/local/`.
 * Recibe todo lo que el maestro publica y avisa de lo que llega.
 */
export interface LiveLink {
  send(msg: LiveMessage): void;
  stop(): void;
  /** Aceptar el cantoral que ofrece el servidor local. */
  acceptCatalog?(): void;
}

/** Un directo que va (también) por la wifi del coro, sin pasar por la nube. */
export interface LocalSession {
  /** La clave del directo. */
  key: string;
  role: 'master' | 'follower';
  /** `LiveState.sessionId` (lo anuncia Bonjour). */
  sessionId?: string;
  /** Servidor al que conectarse (si no, se busca por Bonjour). */
  host?: string;
  port?: number;
}

/** Un directo encontrado por la wifi (para unirse). */
export interface NearbyLive {
  sessionId?: string;
  host: string;
  port: number;
}

/** La clave del directo dentro de `sessionId` (`<clave>-<instante>`). */
export function keyOfSessionId(sessionId: string | undefined): string | null {
  if (!sessionId) return null;
  const i = sessionId.lastIndexOf('-');
  return i > 0 ? sessionId.slice(0, i) : null;
}

/** Una promesa con plazo (la nube sin internet no contesta nunca). */
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error('timeout')), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}
const CLOUD_START_TIMEOUT_MS = 10_000;

interface LiveContextValue {
  role: LiveRole;
  view: LiveView;
  /** Caminos por los que va el directo (los que eligió quien lo abrió). */
  transports: LiveTransport[];
  /** Caminos por los que está llegando algo ahora mismo. */
  via: LiveTransport[];
  /** Quien sigue: la canción del maestro con la forma de `current`. */
  remote: ChoirCurrentSong | null;
  /** Quien sigue va «por libre»: no se le cambia de canción. */
  free: boolean;
  setFree: (free: boolean) => void;
  /** Presencia (para quien dirige). */
  presence: Record<string, PresenceEntry>;
  masterCount: number;
  /** El maestro tiene un cantoral más nuevo que el de este dispositivo. */
  catalogNewer: boolean;
  updateCatalog: () => Promise<void>;
  prefs: LivePrefs;
  setPrefs: (patch: Partial<LivePrefs>) => void;
  /** El resumen del último directo que dirigiste (hasta cerrarlo). */
  lastSummary: LiveSummary | null;
  clearSummary: () => void;

  // ── Quien dirige ──
  start: (opts: StartLiveOptions) => Promise<void>;
  joinWithPin: (code: string, pin: string) => Promise<JoinMasterResult>;
  publishSong: (current: Omit<ChoirCurrentSong, 'updatedAt'>) => void;
  sendAviso: (a: {
    kind: AvisoKind;
    text: string;
    to?: Aviso['to'];
    preset?: string;
  }) => void;
  cueSection: (section: number | null, label?: string) => void;
  startCountdown: (label: string, ms: number) => void;
  clearCountdown: () => void;
  setReactionsOff: (off: boolean) => void;
  /** Cierra (o deja) el directo. Devuelve el resumen si dirigías. */
  end: () => Promise<LiveSummary | null>;

  // ── Quien sigue ──
  react: (emoji: string) => void;

  /** Unirse a un directo encontrado por la wifi (con PIN: para dirigir). */
  joinLocal: (found: NearbyLive, pin?: string) => void;
  /** Último problema con el camino local, para decirlo («PIN incorrecto»). */
  localError: string | null;

  // ── Para el puente local (`components/live/LocalLiveBridge.tsx`) ──
  localSession: LocalSession | null;
  /** Este dispositivo sirve el directo por la wifi (dueño o relevo). */
  serving: boolean;
  becomeServer: () => void;
  /** Huella del PIN de maestro (para el servidor local). */
  masterPinHash: string | null;
  /** PIN en claro de quien dirige sin servir (solo en memoria). */
  masterPin: string | null;
  getMasterState: () => LiveState | null;
  attachLocal: (link: LiveLink | null) => void;
  receiveLocal: (msgs: LiveMessage[]) => void;
  setLocalAlive: (alive: boolean) => void;
  setLocalOffer: (offer: boolean) => void;
  setLocalPresence: (p: Record<string, PresenceEntry>) => void;
  reportLocalError: (msg: string | null) => void;
}

const LiveContext = createContext<LiveContextValue | undefined>(undefined);

/** La canción del protocolo con la forma de `current` de siempre. */
export function liveSongToCurrent(
  song: LiveSong,
  at: number,
): ChoirCurrentSong {
  return {
    filename: song.filename,
    transpose: song.transpose ?? 0,
    capoOverride: song.capoOverride ?? null,
    updatedAt: at,
    title: song.title,
    author: song.author,
    songKey: song.key,
    capo: song.capo,
    content: song.content,
    firebaseCategory: song.category || undefined,
  };
}

/** `current` de siempre → canción del protocolo (con su huella). */
export function currentToLiveSong(
  c: Omit<ChoirCurrentSong, 'updatedAt'>,
): LiveSong {
  return {
    category: c.firebaseCategory ?? '',
    filename: c.filename,
    contentHash: contentHash(c.content),
    title: c.title,
    author: c.author,
    key: c.songKey,
    capo: c.capo,
    content: c.content,
    transpose: c.transpose,
    capoOverride: c.capoOverride ?? null,
  };
}

export function repertorioToLive(rep: Repertorio): LiveState['repertorio'] {
  return {
    id: rep.id,
    name: rep.name,
    items: rep.items.filter(isSong).map((s) => ({
      category: s.category,
      filename: s.filename,
      title: s.title,
      transpose: s.transpose,
      capo: s.capo,
      notes: s.notes,
    })),
  };
}

function localCatalogUpdatedAt(): number {
  return catalogStore.getState().catalog?.songs?.updatedAt ?? 0;
}

export function LiveProvider({ children }: { children: ReactNode }) {
  const choir = useChoirSession();
  const { settings } = useAppSettings();
  const myName = settings.choirName?.trim() || undefined;

  // Lo recibido por la wifi y lo propio, junto a la sesión a la que
  // pertenece: al salir o cambiar de directo deja de contar solo.
  const [own, setOwn] = useState<{ key: string | null; view: LiveView }>({
    key: null,
    view: EMPTY_VIEW,
  });
  const [freeBox, setFreeBox] = useState<{ key: string | null; free: boolean }>(
    { key: null, free: false },
  );
  const [transportsChoice, setTransportsChoice] = useState<LiveTransport[]>([
    'cloud',
  ]);
  const [prefs, setPrefsState] = useState<LivePrefs>(DEFAULT_LIVE_PREFS);
  const [lastSummary, setLastSummary] = useState<LiveSummary | null>(null);
  const [localPresence, setLocalPresence] = useState<
    Record<string, PresenceEntry>
  >({});
  const [localAlive, setLocalAlive] = useState(false);
  const [localOffer, setLocalOffer] = useState(false);
  const [localError, reportLocalError] = useState<string | null>(null);
  const [localSession, setLocalSession] = useState<LocalSession | null>(null);
  const [relayServing, setRelayServing] = useState(false);
  const [ownPinHash, setOwnPinHash] = useState<string | null>(null);
  const [masterPin, setMasterPin] = useState<string | null>(null);

  const masterStateRef = useRef<LiveState | null>(null);
  const sentAvisosRef = useRef<string[]>([]);
  const songLogRef = useRef<SungEntry[]>([]);
  const localRef = useRef<LiveLink | null>(null);
  const transportsRef = useRef<LiveTransport[]>(['cloud']);

  const role: LiveRole =
    choir.mode === 'master'
      ? 'master'
      : choir.mode === 'slave'
        ? 'follower'
        : (localSession?.role ?? 'off');

  const code = choir.code ?? localSession?.key ?? null;
  const sessionKey = role === 'off' ? null : (code ?? 'local');
  const free = freeBox.key === sessionKey && freeBox.free;
  const setFree = useCallback(
    (f: boolean) => setFreeBox({ key: sessionKey, free: f }),
    [sessionKey],
  );

  /** Este dispositivo abrió el directo (por la nube o solo por la wifi). */
  const owner =
    choir.isOwner || (localSession?.role === 'master' && !localSession.host);

  const by = useMemo(
    () => ({ deviceId: choir.deviceId, name: myName }),
    [choir.deviceId, myName],
  );

  // ── Preferencias ──
  useEffect(() => {
    AsyncStorage.getItem(PREFS_KEY)
      .then((raw) => {
        if (!raw) return;
        const p = JSON.parse(raw) as Partial<LivePrefs>;
        setPrefsState({ ...DEFAULT_LIVE_PREFS, ...p });
      })
      .catch(() => {});
  }, []);
  const setPrefs = useCallback((patch: Partial<LivePrefs>) => {
    setPrefsState((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(PREFS_KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  const apply = useCallback(
    (msgs: LiveMessage[]) => {
      if (!msgs.length || !sessionKey) return;
      setOwn((prev) => {
        const base = prev.key === sessionKey ? prev.view : EMPTY_VIEW;
        const now = Date.now();
        return {
          key: sessionKey,
          view: msgs.reduce((acc, m) => liveReducer(acc, m, now), base),
        };
      });
    },
    [sessionKey],
  );

  // ── Fuera del directo: se olvida lo del maestro ──
  useEffect(() => {
    if (role !== 'off') return;
    masterStateRef.current = null;
    sentAvisosRef.current = [];
    localRef.current?.stop();
    localRef.current = null;
  }, [role]);

  // ── Camino nube: lo nuevo viene dentro del nodo que ya se escucha, y se
  //    junta con lo propio y lo de la wifi con el mismo reductor ──
  const extras = useMemo(() => readCloudExtras(choir.session), [choir.session]);
  const ownView = own.key === sessionKey && sessionKey ? own.view : EMPTY_VIEW;
  const view = useMemo<LiveView>(() => {
    if (!sessionKey) return EMPTY_VIEW;
    const msgs: LiveMessage[] = [];
    if (extras.state) msgs.push({ type: 'state', state: extras.state });
    for (const a of extras.avisos) msgs.push({ type: 'event', event: a });
    for (const r of extras.reacciones) msgs.push({ type: 'event', event: r });
    // Reloj de la ventana de reacciones: la más reciente que haya (puro).
    const latest = [...extras.reacciones, ...ownView.reacciones].reduce(
      (m, r) => Math.max(m, r.at),
      0,
    );
    return msgs.reduce((acc, m) => liveReducer(acc, m, latest), ownView);
  }, [sessionKey, extras, ownView]);

  // ── Quien sigue: presencia en la nube con latido ──
  const instKey = prefs.inst.join(',');
  useEffect(() => {
    if (role !== 'follower' || !code || !choir.deviceId) return;
    const deviceId = choir.deviceId;
    const entry = presenceEntry({
      name: myName,
      inst: instKey ? (instKey.split(',') as Instrumento[]) : undefined,
      via: 'cloud',
    });
    registerPresence(code, deviceId, entry, Date.now()).catch((e) =>
      logger.warn('[directo] presencia', e),
    );
    const timer = setInterval(() => {
      heartbeatPresence(code, deviceId, Date.now()).catch(() => {});
    }, PRESENCE_HEARTBEAT_MS);
    return () => {
      clearInterval(timer);
      removePresence(code, deviceId).catch(() => {});
    };
  }, [role, code, choir.deviceId, myName, instKey]);

  // ── Quien dirige ──

  /** El estado del maestro; si falta (app reabierta, directo antiguo), se monta. */
  const ensureMasterState = useCallback((): LiveState | null => {
    const mine = masterStateRef.current;
    const seen = view.state;
    // Otro maestro puede haber avanzado: se parte siempre del más nuevo.
    if (mine && seen && seen.sessionId === mine.sessionId) {
      const newest = seen.seq > mine.seq ? seen : mine;
      masterStateRef.current = newest;
      return newest;
    }
    if (mine) return mine;
    if (!code) return null;
    if (view.state) {
      masterStateRef.current = view.state;
      transportsRef.current = view.state.transports;
      return view.state;
    }
    const playlist = choir.session?.playlist ?? [];
    const s = initialState({
      sessionId: `${code}-${Date.now().toString(36)}`,
      repertorio: {
        id: 'directo',
        name: choir.session?.choirName || 'Directo',
        items: playlist.map((p) => ({
          category: p.categoryHint ?? '',
          filename: p.filename,
          transpose: p.transpose,
          capo: p.capoOverride ?? undefined,
        })),
      },
      by,
      catalogUpdatedAt: localCatalogUpdatedAt(),
      transports: transportsRef.current,
      now: Date.now(),
    });
    masterStateRef.current = s;
    return s;
  }, [code, view.state, choir.session, by]);

  const broadcast = useCallback(
    (msg: LiveMessage) => {
      apply([msg]);
      localRef.current?.send(msg);
    },
    [apply],
  );

  const commit = useCallback(
    (patch: Parameters<typeof nextState>[1]) => {
      const prev = ensureMasterState();
      if (!prev || !code) return;
      const s = nextState(prev, patch, by, Date.now());
      masterStateRef.current = s;
      broadcast({ type: 'state', state: s });
      if (s.transports.includes('cloud') && choir.mode !== 'off') {
        publishLiveState(code, s).catch((e) =>
          logger.warn('[directo] publicar estado', e),
        );
      }
    },
    [ensureMasterState, code, by, broadcast, choir.mode],
  );

  const start = useCallback<LiveContextValue['start']>(
    async ({ code: key, repertorio, pin, transports, choirName }) => {
      const now = Date.now();
      const wantsLocal = transports.includes('local') && LOCAL_LIVE_AVAILABLE;
      const wantsCloud = transports.includes('cloud');
      if (!wantsLocal && !wantsCloud) throw new Error('Elige por dónde va');
      transportsRef.current = transports;
      setTransportsChoice(transports);
      songLogRef.current = [];
      sentAvisosRef.current = [];
      setLastSummary(null);
      reportLocalError(null);
      setRelayServing(false);
      setMasterPin(null);
      const s = initialState({
        sessionId: `${key}-${now.toString(36)}`,
        repertorio: repertorioToLive(repertorio),
        by,
        catalogUpdatedAt: localCatalogUpdatedAt(),
        transports,
        now,
      });
      const hash = pinHash(pin, s.sessionId);
      masterStateRef.current = s;
      setOwnPinHash(hash);
      setOwn({
        key,
        view: liveReducer(EMPTY_VIEW, { type: 'state', state: s }, now),
      });
      // La wifi primero: no depende de que haya internet.
      if (wantsLocal) {
        setLocalSession({ key, role: 'master', sessionId: s.sessionId });
      }
      if (!wantsCloud) return;
      try {
        await withTimeout(
          (async () => {
            await choir.startAsMaster(key, toSelection(repertorio, now), {
              name: myName,
              choirName: choirName ?? repertorio.name,
            });
            await registerMaster(key, by, { pinHash: hash, now });
            await publishLiveState(key, s);
          })(),
          CLOUD_START_TIMEOUT_MS,
        );
      } catch (e) {
        // «Los dos» sin internet: sigue solo por la wifi y se dice.
        if (!wantsLocal) throw e;
        logger.warn('[directo] sin nube, solo wifi', e);
        reportLocalError('Sin internet: el directo va solo por la wifi');
      }
    },
    [choir, myName, by],
  );

  const joinWithPin = useCallback<LiveContextValue['joinWithPin']>(
    async (key, pin) => {
      const session = await fetchLiveChoirSession(key);
      if (!session) return 'no-live';
      const x = readCloudExtras(session);
      if (!x.state || !x.masterPinHash) return 'no-pin';
      if (pinHash(pin, x.state.sessionId) !== x.masterPinHash) return 'bad-pin';
      await choir.joinAsMaster(key);
      masterStateRef.current = x.state;
      transportsRef.current = x.state.transports;
      setTransportsChoice(x.state.transports);
      setOwnPinHash(x.masterPinHash);
      setMasterPin(pin.trim());
      songLogRef.current = [];
      setOwn({
        key,
        view: liveReducer(
          EMPTY_VIEW,
          { type: 'state', state: x.state },
          Date.now(),
        ),
      });
      await registerMaster(key, by, { now: Date.now() });
      return 'ok';
    },
    [choir, by],
  );

  const joinLocal = useCallback<LiveContextValue['joinLocal']>((found, pin) => {
    const key = keyOfSessionId(found.sessionId);
    if (!key) return;
    reportLocalError(null);
    setMasterPin(pin?.trim() || null);
    setOwnPinHash(null);
    setRelayServing(false);
    setLocalSession({
      key,
      role: pin ? 'master' : 'follower',
      sessionId: found.sessionId,
      host: found.host,
      port: found.port,
    });
  }, []);

  const publishSong = useCallback<LiveContextValue['publishSong']>(
    (current) => {
      if (role !== 'master') return;
      const song = currentToLiveSong(current);
      const prev = ensureMasterState();
      const idx =
        prev?.repertorio.items.findIndex(
          (i) => i.filename === current.filename,
        ) ?? -1;
      const sameSong = prev?.song?.filename === song.filename;
      songLogRef.current = logSong(songLogRef.current, song, Date.now());
      commit({
        song,
        index: idx,
        // Otra canción: la sección y su anuncio ya no valen.
        ...(sameSong ? null : { section: null, sectionCue: null }),
      });
      // Lo de siempre, para MCM App (y los seguidores de versiones viejas).
      if (transportsRef.current.includes('cloud') && choir.mode === 'master') {
        void choir.publishCurrent(current);
      }
    },
    [role, ensureMasterState, commit, choir],
  );

  const sendAviso = useCallback<LiveContextValue['sendAviso']>(
    ({ kind, text, to, preset }) => {
      if (role !== 'master' || !code) return;
      const now = Date.now();
      const aviso: Aviso = {
        t: 'aviso',
        id: `${choir.deviceId}-${now.toString(36)}`,
        kind,
        text: text.trim(),
        preset,
        to: to ?? 'todos',
        ttlMs: AVISO_TTL_MS,
        from: myName ?? choir.deviceId,
        at: now,
      };
      if (!aviso.text) return;
      broadcast({ type: 'event', event: aviso });
      if (transportsRef.current.includes('cloud') && choir.mode !== 'off') {
        cloudSendAviso(code, aviso, sentAvisosRef.current)
          .then((ids) => {
            sentAvisosRef.current = ids;
          })
          .catch((e) => logger.warn('[directo] aviso', e));
      }
    },
    [role, code, choir.deviceId, choir.mode, myName, broadcast],
  );

  const cueSection = useCallback<LiveContextValue['cueSection']>(
    (section, label) => {
      if (role !== 'master') return;
      commit({
        section,
        sectionCue:
          section != null && label ? { section, label, at: Date.now() } : null,
      });
    },
    [role, commit],
  );

  const startCountdown = useCallback<LiveContextValue['startCountdown']>(
    (label, ms) => {
      if (role !== 'master') return;
      commit({ countdown: { label, endsAt: Date.now() + ms } });
    },
    [role, commit],
  );
  const clearCountdown = useCallback(() => {
    if (role !== 'master') return;
    commit({ countdown: null });
  }, [role, commit]);

  const setReactionsOff = useCallback(
    (off: boolean) => {
      if (role !== 'master') return;
      commit({ reactionsOff: off });
    },
    [role, commit],
  );

  const end = useCallback(async (): Promise<LiveSummary | null> => {
    const wasMaster = role === 'master';
    const key = code;
    const deviceId = choir.deviceId;
    let summary: LiveSummary | null = null;
    if (wasMaster) {
      const now = Date.now();
      const st = masterStateRef.current;
      const log = logSong(songLogRef.current, null, now);
      const sum = summarize(log, now);
      summary = {
        name: st?.repertorio.name ?? 'Directo',
        ...sum,
        items: st?.repertorio.items ?? [],
      };
      if (owner) {
        localRef.current?.send({ type: 'event', event: { t: 'fin', at: now } });
      }
      if (sum.songs > 0) setLastSummary(summary);
      if (key && !owner && choir.mode !== 'off') {
        unregisterMaster(key, deviceId).catch(() => {});
      }
    } else if (key && deviceId && choir.mode !== 'off') {
      removePresence(key, deviceId).catch(() => {});
    }
    localRef.current?.stop();
    localRef.current = null;
    setLocalAlive(false);
    setLocalOffer(false);
    setLocalPresence({});
    setLocalSession(null);
    setRelayServing(false);
    setMasterPin(null);
    setOwnPinHash(null);
    songLogRef.current = [];
    if (choir.mode !== 'off') await choir.leave();
    return summary;
  }, [role, code, choir, owner]);

  const react = useCallback(
    (emoji: string) => {
      if (role === 'off' || !code) return;
      const r = {
        t: 'reaccion' as const,
        e: emoji,
        from: choir.deviceId,
        at: Date.now(),
      };
      broadcast({ type: 'event', event: r });
      if (choir.mode !== 'off') {
        cloudSendReaccion(code, choir.deviceId, r).catch(() => {});
      }
    },
    [role, code, choir.deviceId, choir.mode, broadcast],
  );

  // ── Camino local (lo engancha `services/live/local/`) ──
  const attachLocal = useCallback((link: LiveLink | null) => {
    localRef.current?.stop();
    localRef.current = link;
    setLocalAlive(!!link);
  }, []);
  const receiveLocal = useCallback(
    (msgs: LiveMessage[]) => {
      setLocalAlive(true);
      apply(msgs);
    },
    [apply],
  );
  const getMasterState = useCallback(
    () => ensureMasterState(),
    [ensureMasterState],
  );
  const becomeServer = useCallback(() => setRelayServing(true), []);

  // Solo por la wifi: el «fin» del maestro cierra el directo de quien sigue
  // (por la nube lo hace el borrado del nodo).
  const endRef = useRef<() => Promise<LiveSummary | null>>(async () => null);
  useEffect(() => {
    endRef.current = end;
  });
  const endedLocally =
    role === 'follower' && view.ended && !!localSession && choir.mode === 'off';
  useEffect(() => {
    if (endedLocally) void endRef.current();
  }, [endedLocally]);

  // ── Lo que sale de la vista ──
  const remote = useMemo<ChoirCurrentSong | null>(() => {
    if (role !== 'follower') return null;
    if (view.state?.song)
      return liveSongToCurrent(view.state.song, view.state.at);
    return choir.session?.current ?? null;
  }, [role, view.state, choir.session]);

  const catalogNewer =
    localOffer ||
    (!!view.state && view.state.catalogUpdatedAt > localCatalogUpdatedAt());

  const updateCatalog = useCallback(async () => {
    const link = localRef.current;
    if (localOffer && link?.acceptCatalog) {
      link.acceptCatalog();
      setLocalOffer(false);
      return;
    }
    try {
      await catalogStore.refresh({ force: true });
    } catch (e) {
      logger.warn('[directo] actualizar cantoral', e);
    }
  }, [localOffer]);

  // «Actualizar siempre sin preguntar».
  useEffect(() => {
    if (role === 'follower' && catalogNewer && prefs.autoCatalog) {
      void updateCatalog();
    }
  }, [role, catalogNewer, prefs.autoCatalog, updateCatalog]);

  const via = useMemo<LiveTransport[]>(() => {
    const out: LiveTransport[] = [];
    if (localAlive) out.push('local');
    if (choir.session) out.push('cloud');
    return out;
  }, [localAlive, choir.session]);

  const serving =
    role === 'master' &&
    (view.state?.transports ?? transportsChoice).includes('local') &&
    (owner || relayServing);
  const masterPinHash = ownPinHash ?? extras.masterPinHash;

  const presence = useMemo(
    () => ({ ...extras.presence, ...localPresence }),
    [extras.presence, localPresence],
  );

  const value = useMemo<LiveContextValue>(
    () => ({
      role,
      view,
      transports: view.state?.transports ?? transportsChoice,
      via,
      remote,
      free,
      setFree,
      presence,
      masterCount: Math.max(1, Object.keys(extras.masters).length),
      catalogNewer,
      updateCatalog,
      prefs,
      setPrefs,
      lastSummary,
      clearSummary: () => setLastSummary(null),
      start,
      joinWithPin,
      publishSong,
      sendAviso,
      cueSection,
      startCountdown,
      clearCountdown,
      setReactionsOff,
      end,
      react,
      joinLocal,
      localError,
      localSession,
      serving,
      becomeServer,
      masterPinHash,
      masterPin,
      getMasterState,
      attachLocal,
      receiveLocal,
      setLocalAlive,
      setLocalOffer,
      setLocalPresence,
      reportLocalError,
    }),
    [
      role,
      view,
      transportsChoice,
      via,
      remote,
      free,
      setFree,
      presence,
      extras.masters,
      catalogNewer,
      updateCatalog,
      prefs,
      setPrefs,
      lastSummary,
      start,
      joinWithPin,
      publishSong,
      sendAviso,
      cueSection,
      startCountdown,
      clearCountdown,
      setReactionsOff,
      end,
      react,
      joinLocal,
      localError,
      localSession,
      serving,
      becomeServer,
      masterPinHash,
      masterPin,
      getMasterState,
      attachLocal,
      receiveLocal,
    ],
  );

  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>;
}

const noop = () => {};
const noopAsync = async () => {};

/** Sin proveedor (tests, pantallas sueltas): un directo apagado. */
const OFF: LiveContextValue = {
  role: 'off',
  view: EMPTY_VIEW,
  transports: [],
  via: [],
  remote: null,
  free: false,
  setFree: noop,
  presence: {},
  masterCount: 0,
  catalogNewer: false,
  updateCatalog: noopAsync,
  prefs: DEFAULT_LIVE_PREFS,
  setPrefs: noop,
  lastSummary: null,
  clearSummary: noop,
  start: noopAsync,
  joinWithPin: async () => 'no-live',
  publishSong: noop,
  sendAviso: noop,
  cueSection: noop,
  startCountdown: noop,
  clearCountdown: noop,
  setReactionsOff: noop,
  end: async () => null,
  react: noop,
  joinLocal: noop,
  localError: null,
  localSession: null,
  serving: false,
  becomeServer: noop,
  masterPinHash: null,
  masterPin: null,
  getMasterState: () => null,
  attachLocal: noop,
  receiveLocal: noop,
  setLocalAlive: noop,
  setLocalOffer: noop,
  setLocalPresence: noop,
  reportLocalError: noop,
};

export function useLive(): LiveContextValue {
  return useContext(LiveContext) ?? OFF;
}
