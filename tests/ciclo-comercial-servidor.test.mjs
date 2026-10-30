/* Ciclo comercial COMPLETO contra un Postgres real (PGlite) pasando por handler.mjs (el mismo código de la Edge Function):
   permisos validados en el SERVIDOR, elegibilidad, agrupación (cliente y proyecto únicos), número de factura único, PDF por versiones,
   evidencia, «Cliente confirmó» / rechazo, Facturación, envío de factura ≠ cobro, historial y archivos conservados, tarifas en solo
   lectura y compatibilidad de la migración 035 con la 034. NO toca Supabase real. */
import { PGlite } from '@electric-sql/pglite';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ejecutar } from '../supabase/functions/api/handler.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sqlDe = f => fs.readFileSync(path.join(raíz, 'supabase/migrations', f), 'utf8');
const BASE = ['001_esquema.sql', '002_seguridad_rls.sql', '003_almacenamiento.sql', '004_permisos_base.sql',
  '006_flota_fleetio.sql', '007_flujo_operativo.sql', '008_contabilidad.sql', '016_ordenes_pago.sql', '023_corregir_estados_rls.sql', '017_roles_departamentos.sql', '018_rol_proyectos.sql',
  '019_catalogos.sql', '020_arrastres.sql', '021_fecha_entrega_anterior.sql', '024_permisos_gerente_transporte.sql', '025_indices_viajes.sql',
  '026_viajes_sin_ruta.sql', '027_reportes_ayuda.sql', '028_ayuda_proyectos.sql', '029_lugares.sql', '030_origen_destino_texto.sql', '031_bucket_manuales.sql', '032_pilotos_documentos.sql', '033_acceso_modulos_secciones.sql', '041_ruta_capacidad_km.sql'];
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
/* ============ Ciclo completo con 034 + 035 ============ */
const S = await montar([...BASE, '034_ordenes_compra.sql', '035_agrupaciones_flujo.sql']);
const { db, U, api, q1, como } = S;
await db.exec("insert into storage.buckets(id,name,public,file_size_limit) values ('evidencias','evidencias',false,3145728) on conflict do nothing");
const r1 = await api('adm', 'registrarRuta', { codigo: 'COL-001', nombre: 'CP → Colgate 1', cliente: 'COLGATE', proyecto: 'COLGATE', origen: 'Ciudad', destino: 'Bodega' });
await db.exec("update master.rutas set estado='ACTIVA'");
await db.exec(`insert into master.clientes(id,nombre,cliente,proyectos,torre_estatus) values ('COCA','Coca','COCA','{COCA}',false); insert into master.clientes_fiscal(cliente_id) values ('COCA');`);
const viaje = (extra = {}) => ({ cliente: 'COLGATE', pilotoId: 'P-1', rutaId: r1.result.id, fechaPlan: '2031-12-29T14:30', shipment: 'S-1', opl: 'J&J', tipoViaje: 'ONE WAY', tipoCarga: 'TARIMAS', noCarga: '1', producto: 'Producto', placaArrastre: 'C-ARR-001', ...T10, ...extra });
const mk = async (i, fecha, tarifa, { liquidado = true } = {}) => {
  const v = await api('adm', 'crearViaje', viaje({ shipment: 'SH-' + i, fechaPlan: fecha, pilotoId: i % 2 ? 'P-1' : 'P-3' }));
  if (!v.ok) { T('Datos · viaje ' + i, false, v); return null; }
  if (liquidado) await db.query(`update master.viajes set estado='ACEPTADO', liq_aprobada_en=now() where id=$1`, [v.result.id]);
  if (tarifa != null) await db.query(`insert into master.viajes_tarifa(viaje_id, tarifa_cliente) values ($1,$2)`, [v.result.id, tarifa]);
  return v.result.id;
};
const a = await mk(1, '2031-12-28T08:00', 1000), b = await mk(2, '2031-12-29T14:30', 1500), c = await mk(3, '2032-01-04T06:15', 2000), sinLiq = await mk(4, '2031-05-05T08:00', 900, { liquidado: false }),
  d4 = await mk(5, '2031-06-01T08:00', 700), otroPry = await mk(6, '2031-06-02T08:00', 800), otroCli = await mk(7, '2031-06-03T08:00', 600);
