/* ARCHIVO GENERADO por scripts/build-core.mjs a partir de js/engine.js — NO editar a mano. */
export function createEngine(){

/* Zona horaria de Guatemala (UTC-6, sin horario de verano): las horas guardadas por el motor son "hora local de Guatemala". */
const pad=n=>String(n).padStart(2,'0');
const _sh=d=>new Date(d.getTime()-6*3600*1000);
const dstr=d=>{const x=_sh(d);return x.getUTCFullYear()+'-'+pad(x.getUTCMonth()+1)+'-'+pad(x.getUTCDate());};
const toLocal=d=>{const x=_sh(d);return dstr(d)+'T'+pad(x.getUTCHours())+':'+pad(x.getUTCMinutes());};
const fmtDate=s=>{if(!s)return'—';const [y,m,d]=s.split('-');return `${d}/${m}/${y}`;};
const fmtL=v=>v?`${fmtDate(v.slice(0,10))} ${v.slice(11,16)}`:'—';
const CAMPOS_TIEMPO=[['tIngresoPlanta','Ingreso a planta'],['tEsperaRampa','Espera en rampa'],['tRampa','Ingreso a rampa'],['tInicioCarga','Inicio de carga'],['tFinCarga','Fin de carga'],['tSalidaPlanta','Salida de planta'],['tIngresoBodega','Ingreso a bodega'],['tInicioDescarga','Inicio de descarga'],['tFinDescarga','Fin de descarga'],['tSalidaBodega','Salida de bodega']];
const TKEYS=CAMPOS_TIEMPO.map(x=>x[0]);
const LBL={proyectoCat:'Proyecto',shipment:'Shipment',noViaje:'No. de viaje',opl:'OPL',tipoViaje:'Tipo de viaje',tipoCarga:'Tipo de carga',noCarga:'Cantidad de carga',producto:'Producto',fechaPlan:'Fecha plan',pilotoId:'Piloto',origen:'Origen',destino:'Destino',noDocRetorno:'No. doc retorno',qViaticos:'Q viáticos'};
CAMPOS_TIEMPO.forEach(([k,l])=>LBL[k]=l);
const CAMPOS_TIEMPO_DESVIO=[['dvIngresoBodega','Ingreso a bodega (desvío)'],['dvInicioDescarga','Inicio de descarga (desvío)'],['dvFinDescarga','Fin de descarga (desvío)']];
const DVKEYS=CAMPOS_TIEMPO_DESVIO.map(x=>x[0]);
CAMPOS_TIEMPO_DESVIO.forEach(([k,l])=>LBL[k]=l);
const CAT={
  clientes:[],      /* se arma con los clientes reales */
  proyectos:[],     /* se arma con los proyectos reales */
  tipoUnidad:[],
  opl:[],
  tipoCarga:[],
  tipoViaje:[],
  tipoLicencia:[],
  origen:[]
};

const FLOTA=[],PILOTOS=[],DESTINOS=[];   /* los carga el servidor desde las tablas flota, pilotos y destinos */
const ORIGENES=[];
function save(){return true;}            /* la persistencia la hace store.mjs dentro de una transacción */
function rollback(){}

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
const LISTAS_SISTEMA=['tipoUnidad','opl','tipoCarga','tipoViaje','arrastre','tipoLicencia'];
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

/* =====================================================================
   MOTOR DE DATOS Y REGLAS  ("capa confiable" del prototipo)
   ---------------------------------------------------------------------
   Toda escritura pasa por API.*: cada función comprueba la identidad del
   actor, sus permisos, su alcance por cliente, la transición de estado y
   los campos editables, y escribe una bitácora de solo-agregar con cadena
   de huellas (hash). La interfaz NUNCA modifica los datos directamente.

   LIMITACIÓN IMPORTANTE: en este archivo HTML esa "capa confiable" corre
   en el navegador y los datos viven en localStorage. Eso sirve para probar
   el flujo, pero NO es seguro para producción: quien abra las herramientas
   del navegador puede alterar datos o llamar funciones. Para producción,
   estas mismas reglas deben ejecutarse del lado del servidor
   (Power Apps + Dataverse/SharePoint con roles, Power Automate, Apps Script
   u otro backend con control de acceso real). Ver INFORME-master-app.md.
   ===================================================================== */
const DB_VERSION=8;
/* Ganchos del entorno (el servidor los reemplaza): verificación de archivos en el almacenamiento protegido */
const ENV={storageExists:()=>false,soloAlmacenamiento:false};   /* soloAlmacenamiento: el servidor no guarda archivos dentro de la base, solo rutas del bucket privado */
let DB=null,PROYECTOS=[],PROYECTOS_X={},PREF={phone:false,arch:false,tema:''},CLOCK=null;
class ApiError extends Error{constructor(code,msg){super(msg);this.code=code;this.name='ApiError';}}
const nowIso=()=>CLOCK?CLOCK():new Date().toISOString();
const nowLoc=()=>toLocal(new Date(nowIso()));
const fnv=str=>{let h=0x811c9dc5;for(let i=0;i<str.length;i++){h^=str.charCodeAt(i);h=Math.imul(h,0x01000193);}return (h>>>0).toString(16).padStart(8,'0');};

/* Las listas del sistema y los catálogos (unidades, pilotos, destinos) vienen de Supabase:
   ver master.catalogos y la tabla de cada catálogo. Aquí no se inventan datos. */

/* ---------- Estados y transiciones ---------- */
const ESTADOS={
  PLANIFICADO:{l:'Planificado',c:'#8C9BAB'},
  EN_RUTA:{l:'En ruta',c:'#0088FF'},
  ENTREGADO:{l:'Entregado',c:'#00B8D9'},
  LIQUIDADO:{l:'Liquidado',c:'#00875A'},
  ACEPTADO:{l:'Aceptado',c:'#36B37E'},
  RECHAZADO:{l:'Rechazado',c:'#FF5630'},
  FACTURADO:{l:'Facturado',c:'#038F77'},
  COBRADO:{l:'Cobrado',c:'#053B2C'}
};
/* Todo lo que ya terminó su recorrido */
const FIN=['ENTREGADO','LIQUIDADO','ACEPTADO','RECHAZADO','FACTURADO','COBRADO'];
const LIQ_APROBADA=['ACEPTADO','FACTURADO','COBRADO'];
/* Aristas válidas del grafo de estados. moveEstado() es el ÚNICO lugar donde se asigna t.estado. */
const EDGES={
  PLANIFICADO:['EN_RUTA'],
  EN_RUTA:['ENTREGADO'],
  ENTREGADO:['LIQUIDADO'],
  LIQUIDADO:['ACEPTADO','RECHAZADO'],
  RECHAZADO:['LIQUIDADO'],
  ACEPTADO:['FACTURADO'],
  FACTURADO:['COBRADO','ACEPTADO']   /* COBRADO al cobrar; ACEPTADO solo al anular la factura (revierte la asignación) */
};

/* ---------- Base de datos ---------- */
const blankDB=()=>({v:DB_VERSION,usuarios:[],acceso:[],permisos:[],clientes:[],pilotos:[],trips:[],liquidaciones:[],evidencias:[],agrupaciones:[],audit:[],pagos:[],ordenesPago:[],ordenesCompra:[],rutas:[],tarifas:[],mem:[],notificaciones:[],reportesAyuda:[],config:{},catalogosListas:{},conteosUnidadDia:{},seq:{trip:112,liq:1,evi:1,agr:1,evt:1,usr:8,cob:1,pag:1,op:1,rut:1,tar:1,not:1,ayu:1,pil:0,oc:1}});
/* ---------- Pilotos: documentos y vigencia (licencia, salud, penales, policíacos) ---------- */
const DOC_PILOTO=[['licenciaVence','Licencia'],['saludVence','Tarjeta de salud'],['penalesVence','Antecedentes penales'],['policiacosVence','Antecedentes policíacos']];
const DOC_DIAS_AVISO=30;
const DOC_ESTADO_LBL={VIGENTE:'Al día',POR_VENCER:'Por vencer',VENCIDO:'Vencido',FALTA:'Falta'};
function fechaReal(f){
  const t=String(f||'').slice(0,10);
  if(!RX_D.test(t))return false;
  const d=new Date(t+'T00:00:00'); if(isNaN(d.getTime()))return false;
  return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')===t;
}
function diasParaFecha(fecha){
  const f=String(fecha||'').slice(0,10);
  if(!fechaReal(f))return null;
  const d=Date.parse(f+'T00:00:00'); if(isNaN(d))return null;
  const h=new Date(), hoy=Date.parse(h.getFullYear()+'-'+String(h.getMonth()+1).padStart(2,'0')+'-'+String(h.getDate()).padStart(2,'0')+'T00:00:00');
  return Math.round((d-hoy)/86400000);
}
function estadoDocumentos(p){
  const docs=DOC_PILOTO.map(([k,l])=>{const v=String((p&&p[k])||'').slice(0,10),d=diasParaFecha(v);
    return {clave:k,label:l,vence:v,dias:d,estado:d==null?'FALTA':(d<0?'VENCIDO':(d<=DOC_DIAS_AVISO?'POR_VENCER':'VIGENTE'))};});
  const vencidos=docs.filter(x=>x.estado==='VENCIDO'||x.estado==='FALTA'),porVencer=docs.filter(x=>x.estado==='POR_VENCER');
  return {docs,vencidos,porVencer,ok:!vencidos.length&&!porVencer.length,estado:vencidos.length?'VENCIDO':(porVencer.length?'POR_VENCER':'VIGENTE')};
}
/* En el servidor los pilotos viven en DB.pilotos (tabla). PILOTOS es la vista que usan las pantallas. */
function refrescarPilotos(){const l=DB&&DB.pilotos;if(Array.isArray(l)&&l!==PILOTOS){PILOTOS.length=0;for(const p of l)PILOTOS.push(p);}}
function syncRefs(){
  if(DB&&!Array.isArray(DB.pilotos))DB.pilotos=PILOTOS;   /* en el navegador la tabla vive en la misma lista */
  PROYECTOS=DB.clientes.map(c=>({id:c.id,nombre:c.nombre,cliente:c.cliente,activo:c.activo!==false,
    encargado:DB.usuarios.filter(u=>u.rol==='OPERATIVO'&&u.activo&&DB.acceso.some(a=>a.userId===u.id&&a.cliente===c.id)).map(u=>u.nombre).join(', ')||'—'}));
  PROYECTOS_X={};DB.clientes.forEach(c=>{PROYECTOS_X[c.id]=c.proyectos||[];if(!CAT.clientes.includes(c.cliente))CAT.clientes.push(c.cliente);});
  /* El catálogo de proyectos se completa con los proyectos reales que ya existen en los datos:
     así los selectores y la validación no quedan limitados a la lista de ejemplo. */
  DB.clientes.forEach(c=>(c.proyectos||[]).forEach(p=>{if(p&&!CAT.proyectos.includes(p))CAT.proyectos.push(p);}));
  DB.trips.forEach(t=>{if(t.proyectoCat&&!CAT.proyectos.includes(t.proyectoCat))CAT.proyectos.push(t.proyectoCat);});
  /* Las listas del sistema se aplican desde la base: si no hay nada cargado se conserva lo que ya había. */
  const LS=(DB&&DB.catalogosListas)||{};
  LISTAS_SISTEMA.forEach(k=>{if(Array.isArray(LS[k])&&LS[k].length)CAT[k]=LS[k].slice();});
  refrescarSugerencias();
}


/* ---------- Bitácora (solo agregar, con cadena de huellas) ---------- */
function auditAdd(o){
  const A=o.por,prev=DB.audit.length?DB.audit[DB.audit.length-1].hash:'GENESIS';
  const e={id:'EVT-'+String(DB.seq.evt++).padStart(6,'0'),entidad:o.entidad||'VIAJE',viajeId:o.viajeId||'',accion:o.accion,campo:o.campo||'',
    anterior:o.anterior==null?'':String(o.anterior),nuevo:o.nuevo==null?'':String(o.nuevo),porId:A.id,por:A.nombre,rol:A.rol||'',en:nowIso(),motivo:o.motivo||'',ref:o.ref||'',prev};
  e.hash=fnv(prev+'|'+[e.id,e.entidad,e.viajeId,e.accion,e.campo,e.anterior,e.nuevo,e.porId,e.en,e.motivo,e.ref].join('¦'));
  DB.audit.push(e);return e;
}
function rechain(){
  DB.audit.sort((a,b)=>new Date(a.en)-new Date(b.en));
  let prev='GENESIS';
  DB.audit.forEach((e,i)=>{e.id='EVT-'+String(i+1).padStart(6,'0');e.prev=prev;e.hash=fnv(prev+'|'+[e.id,e.entidad,e.viajeId,e.accion,e.campo,e.anterior,e.nuevo,e.porId,e.en,e.motivo,e.ref].join('¦'));prev=e.hash;});
  DB.seq.evt=DB.audit.length+1;
}

/* ---------- Identidad, permisos y alcance ---------- */
function actor(uid){const u=DB&&DB.usuarios.find(x=>x.id===uid);if(!u||!u.activo)throw new ApiError('NO_AUTENTICADO','Usuario no válido o inactivo.');return u;}
function hasPerm(A,p){
  if(!A||!A.activo)return false;
  /* Quien ve TODO el universo de viajes también «ve viajes»: sin esto, un perfil de visibilidad total
     (Gerente de Transporte, Torre, Facturación) no podía abrir Inicio ni Viajes. */
  if(p==='viajes_ver'&&hasPerm(A,'viajes_ver_todos'))return true;
  if((PROHIBIDO[A.rol]||[]).includes(p))return false;
  const r=DB.permisos.find(x=>x.rol===A.rol&&x.permiso===p);
  return !!(r&&r.habilitado);
}
/* Clientes que puede usar el perfil: la administradora y los perfiles con «ver todos los viajes» (Gerente de
   Transporte, Torre, Facturación, Gerencia Comercial) ven todos los clientes activos; el resto, los asignados. */
const clientesAsig=A=>(A.rol==='ADMIN'||hasPerm(A,'viajes_ver_todos'))?DB.clientes.filter(c=>c.activo!==false).map(c=>c.id):DB.acceso.filter(a=>a.userId===A.id).map(a=>a.cliente);
const asignado=(A,t)=>A.rol==='ADMIN'||(DB.acceso.some(a=>a.userId===A.id&&a.cliente===t.proyecto)&&proyectosAsig(A,t.proyecto).includes(t.proyectoCat));
function puedeVer(A,t){
  if(hasPerm(A,'viajes_ver_todos'))return true;
  if(hasPerm(A,'viajes_ver')&&asignado(A,t))return true;
  if(hasPerm(A,'comercial_ver')&&['ACEPTADO','FACTURADO','COBRADO'].includes(t.estado))return true;
  return false;
}
/* Propiedad del viaje: un encargado solo edita los viajes que registró él (o los que no tienen responsable,
   p. ej. creados por la administración). Admin/quién tiene «ver todos» no se ve limitado. */
const esDueno=(A,t)=>{if(!t.creadoPorId)return true;if(t.creadoPorId===A.id)return true;const u=DB.usuarios.find(x=>x.id===t.creadoPorId);return !u||u.rol==='ADMIN';};
const deny=(msg,code)=>{throw new ApiError(code||'DENEGADO',msg);};
function need(A,p,label){if(!hasPerm(A,p))throw new ApiError('SIN_PERMISO',`Tu perfil (${(ROLES[A.rol]||{label:A.rol||'sin rol'}).label}) no puede ${label}.`);}
function getT(id){const t=DB.trips.find(x=>x.id===id);if(!t)throw new ApiError('NO_EXISTE','El viaje no existe.');return t;}
/* Ejecuta una operación: valida actor, guarda si sale bien y registra los rechazos en la bitácora. */
function exec(uid,nombre,viajeId,fn){
  const A=actor(uid);
  try{
    const r=fn(A);
    if(!save()){rollback();throw new ApiError('PERSISTENCIA','No se pudo guardar el cambio en la fuente de datos. No se aplicó: conserva el valor e inténtalo de nuevo.');}
    return r;
  }catch(e){
    if(e instanceof ApiError&&e.code!=='PERSISTENCIA'){auditAdd({entidad:'SEGURIDAD',viajeId:viajeId||'',accion:'ACCION_RECHAZADA',campo:nombre,nuevo:e.code,por:A,motivo:e.message});save();}
    throw e;
  }
}
function moveEstado(t,to,A,accion,motivo,ref){
  const from=t.estado;
  if(!(EDGES[from]||[]).includes(to))throw new ApiError('TRANSICION_INVALIDA',`Transición no permitida: ${ESTADOS[from].l} → ${ESTADOS[to].l}.`);
  t.estado=to;
  auditAdd({entidad:(to==='FACTURADO'||to==='COBRADO')?'AGRUPACION':'VIAJE',viajeId:t.id,accion,campo:'Estado',anterior:ESTADOS[from].l,nuevo:ESTADOS[to].l,por:A,motivo,ref});
}
function setAuto(t,k,nv,A,motivo){
  if(String(t[k]==null?'':t[k])===String(nv))return;
  auditAdd({viajeId:t.id,accion:'Dato actualizado (automático)',campo:LBL[k]||k,anterior:fmtVal(k,t[k]),nuevo:fmtVal(k,nv),por:A,motivo});
  t[k]=nv;
}
function fmtVal(k,v){
  if(v===''||v==null)return '(vacío)';
  if(k==='estado')return (ESTADOS[v]||{}).l||v;
  if(k==='pilotoId')return (PILOTOS.find(p=>p.id===v)||{}).nombre||v;
  if(k==='origen'||k==='destino'||k==='desvioDestino')return String(v);
  if(TIEMPO_AUD.includes(k))return fmtL(v);
  if(k==='gastosAdicionales')return Array.isArray(v)&&v.length?v.map(x=>`${x.concepto}${x.detalle?' ('+x.detalle+')':''}: Q ${x.importe}`).join(' · '):'(vacío)';
  return String(v);
}
const proyectosDe=c=>(DB.clientes.find(x=>x.id===c)||{proyectos:[]}).proyectos;
/* Nota que se guarda en el viaje cuando el piloto elegido no es el asignado a la unidad.
   La unidad sí puede llevar a otro piloto (se elige a mano), pero queda la constancia. */
const NOTA_PILOTO='Piloto no asignado a unidad';
function notaPilotoDe(t){
  const P=PILOTOS.find(p=>p.id===t.pilotoId),U=String(t.unidadId||'');
  if(!P||!U)return '';
  return String(P.unidad||'')===U?'':NOTA_PILOTO;
}
/* Gastos adicionales de un viaje: lista de {concepto, importe}. Las filas totalmente vacías se ignoran; el resto debe estar completo. */
/* «Otro/Otros» exige una justificación (campo «detalle», se guarda dentro del mismo gasto, aparte del concepto). Un gasto «Otro» ya guardado sin detalle, que no cambió, se tolera (viajes anteriores a esta regla). */
const esGastoOtro=c=>/^otros?$/i.test(String(c==null?'':c).trim());
function normGastos(g,prev){
  if(g===''||g==null)return [];
  if(!Array.isArray(g))return {err:'Gastos adicionales: el formato no es válido.'};
  if(g.length>40)return {err:'Gastos adicionales: máximo 40 gastos por viaje.'};
  const out=[];
  for(let i=0;i<g.length;i++){
    const x=g[i]||{},n=i+1,c=String(x.concepto==null?'':x.concepto).trim(),raw=String(x.importe==null?'':x.importe).trim();
    if(!c&&!raw)continue;
    if(!c)return {err:`Gasto adicional ${n}: escribe el concepto (por ejemplo parqueo, alimentación o peaje).`};
    if(c.length>80)return {err:`Gasto adicional ${n}: el concepto admite máximo 80 caracteres.`};
    const det=String(x.detalle==null?'':x.detalle).trim().replace(/\s+/g,' ');
    if(esGastoOtro(c)){if(det.length>200)return {err:`Gasto adicional ${n}: la explicación de «Otros» admite máximo 200 caracteres.`};if(!det&&!(Array.isArray(prev)&&prev.some(p=>p&&String(p.concepto).trim()===c&&Number(p.importe)===Number(raw)&&!String(p.detalle||'').trim())))return {err:'Debe especificar a qué se refiere con “Otros”.'};}
    if(raw==='')return {err:`Gasto adicional ${n} («${c}»): escribe el importe.`};
    const v=Number(raw);
    if(!isFinite(v)||v<=0)return {err:`Gasto adicional ${n} («${c}»): el importe debe ser un número mayor que 0.`};
    if(v>9999999.99)return {err:`Gasto adicional ${n} («${c}»): el importe es demasiado grande.`};
    out.push(esGastoOtro(c)&&det?{concepto:c,importe:Math.round(v*100)/100,detalle:det}:{concepto:c,importe:Math.round(v*100)/100});
  }
  return out;
}
const RX_DT=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
const RX_D=/^\d{4}-\d{2}-\d{2}$/;
function valKey(cliente,k,v){
  const vacio=v===''||v==null;
  switch(k){
    case 'proyectoCat':if(vacio||!proyectosDe(cliente).includes(v))return 'Proyecto no válido para este cliente.';break;
    case 'opl':if(!vacio&&!CAT.opl.includes(v))return 'OPL no válido.';break;
    case 'tipoViaje':if(!vacio&&!CAT.tipoViaje.includes(v))return 'Tipo de viaje no válido.';break;
    case 'tipoCarga':if(!vacio&&!CAT.tipoCarga.includes(v))return 'Tipo de carga no válido.';break;
    case 'gastosAdicionales':{const r=normGastos(v);if(r.err)return r.err;break;}
    case 'noCarga':case 'qViaticos':if(!vacio&&!(isFinite(Number(v))&&Number(v)>=0))return `${LBL[k]}: escribe un número válido (0 o mayor).`;break;
    case 'shipment':case 'noViaje':case 'producto':case 'noDocRetorno':case 'placaArrastre':if(String(v).length>60)return `${LBL[k]}: máximo 60 caracteres.`;break;
    case 'unidadId':{if(!FLOTA.some(f=>f.unidad===v))return 'La unidad no está en la flota.';if(!PILOTOS.some(p=>p.proyecto===cliente&&p.unidad===v))return 'Esa unidad no está asignada a este cliente.';break;}
    case 'pilotoId':{const P=PILOTOS.find(p=>p.id===v);if(!P)return 'Piloto no válido.';if(P.proyecto!==cliente)return 'El piloto no pertenece a este cliente.';break;}
    case 'origen':case 'destino':case 'desvioDestino':
      if(String(v).length>120)return `${LBL[k]||'Lugar'}: máximo 120 caracteres.`;
      break;
    default:if(TIEMPO_DV_KEYS.includes(k)){if(k==='fechaPlan'&&vacio)return 'La fecha plan es obligatoria.';if(!vacio&&!RX_DT.test(v))return `${LBL[k]}: fecha y hora no válidas.`;}
  }
  return '';
}
function valFactura(nf,exceptAgr){
  if(nf.length<3||nf.length>40||!/^[A-Za-z0-9\-_\/\. ]+$/.test(nf))deny('Número de factura no válido (3 a 40 caracteres: letras, números, guion, punto o diagonal).','VALIDACION');
  const dup=DB.agrupaciones.find(a=>a.estado==='ACTIVA'&&a.numeroFactura.toLowerCase()===nf.toLowerCase()&&a.id!==exceptAgr);
  if(dup)deny(`El número de factura ${nf} ya está registrado en la agrupación ${dup.id}. Una factura no puede asignarse a dos agrupaciones.`,'FACTURA_DUPLICADA');
}
function valSerie(s){if(s.length<1||s.length>20||!/^[A-Za-z0-9_-]+$/.test(s))deny('Serie de factura no válida (1 a 20 caracteres: letras, números o guion).','VALIDACION');}
const requerido=(t,ks,paso)=>{const f=ks.filter(k=>t[k]===''||t[k]==null);if(f.length)deny(`No se puede pasar a ${paso}: falta ${f.map(k=>LBL[k]||k).join(', ')}.`,'FALTAN_CAMPOS');};
function duplicadoShipment(t){const s=String(t.shipment||'').trim().replace(/^DUP-/i,'').toLowerCase();return !!s&&DB.trips.some(x=>x.id!==t.id&&String(x.shipment||'').trim().replace(/^DUP-/i,'').toLowerCase()===s);}
function validarLiquidacion(t){
  requerido(t,['shipment','opl','tipoViaje','tipoCarga','noCarga','producto','placaArrastre'],'Liquidado');
  if(!t.pilotoId||!t.unidadId)deny('No se puede pasar a Liquidado: faltan la unidad o el piloto.','FALTAN_CAMPOS');
  if(duplicadoShipment(t)&&!t.duplicadoAprobado)deny('El No. de Transporte (Shipment) está duplicado. Gerencia de Transporte debe aprobarlo antes de liquidar.','SHIPMENT_DUPLICADO');
  if(t.duplicadoAprobado&&(!/^DUP-/i.test(t.shipment)||DB.trips.some(x=>x.id!==t.id&&String(x.shipment||'').toLowerCase()===String(t.shipment||'').toLowerCase())))deny('El Shipment DUP- ya existe o no fue aprobado correctamente; el viaje no puede liquidarse.','SHIPMENT_DUPLICADO');
}
const pad4=n=>String(n).padStart(4,'0');

/* Viajes que ya estaban entregados o rechazados y quedaron sin fecha de entrega (cargas anteriores al
   cambio de flujo: la migración 007 renombró los estados y no llenó `finalizado_en`). El estado ya
   garantiza que el viaje se entregó, así que la fecha se completa —con el paso a Entregado que esté en
   la bitácora y, si no hay, con el momento de la liquidación— en vez de bloquear la liquidación. */
function completarEntrega(t,A){
  if(t.finalizadoEn)return;
  const h=DB.audit.filter(a=>a.viajeId===t.id&&/^Viaje entregado/.test(String(a.accion||''))).map(a=>a.en).sort();
  t.finalizadoEn=h.length?h[h.length-1]:nowIso();
  if(!t.finalizadoPor)t.finalizadoPor=A.nombre;
  auditAdd({viajeId:t.id,accion:'Fecha de entrega completada automáticamente',campo:'Finalizó',anterior:'(vacío)',nuevo:t.finalizadoEn,por:A,motivo:'El viaje estaba entregado sin fecha de entrega; se completa al enviar la liquidación'});
}

/* Los importes solo los ven los roles autorizados (se quitan en la capa de datos, no solo en pantalla). */
function redact(A,t){
  const c=Object.assign({},t);
  if(!hasPerm(A,'finanzas_ver')){delete c.costoProveedor;delete c.precioMem;}
  if(!hasPerm(A,'finanzas_ver')&&!hasPerm(A,'oc_ver_combustible')){delete c.ajusteCombustible;delete c.tarifaBase;}
  if(!hasPerm(A,'tarifas_ver')){delete c.tarifaCliente;delete c.tarifaId;delete c.tarifaAplicadaPor;delete c.tarifaAplicadaEn;}
  if(!hasPerm(A,'finanzas_ver')){delete c.tarifaOpl;delete c.tarifaOplBase;delete c.ajusteOpl;delete c.precioMemOpl;}
  if(!hasPerm(A,'finanzas_ver')&&!hasPerm(A,'viajes_editar_datos')){delete c.qViaticos;delete c.gastosAdicionales;}   /* los gastos adicionales siguen la misma regla que los viáticos */
  return c;
}
const r2=n=>Math.round(n*100)/100;
const nn=v=>(v===''||v==null||!isFinite(Number(v)))?null:Number(v);
const dLoc=iso=>iso?dstr(new Date(iso)):'';
const pagadoDe=(tipo,id)=>r2(DB.pagos.filter(p=>p.tipo===tipo&&p.viajeId===id&&!p.anulado).reduce((s,p)=>s+p.monto,0));
const cobradoDe=g=>r2((g.cobros||[]).reduce((s,x)=>s+x.monto,0));
/* Etapas financieras de una agrupación: enviado a facturar ≠ facturado ≠ cobrado */
/* Estado del proceso comercial que ve el usuario (derivado; no es una fase nueva de la base). */
const PROCESO_L={PREPARADA:'Preparada',REPORTE:'Reporte enviado · espera OC',RECHAZADA:'Rechazada por el cliente',CONFIRMADA:'OC recibida',ENVIADO_A_FACTURAR:'En facturación',FACTURADO:'Factura enviada',COBRO_PARCIAL:'Cobro parcial',COBRADO:'Cobrado',ANULADA:'Anulada'};
function procesoAgr(g){
  const e=etapaAgr(g);if(e!=='PREPARADA')return e;
  const cli=(g.pdfs||[]).filter(p=>p.tipo==='CLIENTE');if(!cli.length)return 'PREPARADA';
  const u=cli[cli.length-1],rz=(g.rechazos||[]);
  return rz.some(x=>x.pdfVersion===u.version)?'RECHAZADA':'REPORTE';
}
const ETAPA_L={PREPARADA:'Preparada',CONFIRMADA:'OC recibida',ENVIADO_A_FACTURAR:'En facturación',FACTURADO:'Factura enviada',COBRO_PARCIAL:'Cobro parcial',COBRADO:'Cobrado',ANULADA:'Anulada'};
function etapaAgr(g){
  if(g.estado==='ANULADA')return 'ANULADA';
  if(g.fase==='PREPARADA')return g.confirmacion?'CONFIRMADA':'PREPARADA';
  if(g.fase==='ENVIADA')return 'ENVIADO_A_FACTURAR';
  const c=cobradoDe(g);
  if(g.importeFacturado==null||g.importeFacturado==='')return c>0?'COBRO_PARCIAL':'FACTURADO';
  if(c<=0)return 'FACTURADO';
  return c>=g.importeFacturado-0.005?'COBRADO':'COBRO_PARCIAL';
}
/* Cálculo financiero PURO. Reglas: cada factura se cuenta una sola vez; un dato faltante nunca se trata como cero. */
function finCalc(trips,agrs,pagos,f){
  f=f||{};
  /* Índices por identificador: antes cada viaje buscaba sus pagos y su agrupación recorriendo las listas
     completas (viajes × pagos, viajes × agrupaciones). Con 7.000 viajes eso son millones de comparaciones y la
     Edge Function se pasaba del límite de CPU (HTTP 546). Con los mapas el resumen queda lineal. */
  const porId=new Map();for(const t of trips)if(t&&!porId.has(t.id))porId.set(t.id,t);
  const tr=id=>porId.get(id);
  /* Una agrupación vieja puede no traer la lista de viajes: sin esta red, un dato así rompía todo el resumen. */
  const vIds=a=>Array.isArray(a&&a.viajeIds)?a.viajeIds:[];
  const pagosDe=new Map();
  for(const p of pagos){if(p.anulado)continue;const k=p.tipo+'|'+p.viajeId;const l=pagosDe.get(k);if(l)l.push(p);else pagosDe.set(k,[p]);}
  const sumaDe=new Map(),ultimoDe=new Map();
  for(const [k,l] of pagosDe){
    let s=0;for(const p of l)s+=p.monto;sumaDe.set(k,r2(s));
    const o=l.slice().sort((a,b)=>a.fecha<b.fecha?-1:1),u=o[o.length-1];
    ultimoDe.set(k,{fecha:u&&u.fecha?u.fecha:'',ref:o.map(x=>x.referencia).join(', ')});
  }
  /* Primera agrupación en curso que incluye el viaje (mismo criterio y mismo orden que el .find() anterior). */
  const agrDe=new Map();
  for(const a of agrs){if(a.estado!=='ACTIVA'||a.fase==='PREPARADA')continue;for(const i of vIds(a))if(!agrDe.has(i))agrDe.set(i,a);}
  const tIn=t=>{const d=(t.fechaPlan||'').slice(0,10);return (!f.desde||d>=f.desde)&&(!f.hasta||d<=f.hasta)&&(!f.cliente||t.proyecto===f.cliente)&&(!f.proyecto||t.proyectoCat===f.proyecto)&&(!f.proveedor||t.opl===f.proveedor);};
  const T=trips.filter(tIn);
  const A=agrs.filter(a=>a.estado==='ACTIVA'&&a.fase!=='PREPARADA'&&(!f.cliente||a.cliente===f.cliente)&&(!f.proyecto||vIds(a).some(i=>(tr(i)||{}).proyectoCat===f.proyecto))&&(!f.desde||dLoc(a.creadoEn)>=f.desde)&&(!f.hasta||dLoc(a.creadoEn)<=f.hasta));
  const pg=(tipo,id)=>sumaDe.get(tipo+'|'+id)||0;
  const lastPg=(tipo,id)=>ultimoDe.get(tipo+'|'+id)||{fecha:'',ref:''};
  const estPago=(ob,pa)=>ob==null?'SIN_IMPORTE':pa<=0?'PENDIENTE':pa<ob-0.005?'PARCIAL':'PAGADO';
  const agrRows=A.map(a=>{
    const cob=cobradoDe(a),fact=a.fase==='EMITIDA'?nn(a.importeFacturado):null;
    return {id:a.id,cliente:a.cliente,nViajes:vIds(a).length,viajes:vIds(a).slice(),enviado:nn(a.importeEnviado),sinImporte:(a.viajesSinImporte||[]).length,fase:a.fase,fechaEnvio:dLoc(a.envio?a.envio.en:a.creadoEn),factura:a.numeroFactura||'',fechaFactura:a.fechaFactura||'',facturado:fact,cobrado:cob,saldo:fact==null?null:r2(fact-cob),etapa:etapaAgr(a),cobros:(a.cobros||[]).slice()};
  });
  const tripRows=T.filter(t=>FIN.includes(t.estado)).map(t=>{
    const costo=nn(t.tarifaOpl)!=null?nn(t.tarifaOpl):nn(t.costoProveedor),via=nn(t.qViaticos),pp=pg('PROVEEDOR',t.id),pl=pg('PILOTO',t.id);
    const ag=agrDe.get(t.id);
    const ingreso=ag?(ag.importesViaje&&ag.importesViaje[t.id]!=null?ag.importesViaje[t.id]:null):nn(t.tarifaCliente);
    const lp=lastPg('PROVEEDOR',t.id),ll=lastPg('PILOTO',t.id);
    return {id:t.id,cliente:t.proyecto,proyecto:t.proyectoCat,periodo:(t.fechaPlan||'').slice(0,7),proveedor:t.opl||'',pilotoId:t.pilotoId,
      costo,pagadoProv:pp,saldoProv:costo==null?null:r2(costo-pp),estadoProv:estPago(costo,pp),fechaProv:lp.fecha,refProv:lp.ref,
      viaticos:via,pagadoPil:pl,saldoPil:via==null?null:r2(via-pl),estadoPil:estPago(via,pl),fechaPil:ll.fecha,refPil:ll.ref,
      ingreso,enAgr:ag?ag.id:''};
  });
  const sum=(arr,fn)=>r2(arr.reduce((s,x)=>s+fn(x),0));
  const M={};
  M.enviado=sum(agrRows,r=>r.enviado||0);M.enviadoIncompleto=agrRows.filter(r=>r.sinImporte>0).length;
  const fa=agrRows.filter(r=>r.fase==='EMITIDA');const faMonto=fa.filter(r=>r.facturado!=null);
  M.facturado=sum(faMonto,r=>r.facturado);M.facturasSinMonto=fa.length-faMonto.length;M.nFacturas=fa.length;
  M.cobrado=sum(agrRows,r=>r.cobrado);
  M.pendCobro=faMonto.length?sum(faMonto,r=>r.saldo):null;
  const cc=tripRows.filter(r=>r.costo!=null);
  M.provSinCosto=tripRows.filter(r=>r.proveedor&&r.costo==null).length;
  M.porPagarProv=cc.length?sum(cc,r=>r.costo):null;M.pagadoProv=sum(tripRows,r=>r.pagadoProv);M.pendProv=cc.length?sum(cc,r=>r.saldoProv):null;
  const vv=tripRows.filter(r=>r.viaticos!=null);
  M.porPagarPil=vv.length?sum(vv,r=>r.viaticos):null;M.pagadoPil=sum(tripRows,r=>r.pagadoPil);M.pendPil=vv.length?sum(vv,r=>r.saldoPil):null;M.pilSinImporte=tripRows.length-vv.length;
  const cK=sum(cc,r=>r.costo),vK=sum(vv,r=>r.viaticos);
  M.costoTotal=(cc.length||vv.length)?r2(cK+vK):null;M.costoIncompletos=tripRows.filter(r=>r.costo==null||r.viaticos==null).length;
  /* margen estimado: solo viajes enviados a facturar con ingreso, costo de proveedor y viáticos registrados */
  const enF=tripRows.filter(r=>r.enAgr);
  const mOK=enF.filter(r=>r.ingreso!=null&&r.costo!=null&&r.viaticos!=null);
  M.margenIngreso=mOK.length?sum(mOK,r=>r.ingreso):null;M.margenCostos=mOK.length?sum(mOK,r=>r.costo+r.viaticos):null;
  M.margenEst=mOK.length?r2(M.margenIngreso-M.margenCostos):null;M.margenPct=mOK.length&&M.margenIngreso?r2(M.margenEst/M.margenIngreso*100):null;
  const margenRows=enF.map(r=>({id:r.id,agr:r.enAgr,ingreso:r.ingreso,costo:r.costo,viaticos:r.viaticos,margen:(r.ingreso!=null&&r.costo!=null&&r.viaticos!=null)?r2(r.ingreso-r.costo-r.viaticos):null,falta:[r.ingreso==null?'tarifa del cliente':'',r.costo==null?'costo de proveedor':'',r.viaticos==null?'viáticos':''].filter(Boolean).join(', ')}));
  M.margenExcluidos=margenRows.filter(r=>r.margen==null).length;
  /* ganancia real: agrupaciones cobradas por completo cuyos viajes tienen todos sus costos registrados */
  const realRows=agrRows.filter(r=>r.etapa==='COBRADO').map(r=>{
    const ts=r.viajes.map(tr),faltan=ts.filter(t=>!t||nn(t.costoProveedor)==null||nn(t.qViaticos)==null).map(t=>t?t.id:'?');
    const costos=faltan.length?null:r2(ts.reduce((s,t)=>s+nn(t.costoProveedor)+nn(t.qViaticos),0));
    return {id:r.id,cobrado:r.cobrado,costos,ganancia:costos==null?null:r2(r.cobrado-costos),falta:faltan.length?'costos de: '+faltan.map(i=>'#'+i).join(', '):''};
  });
  const rOK=realRows.filter(r=>r.ganancia!=null);
  M.gananciaReal=rOK.length?sum(rOK,r=>r.ganancia):null;M.realIncluidas=rOK.length;M.realExcluidas=realRows.length-rOK.length;M.realPendientes=agrRows.filter(r=>r.etapa!=='COBRADO').length;
  return {M,agrRows,tripRows,margenRows,realRows};
}
const pagadoFmt=n=>n;

/* ---------- Ayudas de rutas, tarifas y avisos ---------- */
const capDe=t=>(FLOTA.find(f=>f.unidad===t.unidadId)||{}).capacidad||'';
const capsCat=()=>[...new Set(FLOTA.map(f=>f.capacidad))].sort((a,b)=>parseFloat(a)-parseFloat(b));
/* El origen y el destino ya son el texto que se ve: se devuelve tal cual. */
const nombreOrigen=v=>String(v==null?'':v);
const nombreDestino=v=>String(v==null?'':v);
const rutaNombre=id=>{const r=DB.rutas.find(x=>x.id===id);return r?(r.codigo||r.nombre):id;};
const proyectosAsig=(A,cliente)=>(A.rol==='ADMIN'||!(A.proyectos&&A.proyectos.length))?proyectosDe(cliente):A.proyectos.filter(p=>proyectosDe(cliente).includes(p));
function rutaVisible(A,r){
  if(!hasPerm(A,'rutas_ver'))return false;
  if(A.rol==='ADMIN'||hasPerm(A,'comercial_ver')||hasPerm(A,'tablero_ver')||hasPerm(A,'viajes_ver_todos'))return true;
  return clientesAsig(A).includes(r.cliente)&&proyectosAsig(A,r.cliente).includes(r.proyecto);
}
function activarRutaSiLista(r,A){
  if(!r.aprobacionComercial||!r.aprobacionTransporte)return false;
  if(!DB.tarifas.some(t=>t.rutaId===r.id))return false;
  r.estado='ACTIVA';
  /* Una sola tarifa activa por ruta+capacidad+fecha (uq_tarifa_activa): si hay duplicados
     heredados, se activa la primera y las demás quedan inactivas. */
  const vistos=new Set();
  DB.tarifas.filter(t=>t.rutaId===r.id).forEach(t=>{const k=t.capacidad+'|'+t.vigenteDesde;if(vistos.has(k))return;vistos.add(k);t.activa=true;t.modificadoPor=A.nombre;t.modificadoEn=nowIso();});
  auditAdd({entidad:'RUTA',accion:'Ruta activada',campo:'Estado',anterior:'Pendiente de aprobaciones',nuevo:'ACTIVA',por:A,ref:r.id});
  notificar(A,{tipo:'RUTA_ACTIVA',destinatarios:[],usuarios:[r.solicitadaPorId],asunto:`Ruta activa: ${r.codigo}`,detalle:{ruta:r.nombre,codigo:r.codigo,proyecto:r.proyecto,cliente:r.cliente}});
  return true;
}
function notificar(A,o){
  const n={id:'NOT-'+pad4(DB.seq.not++),tipo:o.tipo,destinatarios:o.destinatarios||[],usuarios:o.usuarios||[],asunto:o.asunto,detalle:o.detalle||{},creadaPor:A.nombre,creadaPorId:A.id,creadaEn:nowIso(),leidaPor:[],canal:'EN_APP',externo:{enviado:false,motivo:'No hay servicio de correo ni mensajería configurado: el aviso solo aparece dentro de la aplicación.'}};
  DB.notificaciones.push(n);
  auditAdd({entidad:'NOTIFICACION',accion:'Notificación generada (solo dentro de la aplicación)',campo:'Destinatarios',nuevo:n.destinatarios.length?n.destinatarios.map(r=>(ROLES[r]||{label:r}).label).join(', '):'usuario solicitante',por:A,ref:`${n.id} · ${o.asunto}`});
  return n;
}
function crearRutaPendiente(A,o){
  const r={id:'R-'+pad4(DB.seq.rut++),codigo:'',nombre:o.nombre,cliente:o.cliente,proyecto:o.proyecto,origen:'',destino:'',estado:'PENDIENTE',origenProp:o.origenProp||'',destinoProp:o.destinoProp||'',fuente:o.fuente,solicitadaPorId:A.id,solicitadaPor:A.nombre,solicitadaEn:nowIso(),validadaPor:'',validadaEn:'',aprobacionComercial:null,aprobacionTransporte:null,rechazo:null,viajeRef:o.viajeRef||'',capacidad:o.capacidad||'',km:o.km==null||o.km===''?null:Number(o.km)};
  DB.rutas.push(r);
  auditAdd({entidad:'RUTA',accion:'Ruta nueva solicitada',campo:'Ruta',nuevo:o.nombre,por:A,ref:`${r.id} · ${o.cliente} · ${o.proyecto}`});
  notificar(A,{tipo:'RUTA_PENDIENTE',destinatarios:['GERENTE_COMERCIAL','GERENTE_TRANSPORTE'],asunto:`Ruta nueva pendiente de validación: ${o.nombre}`,detalle:{proyecto:o.proyecto,cliente:o.cliente,ruta:o.nombre,origen:o.origenProp||'(no indicado)',destino:o.destinoProp||'(no indicado)',capacidad:r.capacidad||'(no indicada)',km:r.km==null?'(no indicados)':`${r.km} km`,solicitadoPor:A.nombre,fecha:r.solicitadaEn,viaje:o.viajeRef||''}});
  return r;
}
/* Código de ruta automático: la sigla del cliente (3 letras) más un correlativo (COL-001, COL-002…).
   Antes había que inventarlo a mano al validar o registrar una ruta, y era fácil repetirlo o dejarlo raro. */
function siguienteCodigoRuta(cliente){
  const c=DB.clientes.find(x=>x.id===cliente)||{};
  let pre=String(c.cliente||c.nombre||'RUTA').toUpperCase().replace(/[^A-Z0-9]/g,'').slice(0,3);
  if(pre.length<3)pre=(pre+'RUT').slice(0,3);
  let n=1;
  DB.rutas.forEach(r=>{const m=new RegExp('^'+pre+'-(\\d{1,4})$').exec(String(r.codigo||''));if(m)n=Math.max(n,Number(m[1])+1);});
  let cod=pre+'-'+String(n).padStart(3,'0');
  while(DB.rutas.some(r=>r.codigo===cod&&r.estado!=='RECHAZADA')){n++;cod=pre+'-'+String(n).padStart(3,'0');}
  return cod;
}
/* Origen y destino son texto libre: se escriben en la ruta y quedan ligados al cliente por la ruta misma. */
function textoLugar(v,campo){
  const t=String(v==null?'':v).trim().replace(/\s+/g,' ');
  if(!t)deny(`Escribe el ${campo} de la ruta.`,'VALIDACION');
  if(t.length>120)deny(`El ${campo} admite máximo 120 caracteres.`,'VALIDACION');
  return t;
}
function capacidadRuta(v){
  const c=String(v==null?'':v).trim();
  if(!c)deny('Selecciona la capacidad de la unidad para esta ruta.','VALIDACION');
  if(!capsCat().includes(c))deny('Capacidad no válida (catálogo de la flota).','VALIDACION');
  return c;
}
function kmRuta(dato){
  const valor=String(dato==null?'':dato).trim();
  if(!valor)deny('Escribe los KM de la ruta.','VALIDACION');
  const n=Number(valor);
  if(!Number.isFinite(n)||n<=0)deny('Los KM de la ruta deben ser mayores que cero.','VALIDACION');
  if(n>100000)deny('Los KM de la ruta no pueden superar 100,000.','VALIDACION');
  return Math.round(n*100)/100;
}
function validarRutaDatos(d){
  const cliente=d.cliente;if(!DB.clientes.find(c=>c.id===cliente))deny('Cliente no válido.','VALIDACION');
  if(!proyectosDe(cliente).includes(d.proyecto))deny('Proyecto no válido para el cliente.','VALIDACION');
  const codigo=String(d.codigo||'').trim().toUpperCase()||siguienteCodigoRuta(cliente);   /* vacío = se asigna solo */
  if(!/^[A-Z0-9][A-Z0-9_-]{2,19}$/.test(codigo))deny('Código de ruta: 3 a 20 caracteres (letras, números, guion).','VALIDACION');
  if(DB.rutas.some(r=>r.id!==d.id&&r.codigo===codigo&&r.estado!=='RECHAZADA'))deny(`El código de ruta ${codigo} ya existe.`,'DUPLICADO');
  const nombre=String(d.nombre||'').trim();if(nombre.length<3)deny('Escribe el nombre de la ruta.','VALIDACION');
  const origen=textoLugar(d.origen,'origen'),destino=textoLugar(d.destino,'destino');
  const igual=(a,b)=>String(a||'').trim().toLowerCase()===String(b||'').trim().toLowerCase();
  if(DB.rutas.some(r=>r.id!==d.id&&r.estado!=='RECHAZADA'&&r.cliente===cliente&&r.proyecto===d.proyecto&&igual(r.origen,origen)&&igual(r.destino,destino)))deny('Ya existe una ruta con ese origen y destino en el proyecto.','DUPLICADO');
  const capacidad=String(d.capacidad==null?'':d.capacidad).trim();
  if(capacidad&&!capsCat().includes(capacidad))deny('Capacidad no válida (catálogo de la flota).','VALIDACION');
  const kmTxt=String(d.km==null?'':d.km).trim();
  let km=null;
  if(kmTxt){const n=Number(kmTxt);if(!Number.isFinite(n)||n<=0||n>100000)deny('Los KM de la ruta deben ser mayores que cero y no superar 100,000.','VALIDACION');km=Math.round(n*100)/100;}
  return {codigo,nombre,cliente,proyecto:d.proyecto,origen,destino,capacidad,km};
}
function rutaOK(cliente,proyecto,rid){
  const r=DB.rutas.find(x=>x.id===rid);
  if(!r)deny('Ruta no válida.','VALIDACION');
  if(r.estado!=='ACTIVA')deny('La ruta elegida aún no está activa: requiere tarifa y las aprobaciones de ambas gerencias.','RUTA_NO_ASIGNADA');
  if(r.cliente!==cliente||r.proyecto!==proyecto)deny('La ruta no corresponde a este cliente y proyecto.','VALIDACION');
  return r;
}
function tarifaPara(t){
  const r=DB.rutas.find(x=>x.id===t.rutaId);
  if(!r||r.estado!=='ACTIVA')return {err:'La ruta no está activa: requiere tarifa y las aprobaciones de ambas gerencias.'};
  const cap=capDe(t),fecha=(t.fechaPlan||'').slice(0,10);
  const c=DB.tarifas.filter(x=>x.activa&&x.cliente===t.proyecto&&x.proyecto===t.proyectoCat&&x.rutaId===t.rutaId&&x.capacidad===cap&&x.vigenteDesde<=fecha&&(!x.vigenteHasta||x.vigenteHasta>=fecha));
  if(!c.length)return {err:`Sin tarifa vigente para ${r.codigo||r.nombre} · ${cap||'capacidad sin dato'} · ${fecha}.`};
  if(c.length>1)return {err:'Hay más de una tarifa vigente para esta combinación: revisa Tarifas.'};
  return {t:c[0]};
}
/* ---------- MEM: precio del diésel y ajuste por combustible ---------- */
/* Precio del diésel del MEM para una fecha: usa la fecha exacta o la más reciente anterior. */
function memPrecioParaFecha(fecha){
  const f=String(fecha||'').slice(0,10);if(!f)return null;
  const rows=(DB.mem||[]).filter(r=>r&&r.fecha&&r.precioDiesel!==''&&r.precioDiesel!=null);
  const exact=rows.find(r=>r.fecha===f);
  if(exact)return {precio:Number(exact.precioDiesel),fecha:exact.fecha,aprox:false};
  const prev=rows.filter(r=>r.fecha<=f).sort((a,b)=>(a.fecha<b.fecha?1:-1))[0];
  return prev?{precio:Number(prev.precioDiesel),fecha:prev.fecha,aprox:true}:null;
}
/* Factor = ((diésel MEM − Q pactado) / Q pactado) · (% de combustible / 100). */
function factorCombustible(qPactado,pct,precio){
  const qp=Number(qPactado);if(!qp)return 0;
  return ((Number(precio)-qp)/qp)*(Number(pct||0)/100);
}
/* Ajuste = factor · importe base; nunca negativo (si el diésel bajó, no se descuenta). */
const ajusteNumerico=(qPactado,pct,base,precio)=>{const m=factorCombustible(qPactado,pct,precio)*Number(base||0);return m>0?r2(m):0;};
const tieneCombustible=tar=>!!(tar&&tar.qDieselPactado!=null&&tar.qDieselPactado!==''&&tar.combustiblePct!=null&&tar.combustiblePct!=='');
/* Desglose del ajuste del CLIENTE que corresponde al viaje con una tarifa dada (base, precio MEM, factor, ajuste, total). */
function ajusteDelViaje(t,tar){
  tar=tar||DB.tarifas.find(x=>x.id===t.tarifaId);
  const base=tar?r2(Number(tar.importe)):nn(t.tarifaCliente);
  if(!tieneCombustible(tar))return {aplica:false,base,precioMem:'',memFecha:'',factor:0,ajuste:0,total:base};
  const mem=memPrecioParaFecha(t.fechaPlan),precio=mem?mem.precio:0;
  const factor=factorCombustible(tar.qDieselPactado,tar.combustiblePct,precio);
  const ajuste=ajusteNumerico(tar.qDieselPactado,tar.combustiblePct,base,precio);
  return {aplica:true,base,precioMem:mem?precio:'',memFecha:mem?mem.fecha:'',factor,ajuste,total:r2(base+ajuste)};
}
/* Desglose del ajuste del PROVEEDOR (OPL). Parámetros propios de combustible del proveedor. */
const tieneCombustibleOpl=tar=>!!(tar&&tar.dieselPactadoOpl!=null&&tar.dieselPactadoOpl!==''&&tar.combustiblePctOpl!=null&&tar.combustiblePctOpl!=='');
function ajusteOplDelViaje(t,tar){
  tar=tar||DB.tarifas.find(x=>x.id===t.tarifaId);
  const base=tar?nn(tar.importeOpl):null;
  if(base==null)return {falta:true,aplica:false,base:null,precioMem:'',memFecha:'',factor:0,ajuste:0,total:null};
  if(!tieneCombustibleOpl(tar))return {falta:false,aplica:false,base:r2(base),precioMem:'',memFecha:'',factor:0,ajuste:0,total:r2(base)};
  const mem=memPrecioParaFecha(t.fechaPlan),precio=mem?mem.precio:0;
  const factor=factorCombustible(tar.dieselPactadoOpl,tar.combustiblePctOpl,precio);
  const ajuste=ajusteNumerico(tar.dieselPactadoOpl,tar.combustiblePctOpl,base,precio);
  return {falta:false,aplica:true,base:r2(base),precioMem:mem?precio:'',memFecha:mem?mem.fecha:'',factor,ajuste,total:r2(base+ajuste)};
}
/* Aplica la tarifa vigente al viaje. El importe del cliente = base + ajuste por combustible (MEM). */
/* Un viaje reservado por una agrupación todavía se puede tarifar si la agrupación está
   preparada, activa, sin reporte y sin OC. Así se corrige una tarifa faltante antes de generar el PDF. */
function tarifaEditable(t){
  if(!t.agrupacionId)return true;
  const g=DB.agrupaciones.find(x=>x.id===t.agrupacionId);
  return !!g&&g.fase==='PREPARADA'&&g.estado==='ACTIVA'&&!g.confirmacion&&!(g.pdfs||[]).length;
}
function aplicarUna(A,t){
  if(t.estado!=='ACEPTADO')return {err:'Solo se aplica tarifa a viajes aceptados que aún no estén facturados.'};
  if(!tarifaEditable(t))return {err:'El viaje ya está en una agrupación con reporte u OC: descarta esa agrupación para cambiar su tarifa.'};
  {const oc=ocDeViaje(t.id);if(oc)return {err:`El viaje está en la orden de compra ${oc.id}: su tarifa ya no se reaplica (los importes de la orden se conservan).`};}
  const r=tarifaPara(t);if(r.err)return r;
  const d=ajusteDelViaje(t,r.t);
  const o=ajusteOplDelViaje(t,r.t);
  /* Si la tarifa no tiene importe de proveedor (OPL), el viaje queda marcado como inválido en Tarifas.
     No se reporta como aplicada: se pide completar la tarifa para no dejar una falsa sensación de éxito. */
  if(o.total==null)return {err:`La tarifa ${r.t.id} no tiene importe de proveedor (OPL): completa la tarifa antes de aplicarla.`};
  const yaFijado=t.tarifaId===r.t.id&&String(t.tarifaCliente)===String(d.total)
    &&String(t.tarifaBase==null?'':t.tarifaBase)===String(d.aplica?d.base:'')
    &&String(t.ajusteCombustible==null?'':t.ajusteCombustible)===String(d.aplica?d.ajuste:'')
    &&String(t.precioMem==null?'':t.precioMem)===String(d.aplica?d.precioMem:'')
    &&String(t.tarifaOpl==null?'':t.tarifaOpl)===String(o.total==null?'':o.total)
    &&String(t.tarifaOplBase==null?'':t.tarifaOplBase)===String(o.aplica?o.base:'')
    &&String(t.ajusteOpl==null?'':t.ajusteOpl)===String(o.aplica?o.ajuste:'')
    &&String(t.precioMemOpl==null?'':t.precioMemOpl)===String(o.aplica?o.precioMem:'');
  if(yaFijado)return {ok:true};
  auditAdd({entidad:'FINANZAS',viajeId:t.id,accion:'Tarifa aplicada',campo:LBL.tarifaCliente,anterior:(t.tarifaCliente===''||t.tarifaCliente==null)?'(vacío)':'Q '+t.tarifaCliente,nuevo:'Q '+d.total,por:A,ref:r.t.id+(d.aplica&&d.ajuste?` (base Q ${d.base} + combustible Q ${d.ajuste})`:'')});
  if(d.aplica){t.tarifaBase=d.base;t.ajusteCombustible=d.ajuste;t.precioMem=d.precioMem;}
  else{delete t.tarifaBase;delete t.ajusteCombustible;delete t.precioMem;}
  t.tarifaCliente=d.total;t.tarifaId=r.t.id;t.tarifaAplicadaPor=A.nombre;t.tarifaAplicadaEn=nowIso();
  /* Tarifa del proveedor (OPL): importe a pagar al proveedor, con su propio ajuste por combustible. */
  if(o.total==null){delete t.tarifaOpl;delete t.tarifaOplBase;delete t.ajusteOpl;delete t.precioMemOpl;}
  else{
    if(o.aplica){t.tarifaOplBase=o.base;t.ajusteOpl=o.ajuste;t.precioMemOpl=o.precioMem;}
    else{delete t.tarifaOplBase;delete t.ajusteOpl;delete t.precioMemOpl;}
    t.tarifaOpl=o.total;
  }
  return {ok:true};
}
function validarTarifa(d,exceptId){
  const cliente=d.cliente,cl=DB.clientes.find(c=>c.id===cliente);if(!cl)deny('Selecciona el cliente.','VALIDACION');
  if(cl.activo===false)deny('El cliente está desactivado.','VALIDACION');
  if(!proyectosDe(cliente).includes(d.proyecto))deny('Proyecto no válido para el cliente.','VALIDACION');
  const r=DB.rutas.find(x=>x.id===d.rutaId);if(!r)deny('Selecciona la ruta.','VALIDACION');
  if(!['EN_TARIFACION','PENDIENTE_APROBACION','ACTIVA'].includes(r.estado))deny('La ruta debe validarse antes de definir una tarifa.','RUTA_NO_ASIGNADA');
  if(r.cliente!==cliente||r.proyecto!==d.proyecto)deny('La ruta no corresponde a ese cliente y proyecto.','VALIDACION');
  if(!capsCat().includes(d.capacidad))deny('Capacidad no válida (catálogo de la flota).','VALIDACION');
  const imp=nn(d.importe);if(imp==null||imp<=0)deny('El importe debe ser mayor a cero.','VALIDACION');
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d.vigenteDesde||''))deny('Falta la fecha de inicio de vigencia.','VALIDACION');
  const h=d.vigenteHasta||'';if(h&&!/^\d{4}-\d{2}-\d{2}$/.test(h))deny('Fecha fin de vigencia no válida.','VALIDACION');
  if(h&&h<d.vigenteDesde)deny('La vigencia termina antes de empezar.','VALIDACION');
  const solape=DB.tarifas.find(x=>x.id!==exceptId&&x.activa&&x.cliente===cliente&&x.proyecto===d.proyecto&&x.rutaId===d.rutaId&&x.capacidad===d.capacidad&&(!h||x.vigenteDesde<=h)&&(!x.vigenteHasta||x.vigenteHasta>=d.vigenteDesde));
  if(solape)deny(`Ya existe una tarifa activa (${solape.id}) para esa combinación con una vigencia que se cruza.`,'TARIFA_DUPLICADA');
  const qd=d.qDieselPactado==null||d.qDieselPactado===''?null:Number(d.qDieselPactado);
  if(qd!=null&&!(isFinite(qd)&&qd>0))deny('Q diésel pactado: escribe un número mayor a cero (o déjalo vacío).','VALIDACION');
  const cp=d.combustiblePct==null||d.combustiblePct===''?null:Number(d.combustiblePct);
  if(cp!=null&&!(isFinite(cp)&&cp>=0&&cp<=100))deny('% de combustible: un número entre 0 y 100 (o déjalo vacío).','VALIDACION');
  const out={cliente,proyecto:d.proyecto,rutaId:d.rutaId,capacidad:d.capacidad,importe:r2(imp),vigenteDesde:d.vigenteDesde,vigenteHasta:h};
  if(qd!=null)out.qDieselPactado=r2(qd);
  if(cp!=null)out.combustiblePct=cp;
  /* Tarifa y combustible del PROVEEDOR (OPL): opcionales, con su propio % y Q pactado. */
  const io=d.importeOpl==null||d.importeOpl===''?null:Number(d.importeOpl);
  if(io!=null&&!(isFinite(io)&&io>0))deny('Importe proveedor (OPL): escribe un número mayor a cero (o déjalo vacío).','VALIDACION');
  const cpo=d.combustiblePctOpl==null||d.combustiblePctOpl===''?null:Number(d.combustiblePctOpl);
  if(cpo!=null&&!(isFinite(cpo)&&cpo>=0&&cpo<=100))deny('% de combustible proveedor: un número entre 0 y 100 (o déjalo vacío).','VALIDACION');
  const dpo=d.dieselPactadoOpl==null||d.dieselPactadoOpl===''?null:Number(d.dieselPactadoOpl);
  if(dpo!=null&&!(isFinite(dpo)&&dpo>0))deny('Q diésel pactado proveedor: escribe un número mayor a cero (o déjalo vacío).','VALIDACION');
  if(io!=null)out.importeOpl=r2(io);
  if(cpo!=null)out.combustiblePctOpl=cpo;
  if(dpo!=null)out.dieselPactadoOpl=r2(dpo);
  return out;
}
/* Datos propios de la factura. La interfaz los valida al capturarlos; el servidor los vuelve a validar al enviar. */
function faltantesFactura(nf,ff,exceptId,serie){
  const f=[],num=String(nf||'').trim(),ser=String(serie||'').trim();
  if(!ser)f.push({campo:'serieFactura',msg:'la serie de factura'});else valSerie(ser);
  if(!num)f.push({campo:'numeroFactura',msg:'el número de factura'});
  else if(DB.agrupaciones.some(a=>a.estado==='ACTIVA'&&a.id!==exceptId&&a.numeroFactura&&a.numeroFactura.toLowerCase()===num.toLowerCase()))f.push({campo:'numeroFactura',msg:'un número de factura que no esté repetido'});
  if(!ff)f.push({campo:'fechaFactura',msg:'la fecha de factura'});
  return f;
}
/* Validación COMPLETA del envío. Vive también en el servidor: ruta, tarifa y aceptación
   no dependen de lo que el navegador tenga cargado (Facturación no recibe el catálogo de rutas). */
