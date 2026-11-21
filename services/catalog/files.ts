/**
 * Disco del catálogo en iOS y Android: ficheros en `documentDirectory/catalogo/`
 * (`02-datos-offline.md` §3.2). Nada de AsyncStorage: una fila de más de ~2 MB
 * no se puede leer en Android, y con Navidad el cantoral crece.
 */
import * as FileSystem from 'expo-file-system/legacy';
import type { CatalogFiles } from './filesTypes';

/** Un disco en `documentDirectory/<dir>/`. */
export function makeFiles(dir: string): CatalogFiles {
  const DIR = `${FileSystem.documentDirectory ?? ''}${dir}/`;
  let ensured: Promise<void> | null = null;
  const ensureDir = (): Promise<void> => {
    if (!ensured) {
      ensured = FileSystem.makeDirectoryAsync(DIR, {
        intermediates: true,
      }).catch(() => {
        // Ya existe: no pasa nada.
      });
    }
    return ensured;
  };
  return {
    async read(name) {
      await ensureDir();
      const info = await FileSystem.getInfoAsync(DIR + name);
      if (!info.exists) return null;
      return FileSystem.readAsStringAsync(DIR + name);
    },
    async write(name, text) {
      await ensureDir();
      await FileSystem.writeAsStringAsync(DIR + name, text);
    },
    async move(from, to) {
      await ensureDir();
      // En iOS mover encima de un fichero que existe falla: se quita antes.
      await FileSystem.deleteAsync(DIR + to, { idempotent: true });
      await FileSystem.moveAsync({ from: DIR + from, to: DIR + to });
    },
    async remove(name) {
      await ensureDir();
      await FileSystem.deleteAsync(DIR + name, { idempotent: true });
    },
  };
}

export const catalogFiles: CatalogFiles = makeFiles('catalogo');
