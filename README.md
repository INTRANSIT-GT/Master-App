# Master App de Transportes · In Transit

Aplicación web instalable (PWA) para el control de viajes: asignación, operación, liquidaciones, gestión comercial (tarifas y facturación), Torre de Control, Finanzas de Gerencia, rutas y auditoría. Usa **Supabase** (Auth + Postgres + Storage + una Edge Function) como backend de pruebas y **GitHub Pages** (o cualquier hosting HTTPS estático) para la interfaz.

> **Estado honesto.** Este proyecto fue probado contra un Postgres real (PGlite) con los scripts SQL tal cual están aquí, y la interfaz fue probada de extremo a extremo contra el servidor. **No se ha probado todavía contra un proyecto Supabase real, ni la Edge Function dentro del runtime de Deno, ni la instalación de la PWA en dispositivos reales.** Eso lo verificas tú siguiendo la lista de la sección 8. Nada está "conectado" hasta que completes los pasos 2 a 4 y compruebes el ingreso.

## 0. Integración con AP_VIAJES (esquema `master`)

Esta copia se está integrando **en el mismo proyecto Supabase** que la app `AP_VIAJES`, que ya usa el esquema `public`. Para **no chocar** con sus tablas (`clientes, viajes, pilotos, rutas, tarifas, permisos`), **todas las tablas de la Master App viven ahora en el esquema `master`** (las migraciones `001..004` lo crean y califican con `master.`). Cambios ya aplicados:

- `supabase/migrations/001..004` y `005` → tablas en esquema `master`; `create schema if not exists master;`.
- `supabase/functions/api/store.mjs` → lee/escribe `master.*`.
- `tests/*` y `scripts/gen-sql-permisos.mjs` → referencias `public.` → `master.` (cambio justificado por la decisión de esquema aislado; la lógica de las pruebas no se alteró).
- `migracion/010_ap_viajes_a_master.sql` → mueve **solo usuarios (perfiles + accesos) y clientes** desde `public` (AP_VIAJES) hacia `master`. Idempotente; al final imprime un reporte.

**Ajuste de pruebas:** como las tablas viven en `master`, los archivos `tests/servidor.test.mjs` y `tests/cliente-supabase.test.mjs` fijan `set search_path = master, public` al abrir la base (los tests tenían referencias sin esquema). Es un cambio mecánico exigido por la separación de esquema.

**Portado de AP_VIAJES hasta ahora:** (1) **ajuste por combustible MEM** — tabla `master.mem`, precio diésel por fecha, campos opcionales de tarifa `qDieselPactado`/`combustiblePct`, y el ajuste se **suma al ingreso del cliente** (`tarifaCliente` = base + ajuste, con `tarifaBase` y `ajusteCombustible` como desglose auditable); API `mem`/`precioMem`/`cargarMem` y UI en Comercial → Tarifas. (2) **propiedad del viaje** — un encargado solo edita datos/fechas de los viajes que **registró él** (o los que no tienen responsable, p. ej. creados por la administración); admin y quien tenga «viajes_ver_todos» no se ven limitados.

**CI:** `.github/workflows/pruebas.yml` ya corre las pruebas en GitHub (instala Node, `npm test`, verifica `core.mjs`/`004` al día y `tests/estatico.test.mjs`) en cada push/PR. Requiere que **esta carpeta sea la raíz del repositorio**.

**Pendiente de este port** (del lado de AP_VIAJES): (3) **sync Fleetio** (`flota`/`mantenimientos`/`gastos`).

## 1. Cómo está armado

```
Navegador (GitHub Pages, HTTPS)                      Supabase
 index.html + css + js  ──(correo/clave)──▶  Auth (usuarios)
   clave PUBLISHABLE solo                    
   ──(JWT del usuario)──▶ Edge Function "api" ──▶ Postgres (tablas + RLS + triggers)
   ──(sube evidencia)──▶ Storage privado "evidencias" (políticas por viaje)
```

