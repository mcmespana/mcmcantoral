import { useMemo } from 'react';
import { useCatalogSongs } from '@/hooks/useCatalog';

/**
 * Duración (`m:ss`) de una canción según el catálogo, por su categoría de casa
 * y su fichero. La lista con la que se abre una canción no la lleva.
 */
export function useSongDuration(
  category: string | undefined,
  filename: string | undefined,
): string | undefined {
  const { data } = useCatalogSongs({ raw: true });
  return useMemo(() => {
    if (!data || !filename) return undefined;
    const cats = category && data[category] ? [category] : Object.keys(data);
    for (const c of cats) {
      const song = data[c]?.songs?.find((s) => s?.filename === filename) as
        { duration?: unknown } | undefined;
      if (song) {
        return typeof song.duration === 'string' ? song.duration : undefined;
      }
    }
    return undefined;
  }, [data, category, filename]);
}
