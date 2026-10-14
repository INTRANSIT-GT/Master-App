-- Los clientes migrados quedaron sin proyectos. Sin esa lista, el servidor descarta cualquier
-- proyecto que se intente asignar a un usuario (solo acepta proyectos que pertenecen al cliente),
-- y por eso la pantalla de Usuarios "no actualizaba" los proyectos.
-- Aquí se completan los proyectos de cada cliente con los que ya existen en sus viajes y rutas.
begin;

update master.clientes c
set proyectos = x.proyectos
from (
  select cliente_id, array_agg(distinct p order by p) as proyectos
  from (
    select v.cliente_id, v.proyecto_cat as p from master.viajes v where coalesce(v.proyecto_cat,'')<>''
    union
    select r.cliente_id, r.proyecto as p from master.rutas r where coalesce(r.proyecto,'')<>''
  ) s
  group by cliente_id
) x
where c.id = x.cliente_id
  and (c.proyectos is null or cardinality(c.proyectos) = 0);

commit;
