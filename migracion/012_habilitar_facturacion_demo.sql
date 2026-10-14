-- Completa requisitos de facturación para los datos sintéticos migrados.
-- Los viajes que ya estaban ACEPTADOS representan liquidaciones históricamente aprobadas.
begin;

update master.viajes
set liq_aprobada_en=coalesce(liq_aprobada_en, now() - interval '1 day'),
    revisado_por=case when revisado_por='' then 'Datos de demostración' else revisado_por end,
    revisado_en=coalesce(revisado_en, now() - interval '1 day')
where estado in ('ACEPTADO','FACTURADO','COBRADO') and liq_aprobada_en is null;

-- Una tarifa activa por combinación real de cliente, proyecto, ruta y capacidad.
insert into master.tarifas(id,cliente_id,proyecto,ruta_id,capacidad,importe,vigente_desde,activa,creado_por,creado_en)
select 'T-DEMO-'||substr(md5(v.cliente_id||'|'||v.proyecto_cat||'|'||v.ruta_id||'|'||coalesce(nullif(f.capacidad,''),'GENERAL')),1,18),
       v.cliente_id,v.proyecto_cat,v.ruta_id,coalesce(nullif(f.capacidad,''),'GENERAL'),
       1250 + (abs(hashtext(v.ruta_id||coalesce(f.capacidad,''))) % 18) * 125,
       '2020-01-01',true,'Datos de demostración',now()
from master.viajes v
join master.flota f on f.unidad=v.unidad_id
left join master.tarifas t on t.cliente_id=v.cliente_id and t.proyecto=v.proyecto_cat and t.ruta_id=v.ruta_id
  and t.capacidad=coalesce(nullif(f.capacidad,''),'GENERAL') and t.activa
where v.estado in ('ACEPTADO','FACTURADO','COBRADO') and t.id is null
group by v.cliente_id,v.proyecto_cat,v.ruta_id,f.capacidad
on conflict do nothing;

-- Fija la tarifa vigente a viajes aceptados todavía sin importe, para que puedan facturarse.
insert into master.viajes_tarifa(viaje_id,tarifa_cliente,tarifa_id,tarifa_aplicada_por,tarifa_aplicada_en)
select v.id,t.importe,t.id,'Datos de demostración',now()
from master.viajes v
join master.flota f on f.unidad=v.unidad_id
join master.tarifas t on t.cliente_id=v.cliente_id and t.proyecto=v.proyecto_cat and t.ruta_id=v.ruta_id
  and t.capacidad=coalesce(nullif(f.capacidad,''),'GENERAL') and t.activa
left join master.viajes_tarifa vt on vt.viaje_id=v.id
where v.estado='ACEPTADO' and vt.viaje_id is null;

update master.viajes_tarifa vt
set tarifa_cliente=t.importe,tarifa_id=t.id,tarifa_aplicada_por='Datos de demostración',tarifa_aplicada_en=now()
from master.viajes v
join master.flota f on f.unidad=v.unidad_id
join master.tarifas t on t.cliente_id=v.cliente_id and t.proyecto=v.proyecto_cat and t.ruta_id=v.ruta_id
  and t.capacidad=coalesce(nullif(f.capacidad,''),'GENERAL') and t.activa
where vt.viaje_id=v.id and v.estado='ACEPTADO' and vt.tarifa_cliente is null;

commit;
