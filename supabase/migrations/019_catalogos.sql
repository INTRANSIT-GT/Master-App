-- 019 · Las listas del sistema (tipo de unidad, OPL, tipo de carga, tipo de viaje y orígenes)
-- viven en Supabase (master.catalogos) y se editan desde la pantalla Catálogos de la aplicación.

create table if not exists master.catalogos (
  clave text primary key,
  etiqueta text not null,
  valores jsonb not null default '[]'::jsonb,
  descripcion text,
  actualizado_por text,
  actualizado_en timestamptz not null default now());

-- valores de arranque (los que ya usa la aplicación)
insert into master.catalogos (clave, etiqueta, valores, descripcion) values
  ('opl', 'OPL · Transportistas', '["GTL", "INTRANSIT", "J&J", "GRIJALVA", "TRANS. HERNANDEZ", "CATALAN"]'::jsonb, 'Lista del sistema: se usa en los desplegables y para validar. Se edita desde la aplicación.'),
  ('origen', 'Orígenes', '["PET", "SRG", "VN", "Z18", "ATA", "CHIM", "CHIQ", "EMB", "GTY", "ABASA", "CENTRAL", "INTRANSIT PETAPA", "INTRANSIT Z11", "SEREGUA", "LP", "LV", "MZT", "CMI DELTA BARCENAS", "PLANTA INHSA", "PLANTA MODERNOS", "CG", "CP", "MALACATAN", "XELA", "OMNIA", "HUEHUE", "SANTA CATARINA"]'::jsonb, 'Lista del sistema: se usa en los desplegables y para validar. Se edita desde la aplicación.'),
  ('tipoCarga', 'Tipo de carga', '["KG", "CAJAS", "TARIMAS"]'::jsonb, 'Lista del sistema: se usa en los desplegables y para validar. Se edita desde la aplicación.'),
  ('tipoUnidad', 'Tipo de unidad', '["RAS S", "RAS L", "RAS A", "RAS", "FUR", "5TON", "10TON", "12TON", "53\""]'::jsonb, 'Lista del sistema: se usa en los desplegables y para validar. Se edita desde la aplicación.'),
  ('tipoViaje', 'Tipo de viaje', '["ONE WAY", "ROUD TRIP", "MAYOREO", "DETALLE", "NA"]'::jsonb, 'Lista del sistema: se usa en los desplegables y para validar. Se edita desde la aplicación.')
on conflict (clave) do update set etiqueta = excluded.etiqueta, descripcion = excluded.descripcion;

-- permiso nuevo para editar las listas (la administradora lo tiene; los demás roles se habilitan desde la matriz)
insert into master.permisos (rol, permiso, habilitado) values
  ('ADMIN', 'catalogos_editar', true),
  ('GERENTE_TRANSPORTE', 'catalogos_editar', false),
  ('VALIDADOR', 'catalogos_editar', false),
  ('OPERATIVO', 'catalogos_editar', false),
  ('ANALISTA_COMERCIAL', 'catalogos_editar', false),
  ('GERENTE_COMERCIAL', 'catalogos_editar', false),
  ('FACTURACION', 'catalogos_editar', false),
  ('COBROS', 'catalogos_editar', false),
  ('PAGO_OPL', 'catalogos_editar', false),
  ('TORRE', 'catalogos_editar', false),
  ('PROYECTOS', 'catalogos_editar', false)
on conflict (rol, permiso) do update set habilitado = excluded.habilitado;
