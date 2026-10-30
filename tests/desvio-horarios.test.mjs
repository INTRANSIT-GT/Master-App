/* Pruebas (Postgres real con PGlite): horarios de descarga del desvío (guardado en Supabase, consulta, Torre de Control) y Referencia interna eliminada del formulario. */
import { PGlite } from "@electric-sql/pglite";
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ejecutar } from '../supabase/functions/api/handler.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlDe = f => fs.readFileSync(path.join(raíz, 'supabase/migrations', f), 'utf8');

/* Migraciones en orden. El 005 es un ejemplo (se ejecuta a mano) y no entra aquí. */
const MIGRACIONES = ['001_esquema.sql', '002_seguridad_rls.sql', '003_almacenamiento.sql', '004_permisos_base.sql',
  '006_flota_fleetio.sql', '007_flujo_operativo.sql', '008_contabilidad.sql', '016_ordenes_pago.sql', '023_corregir_estados_rls.sql', '017_roles_departamentos.sql', '018_rol_proyectos.sql', '019_catalogos.sql', '020_arrastres.sql', '021_fecha_entrega_anterior.sql', '024_permisos_gerente_transporte.sql', '025_indices_viajes.sql', '026_viajes_sin_ruta.sql', '027_reportes_ayuda.sql', '028_ayuda_proyectos.sql', '041_ruta_capacidad_km.sql'];

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
await mk('adm2', 'admin2', 'Segundo Administrador', 'ADMIN');
await mk('pr1', 'proyectos1', 'Proyectos Uno', 'PROYECTOS');
await mk('pr2', 'proyectos2', 'Proyectos Dos', 'PROYECTOS');
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

const snap = async quien => (await api(quien, 'snapshot')).snapshot;
const trip = async (quien, id) => (await snap(quien)).trips.find(t => t.id === id);
const r1 = await api('adm', 'registrarRuta', { codigo: 'COL-001', nombre: 'CP → Colgate 1', cliente: 'COLGATE', proyecto: 'COLGATE', origenId: 'CP', destinoId: 'D-C1' });
await api('ale', 'crearTarifa', { cliente: 'COLGATE', proyecto: 'COLGATE', rutaId: r1.result.id, capacidad: '10 Ton', importe: 4800, importeOpl: 3000, vigenteDesde: '2030-01-01' });
await api('gco', 'aprobarRutaComercial', r1.result.id); await api('gtr', 'aprobarRutaTransporte', r1.result.id);

let nF = 0;
const base = (extra = {}) => ({ cliente: 'COLGATE', proyectoCat: 'COLGATE', pilotoId: 'P-1', fechaPlan: '2031-01-' + String(++nF).padStart(2, '0') + 'T08:00', shipment: 'S-1', opl: 'J&J', tipoViaje: 'ONE WAY', tipoCarga: 'TARIMAS', noCarga: '7', producto: 'Prod', placaArrastre: 'C-ARR-001', ...extra });
const notis = async () => (await q1(`select * from master.notificaciones where tipo='VIAJE_SIN_RUTA'`));
await db.exec(`insert into master.flota(unidad,placa,tango,capacidad,tipo) values ('T-4','C-004DDD','TNG-4','10 Ton','10TON');
  insert into master.pilotos(id,nombre,unidad,cliente_id) values ('P-4','Piloto Cuatro','T-4','COCACOLA');
  insert into master.destinos(id,nombre,cliente_id) values ('D-K1','Distribuidora Coca-Cola','COCACOLA'),('D-K2','Bodega Coca-Cola 2','COCACOLA');`);
const r2 = await api('adm', 'registrarRuta', { codigo: 'COCA-001', nombre: 'CP → Coca-Cola 1', cliente: 'COCACOLA', proyecto: 'COCACOLA', origenId: 'CP', destinoId: 'D-K1' });
await api('ale', 'crearTarifa', { cliente: 'COCACOLA', proyecto: 'COCACOLA', rutaId: r2.result.id, capacidad: '10 Ton', importe: 4800, importeOpl: 3000, vigenteDesde: '2030-01-01' });
await api('gco', 'aprobarRutaComercial', r2.result.id); await api('gtr', 'aprobarRutaTransporte', r2.result.id);
const nViajes = async () => (await q1(`select count(*)::int n from master.viajes`))[0].n;
const H = { tIngresoPlanta: '2031-03-01T08:10', tSalida: '2031-03-01T09:10', tIngresoBodega: '2031-03-01T13:00' };


const colum = async id => (await q1(`select extra from master.viajes where id=$1`, [id]))[0];
const DV = { dvIngresoBodega: '2031-04-02T15:00', dvInicioDescarga: '2031-04-02T15:20', dvFinDescarga: '2031-04-02T16:00' };

