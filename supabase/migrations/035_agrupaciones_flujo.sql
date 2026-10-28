-- =====================================================================
-- 035 · FLUJO COMERCIAL → CLIENTE → FACTURACIÓN → COBRO (agrupaciones de cobro)
-- PREPARADA PARA REVISIÓN: NO se ha ejecutado en ningún entorno. Aplicar solo con autorización, DESPUÉS de la 034.
--
-- Reutiliza master.agrupaciones (la factura/agrupación que ya existe). NO cambia su esquema ni sus restricciones:
--   · «Cliente confirmó» (g.confirmacion), los PDF por versiones (g.pdfs), la evidencia de autorización
--     (g.evidenciasAutorizacion) y el historial (g.historial) viajan en la columna jsonb «extra».
--   · La fase sigue siendo PREPARADA → ENVIADA → EMITIDA; «Cliente confirmó» es un evento dentro de PREPARADA.
-- Qué agrega:
--   1) Permiso comercial_confirmar (autorización del cliente): Gerencia Comercial, Analista Comercial y Administrador.
--   2) Gerencia/Analista Comercial pueden agrupar (comercial_agrupar); Facturación puede registrar cobros (cobros_registrar).
--   3) Almacenamiento privado (bucket «evidencias», prefijo facturas/<AGR-id>/):
--        interno-*        reporte PDF interno (solo quien confirma con el cliente o consulta finanzas lo ve)
--        cliente-*        reporte PDF para el cliente
--        autorizacion-*   evidencia de la autorización del cliente (se sube antes de «Cliente confirmó»)
--        cobro-*          comprobante del cobro
--        <otro nombre>    comprobante de envío de la factura (como hasta hoy, al estar la agrupación ENVIADA)
-- Orden de despliegue seguro: (1) 034, (2) esta migración, (3) desplegar la función api, (4) publicar la aplicación.
-- =====================================================================

-- ---------- 1) Permisos ----------
insert into master.permisos (rol, permiso, habilitado)
select r.rol, 'comercial_confirmar', r.rol in ('ADMIN','GERENTE_COMERCIAL','ANALISTA_COMERCIAL')
  from (values ('ADMIN'),('GERENTE_TRANSPORTE'),('VALIDADOR'),('OPERATIVO'),('ANALISTA_COMERCIAL'),('GERENTE_COMERCIAL'),
               ('FACTURACION'),('COBROS'),('PAGO_OPL'),('TORRE'),('PROYECTOS')) as r(rol)
on conflict (rol, permiso) do nothing;

-- Comercial agrupa; Facturación registra el cobro (decisión de negocio). Solo se sube a «Sí», nunca se quita nada.
insert into master.permisos (rol, permiso, habilitado) values
  ('GERENTE_COMERCIAL','comercial_agrupar',true),
  ('ANALISTA_COMERCIAL','comercial_agrupar',true),
  ('FACTURACION','cobros_registrar',true)
on conflict (rol, permiso) do update set habilitado = true;

-- Separación de funciones: la autorización del cliente no se puede dar a estos perfiles ni desde la matriz.
insert into master.permisos_prohibidos (rol, permiso)
select r.rol, 'comercial_confirmar'
  from (values ('GERENTE_TRANSPORTE'),('VALIDADOR'),('OPERATIVO'),('FACTURACION'),('COBROS'),('PAGO_OPL'),('TORRE'),('PROYECTOS')) as r(rol)
on conflict do nothing;
-- Facturación NO agrupa viajes ni prepara facturas/OC: lo hace Comercial. Se baja el permiso y se veta.
update master.permisos set habilitado=false where rol='FACTURACION' and permiso='comercial_agrupar';
insert into master.permisos_prohibidos (rol, permiso) values ('FACTURACION','comercial_agrupar') on conflict do nothing;
-- Facturación sí puede registrar cobros: se retira el veto anterior (si existía).
delete from master.permisos_prohibidos where rol='FACTURACION' and permiso='cobros_registrar';

-- ---------- 2) Almacenamiento privado ----------
-- Conserva TODAS las ramas de la 034 (viajes, pagos, oc) y amplía «facturas».
create or replace function app.puede_subir(nombre text) returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select coalesce(
    case split_part(nombre,'/',1)
      when 'viajes' then exists (select 1 from master.viajes v
          where v.id=split_part(nombre,'/',2) and app.perm('liq_enviar') and app.asignado(v.cliente_id, v.proyecto_cat)
            and v.estado in ('ENTREGADO','RECHAZADO'))
      when 'facturas' then exists (select 1 from master.agrupaciones g
          where g.id=split_part(nombre,'/',2) and g.estado='ACTIVA' and (
                (g.fase='ENVIADA' and app.perm('facturas_emitir') and split_part(nombre,'/',3) !~ '^(interno|cliente|autorizacion|cobro)-')
             or (g.fase='EMITIDA' and app.perm('cobros_registrar') and split_part(nombre,'/',3) like 'cobro-%')
             or (g.fase='PREPARADA' and (g.extra->>'confirmacion') is null and (
                   (app.perm('comercial_agrupar') and split_part(nombre,'/',3) ~ '^(interno|cliente)-')
                or (app.perm('comercial_confirmar') and split_part(nombre,'/',3) like 'autorizacion-%')))))
      when 'pagos' then exists (select 1 from master.ordenes_pago o
          where o.id=split_part(nombre,'/',2) and app.perm('pagos_registrar') and o.estado='ACTIVA')
      when 'oc' then exists (select 1 from master.ordenes_compra o
          where o.id=split_part(nombre,'/',2)
            and ((app.perm('oc_preparar') and o.estado='PREPARADA') or (app.perm('oc_responder') and o.estado='ENVIADA')))
      else false end, false)
  and split_part(nombre,'/',3)<>'' and split_part(nombre,'/',4)=''
  and split_part(nombre,'/',3) ~ '^[A-Za-z0-9._-]{8,90}$'
$$;

create or replace function app.puede_ver_archivo(nombre text) returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select coalesce(
    case split_part(nombre,'/',1)
      when 'viajes' then app.viaje_visible(split_part(nombre,'/',2)) and (app.perm('liq_ver') or app.perm('liq_enviar'))
      when 'facturas' then (app.perm('comercial_ver') or app.perm('finanzas_ver'))
          and (split_part(nombre,'/',3) not like 'interno-%' or app.perm('comercial_confirmar') or app.perm('finanzas_ver'))
      when 'pagos' then app.perm('finanzas_ver') or app.perm('pagos_registrar')
      when 'oc' then exists (select 1 from master.ordenes_compra o where o.id=split_part(nombre,'/',2) and app.oc_visible(o.estado))
      else false end, false)
$$;
revoke all on function app.puede_subir(text), app.puede_ver_archivo(text) from public, anon;
grant execute on function app.puede_subir(text), app.puede_ver_archivo(text) to authenticated;
