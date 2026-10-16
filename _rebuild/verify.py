import re, os, sys, collections
ROOT = r"C:\Users\manue\Master-App"
FILES = ["js/ui.js"] + [os.path.join("js","modulos",f) for f in
         ["transporte.js","comercial.js","torre.js","finanzas.js","admin.js"]]
scripts = {}
for f in FILES:
    scripts[f] = open(os.path.join(ROOT, f), encoding="utf-8").read()

def dups(nombre, pat):
    d = collections.defaultdict(list)
    for f, s in scripts.items():
        for m in re.finditer(pat, s):
            d[m.group(1)].append(f)
    rep = {k: v for k, v in d.items() if len(v) > 1}
    print(f"{nombre}: {len(d)} definiciones, duplicadas: {len(rep)}")
    for k, v in list(rep.items())[:20]:
        print("   DUPLICADA:", k, "->", v)
    return d, rep

print("=== funciones de primer nivel")
dfn, rfn = dups("function", r"(?m)^function\s+([A-Za-z0-9_$]+)\s*\(")

print("=== VIEWS.* / BODY.*")
dv, rv = dups("VIEWS/BODY", r"(?m)^(?:VIEWS|BODY)\.([A-Za-z0-9_]+)\s*=")

todas = set()
for f in ("js/ui.js",):
    s = scripts[f]
    i = s.index("const ACT={")
    j = s.index("\n/* ---------- Eventos")
    todas |= set(re.findall(r"(?m)^  (?:async\s+)?([A-Za-z0-9_]+)\s*\(", s[i:j]))
for f in FILES[1:]:
    for m in re.finditer(r"Object\.assign\(ACT,\{(.*?)\n\}\);", scripts[f], re.S):
        todas |= set(re.findall(r"(?m)^\s*(?:async\s+)?([A-Za-z0-9_]+)\s*\(", m.group(1)))
print("=== metodos ACT declarados en total:", len(todas))

esperado = set()
base = open(os.path.join(ROOT, "_rebuild", "base_ui.js"), encoding="utf-8").read()
sys.path.insert(0, os.path.join(ROOT, "_rebuild"))
from jsscan import find_object, parse_methods
i0, i1 = find_object(base, "const ACT={")
ms, _ = parse_methods(base, i0, i1)
esperado = set(n for n, _ in ms)
print("=== metodos ACT en la base original:", len(esperado))
faltan = esperado - todas
print("faltan:", sorted(faltan))
