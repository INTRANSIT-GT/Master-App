-- =====================================================================
-- 034 · ÓRDENES DE COMPRA (OC)
-- PREPARADA PARA REVISIÓN: NO se ha ejecutado en ningún entorno. Aplicar solo con autorización.
--
-- Qué agrega (nada existente se borra ni se reemplaza salvo las dos funciones de almacenamiento, que conservan
-- exactamente sus ramas anteriores y suman la rama «oc»):
--   1) master.ordenes_compra · la orden: cliente + proyecto, viajes con su tarifa CONGELADA, PDF por versiones,
--      envío, respuesta del cliente, anulación e historial. Una orden activa por viaje (trigger).
--   2) Una factura activa por orden (índice único sobre agrupaciones.extra->>'ocId'; el motor guarda ocId ahí).
--   3) Permisos propios oc_* (NO reutilizan los de Liquidaciones) y la sección sec_oc.
--   4) Almacenamiento privado: prefijo oc/<id_de_la_orden>/<archivo> en el bucket «evidencias».
--   5) RLS: lectura con oc_ver; el ajuste de combustible va en una columna sin permiso de lectura directa.
-- Las escrituras las hace solo la Edge Function (rol de servicio), como el resto de tablas.
-- Orden de despliegue seguro: (1) aplicar esta migración, (2) desplegar la función api, (3) publicar la aplicación.
-- (El servidor funciona aunque la migración falte: la tabla se trata como opcional hasta que se use.)
-- =====================================================================

-- ---------- 1) Tabla de órdenes de compra ----------
create table if not exists master.ordenes_compra(
  id text primary key,
  cliente_id text not null references master.clientes(id),
  cliente_nombre text not null default '',
  proyecto text not null,
  estado text not null check (estado in ('PREPARADA','ENVIADA','ACEPTADA','RECHAZADA','ANULADA','REEMPLAZADA')),
  moneda text not null default 'Q',
  columnas text[] not null default '{}',                           -- columnas opcionales elegidas para el PDF
  viaje_ids text[] not null check (cardinality(viaje_ids)>=1),
  lineas jsonb not null default '[]',                              -- viajes con semana ISO, shipment, placa, tarifa… (congelados)
  combustible jsonb not null default '{}',                         -- ajuste de combustible congelado por viaje (permiso oc_ver_combustible)
  total numeric(14,2) not null check (total>0),
  documentos jsonb not null default '[]',                          -- PDF por versiones: {version, path, hash, por, en, motivo}
  envio jsonb,                                                     -- quién y cuándo confirmó el envío al cliente
  respuesta jsonb,                                                 -- aceptada / rechazada: quién, cuándo, referencia, motivo, evidencias
  anulada jsonb,
  agrupacion_id text,                                              -- factura vinculada (una factura activa por orden)
  historial jsonb not null default '[]',
  preparado_por_id text, preparado_por text, preparado_en timestamptz,
  extra jsonb not null default '{}',
  constraint ck_oc_envio     check (estado in ('PREPARADA','ANULADA') or envio is not null),
  constraint ck_oc_pdf       check (estado in ('PREPARADA','ANULADA') or jsonb_array_length(documentos)>=1),
  constraint ck_oc_respuesta check (estado not in ('ACEPTADA','RECHAZADA') or respuesta is not null),
  constraint ck_oc_anulada   check (estado<>'ANULADA' or anulada is not null)
);
create index if not exists ix_oc_estado   on master.ordenes_compra (estado, cliente_id, proyecto);
create index if not exists ix_oc_viajes   on master.ordenes_compra using gin (viaje_ids) where estado in ('PREPARADA','ENVIADA','ACEPTADA','RECHAZADA');
create index if not exists ix_oc_factura  on master.ordenes_compra (agrupacion_id) where agrupacion_id is not null and agrupacion_id<>'';

-- Un viaje no puede estar en dos órdenes activas (PREPARADA, ENVIADA, ACEPTADA o RECHAZADA; solo la anulación libera).
create or replace function app.oc_viaje_unico() returns trigger language plpgsql as $$
begin
  if new.estado in ('PREPARADA','ENVIADA','ACEPTADA','RECHAZADA') and exists (
       select 1 from master.ordenes_compra o
        where o.id<>new.id and o.estado in ('PREPARADA','ENVIADA','ACEPTADA','RECHAZADA') and o.viaje_ids && new.viaje_ids) then
    raise exception 'Un viaje de la orden % ya está en otra orden de compra activa.', new.id using errcode='23505';
  end if;
  return new;
