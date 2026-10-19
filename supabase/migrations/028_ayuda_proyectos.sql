-- 028 · Ayuda: el perfil «Proyectos» atiende los reportes junto con el Administrador.
-- Complementa la 027 (tabla master.reportes_ayuda). Aplícala DESPUÉS de la 027.
--
-- Qué cambia: solo la política de LECTURA de master.reportes_ayuda. Antes: el dueño del reporte o el Administrador.
-- Ahora: el dueño del reporte, el Administrador o un usuario ACTIVO con perfil PROYECTOS (identificador real que se guarda en
-- master.perfiles.rol, definido en la migración 018). Los demás perfiles siguen viendo solo sus propios reportes.
-- Qué NO cambia: no se crean permisos nuevos en la matriz, no se tocan los permisos de ningún perfil ni de otros módulos, y
-- sigue sin haber políticas de INSERT/UPDATE/DELETE: las escrituras las hace solo la Edge Function «api», que valida que únicamente
-- ADMIN y PROYECTOS puedan cambiar el estado (operación cambiarEstadoReporteAyuda).
-- Es seguro volver a ejecutarla (idempotente).
create or replace function app.es_gestor_ayuda() returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select exists (select 1 from master.perfiles u where u.id=auth.uid() and u.activo and u.rol in ('ADMIN','PROYECTOS'))
$$;
revoke all on function app.es_gestor_ayuda() from public, anon;
grant execute on function app.es_gestor_ayuda() to authenticated;

drop policy if exists p_reportes_ayuda on master.reportes_ayuda;
create policy p_reportes_ayuda on master.reportes_ayuda for select to authenticated
  using (usuario_id = auth.uid()::text or app.es_gestor_ayuda());
