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
