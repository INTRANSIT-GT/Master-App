-- 027 · Sección «Ayuda»: reportes de fallas de los usuarios.
-- Cualquier usuario reporta una falla (módulo, tipo, descripción, qué intentaba hacer); solo el Administrador ve todos los
-- reportes y cambia su estado (Pendiente · En revisión · Resuelto). Cada usuario puede consultar únicamente los suyos.
--
-- Cómo se protege (mismo criterio que el resto de las tablas):
--  * RLS activado. Solo hay política de LECTURA: el dueño del reporte (usuario_id = auth.uid()) o el Administrador activo
--    (app.es_admin(), que ya existe desde la migración 002). NO hay políticas de INSERT/UPDATE/DELETE para nadie.
--  * Las escrituras las hace únicamente la Edge Function «api» (rol de servicio), que valida el tipo, el módulo, la
--    longitud y que solo el rol ADMIN cambie el estado (operaciones crearReporteAyuda y cambiarEstadoReporteAyuda).
--  * Nada se borra (mismo disparador que usan las demás tablas operativas).
-- usuario_id guarda el id del usuario de Supabase Auth (master.perfiles.id = auth.users.id) como texto.
-- Es seguro volver a ejecutarlo (idempotente). No modifica ninguna tabla existente.
create table if not exists master.reportes_ayuda(
  id text primary key,
  usuario_id text not null,
  usuario text not null default '',
  rol text not null default '',
  modulo text not null,
  tipo text not null,
  descripcion text not null,
  intento text not null default '',
  estado text not null default 'PENDIENTE' check (estado in ('PENDIENTE','EN_REVISION','RESUELTO')),
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz,
  actualizado_por text,
  historial jsonb not null default '[]',
  extra jsonb not null default '{}'
);
create index if not exists ix_reportes_ayuda_usuario on master.reportes_ayuda (usuario_id, creado_en desc);
create index if not exists ix_reportes_ayuda_estado on master.reportes_ayuda (estado, creado_en desc);

drop trigger if exists trg_reportes_ayuda_nodel on master.reportes_ayuda;
create trigger trg_reportes_ayuda_nodel before delete on master.reportes_ayuda
  for each row execute function app.bloquear_modificacion();

alter table master.reportes_ayuda enable row level security;
drop policy if exists p_reportes_ayuda on master.reportes_ayuda;
create policy p_reportes_ayuda on master.reportes_ayuda for select to authenticated
  using (usuario_id = auth.uid()::text or app.es_admin());
revoke all on master.reportes_ayuda from anon, authenticated;
grant select on master.reportes_ayuda to authenticated;
