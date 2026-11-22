# DIVERGENCIAS.md — MCM Cantoral frente a MCM App

> **Documento vivo del fork** (creado desde la plantilla
> `docs/planes/fork-cantoral/DIVERGENCIAS.md` el 21/11/2026, al crear el
> repo). Es corto a propósito: una fila por diferencia, entendible sin abrir
> el código. Las filas DIV-* de §3 son las **previstas** por el plan: se
> rellenan «Dónde» al hacerlas.
>
> **Para qué sirve:** el fork tiene vida propia y specs que MCM App no tiene,
> pero **cualquier novedad se puede llevar a MCM App** cuando haya tiempo y
> tokens, sin prisa. Esta tabla dice qué hay, de dónde viene y si ya se ha
> portado.

---

## 1. Base del fork

|                           |                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Repo de origen            | `mcmespana/mcmapp`                                                                                                                         |
| Commit de origen          | `d4338986` (`main` de `mcmapp`, 2026-11-21) — copia con toda la historia (1.993 commits), no fork de GitHub                                |
| Remoto para traer cambios | `git remote add upstream https://github.com/mcmespana/mcmapp`                                                                              |
| Estructura                | **La app está en la raíz** del fork; en MCM App está en `mcm-app/` (D-04). Un fichero `mcm-app/utils/x.ts` de MCM App es `utils/x.ts` aquí |
| Último repaso de upstream | 2026-11-21 hasta `d4338986` (el origen: nada que traer)                                                                                    |

## 2. Zona espejo (se mantiene igual que en MCM App)

Ficheros que **no se reescriben** en el fork, para poder traer y llevar
cambios con parches (§4) o copiando el fichero. Si hay que tocarlos, el
cambio se hace pensando en las dos apps y se apunta abajo como 🟢. Rutas del
fork (en MCM App, con `mcm-app/` delante):

La lista vive en **`scripts/upstream/zona-espejo.txt`** (hoja de canción,
notación y transporte, arreglos, etiquetas, editor, afinador y metrónomo, PDF,
repertorios offline y sus códigos, ids de coro, cantos del domingo).
`scripts/upstream-diff.sh` enseña qué ficheros de la lista difieren de
`upstream/main`, y `__tests__/zonaEspejo.test.ts` comprueba que la lista
existe y que cada fichero está.

## 3. Divergencias

Leyenda de **Tipo**: 🟢 importable a MCM App · 🔒 solo Cantoral (no tiene
sentido en MCM App) · ↩️ vino de MCM App después del fork.
**En MCM App**: ⏳ pendiente · ✅ portado (fecha) · — no aplica.

