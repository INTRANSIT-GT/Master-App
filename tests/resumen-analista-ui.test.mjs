/* Pruebas de la pestaña «Resumen» del Asistente Comercial (módulo «analista»): indicadores, tablas tipo hoja de cálculo con totales,
   gráficos, filtros, búsqueda, orden y detalle operativo por selección. Sin descargas de Excel. Comprueba los totales contra los viajes reales del motor.
   jsdom con el motor local; no usa Supabase real. */
import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FIXTURE } from './_oc-fixture.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };
const tick = (ms = 30) => new Promise(r => setTimeout(r, ms));
const cargar = () => {
  let html = leer('index.html').replace('<script src="js/config.js"></script>', '<script>window.MASTER_CONFIG={};</script>').replace('<script src="js/vendor/supabase.js"></script>', '')
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => /vendor\/supabase/.test(f) ? '' : `<script>${leer(f)}</script>`);
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message).slice(0, 200)));
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/', pretendToBeVisual: true, virtualConsole: vc }).window;
  w.eval(FIXTURE); return { w, errs };
};
const N = cargar(), w = N.w, d = w.document, ev = c => w.eval(c);
const J = c => JSON.parse(ev(`JSON.stringify(${c})`));
const click = async el => { el.dispatchEvent(new w.MouseEvent('click', { bubbles: true, cancelable: true })); await tick(); };
const cambia = async (el, v) => { el.value = v; el.dispatchEvent(new w.Event('change', { bubbles: true })); await tick(); };
const txt = el => (el ? el.textContent : '').replace(/\s+/g, ' ').trim();
const como = (uid, vista) => ev(`S.user=DB.usuarios.find(u=>u.id==='${uid}');S.modal=null;S.cb=null;S.menu=false;S.navK='';S.tab={};S.sel=[];S.q='';go('${vista}')`);
const boton = t => [...d.querySelectorAll('button')].find(b => txt(b) === t || txt(b).startsWith(t));
const toasts = () => [...d.querySelectorAll('#toasts .toast')].map(txt);
const flt = k => d.querySelector(`[data-flt="${k}"]`);

/* ---- Datos extra: viajes facturados/cobrados, otro mes, un viaje sin unidad y estados que NO cuentan ---- */
ev(`(()=>{
  const f=(o,e)=>{const id=__mk(o,500);const t=DB.trips.find(x=>x.id===id);t.estado=e;return id;};
  window.__X={fac:f({shipment:'X-F',pilotoId:'P-4',cliente:'COCACOLA',proyectoCat:'COCACOLA',rutaId:'R-0002',fechaPlan:'2031-06-20T08:00'},'FACTURADO'),
    cob:f({shipment:'X-C',pilotoId:'P-1',fechaPlan:'2031-06-21T08:00'},'COBRADO'),
    liq:f({shipment:'X-L',pilotoId:'P-2',fechaPlan:'2031-06-22T08:00'},'LIQUIDADO'),
    ent:f({shipment:'X-E',pilotoId:'P-2',fechaPlan:'2031-06-23T08:00'},'ENTREGADO'),
    rech:f({shipment:'X-R',pilotoId:'P-3',fechaPlan:'2031-06-24T08:00'},'RECHAZADO'),
    sinU:f({shipment:'X-SU',pilotoId:'P-3',fechaPlan:'2031-06-25T08:00'},'ACEPTADO')};
  DB.trips.find(x=>x.id===__X.sinU).unidadId='';
})()`);
/* Referencia independiente: los viajes que ve el Asistente con liquidación aprobada (Aceptado/Facturado/Cobrado) */
const REF = (f = {}) => {
  const ts = J(`API.listarViajes('U-N').map(t=>({id:t.id,estado:t.estado,cli:t.proyecto,pcat:t.proyectoCat||'',fecha:(t.fechaPlan||'').slice(0,10),placa:((FLOTA.find(x=>x.unidad===t.unidadId)||{}).placa)||''}))`)
    .filter(t => ['ACEPTADO', 'FACTURADO', 'COBRADO'].includes(t.estado))
    .filter(t => (!f.desde || t.fecha >= f.desde) && (!f.hasta || t.fecha <= f.hasta) && (!f.cli || t.cli === f.cli) && (!f.pcat || t.pcat === f.pcat) && (!f.uni || t.placa === f.uni));
  const s = k => new Set(ts.map(t => t[k]).filter(Boolean)).size;
  return { ts, kpi: { viajes: ts.length, clientes: s('cli'), unidades: s('placa'), proyectos: new Set(ts.filter(t => t.pcat).map(t => t.cli + '|' + t.pcat)).size } };
};
const kpis = () => [...d.querySelectorAll('.rs-kpis .kpi .n')].map(x => Number(txt(x)));
const kpiOk = r => JSON.stringify(kpis()) === JSON.stringify([r.kpi.viajes, r.kpi.clientes, r.kpi.unidades, r.kpi.proyectos]);
const cuerpo = id => [...d.querySelectorAll(`#${id} tbody tr`)].map(tr => [...tr.cells].map(txt));
const pie = id => [...d.querySelectorAll(`#${id} tfoot td`)].map(txt);
const cab = id => [...d.querySelectorAll(`#${id} thead th`)].map(th => txt(th).replace(/[▲▼↕]/g, '').trim());
const detIds = () => cuerpo('rsTDet').map(r => r[3].replace('#', ''));
const detTotal = () => Number((pie('rsTDet')[0] || '').match(/Total: (\d+)/)?.[1]);

