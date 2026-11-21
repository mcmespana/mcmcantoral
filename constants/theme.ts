/**
 * Tema de MCM Cantoral — dirección A, «Escenario» (`docs/planes/fork-cantoral/
 * 03-diseno-y-flujos.md` §6): el atril de noche, **tinta casi negra y la luz
 * cálida de una vela** (ámbar/amarillo). Oscuro primero; el claro, bien hecho
 * también («papel»). Ni azul MCM ni colores por sección.
 *
 * **Fuente única de verdad del color.** Las pantallas usan ROLES (`text`,
 * `accent`…), nunca hex: así el estilo final (D-05, lo cierra Izan) entra
 * cambiando valores aquí, sin tocar pantallas. `constants/colors.ts` se
 * alimenta de este fichero.
 *
 * Cuatro temas:
 *  - `dark` («Noche»): el de serie de la interfaz.
 *  - `light` («Papel»): el claro.
 *  - `stage` («Escenario»): el Atril en directo; negro real (OLED).
 *  - `sun` («Sol»): el Atril a pleno sol; contraste máximo.
 *
 * Reglas (las vigila `__tests__/designTokens.test.ts`):
 *  - La letra del Atril ≥ 7:1 (AAA) en los cuatro.
 *  - Los acordes se distinguen también SIN color (peso 700): daltonismo.
 *  - El ámbar como TEXTO sobre claro es `accentText` (oscurecido hasta 4,5:1),
 *    nunca `accent`, que es un relleno.
 */

/** El ámbar de la vela: acción principal, acordes, lo que está vivo. */
const AMBER = '#FFBE2E';
const AMBER_STAGE = '#FFC23D';
const INK = '#0D0C0A';

export const Palette = {
  dark: {
    /** Fondo de pantalla. */
    background: INK,
    /** Lo que va debajo de las tarjetas. */
    backgroundSunken: '#070605',
    /** Tarjetas y superficies elevadas. */
    card: '#1B1915',
    /** Superficie elevada sobre una tarjeta (chips, campos). */
    cardRaised: '#26231D',
    separator: '#2C2822',
    text: '#F5F0E6',
    textSecondary: '#BDB4A4',
    /** Lo más tenue que se lee (≥ 4,5:1 sobre fondo y tarjeta). */
    textMuted: '#958C7C',
    accent: AMBER,
    /** Ámbar como texto (en oscuro es el mismo). */
    accentText: AMBER,
    /** Tinta sobre un relleno ámbar. */
    onAccent: '#1A1404',
    /** Relleno ámbar muy suave (insignias, seleccionado). */
    accentSoft: 'rgba(255, 190, 46, 0.14)',
    /** «En directo» (punto rojo de grabación). */
    live: '#FF5A4F',
    danger: '#FF6B5E',
    success: '#4CD685',
    icon: '#C9C0AF',
    headerTint: '#F5F0E6',
    overlay: 'rgba(0, 0, 0, 0.6)',
    shadow: '#000000',
  },
  light: {
    background: '#FAF7F0',
    backgroundSunken: '#EFE9DC',
    card: '#FFFFFF',
    cardRaised: '#F5F0E4',
    separator: '#E3DBCB',
    text: '#17140F',
    textSecondary: '#5A5244',
    textMuted: '#6B6354',
    accent: AMBER,
    accentText: '#8A5800',
    onAccent: '#1A1404',
    accentSoft: 'rgba(255, 190, 46, 0.22)',
    live: '#D63A2F',
    danger: '#C62E23',
    success: '#1E8A4C',
    icon: '#4D4538',
    headerTint: '#17140F',
    overlay: 'rgba(23, 20, 15, 0.45)',
    shadow: '#000000',
  },
} as const;

export type ThemeRoles = { [K in keyof typeof Palette.dark]: string };

/** Roles del modo activo: `theme(isDark).accent`. */
export const theme = (isDark: boolean): ThemeRoles =>
  isDark ? Palette.dark : Palette.light;

/**
 * La hoja de canción (WebView) en sus cuatro temas. `stage` y `sun` solo los
 * usa el Atril (Aa → Escenario / Sol); `light`/`dark` siguen al sistema.
 */
export const SheetPalette = {
  light: {
    bg: '#FAF7F0',
    text: '#1A1712',
    title: '#17140F',
    chord: '#9A5B00',
    muted: '#6B6354',
    label: '#5A5244',
    chorusBar: AMBER,
    chorusBg: 'rgba(255, 190, 46, 0.10)',
    filler: 'rgba(26, 23, 18, 0.25)',
    arrangement: '#A3471F',
    badgeBg: 'rgba(255, 190, 46, 0.20)',
    badgeText: '#6E4700',
  },
  dark: {
    bg: INK,
    text: '#EDE7DB',
    title: '#F5F0E6',
    chord: AMBER,
    muted: '#958C7C',
    label: '#BDB4A4',
    chorusBar: AMBER,
    chorusBg: 'rgba(255, 190, 46, 0.07)',
    filler: 'rgba(237, 231, 219, 0.26)',
    arrangement: '#FF9A7A',
    badgeBg: 'rgba(255, 190, 46, 0.14)',
    badgeText: AMBER,
  },
  stage: {
    bg: '#000000',
    text: '#F7F3EA',
    title: '#FFFFFF',
    chord: AMBER_STAGE,
    muted: '#A39C8E',
    label: '#C8C0B0',
    chorusBar: AMBER_STAGE,
    chorusBg: 'rgba(255, 194, 61, 0.08)',
    filler: 'rgba(247, 243, 234, 0.28)',
    arrangement: '#FF9A7A',
    badgeBg: 'rgba(255, 194, 61, 0.16)',
    badgeText: AMBER_STAGE,
  },
  sun: {
    bg: '#FFFFFF',
    text: '#000000',
    title: '#000000',
    chord: '#6E4300',
    muted: '#3D372D',
    label: '#2A251D',
    chorusBar: '#B87A00',
    chorusBg: 'rgba(184, 122, 0, 0.08)',
    filler: 'rgba(0, 0, 0, 0.35)',
    arrangement: '#8A2C0E',
    badgeBg: 'rgba(110, 67, 0, 0.10)',
    badgeText: '#6E4300',
  },
} as const;

export type SheetThemeId = keyof typeof SheetPalette;

/**
 * Tamaños mínimos de toque. En directo, 56 pt (guantes y prisa, `03` §1); el
 * resto, los 44 del sistema.
 */
export const TouchTarget = {
  min: 44,
  live: 56,
} as const;
