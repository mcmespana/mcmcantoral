/**
 * `usePedal`: teclas (expo-key-event) y botones de volumen
 * (react-native-volume-manager) con el interruptor remoto D-17.
 * `useFocusEffect` va mockeado como un efecto normal.
 */
import { AppState } from 'react-native';
import { act, renderHook } from '@testing-library/react-native';
import { usePedal } from '@/hooks/usePedal';
import {
  resetPedalSettingsForTests,
  setPedalSettings,
} from '@/hooks/usePedalSettings';

type KeyListener = (e: { key: string; eventType: 'press' | 'release' }) => void;
let mockListener: KeyListener | null = null;
const mockStart = jest.fn();
const mockStop = jest.fn();
let mockConfig = { volumeButtons: { ios: true, android: true } };
let mockVolumeCb: ((r: { volume: number }) => void) | null = null;
const mockRemove = jest.fn();
const mockSetVolume = jest.fn(() => Promise.resolve());
const mockShowUI = jest.fn(() => Promise.resolve());

jest.mock('expo-key-event', () => ({
  useKeyEventListener: (l: KeyListener) => {
    mockListener = l;
    return { startListening: mockStart, stopListening: mockStop };
  },
}));
jest.mock('react-native-volume-manager', () => ({
  getVolume: jest.fn(() => Promise.resolve({ volume: 0.9 })),
  setVolume: (...a: unknown[]) =>
    (mockSetVolume as (...x: unknown[]) => unknown)(...a),
  showNativeVolumeUI: (...a: unknown[]) =>
    (mockShowUI as (...x: unknown[]) => unknown)(...a),
  addVolumeListener: (cb: (r: { volume: number }) => void) => {
    mockVolumeCb = cb;
    return { remove: mockRemove };
  },
}));
jest.mock('@/hooks/useCantoralConfig', () => ({
  useCantoralConfig: () => mockConfig,
}));
jest.mock('expo-router/react-navigation', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    useFocusEffect: (cb: () => void | (() => void)) => useEffect(cb, [cb]),
  };
});

const flush = () =>
  act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
const press = (key: string) => {
  mockListener?.({ key, eventType: 'press' });
  mockListener?.({ key, eventType: 'release' });
};

beforeEach(() => {
  jest.clearAllMocks();
  mockListener = null;
  mockVolumeCb = null;
  mockConfig = { volumeButtons: { ios: true, android: true } };
  resetPedalSettingsForTests();
});

describe('teclas', () => {
  it('escucha al activarse y reparte acciones', async () => {
    const onAction = jest.fn();
    await renderHook(() => usePedal({ enabled: true, onAction }));
    expect(mockStart).toHaveBeenCalled();
    press('ArrowRight');
    press('PageUp');
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(['next', 'prev']);
  });

  it('desactivado no escucha, y al desactivar deja de escuchar', async () => {
    const onAction = jest.fn();
    const { rerender } = await renderHook(
      (p: { on: boolean }) => usePedal({ enabled: p.on, onAction }),
      { initialProps: { on: false } },
    );
    expect(mockStart).not.toHaveBeenCalled();
    await rerender({ on: true });
    expect(mockStart).toHaveBeenCalled();
    await rerender({ on: false });
    expect(mockStop).toHaveBeenCalled();
  });

  it('relisten() vuelve a escuchar (stop + start)', async () => {
    const { result } = await renderHook(() =>
      usePedal({ enabled: true, onAction: jest.fn() }),
    );
    mockStart.mockClear();
    mockStop.mockClear();
    await act(async () => {
      result.current.relisten();
    });
    expect(mockStop).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it('relisten() no hace nada si está desactivado', async () => {
    const { result } = await renderHook(() =>
      usePedal({ enabled: false, onAction: jest.fn() }),
    );
    await act(async () => {
      result.current.relisten();
    });
    expect(mockStart).not.toHaveBeenCalled();
  });

  it('re-escucha al volver la app a primer plano', async () => {
    let handler: ((s: string) => void) | null = null;
    const spy = jest.spyOn(AppState, 'addEventListener').mockImplementation(((
      _t: string,
      h: (s: string) => void,
    ) => {
      handler = h;
      return { remove: jest.fn() };
    }) as never);
    await renderHook(() => usePedal({ enabled: true, onAction: jest.fn() }));
    mockStart.mockClear();
    await act(async () => {
      handler?.('active');
    });
    expect(mockStart).toHaveBeenCalledTimes(1);
    spy.mockRestore();
  });
});

describe('botones de volumen', () => {
  it('apagados de serie: no se engancha', async () => {
    await renderHook(() => usePedal({ enabled: true, onAction: jest.fn() }));
    await flush();
    expect(mockVolumeCb).toBeNull();
    expect(mockShowUI).not.toHaveBeenCalled();
  });

  it('con el ajuste local: esconde el indicador, re-centra y traduce subir/bajar', async () => {
    setPedalSettings({ volumeButtons: true });
    const onAction = jest.fn();
    const { result } = await renderHook(() =>
      usePedal({ enabled: true, onAction }),
    );
    await flush();
    expect(result.current.volumeActive).toBe(true);
    expect(mockShowUI).toHaveBeenCalledWith({ enabled: false });
    expect(mockSetVolume).toHaveBeenCalledWith(0.5, expect.anything());

    await act(async () => {
      mockVolumeCb?.({ volume: 0.5 }); // eco
    });
    await act(async () => {
      mockVolumeCb?.({ volume: 0.5625 });
    });
    await act(async () => {
      mockVolumeCb?.({ volume: 0.5 }); // eco
    });
    await act(async () => {
      mockVolumeCb?.({ volume: 0.4375 });
    });
    expect(onAction.mock.calls.map((c) => c[0])).toEqual(['next', 'prev']);
  });

  it('el interruptor remoto lo apaga aunque el ajuste local esté encendido', async () => {
    mockConfig = { volumeButtons: { ios: false, android: false } };
    const { result } = await renderHook(() =>
      usePedal({ enabled: true, onAction: jest.fn(), volumeButtons: true }),
    );
    await flush();
    expect(result.current.volumeActive).toBe(false);
    expect(mockVolumeCb).toBeNull();
  });

  it('al desactivar restaura el indicador y el volumen que había', async () => {
    const { unmount } = await renderHook(() =>
      usePedal({ enabled: true, onAction: jest.fn(), volumeButtons: true }),
    );
    await flush();
    mockShowUI.mockClear();
    mockSetVolume.mockClear();
    await unmount();
    expect(mockRemove).toHaveBeenCalled();
    expect(mockShowUI).toHaveBeenCalledWith({ enabled: true });
    expect(mockSetVolume).toHaveBeenCalledWith(0.9, expect.anything());
  });
});
