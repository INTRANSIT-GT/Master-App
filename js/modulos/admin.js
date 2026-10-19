/* =====================================================================
   MÓDULO: ADMINISTRACIÓN · usuarios, auditoría y modelo
   Usuarios, permisos, auditoría, catálogos y modelo de datos.
   ===================================================================== */

/* Columna «Clientes» del listado: los primeros 3 y, si hay más, un contador (+N) con el detalle al pasar el ratón. */
function cliCelda(u){
  /* Los perfiles de visibilidad total (administración, gerencias, facturación) no se limitan a clientes puntuales:
     mostrar «todos» es la información útil. Para el resto se listan los NOMBRES de sus clientes. */
  if(u.rol==='ADMIN'||hasPerm(u,'viajes_ver_todos'))return '<span class="mute">todos los clientes</span>';
  const ids=clientesAsig(u);
  const nom=id=>{const c=DB.clientes.find(x=>x.id===id);return c?(c.cliente||c.nombre||id):id;};
  const nomC=ids.map(nom);
  if(!nomC.length)return u.rol==='OPERATIVO'?'<span class="mute">ninguno</span>':'<span class="mute">todos / no aplica</span>';
  const v=nomC.slice(0,3).map(esc).join(', ');
  return nomC.length>3?v+' <span class="mute" title="'+esc(nomC.join(', '))+'">+'+String(nomC.length-3)+'</span>':v;
}
/* ---- Usuarios y permisos ---- */
VIEWS.usuarios=()=>{
  const grupos=[...new Set(PERMS.map(p=>p[2]))],roles=Object.keys(ROLES),canP=hp('permisos_gestionar');
  const pg=paginar('usr',DB.usuarios);
  return `<div class="inner" style="max-width:1300px">${pageHead('Usuarios y permisos','Cada acción se valida contra esta matriz y contra las reglas fijas de separación de funciones',hp('usuarios_gestionar')?`<button class="btn primary" data-act="usuarioOpen" data-id="">${icon('plus',18)} Nuevo usuario</button>`:'')}
    <div class="tablewrap scrollx"><table class="resp"><thead><tr><th>ID</th><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Clientes asignados</th><th>Estado</th><th></th></tr></thead><tbody>
    ${pg.filas.map(u=>`<tr><td data-l="ID"><code>${u.id}</code></td><td data-l="Nombre"><b>${esc(u.nombre)}</b></td><td data-l="Usuario"><code>${esc(u.usuario)}</code></td><td data-l="Rol">${esc(rolL(u.rol))}</td><td data-l="Clientes">${cliCelda(u)}</td><td data-l="Estado">${u.activo?'<span class="badge st-COMERCIAL_REGISTRADA">Activo</span>':'<span class="badge st-PENDIENTE">Inactivo</span>'}</td><td data-l="">${hp('usuarios_gestionar')?`<button class="btn sm" data-act="usuarioOpen" data-id="${u.id}">Editar</button> <button class="btn sm ${u.activo?'ghost':'ok'}" data-act="usuarioActivoAsk" data-id="${u.id}">${u.activo?'Desactivar':'Activar'}</button>`:''}</td></tr>`).join('')}</tbody></table></div>${paginador('usr',pg)}
    <section class="section"><h2>Matriz de permisos por rol</h2><div class="mute" style="margin:-6px 0 10px;font-size:13px">${icon('lock',14)} = permiso que ese rol nunca puede tener (separación de funciones). Cada cambio queda en la auditoría.</div>
    <div class="tablewrap scrollx"><table class="pm"><thead><tr><th>Permiso</th>${roles.map(r=>`<th>${esc(ROLES[r].label)}</th>`).join('')}</tr></thead><tbody>
    ${grupos.map(g=>`<tr class="grp"><td colspan="${roles.length+1}">${g}</td></tr>${PERMS.filter(p=>p[2]===g).map(p=>`<tr><td>${p[1]}<br><code class="mute">${p[0]}</code></td>${roles.map(r=>{const proh=(PROHIBIDO[r]||[]).includes(p[0]),sie=(SIEMPRE[r]||[]).includes(p[0]),on=hasPerm({activo:true,rol:r},p[0]);return `<td>${proh?`<span class="mute" title="No permitido para este rol">${icon('lock',14)}</span>`:`<input type="checkbox" data-perm="${r}|${p[0]}" ${on?'checked':''} ${!canP||sie?'disabled':''} aria-label="${esc(p[1])} · ${esc(ROLES[r].label)}">`}</td>`;}).join('')}</tr>`).join('')}`).join('')}
    </tbody></table></div></section></div>`;
};

