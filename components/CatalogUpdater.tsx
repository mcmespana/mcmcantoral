/**
 * Mantiene el catálogo offline al día sin que nadie haga nada
 * (`02-datos-offline.md` §3.3):
 *  - al arrancar lee lo guardado (o la semilla) y, tras el primer pintado,
 *    mira la nube;
 *  - al volver a primer plano vuelve a mirar, como mucho cada 15 min;
 *  - si llega algo nuevo, un aviso discreto: «Cantoral actualizado · 3
 *    canciones nuevas». También durante un directo (D-21): no se congela.
 *
 * No pinta nada.
 */
import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { catalogStore } from '@/services/catalog';
import { describeDiff } from '@/services/catalog/logic';
import { useToast } from '@/contexts/AppToastContext';
import { useCatalogState } from '@/hooks/useCatalog';

export default function CatalogUpdater() {
  const { toast } = useToast();
  const state = useCatalogState();
  const shownDiff = useRef<unknown>(null);

  useEffect(() => {
    void catalogStore.init();
    // Tras el primer pintado: la nube nunca retrasa ver el cantoral.
    const timer = setTimeout(() => void catalogStore.refresh(), 800);
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') void catalogStore.refresh();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);

  // Aviso discreto cuando se aplica un cantoral nuevo (no en el arranque).
  const diff = state.lastDiff;
  useEffect(() => {
    if (!diff || shownDiff.current === diff) return;
    shownDiff.current = diff;
    if (!diff.added.length && !diff.changed.length) return;
    toast.show({ label: describeDiff(diff) });
  }, [diff, toast]);

  return null;
}
