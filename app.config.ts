import { ExpoConfig, ConfigContext } from '@expo/config';

/**
 * Proyecto de EAS de MCM Cantoral: el NUEVO (no el de MCM App: `01` §2.1).
 * `eas init` escribió su id en `app.json` (`extra.eas.projectId`, cuenta
 * `mcmespana`). `EAS_PROJECT_ID` en el entorno lo sobreescribe, pero ya no
 * hace falta ponerlo en ningún sitio. Sin id no hay `updates.url`, así que
 * **es imposible** que una OTA de este repo acabe en los móviles de MCM App.
 */
const projectIdOf = (extra: ExpoConfig['extra']): string =>
  process.env.EAS_PROJECT_ID || extra?.eas?.projectId || '';

export default ({ config }: ConfigContext): ExpoConfig => {
  const EAS_PROJECT_ID = projectIdOf(config.extra);
  return {
    ...config,
    name: config.name ?? 'MCM Cantoral',
    slug: config.slug ?? 'mcmcantoral',
    extra: {
      ...config.extra,
      ...(EAS_PROJECT_ID ? { eas: { projectId: EAS_PROJECT_ID } } : {}),
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
  };
};
