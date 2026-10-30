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

## 2026-10-29 · Bloquear pagos anticipados en órdenes OPL

- La fecha de la transferencia no puede ser posterior a hoy: se valida en el formulario (máximo del selector), antes de pedir los archivos y en el servidor.
- La misma regla se aplica a los pagos directos a pilotos.
- **API v100**, **front/SW v1.2.7**.
- Nota: las órdenes ya registradas con fecha futura (OP-0010, OP-0014, OP-0015 y OP-0016) no se modifican automáticamente; son datos históricos/de prueba.

## 2026-10-29 · Scroll explícito en selección de viajes OPL

- La selección de viajes por pagar (`opTog`), limpiar y el filtro «Solo con tarifa OPL» usan un refresco que guarda y repone la posición de `#main` y de las tablas.
- **front/SW:** v1.2.8. Sin cambios de API.

## 2026-10-29 · Link de contrato editable en clientes

- El formulario de cliente incluye **Link del contrato** con validación de URL `http(s)` y máximo 300 caracteres; se guarda en el `extra` del cliente y se muestra en la columna «Link contrato».
- Si se escribe sin `https://`, se completa automáticamente con `https://`.
- **API v104**, **front/SW v1.2.9**.

## 2026-10-29 · Botón de actualización desde Supabase

- Se agregó un botón circular junto a la campana de notificaciones para volver a cargar el snapshot de Supabase.
- Mientras actualiza se deshabilita; al terminar conserva la pantalla y el scroll. Sirve para ver viajes u otros datos creados por otra persona después de abrir la página.
- **front/SW v1.3.0**. Sin cambios de API.

## 2026-10-29 · Asistente Comercial puede aplicar tarifas

- El permiso `tarifa_registrar` ahora está habilitado por defecto para **Asistente Comercial** y Gerencia Comercial.
- En **Usuarios y permisos → Permisos de acción por rol** aparece en el grupo **Tarifas** como **«Aplicar la tarifa vigente a los viajes»**.
- Se aplicó la migración `040_permiso_aplicar_tarifas.sql`.
- **API v108**, **front/SW v1.3.2**.

## 2026-10-29 · Restauración tras force-push

- El remoto fue reescrito con el commit «Torre control vista general» y eliminó cambios anteriores. Se restauraron: botón de actualización desde Supabase, conservación de scroll, bloqueo de fechas futuras, permiso de aplicación de tarifas para Asistente Comercial, retiro del módulo OC y link de contrato.
- Se conservó la nueva vista general de Torre y su PDF.
- **API v110**, **front/SW v1.3.3**.

## 2026-10-29 · Unificar Viajes y Liquidaciones

- Se retiró la entrada separada **Liquidaciones**; queda una sola pantalla **VIAJES Y LIQUIDACIONES** con pestañas por estado: Planificados, En ruta, Por liquidar, Por validar, Rechazados, Aceptados, Facturados, Cobrados y Todos.
- Las pestañas de liquidación reutilizan la tabla y las acciones de aprobar/devolver/liquidar; las demás usan la tabla operativa.
- Inicio muestra un solo acceso y el filtro de cliente/proyecto/fechas se comparte en toda la pantalla.
- **front/SW v1.3.5**. Sin cambios de API.

## 2026-10-30 · Evidencia de OC y evitar cargas después de confirmar

- Antes de subir la evidencia, el formulario consulta el estado actual de la agrupación. Si la OC ya está registrada, muestra el mensaje correcto y no intenta subir el archivo (Storage rechaza adjuntos posteriores a la confirmación).
- Se evita abrir «Registrar OC» sobre una agrupación ya confirmada.
- **front/SW v1.3.6**. Sin cambios de API.
 
## 2026-10-30 · Facturación después de la OC
- El panel de la agrupación muestra **Datos de factura** directamente cuando la OC ya está registrada y el perfil tiene `facturas_emitir`.
- Si el perfil no puede facturar, se indica que continúa Facturación.
- **front/SW v1.3.7**.

## 2026-10-30 · Validación de facturación sin rutas en el navegador
- El modal **Datos de factura** valida solo serie, número y fecha; ya no muestra falsos “ruta activa” cuando Facturación no recibe el catálogo de rutas.
- Ruta, tarifa y aceptación se validan al pulsar **Enviar a facturación**, en el servidor.
- **front/SW v1.3.8**; motor del API regenerado.

