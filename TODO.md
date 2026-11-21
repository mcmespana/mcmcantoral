# TODO — MCM Cantoral

> Tareas sueltas. El plan y su orden están en
> `docs/planes/fork-cantoral/README.md` §5; aquí solo lo que no cabe allí.

## Fuera del código (usuario)

- [ ] `eas init` del proyecto EAS **nuevo** y su id en el secreto
      `EAS_PROJECT_ID` (GitHub y EAS). Sin él no hay OTA ni web ni builds
      desde el CI (a propósito: así nunca se publica en el proyecto de MCM App).
- [ ] App en App Store Connect (`com.familiaconsolacion.mcmcantoral`): su id en
      `eas.json` (`ascAppId`) **y** en `utils/storeLinks.ts` (`IOS_APP_ID`).
- [ ] App en Play Console (`com.mcmespana.mcmcantoral`) y la huella SHA-256 de
      firma en `public/.well-known/assetlinks.json`.
- [ ] Spike de wifi local en dos móviles reales (`01` §2.10).
- [ ] Icono definitivo en Canva (D-06); hoy va el provisional.
- [ ] Izan como colaborador del repo.
