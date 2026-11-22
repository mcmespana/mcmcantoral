/**
 * Apuntes por capas (`05-apuntes-y-partituras.md`). El almacén de la app vive
 * en ficheros (`apuntes/`), como el catálogo y los repertorios.
 */
import { makeFiles } from '@/services/catalog/files';
import { ApuntesStore } from './store';

export * from './model';
export { ApuntesStore, fileFor, mergeById } from './store';
export type { ApuntesState } from './store';

export const apuntesStore = new ApuntesStore(makeFiles('apuntes'));
