-- =====================================================================
-- 036 · OT DEL CLIENTE · ASISTENTE COMERCIAL · FACTURACIÓN SIN COBROS
--
-- Cambio de flujo:
--   1) El Asistente Comercial (rol ANALISTA_COMERCIAL) agrupa viajes, genera el reporte y registra
--      el número de OT que entrega el cliente. Nuevo permiso comercial_ot.
--   2) Facturación recibe la agrupación con OT, registra serie/número/fecha, sube la foto de la
--      factura y valida el cobro (monto, fecha y referencia).
--   3) El perfil COBROS desaparece: sus usuarios (si hubiera) pasan a FACTURACION.
--
-- No crea tablas ni columnas: la OT viaja en agrupaciones.extra (g.confirmacion.ot) como el resto
-- del flujo comercial. Ejecutar después de 034 y 035.
-- =====================================================================

-- 1) Cualquier usuario del perfil Cobros pasa a Facturación antes de retirar el rol.
update master.perfiles set rol = 'FACTURACION' where rol = 'COBROS';

-- 2) comercial_ot hereda el valor que tenía comercial_confirmar (ADMIN, GC y Asistente ya lo tenían).
insert into master.permisos (rol, permiso, habilitado)
select rol, 'comercial_ot', habilitado
  from master.permisos
 where permiso = 'comercial_confirmar'
on conflict (rol, permiso) do update set habilitado = excluded.habilitado;

-- Filas para todos los perfiles, aunque no existiera la confirmación.
insert into master.permisos (rol, permiso, habilitado)
select r.rol, 'comercial_ot',
       r.rol in ('ADMIN','GERENTE_COMERCIAL','ANALISTA_COMERCIAL')
  from (values ('ADMIN'),('GERENTE_TRANSPORTE'),('VALIDADOR'),('OPERATIVO'),('ANALISTA_COMERCIAL'),
               ('GERENTE_COMERCIAL'),('FACTURACION'),('PAGO_OPL'),('TORRE'),('PROYECTOS')) as r(rol)
on conflict (rol, permiso) do update set habilitado = excluded.habilitado;

-- 3) Retirar la confirmación anterior y sus vetos; los reemplaza comercial_ot.
delete from master.permisos where permiso = 'comercial_confirmar';
delete from master.permisos_prohibidos where permiso = 'comercial_confirmar';

insert into master.permisos_prohibidos (rol, permiso)
select r.rol, 'comercial_ot'
  from (values ('GERENTE_TRANSPORTE'),('FACTURACION'),('PROYECTOS'),('TORRE'),
               ('OPERATIVO'),('VALIDADOR'),('PAGO_OPL')) as r(rol)
on conflict do nothing;

-- 4) Fuera el rol Cobros (permisos y vetos). Ya no hay usuarios con ese rol.
delete from master.permisos where rol = 'COBROS';
delete from master.permisos_prohibidos where rol = 'COBROS';

-- 5) Facturación: cobra; no agrupa ni registra OT.
update master.permisos set habilitado = true
 where rol = 'FACTURACION' and permiso = 'cobros_registrar';
update master.permisos set habilitado = false
 where rol = 'FACTURACION' and permiso in ('comercial_agrupar','comercial_ot');
insert into master.permisos_prohibidos (rol, permiso) values
  ('FACTURACION','comercial_agrupar')
on conflict do nothing;

notify pgrst, 'reload schema';
