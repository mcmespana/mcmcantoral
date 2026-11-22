/**
 * LocalClient: la lógica del SEGUIDOR (o del maestro) conectado al servidor
 * de la wifi del coro (`04-directo.md` §5).
 *
 * Igual que `LocalHub`, no abre sockets: recibe una función `dial` que crea
 * uno nuevo cada vez (el adaptador de `native.ts`, o `net` en los tests).
 * Se encarga de:
 *  - saludar (`hello`) y aplicar con `liveReducer` lo que llega;
 *  - reconectar con espera creciente (y algo de azar: 60 móviles no deben
 *    llamar a la vez tras un corte);
 *  - dar el servidor por caído si pasan `MISSED_BEATS` latidos sin oír nada;
 *  - reensamblar el cantoral que ofrece el servidor, verificando su sha256,
 *    y entregar el `Catalog` ya parseado a `onCatalog` (la app llama a
 *    `catalogStore.applyExternal`). Si se corta a mitad, reanuda desde el
 *    último trozo recibido.
 */
import { LineDecoder, encodeLine } from '@/services/live/local/framing';
import type {
  CatalogOfferMsg,
  ControlMsg,
  LiveSocket,
  WireMessage,
  WireRole,
} from '@/services/live/local/wire';
import { WIRE_VERSION } from '@/services/live/local/wire';
import type { Catalog } from '@/services/catalog/types';
import {
  EMPTY_VIEW,
  HEARTBEAT_MS,
  MISSED_BEATS,
  liveReducer,
  pinHash,
  type Instrumento,
  type LiveEvent,
  type LiveMessage,
  type LiveState,
  type LiveView,
} from '@/services/live/protocol';
import { logger } from '@/utils/logger';
import { sha256Hex } from '@/utils/sha256';

export type LocalClientStatus =
  'idle' | 'connecting' | 'online' | 'reconnecting' | 'stopped';

export interface LocalClientOptions {
  deviceId: string;
  name?: string;
  inst?: Instrumento[];
  role?: WireRole;
  /** La clave del directo (hace falta para firmar el PIN). */
  sessionId: string;
  /** PIN de maestro en claro: nunca sale del dispositivo, viaja su huella. */
  pin?: string;
  /** Versión del cantoral que tiene este dispositivo ahora. */
  getCatalogUpdatedAt: () => number;
  heartbeatMs?: number;
  missedBeats?: number;
  /** Espera inicial y máxima de la reconexión (ms). */
  reconnectBaseMs?: number;
  reconnectMaxMs?: number;
  /** Trozos que se piden de una vez. */
  window?: number;
  /** Aceptar el cantoral nuevo sin preguntar («Actualizar siempre»). */
  autoAcceptCatalog?: boolean;
  now?: () => number;
  random?: () => number;
  onView?: (view: LiveView) => void;
  onStatus?: (status: LocalClientStatus) => void;
  /** Hay un cantoral más nuevo en el servidor (para el botón «Actualizar»). */
  onCatalogOffer?: (offer: CatalogOfferMsg) => void;
  /** Cantoral completo y verificado. */
  onCatalog?: (catalog: Catalog, updatedAt: number) => void;
  /** Se dio por caído el servidor (latidos perdidos o conexión cerrada). */
  onServerLost?: () => void;
  /** Welcome: quién sirve y si nos reconoce como maestro. */
  onWelcome?: (info: { serverId: string; master: boolean }) => void;
  /** Los maestros conectados, del último latido (para el relevo). */
  onMasters?: (masters: { deviceId: string; joinedAt: number }[]) => void;
  /** Error del servidor (PIN malo, orden vieja…). */
  onError?: (code: string, id?: number) => void;
}

interface PartialCatalog {
  updatedAt: number;
  sha256: string;
  chunks: number;
  parts: string[];
  /** Hasta qué trozo (exclusive) se ha pedido ya. */
  requestedTo: number;
}

export class LocalClient {
  private readonly o: LocalClientOptions;
  private readonly hb: number;
  private readonly missed: number;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly win: number;

  private dial: (() => LiveSocket) | null = null;
  private socket: LiveSocket | null = null;
  /** Generación: ignora lo que llegue de sockets ya descartados. */
  private gen = 0;
  private decoder = new LineDecoder();
  private status: LocalClientStatus = 'idle';
  private view: LiveView = EMPTY_VIEW;
  private lastRx = 0;
  private attempts = 0;
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private retry: ReturnType<typeof setTimeout> | null = null;
  private cmdId = 1;
  private offer: CatalogOfferMsg | null = null;
  private partial: PartialCatalog | null = null;
  /** Se ha aceptado el cantoral ofrecido (manual o automático). */
  private accepted = false;

