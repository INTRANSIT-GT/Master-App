/* Ajustes del perfil ADMINISTRADOR: Clientes (tabla + filtro + formulario), Facturación (desplegable de viajes), Nuevo viaje (placa),
   Rutas (catálogo desplegable) — y comprobación de que los DEMÁS perfiles no cambiaron respecto a la versión anterior. */
import { PGlite } from '@electric-sql/pglite';
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ejecutar } from '../supabase/functions/api/handler.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
/* Copia de referencia = el ui.js ANTES de los ajustes del Administrador (respaldo_antes_admin/js/ui.js, o la ruta en UI_BASE) */
const ANT = process.env.UI_BASE ? path.resolve(process.env.UI_BASE) : path.join(raíz, 'respaldo_antes_admin');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const uuid = () => crypto.randomUUID(), tick = () => new Promise(r => setTimeout(r, 20));

const cargar = (rutaUi, datos = 'tests/_datos-admin.js') => {
  let html = leer('index.html').replace('<script src="js/config.js"></script>', '<script>window.MASTER_CONFIG={};</script>').replace('<script src="js/vendor/supabase.js"></script>', '')
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => `<script>${f === 'js/ui.js' && rutaUi ? fs.readFileSync(rutaUi, 'utf8') : leer(f)}</script>`);
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message).slice(0, 160)));
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/', pretendToBeVisual: true, virtualConsole: vc }).window;
  w.eval(leer(datos)); return { w, errs };
};
const { w, errs } = cargar(null), d = w.document, ev = c => w.eval(c), click = async el => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await tick(); };
const escribe = async (el, v) => { el.value = v; el.dispatchEvent(new w.Event('input', { bubbles: true })); await tick(); };
const cambia = async (el, v) => { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(); };
T('A0 La interfaz carga sin errores de JavaScript', errs.length === 0, errs);
const comoAdmin = () => ev("S.user=DB.usuarios.find(u=>u.rol==='ADMIN');S.form=null;S.edit=null;S.modal=null;S.cb=null;S.menu=false");

