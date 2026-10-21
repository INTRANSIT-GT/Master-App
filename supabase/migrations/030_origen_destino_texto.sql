-- 030_origen_destino_texto.sql · El origen y el destino se escriben en la ruta (y el viaje los hereda).
-- Se retira el catálogo master.lugares: cada ruta pertenece a un cliente y sus lugares quedan ligados por la ruta.
begin;

alter table master.rutas  add column if not exists origen  text not null default '';
alter table master.rutas  add column if not exists destino text not null default '';
alter table master.viajes add column if not exists origen  text not null default '';
alter table master.viajes add column if not exists destino text not null default '';

-- Traslado de los datos: nombre del lugar; si no hay, el texto viejo; si el destino viejo era un id, su nombre.
update master.rutas r set
  origen  = coalesce((select nombre from master.lugares where id = r.lugar_origen_id),  nullif(r.origen_id, ''), ''),
  destino = coalesce((select nombre from master.lugares where id = r.lugar_destino_id), (select nombre from master.destinos where id = r.destino_id), nullif(r.destino_id, ''), '');

update master.viajes v set
  origen  = coalesce((select nombre from master.lugares where id = v.lugar_origen_id),  nullif(v.origen_id, ''), ''),
  destino = coalesce((select nombre from master.lugares where id = v.lugar_destino_id), (select nombre from master.destinos where id = v.destino_id), nullif(v.destino_id, ''), '');

-- Una ruta activa exige código, origen y destino (ahora sobre las columnas de texto).
alter table master.rutas drop constraint if exists ck_ruta_activa;
alter table master.rutas add constraint ck_ruta_activa
  check (estado not in ('EN_TARIFACION', 'PENDIENTE_APROBACION', 'ACTIVA') or (codigo <> '' and origen <> '' and destino <> ''));

-- Fuera el catálogo de lugares y sus columnas.
drop trigger if exists trg_rutas_sync_lugar  on master.rutas;
drop trigger if exists trg_viajes_sync_lugar on master.viajes;
drop function if exists app.sincronizar_lugar();

alter table master.rutas  drop column if exists lugar_origen_id, drop column if exists lugar_destino_id;
alter table master.viajes drop column if exists lugar_origen_id, drop column if exists lugar_destino_id;
drop table if exists master.lugares;

delete from master.secuencias where clave = 'lug';
delete from master.catalogos   where clave = 'origen';

-- Las columnas viejas (origen_id / destino_id) se conservan como espejo del texto para los reportes que ya existan.
create or replace function app.espejo_lugar_texto() returns trigger language plpgsql as $$
begin
  new.origen_id  := coalesce(nullif(new.origen, ''), '');
  new.destino_id := coalesce(nullif(new.destino, ''), '');
  return new;
end $$;
drop trigger if exists trg_rutas_espejo_lugar  on master.rutas;
create trigger trg_rutas_espejo_lugar  before insert or update on master.rutas  for each row execute function app.espejo_lugar_texto();
drop trigger if exists trg_viajes_espejo_lugar on master.viajes;
create trigger trg_viajes_espejo_lugar before insert or update on master.viajes for each row execute function app.espejo_lugar_texto();

commit;
