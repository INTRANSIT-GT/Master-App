#!/usr/bin/env node
/* Genera supabase/functions/api/core.mjs a partir del MISMO motor que usa la interfaz (js/engine.js),
   para que las reglas de negocio se ejecuten en el servidor y no existan dos versiones que se desalineen.
   Uso:  node scripts/build-core.mjs        (ejecútalo cada vez que cambies js/engine.js, js/utils.js o js/catalogos.js) */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const leer = f => fs.readFileSync(path.join(raíz, f), 'utf8');

const motor = leer('js/engine.js').replace(/\/\*#BROWSER\*\/[\s\S]*?\/\*#END\*\//g, '');   // fuera lo exclusivo del navegador (localStorage, datos de ejemplo)
const utils = leer('js/utils.js').split('\n');
const línea = prefijo => { const l = utils.find(x => x.startsWith(prefijo)); if (!l) throw new Error('No se encontró en utils.js: ' + prefijo); return l; };
const cat = leer('js/catalogos.js');
const catBloque = cat.slice(cat.indexOf('const CAT='), cat.indexOf('const FLOTA'));
const origenes = cat.split('\n').find(l => l.startsWith('const ORIGENES='));
if (!catBloque || !origenes) throw new Error('catalogos.js: no se encontró CAT u ORIGENES');

const prelude = `
/* Zona horaria de Guatemala (UTC-6, sin horario de verano): las horas guardadas por el motor son "hora local de Guatemala". */
const pad=n=>String(n).padStart(2,'0');
const _sh=d=>new Date(d.getTime()-6*3600*1000);
const dstr=d=>{const x=_sh(d);return x.getUTCFullYear()+'-'+pad(x.getUTCMonth()+1)+'-'+pad(x.getUTCDate());};
const toLocal=d=>{const x=_sh(d);return dstr(d)+'T'+pad(x.getUTCHours())+':'+pad(x.getUTCMinutes());};
${línea('const fmtDate=')}
${línea('const fmtL=')}
${línea('const CAMPOS_TIEMPO=')}
${línea('const TKEYS=')}
${línea('const LBL=')}
${línea('CAMPOS_TIEMPO.forEach(')}
${catBloque}
const FLOTA=[],PILOTOS=[],DESTINOS=[];   /* los carga el servidor desde las tablas flota, pilotos y destinos */
${origenes}
function save(){return true;}            /* la persistencia la hace store.mjs dentro de una transacción */
function rollback(){}
`;
const salida = `/* ARCHIVO GENERADO por scripts/build-core.mjs a partir de js/engine.js — NO editar a mano. */
export function createEngine(){
${prelude}
${motor}
return {API,ApiError,ROLES,PERMS,PERM_KEYS,PERM_DEFAULT,PROHIBIDO,ENV,TORRE_ESTATUS_DEFECTO,CAT,PILOTOS,FLOTA,DESTINOS,ORIGENES,hasPerm,blankDB,syncRefs,
  getDB:()=>DB, setDB:d=>{DB=d;syncRefs();}};
}
`;
fs.writeFileSync(path.join(raíz, 'supabase/functions/api/core.mjs'), salida);
console.log('core.mjs generado (' + Math.round(salida.length / 1024) + ' KB)');