await db.query(`update master.viajes set proyecto_cat='LV' where id=$1`, [otroPry]);
await db.query(`update master.viajes set cliente_id='COCA' where id=$1`, [otroCli]);
await db.query(`update master.viajes set extra = extra || '{"tarifaBase":1000,"ajusteCombustible":100}'::jsonb where id=$1`, [a]);
await db.query(`update master.viajes_tarifa set tarifa_cliente=1100 where viaje_id=$1`, [a]);
T('D0 Datos: 7 viajes (5 liquidados de Colgate/COLGATE, 1 sin liquidar, 1 de otro proyecto y 1 de otro cliente)', [a, b, c, sinLiq, d4, otroPry, otroCli].every(Boolean));
const gUsuario = k => U[k];
const prep = (q, ids, nf = 'F-100', extra = {}) => api(q, 'prepararFactura', { cliente: 'COLGATE', viajeIds: ids, serieFactura: 'A', numeroFactura: nf, fechaFactura: '2032-01-10', ...extra });

/* ---- 1. Quién puede agrupar y qué viajes son elegibles (SERVIDOR) ---- */
for (const q of ['fac', 'fel', 'mar', 'ped']) { const r = await prep(q, [a]); T(`E1 El servidor rechaza agrupar a ${q} (sin permiso), aunque el botón estuviera visible`, !r.ok && r.code === 'SIN_PERMISO', r); }
const rSinLiq = await prep('ale', [sinLiq]);
T('E2 Un viaje NO liquidado/confirmado no se puede agrupar (servidor: NO_ELEGIBLE)', !rSinLiq.ok && rSinLiq.code === 'NO_ELEGIBLE', rSinLiq);
const rCli = await prep('ale', [a, otroCli]);
T('E3 No se mezclan clientes en una agrupación (CLIENTE_DISTINTO)', !rCli.ok && rCli.code === 'CLIENTE_DISTINTO', rCli);
const rPry = await prep('ale', [d4, otroPry]);
T('E4 No se mezclan proyectos en una agrupación (PROYECTO_DISTINTO): regla de trabajo un cliente + un proyecto', !rPry.ok && rPry.code === 'PROYECTO_DISTINTO', rPry);
T('E5 Los intentos rechazados no dejan agrupaciones ni reservan viajes', (await q1('select count(*)::int n from master.agrupaciones'))[0].n === 0 && (await q1("select count(*)::int n from master.viajes where agrupacion_id<>''"))[0].n === 0);
const g1 = await prep('ale', [a, b], 'F-100');
T('E6 El Analista agrupa 2 viajes liquidados: AGR-0001 con el número de factura, el usuario autenticado y los viajes reservados', g1.ok && g1.result.id === 'AGR-0001' && g1.result.creadoPorId === U.ale && g1.result.numeroFactura === 'F-100' && (await q1("select count(*)::int n from master.viajes where agrupacion_id='AGR-0001'"))[0].n === 2, g1);
const dup1 = await prep('ale', [c], 'f-100'), dup2 = await prep('gco', [c], 'F-100');
T('E7 Número de factura duplicado: se rechaza en el servidor sin distinguir mayúsculas (FACTURA_DUPLICADA)', !dup1.ok && dup1.code === 'FACTURA_DUPLICADA' && !dup2.ok && dup2.code === 'FACTURA_DUPLICADA', [dup1.code, dup2.code]);
let eIdx = ''; try { await db.query(`insert into master.agrupaciones(id,cliente_id,modalidad,fase,viaje_ids,estado,numero_factura) values ('AGR-X','COLGATE','INDIVIDUAL','PREPARADA',array['x'],'ACTIVA','F-100')`); } catch (e) { eIdx = e.message; }
T('E8 La base también impide dos agrupaciones ACTIVAS con el mismo número (índice uq_factura_numero, sin distinguir mayúsculas ni serie)', /uq_factura_numero|duplicate key/.test(eIdx), eIdx);
const rYa = await prep('gco', [a], 'F-555');
T('E9 Un viaje ya agrupado no entra en otra agrupación activa (YA_FACTURADO)', !rYa.ok && rYa.code === 'YA_FACTURADO', rYa);

