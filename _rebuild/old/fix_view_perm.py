import re
with open(r"C:\Users\manue\Master-App\js\engine.js", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("opl:'finanzas_ver'", "opl:'tarifas_opl_ver'")

with open(r"C:\Users\manue\Master-App\js\engine.js", "w", encoding="utf-8") as f:
    f.write(text)

with open(r"C:\Users\manue\Master-App\service-worker.js", "r", encoding="utf-8") as f:
    sw = f.read()
sw = re.sub(r"const VERSION = 'v1\.0\.\d+';", "const VERSION = 'v1.0.18';", sw)
with open(r"C:\Users\manue\Master-App\service-worker.js", "w", encoding="utf-8") as f:
    f.write(sw)

