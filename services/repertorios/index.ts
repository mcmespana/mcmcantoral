/**
 * Los repertorios del dispositivo: un único `RepertoriosStore` con su disco y
 * la migración desde la selección de MCM App. Las pantallas usan
 * `hooks/useRepertorios.ts` y, para el activo, `SelectedSongsContext`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { makeFiles } from '@/services/catalog/files';
import { fromShared } from './model';
import { RepertoriosStore } from './store';

export * from './model';
export { RepertoriosStore } from './store';
export type { RepertoriosState } from './store';

/**
 * La selección que tenía MCM App (`@mcm_playlist_v2`) y su enlace con la nube
 * (`@mcm_playlist_link_v1`), si los hay. Solo en un dispositivo que venga de
 * una versión con la selección única (o que comparta almacén en web).
 */
async function legacySelection() {
  const raw = await AsyncStorage.getItem('@mcm_playlist_v2');
  if (!raw) return null;
  const parsed = JSON.parse(raw);
  if (!parsed || parsed.version !== 2) return null;
  const now = Date.now();
  const rep = fromShared(parsed, {
    id: `m${now.toString(36)}`,
    now,
    source: undefined,
    name: 'Mi repertorio',
  });
  if (!rep) return null;
  try {
    const linkRaw = await AsyncStorage.getItem('@mcm_playlist_link_v1');
    const link = linkRaw ? JSON.parse(linkRaw) : null;
    if (link?.code) rep.link = link;
  } catch {
    // Sin enlace: no pasa nada.
  }
  return rep;
}

export const repertoriosStore = new RepertoriosStore({
  files: makeFiles('repertorios'),
  legacy: legacySelection,
});
