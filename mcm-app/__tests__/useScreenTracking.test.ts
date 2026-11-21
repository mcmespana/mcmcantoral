/**
 * Tests de `useScreenTracking`: engancha la analítica UNA vez en el layout
 * raíz en vez de en cada pantalla. Lo importante:
 *
 *  - `app_abierta` + `initAnalytics` se disparan UNA sola vez por sesión.
 *  - `pantalla_vista` no se duplica si `usePathname` repite el mismo valor
 *    (cambio de params, remontaje).
 *  - No hay perfiles: nada de persona acompaña a los eventos.
 */
import { renderHook } from '@testing-library/react-native';
import { usePathname } from 'expo-router';
import { initAnalytics, trackEvent } from '@/utils/analytics';
import { useScreenTracking } from '@/hooks/useScreenTracking';

jest.mock('expo-router', () => ({
  usePathname: jest.fn(),
}));
jest.mock('@/utils/analytics', () => ({
  initAnalytics: jest.fn(),
  trackEvent: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  (usePathname as jest.Mock).mockReturnValue('/cancionero');
});

it('arranca y manda app_abierta + la pantalla actual', async () => {
  await renderHook(() => useScreenTracking());
  expect(initAnalytics).toHaveBeenCalledTimes(1);
  expect(trackEvent).toHaveBeenCalledWith('app_abierta');
  expect(trackEvent).toHaveBeenCalledWith('pantalla_vista', {
    ruta: '/cancionero',
  });
});

it('no repite app_abierta/initAnalytics al re-renderizar', async () => {
  const { rerender } = await renderHook(() => useScreenTracking());
  await rerender({});
  await rerender({});
  expect(initAnalytics).toHaveBeenCalledTimes(1);
  expect(
    (trackEvent as jest.Mock).mock.calls.filter((c) => c[0] === 'app_abierta'),
  ).toHaveLength(1);
});

it('no duplica pantalla_vista si la ruta no cambia', async () => {
  const { rerender } = await renderHook(() => useScreenTracking());
  await rerender({});
  expect(
    (trackEvent as jest.Mock).mock.calls.filter(
      (c) => c[0] === 'pantalla_vista',
    ),
  ).toHaveLength(1);
});

it('manda una nueva pantalla_vista cuando cambia la ruta', async () => {
  const { rerender } = await renderHook(() => useScreenTracking());
  (usePathname as jest.Mock).mockReturnValue('/cancionero/categoria');
  await rerender({});
  expect(trackEvent).toHaveBeenCalledWith('pantalla_vista', {
    ruta: '/cancionero/categoria',
  });
});
