-- =====================================================================
-- 023 · Corregir referencias a estados ANTIGUOS que quedaron tras el
-- renombrado del flujo operativo (migración 007).
-- ---------------------------------------------------------------------
-- El 007 renombró los estados del viaje:
--   PENDIENTE→PLANIFICADO, EN_CURSO→EN_RUTA, FINALIZADO→ENTREGADO,
--   PENDIENTE_LIQUIDACION→ENTREGADO, EN_REVISION→LIQUIDADO,
--   PENDIENTE_CORRECCION→RECHAZADO, APROBADA/PENDIENTE_COMERCIAL→ACEPTADO,
--   COMERCIAL_REGISTRADA→FACTURADO.
-- Pero dos funciones de seguridad siguieron comparando contra los estados
-- viejos y quedaron ROTAS (nadie sube evidencias y Comercial no ve viajes
-- por la API REST). Esta migración las redefine con los estados nuevos.
-- Idempotente: se puede volver a ejecutar.
-- =====================================================================

-- ---------- Almacenamiento: subir evidencia solo en viajes entregados o devueltos ----------
create or replace function app.puede_subir(nombre text) returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select coalesce(
    case split_part(nombre,'/',1)
      when 'viajes' then exists (select 1 from master.viajes v
          where v.id=split_part(nombre,'/',2) and app.perm('liq_enviar') and app.asignado(v.cliente_id, v.proyecto_cat)
            and v.estado in ('ENTREGADO','RECHAZADO'))
      when 'facturas' then exists (select 1 from master.agrupaciones g
          where g.id=split_part(nombre,'/',2) and app.perm('facturas_emitir') and g.fase='ENVIADA' and g.estado='ACTIVA')
      when 'pagos' then exists (select 1 from master.ordenes_pago o
          where o.id=split_part(nombre,'/',2) and app.perm('pagos_registrar') and o.estado='ACTIVA')
      else false end, false)
  and split_part(nombre,'/',3)<>'' and split_part(nombre,'/',4)=''
  and split_part(nombre,'/',3) ~ '^[A-Za-z0-9._-]{8,90}$'
$$;

-- ---------- Visibilidad de un viaje: Comercial ve los aceptados, facturados y cobrados ----------
create or replace function app.ve_viaje(cliente text, proyecto text, estado text) returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select app.perm('viajes_ver_todos')
      or (app.perm('viajes_ver') and app.asignado(cliente, proyecto))
      or (app.perm('comercial_ver') and estado in ('ACEPTADO','FACTURADO','COBRADO'))
$$;

revoke all on function app.puede_subir(text), app.ve_viaje(text,text,text) from public, anon;
grant execute on function app.puede_subir(text), app.ve_viaje(text,text,text) to authenticated;

notify pgrst, 'reload schema';
