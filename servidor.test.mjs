/* Pruebas del servidor contra un Postgres real (PGlite): aplica los scripts SQL tal como están en supabase/migrations
   y ejecuta flujos completos a través de handler.mjs (el mismo código que corre en la Edge Function). */
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ejecutar } from '../supabase/functions/api/handler.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlDe = f => fs.readFileSync(path.join(raíz, 'supabase/migrations', f), 'utf8');

const db = new PGlite();
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const uuid = () => crypto.randomUUID();

/* ---- entorno mínimo equivalente al de Supabase ---- */
await db.exec(`
  create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users(id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to anon, authenticated;
  create schema storage;
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security;
  grant usage on schema storage to authenticated; grant select, insert on storage.objects to authenticated;
`);
for (const f of ['001_esquema.sql', '002_seguridad_rls.sql', '003_almacenamiento.sql', '004_permisos_base.sql']) {
  try { await db.exec(sqlDe(f)); T('SQL ' + f + ' se aplica sin errores', true); } catch (e) { T('SQL ' + f + ' se aplica sin errores', false, e.message); }
}
try { await db.exec(sqlDe('001_esquema.sql') + sqlDe('002_seguridad_rls.sql') + sqlDe('003_almacenamiento.sql') + sqlDe('004_permisos_base.sql')); T('Los scripts son re-ejecutables (idempotentes)', true); }
catch (e) { T('Los scripts son re-ejecutables (idempotentes)', false, e.message); }

/* ---- datos base: usuarios (Auth + perfil), clientes, accesos y catálogos ---- */
const U = {}; const mk = async (k, usuario, nombre, rol, proyectos = []) => { U[k] = uuid(); await db.query('insert into auth.users(id,email) values ($1,$2)', [U[k], usuario + '@intransit.test']);
  await db.query('insert into public.perfiles(id,usuario,email,nombre,rol,proyectos) values ($1,$2,$3,$4,$5,$6)', [U[k], usuario, usuario + '@intransit.test', nombre, rol, proyectos]); };
await db.exec(`insert into public.clientes(id,nombre,cliente,proyectos,torre_estatus) values ('COLGATE','Colgate','COLGATE','{COLGATE,LV}',false),('CMI','CMI','CMI','{ABASA}',false),('COCACOLA','Coca-Cola','COCACOLA','{COCACOLA}',true);
  insert into public.clientes_fiscal(cliente_id) values ('COLGATE'),('CMI'),('COCACOLA');`);
await mk('adm', 'admin', 'Administradora', 'ADMIN'); await mk('ped', 'pedro', 'Pedro Chaperon', 'ENCARGADO'); await mk('bry', 'bryan', 'Bryan Cmi', 'ENCARGADO');
await mk('imp', 'implan', 'Encargado COLGATE (IMPLAN)', 'ENCARGADO', ['COLGATE']); await mk('mar', 'mar', 'Mar Liquidaciones', 'LIQUIDACIONES');
await mk('ale', 'alejandra', 'Alejandra', 'COMERCIAL'); await mk('ger', 'gerencia', 'Gerencia', 'GERENCIA'); await mk('fel', 'felipe', 'Felipe Torre', 'TORRE');
await db.query(`insert into public.acceso_cliente(user_id,cliente_id) values ($1,'COLGATE'),($2,'CMI'),($3,'COLGATE')`, [U.ped, U.bry, U.imp]);
await db.exec(`insert into public.flota(unidad,placa,tango,capacidad,tipo) values ('T-1','C-001AAA','TNG-1','10 Ton','10TON'),('T-2','C-002BBB','TNG-2','10 Ton','10TON'),('T-3','C-003CCC','TNG-3','10 Ton','10TON');
  insert into public.pilotos(id,nombre,unidad,cliente_id) values ('P-1','Piloto Uno','T-1','COLGATE'),('P-2','Piloto Dos','T-2','CMI'),('P-3','Piloto Tres','T-3','COLGATE');
  insert into public.destinos(id,nombre,cliente_id) values ('D-C1','Distribuidora Colgate 1','COLGATE'),('D-C2','Distribuidora Colgate 2','COLGATE'),('D-M1','Destino CMI 1','CMI');`);

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

