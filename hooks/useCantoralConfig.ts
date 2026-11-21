/**
 * La configuración remota del cantoral (`songs/cantoralConfig`), que viaja en
 * el catálogo offline como un nodo más (semilla, fichero, comparación
 * numérica: `02-datos-offline.md` §7). Sin datos devuelve los valores por
 * defecto: modo normal, sin mantenimiento ni versión mínima.
 */
export { useCatalogConfig as useCantoralConfig } from '@/hooks/useCatalog';
