#!/usr/bin/env node
/**
 * Semilla del catálogo offline (`docs/planes/fork-cantoral/02-datos-offline.md`
 * §3.1): baja `songs/{updatedAt,data}`, `songs/tags`, `songs/packs` y
 * `songs/cantoralConfig` por REST (lectura pública) y los deja en
 * `assets/cantoral/semilla.json` + `semilla.meta.json`.
 *
 * Se lanza ANTES de cada build de tienda y de cada OTA (workflows y
 * `npm run eas:build:*`): así la primera vez sin internet la app no sale vacía.
 *
 * Necesita `EXPO_PUBLIC_FIREBASE_DATABASE_URL` (del entorno o de `.env.local`).
 * Falla (código 1) si no consigue un cantoral con canciones: mejor parar el
 * build que publicar una app vacía. `--allow-empty` lo deja pasar (desarrollo).
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets', 'cantoral', 'semilla.json');
const OUT_META = join(ROOT, 'assets', 'cantoral', 'semilla.meta.json');
const allowEmpty = process.argv.includes('--allow-empty');

function envFromFile(name) {
  const file = join(ROOT, '.env.local');
  if (!existsSync(file)) return undefined;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] === name) return m[2].replace(/^["']|["']$/g, '');
  }
  return undefined;
}

const base = (
  process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ??
  envFromFile('EXPO_PUBLIC_FIREBASE_DATABASE_URL') ??
  ''
).replace(/\/+$/, '');

/** Igual que `utils/updatedAt.ts`: s, ms o ISO → ms. */
function toMs(value) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value < 1e11 ? value * 1000 : value;
  }
  if (typeof value === 'string' && value.trim()) {
    const t = value.trim();
    if (/^-?\d+(\.\d+)?$/.test(t)) return toMs(Number(t));
    const p = Date.parse(t);
    return Number.isNaN(p) ? 0 : p;
  }
  return 0;
}

async function read(path) {
  const res = await fetch(`${base}/${path}.json`, {
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
  return res.json();
}

function countSongs(data) {
  if (!data || typeof data !== 'object') return 0;
  return Object.values(data).reduce(
    (n, c) => n + (Array.isArray(c?.songs) ? c.songs.filter(Boolean).length : 0),
    0,
  );
}

async function node(path) {
  const [updatedAt, data] = await Promise.all([
    read(`${path}/updatedAt`),
    read(`${path}/data`),
  ]);
  return data === null ? undefined : { updatedAt: toMs(updatedAt), data };
}

async function main() {
  if (!base) {
    const msg = 'Falta EXPO_PUBLIC_FIREBASE_DATABASE_URL: no se puede bajar la semilla.';
    if (allowEmpty) {
      console.warn(`${msg} Se deja la que hay.`);
      return;
    }
    throw new Error(msg);
  }
  const [songs, tags, packs, cantoralConfig] = await Promise.all([
    node('songs'),
    node('songs/tags').catch(() => undefined),
    node('songs/packs').catch(() => undefined),
    node('songs/cantoralConfig').catch(() => undefined),
  ]);
  const count = countSongs(songs?.data);
  if (count === 0 && !allowEmpty) {
    throw new Error('El cantoral ha llegado vacío: no se escribe la semilla.');
  }
  const catalog = { v: 1, songs, tags, packs, cantoralConfig };
  const text = JSON.stringify(catalog);
  mkdirSync(dirname(OUT), { recursive: true });
  writeFileSync(OUT, `${text}\n`);
  const meta = {
    updatedAt: songs?.updatedAt ?? 0,
    count,
    bytes: Buffer.byteLength(text),
    sha256: createHash('sha256').update(text).digest('hex'),
    generatedAt: new Date().toISOString(),
  };
  writeFileSync(OUT_META, `${JSON.stringify(meta, null, 2)}\n`);
  console.log(`Semilla: ${count} canciones, ${(meta.bytes / 1024).toFixed(0)} KB.`);
}

main().catch((e) => {
  console.error(`snapshot-cantoral: ${e.message}`);
  process.exit(1);
});