T('R0 La interfaz carga sin errores de JavaScript', N.errs.length === 0, N.errs);
como('U-N', 'analista');
const tabsA = [...d.querySelectorAll('[role=tab]')].map(txt);
T('M1 «Resumen» es una pestaña del Asistente Comercial (sin módulo nuevo)', tabsA.includes('Resumen') && tabsA.includes('Pendientes de gestión'), tabsA);
T('M2 Al entrar sigue abriendo «Pendientes de gestión»', ev("document.querySelector('[role=tab][aria-selected=true]').textContent").includes('Pendientes'));
como('U-F', 'factcom'); T('M3 Facturación Comercial no recibe la pestaña Resumen', ![...d.querySelectorAll('[role=tab]')].map(txt).includes('Resumen'));
como('U-1', 'comercial'); T('M4 La pantalla Comercial general no recibe la pestaña Resumen', ![...d.querySelectorAll('[role=tab]')].map(txt).includes('Resumen'));
como('U-N', 'analista');
await click([...d.querySelectorAll('[role=tab]')].find(b => txt(b) === 'Resumen'));
T('M5 Al pulsar la pestaña se abre el resumen dentro de la app', !!d.querySelector('.rs-kpis') && !!d.querySelector('#rsTCli'));
T('M6 Sin botón ni función de Excel en el Resumen', !/excel/i.test(txt(d.querySelector('#main') || d.body)) && ev('typeof expResumenXlsx') === 'undefined' && ev('typeof rsExcel') === 'undefined');

/* ---------- Indicadores ---------- */
let R = REF();
T('K1 Indicadores = viajes reales del Asistente (Aceptado/Facturado/Cobrado)', kpiOk(R), [kpis(), R.kpi]);
T('K2 Excluye Planificado, Entregado, Liquidado y Rechazado; incluye Facturado y Cobrado', !J('rsDatos().viajes.map(t=>t.id)').some(id => [ev('__X.liq'), ev('__X.ent'), ev('__X.rech'), ev('__V.plan')].includes(id)) && J('rsDatos().viajes.map(t=>t.id)').includes(ev('__X.fac')) && J('rsDatos().viajes.map(t=>t.id)').includes(ev('__X.cob')));
T('K3 Viaje sin unidad: cuenta como viaje, no como unidad, y se avisa', J('rsDatos().sinUnidad') === 1 && /no tienen unidad registrada/.test(txt(d.querySelector('#main') || d.body)));

