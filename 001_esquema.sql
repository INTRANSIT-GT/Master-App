-- =====================================================================
-- 001 · ESQUEMA · Master App de Transportes (In Transit)
-- Ejecutar en el SQL Editor de Supabase (o con la CLI) en orden: 001, 002, 003, 004.
-- Convenciones:
--  * Identificadores estables de texto generados por la aplicación (viajes '000123', rutas 'R-0001', facturas 'AGR-0001'...).
--  * Fechas con hora de sistema = timestamptz (UTC). Fechas "de negocio" de la hoja (fecha plan, horarios, vigencias) = texto
--    'AAAA-MM-DD' o 'AAAA-MM-DDTHH:MM' con CHECK, tal como se manejan en la hoja VIAJES_TRANSPORTES.
--  * Nada se borra: los triggers impiden DELETE en los registros operativos y UPDATE/DELETE en la auditoría.
--  * Todas las escrituras las hace la Edge Function "api" (con el rol de servicio). Los usuarios NO tienen permisos de escritura.
-- =====================================================================
create schema if not exists app;

-- ---------- Usuarios, accesos y permisos ----------
create table if not exists public.perfiles(
  id uuid primary key references auth.users(id) on delete restrict,
  usuario text not null unique check (usuario ~ '^[a-z0-9._-]{3,30}$'),
  email text unique,
  nombre text not null check (char_length(nombre)>=3),
  rol text not null check (rol in ('ADMIN','ENCARGADO','TORRE','LIQUIDACIONES','COMERCIAL','GERENCIA')),
  activo boolean not null default true,
  proyectos text[] not null default '{}',
  extra jsonb not null default '{}',
  creado_en timestamptz not null default now()
);
comment on table public.perfiles is 'Un perfil por usuario de Supabase Auth. IMPLAN y Encargado de proyecto son el mismo rol: ENCARGADO.';

create table if not exists public.clientes(
  id text primary key check (id ~ '^[A-Z0-9_-]{2,20}$'),
  nombre text not null check (char_length(nombre) between 2 and 60),
  cliente text not null unique,
  proyectos text[] not null default '{}',
  torre_estatus boolean not null default false,
  activo boolean not null default true,
  creado_por text, creado_en timestamptz, modificado_por text, modificado_en timestamptz,
  extra jsonb not null default '{}'
);
create unique index if not exists uq_clientes_nombre on public.clientes (lower(nombre));

create table if not exists public.clientes_fiscal(
  cliente_id text primary key references public.clientes(id),
  nit text not null default '', direccion_fiscal text not null default '', correo_facturacion text not null default '',
  contacto text not null default '', telefono text not null default '', credito_dias text not null default '', observaciones text not null default ''
);
create unique index if not exists uq_clientes_nit on public.clientes_fiscal (nit) where nit<>'';

create table if not exists public.acceso_cliente(
  user_id uuid not null references public.perfiles(id),
  cliente_id text not null references public.clientes(id),
  primary key (user_id, cliente_id)
);
create table if not exists public.permisos(rol text not null, permiso text not null, habilitado boolean not null default false, primary key (rol, permiso));
create table if not exists public.permisos_prohibidos(rol text not null, permiso text not null, primary key (rol, permiso));
create table if not exists public.config(clave text primary key, valor jsonb not null);
create table if not exists public.secuencias(clave text primary key, valor bigint not null);

-- ---------- Catálogos maestros (se cargan desde tus hojas PILOTOS, FLOTA y DESTINOS) ----------
create table if not exists public.flota(unidad text primary key, placa text not null default '', tango text not null default '', capacidad text not null default '', tipo text not null default '');
create table if not exists public.pilotos(id text primary key, nombre text not null, unidad text references public.flota(unidad), cliente_id text not null references public.clientes(id));
create table if not exists public.destinos(id text primary key, nombre text not null, cliente_id text not null references public.clientes(id));