function faltantesEnvio(cliente,ids,nf,ff,exceptId,serie){
  const f=faltantesFactura(nf,ff,exceptId,serie);
  if(!ids.length)f.push({campo:'viajes',msg:'al menos un viaje'});
  ids.forEach(id=>{
    const t=DB.trips.find(x=>x.id===id);
    if(!t){f.push({campo:'viaje:'+id,msg:`el viaje ${id} (no existe)`});return;}
    if(t.proyecto!==cliente)f.push({campo:'viaje:'+id,msg:`un solo cliente por factura (viaje ${id})`});
    const r=DB.rutas.find(x=>x.id===t.rutaId);
    if(!r||r.estado!=='ACTIVA')f.push({campo:'viaje:'+id,msg:`ruta activa en el viaje ${id}`});
    else if(!(nn(t.tarifaCliente)>0))f.push({campo:'viaje:'+id,msg:`tarifa válida en el viaje ${id}`});
    if(t.estado!=='ACEPTADO'||!t.liqAprobadaEn)f.push({campo:'viaje:'+id,msg:`aceptación del viaje ${id}`});
  });
  return f;
}

/* =====================================================================
   ÓRDENES DE COMPRA (OC)
   Agrupan viajes aceptados de un cliente y proyecto, con tarifa válida, ANTES de facturar. No sustituyen a
   Facturación: una OC aceptada alimenta el flujo de facturas existente (una factura por OC).
   ===================================================================== */