/* ---- Auditoría ---- */
function audList(){
  const q=S.q.trim().toLowerCase();let ev=[];try{ev=API.auditoria(S.user.id);}catch(e){}
  return ev.filter(e=>(!S.aEnt||e.entidad===S.aEnt)&&(!S.aRech||e.entidad==='SEGURIDAD')&&(!q||(e.viajeId+' '+e.accion+' '+e.campo+' '+e.por+' '+e.motivo+' '+e.ref+' '+e.anterior+' '+e.nuevo).toLowerCase().includes(q))).slice().reverse();
}
BODY.auditoria=()=>{
  const ev=audList(),pg=paginar('aud',ev);
  return `<div class="mute" style="margin-bottom:8px">${ev.length} eventos</div>
  <div class="xlwrap"><table class="xl" style="min-width:1000px"><thead><tr><th>Fecha y hora</th><th>Evento</th><th>Viaje</th><th>Entidad</th><th>Acción</th><th>Campo</th><th>Valor anterior</th><th>Valor nuevo</th><th>Usuario</th><th>Motivo / ref.</th></tr></thead><tbody>
  ${pg.filas.map(e=>`<tr class="${e.entidad==='SEGURIDAD'?'dim':''}"><td>${fmtDT(e.en)}</td><td><code>${e.id}</code></td><td>${e.viajeId?`<button class="linkbtn" data-act="detalle" data-id="${e.viajeId}">#${e.viajeId}</button>`:'—'}</td><td>${e.entidad}</td><td style="white-space:normal;min-width:170px">${esc(e.accion)}</td><td>${esc(e.campo)}</td><td style="white-space:normal;max-width:200px">${esc(e.anterior)}</td><td style="white-space:normal;max-width:200px">${esc(e.nuevo)}</td><td>${esc(e.por)}<br><span class="mute">${esc(rolL(e.rol))}</span></td><td style="white-space:normal;min-width:180px">${esc(e.motivo)}${e.ref?`<br><span class="mute">${esc(e.ref)}</span>`:''}</td></tr>`).join('')}
  </tbody></table></div>${paginador('aud',pg)}`;
};
VIEWS.auditoria=()=>{
  const v=S.verif;
  return `<div class="inner" style="max-width:1400px">${pageHead('Auditoría','Bitácora de solo agregar: cada evento guarda valor anterior, valor nuevo, usuario, fecha y motivo',`<button class="btn primary" data-act="verificarAud">${icon('shield',18)} Verificar integridad</button>`)}
    ${v?`<div class="alertbox ${v.ok?'okb':''}" style="margin-bottom:14px"><b>${v.ok?'Integridad correcta':'Se detectó una alteración'}</b> · ${v.ok?`${v.total} eventos encadenados sin cambios.`:`El evento ${v.id} (posición ${v.indice+1}) no coincide con su huella. Alguien modificó el historial.`}</div>`:''}
    <div class="row2" style="margin-bottom:10px;grid-template-columns:1.6fr 1fr auto"><input type="text" id="q" placeholder="Buscar por viaje, usuario, acción, motivo…" value="${esc(S.q)}" aria-label="Buscar"><select data-flt="aEnt" aria-label="Entidad"><option value="">Todas las entidades</option>${['VIAJE','AGRUPACION','PERMISO','USUARIO','CLIENTE','SESION','SEGURIDAD'].map(e=>`<option ${S.aEnt===e?'selected':''}>${e}</option>`).join('')}</select><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" data-fltchk="aRech" ${S.aRech?'checked':''}> Solo rechazos y errores</label></div>
    <div id="vb">${BODY.auditoria()}</div></div>`;
};

