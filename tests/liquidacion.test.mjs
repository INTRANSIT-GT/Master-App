/* Liquidación de viajes que quedaron Entregados o Rechazados SIN fecha de entrega.
   Es el caso de las cargas anteriores al cambio de flujo (la migración 007 renombró los estados y no
   llenó `finalizado_en`): el estado ya garantiza que el viaje se entregó, así que la liquidación debe
   poder enviarse y la fecha de entrega se completa sola (queda en la bitácora).
   Un viaje que todavía no se entregó sigue bloqueado con el mismo mensaje de siempre. */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 300) : '')); };
const tick = () => new Promise(r => setTimeout(r, 20));
const html = leer('index.html').replace('<script src="js/config.js"></script>', '<script>window.MASTER_CONFIG={};</script>')
  .replace('<script src="js/vendor/supabase.js"></script>', '')
  .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => `<script>${leer(f)}</script>`);
const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message).slice(0, 160)));
const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/', pretendToBeVisual: true, virtualConsole: vc }).window;
const d = w.document, ev = c => w.eval(c);
ev(leer('tests/_datos-admin.js'));
T('L0 La interfaz carga sin errores de JavaScript', errs.length === 0, errs);
ev("S.user=DB.usuarios.find(u=>u.rol==='ADMIN');S.view='inicio';S.form=null;S.edit=null;S.modal=null;S.cb=null;render()");

const V1 = ev('window.__V1'), V2 = ev('window.__V2');
const foto = 'data:image/jpeg;base64,' + 'A'.repeat(400);
ev(`window.__FOTO='${foto}'`);

/* ---- 1. Un viaje Entregado sin fecha de entrega (carga vieja) sí se puede liquidar ---- */
ev(`(()=>{const t=DB.trips.find(x=>x.id==='${V1}');t.unidadId='T-1';TKEYS.forEach(k=>{t[k]='08:00'});})()`);
ev(`API.iniciar('U-1','${V1}')`); ev(`API.finalizar('U-1','${V1}')`); await tick();
T('L1 El viaje de ejemplo queda Entregado con su fecha de entrega',
  ev(`DB.trips.find(x=>x.id==='${V1}').estado`) === 'ENTREGADO' && !!ev(`DB.trips.find(x=>x.id==='${V1}').finalizadoEn`),
  ev(`DB.trips.find(x=>x.id==='${V1}').estado`));
ev(`DB.trips.find(x=>x.id==='${V1}').finalizadoEn=''`);   /* así quedaron los viajes de la carga anterior */
const r1 = ev(`(()=>{try{API.enviarLiquidacion('U-1','${V1}',window.__FOTO);return 'ok'}catch(e){return e.code+': '+e.message}})()`);
T('L2 Un viaje Entregado sin fecha de entrega se liquida igual', r1 === 'ok', r1);
T('L3 El viaje queda Liquidado', ev(`DB.trips.find(x=>x.id==='${V1}').estado`) === 'LIQUIDADO', ev(`DB.trips.find(x=>x.id==='${V1}').estado`));
T('L4 La fecha de entrega se completa automáticamente', !!ev(`DB.trips.find(x=>x.id==='${V1}').finalizadoEn`), ev(`DB.trips.find(x=>x.id==='${V1}').finalizadoEn`));
T('L5 Queda registrado en la bitácora del viaje', ev(`DB.audit.some(a=>a.viajeId==='${V1}'&&/Fecha de entrega completada/.test(a.accion))`));