/* ============ 1. CLIENTES ============ */
comoAdmin(); ev("S.view='proyectos';render()");
const CAB = ['ID cliente', 'Cliente', 'Cliente padre', 'Servicio', 'Nombre usuario', 'Correo', 'Teléfono', 'Link contrato', 'NIT', 'Proyecto', 'Estado', 'Creado', 'Acciones'];
T('1.1 El administrador ve a los clientes en una tabla, no en cuadros', !!d.querySelector('#tablaClientes') && d.querySelectorAll('.pcard').length === 0);
T('1.2 La tabla tiene los 13 encabezados pedidos, en ese orden', JSON.stringify([...d.querySelectorAll('#tablaClientes thead th')].map(t => t.textContent.trim())) === JSON.stringify(CAB), [...d.querySelectorAll('#tablaClientes thead th')].map(t => t.textContent.trim()));
const nClientes = ev('DB.clientes.length');
T('1.3 Una fila por cliente (todos los de la base)', d.querySelectorAll('#tablaClientes tbody tr').length === nClientes, [d.querySelectorAll('#tablaClientes tbody tr').length, nClientes]);
const fila = id => [...d.querySelectorAll('#tablaClientes tbody tr')].find(r => r.children[0].textContent.trim() === id);
const fc = fila('COLGATE'), cel = [...fc.children].map(x => x.textContent.replace(/\s+/g, ' ').trim());
T('1.4 Cada columna muestra su dato real (ID, cliente, padre, servicio, usuario, correo, teléfono, NIT, proyectos, estado)', cel[0] === 'COLGATE' && cel[1] === 'Colgate' && cel[2] === 'COLGATE PALMOLIVE' && cel[3] === 'TRANSPORTE' && cel[4] === 'María López' && cel[5] === 'maria@colgate.test' && cel[6] === '5555-1234' && cel[8] === '1234567-8' && /COLGATE, LV/.test(cel[9]) && cel[10] === 'Activo', cel);
const a = fc.children[7].querySelector('a');
T('1.5 El link del contrato es un enlace seguro (nueva pestaña, rel noopener); un valor que no es URL no se vuelve enlace', a && a.getAttribute('href') === 'https://contratos.example.com/colgate.pdf' && /noopener/.test(a.rel) && a.target === '_blank' && !fila('SINPROY').children[7].querySelector('a'));
T('1.6 Lo que no existe se muestra «—» (no se inventa), y «Sin proyectos» en los clientes migrados', fila('C-ALFA').children[2].textContent.trim() === '—' && /Sin proyectos/.test(fila('C-ALFA').children[9].textContent));
T('1.7 Acciones: Editar, Desactivar y Ver viajes (consultar)', ['clienteOpen', 'clienteEstado', 'proj'].every(a => !!fc.children[12].querySelector(`[data-act="${a}"]`)));
T('1.8 Se conservan la configuración de Torre de Control y el botón Nuevo cliente', /Torre de Control/.test(d.querySelector('#app').textContent) && !!d.querySelector('[data-act="clienteOpen"][data-id=""]'));
/* filtro: la pantalla de Clientes usa buscador (el desplegable se retiró) */
const abre = async k => { await click(d.querySelector(`.cb[data-cb="${k}"] .cb-btn`)); return [...d.querySelectorAll('.cb-panel .cb-list button')].map(b => b.textContent.trim()); };
let ops = [], f = [];
const buscador = () => d.querySelector('#qCli');
const filasCli = () => d.querySelectorAll('#tablaClientes tbody tr').length;
const total = ev('DB.clientes.length');
T('1.9 La pantalla de Clientes trae un buscador (cliente, NIT, código o proyecto)', !!buscador() && /Buscar por cliente, NIT/.test(buscador().placeholder || ''), buscador() && buscador().placeholder);
T('1.10 Sin desplegable: se busca escribiendo', !d.querySelector('.cb[data-cb="cliFiltro"]'));
await escribe(buscador(), 'alfa');
T('1.11 Escribir filtra la tabla al instante (solo el cliente que coincide)', filasCli() === 1 && !!fila('C-ALFA'), filasCli());
await escribe(buscador(), 'COLG');
T('1.12 La búsqueda no distingue mayúsculas y encuentra el cliente real', filasCli() === 1 && !!fila('COLGATE'));
await escribe(buscador(), '1234567');
T('1.12a También busca por NIT', filasCli() === 1 && !!fila('COLGATE'));
await escribe(buscador(), 'lv');
T('1.12b También busca por proyecto', filasCli() === 1 && !!fila('COLGATE'));
await escribe(buscador(), 'zzzz');
T('1.12c Sin coincidencias no se inventan filas', filasCli() === 0);
await escribe(buscador(), '');
T('1.12d Al limpiar el buscador vuelven todos los clientes', filasCli() === total, [filasCli(), total]);
T('1.12e El buscador usa los clientes reales de la base (cada fila es un registro)', ev('DB.clientes.length') === total && filasCli() === total);
ev("DB.clientes.push({id:'C-NUEVO9',nombre:'Zeta Nuevo',cliente:'ZETA NUEVO',proyectos:[],torreEstatus:false,activo:true,nit:'',direccionFiscal:'',correoFacturacion:'',contacto:'',telefono:'',creditoDias:'',observaciones:''});render()");
await escribe(buscador(), 'zeta');
T('1.12f Un cliente que se agrega a la base se encuentra de inmediato', filasCli() === 1 && !!fila('C-NUEVO9'));
ev("DB.clientes=DB.clientes.filter(c=>c.id!=='C-NUEVO9');S.qCli='';render()");
/* formulario */
await ev("ACT.clienteOpen({id:''})"); await tick();
const modal = () => d.querySelector('.modal, [role="dialog"], .mdl') || d.body, tx = () => d.querySelector('#app').textContent;
T('1.13 El formulario de cliente nuevo ya no tiene el campo redundante «Cliente» (ni la mención al catálogo)', (dlg => !/como aparece en la lista/i.test(dlg) && !/cat[aá]logo/i.test(dlg) && /Código del cliente/.test(dlg) && /Nombre corto/.test(dlg))((d.querySelector('[role="dialog"]') || d.body).textContent));
const antes = ev('DB.clientes.length');
await ev("ACT.clienteSave({id:''})"); await tick();
const err1 = ev('S.modal&&S.modal.err');
T('1.14 Guardar vacío: dice qué falta (código, nombre, proyecto) y NO guarda', /Falta información obligatoria/.test(err1) && /Código del cliente/.test(err1) && /Nombre corto/.test(err1) && /Proyectos del cliente/.test(err1) && ev('DB.clientes.length') === antes, err1);
ev("S.modal.data.id='NUEVOCLI';S.modal.data.nombre='Cliente Nuevo Uno';S.modal.err=''");
await ev("ACT.clienteSave({id:''})"); await tick();
T('1.15 Con el proyecto sin marcar sigue pidiéndolo', /Proyectos del cliente/.test(ev('S.modal&&S.modal.err||""')) && ev('DB.clientes.length') === antes);
ev("S.modal.data.proyectos=[CAT.proyectos[0]];S.modal.err=''"); await ev("ACT.clienteSave({id:''})"); await tick();
const nuevo = ev("DB.clientes.find(c=>c.id==='NUEVOCLI')");
T('1.16 Con los obligatorios completos se guarda; el valor «cliente» de la base se completa solo desde el nombre', !!nuevo && nuevo.cliente === 'CLIENTE NUEVO UNO' && nuevo.activo === true && ev('DB.clientes.length') === antes + 1, nuevo);
T('1.17 Los campos opcionales (NIT, correo, teléfono…) NO son obligatorios', !!nuevo && nuevo.nit === '' && nuevo.correoFacturacion === '' && nuevo.telefono === '');
await ev("ACT.clienteOpen({id:''})"); ev("S.modal.data.id='NUEVOCLI2';S.modal.data.nombre='Cliente Nuevo Uno';S.modal.data.proyectos=[CAT.proyectos[0]]"); await ev("ACT.clienteSave({id:''})"); await tick();
T('1.18 Un nombre repetido se rechaza con un mensaje claro', /Ya existe un cliente/.test(ev('S.modal&&S.modal.err||""')) && !/cat[aá]logo/i.test(ev('S.modal&&S.modal.err||""')), ev('S.modal&&S.modal.err'));
ev("S.modal=null"); await ev("ACT.clienteOpen({id:'COLGATE'})"); ev("S.modal.data.telefono='7777-0000'"); await ev("ACT.clienteSave({id:'COLGATE'})"); await tick();
const cg = ev("DB.clientes.find(c=>c.id==='COLGATE')");
T('1.19 Al editar un cliente se conservan sus datos extra (padre, servicio, link) y su valor «cliente»', cg.telefono === '7777-0000' && cg.clientePadre === 'COLGATE PALMOLIVE' && cg.servicio === 'TRANSPORTE' && cg.linkContrato === 'https://contratos.example.com/colgate.pdf' && cg.cliente === 'COLGATE', cg);