  constructor(options: LocalClientOptions) {
    this.o = options;
    this.hb = options.heartbeatMs ?? HEARTBEAT_MS;
    this.missed = options.missedBeats ?? MISSED_BEATS;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.win = Math.max(1, options.window ?? 8);
  }

  // ─── Ciclo de vida ──────────────────────────────────────────────────────

  getStatus(): LocalClientStatus {
    return this.status;
  }

  getView(): LiveView {
    return this.view;
  }

  /** Cantoral ofrecido y aún sin aplicar. */
  getOffer(): CatalogOfferMsg | null {
    return this.offer;
  }

  /** Conecta (y reconecta sola hasta `stop`). */
  start(dial: () => LiveSocket): void {
    this.dial = dial;
    this.attempts = 0;
    this.connect();
    if (!this.watchdog) {
      this.watchdog = setInterval(() => this.check(), Math.max(1, this.hb / 2));
    }
  }

  stop(): void {
    this.setStatus('stopped');
    this.dial = null;
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.discard();
  }

  /** El dispositivo vuelve a primer plano: reconecta ya si estaba caído. */
  reconnectNow(): void {
    if (!this.dial || this.status === 'online') return;
    if (this.retry) clearTimeout(this.retry);
    this.retry = null;
    this.attempts = 0;
    this.connect();
  }

  // ─── Órdenes (maestro) ──────────────────────────────────────────────────

  /** Manda un estado nuevo (solo lo acepta el servidor si el PIN es bueno). */
  sendState(state: LiveState): number | null {
    return this.sendCommand({ type: 'state', state });
  }

  sendEvent(event: LiveEvent): number | null {
    return this.sendCommand({ type: 'event', event });
  }

  private sendCommand(msg: LiveMessage): number | null {
    if (this.status !== 'online') return null;
    const id = this.cmdId++;
    this.write({ op: 'command', id, msg });
    return id;
  }

  // ─── Cantoral ───────────────────────────────────────────────────────────

  /** «Actualizar»: pide el cantoral ofrecido (o sigue el que estaba a medias). */
  acceptCatalog(): void {
    this.accepted = true;
    this.requestMore();
  }

  // ─── Conexión ───────────────────────────────────────────────────────────

  private connect(): void {
    if (!this.dial) return;
    this.discard();
    this.setStatus(this.attempts === 0 ? 'connecting' : 'reconnecting');
    const gen = ++this.gen;
    this.decoder = new LineDecoder();
    this.lastRx = this.now();
    let socket: LiveSocket;
    try {
      socket = this.dial();
    } catch (e) {
      logger.warn('LocalClient: no se pudo abrir el socket', e);
      this.scheduleRetry();
      return;
    }
    this.socket = socket;
    socket.onData((chunk) => {
      if (gen !== this.gen) return;
      const res = this.decoder.push(chunk);
      if (res.overflow) {
        this.lose();
        return;
      }
      this.lastRx = this.now();
      for (const m of res.messages) {
        if (gen !== this.gen) return;
        this.onMessage(m);
      }
    });
    socket.onClose(() => {
      if (gen !== this.gen) return;
      this.lose();
    });
    this.write({
      op: 'hello',
      v: WIRE_VERSION,
      deviceId: this.o.deviceId,
      name: this.o.name,
      inst: this.o.inst,
      catalogUpdatedAt: this.o.getCatalogUpdatedAt(),
      role: this.o.role ?? 'follower',
      pin:
        this.o.role === 'master' && this.o.pin
          ? pinHash(this.o.pin, this.o.sessionId)
          : undefined,
      app: 'cantoral',
    });
  }

  /** Cierra el socket actual sin reintentar. */
  private discard(): void {
    this.gen += 1;
    const s = this.socket;
    this.socket = null;
    if (s) {
      try {
        s.end();
      } catch {
        // ya cerrado
      }
    }
  }

  /** Se perdió el servidor: avisa y reintenta con espera creciente. */
  private lose(): void {
    if (this.status === 'stopped' || !this.dial) return;
    const wasOnline = this.status === 'online';
    this.discard();
    if (wasOnline) this.o.onServerLost?.();
    this.scheduleRetry();
  }

  private scheduleRetry(): void {
    if (!this.dial || this.retry) return;
    this.setStatus('reconnecting');
    const base = this.o.reconnectBaseMs ?? 500;
    const max = this.o.reconnectMaxMs ?? 15_000;
    const wait = Math.min(max, base * 2 ** this.attempts);
    this.attempts += 1;
    const delay = Math.round(wait * (0.8 + this.random() * 0.4));
    this.retry = setTimeout(() => {
      this.retry = null;
      this.connect();
    }, delay);
  }

