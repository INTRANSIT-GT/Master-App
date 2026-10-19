/* Pruebas de la INTERFAZ (jsdom, motor local con datos de ejemplo; no usa Supabase real): orden Placa → Piloto, botón Desvío y destinos autorizados, Torre de Control. */


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

T('O0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);
const orden = () => { const card = [...d.querySelectorAll('.card.fsec')].find(c => /Piloto y unidad|Placa y unidad/.test(txt(c.querySelector('h3')))); const labs = [...card.querySelectorAll('label')].map(l => txt(l)); const iPl = labs.findIndex(x => /^Placa del equipo/.test(x)), iPi = labs.findIndex(x => /^Piloto/.test(x)); return { iPl, iPi, titulo: txt(card.querySelector('h3')), labs }; };
for (const [uid, quien] of [['U-O', 'Operativo'], ['U-G', 'Gerente de Transporte']]) {
  como(uid, 'nuevo'); ev("S.form.proyecto='COLGATE';S.form.proyectoCat='COLGATE';render()");
  const o = orden();
  T(`O1 ${quien}: «Placa del equipo» aparece ANTES que «Piloto»`, o.iPl >= 0 && o.iPi >= 0 && o.iPl < o.iPi, o);
  const opsPiloto = [...d.querySelectorAll('#m_pilotoId option')].map(x => x.textContent).slice(1), esperadosP = ev("JSON.stringify(PILOTOS.filter(p=>p.proyecto==='COLGATE').map(p=>p.nombre))");
  T(`O2 ${quien}: las opciones de Piloto no cambiaron (los pilotos del cliente)`, JSON.stringify(opsPiloto) === esperadosP, [opsPiloto, esperadosP]);
  if (uid !== 'U-O') continue;   /* el Gerente usa la tarjeta de administrador (placa → piloto del equipo), ya probada arriba */
  await escribe(d.querySelector('#m_pilotoId'), 'P-1');
  T(`O3 ${quien}: elegir piloto sigue proponiendo su placa (misma lógica de siempre)`, ev('S.form.pilotoId') === 'P-1' && ev('S.form.placaSel') === 'T-1', [ev('S.form.pilotoId'), ev('S.form.placaSel')]);
  ev("aplicarCampo(S.form,'placaSel','T-2');render()");
  T(`O4 ${quien}: elegir placa sigue ajustando el piloto asignado a esa unidad`, ev('S.form.placaSel') === 'T-2' && ev('S.form.pilotoId') === 'P-2', [ev('S.form.placaSel'), ev('S.form.pilotoId')]);
}
como('U-1', 'nuevo'); ev("S.form.proyecto='COLGATE';S.form.proyectoCat='COLGATE';render()");
const oa = orden(); T('O5 Administrador: la tarjeta «Placa y unidad» sigue mostrando la placa primero (sin cambios)', oa.titulo === 'Placa y unidad' && oa.iPl === 0, oa);

/* ===== Desvío ===== */
const cardRuta = () => [...d.querySelectorAll('.card.fsec')].find(c => txt(c.querySelector('h3')) === 'Ruta');
const llenar = async () => { for (const [i, v] of [['m_shipment', 'DV'], ['m_opl', 'INTRANSIT'], ['m_tipoViaje', 'ONE WAY'], ['m_tipoCarga', 'KG'], ['m_noCarga', '5'], ['m_producto', 'Prod'], ['m_placaArrastre', 'PA-1']]) await escribe(d.querySelector('#' + i), v); };
for (const [uid, quien] of [['U-O', 'Operativo'], ['U-G', 'Gerente de Transporte'], ['U-1', 'Administrador']]) {
  como(uid, 'nuevo'); ev("S.form.proyecto='COLGATE';S.form.proyectoCat='COLGATE';render()");
  const b = [...cardRuta().querySelectorAll('button')].find(x => txt(x) === 'Desvío');
  T(`O6 ${quien}: el botón «Desvío» aparece en la sección Ruta y el campo Ruta sigue ahí`, !!b && !!cardRuta().querySelector('label[for="m_rutaGrupo"], label[for="m_rutaId"]') || /Ruta/.test(txt(cardRuta())), txt(cardRuta()).slice(0, 120));
  T(`O7 ${quien}: sin activar Desvío no hay desplegable extra`, !d.querySelector('#m_desvioDestinoId'));
}
como('U-O', 'nuevo'); ev("S.form.proyecto='COLGATE';S.form.proyectoCat='COLGATE';S.form.pilotoId='P-1';S.form.placaSel='T-1';S.form.rutaId='R-0001';render()"); await llenar();
const antes = ev("JSON.stringify((({desvio,desvioDestinoId,...r})=>r)(S.form))");
await click([...cardRuta().querySelectorAll('button')].find(x => txt(x) === 'Desvío'));
const sel = d.querySelector('#m_desvioDestinoId');
T('O8 Al activar Desvío aparece «¿Hacia dónde fue el desvío?» como desplegable (select) obligatorio', !!sel && sel.tagName === 'SELECT' && /¿Hacia dónde fue el desvío\?/.test(txt(cardRuta())) && !!cardRuta().querySelector('[aria-pressed="true"]'), txt(cardRuta()).slice(0, 200));
const ops = [...sel.querySelectorAll('option')].map(o => o.textContent).slice(1), esperD = JSON.parse(ev("JSON.stringify(DESTINOS.filter(x=>x.proyecto===S.form.proyecto).map(x=>x.nombre))"));
T('O9 Solo muestra los destinos autorizados del cliente (catálogo de destinos) y ninguno de otros clientes', ops.slice().sort().join('|') === esperD.slice().sort().join('|') && ops.length > 0 && !ops.includes('Central'), [ops, esperD]);
T('O10 Activar Desvío no borra ni reinicia ningún dato del formulario', ev("JSON.stringify((({desvio,desvioDestinoId,...r})=>r)(S.form))") === antes);
const n0 = ev('DB.trips.length');
await click(boton('GUARDAR VIAJE'));
T('O11 No deja guardar un desvío sin destino (mensaje claro, no se crea ningún viaje)', ev('DB.trips.length') === n0 && /hacia d[óo]nde fue el desv[íi]o/i.test(ev('S.form.err') || ''), ev('S.form.err'));
T('O12 Los datos escritos siguen ahí después del error', ev('S.form.shipment') === 'DV' && ev('S.form.pilotoId') === 'P-1' && ev('S.form.noCarga') === '5');
await escribe(d.querySelector('#m_desvioDestinoId'), ev("DESTINOS.filter(x=>x.proyecto==='COLGATE')[1].id"));
ev("S.form.rutaId='R-0001'");  /* el viaje conserva su ruta (el desvío no la sustituye) */
const idDest = ev('S.form.desvioDestinoId');
await click(boton('GUARDAR VIAJE'));
const idv = ev('S.form.savedId'), tv = idv ? JSON.parse(ev(`JSON.stringify(DB.trips.find(t=>t.id==='${idv}'))`)) : null;
T('O13 Con destino se guarda UN solo viaje, con el desvío asociado a ese viaje y sus datos originales', !!tv && ev('DB.trips.length') === n0 + 1 && tv.desvio === true && tv.desvioDestinoId === idDest && tv.shipment === 'DV' && tv.rutaId === 'R-0001' && tv.pilotoId === 'P-1', [ev('S.form.err'), tv && tv.desvio]);
como('U-1', 'detalle'); ev(`go('detalle','${idv}')`); await tick();
T('O14 El detalle del viaje muestra el desvío y el destino', /Desvío hacia/.test(txt(d.querySelector('#main'))) && txt(d.querySelector('#main')).includes(ev(`nombreDestino('${idDest}')`)));
/* sin Desvío: comportamiento de siempre */
como('U-O', 'nuevo'); ev("S.form.proyecto='COLGATE';S.form.proyectoCat='COLGATE';S.form.pilotoId='P-2';S.form.placaSel='T-2';S.form.rutaId='R-0001';render()"); await llenar();
await click([...cardRuta().querySelectorAll('button')].find(x => txt(x) === 'Desvío')); await escribe(d.querySelector('#m_desvioDestinoId'), idDest);
await click([...cardRuta().querySelectorAll('button')].find(x => txt(x) === 'Desvío'));
T('O15 Al desactivar Desvío el desplegable desaparece y el destino se limpia', !d.querySelector('#m_desvioDestinoId') && ev('S.form.desvioDestinoId') === '' && ev('S.form.desvio') === false);
const n1 = ev('DB.trips.length'); await click(boton('GUARDAR VIAJE'));
const i2 = ev('S.form.savedId'), t2 = i2 ? JSON.parse(ev(`JSON.stringify(DB.trips.find(t=>t.id==='${i2}'))`)) : null;
T('O16 Con Desvío desactivado el viaje se guarda como siempre, sin datos de desvío', !!t2 && ev('DB.trips.length') === n1 + 1 && !t2.desvio && !('desvioDestinoId' in t2), ev('S.form.err'));
/* cambio de cliente limpia el destino */
como('U-1', 'nuevo'); ev("S.form.proyecto='COLGATE';S.form.proyectoCat='COLGATE';S.form.desvio=true;render()"); await escribe(d.querySelector('#m_desvioDestinoId'), idDest);
ev("aplicarCampo(S.form,'proyecto','COCACOLA');render()");
const opsK = [...d.querySelectorAll('#m_desvioDestinoId option')].map(o => o.textContent).slice(1);
T('O17 Al cambiar de cliente se limpia el destino y la lista pasa a los destinos del nuevo cliente', ev('S.form.desvioDestinoId') === '' && opsK.join('|') === 'Central', opsK);
/* móvil */
ev('PREF.phone=true;window.innerWidth=390;render()');
T('O18 En modo móvil el botón y el desplegable siguen disponibles', ev('esMovil()') === true && !!d.querySelector('#m_desvioDestinoId') && [...cardRuta().querySelectorAll('button')].some(x => txt(x) === 'Desvío'));
ev('PREF.phone=false;window.innerWidth=1280;render()');
/* Torre de Control */
const vd = ev("API.crearViaje('U-1',{cliente:'COCACOLA',proyectoCat:'COCACOLA',pilotoId:'P-4',rutaId:'R-0002',fechaPlan:'2031-05-01T08:00',shipment:'KD',opl:'INTRANSIT',tipoViaje:'ONE WAY',tipoCarga:'KG',noCarga:'1',producto:'P',placaArrastre:'PA-9',desvio:true,desvioDestinoId:'D-K'}).id");
como('U-T', 'torre');
await ev(`API.torreEditarHorarios('U-T','${vd}',{tIngresoBodega:'2031-05-01T13:00',tInicioDescarga:'2031-05-01T13:10',tFinDescarga:'2031-05-01T13:40'})`);
const tt = JSON.parse(ev(`JSON.stringify(DB.trips.find(t=>t.id==='${vd}'))`));
T('O19 Torre registra los horarios de descarga de un viaje con desvío y el desvío se conserva', tt.tFinDescarga === '2031-05-01T13:40' && tt.desvio === true && tt.desvioDestinoId === 'D-K', [tt.tFinDescarga, tt.desvio]);
const malo = await ev(`(async()=>{try{await API.torreEditarHorarios('U-T','${vd}',{desvioDestinoId:'D-1'});return 'ok'}catch(e){return e.code||e.message}})()`);
T('O20 Torre no puede cambiar el destino del desvío (solo horarios)', malo !== 'ok' && ev(`DB.trips.find(t=>t.id==='${vd}').desvioDestinoId`) === 'D-K', malo);
T('O21 Torre no tiene permisos nuevos (no crea ni edita viajes; sin dinero)', !ev("hp('viajes_crear')") && !ev("hp('viajes_editar_datos')") && !ev("hp('finanzas_ver')"));
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