* **El navegador no decide permisos.** Todas las lecturas y escrituras pasan por la Edge Function `api`, que identifica al usuario por su token verificado, aplica **las mismas reglas de negocio que la interfaz** (el motor `js/engine.js`, copiado automáticamente a `supabase/functions/api/core.mjs`) y guarda **en una sola transacción**. Si algo falla, no se guarda nada y la pantalla no lo confirma.
* **La base se protege sola (RLS).** Todas las tablas tienen Row Level Security. Los usuarios no tienen permisos de escritura directa; las lecturas directas (por si alguien consulta la API REST con su sesión) se limitan por perfil, cliente y proyecto. Cambiar un identificador en una URL o consulta no devuelve filas de otros proyectos.
* **Nada se borra.** Triggers impiden `DELETE` en viajes, liquidaciones, facturas, pagos, rutas y tarifas, y `UPDATE/DELETE/TRUNCATE` en la auditoría (con cadena de huellas). Los estados de un viaje solo pueden avanzar por transiciones válidas.
* **Evidencias en almacenamiento protegido:** bucket privado; solo suben quienes pueden liquidar ese viaje; se ven con enlaces firmados de 1 hora que la función entrega solo a quien ya puede ver el viaje. En la base solo queda la ruta del archivo.
* **Sin secretos en el navegador:** solo la URL y la clave *publishable*. La clave `service_role` vive únicamente en el entorno de la Edge Function; si alguien la pega en `config.js`, la aplicación se niega a funcionar.
* **Portada:** muestra únicamente el logotipo principal oficial del Brandbook (página "Isologo"), en sus dos versiones permitidas: **blanco sobre el panel azul** y **a color sobre fondo claro**. No se incluyen íconos de servicios ni submarcas. `logo-color.png` se extrajo de esa página del Brandbook (azules oficiales) y `logo-blanco.png` es el archivo original del sistema de diseño; ninguno se redibujó, deformó ni recoloreó.
* **Facturación · descargas:** hay dos botones, **Descargar Excel** y **Descargar PDF**, en *Comercial → Facturación* (para Comercial, Gerencia y Administradora) y también en *Finanzas → Facturación e ingresos* (Gerencia y Administradora; exporta las facturas del periodo y filtros de esa pantalla). Exportan exactamente lo que se ve (mismos filtros y orden). El Excel trae 3 hojas (*Resumen*, *Facturas* y *Detalle por viaje*, con filtros y encabezados fijos, importes numéricos); el PDF trae el resumen, la lista de facturas y una sección por factura con envío, emisión (UUID/serie), cobros, saldo y el detalle de cada viaje (ruta, origen, destino, piloto, unidad, placa, capacidad, tarifa, importe). Solo exporta lo que el usuario ya tiene permiso de ver. Se generan en el navegador (`js/exportar.js` + jsPDF incluido en `js/vendor/`), sin enviar datos a ningún servicio externo.
* **PWA:** `manifest.json`, `service-worker.js`, iconos 192/512/maskable. El service worker guarda **solo archivos estáticos** de la interfaz, nunca datos. Sin conexión muestra un aviso rojo y no confirma operaciones.
* **Perfiles:** `ADMIN`, `ENCARGADO` (**IMPLAN y Encargado de proyecto son el mismo perfil**; ve solo los viajes, proyectos y rutas asignados y puede solicitar rutas nuevas), `TORRE`, `LIQUIDACIONES`, `COMERCIAL`, `GERENCIA`.

## 2. Preparar Supabase

1. Crea un proyecto en <https://supabase.com> y guarda la contraseña de la base.
2. **SQL Editor →** ejecuta, en este orden, el contenido de `supabase/migrations/`: `001_esquema.sql`, `002_seguridad_rls.sql`, `003_almacenamiento.sql`, `004_permisos_base.sql`. Son re-ejecutables. Antes de producción, ajusta en `004` el contador `trip` al siguiente número de viaje real de tu hoja (por defecto empieza en 1).
3. **Authentication → Sign In / Providers → Email:** desactiva *Allow new users to sign up* (solo la administradora crea usuarios). Aunque alguien se registrara, sin perfil activo no accede a nada.
4. **Primer administrador:** crea el usuario en *Authentication → Users → Add user* (marca *Auto Confirm*) y ejecuta `supabase/migrations/005_primer_administrador.sql.example` con su UUID.

## 3. Publicar la Edge Function

```bash
npm install -g supabase            # o usa: npx supabase ...
supabase login
supabase link --project-ref TU_REF   # el "ref" aparece en la URL del proyecto
supabase functions deploy api        # verify_jwt activado por supabase/config.toml
```
Opcional, tras publicar la web: `supabase secrets set ALLOWED_ORIGIN=https://TU-USUARIO.github.io`. Si cambias `js/engine.js`, ejecuta `npm run build:core` y vuelve a desplegar la función.

## 4. Conectar la interfaz

Copia `js/config.example.js` sobre `js/config.js` y completa **URL del proyecto** y **clave publishable** (Project Settings → API Keys). Son públicas por diseño. **Nunca** pongas la `service_role`. Con `config.js` vacío, la app muestra "Sin configurar" y no inventa datos.

Luego, con la administradora: crea los **clientes** (pantalla Clientes), importa los catálogos con *Table Editor → Import CSV* en este orden usando las plantillas vacías de `plantillas-csv/`: `flota`, `pilotos`, `destinos` (no se incluyen datos ficticios; salen de tus hojas FLOTA, PILOTOS y DESTINOS), registra las **rutas**, y crea los **usuarios** (la contraseña inicial se define al crearlos; correo = identificador de ingreso).

