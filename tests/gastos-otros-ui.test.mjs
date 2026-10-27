/* Pruebas: «Otro/Otros» en Gastos adicionales exige «Especifique el gasto» (formulario nuevo, edición, motor/servidor y lectura). jsdom con el motor local; no usa Supabase real. */

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
  w.eval(FIXTURE);
  /* Acceso por sección (matriz «sec_<pantalla>»): todos los perfiles de esta prueba entran a todo, salvo Torre (solo lo suyo) */
  w.eval(`SECCIONES.forEach(x=>Object.keys(ROLES).forEach(r=>{if(r==='ADMIN')return;DB.permisos.push({rol:r,permiso:'sec_'+x[0],habilitado:r==='TORRE'?['inicio','viajes','todos','torre','ayuda'].includes(x[0]):true});}))`);
  return { w, errs };
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
let nFp = 0;
const nuevo = async uid => { como(uid, 'nuevo'); ev(`S.form.fechaPlanD='2034-01-${String(++nFp).padStart(2, '0')}'`); ev("S.form.proyecto='COLGATE';S.form.proyectoCat='COLGATE';S.form.pilotoId='P-1';S.form.placaSel='T-1';S.form.rutaId='R-0001';render()");
  for (const [i, v] of [['m_shipment', 'GO'], ['m_opl', 'INTRANSIT'], ['m_tipoViaje', 'ONE WAY'], ['m_tipoCarga', 'KG'], ['m_noCarga', '5'], ['m_producto', 'Prod'], ['m_placaArrastre', 'PA-1']]) await escribe(d.querySelector('#' + i), v); };
const cs = i => d.querySelector(`#ga_c${i}`), dt = i => d.querySelector(`#ga_d${i}`);
const gm = () => JSON.parse(ev('JSON.stringify(S.form.gastosAdicionales)'));
const err = () => ev('S.form&&S.form.err');
const MSG = 'Debe especificar a qué se refiere con “Otros”.';

/* 1. Aparece / desaparece el campo */
await nuevo('U-O'); await click(boton('+ Agregar gasto adicional'));
T('O1 Con «Selecciona» o un concepto normal NO se muestra «Especifique el gasto»', !dt(0) && (await escribe(cs(0), 'Peaje'), !dt(0)));
await escribe(cs(0), 'Otro');
const lab = dt(0) && d.querySelector('label[for="ga_d0"]');
T('O2 Al elegir «Otro» aparece el campo con la etiqueta «Especifique el gasto» y la ayuda pedida', !!dt(0) && /^Especifique el gasto/.test(txt(lab)) && /Describa qué gasto adicional necesita reportar/.test(txt(dt(0).parentElement)), txt(dt(0) && dt(0).parentElement));
T('O3 El campo se integra con los demás (mismo tipo de campo y mismas clases de grupo) y es obligatorio', dt(0).tagName === 'INPUT' && dt(0).type === 'text' && dt(0).parentElement.className === d.querySelector('#m_producto').parentElement.className && dt(0).getAttribute('aria-required') === 'true' && dt(0).className === d.querySelector('#m_producto').className);
await escribe(dt(0), 'Cargador de celular'); await escribe(cs(0), 'Alimentación');
T('O4 Al cambiar a otro concepto el campo se oculta, deja de ser obligatorio y su texto se descarta', !dt(0) && gm()[0].concepto === 'Alimentación' && !gm()[0].detalle);
await escribe(cs(0), 'Otro');
T('O5 Al volver a «Otro» el campo reaparece vacío', !!dt(0) && dt(0).value === '');

/* 2. Validación al guardar */
await escribe(d.querySelector('#ga_i0'), '30');
const n0 = ev('DB.trips.length'); await click(boton('GUARDAR VIAJE'));
T('O6 «Otro» sin explicación: no guarda y muestra el mensaje claro', ev('DB.trips.length') === n0 && err() === MSG && !ev('S.form.savedId'), err());
await escribe(dt(0), '   '); await click(boton('GUARDAR VIAJE'));
T('O7 Una explicación solo con espacios tampoco vale', ev('DB.trips.length') === n0 && err() === MSG);
await escribe(dt(0), 'Cargador de celular'); await click(boton('GUARDAR VIAJE'));
const id = ev('S.form.savedId');
T('O8 Con explicación se guarda normalmente', !!id && ev('DB.trips.length') === n0 + 1 && !err(), err());
const t = id && trip(id);
T('O9 Se guardan por separado el concepto «Otro» y la explicación (no se reemplaza uno por otro)', !!t && t.gastosAdicionales.length === 1 && t.gastosAdicionales[0].concepto === 'Otro' && t.gastosAdicionales[0].detalle === 'Cargador de celular' && Number(t.gastosAdicionales[0].importe) === 30, t && t.gastosAdicionales);

/* 3. Otro concepto sin exigir comentario */
await nuevo('U-O'); await click(boton('+ Agregar gasto adicional')); await escribe(cs(0), 'Peaje'); await escribe(d.querySelector('#ga_i0'), '12');
await click(boton('GUARDAR VIAJE')); const id2 = ev('S.form.savedId');
T('O10 Con un concepto normal el flujo habitual no pide comentario y no guarda «detalle»', !!id2 && !err() && !('detalle' in trip(id2).gastosAdicionales[0]), err());

