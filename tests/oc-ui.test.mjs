/* Pruebas de la pantalla «Órdenes de Compra»: menú y acceso por perfil, filtros, selección, viajes pendientes de tarifa,
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
const como = (uid, vista) => { ev(`S.user=DB.usuarios.find(u=>u.id==='${uid}');S.form=null;S.edit=null;S.modal=null;S.cb=null;S.menu=false;S.navK='';S.tab={};S.sel=[];S.ocCli='';S.ocPcat='';S.ocSel=[];S.ocCols=[];S.ocPrevOn=false;go('${vista}')`); };
const boton = (t, sel = 'button') => [...d.querySelectorAll(sel)].find(b => txt(b) === t || txt(b).startsWith(t));
const toasts = () => [...d.querySelectorAll('#toasts .toast')].map(txt);
const V = J('__V');
const menuTxt = () => [...d.querySelectorAll('nav button')].map(txt);

T('U0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);

/* ---- Acceso por perfil ---- */
como('U-G', 'inicio');
T('U1 Gerencia Comercial ve «Órdenes de compra» en el menú (módulo Comercial)', menuTxt().some(t => /Órdenes de compra/.test(t)), menuTxt());
for (const [uid, rol] of [['U-T', 'Torre'], ['U-O', 'Operativo'], ['U-V', 'Validador'], ['U-P', 'Pago OPL']]) {
  como(uid, 'oc');
  T(`U2 ${rol} no entra a la sección (go('oc') lo devuelve a su inicio) y no la ve en el menú`, ev('S.view') !== 'oc' && !menuTxt().some(t => /Órdenes de compra/.test(t)), [ev('S.view'), menuTxt()]);
}
como('U-F', 'oc');
T('U3 Facturación entra a la sección en modo consulta: sin la pestaña «Preparar orden»', ev('S.view') === 'oc' && !boton('Preparar orden', '[role=tab]') && !!boton('Aceptadas', '[role=tab]'), [...d.querySelectorAll('[role=tab]')].map(txt));

