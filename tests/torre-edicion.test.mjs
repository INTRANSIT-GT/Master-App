/* Pruebas de servidor (Postgres real con PGlite, scripts SQL del repositorio sin cambios): Torre de Control edita fechas, horarios y estatus. */
import { PGlite } from "@electric-sql/pglite";
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ejecutar } from '../supabase/functions/api/handler.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlDe = f => fs.readFileSync(path.join(raíz, 'supabase/migrations', f), 'utf8');

/* Migraciones en orden. El 005 es un ejemplo (se ejecuta a mano) y no entra aquí. */
const MIGRACIONES = ['001_esquema.sql', '002_seguridad_rls.sql', '003_almacenamiento.sql', '004_permisos_base.sql',
  '006_flota_fleetio.sql', '007_flujo_operativo.sql', '008_contabilidad.sql', '016_ordenes_pago.sql', '023_corregir_estados_rls.sql', '017_roles_departamentos.sql', '018_rol_proyectos.sql', '019_catalogos.sql', '020_arrastres.sql', '041_ruta_capacidad_km.sql'];

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

/* =============== TORRE: consultar, agregar y modificar horarios =============== */
const k0 = await trip('fel', vkid);
T('02 Torre consulta el viaje con sus horarios existentes aunque falten otros', k0 && k0.tIngresoPlanta === '2031-02-01T08:10' && !k0.tSalida && !k0.tFinDescarga, k0);
const f1 = await api('fel', 'torreEditarHorarios', vkid, { tSalida: '2031-02-01T09:10', tFinDescarga: '2031-02-01T13:40' });
const k1 = await trip('adm', vkid);
T('03 Torre AGREGA horarios que faltaban y quedan guardados en la base (los ve otro usuario)', f1.ok && f1.result.cambios === 2 && k1.tSalida === '2031-02-01T09:10' && k1.tFinDescarga === '2031-02-01T13:40' && k1.estado === 'PLANIFICADO', [f1, k1.estado]);
const f2 = await api('fel', 'torreEditarHorarios', vkid, { tIngresoPlanta: '2031-02-01T08:45', fechaPlan: '2031-02-02T08:00' });
const k2 = await trip('adm', vkid);
T('04 Torre MODIFICA un horario y la fecha plan ya registrados', f2.ok && k2.tIngresoPlanta === '2031-02-01T08:45' && k2.fechaPlan === '2031-02-02T08:00', f2);
const aud = (await snap('adm')).audit.filter(a => a.viajeId === vkid && /Torre de Control/.test(a.accion));
const aIn = aud.find(a => a.campo === 'Ingreso a planta');
T('05 Queda el historial: campo, valor anterior, valor nuevo, usuario y fecha de cada cambio', aud.length === 4 && aIn && /08:10/.test(aIn.anterior) && /08:45/.test(aIn.nuevo) && aIn.por === 'Felipe Torre' && !!aIn.en, aud.map(a => [a.campo, a.anterior, a.nuevo]));
const aSal = aud.find(a => a.campo === 'Fecha y hora de salida');
T('06 Un horario que estaba vacío se registra con anterior «(vacío)»', aSal && /vac/.test(aSal.anterior), aSal);
const sinCambio = await api('fel', 'torreEditarHorarios', vkid, { tIngresoPlanta: '2031-02-01T08:45' });
T('07 Guardar el mismo valor no genera un cambio nuevo en el historial', sinCambio.ok && sinCambio.result.cambios === 0 && (await snap('adm')).audit.filter(a => a.viajeId === vkid && /Torre de Control/.test(a.accion)).length === 4);
const mala = await api('fel', 'torreEditarHorarios', vkid, { tRampa: 'ayer por la tarde' });
T('08 Una fecha/hora con formato inválido se rechaza con mensaje y no cambia nada', mala.ok === false && mala.code === 'VALIDACION' && (await trip('adm', vkid)).tRampa === '', mala);
const vacioPlan = await api('fel', 'torreEditarHorarios', vkid, { fechaPlan: '' });
T('09 La fecha plan no puede quedar vacía', vacioPlan.ok === false && (await trip('adm', vkid)).fechaPlan === '2031-02-02T08:00', vacioPlan);
const otroCampo = await api('fel', 'torreEditarHorarios', vkid, { shipment: 'HACK', estado: 'ENTREGADO' });
const kc = await trip('adm', vkid);
T('10 Torre NO puede cambiar otros datos ni el estado por esta vía', otroCampo.ok === false && otroCampo.code === 'CAMPO_NO_EDITABLE' && kc.shipment === 'K-1' && kc.estado === 'PLANIFICADO', otroCampo);
const noAut = await api('fel', 'torreEditarHorarios', vcid, { tSalida: '2031-02-09T09:00' });
T('11 En un cliente NO autorizado para Torre (Colgate) solo puede consultar', noAut.ok === false && noAut.code === 'CLIENTE_NO_AUTORIZADO' && (await trip('adm', vcid)).tSalida === '', noAut);
T('12 Torre sigue sin poder editar con «editarViaje» (permisos actuales intactos)', (await api('fel', 'editarViaje', vkid, { tSalida: '2031-02-01T10:00' })).ok === false && (await trip('adm', vkid)).tSalida === '2031-02-01T09:10');
for (const [quien, rol] of [['ped', 'Encargado'], ['mar', 'Liquidaciones'], ['ale', 'Facturación'], ['gtr', 'Gerencia Transporte'], ['gco', 'Gerencia Comercial'], ['cta', 'Contabilidad']]) {
  const r = await api(quien, 'torreEditarHorarios', vkid, { tSalida: '2031-02-01T11:11' });
  T(`13 ${rol} no puede usar la edición de Torre`, r.ok === false && (await trip('adm', vkid)).tSalida === '2031-02-01T09:10', r);
}
const adm1 = await api('adm', 'torreEditarHorarios', vkid, { tSalida: '2031-02-01T09:15' });
T('14 La administradora conserva el permiso completo', adm1.ok && (await trip('adm', vkid)).tSalida === '2031-02-01T09:15', adm1);
const ts = (await snap('fel')).tarifas, ag = (await snap('fel')).agrupaciones, pg = (await snap('fel')).pagos;
T('15 Torre no recibe tarifas, facturas ni pagos (no gana permisos por poder editar horarios)', ts.length === 0 && ag.length === 0 && pg.length === 0, [ts.length, ag.length, pg.length]);
T('16 Torre sigue sin poder registrar tarifas ni preparar facturas', (await api('fel', 'crearTarifa', { cliente: 'COCACOLA', proyecto: 'COCACOLA', rutaId: r2.result.id, capacidad: '10 Ton', importe: 1, vigenteDesde: '2031-01-01' })).ok === false && (await api('fel', 'asignarNumeroFactura', { numeroFactura: 'X-1', viajeIds: [vkid] })).ok === false);


