/**
 * Mock de `firebase/functions` (ESM sin transformar en Jest), mapeado en
 * `jest.config.js`. Cada test pone la respuesta que quiera en `mockCallable`.
 */
export const mockCallable = jest.fn(() =>
  Promise.resolve({ data: { ok: false } }),
);
export const getFunctions = jest.fn(() => ({}));
export const httpsCallable = jest.fn(() => mockCallable);