/* ===== 1. Viaje normal: sus horarios no cambian ===== */
const norm = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'N-1', fechaPlan: '2031-04-01T08:00', ...H }));
const tn = await trip('ped', norm.result.id);
T('H1 Un viaje normal se guarda con sus horarios de siempre', norm.ok && tn.tIngresoPlanta === H.tIngresoPlanta && tn.tSalida === H.tSalida && tn.tIngresoBodega === H.tIngresoBodega, norm.message);
T('H2 Un viaje normal no trae horarios ni datos de desvío', !tn.desvio && DVKEYS_NONE(tn));
function DVKEYS_NONE(t) { return !('dvIngresoBodega' in t) && !('dvInicioDescarga' in t) && !('dvFinDescarga' in t); }

/* ===== 2. Viaje con desvío y horarios de descarga ===== */
const n1 = await nViajes();
const dvv = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'D-1', fechaPlan: '2031-04-02T08:00', ...H, desvio: true, desvioDestinoId: 'D-C2', ...DV }));
const td = dvv.ok ? await trip('ped', dvv.result.id) : null;
T('H3 Con Desvío se guarda UN solo viaje con los horarios de descarga del desvío', dvv.ok && (await nViajes()) === n1 + 1 && td && td.dvIngresoBodega === DV.dvIngresoBodega && td.dvInicioDescarga === DV.dvInicioDescarga && td.dvFinDescarga === DV.dvFinDescarga, dvv.message);
T('H4 Los horarios normales del viaje se conservan y no se reemplazan', td && td.tIngresoPlanta === H.tIngresoPlanta && td.tSalida === H.tSalida && td.tIngresoBodega === H.tIngresoBodega && td.tInicioDescarga === '' && td.tFinDescarga === '');
T('H5 Quedan guardados en Supabase dentro del mismo viaje (viajes.extra), asociados a él', (await colum(dvv.result.id)).extra.dvFinDescarga === DV.dvFinDescarga && (await colum(dvv.result.id)).extra.desvioDestinoId === 'D-C2');
T('H6 Al volver a consultar el viaje (otro usuario autorizado) se muestran los horarios', (await trip('adm', dvv.result.id)).dvInicioDescarga === DV.dvInicioDescarga);
const parc = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'D-2', fechaPlan: '2031-04-03T08:00', desvio: true, desvioDestinoId: 'D-C1', dvFinDescarga: '2031-04-03T17:00' }));
T('H7 Los horarios del desvío son opcionales y pueden guardarse solo algunos', parc.ok && (await trip('ped', parc.result.id)).dvFinDescarga === '2031-04-03T17:00');
const sinH = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'D-3', fechaPlan: '2031-04-04T08:00', desvio: true, desvioDestinoId: 'D-C1' }));
T('H8 Desvío sin horarios adicionales se guarda igual que antes', sinH.ok && DVKEYS_NONE(await trip('ped', sinH.result.id)));

/* ===== 3. Validaciones ===== */
const n2 = await nViajes();
const a = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'X-1', fechaPlan: '2031-04-05T08:00', ...DV }));
T('H9 No se aceptan horarios de desvío si el viaje no tiene Desvío', !a.ok && /solo se registran cuando el viaje tiene Desv/.test(a.message), a.message);
const b = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'X-2', fechaPlan: '2031-04-06T08:00', desvio: true, desvioDestinoId: 'D-C2', dvInicioDescarga: 'mañana' }));
T('H10 Un horario de desvío con formato inválido se rechaza', !b.ok && /no v/.test(b.message), b.message);
const c = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'X-3', fechaPlan: '2031-04-07T08:00', desvio: true, desvioDestinoId: 'D-C2', dvInicioDescarga: '2031-04-07T16:00', dvFinDescarga: '2031-04-07T15:00' }));
T('H11 El fin de descarga del desvío no puede ser antes del inicio', !c.ok && /fin de descarga/.test(c.message), c.message);
const dd = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'X-4', fechaPlan: '2031-04-08T08:00', desvio: true, desvioDestinoId: '', ...DV }));
T('H12 El destino del desvío sigue siendo obligatorio', !dd.ok && /hacia d.nde fue el desv/i.test(dd.message), dd.message);
const e = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'X-5', fechaPlan: '2031-04-09T08:00', desvio: true, desvioDestinoId: 'D-C2', tSalidaPlanta: 'x' }));
T('H13 Los horarios normales siguen validándose igual', !e.ok);
T('H14 Ningún intento rechazado creó viajes', (await nViajes()) === n2);
const f = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'X-6', fechaPlan: '2031-04-10T08:00', dvFinDescarga: '', dvInicioDescarga: '' }));
T('H15 Campos de desvío vacíos en un viaje normal no estorban', f.ok && DVKEYS_NONE(await trip('ped', f.result.id)));

