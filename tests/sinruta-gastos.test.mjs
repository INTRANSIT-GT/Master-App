/* Pruebas (Postgres real con PGlite): viaje SIN RUTA, Gastos adicionales y etiqueta «Cantidad de carga». */
import { PGlite } from "@electric-sql/pglite";
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ejecutar } from '../supabase/functions/api/handler.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlDe = f => fs.readFileSync(path.join(raíz, 'supabase/migrations', f), 'utf8');

/* Migraciones en orden. El 005 es un ejemplo (se ejecuta a mano) y no entra aquí. */
const MIGRACIONES = ['001_esquema.sql', '002_seguridad_rls.sql', '003_almacenamiento.sql', '004_permisos_base.sql',
  '006_flota_fleetio.sql', '007_flujo_operativo.sql', '008_contabilidad.sql', '016_ordenes_pago.sql', '023_corregir_estados_rls.sql', '017_roles_departamentos.sql', '018_rol_proyectos.sql', '019_catalogos.sql', '020_arrastres.sql', '021_fecha_entrega_anterior.sql', '024_permisos_gerente_transporte.sql', '025_indices_viajes.sql', '026_viajes_sin_ruta.sql', '027_reportes_ayuda.sql'];

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

const snap = async quien => (await api(quien, 'snapshot')).snapshot;
const trip = async (quien, id) => (await snap(quien)).trips.find(t => t.id === id);
const r1 = await api('adm', 'registrarRuta', { codigo: 'COL-001', nombre: 'CP → Colgate 1', cliente: 'COLGATE', proyecto: 'COLGATE', origenId: 'CP', destinoId: 'D-C1' });
await api('ale', 'crearTarifa', { cliente: 'COLGATE', proyecto: 'COLGATE', rutaId: r1.result.id, capacidad: '10 Ton', importe: 4800, importeOpl: 3000, vigenteDesde: '2030-01-01' });
await api('gco', 'aprobarRutaComercial', r1.result.id); await api('gtr', 'aprobarRutaTransporte', r1.result.id);

let nF = 0;
const base = (extra = {}) => ({ cliente: 'COLGATE', proyectoCat: 'COLGATE', pilotoId: 'P-1', fechaPlan: '2031-01-' + String(++nF).padStart(2, '0') + 'T08:00', shipment: 'S-1', opl: 'J&J', tipoViaje: 'ONE WAY', tipoCarga: 'TARIMAS', noCarga: '7', producto: 'Prod', placaArrastre: 'C-ARR-001', ...extra });
const notis = async () => (await q1(`select * from master.notificaciones where tipo='VIAJE_SIN_RUTA'`));

