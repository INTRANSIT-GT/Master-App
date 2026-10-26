---
name: intransit-bitacora
description: Llevar la bitácora diaria del trabajo con IA en In Transit: anotar avances en la bitácora privada del día y, al cerrar, escribir el resumen público limpio del operador.
---

El operador de la sesión está en `.claude/privado/operador.json` y en el recibo de inicio (`operator`). Si dice NO_DECLARADO, preguntar quién trabaja antes de escribir.

## Dos bitácoras

| | Privada | Pública |
|---|---|---|
| Ruta | `.claude/privado/bitacora/AAAA-MM-DD.md` | `docs/ai/diario/<operador>/AAAA-MM-DD.md` |
| Git | Nunca (ignorada) | Sí, cuando el operador apruebe el commit |
| Contenido | Detalle de trabajo: archivos, comandos, dudas | Resumen sin datos privados |

EOS crea la privada del día y anota el INICIO. Cada operador escribe solo en su carpeta pública; así el rebase de otro equipo no choca.

## Anotar (durante la sesión)

Agregar al final de la privada del día, una línea por hito real, con hora local:

`- HH:MM · TIPO · texto`

TIPO: SOLICITUD (lo que pidió el operador), HECHO, VERIFICADO (comando, resultado y entorno), PENDIENTE, BLOQUEO, DECISIÓN (solo si la responsable la aprobó explícitamente). No anotar secretos, contenido de `.env`, credenciales ni filas o celdas de Excel con datos de clientes, ni siquiera en la privada.

## Cerrar (`/intransit-bitacora cerrar` o al despedirse)

1. Anotar en la privada las líneas que falten y un `CIERRE`.
2. Crear o completar `docs/ai/diario/<operador>/AAAA-MM-DD.md` con este formato, de 15 líneas como máximo:

   ```
   # AAAA-MM-DD · <operador> · <app>
   Revisión: <sha corto>
   ## Hecho
   ## Verificado
   ## Pendiente
   ## Decisiones aprobadas
   ```

3. El resumen público es para un repositorio público: sin nombres de clientes, filas de Excel, montos reales, rutas locales ni secretos. Las fuentes privadas se citan por identificador de `docs/ai/FUENTES.md`. Separar FUENTE, INTERPRETACIÓN, PROPUESTA y DECISIÓN APROBADA.
4. Si el trabajo cambia el estado del proyecto, actualizar también ESTADO y TRASPASO (skill `intransit-trazabilidad`).
5. No hacer commit ni push salvo pedido explícito; mostrar al operador lo que quedó escrito.
