-- 020 · Lista de equipos de arrastre (placas de los remolques).
-- La aplicación la usa en el viaje: al elegir la unidad propone el último arrastre que usó esa
-- unidad y solo deja escoger entre las placas de esta lista (se puede editar desde Catálogos).
-- Se arma con lo que ya existe en la base: las placas de flota que parecen arrastre (empiezan con TC)
-- y las que ya se registraron en viajes. Si no hay ninguna, la lista queda vacía y se puede cargar a mano.

insert into master.catalogos (clave, etiqueta, valores, descripcion)
select 'arrastre',
       'Equipos de arrastre (placas)',
       coalesce(jsonb_agg(distinct p order by p), '[]'::jsonb),
       'Placas de los equipos de arrastre (remolques). La aplicación propone la última usada por la unidad y solo permite elegir de esta lista. Se edita desde Catálogos.'
from (
  select placa as p from master.flota where coalesce(placa,'') <> '' and placa ilike 'TC%'
  union
  select placa_arrastre as p from master.viajes where coalesce(placa_arrastre,'') <> ''
) s
on conflict (clave) do update
  set valores = excluded.valores,
      etiqueta = excluded.etiqueta
  where master.catalogos.valores = '[]'::jsonb;   /* si ya se editó a mano, no se pisa */
