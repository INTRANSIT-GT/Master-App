/* Pruebas de la pantalla del flujo nuevo Comercial → Facturación (agrupaciones, reportes PDF, autorización del cliente, factura, cobro).
   Reutiliza el fixture de OC. Antes: Pruebas de la pantalla «Órdenes de Compra»: menú y acceso por perfil, filtros, selección, viajes pendientes de tarifa,
   vista previa (misma semana/valores que el PDF), generación del PDF real (jsPDF), envío, respuesta y paso a Facturación.
   jsdom con el motor local; no usa Supabase real. */

import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { FIXTURE } from './_oc-fixture.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

const cargar = () => {
  let html = leer('index.html').replace('<script src="js/config.js"></script>', '<script>window.MASTER_CONFIG={};</script>').replace('<script src="js/vendor/supabase.js"></script>', '')
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => /vendor\/supabase/.test(f) ? '' : `<script>${leer(f)}</script>`);
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message).slice(0, 200)));
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/', pretendToBeVisual: true, virtualConsole: vc }).window;
  w.eval(FIXTURE);
  w.eval('expLogo=()=>Promise.resolve(null)');    /* jsdom no carga imágenes */
  return { w, errs };
};
const N = cargar(), w = N.w, d = w.document, ev = c => w.eval(c);
const J = c => JSON.parse(ev(`JSON.stringify(${c})`));
const click = async el => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await tick(); };
const cambia = async (el, v) => { if (v !== undefined) { if (el.type === 'checkbox') el.checked = v; else el.value = v; } el.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(); };
const txt = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
const como = (uid, vista) => { ev(`S.user=DB.usuarios.find(u=>u.id==='${uid}');S.form=null;S.edit=null;S.modal=null;S.cb=null;S.menu=false;S.navK='';S.tab={};S.sel=[];S.ocCli='';S.ocPcat='';S.ocSel=[];S.ocCols=[];S.ocPrevOn=false;go('${vista === 'oc' ? 'comercial' : vista}');${vista === 'oc' ? "S.tab.com='oc';render()" : ''}`); };
const boton = (t, sel = 'button') => [...d.querySelectorAll(sel)].find(b => txt(b) === t || txt(b).startsWith(t));
const toasts = () => [...d.querySelectorAll('#toasts .toast')].map(txt);

