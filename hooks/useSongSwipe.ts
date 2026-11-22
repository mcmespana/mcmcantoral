/**
 * Pasar de canción deslizando en el Atril (`SongDetailScreen`): el gesto y la
 * pista de las primeras veces. Fuera de la pantalla para que se pueda leer
 * (y tocar) por separado.
 */
import { useEffect, useRef } from 'react';
import {
  withDelay,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';
import { Gesture } from 'react-native-gesture-handler';
import { rubberBand, shouldCommitGesture } from '@/utils/gesturePhysics';
import { durations, motionEasings, springs } from '@/constants/animations';
import { h } from '@/utils/haptics';

/**
 * Swipe entre canciones: se cambia al soltar si se ha arrastrado más de esto
 * (px) o se suelta más rápido que esto (px/s). Basta con UNO de los dos.
 */
export const SONG_SWIPE_DISTANCE = 80;
const SONG_SWIPE_VELOCITY = 500;
/**
 * Pista de las primeras veces: la letra se aparta esto (px) — menos que el
 * umbral, así que la pastilla asoma sin «armarse» — y vuelve.
 */
const HINT_NUDGE = 64;
/** Espera antes de la pista (que la letra haya cargado) y cuánto se queda. */
const HINT_DELAY_MS = 1100;
const HINT_HOLD_MS = 900;
const HINT_REVEAL_MS = 2200;

/** Título para la pastilla, sin el «12. » del número del cantoral. */
export const peekTitle = (title: string | undefined) =>
  (title ?? '').replace(/^\d+\.\s*/, '');

/**
 * Pista de gesto: «desliza para pasar de canción». Mucha gente no descubre
 * que en una lista se pasa de canción deslizando. Las primeras veces, al
 * entrar, la letra se aparta un poco hacia la canción de al lado, asoma la
 * pastilla «Siguiente · Título» y vuelve. Si el usuario toca mientras, su
 * dedo manda (el gesto escribe `slideAnim` y corta la demo). Con «reducir
 * movimiento», la letra no se mueve: solo aparece la pastilla un momento.
 */
export function useSwipeHint({
  hintSide,
  consumeHint,
  reducedMotion,
  slideAnim,
  hintReveal,
  peekEnabled,
}: {
  hintSide: 'prev' | 'next' | null;
  consumeHint: () => void;
  reducedMotion: boolean;
  slideAnim: SharedValue<number>;
  hintReveal: SharedValue<number>;
  peekEnabled: SharedValue<number>;
}) {
  const hintPlayed = useRef(false);
  useEffect(() => {
    if (!hintSide || hintPlayed.current) return;
    hintPlayed.current = true;
    consumeHint();
    peekEnabled.set(1);
    if (reducedMotion) {
      hintReveal.set(
        withDelay(
          HINT_DELAY_MS,
          withSequence(
            withTiming(1, { duration: durations.base }),
            withDelay(
              HINT_REVEAL_MS,
              withTiming(0, { duration: durations.base }),
            ),
          ),
        ),
      );
      return;
    }
    const dir = hintSide === 'next' ? -1 : 1;
    slideAnim.set(
      withDelay(
        HINT_DELAY_MS,
        withSequence(
          withTiming(dir * HINT_NUDGE, {
            duration: durations.slow,
            easing: motionEasings.out,
          }),
          withDelay(HINT_HOLD_MS, withSpring(0, springs.settle)),
        ),
      ),
    );
  }, [
    hintSide,
    consumeHint,
    reducedMotion,
    slideAnim,
    hintReveal,
    peekEnabled,
  ]);
}

/**
 * El gesto: la letra va pegada al dedo (1:1) y hacia un lado sin canción
 * cede elástica; al soltar cambia por distancia o velocidad.
 */
export function useSongSwipeGesture({
  canSwipe,
  hasPrev,
  hasNext,
  slideAnim,
  peekEnabled,
  swipeArmed,
  onLearned,
  onPrev,
  onNext,
}: {
  canSwipe: boolean;
  hasPrev: boolean;
  hasNext: boolean;
  slideAnim: SharedValue<number>;
  peekEnabled: SharedValue<number>;
  swipeArmed: SharedValue<boolean>;
  onLearned: () => void;
  onPrev: (velocity?: number) => void;
  onNext: (velocity?: number) => void;
}) {
  return Gesture.Pan()
    .enabled(canSwipe)
    .activeOffsetX([-20, 20])
    .failOffsetY([-15, 15])
    .onStart(() => {
      peekEnabled.set(1);
      swipeArmed.set(false);
    })
    .onUpdate((e) => {
      const tx = e.translationX;
      const blocked = (tx > 0 && !hasPrev) || (tx < 0 && !hasNext);
      slideAnim.set(blocked ? rubberBand(tx) : tx);
      // Tic al cruzar el umbral (soltar ya cambia de canción), a la vez que
      // la pastilla se arma. Uno por cruce, nunca por frame.
      const armed = !blocked && Math.abs(tx) >= SONG_SWIPE_DISTANCE;
      if (armed !== swipeArmed.get()) {
        swipeArmed.set(armed);
        if (armed) scheduleOnRN(h.select);
      }
    })
    .onEnd((e, success) => {
      const tx = e.translationX;
      const commit =
        success &&
        shouldCommitGesture(
          tx,
          e.velocityX,
          SONG_SWIPE_DISTANCE,
          SONG_SWIPE_VELOCITY,
        );
      if (commit && tx > 0 && hasPrev) {
        peekEnabled.set(0);
        scheduleOnRN(onLearned);
        scheduleOnRN(onPrev, e.velocityX);
      } else if (commit && tx < 0 && hasNext) {
        peekEnabled.set(0);
        scheduleOnRN(onLearned);
        scheduleOnRN(onNext, e.velocityX);
      } else {
        // Vuelta rápida, heredando la velocidad (también si el gesto se
        // canceló: lo robó el scroll, entró una llamada…).
        slideAnim.set(
          withSpring(0, { ...springs.snap, velocity: e.velocityX }),
        );
      }
    });
}
