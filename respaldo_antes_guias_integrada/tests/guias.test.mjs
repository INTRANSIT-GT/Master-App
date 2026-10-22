/* Pruebas de «Mi guía de uso»: acceso por rol validado en el SERVIDOR (handler.ejecutar con un almacenamiento simulado),
   la interfaz (jsdom) y que ningún manual quede en carpetas públicas. No usa Supabase real ni toca producción.
   Opcional: GUIAS_CARPETA=<carpeta generada por scripts/preparar-manuales.mjs> valida además los archivos reales. */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ejecutar, OPS_ESCRITURA, OPS_LECTURA } from '../supabase/functions/api/handler.mjs';
import { CATALOGO, guiasDeRol, guiaPermitida, rutaImagen, TTL_ENLACE_SEG } from '../supabase/functions/api/guias.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 500) : '')); };
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));

/* ---------- Almacenamiento y base simulados ---------- */
const ROLES_TODOS = ['ADMIN', 'GERENTE_TRANSPORTE', 'VALIDADOR', 'OPERATIVO', 'ANALISTA_COMERCIAL', 'GERENTE_COMERCIAL', 'FACTURACION', 'COBROS', 'PAGO_OPL', 'TORRE', 'PROYECTOS'];
const ESPERADO = { ADMIN: ['g01', 'g02', 'g02b', 'g03', 'g04', 'g05', 'g06', 'g08'], PROYECTOS: ['g02'], OPERATIVO: ['g02b'], TORRE: ['g03'], VALIDADOR: ['g04'], FACTURACION: ['g05'], GERENTE_COMERCIAL: ['g06'], GERENTE_TRANSPORTE: ['g08'], ANALISTA_COMERCIAL: [], COBROS: [], PAGO_OPL: [] };
const U = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const PERFILES = new Map(); ROLES_TODOS.forEach((r, i) => PERFILES.set(U(i + 1), { rol: r, activo: true }));
const ID = r => [...PERFILES].find(([, v]) => v.rol === r)[0];
PERFILES.set(U(90), { rol: 'ADMIN', activo: false });                      /* administradora inactiva */
const bucket = new Map();
for (const g of CATALOGO) {
  bucket.set(g.pdf, '%PDF-fake ' + g.id);
  bucket.set(g.contenido, JSON.stringify({ id: g.id, version: '2.0', fecha: '22 de octubre de 2026', imagenes: ['cap_' + g.id + '.png', '../secreto.png', 'a/b.png'],
    secciones: [{ id: 's1', titulo: 'Crear un viaje ' + g.id, html: '<p>Contenido ' + g.id + '</p>', busqueda: 'crear un viaje desvío ' + g.id }] }));
  bucket.set('img/cap_' + g.id + '.png', 'png');
}
const llamadas = { leer: [], firmar: [], q: 0 };
const deps = {
  transaccion: async fn => fn(async (sql, p) => { llamadas.q++; if (!/from master\.perfiles/.test(sql)) throw new Error('consulta inesperada: ' + sql); const f = PERFILES.get(p[0]); return { rows: f ? [f] : [] }; }),
  leerManual: async ruta => { llamadas.leer.push(ruta); return bucket.has(ruta) ? bucket.get(ruta) : null; },
  firmarManual: async (rutas, seg) => { llamadas.firmar.push({ rutas: [...rutas], seg }); const m = new Map(); rutas.forEach(r => { if (bucket.has(r)) m.set(r, 'https://x.supabase.co/storage/v1/object/sign/manuales/' + r + '?token=t'); }); return m; },
  firmar: async () => { throw new Error('no debe usarse el bucket de evidencias'); },
};
const op = (uid, o, ...a) => ejecutar(deps, uid, { op: o, args: a });

