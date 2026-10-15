-- =====================================================================
-- 002 · SEGURIDAD · Row Level Security
-- Principios:
--  * RLS activado en TODAS las tablas. Nadie (anon/authenticated) tiene INSERT/UPDATE/DELETE: no hay políticas de escritura.
--    Las escrituras las hace únicamente la Edge Function "api" con el rol de servicio, después de validar permisos y reglas.
--  * Lecturas directas (por si alguien consulta la API REST con su propia sesión) restringidas por perfil, cliente y proyecto.
--    Cambiar una URL o una consulta no devuelve filas de otros proyectos.
--  * El rol "anon" (sin sesión) no puede leer nada.
-- Las funciones auxiliares leen el perfil del usuario autenticado (auth.uid()), nunca un dato enviado por el navegador.
-- =====================================================================
create or replace function app.perm(p text) returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select coalesce((select pm.habilitado from master.perfiles u
      join master.permisos pm on pm.rol=u.rol and pm.permiso=p
     where u.id=auth.uid() and u.activo
       and not exists (select 1 from master.permisos_prohibidos x where x.rol=u.rol and x.permiso=p)), false)
$$;
create or replace function app.es_admin() returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select exists (select 1 from master.perfiles u where u.id=auth.uid() and u.activo and u.rol='ADMIN')
$$;
-- ¿El usuario tiene asignado este cliente (y, si tiene proyectos asignados, este proyecto)?
create or replace function app.asignado(cliente text, proyecto text) returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select exists (select 1 from master.perfiles u
    where u.id=auth.uid() and u.activo
      and (u.rol='ADMIN' or (exists (select 1 from master.acceso_cliente a where a.user_id=u.id and a.cliente_id=cliente)
                             and (cardinality(u.proyectos)=0 or proyecto = any(u.proyectos)))))
$$;
create or replace function app.ve_viaje(cliente text, proyecto text, estado text) returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select app.perm('viajes_ver_todos')
      or (app.perm('viajes_ver') and app.asignado(cliente, proyecto))
      or (app.perm('comercial_ver') and estado in ('ACEPTADO','FACTURADO','COBRADO'))
$$;
create or replace function app.viaje_visible(vid text) returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select exists (select 1 from master.viajes v where v.id=vid and app.ve_viaje(v.cliente_id, v.proyecto_cat, v.estado))
$$;
revoke all on function app.perm(text), app.es_admin(), app.asignado(text,text), app.ve_viaje(text,text,text), app.viaje_visible(text) from public, anon;
grant execute on function app.perm(text), app.es_admin(), app.asignado(text,text), app.ve_viaje(text,text,text), app.viaje_visible(text) to authenticated;
grant usage on schema app to authenticated;

-- Activar RLS en todo y quitar cualquier privilegio por omisión
do $$ declare t text; begin
  for t in select tablename from pg_tables where schemaname='master' loop
    execute format('alter table master.%I enable row level security', t);
  end loop;
end $$;
revoke all on all tables in schema master from anon, authenticated;
grant usage on schema master to anon, authenticated;

-- ---------- Políticas de lectura ----------
-- (se recrean todas, para poder volver a ejecutar este script sin errores)
do $$ declare r record; begin
  for r in select policyname, tablename from pg_policies where schemaname='master' loop
    execute format('drop policy %I on master.%I', r.policyname, r.tablename);
  end loop;
end $$;
create policy p_perfiles on master.perfiles for select to authenticated using (id=auth.uid() or app.perm('usuarios_gestionar'));
create policy p_acceso on master.acceso_cliente for select to authenticated using (user_id=auth.uid() or app.perm('usuarios_gestionar'));
create policy p_permisos on master.permisos for select to authenticated using (true);
create policy p_prohibidos on master.permisos_prohibidos for select to authenticated using (true);
create policy p_config on master.config for select to authenticated using (true);
create policy p_clientes on master.clientes for select to authenticated using (true);
create policy p_clientes_fiscal on master.clientes_fiscal for select to authenticated
  using (app.perm('clientes_gestionar') or app.perm('comercial_ver') or app.perm('finanzas_ver') or app.perm('tablero_ver'));