-- ---------- Rutas y tarifas ----------
create table if not exists public.rutas(
  id text primary key, codigo text not null default '', nombre text not null,
  cliente_id text not null references public.clientes(id), proyecto text not null,
  origen_id text not null default '', destino_id text not null default '',
  estado text not null check (estado in ('ASIGNADA','NO_ASIGNADA','RECHAZADA')),
  origen_prop text not null default '', destino_prop text not null default '', fuente text not null default '',
  solicitada_por_id text, solicitada_por text, solicitada_en timestamptz,
  validada_por text not null default '', validada_en timestamptz, rechazo jsonb, viaje_ref text not null default '',
  extra jsonb not null default '{}',
  -- una ruta ASIGNADA siempre tiene código, origen y destino reales; una pendiente nunca los inventa
  constraint ck_ruta_asignada check ((estado='ASIGNADA') = (codigo<>'' and origen_id<>'' and destino_id<>''))
);
create unique index if not exists uq_ruta_codigo on public.rutas (codigo) where estado='ASIGNADA';
create index if not exists ix_rutas_cliente on public.rutas (cliente_id, proyecto);

create table if not exists public.tarifas(
  id text primary key, cliente_id text not null references public.clientes(id), proyecto text not null,
  ruta_id text not null references public.rutas(id), capacidad text not null,
  importe numeric(14,2) not null check (importe>0),
  vigente_desde text not null check (vigente_desde ~ '^\d{4}-\d{2}-\d{2}$'),
  vigente_hasta text not null default '' check (vigente_hasta ~ '^(\d{4}-\d{2}-\d{2})?$'),
  activa boolean not null default true,
  creado_por_id text, creado_por text, creado_en timestamptz, modificado_por text not null default '', modificado_en timestamptz,
  extra jsonb not null default '{}'
);
create unique index if not exists uq_tarifa_activa on public.tarifas (cliente_id, proyecto, ruta_id, capacidad, vigente_desde) where activa;

-- ---------- Viajes: un único registro por viaje durante todo su ciclo de vida ----------
create table if not exists public.viajes(
  id text primary key check (id ~ '^\d{6,}$'),
  cliente_id text not null references public.clientes(id),
  proyecto_cat text not null,
  shipment text not null default '', no_viaje text not null default '', opl text not null default '',
  tipo_viaje text not null default '', tipo_carga text not null default '', no_carga text not null default '', producto text not null default '',
  fecha_plan text not null check (fecha_plan ~ '^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$'),
  estatus text not null default 'EN ESPERA',
  piloto_id text not null references public.pilotos(id),
  unidad_id text references public.flota(unidad),
  origen_id text not null default '', destino_id text not null default '',
  ruta_id text not null references public.rutas(id),
  ruta_ref text not null default '', no_doc_retorno text not null default '',
  t_ingreso_planta text not null default '', t_espera_rampa text not null default '', t_rampa text not null default '',
  t_inicio_carga text not null default '', t_fin_carga text not null default '', t_salida_planta text not null default '',
  t_salida text not null default '', t_ingreso_bodega text not null default '', t_inicio_descarga text not null default '', t_fin_descarga text not null default '',
  estado text not null check (estado in ('PENDIENTE','EN_CURSO','FINALIZADO','PENDIENTE_LIQUIDACION','EN_REVISION','PENDIENTE_CORRECCION','APROBADA','PENDIENTE_COMERCIAL','COMERCIAL_REGISTRADA')),
  creado_por text, creado_por_id text, creado_en timestamptz,
  iniciado_por text, iniciado_en timestamptz, finalizado_por text, finalizado_en timestamptz,
  enviado_por text, enviado_en timestamptz, revisado_por text, revisado_en timestamptz,
  aprobado_por text, aprobado_en timestamptz, editado_por text, editado_en timestamptz,
  comentario_revision text not null default '', liq_intentos integer not null default 0, liq_actual_id text not null default '',
  liq_aprobada_en timestamptz, agrupacion_id text not null default '', numero_factura text not null default '',
  extra jsonb not null default '{}',
  constraint ck_tiempos check (
    (t_ingreso_planta||t_espera_rampa||t_rampa||t_inicio_carga||t_fin_carga||t_salida_planta||t_salida||t_ingreso_bodega||t_inicio_descarga||t_fin_descarga) ~ '^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})*$')
);
create unique index if not exists uq_viaje_duplicado on public.viajes (fecha_plan, piloto_id, ruta_id);
create index if not exists ix_viajes_cliente on public.viajes (cliente_id, proyecto_cat, estado);
-- Datos económicos separados para poder protegerlos por permiso (RLS es por fila, no por columna)
create table if not exists public.viajes_tarifa(viaje_id text primary key references public.viajes(id), tarifa_cliente numeric(14,2), tarifa_id text not null default '', tarifa_aplicada_por text not null default '', tarifa_aplicada_en timestamptz);
create table if not exists public.viajes_costos(viaje_id text primary key references public.viajes(id), costo_proveedor numeric(14,2));
create table if not exists public.viajes_viaticos(viaje_id text primary key references public.viajes(id), q_viaticos numeric(14,2));

