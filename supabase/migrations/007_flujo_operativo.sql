-- 007 · Flujo operativo: Planificado → En ruta → Entregado → Liquidado → Aceptado → Facturado → Cobrado.
-- Ejecutar una sola vez en SQL Editor antes de desplegar el nuevo API.
begin;

alter table master.perfiles drop constraint if exists perfiles_rol_check;
update master.perfiles set rol='GERENCIA_TRANSPORTE' where rol='GERENCIA';
update master.permisos set rol='GERENCIA_TRANSPORTE' where rol='GERENCIA';
alter table master.perfiles add constraint perfiles_rol_check check (rol in ('ADMIN','ENCARGADO','TORRE','LIQUIDACIONES','COMERCIAL','CONTABILIDAD','GERENCIA_COMERCIAL','GERENCIA_TRANSPORTE'));
insert into master.permisos (rol,permiso,habilitado)
select 'GERENCIA_COMERCIAL', permiso, false from master.permisos where rol='ADMIN'
on conflict do nothing;
insert into master.permisos (rol,permiso,habilitado)
select r.rol, p.permiso, false
from (values ('ADMIN'),('ENCARGADO'),('TORRE'),('LIQUIDACIONES'),('COMERCIAL'),('CONTABILIDAD'),('GERENCIA_COMERCIAL'),('GERENCIA_TRANSPORTE')) r(rol)
cross join (values ('viajes_aprobar_duplicado'),('rutas_aprobar_comercial'),('rutas_aprobar_transporte')) p(permiso)
on conflict do nothing;
update master.permisos set habilitado=true where rol='ADMIN' and permiso in ('viajes_aprobar_duplicado','rutas_aprobar_comercial','rutas_aprobar_transporte');
update master.permisos set habilitado=true where rol='GERENCIA_COMERCIAL' and permiso in ('viajes_ver_todos','historial_ver','comercial_ver','tarifas_ver','tarifas_crear','tarifas_editar','tarifas_desactivar','rutas_ver','rutas_validar','rutas_aprobar_comercial');
update master.permisos set habilitado=true where rol='GERENCIA_TRANSPORTE' and permiso in ('viajes_ver_todos','historial_ver','liq_ver','rutas_ver','rutas_validar','rutas_aprobar_transporte','viajes_aprobar_duplicado');
insert into master.permisos (rol,permiso,habilitado)
select 'CONTABILIDAD', permiso, permiso in ('comercial_ver','cobros_registrar') from master.permisos where rol='ADMIN'
on conflict (rol,permiso) do update set habilitado=excluded.habilitado;
update master.permisos set habilitado=false where rol='COMERCIAL' and permiso='cobros_registrar';

alter table master.viajes add column if not exists placa_arrastre text not null default '';
alter table master.agrupaciones add column if not exists serie_factura text not null default '';
alter table master.viajes drop constraint if exists viajes_estado_check;
alter table master.viajes disable trigger trg_viajes_transicion;
update master.viajes set estado=case estado
  when 'PENDIENTE' then 'PLANIFICADO'
  when 'EN_CURSO' then 'EN_RUTA'
  when 'FINALIZADO' then 'ENTREGADO'
  when 'PENDIENTE_LIQUIDACION' then 'ENTREGADO'
  when 'EN_REVISION' then 'LIQUIDADO'
  when 'PENDIENTE_CORRECCION' then 'RECHAZADO'
  when 'APROBADA' then 'ACEPTADO'
  when 'PENDIENTE_COMERCIAL' then 'ACEPTADO'
  when 'COMERCIAL_REGISTRADA' then 'FACTURADO'
  else estado end;
alter table master.viajes add constraint viajes_estado_check check (estado in ('PLANIFICADO','EN_RUTA','ENTREGADO','LIQUIDADO','ACEPTADO','RECHAZADO','FACTURADO','COBRADO'));

alter table master.rutas add column if not exists aprobacion_comercial jsonb;
alter table master.rutas add column if not exists aprobacion_transporte jsonb;
alter table master.rutas drop constraint if exists rutas_estado_check;
alter table master.rutas drop constraint if exists ck_ruta_asignada;
update master.rutas set estado=case estado when 'ASIGNADA' then 'ACTIVA' when 'NO_ASIGNADA' then 'PENDIENTE' else estado end;
alter table master.rutas add constraint rutas_estado_check check (estado in ('PENDIENTE','EN_TARIFACION','PENDIENTE_APROBACION','ACTIVA','RECHAZADA'));
alter table master.rutas add constraint ck_ruta_activa check ((estado not in ('EN_TARIFACION','PENDIENTE_APROBACION','ACTIVA')) or (codigo<>'' and origen_id<>'' and destino_id<>''));
drop index if exists master.uq_ruta_codigo;
create unique index if not exists uq_ruta_codigo on master.rutas (codigo) where estado<>'RECHAZADA' and codigo<>'';

delete from master.transiciones_estado;
insert into master.transiciones_estado(desde,hasta) values
 ('PLANIFICADO','EN_RUTA'),('EN_RUTA','ENTREGADO'),('ENTREGADO','LIQUIDADO'),('LIQUIDADO','ACEPTADO'),('LIQUIDADO','RECHAZADO'),('RECHAZADO','LIQUIDADO'),('ACEPTADO','FACTURADO'),('FACTURADO','COBRADO'),('FACTURADO','ACEPTADO');
alter table master.viajes enable trigger trg_viajes_transicion;

commit;
