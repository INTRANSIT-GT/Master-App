/* Pruebas del servidor contra un Postgres real (PGlite): aplica los scripts SQL tal como están en supabase/migrations
   y ejecuta flujos completos a través de handler.mjs (el mismo código que corre en la Edge Function). */
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ejecutar } from '../supabase/functions/api/handler.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlDe = f => fs.readFileSync(path.join(raíz, 'supabase/migrations', f), 'utf8');

/* Migraciones en orden. El 005 es un ejemplo (se ejecuta a mano) y no entra aquí. */
const MIGRACIONES = ['001_esquema.sql', '002_seguridad_rls.sql', '003_almacenamiento.sql', '004_permisos_base.sql',
  '006_flota_fleetio.sql', '007_flujo_operativo.sql', '008_contabilidad.sql', '016_ordenes_pago.sql', '023_corregir_estados_rls.sql', '017_roles_departamentos.sql', '018_rol_proyectos.sql',
  '019_catalogos.sql', '020_arrastres.sql', '021_fecha_entrega_anterior.sql', '024_permisos_gerente_transporte.sql', '025_indices_viajes.sql'];   /* 019: las listas del sistema (OPL, orígenes, tipos) viven en master.catalogos */

const db = new PGlite();
await db.exec('set search_path = master, public');   /* las tablas viven en el esquema master (integración AP_VIAJES) */
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const uuid = () => crypto.randomUUID();

/* ---- entorno mínimo equivalente al de Supabase ---- */
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
await db.exec(ENTORNO);
for (const f of MIGRACIONES) {
  try { await db.exec(sqlDe(f)); T('SQL ' + f + ' se aplica sin errores', true); } catch (e) { T('SQL ' + f + ' se aplica sin errores', false, e.message); }
}
/* Idempotencia de los scripts base (001–004, documentados como re-ejecutables): se prueba en una
   base aparte para no tocar la principal (002 recrea las políticas de master). */
try {
  const db2 = new PGlite();
  await db2.exec('set search_path = master, public'); await db2.exec(ENTORNO);
  const base = MIGRACIONES.filter(f => /^00[1-4]_/.test(f)).map(sqlDe).join('\n');
  await db2.exec(base); await db2.exec(base);
  T('Los scripts base (001–004) son re-ejecutables (idempotentes)', true);
  await db2.close();
} catch (e) { T('Los scripts base (001–004) son re-ejecutables (idempotentes)', false, e.message); }

/* ---- datos base: usuarios (Auth + perfil), clientes, accesos y catálogos ---- */
const U = {}; const mk = async (k, usuario, nombre, rol, proyectos = []) => { U[k] = uuid(); await db.query('insert into auth.users(id,email) values ($1,$2)', [U[k], usuario + '@intransit.test']);
  await db.query('insert into master.perfiles(id,usuario,email,nombre,rol,proyectos) values ($1,$2,$3,$4,$5,$6)', [U[k], usuario, usuario + '@intransit.test', nombre, rol, proyectos]); };
await db.exec(`insert into master.clientes(id,nombre,cliente,proyectos,torre_estatus) values ('COLGATE','Colgate','COLGATE','{COLGATE,LV}',false),('CMI','CMI','CMI','{ABASA}',false),('COCACOLA','Coca-Cola','COCACOLA','{COCACOLA}',true);
  insert into master.clientes_fiscal(cliente_id) values ('COLGATE'),('CMI'),('COCACOLA');`);
await mk('adm', 'admin', 'Administradora', 'ADMIN');
await mk('ped', 'pedro', 'Pedro Chaperon', 'OPERATIVO');
await mk('bry', 'bryan', 'Bryan Cmi', 'OPERATIVO');
await mk('imp', 'implan', 'Encargado COLGATE (IMPLAN)', 'OPERATIVO', ['COLGATE']);
await mk('mar', 'mar', 'Mar Liquidaciones', 'VALIDADOR');
await mk('ale', 'alejandra', 'Alejandra', 'ANALISTA_COMERCIAL');
await mk('fac', 'facturacion', 'Facturación', 'FACTURACION');   /* facturar es de Facturación, no de Analista Comercial */
await mk('gco', 'gcomercial', 'Gerencia Comercial', 'GERENTE_COMERCIAL');
await mk('gtr', 'gtransporte', 'Gerencia Transporte', 'GERENTE_TRANSPORTE');
await mk('fel', 'felipe', 'Felipe Torre', 'TORRE');
await mk('cta', 'conta', 'Contabilidad', 'COBROS');
await db.query(`insert into master.acceso_cliente(user_id,cliente_id) values ($1,'COLGATE'),($2,'CMI'),($3,'COLGATE'),($4,'COLGATE')`, [U.ped, U.bry, U.imp, U.mar]);   /* el validador revisa liquidaciones de su cliente */
await db.exec(`insert into master.flota(unidad,placa,tango,capacidad,tipo) values ('T-1','C-001AAA','TNG-1','10 Ton','10TON'),('T-2','C-002BBB','TNG-2','10 Ton','10TON'),('T-3','C-003CCC','TNG-3','10 Ton','10TON');
  insert into master.pilotos(id,nombre,unidad,cliente_id) values ('P-1','Piloto Uno','T-1','COLGATE'),('P-2','Piloto Dos','T-2','CMI'),('P-3','Piloto Tres','T-3','COLGATE');
  insert into master.destinos(id,nombre,cliente_id) values ('D-C1','Distribuidora Colgate 1','COLGATE'),('D-C2','Distribuidora Colgate 2','COLGATE'),('D-M1','Destino CMI 1','CMI');`);

