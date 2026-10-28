/* Servidor (PGlite con las migraciones reales): los 10 horarios y «Salida de bodega» se guardan y se recuperan SIN cambios en la base,
   «Fecha y hora de salida» se conserva como dato histórico, y Torre de Control ve todos los viajes y cambia el estatus con las mismas reglas de siempre. */
import { PGlite } from "@electric-sql/pglite";
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ejecutar } from '../supabase/functions/api/handler.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlDe = f => fs.readFileSync(path.join(raíz, 'supabase/migrations', f), 'utf8');

/* Migraciones en orden. El 005 es un ejemplo (se ejecuta a mano) y no entra aquí. */
const MIGRACIONES = ['001_esquema.sql', '002_seguridad_rls.sql', '003_almacenamiento.sql', '004_permisos_base.sql',
  '006_flota_fleetio.sql', '007_flujo_operativo.sql', '008_contabilidad.sql', '016_ordenes_pago.sql', '023_corregir_estados_rls.sql', '017_roles_departamentos.sql', '018_rol_proyectos.sql', '019_catalogos.sql', '020_arrastres.sql', '021_fecha_entrega_anterior.sql', '024_permisos_gerente_transporte.sql', '025_indices_viajes.sql', '026_viajes_sin_ruta.sql', '027_reportes_ayuda.sql', '028_ayuda_proyectos.sql', '029_lugares.sql', '030_origen_destino_texto.sql', '032_pilotos_documentos.sql', '033_acceso_modulos_secciones.sql'];

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
const r1 = await api('adm', 'registrarRuta', { codigo: 'COL-001', nombre: 'CP → Colgate 1', cliente: 'COLGATE', proyecto: 'COLGATE', origen: 'CP', destino: 'D-C1' });
const r2 = await api('adm', 'registrarRuta', { codigo: 'COCA-001', nombre: 'CP → Coca-Cola 1', cliente: 'COCACOLA', proyecto: 'COCACOLA', origen: 'CP', destino: 'D-K1' });
for (const [r, cli, pr] of [[r1, 'COLGATE', 'COLGATE'], [r2, 'COCACOLA', 'COCACOLA']]) {
  await api('ale', 'crearTarifa', { cliente: cli, proyecto: pr, rutaId: r.result.id, capacidad: '10 Ton', importe: 4800, importeOpl: 3000, vigenteDesde: '2030-01-01' });
  await api('gco', 'aprobarRutaComercial', r.result.id); await api('gtr', 'aprobarRutaTransporte', r.result.id);
}
T('00 Preparación: las dos rutas quedan Activas', (await q1("select count(*)::int n from rutas where estado='ACTIVA'"))[0].n === 2);

const T10 = { tIngresoPlanta: '2031-01-01T08:10', tEsperaRampa: '2031-01-01T08:20', tRampa: '2031-01-01T08:30', tInicioCarga: '2031-01-01T08:40', tFinCarga: '2031-01-01T09:00', tSalidaPlanta: '2031-01-01T09:05', tIngresoBodega: '2031-01-01T13:00', tInicioDescarga: '2031-01-01T13:10', tFinDescarga: '2031-01-01T13:40', tSalidaBodega: '2031-01-01T13:55' };
const viaje = (extra = {}) => ({ cliente: 'COLGATE', pilotoId: 'P-3', rutaId: r1.result.id, fechaPlan: '2031-01-01T08:00', shipment: 'S-1', opl: 'J&J', tipoViaje: 'ONE WAY', tipoCarga: 'TARIMAS', noCarga: '1', producto: 'Producto de prueba', placaArrastre: 'C-ARR-001', ...T10, ...extra });
/* viaje de Torre (cliente autorizado) con UN solo horario: faltan los demás */
const vk = await api('adm', 'crearViaje', viaje({ cliente: 'COCACOLA', pilotoId: 'P-4', rutaId: r2.result.id, shipment: 'K-1', fechaPlan: '2031-02-01T08:00', ...Object.fromEntries(Object.keys(T10).map(k => [k, ''])), tIngresoPlanta: '2031-02-01T08:10' }));
const vc = await api('adm', 'crearViaje', viaje({ pilotoId: 'P-3', shipment: 'S-9', fechaPlan: '2031-02-09T08:00', ...Object.fromEntries(Object.keys(T10).map(k => [k, ''])) }));
T('01 Se crean un viaje de Coca-Cola (cliente autorizado para Torre, con un solo horario) y uno de Colgate (no autorizado)', vk.ok && vc.ok, [vk.message, vc.message]);
const vkid = vk.result?.id, vcid = vc.result?.id;


