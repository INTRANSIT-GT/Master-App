-- 008 · Perfil separado para registrar depósitos/cobros.
begin;
alter table master.perfiles drop constraint if exists perfiles_rol_check;
alter table master.perfiles add constraint perfiles_rol_check check (rol in ('ADMIN','ENCARGADO','TORRE','LIQUIDACIONES','COMERCIAL','CONTABILIDAD','GERENCIA_COMERCIAL','GERENCIA_TRANSPORTE'));

insert into master.permisos (rol,permiso,habilitado)
select 'CONTABILIDAD', permiso, permiso in ('comercial_ver','cobros_registrar') from master.permisos where rol='ADMIN'
on conflict (rol,permiso) do update set habilitado=excluded.habilitado;
update master.permisos set habilitado=false where rol='COMERCIAL' and permiso='cobros_registrar';
commit;
