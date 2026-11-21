/**
 * `usePlaylistLink`: el enlace del repertorio ACTIVO con su copia en la nube
 * (código + firma + si lo subiste tú). En MCM Cantoral cada repertorio guarda
 * el suyo; la primera vez, el enlace de MCM App (`@mcm_playlist_link_v1`) pasa
 * al repertorio migrado.
 */
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePlaylistLink } from '@/hooks/usePlaylistLink';
import { repertoriosStore } from '@/services/repertorios';
import { memoryFiles } from '@/services/catalog/filesTypes';

const LINK = {
  code: '1234',
  name: 'Domingo',
  signature: 'sig1',
  syncedAt: 1000,
  owned: true,
};

beforeEach(async () => {
  await AsyncStorage.clear();
  repertoriosStore.__reset(memoryFiles());
});

async function mount() {
  await repertoriosStore.init();
  const hook = await renderHook(() => usePlaylistLink());
  await waitFor(() => expect(hook.result.current.isHydrated).toBe(true));
  return hook;
}

it('arranca sin link', async () => {
  const { result } = await mount();
  expect(result.current.link).toBeNull();
});

it('migra el enlace de MCM App junto con su selección', async () => {
  await AsyncStorage.setItem(
    '@mcm_playlist_v2',
    JSON.stringify({ version: 2, songs: [{ filename: 'a.cho', order: 0 }] }),
  );
  await AsyncStorage.setItem('@mcm_playlist_link_v1', JSON.stringify(LINK));
  const { result } = await mount();
  expect(result.current.link).toEqual(LINK);
});

it('guarda el link en el repertorio activo y cada repertorio tiene el suyo', async () => {
  const { result } = await mount();
  await act(async () => result.current.setLink(LINK));
  expect(result.current.link).toEqual(LINK);
  const first = repertoriosStore.getState().activeId!;
  await act(async () => {
    repertoriosStore.create('Otro');
  });
  expect(result.current.link).toBeNull();
  await act(async () => repertoriosStore.setActive(first));
  expect(result.current.link).toEqual(LINK);
});

it('null quita el link', async () => {
  const { result } = await mount();
  await act(async () => result.current.setLink(LINK));
  await act(async () => result.current.setLink(null));
  expect(result.current.link).toBeNull();
});
