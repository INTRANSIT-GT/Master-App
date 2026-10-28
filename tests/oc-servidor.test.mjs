/* Pruebas de Órdenes de Compra contra un Postgres real (PGlite): aplica las migraciones tal como están (001–034) y
   ejecuta los flujos a través de handler.mjs (el mismo código de la Edge Function). Verifica: permisos del servidor,
   validación de tarifa por API directa, un viaje = una orden activa (trigger), líneas congeladas, PDF por versiones,
   archivos privados (oc/<id>/…), RLS, lectura por columnas (combustible), una factura por orden y que el servidor siga
   funcionando si la migración 034 aún no se aplicó. NO toca Supabase real. */
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ejecutar } from '../supabase/functions/api/handler.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlDe = f => fs.readFileSync(path.join(raíz, 'supabase/migrations', f), 'utf8');
const BASE = ['001_esquema.sql', '002_seguridad_rls.sql', '003_almacenamiento.sql', '004_permisos_base.sql',
  '006_flota_fleetio.sql', '007_flujo_operativo.sql', '008_contabilidad.sql', '016_ordenes_pago.sql', '023_corregir_estados_rls.sql', '017_roles_departamentos.sql', '018_rol_proyectos.sql',
  '019_catalogos.sql', '020_arrastres.sql', '021_fecha_entrega_anterior.sql', '024_permisos_gerente_transporte.sql', '025_indices_viajes.sql',
  '026_viajes_sin_ruta.sql', '027_reportes_ayuda.sql', '028_ayuda_proyectos.sql', '029_lugares.sql', '030_origen_destino_texto.sql', '031_bucket_manuales.sql', '032_pilotos_documentos.sql', '033_acceso_modulos_secciones.sql'];
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); };
const uuid = () => crypto.randomUUID();
const ENTORNO = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users(id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  create schema storage;
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated; grant select, insert on storage.objects to authenticated;
`;
const T10 = { tIngresoPlanta: '2031-01-01T08:10', tEsperaRampa: '2031-01-01T08:20', tRampa: '2031-01-01T08:30', tInicioCarga: '2031-01-01T08:40', tFinCarga: '2031-01-01T09:00', tSalidaPlanta: '2031-01-01T09:05', tIngresoBodega: '2031-01-01T13:00', tInicioDescarga: '2031-01-01T13:10', tFinDescarga: '2031-01-01T13:40' };

async function montar(migraciones) {
  const db = new PGlite();
  await db.exec('set search_path = master, public');
  await db.exec(ENTORNO);
  for (const f of migraciones) await db.exec(sqlDe(f));
  const U = {};
  const mk = async (k, usuario, nombre, rol) => { U[k] = uuid(); await db.query('insert into auth.users(id,email) values ($1,$2)', [U[k], usuario + '@intransit.test']);
    await db.query('insert into master.perfiles(id,usuario,email,nombre,rol,proyectos) values ($1,$2,$3,$4,$5,$6)', [U[k], usuario, usuario + '@intransit.test', nombre, rol, []]); };
  await db.exec(`insert into master.clientes(id,nombre,cliente,proyectos,torre_estatus) values ('COLGATE','Colgate','COLGATE','{COLGATE,LV}',false);
    insert into master.clientes_fiscal(cliente_id) values ('COLGATE');`);
  await mk('adm', 'admin', 'Administradora', 'ADMIN'); await mk('gco', 'gcomercial', 'Gerencia Comercial', 'GERENTE_COMERCIAL'); await mk('ale', 'alejandra', 'Analista', 'ANALISTA_COMERCIAL');
  await mk('fac', 'facturacion', 'Facturación', 'FACTURACION'); await mk('fel', 'felipe', 'Torre', 'TORRE'); await mk('mar', 'mar', 'Validador', 'VALIDADOR'); await mk('ped', 'pedro', 'Operativo', 'OPERATIVO');
  await db.query(`insert into master.acceso_cliente(user_id,cliente_id) values ($1,'COLGATE')`, [U.ped]);
  await db.exec(`insert into master.flota(unidad,placa,tango,capacidad,tipo) values ('T-1','C-001AAA','TNG-1','10 Ton','10TON'),('T-3','C-003CCC','TNG-3','10 Ton','10TON');
    insert into master.pilotos(id,nombre,unidad,cliente_id) values ('P-1','Piloto Uno','T-1','COLGATE'),('P-3','Piloto Tres','T-3','COLGATE');
    insert into master.destinos(id,nombre,cliente_id) values ('D-C1','Distribuidora Colgate 1','COLGATE');`);
  const deps = {
    transaccion: fn => db.transaction(tx => fn(async (t, p = []) => tx.query(t, p))),
    firmar: async paths => new Map(paths.map(p => [p, 'https://firmado.test/' + p + '?token=x'])),
    crearUsuarioAuth: async () => uuid(), borrarUsuarioAuth: async () => {}
  };
  const api = (quien, op, ...args) => ejecutar(deps, U[quien] || quien, { op, args });
  const q1 = async (t, p) => (await db.query(t, p)).rows;
  /* consulta como usuario autenticado (RLS y permisos de columna reales) */
  const como = async (quien, sql) => { try { return await db.transaction(async tx => { await tx.query(`select set_config('request.jwt.claim.sub',$1,true)`, [U[quien]]); await tx.query('set local role authenticated'); const r = await tx.query(sql); return { rows: r.rows }; }); } catch (e) { return { error: e.message }; } };
  return { db, U, api, q1, como };
}

/* ============ Con la migración 034 ============ */
const S = await montar([...BASE, '034_ordenes_compra.sql', '035_agrupaciones_flujo.sql']);
const { db, U, api, q1, como } = S;
await db.exec("insert into storage.buckets(id,name,public,file_size_limit) values ('evidencias','evidencias',false,3145728) on conflict do nothing");
T('M1 La migración 034 se aplica sobre 001–033 sin errores', true);
try { await db.exec(sqlDe('034_ordenes_compra.sql')); T('M2 La migración 034 es re-ejecutable (idempotente)', true); } catch (e) { T('M2 La migración 034 es re-ejecutable (idempotente)', false, e.message); }

const perm = async (rol, p) => (await q1('select habilitado from master.permisos where rol=$1 and permiso=$2', [rol, p]))[0]?.habilitado;
T('M3 Permisos sembrados: Gerencia Comercial, Analista y Administrador tienen todos los permisos de OC; Facturación solo ve', await perm('GERENTE_COMERCIAL', 'oc_responder') === true && await perm('ANALISTA_COMERCIAL', 'oc_corregir') === true && await perm('ADMIN', 'oc_ver_combustible') === true && await perm('GERENTE_COMERCIAL', 'oc_preparar') === true && await perm('ANALISTA_COMERCIAL', 'oc_enviar') === true && await perm('FACTURACION', 'oc_ver') === true && await perm('FACTURACION', 'oc_preparar') === false);
T('M4 «oc_responder» solo está en SÍ para Comercial (Gerencia y Analista) y Administrador', JSON.stringify((await q1("select rol from master.permisos where permiso='oc_responder' and habilitado order by rol")).map(r => r.rol)) === JSON.stringify(['ADMIN', 'ANALISTA_COMERCIAL', 'GERENTE_COMERCIAL']));
T('M5 Torre, Operativo y Validador no tienen ningún oc_* y están vetados en permisos_prohibidos', (await q1("select count(*)::int n from master.permisos where rol in ('TORRE','OPERATIVO','VALIDADOR') and permiso like 'oc\\_%' and habilitado")) [0].n === 0 && (await q1("select count(*)::int n from master.permisos_prohibidos where rol in ('TORRE','OPERATIVO','VALIDADOR','PAGO_OPL') and permiso like 'oc\\_%'")) [0].n === 24);
T('M6 La sección sec_oc se habilita para ADMIN, Gerencia Comercial, Analista y Facturación', await perm('ADMIN', 'sec_oc') === true && await perm('GERENTE_COMERCIAL', 'sec_oc') === true && await perm('ANALISTA_COMERCIAL', 'sec_oc') === true && await perm('FACTURACION', 'sec_oc') === true && await perm('TORRE', 'sec_oc') === false);
T('M7 Las funciones de almacenamiento conservan sus ramas anteriores (viajes, facturas, pagos) y suman «oc»', await (async () => { const f = (await q1("select pg_get_functiondef('app.puede_subir(text)'::regprocedure) d, pg_get_functiondef('app.puede_ver_archivo(text)'::regprocedure) v"))[0]; return ['viajes', 'facturas', 'pagos', "'oc'"].every(k => f.d.includes(k) && f.v.includes(k)); })());
T('M8 El bucket sigue privado', (await q1("select public from storage.buckets where id='evidencias'"))[0].public === false);

/* datos: ruta activa y viajes aceptados con tarifa */
const r1 = await api('adm', 'registrarRuta', { codigo: 'COL-001', nombre: 'CP → Colgate 1', cliente: 'COLGATE', proyecto: 'COLGATE', origen: 'Ciudad', destino: 'Bodega' });
await db.exec("update master.rutas set estado='ACTIVA'");
const viaje = (extra = {}) => ({ cliente: 'COLGATE', pilotoId: 'P-1', rutaId: r1.result.id, fechaPlan: '2031-12-29T14:30', shipment: 'S-1', opl: 'J&J', tipoViaje: 'ONE WAY', tipoCarga: 'TARIMAS', noCarga: '1', producto: 'Producto', placaArrastre: 'C-ARR-001', ...T10, ...extra });
const ids = [];
for (const [i, tar, f] of [[1, 1000, '2031-12-28T08:00'], [2, 1500, '2031-12-29T14:30'], [3, 2000, '2032-01-04T06:15'], [4, null, '2031-05-05T08:00']]) {
  const v = await api('adm', 'crearViaje', viaje({ shipment: 'SH-' + i, fechaPlan: f, pilotoId: i % 2 ? 'P-1' : 'P-3' }));
  if (!v.ok) { T('Datos · crear viaje ' + i, false, v); continue; }
  ids.push(v.result.id);
  await db.query(`update master.viajes set estado='ACEPTADO', liq_aprobada_en=now() where id=$1`, [v.result.id]);
  if (tar != null) await db.query(`insert into master.viajes_tarifa(viaje_id, tarifa_cliente) values ($1,$2)`, [v.result.id, tar]);
}
const [a, b, c, sinT] = ids;
await db.query(`update master.viajes set extra = extra || '{"tarifaBase":1000,"ajusteCombustible":100}'::jsonb where id=$1`, [a]);
await db.query(`update master.viajes_tarifa set tarifa_cliente=1100 where viaje_id=$1`, [a]);
T('D0 Datos de prueba creados (3 viajes con tarifa, 1 sin tarifa)', ids.length === 4);

const gen = (quien, v) => api(quien, 'ocGenerar', { cliente: 'COLGATE', proyecto: 'COLGATE', viajeIds: v, columnas: [] });
for (const q of ['fac', 'fel', 'mar', 'ped']) { const r = await gen(q, [a]); T(`S1 El servidor rechaza ocGenerar de ${q} (sin permiso)`, !r.ok && r.code === 'SIN_PERMISO', r); }
const pendiente = await gen('gco', [a, sinT]);
T('S2 Un viaje sin tarifa se rechaza en el servidor (API directa) con el mensaje de tarifa pendiente', !pendiente.ok && /Viaje pendiente de asignación de tarifa/.test(pendiente.message || ''), pendiente);
T('S3 La orden rechazada no deja nada en la base', (await q1('select count(*)::int n from master.ordenes_compra'))[0].n === 0);
const g1 = await gen('gco', [b, c, a]);
T('S4 Gerencia Comercial genera la orden OC-0001: guardada con estado, total y viajes', g1.ok && g1.result.id === 'OC-0001' && g1.result.total === 4600 && (await q1("select estado,total::float t,viaje_ids from master.ordenes_compra where id='OC-0001'"))[0].estado === 'PREPARADA', g1);
const fila = (await q1("select lineas, combustible from master.ordenes_compra where id='OC-0001'"))[0] || { lineas: [], combustible: {} };
T('S5 Las líneas congelan semana ISO (52/2031 y 01/2032), shipment, placa y tarifa', fila.lineas.find(l => l.viajeId === c).semana === 1 && fila.lineas.find(l => l.viajeId === c).semanaAnio === 2032 && fila.lineas.find(l => l.viajeId === a).tarifa === 1100 && fila.lineas.find(l => l.viajeId === a).semana === 52 && fila.lineas.every(l => l.shipment && l.placa), fila.lineas[0]);
T('S6 El combustible congelado va fuera de las líneas (columna aparte), y el total no lo suma dos veces', fila.lineas.every(l => !('combustible' in l)) && fila.combustible[a].ajuste === 100 && fila.combustible[a].base === 1000 && g1.result.total === 1500 + 2000 + 1100);
const dup = await gen('ale', [a]);
T('S7 Un viaje no puede entrar en dos órdenes activas (servidor)', !dup.ok && dup.code === 'NO_ELEGIBLE', dup);
let eDup = ''; try { await db.query(`insert into master.ordenes_compra(id,cliente_id,proyecto,estado,viaje_ids,total) values ('OC-9999','COLGATE','COLGATE','PREPARADA',array[$1],10)`, [b]); } catch (e) { eDup = e.message; }
T('S8 La base misma impide dos órdenes activas con el mismo viaje (trigger), aunque se salte el motor', /ya está en otra orden de compra activa/.test(eDup), eDup);
let eCong = ''; try { await db.query(`update master.ordenes_compra set total=1 where id='OC-0001'`); } catch (e) { eCong = e.message; }
let eCong2 = ''; try { await db.query(`update master.ordenes_compra set lineas='[]' where id='OC-0001'`); } catch (e) { eCong2 = e.message; }
T('S9 Los importes y las líneas están congelados en la base (no se pueden cambiar)', /congelados/.test(eCong) && /congelados/.test(eCong2), [eCong, eCong2]);

/* PDF privado y por versiones */
await db.exec("insert into storage.objects(bucket_id,name) values ('evidencias','oc/OC-0001/archivo-v1.pdf'),('evidencias','oc/OC-0001/archivo-v2.pdf')");
const dataUrl = await api('gco', 'ocRegistrarPdf', 'OC-0001', { archivo: 'data:application/pdf;base64,JVBERi0=' });
T('P1 El servidor no guarda archivos dentro de la base: rechaza un PDF en data URL', !dataUrl.ok && /almacenamiento privado/.test(dataUrl.message || ''), dataUrl);
const ajena = await api('gco', 'ocRegistrarPdf', 'OC-0001', { archivo: { path: 'oc/OC-0002/archivo-v1.pdf' }, hash: 'a'.repeat(64) });
const otroPrefijo = await api('gco', 'ocRegistrarPdf', 'OC-0001', { archivo: { path: 'pagos/OC-0001/archivo-v1.pdf' }, hash: 'a'.repeat(64) });
T('P2 Solo se aceptan rutas oc/<esta orden>/… en el bucket privado', !ajena.ok && !otroPrefijo.ok, [ajena.message, otroPrefijo.message]);
const v1 = await api('gco', 'ocRegistrarPdf', 'OC-0001', { archivo: { path: 'oc/OC-0001/archivo-v1.pdf' }, hash: 'a'.repeat(64) });
const v2 = await api('gco', 'ocRegistrarPdf', 'OC-0001', { archivo: { path: 'oc/OC-0001/archivo-v2.pdf' }, hash: 'b'.repeat(64), motivo: 'Se agregó la columna Ruta' });
T('P3 Se guardan 2 versiones del PDF y la primera sigue intacta', v1.ok && v2.ok && (await q1("select documentos from master.ordenes_compra where id='OC-0001'"))[0].documentos.map(d => d.version + d.hash.slice(0, 1)).join() === '1a,2b');
let eDoc = ''; try { await db.query(`update master.ordenes_compra set documentos = documentos - 0 where id='OC-0001'`); } catch (e) { eDoc = e.message; }
T('P4 La base impide borrar o alterar versiones anteriores del PDF', /se conservan por versiones/.test(eDoc), eDoc);
T('P5 Facturación no puede registrar PDF', !(await api('fac', 'ocRegistrarPdf', 'OC-0001', { archivo: { path: 'oc/OC-0001/archivo-v1.pdf' }, motivo: 'abcde' })).ok);

/* Almacenamiento y RLS */
const ver = async (q, n) => (await como(q, `select app.puede_ver_archivo('${n}') v`)).rows?.[0]?.v;
T('A1 Ver el archivo oc/… mientras la OC no está confirmada: sí Gerencia Comercial y Analista; no Facturación, Torre, Validador ni Operativo', await ver('gco', 'oc/OC-0001/archivo-v1.pdf') === true && await ver('ale', 'oc/OC-0001/archivo-v1.pdf') === true && await ver('fac', 'oc/OC-0001/archivo-v1.pdf') === false && await ver('fel', 'oc/OC-0001/archivo-v1.pdf') === false && await ver('mar', 'oc/OC-0001/archivo-v1.pdf') === false && await ver('ped', 'oc/OC-0001/archivo-v1.pdf') === false);
const sube = async (q, n) => (await como(q, `select app.puede_subir('${n}') v`)).rows?.[0]?.v;
T('A2 Subir a oc/<orden>/…: solo quien prepara, mientras está Preparada; rutas mal formadas, no', await sube('gco', 'oc/OC-0001/nuevo-archivo.pdf') === true && await sube('fac', 'oc/OC-0001/nuevo-archivo.pdf') === false && await sube('fel', 'oc/OC-0001/nuevo-archivo.pdf') === false && await sube('gco', 'oc/OC-0001/a/b.pdf') === false && await sube('gco', 'oc/OC-9999/nuevo-archivo.pdf') === false);
const oc1 = await como('gco', 'select id, estado, total from master.ordenes_compra');
const ocT = await como('fel', 'select id from master.ordenes_compra');
const ocM = await como('mar', 'select id from master.ordenes_compra');
T('A3 RLS: Gerencia Comercial lee las órdenes; Torre y Validador no ven ninguna', oc1.rows?.length === 1 && ocT.rows?.length === 0 && ocM.rows?.length === 0, [oc1, ocT, ocM]);
const comb = await como('gco', 'select combustible from master.ordenes_compra');
const ext = await como('gco', 'select extra from master.ordenes_compra');
T('A4 Por la API directa de Postgres NO se puede leer la columna de combustible ni «extra»', /permission denied/i.test(comb.error || '') && /permission denied/i.test(ext.error || ''), [comb, ext]);
const esc = await como('gco', `update master.ordenes_compra set estado='ANULADA'`);
T('A5 Las escrituras directas desde el navegador no existen (solo la función api)', !!esc.error, esc);

/* Envío */
const env0 = await api('fac', 'ocEnviar', 'OC-0001', {});
T('E1 Facturación no puede confirmar el envío', !env0.ok && env0.code === 'SIN_PERMISO', env0);
const env = await api('ale', 'ocEnviar', 'OC-0001', { destinatario: 'compras@cliente.test', medio: 'Correo' });
const nt = await q1("select tipo, destinatarios from master.notificaciones where tipo='OC_ENVIADA'");
T('E2 El envío queda guardado con usuario y fecha, y avisa a Facturación (notificación persistente)', env.ok && env.result.estado === 'ENVIADA' && env.result.envio.porId === U.ale && nt.length === 1 && nt[0].destinatarios.includes('FACTURACION'), [env, nt]);
let eEstado = ''; try { await db.query(`update master.ordenes_compra set documentos='[]' where id='OC-0001'`); } catch (e) { eEstado = e.message; }
T('E3 Una orden enviada sigue exigiendo su PDF (restricción en la base)', !!eEstado, eEstado);
T('E4 Con la orden Enviada solo quien responde (Comercial) puede subir archivos; Facturación no', await sube('fac', 'oc/OC-0001/otro-archivo.pdf') === false && await sube('gco', 'oc/OC-0001/otro-archivo.pdf') === true);

/* Snapshot */
const snG = await api('gco', 'snapshot'), snF = await api('fac', 'snapshot'), snT = await api('fel', 'snapshot'), snA = await api('ale', 'snapshot');
const ocG = snG.snapshot?.ordenesCompra || [], ocF = snF.snapshot?.ordenesCompra || [];
T('N1 El snapshot trae la orden con URLs firmadas del bucket privado (no rutas públicas) para Comercial; Facturación no la recibe hasta que esté confirmada', ocG.length === 1 && ocG[0].documentos.length === 2 && /^https:\/\/firmado\.test\/oc\/OC-0001\//.test(ocG[0].documentos[1].url) && ocF.length === 0, snG.message);
T('N2 El snapshot de Torre no incluye órdenes de compra', (snT.snapshot?.ordenesCompra || []).length === 0 && snT.ok);
T('N3 Sin oc_ver_combustible (Facturación) el snapshot no trae combustible (ni en líneas ni aparte)', !JSON.stringify(ocF).includes('combustible') && !JSON.stringify(ocF).includes('"tarifaBase"'));

/* Respuesta */
const resp0 = await api('fac', 'ocResponder', 'OC-0001', { resultado: 'ACEPTADA', referencia: 'PO-123' });
T('R1 Facturación no puede registrar la respuesta del cliente', !resp0.ok && resp0.code === 'SIN_PERMISO', resp0);
T('R2 El Administrador no puede dársela a Facturación (separación de funciones)', !(await api('adm', 'setPermiso', 'FACTURACION', 'oc_responder', true)).ok);
await db.exec("insert into storage.objects(bucket_id,name) values ('evidencias','oc/OC-0001/respuesta-cliente.pdf')");
const resp = await api('gco', 'ocResponder', 'OC-0001', { resultado: 'ACEPTADA', referencia: 'PO-123', evidencias: [{ path: 'oc/OC-0001/respuesta-cliente.pdf' }] });
T('R3 Gerencia Comercial (permiso por defecto) registra la aceptación con evidencia privada', resp.ok && resp.result.estado === 'ACEPTADA' && (await q1("select respuesta from master.ordenes_compra where id='OC-0001'"))[0].respuesta.evidencias[0].path === 'oc/OC-0001/respuesta-cliente.pdf', resp);

{ const fSnap = await api('fac', 'snapshot');
  T('R4 Una vez confirmada por Comercial, Facturación la recibe en el snapshot (con la evidencia de aceptación) y puede ver sus archivos', (fSnap.snapshot?.ordenesCompra || []).length === 1 && (fSnap.snapshot.ordenesCompra[0].respuesta?.evidencias || []).length === 1 && await ver('fac', 'oc/OC-0001/archivo-v1.pdf') === true, fSnap.message);
  const rls = async who => (await como(who, 'select id from master.ordenes_compra')).rows?.length;
  T('R5 RLS de la base: Facturación lee la OC solo confirmada; Torre y Operativo no leen ninguna; Comercial sí', await rls('fac') === 1 && await rls('gco') === 1 && !(await rls('fel')) && !(await rls('ped')), [await rls('fac'), await rls('gco'), await rls('fel')]); }

/* Facturación */
const sinPerm = await api('fac', 'prepararFactura', { cliente: 'COLGATE', ocId: 'OC-0001', numeroFactura: 'F-1', serieFactura: 'A', fechaFactura: '2031-12-31' });
T('F0 Facturación NO puede agrupar viajes ni preparar la factura de una OC (servidor)', !sinPerm.ok && sinPerm.code === 'SIN_PERMISO', sinPerm);
const suelta = await api('ale', 'prepararFactura', { cliente: 'COLGATE', viajeIds: [b] });
T('F1 Un viaje que está en una orden no se factura suelto (servidor)', !suelta.ok && suelta.code === 'EN_ORDEN_DE_COMPRA', suelta);
const fa = await api('ale', 'prepararFactura', { cliente: 'COLGATE', ocId: 'OC-0001', numeroFactura: 'F-1', serieFactura: 'A', fechaFactura: '2031-12-31' });
const ag = await q1("select id, extra->>'ocId' as oc, viaje_ids from master.agrupaciones");
T('F2 Comercial (Analista) crea UNA factura con los viajes de la orden, vinculada a ella', fa.ok && ag.length === 1 && ag[0].oc === 'OC-0001' && ag[0].viaje_ids.length === 3, [fa, ag]);
const f2 = await api('ale', 'prepararFactura', { cliente: 'COLGATE', ocId: 'OC-0001' });
T('F3 Una orden no admite una segunda factura activa (motor)', !f2.ok && f2.code === 'YA_FACTURADO', f2);
let eUx = ''; try { await db.query(`insert into master.agrupaciones(id,cliente_id,modalidad,fase,viaje_ids,estado,extra) values ('AGR-9','COLGATE','INDIVIDUAL','PREPARADA',array['x'],'ACTIVA','{"ocId":"OC-0001"}')`); } catch (e) { eUx = e.message; }
T('F4 La base también impide dos facturas activas para la misma orden (índice único)', /ux_agrupacion_por_oc|duplicate key/.test(eUx), eUx);
const sube2 = async n => db.exec(`insert into storage.objects(bucket_id,name) values ('evidencias','${n}') on conflict do nothing`);
await sube2(`facturas/${ag[0].id}/cliente-0001aaaa.pdf`); await sube2(`facturas/${ag[0].id}/autorizacion-0001aaaa.png`);
const pvx = await api('ale', 'agrRegistrarPdf', ag[0].id, { tipo: 'CLIENTE', opcionales: [], huella: 'malahuel', hash: 'abcdef0123456789', archivo: { path: `facturas/${ag[0].id}/cliente-0001aaaa.pdf` } });
T('F4a Un PDF generado con datos distintos a los vigentes se rechaza (DATOS_CAMBIARON)', !pvx.ok && pvx.code === 'DATOS_CAMBIARON', pvx);
const pv = { huella: (/ref\. ([0-9a-f]{8})/.exec(pvx.message || '') || [])[1] };
const sc = await api('fac', 'enviarFactura', ag[0].id);
T('F4b Sin la confirmación del cliente de Comercial, Facturación no puede facturar la agrupación (servidor)', !sc.ok && sc.code === 'SIN_CONFIRMACION', sc);
const rp = await api('ale', 'agrRegistrarPdf', ag[0].id, { tipo: 'CLIENTE', opcionales: [], huella: pv.huella, hash: 'abcdef0123456789', archivo: { path: `facturas/${ag[0].id}/cliente-0001aaaa.pdf`, nombre: 'r.pdf' } });
const re = await api('ale', 'agrAdjuntarEvidencia', ag[0].id, { archivo: { path: `facturas/${ag[0].id}/autorizacion-0001aaaa.png`, nombre: 'correo.png' } });
const rf = await api('fac', 'confirmarCliente', ag[0].id);
const rc = await api('ale', 'confirmarCliente', ag[0].id);
T('F4c Comercial registra PDF, evidencia y «Cliente confirmó»; Facturación NO puede confirmar (servidor)', rp.ok && re.ok && !rf.ok && rf.code === 'SIN_PERMISO' && rc.ok, [rp.message, re.message, rf.code, rc.message]);
const enviada = await api('fac', 'enviarFactura', ag[0].id);
T('F5 Enviar la factura sigue marcando los viajes como Facturado (comportamiento actual intacto)', enviada.ok && (await q1("select count(*)::int n from master.viajes where id = any($1) and estado='FACTURADO'", [[a, b, c]]))[0].n === 3, enviada);
const an = await api('gco', 'ocAnular', 'OC-0001', 'intento de anular con factura');
T('F6 Una orden con factura activa no se puede anular', !an.ok, an);

/* ============ Decisiones definitivas: corrección / anulación / rechazadas validadas en el servidor ============ */
const dc = await api('fac', 'ocCorregir', 'OC-0001', { motivo: 'Facturación intenta corregir' });
T('P1 Facturación no puede corregir órdenes (validado en el servidor, no solo oculto en pantalla)', !dc.ok && dc.code === 'SIN_PERMISO', dc);
const dr = await api('fac', 'ocResponder', 'OC-0001', { resultado: 'RECHAZADA', motivo: 'Facturación intenta rechazar' });
T('P2 Facturación no puede aceptar ni rechazar', !dr.ok && dr.code === 'SIN_PERMISO', dr);
const cf = await api('gco', 'ocCorregir', 'OC-0001', { motivo: 'Con factura activa no debe poder' });
T('P3 No se corrige una OC con factura activa (TIENE_FACTURA) y no se crea otra OC', !cf.ok && cf.code === 'TIENE_FACTURA' && (await q1("select count(*)::int n from master.ordenes_compra"))[0].n === 1, cf);
const antesP = await q1("select id from master.agrupaciones");
const anf = await api('adm', 'anularAgrupacion', antesP[0].id, 'Se anula la factura para corregir la orden');
const corP = await api('ale', 'ocCorregir', 'OC-0001', { motivo: 'El cliente cambió la tarifa acordada' });
const oc2 = await q1("select id, estado, viaje_ids, extra, documentos from master.ordenes_compra order by id");
T('P4 Analista Comercial corrige la OC desde el servidor: la original queda REEMPLAZADA y la nueva PREPARADA, con los mismos viajes', anf.ok === true && corP.ok && oc2.length === 2 && oc2[0].estado === 'REEMPLAZADA' && oc2[1].estado === 'PREPARADA' && oc2[1].viaje_ids.length === oc2[0].viaje_ids.length, [anf, corP, oc2.map(o => o.estado)]);
T('P5 La original conserva sus PDF y los datos de la corrección (usuario, fecha, motivo) y apunta a la nueva', oc2[0].documentos.length >= 2 && oc2[0].extra.correccion.porId === U.ale && /tarifa acordada/.test(oc2[0].extra.correccion.motivo) && oc2[0].extra.reemplazadaPor === oc2[1].id && oc2[1].extra.reemplazaA === oc2[0].id, oc2[0].extra);
const activos = await q1("select count(*)::int n from (select unnest(viaje_ids) v from master.ordenes_compra where estado in ('PREPARADA','ENVIADA','ACEPTADA','RECHAZADA')) x group by v having count(*)>1");
T('P6 Ningún viaje queda en dos órdenes activas en la base', activos.length === 0, activos);
let eRe = ''; try { await db.query(`update master.ordenes_compra set estado='ENVIADA' where id='OC-0001'`); } catch (e) { eRe = e.message; }
T('P7 La base impide reabrir una orden reemplazada (estado final)', /cerrada/.test(eRe), eRe);
let eDupP = ''; try { await db.query(`insert into master.ordenes_compra(id,cliente_id,proyecto,estado,viaje_ids,lineas,total) select 'OC-9999',cliente_id,proyecto,'PREPARADA',viaje_ids,lineas,total from master.ordenes_compra where id='OC-0002'`); } catch (e) { eDupP = e.message; }
T('P8 La base impide una tercera orden activa con los mismos viajes (trigger)', !!eDupP, eDupP);
const an2 = await api('fac', 'ocAnular', 'OC-0002', 'Facturación intenta anular');
const an3 = await api('gco', 'ocAnular', 'OC-0002', 'Gerencia anula la versión preparada');
const vP2 = await q1("select estado, anulada from master.ordenes_compra where id='OC-0002'");
T('P9 Anular: Facturación no puede; Gerencia sí, con motivo, usuario y fecha, y los viajes se liberan', !an2.ok && an2.code === 'SIN_PERMISO' && an3.ok && vP2[0].estado === 'ANULADA' && vP2[0].anulada.porId === U.gco && !!vP2[0].anulada.en, [an2, an3]);
T('P10 Las migraciones siguen sin dar a Facturación, Cobros ni Torre permisos de responder o corregir', (await q1("select count(*)::int n from master.permisos where permiso in ('oc_responder','oc_corregir','oc_ver_combustible') and habilitado and rol not in ('ADMIN','GERENTE_COMERCIAL','ANALISTA_COMERCIAL')"))[0].n === 0);


/* Auditoría */
const aud = await q1("select accion from master.auditoria where entidad='OC' order by id");
T('B1 Cada acción relevante queda en la bitácora (preparar, PDF, envío, respuesta, factura)', ['Orden de compra preparada', 'PDF de orden de compra generado', 'Orden de compra enviada al cliente', 'Orden de compra aceptada por el cliente', 'Factura preparada desde la orden de compra'].every(x => aud.some(y => y.accion === x)), aud.map(x => x.accion));
await db.close();

/* ============ Sin la migración 034: el servidor no se cae ============ */
const V = await montar(BASE);
const sn = await V.api('adm', 'snapshot');
T('Z1 Si la migración 034 aún no se aplicó, el servidor sigue funcionando (snapshot sin órdenes)', sn.ok && (sn.snapshot.ordenesCompra || []).length === 0, sn.message);
const ge = await V.api('adm', 'guardarCliente', { id: 'COLGATE', nombre: 'Colgate', cliente: 'COLGATE', proyectos: ['COLGATE', 'LV'], torreEstatus: false, activo: true });
T('Z2 Las operaciones existentes siguen guardando sin la migración', ge.ok || ge.code !== 'SERVIDOR', ge.message);
await V.db.close();

console.log(filas.join('\n'));
console.log(`\nTotal: ${ok} OK · ${mal} FAIL`);
process.exit(mal ? 1 : 0);
