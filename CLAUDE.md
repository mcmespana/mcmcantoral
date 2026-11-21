# CLAUDE.md — MCM Cantoral

> Orientación para agentes IA. Corto a propósito: lo demás está enlazado.

**MCM Cantoral** es la app del cantoral de MCM (Movimiento Consolación para
el Mundo) **sola**: estudiar, preparar repertorios, ensayar y **actuar en
directo** (seguir al maestro por la nube o por la wifi del coro), con modo
Navidad para los **Villancicos Solidarios** (19/12/2026). Nació el 21/11/2026
como copia con toda la historia de `mcmespana/mcmapp` (`main` @ `d4338986`):
ver [`docs/DIVERGENCIAS.md`](docs/DIVERGENCIAS.md).

**Stack:** Expo 58 · React Native 0.88 · React 19.3 · TypeScript · Firebase
RTDB (la misma base de datos que MCM App) · heroui-native · ChordSheetJS.
La app vive en la **raíz** del repo (en MCM App está en `mcm-app/`).

## Antes de tocar nada

1. **El plan**: [`docs/planes/fork-cantoral/README.md`](docs/planes/fork-cantoral/README.md)
   — decisiones D-01…D-23 ya contestadas: no se re-preguntan. Estado de cada
   fase en su §5.
2. **Interfaz**: lee [`design.md`](design.md) (prescriptivo). Los tokens de
   `constants/theme.ts` mandan sobre todo lo demás.
3. **Zona espejo** (la hoja de canción y la lógica compartida con MCM App):
   lista en [`docs/DIVERGENCIAS.md`](docs/DIVERGENCIAS.md) §2. Ahí se cambia
   pensando en las dos apps; cualquier novedad que valga para MCM App se
   apunta como fila 🟢 en §3.

## Comandos

```bash
npm start              # Servidor de desarrollo
npm run web            # Web
npm run lint           # ESLint (0 errores; no añadir warnings: docs/desarrollo/WARNINGS.md)
npm test               # Jest
npx tsc --noEmit       # Typecheck (y `npm run typecheck:tests`)
npm run snapshot:cantoral  # Semilla del catálogo (antes de cada build y OTA)
```

Builds: **nunca** `npx eas-cli build` a pelo; `npm run eas:build:ios -- --profile …`
(limpian los symlinks de skills). El proyecto EAS es **nuevo** y sale de
`EAS_PROJECT_ID` (`app.config.ts`): sin él no hay `updates.url` y ninguna OTA
puede caer en MCM App.

## Reglas

1. **Datos**: el fork **solo lee `songs/*`** (y las lecturas del domingo) y
   escribe únicamente en `songs/fallitos`, `songs/solicitudes`,
   `choirSessions/<clave>`, `choirs` y `playlistShares/<código>`. Lo vigila
   `__tests__/firebaseNodesGuard.test.ts`. Las **reglas de Firebase y las
   Cloud Functions de MCM App son de `mcmapp`**: aquí no se despliegan reglas.
2. **Nada de pestañas ni FAB** (T-05): una pila con barras inferiores.
3. **Directo = cero toques para quien sigue y uno para quien dirige**;
   controles de directo ≥ 56 pt (`03-diseno-y-flujos.md` §1).
4. **Todo funciona sin red**: el catálogo vive en ficheros con semilla
   empaquetada (`services/catalog/`). Las pantallas leen del catálogo, nunca
   de Firebase directamente.
5. **Una regla que se puede romper sin enterarse va en un test**, no en un
   documento.
6. **CHANGELOG.md**: entrada nueva arriba, `## YYYY-MM-DD HH:MM — Título`,
   para cambios de funcionalidad, datos, navegación o dependencias.
7. **OTA**: si un cambio lleva código nativo, `[skip-ota]` en el commit y una
   línea al final de la respuesta: `OTA: ❌ — requiere build nativo
   (paquetes: …). Commit con [skip-ota].` o `OTA: ✅ — solo JS.` Ritmo de
   ramas `main → preview → production` como MCM App:
   [`docs/desarrollo/OTA.md`](docs/desarrollo/OTA.md).
8. **Logging**: nunca `console.*`; `@/utils/logger`. Hápticas por
   `@/utils/haptics`. Importaciones con `@/`.
9. **No toques `.env.local`** (credenciales de Firebase).

## Dónde está cada cosa

| Qué | Dónde |
| --- | ----- |
| Rutas (una pila) | `app/` — `cancionero/` (categorías → lista → canción → pantalla completa), `cancion.tsx`, `coro.tsx`, `playlist.tsx` (puentes de enlaces) |
| Pantallas | `screens/` |
| Catálogo offline | `services/catalog/` + `hooks/useCatalog.ts` |
| Repertorios y bloques | `services/repertorios/` |
| Directo (protocolo, nube, wifi local) | `services/live/` |
| Configuración remota y modo Navidad | `utils/cantoralConfig.ts` (`songs/cantoralConfig`) |
| Hoja de canción (zona espejo) | `utils/songSheet*.ts`, `utils/songDocument.ts` |
| Tokens de diseño | `constants/theme.ts` (+ `constants/colors.ts` heredado) |
| Funcionalidades heredadas | `docs/funcionalidades/` (coros, hoja, arreglos, etiquetas, afinador, editor, enlaces, cantos del domingo) |
| Tareas pendientes | `TODO.md` |
