/**
 * El pedal en el Atril (`04-directo.md` §8): «siguiente» pasa página y, al
 * llegar al final, pasa de canción; «anterior» igual hacia atrás; la
 * pulsación larga cambia de canción directamente. Si quien lo pisa dirige,
 * cambiar de canción ya publica en el directo (lo hace la pantalla).
 *
 * En la web no: allí las flechas ya son atajos de la pantalla y la hoja pasa
 * página con su propio `keydown`.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { usePedal } from '@/hooks/usePedal';
import type { PedalAction } from '@/utils/pedalKeys';

export function useSongPedal({
  enabled,
  onNextSong,
  onPrevSong,
}: {
  enabled: boolean;
  onNextSong: () => void;
  onPrevSong: () => void;
}) {
  const [pageRequest, setPageRequest] = useState<{
    dir: 1 | -1;
    n: number;
  } | null>(null);
  const nRef = useRef(0);

  const onAction = (a: PedalAction) => {
    if (a === 'nextSong') onNextSong();
    else if (a === 'prevSong') onPrevSong();
    else {
      nRef.current += 1;
      setPageRequest({ dir: a === 'next' ? 1 : -1, n: nRef.current });
    }
  };

  const { relisten } = usePedal({
    enabled: enabled && Platform.OS !== 'web',
    onAction,
  });

  // Ya en el borde de la hoja: canción siguiente / anterior.
  const nextRef = useRef(onNextSong);
  const prevRef = useRef(onPrevSong);
  useEffect(() => {
    nextRef.current = onNextSong;
    prevRef.current = onPrevSong;
  });
  const onPageEdge = useCallback((dir: 1 | -1) => {
    if (dir > 0) nextRef.current();
    else prevRef.current();
  }, []);

  return { pageRequest, onPageEdge, relisten };
}
