/* Pruebas (Postgres real con PGlite): Desvío en Crear viaje, destinos autorizados, horarios y permisos de Torre de Control, y la lista de migraciones existente (no hay migración nueva para Desvío). */
import { PGlite } from "@electric-sql/pglite";
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ejecutar } from '../supabase/functions/api/handler.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlDe = f => fs.readFileSync(path.join(raíz, 'supabase/migrations', f), 'utf8');

/* Migraciones en orden. El 005 es un ejemplo (se ejecuta a mano) y no entra aquí. */
const MIGRACIONES = ['001_esquema.sql', '002_seguridad_rls.sql', '003_almacenamiento.sql', '004_permisos_base.sql',
  '006_flota_fleetio.sql', '007_flujo_operativo.sql', '008_contabilidad.sql', '016_ordenes_pago.sql', '023_corregir_estados_rls.sql', '017_roles_departamentos.sql', '018_rol_proyectos.sql', '019_catalogos.sql', '020_arrastres.sql', '021_fecha_entrega_anterior.sql', '024_permisos_gerente_transporte.sql', '025_indices_viajes.sql', '026_viajes_sin_ruta.sql', '027_reportes_ayuda.sql', '028_ayuda_proyectos.sql'];

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

/* ===== Desvío ===== */
const ctrl = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'CTRL', fechaPlan: '2031-03-01T08:00', ...H }));
const n0 = await nViajes();
const dv = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'DV-1', fechaPlan: '2031-03-02T08:00', ...H, desvio: true, desvioDestinoId: 'D-C2' }));
T('D1 Se crea un viaje con Desvío hacia un destino del cliente', ctrl.ok && dv.ok, [ctrl.message, dv.message]);
const tc = await trip('adm', ctrl.result?.id), td = await trip('adm', dv.result?.id);
T('D2 Queda asociado a ESE viaje: desvío activo, destino, quién y cuándo', td.desvio === true && td.desvioDestinoId === 'D-C2' && td.desvioPor === 'Pedro Chaperon' && !!td.desvioEn, [td.desvio, td.desvioDestinoId]);
T('D3 No se genera un segundo viaje (solo +1 en la base) y el viaje de control no tiene desvío', (await nViajes()) === n0 + 1 && !tc.desvio && !('desvioDestinoId' in tc), [n0, await nViajes()]);
const igual = ['cliente', 'proyecto', 'proyectoCat', 'pilotoId', 'unidadId', 'rutaId', 'opl', 'tipoViaje', 'tipoCarga', 'noCarga', 'producto', 'placaArrastre', 'estado', 'tIngresoPlanta', 'tSalida', 'tIngresoBodega'];
T('D4 Los datos originales no cambian: mismos valores que un viaje igual sin desvío (ruta, piloto, placa, carga, horarios)', igual.every(k => tc[k] === td[k]), igual.filter(k => tc[k] !== td[k]));
T('D5 El destino del desvío está en la base (viajes.extra), asociado al id del viaje', JSON.stringify((await q1(`select extra from master.viajes where id=$1`, [td.id]))[0].extra).includes('D-C2'));
T('D6 La bitácora lo registra', (await snap('adm')).audit.some(a => a.viajeId === td.id && /DESVÍO/.test(a.ref || '')));
const sd = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'DV-2', desvio: true }));
T('D7 No se puede guardar un desvío sin destino (mensaje claro, no se crea el viaje)', !sd.ok && /hacia d[óo]nde fue el desv[íi]o/i.test(sd.message || '') && (await nViajes()) === n0 + 1, sd.message);
const o1 = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'DV-3', desvio: true, desvioDestinoId: 'D-M1' }));
const o2 = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'DV-4', desvio: true, desvioDestinoId: 'D-INVENTADO' }));
const o3 = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'DV-5', desvio: true, desvioDestinoId: 'D-K1' }));
T('D8 Solo destinos autorizados: uno de otro cliente, uno inexistente y otro de Coca-Cola se rechazan para un viaje de Colgate', [o1, o2, o3].every(r => !r.ok && r.code === 'VALIDACION') && (await nViajes()) === n0 + 1, [o1.message, o2.message, o3.message]);
const sn = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'NODV', desvio: false, desvioDestinoId: 'D-M1' }));
const tn = await trip('adm', sn.result?.id);
T('D9 Con Desvío desactivado no interviene: el viaje se guarda normal y sin datos de desvío (aunque llegue un destino suelto)', sn.ok && !tn.desvio && !('desvioDestinoId' in tn), sn.message);
const sr = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'PLANO' }));
T('D10 Un viaje normal (sin los campos nuevos) sigue guardándose exactamente igual', sr.ok);
const fR = await api('ped', 'crearViaje', base({ shipment: 'NORUTA' }));
T('D11 La validación de ruta no cambió: sin ruta y sin SIN RUTA sigue pidiendo la ruta', !fR.ok && /Falta Ruta/.test(fR.message || ''), fR.message);
const xs = await api('ped', 'crearViaje', base({ sinRuta: true, shipment: 'SRDV', desvio: true, desvioDestinoId: 'D-C1' }));
T('D12 Desvío y SIN RUTA son independientes: pueden coexistir', xs.ok && (await trip('adm', xs.result.id)).desvio === true);
const ed = await api('adm', 'editarViaje', td.id, { producto: 'Otro producto' });
T('D13 Editar el viaje no pierde el desvío', ed.ok && (await trip('adm', td.id)).desvio === true && (await trip('adm', td.id)).desvioDestinoId === 'D-C2', ed.message);
const ed2 = await api('adm', 'editarViaje', td.id, { desvioDestinoId: 'D-C1' });
T('D14 El desvío no se modifica por la vía de edición (no se amplía el alcance de editar)', !ed2.ok && (await trip('adm', td.id)).desvioDestinoId === 'D-C2', ed2.message);

