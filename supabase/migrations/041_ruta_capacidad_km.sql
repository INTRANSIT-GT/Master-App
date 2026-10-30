-- 041 · Datos operativos de la ruta
-- La solicitud de una ruta nueva debe indicar la capacidad de la unidad y los kilómetros.
-- Las rutas históricas quedan con capacidad vacía y kilómetros nulos hasta que se completen.

begin;

alter table master.rutas add column if not exists capacidad text not null default '';
alter table master.rutas add column if not exists km numeric(10,2);

alter table master.rutas drop constraint if exists ck_ruta_km;
alter table master.rutas add constraint ck_ruta_km check (km is null or (km > 0 and km <= 100000));

commit;
