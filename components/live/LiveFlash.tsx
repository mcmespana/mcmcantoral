/**
 * Destello de un aviso (`04-directo.md` §6): el BORDE de la pantalla late dos
 * veces y el móvil vibra. Nunca tapa la letra (solo el marco, sin toques).
 * Con «reducir movimiento», el borde se queda fijo un momento.
 *
 * Lo monta cada pantalla del Atril encima de todo (`StyleSheet.absoluteFill`).
 */
import React, { useEffect, useRef } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '@/hooks/useTheme';
import { durations } from '@/constants/animations';
import { useLive } from '@/contexts/LiveContext';
import { avisoEsParaMi } from '@/services/live/protocol';
import { h } from '@/utils/haptics';

const PULSE_MS = durations.base;
const HOLD_MS = durations.hero * 2;
/** Un destello que llega tarde (reconexión) ya no late. */
const FRESH_MS = 10_000;

export default function LiveFlash() {
  const t = useTheme();
  const live = useLive();
  const reduced = useReducedMotion();
  const opacity = useSharedValue(0);
  const seenRef = useRef<string | null>(null);

  const last = live.view.avisos[live.view.avisos.length - 1];
  const flash =
    live.role === 'follower' &&
    last &&
    last.kind === 'destello' &&
    avisoEsParaMi(last, live.prefs.inst)
      ? last
      : null;

  useEffect(() => {
    if (!flash || seenRef.current === flash.id) return;
    seenRef.current = flash.id;
    if (Date.now() - flash.at > FRESH_MS) return;
    h.error();
    opacity.set(
      reduced
        ? withSequence(
            withTiming(1, { duration: durations.quick }),
            withDelay(HOLD_MS, withTiming(0, { duration: durations.quick })),
          )
        : withSequence(
            withTiming(1, { duration: PULSE_MS }),
            withTiming(0.2, { duration: PULSE_MS }),
            withTiming(1, { duration: PULSE_MS }),
            withDelay(HOLD_MS / 2, withTiming(0, { duration: PULSE_MS * 2 })),
          ),
    );
  }, [flash, reduced, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get() }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[styles.frame, { borderColor: t.live }, style]}
    />
  );
}

const styles = StyleSheet.create({
  frame: {
    ...StyleSheet.absoluteFill,
    borderWidth: 8,
  },
});
