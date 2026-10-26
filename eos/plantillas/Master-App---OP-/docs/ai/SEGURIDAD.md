# SEGURIDAD · OP (Operaciones)

Sin claves, prefijos de claves ni datos de clientes. Solo resultados sanitizados.

## Proyecto y límites autorizados
- Supabase: `bocgzjupocnvjehklxhs` (us-east-1). **Entorno: prueba**, según Ing. Carmen (2026-10-25).
- ⚠️ Master App usa este mismo proyecto en su código. Si Transportes se usa en operación, este proyecto contiene datos reales: **confirmar con Ing. Carmen** antes de cualquier prueba de escritura.
- Ningún cambio en Supabase, permisos, esquema, Storage o datos está autorizado.

## Tipos de credencial
- **Publishable / anon:** puede ir al navegador; no reemplaza autenticación, permisos ni RLS.
- **Service role / secret / contraseña de PostgreSQL:** solo en el servidor. Nunca en el frontend, el repositorio, los hooks ni la documentación. Omite RLS, así que no sirve para probar permisos de un usuario normal.
- **PAT o credenciales administrativas:** no se necesitan para leer código público.
- Las credenciales se cargan en `.env` local (ignorado por Git) o en el gestor de secretos del servidor, nunca por el chat ni como argumento de un comando.

## Verificaciones (2026-10-25)

| Verificación | Resultado |
|---|---|
| Supabase CLI 2.122.0 autenticada (`supabase projects list`) | OK: 1 proyecto visible |
| CLI vinculada a un proyecto | NO: sin `supabase link` |
| Visibilidad del repositorio | **Público** (decisión: se mantiene por el momento) |
| `.env`, `*.key`, `*.pem`, `.claude/settings.local.json`, `.claude/privado/` en `.gitignore` | OK, en el `.gitignore` local (sin commit) |
| Hook de inicio lee secretos o Excel | NO: lee AGENTS, CLAUDE, ESTADO, TRASPASO y git, más el operador y el final de la bitácora en `.claude/privado` |

## Matriz de acceso esperada (todo NO VERIFICADO)
Probar solo en aislamiento o en un entorno de prueba autorizado, sin datos productivos:
sin sesión · autenticado sin módulo `operaciones` · módulo con rol limitado (`consulta`, `operador`) · perfil suspendido · cliente o proyecto ajeno · lectura/escritura directa a la API · acceso a archivos · `administrador`.
Una denegación debe ser explícita y no revelar datos.

## Inventario pendiente
Auth/JWT (`server/src/sso.ts`) · `app_metadata.modulos` y roles (`deploy/supabase/asignar-modulos.sql`, funciones `SECURITY DEFINER`) · roles internos de OP (`server/src/permissions.ts`) · separación navegador/servidor · CSP y CORS (`server/src/app.ts`).
