/* preparar-manuales.mjs · Arma, FUERA del repositorio, la carpeta que se sube al bucket PRIVADO «manuales» de Supabase.
   Uso:  node scripts/preparar-manuales.mjs --fuentes <carpeta Manuales_actualizados_v2.0> --salida <carpeta de salida>
   - NO regenera ni modifica los PDF: los copia tal cual.
   - Convierte el texto de las fuentes HTML aprobadas en páginas de consulta (JSON) SIN reescribir el contenido, y deja un
     índice de texto plano para el buscador. El HTML se limpia con una lista blanca de etiquetas y clases.
   - Requiere jsdom (devDependency del proyecto: npm install).
   - La carpeta de salida NO debe estar dentro de una carpeta pública del repositorio (manuales-privados/ está en .gitignore). */
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { CATALOGO, NOMBRE_IMAGEN } from '../supabase/functions/api/guias.mjs';

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

fs.mkdirSync(path.join(salida, 'pdf'), { recursive: true });
fs.mkdirSync(path.join(salida, 'json'), { recursive: true });
fs.mkdirSync(path.join(salida, 'img'), { recursive: true });
const resumen = [];
for (const g of CATALOGO) {
  const base = path.basename(g.pdf, '.pdf');
  const pdfOrigen = path.join(fuentes, base + '.pdf'), htmlOrigen = path.join(fuentes, 'fuentes_editables', base + '.html');
  if (!fs.existsSync(pdfOrigen)) throw new Error('Falta el PDF: ' + pdfOrigen);
  if (!fs.existsSync(htmlOrigen)) throw new Error('Falta la fuente: ' + htmlOrigen);
  fs.copyFileSync(pdfOrigen, path.join(salida, g.pdf));                      /* el PDF se copia byte a byte */
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
  fs.writeFileSync(path.join(salida, 'json', g.id + '.json'), JSON.stringify({ id: g.id, numero: g.numero, titulo: g.titulo, version: m ? m[1] : '2.0', fecha: m ? m[2].trim() : '', imagenes: [...imagenes], secciones: out }));
  for (const n of imagenes) {
    const o = path.join(fuentes, 'fuentes_editables', 'imagenes', n);
    if (!fs.existsSync(o)) throw new Error('Falta la captura ' + n + ' (' + g.id + ')');
    fs.copyFileSync(o, path.join(salida, 'img', n));
  }
  resumen.push(`${g.id}\t${g.pdf}\t${out.length} secciones\t${imagenes.size} capturas`);
}
fs.writeFileSync(path.join(salida, 'LEEME.txt'), 'Carpeta para el bucket PRIVADO «manuales» de Supabase Storage. Sube las carpetas pdf/, json/ e img/ tal cual (respeta los nombres). NO la pongas en el repositorio ni en GitHub Pages.\n\n' + resumen.join('\n') + '\n');
console.log(resumen.join('\n'));