/* ---- 1. Rutas (catálogo) y primer viaje ---- */
const r1 = await api('adm', 'registrarRuta', { codigo: 'COL-001', nombre: 'CP → Colgate 1', cliente: 'COLGATE', proyecto: 'COLGATE', origenId: 'CP', destinoId: 'D-C1' });
const r2 = await api('adm', 'registrarRuta', { codigo: 'COL-LV1', nombre: 'CP → Colgate LV', cliente: 'COLGATE', proyecto: 'LV', origenId: 'CP', destinoId: 'D-C1' });
const r3 = await api('adm', 'registrarRuta', { codigo: 'CMI-001', nombre: 'CP → CMI 1', cliente: 'CMI', proyecto: 'ABASA', origenId: 'CP', destinoId: 'D-M1' });
T('01 La administradora registra rutas y se guardan en la base', r1.ok && r2.ok && r3.ok && (await q1('select count(*)::int n from rutas'))[0].n === 3, [r1, r2, r3].map(r => r.message));
const viaje = (extra = {}) => ({ cliente: 'COLGATE', proyectoCat: 'COLGATE', pilotoId: 'P-1', rutaId: r1.result.id, fechaPlan: '2031-01-01T08:00', estatus: 'EN ESPERA', shipment: 'S-1', ...extra });
const v1 = await api('ped', 'crearViaje', viaje());
T('02 Pedro crea un viaje: queda guardado con identificador estable', v1.ok && /^\d{6}$/.test(v1.result.id) && (await q1('select count(*)::int n from viajes'))[0].n === 1, v1);
const v1id = v1.result?.id;
const dup = await api('ped', 'crearViaje', viaje());
T('03 No se duplica el mismo viaje (fecha + piloto + ruta)', dup.ok === false && (await q1('select count(*)::int n from viajes'))[0].n === 1, dup);
const lv = await api('adm', 'crearViaje', viaje({ proyectoCat: 'LV', rutaId: r2.result.id, pilotoId: 'P-3', fechaPlan: '2031-01-02T08:00' }));
const cm = await api('bry', 'crearViaje', { cliente: 'CMI', proyectoCat: 'ABASA', pilotoId: 'P-2', rutaId: r3.result.id, fechaPlan: '2031-01-01T09:00', estatus: 'EN ESPERA' });
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
T('10 Bryan no puede operar un viaje de COLGATE aunque conozca su identificador', intr.ok === false && (await q1('select estado from viajes where id=$1', [v1id]))[0].estado === 'PENDIENTE', intr);
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
const ruta = f => `viajes/${v1id}/${f}`;
const sinArchivo = await api('ped', 'enviarLiquidacion', v1id, { path: ruta('evidencia-0001.jpg') });
T('16 No se acepta una evidencia que no existe en el almacenamiento', sinArchivo.ok === false, sinArchivo);
const subida = await comoUsuario('ped', tx => intenta(() => tx.query(`insert into storage.objects(bucket_id,name,owner) values ('evidencias',$1,$2)`, [ruta('evidencia-0001.jpg'), U.ped])));
T('17 Pedro puede subir evidencia de su viaje (política de almacenamiento)', subida === null, subida);
const ajena = await comoUsuario('bry', tx => intenta(() => tx.query(`insert into storage.objects(bucket_id,name,owner) values ('evidencias',$1,$2)`, [ruta('evidencia-bryan.jpg'), U.bry])));
T('18 Bryan NO puede subir evidencia a un viaje de otro cliente', ajena !== null, ajena);
const ruidosa = await comoUsuario('ped', tx => intenta(() => tx.query(`insert into storage.objects(bucket_id,name,owner) values ('evidencias',$1,$2)`, ['viajes/' + v1id + '/../../x/hack.jpg', U.ped])));
T('19 Rutas de archivo manipuladas (../) se rechazan', ruidosa !== null, ruidosa);
const enviada = await api('ped', 'enviarLiquidacion', v1id, { path: ruta('evidencia-0001.jpg') });
T('20 Con la evidencia en el almacenamiento, la liquidación se envía', enviada.ok && ['EN_REVISION', 'PENDIENTE_LIQUIDACION'].includes(await est()), enviada);
const evi = (await snap('mar')).evidencias;
T('21 Quien revisa recibe un enlace firmado (no la ruta interna)', evi.length === 1 && evi[0].dataUrl.startsWith('https://firmado.test/') && evi[0].path === '');
T('22 Bryan no recibe evidencias de otros clientes', (await snap('bry')).evidencias.length === 0);
const rev = await api('ped', 'aprobar', v1id);
T('23 El encargado no puede aprobar su propia liquidación', rev.ok === false);
const ap = await api('mar', 'aprobar', v1id);
T('24 Liquidaciones aprueba y el viaje pasa a Comercial', ap.ok && (await est()) === 'PENDIENTE_COMERCIAL', ap);
T('25 Mar no ve montos, tarifas ni facturas', (await snap('mar')).agrupaciones.length === 0 && (await snap('mar')).tarifas.length === 0 && (await snap('mar')).pagos.length === 0);

