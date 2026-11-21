/** Lo mínimo que el catálogo necesita de un disco. Los tests usan uno en memoria. */
export interface CatalogFiles {
  /** El texto del fichero, o `null` si no existe. */
  read(name: string): Promise<string | null>;
  write(name: string, text: string): Promise<void>;
  /** Mueve `from` a `to`, sustituyendo lo que hubiera en `to`. */
  move(from: string, to: string): Promise<void>;
  remove(name: string): Promise<void>;
}

/** Disco en memoria, para tests (y para simular cortes a mitad). */
export function memoryFiles(initial: Record<string, string> = {}): CatalogFiles & {
  files: Map<string, string>;
} {
  const files = new Map(Object.entries(initial));
  return {
    files,
    read: async (name) => files.get(name) ?? null,
    write: async (name, text) => {
      files.set(name, text);
    },
    move: async (from, to) => {
      const text = files.get(from);
      if (text === undefined) return;
      files.set(to, text);
      files.delete(from);
    },
    remove: async (name) => {
      files.delete(name);
    },
  };
}
