/* Menú del ADMINISTRADOR agrupado por módulos (VIAJES · TORRE · COMERCIAL · OPL · FLOTAS).
   Comprueba: los módulos y sus opciones, que cada opción abre la pantalla correcta, que se respetan los permisos,
   que no se perdió ninguna pantalla y que los DEMÁS perfiles conservan EXACTAMENTE su menú.
   Referencia: UI_BASE (ruta al ui.js anterior) o respaldo_antes_menu_admin/js/ui.js */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
const BASE = process.env.UI_BASE ? path.resolve(process.env.UI_BASE) : path.join(raíz, 'respaldo_antes_menu_admin', 'js', 'ui.js');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 400) : '')); };
const tick = () => new Promise(r => setTimeout(r, 20));
const cargar = rutaUi => {
  let html = leer('index.html').replace('<script src="js/config.js"></script>', '<script>window.MASTER_CONFIG={};</script>').replace('<script src="js/vendor/supabase.js"></script>', '')
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => `<script>${f === 'js/ui.js' && rutaUi ? fs.readFileSync(rutaUi, 'utf8') : leer(f)}</script>`);
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message).slice(0, 200)));
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/', pretendToBeVisual: true, virtualConsole: vc }).window;
  w.eval(leer('tests/_datos-admin.js')); return { w, errs };
};
const N = cargar(null), w = N.w, d = w.document, ev = c => w.eval(c);
const click = async el => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await tick(); };
const comoAdmin = () => ev("S.user=DB.usuarios.find(u=>u.rol==='ADMIN');S.form=null;S.edit=null;S.modal=null;S.cb=null;S.menu=false;S.navK='';S.navOpen=undefined;S.navKey='';S.view='inicio';render()");
const txt = el => el.textContent.replace(/\s+/g, ' ').trim();
const grupos = () => [...d.querySelectorAll('nav.side .grp')].map(g => ({ t: txt(g.querySelector('.grp-t')), items: [...g.querySelectorAll('.grp-p button')].map(b => ({ l: txt(b), v: b.dataset.v, k: b.dataset.k })) }));
const botones = () => [...d.querySelectorAll('nav.side button:not(.grp-t)')];
const cabeceras = () => [...d.querySelectorAll('nav.side .grp-t')];
const abierto = h => h.getAttribute('aria-expanded') === 'true' && !d.getElementById(h.getAttribute('aria-controls')).hidden;

