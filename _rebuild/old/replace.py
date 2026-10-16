import re
with open(r"C:\Users\manue\Master-App\js\engine.js", "r", encoding="utf-8") as f:
    text = f.read()

new_block = """const PERMS=[
  ['viajes_ver','Ver viajes de sus clientes asignados','Viajes'],
  ['viajes_ver_todos','Ver viajes de todos los clientes','Viajes'],
  ['viajes_crear','Crear viajes','Viajes'],
  ['viajes_editar_datos','Editar datos operativos (no fechas)','Viajes'],
  ['viajes_editar_tiempos','Editar fechas y horas','Viajes'],
  ['viajes_editar_estado','Modificar manualmente el estado del viaje','Viajes'],
  ['viajes_iniciar','Enviar viaje a ruta (Planificado → En ruta)','Estados'],
  ['viajes_finalizar','Confirmar entrega (En ruta → Entregado)','Estados'],
  ['viajes_aprobar_duplicado','Aprobar Shipment duplicado','Estados'],
  ['liq_ver','Ver liquidaciones','Liquidaciones'],
  ['liq_enviar','Enviar / reenviar liquidación','Liquidaciones'],
  ['liq_aprobar','Aprobar liquidación','Liquidaciones'],
  ['liq_devolver','Devolver liquidación para corrección','Liquidaciones'],
  ['comercial_ver','Ver módulo Comercial','Comercial'],
  ['comercial_agrupar','Preparar y enviar facturas (agrupar es opcional)','Comercial'],
  ['comercial_corregir','Corregir número de factura','Comercial'],
  ['comercial_anular','Anular agrupación comercial','Comercial'],
  ['historial_ver','Ver historial completo del viaje','Consulta'],
  ['tablero_ver','Ver tablero global / gerencial','Consulta'],
  ['catalogos_ver','Ver catálogos y modelo de datos','Consulta'],
  ['usuarios_gestionar','Gestionar usuarios y accesos','Administración'],
  ['permisos_gestionar','Administrar permisos','Administración'],
  ['clientes_gestionar','Administrar clientes y proyectos','Administración'],
  ['auditoria_ver','Ver auditoría y rechazos','Administración'],
  ['finanzas_ver','Ver control financiero (ingresos, costos, rentabilidad)','Finanzas'],
  ['tarifa_registrar','Aplicar la tarifa vigente a los viajes','Finanzas'],
  ['costos_registrar','Registrar costo a proveedor por viaje','Finanzas'],
  ['cobros_registrar','Registrar cobros de facturas','Finanzas'],
  ['pagos_registrar','Registrar y anular pagos a proveedores y pilotos','Finanzas'],
  ['viajes_estatus_torre','Avanzar el estado del viaje de los clientes autorizados (Torre)','Estados'],
  ['facturas_emitir','Marcar una factura como emitida (con evidencia)','Comercial'],
  ['tarifas_ver','Consultar tarifas cliente','Tarifas'],
  ['tarifas_crear','Crear tarifas cliente','Tarifas'],
  ['tarifas_editar','Editar tarifas cliente','Tarifas'],
  ['tarifas_desactivar','Activar o desactivar tarifas cliente','Tarifas'],
  ['tarifas_opl_ver','Consultar tarifas a proveedores (OPL)','Tarifas'],
  ['tarifas_opl_crear','Crear/registrar tarifas OPL','Tarifas'],
  ['tarifas_opl_autorizar','Autorizar tarifas OPL (Admin)','Tarifas'],
  ['rutas_ver','Consultar rutas','Rutas'],
  ['rutas_solicitar','Solicitar una ruta nueva','Rutas'],
  ['rutas_gestionar','Registrar rutas validadas en el catálogo','Rutas'],
  ['rutas_validar','Completar datos de una ruta pendiente','Rutas'],
  ['rutas_aprobar_comercial','Aprobar ruta y tarifa por Gerencia Comercial','Rutas'],
  ['rutas_aprobar_transporte','Aprobar ruta por Gerencia de Transporte','Rutas'],
  ['unidades_asignar','Asignar unidades y pilotos a vehículos','Transporte']
];
const PERM_KEYS=PERMS.map(p=>p[0]);
const ROLES={
  ADMIN:{label:'Administradora',home:'inicio',nav:['inicio','proyectos','todos','viajes','nuevo','torre','liquidaciones','comercial','rutas','opl','finanzas','catalogos','usuarios','auditoria','modelo'],alcance:'Permisos completos en todos los módulos'},
  GERENTE_TRANSPORTE:{label:'Gerente de Transporte',home:'todos',nav:['todos','rutas','opl','liquidaciones','catalogos'],alcance:'Ver todo, asignar unidades/pilotos, autorizar/crear tarifas OPL'},
  VALIDADOR:{label:'Validador',home:'liquidaciones',nav:['viajes','liquidaciones'],alcance:'Revisar/aprobar liquidaciones de clientes asignados'},
  OPERATIVO:{label:'Operativo',home:'inicio',nav:['inicio','nuevo','viajes','liquidaciones'],alcance:'Registrar, editar y liquidar viajes de clientes asignados'},
  ANALISTA_COMERCIAL:{label:'Analista Comercial',home:'proyectos',nav:['proyectos','rutas'],alcance:'Administrar clientes y tarifas con auditoría obligatoria'},
  GERENTE_COMERCIAL:{label:'Gerencia Comercial',home:'rutas',nav:['proyectos','rutas'],alcance:'Aprobar rutas y asignar tarifas (requieren validación)'},
  FACTURACION:{label:'Facturación',home:'comercial',nav:['todos','comercial'],alcance:'Cargar facturas, revisar viajes por facturar'},
  COBROS:{label:'Cobros / Contabilidad',home:'comercial',nav:['comercial'],alcance:'Registrar cobros y pagos'},
  PAGO_OPL:{label:'Pago OPL',home:'opl',nav:['opl'],alcance:'Registrar OPL y tarifas a proveedores (requieren autorización)'},
  TORRE:{label:'Torre de control',home:'torre',nav:['torre'],alcance:'Editar horas y marcar Completado para viajes en ruta'}
};
const PERM_DEFAULT={
  ADMIN:PERM_KEYS.slice(),
  GERENTE_TRANSPORTE:['viajes_ver_todos','historial_ver','liq_ver','rutas_ver','rutas_validar','rutas_aprobar_transporte','viajes_aprobar_duplicado','unidades_asignar','tarifas_opl_ver','tarifas_opl_crear','viajes_editar_estado'],
  VALIDADOR:['viajes_ver','liq_ver','liq_aprobar','liq_devolver','historial_ver'],
  OPERATIVO:['viajes_ver','viajes_crear','viajes_editar_datos','viajes_editar_tiempos','viajes_iniciar','viajes_finalizar','liq_ver','liq_enviar','historial_ver','rutas_ver','rutas_solicitar'],
  ANALISTA_COMERCIAL:['comercial_ver','tarifas_ver','tarifas_crear','tarifas_editar','tarifas_desactivar','rutas_ver','rutas_solicitar','rutas_validar','historial_ver'],
  GERENTE_COMERCIAL:['viajes_ver_todos','historial_ver','comercial_ver','tarifas_ver','tarifas_crear','tarifas_editar','tarifas_desactivar','rutas_ver','rutas_validar','rutas_aprobar_comercial'],
  FACTURACION:['viajes_ver_todos','comercial_ver','comercial_agrupar','facturas_emitir','tarifas_ver'],
  COBROS:['comercial_ver','cobros_registrar','finanzas_ver'],
  PAGO_OPL:['finanzas_ver','tarifas_opl_ver','tarifas_opl_crear'],
  TORRE:['viajes_ver_todos','viajes_estatus_torre']
};
/* Separación de funciones: permisos que NUNCA se pueden conceder a un rol, ni siquiera desde la matriz. */
const OPERATIVOS=['viajes_crear','viajes_editar_datos','viajes_iniciar','viajes_finalizar','liq_enviar'];
const FINANZAS_TODO=['finanzas_ver','tarifa_registrar','costos_registrar','cobros_registrar','pagos_registrar'];
const FACT_TODO=['comercial_agrupar','comercial_corregir','comercial_anular','facturas_emitir','cobros_registrar'];
const ADMIN_TODO=['usuarios_gestionar','permisos_gestionar','clientes_gestionar','auditoria_ver'];
const TARIFAS_TODO=['tarifas_crear','tarifas_editar','tarifas_desactivar','tarifa_registrar'];
const RUTAS_ADM=['rutas_gestionar','rutas_validar','rutas_aprobar_comercial','rutas_aprobar_transporte'];
const PROHIBIDO={
  ADMIN:[],
  GERENTE_TRANSPORTE:['permisos_gestionar','usuarios_gestionar','clientes_gestionar','liq_aprobar','liq_devolver','tarifas_ver','tarifas_crear','tarifas_editar','tarifas_desactivar','rutas_aprobar_comercial'],
  VALIDADOR:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado',...FACT_TODO,...ADMIN_TODO,...FINANZAS_TODO,...TARIFAS_TODO,'tarifas_ver',...RUTAS_ADM,'rutas_solicitar','viajes_estatus_torre'],
  OPERATIVO:['liq_aprobar','liq_devolver','viajes_editar_estado',...FACT_TODO,...ADMIN_TODO,...FINANZAS_TODO,...TARIFAS_TODO,'tarifas_ver',...RUTAS_ADM,'viajes_estatus_torre'],
  ANALISTA_COMERCIAL:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver',...ADMIN_TODO,'finanzas_ver','costos_registrar','cobros_registrar','pagos_registrar','viajes_estatus_torre','rutas_gestionar'],
  GERENTE_COMERCIAL:['permisos_gestionar','usuarios_gestionar','clientes_gestionar','liq_aprobar','liq_devolver','viajes_aprobar_duplicado','rutas_aprobar_transporte','viajes_editar_estado'],
  FACTURACION:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver',...ADMIN_TODO,'costos_registrar','cobros_registrar','pagos_registrar','viajes_estatus_torre','rutas_gestionar','tarifas_crear','tarifas_editar','tarifas_desactivar'],
  COBROS:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver',...ADMIN_TODO,...TARIFAS_TODO,'tarifas_ver',...RUTAS_ADM,'viajes_estatus_torre'],
  PAGO_OPL:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver',...FACT_TODO,...ADMIN_TODO,...TARIFAS_TODO,'tarifas_ver',...RUTAS_ADM,'rutas_solicitar','viajes_estatus_torre','tarifas_opl_autorizar'],
  TORRE:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver',...FACT_TODO,...ADMIN_TODO,...FINANZAS_TODO,...TARIFAS_TODO,'tarifas_ver',...RUTAS_ADM,'rutas_solicitar']
};
/* Permisos que no se pueden quitar (evita bloquearse a sí misma) */
const SIEMPRE={ADMIN:['permisos_gestionar','usuarios_gestionar','auditoria_ver']};
const VIEW_PERM={proyectos:'tablero_ver',todos:'viajes_ver_todos',torre:'viajes_ver_todos',liquidaciones:'liq_ver',comercial:'comercial_ver',rutas:'rutas_ver',opl:'finanzas_ver',finanzas:'finanzas_ver',catalogos:'catalogos_ver',modelo:'catalogos_ver',usuarios:'usuarios_gestionar',auditoria:'auditoria_ver',nuevo:'viajes_crear',inicio:'viajes_ver',viajes:'viajes_ver'};
const NAVLBL={proyectos:['Clientes','folder'],todos:['Todos los viajes','list'],torre:['Torre de control','tower'],liquidaciones:['Liquidaciones','receipt'],comercial:['Facturación','dollar'],rutas:['Rutas','truck'],opl:['OPL · Proveedores','truck'],finanzas:['Finanzas','dollar'],nuevo:['Nuevo viaje','plus'],catalogos:['Catálogos','grid'],usuarios:['Usuarios y permisos','users'],auditoria:['Auditoría','shield'],modelo:['Modelo de datos','db'],inicio:['Inicio','home'],viajes:['Viajes','truck']};
"""

new_text = re.sub(r'(const PERMS=\[.*?)(const DATA_KEYS=.*?\n)', new_block + r'\n\2', text, flags=re.DOTALL)
with open(r"C:\Users\manue\Master-App\js\engine.js", "w", encoding="utf-8") as f:
    f.write(new_text)

print("Roles reemplazados correctamente via script")
