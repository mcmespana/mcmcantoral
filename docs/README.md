# Documentación — MCM Cantoral

> 🎨 **¿Vas a tocar interfaz?** Empieza por [`design.md`](../design.md).
> Para agentes: [`CLAUDE.md`](../CLAUDE.md).

## Plan y trazabilidad

| Documento | Qué |
| --------- | --- |
| [planes/fork-cantoral/](planes/fork-cantoral/README.md) | El plan de MCM Cantoral: decisiones, fases, calendario |
| [DIVERGENCIAS.md](DIVERGENCIAS.md) | Qué diverge de MCM App, zona espejo y cómo portar cambios en los dos sentidos |

## Funcionalidades (heredadas del cantoral de MCM App)

| Documento | Qué cubre |
| --------- | --------- |
| [COROS.md](funcionalidades/COROS.md) | Coros, repertorios compartidos y el coro en vivo (base del directo) |
| [HOJA_CANCION.md](funcionalidades/HOJA_CANCION.md) | Cómo se pinta una canción: hoja, cortes, vista compacta |
| [ARREGLOS.md](funcionalidades/ARREGLOS.md) | Arreglos del cantoral (`{arr:}`) |
| [ETIQUETAS.md](funcionalidades/ETIQUETAS.md) | Etiquetas (`{tags:}`) |
| [AFINADOR.md](funcionalidades/AFINADOR.md) | Afinador y metrónomo |
| [EDITOR_CANCIONES.md](funcionalidades/EDITOR_CANCIONES.md) | Editor de canciones (admin) |
| [ENLACES_CANCION.md](funcionalidades/ENLACES_CANCION.md) | Enlaces de una canción (Spotify, partituras…) |
| [CANTOS_DOMINGO.md](funcionalidades/CANTOS_DOMINGO.md) | «Cantos para el domingo» |

## Desarrollo

| Documento | Qué |
| --------- | --- |
| [OTA.md](desarrollo/OTA.md) | `main → preview → production`, cuándo no empujar y cómo deshacer |
| [PRUEBAS_EN_SIMULADOR.md](desarrollo/PRUEBAS_EN_SIMULADOR.md) | Probar en iPhone/Android |
| [WARNINGS.md](desarrollo/WARNINGS.md) | Warnings del linter que quedan y por qué |
| [COBERTURA.md](desarrollo/COBERTURA.md) | Receta para subir la cobertura de tests |