/* ---- 2. Reportes PDF por versiones (archivo ya subido al almacenamiento privado) ---- */
const sube2 = async n => db.exec(`insert into storage.objects(bucket_id,name) values ('evidencias','${n}') on conflict do nothing`);
const ruta = (pref, n) => `facturas/AGR-0001/${pref}${n}.pdf`;
const huella = async (tipo, opc = []) => { const r = await api('ale', 'agrRegistrarPdf', 'AGR-0001', { tipo, opcionales: opc, huella: 'xx', hash: 'abcdef0123456789', archivo: { path: ruta(tipo === 'INTERNO' ? 'interno-' : 'cliente-', '0001aaaa') } }); return (/ref\. ([0-9a-f]{8})/.exec(r.message || '') || [])[1]; };
await sube2(ruta('interno-', '0001aaaa')); await sube2(ruta('cliente-', '0001aaaa')); await sube2(ruta('cliente-', '0002bbbb')); await sube2('facturas/AGR-0001/autorizacion-0001aaaa.png'); await sube2('facturas/AGR-0001/rechazo-0001aaaa.png'); await sube2('facturas/AGR-0001/autorizacion-0002bbbb.png');
const hI = await huella('INTERNO'), hC = await huella('CLIENTE', []);
T('P0 Los datos del reporte llevan una huella que cambia con las columnas elegidas (el servidor valida que el PDF corresponde a los datos vigentes)', !!hI && !!hC && hC !== await huella('CLIENTE', ['ruta']));
const pF = await api('fac', 'agrRegistrarPdf', 'AGR-0001', { tipo: 'CLIENTE', opcionales: [], huella: hC, hash: 'abcdef0123456789', archivo: { path: ruta('cliente-', '0001aaaa') } });
T('P1 Facturación no puede generar reportes PDF (servidor)', !pF.ok && pF.code === 'SIN_PERMISO', pF);
const pI = await api('ale', 'agrRegistrarPdf', 'AGR-0001', { tipo: 'INTERNO', opcionales: [], huella: hI, hash: 'abcdef0123456789', archivo: { path: ruta('interno-', '0001aaaa') } });
const pC = await api('ale', 'agrRegistrarPdf', 'AGR-0001', { tipo: 'CLIENTE', opcionales: [], huella: hC, hash: 'bbcdef0123456789', archivo: { path: ruta('cliente-', '0001aaaa') } });
T('P2 El Analista registra el PDF interno y el del cliente (versión 1 de cada uno), con huella, usuario autenticado y archivo en el bucket privado', pI.ok && pC.ok && pC.result.pdfs.length === 2 && pC.result.pdfs.every(p => p.version === 1 && p.porId === U.ale && /^facturas\/AGR-0001\//.test(p.path)), [pI.message, pC.message]);
const pBad = await api('ale', 'agrRegistrarPdf', 'AGR-0001', { tipo: 'CLIENTE', opcionales: ['ruta'], huella: 'zzzzzzzz', hash: 'cbcdef0123456789', archivo: { path: ruta('cliente-', '0002bbbb') }, motivo: 'otra versión' });
T('P3 Un PDF con datos distintos a los vigentes se rechaza (DATOS_CAMBIARON)', !pBad.ok && pBad.code === 'DATOS_CAMBIARON', pBad);
const pNoMot = await api('ale', 'agrRegistrarPdf', 'AGR-0001', { tipo: 'CLIENTE', opcionales: ['ruta'], huella: await huella('CLIENTE', ['ruta']), hash: 'cbcdef0123456789', archivo: { path: ruta('cliente-', '0002bbbb') } });
T('P4 Una segunda versión del PDF del cliente exige el motivo', !pNoMot.ok && pNoMot.code === 'VALIDACION', pNoMot);
const pFuera = await api('ale', 'agrRegistrarPdf', 'AGR-0001', { tipo: 'CLIENTE', opcionales: [], huella: hC, hash: 'abcdef0123456789', archivo: { path: 'facturas/AGR-9999/cliente-0001aaaa.pdf' } });
T('P5 Un archivo de otra agrupación o inexistente en el bucket no se acepta', !pFuera.ok, pFuera);
const pCol = await api('ale', 'agrRegistrarPdf', 'AGR-0001', { tipo: 'CLIENTE', opcionales: ['peso'], huella: hC, hash: 'abcdef0123456789', archivo: { path: ruta('cliente-', '0001aaaa') } });
T('P6 Una columna opcional inexistente se rechaza (solo Capacidad, Ruta, Origen y Tarifa de combustible)', !pCol.ok && pCol.code === 'VALIDACION', pCol);

/* ---- 3. Evidencia, rechazo y «Cliente confirmó» ---- */
const evF = await api('fac', 'agrAdjuntarEvidencia', 'AGR-0001', { archivo: { path: 'facturas/AGR-0001/autorizacion-0001aaaa.png', nombre: 'x.png' } });
T('C1 Facturación no puede adjuntar evidencia de autorización (servidor)', !evF.ok && evF.code === 'SIN_PERMISO', evF);
const cfSin = await api('ale', 'confirmarCliente', 'AGR-0001');
T('C2 «Cliente confirmó» no se acepta sin la evidencia (SIN_EVIDENCIA): adjuntar un archivo no basta ni su ausencia se ignora', !cfSin.ok && cfSin.code === 'SIN_EVIDENCIA', cfSin);
const rzF = await api('fac', 'agrRechazarCliente', 'AGR-0001', { motivo: 'Facturación intenta rechazar' });
T('C3 Facturación no puede registrar el rechazo (servidor)', !rzF.ok && rzF.code === 'SIN_PERMISO', rzF);
const rzCorto = await api('ale', 'agrRechazarCliente', 'AGR-0001', { motivo: 'no' });
T('C4 El rechazo exige un motivo', !rzCorto.ok && rzCorto.code === 'VALIDACION', rzCorto);
const rz = await api('ale', 'agrRechazarCliente', 'AGR-0001', { motivo: 'Las tarifas no coinciden con su orden', archivo: { path: 'facturas/AGR-0001/rechazo-0001aaaa.png', nombre: 'rechazo.png' } });
T('C5 El rechazo guarda motivo, versión del reporte (v1), usuario autenticado, fecha y su evidencia', rz.ok && rz.result.rechazos[0].pdfVersion === 1 && rz.result.rechazos[0].porId === U.ale && !!rz.result.rechazos[0].en && /rechazo-/.test(rz.result.rechazos[0].path), rz.message);
const cfRz = await api('ale', 'confirmarCliente', 'AGR-0001');
T('C6 No se puede confirmar un reporte rechazado', !cfRz.ok && cfRz.code === 'ESTADO_INVALIDO', cfRz);
const hC2 = await huella('CLIENTE', ['ruta']);
const pC2 = await api('ale', 'agrRegistrarPdf', 'AGR-0001', { tipo: 'CLIENTE', opcionales: ['ruta'], huella: hC2, hash: 'cbcdef0123456789', archivo: { path: ruta('cliente-', '0002bbbb') }, motivo: 'Corregido tras el rechazo del cliente' });
T('C7 La corrección crea la versión 2 con la columna opcional elegida (Ruta); la versión 1 se conserva', pC2.ok && pC2.result.pdfs.filter(p => p.tipo === 'CLIENTE').length === 2 && pC2.result.pdfs.find(p => p.tipo === 'CLIENTE' && p.version === 2).columnas.includes('ruta') && !pC2.result.pdfs.find(p => p.tipo === 'CLIENTE' && p.version === 1).columnas.includes('ruta'), pC2.message);
const cfV1 = await api('ale', 'confirmarCliente', 'AGR-0001');
T('C8 La evidencia debe corresponder a la versión vigente (v2): sin ella no se confirma', !cfV1.ok && cfV1.code === 'SIN_EVIDENCIA', cfV1);
const ev1 = await api('ale', 'agrAdjuntarEvidencia', 'AGR-0001', { archivo: { path: 'facturas/AGR-0001/autorizacion-0002bbbb.png', nombre: 'correo.png' }, nota: 'Correo de autorización' });
T('C9 La evidencia de autorización queda ligada a la versión 2, con usuario autenticado y fecha', ev1.ok && ev1.result.evidenciasAutorizacion[0].pdfVersion === 2 && ev1.result.evidenciasAutorizacion[0].porId === U.ale && !!ev1.result.evidenciasAutorizacion[0].en, ev1.message);
const sinConf = await api('fac', 'enviarFactura', 'AGR-0001');
T('C10 Facturación no recibe/inicia una agrupación NO confirmada (SIN_CONFIRMACION)', !sinConf.ok && sinConf.code === 'SIN_CONFIRMACION', sinConf);
const cfF = await api('fac', 'confirmarCliente', 'AGR-0001');
T('C11 Facturación no puede marcar «Cliente confirmó» (servidor)', !cfF.ok && cfF.code === 'SIN_PERMISO', cfF);
const cf = await api('ale', 'confirmarCliente', 'AGR-0001');
T('C12 El Analista confirma: queda usuario autenticado, fecha, versión del PDF autorizado (v2) y la evidencia', cf.ok && cf.result.confirmacion.porId === U.ale && cf.result.confirmacion.pdfVersion === 2 && cf.result.confirmacion.evidencias.length === 1 && !!cf.result.confirmacion.en, cf.message);
const post1 = await api('ale', 'agrAdjuntarEvidencia', 'AGR-0001', { archivo: { path: 'facturas/AGR-0001/autorizacion-0001aaaa.png' } }), post2 = await api('ale', 'actualizarFactura', 'AGR-0001', { numeroFactura: 'F-999' });
T('C13 Confirmada, la agrupación y su evidencia quedan inmutables (no se reemplaza la evidencia ni se cambia el número)', !post1.ok && !post2.ok, [post1.code, post2.code]);

/* ---- 4. Facturación: recibe lo confirmado, no duplica ---- */
const sn = await api('fac', 'snapshot');
const ags = sn.snapshot.agrupaciones;
T('F1 Facturación recibe en su snapshot la MISMA agrupación AGR-0001 con viajes, número, PDF del cliente y evidencia; sin el PDF interno', ags.length === 1 && ags[0].id === 'AGR-0001' && ags[0].viajeIds.length === 2 && ags[0].pdfs.every(p => p.tipo === 'CLIENTE') && ags[0].evidenciasAutorizacion.length === 1 && !!ags[0].confirmacion, ags.map(x => [x.id, (x.pdfs || []).map(p => p.tipo + p.version)]));
const iniF = await api('fac', 'enviarFactura', 'AGR-0001');
T('F2 Facturación inicia la facturación (fase ENVIADA); los 2 viajes quedan FACTURADO y la agrupación conserva número e importes', iniF.ok && iniF.result.fase === 'ENVIADA' && (await q1("select count(*)::int n from master.viajes where agrupacion_id='AGR-0001' and estado='FACTURADO'"))[0].n === 2 && iniF.result.numeroFactura === 'F-100', iniF.message);
const iniF2 = await api('fac', 'enviarFactura', 'AGR-0001');
T('F3 No se factura dos veces la misma agrupación', !iniF2.ok && iniF2.code === 'ESTADO_INVALIDO', iniF2);
const prepF = await prep('fac', [d4], 'F-200'), prepA = await prep('ale', [a], 'F-201');
T('F4 Facturación no puede crear agrupaciones y los viajes ya facturados no se vuelven a agrupar', !prepF.ok && prepF.code === 'SIN_PERMISO' && !prepA.ok && prepA.code === 'YA_FACTURADO', [prepF.code, prepA.code]);
T('F5 Facturación no puede anular el rechazo/confirmación ni descartar la agrupación confirmada (solo quien confirma)', !(await api('fac', 'anularAgrupacion', 'AGR-0001', 'Intento de Facturación')).ok);

/* ---- 5. Envío de la factura ≠ cobro ---- */
const cobroAntes = await api('fac', 'registrarCobro', 'AGR-0001', { monto: 100, fecha: '2032-01-20', referencia: 'DEP-0' });
T('G1 Enviar a facturación no es emitir ni cobrar: el cobro se rechaza mientras no exista la factura enviada con comprobante (SIN_FACTURA)', !cobroAntes.ok && cobroAntes.code === 'SIN_FACTURA', cobroAntes);
const emiSin = await api('fac', 'emitirFactura', 'AGR-0001', { fechaEmision: '2032-01-11', importe: 2600, evidencia: 'UUID-F100' });
T('G2 Registrar el envío exige el comprobante: sin archivo se rechaza (SIN_EVIDENCIA)', !emiSin.ok && emiSin.code === 'SIN_EVIDENCIA', emiSin);
await sube2('facturas/AGR-0001/envio-0001aaaa.png');
const emiNo = await api('ale', 'emitirFactura', 'AGR-0001', { fechaEmision: '2032-01-11', importe: 2600, evidencia: 'UUID-F100', archivo: { path: 'facturas/AGR-0001/envio-0001aaaa.png' } });
T('G3 El Analista no puede registrar el envío de la factura (servidor)', !emiNo.ok && emiNo.code === 'SIN_PERMISO', emiNo);
const emi = await api('fac', 'emitirFactura', 'AGR-0001', { fechaEmision: '2032-01-11', importe: 2600, evidencia: 'UUID-F100', archivo: { path: 'facturas/AGR-0001/envio-0001aaaa.png', nombre: 'envio.png' } });
const gE = (await q1("select fase, emision, cobros, extra from master.agrupaciones where id='AGR-0001'"))[0];
T('G4 Factura enviada: fase EMITIDA con usuario autenticado, fecha y comprobante; todavía SIN cobros (enviar ≠ cobrar)', emi.ok && gE.fase === 'EMITIDA' && gE.emision.porId === U.fac && !!gE.emision.archivoPath && !(gE.cobros || []).length, emi.message);
for (const q of ['ale', 'gco', 'fel', 'ped']) { const r = await api(q, 'registrarCobro', 'AGR-0001', { monto: 100, fecha: '2032-01-20', referencia: 'DEP-X' }); T(`G5 ${q} no puede marcar el cobro (servidor)`, !r.ok && r.code === 'SIN_PERMISO', r); }
await sube2('facturas/AGR-0001/cobro-0001aaaa.png');
const cob = await api('fac', 'registrarCobro', 'AGR-0001', { monto: 2600, fecha: '2032-01-25', referencia: 'DEP-100', archivo: { path: 'facturas/AGR-0001/cobro-0001aaaa.png', nombre: 'pago.png' } });
const gCr = (await q1("select cobros, extra from master.agrupaciones where id='AGR-0001'"))[0], gC = { ...gCr.extra, cobros: gCr.cobros };
T('G6 «Cobrado»: se guarda el cobro con usuario autenticado, fecha, referencia, comprobante y el historial con estado anterior y nuevo', cob.ok && gC.cobros.length === 1 && gC.cobros[0].porId === U.fac && gC.cobros[0].referencia === 'DEP-100' && !!gC.cobros[0].archivoPath && gC.historial.some(h => /obr/i.test(h.accion) && h.de && h.a), cob.message);

/* ---- 6. Historial y archivos anteriores permanecen disponibles ---- */
const hist = gC.historial.map(h => h.accion);
T('H1 El historial persistido en la base recorre el ciclo: creación, reportes, rechazo, nueva versión, evidencia, confirmación, facturación, envío y cobro, cada uno con su usuario', ['creada', 'Reporte interno', 'Reporte para el cliente generado (versión 1)', 'rechazó', 'versión 2', 'Evidencia de autorización', 'Cliente confirmó', 'Facturación recibió', 'enviada al cliente', 'Cobro'].every(r => hist.some(x => x.includes(r))) && gC.historial.every(h => h.por && h.porId && h.en), hist);
T('H2 El historial guarda el usuario autenticado de cada movimiento (identificadores de perfil, no nombres escritos)', new Set(gC.historial.map(h => h.porId)).size >= 2 && gC.historial.every(h => Object.values(U).includes(h.porId)));
const snA = await api('ale', 'snapshot'), snF = await api('fac', 'snapshot');
const gA = snA.snapshot.agrupaciones[0], gF = snF.snapshot.agrupaciones[0];
T('H3 Analista conserva las 2 versiones del PDF del cliente + el interno, el rechazo con su evidencia, la autorización y el comprobante, todos con enlace firmado', gA.pdfs.length === 3 && gA.pdfs.every(p => /firmado/.test(p.url)) && gA.rechazos.length === 1 && /firmado/.test(gA.rechazos[0].url) && /firmado/.test(gA.evidenciasAutorizacion[0].url) && /firmado/.test(gA.emision?.archivo) && /firmado/.test(gA.cobros[0]?.url), [gA.pdfs.length, gA.pdfs.map(p => p.url)]);
T('H4 Facturación ve la misma agrupación con los PDF del cliente (v1 y v2), el rechazo, la evidencia, su comprobante y el cobro; sin el PDF interno', gF.pdfs.length === 2 && gF.pdfs.every(p => p.tipo === 'CLIENTE') && gF.rechazos.length === 1 && gF.evidenciasAutorizacion.length === 1 && !!gF.emision?.archivo && gF.cobros.length === 1);
T('H5 Ningún archivo se eliminó del almacenamiento al avanzar de estado', (await q1("select count(*)::int n from storage.objects where name like 'facturas/AGR-0001/%'"))[0].n === 8, (await q1("select name from storage.objects where name like 'facturas/%' order by name")).map(r => r.name));
const aud = (await q1("select accion from master.auditoria where entidad='AGRUPACION' order by id")).map(r => r.accion);
T('H6 La bitácora de auditoría registra los hitos (PDF, evidencia, rechazo, Cliente confirmó)', ['Reporte PDF de agrupación generado', 'Evidencia de autorización del cliente adjuntada', 'Cliente rechazó el reporte de la agrupación', 'Cliente confirmó la agrupación'].every(x => aud.includes(x)), aud);

/* ---- 7. Tarifas en solo lectura ---- */
T('R1 Analista y Facturación reciben las tarifas en su snapshot (consulta)', snA.snapshot.tarifas.length >= 0 && Array.isArray(snF.snapshot.tarifas) && Array.isArray(snA.snapshot.tarifas));
const permT = async (rol, p) => (await q1('select habilitado from master.permisos where rol=$1 and permiso=$2', [rol, p]))[0]?.habilitado;
T('R2 Facturación tiene tarifas_ver y NO tarifas_crear / editar / desactivar (base de datos)', await permT('FACTURACION', 'tarifas_ver') === true && await permT('FACTURACION', 'tarifas_crear') !== true && await permT('FACTURACION', 'tarifas_editar') !== true && await permT('FACTURACION', 'tarifas_desactivar') !== true);
const tarW = await api('fac', 'guardarTarifa', { cliente: 'COLGATE', proyecto: 'COLGATE', ruta: r1.result.id, tarifa: 5000, vigenciaDesde: '2032-01-01' });
T('R3 Facturación no puede crear ni modificar tarifas aunque llame a la API directamente', !tarW.ok && ['SIN_PERMISO', 'OP_INVALIDA'].includes(tarW.code), tarW);

/* ---- 8. Archivos privados: permisos de Postgres (RLS/Storage) ---- */
const ver = async (q, n) => (await como(q, `select app.puede_ver_archivo('${n}') v`)).rows?.[0]?.v;
const sube = async (q, n) => (await como(q, `select app.puede_subir('${n}') v`)).rows?.[0]?.v;
T('S1 Ver archivos: el PDF interno solo lo ven Analista/Gerencia/Admin; el del cliente y los comprobantes también Facturación; Torre/Operativo/Validador nada', await ver('ale', ruta('interno-', '0001aaaa')) === true && await ver('fac', ruta('interno-', '0001aaaa')) !== true && await ver('fac', ruta('cliente-', '0001aaaa')) === true && await ver('fel', ruta('cliente-', '0001aaaa')) !== true && await ver('ped', ruta('cliente-', '0001aaaa')) !== true && await ver('mar', ruta('cliente-', '0001aaaa')) !== true);
await db.query(`insert into master.agrupaciones(id,cliente_id,modalidad,fase,viaje_ids,estado,extra) values ('AGR-9002','COLGATE','INDIVIDUAL','PREPARADA',array['x'],'ACTIVA','{}')`);
await db.query(`insert into master.agrupaciones(id,cliente_id,modalidad,fase,viaje_ids,estado,extra) values ('AGR-9003','COLGATE','INDIVIDUAL','PREPARADA',array['y'],'ACTIVA','{"confirmacion":{"porId":"x"}}')`);
T('S2 Subir: Analista sube reportes (interno-/cliente-) y evidencia solo a una agrupación en preparación SIN confirmar; Facturación no sube reportes ni autorizaciones', await sube('ale', 'facturas/AGR-9002/cliente-0003cccc.pdf') === true && await sube('ale', 'facturas/AGR-9002/autorizacion-0003cccc.png') === true && await sube('ale', 'facturas/AGR-9002/rechazo-0003cccc.png') === true && await sube('fac', 'facturas/AGR-9002/cliente-0003cccc.pdf') !== true && await sube('fac', 'facturas/AGR-9002/autorizacion-0003cccc.png') !== true && await sube('ale', 'facturas/AGR-9003/autorizacion-0003cccc.png') !== true);
T('S3 Subir: el comprobante de envío solo con la factura en fase ENVIADA y por Facturación; el de cobro con fase EMITIDA y permiso de cobro', await sube('fac', 'facturas/AGR-0001/envio-0009zzzz.png') !== true /* AGR-0001 ya está EMITIDA */ && await sube('fac', 'facturas/AGR-0001/cobro-0009zzzz.png') === true && await sube('ale', 'facturas/AGR-0001/cobro-0009zzzz.png') !== true);
T('S4 El bucket sigue privado', (await q1("select public from storage.buckets where id='evidencias'"))[0].public === false);
await db.close();

/* ============ Compatibilidad de la migración 035 ============ */
const intenta = async (lista) => { const x = await montar([...BASE, ...lista.slice(0, -1)]); try { await x.db.exec(sqlDe(lista[lista.length - 1])); return { ok: true, x }; } catch (e) { const n = (await x.db.query("select count(*)::int n from master.permisos where permiso in ('sec_analista','comercial_confirmar')")).rows[0].n; await x.db.close(); return { ok: false, msg: e.message, parciales: n }; } };
const idem = await montar([...BASE, '034_ordenes_compra.sql', '035_agrupaciones_flujo.sql']);
let reej = ''; try { await idem.db.exec(sqlDe('035_agrupaciones_flujo.sql')); await idem.db.exec(sqlDe('034_ordenes_compra.sql')); await idem.db.exec(sqlDe('035_agrupaciones_flujo.sql')); } catch (e) { reej = e.message; }
T('X1 La 035 se aplica sobre 001–034 y es re-ejecutable (también reaplicando la 034 y otra vez la 035)', reej === '', reej);
const defs = (await idem.q1("select pg_get_functiondef('app.puede_subir(text)'::regprocedure) d, pg_get_functiondef('app.puede_ver_archivo(text)'::regprocedure) v"))[0];
T('X2 La 035 conserva todas las ramas de almacenamiento anteriores (viajes, facturas, pagos, oc)', ['viajes', 'facturas', 'pagos', "'oc'"].every(k => defs.d.includes(k) && defs.v.includes(k)));
const pr = async (rol, p) => (await idem.q1('select 1 from master.permisos_prohibidos where rol=$1 and permiso=$2', [rol, p])).length === 1;
T('X3 Vetos de la 035: Facturación no agrupa ni confirma; Gerencia de Transporte, Torre, Operativo, Validador, Cobros, Pago OPL y Proyectos no confirman', await pr('FACTURACION', 'comercial_agrupar') && await pr('FACTURACION', 'comercial_confirmar') && (await Promise.all(['GERENTE_TRANSPORTE', 'TORRE', 'OPERATIVO', 'VALIDADOR', 'COBROS', 'PAGO_OPL', 'PROYECTOS'].map(r => pr(r, 'comercial_confirmar')))).every(Boolean));
T('X3b …y el veto anterior de cobros_registrar para Facturación se retira (Facturación cobra)', (await idem.q1("select 1 from master.permisos_prohibidos where rol='FACTURACION' and permiso='cobros_registrar'")).length === 0);
await idem.db.close();
const sin034 = await intenta(['035_agrupaciones_flujo.sql']);
T('X4 Aplicar la 035 sobre la base SIN la 034 falla (depende de app.oc_visible y de la tabla de OC): la 034 debe ir primero', sin034.ok === false, sin034.msg);
T('X4b Al fallar, la 035 no deja cambios a medias cuando se ejecuta como un solo archivo (atómica): ninguna fila de permisos nueva', sin034.parciales === 0, sin034.parciales);
if (sin034.ok) await sin034.x.db.close();
const solo034 = await montar([...BASE, '034_ordenes_compra.sql']);
await solo034.db.exec("insert into storage.buckets(id,name,public,file_size_limit) values ('evidencias','evidencias',false,3145728) on conflict do nothing");
const rr = await solo034.api('adm', 'registrarRuta', { codigo: 'COL-001', nombre: 'CP → Colgate 1', cliente: 'COLGATE', proyecto: 'COLGATE', origen: 'Ciudad', destino: 'Bodega' }); if (!rr.ok) console.log('RUTA', JSON.stringify(rr)); await solo034.db.exec("update master.rutas set estado='ACTIVA'");
const vv = await solo034.api('adm', 'crearViaje', { cliente: 'COLGATE', pilotoId: 'P-1', rutaId: rr.result.id, fechaPlan: '2031-12-29T14:30', shipment: 'S-1', opl: 'J&J', tipoViaje: 'ONE WAY', tipoCarga: 'TARIMAS', noCarga: '1', producto: 'P', placaArrastre: 'C-ARR-001', ...T10 });
await solo034.db.query(`update master.viajes set estado='ACEPTADO', liq_aprobada_en=now() where id=$1`, [vv.result.id]); await solo034.db.query(`insert into master.viajes_tarifa(viaje_id, tarifa_cliente) values ($1,1000)`, [vv.result.id]);
const gSin = await solo034.api('ale', 'prepararFactura', { cliente: 'COLGATE', viajeIds: [vv.result.id], serieFactura: 'A', numeroFactura: 'F-1', fechaFactura: '2032-01-10' });
const cSin = await solo034.api('ale', 'confirmarCliente', 'AGR-0001');
T('X5 Con la API nueva pero SIN la 035 en la base: el servidor no se cae y rechaza con SIN_PERMISO (los permisos de agrupar y confirmar los siembra la 035): hay que aplicar la 035 ANTES de usar el flujo nuevo', !gSin.ok && gSin.code === 'SIN_PERMISO' && !cSin.ok && cSin.code === 'SIN_PERMISO', [gSin.code, cSin.code]);
await solo034.db.close();

console.log(filas.join('\n'));
console.log(`\nTotal: ${ok} OK · ${mal} FAIL`);
process.exit(mal ? 1 : 0);
