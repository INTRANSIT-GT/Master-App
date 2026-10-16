p = r"C:\Users\manue\Master-App\_rebuild\rebuild.py"
s = open(p, encoding="utf-8").read()

old1 = r'admin_act = leer(r"js\modulos\admin.js")'
new1 = 'admin_act = leer(r"js\\ui.js")\ncomercial_act = leer(r"js\\modulos\\comercial.js")'
old2 = 'P_CLIENTEOPEN     = grab_fn(admin_act, "async clienteOpen(d){")'
new2 = 'P_CLIENTEOPEN     = grab_fn(comercial_act, "async clienteOpen(d){")'

assert s.count(old1) == 1, s.count(old1)
assert s.count(old2) == 1, s.count(old2)
s = s.replace(old1, new1).replace(old2, new2)
open(p, "w", encoding="utf-8").write(s)
print("fuentes de las piezas actualizadas")
