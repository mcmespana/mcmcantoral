/**
 * Repertorios para las pantallas: los del dispositivo, los bloques del
 * cantoral (`songs/packs`) y las acciones (`services/repertorios`).
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  materialize,
  parsePacks,
  repertoriosStore,
  repertorioSeconds,
  type Repertorio,
  type RepertorioSongItem,
} from '@/services/repertorios';
import { useCatalogPacks, useCatalogSongs } from '@/hooks/useCatalog';
import type { SongEntry } from '@/utils/filterSongsData';

export function useRepertorios() {
  const state = useSyncExternalStore(
    repertoriosStore.subscribe,
    repertoriosStore.getState,
    repertoriosStore.getState,
  );
  useEffect(() => {
    void repertoriosStore.init();
  }, []);
  const packsRaw = useCatalogPacks();
  const packs = useMemo(() => parsePacks(packsRaw), [packsRaw]);
  const { data: songs } = useCatalogSongs({ raw: true });

  /** La canción del catálogo de un elemento (su categoría de casa primero). */
  const findSong = useCallback(
    (item: RepertorioSongItem): SongEntry | undefined => {
      if (!songs) return undefined;
      const inHome = songs[item.category]?.songs?.find(
        (s) => s?.filename === item.filename,
      );
      if (inHome) return inHome;
      for (const cat of Object.values(songs)) {
        const hit = cat?.songs?.find((s) => s?.filename === item.filename);
        if (hit) return hit;
      }
      return undefined;
    },
    [songs],
  );

  const durationOf = useCallback(
    (rep: Repertorio) =>
      repertorioSeconds(
        rep,
        (it) =>
          (findSong(it) as { duration?: string } | undefined)?.duration ??
          undefined,
      ),
    [findSong],
  );

  /** Busca un repertorio (propio o bloque) por id. */
  const byId = useCallback(
    (id: string | undefined) =>
      id
        ? (state.list.find((r) => r.id === id) ??
          packs.find((p) => p.id === id))
        : undefined,
    [state.list, packs],
  );

  /**
   * Deja un repertorio listo para tocar como el ACTIVO. Un bloque del
   * cantoral no se edita: se usa (o se reutiliza) una copia, con el
   * transporte calculado hasta el tono del día.
   */
  const activate = useCallback(
    (rep: Repertorio): Repertorio => {
      if (!rep.readOnly) {
        repertoriosStore.setActive(rep.id);
        return rep;
      }
      const ready = materialize(rep, (it) => findSong(it)?.key);
      const existing = repertoriosStore
        .getState()
        .list.find(
          (r) => r.source?.kind === 'pack' && r.source.ref === rep.source?.ref,
        );
      if (existing) {
        repertoriosStore.update(existing.id, (r) => ({
          ...r,
          name: ready.name,
          event: ready.event,
          date: ready.date,
          items: ready.items,
        }));
        repertoriosStore.setActive(existing.id);
        return repertoriosStore.get(existing.id)!;
      }
      return repertoriosStore.create({
        ...ready,
        id: `b${Date.now().toString(36)}`,
        readOnly: undefined,
      });
    },
    [findSong],
  );

  return {
    ready: state.ready,
    list: state.list,
    activeId: state.activeId,
    packs,
    byId,
    findSong,
    durationOf,
    activate,
    create: (name: string) => repertoriosStore.create(name),
    duplicate: (rep: Repertorio) => repertoriosStore.duplicate(rep),
    rename: (id: string, name: string) => repertoriosStore.rename(id, name),
    remove: (id: string) => repertoriosStore.remove(id),
    update: (id: string, fn: (r: Repertorio) => Repertorio) =>
      repertoriosStore.update(id, fn),
  };
}
