/* Pruebas de la INTERFAZ: «¿Hacia dónde fue el desvío?» usa una lista PROPIA (sin datalist del navegador): se muestra, se filtra, se elige, se cierra y el destino se guarda en el viaje.
   jsdom con el motor local; no usa Supabase real. */

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
  DB.usuarios.push(U('U-GT','gt','Gerente Transporte','GERENTE_TRANSPORTE'),U('U-GC','gc','Gerente Comercial','GERENTE_COMERCIAL'),U('U-1','admin','Admin Master','ADMIN'),U('U-T','torre','Felipe Torre','TORRE'),U('U-F','fact','Alejandra Facturación','FACTURACION'),U('U-O','oper','Pedro Operativo','OPERATIVO'),U('U-C','cobros','Conta Cobros','COBROS'),U('U-G','gtr','Gerente Transporte','GERENTE_TRANSPORTE'));
  Object.keys(ROLES).forEach(r=>PERM_KEYS.forEach(p=>{DB.permisos.push({rol:r,permiso:p,habilitado:r==='ADMIN'?true:((PERM_DEFAULT[r]||[]).includes(p)&&!((PROHIBIDO[r]||[]).includes(p)))});}));
  /* Acceso por sección (matriz «sec_<pantalla>»): lo mínimo que cada perfil de esta prueba necesita */
  SECCIONES.forEach(x=>[['GERENTE_TRANSPORTE',['inicio','nuevo','viajes','todos','liquidaciones','rutas','opl','finanzas','catalogos','ayuda']],['GERENTE_COMERCIAL',['inicio','proyectos','tarifas','rutas','opl','finanzas','catalogos','ayuda']],['ADMIN',null],['TORRE',['inicio','viajes','todos','torre','ayuda']],['OPERATIVO',['inicio','nuevo','viajes','ayuda']]].forEach(([r,l])=>DB.permisos.push({rol:r,permiso:'sec_'+x[0],habilitado:!l||l.includes(x[0])})));
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

