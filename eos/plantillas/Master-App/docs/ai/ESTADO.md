# ESTADO · Transportes (Master App)

Actualizado: 2026-10-25 · Claude Code (extensión VS Code 2.1.310, Windows 11)

## Objetivo autorizado
Preparar la configuración local de Claude según el paquete de inicio v1.0. Autorizado por Ing. Carmen el 2026-10-25: clonar OP y Master App, preparar reglas, hook, estado y skill.
No autorizado: commits, push, cambios en Supabase, migraciones, despliegues ni corrección de defectos de negocio.

## Base
`INTRANSIT-GT/Master-App` @ `main` `a09bacbe2f9f778aa0b7f9127787a2d84a64b15b`. Los archivos de esta configuración están **sin commit**.

## Estado comprobado
- Preparados: `AGENTS.md`, `CLAUDE.md`, `docs/ai/*`, `scripts/intransit-startup.cjs`, `.claude/settings.json`, `.claude/skills/intransit-trazabilidad/`, entradas nuevas en `.gitignore`.
- Script del hook probado a mano con entradas sintéticas (ver TRASPASO).
- **Pendiente de prueba en el Claude de Carmen:** sesión nueva, `/context`, `/hooks`, reanudación/compactación, descubrimiento de la skill.

## Hallazgos heredados (revisión `a09bacb`, sin revalidar; no corregir sin encargo)
- Cambiar piloto devuelve «v is not defined» (`js/engine.js:929` y motor generado).
- Un usuario `authenticated` sin perfil de Transportes puede leer pilotos según la política local examinada (`supabase/migrations/002_seguridad_rls.sql:64`). Exposición REST productiva no comprobada.
- De 23 scripts de prueba: 1 pasa, 1 termina con aserciones fallidas y 21 caen; hay fixtures y contratos atrasados. Las 24 migraciones aplican en PGlite.

## Siguiente acción
Ing. Carmen abre una sesión nueva de Claude en esta carpeta y confirma el recibo de inicio.

## Bloqueos y decisiones
- Repositorio **público**. Decisión de Ing. Carmen, 2026-10-25: se mantiene público por el momento.
- El código usa Supabase `bocgzjupocnvjehklxhs`, declarado **de prueba** por Ing. Carmen. Confirmar si Transportes opera con datos reales en él (ver `SEGURIDAD.md`).
- `supabase/.temp/` (incluye `linked-project.json`) está versionado; normalmente se ignora. Sin cambios: requiere decisión.
- Dependencias de prueba (`npm install`) no instaladas en este clon.
