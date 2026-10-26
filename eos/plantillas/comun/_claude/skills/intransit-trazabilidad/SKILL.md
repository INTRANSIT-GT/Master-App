---
name: intransit-trazabilidad
description: Verificar fuentes Excel y código, sincronizar el estado y preparar un traspaso de In Transit sin exponer datos privados.
---

1. Leer AGENTS.md, docs/ai/ESTADO.md y el último TRASPASO.md completos.
2. Identificar módulo, revisión y alcance actual de Carmen.
3. Leer solo la fuente necesaria. Para Excel usar copia, hash y hoja/celda/fórmula; para código usar SHA/archivo/línea.
4. Etiquetar FUENTE, INTERPRETACIÓN, PROPUESTA y DECISIÓN APROBADA.
5. No cargar credenciales ni publicar fuentes privadas. No escribir Supabase por una solicitud de lectura.
6. Ejecutar la comprobación pertinente y registrar su salida sanitizada.
7. Actualizar estado y traspaso con ejecutado, no verificado, bloqueos y siguiente paso.

Las fuentes privadas (Excel de Carmen) se registran en el repositorio solo por identificador y SHA-256 en docs/ai/FUENTES.md; el detalle va en el registro privado local fuera de los repositorios. Los repositorios son públicos.
