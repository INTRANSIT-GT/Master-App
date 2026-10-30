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
    return crearRutaPendiente(A,{cliente,proyecto:proy,nombre,origenProp:op,destinoProp:dp,fuente:'SOLICITUD'});
  });},
  registrarRuta(uid,d){return exec(uid,'registrarRuta','',A=>{
    need(A,'rutas_gestionar','registrar rutas en el catálogo');
    const v=validarRutaDatos(d);
    const r={id:'R-'+pad4(DB.seq.rut++),codigo:v.codigo,nombre:v.nombre,cliente:v.cliente,proyecto:v.proyecto,origen:v.origen,destino:v.destino,estado:'EN_TARIFACION',origenProp:'',destinoProp:'',fuente:'CATALOGO',solicitadaPorId:A.id,solicitadaPor:A.nombre,solicitadaEn:nowIso(),validadaPor:A.nombre,validadaEn:nowIso(),aprobacionComercial:null,aprobacionTransporte:null,rechazo:null,viajeRef:''};
    DB.rutas.push(r);
    auditAdd({entidad:'RUTA',accion:'Ruta registrada para tarifación',campo:'Ruta',nuevo:`${r.codigo} · ${nombreOrigen(r.origen)} → ${nombreDestino(r.destino)}`,por:A,ref:r.id});
    return r;
  });},
  validarRuta(uid,id,d){return exec(uid,'validarRuta','',A=>{
    need(A,'rutas_validar','validar o asignar rutas');
    const r=DB.rutas.find(x=>x.id===id);if(!r)deny('La ruta no existe.','NO_EXISTE');
    if(r.estado!=='PENDIENTE')deny('Solo se validan rutas pendientes.','ESTADO_INVALIDO');
    const v=validarRutaDatos({codigo:d&&d.codigo,nombre:r.nombre,cliente:r.cliente,proyecto:r.proyecto,origen:d&&d.origen,destino:d&&d.destino});
    r.codigo=v.codigo;r.origen=v.origen;r.destino=v.destino;r.estado='EN_TARIFACION';r.validadaPor=A.nombre;r.validadaEn=nowIso();
    auditAdd({entidad:'RUTA',accion:'Ruta validada',campo:'Estado',anterior:'Pendiente',nuevo:'En tarifación',por:A,ref:`${r.id} · ${r.codigo} · ${nombreOrigen(r.origen)} → ${nombreDestino(r.destino)}`});
    DB.trips.filter(t=>t.rutaId===r.id).forEach(t=>{
      const ao=t.origen,ad=t.destino;t.origen=r.origen;t.destino=r.destino;
      auditAdd({entidad:'RUTA',viajeId:t.id,accion:'Ruta asignada: origen y destino completados',campo:'Origen',anterior:ao?nombreOrigen(ao):'(pendiente)',nuevo:nombreOrigen(r.origen),por:A,ref:r.id});
      auditAdd({entidad:'RUTA',viajeId:t.id,accion:'Ruta asignada: origen y destino completados',campo:'Destino',anterior:ad?nombreDestino(ad):'(pendiente)',nuevo:nombreDestino(r.destino),por:A,ref:r.id});
    });
    notificar(A,{tipo:'RUTA_TARIFACION',destinatarios:['GERENTE_COMERCIAL'],asunto:`Ruta lista para definir tarifa: ${r.codigo}`,detalle:{ruta:r.nombre,codigo:r.codigo,proyecto:r.proyecto,cliente:r.cliente,origen:nombreOrigen(r.origen),destino:nombreDestino(r.destino)}});
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
