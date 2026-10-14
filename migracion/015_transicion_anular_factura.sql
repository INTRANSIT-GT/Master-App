-- =====================================================================
-- 015 · Anular una factura devuelve el viaje a "Aceptado"
-- Al enviar a facturación el viaje pasa a FACTURADO; si la factura se anula,
-- el motor lo regresa a ACEPTADO. La red de seguridad de la base
-- (master.transiciones_estado + trigger trg_viajes_transicion) debe permitir
-- esa arista, o la anulación falla con "Transición de estado no válida".
-- =====================================================================

insert into master.transiciones_estado (desde, hasta) values ('FACTURADO','ACEPTADO')
on conflict do nothing;
