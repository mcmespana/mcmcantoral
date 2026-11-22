import { logger } from '@/utils/logger';
import { useState, useMemo } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { Notation } from '../utils/chordNotation';
import type { ChorusStyle } from '../utils/songSheetLayout';
import {
  buildErrorHtml,
  buildSongDocument,
  NO_SHEET_INFO,
  parseChordPro,
  type ParsedResult,
  type SongParseError,
  type SongSheetInfo,
  type SongStyleState,
} from '../utils/songDocument';

export type { SongParseError, SongSheetInfo, SongStyleState };

export interface UseSongProcessorParams {
  originalChordPro: string | null;
  currentTranspose: number;
  chordsVisible: boolean;
  /** Mostrar anotaciones de arreglo `{arr:}`. Default true. */
  arrangementsVisible?: boolean;
  /**
   * Vista compacta: los estribillos que se repiten se pliegan en una línea
   * («Estribillo ×2»), que se despliega al tocarla. Default false.
   */
  compact?: boolean;
  /** Números de estrofa. Default true. */
  verseNumbers?: boolean;
  /** Variante del estribillo. Default 'negrita' (raya + negrita). */
  chorusStyle?: ChorusStyle;
  /** Etiqueta «ESTRIBILLO». Default true. */
  chorusLabel?: boolean;
  /** Más hueco entre líneas y bloques. Default false. */
  airy?: boolean;
  /**
   * Pantalla completa en páginas (modo atril): sin scroll, se pasa de página
   * con un toque en el borde o con un pedal. Default false.
   */
  paged?: boolean;
  /** Mapa de la canción («1 · E · 2 · E×2») encima de la letra. Default false. */
  songMap?: boolean;
  currentFontSizeEm: number;
  currentFontFamily: string;
  notation: Notation;
  title?: string;
  author?: string;
  key?: string;
  capo?: number;
  /** Duración `m:ss` (la publica el cantoral): insignia en la hoja. */
  duration?: string;
  /** Tema del Atril: Escenario o Sol fuerzan el suyo (`auto` = el de la app). */
  sheetTheme?: 'auto' | 'stage' | 'sun';
  isFullscreen?: boolean;
  isDark?: boolean;
  /** Padding superior extra (px). Útil en fullscreen para evitar notch / close button. */
  topInset?: number;
  /** Padding inferior extra (px). Útil en fullscreen para no esconder texto bajo play/safe-area. */
  bottomInset?: number;
  /**
   * Modo admin: si es true, cada línea renderizada se etiqueta con el índice de
   * su línea en el ChordPro original y un long-press sobre ella envía ese índice
   * a RN (mensaje `{ type: 'arr-longpress', line }`) para insertar un `{arr:}`.
   */
  adminMode?: boolean;
  /** Apuntes: `data-line` y toque largo → `line-longpress` (`05`). */
  lineNotes?: boolean;
}

// El detalle pasa su propio `bottomInset` (la barra inferior de vidrio flota
// encima de la letra, T-05); esto es para quien no lo pasa (la vista previa
// del admin pinta igual que la web).
const defaultBottomPadding = (isFullscreen: boolean) =>
  isFullscreen
    ? 110
    : Platform.OS === 'ios'
      ? 120
      : Platform.OS === 'web'
        ? 40
        : 80;

const defaultTopPadding = (isFullscreen: boolean) => (isFullscreen ? 72 : 16);

interface BuiltSheet {
  deps: unknown[];
  html: string;
  info: SongSheetInfo;
}

function sameDeps(a: unknown[], b: unknown[]): boolean {
  return a.length === b.length && a.every((x, i) => Object.is(x, b[i]));
}

type ComposeOptions = Omit<Parameters<typeof buildSongDocument>[1], 'style'>;

/** La hoja (o la de error) con el estilo de ahora dentro. */
function composeSheet(
  baseSong: ParsedResult['song'],
  songError: SongParseError | null,
  style: SongStyleState,
  opts: ComposeOptions,
): { html: string; info: SongSheetInfo } {
  const errorHtml = () =>
    buildErrorHtml(songError, style.isDark, style.fontFamily);
  if (!baseSong) return { html: errorHtml(), info: NO_SHEET_INFO };
  try {
    const { html, sheetInfo } = buildSongDocument(baseSong, {
      ...opts,
      style,
    });
    return { html, info: sheetInfo };
  } catch (err) {
    logger.error('Error procesando canción en useSongProcessor:', err);
    return { html: errorHtml(), info: NO_SHEET_INFO };
  }
}

