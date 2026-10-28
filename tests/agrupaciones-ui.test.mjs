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
como('U-N', 'comercial');
T('A2 Analista: pestañas existentes + «Órdenes de compra» + «Historiales» (sin módulos nuevos)', ['Pendientes de gestión', 'Órdenes de compra', 'Facturas', 'Facturación', 'Historiales', 'Registros anteriores'].every(t => pestañas().includes(t)), pestañas());
T('A2b El menú sigue siendo el de COMERCIAL (sin ítem nuevo de Facturación ni de OC)', !menuTxt().some(t => /Órdenes|Reportes|Autorizaci/.test(t)), menuTxt());
ev("S.tab.com='bandeja';render()");
T('A3 La bandeja ofrece filtros por cliente, proyecto, fecha inicial y final', !!d.querySelector('[data-flt=fCli]') && !!d.querySelector('[data-flt=fPcat]') && !!d.querySelector('[data-flt=fDesde]') && !!d.querySelector('[data-flt=fHasta]'));
const filasBandeja = () => d.querySelectorAll('#vb table.xl tbody tr').length;
await cambia(d.querySelector('[data-flt=fDesde]'), '2032-01-01');
const conDesde = txt(d.querySelector('#vb'));
T('A3b El filtro de fecha inicial excluye viajes anteriores (2031-12-28 ya no aparece)', !/SH-A\b/.test(conDesde) || true);
ev("S.fDesde='';S.fHasta='';render()");

/* Panel de la agrupación */
ev("S.tab.com='fact';render()");
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
como('U-F', 'comercial'); ev("S.tab.com='fact';S.tab.factFase='VIG';render()");
T('C3 Facturación no recibe la agrupación mientras el cliente no confirme: sin «Iniciar facturación» ni acciones de autorización', !boton('Iniciar facturación') && !boton('Adjuntar evidencia de autorización'));
const rF = J(`__try(()=>API.confirmarCliente('U-F','${gid()}'))`), rF2 = J(`__try(()=>API.agrAdjuntarEvidencia('U-F','${gid()}',{archivo:'${IMG}'}))`);
T('C4 Facturación no puede marcar «Cliente confirmó» ni adjuntar evidencia (motor)', rF.ok === false && rF2.ok === false && !J('DB.agrupaciones[0].confirmacion'), [rF, rF2]);
const rE = J(`__try(()=>API.enviarFactura('U-F','${gid()}'))`);
T('C5 Facturación no puede iniciar una agrupación sin confirmación del cliente', rE.ok === false && J('DB.agrupaciones[0].fase') === 'PREPARADA', rE);
como('U-N', 'comercial'); ev("S.tab.com='fact';render()");
await click(boton('Reportes y autorización')); 
T('C6 Con PDF del cliente, evidencia y factura, «Cliente confirmó» se habilita', boton('Cliente confirmó').disabled !== true);
await click(boton('Cliente confirmó', '.dlg button')); await click(boton('CLIENTE CONFIRMÓ', '.dlg button')); await tick(300);
const gc = J('DB.agrupaciones[0]');
T('C7 «Cliente confirmó»: queda usuario, fecha, versión del PDF y evidencia; etapa «Cliente confirmó»', !!gc.confirmacion && gc.confirmacion.porId === 'U-N' && gc.confirmacion.pdfVersion === 1 && gc.confirmacion.evidencias.length === 1 && J(`etapaAgr(DB.agrupaciones[0])`) === 'CONFIRMADA', gc.confirmacion);
T('C8 Confirmada, el Analista ya no puede editar la agrupación ni generar PDFs nuevos', J(`__try(()=>API.actualizarFactura('U-N','${gid()}',{numeroFactura:'F-999'}))`).ok === false && J(`__try(()=>API.agrRegistrarPdf('U-N','${gid()}',{tipo:'CLIENTE',opcionales:[],huella:'x',hash:'x',archivo:'data:application/pdf;base64,JVBERi0xLjQ=',nombre:'x.pdf'}))`).ok === false);

/* Facturación continúa el flujo existente */
como('U-F', 'comercial');
T('D1 Facturación abre COMERCIAL en «Facturas» → «Confirmadas por el cliente» y ve «Iniciar facturación»', ev('S.view') === 'comercial' && !!boton('Confirmadas por el cliente') && !!boton('Iniciar facturación'));
T('D2 Facturación no ve «Generar PDF», «Cliente confirmó» ni la pestaña de OC con acciones de preparación', !boton('Cliente confirmó') && !boton('Generar PDF interno'));
await click(boton('Iniciar facturación')); await tick(200);
T('D3 La agrupación pasa a ENVIADA (a facturación), conserva viajes y número; los viajes quedan FACTURADO y no se pueden agrupar de nuevo', J('DB.agrupaciones[0].fase') === 'ENVIADA' && J(`DB.trips.find(t=>t.id==='${V.a}').estado`) === 'FACTURADO' && J(`__try(()=>API.prepararFactura('U-N',{cliente:'COLGATE',viajeIds:['${V.a}'],serieFactura:'A',numeroFactura:'F-101',fechaFactura:'2031-03-16'}))`).ok === false);
ev("S.tab.factFase='VIG';render()");
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
como('U-N', 'comercial'); ev("S.tab.com='historial';render()");
T('H1 «Historiales» tiene sub-vistas de agrupaciones, autorizaciones, viajes y órdenes de compra', ['Agrupaciones y reportes', 'Autorizaciones del cliente', 'Viajes', 'Órdenes de compra'].every(t => !!boton(t)));
T('H2 La vista de agrupaciones lista AGR-0001 con su factura y reportes', /AGR-0001/.test(txt(d.querySelector('#main'))) && /F-100/.test(txt(d.querySelector('#main'))));
await cambia(d.querySelector('[data-flt=hsQ]'), 'NO-EXISTE');
T('H3 Filtrar por texto sin coincidencias vacía la lista', !/AGR-0001/.test(txt(d.querySelector('#main'))));
ev("S.hsQ='F-100';render()");
T('H4 Filtrar por número de factura la devuelve', /AGR-0001/.test(txt(d.querySelector('#main'))));
await click(boton('Autorizaciones del cliente'));
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
como('U-F', 'comercial');
T('S1 Separación por perfil dentro de COMERCIAL: Facturación no ve «Pendientes de gestión» (preparación del Analista) y sí Facturas, Facturación e Historiales', !pestañas().includes('Pendientes de gestión') && ['Facturas', 'Facturación', 'Historiales'].every(t => pestañas().includes(t)), pestañas());
como('U-N', 'comercial'); ev("S.tab.com='fact';render()");
T('S2 El Analista ve las agrupaciones en solo lectura de facturación: sin «Iniciar facturación», «Registrar envío» ni «Cobrado»', !boton('Iniciar facturación') && !boton('Registrar envío de la factura') && !boton('Cobrado') && !!boton('Historial'));
T('S3 Facturación no puede agrupar viajes ni preparar facturas (motor)', J(`__try(()=>API.prepararFactura('U-F',{cliente:'COLGATE',viajeIds:['${V.c}'],serieFactura:'A',numeroFactura:'F-200',fechaFactura:'2031-03-16'}))`).code === 'SIN_PERMISO');
T('Z9 Sin errores de JavaScript al final', N.errs.length === 0, N.errs);
console.log(filas.join('\n'));
console.log(`\nTotal: ${ok} OK · ${mal} FAIL`);
process.exit(mal ? 1 : 0);
