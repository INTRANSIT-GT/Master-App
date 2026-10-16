# Informe · ajustes del Administrador (Clientes, Facturación, Nuevo viaje, Rutas)

**Alcance:** solo el rol `ADMIN`. Cada cambio está condicionado a ese rol dentro del código; los demás perfiles ejecutan el mismo código de antes.
**Esta carpeta es acumulativa:** parte de la versión que ya recibiste (con los cambios del Encargado de proyecto) y le suma estos ajustes. Tu `js/config.js` se conserva **tal cual** (con tu URL y tu clave pública anon; no se vació).

## 1. Qué se hizo, módulo por módulo
**Clientes (Administrador).** Se sustituyeron los cuadros por **una sola tabla estilo Excel** con los 13 encabezados en el orden pedido (ID cliente, Cliente, Cliente padre, Servicio, Nombre usuario, Correo, Teléfono, Link contrato, NIT, Proyecto, Estado, Creado, Acciones), con desplazamiento horizontal dentro de la tabla sin ocultar columnas. De dónde sale cada dato (según tu migración 010): *Cliente padre, Servicio y Link contrato* están en `master.clientes.extra`; *Nombre usuario, Correo y Teléfono* en `master.clientes_fiscal` (contacto, correo_facturacion, telefono); los demás en `master.clientes`. Lo que no existe se muestra «—» (no se inventa). **Acciones:** Editar y Activar/Desactivar (las existentes) más *Ver viajes* (consultar; antes se entraba por los cuadros). Se mantiene «Nuevo cliente» y la configuración de Torre de Control.
- **Filtro:** desplegable con búsqueda por nombre del cliente (clientes reales de Supabase), «Todos los clientes», y botón *Limpiar filtro*.
- **Formulario:** se quitó el campo «Cliente» (el que decía «como aparece en la lista… del catálogo»). **No era redundante en la base**: `master.clientes.cliente` es obligatorio y único, así que **la columna se conserva** y se completa sola con el nombre en mayúsculas al crear (al editar se respeta el valor existente). Antes de guardar se valida lo obligatorio y se dice qué falta (código, nombre y al menos un proyecto, que es lo que ya exigía el sistema); NIT, correo, teléfono, dirección, etc. siguen siendo opcionales como estaban.

**Facturación.** En el filtro de la pestaña *Facturación* se agregó el desplegable **«Detalle de viajes»** con **todos** los viajes (facturados o no), buscable por número, con tarjeta de detalle (cliente, proyecto, fecha, ruta, origen/destino, piloto, placa, estado, tarifa, factura, estado de facturación, importe), botón para abrir la ficha completa y *Quitar selección*. Filtra la tabla, el *Limpiar filtros* lo reinicia, y las descargas de Excel/PDF respetan la selección.

**Nuevo viaje.** La selección principal es la **placa del equipo** (desplegable buscable). Regla actual conservada: un viaje necesita un piloto del cliente que tenga unidad (la base exige `piloto_id`), y la unidad/placa salen de esa relación. Por eso: placa → unidad → piloto se resuelve **solo**; si la placa tiene **varios pilotos** se pide elegir uno (no se adivina); si **no tiene piloto** para ese cliente se avisa y no se guarda. No se tocó la tabla ni el campo de piloto. Las placas ofrecidas son las de las unidades de los pilotos del cliente (la regla vigente). También en este formulario, **Ruta y Proyecto** ahora funcionan como desplegables (se puede elegir la ruta primero y completa cliente, proyecto, origen y destino), igual que ya tenía el Encargado.

**Rutas.** Se agregó el **catálogo desplegable** (buscable; cada ruta una sola vez aunque haya registros repetidos; marca «(no activa)» a las no activas) con detalle de cliente, proyecto, origen y destino, y selectores de origen/destino cuando la ruta tiene varias opciones. **Investigación (por qué no se veían rutas):** (1) la pantalla tragaba cualquier error con un `try/catch` vacío y mostraba «No hay rutas con estos filtros», sin distinguir error, base vacía o filtros — **corregido**: ahora dice si no se pudo cargar (con el motivo) o si la base no tiene rutas, siempre con «Reintentar»; (2) la causa más probable en tu base es que **`master.rutas` esté vacía**: tu migración 010 declara que *no* trae rutas de AP_VIAJES; el administrador ve todas las rutas sin ningún filtro de permisos. **No lo pude confirmar** (no tengo acceso a tu Supabase). Para confirmarlo y para localizar las rutas reales: `migracion/012_diagnostico_administrador.sql` (solo lectura). No inventé rutas ni cargué datos: si las rutas reales viven en `public.rutas` (AP_VIAJES), falta una migración con **sus columnas reales** — pásame el resultado de la consulta A3 y la preparo.

