/* Pantalla de inicio por perfil: Gerencia Comercial vuelve a ver el mismo panel de Inicio que la Administradora, sin ganar permisos,
   y los demás perfiles no cambian. Los accesos por sección se leen de la migración 033 (los valores reales). jsdom con el motor local. */


import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); };
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

const SEC033 = [...fs.readFileSync(path.join(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'), 'supabase/migrations/033_acceso_modulos_secciones.sql'), 'utf8').matchAll(/\('([A-Z_]+)', '(sec_[a-z]+)', (true|false)\)/g)].map(m => [m[1], m[2], m[3] === 'true']);
const FIXTURE = `const SEC033=${JSON.stringify(SEC033)};
(()=>{
  DB=blankDB();CAT.opl.push('INTRANSIT','J&J');CAT.tipoViaje.push('ONE WAY');CAT.tipoCarga.push('KG','TARIMAS');CAT.tipoUnidad.push('10TON');CAT.origen.push('CP');
  const U=(id,usuario,nombre,rol)=>({id,usuario,clave:'x',nombre,rol,activo:true,proyectos:[]});
  DB.usuarios.push(U('U-1','admin','Admin Master','ADMIN'),...Object.keys(ROLES).filter(r=>r!=='ADMIN').map(r=>U('U-'+r,r.toLowerCase(),'Perfil '+r,r)));
  Object.keys(ROLES).forEach(r=>PERM_KEYS.forEach(p=>{DB.permisos.push({rol:r,permiso:p,habilitado:r==='ADMIN'?true:((PERM_DEFAULT[r]||[]).includes(p)&&!((PROHIBIDO[r]||[]).includes(p)))});}));
  window.__SEC=SEC033;SEC033.forEach(([r,p,h])=>DB.permisos.push({rol:r,permiso:p,habilitado:h}));
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



T('I0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);
T('I0b Se leyeron los accesos reales de la migración 033 (11 perfiles)', SEC033.length >= 11 * 17, SEC033.length);

const salirYEntrar = async uid => {      /* inicio de sesión real: formulario → doLogin → pantalla de aterrizaje */
  ev("S.user=null;S.view='login';S.modal=null;render()");
  d.querySelector('#u').value = 'x'; d.querySelector('#p').value = 'x';
  ev(`BACKEND.login=async()=>DB.usuarios.find(u=>u.id==='${uid}')`);
  await ev('doLogin()'); await tick(250);
};
const h2s = () => [...d.querySelectorAll('#main h2')].map(txt);
const btns = () => [...d.querySelectorAll('#main .bigbtn')].map(b => b.dataset.v);
const HTMLmain = () => d.querySelector('#main') ? d.querySelector('#main').innerHTML.replace(/\d{1,2}:\d{2}/g, '').replace(/ id="[^"]*"/g, '') : '';
const PANEL = ['Resumen de pendientes', 'Tus viajes por mes · por estado', 'Requiere tu atención'];

/* 1. Administradora: su inicio actual */
await salirYEntrar('U-1');
const admH2 = h2s(), admBtn = btns(), admHTML = HTMLmain();
T('I1 Al iniciar sesión, la Administradora aterriza en Inicio y conserva su panel actual', ev('S.view') === 'inicio' && JSON.stringify(admH2) === JSON.stringify(PANEL) && JSON.stringify(admBtn) === JSON.stringify(['nuevo', 'viajes', 'liquidaciones']), [ev('S.view'), admH2, admBtn]);

/* 2. Gerencia Comercial: la misma vista de inicio */
await salirYEntrar('U-GERENTE_COMERCIAL');
const gcH2 = h2s();
T('I2 Al iniciar sesión, Gerencia Comercial aterriza directamente en Inicio (no en otra pantalla)', ev('S.view') === 'inicio' && /inicio$/.test(ev('location.hash')), [ev('S.view'), ev('location.hash')]);
T('I3 Gerencia Comercial ve el mismo panel que la Administradora (pendientes, gráfica por mes y «Requiere tu atención»)', JSON.stringify(gcH2) === JSON.stringify(admH2), gcH2);
T('I4 Y con la misma estructura: saludo, secciones y gráfica', !!d.querySelector('#main .hello h1') && d.querySelectorAll('#main section.section').length === 3 && !!d.querySelector('#chartMes'));
T('I5 No muestra accesos a pantallas que su perfil no puede abrir (sin botones que lleven a «sin acceso»)', btns().every(v => ev(`allowed('${v}')`)) && btns().length === 0, btns());

/* 3. Gerencia Comercial conserva sus permisos y restricciones */
const GC = 'GERENTE_COMERCIAL';
const p = (perm) => ev(`hasPerm({activo:true,rol:'${GC}'},'${perm}')`);
T('I6 Gerencia Comercial NO gana permisos de operación al compartir el Inicio (no crea, liquida, inicia ni finaliza viajes)', !p('viajes_crear') && !p('liq_enviar') && !p('viajes_iniciar') && !p('viajes_finalizar') && !p('liq_aprobar') && !p('usuarios_gestionar'));
T('I7 Sus permisos propios siguen intactos (aprobar rutas, tarifas, clientes, ver todos los viajes)', p('rutas_aprobar_comercial') && p('tarifas_crear') && p('clientes_gestionar') && p('viajes_ver_todos'));
T('I8 Sus secciones siguen igual: sin Nuevo viaje, Viajes, Liquidaciones, Torre ni Usuarios; con Tarifas, Clientes, Rutas, OPL y Finanzas', ['nuevo', 'viajes', 'liquidaciones', 'torre', 'usuarios', 'todos'].every(v => !ev(`allowed('${v}')`)) && ['inicio', 'tarifas', 'proyectos', 'rutas', 'opl', 'finanzas'].every(v => ev(`allowed('${v}')`)));
ev("go('nuevo')"); await tick();
T('I9 Si intenta abrir una pantalla sin acceso, se le avisa y regresa a Inicio', ev('S.view') === 'inicio' && toasts().some(t => /no tiene acceso/i.test(t)), toasts());
const navGC = ev(`ROLES.${GC}.nav.filter(v=>allowed(v))`);
T('I10b Menú de Gerencia Comercial = pantallas permitidas por la matriz (sin añadir ninguna)', JSON.stringify([...navGC].sort()) === JSON.stringify(['ayuda', 'catalogos', 'finanzas', 'inicio', 'opl', 'proyectos', 'rutas', 'tarifas']), navGC);

/* 4. Los demás perfiles: ni su aterrizaje ni su Inicio cambian */
const ROLES_ = JSON.parse(ev('JSON.stringify(Object.keys(ROLES))'));
let todosOK = true; const detalle = [];
for (const r of ROLES_) {
  const uid = r === 'ADMIN' ? 'U-1' : 'U-' + r;
  await salirYEntrar(uid);
  const vista = ev('S.view'), home = ev(`allowed(ROLES.${r}.home)`) ? ev(`ROLES.${r}.home`) : null;
  const conCambio = HTMLmain();
  ev('INICIO_COMPLETO.length=0'); ev('render()'); await tick(100);       /* Inicio tal como estaba antes de este cambio */
  const sinCambio = HTMLmain();
  ev("INICIO_COMPLETO.push('GERENTE_COMERCIAL')"); ev('render()');
  const igual = r === GC ? conCambio !== sinCambio : conCambio === sinCambio;
  const aterriza = r === GC ? vista === 'inicio' : (home === null || vista === home);
  if (!igual || !aterriza) { todosOK = false; detalle.push([r, vista, home, igual]); }
}
T('I11 Todos los demás perfiles aterrizan en su pantalla de siempre y su Inicio es idéntico al de antes (solo cambia Gerencia Comercial)', todosOK, detalle);
await salirYEntrar('U-GERENTE_TRANSPORTE');
T('I12 Gerencia de Transporte sigue viendo el mismo Inicio que la Administradora', ev('S.view') === 'inicio' && JSON.stringify(h2s()) === JSON.stringify(PANEL));
await salirYEntrar('U-OPERATIVO');
T('I13 Operativo sigue con sus accesos (Nuevo viaje, Viajes, Liquidaciones)', ev('S.view') === 'inicio' && JSON.stringify(btns()) === JSON.stringify(['nuevo', 'viajes', 'liquidaciones']), btns());
await salirYEntrar('U-VALIDADOR');
T('I14 Validador sigue aterrizando en Viajes, y Torre en Torre de control', ev('S.view') === 'viajes');
await salirYEntrar('U-TORRE');
T('I15 Torre de control aterriza en su pantalla', ev('S.view') === 'torre');
T('I99 Sin errores de JavaScript al final', N.errs.length === 0, N.errs);

console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