/* ---- 2. Rechazado sin fecha de entrega: se puede reenviar la liquidación ---- */
ev(`API.devolver('U-1','${V1}','Falta la firma del cliente')`); await tick();
T('L6 El rechazo deja el viaje en Rechazado', ev(`DB.trips.find(x=>x.id==='${V1}').estado`) === 'RECHAZADO', ev(`DB.trips.find(x=>x.id==='${V1}').estado`));
ev(`DB.trips.find(x=>x.id==='${V1}').finalizadoEn=''`);
const r2 = ev(`(()=>{try{API.enviarLiquidacion('U-1','${V1}',window.__FOTO);return 'ok'}catch(e){return e.code+': '+e.message}})()`);
T('L7 Un viaje Rechazado sin fecha de entrega se puede volver a liquidar', r2 === 'ok', r2);
T('L8 El segundo envío queda como ciclo 2', ev(`DB.trips.find(x=>x.id==='${V1}').liqIntentos`) === 2, ev(`DB.trips.find(x=>x.id==='${V1}').liqIntentos`));

/* ---- 3. Antes de entregar el viaje la liquidación sigue bloqueada ---- */
const r3 = ev(`(()=>{try{API.enviarLiquidacion('U-1','${V2}',window.__FOTO);return 'ok'}catch(e){return e.code+': '+e.message}})()`);
T('L9 Un viaje que aún no se entregó sigue bloqueado con aviso claro',
  /^ESTADO_INVALIDO: La liquidación no puede enviarse antes de entregar el viaje\.$/.test(r3), r3);

/* ---- La validación de liquidaciones vive en VIAJES («Por validar»); Liquidaciones queda con tres pestañas ---- */
const tabsDe = v => {
  ev(`S.user=DB.usuarios.find(u=>u.rol==='ADMIN');S.view='${v}';S.tab={};S.modal=null;S.edit=null;S.form=null;render()`);
  return [...d.querySelectorAll('#main .tabs button')].map(b => b.textContent.replace(/\s*\d+$/, '').trim());
};
const tabsViajes = tabsDe('viajes'), tabsLiq = tabsDe('liquidaciones');
T('L10 VIAJES tiene la pestaña «Por validar» (la revisión de liquidaciones ya no vive en Liquidaciones)', tabsViajes.includes('Por validar'), tabsViajes);
T('L11 LIQUIDACIONES se queda con Por liquidar, Rechazados y Aceptados', JSON.stringify(tabsLiq) === JSON.stringify(['Por liquidar', 'Rechazados', 'Aceptados']), tabsLiq);
ev(`(()=>{const t=DB.trips.find(x=>x.id==='${V2}');t.estado='LIQUIDADO';S.user=DB.usuarios.find(u=>u.rol==='ADMIN');S.view='viajes';S.tab={viajes:'val'};S.q='';S.fCli='';S.fPcat='';S.fDesde='';S.fHasta='';render();})()`);
const txtVal = d.querySelector('#main').textContent.replace(/\s+/g, ' ');
const vbHtml = (d.querySelector('#main #vb') || {}).innerHTML || '';
T('L12 La pestaña «Por validar» muestra la evidencia con las acciones de revisión', /Aceptar/i.test(txtVal) && /Rechazar/i.test(txtVal) && !!d.querySelector('#main #vb table'), [vbHtml.slice(0, 300), errs.slice(0, 2)]);

/* ---- Aprobar un Shipment duplicado: el aviso usaba el resultado antes de existir («Cannot access 'r'») ---- */
const dup = await (async () => {
  ev(`(()=>{const t=DB.trips.find(x=>x.id==='${V2}');t.estado='ENTREGADO';t.shipment='CASE1';DB.trips.push(Object.assign({},t,{id:'V-DUP2',shipment:'case1'}));})()`);
  const antes = ev("typeof ACT.shipmentDupOk");
  await ev(`ACT.shipmentDupOk({id:'${V2}'})`);
  await tick();
  return { antes, ship: ev(`DB.trips.find(x=>x.id==='${V2}').shipment`), aprobado: ev(`!!DB.trips.find(x=>x.id==='${V2}').duplicadoAprobado`) };
})();
T('L13 Aprobar un Shipment duplicado funciona (antes terminaba en «Cannot access \'r\' before initialization»)', dup.ship === 'DUP-CASE1' && dup.aprobado === true, dup);
T('L14 El error del aviso no vuelve a aparecer en la interfaz', !errs.some(e => /before initialization/.test(e)), errs);
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
