-- 040 · El Asistente Comercial puede aplicar la tarifa vigente a los viajes.
-- El permiso tarifa_registrar ya existía, pero solo estaba habilitado para Gerencia Comercial/Admin.
insert into master.permisos (rol, permiso, habilitado)
values
  ('ANALISTA_COMERCIAL', 'tarifa_registrar', true),
  ('GERENTE_COMERCIAL', 'tarifa_registrar', true)
on conflict (rol, permiso) do update set habilitado = excluded.habilitado;