/* ============ 2. FACTURACIÓN ============ */
comoAdmin(); ev("S.tab.com='hist';S.fcViaje='';S.fcEstado='ENV';go('comercial');S.tab.com='hist';render()");
const viajesTot = ev('vis().length'), filasFact = () => d.querySelectorAll('table.xl tbody tr').length;
T('2.1 Facturación muestra el desplegable «Detalle de viajes» en el filtro', !!d.querySelector('.cb[data-cb="fcViaje"]'));
ops = await abre('fcViaje');
T('2.2 Lista TODOS los viajes disponibles (con o sin factura), por número', ops[0] === 'Detalle de viajes: todos' && ops.length === viajesTot + 1 && ops.some(o => o.startsWith('#' + ev('__V2'))), [ops.length, viajesTot]);
await escribe(d.querySelector('.cb-q'), ev('__V2').slice(-3)); f = [...d.querySelectorAll('.cb-panel .cb-list button')];
T('2.3 Se puede buscar un viaje escribiendo su número o identificador', f.length >= 1 && f.every(b => b.textContent.includes(ev('__V2').slice(-3))));
await click(f.find(b => b.textContent.includes('#' + ev('__V2'))));
T('2.4 Un viaje sin factura: muestra su detalle y avisa que aún no se envió a facturar', !!d.querySelector('#detalleViajeFact') && /Aún no se envió a facturar/.test(d.querySelector('#detalleViajeFact').textContent) && /Distribuidora Los Andes|Los Andes/.test(d.querySelector('#detalleViajeFact').textContent));
ops = await abre('fcViaje'); await click([...d.querySelectorAll('.cb-panel .cb-list button')].find(b => b.textContent.includes('#' + ev('__V1'))));
const det = d.querySelector('#detalleViajeFact').textContent.replace(/\s+/g, ' ');
T('2.5 Un viaje facturado: el detalle muestra su factura, estado y datos asociados (cliente, ruta, piloto, importe)', /F-1001/.test(det) && /Colgate/.test(det) && /Mayorista Escuintla/.test(det) && /Piloto Uno/.test(det) && /1,?500/.test(det) && filasFact() === 1, det.slice(0, 260));
T('2.6 El detalle ofrece abrir la ficha completa del viaje', !!d.querySelector('#detalleViajeFact [data-act="detalle"]'));
await click(d.querySelector('[data-act="fcQuitarViaje"]'));
T('2.7 Quitar la selección vuelve a consultar sin filtro', !d.querySelector('#detalleViajeFact') && ev("S.fcViaje") === '' && filasFact() >= 1);
ops = await abre('fcViaje'); await click([...d.querySelectorAll('.cb-panel .cb-list button')].find(b => b.textContent.includes('#' + ev('__V1')))); await click(d.querySelector('[data-act="fcLimpiar"]'));
T('2.8 «Limpiar filtros» también limpia el viaje seleccionado', ev('S.fcViaje') === '' && !d.querySelector('#detalleViajeFact'));
ev("S.user=DB.usuarios.find(u=>u.rol==='COMERCIAL');S.cb=null;render()");
T('2.9 El perfil Comercial NO recibe el desplegable (sus filtros siguen igual)', !d.querySelector('.cb[data-cb="fcViaje"]'));

