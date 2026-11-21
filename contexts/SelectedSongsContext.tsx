import { trackEvent } from '@/utils/analytics';
import React, {
  createContext,
  useContext,
  ReactNode,
  useMemo,
  useCallback,
  useEffect,
  useSyncExternalStore,
} from 'react';
import {
  applySelection,
  repertoriosStore,
  toSelection,
  type Repertorio,
} from '@/services/repertorios';

/**
 * Representa una canción seleccionada por el usuario en su playlist actual.
 *
 *  - `transpose`: semitonos sobre el tono original (positivo sube, negativo
 *    baja). Se persiste por canción dentro de la selección. Si el usuario
 *    abre la canción desde fuera de la selección, este valor no aplica
 *    (la pantalla de detalle vuelve a un transpose efímero local).
 *  - `capoOverride`: cejilla alternativa para esta sesión/playlist. Si es
 *    null, se usa la cejilla original de la canción. Permite tocar "LA
 *    cejilla 3" aunque la canción diga "LA cejilla 2", sin cambiar los
 *    acordes (que siguen siendo LA). Independiente de `transpose`.
 *  - `order`: posición global asignada cuando el usuario reordena
 *    libremente. En modo "por categoría" se ignora.
 *  - `categoryHint`: clave de la categoría original (p. ej. "entrada").
 *    Se rellena cuando se conoce y se usa como agrupador por defecto y
 *    como pista para el agrupado tras una importación.
 */
export interface SelectedSong {
  filename: string;
  transpose: number;
  capoOverride?: number | null;
  order: number;
  categoryHint?: string;
  addedAt: number;
}

interface SelectedSongsContextType {
  /** Lista de canciones seleccionadas, ya ordenada por `order` ascendente. */
  selectedSongs: SelectedSong[];
  /** Filenames en el mismo orden, para compatibilidad con código existente. */
  selectedFilenames: string[];
  /** Carga inicial desde AsyncStorage en curso. */
  isHydrated: boolean;

  isSongSelected: (filename: string) => boolean;
  getSelectedSong: (filename: string) => SelectedSong | undefined;

  addSong: (
    filename: string,
    opts?: { transpose?: number; categoryHint?: string },
  ) => void;
  removeSong: (filename: string) => void;
  clearSelection: () => void;
  setTranspose: (filename: string, transpose: number) => void;
  /** Sobreescribe la cejilla de una canción para esta playlist. null = usar la original. */
  setCapoOverride: (filename: string, capo: number | null) => void;

  /** Mueve la canción `filename` a la posición destino `toIndex` (0-based). */
  moveSong: (filename: string, toIndex: number) => void;
  /** Reemplaza completamente la playlist (importar, sincronización coro…). */
  replaceAll: (songs: SelectedSong[]) => void;
  /**
   * El repertorio activo (MCM Cantoral tiene varios: `services/repertorios`).
   * Lo que edita esta API es SIEMPRE el activo; sus pausas y notas se
   * conservan aunque la selección no las vea.
   */
  activeRepertorio: Repertorio | null;
}

const SelectedSongsContext = createContext<
  SelectedSongsContextType | undefined
>(undefined);

interface SelectedSongsProviderProps {
  children: ReactNode;
}

/**
 * Reordena `order` para que sean enteros consecutivos empezando en 0 y
 * **elimina duplicados** por `filename` (quedándose con la primera aparición).
 * Los duplicados se podían colar al importar/descargar playlists (un mismo
 * `filename` repetido) e inflaban el contador y rompían las keys de la lista.
 */
function normalizeOrder(songs: SelectedSong[]): SelectedSong[] {
  const seen = new Set<string>();
  return [...songs]
    .sort((a, b) => a.order - b.order || a.addedAt - b.addedAt)
    .filter((s) => {
      if (seen.has(s.filename)) return false;
      seen.add(s.filename);
      return true;
    })
    .map((s, i) => ({ ...s, order: i }));
}

