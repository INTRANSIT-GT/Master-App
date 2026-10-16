# Ajustes finales: CSS del menu agrupado, package.json, service worker, engine y adaptacion del test.
import re, os
ROOT = r"C:\Users\manue\Master-App"
def ruta(*p): return os.path.join(ROOT, *p)
def leer(p): return open(ruta(p), encoding="utf-8").read()
def escribe(p, s): open(ruta(p), "w", encoding="utf-8", newline="\n").write(s)

# 1) CSS: reglas del menu lateral agrupado (del commit de GitHub)
css = leer(r"css\app.css")
bloque_css = """
/* ---- Administrador: menú lateral agrupado por módulos (solo añade reglas; el menú de los demás perfiles no cambia) ---- */
.side .grp{display:flex;flex-direction:column;gap:2px;margin-top:12px;padding-top:10px;border-top:1px solid var(--line2)}
.side .grp-t{font-size:11px;font-weight:800;letter-spacing:.09em;color:var(--mute);padding:2px 12px 4px}
@container app (max-width:900px){
  .side .grp{flex-direction:row;align-items:center;margin-top:0;padding-top:0;border-top:0;border-left:1px solid var(--line);padding-left:8px;margin-left:4px;gap:4px}
  .side .grp-t{white-space:nowrap;padding:0 6px 0 0}
}
"""
if ".side .grp" not in css:
    if not css.endswith("\n"): css += "\n"
    escribe(r"css\app.css", css + bloque_css)
    print("[ok] css/app.css: reglas .side .grp agregadas")
else:
    print("[=] css/app.css ya tenia las reglas")

# 2) package.json: script test:menu
pj = leer(r"package.json")
if '"test:menu"' not in pj:
    pj = pj.replace('    "test:admin": "node tests/administrador.test.mjs",',
                    '    "test:admin": "node tests/administrador.test.mjs",\n    "test:menu": "node tests/menu-admin.test.mjs",')
    escribe(r"package.json", pj)
    print("[ok] package.json: test:menu agregado")
else:
    print("[=] package.json ya tenia test:menu")

# 3) service-worker: version + modulos
sw = leer(r"service-worker.js")
sw = re.sub(r"const VERSION = 'v1\.0\.\d+';", "const VERSION = 'v1.0.23';", sw)
if "./js/modulos/torre.js" not in sw:
    sw = sw.replace("'./js/ui.js',",
        "'./js/ui.js', './js/modulos/transporte.js', './js/modulos/comercial.js', './js/modulos/torre.js', './js/modulos/finanzas.js', './js/modulos/admin.js',")
    print("[ok] service-worker.js: modulos en la lista de cache")
escribe(r"service-worker.js", sw)
print("[ok] service-worker.js -> v1.0.23")

# 4) engine.js: no exigir 'estado' cuando el select queda vacio
en = leer(r"js\engine.js")
old = "if(['estado','proyectoCat','fechaPlan','pilotoId','rutaId'].includes(k)&&(nv===''||nv==null))deny("
new = "if(['proyectoCat','fechaPlan','pilotoId','rutaId'].includes(k)&&(nv===''||nv==null))deny("
if old in en:
    en = en.replace(old, new)
    en = en.replace(
      "      const nv=typeof cambios[k]==='string'?cambios[k].trim():cambios[k];\n      const ov=t[k]==null?'':t[k];",
      "      const nv=typeof cambios[k]==='string'?cambios[k].trim():cambios[k];\n      const ov=t[k]==null?'':t[k];\n      if(k==='estado'&&(nv===''||nv==null))return;   /* sin estado elegido: se conserva el actual */")
    escribe(r"js\engine.js", en)
    print("[ok] engine.js: 'estado' vacio conserva el estado actual")
else:
    print("[=] engine.js ya estaba ajustado")

# 5) test menu-admin: cargar BASE sin los modulos + comprobar el buscador nuevo
tm = leer(r"tests\menu-admin.test.mjs")
viejo = """const cargar = rutaUi => {
  let html = leer('index.html').replace"""
nuevo = """const cargar = rutaUi => {
  let html = leer('index.html').replace"""
if "js/modulos" not in tm:
    tm = tm.replace(
      "  let html = leer('index.html').replace('<script src=\"js/config.js\"></script>', '<script>window.MASTER_CONFIG={};</script>').replace('<script src=\"js/vendor/supabase.js\"></script>', '')",
      "  let html = leer('index.html').replace('<script src=\"js/config.js\"></script>', '<script>window.MASTER_CONFIG={};</script>').replace('<script src=\"js/vendor/supabase.js\"></script>', '')\n    /* la version ANTERIOR (respaldo) es un ui.js monolitico: sin los modulos, para no duplicar codigo */\n    .replace(rutaUi ? /<script src=\"js\\/modulos\\/[^\"]+\"><\\/script>\\s*/g : /$^/, '')")
    tm = tm.replace(
      "T('M14 Clientes conserva la tabla de 13 columnas y el filtro (cambios anteriores intactos)', !!d.querySelector('#tablaClientes') && d.querySelectorAll('#tablaClientes thead th').length === 13 && !!d.querySelector('.cb[data-cb=\"cliFiltro\"]'));",
      "T('M14 Clientes conserva la tabla de 13 columnas y el buscador (cambios anteriores intactos)', !!d.querySelector('#tablaClientes') && d.querySelectorAll('#tablaClientes thead th').length === 13 && !!d.getElementById('qCli'));")
    escribe(r"tests\menu-admin.test.mjs", tm)
    print("[ok] tests/menu-admin.test.mjs adaptado a los modulos")
else:
    print("[=] tests/menu-admin.test.mjs ya adaptado")
print("LISTO")
