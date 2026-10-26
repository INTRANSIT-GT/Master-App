# Plantillas de carga — Master App (In Transit)

Paquete para cargar la **información real** y dejar la app lista para operar.
Los encabezados de cada hoja son los nombres exactos de las columnas de `master.*`.

## Archivos

| Archivo | Para qué |
|---|---|
| `Plantillas_Master.xlsx` | Un libro con **una hoja por tabla** (20 hojas de datos) + `catalogos` (listas) + `Instrucciones` + `Diccionario`. |
| `cargar_plantillas.py` | Valida y carga el libro en `master.*` (todo o nada). |
| `Cargar_Plantillas.bat` | Atajo para ejecutar el cargador en Windows. |

- **Fila 1**: encabezados (no los cambies ni los muevas).
- **Fila 2**: ejemplo (comentario «Fila de EJEMPLO»); el cargador **la ignora**.
- **Fila 3 en adelante**: tus datos.

## Cómo se usa

Abre una consola en esta carpeta (o usa `Cargar_Plantillas.bat`).

```bat
:: 1) Ensayo: inserta todo y REVIERTE. No escribe nada.
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" cargar_plantillas.py --simular

:: 2) Carga real (si el paso 1 terminó con 0 errores)
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" cargar_plantillas.py --aplicar

:: 3) Empezar de cero con los datos reales: borra los datos de negocio y carga el libro
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" cargar_plantillas.py --reemplazar --simular
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" cargar_plantillas.py --reemplazar --aplicar --si-reemplazar

:: 4) Probar el libro completo con la fila de ejemplo (revierte)
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" cargar_plantillas.py --probar

:: 5) Una sola tabla
"%LOCALAPPDATA%\Programs\Python\Python312\python.exe" cargar_plantillas.py --tabla viajes --simular
```

Si el archivo de conexión no está en la ruta habitual, define la variable `DATABASE_URL` con la cadena de conexión de Postgres.

## Qué hace `--reemplazar`

Borra **solo los datos de negocio** (37 000+ filas en el entorno de pruebas) y deja la app limpia para los datos reales:

- **Borra**: clientes y su ficha fiscal, flota, pilotos, rutas, tarifas, MEM, proveedores, viajes y sus importes/costos/viáticos, liquidaciones, facturas, pagos, órdenes de pago, accesos cliente, gastos, mantenimientos, evidencias, notificaciones y la tabla vieja `destinos`.
- **Conserva**: usuarios (`perfiles`), permisos, listas (`catalogos`), configuración y la auditoría.
- Antes de borrar, con `--aplicar` guarda un respaldo JSONL por tabla en
  la carpeta `_datos/respaldos/antes_de_carga_<fecha>` (o la que indique `RESPALDOS_DIR`).
- Todo ocurre en **una sola transacción**: si falla algo, no se borra ni se carga nada.

Después del reemplazo hay que volver a cargar `mem`, `gastos` y `mantenimientos` si se quieren conservar (Fleetio puede resincronizar gastos y mantenimientos).

## Orden de las hojas (respeta las llaves foráneas)

`clientes → clientes_fiscal → flota → pilotos → rutas → tarifas → mem → proveedores → catalogos → viajes → viajes_tarifa → viajes_costos → viajes_viaticos → liquidaciones → agrupaciones → pagos → ordenes_pago → perfiles → acceso_cliente → gastos → mantenimientos`

El cargador valida las referencias antes de insertar y usa ese mismo orden.

## Convenciones

- **Listas** (`proyectos`, `viaje_ids`, `destinatarios`): valores separados con `|` → `Proy A|Proy B`.
- **Booleanos**: `SI` / `NO`.
- **Fechas**: `AAAA-MM-DD`. **Fecha y hora**: `AAAA-MM-DDTHH:MM`.
  Si escribes una celda como fecha de Excel, el cargador la convierte sola.
- **Importes**: número (sin `Q`, sin separador de miles). Acepta coma decimal.
- **JSON** (columnas `extra`, `envio`, `emision`, `transferencia`, `cobros`…): JSON válido.
  El cargador también corrige el doble codificado antiguo.
