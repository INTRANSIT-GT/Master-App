/* Pruebas del motor de Órdenes de Compra: semana ISO 8601, regla de tarifa, totales, columnas, permisos (separados de
   Liquidaciones), duplicados, PDF por versiones, envío, respuesta, integración con Facturación (una factura por orden)
   y protección de la evidencia privada. jsdom con el motor local; no usa Supabase real. */

import { JSDOM, VirtualConsole } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path';
import { fileURLToPath } from 'node:url';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + (typeof x === 'string' ? x : JSON.stringify(x)).slice(0, 600) : '')); };

import { FIXTURE } from './_oc-fixture.mjs';
const cargar = () => {
  let html = leer('index.html').replace('<script src="js/config.js"></script>', '<script>window.MASTER_CONFIG={};</script>').replace('<script src="js/vendor/supabase.js"></script>', '')
    .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => /vendor\/(jspdf|supabase)/.test(f) ? '' : `<script>${leer(f)}</script>`);
  const errs = []; const vc = new VirtualConsole(); vc.on('jsdomError', e => errs.push(String(e.message).slice(0, 200)));
  const w = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/', pretendToBeVisual: true, virtualConsole: vc }).window;
  w.eval(FIXTURE);
  return { w, errs };
};
const N = cargar(), w = N.w, ev = c => w.eval(c);
const J = c => JSON.parse(ev(`JSON.stringify(${c})`));
const call = (uid, op, ...args) => J(`__try(()=>API.${op}(${[JSON.stringify(uid), ...args.map(a => JSON.stringify(a))].join(',')}))`);
const V = J('__V');
const trip = id => J(`DB.trips.find(t=>t.id==='${id}')`);
const base = (ids, extra) => Object.assign({ cliente: 'COLGATE', proyecto: 'COLGATE', viajeIds: ids, columnas: [] }, extra || {});
const EVID = 'data:application/pdf;base64,JVBERi0xLjQ=';
const confirmarAgr = (gid, uid = 'U-N') => {
  const pv = call(uid, 'agrPrevisualizar', gid, { tipo: 'CLIENTE', opcionales: [] });
  const p = call(uid, 'agrRegistrarPdf', gid, { tipo: 'CLIENTE', opcionales: [], huella: pv.r.huella, hash: '0123456789abcdef', archivo: EVID });
  const e = call(uid, 'agrAdjuntarEvidencia', gid, { archivo: EVID, nota: 'correo del cliente' });
  return call(uid, 'confirmarCliente', gid);
};
const PDF = 'data:application/pdf;base64,' + Buffer.from('%PDF-1.4 prueba').toString('base64');

T('O0 El motor carga sin errores de JavaScript', N.errs.length === 0, N.errs);

/* ============ Semana ISO 8601 ============ */
const sem = f => J(`semanaIso(${JSON.stringify(f)})`);
const casos = [['2026-01-01', 1, 2026], ['2026-12-31', 53, 2026], ['2027-01-01', 53, 2026], ['2027-01-03', 53, 2026], ['2027-01-04', 1, 2027],
  ['2024-12-30', 1, 2025], ['2025-12-29', 1, 2026], ['2025-01-01', 1, 2025], ['2021-01-03', 53, 2020], ['2020-12-31', 53, 2020], ['2023-01-01', 52, 2022],
  ['2019-12-30', 1, 2020], ['2028-01-02', 52, 2027], ['2031-12-28', 52, 2031], ['2031-12-29', 1, 2032], ['2032-01-04', 1, 2032], ['2026-03-02', 10, 2026]];
casos.forEach(([f, s, a]) => { const r = sem(f); T(`ISO ${f} → semana ${s} de ${a}`, r && r.semana === s && r.anio === a, r); });
T('ISO · la semana comienza en lunes (2026-06-07 domingo = semana 23, lunes 08 = semana 24)', sem('2026-06-07').semana === 23 && sem('2026-06-08').semana === 24);
T('ISO · formato «Semana 01» con cero a la izquierda y opción con año', sem('2026-01-05').texto === 'Semana 02' && sem('2027-01-04').texto === 'Semana 01' && sem('2027-01-04').textoAnio === 'Semana 01 · 2027');
T('ISO · acepta fecha y hora (solo usa AAAA-MM-DD) y rechaza fechas inválidas', sem('2031-12-29T14:30').semana === 1 && sem('2026-02-30') === null && sem('') === null && sem(null) === null && sem('abc') === null);
/* Verificación cruzada con la fórmula clásica por día ordinal (independiente de la implementación) */
const cruzada = ev(`(()=>{
  const iso=(y,m,d)=>{const dt=new Date(Date.UTC(y,m-1,d)),ord=Math.round((dt-new Date(Date.UTC(y,0,1)))/864e5)+1,wd=((dt.getUTCDay()+6)%7)+1;
    let w=Math.floor((ord-wd+10)/7),yr=y;
    const largo=a=>{const p=x=>(x+Math.floor(x/4)-Math.floor(x/100)+Math.floor(x/400))%7;return p(a)===4||p(a-1)===3?53:52;};
    if(w<1){yr=y-1;w=largo(yr);}else if(w>largo(y)){w=1;yr=y+1;}
    return [w,yr];};
  let malos=[],n=0;
  for(let y=2018;y<=2036;y++)for(let m=1;m<=12;m++)for(let d=1;d<=new Date(Date.UTC(y,m,0)).getUTCDate();d++){
    const f=y+'-'+String(m).padStart(2,'0')+'-'+String(d).padStart(2,'0'),r=semanaIso(f),e=iso(y,m,d);n++;
    if(r.semana!==e[0]||r.anio!==e[1])malos.push(f);}
  return {n,malos:malos.slice(0,5)};
})()`);
T(`ISO · coincide con la fórmula independiente en ${cruzada.n} días (2018-2036)`, cruzada.malos.length === 0 && cruzada.n > 6000, cruzada);