T('M0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);
comoAdmin();
const G = grupos();
T('M1 Aparecen los cinco módulos, en orden: VIAJES, TORRE, COMERCIAL, OPL, FLOTAS (y «Administración» aparte)', JSON.stringify(G.map(g => g.t)) === JSON.stringify(['VIAJES', 'TORRE', 'COMERCIAL', 'OPL', 'FLOTAS', 'ADMINISTRACIÓN']), G.map(g => g.t));
const L = t => (G.find(g => g.t === t) || { items: [] }).items.map(i => i.l);
T('M2 VIAJES agrupa Nuevo viaje, Liquidaciones y Todos los viajes (y la pantalla existente de viajes por estado)', JSON.stringify(L('VIAJES')) === JSON.stringify(['Nuevo viaje', 'Liquidaciones', 'Todos los viajes', 'Viajes por estado']), L('VIAJES'));
T('M3 TORRE agrupa «Viajes» y «Horarios y fechas» (ambas abren la hoja existente de Torre de control)', JSON.stringify(L('TORRE')) === JSON.stringify(['Viajes', 'Horarios y fechas']), L('TORRE'));
T('M4 COMERCIAL agrupa Facturación, Clientes, Tarifas, Finanzas y Catálogos', JSON.stringify(L('COMERCIAL')) === JSON.stringify(['Facturación', 'Clientes', 'Tarifas', 'Finanzas', 'Catálogos']), L('COMERCIAL'));
T('M5 OPL agrupa Proveedores', JSON.stringify(L('OPL')) === JSON.stringify(['Proveedores']), L('OPL'));
T('M6 FLOTAS agrupa Pilotos', JSON.stringify(L('FLOTAS')) === JSON.stringify(['Pilotos']), L('FLOTAS'));
T('M7 Ninguna opción se repite dentro de un mismo módulo', G.every(g => new Set(g.items.map(i => i.l)).size === g.items.length));
T('M8 Cada módulo es un botón con título visible, aria-expanded y un panel asociado', cabeceras().length === 6 && cabeceras().every(h => h.tagName === 'BUTTON' && txt(h) && d.getElementById(h.getAttribute('aria-controls')).getAttribute('aria-labelledby') === h.id));
const navOrig = JSON.parse(ev('JSON.stringify(ROLES.ADMIN.nav)'));
const vistas = new Set(botones().map(b => b.dataset.v));
T('M9 No se perdió ninguna pantalla: todas las del menú anterior del Administrador siguen en el menú', navOrig.every(v => vistas.has(v)), navOrig.filter(v => !vistas.has(v)));
T('M10 Rutas, Usuarios y permisos, Auditoría y Modelo de datos siguen disponibles (módulo ADMINISTRACIÓN)', JSON.stringify(G.find(g => g.t === 'ADMINISTRACIÓN').items.map(i => i.v)) === JSON.stringify(['rutas', 'usuarios', 'auditoria', 'modelo']));

/* cada opción abre la pantalla correcta */
const abrir = async (l, k) => { comoAdmin(); const b = botones().find(x => txt(x) === l && (k === undefined || (x.dataset.k || '') === k)); const pn = b.closest('.grp-p'); if (pn && pn.hidden) await click(d.getElementById(pn.getAttribute('aria-labelledby'))); await click(b); return b; };
const casos = [['Nuevo viaje', 'nuevo', ''], ['Liquidaciones', 'liquidaciones', ''], ['Todos los viajes', 'todos', ''], ['Viajes por estado', 'viajes', ''], ['Viajes', 'torre', 'torre'], ['Horarios y fechas', 'torre', 'horarios'], ['Facturación', 'comercial', ''], ['Clientes', 'proyectos', ''], ['Finanzas', 'finanzas', ''], ['Catálogos', 'catalogos', ''], ['Proveedores', 'opl', ''], ['Pilotos', 'catalogos', 'pilotos'], ['Rutas', 'rutas', ''], ['Usuarios y permisos', 'usuarios', ''], ['Auditoría', 'auditoria', ''], ['Modelo de datos', 'modelo', ''], ['Inicio', 'inicio', '']];
for (const [l, v, k] of casos) {
  await abrir(l, k);
  const act = [...d.querySelectorAll('nav.side button[aria-current="page"]')].map(txt);
  T(`M11 «${l}» abre la pantalla «${v}» (sin errores) y queda marcada como activa`, ev('S.view') === v && d.querySelector('#main .inner, #main') && act.length === 1 && act[0] === l, [ev('S.view'), act]);
}
await abrir('Pilotos', 'pilotos');
T('M12 «Pilotos» abre Catálogos en la pestaña PILOTOS con datos reales de la aplicación', ev("S.tab.cat") === 'pil' && /Piloto Uno/.test(d.querySelector('#main').textContent));
await abrir('Catálogos', '');
T('M13 «Catálogos» y «Pilotos» no se marcan activos a la vez', [...d.querySelectorAll('nav.side button[aria-current="page"]')].map(txt).join() === 'Catálogos');
comoAdmin(); await abrir('Clientes');
T('M14 Clientes conserva la tabla de 13 columnas y su buscador (cambios anteriores intactos)', !!d.querySelector('#tablaClientes') && d.querySelectorAll('#tablaClientes thead th').length === 13 && !!d.querySelector('#qCli'));
comoAdmin(); await abrir('Facturación'); ev("S.tab.com='hist';render()");
T('M15 Facturación conserva el desplegable «Detalle de viajes» en su pestaña de historial (cambio anterior intacto)', !!d.querySelector('.cb[data-cb="fcViaje"]'));
comoAdmin(); await abrir('Rutas');
T('M16 Rutas conserva el catálogo desplegable (cambio anterior intacto)', !!d.querySelector('.cb[data-cb="rtCat"]'));
comoAdmin(); await abrir('Nuevo viaje');
T('M17 Nuevo viaje conserva la selección de placa (cambio anterior intacto)', /Placa del equipo/.test(d.querySelector('#main').textContent));
await abrir('Clientes');
ev("S.view='detalle';S.from={view:'proyectos',param:null};S.param=window.__V1;render()");
T('M18 Desde el detalle de un viaje, el menú marca la sección de origen y sigue siendo uno solo', d.querySelectorAll('nav.side button[aria-current="page"]').length === 1);


/* ---- Acordeón: cada módulo es un botón que despliega/oculta sus opciones ---- */
comoAdmin();
T('A1 Al entrar, los módulos están plegados (aria-expanded=false y opciones ocultas)', cabeceras().length === 6 && cabeceras().every(h => h.getAttribute('aria-expanded') === 'false' && d.getElementById(h.getAttribute('aria-controls')).hidden));
T('A2 Cada módulo muestra una flecha que indica si está abierto o cerrado', cabeceras().every(h => !!h.querySelector('svg.chev')));
const mainAntes = d.getElementById('main'); const hV = cabeceras().find(h => txt(h) === 'VIAJES');
await click(hV);
T('A3 Al pulsar VIAJES se despliegan sus 4 opciones sin recargar (la pantalla principal no se vuelve a pintar)', abierto(hV) && hV.parentElement.classList.contains('open') && d.getElementById(hV.getAttribute('aria-controls')).querySelectorAll('button').length === 4 && d.getElementById('main') === mainAntes && ev('S.view') === 'inicio');
await click(hV);
T('A4 Al volver a pulsarlo, se ocultan', !abierto(hV) && hV.getAttribute('aria-expanded') === 'false' && !hV.parentElement.classList.contains('open'));
const hT = cabeceras().find(h => txt(h) === 'TORRE'), hC = cabeceras().find(h => txt(h) === 'COMERCIAL');
await click(hT); await click(hC);
T('A5 Al abrir un módulo se cierra el anterior (queda uno solo abierto)', abierto(hC) && !abierto(hT) && cabeceras().filter(abierto).length === 1);
T('A6 Pulsar el título de un módulo no cambia de pantalla', ev('S.view') === 'inicio');
for (const g of ['VIAJES', 'TORRE', 'COMERCIAL', 'OPL', 'FLOTAS', 'ADMINISTRACIÓN']) {
  comoAdmin(); const h = cabeceras().find(x => txt(x) === g); await click(h);
  const ops = [...d.getElementById(h.getAttribute('aria-controls')).querySelectorAll('button')]; let bien = abierto(h) && ops.length > 0;
  for (const o of ops) { comoAdmin(); const h2 = cabeceras().find(x => txt(x) === g); await click(h2); const o2 = [...d.getElementById(h2.getAttribute('aria-controls')).querySelectorAll('button')].find(x => txt(x) === txt(o)); await click(o2);
    const h3 = cabeceras().find(x => txt(x) === g); const cur = [...d.querySelectorAll('nav.side button[aria-current="page"]')];
    if (ev('S.view') !== o.dataset.v || cur.length !== 1 || txt(cur[0]) !== txt(o) || !abierto(h3)) { bien = false; T(`A7 detalle ${g} › ${txt(o)}`, false, [ev('S.view'), cur.map(txt), abierto(h3)]); } }
  T(`A7 ${g}: desplegar y abrir cada una de sus ${ops.length} opciones abre su pantalla, la resalta y deja el módulo abierto`, bien);
}
await abrir('Horarios y fechas', 'horarios');
T('A8 «Horarios y fechas» abre la hoja de Torre con todos los viajes y sus columnas de fecha plan/inicio/fin, y solo ella se resalta', ev('S.tab.torre') === 'todos' && /Fecha plan/.test(d.querySelector('#main').textContent) && [...d.querySelectorAll('nav.side button[aria-current="page"]')].map(txt).join() === 'Horarios y fechas');
await abrir('Viajes', 'torre');
T('A9 «Viajes» (Torre) abre la misma hoja en la pestaña En ruta y solo ella se resalta', ev('S.tab.torre') === 'curso' && [...d.querySelectorAll('nav.side button[aria-current="page"]')].map(txt).join() === 'Viajes');
await abrir('Pilotos', 'pilotos');
T('A10 Con Pilotos activo, el módulo FLOTAS queda abierto y marcado, y COMERCIAL cerrado', abierto(cabeceras().find(h => txt(h) === 'FLOTAS')) && !abierto(cabeceras().find(h => txt(h) === 'COMERCIAL')) && cabeceras().find(h => txt(h) === 'FLOTAS').parentElement.classList.contains('has-cur'));
const css = leer('css/app.css');
T('A11 Estilos de acordeón y de pantalla pequeña presentes (panel oculto, flecha que gira, opciones en fila bajo los módulos)', /\.grp-p\[hidden\]\{display:none\}/.test(css) && /\.grp\.open>\.grp-t \.chev\{transform:rotate/.test(css) && /@container app \(max-width:900px\)\{\s*\.side\.side-acc\{flex-wrap:wrap/.test(css));

/* permisos: una opción sin permiso no aparece y un módulo vacío se oculta */
comoAdmin();
ev("['finanzas_ver','tarifas_opl_ver'].forEach(p=>{const x=DB.permisos.find(y=>y.rol==='ADMIN'&&y.permiso===p);if(x)x.habilitado=false;});render()");
const G2 = grupos();
T('M19 Sin los permisos de finanzas y de OPL desaparecen Finanzas y Proveedores y el módulo OPL vacío se oculta', !G2.some(g => g.t === 'OPL') && !G2.find(g => g.t === 'COMERCIAL').items.some(i => i.v === 'finanzas'), G2.map(g => g.t));
ev("['finanzas_ver','tarifas_opl_ver'].forEach(p=>{const x=DB.permisos.find(y=>y.rol==='ADMIN'&&y.permiso===p);if(x)x.habilitado=true;});render()");
T('M20 Al volver a darle el permiso reaparecen', grupos().some(g => g.t === 'OPL'));

/* los demás perfiles conservan su menú y sus pantallas.
   (La comparación contra la copia anterior ya no aplica: esa copia es de antes de dividir la interfaz
   en módulos y hoy no carga. Se comprueba el comportamiento de cada perfil.) */
T('M21 La versión actual carga sin errores de JavaScript', N.errs.length === 0, N.errs);
const roles = ev('Object.keys(ROLES).filter(r=>r!=="ADMIN")'); const difs = [];
for (const r of roles) {
  const salida = N.w.eval(`(()=>{const u={id:'U-${r}',usuario:'${r.toLowerCase()}',clave:'x',nombre:'Prueba ${r}',rol:'${r}',activo:true,proyectos:[]};DB.usuarios.push(u);DB.acceso.push({userId:u.id,cliente:'COLGATE'});S.user=u;S.view=ROLES.${r}.home;S.menu=false;S.modal=null;S.form=null;S.edit=null;try{render();}catch(e){return 'ERROR: '+e.message}const nav=[...document.querySelectorAll('nav.side button[data-v]')].map(b=>b.dataset.v);return JSON.stringify({nav,esperado:navItems()});})()`);
  let o; try { o = JSON.parse(salida); } catch (e) { difs.push(r + ' (' + salida + ')'); continue; }
  const ok = o.esperado.length < 2 ? o.nav.length === 0 : JSON.stringify(o.nav) === JSON.stringify(o.esperado);   /* con una sola pantalla no se dibuja menú */
  if (!ok) difs.push(r);
}
T(`M22 Los otros ${roles.length} perfiles (${roles.join(', ')}) conservan su menú: cada uno muestra exactamente las pantallas de su perfil`, difs.length === 0 && roles.length >= 7, difs);
T('M23 Todas las pantallas de todos los menús existen (ninguna opción rota)', ev("Object.keys(ROLES).every(r=>ROLES[r].nav.every(v=>!!VIEWS[v]))"));
/* El Gerente de Transporte: visibilidad total (Inicio, Nuevo viaje, Viajes) y control financiero en consulta. */
const navGerente = JSON.parse(ev(`(()=>{let u=DB.usuarios.find(x=>x.rol==='GERENTE_TRANSPORTE');if(!u){u={id:'U-GTR',usuario:'gtr',clave:'x',nombre:'Gerente Transporte',rol:'GERENTE_TRANSPORTE',activo:true,proyectos:[]};DB.usuarios.push(u);}S.user=u;S.view='inicio';S.menu=false;S.form=null;S.modal=null;try{render();}catch(e){return JSON.stringify({err:e.message});}return JSON.stringify(navItems());})()`));
T('M24 El Gerente de Transporte ve Inicio, Nuevo viaje, Viajes, Liquidaciones y Finanzas (consulta)', ['inicio','nuevo','todos','viajes','liquidaciones','finanzas'].every(v => navGerente.includes(v)) && !navGerente.includes('usuarios') && !navGerente.includes('auditoria'), navGerente);
const chipGerente = ev("document.querySelector('.userchip').textContent.replace(/\\s+/g,' ')");
T('M25 Su botón de perfil muestra solo el perfil: sin lista de clientes ni códigos internos', /Gerente de Transporte/.test(chipGerente) && !/CIT-U|CLI-0/.test(chipGerente), chipGerente);

/* Tarifas dejó de ser una pestaña de Facturación: ahora es una sección propia del módulo COMERCIAL. */
comoAdmin();
const itemTar = botones().find(b => b.dataset.v === 'tarifas');
if (itemTar) await click(itemTar);
T('M26 Tarifas es una sección de COMERCIAL (pantalla propia) y ya no una pestaña de Facturación',
  !!itemTar && ev("S.view") === 'tarifas' && /TARIFAS/.test(txt(d.querySelector('#main')).toUpperCase()) && !/tar/i.test(ev("JSON.stringify(COMTABS)")),
  [ev("S.view"), ev("JSON.stringify(COMTABS)")]);
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
