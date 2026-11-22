/**
 * Camino 1 del directo: la NUBE (`04-directo.md` §4). Todo va dentro de
 * `/choirSessions/<clave>` y es ADITIVO: lo de siempre (`current`, `playlist`,
 * `master`) lo sigue escribiendo `services/choirSessionService.ts`, así que un
 * móvil con MCM App sigue al maestro del fork canción a canción (D-10).
 *
 *   state                 ← estado completo del protocolo (LiveState)
 *   masters/<deviceId>    ← varios maestros { name, joinedAt, at }
 *   masterPinHash         ← huella del PIN de maestro (D-08)
 *   presence/<deviceId>   ← quién sigue { name, inst, app, via, at }
 *   avisos/<id>           ← avisos del maestro (se podan: los últimos 20)
 *   reacciones/<deviceId> ← la última reacción de cada uno (acota el tamaño
 *                            y hace de límite de ritmo: 1 por dispositivo)
 *
 * Las reglas de hoy ya permiten escribir en `choirSessions/<clave>` a quien
 * tenga la clave: no hace falta tocarlas (`04` §4).
 */
import {
  getDatabase,
  onDisconnect,
  ref,
  remove,
  runTransaction,
  set,
  update,
} from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { logger } from '@/utils/logger';
import {
  MAX_AVISOS,
  type Aviso,
  type Instrumento,
  type LiveState,
  type LiveTransport,
  type PresenceEntry,
  type Reaccion,
} from './protocol';

const ROOT = 'choirSessions';

function nodeRef(key: string, sub = '') {
  return ref(
    getDatabase(getFirebaseApp()),
    `${ROOT}/${key}${sub ? `/${sub}` : ''}`,
  );
}

/** Firebase no admite `undefined`: fuera antes de escribir. */
function clean<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

/**
 * Publica el estado del maestro SOLO si es más nuevo que el que hay
 * (transacción sobre `state`): si dos maestros pulsan a la vez, gana uno y
 * el otro ve el resultado. Devuelve si se escribió.
 */
export async function publishLiveState(
  key: string,
  state: LiveState,
): Promise<boolean> {
  const res = await runTransaction(
    nodeRef(key, 'state'),
    (current: LiveState | null) => {
      if (current && current.sessionId === state.sessionId) {
        if (current.seq >= state.seq) return undefined;
      }
      return clean(state);
    },
  );
  return res.committed;
}

/** Se apunta como maestro (y guarda la huella del PIN si es quien lo abre). */
export async function registerMaster(
  key: string,
  who: { deviceId: string; name?: string },
  opts: { pinHash?: string; now: number },
): Promise<void> {
  const patch: Record<string, unknown> = {
    [`masters/${who.deviceId}`]: clean({
      name: who.name,
      joinedAt: opts.now,
      at: opts.now,
    }),
  };
  if (opts.pinHash) patch.masterPinHash = opts.pinHash;
  await update(nodeRef(key), patch);
}

export async function unregisterMaster(
  key: string,
  deviceId: string,
): Promise<void> {
  await remove(nodeRef(key, `masters/${deviceId}`));
}

/**
 * Presencia de quien sigue: se borra sola al perder la conexión
 * (`onDisconnect`) y se refresca con `heartbeatPresence` cada 30 s.
 */
export async function registerPresence(
  key: string,
  deviceId: string,
  entry: Omit<PresenceEntry, 'at'>,
  now: number,
): Promise<void> {
  const r = nodeRef(key, `presence/${deviceId}`);
  try {
    await onDisconnect(r).remove();
  } catch (e) {
    logger.warn('[directo] onDisconnect de presencia', e);
  }
  await set(r, clean({ ...entry, app: 'cantoral', via: 'cloud', at: now }));
}

export async function heartbeatPresence(
  key: string,
  deviceId: string,
  now: number,
): Promise<void> {
  await update(nodeRef(key, `presence/${deviceId}`), { at: now });
}

export async function removePresence(
  key: string,
  deviceId: string,
): Promise<void> {
  await remove(nodeRef(key, `presence/${deviceId}`));
}

/**
 * Manda un aviso. `sentIds` son los que este maestro ya ha mandado: se borran
 * los más viejos para dejar como mucho `MAX_AVISOS` (poda barata, sin leer).
 */
export async function sendAviso(
  key: string,
  aviso: Aviso,
  sentIds: string[],
): Promise<string[]> {
  const patch: Record<string, unknown> = {
    [`avisos/${aviso.id}`]: clean(aviso),
  };
  const ids = [...sentIds, aviso.id];
  const drop =
    ids.length > MAX_AVISOS ? ids.slice(0, ids.length - MAX_AVISOS) : [];
  for (const id of drop) patch[`avisos/${id}`] = null;
  await update(nodeRef(key), patch);
  return ids.slice(drop.length);
}

/** La última reacción de este dispositivo (una por persona: límite de ritmo). */
export async function sendReaccion(
  key: string,
  deviceId: string,
  reaccion: Reaccion,
): Promise<void> {
  await set(nodeRef(key, `reacciones/${deviceId}`), clean(reaccion));
}

/** Lo nuevo del directo que viene dentro del nodo de la sesión (si lo hay). */
export interface CloudLiveExtras {
  state: LiveState | null;
  avisos: Aviso[];
  reacciones: Reaccion[];
  presence: Record<string, PresenceEntry>;
  masters: Record<string, { name?: string; joinedAt: number; at: number }>;
  masterPinHash: string | null;
}

/**
 * Saca lo del protocolo del nodo `/choirSessions/<clave>` que ya escucha
 * `ChoirSessionContext`. Tolerante: lo que no tenga forma se ignora (puede
 * ser una sesión de MCM App, que no trae nada de esto).
 */
export function readCloudExtras(node: unknown): CloudLiveExtras {
  const n = (node && typeof node === 'object' ? node : {}) as Record<
    string,
    unknown
  >;
  const obj = (v: unknown) =>
    v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
  const state =
    n.state && typeof n.state === 'object' && 'seq' in (n.state as object)
      ? (n.state as LiveState)
      : null;
  const avisos = Object.values(obj(n.avisos)).filter(
    (a): a is Aviso =>
      !!a && typeof a === 'object' && (a as Aviso).t === 'aviso',
  );
  const reacciones = Object.values(obj(n.reacciones)).filter(
    (r): r is Reaccion =>
      !!r && typeof r === 'object' && (r as Reaccion).t === 'reaccion',
  );
  return {
    state,
    avisos,
    reacciones,
    presence: obj(n.presence) as Record<string, PresenceEntry>,
    masters: obj(n.masters) as CloudLiveExtras['masters'],
    masterPinHash: typeof n.masterPinHash === 'string' ? n.masterPinHash : null,
  };
}

/** Presencia como la escribe este fork (para la UI del maestro). */
export function presenceEntry(o: {
  name?: string;
  inst?: Instrumento[];
  via?: LiveTransport;
}): Omit<PresenceEntry, 'at'> {
  return { name: o.name, inst: o.inst, via: o.via ?? 'cloud', app: 'cantoral' };
}
