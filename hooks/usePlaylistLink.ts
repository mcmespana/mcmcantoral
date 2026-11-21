/**
 * El enlace del repertorio ACTIVO con la nube (`/playlistShares/<código>`):
 * de qué código vino o dónde se subió, y con qué firma, para saber si hay
 * cambios sin guardar. En MCM Cantoral cada repertorio guarda el suyo
 * (`Repertorio.link`); en MCM App había uno solo para la selección.
 */
import { useCallback, useSyncExternalStore } from 'react';
import { repertoriosStore } from '@/services/repertorios';
import type { PlaylistLink } from '@/services/repertorios/model';

export type { PlaylistLink } from '@/services/repertorios/model';

export function usePlaylistLink() {
  const state = useSyncExternalStore(
    repertoriosStore.subscribe,
    repertoriosStore.getState,
    repertoriosStore.getState,
  );
  const active = state.list.find((r) => r.id === state.activeId);
  const link = active?.link ?? null;

  const setLink = useCallback((next: PlaylistLink | null) => {
    const id = repertoriosStore.getState().activeId;
    if (!id) return;
    repertoriosStore.update(id, (r) => ({ ...r, link: next }));
  }, []);

  return { link, setLink, isHydrated: state.ready };
}
