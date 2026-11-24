# Changelog — MCM Cantoral

> Registro de cambios importantes (funcionalidad, datos, navegación,
> dependencias). Entrada nueva arriba, con fecha Y hora de España. La
> historia anterior al fork está en el repo de MCM App.

## 2026-11-25 00:30 — Proyecto EAS creado

- `eas init` creó el proyecto **nuevo** `mcmespana/mcmcantoral` (slug
  `mcmcantoral`); su id vive en `app.json` y `app.config.ts` lo lee de ahí.
  El secreto `EAS_PROJECT_ID` ya no hace falta (los workflows no lo piden).
- Fuera de `app.json` las claves de Firebase que `eas init` copió de
  `.env.local` y de `app.config.ts` los `extra.firebase*`: nadie los leía (la
  app usa `EXPO_PUBLIC_FIREBASE_*` al empaquetar) y el repo es público.

## 2026-11-24 23:55 — Versiones al día y limpieza

- **Expo SDK 58.0.26** (el último): todos los `expo-*`,
  `react-native-safe-area-context` 5.11 y `react-native-screens` 4.30.1
  alineados con lo que pide el SDK (`npx expo install --check` limpio).
- Al día dentro de su major: `firebase` 13.4, `uniwind` 1.14, `tailwindcss`
  4.3.5, `react-native-audio-api` 1.0.1, `react-native-qrcode-svg`,
  `react-native-reorderable-list`, `prettier`, `lint-staged` 17 y tipos.
  `abcjs` 6.7.3 con `utils/songSheetAbcjs.ts` regenerado.
- **`heroui-native` se queda en 1.0.11**: la 1.1.1 lee
  `Platform.constants.reactNativeVersion` sin comprobarlo y rompe el render
  estático de la web (`expo export -p web`).
- Sin subir a propósito (majors que piden migración): ESLint 10,
  TypeScript 7, Babel 8, `@react-native-async-storage/async-storage` 3 (la
  fija Expo en 2.2.0), `esbuild` 0.28 y `@react-native-community/cli` 21.
- CI: `actions/checkout` y `actions/setup-node` v7 (las v4 corrían en Node
  20, deprecado) y `eas-cli` fijado a 27.11.0.
- Fuera: `sharp` (era de los generadores de iconos de MCM App), las
  constantes de la barra de pestañas (`TAB_BAR_*`, `TabHeaderColors`), el
  hook `useCatalogVersion` sin uso y la plantilla duplicada
  `docs/planes/fork-cantoral/DIVERGENCIAS.md` (el vivo es
  `docs/DIVERGENCIAS.md`).

## 2026-11-22 10:05 — Fase 5: apuntes por capas y partituras ABC

- **Apuntes** en el Atril: toque largo en una línea → texto, marca (p, f,
  a capela, x2…) o acorde alternativo, para **Solo yo**, **Todos** o un
  **instrumento**. Se pintan debajo de su línea sin tocar el ChordPro, se
  **recolocan solos** si la canción cambia (y si no, «¿Dónde iba esto?»).
  «⋯ → Apuntes» elige qué capas se ven.
- Los de Todos e instrumento **viajan dentro del repertorio** al subirlo y
  llegan al importarlo; quien dirige puede mandar uno **al directo**.
- **Partituras**: los bloques `{start_of_abc: Etiqueta}` … `{end_of_abc}` del `.cho` se
  pintan como pentagrama dentro de la hoja con **abcjs 6.7.2** (en línea, sin
  red) y **siguen el tono** de la canción (`visualTranspose`), también al
  transportar sin recargar. Siguen el tema (claro, oscuro, escenario, sol).
- Zona espejo (`utils/songSheet.ts`, `utils/songDocument.ts`, nuevos
  `utils/songSheetAbc.ts` y `utils/songSheetAbcjs.ts`): una canción sin ABC
  da el mismo HTML que antes; abcjs (~445 KB) solo entra en el HTML de las
  que lo traen.
- Nueva dependencia de desarrollo `abcjs` (exacta): `npm run build:abcjs`
  regenera el módulo en línea. Escuchar el riff (▶) queda para luego.

## 2026-11-22 09:55 — Fase 4: administrador por código

- Al arrancar, la app entra **en silencio** con Firebase Auth anónimo (un
  `uid` por instalación, sin pantalla ni correo).
- Ajustes → **«Soy administrador»**: el código lo comprueba la función
  `claimCantoralAdmin` (`functions/`, codebase `cantoral`, 5 intentos por
  hora) contra su huella en `/_config/cantoral`, y deja
  `users/<uid>/isAdmin`, que es lo que ya mira el NAS del editor.
- Nueva dependencia de servidor: `functions/` (firebase-admin,
  firebase-functions). Hay que activarlo fuera del código (`TODO.md`).

## 2026-11-22 09:40 — Fase 3: el directo

- **Protocolo propio** (`services/live/protocol.ts`): un estado del maestro
  que manda por `seq` más avisos, reacciones y «fin»; un reductor puro junta
  lo que llega por los dos caminos sin duplicar.
