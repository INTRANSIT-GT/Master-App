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
    const keys=[...DATA_KEYS,...TIEMPO_KEYS,...DVKEYS,'rutaRef','sinRuta','desvio','desvioDestino','rutaKm'];
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
    keys.forEach(k=>{if(k==='rutaId'||k==='rutaRef'||k==='sinRuta'||k==='desvio'||k==='desvioDestino'||k==='rutaKm'||v[k]===''||v[k]==null)return;const m=valKey(cliente,k,v[k]);if(m)deny(m,'VALIDACION');});
    let ruta=null,pend=v.rutaId==='NO_ASIGNADA',kmPend=null;
    if(sinRuta){if(!v.proyectoCat||!proyectosDe(cliente).includes(v.proyectoCat))deny('Para registrar un viaje SIN RUTA selecciona el proyecto.','VALIDACION');}
    else if(pend){need(A,'rutas_solicitar','solicitar rutas nuevas');if(!v.proyectoCat||!proyectosDe(cliente).includes(v.proyectoCat))deny('Para solicitar una ruta nueva selecciona el proyecto.','VALIDACION');if(String(v.rutaRef||'').length<3)deny('Para una ruta no activa escribe la referencia (qué ruta se necesita): se envía a validación.','VALIDACION');if(v.rutaRef.length>80)deny('La referencia de la ruta admite máximo 80 caracteres.','VALIDACION');kmPend=kmRuta(v.rutaKm);}
    else {ruta=DB.rutas.find(r=>r.id===v.rutaId);if(!ruta||ruta.cliente!==cliente)deny('La ruta no corresponde al cliente elegido.','VALIDACION');v.proyectoCat=ruta.proyecto;}
    delete v.rutaKm;
    const clave=pend?'ref:'+v.rutaRef.toLowerCase():v.rutaId;
    const dup=v.fechaPlan&&v.pilotoId&&DB.trips.find(t=>t.fechaPlan===v.fechaPlan&&t.pilotoId===v.pilotoId&&((pend&&t.rutaRef&&('ref:'+t.rutaRef.toLowerCase())===clave)||(!pend&&t.rutaId===clave)));
    if(dup)deny(`Este viaje ya existe (#${dup.id}): misma fecha y hora plan, piloto y ruta.`,'DUPLICADO');
    const gAd=normGastos(v.gastosAdicionales);if(gAd.err)deny(gAd.err,'VALIDACION');
    if(gAd.length)v.gastosAdicionales=gAd;else delete v.gastosAdicionales;
    const id=String(DB.seq.trip++).padStart(6,'0');
    let rutaId=v.rutaId;
    if(pend){const rr=crearRutaPendiente(A,{cliente,proyecto:v.proyectoCat,nombre:v.rutaRef,capacidad:'',km:kmPend,fuente:'VIAJE',viajeRef:id});rutaId=rr.id;}
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