-- ---------- Liquidaciones y evidencias (un renglón por envío; nunca se sobrescribe) ----------
create table if not exists public.liquidaciones(
  id text primary key, viaje_id text not null references public.viajes(id), ciclo integer not null check (ciclo>=1),
  envio_por_id text, envio_por text, envio_en timestamptz, evidencia_id text not null default '',
  decision text not null default '' check (decision in ('','APROBADA','DEVUELTA')),
  revisor_id text not null default '', revisor text not null default '', revision_en timestamptz, comentario text not null default '',
  extra jsonb not null default '{}',
  unique (viaje_id, ciclo),
  constraint ck_devolucion_con_comentario check (decision<>'DEVUELTA' or char_length(comentario)>=5)
);
create table if not exists public.evidencias(
  id text primary key, viaje_id text not null references public.viajes(id), liq_id text not null default '',
  path text not null default '' check (path ~ '^$|^viajes/\d{6,}/[A-Za-z0-9._-]{8,90}$'),
  por_id text, por text, en timestamptz, extra jsonb not null default '{}'
);

-- ---------- Facturación: preparada → enviada → emitida (con evidencia) → cobros ----------
create table if not exists public.agrupaciones(
  id text primary key, cliente_id text not null references public.clientes(id),
  modalidad text not null check (modalidad in ('INDIVIDUAL','AGRUPADA')),
  fase text not null check (fase in ('PREPARADA','ENVIADA','EMITIDA')),
  viaje_ids text[] not null check (cardinality(viaje_ids)>=1),
  numero_factura text not null default '', fecha_factura text not null default '',
  importe_enviado numeric(14,2), importes_viaje jsonb not null default '{}', viajes_sin_importe jsonb not null default '[]',
  importe_facturado numeric(14,2), envio jsonb, emision jsonb, cobros jsonb not null default '[]' check (jsonb_typeof(cobros)='array'),
  estado text not null check (estado in ('ACTIVA','ANULADA')),
  creado_por_id text, creado_por text, creado_en timestamptz, anulada jsonb, correcciones jsonb not null default '[]',
  extra jsonb not null default '{}',
  -- una factura no puede estar enviada ni emitida sin su número; emitida exige evidencia
  constraint ck_factura_enviada check (fase='PREPARADA' or numero_factura<>''),
  constraint ck_factura_emitida check (fase<>'EMITIDA' or (emision is not null and importe_facturado is not null))
);
create unique index if not exists uq_factura_numero on public.agrupaciones (lower(numero_factura)) where estado='ACTIVA' and numero_factura<>'';
create table if not exists public.pagos(
  id text primary key, tipo text not null check (tipo in ('PROVEEDOR','PILOTO')), viaje_id text not null references public.viajes(id),
  beneficiario text not null default '', monto numeric(14,2) not null check (monto>0), fecha text not null check (fecha ~ '^\d{4}-\d{2}-\d{2}$'),
  referencia text not null check (char_length(referencia) between 3 and 40),
  por_id text, por text, en timestamptz, anulado jsonb, extra jsonb not null default '{}'
);

