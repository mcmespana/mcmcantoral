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
- [ ] Probar un **pedal real** en iPad y en Android (`04` §8.6) y los
      botones de volumen como pedal (iOS: norma 2.5.9; si Apple se queja,
      `cantoralConfig.volumeButtons.ios = false`).
- [ ] **Ensayo con el router del evento** y 10+ móviles (`04` §5.3): una sola
      red, sin aislamiento de clientes, mDNS permitido. Probar también el
      relevo (apagar el equipo base a mitad) y «Los dos» sin internet.
- [ ] Crear en `songs/cantoralConfig` el evento con su `liveKey` y
      `liveTransport`, y los bloques en `songs/packs` (repo del cantoral).

## Directo: lo que falta en el código

- [ ] «Estamos aquí» tocando la sección en la hoja del maestro o pasándola
      con el pedal (`04` §10.1); hoy se elige en «Avisos → Ahora hacemos…».
- [ ] QR del directo con `ip:puerto` para entrar por la wifi cuando Bonjour
      no funciona (`04` §5.1).
- [ ] Pantalla propia antes del permiso de **red local** de iOS y el
      «Probar la conexión del coro» del onboarding de Navidad (`04` §5.4).
      Android 17: `ACCESS_LOCAL_NETWORK` en tiempo de ejecución cuando el
      targetSdk llegue a 37.
- [ ] Que un maestro le suba su cantoral más nuevo al equipo base por la
      wifi (hoy el base reparte el suyo).
- [ ] Revisar en dispositivo lo que solo está comprobado por tipos en
      `services/live/local/native.ts` (puerto tras `listen`, `setEncoding`).
