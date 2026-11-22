/**
 * Lógica PURA del pedal (`04-directo.md` §8): de una tecla o de un cambio de
 * volumen a una acción de paso de página. Sin React ni módulos nativos, para
 * poder probarla entera (`__tests__/pedalKeys.test.ts`). El hook `usePedal`
 * solo la enchufa a `expo-key-event` y a `react-native-volume-manager`.
 */

/**
 * - `next`/`prev`: página siguiente/anterior; al final de la canción, la
 *   siguiente canción (eso lo decide la pantalla, no esta lógica).
 * - `nextSong`/`prevSong`: pulsación larga, salta de canción directamente.
 */
export type PedalAction = 'next' | 'prev' | 'nextSong' | 'prevSong';

export type PedalPlatform = 'ios' | 'android' | 'web';

/** Pulsación larga por defecto (ms) y sus límites en Ajustes. */
export const DEFAULT_LONG_PRESS_MS = 600;
export const MIN_LONG_PRESS_MS = 300;
export const MAX_LONG_PRESS_MS = 1500;

/** Códigos «web» (`KeyboardEvent.code`) → acción. Todas las teclas comunes. */
const KEY_ACTIONS: Record<string, 'next' | 'prev'> = {
  ArrowRight: 'next',
  ArrowDown: 'next',
  PageDown: 'next',
  Space: 'next',
  Enter: 'next',
  NumpadEnter: 'next',
  ArrowLeft: 'prev',
  ArrowUp: 'prev',
  PageUp: 'prev',
};

/**
 * Códigos que `expo-key-event` deja SIN traducir (devuelve el número tal cual
 * si no está en su tabla). Por plataforma: HID de iOS (`pressesBegan`) y
 * `KeyEvent` de Android. Es la red de seguridad de `normalizeKeyCode`.
 */
const RAW_CODES: Record<'ios' | 'android', Record<string, string>> = {
  ios: {
    '79': 'ArrowRight',
    '80': 'ArrowLeft',
    '81': 'ArrowDown',
    '82': 'ArrowUp',
    '78': 'PageDown',
    '75': 'PageUp',
    '44': 'Space',
    '40': 'Enter',
    '88': 'NumpadEnter',
  },
  android: {
    '22': 'ArrowRight',
    '21': 'ArrowLeft',
    '20': 'ArrowDown',
    '19': 'ArrowUp',
    '93': 'PageDown',
    '92': 'PageUp',
    '62': 'Space',
    '66': 'Enter',
    '160': 'NumpadEnter',
  },
  // En web no hay códigos numéricos: `code` ya viene como texto.
};

/** Nombres antiguos o de `KeyboardEvent.key` que llegan como «código». */
const ALIASES: Record<string, string> = {
  Right: 'ArrowRight',
  Left: 'ArrowLeft',
  Down: 'ArrowDown',
  Up: 'ArrowUp',
  Spacebar: 'Space',
  ' ': 'Space',
  Return: 'Enter',
  DpadRight: 'ArrowRight',
  DpadLeft: 'ArrowLeft',
  DpadDown: 'ArrowDown',
  DpadUp: 'ArrowUp',
  DpadCenter: 'Enter',
};

/**
 * Deja el código de una tecla en el vocabulario web (`ArrowRight`, `PageDown`,
 * `Space`, `Enter`…), venga de iOS, Android o web. Lo desconocido pasa tal
 * cual (no es ninguna acción, pero sirve para depurar).
 */
export function normalizeKeyCode(
  key: string | null | undefined,
  platform: PedalPlatform = 'web',
): string {
  if (key == null) return '';
  const raw = String(key);
  if (platform !== 'web' && /^\d+$/.test(raw)) {
    return RAW_CODES[platform][raw] ?? raw;
  }
  return ALIASES[raw] ?? raw;
}

/** La acción corta de una tecla, o `null` si no es del pedal. */
export function keyToAction(
  key: string | null | undefined,
  platform: PedalPlatform = 'web',
): 'next' | 'prev' | null {
  return KEY_ACTIONS[normalizeKeyCode(key, platform)] ?? null;
}

/** La versión «salto de canción» de una acción corta. */
export function longVariant(action: 'next' | 'prev'): 'nextSong' | 'prevSong' {
  return action === 'next' ? 'nextSong' : 'prevSong';
}

/** Acota la pulsación larga al rango admitido (valores raros → por defecto). */
export function clampLongPressMs(ms: unknown): number {
  if (typeof ms !== 'number' || !Number.isFinite(ms))
    return DEFAULT_LONG_PRESS_MS;
  return Math.min(
    MAX_LONG_PRESS_MS,
    Math.max(MIN_LONG_PRESS_MS, Math.round(ms)),
  );
}

/** Texto corto de una acción, para «Pulsa el pedal para probar». */
export const PEDAL_ACTION_LABEL: Record<PedalAction, string> = {
  next: 'Siguiente',
  prev: 'Anterior',
  nextSong: 'Canción siguiente',
  prevSong: 'Canción anterior',
};

// ── Pulsación corta / larga ────────────────────────────────────────────────

export interface PedalGestureOptions {
  /** Umbral de pulsación larga en ms (se lee en cada pulsación). */
  longPressMs: () => number;
  onAction: (action: PedalAction) => void;
  /** Inyectables para probar sin reloj real. */
  setTimer?: (fn: () => void, ms: number) => unknown;
  clearTimer?: (id: unknown) => void;
}

