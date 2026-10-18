/* Pruebas (Postgres real con PGlite, scripts SQL del repositorio sin cambios): etiquetas «Ingreso a planta/bodega» y Torre de Control sin acceso a importes. */
import { PGlite } from "@electric-sql/pglite";
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ejecutar } from '../supabase/functions/api/handler.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlDe = f => fs.readFileSync(path.join(raíz, 'supabase/migrations', f), 'utf8');

/* Migraciones en orden. El 005 es un ejemplo (se ejecuta a mano) y no entra aquí. */
const MIGRACIONES = ['001_esquema.sql', '002_seguridad_rls.sql', '003_almacenamiento.sql', '004_permisos_base.sql',
  '006_flota_fleetio.sql', '007_flujo_operativo.sql', '008_contabilidad.sql', '016_ordenes_pago.sql', '017_corregir_estados_rls.sql', '017_roles_departamentos.sql', '018_rol_proyectos.sql', '019_catalogos.sql', '020_arrastres.sql'];

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
await mk('gco', 'gcomercial', 'Gerencia Comercial', 'GERENTE_COMERCIAL');
await mk('gtr', 'gtransporte', 'Gerencia Transporte', 'GERENTE_TRANSPORTE');
await mk('fel', 'felipe', 'Felipe Torre', 'TORRE');
await mk('cta', 'conta', 'Contabilidad', 'COBROS');
await db.query(`insert into master.acceso_cliente(user_id,cliente_id) values ($1,'COLGATE'),($2,'CMI'),($3,'COLGATE')`, [U.ped, U.bry, U.imp]);
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

/* ---- datos adicionales para estas pruebas ---- */
await db.exec(`insert into master.flota(unidad,placa,tango,capacidad,tipo) values ('T-4','C-004DDD','TNG-4','10 Ton','10TON'),('T-5','C-005EEE','TNG-5','10 Ton','10TON');
  insert into master.pilotos(id,nombre,unidad,cliente_id) values ('P-4','Piloto Cuatro','T-4','COCACOLA'),('P-5','Piloto Cinco','T-5','COLGATE');
  insert into master.destinos(id,nombre,cliente_id) values ('D-K1','Distribuidora Coca-Cola','COCACOLA');`);
const snap = async quien => (await api(quien, 'snapshot')).snapshot;
const trip = async (quien, id) => (await snap(quien)).trips.find(t => t.id === id);

/* ---- rutas activas (con tarifa y aprobación de ambas gerencias), como en el flujo real ---- */
const r1 = await api('adm', 'registrarRuta', { codigo: 'COL-001', nombre: 'CP → Colgate 1', cliente: 'COLGATE', proyecto: 'COLGATE', origenId: 'CP', destinoId: 'D-C1' });
const r2 = await api('adm', 'registrarRuta', { codigo: 'COCA-001', nombre: 'CP → Coca-Cola 1', cliente: 'COCACOLA', proyecto: 'COCACOLA', origenId: 'CP', destinoId: 'D-K1' });
for (const [r, cli, pr] of [[r1, 'COLGATE', 'COLGATE'], [r2, 'COCACOLA', 'COCACOLA']]) {
  await api('ale', 'crearTarifa', { cliente: cli, proyecto: pr, rutaId: r.result.id, capacidad: '10 Ton', importe: 4800, importeOpl: 3000, vigenteDesde: '2030-01-01' });
  await api('gco', 'aprobarRutaComercial', r.result.id); await api('gtr', 'aprobarRutaTransporte', r.result.id);
}
T('00 Preparación: las dos rutas quedan Activas', (await q1("select count(*)::int n from rutas where estado='ACTIVA'"))[0].n === 2);

const T10 = { tIngresoPlanta: '2031-01-01T08:10', tEsperaRampa: '2031-01-01T08:20', tRampa: '2031-01-01T08:30', tInicioCarga: '2031-01-01T08:40', tFinCarga: '2031-01-01T09:00', tSalidaPlanta: '2031-01-01T09:05', tSalida: '2031-01-01T09:10', tIngresoBodega: '2031-01-01T13:00', tInicioDescarga: '2031-01-01T13:10', tFinDescarga: '2031-01-01T13:40' };
const viaje = (extra = {}) => ({ cliente: 'COLGATE', pilotoId: 'P-1', rutaId: r1.result.id, fechaPlan: '2031-01-01T08:00', shipment: 'S-1', opl: 'J&J', tipoViaje: 'ONE WAY', tipoCarga: 'TARIMAS', noCarga: '1', producto: 'Producto de prueba', placaArrastre: 'C-ARR-001', ...T10, ...extra });
/* viaje de Torre (cliente autorizado) con UN solo horario: faltan los demás */
const vk = await api('adm', 'crearViaje', viaje({ cliente: 'COCACOLA', pilotoId: 'P-4', rutaId: r2.result.id, shipment: 'K-1', fechaPlan: '2031-02-01T08:00', ...Object.fromEntries(Object.keys(T10).map(k => [k, ''])), tIngresoPlanta: '2031-02-01T08:10' }));
const vc = await api('adm', 'crearViaje', viaje({ pilotoId: 'P-3', shipment: 'S-9', fechaPlan: '2031-02-09T08:00', ...Object.fromEntries(Object.keys(T10).map(k => [k, ''])) }));
T('01 Se crean un viaje de Coca-Cola (cliente autorizado para Torre, con un solo horario) y uno de Colgate (no autorizado)', vk.ok && vc.ok, [vk.message, vc.message]);
const vkid = vk.result?.id, vcid = vc.result?.id;

