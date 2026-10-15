-- =====================================================================
-- 012 · DIAGNÓSTICO (SOLO LECTURA) · clientes, rutas, pilotos/placas y permisos del administrador
-- No modifica nada. Ejecútalo en el SQL Editor de Supabase y compárte los resultados si algo no cuadra.
-- Sirve para confirmar con TUS datos reales las causas de: "no se visualiza ninguna ruta", clientes sin proyectos y placas sin piloto.
-- =====================================================================

-- A) RUTAS · ¿hay rutas en la Master App? (la migración 010 NO trajo rutas de AP_VIAJES)
select estado, count(*) as rutas from master.rutas group by estado order by rutas desc;      -- si no devuelve filas: master.rutas está VACÍA → por eso no se ve ninguna ruta
select cliente_id, proyecto, count(*) filter (where estado='ACTIVA') as activas, count(*) as total from master.rutas group by 1,2 order by 1,2;

-- A2) Rutas repetidas (mismo cliente, proyecto, nombre, origen y destino). La pantalla las muestra UNA vez; aquí las ves.
select cliente_id, proyecto, lower(btrim(nombre)) as nombre, origen_id, destino_id, count(*) as veces, array_agg(id order by id) as ids
from master.rutas group by 1,2,3,4,5 having count(*) > 1 order by veces desc;

-- A3) ¿Existe en tu proyecto la tabla de rutas de AP_VIAJES (esquema public)? Si devuelve columnas, sus rutas NO están en la Master App.
select column_name, data_type from information_schema.columns where table_schema='public' and table_name='rutas' order by ordinal_position;
-- (si la consulta anterior devuelve columnas, cuenta sus filas y revisa un ejemplo:)
--   select count(*) from public.rutas;
--   select * from public.rutas limit 5;
-- Pásame ese resultado y preparo la migración de rutas con las columnas REALES; no la invento.

-- B) PERMISOS · el administrador debe poder ver rutas
select rol, permiso, habilitado from master.permisos where rol='ADMIN' and permiso in ('rutas_ver','clientes_gestionar','rutas_gestionar','comercial_ver') order by permiso;
select id, usuario, email, rol, activo from master.perfiles where rol='ADMIN';

-- C) CLIENTES · lo que muestra la tabla nueva
select count(*) as clientes, count(*) filter (where cardinality(proyectos)=0) as sin_proyectos, count(*) filter (where activo) as activos from master.clientes;
select id, nombre, extra->>'clientePadre' as cliente_padre, extra->>'servicio' as servicio, extra->>'linkContrato' as link_contrato,
       f.contacto as nombre_usuario, f.correo_facturacion as correo, f.telefono, f.nit, cardinality(c.proyectos) as n_proyectos
from master.clientes c left join master.clientes_fiscal f on f.cliente_id = c.id order by c.nombre limit 50;
-- Los clientes SIN proyectos no pueden guardarse desde el formulario hasta que se les asigne al menos uno (regla del sistema).
-- Los campos «Cliente padre», «Servicio» y «Link contrato» viven en master.clientes.extra (JSON); se muestran en la tabla y se CONSERVAN al editar.

-- D) PLACAS · pilotos, unidades y flota (relación placa → unidad → piloto)
select p.cliente_id, count(*) as pilotos, count(*) filter (where p.unidad is null) as sin_unidad from master.pilotos p group by 1 order by 1;
select unidad, count(*) as pilotos, array_agg(id) as pilotos_ids from master.pilotos where unidad is not null group by unidad having count(*) > 1;   -- unidades con VARIOS pilotos (el formulario pedirá elegir)
select f.unidad, f.placa from master.flota f where not exists (select 1 from master.pilotos p where p.unidad = f.unidad);                          -- unidades sin piloto (no aparecen en el desplegable de placas)
select p.id, p.nombre, p.unidad from master.pilotos p where p.unidad is not null and not exists (select 1 from master.flota f where f.unidad = p.unidad); -- pilotos con una unidad que no existe en la flota
