/**
 * Apuntes por capas (`05-apuntes-y-partituras.md`). El almacén de la app vive
 * en ficheros (`apuntes/`), como el catálogo y los repertorios.
 */
import { makeFiles } from '@/services/catalog/files';
import { ApuntesStore } from './store';
import { collectShareableApuntes, importSharedApuntes } from './share';
import type { Apunte } from './model';
import type { RepertorioItem } from '@/services/repertorios/model';
import { logger } from '@/utils/logger';

export * from './model';
export { ApuntesStore, fileFor, mergeById } from './store';
export type { ApuntesState } from './store';
export {
  MAX_SHARED_APUNTES,
  collectShareableApuntes,
  importSharedApuntes,
  readSharedApuntes,
} from './share';

export const apuntesStore = new ApuntesStore(makeFiles('apuntes'));

/** Los apuntes compartibles de un repertorio (para subirlo o exportarlo). */
export function shareableApuntesOf(items: RepertorioItem[]): Promise<Apunte[]> {
  return collectShareableApuntes(items, apuntesStore);
}

/** Importa los apuntes que trae algo compartido (sin bloquear a nadie). */
export function importApuntesFrom(raw: unknown): void {
  importSharedApuntes(raw, apuntesStore).catch((e) =>
    logger.warn('[apuntes] importar', e),
  );
}
