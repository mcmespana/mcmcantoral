/**
 * Administración sin usuarios (`docs/planes/fork-cantoral/06-administracion.md`,
 * D-09): «una especie de contraseña y ya».
 *
 *  1. Al arrancar, el dispositivo entra **en silencio** con Firebase Auth
 *     anónimo: un `uid` estable por instalación, sin pantalla ni correo.
 *  2. «Soy administrador» manda el código a la función `claimCantoralAdmin`
 *     (`functions/`, codebase `cantoral`), que lo compara en el servidor con
 *     su huella y, si vale, escribe `users/<uid>/isAdmin = true`.
 *  3. La app solo LEE `users/<uid>/isAdmin`; el NAS del cantoral mira esa
 *     misma marca con el pase de Firebase, como en MCM App.
 *
 * El código nunca se compara ni se guarda en el móvil.
 */
import {
  onAuthStateChanged,
  signInAnonymously,
  type User,
} from 'firebase/auth';
import { getDatabase, onValue, ref } from 'firebase/database';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { getFirebaseAuth } from '@/utils/firebaseAuth';
import { logger } from '@/utils/logger';

/** Región de la función (la misma que en `functions/index.js`). */
export const ADMIN_FUNCTION_REGION = 'europe-west1';

export interface AdminState {
  uid: string | null;
  isAdmin: boolean;
  /** Aún no se sabe (arrancando o leyendo la marca). */
  loading: boolean;
}

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: 'bad-code' | 'too-many' | 'offline' | 'error' };

type Listener = () => void;

/**
 * El estado de admin de este dispositivo (uno para toda la app): escucha la
 * sesión anónima y la marca `users/<uid>/isAdmin`.
 */
export class AdminStore {
  private state: AdminState = { uid: null, isAdmin: false, loading: true };
  private listeners = new Set<Listener>();
  private started = false;
  private unsubFlag: (() => void) | null = null;

  getState = (): AdminState => this.state;

  subscribe = (l: Listener): (() => void) => {
    this.listeners.add(l);
    this.start();
    return () => {
      this.listeners.delete(l);
    };
  };

  private set(patch: Partial<AdminState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((l) => l());
  }

  /** Engancha la sesión anónima (idempotente; sin red no pasa nada). */
  start(): void {
    if (this.started) return;
    this.started = true;
    let auth: ReturnType<typeof getFirebaseAuth>;
    try {
      auth = getFirebaseAuth();
    } catch (e) {
      logger.warn('[admin] sin Firebase', e);
      this.set({ loading: false });
      return;
    }
    onAuthStateChanged(auth, (user: User | null) => this.onUser(user));
    if (!auth.currentUser) {
      signInAnonymously(auth).catch((e) => {
        // Sin red al arrancar: se reintenta solo en el siguiente arranque, y
        // nadie lo necesita para cantar.
        logger.warn('[admin] inicio anónimo', e);
        this.set({ loading: false });
      });
    }
  }

  private onUser(user: User | null) {
    this.unsubFlag?.();
    this.unsubFlag = null;
    if (!user) {
      this.set({ uid: null, isAdmin: false });
      return;
    }
    this.set({ uid: user.uid, loading: true });
    try {
      this.unsubFlag = onValue(
        ref(getDatabase(getFirebaseApp()), `users/${user.uid}/isAdmin`),
        (snap) => this.set({ isAdmin: snap.val() === true, loading: false }),
        () => this.set({ isAdmin: false, loading: false }),
      );
    } catch (e) {
      logger.warn('[admin] leer la marca', e);
      this.set({ loading: false });
    }
  }

  /** «Soy administrador»: el servidor comprueba el código. */
  async claim(code: string): Promise<ClaimResult> {
    const clean = code.trim();
    if (!clean) return { ok: false, reason: 'bad-code' };
    this.start();
    try {
      const auth = getFirebaseAuth();
      if (!auth.currentUser) await signInAnonymously(auth);
      const call = httpsCallable<
        { code: string },
        { ok: boolean; reason?: string }
      >(
        getFunctions(getFirebaseApp(), ADMIN_FUNCTION_REGION),
        'claimCantoralAdmin',
      );
      const res = await call({ code: clean });
      if (res.data?.ok) return { ok: true };
      return {
        ok: false,
        reason: res.data?.reason === 'too-many' ? 'too-many' : 'bad-code',
      };
    } catch (e) {
      const msg = String((e as { code?: string })?.code ?? e);
      logger.warn('[admin] reclamar', e);
      if (msg.includes('resource-exhausted')) {
        return { ok: false, reason: 'too-many' };
      }
      if (msg.includes('unavailable') || msg.includes('network')) {
        return { ok: false, reason: 'offline' };
      }
      return { ok: false, reason: 'error' };
    }
  }
}

export const adminStore = new AdminStore();