/* ===== 4. Torre de Control (COCACOLA está autorizado) ===== */
const tk = await api('adm', 'crearViaje', base({ cliente: 'COCACOLA', proyectoCat: 'COCACOLA', pilotoId: 'P-4', rutaId: r2.result.id, shipment: 'K-1', fechaPlan: '2031-05-01T08:00', ...H, desvio: true, desvioDestinoId: 'D-K2' }));
const tid = tk.result && tk.result.id;
const t1 = await api('fel', 'torreEditarHorarios', tid, { dvIngresoBodega: '2031-05-01T15:00', dvInicioDescarga: '2031-05-01T15:10', dvFinDescarga: '2031-05-01T15:40' });
const tt = await trip('fel', tid);
T('H16 Torre registra los horarios de descarga del desvío en un viaje con Desvío', t1.ok && tt && tt.dvFinDescarga === '2031-05-01T15:40' && tt.dvIngresoBodega === '2031-05-01T15:00', t1.message);
T('H17 Los horarios normales y el desvío se conservan tras la edición de Torre', tt.tIngresoBodega === H.tIngresoBodega && tt.tSalida === H.tSalida && tt.desvio === true && tt.desvioDestinoId === 'D-K2');
T('H18 Los horarios quedan en el mismo viaje en Supabase (viajes.extra)', (await colum(tid)).extra.dvInicioDescarga === '2031-05-01T15:10');
const aud = await q1(`select campo, anterior, nuevo, "por" from master.auditoria where viaje_id=$1`, [tid]);
T('H19 Queda en la bitácora quién cambió cada horario del desvío', aud.some(x => x.campo === 'Fin de descarga (desvío)' && x.nuevo), aud.map(x => x.campo));
const t2 = await api('fel', 'torreEditarHorarios', tid, { dvFinDescarga: '2031-05-01T15:00', dvInicioDescarga: '2031-05-01T15:30' });
T('H20 Torre tampoco puede dejar el fin antes del inicio en el desvío', !t2.ok && /fin de descarga/.test(t2.message), t2.message);
const t3 = await api('fel', 'torreEditarHorarios', tid, { desvioDestinoId: 'D-K1' });
T('H21 Torre no puede cambiar el destino del desvío (solo horarios)', !t3.ok && (await trip('fel', tid)).desvioDestinoId === 'D-K2', t3.message);
const tnC = await api('adm', 'crearViaje', base({ cliente: 'COCACOLA', proyectoCat: 'COCACOLA', pilotoId: 'P-4', rutaId: r2.result.id, shipment: 'K-2', fechaPlan: '2031-05-02T08:00', ...H }));
const t4 = await api('fel', 'torreEditarHorarios', tnC.result.id, { dvFinDescarga: '2031-05-02T15:00' });
T('H22 En un viaje sin Desvío Torre no puede escribir horarios de desvío', !t4.ok && /no tiene Desv/.test(t4.message), t4.message);
const t5 = await api('fel', 'torreEditarHorarios', tnC.result.id, { tFinDescarga: '2031-05-02T16:00' });
T('H23 Torre sigue editando los horarios normales como siempre', t5.ok && (await trip('fel', tnC.result.id)).tFinDescarga === '2031-05-02T16:00');
const t6 = await api('fel', 'torreEditarHorarios', dvv.result.id, { dvFinDescarga: '2031-04-02T17:00' });
T('H24 Torre no edita horarios de clientes no autorizados (COLGATE es solo consulta)', !t6.ok && /autorizados|consulta/i.test(t6.message), t6.message);
const t7 = await api('fel', 'crearViaje', base({ rutaId: r2.result.id }));
T('H25 Torre sigue sin poder crear viajes ni editar datos', !t7.ok);
const t8 = await api('fel', 'editarViaje', tid, { dvFinDescarga: '2031-05-01T17:00' });
T('H26 Torre no puede editar el viaje por la vía de datos', !t8.ok);

/* ===== 5. Referencia interna ===== */
const ri = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'R-1', fechaPlan: '2031-06-01T08:00' }));
T('H27 Un viaje se guarda sin «Referencia interna» (nunca fue obligatoria en el servidor)', ri.ok);
const col = await q1(`select column_name from information_schema.columns where table_schema='master' and table_name='viajes' and column_name='no_viaje'`);
T('H28 La columna y los datos históricos no se eliminan', col.length === 1);
const hist = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'R-2', fechaPlan: '2031-06-02T08:00', noViaje: 'NV-HIST' }));
T('H29 Los datos de «No. de viaje» ya guardados se siguen leyendo y guardando', hist.ok && (await trip('ped', hist.result.id)).noViaje === 'NV-HIST');
T('H30 Esta funcionalidad no necesita ninguna migración nueva (no hay 029)', !fs.existsSync(path.join(raíz, 'supabase/migrations/029_desvio_horarios.sql')) && fs.readdirSync(path.join(raíz, 'supabase/migrations')).filter(f => /^02[9]/.test(f)).length === 0);
T('H31 La cadena de auditoría sigue íntegra', (await api('adm', 'verificarAuditoria')).ok);
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