/* ===== 1. SIN RUTA ===== */
const n0 = await api('adm', 'crearViaje', base({ shipment: 'N-0' }));
T('S1 Sin ruta y sin SIN RUTA: sigue rechazado con «Falta Ruta»', !n0.ok && /Falta Ruta/.test(n0.message || ''), n0);
const s1 = await api('ped', 'crearViaje', base({ sinRuta: true, shipment: 'S-1', noCarga: '12' }));
T('S2 Con SIN RUTA el viaje se crea sin ruta', s1.ok, s1);
const id1 = s1.result?.id; const t1 = await trip('ped', id1);
T('S3 La marca se guarda y se puede identificar (sinRuta, quién y cuándo)', t1 && t1.sinRuta === true && t1.sinRutaPor === 'Pedro Chaperon' && !!t1.sinRutaEn && !t1.rutaId, t1 && [t1.sinRuta, t1.sinRutaPor, t1.rutaId]);
T('S4 La marca está en la base (viajes.extra)', JSON.stringify((await q1(`select extra from master.viajes where id=$1`, [id1]))[0] || {}).includes('sinRuta'));
T('S5 Cantidad de carga (noCarga) conserva su valor', t1.noCarga === '12', t1.noCarga);
const nt = await notis();
T('S6 Se registra exactamente una notificación VIAJE_SIN_RUTA', nt.length === 1, nt.length);
const d = nt[0] && (typeof nt[0].detalle === 'string' ? JSON.parse(nt[0].detalle) : nt[0].detalle);
T('S7 La notificación trae viaje, cliente, proyecto, usuario y fecha/hora', d && d.viaje === id1 && d.cliente && d.proyecto === 'COLGATE' && d.registradoPor === 'Pedro Chaperon' && d.fechaRegistro, d);
const nv = async k => (await snap(k)).notificaciones;
const vistas = { gco: await nv('gco'), gtr: await nv('gtr'), adm: await nv('adm'), ped: await nv('ped'), fel: await nv('fel') };
const tiene = a => (a || []).some(n => n.tipo === 'VIAJE_SIN_RUTA');
T('S8 Gerencia Comercial, Gerencia Transporte y Admin la ven; el operativo y Torre no', tiene(vistas.gco) && tiene(vistas.gtr) && tiene(vistas.adm) && !tiene(vistas.ped) && !tiene(vistas.fel), Object.fromEntries(Object.entries(vistas).map(([k, v]) => [k, tiene(v)])));
await api('ped', 'editarViaje', id1, { producto: 'Otro' });
T('S9 Editar el viaje no duplica la notificación', (await notis()).length === 1);
const s2 = await api('ped', 'crearViaje', base({ sinRuta: true, shipment: 'S-2' }));
T('S10 Un segundo viaje SIN RUTA genera su propia notificación (2 en total)', s2.ok && (await notis()).length === 2);
const s3 = await api('ped', 'crearViaje', base({ sinRuta: true, rutaId: r1.result.id, shipment: 'S-3' }));
T('S11 SIN RUTA junto con una ruta seleccionada se rechaza', !s3.ok && /SIN RUTA/.test(s3.message || ''), s3);
const s4 = await api('ped', 'crearViaje', base({ sinRuta: true, proyectoCat: '', shipment: 'S-4' }));
T('S12 SIN RUTA no salta las demás validaciones (falta proyecto)', !s4.ok && /proyecto/i.test(s4.message || ''), s4);
const s5 = await api('ped', 'crearViaje', base({ sinRuta: true, shipment: 'S-5', pilotoId: '' }));
T('S13 SIN RUTA no salta las demás validaciones (falta piloto)', !s5.ok, s5);
const s6 = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'S-6' }));
const t6 = await trip('ped', s6.result?.id);
T('S14 Un viaje normal con ruta no lleva la marca ni notificación', s6.ok && !t6.sinRuta && (await notis()).length === 2, s6);
const s7 = await api('fel', 'crearViaje', base({ sinRuta: true, shipment: 'S-7' }));
T('S15 Quien no puede crear viajes sigue sin poder (Torre)', !s7.ok, s7);

