import re
with open(r"C:\Users\manue\Master-App\js\engine.js", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("const DB_VERSION=7;", "const DB_VERSION=8;")
text = text.replace(
    "if(DB.v===6)migrar6a7(DB);save();",
    "if(DB.v===6)migrar6a7(DB);if(DB.v===7)migrar7a8(DB);save();"
)
text = text.replace(
    "(o.v===DB_VERSION||o.v===5||o.v===6)",
    "(o.v===DB_VERSION||o.v===5||o.v===6||o.v===7)"
)

new_func = """function migrar7a8(db){
  const map = {
    'ENCARGADO': 'OPERATIVO',
    'LIQUIDACIONES': 'VALIDADOR',
    'COMERCIAL': 'FACTURACION',
    'CONTABILIDAD': 'COBROS'
  };
  db.usuarios.forEach(u => {
    if(map[u.rol]) u.rol = map[u.rol];
  });
  db.v = 8;
}
"""
text = text.replace("function migrar6a7(db){\n", new_func + "function migrar6a7(db){\n")

with open(r"C:\Users\manue\Master-App\js\engine.js", "w", encoding="utf-8") as f:
    f.write(text)

print("DB_VERSION actualizada.")