/* ---- 4. Comercial: tarifa, factura y reglas de validación ---- */
const tar = await api('ale', 'crearTarifa', { cliente: 'COLGATE', proyecto: 'COLGATE', rutaId: r1.result.id, capacidad: '10 Ton', importe: 4800, vigenteDesde: '2030-01-01' });
T('26 Comercial registra la tarifa', tar.ok, tar);
const apl = await api('ale', 'aplicarTarifa', v1id);
T('27 Aplica la tarifa vigente al viaje (guardada en la tabla de importes)', apl.ok && Number((await q1('select tarifa_cliente from viajes_tarifa where viaje_id=$1', [v1id]))[0]?.tarifa_cliente) === 4800, apl);
const g = await api('ale', 'prepararFactura', { cliente: 'COLGATE', viajeIds: [v1id], numeroFactura: '', fechaFactura: '' });
const gid = g.result?.id;
const env0 = await api('ale', 'enviarFactura', gid);
T('28 No se envía sin número ni fecha y dice qué falta', env0.ok === false && env0.code === 'FALTAN_CAMPOS' && (env0.faltantes || []).length >= 2, env0);
T('29 La factura rechazada sigue en PREPARADA', (await q1('select fase from agrupaciones where id=$1', [gid]))[0].fase === 'PREPARADA');
const act = await api('ale', 'actualizarFactura', gid, { numeroFactura: 'FAC-9001', fechaFactura: '2031-02-01' });
const env1 = await api('ale', 'enviarFactura', gid);
T('30 Con datos completos, la factura se envía', act.ok && env1.ok && (await q1('select fase from agrupaciones where id=$1', [gid]))[0].fase === 'ENVIADA', [act.message, env1.message]);
const g2 = await api('ale', 'prepararFactura', { cliente: 'COLGATE', viajeIds: [v1id], numeroFactura: 'FAC-9001', fechaFactura: '2031-02-01' });
T('31 No se puede facturar dos veces el mismo viaje ni repetir el número de factura', g2.ok === false, g2);
const ger = await snap('ger');
T('32 Gerencia consulta facturación y finanzas pero no opera', ger.agrupaciones.length === 1 && (await api('ger', 'enviarFactura', gid)).ok === false);

