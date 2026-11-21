/**
 * Lógica pura de la paleta de comandos de la web (⌘K / Ctrl+K): destinos
 * fijos, filtrado sin tildes y movimiento con las flechas. El componente
 * (`components/CommandPalette.tsx`) solo pinta y navega.
 */
import type { ComponentProps } from 'react';
import type { MaterialIcons } from '@/components/ui/icons';
import { foldForSearch } from '@/utils/songTags';

export type PaletteIconName = ComponentProps<typeof MaterialIcons>['name'];

export interface PaletteCommand {
  id: string;
  title: string;
  subtitle?: string;
  icon: PaletteIconName;
  /** Ruta de expo-router (`router.push`). Solo pantallas de primer nivel. */
  path: string;
  /** Sinónimos y términos relacionados que también lo encuentran. */
  keywords?: string[];
}

export const PALETTE_COMMANDS: PaletteCommand[] = [
  {
    id: 'cancionero',
    title: 'Cantoral',
    subtitle: 'Categorías y canciones',
    icon: 'music-note',
    path: '/cancionero',
    keywords: [
      'canciones',
      'songs',
      'acordes',
      'cantar',
      'cancionero',
      'inicio',
    ],
  },
  {
    id: 'seleccion',
    title: 'Tu repertorio',
    subtitle: 'Las canciones que has elegido',
    icon: 'queue-music',
    path: '/cancionero/seleccion',
    keywords: ['repertorio', 'playlist', 'selección', 'lista', 'misa'],
  },
  {
    id: 'domingo',
    title: 'Cantos para el domingo',
    subtitle: 'Propuesta según las lecturas',
    icon: 'event',
    path: '/cancionero/domingo',
    keywords: ['domingo', 'misa', 'lecturas', 'liturgia'],
  },
  {
    id: 'afinador',
    title: 'Afinador y metrónomo',
    icon: 'tune',
    path: '/cancionero/afinador',
    keywords: ['afinar', 'guitarra', 'metrónomo', 'tempo'],
  },
];

/** ¿Casa el comando con lo tecleado? Sin tildes: «galeria» encuentra «Galería». */
export function matchCommand(cmd: PaletteCommand, query: string): boolean {
  const q = foldForSearch(query).trim();
  if (!q) return true;
  return [cmd.title, cmd.subtitle ?? '', ...(cmd.keywords ?? [])].some((t) =>
    foldForSearch(t).includes(q),
  );
}

/**
 * Siguiente resultado resaltado al pulsar ↓ (`+1`) o ↑ (`-1`). Da la vuelta
 * en los extremos, como cualquier paleta; sin resultados se queda en 0.
 */
export function stepIndex(current: number, delta: 1 | -1, count: number) {
  if (count <= 0) return 0;
  return (((current + delta) % count) + count) % count;
}
