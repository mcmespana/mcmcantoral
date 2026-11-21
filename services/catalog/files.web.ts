/**
 * Disco del catálogo en la web: el almacén del navegador (AsyncStorage →
 * localStorage). El catálogo cabe de sobra (~0,5 MB) y la web no tiene ficheros.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { CatalogFiles } from './filesTypes';

const PREFIX = '@catalogo/';

export const catalogFiles: CatalogFiles = {
  read: (name) => AsyncStorage.getItem(PREFIX + name),
  write: (name, text) => AsyncStorage.setItem(PREFIX + name, text),
  async move(from, to) {
    const text = await AsyncStorage.getItem(PREFIX + from);
    if (text === null) return;
    await AsyncStorage.setItem(PREFIX + to, text);
    await AsyncStorage.removeItem(PREFIX + from);
  },
  remove: (name) => AsyncStorage.removeItem(PREFIX + name),
};
