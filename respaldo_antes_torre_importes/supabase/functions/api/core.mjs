/* ARCHIVO GENERADO por scripts/build-core.mjs a partir de js/engine.js — NO editar a mano. */
export function createEngine(){

/* Zona horaria de Guatemala (UTC-6, sin horario de verano): las horas guardadas por el motor son "hora local de Guatemala". */
const pad=n=>String(n).padStart(2,'0');
const _sh=d=>new Date(d.getTime()-6*3600*1000);
const dstr=d=>{const x=_sh(d);return x.getUTCFullYear()+'-'+pad(x.getUTCMonth()+1)+'-'+pad(x.getUTCDate());};
const toLocal=d=>{const x=_sh(d);return dstr(d)+'T'+pad(x.getUTCHours())+':'+pad(x.getUTCMinutes());};
const fmtDate=s=>{if(!s)return'—';const [y,m,d]=s.split('-');return `${d}/${m}/${y}`;};
const fmtL=v=>v?`${fmtDate(v.slice(0,10))} ${v.slice(11,16)}`:'—';
const CAMPOS_TIEMPO=[['tIngresoPlanta','Ingreso a planta CP'],['tEsperaRampa','Espera en rampa'],['tRampa','Ingreso a rampa'],['tInicioCarga','Inicio de carga'],['tFinCarga','Fin de carga'],['tSalidaPlanta','Salida de planta'],['tSalida','Fecha y hora de salida'],['tIngresoBodega','Ingreso a bodega CG'],['tInicioDescarga','Inicio de descarga'],['tFinDescarga','Fin de descarga']];
const TKEYS=CAMPOS_TIEMPO.map(x=>x[0]);
const LBL={proyectoCat:'Proyecto',shipment:'Shipment',noViaje:'No. de viaje',opl:'OPL',tipoViaje:'Tipo de viaje',tipoCarga:'Tipo de carga',noCarga:'No. de carga',producto:'Producto',fechaPlan:'Fecha plan',pilotoId:'Piloto',origenId:'Origen',destinoId:'Destino',noDocRetorno:'No. doc retorno',qViaticos:'Q viáticos'};
CAMPOS_TIEMPO.forEach(([k,l])=>LBL[k]=l);
const CAT={
  clientes:[],      /* se arma con los clientes reales */
  proyectos:[],     /* se arma con los proyectos reales */
  tipoUnidad:[],
  opl:[],
  tipoCarga:[],
  tipoViaje:[],
  origen:[]
};

const FLOTA=[],PILOTOS=[],DESTINOS=[];   /* los carga el servidor desde las tablas flota, pilotos y destinos */
const ORIGENES=[];
function save(){return true;}            /* la persistencia la hace store.mjs dentro de una transacción */
function rollback(){}

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
const ENV={storageExists:()=>false};
let DB=null,PROYECTOS=[],PROYECTOS_X={},PREF={phone:false,arch:false},CLOCK=null;
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
  ['unidades_asignar','Asignar unidades y pilotos a vehículos','Transporte'],
  ['catalogos_editar','Editar las listas del sistema (tipo de unidad, OPL, orígenes, tipos)','Consulta']
];
const PERM_KEYS=PERMS.map(p=>p[0]);
/* Listas del sistema: viven en master.catalogos (Supabase) y se editan desde la pantalla Catálogos. */
const LISTAS_SISTEMA=['tipoUnidad','opl','tipoCarga','tipoViaje','origen'];
const LISTAS_ETIQUETA={tipoUnidad:'Tipo de unidad',opl:'OPL · Transportistas',tipoCarga:'Tipo de carga',tipoViaje:'Tipo de viaje',origen:'Orígenes'};
function refrescarOrigenes(){ORIGENES.length=0;(CAT.origen||[]).forEach(n=>ORIGENES.push({id:n,nombre:n}));}
const ROLES={
  ADMIN:{label:'Administradora',home:'inicio',nav:['inicio','proyectos','todos','viajes','nuevo','torre','liquidaciones','comercial','rutas','opl','finanzas','catalogos','usuarios','auditoria','modelo'],alcance:'Permisos completos en todos los módulos'},
  GERENTE_TRANSPORTE:{label:'Gerente de Transporte',home:'todos',nav:['todos','rutas','opl','liquidaciones','catalogos'],alcance:'Ver todo, asignar unidades/pilotos, autorizar/crear tarifas OPL'},
  VALIDADOR:{label:'Validador',home:'liquidaciones',nav:['viajes','liquidaciones'],alcance:'Revisar/aprobar liquidaciones de clientes asignados'},
  OPERATIVO:{label:'Operativo',home:'inicio',nav:['inicio','nuevo','viajes','liquidaciones'],alcance:'Registrar, editar y liquidar viajes de clientes asignados'},
  ANALISTA_COMERCIAL:{label:'Analista Comercial',home:'proyectos',nav:['proyectos','rutas'],alcance:'Administrar clientes y tarifas con auditoría obligatoria'},
  GERENTE_COMERCIAL:{label:'Gerencia Comercial',home:'rutas',nav:['proyectos','rutas','opl'],alcance:'Aprobar rutas, administrar clientes/tarifas, autorizar OPL'},
  FACTURACION:{label:'Facturación',home:'comercial',nav:['todos','comercial'],alcance:'Cargar facturas, revisar viajes por facturar'},
  COBROS:{label:'Cobros / Contabilidad',home:'comercial',nav:['comercial'],alcance:'Registrar cobros y pagos'},
  PAGO_OPL:{label:'Pago OPL',home:'opl',nav:['opl'],alcance:'Registrar OPL y tarifas a proveedores (requieren autorización)'},
  TORRE:{label:'Torre de control',home:'torre',nav:['torre'],alcance:'Editar horas y marcar Completado para viajes en ruta'},
  PROYECTOS:{label:'Proyectos',home:'inicio',nav:['inicio','proyectos','todos','viajes','nuevo','torre','liquidaciones','comercial','rutas','opl','finanzas','catalogos','auditoria','modelo'],alcance:'Revisar todos los módulos y datos. Las acciones las habilita la administradora según se necesiten.'}
};
const PERM_DEFAULT={
  ADMIN:PERM_KEYS.slice(),
  GERENTE_TRANSPORTE:['viajes_ver_todos','historial_ver','liq_ver','rutas_ver','rutas_validar','rutas_aprobar_transporte','viajes_aprobar_duplicado','unidades_asignar','tarifas_opl_ver','tarifas_opl_crear','viajes_editar_estado','tarifas_ver','liq_aprobar','liq_devolver'],
  VALIDADOR:['viajes_ver','liq_ver','liq_aprobar','liq_devolver','historial_ver'],
  OPERATIVO:['viajes_ver','viajes_crear','viajes_editar_datos','viajes_editar_tiempos','viajes_iniciar','viajes_finalizar','liq_ver','liq_enviar','historial_ver','rutas_ver','rutas_solicitar'],
  ANALISTA_COMERCIAL:['comercial_ver','tarifas_ver','tarifas_crear','tarifas_editar','tarifas_desactivar','rutas_ver','rutas_solicitar','rutas_validar','historial_ver','clientes_gestionar'],
  GERENTE_COMERCIAL:['viajes_ver_todos','historial_ver','comercial_ver','tarifas_ver','tarifas_crear','tarifas_editar','tarifas_desactivar','rutas_ver','rutas_validar','rutas_aprobar_comercial','clientes_gestionar','tarifas_opl_ver','tarifas_opl_autorizar'],
  FACTURACION:['viajes_ver_todos','comercial_ver','comercial_agrupar','facturas_emitir','tarifas_ver'],
  COBROS:['comercial_ver','cobros_registrar','finanzas_ver'],
  PAGO_OPL:['finanzas_ver','tarifas_opl_ver','tarifas_opl_crear'],
  TORRE:['viajes_ver_todos','viajes_estatus_torre'],
  PROYECTOS:['viajes_ver','viajes_ver_todos','historial_ver','tablero_ver','liq_ver','comercial_ver','rutas_ver','finanzas_ver','catalogos_ver','auditoria_ver','tarifas_ver','tarifas_opl_ver','clientes_gestionar']
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
  GERENTE_TRANSPORTE:['permisos_gestionar','usuarios_gestionar','clientes_gestionar','liq_aprobar','liq_devolver','tarifas_crear','tarifas_editar','tarifas_desactivar','rutas_aprobar_comercial'],
  VALIDADOR:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado',...FACT_TODO,...ADMIN_TODO,...FINANZAS_TODO,...TARIFAS_TODO,'tarifas_ver',...RUTAS_ADM,'rutas_solicitar','viajes_estatus_torre'],
  OPERATIVO:['liq_aprobar','liq_devolver','viajes_editar_estado',...FACT_TODO,...ADMIN_TODO,...FINANZAS_TODO,...TARIFAS_TODO,'tarifas_ver',...RUTAS_ADM,'viajes_estatus_torre'],
  ANALISTA_COMERCIAL:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver','usuarios_gestionar','permisos_gestionar','auditoria_ver','finanzas_ver','costos_registrar','cobros_registrar','pagos_registrar','viajes_estatus_torre','rutas_gestionar'],
  GERENTE_COMERCIAL:['permisos_gestionar','usuarios_gestionar','liq_aprobar','liq_devolver','viajes_aprobar_duplicado','rutas_aprobar_transporte','viajes_editar_estado'],
  FACTURACION:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver',...ADMIN_TODO,'costos_registrar','cobros_registrar','pagos_registrar','viajes_estatus_torre','rutas_gestionar','tarifas_crear','tarifas_editar','tarifas_desactivar'],
  COBROS:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver',...ADMIN_TODO,...TARIFAS_TODO,'tarifas_ver',...RUTAS_ADM,'viajes_estatus_torre'],
  PAGO_OPL:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver',...FACT_TODO,...ADMIN_TODO,...TARIFAS_TODO,'tarifas_ver',...RUTAS_ADM,'rutas_solicitar','viajes_estatus_torre','tarifas_opl_autorizar'],
  TORRE:[...OPERATIVOS,'viajes_editar_tiempos','viajes_editar_estado','liq_aprobar','liq_devolver',...FACT_TODO,...ADMIN_TODO,...FINANZAS_TODO,...TARIFAS_TODO,'tarifas_ver',...RUTAS_ADM,'rutas_solicitar'],
  PROYECTOS:['usuarios_gestionar','permisos_gestionar']
};
/* Permisos que no se pueden quitar (evita bloquearse a sí misma) */
const SIEMPRE={ADMIN:['permisos_gestionar','usuarios_gestionar','auditoria_ver']};
const VIEW_PERM={proyectos:'clientes_gestionar',todos:'viajes_ver_todos',torre:'viajes_ver_todos',liquidaciones:'liq_ver',comercial:'comercial_ver',rutas:'rutas_ver',opl:'tarifas_opl_ver',finanzas:'finanzas_ver',catalogos:'catalogos_ver',modelo:'catalogos_ver',usuarios:'usuarios_gestionar',auditoria:'auditoria_ver',nuevo:'viajes_crear',inicio:'viajes_ver',viajes:'viajes_ver'};
const NAVLBL={proyectos:['Clientes','folder'],todos:['Todos los viajes','list'],torre:['Torre de control','tower'],liquidaciones:['Liquidaciones','receipt'],comercial:['Facturación','dollar'],rutas:['Rutas','truck'],opl:['OPL · Proveedores','truck'],finanzas:['Finanzas','dollar'],nuevo:['Nuevo viaje','plus'],catalogos:['Catálogos','grid'],usuarios:['Usuarios y permisos','users'],auditoria:['Auditoría','shield'],modelo:['Modelo de datos','db'],inicio:['Inicio','home'],viajes:['Viajes','truck']};

