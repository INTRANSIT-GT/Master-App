-- Datos sintéticos para recorrer todas las pantallas sin alterar valores ya existentes.
-- Completa solo campos vacíos y crea una muestra pequeña de cada estado/ruta.
begin;

-- Campos operativos: cada Shipment es único y los horarios mantienen una secuencia válida.
update master.viajes
set shipment = case when shipment='' then 'TR-' || id else shipment end,
    opl = case when opl='' then (array['INTRANSIT','GTL','J&J','GRIJALVA'])[1 + (right(id,1)::int % 4)] else opl end,
    tipo_viaje = case when tipo_viaje='' then (array['ONE WAY','ROUD TRIP','MAYOREO','DETALLE'])[1 + (right(id,1)::int % 4)] else tipo_viaje end,
    tipo_carga = case when tipo_carga='' then (array['KG','CAJAS','TARIMAS'])[1 + (right(id,1)::int % 3)] else tipo_carga end,
    no_carga = case when no_carga='' then (20 + (right(id,2)::int % 31))::text else no_carga end,
    producto = case when producto='' then (array['Producto demostración A','Producto demostración B','Producto demostración C'])[1 + (right(id,1)::int % 3)] else producto end,
    placa_arrastre = case when placa_arrastre='' then 'ARR-' || right(id,4) else placa_arrastre end,
    t_ingreso_planta = case when t_ingreso_planta='' then fecha_plan else t_ingreso_planta end,
    t_espera_rampa = case when t_espera_rampa='' then to_char(fecha_plan::timestamp + interval '20 minutes','YYYY-MM-DD"T"HH24:MI') else t_espera_rampa end,
    t_rampa = case when t_rampa='' then to_char(fecha_plan::timestamp + interval '35 minutes','YYYY-MM-DD"T"HH24:MI') else t_rampa end,
    t_inicio_carga = case when t_inicio_carga='' then to_char(fecha_plan::timestamp + interval '50 minutes','YYYY-MM-DD"T"HH24:MI') else t_inicio_carga end,
    t_fin_carga = case when t_fin_carga='' then to_char(fecha_plan::timestamp + interval '90 minutes','YYYY-MM-DD"T"HH24:MI') else t_fin_carga end,
    t_salida_planta = case when t_salida_planta='' then to_char(fecha_plan::timestamp + interval '100 minutes','YYYY-MM-DD"T"HH24:MI') else t_salida_planta end,
    t_salida = case when t_salida='' then to_char(fecha_plan::timestamp + interval '110 minutes','YYYY-MM-DD"T"HH24:MI') else t_salida end,
    t_ingreso_bodega = case when t_ingreso_bodega='' then to_char(fecha_plan::timestamp + interval '4 hours','YYYY-MM-DD"T"HH24:MI') else t_ingreso_bodega end,
    t_inicio_descarga = case when t_inicio_descarga='' then to_char(fecha_plan::timestamp + interval '4 hours 15 minutes','YYYY-MM-DD"T"HH24:MI') else t_inicio_descarga end,
    t_fin_descarga = case when t_fin_descarga='' then to_char(fecha_plan::timestamp + interval '5 hours','YYYY-MM-DD"T"HH24:MI') else t_fin_descarga end;

-- Complementa costos y viáticos solamente donde todavía no existen.
insert into master.viajes_costos(viaje_id,costo_proveedor)
select v.id, round((coalesce(t.tarifa_cliente,1500) * 0.62)::numeric,2)
from master.viajes v left join master.viajes_tarifa t on t.viaje_id=v.id
left join master.viajes_costos c on c.viaje_id=v.id
where c.viaje_id is null;
insert into master.viajes_viaticos(viaje_id,q_viaticos)
select v.id, 175 + (right(v.id,1)::int * 10)
from master.viajes v left join master.viajes_viaticos x on x.viaje_id=v.id
where x.viaje_id is null;

