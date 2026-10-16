-- 018 · Rol «Proyectos»: puede revisar todos los módulos y datos, sin acciones.
-- Usuarios y Permisos quedan bloqueados para este rol (no se conceden ni desde la matriz).
-- Arranca en modo consulta: los permisos de escritura quedan apagados y la administradora los enciende cuando haga falta.

-- 1) La lista de roles admitidos incluye el nuevo
alter table master.perfiles drop constraint if exists perfiles_rol_check;
alter table master.perfiles add constraint perfiles_rol_check check (rol = any (array['ADMIN', 'GERENTE_TRANSPORTE', 'VALIDADOR', 'OPERATIVO', 'ANALISTA_COMERCIAL', 'GERENTE_COMERCIAL', 'FACTURACION', 'COBROS', 'PAGO_OPL', 'TORRE', 'PROYECTOS']));

-- 2) Su matriz de permisos (los 45 permisos del sistema)
insert into master.permisos (rol, permiso, habilitado) values
  ('PROYECTOS', 'viajes_ver', true),
  ('PROYECTOS', 'viajes_ver_todos', true),
  ('PROYECTOS', 'viajes_crear', false),
  ('PROYECTOS', 'viajes_editar_datos', false),
  ('PROYECTOS', 'viajes_editar_tiempos', false),
  ('PROYECTOS', 'viajes_editar_estado', false),
  ('PROYECTOS', 'viajes_iniciar', false),
  ('PROYECTOS', 'viajes_finalizar', false),
  ('PROYECTOS', 'viajes_aprobar_duplicado', false),
  ('PROYECTOS', 'liq_ver', true),
  ('PROYECTOS', 'liq_enviar', false),
  ('PROYECTOS', 'liq_aprobar', false),
  ('PROYECTOS', 'liq_devolver', false),
  ('PROYECTOS', 'comercial_ver', true),
  ('PROYECTOS', 'comercial_agrupar', false),
  ('PROYECTOS', 'comercial_corregir', false),
  ('PROYECTOS', 'comercial_anular', false),
  ('PROYECTOS', 'historial_ver', true),
  ('PROYECTOS', 'tablero_ver', true),
  ('PROYECTOS', 'catalogos_ver', true),
  ('PROYECTOS', 'usuarios_gestionar', false),
  ('PROYECTOS', 'permisos_gestionar', false),
  ('PROYECTOS', 'clientes_gestionar', true),
  ('PROYECTOS', 'auditoria_ver', true),
  ('PROYECTOS', 'finanzas_ver', true),
  ('PROYECTOS', 'tarifa_registrar', false),
  ('PROYECTOS', 'costos_registrar', false),
  ('PROYECTOS', 'cobros_registrar', false),
  ('PROYECTOS', 'pagos_registrar', false),
  ('PROYECTOS', 'viajes_estatus_torre', false),
  ('PROYECTOS', 'facturas_emitir', false),
  ('PROYECTOS', 'tarifas_ver', true),
  ('PROYECTOS', 'tarifas_crear', false),
  ('PROYECTOS', 'tarifas_editar', false),
  ('PROYECTOS', 'tarifas_desactivar', false),
  ('PROYECTOS', 'tarifas_opl_ver', true),
  ('PROYECTOS', 'tarifas_opl_crear', false),
  ('PROYECTOS', 'tarifas_opl_autorizar', false),
  ('PROYECTOS', 'rutas_ver', true),
  ('PROYECTOS', 'rutas_solicitar', false),
  ('PROYECTOS', 'rutas_gestionar', false),
  ('PROYECTOS', 'rutas_validar', false),
  ('PROYECTOS', 'rutas_aprobar_comercial', false),
  ('PROYECTOS', 'rutas_aprobar_transporte', false),
  ('PROYECTOS', 'unidades_asignar', false)
on conflict (rol, permiso) do update set habilitado = excluded.habilitado;
