/* global jest */
/**
 * Mocks de módulos NATIVOS, para toda la suite.
 *
 * Un módulo de Expo con parte nativa llama a `requireNativeModule()` al
 * cargarse, y bajo Jest no hay TurboModule que devolver: la suite entera muere
 * en el `import`, antes de ejecutar una línea de test. Da igual que el test no
 * use esa función — basta con que algo del árbol la importe de rebote.
 *
 * Hasta ahora eso no molestaba porque los tests eran de lógica pura. Al montar
 * pantallas de verdad (`__tests__/screenSmoke.test.tsx`) el árbol arrastra la
 * torre de providers completa, y con ella media docena de módulos nativos.
 * Están aquí y no en el test para que el siguiente test de render no tenga que
 * volver a descubrirlos uno a uno — que es exactamente el muro que hace que
 * "añadir un test de pantalla" parezca caro y no se haga.
 *
 * Cada mock imita lo que la app espera de vuelta, no más. Un test que necesite
 * otro comportamiento lo sobrescribe con `jest.mock(...)` en su propio
 * fichero, que gana sobre esto.
 */

// Hápticas: se llaman desde cualquier pulsación.
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(() => Promise.resolve()),
  notificationAsync: jest.fn(() => Promise.resolve()),
  selectionAsync: jest.fn(() => Promise.resolve()),
  performAndroidHapticsAsync: jest.fn(() => Promise.resolve()),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium', Heavy: 'heavy' },
  NotificationFeedbackType: {
    Success: 'success',
    Warning: 'warning',
    Error: 'error',
  },
  // `utils/haptics.ts` lee el enum al llamar; en Android es lo que manda.
  AndroidHaptics: {
    Confirm: 'confirm',
    Reject: 'reject',
    Gesture_End: 'gesture-end',
    Clock_Tick: 'clock-tick',
    Context_Click: 'context-click',
    Long_Press: 'long-press',
    Virtual_Key: 'virtual-key',
    Segment_Tick: 'segment-tick',
  },
}));

// Navegador del sistema (enlaces de canciones, partituras).
jest.mock('expo-web-browser', () => ({
  openAuthSessionAsync: jest.fn(() => Promise.resolve({ type: 'cancel' })),
  maybeCompleteAuthSession: jest.fn(),
}));

// Analítica (Aptabase) y Sentry: se importan desde utils y arrancan al cargar.
jest.mock('@aptabase/react-native', () => ({
  init: jest.fn(),
  trackEvent: jest.fn(),
}));

jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  wrap: (c) => c,
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  addBreadcrumb: jest.fn(),
  setUser: jest.fn(),
  reactNavigationIntegration: jest.fn(() => ({})),
  mobileReplayIntegration: jest.fn(() => ({})),
}));

// Registro de assets: `expo-asset` lee `AssetRegistry` de 'react-native', que en
// RN 0.88 sale de `src/private/assets/AssetRegistry`; el mock de `jest-expo`
// apunta a `react-native/asset-registry`, otro módulo. Con el registro real
// vacío, cualquier icono de `@expo/vector-icons` que se monte revienta al
// cargar su fuente (`Module "1" is missing from the asset registry`).
jest.mock('react-native/src/private/assets/AssetRegistry', () => ({
  AssetRegistry: {
    registerAsset: jest.fn(() => 1),
    getAssetByID: jest.fn(() => ({
      fileSystemLocation: '/full/path/to/directory',
      httpServerLocation: '/assets/full/path/to/directory',
      scales: [1],
      fileHashes: ['md5'],
      name: 'name',
      exists: true,
      type: 'type',
      hash: 'md5',
      uri: 'uri',
      width: 1,
      height: 1,
    })),
  },
}));

// Worklets: bajo Jest no hay runtime nativo. El resolver de Reanimated carga la
// versión web, que lanza en cuanto algo pide el runtime de UI
// (`getUIRuntimeHolder is not supported on web`); el mock oficial lo evita.
jest.mock('react-native-worklets', () =>
  require('react-native-worklets/lib/module/mock'),
);

// Wifi del coro (`services/live/local/native.ts`): módulos nativos sin
// implementación en Jest. Los tests del camino local usan `net` de Node.
jest.mock('react-native-tcp-socket', () => ({
  __esModule: true,
  default: {
    createServer: jest.fn(() => ({
      on: jest.fn(),
      listen: jest.fn(),
      close: jest.fn(),
      address: jest.fn(() => null),
    })),
    createConnection: jest.fn(() => ({
      on: jest.fn(),
      write: jest.fn(),
      end: jest.fn(),
      destroy: jest.fn(),
      setEncoding: jest.fn(),
    })),
  },
}));
jest.mock('react-native-zeroconf', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    scan: jest.fn(),
    stop: jest.fn(),
    publishService: jest.fn(async () => ({ name: 'mock' })),
    unpublishService: jest.fn(async () => {}),
    removeDeviceListeners: jest.fn(),
  })),
}));
