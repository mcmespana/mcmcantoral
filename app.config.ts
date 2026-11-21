import { ExpoConfig, ConfigContext } from '@expo/config';

/**
 * Proyecto de EAS de MCM Cantoral. Es NUEVO (no el de MCM App: `01` §2.1) y
 * sale de `eas init`; mientras no exista, la variable va vacía y la app no
 * tiene `updates.url`, así que **es imposible** que una OTA de este repo
 * acabe en los móviles de MCM App.
 *
 * Cuando se cree: poner el id en el secreto `EAS_PROJECT_ID` (GitHub y EAS) o
 * escribirlo aquí abajo como valor por defecto.
 */
const EAS_PROJECT_ID = process.env.EAS_PROJECT_ID ?? '';

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: config.name ?? 'MCM Cantoral',
  slug: config.slug ?? 'mcm-cantoral',
  extra: {
    ...config.extra,
    ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
    firebaseApiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
    firebaseAuthDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    firebaseDatabaseUrl: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
    firebaseProjectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    firebaseStorageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    firebaseMessagingSenderId:
      process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    firebaseAppId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  },
  ...(EAS_PROJECT_ID
    ? {
        updates: {
          url: `https://u.expo.dev/${EAS_PROJECT_ID}`,
          fallbackToCacheTimeout: 0,
          checkAutomatically: 'ON_LOAD',
        },
      }
    : {}),
  plugins: [
    ...(Array.isArray(config.plugins) ? config.plugins : []),
    // Sentry. El plugin va SIEMPRE (el SDK nativo tiene que estar en el
    // binario; añadirlo después por OTA es imposible). Que se reporte o no lo
    // decide `EXPO_PUBLIC_SENTRY_DSN` en runtime: hasta la Fase 5 va APAGADO
    // (D-15), sin DSN. `organization`/`project` solo sirven para subir los
    // source maps al compilar; sin ellos el build no falla.
    [
      '@sentry/react-native/expo',
      {
        url: 'https://sentry.io/',
        ...(process.env.SENTRY_ORG
          ? { organization: process.env.SENTRY_ORG }
          : {}),
        ...(process.env.SENTRY_PROJECT
          ? { project: process.env.SENTRY_PROJECT }
          : {}),
      },
    ] as [string, object],
  ],
});
