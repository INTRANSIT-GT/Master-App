/* Pruebas de la INTERFAZ (jsdom, motor local con datos de ejemplo; no usa Supabase real): etiquetas «Ingreso a planta/bodega» y Torre de Control sin importes. */


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
const escribe = async (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); el.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(); };
const txt = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
const como = (uid, vista) => { ev(`S.user=DB.usuarios.find(u=>u.id==='${uid}');S.form=null;S.edit=null;S.modal=null;S.cb=null;S.menu=false;S.navK='';S.tab={};S.sel=[];S.fCom='PEND';S.fCli='';S.fPcat='';S.q='';go('${vista}')`); };
const boton = (t, sel = 'button') => [...d.querySelectorAll(sel)].find(b => txt(b) === t || txt(b).startsWith(t));
const trip = id => JSON.parse(ev(`JSON.stringify(DB.trips.find(t=>t.id==='${id}'))`));
const K = ev('window.__K'), C = ev('window.__C'), A = JSON.parse(ev('JSON.stringify(window.__A)')), D = ev('window.__D');
const toasts = () => [...d.querySelectorAll('#toasts .toast')].map(txt);

T('I0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);
/* importes reales en el viaje de Coca-Cola (en los datos, no en pantalla) */
ev(`(()=>{const t=DB.trips.find(x=>x.id===window.__K);t.tarifaCliente=4800.55;t.tarifaOpl=3100.25;t.costoProveedor=2900.1;t.qViaticos=350.75;})()`);
const DINERO = /4,?800|3,?100|2,?900|350\.75|Q\s?\d|Tarifa|Costo proveedor|Vi[aá]ticos|Margen|Importes del viaje/i;
const paginas = [];
como('U-T', 'torre');
paginas.push(['Torre · Viajes y estado', txt(d.querySelector('#main') || d.body)]);
await click(boton('Horarios y fechas', '.chip')); ev("S.tab.torre='todos';render()");
paginas.push(['Torre · Horarios y fechas', txt(d.querySelector('#main') || d.body)]);
await click([...d.querySelectorAll('#tablaHorarios [data-act="torreHorOpen"]')][0]);
paginas.push(['Torre · ventana Editar horarios', txt(d.querySelector('[role="dialog"]'))]);
await click(boton('Cancelar', '.dlg button'));
ev(`go('detalle','${K}')`); await tick();
const detT = txt(d.querySelector('#main') || d.body);
paginas.push(['Torre · detalle del viaje', detT]);
T('I1 Torre ve el detalle operativo del viaje (cliente, ruta, horarios, estado)', /Coca/i.test(detT) && /Ingreso a planta/.test(detT) && /Planificado/i.test(detT), detT.slice(0, 200));
for (const [n, t] of paginas) T(`I2 «${n}» no muestra importes, tarifas, costos ni viáticos`, !DINERO.test(t), (t.match(DINERO) || [])[0]);
const pagT = ev('JSON.stringify(Object.keys(API.viaje("U-T","' + K + '")).filter(k=>/tarifa|costo|viatic|ajuste|precio/i.test(k)))');
T('I3 El viaje que obtiene la interfaz de Torre no contiene campos de dinero', pagT === '[]', pagT);
const accion = await ev(`(async()=>{try{await API.torreMoverEstado('U-T','${K}','EN_RUTA');return 1}catch(e){return e.message}})()`);
const rr = JSON.parse(ev(`JSON.stringify(DB.trips.find(x=>x.id==='${K}').estado)`));
T('I4 Torre sigue pudiendo cambiar el estatus (En ruta) sin acceso a importes', rr === '"EN_RUTA"' || rr === 'EN_RUTA', [accion, rr]);
T('I5 Torre no tiene permisos de dinero y no puede concedérselos', ['finanzas_ver', 'tarifas_ver', 'comercial_ver', 'tarifas_opl_ver', 'tablero_ver', 'catalogos_ver'].every(p => !ev(`hp('${p}')`)) && ['finanzas_ver', 'tarifas_ver', 'comercial_ver', 'tarifas_opl_ver', 'tablero_ver', 'catalogos_ver'].every(p => ev(`PROHIBIDO.TORRE.includes('${p}')`)));

/* ===== Administradora ===== */
como('U-1', 'torre'); ev(`go('detalle','${K}')`); await tick();
const detA = txt(d.querySelector('#main') || d.body);
T('I6 La administradora sigue viendo «Importes del viaje» con tarifa, costo y viáticos', /Importes del viaje/.test(detA) && /4,?800\.55/.test(detA) && /2,?900\.10/.test(detA) && /350\.75/.test(detA), (detA.match(/Importes del viaje.{0,300}/) || [''])[0]);
/* ===== Gerencia (Transporte) conserva lo que veía ===== */
ev(`DB.usuarios.push({id:'U-GC',usuario:'gc',clave:'x',nombre:'Gerente C',rol:'GERENTE_COMERCIAL',activo:true,proyectos:[]})`);
como('U-GC', 'comercial'); ev(`go('detalle','${K}')`); await tick();
const detG = txt(d.querySelector('#main') || d.body);
T('I7 Gerencia Comercial ve la tarifa del cliente igual que antes', /4,?800\.55/.test(detG), [ev("hp('comercial_ver')"), ev('S.user.rol'), detG.includes('Importes')]);

/* ===== Etiquetas ===== */
como('U-1', 'nuevo'); await tick();
const form = txt(d.querySelector('#main') || d.body);
T('I8 Nuevo viaje muestra «Ingreso a planta» e «Ingreso a bodega» (sin CP ni CG)', /Ingreso a planta/.test(form) && /Ingreso a bodega/.test(form) && !/Ingreso a planta CP|Ingreso a bodega CG/.test(form), form.match(/Ingreso a [a-z]+( C[PG])?/g));
const campos = JSON.parse(ev('JSON.stringify([...document.querySelectorAll("[data-mf],[data-f],input,select")].map(e=>e.id||e.name||e.dataset.mf||"").filter(x=>/tIngresoPlanta|tIngresoBodega/.test(x)))'));
T('I9 Los campos conservan su nombre interno (tIngresoPlanta, tIngresoBodega)', campos.some(x => /tIngresoPlanta/.test(x)) && campos.some(x => /tIngresoBodega/.test(x)), campos);
como('U-1', 'torre'); ev(`go('detalle','${K}')`); await tick();
T('I10 El detalle del viaje usa los mismos nombres', !/planta CP|bodega CG/.test(txt(d.querySelector('#main') || d.body)));
como('U-1', 'torre'); await click(boton('Horarios y fechas', '.chip')); ev("S.tab.torre='todos';render()");
T('I11 Torre/Horarios usa los mismos nombres en columnas', !/planta CP|bodega CG/.test(txt(d.querySelector('#tablaHorarios'))) && /Ingreso a bodega/.test(txt(d.querySelector('#tablaHorarios'))));
T('I12 Sin errores de JavaScript durante toda la prueba', N.errs.length === 0, N.errs);

/* Rendimiento: el resumen financiero recorre todo el histórico, así que debe ser LINEAL. Antes cada viaje
   buscaba sus pagos y su agrupación recorriendo las listas completas: con el volumen real (3.000 viajes al mes)
   la Edge Function se pasaba del límite de CPU (HTTP 546) y la gráfica no cargaba para los perfiles con finanzas. */
const tRend = JSON.parse(ev(`(() => {
  const estados = ['PLANIFICADO','EN_RUTA','ENTREGADO','LIQUIDADO','ACEPTADO','RECHAZADO','FACTURADO','COBRADO'];
  const ids = [];
  for (let i = 0; i < 6000; i++) {
    const id = 'R' + String(100000 + i); ids.push(id);
    DB.trips.push({ id, proyecto:'COLGATE', proyectoCat:'COLGATE', shipment:'S'+i, opl:'INTRANSIT', tipoViaje:'ONE WAY', tipoCarga:'KG', noCarga:'1', producto:'P', placaArrastre:'', fechaPlan:'2026-'+String(1+(i%12)).padStart(2,'0')+'-10T08:00', pilotoId:'P-1', unidadId:'T-1', rutaId:'R-0001', estado:estados[i%8], tarifaOpl:1000, costoProveedor:1000, qViaticos:200, tarifaCliente:4000, creadoPorId:'U-1', creadoPor:'Admin', creadoEn:'2026-01-01T08:00:00.000Z' });
  }
  for (let a = 0; a < 750; a++) DB.agrupaciones.push({ id:'AR'+a, cliente:'COLGATE', modalidad:'AGRUPADA', fase:a%3?'ENVIADA':'EMITIDA', viajeIds:ids.slice(a*8, a*8+8), numeroFactura:'F'+a, importeEnviado:40000, importeFacturado:a%3?null:40000, importesViaje:{}, viajesSinImporte:[], cobros:[], estado:'ACTIVA', creadoEn:'2026-01-05T08:00:00.000Z' });
  for (let p = 0; p < 2000; p++) DB.pagos.push({ id:'PG'+p, tipo:p%2?'PROVEEDOR':'PILOTO', viajeId:ids[(p*3)%6000], monto:150, fecha:'2026-02-10', referencia:'REF'+p, anulado:null });
  const t0 = performance.now(); const R = API.resumenFinanciero('U-1', {}); const ms = performance.now() - t0;
  return JSON.stringify({ ms: Math.round(ms), ok: !!R.M, viajes: R.tripRows.length });
})()`));
T('I13 El resumen financiero con 6.000 viajes es lineal (antes se pasaba del límite de CPU del servidor)', tRend.ok && tRend.ms < 900, tRend);
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