/* ---- Preparar ---- */
como('U-G', 'oc');
T('P1 Gerencia Comercial abre la sección con la pestaña «Preparar orden» y el título ÓRDENES DE COMPRA', ev('S.view') === 'oc' && txt(d.querySelector('.pagehead h1')) === 'ÓRDENES DE COMPRA' && !!boton('Preparar orden', '[role=tab]'));
T('P2 Antes de elegir cliente y proyecto solo se pide elegirlos', /Elige el cliente y el proyecto/.test(txt(d.querySelector('#vb'))));
await cambia(d.querySelector('select[data-flt="ocCli"]'), 'COLGATE');
T('P3 Al elegir cliente aparecen solo sus proyectos', [...d.querySelectorAll('select[data-flt="ocPcat"] option')].map(o => o.textContent).join() === 'Selecciona el proyecto,COLGATE,COLGATE-B');
await cambia(d.querySelector('select[data-flt="ocPcat"]'), 'COLGATE');
const filasVisibles = () => [...d.querySelectorAll('#vb table.xl tbody tr')].filter(r => r.querySelector('[data-ocsel]'));
T('P4 La lista muestra solo viajes aceptados con tarifa válida (5), no los de otro proyecto/cliente', filasVisibles().length === 5 && !/SH-B2|SH-K|SH-PLAN/.test(txt(d.querySelector('#vb table'))), filasVisibles().map(txt));
const filaDe = ship => filasVisibles().find(r => txt(r).includes(ship));
T('P5 Cada fila muestra Semana ISO, fecha, hora, shipment, placa, tipo de unidad, estado y tarifa', /Semana 52 · 2031/.test(txt(filaDe('SH-A'))) && /2031-12-28/.test(txt(filaDe('SH-A'))) && /08:00/.test(txt(filaDe('SH-A'))) && /C-111AAA/.test(txt(filaDe('SH-A'))) && /10TON/.test(txt(filaDe('SH-A'))) && /Aceptado/.test(txt(filaDe('SH-A'))) && /Q 1,000\.00/.test(txt(filaDe('SH-A'))), txt(filaDe('SH-A')));
T('P6 Semana ISO en los límites de año: 29-dic-2031 y 4-ene-2032 = «Semana 01 · 2032»', /Semana 01 · 2032/.test(txt(filaDe('SH-B'))) && /Semana 01 · 2032/.test(txt(filaDe('SH-C'))), [txt(filaDe('SH-B')), txt(filaDe('SH-C'))]);
const pend = txt(d.querySelector('#vb .card'));
T('P7 Los viajes sin tarifa válida se listan aparte con «Viaje pendiente de asignación de tarifa»', /Viaje pendiente de asignación de tarifa \(4\)/.test(txt(d.querySelector('#vb'))) && ['SH-VAC', 'SH-CERO', 'SH-NEG', 'SH-RP'].every(s => txt(d.querySelector('#vb')).includes(s)));
T('P8 La lista de pendientes trae No. de viaje, Número de Transporte, cliente, proyecto y motivo', ['No. de viaje', 'Número de Transporte', 'Cliente', 'Proyecto', 'Motivo'].every(h => [...d.querySelectorAll('#vb th')].some(th => txt(th) === h)) && /no tiene tarifa de cobro asignada/.test(txt(d.querySelector('#vb'))) && /ruta del viaje no está activa/.test(txt(d.querySelector('#vb'))));
T('P9 Los viajes pendientes NO tienen casilla de selección', ![...d.querySelectorAll('#vb input[data-ocsel]')].some(c => [V.vacio, V.cero, V.neg, V.rutaPend].includes(c.dataset.ocsel)));
T('P10 El botón de generar está deshabilitado sin selección', boton('Generar orden de compra').disabled === true && boton('Vista previa').disabled === true);
for (const k of ['a', 'b', 'c', 'comb']) await cambia(d.querySelector(`input[data-ocsel="${V[k]}"]`), true);
T('P11 Al seleccionar se muestra la cuenta y el total (1000+1500+2000+1100 = Q 5,600.00)', /4 viaje\(s\) seleccionado\(s\)/.test(txt(d.querySelector('.exportbar'))) && /Q 5,600\.00/.test(txt(d.querySelector('.exportbar'))), txt(d.querySelector('.exportbar')));
T('P12 Gerencia Comercial tiene la casilla «combustible» (permiso propio de OC por defecto) y las demás opcionales', !!d.querySelector('input[data-occol="combustible"]') && !!d.querySelector('input[data-occol="ruta"]'));
await cambia(d.querySelector('input[data-occol="ruta"]'), true);
await click(boton('Vista previa'));
const prevHdr = [...d.querySelectorAll('#vb .card:last-of-type thead th')].map(txt);
T('P13 Vista previa: 8 columnas obligatorias + la opcional elegida, en el orden pedido', prevHdr.join('|') === 'Semana|Fecha planificada|Hora planificada|Shipment|Placa|Tipo de unidad|Estado|Tarifa de cobro|Ruta', prevHdr);
const prevTxt = txt(d.querySelector('#vb .card:last-of-type'));
T('P14 Vista previa: cliente, proyecto, cantidad de viajes y total; semana con año ISO', /COLGATE · COLGATE/.test(prevTxt) && /4 viaje\(s\)/.test(prevTxt) && /Total Q 5,600\.00/.test(prevTxt) && /Semana 52 · 2031/.test(prevTxt) && /Semana 01 · 2032/.test(prevTxt), prevTxt.slice(0, 300));

/* ---- Generar con PDF real ---- */
await click(boton('Generar orden de compra'));
await tick(900);
const oc = J('DB.ordenesCompra[0]');
T('G1 Se genera la orden OC-0001 con sus 4 viajes y total Q 5,600', !!oc && oc.id === 'OC-0001' && oc.lineas.length === 4 && oc.total === 5600, toasts());
T('G2 El PDF quedó guardado como versión 1 (PDF real, con huella; SHA-256 en navegador, la de respaldo en jsdom)', !!oc && oc.documentos.length === 1 && /^data:application\/pdf/.test(oc.documentos[0].data) && /^[a-f0-9]{8,64}$/.test(oc.documentos[0].hash), oc && oc.documentos.map(x => [x.version, x.hash, (x.data || '').slice(0, 30)]));
T('G3 Tras generar, la pantalla cambia a «Preparadas» y muestra la orden', ev("S.tab.oc") === 'PREPARADA' && /OC-0001/.test(txt(d.querySelector('#vb'))) && /Preparada/.test(txt(d.querySelector('#vb'))), txt(d.querySelector('#vb')).slice(0, 200));
/* texto del PDF */
const pdfTexto = (() => {
  const buf = Buffer.from(oc.documentos[0].data.split(',')[1], 'base64'); let out = '';
  const s = buf.toString('latin1'); const re = /stream\r?\n/g; let m;
  while ((m = re.exec(s))) { const ini = m.index + m[0].length, fin = s.indexOf('endstream', ini); if (fin < 0) break; try { out += zlib.inflateSync(buf.subarray(ini, fin)).toString('latin1') + '\n'; } catch (e) { /* no es contenido comprimido */ } re.lastIndex = fin; }
  return out;
})();
const enPdf = t => pdfTexto.includes(t);
T('G4 El PDF trae título, cliente, proyecto, identificador, usuario que lo preparó y total', ['Orden de compra', 'OC-0001', 'COLGATE', 'Gerente Comercial', '5,600.00'].every(enPdf), pdfTexto.slice(0, 400));
T('G5 El PDF trae las 8 columnas obligatorias y la opcional elegida (Ruta)', ['Semana', 'Fecha planificada', 'Hora planificada', 'Shipment', 'Placa', 'Tipo de unidad', 'Estado', 'Tarifa de cobro', 'Ruta'].every(enPdf));
T('G6 La semana del PDF coincide con la de la vista previa («Semana 52 · 2031», «Semana 01 · 2032»)', enPdf('Semana 52 \\267 2031') || enPdf('Semana 52 · 2031') || enPdf('Semana 52 \xb7 2031'), pdfTexto.match(/Semana[^)]{0,20}/g));
T('G7 El PDF trae shipments, placas y tarifas de los viajes', ['SH-A', 'SH-B', 'SH-C', 'SH-COMB', 'C-111AAA', 'C-222BBB', '1,000.00', '1,500.00', '2,000.00', '1,100.00'].every(enPdf));
T('G8 El PDF no incluye viajes que no se eligieron ni la columna de combustible', !enPdf('SH-VAC') && !enPdf('SH-COL') && !enPdf('Tarifa de combustible'));

