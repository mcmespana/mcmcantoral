/**
 * LocalHub: la lógica del SERVIDOR de la wifi del coro (el equipo base, o el
 * maestro que sirve tras un relevo; `04-directo.md` §5.2).
 *
 * No sabe nada de sockets reales: recibe `LiveSocket`s ya abiertos con
 * `attach` (el adaptador de `native.ts` o los `net` de Node en los tests).
 * Hace cuatro cosas:
 *  1. guarda el ESTADO del directo (con `liveReducer`) y lo reparte a todos;
 *  2. acepta órdenes solo de maestros con el PIN correcto (o del dueño del
 *     equipo, por `ownerCommand`);
 *  3. lleva la PRESENCIA (vía `local`) y el LATIDO (`HEARTBEAT_MS`), y
 *     desconecta a quien deja de contestar;
 *  4. reparte el CANTORAL más nuevo que conozca (`04` §5.6), en trozos con
 *     sha256, escalonado (máximo N envíos a la vez) y reanudable.
 */
import { LineDecoder, encodeLine } from '@/services/live/local/framing';
import {
  CATALOG_CHUNK_SIZE,
  WIRE_VERSION,
  type CatalogRequestMsg,
  type HelloMsg,
  type LiveSocket,
  type WireErrorCode,
  type WireMessage,
} from '@/services/live/local/wire';
import {
  EMPTY_VIEW,
  HEARTBEAT_MS,
  MISSED_BEATS,
  liveReducer,
  type LiveMessage,
  type LiveState,
  type LiveView,
  type PresenceEntry,
} from '@/services/live/protocol';
import { logger } from '@/utils/logger';
import { sha256Hex } from '@/utils/sha256';

/** Cuántos trozos como máximo se sirven por petición. */
const MAX_WINDOW = 16;

export interface LocalHubOptions {
  /** Identificador de este servidor (el `deviceId` del equipo). */
  serverId: string;
  /** La clave del directo (`/choirSessions/<clave>`). */
  sessionId: string;
  /** Nombre legible para el anuncio Bonjour («Villancicos · dirige David»). */
  name?: string;
  /** Estado de partida (p. ej. el relevo hereda el último `seq`). */
  initialState?: LiveState | null;
  /** `pinHash(pin, sessionId)` de los maestros; `null` = nadie puede mandar. */
  masterPinHash?: string | null;
  heartbeatMs?: number;
  missedBeats?: number;
  /** Máximo de cantorales sirviéndose a la vez. */
  maxTransfers?: number;
  chunkSize?: number;
  /** Si un envío lleva tanto sin pedir trozos, pierde el turno. */
  transferIdleMs?: number;
  now?: () => number;
  onView?: (view: LiveView) => void;
  onPresence?: (presence: Record<string, PresenceEntry>) => void;
}

interface Conn {
  id: number;
  socket: LiveSocket;
  decoder: LineDecoder;
  hello: HelloMsg | null;
  master: boolean;
  lastSeen: number;
  closed: boolean;
  /** Última petición de trozos pendiente de turno. */
  pending: CatalogRequestMsg | null;
  lastTransferAt: number;
}

interface CatalogBlob {
  updatedAt: number;
  sha256: string;
  bytes: number;
  chunks: string[];
}

/** Bytes que ocupa un texto en UTF-8 (sin depender de `TextEncoder`). */
export function utf8Length(text: string): number {
  let n = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      n += 4;
      i += 1;
    } else n += 3;
  }
  return n;
}

export class LocalHub {
  readonly serverId: string;
  readonly sessionId: string;
  readonly name?: string;

  private readonly hb: number;
  private readonly missed: number;
  private readonly maxTransfers: number;
  private readonly chunkSize: number;
  private readonly transferIdleMs: number;
  private readonly now: () => number;
  private readonly opts: LocalHubOptions;

  private view: LiveView;
  private masterPinHash: string | null;
  private conns = new Map<number, Conn>();
  private byDevice = new Map<string, Conn>();
  /** Primera vez que cada dispositivo entró (prioridad de relevo). */
  private joinedAt = new Map<string, number>();
  private nextId = 1;
  private timer: ReturnType<typeof setInterval> | null = null;
  private catalog: CatalogBlob | null = null;
  private active = new Set<Conn>();
  private queue: Conn[] = [];

