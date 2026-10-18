/* Piloto del viaje distinto al asignado a la unidad.
   - Al elegir la placa se propone el piloto asignado a esa unidad.
   - Se puede cambiar el piloto: se ofrecen los asignados a la unidad y los que no tienen unidad.
   - Cuando el piloto elegido NO es el de la unidad, el viaje guarda la nota «Piloto no asignado a unidad»
     (visible al crear/editar y en el detalle del viaje).
   - El Tango de las unidades: solo se conserva en las del proyecto CMI (sync-flota). */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const tick = () => new Promise(r => setTimeout(r, 20));
const cargar = () => {
  const html = leer('index.html').replace('<script src="js/config.js"></script>', '<script>window.MASTER_CONFIG={};</script>')
    .replace('<script src="js/vendor/supabase.js"></script>', '')
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => `<script>${leer(f)}</script>`);
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message).slice(0, 160)));
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/', pretendToBeVisual: true, virtualConsole: vc }).window;
  w.eval(leer('tests/_datos-admin.js')); return { w, errs };
};
const { w, errs } = cargar(), d = w.document, ev = c => w.eval(c);
T('P0 La interfaz carga sin errores de JavaScript', errs.length === 0, errs);
ev("S.user=DB.usuarios.find(u=>u.rol==='ADMIN');S.view='inicio';S.form=null;S.edit=null;S.modal=null;S.cb=null;render()");

/* ---- 1. Piloto propuesto al elegir la unidad ---- */
ev("S.form=null;go('nuevo');aplicarCampo(S.form,'proyecto','COLGATE');aplicarCampo(S.form,'rutaGrupo',rutasGrupos(S.form).find(g=>g.nombre==='CP → Los Andes').key);aplicarCampo(S.form,'placaSel','T-1');render()");
T('P1 Al elegir la placa se propone el piloto asignado a la unidad', ev('S.form.pilotoId') === 'P-1', ev('S.form.pilotoId'));
T('P2 Unidad con un solo piloto y sin alternativas: no se obliga a elegir a mano', !d.querySelector('#m_pilotoAlt'));
T('P3 Mientras el piloto es el asignado, no hay nota', !d.querySelector('#notaPilotoUnidad'));

/* ---- 2. Se puede cambiar el piloto (piloto sin unidad asignada) ---- */
ev("PILOTOS.push({id:'P-9',nombre:'Piloto Sin Unidad',unidad:'',proyecto:'COLGATE'});syncRefs();S.form.pilotoId='';aplicarCampo(S.form,'placaSel','T-1');render()");
const sel = d.querySelector('#m_pilotoAlt');
const opciones = sel ? [...sel.options].map(o => o.textContent.trim()) : [];
T('P4 Aparece el selector con el piloto de la unidad y el piloto sin unidad', !!sel && opciones.some(o => /Piloto Uno/.test(o)) && opciones.some(o => /Piloto Sin Unidad · sin unidad asignada/.test(o)), opciones);
T('P5 El piloto asignado a la unidad sigue propuesto por defecto', ev('S.form.pilotoId') === 'P-1', ev('S.form.pilotoId'));
ev("aplicarCampo(S.form,'pilotoAlt','P-9');render()");
T('P6 Al cambiar el piloto aparece el aviso «Piloto no asignado a unidad»', /Piloto no asignado a unidad/.test((d.querySelector('#notaPilotoUnidad') || {}).textContent || ''));

/* ---- 3. Se guarda la nota en el viaje ---- */
ev("Object.assign(S.form,{fechaPlanD:'2031-06-01',fechaPlanT:'09:00',shipment:'SHP-NOTA',opl:'INTRANSIT',tipoViaje:'ONE WAY',tipoCarga:'KG',noCarga:'1',producto:'P',placaArrastre:'PA-7'});render()");
await ev('ACT.guardar()'); await tick();
const id = ev('S.form.savedId');
const viaje = k => ev(`(()=>{const t=DB.trips.find(x=>x.id==='${id}')||{};return t[${JSON.stringify(k)}]})()`);
T('P7 El viaje se guarda con el piloto elegido y la unidad Placa del equipo', !!id && viaje('pilotoId') === 'P-9' && viaje('unidadId') === 'T-1', [id, viaje('pilotoId'), viaje('unidadId')]);
T('P8 El viaje guarda la nota «Piloto no asignado a unidad»', viaje('notaPiloto') === 'Piloto no asignado a unidad', viaje('notaPiloto'));
ev(`S.form=null;S.edit=null;S.view='detalle';S.param='${id}';render()`);
T('P9 La nota se ve en el detalle del viaje', /Piloto no asignado a unidad/.test((d.querySelector('#notaPilotoViaje') || {}).textContent || ''));