export const useSongProcessor = ({
  originalChordPro,
  currentTranspose,
  chordsVisible,
  arrangementsVisible = true,
  compact = false,
  verseNumbers = true,
  chorusStyle = 'negrita',
  chorusLabel = true,
  airy = false,
  paged = false,
  songMap = false,
  currentFontSizeEm,
  currentFontFamily,
  notation,
  title,
  author,
  key,
  capo,
  duration,
  sheetTheme = 'auto',
  isFullscreen = false,
  isDark = false,
  topInset,
  bottomInset,
  adminMode = false,
  lineNotes = false,
}: UseSongProcessorParams) => {
  const parsed = useMemo<ParsedResult>(() => {
    if (!originalChordPro) return { song: null, error: null };
    return parseChordPro(originalChordPro);
  }, [originalChordPro]);
  const baseSong = parsed.song;
  const songError = parsed.error;

  // Style snapshot for live updates. Computed every render but stable per
  // structural pass thanks to derived values.
  const topPadding =
    topInset !== undefined ? topInset : defaultTopPadding(isFullscreen);
  const bottomPadding =
    bottomInset !== undefined
      ? bottomInset
      : defaultBottomPadding(isFullscreen);

  const styleState = useMemo<SongStyleState>(
    () => ({
      fontSize: currentFontSizeEm,
      fontFamily: currentFontFamily,
      isDark,
      sheetTheme: sheetTheme === 'auto' ? null : sheetTheme,
      chordsVisible,
      arrangementsVisible,
      compact,
      verseNumbers,
      chorusStyle,
      chorusLabel,
      airy,
      paged,
      songMap,
      topPadding,
      bottomPadding,
    }),
    [
      currentFontSizeEm,
      currentFontFamily,
      isDark,
      sheetTheme,
      chordsVisible,
      arrangementsVisible,
      compact,
      verseNumbers,
      chorusStyle,
      chorusLabel,
      airy,
      paged,
      songMap,
      topPadding,
      bottomPadding,
    ],
  );

  // Escala de letra del sistema: la hoja la aplica en su CSS (ver
  // `systemFontScale` en songDocument). Cambiarla en ajustes recompone la hoja.
  const { fontScale: systemFontScale } = useWindowDimensions();

  // La hoja se recompone SOLO con cambios estructurales (la canción, el tono,
  // la notación…), y se compone al pintar —no en un efecto— con el estilo de
  // ese momento ya dentro. Los cambios solo de estilo (letra, tema, acordes,
  // márgenes) no la recomponen: el WebView los aplica en vivo por mensaje.
  // Es el patrón de React «guardar lo del render anterior»: se compara con lo
  // último compuesto y, si cambió, se compone y se guarda en el mismo render.
  const structural: unknown[] = [
    originalChordPro,
    baseSong,
    songError,
    currentTranspose,
    notation,
    title,
    author,
    key,
    capo,
    duration,
    isFullscreen,
    adminMode,
    lineNotes,
    systemFontScale,
  ];
  const [built, setBuilt] = useState<BuiltSheet | null>(null);
  let current = built;
  // Sin ChordPro (aún no ha llegado) se queda lo que hubiera.
  if (originalChordPro && (!current || !sameDeps(current.deps, structural))) {
    current = {
      deps: structural,
      ...composeSheet(baseSong, songError, styleState, {
        currentTranspose,
        notation,
        title,
        author,
        key,
        capo,
        duration,
        isFullscreen,
        adminMode,
        lineNotes,
        // En web no: el navegador ya tiene su propio zoom, y la vista previa
        // del admin (`mcm-sheet.js`) tiene que pintar el mismo HTML.
        systemFontScale: Platform.OS === 'web' ? undefined : systemFontScale,
      }),
    };
    setBuilt(current);
  }
  const songHtml = current?.html ?? 'Cargando…';
  const sheetInfo = current?.info ?? NO_SHEET_INFO;
  // Se compone al pintar: nunca hay una hoja «a medio hacer».
  const isLoadingSong = false;

  return { songHtml, isLoadingSong, styleState, songError, sheetInfo };
};