/* ---- Envío desde la pantalla ---- */
await click(boton('Registrar envío'));
T('E1 «Registrar envío» abre la confirmación', /Registrar envío · OC-0001/.test(txt(d.querySelector('.dlg'))));
await click(boton('CONFIRMAR ENVÍO', '.dlg button'));
T('E2 El envío queda registrado (estado Enviada, usuario, notificación a Facturación)', J('DB.ordenesCompra[0].estado') === 'ENVIADA' && J('DB.ordenesCompra[0].envio.porId') === 'U-G' && J('DB.notificaciones').some(n => n.tipo === 'OC_ENVIADA' && n.destinatarios.includes('FACTURACION')), toasts());
await click(boton('Enviadas', '[role=tab]'));
T('E3 En «Enviadas» Comercial ve «Respuesta del cliente», «Corregir / nueva versión» y «Anular»; ya no hay aviso de función deshabilitada', !/todavía no está habilitado/.test(txt(d.querySelector('#vb'))) && !!boton('Respuesta del cliente') && !!boton('Corregir / nueva versión') && !!boton('Anular'));
await click(boton('Corregir / nueva versión'));
T('E3b «Corregir / nueva versión» pide el motivo obligatorio y explica que la orden se conserva', /Nueva versión de OC-0001/.test(txt(d.querySelector('.dlg'))) && /Reemplazada/.test(txt(d.querySelector('.dlg'))));
await click(boton('Cancelar', '.dlg button'));

/* ---- Facturación ---- */
como('U-F', 'oc');
await click(boton('Enviadas', '[role=tab]'));
T('F1 Facturación ve la orden enviada pero sin acciones de preparación', /OC-0001/.test(txt(d.querySelector('#vb'))) && !boton('Registrar envío') && !boton('Anular') && !boton('Preparar factura'));
ev("DB.ordenesCompra[0].estado='ACEPTADA'");      /* la respuesta del cliente aún no tiene responsable: se simula aquí */
como('U-F', 'oc'); await click(boton('Aceptadas', '[role=tab]'));
T('F2 Una orden aceptada muestra «Preparar factura» a Facturación', !!boton('Preparar factura'));
await click(boton('Preparar factura'));
await click(boton('PREPARAR FACTURA', '.dlg button'));
T('F3 Se prepara UNA factura vinculada a la orden con sus 4 viajes (flujo de Facturación existente)', J('DB.agrupaciones.length') === 1 && J('DB.agrupaciones[0].ocId') === 'OC-0001' && J('DB.agrupaciones[0].viajeIds.length') === 4 && J('DB.ordenesCompra[0].agrupacionId') === 'AGR-0001', toasts());
await tick(50);
T('F4 La orden muestra la factura asociada y deja de ofrecer «Preparar factura»', /AGR-0001/.test(txt(d.querySelector('#vb'))) && !boton('Preparar factura'));

console.log(filas.join('\n'));
console.log(`\nTotal: ${ok} OK · ${mal} FAIL`);
process.exit(mal ? 1 : 0);
