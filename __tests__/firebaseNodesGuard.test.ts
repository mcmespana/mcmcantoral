/**
 * Guardarraíl «solo estos nodos» (`02-datos-offline.md` §2): MCM Cantoral
 * comparte la base de datos con MCM App y quiere leer SOLO `songs` (más las
 * lecturas del domingo) y escribir únicamente en sus colas y en el directo.
 * Si alguien añade un `ref(db, 'otraCosa')` o un `pushWithRetry` a un nodo
 * nuevo, esto se pone en rojo: hay que pensarlo, ponerlo en la tabla del plan
 * y aquí, y si hace falta, la regla en `mcmapp` (dueño de las reglas).
 */
import fs from 'fs';
import path from 'path';

const ROOT = path.join(__dirname, '..');
const DIRS = ['app', 'components', 'hooks', 'contexts', 'services', 'utils'];

/** Raíces de ruta permitidas (primer o primeros segmentos). */
const ALLOWED_PREFIXES = [
  'songs', // updatedAt, data, tags, packs, cantoralConfig, meta, editor/url, fallitos, solicitudes, ediciones
  'seccion_oracion/lecturas', // «Lecturas del domingo» (D-14)
  'choirSessions', // directo por la nube (`04` §4)
  'choirs', // coros
  'playlistShares', // repertorios compartidos
  'users', // `users/<uid>/isAdmin`, solo lectura, admin por código (`06`)
];

/** Ficheros que pueden hablar con Firebase directamente. */
const ALLOWED_FILES = new Set([
  'hooks/useFirebaseData.ts',
  'hooks/useDailyReadings.ts',
  'hooks/useAdminStatus.ts',
  'services/catalog/index.ts',
  'services/cloudPlaylistService.ts',
  'services/choirSessionService.ts',
  'services/choirDirectoryService.ts',
  'services/songEditorService.ts',
  'services/firebaseWrites.ts',
  'services/live/cloud.ts',
  'services/adminService.ts',
]);

function walk(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(e.name)) out.push(full);
  }
  return out;
}

const files = DIRS.flatMap((d) => walk(path.join(ROOT, d))).map((f) => ({
  rel: path.relative(ROOT, f).split(path.sep).join('/'),
  src: fs.readFileSync(f, 'utf8'),
}));

/** Primer trozo literal de una ruta: `'songs/x'`, `` `songs/${a}` `` o `ROOT`. */
function literalPaths(src: string): string[] {
  const out: string[] = [];
  const roots = [...src.matchAll(/const ROOT = '([^']+)'/g)].map((m) => m[1]);
  const re =
    /\b(?:ref|pushWithRetry|setWithRetry)\(\s*(?:[a-zA-Z_.()]+\s*,\s*)?(['`])([^'`$]*)/g;
  for (const m of src.matchAll(re)) out.push(m[2]);
  return [...out, ...roots];
}

it('solo los ficheros de la lista importan firebase/database', () => {
  const offenders = files
    .filter((f) => /from 'firebase\/database'/.test(f.src))
    .map((f) => f.rel)
    .filter((rel) => !ALLOWED_FILES.has(rel));
  expect(offenders).toEqual([]);
});

it('todas las rutas de Firebase caen en los nodos permitidos', () => {
  const bad: string[] = [];
  for (const f of files) {
    for (const p of literalPaths(f.src)) {
      if (!p) continue; // ruta 100 % dinámica: la vigila la lista de ficheros
      const ok = ALLOWED_PREFIXES.some(
        (a) => p === a || p.startsWith(`${a}/`) || a.startsWith(p),
      );
      if (!ok) bad.push(`${f.rel}: ${p}`);
    }
  }
  expect(bad).toEqual([]);
});

it('nadie escribe songs/updatedAt (obligaría a todos a re-bajar el cantoral)', () => {
  const hits = files
    .filter((f) => /['`]songs\/updatedAt['`]/.test(f.src))
    .filter((f) => /set|push|update/i.test(f.src.split('songs/updatedAt')[0].slice(-40)))
    .map((f) => f.rel);
  expect(hits).toEqual([]);
});
