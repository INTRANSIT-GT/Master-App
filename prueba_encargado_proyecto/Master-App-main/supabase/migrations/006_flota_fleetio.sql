-- =====================================================================
-- 006 · FLOTA / FLEETIO
-- ---------------------------------------------------------------------
-- Qué agrega:
--   * `master.flota.extra` (jsonb): detalles del vehículo traídos de Fleetio
--     (VIN, marca, modelo, año, medidor, grupo, color, combustible, estado…).
--   * `master.mantenimientos`: entradas de servicio de Fleetio (service_entries).
--   * `master.gastos`: entradas de gasto de Fleetio (expense_entries).
--
-- La sincronización la hace la Edge Function `sync-flota` (con la clave de
-- servicio del servidor). Esas tablas SOLO se leen desde la aplicación:
-- nadie escribe en ellas desde el navegador (no hay políticas de escritura).
--
-- Idempotente: se puede volver a ejecutar.
-- =====================================================================

alter table master.flota add column if not exists extra jsonb not null default '{}';

create table if not exists master.mantenimientos(
  id_mantenimiento     text primary key,
  unidad               text not null default '',
  fleetio_vehicle_id   text not null default '',
  fecha                text not null default '',
  referencia           text not null default '',
  estado               text not null default '',
  proveedor            text not null default '',
  medidor              text not null default '',
  subtotal             numeric(14,2),
  mano_obra            numeric(14,2),
  repuestos            numeric(14,2),
  total                numeric(14,2),
  notas                text not null default '',
  actualizado          timestamptz
);
create index if not exists ix_mant_unidad on master.mantenimientos (unidad);
create index if not exists ix_mant_fecha  on master.mantenimientos (fecha);

create table if not exists master.gastos(
  id_gasto             text primary key,
  unidad               text not null default '',
  fleetio_vehicle_id   text not null default '',
  fecha                text not null default '',
  tipo                 text not null default '',
  monto                numeric(14,2),
  proveedor            text not null default '',
  notas                text not null default '',
  actualizado          timestamptz
);
create index if not exists ix_gastos_unidad on master.gastos (unidad);
create index if not exists ix_gastos_fecha  on master.gastos (fecha);

-- Seguridad: la app solo LEE. (El 002 ya activó RLS en flota; estas tablas
-- nacen aquí, así que se activa aquí y se definen sus políticas de lectura.)
alter table master.mantenimientos enable row level security;
alter table master.gastos enable row level security;

drop policy if exists p_mantenimientos on master.mantenimientos;
drop policy if exists p_gastos on master.gastos;
create policy p_mantenimientos on master.mantenimientos for select to authenticated using (app.perm('catalogos_ver') or app.perm('finanzas_ver'));
create policy p_gastos on master.gastos for select to authenticated using (app.perm('finanzas_ver') or app.perm('catalogos_ver'));

revoke all on master.mantenimientos, master.gastos from anon, authenticated;
grant select on master.mantenimientos, master.gastos to authenticated;

notify pgrst, 'reload schema';