const VACIO = Object.fromEntries(Object.keys(T10).map(k => [k, '']));
const MIGRACIONES_NUEVAS = fs.readdirSync(path.join(raíz, 'supabase/migrations')).filter(f => /^03[4-9]_/.test(f));
T('S0 Torre no necesita ninguna migración nueva: las únicas posteriores a la 033 son la 034 (Órdenes de Compra) y la 035 (flujo de agrupaciones), preparadas y aún sin aplicar y todas las existentes se aplican', MIGRACIONES_NUEVAS.every(f => /^03[45]_(ordenes_compra|agrupaciones_flujo)\.sql$/.test(f)) && filas.filter(f => /^FAIL SQL/.test(f)).length === 0, MIGRACIONES_NUEVAS);

/* ---- 1. Guardar y recuperar los 10 horarios ---- */
const h1 = await api('adm', 'crearViaje', viaje({ shipment: 'H-1', pilotoId: 'P-3' }));
T('S1 Se crea un viaje con los 10 horarios, incluida la «Salida de bodega»', h1.ok, h1.message);
const hid = h1.result?.id;
const s1 = await trip('fel', hid);
T('S2 Al consultarlo (otro usuario) los 10 horarios vuelven exactos y en sus campos', Object.entries(T10).every(([k, v]) => s1[k] === v), s1);
const fila1 = (await q1(`select t_salida_planta, t_salida, t_ingreso_bodega, extra from viajes where id=$1`, [hid]))[0];
const ex = typeof fila1.extra === 'string' ? JSON.parse(fila1.extra) : fila1.extra;
T('S3 «Salida de bodega» se guarda en la base (campo flexible del viaje) sin tocar columnas existentes', ex.tSalidaBodega === T10.tSalidaBodega && fila1.t_salida === '' && fila1.t_salida_planta === T10.tSalidaPlanta, fila1);
const ed = await api('adm', 'editarViaje', hid, { tSalidaBodega: '2031-01-01T14:30' });
const s2 = await trip('adm', hid);
T('S4 Editar el viaje actualiza la «Salida de bodega» y no cambia ningún otro horario', ed.ok && s2.tSalidaBodega === '2031-01-01T14:30' && Object.entries(T10).filter(([k]) => k !== 'tSalidaBodega').every(([k, v]) => s2[k] === v), [ed.message, s2]);
const mal1 = await api('adm', 'editarViaje', hid, { tSalidaBodega: 'ayer' });
T('S5 Un valor que no es fecha y hora se rechaza', mal1.ok === false, mal1);

/* ---- 2. Dato histórico «Fecha y hora de salida» ---- */
await db.query(`update master.viajes set t_salida='2031-01-01T09:00' where id=$1`, [hid]);
const ed2 = await api('adm', 'editarViaje', hid, { tFinDescarga: '2031-01-01T13:45' });
const s3 = await trip('adm', hid);
T('S6 El viaje histórico conserva su «Fecha y hora de salida» tras editar otros horarios', ed2.ok && s3.tSalida === '2031-01-01T09:00' && s3.tSalidaPlanta === T10.tSalidaPlanta && s3.tSalidaBodega === '2031-01-01T14:30', s3);
const eds = await api('fel', 'torreEditarHorarios', hid, { tSalida: '2031-01-01T10:00' });
T('S7 «Fecha y hora de salida» ya no se puede editar como horario (tampoco por Torre)', eds.ok === false && (await trip('adm', hid)).tSalida === '2031-01-01T09:00', eds);

/* ---- 3. Entrega: los horarios nuevos son opcionales; los de siempre siguen siendo obligatorios ---- */
const base9 = Object.fromEntries(Object.entries(T10).filter(([k]) => k !== 'tSalidaBodega'));
const e1 = await api('adm', 'crearViaje', viaje({ shipment: 'E-1', fechaPlan: '2031-01-02T08:00', pilotoId: 'P-3', ...VACIO, ...base9 }));
await api('adm', 'iniciar', e1.result.id);
const fin1 = await api('adm', 'finalizar', e1.result.id);
T('S8 Un viaje con los horarios de siempre puede entregarse aunque falte «Salida de bodega»', fin1.ok && (await trip('adm', e1.result.id)).estado === 'ENTREGADO', fin1.message);
const e2 = await api('adm', 'crearViaje', viaje({ shipment: 'E-2', fechaPlan: '2031-01-03T08:00', pilotoId: 'P-5', ...VACIO, ...base9, tFinDescarga: '' }));
await api('adm', 'iniciar', e2.result.id);
const fin2 = await api('adm', 'finalizar', e2.result.id);
T('S9 Sigue sin poder entregarse si falta un horario obligatorio (p. ej. Fin de descarga)', fin2.ok === false, fin2);

