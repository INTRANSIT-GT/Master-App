# ESTADO · OP (Operaciones)

Actualizado: 2026-10-25 · Claude Code (extensión VS Code 2.1.310, Windows 11)

## Objetivo autorizado
Preparar la configuración local de Claude según el paquete de inicio v1.0. Autorizado por Ing. Carmen el 2026-10-25: clonar OP y Master App, preparar reglas, hook, estado y skill.
No autorizado: commits, push, cambios en Supabase, migraciones, despliegues ni corrección de defectos de negocio.

## Base
`INTRANSIT-GT/Master-App---OP-` @ `main` `1793036752e7926a806cd486b8e5f8b66b0802aa`. Los archivos de esta configuración están **sin commit**.

## Estado comprobado
- Preparados: `AGENTS.md`, `CLAUDE.md`, `docs/ai/*`, `scripts/intransit-startup.cjs`, `.claude/settings.json`, `.claude/skills/intransit-trazabilidad/`, `.gitignore`.
- Script del hook probado a mano con entradas sintéticas (ver TRASPASO).
- **Pendiente de prueba en el Claude de Carmen:** sesión nueva, `/context`, `/hooks`, reanudación/compactación, descubrimiento de la skill.

## Hallazgos heredados (revisión `1793036`, sin revalidar; no corregir sin encargo)
- Al editar Walmart de 1620 a 3240 unidades se conservan 85.26 cajas cobrables en vez de 170.53 (`server/src/services/records.ts`).
- Una semana cerrada (frozen) cambia su resultado al editar el precio de material (`server/src/services/reports.ts`, `server/src/routes/catalog.ts`).
- La prueba integrada usa un Transportes de relleno (`e2e/integrado/transportes-stub/`).

## Siguiente acción
Ing. Carmen abre una sesión nueva de Claude en esta carpeta y confirma el recibo de inicio.

## Bloqueos y decisiones
- Repositorio **público** con datos demo de productos y SAP (`docs/06` recomienda privado). Decisión de Ing. Carmen, 2026-10-25: se mantiene público por el momento.
- Supabase `bocgzjupocnvjehklxhs`: declarado **de prueba** por Ing. Carmen; Master App lo usa en su código. Confirmar si contiene datos reales (ver `SEGURIDAD.md`).
- El remoto no tiene `.gitignore`; se agregó uno local (sin commit).
- Faltan PostgreSQL 16 y Docker en el equipo: pruebas de servidor no ejecutadas aquí.
