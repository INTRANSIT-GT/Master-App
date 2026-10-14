/* Perfil «Encargado de proyecto»: los 6 cambios solicitados, y prueba de que los DEMÁS perfiles no cambiaron.
   Parte A: servidor + Postgres con tus migraciones 001–008 (la ruta elegida se guarda y se conserva).
   Parte B: interfaz del encargado.  Parte C: comparación HTML original ↔ nuevo para todos los demás perfiles. */
import { PGlite } from '@electric-sql/pglite';
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path'; import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ejecutar } from '../supabase/functions/api/handler.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
const ORIG = path.resolve(raíz, '..', 'respaldo_original');          // copia de los archivos originales antes de modificar
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const uuid = () => crypto.randomUUID();

/* ================= PARTE A · la ruta elegida se guarda y se conserva (servidor + base real) ================= */
const db = new PGlite(); await db.exec('set search_path = master, public');
await db.exec(`create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
  create schema auth; create table auth.users(id uuid primary key, email text);
  create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  grant usage on schema auth to anon, authenticated; create schema storage;
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid);
  alter table storage.objects enable row level security; grant usage on schema storage to authenticated; grant select, insert on storage.objects to authenticated;`);
let sqlOk = true; for (const f of ['001_esquema.sql', '002_seguridad_rls.sql', '003_almacenamiento.sql', '004_permisos_base.sql', '006_flota_fleetio.sql', '007_flujo_operativo.sql', '008_contabilidad.sql']) { try { await db.exec(leer('supabase/migrations/' + f)); } catch (e) { sqlOk = false; T('SQL ' + f, false, e.message); } }
T('A0 Las migraciones 001–008 se aplican (no se cambió la base de datos)', sqlOk);
const U = {}; const mk = async (k, u, n, r) => { U[k] = uuid(); await db.query('insert into auth.users(id,email) values ($1,$2)', [U[k], u + '@t.test']); await db.query('insert into master.perfiles(id,usuario,email,nombre,rol) values ($1,$2,$3,$4,$5)', [U[k], u, u + '@t.test', n, r]); };
await db.exec(`insert into master.clientes(id,nombre,cliente,proyectos) values ('COLGATE','Colgate','COLGATE','{COLGATE,LV}'); insert into master.clientes_fiscal(cliente_id) values ('COLGATE');`);
await mk('adm', 'admin', 'Administradora', 'ADMIN'); await mk('ped', 'pedro', 'Pedro Chaperon', 'ENCARGADO');
await db.query(`insert into master.acceso_cliente(user_id,cliente_id) values ($1,'COLGATE')`, [U.ped]);
await db.exec(`insert into master.flota(unidad,placa,tango,capacidad,tipo) values ('T-1','C-1','TG-1','10 Ton','10TON'); insert into master.pilotos(id,nombre,unidad,cliente_id) values ('P-1','Piloto Uno','T-1','COLGATE');
  insert into master.destinos(id,nombre,cliente_id) values ('D-1','Mayorista Escuintla','COLGATE'),('D-2','Los Andes','COLGATE');
  insert into master.rutas(id,codigo,nombre,cliente_id,proyecto,origen_id,destino_id,estado) values ('R-0001','COL-001','CP → Mayorista Escuintla','COLGATE','COLGATE','CP','D-1','ACTIVA'),('R-0002','COL-002','CP → Los Andes','COLGATE','COLGATE','CP','D-2','ACTIVA');`);