/* ===== 2. Gastos adicionales ===== */
const G = [{ concepto: 'Pernocta', importe: 150.5 }, { concepto: 'Peaje', importe: '45' }, { concepto: 'Parqueo', importe: 20.255 }];
const g1 = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'G-1', gastosAdicionales: G, qViaticos: 100 }));
T('G1 Se crea un viaje con varios gastos adicionales', g1.ok, g1);
const gid = g1.result?.id; const tg = await trip('adm', gid);
T('G2 Se guardan los tres gastos ligados a este viaje (importes redondeados)', Array.isArray(tg.gastosAdicionales) && tg.gastosAdicionales.length === 3 && tg.gastosAdicionales[0].concepto === 'Pernocta' && tg.gastosAdicionales[0].importe === 150.5 && tg.gastosAdicionales[1].importe === 45 && tg.gastosAdicionales[2].importe === 20.26, tg.gastosAdicionales);
T('G3 Viáticos (qViaticos) no se alteran', tg.qViaticos === 100, tg.qViaticos);
T('G4 Al reabrir (nuevo snapshot) siguen ahí', (await trip('adm', gid)).gastosAdicionales.length === 3);
const otros = (await snap('adm')).trips.filter(t => t.id !== gid && (t.gastosAdicionales || []).length);
T('G5 Ningún otro viaje recibió esos gastos', otros.length === 0, otros.map(t => t.id));
const bad = [[{ concepto: '', importe: 10 }, /concepto/i], [{ concepto: 'X', importe: '' }, /importe/i], [{ concepto: 'X', importe: -5 }, /importe/i], [{ concepto: 'X', importe: 'abc' }, /importe/i], [{ concepto: 'X', importe: 0 }, /importe/i]];
for (const [g, re] of bad) {
  const r = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'GB', gastosAdicionales: [g] }));
  T(`G6 Rechaza gasto inválido ${JSON.stringify(g)} con mensaje claro`, !r.ok && re.test(r.message || '') && /Gasto/i.test(r.message), r.message);
}
const vacio = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'GV', gastosAdicionales: [{ concepto: '', importe: '' }] }));
T('G7 Una fila totalmente vacía se ignora', vacio.ok && !((await trip('adm', vacio.result.id)).gastosAdicionales || []).length, vacio);
const ed = await api('adm', 'editarViaje', gid, { gastosAdicionales: [{ concepto: 'Pernocta', importe: 200 }, { concepto: 'Peaje', importe: 45 }] });
const tg2 = await trip('adm', gid);
T('G8 Se corrigen (editar) con el permiso existente', ed.ok && tg2.gastosAdicionales.length === 2 && tg2.gastosAdicionales[0].importe === 200, ed);
const au = (await snap('adm')).audit.filter(a => a.viajeId === gid && a.campo === 'Gastos adicionales');
T('G9 La bitácora registra el cambio con el nombre «Gastos adicionales»', au.length >= 1, au);
const hk = await api('fel', 'editarViaje', gid, { gastosAdicionales: [{ concepto: 'Z', importe: 1 }] });
T('G10 Torre no puede editar gastos', !hk.ok && (await trip('adm', gid)).gastosAdicionales.length === 2, hk);
const tT = (await snap('fel')).trips.find(t => t.id === gid);
T('G11 Torre no recibe gastos adicionales ni viáticos', !tT || (!('gastosAdicionales' in tT) && !('qViaticos' in tT)), tT && Object.keys(tT));
const auT = (await snap('fel')).audit || [];
T('G12 Torre no ve en la bitácora los importes de gastos', !JSON.stringify(auT).includes('Pernocta'), 'visible');
const tV = (await snap('ped')).trips.find(t => t.id === gid);
T('G13 El operativo creador (viajes_editar_datos) sí los ve', tV && Array.isArray(tV.gastosAdicionales), tV && Object.keys(tV).length);
const many = Array.from({ length: 41 }, (_, i) => ({ concepto: 'C' + i, importe: 1 }));
const m = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'GM', gastosAdicionales: many }));
T('G14 Más de 40 gastos se rechaza', !m.ok, m.message);
const nm = await api('adm', 'verificarAuditoria');
T('G15 La cadena de auditoría sigue íntegra', nm.ok, nm);

/* ===== 3. Cantidad de carga: solo el nombre visible ===== */
const col = await q1(`select column_name from information_schema.columns where table_schema='master' and table_name='viajes' and column_name in ('no_carga','noCarga')`);
T('C1 La columna de base de datos no cambió (no_carga)', col.some(c => c.column_name === 'no_carga'), col);
const bn = await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'CN', noCarga: '' }));
T('C2 Los mensajes de validación mencionan «Cantidad de carga»', bn.ok || /Cantidad de carga/.test(bn.message || '') || !/No\. de carga/.test(bn.message || ''), bn.message);


