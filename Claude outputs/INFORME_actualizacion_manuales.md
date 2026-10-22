# Informe · Actualización de manuales de la Master App de Transportes
Versión de los manuales: 2.0 · 22 de octubre de 2026 · Estado: **borrador para tu revisión** (nada se integró al Centro de ayuda, nada se publicó).

## 1. Cómo se hizo la revisión
- Se leyeron completos los 8 PDF originales (versión 1.0, octubre 2026).
- Se inspeccionó el código del repositorio (`js/engine.js`, `js/ui.js`, `js/modulos/*`) y las migraciones SQL 017, 018, 019 y 024 (matriz de permisos por rol).
- Se reconstruyó la matriz de permisos **por defecto** de cada rol desde las migraciones y se contrastó con el código (`PERM_DEFAULT` y `PROHIBIDO`).
- Se ejecutó la interfaz real del repositorio en modo demostración (datos de ejemplo, sin Supabase) y se comprobó que el **menú de cada rol coincide** con lo documentado. Las capturas de los manuales salen de ahí y están rotuladas como "modo demostración".
- **No se tocó** el código, Supabase, migraciones, permisos ni los PDF originales. No hubo commit, push ni despliegue.
- Limitación importante: **no se pudo consultar la aplicación de producción** (requiere iniciar sesión y la red hacia Supabase está bloqueada desde este entorno). Por eso los permisos descritos son los **valores por defecto**; la Administradora puede haberlos cambiado.

## 2. Relación de cada manual con el perfil real
| Manual nuevo | Perfil | Rol interno (código) | Cambio de asignación |
|---|---|---|---|
| 01 Administradora | Administradora | ADMIN | Sin cambio |
| 02 Encargado de proyecto | Proyectos (revisa y atiende las solicitudes de Ayuda) | PROYECTOS | **Cambia**: antes describía a quien crea y liquida viajes |
| 02B Operativo | Operativo (crea y mueve los viajes) | OPERATIVO (antes ENCARGADO) | Absorbe el contenido útil del antiguo 02 |
| 03 Torre de Control | Torre de control | TORRE | Sin cambio de rol; funciones corregidas |
| 04 Revisión de liquidaciones | Validador | VALIDADOR (antes LIQUIDACIONES) | Correspondencia confirmada (migración 017) |
| 05 Facturación | Facturación | FACTURACION (antes COMERCIAL) | La clave impresa COMERCIAL era el nombre antiguo |
| 06 Gerencia Comercial | Gerencia Comercial | GERENTE_COMERCIAL | Nombre de rol corregido |
| 08 Gerencia de Transporte | Gerente de Transporte | GERENTE_TRANSPORTE | Nombre de rol corregido |
| 00 Manual general | — | — | **Pendiente** (no existe entre los archivos) |
| 07 | — | — | **Pendiente** (la numeración salta de 06 a 08) |

## 3. Resumen de cambios por documento
- **01 Administradora:** menú agrupado por módulos (Viajes, Torre, Comercial, OPL, Flotas, Administración); nuevas tareas: Lugares y listas del sistema, autorizar a Torre por cliente, gestionar reportes de Ayuda, reglas de usuarios; retirada la afirmación de "cargar flota y pilotos" (la interfaz solo los muestra en consulta); campo "Cliente asignado obligatorio" ahora aplica al rol Operativo.
- **02 Encargado de proyecto:** reescrito por completo para el rol PROYECTOS (consulta de todos los módulos y atención de Ayuda: Pendiente → En revisión → Resuelto).
- **02B Operativo:** reescrito sobre el código vigente: Placa antes que Piloto, SIN RUTA, Desvío con horarios de descarga, Gastos adicionales (Parqueo, Alimentación, Peaje, Otro), corrección de horarios, liquidación y rechazos; se conservaron la rutina diaria, la evidencia y los motivos de rechazo.
- **03 Torre de Control:** corregida la afirmación "Editar datos, fechas u horas: Nunca": ahora documenta que **sí edita fechas y horarios** de clientes autorizados y viajes no facturados; vistas "Viajes y estado" y "Horarios y fechas"; el menú de Torre no incluye "Todos los viajes".
- **04 Revisión de liquidaciones:** rol VALIDADOR confirmado; menú real (Viajes y Liquidaciones); botones actuales (APROBAR LIQUIDACIÓN, REQUIERE CORRECCIÓN, Aceptar, Rechazar); pestaña "Por validar".
- **05 Facturación:** corregido el perfil; **eliminadas** funciones que el perfil no tiene por defecto (crear tarifas, solicitar/validar rutas, ver Rutas); la **Serie de factura** es obligatoria para enviar; botones "Marcar emitida", "Ver evidencia"; el título de la pantalla es "COMERCIAL".
- **06 Gerencia Comercial:** menú real (Clientes, Tarifas, Rutas, OPL); **sí administra clientes** (v1.0 decía "Nunca"); validar/rechazar rutas, código automático, creación de tarifas con campos y reglas, autorización de Torre.
- **08 Gerencia de Transporte:** menú real (incluye Nuevo viaje, Todos los viajes, OPL y Finanzas en consulta); puede crear viajes y validar/rechazar rutas; "Aprobar DUP"; aclarado que **no** acepta liquidaciones.

