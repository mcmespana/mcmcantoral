/**
 * Color de los botones e iconos de la cabecera del cantoral.
 *
 * En MCM Cantoral la cabecera es la del fondo de la pantalla en las tres
 * plataformas (transparente con vidrio en iOS, sólida del color del fondo en
 * Android y web): ya no hay barra amarilla. Los botones van en el ámbar de la
 * acción — el que se lee como texto en cada modo (`accentText`).
 */
import { Platform } from 'react-native';
import { theme } from '@/constants/theme';

export function cantoralHeaderTint(
  isDark: boolean,
  _os: typeof Platform.OS = Platform.OS,
): string {
  return theme(isDark).accentText;
}

/** Fondo de la cabecera sólida (Android y web). */
export function cantoralHeaderBackground(isDark: boolean): string {
  return theme(isDark).background;
}