  constructor(opts: LocalHubOptions) {
    this.opts = opts;
    this.serverId = opts.serverId;
    this.sessionId = opts.sessionId;
    this.name = opts.name;
    this.hb = opts.heartbeatMs ?? HEARTBEAT_MS;
    this.missed = opts.missedBeats ?? MISSED_BEATS;
    this.maxTransfers = opts.maxTransfers ?? 4;
    this.chunkSize = opts.chunkSize ?? CATALOG_CHUNK_SIZE;
    this.transferIdleMs = opts.transferIdleMs ?? 20_000;
    this.now = opts.now ?? Date.now;
    this.masterPinHash = opts.masterPinHash ?? null;
    this.view = opts.initialState
      ? { ...EMPTY_VIEW, state: opts.initialState }
      : EMPTY_VIEW;
  }

  // ─── Ciclo de vida ──────────────────────────────────────────────────────

  /** Arranca el latido. */
  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), this.hb);
  }

  /** Para el latido y cierra todas las conexiones. */
  stop(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    for (const c of [...this.conns.values()]) this.drop(c);
  }

  /** Cambia el PIN de maestros (`pinHash`). */
  setMasterPinHash(hash: string | null): void {
    this.masterPinHash = hash;
  }

  /** Une un socket recién aceptado. Devuelve el id de la conexión. */
  attach(socket: LiveSocket): number {
    const conn: Conn = {
      id: this.nextId++,
      socket,
      decoder: new LineDecoder(),
      hello: null,
      master: false,
      lastSeen: this.now(),
      closed: false,
      pending: null,
      lastTransferAt: 0,
    };
    this.conns.set(conn.id, conn);
    socket.onData((chunk) => {
      if (conn.closed) return;
      const res = conn.decoder.push(chunk);
      if (res.overflow) {
        logger.warn('LocalHub: línea demasiado larga, se cierra la conexión');
        this.drop(conn);
        return;
      }
      for (const m of res.messages) {
        if (conn.closed) return;
        this.onMessage(conn, m);
      }
    });
    socket.onClose(() => this.release(conn, true));
    return conn.id;
  }

  // ─── Estado ─────────────────────────────────────────────────────────────

  getView(): LiveView {
    return this.view;
  }

  getState(): LiveState | null {
    return this.view.state;
  }

  /** Versión del cantoral que este servidor puede repartir (0 = ninguno). */
  get catalogUpdatedAt(): number {
    return this.catalog?.updatedAt ?? 0;
  }

  get connectionCount(): number {
    return this.conns.size;
  }

  /** Cuántos envíos del cantoral hay en curso ahora mismo (tests/diagnóstico). */
  get activeTransfers(): number {
    return this.active.size;
  }

  /** Quién sigue ahora, con su vía `local`. */
  presence(): Record<string, PresenceEntry> {
    const out: Record<string, PresenceEntry> = {};
    for (const c of this.conns.values()) {
      if (!c.hello) continue;
      out[c.hello.deviceId] = {
        name: c.hello.name,
        inst: c.hello.inst,
        app: c.hello.app ?? 'cantoral',
        via: 'local',
        at: c.lastSeen,
      };
    }
    return out;
  }

  /** Los maestros conectados, con su orden de entrada. */
  masters(): { deviceId: string; joinedAt: number }[] {
    const out: { deviceId: string; joinedAt: number }[] = [];
    for (const c of this.conns.values()) {
      if (c.hello && c.master) {
        out.push({
          deviceId: c.hello.deviceId,
          joinedAt: this.joinedAt.get(c.hello.deviceId) ?? c.lastSeen,
        });
      }
    }
    return out;
  }

  /** Orden del dueño del equipo (sin PIN). `false` si no cambia nada. */
  ownerCommand(msg: LiveMessage): boolean {
    return this.apply(msg) === 'ok';
  }

  /**
   * Cantoral que este servidor reparte (el suyo o el de un maestro). Solo
   * sustituye a uno más viejo. Ofrece el nuevo a quien lo tenga más antiguo.
   */
  setCatalog(updatedAt: number, json: string): boolean {
    if (this.catalog && updatedAt <= this.catalog.updatedAt) return false;
    const chunks: string[] = [];
    for (let i = 0; i < json.length; i += this.chunkSize) {
      chunks.push(json.slice(i, i + this.chunkSize));
    }
    if (chunks.length === 0) chunks.push('');
    this.catalog = {
      updatedAt,
      sha256: sha256Hex(json),
      bytes: utf8Length(json),
      chunks,
    };
    // Los envíos del cantoral viejo ya no sirven: que pidan el nuevo.
    this.active.clear();
    this.queue = [];
    for (const c of this.conns.values()) {
      c.pending = null;
      this.offerCatalog(c);
    }
    return true;
  }

  // ─── Mensajes entrantes ─────────────────────────────────────────────────

  private onMessage(conn: Conn, m: WireMessage): void {
    conn.lastSeen = this.now();
    if ('type' in m) {
      // Un LiveMessage suelto: los clientes mandan órdenes dentro de `command`.
      this.send(conn, { op: 'error', code: 'bad-message' });
      return;
    }
    if (m.op === 'hello') {
      this.onHello(conn, m);
      return;
    }
    if (!conn.hello) {
      this.send(conn, { op: 'error', code: 'not-hello' });
      return;
    }
    switch (m.op) {
      case 'ping':
        this.send(conn, { op: 'pong', at: m.at });
        break;
      case 'command': {
        if (!conn.master) {
          this.send(conn, { op: 'error', code: 'pin', id: m.id });
          break;
        }
        const r = this.apply(m.msg);
        if (r === 'ok' || r === 'dup') this.send(conn, { op: 'ack', id: m.id });
        else this.send(conn, { op: 'error', code: r, id: m.id });
        break;
      }
      case 'catalog-request':
        this.onCatalogRequest(conn, m);
        break;
      case 'catalog-done':
        if (m.ok && conn.hello) conn.hello.catalogUpdatedAt = m.updatedAt;
        this.release(conn, false);
        break;
      default:
        break; // pong, ack… solo cuentan como señal de vida
    }
  }

  private onHello(conn: Conn, hello: HelloMsg): void {
    const authorized =
      hello.role === 'master' &&
      this.masterPinHash !== null &&
      hello.pin === this.masterPinHash;
    conn.hello = hello;
    conn.master = authorized;
    // El mismo dispositivo reconectando sustituye a su conexión anterior.
    const prev = this.byDevice.get(hello.deviceId);
    if (prev && prev !== conn) this.drop(prev);
    this.byDevice.set(hello.deviceId, conn);
    if (!this.joinedAt.has(hello.deviceId)) {
      this.joinedAt.set(hello.deviceId, this.now());
    }
    this.send(conn, {
      op: 'welcome',
      serverId: this.serverId,
      state: this.view.state,
      master: authorized,
    });
    if (hello.role === 'master' && !authorized) {
      this.send(conn, { op: 'error', code: 'pin' });
    }
    this.offerCatalog(conn);
    this.opts.onPresence?.(this.presence());
    logger.debug(
      `LocalHub: hola de ${hello.deviceId} (v${hello.v ?? WIRE_VERSION}, ${hello.role}${authorized ? ' ok' : ''})`,
    );
  }

  /** Aplica una orden al estado y la reparte. */
  private apply(msg: LiveMessage): 'ok' | 'dup' | WireErrorCode {
    if (msg.type === 'state' && msg.state.sessionId !== this.sessionId) {
      return 'bad-session';
    }
    const next = liveReducer(this.view, msg, this.now());
    if (next === this.view) return msg.type === 'state' ? 'stale' : 'dup';
    this.view = next;
    this.broadcast(msg);
    this.opts.onView?.(next);
    return 'ok';
  }

  // ─── Envío ──────────────────────────────────────────────────────────────

  private send(conn: Conn, msg: WireMessage): void {
    if (conn.closed) return;
    try {
      conn.socket.write(encodeLine(msg));
    } catch (e) {
      logger.warn('LocalHub: no se pudo escribir', e);
      this.drop(conn);
    }
  }

  private broadcast(msg: WireMessage): void {
    for (const c of [...this.conns.values()]) {
      if (c.hello) this.send(c, msg);
    }
  }

  private drop(conn: Conn): void {
    if (conn.closed) return;
    try {
      conn.socket.end();
    } catch {
      // ya estaba cerrado
    }
    this.release(conn, true);
  }

  /**
   * Libera el turno de envío de `conn` y, si `gone`, olvida la conexión.
   */
  private release(conn: Conn, gone: boolean): void {
    this.active.delete(conn);
    this.queue = this.queue.filter((c) => c !== conn);
    conn.pending = null;
    if (gone && !conn.closed) {
      conn.closed = true;
      this.conns.delete(conn.id);
      if (conn.hello && this.byDevice.get(conn.hello.deviceId) === conn) {
        this.byDevice.delete(conn.hello.deviceId);
      }
      this.opts.onPresence?.(this.presence());
    }
    this.pump();
  }

  // ─── Latido ─────────────────────────────────────────────────────────────

  private tick(): void {
    const now = this.now();
    const limit = this.hb * this.missed;
    for (const c of [...this.conns.values()]) {
      if (now - c.lastSeen > limit) {
        logger.debug(`LocalHub: conexión ${c.id} sin señales, se cierra`);
        this.drop(c);
      }
    }
    // Un envío parado pierde el turno (volverá a pedirlo y hará cola).
    for (const c of [...this.active]) {
      if (now - c.lastTransferAt > this.transferIdleMs) this.release(c, false);
    }
    const masters = this.masters();
    const ping: WireMessage = {
      op: 'ping',
      at: now,
      seq: this.view.state?.seq,
      masters,
    };
    for (const c of [...this.conns.values()]) {
      if (c.hello) this.send(c, ping);
    }
  }

  // ─── Cantoral ───────────────────────────────────────────────────────────

  private offerCatalog(conn: Conn): void {
    const cat = this.catalog;
    if (!cat || !conn.hello) return;
    if (conn.hello.catalogUpdatedAt >= cat.updatedAt) return;
    this.send(conn, {
      op: 'catalog-offer',
      updatedAt: cat.updatedAt,
      bytes: cat.bytes,
      sha256: cat.sha256,
      chunks: cat.chunks.length,
    });
  }

  private onCatalogRequest(conn: Conn, req: CatalogRequestMsg): void {
    const cat = this.catalog;
    if (!cat || cat.sha256 !== req.sha256) {
      // Ya no tengo ese cantoral: que espere la oferta nueva.
      this.send(conn, { op: 'error', code: 'stale' });
      this.offerCatalog(conn);
      return;
    }
    conn.pending = req;
    conn.lastTransferAt = this.now();
    if (!this.active.has(conn) && !this.queue.includes(conn)) {
      this.queue.push(conn);
    }
    this.pump();
  }

  /** Da turno a los que esperan (hasta `maxTransfers`) y sirve lo pedido. */
  private pump(): void {
    while (this.active.size < this.maxTransfers && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) this.active.add(next);
    }
    for (const c of this.active) {
      if (c.pending) this.serve(c);
    }
  }

  private serve(conn: Conn): void {
    const req = conn.pending;
    const cat = this.catalog;
    conn.pending = null;
    if (!req || !cat) return;
    conn.lastTransferAt = this.now();
    const from = Math.max(0, Math.floor(req.from));
    const to = Math.min(
      cat.chunks.length,
      from + Math.max(1, Math.min(MAX_WINDOW, Math.floor(req.count))),
    );
    for (let i = from; i < to; i++) {
      this.send(conn, {
        op: 'catalog-chunk',
        updatedAt: cat.updatedAt,
        i,
        n: cat.chunks.length,
        data: cat.chunks[i] ?? '',
      });
    }
  }
}