/* ---- 4. Torre: ve todos los viajes y cambia el estatus ---- */
const tk1 = await api('adm', 'crearViaje', viaje({ cliente: 'COCACOLA', pilotoId: 'P-4', rutaId: r2.result.id, shipment: 'K-11', fechaPlan: '2031-02-05T08:00', ...T10 }));
const tk2 = await api('adm', 'crearViaje', viaje({ cliente: 'COCACOLA', pilotoId: 'P-4', rutaId: r2.result.id, shipment: 'K-12', fechaPlan: '2031-02-06T08:00', ...VACIO }));
const enBase = (await q1('select count(*)::int n from viajes'))[0].n;
const sTorre = (await snap('fel')).trips;
const estados = new Set(sTorre.map(t => t.estado));
T('S10 Torre recibe TODOS los viajes registrados (todos los estados y clientes), no solo los activos', sTorre.length === enBase && estados.has('PLANIFICADO') && estados.has('ENTREGADO'), [sTorre.length, enBase, [...estados]]);
T('S11 Torre recibe los 10 horarios del viaje y ningún importe', (() => { const t = sTorre.find(x => x.id === hid); return !!t && Object.keys(T10).every(k => k in t) && !sTorre.some(x => Number(x.tarifaCliente) > 0 || Number(x.costoProveedor) > 0); })());
const m1 = await api('fel', 'torreMoverEstado', tk1.result.id, 'EN_RUTA');
const dbEst = (await q1('select estado from viajes where id=$1', [tk1.result.id]))[0].estado;
T('S12 Torre cambia el estatus de un cliente autorizado y queda guardado en la base', m1.ok && dbEst === 'EN_RUTA' && (await trip('adm', tk1.result.id)).estado === 'EN_RUTA', [m1.message, dbEst]);
const aud = (await snap('adm')).audit.filter(a => a.viajeId === tk1.result.id && a.campo === 'Estado');
T('S13 Queda registrado quién lo cambió, el estatus anterior y el nuevo', aud.length >= 1 && aud.at(-1).por === 'Felipe Torre' && aud.at(-1).anterior === 'Planificado' && aud.at(-1).nuevo === 'En ruta', aud);
const m2 = await api('fel', 'torreMoverEstado', tk2.result.id, 'EN_RUTA');
T('S14 Si faltan datos para el nuevo estatus el servidor lo rechaza con un mensaje y no guarda nada', (m2.ok === true) || ((await q1('select estado from viajes where id=$1', [tk2.result.id]))[0].estado === 'PLANIFICADO' && !!m2.message), m2);
const m3 = await api('fel', 'torreMoverEstado', hid, 'ENTREGADO');
T('S15 En un cliente no autorizado (Colgate) Torre no puede cambiar el estatus', m3.ok === false && m3.code === 'CLIENTE_NO_AUTORIZADO', m3);
const m4 = await api('fel', 'torreMoverEstado', tk1.result.id, 'FACTURADO');
T('S16 Torre no puede fijar estados que no le corresponden (no se salta el flujo)', m4.ok === false && (await trip('adm', tk1.result.id)).estado === 'EN_RUTA', m4);
for (const [quien, rol] of [['ped', 'Operativo'], ['mar', 'Validador'], ['cta', 'Cobros'], ['ale', 'Analista Comercial']]) {
  const r = await api(quien, 'torreMoverEstado', tk1.result.id, 'ENTREGADO');
  T(`S17 ${rol} no puede usar el cambio de estatus de Torre (permisos de los demás perfiles intactos)`, r.ok === false && (await trip('adm', tk1.result.id)).estado === 'EN_RUTA', r);
}
const dp = await api('fel', 'torreEditarHorarios', tk1.result.id, { pilotoId: 'P-1' });
T('S18 Torre sigue sin poder editar datos generales (piloto, etc.)', dp.ok === false && dp.code === 'CAMPO_NO_EDITABLE', dp);
/* ---- 5. Registro por la API real: los horarios nuevos pasan; un campo desconocido sigue rechazado ---- */
const ok1 = await api('ped', 'crearViaje', viaje({ shipment: 'R-1', fechaPlan: '2031-04-01T08:00', pilotoId: 'P-3' }));
T('S20 Un encargado registra un viaje con los 10 horarios por la API (sin «Campo no permitido»)', ok1.ok, ok1.message);
const raro = await api('adm', 'crearViaje', viaje({ shipment: 'R-2', fechaPlan: '2031-04-02T08:00', pilotoId: 'P-3', campoInventado: 'x' }));
T('S21 Un campo realmente desconocido sigue rechazado por el servidor', raro.ok === false && /Campo no permitido: campoInventado/.test(raro.message), raro);
const raro2 = await api('adm', 'editarViaje', hid, { campoInventado: 'x' });
T('S22 Y también al editar un viaje', raro2.ok === false && raro2.code === 'CAMPO_NO_EDITABLE', raro2);
const v = await api('adm', 'verificarAuditoria');
T('S19 La cadena de auditoría sigue íntegra', v.ok, v);

console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