const DATA_KEYS=['estado','proyectoCat','shipment','noViaje','opl','tipoViaje','tipoCarga','noCarga','producto','pilotoId','unidadId','rutaId','placaArrastre','noDocRetorno','qViaticos'];
const TIEMPO_KEYS=['fechaPlan',...TKEYS];
const DATA_EDIT_STATES=['PLANIFICADO','EN_RUTA','ENTREGADO','RECHAZADO'];
Object.assign(LBL,{shipment:'No. de Transporte',placaArrastre:'Placa del equipo de arrastre',rutaId:'Ruta',rutaRef:'Referencia de la ruta pendiente',origenId:'Origen',destinoId:'Destino',unidadId:'Unidad',numeroFactura:'Número de factura',tarifaCliente:'Tarifa cliente',costoProveedor:'Costo proveedor',qViaticos:'Q viáticos'});
const MONEY_LBL=['Tarifa cliente','Costo proveedor','Q viáticos'];

/* ---------- Base de datos ---------- */
const blankDB=()=>({v:DB_VERSION,usuarios:[],acceso:[],permisos:[],clientes:[],trips:[],liquidaciones:[],evidencias:[],agrupaciones:[],audit:[],pagos:[],ordenesPago:[],rutas:[],tarifas:[],mem:[],notificaciones:[],config:{},catalogosListas:{},seq:{trip:112,liq:1,evi:1,agr:1,evt:1,usr:8,cob:1,pag:1,op:1,rut:1,tar:1,not:1}});
function syncRefs(){
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
  refrescarOrigenes();
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
  if((PROHIBIDO[A.rol]||[]).includes(p))return false;
  const r=DB.permisos.find(x=>x.rol===A.rol&&x.permiso===p);
  return !!(r&&r.habilitado);
}
const clientesAsig=A=>A.rol==='ADMIN'?DB.clientes.filter(c=>c.activo!==false).map(c=>c.id):DB.acceso.filter(a=>a.userId===A.id).map(a=>a.cliente);
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
  if(k==='pilotoId')return (PILOTOS.find(p=>p.id===v)||{}).nombre||v;
  if(k==='origenId')return (ORIGENES.find(o=>o.id===v)||{}).nombre||v;
  if(k==='destinoId')return (DESTINOS.find(o=>o.id===v)||{}).nombre||v;
  if(TIEMPO_KEYS.includes(k))return fmtL(v);
  return String(v);
}
const proyectosDe=c=>(DB.clientes.find(x=>x.id===c)||{proyectos:[]}).proyectos;
const RX_DT=/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/;
function valKey(cliente,k,v){
  const vacio=v===''||v==null;
  switch(k){
    case 'proyectoCat':if(vacio||!proyectosDe(cliente).includes(v))return 'Proyecto no válido para este cliente.';break;
    case 'opl':if(!vacio&&!CAT.opl.includes(v))return 'OPL no válido.';break;
    case 'tipoViaje':if(!vacio&&!CAT.tipoViaje.includes(v))return 'Tipo de viaje no válido.';break;
    case 'tipoCarga':if(!vacio&&!CAT.tipoCarga.includes(v))return 'Tipo de carga no válido.';break;
    case 'noCarga':case 'qViaticos':if(!vacio&&!(isFinite(Number(v))&&Number(v)>=0))return `${LBL[k]}: escribe un número válido (0 o mayor).`;break;
    case 'shipment':case 'noViaje':case 'producto':case 'noDocRetorno':case 'placaArrastre':if(String(v).length>60)return `${LBL[k]}: máximo 60 caracteres.`;break;
    case 'unidadId':{if(!FLOTA.some(f=>f.unidad===v))return 'La unidad no está en la flota.';if(!PILOTOS.some(p=>p.proyecto===cliente&&p.unidad===v))return 'Esa unidad no está asignada a este cliente.';break;}
    case 'pilotoId':{const P=PILOTOS.find(p=>p.id===v);if(!P)return 'Piloto no válido.';if(P.proyecto!==cliente)return 'El piloto no pertenece a este cliente.';if(!P.unidad)return `${P.nombre} no tiene unidad asignada.`;break;}
    case 'origenId':if(!ORIGENES.some(o=>o.id===v))return 'Origen no válido.';break;
    case 'destinoId':{const D=DESTINOS.find(o=>o.id===v);if(!D)return 'Destino no válido.';if(D.proyecto!==cliente)return 'El destino no pertenece a este cliente.';break;}
    default:if(TIEMPO_KEYS.includes(k)){if(k==='fechaPlan'&&vacio)return 'La fecha plan es obligatoria.';if(!vacio&&!RX_DT.test(v))return `${LBL[k]}: fecha y hora no válidas.`;}
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

/* Los importes solo los ven los roles autorizados (se quitan en la capa de datos, no solo en pantalla). */
function redact(A,t){
  const c=Object.assign({},t);
  if(!hasPerm(A,'finanzas_ver')){delete c.costoProveedor;delete c.precioMem;delete c.ajusteCombustible;delete c.tarifaBase;}
  if(!hasPerm(A,'tarifas_ver')){delete c.tarifaCliente;delete c.tarifaId;delete c.tarifaAplicadaPor;delete c.tarifaAplicadaEn;}
  if(!hasPerm(A,'finanzas_ver')){delete c.tarifaOpl;delete c.tarifaOplBase;delete c.ajusteOpl;delete c.precioMemOpl;}
  if(!hasPerm(A,'finanzas_ver')&&!hasPerm(A,'viajes_editar_datos'))delete c.qViaticos;
  return c;
}
const r2=n=>Math.round(n*100)/100;
const nn=v=>(v===''||v==null||!isFinite(Number(v)))?null:Number(v);
const dLoc=iso=>iso?dstr(new Date(iso)):'';
const pagadoDe=(tipo,id)=>r2(DB.pagos.filter(p=>p.tipo===tipo&&p.viajeId===id&&!p.anulado).reduce((s,p)=>s+p.monto,0));
const cobradoDe=g=>r2((g.cobros||[]).reduce((s,x)=>s+x.monto,0));
/* Etapas financieras de una agrupación: enviado a facturar ≠ facturado ≠ cobrado */
const ETAPA_L={PREPARADA:'Preparada',ENVIADO_A_FACTURAR:'Enviada a facturación',FACTURADO:'Emitida',COBRO_PARCIAL:'Cobro parcial',COBRADO:'Cobrado',ANULADA:'Anulada'};
function etapaAgr(g){
  if(g.estado==='ANULADA')return 'ANULADA';
  if(g.fase==='PREPARADA')return 'PREPARADA';
  if(g.fase==='ENVIADA')return 'ENVIADO_A_FACTURAR';
  const c=cobradoDe(g);
  if(g.importeFacturado==null||g.importeFacturado==='')return c>0?'COBRO_PARCIAL':'FACTURADO';
  if(c<=0)return 'FACTURADO';
  return c>=g.importeFacturado-0.005?'COBRADO':'COBRO_PARCIAL';
}
/* Cálculo financiero PURO. Reglas: cada factura se cuenta una sola vez; un dato faltante nunca se trata como cero. */
function finCalc(trips,agrs,pagos,f){
  f=f||{};
  const tr=id=>trips.find(t=>t.id===id);
  const tIn=t=>{const d=(t.fechaPlan||'').slice(0,10);return (!f.desde||d>=f.desde)&&(!f.hasta||d<=f.hasta)&&(!f.cliente||t.proyecto===f.cliente)&&(!f.proyecto||t.proyectoCat===f.proyecto)&&(!f.proveedor||t.opl===f.proveedor);};
  const T=trips.filter(tIn);
  const A=agrs.filter(a=>a.estado==='ACTIVA'&&a.fase!=='PREPARADA'&&(!f.cliente||a.cliente===f.cliente)&&(!f.proyecto||a.viajeIds.some(i=>(tr(i)||{}).proyectoCat===f.proyecto))&&(!f.desde||dLoc(a.creadoEn)>=f.desde)&&(!f.hasta||dLoc(a.creadoEn)<=f.hasta));
  const pg=(tipo,id)=>r2(pagos.filter(p=>p.tipo===tipo&&p.viajeId===id&&!p.anulado).reduce((s,p)=>s+p.monto,0));
  const lastPg=(tipo,id)=>{const l=pagos.filter(p=>p.tipo===tipo&&p.viajeId===id&&!p.anulado).sort((a,b)=>a.fecha<b.fecha?-1:1);return {fecha:l.length?l[l.length-1].fecha:'',ref:l.map(x=>x.referencia).join(', ')};};
  const estPago=(ob,pa)=>ob==null?'SIN_IMPORTE':pa<=0?'PENDIENTE':pa<ob-0.005?'PARCIAL':'PAGADO';
  const agrRows=A.map(a=>{
    const cob=cobradoDe(a),fact=a.fase==='EMITIDA'?nn(a.importeFacturado):null;
    return {id:a.id,cliente:a.cliente,nViajes:a.viajeIds.length,viajes:a.viajeIds.slice(),enviado:nn(a.importeEnviado),sinImporte:(a.viajesSinImporte||[]).length,fase:a.fase,fechaEnvio:dLoc(a.envio?a.envio.en:a.creadoEn),factura:a.numeroFactura||'',fechaFactura:a.fechaFactura||'',facturado:fact,cobrado:cob,saldo:fact==null?null:r2(fact-cob),etapa:etapaAgr(a),cobros:(a.cobros||[]).slice()};
  });
  const tripRows=T.filter(t=>FIN.includes(t.estado)).map(t=>{
    const costo=nn(t.tarifaOpl)!=null?nn(t.tarifaOpl):nn(t.costoProveedor),via=nn(t.qViaticos),pp=pg('PROVEEDOR',t.id),pl=pg('PILOTO',t.id);
    const ag=agrs.find(a=>a.estado==='ACTIVA'&&a.fase!=='PREPARADA'&&a.viajeIds.includes(t.id));
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
const nombreOrigen=id=>(ORIGENES.find(o=>o.id===id)||{}).nombre||id||'';
const nombreDestino=id=>(DESTINOS.find(o=>o.id===id)||{}).nombre||id||'';
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
  DB.tarifas.filter(t=>t.rutaId===r.id).forEach(t=>{t.activa=true;t.modificadoPor=A.nombre;t.modificadoEn=nowIso();});
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
  const r={id:'R-'+pad4(DB.seq.rut++),codigo:'',nombre:o.nombre,cliente:o.cliente,proyecto:o.proyecto,origenId:'',destinoId:'',estado:'PENDIENTE',origenProp:o.origenProp||'',destinoProp:o.destinoProp||'',fuente:o.fuente,solicitadaPorId:A.id,solicitadaPor:A.nombre,solicitadaEn:nowIso(),validadaPor:'',validadaEn:'',aprobacionComercial:null,aprobacionTransporte:null,rechazo:null,viajeRef:o.viajeRef||''};
  DB.rutas.push(r);
  auditAdd({entidad:'RUTA',accion:'Ruta nueva solicitada',campo:'Ruta',nuevo:o.nombre,por:A,ref:`${r.id} · ${o.cliente} · ${o.proyecto}`});
  notificar(A,{tipo:'RUTA_PENDIENTE',destinatarios:['GERENCIA_COMERCIAL','GERENCIA_TRANSPORTE'],asunto:`Ruta nueva pendiente de validación: ${o.nombre}`,detalle:{proyecto:o.proyecto,cliente:o.cliente,ruta:o.nombre,origen:o.origenProp||'(no indicado)',destino:o.destinoProp||'(no indicado)',solicitadoPor:A.nombre,fecha:r.solicitadaEn,viaje:o.viajeRef||''}});
  return r;
}
function validarRutaDatos(d){
  const cliente=d.cliente;if(!DB.clientes.find(c=>c.id===cliente))deny('Cliente no válido.','VALIDACION');
  if(!proyectosDe(cliente).includes(d.proyecto))deny('Proyecto no válido para el cliente.','VALIDACION');
  const codigo=String(d.codigo||'').trim().toUpperCase();
  if(!/^[A-Z0-9][A-Z0-9_-]{2,19}$/.test(codigo))deny('Código de ruta: 3 a 20 caracteres (letras, números, guion).','VALIDACION');
  if(DB.rutas.some(r=>r.id!==d.id&&r.codigo===codigo&&r.estado!=='RECHAZADA'))deny(`El código de ruta ${codigo} ya existe.`,'DUPLICADO');
  const nombre=String(d.nombre||'').trim();if(nombre.length<3)deny('Escribe el nombre de la ruta.','VALIDACION');
  if(!ORIGENES.some(o=>o.id===d.origenId))deny('Origen no válido (catálogo ORIGEN).','VALIDACION');
  const de=DESTINOS.find(x=>x.id===d.destinoId);if(!de||de.proyecto!==cliente)deny('Destino no válido para este cliente.','VALIDACION');
  if(DB.rutas.some(r=>r.id!==d.id&&r.estado!=='RECHAZADA'&&r.cliente===cliente&&r.proyecto===d.proyecto&&r.origenId===d.origenId&&r.destinoId===d.destinoId))deny('Ya existe una ruta con ese origen y destino en el proyecto.','DUPLICADO');
  return {codigo,nombre,cliente,proyecto:d.proyecto,origenId:d.origenId,destinoId:d.destinoId};
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
function aplicarUna(A,t){
  if(t.estado!=='ACEPTADO'||t.agrupacionId)return {err:'Solo se aplica tarifa a viajes aceptados que aún no estén facturados.'};
  const r=tarifaPara(t);if(r.err)return r;
  const d=ajusteDelViaje(t,r.t);
  const o=ajusteOplDelViaje(t,r.t);
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
/* Campos obligatorios para ENVIAR una factura. Se usa en la interfaz (para señalar lo que falta) y de nuevo en el guardado. */
function faltantesEnvio(cliente,ids,nf,ff,exceptId){
  const f=[],num=String(nf||'').trim(),serie=String(arguments[5]||'').trim();
  if(!serie)f.push({campo:'serieFactura',msg:'la serie de factura'});else valSerie(serie);
  if(!num)f.push({campo:'numeroFactura',msg:'el número de factura'});
  else if(DB.agrupaciones.some(a=>a.estado==='ACTIVA'&&a.id!==exceptId&&a.numeroFactura&&a.numeroFactura.toLowerCase()===num.toLowerCase()))f.push({campo:'numeroFactura',msg:'un número de factura que no esté repetido'});
  if(!ff)f.push({campo:'fechaFactura',msg:'la fecha de factura'});
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
   API  (única vía de lectura y escritura)
   ===================================================================== */
const API={
  /* ----- sesión ----- */
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
      if(MONEY_LBL.includes(e.campo)&&!(e.campo==='Q viáticos'?verViat:verMoney))continue;
      if(soloTiempos&&!TIEMPO_KEYS.some(k=>LBL[k]===e.campo))continue;
      let a=porViaje.get(e.viajeId);if(!a){a=[];porViaje.set(e.viajeId,a);}a.push(e);
    }
    return porViaje;
  },
  liquidaciones(uid,id){
    const A=actor(uid),t=API.viaje(uid,id);
    if(!hasPerm(A,'liq_ver')&&!hasPerm(A,'liq_enviar'))throw new ApiError('SIN_PERMISO','Tu perfil no puede ver liquidaciones.');
    return DB.liquidaciones.filter(l=>l.viajeId===t.id).map(l=>Object.assign({},l,{evidencia:(DB.evidencias.find(e=>e.id===l.evidenciaId)||{}).dataUrl||''}));
  },
  agrupaciones(uid){const A=actor(uid);need(A,'comercial_ver','ver el módulo Comercial');return DB.agrupaciones.slice();},
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
  crearViaje(uid,d){return exec(uid,'crearViaje','',A=>{
    need(A,'viajes_crear','crear viajes');
    const cliente=d&&d.cliente,cl=DB.clientes.find(c=>c.id===cliente);
    if(!cl)deny('Cliente no válido.','VALIDACION');
    if(cl.activo===false)deny('El cliente está desactivado: no admite viajes nuevos.','VALIDACION');
    if(!clientesAsig(A).includes(cliente))deny('No tienes asignado ese cliente: no puedes crear viajes para él.');
    const keys=[...DATA_KEYS,...TIEMPO_KEYS,'rutaRef'];
    Object.keys(d).forEach(k=>{if(k!=='cliente'&&!keys.includes(k))deny(k==='origenId'||k==='destinoId'?'El origen y el destino se completan solos a partir de la ruta: no se escriben a mano.':`Campo no permitido: ${k}.`,'CAMPO_NO_EDITABLE');});
    const v={};keys.forEach(k=>{v[k]=d[k]==null?'':(typeof d[k]==='string'?d[k].trim():d[k]);});
    /* Estado inicial: Planificado por defecto; solo quien tiene permiso puede fijar otro (y siempre uno válido). */
    if(!v.estado||!ESTADOS[v.estado]||!hasPerm(A,'viajes_editar_estado'))v.estado='PLANIFICADO';
    if(!v.rutaId)deny('Falta Ruta.','VALIDACION');
    keys.forEach(k=>{if(k==='rutaId'||k==='rutaRef'||v[k]===''||v[k]==null)return;const m=valKey(cliente,k,v[k]);if(m)deny(m,'VALIDACION');});
    let ruta=null,pend=v.rutaId==='NO_ASIGNADA';
    if(pend){need(A,'rutas_solicitar','solicitar rutas nuevas');if(!v.proyectoCat||!proyectosDe(cliente).includes(v.proyectoCat))deny('Para solicitar una ruta nueva selecciona el proyecto.','VALIDACION');if(String(v.rutaRef||'').length<3)deny('Para una ruta no activa escribe la referencia (qué ruta se necesita): se envía a validación.','VALIDACION');if(v.rutaRef.length>80)deny('La referencia de la ruta admite máximo 80 caracteres.','VALIDACION');}
    else {ruta=DB.rutas.find(r=>r.id===v.rutaId);if(!ruta||ruta.cliente!==cliente)deny('La ruta no corresponde al cliente elegido.','VALIDACION');v.proyectoCat=ruta.proyecto;}
    const clave=pend?'ref:'+v.rutaRef.toLowerCase():v.rutaId;
    const dup=v.fechaPlan&&v.pilotoId&&DB.trips.find(t=>t.fechaPlan===v.fechaPlan&&t.pilotoId===v.pilotoId&&((pend&&t.rutaRef&&('ref:'+t.rutaRef.toLowerCase())===clave)||(!pend&&t.rutaId===clave)));
    if(dup)deny(`Este viaje ya existe (#${dup.id}): misma fecha y hora plan, piloto y ruta.`,'DUPLICADO');
    const id=String(DB.seq.trip++).padStart(6,'0');
    let rutaId=v.rutaId;
    if(pend){const rr=crearRutaPendiente(A,{cliente,proyecto:v.proyectoCat,nombre:v.rutaRef,fuente:'VIAJE',viajeRef:id});rutaId=rr.id;}
    const P=PILOTOS.find(p=>p.id===v.pilotoId);
    const t=Object.assign({id,proyecto:cliente,unidadId:P?P.unidad:'',estado:'PLANIFICADO',creadoPor:A.nombre,creadoPorId:A.id,creadoEn:nowIso(),comentarioRevision:'',rechazos:0,duplicadoAprobado:false,liqIntentos:0,liqActualId:'',liqAprobadaEn:'',agrupacionId:'',numeroFactura:'',tarifaCliente:'',tarifaId:'',costoProveedor:''},v,{rutaId,origenId:ruta?ruta.origenId:'',destinoId:ruta?ruta.destinoId:'',rutaRef:pend?v.rutaRef:''});
    if(!t.unidadId)t.unidadId=P?P.unidad:'';            /* si no se eligió placa, se usa la unidad del piloto */
    DB.trips.push(t);
    auditAdd({viajeId:id,accion:'Viaje creado',campo:'Estado',nuevo:ESTADOS[t.estado].l,por:A,ref:`${cliente}${pend?' · ruta NO ASIGNADA':''}`});
    return t;
  });},

  editarViaje(uid,id,cambios,motivo){return exec(uid,'editarViaje',id,A=>{
    const t=getT(id);if(!puedeVer(A,t))deny('No tienes acceso a viajes de otro cliente.');
    const ks=Object.keys(cambios||{});if(!ks.length)return {cambios:0};
    const esAsig=asignado(A,t),todos=hasPerm(A,'viajes_ver_todos'),cl=DB.clientes.find(x=>x.id===t.proyecto)||{};
    ks.forEach(k=>{
      if(k==='estado'){
        need(A,'viajes_editar_estado','modificar manualmente el estado del viaje');
        if(!(cambios[k]===''||cambios[k]==null)&&!ESTADOS[cambios[k]])deny('Estado no válido.','VALIDACION');
      }else if(TIEMPO_KEYS.includes(k)){
        need(A,'viajes_editar_tiempos','editar fechas y horas');
        if(!todos&&!esAsig)deny('Solo puedes editar viajes de tus clientes asignados.');
        if(!esAsig)deny('Solo el encargado del cliente puede editar fechas y horas.','CAMPO_NO_AUTORIZADO');
        if(!todos&&!esDueno(A,t))deny('Solo puedes editar los viajes que registraste tú (o los que no tienen responsable asignado).','SIN_PROPIEDAD');
        if(['FACTURADO','COBRADO'].includes(t.estado))deny('El viaje ya fue facturado: sus fechas y horas ya no se pueden modificar.','ESTADO_BLOQUEADO');
      }else if(DATA_KEYS.includes(k)){
        need(A,'viajes_editar_datos','editar datos distintos de fechas y horas');
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
      auditAdd({viajeId:t.id,accion:esT?'Fecha/hora modificada':'Dato modificado',campo:LBL[k]||k,anterior:k==='rutaId'?rutaNombre(ov):fmtVal(k,ov),nuevo:k==='rutaId'?rutaNombre(nv):fmtVal(k,nv),por:A,motivo:motivo||''});
      t[k]=nv;
      if(k==='pilotoId'){const P=PILOTOS.find(p=>p.id===nv);const antes=t.unidadId;if(!('unidadId' in cambios)){t.unidadId=P.unidad;auditAdd({viajeId:t.id,accion:'Dato modificado (por cambio de piloto)',campo:'Unidad',anterior:antes,nuevo:P.unidad,por:A,motivo:motivo||''});}}
      if(k==='rutaId'){const r=DB.rutas.find(x=>x.id===nv);const ao=t.origenId,ad=t.destinoId;t.origenId=r.origenId;t.destinoId=r.destinoId;t.rutaRef='';
        auditAdd({entidad:'RUTA',viajeId:t.id,accion:'Origen y destino actualizados por cambio de ruta',campo:'Origen',anterior:ao?nombreOrigen(ao):'(pendiente)',nuevo:nombreOrigen(r.origenId),por:A,ref:r.id});
        auditAdd({entidad:'RUTA',viajeId:t.id,accion:'Origen y destino actualizados por cambio de ruta',campo:'Destino',anterior:ad?nombreDestino(ad):'(pendiente)',nuevo:nombreDestino(r.destinoId),por:A,ref:r.id});}
    });
    if(dif.length){t.editadoPor=A.nombre;t.editadoEn=nowIso();}
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
    requerido(t,TKEYS,'Entregado');
    moveEstado(t,'ENTREGADO',A,'Viaje entregado');
    t.finalizadoPor=A.nombre;t.finalizadoEn=nowIso();
    return t;
  });},

  /* Torre de Control: avanza el estado (solo En ruta / Entregado) de los viajes de los clientes autorizados */
  torreMoverEstado(uid,id,nuevo){return exec(uid,'torreMoverEstado',id,A=>{
    need(A,'viajes_estatus_torre','avanzar el estado del viaje');
    const t=getT(id);if(!puedeVer(A,t))deny('No tienes acceso a este viaje.');
    const cl=DB.clientes.find(x=>x.id===t.proyecto)||{};
    if(!cl.torreEstatus)deny(`Torre de Control solo avanza el estado de los clientes autorizados (Coca-Cola y Frito Lay). ${cl.cliente||t.proyecto} es solo consulta.`,'CLIENTE_NO_AUTORIZADO');
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
      requerido(t,TKEYS,'Entregado');
      moveEstado(t,'ENTREGADO',A,'Viaje entregado (Torre de Control)');
      t.finalizadoPor=A.nombre;t.finalizadoEn=nowIso();
    }
    return t;
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
    ks.forEach(k=>{if(!TIEMPO_KEYS.includes(k))deny(`El campo "${LBL[k]||k}" no es una fecha ni un horario: Torre de Control no puede editarlo.`,'CAMPO_NO_EDITABLE');});
    const dif=[];
    ks.forEach(k=>{
      const nv=typeof cambios[k]==='string'?cambios[k].trim():cambios[k],ov=t[k]==null?'':t[k];
      if(String(nv==null?'':nv)===String(ov))return;
      const m=valKey(t.proyecto,k,nv);if(m)deny(m,'VALIDACION');
      dif.push([k,ov,nv==null?'':nv]);
    });
    if(!dif.length)return {cambios:0};
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
    if(!t.finalizadoEn)deny('La liquidación no puede enviarse antes de entregar el viaje.','ESTADO_INVALIDO');
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
  prepararFactura(uid,d){return exec(uid,'prepararFactura','',A=>{
    need(A,'comercial_agrupar','preparar facturas');
    const cliente=d&&d.cliente;
    const cl=DB.clientes.find(c=>c.id===cliente);if(!cl)deny('Selecciona el cliente de la factura.','VALIDACION');
    const ids=Array.isArray(d.viajeIds)?d.viajeIds.slice():[];
    if(!ids.length)deny('Selecciona al menos un viaje.','VALIDACION');
    if(new Set(ids).size!==ids.length)deny('La selección contiene viajes duplicados.','VALIDACION');
    const nf=String(d.numeroFactura||'').trim(),sf=String(d.serieFactura||'').trim();if(nf)valFactura(nf,null);if(sf)valSerie(sf);
    const ff=String(d.fechaFactura||'').trim();if(ff&&!/^\d{4}-\d{2}-\d{2}$/.test(ff))deny('Fecha de factura no válida.','VALIDACION');
    const ts=ids.map(id=>{
      const t=DB.trips.find(x=>x.id===id);
      if(!t)deny(`El viaje ${id} no existe.`,'NO_EXISTE');
      if(t.proyecto!==cliente)deny(`El viaje ${id} pertenece a otro cliente (${t.proyecto}). Una factura solo puede contener viajes de ${cliente}.`,'CLIENTE_DISTINTO');
      if(t.agrupacionId||['FACTURADO','COBRADO'].includes(t.estado))deny(`El viaje ${id} ya está asociado a la factura ${t.agrupacionId}. Para reasignarlo hay que anular esa factura (permiso restringido).`,'YA_FACTURADO');
      if(t.estado!=='ACEPTADO'||!t.liqAprobadaEn||!puedeVer(A,t))deny(`El viaje ${id} no es elegible para facturación: no está aceptado.`,'NO_ELEGIBLE');
      return t;
    });
    const gid='AGR-'+pad4(DB.seq.agr++),en=nowIso();
    DB.agrupaciones.push({id:gid,cliente,modalidad:ids.length===1?'INDIVIDUAL':'AGRUPADA',fase:'PREPARADA',viajeIds:ids,serieFactura:sf,numeroFactura:nf,fechaFactura:ff,importeEnviado:null,importesViaje:{},viajesSinImporte:[],importeFacturado:null,envio:null,emision:null,cobros:[],estado:'ACTIVA',creadoPorId:A.id,creadoPor:A.nombre,creadoEn:en,anulada:null,correcciones:[]});
    auditAdd({entidad:'AGRUPACION',accion:ids.length===1?'Factura individual preparada':'Factura de viajes agrupados preparada',campo:'Viajes',nuevo:ids.join(', '),por:A,ref:gid+(nf?` · ${nf}`:'')});
    ts.forEach(t=>{t.agrupacionId=gid;if(nf)t.numeroFactura=nf;});     /* se reserva el viaje: no puede ir en otra factura */
    return DB.agrupaciones[DB.agrupaciones.length-1];
  });},

  actualizarFactura(uid,agrId,d){return exec(uid,'actualizarFactura','',A=>{
    need(A,'comercial_agrupar','completar facturas');
    const g=DB.agrupaciones.find(x=>x.id===agrId);if(!g)deny('La factura no existe.','NO_EXISTE');
    if(g.estado!=='ACTIVA'||g.fase!=='PREPARADA')deny('Solo se pueden completar facturas preparadas (aún no enviadas).','ESTADO_INVALIDO');
    const nf=String((d&&d.numeroFactura)||'').trim(),sf=String((d&&d.serieFactura)||'').trim(),ff=String((d&&d.fechaFactura)||'').trim();
    if(nf)valFactura(nf,g.id);
    if(sf)valSerie(sf);
    if(ff&&!/^\d{4}-\d{2}-\d{2}$/.test(ff))deny('Fecha de factura no válida.','VALIDACION');
    if(nf!==g.numeroFactura){auditAdd({entidad:'AGRUPACION',accion:'Factura preparada: número actualizado',campo:'Número de factura',anterior:g.numeroFactura||'(vacío)',nuevo:nf||'(vacío)',por:A,ref:g.id});g.numeroFactura=nf;g.viajeIds.forEach(id=>{getT(id).numeroFactura=nf;});}
    if(sf!==(g.serieFactura||'')){auditAdd({entidad:'AGRUPACION',accion:'Factura preparada: serie actualizada',campo:'Serie de factura',anterior:g.serieFactura||'(vacío)',nuevo:sf||'(vacío)',por:A,ref:g.id});g.serieFactura=sf;}
    if(ff!==g.fechaFactura){auditAdd({entidad:'AGRUPACION',accion:'Factura preparada: fecha actualizada',campo:'Fecha de factura',anterior:g.fechaFactura||'(vacío)',nuevo:ff||'(vacío)',por:A,ref:g.id});g.fechaFactura=ff;}
    return g;
  });},

  enviarFactura(uid,agrId){return exec(uid,'enviarFactura','',A=>{
    need(A,'comercial_agrupar','enviar facturas a facturación');
    const g=DB.agrupaciones.find(x=>x.id===agrId);if(!g)deny('La factura no existe.','NO_EXISTE');
    if(g.estado!=='ACTIVA'||g.fase!=='PREPARADA')deny(g.fase==='PREPARADA'?'La factura está anulada.':'Esta factura ya fue enviada a facturación.','ESTADO_INVALIDO');
    const falt=faltantesEnvio(g.cliente,g.viajeIds,g.numeroFactura,g.fechaFactura,g.id,g.serieFactura);
    if(falt.length){const e=new ApiError('FALTAN_CAMPOS','No se puede enviar: falta '+falt.map(x=>x.msg).join('; ')+'.');e.faltantes=falt;throw e;}
    const importesViaje={};let tot=0;
    g.viajeIds.forEach(id=>{const v=nn(getT(id).tarifaCliente);importesViaje[id]=v;tot+=v;});
    const en=nowIso();
    g.importesViaje=importesViaje;g.importeEnviado=r2(tot);g.viajesSinImporte=[];g.fase='ENVIADA';g.envio={porId:A.id,por:A.nombre,en,resultado:'OK'};
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
    const dif=Math.abs(imp-g.importeEnviado)>0.005,mot=String(d.motivoDiferencia||'').trim();
    if(dif&&mot.length<5)deny(`El importe emitido (Q ${r2(imp)}) difiere de lo enviado a facturar (Q ${g.importeEnviado}): explica el motivo.`,'VALIDACION');
    g.fase='EMITIDA';g.importeFacturado=r2(imp);
    g.emision={porId:A.id,por:A.nombre,en:nowIso(),fecha:d.fechaEmision,importe:r2(imp),evidencia:ev,archivo:arch,archivoPath:archPath,motivoDiferencia:dif?mot:''};
    auditAdd({entidad:'AGRUPACION',accion:'Factura emitida oficialmente (con evidencia)',campo:'Fase',anterior:'Enviada a facturación',nuevo:'Emitida',por:A,motivo:dif?mot:'',ref:`${g.id} · ${g.numeroFactura} · Q ${g.importeFacturado} · ${ev}`});
    return g;
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
    g.cobros.push(c);
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
    auditAdd({entidad:'AGRUPACION',accion:'Número de factura corregido',campo:'Número de factura',anterior:ant,nuevo:nf,por:A,motivo:m,ref:g.id});
    g.viajeIds.forEach(id=>{const t=getT(id);t.numeroFactura=nf;auditAdd({entidad:'AGRUPACION',viajeId:id,accion:'Número de factura corregido',campo:'Número de factura',anterior:ant,nuevo:nf,por:A,motivo:m,ref:g.id});});
    return g;
  });},

  anularAgrupacion(uid,agrId,motivo){return exec(uid,'anularAgrupacion','',A=>{
    need(A,'comercial_anular','anular facturas');
    const g=DB.agrupaciones.find(x=>x.id===agrId);if(!g)deny('La factura no existe.','NO_EXISTE');
    if(g.estado!=='ACTIVA')deny('La factura ya está anulada.','ESTADO_INVALIDO');
    const m=String(motivo||'').trim();if(m.length<5)deny('El motivo de la anulación es obligatorio (mínimo 5 caracteres).','VALIDACION');
    if(cobradoDe(g)>0)deny('La factura ya tiene cobros registrados: no se puede anular sin revertir antes esos cobros.','TIENE_COBROS');
    const fase=g.fase;
    g.estado='ANULADA';g.anulada={porId:A.id,por:A.nombre,en:nowIso(),motivo:m,faseAlAnular:fase};
    auditAdd({entidad:'AGRUPACION',accion:'Factura anulada',campo:'Estado',anterior:'ACTIVA',nuevo:'ANULADA',por:A,motivo:m,ref:`${g.id}${g.numeroFactura?' · '+g.numeroFactura:''}`});
    g.viajeIds.forEach(id=>{
      const t=getT(id);const prev=`${g.id}${t.numeroFactura?' · '+t.numeroFactura:''}`;
      t.agrupacionId='';t.numeroFactura='';
      if(t.estado==='FACTURADO')moveEstado(t,'ACEPTADO',A,'Asignación comercial anulada',m,prev);
      else auditAdd({entidad:'AGRUPACION',viajeId:id,accion:'Reserva de factura liberada',campo:'Factura',anterior:prev,nuevo:'(liberado)',por:A,motivo:m});
    });
    return g;
  });},

  /* ----- finanzas: costos, pagos y consulta ----- */
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
    const importes={};let tot=0;
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
    });
    const en=nowIso(),nOp=(Number(DB.seq.op)||0)+1;DB.seq.op=nOp;
    const o={id:'OP-'+pad4(nOp),proveedor:prov,viajeIds:ids,fase:'EMITIDA',importe:r2(tot),importesViaje:importes,
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
    const monto=nn(d&&d.monto);if(monto==null||monto<=0)deny('El monto pagado debe ser mayor a cero.','VALIDACION');
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
  agrupaciones(uid){const A=actor(uid);need(A,'comercial_ver','ver el módulo Comercial');return DB.agrupaciones.slice();},
  movimientosComerciales(uid){
    const A=actor(uid);need(A,'comercial_ver','ver el módulo Comercial');
    return DB.audit.filter(e=>e.entidad==='AGRUPACION').map(e=>({id:e.id,accion:e.accion,campo:e.campo,anterior:e.anterior,nuevo:e.nuevo,por:e.por,en:e.en,motivo:e.motivo,ref:e.ref}));
  },

  /* ----- tarifas ----- */
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
    const r=DB.rutas.find(x=>x.id===v.rutaId);
    const t=Object.assign({id:'TAR-'+pad4(DB.seq.tar++),activa:r&&r.estado==='ACTIVA',creadoPorId:A.id,creadoPor:A.nombre,creadoEn:nowIso(),modificadoPor:'',modificadoEn:''},v);
    DB.tarifas.push(t);
    if(r&&r.estado==='EN_TARIFACION'){r.estado='PENDIENTE_APROBACION';auditAdd({entidad:'RUTA',accion:'Tarifa definida para ruta',campo:'Estado',anterior:'En tarifación',nuevo:'Pendiente de aprobaciones',por:A,ref:r.id});}
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
    const lista=(Array.isArray(ids)&&ids.length?ids:DB.trips.filter(t=>t.estado==='ACEPTADO'&&!t.agrupacionId).map(t=>t.id));
    const ok=[],sin=[];
    lista.forEach(id=>{const t=DB.trips.find(x=>x.id===id);if(!t||!puedeVer(A,t)){sin.push({id,motivo:'Sin acceso o inexistente.'});return;}const r=aplicarUna(A,t);if(r.err)sin.push({id,motivo:r.err});else ok.push(id);});
    return {aplicadas:ok,sinTarifa:sin};
  });},
  viajesSinTarifa(uid){
    const A=actor(uid);need(A,'comercial_ver','ver el módulo Comercial');
    return DB.trips.filter(t=>t.estado==='ACEPTADO'&&!t.agrupacionId&&(nn(t.tarifaCliente)==null||nn(t.tarifaOpl)==null)&&puedeVer(A,t)).map(t=>{const r=tarifaPara(t);const faltaOpl=nn(t.tarifaOpl)==null&&nn(t.tarifaCliente)!=null;return {id:t.id,cliente:t.proyecto,proyecto:t.proyectoCat,motivo:r.err||(faltaOpl?'Sin tarifa de proveedor (OPL) en la tarifa vigente.':'Hay una tarifa vigente: falta aplicarla.'),disponible:!r.err};});
  },

  /* ----- rutas ----- */
  rutas(uid){const A=actor(uid);need(A,'rutas_ver','consultar rutas');return DB.rutas.filter(r=>rutaVisible(A,r)).map(r=>Object.assign({},r,{viajes:DB.trips.filter(t=>t.rutaId===r.id).length}));},
  rutasParaViaje(uid,cliente,proyecto){const A=actor(uid);return DB.rutas.filter(r=>r.estado==='ACTIVA'&&r.cliente===cliente&&r.proyecto===proyecto&&rutaVisible(A,r)).map(r=>Object.assign({},r));},
  solicitarRuta(uid,d){return exec(uid,'solicitarRuta','',A=>{
    need(A,'rutas_solicitar','solicitar rutas nuevas');
    const cliente=d&&d.cliente,cl=DB.clientes.find(c=>c.id===cliente);if(!cl)deny('Selecciona el cliente.','VALIDACION');
    if(!clientesAsig(A).includes(cliente))deny('No tienes asignado ese cliente.');
    const proy=d.proyecto;if(!proyectosDe(cliente).includes(proy))deny('Selecciona un proyecto válido del cliente.','VALIDACION');
    if(!proyectosAsig(A,cliente).includes(proy))deny('Solo puedes solicitar rutas de tu proyecto asignado.');
    const nombre=String(d.nombre||'').trim();if(nombre.length<3||nombre.length>80)deny('Escribe el nombre o la referencia de la ruta (3 a 80 caracteres).','VALIDACION');
    const op=String(d.origenProp||'').trim(),dp=String(d.destinoProp||'').trim();if(op.length>80||dp.length>80)deny('Origen y destino: máximo 80 caracteres.','VALIDACION');
    if(DB.rutas.some(r=>!['RECHAZADA'].includes(r.estado)&&r.cliente===cliente&&r.proyecto===proy&&r.nombre.toLowerCase()===nombre.toLowerCase()))deny('Ya hay una ruta pendiente con esa referencia en este proyecto.','DUPLICADO');
    return crearRutaPendiente(A,{cliente,proyecto:proy,nombre,origenProp:op,destinoProp:dp,fuente:'SOLICITUD'});
  });},
  registrarRuta(uid,d){return exec(uid,'registrarRuta','',A=>{
    need(A,'rutas_gestionar','registrar rutas en el catálogo');
    const v=validarRutaDatos(d);
    const r={id:'R-'+pad4(DB.seq.rut++),codigo:v.codigo,nombre:v.nombre,cliente:v.cliente,proyecto:v.proyecto,origenId:v.origenId,destinoId:v.destinoId,estado:'EN_TARIFACION',origenProp:'',destinoProp:'',fuente:'CATALOGO',solicitadaPorId:A.id,solicitadaPor:A.nombre,solicitadaEn:nowIso(),validadaPor:A.nombre,validadaEn:nowIso(),aprobacionComercial:null,aprobacionTransporte:null,rechazo:null,viajeRef:''};
    DB.rutas.push(r);
    auditAdd({entidad:'RUTA',accion:'Ruta registrada para tarifación',campo:'Ruta',nuevo:`${r.codigo} · ${nombreOrigen(r.origenId)} → ${nombreDestino(r.destinoId)}`,por:A,ref:r.id});
    return r;
  });},
  validarRuta(uid,id,d){return exec(uid,'validarRuta','',A=>{
    need(A,'rutas_validar','validar o asignar rutas');
    const r=DB.rutas.find(x=>x.id===id);if(!r)deny('La ruta no existe.','NO_EXISTE');
    if(r.estado!=='PENDIENTE')deny('Solo se validan rutas pendientes.','ESTADO_INVALIDO');
    const v=validarRutaDatos({codigo:d&&d.codigo,nombre:r.nombre,cliente:r.cliente,proyecto:r.proyecto,origenId:d&&d.origenId,destinoId:d&&d.destinoId});
    r.codigo=v.codigo;r.origenId=v.origenId;r.destinoId=v.destinoId;r.estado='EN_TARIFACION';r.validadaPor=A.nombre;r.validadaEn=nowIso();
    auditAdd({entidad:'RUTA',accion:'Ruta validada',campo:'Estado',anterior:'Pendiente',nuevo:'En tarifación',por:A,ref:`${r.id} · ${r.codigo} · ${nombreOrigen(r.origenId)} → ${nombreDestino(r.destinoId)}`});
    DB.trips.filter(t=>t.rutaId===r.id).forEach(t=>{
      const ao=t.origenId,ad=t.destinoId;t.origenId=r.origenId;t.destinoId=r.destinoId;
      auditAdd({entidad:'RUTA',viajeId:t.id,accion:'Ruta asignada: origen y destino completados',campo:'Origen',anterior:ao?nombreOrigen(ao):'(pendiente)',nuevo:nombreOrigen(r.origenId),por:A,ref:r.id});
      auditAdd({entidad:'RUTA',viajeId:t.id,accion:'Ruta asignada: origen y destino completados',campo:'Destino',anterior:ad?nombreDestino(ad):'(pendiente)',nuevo:nombreDestino(r.destinoId),por:A,ref:r.id});
    });
    notificar(A,{tipo:'RUTA_TARIFACION',destinatarios:['GERENCIA_COMERCIAL'],asunto:`Ruta lista para definir tarifa: ${r.codigo}`,detalle:{ruta:r.nombre,codigo:r.codigo,proyecto:r.proyecto,cliente:r.cliente,origen:nombreOrigen(r.origenId),destino:nombreDestino(r.destinoId)}});
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
    if(r.estado!=='PENDIENTE_APROBACION')deny('La ruta requiere una tarifa definida antes de aprobarla.','ESTADO_INVALIDO');
    if(r.aprobacionComercial)deny('Gerencia Comercial ya aprobó esta ruta.','ESTADO_INVALIDO');
    r.aprobacionComercial={porId:A.id,por:A.nombre,en:nowIso()};auditAdd({entidad:'RUTA',accion:'Ruta aprobada por Gerencia Comercial',campo:'Aprobación',nuevo:A.nombre,por:A,ref:r.id});activarRutaSiLista(r,A);return r;
  });},
  aprobarRutaTransporte(uid,id){return exec(uid,'aprobarRutaTransporte',id,A=>{
    need(A,'rutas_aprobar_transporte','aprobar rutas por Transporte');const r=DB.rutas.find(x=>x.id===id);if(!r)deny('La ruta no existe.','NO_EXISTE');
    if(r.estado!=='PENDIENTE_APROBACION')deny('La ruta requiere una tarifa definida antes de aprobarla.','ESTADO_INVALIDO');
    if(r.aprobacionTransporte)deny('Gerencia de Transporte ya aprobó esta ruta.','ESTADO_INVALIDO');
    r.aprobacionTransporte={porId:A.id,por:A.nombre,en:nowIso()};auditAdd({entidad:'RUTA',accion:'Ruta aprobada por Gerencia de Transporte',campo:'Aprobación',nuevo:A.nombre,por:A,ref:r.id});activarRutaSiLista(r,A);return r;
  });},

  /* ----- notificaciones (solo dentro de la aplicación) ----- */
  notificaciones(uid){
    const A=actor(uid);
    return DB.notificaciones.filter(n=>A.rol==='ADMIN'||n.destinatarios.includes(A.rol)||(n.usuarios||[]).includes(A.id)).map(n=>Object.assign({},n,{leida:n.leidaPor.includes(A.id)})).reverse();
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
    refrescarOrigenes();
    auditAdd({entidad:'CATALOGO',accion:'Lista del sistema actualizada',campo:LISTAS_ETIQUETA[k]||k,anterior:antes,nuevo:limpio.join(' · '),por:A,ref:k});
    return {clave:k,valores:limpio};
  });},

  /* ----- administración ----- */
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
    const proy=(d.proyectos||[]).filter(p=>CAT.proyectos.includes(p));if(!proy.length)deny('Asigna al menos un proyecto del catálogo.','VALIDACION');
    const nit=String(d.nit||'').trim().toUpperCase();if(nit&&!/^[A-Z0-9][A-Z0-9\-\/\.]{3,19}$/.test(nit))deny('Identificador fiscal no válido (4 a 20 caracteres).','VALIDACION');
    const correo=String(d.correoFacturacion||'').trim();if(correo&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correo))deny('Correo de facturación no válido.','VALIDACION');
    const tel=String(d.telefono||'').trim();if(tel.length>20)deny('Teléfono: máximo 20 caracteres.','VALIDACION');
    const cred=String(d.creditoDias==null?'':d.creditoDias).trim();if(cred!==''&&!/^\d{1,3}$/.test(cred))deny('Días de crédito: número entero de 0 a 999.','VALIDACION');
    const dir=String(d.direccionFiscal||'').trim(),con=String(d.contacto||'').trim(),obs=String(d.observaciones||'').trim();
    if(dir.length>120||con.length>60||obs.length>200)deny('Algún texto excede el máximo permitido.','VALIDACION');
    const norm=s=>String(s).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/\s+/g,' ').trim();
    const otros=DB.clientes.filter(c=>c.id!==id);
    if(!editando&&DB.clientes.some(c=>c.id===id))deny(`Ya existe un cliente con el código ${id}.`,'DUPLICADO');
    if(otros.some(c=>norm(c.nombre)===norm(nombre)))deny(`Ya existe un cliente con el nombre "${nombre}".`,'DUPLICADO');
    if(otros.some(c=>c.cliente===cl))deny(`El cliente "${cl}" del catálogo ya está registrado.`,'DUPLICADO');
    if(nit&&otros.some(c=>c.nit&&c.nit===nit))deny(`El identificador fiscal ${nit} ya está registrado en otro cliente.`,'DUPLICADO');
    const datos={nombre,cliente:cl,proyectos:proy,nit,direccionFiscal:dir,correoFacturacion:correo,contacto:con,telefono:tel,creditoDias:cred,observaciones:obs,activo:d.activo!==false};
    const c=DB.clientes.find(x=>x.id===id);
    if(editando){
      if(!c)deny('Cliente no encontrado.','NO_EXISTE');
      const etq={nombre:'Nombre',cliente:'Cliente (catálogo)',nit:'Identificador fiscal',direccionFiscal:'Dirección fiscal',correoFacturacion:'Correo de facturación',contacto:'Contacto',telefono:'Teléfono',creditoDias:'Días de crédito',observaciones:'Observaciones'};
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
};

/* =====================================================================
   SIEMBRA: datos de demostración creados con la propia API (mismas reglas)
   ===================================================================== */

return {API,ApiError,ROLES,PERMS,PERM_KEYS,PERM_DEFAULT,PROHIBIDO,ENV,CAT,PILOTOS,FLOTA,DESTINOS,ORIGENES,hasPerm,blankDB,syncRefs,
  getDB:()=>DB, setDB:d=>{DB=d;syncRefs();}};
}
