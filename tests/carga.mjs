/* Herramienta de medición (no entra en la suite): carga la base con ~8.000 viajes, 900 agrupaciones y 2.400 pagos
   sobre PGlite y mide snapshot y resumenHistorico, para vigilar el rendimiento del servidor.
   Uso: node tests/carga.mjs   (referencia de hoy: snapshot ~330 ms, resumenHistorico ~350 ms) */
/* Diagnóstico temporal: mide resumenHistorico y snapshot con volumen real (8.000 viajes) sobre PGlite. */
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { ejecutar } from './supabase/functions/api/handler.mjs';
const raíz = path.dirname(new URL(import.meta.url).pathname);
const sqlDe = f => fs.readFileSync(path.join(raíz, 'supabase/migrations', f), 'utf8');
const MIG = ['001_esquema.sql','002_seguridad_rls.sql','003_almacenamiento.sql','004_permisos_base.sql','006_flota_fleetio.sql','007_flujo_operativo.sql','008_contabilidad.sql','016_ordenes_pago.sql','023_corregir_estados_rls.sql','017_roles_departamentos.sql','018_rol_proyectos.sql','019_catalogos.sql','020_arrastres.sql','021_fecha_entrega_anterior.sql','024_permisos_gerente_transporte.sql','025_indices_viajes.sql', '041_ruta_capacidad_km.sql'];
const db = new PGlite();
await db.exec('set search_path = master, public');
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users(id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to anon, authenticated; create schema storage;
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select, insert on storage.objects to authenticated;`.replace(/\\s+/g,' '));
for (const f of MIG) await db.exec(sqlDe(f));
const uuid = () => crypto.randomUUID();
const U = { adm: uuid(), gtr: uuid() };
for (const [k, rol] of [['adm','ADMIN'],['gtr','GERENTE_TRANSPORTE']]) {
  await db.query('insert into auth.users(id,email) values ($1,$2)', [U[k], k + '@t.test']);
  await db.query("insert into master.perfiles(id,usuario,email,nombre,rol,proyectos) values ($1,$2,$3,$4,$5,'{}')", [U[k], k, k + '@t.test', k, rol]);
}
const t0 = Date.now();
try{
  try{ await db.exec(`insert into master.clientes(id,nombre,cliente,proyectos,torre_estatus) values ('COLGATE','Colgate','COLGATE','{COLGATE}',false)`.replace(/\\s+/g,' ')); }catch(e){ console.log('PASO',0,'FALLA:',String(e.message).slice(0,120)); throw e; }
  try{ await db.exec(`insert into master.clientes_fiscal(cliente_id) values ('COLGATE')`.replace(/\\s+/g,' ')); }catch(e){ console.log('PASO',1,'FALLA:',String(e.message).slice(0,120)); throw e; }
  try{ await db.exec(`insert into master.flota(unidad,placa) values ('T-1','C-111AAA')`.replace(/\\s+/g,' ')); }catch(e){ console.log('PASO',2,'FALLA:',String(e.message).slice(0,120)); throw e; }
  try{ await db.exec(`insert into master.pilotos(id,nombre,unidad,cliente_id) values ('P-1','Piloto Uno','T-1','COLGATE')`.replace(/\\s+/g,' ')); }catch(e){ console.log('PASO',3,'FALLA:',String(e.message).slice(0,120)); throw e; }
  try{ await db.exec(`insert into master.rutas(id,codigo,nombre,cliente_id,proyecto,origen_id,destino_id,estado) values ('R-1','COL-001','CP → Colgate','COLGATE','COLGATE','CP','D-1','ACTIVA')`.replace(/\\s+/g,' ')); }catch(e){ console.log('PASO',4,'FALLA:',String(e.message).slice(0,120)); throw e; }
  try{ await db.exec(`insert into master.permisos (rol,permiso,habilitado) select r.rol,p.permiso,true from (values('ADMIN'),('GERENTE_TRANSPORTE')) r(rol) cross join (select distinct permiso from master.permisos) p(permiso) on conflict (rol,permiso) do update set habilitado=true`.replace(/\\s+/g,' ')); }catch(e){ console.log('PASO',5,'FALLA:',String(e.message).slice(0,120)); throw e; }
  try{ await db.exec(`/* 8.000 viajes repartidos en 12 meses, todos los estados del flujo */
  insert into master.viajes(id,cliente_id,proyecto_cat,shipment,opl,fecha_plan,piloto_id,unidad_id,ruta_id,estado,creado_por,creado_en)
  select lpad(i::text,6,'0'), 'COLGATE','COLGATE','S-'||i,'INTRANSIT',
         to_char(timestamp '2026-01-01 08:00' + (i * interval '97 minutes'), 'YYYY-MM-DD\"T\"HH24:MI'), 'P-1','T-1','R-1',
         (array['PLANIFICADO','EN_RUTA','ENTREGADO','LIQUIDADO','ACEPTADO','RECHAZADO','FACTURADO','COBRADO'])[1+(i%8)],'Admin',now()
  from generate_series(1,8000) i`.replace(/\\s+/g,' ')); }catch(e){ console.log('PASO',6,'FALLA:',String(e.message).slice(0,120)); throw e; }
  try{ await db.exec(`insert into master.viajes_costos(viaje_id,costo_proveedor) select id, 1000+(row_number() over ()%500) from master.viajes`.replace(/\\s+/g,' ')); }catch(e){ console.log('PASO',7,'FALLA:',String(e.message).slice(0,120)); throw e; }
  try{ await db.exec(`insert into master.viajes_viaticos(viaje_id,q_viaticos) select id, 200+(row_number() over ()%100) from master.viajes`.replace(/\\s+/g,' ')); }catch(e){ console.log('PASO',8,'FALLA:',String(e.message).slice(0,120)); throw e; }
  try{ await db.exec(`insert into master.viajes_tarifa(viaje_id,tarifa_cliente) select id, 4000+(row_number() over ()%900) from master.viajes`.replace(/\\s+/g,' ')); }catch(e){ console.log('PASO',9,'FALLA:',String(e.message).slice(0,120)); throw e; }
  try{ await db.exec(`/* 900 agrupaciones activas de 8 viajes cada una */
  insert into master.agrupaciones(id,cliente_id,modalidad,fase,viaje_ids,numero_factura,estado,importe_facturado,importe_enviado,envio,fecha_factura,importes_viaje,emision)
  select 'AGR-'||a,'COLGATE','AGRUPADA', case when a%3=0 then 'EMITIDA' else 'ENVIADA' end,
         s.ids, 'FAC-'||a,'ACTIVA',
         case when a%3=0 then 40000 else null end, 40000, jsonb_build_object('en', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS')),
         case when a%3=0 then '2026-02-01' else '' end,
         (select jsonb_object_agg(x, 5000) from unnest(s.ids) x),
         case when a%3=0 then jsonb_build_object('en', to_char(now(),'YYYY-MM-DD"T"HH24:MI:SS')) else null end
  from generate_series(1,900) a
  cross join lateral (select array_agg(id) ids from (select id from master.viajes order by id offset ((a-1)*8) limit 8) q) s`.replace(/\\s+/g,' ')); }catch(e){ console.log('PASO',10,'FALLA:',String(e.message).slice(0,120)); throw e; }
  try{ await db.exec(`/* 2.400 pagos (proveedor y piloto) */
  insert into master.pagos(id,tipo,viaje_id,monto,fecha,referencia,por,por_id)
  select 'PG-'||p, case when p%2=0 then 'PROVEEDOR' else 'PILOTO' end,
         (select id from master.viajes order by id limit 1 offset (p*3)%8000), 100+(p%300), '2026-0'||(1+(p%9))||'-10', 'REF-'||p, 'Admin','x'
  from generate_series(1,2400) p`.replace(/\\s+/g,' ')); }catch(e){ console.log('PASO',11,'FALLA:',String(e.message).slice(0,120)); throw e; }
console.log('datos cargados en', Date.now() - t0, 'ms');
}catch(e){ console.log('ERROR DE CARGA:', String(e.message).slice(0,200), '|', String(e.detail||'').slice(0,200)); await db.close(); process.exit(1); }

const deps = { transaccion: fn => db.transaction(tx => fn(async (t, p = []) => tx.query(t, p))), firmar: async ps => new Map(ps.map(p => [p, 'u'])), crearUsuarioAuth: async () => uuid(), borrarUsuarioAuth: async () => {} };
for (const quien of ['adm', 'gtr']) {
  for (const op of ['snapshot', 'resumenHistorico']) {
    const t = Date.now();
    const r = await ejecutar(deps, U[quien], { op, args: [{}] });
    const ms = Date.now() - t;
    const res = r.snapshot || r.result || {};
    console.log(`${op.padEnd(17)} ${quien}  ${String(ms).padStart(6)} ms  ok=${r.ok}  viajes=${res.viajes ?? (res.trips ? res.trips.length : '')}  enBase=${res.ventana ? res.ventana.enBase : ''}  financiero=${res.financiero ? 'sí' : 'no'}  finErr=${res.finError ? String(res.finError).slice(0, 80) : ''}`);
  }
}
await db.close();
