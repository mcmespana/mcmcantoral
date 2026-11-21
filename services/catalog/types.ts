/**
 * Tipos del catálogo offline (`docs/planes/fork-cantoral/02-datos-offline.md`
 * §3). El catálogo son los cuatro nodos de `songs/` que lee la app, cada uno
 * con su `updatedAt` propio, guardados JUNTOS en un fichero.
 */
import type { SongsData } from '@/utils/filterSongsData';

/** Nodos de `songs/` que viven en el catálogo local. */
export const CATALOG_NODES = ['songs', 'tags', 'packs', 'cantoralConfig'] as const;
export type CatalogNodeName = (typeof CATALOG_NODES)[number];

/** Ruta de Firebase de cada nodo (`{ updatedAt, data }`). */
export const NODE_PATHS: Record<CatalogNodeName, string> = {
  songs: 'songs',
  tags: 'songs/tags',
  packs: 'songs/packs',
  cantoralConfig: 'songs/cantoralConfig',
};

export interface CatalogNode<T = unknown> {
  /** Milisegundos (normalizado de s/ms/ISO, `utils/updatedAt.ts`). 0 = sin fecha. */
  updatedAt: number;
  data: T;
}

export interface Catalog {
  /** Versión del formato del fichero. */
  v: 1;
  songs?: CatalogNode<SongsData>;
  tags?: CatalogNode;
  packs?: CatalogNode;
  cantoralConfig?: CatalogNode;
}

/** `songs/meta`, opcional (lo publica el generador del cantoral, `02` §3.4). */
export interface CatalogRemoteMeta {
  updatedAt?: unknown;
  /** Número de canciones publicadas. */
  count?: number;
  bytes?: number;
  sha256?: string;
  /**
   * Cómo está calculado `sha256`. Solo se comprueba si dice
   * `'sha256-canonical-v1'`: JSON con claves ordenadas y sin espacios
   * (`canonicalJson`). Con otro formato el hash no es comparable byte a byte.
   */
  hashAlgo?: string;
}

/** Lo que se guarda junto al catálogo (`catalogo/actual.meta.json`). */
export interface CatalogMeta {
  songsUpdatedAt: number;
  count: number;
  savedAt: number;
  /** De dónde salió lo que hay: la semilla, la nube o un maestro por wifi. */
  source: 'seed' | 'cloud' | 'local';
}

/** Resultado de comparar dos catálogos (aviso «3 canciones nuevas»). */
export interface CatalogDiff {
  added: { category: string; filename: string; title: string }[];
  changed: { category: string; filename: string; title: string }[];
  removed: number;
}
