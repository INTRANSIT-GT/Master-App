/* Pruebas de la INTERFAZ (jsdom, motor local con datos de ejemplo; no usa Supabase real): desplegable de Concepto en Gastos adicionales, cambio de concepto, sin recuadro «Revisión», vistas de Gerente/Proyectos. */


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



T('G0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);
let nFp = 0;
const nuevo = async uid => { como(uid, 'nuevo'); ev(`S.form.fechaPlanD='2033-01-${String(++nFp).padStart(2, '0')}'`); ev("S.form.proyecto='COLGATE';S.form.proyectoCat='COLGATE';S.form.pilotoId='P-1';S.form.placaSel='T-1';S.form.rutaId='R-0001';render()");
  for (const [i, v] of [['m_shipment', 'GX'], ['m_opl', 'INTRANSIT'], ['m_tipoViaje', 'ONE WAY'], ['m_tipoCarga', 'KG'], ['m_noCarga', '5'], ['m_producto', 'Prod'], ['m_placaArrastre', 'PA-1']]) await escribe(d.querySelector('#' + i), v); };
const cs = i => d.querySelector(`#ga_c${i}`);
const opts = el => [...el.querySelectorAll('option')].map(o => o.textContent);
const gm = () => JSON.parse(ev('JSON.stringify(S.form.gastosAdicionales)'));

for (const [uid, quien] of [['U-O', 'Operativo'], ['U-1', 'Administrador']]) {
  await nuevo(uid); await click(boton('+ Agregar gasto adicional'));
  const c = cs(0), ref = d.querySelector('#m_opl');
  T(`G1 ${quien}: Concepto es un desplegable (select) como los demás, no un cuadro de texto con lista del navegador`, c.tagName === 'SELECT' && ref.tagName === 'SELECT' && !c.hasAttribute('list') && !d.querySelector('datalist'));
  T(`G2 ${quien}: usa el mismo marcado y estilos que los otros desplegables (sin clases ni estilos propios) y la misma opción vacía «Selecciona»`, c.className === ref.className && c.getAttribute('style') === ref.getAttribute('style') && c.parentElement.className === ref.parentElement.className && opts(c)[0] === 'Selecciona' && opts(ref)[0] === 'Selecciona');
  T(`G3 ${quien}: conserva las opciones de conceptos de siempre`, JSON.stringify(opts(c).slice(1)) === JSON.stringify(['Parqueo', 'Alimentación', 'Peaje', 'Otro']), opts(c));
}

/* Cambiar el concepto después de elegirlo */
await nuevo('U-O'); await click(boton('+ Agregar gasto adicional'));
await escribe(cs(0), 'Parqueo'); await escribe(d.querySelector('#ga_i0'), '25');
T('G4 Se elige un concepto y queda en el formulario', gm()[0].concepto === 'Parqueo' && cs(0).value === 'Parqueo');
T('G5 El desplegable sigue ofreciendo TODAS las opciones después de elegir (no se filtra)', JSON.stringify(opts(cs(0)).slice(1)) === JSON.stringify(['Parqueo', 'Alimentación', 'Peaje', 'Otro']));
await escribe(cs(0), 'Peaje');
T('G6 Se puede cambiar por otro concepto; el importe y los demás datos no se pierden', gm().length === 1 && gm()[0].concepto === 'Peaje' && gm()[0].importe === '25' && cs(0).value === 'Peaje' && ev('S.form.shipment') === 'GX');
await escribe(cs(0), 'Alimentación'); await escribe(cs(0), 'Otro'); await escribe(cs(0), 'Peaje');
T('G7 Se puede cambiar varias veces seguidas', gm()[0].concepto === 'Peaje' && gm().length === 1);
await click(boton('+ Agregar gasto adicional')); await escribe(cs(1), 'Parqueo'); await escribe(d.querySelector('#ga_i1'), '10');
await escribe(cs(0), 'Otro');
T('G8 Cambiar el concepto de una fila no toca las demás filas', gm().length === 2 && gm()[0].concepto === 'Otro' && gm()[1].concepto === 'Parqueo' && gm()[1].importe === '10');
/* Ya no hay recuadro «Revisión» */
const zona = d.querySelector('#main').textContent;
T('G9 No aparece el recuadro con punto ni el texto «En revisión» / «Revisión:» en el espacio de Gastos adicionales', !d.querySelector('#gastosResumen') && !/En revisi[oó]n|Revisi[oó]n:/.test(txt(cs(0).closest('.card'))), txt(cs(0).closest('.card')).slice(-200));
/* Guardar: un solo viaje, un solo gasto por fila, con el concepto actualizado */
await click(boton('Quitar'));   /* quita la fila 1 (primer botón Quitar = fila 0) */
const g2 = gm();
await escribe(cs(0), 'Peaje');
const nT = ev('DB.trips.length'); await click(boton('GUARDAR VIAJE'));
const id = ev('S.form.savedId'), t = id ? JSON.parse(ev(`JSON.stringify(DB.trips.find(x=>x.id==='${id}'))`)) : null;
T('G10 Al guardar se crea un solo viaje con los gastos y el concepto actualizado, sin duplicados', !!t && ev('DB.trips.length') === nT + 1 && t.gastosAdicionales.length === 1 && t.gastosAdicionales[0].concepto === 'Peaje' && Number(t.gastosAdicionales[0].importe) === 10, [ev('S.form.err'), g2, t && t.gastosAdicionales]);

/* Viaje ya guardado: edición con sus permisos */
como('U-1', 'detalle'); ev(`go('detalle','${id}')`); await tick();
await click(d.querySelector('[data-act="editar"]'));
const ce = d.querySelector('#ga_c0');
T('G11 En la edición de un viaje guardado el concepto es el mismo desplegable y muestra el valor guardado', !!ce && ce.tagName === 'SELECT' && ce.value === 'Peaje', ce && ce.value);
await escribe(ce, 'Alimentación');
await escribe(d.querySelector('[data-motivo]') || d.querySelector('#motivo') || { dispatchEvent() {} }, 'Corrección de concepto'); ev("S.edit.motivo='Corrección de concepto'");
const nA = ev('DB.trips.length'); await click(boton('GUARDAR CAMBIOS') || boton('GUARDAR'));
const t2 = JSON.parse(ev(`JSON.stringify(DB.trips.find(x=>x.id==='${id}'))`));
T('G12 El cambio de concepto se guarda en el mismo viaje, sin duplicar gastos ni viajes', ev('DB.trips.length') === nA && t2.gastosAdicionales.length === 1 && t2.gastosAdicionales[0].concepto === 'Alimentación' && Number(t2.gastosAdicionales[0].importe) === 10 && t2.shipment === 'GX', [t2.gastosAdicionales, ev('S.edit && S.edit.err'), toasts()]);

/* Un concepto distinto guardado antes (texto libre) no se pierde */
ev(`DB.trips.find(x=>x.id==='${id}').gastosAdicionales=[{concepto:'Pernocta',importe:80}]`);
como('U-1', 'detalle'); ev(`go('detalle','${id}')`); await tick(); await click(d.querySelector('[data-act="editar"]'));
T('G13 Un concepto antiguo (texto libre) se conserva como opción seleccionada y se puede cambiar', d.querySelector('#ga_c0').value === 'Pernocta' && opts(d.querySelector('#ga_c0')).includes('Parqueo'));
ev('S.edit=null'); 

/* Gerente y Proyectos siguen viéndolos igual */
ev(`DB.trips.find(x=>x.id==='${id}').gastosAdicionales=[{concepto:'Peaje',importe:45}]`);
for (const [uid, quien] of [['U-G', 'Gerente de Transporte'], ['U-P1', 'Proyectos'], ['U-1', 'Administrador']]) {
  como(uid, 'detalle'); ev(`go('detalle','${id}')`); await tick();
  const m = txt(d.querySelector('#main'));
  T(`G14 ${quien}: sigue viendo los gastos adicionales del viaje (concepto, importe y total)`, /Gastos adicionales/.test(m) && /Peaje/.test(m) && /45\.00/.test(m), m.slice(0, 120));
}
como('U-T', 'torre'); ev(`go('detalle','${id}')`); await tick();
T('G15 Torre sigue sin ver los gastos adicionales (permisos sin cambios)', !/Gastos adicionales|Peaje/.test(txt(d.querySelector('#main') || d.body)));
/* Móvil */
await nuevo('U-O'); await click(boton('+ Agregar gasto adicional')); ev('PREF.phone=true;window.innerWidth=390;render()');
T('G16 En modo móvil el desplegable de Concepto es el mismo select y se puede cambiar', ev('esMovil()') === true && cs(0).tagName === 'SELECT' && (await escribe(cs(0), 'Otro'), await escribe(cs(0), 'Peaje'), gm()[0].concepto === 'Peaje'));
ev('PREF.phone=false;window.innerWidth=1280;render()');
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
