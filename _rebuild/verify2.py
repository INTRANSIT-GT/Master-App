import re, os, collections
ROOT = r"C:\Users\manue\Master-App"
MODS = ["js/ui.js"] + [os.path.join("js","modulos",f) for f in
        ["transporte.js","comercial.js","torre.js","finanzas.js","admin.js"]]
base = open(os.path.join(ROOT, "_rebuild", "base_ui.js"), encoding="utf-8").read()
nuevo = "\n".join(open(os.path.join(ROOT, f), encoding="utf-8").read() for f in MODS)

def fns(s):
    return collections.Counter(re.findall(r"(?m)^function\s+([A-Za-z0-9_$]+)\s*\(", s))
def vistas(s):
    return set(re.findall(r"(?m)^VIEWS\.([A-Za-z0-9_]+)\s*=", s))
def cuerpos(s):
    return set(re.findall(r"(?m)^BODY\.([A-Za-z0-9_]+)\s*=", s))
def consts(s):
    return set(re.findall(r"(?m)^const\s+([A-Za-z0-9_$]+)\s*=", s))

base_fn, new_fn = fns(base), fns(nuevo)
falt = {k: v for k, v in base_fn.items() if new_fn.get(k, 0) < v}
print("funciones base:", len(base_fn), "| nuevas:", len(new_fn), "| faltantes:", falt)

bv, nv = vistas(base), vistas(nuevo)
print("VIEWS base:", len(bv), "| nuevas:", len(nv), "| faltan:", sorted(bv - nv), "| extra:", sorted(nv - bv))
bb, nb = cuerpos(base), cuerpos(nuevo)
print("BODY  base:", len(bb), "| nuevas:", len(nb), "| faltan:", sorted(bb - nb), "| extra:", sorted(nb - bb))
bc, nc = consts(base), consts(nuevo)
print("const base:", len(bc), "| nuevas:", len(nc), "| faltan:", sorted(bc - nc))

# referencias que las pruebas del menu esperan
for sel in ["#tablaClientes", "qCli", "totales", "ADM_MODULOS", "admNavHTML", "navK"]:
    print("  contiene", sel, ":", sel in nuevo)
