# Changelog — MCM Cantoral

> Registro de cambios importantes (funcionalidad, datos, navegación,
> dependencias). Entrada nueva arriba, con fecha Y hora de España. La
> historia anterior al fork está en el repo de MCM App.

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
