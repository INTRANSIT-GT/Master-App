-- 037 · La evidencia de la OT usa el permiso nuevo
-- La migración 036 retiró comercial_confirmar, pero las políticas de Storage
-- seguían exigiéndolo. Sin este ajuste, el Asistente Comercial no puede subir
-- la autorización (autorizacion-) ni el rechazo (rechazo-) de la agrupación.

create or replace function app.puede_subir(nombre text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'master', 'pg_temp'
as $function$
  select coalesce(
    case split_part(nombre,'/',1)
      when 'viajes' then exists (select 1 from master.viajes v
          where v.id=split_part(nombre,'/',2) and app.perm('liq_enviar') and app.asignado(v.cliente_id, v.proyecto_cat)
            and v.estado in ('ENTREGADO','RECHAZADO'))
      when 'facturas' then exists (select 1 from master.agrupaciones g
          where g.id=split_part(nombre,'/',2) and g.estado='ACTIVA' and (
                (g.fase='ENVIADA' and app.perm('facturas_emitir') and split_part(nombre,'/',3) !~ '^(interno|cliente|autorizacion|rechazo|cobro)-')
             or (g.fase='EMITIDA' and app.perm('cobros_registrar') and split_part(nombre,'/',3) like 'cobro-%')
             or (g.fase='PREPARADA' and (g.extra->>'confirmacion') is null and (
                   (app.perm('comercial_agrupar') and split_part(nombre,'/',3) ~ '^(interno|cliente)-')
                or (app.perm('comercial_ot') and split_part(nombre,'/',3) ~ '^(autorizacion|rechazo)-')))))
      when 'pagos' then exists (select 1 from master.ordenes_pago o
          where o.id=split_part(nombre,'/',2) and app.perm('pagos_registrar') and o.estado='ACTIVA')
      when 'oc' then exists (select 1 from master.ordenes_compra o
          where o.id=split_part(nombre,'/',2)
            and ((app.perm('oc_preparar') and o.estado='PREPARADA') or (app.perm('oc_responder') and o.estado='ENVIADA')))
      else false end, false)
  and split_part(nombre,'/',3)<>'' and split_part(nombre,'/',4)=''
  and split_part(nombre,'/',3) ~ '^[A-Za-z0-9._-]{8,90}$'
$function$;

create or replace function app.puede_ver_archivo(nombre text)
 returns boolean
 language sql
 stable security definer
 set search_path to 'master', 'pg_temp'
as $function$
  select coalesce(
    case split_part(nombre,'/',1)
      when 'viajes' then app.viaje_visible(split_part(nombre,'/',2)) and (app.perm('liq_ver') or app.perm('liq_enviar'))
      when 'facturas' then (app.perm('comercial_ver') or app.perm('finanzas_ver'))
          and (split_part(nombre,'/',3) not like 'interno-%' or app.perm('comercial_ot') or app.perm('finanzas_ver'))
      when 'pagos' then app.perm('finanzas_ver') or app.perm('pagos_registrar')
      when 'oc' then exists (select 1 from master.ordenes_compra o where o.id=split_part(nombre,'/',2) and app.oc_visible(o.estado))
      else false end, false)
$function$;
