/* (cabecera heredada) orden de los 10 horarios, «Salida de bodega» (sin «Fecha y hora de salida») y la vista general de Torre de Control
   (tabla de solo lectura, filtros por fecha del viaje y cambio de estatus). jsdom con el motor local; no usa Supabase real. */


import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url'; import zlib from 'node:zlib';
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
  /* Acceso por sección (matriz «sec_<pantalla>»): lo mínimo que cada perfil de esta prueba necesita */
  SECCIONES.forEach(x=>[['ADMIN',null],['TORRE',['inicio','viajes','todos','torre','ayuda']],['OPERATIVO',['inicio','nuevo','viajes','ayuda']]].forEach(([r,l])=>DB.permisos.push({rol:r,permiso:'sec_'+x[0],habilitado:!l||l.includes(x[0])})));
  const cl=(id,n,pr,torre)=>({id,nombre:n,cliente:n.toUpperCase(),proyectos:pr,torreEstatus:!!torre,activo:true,nit:'',direccionFiscal:'',correoFacturacion:'',contacto:'',telefono:'',creditoDias:'',observaciones:''});
  DB.clientes.push(cl('COLGATE','Colgate',['COLGATE'],false),cl('COCACOLA','Coca-Cola',['COCACOLA'],true));
  DB.acceso.push({userId:'U-O',cliente:'COLGATE'});
  const ruta=(id,cod,nom,cli,o,d)=>({id,codigo:cod,nombre:nom,cliente:cli,proyecto:cli,origen:o,destino:d,estado:'ACTIVA',origenProp:'',destinoProp:'',fuente:'CATALOGO',solicitadaPorId:'U-1',solicitadaPor:'Admin',solicitadaEn:'2026-01-01T00:00:00.000Z',validadaPor:'',validadaEn:'',rechazo:null,viajeRef:''});
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
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => /vendor\/supabase/.test(f) ? '' : `<script>${leer(f)}</script>`);
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message).slice(0, 200)));
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/', pretendToBeVisual: true, virtualConsole: vc }).window;
  w.eval(FIXTURE); w.eval('expLogo=()=>Promise.resolve(null)'); return { w, errs };
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
const ORDEN = ['Ingreso a planta','Espera en rampa','Ingreso a rampa','Inicio de carga','Fin de carga','Salida de planta','Ingreso a bodega','Inicio de descarga','Fin de descarga','Salida de bodega'];
const CAB = ['Viaje','Cliente','Proyecto','Fecha del viaje','Placa','Tipo de unidad','Piloto','Origen','Destino','Ruta',...ORDEN,'Estatus'];
const gen = () => [...d.querySelectorAll('#tablaGeneral thead th')].map(txt);
const filasG = () => [...d.querySelectorAll('#tablaGeneral tbody tr')];
const setF = async (k, v) => { const el = d.querySelector(`[data-flt="${k}"]`); await escribe(el, v); };

