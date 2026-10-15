-- =====================================================================
-- 003 · ALMACENAMIENTO PROTEGIDO · bucket privado "evidencias"
--   viajes/<id_viaje>/<archivo>        evidencia de liquidación
--   facturas/<id_agrupacion>/<archivo> evidencia de emisión de factura
-- El bucket NO es público. Las fotos se ven con enlaces firmados de corta duración que genera la Edge Function
-- solo para quien ya puede ver ese viaje/factura. Nadie puede borrar ni sobrescribir archivos (no hay políticas de UPDATE/DELETE).
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('evidencias','evidencias',false,3145728,array['image/jpeg','image/png','image/webp','application/pdf'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;

create or replace function app.puede_subir(nombre text) returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select coalesce(
    case split_part(nombre,'/',1)
      when 'viajes' then exists (select 1 from master.viajes v
          where v.id=split_part(nombre,'/',2) and app.perm('liq_enviar') and app.asignado(v.cliente_id, v.proyecto_cat)
            and v.estado in ('ENTREGADO','RECHAZADO'))
      when 'facturas' then exists (select 1 from master.agrupaciones g
          where g.id=split_part(nombre,'/',2) and app.perm('facturas_emitir') and g.fase='ENVIADA' and g.estado='ACTIVA')
      else false end, false)
  and split_part(nombre,'/',3)<>'' and split_part(nombre,'/',4)=''
  and split_part(nombre,'/',3) ~ '^[A-Za-z0-9._-]{8,90}$'
$$;
create or replace function app.puede_ver_archivo(nombre text) returns boolean language sql stable security definer set search_path=master,pg_temp as $$
  select coalesce(
    case split_part(nombre,'/',1)
      when 'viajes' then app.viaje_visible(split_part(nombre,'/',2)) and (app.perm('liq_ver') or app.perm('liq_enviar'))
      when 'facturas' then app.perm('comercial_ver') or app.perm('finanzas_ver')
      else false end, false)
$$;
revoke all on function app.puede_subir(text), app.puede_ver_archivo(text) from public, anon;
grant execute on function app.puede_subir(text), app.puede_ver_archivo(text) to authenticated;

drop policy if exists ev_subir on storage.objects;
drop policy if exists ev_ver on storage.objects;
create policy ev_subir on storage.objects for insert to authenticated with check (bucket_id='evidencias' and app.puede_subir(name));
create policy ev_ver on storage.objects for select to authenticated using (bucket_id='evidencias' and app.puede_ver_archivo(name));