export const SelectedSongsProvider: React.FC<SelectedSongsProviderProps> = ({
  children,
}) => {
  const state = useSyncExternalStore(
    repertoriosStore.subscribe,
    repertoriosStore.getState,
    repertoriosStore.getState,
  );
  useEffect(() => {
    void repertoriosStore.init();
  }, []);

  const activeRepertorio = useMemo(
    () => state.list.find((r) => r.id === state.activeId) ?? null,
    [state.list, state.activeId],
  );
  const selectedSongs = useMemo(
    () => (activeRepertorio ? toSelection(activeRepertorio) : []),
    [activeRepertorio],
  );
  const isHydrated = state.ready;

  /**
   * Cambia la selección del repertorio activo. Se lee SIEMPRE del almacén
   * (síncrono), no del render: dos cambios seguidos no se pisan.
   */
  const mutate = useCallback((fn: (prev: SelectedSong[]) => SelectedSong[]) => {
    const rep = repertoriosStore.getActive();
    if (!rep) return;
    const prev = toSelection(rep);
    const next = fn(prev);
    if (next === prev) return;
    repertoriosStore.update(rep.id, (r) => applySelection(r, next, Date.now()));
  }, []);

  const selectedSongsMap = useMemo(() => {
    const m = new Map<string, SelectedSong>();
    selectedSongs.forEach((s) => m.set(s.filename, s));
    return m;
  }, [selectedSongs]);

  const selectedFilenames = useMemo(
    () => selectedSongs.map((s) => s.filename),
    [selectedSongs],
  );

  const isSongSelected = useCallback(
    (filename: string) => selectedSongsMap.has(filename),
    [selectedSongsMap],
  );

  const getSelectedSong = useCallback(
    (filename: string) => selectedSongsMap.get(filename),
    [selectedSongsMap],
  );

  const addSong = useCallback<SelectedSongsContextType['addSong']>(
    (filename, opts) => {
      mutate((prev) => {
        if (prev.some((s) => s.filename === filename)) return prev;
        // "Creada" = la primera canción que entra en una selección vacía. Es el
        // único momento inequívoco: no hay un botón de "crear playlist".
        if (prev.length === 0) {
          trackEvent('playlist_usada', { accion: 'creada', tamano: '1-5' });
        }
        const next: SelectedSong = {
          filename,
          transpose: opts?.transpose ?? 0,
          order: prev.length,
          categoryHint: opts?.categoryHint,
          addedAt: Date.now(),
        };
        return [...prev, next];
      });
    },
    [mutate],
  );

  const removeSong = useCallback(
    (filename: string) => {
      mutate((prev) =>
        normalizeOrder(prev.filter((s) => s.filename !== filename)),
      );
    },
    [mutate],
  );

  const clearSelection = useCallback(() => {
    mutate(() => []);
  }, [mutate]);

  const setTranspose = useCallback(
    (filename: string, transpose: number) => {
      // Normalizamos a (-11..+11). Octavas completas no aportan nada.
      let t = transpose;
      if (t >= 12 || t <= -12) t = t % 12;
      mutate((prev) =>
        prev.map((s) => (s.filename === filename ? { ...s, transpose: t } : s)),
      );
    },
    [mutate],
  );

  const setCapoOverride = useCallback(
    (filename: string, capo: number | null) => {
      mutate((prev) =>
        prev.map((s) =>
          s.filename === filename ? { ...s, capoOverride: capo } : s,
        ),
      );
    },
    [mutate],
  );

  const moveSong = useCallback(
    (filename: string, toIndex: number) => {
      mutate((prev) => {
        const sorted = [...prev].sort((a, b) => a.order - b.order);
        const fromIndex = sorted.findIndex((s) => s.filename === filename);
        if (fromIndex < 0) return prev;
        const clamped = Math.max(0, Math.min(toIndex, sorted.length - 1));
        if (clamped === fromIndex) return prev;
        const [moved] = sorted.splice(fromIndex, 1);
        sorted.splice(clamped, 0, moved);
        return sorted.map((s, i) => ({ ...s, order: i }));
      });
    },
    [mutate],
  );

  const replaceAll = useCallback(
    (songs: SelectedSong[]) => {
      mutate(() => normalizeOrder(songs));
    },
    [mutate],
  );

  const contextValue = useMemo<SelectedSongsContextType>(
    () => ({
      selectedSongs,
      selectedFilenames,
      isHydrated,
      isSongSelected,
      getSelectedSong,
      addSong,
      removeSong,
      clearSelection,
      setTranspose,
      setCapoOverride,
      moveSong,
      replaceAll,
      activeRepertorio,
    }),
    [
      selectedSongs,
      selectedFilenames,
      isHydrated,
      isSongSelected,
      getSelectedSong,
      addSong,
      removeSong,
      clearSelection,
      setTranspose,
      setCapoOverride,
      moveSong,
      replaceAll,
      activeRepertorio,
    ],
  );

  return (
    <SelectedSongsContext.Provider value={contextValue}>
      {children}
    </SelectedSongsContext.Provider>
  );
};

export const useSelectedSongs = (): SelectedSongsContextType => {
  const context = useContext(SelectedSongsContext);
  if (context === undefined) {
    throw new Error(
      'useSelectedSongs must be used within a SelectedSongsProvider',
    );
  }
  return context;
};
