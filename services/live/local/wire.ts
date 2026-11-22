/**
 * Tipos del CABLE de la wifi local (`04-directo.md` §5): lo que viaja por el
 * socket TCP entre el equipo base (o el maestro que sirve) y los demás.
 *
 * Una línea = un mensaje JSON. Hay dos familias, distinguidas por su clave
 * de primer nivel:
 *  - los `LiveMessage` del protocolo (`{ type: 'state' | 'event', … }`),
 *    tal cual, sin envolver: el directo es el MISMO que por la nube;
 *  - los mensajes de CONTROL de este camino (`{ op: '…', … }`): saludo,
 *    latido, órdenes del maestro y paso del cantoral.
 */
import type {
  Instrumento,
  LiveMessage,
  LiveState,
} from '@/services/live/protocol';

/** Versión del cable (para poder cambiarlo sin romper apps viejas). */
export const WIRE_VERSION = 1;

export type WireRole = 'follower' | 'master';

/** Primer mensaje de quien se conecta. */
export interface HelloMsg {
  op: 'hello';
  v?: number;
  deviceId: string;
  name?: string;
  inst?: Instrumento[];
  /** Versión del cantoral de quien llega (ms): si es menor, se le ofrece. */
  catalogUpdatedAt: number;
  role: WireRole;
  /** Solo maestros: `pinHash(pin, sessionId)`. Nunca el PIN en claro. */
  pin?: string;
  app?: 'cantoral' | 'mcmapp';
}

/** Respuesta del servidor al saludo. */
export interface WelcomeMsg {
  op: 'welcome';
  serverId: string;
  /** Estado actual (`null` si el directo aún no ha arrancado). */
  state: LiveState | null;
  /** ¿Se le ha reconocido como maestro con PIN correcto? */
  master?: boolean;
}

/** Latido. El servidor lo manda cada `HEARTBEAT_MS`; el cliente responde. */
export interface PingMsg {
  op: 'ping';
  at: number;
  /** Solo en el latido del servidor: último `seq` (detecta mensajes perdidos). */
  seq?: number;
  /** Solo en el latido del servidor: los maestros conectados (para el relevo). */
  masters?: { deviceId: string; joinedAt: number }[];
}
export interface PongMsg {
  op: 'pong';
  at: number;
}

/** Orden del maestro al servidor: un estado nuevo o un evento. */
export interface CommandMsg {
  op: 'command';
  /** Número de orden, para correlacionar con `ack`/`error`. */
  id?: number;
  msg: LiveMessage;
}

export interface AckMsg {
  op: 'ack';
  id?: number;
}

export type WireErrorCode =
  'pin' | 'not-hello' | 'stale' | 'bad-session' | 'bad-message';

export interface ErrorMsg {
  op: 'error';
  code: WireErrorCode;
  id?: number;
}

/** «Tengo un cantoral más nuevo que el tuyo.» */
export interface CatalogOfferMsg {
  op: 'catalog-offer';
  updatedAt: number;
  bytes: number;
  sha256: string;
  chunks: number;
}

/** Pide trozos `from … from+count-1` del cantoral ofrecido (reanuda desde `from`). */
export interface CatalogRequestMsg {
  op: 'catalog-request';
  updatedAt: number;
  sha256: string;
  from: number;
  count: number;
}

/** Un trozo (texto del JSON del catálogo). */
export interface CatalogChunkMsg {
  op: 'catalog-chunk';
  updatedAt: number;
  i: number;
  n: number;
  data: string;
}

/** El cliente avisa de que ya lo tiene entero (libera su turno) o desiste. */
export interface CatalogDoneMsg {
  op: 'catalog-done';
  updatedAt: number;
  ok?: boolean;
}

export type ControlMsg =
  | HelloMsg
  | WelcomeMsg
  | PingMsg
  | PongMsg
  | CommandMsg
  | AckMsg
  | ErrorMsg
  | CatalogOfferMsg
  | CatalogRequestMsg
  | CatalogChunkMsg
  | CatalogDoneMsg;

export type WireMessage = LiveMessage | ControlMsg;

/** Lo mínimo que necesitan hub y cliente de un socket (Node, RN o un falso). */
export interface LiveSocket {
  /** Escribe texto ya terminado en `\n`. */
  write(line: string): void;
  /** Cierra la conexión. */
  end(): void;
  /** Texto recibido (en trozos arbitrarios). */
  onData(cb: (chunk: string) => void): void;
  /** La conexión se cerró o falló. */
  onClose(cb: () => void): void;
}

/** Tamaño de cada trozo del cantoral (caracteres de JSON). */
export const CATALOG_CHUNK_SIZE = 32 * 1024;