/* ---- el servidor: mismas dependencias que la Edge Function, con Auth y Storage simulados ---- */
const borrados = [];
let txActual = null;   // PGlite usa una sola conexión: la cuenta de Auth simulada debe insertarse dentro de la misma transacción
const deps = {
  transaccion: fn => db.transaction(tx => { txActual = tx; return fn(async (t, p = []) => tx.query(t, p)); }),
  firmar: async paths => new Map(paths.map(p => [p, 'https://firmado.test/' + p + '?token=x'])),
  crearUsuarioAuth: async ({ email }) => { const id = uuid(); await txActual.query('insert into auth.users(id,email) values ($1,$2)', [id, email]); return id; },
  borrarUsuarioAuth: async id => { borrados.push(id); await db.query('delete from auth.users where id=$1', [id]); }
};
const api = (quien, op, ...args) => ejecutar(deps, U[quien] || quien, { op, args });
const q1 = async (t, p) => (await db.query(t, p)).rows;
const comoUsuario = async (quien, fn) => {       // simula una consulta directa a la API REST con la sesión de ese usuario
  return db.transaction(async tx => {
    await tx.query(`select set_config('request.jwt.claim.sub',$1,true)`, [quien ? U[quien] : '']);
    await tx.query(`set local role ${quien ? 'authenticated' : 'anon'}`);
    return fn(tx);
  });
};
const intenta = async f => { try { await f(); return null; } catch (e) { return e.message; } };

/* ---- 1. Rutas (catálogo) y primeros viajes ---- */
const r1 = await api('adm', 'registrarRuta', { codigo: 'COL-001', nombre: 'CP → Colgate 1', cliente: 'COLGATE', proyecto: 'COLGATE', origenId: 'CP', destinoId: 'D-C1' });
const r2 = await api('adm', 'registrarRuta', { codigo: 'COL-LV1', nombre: 'CP → Colgate LV', cliente: 'COLGATE', proyecto: 'LV', origenId: 'CP', destinoId: 'D-C1' });
const r3 = await api('adm', 'registrarRuta', { codigo: 'CMI-001', nombre: 'CP → CMI 1', cliente: 'CMI', proyecto: 'ABASA', origenId: 'CP', destinoId: 'D-M1' });
T('01 La administradora registra rutas (quedan En tarifación) y se guardan en la base', r1.ok && r2.ok && r3.ok && r1.result.estado === 'EN_TARIFACION' && (await q1('select count(*)::int n from rutas'))[0].n === 3, [r1, r2, r3].map(r => r.message));

const T10 = { tIngresoPlanta: '2031-01-01T08:10', tEsperaRampa: '2031-01-01T08:20', tRampa: '2031-01-01T08:30', tInicioCarga: '2031-01-01T08:40', tFinCarga: '2031-01-01T09:00', tSalidaPlanta: '2031-01-01T09:05', tSalida: '2031-01-01T09:10', tIngresoBodega: '2031-01-01T13:00', tInicioDescarga: '2031-01-01T13:10', tFinDescarga: '2031-01-01T13:40' };
const viaje = (extra = {}) => ({ cliente: 'COLGATE', pilotoId: 'P-1', rutaId: r1.result.id, fechaPlan: '2031-01-01T08:00', shipment: 'S-1', opl: 'J&J', tipoViaje: 'ONE WAY', tipoCarga: 'TARIMAS', noCarga: '1', producto: 'Producto de prueba', placaArrastre: 'C-ARR-001', ...T10, ...extra });
const v1 = await api('ped', 'crearViaje', viaje());
T('02 Pedro crea un viaje: queda guardado con identificador estable', v1.ok && /^\d{6}$/.test(v1.result.id) && (await q1('select count(*)::int n from viajes'))[0].n === 1, v1);
const v1id = v1.result?.id;
const dup = await api('ped', 'crearViaje', viaje());
T('03 No se duplica el mismo viaje (fecha + piloto + ruta)', dup.ok === false && (await q1('select count(*)::int n from viajes'))[0].n === 1, dup);
const lv = await api('adm', 'crearViaje', viaje({ rutaId: r2.result.id, pilotoId: 'P-3', fechaPlan: '2031-01-02T08:00', shipment: 'S-2' }));
const cm = await api('bry', 'crearViaje', viaje({ cliente: 'CMI', rutaId: r3.result.id, pilotoId: 'P-2', fechaPlan: '2031-01-01T09:00', shipment: 'S-3' }));
T('04 Se crean viajes de otros proyectos y clientes', lv.ok && cm.ok, [lv.message, cm.message]);

/* ---- 2. Alcance por cliente y proyecto (servidor) ---- */
const snap = async quien => (await api(quien, 'snapshot')).snapshot;
const sP = await snap('ped'), sB = await snap('bry'), sI = await snap('imp'), sA = await snap('adm');
T('05 Pedro (COLGATE) ve los viajes de COLGATE y ninguno de CMI', sP.trips.length === 2 && sP.trips.every(t => t.proyecto === 'COLGATE'), sP.trips.map(t => t.proyecto));
T('06 Bryan (CMI) solo ve CMI', sB.trips.length === 1 && sB.trips[0].proyecto === 'CMI');
T('07 Encargado con proyecto asignado (IMPLAN) solo ve el proyecto COLGATE, no LV', sI.trips.length === 1 && sI.trips[0].proyectoCat === 'COLGATE', sI.trips.map(t => t.proyectoCat));
T('08 Su lista de rutas se limita a su proyecto', sI.rutas.length === 1 && sI.rutas[0].proyecto === 'COLGATE', sI.rutas.map(r => r.codigo));
T('09 La administradora ve todo', sA.trips.length === 3 && sA.rutas.length === 3, [sA.trips.length, sA.rutas.length]);
const intr = await api('bry', 'iniciar', v1id);
T('10 Bryan no puede operar un viaje de COLGATE aunque conozca su identificador', intr.ok === false && (await q1('select estado from viajes where id=$1', [v1id]))[0].estado === 'PLANIFICADO', intr);
T('11 El intento rechazado queda registrado en la auditoría', (await q1("select count(*)::int n from auditoria where entidad='SEGURIDAD' and por_id=$1", [U.bry]))[0].n >= 1);
const sinSesion = await ejecutar(deps, null, { op: 'snapshot' });
T('12 Sin sesión válida no se entrega nada', sinSesion.ok === false && sinSesion.code === 'NO_AUTENTICADO');
const falsa = await ejecutar(deps, uuid(), { op: 'snapshot' });
T('13 Un usuario autenticado sin perfil activo en la app no recibe datos', falsa.ok === false);
const opMala = await api('adm', 'borrarTodo');
T('14 Operaciones desconocidas se rechazan', opMala.ok === false && opMala.code === 'OP_INVALIDA');

