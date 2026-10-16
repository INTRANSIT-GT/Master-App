/* La página de revisión visual (prueba-visual.html): carga sin errores, trae datos de ejemplo, y permite ver cada perfil. */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const html = leer('prueba-visual.html').replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => `<script>${leer(f)}</script>`);
const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message).slice(0, 160)));
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'file:///prueba-visual.html', pretendToBeVisual: true, virtualConsole: vc }).window;
const d = w.document, ev = c => w.eval(c), refs = [...leer('prueba-visual.html').matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
T('V1 La página carga sin errores de JavaScript', errs.length === 0, errs);
T('V2 Todos los archivos que usa existen (funciona abriéndola con doble clic, sin servidor)', refs.every(f => fs.existsSync(path.join(raíz, f))), refs.filter(f => !fs.existsSync(path.join(raíz, f))));
T('V3 No depende de Supabase: modo de demostración y sin claves', ev('BACKEND.modo') === 'demo' && !/supabase\.co/.test(leer('prueba-visual.html') + leer('js/datos-prueba-visual.js')));
const botones = [...d.querySelectorAll('#pv-b button')];
T('V4 La barra de revisión ofrece 3 encargados y todos los demás perfiles (10 botones)', botones.length === 10 && botones.filter(b => /ejemplo/.test(b.textContent)).length === 10, botones.length);
T('V5 Arranca viendo al Encargado de proyecto y su botón de perfil muestra solo nombre y rol', ev('S.user.rol') === 'ENCARGADO' && /Encargado de proyecto/.test(d.querySelector('.userchip').textContent));
const nora = botones.find(b => /58 clientes/.test(b.textContent)); nora.click();
T('V6 «Nora» (58 clientes): sin IDs ni códigos en el botón de perfil', !/CIT-U|CLI-0/.test(d.querySelector('#app').textContent) && d.querySelector('.userchip').textContent.replace(/\s+/g, ' ').trim().startsWith('NRNora Rivera'));
ev("S.form=null;go('nuevo')");
T('V7 En el formulario del encargado: Ruta habilitada, «Ingreso a planta» e «Ingreso a bodega»', !d.querySelector('.fsec .cb-btn[data-k="m:rutaGrupo"]').disabled && [...d.querySelectorAll('label')].some(l => l.textContent.trim() === 'Ingreso a planta') && [...d.querySelectorAll('label')].some(l => l.textContent.trim() === 'Ingreso a bodega'));
botones.find(b => /Pedro/.test(b.textContent)).click(); ev("S.form=null;go('nuevo')");
const rutas = ev('JSON.parse(JSON.stringify(rutasGrupos(S.form).map(g=>g.nombre)))');
T('V8 Rutas de ejemplo: «CP → Mayorista Escuintla» está repetida 3 veces en los datos y se ofrece una sola vez', ev("DB.rutas.filter(r=>r.nombre==='CP → Mayorista Escuintla').length") === 3 && rutas.filter(n => n === 'CP → Mayorista Escuintla').length === 1, rutas.length);
/* guardar un viaje de punta a punta con la ruta elegida (datos locales de ejemplo) */
botones.find(b => /Pedro/.test(b.textContent)).click();
const antes = ev('DB.trips.length');
const r = ev(`(()=>{try{const t=API.crearViaje(S.user.id,{cliente:'COLGATE',proyectoCat:'COLGATE',rutaId:'R-0004',pilotoId:'P-2',fechaPlan:'2031-05-05T08:00',estatus:'EN ESPERA',shipment:'SHP-PRUEBA',opl:'INTRANSIT',tipoViaje:'ONE WAY',tipoCarga:'KG',noCarga:'1',producto:'P',placaArrastre:'PA-9'});return JSON.stringify({id:t.id,ruta:DB.trips.find(x=>x.id===t.id).rutaId});}catch(e){return JSON.stringify({err:e.message});}})()`);
const rr = JSON.parse(r);
T('V9 El encargado guarda un viaje con la ruta elegida y la ruta queda registrada', !rr.err && rr.ruta === 'R-0004' && ev('DB.trips.length') === antes + 1, rr);
T('V10 Al consultar de nuevo el viaje, la ruta se conserva', ev(`DB.trips.find(x=>x.id==='${rr.id}').rutaId`) === 'R-0004');
/* los demás perfiles: cada uno abre todas sus pantallas */
const otros = botones.filter(b => !/(Pedro|Nora|sin proyectos)/i.test(b.textContent)); const fallos = [];
for (const b of otros) { b.click(); const vistas = JSON.parse(ev("JSON.stringify(navItems().filter(v=>v!=='modelo'))")); for (const v of vistas) { try { ev(`S.form=null;S.modal=null;go('${v}')`); if (!d.querySelector('#main') || !d.querySelector('#main').innerHTML.length) fallos.push(b.textContent + ':' + v); } catch (e) { fallos.push(b.textContent + ':' + v + ':' + e.message); } } }
T(`V11 Los ${otros.length} perfiles restantes abren todas sus pantallas sin errores`, otros.length === 7 && fallos.length === 0, fallos);
T('V12 Ningún texto «perfil/catálogo» para el encargado en inicio, viajes y rutas', (botones.find(b => /Pedro/.test(b.textContent)).click(), ['inicio', 'viajes', 'rutas', 'liquidaciones'].every(v => (ev(`go('${v}')`), !/perfil|cat[aá]logo/i.test(d.querySelector('#app').innerText)))));
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