| ID      | Qué                                                                                              | Tipo | En MCM App | Dónde (fork)                                                                                  | Notas                                                                       |
| ------- | ------------------------------------------------------------------------------------------------ | ---- | ---------- | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| DIV-001 | Sin barra de pestañas ni FAB; una pila con barras inferiores de vidrio                           | 🔒   | —          | `app/_layout.tsx`, `app/index.tsx`                                                            | MCM App necesita sus pestañas                                               |
| DIV-002 | Identidad visual propia (sin territorios ni azul MCM)                                            | 🔒   | —          | `constants/theme.ts`, `design.md`                                                             |                                                                             |
| DIV-003 | Catálogo en ficheros con semilla empaquetada, escritura atómica, comparación numérica            | 🟢   | ⏳         | `services/catalog/`                                                                           | Arregla «la primera vez sin red está vacío» en MCM App                      |
| DIV-004 | Varios repertorios (MCM App: una «Tu selección»)                                                 | 🟢   | ⏳         | `services/repertorios/`                                                                       | Compartir v3 ya es compatible con MCM App                                   |
| DIV-005 | Bloques de villancicos (`songs/packs`)                                                           | 🟢   | ⏳         | `services/repertorios/model.ts` (`parsePacks`, `materialize`), `hooks/useRepertorios.ts`      | Un bloque es un repertorio de solo lectura                                  |
| DIV-006 | Modo Navidad por configuración (`songs/cantoralConfig`)                                          | 🟢   | ⏳         | `utils/cantoralConfig.ts`, `components/home/HomeSections.tsx`                                 |                                                                             |
| DIV-007 | Directo v2: varios maestros, avisos, reacciones, presencia (aditivo sobre `/choirSessions`)      | 🟢   | ⏳         | `services/live/`, `contexts/LiveContext.tsx`, `components/live/`                              | MCM App sigue a un maestro del fork sin cambios (sigue leyendo `current`)   |
| DIV-008 | Directo por wifi local (TCP + Bonjour), equipo base y relevo entre maestros                      | 🟢   | ⏳         | `services/live/local/`, `components/live/LocalLiveBridge.tsx`, `screens/EquipoBaseScreen.tsx` | Requiere build nativo                                                       |
| DIV-009 | Pedal Bluetooth nativo (`expo-key-event`) y botones de volumen con interruptor remoto            | 🟢   | ⏳         | `hooks/usePedal.ts`, `hooks/useSongPedal.ts`, `utils/pedalPage.ts`                            | Requiere build nativo. `SongDisplay` gana `pageRequest`/`onPageEdge`        |
| DIV-010 | Apuntes por capas (yo / instrumento / todos)                                                     | 🟢   | ⏳         |                                                                                               |                                                                             |
| DIV-011 | Riffs en ABC (abcjs)                                                                             | 🟢   | ⏳         | zona espejo (hoja)                                                                            | También requiere el generador del cantoral                                  |
| DIV-012 | Admin por código (Auth anónimo + función)                                                        | 🔒   | —          |                                                                                               | MCM App ya tiene login                                                      |
| DIV-013 | Sin Contigo, Comunica, calendario, fotos, eventos, encuestas, pañuelo, notificaciones, perfiles  | 🔒   | —          | (borrado, 21/11)                                                                              |                                                                             |
| DIV-014 | App en la raíz del repo, sin `mcm-app/`                                                          | 🔒   | —          | (estructura, 21/11)                                                                           | Por eso se porta con parches (§4)                                           |
| DIV-015 | El cantoral no se congela en directo: se aplica al momento sin mover la canción                  | 🟢   | ⏳         | `services/catalog/`                                                                           |                                                                             |
| DIV-016 | Seguir por sección, cuenta atrás de bloque, resumen al acabar                                    | 🟢   | ⏳         | `services/live/protocol.ts`, `components/live/`                                               | Sección: de momento la cinta «Ahora: …» (sin desplazar ni resaltar la hoja) |
| DIV-017 | Mantenimiento y versión mínima en `songs/cantoralConfig` (no en `/profileConfig`)                | 🔒   | —          | `utils/cantoralConfig.ts`, `contexts/VersionGateContext.tsx`                                  | La de MCM App bloquearía al fork                                            |
| DIV-018 | Nombre local en Ajustes en lugar del perfil (coro, fallitos, sugerencias)                        | 🔒   | —          | `contexts/AppSettingsContext.tsx` (`choirName`)                                               |                                                                             |
| DIV-019 | `qrScan` sin el pañuelo; textos «repertorio / directo»                                           | 🔒   | —          | `utils/qrScan.ts`                                                                             | Lee igual los QR de las dos apps                                            |
| DIV-020 | Marcado del cantoral en la hoja (`<i>` 2ª voz, `<u>`, `<b>`, `[*CLAP]`) y duración de la canción | 🟢   | ⏳         | zona espejo: `utils/songSheet.ts`, `utils/songSheetLayout.ts`, `utils/songDocument.ts`        | Fase 1 de Navidad                                                           |
| DIV-021 | Temas de la hoja «Escenario» (negro OLED) y «Sol» (blanco y negro)                               | 🟢   | ⏳         | zona espejo: `utils/songDocument.ts` + `SheetPalette`                                         | En MCM App irían con sus colores                                            |
| DIV-022 | Subcategorías y «también en» de las canciones                                                    | 🟢   | ⏳         | `utils/songCategories.ts`                                                                     |                                                                             |

Al añadir una fila: ID siguiente, una frase, tipo y dónde. Al portarla a MCM
App: «✅ AAAA-MM-DD» y el PR de `mcmapp`.

## 4. Cómo portar

Como la app vive en sitios distintos (raíz aquí, `mcm-app/` allí), se porta
con **parches**, no con `cherry-pick` a pelo:

```bash
# De MCM App al fork: --relative quita el prefijo mcm-app/ y deja fuera lo de fuera
git -C ../mcmapp format-patch -1 <sha> --relative=mcm-app --stdout | git am -3

# Del fork a MCM App: --directory vuelve a poner el prefijo
git -C ../mcmcantoral format-patch -1 <sha> --stdout | git -C ../mcmapp am -3 --directory=mcm-app
```

`scripts/upstream/traer.sh <sha>` y `scripts/upstream/llevar.sh <sha>` lo
hacen, y `scripts/upstream-diff.sh` compara cada fichero de la zona espejo
con su gemelo `mcm-app/<ruta>` de `upstream/main`.

**Del fork a MCM App** (una 🟢): si toca la zona espejo, parche con
`llevar.sh`; si no, se reimplementa con la UI de MCM App (su `design.md`
manda allí) reutilizando la lógica pura. Se marca la fila. **El cantoral de
MCM App solo crece** (decisión del usuario): todo lo 🟢 acaba llegando.

**De MCM App al fork**: en cada repaso, `scripts/upstream-diff.sh` +
`git log upstream/main -- mcm-app/<zona espejo>`; se traen con `traer.sh`
los commits de la zona espejo y los arreglos de cantoral que apliquen; lo
demás se ignora. Se apunta la fecha y el sha del repaso en §1.