/* ---- 3. Ciclo del viaje y liquidación con evidencia en almacenamiento ---- */
T('15 Pedro inicia y finaliza el viaje', (await api('ped', 'iniciar', v1id)).ok && (await api('ped', 'finalizar', v1id)).ok);
const est = async () => (await q1('select estado from viajes where id=$1', [v1id]))[0].estado;
T('16 El viaje queda Entregado (listo para liquidar)', (await est()) === 'ENTREGADO');
const ruta = f => `viajes/${v1id}/${f}`;
const sinArchivo = await api('ped', 'enviarLiquidacion', v1id, { path: ruta('evidencia-0001.jpg') });
T('17 No se acepta una evidencia que no existe en el almacenamiento', sinArchivo.ok === false, sinArchivo);
const subida = await comoUsuario('ped', tx => intenta(() => tx.query(`insert into storage.objects(bucket_id,name,owner) values ('evidencias',$1,$2)`, [ruta('evidencia-0001.jpg'), U.ped])));
T('18 Pedro puede subir evidencia de su viaje (política de almacenamiento)', subida === null, subida);
const ajena = await comoUsuario('bry', tx => intenta(() => tx.query(`insert into storage.objects(bucket_id,name,owner) values ('evidencias',$1,$2)`, [ruta('evidencia-bryan.jpg'), U.bry])));
T('19 Bryan NO puede subir evidencia a un viaje de otro cliente', ajena !== null, ajena);
const ruidosa = await comoUsuario('ped', tx => intenta(() => tx.query(`insert into storage.objects(bucket_id,name,owner) values ('evidencias',$1,$2)`, ['viajes/' + v1id + '/../../x/hack.jpg', U.ped])));
T('20 Rutas de archivo manipuladas (../) se rechazan', ruidosa !== null, ruidosa);
const enviada = await api('ped', 'enviarLiquidacion', v1id, { path: ruta('evidencia-0001.jpg') });
T('21 Con la evidencia en el almacenamiento, la liquidación se envía', enviada.ok && (await est()) === 'LIQUIDADO', enviada);
const evi = (await snap('mar')).evidencias;
T('22 Quien revisa recibe un enlace firmado (no la ruta interna)', evi.length === 1 && evi[0].dataUrl.startsWith('https://firmado.test/') && evi[0].path === '');
T('23 Bryan no recibe evidencias de otros clientes', (await snap('bry')).evidencias.length === 0);
const rev = await api('ped', 'aprobar', v1id);
T('24 El encargado no puede aprobar su propia liquidación', rev.ok === false);
const ap = await api('mar', 'aprobar', v1id);
T('25 Liquidaciones aprueba y el viaje queda Aceptado', ap.ok && (await est()) === 'ACEPTADO', ap);
T('26 Mar no ve montos, tarifas ni facturas', (await snap('mar')).agrupaciones.length === 0 && (await snap('mar')).tarifas.length === 0 && (await snap('mar')).pagos.length === 0);

/* ---- 4. Comercial: tarifa, aprobación de ruta, factura y reglas ---- */
const tar = await api('ale', 'crearTarifa', { cliente: 'COLGATE', proyecto: 'COLGATE', rutaId: r1.result.id, capacidad: '10 Ton', importe: 4800, importeOpl: 3000, vigenteDesde: '2030-01-01' });
T('27 Comercial registra la tarifa y la ruta pasa a Pendiente de aprobación', tar.ok && (await q1('select estado from rutas where id=$1', [r1.result.id]))[0].estado === 'PENDIENTE_APROBACION', tar);
const apc = await api('gco', 'aprobarRutaComercial', r1.result.id);
const apt = await api('gtr', 'aprobarRutaTransporte', r1.result.id);
T('28 Las dos gerencias aprueban la ruta y queda Activa', apc.ok && apt.ok && (await q1('select estado from rutas where id=$1', [r1.result.id]))[0].estado === 'ACTIVA', [apc.message, apt.message]);
const apl = await api('adm', 'aplicarTarifa', v1id);   /* aplicar tarifa es permiso de Finanzas/Administración */
T('29 Aplica la tarifa vigente al viaje (cliente y OPL en la tabla de importes)', apl.ok && Number((await q1('select tarifa_cliente from viajes_tarifa where viaje_id=$1', [v1id]))[0]?.tarifa_cliente) === 4800 && Number((await q1('select tarifa_opl from viajes_tarifa where viaje_id=$1', [v1id]))[0]?.tarifa_opl) === 3000, apl);
const g = await api('fac', 'prepararFactura', { cliente: 'COLGATE', viajeIds: [v1id], numeroFactura: '', fechaFactura: '' });
const gid = g.result?.id;
const env0 = await api('fac', 'enviarFactura', gid);
T('30 No se envía sin serie, número ni fecha y dice qué falta', env0.ok === false && env0.code === 'FALTAN_CAMPOS' && (env0.faltantes || []).length >= 3, env0);
T('31 La factura rechazada sigue en PREPARADA', (await q1('select fase from agrupaciones where id=$1', [gid]))[0].fase === 'PREPARADA');
const act = await api('fac', 'actualizarFactura', gid, { numeroFactura: 'FAC-9001', serieFactura: 'A', fechaFactura: '2031-02-01' });
const env1 = await api('fac', 'enviarFactura', gid);
T('32 Con datos completos, la factura se envía y el viaje pasa a Facturado', act.ok && env1.ok && (await q1('select fase from agrupaciones where id=$1', [gid]))[0].fase === 'ENVIADA' && (await est()) === 'FACTURADO', [act.message, env1.message]);
const g2 = await api('fac', 'prepararFactura', { cliente: 'COLGATE', viajeIds: [v1id], numeroFactura: 'FAC-9002', serieFactura: 'A', fechaFactura: '2031-02-01' });
T('33 No se puede facturar dos veces el mismo viaje', g2.ok === false, g2);
const gsnap = await snap('gco');
T('34 Gerencia Comercial consulta la facturación pero no la opera', gsnap.agrupaciones.length === 1 && (await api('gco', 'enviarFactura', gid)).ok === false);

