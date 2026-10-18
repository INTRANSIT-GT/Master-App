-- =====================================================================
-- 021 · Fecha de entrega de los viajes anteriores al cambio de flujo
-- ---------------------------------------------------------------------
-- La migración 007 renombró los estados del viaje (FINALIZADO → ENTREGADO,
-- PENDIENTE_CORRECCION → RECHAZADO, etc.) pero NO llenó `finalizado_en`, así que
-- los viajes que ya existían quedaron Entregados/Rechazados «sin fecha de entrega».
-- Eso hacía que la app no dejara enviar la liquidación («La liquidación no puede
-- enviarse antes de entregar el viaje»).
--
-- La Edge Function ya no bloquea esos viajes (la fecha se completa sola al liquidar),
-- pero esta migración la rellena de una vez para toda la carga anterior:
--   1) la fecha del paso a Entregado que quedó en la auditoría, si existe;
--   2) la fecha plan + la hora de fin de descarga, si están;
--   3) la fecha de creación del viaje.
--
-- Idempotente: solo toca las filas que tienen la fecha vacía. Se puede volver a ejecutar.
-- =====================================================================

update master.viajes v
   set finalizado_en = coalesce(
         (select max(a.en) from master.auditoria a
           where a.viaje_id = v.id and a.accion ilike 'Viaje entregado%'),
         case when v.fecha_plan ~ '^\d{4}-\d{2}-\d{2}' and v.t_fin_descarga ~ '^\d{2}:\d{2}'
              then (v.fecha_plan::date + v.t_fin_descarga::time) end,
         v.creado_en),
       finalizado_por = coalesce(nullif(v.finalizado_por, ''), 'Carga anterior')
 where v.finalizado_en is null
   and v.estado in ('ENTREGADO','LIQUIDADO','RECHAZADO','ACEPTADO','FACTURADO','COBRADO');

-- Reporte de control: cuántos viajes quedaron con fecha de entrega tras la corrección
select estado,
       count(*) filter (where finalizado_en is null) as sin_fecha,
       count(*)                                      as total
  from master.viajes
 group by estado
 order by estado;
