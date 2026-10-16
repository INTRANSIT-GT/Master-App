# Informe · cambios del perfil «Encargado de proyecto»

**Alcance:** solo el rol `ENCARGADO`. Cada cambio está condicionado a ese rol dentro del código; los demás perfiles ejecutan el mismo código de antes. **Esta versión sustituye a la anterior (`Master-App-main-actualizado.zip`), que aplicaba algunos cambios a todos los perfiles.**

## 1. Dónde estaba el proyecto originalmente
El ZIP que subiste: `/mnt/user-data/uploads/Master-App-main.zip` (queda **intacto**). No tengo acceso a tus carpetas locales, a Cowork ni a tu GitHub: trabajé sobre una copia extraída de ese ZIP.

## 2. Dónde guardé los cambios
`prueba_encargado_proyecto/Master-App-main/` (también empaquetado en `prueba_encargado_proyecto.zip`). Es una carpeta de prueba: el proyecto principal no se tocó ni se reemplazó.

## 3. Archivos modificados
| Archivo | Propósito |
|---|---|
| `js/ui.js` | Los 6 cambios, todos condicionados al rol Encargado |
| `css/app.css` | Solo se **agregaron** reglas para el desplegable dentro del formulario de viaje (ninguna regla existente cambió) |
| `service-worker.js` | Versión de caché `v1.0.5` → `v1.0.6` para que la app instalada descargue el código nuevo |
| `package.json` | Script `npm run test:encargado` |
| `tests/encargado.test.mjs`, `tests/_datos-encargado.js` | Pruebas nuevas |
**No se tocaron:** `engine.js` (permisos y reglas), `backend.js`, `utils.js`, `catalogos.js`, `config.js`, `core.mjs`, `handler.mjs`, `store.mjs`, SQL, credenciales.

## 4. Respaldo
`prueba_encargado_proyecto/respaldo_original/` contiene los archivos originales (copiados del ZIP) de todo lo que pudo cambiar o se usa para comparar. Además, el ZIP original sigue intacto.

## 5. Los seis cambios (solo Encargado de proyecto)
1. **IDs y códigos ocultos:** el botón de perfil muestra solo nombre y rol (ya no `CIT-U0001 … CLI-003`); no se muestran códigos de ruta en el formulario, en las listas de viajes ni en la pantalla Rutas (se oculta la columna «Código»). Se conserva el **n.º de viaje** (`Viaje #…`) porque es el dato con que el encargado identifica su viaje. Los IDs siguen existiendo internamente.
2. **Palabra «Perfil»:** eliminada la etiqueta «PERFIL», «según tu perfil», «para tu perfil» y los mensajes del servidor tipo «Tu perfil (…) no puede …» (se muestran como «No puedes …»). Sin tocar variables, claves ni el motor.
3. **Palabra «Catálogo»:** eliminada la etiqueta «CATALOGO» de los campos. No se tocaron los catálogos, listas ni tablas.
4. **Desplegable de Ruta funcional:** abre, busca y selecciona; muestra las rutas reales de la fuente de datos (las que el servidor entrega al usuario: activas y de sus clientes/proyectos); cada ruta aparece una vez (los registros repetidos no se borran); la elección se guarda en el viaje (`ruta_id`) y se conserva al editar y consultar. Puedes elegir la ruta primero: se completan cliente, proyecto, origen y destino. Si una ruta tiene varias combinaciones de origen/destino (según los datos existentes) se ofrecen para elegir; si falta un dato se marca «No registrado en la ruta» sin inventarlo. Si los datos no cargan: mensaje claro con «Reintentar»; si no hay rutas: mensaje explicativo. Sin rutas de ejemplo.
5. **«Ingreso a planta»** (sin CP) · 6. **«Ingreso a bodega»** (sin CG): solo la etiqueta visible; campo, valor, formato y validaciones intactos.

## 6. Pruebas ejecutadas (resultados reales)
- `npm run test:encargado`: **29 correctas, 0 fallidas**:
  - Servidor + Postgres con tus migraciones 001–008: la ruta elegida se guarda en `ruta_id`, se conserva al consultar y al editar; ingreso a planta/bodega se siguen guardando en sus columnas.
  - Interfaz del encargado (incluida una usuaria con 58 clientes como en tu captura).
  - **Otros perfiles:** se comparó el HTML generado por tu código original y por el nuevo para ADMIN, TORRE, LIQUIDACIONES, COMERCIAL, GERENCIA_COMERCIAL, CONTABILIDAD y GERENCIA_TRANSPORTE en **35 pantallas** (menús, detalle de viaje y formulario): **idéntico byte por byte**. Un control negativo (aplicar el cambio a todos los roles) hace fallar la prueba, así que sí detecta diferencias.
- Navegador real (Chromium), computadora y teléfono: 14 de 14 (botón de perfil visible, ruta, etiquetas, sin desborde, sin errores de JavaScript).
- Tus pruebas existentes (`servidor`, `cliente-supabase`, `exportar`, `estatico`): **ya fallaban antes** (el motor exige campos nuevos y `config.js` trae tu clave real); su salida es **idéntica** antes y después.

## 7. Pendiente / no verificado
- **No probé contra tu Supabase real** (sin acceso ni credenciales): la conexión, las rutas y los proyectos reales de tu base no se verificaron. La lista de rutas solo muestra rutas **ACTIVAS** y visibles para el usuario (su cliente y proyecto asignados). Si sale vacía en tu base, es un tema de datos (p. ej. clientes sin proyectos registrados o rutas no activas); `migracion/011_diagnostico_proyectos_rutas.sql` de la entrega anterior sirve para diagnosticarlo (solo lectura).
- Las mejoras de la ronda anterior que **no** estaban en esta lista (opción «N/A» en Tipo de carga, desplegable de Proyecto con proyectos autorizados para otros perfiles, etc.) **no están incluidas** en esta versión. Dime si las quieres también, limitadas o no al encargado.
- No usé Cowork ni Git: la rama de prueba debes crearla tú (abajo).

## 8. Cómo probar y publicar
1. Descomprime `prueba_encargado_proyecto.zip`. Abre `Master-App-main/index.html` desde un servidor local (`npm install` y `npm run serve`, luego `http://localhost:8080`) con tu `js/config.js` real (ya viene incluido y sin cambios), e inicia sesión como encargado.
2. Pruebas: `cd Master-App-main && npm install && npm run test:encargado`.
3. Para llevarlo a GitHub sin tocar `main`: `git checkout -b prueba-encargado-proyecto`, copia `js/ui.js`, `css/app.css`, `service-worker.js`, `package.json` y `tests/` sobre tu repositorio, `git add` / `git commit`, y súbelo como rama (sin merge). No se requiere volver a publicar la Edge Function (el servidor no cambió).
4. Si ves la pantalla anterior, cierra y abre la app dos veces o borra los datos del sitio (caché).
