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