const OC_ESTADOS={PREPARADA:'Preparada',ENVIADA:'Enviada al cliente',ACEPTADA:'Aceptada',RECHAZADA:'Rechazada',ANULADA:'Anulada',REEMPLAZADA:'Reemplazada por nueva versión'};
/* Estados en los que la OC mantiene «reservados» sus viajes (un viaje no puede estar en dos OC activas).
   Regla: RECHAZADA conserva la reserva hasta que Comercial/Gerencia/Administrador la corrija (nueva versión: la
   OC rechazada pasa a REEMPLAZADA y sus viajes pasan atómicamente a la nueva) o la anule con motivo. REEMPLAZADA y
   ANULADA no reservan: quedan solo como historial. */
const OC_RESERVA=['PREPARADA','ENVIADA','ACEPTADA','RECHAZADA'];
const OC_COL_OBLIG=[['semana','Semana'],['fecha','Fecha planificada'],['hora','Hora planificada'],['shipment','Shipment'],['placa','Placa'],['tipoUnidad','Tipo de unidad'],['estado','Estado'],['tarifa','Tarifa de cobro']];
const OC_COL_OPC={capacidad:'Capacidad',origen:'Origen',ruta:'Ruta',combustible:'Tarifa de combustible',tipoViaje:'Tipo de viaje'};
const OC_TARIFA_MSG='Viaje pendiente de asignación de tarifa';
function ocGuardar(){if(!Array.isArray(DB.ordenesCompra))DB.ordenesCompra=[];if(!DB.seq)DB.seq={};if(!(DB.seq.oc>0))DB.seq.oc=1+DB.ordenesCompra.length;}
/* Semana ISO 8601: el lunes inicia la semana y la semana 1 es la que contiene el primer jueves del año.
   Se calcula SIEMPRE a partir de la fecha planificada (solo la parte AAAA-MM-DD) y nunca la modifica.
   El año ISO puede diferir del año calendario cerca del 1 de enero y del 31 de diciembre. */
function semanaIso(f){
  const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(f||''));
  if(!m)return null;
  const d=new Date(Date.UTC(+m[1],+m[2]-1,+m[3]));
  if(isNaN(d)||d.getUTCMonth()!==+m[2]-1||d.getUTCDate()!==+m[3])return null;
  d.setUTCDate(d.getUTCDate()-((d.getUTCDay()+6)%7)+3);          /* jueves de esa semana */
  const anio=d.getUTCFullYear();
  const e=new Date(Date.UTC(anio,0,4));
  e.setUTCDate(e.getUTCDate()-((e.getUTCDay()+6)%7)+3);          /* jueves de la semana 1 */
  const semana=1+Math.round((d-e)/604800000);
  const n=String(semana).padStart(2,'0');
  return {semana,anio,texto:'Semana '+n,textoAnio:'Semana '+n+' · '+anio};
}
/* Motivo por el que un viaje NO tiene tarifa de cobro válida ('' = válida). La tarifa del cliente ya incluye el
   ajuste por combustible (base + ajuste): nunca se suma otra vez. Sin ceros, sin valores por defecto ni inventados. */
function ocMotivoTarifa(t){
  if(!t)return 'El viaje no existe.';
  const r=DB.rutas.find(x=>x.id===t.rutaId);
  if(!r)return 'El viaje no tiene ruta asignada.';
  if(r.estado!=='ACTIVA')return 'La ruta del viaje no está activa (requiere tarifa y aprobaciones de ambas gerencias).';
  const v=nn(t.tarifaCliente);
  if(v==null)return 'El viaje no tiene tarifa de cobro asignada.';
  if(!(v>0))return 'La tarifa de cobro del viaje no es válida (debe ser mayor a cero).';
  return '';
}
let OC_IGNORAR='';   /* OC que se está reemplazando: sus viajes cuentan como libres solo durante esa validación */
const ocDeViaje=id=>(DB.ordenesCompra||[]).find(o=>o.id!==OC_IGNORAR&&OC_RESERVA.includes(o.estado)&&(o.lineas||[]).some(l=>l.viajeId===id))||null;
const ocClienteNombre=c=>{const x=DB.clientes.find(k=>k.id===c)||{};return x.cliente||x.nombre||c;};
/* Clasificación de un viaje para armar una OC: elegible, pendiente de tarifa, o no disponible (con motivo). */
function ocClasificar(t){
  if(t.estado!=='ACEPTADO'||!t.liqAprobadaEn)return {k:'NO',motivo:'El viaje no está aceptado (su liquidación aún no se aprobó).'};
  if(t.agrupacionId)return {k:'NO',motivo:`El viaje ya está asociado a la factura ${t.agrupacionId}.`};
  const o=ocDeViaje(t.id);
  if(o)return {k:'NO',motivo:`El viaje ya está en la orden de compra ${o.id} (${OC_ESTADOS[o.estado]}).`,ocId:o.id};
  const m=ocMotivoTarifa(t);
  if(m)return {k:'PEND',motivo:m};
  return {k:'OK',motivo:''};
}
function ocLinea(t,full){
  const wk=semanaIso(t.fechaPlan),f=FLOTA.find(x=>x.unidad===t.unidadId)||{},r=DB.rutas.find(x=>x.id===t.rutaId)||{};
  const comb=(t.ajusteCombustible===''||t.ajusteCombustible==null)?null:r2(Number(t.ajusteCombustible));
  return Object.assign({viajeId:t.id,noViaje:t.noViaje||'',semana:wk?wk.semana:null,semanaAnio:wk?wk.anio:null,semanaTxt:wk?wk.texto:'',
    fechaPlan:t.fechaPlan||'',fecha:(t.fechaPlan||'').slice(0,10),hora:(t.fechaPlan||'').slice(11,16),
    shipment:t.shipment||'',placa:f.placa||'',tipoUnidad:f.tipo||'',estado:(ESTADOS[t.estado]||{}).l||t.estado,
    tarifa:r2(nn(t.tarifaCliente)),tarifaId:t.tarifaId||'',
    capacidad:f.capacidad||'',origen:r.origen||'',ruta:r.nombre||'',tipoViaje:t.tipoViaje||''}
  ,full?{combustible:comb,tarifaBase:nn(t.tarifaBase)}:{});
}
/* Columnas y celdas de la OC: la vista previa y el PDF usan EXACTAMENTE estas funciones, así coinciden. */
const ocColumnas=opc=>OC_COL_OBLIG.concat((opc||[]).filter(c=>OC_COL_OPC[c]).map(c=>[c,OC_COL_OPC[c]]));
const ocUsaAnio=ls=>new Set(ls.map(l=>l.semanaAnio)).size>1||ls.some(l=>l.semanaAnio!=null&&String(l.semanaAnio)!==String(l.fecha).slice(0,4));
const ocQ=v=>v==null||v===''?'—':'Q '+Number(v).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g,',');
function ocCelda(l,k,anio){
  switch(k){
    case 'semana':return l.semanaTxt?(anio&&l.semanaAnio?l.semanaTxt+' · '+l.semanaAnio:l.semanaTxt):'—';
    case 'fecha':return l.fecha||'—';
    case 'hora':return l.hora||'—';
    case 'tarifa':return ocQ(l.tarifa);
    case 'combustible':return ocQ(l.combustible);
    default:return l[k]===''||l[k]==null?'—':String(l[k]);
  }
}
/* Arma (sin guardar) la OC: valida cliente/proyecto, acceso, elegibilidad y tarifa de cada viaje. La usan la vista
   previa y la generación, de modo que ambas aplican exactamente la misma regla. */
function ocArmar(A,d){
  ocGuardar();
  d=d||{};
  const cliente=d.cliente,proyecto=d.proyecto;
  if(!DB.clientes.find(c=>c.id===cliente))deny('Selecciona el cliente de la orden de compra.','VALIDACION');
  if(!proyectosDe(cliente).includes(proyecto))deny('Selecciona un proyecto válido del cliente.','VALIDACION');
  const ids=Array.isArray(d.viajeIds)?d.viajeIds.slice():[];
  if(new Set(ids).size!==ids.length)deny('La selección contiene viajes duplicados.','VALIDACION');
  const colsIn=Array.isArray(d.columnas)?d.columnas:[];
  const cols=[];
  colsIn.forEach(c=>{
    if(!OC_COL_OPC[c])deny(`Columna opcional no válida: ${c}.`,'VALIDACION');
    if(c==='combustible'&&!hasPerm(A,'oc_ver_combustible'))deny('Tu perfil no puede incluir la tarifa de combustible en la orden de compra.','SIN_PERMISO');
    if(!cols.includes(c))cols.push(c);
  });
  const lineas=[],pendientes=[],errores=[];
  ids.forEach(id=>{
    const t=DB.trips.find(x=>x.id===id);
    if(!t||!puedeVer(A,t)){errores.push({viajeId:id,motivo:'El viaje no existe o no tienes acceso.'});return;}
    if(t.proyecto!==cliente||t.proyectoCat!==proyecto){errores.push({viajeId:id,motivo:`El viaje pertenece a ${t.proyecto} · ${t.proyectoCat}: una orden de compra es de un solo cliente y proyecto.`});return;}
    const c=ocClasificar(t);
    if(c.k==='NO'){errores.push({viajeId:id,motivo:c.motivo});return;}
    if(c.k==='PEND'){pendientes.push({viajeId:id,mensaje:OC_TARIFA_MSG,noViaje:t.noViaje||t.id,shipment:t.shipment||'',cliente:ocClienteNombre(t.proyecto),proyecto:t.proyectoCat,motivo:c.motivo});return;}
    lineas.push(ocLinea(t,hasPerm(A,'oc_ver_combustible')));
  });
  lineas.sort((a,b)=>(a.fechaPlan<b.fechaPlan?-1:a.fechaPlan>b.fechaPlan?1:a.viajeId<b.viajeId?-1:1));
  const total=r2(lineas.reduce((x,l)=>x+l.tarifa,0));   /* suma de tarifas válidas; el combustible ya va dentro de cada tarifa */
  return {cliente,clienteNombre:ocClienteNombre(cliente),proyecto,columnas:cols,lineas,total,pendientes,errores,ok:!pendientes.length&&!errores.length&&lineas.length>0};
}
/* Crea la OC a partir de un armado válido, reserva sus viajes y audita. Única vía de creación (preparar y corregir). */
function ocCrear(A,r,ex){
  ocGuardar();
  const id='OC-'+pad4(DB.seq.oc++),en=nowIso();
  const o={id,cliente:r.cliente,clienteNombre:r.clienteNombre,proyecto:r.proyecto,estado:'PREPARADA',moneda:'Q',columnas:r.columnas,lineas:r.lineas,total:r.total,
    viajeIds:r.lineas.map(l=>l.viajeId),preparadoPorId:A.id,preparadoPor:A.nombre,preparadoEn:en,documentos:[],envio:null,respuesta:null,anulada:null,agrupacionId:'',
    historial:[{en,por:A.nombre,porId:A.id,accion:ex.reemplazaA?`Nueva versión (v${ex.version}) de ${ex.reemplazaA}: ${ex.motivo}`:'Orden de compra preparada'}]};
  if(ex.reemplazaA){o.reemplazaA=ex.reemplazaA;o.version=ex.version;}
  /* Congela también el ajuste de combustible, pero fuera de las líneas: lo ve solo quien tiene oc_ver_combustible. */
  o.combustible={};
  o.lineas.forEach(l=>{const t0=getT(l.viajeId);o.combustible[l.viajeId]={base:nn(t0.tarifaBase),ajuste:(t0.ajusteCombustible===''||t0.ajusteCombustible==null)?null:r2(Number(t0.ajusteCombustible))};delete l.combustible;delete l.tarifaBase;});
  DB.ordenesCompra.push(o);
  r.lineas.forEach(l=>{const t=getT(l.viajeId);t.ocId=id;auditAdd({entidad:'OC',viajeId:t.id,accion:'Viaje incluido en orden de compra',campo:'Orden de compra',nuevo:id,por:A,ref:`${id} · Q ${l.tarifa}`});});
  auditAdd({entidad:'OC',accion:ex.reemplazaA?'Orden de compra preparada (nueva versión)':'Orden de compra preparada',campo:'Estado',nuevo:'Preparada',por:A,ref:`${id} · ${r.clienteNombre} · ${r.proyecto} · ${r.lineas.length} viaje(s) · Q ${r.total}`});
  return o;
}
/* Movimiento de factura en el historial de la OC de origen (evento distinto de la confirmación del cliente). */
function ocHistFactura(g,A,en,accion){if(!g.ocId)return;const o=(DB.ordenesCompra||[]).find(x=>x.id===g.ocId);if(o)o.historial.push({en,por:A.nombre,porId:A.id,accion});}

/* =====================================================================
   AGRUPACIONES DE COBRO (flujo Comercial → cliente → Facturación → cobro). Se reutiliza la agrupación/factura que ya
   existe (g.fase PREPARADA → ENVIADA → EMITIDA, reserva de viajes, una sola factura por viaje). Se agregan, sin tocar
   Liquidaciones: PDF interno y PDF del cliente por versiones, evidencia de la autorización del cliente, el evento
   la OC del cliente (g.confirmacion; NO es una fase nueva: la base no cambia de restricciones), el comprobante de envío
   de la factura (emisión con archivo) y el historial (g.historial) con el usuario autenticado de cada movimiento.
   ===================================================================== */
const AGR_COL_OBLIG=[['fecha','Fecha'],['noViaje','No. de viaje'],['placa','Placa'],['tipoUnidad','Tipo de unidad'],['estado','Estado'],['tarifa','Tarifa'],['cobro','Cobro']];
const AGR_COL_OPC={capacidad:'Capacidad',ruta:'Ruta',origen:'Origen',combustible:'Tarifa de combustible'};
const AGR_INT_COLS=[['fecha','Fecha'],['noViaje','No. de viaje'],['shipment','Shipment'],['placa','Placa'],['tipoUnidad','Tipo de unidad'],['estado','Estado'],['capacidad','Capacidad'],['ruta','Ruta'],['origen','Origen'],['tarifa','Tarifa'],['combustible','Tarifa de combustible'],['cobro','Cobro']];
function agrHist(g,A,accion,x){if(!Array.isArray(g.historial))g.historial=[];g.historial.push(Object.assign({en:nowIso(),por:A.nombre,porId:A.id,accion},x||{}));}
const agrPorId=id=>{const g=DB.agrupaciones.find(x=>x.id===id);if(!g)deny('La agrupación no existe.','NO_EXISTE');return g;};
const agrEditable=g=>{if(g.estado!=='ACTIVA'||g.fase!=='PREPARADA')deny('La agrupación ya no está en preparación (enviada a facturación, emitida o anulada).','ESTADO_INVALIDO');if(g.confirmacion)deny('La agrupación ya tiene la confirmación del cliente: no se modifica.','ESTADO_INVALIDO');};
/* Líneas del reporte: las MISMAS para la vista previa, el PDF interno y el del cliente. Nunca inventan tarifas. */
function agrLineas(A,g){
  const full=hasPerm(A,'oc_ver_combustible')||hasPerm(A,'finanzas_ver')||hasPerm(A,'facturas_emitir');   /* Facturación consulta el desglose de lo que factura */
  const pend=[],lineas=[];
  g.viajeIds.forEach(id=>{
    const t=DB.trips.find(x=>x.id===id);
    if(!t){pend.push({viajeId:id,motivo:'El viaje no existe.'});return;}
    const m=ocMotivoTarifa(t);
    if(m){pend.push({viajeId:id,noViaje:t.noViaje||t.id,shipment:t.shipment||'',motivo:m});return;}
    const l=ocLinea(t,true),cobro=l.tarifa;
    const ajuste=(t.ajusteCombustible===''||t.ajusteCombustible==null)?null:r2(Number(t.ajusteCombustible));
    if(ajuste!=null&&ajuste!==0&&!full){pend.push({viajeId:id,noViaje:t.noViaje||t.id,shipment:t.shipment||'',motivo:'El viaje tiene ajuste de combustible: tu perfil no puede ver el desglose de la tarifa.'});return;}
    const base=nn(t.tarifaBase);
    lineas.push({viajeId:id,fecha:l.fecha,noViaje:l.noViaje||id,shipment:l.shipment,placa:l.placa,tipoUnidad:l.tipoUnidad,estado:l.estado,capacidad:l.capacidad,ruta:l.ruta,origen:l.origen,
      tarifa:(full&&base!=null)?r2(base):cobro,combustible:ajuste,cobro});
  });
  lineas.sort((a,b)=>a.fecha<b.fecha?-1:a.fecha>b.fecha?1:a.viajeId<b.viajeId?-1:1);
  return {lineas,pend,total:r2(lineas.reduce((s,l)=>s+l.cobro,0))};
}
function agrColumnas(tipo,opc){
  if(tipo==='INTERNO')return AGR_INT_COLS;
  return AGR_COL_OBLIG.concat((opc||[]).filter(c=>AGR_COL_OPC[c]).map(c=>[c,AGR_COL_OPC[c]]));
}
function agrCelda(l,k){
  if(k==='tarifa'||k==='cobro'||k==='combustible')return ocQ(l[k]);
  return l[k]===''||l[k]==null?'—':String(l[k]);
}
const agrHuella=(lineas,cols)=>fnv(JSON.stringify([lineas.map(l=>[l.viajeId,l.fecha,l.noViaje,l.placa,l.tipoUnidad,l.estado,l.tarifa,l.combustible,l.cobro,l.capacidad,l.ruta,l.origen]),cols]));
function agrArmar(A,g,tipo,opc){
  if(!['INTERNO','CLIENTE'].includes(tipo))deny('Indica el tipo de reporte: interno o para el cliente.','VALIDACION');
  const cl=Array.isArray(opc)?opc:[];
  cl.forEach(c=>{if(!AGR_COL_OPC[c])deny(`Columna opcional no válida: ${c}.`,'VALIDACION');});
  if(tipo==='CLIENTE'&&cl.includes('combustible')&&!(hasPerm(A,'oc_ver_combustible')||hasPerm(A,'finanzas_ver')))deny('Tu perfil no puede incluir la tarifa de combustible en el reporte del cliente.','SIN_PERMISO');
  const r=agrLineas(A,g);
  const cols=agrColumnas(tipo,tipo==='CLIENTE'?cl:[]);
  const colKeys=cols.map(c=>c[0]);
  return {tipo,agrupacion:g.id,cliente:g.cliente,clienteNombre:ocClienteNombre(g.cliente),numeroFactura:g.numeroFactura||'',serieFactura:g.serieFactura||'',columnas:cols,opcionales:tipo==='CLIENTE'?cl.filter((c,i)=>cl.indexOf(c)===i):[],lineas:r.lineas,pendientes:r.pend,total:r.total,huella:agrHuella(r.lineas,colKeys),ok:!r.pend.length&&r.lineas.length>0};
}
function agrArchivo(A,g,a,pref){
  if(a&&typeof a==='object'&&typeof a.path==='string'){
    if(!new RegExp('^facturas/'+g.id+'/'+pref+'[A-Za-z0-9._-]{4,90}$').test(a.path))deny('La ruta del archivo no corresponde a esta agrupación.','VALIDACION');
    if(!ENV.storageExists(a.path))deny('El archivo no está en el almacenamiento: vuelve a subirlo.','VALIDACION');
    return {path:a.path,nombre:String(a.nombre||'').slice(0,80)};
  }
  if(typeof a==='string'){
    if(ENV.soloAlmacenamiento)deny('El archivo debe subirse al almacenamiento privado antes de registrarse.','VALIDACION');
    if(!/^data:(image\/|application\/pdf)/.test(a)||a.length>3000000)deny('El archivo debe ser imagen o PDF de máximo 2 MB.','VALIDACION');
    return {data:a};
  }
  deny('Adjunta el archivo.','VALIDACION');
}
/* El reporte interno solo lo ven quienes confirman con el cliente o consultan finanzas: Facturación no lo necesita. */
function redactAgr(A,g){
  if(hasPerm(A,'comercial_ot')||hasPerm(A,'finanzas_ver'))return g;
  if(!(g.pdfs||[]).some(p=>p.tipo==='INTERNO'))return g;
  return Object.assign({},g,{pdfs:g.pdfs.filter(p=>p.tipo!=='INTERNO')});
}
function ocErrorArmado(r){
  const pa=r.pendientes.slice(0,5).map(p=>`#${p.noViaje} (No. de Transporte ${p.shipment||'—'}) · ${p.cliente} · ${p.proyecto}: ${p.motivo}`);
  const ea=r.errores.slice(0,5).map(e=>`${e.viajeId}: ${e.motivo}`);
  const e=new ApiError(r.pendientes.length?'TARIFA_PENDIENTE':'NO_ELEGIBLE',(r.pendientes.length?OC_TARIFA_MSG+': ':'')+pa.concat(ea).join(' | ')||'La selección no tiene viajes válidos.');
  e.pendientes=r.pendientes;e.errores=r.errores;return e;
}
const ocPorId=id=>{ocGuardar();const o=DB.ordenesCompra.find(x=>x.id===id);if(!o)deny('La orden de compra no existe.','NO_EXISTE');return o;};
const ocFacturaActiva=o=>o.agrupacionId?DB.agrupaciones.find(g=>g.id===o.agrupacionId&&g.estado==='ACTIVA')||null:null;
/* Etapa derivada (no se guarda): Facturada / Cobrada salen de la factura vinculada, igual que etapaAgr. */
function ocEtapa(o){
  if(o.estado!=='ACEPTADA')return o.estado;
  const g=ocFacturaActiva(o);if(!g)return 'ACEPTADA';
  const e=etapaAgr(g);
  return e==='COBRADO'?'COBRADA':(e==='FACTURADO'||e==='COBRO_PARCIAL')?'FACTURADA':'EN_FACTURACION';
}
/* Copia para el usuario: sin el ajuste de combustible salvo permiso explícito. */
function redactOC(A,o){
  /* El ajuste de combustible se guarda aparte (o.combustible) y solo se devuelve a quien tiene el permiso propio. */
  const c=JSON.parse(JSON.stringify(o)),mapa=c.combustible||{};
  delete c.combustible;
  (c.lineas||[]).forEach(l=>{
    delete l.combustible;delete l.tarifaBase;
    if(hasPerm(A,'oc_ver_combustible')){const m=mapa[l.viajeId];l.combustible=m&&m.ajuste!=null?m.ajuste:null;l.tarifaBase=m&&m.base!=null?m.base:null;}
  });
  return c;
}
function ocDocumento(A,o,d,motivo){
  /* Valida un PDF de la OC: ruta propia del almacenamiento privado (oc/<id>/...) o data URL de PDF. */
  let doc={version:(o.documentos||[]).length+1,por:A.nombre,porId:A.id,en:nowIso(),motivo:motivo||''};
  const a=d&&d.archivo;
  if(a&&typeof a==='object'&&typeof a.path==='string'){
    if(!new RegExp('^oc/'+o.id+'/[A-Za-z0-9._-]{8,90}$').test(a.path))deny('La ruta del PDF no corresponde a esta orden de compra.','VALIDACION');
    if(!ENV.storageExists(a.path))deny('El PDF no está en el almacenamiento privado: vuelve a generarlo.','VALIDACION');
    doc.path=a.path;
  }else if(typeof a==='string'){
    if(ENV.soloAlmacenamiento)deny('El PDF debe subirse al almacenamiento privado antes de registrarse.','VALIDACION');
    if(!/^data:application\/pdf/.test(a))deny('La orden de compra debe conservarse como PDF.','VALIDACION');
    if(a.length>3000000)deny('El PDF es demasiado grande (máx. 2 MB).','VALIDACION');
    doc.data=a;
  }else deny('Falta el archivo PDF de la orden de compra.','VALIDACION');
  const h=String((d&&d.hash)||'');
  doc.hash=/^[a-f0-9]{16,64}$/.test(h)?h:(doc.data?fnv(doc.data):'');
  doc.nombre=String((d&&d.nombre)||(o.id+'-v'+doc.version+'.pdf')).slice(0,80);
  doc.columnas=Array.isArray(d&&d.columnas)?d.columnas.filter(c=>OC_COL_OPC[c]):o.columnas.slice();
  return doc;
}

/* =====================================================================
   API  (única vía de lectura y escritura)
   ===================================================================== */
const API={};


/* =====================================================================
   SIEMBRA: datos de demostración creados con la propia API (mismas reglas)
   ===================================================================== */