/* ---- 5. Integridad de la base ---- */
const ver = await api('adm', 'verificarAuditoria');
T('35 La cadena de huellas de la auditoría es íntegra tras todas las operaciones', ver.ok && ver.result.ok === true && ver.result.total > 10, ver);
T('36 La auditoría no se puede modificar ni borrar ni vaciar', (await intenta(() => db.query("update auditoria set accion='x'"))) !== null && (await intenta(() => db.query('delete from auditoria'))) !== null && (await intenta(() => db.query('truncate auditoria'))) !== null);
T('37 Los viajes no se pueden borrar', (await intenta(() => db.query('delete from viajes'))) !== null);
T('38 No se pueden saltar estados (Facturado → En ruta)', (await intenta(() => db.query("update viajes set estado='EN_RUTA' where id=$1", [v1id]))) !== null);
T('39 La base rechaza una ruta Activa sin código', (await intenta(() => db.query("update rutas set codigo='' where id=$1", [r1.result.id]))) !== null);
T('40 Una factura no puede estar enviada sin número', (await intenta(() => db.query("update agrupaciones set numero_factura='' where id=$1", [gid]))) !== null);

/* ---- 6. RLS: consultas directas con la sesión de cada usuario ---- */
const cuenta = async (quien, tabla) => comoUsuario(quien, async tx => (await tx.query(`select count(*)::int n from master.${tabla}`)).rows[0].n);
T('41 Sin sesión (anon) no se lee ninguna tabla', (await intenta(() => comoUsuario(null, tx => tx.query('select * from master.viajes')))) !== null && (await intenta(() => comoUsuario(null, tx => tx.query('select * from master.perfiles')))) !== null);
T('42 RLS: Pedro solo lee viajes de COLGATE; Bryan solo CMI', await cuenta('ped', 'viajes') === 2 && await cuenta('bry', 'viajes') === 1, [await cuenta('ped', 'viajes'), await cuenta('bry', 'viajes')]);
T('43 RLS: el encargado con proyecto asignado solo lee ese proyecto', await cuenta('imp', 'viajes') === 1);
T('44 RLS: consultar por identificador de otro cliente devuelve 0 filas', await comoUsuario('bry', async tx => (await tx.query('select id from master.viajes where id=$1', [v1id])).rows.length) === 0);
T('45 RLS: costos, tarifas y facturas no son visibles para quien no tiene permiso', await cuenta('ped', 'viajes_costos') === 0 && await cuenta('ped', 'viajes_tarifa') === 0 && await cuenta('ped', 'agrupaciones') === 0 && await cuenta('ped', 'tarifas') === 0);
T('46 RLS: Comercial ve la tarifa del viaje y las facturas', await cuenta('ale', 'viajes_tarifa') === 1 && await cuenta('ale', 'agrupaciones') === 1);
T('47 RLS: cada usuario solo ve su propio perfil (la administradora ve todos)', await cuenta('ped', 'perfiles') === 1 && await cuenta('adm', 'perfiles') === Object.keys(U).length);
T('48 RLS: nadie ve las secuencias internas', (await intenta(() => cuenta('adm', 'secuencias'))) !== null);
const audV = quien => comoUsuario(quien, async tx => (await tx.query('select count(*)::int n from master.auditoria where viaje_id=$1', [v1id])).rows[0].n);
T('49 RLS: la auditoría de un viaje solo la leen quienes pueden ver ese viaje', await audV('bry') === 0 && await audV('ped') > 0 && await cuenta('adm', 'auditoria') > 10, [await audV('bry'), await audV('ped')]);
const escritura = ['update master.viajes set shipment=$$x$$', 'delete from master.viajes', "insert into master.clientes(id,nombre,cliente) values ($$ZZ$$,$$Z$$,$$Z$$)", "update master.perfiles set rol=$$ADMIN$$", "update master.permisos set habilitado=true"];
for (const [i, s] of escritura.entries()) T('50.' + (i + 1) + ' Un usuario no puede escribir directamente: ' + s.split(' ').slice(0, 3).join(' '), (await intenta(() => comoUsuario('adm', tx => tx.query(s)))) !== null);
const ev = await comoUsuario('ped', async tx => (await tx.query('select count(*)::int n from storage.objects')).rows[0].n), ev2 = await comoUsuario('bry', async tx => (await tx.query('select count(*)::int n from storage.objects')).rows[0].n);
T('51 Almacenamiento: Pedro ve la evidencia de su viaje y Bryan no', ev === 1 && ev2 === 0, [ev, ev2]);

/* ---- 7. Rutas nuevas, validación y notificaciones ---- */
const sol = await api('imp', 'solicitarRuta', { cliente: 'COLGATE', proyecto: 'COLGATE', nombre: 'Ruta nueva Escuintla', origenProp: 'CEDIS Mixco', destinoProp: 'Escuintla centro' });
T('52 Encargado/IMPLAN solicita una ruta nueva: queda PENDIENTE', sol.ok && (await q1('select estado from rutas where id=$1', [sol.result?.id]))[0].estado === 'PENDIENTE', sol);
const nt = await q1('select destinatarios from notificaciones order by id desc limit 1');
T('53 Genera la notificación para las dos gerencias', nt[0] && nt[0].destinatarios.includes('GERENTE_COMERCIAL') && nt[0].destinatarios.includes('GERENTE_TRANSPORTE'), nt);
T('54 Otro proyecto o cliente: solicitud rechazada', (await api('imp', 'solicitarRuta', { cliente: 'CMI', proyecto: 'ABASA', nombre: 'X ruta' })).ok === false && (await api('imp', 'solicitarRuta', { cliente: 'COLGATE', proyecto: 'LV', nombre: 'X ruta' })).ok === false);
const val = await api('ale', 'validarRuta', sol.result.id, { codigo: 'COL-099', origenId: 'CP', destinoId: 'D-C2' });
T('55 Comercial valida la ruta: queda En tarifación con código', val.ok && (await q1('select estado,codigo from rutas where id=$1', [sol.result.id]))[0].estado === 'EN_TARIFACION' && (await q1('select codigo from rutas where id=$1', [sol.result.id]))[0].codigo === 'COL-099', val);

