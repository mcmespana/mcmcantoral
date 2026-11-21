/**
 * Lectura de los QR que la propia app genera (ver `ShareQrModal`).
 *
 * Hay tres formatos posibles y el escáner tiene que reconocerlos todos:
 *
 *   1. Repertorio en la nube  → https://mcm-cantoral.expo.app/playlist?p=1234
 *   2. Directo                → https://mcm-cantoral.expo.app/coro?c=1234
 *   3. Repertorio sin conexión → mcmcantoral://playlist?d=<payload>
 *   4. Coro → …/playlist?coro=<id> (importa SIEMPRE el último repertorio del
 *      coro) y …/coro?coro=<id> (se une a su directo). Estos no caducan: el
 *      mismo QR pegado en la carpeta del coro sirve todos los domingos.
 *
 * Se reconoce por el PATH, no por el dominio ni el esquema: así valen igual
 * los QR y enlaces de MCM App (`mcm.expo.app`, `mcmapp://`) y los de MCM
 * Cantoral (`mcm-cantoral.expo.app`, `mcmcantoral://`), en los dos sentidos.
 *
 * Además aceptamos que alguien escriba/pegue un QR con solo los 4 dígitos.
 *
 * NO usamos `URL`/`URLSearchParams`: la implementación de React Native es
 * parcial (y en Hermes `searchParams` no existe), así que troceamos a mano.
 * Todo esto es lógica pura y sin dependencias para poder testearla.
 */
import { isValidCode } from '@/utils/playlistCodes';
import { isChoirId } from '@/utils/choirIds';

/** A qué flujo apunta un QR escaneado. */
export type QrTarget = 'playlist' | 'choir';

export type QrScanResult =
  /** QR de coro: `choirId` identifica al coro; el flujo depende del path. */
  | { kind: 'choir'; target: QrTarget; choirId: string }
  /**
   * QR con código corto: hay que descargar de Firebase. `target` es `null`
   * cuando el QR traía solo los 4 dígitos, sin decir de qué flujo son: en ese
   * caso vale para el que esté abierto.
   */
  | { kind: 'code'; target: QrTarget | null; code: string }
  /** QR offline: la playlist entera viaja embebida en el payload. */
  | { kind: 'offline'; payload: string };

/** Trocea `a=1&b=2` en un mapa, con los valores ya decodificados. */
function parseQuery(query: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const pair of query.split('&')) {
    if (!pair) continue;
    const eq = pair.indexOf('=');
    if (eq < 0) continue;
    const key = pair.slice(0, eq);
    const raw = pair.slice(eq + 1);
    if (!key || out[key] !== undefined) continue;
    try {
      out[key] = decodeURIComponent(raw.replace(/\+/g, ' '));
    } catch {
      // Un payload mal escapado es mejor pasarlo crudo que descartarlo.
      out[key] = raw;
    }
  }
  return out;
}

/**
 * Interpreta el contenido de un QR. Devuelve `null` si no es nuestro (una
 * tarjeta de contacto, una wifi, la URL de un vídeo…), para que el escáner
 * pueda seguir buscando sin molestar al usuario.
 */
export function parseScannedQr(raw: string): QrScanResult | null {
  const text = (raw ?? '').trim();
  if (!text) return null;

  // 1. Solo el código, sin URL alrededor.
  if (isValidCode(text)) return { kind: 'code', target: null, code: text };

  const qIndex = text.indexOf('?');
  if (qIndex < 0) return null;

  const path = text.slice(0, qIndex).toLowerCase();
  const params = parseQuery(text.slice(qIndex + 1));

  // El path nos dice de qué flujo es el QR. Sin esto, cualquier enlace con un
  // `?p=1234` suelto se colaría como playlist.
  const isPlaylist = /(^|\/)playlist\/?$/.test(path);
  const isChoir = /(^|\/)coro\/?$/.test(path);
  if (!isPlaylist && !isChoir) return null;

  // 2. Playlist offline: el payload manda sobre el código.
  if (isPlaylist && params.d) return { kind: 'offline', payload: params.d };

  // 3. Coro: `?coro=<id>` vale en los dos paths (importar la última / unirse).
  if (params.coro && isChoirId(params.coro)) {
    return {
      kind: 'choir',
      target: isChoir ? 'choir' : 'playlist',
      choirId: params.coro,
    };
  }
  if (isChoir && params.c && isChoirId(params.c)) {
    return { kind: 'choir', target: 'choir', choirId: params.c };
  }

  // 4. Código corto. `code` es el alias que aceptan las dos pantallas puente.
  const code = isChoir ? (params.c ?? params.code) : (params.p ?? params.code);
  if (code && isValidCode(code)) {
    return { kind: 'code', target: isChoir ? 'choir' : 'playlist', code };
  }

  return null;
}

/**
 * ¿Sirve este QR para el flujo que el usuario tiene abierto?
 *
 * Un QR de coro escaneado desde "importar playlist" (o al revés) no es un
 * error de lectura: es que han enseñado el papel equivocado. Devolvemos el
 * aviso ya redactado para poder enseñarlo sin cerrar la cámara.
 */
export function describeMismatch(
  result: QrScanResult,
  expected: QrTarget,
): string | null {
  if (result.kind === 'offline') {
    return expected === 'playlist'
      ? null
      : 'Ese QR es un repertorio, no un directo';
  }
  if (result.kind === 'choir') {
    if (result.target === expected) return null;
    return result.target === 'choir'
      ? 'Ese QR es de un directo, no de un repertorio'
      : 'Ese QR trae el último repertorio de un coro, no un directo';
  }
  if (result.target === null || result.target === expected) return null;
  return result.target === 'choir'
    ? 'Ese QR es de un directo, no de un repertorio'
    : 'Ese QR es de un repertorio, no de un directo';
}