## 4. Estado de las funciones revisadas
| Función | Estado | Observación |
|---|---|---|
| Creación y consulta de viajes | Implementada | Campos obligatorios: Proyecto, Fecha y hora plan, Placa, Piloto, Ruta |
| Placa, unidad y piloto | Implementada | Placa primero; la unidad sale de la placa/piloto; aviso "Piloto no asignado a unidad" |
| Rutas, orígenes, destinos y lugares | Implementada | Catálogo Lugares (migración 029); **no verificado** que esté aplicado/poblado en producción |
| Desvíos | Implementada | Solo al crear el viaje; horarios de descarga del desvío |
| SIN RUTA | Implementada | Aviso a Gerencia Comercial y de Transporte |
| Gastos adicionales | Implementada | Concepto en lista (Parqueo, Alimentación, Peaje, Otro) |
| Torre: horarios y estados | Implementada | Depende de que el cliente esté autorizado (dato de producción no verificado) |
| Liquidaciones (enviar, aceptar, rechazar) | Implementada | |
| Facturación y validaciones | Implementada | Envío exige serie, número, fecha, ruta activa y tarifa |
| Gerencias | Implementada | Permiso "asignar unidades y pilotos" sin pantalla asociada |
| Admin de clientes, usuarios, permisos y catálogos | Parcial | No se encontró formulario para crear/editar pilotos y flota |
| Reportes de Ayuda | Implementada en código | Migraciones 027/028 sin verificar en producción |

## 5. Funciones o permisos que no se pudieron verificar
1. La matriz de permisos real de producción (solo se verificó el valor por defecto).
2. Qué clientes tienen hoy `torre_estatus` activo.
3. Si las migraciones 027, 028 y 029 están aplicadas en producción.
4. Si las reglas también están protegidas en la base de datos (RLS) y no solo en la aplicación.
5. Alta de pilotos y unidades (¿desde dónde se alimentan: base de datos o Fleetio?); pestaña FLEETIO.
6. Reasignación de contraseñas desde pantalla (modo Supabase).
7. Módulos OPL · Proveedores y Finanzas (órdenes de pago, transferencias, pagos a pilotos): no están documentados a detalle en ningún manual.
8. Capturas de **producción** (se usaron capturas en modo demostración).
9. Comportamiento en teléfono (se probó solo en escritorio).

Observaciones del código (no se corrigieron, solo se anotan): el mensaje de error de Torre menciona fijos "Coca-Cola y Frito Lay"; el rol Proyectos tiene activo por defecto "administrar clientes" aunque se describe como solo consulta; el texto del perfil Gerente de Transporte dice "autorizar/crear tarifas OPL" pero por defecto solo puede crear; los permisos "asignar unidades y pilotos" y varios de OPL no tienen función asociada en el código.

## 6. Decisiones que necesito de ti
1. **¿"Encargado de proyecto" = rol Proyectos?** Lo asigné así porque es quien atiende los reportes de Ayuda. Si en realidad es otro rol, hay que rehacer el manual 02.
2. **02 y 02B:** recomiendo **mantenerlos separados** (son perfiles distintos: Proyectos revisa; Operativo crea y liquida). El contenido del antiguo 02 se fusionó en 02B. ¿Apruebas?
3. **Facturación:** el manual 05 original le atribuía Rutas y Tarifas. Hoy el sistema no se lo permite. ¿Documentamos lo real (como está ahora) o prefieres cambiar los permisos?
4. **Gerencia Comercial** administra clientes por defecto. ¿Es lo que quieres?
5. **Proyectos** puede crear/editar clientes y autorizar Torre por defecto. ¿Es intencional?
6. **Manual 00:** recomiendo crearlo (todos los manuales lo citan): modelo de datos, estados, roles y glosario. ¿Lo hago?
7. **Número 07:** ¿a qué perfil estaba reservado? Mi sugerencia: Cobros / Contabilidad.
8. **Capturas:** ¿te sirven las de modo demostración o prefieres que alguien tome capturas de producción?
9. ¿Quitamos la marca "Borrador" cuando los apruebes?

## 7. Perfiles sin documentación suficiente
| Perfil (rol) | Recomendación |
|---|---|
| Analista Comercial (ANALISTA_COMERCIAL) | Manual **corto independiente** o apartado dentro de Gerencia Comercial (comparten Clientes, Tarifas y validar rutas; no aprueba) |
| Cobros / Contabilidad (COBROS) | Manual **independiente** (cobros y finanzas) |
| Pago OPL (PAGO_OPL) | Manual **independiente** pequeño (módulo OPL y órdenes de pago) |
| Módulos OPL y Finanzas | Documentar en el Manual 00 o en los manuales de Cobros y Pago OPL |

## 8. Archivos entregados
`Manuales_actualizados_v2.0/`: 8 PDF `MasterApp-XX-…_v2.0.pdf`, este informe, y `fuentes_editables/` (HTML editables con sus imágenes y el script de generación). Los PDF originales no se tocaron.