/* ---- 8. Usuarios: alta con cuenta de acceso solo para la administradora ---- */
const nuevo = await api('adm', 'guardarUsuario', { usuario: 'nuevo1', nombre: 'Nuevo Operativo', email: 'Nuevo1@intransit.test', clave: 'ClaveSegura1', rol: 'OPERATIVO', clientes: ['CMI'], proyectos: [], activo: true });
const filaNuevo = (await q1('select p.email, u.email as uemail from perfiles p join auth.users u on u.id=p.id where p.usuario=$1', ['nuevo1']))[0];
T('56 La administradora crea un usuario: se crea la cuenta Auth y el perfil con el mismo identificador', nuevo.ok && filaNuevo && filaNuevo.uemail === 'nuevo1@intransit.test', nuevo);
const intruso = await api('ped', 'guardarUsuario', { usuario: 'intruso', nombre: 'Intruso Root', email: 'i@i.test', clave: 'ClaveSegura1', rol: 'ADMIN', clientes: [] });
T('57 Un encargado NO puede crear usuarios (ni se crea cuenta de acceso)', intruso.ok === false && (await q1("select count(*)::int n from auth.users where email='i@i.test'"))[0].n === 0, intruso);
const malo = await api('adm', 'guardarUsuario', { usuario: 'pedro', nombre: 'Duplicado Pedro', email: 'dup@x.test', clave: 'ClaveSegura1', rol: 'OPERATIVO', clientes: ['CMI'] });
T('58 Si el motor rechaza el alta, la cuenta de acceso creada se elimina (no quedan cuentas huérfanas)', malo.ok === false && (await q1("select count(*)::int n from auth.users where email='dup@x.test'"))[0].n === 0 && borrados.length >= 1, malo);
T('59 No se puede conceder a un perfil un permiso prohibido (separación de funciones)', (await api('adm', 'setPermiso', 'OPERATIVO', 'liq_aprobar', true)).ok === false);
T('60 Torre: solo avanza el estado y solo en clientes autorizados', (await api('fel', 'torreMoverEstado', v1id, 'EN_RUTA')).ok === false);

/* ---- 9. OPL (proveedor) y órdenes de pago ---- */
T('61 El viaje facturado queda con su tarifa de OPL lista para pagar al proveedor', Number((await q1('select tarifa_opl from viajes_tarifa where viaje_id=$1', [v1id]))[0].tarifa_opl) === 3000);
const opSin = await api('adm', 'crearOrdenPago', { proveedor: 'J&J', viajeIds: [] });
const opProv = await api('adm', 'crearOrdenPago', { proveedor: 'GTL', viajeIds: [v1id] });
const opNoFact = await api('adm', 'crearOrdenPago', { proveedor: 'J&J', viajeIds: [lv.result.id] });
T('62 La orden exige viajes, un proveedor válido y que el viaje esté facturado al cliente', opSin.ok === false && opProv.code === 'VALIDACION' && opNoFact.code === 'NO_FACTURADO', [opSin.message, opProv.message, opNoFact.message]);
const op1 = await api('adm', 'crearOrdenPago', { proveedor: 'J&J', viajeIds: [v1id] });
const op1id = op1.result?.id;
T('63 Se emite la orden de pago del proveedor por el total de la OPL', op1.ok && op1.result.fase === 'EMITIDA' && op1.result.importe === 3000 && /^OP-\d{4}$/.test(op1id), op1);
const opDup = await api('adm', 'crearOrdenPago', { proveedor: 'J&J', viajeIds: [v1id] });
T('64 Un viaje no puede entrar en dos órdenes de pago activas', opDup.ok === false && opDup.code === 'YA_EN_ORDEN', opDup);
const anulCorta = await api('adm', 'anularOrdenPago', op1id, 'no');
T('65 Anular una orden exige un motivo', anulCorta.ok === false, anulCorta);
const anul = await api('adm', 'anularOrdenPago', op1id, 'Proveedor cambió de condiciones');
const op2 = await api('adm', 'crearOrdenPago', { proveedor: 'J&J', viajeIds: [v1id] });
T('66 La orden emitida se anula y su viaje puede volver a una orden nueva', anul.ok && (await q1('select estado from ordenes_pago where id=$1', [op1id]))[0].estado === 'ANULADA' && op2.ok, anul);
const op2id = op2.result?.id;
const rutaOp = f => `pagos/${op2id}/${f}`;
const sinDocs = await api('adm', 'registrarTransferencia', op2id, { fecha: '2031-03-01', monto: 3000, referencia: 'TRF-9001' });
T('67 Sin la evidencia y la factura del proveedor, la orden no se cierra', sinDocs.ok === false && sinDocs.code === 'SIN_ARCHIVO', sinDocs);
const subDoc = await comoUsuario('adm', tx => intenta(() => tx.query(`insert into storage.objects(bucket_id,name,owner) values ('evidencias',$1,$2)`, [rutaOp('orden-documento-0001.pdf'), U.adm])));
const subTrf = await comoUsuario('adm', tx => intenta(() => tx.query(`insert into storage.objects(bucket_id,name,owner) values ('evidencias',$1,$2)`, [rutaOp('transferencia-0001.pdf'), U.adm])));
const subFac = await comoUsuario('adm', tx => intenta(() => tx.query(`insert into storage.objects(bucket_id,name,owner) values ('evidencias',$1,$2)`, [rutaOp('factura-proveedor-0001.pdf'), U.adm])));
T('68 La política de almacenamiento permite subir los archivos de la orden', subDoc === null && subTrf === null && subFac === null, [subDoc, subTrf, subFac]);
const doc = await api('adm', 'adjuntarDocumentoOrden', op2id, { path: rutaOp('orden-documento-0001.pdf'), nombre: 'orden.pdf' });
T('69 Se adjunta el documento de la orden (con archivo real en el almacenamiento)', doc.ok && doc.result.emision.documento.path === rutaOp('orden-documento-0001.pdf'), doc);
const pagoCorto = await api('adm', 'registrarTransferencia', op2id, { fecha: '2031-03-01', monto: 100, referencia: 'TRF-9000', evidencia: { path: rutaOp('transferencia-0001.pdf'), nombre: 'transferencia.pdf' }, factura: { path: rutaOp('factura-proveedor-0001.pdf'), nombre: 'factura.pdf' } });
T('70 Un pago por un monto distinto al de la orden se rechaza', pagoCorto.ok === false && pagoCorto.code === 'MONTO_DISTINTO', pagoCorto);
T('71 El intento rechazado no cierra la orden ni registra ningún pago', (await q1('select fase from ordenes_pago where id=$1', [op2id]))[0].fase === 'EMITIDA' && (await q1("select count(*)::int n from pagos where extra->>'ordenPagoId'=$1", [op2id]))[0].n === 0);
const tr = await api('adm', 'registrarTransferencia', op2id, { fecha: '2031-03-01', monto: 3000, referencia: 'TRF-9001', evidencia: { path: rutaOp('transferencia-0001.pdf'), nombre: 'transferencia.pdf' }, factura: { path: rutaOp('factura-proveedor-0001.pdf'), nombre: 'factura.pdf' } });
T('72 Con evidencia y factura, la orden se paga y queda el pago al proveedor', tr.ok && tr.result.fase === 'PAGADA' && (await q1("select count(*)::int n from pagos where tipo='PROVEEDOR' and viaje_id=$1", [v1id]))[0].n === 1, tr);
const anulPagada = await api('adm', 'anularOrdenPago', op2id, 'Intentar anular una paga');
T('73 Una orden ya pagada no se anula', anulPagada.ok === false, anulPagada);
const rePagar = await api('adm', 'crearOrdenPago', { proveedor: 'J&J', viajeIds: [v1id] });
T('74 El viaje de una orden pagada ya no se puede volver a incluir', rePagar.ok === false && rePagar.code === 'YA_EN_ORDEN', rePagar);
T('75 RLS: solo quien puede ver finanzas lee las órdenes de pago', await cuenta('adm', 'ordenes_pago') === 2 && await cuenta('ped', 'ordenes_pago') === 0);