/* =============== TORRE: estatus (mismas reglas que ya tenía la app) =============== */
const faltaAlgo = await api('fel', 'torreMoverEstado', vkid, 'ENTREGADO');
T('17 Torre no puede saltar de Planificado a Entregado (flujo intacto)', faltaAlgo.ok === false && (await trip('adm', vkid)).estado === 'PLANIFICADO', faltaAlgo);
const aRuta = await api('fel', 'torreMoverEstado', vkid, 'EN_RUTA');
T('18 Torre cambia el estatus de Planificado a En ruta y queda guardado', aRuta.ok && (await trip('adm', vkid)).estado === 'EN_RUTA', aRuta);
const incompleto = await api('fel', 'torreMoverEstado', vkid, 'ENTREGADO');
T('19 Entregado exige los horarios completos: si faltan, se rechaza diciendo qué falta y el estado no cambia', incompleto.ok === false && (await trip('adm', vkid)).estado === 'EN_RUTA', incompleto);
const completa = await api('fel', 'torreEditarHorarios', vkid, Object.fromEntries(Object.entries(T10).map(([k, v]) => [k, v.replace('2031-01-01', '2031-02-02')])));
const aEnt = await api('fel', 'torreMoverEstado', vkid, 'ENTREGADO');
const kf = await trip('adm', vkid);
T('20 Con los horarios completados, Torre confirma la entrega (En ruta → Entregado) y persiste', completa.ok && aEnt.ok && kf.estado === 'ENTREGADO' && kf.tFinDescarga, [completa, aEnt]);
const atras = await api('fel', 'torreMoverEstado', vkid, 'PLANIFICADO'), aLiq = await api('fel', 'torreMoverEstado', vkid, 'LIQUIDADO');
T('21 Torre no puede retroceder ni pasar a Liquidado/Aceptado/Facturado', !atras.ok && !aLiq.ok && (await trip('adm', vkid)).estado === 'ENTREGADO', [atras, aLiq]);
const colg = await api('fel', 'torreMoverEstado', vcid, 'EN_RUTA');
T('22 En un cliente no autorizado para Torre (Colgate) no puede cambiar el estatus', colg.ok === false && colg.code === 'CLIENTE_NO_AUTORIZADO' && (await trip('adm', vcid)).estado === 'PLANIFICADO', colg);
const estAud = (await snap('adm')).audit.filter(a => a.viajeId === vkid && /Torre de Control/.test(a.accion) && /Viaje/.test(a.accion));
T('23 Los cambios de estatus quedan en la bitácora con el usuario', estAud.length >= 2 && estAud.every(a => a.por === 'Felipe Torre'), estAud.map(a => a.accion));
const dp = await api('fel', 'torreEditarHorarios', vkid, { pilotoId: 'P-1', tarifaCliente: 1 });
T('24 Torre no puede tocar piloto, tarifa ni otros campos', dp.ok === false && dp.code === 'CAMPO_NO_EDITABLE', dp);
const nm = await api('adm', 'verificarAuditoria');
T('25 La cadena de auditoría sigue íntegra', nm.ok && (nm.resultado ? nm.resultado.ok !== false : true), nm);

console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
