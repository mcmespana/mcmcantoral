/**
 * Lectura del catálogo offline desde las pantallas (`services/catalog/`).
 *
 * Sustituye a `useFirebaseData('songs', …)`: los datos salen SIEMPRE del
 * dispositivo (lo guardado o la semilla) y la nube solo añade. La forma que
 * devuelve es la misma que la de antes (`data`, `loading`, `offline`,
 * `refresh`) para no reescribir las pantallas.
 */
import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { catalogStore, type CatalogState } from '@/services/catalog';
import { filterSongsData, type SongsData } from '@/utils/filterSongsData';
import {
  DEFAULT_CANTORAL_CONFIG,
  effectiveMode,
  localIsoDate,
  parseCantoralConfig,
  type CantoralConfig,
  type CantoralMode,
} from '@/utils/cantoralConfig';

/** El estado entero del catálogo (se re-pinta con cada cambio). */
export function useCatalogState(): CatalogState {
  return useSyncExternalStore(
    catalogStore.subscribe,
    catalogStore.getState,
    catalogStore.getState,
  );
}

interface NodeResult<T> {
  data: T | null;
  /** Aún no se ha leído ni lo local ni la semilla. */
  loading: boolean;
  /** La última comprobación con la nube falló por red. */
  offline: boolean;
  /** Tirar para actualizar: mira la nube ya (sin esperar a los 15 min). */
  refresh: () => Promise<void>;
}

function useRefresh() {
  return useCallback(async () => {
    await catalogStore.refresh({ force: true });
  }, []);
}

/**
 * `songs/data`. Por defecto sin borradores ni pendientes (`filterSongsData`);
 * con `{ raw: true }`, tal cual (el editor y «Tu selección» lo necesitan).
 */
export function useCatalogSongs(
  opts: { raw?: boolean } = {},
): NodeResult<SongsData> {
  const state = useCatalogState();
  const refresh = useRefresh();
  const raw = state.catalog?.songs?.data ?? null;
  const data = useMemo(
    () => (opts.raw ? raw : filterSongsData(raw)),
    [raw, opts.raw],
  );
  return { data, loading: !state.ready, offline: state.offline, refresh };
}

/** `songs/tags/data` (catálogo de etiquetas, opcional). */
export function useCatalogTags(): unknown {
  const state = useCatalogState();
  return state.catalog?.tags?.data ?? null;
}

/** `songs/packs/data` (bloques de villancicos y demás). */
export function useCatalogPacks(): unknown {
  const state = useCatalogState();
  return state.catalog?.packs?.data ?? null;
}

/** `songs/cantoralConfig` ya leído, con el modo que manda hoy. */
export function useCatalogConfig(): CantoralConfig & {
  effectiveMode: CantoralMode;
} {
  const state = useCatalogState();
  const raw = state.catalog?.cantoralConfig?.data;
  return useMemo(() => {
    const config = raw ? parseCantoralConfig(raw) : DEFAULT_CANTORAL_CONFIG;
    return {
      ...config,
      effectiveMode: effectiveMode(config, localIsoDate(new Date())),
    };
  }, [raw]);
}

/** `updatedAt` (ms) del cantoral que tiene este dispositivo. */
export function useCatalogVersion(): number {
  const state = useCatalogState();
  return state.catalog?.songs?.updatedAt ?? 0;
}