/* ---- 10. Viajes de la carga anterior: Entregados/Rechazados sin fecha de entrega ---- */
const vOld = await api('ped', 'crearViaje', viaje({ shipment: 'S-OLD-1', fechaPlan: '2031-04-01T08:00' }));
const vOldId = vOld.result?.id;
await api('ped', 'iniciar', vOldId); await api('ped', 'finalizar', vOldId);
const rutaOld = f => `viajes/${vOldId}/${f}`;
await comoUsuario('ped', tx => intenta(() => tx.query(`insert into storage.objects(bucket_id,name,owner) values ('evidencias',$1,$2)`, [rutaOld('evidencia-0002.jpg'), U.ped])));
await q1('update viajes set finalizado_en=null where id=$1', [vOldId]);   /* así quedaron los viajes migrados (007) */
const liqOld = await api('ped', 'enviarLiquidacion', vOldId, { path: rutaOld('evidencia-0002.jpg') });
const fOld = (await q1('select estado,finalizado_en from viajes where id=$1', [vOldId]))[0];
T('76 Un viaje Entregado sin fecha de entrega (carga anterior) sí puede liquidarse', liqOld.ok && fOld.estado === 'LIQUIDADO', liqOld.message);
T('77 La fecha de entrega se completa y queda guardada en el viaje', !!fOld.finalizado_en, fOld);
T('78 Queda la constancia en la auditoría del viaje', (await q1("select count(*)::int n from auditoria where viaje_id=$1 and accion ilike '%Fecha de entrega completada%'", [vOldId]))[0].n === 1);
await api('mar', 'devolver', vOldId, 'Falta la firma del cliente');
await q1('update viajes set finalizado_en=null where id=$1', [vOldId]);
const liqOld2 = await api('ped', 'enviarLiquidacion', vOldId, { path: rutaOld('evidencia-0002.jpg') });
T('79 Un viaje Rechazado sin fecha de entrega se puede volver a liquidar', liqOld2.ok && (await q1('select estado from viajes where id=$1', [vOldId]))[0].estado === 'LIQUIDADO', liqOld2.message);


/* ---- 11. La migración 021 rellena la fecha de entrega de la carga anterior ---- */
await q1('update viajes set finalizado_en=null where id=$1', [vOldId]);
await db.exec(sqlDe('021_fecha_entrega_anterior.sql', '024_permisos_gerente_transporte.sql', '025_indices_viajes.sql'));
const fOld21 = (await q1('select finalizado_en from viajes where id=$1', [vOldId]))[0];
T('80 La migración 021 completa la fecha de entrega de los viajes viejos (la toma de la auditoría)', !!fOld21.finalizado_en, fOld21);
T('81 La migración no inventa fechas en los viajes que todavía no se entregaron', (await q1("select count(*)::int n from viajes where estado in ('PLANIFICADO','EN_RUTA') and finalizado_en is not null"))[0].n === 0);

