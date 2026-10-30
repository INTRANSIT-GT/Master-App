/* permisos.js · permisos, roles, navegación y campos base del motor. */
/* ---------- Permisos ---------- */
const PERMS=[
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
  ['comercial_agrupar','Agrupar viajes y generar los reportes PDF de la agrupación','Comercial'],
  ['comercial_ot','Registrar la OC del cliente (número y evidencia) y pasar a facturación','Comercial'],
  ['oc_ver_combustible','Ver el desglose de combustible en los reportes','Comercial'],
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
  ['tarifa_registrar','Aplicar la tarifa vigente a los viajes','Tarifas'],
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
  ['unidades_asignar','Asignar unidades y pilotos a vehículos','Transporte'],
  ['catalogos_editar','Editar las listas del sistema (tipo de unidad, OPL, tipos)','Consulta'],
  ['pilotos_gestionar','Administrar pilotos y sus documentos (licencia, salud, antecedentes)','Flotas']
];
const PERM_KEYS=PERMS.map(p=>p[0]);
/* Listas del sistema: viven en master.catalogos (Supabase) y se editan desde la pantalla Catálogos. */
const LISTAS_SISTEMA=['tipoUnidad','opl','tipoCarga','tipoViaje','tipoLicencia'];   /* arrastre viene de Fleetio y es solo lectura. */
const LISTAS_ETIQUETA={tipoUnidad:'Tipo de unidad',opl:'OPL · Transportistas',tipoCarga:'Tipo de carga',tipoViaje:'Tipo de viaje',arrastre:'Equipos de arrastre (placas)',tipoLicencia:'Tipo de licencia'};
/* Orígenes y destinos: se escriben en la ruta y quedan ligados a su cliente por la propia ruta.
   No hay catálogo; aquí solo se juntan los que ya se usaron para ofrecerlos como sugerencia. */
