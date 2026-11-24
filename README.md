# MCM Cantoral

El cantoral de MCM (Movimiento Consolación para el Mundo) en una app propia:
letras y acordes **sin conexión**, **repertorios** para la misa o el ensayo, y
**directo** para coros —quien dirige pasa las canciones y los demás las ven
cambiar solas, por internet o por la wifi del coro—. Sale en **modo Navidad**
para los Villancicos Solidarios.

Lee la misma base de datos que MCM App (solo el nodo `songs`). Es una copia
con historia de [`mcmespana/mcmapp`](https://github.com/mcmespana/mcmapp): qué
diverge y cómo se portan cambios, en [`docs/DIVERGENCIAS.md`](docs/DIVERGENCIAS.md).

## Arrancar

```bash
npm ci
cp .env.example .env.local   # rellenar las EXPO_PUBLIC_FIREBASE_* (las de MCM App)
npm start                    # o: npm run web
```

Tests y comprobaciones: `npx tsc --noEmit && npm run lint && npm test`.

## Publicar

- **Web**: `mcmcantoral.expo.app` (workflow `deploy-web`, al empujar a
  `production`).
- **OTA**: `main → preview → production` (`docs/desarrollo/OTA.md`).
- **Tiendas**: `npm run eas:build:ios -- --profile production` (y android).
  El proyecto EAS (`mcmespana/mcmcantoral`) ya existe: su id está en
  `app.json`. Detalle en
  [`docs/planes/fork-cantoral/07-tiendas-y-villancicos.md`](docs/planes/fork-cantoral/07-tiendas-y-villancicos.md).

## Documentación

- Plan y decisiones: [`docs/planes/fork-cantoral/`](docs/planes/fork-cantoral/README.md)
- Para agentes IA: [`CLAUDE.md`](CLAUDE.md) y [`design.md`](design.md)
- Índice: [`docs/README.md`](docs/README.md)