/* ---- 12. El estado no se salta: a mano solo En ruta / Entregado, paso a paso ---- */
const vEst = await api('ped', 'crearViaje', viaje({ shipment: 'S-EST-1', fechaPlan: '2031-05-01T08:00' }));
const vEstId = vEst.result?.id;
const saltoCob = await api('adm', 'editarViaje', vEstId, { estado: 'COBRADO' }, 'prueba');
T('82 El estado de un paso del flujo (Cobrado) no se puede fijar a mano', saltoCob.ok === false && saltoCob.code === 'ESTADO_NO_AUTORIZADO', saltoCob);
const saltoEnt = await api('adm', 'editarViaje', vEstId, { estado: 'ENTREGADO' }, 'prueba');
T('83 No se puede saltar de Planificado a Entregado (ni un paso de más)', saltoEnt.ok === false && saltoEnt.code === 'TRANSICION_INVALIDA', saltoEnt);
const naceCob = await api('adm', 'crearViaje', viaje({ shipment: 'S-EST-2', estado: 'COBRADO', fechaPlan: '2031-05-02T08:00' }));
T('84 Un viaje nuevo no puede nacer en otro estado que Planificado', naceCob.ok === false && naceCob.code === 'ESTADO_NO_AUTORIZADO', naceCob);
const sinPerm = await api('ped', 'editarViaje', vEstId, { estado: 'EN_RUTA' }, 'prueba');
T('85 Quien no tiene el permiso no cambia el estado (Pedro)', sinPerm.ok === false && sinPerm.code === 'SIN_PERMISO', sinPerm);
const aRuta = await api('adm', 'editarViaje', vEstId, { estado: 'EN_RUTA' }, 'Corrección de la torre');
T('86 El paso permitido (Planificado → En ruta) sí se aplica', aRuta.ok === true && (await q1('select estado from viajes where id=$1', [vEstId]))[0].estado === 'EN_RUTA', aRuta);
const aEnt = await api('adm', 'editarViaje', vEstId, { estado: 'ENTREGADO' }, 'Corrección de la torre');
const fEst = (await q1('select estado,finalizado_en from viajes where id=$1', [vEstId]))[0];
T('87 En ruta → Entregado queda con su fecha de entrega', aEnt.ok === true && fEst.estado === 'ENTREGADO' && !!fEst.finalizado_en, [aEnt.message, fEst]);
T('88 Los dos cambios quedan en la bitácora como corrección a mano', (await q1("select count(*)::int n from auditoria where viaje_id=$1 and accion='Estado corregido a mano'", [vEstId]))[0].n === 2);

/* ---- 13. Ventana de viajes: en pantalla lo diario, el histórico a pedido ---- */
await q1("update viajes set estado='COBRADO', fecha_plan='2019-01-01T08:00' where id=$1", [v1id]);
const snV = (await api('adm', 'snapshot')).snapshot;
T('89 Un viaje de 2019 ya no viaja en la pantalla (ventana de 6 meses)', !snV.trips.some(t => t.id === v1id) && snV.ventana && snV.ventana.meses === 3 && !!snV.ventana.desde, [snV.trips.length, snV.ventana]);
T('90 La pantalla informa cuántos viajes ve en toda la base', snV.ventana.enBase >= (await q1('select count(*)::int n from viajes'))[0].n && snV.ventana.enBase >= snV.ventana.viajes, snV.ventana);
const rH = await api('adm', 'resumenHistorico');
T('91 Los totales del histórico SÍ siguen contando el viaje viejo', rH.ok && (rH.result.porEstado.COBRADO || 0) >= 1 && rH.result.viajes >= (await q1('select count(*)::int n from viajes'))[0].n, rH.result && rH.result.porEstado);
const sumSql = Number((await q1("select coalesce(sum(coalesce(tv.tarifa_opl, vc.costo_proveedor)),0)::float8 s from viajes v left join viajes_tarifa tv on tv.viaje_id=v.id left join viajes_costos vc on vc.viaje_id=v.id where v.estado in ('ENTREGADO','LIQUIDADO','ACEPTADO','RECHAZADO','FACTURADO','COBRADO')"))[0].s);
T('92 El total histórico «por pagar a proveedores» coincide con la base', rH.ok && Math.abs(rH.result.financiero.M.porPagarProv - sumSql) < 0.01, [rH.result && rH.result.financiero.M.porPagarProv, sumSql]);
const pAnt = await api('adm', 'viajesAnteriores', { antesDe: '2020-01-01' });
T('93 La página de histórico trae los viajes anteriores con su liquidación y su bitácora', pAnt.ok && pAnt.result.trips.some(t => t.id === v1id) && pAnt.result.liquidaciones.some(l => l.viajeId === v1id) && pAnt.result.audit.some(a => a.viajeId === v1id), pAnt.result && pAnt.result.trips.map(t => t.id));
const pSin = await api('adm', 'viajesAnteriores', { antesDe: '2019-01-01' });
T('94 La página avanza: al pedir antes de 2019 ya no repite el viaje de 2019', pSin.ok && pSin.result.antesDe === '2019-01-01' && !pSin.result.trips.some(t => t.id === v1id), [pSin.result && pSin.result.antesDe, pSin.result && pSin.result.trips.map(t => [t.id, t.fechaPlan])]);
const pLim = await api('adm', 'viajesAnteriores', { antesDe: '2031-01-01', limite: 2 });
T('95 La página respeta el límite pedido', pLim.ok && pLim.result.trips.length <= 2, pLim.result && pLim.result.trips.length);
const bAnt = await api('adm', 'buscarViajes', { texto: v1id });
T('96 La búsqueda encuentra un viaje que NO está en la ventana (busca en todo el histórico)', bAnt.ok && bAnt.result.trips.some(t => t.id === v1id), bAnt.result && bAnt.result.trips.map(t => t.id));
const bNada = await api('adm', 'buscarViajes', { texto: '' });
T('97 Sin texto la búsqueda no devuelve nada (no recorre la base de gratis)', bNada.ok && bNada.result.trips.length === 0);
const pMes = rH.result.porMes && Object.keys(rH.result.porMes);
const mesSql = (await q1("select to_char(fecha_plan::timestamp,'YYYY-MM') m, count(*)::int n from viajes where fecha_plan ~ '^\\d{4}-\\d{2}' group by 1 order by 1 desc limit 1"))[0];
T('99 El resumen por mes coincide con la base (meses y conteo)', pMes.length > 0 && pMes.includes(mesSql.m) && Object.values(rH.result.porMes[mesSql.m]).reduce((a, b) => a + b, 0) === mesSql.n, [pMes, mesSql]);
const bLike = await api('adm', 'buscarViajes', { texto: '%' });
T('98 El comodín «%» se escapa: no se convierte en «trae todo»', bLike.ok && bLike.result.trips.length === 0, bLike.result && bLike.result.trips.length);

