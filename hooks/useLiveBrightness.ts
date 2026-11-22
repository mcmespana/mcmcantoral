/**
 * «Subir brillo en directo» (`04-directo.md` §9, opcional): brillo al máximo
 * mientras se está en un directo con el Atril delante. En iOS cambia el
 * brillo DEL SISTEMA, así que se guarda el que había y se devuelve al salir
 * y al pasar a segundo plano.
 */
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import * as Brightness from 'expo-brightness';
import { logger } from '@/utils/logger';

export function useLiveBrightness(enabled: boolean): void {
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    let before: number | null = null;
    let raised = false;
    const raise = async () => {
      try {
        if (before === null) before = await Brightness.getBrightnessAsync();
        await Brightness.setBrightnessAsync(1);
        raised = true;
      } catch (e) {
        logger.warn('[directo] brillo', e);
      }
    };
    const restore = () => {
      if (!raised || before === null) return;
      raised = false;
      Brightness.setBrightnessAsync(before).catch(() => {});
    };
    void raise();
    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') void raise();
      else restore();
    });
    return () => {
      sub.remove();
      restore();
    };
  }, [enabled]);
}
