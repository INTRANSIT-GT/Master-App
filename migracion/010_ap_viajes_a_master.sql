-- =====================================================================
-- MIGRACIÓN DE DATOS · AP_VIAJES (esquema public)  ─▶  Master App (esquema master)
-- Decisión de integración: B1 — mismo proyecto Supabase, esquema aparte `master`.
-- Se migran SOLO usuarios (perfiles + accesos) y clientes. Los viajes, tarifas,
-- rutas, unidades, etc. NO se mueven (la Master App los maneja con su propio flujo).
--
-- REQUISITOS
--   1) Haber ejecutado 001..004 (crean el esquema `master`).
--   2) Que los usuarios YA existan en Supabase Auth (mismos correos que en
--      AP_VIAJES.usuarios.USUARIO). Los perfiles se enlazan por correo.
--
-- Es IDEMPOTENTE: se puede volver a ejecutar sin duplicar (on conflict do nothing).
-- =====================================================================

-- 0) RESPALDO (recomendado, descomenta la primera vez)
-- create table if not exists master._bkp_clientes as table master.clientes;
-- create table if not exists master._bkp_perfiles  as table master.perfiles;
-- create table if not exists master._bkp_acceso   as table master.acceso_cliente;

-- ---------------------------------------------------------------- 1) CLIENTES
-- AP_VIAJES.clientes  ->  master.clientes (+ master.clientes_fiscal)
-- * master.clientes.id  debe cumplir ^[A-Z0-9_-]{2,20}$  -> se normaliza.
-- * `cliente` es único; se toma de CLIENTE.  GRUPO_FLEETIO va a `extra`
--   (se lee con to_jsonb para no fallar si la columna aún no existe).
insert into master.clientes (id, nombre, cliente, proyectos, torre_estatus, activo, extra)
select
  upper(regexp_replace(c."ID_CLIENTE", '[^A-Za-z0-9_-]', '', 'g'))                         as id,
  left(c."CLIENTE", 60)                                                                     as nombre,
  left(c."CLIENTE", 60)                                                                     as cliente,
  '{}'::text[], false, true,
  jsonb_strip_nulls(jsonb_build_object(
    'grupoFleetio', nullif(to_jsonb(c)->>'GRUPO_FLEETIO', ''),
    'clientePadre', nullif(c."CLIENTE_PADRE", ''),
    'servicio',     nullif(c."SERVICIO", ''),
    'linkContrato', nullif(c."LINK_CONTRATO", '')
  ))
from public."clientes" c
where coalesce(c."ID_CLIENTE", '') <> ''
  and upper(regexp_replace(c."ID_CLIENTE", '[^A-Za-z0-9_-]', '', 'g')) ~ '^[A-Z0-9_-]{2,20}$'
  and char_length(coalesce(c."CLIENTE", '')) between 2 and 60
on conflict do nothing;

-- 1b) Datos de contacto fiscal (los que AP_VIAJES tenía en la ficha del cliente)
insert into master.clientes_fiscal (cliente_id, nit, direccion_fiscal, correo_facturacion, contacto, telefono, credito_dias, observaciones)
select m.id, '', '',
       coalesce(c."CORREO", ''), coalesce(c."NOMBRE_USUARIO_PRINCIPAL", ''), coalesce(c."TELEFONO", ''), '', ''
from public."clientes" c
join master.clientes m on m.id = upper(regexp_replace(c."ID_CLIENTE", '[^A-Za-z0-9_-]', '', 'g'))
on conflict (cliente_id) do nothing;

-- ---------------------------------------------------------------- 2) PERFILES
-- AP_VIAJES.usuarios  ->  master.perfiles
-- * perfiles.id = UUID de Supabase Auth  -> se enlaza por correo (USUARIO = email).
-- * `usuario` (handle corto) se genera del correo y se le agrega un sufijo del
--   UUID para garantizar unicidad y el patrón ^[a-z0-9._-]{3,30}$. La
--   administradora puede renombrarlo luego; el ingreso es por correo.
-- * Mapeo de rol AP_VIAJES -> Master:
--     admin→ADMIN · operativo→ENCARGADO · validador→LIQUIDACIONES
--     facturador→COMERCIAL · gerente_transporte→GERENCIA · gerente_comercial→GERENCIA
insert into master.perfiles (id, usuario, email, nombre, rol, activo, proyectos)
select
  au.id                                                                                    as id,
  left(regexp_replace(lower(split_part(u."USUARIO", '@', 1)), '[^a-z0-9._-]', '', 'g'), 20)
    || '_' || substr(au.id::text, 1, 8)                                                     as usuario,
  lower(u."USUARIO")                                                                        as email,
  coalesce(nullif(u."NOMBRE", ''), u."USUARIO")                                             as nombre,
  case upper(coalesce(u."ROL", ''))
    when 'ADMIN'              then 'ADMIN'
    when 'OPERATIVO'          then 'ENCARGADO'
    when 'VALIDADOR'          then 'LIQUIDACIONES'
    when 'FACTURADOR'         then 'COMERCIAL'
    when 'GERENTE_TRANSPORTE' then 'GERENCIA'
    when 'GERENTE_COMERCIAL'  then 'GERENCIA'
    else 'ENCARGADO' end                                                                    as rol,
  (lower(coalesce(u."ACTIVO", '')) = 'si')                                                  as activo,
  '{}'::text[]
from public."usuarios" u
join auth.users au on lower(au.email) = lower(u."USUARIO")
where coalesce(u."USUARIO", '') <> ''
on conflict do nothing;

-- ------------------------------------------------------------ 3) ACCESOS (usuario→cliente)
insert into master.acceso_cliente (user_id, cliente_id)
select distinct au.id, m.id
from public."usuario_cliente" uc
join public."usuarios" u  on u."ID_USUARIO" = uc."ID_USUARIO"
join auth.users au        on lower(au.email) = lower(u."USUARIO")
join master.clientes m    on m.id = upper(regexp_replace(uc."ID_CLIENTE", '[^A-Za-z0-9_-]', '', 'g'))
on conflict do nothing;

-- ---------------------------------------------------------------- 4) REPORTE
select 'perfiles en master'                          as dato, count(*)::text as valor from master.perfiles
union all select 'clientes en master',                        count(*)::text from master.clientes
union all select 'accesos usuario-cliente en master',         count(*)::text from master.acceso_cliente
union all select 'usuarios AP_VIAJES SIN cuenta Auth (revisar)',
  (select count(*)::text from public."usuarios" u
    where coalesce(u."USUARIO", '') <> ''
      and not exists (select 1 from auth.users au where lower(au.email) = lower(u."USUARIO")))
union all select 'clientes AP_VIAJES NO migrados (id/nombre invalido o duplicado)',
  (select count(*)::text from public."clientes" c
    where coalesce(c."ID_CLIENTE", '') <> ''
      and not exists (select 1 from master.clientes m
                       where m.id = upper(regexp_replace(c."ID_CLIENTE", '[^A-Za-z0-9_-]', '', 'g'))));
