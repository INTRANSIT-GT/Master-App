/* Pruebas de la INTERFAZ (jsdom, motor local con datos de ejemplo; no usa Supabase real): horarios de descarga del desvío, Referencia interna eliminada, Torre de Control. */


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
  DB.usuarios.push(U('U-1','admin','Admin Master','ADMIN'),U('U-T','torre','Felipe Torre','TORRE'),U('U-F','fact','Alejandra Facturación','FACTURACION'),U('U-O','oper','Pedro Operativo','OPERATIVO'),U('U-C','cobros','Conta Cobros','COBROS'),U('U-G','gtr','Gerente Transporte','GERENTE_TRANSPORTE'),U('U-P1','proy1','Proyectos Uno','PROYECTOS'),U('U-P2','proy2','Proyectos Dos','PROYECTOS'),U('U-V','val','Validador Uno','VALIDADOR'));
  Object.keys(ROLES).forEach(r=>PERM_KEYS.forEach(p=>{DB.permisos.push({rol:r,permiso:p,habilitado:r==='ADMIN'?true:((PERM_DEFAULT[r]||[]).includes(p)&&!((PROHIBIDO[r]||[]).includes(p)))});}));
  const cl=(id,n,pr,torre)=>({id,nombre:n,cliente:n.toUpperCase(),proyectos:pr,torreEstatus:!!torre,activo:true,nit:'',direccionFiscal:'',correoFacturacion:'',contacto:'',telefono:'',creditoDias:'',observaciones:''});
  DB.clientes.push(cl('COLGATE','Colgate',['COLGATE'],false),cl('COCACOLA','Coca-Cola',['COCACOLA'],true));
  DB.acceso.push({userId:'U-O',cliente:'COLGATE'});
  const ruta=(id,cod,nom,cli,o,d)=>({id,codigo:cod,nombre:nom,cliente:cli,proyecto:cli,origenId:o,destinoId:d,estado:'ACTIVA',origenProp:'',destinoProp:'',fuente:'CATALOGO',solicitadaPorId:'U-1',solicitadaPor:'Admin',solicitadaEn:'2026-01-01T00:00:00.000Z',validadaPor:'',validadaEn:'',rechazo:null,viajeRef:''});
  DB.rutas.push(ruta('R-0001','COL-001','CP → Mayorista','COLGATE','CP','D-1'),ruta('R-0002','COCA-001','CP → Central','COCACOLA','CP','D-K'));
  PILOTOS.length=0;PILOTOS.push({id:'P-1',nombre:'Piloto Uno',unidad:'T-1',proyecto:'COLGATE'},{id:'P-2',nombre:'Piloto Dos',unidad:'T-2',proyecto:'COLGATE'},{id:'P-3',nombre:'Piloto Tres',unidad:'T-3',proyecto:'COLGATE'},{id:'P-4',nombre:'Piloto Cuatro',unidad:'T-4',proyecto:'COCACOLA'});
  FLOTA.length=0;FLOTA.push({unidad:'T-1',placa:'C-111AAA',tango:'1',capacidad:'10 Ton',tipo:'10TON'},{unidad:'T-2',placa:'C-222BBB',tango:'2',capacidad:'10 Ton',tipo:'10TON'},{unidad:'T-3',placa:'C-333CCC',tango:'3',capacidad:'10 Ton',tipo:'10TON'},{unidad:'T-4',placa:'C-444DDD',tango:'4',capacidad:'10 Ton',tipo:'10TON'});
  DESTINOS.length=0;DESTINOS.push({id:'D-1',nombre:'Mayorista',proyecto:'COLGATE'},{id:'D-2',nombre:'Minorista',proyecto:'COLGATE'},{id:'D-K',nombre:'Central',proyecto:'COCACOLA'});
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


