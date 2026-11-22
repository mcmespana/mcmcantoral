/**
 * @jest-environment node
 */
/**
 * Camino LOCAL del directo (`04-directo.md` §5): codec de líneas, hub y
 * cliente hablando por sockets TCP reales de Node en localhost.
 */
import net from 'net';

import {
  LocalClient,
  type LocalClientOptions,
} from '@/services/live/local/client';
import {
  LineDecoder,
  encodeLine,
  parseWire,
} from '@/services/live/local/framing';
import { LocalHub, utf8Length } from '@/services/live/local/hub';
import type { LiveSocket, WireMessage } from '@/services/live/local/wire';
import {
  initialState,
  nextState,
  pinHash,
  type LiveState,
} from '@/services/live/protocol';
import { sha256Hex } from '@/utils/sha256';

// Sin ruido de depuración en la salida de los tests.
jest.mock('@/utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    log: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// ─── Utilidades ──────────────────────────────────────────────────────────────

const SESSION = 'villancicos';
const PIN = '1234';

function adapt(sock: net.Socket): LiveSocket {
  sock.setEncoding('utf8');
  sock.on('error', () => {});
  return {
    write: (line) => {
      if (!sock.destroyed) sock.write(line);
    },
    end: () => sock.destroy(),
    onData: (cb) => sock.on('data', cb),
    onClose: (cb) => sock.on('close', cb),
  };
}

async function until(cond: () => boolean, ms = 3000): Promise<void> {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms) throw new Error('until: tiempo agotado');
    await new Promise((r) => setTimeout(r, 4));
  }
}

const cleanups: (() => void)[] = [];
afterEach(() => {
  while (cleanups.length) cleanups.pop()?.();
});

function baseState(): LiveState {
  return initialState({
    sessionId: SESSION,
    repertorio: { id: 'r1', name: 'Villancicos', items: [] },
    by: { deviceId: 'base' },
    catalogUpdatedAt: 0,
    transports: ['local'],
    now: 1000,
  });
}

interface Rig {
  hub: LocalHub;
  port: number;
  dial: () => LiveSocket;
}

async function startRig(
  hubOpts: Partial<ConstructorParameters<typeof LocalHub>[0]> = {},
  start = true,
): Promise<Rig> {
  const hub = new LocalHub({
    serverId: 'base',
    sessionId: SESSION,
    initialState: baseState(),
    masterPinHash: pinHash(PIN, SESSION),
    heartbeatMs: 40,
    ...hubOpts,
  });
  const server = net.createServer((s) => hub.attach(adapt(s)));
  const conns = new Set<net.Socket>();
  server.on('connection', (s) => conns.add(s));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  if (start) hub.start();
  cleanups.push(() => {
    hub.stop();
    conns.forEach((c) => c.destroy());
    server.close();
  });
  const port = (server.address() as net.AddressInfo).port;
  return {
    hub,
    port,
    dial: () => adapt(net.connect(port, '127.0.0.1')),
  };
}

function makeClient(
  rig: Rig,
  id: string,
  o: Partial<LocalClientOptions> = {},
  dial: () => LiveSocket = rig.dial,
): LocalClient {
  const c = new LocalClient({
    deviceId: id,
    sessionId: SESSION,
    getCatalogUpdatedAt: () => 0,
    heartbeatMs: 40,
    reconnectBaseMs: 10,
    reconnectMaxMs: 40,
    random: () => 0.5,
    ...o,
  });
  c.start(dial);
  cleanups.push(() => c.stop());
  return c;
}

// ─── Framing ─────────────────────────────────────────────────────────────────