/* ============ Permisos ============ */
const tiene = (rol, p) => J(`hasPerm({activo:true,rol:'${rol}'},'${p}')`);
const OCP = ['oc_ver', 'oc_preparar', 'oc_enviar', 'oc_responder', 'oc_corregir', 'oc_ver_combustible'];
T('P1 Gerencia Comercial y Analista Comercial pueden ver, preparar y enviar', ['GERENTE_COMERCIAL', 'ANALISTA_COMERCIAL'].every(r => ['oc_ver', 'oc_preparar', 'oc_enviar'].every(p => tiene(r, p))));
T('P2 Facturación solo VE las órdenes (no prepara, no envía, no responde)', tiene('FACTURACION', 'oc_ver') && !['oc_preparar', 'oc_enviar', 'oc_responder', 'oc_corregir', 'oc_ver_combustible'].some(p => tiene('FACTURACION', p)));
T('P3 Torre, Operativo, Validador y Pago OPL no tienen ningún permiso de órdenes de compra', ['TORRE', 'OPERATIVO', 'VALIDADOR', 'PAGO_OPL'].every(r => !OCP.some(p => tiene(r, p))));
T('P4 Cobros y Gerente de Transporte no preparan ni responden', ['COBROS', 'GERENTE_TRANSPORTE'].every(r => !['oc_preparar', 'oc_enviar', 'oc_responder', 'oc_corregir'].some(p => tiene(r, p))));
{ const ESC = ['oc_responder', 'oc_corregir', 'oc_ver_combustible', 'oc_preparar', 'oc_enviar', 'oc_ver'];
  T('P5 Gerencia Comercial, Analista Comercial y Administrador tienen por defecto responder, corregir/anular, combustible, preparar, enviar y ver', ['GERENTE_COMERCIAL', 'ANALISTA_COMERCIAL', 'ADMIN'].every(r => ESC.every(p => tiene(r, p))));
  T('P5b Los demás perfiles NO tienen responder, corregir ni combustible (Facturación solo ve)', J('Object.keys(ROLES)').filter(r => !['GERENTE_COMERCIAL', 'ANALISTA_COMERCIAL', 'ADMIN'].includes(r)).every(r => !tiene(r, 'oc_responder') && !tiene(r, 'oc_corregir') && !tiene(r, 'oc_ver_combustible') && !tiene(r, 'oc_preparar')));
  T('P5c Los permisos de OC de Comercial no dependen de Liquidaciones, Finanzas ni Facturación (esos permisos no están en su perfil)', ['GERENTE_COMERCIAL', 'ANALISTA_COMERCIAL'].every(r => ['liq_aprobar', 'liq_devolver', 'finanzas_ver', 'facturas_emitir', 'cobros_registrar'].every(p => !tiene(r, p))));
  T('P5d Los vetos de OC se mantienen para Facturación, Cobros, Torre, Operativo, Validador, Pago OPL, Proyectos y Gerencia de Transporte (no se pueden conceder ni desde la matriz)', J(`['FACTURACION','COBROS','TORRE','OPERATIVO','VALIDADOR','PAGO_OPL','PROYECTOS','GERENTE_TRANSPORTE'].every(r=>['oc_responder','oc_corregir','oc_ver_combustible','oc_preparar','oc_enviar'].every(p=>PROHIBIDO[r].includes(p)))`));
}
T('P6 Los permisos de órdenes están separados de Liquidaciones (Validador aprueba liquidaciones y no tiene oc_*)', tiene('VALIDADOR', 'liq_aprobar') && !OCP.some(p => tiene('VALIDADOR', p)));
T('P7 Quien prepara órdenes no recibe permisos de Liquidaciones ni de finanzas por ello', !tiene('GERENTE_COMERCIAL', 'liq_aprobar') && !tiene('GERENTE_COMERCIAL', 'finanzas_ver') && !tiene('ANALISTA_COMERCIAL', 'finanzas_ver') && !tiene('ANALISTA_COMERCIAL', 'facturas_emitir') && !tiene('GERENTE_COMERCIAL', 'facturas_emitir') && !tiene('GERENTE_COMERCIAL', 'cobros_registrar'));
['TORRE', 'OPERATIVO', 'VALIDADOR', 'PAGO_OPL'].forEach(r => {
  const x = call('U-1', 'setPermiso', r, 'oc_preparar', true);
  T(`P8 No se puede conceder «oc_preparar» a ${r} aunque el Admin lo intente`, !x.ok && x.code === 'PERMISO_PROHIBIDO', x);
});
{ const x = call('U-1', 'setPermiso', 'FACTURACION', 'oc_responder', true); T('P9 Facturación no puede recibir «oc_responder» (separación de funciones)', !x.ok && x.code === 'PERMISO_PROHIBIDO', x); }
T('P10 La sección «Órdenes de compra» existe en el módulo Comercial y exige oc_ver', J('SEC_DE.oc').base === 'oc_ver' && J('SEC_DE.oc').mod === 'COMERCIAL' && J('MODULOS_SEC').find(m => m[0] === 'COMERCIAL')[1].includes('oc') && J('VIEW_PERM.oc') === 'oc_ver');
T('P11 OC no es un módulo ni un ítem de menú: ningún perfil lo lista; Comercial, Gerencia, Facturación y Admin entran por el espacio «comercial»; Torre, Operativo y Validador no', Object.keys(J('ROLES')).every(r => !J(`ROLES.${r}.nav`).includes('oc')) && ['GERENTE_COMERCIAL', 'ANALISTA_COMERCIAL', 'FACTURACION', 'ADMIN'].every(r => J(`ROLES.${r}.nav`).includes('comercial')) && ['TORRE', 'OPERATIVO', 'VALIDADOR'].every(r => !J(`ROLES.${r}.nav`).includes('comercial')));
for (const [uid, rol] of [['U-T', 'Torre'], ['U-O', 'Operativo'], ['U-V', 'Validador'], ['U-F', 'Facturación'], ['U-C', 'Cobros'], ['U-P', 'Pago OPL']]) {
  const x = call(uid, 'ocGenerar', base([V.a]));
  T(`P12 ${rol} no puede generar una orden por API directa`, !x.ok && x.code === 'SIN_PERMISO', x);
}
for (const [uid, rol] of [['U-T', 'Torre'], ['U-O', 'Operativo'], ['U-V', 'Validador']]) {
  const x = call(uid, 'ordenesCompra');
  T(`P13 ${rol} no puede ni consultar la lista de órdenes`, !x.ok && x.code === 'SIN_PERMISO', x);
}

/* ============ Regla de tarifa ============ */
const antes = J('DB.ordenesCompra.length');
for (const [k, motivo] of [['vacio', 'sin tarifa'], ['cero', 'tarifa cero'], ['neg', 'tarifa negativa'], ['rutaPend', 'ruta no activa']]) {
  const x = call('U-G', 'ocGenerar', base([V.a, V[k]]));
  const p = x.pend && x.pend[0];
  T(`F1 Un viaje con ${motivo} bloquea toda la orden (API directa) con el mensaje de tarifa pendiente`, !x.ok && x.code === 'TARIFA_PENDIENTE' && /Viaje pendiente de asignación de tarifa/.test(x.msg), x);
  T(`F2 El rechazo (${motivo}) identifica No. de viaje, Número de Transporte, cliente, proyecto y motivo`, !!p && p.noViaje === V[k] && /^SH-/.test(p.shipment) && p.cliente === 'COLGATE' && p.proyecto === 'COLGATE' && p.motivo.length > 10, p);
}
T('F3 Una orden rechazada no crea orden ni reserva ningún viaje', J('DB.ordenesCompra.length') === antes && !trip(V.a).ocId);
T('F4 No se inventan tarifas: los viajes sin tarifa siguen sin tarifa', trip(V.vacio).tarifaCliente === '' && trip(V.cero).tarifaCliente === 0 && trip(V.neg).tarifaCliente === -50);
{ const x = call('U-G', 'ocPrevisualizar', base([V.cero])); T('F5 La vista previa aplica la misma regla (no ok, lista el viaje pendiente)', x.ok && x.r.ok === false && x.r.pendientes.length === 1 && x.r.lineas.length === 0, x); }
{ const x = call('U-G', 'ocDisponibles', { cliente: 'COLGATE', proyecto: 'COLGATE' });
  const por = id => x.r.find(v => v.viajeId === id);
  T('F6 Disponibles clasifica: con tarifa = OK, sin tarifa = PEND, no aceptado ausente', x.ok && ['a', 'b', 'c', 'comb'].every(k => por(V[k]).tipo === 'OK') && ['vacio', 'cero', 'neg', 'rutaPend'].every(k => por(V[k]).tipo === 'PEND') && !por(V.plan) && !por(V.otroProy) && !por(V.coca), x.ok ? x.r.map(v => v.viajeId + ':' + v.tipo) : x); }
{ const x = call('U-G', 'ocGenerar', base([V.plan])); T('F7 Un viaje no aceptado no puede entrar en una orden', !x.ok && x.code === 'NO_ELEGIBLE', x); }
{ const x = call('U-G', 'ocGenerar', base([V.coca])); T('F8 No se mezclan clientes: un viaje de otro cliente es rechazado', !x.ok && x.code === 'NO_ELEGIBLE', x); }
{ const x = call('U-G', 'ocGenerar', base([V.otroProy])); T('F9 No se mezclan proyectos: un viaje de otro proyecto es rechazado', !x.ok && x.code === 'NO_ELEGIBLE', x); }
{ const x = call('U-G', 'ocGenerar', base([V.a, V.a])); T('F10 Viajes duplicados en la selección son rechazados', !x.ok && x.code === 'VALIDACION', x); }
{ const x = call('U-G', 'ocGenerar', base([])); T('F11 Una orden sin viajes es rechazada', !x.ok, x); }