  /** Perro guardián: sin oír nada en `MISSED_BEATS` latidos, servidor caído. */
  private check(): void {
    if (!this.socket || this.status === 'stopped') return;
    if (this.now() - this.lastRx > this.hb * this.missed) {
      logger.debug('LocalClient: el servidor dejó de dar señales');
      this.lose();
    }
  }

  private write(msg: WireMessage): void {
    try {
      this.socket?.write(encodeLine(msg));
    } catch (e) {
      logger.warn('LocalClient: no se pudo escribir', e);
      this.lose();
    }
  }

  private setStatus(s: LocalClientStatus): void {
    if (this.status === s) return;
    this.status = s;
    this.o.onStatus?.(s);
  }

  // ─── Mensajes ───────────────────────────────────────────────────────────

  private onMessage(m: WireMessage): void {
    if ('type' in m) {
      this.applyLive(m);
      return;
    }
    this.onControl(m);
  }

  private applyLive(m: LiveMessage): void {
    const next = liveReducer(this.view, m, this.now());
    if (next === this.view) return;
    this.view = next;
    this.o.onView?.(next);
  }

  private onControl(m: ControlMsg): void {
    switch (m.op) {
      case 'welcome':
        this.attempts = 0;
        this.setStatus('online');
        this.o.onWelcome?.({ serverId: m.serverId, master: !!m.master });
        if (m.state) this.applyLive({ type: 'state', state: m.state });
        break;
      case 'ping':
        this.write({ op: 'pong', at: m.at });
        if (m.masters) this.o.onMasters?.(m.masters);
        break;
      case 'error':
        if (m.code === 'stale' && this.partial) {
          // El servidor cambió de cantoral: se descarta lo acumulado.
          this.partial = null;
        }
        this.o.onError?.(m.code, m.id);
        break;
      case 'catalog-offer':
        this.onOffer(m);
        break;
      case 'catalog-chunk':
        this.onChunk(m.updatedAt, m.i, m.n, m.data);
        break;
      default:
        break;
    }
  }

  private onOffer(offer: CatalogOfferMsg): void {
    if (offer.updatedAt <= this.o.getCatalogUpdatedAt()) return;
    this.offer = offer;
    if (this.partial && this.partial.sha256 !== offer.sha256) {
      this.partial = null;
    }
    this.o.onCatalogOffer?.(offer);
    if (this.o.autoAcceptCatalog || this.accepted) {
      this.accepted = true;
      this.requestMore();
    }
  }

  /** Pide la siguiente ventana de trozos, empezando por el primero que falta. */
  private requestMore(): void {
    const offer = this.offer;
    if (!offer || this.status !== 'online') return;
    if (!this.partial) {
      this.partial = {
        updatedAt: offer.updatedAt,
        sha256: offer.sha256,
        chunks: offer.chunks,
        parts: [],
        requestedTo: 0,
      };
    }
    const from = this.partial.parts.length;
    this.partial.requestedTo = from + this.win;
    this.write({
      op: 'catalog-request',
      updatedAt: offer.updatedAt,
      sha256: offer.sha256,
      from,
      count: this.win,
    });
  }

  private onChunk(updatedAt: number, i: number, n: number, data: string): void {
    const p = this.partial;
    if (!p || p.updatedAt !== updatedAt || p.chunks !== n) return;
    // Solo se admite el siguiente en orden: si hay hueco, se vuelve a pedir.
    if (i !== p.parts.length) return;
    p.parts.push(data);
    if (p.parts.length < p.chunks) {
      // Al acabar la ventana pedida, pide la siguiente.
      if (p.parts.length >= p.requestedTo) this.requestMore();
      return;
    }
    this.finishCatalog(p);
  }

  private finishCatalog(p: PartialCatalog): void {
    const text = p.parts.join('');
    const ok = sha256Hex(text) === p.sha256;
    let catalog: Catalog | null = null;
    if (ok) {
      try {
        const parsed: unknown = JSON.parse(text);
        if (
          typeof parsed === 'object' &&
          parsed !== null &&
          (parsed as { v?: unknown }).v === 1
        ) {
          catalog = parsed as Catalog;
        }
      } catch {
        catalog = null;
      }
    }
    this.partial = null;
    this.offer = null;
    this.accepted = false;
    this.write({ op: 'catalog-done', updatedAt: p.updatedAt, ok: !!catalog });
    if (catalog) {
      this.o.onCatalog?.(catalog, p.updatedAt);
    } else {
      logger.warn('LocalClient: el cantoral recibido no cuadra (sha256)');
      this.o.onError?.('catalog-corrupt');
    }
  }
}
