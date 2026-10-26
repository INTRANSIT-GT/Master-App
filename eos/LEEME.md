# EOS · sesiones de Claude listas para In Transit

EOS prepara y abre las sesiones de Claude Code para OP y Transportes. Va dentro de los dos repositorios (`eos/`), así que cada operador lo recibe con el repositorio.

## Primera vez en un equipo

1. Instalar Python 3 desde python.org o la Microsoft Store. EOS instala Node y Git con winget si faltan.
2. Crear una carpeta de trabajo y clonar ahí uno de los repositorios con su nombre original (`Master-App---OP-` o `Master-App`).
3. Doble clic en `eos/EOS.cmd`. EOS clona el otro repositorio en la misma carpeta y crea un acceso directo en el escritorio.

## Uso diario

Doble clic, elegir quién trabaja, qué abrir y cómo. Enter repite la última elección. Si faltan dependencias, EOS lo avisa y copia al portapapeles el prompt de sincronización para pegarlo en Claude Code. También queda en `.claude/privado/sync.md`.

## Qué queda dónde

| Qué | Dónde | ¿Va a Git? |
|---|---|---|
| Programa, plantillas del kit, operadores | `eos/` en cada repo | Sí |
| Última elección, manifiesto, registros, respaldos | `<carpeta de trabajo>/.eos/` | No: fuera de los repositorios |
| Operador, bitácora y prompt del día | `.claude/privado/` en cada repo | No: ignorado |
| Resumen público del día | `docs/ai/diario/<operador>/` | Sí, con la aprobación del operador |

Un operador nuevo no puede abrir sesiones hasta tener alta. El alta se da en el menú con `[A]` y la hace Carmen. Después hay que hacer commit de `eos/perfiles.json`.

Opciones sin menú: `EOS.cmd --operador=carmen --repos=op --modo=rapido`. Ver el encabezado de `EOS.py`.
