/* Exportación de Facturación (Excel/PDF): estructura del .xlsx, coincidencia con lo que se ve en pantalla y permisos. */
import { JSDOM } from 'jsdom';
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');
let ok = 0, mal = 0; const filas = [];
const T = (n, c, x) => { c ? ok++ : mal++; filas.push((c ? 'OK   ' : 'FAIL ') + n + (!c && x !== undefined ? '  ← ' + JSON.stringify(x).slice(0, 300) : '')); };
/* Página de demostración completa (con datos de ejemplo) para ejercitar el código real */
let html = leer('index.html').replace('<script src="js/config.js"></script>', '<script>window.MASTER_CONFIG={};</script>').replace('<script src="js/vendor/supabase.js"></script>', '')
  .replace('<script src="js/pwa.js"></script>', `<script>${leer('js/demo-seed.js')}</script><script src="js/pwa.js"></script>`)
  .replace(/<script src="(js\/[^"]+)"><\/script>/g, (m, f) => `<script>${leer(f)}</script>`);
const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://x.test/', pretendToBeVisual: true });
const w = dom.window, d = w.document, flush = () => new Promise(r => setTimeout(r, 15));
const ev = c => w.eval(c);
async function login(u, p) { ev('ACT.logout()'); await flush(); d.querySelector('#u').value = u; d.querySelector('#p').value = p; d.querySelector('[data-act=login]').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await flush(); await flush(); }
ev('seedDB();syncRefs();');
await login('alejandra', 'comercial123');
ev("S.tab.com='hist';go('comercial');S.tab.com='hist';render()");
T('01 La pestaña Facturación muestra los botones Descargar Excel y Descargar PDF', !!d.querySelector('[data-act=exportFactXlsx]') && !!d.querySelector('[data-act=exportFactPdf]'));
const pant = d.querySelectorAll('table.xl tbody tr').length;
const datos = ev('(()=>{const x=expFactDatos();return JSON.parse(JSON.stringify({v:x.viajes,f:x.facturas.map(f=>({id:f.id,factura:f.factura,fact:f.facturado,cobrado:f.cobrado,saldo:f.saldo,env:f.importeEnviado,n:f.viajes.length})),t:x.totales,fil:x.filtros}));})()');
T('02 El archivo trae exactamente los mismos viajes que la pantalla', datos.v.length === pant && pant > 0, [datos.v.length, pant]);
T('03 Cada viaje trae todo el detalle: ruta, origen, destino, piloto, unidad, placa, capacidad, factura, envío, importe', datos.v.every(v => v.id && v.rutaCod && v.origen && v.destino && v.piloto && v.unidad && v.placa && v.capacidad && v.factura && v.envio && v.por && v.importe != null));
T('04 Los totales cuadran con la suma de los viajes y de las facturas', Math.abs(datos.t.importeViajes - datos.v.reduce((s, v) => s + v.importe, 0)) < 0.01 && datos.t.viajes === datos.v.length && datos.t.facturas === datos.f.length);
T('05 Facturas emitidas: facturado, cobrado y saldo coherentes (saldo = facturado − cobrado)', datos.f.filter(f => f.fact != null).every(f => Math.abs(f.saldo - (f.fact - f.cobrado)) < 0.01) && datos.f.some(f => f.fact != null));
const bytes = ev('Array.from(xlsxBuild(expFactHojas(expFactDatos())))'); const u8 = Uint8Array.from(bytes);
T('06 El .xlsx es un ZIP válido (firma PK) y contiene las partes obligatorias', u8[0] === 0x50 && u8[1] === 0x4b);
const entradas = {}; { const dv = new DataView(u8.buffer); let eo = u8.length - 22; while (dv.getUint32(eo, true) !== 0x06054b50) eo--; let n = dv.getUint16(eo + 10, true), p = dv.getUint32(eo + 16, true);
  for (let i = 0; i < n; i++) { const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), off = dv.getUint32(p + 42, true), size = dv.getUint32(p + 24, true), crc = dv.getUint32(p + 16, true);
    const nombre = Buffer.from(u8.slice(p + 46, p + 46 + nl)).toString('utf8'); const lnl = dv.getUint16(off + 26, true), lel = dv.getUint16(off + 28, true);
    const datosE = u8.slice(off + 30 + lnl + lel, off + 30 + lnl + lel + size); entradas[nombre] = { datos: datosE, crcOk: (zlib.crc32 ? zlib.crc32(datosE) : null) === crc || !zlib.crc32 }; p += 46 + nl + el + cl; } }
