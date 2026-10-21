/* Pruebas de la INTERFAZ (jsdom, motor local con datos de ejemplo; NO usa Supabase real): cuándo ve controles de edición Torre de Control y por qué cuando no. */


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
  DB.lugares=DESTINOS.map(x=>({id:x.id,cliente:x.proyecto,tipo:'DESTINO',nombre:x.nombre,activo:true})).concat([{id:'CP',cliente:'COLGATE',tipo:'ORIGEN',nombre:'CP',activo:true},{id:'CP2',cliente:'COCACOLA',tipo:'ORIGEN',nombre:'CP',activo:true}]);
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

const toasts = () => [...d.querySelectorAll('#toasts .toast')].map(txt);



T('C0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);
const trip = id => JSON.parse(ev(`JSON.stringify(DB.trips.find(t=>t.id==='${id}'))`));
const K = ev('window.__K'), C = ev('window.__C'), Dd = ev('window.__D');
const fila = id => [...d.querySelectorAll('tbody tr')].find(r => r.querySelector(`[data-act="detalle"][data-id="${id}"]`));
const verTorre = async (h) => { como('U-T', 'torre'); ev(`S.tab.torre='todos';S.navK='${h ? 'horarios' : ''}';render()`); await tick(); };

/* ===== Cliente autorizado + permiso: hay controles ===== */
await verTorre(true);
T('C1 Horarios y fechas: en un viaje de un cliente autorizado aparece «Editar horarios»', !!fila(K).querySelector('[data-act="torreHorOpen"]'));
await verTorre(false);
T('C2 Viajes y estado: aparece el botón para mover el estado (Enviar a ruta) en el viaje Planificado', !!fila(K).querySelector('[data-act="torreEstado"]') && /Enviar a ruta/.test(txt(fila(K))));

/* ===== Cliente NO autorizado: sin controles y con motivo ===== */
await verTorre(true);
T('C3 Cliente no autorizado: sin botón y dice el motivo', !fila(C).querySelector('[data-act="torreHorOpen"]') && /solo consulta · este cliente no está autorizado para Torre/.test(txt(fila(C))), txt(fila(C)));
await verTorre(false);
T('C4 Cliente no autorizado: sin botón de estado y dice el motivo', !fila(C).querySelector('[data-act="torreEstado"]') && /solo consulta · este cliente no está autorizado para Torre/.test(txt(fila(C))), txt(fila(C)));

/* ===== Sin el permiso del rol: sin controles aunque el cliente esté autorizado ===== */
ev("DB.permisos.find(p=>p.rol==='TORRE'&&p.permiso==='viajes_estatus_torre').habilitado=false");
await verTorre(true);
T('C5 Sin el permiso de Torre no hay «Editar horarios» y se explica', !fila(K).querySelector('[data-act="torreHorOpen"]') && /tu perfil no tiene el permiso de edición de Torre/.test(txt(fila(K))), txt(fila(K)));
await verTorre(false);
T('C6 Sin el permiso de Torre no hay botón de estado y se explica', !fila(K).querySelector('[data-act="torreEstado"]') && /tu perfil no tiene el permiso/.test(txt(fila(K))), txt(fila(K)));
como('U-T', 'detalle'); ev(`go('detalle','${K}')`); await tick();
T('C7 Sin el permiso tampoco aparece el botón en el detalle del viaje', !boton('Editar horarios'));
ev("DB.permisos.find(p=>p.rol==='TORRE'&&p.permiso==='viajes_estatus_torre').habilitado=true");

/* ===== Ningún cliente autorizado: aviso claro ===== */
const aut = ev("JSON.stringify(DB.clientes.map(c=>[c.id,c.torreEstatus]))");
ev("DB.clientes.forEach(c=>c.torreEstatus=false)");
await verTorre(false);
T('C8 Si ningún cliente está autorizado, la pantalla avisa que la administradora debe activarlo en Clientes', /Ningún cliente está autorizado para Torre/.test(txt(d.querySelector('.rulebar'))) && /Clientes → Configuración de Torre de Control/.test(txt(d.querySelector('.rulebar'))) && !d.querySelector('[data-act="torreEstado"]'), txt(d.querySelector('.rulebar')));
ev(`JSON.parse('${aut}').forEach(([id,v])=>{DB.clientes.find(c=>c.id===id).torreEstatus=v})`);
await verTorre(false);
T('C9 Con un cliente autorizado el aviso no aparece', !/Ningún cliente está autorizado/.test(txt(d.querySelector('.rulebar'))));

/* ===== Detalle del viaje: Torre edita desde ahí ===== */
como('U-T', 'detalle'); ev(`go('detalle','${K}')`); await tick();
const b = boton('Editar horarios');
T('C10 En el detalle de un viaje autorizado Torre ve «Editar horarios» (y no el botón de Administrador)', !!b && !boton('Editar viaje y horarios'));
await click(b);
const dlg = () => d.querySelector('[role="dialog"]');
T('C11 Se abre la misma ventana de horarios de Torre, con la fecha plan y los horarios', !!dlg() && !!dlg().querySelector('#mf_fechaPlan') && !!dlg().querySelector('#mf_tSalida'));
const nAud = ev('DB.audit.length');
await escribe(dlg().querySelector('#mf_tSalida'), '2031-09-01T09:10');
[...dlg().querySelectorAll('button')].find(x => /GUARDAR CAMBIOS/.test(txt(x))).dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await tick(80);
T('C12 El horario se guarda, queda en la bitácora a nombre de Torre y el detalle lo muestra', trip(K).tSalida === '2031-09-01T09:10' && ev('DB.audit.length') > nAud && ev("DB.audit[DB.audit.length-1].por") === 'Felipe Torre' && /09:10/.test(txt(d.querySelector('#main'))), [trip(K).tSalida, ev("DB.audit[DB.audit.length-1].por")]);
ev(`go('detalle','${C}')`); await tick();
T('C13 En el detalle de un viaje de cliente no autorizado Torre no ve botón de edición', !boton('Editar horarios') && !boton('Editar viaje y horarios'));
/* Estado desde la ventana: solo el paso permitido */
ev(`go('detalle','${K}')`); await tick(); await click(boton('Editar horarios'));
const sel = dlg().querySelector('#mf_estadoNuevo');
T('C14 Para un viaje Planificado solo se ofrece el paso permitido (En ruta); ningún retroceso ni salto', !!sel && JSON.stringify([...sel.options].map(o => o.value).filter(Boolean)) === JSON.stringify(['EN_RUTA']), sel && [...sel.options].map(o => o.value));
ev('S.modal=null;render()');

/* ===== Otros perfiles: nada cambia ===== */
for (const [uid, quien, espera] of [['U-1', 'Administrador', 'Editar viaje y horarios'], ['U-O', 'Operativo', null]]) {
  como(uid, 'detalle'); ev(`go('detalle','${K}')`); await tick();
  T(`C15 ${quien}: ${espera ? 'su botón de siempre sigue' : 'su detalle no cambia'} y no se agrega el de Torre`, (espera ? !!boton(espera) : true) && !boton('Editar horarios'));
}
for (const [uid, quien] of [['U-F', 'Facturación'], ['U-G', 'Gerente de Transporte'], ['U-P1', 'Proyectos']]) {
  como(uid, 'detalle'); ev(`go('detalle','${K}')`); await tick();
  T(`C16 ${quien}: no recibe el botón de Torre`, !boton('Editar horarios'));
}
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
