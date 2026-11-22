/**
 * `usePedal`: pedal Bluetooth, teclado y (opcional) botones de volumen como
 * pasapáginas (`04-directo.md` §8, D-17).
 *
 * - Teclas: `expo-key-event` (vista nativa con el foco en iOS/Android, y
 *   `keydown` en web, que la propia librería ya resuelve). Un campo de texto,
 *   un modal o una hoja le roban el foco: por eso se vuelve a escuchar al
 *   volver la app a primer plano, al enfocarse la pantalla y cuando la
 *   pantalla llama a `relisten()` (p. ej. al cerrar un modal).
 * - Volumen: `react-native-volume-manager`, con el indicador del sistema
 *   escondido mientras está activo y restaurado (junto con el volumen que
 *   había) al salir. Solo si el ajuste local está encendido Y el interruptor
 *   remoto `cantoralConfig.volumeButtons` lo permite en esa plataforma.
 *
 * Quien lo usa recibe acciones (`next`/`prev`/`nextSong`/`prevSong`); qué
 * significan (pasar página, canción, publicar en el directo) lo decide la
 * pantalla.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Platform } from 'react-native';
import { useKeyEventListener } from 'expo-key-event';
import {
  addVolumeListener,
  getVolume,
  setVolume,
  showNativeVolumeUI,
} from 'react-native-volume-manager';
import { useFocusEffect } from 'expo-router/react-navigation';
import { useCantoralConfig } from '@/hooks/useCantoralConfig';
import { usePedalSettings } from '@/hooks/usePedalSettings';
import { logger } from '@/utils/logger';
import {
  createPedalGesture,
  createVolumeGesture,
  DEFAULT_LONG_PRESS_MS,
  normalizeKeyCode,
  volumeAllowedRemotely,
  type PedalAction,
  type PedalPlatform,
} from '@/utils/pedalKeys';

export interface UsePedalOptions {
  /** Apagar sin quitar el hook (p. ej. con un modal o la hoja de Ajustes abierta). */
  enabled: boolean;
  onAction: (action: PedalAction) => void;
  /**
   * Botones de volumen como pedal. Si se omite, se usa el ajuste local
   * (`usePedalSettings`, apagado de serie). El interruptor remoto manda
   * siempre, se pase lo que se pase.
   */
  volumeButtons?: boolean;
}

export interface UsePedalResult {
  /** Vuelve a pedir el foco de teclado. Llámalo al cerrar modales y hojas. */
  relisten: () => void;
  /** `true` si los botones de volumen están funcionando de verdad ahora mismo. */
  volumeActive: boolean;
}

const PLATFORM: PedalPlatform =
  Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web';

export function usePedal({
  enabled,
  onAction,
  volumeButtons,
}: UsePedalOptions): UsePedalResult {
  const config = useCantoralConfig();
  const { settings } = usePedalSettings();

  // Pulsación corta/larga (el umbral y el receptor se ponen al día en el efecto).
  const [gesture] = useState(() =>
    createPedalGesture({
      longPressMs: () => DEFAULT_LONG_PRESS_MS,
      onAction: () => {},
    }),
  );

  // Lo último que dijo la pantalla, para que los callbacks no queden viejos.
  const enabledRef = useRef(enabled);
  const onActionRef = useRef(onAction);
  const { longPressMs } = settings;
  useEffect(() => {
    enabledRef.current = enabled;
    onActionRef.current = onAction;
    gesture.update({ longPressMs: () => longPressMs, onAction });
  });

  const volumeWanted = volumeButtons ?? settings.volumeButtons;
  const volumeActive =
    enabled && volumeWanted && volumeAllowedRemotely(config, PLATFORM);

  const { startListening, stopListening } = useKeyEventListener(
    (event) => {
      const code = normalizeKeyCode(event.key, PLATFORM);
      if (event.eventType === 'press') {
        // `repeat` solo viene con captureModifiers; el gesto ya ignora repetidos.
        gesture.press(code);
      } else {
        gesture.release(code);
      }
    },
    {
      listenOnMount: false,
      listenToRelease: true,
      captureModifiers: true,
      preventReload: true,
    },
  );

  // Las funciones de la librería cambian de identidad al cambiar el listener
  // (web): se guardan en refs para no reenganchar en cada render.
  const startRef = useRef(startListening);
  const stopRef = useRef(stopListening);
  useEffect(() => {
    startRef.current = startListening;
    stopRef.current = stopListening;
  });

  const relisten = useCallback(() => {
    if (!enabledRef.current) return;
    try {
      stopRef.current();
      startRef.current();
    } catch (e) {
      logger.warn('Pedal: no se pudo volver a escuchar el teclado', e);
    }
  }, []);

  // Activar/desactivar.
  useEffect(() => {
    if (!enabled) return;
    try {
      startRef.current();
    } catch (e) {
      logger.warn('Pedal: no se pudo escuchar el teclado', e);
    }
    return () => {
      gesture.cancel();
      try {
        stopRef.current();
      } catch (e) {
        logger.warn('Pedal: no se pudo dejar de escuchar el teclado', e);
      }
    };
  }, [enabled, gesture]);

  // Volver a primer plano: el foco se pierde al ir y venir.
  useEffect(() => {
    if (!enabled) return;
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') relisten();
      else gesture.cancel();
    });
    return () => sub?.remove();
  }, [enabled, relisten, gesture]);

  // Al enfocarse la pantalla (volver de otra pantalla de la pila).
  useFocusEffect(
    useCallback(() => {
      relisten();
    }, [relisten]),
  );

  // ── Botones de volumen ─────────────────────────────────────────────────
  useEffect(() => {
    if (!volumeActive) return;
    let cancelled = false;
    let initialVolume: number | null = null;
    let sub: { remove: () => void } | null = null;

    const volume = createVolumeGesture({
      setVolume: (v) => {
        setVolume(v, { showUI: false, playSound: false }).catch((e) =>
          logger.warn('Pedal: no se pudo re-centrar el volumen', e),
        );
      },
    });

    (async () => {
      try {
        const before = await getVolume();
        if (cancelled) return;
        initialVolume = before.volume;
        await showNativeVolumeUI({ enabled: false });
        if (cancelled) {
          // La limpieza llegó antes de que se escondiera: devolvemos el indicador.
          showNativeVolumeUI({ enabled: true }).catch(() => {});
          return;
        }
        sub = addVolumeListener(({ volume: v }) => {
          const action = volume.onVolume(v);
          if (action) onActionRef.current(action);
        });
        volume.recenter();
      } catch (e) {
        logger.warn('Pedal: botones de volumen no disponibles', e);
      }
    })();

    return () => {
      cancelled = true;
      sub?.remove();
      showNativeVolumeUI({ enabled: true }).catch(() => {});
      if (initialVolume != null) {
        setVolume(initialVolume, { showUI: false, playSound: false }).catch(
          () => {},
        );
      }
    };
  }, [volumeActive]);

  return { relisten, volumeActive };
}