/* ============ Totales, columnas y combustible ============ */
let OC1;
{ const x = call('U-G', 'ocGenerar', base([V.c, V.a, V.b, V.comb]));
  T('G1 Con viajes de tarifa válida se genera la orden (id único OC-0001, estado Preparada)', x.ok && x.r.id === 'OC-0001' && x.r.estado === 'PREPARADA', x);
  OC1 = x.r;
  T('G2 El total es la suma de las tarifas válidas (1000+1500+2000+1100)', OC1.total === 5600, OC1.total);
  T('G3 El combustible NO se suma otra vez: la tarifa del viaje ya trae base + ajuste (1100, no 1200)', OC1.lineas.find(l => l.viajeId === V.comb).tarifa === 1100 && OC1.total === 5600);
  T('G4 Las líneas salen ordenadas por fecha planificada', OC1.lineas.map(l => l.viajeId).join() === [V.comb, V.a, V.b, V.c].join(), OC1.lineas.map(l => l.fecha));
  T('G5 Shipment es el Número de Transporte del viaje (campo shipment)', OC1.lineas.every(l => l.shipment === J(`DB.trips.find(t=>t.id==='${l.viajeId}').shipment`)) && OC1.lineas.find(l => l.viajeId === V.a).shipment === 'SH-A');
  const la = OC1.lineas.find(l => l.viajeId === V.a), lb = OC1.lineas.find(l => l.viajeId === V.b), lc = OC1.lineas.find(l => l.viajeId === V.c);
  T('G6 Semana ISO por viaje y en los límites de año (28-dic = 52/2031; 29-dic y 4-ene = 1/2032)', la.semana === 52 && la.semanaAnio === 2031 && lb.semana === 1 && lb.semanaAnio === 2032 && lc.semana === 1 && lc.semanaAnio === 2032, [la, lb, lc].map(l => l.semanaTxt + l.semanaAnio));
  T('G7 La fecha planificada original del viaje no se modifica', trip(V.b).fechaPlan === '2031-12-29T14:30' && lb.fechaPlan === '2031-12-29T14:30' && lb.hora === '14:30' && lb.fecha === '2031-12-29');
  T('G8 Placa, tipo de unidad y estado salen del viaje', la.placa === 'C-111AAA' && la.tipoUnidad === '10TON' && la.estado === 'Aceptado');
  T('G9 Los viajes quedan reservados por la orden y el motor audita el alta', [V.a, V.b, V.c, V.comb].every(id => trip(id).ocId === 'OC-0001') && J(`DB.audit.filter(e=>e.entidad==='OC'&&e.ref&&e.ref.startsWith('OC-0001')).length`) >= 5);
  T('G10 Quién prepara, cuándo y el cliente/proyecto quedan registrados', OC1.preparadoPorId === 'U-G' && /^\d{4}-/.test(OC1.preparadoEn) && OC1.clienteNombre === 'COLGATE' && OC1.proyecto === 'COLGATE');
  T('G11 La semana con año solo se pide cuando el año ISO difiere del calendario', J(`ocUsaAnio(DB.ordenesCompra[0].lineas)`) === true && J(`ocUsaAnio(DB.ordenesCompra[0].lineas.filter(l=>l.viajeId==='${V.comb}'))`) === false);
  T('G12 La celda de semana se ve igual en vista previa, orden y PDF (misma función)', J(`ocCelda(DB.ordenesCompra[0].lineas.find(l=>l.viajeId==='${V.b}'),'semana',true)`) === 'Semana 01 · 2032' && J(`ocCelda(DB.ordenesCompra[0].lineas.find(l=>l.viajeId==='${V.comb}'),'semana',false)`) === 'Semana 15');
}
{ const x = call('U-G', 'ocGenerar', base([V.a])); T('D1 Un viaje no puede estar en dos órdenes activas', !x.ok && x.code === 'NO_ELEGIBLE' && /OC-0001/.test(x.err[0].motivo), x); }
{ const x = call('U-G', 'ocPrevisualizar', base([V.a])); T('D2 La vista previa también avisa que el viaje ya está en otra orden', x.ok && x.r.ok === false && /OC-0001/.test(x.r.errores[0].motivo), x); }

/* columnas opcionales */
{ call('U-1', 'setPermiso', 'GERENTE_COMERCIAL', 'oc_ver_combustible', false); const x = call('U-G', 'ocPrevisualizar', base([V.col], { columnas: ['combustible'] })); call('U-1', 'setPermiso', 'GERENTE_COMERCIAL', 'oc_ver_combustible', true); T('C1 «Tarifa de combustible» exige el permiso propio (se le retira a Gerencia Comercial)', !x.ok && x.code === 'SIN_PERMISO', x); }
{ const x = call('U-G', 'ocPrevisualizar', base([V.col], { columnas: ['capacidad', 'origen', 'ruta', 'tipoViaje'] }));
  T('C2 Las columnas opcionales capacidad, origen, ruta y tipo de viaje se incluyen', x.ok && x.r.columnas.join() === 'capacidad,origen,ruta,tipoViaje' && x.r.lineas[0].capacidad === '10 Ton' && x.r.lineas[0].origen === 'Ciudad de Guatemala' && x.r.lineas[0].ruta === 'CP → Mayorista' && x.r.lineas[0].tipoViaje === 'ONE WAY', x); }
{ const x = call('U-G', 'ocPrevisualizar', base([V.col], { columnas: ['inventada'] })); T('C3 Una columna opcional desconocida se rechaza', !x.ok && x.code === 'VALIDACION', x); }
T('C4 Columnas del PDF = 8 obligatorias + las opcionales elegidas (Semana … Tarifa de cobro)', J(`ocColumnas(['ruta']).map(c=>c[1])`).join('|') === 'Semana|Fecha planificada|Hora planificada|Shipment|Placa|Tipo de unidad|Estado|Tarifa de cobro|Ruta');
{
  call('U-1', 'setPermiso', 'GERENTE_COMERCIAL', 'oc_ver_combustible', true);
  const x = call('U-G', 'ocPrevisualizar', base([V.col], { columnas: ['combustible'] }));
  T('C5 Con el permiso propio, la columna de combustible se muestra (100) y el total sigue siendo 1100', x.ok && x.r.lineas[0].combustible === 100 && x.r.total === 1100, x);
  call('U-1', 'setPermiso', 'ANALISTA_COMERCIAL', 'oc_ver_combustible', false);
  const lista = call('U-N', 'ordenesCompra');
  call('U-1', 'setPermiso', 'ANALISTA_COMERCIAL', 'oc_ver_combustible', true);
  T('C6 El ajuste de combustible no se entrega a quien no tiene el permiso (Analista sin él)', lista.ok && lista.r[0].lineas.every(l => !('combustible' in l) && !('tarifaBase' in l)), lista.ok && lista.r[0].lineas[0]);
  const viaje = J(`redact(DB.usuarios.find(u=>u.id==='U-G'),DB.trips.find(t=>t.id==='${V.comb}'))`);
  T('C7 Con oc_ver_combustible el viaje trae ajuste y base; sin finanzas_ver no trae precio MEM ni costos', viaje.ajusteCombustible === 100 && viaje.tarifaBase === 1000 && !('precioMem' in viaje) && !('costoProveedor' in viaje), viaje);
  call('U-1', 'setPermiso', 'GERENTE_COMERCIAL', 'oc_ver_combustible', false);
  const v2 = J(`redact(DB.usuarios.find(u=>u.id==='U-G'),DB.trips.find(t=>t.id==='${V.comb}'))`);
  T('C8 Al quitar el permiso, el ajuste vuelve a ocultarse', !('ajusteCombustible' in v2) && !('tarifaBase' in v2), v2);
  /* el ajuste congelado se guarda fuera de las líneas y solo lo ve quien tiene el permiso propio */
  call('U-1', 'setPermiso', 'GERENTE_COMERCIAL', 'oc_ver_combustible', true);
  call('U-1', 'setPermiso', 'ANALISTA_COMERCIAL', 'oc_ver_combustible', false);
  const conPerm = call('U-G', 'ordenesCompra'), sinPerm = call('U-N', 'ordenesCompra');
  call('U-1', 'setPermiso', 'ANALISTA_COMERCIAL', 'oc_ver_combustible', true);
  const lc = conPerm.r[0].lineas.find(l => l.viajeId === V.comb), ln = sinPerm.r[0].lineas.find(l => l.viajeId === V.comb);
  T('C9 El combustible congelado está fuera de las líneas guardadas y se entrega solo con oc_ver_combustible (100 / base 1000)', J("DB.ordenesCompra[0].lineas.every(l=>!('combustible' in l)&&!('tarifaBase' in l))") && lc.combustible === 100 && lc.tarifaBase === 1000 && !('combustible' in ln) && !('tarifaBase' in ln) && !('combustible' in sinPerm.r[0]), [lc, ln]);
  call('U-1', 'setPermiso', 'GERENTE_COMERCIAL', 'oc_ver_combustible', true);
}