- **Vacío**: se usa el valor por defecto de la base o NULL. El `Diccionario` marca lo obligatorio y los valores permitidos.
- Los **IDs con ceros a la izquierda** deben ir como texto (formato de celda «Texto»).

## Validaciones que hace el cargador

- Columnas desconocidas, columnas sin encabezado o encabezados movidos.
- Campos obligatorios, tipos, fechas y valores de lista (estados, roles, fases…).
- Llaves foráneas (cliente, ruta, piloto, unidad, viaje…).
- Claves repetidas **dentro de la hoja** y contra la base:
  - cliente repetido (razón social o nombre),
  - NIT repetido,
  - código de ruta repetido,
  - tarifa activa repetida (cliente + proyecto + ruta + capacidad + vigencia),
  - viaje repetido (fecha + piloto + ruta),
  - número de factura activo repetido.
- Reglas: ruta ACTIVA con código/origen/destino; factura EMITIDA con emisión e importe; orden PAGADA con transferencia; devolución con comentario.
- Coherencia: el proyecto del viaje/tarifa debe pertenecer al cliente; la ruta debe ser del mismo cliente y proyecto; los viajes de una factura deben existir y ser del mismo cliente.
- Los errores se informan por **hoja y fila**; si hay uno solo, no se guarda nada.

## Contadores

Al aplicar, el cargador recalcula `master.secuencias` (`trip`, `pil`, `tar`, `rut`, `agr`, `cob`, `evi`, `liq`, `op`, `pag`) para que la app siga numerando sin chocar con lo cargado.

## Cuentas de acceso

El login vive en **Supabase Auth**, no en `master`. Para cada usuario:

1. Crearlo en Supabase Auth (o desde la app) con su correo y contraseña.
2. Poner su fila en `perfiles` (basta el **email**; el cargador resuelve el UUID) con rol y `activo = SI`.
3. En `acceso_cliente`, indicar qué clientes ve (los ADMIN no lo necesitan).

## Reglas de la base que conviene tener presentes

- No se pueden **borrar** rutas, tarifas, viajes, liquidaciones, pagos, facturas, evidencias ni notificaciones (disparadores). Por eso el reemplazo desactiva los disparadores **dentro de la transacción** y los vuelve a activar.
- Una ruta `ACTIVA` (o `EN_TARIFACION` / `PENDIENTE_APROBACION`) exige código, origen y destino.
- Factura `EMITIDA`: exige emisión e importe facturado. Orden `PAGADA`: exige transferencia.
- El histórico entra con su **estado final**; la validación de transiciones solo aplica al editar.
- **Evidencias**: la plantilla no sube archivos. Si una factura entra como `EMITIDA`, su evidencia debe existir en el bucket; si no, cárgala como `ENVIADA` y márcala emitida en la app.

## Checklist del día de la carga

1. Crear los usuarios en Supabase Auth y sus `perfiles`.
2. Revisar la hoja `catalogos` (tipoUnidad, opl, tipoCarga, tipoViaje, arrastre).
3. `--simular` sobre el archivo definitivo → **0 errores**.
4. Respaldo (automático con `--reemplazar --aplicar`).
5. `--reemplazar --aplicar --si-reemplazar` y revisar los conteos por tabla.
6. Entrar como ADMIN y revisar Catálogos, Rutas, Tarifas, un viaje y una factura.
7. Publicar el front (push) y subir la versión del service worker si hubo cambios.

## Si algo falla

- «no existe el login … en Supabase Auth» → crea primero el usuario.
- «ya hay una tarifa activa igual» → desactiva la anterior o cambia la vigencia.
- «el código … ya lo usa la ruta …» → corrige el código.
- «viaje duplicado» → revisa fecha, piloto y ruta.
- «la ruta … es de …» → el cliente/proyecto del viaje o tarifa no coincide con la ruta.
- «falta la columna obligatoria …» → revisa el `Diccionario`.
