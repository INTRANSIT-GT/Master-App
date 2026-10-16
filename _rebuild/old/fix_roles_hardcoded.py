import re
with open(r"C:\Users\manue\Master-App\js\ui.js", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("u.rol==='ENCARGADO'", "u.rol==='OPERATIVO'")
text = text.replace("S.user.rol==='ENCARGADO'", "S.user.rol==='OPERATIVO'")
text = text.replace("rol:'ENCARGADO'", "rol:'OPERATIVO'")
text = text.replace("S.user.rol==='GERENCIA'", "S.user.rol==='GERENTE_TRANSPORTE'")
text = text.replace("ADMIN · ENCARGADO · TORRE · LIQUIDACIONES · COMERCIAL · GERENCIA", "ADMIN · OPERATIVO · TORRE · VALIDADOR · FACTURACION · GERENTE_TRANSPORTE")

with open(r"C:\Users\manue\Master-App\js\ui.js", "w", encoding="utf-8") as f:
    f.write(text)

with open(r"C:\Users\manue\Master-App\js\engine.js", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("u.rol==='ENCARGADO'", "u.rol==='OPERATIVO'")
text = text.replace("d.rol==='ENCARGADO'", "d.rol==='OPERATIVO'")

with open(r"C:\Users\manue\Master-App\js\engine.js", "w", encoding="utf-8") as f:
    f.write(text)

print("Hardcoded roles actualizados.")
