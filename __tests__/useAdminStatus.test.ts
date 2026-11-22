/**
 * Admin por código (`06-administracion.md`): sin código nadie es admin; la
 * marca `users/<uid>/isAdmin` del `uid` anónimo es lo único que cuenta, y el
 * código lo comprueba el servidor (`claimCantoralAdmin`), nunca la app.
 */
import { renderHook } from '@testing-library/react-native';
import { onAuthStateChanged, signInAnonymously } from 'firebase/auth';
import { onValue } from 'firebase/database';
import { httpsCallable } from 'firebase/functions';
import { useAdminStatus } from '@/hooks/useAdminStatus';
import { AdminStore } from '@/services/adminService';

const mockOnAuth = onAuthStateChanged as unknown as jest.Mock;
const mockOnValue = onValue as unknown as jest.Mock;
const mockCallable = (httpsCallable as unknown as jest.Mock)();

describe('useAdminStatus', () => {
  const prev = process.env.EXPO_PUBLIC_FIREBASE_FIXTURES;
  afterEach(() => {
    process.env.EXPO_PUBLIC_FIREBASE_FIXTURES = prev;
  });

  it('nadie es admin por defecto', async () => {
    delete process.env.EXPO_PUBLIC_FIREBASE_FIXTURES;
    const { result } = await renderHook(() => useAdminStatus());
    expect(result.current.isAdmin).toBe(false);
  });

  it('con datos de ejemplo de desarrollo, sí', async () => {
    process.env.EXPO_PUBLIC_FIREBASE_FIXTURES = '1';
    const { result } = await renderHook(() => useAdminStatus());
    expect(result.current.isAdmin).toBe(true);
  });
});

describe('AdminStore', () => {
  beforeEach(() => {
    mockOnAuth.mockClear();
    mockOnValue.mockClear();
    (signInAnonymously as jest.Mock).mockClear();
  });

  it('entra en silencio con un usuario anónimo y lee SU marca', () => {
    const store = new AdminStore();
    store.start();
    expect(signInAnonymously).toHaveBeenCalledTimes(1);
    const onUser = mockOnAuth.mock.calls[0][1];
    onUser({ uid: 'u1' });
    expect(mockOnValue.mock.calls[0][0]).toEqual(
      expect.objectContaining({ path: 'users/u1/isAdmin' }),
    );
    const onSnap = mockOnValue.mock.calls[0][1];
    onSnap({ val: () => 'true' }); // un texto no vale
    expect(store.getState().isAdmin).toBe(false);
    onSnap({ val: () => true });
    expect(store.getState()).toEqual({
      uid: 'u1',
      isAdmin: true,
      loading: false,
    });
  });

  it('el código lo decide el servidor', async () => {
    const store = new AdminStore();
    mockCallable.mockResolvedValueOnce({ data: { ok: true } });
    await expect(store.claim(' 1234 ')).resolves.toEqual({ ok: true });
    expect(mockCallable).toHaveBeenLastCalledWith({ code: '1234' });

    mockCallable.mockResolvedValueOnce({ data: { ok: false } });
    await expect(store.claim('9')).resolves.toEqual({
      ok: false,
      reason: 'bad-code',
    });

    mockCallable.mockRejectedValueOnce({
      code: 'functions/resource-exhausted',
    });
    await expect(store.claim('9')).resolves.toEqual({
      ok: false,
      reason: 'too-many',
    });

    await expect(store.claim('   ')).resolves.toEqual({
      ok: false,
      reason: 'bad-code',
    });
  });
});