/* ---- Modelo de datos ---- */
VIEWS.modelo=()=>{
  const T=[
    ['USUARIOS','Identidad estable',[['IdUsuario','Texto (clave) U-001','Estable; se usa en la auditoría'],['Usuario · NombreCompleto','Texto',''],['Rol','Opción','ADMIN · OPERATIVO · TORRE · VALIDADOR · FACTURACION · GERENTE_TRANSPORTE'],['Activo','Sí/No','Sustituir por cuenta Microsoft']]],
    ['ACCESO_CLIENTE','Alcance de encargados',[['IdUsuario','Búsqueda → USUARIOS',''],['Cliente','Búsqueda → CLIENTES','Un encargado solo opera sus clientes']]],
    ['PERMISOS','Matriz rol × permiso',[['Rol','Opción',''],['Permiso','Opción','22 permisos'],['Habilitado','Sí/No','Cambios auditados']]],
    ['CLIENTES','Clientes y proyectos',[['IdCliente · Nombre · Cliente','Texto','Código y nombre únicos'],['Proyectos','Lista → CATALOGO','Proyectos permitidos'],['NIT · DireccionFiscal · CorreoFacturacion · Contacto · Telefono · CreditoDias','Texto','Vacío = PENDIENTE; no se inventa'],['Activo · TorreEstatus · CreadoPor/El','—','Torre avanza el estado de los clientes marcados']]],
    ['VIAJES (hoja VIAJES_TRANSPORTES)','Un registro por viaje, para siempre',[['ID VIAJE, CLIENTE, PROYECTO, SHIPMENT, NO. VIAJE, TIPO VIAJE, TIPO CARGA, NO. CARGA, PRODUCTO, OPL, PILOTO, ORIGEN, DESTINO, FECHA PLAN','Columnas reales',''],['Horarios (10) · NO. DOC RETORNO · Q_VIATICOS','Columnas reales',''],['PLACA · TANGO · TIPO UNIDAD','Desde FLOTA','No se copian'],['Estado','Opción','Planificado → En ruta → Entregado → Liquidado → Aceptado/Rechazado → Facturado → Cobrado; solo cambia por transiciones válidas'],['AgrupacionId · NumeroFactura','Búsqueda / Texto','Proyección de la agrupación activa'],['CreadoPor/El · Iniciado · Finalizado · Enviado · Revisado · Aprobado','Persona + fecha','Resumen; la fuente es AUDITORIA']]],
    ['LIQUIDACIONES','Un renglón por envío (ciclo)',[['IdLiquidacion LIQ-0001','Texto (clave)',''],['IdViaje · Ciclo','Búsqueda · Número',''],['EnvioPor/El · EvidenciaId','Persona/fecha · Búsqueda',''],['Decision · Revisor · RevisionEn · Comentario','Opción · Persona · fecha · texto','Nunca se sobrescribe un ciclo anterior']]],
    ['EVIDENCIAS','Fotografías',[['IdEvidencia EVI-0001','Texto (clave)',''],['IdViaje · IdLiquidacion','Búsquedas',''],['Imagen','Archivo adjunto','Una por envío; las anteriores se conservan']]],
    ['AGRUPACIONES_COMERCIALES','Agrupación ≠ factura',[['IdAgrupacion AGR-0001','Texto (clave)','Identifica el conjunto'],['Cliente','Búsqueda → CLIENTES','Un solo cliente por agrupación'],['IdViajes','Relación 1..n → VIAJES','Sin duplicados'],['NumeroFactura','Texto único','Identifica la factura; distinto del ID de agrupación'],['Estado · Anulada{por,en,motivo} · Correcciones[]','Opción · registro','Nunca se borra la asignación anterior']]],
    ['COBROS (dentro de agrupación)','Dinero recibido',[['IdCobro COB-0001','Texto (clave)',''],['IdAgrupacion · Monto · Fecha · Referencia','—','Referencia obligatoria; no puede exceder lo facturado']]],
    ['PAGOS','Pagos a proveedores y pilotos',[['IdPago PAG-0001','Texto (clave)',''],['Tipo · IdViaje · Beneficiario','PROVEEDOR / PILOTO','Proveedor (OPL) solo desde una orden de pago; piloto = piloto del viaje'],['Monto · Fecha · Referencia','—','No puede exceder el importe por pagar'],['Anulado{por,en,motivo}','registro','Los pagos no se borran']]],
    ['ÓRDENES DE PAGO (proveedor)','Emitida → Pagada',[['IdOrden OP-0001 · Proveedor (OPL) · Viajes[]','Texto · OPL · viajes','Un viaje Facturado al cliente, con tarifa de OPL, entra en una sola orden activa'],['Importe · ImportesViaje · FechaEmisión','Moneda · detalle','Total a pagar al proveedor (tarifa OPL + ajuste de combustible del proveedor)'],['Emisión{por,en,documento}','registro','Al emitir se genera el documento de la orden'],['Transferencia{fecha,monto,referencia,evidencia,factura}','registro','Cierra la orden: exige evidencia de la transferencia y factura del proveedor'],['Estado · Anulada{por,en,motivo}','ACTIVA / ANULADA','No se anulan órdenes ya pagadas']]],
    ['RUTAS','Catálogo y solicitudes',[['IdRuta R-0001 · Codigo · Nombre','Texto','Código único entre rutas asignadas'],['Cliente · Proyecto','Búsquedas','Una ruta pertenece a un cliente y proyecto'],['IdOrigen · IdDestino','Búsquedas → ORIGEN / DESTINOS','Se completan SOLO al asignar la ruta'],['Estado','PENDIENTE · EN_TARIFACION · PENDIENTE_APROBACION · ACTIVA · RECHAZADA','Se activa con la aprobación de Gerencia Comercial y de Transporte'],['Solicitada por/el · Validada por/el · Rechazo','—','Trazabilidad']]],
    ['TARIFAS','Tarifas con vigencia',[['IdTarifa TAR-0001','Texto (clave)',''],['Cliente · Proyecto · IdRuta · Capacidad','Búsquedas','Combinación a la que aplica'],['Importe cliente · Importe OPL (proveedor)','Moneda','Lo que se cobra al cliente y lo que se paga al proveedor'],['% comb. cliente · Q diésel cliente · % comb. proveedor · Q diésel proveedor','—','Cada ajuste por combustible (MEM) con sus propios parámetros'],['VigenteDesde · VigenteHasta','Fechas','No se solapan dos tarifas activas iguales'],['Activa · CreadaPor/El · ModificadaPor/El','—','Se desactiva, no se borra; el viaje conserva su importe histórico']]],
    ['FACTURAS (AGRUPACIONES_COMERCIALES)','Preparada → Enviada → Emitida',[['IdAgrupacion · Modalidad','INDIVIDUAL / AGRUPADA','Agrupar es opcional'],['Fase','PREPARADA · ENVIADA · EMITIDA','Emitida exige evidencia'],['NumeroFactura · FechaFactura','Texto · fecha','Obligatorios para enviar'],['Envio{por,en,resultado} · Emision{por,fecha,importe,evidencia,archivo}','registros',''],['Cobros[] · Anulada · Correcciones[]','registros','']]],
    ['NOTIFICACIONES','Avisos dentro de la aplicación',[['IdNotificacion · Tipo · Asunto · Detalle','—','Ruta pendiente, asignada o rechazada'],['Destinatarios (roles) · Usuarios · LeidaPor','—','Comercial y Gerencia reciben las rutas pendientes'],['Externo{enviado:false,motivo}','—','Correo o Teams requieren un servicio configurado']]],
    ['AUDITORIA','Solo agregar',[['IdEvento · IdViaje · Entidad · Accion · Campo','Texto',''],['ValorAnterior · ValorNuevo','Texto',''],['IdUsuario · Rol · FechaHora · Motivo · Ref','—',''],['Prev · Hash','Texto','Cadena de huellas para detectar alteraciones']]]
  ];
  const E=[
    ['PLANIFICADO','Operaciones inicia el viaje','EN_RUTA'],
    ['EN_RUTA','Operaciones confirma la entrega','ENTREGADO'],
    ['ENTREGADO','Operaciones envía la evidencia (fotografía)','LIQUIDADO'],
    ['LIQUIDADO','Liquidaciones acepta o rechaza con comentario','ACEPTADO · o RECHAZADO'],
    ['RECHAZADO','Operaciones corrige y vuelve a liquidar','LIQUIDADO'],
    ['ACEPTADO','Comercial factura (individual o agrupada)','FACTURADO'],
    ['FACTURADO','Contabilidad registra el cobro','COBRADO']
  ];
  return `<div class="inner">${pageHead('Modelo de datos','Cómo se relaciona la información y cómo se mapea a SharePoint o Dataverse')}
    <div class="alertbox info" style="margin-bottom:16px"><b>Regla:</b> un único registro por viaje durante todo su ciclo de vida. Las tablas VIAJES, LIQUIDACIONES, EVIDENCIAS, AGRUPACIONES_COMERCIALES y AUDITORIA se relacionan por IdViaje; nada se borra, todo cambio es un evento nuevo.</div>
    <div class="grid g2">${T.map(t=>`<div class="card"><h3>${t[0]}</h3><div class="mute" style="margin:-8px 0 10px;font-size:13px">${t[1]}</div><div class="scrollx"><table style="font-size:13px"><thead><tr><th>Campo</th><th>Tipo sugerido</th><th>Nota</th></tr></thead><tbody>${t[2].map(r=>`<tr><td><code>${r[0]}</code></td><td>${r[1]}</td><td class="mute">${r[2]}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}</div>
    <section class="section"><h2>Flujo de estados</h2><div class="tablewrap scrollx"><table><thead><tr><th>Estado actual</th><th>Quién lo mueve</th><th>Siguiente</th></tr></thead><tbody>${E.map(r=>`<tr><td>${badge(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table></div>
    <div class="mute" style="margin-top:8px;font-size:13px">El viaje tiene un solo estado: <b>Estado</b> (Planificado → En ruta → Entregado → Liquidado → Aceptado/Rechazado → Facturado → Cobrado). Torre de Control avanza el estado de sus clientes autorizados; no edita fechas ni horas.</div></section></div>`;
};


/* ---- Acciones (handlers) de este módulo ---- */
Object.assign(ACT,{
  async memOpen(){
    let actual=[];try{actual=API.mem(S.user.id);}catch(e){}
    formM({title:'Tabla MEM · precio del diésel',text:'Pega los renglones <b>fecha</b> y <b>precio</b> (separados por tabulación, coma o punto y coma), uno por línea. Ejemplo: <code>2026-10-01,34.50</code>.<br><b>Cargar reemplaza toda la tabla.</b> El ajuste por combustible usa el precio de la fecha plan del viaje (o el más reciente anterior).',
      fields:[{k:'filas',label:'Renglones (fecha, precio del diésel)',type:'textarea',req:1}],
      data:{filas:actual.map(r=>`${r.fecha}\t${r.precioDiesel}`).join('\n')},ok:'CARGAR MEM',act:'memSave'});
  },
  async memSave(){
    const raw=String(S.modal.data.filas||'');
    const filas=raw.split(/\r?\n/).map(l=>{const m=l.split(/[\t,;]+|\s{2,}/).map(x=>x.trim()).filter(Boolean);return {fecha:m[0]||'',precioDiesel:m[1]||''};}).filter(x=>x.fecha);
    const r=await run(()=>API.cargarMem(S.user.id,filas),x=>`Tabla MEM cargada: ${x.renglones} renglones.`,true);
    if(r.ok)afterWrite();
  },
  async fleLoad(){
    S.fle={cargando:true,mant:[],gast:[],err:''};render();
    try{const mant=(await API.mantenimientos(S.user.id,{limite:1000}))||[];const gast=(await API.gastos(S.user.id,{limite:1000}))||[];S.fle={cargando:false,mant,gast,err:''};}
    catch(e){S.fle={cargando:false,mant:[],gast:[],err:e.message||'No se pudo consultar la flota.'};}
    render();
  },
  async fleSync(){
    const r=await run(()=>BACKEND.sincronizarFlota(),x=>`Fleetio: ${x.unidades} unidades, ${x.mantenimientos} mantenimientos, ${x.gastos} gastos sincronizados.`);
    if(r.ok)ACT.fleLoad();
  },
  async usuarioOpen(d){
    const u=d.id?DB.usuarios.find(x=>x.id===d.id):null;
    formM({title:u?`Editar usuario ${u.id}`:'Nuevo usuario',text:'Contraseña de demostración: se guarda en el navegador y no es segura para producción.',
      fields:[{k:'nombre',label:'Nombre completo',req:1},{k:'usuario',label:'Usuario (nombre corto)',req:1},{k:'email',label:BACKEND.modo==='supabase'?'Correo con el que ingresa':'Correo (opcional)',type:'email',req:BACKEND.modo==='supabase'&&!u,ro:BACKEND.modo==='supabase'&&!!u},{k:'clave',label:u?(BACKEND.modo==='supabase'?'Contraseña (se reasigna en Supabase → Authentication)':'Nueva contraseña (opcional)'):(BACKEND.modo==='supabase'?'Contraseña inicial (mínimo 8 caracteres)':'Contraseña'),type:'password',req:!u,ro:BACKEND.modo==='supabase'&&!!u},
        {k:'rol',label:'Rol',type:'select',req:1,opts:(()=>{const ks=Object.keys(ROLES);if(u&&u.rol&&!ROLES[u.rol])ks.push(u.rol);return ks.map(r=>({id:r,nombre:rolL(r)}));})()},
        {k:'clientes',label:'Clientes asignados',type:'mover',opts:DB.clientes.map(c=>({id:c.id,nombre:c.nombre})),hint:'Sin clientes asignados, el usuario no ve ningún viaje. Usa los botones del centro para moverlos.'},
        {k:'proyectos',label:'Proyectos asignados',type:'mover',optsFn:x=>{const set=new Set();(x.clientes||[]).forEach(c=>(PROYECTOS_X[c]||[]).forEach(p=>set.add(p)));const list=set.size?[...set]:CAT.proyectos;return list.map(p=>({id:p,nombre:p}));},hint:'Si dejas la lista de asignados vacía, verá todos los proyectos de sus clientes.'},
        {k:'activo',label:'Usuario activo',type:'check'}],
      data:u?{nombre:u.nombre,usuario:u.usuario,email:u.email||'',clave:'',rol:u.rol,clientes:clientesAsig(u).slice(),proyectos:(u.proyectos||[]).slice(),activo:u.activo}:{nombre:'',usuario:'',email:'',clave:'',rol:'OPERATIVO',clientes:[],proyectos:[],activo:true},
      rerender:['clientes'],ancho:'760px',ok:'GUARDAR',act:'usuarioSave',id:d.id});
  },
  async usuarioSave(d){const m=S.modal.data;const r=await run(()=>API.guardarUsuario(S.user.id,{id:d.id||'',nombre:m.nombre,usuario:m.usuario,email:m.email,clave:m.clave,rol:m.rol,clientes:m.clientes,proyectos:m.proyectos,activo:m.activo}),'Usuario guardado.',true);if(r.ok)afterWrite();},
  async verificarAud(){try{S.verif=await API.verificarAuditoria(S.user.id);}catch(e){toast(e.message,'err');}render();},
  /* Activar o desactivar un perfil: desactivado no puede entrar ni recibe avisos. */
  async usuarioActivoAsk(d){
    const u=DB.usuarios.find(x=>x.id===d.id);if(!u)return;
    confirmM(u.activo?'¿Desactivar el perfil?':'¿Activar el perfil?',
      u.activo?`<b>${esc(u.nombre)}</b> (${esc(rolL(u.rol))}) no podrá iniciar sesión ni recibir avisos hasta que lo vuelvas a activar. Sus viajes y su historial se conservan.`
             :`<b>${esc(u.nombre)}</b> (${esc(rolL(u.rol))}) podrá volver a iniciar sesión con su correo y su contraseña actuales.`,
      u.activo?'DESACTIVAR':'ACTIVAR','usuarioActivoOk',u.id,u.activo?'fix':'ok');
  },
  async usuarioActivoOk(d){
    const u=DB.usuarios.find(x=>x.id===d.id);if(!u)return;
    const r=await run(()=>API.activarUsuario(S.user.id,u.id,!u.activo),u.activo?'Perfil desactivado: ya no puede entrar.':'Perfil activado.',true);
    if(r.ok)afterWrite();
  },
  /* reasignar la contraseña de acceso de un usuario (Supabase Auth) */
  async claveOpen(d){
    const u=DB.usuarios.find(x=>x.id===d.id);if(!u)return;
    formM({title:'Reasignar contraseña · '+u.usuario,
      text:`Se cambiará la contraseña de acceso de <b>${esc(u.nombre)}</b> (${esc(u.email||'sin correo')}). Entra en vigor de inmediato: avísale al usuario.`,
      fields:[{k:'clave',label:'Nueva contraseña (mínimo 8 caracteres)',type:'password',req:1},
              {k:'clave2',label:'Repite la nueva contraseña',type:'password',req:1}],
      data:{clave:'',clave2:''},ok:'REASIGNAR CONTRASEÑA',act:'claveSave',id:u.id});
  },
  async claveSave(d){
    const m=(S.modal&&S.modal.data)||{};
    if(String(m.clave||'').length<8){S.modal.err='La contraseña debe tener al menos 8 caracteres.';render();return;}
    if(m.clave!==m.clave2){S.modal.err='Las dos contraseñas no coinciden: escríbelas iguales.';render();return;}
    const r=await run(()=>API.cambiarClave(S.user.id,d.id,m.clave),'Contraseña reasignada. Entra en vigor de inmediato.',true);
    if(r.ok)afterWrite();
  }
});
