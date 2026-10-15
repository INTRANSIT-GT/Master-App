/* Prueba de extremo a extremo: la interfaz REAL (index.html + js/*) en modo Supabase, hablando con el servidor REAL
   (handler.mjs + store.mjs + SQL reales sobre Postgres/PGlite). Solo se simulan Auth, el transporte HTTP y Storage. */
import { PGlite } from '@electric-sql/pglite';
import { JSDOM } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ejecutar } from '../supabase/functions/api/handler.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const uuid = () => crypto.randomUUID();

/* ---------- base de datos con los SQL reales ---------- */
const db = new PGlite();
await db.exec('set search_path = master, public');   /* las tablas viven en el esquema master (integración AP_VIAJES) */
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users(id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to anon, authenticated; create schema storage;
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select, insert on storage.objects to authenticated;`);
for (const f of ['001_esquema.sql', '002_seguridad_rls.sql', '003_almacenamiento.sql', '004_permisos_base.sql', '006_flota_fleetio.sql', '007_flujo_operativo.sql', '008_contabilidad.sql', '016_ordenes_pago.sql', '017_corregir_estados_rls.sql']) await db.exec(leer('supabase/migrations/' + f));
const U = {}, EMAIL = {};
const mk = async (k, usuario, nombre, rol, proyectos = []) => { U[k] = uuid(); EMAIL[usuario + '@intransit.test'] = U[k]; await db.query('insert into auth.users(id,email) values ($1,$2)', [U[k], usuario + '@intransit.test']);
  await db.query('insert into master.perfiles(id,usuario,email,nombre,rol,proyectos) values ($1,$2,$3,$4,$5,$6)', [U[k], usuario, usuario + '@intransit.test', nombre, rol, proyectos]); };
await db.exec(`insert into clientes(id,nombre,cliente,proyectos) values ('COLGATE','Colgate','COLGATE','{COLGATE,LV}'),('CMI','CMI','CMI','{ABASA}'); insert into clientes_fiscal(cliente_id) values ('COLGATE'),('CMI');`);
await mk('adm', 'admin', 'Administradora', 'ADMIN'); await mk('ped', 'pedro', 'Pedro Chaperon', 'ENCARGADO'); await mk('bry', 'bryan', 'Bryan Cmi', 'ENCARGADO'); await mk('mar', 'mar', 'Mar Liquidaciones', 'LIQUIDACIONES');
await db.query(`insert into acceso_cliente(user_id,cliente_id) values ($1,'COLGATE'),($2,'CMI')`, [U.ped, U.bry]);
await db.exec(`insert into flota values ('T-1','C-1','TNG-1','10 Ton','10TON'),('T-2','C-2','TNG-2','10 Ton','10TON'); insert into pilotos values ('P-1','Piloto Uno','T-1','COLGATE'),('P-2','Piloto Dos','T-2','CMI'); insert into destinos values ('D-C1','Colgate 1','COLGATE'),('D-M1','CMI 1','CMI');`);
let txActual = null;
const deps = { transaccion: fn => db.transaction(tx => { txActual = tx; return fn(async (t, p = []) => tx.query(t, p)); }), firmar: async ps => new Map(ps.map(p => [p, 'https://firmado.test/' + p])),
  crearUsuarioAuth: async ({ email }) => { const id = uuid(); await txActual.query('insert into auth.users(id,email) values ($1,$2)', [id, email]); return id; }, borrarUsuarioAuth: async () => {} };
const srv = (quien, op, ...args) => ejecutar(deps, U[quien], { op, args });
/* Campos obligatorios para iniciar/finalizar el viaje en el flujo actual. */
const tiempos = { tIngresoPlanta: '2031-01-01T08:10', tEsperaRampa: '2031-01-01T08:20', tRampa: '2031-01-01T08:30', tInicioCarga: '2031-01-01T08:40', tFinCarga: '2031-01-01T09:00', tSalidaPlanta: '2031-01-01T09:05', tSalida: '2031-01-01T09:10', tIngresoBodega: '2031-01-01T13:00', tInicioDescarga: '2031-01-01T13:10', tFinDescarga: '2031-01-01T13:40' };
const viajeData = (o = {}) => ({ shipment: 'S-1', opl: 'J&J', tipoViaje: 'ONE WAY', tipoCarga: 'TARIMAS', noCarga: '1', producto: 'Producto', placaArrastre: 'C-ARR-1', ...tiempos, ...o });
const rt = await srv('adm', 'registrarRuta', { codigo: 'COL-001', nombre: 'CP → Colgate 1', cliente: 'COLGATE', proyecto: 'COLGATE', origenId: 'CP', destinoId: 'D-C1' });
const rt2 = await srv('adm', 'registrarRuta', { codigo: 'CMI-001', nombre: 'CP → CMI 1', cliente: 'CMI', proyecto: 'ABASA', origenId: 'CP', destinoId: 'D-M1' });
const sv1 = await srv('ped', 'crearViaje', { cliente: 'COLGATE', proyectoCat: 'COLGATE', pilotoId: 'P-1', rutaId: rt.result.id, fechaPlan: '2031-01-01T08:00', ...viajeData() });
await srv('bry', 'crearViaje', { cliente: 'CMI', proyectoCat: 'ABASA', pilotoId: 'P-2', rutaId: rt2.result.id, fechaPlan: '2031-01-01T09:00', ...viajeData({ shipment: 'S-2' }) });
const V1 = sv1.result.id;

/* ---------- puente: lo que el navegador alcanzaría por la red ---------- */
const subidas = [];
const puente = {
  signIn: async (email, pass) => (EMAIL[email] && pass === 'clave123') ? { id: EMAIL[email] } : null,
  invoke: async (uid, body) => JSON.parse(JSON.stringify(await ejecutar(deps, uid, body))),
  upload: async (uid, ruta) => db.transaction(async tx => { try { await tx.query(`select set_config('request.jwt.claim.sub',$1,true)`, [uid]); await tx.query('set local role authenticated');
    await tx.query(`insert into storage.objects(bucket_id,name,owner) values ('evidencias',$1,$2)`, [ruta, uid]); subidas.push(ruta); return ''; } catch (e) { return e.message; } })
};
function pagina(config) {
  let html = leer('index.html');
  html = html.replace('<script src="js/config.js"></script>', `<script>window.MASTER_CONFIG=${JSON.stringify(config)};</script>`);
  html = html.replace('<script src="js/vendor/supabase.js"></script>', `<script>window.supabase={createClient:()=>{let sesion=null;return{
    auth:{signInWithPassword:async({email,password})=>{const r=await __puente.signIn(email,password);if(!r)return{data:null,error:{message:'invalid'}};sesion=r;return{data:{user:{id:r.id}},error:null};},
      getSession:async()=>({data:{session:sesion}}),signOut:async()=>{sesion=null;return{error:null};}},
    functions:{invoke:async(n,{body})=>({data:await __puente.invoke(sesion&&sesion.id,body),error:null})},
    storage:{from:()=>({upload:async(p,b,o)=>{const e=await __puente.upload(sesion.id,p);return e?{data:null,error:{message:e}}:{data:{path:p},error:null};}})}};}};</script>`);
  html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => `<script>${leer(f)}</script>`);
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/', pretendToBeVisual: true, beforeParse(w) {
    w.__puente = puente; w.crypto.randomUUID ||= () => uuid();
    w.fetch = async url => { const m = /^data:([^;,]+)/.exec(url); return { blob: async () => ({ type: m ? m[1] : 'image/jpeg', size: url.length }) }; };
  } });
  return dom.window;
}
const flush = () => new Promise(r => setTimeout(r, 25));
const cfg = { SUPABASE_URL: 'https://prueba.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_prueba' };
const w = pagina(cfg), d = w.document;
await flush();
const ev = c => w.eval(c);
const click = async el => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await flush(); };
async function login(u, p) { ev('ACT.logout()'); await flush(); d.querySelector('#u').value = u; d.querySelector('#p').value = p; await click(d.querySelector('[data-act=login]')); await flush(); }

T('01 Con URL y clave publishable el modo es Supabase (no demostración)', ev('BACKEND.modo') === 'supabase');
T('02 La portada pide correo, no muestra usuarios de prueba ni contraseñas, e indica el servidor configurado', !!d.querySelector('#u[type=email]') && !/colgate123|admin123/.test(d.querySelector('#app').innerHTML) && !/colgate123|admin123|implan123/.test(leer('index.html')+leer('js/engine.js')+leer('js/ui.js')+leer('js/backend.js')) && /prueba\.supabase\.co/.test(d.body.textContent) && !d.querySelector('[data-act=fill]'));
T('03 La portada muestra solo los logotipos principales: blanco sobre el panel azul y a color sobre el panel claro, sin íconos de servicios', d.querySelectorAll('.lp img.logo').length === 1 && d.querySelector('.lp img.logo').getAttribute('src') === 'assets/logos/logo-blanco.png' && d.querySelectorAll('.lf img.brandc').length === 1 && d.querySelector('.lf img.brandc').getAttribute('src') === 'assets/logos/logo-color.png' && d.querySelectorAll('#app img').length === 2 && !d.querySelector('.svci'));
T('04 No hay datos de demostración cargados en el navegador', ev('DB.trips.length') === 0 && ev('DB.usuarios.length') === 0);
await login('pedro@intransit.test', 'mala');
T('05 Contraseña incorrecta: no entra y lo dice', ev('S.user') === null && /incorrectos/.test(ev('S.loginErr')));
await login('pedro@intransit.test', 'clave123');
T('06 Pedro entra con su cuenta; el perfil viene del servidor', ev('S.user&&S.user.usuario') === 'pedro' && ev('S.user.rol') === 'ENCARGADO');
T('07 Solo recibe los viajes de COLGATE (nada de CMI)', ev('DB.trips.length') === 1 && ev('DB.trips.every(t=>t.proyecto==="COLGATE")'));
T('08 Ningún usuario trae contraseñas al navegador', ev('DB.usuarios.every(u=>!u.clave)') && !/clave/i.test(JSON.stringify(ev('DB.usuarios.map(u=>Object.keys(u))'))) === false || ev('DB.usuarios.every(u=>u.clave===""||u.clave===undefined)'));
const ini = await ev(`API.iniciar(S.user.id,"${V1}").then(r=>"ok",e=>e.code+": "+e.message)`);
T('09 Iniciar un viaje: el servidor lo guarda y la pantalla se actualiza', ini === 'ok' && ev(`DB.trips.find(t=>t.id==="${V1}").estado`) === 'EN_RUTA' && (await db.query('select estado from viajes where id=$1', [V1])).rows[0].estado === 'EN_RUTA', ini);
await ev(`API.finalizar(S.user.id,"${V1}")`);
const liq = await ev(`API.enviarLiquidacion(S.user.id,"${V1}",sampleSlip("x")).then(r=>"ok",e=>e.code+": "+e.message)`);
T('10 La evidencia se sube al almacenamiento protegido (con la política real) y luego se envía la liquidación', liq === 'ok' && subidas.length === 1 && subidas[0].startsWith('viajes/' + V1 + '/'), [liq, subidas]);
T('11 En la base queda solo la ruta del archivo, nunca la imagen incrustada', (await db.query('select path from evidencias')).rows[0].path === subidas[0]);
await login('mar@intransit.test', 'clave123');
T('12 Quien revisa recibe un enlace firmado de la evidencia, sin la ruta interna', ev('DB.evidencias.length') === 1 && /^https:\/\/firmado\.test\//.test(ev('DB.evidencias[0].dataUrl')) && ev('DB.evidencias[0].path') === '');
const apr = await ev(`API.aprobar(S.user.id,"${V1}").then(r=>"ok",e=>e.code+": "+e.message)`);
T('13 Mar aprueba y el estado cambia en el servidor', apr === 'ok' && (await db.query('select estado from viajes where id=$1', [V1])).rows[0].estado === 'ACEPTADO', apr);
T('14 Mar no recibe facturas ni tarifas ni pagos', ev('DB.agrupaciones.length')===0 && ev('DB.tarifas.length')===0 && ev('DB.pagos.length')===0);
await login('bryan@intransit.test', 'clave123');
const intr = await ev(`API.iniciar(S.user.id,"${V1}").then(r=>"ok",e=>e.code+": "+e.message)`);
T('15 Bryan no puede operar un viaje de COLGATE; el rechazo del servidor llega a la pantalla', intr !== 'ok' && /DENEGADO|SIN_PERMISO|NO_/.test(intr), intr);
/* sin conexión */
Object.defineProperty(w.navigator, 'onLine', { get: () => false, configurable: true });
const antes = (await db.query("select count(*)::int n from auditoria")).rows[0].n;
const off = await ev(`API.crearViaje(S.user.id,Object.assign({cliente:"CMI",proyectoCat:"ABASA",pilotoId:"P-2",rutaId:"${rt2.result.id}",fechaPlan:"2031-05-05T08:00"},${JSON.stringify(viajeData({ shipment: 'S-3' }))})).then(r=>"ok",e=>e.code+": "+e.message)`);
w.eval('render()');
T('16 Sin conexión: la operación se rechaza con un mensaje claro y NO se confirma', /^SIN_CONEXION/.test(off) && /NO se guardó/.test(off), off);
T('17 Sin conexión no se escribió nada en el servidor', (await db.query("select count(*)::int n from viajes")).rows[0].n === 2 && (await db.query("select count(*)::int n from auditoria")).rows[0].n === antes);
T('18 Aparece el aviso visible de falta de conexión', !!d.querySelector('.offbar') && /Nada de lo que hagas se guarda/.test(d.querySelector('.offbar').textContent));
Object.defineProperty(w.navigator, 'onLine', { get: () => true, configurable: true }); w.eval('render()');
T('19 Al volver la conexión el aviso desaparece', !d.querySelector('.offbar'));
const con = await ev(`API.crearViaje(S.user.id,Object.assign({cliente:"CMI",proyectoCat:"ABASA",pilotoId:"P-2",rutaId:"${rt2.result.id}",fechaPlan:"2031-05-05T08:00"},${JSON.stringify(viajeData({ shipment: 'S-3' }))})).then(r=>"ok",e=>e.code+": "+e.message)`);
T('20 Con conexión la misma operación se guarda', con === 'ok' && (await db.query("select count(*)::int n from viajes")).rows[0].n === 3, con);
/* seguridad de la configuración */
const w2 = pagina({ SUPABASE_URL: 'https://prueba.supabase.co', SUPABASE_PUBLISHABLE_KEY: 'sb_secret_abcdef' }); await flush();
T('21 Si alguien pone una clave secreta (sb_secret_) la aplicación se niega a usarla', w2.eval('BACKEND.modo') === 'bloqueado');
const jwtSrv = 'x.' + Buffer.from(JSON.stringify({ role: 'service_role' })).toString('base64url') + '.y';
const w3 = pagina({ SUPABASE_URL: 'https://prueba.supabase.co', SUPABASE_PUBLISHABLE_KEY: jwtSrv }); await flush();
T('22 Tampoco usa un JWT con rol service_role', w3.eval('BACKEND.modo') === 'bloqueado');
const w4 = pagina({ SUPABASE_URL: '', SUPABASE_PUBLISHABLE_KEY: '' }); await flush();
T('23 Sin configuración ni datos de ejemplo, la app lo dice claramente y no inventa datos', w4.eval('BACKEND.modo') === 'demo' && /Sin configurar/.test(w4.document.querySelector('#app').textContent) && w4.eval('DB.trips.length') === 0);
/* archivos del proyecto */
const noSecretos = ['index.html', 'js/backend.js', 'js/ui.js', 'js/engine.js', 'manifest.json', 'service-worker.js'].every(f => !/eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(leer(f)));
T('24 Ningún JWT ni clave privada incrustada en el código de la interfaz', noSecretos);
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
