/**
 * Subida / descarga de playlists a Firebase Realtime Database bajo un código
 * corto de 4 dígitos. Sin permisos: cualquiera con el código puede leerla,
 * sobrescribirla o borrarla.
 *
 * Las playlists incluyen `expiresAt` con +6 meses sobre el momento de
 * creación; la purga real se hace por backend más adelante.
 */
import type { RepertorioItem } from '@/services/repertorios/model';
import { getDatabase, ref, get, set, remove, update } from 'firebase/database';
import { getFirebaseApp } from '@/utils/firebaseApp';
import { shareableApuntesOf } from '@/services/apuntes';
import { logger } from '@/utils/logger';
import type { SelectedSong } from '@/contexts/SelectedSongsContext';
import {
  CODE_LENGTH,
  generateRandomCode,
  isValidCode,
} from '@/utils/playlistCodes';

const ROOT = 'playlistShares';
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

export interface CloudPlaylist {
  /**
   * 2 = solo `songs` (MCM App). 3 = además `items` (MCM Cantoral: pausas,
   * notas, evento). Siempre se escribe `songs`, que es lo que lee MCM App.
   */
  v: 2 | 3;
  songs: SelectedSong[];
  /** Repertorio completo (MCM Cantoral). MCM App lo ignora. */
  items?: RepertorioItem[];
  event?: string;
  date?: string;
  /** Apuntes de Todos e instrumento de sus canciones (MCM Cantoral, `05` §6). */
  apuntes?: unknown[];
  name?: string;
  createdAt: number;
  updatedAt: number;
  expiresAt: number;
  /** Coro del que cuelga, si se subió desde un coro. */
  choirId?: string;
  /** Nombre del coro en el momento de subirla (para poder enseñarlo sin otra lectura). */
  choirName?: string;
  /** Nombre de quien la subió por última vez, si lo tenía puesto en su perfil. */
  by?: string;
  /**
   * Dispositivo que la subió. Sirve para que "la tuya" no te pida contraseña
   * al volver a subirla; para los demás la contraseña sigue haciendo falta.
   */
  ownerDeviceId?: string;
}

function getRef(code: string) {
  if (!isValidCode(code)) {
    throw new Error(`Código inválido (deben ser ${CODE_LENGTH} dígitos)`);
  }
  const db = getDatabase(getFirebaseApp());
  return ref(db, `${ROOT}/${code}`);
}

/** ¿Existe ya una playlist con ese código? */
export async function cloudPlaylistExists(code: string): Promise<boolean> {
  const snap = await get(getRef(code));
  return snap.exists();
}

/** Lee la playlist asociada a `code` o devuelve null si no existe. */
export async function fetchCloudPlaylist(
  code: string,
): Promise<CloudPlaylist | null> {
  const snap = await get(getRef(code));
  if (!snap.exists()) return null;
  const val = snap.val() as CloudPlaylist;
  // Limpieza "perezosa": si está caducada, la borramos y simulamos no existir.
  if (val.expiresAt && Date.now() > val.expiresAt) {
    try {
      await remove(getRef(code));
    } catch {
      // ignore
    }
    return null;
  }
  return val;
}

/**
 * Sube `songs` bajo `code`. Si `code` ya existe, sobrescribe.
 * Si quieres prevenir colisiones, llama antes a {@link cloudPlaylistExists}.
 */
export async function uploadCloudPlaylist(
  code: string,
  songs: SelectedSong[],
  opts?: {
    name?: string;
    createdAt?: number;
    choirId?: string;
    choirName?: string;
    by?: string;
    ownerDeviceId?: string;
    /** El repertorio entero (v3): pausas, notas, tono del día. */
    items?: RepertorioItem[];
    event?: string;
    date?: string;
    apuntes?: unknown[];
  },
): Promise<CloudPlaylist> {
  const now = Date.now();
  // Los apuntes de Todos y de instrumento viajan con el repertorio (`05` §6).
  const apuntes =
    opts?.apuntes ??
    (opts?.items
      ? await shareableApuntesOf(opts.items).catch((e) => {
          logger.warn('[apuntes] al subir', e);
          return [];
        })
      : undefined);
  const payload: CloudPlaylist = {
    v: opts?.items ? 3 : 2,
    songs,
    items: opts?.items,
    event: opts?.event,
    date: opts?.date,
    apuntes: apuntes?.length ? apuntes : undefined,
    name: opts?.name,
    createdAt: opts?.createdAt ?? now,
    updatedAt: now,
    expiresAt: now + SIX_MONTHS_MS,
    choirId: opts?.choirId,
    choirName: opts?.choirName,
    by: opts?.by,
    ownerDeviceId: opts?.ownerDeviceId,
  };
  const cleanPayload = JSON.parse(JSON.stringify(payload));
  await set(getRef(code), cleanPayload);
  return payload;
}

/**
 * Busca un código libre. Se usa al subir una playlist **a un coro**, donde el
 * código es un detalle secundario (se enseña pequeñito) y nadie quiere
 * elegirlo a mano ni chocar con el de otro.
 *
 * Con 10.000 códigos y unas pocas decenas en uso, el primer intento acierta
 * casi siempre; aun así probamos varias veces antes de rendirnos.
 */
export async function allocateFreeCode(attempts = 12): Promise<string> {
  for (let i = 0; i < attempts; i++) {
    const candidate = generateRandomCode();
    if (!(await cloudPlaylistExists(candidate))) return candidate;
  }
  throw new Error(
    'No se ha podido reservar un código libre, inténtalo otra vez',
  );
}

/** Borra la playlist asociada a `code`. */
export async function deleteCloudPlaylist(code: string): Promise<void> {
  await remove(getRef(code));
}

/**
 * Mueve la playlist de `oldCode` a `newCode`. Preserva createdAt.
 * Si `newCode` ya existe, lanza error (el caller decide qué hacer).
 */
export async function changeCloudPlaylistCode(
  oldCode: string,
  newCode: string,
): Promise<CloudPlaylist> {
  if (oldCode === newCode) {
    const cur = await fetchCloudPlaylist(oldCode);
    if (!cur) throw new Error('La playlist ya no existe');
    return cur;
  }
  if (await cloudPlaylistExists(newCode)) {
    throw new Error('El nuevo código ya está en uso');
  }
  const cur = await fetchCloudPlaylist(oldCode);
  if (!cur) throw new Error('La playlist original ya no existe');

  // Escritura atómica: sube al nuevo código y borra el viejo en la MISMA
  // operación (update multi-path), así un fallo a medias no puede dejar dos
  // copias vivas ni un estado intermedio.
  const now = Date.now();
  const moved: CloudPlaylist = {
    ...cur,
    v: 2,
    songs: cur.songs,
    name: cur.name,
    createdAt: cur.createdAt,
    updatedAt: now,
    expiresAt: now + SIX_MONTHS_MS,
  };
  const cleanMoved = JSON.parse(JSON.stringify(moved));
  const db = getDatabase(getFirebaseApp());
  await update(ref(db, ROOT), {
    [newCode]: cleanMoved,
    [oldCode]: null,
  });
  return moved;
}