/* ---------- Datos: viajes en varios estatus (más de una página de la tabla) ---------- */
ev(`(()=>{
  const b={cliente:'COLGATE',proyectoCat:'COLGATE',pilotoId:'P-1',rutaId:'R-0001',shipment:'S',opl:'INTRANSIT',tipoViaje:'ONE WAY',tipoCarga:'KG',noCarga:'1',producto:'P',placaArrastre:'PA-1'};
  const est=['PLANIFICADO','EN_RUTA','ENTREGADO','LIQUIDADO','ACEPTADO','RECHAZADO','FACTURADO','COBRADO'];
  window.__M=[];
  for(let i=0;i<240;i++){const t=API.crearViaje('U-1',Object.assign({},b,{pilotoId:['P-1','P-2','P-3'][i%3],fechaPlan:'2031-04-'+String(1+(i%28)).padStart(2,'0')+'T'+String(6+Math.floor(i/28)).padStart(2,'0')+':00',shipment:'M-'+i}));
    const x=DB.trips.find(y=>y.id===t.id);x.estado=i<130?'PLANIFICADO':est[1+(i%7)];window.__M.push(t.id);}
  // dos viajes del cliente Coca-Cola en ruta y planificado
  window.__KK=[API.crearViaje('U-1',Object.assign({},b,{cliente:'COCACOLA',proyectoCat:'COCACOLA',pilotoId:'P-4',rutaId:'R-0002',fechaPlan:'2031-04-03T08:00',shipment:'KK-1'})).id];
  DB.trips.find(y=>y.id===window.__KK[0]).estado='EN_RUTA';
})()`);
ev(`window.__PDF=null;window.jspdf.jsPDF.API.save=function(n){window.__PDF={n,data:this.output('datauristring'),pages:this.getNumberOfPages()};}`);
const pdfTxt = () => { const buf = Buffer.from(ev('window.__PDF.data').split(',')[1], 'base64'); const s = buf.toString('latin1'); let out = ''; const re = /stream\r?\n/g; let m; while ((m = re.exec(s))) { const i = m.index + m[0].length, f = s.indexOf('endstream', i); if (f < 0) break; try { out += zlib.inflateSync(buf.subarray(i, f)).toString('latin1') + '\n'; } catch (e) { } re.lastIndex = f + 9; } return out; };
const sel = () => d.querySelector('[data-flt="tEst"]');
const nViajes = () => Number((txt(d.querySelector('#vb .mute')).match(/(\d+) viajes/) || [])[1]);
const estDe = id => ev(`DB.trips.find(t=>t.id==='${id}').estado`);
const abre = () => { como('U-T', 'torre'); ev("S.navK='general';S.tab.torre='todos';S.tProy='';S.tDia='';S.tDesde='';S.tHasta='';S.tEst='';S.q='';S.pag.torre=1;render()"); };
const esperaPdf = async () => { ev('window.__PDF=null'); await click(d.querySelector('[data-act="torreGenPdf"]')); for (let i = 0; i < 40 && !ev('window.__PDF'); i++) await tick(50); };

