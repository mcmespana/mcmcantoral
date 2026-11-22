/**
 * Adaptadores REALES de la wifi del coro (iOS y Android): TCP con
 * `react-native-tcp-socket` y anuncio/descubrimiento Bonjour con
 * `react-native-zeroconf` (`04-directo.md` §5.1).
 *
 * Aquí no hay lógica del directo (está en `hub.ts` y `client.ts`): solo se
 * convierten los sockets y el mDNS de las librerías en un `LiveSocket`.
 * En la web existe `native.web.ts`, que exporta lo mismo como no disponible.
 */
import TcpSocket from 'react-native-tcp-socket';
import Zeroconf from 'react-native-zeroconf';

import type { LocalClient } from '@/services/live/local/client';
import type { LocalHub } from '@/services/live/local/hub';
import type { LiveSocket } from '@/services/live/local/wire';
import { logger } from '@/utils/logger';

/** ¿Esta plataforma puede servir y seguir por wifi local? */
export const LOCAL_LIVE_AVAILABLE = true;

/** Tipo de servicio Bonjour (sin guion bajo, como lo pide la librería). */
export const BONJOUR_TYPE = 'mcmcantoral';
export const BONJOUR_PROTOCOL = 'tcp';
/** Puerto de serie del servidor (el real viaja por Bonjour y por el QR). */
export const LOCAL_DEFAULT_PORT = 47821;
/** Segundos sin conectar antes de dar el intento por fallido. */
const CONNECT_TIMEOUT_MS = 6_000;

type RnSocket = ReturnType<typeof TcpSocket.createConnection>;

/**
 * Envuelve un socket de la librería. Si `waitConnect`, lo escrito antes de
 * que abra se guarda y sale al conectar (el cliente saluda nada más crear).
 */
function wrap(sock: RnSocket, waitConnect: boolean): LiveSocket {
  let open = !waitConnect;
  let closed = false;
  const queue: string[] = [];
  let dataCb: ((chunk: string) => void) | null = null;
  let closeCb: (() => void) | null = null;

  const fireClose = () => {
    if (closed) return;
    closed = true;
    closeCb?.();
  };

  sock.setEncoding('utf8');
  sock.setNoDelay(true);
  sock.on('connect', () => {
    open = true;
    for (const line of queue.splice(0)) sock.write(line);
  });
  sock.on('data', (data) => {
    dataCb?.(typeof data === 'string' ? data : String(data));
  });
  sock.on('error', (e) => {
    logger.debug('LocalLive: error de socket', e);
    try {
      sock.destroy();
    } catch {
      // ya estaba destruido
    }
    fireClose();
  });
  sock.on('close', fireClose);

  return {
    write(line) {
      if (closed) return;
      if (open) sock.write(line);
      else queue.push(line);
    },
    end() {
      try {
        sock.destroy();
      } catch {
        // ya cerrado
      }
      fireClose();
    },
    onData(cb) {
      dataCb = cb;
    },
    onClose(cb) {
      closeCb = cb;
      if (closed) cb();
    },
  };
}

// ─── Servidor ────────────────────────────────────────────────────────────────

export interface LocalServerHandle {
  /** Puerto en el que escucha. */
  port: number;
  stop: () => Promise<void>;
}

/**
 * Abre el servidor TCP, lo anuncia por Bonjour (con la clave del directo en el
 * TXT) y arranca el latido del hub. Rechaza si no puede escuchar.
 */
export async function startLocalServer(
  hub: LocalHub,
  port: number = LOCAL_DEFAULT_PORT,
): Promise<LocalServerHandle> {
  const server = TcpSocket.createServer((socket) => {
    hub.attach(wrap(socket as unknown as RnSocket, false));
  });

  const boundPort = await new Promise<number>((resolve, reject) => {
    server.on('error', (e) => reject(e));
    server.listen({ port, host: '0.0.0.0' }, () => {
      resolve(server.address()?.port ?? port);
    });
  });
  hub.start();

  let zeroconf: Zeroconf | null = null;
  let published: string | null = null;
  try {
    zeroconf = new Zeroconf();
    const name = hub.name ?? 'Directo MCM';
    const svc = await zeroconf.publishService({
      type: BONJOUR_TYPE,
      protocol: BONJOUR_PROTOCOL,
      name,
      port: boundPort,
      txt: {
        v: '1',
        s: hub.sessionId,
        id: hub.serverId,
        n: name,
        cu: String(hub.catalogUpdatedAt),
      },
    });
    published = svc.name;
  } catch (e) {
    // Sin Bonjour el directo sigue vivo: se entra con el QR (ip:puerto).
    logger.warn('LocalLive: no se pudo anunciar por Bonjour', e);
  }

  return {
    port: boundPort,
    stop: async () => {
      hub.stop();
      try {
        server.close();
      } catch {
        // ya cerrado
      }
      if (zeroconf && published) {
        try {
          await zeroconf.unpublishService(published);
        } catch (e) {
          logger.debug('LocalLive: unpublish', e);
        }
      }
      zeroconf?.removeDeviceListeners();
    },
  };
}

// ─── Cliente ─────────────────────────────────────────────────────────────────

function dialTcp(host: string, port: number): LiveSocket {
  const sock = TcpSocket.createConnection(
    { host, port, connectTimeout: CONNECT_TIMEOUT_MS },
    () => {},
  );
  return wrap(sock, true);
}

/**
 * Conecta `client` al servidor `host:port` (con reconexión automática).
 * Devuelve la función que lo para.
 */
export function connectLocal(
  host: string,
  port: number,
  client: LocalClient,
): () => void {
  client.start(() => dialTcp(host, port));
  return () => client.stop();
}

// ─── Descubrimiento ──────────────────────────────────────────────────────────

export interface FoundLive {
  /** Nombre legible («Villancicos Solidarios · dirige David»). */
  title: string;
  /** Nombre del servicio Bonjour (clave para `onLost`). */
  service: string;
  /** La clave del directo. */
  sessionId?: string;
  serverId?: string;
  host: string;
  port: number;
  catalogUpdatedAt?: number;
}

/**
 * Busca directos por Bonjour. `onFound` se llama al resolver cada servicio y
 * `onLost` cuando desaparece. Devuelve la función que para la búsqueda.
 */
export function discoverLive(
  onFound: (found: FoundLive) => void,
  onLost?: (service: string) => void,
): () => void {
  const zeroconf = new Zeroconf();
  zeroconf.on('resolved', (svc) => {
    const host = svc.ipv4[0] ?? svc.ipv6[0] ?? svc.addresses[0];
    if (!host) return;
    const cu = Number(svc.txt.cu);
    onFound({
      title: svc.txt.n || svc.name,
      service: svc.name,
      sessionId: svc.txt.s,
      serverId: svc.txt.id,
      host,
      port: svc.port,
      catalogUpdatedAt: Number.isFinite(cu) ? cu : undefined,
    });
  });
  zeroconf.on('remove', (name) => onLost?.(name));
  zeroconf.on('error', (e) => logger.debug('LocalLive: zeroconf', e));
  zeroconf.scan({ type: BONJOUR_TYPE, protocol: BONJOUR_PROTOCOL });
  return () => {
    try {
      zeroconf.stop();
    } catch {
      // nada que parar
    }
    zeroconf.removeDeviceListeners();
  };
}
