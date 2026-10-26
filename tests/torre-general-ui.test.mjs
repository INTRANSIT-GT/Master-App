/* Pruebas de la INTERFAZ: orden de los 11 horarios, «Salida de bodega» (sin «Fecha y hora de salida») y la vista general de Torre de Control
   (tabla de solo lectura, filtros por fecha del viaje y cambio de estatus). jsdom con el motor local; no usa Supabase real. */


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


const ORDEN = ['Ingreso a planta','Espera en rampa','Ingreso a rampa','Inicio de carga','Fin de carga','Salida de planta','Ingreso a bodega','Espera en rampa bodega','Inicio de descarga','Fin de descarga','Salida de bodega'];
const CAB = ['Viaje','Cliente','Proyecto','Fecha del viaje','Placa','Tipo de unidad','Piloto','Origen','Destino','Ruta',...ORDEN,'Estatus'];
const gen = () => [...d.querySelectorAll('#tablaGeneral thead th')].map(txt);
const filasG = () => [...d.querySelectorAll('#tablaGeneral tbody tr')];
const idsG = () => filasG().map(r => txt(r.querySelector('td')).replace('#', ''));
const filaG = id => filasG().find(r => txt(r.querySelector('td')) === '#' + id);
const setF = async (k, v) => { const el = d.querySelector(`[data-flt="${k}"]`); await escribe(el, v); };

