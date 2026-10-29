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
- **API desplegada:** versión **95**.
- **Front publicado:** service worker **v1.2.0**.
- **Datos de prueba:** `OC-0001` quedó anulada; los viajes `200042`/`200043` quedaron libres. `TAR-3113` completó su importe OPL (Q2,000) y el viaje `102901` quedó aplicado (cliente Q3,121.36 · OPL Q2,274.34). Si una tarifa no tiene OPL, la aplicación ya no la reporta como aplicada: pide completarla.

## 2026-10-29 · Ajuste de la tabla comercial

- Se retiraron los botones **Historial** e **Importes** de la tabla de facturación y del panel de la agrupación; los importes siguen consultándose desde **Ver viajes**.
- La vista comercial y Tarifas usan un ancho máximo de **1900 px** en escritorio, y la tabla principal reduce su ancho mínimo para aprovechar mejor la ventana.
- **API:** sin cambios (v95). **Front/SW:** v1.2.1.

## 2026-10-29 · Registrar OC con su evidencia en un solo paso

- El botón **Registrar OC** abre un único formulario con el número de OC y el archivo de evidencia; ya no hay que adjuntar la evidencia en un paso previo.
- Si el reporte ya tiene evidencia vigente, el archivo es opcional; si no, es obligatorio. El botón aparece con solo tener el PDF del cliente vigente y no rechazado.
- **API:** sin cambios. **Front/SW:** v1.2.2.

## 2026-10-29 · PDF de orden de pago OPL con el formato de OC

- El PDF que se adjunta al emitir una orden de pago a proveedor (OPL) usa el mismo diseño que los PDF de OC: logo, encabezado, tabla con encabezado azul, total y pie de página.
- Columnas del documento OPL: **Cliente, Shipment, Placa, Ruta y Tarifa**; se conserva el proveedor, la fecha, el total y el número de orden en el encabezado.
- **API:** sin cambios. **Front/SW:** v1.2.4.

## 2026-10-29 · Conservar el scroll en todas las listas

- `render()` conserva ahora la posición vertical y horizontal de todas las tablas (`.xlwrap` y `.pmwrap`) cuando se vuelve a dibujar la misma pantalla.
- Aplica a selecciones de viajes, OPL, permisos y cualquier lista que se refresque al marcar, filtrar o cambiar datos; ya no vuelve al principio.
- **API:** sin cambios. **Front/SW:** v1.2.5.

## 2026-10-29 · Corregir Supabase Preview (migración 030)

- La migración `030_origen_destino_texto.sql` ahora es idempotente: detecta si `master.lugares` y las columnas `lugar_*` existen antes de consultarlas.
- Si la vista previa de Supabase reejecuta la migración después de que 029 ya eliminó `master.lugares`, conserva el texto viejo y no falla.
- No cambia el esquema de producción ya migrado.

## 2026-10-29 · Datos completos en el PDF de órdenes OPL

- La orden de pago guarda ahora una copia congelada por viaje: **cliente, Shipment, placa, ruta y tarifa**. El PDF ya no depende de que esos viajes estén en la ventana cargada de `DB.trips`.
- Las 14 órdenes existentes se rellenaron con esos datos desde la base.
- **Ver documento** genera el PDF desde la orden actual; así las órdenes históricas también muestran la información. El documento adjunto de las órdenes nuevas se genera con los mismos datos.
- **API v98**, **front/SW v1.2.6**.
