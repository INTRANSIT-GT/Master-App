# Despliegues · Master App (Transportes)

Registro de lo que se aplica **fuera del repositorio** (base de datos Supabase y Edge Functions).
El código vive en GitHub; aquí se anota qué se ejecutó en el entorno y cuándo, para no confundir
«código publicado» con «cambio activo».

## 2026-10-28 · Órdenes de compra (OC)

- **Migración aplicada:** `supabase/migrations/034_ordenes_compra.sql` en el proyecto Supabase
  `bocgzjupocnvjehklxhs`, esquema `master`.
  - Crea `master.ordenes_compra` (con índices, disparadores de congelamiento/unicidad y RLS).
  - Siembra los permisos `oc_*` y la sección `sec_oc` para los 11 perfiles.
  - Registra las prohibiciones de separación de funciones en `master.permisos_prohibidos`.
  - Añade la rama `oc/` a `app.puede_subir` y `app.puede_ver_archivo`.
- **API desplegada:** función `api`, versión **88** (2026-10-28 18:08 UTC).
- **Front publicado:** service worker **v1.0.94** (GitHub Pages).
- **Motivo:** la sección OC no se podía asignar desde «Usuarios y permisos». El API anterior no
  reconocía `oc` ni `oc_ver` («Sección no válida» / «Permiso no válido») y la migración no estaba
  aplicada, así que la casilla no guardaba para ningún perfil, incluido el Administrador.
- **Efecto:** Administrador, Gerencia Comercial y Analista Comercial tienen OC completo; Facturación
  solo consulta; Torre, Operativo, Validador y Pago OPL quedan bloqueados por separación de funciones.
  Gerencia de Transporte, Cobros y Proyectos pueden recibir solo lectura desde la matriz.
- **Dónde se asigna:** «Usuarios y permisos → Módulos y secciones → COMERCIAL → Órdenes de compra».
  Es una pestaña dentro de Comercial, no un módulo aparte del menú.
- **Verificado:** `sec_oc` activo para ADMIN, Gerencia Comercial, Analista Comercial y Facturación;
  alternar `sec_oc` y `oc_ver` en Gerencia de Transporte funciona (se revirtió); `oc_preparar` sigue
  prohibido para ese rol; el snapshot devuelve 781 permisos y la lista `ordenesCompra`.

## 2026-10-28 · Flujo comercial: confirmación del cliente y cobro (035)

- **Migración aplicada:** `supabase/migrations/035_agrupaciones_flujo.sql` (después de la 034).
  - Nuevo permiso `comercial_confirmar` (Administrador, Gerencia Comercial y Analista Comercial).
  - Gerencia y Analista Comercial pueden agrupar; Facturación deja de agrupar/preparar y pasa a **registrar cobros** (`cobros_registrar`).
  - Apartados de menú `sec_analista` y `sec_factcom` dentro de COMERCIAL.
  - Nuevas ramas de almacenamiento en `facturas/` (reportes interno/cliente, autorización, cobro) en `app.puede_subir` y `app.puede_ver_archivo`.
- **API desplegada:** función `api`, versión **89** (2026-10-28 22:57 UTC).
- **Front publicado:** service worker **v1.0.97**.
- **Efecto:** el flujo queda Comercial prepara y confirma con el cliente → Facturación valida/emite y cobra. Los permisos y apartados nuevos ya se pueden asignar desde la matriz.
- **Verificado:** migración aplicada sin errores; API responde con las nuevas secciones; snapshot incluye los permisos nuevos.

## Cómo anotar

Una sección por despliegue, con fecha, migración/función, versión, motivo y verificación.
Sin datos de clientes, rutas privadas ni secretos: el repositorio es público.
