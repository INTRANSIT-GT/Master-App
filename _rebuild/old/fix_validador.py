import re
with open(r"C:\Users\manue\Master-App\js\engine.js", "r", encoding="utf-8") as f:
    text = f.read()

# Quitar liq_aprobar y liq_devolver de PROHIBIDO en GERENTE_TRANSPORTE
text = text.replace(
    "GERENTE_TRANSPORTE:['permisos_gestionar','usuarios_gestionar','liq_aprobar','liq_devolver','viajes_aprobar_duplicado','rutas_aprobar_transporte','viajes_editar_estado'],",
    "GERENTE_TRANSPORTE:['permisos_gestionar','usuarios_gestionar','viajes_aprobar_duplicado','rutas_aprobar_transporte','viajes_editar_estado'],"
)

# Agregar liq_aprobar y liq_devolver a PERM_DEFAULT en GERENTE_TRANSPORTE
text = text.replace(
    "GERENTE_TRANSPORTE:['viajes_ver_todos','historial_ver','liq_ver','rutas_ver','rutas_validar','rutas_aprobar_transporte','viajes_aprobar_duplicado','unidades_asignar','tarifas_opl_ver','tarifas_opl_crear','viajes_editar_estado','tarifas_ver'],",
    "GERENTE_TRANSPORTE:['viajes_ver_todos','historial_ver','liq_ver','rutas_ver','rutas_validar','rutas_aprobar_transporte','viajes_aprobar_duplicado','unidades_asignar','tarifas_opl_ver','tarifas_opl_crear','viajes_editar_estado','tarifas_ver','liq_aprobar','liq_devolver'],"
)

with open(r"C:\Users\manue\Master-App\js\engine.js", "w", encoding="utf-8") as f:
    f.write(text)

with open(r"C:\Users\manue\Master-App\service-worker.js", "r", encoding="utf-8") as f:
    sw = f.read()
sw = re.sub(r"const VERSION = 'v1\.0\.\d+';", "const VERSION = 'v1.0.21';", sw)
with open(r"C:\Users\manue\Master-App\service-worker.js", "w", encoding="utf-8") as f:
    f.write(sw)
