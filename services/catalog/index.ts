/**
 * El catálogo de la app: un único `CatalogStore` con el disco, Firebase y la
 * semilla de verdad. Las pantallas usan `hooks/useCatalog.ts`.
 */
import { get, getDatabase, ref } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { catalogFiles } from './files';
import { CatalogStore } from './store';
import type { Catalog } from './types';

export * from './types';
export { CatalogStore } from './store';
export type { CatalogState, RefreshResult } from './store';

/**
 * Semilla empaquetada en el binario (`scripts/snapshot-cantoral.mjs`). Metro
 * la mete en el bundle; se lee una sola vez y solo si hace falta.
 */
function loadSeed(): Catalog | null {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const raw = require('@/assets/cantoral/semilla.json') as Catalog | null;
  return raw && typeof raw === 'object' && raw.v === 1 ? raw : null;
}

/** Lectura de una ruta de Firebase (lectura pública de `songs/*`). */
async function readFirebase(path: string): Promise<unknown> {
  const snap = await get(ref(getDatabase(getFirebaseApp()), path));
  return snap.exists() ? snap.val() : null;
}

export const catalogStore = new CatalogStore({
  files: catalogFiles,
  remote: { read: readFirebase },
  seed: loadSeed,
});
