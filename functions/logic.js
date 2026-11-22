/**
 * Lógica pura de `claimCantoralAdmin` (sin Firebase): huella del código,
 * comparación en tiempo constante y límite de intentos por `uid`.
 * La prueban `__tests__/claimCantoralAdmin.test.ts`.
 */
'use strict';
const crypto = require('crypto');

/** Intentos por `uid` y ventana (`06-administracion.md` §2: 5 por hora). */
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 60 * 60 * 1000;

/** El código como se compara: sin espacios a los lados ni mayúsculas. */
function normalizeCode(code) {
  return String(code ?? '')
    .trim()
    .toLowerCase();
}

/** Huella SHA-256 (hex) de un código: es lo único que se guarda. */
function hashCode(code) {
  return crypto.createHash('sha256').update(normalizeCode(code)).digest('hex');
}

/** Las huellas guardadas: lista u objeto `{ nombre: huella }`. */
function readHashes(raw) {
  const values = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object'
      ? Object.values(raw)
      : [];
  return values.filter(
    (h) => typeof h === 'string' && /^[0-9a-f]{64}$/.test(h),
  );
}

/** ¿El código coincide con alguna huella? (tiempo constante por huella) */
function codeMatches(code, hashes) {
  if (!normalizeCode(code)) return false;
  const mine = Buffer.from(hashCode(code), 'hex');
  let ok = false;
  for (const h of hashes) {
    const other = Buffer.from(h, 'hex');
    if (other.length === mine.length && crypto.timingSafeEqual(mine, other)) {
      ok = true;
    }
  }
  return ok;
}

/**
 * Cuenta un intento. `prev` = `{ count, since }` guardado (o nada). Devuelve
 * si se deja intentar y lo que hay que guardar.
 */
function countAttempt(prev, now, max = MAX_ATTEMPTS, windowMs = WINDOW_MS) {
  const fresh =
    !prev ||
    typeof prev.since !== 'number' ||
    typeof prev.count !== 'number' ||
    now - prev.since >= windowMs;
  const base = fresh ? { count: 0, since: now } : prev;
  if (base.count >= max) return { allowed: false, next: base };
  return { allowed: true, next: { count: base.count + 1, since: base.since } };
}

module.exports = {
  MAX_ATTEMPTS,
  WINDOW_MS,
  normalizeCode,
  hashCode,
  readHashes,
  codeMatches,
  countAttempt,
};