function refrescarSugerencias(){
  ORIGENES.length=0;DESTINOS.length=0;
  const vo=new Set(),vd=new Set();
  const add=(arr,set,cliente,nombre)=>{const n=String(nombre||'').trim();if(!n)return;
    const k=String(cliente||'')+'\u0001'+n.toLowerCase();if(set.has(k))return;set.add(k);
    arr.push({id:n,nombre:n,proyecto:cliente});};
  (DB.rutas||[]).forEach(r=>{add(ORIGENES,vo,r.cliente,r.origen);add(DESTINOS,vd,r.cliente,r.destino);});
  (DB.trips||[]).forEach(t=>{add(ORIGENES,vo,t.proyecto,t.origen);add(DESTINOS,vd,t.proyecto,t.destino);});
  const ord=(a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es');
  ORIGENES.sort(ord);DESTINOS.sort(ord);
}
const ROLES={
  ADMIN:{label:'ADMIN',home:'inicio',nav:['inicio','proyectos','todos','viajes','nuevo','torre','analista','factcom','tarifas','rutas','opl','finanzas','catalogos','usuarios','auditoria','modelo'],alcance:'Permisos completos en todos los módulos'},
  GERENTE_TRANSPORTE:{label:'Gerente de Transporte',home:'inicio',nav:['inicio','nuevo','todos','viajes','rutas','opl','finanzas','catalogos'],alcance:'Ver todo y registrar viajes; asignar unidades/pilotos y autorizar/crear tarifas OPL; control financiero en modo consulta'},
  VALIDADOR:{label:'Validador',home:'viajes',nav:['viajes'],alcance:'Revisar/aprobar liquidaciones de clientes asignados'},
  OPERATIVO:{label:'Operativo',home:'inicio',nav:['inicio','nuevo','viajes','rutas'],alcance:'Registrar, editar y liquidar viajes de clientes asignados. Ve y solicita rutas de su proyecto.'},
  ANALISTA_COMERCIAL:{label:'Asistente Comercial',home:'analista',nav:['proyectos','analista','tarifas','rutas'],alcance:'Agrupar viajes, generar el reporte para el cliente y registrar la OC; administrar clientes y tarifas con auditoría obligatoria'},
  GERENTE_COMERCIAL:{label:'Gerencia Comercial',home:'inicio',nav:['inicio','proyectos','analista','factcom','tarifas','rutas','opl','finanzas','catalogos'],alcance:'Aprobar rutas, administrar clientes/tarifas, autorizar OPL'},
  FACTURACION:{label:'Facturación',home:'factcom',nav:['todos','factcom','tarifas'],alcance:'Recibir agrupaciones con OC, registrar número y fecha de factura, subir la foto de la factura y validar el cobro; consulta de tarifas'},
  PAGO_OPL:{label:'Pago OPL',home:'opl',nav:['opl'],alcance:'Registrar OPL y tarifas a proveedores (requieren autorización)'},
  TORRE:{label:'Torre de control',home:'torre',nav:['torre'],alcance:'Editar horas y marcar Completado para viajes en ruta'},
  PROYECTOS:{label:'Proyectos',home:'inicio',nav:['inicio','proyectos','todos','viajes','nuevo','torre','analista','factcom','tarifas','rutas','opl','finanzas','catalogos','auditoria','modelo'],alcance:'Revisar todos los módulos y datos. Las acciones las habilita la administradora según se necesiten.'}
};
/* Ayuda es para todos los perfiles: no es un módulo restringido ni requiere un permiso de la matriz. */
Object.values(ROLES).forEach(r=>{if(!r.nav.includes('ayuda'))r.nav.push('ayuda');});
const PERM_DEFAULT={
  ADMIN:PERM_KEYS.slice(),
  GERENTE_TRANSPORTE:['viajes_ver','viajes_ver_todos','viajes_crear','viajes_editar_datos','pilotos_gestionar','catalogos_ver','historial_ver','liq_ver','rutas_ver','rutas_validar','rutas_aprobar_transporte','viajes_aprobar_duplicado','unidades_asignar','tarifas_opl_ver','tarifas_opl_crear','viajes_editar_estado','tarifas_ver','finanzas_ver','liq_aprobar','liq_devolver'],
  VALIDADOR:['viajes_ver','liq_ver','liq_aprobar','liq_devolver','historial_ver'],
  OPERATIVO:['viajes_ver','viajes_crear','viajes_editar_datos','viajes_editar_tiempos','viajes_iniciar','viajes_finalizar','liq_ver','liq_enviar','historial_ver','rutas_ver','rutas_solicitar'],
  ANALISTA_COMERCIAL:['comercial_ver','tarifas_ver','tarifas_crear','tarifas_editar','tarifas_desactivar','tarifa_registrar','rutas_ver','rutas_solicitar','rutas_validar','historial_ver','clientes_gestionar','comercial_agrupar','comercial_ot','oc_ver_combustible'],
  GERENTE_COMERCIAL:['viajes_ver_todos','historial_ver','comercial_ver','tarifas_ver','tarifas_crear','tarifas_editar','tarifas_desactivar','tarifa_registrar','rutas_ver','rutas_validar','rutas_aprobar_comercial','clientes_gestionar','tarifas_opl_ver','tarifas_opl_autorizar','comercial_agrupar','comercial_ot','oc_ver_combustible'],
  FACTURACION:['viajes_ver_todos','comercial_ver','facturas_emitir','cobros_registrar','tarifas_ver'],
  PAGO_OPL:['finanzas_ver','tarifas_opl_ver','tarifas_opl_crear'],
  TORRE:['viajes_ver_todos','viajes_estatus_torre','viajes_editar_tiempos'],
  PROYECTOS:['viajes_ver','viajes_ver_todos','historial_ver','tablero_ver','liq_ver','comercial_ver','rutas_ver','finanzas_ver','catalogos_ver','auditoria_ver','tarifas_ver','tarifas_opl_ver','clientes_gestionar']
};
/* Separación de funciones: permisos que NUNCA se pueden conceder a un rol, ni siquiera desde la matriz. */
const OPERATIVOS=['viajes_crear','viajes_editar_datos','viajes_iniciar','viajes_finalizar','liq_enviar'];
const FINANZAS_TODO=['finanzas_ver','tarifa_registrar','costos_registrar','cobros_registrar','pagos_registrar'];
const FACT_TODO=['comercial_agrupar','comercial_ot','comercial_corregir','comercial_anular','facturas_emitir','cobros_registrar'];
const ADMIN_TODO=['usuarios_gestionar','permisos_gestionar','clientes_gestionar','auditoria_ver'];
const TARIFAS_TODO=['tarifas_crear','tarifas_editar','tarifas_desactivar','tarifa_registrar'];
const RUTAS_ADM=['rutas_gestionar','rutas_validar','rutas_aprobar_comercial','rutas_aprobar_transporte'];
const OC_ESCRIBE=['oc_ver_combustible'];
const OC_TODO=['oc_ver_combustible',...OC_ESCRIBE];
const PROHIBIDO={
  ADMIN:[],
  GERENTE_TRANSPORTE:['permisos_gestionar','usuarios_gestionar','clientes_gestionar','liq_aprobar','liq_devolver','tarifas_crear','tarifas_editar','tarifas_desactivar','rutas_aprobar_comercial',...OC_ESCRIBE],
  VALIDADOR:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado',...FACT_TODO,...ADMIN_TODO,...FINANZAS_TODO,...TARIFAS_TODO,'tarifas_ver',...RUTAS_ADM,'rutas_solicitar','viajes_estatus_torre',...OC_TODO],
  OPERATIVO:['liq_aprobar','liq_devolver','viajes_editar_estado',...FACT_TODO,...ADMIN_TODO,...FINANZAS_TODO,...TARIFAS_TODO,'tarifas_ver',...RUTAS_ADM,'viajes_estatus_torre',...OC_TODO],
  ANALISTA_COMERCIAL:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver','usuarios_gestionar','permisos_gestionar','auditoria_ver','finanzas_ver','costos_registrar','cobros_registrar','pagos_registrar','viajes_estatus_torre','rutas_gestionar'],
  GERENTE_COMERCIAL:['permisos_gestionar','usuarios_gestionar','liq_aprobar','liq_devolver','viajes_aprobar_duplicado','rutas_aprobar_transporte','viajes_editar_estado'],
  FACTURACION:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver',...ADMIN_TODO,'costos_registrar','pagos_registrar','viajes_estatus_torre','rutas_gestionar','tarifas_crear','tarifas_editar','tarifas_desactivar',...OC_ESCRIBE,'comercial_ot','comercial_agrupar'],
  PAGO_OPL:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver',...FACT_TODO,...ADMIN_TODO,...TARIFAS_TODO,'tarifas_ver',...RUTAS_ADM,'rutas_solicitar','viajes_estatus_torre','tarifas_opl_autorizar',...OC_TODO],
  /* Torre nunca ve importes: además de finanzas/tarifas, se le niega todo permiso que abra datos monetarios (facturación, tarifas OPL, tablero, gastos de flota) aunque se habilite en la matriz */
  TORRE:[...OPERATIVOS,'viajes_editar_estado','liq_aprobar','liq_devolver',...FACT_TODO,...ADMIN_TODO,...FINANZAS_TODO,...TARIFAS_TODO,'tarifas_ver',...RUTAS_ADM,'rutas_solicitar','comercial_ver','tarifas_opl_ver','tarifas_opl_crear','tarifas_opl_autorizar','tablero_ver','catalogos_ver',...OC_TODO],
  PROYECTOS:['usuarios_gestionar','permisos_gestionar',...OC_ESCRIBE],
};
/* Permisos que no se pueden quitar (evita bloquearse a sí misma) */
const SIEMPRE={ADMIN:['permisos_gestionar','usuarios_gestionar','auditoria_ver']};
['GERENTE_TRANSPORTE','FACTURACION','PROYECTOS'].forEach(r=>{if(!PROHIBIDO[r].includes('comercial_ot'))PROHIBIDO[r].push('comercial_ot');});
const VIEW_PERM={tarifas:'tarifas_ver',proyectos:'clientes_gestionar',todos:'viajes_ver_todos',torre:'viajes_ver_todos',comercial:'comercial_ver',analista:'comercial_ver',factcom:'comercial_ver',rutas:'rutas_ver',opl:'tarifas_opl_ver',finanzas:'finanzas_ver',catalogos:'catalogos_ver',modelo:'catalogos_ver',usuarios:'usuarios_gestionar',auditoria:'auditoria_ver',nuevo:'viajes_crear',inicio:'viajes_ver',viajes:'viajes_ver'};
/* Accesos por módulo y sección. La matriz manda sobre el menú: cada pantalla (sección) tiene su
   propio permiso «sec_<pantalla>», y el módulo es el grupo del menú que las agrupa.
   El permiso de acción que ya existía se conserva como regla de separación de funciones. */
const SECCIONES=[
  ['inicio','Inicio','viajes_ver','VIAJES'],
  ['nuevo','Nuevo viaje','viajes_crear','VIAJES'],
  ['viajes','Viajes y liquidaciones','viajes_ver','VIAJES'],
  ['todos','Todos los viajes','viajes_ver_todos','VIAJES'],
  ['torre','Torre de control','viajes_ver_todos','TORRE'],
  ['analista','Asistente Comercial','comercial_ver','COMERCIAL'],
  ['factcom','Facturación','comercial_ver','COMERCIAL'],
  ['proyectos','Clientes','clientes_gestionar','COMERCIAL'],
  ['tarifas','Tarifas','tarifas_ver','COMERCIAL'],
  ['finanzas','Finanzas','finanzas_ver','COMERCIAL'],
  ['catalogos','Catálogos','catalogos_ver','COMERCIAL'],
  ['opl','OPL · Proveedores','tarifas_opl_ver','OPL'],
  ['rutas','Rutas','rutas_ver','ADMINISTRACIÓN'],
  ['usuarios','Usuarios y permisos','usuarios_gestionar','ADMINISTRACIÓN'],
  ['auditoria','Auditoría','auditoria_ver','ADMINISTRACIÓN'],
  ['modelo','Modelo de datos','catalogos_ver','ADMINISTRACIÓN'],
  ['ayuda','Ayuda',null,'AYUDA']
];
const MODULOS_SEC=[['VIAJES',['inicio','nuevo','viajes','todos']],['TORRE',['torre']],['COMERCIAL',['analista','factcom','proyectos','tarifas','finanzas','catalogos']],['OPL',['opl']],['FLOTAS',['catalogos']],['ADMINISTRACIÓN',['rutas','usuarios','auditoria','modelo']],['AYUDA',['ayuda']]];
const SEC_DE={};SECCIONES.forEach(x=>{SEC_DE[x[0]]={l:x[1],base:x[2],mod:x[3],perm:'sec_'+x[0]};});
const NAVLBL={tarifas:['Tarifas','dollar'],proyectos:['Clientes','folder'],todos:['Todos los viajes','list'],torre:['Torre de control','tower'],comercial:['Facturación (histórico)','dollar'],analista:['Asistente Comercial','list'],factcom:['Facturación','receipt'],rutas:['Rutas','truck'],opl:['OPL · Proveedores','truck'],finanzas:['Finanzas','dollar'],nuevo:['Nuevo viaje','plus'],catalogos:['Catálogos','grid'],usuarios:['Usuarios y permisos','users'],auditoria:['Auditoría','shield'],modelo:['Modelo de datos','db'],inicio:['Inicio','home'],viajes:['Viajes','truck'],ayuda:['Ayuda','help']};
/* ---------- Ayuda: reportes de fallas (todos los perfiles pueden reportar; solo el Administrador gestiona) ---------- */
const AYUDA_TIPOS=['No puedo guardar información','No puedo ingresar a una sección','Error en un formulario','La información no aparece o no se actualiza','Problema con un botón o una función','Otro'];
const AYUDA_ESTADOS={PENDIENTE:'Pendiente',EN_REVISION:'En revisión',RESUELTO:'Resuelto'};
const AYUDA_NO_SE='No estoy seguro';
/* Quienes ATIENDEN los reportes (ven todos y cambian su estado) y reciben el aviso: el Administrador y el perfil «Proyectos»
   (identificador interno PROYECTOS, el mismo de perfiles.rol). Solo rige en Ayuda: no concede ningún otro permiso. */
const AYUDA_GESTORES=['ADMIN','PROYECTOS'];
/* «Módulo afectado»: solo los módulos que el perfil tiene autorizados, con la MISMA regla que el menú (ROLES[rol].nav + VIEW_PERM +
   permisos de la matriz) y los nombres visibles de NAVLBL. Es una ayuda para reportar; no sustituye los controles de seguridad. */
const ayudaModulosDe=A=>{
  const nav=(A&&ROLES[A.rol]&&ROLES[A.rol].nav)||[];
  const L=nav.filter(v=>v!=='ayuda'&&NAVLBL[v]&&(!VIEW_PERM[v]||hasPerm(A,VIEW_PERM[v]))).map(v=>NAVLBL[v][0]);
  return [...new Set(L)].concat(AYUDA_NO_SE);
};

const DATA_KEYS=['estado','proyectoCat','shipment','noViaje','opl','tipoViaje','tipoCarga','noCarga','producto','pilotoId','unidadId','rutaId','placaArrastre','noDocRetorno','qViaticos','gastosAdicionales'];
const TIEMPO_KEYS=['fechaPlan',...TKEYS];
const TIEMPO_DV_KEYS=[...TIEMPO_KEYS,...DVKEYS];   /* + horarios de descarga del desvío (solo viajes con Desvío) */
/* «Fecha y hora de salida» (tSalida) ya no es un horario visible ni editable. El dato histórico se conserva tal cual y el sistema sigue
   anotándolo solo al iniciar el viaje; aquí solo se mantiene su formato y su nombre en la bitácora. */
const TIEMPO_AUD=[...TIEMPO_DV_KEYS,'tSalida'];
LBL.tSalida='Fecha y hora de salida';
/* Para marcar Entregado se exigen los mismos horarios de siempre; la salida de bodega ocurre después de la descarga y es opcional. */
const TKEYS_ENTREGA=TKEYS.filter(k=>k!=='tSalidaBodega');
const DATA_EDIT_STATES=['PLANIFICADO','EN_RUTA','ENTREGADO','RECHAZADO'];
/* Estados que se pueden corregir a mano (con el permiso viajes_editar_estado). Los demás los genera el flujo:
   LIQUIDADO (liquidación enviada), RECHAZADO (liquidación devuelta), ACEPTADO (liquidación aprobada),
   FACTURADO y COBRADO (Comercial). Nunca se puede saltar un paso: la transición debe existir en EDGES. */
const ESTADOS_MANUALES=['EN_RUTA','ENTREGADO'];
Object.assign(LBL,{shipment:'No. de Transporte',placaArrastre:'Placa del equipo de arrastre',rutaId:'Ruta',rutaRef:'Referencia de la ruta pendiente',origen:'Origen',destino:'Destino',unidadId:'Unidad',numeroFactura:'Número de factura',tarifaCliente:'Tarifa cliente',costoProveedor:'Costo proveedor',qViaticos:'Q viáticos',gastosAdicionales:'Gastos adicionales',noCarga:'Cantidad de carga'});
const MONEY_LBL=['Tarifa cliente','Costo proveedor','Q viáticos','Gastos adicionales'];