describe('framing', () => {
  const ping: WireMessage = { op: 'ping', at: 5 };
  const state = baseState();

  test('un mensaje por línea y ida y vuelta', () => {
    const line = encodeLine({ type: 'state', state });
    expect(line.endsWith('\n')).toBe(true);
    expect(line.indexOf('\n')).toBe(line.length - 1);
    const res = new LineDecoder().push(line);
    expect(res.messages).toEqual([{ type: 'state', state }]);
  });

  test('un mensaje partido en trozos (incluso de un carácter)', () => {
    const dec = new LineDecoder();
    const line = encodeLine({
      op: 'hello',
      deviceId: 'ñ😀',
      catalogUpdatedAt: 1,
      role: 'follower',
    });
    const got: WireMessage[] = [];
    for (const ch of line) got.push(...dec.push(ch).messages);
    expect(got).toHaveLength(1);
    expect((got[0] as { deviceId: string }).deviceId).toBe('ñ😀');
    expect(dec.pending).toBe(0);
  });

  test('varios mensajes en un mismo chunk y uno a medias', () => {
    const dec = new LineDecoder();
    const a = encodeLine(ping);
    const b = encodeLine({ op: 'pong', at: 6 });
    const c = encodeLine({ op: 'ack', id: 3 });
    const r1 = dec.push(a + b + c.slice(0, 5));
    expect(r1.messages).toHaveLength(2);
    const r2 = dec.push(c.slice(5));
    expect(r2.messages).toEqual([{ op: 'ack', id: 3 }]);
  });

  test('basura: JSON roto, forma desconocida y líneas vacías se ignoran', () => {
    const dec = new LineDecoder();
    const res = dec.push(
      `no es json\n\n{"op":"nada"}\n{"type":"state"}\n[1,2]\n${encodeLine(ping)}`,
    );
    expect(res.messages).toEqual([ping]);
    expect(res.garbage).toBe(4);
  });

  test('límite de línea: se descarta hasta el siguiente salto y sigue', () => {
    const dec = new LineDecoder(100);
    const r1 = dec.push('x'.repeat(150));
    expect(r1.overflow).toBe(true);
    const r2 = dec.push(`${'y'.repeat(50)}\n${encodeLine(ping)}`);
    expect(r2.messages).toEqual([ping]);
    // Una línea larga que llega ENTERA en un chunk también se descarta.
    const r3 = dec.push(`${'z'.repeat(300)}\n${encodeLine(ping)}`);
    expect(r3.overflow).toBe(true);
    expect(r3.messages).toEqual([ping]);
  });

  test('parseWire valida la forma', () => {
    expect(
      parseWire({
        op: 'hello',
        deviceId: '',
        role: 'master',
        catalogUpdatedAt: 0,
      }),
    ).toBeNull();
    expect(
      parseWire({ op: 'command', msg: { type: 'event', event: { t: 'fin' } } }),
    ).toBeNull();
    expect(
      parseWire({
        op: 'command',
        id: 1,
        msg: { type: 'event', event: { t: 'fin', at: 1 } },
      }),
    ).not.toBeNull();
    expect(parseWire(null)).toBeNull();
  });
});

// ─── Hub + cliente por TCP ───────────────────────────────────────────────────

