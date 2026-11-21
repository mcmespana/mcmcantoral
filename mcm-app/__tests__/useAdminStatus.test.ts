/**
 * `useAdminStatus` en MCM Cantoral: sin login no hay admin hasta que llegue el
 * código de administrador (`06-administracion.md`). Lo importante es que no
 * se cuele un `true` por estado local; solo los datos de ejemplo de
 * desarrollo (`EXPO_PUBLIC_FIREBASE_FIXTURES=1`) lo activan.
 */
import { renderHook } from '@testing-library/react-native';
import { useAdminStatus } from '@/hooks/useAdminStatus';

describe('useAdminStatus', () => {
  const prev = process.env.EXPO_PUBLIC_FIREBASE_FIXTURES;
  afterEach(() => {
    process.env.EXPO_PUBLIC_FIREBASE_FIXTURES = prev;
  });

  it('nadie es admin por defecto', async () => {
    delete process.env.EXPO_PUBLIC_FIREBASE_FIXTURES;
    const { result } = await renderHook(() => useAdminStatus());
    expect(result.current).toEqual({ isAdmin: false, loading: false });
  });

  it('con datos de ejemplo de desarrollo, sí', async () => {
    process.env.EXPO_PUBLIC_FIREBASE_FIXTURES = '1';
    const { result } = await renderHook(() => useAdminStatus());
    expect(result.current.isAdmin).toBe(true);
  });
});