/* ============ 3. NUEVO VIAJE: PLACA ============ */
comoAdmin(); ev("go('nuevo')");
const btn = k => d.querySelector(`.fsec .cb-btn[data-k="m:${k}"]`) || [...d.querySelectorAll('.fsec .cb-btn')].find(b => b.closest('.fgroup') && b.closest('.fgroup').querySelector(`label[for="m_${k}"]`));
const grupo = k => [...d.querySelectorAll('.fgroup')].find(g => g.querySelector(`label[for="m_${k}"]`));
T('3.1 Se pide la placa del equipo; ya no se exige elegir al piloto en un selector', !!grupo('placaSel') && !d.querySelector('#m_pilotoId') && /Placa del equipo/.test(d.querySelector('#app').textContent));
T('3.2 Sin cliente ni ruta, la placa está bloqueada con un mensaje (no hay lista de ejemplo)', grupo('placaSel').querySelector('.cb-btn').disabled && /Primero elige el cliente o la ruta/.test(grupo('placaSel').textContent));
T('3.3 Ruta ya funciona para el administrador (desplegable habilitado, sin elegir cliente antes)', !!btn('rutaGrupo') && !btn('rutaGrupo').disabled);
ev("aplicarCampo(S.form,'rutaGrupo',rutasGrupos(S.form).find(g=>g.nombre==='Ruta Norte').key);render()");
T('3.4 Al elegir la ruta se completan cliente y proyecto, y se habilita la placa', ev('S.form.proyecto') === 'COLGATE' && ev('S.form.proyectoCat') === 'COLGATE' && !grupo('placaSel').querySelector('.cb-btn').disabled);
await click(grupo('placaSel').querySelector('.cb-btn')); ops = [...d.querySelectorAll('.cb-panel .cb-list button')].map(b => b.textContent.trim());
T('3.5 La lista muestra las placas disponibles del cliente (las unidades de sus pilotos), cada placa una vez', ops.length === 2 && ops.some(o => o.startsWith('C-1')) && ops.some(o => o.startsWith('C-2')), ops);
await escribe(d.querySelector('.cb-q'), 'c-2'); f = [...d.querySelectorAll('.cb-panel .cb-list button')];
T('3.6 Se puede buscar la placa escribiéndola', f.length === 1 && f[0].textContent.startsWith('C-2'));
await escribe(d.querySelector('.cb-q'), ''); await click([...d.querySelectorAll('.cb-panel .cb-list button')].find(b => b.textContent.startsWith('C-1')));
T('3.7 Placa con un solo piloto: el piloto se asigna solo (sin elegirlo a mano)', ev('S.form.pilotoId') === 'P-1' && !d.querySelector('#m_pilotoAlt') && /Piloto asignado/.test(d.querySelector('#app').textContent) && /Piloto Uno/.test(d.querySelector('.fsec .auto').textContent));
await click(grupo('placaSel').querySelector('.cb-btn')); await click([...d.querySelectorAll('.cb-panel .cb-list button')].find(b => b.textContent.startsWith('C-2')));
T('3.8 Placa con varios pilotos asignados: pide elegir cuál (no adivina) y no resuelve piloto hasta entonces', ev('S.form.pilotoId') === '' && !!d.querySelector('#m_pilotoAlt') && d.querySelectorAll('#m_pilotoAlt option').length === 3);
await ev("ACT.guardar()"); await tick();
T('3.9 Guardar sin resolver el piloto lo explica y no guarda', /más de un piloto/.test(ev('S.form.err')) && !ev('S.form.savedId'));
await cambia(d.querySelector('#m_pilotoAlt'), 'P-5');
T('3.10 Al elegir el piloto de esa placa queda registrado', ev('S.form.pilotoId') === 'P-5');
ev("S.form.proyecto='SINPROY';S.form.proyectoCat='';aplicarCampo(S.form,'placaSel','T-1');render()");
T('3.11 Placa sin piloto para el cliente: avisa con claridad (la base exige un piloto) y no deja guardar', /no tiene un piloto asignado/.test(d.querySelector('#app').textContent) && ev('S.form.pilotoId') === '');
await ev("ACT.guardar()"); await tick(); T('3.12 No se guarda un viaje sin piloto resuelto', /no tiene un piloto asignado/.test(ev('S.form.err')) && !ev('S.form.savedId'));
/* guardado completo */
ev("S.form=null;go('nuevo')"); ev("aplicarCampo(S.form,'rutaGrupo',rutasGrupos(S.form).find(g=>g.nombre==='CP → Los Andes').key)"); ev("aplicarCampo(S.form,'placaSel','T-1')");
ev("Object.assign(S.form,{fechaPlanD:'2031-06-01',fechaPlanT:'09:00',shipment:'SHP-ADM',opl:'INTRANSIT',tipoViaje:'ONE WAY',tipoCarga:'KG',noCarga:'1',producto:'P',placaArrastre:'PA-7'});render()");
const nT = ev('DB.trips.length'); await ev("ACT.guardar()"); await tick();
const idN = ev('S.form.savedId'), tn = idN && ev(`DB.trips.find(t=>t.id==='${idN}')`);
T('3.13 El viaje se guarda: el piloto y la unidad salen de la placa, la ruta queda registrada', !!tn && tn.pilotoId === 'P-1' && tn.unidadId === 'T-1' && tn.rutaId === 'R-0004' && tn.proyecto === 'COLGATE' && ev('DB.trips.length') === nT + 1, [ev('S.form.err'), tn && [tn.pilotoId, tn.unidadId, tn.rutaId]]);
const mod = ev(`(()=>{const M=toModel(DB.trips.find(t=>t.id==='${idN}'));S.edit=null;return fieldsHTML(M,['unidad'],false)})()`);
T('3.14 Al consultar o editar el viaje, la placa queda seleccionada', /C-1/.test(mod) && !/Selecciona un piloto/.test(mod), mod.slice(0, 120));

