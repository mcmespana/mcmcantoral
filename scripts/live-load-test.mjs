#!/usr/bin/env node
/**
 * Prueba de carga del directo por la wifi local (tarea 4.9 del plan).
 *
 * Levanta en localhost un servidor con la MISMA lógica de la app
 * (`services/live/local/hub.ts`, compilada al vuelo con esbuild) y le conecta
 * 1 equipo base (el dueño, que también manda) + 3 maestros + 40 seguidores
 * simulados, cada uno con su socket TCP y su `LocalClient`. Los maestros se
 * turnan para cambiar de canción; mide cuánto tarda cada cambio en llegar a
 * cada seguidor y comprueba que TODOS acaban en el mismo `seq`. Con
 * `--catalog` además reparte un cantoral de ~400 KB a todos (escalonado).
 *
 * Uso (desde la raíz del repo):
 *
 *   node scripts/live-load-test.mjs
 *   node scripts/live-load-test.mjs --followers 60 --masters 3 --changes 50 --interval 40
 *   node scripts/live-load-test.mjs --catalog
 *
 * Opciones: --followers N (40) · --masters N (3) · --changes N (30, cambios
 * de canción) · --interval MS (50, entre cambios) · --catalog.
 * Sale con código 1 si algún seguidor no converge o el p95 pasa de 500 ms.
 *
 * Es una prueba del SOFTWARE sobre localhost: no mide el router ni la wifi
 * (eso se prueba en el ensayo con 10+ móviles, `04` §5.3).
 */
import { build } from 'esbuild';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { mkdtempSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  if (i < 0) return def;
  const v = Number(process.argv[i + 1]);
  return Number.isFinite(v) ? v : def;
}
const FOLLOWERS = arg('followers', 40);
const MASTERS = arg('masters', 3);
const CHANGES = arg('changes', 30);
const INTERVAL = arg('interval', 50);
const WITH_CATALOG = process.argv.includes('--catalog');
const P95_LIMIT_MS = 500;

const SESSION = 'carga';
const PIN = '4321';

// ─── Compila la lógica real de la app ───────────────────────────────────────

const tmp = mkdtempSync(path.join(os.tmpdir(), 'live-load-'));
const outfile = path.join(tmp, 'live.mjs');
await build({
  stdin: {
    contents: `
      export { LocalHub } from '@/services/live/local/hub';
      export { LocalClient } from '@/services/live/local/client';
      export { initialState, nextState, pinHash } from '@/services/live/protocol';
    `,
    resolveDir: ROOT,
    loader: 'ts',
  },
  bundle: true,
  platform: 'node',
  format: 'esm',
  outfile,
  alias: { '@': ROOT },
  define: { __DEV__: 'false' },
  logLevel: 'error',
});
const { LocalHub, LocalClient, initialState, nextState, pinHash } =
  await import(pathToFileURL(outfile).href);

// ─── Utilidades ─────────────────────────────────────────────────────────────

function adapt(sock) {
  sock.setEncoding('utf8');
  sock.setNoDelay(true);
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const now = () => performance.now();
async function until(cond, ms, what) {
  const t0 = Date.now();
  while (!cond()) {
    if (Date.now() - t0 > ms)
      throw new Error(`Tiempo agotado esperando: ${what}`);
    await sleep(5);
  }
}
function pct(sorted, p) {
  if (!sorted.length) return NaN;
  return sorted[
    Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))
  ];
}

// ─── Servidor ───────────────────────────────────────────────────────────────

const hub = new LocalHub({
  serverId: 'base',
  sessionId: SESSION,
  name: 'Carga',
  initialState: initialState({
    sessionId: SESSION,
    repertorio: { id: 'r', name: 'Carga', items: [] },
    by: { deviceId: 'base' },
    catalogUpdatedAt: 0,
    transports: ['local'],
    now: Date.now(),
  }),
  masterPinHash: pinHash(PIN, SESSION),
  maxTransfers: 8,
});
const server = net.createServer((s) => hub.attach(adapt(s)));
await new Promise((r) => server.listen(0, '127.0.0.1', r));
hub.start();
const port = server.address().port;
const dial = () => adapt(net.connect(port, '127.0.0.1'));

// ─── Clientes ───────────────────────────────────────────────────────────────

/** seq → instante en que el servidor lo aceptó (lo marca el onView del hub). */
const sentAt = new Map();
hub.opts.onView = (v) => {
  if (v.state && !sentAt.has(v.state.seq)) sentAt.set(v.state.seq, now());
};

const latencies = []; // ms por (seguidor, cambio)
const lastSeq = new Map();
let catalogsDone = 0;

