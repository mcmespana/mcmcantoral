/**
 * Ajustes locales del pedal (Ajustes → Pedal), en AsyncStorage. Almacén de
 * módulo + `useSyncExternalStore` para que todas las pantallas (la hoja, el
 * directo, el ensayo) vean el mismo valor sin un Provider. Mismo patrón de
 * hidratación y escritura que `contexts/AppSettingsContext.tsx`.
 */
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '@/utils/logger';
import { clampLongPressMs, DEFAULT_LONG_PRESS_MS } from '@/utils/pedalKeys';

export const PEDAL_STORAGE_KEY = '@cantoral_pedal_v1';

export interface PedalSettings {
  /** Botones de volumen como pedal. Apagado de serie (D-17). */
  volumeButtons: boolean;
  /** Umbral de pulsación larga, en ms. */
  longPressMs: number;
}

export const DEFAULT_PEDAL_SETTINGS: PedalSettings = {
  volumeButtons: false,
  longPressMs: DEFAULT_LONG_PRESS_MS,
};

let state: PedalSettings = DEFAULT_PEDAL_SETTINGS;
let hydrated = false;
let hydrating: Promise<void> | null = null;
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

function parse(raw: unknown): PedalSettings {
  const r =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return {
    volumeButtons: r.volumeButtons === true,
    longPressMs: clampLongPressMs(r.longPressMs ?? DEFAULT_LONG_PRESS_MS),
  };
}

/** Lee el almacenamiento una vez. Lo que se haya tocado antes de acabar gana. */
function hydrate(): Promise<void> {
  if (hydrated) return Promise.resolve();
  if (!hydrating) {
    const touchedBefore = state;
    hydrating = AsyncStorage.getItem(PEDAL_STORAGE_KEY)
      .then((data) => {
        if (data && state === touchedBefore) {
          state = parse(JSON.parse(data));
          emit();
        }
      })
      .catch((e) => logger.error('Failed loading pedal settings', e))
      .finally(() => {
        hydrated = true;
      });
  }
  return hydrating;
}

/** Cambia ajustes y los guarda (sin esperar: la UI no se bloquea). */
export function setPedalSettings(values: Partial<PedalSettings>): void {
  const next = parse({ ...state, ...values });
  state = next;
  emit();
  AsyncStorage.setItem(PEDAL_STORAGE_KEY, JSON.stringify(next)).catch((e) =>
    logger.error('Failed saving pedal settings', e),
  );
}

/** Solo para tests: vuelve al estado de fábrica y a «sin hidratar». */
export function resetPedalSettingsForTests(): void {
  state = DEFAULT_PEDAL_SETTINGS;
  hydrated = false;
  hydrating = null;
  emit();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

const getSnapshot = () => state;

export function usePedalSettings(): {
  settings: PedalSettings;
  setSettings: (values: Partial<PedalSettings>) => void;
} {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  useEffect(() => {
    void hydrate();
  }, []);
  const setSettings = useCallback(
    (values: Partial<PedalSettings>) => setPedalSettings(values),
    [],
  );
  return { settings, setSettings };
}