## 2. Archivos
| Archivo | Cambio | ¿Va a la rama? |
|---|---|---|
| `js/ui.js` | Todos los ajustes (condicionados a `ADMIN`) | **Sí** |
| `css/app.css` | Sin cambios en esta ronda (las reglas del desplegable de formulario ya estaban) | — |
| `service-worker.js` | Versión de caché v1.0.7 (para que la app instalada descargue lo nuevo) | **Sí** |
| `migracion/012_diagnostico_administrador.sql` | Nuevo, solo lectura | Opcional |
| `tests/administrador.test.mjs`, `tests/_datos-admin.js` | Pruebas nuevas | Opcional |
| `tests/encargado.test.mjs` | Actualizada (ya no compara al Administrador con el original) | Opcional |
| `package.json` | Scripts `test:admin`, `test:encargado`, `test:visual` | Opcional |
| `prueba-visual.html`, `js/datos-prueba-visual.js`, `*.bat`, `tests/prueba-visual.test.mjs` | Revisión visual local con datos de ejemplo | Opcional (no necesarios para la app) |
| `js/config.js`, `engine.js`, `backend.js`, `utils.js`, `catalogos.js`, `exportar.js`, `core.mjs`, `handler.mjs`, `store.mjs`, SQL de `supabase/` | **Sin cambios** | — |
**Necesarios para ejecutar la app:** `index.html`, `css/`, `js/`, `assets/`, `manifest.json`, `offline.html`, `service-worker.js`. No se requiere volver a publicar la Edge Function ni cambiar el esquema de Supabase.

## 3. Pruebas realizadas (resultados reales)
| Prueba | Resultado |
|---|---|
| `npm run test:admin` | **65 correctas, 0 fallidas** |
| — Clientes: tabla (no cuadros), 13 encabezados en orden, datos por columna, filtro (abrir, escribir, elegir, limpiar), formulario (campo «Cliente» fuera, validación con mensaje, guardado, nombre repetido rechazado, edición conserva datos extra) | ✔ |
| — Facturación: desplegable con todos los viajes, búsqueda por número, detalle de viaje con/sin factura, quitar selección, Comercial sin el desplegable | ✔ |
| — Nuevo viaje: placa bloqueada sin cliente, ruta primero, placas del cliente, búsqueda, piloto automático, varios pilotos, placa sin piloto, guardado completo (piloto/unidad/ruta), edición con placa | ✔ |
| — Rutas: catálogo único por ruta, búsqueda, detalle, varios destinos, vacío y error con «Reintentar» | ✔ |
| — **Otros 7 perfiles (Encargado, Torre, Liquidaciones, Comercial, Gerencia Comercial, Contabilidad, Gerencia de Transporte): HTML idéntico byte por byte al de la versión anterior en 49 pantallas.** Control negativo: si el cambio se aplicara a todos, la prueba falla. | ✔ |
| — `config.js` idéntico al de tu ZIP original (huella SHA-256) | ✔ |
| — Con Postgres (tus migraciones 001–008): el servidor entrega los datos de la tabla (incluye los de `extra`), todas las rutas, editar un cliente migrado conserva sus datos extra, y el viaje con piloto derivado de la placa guarda piloto, unidad y ruta | ✔ |
| `npm run test:encargado` / `npm run test:visual` | 29 / 12 correctas, 0 fallidas |
| Navegador real (Chromium), escritorio y teléfono: tabla con scroll horizontal, filtro, placa, rutas, facturación | 14 de 14, sin errores de JavaScript |
| `servidor`, `cliente-supabase`, `exportar`, `estatico` (pruebas anteriores del repositorio) | **Fallan igual que antes de mis cambios** (el motor exige campos nuevos; `config.js` real); salida idéntica a la línea base |

## 4. No verificado / límites
- **Conexión con tu Supabase real:** no tengo acceso; nada se probó contra tus datos reales. Se probó con Postgres local (PGlite) con tus migraciones, y con datos de ejemplo.
- Los `.bat` en Windows (no pude ejecutarlos; alternativa: abrir `prueba-visual.html`); Edge/Firefox (probé Chromium).
- Los clientes migrados **sin proyectos** no se pueden guardar desde el formulario hasta asignarles al menos uno (regla del sistema, sin cambios); los viajes y rutas dependen de que cada cliente tenga sus proyectos.
- «Nombre usuario» se toma del contacto de la ficha fiscal (donde la migración puso `NOMBRE_USUARIO_PRINCIPAL`).
- «Facturación»: interpreté «el filtro de facturas» como el filtro de la pestaña *Facturación*. Si te referías a la pestaña *Facturas* (lista de facturas) u otra pantalla, dímelo.
- El resto de perfiles (incluido Comercial en Facturación y Rutas) **no** recibieron estos desplegables, por la instrucción de no modificarlos. Si los quieres también, es un cambio aparte.
- Encargado de proyecto sigue eligiendo el piloto (la placa es solo para el Administrador).

## 5. Rama de prueba en GitHub (sin tocar `main`)
`git checkout -b prueba-administrador` → copia **solo** `js/ui.js` y `service-worker.js` (y opcionalmente `tests/`, `package.json`, `migracion/012_…`) → `git add` / `git commit` / `git push -u origin prueba-administrador`. **No copies `js/config.js`** (el de tu repo ya es el tuyo) ni fusiones hasta revisar. Nota: `ui.js` también incluye los cambios del Encargado de la entrega anterior; si en tu repo aún no están, quedarán en la misma rama de prueba.
