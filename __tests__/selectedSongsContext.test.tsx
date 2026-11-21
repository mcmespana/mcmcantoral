/**
 * Tests de `contexts/SelectedSongsContext.tsx` — la playlist en curso.
 *
 * En MCM Cantoral la «selección» es el REPERTORIO ACTIVO
 * (`services/repertorios`): la API de siempre lee y escribe ese repertorio.
 *
 * Lo que se blinda aquí:
 *  - `normalizeOrder`: sin duplicados y con `order` consecutivo desde 0. Los
 *    duplicados se colaban al importar playlists e inflaban el contador.
 *  - La migración, la primera vez, de la selección de MCM App
 *    (`@mcm_playlist_v2`) a un repertorio.
 *  - Que lo que se edita queda guardado en el disco del repertorio.
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  SelectedSongsProvider,
  useSelectedSongs,
  type SelectedSong,
} from '@/contexts/SelectedSongsContext';
import { repertoriosStore } from '@/services/repertorios';
import { memoryFiles } from '@/services/catalog/filesTypes';

jest.mock('@/utils/analytics', () => ({ trackEvent: jest.fn() }));

const STORAGE_KEY = '@mcm_playlist_v2';

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SelectedSongsProvider>{children}</SelectedSongsProvider>
);

async function mountHydrated() {
  const hook = await renderHook(() => useSelectedSongs(), { wrapper });
  await waitFor(() => expect(hook.result.current.isHydrated).toBe(true));
  return hook;
}

function song(filename: string, order: number, extra?: Partial<SelectedSong>) {
  return { filename, transpose: 0, order, addedAt: 1000 + order, ...extra };
}

let disk: ReturnType<typeof memoryFiles>;
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  disk = memoryFiles();
  repertoriosStore.__reset(disk);
});

describe('hidratación', () => {
  it('arranca vacía si no hay nada guardado', async () => {
    const { result } = await mountHydrated();
    expect(result.current.selectedSongs).toEqual([]);
    expect(result.current.selectedFilenames).toEqual([]);
  });

  it('recupera la playlist guardada respetando el orden', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        songs: [song('b.txt', 1), song('a.txt', 0)],
      }),
    );
    const { result } = await mountHydrated();
    expect(result.current.selectedFilenames).toEqual(['a.txt', 'b.txt']);
  });

  it('elimina duplicados y renumera al hidratar', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        version: 2,
        songs: [song('a.txt', 5), song('a.txt', 7), song('b.txt', 9)],
      }),
    );
    const { result } = await mountHydrated();
    expect(result.current.selectedFilenames).toEqual(['a.txt', 'b.txt']);
    expect(result.current.selectedSongs.map((s) => s.order)).toEqual([0, 1]);
  });

  it('ignora un payload con versión desconocida', async () => {
    await AsyncStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, songs: [song('a.txt', 0)] }),
    );
    const { result } = await mountHydrated();
    expect(result.current.selectedSongs).toEqual([]);
  });

  it('no revienta con JSON corrupto', async () => {
    await AsyncStorage.setItem(STORAGE_KEY, '{esto no es json');
    const { result } = await mountHydrated();
    expect(result.current.selectedSongs).toEqual([]);
  });
});

describe('añadir y quitar', () => {
  it('addSong añade con transpose 0 y orden al final', async () => {
    const { result } = await mountHydrated();
    await act(async () => result.current.addSong('a.txt'));
    await act(async () =>
      result.current.addSong('b.txt', { categoryHint: 'entrada' }),
    );
    expect(result.current.selectedFilenames).toEqual(['a.txt', 'b.txt']);
    expect(result.current.getSelectedSong('a.txt')?.transpose).toBe(0);
    expect(result.current.getSelectedSong('b.txt')?.categoryHint).toBe(
      'entrada',
    );
    expect(result.current.getSelectedSong('b.txt')?.order).toBe(1);
  });

  it('addSong es idempotente: no duplica', async () => {
    const { result } = await mountHydrated();
    await act(async () => result.current.addSong('a.txt'));
    await act(async () => result.current.addSong('a.txt', { transpose: 3 }));
    expect(result.current.selectedSongs).toHaveLength(1);
    expect(result.current.getSelectedSong('a.txt')?.transpose).toBe(0);
  });

  it('registra el evento "creada" solo con la primera canción', async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { trackEvent } = require('@/utils/analytics');
    const { result } = await mountHydrated();
    await act(async () => result.current.addSong('a.txt'));
    await act(async () => result.current.addSong('b.txt'));
    expect(trackEvent).toHaveBeenCalledTimes(1);
    expect(trackEvent).toHaveBeenCalledWith('playlist_usada', {
      accion: 'creada',
      tamano: '1-5',
    });
  });

  it('removeSong renumera el resto', async () => {
    const { result } = await mountHydrated();
    await act(async () => result.current.addSong('a.txt'));
    await act(async () => result.current.addSong('b.txt'));
    await act(async () => result.current.addSong('c.txt'));
    await act(async () => result.current.removeSong('b.txt'));
    expect(result.current.selectedFilenames).toEqual(['a.txt', 'c.txt']);
    expect(result.current.selectedSongs.map((s) => s.order)).toEqual([0, 1]);
  });

  it('removeSong de algo que no está no cambia nada', async () => {
    const { result } = await mountHydrated();
    await act(async () => result.current.addSong('a.txt'));
    await act(async () => result.current.removeSong('zzz.txt'));
    expect(result.current.selectedFilenames).toEqual(['a.txt']);
  });

  it('clearSelection vacía la playlist', async () => {
    const { result } = await mountHydrated();
    await act(async () => result.current.addSong('a.txt'));
    await act(async () => result.current.clearSelection());
    expect(result.current.selectedSongs).toEqual([]);
    expect(result.current.isSongSelected('a.txt')).toBe(false);
  });
});

describe('transpose y cejilla', () => {
  it('setTranspose guarda el valor tal cual dentro de rango', async () => {
    const { result } = await mountHydrated();
    await act(async () => result.current.addSong('a.txt'));
    await act(async () => result.current.setTranspose('a.txt', -3));
    expect(result.current.getSelectedSong('a.txt')?.transpose).toBe(-3);
  });

  it('setTranspose reduce las octavas completas (±12 no aporta nada)', async () => {
    const { result } = await mountHydrated();
    await act(async () => result.current.addSong('a.txt'));
    await act(async () => result.current.setTranspose('a.txt', 14));
    expect(result.current.getSelectedSong('a.txt')?.transpose).toBe(2);
    await act(async () => result.current.setTranspose('a.txt', -13));
    expect(result.current.getSelectedSong('a.txt')?.transpose).toBe(-1);
  });

  it('setCapoOverride pone y quita la cejilla alternativa', async () => {
    const { result } = await mountHydrated();
    await act(async () => result.current.addSong('a.txt'));
    await act(async () => result.current.setCapoOverride('a.txt', 3));
    expect(result.current.getSelectedSong('a.txt')?.capoOverride).toBe(3);
    await act(async () => result.current.setCapoOverride('a.txt', null));
    expect(result.current.getSelectedSong('a.txt')?.capoOverride).toBeNull();
  });
});

describe('reordenar y reemplazar', () => {
  async function conTres() {
    const hook = await mountHydrated();
    await act(async () => hook.result.current.addSong('a.txt'));
    await act(async () => hook.result.current.addSong('b.txt'));
    await act(async () => hook.result.current.addSong('c.txt'));
    return hook;
  }

  it('moveSong lleva una canción al principio', async () => {
    const { result } = await conTres();
    await act(async () => result.current.moveSong('c.txt', 0));
    expect(result.current.selectedFilenames).toEqual([
      'c.txt',
      'a.txt',
      'b.txt',
    ]);
  });

  it('moveSong recorta índices fuera de rango', async () => {
    const { result } = await conTres();
    await act(async () => result.current.moveSong('a.txt', 99));
    expect(result.current.selectedFilenames).toEqual([
      'b.txt',
      'c.txt',
      'a.txt',
    ]);
    await act(async () => result.current.moveSong('a.txt', -5));
    expect(result.current.selectedFilenames[0]).toBe('a.txt');
  });

  it('moveSong a su propia posición no altera nada', async () => {
    const { result } = await conTres();
    const antes = result.current.selectedSongs;
    await act(async () => result.current.moveSong('b.txt', 1));
    expect(result.current.selectedSongs).toBe(antes);
  });

  it('moveSong de una canción ausente no altera nada', async () => {
    const { result } = await conTres();
    const antes = result.current.selectedSongs;
    await act(async () => result.current.moveSong('zzz.txt', 0));
    expect(result.current.selectedSongs).toBe(antes);
  });

  it('replaceAll normaliza (dedupe + orden) la playlist importada', async () => {
    const { result } = await mountHydrated();
    await act(async () =>
      result.current.replaceAll([
        song('x.txt', 4),
        song('y.txt', 2),
        song('x.txt', 1),
      ]),
    );
    expect(result.current.selectedFilenames).toEqual(['x.txt', 'y.txt']);
    expect(result.current.selectedSongs.map((s) => s.order)).toEqual([0, 1]);
  });
});

describe('persistencia', () => {
  it('lo editado queda en el fichero del repertorio activo', async () => {
    const { result } = await mountHydrated();
    await act(async () => result.current.addSong('a.txt'));
    await repertoriosStore.flush();
    const id = result.current.activeRepertorio!.id;
    const saved = JSON.parse(disk.files.get(`${id}.json`)!);
    expect(saved.items.map((i: { filename: string }) => i.filename)).toEqual([
      'a.txt',
    ]);
    const index = JSON.parse(disk.files.get('indice.json')!);
    expect(index.activeId).toBe(id);
  });
});

describe('useSelectedSongs fuera del provider', () => {
  it('lanza un error explícito', async () => {
    // El error de React por el throw ensucia la salida; lo silenciamos.
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await expect(renderHook(() => useSelectedSongs())).rejects.toThrow(
      /must be used within a SelectedSongsProvider/,
    );
    spy.mockRestore();
  });
});
