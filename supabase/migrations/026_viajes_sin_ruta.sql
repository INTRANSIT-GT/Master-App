-- 026 · Viaje «SIN RUTA».
-- «Nuevo viaje» tiene el botón SIN RUTA: permite registrar un viaje sin ruta asignada (queda marcado y se avisa a Gerencia).
-- Hoy master.viajes.ruta_id es NOT NULL con llave foránea a master.rutas, así que un viaje sin ruta no se puede guardar.
-- Este script SOLO quita la obligatoriedad: los viajes existentes no cambian, la llave foránea sigue validando cualquier
-- ruta que SÍ se indique, y la marca «sin ruta» (quién y cuándo) se guarda en viajes.extra (no requiere columnas nuevas).
-- Es seguro volver a ejecutarlo (idempotente).
--
-- Nota sobre el índice de duplicados uq_viaje_duplicado (fecha_plan, piloto_id, ruta_id): en Postgres los NULL no se
-- consideran iguales, por lo que dos viajes SIN RUTA del mismo piloto y fecha no chocan entre sí (es lo esperado).
alter table master.viajes alter column ruta_id drop not null;
