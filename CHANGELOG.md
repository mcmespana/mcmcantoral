# Changelog — MCM Cantoral

> Registro de cambios importantes (funcionalidad, datos, navegación,
> dependencias). Entrada nueva arriba, con fecha Y hora de España. La
> historia anterior al fork está en el repo de MCM App.

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
