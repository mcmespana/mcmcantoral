/**
 * Web: no hay wifi local (`04-directo.md` §5.1). Un navegador no abre TCP ni
 * puede hablar `ws://` con una IP local desde una página HTTPS. Se exporta lo
 * mismo que `native.ts`, marcado como no disponible: en la web, solo nube.
 */
import type { LocalClient } from '@/services/live/local/client';
import type { LocalHub } from '@/services/live/local/hub';

export const LOCAL_LIVE_AVAILABLE = false;
export const BONJOUR_TYPE = 'mcmcantoral';
export const BONJOUR_PROTOCOL = 'tcp';
export const LOCAL_DEFAULT_PORT = 47821;

export interface LocalServerHandle {
  port: number;
  stop: () => Promise<void>;
}

export interface FoundLive {
  title: string;
  service: string;
  sessionId?: string;
  serverId?: string;
  host: string;
  port: number;
  catalogUpdatedAt?: number;
}

export async function startLocalServer(
  _hub: LocalHub,
  _port?: number,
): Promise<LocalServerHandle> {
  throw new Error('La wifi local no está disponible en la web');
}

export function connectLocal(
  _host: string,
  _port: number,
  _client: LocalClient,
): () => void {
  throw new Error('La wifi local no está disponible en la web');
}

export function discoverLive(
  _onFound: (found: FoundLive) => void,
  _onLost?: (service: string) => void,
): () => void {
  return () => {};
}
