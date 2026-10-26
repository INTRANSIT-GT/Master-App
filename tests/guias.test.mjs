/* Pruebas de «Mi guía de uso» (guías incorporadas a la aplicación): datos, imágenes locales, acceso por perfil, interfaz y
   que no quede nada de PDF, descargas, Supabase ni operaciones nuevas de la API. No usa red ni toca producción.
   Opcional: GUIAS_FUENTES=<carpeta Manuales_actualizados_v2.0> comprueba que js/guias-data.js coincide con las fuentes. */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path'; import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); };
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

/* ---------- 1. Datos de las guías ---------- */
const datosSrc = leer('js/guias-data.js');
const GUIAS = new Function('window', datosSrc + '\nreturn window.GUIAS_USO;')({});
const ESPERADO = { ADMIN: ['g01', 'g02', 'g02b', 'g03', 'g04', 'g05', 'g06', 'g08'], PROYECTOS: ['g02'], OPERATIVO: ['g02b'], TORRE: ['g03'], VALIDADOR: ['g04'], FACTURACION: ['g05'], GERENTE_COMERCIAL: ['g06'], GERENTE_TRANSPORTE: ['g08'], ANALISTA_COMERCIAL: [], COBROS: [], PAGO_OPL: [] };
const ROLES_TODOS = Object.keys(ESPERADO);
T('D1 Hay ocho guías con id, número, título, perfil, versión y secciones', Array.isArray(GUIAS) && GUIAS.length === 8 && GUIAS.every(g => g.id && g.numero && g.titulo && g.perfil && g.version && g.secciones.length > 5), GUIAS && GUIAS.map(g => g.id));
for (const r of ROLES_TODOS) T(`D2 ${r}: le corresponden exactamente ${ESPERADO[r].join(',') || 'ninguna'}`, JSON.stringify(GUIAS.filter(g => g.roles.includes(r)).map(g => g.id)) === JSON.stringify(ESPERADO[r]));
const rolesEngine = [...leer('js/engine.js').matchAll(/^\s{2}([A-Z_]+):\{label:/gm)].map(m => m[1]);
T('D3 Los roles de las guías y los 11 roles de la prueba existen en el motor', GUIAS.every(g => g.roles.every(r => rolesEngine.includes(r))) && ROLES_TODOS.every(r => rolesEngine.includes(r)) && rolesEngine.length === ROLES_TODOS.length, rolesEngine);
T('D4 Cada sección tiene título, texto y buscador; los ids no se repiten', GUIAS.every(g => new Set(g.secciones.map(s => s.id)).size === g.secciones.length && g.secciones.every(s => s.id && s.titulo && s.html.length > 20 && s.busqueda)));
const imgDir = path.join(raíz, 'assets/guias'); const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
const usadas = new Set(GUIAS.flatMap(g => g.imagenes));
T('D5 Todas las capturas declaradas existen en assets/guias/ y son PNG válidos', [...usadas].every(n => fs.existsSync(path.join(imgDir, n)) && fs.readFileSync(path.join(imgDir, n)).subarray(0, 4).equals(PNG)), [...usadas].filter(n => !fs.existsSync(path.join(imgDir, n))));
T('D6 Cada captura que cita el texto está declarada en su guía (y viceversa)', GUIAS.every(g => { const cit = new Set([...g.secciones.map(s => s.html).join('').matchAll(/data-img="([^"]+)"/g)].map(m => m[1])); return [...cit].every(n => g.imagenes.includes(n)) && g.imagenes.every(n => cit.has(n)); }));
T('D7 Hay 16 capturas en total y ninguna sobra en la carpeta', usadas.size === 16 && fs.readdirSync(imgDir).every(f => usadas.has(f)), fs.readdirSync(imgDir));
const todoHtml = GUIAS.map(g => g.secciones.map(s => s.html).join('')).join('');
T('D8 El contenido no trae scripts, manejadores de eventos, enlaces ni rutas a PDF', !/<script|\son[a-z]+\s*=|javascript:|<a[\s>]|href=|src="[^"]*\.pdf|<iframe|<object|<embed|download=/i.test(todoHtml));
T('D9 Se conservan pasos numerados, tablas, avisos y capturas', /class="step"/.test(todoHtml) && /<table/.test(todoHtml) && /class="call/.test(todoHtml) && /data-img=/.test(todoHtml));
if (process.env.GUIAS_FUENTES) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'guias-')); fs.mkdirSync(path.join(tmp, 'js'));
  try { execFileSync('node', [path.join(raíz, 'scripts/preparar-manuales.mjs'), '--fuentes', process.env.GUIAS_FUENTES, '--salida', tmp], { stdio: 'pipe' }); T('D10 js/guias-data.js coincide byte a byte con lo que genera el script desde las guías aprobadas', fs.readFileSync(path.join(tmp, 'js/guias-data.js'), 'utf8') === datosSrc); }
  catch (e) { T('D10 js/guias-data.js coincide con las fuentes', false, String(e.stderr || e.message)); }
}

/* ---------- 2. Sin PDF, sin descargas, sin Supabase, sin operaciones nuevas ---------- */
const ayuda = leer('js/modulos/ayuda.js'), backend = leer('js/backend.js'), handler = leer('supabase/functions/api/handler.mjs'), indexTs = leer('supabase/functions/api/index.ts');
T('S1 La pestaña no llama a la API ni a Supabase (sin guiasUso, abrirGuia, llamar, sb., storage, fetch)', !/API\.(guiasUso|abrirGuia)|guiasUso|abrirGuia|llamar\(|\bsb\.|storage|fetch\(|Operación no reconocida|OP_INVALIDA/.test(ayuda.split('«Mi guía de uso»')[1]));
T('S2 La interfaz no tiene botones, enlaces ni rutas de PDF o descarga', !/\.pdf|guiaPdf|Abrir PDF|download|window\.open|target="_blank"/i.test(ayuda.split('«Mi guía de uso»')[1].replace(/\/\*[\s\S]*?\*\//g, '')));
T('S3 Backend, API e index.ts no tienen restos de las operaciones de guías', !/guiasUso|abrirGuia|firmarManual|leerManual|guias\.mjs|manuales/.test(backend + handler + indexTs));
T('S4 guias.mjs y la migración 031 quedaron marcadas como obsoletas y sin código ejecutable', /OBSOLETO/.test(leer('supabase/functions/api/guias.mjs')) && !/^\s*(insert|create|alter|drop)\b/im.test(leer('supabase/migrations/031_bucket_manuales.sql')));
T('S5 No se tocó el esquema: no hay migraciones nuevas aparte de las existentes', !fs.readdirSync(path.join(raíz, 'supabase/migrations')).some(f => /^03[2-9]/.test(f)));
const sw = leer('service-worker.js');
T('S6 El service worker incluye guias-data.js y subió de versión', /guias-data\.js/.test(sw) && /VERSION = 'v1\.0\.89'/.test(sw), sw.match(/VERSION = '[^']+'/));
T('S7 No hay PDF dentro de assets/guias ni en el código', !fs.readdirSync(imgDir).some(f => /\.pdf$/i.test(f)));
T('S8 Sin credenciales incrustadas en los archivos nuevos', !/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}|sb_secret_|service_role/.test(datosSrc + ayuda.split('«Mi guía de uso»')[1]));

/* ---------- 3. Interfaz (jsdom) ---------- */
const FIXTURE = `
(()=>{
  DB=blankDB();
  const U=(id,usuario,nombre,rol)=>({id,usuario,clave:'x',nombre,rol,activo:true,proyectos:[]});
  ${ROLES_TODOS.map(r => `DB.usuarios.push(U('U-${r}','${r.toLowerCase()}','Usuario ${r}','${r}'));`).join('\n  ')}
  Object.keys(ROLES).forEach(r=>PERM_KEYS.forEach(p=>{DB.permisos.push({rol:r,permiso:p,habilitado:r==='ADMIN'?true:((PERM_DEFAULT[r]||[]).includes(p)&&!((PROHIBIDO[r]||[]).includes(p)))});}));
  syncRefs();
})();`;
const cargar = () => {
  let html = leer('index.html').replace('<script src="js/config.js"></script>', '<script>window.MASTER_CONFIG={};</script>').replace('<script src="js/vendor/supabase.js"></script>', '')
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => /vendor\/(jspdf|supabase)/.test(f) ? '' : `<script>${leer(f)}</script>`);
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message).slice(0, 200)));
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/', pretendToBeVisual: true, virtualConsole: vc }).window;
  w.eval(FIXTURE); w.__abiertos = []; w.open = (...a) => { w.__abiertos.push(a); return null; };
  w.__fetch = 0; w.fetch = () => { w.__fetch++; return Promise.reject(new Error('sin red en la prueba')); };
  /* Si la pestaña pidiera algo al servidor, fallaría como con la API vieja (prueba de que no depende de ella). */
  w.eval(`API.guiasUso=async()=>{throw new ApiError('OP_INVALIDA','Operación no reconocida.')};API.abrirGuia=API.guiasUso;`);
  w.eval(datosSrc.replace(/^window\./m, 'window.'));      /* equivale a la carga diferida de js/guias-data.js */
  return { w, errs };
};
const N = cargar(), w = N.w, d = w.document, ev = c => w.eval(c);
const click = async el => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await tick(60); };
const txt = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
const como = async (rol, tab) => { ev(`S.user=DB.usuarios.find(u=>u.id==='U-${rol}');S.guiaUso=null;S.ayuda=null;S.form=null;S.modal=null;S.menu=false;S.tab={ayuda:'${tab || 'nuevo'}'};go('ayuda')`); await tick(150); };
const boton = (t, sel = 'button') => [...d.querySelectorAll(sel)].find(b => txt(b) === t || txt(b).startsWith(t));
T('U0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);
const principal = d.querySelector('#main');
for (const r of ROLES_TODOS) {
  await como(r);
  const tabs = [...d.querySelectorAll('[role=tab]')].map(txt);
  T(`U1 ${r}: Ayuda abre con «Reportar un problema», «Mis reportes» y «Mi guía de uso»`, tabs.length === 3 && /^Reportar un problema/.test(tabs[0]) && /(Mis reportes|Todos los reportes)/.test(tabs[1]) && tabs[2] === 'Mi guía de uso' && !!d.querySelector('#ay_tipo'), tabs);
  await click(boton('Mi guía de uso', '[role=tab]')); await tick(100);
  const ids = [...d.querySelectorAll('.gu-card [data-act=guiaAbrir]')].map(b => b.dataset.id);
  T(`U2 ${r}: el listado muestra exactamente ${ESPERADO[r].join(',') || 'ninguna guía'}`, JSON.stringify(ids) === JSON.stringify(ESPERADO[r]), ids);
  if (!ESPERADO[r].length) T(`U3 ${r}: «Aún no hay una guía para tu perfil», sin buscador`, /Aún no hay una guía para tu perfil/.test(txt(d.querySelector('#main'))) && !d.querySelector('#gu_q'));
}
/* Cada perfil abre su guía completa: todas las secciones, con el contenido y las capturas */
let faltas = [];
for (const r of ROLES_TODOS.filter(x => ESPERADO[x].length)) {
  await como(r, 'guia'); await tick(100);
  for (const id of (r === 'ADMIN' ? ESPERADO.ADMIN : ESPERADO[r])) {
    const g = GUIAS.find(x => x.id === id); await como(r, 'guia'); await tick(60);
    await click(d.querySelector(`[data-act=guiaAbrir][data-id="${id}"]`)); await tick(60);
    if (!/Sección 1 de/.test(txt(d.querySelector('.gu-meta')))) faltas.push(r + ':' + id + ' no abre');
    let imgs = 0;
    for (let i = 0; i < g.secciones.length; i++) {
      ev(`S.guiaUso.sec='${g.secciones[i].id}';render()`); await tick(5);
      if (txt(d.querySelector('.gu-art h2')) !== g.secciones[i].titulo) faltas.push(`${r}:${id}:${g.secciones[i].id} título`);
      if (d.querySelector('.guiauso').textContent.trim().length < 15) faltas.push(`${r}:${id}:${g.secciones[i].id} vacío`);
      imgs += d.querySelectorAll('.guiauso img[src^="assets/guias/"]').length;
      for (const im of d.querySelectorAll('.guiauso img')) if (!g.imagenes.includes(im.getAttribute('src').replace('assets/guias/', ''))) faltas.push('imagen ajena ' + im.src);
    }
    const esperadas = [...g.secciones.map(s => s.html).join('').matchAll(/data-img=/g)].length;
    if (imgs !== esperadas) faltas.push(`${r}:${id} capturas ${imgs}/${esperadas}`);
  }
}
T('U4 Cada perfil abre sus guías: todas las secciones muestran su contenido y todas sus capturas (rutas locales assets/guias/)', faltas.length === 0, faltas.slice(0, 5));
await como('TORRE', 'guia'); await tick(100);
T('U5 Torre ve solo su guía, con buscador y sin botones de PDF/descarga', !!d.querySelector('#gu_q') && /Torre de control/.test(txt(d.querySelector('#main'))) && !/Administradora|Operativo/.test(txt(d.querySelector('.gu-grid'))) && !/pdf|descargar/i.test(d.querySelector('#main').innerHTML.replace(/<script[\s\S]*?<\/script>/g, '')) && !d.querySelector('a[download],[data-act=guiaPdf]'));
const q = d.querySelector('#gu_q'); q.value = 'horarios'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await tick();
T('U6 El buscador (sin acentos) encuentra instrucciones y no redibuja el campo', d.querySelectorAll('.gu-hit').length > 0 && d.querySelector('#gu_q') === q, txt(d.querySelector('#gu_res')).slice(0, 150));
q.value = 'zzzz'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await tick();
T('U7 Sin coincidencias se avisa', /Sin resultados/.test(txt(d.querySelector('#gu_res'))));
q.value = 'horarios'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await tick();
await click(d.querySelector('.gu-hit'));
T('U8 Abrir un resultado muestra esa sección con «Volver al Centro de ayuda» y «← Mis guías»', !!d.querySelector('.guiauso') && !!boton('Volver al Centro de ayuda') && !!boton('← Mis guías'));
T('U9 Siguiente y Anterior recorren la guía', await (async () => { const a = txt(d.querySelector('.gu-art h2')); const sig = d.querySelector('.gu-nav .btn.primary'); if (!sig) return false; await click(sig); const b = txt(d.querySelector('.gu-art h2')); const ant = d.querySelector('.gu-nav .btn:not(.primary)'); if (!ant) return false; await click(ant); return a !== b && txt(d.querySelector('.gu-art h2')) === a; })());
const ql = d.querySelector('#gu_ql'); ql.value = 'zzzz'; ql.dispatchEvent(new w.Event('input', { bubbles: true })); await tick();
const _u10 = [txt(d.querySelector('#gu_toc')).slice(0,200), d.querySelector('#gu_ql') === ql];
T('U10 «Buscar en esta guía» filtra el índice sin perder el cursor y avisa si no hay coincidencias', /Ninguna sección coincide/.test(txt(d.querySelector('#gu_toc'))) && d.querySelector('#gu_ql') === ql, _u10);
ql.value = ''; ql.dispatchEvent(new w.Event('input', { bubbles: true })); await tick();
await click(boton('← Mis guías'));
T('U11 «← Mis guías» vuelve al listado', !!d.querySelector('.gu-card') && !d.querySelector('.guiauso'));
await click(d.querySelector('[data-act=guiaAbrir]')); await click(boton('Volver al Centro de ayuda'));
T('U12 «Volver al Centro de ayuda» regresa al formulario de reporte, intacto', !!d.querySelector('#ay_tipo') && !!d.querySelector('#ay_descripcion') && !!boton('Enviar reporte'));
await click(boton('Mis reportes', '[role=tab]'));
T('U13 «Mis reportes» sigue funcionando', /Aún no has enviado reportes|Reporte/.test(txt(d.querySelector('#main'))));
/* Un perfil no abre la guía de otro (filtro de presentación) */
await como('TORRE', 'guia'); await tick(100);
await ev(`ACT.guiaAbrir({id:'g01'})`); await tick(60);
T('U14 Torre no puede abrir la guía 01 ni forzando la acción: no se abre y se avisa', ev('S.guiaUso.abierta') === null && !d.querySelector('.guiauso') && /no está disponible para tu perfil/.test([...d.querySelectorAll('#toasts .toast')].map(txt).join(' ')));
ev(`S.guiaUso.abierta='g01';render()`); await tick();
T('U15 Aunque se fuerce el estado, el lector no muestra la guía ajena', !d.querySelector('.guiauso') && /no está disponible para tu perfil/.test(txt(d.querySelector('#main'))));
await como('ADMIN', 'guia'); await tick(100);
T('U16 La Administradora ve 8 guías, su guía primero y las demás agrupadas; sus permisos no cambian', d.querySelectorAll('.gu-card').length === 8 && /Mi guía/.test(txt(d.querySelector('#main'))) && /Guías de los demás perfiles/.test(txt(d.querySelector('#main'))) && ev(`DB.permisos.filter(p=>p.rol==='ADMIN').every(p=>p.habilitado===true)`));
T('U17 Las tarjetas indican las funcionalidades (tareas) que explica cada guía', d.querySelectorAll('.gu-chip').length > 10);
ev(`S.guiaUso.estado='error';S.guiaUso.err='No se pudo cargar el contenido de las guías. Revisa tu conexión y vuelve a intentarlo.';render()`); await tick();
T('U18 Si no se pudiera cargar guias-data.js se muestra el error real y «Reintentar»', /No se pudo cargar el contenido/.test(txt(d.querySelector('#main'))) && !!d.querySelector('[data-act=guiaReintentar]'));
ev(`S.guiaUso=null;render()`);
ev(`window.GUIAS_USO=undefined;S.guiaUso=null;S.user=DB.usuarios.find(u=>u.id==='U-TORRE');S.tab={ayuda:'guia'};render()`); await tick(120);
T('U19 Sin los datos cargados la pestaña intenta cargarlos y, si falla, lo dice (no inventa contenido)', /No se pudo cargar el contenido|Cargando/.test(txt(d.querySelector('#main'))) && !d.querySelector('.gu-card'), txt(d.querySelector('#main')).slice(0, 200));
T('U20 Ninguna petición de red ni ventana nueva durante todo el recorrido; sin «Operación no reconocida»', w.__fetch === 0 && w.__abiertos.length === 0 && !/Operación no reconocida/.test(d.body.textContent));
T('U21 Sin errores de JavaScript en todo el recorrido', N.errs.length === 0, N.errs);
const css = leer('css/app.css');
T('U22 Hay estilos para móvil', /@media \(max-width:820px\)\{\s*\.gu-lector\{grid-template-columns:1fr\}/.test(css));
console.log(filas.join('\n')); console.log(`\n${ok} correctas · ${mal} con fallo`); process.exit(mal ? 1 : 0);
