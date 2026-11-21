/**
 * Tests de los dos contextos de ajustes persistidos en AsyncStorage:
 * `SettingsContext` (cantoral) y `AppSettingsContext` (fuente, tema y el
 * nombre con el que te ven en el coro).
 *
 * Los dos comparten el mismo patrón —cargar → fusionar con defaults →
 * guardar en cada cambio— y el mismo par de fallos posibles: escribir antes
 * de haber cargado (que borra los ajustes del usuario al arrancar) y no
 * fusionar con los defaults (que deja `undefined` en claves nuevas cuando el
 * JSON guardado es de una versión anterior de la app).
 */
import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Appearance, Platform } from 'react-native';
import {
  SettingsProvider,
  useSettings,
  DEFAULT_FONT_SIZE_EM,
  DEFAULT_FONT_FAMILY,
  migrateSongSettings,
} from '@/contexts/SettingsContext';
import {
  AppSettingsProvider,
  useAppSettings,
} from '@/contexts/AppSettingsContext';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

describe('SettingsContext (ajustes del cantoral)', () => {
  const KEY = '@mcm_song_settings';
  const ADMIN_KEY = '@mcm_is_admin';

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <SettingsProvider>{children}</SettingsProvider>
  );

  async function mount() {
    const hook = await renderHook(() => useSettings(), { wrapper });
    await waitFor(() =>
      expect(hook.result.current.isLoadingSettings).toBe(false),
    );
    return hook;
  }

  it('arranca con los defaults', async () => {
    const { result } = await mount();
    expect(result.current.settings).toEqual({
      chordsVisible: true,
      fontSize: DEFAULT_FONT_SIZE_EM,
      fontFamily: DEFAULT_FONT_FAMILY,
      notation: 'ES',
      compactView: false,
      verseNumbers: true,
      chorusStyle: 'negrita',
      chorusLabel: true,
      airy: false,
      pagedFullscreen: false,
      songMap: false,
      cantoralOnboarding: 0,
      featuredTags: [],
      hideHiddenTagSongs: false,
      fontVersion: 2,
    });
    expect(result.current.isAdmin).toBe(false);
  });

  it('fusiona lo guardado con los defaults (claves nuevas no quedan undefined)', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ notation: 'EN' }));
    const { result } = await mount();
    expect(result.current.settings.notation).toBe('EN');
    expect(result.current.settings.chordsVisible).toBe(true);
    expect(result.current.settings.fontSize).toBe(DEFAULT_FONT_SIZE_EM);
  });

  it('un fontSize de 0 guardado cae al default (0 no es un tamaño válido)', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ fontSize: 0 }));
    const { result } = await mount();
    expect(result.current.settings.fontSize).toBe(DEFAULT_FONT_SIZE_EM);
  });

  it('vuelve a los defaults si el JSON está corrupto', async () => {
    await AsyncStorage.setItem(KEY, 'no-json');
    const { result } = await mount();
    expect(result.current.settings.notation).toBe('ES');
  });

  it('setSettings aplica cambios parciales y persiste', async () => {
    const { result } = await mount();
    await act(async () => result.current.setSettings({ chordsVisible: false }));
    expect(result.current.settings.chordsVisible).toBe(false);
    expect(result.current.settings.notation).toBe('ES');
    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(KEY);
      expect(JSON.parse(raw!).chordsVisible).toBe(false);
    });
  });

  it('recupera el modo admin persistido', async () => {
    await AsyncStorage.setItem(ADMIN_KEY, 'true');
    const { result } = await mount();
    expect(result.current.isAdmin).toBe(true);
  });

  it('setIsAdmin persiste como cadena "true"/"false"', async () => {
    const { result } = await mount();
    await act(async () => result.current.setIsAdmin(true));
    expect(result.current.isAdmin).toBe(true);
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(ADMIN_KEY)).toBe('true'),
    );
    await act(async () => result.current.setIsAdmin(false));
    await waitFor(async () =>
      expect(await AsyncStorage.getItem(ADMIN_KEY)).toBe('false'),
    );
  });

  it('la monoespaciada guardada por defecto pasa a la del sistema, una vez', async () => {
    const mono = "'Roboto Mono', 'Courier New', monospace";
    await AsyncStorage.setItem(KEY, JSON.stringify({ fontFamily: mono }));
    const { result } = await mount();
    expect(result.current.settings.fontFamily).toBe(DEFAULT_FONT_FAMILY);
    // Quien la vuelve a elegir después de migrar, se la queda.
    expect(
      migrateSongSettings({ fontFamily: mono, fontVersion: 2 }).fontFamily,
    ).toBe(mono);
  });

  it('la serif elegida a mano no se toca al migrar', () => {
    const serif = "'Palatino Linotype', 'Book Antiqua', Palatino, serif";
    expect(migrateSongSettings({ fontFamily: serif }).fontFamily).toBe(serif);
  });

  it('las claves nuevas (vista compacta, números) llegan con su default', () => {
    const s = migrateSongSettings({ notation: 'EN' });
    expect(s.compactView).toBe(false);
    expect(s.verseNumbers).toBe(true);
  });

  it('fuera del provider devuelve defaults en vez de reventar (SSG)', async () => {
    const { result } = await renderHook(() => useSettings());
    expect(result.current.isLoadingSettings).toBe(true);
    expect(result.current.settings.notation).toBe('ES');
    expect(() => result.current.setSettings({ notation: 'EN' })).not.toThrow();
  });
});

