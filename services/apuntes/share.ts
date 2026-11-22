/**
 * Apuntes dentro del repertorio (`05` §6, D-11): al compartirlo (nube, coro o
 * `.mcm`) viajan los apuntes de capa *Todos* y de instrumento de sus
 * canciones; al importarlo, llegan. «Solo yo» nunca sale del móvil.
 * Va en el campo `apuntes`, que MCM App ignora.
 */
import { isSong, type RepertorioItem } from '@/services/repertorios/model';
import { isShareable, parseApunte, type Apunte } from './model';
import type { ApuntesStore } from './store';

/** Tope para no inflar lo compartido. */
export const MAX_SHARED_APUNTES = 300;

/** Los apuntes compartibles de las canciones de un repertorio. */
export async function collectShareableApuntes(
  items: RepertorioItem[],
  store: ApuntesStore,
): Promise<Apunte[]> {
  const out: Apunte[] = [];
  const seen = new Set<string>();
  for (const it of items.filter(isSong)) {
    const key = `${it.category}/${it.filename}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const list = await store.load({
      category: it.category,
      filename: it.filename,
    });
    for (const a of list) {
      if (!isShareable(a)) continue;
      const { orphan: _orphan, ...rest } = a;
      out.push(rest);
    }
  }
  return out.slice(0, MAX_SHARED_APUNTES);
}

/** Los apuntes que trae algo compartido (validados uno a uno). */
export function readSharedApuntes(raw: unknown): Apunte[] {
  if (!raw || typeof raw !== 'object') return [];
  const list = (raw as { apuntes?: unknown }).apuntes;
  if (!Array.isArray(list)) return [];
  return list
    .slice(0, MAX_SHARED_APUNTES)
    .map(parseApunte)
    .filter((a): a is Apunte => !!a && isShareable(a));
}

/** Importa los apuntes de algo compartido. Devuelve cuántos nuevos. */
export function importSharedApuntes(
  raw: unknown,
  store: ApuntesStore,
): Promise<number> {
  const list = readSharedApuntes(raw);
  return list.length ? store.importMany(list) : Promise.resolve(0);
}