/* ---------- Por cliente ---------- */
let tc = cuerpo('rsTCli');
const refCli = Object.entries(R.ts.reduce((m, t) => (m[t.cli] = (m[t.cli] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]);
const meses = [...new Set(R.ts.map(t => t.fecha.slice(0, 7)))].sort();
T('C1 Columnas: Cliente, Viajes, Proyectos, Unidades y una columna por período (mes)', JSON.stringify(cab('rsTCli').slice(0, 4)) === JSON.stringify(['Cliente', 'Viajes', 'Proyectos', 'Unidades']) && cab('rsTCli').length === 4 + meses.length, cab('rsTCli'));
T('C2 Un renglón por cliente, de mayor a menor viajes', tc.length === refCli.length && tc.every((r, i) => Number(r[1]) === refCli[i][1]), [tc, refCli]);
const col = R.ts.filter(t => t.cli === 'COLGATE'), rCol = tc.find(r => r[0] === 'COLGATE');
T('C3 COLGATE: viajes, proyectos y unidades correctos', rCol && Number(rCol[1]) === col.length && Number(rCol[2]) === new Set(col.map(t => t.pcat)).size && Number(rCol[3]) === new Set(col.map(t => t.placa).filter(Boolean)).size, rCol);
T('C4 Las columnas por mes de cada cliente suman sus viajes y coinciden con los reales', tc.every(r => r.slice(4).reduce((s, v) => s + Number(v), 0) === Number(r[1])) && meses.every((m, i) => Number(rCol[4 + i]) === col.filter(t => t.fecha.startsWith(m)).length), tc);
const pc = pie('rsTCli');
T('C5 Fila Total: viajes, proyectos y unidades distintos, y total por mes', pc[0] === 'Total' && Number(pc[1]) === R.kpi.viajes && Number(pc[2]) === R.kpi.proyectos && Number(pc[3]) === R.kpi.unidades && meses.every((m, i) => Number(pc[4 + i]) === R.ts.filter(t => t.fecha.startsWith(m)).length), pc);
await click([...d.querySelectorAll('[data-act="rsPer"]')].find(b => b.dataset.v === 'dia'));
T('C6 «Día» cambia las columnas de período a una por día con viajes', cab('rsTCli').length === 4 + new Set(R.ts.map(t => t.fecha)).size && pie('rsTCli').slice(4).reduce((s, v) => s + Number(v), 0) === R.kpi.viajes);
await click([...d.querySelectorAll('[data-act="rsPer"]')].find(b => b.dataset.v === 'semana'));
{ const sw = J('rsDatos().serie'); const k = x => (sw.find(p => p.k === x) || {}).viajes;
T('C7 «Semana» (lunes a domingo): 28/12/2031 va en la del 22/12; 29/12/2031 y 04/01/2032 en la del 29/12', k('2031-12-22') >= 1 && k('2031-12-29') === 2 && !sw.some(p => p.k === '2032-01-04') && cab('rsTCli').includes('Sem. 29/12/2031'), sw); }
await click([...d.querySelectorAll('[data-act="rsPer"]')].find(b => b.dataset.v === 'mes'));
T('C8 Sin las gráficas «Viajes por cliente» y «Viajes por mes» (retiradas)', !d.querySelector('#rsCli .rs-hb') && !d.querySelector('#rsCli svg') && !/Viajes por cliente|Viajes por mes/.test(txt(d.querySelector('#rsCli'))) && !!d.querySelector('#rsTCli'));

/* ---------- Por unidad ---------- */
const tu = cuerpo('rsTUni');
T('U1 Columnas: Placa, Tipo de unidad, Cliente, Proyecto, Viajes (+ total de la placa y actividad)', JSON.stringify(cab('rsTUni').slice(0, 5)) === JSON.stringify(['Placa', 'Tipo de unidad', 'Cliente', 'Proyecto', 'Viajes']), cab('rsTUni'));
const combos = Object.entries(R.ts.filter(t => t.placa).reduce((m, t) => { const k = t.placa + '|' + t.cli + '|' + t.pcat; m[k] = (m[k] || 0) + 1; return m; }, {}));
T('U2 Un renglón por placa + cliente + proyecto con sus viajes reales', tu.length === combos.length && combos.every(([k, n]) => { const [p, c, pr] = k.split('|'); return tu.some(r => r[0] === p && r[2] === ev(`rsCliId('${c}')`) && r[3] === pr && Number(r[4]) === n && r[1] === '10TON'); }), [tu, combos]);
const porPlaca = Object.entries(R.ts.filter(t => t.placa).reduce((m, t) => (m[t.placa] = (m[t.placa] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]);
T('U3 Las unidades con más actividad aparecen primero (total de la placa)', tu[0][0] === porPlaca[0][0] && Number(tu[0][5]) === porPlaca[0][1] && tu.map(r => Number(r[5])).every((v, i, a) => !i || a[i - 1] >= v), tu.map(r => r[0] + ':' + r[5]));
T('U4 Fila Total de unidades: viajes con unidad y número de unidades', Number(pie('rsTUni')[2]) === R.ts.filter(t => t.placa).length && pie('rsTUni')[1].startsWith(String(R.kpi.unidades)), pie('rsTUni'));
T('U5 Sin la gráfica «Unidades con más viajes» (retirada); la tabla por unidad sigue', !d.querySelector('#rsUniT .rs-hb') && !/Unidades con más viajes/.test(txt(d.querySelector('#rsUniT'))) && !!d.querySelector('#rsTUni'));
T('U6 Ninguna gráfica de barras ni SVG queda en toda la sección', !d.querySelector('#main .rs-hbars, #main .rs-graf, #main .rs-dos') && ![...d.querySelectorAll('#main .rs-sec svg')].some(x => x.getAttribute('role') === 'img'));

/* ---------- Por proyecto ---------- */
const tp = cuerpo('rsTPro');
T('P1 Tabla por proyecto: Cliente, Proyecto, Viajes, Unidades', JSON.stringify(cab('rsTPro')) === JSON.stringify(['Cliente', 'Proyecto', 'Viajes', 'Unidades utilizadas']) && tp.length === R.kpi.proyectos && tp.some(r => r[0] === 'COLGATE' && r[1] === 'COLGATE-B' && Number(r[2]) === R.ts.filter(t => t.pcat === 'COLGATE-B').length), tp);
T('P2 Fila Total de proyectos = total de viajes', Number(pie('rsTPro')[2]) === R.kpi.viajes && tp.reduce((s, r) => s + Number(r[2]), 0) === R.kpi.viajes, pie('rsTPro'));

/* ---------- Detalle operativo ---------- */
const COLS = ['Fecha', 'Cliente', 'Proyecto', 'ID viaje', 'No. viaje', 'Tango', 'OPL', 'Placa', 'Tipo de unidad', 'Piloto', 'Origen', 'Destino', 'Ruta', ...J('CAMPOS_TIEMPO.map(x=>x[1])'), 'Estado'];
T('D1 Detalle con los campos pedidos (incluye Tango, OPL y los horarios operativos)', JSON.stringify(cab('rsTDet')) === JSON.stringify(COLS), cab('rsTDet'));
T('D2 El detalle tiene exactamente los registros de los indicadores', detTotal() === R.kpi.viajes && JSON.stringify(detIds().sort()) === JSON.stringify(R.ts.map(t => t.id).sort()), [detTotal(), detIds().length]);
const fx = cuerpo('rsTDet').find(r => r[3] === '#' + ev('__V.a'));
T('D3 Un registro muestra sus datos reales (Tango, OPL, placa, piloto, ruta, estado)', fx && fx[5] === '1' && fx[6] === 'INTRANSIT' && fx[7] === 'C-111AAA' && fx[9] === 'Piloto Uno' && /Mayorista/.test(fx[12]) && fx[fx.length - 1] === 'Aceptado', fx);
/* selección */
await click([...d.querySelectorAll('#rsTCli [data-act="rsVer"]')].find(b => b.dataset.k === 'COCACOLA'));
T('S1 Seleccionar un cliente muestra solo sus viajes en el detalle', JSON.stringify(detIds().sort()) === JSON.stringify(R.ts.filter(t => t.cli === 'COCACOLA').map(t => t.id).sort()) && /Cliente COCA-COLA/.test(txt(d.querySelector('#rsDetalle'))), detIds());
await click([...d.querySelectorAll('#rsTUni [data-act="rsVer"][data-t="uni"]')].find(b => b.dataset.k === 'C-222BBB'));
T('S2 Seleccionar una placa muestra sus viajes', JSON.stringify(detIds().sort()) === JSON.stringify(R.ts.filter(t => t.placa === 'C-222BBB').map(t => t.id).sort()), detIds());
await click([...d.querySelectorAll('#rsTPro [data-act="rsVer"]')].find(b => b.dataset.k === 'COLGATE|COLGATE-B'));
T('S3 Seleccionar un proyecto muestra sus registros', JSON.stringify(detIds()) === JSON.stringify(R.ts.filter(t => t.pcat === 'COLGATE-B').map(t => t.id)), detIds());
await click(boton('Ver todos'));
T('S4 «Ver todos» quita la selección', detTotal() === R.kpi.viajes);
/* búsqueda */
const q = d.querySelector('#rsQ'); q.value = 'Piloto Tres'; q.dispatchEvent(new w.Event('input', { bubbles: true })); await tick();
const conP3 = J(`rsDatos().viajes.filter(t=>t.pilotoId==='P-3').map(t=>t.id)`);
T('B1 Buscar filtra el detalle sin perder el cuadro de búsqueda', JSON.stringify(detIds().sort()) === JSON.stringify(conP3.sort()) && d.querySelector('#rsQ') === q && kpiOk(R), [detIds(), conP3]);
q.value = ''; q.dispatchEvent(new w.Event('input', { bubbles: true })); await tick();
T('B2 Borrar la búsqueda devuelve todos los registros', detTotal() === R.kpi.viajes);

/* ---------- Ordenar columnas ---------- */
const ordBtn = (tb, c) => [...d.querySelectorAll(`[data-act="rsOrden"][data-tb="${tb}"]`)].find(b => b.dataset.c === c);
await click(ordBtn('cli', 'cliente')); let n1 = cuerpo('rsTCli').map(r => r[0]);
T('O1 Ordenar clientes por nombre (desc)', JSON.stringify(n1) === JSON.stringify(n1.slice().sort((a, b) => b.localeCompare(a, 'es'))), n1);
await click(ordBtn('cli', 'cliente')); n1 = cuerpo('rsTCli').map(r => r[0]);
T('O2 Segundo clic invierte (asc)', JSON.stringify(n1) === JSON.stringify(n1.slice().sort((a, b) => a.localeCompare(b, 'es'))), n1);
await click(ordBtn('det', 'placa')); let pl = cuerpo('rsTDet').map(r => r[7]);
T('O3 Ordenar el detalle por placa', JSON.stringify(pl) === JSON.stringify(pl.slice().sort((a, b) => b.localeCompare(a, 'es', { numeric: true }))), pl);
await click(ordBtn('uni', 'viajes')); T('O4 Ordenar unidades por viajes', cuerpo('rsTUni').map(r => Number(r[4])).every((v, i, a) => !i || a[i - 1] >= v));

/* ---------- Filtros ---------- */
await cambia(flt('rsDesde'), '2031-05-01'); await cambia(flt('rsHasta'), '2031-06-30');
R = REF({ desde: '2031-05-01', hasta: '2031-06-30' });
T('F1 Fechas: tarjetas = viajes reales del rango', kpiOk(R), [kpis(), R.kpi]);
T('F1b Fechas: tablas, totales y detalle se actualizan', Number(pie('rsTCli')[1]) === R.kpi.viajes && Number(pie('rsTPro')[2]) === R.kpi.viajes && detTotal() === R.kpi.viajes);
await cambia(flt('rsCli'), 'COLGATE'); R = REF({ desde: '2031-05-01', hasta: '2031-06-30', cli: 'COLGATE' });
T('F2 + Cliente', kpiOk(R) && cuerpo('rsTCli').length === 1 && detTotal() === R.kpi.viajes, [kpis(), R.kpi]);
T('F3 La lista de proyectos se limita al cliente', JSON.stringify([...flt('rsPcat').options].map(o => o.value).filter(Boolean)) === JSON.stringify(['COLGATE', 'COLGATE-B']));
await cambia(flt('rsPcat'), 'COLGATE'); R = REF({ desde: '2031-05-01', hasta: '2031-06-30', cli: 'COLGATE', pcat: 'COLGATE' });
T('F4 + Proyecto', kpiOk(R) && detTotal() === R.kpi.viajes, [kpis(), R.kpi]);
await cambia(flt('rsUni'), 'C-222BBB'); R = REF({ desde: '2031-05-01', hasta: '2031-06-30', cli: 'COLGATE', pcat: 'COLGATE', uni: 'C-222BBB' });
T('F5 + Unidad', kpiOk(R) && R.kpi.viajes > 0 && detTotal() === R.kpi.viajes && cuerpo('rsTUni').every(r => r[0] === 'C-222BBB'), [kpis(), R.kpi]);
await cambia(flt('rsCli'), 'COCACOLA');
T('F6 Al cambiar de cliente se quitan proyecto/unidad que ya no aplican', ev('S.rsPcat') === '' && ev('S.rsUni') === '' && kpiOk(REF({ desde: '2031-05-01', hasta: '2031-06-30', cli: 'COCACOLA' })));
await cambia(flt('rsDesde'), '2035-01-01');
T('F7 Sin resultados: mensaje claro y sin tablas', /Ningún viaje coincide con los filtros/.test(txt(d.querySelector('#main') || d.body)) && !d.querySelector('.rs-kpis'));
await click(boton('Limpiar filtros')); R = REF();
T('F8 «Limpiar filtros» vuelve a todos los viajes', kpiOk(R) && ['rsDesde', 'rsHasta', 'rsCli', 'rsPcat', 'rsUni'].every(k => !ev('S.' + k)));
T('F9 Los filtros del Resumen no alteran los de «Pendientes de gestión»', ev("S.fCli||''") === '' && ev("S.fDesde||''") === '');

/* ---------- Diseño tipo hoja de cálculo ---------- */
const css = leer('css/app.css');
T('V1 Encabezados fijos (th sticky) y totales fijos al pie dentro de un contenedor con desplazamiento', /table\.xl th\{position:sticky;top:0/.test(css) && /table\.rs-tb tfoot td\{position:sticky;bottom:0/.test(css) && /\.rs-wrap\{max-height/.test(css));
T('V2 Adaptable a móvil (media query del Resumen) y sin estilos de gráficas sobrantes', /@media \(max-width:820px\)\{\.rs-kpis/.test(css) && !/\.rs-dos|\.rs-graf|\.rs-hbars/.test(css));

T('Z1 El PDF del cliente (expAgrPdf) sigue existiendo', ev('typeof expAgrPdf') === 'function');
T('Z2 Sin errores de JavaScript al final', N.errs.length === 0, N.errs);
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
