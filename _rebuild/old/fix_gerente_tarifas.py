import re
with open(r"C:\Users\manue\Master-App\js\engine.js", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Agregar 'tarifas_ver' a PERM_DEFAULT de GERENTE_TRANSPORTE
text = text.replace(
    "GERENTE_TRANSPORTE:['viajes_ver_todos','historial_ver','liq_ver','rutas_ver','rutas_validar','rutas_aprobar_transporte','viajes_aprobar_duplicado','unidades_asignar','tarifas_opl_ver','tarifas_opl_crear','viajes_editar_estado']",
    "GERENTE_TRANSPORTE:['viajes_ver_todos','historial_ver','liq_ver','rutas_ver','rutas_validar','rutas_aprobar_transporte','viajes_aprobar_duplicado','unidades_asignar','tarifas_opl_ver','tarifas_opl_crear','viajes_editar_estado','tarifas_ver']"
)

# 2. Quitar 'tarifas_ver' de PROHIBIDO de GERENTE_TRANSPORTE
text = text.replace(
    "GERENTE_TRANSPORTE:['permisos_gestionar','usuarios_gestionar','clientes_gestionar','liq_aprobar','liq_devolver','tarifas_ver','tarifas_crear','tarifas_editar','tarifas_desactivar','rutas_aprobar_comercial']",
    "GERENTE_TRANSPORTE:['permisos_gestionar','usuarios_gestionar','clientes_gestionar','liq_aprobar','liq_devolver','tarifas_crear','tarifas_editar','tarifas_desactivar','rutas_aprobar_comercial']"
)

with open(r"C:\Users\manue\Master-App\js\engine.js", "w", encoding="utf-8") as f:
    f.write(text)

# 3. Actualizar SW para reflejar el cambio
with open(r"C:\Users\manue\Master-App\service-worker.js", "r", encoding="utf-8") as f:
    sw = f.read()
sw = re.sub(r"const VERSION = 'v1\.0\.\d+';", "const VERSION = 'v1.0.15';", sw)
with open(r"C:\Users\manue\Master-App\service-worker.js", "w", encoding="utf-8") as f:
    f.write(sw)