/* ===== Torre de Control: horarios y permisos ===== */
const vk = await api('adm', 'crearViaje', base({ cliente: 'COCACOLA', proyectoCat: 'COCACOLA', pilotoId: 'P-4', rutaId: r2.result.id, shipment: 'K-DV', fechaPlan: '2031-04-01T08:00', tIngresoPlanta: '2031-04-01T08:10', desvio: true, desvioDestinoId: 'D-K2' }));
T('TC0 Preparación: viaje de un cliente de Torre con Desvío hacia D-K2', vk.ok, vk.message);
const vtT = (await snap('fel')).trips.find(t => t.id === vk.result?.id);
T('TC1 Torre sigue viendo el viaje y su desvío (dato operativo, no dinero)', vtT && vtT.desvio === true && vtT.desvioDestinoId === 'D-K2' && !('tarifaCliente' in vtT && vtT.tarifaCliente !== ''), vtT && vtT.desvio);
const h1 = await api('fel', 'torreEditarHorarios', vk.result.id, { tIngresoBodega: '2031-04-01T13:00', tInicioDescarga: '2031-04-01T13:10', tFinDescarga: '2031-04-01T13:40' });
const vh = await trip('adm', vk.result.id);
T('TC2 Torre registra los horarios de descarga del viaje con desvío (los campos de siempre)', h1.ok && vh.tIngresoBodega === '2031-04-01T13:00' && vh.tInicioDescarga === '2031-04-01T13:10' && vh.tFinDescarga === '2031-04-01T13:40', h1.message);
T('TC3 Los datos originales y el desvío se conservan tras guardar horarios', vh.desvio === true && vh.desvioDestinoId === 'D-K2' && vh.tIngresoPlanta === '2031-04-01T08:10' && vh.rutaId === r2.result.id && vh.pilotoId === 'P-4');
const h2 = await api('fel', 'torreEditarHorarios', vk.result.id, { desvioDestinoId: 'D-K1' }), h3 = await api('fel', 'torreEditarHorarios', vk.result.id, { rutaId: r1.result.id }), h4 = await api('fel', 'torreEditarHorarios', vk.result.id, { desvio: false });
T('TC4 Torre no puede modificar el desvío ni otros campos (solo horarios y estatus, como antes)', !h2.ok && !h3.ok && !h4.ok && (await trip('adm', vk.result.id)).desvioDestinoId === 'D-K2', [h2.code, h3.code, h4.code]);
const tcr = await api('fel', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'TCR', desvio: true, desvioDestinoId: 'D-C1' }));
const tce = await api('fel', 'editarViaje', vk.result.id, { desvioDestinoId: 'D-K1' });
T('TC5 Torre sigue sin crear ni editar viajes (sus permisos no cambiaron)', !tcr.ok && !tce.ok);
const mover = await api('fel', 'torreMoverEstado', vk.result.id, 'EN_RUTA');
T('TC6 Torre sigue pudiendo cambiar el estatus', mover.ok && (await trip('adm', vk.result.id)).estado === 'EN_RUTA', mover.message);
const pT = (await q1(`select permiso from master.permisos where rol='TORRE' and habilitado order by permiso`)).map(r => r.permiso).join();
T('TC7 Los permisos habilitados de Torre en la matriz siguen siendo los del repositorio (sin dinero ni edición de viajes)', !/finanzas|tarifas|viajes_crear|viajes_editar_datos/.test(pT), pT);
T('TC8 La cadena de auditoría sigue íntegra', (await api('adm', 'verificarAuditoria')).ok);
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
