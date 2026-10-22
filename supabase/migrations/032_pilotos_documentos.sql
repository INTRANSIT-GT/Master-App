-- 032 · Pilotos: alta/baja y documentos (licencia, salud, penales, policíacos)
begin;

alter table master.pilotos
  add column if not exists licencia           text not null default '',
  add column if not exists licencia_tipo      text not null default '',
  add column if not exists licencia_vence     date,
  add column if not exists salud_vence        date,
  add column if not exists penales_vence      date,
  add column if not exists policiacos_vence   date,
  add column if not exists activo             boolean not null default true,
  add column if not exists notas              text not null default '',
  add column if not exists actualizado_en     timestamptz;

-- Contador para los ids nuevos (P-0368, …) a partir del mayor existente.
insert into master.secuencias (clave, valor)
select 'pil', coalesce(max(nullif(regexp_replace(id, '[^0-9]', '', 'g'), '')::int), 0)
from master.pilotos
on conflict (clave) do nothing;

-- Tipo de licencia editable desde Catálogos (lista del sistema). Se guarda como la app: arreglo JSON dentro del jsonb.
insert into master.catalogos (clave, etiqueta, valores, actualizado_por, actualizado_en)
values ('tipoLicencia', 'Tipo de licencia', to_jsonb('["A","B","C","PROFESIONAL","OTRO"]'::text), 'migracion', now())
on conflict (clave) do nothing;

commit;

-- Permiso nuevo en la matriz (11 roles): Administración y Gerencia de Transporte lo tienen por defecto.
insert into master.permisos (rol, permiso, habilitado)
select r.rol, 'pilotos_gestionar', (r.rol in ('ADMIN','GERENTE_TRANSPORTE'))
from (values ('ADMIN'),('GERENTE_TRANSPORTE'),('VALIDADOR'),('OPERATIVO'),('ANALISTA_COMERCIAL'),('GERENTE_COMERCIAL'),('FACTURACION'),('COBROS'),('PAGO_OPL'),('TORRE'),('PROYECTOS')) r(rol)
on conflict (rol, permiso) do nothing;
