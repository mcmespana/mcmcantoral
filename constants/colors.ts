/**
 * Design tokens de color de MCM Cantoral. Los VALORES salen de
 * `constants/theme.ts` (dirección A, «Escenario»: tinta casi negra y ámbar de
 * vela); aquí se conservan los NOMBRES heredados de MCM App para que las
 * pantallas del cantoral sigan funcionando sin reescribirlas una a una.
 *
 * Reglas (`design.md`):
 *
 * 1. No se escriben hex en componentes. Si falta un color, se añade a
 *    `constants/theme.ts` con nombre de ROL y se expone aquí si hace falta.
 * 2. Un token se llama por lo que ES. Nada de azul MCM ni colores por
 *    sección: en MCM Cantoral no hay territorios.
 * 3. `global.css` NO es otra paleta: son las variables del tema de HeroUI
 *    (su `--accent` es nuestro ámbar). Se alimentan de los valores de aquí.
 */
import { Palette, SheetPalette } from '@/constants/theme';

const D = Palette.dark;
const L = Palette.light;

/**
 * Roles de superficie y texto por modo (la capa que leen las pantallas con
 * `themeColors(isDark)`). No hay nivel por encima de `text`: los títulos se
 * distinguen por tamaño y peso, como en iOS.
 */
export const Colors = {
  light: {
    text: L.text,
    background: L.background,
    tint: L.accentText,
    icon: L.icon,
    tabIconDefault: L.icon,
    tabIconSelected: L.accentText,
    shadow: L.shadow,
    card: L.card,
    /** Subtítulos, metadatos, texto de apoyo. */
    textSecondary: L.textSecondary,
    /** Terciario: lo más tenue que se lee (≥ 4,5:1). */
    textMuted: L.textMuted,
    /** Enlaces y acciones en texto: el ámbar oscurecido. */
    link: L.accentText,
    /** Fondo hundido: lo que va DEBAJO de las cards. */
    backgroundSunken: L.backgroundSunken,
    /** Hairline entre filas. */
    separator: L.separator,
    /** Botones y título de las cabeceras nativas. */
    headerTint: L.headerTint,
  },
  dark: {
    text: D.text,
    background: D.background,
    tint: D.accent,
    icon: D.icon,
    tabIconDefault: D.icon,
    tabIconSelected: D.accent,
    shadow: D.shadow,
    card: D.card,
    textSecondary: D.textSecondary,
    textMuted: D.textMuted,
    link: D.accentText,
    backgroundSunken: D.backgroundSunken,
    separator: D.separator,
    headerTint: D.headerTint,
  },
};

/** Resuelve los roles del modo activo: `themeColors(isDark).textSecondary`. */
export const themeColors = (isDark: boolean) =>
  isDark ? Colors.dark : Colors.light;

/**
 * Grises cálidos (la paleta cruda). Para roles usa `themeColors`; esto es
 * para cuando de verdad hace falta un gris concreto (bordes, pistas).
 */
export const SystemGray = {
  light: {
    gray: '#8F877A',
    gray2: '#ADA594',
    gray3: '#C9C1B0',
    gray4: '#D8D0BF',
    gray5: L.separator,
    gray6: L.backgroundSunken,
  },
  dark: {
    gray: '#8F877A',
    gray2: '#6A6255',
    gray3: '#4A443A',
    gray4: '#3A352D',
    gray5: D.separator,
    gray6: D.card,
  },
} as const;

/**
 * Paleta cromática de la app (sustituye a la de MCM: aquí no hay azul MCM).
 * El ámbar es la acción principal y la «vela»; el resto, tonos de fuego
 * para lo decorativo (la animación de actualizar, las chispas).
 */
const brand = {
  primary: L.accent, // Ámbar de vela — relleno de la acción principal
  secondary: '#FFD98A', // Ámbar claro
  accent: '#FF8A3D', // Brasa
  info: '#E8A317', // Ámbar profundo
  green: '#C99A2E', // Oro viejo (decorativo)
  yellow: '#FFD23F', // Amarillo llama
  text: D.background, // Tinta
  background: L.background,
  white: '#ffffff',
  black: '#000000',
  border: L.separator,
};

export default brand;

/** Colores de UI heredados con nombre propio. */
export const UIColors = {
  /** Acción del sistema: en MCM Cantoral es el ámbar. */
  iosBlue: L.accentText,
  /** Acordes en la UI nativa (no en la hoja): el ámbar oscuro. */
  chordBlue: SheetPalette.light.chord,
  /** Gris del texto secundario dentro del HTML de una canción. */
  chordSecondaryText: SheetPalette.light.muted,
  /** El ámbar del cantoral (rellenos, destacados). */
  accentYellow: L.accent,
  /** Botones de cabecera en claro (4,5:1 sobre el papel). */
  cantoralHeaderTintLight: L.headerTint,
  modalOverlay: L.overlay,
} as const;

/**
 * Hoja de una canción (el HTML del WebView, `utils/songSheetLayout.ts`): sus
 * valores salen de `SheetPalette` de `constants/theme.ts`.
 */
export const SongSheetColors = {
  light: SheetPalette.light,
  dark: SheetPalette.dark,
  stage: SheetPalette.stage,
  sun: SheetPalette.sun,
} as const;