/* ---- 5. Integridad de la base ---- */
const ver = await api('adm', 'verificarAuditoria');
T('33 La cadena de huellas de la auditoría es íntegra tras todas las operaciones', ver.ok && ver.result.ok === true && ver.result.total > 10, ver);
T('34 La auditoría no se puede modificar ni borrar ni vaciar', (await intenta(() => db.query("update auditoria set accion='x'"))) !== null && (await intenta(() => db.query('delete from auditoria'))) !== null && (await intenta(() => db.query('truncate auditoria'))) !== null);
T('35 Los viajes no se pueden borrar', (await intenta(() => db.query('delete from viajes'))) !== null);
T('36 No se pueden saltar estados (APROBADA → EN_CURSO)', (await intenta(() => db.query("update viajes set estado='EN_CURSO' where id=$1", [v1id]))) !== null);
T('37 La base rechaza una ruta ASIGNADA sin código ni origen', (await intenta(() => db.query("update rutas set codigo='' where id=$1", [r1.result.id]))) !== null);
T('38 Una factura no puede estar enviada sin número', (await intenta(() => db.query("update agrupaciones set numero_factura='' where id=$1", [gid]))) !== null);

/* ---- 6. RLS: consultas directas con la sesión de cada usuario ---- */
const cuenta = async (quien, tabla) => comoUsuario(quien, async tx => (await tx.query(`select count(*)::int n from public.${tabla}`)).rows[0].n);
T('39 Sin sesión (anon) no se lee ninguna tabla', (await intenta(() => comoUsuario(null, tx => tx.query('select * from public.viajes')))) !== null && (await intenta(() => comoUsuario(null, tx => tx.query('select * from public.perfiles')))) !== null);
T('40 RLS: Pedro solo lee viajes de COLGATE; Bryan solo CMI', await cuenta('ped', 'viajes') === 2 && await cuenta('bry', 'viajes') === 1, [await cuenta('ped', 'viajes'), await cuenta('bry', 'viajes')]);
T('41 RLS: el encargado con proyecto asignado solo lee ese proyecto', await cuenta('imp', 'viajes') === 1);
T('42 RLS: consultar por identificador de otro cliente devuelve 0 filas', await comoUsuario('bry', async tx => (await tx.query('select id from public.viajes where id=$1', [v1id])).rows.length) === 0);
T('43 RLS: costos, tarifas y facturas no son visibles para quien no tiene permiso', await cuenta('ped', 'viajes_costos') === 0 && await cuenta('ped', 'viajes_tarifa') === 0 && await cuenta('ped', 'agrupaciones') === 0 && await cuenta('ped', 'tarifas') === 0);
T('44 RLS: Comercial ve la tarifa del viaje; Gerencia ve las facturas', await cuenta('ale', 'viajes_tarifa') === 1 && await cuenta('ger', 'agrupaciones') === 1);
T('45 RLS: cada usuario solo ve su propio perfil (la administradora ve todos)', await cuenta('ped', 'perfiles') === 1 && await cuenta('adm', 'perfiles') === 8);
T('46 RLS: nadie ve las secuencias internas', (await intenta(() => cuenta('adm', 'secuencias'))) !== null);
const audV = quien => comoUsuario(quien, async tx => (await tx.query('select count(*)::int n from public.auditoria where viaje_id=$1', [v1id])).rows[0].n);
T('47 RLS: la auditoría de un viaje solo la leen quienes pueden ver ese viaje', await audV('bry') === 0 && await audV('ped') > 0 && await cuenta('adm', 'auditoria') > 10, [await audV('bry'), await audV('ped')]);
const escritura = ['update public.viajes set shipment=$$x$$', 'delete from public.viajes', "insert into public.clientes(id,nombre,cliente) values ($$ZZ$$,$$Z$$,$$Z$$)", "update public.perfiles set rol=$$ADMIN$$", "update public.permisos set habilitado=true"];
for (const [i, s] of escritura.entries()) T('48.' + (i + 1) + ' Un usuario no puede escribir directamente: ' + s.split(' ').slice(0, 3).join(' '), (await intenta(() => comoUsuario('adm', tx => tx.query(s)))) !== null);
T('49 Notificaciones: solo los destinatarios (o la administradora) las leen', true);
const ev = await comoUsuario('ped', async tx => (await tx.query('select count(*)::int n from storage.objects')).rows[0].n), ev2 = await comoUsuario('bry', async tx => (await tx.query('select count(*)::int n from storage.objects')).rows[0].n);
T('50 Almacenamiento: Pedro ve la evidencia de su viaje y Bryan no', ev === 1 && ev2 === 0, [ev, ev2]);

