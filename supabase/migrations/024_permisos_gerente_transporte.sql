-- 024 · Gerente de Transporte: Inicio, registrar viajes y control financiero en consulta.
-- El perfil ya veía todos los viajes («ver todos»), pero Inicio y Viajes piden «ver viajes» (que no tenía),
-- «Nuevo viaje» pide «registrar viajes» y Finanzas pide «ver finanzas». Se le habilitan esas cuatro cosas.
-- Lo que NO cambia: los permisos de escritura de dinero (registrar costos, pagos, cobros y tarifas de cobro)
-- siguen apagados y siguen siendo prohibidos para el rol, así que el control financiero es solo de lectura.

insert into master.permisos (rol, permiso, habilitado) values
  ('GERENTE_TRANSPORTE', 'viajes_ver', true),
  ('GERENTE_TRANSPORTE', 'viajes_crear', true),
  ('GERENTE_TRANSPORTE', 'viajes_editar_datos', true),
  ('GERENTE_TRANSPORTE', 'finanzas_ver', true)
on conflict (rol, permiso) do update set habilitado = excluded.habilitado;
