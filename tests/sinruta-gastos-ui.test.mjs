/* Pruebas de la INTERFAZ (jsdom, motor local con datos de ejemplo; no usa Supabase real): botón SIN RUTA, Gastos adicionales y etiqueta «Cantidad de carga». */


import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); };
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

const FIXTURE = `
(()=>{
  DB=blankDB();CAT.opl.push('INTRANSIT','J&J');CAT.tipoViaje.push('ONE WAY');CAT.tipoCarga.push('KG','TARIMAS');CAT.tipoUnidad.push('10TON');CAT.origen.push('CP');
  const U=(id,usuario,nombre,rol)=>({id,usuario,clave:'x',nombre,rol,activo:true,proyectos:[]});
  DB.usuarios.push(U('U-1','admin','Admin Master','ADMIN'),U('U-T','torre','Felipe Torre','TORRE'),U('U-F','fact','Alejandra Facturación','FACTURACION'),U('U-O','oper','Pedro Operativo','OPERATIVO'),U('U-C','cobros','Conta Cobros','COBROS'),U('U-G','gtr','Gerente Transporte','GERENTE_TRANSPORTE'));
  Object.keys(ROLES).forEach(r=>PERM_KEYS.forEach(p=>{DB.permisos.push({rol:r,permiso:p,habilitado:r==='ADMIN'?true:((PERM_DEFAULT[r]||[]).includes(p)&&!((PROHIBIDO[r]||[]).includes(p)))});}));
  const cl=(id,n,pr,torre)=>({id,nombre:n,cliente:n.toUpperCase(),proyectos:pr,torreEstatus:!!torre,activo:true,nit:'',direccionFiscal:'',correoFacturacion:'',contacto:'',telefono:'',creditoDias:'',observaciones:''});
  DB.clientes.push(cl('COLGATE','Colgate',['COLGATE'],false),cl('COCACOLA','Coca-Cola',['COCACOLA'],true));
  DB.acceso.push({userId:'U-O',cliente:'COLGATE'});
  const ruta=(id,cod,nom,cli,o,d)=>({id,codigo:cod,nombre:nom,cliente:cli,proyecto:cli,origenId:o,destinoId:d,estado:'ACTIVA',origenProp:'',destinoProp:'',fuente:'CATALOGO',solicitadaPorId:'U-1',solicitadaPor:'Admin',solicitadaEn:'2026-01-01T00:00:00.000Z',validadaPor:'',validadaEn:'',rechazo:null,viajeRef:''});
  DB.rutas.push(ruta('R-0001','COL-001','CP → Mayorista','COLGATE','CP','D-1'),ruta('R-0002','COCA-001','CP → Central','COCACOLA','CP','D-K'));
  PILOTOS.length=0;PILOTOS.push({id:'P-1',nombre:'Piloto Uno',unidad:'T-1',proyecto:'COLGATE'},{id:'P-2',nombre:'Piloto Dos',unidad:'T-2',proyecto:'COLGATE'},{id:'P-3',nombre:'Piloto Tres',unidad:'T-3',proyecto:'COLGATE'},{id:'P-4',nombre:'Piloto Cuatro',unidad:'T-4',proyecto:'COCACOLA'});
  FLOTA.length=0;FLOTA.push({unidad:'T-1',placa:'C-111AAA',tango:'1',capacidad:'10 Ton',tipo:'10TON'},{unidad:'T-2',placa:'C-222BBB',tango:'2',capacidad:'10 Ton',tipo:'10TON'},{unidad:'T-3',placa:'C-333CCC',tango:'3',capacidad:'10 Ton',tipo:'10TON'},{unidad:'T-4',placa:'C-444DDD',tango:'4',capacidad:'10 Ton',tipo:'10TON'});
  DESTINOS.length=0;DESTINOS.push({id:'D-1',nombre:'Mayorista',proyecto:'COLGATE'},{id:'D-K',nombre:'Central',proyecto:'COCACOLA'});
  syncRefs();
  const b={cliente:'COLGATE',proyectoCat:'COLGATE',pilotoId:'P-1',rutaId:'R-0001',shipment:'S',opl:'INTRANSIT',tipoViaje:'ONE WAY',tipoCarga:'KG',noCarga:'1',producto:'P',placaArrastre:'PA-1'};
  window.__K=API.crearViaje('U-1',Object.assign({},b,{cliente:'COCACOLA',proyectoCat:'COCACOLA',pilotoId:'P-4',rutaId:'R-0002',fechaPlan:'2031-02-01T08:00',shipment:'K-1',tIngresoPlanta:'2031-02-01T08:10'})).id;
  window.__C=API.crearViaje('U-1',Object.assign({},b,{pilotoId:'P-3',fechaPlan:'2031-02-09T08:00',shipment:'C-0'})).id;
  window.__A=[1,2,3].map(i=>API.crearViaje('U-1',Object.assign({},b,{pilotoId:['P-1','P-2','P-3'][i-1],fechaPlan:'2031-03-0'+i+'T08:00',shipment:'F-'+i})).id);
  window.__D=API.crearViaje('U-1',Object.assign({},b,{cliente:'COCACOLA',proyectoCat:'COCACOLA',pilotoId:'P-4',rutaId:'R-0002',fechaPlan:'2031-03-05T08:00',shipment:'K-2'})).id;
  /* viajes de facturación: aceptados con liquidación aprobada y tarifa (fixture; en la app real llegan por el flujo de liquidación) */
  [...window.__A,window.__D].forEach(id=>{const t=DB.trips.find(x=>x.id===id);t.estado='ACEPTADO';t.liqAprobadaEn='2031-03-10T10:00:00.000Z';t.tarifaCliente=4800;});
})();`;
const cargar = () => {
  let html = leer('index.html').replace('<script src="js/config.js"></script>', '<script>window.MASTER_CONFIG={};</script>').replace('<script src="js/vendor/supabase.js"></script>', '')
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => /vendor\/(jspdf|supabase)/.test(f) ? '' : `<script>${leer(f)}</script>`);
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message).slice(0, 200)));
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/', pretendToBeVisual: true, virtualConsole: vc }).window;
  w.eval(FIXTURE); return { w, errs };
};
const N = cargar(), w = N.w, d = w.document, ev = c => w.eval(c);
const click = async el => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await tick(); };
const escribe = async (el, v) => { if (!el) return; el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(); };
const txt = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
const como = (uid, vista) => { ev(`S.user=DB.usuarios.find(u=>u.id==='${uid}');S.form=null;S.edit=null;S.modal=null;S.cb=null;S.menu=false;S.navK='';S.tab={};S.sel=[];S.fCom='PEND';S.fCli='';S.fPcat='';S.q='';go('${vista}')`); };
const boton = (t, sel = 'button') => [...d.querySelectorAll(sel)].find(b => txt(b) === t || txt(b).startsWith(t));
const trip = id => JSON.parse(ev(`JSON.stringify(DB.trips.find(t=>t.id==='${id}'))`));