end $$;
drop trigger if exists trg_oc_viaje_unico on master.ordenes_compra;
create trigger trg_oc_viaje_unico before insert or update on master.ordenes_compra for each row execute function app.oc_viaje_unico();

-- Lo que se congeló no cambia (ni siquiera con el rol de servicio): cliente, proyecto, viajes, líneas y total.
-- Los PDF son de solo agregar: una versión nueva no borra ni altera las anteriores.
create or replace function app.oc_congelada() returns trigger language plpgsql as $$
begin
  if new.cliente_id is distinct from old.cliente_id or new.proyecto is distinct from old.proyecto
     or new.viaje_ids is distinct from old.viaje_ids or new.lineas is distinct from old.lineas
     or new.total is distinct from old.total or new.combustible is distinct from old.combustible then
    raise exception 'Operación no permitida: los viajes, importes y total de la orden de compra % están congelados.', old.id using errcode='42501';
  end if;
  -- ANULADA y REEMPLAZADA son estados finales: una orden cerrada no se reabre (queda como historial).
  if old.estado in ('ANULADA','REEMPLAZADA') and new.estado is distinct from old.estado then
    raise exception 'Operación no permitida: la orden de compra % está cerrada (%).', old.id, old.estado using errcode='42501';
  end if;
  if jsonb_array_length(new.documentos) < jsonb_array_length(old.documentos) or not (new.documentos @> old.documentos) then
    raise exception 'Operación no permitida: los PDF de la orden de compra % se conservan por versiones (solo se agregan).', old.id using errcode='42501';
  end if;
  return new;
end $$;
drop trigger if exists trg_oc_congelada on master.ordenes_compra;
create trigger trg_oc_congelada before update on master.ordenes_compra for each row execute function app.oc_congelada();
drop trigger if exists trg_oc_nodelete on master.ordenes_compra;
create trigger trg_oc_nodelete before delete on master.ordenes_compra for each row execute function app.bloquear_modificacion();

-- ---------- 2) Una factura activa por orden ----------
-- El motor guarda el vínculo en agrupaciones.extra->>'ocId' (no requiere columna nueva).
create unique index if not exists ux_agrupacion_por_oc on master.agrupaciones ((extra->>'ocId'))
  where estado='ACTIVA' and coalesce(extra->>'ocId','')<>'';

-- ---------- 3) Permisos propios (separados de Liquidaciones) ----------
-- Decisión definitiva: Comercial (Gerencia Comercial y Analista Comercial) y Administrador tienen TODOS los permisos
-- de OC: ver, preparar, enviar, registrar la respuesta del cliente (oc_responder), corregir/anular/gestionar rechazadas
-- (oc_corregir) y ver el combustible. Facturación solo ve. Ninguno se deriva de Liquidaciones, Finanzas ni Facturación.
insert into master.permisos (rol, permiso, habilitado)
select r.rol, p.permiso,
       case
         when r.rol in ('GERENTE_COMERCIAL','ANALISTA_COMERCIAL','ADMIN') then true
         when r.rol = 'FACTURACION' and p.permiso = 'oc_ver' then true
         else false
       end
  from (values ('ADMIN'),('GERENTE_TRANSPORTE'),('VALIDADOR'),('OPERATIVO'),('ANALISTA_COMERCIAL'),('GERENTE_COMERCIAL'),
               ('FACTURACION'),('COBROS'),('PAGO_OPL'),('TORRE'),('PROYECTOS')) as r(rol)
 cross join (values ('oc_ver'),('oc_preparar'),('oc_enviar'),('oc_responder'),('oc_corregir'),('oc_ver_combustible')) as p(permiso)
on conflict (rol, permiso) do nothing;

-- Separación de funciones: estos permisos NO pueden concederse a esos perfiles ni desde la matriz.
insert into master.permisos_prohibidos (rol, permiso)
select r.rol, p.permiso
  from (values
    ('TORRE'),('OPERATIVO'),('VALIDADOR'),('PAGO_OPL')) as r(rol)
 cross join (values ('oc_ver'),('oc_preparar'),('oc_enviar'),('oc_responder'),('oc_corregir'),('oc_ver_combustible')) as p(permiso)
on conflict do nothing;
insert into master.permisos_prohibidos (rol, permiso)
select r.rol, p.permiso
  from (values ('GERENTE_TRANSPORTE'),('FACTURACION'),('COBROS'),('PROYECTOS')) as r(rol)
 cross join (values ('oc_preparar'),('oc_enviar'),('oc_responder'),('oc_corregir'),('oc_ver_combustible')) as p(permiso)
on conflict do nothing;