/* ============ PDF por versiones ============ */
{
  const x = call('U-G', 'ocEnviar', 'OC-0001', {}); T('E1 No se puede enviar una orden sin PDF', !x.ok && x.code === 'SIN_DOCUMENTO', x);
  T('E2 No se acepta un archivo que no sea PDF', !call('U-G', 'ocRegistrarPdf', 'OC-0001', { archivo: 'data:image/png;base64,AAAA' }).ok);
  const p1 = call('U-G', 'ocRegistrarPdf', 'OC-0001', { archivo: PDF, hash: 'a'.repeat(64), nombre: 'OC-0001.pdf' });
  T('E3 Se registra el PDF versión 1 con su huella', p1.ok && p1.r.documentos.length === 1 && p1.r.documentos[0].version === 1 && p1.r.documentos[0].hash === 'a'.repeat(64), p1);
  const p2 = call('U-G', 'ocRegistrarPdf', 'OC-0001', { archivo: PDF }); T('E4 Una nueva versión del PDF exige motivo', !p2.ok && p2.code === 'VALIDACION', p2);
  const p3 = call('U-G', 'ocRegistrarPdf', 'OC-0001', { archivo: PDF, motivo: 'Se agregó la columna Ruta' });
  T('E5 Las versiones anteriores se conservan (2 documentos, v1 intacta)', p3.ok && p3.r.documentos.length === 2 && p3.r.documentos[0].version === 1 && p3.r.documentos[0].hash === 'a'.repeat(64) && p3.r.documentos[1].version === 2 && p3.r.documentos[1].hash.length >= 8, p3);
  T('E6 Facturación no puede generar ni registrar PDF', !call('U-F', 'ocRegistrarPdf', 'OC-0001', { archivo: PDF, motivo: 'xxxxx' }).ok);
}

/* ============ Evidencia privada ============ */
{
  ev('ENV.storageExists=p=>p==="oc/OC-0001/archivo-ok.pdf"');
  const mal1 = call('U-G', 'ocRegistrarPdf', 'OC-0001', { archivo: { path: 'oc/OC-0002/archivo-ok.pdf' }, motivo: 'otra orden' });
  const mal2 = call('U-G', 'ocRegistrarPdf', 'OC-0001', { archivo: { path: 'facturas/AGR-0001/archivo-ok.pdf' }, motivo: 'otro prefijo' });
  const mal3 = call('U-G', 'ocRegistrarPdf', 'OC-0001', { archivo: { path: 'oc/OC-0001/../../x.pdf' }, motivo: 'ruta con ..' });
  const mal4 = call('U-G', 'ocRegistrarPdf', 'OC-0001', { archivo: { path: 'oc/OC-0001/no-existe.pdf' }, motivo: 'no está subido' });
  const bien = call('U-G', 'ocRegistrarPdf', 'OC-0001', { archivo: { path: 'oc/OC-0001/archivo-ok.pdf' }, hash: 'b'.repeat(64), motivo: 'versión en almacenamiento' });
  T('S1 Solo se aceptan rutas propias de la orden en el almacenamiento privado (oc/<id>/…)', [mal1, mal2, mal3, mal4].every(r => !r.ok && r.code === 'VALIDACION') && bien.ok && bien.r.documentos.length === 3 && bien.r.documentos[2].path === 'oc/OC-0001/archivo-ok.pdf', [mal1, mal2, mal3, mal4, bien].map(r => r.code || r.ok));
  ev('ENV.storageExists=()=>false');
}

/* ============ Envío ============ */
{
  const x = call('U-F', 'ocEnviar', 'OC-0001', {}); T('N1 Facturación no puede confirmar el envío', !x.ok && x.code === 'SIN_PERMISO', x);
  const nAntes = J('DB.notificaciones.length');
  const e = call('U-N', 'ocEnviar', 'OC-0001', { destinatario: 'compras@cliente.test', medio: 'Correo' });
  T('N2 Analista confirma el envío: estado Enviada, usuario y fecha/hora registrados', e.ok && e.r.estado === 'ENVIADA' && e.r.envio.porId === 'U-N' && /^\d{4}-\d{2}-\d{2}T/.test(e.r.envio.en) && e.r.envio.destinatario === 'compras@cliente.test', e);
  const n = J('DB.notificaciones').slice(nAntes).find(z => z.tipo === 'OC_ENVIADA');
  T('N3 Facturación recibe una notificación persistente: orden pendiente de confirmación del cliente', !!n && n.destinatarios.includes('FACTURACION') && /pendiente de confirmación del cliente/.test(n.asunto) && n.detalle.orden === 'OC-0001', n);
  T('N4 Una orden enviada no puede enviarse otra vez ni cambiar su PDF', !call('U-G', 'ocEnviar', 'OC-0001', {}).ok && !call('U-G', 'ocRegistrarPdf', 'OC-0001', { archivo: PDF, motivo: 'otro intento' }).ok);
  T('N5 El envío queda en la bitácora', J(`DB.audit.some(e=>e.entidad==='OC'&&e.accion==='Orden de compra enviada al cliente'&&e.porId==='U-N')`));
}