create policy p_flota on master.flota for select to authenticated using (true);
create policy p_pilotos on master.pilotos for select to authenticated using (true);
create policy p_destinos on master.destinos for select to authenticated using (true);

create policy p_rutas on master.rutas for select to authenticated
  using (app.perm('rutas_ver') and (app.es_admin() or app.perm('viajes_ver_todos') or app.perm('comercial_ver') or app.perm('tablero_ver') or app.asignado(cliente_id, proyecto)));
create policy p_tarifas on master.tarifas for select to authenticated using (app.perm('tarifas_ver'));
create policy p_mem on master.mem for select to authenticated using (app.perm('tarifas_ver'));

create policy p_viajes on master.viajes for select to authenticated using (app.ve_viaje(cliente_id, proyecto_cat, estado));
create policy p_viajes_tarifa on master.viajes_tarifa for select to authenticated
  using (app.viaje_visible(viaje_id) and (app.perm('comercial_ver') or app.perm('finanzas_ver')));
create policy p_viajes_costos on master.viajes_costos for select to authenticated
  using (app.viaje_visible(viaje_id) and app.perm('finanzas_ver'));
create policy p_viajes_viaticos on master.viajes_viaticos for select to authenticated
  using (app.viaje_visible(viaje_id) and (app.perm('finanzas_ver') or app.perm('viajes_editar_datos')));

create policy p_liquidaciones on master.liquidaciones for select to authenticated
  using (app.viaje_visible(viaje_id) and (app.perm('liq_ver') or app.perm('liq_enviar')));
create policy p_evidencias on master.evidencias for select to authenticated
  using (app.viaje_visible(viaje_id) and (app.perm('liq_ver') or app.perm('liq_enviar')));

create policy p_agrupaciones on master.agrupaciones for select to authenticated using (app.perm('comercial_ver') or app.perm('finanzas_ver'));
create policy p_pagos on master.pagos for select to authenticated using (app.perm('finanzas_ver'));
create policy p_notificaciones on master.notificaciones for select to authenticated
  using (exists (select 1 from master.perfiles u where u.id=auth.uid() and u.activo and (u.rol='ADMIN' or u.rol=any(destinatarios) or u.id::text=any(usuarios))));
create policy p_auditoria on master.auditoria for select to authenticated using (
  app.perm('auditoria_ver')
  or (entidad='AGRUPACION' and app.perm('comercial_ver'))
  or (viaje_id<>'' and app.perm('historial_ver') and entidad not in ('SEGURIDAD','SESION')
      and (entidad<>'AGRUPACION' or app.perm('comercial_ver'))
      and (entidad<>'FINANZAS' or app.perm('finanzas_ver'))
      and (campo not in ('Tarifa cliente','Costo proveedor') or app.perm('finanzas_ver'))
      and (campo<>'Q viáticos' or app.perm('finanzas_ver') or app.perm('viajes_editar_datos'))
      and app.viaje_visible(viaje_id)));

grant select on master.perfiles, master.acceso_cliente, master.permisos, master.permisos_prohibidos, master.config, master.clientes, master.clientes_fiscal,
  master.flota, master.pilotos, master.destinos, master.rutas, master.tarifas, master.mem, master.viajes, master.viajes_tarifa, master.viajes_costos, master.viajes_viaticos,
  master.liquidaciones, master.evidencias, master.agrupaciones, master.pagos, master.notificaciones, master.auditoria, master.transiciones_estado to authenticated;
-- 'secuencias' no tiene política ni privilegio para usuarios: solo la Edge Function la usa.
-- Por defecto, las tablas futuras tampoco se exponen:
alter default privileges in schema master revoke all on tables from anon, authenticated;