T('H0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);
const NORM = ['tIngresoPlanta', 'tEsperaRampa', 'tRampa', 'tInicioCarga', 'tFinCarga', 'tSalidaPlanta', 'tSalida', 'tIngresoBodega', 'tInicioDescarga', 'tFinDescarga'];
const DVK = ['dvIngresoBodega', 'dvInicioDescarga', 'dvFinDescarga'];
const cardRuta = () => [...d.querySelectorAll('.card.fsec')].find(c => txt(c.querySelector('h3')) === 'Ruta');
const cardDv = () => [...d.querySelectorAll('.card.fsec')].find(c => /Horarios de descarga del desv/.test(txt(c.querySelector('h3'))));
const cardHor = () => [...d.querySelectorAll('.card.fsec')].find(c => txt(c.querySelector('h3')) === 'Horarios del viaje');
const btnDv = () => [...cardRuta().querySelectorAll('button')].find(x => txt(x) === 'Desvío');
const llenar = async () => { for (const [i, v] of [['m_shipment', 'DV'], ['m_opl', 'INTRANSIT'], ['m_tipoViaje', 'ONE WAY'], ['m_tipoCarga', 'KG'], ['m_noCarga', '5'], ['m_producto', 'Prod'], ['m_placaArrastre', 'PA-1']]) await escribe(d.querySelector('#' + i), v); };
let nFp = 0;
const nuevo = async uid => { como(uid, 'nuevo'); ev(`S.form.fechaPlanD='2032-01-${String(++nFp).padStart(2, '0')}'`); ev("S.form.proyecto='COLGATE';S.form.proyectoCat='COLGATE';S.form.pilotoId='P-1';S.form.placaSel='T-1';S.form.rutaId='R-0001';render()"); await llenar(); };

/* ===== Referencia interna ===== */
for (const [uid, quien] of [['U-O', 'Operativo'], ['U-G', 'Gerente de Transporte'], ['U-1', 'Administrador']]) {
  await nuevo(uid);
  const f = d.querySelector('#main').textContent;
  T(`R1 ${quien}: «Referencia interna» ya no aparece en Crear viaje`, !/Referencia interna/i.test(f) && !/Referencia interna/i.test(d.querySelector('#main').innerHTML));
  T(`R2 ${quien}: queda un solo campo «No. de viaje» (sin duplicados ni controles sobrantes)`, d.querySelectorAll('#m_noViaje').length === 1 && d.querySelectorAll('[data-m="noViaje"]').length === 1);
  T(`R3 ${quien}: Producto sigue en su lugar`, !!d.querySelector('#m_producto'));
}
await nuevo('U-O');
const nR = ev('DB.trips.length'); await click(boton('GUARDAR VIAJE'));
T('R4 El viaje se guarda sin ese campo', ev('DB.trips.length') === nR + 1 && !!ev('S.form.savedId'), ev('S.form.err'));

/* ===== Horarios: viaje normal ===== */
for (const [uid, quien] of [['U-O', 'Operativo'], ['U-1', 'Administrador']]) {
  await nuevo(uid);
  const ids = [...cardHor().querySelectorAll('input[type="datetime-local"]')].map(x => x.id.replace('m_', ''));
  T(`H1 ${quien}: sin Desvío los horarios son los 10 de siempre y no hay sección adicional`, JSON.stringify(ids) === JSON.stringify(NORM) && !cardDv() && !d.querySelector('#m_dvFinDescarga'), ids);
}
/* ===== Desvío activo ===== */
await nuevo('U-O');
await escribe(d.querySelector('#m_tIngresoPlanta'), '2031-07-01T08:10'); await escribe(d.querySelector('#m_tSalida'), '2031-07-01T09:10');
const antes = ev("JSON.stringify((({desvio,desvioDestinoId,...r})=>r)(S.form))");
await click(btnDv());
T('H2 Al activar Desvío aparece «Horarios de descarga del desvío»', !!cardDv());
const dvIds = [...cardDv().querySelectorAll('input[type="datetime-local"]')].map(x => x.id.replace('m_', ''));
T('H3 Solo trae horarios de descarga: ingreso a bodega, inicio y fin de descarga (nada de carga ni salida)', JSON.stringify(dvIds) === JSON.stringify(DVK) && !/carga\b(?!.*descarga)/i.test(txt(cardDv()).replace(/descarga/gi, '')) && !/salida|planta|rampa/i.test(txt(cardDv()).replace(/Horarios de descarga del desv[ií]o/, '')), dvIds);
T('H4 La sección normal sigue intacta y con sus valores', JSON.stringify([...cardHor().querySelectorAll('input[type="datetime-local"]')].map(x => x.id.replace('m_', ''))) === JSON.stringify(NORM) && d.querySelector('#m_tSalida').value === '2031-07-01T09:10');
T('H5 Activar Desvío no borra ningún dato del formulario', ev("JSON.stringify((({desvio,desvioDestinoId,...r})=>r)(S.form))") === antes);
await click(d.querySelector('#m_dvFinDescarga').closest('.trow').querySelector('[data-act="ahora"]'));
T('H6 El botón «Ahora» funciona en el desvío', /^\d{4}-\d\d-\d\dT\d\d:\d\d$/.test(ev('S.form.dvFinDescarga')));
ev("S.form.dvFinDescarga='';render()");
await escribe(d.querySelector('#m_desvioDestinoId'), ev("DESTINOS.filter(x=>x.proyecto==='COLGATE')[1].id"));
await escribe(d.querySelector('#m_dvIngresoBodega'), '2031-07-01T15:00'); await escribe(d.querySelector('#m_dvInicioDescarga'), '2031-07-01T15:20'); await escribe(d.querySelector('#m_dvFinDescarga'), '2031-07-01T16:00');
const nT = ev('DB.trips.length');
await click(boton('GUARDAR VIAJE'));
const idv = ev('S.form.savedId'), tv = idv ? trip(idv) : null;
T('H7 Se guarda UN solo viaje con los horarios normales y los del desvío por separado', !!tv && ev('DB.trips.length') === nT + 1 && tv.tSalida === '2031-07-01T09:10' && tv.tIngresoPlanta === '2031-07-01T08:10' && tv.dvFinDescarga === '2031-07-01T16:00' && tv.dvInicioDescarga === '2031-07-01T15:20' && tv.dvIngresoBodega === '2031-07-01T15:00' && !tv.tFinDescarga, [ev('S.form.err'), tv]);
como('U-1', 'detalle'); ev(`go('detalle','${idv}')`); await tick();
const main = txt(d.querySelector('#main'));
T('H8 Al consultar el viaje se ven los horarios del desvío y los normales', /Horarios de descarga del desv/.test(main) && /01\/07\/2031|2031/.test(main) && /16:00/.test(main) && /09:10/.test(main), main.slice(0, 200));
/* orden inválido: el servidor lo rechaza y la pantalla muestra el mensaje */
await nuevo('U-O'); await click(btnDv());
await escribe(d.querySelector('#m_desvioDestinoId'), ev("DESTINOS.filter(x=>x.proyecto==='COLGATE')[0].id"));
await escribe(d.querySelector('#m_dvInicioDescarga'), '2031-07-02T16:00'); await escribe(d.querySelector('#m_dvFinDescarga'), '2031-07-02T15:00');
const n3 = ev('DB.trips.length'); await click(boton('GUARDAR VIAJE'));
T('H9 Fin de descarga antes del inicio: no se guarda y se explica', ev('DB.trips.length') === n3 && /fin de descarga/.test(ev('S.form.err')), ev('S.form.err'));
/* desactivar */
await click(btnDv());
T('H10 Al desactivar Desvío desaparece la sección y se limpian sus horarios (los normales no)', !cardDv() && DVK.every(k => ev(`S.form.${k}`) === '') && ev('S.form.shipment') === 'DV');
const n4 = ev('DB.trips.length'); await click(boton('GUARDAR VIAJE'));
T('H11 Con Desvío desactivado se guarda como siempre, sin horarios de desvío', ev('DB.trips.length') === n4 + 1 && DVK.every(k => !(k in trip(ev('S.form.savedId')))), ev('S.form.err'));
/* móvil */
await nuevo('U-O'); await click(btnDv()); ev('PREF.phone=true;window.innerWidth=390;render()');
T('H12 En modo móvil la sección del desvío y la ausencia de Referencia interna se mantienen', ev('esMovil()') === true && !!cardDv() && !/Referencia interna/i.test(d.querySelector('#main').textContent));
ev('PREF.phone=false;window.innerWidth=1280;render()');

/* ===== Torre de Control ===== */
const kd = ev("API.crearViaje('U-1',{cliente:'COCACOLA',proyectoCat:'COCACOLA',pilotoId:'P-4',rutaId:'R-0002',fechaPlan:'2031-08-01T08:00',shipment:'KD',opl:'INTRANSIT',tipoViaje:'ONE WAY',tipoCarga:'KG',noCarga:'1',producto:'P',placaArrastre:'PA-9',desvio:true,desvioDestinoId:'D-K',tSalida:'2031-08-01T09:00'}).id");
como('U-T', 'torre');
ev(`ACT.torreHorOpen({id:'${kd}'})`); await tick();
const dlg = () => d.querySelector('[role="dialog"]');
T('H13 Torre ve, en un viaje con Desvío, los horarios normales y los 3 de descarga del desvío', !!dlg() && NORM.every(k => dlg().querySelector('#mf_' + k)) && DVK.every(k => dlg().querySelector('#mf_' + k)), txt(dlg()).slice(0, 100));
await escribe(dlg().querySelector('#mf_dvInicioDescarga'), '2031-08-01T15:10'); await escribe(dlg().querySelector('#mf_dvFinDescarga'), '2031-08-01T15:40');
T('H14 La ventana resume los cambios de horario del desvío', /Cambios por guardar \(2\)/.test(txt(dlg())) && /Inicio de descarga \(desv/.test(txt(dlg())), txt(dlg().querySelector('#mlive')));
const gb = [...dlg().querySelectorAll('button')].find(b => /GUARDAR CAMBIOS/.test(txt(b)));
gb.dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await tick(80);
const tk = trip(kd);
T('H15 Torre guarda los horarios del desvío y se conserva todo lo demás', tk.dvFinDescarga === '2031-08-01T15:40' && tk.dvInicioDescarga === '2031-08-01T15:10' && tk.tSalida === '2031-08-01T09:00' && tk.desvio === true && tk.desvioDestinoId === 'D-K', [tk.dvFinDescarga, tk.tSalida]);
const kn = ev("API.crearViaje('U-1',{cliente:'COCACOLA',proyectoCat:'COCACOLA',pilotoId:'P-4',rutaId:'R-0002',fechaPlan:'2031-08-02T08:00',shipment:'KN',opl:'INTRANSIT',tipoViaje:'ONE WAY',tipoCarga:'KG',noCarga:'1',producto:'P',placaArrastre:'PA-9'}).id");
como('U-T', 'torre'); ev(`ACT.torreHorOpen({id:'${kn}'})`); await tick();
T('H16 En un viaje sin Desvío la ventana de Torre sigue igual: 11 campos, sin horarios de desvío', dlg().querySelectorAll('input[type="datetime-local"]').length === 11 && !dlg().querySelector('#mf_dvFinDescarga'));
T('H17 Torre no tiene permisos nuevos (no crea ni edita viajes; sin dinero)', !ev("hp('viajes_crear')") && !ev("hp('viajes_editar_datos')") && !ev("hp('finanzas_ver')"));
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