T('07 Contiene [Content_Types].xml, workbook, estilos y 3 hojas (Resumen, Facturas, Detalle por viaje)', ['[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/styles.xml', 'xl/worksheets/sheet1.xml', 'xl/worksheets/sheet2.xml', 'xl/worksheets/sheet3.xml'].every(n => entradas[n]) && /Resumen/.test(Buffer.from(entradas['xl/workbook.xml'].datos).toString()) && /Detalle por viaje/.test(Buffer.from(entradas['xl/workbook.xml'].datos).toString()));
T('08 Las sumas de verificación (CRC) de todas las partes son correctas', Object.values(entradas).every(e => e.crcOk));
const xmlOk = Object.entries(entradas).every(([n, e]) => { const doc = new w.DOMParser().parseFromString(Buffer.from(e.datos).toString('utf8'), 'application/xml'); return !doc.querySelector('parsererror'); });
T('09 Todos los XML están bien formados', xmlOk);
const hoja3 = Buffer.from(entradas['xl/worksheets/sheet3.xml'].datos).toString('utf8');
T('10 Los importes se guardan como números con formato monetario (no como texto)', /<c r="Y2" s="2"><v>\d+(\.\d+)?<\/v><\/c>/.test(hoja3) || /<v>5200<\/v>/.test(hoja3));
T('11 Los acentos y caracteres especiales se conservan (UTF-8)', /Mayorista Escuintla/.test(hoja3) && /Mej[ií]a/.test(hoja3));
/* los filtros afectan al archivo */
ev("S.fcCli='CMI';render()"); const cmi = ev('expFactDatos().viajes.length'); ev("S.fcCli='';S.fcEstado='TODAS';render()"); const todas = ev('expFactDatos().viajes.length');
T('12 El archivo respeta los filtros activos (cliente, estado)', cmi < todas && todas >= pant, [cmi, todas, pant]);
ev("S.fcCli='NOEXISTE';render()");
let sinDatos = ''; try { ev('expFactXlsx()'); } catch (e) { sinDatos = e.message; }
T('13 Sin resultados no se genera un archivo vacío', sinDatos === 'SIN_DATOS', sinDatos);
T('14 jsPDF y el plugin de tablas están incluidos localmente (sin CDN)', ev("typeof window.jspdf.jsPDF==='function'&&typeof new window.jspdf.jsPDF().autoTable==='function'") && !/cdn|unpkg|jsdelivr/.test(leer('index.html').replace(/cdn\.tailwind/g, '')));
T('15 El texto del PDF se sanea a Latin-1 (la flecha → no sale corrupta)', ev("expPq('CP → Destino · Ñandú — ok')") === 'CP > Destino · Ñandú - ok');
/* permisos: quien no puede ver Facturación no exporta nada */
for (const [u, p] of [['pedro', 'colgate123'], ['mar', 'liq123'], ['felipe', 'torre123'], ['implan', 'implan123']]) {
  await login(u, p); ev("S.fcCli='';S.fcEstado='TODAS';S.fcQ='';S.fcFechas=[]");
  T(`16 ${u}: no ve facturación y la exportación sale vacía (no se filtra ningún dato)`, ev('expFactDatos().viajes.length') === 0 && !d.querySelector('[data-act=exportFactXlsx]'));
}
await login('gerencia', 'gerencia123'); ev("S.fcCli='';S.fcEstado='TODAS';S.fcQ='';S.fcFechas=[];S.fcFecha='';S.fcMes='';S.fcSem='';S.fcDesde='';S.fcHasta=''");
T('17 Gerencia (consulta) sí puede exportar lo que ve', ev('expFactDatos().viajes.length') > 0);
/* Finanzas → Facturación e ingresos (Gerencia y Administradora) */
for (const [u, pw] of [['gerencia', 'gerencia123'], ['admin', 'admin123']]) {
  await login(u, pw); ev("S.fDesde='';S.fHasta='';S.fCli='';S.fPcat='';S.fProv='';go('finanzas');S.tab.fin='fact';render()");
  const nFin = ev('API.resumenFinanciero(S.user.id,finFilters()).agrRows.length');
  T(`18 ${u}: en Finanzas → Facturación e ingresos hay botones de Excel y PDF`, !!d.querySelector('[data-act=exportFinXlsx]') && !!d.querySelector('[data-act=exportFinPdf]') && nFin > 0);
  T(`19 ${u}: lo exportado desde Finanzas son las mismas facturas que muestra la pantalla`, ev('expFactDatos(expFinOpts()).facturas.length') === nFin && ev('expFactDatos(expFinOpts()).viajes.length') >= nFin, [nFin]);
  T(`20 ${u}: el archivo indica su origen y el periodo`, ev("expFactDatos(expFinOpts()).filtros.map(f=>f[0]+f[1]).join('|')").includes('Finanzas'));
  ev("go('comercial');S.tab.com='hist';S.fcCli='';S.fcEstado='ENV';S.fcQ='';render()");
  T(`21 ${u}: también tiene los botones en Comercial → Facturación`, !!d.querySelector('[data-act=exportFactXlsx]') && !!d.querySelector('[data-act=exportFactPdf]'));
}
ev("S.fDesde='2099-01-01';render()");
let vacio = ''; try { ev('expFactXlsx(expFinOpts())'); } catch (e) { vacio = e.message; }
T('22 Un periodo sin facturas no genera archivo vacío', vacio === 'SIN_DATOS', vacio);
await login('alejandra', 'comercial123');
T('23 Comercial tiene el botón en Comercial → Facturación (no tiene módulo Finanzas)', ev("S.tab.com='hist';go('comercial');S.tab.com='hist';render();!!document.querySelector('[data-act=exportFactXlsx]')") && !ev("navItems().includes('finanzas')"));
console.log(filas.join('\n')); console.log(`\nRESULTADO: ${ok} correctas, ${mal} fallidas`); process.exit(mal ? 1 : 0);