describe('AppSettingsContext (fuente y tema)', () => {
  const KEY = '@app_settings';

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <AppSettingsProvider>{children}</AppSettingsProvider>
  );

  async function mount() {
    const hook = await renderHook(() => useAppSettings(), { wrapper });
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    return hook;
  }

  it('arranca con escala 1, tema del sistema y sin nombre', async () => {
    const { result } = await mount();
    expect(result.current.settings).toEqual({
      fontScale: 1,
      theme: 'system',
      choirName: '',
    });
  });

  it('recupera lo guardado fusionando con los defaults', async () => {
    await AsyncStorage.setItem(KEY, JSON.stringify({ fontScale: 1.4 }));
    const { result } = await mount();
    expect(result.current.settings.fontScale).toBe(1.4);
    expect(result.current.settings.theme).toBe('system');
  });

  it('guarda el nombre del coro', async () => {
    const { result } = await mount();
    await act(async () => result.current.setSettings({ choirName: 'Lucía' }));
    await waitFor(async () => {
      const raw = await AsyncStorage.getItem(KEY);
      expect(JSON.parse(raw!).choirName).toBe('Lucía');
    });
  });

  it('alinea la apariencia nativa con el tema elegido', async () => {
    const spy = jest
      .spyOn(Appearance, 'setColorScheme')
      .mockImplementation(() => {});
    const { result } = await mount();
    // Al terminar la carga ya se aplica el tema guardado ('system').
    expect(spy).toHaveBeenLastCalledWith('unspecified');
    await act(async () => result.current.setSettings({ theme: 'dark' }));
    expect(spy).toHaveBeenLastCalledWith('dark');
    spy.mockRestore();
  });

  it('en web no toca la apariencia nativa', async () => {
    const spy = jest
      .spyOn(Appearance, 'setColorScheme')
      .mockImplementation(() => {});
    const real = Platform.OS;
    Object.defineProperty(Platform, 'OS', {
      get: () => 'web',
      configurable: true,
    });
    await mount();
    expect(spy).not.toHaveBeenCalled();
    Object.defineProperty(Platform, 'OS', {
      get: () => real,
      configurable: true,
    });
    spy.mockRestore();
  });

  it('fuera del provider devuelve defaults (SSG)', async () => {
    const { result } = await renderHook(() => useAppSettings());
    expect(result.current.loading).toBe(true);
    expect(result.current.settings.fontScale).toBe(1);
  });
});