const toasts = () => [...d.querySelectorAll('#toasts .toast')].map(txt);
T('U0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);
const nueva = (uid = 'U-O') => { como(uid, 'nuevo'); };
nueva();
let f = txt(d.body);
T('U1 El formulario dice «Cantidad de carga» y ya no «No. de carga»', /Cantidad de carga/.test(f) && !/No\. de carga/i.test(f), (f.match(/.{20}carga.{20}/gi) || []).slice(0, 4));
T('U2 El campo sigue ligado a noCarga', !!d.querySelector('#m_noCarga'));
T('U3 Botón SIN RUTA visible en el formulario', !!boton('SIN RUTA'));
T('U4 Sección «Gastos adicionales» dentro de Retorno y viáticos', /Retorno y vi[aá]ticos/.test(f) && /Gastos adicionales/.test(f));
/* Elegir cliente / placa / piloto */
ev("S.form.proyecto='COLGATE';S.form.proyectoCat='COLGATE';render()");
await click(boton('SIN RUTA'));
T('U5 Al pulsar SIN RUTA queda activado (aria-pressed) y se avisa en pantalla', ev('S.form.sinRuta') === true && boton('SIN RUTA').getAttribute('aria-pressed') === 'true' && /Viaje SIN RUTA/.test(txt(d.body)), ev('S.form.sinRuta'));
await click(boton('SIN RUTA'));
T('U6 Pulsarlo otra vez lo desactiva', ev('S.form.sinRuta') === false);
await click(boton('SIN RUTA'));
/* Gastos: agregar, revisar total, quitar */
await click(boton('+ Agregar gasto adicional')); await click(boton('+ Agregar gasto adicional'));
T('U7 Agregar crea filas de concepto + importe', d.querySelectorAll('[data-gasto$="|concepto"]').length === 2 && d.querySelectorAll('[data-gasto$="|importe"]').length === 2);
await escribe(d.querySelector('[data-gasto="0|concepto"]'), 'Pernocta'); await escribe(d.querySelector('[data-gasto="0|importe"]'), '150.50');
await escribe(d.querySelector('[data-gasto="1|concepto"]'), 'Peaje'); await escribe(d.querySelector('[data-gasto="1|importe"]'), '45');
const rs = txt(d.querySelector('#gastosResumen'));
T('U8 El resumen antes de guardar muestra ambos gastos y el total Q195.50', /Pernocta/.test(rs) && /Peaje/.test(rs) && /195\.50/.test(rs), rs);
await click(boton('Quitar')); 
T('U9 Quitar elimina la fila y actualiza el modelo', JSON.parse(ev('JSON.stringify(S.form.gastosAdicionales)')).length === 1);
await click(boton('+ Agregar gasto adicional'));
await escribe(d.querySelector('[data-gasto="1|concepto"]'), 'Peaje'); await escribe(d.querySelector('[data-gasto="1|importe"]'), '45');
/* Resto del formulario: fecha, ruta no se elige */
const fijar = async (id, v) => { const e = d.querySelector('#' + id); if (e) await escribe(e, v); };
await fijar('m_shipment', 'U-1'); await fijar('m_opl', 'INTRANSIT'); await fijar('m_tipoViaje', 'ONE WAY'); await fijar('m_tipoCarga', 'KG'); await fijar('m_noCarga', '9'); await fijar('m_producto', 'Prod'); await fijar('m_placaArrastre', 'PA-1');
ev(`S.form.pilotoId='P-1';S.form.placaSel='T-1';S.form.proyectoCat='COLGATE';render()`);
const nAntes = ev('DB.trips.length');
await click(boton('GUARDAR VIAJE'));
const err = ev('S.form.err');
T('U10 Con SIN RUTA el formulario guarda (sin el error «Falta Ruta»)', ev('DB.trips.length') === nAntes + 1 && !/Falta Ruta/.test(err || ''), err);
const id = ev('S.form.savedId'); const t = trip(id);
T('U11 El viaje queda con sinRuta=true, sin ruta y con los dos gastos y Cantidad de carga', t && t.sinRuta === true && !t.rutaId && t.gastosAdicionales.length === 2 && t.noCarga === '9', t && [t.sinRuta, t.rutaId, t.gastosAdicionales, t.noCarga]);
T('U12 Se creó exactamente una notificación a Gerencia', ev("DB.notificaciones.filter(n=>n.tipo==='VIAJE_SIN_RUTA').length") === 1);
T('U13 El aviso de confirmación aparece', toasts().some(x => /SIN RUTA/.test(x)), toasts());
/* Detalle */
como('U-1', 'detalle'); ev(`go('detalle','${id}')`); await tick();
const det = txt(d.querySelector('#main') || d.body);
T('U14 El detalle muestra «Registrado SIN RUTA», «Cantidad de carga» y los gastos', /SIN RUTA/.test(det) && /Cantidad de carga/.test(det) && /Peaje/.test(det) && /Gastos adicionales/.test(det) && !/No\. de carga/.test(det), ['SIN', /SIN RUTA/.test(det), 'cant', /Cantidad de carga/.test(det), 'pern', /Pernocta/.test(det), /Peaje/.test(det), /No\. de carga/.test(det)]);
/* Validación en pantalla de gasto incompleto */
nueva(); ev("S.form.proyecto='COLGATE';render()");
ev(`S.form.pilotoId='P-2';S.form.placaSel='T-2';S.form.proyectoCat='COLGATE';S.form.sinRuta=true;S.form.shipment='V';S.form.opl='INTRANSIT';S.form.tipoViaje='ONE WAY';S.form.tipoCarga='KG';S.form.noCarga='1';S.form.producto='P';S.form.placaArrastre='PA-2';S.form.gastosAdicionales=[{concepto:'Solo concepto',importe:''}];render()`);
const n2 = ev('DB.trips.length'); await click(boton('GUARDAR VIAJE'));
T('U15 Gasto sin importe: no guarda y muestra mensaje claro', ev('DB.trips.length') === n2 && /Gasto adicional 1/.test(ev('S.form.err')) && /importe/i.test(ev('S.form.err')), ev('S.form.err'));
/* Torre no ve gastos */
como('U-T', 'torre'); ev(`go('detalle','${id}')`); await tick();
T('U16 Torre no ve los gastos adicionales en el detalle', !/Pernocta|Gastos adicionales/.test(txt(d.querySelector('#main') || d.body)));
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