T('U0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);

/* ---------- 1 y 2. Orden de los horarios y «Salida de bodega» ---------- */
T('H1 El motor define los 11 horarios en el orden pedido', JSON.stringify(JSON.parse(ev('JSON.stringify(CAMPOS_TIEMPO.map(x=>x[1]))'))) === JSON.stringify(ORDEN), ev('JSON.stringify(CAMPOS_TIEMPO.map(x=>x[1]))'));
T('H2 «Fecha y hora de salida» ya no es un horario (ni en la lista ni en las claves editables)', !ev('CAMPOS_TIEMPO.some(x=>x[1]==="Fecha y hora de salida")') && !ev('TIEMPO_KEYS.includes("tSalida")') && ev('TKEYS.includes("tSalidaBodega")') && ev('TKEYS.indexOf("tSalidaBodega")') === 10);
como('U-1', 'nuevo');
const etq = [...d.querySelectorAll('.tgrid')][0] ? [...d.querySelectorAll('.tgrid')][0].querySelectorAll('label') : [];
T('H3 El formulario del viaje muestra los horarios en ese orden (izquierda→derecha, arriba→abajo)', JSON.stringify([...etq].map(txt)) === JSON.stringify(ORDEN), [...etq].map(txt));
T('H4 «Salida de bodega» es un campo de fecha y hora con «Ahora» y borrar, igual que los demás', (() => { const i = d.querySelector('#m_tSalidaBodega'); return i && i.type === 'datetime-local' && !!d.querySelector('[data-act="ahora"][data-k="tSalidaBodega"]') && !!d.querySelector('[data-act="limpiar"][data-k="tSalidaBodega"]'); })());
T('H5 No existe ningún campo «Fecha y hora de salida» en el formulario', !/Fecha y hora de salida/.test(txt(d.querySelector('#main') || d.body)) && !d.querySelector('#m_tSalida'));

/* guardar y recuperar */
const base = { cliente: 'COCACOLA', proyectoCat: 'COCACOLA', pilotoId: 'P-4', rutaId: 'R-0002', shipment: 'H-1', opl: 'INTRANSIT', tipoViaje: 'ONE WAY', tipoCarga: 'KG', noCarga: '1', producto: 'P', placaArrastre: 'PA-1' };
const t11 = { tIngresoPlanta: '2031-05-01T08:00', tEsperaRampa: '2031-05-01T08:10', tRampa: '2031-05-01T08:20', tInicioCarga: '2031-05-01T08:30', tFinCarga: '2031-05-01T09:00', tSalidaPlanta: '2031-05-01T09:10', tIngresoBodega: '2031-05-01T12:00', tEsperaRampaBodega: '2031-05-01T12:10', tInicioDescarga: '2031-05-01T12:20', tFinDescarga: '2031-05-01T13:00', tSalidaBodega: '2031-05-01T13:15' };
const hv = JSON.parse(ev(`JSON.stringify(API.crearViaje('U-1',${JSON.stringify({ ...base, fechaPlan: '2031-05-01T07:00', ...t11 })}))`));
const hg = trip(hv.id);
T('H6 Al crear, los 11 horarios se guardan y se recuperan tal cual, y «Salida de bodega» no se confunde con «Salida de planta»', Object.entries(t11).every(([k, v]) => hg[k] === v) && hg.tSalidaBodega !== hg.tSalidaPlanta && !hg.tSalida, hg);
ev(`API.editarViaje('U-1','${hv.id}',{tSalidaBodega:'2031-05-01T14:00'})`);
T('H7 Al editar el viaje, «Salida de bodega» se actualiza y los demás horarios no cambian', trip(hv.id).tSalidaBodega === '2031-05-01T14:00' && trip(hv.id).tSalidaPlanta === '2031-05-01T09:10' && trip(hv.id).tFinDescarga === '2031-05-01T13:00');
como('U-1', 'detalle'); ev(`go('detalle','${hv.id}')`); await tick();
const kv = [...d.querySelectorAll('.card')].find(c => /Horarios del viaje/.test(txt(c.querySelector('h3'))));
const dts = kv ? [...kv.querySelectorAll('dl')[0].querySelectorAll('dt')].map(txt) : [];
T('H8 El detalle del viaje muestra los horarios en el orden pedido y con la Salida de bodega recuperada', JSON.stringify(dts) === JSON.stringify(ORDEN) && /14:00/.test(txt(kv)), dts);
/* viaje histórico: el dato de «Fecha y hora de salida» se conserva y no se sobrescribe */
ev(`DB.trips.find(t=>t.id==='${hv.id}').tSalida='2031-05-01T09:00'`);
ev(`API.editarViaje('U-1','${hv.id}',{tFinDescarga:'2031-05-01T13:05'})`);
T('H9 Un viaje histórico conserva su «Fecha y hora de salida» guardada (no se borra ni se copia a otro horario)', trip(hv.id).tSalida === '2031-05-01T09:00' && trip(hv.id).tSalidaBodega === '2031-05-01T14:00' && trip(hv.id).tSalidaPlanta === '2031-05-01T09:10');
const sinEdit = JSON.parse(ev(`JSON.stringify((()=>{try{API.torreEditarHorarios('U-T','${hv.id}',{tSalida:'2031-05-01T10:00'});return {ok:true}}catch(e){return {ok:false,code:e.code}}})())`));
T('H10 «Fecha y hora de salida» ya no se puede editar como horario', sinEdit.ok === false, sinEdit);

/* ---------- 3 y 4. Torre: vista general ---------- */
como('U-T', 'torre');
T('G1 Torre tiene la opción «Vista general» junto a las otras dos', !!boton('Vista general', '.chip') && !!boton('Horarios y fechas', '.chip') && !!boton('Viajes y estado', '.chip'));
await click(boton('Vista general', '.chip'));
T('G2 La vista general es una tabla compacta con las columnas pedidas y los horarios en el orden indicado', JSON.stringify(gen()) === JSON.stringify(CAB), gen());
const total = ev('DB.trips.length');
T('G3 Muestra TODOS los viajes (no solo los en curso): una fila por viaje', filasG().length === total && total >= 6 && ev("S.tab.torre") === 'todos', [filasG().length, total]);
T('G4 La fila trae cliente, proyecto, fecha, placa, tipo de unidad, piloto, origen, destino y ruta', (() => { const t = txt(filaG(K)); return /COCA-COLA/i.test(t) && /COCACOLA/.test(t) && /01\/02\/2031/.test(t) && /C-444DDD/.test(t) && /10TON/.test(t) && /Piloto Cuatro/.test(t) && /CP/.test(t) && /Central/.test(t); })(), txt(filaG(K)));
T('G5 Los horarios que existen se ven y los que faltan aparecen como «—»', /08:10/.test(txt(filaG(K))) && filaG(K).querySelectorAll('td .mute[title="Sin registrar"]').length >= 10);
const wrap = d.querySelector('.xlwrap.sheet');
T('G6 La tabla se desplaza (scroll) y mantiene fija la primera columna', !!wrap && !!d.querySelector('#tablaGeneral td.stk') && parseInt(d.querySelector('#tablaGeneral').style.minWidth) > 2000);

ev("DB.ventana={meses:3,desde:'2031-01-01',enBase:DB.trips.length+25,cargados:DB.trips.length};render()");
T('G7 Si el servidor no cargó todo el histórico, la vista general lo avisa y ofrece cargar los viajes anteriores', !!d.querySelector('[data-act="cargarViejos"]') && /más antiguos sin cargar/.test(txt(d.querySelector('.alertbox'))), txt(d.querySelector('.alertbox')));
ev("DB.ventana=null;render()");

/* filtros de fecha */
await setF('tDia', '2031-02-01');
T('F1 Fecha específica: solo el viaje de esa fecha', JSON.stringify(idsG()) === JSON.stringify([K]), idsG());
await setF('tDia', '');
await setF('tDesde', '2031-03-01'); await setF('tHasta', '2031-03-03');
T('F2 Rango desde–hasta (incluye los extremos)', JSON.stringify(idsG().sort()) === JSON.stringify([...A].sort()), idsG());
await setF('tHasta', '');
T('F3 Solo «desde»: todos los viajes de esa fecha en adelante', filasG().length === 5 && !idsG().includes(K) && !idsG().includes(C) && idsG().includes(hv.id), idsG());
await setF('tDesde', ''); await setF('tHasta', '2031-02-09');
T('F4 Solo «hasta»: todos los viajes hasta esa fecha', JSON.stringify(idsG().sort()) === JSON.stringify([K, C].sort()), idsG());
await setF('tDesde', '2031-03-01'); await setF('tHasta', '2031-03-31');
await escribe(d.querySelector('#q'), 'Cuatro');
T('F5 Se combinan con la búsqueda (fecha + texto)', JSON.stringify(idsG()) === JSON.stringify([D]), idsG());
await click(boton('Limpiar filtros'));
T('F6 «Limpiar filtros» vuelve a la vista general completa', filasG().length === total && !d.querySelector('[data-flt="tDia"]').value && !d.querySelector('[data-flt="tDesde"]').value && !d.querySelector('#q').value);
await setF('tDia', '2031-02-01');
ev("S.tDia='2031-02-01';S.navK='general';render()"); await setF('tHasta', '2031-02-09');
T('F7 Fecha específica + rango se combinan (intersección)', JSON.stringify(idsG()) === JSON.stringify([K]), idsG());
await click(boton('Limpiar filtros'));
ev(`DB.trips.find(t=>t.id==='${C}').fechaPlan='2031-02-09T23:30'; render()`); await setF('tDia', '2031-02-09');
T('F8 El filtro usa la fecha del viaje (aunque la hora sea 23:30) y no otro horario', JSON.stringify(idsG()) === JSON.stringify([C]), idsG());
await click(boton('Limpiar filtros'));
await setF('tDia', '2040-01-01');
T('F9 Sin resultados se explica con un mensaje claro', /Ningún viaje coincide con los filtros/.test(txt(d.querySelector('#vb'))), txt(d.querySelector('#vb')));
await click(boton('Limpiar filtros'));

/* ---------- 5. Torre: cambio de estatus ---------- */
const selK = () => filaG(K).querySelector('select[data-torreest]');
T('E1 En un viaje de un cliente autorizado hay un desplegable de estatus con solo estados válidos (actual y siguiente)', !!selK() && JSON.stringify([...selK().options].map(o => o.value)) === JSON.stringify(['PLANIFICADO', 'EN_RUTA']), selK() && [...selK().options].map(o => o.value));
T('E2 En un cliente no autorizado y en viajes aceptados no hay desplegable: solo consulta', !filaG(C).querySelector('select') && /solo consulta/.test(txt(filaG(C))) && A.every(id => !filaG(id).querySelector('select')));
await escribe(selK(), 'EN_RUTA');
T('E3 Al elegir un estatus se pide confirmación y todavía no se guarda', !!d.querySelector('.modal, [role="dialog"]') && /CAMBIAR ESTATUS/.test(txt(d.body)) && trip(K).estado === 'PLANIFICADO');
await click(boton('Cancelar') || d.querySelector('[data-act="closeModal"]'));
T('E4 Cancelar deja el estatus como estaba (el desplegable vuelve al valor actual)', trip(K).estado === 'PLANIFICADO' && selK().value === 'PLANIFICADO');
const nAud = ev('DB.audit.length');
await escribe(selK(), 'EN_RUTA'); await click(boton('CAMBIAR ESTATUS'));
T('E5 Confirmado: el estatus se guarda y la tabla se actualiza', trip(K).estado === 'EN_RUTA' && /En ruta/.test(txt(filaG(K))), trip(K).estado);
T('E6 Se muestra un mensaje de confirmación', toasts().some(t => /estatus cambiado a En ruta/.test(t)), toasts());
T('E7 Queda en la bitácora quién hizo el cambio', ev('DB.audit.length') > nAud && ev("DB.audit.filter(a=>a.viajeId==='" + K + "'&&a.campo==='Estado').slice(-1)[0].por") === 'Felipe Torre');
await escribe(selK(), 'ENTREGADO'); await click(boton('CAMBIAR ESTATUS'));
T('E8 Si el servidor rechaza el cambio (faltan horarios) se muestra el error claro y el viaje no cambia', trip(K).estado === 'EN_RUTA' && toasts().some(t => /No se cambió el estatus/.test(t) && /horario|falta|Entregado/i.test(t)), toasts());
T('E9 Torre solo puede cambiar el estatus desde esta tabla: no hay campos de texto/fecha ni botones de edición', d.querySelectorAll('#tablaGeneral input, #tablaGeneral textarea').length === 0 && d.querySelectorAll('#tablaGeneral [data-act="torreHorOpen"], #tablaGeneral [data-act="editar"]').length === 0 && d.querySelectorAll('#tablaGeneral select').length === filasG().filter(r => r.querySelector('select')).length);
const noCli = JSON.parse(ev(`JSON.stringify((()=>{try{API.torreMoverEstado('U-T','${C}','EN_RUTA');return {ok:true}}catch(e){return {ok:false,code:e.code}}})())`));
T('E10 El servidor sigue rechazando el cambio en clientes no autorizados', noCli.ok === false && noCli.code === 'CLIENTE_NO_AUTORIZADO', noCli);
const salta = JSON.parse(ev(`JSON.stringify((()=>{try{API.torreMoverEstado('U-T','${A[0]}','COBRADO');return {ok:true}}catch(e){return {ok:false,code:e.code}}})())`));
T('E11 Y rechaza estados que Torre no puede fijar (no se inventan estados ni se saltan pasos)', salta.ok === false, salta);

/* ---------- 6. Otros perfiles ---------- */
for (const [uid, vista] of [['U-F', 'comercial'], ['U-O', 'viajes']]) { como(uid, vista); }
como('U-O', 'torre');
T('O1 Un perfil sin acceso a Torre sigue sin verla (permisos intactos)', !d.querySelector('#tablaGeneral'));
const opC = JSON.parse(ev(`JSON.stringify((()=>{try{API.torreMoverEstado('U-O','${K}','ENTREGADO');return {ok:true}}catch(e){return {ok:false}}})())`));
T('O2 Operativo no obtiene el permiso de Torre para cambiar estatus', opC.ok === false);
T('U99 Sin errores de JavaScript al final', N.errs.length === 0, N.errs);

console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