/* ---- importes reales del viaje de Coca-Cola (tablas separadas de la base: viajes_tarifa, viajes_costos, viajes_viaticos) ---- */
await db.query(`insert into master.viajes_tarifa(viaje_id,tarifa_cliente,tarifa_opl) values ($1,4800.55,3100.25) on conflict (viaje_id) do update set tarifa_cliente=4800.55, tarifa_opl=3100.25`, [vkid]);
await db.query(`insert into master.viajes_costos(viaje_id,costo_proveedor) values ($1,2900.10) on conflict (viaje_id) do update set costo_proveedor=2900.10`, [vkid]);
await db.query(`insert into master.viajes_viaticos(viaje_id,q_viaticos) values ($1,350.75) on conflict (viaje_id) do update set q_viaticos=350.75`, [vkid]);
const montos = (await q1(`select (select tarifa_cliente from master.viajes_tarifa where viaje_id=$1)::float a, (select costo_proveedor from master.viajes_costos where viaje_id=$1)::float b, (select q_viaticos from master.viajes_viaticos where viaje_id=$1)::float c`, [vkid]))[0];
T('M0 Preparación: el viaje tiene tarifa, costo y viáticos guardados en la base', montos.a === 4800.55 && montos.b === 2900.1 && montos.c === 350.75, montos);

const CLAVES = ['tarifaCliente', 'tarifaId', 'tarifaOpl', 'tarifaOplBase', 'ajusteOpl', 'precioMemOpl', 'tarifaBase', 'ajusteCombustible', 'precioMem', 'costoProveedor', 'qViaticos'];
const NUMS = ['4800.55', '3100.25', '2900.1', '350.75'];
const tieneDinero = txt => NUMS.some(n => txt.includes(n)) || CLAVES.some(k => txt.includes('"' + k + '"') && !new RegExp('"' + k + '":(""|null)').test(txt));