## 5. Probar en tu computadora

```bash
npm install
npm test                      # servidor + interfaz de extremo a extremo (usa un Postgres embebido, no toca tu Supabase)
node tests/estatico.test.mjs  # rutas, manifiesto, iconos, secretos
npm run serve                 # http://localhost:8080  (localhost cuenta como seguro para probar la PWA)
```

## 6. Publicar en GitHub Pages

```bash
git init && git add . && git commit -m "Master App de Transportes"
git branch -M main
git remote add origin https://github.com/TU-USUARIO/TU-REPO.git
git push -u origin main
```
En GitHub: **Settings → Pages → Source: GitHub Actions**. El flujo `.github/workflows/pages.yml` publica solo la interfaz en `https://TU-USUARIO.github.io/TU-REPO/`. Todas las rutas son **relativas**, así que funciona bajo `/TU-REPO/` y no depende de la raíz del dominio. El archivo `js/config.js` debe estar en el repositorio con tu URL y clave publishable (no son secretas). `js/demo-seed.js` (usuarios ficticios) no se publica.

## 7. Instalarla como aplicación

Ver `docs/INSTALAR-LA-APP.md` (Windows, Android, iPhone). La pantalla de ingreso muestra **Instalar aplicación** cuando el navegador lo permite y, si no, **Cómo instalar la aplicación** con las instrucciones de tu dispositivo.

## 8. Pruebas realizadas y pendientes

**Realizadas (automáticas, repetibles con `npm test`):**
* 68 pruebas del servidor sobre Postgres con los SQL reales: flujo completo de viaje → liquidación con evidencia → aprobación → tarifa → factura; alcance por cliente y por proyecto (incluido IMPLAN/Encargado); RLS con sesiones simuladas de cada perfil (lecturas cruzadas devuelven 0 filas, escrituras directas fallan, `anon` no lee nada); políticas de Storage; triggers (auditoría inmutable, sin borrados, transiciones de estado); alta de usuarios con cuenta de acceso y compensación si se rechaza.
* 24 pruebas de extremo a extremo de la interfaz real en modo Supabase (ingreso, lectura, escritura, subida de evidencia, rechazo del servidor, sin conexión, claves secretas bloqueadas).
* 30 pruebas de la exportación a Excel/PDF (estructura del .xlsx, coincidencia con la pantalla, filtros, permisos).
* 15 comprobaciones estáticas de archivos (rutas relativas, manifiesto, iconos de instalación, logotipos, service worker, ausencia de secretos).
* Además se ejecutó (fuera de este repositorio) la batería de la versión de demostración: 182 pruebas.

**Pendientes de verificar por ti con tus credenciales y dispositivos:**
* Ejecutar los SQL en tu proyecto Supabase real y desplegar la Edge Function (no se probó el runtime de Deno ni las llamadas reales a Auth/Storage).
* Confirmar el ingreso con un usuario real y una operación completa.
* Instalar la PWA en Windows, Android e iPhone y comprobar el comportamiento sin conexión.
* Importar tus catálogos reales y revisar permisos por perfil con la administradora.

## 9. Límites conocidos (versión de pruebas)

* Cada operación lee todas las tablas y las vuelve a guardar si cambian: adecuado para un piloto con pocos usuarios y miles de registros, no para gran volumen. Para producción definitiva conviene pasar las reglas a funciones SQL o paginar la lectura.
* Los avisos son solo dentro de la aplicación (sin correo ni Teams).
* El envío de factura es un cambio de estado interno; no llama a ningún sistema de facturación electrónica.
* Las contraseñas las administra Supabase Auth: el cambio de contraseña se hace desde Supabase (no hay pantalla de recuperación en esta versión).

## 10. Estructura

```
index.html · offline.html · manifest.json · service-worker.js
css/app.css
js/  config.js  assets.js  catalogos.js  utils.js  engine.js  pwa.js  backend.js  exportar.js  ui.js  demo-seed.js
     vendor/ supabase.js · jspdf.umd.min.js · jspdf.plugin.autotable.min.js
assets/  logos/ (logotipo principal del Brandbook: blanco y a color)  icons/ (iconos de instalación PWA)
supabase/  config.toml  migrations/001..005  functions/api/{index.ts,handler.mjs,store.mjs,core.mjs}
scripts/   build-core.mjs  gen-sql-permisos.mjs
tests/     servidor · cliente-supabase · exportar · estatico
plantillas-csv/  docs/  .github/workflows/
```
`js/vendor/` incluye localmente (sin CDN): `@supabase/supabase-js` 2.117.3, `jspdf` 4.2.1 y `jspdf-autotable` 5.0.8.
