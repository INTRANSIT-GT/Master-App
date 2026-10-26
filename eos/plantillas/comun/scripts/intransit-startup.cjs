// Hook SessionStart de Claude: imprime un recibo (archivos, hashes, rama/SHA, operador) y el estado breve.
// Además del estado, solo lee el operador y el final de la bitácora privada que deja EOS,
// y busca en disco (sin ejecutarlas) las dependencias declaradas en eos/dependencias.json.
// No lee .env, Excel, credenciales ni datos de clientes; no instala, no usa la red y no modifica Git.
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const cp = require('node:child_process');
const root = path.resolve(__dirname, '..');
let input = {};
try { input = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch {}
const fixed = ['AGENTS.md', 'CLAUDE.md', 'docs/ai/ESTADO.md', 'docs/ai/TRASPASO.md'];
const files = fixed.map(name => {
  const full = path.join(root, name);
  if (!fs.existsSync(full)) return { path: name, status: 'FALTANTE' };
  const bytes = fs.readFileSync(full);
  return { path: name, sha256: crypto.createHash('sha256').update(bytes).digest('hex') };
});
function git(args) {
  try { return cp.execFileSync('git', ['-C', root, ...args], {
    encoding: 'utf8', timeout: 1500, stdio: ['ignore', 'pipe', 'ignore']
  }).trim(); } catch { return 'NO_VERIFICADO'; }
}
// Operador y bitácora los escribe EOS en .claude/privado (fuera de Git): cada equipo declara el suyo.
const privado = path.join(root, '.claude', 'privado');
let operador = null;
try { operador = JSON.parse(fs.readFileSync(path.join(privado, 'operador.json'), 'utf8')); } catch {}
let bitacora = null;
try { bitacora = fs.readdirSync(path.join(privado, 'bitacora')).filter(f => /^\d{4}-\d{2}-\d{2}\.md$/.test(f)).sort().pop() || null; } catch {}
// Dependencias: herramientas en el PATH o en sus rutas conocidas, y node_modules. Los servicios (puertos) los revisa EOS.
let deps = null;
try { deps = JSON.parse(fs.readFileSync(path.join(root, 'eos', 'dependencias.json'), 'utf8')); } catch {}
const exts = process.platform === 'win32' ? (process.env.PATHEXT || '.EXE;.CMD;.BAT').split(';') : [''];
const enDisco = h => [...(process.env.PATH || '').split(path.delimiter), ...(h.rutas || [])]
  .some(d => d && exts.some(e => fs.existsSync(path.join(d, h.comando + e))));
const propio = (deps && deps[path.basename(root)]) || {};
const faltan = [];
for (const h of [...((deps && deps.comun && deps.comun.herramientas) || []), ...(propio.herramientas || [])])
  if (!h.opcional && !enDisco(h)) faltan.push(h.comando);
for (const sub of propio.npm || [])
  if (fs.existsSync(path.join(root, sub, 'package.json')) && !fs.existsSync(path.join(root, sub, 'node_modules')))
    faltan.push(`npm:${sub}`);
const status = git(['status', '--porcelain']);
const receipt = {
  kind: 'INTRANSIT_STARTUP', at: new Date().toISOString(),
  event: input.hook_event_name || 'PRUEBA_MANUAL', source: input.source || 'desconocido',
  app: path.basename(root), root,
  branch: git(['branch', '--show-current']), revision: git(['rev-parse', 'HEAD']),
  dirty: status === 'NO_VERIFICADO' ? status : status.split('\n').filter(Boolean).length,
  files, missing: files.filter(f => f.status === 'FALTANTE').map(f => f.path),
  operator: operador && operador.id ? operador.id : 'NO_DECLARADO',
  log: bitacora ? `.claude/privado/bitacora/${bitacora}` : 'SIN_BITACORA',
  deps_missing: deps ? faltan : 'SIN_MANIFIESTO'
};
process.stdout.write(JSON.stringify(receipt) + '\n');
const state = path.join(root, 'docs/ai/ESTADO.md');
if (fs.existsSync(state)) {
  const text = fs.readFileSync(state, 'utf8');
  process.stdout.write('\nESTADO ACTUAL DEL PROYECTO\n' + text.slice(0, 6000) + '\n');
  if (text.length > 6000) process.stdout.write('ESTADO TRUNCADO: leer el archivo completo antes de trabajar.\n');
}
if (faltan.length) {
  process.stdout.write(`\nDEPENDENCIAS FALTANTES: ${faltan.join(', ')}. Cómo instalarlas: eos/dependencias.json. `
    + 'Ofrecer resolverlas antes de trabajar; lo que se instala en el sistema, solo con autorización.\n');
}
if (bitacora) {
  const text = fs.readFileSync(path.join(privado, 'bitacora', bitacora), 'utf8');
  process.stdout.write(`\nBITÁCORA PRIVADA (${bitacora}, final)\n` + text.slice(-1200) + '\n');
}
process.stdout.write(operador && operador.trato
  ? `Operador: ${operador.nombre}. Trato: ${operador.trato}. Responsable del proyecto: Ing. Carmen. Anotar avances con la skill intransit-bitacora.\n`
  : 'Operador NO_DECLARADO (abrir la sesión con EOS). Trato: Ing. Carmen.\n');
process.stdout.write('Verificar permisos y fuentes antes de actuar.\n');