- **Por internet** (aditivo en `/choirSessions/<clave>`: `state`, `masters`,
  `masterPinHash`, `presence`, `avisos`, `reacciones`). Se sigue escribiendo
  `current`, así que MCM App sigue a un maestro de aquí canción a canción.
- **Por la wifi del coro** (TCP + Bonjour, `services/live/local/`): servidor
  en quien abre el directo (o en el maestro que toma el relevo), clientes con
  reconexión, el cantoral más nuevo repartido por trozos con sha256, y
  directos **solo por wifi** (sin internet). Prueba de carga:
  `node scripts/live-load-test.mjs` (1 base + 3 maestros + 40 seguidores).
- **Dirigir** desde un repertorio: por dónde va (Los dos / Wifi del coro /
  Internet, marcado según la conexión), clave (la del evento en sus bloques)
  y **PIN de 4 cifras** para los demás maestros. **Unirme**: los de cerca por
  la wifi, con la clave o el QR; con PIN, a dirigir.
- En el Atril: **cintas** de aviso que empujan la letra (no la tapan),
  **destello** en el borde, cuenta atrás de bloque, «Ahora: Puente»,
  reacciones agregadas, píldora de quien sigue (por dónde le llega, **ir por
  libre / volver**, tono del maestro) y barra de quien dirige a **56 pt**
  (‹ ›, avisos de 1 toque, «Avisos» para dirigirlos a un instrumento).
- **Equipo base** (monitor del servidor), **resumen al cerrar** (guardable
  como repertorio) y Ajustes → Directo (qué tocas, reacciones, cantoral sin
  preguntar) y → **Pedal** (pedal Bluetooth/teclado y botones de volumen,
  con el interruptor remoto `cantoralConfig.volumeButtons`).
- Dependencias nativas: `react-native-tcp-socket`, `react-native-zeroconf`,
  `expo-key-event`, `react-native-volume-manager`, `expo-brightness`.

## 2026-11-22 00:05 — Fase 2: dirección «Escenario» (tinta y ámbar)

- Tokens nuevos en `constants/theme.ts` (oscuro primero, claro «papel») y
  `design.md` prescriptivo. Temas de la hoja: Sistema, **Escenario** (negro)
  y **Sol** (blanco y negro), en «Aa → Pantalla».
- Inicio con el directo, el evento de Navidad con sus bloques y los
  repertorios; pantallas **Repertorios** y **Repertorio**; barras inferiores
  de vidrio en lugar del FAB.

## 2026-11-21 23:40 — Fase 1: catálogo sin red, repertorios y Navidad

- **Catálogo en ficheros** con semilla empaquetada (`npm run
snapshot:cantoral`), escritura atómica y comparación numérica de
  `updatedAt`: las pantallas leen del catálogo, nunca de Firebase.
- **Varios repertorios** (con fecha, evento, pausas y notas) y los **bloques**
  de villancicos (`songs/packs`) como repertorios de solo lectura. Compartir
  v3 compatible con MCM App.
- Subcategorías, «también en», marcado del cantoral (`<i>`, `<u>`, `<b>`,
  `[*CLAP]`) y duración de cada canción y de cada repertorio.
- **Modo Navidad** por `songs/cantoralConfig` (fechas, evento, bloques).

## 2026-11-21 23:20 — Fase 0: la app a la raíz, documentos y CI del fork

- La app vive en la **raíz** del repo (commit que solo mueve: la historia de
  cada fichero se conserva). Fuera las carpetas de MCM App
  (`_para-borrar`, medallas, piezas, portadas, scraper, `firebase-seed`) y lo
  de Firebase que es de `mcmapp` (reglas, `firebase.json`).
- `CLAUDE.md` único y corto, `README.md`, `docs/README.md`, `TODO.md` nuevos;
  `docs/` solo con el plan, `DIVERGENCIAS.md` y las funcionalidades del
  cantoral.
- Workflows sin `working-directory: mcm-app`, sin Comunica ni Google, y
  exigiendo `EAS_PROJECT_ID` (proyecto EAS nuevo) antes de publicar.

## 2026-11-21 23:00 — Fase 0: identidad y poda

- **Nace MCM Cantoral desde `mcmapp@d4338986`.** Nombre, identificadores
  (`com.familiaconsolacion.mcmcantoral`, `com.mcmespana.mcmcantoral`,
  `mcmcantoral://`), web `mcm-cantoral.expo.app`, versión 1.0.0.
- Una sola pila **sin pestañas ni FAB**: `/` entra directo en el cantoral.
- Fuera todo lo que no es el cantoral (Comunica, Contigo, Pañuelo, eventos,
  calendario, fotos, encuestas, notificaciones, perfiles, login,
  Carismochito, Wordle, Laboratorio Alpha) con sus dependencias nativas.
- Mantenimiento y versión mínima propios en `songs/cantoralConfig`
  (los de `/profileConfig` son de MCM App y bloquearían la 1.0).
- Nombre local opcional («¿Cómo te llamas en el coro?») en lugar del perfil.
- Los QR y enlaces de MCM App siguen valiendo, y los de aquí valen en MCM App.