-- Muestra de estados para prueba visual. Se toman viajes entregados no facturados.
create temporary table demo_viajes as
select id, row_number() over(order by id) as n from master.viajes where estado='ENTREGADO' order by id limit 18;
alter table master.viajes disable trigger trg_viajes_transicion;
update master.viajes v set estado='PLANIFICADO', estatus='EN ESPERA' from demo_viajes d where v.id=d.id and d.n between 1 and 3;
update master.viajes v set estado='EN_RUTA', estatus='EN CAMINO' from demo_viajes d where v.id=d.id and d.n between 4 and 6;
update master.viajes v set estado='LIQUIDADO', estatus='LIQUIDADO', enviado_por='Datos de demostración', enviado_en=now(), liq_intentos=1, liq_actual_id='LIQ-DEMO-'||v.id from demo_viajes d where v.id=d.id and d.n between 7 and 9;
update master.viajes v set estado='RECHAZADO', estatus='EN ESPERA', comentario_revision='Demostración: validar el comprobante y corregir el dato indicado.', revisado_por='Validador de demostración', revisado_en=now(), liq_intentos=1, liq_actual_id='LIQ-DEMO-'||v.id, extra=extra||jsonb_build_object('rechazos',1) from demo_viajes d where v.id=d.id and d.n between 10 and 12;
alter table master.viajes enable trigger trg_viajes_transicion;

insert into master.liquidaciones(id,viaje_id,ciclo,envio_por,envio_en,evidencia_id,decision,revisor,revision_en,comentario)
select 'LIQ-DEMO-'||v.id,v.id,1,'Datos de demostración',now(),'EVI-DEMO-'||v.id,'','',null,'' from master.viajes v join demo_viajes d on d.id=v.id where d.n between 7 and 9
on conflict do nothing;
insert into master.liquidaciones(id,viaje_id,ciclo,envio_por,envio_en,evidencia_id,decision,revisor,revision_en,comentario)
select 'LIQ-DEMO-'||v.id,v.id,1,'Datos de demostración',now(),'EVI-DEMO-'||v.id,'DEVUELTA','Validador de demostración',now(),'Demostración: validar el comprobante y corregir el dato indicado.' from master.viajes v join demo_viajes d on d.id=v.id where d.n between 10 and 12
on conflict do nothing;
insert into master.evidencias(id,viaje_id,liq_id,path,por,en)
select 'EVI-DEMO-'||v.id,v.id,'LIQ-DEMO-'||v.id,'','Datos de demostración',now() from master.viajes v join demo_viajes d on d.id=v.id where d.n between 7 and 12
on conflict do nothing;

-- Rutas en cada fase del flujo de activación, usando referencias existentes.
insert into master.rutas(id,codigo,nombre,cliente_id,proyecto,origen_id,destino_id,estado,origen_prop,destino_prop,fuente,solicitada_por,solicitada_en,validada_por,validada_en)
select 'R-DEMO-PEND','', 'Ruta demostración pendiente',cliente_id,proyecto,'','', 'PENDIENTE','Origen por confirmar','Destino por confirmar','DEMO','Datos de demostración',now(),'',null from master.rutas where estado='ACTIVA' limit 1
on conflict do nothing;
insert into master.rutas(id,codigo,nombre,cliente_id,proyecto,origen_id,destino_id,estado,fuente,solicitada_por,solicitada_en,validada_por,validada_en)
select 'R-DEMO-TAR','DEMO-TAR','Ruta demostración en tarifación',cliente_id,proyecto,origen_id,destino_id,'EN_TARIFACION','DEMO','Datos de demostración',now(),'Datos de demostración',now() from master.rutas where estado='ACTIVA' limit 1
on conflict do nothing;
insert into master.rutas(id,codigo,nombre,cliente_id,proyecto,origen_id,destino_id,estado,fuente,solicitada_por,solicitada_en,validada_por,validada_en,aprobacion_comercial)
select 'R-DEMO-APR','DEMO-APR','Ruta demostración pendiente de Transporte',cliente_id,proyecto,origen_id,destino_id,'PENDIENTE_APROBACION','DEMO','Datos de demostración',now(),'Datos de demostración',now(),jsonb_build_object('por','Gerencia Comercial','en',now()) from master.rutas where estado='ACTIVA' limit 1
on conflict do nothing;

commit;
