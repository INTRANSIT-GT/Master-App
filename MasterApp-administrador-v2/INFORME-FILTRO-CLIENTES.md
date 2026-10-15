# Informe · filtro desplegable de Clientes (Administrador)

**Alcance:** solo la vista Clientes del Administrador. Los demás perfiles y la estructura de Supabase no se tocaron. `js/config.js` se conserva tal cual.
**Nota sobre tu captura:** muestra los *cuadros*, es decir, un entorno con la versión anterior. El filtro ya venía en la entrega anterior; esta versión lo ajusta a tus 10 puntos. Para verlo hay que desplegar `js/ui.js` y `service-worker.js` (la versión de caché subió a v1.0.8; si ves lo viejo, cierra y abre la app dos veces).

## Cómo queda la pantalla
Título → **filtro desplegable con búsqueda** (justo encima) → **tabla tipo Excel** con las 13 columnas y sus acciones (Editar, Activar/Desactivar, Ver viajes). Sin cuadros de resumen. La *configuración de Torre de Control* (que antes estaba en esta pantalla) **no se eliminó**: quedó en un bloque plegado debajo de la tabla; si quieres que desaparezca de esta vista, dímelo.

## Tus 10 puntos
1. Al abrirlo se puede elegir un cliente de la lista (los clientes de la base). 2. Se puede escribir el nombre directamente (el cursor queda listo). 3. La lista se filtra mientras escribes («cli» → «cliente b» → un resultado); basta con parte del nombre, sin importar mayúsculas ni acentos. 4. Sin selección, se ven todos. 5. Al elegir un cliente la tabla muestra solo ese cliente. 6. «Todos los clientes» (primera opción) y el botón **Limpiar selección** vuelven a mostrar todos. 7. Sin coincidencias: **«No se encontraron clientes»**. 8. La lista sale de `DB.clientes`, que es lo que entrega Supabase (sin lista fija ni ejemplos; un cliente agregado aparece de inmediato). 9. La tabla conserva columnas, acciones y funciones. 10. Cuadros eliminados.

## Archivos
Modificados: `js/ui.js`, `service-worker.js` (v1.0.8), `tests/administrador.test.mjs`. Sin cambios: `config.js`, `engine.js`, CSS, servidor y SQL. Para la rama de prueba copia solo `js/ui.js` y `service-worker.js` (no `js/config.js`).

## Pruebas (resultados reales)
- `npm run test:admin`: **79 correctas, 0 fallidas** (incluye 16 comprobaciones del filtro y que los otros 7 perfiles siguen generando el mismo HTML que la versión anterior en 49 pantallas).
- Navegador real (Chromium), escritorio y teléfono, escribiendo con el teclado: orden título-filtro-tabla, panel dentro de la pantalla, lista que se acorta sola, mensaje sin coincidencias, un cliente deja una fila, limpiar vuelve a las 12: **todo correcto**. El único error de JavaScript que registró mi arnés fue el de los datos de ejemplo antiguos del repositorio (`demo-seed.js`), ajeno a la aplicación.
- **No verificado:** con tus clientes reales de Supabase (sin acceso); la tabla se probó con 12 clientes de ejemplo y el servidor con Postgres local.