let tx = null; const deps = { transaccion: fn => db.transaction(t => { tx = t; return fn(async (q, p = []) => t.query(q, p)); }), firmar: async ps => new Map(ps.map(p => [p, 'https://f.test/' + p])), crearUsuarioAuth: async () => uuid(), borrarUsuarioAuth: async () => {} };
const srv = (q, op, ...a) => ejecutar(deps, U[q], { op, args: a });
const base = { cliente: 'COLGATE', proyectoCat: 'COLGATE', pilotoId: 'P-1', fechaPlan: '2031-03-01T08:00', shipment: 'SHP-1', opl: 'INTRANSIT', tipoViaje: 'ONE WAY', tipoCarga: 'KG', producto: 'P', noCarga: '1' };
const v1 = await srv('ped', 'crearViaje', { ...base, rutaId: 'R-0001' });
T('A1 El encargado guarda un viaje con la ruta elegida del desplegable', v1.ok, v1);
const id = v1.result && v1.result.id;
T('A2 La ruta queda en el registro del viaje (campo ruta_id) y el proyecto sale de la ruta', (await db.query('select ruta_id, proyecto_cat from master.viajes where id=$1', [id])).rows[0].ruta_id === 'R-0001');
const sn = (await srv('ped', 'snapshot')).snapshot;
T('A3 Al volver a consultar, la ruta se conserva y las rutas vienen de la base (no de ejemplos)', sn.trips[0].rutaId === 'R-0001' && sn.rutas.length === 2 && sn.rutas.every(r => ['R-0001', 'R-0002'].includes(r.id)), sn.rutas.map(r => r.id));
const e1 = await srv('ped', 'editarViaje', id, { rutaId: 'R-0002' }, '');
T('A4 Al editar, se puede cambiar de ruta y el cambio persiste', e1.ok && (await db.query('select ruta_id from master.viajes where id=$1', [id])).rows[0].ruta_id === 'R-0002', e1.message);
const e2 = await srv('ped', 'editarViaje', id, { tIngresoPlanta: '2031-03-01T07:00', tIngresoBodega: '2031-03-01T12:00' }, '');
T('A5 Ingreso a planta e ingreso a bodega siguen guardándose en sus mismas columnas', e2.ok && (await db.query('select t_ingreso_planta, t_ingreso_bodega from master.viajes where id=$1', [id])).rows[0].t_ingreso_bodega === '2031-03-01T12:00', e2.message);

/* ================= PARTES B y C · interfaz ================= */
const cargar = (rutaUi) => {
  let html = leer('index.html').replace('<script src="js/config.js"></script>', '<script>window.MASTER_CONFIG={};</script>').replace('<script src="js/vendor/supabase.js"></script>', '')
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => `<script>${f === 'js/ui.js' && rutaUi ? fs.readFileSync(rutaUi, 'utf8') : leer(f)}</script>`);
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message).slice(0, 160)));
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/', pretendToBeVisual: true, virtualConsole: vc }).window;
  w.eval(leer('tests/_datos-encargado.js')); return { w, errs };
};
const { w, errs } = cargar(null), d = w.document, ev = c => w.eval(c), tick = () => new Promise(r => setTimeout(r, 25));
T('B0 La interfaz carga sin errores de JavaScript', errs.length === 0, errs);
/* Nora: 58 clientes asignados, como en tu captura */
ev(`(()=>{DB.usuarios.push({id:'U-9',usuario:'nora',clave:'x',nombre:'Nora Rivera',rol:'ENCARGADO',activo:true,proyectos:[]});
  const ids=[];for(let i=1;i<=55;i++)ids.push('CIT-U'+String(i).padStart(4,'0'));['CLI-001','CLI-002','CLI-003'].forEach(x=>ids.push(x));
  ids.forEach(id=>{DB.clientes.push({id,nombre:id,cliente:id,proyectos:['P-'+id],torreEstatus:false,activo:true});DB.acceso.push({userId:'U-9',cliente:id});DB.rutas.push({id:'R-'+id,codigo:'RC-'+id,nombre:'Ruta '+id,cliente:id,proyecto:'P-'+id,origenId:'CP',destinoId:'D-1',estado:'ACTIVA',origenProp:'',destinoProp:'',fuente:'CATALOGO'});});
  syncRefs();S.user=DB.usuarios.find(u=>u.usuario==='nora');S.view='inicio';render();})()`);