-- ---------- Notificaciones (solo dentro de la aplicación) y auditoría ----------
create table if not exists public.notificaciones(
  id text primary key, tipo text not null, destinatarios text[] not null default '{}', usuarios text[] not null default '{}',
  asunto text not null, detalle jsonb not null default '{}', creada_por text, creada_por_id text, creada_en timestamptz,
  leida_por text[] not null default '{}', canal text not null default 'EN_APP', externo jsonb not null default '{}', extra jsonb not null default '{}'
);
create table if not exists public.auditoria(
  id text primary key, entidad text not null, viaje_id text not null default '', accion text not null,
  campo text not null default '', anterior text not null default '', nuevo text not null default '',
  por_id text not null, por text not null, rol text not null default '', en timestamptz not null,
  motivo text not null default '', ref text not null default '', prev text not null, hash text not null, extra jsonb not null default '{}'
);
create index if not exists ix_auditoria_viaje on public.auditoria (viaje_id);
create index if not exists ix_auditoria_entidad on public.auditoria (entidad, en);

-- ---------- Integridad: nada se borra; la auditoría es de solo agregar ----------
create or replace function app.bloquear_modificacion() returns trigger language plpgsql as $$
begin
  raise exception 'Operación no permitida: % sobre % (los registros operativos no se borran ni la auditoría se modifica)', tg_op, tg_table_name using errcode='42501';
end $$;
drop trigger if exists trg_aud_nomod on public.auditoria;
create trigger trg_aud_nomod before update or delete on public.auditoria for each row execute function app.bloquear_modificacion();
drop trigger if exists trg_aud_notrunc on public.auditoria;
create trigger trg_aud_notrunc before truncate on public.auditoria for each statement execute function app.bloquear_modificacion();
do $$ declare t text; begin
  foreach t in array array['viajes','liquidaciones','evidencias','agrupaciones','pagos','rutas','tarifas','notificaciones'] loop
    execute format('drop trigger if exists trg_%1$s_nodel on public.%1$s; create trigger trg_%1$s_nodel before delete on public.%1$s for each row execute function app.bloquear_modificacion();',t);
  end loop;
end $$;

-- Transiciones de estado válidas (red de seguridad de la base; la regla completa vive en la Edge Function)
create table if not exists public.transiciones_estado(desde text not null, hasta text not null, primary key (desde, hasta));
insert into public.transiciones_estado(desde,hasta) values
 ('PENDIENTE','EN_CURSO'),('EN_CURSO','FINALIZADO'),('FINALIZADO','PENDIENTE_LIQUIDACION'),('PENDIENTE_LIQUIDACION','EN_REVISION'),
 ('EN_REVISION','APROBADA'),('EN_REVISION','PENDIENTE_CORRECCION'),('PENDIENTE_CORRECCION','EN_REVISION'),('APROBADA','PENDIENTE_COMERCIAL'),
 ('PENDIENTE_COMERCIAL','COMERCIAL_REGISTRADA'),('COMERCIAL_REGISTRADA','PENDIENTE_COMERCIAL')
on conflict do nothing;
create or replace function app.validar_transicion() returns trigger language plpgsql as $$
begin
  if new.estado is distinct from old.estado then
    -- la Edge Function puede encadenar pasos automáticos dentro de una misma operación (p. ej. FINALIZADO → PENDIENTE_LIQUIDACION);
    -- aquí se exige que el salto final sea alcanzable por una cadena de transiciones válidas.
    if not exists (
      with recursive r(e) as (select old.estado union select t.hasta from public.transiciones_estado t join r on t.desde=r.e)
      select 1 from r where e=new.estado and e<>old.estado) then
      raise exception 'Transición de estado no válida: % → %', old.estado, new.estado using errcode='23514';
    end if;
  end if;
  return new;
end $$;
drop trigger if exists trg_viajes_transicion on public.viajes;
create trigger trg_viajes_transicion before update on public.viajes for each row execute function app.validar_transicion();
