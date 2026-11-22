/**
 * Cloud Functions de MCM Cantoral (codebase `cantoral`: desplegarlas no toca
 * las funciones de MCM App). `docs/planes/fork-cantoral/06-administracion.md`.
 *
 * claimCantoralAdmin({ code }) — «Soy administrador»:
 *   1. Exige sesión (la anónima que abre la app sola).
 *   2. Cuenta el intento en `/_config/cantoral/adminAttempts/<uid>` (5/hora).
 *   3. Compara el código con las huellas de `/_config/cantoral/adminCodeHashes`
 *      (no legibles por las apps: lo dicen las reglas, que son de `mcmapp`).
 *   4. Si coincide, `users/<uid>/isAdmin = true` (lo que ya mira el NAS).
 */
'use strict';
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { initializeApp } = require('firebase-admin/app');
const { getDatabase } = require('firebase-admin/database');
const { codeMatches, countAttempt, readHashes } = require('./logic');

initializeApp();

exports.claimCantoralAdmin = onCall(
  { region: 'europe-west1', maxInstances: 5 },
  async (request) => {
    const uid = request.auth && request.auth.uid;
    if (!uid) {
      throw new HttpsError(
        'unauthenticated',
        'Hace falta la sesión de la app.',
      );
    }
    const code = request.data && request.data.code;
    if (typeof code !== 'string' || code.length > 128) {
      throw new HttpsError('invalid-argument', 'Código no válido.');
    }

    const db = getDatabase();
    const now = Date.now();
    let allowed = false;
    await db
      .ref(`_config/cantoral/adminAttempts/${uid}`)
      .transaction((prev) => {
        const r = countAttempt(prev, now);
        allowed = r.allowed;
        return r.next;
      });
    if (!allowed) {
      throw new HttpsError('resource-exhausted', 'Demasiados intentos.');
    }

    const snap = await db.ref('_config/cantoral/adminCodeHashes').get();
    if (!codeMatches(code, readHashes(snap.val()))) {
      return { ok: false, reason: 'bad-code' };
    }

    await db.ref().update({
      [`users/${uid}/isAdmin`]: true,
      [`_config/cantoral/admins/${uid}`]: { at: now },
      [`_config/cantoral/adminAttempts/${uid}`]: null,
    });
    return { ok: true };
  },
);