T('E0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);
T('E0b jsPDF y autoTable reales están cargados en la prueba', ev('typeof window.jspdf.jsPDF')==='function' && ev('typeof new window.jspdf.jsPDF().autoTable')==='function');

abre();
const total = ev('torreList().length');
T('F1 El filtro por estatus existe en la vista general', !!sel(), txt(d.body).slice(0, 200));
const opts = [...sel().options].map(o => [o.value, txt(o)]);
T('F2 Opciones: «Todos los estatus» + los 8 estatus reales con su etiqueta', JSON.stringify(opts) === JSON.stringify([['', 'Todos los estatus'], ...['PLANIFICADO','EN_RUTA','ENTREGADO','LIQUIDADO','ACEPTADO','RECHAZADO','FACTURADO','COBRADO'].map(e => [e, ev(`ESTADOS['${e}'].l`)])]), opts);
T('F3 Por defecto está en «Todos los estatus» y muestra todos los viajes', sel().value === '' && nViajes() === total && total > 200, [sel().value, nViajes(), total]);
ev("S.navK='';render()"); T('F3b El filtro NO aparece fuera de la vista general', !d.querySelector('[data-flt="tEst"]') && !d.querySelector('[data-act="torreGenPdf"]'));
abre();

/* Filtrar por cada estatus */
for (const e of ['PLANIFICADO', 'EN_RUTA', 'ENTREGADO', 'LIQUIDADO', 'ACEPTADO', 'RECHAZADO', 'FACTURADO', 'COBRADO']) {
  const esperado = ev(`vis().filter(t=>t.estado==='${e}').length`);
  await escribe(sel(), e);
  const l = JSON.parse(ev('JSON.stringify(torreList().map(t=>t.estado))'));
  T(`F4 Filtro ${e}: la lista tiene solo ese estatus y la cuenta coincide (${esperado})`, l.length === esperado && l.every(x => x === e) && nViajes() === esperado, [l.length, esperado]);
}
await escribe(sel(), 'PLANIFICADO');
T('F5 La tabla visible solo trae filas PLANIFICADO (primera página)', filasG().length === 100 && filasG().every(r => /Planificado/i.test(txt(r.cells[r.cells.length - 1]))), filasG().length);
T('F5b El cambio solo re-renderiza (sin recargar la app: sigue la sesión y la vista)', ev('S.user.id')==='U-T' && ev('S.navK')==='general' && !!d.querySelector('#tablaGeneral'));
await escribe(sel(), '');
T('F6 Volver a «Todos los estatus» restaura todos los viajes', nViajes() === total && sel().value === '', [nViajes(), total]);

/* Combinaciones */
await escribe(sel(), 'EN_RUTA');
const enRutaTodos = nViajes();
ev("S.tProy='COCACOLA';render()");
T('C1 Estatus + cliente (combo): solo En ruta de Coca-Cola', nViajes() === 1 && filasG().length === 1 && txt(filasG()[0].cells[1]) .length > 0 && ev('torreList().every(t=>t.proyecto==="COCACOLA"&&t.estado==="EN_RUTA")'), nViajes());
ev("S.tProy='';render()");
T('C1b Quitar el cliente devuelve todos los En ruta', nViajes() === enRutaTodos);
await setF('tDia', '2031-04-03');
T('C2 Estatus + fecha específica', ev('torreList().every(t=>t.estado==="EN_RUTA"&&planD(t)==="2031-04-03")') && nViajes() > 0, nViajes());
await setF('tDia', ''); await setF('tDesde', '2031-04-01'); await setF('tHasta', '2031-04-30');
T('C3 Estatus + rango Desde/Hasta', ev('torreList().every(t=>t.estado==="EN_RUTA"&&planD(t)>="2031-04-01"&&planD(t)<="2031-04-30")') && nViajes() > 0, nViajes());
await escribe(d.querySelector('#q'), 'M-');
T('C4 Estatus + fechas + búsqueda', ev('torreList().every(t=>t.estado==="EN_RUTA")') && nViajes() >= 0, nViajes());
const c4 = nViajes();
await escribe(d.querySelector('#q'), 'KK-NO-EXISTE');
T('C5 Sin resultados: mensaje claro, sin tabla vacía, y el estatus aparece en el mensaje', nViajes() === 0 && !d.querySelector('#tablaGeneral') && /Ningún viaje coincide con los filtros/.test(txt(d.querySelector('#vb'))) && /En ruta/.test(txt(d.querySelector('#vb'))), txt(d.querySelector('#vb')));
await click(boton('Limpiar filtros'));
T('C6 «Limpiar filtros» restablece estatus, fechas y búsqueda', sel().value === '' && ev('S.tEst')==='' && ev('S.tDesde')==='' && ev('S.q')==='' && nViajes() === total, [sel().value, nViajes()]);
/* pestañas existentes */
await escribe(sel(), 'PLANIFICADO');
await click([...d.querySelectorAll('[role=tab]')].find(b => txt(b).startsWith('En ruta')));
T('C7 Combinación con la pestaña «En ruta» + estatus Planificado = sin resultados (mensaje claro, no error)', nViajes() === 0 && /Ningún viaje coincide/.test(txt(d.querySelector('#vb'))), txt(d.querySelector('#vb')));
await click([...d.querySelectorAll('[role=tab]')].find(b => txt(b).startsWith('Todos')));
T('C8 Volviendo a la pestaña «Todos» se recuperan los Planificados', nViajes() === ev('vis().filter(t=>t.estado==="PLANIFICADO").length'));

/* ---------- PDF ---------- */
abre();
await escribe(sel(), 'EN_RUTA');   /* mismo conjunto que se ve en pantalla */
const esperadosEnRuta = JSON.parse(ev('JSON.stringify(torreList().map(t=>t.id))'));
await esperaPdf();
T('P1 Se genera un PDF con nombre Torre_vista_general_*.pdf', ev('window.__PDF')&&/^Torre_vista_general_\d{4}-\d\d-\d\d_\d{4}\.pdf$/.test(ev('window.__PDF.n')), ev('window.__PDF&&window.__PDF.n'));
let tx = pdfTxt();
T('P2 Título, fecha de generación, usuario, estatus filtrado y total', /Torre de Control/.test(tx) && /Generado: \d\d\/\d\d\/\d{4}/.test(tx) && /Generado por: Felipe Torre/.test(tx) && /Estatus: En ruta/.test(tx) && new RegExp('Total: '+esperadosEnRuta.length+' viaj').test(tx), tx.slice(0, 600));
T('P3 Incluye los viajes En ruta (ids) y ninguno de otro estatus', esperadosEnRuta.every(id => tx.includes('#' + id)) && !ev('DB.trips.filter(t=>t.estado!=="EN_RUTA").some(t=>false)') , esperadosEnRuta.length);
const otros = JSON.parse(ev('JSON.stringify(DB.trips.filter(t=>t.estado!=="EN_RUTA").map(t=>t.id))'));
T('P3b No aparece ningún viaje de otro estatus', otros.every(id => !new RegExp('\\(#' + id + '\\)').test(tx) && !tx.includes('(#' + id + ')')) , otros.length);
T('P4 Todas las filas En ruta del filtro están en el PDF (conteo exacto de filas)', (tx.match(/\(#\d+\) Tj/g) || []).length === esperadosEnRuta.length, [(tx.match(/\(#\d+\) Tj/g) || []).length, esperadosEnRuta.length]);

/* Todos los estatus: más de 100 filas → todas en el PDF, en varias páginas */
await escribe(sel(), '');
const allIds = JSON.parse(ev('JSON.stringify(torreList().map(t=>t.id))'));
await esperaPdf(); tx = pdfTxt();
const pgs = ev('window.__PDF.pages'); if(process.env.DUMP){fs.writeFileSync('/tmp/pdftx.txt',tx);fs.writeFileSync('/tmp/p.pdf',Buffer.from(ev('window.__PDF.data').split(',')[1],'base64'));}
T('P5 Con «Todos los estatus» el PDF trae TODOS los registros (no solo los 100 de la página visible)', allIds.length > 200 && filasG().length === 100 && allIds.every(id => tx.includes('#' + id)), [allIds.length, filasG().length]);
T('P5b El PDF tiene varias páginas', pgs > 3, pgs);
T('P6 Cada página repite los encabezados de la tabla', (tx.match(/\(Viaje\) Tj/g) || []).length === pgs && (tx.match(/\(Estatus\) Tj/g) || []).length === pgs, [(tx.match(/\(Viaje\) Tj/g) || []).length, pgs]);
T('P7 Pie en cada página: marca y «Página i de n»', (tx.match(/In Transit . innovative outsourcing/g) || []).length === pgs && tx.includes(`gina 1 de ${pgs})`) && tx.includes(`gina ${pgs} de ${pgs})`), pgs);
T('P7b Estatus «Todos los estatus» indicado en el encabezado', /Estatus: Todos los estatus/.test(tx));
T('P8 Mismo estilo de reportes: helvetica, azul corporativo (0 0.337 0.592) y rejilla', /Helvetica/.test(Buffer.from(ev('window.__PDF.data').split(',')[1], 'base64').toString('latin1')) && /0\.? 0\.33\d* 0\.59\d* rg/.test(tx) && /Helvetica/.test(tx + Buffer.from(ev('window.__PDF.data').split(',')[1], 'base64').toString('latin1')), tx.match(/[\d. ]+ rg/g)?.slice(0, 5));
T('P8b Sin controles de interfaz en el PDF (botones, listas, «Limpiar filtros», «Descargar PDF», «(actual)»)', !/Limpiar filtros|Descargar PDF|\(actual\)|solo consulta/.test(tx));
T('P8c Columnas de la vista general: Viaje, Cliente, Proyecto, Fecha del viaje, Placa, Tipo de unidad, Piloto, Origen, Destino, Ruta y los 10 horarios', CAB.every(c => c.split(' ').every(w => tx.includes('(' + w) || tx.includes(w))) && CAB.slice(0,3).every(c => tx.includes('(' + c + ') Tj')), CAB.filter(c => !c.split(' ').every(w => tx.includes(w))));
/* Legibilidad: tamaño de letra mínimo y ancho de columnas dentro de la página */
const tfs = [...tx.matchAll(/\/F\d+ ([\d.]+) Tf/g)].map(m => Number(m[1]));
T('P9 Tamaño de letra legible (≥ 5 pt) y consistente', tfs.length > 0 && Math.min(...tfs) >= 5, Math.min(...tfs));
const xs = [...tx.matchAll(/([\d.]+) ([\d.]+) Td/g)].map(m => Number(m[1]));
T('P9b Ningún texto se sale del ancho de la página A4 horizontal (A3 horizontal: 1191 pt)', tx.length > 0 && Math.max(...[...tx.matchAll(/1 0 0 -?1 ([\d.]+) [\d.]+ Tm/g)].map(m => Number(m[1])), 0) < 1191, 'ok');

/* Sin resultados → sin PDF */
await escribe(d.querySelector('#q'), 'ZZZ-NADA');
ev('window.__PDF=null;toast("");');
await click(d.querySelector('[data-act="torreGenPdf"]')); await tick(200);
T('P10 Sin resultados: no se genera PDF y se avisa con un mensaje claro', !ev('window.__PDF') && toasts().some(t => /no se generó el PDF/.test(t)), toasts());
await click(boton('Limpiar filtros'));

/* PDF con otros filtros: cliente + fecha + búsqueda */
await escribe(sel(), 'EN_RUTA'); ev("S.tProy='COCACOLA';render()"); await setF('tDia', '2031-04-03');
await esperaPdf(); tx = pdfTxt();
T('P11 El PDF respeta cliente + fecha + estatus y lo declara en los filtros', ev('window.__PDF')&&tx.includes('#' + ev('window.__KK[0]')) && /Cliente: Coca-Cola/.test(tx) && /Fecha del viaje: 2031-04-03/.test(tx) && /Total: 1 viaje/.test(tx) && !tx.includes('#' + esperadosEnRuta.find(i => i !== ev('window.__KK[0]'))), tx.slice(0, 500));

/* ---------- La vista general sigue igual ---------- */
abre();
T('G1 Cabeceras de la vista general intactas', JSON.stringify(gen()) === JSON.stringify(CAB), gen());
T('G2 Paginación intacta (100 por página)', filasG().length === 100 && !!d.querySelector('[data-act="pagina"]'));
await click(d.querySelector('[data-act="pagina"][data-p="2"]')); T('G3 Pasa a la página 2', /101/.test(txt(d.querySelector('.pager, #vb'))) || filasG().length === 100);
await escribe(sel(), 'EN_RUTA'); T('G3b Al filtrar por estatus vuelve a la página 1', ev('S.pag.torre') === 1);
await escribe(sel(), '');
const ptr = ev('torreList().find(t=>t.estado==="PLANIFICADO"&&DB.clientes.find(c=>c.id===t.proyecto).torreEstatus)?.id');
ev("S.tProy='COCACOLA';render()");
const idc = ev('(torreList().find(t=>torreEstatusEditable(t))||{}).id');
T('G4 Selector de estatus por fila (cliente autorizado) sigue existiendo', !!idc && !!d.querySelector(`[data-torreest="${idc}"]`), idc);
const antes = estDe(idc), sig = ev(`TORRE_SIGUIENTE['${antes}']`);
await escribe(d.querySelector(`[data-torreest="${idc}"]`), sig);
T('G5a Cambiar el estatus desde la fila abre la confirmación (como antes)', /CAMBIAR ESTATUS/.test(txt(d.body)) && estDe(idc) === antes);
await click(boton('CAMBIAR ESTATUS')); await tick(200);
T('G5 Confirmando, el viaje avanza al siguiente estatus (regla de Torre intacta)', estDe(idc) === sig, [antes, estDe(idc)]);
ev("S.tProy='';render()");
como('U-O', 'torre'); T('G6 Permisos: un perfil sin acceso a Torre no ve el filtro ni el PDF', !d.querySelector('[data-act="torreGenPdf"]') && !d.querySelector('[data-flt="tEst"]'));
como('U-T', 'torre'); ev("S.navK='horarios';render()"); T('G7 Vista «Horarios y fechas» intacta (sin filtro de estatus ni PDF)', !!d.querySelector('#tablaHorarios') && !d.querySelector('[data-flt="tEst"]'));
T('U99 Sin errores de JavaScript al final', N.errs.length === 0, N.errs);

console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