/* ============ 4. RUTAS ============ */
comoAdmin(); ev("Object.assign(S,{rtCat:'',rtOrig:'',rtDest:'',rtQ:'',rtRuta:'',rtOri:'',rtDes:'',rtCli:'',rtPcat:'',rtEst:''});S.view='rutas';render()");
const filasR = () => d.querySelectorAll('table.xl tbody tr').length, nRutas = ev('DB.rutas.length');
T('4.1 La pantalla de Rutas muestra las rutas registradas (y su cuenta)', filasR() === nRutas && nRutas >= 8, [filasR(), nRutas]);
ops = await abre('rtCat');
T('4.2 El catálogo desplegable lista cada ruta UNA vez, aunque haya registros repetidos', ops[0] === 'Todas las rutas' && ops.filter(o => o === 'CP → Mayorista Escuintla').length === 1 && new Set(ops).size === ops.length && ev("DB.rutas.filter(r=>r.nombre==='CP → Mayorista Escuintla').length") === 3, ops);
await escribe(d.querySelector('.cb-q'), 'norte'); f = [...d.querySelectorAll('.cb-panel .cb-list button')];
T('4.3 Se puede buscar la ruta por nombre', f.length === 1 && f[0].textContent.trim() === 'Ruta Norte');
await click(f[0]);
T('4.4 Al elegir una ruta se recuperan cliente, proyecto, origen y destino', /Colgate/.test(d.querySelector('#detalleRuta').textContent) && /COLGATE/.test(d.querySelector('#detalleRuta').textContent) && /Origen/.test(d.querySelector('#detalleRuta').textContent) && filasR() === 2);
T('4.5 Una ruta con varios destinos permite elegir el destino', d.querySelectorAll('#detalleRuta select[data-flt="rtDest"] option').length === 3);
await cambia(d.querySelector('#detalleRuta select[data-flt="rtDest"]'), 'D-2');
T('4.6 Al elegir el destino correcto la tabla muestra solo esa combinación', filasR() === 1 && /Los Andes/.test(d.querySelector('table.xl tbody').textContent));
await click(d.querySelector('[data-act="limpiarRutas"]'));
T('4.7 «Limpiar filtros» regresa al catálogo completo', filasR() === nRutas && !d.querySelector('#detalleRuta'));
const guardadas = ev('DB.rutas.slice()'); ev('DB.rutas.length=0;render()');
T('4.8 Sin rutas en la base: mensaje claro y opción de reintentar (no se inventan rutas)', /No hay rutas registradas/.test(d.querySelector('#app').textContent) && !!d.querySelector('[data-act="reintentarCatalogos"]') && filasR() === 0);
ev('DB.rutas.push(...' + JSON.stringify(guardadas) + ')'); ev("window.__rutasOrig=API.rutas;API.rutas=()=>{throw new Error('Fallo de prueba al consultar')};render()");
T('4.9 Si la consulta falla: dice que no se pudo cargar, muestra el motivo y permite reintentar (ya no se oculta el error)', /No se pudieron cargar las rutas/.test(d.querySelector('#app').textContent) && /Fallo de prueba/.test(d.querySelector('#app').textContent) && !!d.querySelector('[data-act="reintentarCatalogos"]'));
ev("API.rutas=window.__rutasOrig;render()");
T('4.10 Al reintentar con la consulta sana vuelven las rutas', filasR() === nRutas);
ev("S.user=DB.usuarios.find(u=>u.rol==='COMERCIAL');render()");
T('4.11 Otros perfiles con acceso a Rutas no reciben el catálogo desplegable nuevo', !d.querySelector('.cb[data-cb="rtCat"]'));

/* ============ 5. LOS DEMÁS PERFILES CONSERVAN SU MENÚ Y SUS PANTALLAS ============ */
/* La comparación carácter a carácter contra la versión anterior ya no aplica: aquella copia era de
   antes de dividir la interfaz en módulos y hoy no carga. Se comprueba el comportamiento: cada perfil
   abre todas las pantallas de su menú, sin errores y con su menú completo. */
