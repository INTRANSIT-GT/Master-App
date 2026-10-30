/* Comprobaciones de los archivos del proyecto: rutas relativas (válidas bajo /nombre-del-repo/ en GitHub Pages),
   manifiesto, iconos, service worker y ausencia de secretos. */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ex = f => fs.existsSync(path.join(raíz, f)); const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + JSON.stringify(x).slice(0, 300) : '')); };
const dims = f => { const b = fs.readFileSync(path.join(raíz, f)); return [b.readUInt32BE(16), b.readUInt32BE(20)]; };
const html = leer('index.html');
const css = leer('css/app.css');
const refs = [...html.matchAll(/(?:src|href)="([^"#]+)"/g)].map(m => m[1]).filter(u => !/^https?:/.test(u));
T('01 Todos los recursos de index.html existen', refs.every(ex), refs.filter(r => !ex(r)));
T('02 Todas las rutas son relativas (funcionan en https://usuario.github.io/repositorio/)', refs.every(r => !r.startsWith('/')) && !/(?:src|href)="\/[^\/]/.test(html));
const man = JSON.parse(leer('manifest.json'));
T('03 Manifiesto: modo independiente, inicio y alcance relativos, colores corporativos', man.display === 'standalone' && man.start_url === './' && man.scope === './' && man.theme_color === '#005697' && man.background_color === '#005697' && man.lang === 'es');
T('04 Manifiesto: iconos 192×192 y 512×512 (y maskable) existen con el tamaño declarado', man.icons.every(i => ex(i.src) && dims(i.src).join('x') === i.sizes) && man.icons.some(i => i.sizes === '192x192') && man.icons.some(i => i.sizes === '512x512') && man.icons.some(i => i.purpose === 'maskable'), man.icons.map(i => [i.src, ex(i.src) && dims(i.src)]));
T('05 index.html enlaza el manifiesto, el color de tema y el ícono de iPhone', /rel="manifest" href="manifest.json"/.test(html) && /name="theme-color" content="#005697"/.test(html) && /rel="apple-touch-icon"/.test(html) && /apple-mobile-web-app-capable/.test(html));
T('06 Ícono de iPhone 180×180', dims('assets/icons/apple-touch-icon.png').join('x') === '180x180');
const sw = leer('service-worker.js');
const lista = [...sw.matchAll(/'(\.\/[^']*)'/g)].map(m => m[1]).filter(p => /\.[a-z0-9]+$/.test(p) || p === './');
const faltan = lista.filter(p => p !== './' && !ex(p.slice(2)));
T('07 El service worker solo lista archivos que existen', faltan.length === 0, faltan);
T('08 El service worker no toca otros orígenes (Supabase) ni guarda datos: solo estáticos', /u\.origin !== self\.location\.origin\) return/.test(sw) && !/supabase\.co/.test(sw) && !/\/functions\/v1|\/rest\/v1|\/auth\/v1/.test(sw));
T('09 La portada usa solo los logotipos principales: no hay íconos de servicios ni submarcas', !ex('assets/iconos') && !/iconos\/|ICONOS_SERVICIOS|svcgrid/.test(leer('js/ui.js') + leer('js/assets.js') + leer('css/app.css') + leer('service-worker.js')));
T('10 Logotipos principales incluidos: versión blanca (sobre azul) y versión a color (sobre claro), con la misma proporción', ['logo-blanco.png', 'logo-color.png'].every(n => ex('assets/logos/' + n)) && Math.abs(dims('assets/logos/logo-color.png')[0] / dims('assets/logos/logo-color.png')[1] - 2.935) < 0.01);
const código = ['index.html', 'js/config.js', 'js/backend.js', 'js/ui.js', 'js/engine.js', 'js/pwa.js', 'service-worker.js', 'manifest.json'].map(leer).join('\n');
/* La clave publishable/anon es un JWT público por diseño: solo se permite en js/config.js. */
const códigoSinConfig = ['index.html', 'js/backend.js', 'js/ui.js', 'js/engine.js', 'js/pwa.js', 'service-worker.js', 'manifest.json'].map(leer).join('\n');
T('11 Sin JWT, claves privadas ni contraseñas en el código que se publica', !/eyJ[A-Za-z0-9_-]{20,}\./.test(códigoSinConfig) && !/sb_secret_[A-Za-z0-9]{10,}/.test(código) && !/(admin|colgate|cmi|torre|liq|comercial|gerencia|cocacola|fritolay|implan)123/.test(código));
const cfg = leer('js/config.js');
T('12 js/config.js solo lleva la clave publishable/anon (nunca una secreta)', !/sb_secret_/.test(cfg) && (() => {
  const m = cfg.match(/SUPABASE_PUBLISHABLE_KEY:'([^']*)'/); if (!m || !m[1]) return true;
  try { return JSON.parse(Buffer.from(m[1].split('.')[1], 'base64url').toString()).role === 'anon'; } catch (e) { return /^sb_publishable_/.test(m[1]); }
})());
T('13 El motor del servidor está al día con js/engine.js (ejecuta: npm run build:core)', (() => { const g = leer('supabase/functions/api/core.mjs'); const e = leer('js/engine.js').replace(/\/\*#BROWSER\*\/[\s\S]*?\/\*#END\*\//g, ''); return g.includes(e); })());
T('14 No existe la clave service_role en ningún archivo de la interfaz', !/SUPABASE_SERVICE_ROLE_KEY/.test(código));
T('15 La Edge Function usa la clave de servicio solo desde variables de entorno del servidor', /Deno\.env\.get\("SUPABASE_SERVICE_ROLE_KEY"\)/.test(leer('supabase/functions/api/index.ts')) && !/eyJ/.test(leer('supabase/functions/api/index.ts')));
T('16 El menú del teléfono respeta el área segura: la primera opción no queda bajo el notch', /body\.mob \.side\{[^}]*padding:calc\(var\(--safe-t\)/.test(css) && /--safe-t:\s*env\(safe-area-inset-top/.test(css) && /body\.mob \.side\{[^}]*overflow:auto/.test(css));
/* Rendimiento: estas dos formas de consultar ya se midieron como lentas en Supabase y no deben volver. */
const handler = [leer('supabase/functions/api/handler.mjs'), leer('supabase/functions/api/read.mjs'), leer('supabase/functions/api/snapshot.mjs')].join(String.fromCharCode(10));
T('17 Las lecturas no esperan el lock de escritura (era la espera de hasta 12 s de Supabase)', /if \(!OPS_LECTURA\.includes\(op\)\) await q\('select pg_advisory_xact_lock\(727001\)'\)/.test(handler) && !/pg_advisory_xact_lock\$\{/.test(handler));
T('18 El conteo y el resumen por mes usan una sola consulta de conjunto (no evalúan la función de RLS fila por fila)', !/count\(\*\)[\s\S]{0,120}app\.ve_viaje/.test(handler) && /function filtroVisible\(A, db, E\)/.test(handler) && /from master\.viajes v where \$\{f\.sql\}/.test(handler) && /substring\(coalesce\(v\.fecha_plan/.test(handler));
/* La lista de asignados (clientes/proyectos de un usuario) tiene que verse: sin altura propia el navegador
   la deja en una sola línea y los nombres quedan ilegibles. */
T('19 Las listas de asignación usan casillas legibles (con altura y scroll), no el <select multiple> del navegador', /\.mv-list\{[^}]*min-height:170px/.test(css) && /\.mv-list \.mv-it\{[^}]*color:var\(--ink\)/.test(css) && /const col=\(id,items,ph,asignado\)=>`<div class="mv-list"/.test(leer('js/ui.js')));
T('20 El diálogo conserva su desplazamiento al re-renderizar (mover un cliente no devuelve al inicio del formulario)', /const dlgPrev=\$\('\.dlg'\)/.test(leer('js/ui.js')) && /reponer\(\);/.test(leer('js/ui.js')));
T('21 El perfil administrador se muestra como ADMIN (no «Administradora») y la gráfica de Finanzas sigue los filtros', /ADMIN:\{label:'ADMIN'/.test(leer('js/engine.js')) && /ADMIN:\{label:'ADMIN'/.test(leer('supabase/functions/api/core.mjs')) && /function cargaGrafica\(\)/.test(leer('js/ui.js')) && /cargaGrafica\(\);/.test(leer('js/modulos/finanzas.js')));
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);

T('22 Sin notas de arquitectura en la interfaz y con cambio de modo claro/oscuro', !/Notas de arquitectura|Cuadro de Power Apps|toggleArch|class="arch"/.test(leer('js/ui.js')) && /data-act="toggleTema"/.test(leer('js/ui.js')) && /function aplicarTema\(/.test(leer('js/ui.js')) && /:root\[data-theme="dark"\]/.test(css) && /:root\[data-theme="light"\]|data-theme="light"/.test(css) && /color-scheme:dark/.test(css));