/** Cabecera del cantoral (antes, el color de su pestaña). */
export const TabHeaderColors = {
  cancionero: D.background,
};

// Afinador del cantoral (`screens/TunerScreen.tsx`). Son los verde y
// naranja de sistema de Apple: «afinada» y «casi», que es lo que significan en
// cualquier afinador. Cada uno en dos tonos: `ink` es el que se lee como texto
// o trazo fino sobre el fondo de su modo (≥4,5:1 en claro, el verde/naranja
// accesible de Apple; en oscuro, el de sistema), `fill` es el tinte suave de
// detrás. No son colores de marca ni de estado general: un toast sigue usando
// `ToastColors`.
export const TunerColors = {
  inTuneInkLight: '#248A3D',
  inTuneInkDark: '#30D158',
  inTuneFillLight: 'rgba(52, 199, 89, 0.14)',
  inTuneFillDark: 'rgba(48, 209, 88, 0.18)',
  nearInkLight: '#C93400',
  nearInkDark: '#FF9F0A',
} as const;

/** `TunerColors` resueltos por modo. */
export function tunerColors(isDark: boolean) {
  return isDark
    ? {
        inTune: TunerColors.inTuneInkDark,
        inTuneFill: TunerColors.inTuneFillDark,
        near: TunerColors.nearInkDark,
      }
    : {
        inTune: TunerColors.inTuneInkLight,
        inTuneFill: TunerColors.inTuneFillLight,
        near: TunerColors.nearInkLight,
      };
}

// Resaltado del ChordPro en el editor de texto de canciones
// (`components/song-editor/ChordProTextEditor.tsx`). Los mismos papeles que el
// editor del admin del cantoral: acordes en azul, estribillos en ámbar,
// comentarios en naranja, arreglos en rojo MIC, el resto de directivas en gris
// y lo que está mal en rojo. Cada modo con su versión legible como texto sobre
// la superficie hundida del editor.
export const ChordProColors = {
  light: {
    chord: '#0A5FB4',
    section: '#A15C00',
    comment: '#B83F00',
    arr: '#B8323A',
    directive: '#6E6E73',
    error: '#D70015',
    errorBg: 'rgba(215, 0, 21, 0.10)',
  },
  dark: {
    chord: '#7DD3FC',
    section: '#FCD34D',
    comment: '#FDBA74',
    arr: '#F28B8F',
    directive: '#98989F',
    error: '#FF8A80',
    errorBg: 'rgba(255, 138, 128, 0.16)',
  },
} as const;

// Estados visuales compartidos (selección, hover, pressed)
// Usado en SongListItem y futuros componentes con estado seleccionado.
export const StateColors = {
  selectedBgLight: L.accentSoft, // Fondo de item seleccionado en claro
  selectedBgDark: D.accentSoft, // Fondo de item seleccionado en oscuro
  hoverOverlay: 'rgba(0, 0, 0, 0.04)',
  hoverOverlayDark: 'rgba(255, 255, 255, 0.06)',
  pressedOverlay: 'rgba(0, 0, 0, 0.08)',
  pressedOverlayDark: 'rgba(255, 255, 255, 0.10)',
} as const;

// Swipe action colors en SongListItem — Apple system colors
export const SwipeColors = {
  add: '#34C759', // Apple system green — swipe derecho "Seleccionar"
  remove: '#FF453A', // Apple system red — swipe izquierdo "Quitar"
} as const;

// Key pill background en SongListItem
export const KeyPillColors = {
  bgLight: L.cardRaised,
  bgDark: D.cardRaised,
  /**
   * Borde y relleno del icono de «Tu selección» en el cantoral, la misma
   * familia azul que el fondo. Estaban a mano en sus cuatro usos.
   */
  borderLight: L.separator,
  borderDark: D.separator,
} as const;

/**
 * Destacado ámbar: la canción o playlist marcada. Vivía como cuatro hex
 * sueltos repetidos en `PlaylistRow`, `SongListItem` y `TransposeBottomSheet`,
 * con deriva entre ellos (`#3A2D0A` en uno, `#3A2800` en otro).
 */
export const HighlightColors = {
  light: { bg: L.accentSoft, fg: L.accentText, border: L.accent },
  dark: { bg: D.accentSoft, fg: D.accent, border: '#7A5A00' },
} as const;

/**
 * Colores litúrgicos. No son decoración: son los del tiempo litúrgico, y los
 * fija la Iglesia, no nosotros. Estaban escritos a mano dentro de
 * `LiturgicalBadge`, que es el único sitio donde se sabía cuál era cuál.
 */
export const LiturgicalColors = {
  /** Tiempo Ordinario. */
  green: '#3A7D44',
  /** Adviento y Cuaresma. */
  purple: '#6B3FA0',
  /** Navidad y Pascua. */
  gold: '#D4A070',
  /** Semana Santa (Domingo de Ramos y Viernes Santo). */
  red: '#C41E3A',
  /** Gaudete y Laetare — el rosa de los dos domingos de alegría. */
  rose: '#D4A0A7',
  /** Solemnidades y fiestas del Señor y de la Virgen (blanco litúrgico). */
  white: '#F5F5F5',
} as const;