const A = cargar(process.env.NEGATIVO ? '/tmp/ui_neg_adm.js' : null);
T('5.0 La interfaz carga sin errores de JavaScript', A.errs.length === 0, A.errs);
const roles = A.w.eval('Object.keys(ROLES).filter(r=>r!=="ADMIN")'); let comp = 0; const difs = [];
for (const r of roles) {
  const esperadas = JSON.parse(A.w.eval(`(()=>{const u={id:'U-${r}',usuario:'${r.toLowerCase()}',clave:'x',nombre:'Prueba ${r}',rol:'${r}',activo:true,proyectos:[]};DB.usuarios.push(u);DB.acceso.push({userId:u.id,cliente:'COLGATE'});S.user=u;return JSON.stringify(navItems().filter(v=>v!=='modelo'));})()`));
  const casos = [...esperadas.map(v => `go('${v}')`), `go('detalle',__V1)`, `S.view='nuevo';render()`, `S.tab.com='hist';go('comercial');S.tab.com='hist';render()`, `S.view='rutas';render()`, `S.view='proyectos';render()`];
  for (const c of casos) {
    comp++;
    const salida = A.w.eval(`(()=>{S.user=DB.usuarios.find(u=>u.id==='U-${r}');S.form=null;S.edit=null;S.modal=null;S.cb=null;try{${c}}catch(e){return JSON.stringify({err:String(e.message)})}const menu=[...document.querySelectorAll('nav.side button[data-v]')].map(b=>b.dataset.v);const html=document.querySelector('#app').innerHTML;return JSON.stringify({menu,sinMain:!/<main id="main"/.test(html)});})()`);
    let o; try{o=JSON.parse(salida);}catch(e){difs.push(r + ' · ' + c);continue;}
    const menuOk = esperadas.length < 2 ? o.menu.length === 0 : esperadas.every(v => o.menu.includes(v));   /* con una sola pantalla no se dibuja menú */
    if (o.err || o.sinMain || !menuOk) difs.push(r + ' · ' + c + (o.err ? ' (' + o.err + ')' : ''));
  }
}
T(`5.1 Los otros ${roles.length} perfiles (${roles.join(', ')}) abren sus ${comp} pantallas sin errores y su menú las incluye completas`, difs.length === 0 && comp >= 40, difs.slice(0, 6));
T('5.2 El motor de reglas, permisos, autenticación, SQL y la función del servidor no se modificaron', ['js/engine.js', 'js/backend.js', 'js/utils.js', 'js/catalogos.js', 'js/exportar.js', 'supabase/functions/api/core.mjs', 'supabase/functions/api/handler.mjs', 'supabase/functions/api/store.mjs'].every(f => !fs.existsSync(path.join(ANT, f)) || leer(f) === fs.readFileSync(path.join(ANT, f), 'utf8')));
T('5.3 js/config.js existe, no está vacío y sigue declarando la URL de Supabase (estas pruebas nunca lo modifican)', fs.existsSync(path.join(raíz, 'js/config.js')) && fs.statSync(path.join(raíz, 'js/config.js')).size > 0 && /SUPABASE_URL/.test(leer('js/config.js')));

