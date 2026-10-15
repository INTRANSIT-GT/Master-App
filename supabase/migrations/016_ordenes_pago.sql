-- =====================================================================
-- 016 · Tarifa del PROVEEDOR (OPL) y ÓRDENES DE PAGO
-- El viaje tiene, además de la tarifa del cliente, una tarifa de OPL (lo que
-- se le paga al proveedor), con su propio ajuste por combustible (MEM).
-- Dos etapas separadas para pagar a un proveedor:
--   1) EMITIR la orden de pago (documento) sobre viajes ya Facturados al cliente.
--   2) REGISTRAR el pago: cuando el proveedor factura, se registra la
--      transferencia con DOS archivos esenciales: evidencia de la transferencia
--      y la factura del proveedor. Con eso la orden queda PAGADA.
-- =====================================================================

-- ---------- Tarifas: importe y combustible del proveedor ----------
alter table master.tarifas add column if not exists importe_opl numeric(14,2);
alter table master.tarifas add column if not exists combustible_pct_opl numeric(5,2);
alter table master.tarifas add column if not exists diesel_pactado_opl numeric(8,2);

-- ---------- Viaje: tarifa de OPL aplicada (separada y protegida por permiso) ----------
alter table master.viajes_tarifa add column if not exists tarifa_opl numeric(14,2);
alter table master.viajes_tarifa add column if not exists tarifa_opl_base numeric(14,2);
alter table master.viajes_tarifa add column if not exists ajuste_opl numeric(14,2);
alter table master.viajes_tarifa add column if not exists precio_mem_opl text not null default '';

-- ---------- Órdenes de pago a proveedor ----------
create table if not exists master.ordenes_pago(
  id text primary key,
  proveedor text not null,
  viaje_ids text[] not null check (cardinality(viaje_ids)>=1),
  fase text not null check (fase in ('EMITIDA','PAGADA')),
  importe numeric(14,2) not null check (importe>0),
  importes_viaje jsonb not null default '{}',
  fecha_emision text not null default '',
  emision jsonb,
  transferencia jsonb,
  estado text not null check (estado in ('ACTIVA','ANULADA')),
  creado_por_id text, creado_por text, creado_en timestamptz,
  anulada jsonb, correcciones jsonb not null default '[]',
  extra jsonb not null default '{}',
  -- activa = tiene su emisión; paga = tiene registrada la transferencia con evidencia y factura del proveedor
  constraint ck_op_emision check (estado='ANULADA' or emision is not null),
  constraint ck_op_pagada check (fase<>'PAGADA' or transferencia is not null)
);
create index if not exists ix_op_proveedor on master.ordenes_pago (proveedor, estado, fase);

-- ---------- Almacenamiento: permitir archivos de pago (orden, transferencia, factura del proveedor) ----------
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
create or replace function app.puede_ver_archivo(nombre text) returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select coalesce(
    case split_part(nombre,'/',1)
      when 'viajes' then app.viaje_visible(split_part(nombre,'/',2)) and (app.perm('liq_ver') or app.perm('liq_enviar'))
      when 'facturas' then app.perm('comercial_ver') or app.perm('finanzas_ver')
      when 'pagos' then app.perm('finanzas_ver') or app.perm('pagos_registrar')
      else false end, false)
$$;
revoke all on function app.puede_subir(text), app.puede_ver_archivo(text) from public, anon;
grant execute on function app.puede_subir(text), app.puede_ver_archivo(text) to authenticated;

-- ---------- Seguridad (RLS): la orden de pago se lee con finanzas/comercial/pagos.
-- Las escrituras las hace solo la Edge Function con el rol de servicio (sin políticas de escritura, como el resto).
alter table master.ordenes_pago enable row level security;
drop policy if exists p_ordenes_pago on master.ordenes_pago;
create policy p_ordenes_pago on master.ordenes_pago for select to authenticated
  using (app.perm('finanzas_ver') or app.perm('comercial_ver') or app.perm('pagos_registrar'));
grant select on master.ordenes_pago to authenticated;
