/* preparar-manuales.mjs · Genera las guías de «Mi guía de uso» como CÓDIGO LOCAL de la aplicación (sin PDF, sin Supabase):
     <salida>/js/guias-data.js        texto estructurado de las 8 guías (secciones, pasos, tablas, avisos)
     <salida>/assets/guias/*.png      capturas, referenciadas con rutas relativas
   Uso:  node scripts/preparar-manuales.mjs --fuentes <carpeta Manuales_actualizados_v2.0> --salida <raíz del proyecto>
   - Convierte el texto de las fuentes HTML aprobadas SIN reescribirlo; el HTML se limpia con una lista blanca de etiquetas y clases.
   - Los PDF originales no se usan, no se copian y no se tocan.
   - Requiere jsdom (devDependency del proyecto: npm install). */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';

/* Catálogo: id, número, título, perfil visible, rol interno (master.perfiles.rol) y nombre del manual original.
   ADMIN consulta las ocho (solo lectura de guías: no otorga permisos funcionales). Los roles sin guía no figuran. */
const g = (id, numero, titulo, perfil, rol, fuente) => ({ id, numero, titulo, perfil, roles: [...new Set([rol, 'ADMIN'])], fuente });
export const CATALOGO = [
  g('g01', '01', 'Administradora', 'Administradora', 'ADMIN', 'MasterApp-01-Administradora_v2.0'),
  g('g02', '02', 'Encargado de proyecto', 'Proyectos', 'PROYECTOS', 'MasterApp-02-Encargado-de-Proyecto_v2.0'),
  g('g02b', '02B', 'Operativo', 'Operativo', 'OPERATIVO', 'MasterApp-02B-Operativo_v2.0'),
  g('g03', '03', 'Torre de control', 'Torre de control', 'TORRE', 'MasterApp-03-Torre-de-Control_v2.0'),
  g('g04', '04', 'Revisión de liquidaciones', 'Validador', 'VALIDADOR', 'MasterApp-04-Revision-de-Liquidaciones_v2.0'),
  g('g05', '05', 'Facturación', 'Facturación', 'FACTURACION', 'MasterApp-05-Facturacion_v2.0'),
  g('g06', '06', 'Gerencia Comercial', 'Gerencia Comercial', 'GERENTE_COMERCIAL', 'MasterApp-06-Gerencia-Comercial_v2.0'),
  g('g08', '08', 'Gerencia de Transporte', 'Gerente de Transporte', 'GERENTE_TRANSPORTE', 'MasterApp-08-Gerencia-de-Transporte_v2.0'),
];
export const NOMBRE_IMAGEN = /^[A-Za-z0-9_-]{1,60}\.(png|jpg|jpeg|webp)$/;

const arg = n => { const i = process.argv.indexOf('--' + n); return i > 0 ? process.argv[i + 1] : ''; };
const fuentes = arg('fuentes'), salida = arg('salida');
if (!fuentes || !salida) { console.error('Uso: node scripts/preparar-manuales.mjs --fuentes <carpeta> --salida <carpeta>'); process.exit(1); }

export const TAGS = new Set(['p', 'h3', 'h4', 'ul', 'ol', 'li', 'b', 'strong', 'i', 'em', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'div', 'br', 'span', 'img', 'small']);
export const CLASES = new Set(['call', 'warn', 'ver', 'rule', 'k', 'step', 'n', 'x', 'fig', 'c', 't', 'si', 'no', 'box', 'cols', 'small', 'kicker', 'task', 'mute']);
const slug = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'seccion';
const texto = el => el.textContent.replace(/\s+/g, ' ').trim();

export function limpiar(nodo, imagenes) {      /* devuelve HTML limpio del nodo (sin la etiqueta contenedora) */
  const doc = nodo.ownerDocument;
  const copia = nodo.cloneNode(true);
  (function rec(el) {
    for (const h of [...el.children]) {
      const t = h.tagName.toLowerCase();
      if (!TAGS.has(t)) { h.remove(); continue; }
      if (t === 'img') {
        const nombre = path.basename(h.getAttribute('src') || '');
        if (!NOMBRE_IMAGEN.test(nombre)) { h.remove(); continue; }
        imagenes.add(nombre);
        const alt = h.getAttribute('alt') || '';
        for (const a of [...h.attributes]) h.removeAttribute(a.name);
        h.setAttribute('data-img', nombre); h.setAttribute('alt', alt);
        continue;
      }
      const cls = (h.getAttribute('class') || '').split(/\s+/).filter(c => CLASES.has(c)).join(' ');
      for (const a of [...h.attributes]) h.removeAttribute(a.name);
      if (cls) h.setAttribute('class', cls);
      rec(h);
    }
  })(copia);
  return copia.innerHTML.replace(/\s{2,}/g, ' ').trim();
}