/* Dominio del motor · generado por separación de js/engine.js. */
Object.assign(API,{
  login(usuario,clave){
    const u=DB.usuarios.find(x=>x.usuario===String(usuario||'').trim().toLowerCase()&&String(x.clave).toLowerCase()===String(clave||'').trim().toLowerCase());
    if(!u||!u.activo){
      auditAdd({entidad:'SEGURIDAD',accion:'LOGIN_FALLIDO',campo:'Usuario',nuevo:String(usuario||'').slice(0,30),por:{id:'-',nombre:String(usuario||'(vacío)').slice(0,30),rol:''}});save();
      throw new ApiError('LOGIN','Usuario o contraseña incorrectos.');
    }
    auditAdd({entidad:'SESION',accion:'Inicio de sesión',por:u});save();return u;
  },
  logout(uid){const A=DB.usuarios.find(x=>x.id===uid);if(A){auditAdd({entidad:'SESION',accion:'Cierre de sesión',por:A});save();}},
  permiso(uid,p){return hasPerm(DB.usuarios.find(x=>x.id===uid),p);},

  /* ----- lectura (siempre filtrada por alcance) ----- */
});

/* Dominio del motor · generado por separación de js/engine.js. */
Object.assign(API,{
  listarViajes(uid){const A=actor(uid);return DB.trips.filter(t=>puedeVer(A,t)).map(t=>redact(A,t));},
  viaje(uid,id){const A=actor(uid);const t=DB.trips.find(x=>x.id===id);if(!t||!puedeVer(A,t))throw new ApiError('DENEGADO','No existe o no tienes acceso a este viaje.');return redact(A,t);},
  historial(uid,id,soloTiempos){
    const A=actor(uid),t=API.viaje(uid,id);
    const full=hasPerm(A,'historial_ver'),tiempos=hasPerm(A,'viajes_editar_tiempos');
    if(!full&&!(soloTiempos&&tiempos))throw new ApiError('SIN_PERMISO','Tu perfil no puede ver el historial completo.');
    return (API.historiales(uid,soloTiempos).get(t.id)||[]).slice();
  },
  /* Igual que historial() pero para TODOS los viajes de una vez: recorre la auditoría UNA sola vez y la agrupa por
     viaje. Evita el costo cuadrático (viajes × auditoría) al armar el snapshot. Devuelve un Map viajeId → eventos. */
  historiales(uid,soloTiempos){
    const A=actor(uid),porViaje=new Map();
    const full=hasPerm(A,'historial_ver'),tiempos=hasPerm(A,'viajes_editar_tiempos');
    if(!full&&!(soloTiempos&&tiempos))return porViaje;
    const verMoney=hasPerm(A,'finanzas_ver'),verViat=verMoney||hasPerm(A,'viajes_editar_datos'),comercial=hasPerm(A,'comercial_ver');
    for(const e of DB.audit){
      if(e.entidad==='SEGURIDAD')continue;
      if(e.entidad==='AGRUPACION'&&!comercial)continue;
      if(e.entidad==='FINANZAS'&&!verMoney)continue;
      if(MONEY_LBL.includes(e.campo)&&!((e.campo==='Q viáticos'||e.campo==='Gastos adicionales')?verViat:verMoney))continue;
      if(soloTiempos&&!TIEMPO_AUD.some(k=>LBL[k]===e.campo))continue;
      let a=porViaje.get(e.viajeId);if(!a){a=[];porViaje.set(e.viajeId,a);}a.push(e);
    }
    return porViaje;
  },
  liquidaciones(uid,id){
    const A=actor(uid),t=API.viaje(uid,id);
    if(!hasPerm(A,'liq_ver')&&!hasPerm(A,'liq_enviar'))throw new ApiError('SIN_PERMISO','Tu perfil no puede ver liquidaciones.');
    return DB.liquidaciones.filter(l=>l.viajeId===t.id).map(l=>Object.assign({},l,{evidencia:(DB.evidencias.find(e=>e.id===l.evidenciaId)||{}).dataUrl||''}));
  },
  agrupaciones(uid){const A=actor(uid);need(A,'comercial_ver','ver el módulo Comercial');return DB.agrupaciones.map(g=>redactAgr(A,g));},
  actividad(uid,n){
    const A=actor(uid);need(A,'historial_ver','ver el historial');
    return DB.audit.filter(e=>e.entidad!=='SEGURIDAD'&&e.entidad!=='SESION'&&(e.entidad!=='FINANZAS'||hasPerm(A,'finanzas_ver'))&&!MONEY_LBL.includes(e.campo)&&(!e.viajeId||puedeVer(A,DB.trips.find(t=>t.id===e.viajeId)||{proyecto:''}))).slice(-n).reverse();
  },
  auditoria(uid){const A=actor(uid);need(A,'auditoria_ver','consultar la auditoría');return DB.audit.slice();},
  verificarAuditoria(uid){
    const A=actor(uid);need(A,'auditoria_ver','verificar la auditoría');
    let prev='GENESIS';
    for(let i=0;i<DB.audit.length;i++){
      const e=DB.audit[i];
      const h=fnv(prev+'|'+[e.id,e.entidad,e.viajeId,e.accion,e.campo,e.anterior,e.nuevo,e.porId,e.en,e.motivo,e.ref].join('¦'));
      if(e.prev!==prev||e.hash!==h)return {ok:false,indice:i,id:e.id,total:DB.audit.length};
      prev=e.hash;
    }
    return {ok:true,total:DB.audit.length};
  },

  /* ----- viajes ----- */
  agrupaciones(uid){const A=actor(uid);need(A,'comercial_ver','ver el módulo Comercial');return DB.agrupaciones.map(g=>redactAgr(A,g));},
});

