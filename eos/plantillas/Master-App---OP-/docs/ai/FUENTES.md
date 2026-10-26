# FUENTES · OP (Operaciones)

Este repositorio es público: aquí solo van referencias públicas e identificadores de fuentes privadas. El detalle de las fuentes privadas vive en el registro privado local de Ing. Carmen (carpeta `_privado`, fuera de los repositorios).

## Públicas

| ID | Fuente | Revisión | Uso |
|---|---|---|---|
| PUB-OP | https://github.com/INTRANSIT-GT/Master-App---OP- | `1793036752e7926a806cd486b8e5f8b66b0802aa` | Código de esta aplicación |
| PUB-MA | https://github.com/INTRANSIT-GT/Master-App | `a09bacbe2f9f778aa0b7f9127787a2d84a64b15b` | Aplicación hermana (Transportes) |
| PUB-DOC | https://code.claude.com/docs/en/hooks | consultada 2026-10-25 | Formato del hook `SessionStart` (`args`, `${CLAUDE_PROJECT_DIR}`) |

## Privadas (solo identificador)

| ID | Tipo | SHA-256 | Leído | Estado |
|---|---|---|---|---|
| XL-OP-001 | Libro `.xlsm` con macros (no ejecutadas) | `a22ad3894bcb639d54b51070acb9b89c5f6698b6b1368db4425dc57ba08296e5` | 2026-10-25 | Ejemplo entregado por Ing. Carmen; inventario estructural hecho; reglas aún no extraídas |

**INTERPRETACIÓN (sin aprobar):** XL-OP-001 parece ser el libro operativo semanal de una sede, del tipo que OP reemplaza (producción y maquila por día y semana, horas hombre, inventario de materiales, estatus de facturación por cliente). Antes de usar cualquier regla suya se debe registrar hoja, celda, fórmula y valor en el registro privado, y comparar contra `server/src/engine/`.

## Históricas
- Paquete de inicio v1.0 (25 de octubre de 2026), preparado por Codex. Es una propuesta; ante una contradicción con los Excel oficiales, registrar la diferencia y pedir la decisión de Ing. Carmen.