fs.mkdirSync(path.join(salida, 'js'), { recursive: true });
fs.mkdirSync(path.join(salida, 'assets', 'guias'), { recursive: true });
const DATOS = [];
const resumen = [];
for (const g of CATALOGO) {
  const htmlOrigen = path.join(fuentes, 'fuentes_editables', g.fuente + '.html');
  if (!fs.existsSync(htmlOrigen)) throw new Error('Falta la fuente: ' + htmlOrigen);
  const doc = new JSDOM(fs.readFileSync(htmlOrigen, 'utf8')).window.document;
  const portada = doc.querySelector('.cover');
  const m = portada ? texto(portada).match(/Versi[oó]n\s*(\d+(?:\.\d+)*)\s*·\s*([^|]*?)(?:$|\s{2,})/i) : null;
  const imagenes = new Set(), secciones = [];
  let actual = null;
  const abrir = (titulo, esTarea) => { actual = { id: '', titulo, partes: [], tarea: !!esTarea }; secciones.push(actual); };
  const visitar = el => {
    const t = el.tagName.toLowerCase();
    if (el.classList.contains('cover') || el.classList.contains('hdrset')) return;
    if (el.classList.contains('ficha')) { for (const h of [...el.children]) visitar(h); return; }
    if (t === 'h2') { abrir(texto(el)); return; }
    if (el.classList.contains('kicker')) return;
    if (el.classList.contains('task')) {
      const h3 = el.querySelector(':scope > h3');
      abrir(h3 ? texto(h3) : 'Tarea', true);
      const c = el.cloneNode(true); const hh = c.querySelector(':scope > h3'); if (hh) hh.remove();
      actual.partes.push(limpiar(c, imagenes)); return;
    }
    if (!actual) abrir(g.titulo);
    actual.partes.push(t === 'div' || t === 'p' || t === 'table' || t === 'ul' || t === 'ol' || t === 'h3'
      ? limpiar(Object.assign(doc.createElement('div'), { innerHTML: el.outerHTML }), imagenes) : '');
  };
  for (const el of [...doc.body.children]) visitar(el);
  const usados = new Set();
  const out = secciones.map(s => {
    let id = slug(s.titulo), n = 2; while (usados.has(id)) id = slug(s.titulo) + '-' + n++; usados.add(id);
    const html = s.partes.join('');
    const plano = texto(Object.assign(doc.createElement('div'), { innerHTML: html }));
    return { id, titulo: (s.tarea ? 'Tarea: ' : '') + s.titulo, html, busqueda: (s.titulo + ' ' + plano).slice(0, 6000) };
  }).filter(s => s.html);
  DATOS.push({ id: g.id, numero: g.numero, titulo: g.titulo, perfil: g.perfil, roles: g.roles, version: m ? m[1] : '2.0', fecha: m ? m[2].trim() : '', imagenes: [...imagenes], secciones: out });
  for (const n of imagenes) {
    const o = path.join(fuentes, 'fuentes_editables', 'imagenes', n);
    if (!fs.existsSync(o)) throw new Error('Falta la captura ' + n + ' (' + g.id + ')');
    fs.copyFileSync(o, path.join(salida, 'assets', 'guias', n));
  }
  resumen.push(`${g.id}\t${out.length} secciones\t${imagenes.size} capturas`);
}
const cab = '/* guias-data.js · «Mi guía de uso» · contenido de las guías, incorporado a la aplicación (sin PDF, sin Supabase).\n' +
  '   GENERADO por scripts/preparar-manuales.mjs desde las guías aprobadas; las capturas están en assets/guias/.\n' +
  '   «roles»: perfiles (master.perfiles.rol) que ven la guía en Ayuda. Se carga solo al abrir «Mi guía de uso». */\n';
fs.writeFileSync(path.join(salida, 'js', 'guias-data.js'), cab + 'window.GUIAS_USO=[\n' + DATOS.map(d => JSON.stringify(d)).join(',\n') + '\n];\n');
console.log(resumen.join('\n'));