/* ---- 4. Al editar y volver al piloto asignado, la nota desaparece ---- */
ev(`S.view='detalle';S.param='${id}';S.edit={id:'${id}',data:toModel(API.viaje(S.user.id,'${id}')),motivo:''};aplicarCampo(S.edit.data,'pilotoAlt','P-1');render()`);
await ev('ACT.editSave()'); await tick();
T('P10 Editado al piloto asignado: la nota se limpia', viaje('pilotoId') === 'P-1' && viaje('notaPiloto') === '', [viaje('pilotoId'), viaje('notaPiloto')]);
ev(`S.edit=null;S.view='detalle';S.param='${id}';render()`);
T('P11 El detalle ya no muestra la nota', !d.querySelector('#notaPilotoViaje'));

/* ---- 5. Un viaje normal no lleva nota ---- */
T('P12 Un viaje con el piloto asignado a su unidad no lleva nota', ev("API.viaje(S.user.id,window.__V1).notaPiloto") === '', ev("API.viaje(S.user.id,window.__V1).notaPiloto"));

/* ---- 6. Tango: solo las unidades del proyecto CMI (carga de flota) ---- */
const sync = leer('supabase/functions/sync-flota/index.ts');
T('P13 Al cargar la flota, el Tango se conserva solo en las unidades del proyecto CMI', /cliente_id = 'CMI'/.test(sync) && /set tango = '' where/.test(sync), 'revisa sync-flota');
T('P14 El motor del servidor (core.mjs) y el de la aplicación (engine.js) validan lo mismo para el piloto', /case 'pilotoId'/.test(leer('supabase/functions/api/core.mjs')) && !/no tiene unidad asignada/.test(leer('supabase/functions/api/core.mjs').split("case 'pilotoId'")[1].slice(0, 200)));


/* ---- 7. El arrastre se puede escribir a mano si no está en la lista ---- */
ev("CAT.arrastre=['TC-100','TC-200'];syncRefs();S.form=null;S.edit=null;S.modal=null;S.view='inicio';render();go('nuevo');aplicarCampo(S.form,'proyecto','COLGATE');aplicarCampo(S.form,'placaSel','T-1');render()");
const opsArr = JSON.parse(ev("JSON.stringify((CBOPTS['m:placaArrastre']||[]).map(o=>o.nombre))"));
T('P15 La lista de arrastres ofrece «OTRO EQUIPO» para una placa que no está en la lista', opsArr.some(n => /OTRO EQUIPO/.test(n)), opsArr);
ev("aplicarCampo(S.form,'placaArrastre','__OTRO__');render()");
T('P16 Al elegirlo aparece el campo para escribir la placa', !!d.querySelector('#m_placaArrastreOtro'));
ev("aplicarCampo(S.form,'placaArrastreOtro','TC-999ZZ')");
T('P17 La placa escrita es la que se guarda en el viaje', ev('arrastreFinal(S.form)') === 'TC-999ZZ', ev('arrastreFinal(S.form)'));
ev("S.form=null;go('nuevo');aplicarCampo(S.form,'proyecto','COLGATE');aplicarCampo(S.form,'rutaGrupo',rutasGrupos(S.form).find(g=>g.nombre==='CP → Los Andes').key);aplicarCampo(S.form,'placaSel','T-1');aplicarCampo(S.form,'placaArrastre','__OTRO__');aplicarCampo(S.form,'placaArrastreOtro','TC-999ZZ');Object.assign(S.form,{fechaPlanD:'2031-07-01',fechaPlanT:'08:00',shipment:'SHP-A1',opl:'INTRANSIT',tipoViaje:'ONE WAY',tipoCarga:'KG',noCarga:'1',producto:'P'});render()");
await ev('ACT.guardar()'); await tick();
const idArr = ev('S.form.savedId');
T('P18 El viaje se guarda con la placa escrita a mano', !!idArr && ev(`DB.trips.find(x=>x.id==='${idArr}').placaArrastre`) === 'TC-999ZZ', [idArr, ev('S.form.err')]);
T('P19 Queda disponible en la lista para los próximos viajes', ev("arrastresDisponibles().includes('TC-999ZZ')"));

console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
