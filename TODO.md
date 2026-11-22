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

- [ ] **Admin por código** (`functions/README.md`): activar el inicio de
      sesión **anónimo** en Firebase Auth, guardar la huella del código en
      `/_config/cantoral/adminCodeHashes`, añadir las reglas en `mcmapp`
      (`/_config/cantoral` cerrado; `users/$uid/isAdmin` legible solo por su
      `uid`) y desplegar `functions:cantoral`. Luego, probar el editor contra
      el NAS con un admin anónimo (`06` 6.4).

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

## Apuntes y partituras: lo que falta (`05`)

- [ ] ▶ Escuchar el riff ABC con el sintetizador de abcjs y una soundfont
      empaquetada (sin red).
- [ ] Teclado de piano → ABC y tararear/tocar → ABC (con el seguidor de tono
      del afinador) para riffs personales en los apuntes (5.6, 5.8).
- [ ] Bloque «🎺 Riff / melodía» en el admin del cantoral y `APP_ABC` en el
      generador (5.5b, repo `mcmapp-cantoral`), **solo cuando MCM App también
      pinte el ABC** (zona espejo).
- [ ] Partituras ABC: nombres de acordes en notación ES, enarmónicos (abcjs
      elige sostenidos), tamaño con la letra y en el PDF de la playlist.
- [ ] Exportar los apuntes también en el `.mcm` (hoy viajan al subir el
      repertorio a la nube o al coro; `SelectedSongsScreen` está por encima
      del límite de líneas y hay que partirla antes de tocarla).
