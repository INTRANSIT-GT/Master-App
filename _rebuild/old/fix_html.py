import re
with open(r"C:\Users\manue\Master-App\prueba-visual.html", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("u.rol==='ENCARGADO'", "u.rol==='OPERATIVO'")
text = text.replace("u.rol!=='ENCARGADO'", "u.rol!=='OPERATIVO'")
text = text.replace("Encargado de proyecto", "Operativo")

with open(r"C:\Users\manue\Master-App\prueba-visual.html", "w", encoding="utf-8") as f:
    f.write(text)