/* ============ Tarifa cambiada después del envío ============ */
{
  const antesL = J('DB.ordenesCompra[0].lineas'), antesT = J('DB.ordenesCompra[0].total');
  const r = J(`aplicarUna(DB.usuarios[0],DB.trips.find(t=>t.id==='${V.a}'))`);
  T('T1 Después de preparar la orden, aplicar tarifa al viaje se bloquea (no cambia su tarifa)', !!r.err && /orden de compra OC-0001/.test(r.err) && trip(V.a).tarifaCliente === 1000, r);
  ev(`DB.trips.find(t=>t.id==='${V.a}').tarifaCliente=1234`);
  const f = call('U-1', 'prepararFactura', { cliente: 'COLGATE', ocId: 'OC-0001' });
  T('T2 Los importes de la orden se conservan aunque el viaje cambie por fuera', J('DB.ordenesCompra[0].total') === antesT && JSON.stringify(J('DB.ordenesCompra[0].lineas')) === JSON.stringify(antesL));
  ev(`DB.trips.find(t=>t.id==='${V.a}').tarifaCliente=1000`);
}

/* ============ Respuesta del cliente ============ */
{
  for (const uid of ['U-V', 'U-O', 'U-T', 'U-F']) { const g = call(uid, 'ocResponder', 'OC-0001', { resultado: 'ACEPTADA', referencia: 'PO-123', evidencias: [EVID] }); T(`R1 ${uid} (sin oc_responder) no puede registrar la respuesta`, !g.ok && g.code === 'SIN_PERMISO', g); }
  call('U-1', 'setPermiso', 'GERENTE_COMERCIAL', 'oc_responder', false);
  { const g = call('U-G', 'ocResponder', 'OC-0001', { resultado: 'ACEPTADA', referencia: 'PO-123', evidencias: [EVID] }); T('R2 El motor valida el permiso: si se le retira a Gerencia Comercial, no puede responder', !g.ok && g.code === 'SIN_PERMISO' && J('DB.ordenesCompra[0].estado') === 'ENVIADA', g); }
  T('R3 Validador (aprueba liquidaciones) sigue sin poder responder órdenes aunque tenga liq_aprobar', tiene('VALIDADOR', 'liq_aprobar') && !call('U-V', 'ocResponder', 'OC-0001', { resultado: 'ACEPTADA', referencia: 'PO-123', evidencias: [EVID] }).ok);
  call('U-1', 'setPermiso', 'GERENTE_COMERCIAL', 'oc_responder', true);
  const sinMotivo = call('U-G', 'ocResponder', 'OC-0001', { resultado: 'RECHAZADA' });
  T('R4 Rechazar exige motivo; aceptar exige la referencia del cliente', !sinMotivo.ok && !call('U-G', 'ocResponder', 'OC-0001', { resultado: 'ACEPTADA' }).ok && !call('U-G', 'ocResponder', 'OC-0001', { resultado: 'TAL VEZ' }).ok);
  const okR = call('U-G', 'ocResponder', 'OC-0001', { resultado: 'ACEPTADA', referencia: 'PO-123', evidencias: [EVID] });
  T('R5 Con el permiso concedido, se registra la aceptación (usuario, fecha y referencia)', okR.ok && okR.r.estado === 'ACEPTADA' && okR.r.respuesta.porId === 'U-G' && okR.r.respuesta.referencia === 'PO-123' && !!okR.r.respuesta.en, okR);
  const n = J('DB.notificaciones').find(z => z.tipo === 'OC_ACEPTADA');
  T('R6 Facturación recibe la notificación «aceptada: disponible para facturar»', !!n && n.destinatarios.includes('FACTURACION'), n);
  T('R7 Administrador y Analista Comercial también tienen el permiso por defecto', tiene('ADMIN', 'oc_responder') && tiene('ANALISTA_COMERCIAL', 'oc_responder'));
}

/* ============ Integración con Facturación ============ */
let FACT;
{
  { const nf = call('U-F', 'prepararFactura', { cliente: 'COLGATE', ocId: 'OC-0001', numeroFactura: 'F-0', serieFactura: 'A', fechaFactura: '2031-12-31' }); T('I0 Facturación NO puede agrupar viajes ni preparar la factura de una OC (permiso de Comercial)', !nf.ok && nf.code === 'SIN_PERMISO' && !tiene('FACTURACION', 'comercial_agrupar'), nf); }
  const suelto = call('U-N', 'prepararFactura', { cliente: 'COLGATE', viajeIds: [V.a] });
  T('I1 Un viaje que está en una orden NO se factura suelto: se factura desde la orden', !suelto.ok && suelto.code === 'EN_ORDEN_DE_COMPRA', suelto);
  T('I2 Una orden no se convierte sola en factura (aceptar no crea agrupación)', J('DB.agrupaciones.length') === 0);
  const parcial = call('U-N', 'prepararFactura', { cliente: 'COLGATE', ocId: 'OC-0001', viajeIds: [V.a] });
  T('I3 La factura de una orden incluye exactamente los viajes de la orden', !parcial.ok && parcial.code === 'VALIDACION', parcial);
  const otroCli = call('U-N', 'prepararFactura', { cliente: 'COCACOLA', ocId: 'OC-0001' });
  T('I4 El cliente de la factura debe coincidir con el de la orden', !otroCli.ok && otroCli.code === 'CLIENTE_DISTINTO', otroCli);
  const sinPerm = call('U-T', 'prepararFactura', { cliente: 'COLGATE', ocId: 'OC-0001' });
  T('I5 Torre no prepara agrupaciones de cobro (sin permiso)', !call('U-T', 'prepararFactura', { cliente: 'COLGATE', ocId: 'OC-0001' }).ok);
  const f = call('U-N', 'prepararFactura', { cliente: 'COLGATE', ocId: 'OC-0001', numeroFactura: 'F-1001', serieFactura: 'A', fechaFactura: '2031-12-31' });
  FACT = f.r;
  T('I6 Facturación crea UNA factura con los 4 viajes de la orden y queda vinculada (ocId / agrupacionId)', f.ok && f.r.ocId === 'OC-0001' && f.r.viajeIds.length === 4 && J('DB.ordenesCompra[0].agrupacionId') === f.r.id, f);
  const dos = call('U-N', 'prepararFactura', { cliente: 'COLGATE', ocId: 'OC-0001' });
  T('I7 Una orden no puede tener dos facturas activas', !dos.ok && dos.code === 'YA_FACTURADO', dos);
  const anul = call('U-G', 'ocAnular', 'OC-0001', 'intento de anulación');
  T('I8 Una orden con factura activa no se puede anular', !anul.ok && (anul.code === 'SIN_PERMISO' || anul.code === 'TIENE_FACTURA'), anul);
  const sinConf = call('U-F', 'enviarFactura', f.r.id);
  T('I8b Facturación no puede facturar una agrupación que Comercial aún no confirmó con el cliente', !sinConf.ok && sinConf.code === 'SIN_CONFIRMACION', sinConf);
  const cf = confirmarAgr(f.r.id);
  T('I8c Comercial (Analista) registra «Cliente confirmó» con PDF y evidencia', cf.ok && cf.r.confirmacion.porId === 'U-N' && !!cf.r.confirmacion.en && cf.r.confirmacion.pdfVersion === 1, cf);
  const env = call('U-F', 'enviarFactura', f.r.id);
  T('I9 El flujo de Facturación sigue igual: al enviar la factura los viajes pasan a Facturado y el importe sale de las tarifas de la orden', env.ok && env.r.importeEnviado === 5600 && [V.a, V.b, V.c, V.comb].every(id => trip(id).estado === 'FACTURADO'), env);
  ev(`DB.agrupaciones[0].importesViaje['${V.a}']=0`);
  const emi0 = call('U-F', 'emitirFactura', f.r.id, { fechaEmision: '2031-12-31', importe: 5600, evidencia: 'UUID-0001-ABC' });
  T('I10 No se emite una factura con un viaje sin tarifa válida (también en backend)', !emi0.ok && emi0.code === 'TARIFA_PENDIENTE' && /Viaje pendiente de asignación de tarifa/.test(emi0.msg), emi0);
  ev(`DB.agrupaciones[0].importesViaje['${V.a}']=1000`);
  const sinArch = call('U-F', 'emitirFactura', f.r.id, { fechaEmision: '2031-12-31', importe: 5600, evidencia: 'UUID-0001-ABC' });
  T('I10b Una factura que viene de una OC no se emite sin la captura o comprobante adjunto', !sinArch.ok && sinArch.code === 'SIN_EVIDENCIA', sinArch);
  const emi = call('U-F', 'emitirFactura', f.r.id, { fechaEmision: '2031-12-31', importe: 5600, evidencia: 'UUID-0001-ABC', archivo: EVID });
  T('I11 Con tarifas válidas la factura se emite y la orden aparece como Facturada (etapa derivada)', emi.ok && J(`ocEtapa(DB.ordenesCompra[0])`) === 'FACTURADA', emi);
  { const h = J('DB.ordenesCompra[0].historial'); const iAc = h.findIndex(x => /Aceptada por el cliente/.test(x.accion)), iEnv = h.findIndex(x => /recibida en facturación/.test(x.accion)), iEm = h.findIndex(x => /emitida y enviada al cliente/.test(x.accion));
    T('I12 En el historial de la OC la aceptación del cliente (Comercial) y el envío de la factura (Facturación) son eventos distintos, cada uno con su usuario', iAc >= 0 && iEnv > iAc && iEm > iEnv && h[iAc].porId === 'U-G' && h[iEnv].porId === 'U-F' && h[iEm].porId === 'U-F' && !!h[iEm].en, h.map(x => x.por + ': ' + x.accion)); }
  T('I13 Facturación no ve la OC en otro estado que no sea confirmada; Comercial sí ve todo su historial y evidencias', call('U-F', 'ordenesCompra').r.every(o => o.estado === 'ACEPTADA') && call('U-G', 'ordenesCompra').r.length >= call('U-F', 'ordenesCompra').r.length && call('U-G', 'ordenesCompra').r.find(o => o.id === 'OC-0001').respuesta.evidencias.length === 1);
}
{
  /* Compatibilidad: viajes fuera de toda orden se facturan como siempre */
  const libre = ev(`__mk({shipment:'SH-LIBRE',pilotoId:'P-1',fechaPlan:'2031-08-04T08:00'},500)`);
  const f = call('U-N', 'prepararFactura', { cliente: 'COLGATE', viajeIds: [libre], numeroFactura: 'F-2001', serieFactura: 'A', fechaFactura: '2031-08-05' });
  T('K1 Un viaje fuera de órdenes se factura como antes (facturas sin orden siguen el flujo actual)', f.ok && !f.r.ocId && trip(libre).agrupacionId === f.r.id, f);
  const ya = call('U-G', 'ocGenerar', base([libre])); T('K2 Un viaje ya reservado por una factura no entra en una orden', !ya.ok && ya.code === 'NO_ELEGIBLE', ya);
}

