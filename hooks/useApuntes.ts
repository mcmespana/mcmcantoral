/**
 * Los apuntes de una canción (`05`): cargados del disco, recolocados en la
 * versión actual del `.cho` (`reanchorNotes`) y filtrados por las capas que
 * quiere ver este dispositivo.
 */
import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import {
  apuntesStore,
  songKey,
  reanchorNotes,
  type Apunte,
  type ApunteLayer,
  type ApunteSong,
} from '@/services/apuntes';

const NONE: Apunte[] = [];

export function useApuntes(song: ApunteSong | null, content: string | null) {
  const state = useSyncExternalStore(
    apuntesStore.subscribe,
    apuntesStore.getState,
    apuntesStore.getState,
  );
  const category = song?.category ?? '';
  const filename = song?.filename ?? '';

  useEffect(() => {
    if (filename) void apuntesStore.load({ category, filename });
  }, [category, filename]);

  const stored =
    (filename && state.bySong[songKey({ category, filename })]) || NONE;

  // Recolocados en la letra de ahora (puro).
  const notes = useMemo(
    () => (content ? reanchorNotes(stored, content) : stored),
    [stored, content],
  );

  // Si alguno se ha movido o quedado huérfano, se guarda así.
  useEffect(() => {
    if (!filename || notes === stored) return;
    const changed = notes.some((n, i) => n !== stored[i]);
    if (changed) apuntesStore.replace({ category, filename }, notes);
  }, [notes, stored, category, filename]);

  const hidden = state.hidden;
  const visible = useMemo(
    () => notes.filter((n) => !hidden.includes(n.layer)),
    [notes, hidden],
  );

  const save = useCallback((a: Apunte) => apuntesStore.upsert(a), []);
  const remove = useCallback(
    (id: string) => filename && apuntesStore.remove({ category, filename }, id),
    [category, filename],
  );
  const setHidden = useCallback(
    (h: ApunteLayer[]) => apuntesStore.setHidden(h),
    [],
  );

  return { notes, visible, hidden, setHidden, save, remove };
}