## 2026-10-30 · Formulario de viaje: orden y No. de viaje automático
- Cliente y datos del viaje reordenados: Proyecto/No. de Transporte, OPL/Tipo de viaje, Tipo de carga/Cantidad, Producto.
- **No. de viaje** movido a Unidad, después de la placa de arrastre; se calcula como consecutivo de todos los viajes de la unidad.
- El servidor asigna el consecutivo al crear el viaje; el formulario lo muestra al elegir la unidad.
- **front/SW v1.3.9**; API actualizado.

## 2026-10-30 · No. de viaje por unidad y día
- El No. de viaje ya no cuenta todo el histórico: cuenta los viajes de la unidad **en la fecha planificada** y suma el que se está registrando.
- Se recalcula al cambiar la unidad o la fecha; el servidor vuelve a asignarlo al crear el viaje.
- **front/SW v1.3.10**; API actualizado.



## 2026-10-30 · Capacidad según el equipo (arrastre o unidad)
- La capacidad de una ruta o viaje se calcula desde el **equipo de arrastre** cuando tiene capacidad registrada; si no hay arrastre, desde la **unidad** (furgón/camión).
- Un **cabezal sin arrastre** no tiene capacidad propia: la solicitud de ruta se rechaza hasta registrar/elegir el arrastre correcto.
- En el formulario de viaje, al elegir placa y arrastre, la capacidad se actualiza automáticamente y el campo de la nueva ruta es de solo lectura.
- En **Rutas → Solicitar ruta nueva** se pueden indicar la unidad y el arrastre de referencia; la capacidad se calcula igual y se valida en el servidor.
- La tarifa y los cálculos usan la misma regla (`capacidadEquipo`).
- **API desplegada**; **front/SW v1.4.5**.
- **Verificado:** un cabezal sin arrastre fue rechazado al solicitar una ruta nueva.

## 2026-10-30 · Capacidad de unidad y KM en la solicitud de ruta
- La solicitud de ruta nueva (desde Rutas y desde «NUEVA RUTA» en el viaje) pide **capacidad de la unidad** y **KM de la ruta**.
- Los datos se guardan en `rutas`, se muestran en el catálogo y se envían a Comercial para la tarifa.
- Al validar o registrar una ruta se revisan ambos datos; la tarifa parte de la capacidad indicada.
- **Migración aplicada:** `041_ruta_capacidad_km.sql` en `bocgzjupocnvjehklxhs`.
- **API desplegada** con el modelo y las validaciones; **front/SW v1.4.3**.
- **Verificado:** una solicitud con capacidad `22` y `12.5 km` se guardó y se validó con `15.5 km`; una solicitud sin capacidad se rechazó.