describe('hub + cliente (net, localhost)', () => {
  test('un maestro con PIN cambia de canción y llegan los seguidores', async () => {
    const rig = await startRig();
    const seen: Record<string, number[]> = { a: [], b: [] };
    const mk = (id: string) =>
      makeClient(rig, id, {
        onView: (v) => seen[id]?.push(v.state?.seq ?? 0),
      });
    const a = mk('a');
    const b = mk('b');
    const master = makeClient(rig, 'm1', { role: 'master', pin: PIN });
    await until(
      () =>
        a.getStatus() === 'online' &&
        b.getStatus() === 'online' &&
        master.getStatus() === 'online',
    );
    // El welcome ya trae el estado de partida.
    expect(a.getView().state?.seq).toBe(1);
    expect(Object.keys(rig.hub.presence()).sort()).toEqual(['a', 'b', 'm1']);
    expect(rig.hub.presence().a?.via).toBe('local');

    const next = nextState(
      baseState(),
      {
        index: 0,
        song: {
          category: 'c',
          filename: 'f.cho',
          contentHash: 'h',
          title: 'Noche',
        },
      },
      { deviceId: 'm1' },
      2000,
    );
    expect(master.sendState(next)).not.toBeNull();
    await until(
      () => a.getView().state?.seq === 2 && b.getView().state?.seq === 2,
    );
    expect(rig.hub.getState()?.song?.title).toBe('Noche');
    expect(master.getView().state?.seq).toBe(2);
  });

  test('un PIN malo no manda, y un seguidor tampoco', async () => {
    const rig = await startRig();
    const errors: string[] = [];
    const follower = makeClient(rig, 'f');
    const bad = makeClient(rig, 'm-bad', {
      role: 'master',
      pin: '9999',
      onError: (c) => errors.push(c),
    });
    const nosy = makeClient(rig, 'nosy', { onError: (c) => errors.push(c) });
    await until(() =>
      [follower, bad, nosy].every((c) => c.getStatus() === 'online'),
    );
    const next = nextState(baseState(), { index: 3 }, { deviceId: 'x' }, 2000);
    bad.sendState(next);
    nosy.sendState(next);
    await until(() => errors.filter((e) => e === 'pin').length >= 3);
    await new Promise((r) => setTimeout(r, 60));
    expect(follower.getView().state?.seq).toBe(1);
    expect(rig.hub.getState()?.index).toBe(-1);
  });

  test('el dueño manda sin PIN y una orden vieja se rechaza', async () => {
    const rig = await startRig();
    const f = makeClient(rig, 'f');
    const errors: string[] = [];
    const master = makeClient(rig, 'm', {
      role: 'master',
      pin: PIN,
      onError: (c) => errors.push(c),
    });
    await until(
      () => f.getStatus() === 'online' && master.getStatus() === 'online',
    );
    const s2 = nextState(baseState(), { index: 1 }, { deviceId: 'base' }, 2000);
    expect(rig.hub.ownerCommand({ type: 'state', state: s2 })).toBe(true);
    await until(() => f.getView().state?.seq === 2);
    master.sendState(baseState()); // seq 1 < 2
    await until(() => errors.includes('stale'));
  });

  test('un evento (aviso) del maestro llega una sola vez a todos', async () => {
    const rig = await startRig();
    const f = makeClient(rig, 'f');
    const master = makeClient(rig, 'm', { role: 'master', pin: PIN });
    await until(
      () => f.getStatus() === 'online' && master.getStatus() === 'online',
    );
    const aviso = {
      t: 'aviso' as const,
      id: 'a1',
      kind: 'cinta' as const,
      text: 'Atentos',
      ttlMs: 5000,
      from: 'm',
      at: 10,
    };
    master.sendEvent(aviso);
    master.sendEvent(aviso);
    await until(() => f.getView().avisos.length === 1);
    await new Promise((r) => setTimeout(r, 40));
    expect(f.getView().avisos).toHaveLength(1);
  });

  describe('cantoral por trozos', () => {
    /** Catálogo de ~200 KB con acentos y emojis (los trozos parten en cualquier sitio). */
    function bigCatalog(): { json: string; obj: unknown } {
      const songs: Record<string, unknown> = {};
      for (let i = 0; i < 400; i++) {
        songs[`Canción ${i} ñ😀`] = {
          title: `Canción número ${i} 😀`,
          content: `[Do]Noche de paz ${'á é í ó ú '.repeat(40)}`,
        };
      }
      const obj = { v: 1, songs: { updatedAt: 5000, data: songs } };
      return { json: JSON.stringify(obj), obj };
    }

    test('~200 KB en trozos de 32 KB, sha256 cuadrado, y se entrega parseado', async () => {
      const rig = await startRig();
      const { json, obj } = bigCatalog();
      expect(json.length).toBeGreaterThan(190_000);
      expect(rig.hub.setCatalog(5000, json)).toBe(true);
      expect(rig.hub.setCatalog(4000, json)).toBe(false); // uno más viejo no sustituye

      const offers: number[] = [];
      let got: { catalog: unknown; at: number } | null = null;
      makeClient(rig, 'f', {
        autoAcceptCatalog: true,
        onCatalogOffer: (o) => {
          offers.push(o.chunks);
          expect(o.sha256).toBe(sha256Hex(json));
          expect(o.bytes).toBe(utf8Length(json));
        },
        onCatalog: (catalog, at) => {
          got = { catalog, at };
        },
      });
      await until(() => got !== null, 10_000);
      expect(offers[0]).toBe(Math.ceil(json.length / (32 * 1024)));
      expect(offers[0]).toBeGreaterThanOrEqual(6);
      expect(got!.catalog).toEqual(obj);
      expect(got!.at).toBe(5000);
    });

    test('quien ya lo tiene no recibe oferta; sin autoaceptar espera el toque', async () => {
      const rig = await startRig();
      const { json } = bigCatalog();
      rig.hub.setCatalog(5000, json);
      const offers: number[] = [];
      makeClient(rig, 'al-dia', {
        getCatalogUpdatedAt: () => 5000,
        onCatalogOffer: (o) => offers.push(o.updatedAt),
      });
      let got = 0;
      const manual = makeClient(rig, 'manual', {
        onCatalogOffer: (o) => offers.push(o.updatedAt),
        onCatalog: () => {
          got += 1;
        },
      });
      await until(() => offers.length === 1);
      await new Promise((r) => setTimeout(r, 60));
      expect(got).toBe(0);
      manual.acceptCatalog();
      await until(() => got === 1, 10_000);
    });

    test('envíos escalonados: nunca más de N a la vez, y todos acaban', async () => {
      const rig = await startRig({ maxTransfers: 2 });
      const { json } = bigCatalog();
      rig.hub.setCatalog(5000, json);
      let done = 0;
      let maxActive = 0;
      const sampler = setInterval(() => {
        maxActive = Math.max(maxActive, rig.hub.activeTransfers);
      }, 1);
      cleanups.push(() => clearInterval(sampler));
      for (let i = 0; i < 8; i++) {
        makeClient(rig, `f${i}`, {
          autoAcceptCatalog: true,
          window: 2,
          onCatalog: () => {
            done += 1;
          },
        });
      }
      await until(() => done === 8, 15_000);
      expect(maxActive).toBeGreaterThan(0);
      expect(maxActive).toBeLessThanOrEqual(2);
      // El último `catalog-done` llega un instante después de la entrega.
      await until(() => rig.hub.activeTransfers === 0);
    });

    test('un corte a mitad se reanuda desde el último trozo', async () => {
      const rig = await startRig();
      const { json, obj } = bigCatalog();
      rig.hub.setCatalog(5000, json);

      let dials = 0;
      const froms: number[] = [];
      const dial = (): LiveSocket => {
        dials += 1;
        const first = dials === 1;
        const raw = net.connect(rig.port, '127.0.0.1');
        const inner = adapt(raw);
        let chunks = 0;
        return {
          ...inner,
          write: (line) => {
            const m = /"op":"catalog-request".*"from":(\d+)/.exec(line);
            if (m) froms.push(Number(m[1]));
            inner.write(line);
          },
          onData: (cb) =>
            inner.onData((text) => {
              cb(text);
              chunks += (text.match(/"op":"catalog-chunk"/g) ?? []).length;
              // En la primera conexión, se corta tras 3 trozos.
              if (first && chunks >= 3) raw.destroy();
            }),
        };
      };

      let got: unknown = null;
      makeClient(
        rig,
        'f',
        {
          autoAcceptCatalog: true,
          window: 2,
          onCatalog: (c) => {
            got = c;
          },
        },
        dial,
      );
      await until(() => got !== null, 10_000);
      expect(dials).toBeGreaterThanOrEqual(2);
      expect(froms[0]).toBe(0);
      // Tras el corte pide desde donde iba, no desde cero.
      expect(froms.some((f, i) => i > 0 && f > 0)).toBe(true);
      expect(got).toEqual(obj);
    });

    test('si el cantoral llega corrupto no se entrega', async () => {
      const rig = await startRig();
      const { json } = bigCatalog();
      rig.hub.setCatalog(5000, json);
      const errors: string[] = [];
      let delivered = 0;
      // Un hub tramposo: cambia un trozo por el camino.
      const dial = (): LiveSocket => {
        const inner = rig.dial();
        return {
          ...inner,
          onData: (cb) =>
            inner.onData((t) => cb(t.replace('Noche de paz', 'Noche de PAZ'))),
        };
      };
      makeClient(
        rig,
        'f',
        {
          autoAcceptCatalog: true,
          onCatalog: () => {
            delivered += 1;
          },
          onError: (c) => errors.push(c),
        },
        dial,
      );
      await until(() => errors.includes('catalog-corrupt'), 10_000);
      expect(delivered).toBe(0);
    });
  });

  test('servidor caído: el cliente lo detecta por latidos y reconecta al volver', async () => {
    // Hub SIN latido: acepta y saluda, pero no vuelve a decir nada.
    const rig = await startRig({}, false);
    let lost = 0;
    const statuses: string[] = [];
    const c = makeClient(rig, 'f', {
      onServerLost: () => {
        lost += 1;
      },
      onStatus: (s) => statuses.push(s),
    });
    await until(() => c.getStatus() === 'online');
    const t0 = Date.now();
    await until(() => lost >= 1);
    // 3 latidos de 40 ms: ni antes de tiempo ni mucho después.
    expect(Date.now() - t0).toBeGreaterThanOrEqual(60);
    expect(Date.now() - t0).toBeLessThan(1000);
    expect(statuses).toContain('reconnecting');
  });

  test('con latido el cliente NO da por caído al servidor sano', async () => {
    const rig = await startRig();
    let lost = 0;
    const c = makeClient(rig, 'f', { onServerLost: () => (lost += 1) });
    await until(() => c.getStatus() === 'online');
    await new Promise((r) => setTimeout(r, 300));
    expect(lost).toBe(0);
    expect(c.getStatus()).toBe('online');
  });

  test('si el servidor muere, el cliente reintenta y vuelve cuando renace', async () => {
    const rig = await startRig();
    let lost = 0;
    const c = makeClient(rig, 'f', { onServerLost: () => (lost += 1) });
    await until(() => c.getStatus() === 'online');
    rig.hub.stop(); // cierra todas las conexiones
    await until(() => lost === 1);
    expect(c.getStatus()).toBe('reconnecting');
    // El hub sigue escuchando (solo cerró las conexiones): vuelve solo.
    await until(() => c.getStatus() === 'online');
  });

  test('la misma máquina reconectando sustituye a su conexión anterior', async () => {
    const rig = await startRig();
    makeClient(rig, 'dup');
    await until(() => rig.hub.connectionCount === 1);
    makeClient(rig, 'dup');
    await until(() => Object.keys(rig.hub.presence()).length === 1);
    await new Promise((r) => setTimeout(r, 50));
    expect(rig.hub.connectionCount).toBeLessThanOrEqual(2);
    expect(Object.keys(rig.hub.presence())).toEqual(['dup']);
  });
});