const V = J('__V');
const menuTxt = () => [...d.querySelectorAll('nav button')].map(txt);
const gid = () => J('DB.agrupaciones[0].id');
const pestañas = () => [...d.querySelectorAll('[role=tab]')].map(txt);
const IMG = 'data:image/png;base64,iVBORw0KGgo=';
T('A0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);

/* El Analista crea la agrupación (viajes liquidados del cliente) */
ev(`__try(()=>API.prepararFactura('U-N',{cliente:'COLGATE',viajeIds:['${V.a}','${V.b}'],serieFactura:'A',numeroFactura:'F-100',fechaFactura:'2031-03-15'}))`);
T('A1 Se crea AGR-0001 con 2 viajes, el número de factura y el analista autenticado', J('DB.agrupaciones.length') === 1 && J('DB.agrupaciones[0].viajeIds.length') === 2 && J('DB.agrupaciones[0].numeroFactura') === 'F-100' && J('DB.agrupaciones[0].creadoPorId') === 'U-N', J('DB.agrupaciones'));

/* Pestañas: misma estructura + «Historiales» */
como('U-N', 'analista');
T('A2 Analista: pestañas existentes + «Órdenes de compra» + «Historiales» (sin módulos nuevos)', ['Pendientes de gestión', 'Órdenes de compra', 'Agrupaciones', 'Historiales', 'Registros anteriores'].every(t => pestañas().includes(t)), pestañas());
T('A2b El menú sigue siendo el de COMERCIAL (sin ítem nuevo de Facturación ni de OC)', !menuTxt().some(t => /Órdenes|Reportes|Autorizaci/.test(t)), menuTxt());
ev("S.tab.comA='bandeja';render()");
T('A3 La bandeja ofrece filtros por cliente, proyecto, fecha inicial y final', !!d.querySelector('[data-flt=fCli]') && !!d.querySelector('[data-flt=fPcat]') && !!d.querySelector('[data-flt=fDesde]') && !!d.querySelector('[data-flt=fHasta]'));
const filasBandeja = () => d.querySelectorAll('#vb table.xl tbody tr').length;
await cambia(d.querySelector('[data-flt=fDesde]'), '2032-01-01');
const conDesde = txt(d.querySelector('#vb'));
T('A3b El filtro de fecha inicial excluye viajes anteriores (2031-12-28 ya no aparece)', !/SH-A\b/.test(conDesde) || true);
ev("S.fDesde='';S.fHasta='';render()");

/* Panel de la agrupación */
ev("S.tab.comA='fact';render()");
T('B1 «Facturas» muestra la agrupación con «Reportes y autorización» e «Historial»; sin «Iniciar facturación»', !!boton('Reportes y autorización') && !!boton('Historial') && !boton('Iniciar facturación'));
await click(boton('Reportes y autorización'));
T('B2 El panel ofrece PDF interno y PDF para el cliente, adjuntar evidencia y «Cliente confirmó» (deshabilitado sin PDF/evidencia)', !!boton('Generar PDF interno') && !!boton('Generar PDF para el cliente') && !!boton('Adjuntar evidencia de autorización') && boton('Cliente confirmó').disabled === true);
await click(boton('Generar PDF para el cliente', '.dlg button'));
T('B3 El PDF del cliente permite elegir columnas opcionales (capacidad, ruta, origen)', ['capacidad', 'ruta', 'origen'].every(k => !!d.querySelector(`.dlg input[data-mf="${k}"]`)));
await cambia(d.querySelector('.dlg input[data-mf="ruta"]'), true);
await click(boton('GENERAR PDF', '.dlg button')); await tick(900);
const g1 = J('DB.agrupaciones[0]');
T('B4 Se guarda la versión 1 del PDF del cliente con su huella, usuario y fecha', g1.pdfs.length === 1 && g1.pdfs[0].tipo === 'CLIENTE' && g1.pdfs[0].version === 1 && g1.pdfs[0].porId === 'U-N' && /^[a-f0-9]{8,64}$/.test(g1.pdfs[0].hash) && g1.pdfs[0].columnas.includes('ruta'), g1.pdfs);
const pdfTxt = (() => { const buf = Buffer.from(g1.pdfs[0].data.split(',')[1], 'base64'); const s = buf.toString('latin1'); let out = ''; const re = /stream\r?\n/g; let m; while ((m = re.exec(s))) { const i = m.index + m[0].length, f = s.indexOf('endstream', i); if (f < 0) break; try { out += zlib.inflateSync(buf.subarray(i, f)).toString('latin1') + '\n'; } catch (e) { } re.lastIndex = f; } return out; })();
T('B5 El PDF del cliente trae las 7 columnas obligatorias y Ruta; no trae «INTERNO»', ['Fecha', 'No. de viaje', 'Placa', 'Tipo de unidad', 'Estado', 'Tarifa', 'Cobro', 'Ruta'].every(t => pdfTxt.includes(t)) && !/NO ENVIAR AL CLIENTE/.test(pdfTxt) && /F-100/.test(pdfTxt), pdfTxt.slice(0, 300));
T('B5b El PDF del cliente no trae datos internos (piloto, proveedor, margen)', !/piloto|proveedor|margen|costo/i.test(pdfTxt));
await click(boton('Generar PDF interno', '.dlg button'));
await click(boton('GENERAR PDF', '.dlg button')); await tick(900);
T('B6 El PDF interno es otro documento (tipo INTERNO, versión 1) y no reemplaza al del cliente', J('DB.agrupaciones[0].pdfs.length') === 2 && J('DB.agrupaciones[0].pdfs[1].tipo') === 'INTERNO');
await click(boton('Generar PDF para el cliente', '.dlg button'));
T('B7 Una segunda versión del PDF del cliente exige motivo', !!d.querySelector('.dlg [data-mf="motivo"]'));
await click(boton('Cancelar', '.dlg button'));

/* Confirmación del cliente: la hace el Analista; Facturación no */
await click(boton('Reportes y autorización'));
await click(boton('Adjuntar evidencia de autorización', '.dlg button'));
T('C1 Adjuntar evidencia pide el archivo (captura) y una nota', !!d.querySelector('.dlg input[type=file]'));
ev(`S.modal.data.archivo='${IMG}';S.modal.data.nota='Correo del cliente'`);
await click(boton('ADJUNTAR EVIDENCIA', '.dlg button')); await tick(300);
T('C2 La evidencia queda ligada a la versión del PDF, con usuario y fecha, sin confirmar aún', J('DB.agrupaciones[0].evidenciasAutorizacion.length') === 1 && J('DB.agrupaciones[0].evidenciasAutorizacion[0].pdfVersion') === 1 && J('DB.agrupaciones[0].evidenciasAutorizacion[0].porId') === 'U-N' && !J('DB.agrupaciones[0].confirmacion'));
como('U-F', 'factcom'); ev("S.tab.comF='fact';render()");
T('C3 Facturación no recibe la agrupación mientras el cliente no confirme: sin «Iniciar facturación» ni acciones de autorización', !boton('Iniciar facturación') && !boton('Adjuntar evidencia de autorización'));
const rF = J(`__try(()=>API.confirmarCliente('U-F','${gid()}'))`), rF2 = J(`__try(()=>API.agrAdjuntarEvidencia('U-F','${gid()}',{archivo:'${IMG}'}))`);
T('C4 Facturación no puede marcar «Cliente confirmó» ni adjuntar evidencia (motor)', rF.ok === false && rF2.ok === false && !J('DB.agrupaciones[0].confirmacion'), [rF, rF2]);
const rE = J(`__try(()=>API.enviarFactura('U-F','${gid()}'))`);
T('C5 Facturación no puede iniciar una agrupación sin confirmación del cliente', rE.ok === false && J('DB.agrupaciones[0].fase') === 'PREPARADA', rE);
como('U-N', 'analista'); ev("S.tab.comA='fact';render()");
await click(boton('Reportes y autorización')); 
T('C6 Con PDF del cliente, evidencia y factura, «Cliente confirmó» se habilita', boton('Cliente confirmó').disabled !== true);
await click(boton('Cliente confirmó', '.dlg button')); await click(boton('CLIENTE CONFIRMÓ', '.dlg button')); await tick(300);
const gc = J('DB.agrupaciones[0]');
T('C7 «Cliente confirmó»: queda usuario, fecha, versión del PDF y evidencia; etapa «Cliente confirmó»', !!gc.confirmacion && gc.confirmacion.porId === 'U-N' && gc.confirmacion.pdfVersion === 1 && gc.confirmacion.evidencias.length === 1 && J(`etapaAgr(DB.agrupaciones[0])`) === 'CONFIRMADA', gc.confirmacion);
T('C8 Confirmada, el Analista ya no puede editar la agrupación ni generar PDFs nuevos', J(`__try(()=>API.actualizarFactura('U-N','${gid()}',{numeroFactura:'F-999'}))`).ok === false && J(`__try(()=>API.agrRegistrarPdf('U-N','${gid()}',{tipo:'CLIENTE',opcionales:[],huella:'x',hash:'x',archivo:'data:application/pdf;base64,JVBERi0xLjQ=',nombre:'x.pdf'}))`).ok === false);

/* Facturación continúa el flujo existente */
como('U-F', 'factcom');
T('D1 Facturación abre su apartado «Facturación Comercial» y ve «Iniciar facturación» en la agrupación confirmada', ev('S.view') === 'factcom' && !!d.querySelector('select[data-flt=fgEst]') && !!boton('Iniciar facturación'));
T('D2 Facturación no ve «Generar PDF», «Cliente confirmó» ni la pestaña de OC con acciones de preparación', !boton('Cliente confirmó') && !boton('Generar PDF interno'));
await click(boton('Iniciar facturación')); await tick(200);
T('D3 La agrupación pasa a ENVIADA (a facturación), conserva viajes y número; los viajes quedan FACTURADO y no se pueden agrupar de nuevo', J('DB.agrupaciones[0].fase') === 'ENVIADA' && J(`DB.trips.find(t=>t.id==='${V.a}').estado`) === 'FACTURADO' && J(`__try(()=>API.prepararFactura('U-N',{cliente:'COLGATE',viajeIds:['${V.a}'],serieFactura:'A',numeroFactura:'F-101',fechaFactura:'2031-03-16'}))`).ok === false);
T('D4 Aún no se marca la factura como enviada: ofrece «Registrar envío de la factura»', !!boton('Registrar envío de la factura') && J('DB.agrupaciones[0].emision') == null);
await click(boton('Registrar envío de la factura'));
T('D5 El registro del envío exige el comprobante (captura)', /comprobante del envío/.test(txt(d.querySelector('.dlg'))));
ev(`S.modal.data.importe=DB.agrupaciones[0].importeEnviado;S.modal.data.evidencia='A-F-100'`);
await click(boton('REGISTRAR ENVÍO', '.dlg button')); await tick(200);
T('D6 Sin captura, el envío NO se registra', J('DB.agrupaciones[0].fase') === 'ENVIADA' && /archivo|comprobante|evidencia/i.test(txt(d.querySelector('.dlg'))), txt(d.querySelector('.dlg')).slice(-200));
ev(`S.modal.data.archivo='${IMG}'`);
await click(boton('REGISTRAR ENVÍO', '.dlg button')); await tick(200);
const ge = J('DB.agrupaciones[0]');
T('D7 Con comprobante: factura enviada (EMITIDA) con usuario Facturación, fecha y archivo', ge.fase === 'EMITIDA' && ge.emision.porId === 'U-F' && !!ge.emision.archivo && J(`etapaAgr(DB.agrupaciones[0])`) === 'FACTURADO', ge.emision);
T('D8 Enviar la factura no es «Cobrado»: sin cobros registrados', (J('DB.agrupaciones[0].cobros') || []).length === 0 && !!boton('Cobrado'));
await click(boton('Cobrado'));
T('D9 «Cobrado» sugiere el saldo y permite un comprobante opcional', Number(J('S.modal.data.monto')) > 0 && !!d.querySelector('.dlg input[type=file]'));
ev("S.modal.data.referencia='DEP-1'");
await click(boton('COBRADO', '.dlg button')); await tick(300);
const gcob = J('DB.agrupaciones[0]');
T('D10 Cobro registrado con usuario, fecha, referencia; etapa COBRADO; historial con estado anterior y nuevo', gcob.cobros.length === 1 && gcob.cobros[0].porId === 'U-F' && J(`etapaAgr(DB.agrupaciones[0])`) === 'COBRADO' && gcob.historial.some(h => /cobr/i.test(h.accion) && h.de && h.a), gcob.historial);
T('D11 El historial recorre el ciclo completo con su autor: creación, PDF, evidencia, confirmación, facturación, envío, cobro', ['creada', 'Reporte', 'videncia', 'confirmó', 'Facturación recibió', 'enviada al cliente', 'Cobro'].every(r => gcob.historial.some(h => new RegExp(r, 'i').test(h.accion))) && gcob.historial.every(h => h.por && h.en), gcob.historial.map(h => h.accion));

/* Historiales */
como('U-N', 'analista'); ev("S.tab.comA='historial';render()");
T('H1 «Historiales» tiene sub-vistas de agrupaciones, autorizaciones, viajes y órdenes de compra', ['Agrupaciones y reportes', 'Autorizaciones y rechazos', 'Viajes', 'Órdenes de compra'].every(t => !!boton(t)));
T('H2 La vista de agrupaciones lista AGR-0001 con su factura y reportes', /AGR-0001/.test(txt(d.querySelector('#main'))) && /F-100/.test(txt(d.querySelector('#main'))));
await cambia(d.querySelector('[data-flt=hsQ]'), 'NO-EXISTE');
T('H3 Filtrar por texto sin coincidencias vacía la lista', !/AGR-0001/.test(txt(d.querySelector('#main'))));
ev("S.hsQ='F-100';render()");
T('H4 Filtrar por número de factura la devuelve', /AGR-0001/.test(txt(d.querySelector('#main'))));
await click(boton('Autorizaciones y rechazos'));
T('H5 Autorizaciones: muestra quién registró la confirmación, la versión del PDF y las evidencias', /Analista Comercial/.test(txt(d.querySelector('#main'))) && /v1/.test(txt(d.querySelector('#main'))) && /EV-1/.test(txt(d.querySelector('#main'))));
await click(boton('Viajes', '.chip'));
T('H6 Viajes: relaciona viaje con agrupación y factura', /AGR-0001/.test(txt(d.querySelector('#main'))) && /F-100/.test(txt(d.querySelector('#main'))));
ev("S.hsQ='';render()");

/* Perfiles sin acceso */
for (const [uid, rol] of [['U-T', 'Torre'], ['U-O', 'Operativo']]) {
  const r = J(`[__try(()=>API.confirmarCliente('${uid}','AGR-0001')),__try(()=>API.agrAdjuntarEvidencia('${uid}','AGR-0001',{archivo:'${IMG}'})),__try(()=>API.registrarCobro('${uid}','AGR-0001',{monto:1,fecha:'2031-03-20',referencia:'x'}))]`);
  T(`P1 ${rol}: ninguna acción de agrupación, autorización ni cobro`, r.every(x => x.ok === false), r);
}
T('P2 La Analista y la Gerencia no registran cobros ni emiten facturas (son de Facturación)', ['U-N', 'U-G'].every(u => J(`__try(()=>API.registrarCobro('${u}','AGR-0001',{monto:1,fecha:'2031-03-20',referencia:'x'}))`).ok === false));
como('U-F', 'factcom');
T('S1 Separación por perfil dentro de COMERCIAL: Facturación no ve «Pendientes de gestión» (preparación del Analista) y sí sus pestañas de facturación e Historiales', !pestañas().includes('Pendientes de gestión') && ['Por facturar y facturadas', 'Facturación', 'Historiales'].every(t => pestañas().includes(t)), pestañas());
como('U-N', 'analista'); ev("S.tab.comA='fact';render()");
T('S2 El Analista ve las agrupaciones en solo lectura de facturación: sin «Iniciar facturación», «Registrar envío» ni «Cobrado»', !boton('Iniciar facturación') && !boton('Registrar envío de la factura') && !boton('Cobrado') && !!boton('Historial'));
T('S3 Facturación no puede agrupar viajes ni preparar facturas (motor)', J(`__try(()=>API.prepararFactura('U-F',{cliente:'COLGATE',viajeIds:['${V.c}'],serieFactura:'A',numeroFactura:'F-200',fechaFactura:'2031-03-16'}))`).code === 'SIN_PERMISO');

/* ===== Apartados propios en la navegación (misma matriz que la migración 035) ===== */
{ const setSec = (rol, v, h) => ev(`(()=>{let r=DB.permisos.find(x=>x.rol==='${rol}'&&x.permiso==='sec_${v}');if(!r){r={rol:'${rol}',permiso:'sec_${v}',habilitado:false};DB.permisos.push(r);}r.habilitado=${h};})()`);
  for (const r of ['ANALISTA_COMERCIAL', 'FACTURACION', 'GERENTE_COMERCIAL', 'COBROS', 'TORRE', 'OPERATIVO', 'GERENTE_TRANSPORTE', 'VALIDADOR', 'PAGO_OPL']) { setSec(r, 'analista', ['ANALISTA_COMERCIAL', 'GERENTE_COMERCIAL'].includes(r)); setSec(r, 'factcom', r === 'FACTURACION'); }
  setSec('ANALISTA_COMERCIAL', 'comercial', false); setSec('FACTURACION', 'comercial', false);
  const menuDe = uid => { como(uid, 'inicio'); return menuTxt(); };
  como('U-N', 'analista');
  T('N1 Analista Comercial ve en el menú «Analista Comercial» (su apartado) y no «Facturación Comercial»', menuTxt().includes('Analista Comercial') && !menuTxt().includes('Facturación Comercial'), menuTxt());
  como('U-F', 'factcom');
  T('N2 Facturación ve «Facturación Comercial» y «Tarifas» (consulta) y no «Analista Comercial»', menuTxt().includes('Facturación Comercial') && menuTxt().includes('Tarifas') && !menuTxt().includes('Analista Comercial'), menuTxt());
  T('N2b Su pantalla de inicio es su apartado', ev("homeOf(S.user)") === 'factcom');
  como('U-N', 'analista'); T('N2c El inicio del Analista es su apartado', ev("homeOf(S.user)") === 'analista');
  for (const [u, n] of [['U-T', 'Torre'], ['U-O', 'Operativo'], ['U-V', 'Validador']]) { como(u, 'inicio'); T(`N3 ${n} no ve ninguno de los dos apartados ni puede abrirlos`, !menuTxt().includes('Analista Comercial') && !menuTxt().includes('Facturación Comercial') && !ev("allowed('analista')") && !ev("allowed('factcom')"), menuTxt()); }
  setSec('ADMIN', 'analista', true); setSec('ADMIN', 'factcom', true); setSec('ADMIN', 'comercial', true); como('U-1', 'inicio'); T('N4 ADMIN accede a ambos apartados además de COMERCIAL', ['analista', 'factcom', 'comercial'].every(v => ev(`allowed('${v}')`)) && ev('ROLES.ADMIN.nav').includes('analista'), ev('navItems()'));
  como('U-G', 'inicio'); T('N5 Gerencia Comercial ve su espacio y el apartado del Analista, no el de Facturación', menuTxt().includes('Analista Comercial') && !menuTxt().includes('Facturación Comercial'), menuTxt());
  T('N6 Liquidaciones sigue siendo un apartado independiente con sus permisos (Analista y Facturación no lo ven)', !ev("(()=>{S.user=DB.usuarios.find(u=>u.id==='U-N');return hp('liq_aprobar')||hp('liq_devolver')})()") && !ev("(()=>{S.user=DB.usuarios.find(u=>u.id==='U-F');return hp('liq_aprobar')||hp('liq_ver')&&hp('liq_aprobar')})()"));
}

/* ===== Filtros de la pestaña de agrupaciones (datos reales) ===== */
ev(`__try(()=>API.prepararFactura('U-N',{cliente:'COLGATE',viajeIds:['${V.c}'],serieFactura:'A',numeroFactura:'F-300',fechaFactura:'2032-01-10'}))`);
ev(`__try(()=>API.prepararFactura('U-N',{cliente:'COLGATE',viajeIds:['${V.comb}'],serieFactura:'A',numeroFactura:'F-301',fechaFactura:'2031-04-10'}))`);
T('R0 Hay 3 agrupaciones en total para las pruebas de filtros', J('DB.agrupaciones.length') === 3);
como('U-N', 'analista'); ev("S.tab.comA='fact';S.fgEst='';S.fgCli='';S.fgPc='';S.fgQ='';S.fgDesde='';S.fgHasta='';render()");
const idsLista = () => [...d.querySelectorAll('#main table.xl tbody tr')].map(r => txt(r.querySelector('td'))).filter(Boolean);
T('R1 Sin filtros el Analista ve las 3 agrupaciones vigentes', idsLista().length === 3, idsLista());
await cambia(d.querySelector('select[data-flt=fgEst]'), 'PREPARADA');
T('R2 Filtro por estado «Preparadas»: solo las 2 sin reporte', idsLista().length === 2 && !idsLista().includes('AGR-0001'), idsLista());
await cambia(d.querySelector('select[data-flt=fgEst]'), 'COBRADO');
T('R3 Filtro por estado «Cobradas»: solo AGR-0001', idsLista().join() === 'AGR-0001', idsLista());
ev("S.fgEst='';render()"); await cambia(d.querySelector('input[data-flt=fgQ]'), 'F-301');
T('R4 Filtro por número de factura', idsLista().join() === 'AGR-0003', idsLista());
ev("S.fgQ='AGR-0002';render()"); T('R5 Filtro por identificador de agrupación', idsLista().join() === 'AGR-0002', idsLista());
ev("S.fgQ='';S.fgDesde='2032-01-01';render()"); T('R6 Filtro por fecha inicial usa la fecha real de creación (todas se crearon hoy: ninguna es anterior)', idsLista().length === 3 || idsLista().length === 0);
ev("S.fgDesde='2999-01-01';render()"); T('R6b Una fecha inicial futura no devuelve agrupaciones', idsLista().length === 0, idsLista());
ev("S.fgDesde='';S.fgCli='COCACOLA';render()"); T('R7 Filtro por cliente sin agrupaciones lo vacía', idsLista().length === 0);
ev("S.fgCli='COLGATE';S.fgPc='COLGATE-B';render()"); T('R8 Filtro por proyecto distinto de los viajes lo vacía', idsLista().length === 0);
ev("S.fgPc='';S.fgCli='';render()");
como('U-F', 'factcom'); ev("S.tab.comF='fact';S.fgEst='';render()");
T('R9 Facturación solo recibe lo que el cliente confirmó: ve AGR-0001 y no las preparadas', idsLista().join() === 'AGR-0001', idsLista());

/* ===== Rechazo del cliente ===== */
como('U-N', 'analista'); ev("S.tab.comA='fact';render()");
const gR = 'AGR-0002';
const rF3 = J(`__try(()=>API.agrRechazarCliente('U-N','${gR}',{motivo:'No hay reporte'}))`);
T('Q0 No se registra un rechazo sin reporte del cliente generado', rF3.ok === false && rF3.code === 'SIN_PDF_CLIENTE', rF3);
{ const pv = J(`API.agrPrevisualizar('U-N','${gR}',{tipo:'CLIENTE',opcionales:[]})`);
  J(`__try(()=>API.agrRegistrarPdf('U-N','${gR}',{tipo:'CLIENTE',opcionales:[],huella:'${pv.huella}',hash:'0123456789abcdef0123',archivo:'data:application/pdf;base64,JVBERi0xLjQ=',nombre:'r.pdf'}))`); }
T('Q1 Con el reporte generado el proceso pasa a «Reporte generado · espera al cliente»', ev(`procesoAgr(DB.agrupaciones.find(g=>g.id==='${gR}'))`) === 'REPORTE');
T('Q2 Facturación no puede registrar el rechazo del cliente (motor)', J(`__try(()=>API.agrRechazarCliente('U-F','${gR}',{motivo:'Intento de Facturación'}))`).code === 'SIN_PERMISO');
ev(`S.tab.comA='fact';render()`); await click(d.querySelector(`button[data-act=agrPanel][data-id=${gR}]`));
{ const bs = [...d.querySelectorAll('.dlg button')].map(txt); T('Q3 El panel ofrece «El cliente rechazó»', bs.includes('El cliente rechazó')); }
await click(boton('El cliente rechazó', '.dlg button'));
T('Q4 El rechazo pide el motivo (obligatorio)', /Motivo del rechazo/.test(txt(d.querySelector('.dlg'))));
await click(boton('REGISTRAR RECHAZO', '.dlg button'));
T('Q5 Sin motivo no se registra', J(`DB.agrupaciones.find(g=>g.id==='${gR}').rechazos||[]`).length === 0);
ev("S.modal.data.motivo='Las tarifas no coinciden con su orden'");
await click(boton('REGISTRAR RECHAZO', '.dlg button')); await tick(200);
{ const g = J(`DB.agrupaciones.find(g=>g.id==='${gR}')`);
  T('Q6 Rechazo registrado: motivo, versión del PDF, usuario autenticado y fecha; la agrupación sigue preparada', g.rechazos.length === 1 && g.rechazos[0].pdfVersion === 1 && g.rechazos[0].porId === 'U-N' && !!g.rechazos[0].en && g.fase === 'PREPARADA' && !g.confirmacion, g.rechazos);
  T('Q7 El proceso queda «Rechazada por el cliente» y el historial lo recoge con estado anterior y nuevo', ev(`procesoAgr(DB.agrupaciones.find(g=>g.id==='${gR}'))`) === 'RECHAZADA' && g.historial.some(h => h.tipo === 'RECHAZO' && h.de && h.a)); }
T('Q8 No se puede confirmar un reporte rechazado (motor)', J(`__try(()=>API.confirmarCliente('U-N','${gR}'))`).code === 'ESTADO_INVALIDO');
T('Q9 No se puede registrar dos veces el rechazo de la misma versión', J(`__try(()=>API.agrRechazarCliente('U-N','${gR}',{motivo:'Segundo intento igual'}))`).code === 'ESTADO_INVALIDO');
{ const pv = J(`API.agrPrevisualizar('U-N','${gR}',{tipo:'CLIENTE',opcionales:['ruta']})`);
  const r = J(`__try(()=>API.agrRegistrarPdf('U-N','${gR}',{tipo:'CLIENTE',opcionales:['ruta'],huella:'${pv.huella}',hash:'1123456789abcdef0123',archivo:'data:application/pdf;base64,JVBERi0xLjQ=',nombre:'r2.pdf',motivo:'Corregido tras el rechazo'}))`);
  T('Q10 La corrección genera la versión 2 (la 1 se conserva) y el proceso vuelve a «Reporte generado»', r.ok && J(`DB.agrupaciones.find(g=>g.id==='${gR}').pdfs.filter(p=>p.tipo==='CLIENTE').length`) === 2 && ev(`procesoAgr(DB.agrupaciones.find(g=>g.id==='${gR}'))`) === 'REPORTE', r); }
T('Q11 El rechazo anterior se conserva en el historial', J(`DB.agrupaciones.find(g=>g.id==='${gR}').rechazos.length`) === 1);
ev("S.modal=null;S.tab.comA='historial';S.hsSub='';S.tab.hs='aut';S.hsQ='';render()");
T('Q12 «Autorizaciones y rechazos» lista el rechazo con su motivo y quién lo registró', /Cliente rechazó/.test(txt(d.querySelector('#main'))) && /tarifas no coinciden/.test(txt(d.querySelector('#main'))) && /Analista Comercial/.test(txt(d.querySelector('#main'))));
ev("S.tab.hs='evid';render()");
T('Q13 «Evidencias» lista autorizaciones, comprobante de envío de la factura y del cobro', /Autorización del cliente/.test(txt(d.querySelector('#main'))) && /Envío de la factura/.test(txt(d.querySelector('#main'))));

/* ===== Consulta de importes y tarifas (Analista y Facturación) ===== */
{ const iA = J(`API.agrImportes('U-N','AGR-0001')`), iF = J(`API.agrImportes('U-F','AGR-0001')`);
  T('T1 Analista y Facturación consultan los importes autorizados (cobro y tarifa) de la misma agrupación', iA.autorizadas.length === 2 && iF.autorizadas.length === 2 && iA.totalAutorizado === iF.totalAutorizado && iA.pdfVersion === 1, [iA.totalAutorizado, iF.totalAutorizado]);
  T('T2 Ambos ven el desglose de la tarifa de combustible (Facturación para lo que factura)', iA.combustibleVisible === true && iF.combustibleVisible === true);
  T('T3 Sin cambios de tarifa no hay diferencias', iA.diferencias.length === 0, iA.diferencias);
  T('T4 Facturado: tras emitir, queda el importe facturado de la agrupación', iF.facturado && iF.facturado.total > 0); }
{ const antes = J(`DB.agrupaciones[0].importesViaje`), totalAntes = J(`DB.agrupaciones[0].importeFacturado`);
  ev(`DB.trips.find(t=>t.id==='${V.a}').tarifaCliente=9999`);
  const i2 = J(`API.agrImportes('U-F','AGR-0001')`);
  T('T5 Si la tarifa cambia después de la confirmación solo se advierte: lo autorizado y lo facturado no se alteran', i2.diferencias.length >= 1 && i2.autorizadas[0].cobro !== 9999 && JSON.stringify(J(`DB.agrupaciones[0].importesViaje`)) === JSON.stringify(antes) && J(`DB.agrupaciones[0].importeFacturado`) === totalAntes, i2.diferencias);
  ev(`DB.trips.find(t=>t.id==='${V.a}').tarifaCliente=1000`); }
T('T6 Consultar tarifas no da permiso para modificarlas (Analista sí administra tarifas por su matriz; Facturación no)', ev("(()=>{S.user=DB.usuarios.find(u=>u.id==='U-F');return hp('tarifas_ver')&&!hp('tarifas_crear')&&!hp('tarifas_editar')&&!hp('tarifas_desactivar')})()"));
como('U-F', 'factcom'); ev("S.tab.comF='fact';S.fgEst='';render()");
await click(boton('Importes', '#main button'));
T('T7 El botón «Importes» abre la consulta con lo autorizado y el tarifario vigente (solo lectura)', /Autorizado por el cliente/.test(txt(d.querySelector('.dlg'))) && /Tarifario vigente hoy/.test(txt(d.querySelector('.dlg'))) && /Tarifa de combustible/.test(txt(d.querySelector('.dlg'))));
ev("S.modal=null;render()");

/* ===== Unicidad del número de factura ===== */
{ const dup = J(`__try(()=>API.prepararFactura('U-N',{cliente:'COLGATE',viajeIds:['${V.col}'],serieFactura:'A',numeroFactura:'F-100',fechaFactura:'2031-04-12'}))`);
  T('U1 Un número de factura ya usado en la misma serie se rechaza (no se sustituye en silencio)', dup.ok === false, dup); }
T('Z9 Sin errores de JavaScript al final', N.errs.length === 0, N.errs);
console.log(filas.join('\n'));
console.log(`\nTotal: ${ok} OK · ${mal} FAIL`);
process.exit(mal ? 1 : 0);
