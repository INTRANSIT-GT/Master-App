import re
with open(r"C:\Users\manue\Master-App\js\engine.js", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace(
    "resumenFinanciero(uid,f){\n    const A=actor(uid);need(A,'finanzas_ver','consultar el control financiero');",
    "resumenFinanciero(uid,f){\n    const A=actor(uid); if(!hasPerm(A,'finanzas_ver')) need(A,'tarifas_opl_ver','consultar el control financiero (OPL)');"
)

text = text.replace(
    "viajesPorPagar(uid){const A=actor(uid);need(A,'finanzas_ver'",
    "viajesPorPagar(uid){const A=actor(uid);if(!hasPerm(A,'finanzas_ver'))need(A,'tarifas_opl_ver'"
)
text = text.replace(
    "ordenesPago(uid){const A=actor(uid);need(A,'finanzas_ver'",
    "ordenesPago(uid){const A=actor(uid);if(!hasPerm(A,'finanzas_ver'))need(A,'tarifas_opl_ver'"
)


with open(r"C:\Users\manue\Master-App\js\engine.js", "w", encoding="utf-8") as f:
    f.write(text)