/* ============ Anulación y liberación ============ */
let OC2;
{
  const g = call('U-G', 'ocGenerar', base([V.vacio === '' ? '' : V.b]));
  T('A0 Un viaje ya facturado no entra en otra orden', !g.ok);
  const nuevo = ev(`__mk({shipment:'SH-NEW',pilotoId:'P-3',fechaPlan:'2031-09-01T08:00'},3000)`);
  const nuevo2 = ev(`__mk({shipment:'SH-NEW2',pilotoId:'P-2',fechaPlan:'2031-09-02T08:00'},3500)`);
  OC2 = call('U-N', 'ocGenerar', base([nuevo, nuevo2]));
  T('A1 La segunda orden recibe el id OC-0002 (único) y total 6500', OC2.ok && OC2.r.id === 'OC-0002' && OC2.r.total === 6500, OC2);
  const sinMotivo = call('U-N', 'ocAnular', 'OC-0002', 'x'); T('A2 Anular exige motivo', !sinMotivo.ok && sinMotivo.code === 'VALIDACION', sinMotivo);
  const f = call('U-F', 'ocAnular', 'OC-0002', 'motivo válido'); T('A3 Facturación no puede anular órdenes', !f.ok && f.code === 'SIN_PERMISO', f);
  const a = call('U-N', 'ocAnular', 'OC-0002', 'Se cambió la selección');
  T('A4 Anular una orden preparada la marca Anulada, libera los viajes y conserva el registro', a.ok && a.r.estado === 'ANULADA' && a.r.anulada.motivo === 'Se cambió la selección' && !trip(nuevo).ocId && J('DB.ordenesCompra.length') === 2, a);
  const otra = call('U-N', 'ocGenerar', base([nuevo, nuevo2]));
  T('A5 Los viajes liberados pueden volver a una orden nueva (OC-0003)', otra.ok && otra.r.id === 'OC-0003', otra);
  const env = call('U-N', 'ocRegistrarPdf', 'OC-0003', { archivo: PDF });
  call('U-N', 'ocEnviar', 'OC-0003', {});
  const noCorrige = call('U-N', 'ocAnular', 'OC-0003', 'ya enviada, anulada por Comercial');
  T('A6 Anular una orden ya enviada es una función de Comercial: Analista y Gerencia pueden por defecto; Facturación no', noCorrige.ok && noCorrige.r.estado === 'ANULADA' && call('U-F', 'ocAnular', 'OC-0001', 'sin permiso de anulación').code === 'SIN_PERMISO');
  T('A7 Gerencia Comercial anula una orden enviada, con motivo (OC-0003 ya fue anulada por Analista → no puede repetirse)', !call('U-G', 'ocAnular', 'OC-0003', 'El cliente pidió rehacerla').ok && J('DB.ordenesCompra[2].estado') === 'ANULADA');
}
{
  /* Anular la factura de una orden aceptada la deja disponible otra vez */
  const ids = [ev(`__mk({shipment:'SH-F1',pilotoId:'P-1',fechaPlan:'2031-10-01T08:00'},400)`), ev(`__mk({shipment:'SH-F2',pilotoId:'P-2',fechaPlan:'2031-10-02T08:00'},600)`)];
  const o = call('U-G', 'ocGenerar', base(ids)).r; call('U-G', 'ocRegistrarPdf', o.id, { archivo: PDF }); call('U-G', 'ocEnviar', o.id, {});
  const sinAceptar = call('U-N', 'prepararFactura', { cliente: 'COLGATE', ocId: o.id });
  T('L1 Una orden NO aceptada no puede facturarse', !sinAceptar.ok && sinAceptar.code === 'ESTADO_INVALIDO', sinAceptar);
  ev(`DB.ordenesCompra.find(x=>x.id==='${o.id}').estado='ACEPTADA'`);
  const f = call('U-N', 'prepararFactura', { cliente: 'COLGATE', ocId: o.id });
  const an = call('U-N', 'anularAgrupacion', f.r.id, 'Factura descartada');
  T('L2 Si se descarta la factura preparada, la orden queda libre para facturar de nuevo', f.ok && an.ok && J(`DB.ordenesCompra.find(x=>x.id==='${o.id}').agrupacionId`) === '' && call('U-N', 'prepararFactura', { cliente: 'COLGATE', ocId: o.id }).ok);
  /* Rechazada conserva los viajes reservados (decisión pendiente) */
  const o2ids = [ev(`__mk({shipment:'SH-R1',pilotoId:'P-3',fechaPlan:'2031-11-03T08:00'},450)`)];
  const o2 = call('U-G', 'ocGenerar', base(o2ids)).r; call('U-G', 'ocRegistrarPdf', o2.id, { archivo: PDF }); call('U-G', 'ocEnviar', o2.id, {});
  const rej = call('U-G', 'ocResponder', o2.id, { resultado: 'RECHAZADA', motivo: 'Precio fuera de contrato' });
  T('L3 Una orden rechazada registra motivo y conserva sus viajes reservados hasta que Comercial la corrija o anule', rej.ok && rej.r.estado === 'RECHAZADA' && trip(o2ids[0]).ocId === o2.id && !call('U-G', 'ocGenerar', base(o2ids)).ok, rej);
}