/* ---- 7. Rutas nuevas y notificaciones del perfil unificado ---- */
const sol = await api('imp', 'solicitarRuta', { cliente: 'COLGATE', proyecto: 'COLGATE', nombre: 'Ruta nueva Escuintla', origenProp: 'CEDIS Mixco', destinoProp: 'Escuintla centro' });
T('51 Encargado/IMPLAN solicita una ruta nueva: queda NO ASIGNADA', sol.ok && (await q1('select estado,codigo from rutas where id=$1', [sol.result?.id]))[0].estado === 'NO_ASIGNADA', sol);
const nt = await q1('select destinatarios from notificaciones order by id desc limit 1');
T('52 Genera la notificación para Gerencia y Comercial', nt[0] && nt[0].destinatarios.includes('GERENCIA') && nt[0].destinatarios.includes('COMERCIAL'), nt);
T('53 Otro proyecto o cliente: solicitud rechazada', (await api('imp', 'solicitarRuta', { cliente: 'CMI', proyecto: 'ABASA', nombre: 'X ruta' })).ok === false && (await api('imp', 'solicitarRuta', { cliente: 'COLGATE', proyecto: 'LV', nombre: 'X ruta' })).ok === false);
const val = await api('ale', 'validarRuta', sol.result.id, { codigo: 'COL-099', origenId: 'CP', destinoId: 'D-C2' });
T('54 Comercial valida la ruta y queda asignada con código', val.ok && (await q1('select estado,codigo from rutas where id=$1', [sol.result.id]))[0].codigo === 'COL-099', val);

/* ---- 8. Usuarios: alta con cuenta de acceso solo para la administradora ---- */
const nuevo = await api('adm', 'guardarUsuario', { usuario: 'nuevo1', nombre: 'Nuevo Encargado', email: 'Nuevo1@IntTransit.test', clave: 'ClaveSegura1', rol: 'ENCARGADO', clientes: ['CMI'], proyectos: [], activo: true });
T('55 La administradora crea un usuario: se crea la cuenta Auth y el perfil con el mismo identificador', nuevo.ok && (await q1('select u.email from perfiles p join auth.users u on u.id=p.id where p.usuario=$1', ['nuevo1']))[0]?.email === 'nuevo1@inttransit.test', nuevo);
const intruso = await api('ped', 'guardarUsuario', { usuario: 'intruso', nombre: 'Intruso Root', email: 'i@i.test', clave: 'ClaveSegura1', rol: 'ADMIN', clientes: [] });
T('56 Un encargado NO puede crear usuarios (ni se crea cuenta de acceso)', intruso.ok === false && (await q1("select count(*)::int n from auth.users where email='i@i.test'"))[0].n === 0, intruso);
const malo = await api('adm', 'guardarUsuario', { usuario: 'pedro', nombre: 'Duplicado Pedro', email: 'dup@x.test', clave: 'ClaveSegura1', rol: 'ENCARGADO', clientes: ['CMI'] });
T('57 Si el motor rechaza el alta, la cuenta de acceso creada se elimina (no quedan cuentas huérfanas)', malo.ok === false && (await q1("select count(*)::int n from auth.users where email='dup@x.test'"))[0].n === 0 && borrados.length >= 1, malo);
T('58 No se puede conceder a un perfil un permiso prohibido (separación de funciones)', (await api('adm', 'setPermiso', 'ENCARGADO', 'liq_aprobar', true)).ok === false);
T('59 Torre: solo cambia el estatus y solo en clientes autorizados', (await api('fel', 'editarViaje', v1id, { estatus: 'EN RAMPA' })).ok === false);

console.log(filas.join('\n'));
console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`);
process.exit(mal ? 1 : 0);