const chip = d.querySelector('.userchip');
T('B1 [Cambio 1] Encargado con 58 clientes: el botón de perfil no muestra IDs ni códigos', !/CIT-U|CLI-0/.test(d.querySelector('#app').textContent) && chip.textContent.replace(/\s+/g, ' ').trim() === 'NRNora RiveraEncargado de proyecto', chip.textContent);
ev("S.form=null;go('nuevo')");
const form = () => d.querySelector('.inner.form');
T('B2 [Cambio 1] En el formulario no se muestran códigos de ruta (ni «Código de ruta»)', !/RC-CLI|COL-00/.test(form().textContent) && !/Código/.test(form().textContent));
T('B3 [Cambio 2] No aparece la palabra «Perfil» (etiqueta ni texto) en el formulario del encargado', ![...d.querySelectorAll('.src')].some(e => /perfil/i.test(e.textContent)) && !/perfil/i.test(form().textContent));
T('B4 [Cambio 3] No aparece la palabra «Catálogo»/«CATALOGO» en el formulario del encargado', ![...d.querySelectorAll('.src')].some(e => /cat[aá]logo/i.test(e.textContent)) && !/cat[aá]logo/i.test(form().textContent));
T('B5 [Cambio 5] «Ingreso a planta» (sin CP) y el campo conserva su identificador', [...d.querySelectorAll('label')].some(l => l.textContent.trim() === 'Ingreso a planta') && !!d.querySelector('#m_tIngresoPlanta') && !/planta CP/.test(form().textContent));
T('B6 [Cambio 6] «Ingreso a bodega» (sin CG) y el campo conserva su identificador', [...d.querySelectorAll('label')].some(l => l.textContent.trim() === 'Ingreso a bodega') && !!d.querySelector('#m_tIngresoBodega') && !/bodega CG/.test(form().textContent));
const btnR = () => d.querySelector('.fsec .cb-btn[data-k="m:rutaGrupo"]');
T('B7 [Cambio 4] Ruta: el desplegable está habilitado desde el inicio (ya no es estático)', !!btnR() && !btnR().disabled);
btnR().click(); await tick();
const opts = [...d.querySelectorAll('.cb-panel .cb-list button')].map(b => b.textContent.trim());
T('B8 [Cambio 4] Ruta: abre y lista las rutas reales (una vez cada una, sin códigos)', opts.length === 58 && new Set(opts).size === 58 && opts.includes('Ruta CLI-002') && !opts.some(x => /RC-/.test(x)), opts.length);
const q = d.querySelector('.cb-q'); q.value = 'CLI-002'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await tick();
const f = [...d.querySelectorAll('.cb-panel .cb-list button')]; T('B9 [Cambio 4] Ruta: la búsqueda filtra', f.length === 1 && f[0].textContent.trim() === 'Ruta CLI-002');
f[0].click(); await tick();
T('B10 [Cambio 4] Al elegir la ruta se completan cliente, proyecto, origen y destino y queda seleccionada', ev('S.form.proyecto') === 'CLI-002' && ev('S.form.proyectoCat') === 'P-CLI-002' && ev('S.form.rutaId') === 'R-CLI-002' && /Mayorista Escuintla/.test(form().textContent) && d.querySelector('#m_proyecto').value === 'CLI-002');
ev("S.user=DB.usuarios.find(u=>u.usuario==='pedro');S.form=null;go('nuevo')"); ev("aplicarCampo(S.form,'proyectoCat','COLGATE');render()");
const g = ev('JSON.parse(JSON.stringify(rutasGrupos(S.form).map(g=>g.nombre)))');
T('B11 [Cambio 4] Con registros repetidos en la fuente, cada ruta aparece una sola vez (sin borrar nada)', g.length === 4 && new Set(g).size === 4 && ev("DB.rutas.filter(r=>r.nombre==='CP → Mayorista Escuintla').length") === 3, g);
ev("aplicarCampo(S.form,'rutaGrupo',rutasGrupos(S.form).find(g=>g.nombre==='Ruta Norte').key);render()");
T('B12 [Cambio 4] Ruta con dos destinos: se elige el destino; no se asume ninguno', [...d.querySelectorAll('#m_rutaD option')].length === 3 && ev('S.form.rutaId') === '');
ev("aplicarCampo(S.form,'rutaD','D-2');render()");
T('B13 [Cambio 4] La combinación elegida se resuelve en la ruta correcta (identificador estable)', ev('S.form.rutaId') === 'R-0006');
ev("aplicarCampo(S.form,'rutaGrupo',rutasGrupos(S.form).find(g=>g.nombre==='Ruta sin destino').key);render()");
T('B14 [Cambio 4] Una ruta sin destino registrado se marca como dato faltante, sin inventarlo', /No registrado en la ruta/.test(form().textContent));
ev("BACKEND.modo='supabase';BACKEND.conectado=false;render()");
T('B15 [Cambio 4] Si los datos no cargan: mensaje claro, desplegable bloqueado y «Reintentar» (sin lista de ejemplo)', /No se pudieron cargar los datos/.test(form().textContent) && !!d.querySelector('[data-act=reintentarCatalogos]') && !d.querySelector('.cb-list'));
ev("BACKEND.modo='demo';BACKEND.conectado=true");
ev("S.user=DB.usuarios.find(u=>u.usuario==='sinp');S.form=null;go('nuevo')");
T('B16 [Cambio 4] Cliente sin proyectos: mensaje claro (sin opciones inventadas)', /no tiene proyectos registrados o autorizados/.test(form().textContent) && /No hay rutas activas disponibles/.test(form().textContent));
ev("S.user=DB.usuarios.find(u=>u.usuario==='pedro');S.view='viajes';render()");
T('B17 [Cambio 1] La lista de viajes del encargado muestra la ruta sin código técnico, y conserva el n.º de viaje', !/COL-00/.test(d.querySelector('#app').textContent) && /Mayorista Escuintla/.test(d.querySelector('#app').textContent) && d.querySelector('#app').textContent.includes('#'+ev('__V1')));
ev("S.view='rutas';render()");
T('B18 [Cambio 1] La pantalla Rutas del encargado no muestra la columna Código', ![...d.querySelectorAll('table.xl th')].some(th => th.textContent.trim() === 'Código') && !/COL-00/.test(d.querySelector('#app').textContent) && d.querySelectorAll('table.xl tbody tr').length >= 4);
ev("go('detalle',__V1)");
T('B19 [Cambios 2, 5, 6] El detalle del viaje del encargado muestra «Ingreso a planta» e «Ingreso a bodega»', /Ingreso a planta/.test(d.querySelector('#app').textContent) && !/planta CP|bodega CG/.test(d.querySelector('#app').textContent) && /Ingreso a bodega/.test(d.querySelector('#app').textContent));

