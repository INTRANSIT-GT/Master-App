-- 029 · Lugares: una sola tabla para orígenes y destinos de cada cliente.
-- Aditiva: la tabla destinos y las columnas viejas se conservan (las llena un disparador),
-- para poder revertir el front sin perder nada.

create table if not exists master.lugares (
  id          text primary key,
  cliente_id  text not null references master.clientes(id),
  tipo        text not null check (tipo in ('ORIGEN','DESTINO')),
  nombre      text not null check (char_length(nombre) between 2 and 80),
  direccion   text not null default '',
  activo      boolean not null default true,
  extra       jsonb not null default '{}'::jsonb,
  creado_en   timestamptz not null default now()
);
create unique index if not exists uq_lugares_nombre on master.lugares (cliente_id, tipo, lower(nombre));
comment on table master.lugares is 'Orígenes y destinos por cliente (tipo ORIGEN|DESTINO). Rutas y viajes apuntan aquí con lugar_origen_id / lugar_destino_id.';

-- 1) Los destinos actuales pasan tal cual (conservan su id D-####).
insert into master.lugares (id, cliente_id, tipo, nombre, activo)
select d.id, d.cliente_id, 'DESTINO', d.nombre, true
from master.destinos d
on conflict (id) do nothing;

-- 2) Los orígenes reales: todos los que ya usan las rutas y los viajes, por cliente.
--    (El catálogo global se queda corto: había orígenes usados que no estaban en la lista.)
with base as (
  select coalesce(max(nullif(regexp_replace(id, '\D', '', 'g'), '')::int), 0) as m
  from master.lugares where tipo = 'ORIGEN'
), o as (
  select cliente_id, nombre, row_number() over (order by cliente_id, nombre) as n
  from (
    select distinct cliente_id, btrim(origen_id) as nombre
      from master.rutas where btrim(coalesce(origen_id, '')) <> ''
    union
    select distinct cliente_id, btrim(origen_id) as nombre
      from master.viajes where btrim(coalesce(origen_id, '')) <> ''
  ) u
)
insert into master.lugares (id, cliente_id, tipo, nombre, activo)
select 'O-' || lpad((base.m + o.n)::text, 4, '0'), o.cliente_id, 'ORIGEN', o.nombre, true
from o cross join base
where not exists (
  select 1 from master.lugares l
   where l.cliente_id = o.cliente_id and l.tipo = 'ORIGEN' and lower(l.nombre) = lower(o.nombre))
on conflict (id) do nothing;

-- 3) Columnas nuevas (aditivas) y llaves foráneas.
alter table master.rutas  add column if not exists lugar_origen_id  text references master.lugares(id);
alter table master.rutas  add column if not exists lugar_destino_id text references master.lugares(id);
alter table master.viajes add column if not exists lugar_origen_id  text references master.lugares(id);
alter table master.viajes add column if not exists lugar_destino_id text references master.lugares(id);

-- 4) Relleno histórico.
update master.rutas r
   set lugar_origen_id = l.id
  from master.lugares l
 where l.cliente_id = r.cliente_id and l.tipo = 'ORIGEN'
   and lower(l.nombre) = lower(btrim(r.origen_id)) and r.lugar_origen_id is null;

update master.rutas r
   set lugar_destino_id = d.id
  from master.lugares d
 where d.id = r.destino_id and d.tipo = 'DESTINO' and r.lugar_destino_id is null;

update master.viajes v
   set lugar_origen_id = r.lugar_origen_id,
       lugar_destino_id = coalesce(r.lugar_destino_id, v.lugar_destino_id)
  from master.rutas r
 where r.id = v.ruta_id and v.lugar_origen_id is null;

update master.viajes v
   set lugar_destino_id = d.id
  from master.lugares d
 where d.id = v.destino_id and d.tipo = 'DESTINO' and v.lugar_destino_id is null;

update master.viajes v
   set lugar_origen_id = l.id
  from master.lugares l
 where l.cliente_id = v.cliente_id and l.tipo = 'ORIGEN'
   and lower(l.nombre) = lower(btrim(v.origen_id)) and v.lugar_origen_id is null;

-- 5) Compatibilidad: las columnas viejas se llenan solas desde los lugares.
create or replace function app.sincronizar_lugar() returns trigger
language plpgsql as $function$
begin
  if new.lugar_origen_id is not null then
    new.origen_id := coalesce((select nombre from master.lugares where id = new.lugar_origen_id), new.origen_id);
  end if;
  if new.lugar_destino_id is not null then
    new.destino_id := new.lugar_destino_id;
  end if;
  return new;
end $function$;

drop trigger if exists trg_rutas_sync_lugar on master.rutas;
create trigger trg_rutas_sync_lugar before insert or update on master.rutas
  for each row execute function app.sincronizar_lugar();

drop trigger if exists trg_viajes_sync_lugar on master.viajes;
create trigger trg_viajes_sync_lugar before insert or update on master.viajes
  for each row execute function app.sincronizar_lugar();

-- 6) Contador para los lugares nuevos que se den de alta desde la app.
insert into master.secuencias (clave, valor)
select 'lug', coalesce(max(nullif(regexp_replace(id, '\D', '', 'g'), '')::bigint), 0) + 1 from master.lugares
on conflict (clave) do update set valor = greatest(master.secuencias.valor, excluded.valor);