function makeClient(id, role) {
  const c = new LocalClient({
    deviceId: id,
    sessionId: SESSION,
    role,
    pin: role === 'master' ? PIN : undefined,
    getCatalogUpdatedAt: () => 0,
    autoAcceptCatalog: WITH_CATALOG,
    onCatalog: () => {
      catalogsDone += 1;
    },
    onView: (v) => {
      const seq = v.state?.seq ?? 0;
      lastSeq.set(id, seq);
      const t = sentAt.get(seq);
      if (t !== undefined && role === 'follower') latencies.push(now() - t);
    },
  });
  c.start(dial);
  return c;
}

const masters = Array.from({ length: MASTERS }, (_, i) =>
  makeClient(`maestro-${i}`, 'master'),
);
const followers = Array.from({ length: FOLLOWERS }, (_, i) =>
  makeClient(`seguidor-${i}`, 'follower'),
);
const all = [...masters, ...followers];
const tConnect = now();
await until(
  () => all.every((c) => c.getStatus() === 'online'),
  15_000,
  'que todos conecten',
);
const connectMs = now() - tConnect;

// ─── Cantoral (opcional) ────────────────────────────────────────────────────

let catalogMs = null;
if (WITH_CATALOG) {
  const songs = {};
  for (let i = 0; i < 700; i++) {
    songs[`c${i}`] = {
      title: `Canción ${i}`,
      content: `[Do]${'la la la á é í '.repeat(40)}`,
    };
  }
  const json = JSON.stringify({ v: 1, songs: { updatedAt: 9, data: songs } });
  const t0 = now();
  hub.setCatalog(9, json);
  await until(
    () => catalogsDone === all.length,
    60_000,
    'el reparto del cantoral',
  );
  catalogMs = now() - t0;
}

// ─── Cambios de canción ─────────────────────────────────────────────────────

latencies.length = 0;
const startSeq = hub.getState().seq;
for (let i = 0; i < CHANGES; i++) {
  const m = masters[i % masters.length];
  const next = nextState(
    hub.getState(),
    {
      index: i,
      song: {
        category: 'villancicos',
        filename: `c${i}.cho`,
        contentHash: `h${i}`,
        title: `Canción ${i}`,
      },
    },
    { deviceId: `maestro-${i % masters.length}` },
    Date.now(),
  );
  m.sendState(next);
  await sleep(INTERVAL);
}
const finalSeq = startSeq + CHANGES;
let converged = true;
try {
  await until(
    () => all.every((c) => lastSeq.get(c.o.deviceId) === finalSeq),
    10_000,
    'que todos lleguen al último seq',
  );
} catch {
  converged = false;
}
const behind = all.filter((c) => lastSeq.get(c.o.deviceId) !== finalSeq).length;

// ─── Resumen ────────────────────────────────────────────────────────────────

const sorted = [...latencies].sort((a, b) => a - b);
const expected = FOLLOWERS * CHANGES;
const p95 = pct(sorted, 95);
const fmt = (n) => (Number.isFinite(n) ? `${n.toFixed(1)} ms` : 'n/d');
const ok =
  converged &&
  behind === 0 &&
  sorted.length === expected &&
  p95 <= P95_LIMIT_MS;

process.stdout.write(
  [
    '',
    'Prueba de carga del directo local',
    '---------------------------------',
    `Clientes:        1 equipo base + ${MASTERS} maestros + ${FOLLOWERS} seguidores (${hub.connectionCount} conexiones)`,
    `Conexión:        todos en línea en ${connectMs.toFixed(0)} ms`,
    ...(catalogMs !== null
      ? [
          `Cantoral:        repartido a ${catalogsDone} dispositivos en ${(catalogMs / 1000).toFixed(2)} s`,
        ]
      : []),
    `Cambios:         ${CHANGES} (cada ${INTERVAL} ms, los maestros se turnan)`,
    `Entregas:        ${sorted.length} de ${expected} esperadas a seguidores`,
    `Latencia:        p50 ${fmt(pct(sorted, 50))} · p95 ${fmt(p95)} · p99 ${fmt(pct(sorted, 99))} · máx ${fmt(sorted[sorted.length - 1])}`,
    `Convergencia:    ${converged && behind === 0 ? `todos en seq ${finalSeq}` : `${behind} dispositivos NO llegaron a seq ${finalSeq}`}`,
    `Resultado:       ${ok ? 'OK' : 'FALLO'}`,
    '',
  ].join('\n'),
);

// ─── Limpieza ───────────────────────────────────────────────────────────────

for (const c of all) c.stop();
hub.stop();
server.close();
rmSync(tmp, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