/* ============ Corrección, anulación y gestión de rechazadas (decisiones definitivas de permisos) ============ */
{
  const mkv = (sh, p, f, t) => ev(`__mk({shipment:'${sh}',pilotoId:'${p}',fechaPlan:'${f}'},${t})`);
  const activas = id => J(`DB.ordenesCompra.filter(o=>OC_RESERVA.includes(o.estado)&&o.viajeIds.includes('${id}')).length`);
  const lista = (uid) => call(uid, 'ordenesCompra').r;
  const prep = (ids, uid = 'U-G') => { const o = call(uid, 'ocGenerar', base(ids)).r; call(uid, 'ocRegistrarPdf', o.id, { archivo: PDF }); call(uid, 'ocEnviar', o.id, {}); return o; };
  /* --- OC rechazada: Comercial la gestiona --- */
  const k = [mkv('SH-K1', 'P-1', '2031-12-01T08:00', 700), mkv('SH-K2', 'P-2', '2031-12-02T08:00', 800)];
  const o = prep(k);
  const rej = call('U-N', 'ocResponder', o.id, { resultado: 'RECHAZADA', motivo: 'Tarifa distinta a la orden del cliente' });
  T('K0 Comercial (Analista) registra el rechazo del cliente con motivo, usuario y fecha', rej.ok && rej.r.estado === 'RECHAZADA' && rej.r.respuesta.porId === 'U-N' && !!rej.r.respuesta.en && rej.r.respuesta.motivo.length > 5, rej);
  T('K1 Mientras está rechazada, sus viajes siguen reservados y no entran en otra OC ni se facturan sueltos', k.every(id => trip(id).ocId === o.id && activas(id) === 1) && !call('U-G', 'ocGenerar', base(k)).ok && !call('U-N', 'prepararFactura', { cliente: 'COLGATE', viajeIds: k }).ok);
  for (const uid of ['U-F', 'U-V', 'U-O', 'U-T']) { const x = call(uid, 'ocCorregir', o.id, { motivo: 'intento sin permiso' }); T(`K2 ${uid} no puede corregir ni gestionar una OC rechazada`, !x.ok && x.code === 'SIN_PERMISO', x); }
  T('K2b La OC rechazada no cambió tras los intentos sin permiso', J(`DB.ordenesCompra.find(x=>x.id==='${o.id}').estado`) === 'RECHAZADA');
  const sinMot = call('U-N', 'ocCorregir', o.id, { motivo: 'x' });
  T('K3 Corregir exige un motivo (mínimo 5 caracteres)', !sinMot.ok && sinMot.code === 'VALIDACION', sinMot);
  call('U-1', 'setPermiso', 'ANALISTA_COMERCIAL', 'oc_corregir', false);
  const sp = call('U-N', 'ocCorregir', o.id, { motivo: 'Se corrige la tarifa' });
  call('U-1', 'setPermiso', 'ANALISTA_COMERCIAL', 'oc_corregir', true);
  T('K3b El motor valida el permiso oc_corregir (retirado → SIN_PERMISO, nada cambia)', !sp.ok && sp.code === 'SIN_PERMISO' && J(`DB.ordenesCompra.find(x=>x.id==='${o.id}').estado`) === 'RECHAZADA', sp);
  /* --- nueva versión --- */
  const c = call('U-N', 'ocCorregir', o.id, { motivo: 'Se corrige la tarifa solicitada por el cliente' });
  const vieja = J(`DB.ordenesCompra.find(x=>x.id==='${o.id}')`);
  T('K4 Comercial crea la nueva versión: queda PREPARADA, enlazada a la rechazada (reemplazaA, versión 2)', c.ok && c.r.estado === 'PREPARADA' && c.r.reemplazaA === o.id && c.r.version === 2 && c.r.lineas.length === 2, c);
  T('K5 La OC rechazada pasa a REEMPLAZADA y conserva documento, envío, respuesta (rechazo), líneas, total e historial', vieja.estado === 'REEMPLAZADA' && vieja.reemplazadaPor === c.r.id && vieja.documentos.length === 1 && !!vieja.envio && vieja.respuesta.resultado === 'RECHAZADA' && vieja.lineas.length === 2 && vieja.total === 1500 && vieja.historial.length >= 4, vieja);
  T('K5b La corrección deja usuario, fecha y hora, motivo y estado anterior', vieja.correccion.porId === 'U-N' && !!vieja.correccion.en && /tarifa solicitada/.test(vieja.correccion.motivo) && vieja.correccion.estadoAlCorregir === 'RECHAZADA', vieja.correccion);
  T('K6 Los viajes pasan a la nueva OC y ningún viaje queda en dos OC activas', k.every(id => trip(id).ocId === c.r.id && activas(id) === 1));
  T('K7 La nueva versión no puede facturarse (no está aceptada) y el viaje no puede facturarse suelto', !call('U-N', 'prepararFactura', { cliente: 'COLGATE', ocId: c.r.id }).ok && !call('U-N', 'prepararFactura', { cliente: 'COLGATE', viajeIds: k }).ok);
  T('K8 La OC reemplazada no se puede facturar, anular ni corregir otra vez (OC cerrada)', !call('U-N', 'prepararFactura', { cliente: 'COLGATE', ocId: o.id }).ok && call('U-G', 'ocAnular', o.id, 'intento sobre una OC cerrada').code === 'ESTADO_INVALIDO' && call('U-G', 'ocCorregir', o.id, { motivo: 'otra vez, no debe poder' }).code === 'ESTADO_INVALIDO');
  const pdf2 = call('U-N', 'ocRegistrarPdf', c.r.id, { archivo: PDF });
  T('K9 La nueva versión genera su propio PDF y el PDF de la rechazada se conserva intacto', pdf2.ok && pdf2.r.documentos.length === 1 && J(`DB.ordenesCompra.find(x=>x.id==='${o.id}').documentos.length`) === 1);
  T('K10 La auditoría registra la corrección con motivo, usuario y las dos órdenes', J('DB.audit').some(a => a.accion === 'Orden de compra corregida (nueva versión)' && a.porId === 'U-N' && /tarifa solicitada/.test(a.motivo) && a.ref === `${o.id} → ${c.r.id}`));
  T('K10b Notifica a Comercial/Gerencia de la corrección', J('DB.notificaciones').some(n => n.tipo === 'OC_CORREGIDA' && n.destinatarios.includes('GERENTE_COMERCIAL')));
  /* Se puede seguir el flujo completo con la nueva versión */
  call('U-N', 'ocEnviar', c.r.id, {});
  const acc = call('U-G', 'ocResponder', c.r.id, { resultado: 'ACEPTADA', referencia: 'PO-K-2', evidencias: [EVID] });
  const fac = call('U-N', 'prepararFactura', { cliente: 'COLGATE', ocId: c.r.id });
  T('K11 La nueva versión aceptada se factura una sola vez (la segunda factura se rechaza)', acc.ok && fac.ok && !call('U-N', 'prepararFactura', { cliente: 'COLGATE', ocId: c.r.id }).ok && !call('U-N', 'prepararFactura', { cliente: 'COLGATE', ocId: o.id }).ok, fac);
  const antes = J('DB.ordenesCompra.length');
  const conFac = call('U-G', 'ocCorregir', c.r.id, { motivo: 'con factura activa no debe poder' });
  T('K12 No se puede corregir ni anular una OC con factura activa (hay que anular primero la factura)', !conFac.ok && conFac.code === 'TIENE_FACTURA' && call('U-G', 'ocAnular', c.r.id, 'con factura activa').code === 'TIENE_FACTURA' && J('DB.ordenesCompra.length') === antes);
  /* --- corregir con una selección distinta, gerencia y administrador --- */
  const m = [mkv('SH-K3', 'P-1', '2031-12-03T08:00', 300), mkv('SH-K4', 'P-2', '2031-12-04T08:00', 400)];
  const o2 = prep(m, 'U-G');
  const sub = call('U-1', 'ocCorregir', o2.id, { motivo: 'Administrador quita un viaje', viajeIds: [m[0]] });
  T('K13 El Administrador corrige una OC enviada; el viaje retirado queda libre y el otro pasa a la nueva', sub.ok && sub.r.lineas.length === 1 && trip(m[1]).ocId === '' && trip(m[0]).ocId === sub.r.id && activas(m[1]) === 0 && activas(m[0]) === 1, sub);
  const o3 = prep([m[1]], 'U-G');
  call('U-G', 'ocResponder', o3.id, { resultado: 'ACEPTADA', referencia: 'PO-K3', evidencias: [EVID] });
  const c3 = call('U-G', 'ocCorregir', o3.id, { motivo: 'Gerencia corrige una OC aceptada' });
  T('K14 Gerencia Comercial corrige una OC aceptada (sin factura): queda reemplazada y la nueva debe aceptarse de nuevo', c3.ok && c3.r.estado === 'PREPARADA' && J(`DB.ordenesCompra.find(x=>x.id==='${o3.id}').estado`) === 'REEMPLAZADA' && !call('U-N', 'prepararFactura', { cliente: 'COLGATE', ocId: o3.id }).ok, c3);
  /* --- una corrección inválida no rompe nada --- */
  const o4 = prep([mkv('SH-K5', 'P-1', '2031-12-05T08:00', 250)], 'U-G');
  const ajeno = mkv('SH-K6', 'P-2', '2031-12-06T08:00', 260);
  const o5 = call('U-G', 'ocGenerar', base([ajeno])).r;
  const malo = call('U-G', 'ocCorregir', o4.id, { motivo: 'incluir un viaje de otra OC', viajeIds: [o4.viajeIds[0], ajeno] });
  T('K15 Si la nueva selección es inválida (viaje en otra OC activa) la corrección falla completa: la original sigue igual y reserva sus viajes', !malo.ok && J(`DB.ordenesCompra.find(x=>x.id==='${o4.id}').estado`) === 'ENVIADA' && trip(o4.viajeIds[0]).ocId === o4.id && trip(ajeno).ocId === o5.id && activas(ajeno) === 1, malo);
  /* --- anulación: motivo, usuario, fecha y conservación --- */
  const an = call('U-N', 'ocAnular', o4.id, 'El cliente canceló el pedido');
  const v4 = J(`DB.ordenesCompra.find(x=>x.id==='${o4.id}')`);
  T('K16 Comercial anula una OC enviada: motivo, usuario, fecha y hora; conserva PDF e historial; libera los viajes', an.ok && v4.estado === 'ANULADA' && v4.anulada.porId === 'U-N' && !!v4.anulada.en && v4.anulada.motivo === 'El cliente canceló el pedido' && v4.documentos.length === 1 && v4.historial.length >= 3 && trip(o4.viajeIds[0]).ocId === '', an);
  T('K17 La anulación sin motivo se rechaza y Facturación no puede anular', !call('U-G', 'ocAnular', o5.id, '').ok && call('U-F', 'ocAnular', o5.id, 'sin permiso para anular').code === 'SIN_PERMISO');
  const rej5 = (() => { call('U-G', 'ocRegistrarPdf', o5.id, { archivo: PDF }); call('U-G', 'ocEnviar', o5.id, {}); call('U-G', 'ocResponder', o5.id, { resultado: 'RECHAZADA', motivo: 'No coincide con el pedido' }); return call('U-1', 'ocAnular', o5.id, 'Administrador descarta la rechazada'); })();
  T('K18 Una OC rechazada puede anularse con motivo: libera los viajes y quedan disponibles para otra OC', rej5.ok && rej5.r.estado === 'ANULADA' && trip(ajeno).ocId === '' && call('U-G', 'ocGenerar', base([ajeno])).ok, rej5);
  T('K19 Ningún viaje del conjunto quedó en dos OC activas ni en una OC y una factura a la vez', J(`DB.trips.every(t=>DB.ordenesCompra.filter(o=>OC_RESERVA.includes(o.estado)&&o.viajeIds.includes(t.id)).length<=1)`) && J(`DB.ordenesCompra.filter(o=>o.estado==='ACEPTADA'&&o.agrupacionId).every(o=>DB.agrupaciones.filter(g=>g.estado==='ACTIVA'&&g.ocId===o.id).length<=1)`));
  T('K21 Con OC en todos los estados, Facturación ve solo las confirmadas mientras Comercial, Gerencia y Admin ven todas', (() => { const est = new Set(call('U-G', 'ordenesCompra').r.map(o => o.estado)); const f = call('U-F', 'ordenesCompra').r; return est.size >= 4 && f.length > 0 && f.every(o => o.estado === 'ACEPTADA') && call('U-1', 'ordenesCompra').r.length === call('U-G', 'ordenesCompra').r.length; })());
  T('K20 Aceptar sin evidencia se rechaza en el motor (SIN_EVIDENCIA)', (() => { const ids = [ev(`__mk({shipment:'SH-NEV',pilotoId:'P-1',fechaPlan:'2031-09-20T08:00'},120)`)]; const o = call('U-G', 'ocGenerar', base(ids)).r; call('U-G', 'ocRegistrarPdf', o.id, { archivo: PDF }); call('U-G', 'ocEnviar', o.id, {}); const x = call('U-G', 'ocResponder', o.id, { resultado: 'ACEPTADA', referencia: 'PO-X' }); call('U-G', 'ocAnular', o.id, 'prueba sin evidencia'); return !x.ok && x.code === 'SIN_EVIDENCIA'; })());
}

/* ============ Seguridad de datos viejos ============ */
{
  ev('delete DB.ordenesCompra;delete DB.seq.oc');
  const r = call('U-G', 'ordenesCompra');
  T('V1 Una base anterior sin órdenes de compra se completa sola (lista vacía, contador desde 1)', r.ok && Array.isArray(r.r) && J('DB.seq.oc') >= 1, r);
}

console.log(filas.join('\n'));
console.log(`\nTotal: ${ok} OK · ${mal} FAIL`);
process.exit(mal ? 1 : 0);
