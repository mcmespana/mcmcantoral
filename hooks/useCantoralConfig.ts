import { useMemo } from 'react';
import { useFirebaseData } from '@/hooks/useFirebaseData';
import {
  DEFAULT_CANTORAL_CONFIG,
  effectiveMode,
  localIsoDate,
  parseCantoralConfig,
  type CantoralConfig,
  type CantoralMode,
} from '@/utils/cantoralConfig';

/**
 * La configuración remota del cantoral (`songs/cantoralConfig`) ya leída, con
 * el modo efectivo de hoy. Sin datos (primera vez sin red) devuelve los
 * valores por defecto: modo normal, sin mantenimiento ni versión mínima.
 */
export function useCantoralConfig(): CantoralConfig & {
  effectiveMode: CantoralMode;
} {
  const { data } = useFirebaseData<CantoralConfig>(
    'songs/cantoralConfig',
    'cantoralConfig',
    parseCantoralConfig,
  );
  const config = data ?? DEFAULT_CANTORAL_CONFIG;
  return useMemo(
    () => ({
      ...config,
      effectiveMode: effectiveMode(config, localIsoDate(new Date())),
    }),
    [config],
  );
}