## 2026-10-30 · Refactor modular del motor, formulario y API
- `fieldsHTML()` dividido en `formCtx`, `clienteFieldsHTML`, `planFieldsHTML`, `unidadFieldsHTML`, `rutaFieldsHTML`, `tiemposFieldsHTML` y `gastosFieldsHTML`.
- `js/engine.js` conserva la base; `js/engine/permisos.js` contiene permisos, roles, secciones y campos base; los 90 métodos de `API` viven en `js/engine/api-sesion.js`, `api-snapshot.js`, `api-viajes.js`, `api-comercial.js`, `api-finanzas.js` y `api-admin.js`.
- El handler del API se separó en `snapshot.mjs` (lectura/snapshot), `read.mjs` (ventana y conteos) y `ops.mjs` (registro de operaciones).
- Se agregó `npm run check:core` y el workflow `.github/workflows/check-core.yml` para detectar desalineación entre `js/engine.js` y `core.mjs`.
- Grafo Graphify regenerado con PostgreSQL: 1,743 nodos, 2,580 relaciones y 428 nodos/629 relaciones del esquema real.
- **front/SW v1.4.0**.
## 2026-10-30 · Alerta de liquidación fuera de tiempo
- Se agrega una alerta calculada (sin migración) para los viajes cuya semana planificada ya venció: el plazo termina el **lunes siguiente a las 23:59**, hora local.
- Cuenta como pendiente mientras el viaje esté en `PLANIFICADO`, `EN_RUTA`, `ENTREGADO` o `RECHAZADO`; deja de alertar cuando se envía la liquidación (`LIQUIDADO`) o pasa a un estado posterior.
- **Comentario del usuario:** los viajes no duran más de 2 días en terminar y la mayoría dura un día; por eso también se alertan los viajes planificados y en ruta, no solo los entregados o rechazados.
- Inicio muestra el cuadro **Viajes fuera de tiempo**; Viajes y liquidaciones agrega la pestaña **Fuera de tiempo**, ordena primero los más atrasados, marca la fila y muestra el atraso en el detalle.
- **Front/SW v1.4.6**. Sin cambios de API ni de base de datos.
## 2026-10-30 · Solicitud de ruta separada de la capacidad
- La solicitud de ruta ya no pide **unidad de referencia**, **equipo de arrastre** ni una capacidad calculada: esos datos no definen la ruta y la capacidad es exclusiva de la **tarifa**.
- **Origen y destino** son obligatorios y aparecen antes de los datos de kilometraje. La capacidad se elige al crear la tarifa; si la ruta no la trae, el campo queda vacío para seleccionarla.
- La creación de la ruta pendiente desde un viaje tampoco exige capacidad: conserva la referencia y los KM.
- **Dato de prueba:** se agregó `ARR-0029` a `master.flota` con capacidad temporal **40** y `tipo` RAS S. Reemplazar cuando se cargue la flota real.
- **Migración aplicada:** `supabase/migrations/042_capacidad_arrastre_prueba.sql`. **API desplegada.** **Front/SW v1.4.7**.
- **Verificado:** una solicitud con origen/destino y sin capacidad se crea con capacidad vacía; una solicitud sin origen se rechaza; la validación de ruta sin capacidad funciona.
## 2026-10-30 · Tarifas para varias capacidades
- La creación de tarifa ahora muestra las capacidades como **casillas**: se puede marcar una o varias y se crea la misma tarifa (mismo importe, OPL, combustible y vigencia) por cada capacidad seleccionada.
- Solo cambia el **ID de tarifa** y la **capacidad**; el servidor valida todas las capacidades primero y no crea ninguna si una ya existe o se cruza la vigencia.
- **API desplegada:** incluye `crearTarifas` en `ops.mjs` y en el motor. **Front/SW v1.4.8**.
- **Verificado:** se crearon dos tarifas para capacidades `22` y `28` con el mismo importe; un segundo intento fue rechazado como duplicado. Las tarifas de prueba se eliminaron.
## 2026-10-30 · Se retira temporalmente la tarifa multicapacidad
- Se quitó el checkbox de varias capacidades de **Nueva tarifa**: vuelve el selector de **una sola capacidad** y cada tarifa conserva su propio importe.
- Motivo: el mismo importe para varias capacidades no es correcto cuando el precio depende de la capacidad; se evaluará más adelante con importes independientes por capacidad.
- **Front/SW v1.4.9**. La operación `crearTarifas` queda sin uso en la interfaz para no romper sesiones con caché anterior; la creación normal usa `crearTarifa`.
## 2026-10-30 · Equipos de arrastre desde Fleetio (Tools / Equipment)
- `sync-flota` ahora consulta también `/equipment` de Fleetio y carga los **Tools** como equipos de arrastre en `master.flota`: Furgón, Remolque, Semi Remolque, Dolly Trailer y Plataforma. Excluye `Cabezal` para no duplicar vehículos.
- La capacidad se toma de `custom_fields.cap_medida` (por ejemplo `RASTRA 24`) y, si falta, del modelo cuando expresa toneladas. Se cargan los 96 equipos y aparecen capacidades adicionales como `20`, `24`, `48` y `53`.
- El equipo conserva la placa/nombre de Fleetio, tipo, estado, propietario y **vehículo vinculado**. La pestaña **FLEETIO** muestra la lista de equipos y el detalle del vínculo; las rutas pueden usar estos equipos como arrastre.
- **Limitación de Fleetio:** la API no expone `service_entries` ni `expense_entries` por equipo (`/equipment/{id}/service_entries` responde 404). Los mantenimientos y gastos siguen llegando por `vehicle_id`; el vehículo vinculado del equipo es el que permite relacionarlos.
- **sync-flota y API desplegadas.** **Front/SW v1.5.0**.
- **Verificado:** sincronización con 49 vehículos, 96 equipos, 98 mantenimientos y 1,864 gastos; una tarifa con capacidad `24` fue aceptada.
## 2026-10-30 · Equipos de arrastre solo lectura desde Fleetio
- Catálogos → **Equipos de arrastre** ya no muestra la lista editable de `catalogos.arrastre`: se alimenta de los **Tools/Equipment sincronizados de Fleetio** (`FLOTA` con `extra.esEquipo=true`).
- Se quitó el botón **Editar** de esa lista y el servidor rechaza `guardarCatalogo` para `arrastre`; la fuente de verdad es Fleetio.
- La lista de arrastres del formulario de viaje usa únicamente esos equipos de Fleetio; los códigos históricos que no estén en Fleetio no se ofrecen para viajes nuevos (si un viaje antiguo los tiene, se conserva su valor al editar).
- **Front/SW v1.5.1; API desplegada.**