/* El bloque financiero viaja protegido: si un dato del histórico lo rompe, la gráfica por mes (lo que ve
   todo el mundo, incluidas las administradoras) se devuelve igual y el motivo viene en `finError`. */
T('100 El resumen histórico separa la gráfica de los números financieros (`porMes` + `finError`)', rH.ok && 'finError' in rH.result && !!rH.result.porMes && rH.result.finError === '', [rH.result && rH.result.finError, rH.result && Object.keys(rH.result.porMes || {}).length]);
T('101 La suma de los meses del resumen coincide con los viajes contados por estado', rH.ok && Object.values(rH.result.porMes).reduce((a, m) => a + Object.values(m).reduce((x, n) => x + n, 0), 0) === Object.values(rH.result.porEstado).reduce((a, n) => a + n, 0));
/* Gerente de Transporte: visibilidad total y acción de transporte, con el control financiero en consulta.
   No tiene ninguna fila en acceso_cliente, así que registrar un viaje de CMI prueba que ve TODOS los clientes. */
const gViaje = await api('gtr', 'crearViaje', viaje({ cliente: 'CMI', rutaId: r3.result.id, pilotoId: 'P-2', shipment: 'S-GTR-1', fechaPlan: '2031-06-01T08:00' }));
T('103 El Gerente de Transporte registra viajes de cualquier cliente (ve todos los clientes)', gViaje.ok && gViaje.result && gViaje.result.proyecto === 'CMI' && gViaje.result.estado === 'PLANIFICADO', gViaje);
const gFin = await api('gtr', 'resumenHistorico');
T('104 El Gerente de Transporte consulta el control financiero (ingresos y gastos)', gFin.ok && gFin.result && gFin.result.financiero && gFin.result.financiero.M && typeof gFin.result.financiero.M.costoTotal !== 'undefined', gFin.result && gFin.result.finError);
const gCosto = await api('gtr', 'registrarImportes', gViaje.result.id, { costoProveedor: '100' });
T('105 …pero NO puede registrar costos: el control financiero es solo de consulta', !gCosto.ok && gCosto.code === 'SIN_PERMISO', gCosto);
/* El «M» de «Cargados N de M» de un perfil limitado cuenta solo sus viajes visibles, con una sola consulta
   de conjunto (antes se evaluaba la función de RLS viaje por viaje: 2,7 s de promedio con 7.000 viajes). */
const snImpR = await api('imp', 'snapshot'); const snImp = snImpR.snapshot || {};
const impSql = (await q1("select count(*)::int n from viajes v where v.cliente_id='COLGATE' and v.proyecto_cat='COLGATE'"))[0].n;
T('106 El perfil limitado informa «en la base» solo sus viajes visibles', snImpR.ok && snImp.ventana && snImp.ventana.enBase === impSql, [snImp.ventana && snImp.ventana.enBase, impSql]);
/* El código de la ruta lo asigna el sistema: el usuario no tiene que inventarlo al solicitar, validar ni registrar. */
await db.exec(`insert into master.destinos(id,nombre,cliente_id) values ('D-C3','Colgate 3','COLGATE'),('D-C4','Colgate 4','COLGATE') on conflict do nothing`);
const solR = await api('imp', 'solicitarRuta', { cliente: 'COLGATE', proyecto: 'COLGATE', nombre: 'CP → Bodega Central' });
const valR = await api('gtr', 'validarRuta', solR.result.id, { origenId: 'CP', destinoId: 'D-C3' });
T('113 Al validar una ruta sin escribir código, el sistema lo asigna (sigla del cliente + correlativo)', valR.ok && /^COL-\d{3,4}$/.test(valR.result.codigo), [valR.ok, valR.code, valR.message, valR.result && valR.result.codigo]);
const regR = await api('adm', 'registrarRuta', { nombre: 'CP → Colgate Sur', cliente: 'COLGATE', proyecto: 'COLGATE', origenId: 'CP', destinoId: 'D-C4' });
T('114 Al registrar una ruta del catálogo sin código, también se asigna solo y no repite el anterior', regR.ok && /^COL-\d{3,4}$/.test(regR.result.codigo) && regR.result.codigo !== valR.result.codigo, regR);

/* Activar o desactivar un perfil (la columna «Estado» de Usuarios y permisos). */
const apagar = await api('adm', 'activarUsuario', U.bry, false);
T('107 La administradora desactiva el perfil de un usuario', apagar.ok && apagar.result.activo === false && (await q1('select activo from perfiles where id=$1', [U.bry]))[0].activo === false, apagar);
const entraOff = await api('bry', 'snapshot');
T('108 Un perfil desactivado ya no puede operar (el servidor rechaza la sesión)', !entraOff.ok && entraOff.code === 'NO_AUTENTICADO', entraOff);
const yoMismo = await api('adm', 'activarUsuario', U.adm, false);
T('109 La administradora no puede desactivar su propio perfil (se quedaría sin acceso)', !yoMismo.ok && yoMismo.code === 'VALIDACION', yoMismo);
const prende = await api('adm', 'activarUsuario', U.bry, true);
T('110 Al reactivarlo vuelve a trabajar con los mismos permisos', prende.ok && prende.result.activo === true && (await api('bry', 'snapshot')).ok, prende);
const sinPermiso = await api('gtr', 'activarUsuario', U.bry, false);
T('111 Un perfil sin «gestionar usuarios» no puede activar ni desactivar', !sinPermiso.ok && sinPermiso.code === 'SIN_PERMISO', sinPermiso);
T('112 El cambio queda en la auditoría', (await q1("select count(*)::int n from auditoria where entidad='USUARIO' and accion like 'Perfil %activado'"))[0].n >= 2);

const rOper = await api('ped', 'resumenHistorico');
T('102 Un perfil sin permiso de finanzas recibe la gráfica con «financiero» en null', rOper.ok && !!rOper.result.porMes && rOper.result.financiero === null && rOper.result.finError === '', rOper.result && Object.keys(rOper.result.porMes || {}).length);

console.log(filas.join('\n'));
console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