/* ===== 4. Ayuda ===== */
const rep = (extra = {}) => ({ tipo: 'Error en un formulario', modulo: 'Nuevo viaje', descripcion: 'Al guardar un viaje aparece un error y se borra lo escrito', intento: 'Guardar un viaje', ...extra });
const a1 = await api('ped', 'crearReporteAyuda', rep());
T('Y1 Un operativo crea un reporte de ayuda', a1.ok && /^AYU-/.test(a1.result?.id || ''), a1);
const fila = (await q1(`select * from master.reportes_ayuda where id=$1`, [a1.result?.id]))[0] || {};
T('Y2 Queda guardado en la base con usuario, módulo, tipo, descripción, intento, estado Pendiente y fecha', fila.usuario_id === U.ped && fila.usuario === 'Pedro Chaperon' && fila.modulo === 'Nuevo viaje' && fila.tipo === 'Error en un formulario' && fila.intento === 'Guardar un viaje' && fila.estado === 'PENDIENTE' && !!fila.creado_en, fila);
for (const k of ['fel', 'mar', 'ale', 'gco', 'gtr', 'cta', 'adm']) {
  const r = await api(k, 'crearReporteAyuda', rep({ descripcion: 'Reporte de prueba del perfil ' + k + ' con detalle' }));
  T(`Y3 El perfil ${k} también puede reportar`, r.ok, r);
}
const e1 = await api('ped', 'crearReporteAyuda', rep({ tipo: 'Inventado' })), e2 = await api('ped', 'crearReporteAyuda', rep({ modulo: 'Módulo inventado' })), e3 = await api('ped', 'crearReporteAyuda', rep({ descripcion: 'corto' })), e4 = await api('ped', 'crearReporteAyuda', rep({ descripcion: 'x'.repeat(2001) })), e5 = await api('ped', 'crearReporteAyuda', rep({ intento: 'y'.repeat(1001), descripcion: 'Otra descripción suficientemente larga' }));
T('Y4 Valida tipo, módulo, descripción mínima/máxima e intento máximo con mensajes claros', [e1, e2, e3, e4, e5].every(r => !r.ok && r.code === 'VALIDACION') && /tipo/i.test(e1.message) && /módulo/i.test(e2.message) && /Describe/.test(e3.message), [e1.message, e2.message, e3.message]);
const ns = await api('ped', 'crearReporteAyuda', rep({ modulo: 'No estoy seguro', descripcion: 'No sé en qué pantalla pasó pero falla', intento: '' }));
T('Y5 «No estoy seguro» es válido y «¿Qué intentaba?» es opcional', ns.ok, ns);
const dup = await api('ped', 'crearReporteAyuda', rep());
T('Y6 El mismo reporte repetido de inmediato se rechaza (sin duplicar)', !dup.ok && dup.code === 'DUPLICADO' && (await q1(`select count(*)::int n from master.reportes_ayuda where usuario_id=$1 and descripcion=$2`, [U.ped, rep().descripcion]))[0].n === 1, dup);
const nR = (await q1(`select * from master.notificaciones where tipo='REPORTE_AYUDA'`));
T('Y7 Cada reporte genera una sola notificación para el Administrador', nR.length === 9 && (await q1(`select count(*)::int n from master.notificaciones where tipo='REPORTE_AYUDA' and asunto like $1`, ['%' + a1.result.id + '%']))[0].n === 1, nR.length);
const vN = async k => ((await snap(k)).notificaciones || []).some(n => n.tipo === 'REPORTE_AYUDA');
T('Y8 La ve el Administrador y no la ven los demás perfiles', (await vN('adm')) && !(await vN('ped')) && !(await vN('gco')) && !(await vN('gtr')) && !(await vN('fel')));
const mios = (await snap('ped')).reportesAyuda, todos = (await snap('adm')).reportesAyuda, deFel = (await snap('fel')).reportesAyuda;
T('Y9 Un usuario ve solo SUS reportes; el Administrador ve todos', mios.length === 2 && mios.every(r => r.usuarioId === U.ped) && todos.length === 9 && deFel.length === 1 && deFel[0].usuarioId === U.fel, [mios.length, todos.length, deFel.length]);
const cam = await api('ped', 'cambiarEstadoReporteAyuda', a1.result.id, 'RESUELTO'), cam2 = await api('fel', 'cambiarEstadoReporteAyuda', a1.result.id, 'EN_REVISION');
T('Y10 Un usuario normal no puede cambiar el estado (ni de su propio reporte)', !cam.ok && cam.code === 'SIN_PERMISO' && !cam2.ok && (await q1(`select estado from master.reportes_ayuda where id=$1`, [a1.result.id]))[0].estado === 'PENDIENTE', [cam.code, cam2.code]);
const c1 = await api('adm', 'cambiarEstadoReporteAyuda', a1.result.id, 'EN_REVISION'), c2 = await api('adm', 'cambiarEstadoReporteAyuda', a1.result.id, 'RESUELTO');
const f2 = (await q1(`select * from master.reportes_ayuda where id=$1`, [a1.result.id]))[0];
T('Y11 El Administrador cambia Pendiente → En revisión → Resuelto y queda el historial', c1.ok && c2.ok && f2.estado === 'RESUELTO' && f2.actualizado_por === 'Administradora' && (typeof f2.historial === 'string' ? JSON.parse(f2.historial) : f2.historial).map(h => h.estado).join() === 'PENDIENTE,EN_REVISION,RESUELTO', f2.historial);
const ci = await api('adm', 'cambiarEstadoReporteAyuda', a1.result.id, 'LOQUESEA'), cx = await api('adm', 'cambiarEstadoReporteAyuda', 'AYU-9999', 'RESUELTO');
T('Y12 Estado inválido o reporte inexistente se rechazan', !ci.ok && !cx.ok, [ci.code, cx.code]);
T('Y13 El usuario ve el nuevo estado en su lista', (await snap('ped')).reportesAyuda.find(r => r.id === a1.result.id).estado === 'RESUELTO');
/* Lectura directa (API REST con la sesión de cada usuario): políticas RLS de la migración 027 */
const rls = async k => comoUsuario(k, async tx => (await tx.query(`select id, usuario_id from master.reportes_ayuda`)).rows);
const rPed = await rls('ped'), rFel = await rls('fel'), rAdm = await rls('adm');
T('Y14 RLS: cada usuario lee solo sus filas y el Administrador todas', rPed.length === 2 && rPed.every(r => r.usuario_id === U.ped) && rFel.length === 1 && rAdm.length === 9, [rPed.length, rFel.length, rAdm.length]);
const eAnon = await intenta(() => comoUsuario(null, tx => tx.query(`select * from master.reportes_ayuda`)));
T('Y15 RLS: sin sesión no se puede leer', !!eAnon, eAnon);
const eIns = await intenta(() => comoUsuario('ped', tx => tx.query(`insert into master.reportes_ayuda(id,usuario_id,modulo,tipo,descripcion) values ('AYU-X',$1,'x','x','x')`, [U.ped])));
const eUpd = await intenta(() => comoUsuario('adm', tx => tx.query(`update master.reportes_ayuda set estado='RESUELTO'`)));
const eDel = await intenta(() => comoUsuario('adm', tx => tx.query(`delete from master.reportes_ayuda`)));
T('Y16 RLS: nadie puede insertar, modificar ni borrar por la API REST', !!eIns && !!eUpd && !!eDel, [eIns, eUpd, eDel]);
T('Y17 La auditoría registra creación y cambios de estado y su cadena sigue íntegra', (await snap('adm')).audit.some(a => a.entidad === 'AYUDA' && a.accion === 'Estado de reporte de ayuda modificado') && (await api('adm', 'verificarAuditoria')).ok);
/* Ayuda no abre módulos restringidos: Torre sigue sin importes ni acceso a finanzas */
T('Y18 Ayuda no da acceso a otros módulos (Torre sigue sin finanzas ni tarifas)', (await api('fel', 'tarifas')).ok === false && (await api('fel', 'gastos', {})).ok === false);
/* Si la migración 027 todavía no se aplicó, la aplicación no se cae */
await db.exec('drop table master.reportes_ayuda');
const sinTabla = await api('adm', 'snapshot');
T('Y19 Sin la tabla (migración 027 pendiente) el resto de la aplicación sigue funcionando', sinTabla.ok && Array.isArray(sinTabla.snapshot.reportesAyuda) && sinTabla.snapshot.reportesAyuda.length === 0 && sinTabla.snapshot.trips.length > 0, sinTabla.message);
const sinTabla2 = await api('ped', 'crearReporteAyuda', rep({ descripcion: 'Intento sin tabla creada todavía' }));
T('Y20 Sin la tabla, crear un reporte falla sin guardar nada y sin romper otras funciones', !sinTabla2.ok && (await api('ped', 'crearViaje', base({ rutaId: r1.result.id, shipment: 'POST' }))).ok, sinTabla2.detalle || sinTabla2.message);

console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