/* Dominio del motor · generado por separación de js/engine.js. */
Object.assign(API,{
  crearViaje(uid,d){return exec(uid,'crearViaje','',A=>{
    need(A,'viajes_crear','crear viajes');
    const cliente=d&&d.cliente,cl=DB.clientes.find(c=>c.id===cliente);
    if(!cl)deny('Cliente no válido.','VALIDACION');
    if(cl.activo===false)deny('El cliente está desactivado: no admite viajes nuevos.','VALIDACION');
    if(!clientesAsig(A).includes(cliente))deny('No tienes asignado ese cliente: no puedes crear viajes para él.');
    const P0=PILOTOS.find(p=>p.id===(d&&d.pilotoId));
    if(P0&&P0.activo===false)deny('El piloto está dado de baja: elige otro.','VALIDACION');
    const keys=[...DATA_KEYS,...TIEMPO_KEYS,...DVKEYS,'rutaRef','sinRuta','desvio','desvioDestino','rutaCapacidad','rutaKm'];
    Object.keys(d).forEach(k=>{if(k!=='cliente'&&!keys.includes(k))deny(k==='origen'||k==='destino'?'El origen y el destino se toman de la ruta del viaje.':`Campo no permitido: ${k}.`,'CAMPO_NO_EDITABLE');});
    const v={};keys.forEach(k=>{v[k]=d[k]==null?'':(typeof d[k]==='string'?d[k].trim():d[k]);});
    /* El viaje nace Planificado: los demás estados los produce el flujo paso a paso (en ruta, entregado,
       liquidación, aprobación, facturación, cobro). No se puede crear un viaje ya entregado o facturado. */
    if(v.estado&&v.estado!=='PLANIFICADO')deny('El viaje nuevo nace Planificado: los demás estados los pone el flujo (en ruta, entregado, liquidación, facturación).','ESTADO_NO_AUTORIZADO');
    v.estado='PLANIFICADO';
    /* SIN RUTA: el viaje se registra sin ruta asignada (queda marcado y se avisa a Gerencia). No es lo mismo que «NUEVA RUTA», que solicita una ruta al catálogo. */
    const sinRuta=v.sinRuta===true||v.sinRuta==='true';delete v.sinRuta;
    if(sinRuta&&v.rutaId)deny('Un viaje SIN RUTA no puede traer una ruta seleccionada: quita la ruta o desactiva SIN RUTA.','VALIDACION');
    if(!v.rutaId&&!sinRuta)deny('Falta Ruta.','VALIDACION');
    /* DESVÍO: el viaje conserva sus datos (ruta, horarios, etc.); solo se registra hacia qué destino se desvió.
       Es texto libre, igual que el destino de la ruta. Sin Desvío activo no interviene. */
    const desvio=v.desvio===true||v.desvio==='true',dvDestino=String(v.desvioDestino||'').trim().replace(/\s+/g,' ');
    delete v.desvio;delete v.desvioDestino;
    if(desvio){
      if(!dvDestino)deny('Escribe hacia dónde fue el desvío.','VALIDACION');
      if(dvDestino.length>120)deny('El destino del desvío admite máximo 120 caracteres.','VALIDACION');
    }
    /* Horarios de descarga del desvío: solo con Desvío activo; solo descarga; en orden y sin reemplazar los horarios normales. */
    const dvT={};DVKEYS.forEach(k=>{const x=String(v[k]==null?'':v[k]).trim();if(x)dvT[k]=x;delete v[k];});
    if(!desvio&&Object.keys(dvT).length)deny('Los horarios de descarga del desvío solo se registran cuando el viaje tiene Desvío.','VALIDACION');
    Object.keys(dvT).forEach(k=>{const m=valKey(cliente,k,dvT[k]);if(m)deny(m,'VALIDACION');});
    if(dvT.dvIngresoBodega&&dvT.dvInicioDescarga&&dvT.dvInicioDescarga<dvT.dvIngresoBodega)deny('Desvío: el inicio de descarga no puede ser antes del ingreso a bodega.','VALIDACION');
    if(dvT.dvInicioDescarga&&dvT.dvFinDescarga&&dvT.dvFinDescarga<dvT.dvInicioDescarga)deny('Desvío: el fin de descarga no puede ser antes del inicio de descarga.','VALIDACION');
    keys.forEach(k=>{if(k==='rutaId'||k==='rutaRef'||k==='sinRuta'||k==='desvio'||k==='desvioDestino'||k==='rutaCapacidad'||k==='rutaKm'||v[k]===''||v[k]==null)return;const m=valKey(cliente,k,v[k]);if(m)deny(m,'VALIDACION');});
    let ruta=null,pend=v.rutaId==='NO_ASIGNADA',capPend='',kmPend=null;
    if(sinRuta){if(!v.proyectoCat||!proyectosDe(cliente).includes(v.proyectoCat))deny('Para registrar un viaje SIN RUTA selecciona el proyecto.','VALIDACION');}
    else if(pend){need(A,'rutas_solicitar','solicitar rutas nuevas');if(!v.proyectoCat||!proyectosDe(cliente).includes(v.proyectoCat))deny('Para solicitar una ruta nueva selecciona el proyecto.','VALIDACION');if(String(v.rutaRef||'').length<3)deny('Para una ruta no activa escribe la referencia (qué ruta se necesita): se envía a validación.','VALIDACION');if(v.rutaRef.length>80)deny('La referencia de la ruta admite máximo 80 caracteres.','VALIDACION');capPend=capacidadRuta(v.rutaCapacidad);kmPend=kmRuta(v.rutaKm);}
    else {ruta=DB.rutas.find(r=>r.id===v.rutaId);if(!ruta||ruta.cliente!==cliente)deny('La ruta no corresponde al cliente elegido.','VALIDACION');v.proyectoCat=ruta.proyecto;}
    delete v.rutaCapacidad;delete v.rutaKm;
    const clave=pend?'ref:'+v.rutaRef.toLowerCase():v.rutaId;
    const dup=v.fechaPlan&&v.pilotoId&&DB.trips.find(t=>t.fechaPlan===v.fechaPlan&&t.pilotoId===v.pilotoId&&((pend&&t.rutaRef&&('ref:'+t.rutaRef.toLowerCase())===clave)||(!pend&&t.rutaId===clave)));
    if(dup)deny(`Este viaje ya existe (#${dup.id}): misma fecha y hora plan, piloto y ruta.`,'DUPLICADO');
    const gAd=normGastos(v.gastosAdicionales);if(gAd.err)deny(gAd.err,'VALIDACION');
    if(gAd.length)v.gastosAdicionales=gAd;else delete v.gastosAdicionales;
    const id=String(DB.seq.trip++).padStart(6,'0');
    let rutaId=v.rutaId;
    if(pend){const rr=crearRutaPendiente(A,{cliente,proyecto:v.proyectoCat,nombre:v.rutaRef,capacidad:capPend,km:kmPend,fuente:'VIAJE',viajeRef:id});rutaId=rr.id;}
    const P=PILOTOS.find(p=>p.id===v.pilotoId);
    const t=Object.assign({id,proyecto:cliente,unidadId:P?P.unidad:'',estado:'PLANIFICADO',creadoPor:A.nombre,creadoPorId:A.id,creadoEn:nowIso(),comentarioRevision:'',rechazos:0,duplicadoAprobado:false,liqIntentos:0,liqActualId:'',liqAprobadaEn:'',agrupacionId:'',numeroFactura:'',tarifaCliente:'',tarifaId:'',costoProveedor:''},v,{rutaId,origen:ruta?ruta.origen:'',destino:ruta?ruta.destino:'',rutaRef:pend?v.rutaRef:''});
    if(!t.unidadId)t.unidadId=P?P.unidad:'';            /* si no se eligió placa, se usa la unidad del piloto */
    /* El No. de viaje es un consecutivo POR UNIDAD, calculado en el servidor con todo el histórico.
       No se acepta un valor manual: así no se duplica ni se reinicia al cambiar de equipo. */
    const diaPlan=String(v.fechaPlan||'').slice(0,10);
    t.noViaje=(t.unidadId&&diaPlan)?String(DB.trips.filter(x=>x.unidadId===t.unidadId&&String(x.fechaPlan||'').slice(0,10)===diaPlan).length+1):'';
    t.notaPiloto=notaPilotoDe(t);                        /* constancia si el piloto no es el asignado a la unidad */
    if(sinRuta){t.sinRuta=true;t.sinRutaPor=A.nombre;t.sinRutaEn=t.creadoEn;}
    if(desvio){t.desvio=true;t.desvioDestino=dvDestino;t.desvioPor=A.nombre;t.desvioEn=t.creadoEn;Object.assign(t,dvT);}
    DB.trips.push(t);
    auditAdd({viajeId:id,accion:'Viaje creado',campo:'Estado',nuevo:ESTADOS[t.estado].l,por:A,ref:`${cliente}${pend?' · ruta NO ASIGNADA':''}${sinRuta?' · SIN RUTA':''}${desvio?' · DESVÍO → '+dvDestino:''}`});
    if(sinRuta&&!DB.notificaciones.some(n=>n.tipo==='VIAJE_SIN_RUTA'&&n.detalle&&n.detalle.viaje===id)){
      /* Aviso para Gerencia en el mecanismo de notificaciones que ya existe (tabla notificaciones). Una sola vez por viaje. */
      notificar(A,{tipo:'VIAJE_SIN_RUTA',destinatarios:['GERENTE_COMERCIAL','GERENTE_TRANSPORTE'],asunto:`Viaje #${id} registrado SIN RUTA`,detalle:{viaje:id,cliente:cl.cliente||cl.nombre||cliente,proyecto:t.proyectoCat,registradoPor:A.nombre,fechaRegistro:t.creadoEn}});
    }
    return t;
  });},
  editarViaje(uid,id,cambios,motivo){return exec(uid,'editarViaje',id,A=>{
    const t=getT(id);if(!puedeVer(A,t))deny('No tienes acceso a viajes de otro cliente.');
    const ks=Object.keys(cambios||{});if(!ks.length)return {cambios:0};
    const esAsig=asignado(A,t),todos=hasPerm(A,'viajes_ver_todos'),cl=DB.clientes.find(x=>x.id===t.proyecto)||{};
    ks.forEach(k=>{
      if(k==='estado'){
        need(A,'viajes_editar_estado','modificar manualmente el estado del viaje');
        if(!esAsig)deny('Solo puedes cambiar el estado de viajes de tus clientes asignados.','CAMPO_NO_AUTORIZADO');
        const nv=String(cambios[k]==null?'':cambios[k]).trim();
        if(!nv)deny('Elige el estado del viaje.','VALIDACION');
        if(!ESTADOS[nv])deny('Estado no válido.','VALIDACION');
        if(nv===t.estado)deny(`El viaje ya está en "${ESTADOS[nv].l}".`,'VALIDACION');
        if(!ESTADOS_MANUALES.includes(nv))deny(`El estado "${ESTADOS[nv].l}" no se fija a mano: lo pone el flujo (liquidación, aprobación, facturación o cobro).`,'ESTADO_NO_AUTORIZADO');
        if(!(EDGES[t.estado]||[]).includes(nv))deny(`No se puede pasar de "${ESTADOS[t.estado].l}" a "${ESTADOS[nv].l}" a mano: sigue el flujo paso a paso.`,'TRANSICION_INVALIDA');
        const prop=Object.assign({},t,cambios);      /* el estado y los datos se validan juntos: se puede completar y pasar de estado en un solo guardado */
        if(nv==='EN_RUTA'){
          requerido(prop,['shipment','opl','tipoViaje','tipoCarga','noCarga','producto','pilotoId','placaArrastre'],'En ruta');
          if(!prop.unidadId)deny('No se puede pasar a En ruta: falta la unidad.','FALTAN_CAMPOS');
        }else requerido(prop,TKEYS_ENTREGA,'Entregado');
      }else if(TIEMPO_KEYS.includes(k)){
        need(A,'viajes_editar_tiempos','editar fechas y horas');
        if(!todos&&!esAsig)deny('Solo puedes editar viajes de tus clientes asignados.');
        if(!esAsig&&!todos)deny('Solo el encargado del cliente puede editar fechas y horas.','CAMPO_NO_AUTORIZADO');
        if(!todos&&!esDueno(A,t))deny('Solo puedes editar los viajes que registraste tú (o los que no tienen responsable asignado).','SIN_PROPIEDAD');
        if(['FACTURADO','COBRADO'].includes(t.estado))deny('El viaje ya fue facturado: sus fechas y horas ya no se pueden modificar.','ESTADO_BLOQUEADO');
      }else if(DATA_KEYS.includes(k)){
        need(A,'viajes_editar_datos','editar datos distintos de fechas y horas');
        if(k==='pilotoId'&&String(cambios[k])!==String(t.pilotoId)){const Pn=PILOTOS.find(p=>p.id===cambios[k]);if(Pn&&Pn.activo===false)deny('El piloto está dado de baja: elige otro.','VALIDACION');}
        if(!esAsig)deny('Solo puedes editar viajes de tus clientes asignados.');
        if(!todos&&!esDueno(A,t))deny('Solo puedes editar los viajes que registraste tú (o los que no tienen responsable asignado).','SIN_PROPIEDAD');
        if(!DATA_EDIT_STATES.includes(t.estado))deny(`El viaje está en "${ESTADOS[t.estado].l}": sus datos ya no se pueden editar.`,'ESTADO_BLOQUEADO');
      }else deny(`El campo "${LBL[k]||k}" no es editable.`,'CAMPO_NO_EDITABLE');
    });
    const dif=[];
    ks.forEach(k=>{
      const nv=typeof cambios[k]==='string'?cambios[k].trim():cambios[k];
      const ov=t[k]==null?'':t[k];
      if(k==='estado'&&(nv===''||nv==null))return;   /* sin estado elegido: se conserva el actual */
      if(k==='gastosAdicionales'){const g=normGastos(nv,ov);if(g.err)deny(g.err,'VALIDACION');if(JSON.stringify(g)===JSON.stringify(Array.isArray(ov)?ov:[]))return;dif.push([k,Array.isArray(ov)?ov:'',g]);return;}
      if(String(nv==null?'':nv)===String(ov))return;
      if(['proyectoCat','fechaPlan','pilotoId','rutaId'].includes(k)&&(nv===''||nv==null))deny(`${LBL[k]} es obligatorio.`,'VALIDACION');
      if(k!=='rutaId'){const m=valKey(t.proyecto,k,nv);if(m)deny(m,'VALIDACION');}
      dif.push([k,ov,nv==null?'':nv]);
    });
    /* la ruta debe seguir correspondiendo al cliente y proyecto resultantes */
    const proyFinal=dif.find(x=>x[0]==='proyectoCat')?dif.find(x=>x[0]==='proyectoCat')[2]:t.proyectoCat;
    const rutaFinal=dif.find(x=>x[0]==='rutaId')?dif.find(x=>x[0]==='rutaId')[2]:t.rutaId;
    const rActual=DB.rutas.find(x=>x.id===rutaFinal);
    if(dif.some(x=>x[0]==='rutaId'))rutaOK(t.proyecto,proyFinal,rutaFinal);
    else if(dif.some(x=>x[0]==='proyectoCat')&&rActual&&rActual.estado==='ASIGNADA'&&rActual.proyecto!==proyFinal)deny('La ruta del viaje no corresponde al proyecto elegido: selecciona otra ruta.','VALIDACION');
    dif.forEach(([k,ov,nv])=>{
      const esT=TIEMPO_KEYS.includes(k);
      auditAdd({viajeId:t.id,accion:esT?'Fecha/hora modificada':(k==='estado'?'Estado corregido a mano':'Dato modificado'),campo:LBL[k]||k,anterior:k==='rutaId'?rutaNombre(ov):fmtVal(k,ov),nuevo:k==='rutaId'?rutaNombre(nv):fmtVal(k,nv),por:A,motivo:motivo||''});
      t[k]=nv;
      if(k==='pilotoId'){const P=PILOTOS.find(p=>p.id===nv);const antes=t.unidadId;if(P&&!('unidadId' in cambios)){t.unidadId=P.unidad||'';auditAdd({viajeId:t.id,accion:'Dato modificado (por cambio de piloto)',campo:'Unidad',anterior:antes,nuevo:t.unidadId,por:A,motivo:motivo||''});}}
      if(k==='rutaId'){const r=DB.rutas.find(x=>x.id===nv);const ao=t.origen,ad=t.destino;t.origen=r.origen;t.destino=r.destino;t.rutaRef='';
        auditAdd({entidad:'RUTA',viajeId:t.id,accion:'Origen y destino actualizados por cambio de ruta',campo:'Origen',anterior:ao?nombreOrigen(ao):'(pendiente)',nuevo:nombreOrigen(r.origen),por:A,ref:r.id});
        auditAdd({entidad:'RUTA',viajeId:t.id,accion:'Origen y destino actualizados por cambio de ruta',campo:'Destino',anterior:ad?nombreDestino(ad):'(pendiente)',nuevo:nombreDestino(r.destino),por:A,ref:r.id});}
    });
    if(dif.some(x=>x[0]==='estado'&&x[2]==='ENTREGADO')){
      /* Corrección manual a Entregado: se registra la fecha de entrega, igual que al entregar por el flujo */
      t.finalizadoPor=A.nombre;t.finalizadoEn=nowIso();
      auditAdd({viajeId:t.id,accion:'Fecha de entrega registrada al marcar Entregado',campo:'Finalizó',anterior:'(vacío)',nuevo:t.finalizadoEn,por:A,motivo:'El estado se corrigió a mano'});
    }
    if(dif.length){t.editadoPor=A.nombre;t.editadoEn=nowIso();}
    t.notaPiloto=notaPilotoDe(t);                        /* se actualiza la constancia piloto/unidad */
    return {cambios:dif.length};
  });},
  iniciar(uid,id){return exec(uid,'iniciar',id,A=>{
    need(A,'viajes_iniciar','iniciar viajes');
    const t=getT(id);if(!asignado(A,t))deny('Solo el encargado asignado a este cliente puede iniciar el viaje.');
    if(t.estado!=='PLANIFICADO')deny(`Solo un viaje Planificado puede iniciar ruta (estado actual: ${ESTADOS[t.estado].l}).`,'ESTADO_INVALIDO');
    requerido(t,['shipment','opl','tipoViaje','tipoCarga','noCarga','producto','pilotoId','placaArrastre'],'En ruta');
    if(!t.unidadId)deny('No se puede pasar a En ruta: falta la unidad.','FALTAN_CAMPOS');
    moveEstado(t,'EN_RUTA',A,'Viaje enviado a ruta');
    t.iniciadoPor=A.nombre;t.iniciadoEn=nowIso();
    if(!t.tSalida)setAuto(t,'tSalida',nowLoc(),A,'Automático al iniciar el viaje');
    return t;
  });},
  finalizar(uid,id){return exec(uid,'finalizar',id,A=>{
    need(A,'viajes_finalizar','finalizar viajes');
    const t=getT(id);if(!asignado(A,t))deny('Solo el encargado asignado a este cliente puede finalizar el viaje.');
    if(t.estado!=='EN_RUTA')deny(`Solo un viaje En ruta puede entregarse (estado actual: ${ESTADOS[t.estado].l}).`,'ESTADO_INVALIDO');
    requerido(t,TKEYS_ENTREGA,'Entregado');
    moveEstado(t,'ENTREGADO',A,'Viaje entregado');
    t.finalizadoPor=A.nombre;t.finalizadoEn=nowIso();
    return t;
  });},

  /* Torre de Control: avanza el estado (solo En ruta / Entregado) de los viajes de los clientes autorizados */
  torreMoverEstado(uid,id,nuevo){return exec(uid,'torreMoverEstado',id,A=>{
    need(A,'viajes_estatus_torre','avanzar el estado del viaje');
    const t=getT(id);if(!puedeVer(A,t))deny('No tienes acceso a este viaje.');
    const cl=DB.clientes.find(x=>x.id===t.proyecto)||{};
    if(!cl.torreEstatus)deny(`Torre de Control solo avanza el estado de los clientes autorizados. ${cl.cliente||t.proyecto} es solo consulta.`,'CLIENTE_NO_AUTORIZADO');
    const objetivo=String(nuevo||'');
    if(!['EN_RUTA','ENTREGADO'].includes(objetivo))deny('Torre de Control solo puede avanzar el viaje a En ruta o Entregado.','ESTADO_NO_AUTORIZADO');
    if(!(EDGES[t.estado]||[]).includes(objetivo))deny(`Torre de Control no puede pasar de "${ESTADOS[t.estado].l}" a "${ESTADOS[objetivo].l}".`,'TRANSICION_INVALIDA');
    if(objetivo==='EN_RUTA'){
      requerido(t,['shipment','opl','tipoViaje','tipoCarga','noCarga','producto','pilotoId','placaArrastre'],'En ruta');
      if(!t.unidadId)deny('No se puede pasar a En ruta: falta la unidad.','FALTAN_CAMPOS');
      moveEstado(t,'EN_RUTA',A,'Viaje enviado a ruta (Torre de Control)');
      t.iniciadoPor=A.nombre;t.iniciadoEn=nowIso();
      if(!t.tSalida)setAuto(t,'tSalida',nowLoc(),A,'Automático al iniciar el viaje');
    }else{
      requerido(t,TKEYS_ENTREGA,'Entregado');
      moveEstado(t,'ENTREGADO',A,'Viaje entregado (Torre de Control)');
      t.finalizadoPor=A.nombre;t.finalizadoEn=nowIso();
    }
    return redact(A,t);   /* la respuesta pasa por el mismo filtro que las lecturas: Torre no recibe importes */
  });},

  /* Torre de Control: agrega o corrige fechas y horarios (los campos que el viaje ya tiene). No cambia el estado ni ningún otro dato.
     Mismo permiso y misma autorización por cliente que «avanzar el estado»; queda en la bitácora con valor anterior, nuevo, usuario y fecha. */
  torreEditarHorarios(uid,id,cambios,motivo){return exec(uid,'torreEditarHorarios',id,A=>{
    need(A,'viajes_estatus_torre','editar fechas y horarios desde Torre de Control');
    const t=getT(id);if(!puedeVer(A,t))deny('No tienes acceso a este viaje.');
    const cl=DB.clientes.find(x=>x.id===t.proyecto)||{};
    if(!cl.torreEstatus)deny(`Torre de Control solo edita horarios de los clientes autorizados. ${cl.cliente||t.proyecto} es solo consulta.`,'CLIENTE_NO_AUTORIZADO');
    if(['FACTURADO','COBRADO'].includes(t.estado))deny('El viaje ya fue facturado: sus fechas y horas ya no se pueden modificar.','ESTADO_BLOQUEADO');
    const ks=Object.keys(cambios||{});if(!ks.length)deny('No hay cambios que guardar.','VALIDACION');
    ks.forEach(k=>{if(DVKEYS.includes(k)){if(!t.desvio)deny('Este viaje no tiene Desvío: no tiene horarios de descarga del desvío.','CAMPO_NO_EDITABLE');return;}if(!TIEMPO_KEYS.includes(k))deny(`El campo "${LBL[k]||k}" no es una fecha ni un horario: Torre de Control no puede editarlo.`,'CAMPO_NO_EDITABLE');});
    const dif=[];
    ks.forEach(k=>{
      const nv=typeof cambios[k]==='string'?cambios[k].trim():cambios[k],ov=t[k]==null?'':t[k];
      if(String(nv==null?'':nv)===String(ov))return;
      const m=valKey(t.proyecto,k,nv);if(m)deny(m,'VALIDACION');
      dif.push([k,ov,nv==null?'':nv]);
    });
    if(!dif.length)return {cambios:0};
    {const g=k=>{const x=dif.find(z=>z[0]===k);return x?x[2]:(t[k]||'');};
      if(g('dvIngresoBodega')&&g('dvInicioDescarga')&&g('dvInicioDescarga')<g('dvIngresoBodega'))deny('Desvío: el inicio de descarga no puede ser antes del ingreso a bodega.','VALIDACION');
      if(g('dvInicioDescarga')&&g('dvFinDescarga')&&g('dvFinDescarga')<g('dvInicioDescarga'))deny('Desvío: el fin de descarga no puede ser antes del inicio de descarga.','VALIDACION');}
    dif.forEach(([k,ov,nv])=>{
      auditAdd({viajeId:t.id,accion:'Fecha/hora modificada (Torre de Control)',campo:LBL[k]||k,anterior:fmtVal(k,ov),nuevo:fmtVal(k,nv),por:A,motivo:motivo||''});
      t[k]=nv;
    });
    t.editadoPor=A.nombre;t.editadoEn=nowIso();
    return {cambios:dif.length};
  });},

  /* ----- liquidaciones ----- */
  enviarLiquidacion(uid,id,foto){return exec(uid,'enviarLiquidacion',id,A=>{
    need(A,'liq_enviar','enviar liquidaciones');
    const t=getT(id);if(!asignado(A,t))deny('Solo el encargado asignado a este cliente puede enviar la liquidación.');
    if(!['ENTREGADO','RECHAZADO'].includes(t.estado)){
      deny(['PLANIFICADO','EN_RUTA'].includes(t.estado)?'La liquidación no puede enviarse antes de entregar el viaje.':`La liquidación no puede enviarse con el viaje en "${ESTADOS[t.estado].l}".`,'ESTADO_INVALIDO');
    }
    if(!t.finalizadoEn)completarEntrega(t,A);
    validarLiquidacion(t);
    const esPath=!!foto&&typeof foto==='object'&&typeof foto.path==='string';
    if(esPath){
      if(!new RegExp('^viajes/'+id+'/[A-Za-z0-9._-]{8,90}$').test(foto.path))deny('La ruta de la evidencia no corresponde a este viaje.','VALIDACION');
      if(!ENV.storageExists(foto.path))deny('La evidencia no está en el almacenamiento: vuelve a subirla antes de enviar.','VALIDACION');
    }else{
      if(typeof foto!=='string'||!/^data:image\//.test(foto)||foto.length<200)deny('Adjunta la fotografía o evidencia de la liquidación antes de enviar.','VALIDACION');
      if(foto.length>6000000)deny('La imagen es demasiado grande.','VALIDACION');
    }
    const ciclo=DB.liquidaciones.filter(l=>l.viajeId===id).length+1;
    const lid='LIQ-'+pad4(DB.seq.liq++),eid='EVI-'+pad4(DB.seq.evi++),en=nowIso();
    DB.evidencias.push({id:eid,viajeId:id,liqId:lid,dataUrl:esPath?'':foto,path:esPath?foto.path:'',porId:A.id,por:A.nombre,en});
    DB.liquidaciones.push({id:lid,viajeId:id,ciclo,envioPorId:A.id,envioPor:A.nombre,envioEn:en,evidenciaId:eid,decision:'',revisorId:'',revisor:'',revisionEn:'',comentario:''});
    t.liqActualId=lid;t.liqIntentos=ciclo;t.enviadoPor=A.nombre;t.enviadoEn=en;
    moveEstado(t,'LIQUIDADO',A,ciclo>1?'Liquidación reenviada (corregida)':'Liquidación enviada para validación','',`${lid} · ${eid} · ciclo ${ciclo}`);
    return t;
  });},
  aprobar(uid,id){return exec(uid,'aprobar',id,A=>{
    need(A,'liq_aprobar','aprobar liquidaciones');
    const t=getT(id);if(!puedeVer(A,t))deny('No tienes acceso a este viaje.');
    if(t.estado!=='LIQUIDADO')deny(`Solo se puede aceptar una liquidación Liquidada (estado actual: ${ESTADOS[t.estado].l}).`,'ESTADO_INVALIDO');
    const lq=DB.liquidaciones.find(l=>l.id===t.liqActualId);
    if(!lq||lq.decision)deny('No hay una liquidación enviada pendiente de revisión.','ESTADO_INVALIDO');
    if(lq.envioPorId===A.id)deny('No puedes aprobar una liquidación enviada por ti.','SEPARACION_FUNCIONES');
    lq.decision='APROBADA';lq.revisorId=A.id;lq.revisor=A.nombre;lq.revisionEn=nowIso();
    t.liqAprobadaEn=lq.revisionEn;t.aprobadoPor=A.nombre;t.aprobadoEn=lq.revisionEn;
    moveEstado(t,'ACEPTADO',A,'Viaje aceptado para facturación','',lq.id);
    return t;
  });},
  devolver(uid,id,comentario){return exec(uid,'devolver',id,A=>{
    need(A,'liq_devolver','devolver liquidaciones');
    const t=getT(id);if(!puedeVer(A,t))deny('No tienes acceso a este viaje.');
    const c=String(comentario||'').trim();
    if(c.length<5)deny('El comentario es obligatorio: explica qué debe corregirse (mínimo 5 caracteres).','VALIDACION');
    if(t.estado!=='LIQUIDADO')deny(`Solo se puede rechazar una liquidación Liquidada (estado actual: ${ESTADOS[t.estado].l}).`,'ESTADO_INVALIDO');
    const lq=DB.liquidaciones.find(l=>l.id===t.liqActualId);
    if(!lq||lq.decision)deny('No hay una liquidación enviada pendiente de revisión.','ESTADO_INVALIDO');
    lq.decision='DEVUELTA';lq.revisorId=A.id;lq.revisor=A.nombre;lq.revisionEn=nowIso();lq.comentario=c;
    t.comentarioRevision=c;t.revisadoPor=A.nombre;t.revisadoEn=lq.revisionEn;
    t.rechazos=(Number(t.rechazos)||0)+1;
    moveEstado(t,'RECHAZADO',A,`Viaje rechazado (#${t.rechazos})`,c,lq.id);
    return t;
  });},
  aprobarShipmentDuplicado(uid,id){return exec(uid,'aprobarShipmentDuplicado',id,A=>{
    need(A,'viajes_aprobar_duplicado','aprobar un Shipment duplicado');
    const t=getT(id);if(!puedeVer(A,t))deny('No tienes acceso a este viaje.');
    if(!['ENTREGADO','RECHAZADO'].includes(t.estado))deny('El Shipment duplicado solo se aprueba antes de liquidar.','ESTADO_INVALIDO');
    if(!duplicadoShipment(t))deny('El Shipment ya no está duplicado.','VALIDACION');
    const base=String(t.shipment||'').replace(/^DUP-/i,'').trim(),nuevo='DUP-'+base;
    if(DB.trips.some(x=>x.id!==t.id&&String(x.shipment||'').toLowerCase()===nuevo.toLowerCase()))deny(`Ya existe ${nuevo}; un segundo duplicado no puede aprobarse ni liquidarse.`,'SHIPMENT_DUPLICADO');
    auditAdd({viajeId:t.id,accion:'Shipment duplicado aprobado',campo:LBL.shipment,anterior:t.shipment,nuevo,por:A,motivo:'Aprobación excepcional de Gerencia de Transporte'});
    t.shipment=nuevo;t.duplicadoAprobado=true;t.duplicadoAprobadoPor=A.nombre;t.duplicadoAprobadoEn=nowIso();return t;
  });},

  /* ----- facturas (comercial) ----- */
  /* Fases: PREPARADA (datos en armado, sin enviar) → ENVIADA (enviada a facturación, validada) → EMITIDA (emitida oficialmente, con evidencia).
     La agrupación de varios viajes es OPCIONAL: un solo viaje se factura como modalidad INDIVIDUAL. */
});

/* Dominio del motor · generado por separación de js/engine.js. */
Object.assign(API,{
  prepararFactura(uid,d){return exec(uid,'prepararFactura','',A=>{
    need(A,'comercial_agrupar','preparar facturas');
    const cliente=d&&d.cliente;
    const cl=DB.clientes.find(c=>c.id===cliente);if(!cl)deny('Selecciona el cliente de la factura.','VALIDACION');
    ocGuardar();
    /* Factura de una OC: debe estar aceptada, sin otra factura activa, y contiene EXACTAMENTE los viajes de la OC. */
    const oc=d&&d.ocId?ocPorId(d.ocId):null;
    if(oc){
      if(oc.estado!=='ACEPTADA')deny('Solo una orden de compra aceptada por el cliente puede facturarse.','ESTADO_INVALIDO');
      if(ocFacturaActiva(oc))deny(`La orden de compra ${oc.id} ya tiene la factura ${oc.agrupacionId}: una orden se factura una sola vez.`,'YA_FACTURADO');
      if(oc.cliente!==cliente)deny('El cliente de la factura no coincide con el de la orden de compra.','CLIENTE_DISTINTO');
    }
    const ids=oc?oc.lineas.map(l=>l.viajeId):(Array.isArray(d.viajeIds)?d.viajeIds.slice():[]);
    if(!ids.length)deny('Selecciona al menos un viaje.','VALIDACION');
    if(new Set(ids).size!==ids.length)deny('La selección contiene viajes duplicados.','VALIDACION');
    if(oc&&Array.isArray(d.viajeIds)&&d.viajeIds.length&&(d.viajeIds.length!==ids.length||d.viajeIds.some(x=>!ids.includes(x))))deny('La factura de una orden de compra incluye exactamente los viajes de la orden.','VALIDACION');
    if(!oc)ids.forEach(id=>{const o2=ocDeViaje(id);if(o2)deny(`El viaje ${id} está en la orden de compra ${o2.id}: se factura desde esa orden una vez aceptada.`,'EN_ORDEN_DE_COMPRA');});
    const nf=String(d.numeroFactura||'').trim(),sf=String(d.serieFactura||'').trim();if(nf)valFactura(nf,null);if(sf)valSerie(sf);
    const ff=String(d.fechaFactura||'').trim();if(ff&&!/^\d{4}-\d{2}-\d{2}$/.test(ff))deny('Fecha de factura no válida.','VALIDACION');
    const ts=ids.map(id=>{
      const t=DB.trips.find(x=>x.id===id);
      if(!t)deny(`El viaje ${id} no existe.`,'NO_EXISTE');
      if(t.proyecto!==cliente)deny(`El viaje ${id} pertenece a otro cliente (${t.proyecto}). Una factura solo puede contener viajes de ${cliente}.`,'CLIENTE_DISTINTO');
      if(t.agrupacionId||['FACTURADO','COBRADO'].includes(t.estado))deny(`El viaje ${id} ya está asociado a la factura ${t.agrupacionId}. Para reasignarlo hay que anular esa factura (permiso restringido).`,'YA_FACTURADO');
      if(t.estado!=='ACEPTADO'||!t.liqAprobadaEn||!puedeVer(A,t))deny(`El viaje ${id} no es elegible para facturación: no está aceptado.`,'NO_ELEGIBLE');
      if(!oc){const mt=ocMotivoTarifa(t);if(mt)deny(`No se puede agrupar el viaje ${id}: ${mt} Aplica o crea la tarifa en Tarifas antes de agrupar.`,'SIN_TARIFA');}
      if(oc){
        const mt=ocMotivoTarifa(t);if(mt)deny(`${OC_TARIFA_MSG}: #${t.noViaje||t.id} (No. de Transporte ${t.shipment||'—'}) · ${ocClienteNombre(t.proyecto)} · ${t.proyectoCat}: ${mt}`,'TARIFA_PENDIENTE');
        const ln=oc.lineas.find(l=>l.viajeId===id);
        if(r2(nn(t.tarifaCliente))!==ln.tarifa)deny(`La tarifa del viaje ${id} cambió respecto de la orden de compra ${oc.id}: se requiere una corrección auditada antes de facturar.`,'TARIFA_CAMBIADA');
      }
      return t;
    });
    /* Regla de trabajo: una agrupación = un cliente y UN solo proyecto (la regla del cliente ya se valida arriba). */
    { const pj=[...new Set(ts.map(t=>t.proyectoCat||''))];if(pj.length>1)deny(`Una agrupación contiene viajes de un solo proyecto. La selección mezcla: ${pj.map(x=>x||'(sin proyecto)').join(', ')}.`,'PROYECTO_DISTINTO'); }
    const gid='AGR-'+pad4(DB.seq.agr++),en=nowIso();
    DB.agrupaciones.push({id:gid,cliente,modalidad:ids.length===1?'INDIVIDUAL':'AGRUPADA',fase:'PREPARADA',viajeIds:ids,serieFactura:sf,numeroFactura:nf,fechaFactura:ff,importeEnviado:null,importesViaje:{},viajesSinImporte:[],importeFacturado:null,envio:null,emision:null,cobros:[],estado:'ACTIVA',creadoPorId:A.id,creadoPor:A.nombre,creadoEn:en,anulada:null,correcciones:[]});
    auditAdd({entidad:'AGRUPACION',accion:ids.length===1?'Factura individual preparada':'Factura de viajes agrupados preparada',campo:'Viajes',nuevo:ids.join(', '),por:A,ref:gid+(nf?` · ${nf}`:'')+(oc?` · ${oc.id}`:'')});
    if(oc){
      DB.agrupaciones[DB.agrupaciones.length-1].ocId=oc.id;oc.agrupacionId=gid;
      oc.historial.push({en,por:A.nombre,porId:A.id,accion:`Factura ${gid} preparada desde la orden de compra`});
      auditAdd({entidad:'OC',accion:'Factura preparada desde la orden de compra',campo:'Factura',nuevo:gid,por:A,ref:oc.id});
    }
    ts.forEach(t=>{t.agrupacionId=gid;if(nf)t.numeroFactura=nf;});     /* se reserva el viaje: no puede ir en otra factura */
    { const g0=DB.agrupaciones[DB.agrupaciones.length-1];g0.historial=[];g0.pdfs=[];g0.evidenciasAutorizacion=[];g0.confirmacion=null;agrHist(g0,A,`Agrupación creada con ${ids.length} viaje(s)`+(nf?` · factura ${nf}`:''),{tipo:'CREACION',a:'Preparada'}); }
    return DB.agrupaciones[DB.agrupaciones.length-1];
  });},
  actualizarFactura(uid,agrId,d){return exec(uid,'actualizarFactura','',A=>{
    need(A,'facturas_emitir','registrar el número y la fecha de la factura');
    const g=DB.agrupaciones.find(x=>x.id===agrId);if(!g)deny('La factura no existe.','NO_EXISTE');
    if(g.estado!=='ACTIVA'||g.fase!=='PREPARADA')deny('Solo se puede registrar la factura en una agrupación preparada (aún no enviada).','ESTADO_INVALIDO');
    if(!g.confirmacion)deny('Falta la OC del cliente: el Asistente Comercial debe registrarla antes de facturar.','SIN_OT');
    const nf=String((d&&d.numeroFactura)||'').trim(),sf=String((d&&d.serieFactura)||'').trim(),ff=String((d&&d.fechaFactura)||'').trim();
    if(nf)valFactura(nf,g.id);
    if(sf)valSerie(sf);
    if(ff&&!/^\d{4}-\d{2}-\d{2}$/.test(ff))deny('Fecha de factura no válida.','VALIDACION');
    if(nf!==g.numeroFactura){auditAdd({entidad:'AGRUPACION',accion:'Facturación: número de factura actualizado',campo:'Número de factura',anterior:g.numeroFactura||'(vacío)',nuevo:nf||'(vacío)',por:A,ref:g.id});g.numeroFactura=nf;g.viajeIds.forEach(id=>{getT(id).numeroFactura=nf;});}
    if(sf!==(g.serieFactura||'')){auditAdd({entidad:'AGRUPACION',accion:'Facturación: serie de factura actualizada',campo:'Serie de factura',anterior:g.serieFactura||'(vacío)',nuevo:sf||'(vacío)',por:A,ref:g.id});g.serieFactura=sf;}
    if(ff!==g.fechaFactura){auditAdd({entidad:'AGRUPACION',accion:'Facturación: fecha de factura actualizada',campo:'Fecha de factura',anterior:g.fechaFactura||'(vacío)',nuevo:ff||'(vacío)',por:A,ref:g.id});g.fechaFactura=ff;}
    return g;
  });},
  enviarFactura(uid,agrId){return exec(uid,'enviarFactura','',A=>{
    need(A,'facturas_emitir','recibir agrupaciones en facturación');
    const g=DB.agrupaciones.find(x=>x.id===agrId);if(!g)deny('La factura no existe.','NO_EXISTE');
    if(g.estado!=='ACTIVA'||g.fase!=='PREPARADA')deny(g.fase==='PREPARADA'?'La factura está anulada.':'Esta factura ya fue enviada a facturación.','ESTADO_INVALIDO');
    if(!g.confirmacion)deny('La agrupación aún no tiene la confirmación del cliente registrada por Comercial: no se puede facturar.','SIN_CONFIRMACION');
    const falt=faltantesEnvio(g.cliente,g.viajeIds,g.numeroFactura,g.fechaFactura,g.id,g.serieFactura);
    if(falt.length){const e=new ApiError('FALTAN_CAMPOS','No se puede enviar: falta '+falt.map(x=>x.msg).join('; ')+'.');e.faltantes=falt;throw e;}
    const importesViaje={};let tot=0;
    g.viajeIds.forEach(id=>{const v=nn(getT(id).tarifaCliente);importesViaje[id]=v;tot+=v;});
    const en=nowIso();
    g.importesViaje=importesViaje;g.importeEnviado=r2(tot);g.viajesSinImporte=[];g.fase='ENVIADA';g.envio={porId:A.id,por:A.nombre,en,resultado:'OK'};
    ocHistFactura(g,A,en,`Factura ${g.id} (${g.numeroFactura}) recibida en facturación`);
    agrHist(g,A,`Facturación recibió la agrupación confirmada · factura ${g.numeroFactura} · Q ${g.importeEnviado}`,{tipo:'FACTURACION',de:'OC recibida',a:'En facturación'});
    auditAdd({entidad:'AGRUPACION',accion:'Factura enviada a facturación',campo:'Fase',anterior:'Preparada',nuevo:'Enviada a facturación',por:A,ref:`${g.id} · ${g.numeroFactura} · Q ${g.importeEnviado}`});
    g.viajeIds.forEach(id=>{const t=getT(id);t.numeroFactura=g.numeroFactura;moveEstado(t,'FACTURADO',A,'Factura asignada','',`${g.id} · ${g.numeroFactura}`);});
    return g;
  });},
  emitirFactura(uid,agrId,d){return exec(uid,'emitirFactura','',A=>{
    need(A,'facturas_emitir','marcar facturas como emitidas');
    const g=DB.agrupaciones.find(x=>x.id===agrId);if(!g)deny('La factura no existe.','NO_EXISTE');
    if(g.estado!=='ACTIVA'||g.fase!=='ENVIADA')deny(g.fase==='EMITIDA'?'La factura ya está emitida.':'Solo una factura ya enviada a facturación puede marcarse como emitida.','ESTADO_INVALIDO');
    if(!/^\d{4}-\d{2}-\d{2}$/.test((d&&d.fechaEmision)||''))deny('Falta la fecha de emisión.','VALIDACION');
    const imp=nn(d.importe);if(imp==null||imp<=0)deny('Falta el importe emitido (mayor a cero).','VALIDACION');
    const ev=String(d.evidencia||'').trim();
    if(ev.length<5)deny('Una factura no se marca como emitida sin evidencia: registra el UUID, serie y número o referencia de autorización de la factura emitida.','SIN_EVIDENCIA');
    let arch='',archPath='';
    if(d.archivo&&typeof d.archivo==='object'&&typeof d.archivo.path==='string'){
      if(!new RegExp('^facturas/'+agrId+'/[A-Za-z0-9._-]{8,90}$').test(d.archivo.path))deny('La ruta del archivo no corresponde a esta factura.','VALIDACION');
      if(!ENV.storageExists(d.archivo.path))deny('El archivo de evidencia no está en el almacenamiento: vuelve a subirlo.','VALIDACION');
      archPath=d.archivo.path;
    }else if(d.archivo){if(typeof d.archivo!=='string'||!/^data:(image\/|application\/pdf)/.test(d.archivo))deny('El archivo de evidencia debe ser imagen o PDF.','VALIDACION');if(d.archivo.length>3000000)deny('El archivo de evidencia es demasiado grande (máx. 2 MB).','VALIDACION');arch=d.archivo;}
    const sinTarifa=g.viajeIds.filter(id=>!(nn((g.importesViaje||{})[id])>0));
    if(sinTarifa.length)deny(`${OC_TARIFA_MSG}: no se puede emitir la factura porque el viaje ${sinTarifa[0]} no tiene tarifa de cobro válida.`,'TARIFA_PENDIENTE');
    if(!arch&&!archPath)deny('Adjunta la captura de pantalla o el comprobante del envío de la factura al cliente: sin ese respaldo no se registra el envío.','SIN_EVIDENCIA');
    const dif=Math.abs(imp-g.importeEnviado)>0.005,mot=String(d.motivoDiferencia||'').trim();
    if(dif&&mot.length<5)deny(`El importe emitido (Q ${r2(imp)}) difiere de lo enviado a facturar (Q ${g.importeEnviado}): explica el motivo.`,'VALIDACION');
    g.fase='EMITIDA';g.importeFacturado=r2(imp);
    g.emision={porId:A.id,por:A.nombre,en:nowIso(),fecha:d.fechaEmision,importe:r2(imp),evidencia:ev,archivo:arch,archivoPath:archPath,motivoDiferencia:dif?mot:''};
    ocHistFactura(g,A,g.emision.en,`Factura ${g.id} (${g.numeroFactura}) emitida y enviada al cliente · Q ${g.importeFacturado} · ${ev} · comprobante adjunto`);
    agrHist(g,A,`Factura enviada al cliente (comprobante adjunto) · ${g.numeroFactura} · Q ${g.importeFacturado} · ${ev}`,{tipo:'ENVIO_FACTURA',de:'En facturación',a:'Factura enviada'});
    auditAdd({entidad:'AGRUPACION',accion:'Factura emitida oficialmente (con evidencia)',campo:'Fase',anterior:'Enviada a facturación',nuevo:'Emitida',por:A,motivo:dif?mot:'',ref:`${g.id} · ${g.numeroFactura} · Q ${g.importeFacturado} · ${ev}`});
    return g;
  });},

  /* ----- Reportes PDF de la agrupación (interno y para el cliente) ----- */
  /* Consulta de importes (Analista y Facturación): lo AUTORIZADO por el cliente (versión del PDF), lo vigente hoy y lo facturado.
     No modifica nada: si una tarifa cambió después de la confirmación solo se advierte; la agrupación confirmada no se altera. */
  agrImportes(uid,agrId){const A=actor(uid);{
    need(A,'comercial_ver','consultar los importes de la agrupación');
    const g=agrPorId(agrId),cli=(g.pdfs||[]).filter(p=>p.tipo==='CLIENTE');
    const ref=g.confirmacion?cli.find(p=>p.version===g.confirmacion.pdfVersion):cli[cli.length-1];
    const full=hasPerm(A,'oc_ver_combustible')||hasPerm(A,'finanzas_ver')||hasPerm(A,'facturas_emitir');
    const aut=ref?ref.lineas.map(l=>Object.assign({},l,full?{}:{combustible:null})):[];
    const vig=agrLineas(A,g);
    const dif=[];
    aut.forEach(a=>{const v=vig.lineas.find(x=>x.viajeId===a.viajeId);
      if(!v)dif.push({viajeId:a.viajeId,motivo:'Ya no tiene una tarifa válida vigente.'});
      else if(v.cobro!==a.cobro)dif.push({viajeId:a.viajeId,noViaje:a.noViaje,autorizado:a.cobro,vigente:v.cobro,motivo:'La tarifa vigente hoy es distinta de la autorizada.'});});
    vig.pend.forEach(p=>{if(!dif.some(x=>x.viajeId===p.viajeId))dif.push({viajeId:p.viajeId,noViaje:p.noViaje,motivo:p.motivo});});
    return {agrupacion:g.id,numeroFactura:g.numeroFactura||'',pdfVersion:ref?ref.version:null,confirmada:!!g.confirmacion,autorizadas:aut,totalAutorizado:ref?ref.total:null,
      vigentes:vig.lineas,totalVigente:vig.total,facturado:g.fase==='PREPARADA'?null:{importes:g.importesViaje||{},total:g.importeFacturado==null?g.importeEnviado:g.importeFacturado},diferencias:dif,combustibleVisible:full};
  }},
  agrPrevisualizar(uid,agrId,d){const A=actor(uid);need(A,'comercial_ver','ver el módulo Comercial');
    const g=agrPorId(agrId);return agrArmar(A,g,d&&d.tipo,d&&d.opcionales);},
  /* El PDF se conserva por versiones (tipo + número): registrar otro NO borra ni reemplaza el anterior. */
  agrRegistrarPdf(uid,agrId,d){return exec(uid,'agrRegistrarPdf','',A=>{
    need(A,'comercial_agrupar','generar los reportes de la agrupación');
    const g=agrPorId(agrId);agrEditable(g);
    const r=agrArmar(A,g,d&&d.tipo,d&&d.opcionales);
    if(r.pendientes.length){const p=r.pendientes[0];const e=new ApiError('TARIFA_PENDIENTE',`${OC_TARIFA_MSG}: #${p.noViaje||p.viajeId} (No. de Transporte ${p.shipment||'—'}): ${p.motivo} No se genera un reporte de cobro con datos incompletos.`);e.pendientes=r.pendientes;throw e;}
    if(!r.lineas.length)deny('La agrupación no tiene viajes.','VALIDACION');
    if(!d.huella||d.huella!==r.huella)deny('Los datos de la agrupación cambiaron mientras se generaba el PDF: genera el reporte de nuevo. (ref. '+r.huella+')','DATOS_CAMBIARON');
    if(!Array.isArray(g.pdfs))g.pdfs=[];
    const previas=g.pdfs.filter(p=>p.tipo===d.tipo),version=previas.length+1,motivo=String(d.motivo||'').trim();
    if(version>1&&motivo.length<5)deny('Indica el motivo de generar una nueva versión del reporte (mínimo 5 caracteres).','VALIDACION');
    const arch=agrArchivo(A,g,d.archivo,(d.tipo==='INTERNO'?'interno-':'cliente-'));
    let hash=String(d.hash||'').trim().toLowerCase();if(!/^[a-f0-9]{16,64}$/.test(hash))hash=(typeof d.archivo==='string'&&d.archivo)?fnv(d.archivo):'';if(hash.length<8)deny('Falta la huella (hash) del PDF.','VALIDACION');
    const doc=Object.assign({tipo:d.tipo,version,hash,huella:r.huella,columnas:r.columnas.map(c=>c[0]),opcionales:r.opcionales,total:r.total,viajes:r.lineas.length,
      lineas:r.lineas,motivo,por:A.nombre,porId:A.id,en:nowIso()},arch);
    g.pdfs.push(doc);
    agrHist(g,A,`Reporte ${d.tipo==='INTERNO'?'interno':'para el cliente'} generado (versión ${version})`+(motivo?': '+motivo:''),{tipo:'PDF'});
    auditAdd({entidad:'AGRUPACION',accion:'Reporte PDF de agrupación generado',campo:'Versión',nuevo:`${d.tipo} v${version}`,por:A,motivo,ref:`${g.id} · ${hash.slice(0,12)}`});
    return redactAgr(A,g);
  });},
  /* Evidencia de la autorización del cliente (correo, mensaje…). Solo se agrega: nunca se reemplaza ni se borra. */
  agrAdjuntarEvidencia(uid,agrId,d){return exec(uid,'agrAdjuntarEvidencia','',A=>{
    need(A,'comercial_ot','registrar la OC del cliente');
    const g=agrPorId(agrId);agrEditable(g);
    const cli=(g.pdfs||[]).filter(p=>p.tipo==='CLIENTE');
    if(!cli.length)deny('Primero genera el reporte PDF del cliente: la autorización se refiere a esa versión.','SIN_PDF_CLIENTE');
    const arch=agrArchivo(A,g,d&&d.archivo,'autorizacion-');
    if(!Array.isArray(g.evidenciasAutorizacion))g.evidenciasAutorizacion=[];
    const ev=Object.assign({id:'EV-'+(g.evidenciasAutorizacion.length+1),pdfVersion:cli[cli.length-1].version,nota:String((d&&d.nota)||'').trim().slice(0,200),por:A.nombre,porId:A.id,en:nowIso()},arch);
    g.evidenciasAutorizacion.push(ev);
    agrHist(g,A,`Evidencia de autorización del cliente adjuntada (${ev.id}) para el reporte v${ev.pdfVersion}`,{tipo:'EVIDENCIA'});
    auditAdd({entidad:'AGRUPACION',accion:'Evidencia de autorización del cliente adjuntada',campo:'Evidencia',nuevo:ev.id,por:A,ref:`${g.id} · reporte v${ev.pdfVersion}`});
    return redactAgr(A,g);
  });},
  /* El cliente rechazó el reporte: queda el motivo (y la evidencia si se adjunta) ligado a la versión del PDF; la agrupación
     sigue en preparación para corregirla y generar una nueva versión. Nunca borra versiones ni evidencias. */
  agrRechazarCliente(uid,agrId,d){return exec(uid,'agrRechazarCliente','',A=>{
    need(A,'comercial_ot','registrar el rechazo del cliente');
    const g=agrPorId(agrId);agrEditable(g);
    const cli=(g.pdfs||[]).filter(p=>p.tipo==='CLIENTE'),ult=cli[cli.length-1];
    if(!ult)deny('Primero genera el reporte PDF del cliente: el rechazo se refiere a esa versión.','SIN_PDF_CLIENTE');
    const motivo=String((d&&d.motivo)||'').trim();if(motivo.length<5)deny('Indica el motivo del rechazo del cliente (mínimo 5 caracteres).','VALIDACION');
    if((g.rechazos||[]).some(x=>x.pdfVersion===ult.version))deny('El reporte vigente (v'+ult.version+') ya fue registrado como rechazado: genera una nueva versión corregida.','ESTADO_INVALIDO');
    const arch=(d&&d.archivo)?agrArchivo(A,g,d.archivo,'rechazo-'):{};
    if(!Array.isArray(g.rechazos))g.rechazos=[];
    const rz=Object.assign({id:'RZ-'+(g.rechazos.length+1),pdfVersion:ult.version,motivo:motivo.slice(0,300),por:A.nombre,porId:A.id,en:nowIso()},arch);
    g.rechazos.push(rz);
    agrHist(g,A,`El cliente rechazó el reporte v${ult.version}: ${rz.motivo}`,{tipo:'RECHAZO',de:'Reporte generado',a:'Rechazada por el cliente'});
    auditAdd({entidad:'AGRUPACION',accion:'Cliente rechazó el reporte de la agrupación',campo:'Estado',anterior:'Reporte generado',nuevo:'Rechazada por el cliente',por:A,motivo:rz.motivo,ref:`${g.id} · reporte v${ult.version}`});
    return redactAgr(A,g);
  });},
  confirmarCliente(uid,agrId,d){return exec(uid,'confirmarCliente','',A=>{
    need(A,'comercial_ot','registrar la OC del cliente');
    const g=agrPorId(agrId);agrEditable(g);
    const ot=String((d&&d.ot)||'').trim();
    if(ot.length<1||ot.length>60)deny('Escribe el número de OC que entregó el cliente (1 a 60 caracteres).','VALIDACION');
    const cli=(g.pdfs||[]).filter(p=>p.tipo==='CLIENTE'),ult=cli[cli.length-1];
    if(!ult)deny('Genera el reporte PDF del cliente antes de registrar la OC.','SIN_PDF_CLIENTE');
    if((g.rechazos||[]).some(x=>x.pdfVersion===ult.version))deny('El cliente rechazó el reporte v'+ult.version+': genera una nueva versión corregida antes de registrar la OC.','ESTADO_INVALIDO');
    const evs=(g.evidenciasAutorizacion||[]).filter(e=>e.pdfVersion===ult.version);
    if(!evs.length)deny('Adjunta la evidencia de la OC (correo, orden de trabajo o mensaje del cliente) para el reporte vigente (v'+ult.version+').','SIN_EVIDENCIA');
    const r=agrArmar(A,g,'CLIENTE',ult.opcionales);
    if(r.pendientes.length)deny(`${OC_TARIFA_MSG}: no se puede registrar la OC con tarifas incompletas.`,'TARIFA_PENDIENTE');
    if(r.huella!==ult.huella)deny('Los viajes o tarifas cambiaron después de generar el reporte enviado al cliente: genera una nueva versión y registra su OC.','DATOS_CAMBIARON');
    const en=nowIso();
    g.confirmacion={porId:A.id,por:A.nombre,en,ot,referencia:ot,pdfVersion:ult.version,pdfPath:ult.path||'',pdfHash:ult.hash,evidencias:evs.map(e=>e.id)};
    g.otNumero=ot;
    agrHist(g,A,`OC ${ot} recibida del cliente: reporte v${ult.version} (${evs.length} evidencia(s)) · lista para facturación`,{tipo:'OC',de:'Reporte enviado',a:'OC recibida'});
    auditAdd({entidad:'AGRUPACION',accion:'OC del cliente registrada',campo:'OC',anterior:'',nuevo:ot,por:A,ref:`${g.id} · reporte v${ult.version}`});
    notificar(A,{tipo:'AGR_CONFIRMADA',destinatarios:['FACTURACION'],asunto:`Agrupación ${g.id} con OC ${ot}: lista para facturar`,detalle:{agrupacion:g.id,cliente:ocClienteNombre(g.cliente),ot,viajes:g.viajeIds.length,total:'Q '+r.total,registradaPor:A.nombre}});
    return redactAgr(A,g);
  });},
  registrarCobro(uid,agrId,d){return exec(uid,'registrarCobro','',A=>{
    need(A,'cobros_registrar','registrar cobros');
    const g=DB.agrupaciones.find(x=>x.id===agrId);if(!g)deny('La factura no existe.','NO_EXISTE');
    if(g.estado!=='ACTIVA')deny('La factura está anulada.','ESTADO_INVALIDO');
    if(g.fase!=='EMITIDA')deny('Un cobro requiere una factura emitida con evidencia: enviar a facturación no es emitir, ni cobrar.','SIN_FACTURA');
    const m=nn(d&&d.monto);if(m==null||m<=0)deny('El monto cobrado debe ser mayor a cero.','VALIDACION');
    if(!/^\d{4}-\d{2}-\d{2}$/.test((d&&d.fecha)||''))deny('Fecha de cobro no válida.','VALIDACION');
    const ref=String((d&&d.referencia)||'').trim();if(ref.length<3||ref.length>40)deny('La referencia del cobro es obligatoria (3 a 40 caracteres).','VALIDACION');
    const ya=cobradoDe(g);
    if(ya+m>g.importeFacturado+0.005)deny(`El cobro excede lo facturado (Q ${g.importeFacturado}); ya cobrado Q ${ya}. Saldo: Q ${r2(g.importeFacturado-ya)}.`,'EXCEDE_IMPORTE');
    if(g.cobros.some(c=>c.referencia.toLowerCase()===ref.toLowerCase()))deny('Ya existe un cobro con esa referencia en esta factura.','DUPLICADO');
    const c={id:'COB-'+pad4(DB.seq.cob++),monto:r2(m),fecha:d.fecha,referencia:ref,porId:A.id,por:A.nombre,en:nowIso()};
    if(d.archivo){const ar=agrArchivo(A,g,d.archivo,'cobro-');c.archivoPath=ar.path||'';c.archivo=ar.data||'';c.archivoNombre=ar.nombre||'';}
    const etA=ETAPA_L[etapaAgr(g)];
    g.cobros.push(c);
    agrHist(g,A,`Cobro registrado: Q ${c.monto} · ${ref}`+(d.archivo?' · comprobante adjunto':''),{tipo:'COBRO',de:etA,a:ETAPA_L[etapaAgr(g)]});
    auditAdd({entidad:'AGRUPACION',accion:'Cobro registrado',campo:'Cobrado',nuevo:'Q '+c.monto,por:A,ref:`${g.id} · ${c.id} · ${ref}`});
    if(cobradoDe(g)>=g.importeFacturado-0.005)g.viajeIds.forEach(id=>{const t=getT(id);if(t.estado==='FACTURADO')moveEstado(t,'COBRADO',A,'Factura cobrada','',`${g.id} · ${c.id} · ${ref}`);});
    return c;
  });},
  corregirFactura(uid,agrId,numero,motivo){return exec(uid,'corregirFactura','',A=>{
    need(A,'comercial_corregir','corregir números de factura');
    const g=DB.agrupaciones.find(x=>x.id===agrId);if(!g)deny('La factura no existe.','NO_EXISTE');
    if(g.estado!=='ACTIVA'||!g.numeroFactura)deny('Solo se corrige el número de una factura activa que ya lo tiene.','ESTADO_INVALIDO');
    const m=String(motivo||'').trim();if(m.length<5)deny('El motivo de la corrección es obligatorio (mínimo 5 caracteres).','VALIDACION');
    const nf=String(numero||'').trim();valFactura(nf,g.id);
    if(nf===g.numeroFactura)deny('El número de factura es el mismo.','VALIDACION');
    const ant=g.numeroFactura;
    g.correcciones.push({anterior:ant,nuevo:nf,porId:A.id,por:A.nombre,en:nowIso(),motivo:m});
    g.numeroFactura=nf;
    agrHist(g,A,`Número de factura corregido: ${ant} → ${nf}. Motivo: ${m}`,{tipo:'CORRECCION'});
    auditAdd({entidad:'AGRUPACION',accion:'Número de factura corregido',campo:'Número de factura',anterior:ant,nuevo:nf,por:A,motivo:m,ref:g.id});
    g.viajeIds.forEach(id=>{const t=getT(id);t.numeroFactura=nf;auditAdd({entidad:'AGRUPACION',viajeId:id,accion:'Número de factura corregido',campo:'Número de factura',anterior:ant,nuevo:nf,por:A,motivo:m,ref:g.id});});
    return g;
  });},
  anularAgrupacion(uid,agrId,motivo){return exec(uid,'anularAgrupacion','',A=>{
    const g=DB.agrupaciones.find(x=>x.id===agrId);if(!g)deny('La factura no existe.','NO_EXISTE');
    /* Una factura preparada todavía no es una factura: basta el permiso de armarlas para descartarla y
       liberar sus viajes. Anular una ya enviada o emitida exige el permiso restringido de anulación. */
    const prep=g.fase==='PREPARADA';
    if(prep)need(A,g.confirmacion?'comercial_ot':'comercial_agrupar',g.confirmacion?'descartar una agrupación ya confirmada por el cliente':'descartar facturas preparadas');
    else need(A,'comercial_anular','anular facturas');
    if(g.estado!=='ACTIVA')deny('La factura ya está anulada.','ESTADO_INVALIDO');
    const m=String(motivo||'').trim();if(m.length<5)deny('El motivo de la anulación es obligatorio (mínimo 5 caracteres).','VALIDACION');
    if(cobradoDe(g)>0)deny('La factura ya tiene cobros registrados: no se puede anular sin revertir antes esos cobros.','TIENE_COBROS');
    const fase=g.fase;
    const etAntes=ETAPA_L[etapaAgr(g)];
    g.estado='ANULADA';g.anulada={porId:A.id,por:A.nombre,en:nowIso(),motivo:m,faseAlAnular:fase};
    agrHist(g,A,(prep?'Agrupación descartada: ':'Factura anulada: ')+m,{tipo:'ANULACION',de:etAntes,a:'Anulada'});
    auditAdd({entidad:'AGRUPACION',accion:prep?'Factura preparada descartada':'Factura anulada',campo:'Estado',anterior:'ACTIVA',nuevo:'ANULADA',por:A,motivo:m,ref:`${g.id}${g.numeroFactura?' · '+g.numeroFactura:''}`});
    if(g.ocId){const oc=(DB.ordenesCompra||[]).find(x=>x.id===g.ocId);if(oc&&oc.agrupacionId===g.id){oc.agrupacionId='';oc.historial.push({en:nowIso(),por:A.nombre,porId:A.id,accion:`Factura ${g.id} anulada: la orden vuelve a estar disponible para facturar`});auditAdd({entidad:'OC',accion:'Factura de la orden de compra anulada',campo:'Factura',anterior:g.id,nuevo:'(sin factura)',por:A,motivo:m,ref:oc.id});}}
    g.viajeIds.forEach(id=>{
      const t=getT(id);const prev=`${g.id}${t.numeroFactura?' · '+t.numeroFactura:''}`;
      t.agrupacionId='';t.numeroFactura='';
      if(t.estado==='FACTURADO')moveEstado(t,'ACEPTADO',A,'Asignación comercial anulada',m,prev);
      else auditAdd({entidad:'AGRUPACION',viajeId:id,accion:'Reserva de factura liberada',campo:'Factura',anterior:prev,nuevo:'(liberado)',por:A,motivo:m});
    });
    return g;
  });},

  /* ----- órdenes de compra ----- */
  /* Lectura: lista de OC (sin el ajuste de combustible si el perfil no tiene su permiso propio). */
  ordenesCompra(uid){const A=actor(uid);need(A,'oc_ver','ver las órdenes de compra');ocGuardar();
    /* Quien solo consulta (Facturación) ve únicamente las OC que Comercial ya confirmó (ACEPTADA); el resto del ciclo es de Comercial. */
    const gestiona=OC_ESCRIBE.some(p=>hasPerm(A,p));
    return DB.ordenesCompra.filter(o=>gestiona||o.estado==='ACEPTADA').map(o=>redactOC(A,o));},
  /* Lectura: viajes de un cliente/proyecto clasificados para armar una OC (elegibles, pendientes de tarifa, no disponibles). */
  ocDisponibles(uid,d){const A=actor(uid);need(A,'oc_preparar','preparar órdenes de compra');
    d=d||{};const out=[];
    DB.trips.forEach(t=>{
      if((d.cliente&&t.proyecto!==d.cliente)||(d.proyecto&&t.proyectoCat!==d.proyecto)||!puedeVer(A,t))return;
      if(t.estado!=='ACEPTADO'&&!ocDeViaje(t.id))return;
      const c=ocClasificar(t);
      out.push(Object.assign({viajeId:t.id,tipo:c.k,motivo:c.motivo,ocId:c.ocId||''},ocLinea(t,hasPerm(A,'oc_ver_combustible'))));
    });
    return out;
  },
  /* Lectura: vista previa de la OC con las mismas reglas que la generación. No guarda nada. */
  ocPrevisualizar(uid,d){const A=actor(uid);need(A,'oc_preparar','preparar órdenes de compra');return ocArmar(A,d);},
  ocGenerar(uid,d){return exec(uid,'ocGenerar','',A=>{
    need(A,'oc_preparar','preparar órdenes de compra');
    const r=ocArmar(A,d);
    if(!r.ok)throw ocErrorArmado(r);
    return redactOC(A,ocCrear(A,r,{}));
  });},
  /* Corregir / nueva versión. Aplica a una OC enviada, aceptada (sin factura activa) o rechazada. La original NO se
     borra ni se edita: conserva sus líneas, PDFs, respuesta e historial y pasa a REEMPLAZADA. La nueva OC (PREPARADA)
     toma los viajes en la misma operación, de modo que un viaje nunca queda en dos OC activas. */
  ocCorregir(uid,ocId,d){return exec(uid,'ocCorregir','',A=>{
    need(A,'oc_corregir','corregir órdenes de compra');
    need(A,'oc_preparar','preparar la nueva versión de la orden de compra');
    const o=ocPorId(ocId);
    if(!['ENVIADA','ACEPTADA','RECHAZADA'].includes(o.estado))deny('Solo una orden de compra enviada, aceptada o rechazada puede corregirse con una nueva versión (la preparada se descarta o se edita; la anulada o reemplazada ya está cerrada).','ESTADO_INVALIDO');
    if(ocFacturaActiva(o))deny(`La orden de compra tiene la factura ${o.agrupacionId} activa: anula primero esa factura.`,'TIENE_FACTURA');
    const m=String((d&&d.motivo)||'').trim();if(m.length<5)deny('El motivo de la corrección es obligatorio (mínimo 5 caracteres).','VALIDACION');
    const ids=Array.isArray(d&&d.viajeIds)&&d.viajeIds.length?d.viajeIds:o.viajeIds.slice();
    const cols=Array.isArray(d&&d.columnas)?d.columnas:(o.columnas||[]);
    /* Valida la nueva versión con los viajes de la original considerados libres (solo durante esta validación). */
    OC_IGNORAR=o.id;let r;
    try{r=ocArmar(A,{cliente:o.cliente,proyecto:o.proyecto,viajeIds:ids,columnas:cols});}finally{OC_IGNORAR='';}
    if(!r.ok)throw ocErrorArmado(r);
    const en=nowIso(),antes=o.estado;
    /* Cierra la original y libera sus viajes; la nueva los toma enseguida (misma operación, un solo guardado). */
    o.estado='REEMPLAZADA';o.correccion={porId:A.id,por:A.nombre,en,motivo:m,estadoAlCorregir:antes};
    o.lineas.forEach(l=>{const t=DB.trips.find(x=>x.id===l.viajeId);if(t&&t.ocId===o.id)t.ocId='';});
    const n=ocCrear(A,r,{reemplazaA:o.id,version:(o.version||1)+1,motivo:m});
    o.reemplazadaPor=n.id;
    o.historial.push({en,por:A.nombre,porId:A.id,accion:`Corregida (era ${OC_ESTADOS[antes]}): reemplazada por ${n.id}. Motivo: ${m}`});
    auditAdd({entidad:'OC',accion:'Orden de compra corregida (nueva versión)',campo:'Estado',anterior:OC_ESTADOS[antes],nuevo:'Reemplazada por '+n.id,por:A,motivo:m,ref:`${o.id} → ${n.id}`});
    notificar(A,{tipo:'OC_CORREGIDA',destinatarios:['GERENTE_COMERCIAL','ANALISTA_COMERCIAL'],asunto:`Orden de compra ${o.id} corregida: nueva versión ${n.id}`,detalle:{orden:o.id,nueva:n.id,cliente:o.clienteNombre,proyecto:o.proyecto,motivo:m,corregidaPor:A.nombre}});
    return redactOC(A,n);
  });},
  /* El PDF se conserva por versiones: registrar otro PDF NO borra el anterior. Solo mientras la OC está preparada. */
  ocRegistrarPdf(uid,ocId,d){return exec(uid,'ocRegistrarPdf','',A=>{
    need(A,'oc_preparar','generar el PDF de la orden de compra');
    const o=ocPorId(ocId);
    if((o.columnas||[]).includes('combustible')&&!hasPerm(A,'oc_ver_combustible'))deny('Esta orden incluye la columna de combustible: solo quien tiene ese permiso puede generar su PDF.','SIN_PERMISO');
    if(o.estado!=='PREPARADA')deny('El PDF solo se puede generar mientras la orden de compra está preparada (no enviada).','ESTADO_INVALIDO');
    const doc=ocDocumento(A,o,d,String((d&&d.motivo)||'').trim());
    if(doc.version>1&&doc.motivo.length<5)deny('Indica el motivo de generar una nueva versión del PDF (mínimo 5 caracteres).','VALIDACION');
    o.documentos.push(doc);
    o.historial.push({en:doc.en,por:A.nombre,porId:A.id,accion:`PDF generado (versión ${doc.version})`});
    auditAdd({entidad:'OC',accion:'PDF de orden de compra generado',campo:'Versión',nuevo:String(doc.version),por:A,motivo:doc.motivo,ref:`${o.id} · ${doc.hash.slice(0,12)}`});
    return redactOC(A,o);
  });},
  ocEnviar(uid,ocId,d){return exec(uid,'ocEnviar','',A=>{
    need(A,'oc_enviar','confirmar el envío de órdenes de compra');
    const o=ocPorId(ocId);
    if(o.estado!=='PREPARADA')deny('Solo una orden de compra preparada puede enviarse.','ESTADO_INVALIDO');
    if(!(o.documentos||[]).length)deny('Genera el PDF de la orden de compra antes de registrar su envío.','SIN_DOCUMENTO');
    /* La tarifa se vuelve a validar al enviar: ningún viaje sin tarifa vigente sale en una OC. */
    const mal=o.lineas.map(l=>({l,t:DB.trips.find(x=>x.id===l.viajeId)})).filter(x=>ocMotivoTarifa(x.t)||(x.t&&r2(nn(x.t.tarifaCliente))!==x.l.tarifa));
    if(mal.length){const x=mal[0];throw new ApiError('TARIFA_PENDIENTE',`${OC_TARIFA_MSG}: #${(x.t&&x.t.noViaje)||x.l.viajeId} (No. de Transporte ${x.l.shipment||'—'}) · ${o.clienteNombre} · ${o.proyecto}: ${(x.t&&ocMotivoTarifa(x.t))||'la tarifa cambió después de preparar la orden.'}`);}
    const dest=String((d&&d.destinatario)||'').trim().slice(0,120),medio=String((d&&d.medio)||'').trim().slice(0,40),en=nowIso();
    o.estado='ENVIADA';o.envio={porId:A.id,por:A.nombre,en,destinatario:dest,medio,documentoVersion:o.documentos.length};
    o.historial.push({en,por:A.nombre,porId:A.id,accion:'Envío al cliente confirmado'+(dest?' a '+dest:'')});
    auditAdd({entidad:'OC',accion:'Orden de compra enviada al cliente',campo:'Estado',anterior:'Preparada',nuevo:'Enviada al cliente',por:A,ref:`${o.id} · Q ${o.total}`+(dest?` · ${dest}`:'')});
    notificar(A,{tipo:'OC_ENVIADA',destinatarios:['FACTURACION'],asunto:`Orden de compra ${o.id} pendiente de confirmación del cliente`,detalle:{orden:o.id,cliente:o.clienteNombre,proyecto:o.proyecto,viajes:o.lineas.length,total:'Q '+o.total,enviadaPor:A.nombre}});
    return redactOC(A,o);
  });},
  /* Respuesta del cliente. Permiso propio (oc_responder): lo tienen Comercial, Gerencia y Administrador. No reutiliza
     liq_aprobar/liq_devolver ni ningún permiso de Liquidaciones, Finanzas o Facturación. */
  ocResponder(uid,ocId,d){return exec(uid,'ocResponder','',A=>{
    need(A,'oc_responder','registrar la respuesta del cliente a una orden de compra');
    const o=ocPorId(ocId);
    if(o.estado!=='ENVIADA')deny('Solo una orden de compra enviada al cliente puede aceptarse o rechazarse.','ESTADO_INVALIDO');
    const res=d&&d.resultado;if(!['ACEPTADA','RECHAZADA'].includes(res))deny('Indica si el cliente aceptó o rechazó la orden de compra.','VALIDACION');
    const ref=String((d&&d.referencia)||'').trim(),mot=String((d&&d.motivo)||'').trim();
    if(res==='ACEPTADA'&&ref.length<3)deny('Registra la referencia con la que el cliente aceptó (mínimo 3 caracteres).','VALIDACION');
    if(res==='RECHAZADA'&&mot.length<5)deny('Registra el motivo del rechazo (mínimo 5 caracteres).','VALIDACION');
    if(res==='ACEPTADA'&&!(Array.isArray(d.evidencias)&&d.evidencias.length))deny('Adjunta la evidencia de la confirmación del cliente (correo, orden firmada o captura).','SIN_EVIDENCIA');
    const evid=[];
    (Array.isArray(d.evidencias)?d.evidencias:[]).slice(0,5).forEach(a=>{
      if(a&&typeof a==='object'&&typeof a.path==='string'){
        if(!new RegExp('^oc/'+o.id+'/[A-Za-z0-9._-]{8,90}$').test(a.path))deny('La ruta de la evidencia no corresponde a esta orden de compra.','VALIDACION');
        if(!ENV.storageExists(a.path))deny('La evidencia no está en el almacenamiento: vuelve a subirla.','VALIDACION');
        evid.push({path:a.path,nombre:String(a.nombre||'').slice(0,80)});
      }else if(typeof a==='string'){
        if(ENV.soloAlmacenamiento)deny('La evidencia debe subirse al almacenamiento privado antes de registrarse.','VALIDACION');
        if(!/^data:(image\/|application\/pdf)/.test(a)||a.length>3000000)deny('La evidencia debe ser imagen o PDF de máximo 2 MB.','VALIDACION');
        evid.push({data:a});
      }else deny('Evidencia no válida.','VALIDACION');
    });
    const en=nowIso();
    o.estado=res;o.respuesta={resultado:res,porId:A.id,por:A.nombre,en,referencia:ref,motivo:mot,evidencias:evid};
    o.historial.push({en,por:A.nombre,porId:A.id,accion:res==='ACEPTADA'?'Aceptada por el cliente'+(ref?' ('+ref+')':''):'Rechazada por el cliente: '+mot});
    auditAdd({entidad:'OC',accion:res==='ACEPTADA'?'Orden de compra aceptada por el cliente':'Orden de compra rechazada por el cliente',campo:'Estado',anterior:'Enviada al cliente',nuevo:OC_ESTADOS[res],por:A,motivo:mot,ref:`${o.id}${ref?' · '+ref:''}`});
    notificar(A,{tipo:res==='ACEPTADA'?'OC_ACEPTADA':'OC_RECHAZADA',destinatarios:res==='ACEPTADA'?['FACTURACION','GERENTE_COMERCIAL','ANALISTA_COMERCIAL']:['GERENTE_COMERCIAL','ANALISTA_COMERCIAL'],asunto:res==='ACEPTADA'?`Orden de compra ${o.id} aceptada: disponible para facturar`:`Orden de compra ${o.id} rechazada por el cliente`,detalle:{orden:o.id,cliente:o.clienteNombre,proyecto:o.proyecto,total:'Q '+o.total,motivo:mot||undefined}});
    return redactOC(A,o);
  });},
  ocAnular(uid,ocId,motivo){return exec(uid,'ocAnular','',A=>{
    const o=ocPorId(ocId);
    need(A,o.estado==='PREPARADA'?'oc_preparar':'oc_corregir',o.estado==='PREPARADA'?'descartar órdenes de compra preparadas':'anular órdenes de compra ya enviadas');
    if(o.estado==='ANULADA'||o.estado==='REEMPLAZADA')deny('La orden de compra ya está cerrada ('+OC_ESTADOS[o.estado].toLowerCase()+').','ESTADO_INVALIDO');
    if(ocFacturaActiva(o))deny(`La orden de compra tiene la factura ${o.agrupacionId} activa: anula primero esa factura.`,'TIENE_FACTURA');
    const m=String(motivo||'').trim();if(m.length<5)deny('El motivo de la anulación es obligatorio (mínimo 5 caracteres).','VALIDACION');
    const en=nowIso(),antes=o.estado;
    o.estado='ANULADA';o.anulada={porId:A.id,por:A.nombre,en,motivo:m,estadoAlAnular:antes};
    o.historial.push({en,por:A.nombre,porId:A.id,accion:'Orden de compra anulada: '+m});
    o.lineas.forEach(l=>{const t=DB.trips.find(x=>x.id===l.viajeId);if(t&&t.ocId===o.id){t.ocId='';auditAdd({entidad:'OC',viajeId:t.id,accion:'Viaje liberado de la orden de compra',campo:'Orden de compra',anterior:o.id,nuevo:'(liberado)',por:A,motivo:m});}});
    auditAdd({entidad:'OC',accion:'Orden de compra anulada',campo:'Estado',anterior:OC_ESTADOS[antes],nuevo:'Anulada',por:A,motivo:m,ref:o.id});
    return redactOC(A,o);
  });},

  /* ----- finanzas: costos, pagos y consulta ----- */
  movimientosComerciales(uid){
    const A=actor(uid);need(A,'comercial_ver','ver el módulo Comercial');
    return DB.audit.filter(e=>e.entidad==='AGRUPACION').map(e=>({id:e.id,accion:e.accion,campo:e.campo,anterior:e.anterior,nuevo:e.nuevo,por:e.por,en:e.en,motivo:e.motivo,ref:e.ref}));
  },

  /* ----- tarifas ----- */
});

/* Dominio del motor · generado por separación de js/engine.js. */
Object.assign(API,{
  registrarImportes(uid,id,d){return exec(uid,'registrarImportes',id,A=>{
    const t=getT(id);if(!puedeVer(A,t))deny('No tienes acceso a este viaje.');
    const ks=Object.keys(d||{});if(!ks.length)deny('No hay importes que registrar.','VALIDACION');
    const nv={};
    ks.forEach(k=>{
      if(k==='costoProveedor'){
        need(A,'costos_registrar','registrar costos de proveedores');
        if(!FIN.includes(t.estado))deny('El costo solo se registra cuando el viaje ya finalizó.','ESTADO_INVALIDO');
      }else if(k==='tarifaCliente')deny('La tarifa del cliente no se escribe a mano: se aplica desde el catálogo de Tarifas (ruta, capacidad y vigencia).','CAMPO_NO_EDITABLE');
      else deny(`El campo "${k}" no es editable aquí.`,'CAMPO_NO_EDITABLE');
      const v=d[k]===''||d[k]==null?'':Number(d[k]);
      if(v!==''&&!(isFinite(v)&&v>=0))deny('Importe no válido (0 o mayor).','VALIDACION');
      if(v!==''&&v<pagadoDe('PROVEEDOR',t.id)-0.005)deny(`El costo no puede ser menor a lo ya pagado (Q ${pagadoDe('PROVEEDOR',t.id)}).`,'VALIDACION');
      nv[k]=v===''?'':r2(v);
    });
    let n=0;
    Object.keys(nv).forEach(k=>{
      if(String(t[k]==null?'':t[k])===String(nv[k]))return;
      auditAdd({entidad:'FINANZAS',viajeId:t.id,accion:'Importe registrado',campo:LBL[k],anterior:t[k]===''||t[k]==null?'(vacío)':'Q '+t[k],nuevo:nv[k]===''?'(vacío)':'Q '+nv[k],por:A});
      t[k]=nv[k];n++;
    });
    return {cambios:n};
  });},
  registrarPago(uid,d){return exec(uid,'registrarPago',(d&&d.viajeId)||'',A=>{
    need(A,'pagos_registrar','registrar pagos');
    const t=getT(d.viajeId);if(!puedeVer(A,t))deny('No tienes acceso a este viaje.');
    const tipo=d.tipo;if(!['PROVEEDOR','PILOTO'].includes(tipo))deny('Tipo de pago no válido.','VALIDACION');
    if(!FIN.includes(t.estado))deny('Solo se registran pagos de viajes finalizados.','ESTADO_INVALIDO');
    const monto=nn(d.monto);if(monto==null||monto<=0)deny('El monto del pago debe ser mayor a cero.','VALIDACION');
    if(!/^\d{4}-\d{2}-\d{2}$/.test(d.fecha||''))deny('Fecha de pago no válida.','VALIDACION');
    if(d.fecha>dLoc(nowIso()))deny('La fecha del pago no puede ser posterior a hoy: no se registran pagos anticipados.','FECHA_FUTURA');
    const ref=String(d.referencia||'').trim();if(ref.length<3||ref.length>40)deny('La referencia del pago es obligatoria (3 a 40 caracteres).','VALIDACION');
    let ob,ben;
    if(tipo==='PROVEEDOR')deny('El pago a un proveedor se hace con una ORDEN DE PAGO (Finanzas → Órdenes de pago), no viaje por viaje.','USA_ORDEN_PAGO');
    ob=nn(t.qViaticos);if(ob==null)deny('El viaje no tiene importe registrado para el piloto (Q viáticos).','SIN_IMPORTE');
    ben=(PILOTOS.find(p=>p.id===t.pilotoId)||{}).nombre||t.pilotoId;
    const ya=pagadoDe(tipo,t.id);
    if(ya+monto>ob+0.005)deny(`El pago excede el importe por pagar (Q ${ob}); ya pagado Q ${ya}. Saldo: Q ${r2(ob-ya)}.`,'EXCEDE_IMPORTE');
    if(DB.pagos.some(p=>!p.anulado&&p.tipo===tipo&&p.viajeId===t.id&&p.referencia.toLowerCase()===ref.toLowerCase()))deny('Ya existe un pago con esa referencia para este viaje.','DUPLICADO');
    const p={id:'PAG-'+pad4(DB.seq.pag++),tipo,viajeId:t.id,beneficiario:ben,monto:r2(monto),fecha:d.fecha,referencia:ref,porId:A.id,por:A.nombre,en:nowIso(),anulado:null};
    DB.pagos.push(p);
    auditAdd({entidad:'FINANZAS',viajeId:t.id,accion:'Pago registrado',campo:tipo==='PROVEEDOR'?'Pago a proveedor':'Pago a piloto',nuevo:'Q '+p.monto,por:A,ref:`${p.id} · ${ref}`});
    return p;
  });},
  anularPago(uid,pagoId,motivo){return exec(uid,'anularPago','',A=>{
    need(A,'pagos_registrar','anular pagos');
    const p=DB.pagos.find(x=>x.id===pagoId);if(!p)deny('El pago no existe.','NO_EXISTE');
    if(p.anulado)deny('El pago ya está anulado.','ESTADO_INVALIDO');
    const m=String(motivo||'').trim();if(m.length<5)deny('El motivo de la anulación es obligatorio (mínimo 5 caracteres).','VALIDACION');
    p.anulado={porId:A.id,por:A.nombre,en:nowIso(),motivo:m};
    auditAdd({entidad:'FINANZAS',viajeId:p.viajeId,accion:'Pago anulado',campo:'Pago',anterior:'Q '+p.monto,nuevo:'(anulado)',por:A,motivo:m,ref:`${p.id} · ${p.referencia}`});return p;
  });},

  /* ----- órdenes de pago a proveedores (OPL) ----- */
  /* Viajes facturados al cliente que aún no están en una orden de pago activa, con su tarifa de OPL. */
  viajesPorPagar(uid){const A=actor(uid);if(!hasPerm(A,'finanzas_ver'))need(A,'tarifas_opl_ver','ver lo que se debe pagar a proveedores');
    return DB.trips.filter(t=>['FACTURADO','COBRADO'].includes(t.estado)&&t.opl)
      .filter(t=>!DB.ordenesPago.some(o=>o.estado==='ACTIVA'&&o.viajeIds.includes(t.id)))
      .map(t=>({id:t.id,proveedor:t.opl,cliente:t.proyecto,proyecto:t.proyectoCat,fecha:(t.fechaPlan||'').slice(0,10),
        importe:nn(t.tarifaOpl),sinTarifa:!(nn(t.tarifaOpl)>0)}));
  },
  ordenesPago(uid){const A=actor(uid);if(!hasPerm(A,'finanzas_ver')&&!hasPerm(A,'pagos_registrar')&&!hasPerm(A,'comercial_ver'))deny('Tu perfil no puede ver las órdenes de pago.');
    return JSON.parse(JSON.stringify(DB.ordenesPago));},
  crearOrdenPago(uid,d){return exec(uid,'crearOrdenPago','',A=>{
    need(A,'pagos_registrar','emitir órdenes de pago');
    const prov=String((d&&d.proveedor)||'').trim();
    const ids=(d&&Array.isArray(d.viajeIds)?d.viajeIds:[]).map(String);
    if(!prov)deny('Selecciona el proveedor (OPL).','VALIDACION');
    if(!ids.length)deny('Selecciona al menos un viaje para la orden de pago.','VALIDACION');
    if(new Set(ids).size!==ids.length)deny('Hay viajes repetidos en la selección.','VALIDACION');
    const importes={},lineas=[];let tot=0;
    ids.forEach(id=>{
      const t=DB.trips.find(x=>x.id===id);
      if(!t)deny(`El viaje ${id} no existe.`,'NO_EXISTE');
      if(!puedeVer(A,t))deny(`No tienes acceso al viaje ${id}.`,'DENEGADO');
      if(t.opl!==prov)deny(`El viaje ${id} no es del proveedor ${prov}.`,'VALIDACION');
      if(!['FACTURADO','COBRADO'].includes(t.estado))deny(`El viaje ${id} debe estar facturado al cliente antes de poder pagarse al proveedor.`,'NO_FACTURADO');
      const imp=nn(t.tarifaOpl);
      if(!(imp>0))deny(`El viaje ${id} no tiene tarifa de OPL (proveedor).`,'SIN_TARIFA_OPL');
      if(DB.ordenesPago.some(o=>o.estado==='ACTIVA'&&o.viajeIds.includes(id)))deny(`El viaje ${id} ya está en una orden de pago activa.`,'YA_EN_ORDEN');
      importes[id]=imp;tot+=imp;
      /* Copia congelada para el documento: la ventana de viajes del snapshot no siempre contiene
         los viajes históricos que ya están en una orden de pago. */
      const r=DB.rutas.find(x=>x.id===t.rutaId);
      const f=(typeof FLOTA!=='undefined'?FLOTA:[]).find(x=>x.unidad===t.unidadId);
      lineas.push({viajeId:id,cliente:ocClienteNombre(t.proyecto),clienteId:t.proyecto,shipment:t.shipment||'',placa:(f&&f.placa)||t.unidadId||'',ruta:r?(r.codigo?(r.codigo+' · '):'')+(r.origen||'')+(r.destino?' → '+r.destino:''):(t.rutaId||''),tarifa:imp});
    });
    const en=nowIso(),nOp=(Number(DB.seq.op)||0)+1;DB.seq.op=nOp;
    const o={id:'OP-'+pad4(nOp),proveedor:prov,viajeIds:ids,fase:'EMITIDA',importe:r2(tot),importesViaje:importes,lineas,
      fechaEmision:dLoc(en),emision:{porId:A.id,por:A.nombre,en,fecha:dLoc(en),documento:null},transferencia:null,
      estado:'ACTIVA',creadoPorId:A.id,creadoPor:A.nombre,creadoEn:en,anulada:null,correcciones:[]};
    DB.ordenesPago.push(o);
    auditAdd({entidad:'PAGO',accion:'Orden de pago emitida',campo:'Importe',nuevo:'Q '+o.importe,por:A,ref:`${o.id} · ${prov} · ${ids.length} viajes`});
    return o;
  });},
  adjuntarDocumentoOrden(uid,opId,doc){return exec(uid,'adjuntarDocumentoOrden','',A=>{
    need(A,'pagos_registrar','adjuntar el documento de la orden');
    const o=DB.ordenesPago.find(x=>x.id===opId);if(!o)deny('La orden de pago no existe.','NO_EXISTE');
    if(o.estado!=='ACTIVA')deny('La orden está anulada.','ESTADO_INVALIDO');
    if(!(doc&&typeof doc.path==='string'&&new RegExp('^pagos/'+opId+'/[A-Za-z0-9._-]{8,90}$').test(doc.path)))deny('La ruta del documento no corresponde a esta orden.','VALIDACION');
    if(!ENV.storageExists(doc.path))deny('El documento no está en el almacenamiento: vuelve a subirlo.','VALIDACION');
    o.emision=Object.assign({},o.emision,{documento:{path:doc.path,nombre:String(doc.nombre||'').slice(0,80)}});
    auditAdd({entidad:'PAGO',accion:'Documento de la orden adjuntado',campo:'Documento',nuevo:String(doc.nombre||doc.path).slice(0,80),por:A,ref:o.id});
    return o;
  });},
  /* Etapa 2: el proveedor ya facturó. Se registra la transferencia con DOS archivos esenciales. */
  registrarTransferencia(uid,opId,d){return exec(uid,'registrarTransferencia','',A=>{
    need(A,'pagos_registrar','registrar el pago al proveedor');
    const o=DB.ordenesPago.find(x=>x.id===opId);if(!o)deny('La orden de pago no existe.','NO_EXISTE');
    if(o.estado!=='ACTIVA')deny('La orden está anulada.','ESTADO_INVALIDO');
    if(o.fase!=='EMITIDA')deny('Esta orden de pago ya está pagada.','ESTADO_INVALIDO');
    const f=String((d&&d.fecha)||'');if(!/^\d{4}-\d{2}-\d{2}$/.test(f))deny('Fecha de la transferencia no válida.','VALIDACION');
    if(f>dLoc(nowIso()))deny('La fecha de la transferencia no puede ser posterior a hoy: no se registran pagos anticipados.','FECHA_FUTURA');
    const monto=nn(d&&d.monto);if(monto==null||monto<=0)deny('El monto pagado debe ser mayor a cero.','VALIDACION');
    /* La orden se paga completa: lo transferido debe ser el importe de la orden (tolerancia de un centavo por redondeo).
       Un pago parcial no cierra la orden ni marca los viajes como pagados: para pagar otro monto hay que anular la
       orden y emitirla de nuevo con el importe correcto. */
    const esperado=nn(o.importe);
    if(Math.abs(r2(monto)-esperado)>0.005)deny(`El monto transferido (Q ${r2(monto)}) no coincide con el de la orden (Q ${esperado}). La orden se paga completa: registra ese importe o anula la orden y emítela de nuevo con el monto correcto.`,'MONTO_DISTINTO');
    const ref=String((d&&d.referencia)||'').trim();if(ref.length<3||ref.length>40)deny('La referencia de la transferencia es obligatoria (3 a 40 caracteres).','VALIDACION');
    const archivo=(a,nombre)=>{const p=a&&a.path;
      if(!(typeof p==='string'&&new RegExp('^pagos/'+opId+'/[A-Za-z0-9._-]{8,90}$').test(p)))deny(`Falta ${nombre}. Sin ese archivo no se cierra la orden.`,'SIN_ARCHIVO');
      if(!ENV.storageExists(p))deny(`${nombre}: el archivo no está en el almacenamiento, vuelve a subirlo.`,'VALIDACION');
      return {path:p,nombre:String((a&&a.nombre)||'').slice(0,80)};};
    const ev=archivo(d&&d.evidencia,'la evidencia de la transferencia');
    const fac=archivo(d&&d.factura,'la factura del proveedor');
    const en=nowIso();
    o.transferencia={porId:A.id,por:A.nombre,en,fecha:f,monto:r2(monto),referencia:ref,evidencia:ev,factura:fac};
    o.fase='PAGADA';
    o.viajeIds.forEach(id=>{
      const t=getT(id),imp=nn(o.importesViaje[id]);
      DB.pagos.push({id:'PAG-'+pad4(DB.seq.pag++),tipo:'PROVEEDOR',viajeId:t.id,beneficiario:o.proveedor,monto:r2(imp),fecha:f,referencia:ref,porId:A.id,por:A.nombre,en,anulado:null,ordenPagoId:o.id});
    });
    auditAdd({entidad:'PAGO',accion:'Pago al proveedor registrado (orden cerrada)',campo:'Transferencia',nuevo:'Q '+o.transferencia.monto,por:A,ref:`${o.id} · ${ref}`});
    return o;
  });},
  anularOrdenPago(uid,opId,motivo){return exec(uid,'anularOrdenPago','',A=>{
    need(A,'pagos_registrar','anular órdenes de pago');
    const o=DB.ordenesPago.find(x=>x.id===opId);if(!o)deny('La orden de pago no existe.','NO_EXISTE');
    if(o.estado!=='ACTIVA')deny('La orden de pago ya está anulada.','ESTADO_INVALIDO');
    if(o.fase==='PAGADA')deny('Una orden ya pagada no se anula: revierte primero la transferencia.','ESTADO_INVALIDO');
    const m=String(motivo||'').trim();if(m.length<5)deny('El motivo de la anulación es obligatorio (mínimo 5 caracteres).','VALIDACION');
    o.estado='ANULADA';o.anulada={porId:A.id,por:A.nombre,en:nowIso(),motivo:m};
    auditAdd({entidad:'PAGO',accion:'Orden de pago anulada',campo:'Estado',anterior:'ACTIVA',nuevo:'ANULADA',por:A,motivo:m,ref:o.id});
    return o;
  });},
  resumenFinanciero(uid,f){
    const A=actor(uid); if(!hasPerm(A,'finanzas_ver')) need(A,'tarifas_opl_ver','consultar el control financiero (OPL)');
    return JSON.parse(JSON.stringify(finCalc(DB.trips,DB.agrupaciones,DB.pagos,f)));
  },
  pagosDeViaje(uid,id){const A=actor(uid);need(A,'finanzas_ver','consultar pagos');return DB.pagos.filter(p=>p.viajeId===id).map(p=>Object.assign({},p));},
  tarifas(uid){const A=actor(uid);need(A,'tarifas_ver','consultar tarifas');return DB.tarifas.map(t=>Object.assign({},t));},
  mem(uid){const A=actor(uid);need(A,'tarifas_ver','consultar la tabla MEM');return (DB.mem||[]).slice().sort((a,b)=>(a.fecha<b.fecha?-1:1));},
  precioMem(uid,fecha){const A=actor(uid);need(A,'tarifas_ver','consultar el precio MEM');const m=memPrecioParaFecha(fecha);return m?Object.assign({},m):null;},
  cargarMem(uid,filas){return exec(uid,'cargarMem','',A=>{
    need(A,'tarifas_editar','cargar la tabla MEM');
    if(!Array.isArray(filas))deny('Formato de la tabla MEM no válido.','VALIDACION');
    const limpias=[];
    filas.forEach(f=>{const fecha=String((f&&f.fecha)||'').slice(0,10),precio=Number(f&&f.precioDiesel);
      if(/^\d{4}-\d{2}-\d{2}$/.test(fecha)&&isFinite(precio)&&precio>0)limpias.push({fecha,precioDiesel:r2(precio)});});
    if(!limpias.length)deny('No se reconoció ningún renglón válido (fecha AAAA-MM-DD y precio mayor a cero).','VALIDACION');
    limpias.sort((a,b)=>(a.fecha<b.fecha?-1:1));
    const antes=(DB.mem||[]).length;DB.mem=limpias;
    auditAdd({entidad:'MEM',accion:'Tabla MEM cargada',campo:'Renglones',anterior:String(antes),nuevo:String(limpias.length),por:A,ref:`${limpias[0].fecha} → ${limpias[limpias.length-1].fecha}`});
    return {renglones:limpias.length};
  });},
  crearTarifa(uid,d){return exec(uid,'crearTarifa','',A=>{
    need(A,'tarifas_crear','crear tarifas');
    const v=validarTarifa(d,null);
    /* Misma ruta + capacidad + fecha de vigencia: el índice uq_tarifa_activa lo rechazaría
       al activar la ruta (y dejaba la aprobación de Transporte en error). Se bloquea al crear. */
    const dup=DB.tarifas.find(x=>x.cliente===v.cliente&&x.proyecto===v.proyecto&&x.rutaId===v.rutaId&&x.capacidad===v.capacidad&&x.vigenteDesde===v.vigenteDesde);
    if(dup)deny(`Ya existe una tarifa con esa ruta, capacidad y fecha de vigencia (${dup.id}). Edítala en vez de crear otra.`,'TARIFA_DUPLICADA');
    const r=DB.rutas.find(x=>x.id===v.rutaId);
    const t=Object.assign({id:'TAR-'+pad4(DB.seq.tar++),activa:r&&r.estado==='ACTIVA',creadoPorId:A.id,creadoPor:A.nombre,creadoEn:nowIso(),modificadoPor:'',modificadoEn:''},v);
    DB.tarifas.push(t);
    if(r&&r.estado==='EN_TARIFACION'){
      r.estado='PENDIENTE_APROBACION';
      auditAdd({entidad:'RUTA',accion:'Tarifa definida para ruta',campo:'Estado',anterior:'En tarifación',nuevo:'Pendiente de aprobaciones',por:A,ref:r.id});
      notificar(A,{tipo:'RUTA_APROBACION',destinatarios:['GERENTE_COMERCIAL','GERENTE_TRANSPORTE'],asunto:`Ruta pendiente de aprobación: ${r.codigo||r.nombre}`,detalle:{ruta:r.nombre,codigo:r.codigo||'',proyecto:r.proyecto,cliente:r.cliente,tarifa:t.id,importe:t.importe,fecha:nowIso()}});
    }
    auditAdd({entidad:'TARIFA',accion:'Tarifa creada',campo:'Importe',nuevo:'Q '+t.importe,por:A,ref:`${t.id} · ${t.cliente} · ${t.proyecto} · ${rutaNombre(t.rutaId)} · ${t.capacidad} · desde ${t.vigenteDesde}`});
    return t;
  });},
  editarTarifa(uid,id,d){return exec(uid,'editarTarifa','',A=>{
    need(A,'tarifas_editar','editar tarifas');
    const t=DB.tarifas.find(x=>x.id===id);if(!t)deny('La tarifa no existe.','NO_EXISTE');
    const pick=k=>k in d?d[k]:t[k];
    const v=validarTarifa(Object.assign({},t,{importe:d.importe,vigenteDesde:d.vigenteDesde,vigenteHasta:d.vigenteHasta,
      qDieselPactado:pick('qDieselPactado'),
      combustiblePct:pick('combustiblePct'),
      importeOpl:pick('importeOpl'),
      dieselPactadoOpl:pick('dieselPactadoOpl'),
      combustiblePctOpl:pick('combustiblePctOpl')}),t.id);
    const ch=[['importe','Importe',x=>'Q '+x],['vigenteDesde','Vigente desde',x=>x],['vigenteHasta','Vigente hasta',x=>x||'(sin fin)'],
      ['qDieselPactado','Q diésel pactado',x=>x===''||x==null?'(vacío)':'Q '+x],['combustiblePct','% de combustible',x=>x===''||x==null?'(vacío)':x+'%'],
      ['importeOpl','Importe proveedor (OPL)',x=>x===''||x==null?'(vacío)':'Q '+x],['dieselPactadoOpl','Q diésel pactado proveedor',x=>x===''||x==null?'(vacío)':'Q '+x],['combustiblePctOpl','% de combustible proveedor',x=>x===''||x==null?'(vacío)':x+'%']];
    let n=0;
    ch.forEach(([k,l,f])=>{const nv=v[k]===undefined?'':v[k];if(String(t[k]==null?'':t[k])!==String(nv==null?'':nv)){auditAdd({entidad:'TARIFA',accion:'Tarifa modificada',campo:l,anterior:f(t[k]),nuevo:f(nv),por:A,motivo:String(d.motivo||'').trim(),ref:t.id});t[k]=nv;n++;}});
    ['importeOpl','dieselPactadoOpl','combustiblePctOpl'].forEach(k=>{if(t[k]==null||t[k]==='')delete t[k];});
    if(n){t.modificadoPor=A.nombre;t.modificadoEn=nowIso();}
    return t;
  });},
  cambiarEstadoTarifa(uid,id,activa,motivo){return exec(uid,'cambiarEstadoTarifa','',A=>{
    need(A,'tarifas_desactivar','activar o desactivar tarifas');
    const t=DB.tarifas.find(x=>x.id===id);if(!t)deny('La tarifa no existe.','NO_EXISTE');
    activa=!!activa;if(t.activa===activa)return t;
    if(activa)validarTarifa(t,t.id);
    t.activa=activa;t.modificadoPor=A.nombre;t.modificadoEn=nowIso();
    auditAdd({entidad:'TARIFA',accion:activa?'Tarifa activada':'Tarifa desactivada',campo:'Estado',anterior:activa?'Inactiva':'Activa',nuevo:activa?'Activa':'Inactiva',por:A,motivo:String(motivo||'').trim(),ref:t.id});
    return t;
  });},
  aplicarTarifa(uid,viajeId){return exec(uid,'aplicarTarifa',viajeId,A=>{
    need(A,'tarifa_registrar','aplicar tarifas a los viajes');
    const t=getT(viajeId);if(!puedeVer(A,t))deny('No tienes acceso a este viaje.');
    const r=aplicarUna(A,t);if(r.err)deny(r.err,'SIN_TARIFA');return {viaje:t.id,importe:t.tarifaCliente};
  });},
  aplicarTarifasPendientes(uid,ids){return exec(uid,'aplicarTarifasPendientes','',A=>{
    need(A,'tarifa_registrar','aplicar tarifas a los viajes');
    const lista=(Array.isArray(ids)&&ids.length?ids:DB.trips.filter(t=>t.estado==='ACEPTADO'&&tarifaEditable(t)).map(t=>t.id));
    const ok=[],sin=[];
    lista.forEach(id=>{const t=DB.trips.find(x=>x.id===id);if(!t||!puedeVer(A,t)){sin.push({id,motivo:'Sin acceso o inexistente.'});return;}const r=aplicarUna(A,t);if(r.err)sin.push({id,motivo:r.err});else ok.push(id);});
    return {aplicadas:ok,sinTarifa:sin};
  });},
  viajesSinTarifa(uid){
    const A=actor(uid);need(A,'comercial_ver','ver el módulo Comercial');
    return DB.trips.filter(t=>t.estado==='ACEPTADO'&&tarifaEditable(t)&&(nn(t.tarifaCliente)==null||nn(t.tarifaOpl)==null)&&puedeVer(A,t)).map(t=>{
      const r=tarifaPara(t);
      const faltaOpl=!r.err&&nn(t.tarifaOpl)==null&&nn(t.tarifaCliente)!=null;
      return {id:t.id,cliente:t.proyecto,proyecto:t.proyectoCat,tarifaId:r.t?r.t.id:'',faltaOpl,
        motivo:r.err||(faltaOpl?'Sin tarifa de proveedor (OPL) en la tarifa vigente.':'Hay una tarifa vigente: falta aplicarla.'),
        disponible:!r.err&&!faltaOpl};
    });
  },

  /* ----- rutas ----- */
  /* El conteo de viajes por ruta se arma en UNA pasada. Antes era rutas × viajes dentro del map, y esto
     corre en cada lectura de rutas (y en cada snapshot): con miles de rutas y viajes se vuelve el cuello de botella. */
});

/* Dominio del motor · generado por separación de js/engine.js. */
Object.assign(API,{
  rutas(uid){
    const A=actor(uid);need(A,'rutas_ver','consultar rutas');
    const porRuta=new Map();
    for(const t of DB.trips){if(!t.rutaId)continue;porRuta.set(t.rutaId,(porRuta.get(t.rutaId)||0)+1);}
    return DB.rutas.filter(r=>rutaVisible(A,r)).map(r=>Object.assign({},r,{viajes:porRuta.get(r.id)||0}));
  },
  rutasParaViaje(uid,cliente,proyecto){const A=actor(uid);return DB.rutas.filter(r=>r.estado==='ACTIVA'&&r.cliente===cliente&&r.proyecto===proyecto&&rutaVisible(A,r)).map(r=>Object.assign({},r));},
  /* Rutas que pueden recibir una tarifa: la que espera tarifación, la que ya tiene tarifa y espera aprobaciones, y las activas (otra capacidad). */
  rutasParaTarifa(uid,cliente,proyecto){const A=actor(uid);return DB.rutas.filter(r=>['EN_TARIFACION','PENDIENTE_APROBACION','ACTIVA'].includes(r.estado)&&r.cliente===cliente&&r.proyecto===proyecto&&rutaVisible(A,r)).map(r=>Object.assign({},r));},
  solicitarRuta(uid,d){return exec(uid,'solicitarRuta','',A=>{
    need(A,'rutas_solicitar','solicitar rutas nuevas');
    const cliente=d&&d.cliente,cl=DB.clientes.find(c=>c.id===cliente);if(!cl)deny('Selecciona el cliente.','VALIDACION');
    if(!clientesAsig(A).includes(cliente))deny('No tienes asignado ese cliente.');
    const proy=d.proyecto;if(!proyectosDe(cliente).includes(proy))deny('Selecciona un proyecto válido del cliente.','VALIDACION');
    if(!proyectosAsig(A,cliente).includes(proy))deny('Solo puedes solicitar rutas de tu proyecto asignado.');
    const nombre=String(d.nombre||'').trim();if(nombre.length<3||nombre.length>80)deny('Escribe el nombre o la referencia de la ruta (3 a 80 caracteres).','VALIDACION');
    const op=String(d.origenProp||'').trim(),dp=String(d.destinoProp||'').trim();if(op.length>80||dp.length>80)deny('Origen y destino: máximo 80 caracteres.','VALIDACION');
    if(DB.rutas.some(r=>!['RECHAZADA'].includes(r.estado)&&r.cliente===cliente&&r.proyecto===proy&&r.nombre.toLowerCase()===nombre.toLowerCase()))deny('Ya hay una ruta pendiente con esa referencia en este proyecto.','DUPLICADO');
    const capacidad=capacidadRuta(d&&d.capacidad), km=kmRuta(d&&d.km);
    return crearRutaPendiente(A,{cliente,proyecto:proy,nombre,origenProp:op,destinoProp:dp,capacidad,km,fuente:'SOLICITUD'});
  });},
  registrarRuta(uid,d){return exec(uid,'registrarRuta','',A=>{
    need(A,'rutas_gestionar','registrar rutas en el catálogo');
    const v=validarRutaDatos(d);
    const r={id:'R-'+pad4(DB.seq.rut++),codigo:v.codigo,nombre:v.nombre,cliente:v.cliente,proyecto:v.proyecto,origen:v.origen,destino:v.destino,estado:'EN_TARIFACION',origenProp:'',destinoProp:'',fuente:'CATALOGO',solicitadaPorId:A.id,solicitadaPor:A.nombre,solicitadaEn:nowIso(),validadaPor:A.nombre,validadaEn:nowIso(),aprobacionComercial:null,aprobacionTransporte:null,rechazo:null,viajeRef:'',capacidad:v.capacidad,km:v.km};
    DB.rutas.push(r);
    auditAdd({entidad:'RUTA',accion:'Ruta registrada para tarifación',campo:'Ruta',nuevo:`${r.codigo} · ${nombreOrigen(r.origen)} → ${nombreDestino(r.destino)}`,por:A,ref:r.id});
    return r;
  });},
  validarRuta(uid,id,d){return exec(uid,'validarRuta','',A=>{
    need(A,'rutas_validar','validar o asignar rutas');
    const r=DB.rutas.find(x=>x.id===id);if(!r)deny('La ruta no existe.','NO_EXISTE');
    if(r.estado!=='PENDIENTE')deny('Solo se validan rutas pendientes.','ESTADO_INVALIDO');
    const capacidad=capacidadRuta((d&&d.capacidad)||r.capacidad), km=kmRuta((d&&d.km)||r.km);
    const v=validarRutaDatos({codigo:d&&d.codigo,nombre:r.nombre,cliente:r.cliente,proyecto:r.proyecto,origen:d&&d.origen,destino:d&&d.destino,capacidad,km});
    r.codigo=v.codigo;r.origen=v.origen;r.destino=v.destino;r.capacidad=v.capacidad;r.km=v.km;r.estado='EN_TARIFACION';r.validadaPor=A.nombre;r.validadaEn=nowIso();
    auditAdd({entidad:'RUTA',accion:'Ruta validada',campo:'Estado',anterior:'Pendiente',nuevo:'En tarifación',por:A,ref:`${r.id} · ${r.codigo} · ${nombreOrigen(r.origen)} → ${nombreDestino(r.destino)}`});
    DB.trips.filter(t=>t.rutaId===r.id).forEach(t=>{
      const ao=t.origen,ad=t.destino;t.origen=r.origen;t.destino=r.destino;
      auditAdd({entidad:'RUTA',viajeId:t.id,accion:'Ruta asignada: origen y destino completados',campo:'Origen',anterior:ao?nombreOrigen(ao):'(pendiente)',nuevo:nombreOrigen(r.origen),por:A,ref:r.id});
      auditAdd({entidad:'RUTA',viajeId:t.id,accion:'Ruta asignada: origen y destino completados',campo:'Destino',anterior:ad?nombreDestino(ad):'(pendiente)',nuevo:nombreDestino(r.destino),por:A,ref:r.id});
    });
    notificar(A,{tipo:'RUTA_TARIFACION',destinatarios:['GERENTE_COMERCIAL'],asunto:`Ruta lista para definir tarifa: ${r.codigo}`,detalle:{ruta:r.nombre,codigo:r.codigo,proyecto:r.proyecto,cliente:r.cliente,origen:nombreOrigen(r.origen),destino:nombreDestino(r.destino),capacidad:r.capacidad,km:r.km}});
    return r;
  });},
  rechazarRuta(uid,id,motivo){return exec(uid,'rechazarRuta','',A=>{
    need(A,'rutas_validar','rechazar rutas');
    const r=DB.rutas.find(x=>x.id===id);if(!r)deny('La ruta no existe.','NO_EXISTE');
    if(['ACTIVA','RECHAZADA'].includes(r.estado))deny('La ruta ya no puede rechazarse en este estado.','ESTADO_INVALIDO');
    const m=String(motivo||'').trim();if(m.length<5)deny('El motivo del rechazo es obligatorio (mínimo 5 caracteres).','VALIDACION');
    const antes=r.estado;r.estado='RECHAZADA';r.rechazo={por:A.nombre,porId:A.id,en:nowIso(),motivo:m};
    auditAdd({entidad:'RUTA',accion:'Ruta rechazada',campo:'Estado',anterior:antes,nuevo:'RECHAZADA',por:A,motivo:m,ref:r.id});
    notificar(A,{tipo:'RUTA_RECHAZADA',destinatarios:[],usuarios:[r.solicitadaPorId],asunto:`Ruta rechazada: ${r.nombre}`,detalle:{ruta:r.nombre,proyecto:r.proyecto,cliente:r.cliente,motivo:m}});
    return r;
  });},
  aprobarRutaComercial(uid,id){return exec(uid,'aprobarRutaComercial',id,A=>{
    need(A,'rutas_aprobar_comercial','aprobar rutas por Comercial');const r=DB.rutas.find(x=>x.id===id);if(!r)deny('La ruta no existe.','NO_EXISTE');
    if(r.estado==='ACTIVA')deny('La ruta ya está activa: no requiere más aprobaciones.','ESTADO_INVALIDO');
    if(r.estado!=='PENDIENTE_APROBACION')deny('La ruta requiere una tarifa definida antes de aprobarla.','ESTADO_INVALIDO');
    if(r.aprobacionComercial)deny('Gerencia Comercial ya aprobó esta ruta.','ESTADO_INVALIDO');
    r.aprobacionComercial={porId:A.id,por:A.nombre,en:nowIso()};auditAdd({entidad:'RUTA',accion:'Ruta aprobada por Gerencia Comercial',campo:'Aprobación',nuevo:A.nombre,por:A,ref:r.id});activarRutaSiLista(r,A);return r;
  });},
  aprobarRutaTransporte(uid,id){return exec(uid,'aprobarRutaTransporte',id,A=>{
    need(A,'rutas_aprobar_transporte','aprobar rutas por Transporte');const r=DB.rutas.find(x=>x.id===id);if(!r)deny('La ruta no existe.','NO_EXISTE');
    if(r.estado==='ACTIVA')deny('La ruta ya está activa: no requiere más aprobaciones.','ESTADO_INVALIDO');
    if(r.estado!=='PENDIENTE_APROBACION')deny('La ruta requiere una tarifa definida antes de aprobarla.','ESTADO_INVALIDO');
    if(r.aprobacionTransporte)deny('Gerencia de Transporte ya aprobó esta ruta.','ESTADO_INVALIDO');
    r.aprobacionTransporte={porId:A.id,por:A.nombre,en:nowIso()};auditAdd({entidad:'RUTA',accion:'Ruta aprobada por Gerencia de Transporte',campo:'Aprobación',nuevo:A.nombre,por:A,ref:r.id});activarRutaSiLista(r,A);return r;
  });},

  /* ----- notificaciones (solo dentro de la aplicación) ----- */
  notificaciones(uid){
    const A=actor(uid);
    return DB.notificaciones.filter(n=>A.rol==='ADMIN'||n.destinatarios.includes(A.rol)||(n.usuarios||[]).includes(A.id)).map(n=>Object.assign({},n,{leida:n.leidaPor.includes(A.id)})).reverse();
  },
  /* ----- Ayuda: reportes de fallas ----- */
  crearReporteAyuda(uid,d){return exec(uid,'crearReporteAyuda','',A=>{
    d=d||{};DB.reportesAyuda=DB.reportesAyuda||[];
    const tipo=String(d.tipo||'').trim(),modulo=String(d.modulo||'').trim(),desc=String(d.descripcion||'').trim(),intento=String(d.intento||'').trim();
    if(!AYUDA_TIPOS.includes(tipo))deny('Selecciona el tipo de problema.','VALIDACION');
    if(!ayudaModulosDe(A).includes(modulo))deny('Selecciona el módulo afectado: una de las opciones de la lista (o «No estoy seguro»).','VALIDACION');
    if(desc.length<10)deny('Describe el problema con un poco más de detalle (mínimo 10 caracteres).','VALIDACION');
    if(desc.length>2000)deny('La descripción del problema es demasiado larga (máximo 2000 caracteres).','VALIDACION');
    if(intento.length>1000)deny('«¿Qué estabas intentando hacer?» es demasiado largo (máximo 1000 caracteres).','VALIDACION');
    const ya=DB.reportesAyuda.find(r=>r.usuarioId===A.id&&r.tipo===tipo&&r.modulo===modulo&&r.descripcion===desc&&Date.now()-new Date(r.creadoEn).getTime()<120000);
    if(ya)deny(`Ya enviaste este mismo reporte hace un momento (${ya.id}).`,'DUPLICADO');
    DB.seq.ayu=DB.seq.ayu||1;
    const en=nowIso();
    const r={id:'AYU-'+pad4(DB.seq.ayu++),usuarioId:A.id,usuario:A.nombre,rol:A.rol,modulo,tipo,descripcion:desc,intento,estado:'PENDIENTE',creadoEn:en,actualizadoEn:'',actualizadoPor:'',historial:[{estado:'PENDIENTE',por:A.nombre,en}]};
    DB.reportesAyuda.push(r);
    auditAdd({entidad:'AYUDA',accion:'Reporte de ayuda creado',campo:'Estado',nuevo:AYUDA_ESTADOS.PENDIENTE,por:A,ref:`${r.id} · ${modulo} · ${tipo}`});
    notificar(A,{tipo:'REPORTE_AYUDA',destinatarios:AYUDA_GESTORES.slice(),usuarios:[],asunto:`Reporte de ayuda ${r.id}: ${tipo}`,detalle:{reporte:r.id,reportadoPor:A.nombre,modulo,problema:tipo,descripcion:desc.slice(0,300),fechaRegistro:en}});
    return r;
  });},
  cambiarEstadoReporteAyuda(uid,id,estado){return exec(uid,'cambiarEstadoReporteAyuda','',A=>{
    if(!AYUDA_GESTORES.includes(A.rol))throw new ApiError('SIN_PERMISO','Solo el Administrador y el perfil Proyectos pueden cambiar el estado de los reportes de ayuda.');
    DB.reportesAyuda=DB.reportesAyuda||[];
    const r=DB.reportesAyuda.find(x=>x.id===id);if(!r)deny('El reporte no existe.','NO_EXISTE');
    if(!AYUDA_ESTADOS[estado])deny('Estado no válido. Usa Pendiente, En revisión o Resuelto.','VALIDACION');
    if(r.estado===estado)return r;
    const antes=r.estado,en=nowIso();
    r.estado=estado;r.actualizadoEn=en;r.actualizadoPor=A.nombre;
    r.historial=[...(r.historial||[]),{estado,por:A.nombre,en}];
    auditAdd({entidad:'AYUDA',accion:'Estado de reporte de ayuda modificado',campo:'Estado',anterior:AYUDA_ESTADOS[antes],nuevo:AYUDA_ESTADOS[estado],por:A,ref:`${r.id} · ${r.modulo}`});
    return r;
  });},
  /* Cada usuario ve solo sus reportes; el Administrador y Proyectos (quienes los atienden) ven todos. */
  reportesAyuda(uid){
    const A=actor(uid);
    const L=(DB.reportesAyuda||[]).filter(r=>AYUDA_GESTORES.includes(A.rol)||r.usuarioId===A.id);
    return JSON.parse(JSON.stringify(L)).sort((a,b)=>a.creadoEn<b.creadoEn?1:-1);
  },
  marcarNotificacion(uid,id){return exec(uid,'marcarNotificacion','',A=>{
    const n=DB.notificaciones.find(x=>x.id===id);if(!n)deny('La notificación no existe.','NO_EXISTE');
    if(!(A.rol==='ADMIN'||n.destinatarios.includes(A.rol)||(n.usuarios||[]).includes(A.id)))deny('Esa notificación no es para ti.');
    if(!n.leidaPor.includes(A.id))n.leidaPor.push(A.id);return n;
  });},

  /* ----- listas del sistema (catálogos) ----- */
  guardarCatalogo(uid,clave,valores){return exec(uid,'guardarCatalogo','',A=>{
    need(A,'catalogos_editar','editar las listas del sistema');
    const k=String(clave||'');
    if(!LISTAS_SISTEMA.includes(k))deny('Esa lista no existe.','VALIDACION');
    const limpio=[...new Set((Array.isArray(valores)?valores:[]).map(v=>String(v==null?'':v).trim()).filter(Boolean))];
    if(!limpio.length)deny('La lista no puede quedar vacía.','VALIDACION');
    if(limpio.length>200)deny('La lista es demasiado larga (máximo 200 valores).','VALIDACION');
    if(limpio.some(v=>v.length>60))deny('Hay un valor demasiado largo (máximo 60 caracteres).','VALIDACION');
    const antes=(CAT[k]||[]).join(' · ');
    DB.catalogosListas[k]=limpio.slice();
    CAT[k]=limpio.slice();
    refrescarSugerencias();
    auditAdd({entidad:'CATALOGO',accion:'Lista del sistema actualizada',campo:LISTAS_ETIQUETA[k]||k,anterior:antes,nuevo:limpio.join(' · '),por:A,ref:k});
    return {clave:k,valores:limpio};
  });},

  /* Alta y edición de un piloto con sus documentos. La baja es aparte (cambiarEstadoPiloto): nunca se borra. */
  guardarPiloto(uid,d){return exec(uid,'guardarPiloto','',A=>{
    need(A,'pilotos_gestionar','administrar pilotos y sus documentos');
    refrescarPilotos();
    const id=String((d&&d.id)||'').trim();
    const cli=String((d&&d.cliente)||'').trim();
    if(!DB.clientes.some(c=>c.id===cli))deny('Elige el cliente del piloto.','VALIDACION');
    const nombre=String((d&&d.nombre)||'').trim().replace(/\s+/g,' ');
    if(nombre.length<3)deny('Escribe el nombre del piloto (mínimo 3 caracteres).','VALIDACION');
    if(nombre.length>80)deny('El nombre admite máximo 80 caracteres.','VALIDACION');
    const licencia=String((d&&d.licencia)||'').trim();
    if(!licencia)deny('Escribe el número de licencia.','VALIDACION');
    if(licencia.length>40)deny('La licencia admite máximo 40 caracteres.','VALIDACION');
    const tipo=String((d&&d.licenciaTipo)||'').trim();
    if(!tipo)deny('Elige el tipo de licencia.','VALIDACION');
    const fecha=(v,campo)=>{const t=String(v||'').slice(0,10);if(t&&!fechaReal(t))deny(`La fecha de ${campo} no es válida (AAAA-MM-DD).`,'VALIDACION');return t;};
    const licenciaVence=fecha(d&&d.licenciaVence,'vencimiento de la licencia');
    if(!licenciaVence)deny('Escribe la fecha de vencimiento de la licencia.','VALIDACION');
    const saludVence=fecha(d&&d.saludVence,'la tarjeta de salud'),penalesVence=fecha(d&&d.penalesVence,'antecedentes penales'),policiacosVence=fecha(d&&d.policiacosVence,'antecedentes policíacos');
    const unidad=String((d&&d.unidad)||'').trim();
    if(unidad&&!FLOTA.some(f=>f.unidad===unidad))deny('La unidad no está en la flota.','VALIDACION');
    const notas=String((d&&d.notas)||'').trim().slice(0,300);
    const lista=Array.isArray(DB.pilotos)?DB.pilotos:(DB.pilotos=[]);
    const P=id?PILOTOS.find(p=>p.id===id):null;
    if(id&&!P)deny('Piloto no encontrado.','NO_ENCONTRADO');
    const limpio={nombre,proyecto:cli,unidad,licencia,licenciaTipo:tipo,licenciaVence,saludVence,penalesVence,policiacosVence,notas};
    let obj=P;
    if(!obj){
      let n=Number(DB.seq.pil||0);
      const libre=x=>!PILOTOS.some(p=>p.id===x)&&!lista.some(p=>p.id===x);
      do{ n++; }while(!libre('P-'+String(n).padStart(4,'0')));
      DB.seq.pil=n;
      obj=Object.assign({id:'P-'+String(n).padStart(4,'0'),activo:true,actualizadoEn:nowIso()},limpio);
      lista.push(obj); if(lista!==PILOTOS)PILOTOS.push(obj);
      auditAdd({entidad:'PILOTO',accion:'Piloto creado',campo:'Piloto',anterior:'',nuevo:`${nombre} · licencia ${licencia}`,por:A,ref:obj.id});
    }else{
      const dif=Object.keys(limpio).filter(k=>String(P[k]==null?'':P[k])!==String(limpio[k]==null?'':limpio[k]));
      if(!dif.length)return P;
      const resumen=dif.map(k=>`${k}: ${P[k]==null||P[k]===''?'—':P[k]} → ${limpio[k]==null||limpio[k]===''?'—':limpio[k]}`).join(' · ');
      auditAdd({entidad:'PILOTO',accion:'Piloto actualizado',campo:dif.join(', '),anterior:'',nuevo:resumen.slice(0,500),por:A,ref:P.id});
      Object.assign(P,limpio,{actualizadoEn:nowIso()});
    }
    return obj;
  });},

  /* Baja / alta: no se borra el piloto (los viajes históricos lo siguen mostrando). */
  cambiarEstadoPiloto(uid,id,activo){return exec(uid,'cambiarEstadoPiloto',id,A=>{
    need(A,'pilotos_gestionar','dar de alta o baja pilotos');
    refrescarPilotos();
    const P=PILOTOS.find(p=>p.id===id);
    if(!P)deny('Piloto no encontrado.','NO_ENCONTRADO');
    const v=!!activo,antes=P.activo!==false;
    if(antes===v)return {id:P.id,activo:v};
    P.activo=v;
    auditAdd({entidad:'PILOTO',accion:v?'Piloto dado de alta':'Piloto dado de baja',campo:'Activo',anterior:antes?'Sí':'No',nuevo:v?'Sí':'No',por:A,ref:P.id});
    return {id:P.id,activo:v};
  });},

  /* ----- administración ----- */
  /* Accesos de módulo/sección: el módulo activa o desactiva todas sus secciones de una vez. */
  setAcceso(uid,rol,tipo,clave,hab){return exec(uid,'setAcceso','',A=>{
    need(A,'permisos_gestionar','cambiar los accesos de módulos y secciones');
    if(!ROLES[rol])deny('Rol no válido.','VALIDACION');
    const mod=tipo==='MODULO'?MODULOS_SEC.find(x=>x[0]===String(clave)):null;
    if(tipo==='MODULO'&&!mod)deny('Módulo no válido.','VALIDACION');
    if(tipo!=='MODULO'&&!SEC_DE[clave])deny('Sección no válida.','VALIDACION');
    const lista=tipo==='MODULO'?mod[1]:[clave],hab2=!!hab,cambios=[];
    lista.forEach(v=>{
      const base=SEC_DE[v]&&SEC_DE[v].base;
      if(hab2&&base&&(PROHIBIDO[rol]||[]).includes(base))return;   /* sección vetada por separación de funciones */
      const p='sec_'+v;
      let r=DB.permisos.find(x=>x.rol===rol&&x.permiso===p);
      if(!r){r={rol,permiso:p,habilitado:false};DB.permisos.push(r);}
      if(!!r.habilitado!==hab2){r.habilitado=hab2;cambios.push(v);}
    });
    cambios.forEach(v=>auditAdd({entidad:'PERMISO',accion:'Acceso de sección modificado',campo:`${ROLES[rol].label} · ${SEC_DE[v].l}`,anterior:hab2?'No':'Sí',nuevo:hab2?'Sí':'No',por:A,ref:(tipo==='MODULO'?'Módulo '+clave:'sec_'+v)}));
    return {cambios};
  });},
  setPermiso(uid,rol,perm,hab){return exec(uid,'setPermiso','',A=>{
    need(A,'permisos_gestionar','administrar permisos');
    if(!ROLES[rol])deny('Rol no válido.','VALIDACION');
    if(!PERM_KEYS.includes(perm))deny('Permiso no válido.','VALIDACION');
    hab=!!hab;
    if(hab&&(PROHIBIDO[rol]||[]).includes(perm))deny(`El permiso "${perm}" no puede concederse al rol ${ROLES[rol].label} (separación de funciones).`,'PERMISO_PROHIBIDO');
    if(!hab&&(SIEMPRE[rol]||[]).includes(perm))deny('Este permiso no puede quitarse (evita bloquear la administración).','PERMISO_PROHIBIDO');
    let r=DB.permisos.find(x=>x.rol===rol&&x.permiso===perm);
    if(!r){r={rol,permiso:perm,habilitado:false};DB.permisos.push(r);}
    if(r.habilitado===hab)return r;
    auditAdd({entidad:'PERMISO',accion:'Permiso modificado',campo:`${ROLES[rol].label} · ${perm}`,anterior:r.habilitado?'Sí':'No',nuevo:hab?'Sí':'No',por:A});
    r.habilitado=hab;return r;
  });},
  guardarUsuario(uid,d){return exec(uid,'guardarUsuario','',A=>{
    need(A,'usuarios_gestionar','gestionar usuarios');
    if(!ROLES[d.rol])deny('Rol no válido.','VALIDACION');
    const usuario=String(d.usuario||'').trim().toLowerCase(),nombre=String(d.nombre||'').trim();
    if(!/^[a-z0-9._-]{3,30}$/.test(usuario))deny('Usuario: 3 a 30 caracteres (letras, números, punto, guion).','VALIDACION');
    if(nombre.length<3)deny('Escribe el nombre completo.','VALIDACION');
    if(DB.usuarios.some(u=>u.usuario===usuario&&u.id!==d.id))deny('Ese usuario ya existe.','VALIDACION');
    const clientes=(d.clientes||[]).filter(c=>DB.clientes.some(x=>x.id===c));
    if(d.rol==='OPERATIVO'&&!clientes.length)deny('Este perfil necesita al menos un cliente asignado.','VALIDACION');
    /* Se acepta el proyecto si pertenece a alguno de los clientes elegidos; si el cliente todavía no
       tiene proyectos definidos, no se descarta lo que la administradora marcó (no se pierde en silencio). */
    const proys=(d.proyectos||[]).filter(p=>clientes.some(c=>{const cp=proyectosDe(c);return !cp.length||cp.includes(p);}));
    let u=d.id?DB.usuarios.find(x=>x.id===d.id):null;
    if(d.id&&!u)deny('Usuario no encontrado.','NO_EXISTE');
    const activo=d.activo!==false;
    if(u){
      if(u.id===A.id&&(!activo||d.rol!==u.rol))deny('No puedes desactivar ni cambiar el rol de tu propia cuenta.');
      if(u.rol==='ADMIN'&&(d.rol!=='ADMIN'||!activo)&&DB.usuarios.filter(x=>x.rol==='ADMIN'&&x.activo).length<=1)deny('Debe existir al menos una administradora activa.');
      const ch=[['Nombre',u.nombre,nombre],['Usuario',u.usuario,usuario],['Rol',u.rol,d.rol],['Activo',u.activo?'Sí':'No',activo?'Sí':'No']];
      if(d.clave)ch.push(['Contraseña','(oculta)','(cambiada)']);
      ch.forEach(([c,a,n])=>{if(a!==n)auditAdd({entidad:'USUARIO',accion:'Usuario modificado',campo:c,anterior:a,nuevo:n,por:A,ref:u.id});});
      Object.assign(u,{nombre,usuario,rol:d.rol,activo,proyectos:proys});if(d.clave&&!u.email)u.clave=String(d.clave);if(d.email)u.email=String(d.email).trim().toLowerCase();
    }else{
      if(!d.authId&&String(d.clave||'').length<6)deny('La contraseña de demostración debe tener al menos 6 caracteres.','VALIDACION');
      u={id:d.authId||'U-'+String(DB.seq.usr++).padStart(3,'0'),usuario,clave:d.authId?'':String(d.clave),email:String(d.email||'').trim().toLowerCase(),nombre,rol:d.rol,activo,proyectos:proys};
      DB.usuarios.push(u);
      auditAdd({entidad:'USUARIO',accion:'Usuario creado',campo:'Rol',nuevo:d.rol,por:A,ref:u.id});
    }
    const antes=clientesAsig(u).slice().sort().join(', '),despues=clientes.slice().sort().join(', ');
    DB.acceso=DB.acceso.filter(a=>a.userId!==u.id).concat(clientes.map(c=>({userId:u.id,cliente:c})));
    if(antes!==despues)auditAdd({entidad:'USUARIO',accion:'Acceso a clientes modificado',campo:'Clientes',anterior:antes||'(ninguno)',nuevo:despues||'(ninguno)',por:A,ref:u.id});
    syncRefs();return u;
  });},
  cambiarClave(uid,id,clave){return exec(uid,'cambiarClave','',A=>{
    need(A,'usuarios_gestionar','reasignar contraseñas de acceso');
    const u=DB.usuarios.find(x=>x.id===String(id||''));if(!u)deny('Usuario no encontrado.','NO_EXISTE');
    if(!u.email)deny('Ese usuario no tiene correo de acceso: créale uno desde Supabase.','VALIDACION');
    const c=String(clave||'');
    if(c.length<8)deny('La contraseña debe tener al menos 8 caracteres.','VALIDACION');
    if(c.length>72)deny('La contraseña es demasiado larga (máximo 72).','VALIDACION');
    auditAdd({entidad:'USUARIO',accion:'Contraseña de acceso reasignada por la administración',campo:'Contraseña',anterior:'(oculta)',nuevo:'(oculta)',por:A,ref:u.id});
    return {id:u.id,usuario:u.usuario,email:u.email};
  });},

  /* Activar o desactivar un perfil. Desactivado: no puede entrar (el servidor rechaza la sesión) ni recibe avisos.
     La administradora no puede desactivarse a sí misma: se quedaría sin acceso a la aplicación. */
  activarUsuario(uid,id,activo){return exec(uid,'activarUsuario','',A=>{
    need(A,'usuarios_gestionar','activar o desactivar perfiles');
    const u=DB.usuarios.find(x=>x.id===String(id||''));if(!u)deny('Usuario no encontrado.','NO_EXISTE');
    if(u.id===A.id&&!activo)deny('No puedes desactivar tu propio perfil: te quedarías sin acceso a la aplicación.','VALIDACION');
    const antes=!!u.activo,nuevo=!!activo;
    if(antes!==nuevo){
      u.activo=nuevo;
      u.modificadoPor=A.nombre;u.modificadoEn=nowIso();
      auditAdd({entidad:'USUARIO',accion:nuevo?'Perfil activado':'Perfil desactivado',campo:'Activo',anterior:antes?'Activo':'Inactivo',nuevo:nuevo?'Activo':'Inactivo',por:A,ref:u.id});
    }
    return {id:u.id,usuario:u.usuario,activo:u.activo};
  });},
  guardarReglasTorre(uid,d){return exec(uid,'guardarReglasTorre','',A=>{
    need(A,'clientes_gestionar','administrar las reglas de Torre de Control');
    const c=DB.clientes.find(x=>x.id===(d&&d.cliente));if(!c)deny('Cliente no válido.','VALIDACION');
    const v=!!d.torreEstatus;if(!!c.torreEstatus===v)return c;
    auditAdd({entidad:'CLIENTE',accion:'Torre de Control: autorización '+(v?'otorgada':'retirada'),campo:'Torre avanza el estado',anterior:c.torreEstatus?'Sí':'No',nuevo:v?'Sí':'No',por:A,ref:c.id});
    c.torreEstatus=v;return c;
  });},
  guardarCliente(uid,d){return exec(uid,'guardarCliente','',A=>{
    need(A,'clientes_gestionar','administrar clientes y proyectos');
    const editando=!!d.existente;
    const id=String(d.id||'').trim().toUpperCase();
    if(!/^[A-Z0-9_-]{2,20}$/.test(id))deny('Código del cliente: 2 a 20 caracteres (letras, números, guion).','VALIDACION');
    const nombre=String(d.nombre||'').trim();if(nombre.length<2||nombre.length>60)deny('Escribe el nombre del cliente (2 a 60 caracteres).','VALIDACION');
    const cl=String(d.cliente||'').trim().toUpperCase();if(cl.length<2||cl.length>60)deny('Escribe el nombre del cliente tal como aparece (o aparecerá) en la lista CLIENTES del catálogo (2 a 60 caracteres).','VALIDACION');
    /* Los proyectos se escriben (no solo se eligen del catálogo): Comercial y Administración pueden crear uno nuevo. */
    const proy=[...new Set((d.proyectos||[]).map(p=>String(p==null?'':p).trim().replace(/\s+/g,' ')).filter(Boolean))];
    if(!proy.length)deny('Asigna al menos un proyecto al cliente.','VALIDACION');
    if(proy.length>40)deny('Máximo 40 proyectos por cliente.','VALIDACION');
    const malo=proy.find(p=>p.length<2||p.length>60);if(malo)deny(`Proyecto "${malo}": debe tener entre 2 y 60 caracteres.`,'VALIDACION');
    if(editando){
      const c0=DB.clientes.find(x=>x.id===id);
      const quitados=c0?c0.proyectos.filter(p=>!proy.includes(p)):[];
      const enUso=quitados.filter(p=>DB.trips.some(t=>t.proyecto===id&&t.proyectoCat===p)||DB.rutas.some(r=>r.cliente===id&&r.proyecto===p)||DB.tarifas.some(t=>t.cliente===id&&t.proyecto===p));
      if(enUso.length)deny(`No se puede quitar ${enUso.join(', ')}: tiene viajes, rutas o tarifas registradas.`,'VALIDACION');
    }
    const nit=String(d.nit||'').trim().toUpperCase();if(nit&&!/^[A-Z0-9][A-Z0-9\-\/\.]{3,19}$/.test(nit))deny('Identificador fiscal no válido (4 a 20 caracteres).','VALIDACION');
    const correo=String(d.correoFacturacion||'').trim();if(correo&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))deny('Correo de facturación no válido.','VALIDACION');
    const tel=String(d.telefono||'').trim();if(tel.length>20)deny('Teléfono: máximo 20 caracteres.','VALIDACION');
    const cred=String(d.creditoDias==null?'':d.creditoDias).trim();if(cred!==''&&!/^\d{1,3}$/.test(cred))deny('Días de crédito: número entero de 0 a 999.','VALIDACION');
    const dir=String(d.direccionFiscal||'').trim(),con=String(d.contacto||'').trim(),obs=String(d.observaciones||'').trim();
    if(dir.length>120||con.length>60||obs.length>200)deny('Algún texto excede el máximo permitido.','VALIDACION');
    let link=String(d.linkContrato||'').trim();
    if(link&&!/^https?:\/\//i.test(link))link='https://'+link;
    if(link&&(!/^https?:\/\/[^\s]+$/i.test(link)||link.length>300))deny('Link del contrato no válido: debe ser una URL http(s) de máximo 300 caracteres.','VALIDACION');
    const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    const otros=DB.clientes.filter(c=>c.id!==id);
    if(!editando&&DB.clientes.some(c=>c.id===id))deny(`Ya existe un cliente con el código ${id}.`,'DUPLICADO');
    if(otros.some(c=>norm(c.nombre)===norm(nombre)))deny(`Ya existe un cliente con el nombre "${nombre}".`,'DUPLICADO');
    if(otros.some(c=>c.cliente===cl))deny(`El cliente "${cl}" del catálogo ya está registrado.`,'DUPLICADO');
    if(nit&&otros.some(c=>c.nit&&c.nit===nit))deny(`El identificador fiscal ${nit} ya está registrado en otro cliente.`,'DUPLICADO');
    const datos={nombre,cliente:cl,proyectos:proy,nit,direccionFiscal:dir,correoFacturacion:correo,contacto:con,telefono:tel,creditoDias:cred,observaciones:obs,linkContrato:link,activo:d.activo!==false};
    const c=DB.clientes.find(x=>x.id===id);
    if(editando){
      if(!c)deny('Cliente no encontrado.','NO_EXISTE');
      const etq={nombre:'Nombre',cliente:'Cliente (catálogo)',nit:'Identificador fiscal',direccionFiscal:'Dirección fiscal',correoFacturacion:'Correo de facturación',contacto:'Contacto',telefono:'Teléfono',creditoDias:'Días de crédito',observaciones:'Observaciones',linkContrato:'Link del contrato'};
      Object.keys(etq).forEach(k=>{if(String(c[k]||'')!==String(datos[k]))auditAdd({entidad:'CLIENTE',accion:'Cliente modificado',campo:etq[k],anterior:c[k]||'(vacío)',nuevo:datos[k]||'(vacío)',por:A,ref:id});});
      if(c.proyectos.slice().sort().join()!==proy.slice().sort().join())auditAdd({entidad:'CLIENTE',accion:'Proyectos del cliente modificados',campo:'Proyectos',anterior:c.proyectos.join(', '),nuevo:proy.join(', '),por:A,ref:id});
      if((c.activo!==false)!==datos.activo)auditAdd({entidad:'CLIENTE',accion:datos.activo?'Cliente activado':'Cliente desactivado',campo:'Estado',anterior:datos.activo?'Inactivo':'Activo',nuevo:datos.activo?'Activo':'Inactivo',por:A,ref:id});
      Object.assign(c,datos);c.modificadoPor=A.nombre;c.modificadoEn=nowIso();
    }else{
      DB.clientes.push(Object.assign({id,torreEstatus:false,creadoPor:A.nombre,creadoPorId:A.id,creadoEn:nowIso()},datos));
      auditAdd({entidad:'CLIENTE',accion:'Cliente creado',campo:'Proyectos',nuevo:proy.join(', '),por:A,ref:id});
    }
    syncRefs();return id;
  });},
});

return {API,ApiError,ROLES,PERMS,PERM_KEYS,PERM_DEFAULT,PROHIBIDO,ENV,CAT,PILOTOS,FLOTA,DESTINOS,ORIGENES,hasPerm,blankDB,syncRefs,estadoDocumentos,refrescarPilotos,
  getDB:()=>DB, setDB:d=>{DB=d;syncRefs();}};
}
