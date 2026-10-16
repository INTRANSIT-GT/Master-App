import re
with open(r"C:\Users\manue\Master-App\js\engine.js", "r", encoding="utf-8") as f:
    text = f.read()

# Fix ANALISTA_COMERCIAL PROHIBIDO: replace ...ADMIN_TODO with just the others, or redefine
# Actually, since it's a spread operator `...ADMIN_TODO`, I'll replace it with `'usuarios_gestionar','permisos_gestionar','auditoria_ver'`
text = text.replace(
    "ANALISTA_COMERCIAL:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver',...ADMIN_TODO,'finanzas_ver','costos_registrar','cobros_registrar','pagos_registrar','viajes_estatus_torre','rutas_gestionar'],",
    "ANALISTA_COMERCIAL:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver','usuarios_gestionar','permisos_gestionar','auditoria_ver','finanzas_ver','costos_registrar','cobros_registrar','pagos_registrar','viajes_estatus_torre','rutas_gestionar'],"
)

# Add clientes_gestionar to ANALISTA_COMERCIAL default perms
text = text.replace(
    "ANALISTA_COMERCIAL:['comercial_ver','tarifas_ver','tarifas_crear','tarifas_editar','tarifas_desactivar','rutas_ver','rutas_solicitar','rutas_validar','historial_ver'],",
    "ANALISTA_COMERCIAL:['comercial_ver','tarifas_ver','tarifas_crear','tarifas_editar','tarifas_desactivar','rutas_ver','rutas_solicitar','rutas_validar','historial_ver','clientes_gestionar'],"
)


# Fix GERENTE_COMERCIAL NAV:
text = text.replace(
    "GERENTE_COMERCIAL:{label:'Gerencia Comercial',home:'rutas',nav:['proyectos','rutas'],alcance:'Aprobar rutas y asignar tarifas (requieren validación)'},",
    "GERENTE_COMERCIAL:{label:'Gerencia Comercial',home:'rutas',nav:['proyectos','rutas','opl'],alcance:'Aprobar rutas, administrar clientes/tarifas, autorizar OPL'},"
)

# Add permissions to GERENTE_COMERCIAL
text = text.replace(
    "GERENTE_COMERCIAL:['viajes_ver_todos','historial_ver','comercial_ver','tarifas_ver','tarifas_crear','tarifas_editar','tarifas_desactivar','rutas_ver','rutas_validar','rutas_aprobar_comercial'],",
    "GERENTE_COMERCIAL:['viajes_ver_todos','historial_ver','comercial_ver','tarifas_ver','tarifas_crear','tarifas_editar','tarifas_desactivar','rutas_ver','rutas_validar','rutas_aprobar_comercial','clientes_gestionar','tarifas_opl_ver','tarifas_opl_autorizar'],"
)

# Remove clientes_gestionar from GERENTE_COMERCIAL PROHIBIDO
text = text.replace(
    "GERENTE_COMERCIAL:['permisos_gestionar','usuarios_gestionar','clientes_gestionar','liq_aprobar','liq_devolver','viajes_aprobar_duplicado','rutas_aprobar_transporte','viajes_editar_estado'],",
    "GERENTE_COMERCIAL:['permisos_gestionar','usuarios_gestionar','liq_aprobar','liq_devolver','viajes_aprobar_duplicado','rutas_aprobar_transporte','viajes_editar_estado'],"
)

with open(r"C:\Users\manue\Master-App\js\engine.js", "w", encoding="utf-8") as f:
    f.write(text)

with open(r"C:\Users\manue\Master-App\service-worker.js", "r", encoding="utf-8") as f:
    sw = f.read()
sw = re.sub(r"const VERSION = 'v1\.0\.\d+';", "const VERSION = 'v1.0.17';", sw)
with open(r"C:\Users\manue\Master-App\service-worker.js", "w", encoding="utf-8") as f:
    f.write(sw)