-- Las OC son una pestaña del espacio COMERCIAL (no un módulo aparte): Gerencia Comercial y Analista Comercial entran
-- a ese espacio con su propio usuario. La migración 033 los sembró en «No»; aquí pasan a «Sí» (solo esos dos perfiles).
insert into master.permisos (rol, permiso, habilitado) values
  ('GERENTE_COMERCIAL', 'sec_comercial', true),
  ('ANALISTA_COMERCIAL', 'sec_comercial', true)
on conflict (rol, permiso) do update set habilitado = true;

-- Acceso a la sección «Órdenes de compra» (modelo de la migración 033).
insert into master.permisos (rol, permiso, habilitado) values
  ('ADMIN', 'sec_oc', true),
  ('GERENTE_COMERCIAL', 'sec_oc', true),
  ('ANALISTA_COMERCIAL', 'sec_oc', true),
  ('FACTURACION', 'sec_oc', true),
  ('GERENTE_TRANSPORTE', 'sec_oc', false),
  ('VALIDADOR', 'sec_oc', false),
  ('OPERATIVO', 'sec_oc', false),
  ('COBROS', 'sec_oc', false),
  ('PAGO_OPL', 'sec_oc', false),
  ('TORRE', 'sec_oc', false),
  ('PROYECTOS', 'sec_oc', false)
on conflict (rol, permiso) do nothing;

-- ---------- 4) Almacenamiento privado: oc/<orden>/<archivo> ----------
-- puede_subir: conserva EXACTAMENTE las ramas viajes / facturas / pagos de la migración 023 y suma «oc»:
--   se sube el PDF mientras la orden está PREPARADA (oc_preparar) y la evidencia de respuesta cuando está ENVIADA (oc_responder).
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
      when 'oc' then exists (select 1 from master.ordenes_compra o
          where o.id=split_part(nombre,'/',2)
            and ((app.perm('oc_preparar') and o.estado='PREPARADA') or (app.perm('oc_responder') and o.estado='ENVIADA')))
      else false end, false)
  and split_part(nombre,'/',3)<>'' and split_part(nombre,'/',4)=''
  and split_part(nombre,'/',3) ~ '^[A-Za-z0-9._-]{8,90}$'
$$;
-- Visibilidad de una OC: quien gestiona el ciclo (Comercial, Gerencia, Administrador) ve todas; quien solo consulta
-- (Facturación) ve únicamente las ya confirmadas por Comercial (ACEPTADA).
create or replace function app.oc_visible(p_estado text) returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select app.perm('oc_ver') and (p_estado='ACEPTADA' or app.perm('oc_preparar') or app.perm('oc_enviar') or app.perm('oc_responder') or app.perm('oc_corregir'))
$$;
revoke all on function app.oc_visible(text) from public, anon;
grant execute on function app.oc_visible(text) to authenticated;
-- puede_ver_archivo: conserva las ramas de la migración 016 y suma «oc» (según app.oc_visible).
create or replace function app.puede_ver_archivo(nombre text) returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select coalesce(
    case split_part(nombre,'/',1)
      when 'viajes' then app.viaje_visible(split_part(nombre,'/',2)) and (app.perm('liq_ver') or app.perm('liq_enviar'))
      when 'facturas' then app.perm('comercial_ver') or app.perm('finanzas_ver')
      when 'pagos' then app.perm('finanzas_ver') or app.perm('pagos_registrar')
      when 'oc' then exists (select 1 from master.ordenes_compra o where o.id=split_part(nombre,'/',2) and app.oc_visible(o.estado))
      else false end, false)
$$;
revoke all on function app.puede_subir(text), app.puede_ver_archivo(text) from public, anon;
grant execute on function app.puede_subir(text), app.puede_ver_archivo(text) to authenticated;

-- ---------- 5) Seguridad (RLS) ----------
alter table master.ordenes_compra enable row level security;
drop policy if exists p_ordenes_compra on master.ordenes_compra;
create policy p_ordenes_compra on master.ordenes_compra for select to authenticated using (app.oc_visible(estado));
-- Lectura por columnas: «combustible» y «extra» no se entregan por la API directa de Postgres; la función api (rol de servicio)
-- las lee y solo devuelve el ajuste a quien tiene oc_ver_combustible.
revoke all on master.ordenes_compra from authenticated, anon;
grant select (id, cliente_id, cliente_nombre, proyecto, estado, moneda, columnas, viaje_ids, lineas, total, documentos, envio, respuesta,
              anulada, agrupacion_id, historial, preparado_por_id, preparado_por, preparado_en) on master.ordenes_compra to authenticated;

notify pgrst, 'reload schema';