/* ===== Torre ===== */
const sTorre = (await api('fel', 'snapshot')).snapshot;
const tT = sTorre.trips.find(t => t.id === vkid);
T('M1 Torre sigue viendo el viaje y sus datos operativos (cliente, proyecto, horarios, estado)', tT && tT.estado === 'PLANIFICADO' && tT.tIngresoPlanta === '2031-02-01T08:10' && tT.proyectoCat === 'COCACOLA', tT && tT.id);
T('M2 El viaje que recibe Torre NO trae tarifa del cliente, tarifa OPL, costo ni viáticos', CLAVES.every(k => !(k in tT)) , CLAVES.filter(k => k in tT));
T('M3 Ningún importe aparece en todo lo que el servidor le envía a Torre (ni como número ni en textos)', !tieneDinero(JSON.stringify(sTorre)), 'hay importes');
T('M4 Torre recibe vacías las tablas de tarifas, memoria, facturas, pagos y órdenes de pago', [sTorre.tarifas, sTorre.mem, sTorre.agrupaciones, sTorre.pagos, sTorre.ordenesPago].every(a => Array.isArray(a) && a.length === 0), [sTorre.tarifas.length, sTorre.agrupaciones.length, sTorre.pagos.length]);
for (const [op, args] of [['tarifas', []], ['mem', []], ['agrupaciones', []], ['resumenFinanciero', [{}]], ['viajesPorPagar', []], ['pagosDeViaje', [vkid]], ['ordenesPago', []], ['gastos', [{}]], ['mantenimientos', [{}]], ['actividad', [20]], ['auditoria', []]]) {
  const r = await api('fel', op, ...args);
  T(`M5 Torre no puede consultar «${op}» (se rechaza sin devolver datos)`, r.ok === false && !tieneDinero(JSON.stringify(r)), r.code || JSON.stringify(r).slice(0, 120));
}
const mover = await api('fel', 'torreMoverEstado', vkid, 'EN_RUTA');
T('M6 La respuesta de «cambiar estatus» tampoco contiene importes', mover.ok && !tieneDinero(JSON.stringify(mover)) && mover.result && mover.result.estado === 'EN_RUTA', JSON.stringify(mover).slice(0, 200));
const ed = await api('fel', 'torreEditarHorarios', vkid, { tSalida: '2031-02-01T09:10' });
T('M7 Guardar horarios sigue funcionando y no devuelve importes', ed.ok && !tieneDinero(JSON.stringify(ed)) && (await trip('adm', vkid)).tSalida === '2031-02-01T09:10', ed);
const mon = (await q1(`select (select tarifa_cliente from master.viajes_tarifa where viaje_id=$1)::float a, (select costo_proveedor from master.viajes_costos where viaje_id=$1)::float b, (select q_viaticos from master.viajes_viaticos where viaje_id=$1)::float c`, [vkid]))[0];
T('M8 Los importes guardados en la base no se tocaron', mon.a === 4800.55 && mon.b === 2900.1 && mon.c === 350.75, mon);
/* intentar editar importes desde Torre */
const hack = await api('fel', 'torreEditarHorarios', vkid, { tarifaCliente: 1, costoProveedor: 1, qViaticos: 1 });
const hack2 = await api('fel', 'registrarImportes', { [vkid]: { costoProveedor: 1 } });
T('M9 Torre no puede escribir importes por ninguna vía', !hack.ok && !hack2.ok && (await q1(`select costo_proveedor::float c from master.viajes_costos where viaje_id=$1`, [vkid]))[0].c === 2900.1, [hack.code, hack2.code]);
/* aunque la administradora le habilite permisos de dinero a Torre desde la matriz, el servidor se los niega */
const comoAdm = [];
for (const p of ['finanzas_ver', 'tarifas_ver', 'comercial_ver', 'tarifas_opl_ver', 'tablero_ver', 'catalogos_ver']) comoAdm.push(await api('adm', 'setPermiso', 'TORRE', p, true));
const sT2 = (await api('fel', 'snapshot')).snapshot;
T('M10 Aunque se intente habilitar permisos de dinero a Torre desde la matriz, sigue sin recibir importes', !tieneDinero(JSON.stringify(sT2)) && sT2.tarifas.length === 0 && sT2.agrupaciones.length === 0 && sT2.pagos.length === 0, comoAdm.map(x => x.ok));
for (const p of ['finanzas_ver', 'tarifas_ver', 'comercial_ver', 'tarifas_opl_ver', 'tablero_ver', 'catalogos_ver']) await api('adm', 'setPermiso', 'TORRE', p, false);

/* ===== Administrador y Gerencia siguen viéndolos ===== */
const sAdm = (await api('adm', 'snapshot')).snapshot, tA = sAdm.trips.find(t => t.id === vkid);
T('M11 La administradora ve tarifa, costo y viáticos como hasta ahora', tA.tarifaCliente === 4800.55 && tA.tarifaOpl === 3100.25 && tA.costoProveedor === 2900.1 && tA.qViaticos === 350.75, [tA.tarifaCliente, tA.costoProveedor, tA.qViaticos]);
const tG = (await api('gco', 'snapshot')).snapshot.trips.find(t => t.id === vkid);
T('M12 Gerencia Comercial sigue viendo la tarifa del cliente (su permiso no cambió)', tG && tG.tarifaCliente === 4800.55 && !('costoProveedor' in tG), tG && tG.tarifaCliente);
const tGt = (await api('gtr', 'snapshot')).snapshot.trips.find(t => t.id === vkid);
T('M13 Gerencia de Transporte conserva exactamente lo que veía antes (tarifa del cliente, sin costos)', tGt && tGt.tarifaCliente === 4800.55 && !('costoProveedor' in tGt), tGt && Object.keys(tGt).filter(k => CLAVES.includes(k)));

/* ===== Etiquetas ===== */
const ev = await api('adm', 'editarViaje', vkid, { tIngresoPlanta: '2031-02-01T08:50' });
const au = (await snap('adm')).audit.filter(a => a.viajeId === vkid && /Ingreso a planta/.test(a.campo));
T('M15 Las horas se siguen guardando con el mismo campo; la bitácora usa el nombre «Ingreso a planta»', ev.ok && (await trip('adm', vkid)).tIngresoPlanta === '2031-02-01T08:50' && au.some(a => a.campo === 'Ingreso a planta'), [ev.code, au.map(a => a.campo)]);
const nm = await api('adm', 'verificarAuditoria');
T('M16 La cadena de auditoría sigue íntegra', nm.ok && (nm.resultado ? nm.resultado.ok !== false : true), nm);

console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