export interface PedalGesture {
  /** Tecla pulsada (código ya normalizado). Los repetidos del teclado se ignoran. */
  press: (code: string) => void;
  /** Tecla soltada. */
  release: (code: string) => void;
  /** Descarta lo pendiente (al perder el foco o desactivar). */
  cancel: () => void;
  /** Cambia el umbral y/o el receptor sin perder la pulsación en curso. */
  update: (
    next: Partial<Pick<PedalGestureOptions, 'longPressMs' | 'onAction'>>,
  ) => void;
}

/**
 * Máquina de pulsación corta/larga. Si la tecla se suelta antes del umbral
 * sale la acción corta (al soltar); si se mantiene hasta el umbral sale la
 * larga (`nextSong`/`prevSong`) y al soltar ya no sale nada más. Con umbral
 * ≤ 0 no hay pulsación larga y la corta sale al pulsar.
 *
 * Solo hay una tecla activa a la vez: una segunda pulsación sin soltar la
 * primera se descarta (un pedal no manda dos teclas a la vez).
 */
export function createPedalGesture(initial: PedalGestureOptions): PedalGesture {
  const opts = { ...initial };
  const setTimer = opts.setTimer ?? ((fn, ms) => setTimeout(fn, ms));
  const clearTimer =
    opts.clearTimer ??
    ((id) => clearTimeout(id as ReturnType<typeof setTimeout>));

  let active: {
    code: string;
    short: 'next' | 'prev';
    fired: boolean;
    timer: unknown;
  } | null = null;

  const clear = () => {
    if (active?.timer != null) clearTimer(active.timer);
    active = null;
  };

  return {
    press(code) {
      const short = keyToAction(code);
      if (!short) return;
      if (active) return; // repetición del teclado o segunda tecla
      const ms = opts.longPressMs();
      if (!(ms > 0)) {
        opts.onAction(short);
        // Marcamos la tecla como «usada» para ignorar repeticiones hasta soltar.
        active = { code, short, fired: true, timer: null };
        return;
      }
      const state = { code, short, fired: false, timer: null as unknown };
      state.timer = setTimer(() => {
        if (active !== state) return;
        state.fired = true;
        state.timer = null;
        opts.onAction(longVariant(short));
      }, ms);
      active = state;
    },
    release(code) {
      if (!active || active.code !== code) return;
      const { short, fired } = active;
      clear();
      if (!fired) opts.onAction(short);
    },
    cancel: clear,
    update(next) {
      if (next.longPressMs) opts.longPressMs = next.longPressMs;
      if (next.onAction) opts.onAction = next.onAction;
    },
  };
}

// ── Botones de volumen como pedal ──────────────────────────────────────────

/** Escala a la que se re-centra el volumen tras cada pulsación. */
export const VOLUME_CENTER = 0.5;
/** Cambio mínimo para considerar que hubo pulsación (los pasos son ≥ 1/16). */
export const VOLUME_EPSILON = 0.02;

export interface VolumeGestureOptions {
  /** Pone el volumen del sistema (0-1) sin sonido ni indicador. */
  setVolume: (value: number) => void;
  center?: number;
  epsilon?: number;
}

export interface VolumeGesture {
  /** Un cambio de volumen que avisa el sistema. Devuelve la acción o `null`. */
  onVolume: (volume: number) => 'next' | 'prev' | null;
  /** Deja el volumen a media escala (al activar). El cambio propio se ignora. */
  recenter: () => void;
}

/**
 * Subir = `next`, bajar = `prev`, deduciéndolo de la DIRECCIÓN del cambio.
 *
 * - Tras cada pulsación se vuelve a media escala: en iOS solo llegan
 *   *cambios*, y con el volumen al tope «subir» no cambiaría nada (ni al
 *   mínimo «bajar»). Re-centrando, los dos sentidos siempre tienen margen.
 * - El propio re-centrado también dispara un cambio de volumen: se ignora el
 *   primer evento que cae en el centro. Una pulsación real nunca cae ahí
 *   (desde 0,5 el salto mínimo es 1/16).
 */
export function createVolumeGesture(opts: VolumeGestureOptions): VolumeGesture {
  const center = opts.center ?? VOLUME_CENTER;
  const eps = opts.epsilon ?? VOLUME_EPSILON;
  let last: number | null = null;

  const recenter = () => {
    last = center;
    opts.setVolume(center);
  };

  return {
    recenter,
    onVolume(volume) {
      if (!Number.isFinite(volume)) return null;
      if (Math.abs(volume - center) <= eps) {
        // El eco de nuestro re-centrado (o el usuario ya estaba en el centro).
        last = volume;
        return null;
      }
      // Cualquier otra cosa es una pulsación (si el eco del re-centrado no
      // llegó porque el volumen ya estaba centrado, no pasa nada).
      const from = last ?? center;
      const delta = volume - from;
      if (Math.abs(delta) <= eps) return null;
      const action = delta > 0 ? 'next' : 'prev';
      recenter();
      return action;
    },
  };
}

/** ¿Permite el interruptor remoto (D-17) los botones de volumen aquí? */
export function volumeAllowedRemotely(
  config: { volumeButtons: { ios: boolean; android: boolean } },
  platform: PedalPlatform,
): boolean {
  if (platform === 'ios') return config.volumeButtons.ios;
  if (platform === 'android') return config.volumeButtons.android;
  return false;
}