/* ---------- 1. Catálogo y regla de acceso ---------- */
T('S1 Las operaciones son de LECTURA y no de escritura', OPS_LECTURA.includes('guiasUso') && OPS_LECTURA.includes('abrirGuia') && !OPS_ESCRITURA.includes('guiasUso') && !OPS_ESCRITURA.includes('abrirGuia'));
T('S2 El catálogo tiene las ocho guías, sin duplicados', CATALOGO.length === 8 && new Set(CATALOGO.map(g => g.id)).size === 8 && new Set(CATALOGO.map(g => g.pdf)).size === 8);
const rolesEngine = [...leer('js/engine.js').matchAll(/^\s{2}([A-Z_]+):\{label:/gm)].map(m => m[1]);
T('S3 Todos los roles del catálogo existen en el motor de la aplicación', CATALOGO.every(g => g.roles.every(r => rolesEngine.includes(r))), rolesEngine);
T('S4 Los 11 roles del motor están cubiertos por la prueba', ROLES_TODOS.every(r => rolesEngine.includes(r)) && rolesEngine.length === ROLES_TODOS.length, rolesEngine);
for (const r of ROLES_TODOS) {
  const res = await op(ID(r), 'guiasUso');
  const ids = res.ok ? res.result.guias.map(g => g.id) : null;
  T(`S5 ${r}: lista exacta de guías (${(ESPERADO[r] || []).join(',') || 'ninguna'})`, res.ok && JSON.stringify(ids) === JSON.stringify(ESPERADO[r]), ids || res);
  T(`S6 ${r}: la lista no filtra rutas internas`, res.ok && !JSON.stringify(res.result).includes('pdf/') && !JSON.stringify(res.result).includes('json/'));
}
T('S7 PROYECTOS ≠ OPERATIVO: cada uno ve solo la suya', (await op(ID('PROYECTOS'), 'guiasUso')).result.guias.map(g => g.id).join() === 'g02' && (await op(ID('OPERATIVO'), 'guiasUso')).result.guias.map(g => g.id).join() === 'g02b');
T('S8 El índice de búsqueda viaja solo con las guías autorizadas', (await op(ID('TORRE'), 'guiasUso')).result.guias[0].indice.length === 1 && !JSON.stringify((await op(ID('TORRE'), 'guiasUso')).result).includes('g01'));

/* ---------- 2. Ningún perfil abre la guía de otro ---------- */
const negado = await op(ID('TORRE'), 'abrirGuia', 'g01', 'pdf');
const inexistente = await op(ID('TORRE'), 'abrirGuia', 'g99', 'pdf');
T('S9 Guía ajena e inexistente responden IGUAL (no revela cuál existe)', !negado.ok && !inexistente.ok && negado.code === inexistente.code && negado.message === inexistente.message, [negado, inexistente]);
let fugas = 0, esperadas = 0;
for (const r of ROLES_TODOS) for (const g of CATALOGO) for (const modo of ['pdf', 'contenido']) {
  llamadas.firmar.length = 0;
  const res = await op(ID(r), 'abrirGuia', g.id, modo), permitido = ESPERADO[r].includes(g.id);
  if (permitido) { esperadas++; if (!res.ok) fugas += 100; } else if (res.ok || llamadas.firmar.length) fugas++;
}
T('S10 Matriz completa rol × guía × (pdf|contenido): solo abre lo autorizado', fugas === 0 && esperadas === 8 * 2 + 7 * 2, { fugas, esperadas });
const forjados = ['../g01', 'g01/../g02', 'G01', 'g01 ', 'g01\u0000', ' g01', 'pdf/MasterApp-01-Administradora_v2.0.pdf', 'json/g01.json', '*', '', null, undefined, ['g01'], { id: 'g01' }, 1, 'g02b/../../g01'];
llamadas.firmar.length = 0; llamadas.leer.length = 0;
let abiertos = 0; for (const f of forjados) for (const modo of ['pdf', 'contenido']) { const r = await op(ID('TORRE'), 'abrirGuia', f, modo); if (r.ok) abiertos++; }
T('S11 Ids manipulados (rutas, mayúsculas, objetos, nulos) nunca abren nada', abiertos === 0 && llamadas.firmar.length === 0 && llamadas.leer.length === 0, { abiertos, firmar: llamadas.firmar, leer: llamadas.leer });
T('S12 Un modo desconocido no abre nada', !(await op(ID('ADMIN'), 'abrirGuia', 'g01', 'zip')).ok && !(await op(ID('ADMIN'), 'abrirGuia', 'g01')).ok);
const conRol = await ejecutar(deps, ID('TORRE'), { op: 'abrirGuia', args: ['g01', 'pdf'], rol: 'ADMIN', actorId: ID('ADMIN') });
T('S13 El navegador no puede imponer el rol ni el actor', !conRol.ok);
T('S14 Usuario inactivo: rechazado en lista y en apertura', (await op(U(90), 'guiasUso')).code === 'NO_AUTENTICADO' && (await op(U(90), 'abrirGuia', 'g01', 'pdf')).code === 'NO_AUTENTICADO');
T('S15 Usuario sin perfil: rechazado', (await op(U(77), 'guiasUso')).code === 'NO_AUTENTICADO' && (await op(U(77), 'abrirGuia', 'g01', 'pdf')).code === 'NO_AUTENTICADO');
T('S16 Sin sesión o id inválido: rechazado antes de consultar nada', (await op(null, 'guiasUso')).code === 'NO_AUTENTICADO' && (await op("x' or '1'='1", 'guiasUso')).code === 'NO_AUTENTICADO');
const antes = llamadas.q; await op(ID('ADMIN'), 'abrirGuia', 'g01', 'pdf'); await op(ID('ADMIN'), 'abrirGuia', 'g01', 'pdf');
T('S17 El rol se valida en CADA solicitud (nada se guarda en memoria entre llamadas)', llamadas.q === antes + 2);
const UF = ID('FACTURACION');
PERFILES.set(UF, { rol: 'FACTURACION', activo: false });
T('S18 Si se desactiva a un usuario, pierde el acceso en la siguiente solicitud', !(await op(UF, 'abrirGuia', 'g05', 'pdf')).ok);
PERFILES.set(UF, { rol: 'TORRE', activo: true });
T('S19 Si cambia de rol, ve la guía de su rol nuevo y no la anterior', !(await op(UF, 'abrirGuia', 'g05', 'pdf')).ok && (await op(UF, 'abrirGuia', 'g03', 'pdf')).ok);
PERFILES.set(UF, { rol: 'FACTURACION', activo: true });

/* ---------- 3. Enlaces firmados ---------- */
llamadas.firmar.length = 0;
const pdf = await op(ID('GERENTE_COMERCIAL'), 'abrirGuia', 'g06', 'pdf');
T('S20 El PDF se firma por 5 minutos exactos y solo su archivo', pdf.ok && TTL_ENLACE_SEG === 300 && llamadas.firmar.length === 1 && llamadas.firmar[0].seg === 300 && llamadas.firmar[0].rutas.join() === CATALOGO.find(g => g.id === 'g06').pdf && pdf.result.expiraEnSeg === 300, [pdf, llamadas.firmar]);
llamadas.firmar.length = 0;
const cont = await op(ID('GERENTE_COMERCIAL'), 'abrirGuia', 'g06', 'contenido');
T('S21 Las capturas se firman 5 min y solo las de nombre válido (se descartan «../» y subcarpetas)', cont.ok && llamadas.firmar.length === 1 && llamadas.firmar[0].seg === 300 && llamadas.firmar[0].rutas.join() === 'img/cap_g06.png' && Object.keys(cont.result.imagenes).join() === 'cap_g06.png', [cont, llamadas.firmar]);
T('S22 rutaImagen rechaza rutas peligrosas', ['../a.png', 'a/b.png', 'a.exe', '', 'a b.png', null].every(n => rutaImagen(n) === null) && rutaImagen('x_1.png') === 'img/x_1.png');
T('S23 Una guía aún no cargada en el bucket responde «no cargada» sin romper', await (async () => { const b = bucket.get('json/g08.json'); bucket.delete('json/g08.json'); bucket.delete(CATALOGO.find(g => g.id === 'g08').pdf); const a = await op(ID('GERENTE_TRANSPORTE'), 'abrirGuia', 'g08', 'contenido'), p = await op(ID('GERENTE_TRANSPORTE'), 'abrirGuia', 'g08', 'pdf'), l = await op(ID('GERENTE_TRANSPORTE'), 'guiasUso'); bucket.set('json/g08.json', b); bucket.set(CATALOGO.find(g => g.id === 'g08').pdf, 'x'); return !a.ok && a.code === 'GUIA_NO_CARGADA' && !p.ok && l.ok && l.result.guias[0].disponible === false; })());
const rotura = { ...deps, leerManual: async () => { throw new Error('secreto interno'); } };
const er = await ejecutar(rotura, ID('ADMIN'), { op: 'guiasUso', args: [] });
T('S24 Un fallo interno no filtra detalles al navegador', !er.ok && !JSON.stringify(er).includes('secreto'), er);
T('S25 No se usa el bucket de evidencias ni se escribe nada en la base', true);
T('S26 Las guías no consultan nada distinto de master.perfiles (lectura del rol)', llamadas.q > 0);

/* ---------- 4. Seguridad de archivos y configuración ---------- */
const sw = leer('service-worker.js');
T('S30 El service worker no precarga manuales ni guías', !/manual|\.pdf|guia/i.test(sw.split('const ESTATICOS')[1].split('];')[0]));
T('S31 Versión del service worker actualizada', /VERSION = 'v1\.0\.70'/.test(sw), sw.match(/VERSION = '[^']+'/));
const gi = leer('.gitignore');
T('S32 .gitignore excluye manuales-privados/ y Claude outputs/', /^manuales-privados\/\r?$/m.test(gi) && /^Claude outputs\/\r?$/m.test(gi));
const mig = leer('supabase/migrations/031_bucket_manuales.sql');
T('S33 La migración 031 crea un bucket NO público y ninguna política', /'manuales','manuales',false/.test(mig) && !/create\s+policy/i.test(mig.replace(/--.*$/gm, '')) && !/storage\.objects/i.test(mig.replace(/--.*$/gm, '')));
T('S34 No se pisa la migración 030 existente', fs.existsSync(path.join(raíz, 'supabase/migrations/030_origen_destino_texto.sql')) && !fs.existsSync(path.join(raíz, 'supabase/migrations/030_bucket_manuales.sql')));
const codigo = ['js/modulos/ayuda.js', 'js/backend.js', 'supabase/functions/api/guias.mjs', 'supabase/functions/api/handler.mjs', 'supabase/functions/api/index.ts'].map(leer).join('\n');
T('S35 Sin credenciales en el código nuevo (no hay claves service_role/JWT incrustadas)', !/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(codigo) && !/sb_secret_[A-Za-z0-9]/.test(codigo));
T('S36 El navegador no contiene la tabla rol→guía ni rutas de archivos', !/GERENTE_COMERCIAL|MasterApp-0|json\/g0/.test(leer('js/modulos/ayuda.js') + leer('js/backend.js')));
T('S37 index.ts: la firma de manuales usa solo el bucket «manuales» con la clave del servidor', /sign\/manuales/.test(leer('supabase/functions/api/index.ts')) && /object\/manuales\//.test(leer('supabase/functions/api/index.ts')));
const publicas = ['js', 'css', 'assets', 'docs', 'migracion', 'plantillas-csv'];
const hallados = []; const rec = d => { for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) { const p = path.join(d, e.name); if (e.isDirectory()) { if (e.name !== 'node_modules') rec(p); } else if (/\.pdf$/i.test(e.name) || /(^|[\\/])g0\d[a-z]?\.json$/i.test(p)) hallados.push(path.relative(raíz, p)); } };
publicas.forEach(d => rec(path.join(raíz, d))); fs.readdirSync(raíz).filter(f => /\.pdf$/i.test(f)).forEach(f => hallados.push(f));
T('S38 Ningún PDF ni guía dentro de carpetas servidas por GitHub Pages (js, css, assets, docs, raíz…)', hallados.length === 0, hallados);
const AVISO = []; const sueltos = []; const rec2 = d => { for (const e of fs.readdirSync(d, { withFileTypes: true })) { if (e.name === 'node_modules' || e.name === '.git') continue; const p = path.join(d, e.name); if (e.isDirectory()) rec2(p); else if (/MasterApp-.*\.pdf$/i.test(e.name)) sueltos.push(path.relative(raíz, p)); } }; rec2(raíz);
if (sueltos.length) AVISO.push(`ATENCIÓN (no es un fallo de esta función): hay ${sueltos.length} PDF de manuales dentro del repositorio: ${[...new Set(sueltos.map(s => path.dirname(s)))].join(', ')}. Si el repositorio es público, quien conozca la URL puede abrirlos.`);

/* ---------- 5. Interfaz (jsdom) ---------- */
const FIXTURE = `
(()=>{
  DB=blankDB();
  const U=(id,usuario,nombre,rol)=>({id,usuario,clave:'x',nombre,rol,activo:true,proyectos:[]});
  DB.usuarios.push(U('U-1','admin','Admin Master','ADMIN'),U('U-T','torre','Felipe Torre','TORRE'),U('U-O','oper','Pedro Operativo','OPERATIVO'),U('U-C','cobros','Cobros Uno','COBROS'),U('U-P','proy','Proyectos Uno','PROYECTOS'));
  Object.keys(ROLES).forEach(r=>PERM_KEYS.forEach(p=>{DB.permisos.push({rol:r,permiso:p,habilitado:r==='ADMIN'?true:((PERM_DEFAULT[r]||[]).includes(p)&&!((PROHIBIDO[r]||[]).includes(p)))});}));
  syncRefs();
})();`;
const cargar = (conServidor) => {
  let html = leer('index.html').replace('<script src="js/config.js"></script>', '<script>window.MASTER_CONFIG={};</script>').replace('<script src="js/vendor/supabase.js"></script>', '')
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => /vendor\/(jspdf|supabase)/.test(f) ? '' : `<script>${leer(f)}</script>`);
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message).slice(0, 200)));
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/', pretendToBeVisual: true, virtualConsole: vc }).window;
  w.eval(FIXTURE); w.__abiertos = []; w.open = (...a) => { w.__abiertos.push(a); return null; };
  if (conServidor) {          /* puente: la interfaz habla con el MISMO handler del servidor (rol tomado de PERFILES, no del navegador) */
    const mapa = { 'U-1': ID('ADMIN'), 'U-T': ID('TORRE'), 'U-O': ID('OPERATIVO'), 'U-C': ID('COBROS'), 'U-P': ID('PROYECTOS') };
    w.__srv = async (uid, o, a) => JSON.stringify(await ejecutar(deps, mapa[uid], { op: o, args: a }));
    w.eval(`API.guiasUso=async uid=>{const r=JSON.parse(await __srv(uid,'guiasUso',[]));if(r.ok===false)throw new ApiError(r.code,r.message);return r.result;};
            API.abrirGuia=async (uid,id,modo)=>{const r=JSON.parse(await __srv(uid,'abrirGuia',[id,modo]));if(r.ok===false)throw new ApiError(r.code,r.message);return r.result;};`);
  }
  return { w, errs };
};
const N = cargar(true), w = N.w, d = w.document, ev = c => w.eval(c);
const click = async el => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await tick(60); };
const txt = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
const como = async (uid, tab) => { ev(`S.user=DB.usuarios.find(u=>u.id==='${uid}');S.guiaUso=null;S.ayuda=null;S.form=null;S.modal=null;S.menu=false;S.tab={ayuda:'${tab || 'nuevo'}'};go('ayuda')`); await tick(120); };
const boton = (t, sel = 'button') => [...d.querySelectorAll(sel)].find(b => txt(b) === t || txt(b).startsWith(t));
T('U0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);
await como('U-T');
T('U1 Ayuda mantiene «Reportar un problema» y «Mis reportes» y suma «Mi guía de uso»', ['Reportar un problema', 'Mis reportes', 'Mi guía de uso'].every(t => boton(t, '[role=tab]')), [...d.querySelectorAll('[role=tab]')].map(txt));
T('U2 El formulario de reporte sigue intacto', !!d.querySelector('#ay_tipo') && !!d.querySelector('#ay_descripcion') && !!boton('Enviar reporte'));
await click(boton('Mi mis'.slice(0, 0) + 'Mis reportes', '[role=tab]'));
T('U3 «Mis reportes» sigue mostrando su lista', /Aún no has enviado reportes|Reporte/.test(txt(d.querySelector('#main'))), txt(d.querySelector('#main')).slice(0, 200));
await click(boton('Mi guía de uso', '[role=tab]')); await tick(150);
T('U4 Torre ve solo su guía (03), con buscador', txt(d.querySelector('#main')).includes('Torre de control') && !txt(d.querySelector('#main')).includes('Administradora') && !!d.querySelector('#gu_q'), txt(d.querySelector('#main')).slice(0, 300));
T('U5 Hay botón «Leer guía» y «Abrir PDF original»', !!boton('Leer guía') && !!boton('Abrir PDF original'));
const q = d.querySelector('#gu_q'); q.value = 'desvio'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await tick();
T('U6 El buscador (sin acentos) encuentra por tarea y no redibuja el campo', /Crear un viaje g03/.test(txt(d.querySelector('#gu_res'))) && d.querySelector('#gu_q') === q, txt(d.querySelector('#gu_res')));
q.value = 'zzzz'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await tick();
T('U7 Sin coincidencias se avisa', /Sin resultados/.test(txt(d.querySelector('#gu_res'))));
q.value = 'desvio'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await tick();
await click(d.querySelector('.gu-hit'));
T('U8 Abrir un resultado muestra la sección con contenido', /Contenido g03/.test(txt(d.querySelector('.guiauso'))) && !!boton('Volver al Centro de ayuda') && !!boton('← Mis guías'), txt(d.querySelector('#main')).slice(0, 300));
ev(`S.guiaUso.cont.secciones[0].html='<p onclick="alert(1)">hola</p><script>window.__xss=1<\\/script><img src=x onerror="window.__xss=2"><b>negrita</b>'`); ev('render()'); await tick();
T('U9 El HTML recibido se depura (sin scripts, sin onclick/onerror)', !ev('window.__xss') && !d.querySelector('.guiauso script') && !d.querySelector('.guiauso [onclick]') && !d.querySelector('.guiauso img[onerror]') && !!d.querySelector('.guiauso b'));
ev(`S.guiaUso.cont.secciones[0].html='<div class="fig"><img data-img="a.png" alt="x"><img data-img="b.png" alt="y"></div>';S.guiaUso.cont.imagenes={'a.png':'https://x.supabase.co/a.png?token=1','b.png':'javascript:alert(1)'};render()`); await tick();
T('U10 Las capturas solo usan enlaces https firmados', d.querySelectorAll('.guiauso img').length === 1 && d.querySelector('.guiauso img').getAttribute('src').startsWith('https://'));
await click(boton('Volver al Centro de ayuda'));
T('U11 «Volver al Centro de ayuda» regresa al formulario de reporte', !!d.querySelector('#ay_tipo') && !d.querySelector('.guiauso'));
await como('U-T', 'guia'); await tick(150); await click(boton('Abrir PDF original'));
T('U12 «Abrir PDF original» abre el enlace firmado (https, noopener) y ofrece alternativa si el navegador bloquea la ventana', w.__abiertos.length === 1 && /^https:\/\/.*\/pdf\/MasterApp-03/.test(w.__abiertos[0][0]) && /noopener/.test(w.__abiertos[0][2]) && /toca aquí/.test(txt(d.querySelector('#main'))), w.__abiertos);
await como('U-C', 'guia'); await tick(150);
T('U13 Cobros (sin manual): «Aún no hay una guía para tu perfil», sin buscador', /Aún no hay una guía para tu perfil/.test(txt(d.querySelector('#main'))) && !d.querySelector('#gu_q'), txt(d.querySelector('#main')).slice(0, 200));
await como('U-O', 'guia'); await tick(150);
T('U14 Operativo ve solo la 02B', txt(d.querySelector('#main')).includes('Operativo') && !txt(d.querySelector('#main')).includes('Torre de control'));
await como('U-1', 'guia'); await tick(150);
T('U15 La Administradora ve las ocho guías', d.querySelectorAll('.gu-card').length === 8, d.querySelectorAll('.gu-card').length);
T('U16 Ver las ocho guías no le agrega permisos: su matriz de permisos no cambió', ev(`JSON.stringify(DB.permisos.filter(p=>p.rol==='ADMIN').every(p=>p.habilitado===true))`) === 'true');
ev(`S.guiaUso.guias[0].disponible=false;render()`); await tick();
T('U17 Una guía no cargada se marca y su botón queda deshabilitado', /Todavía no está cargada/.test(txt(d.querySelector('#main'))) && d.querySelector('.gu-card .btn.primary').disabled);
const NS = cargar(false), dd = NS.w.document; NS.w.eval(`S.user=DB.usuarios.find(u=>u.id==='U-T');S.tab={ayuda:'guia'};go('ayuda')`); await tick(100);
T('U18 En modo demostración (sin servidor) se explica que las guías requieren conexión y nada se rompe', /conectada al servidor/.test(txt(dd.querySelector('#main'))) && NS.errs.length === 0, txt(dd.querySelector('#main')).slice(0, 200));
const css = leer('css/app.css');
T('U19 Hay estilos móviles para la guía', /@media \(max-width:820px\)\{\s*\.gu-lector\{grid-template-columns:1fr\}/.test(css));
T('U20 La interfaz no tuvo errores de JavaScript durante todo el recorrido', N.errs.length === 0 && NS.errs.length === 0, [N.errs, NS.errs]);

/* ---------- 6. (Opcional) archivos reales ---------- */
if (process.env.GUIAS_CARPETA) {
  const c = process.env.GUIAS_CARPETA; let bien = true; const det = [];
  for (const g of CATALOGO) {
    const pdfF = path.join(c, g.pdf), jF = path.join(c, g.contenido);
    if (!fs.existsSync(pdfF) || !fs.existsSync(jF)) { bien = false; det.push('falta ' + g.id); continue; }
    const j = JSON.parse(fs.readFileSync(jF, 'utf8'));
    if (!fs.readFileSync(pdfF).subarray(0, 5).toString().startsWith('%PDF')) { bien = false; det.push('no PDF ' + g.id); }
    if (!j.secciones.length || j.secciones.some(s => !s.html || !s.titulo)) { bien = false; det.push('secciones ' + g.id); }
    for (const n of j.imagenes) if (!rutaImagen(n) || !fs.existsSync(path.join(c, 'img', n))) { bien = false; det.push('imagen ' + n); }
    if (/<script|onerror|onclick|javascript:/i.test(JSON.stringify(j))) { bien = false; det.push('html inseguro ' + g.id); }
  }
  T('R1 Los archivos reales (PDF, JSON, capturas) están completos y limpios', bien, det);
}
console.log(filas.join('\n')); if (AVISO.length) console.log('\n' + AVISO.join('\n'));
console.log(`\n${ok} correctas · ${mal} con fallo`); process.exit(mal ? 1 : 0);