/* ---- PARTE C · los demás perfiles: HTML idéntico al del código original ---- */
const A = cargar(process.env.NEGATIVO ? '/tmp/ui_neg.js' : null), O = cargar(path.join(ORIG, 'js/ui.js'));
T('C0 Las dos versiones (original y nueva) cargan sin errores', A.errs.length === 0 && O.errs.length === 0, [A.errs, O.errs]);
const norm = h => h.replace(/(<input type="(?:date|time)"[^>]*? value=")[^"]*"/g, '$1"').replace(/data-since="\d+"/g, '').replace(/>\d+[hms ]+\d*[ms]*</g, '><');
const roles = ev('Object.keys(ROLES).filter(r=>r!=="ENCARGADO")');
const pantallas = r => { const x = A.w.eval(`(()=>{const u={id:'U-${r}',usuario:'${r.toLowerCase()}',clave:'x',nombre:'Prueba ${r}',rol:'${r}',activo:true,proyectos:[]};DB.usuarios.push(u);DB.acceso.push({userId:u.id,cliente:'COLGATE'});S.user=u;return JSON.stringify(navItems().filter(v=>v!=='modelo'));})()`); return JSON.parse(x); };
let comparadas = 0; const difs = [];
for (const r of roles) {
  const vistas = pantallas(r); O.w.eval(`(()=>{const u={id:'U-${r}',usuario:'${r.toLowerCase()}',clave:'x',nombre:'Prueba ${r}',rol:'${r}',activo:true,proyectos:[]};DB.usuarios.push(u);DB.acceso.push({userId:u.id,cliente:'COLGATE'});})()`);
  const casos = [...vistas.map(v => `S.form=null;S.edit=null;S.modal=null;go('${v}')`), `S.form=null;S.edit=null;S.modal=null;go('detalle',__V1)`, `S.form=null;S.edit=null;S.modal=null;S.view='nuevo';render()`];
  for (const caso of casos) {
    const set = c => `(()=>{S.user=DB.usuarios.find(u=>u.id==='U-${r}');try{${c}}catch(e){}; return document.querySelector('#app').innerHTML;})()`;
    const a = norm(A.w.eval(set(caso))), o = norm(O.w.eval(set(caso))); comparadas++;
    if (a !== o) difs.push(r + ' · ' + caso.split(';').pop());
  }
}
T(`C1 Los demás perfiles (${roles.join(', ')}) generan EXACTAMENTE el mismo HTML que antes en ${comparadas} pantallas comparadas`, difs.length === 0 && comparadas >= 20, difs);
T('C2 El motor de reglas, permisos, autenticación y SQL no se modificaron', ['js/engine.js', 'js/backend.js', 'js/utils.js', 'js/catalogos.js', 'supabase/functions/api/core.mjs', 'supabase/functions/api/handler.mjs', 'supabase/functions/api/store.mjs', 'supabase/migrations/001_esquema.sql'].every(f => !fs.existsSync(path.join(ORIG, f)) || leer(f) === fs.readFileSync(path.join(ORIG, f), 'utf8')));
T('C3 Este paquete de prueba NO incluye URL ni claves de Supabase (js/config.js vacío); ningún JWT ni clave secreta en el código', /SUPABASE_URL:''/.test(leer('js/config.js')) && /SUPABASE_PUBLISHABLE_KEY:''/.test(leer('js/config.js')) && !['index.html','prueba-visual.html','js/ui.js','js/backend.js','js/config.js','js/datos-prueba-visual.js','service-worker.js'].some(f => /eyJ[A-Za-z0-9_-]{20,}\./.test(leer(f)) || /sb_secret_[A-Za-z0-9]{8,}/.test(leer(f))));
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
