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

## 2026-10-28 · OT del cliente y salida del perfil Cobros (036)

- **Migración aplicada:** `supabase/migrations/036_ot_y_cobros.sql`.
  - Nuevo permiso `comercial_ot` (Asistente Comercial, Gerencia Comercial y Administrador); reemplaza a `comercial_confirmar`.
  - El perfil **Cobros desaparece**: sus usuarios pasan a Facturación y sus filas de permisos se retiran.
  - Facturación conserva `cobros_registrar` y no puede agrupar ni registrar la OT.
- **API desplegada:** función `api`, versión **90**.
- **Front publicado:** service worker **v1.0.98**.
- **Flujo:** el Asistente Comercial agrupa los viajes, genera el reporte y registra el número de OT con su evidencia. Facturación recibe la agrupación con OT, registra serie/número/fecha, sube la foto de la factura, la envía y valida el cobro (monto, fecha y referencia).
- **Verificado:** motor de punta a punta (agrupar → OT → datos de factura → envío → emisión con foto → cobro), permisos cruzados (Facturación no registra OT; Asistente no factura) y matriz sin el perfil Cobros.
- **Migración 037 aplicada:** las políticas de Storage (`app.puede_subir` y `app.puede_ver_archivo`) ahora usan `comercial_ot`; sin esto el Asistente no podía subir la evidencia de la OT.

## 2026-10-28 · Una sola pantalla de Facturación (038)

- **Migración aplicada:** `038_consolidar_facturacion.sql`; Gerencia Comercial recibe acceso a la pantalla nueva de Facturación.
- **Menú:** se retira la sección vieja «Facturación» (`comercial`); quedan **Asistente Comercial** (agrupa, reporte y OT) y **Facturación** (factura y cobro). Ya no hay tres accesos parecidos.
- **OT visible:** en la lista del Asistente aparece el botón directo **Registrar OT** cuando el reporte y la evidencia ya están cargados.
- **API desplegada:** versión **93**; **front v1.1.4** (no se agrupa un viaje sin tarifa; los viajes de una agrupación preparada sin reporte/OT aparecen en Tarifas para corregir; «Pendientes de gestión» solo muestra libres y la lista conserva el scroll).

## Cómo anotar

Una sección por despliegue, con fecha, migración/función, versión, motivo y verificación.
Sin datos de clientes, rutas privadas ni secretos: el repositorio es público.

## 2026-10-29 · Retiro del módulo OC y renombre OT → OC

- **Migración aplicada:** `supabase/migrations/039_retirar_oc.sql`.
  - Se desactivan `oc_ver`, `oc_preparar`, `oc_enviar`, `oc_responder`, `oc_corregir` y `sec_oc`.
  - Se conserva el historial de `master.ordenes_compra` y el permiso interno `oc_ver_combustible`, que también controla el desglose de combustible en los reportes de agrupación.
- **Interfaz:** se retira la pestaña/módulo «Órdenes de compra» de Comercial (menú, matriz, historiales y carga de `js/modulos/oc.js`). El flujo que antes se llamaba **OT** ahora se muestra como **OC** en toda la interfaz (botones, avisos, estados e historial); las claves internas (`comercial_ot`, `g.confirmacion.ot`) se conservan para no migrar datos.
- **Tarifas:** el botón de tarifas pendientes aplica solo los viajes realmente disponibles (no todos los aceptados) y distingue los que necesitan completar el importe OPL; se agregó el acceso «Completar tarifa» al caso concreto.
- **API desplegada:** versión **94**.
- **Front publicado:** service worker **v1.2.0**.
- **Datos de prueba:** `OC-0001` quedó anulada; los viajes `200042`/`200043` quedaron libres. `TAR-3113` completó su importe OPL y el viaje `102901` quedó aplicado.
