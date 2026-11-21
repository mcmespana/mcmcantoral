# design.md — MCM Cantoral

> Guía **prescriptiva** para quien toque interfaz (persona o IA). Corta a
> propósito. Lo que se puede romper sin enterarse está en un test, no aquí.
> Contexto y porqués: `docs/planes/fork-cantoral/03-diseno-y-flujos.md`.
> **Los tokens de `constants/theme.ts` mandan** sobre este documento.

## 1. La idea: «Escenario» (dirección A)

El atril de noche: **tinta casi negra y la luz cálida de una vela** (ámbar).
Oscuro primero; el claro («papel») bien hecho también. No es MCM App: **ni
azul MCM, ni colores por sección, ni territorios**. El estilo final lo
cierra Izan (D-05) cambiando valores en `constants/theme.ts`, sin tocar
pantallas.

## 2. Orden de prioridad (cuando dos cosas chocan)

1. **El directo**: cero toques para quien sigue, uno para quien dirige.
2. **Legibilidad de la letra** en penumbra, al sol y a un metro.
3. **Sin red, todo funciona.**
4. **Nativo** antes que propio (API del sistema → `@expo/ui` →
   `heroui-native` → componente propio).
5. Lo bonito.

## 3. Color

- **Solo roles**: `useTheme()` / `theme(isDark)` (`constants/theme.ts`) o
  `themeColors(isDark)` (`constants/colors.ts`, nombres heredados con los
  valores nuevos). Nada de hex en pantallas (`noNewMagicNumbers`).
- **Ámbar (`accent`) = acción principal, acordes y lo que está vivo.** Uno
  por pantalla como relleno (el botón principal). Tinta encima: `onAccent`.
- **Ámbar como TEXTO sobre claro → `accentText`**, nunca `accent` (no llega
  a 4,5:1; lo vigila `designTokens`).
- **En directo**: `live` (punto rojo) solo para «en directo»; nada más rojo.
- Interfaz ≥ 4,5:1. **Letra del Atril ≥ 7:1** en sus cuatro temas.

## 4. El Atril (la canción)

- Una sola vista de canción, la misma al estudiar, ensayar y en directo. El
  directo es una capa encima (seguir, avisos, reacciones), no otra pantalla.
- Temas de la hoja (`SheetPalette`): **Sistema** (claro/oscuro de la app),
  **Escenario** (negro real, OLED) y **Sol** (blanco y negro). En «Aa →
  Pantalla», a un toque.
- **Acordes en negrita** además de ámbar: se distinguen sin color.
- Marcado del cantoral: `<i>` 2ª voz (cursiva tenue), `<u>` altas/bajas
  (subrayado), `<b>` énfasis; `[*CLAP]` anotación (cursiva pequeña, no se
  transporta).
- La hoja (`utils/songSheet*.ts`, `songDocument.ts`) es **zona espejo** con
  MCM App: cambios pensando en las dos (`docs/DIVERGENCIAS.md`).

## 5. Navegación y barras

- **Una pila, sin pestañas ni FAB** (T-05). Lo frecuente va en la **barra
  inferior de vidrio** (`components/ui/BottomBar.tsx`), contextual por
  pantalla: pulgar abajo, nunca en las esquinas de arriba.
- La cabecera es la del fondo (vidrio en iOS, sólida en Android/web) con los
  botones en `accentText` (`utils/cantoralHeader.ts`).
- Las listas reservan el hueco de la barra: `BOTTOM_BAR_SPACE` + área segura.
- Menús: nativo en iOS (`Stack.Toolbar.Menu`), `ContextMenuSheet` en el
  resto. Hojas: `BottomSheet`.

## 6. Tamaños y toque

- Mínimo **44 pt**; **56 pt** en todo control de directo (`TouchTarget.live`,
  guantes y prisa). Los avisos del maestro se leen a un metro: nada de texto
  pequeño en directo.
- Tipografía del sistema (`constants/typography.ts`); los títulos se
  distinguen por tamaño y peso, no por color.
- Radios y espacios de las escalas (`constants/uiStyles.ts`,
  `constants/spacing.ts`); `radii.pillFull` para «redondo».

## 7. Vocabulario (D-12)

**Cantoral · Repertorio · Directo · Dirige / Maestro · Sigue · Aviso ·
Apunte · Arreglo.** «Bloque» solo dentro de un evento (los de villancicos).
Todo tiene que tener sentido en el modo normal: Navidad es una capa encima.

## 8. Antipatrones (no se envían)

- Un hex, un `fontSize` o un `borderRadius` a mano en una pantalla.
- Un FAB, una barra de pestañas o un botón importante arriba a la derecha.
- Ámbar sobre claro como texto; dos rellenos ámbar en la misma pantalla.
- Algo que tape la letra en directo (los avisos **empujan**, no tapan).
- Una acción de directo de más de 1 toque para quien dirige.

## 9. Checklist de una pantalla

- [ ] ¿Se entiende entornando los ojos? ¿Qué es título y qué es acción?
- [ ] ¿Oscuro, claro, Escenario y Sol? ¿Letra del sistema enorme?
- [ ] ¿iPad en horizontal y vertical, y ventana pequeña?
- [ ] ¿Toques del flujo dentro de `03` §5?
- [ ] ¿Controles de directo ≥ 56 pt? ¿Nada tapa la letra?
- [ ] ¿Nativo antes que propio?
