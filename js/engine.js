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
/*#BROWSER*/
const LS='intransit_cv_proto_v5',LSP='intransit_cv_pref_v1';
let STORAGE_OK=true,LAST=null,SIN_DEMO=false;
function loadAll(){
  DB=null;
  try{localStorage.setItem('__probe','1');localStorage.removeItem('__probe');STORAGE_OK=true;}catch(e){STORAGE_OK=false;}
  try{const raw=localStorage.getItem(LS);const o=JSON.parse(raw||'null');if(o&&Array.isArray(o.trips)&&(o.v===DB_VERSION||o.v===5||o.v===6||o.v===7)){DB=o;LAST=raw;if(o.v===5)migrar5a6(DB);if(DB.v===6)migrar6a7(DB);if(DB.v===7)migrar7a8(DB);ocGuardar();save();}}catch(e){}
  if(!DB){if(typeof seedDB==='function')seedDB();else{DB=blankDB();SIN_DEMO=true;}}
  try{const p=JSON.parse(localStorage.getItem(LSP)||'null');if(p)PREF=Object.assign(PREF,p);}catch(e){}
  syncRefs();
}
/* v5 -> v6: IMPLAN y Encargado de proyecto son el mismo perfil. No se borra ningún usuario ni registro histórico. */
function migrar5a6(db){
  let n=0;
  db.usuarios.forEach(u=>{if(u.rol==='IMPLAN'){u.rol='ENCARGADO';n++;}});
  db.permisos=db.permisos.filter(p=>p.rol!=='IMPLAN');
  db.v=6;
  const adm=db.usuarios.find(u=>u.rol==='ADMIN');
  if(adm){DB=db;auditAdd({entidad:'USUARIO',accion:'Perfiles unificados: IMPLAN pasa a Encargado de proyecto',campo:'Rol',anterior:'IMPLAN',nuevo:'ENCARGADO',por:adm,ref:n+' usuario(s) migrado(s)'});}
}
function migrar7a8(db){
  const map = {
    'ENCARGADO': 'OPERATIVO',
    'LIQUIDACIONES': 'VALIDADOR',
    'COMERCIAL': 'FACTURACION',
    'CONTABILIDAD': 'FACTURACION',
    'GERENCIA_TRANSPORTE': 'GERENTE_TRANSPORTE',
    'GERENCIA_COMERCIAL': 'GERENTE_COMERCIAL'
  };
  db.usuarios.forEach(u => {
    if(map[u.rol]) u.rol = map[u.rol];
  });
  db.v = 8;
}
function migrar6a7(db){
  const estados={PENDIENTE:'PLANIFICADO',EN_CURSO:'EN_RUTA',FINALIZADO:'ENTREGADO',PENDIENTE_LIQUIDACION:'ENTREGADO',EN_REVISION:'LIQUIDADO',PENDIENTE_CORRECCION:'RECHAZADO',APROBADA:'ACEPTADO',PENDIENTE_COMERCIAL:'ACEPTADO',COMERCIAL_REGISTRADA:'FACTURADO'};
  db.trips.forEach(t=>{t.estado=estados[t.estado]||t.estado;t.rechazos=t.rechazos||0;t.placaArrastre=t.placaArrastre||'';});
  db.usuarios.forEach(u=>{if(u.rol==='GERENCIA')u.rol='GERENCIA_TRANSPORTE';});
  db.v=7;
}
/* Devuelve false si la fuente de datos rechazó la escritura. Si el navegador no ofrece almacenamiento (STORAGE_OK=false) trabaja solo en memoria. */
function save(){
  if(!STORAGE_OK)return true;
  try{const t=JSON.stringify(DB);localStorage.setItem(LS,t);LAST=t;return true;}catch(e){return false;}
}
/* Si no se pudo persistir, se vuelve al último estado guardado: nunca queda un cambio a medias. */
function rollback(){
  if(!LAST)return;
  DB=JSON.parse(LAST);syncRefs();
  if(typeof S!=='undefined'&&S.user)S.user=DB.usuarios.find(u=>u.id===S.user.id)||null;
}
function savePref(){try{localStorage.setItem(LSP,JSON.stringify(PREF));}catch(e){}}
/*#END*/

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
/* La capacidad depende del equipo: si hay arrastre con capacidad registrada, manda el arrastre;
   si no, la unidad. Un cabezal sin arrastre no tiene capacidad propia. */
const esEquipoArrastre=f=>!!f&&(/^RAS/i.test(String(f.tipo||''))||/^TC/i.test(String(f.placa||''))||/^TC/i.test(String(f.unidad||'')));
function capacidadEquipo(unidadId,placaArrastre){
  const arrTxt=String(placaArrastre==null?'':placaArrastre).trim();
  const U=FLOTA.find(f=>f.unidad===unidadId||f.placa===unidadId)||null;
  if(arrTxt){
    const match=FLOTA.filter(f=>String(f.placa||'').trim()===arrTxt||String(f.unidad||'').trim()===arrTxt);
    const A=match.find(esEquipoArrastre)||match[0]||null;
    if(A&&A.capacidad)return {capacidad:A.capacidad,fuente:'ARRASTRE',equipo:A.placa||A.unidad||arrTxt};
    if(U&&!esEquipoArrastre(U)&&!/^cabezal$/i.test(String(U.tipo||'')))return {capacidad:U.capacidad||'',fuente:'UNIDAD',equipo:U.placa||U.unidad||''};
    return {capacidad:'',fuente:'SIN_DATO',equipo:arrTxt};
  }
  if(U&&/^cabezal$/i.test(String(U.tipo||'')))return {capacidad:'',fuente:'SIN_DATO',equipo:U.placa||U.unidad||''};
  return {capacidad:U?U.capacidad||'':'',fuente:U?'UNIDAD':'SIN_DATO',equipo:U?U.placa||U.unidad||'':''};
}
const capDe=t=>capacidadEquipo(t.unidadId,t.placaArrastre).capacidad;
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
  if(!c)deny('Selecciona la capacidad de la unidad o del equipo de arrastre.','VALIDACION');
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