/* 4. Volver a abrir / editar */
como('U-1', 'detalle'); ev(`go('detalle','${id}')`); await tick();
T('O11 El detalle del viaje muestra concepto y explicación juntos', /Otro/.test(txt(d.querySelector('#main'))) && /Cargador de celular/.test(txt(d.querySelector('#main'))) && /30\.00/.test(txt(d.querySelector('#main'))));
await click(d.querySelector('[data-act="editar"]'));
T('O12 Al reabrir para editar, la explicación sigue ahí y el concepto sigue siendo «Otro»', cs(0).value === 'Otro' && !!dt(0) && dt(0).value === 'Cargador de celular', dt(0) && dt(0).value);
await escribe(dt(0), ''); ev("S.edit.motivo='Prueba'");
await click(d.querySelector('[data-act="editSave"]'));
T('O13 Al editar, vaciar la explicación bloquea el guardado y el viaje conserva la anterior', trip(id).gastosAdicionales[0].detalle === 'Cargador de celular', [trip(id).gastosAdicionales, ev('S.edit&&S.edit.err')]);
await escribe(dt(0), 'Cargador nuevo'); ev("S.edit.motivo='Prueba'");
await click(d.querySelector('[data-act="editSave"]'));
T('O14 Al editar con explicación se guarda el cambio en el mismo viaje', trip(id).gastosAdicionales[0].detalle === 'Cargador nuevo' && trip(id).gastosAdicionales.length === 1, [trip(id).gastosAdicionales, [...d.querySelectorAll('#toasts .toast')].map(txt)]);
ev('S.edit=null');

/* 5. Quién lo lee */
for (const [uid, quien] of [['U-G', 'Gerente de Transporte'], ['U-P1', 'Proyectos'], ['U-1', 'Administrador']]) {
  como(uid, 'detalle'); ev(`go('detalle','${id}')`); await tick();
  const m = txt(d.querySelector('#main'));
  T(`O15 ${quien}: ve «Otro» con su explicación`, /Otro/.test(m) && /Cargador nuevo/.test(m), m.slice(0, 160));
}
como('U-T', 'torre'); ev(`go('detalle','${id}')`); await tick();
T('O16 Quien no veía los gastos adicionales sigue sin verlos (permisos intactos)', !/Gastos adicionales|Cargador/.test(txt(d.querySelector('#main') || d.body)));

/* 6. El motor/servidor aplica la regla en cualquier flujo */
const base = { cliente: 'COLGATE', proyectoCat: 'COLGATE', pilotoId: 'P-2', unidadId: 'T-2', rutaId: 'R-0001', shipment: 'API', opl: 'INTRANSIT', tipoViaje: 'ONE WAY', tipoCarga: 'KG', noCarga: '1', producto: 'P', placaArrastre: 'PA-1', fechaPlan: '2034-03-01T08:00' };
const llama = (op, args) => JSON.parse(ev(`JSON.stringify((()=>{try{return {ok:true,r:API.${op}(...${JSON.stringify(args)})}}catch(e){return {ok:false,m:e.message}}})())`));
const c1 = llama('crearViaje', ['U-1', { ...base, gastosAdicionales: [{ concepto: 'Otros', importe: 5 }] }]);
T('O17 Crear por la API con «Otros» sin explicación se rechaza (aunque el formulario se omita)', c1.ok === false && c1.m === MSG, c1);
const c2 = llama('crearViaje', ['U-1', { ...base, fechaPlan: '2034-03-02T08:00', gastosAdicionales: [{ concepto: 'otros', importe: 5, detalle: 'x'.repeat(201) }] }]);
T('O18 La explicación tiene un máximo de 200 caracteres', c2.ok === false && /200/.test(c2.m), c2);
const c3 = llama('crearViaje', ['U-1', { ...base, fechaPlan: '2034-03-03T08:00', gastosAdicionales: [{ concepto: 'Peaje', importe: 5, detalle: 'no debe guardarse' }] }]);
T('O19 Un concepto distinto no guarda explicación aunque se envíe', c3.ok && !('detalle' in trip(c3.r.id).gastosAdicionales[0]), c3);
const e1 = llama('editarViaje', ['U-1', c3.r.id, { gastosAdicionales: [{ concepto: 'Otro', importe: 5 }] }, 'x']);
T('O20 Editar por la API a «Otro» sin explicación también se rechaza', e1.ok === false && e1.m === MSG, e1);
/* viaje anterior a esta regla: «Otro» sin explicación que no cambia no bloquea otras ediciones */
ev(`DB.trips.find(x=>x.id==='${c3.r.id}').gastosAdicionales=[{concepto:'Otro',importe:5}]`);
const e2 = llama('editarViaje', ['U-1', c3.r.id, { gastosAdicionales: [{ concepto: 'Otro', importe: 5 }], producto: 'Nuevo' }, 'x']);
T('O21 Un «Otro» antiguo sin explicación, sin cambios, no impide editar otros datos', e2.ok, e2);
T('O22 Sin errores de JavaScript al final', N.errs.length === 0, N.errs);
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