ev("DESTINOS.push({id:'D-2',nombre:'Mayorista Norte',proyecto:'COLGATE'},{id:'D-3',nombre:'Bodega Ñandú',proyecto:'COLGATE'},{id:'D-4',nombre:'Mayorista',proyecto:'COLGATE'})");
const nombresEsperados = [...new Set(JSON.parse(ev("JSON.stringify(destinosDesvio({proyecto:'COLGATE'}).map(x=>x.nombre))")))];
como('U-1', 'nuevo');
ev("S.form.proyecto='COLGATE';S.form.proyectoCat='COLGATE';S.form.desvio=true;render()"); await tick(80);
const campo = () => d.querySelector('#m_desvioDestino'), wrap = () => d.querySelector('[data-dd]'), panel = () => d.querySelector('#dd_desvioDestino');
const visibles = () => [...panel().querySelectorAll('[data-ddpick]')].filter(b => !b.hidden).map(b => b.dataset.ddpick);
T('D1 El campo ya no usa datalist ni el atributo list', !!campo() && !d.querySelector('datalist') && !campo().hasAttribute('list') && !leer('js/modulos/transporte.js').includes('datalist id="dl_desvioDestino"'));
T('D2 Las sugerencias son las que ya existían (mismo origen: DESTINOS del cliente), sin inventar ni duplicar', JSON.stringify([...panel().querySelectorAll('[data-ddpick]')].map(b => b.dataset.ddpick)) === JSON.stringify(nombresEsperados) && nombresEsperados.length >= 3 && nombresEsperados.includes('Mayorista') && nombresEsperados.includes('Bodega Ñandú'));
T('D3 La lista está cerrada al abrir la pantalla', panel().hidden === true && campo().getAttribute('aria-expanded') === 'false');
T('D4 La lista usa las mismas clases (cb-panel / cb-list) que los demás desplegables y no tiene estilos en línea', panel().classList.contains('cb-panel') && !!panel().querySelector('.cb-list') && !panel().hasAttribute('style') && !campo().hasAttribute('style'));
campo().focus(); campo().dispatchEvent(new w.FocusEvent('focusin', { bubbles: true })); await tick();
T('D5 Al entrar al campo se muestran todas las opciones', panel().hidden === false && visibles().length === nombresEsperados.length && campo().getAttribute('aria-expanded') === 'true', visibles());
await escribe(campo(), 'may'); 
T('D6 Al escribir se filtran las opciones (sin importar mayúsculas)', JSON.stringify(visibles().sort()) === JSON.stringify(nombresEsperados.filter(n => /may/i.test(n)).sort()), visibles());
await escribe(campo(), 'nandu');
T('D7 La búsqueda ignora acentos y eñes («nandu» encuentra «Ñandú»)', JSON.stringify(visibles()) === JSON.stringify(['Bodega Ñandú']), visibles());
await escribe(campo(), 'zzz');
T('D8 Sin coincidencias se avisa y el texto libre sigue siendo válido', panel().querySelector('.cb-empty').hidden === false && ev('S.form.desvioDestino') === 'zzz');
await escribe(campo(), 'Mayorista N');
const opt = panel().querySelector('[data-ddpick="Mayorista Norte"]');
await click(opt);
T('D9 Al elegir una opción el campo y el formulario guardan exactamente su nombre', campo().value === 'Mayorista Norte' && ev('S.form.desvioDestino') === 'Mayorista Norte', ev('S.form.desvioDestino'));
T('D10 Al elegir, la lista se cierra', panel().hidden === true);
campo().dispatchEvent(new w.FocusEvent('focusin', { bubbles: true })); await tick();
T('D11 La opción elegida queda marcada al volver a abrir', panel().querySelector('[data-ddpick="Mayorista Norte"]').getAttribute('aria-selected') === 'true' && panel().hidden === false);
await click(d.querySelector('h1,h2') || d.body);
T('D12 Un clic fuera de la lista la cierra', panel().hidden === true);
campo().dispatchEvent(new w.FocusEvent('focusin', { bubbles: true })); await tick();
campo().dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await tick();
T('D13 Escape cierra la lista', panel().hidden === true);
T('D14 Cambiar el valor sin elegir sugerencia (texto libre) también se conserva', (await escribe(campo(), 'Destino libre 77'), ev('S.form.desvioDestino') === 'Destino libre 77'));
/* desactivado (sin proyecto): no se abre */
ev("S.form.proyecto='';S.form.desvioDestino='';render()"); await tick(60);
T('D15 Sin cliente el campo está desactivado y la lista no existe/no se abre', campo().disabled === true && (!panel() || panel().hidden === true));
/* Registro completo con el destino elegido y recuperación del viaje */
como('U-1', 'nuevo');
ev(`(()=>{const f=S.form;Object.assign(f,{proyecto:'COLGATE',proyectoCat:'COLGATE',shipment:'DD-1',opl:'INTRANSIT',tipoViaje:'ONE WAY',tipoCarga:'KG',noCarga:'1',producto:'P',placaSel:'T-1',pilotoId:'P-1',rutaId:'R-0001',fechaPlanD:'2031-07-01',fechaPlanT:'08:00',placaArrastre:'PA-9',desvio:true});})()`);
ev('render()'); await tick(60);
campo().dispatchEvent(new w.FocusEvent('focusin', { bubbles: true })); await tick();
await click(panel().querySelector('[data-ddpick="Bodega Ñandú"]'));
await ev('ACT.guardar()'); await tick(250);
const fid = ev('S.form&&S.form.savedId'), ferr = ev('S.form&&S.form.err');
T('D16 El viaje se registra con el destino elegido (sin errores)', !!fid && !ferr, ferr);
const gv = fid && JSON.parse(ev(`JSON.stringify(API.verViaje?API.verViaje('U-1','${fid}'):DB.trips.find(t=>t.id==='${fid}'))`));
T('D17 El destino del desvío se guardó y se recupera igual', !!gv && gv.desvio === true && gv.desvioDestino === 'Bodega Ñandú', gv && [gv.desvio, gv.desvioDestino]);
/* el desvío se muestra en el detalle del viaje */
await ev(`ACT.detalle({id:'${fid}'})`); await tick(80);
T('D18 El detalle del viaje muestra el destino del desvío', /Desvío/.test(txt(d.querySelector('#app'))) && /Bodega Ñandú/.test(txt(d.querySelector('#app'))));
T('D19 Los demás campos del formulario siguen igual (Cliente, Ruta, horarios): no hay otros datalist en la pantalla de nuevo viaje', (como('U-1', 'nuevo'), !d.querySelector('#app datalist')));
T('D99 Sin errores de JavaScript', N.errs.length === 0, N.errs);
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