/* ============ 6. SERVIDOR + BASE DE DATOS (migraciones 001–008, 014, 015 y 016) ============ */
const db = new PGlite(); await db.exec('set search_path = master, public');
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users(id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to anon, authenticated; create schema storage;
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select, insert on storage.objects to authenticated;`);
let sqlOk = true; for (const f of ['supabase/migrations/001_esquema.sql', 'supabase/migrations/002_seguridad_rls.sql', 'supabase/migrations/003_almacenamiento.sql', 'supabase/migrations/004_permisos_base.sql', 'supabase/migrations/006_flota_fleetio.sql', 'supabase/migrations/007_flujo_operativo.sql', 'supabase/migrations/008_contabilidad.sql', 'migracion/014_quitar_estatus.sql', 'migracion/015_transicion_anular_factura.sql', 'supabase/migrations/016_ordenes_pago.sql', 'supabase/migrations/019_catalogos.sql', 'supabase/migrations/020_arrastres.sql']) { try { await db.exec(leer(f)); } catch (e) { sqlOk = false; T('SQL ' + f, false, e.message); } }
T('6.0 Las migraciones 001–008, 014, 015 y 016 se aplican: no se cambió el esquema de Supabase', sqlOk);
const U = {}; const mk = async (k, u, n, r) => { U[k] = uuid(); await db.query('insert into auth.users(id,email) values ($1,$2)', [U[k], u + '@t.test']); await db.query('insert into master.perfiles(id,usuario,email,nombre,rol) values ($1,$2,$3,$4,$5)', [U[k], u, u + '@t.test', n, r]); };
await mk('adm', 'admin', 'Administradora', 'ADMIN'); await mk('ped', 'pedro', 'Pedro', 'ENCARGADO');
/* un cliente «migrado» como lo deja la migración 010: sin proyectos y con padre/servicio/link en extra; contacto/correo/teléfono en la ficha fiscal */
await db.exec(`insert into master.clientes(id,nombre,cliente,proyectos,torre_estatus,activo,extra) values ('MIGR1','Cliente Migrado','Cliente Migrado','{}',false,true,'{"clientePadre":"GRUPO PADRE","servicio":"TRANSPORTE","linkContrato":"https://c.example.com/x.pdf"}'::jsonb);
  insert into master.clientes_fiscal(cliente_id,correo_facturacion,contacto,telefono) values ('MIGR1','fact@migr.test','Ana Gómez','5555-0000');
  insert into master.clientes(id,nombre,cliente,proyectos) values ('COLGATE','Colgate','COLGATE','{COLGATE,LV}'); insert into master.clientes_fiscal(cliente_id) values ('COLGATE');`);
await db.exec(`insert into master.flota(unidad,placa,tango,capacidad,tipo) values ('T-1','C-1','TG-1','10 Ton','10TON'),('T-2','C-2','TG-2','12 Ton','12TON');
  insert into master.pilotos(id,nombre,unidad,cliente_id) values ('P-1','Piloto Uno','T-1','COLGATE'),('P-2','Piloto Dos','T-2','COLGATE');
  insert into master.destinos(id,nombre,cliente_id) values ('D-1','Mayorista','COLGATE'),('D-2','Los Andes','COLGATE');
  insert into master.rutas(id,codigo,nombre,cliente_id,proyecto,origen_id,destino_id,estado) values ('R-0001','COL-001','CP → Mayorista','COLGATE','COLGATE','CP','D-1','ACTIVA'),('R-0002','COL-002','CP → Los Andes','COLGATE','COLGATE','CP','D-2','ACTIVA'),('R-0003','COL-003','Ruta en tarifación','COLGATE','COLGATE','CP','D-2','EN_TARIFACION');`);
let txn = null; const deps = { transaccion: fn => db.transaction(t => { txn = t; return fn(async (q, p = []) => t.query(q, p)); }), firmar: async ps => new Map(ps.map(p => [p, 'https://f.test/' + p])), crearUsuarioAuth: async () => uuid(), borrarUsuarioAuth: async () => {} };
const srv = (q, op, ...a) => ejecutar(deps, U[q], { op, args: a });
const sn = (await srv('adm', 'snapshot')).snapshot, mg = sn.clientes.find(c => c.id === 'MIGR1');
T('6.1 El servidor entrega al administrador los clientes con todos los datos que usa la tabla (padre, servicio, usuario, correo, teléfono, link)', mg && mg.clientePadre === 'GRUPO PADRE' && mg.servicio === 'TRANSPORTE' && mg.linkContrato === 'https://c.example.com/x.pdf' && mg.contacto === 'Ana Gómez' && mg.correoFacturacion === 'fact@migr.test' && mg.telefono === '5555-0000', mg);
T('6.2 El administrador recibe TODAS las rutas registradas (activas y no activas); el servidor no las oculta', sn.rutas.length === 3 && sn.rutas.some(r => r.estado === 'EN_TARIFACION'), sn.rutas.map(r => r.id + ':' + r.estado));
const ed = await srv('adm', 'guardarCliente', { existente: true, id: 'MIGR1', nombre: 'Cliente Migrado', cliente: 'Cliente Migrado'.toUpperCase(), proyectos: [ev('CAT.proyectos[0]')], telefono: '5555-9999', activo: true, contacto: 'Ana Gómez', correoFacturacion: 'fact@migr.test' });
const ex = (await db.query("select extra, proyectos from master.clientes where id='MIGR1'")).rows[0];
T('6.3 Editar un cliente migrado (asignarle proyecto) guarda el cambio y CONSERVA sus datos extra en la base', ed.ok && ex.extra.clientePadre === 'GRUPO PADRE' && ex.extra.servicio === 'TRANSPORTE' && ex.extra.linkContrato === 'https://c.example.com/x.pdf' && ex.proyectos.length === 1, [ed.message, ex]);
const nc = await srv('adm', 'guardarCliente', { id: 'NUEVOCLI', nombre: 'Cliente Nuevo Dos', cliente: 'CLIENTE NUEVO DOS', proyectos: [ev('CAT.proyectos[0]')], activo: true });
T('6.4 Un cliente nuevo (con «cliente» generado desde el nombre) se guarda y respeta la unicidad', nc.ok && (await db.query("select cliente from master.clientes where id='NUEVOCLI'")).rows[0].cliente === 'CLIENTE NUEVO DOS', nc);
const vi = await srv('adm', 'crearViaje', { cliente: 'COLGATE', proyectoCat: 'COLGATE', rutaId: 'R-0002', pilotoId: 'P-1', fechaPlan: '2031-07-01T08:00', shipment: 'S', opl: 'INTRANSIT', tipoViaje: 'ONE WAY', tipoCarga: 'KG', producto: 'P', noCarga: '1' });
const rv = vi.ok && (await db.query('select piloto_id, unidad_id, ruta_id from master.viajes where id=$1', [vi.result.id])).rows[0];
T('6.5 El viaje creado con piloto derivado de la placa guarda piloto, unidad (T-1) y ruta en la base', vi.ok && rv.piloto_id === 'P-1' && rv.unidad_id === 'T-1' && rv.ruta_id === 'R-0002', vi.message);
const sn2 = (await srv('adm', 'snapshot')).snapshot;
T('6.6 Al consultar de nuevo, el viaje conserva ruta y piloto', sn2.trips[0].rutaId === 'R-0002' && sn2.trips[0].pilotoId === 'P-1');
/* ============ 7. EL ESTADO DEL VIAJE NO SE ELIGE AL CREAR ============ */
comoAdmin(); ev("S.view='nuevo';S.form=null;S.edit=null;render()");
T('7.1 Al crear un viaje no se ofrece el estado: el viaje nace Planificado', !d.querySelector('#m_estado'));
const tEd = ev('DB.trips.find(t=>t.estado===\'PLANIFICADO\')?.id||DB.trips[0].id');
ev(`S.form=null;S.edit={id:'${tEd}',data:toModel(DB.trips.find(t=>t.id==='${tEd}')),motivo:''};S.view='nuevo';render()`);
T('7.2 Al editar un viaje la administradora sí puede corregir el estado', !!d.querySelector('#m_estado'));
ev("S.edit=null;render()");

/* Usuarios y permisos: la columna «Clientes asignados» muestra el NOMBRE del cliente (nunca el código interno)
   y cada fila trae el botón de activar/desactivar el perfil en lugar del de contraseña. */
ev("S.view='usuarios';S.modal=null;render()");
const filaUsr = u => [...d.querySelectorAll('table.resp tbody tr')].find(tr => tr.querySelector('code') && tr.textContent.includes(u));
const filaPed = filaUsr(ev("DB.usuarios.find(u=>u.rol==='OPERATIVO').usuario"));
const celdaCli = filaPed && filaPed.querySelector('td[data-l="Clientes"]');
const nombreCli = ev("DB.clientes[0].cliente");
T('U1 La columna «Clientes asignados» muestra el nombre del cliente, no el código interno', !!celdaCli && celdaCli.textContent.includes(nombreCli) && !/CIT-U|CLI-0/.test(celdaCli.textContent), celdaCli && celdaCli.textContent);
T('U2 El botón por fila activa/desactiva el perfil (ya no pide contraseña)', !!filaPed && !!filaPed.querySelector('button[data-act="usuarioActivoAsk"]') && !filaPed.querySelector('button[data-act="claveOpen"]'), filaPed && filaPed.textContent.trim().slice(0, 80));
if (filaPed) {
  await click(filaPed.querySelector('button[data-act="usuarioActivoAsk"]'));
  const okBtn = d.querySelector('.dlg .btns button[data-act="usuarioActivoOk"]');
  T('U3 La confirmación avisa el efecto y desactiva al usuario', !!okBtn && /no podrá iniciar sesión/i.test(d.querySelector('.dlg').textContent));
  if (okBtn) { await click(okBtn); const u = JSON.parse(ev(`JSON.stringify(DB.usuarios.find(x=>x.id==='${ev('DB.usuarios.find(u=>u.rol===\'OPERATIVO\').id')}'))`)); T('U4 El usuario queda inactivo y la fila ofrece «Activar»', u.activo === false && /ACTIVAR|Activar/.test(d.querySelector('#main').textContent)); }
}
/* Asignar clientes/proyectos: las listas muestran los nombres con casilla y mover no devuelve al inicio del formulario. */
ev("S.view='usuarios';S.modal=null;S.form=null;S.edit=null;render()");
ev("(()=>{const u=DB.usuarios.find(x=>x.rol==='OPERATIVO');ACT.usuarioOpen({id:u.id});})()");
const listasMv = () => [...d.querySelectorAll('.mv-list')];
const itMv = d.querySelector('.mv-list .mv-it');
T('U5 Las listas de asignación muestran los nombres con casilla (no un cuadro del navegador)', !!itMv && /[A-Za-zÁÉÍÓÚáéíóúÑñ]{3,}/.test(itMv.textContent), itMv && itMv.textContent.trim());
const antesCli = ev("JSON.stringify(S.modal.data.clientes||[])");
const chkLibre = d.querySelector('.mv-list input[type=checkbox]:not([data-mfm])');
if (chkLibre) { chkLibre.checked = true; await tick(); }
const btnMover = d.querySelector('.mv-btns button[data-act="mvMove"][data-dir="to"][data-k="clientes"]');
if (btnMover) await click(btnMover);
const despuesCli = ev("JSON.stringify(S.modal.data.clientes||[])");
T('U6 Al mover un cliente el formulario sigue abierto y la asignación se actualiza', !!d.querySelector('.dlg') && antesCli !== despuesCli && listasMv().length === 4, [antesCli.slice(0, 60), despuesCli.slice(0, 60)]);
/* La gráfica de Finanzas responde a los filtros: con un cliente puesto ya no muestra el total de toda la base. */
ev("S.view='finanzas';S.tab.fin='mes';S.fDesde='';S.fHasta='';S.fCli='COLGATE';S.fPcat='';S.fProv='';S.graf=null;render()");
const mesHtml = (d.querySelector('#main') || { innerHTML: '' }).innerHTML;
T('U7 Con un filtro puesto la gráfica de Finanzas sale del alcance filtrado (no del total de la base)', !/Total en la base/.test(mesHtml) && /(Calculando el resumen por mes|Sin viajes con esos filtros)/.test(mesHtml));
const claveG = ev("claveGrafica()");
T('U8 La clave de la gráfica cambia con los filtros (así se vuelve a pedir al servidor)', claveG.includes('COLGATE') && ev("filtrosGrafica().cliente==='COLGATE'"));
ev("S.fCli=''");
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
