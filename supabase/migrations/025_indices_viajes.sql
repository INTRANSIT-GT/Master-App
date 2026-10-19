-- 025 · Índices para las consultas que crecen con el volumen de viajes.
-- La base ya tiene ~7.000 viajes y entran ~3.000 por mes: sin estos índices, el snapshot (la lectura que abre la
-- aplicación) y las páginas del histórico recorren la tabla de viajes completa en cada consulta.
--   · ix_viajes_estado            → la ventana de trabajo filtra por estado (en curso, facturados pendientes de pago).
--   · ix_viajes_fecha_desc        → la ventana y las páginas del histórico ordenan por fecha plan (con los viajes
--                                   sin fecha al final, que es como los muestra la aplicación).
--   · ix_liquidaciones_viaje      → la liquidación de un viaje concreto.
--   · ix_evidencias_viaje         → las evidencias de un viaje concreto.
-- (Los viajes por cliente y proyecto ya usan ix_viajes_cliente de la migración 001.)

create index if not exists ix_viajes_estado on master.viajes (estado);
create index if not exists ix_viajes_fecha_desc on master.viajes (fecha_plan desc nulls last, id desc);
create index if not exists ix_liquidaciones_viaje on master.liquidaciones (viaje_id);
create index if not exists ix_evidencias_viaje on master.evidencias (viaje_id);
