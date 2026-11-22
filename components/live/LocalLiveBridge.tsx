/**
 * Puente del DIRECTO con la wifi del coro (`04-directo.md` §5). Sin interfaz:
 * vive dentro de `LiveProvider` y engancha el camino local según el papel.
 *
 *  - **Sirve** (el dueño del directo, o el maestro que toma el relevo): abre
 *    el servidor TCP, lo anuncia por Bonjour, le pasa cada estado/evento del
 *    maestro y reparte el cantoral a quien lo tenga más viejo.
 *  - **Se conecta** (quien sigue y los demás maestros, con PIN): busca el
 *    directo por Bonjour (o va a `host:puerto` si se entró por la lista
 *    «Cerca de ti»), recibe la vista y manda sus órdenes/reacciones.
 *  - **Relevo**: si el servidor deja de contestar y este maestro es el vivo
 *    más antiguo (`relayWinner`), pasa a servir con el último estado.
 *
 * En la web no hay TCP: no hace nada (`LOCAL_LIVE_AVAILABLE = false`).
 */
import { useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { useLive, keyOfSessionId } from '@/contexts/LiveContext';
import { useChoirSession } from '@/contexts/ChoirSessionContext';
import { useAppSettings } from '@/contexts/AppSettingsContext';
import { catalogStore } from '@/services/catalog';
import { LocalHub } from '@/services/live/local/hub';
import { LocalClient } from '@/services/live/local/client';
import {
  LOCAL_LIVE_AVAILABLE,
  connectLocal,
  discoverLive,
  startLocalServer,
  type FoundLive,
  type LocalServerHandle,
} from '@/services/live/local/native';
import {
  relayWinner,
  type LiveMessage,
  type LiveView,
} from '@/services/live/protocol';
import { logger } from '@/utils/logger';

/** Una vista entera (la del hub o la del cliente) como mensajes sueltos. */
export function viewToMessages(v: LiveView): LiveMessage[] {
  const out: LiveMessage[] = [];
  if (v.state) out.push({ type: 'state', state: v.state });
  for (const a of v.avisos) out.push({ type: 'event', event: a });
  for (const r of v.reacciones) out.push({ type: 'event', event: r });
  if (v.ended) out.push({ type: 'event', event: { t: 'fin', at: 0 } });
  return out;
}

function catalogUpdatedAt(): number {
  return catalogStore.getState().catalog?.songs?.updatedAt ?? 0;
}

export default function LocalLiveBridge() {
  const live = useLive();
  const choir = useChoirSession();
  const { settings } = useAppSettings();
  const {
    role,
    serving,
    localSession,
    masterPinHash,
    masterPin,
    getMasterState,
    attachLocal,
    receiveLocal,
    setLocalAlive,
    setLocalOffer,
    setLocalPresence,
    reportLocalError,
    becomeServer,
  } = live;

  const deviceId = choir.deviceId;
  const name = settings.choirName?.trim() || undefined;
  const transports = live.transports;
  const wantsLocal =
    LOCAL_LIVE_AVAILABLE && role !== 'off' && transports.includes('local');
  const sessionId = live.view.state?.sessionId ?? localSession?.sessionId;
  const key = keyOfSessionId(sessionId) ?? localSession?.key ?? choir.code;
  const title = live.view.state
    ? `${live.view.state.repertorio.name}${name ? ` · dirige ${name}` : ''}`
    : 'Directo MCM';

  // Lo que cambia sin tener que reabrir nada, en refs.
  const titleRef = useRef(title);
  const instRef = useRef(live.prefs.inst);
  const autoRef = useRef(live.prefs.autoCatalog);
  useEffect(() => {
    titleRef.current = title;
    instRef.current = live.prefs.inst;
    autoRef.current = live.prefs.autoCatalog;
  });

  // ── Servir ──
  useEffect(() => {
    if (!wantsLocal || !serving || !sessionId || !deviceId) return;
    let cancelled = false;
    let handle: LocalServerHandle | null = null;
    const hub = new LocalHub({
      serverId: deviceId,
      sessionId,
      name: titleRef.current,
      initialState: getMasterState(),
      masterPinHash,
      onView: (v) => receiveLocal(viewToMessages(v)),
      onPresence: (p) => setLocalPresence(p),
    });
    const pushCatalog = () => {
      const cat = catalogStore.getState().catalog;
      if (cat) hub.setCatalog(catalogUpdatedAt(), JSON.stringify(cat));
    };
    pushCatalog();
    const unsubCatalog = catalogStore.subscribe(pushCatalog);
    startLocalServer(hub)
      .then((h) => {
        if (cancelled) {
          void h.stop();
          return;
        }
        handle = h;
        attachLocal({
          send: (msg) => {
            hub.ownerCommand(msg);
          },
          stop: () => {},
        });
        setLocalAlive(true);
      })
      .catch((e) => {
        logger.warn('[directo] no se pudo abrir la wifi del coro', e);
        reportLocalError('No se pudo abrir la wifi del coro');
      });
    return () => {
      cancelled = true;
      unsubCatalog();
      attachLocal(null);
      void handle?.stop();
    };
    // El servidor se abre una vez por directo: el PIN y el estado de partida
    // se leen al abrir (cambiarlos no debe tirar a todo el mundo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantsLocal, serving, sessionId, deviceId]);

  // ── Buscar el servidor (si no se sabe ya dónde está) ──
  const [found, setFound] = useState<FoundLive | null>(null);
  const directHost = localSession?.host;
  useEffect(() => {
    if (!wantsLocal || serving || directHost || !key) return;
    const stop = discoverLive(
      (f) => {
        if (keyOfSessionId(f.sessionId) !== key) return;
        // Un relevo se anuncia con otro servidor: siempre el último visto.
        setFound((prev) =>
          prev &&
          prev.serverId === f.serverId &&
          prev.host === f.host &&
          prev.port === f.port
            ? prev
            : f,
        );
      },
      (service) => {
        setFound((prev) => (prev?.service === service ? null : prev));
      },
    );
    return stop;
  }, [wantsLocal, serving, directHost, key]);

  const target =
    directHost && localSession?.port && localSession.sessionId
      ? {
          host: directHost,
          port: localSession.port,
          sessionId: localSession.sessionId,
          serverId: undefined as string | undefined,
        }
      : found?.sessionId
        ? {
            host: found.host,
            port: found.port,
            sessionId: found.sessionId,
            serverId: found.serverId,
          }
        : null;

  // ── Conectarse ──
  const asMaster = role === 'master';
  useEffect(() => {
    if (!wantsLocal || serving || !target || !deviceId) return;
    let masters: { deviceId: string; joinedAt: number; lastSeen: number }[] =
      [];
    const client = new LocalClient({
      deviceId,
      name,
      inst: instRef.current,
      role: asMaster ? 'master' : 'follower',
      sessionId: target.sessionId,
      pin: asMaster ? (masterPin ?? undefined) : undefined,
      getCatalogUpdatedAt: catalogUpdatedAt,
      autoAcceptCatalog: autoRef.current,
      onView: (v) => receiveLocal(viewToMessages(v)),
      onStatus: (s) => setLocalAlive(s === 'online'),
      onCatalogOffer: () => setLocalOffer(true),
      onCatalog: (catalog) => {
        setLocalOffer(false);
        catalogStore.applyExternal(catalog).catch((e) => {
          logger.warn('[directo] cantoral por la wifi', e);
        });
      },
      onMasters: (list) => {
        const now = Date.now();
        masters = list.map((m) => ({ ...m, lastSeen: now }));
      },
      onServerLost: () => {
        if (!asMaster) return;
        const now = Date.now();
        // Los vistos en el último latido siguen «vivos» para decidir.
        const alive = masters.map((m) => ({ ...m, lastSeen: now }));
        if (relayWinner(alive, target.serverId ?? null, now) === deviceId) {
          logger.info('[directo] relevo: este maestro pasa a servir');
          becomeServer();
        }
      },
      onError: (code) => {
        if (code === 'pin') reportLocalError('PIN de maestro incorrecto');
      },
    });
    connectLocal(target.host, target.port, client);
    attachLocal({
      send: (msg) => {
        if (msg.type === 'state') {
          if (asMaster) client.sendState(msg.state);
        } else if (asMaster || msg.event.t === 'reaccion') {
          client.sendEvent(msg.event);
        }
      },
      stop: () => client.stop(),
      acceptCatalog: () => client.acceptCatalog(),
    });
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') client.reconnectNow();
    });
    return () => {
      sub.remove();
      attachLocal(null);
    };
    // Se reconecta solo si cambia el servidor o el papel.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    wantsLocal,
    serving,
    target?.host,
    target?.port,
    target?.sessionId,
    deviceId,
    asMaster,
  ]);

  return null;
}
