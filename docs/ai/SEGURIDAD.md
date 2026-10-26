# SEGURIDAD · Transportes (Master App)

Sin claves, prefijos de claves ni datos de clientes. Solo resultados sanitizados.

## Proyecto y límites autorizados
- Supabase: `bocgzjupocnvjehklxhs` (us-east-1), el único host de Supabase encontrado en el código. **Entorno: prueba**, según Ing. Carmen (2026-10-25).
- ⚠️ Si esta aplicación se usa en operación con ese proyecto, contiene datos reales: **confirmar con Ing. Carmen** antes de cualquier prueba de escritura.
- Ningún cambio en Supabase, permisos, esquema, Storage, Edge Functions o datos está autorizado.

## Tipos de credencial
- **Publishable / anon:** puede ir al navegador (esta app es PWA estática); no reemplaza autenticación, permisos ni RLS.
- **Service role / secret / contraseña de PostgreSQL:** solo en Edge Functions o servidor. Nunca en `js/`, `index.html`, el repositorio, los hooks ni la documentación. Omite RLS.
- **PAT o credenciales administrativas:** no se necesitan para leer código público.

## Verificaciones (2026-10-25)

| Verificación | Resultado |
|---|---|
| Supabase CLI 2.122.0 autenticada | OK: 1 proyecto visible |
| CLI vinculada en este clon | NO verificado por la CLI; existe `supabase/.temp/linked-project.json` versionado |
| Visibilidad del repositorio | **Público** (decisión: se mantiene por el momento) |
| `.claude/settings.local.json`, `.claude/privado/` en `.gitignore` | OK (sin commit) |
| `.env` en `.gitignore` | **NO**: el `.gitignore` actual no lo incluye. Pendiente de decisión antes de introducir claves |
| Hook de inicio lee secretos o Excel | NO: lee AGENTS, CLAUDE, ESTADO, TRASPASO y git, más el operador y el final de la bitácora en `.claude/privado` |

## Matriz de acceso esperada (todo NO VERIFICADO)
Probar solo en aislamiento (PGlite) o en un entorno de prueba autorizado, sin datos productivos:
sin sesión · `authenticated` sin perfil de Transportes · perfil con permisos `sec_*` limitados · perfil suspendido · cliente o proyecto ajeno · REST directo a tablas y vistas · Storage (bucket de manuales) · administrador.
Hallazgo heredado a revalidar: lectura de pilotos sin perfil (`supabase/migrations/002_seguridad_rls.sql:64`).

## Inventario pendiente
RLS de tablas y vistas (`002`, `023`) · Storage (`003`, `031`) · funciones `SECURITY DEFINER` y grants · `app_metadata.modulos` (`033_acceso_modulos_secciones.sql`) · Edge Functions (`supabase/functions/api`, `sync-flota`) · exposición de esquemas en `supabase/config.toml`.
