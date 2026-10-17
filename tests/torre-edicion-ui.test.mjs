/* Pruebas de la INTERFAZ de Torre de Control (jsdom, motor local con datos de ejemplo; no usa Supabase real): editar fecha, horarios y estatus. */


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

T('U0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);

/* ================= TORRE ================= */
como('U-T', 'torre');
T('U1 Torre abre su pantalla y ve la vista «Horarios y fechas» como opción', !!boton('Horarios y fechas', '.chip') && !!boton('Viajes y estado', '.chip'));
await click(boton('Horarios y fechas', '.chip')); ev("S.tab.torre='todos';render()");
const th = [...d.querySelectorAll('#tablaHorarios thead th')].map(txt);
T('U2 La tabla muestra viaje, cliente, proyecto, placa, fecha plan, los horarios y el estado', ['Viaje','Cliente','Proyecto','Placa','Fecha plan','Estado','Acciones'].every(h=>th.includes(h)) && JSON.parse(ev('JSON.stringify(CAMPOS_TIEMPO.map(x=>x[1]))')).every(h=>th.includes(h)), th);
ev("S.tab.torre='todos';render()");
const fila = id => [...d.querySelectorAll('#tablaHorarios tbody tr')].find(r => txt(r.querySelector('td')) === '#' + id);
const fK = fila(K);
T('U3 Se ven los horarios existentes y los que faltan aparecen como «—» (el viaje no está incompleto en pantalla)', fK && /08:10/.test(txt(fK)) && fK.querySelectorAll('td .mute').length >= 9 && /C-444DDD/.test(txt(fK)) && /COCACOLA/i.test(txt(fK)), txt(fK));
T('U4 En el cliente autorizado hay botón «Editar horarios»; en Colgate (no autorizado) solo consulta', !!fK.querySelector('[data-act="torreHorOpen"]') && !fila(C).querySelector('[data-act="torreHorOpen"]') && /solo consulta/.test(txt(fila(C))));
await click(fK.querySelector('[data-act="torreHorOpen"]'));
const dlg = () => d.querySelector('[role="dialog"]');
T('U5 Antes de guardar, la ventana identifica el viaje, cliente, proyecto y placa', dlg() && new RegExp('Viaje #' + K).test(txt(dlg())) && /COCACOLA/i.test(txt(dlg())) && /C-444DDD/.test(txt(dlg())), txt(dlg()));
T('U6 Aparecen la fecha plan y los 10 horarios como campos editables (los vacíos se pueden llenar)', dlg().querySelectorAll('input[type="datetime-local"]').length === 11 && dlg().querySelector('#mf_tSalida').value === '' && dlg().querySelector('#mf_tIngresoPlanta').value === '2031-02-01T08:10');
await escribe(dlg().querySelector('#mf_tSalida'), '2031-02-01T09:10');
await escribe(dlg().querySelector('#mf_tIngresoPlanta'), '2031-02-01T08:45');
T('U7 La ventana resume lo que va a cambiar (valor anterior → nuevo)', /Cambios por guardar \(2\)/.test(txt(dlg())) && /\(vacío\)/.test(txt(dlg())) && /08:10/.test(txt(dlg())) && /08:45/.test(txt(dlg())), txt(dlg().querySelector('#mlive')));
const nAudAntes = ev('DB.audit.length');
const guardar = () => boton('GUARDAR CAMBIOS', '.dlg button');
guardar().dispatchEvent(new w.MouseEvent('click', { bubbles: true })); guardar() && guardar().dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await tick(80);   /* doble clic */
const tk = trip(K);
T('U8 Guardar cambios: se graba en el viaje, se cierra la ventana y se confirma con un mensaje', tk.tSalida === '2031-02-01T09:10' && tk.tIngresoPlanta === '2031-02-01T08:45' && !dlg() && toasts().some(t => /guardado correctamente/.test(t) && new RegExp('#' + K).test(t)), [tk.tSalida, toasts()]);
T('U9 Un doble clic no guarda dos veces (2 cambios = 2 registros de historial)', ev('DB.audit.length') - nAudAntes === 2, ev('DB.audit.length') - nAudAntes);
T('U10 La tabla se actualiza con los nuevos horarios', /09:10/.test(txt(fila(K))) && /08:45/.test(txt(fila(K))));
const hist = JSON.parse(ev(`JSON.stringify(DB.audit.filter(a=>a.viajeId==='${K}'&&/Torre de Control/.test(a.accion)))`));
T('U11 Queda el historial con anterior, nuevo, usuario y fecha', hist.length === 2 && hist.every(h => h.por === 'Felipe Torre' && h.en) && hist.some(h => /vac/.test(h.anterior)), hist.map(h => [h.campo, h.anterior, h.nuevo]));
T('U12 El estado del viaje no cambió', tk.estado === 'PLANIFICADO');
/* error: fecha plan vacía */
await click(fila(K).querySelector('[data-act="torreHorOpen"]'));
await escribe(dlg().querySelector('#mf_fechaPlan'), '');
await click(guardar());
T('U13 Un error se muestra en la ventana y no se guarda nada', dlg() && /fecha plan es obligatoria/i.test(txt(dlg().querySelector('.err'))) && trip(K).fechaPlan === '2031-02-01T08:00', txt(dlg()));
await click(boton('Cancelar', '.dlg button'));
/* error del servidor/motor: valor inválido forzado */
await click(fila(K).querySelector('[data-act="torreHorOpen"]'));
ev("S.modal.data.tRampa='no-es-fecha';render()");
await click(guardar());
T('U14 Si el motor rechaza el cambio, se informa «No se guardó nada» y el viaje queda igual', dlg() && /No se guardó nada/.test(txt(dlg().querySelector('.err'))) && trip(K).tRampa === '', txt(dlg().querySelector('.err')));
await click(boton('Cancelar', '.dlg button'));
/* sin cambios */
await click(fila(K).querySelector('[data-act="torreHorOpen"]'));
await click(guardar());
T('U15 Guardar sin cambiar nada avisa «No hay cambios que guardar»', /No hay cambios/.test(txt(dlg().querySelector('.err'))));
await click(boton('Cancelar', '.dlg button'));
/* la pestaña de estado sigue funcionando */
await click(boton('Viajes y estado', '.chip'));
T('U16 La vista «Viajes y estado» de Torre sigue igual (botón de avanzar estado)', !!d.querySelector('[data-act="torreEstado"]') && !d.querySelector('#tablaHorarios'));
/* otros usuarios ven el cambio */
como('U-1', 'torre'); await click(boton('Horarios y fechas', '.chip')); ev("S.tab.torre='todos';render()");
T('U17 Otro usuario (administradora) ve los horarios actualizados y también puede editar', /09:10/.test(txt(fila(K))) && !!fila(K).querySelector('[data-act="torreHorOpen"]'));
como('U-T','torre');
T('U18 Torre no ve tarifas ni facturas ni puede editar clientes/tarifas', ['tarifas_ver','tarifas_crear','viajes_editar_tiempos','comercial_agrupar','finanzas_ver'].every(p=>!ev(`hp('${p}')`)), ['tarifas_ver','tarifas_crear','viajes_editar_tiempos','comercial_agrupar','finanzas_ver'].map(p=>p+':'+ev(`hp('${p}')`)));

/* ---- Estatus desde la misma ventana ---- */
como('U-T', 'torre'); await click(boton('Horarios y fechas', '.chip')); ev("S.tab.torre='todos';render()");
await click(fila(K).querySelector('[data-act="torreHorOpen"]'));
const sel = () => dlg().querySelector('#mf_estadoNuevo');
T('U19 La ventana trae un selector de estatus con solo el paso permitido (En ruta) y «mantener actual»', sel() && [...sel().options].map(o => o.value).join() === ',EN_RUTA' && /Mantener: Planificado/.test(txt(sel().options[0])), sel() && [...sel().options].map(o => o.value));
await escribe(sel(), 'EN_RUTA'); await escribe(dlg().querySelector('#mf_tRampa'), '2031-02-01T08:50');
T('U20 El resumen muestra el cambio de estatus junto con el de horarios', /Estatus: Planificado → En ruta/.test(txt(dlg().querySelector('#mlive'))) && /Cambios por guardar \(2\)/.test(txt(dlg().querySelector('#mlive'))), txt(dlg().querySelector('#mlive')));
await click(guardar());
T('U21 Guardar cambia el estatus y el horario, avisa con un mensaje y persiste', trip(K).estado === 'EN_RUTA' && trip(K).tRampa === '2031-02-01T08:50' && !dlg() && toasts().some(t => /estatus: En ruta/.test(t)), [trip(K).estado, toasts()]);
/* Entregado sin horarios completos: error claro y el horario escrito SÍ se guarda, el estatus no */
await click(fila(K).querySelector('[data-act="torreHorOpen"]'));
await escribe(sel(), 'ENTREGADO'); await escribe(dlg().querySelector('#mf_tEsperaRampa'), '2031-02-01T08:30');
await click(guardar());
T('U22 Entregado con horarios incompletos: se informa, el estatus no cambia y el horario escrito sí quedó guardado', dlg() && /horarios sí se guardaron/.test(txt(dlg().querySelector('.err'))) && trip(K).estado === 'EN_RUTA' && trip(K).tEsperaRampa === '2031-02-01T08:30', txt(dlg().querySelector('.err')));
/* completar todos y entregar */
const faltan = ev("TIEMPO_KEYS.filter(k=>k!=='fechaPlan')").filter ? JSON.parse(ev("JSON.stringify(TIEMPO_KEYS.filter(k=>k!=='fechaPlan'&&!DB.trips.find(t=>t.id==='" + K + "')[k]))")) : [];
let h = 10; for (const k of faltan) await escribe(dlg().querySelector('#mf_' + k), '2031-02-01T' + String(h++).padStart(2, '0') + ':00');
await click(guardar());
T('U23 Con todos los horarios completos, Torre entrega el viaje desde la misma ventana', trip(K).estado === 'ENTREGADO' && !dlg(), [trip(K).estado, txt(dlg() && dlg().querySelector('.err'))]);
T('U24 En un viaje ya Entregado no hay selector de estatus (Torre no avanza más allá)', (await click(fila(K).querySelector('[data-act="torreHorOpen"]')), !sel()));
await click(boton('Cancelar', '.dlg button'));
T('U25 Sin errores de JavaScript durante toda la prueba', N.errs.length === 0, N.errs);

console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
