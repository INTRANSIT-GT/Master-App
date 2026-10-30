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
