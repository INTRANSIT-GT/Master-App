/* =====================================================================
   MÓDULO: COMERCIAL · clientes, tarifas y facturación
   Clientes, tarifario del cliente y facturación.
   ===================================================================== */

/* ---- Facturación · desplegable «Detalle de viajes» ---- */
function viajeComboFact(){
  const opts=[{id:'',nombre:'Detalle de viajes: todos'}].concat(vis().slice().sort((a,b)=>String(b.id).localeCompare(String(a.id))).map(t=>{const r=DB.rutas.find(x=>x.id===t.rutaId);return {id:t.id,nombre:`#${t.id} · ${cliNombre(t.proyecto)} · ${t.proyectoCat||''} · ${fmtDate(planD(t))}${r?' · '+rutaEtiqueta(r):''}`};}));
  return `<div>${comboHTML('fcViaje',S.fcViaje||'',opts,'Detalle de viajes: todos')}</div>`;
}
function viajeDetalleFact(){
  const id=S.fcViaje;if(!id)return '';
  const t=vis().find(x=>x.id===id);
  if(!t)return `<div class="alertbox info" style="margin:10px 0">El viaje seleccionado ya no está disponible. <button class="linkbtn" data-act="fcQuitarViaje">Quitar selección</button></div>`;
  const g=DB.agrupaciones.find(a=>a.estado==='ACTIVA'&&a.viajeIds.includes(t.id))||DB.agrupaciones.find(a=>a.viajeIds.includes(t.id)),P=PILOTOS.find(p=>p.id===t.pilotoId)||{},U=FLOTA.find(x=>x.unidad===t.unidadId)||{},R=DB.rutas.find(x=>x.id===t.rutaId);
  const imp=g&&g.importesViaje&&g.importesViaje[t.id]!=null?g.importesViaje[t.id]:null,tar=nn(t.tarifaCliente);
  return `<div class="card" style="margin:10px 0" id="detalleViajeFact"><div class="exportbar"><h3 style="margin:0">Detalle del viaje #${esc(t.id)}</h3><div class="exportbtns"><button class="btn sm" data-act="detalle" data-id="${esc(t.id)}">Abrir ficha completa</button><button class="btn sm" data-act="fcQuitarViaje">Quitar selección</button></div></div>
    <dl class="kv" style="grid-template-columns:repeat(3,minmax(0,150px) minmax(0,1fr));gap:8px 14px">${kvr('Cliente',esc(cliNombre(t.proyecto)))}${kvr('Proyecto',vacioTxt(t.proyectoCat))}${kvr('Fecha plan',esc(fmtDate(planD(t)))+' '+esc(planT(t)))}
      ${kvr('Ruta',R?esc(rutaEtiqueta(R)):'<span class="mute">—</span>')}${kvr('Origen',t.origen?esc(nombreOrigen(t.origen)):'<span class="mute">—</span>')}${kvr('Destino',t.destino?esc(nombreDestino(t.destino)):'<span class="mute">—</span>')}
      ${kvr('Piloto',P.nombre?esc(P.nombre):'<span class="mute">—</span>')}${kvr('Placa · unidad',U.placa?esc(U.placa)+' · '+esc(U.unidad):'<span class="mute">—</span>')}${kvr('Estado',badge(t.estado))}
      ${kvr('Tarifa del cliente',tar==null?'<span class="mute">sin registrar</span>':qfmt(tar))}${kvr('Factura',g&&g.numeroFactura?esc(g.numeroFactura):'<span class="mute">sin factura</span>')}${kvr('Estado de facturación',g?etapaBadge(etapaAgr(g)):'<span class="mute">Aún no se envió a facturar</span>')}
      ${kvr('Grupo de viajes',g&&g.modalidad==='AGRUPADA'?esc(g.id):'<span class="mute">—</span>')}${kvr('Enviado a facturar',g&&g.envio?esc(fmtDT(g.envio.en)):'<span class="mute">—</span>')}${kvr('Importe enviado',imp==null?'<span class="mute">—</span>':qfmt(imp))}</dl>
    ${g?'':'<div class="mute" style="margin-top:8px;font-size:13px">Este viaje todavía no se ha enviado a facturar, por eso no aparece en la tabla de abajo.</div>'}</div>`;
}
/* ---- Comercial ---- */
const COMTABS=[{k:'bandeja',l:'Pendientes de gestión'},{k:'fact',l:'Facturas'},{k:'hist',l:'Facturación'},{k:'reg',l:'Registros anteriores'}];
const comTrips=()=>vis().filter(t=>['ACEPTADO','FACTURADO','COBRADO'].includes(t.estado));
/* Un viaje reservado por una OC no se puede meter en una agrupación: se factura desde la OC. */
const ocReservaDe=t=>(DB.ordenesCompra||[]).find(o=>['PREPARADA','ENVIADA','ACEPTADA','RECHAZADA'].includes(o.estado)&&(o.lineas||[]).some(l=>l.viajeId===t.id))||null;
const qfmt=v=>v===''||v==null?'—':'Q '+Number(v).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});
const sinReg='<span class="mute">Sin registrar</span>';
function agrMap(){let a=[];try{a=API.agrupaciones(S.user.id);}catch(e){}const m={};a.forEach(g=>{m[g.id]=g;});return m;}
function comFiltered(){
  const q=S.q.trim().toLowerCase();
  const pend=t=>t.estado==='ACEPTADO'&&!t.agrupacionId&&!ocReservaDe(t);
  return comTrips().filter(t=>(!S.fCli||t.proyecto===S.fCli)&&(!S.fPcat||t.proyectoCat===S.fPcat)&&(S.fCom===''||(S.fCom==='PEND'?pend(t):t.estado==='FACTURADO'))&&(!S.fDesde||planD(t)>=S.fDesde)&&(!S.fHasta||planD(t)<=S.fHasta)
    &&(!q||(t.id+' '+(t.noViaje||'')+' '+(J(t).piloto||'')+' '+(J(t).f.placa||'')+' '+(J(t).origen||'')+' '+(J(t).destino||'')+' '+(t.numeroFactura||'')+' '+(t.agrupacionId||'')).toLowerCase().includes(q))).sort((a,b)=>a.id.localeCompare(b.id));
}
const etapaCls={REPORTE:'progress',RECHAZADA:'alert',PREPARADA:'neutral',CONFIRMADA:'progress',ENVIADO_A_FACTURAR:'progress',FACTURADO:'progress',COBRO_PARCIAL:'progress',COBRADO:'done',ANULADA:'alert'};
const etapaBadge=e=>chip(etapaCls[e]||'neutral',PROCESO_L[e]||ETAPA_L[e]);
function tarifaCelda(t,pend){
  if(nn(t.tarifaCliente)!=null)return qfmt(t.tarifaCliente);
  const r=tarifaPara(t);
  return r.err?`<span class="warnl" title="${esc(r.err)}">⚠ Sin tarifa válida</span>`:`<span class="warnl" title="Hay una tarifa vigente sin aplicar">Tarifa por aplicar</span> ${hp('tarifa_registrar')&&pend&&!t.agrupacionId?`<button class="ib" data-act="aplicarTarifaViaje" data-id="${t.id}" title="Aplicar tarifa vigente" aria-label="Aplicar tarifa vigente al viaje ${t.id}">${icon('check',14)}</button>`:''}`;
}
BODY.comercial=()=>{
  const esAsist=S.view==='analista';
  const canAct=hp('comercial_agrupar'),rows=comFiltered(),AG=agrMap();
  const el=comTrips().filter(t=>t.estado==='ACEPTADO'&&!t.agrupacionId&&!ocReservaDe(t));
  S.sel=S.sel.filter(id=>el.some(t=>t.id===id));
  const selT=S.sel.map(id=>el.find(t=>t.id===id)),cli0=selT[0]&&selT[0].proyecto;
  const conT=selT.filter(t=>nn(t.tarifaCliente)!=null),tot=conT.reduce((a,t)=>a+Number(t.tarifaCliente),0);
  const sinTar=comTrips().filter(t=>t.estado==='ACEPTADO'&&!t.agrupacionId&&nn(t.tarifaCliente)==null).length;
  const bar=canAct?`<div class="selbar"><b>${selT.length} ${selT.length===1?'viaje seleccionado':'viajes seleccionados'}</b><span>${cli0?'· Cliente: <b>'+esc((PROYECTOS.find(p=>p.id===cli0)||{}).cliente)+'</b>':'· Selecciona uno o varios viajes del mismo cliente'}</span>${selT.length?`<span>· ${selT.length===1?(esAsist?'Viaje individual (no hace falta agrupar)':'Factura individual (no hace falta agrupar)'):(esAsist?'Viajes para agrupar':'Factura de viajes agrupados')} · Tarifa: <b>${qfmt(tot)}</b>${selT.length>conT.length?` <span class="warnl">(${selT.length-conT.length} sin tarifa)</span>`:''}</span>`:''}<span class="spacer"></span>${hp('tarifa_registrar')?`<button class="btn sm" data-act="aplicarTarifasTodas">Aplicar tarifas vigentes${sinTar?` (${sinTar} sin tarifa)`:''}</button>`:''}<button class="btn sm ghost" data-act="selClear" ${selT.length?'':'disabled'}>Limpiar</button><button class="btn primary" data-act="facturaOpen" ${selT.length?'':'disabled'}>${esAsist?'AGRUPAR Y GENERAR OT':'FACTURAR'}</button></div>`:'';
  const pendRows=rows.filter(t=>t.estado==='ACEPTADO'&&!t.agrupacionId&&!ocReservaDe(t));
  const allSel=canAct&&pendRows.length&&pendRows.every(t=>S.sel.includes(t.id));
  const pg=paginar('com',rows);
  const tbl=rows.length?`<div class="xlwrap"><table class="xl" style="min-width:1700px"><thead><tr><th>${canAct?`<input type="checkbox" data-selall="1" ${allSel?'checked':''} aria-label="Seleccionar todos los pendientes visibles">`:''}</th><th>Cliente</th><th>Proyecto</th><th>Fecha plan</th><th>ID viaje</th><th>No. viaje</th><th>Piloto</th><th>Unidad · placa</th><th>Capacidad</th><th>Ruta</th><th>Salida</th><th>Fin descarga</th><th>Tarifa cliente</th><th>Estado comercial</th><th>Factura</th><th>No. factura</th></tr></thead><tbody>
    ${pg.filas.map(t=>{const j=J(t),pend=t.estado==='ACEPTADO',res=!!t.agrupacionId,oc=ocReservaDe(t),g=AG[t.agrupacionId],chk=S.sel.includes(t.id),bloq=cli0&&t.proyecto!==cli0,libre=pend&&!res&&!oc;
      return `<tr class="${chk?'sel':''} ${libre?'':'dim'}"><td>${canAct&&libre?`<input type="checkbox" data-sel="${t.id}" ${chk?'checked':''} ${oc?`disabled title="Viaje en la orden de compra ${esc(oc.id)}: se factura desde esa OC"`:(bloq?`disabled title="Solo puedes ${esAsist?'agrupar':'facturar'} viajes de un mismo cliente"`:`${''}`)} aria-label="Seleccionar viaje ${t.id}">`:''}</td>
      <td>${esc(j.cliente)}</td><td>${esc(t.proyectoCat)}</td><td>${fmtL(t.fechaPlan)}</td><td><button class="linkbtn" data-act="detalle" data-id="${t.id}">#${t.id}</button></td><td>${esc(t.noViaje||'—')}</td><td>${esc(j.piloto)}</td><td>${esc(j.f.unidad)} · ${esc(j.f.placa)}</td><td>${esc(j.f.capacidad||'—')}</td><td style="white-space:normal;min-width:220px">${rutaHTML(t)}</td><td>${t.tSalida?fmtL(t.tSalida):'—'}</td><td>${t.tFinDescarga?fmtL(t.tFinDescarga):'—'}</td>
      <td style="text-align:right">${tarifaCelda(t,pend)}</td>
      <td>${oc?chip('progress','En OC '+oc.id):(g?etapaBadge(etapaAgr(g)):chip('neutral','Pendiente'))}</td><td>${g?(g.modalidad==='AGRUPADA'?`<b>${g.id}</b> · agrupada`:`${g.id} · individual`):'—'}</td><td>${t.numeroFactura?esc(t.numeroFactura):'—'}</td></tr>`;}).join('')}
    </tbody></table></div>${paginador('com',pg)}`:empty('No hay viajes con estos filtros','Solo aparecen viajes con la liquidación aprobada.');
  return bar+tbl;
};

/* =====================================================================
   AGRUPACIÓN DE COBRO · reportes PDF, autorización del cliente, facturación y cobro (todo dentro de COMERCIAL)
   ===================================================================== */
const hsOk=v=>esc(v==null||v===''?'—':v);
function agrLink(g,k,i,etq){const it=(k==='pdf'?g.pdfs:g.evidenciasAutorizacion)[i];return `<button class="linkbtn" data-act="agrAbrir" data-id="${g.id}" data-k="${k}" data-i="${i}">${esc(etq)}</button>`;}
function agrPanelHTML(g){
  const edit=g.estado==='ACTIVA'&&g.fase==='PREPARADA'&&!g.confirmacion;
  const pdfs=g.pdfs||[],cli=pdfs.filter(p=>p.tipo==='CLIENTE'),ult=cli[cli.length-1];
  const evs=g.evidenciasAutorizacion||[],evUlt=ult?evs.filter(e=>e.pdfVersion===ult.version):[],rzs=g.rechazos||[],rechUlt=!!ult&&rzs.some(x=>x.pdfVersion===ult.version);
  const B=(a,l,c,t)=>`<button class="btn sm ${c||''}" data-act="${a}" data-id="${g.id}"${t?` data-t="${t}"`:''}>${l}</button> `;
  const lstPdf=pdfs.length?pdfs.map((p,i)=>`<li>${agrLink(g,'pdf',i,(p.tipo==='INTERNO'?'Interno':'Cliente')+' · versión '+p.version)} · ${esc(fmtDT(p.en))} · ${esc(p.por)} · ${p.viajes} viaje(s) · ${esc(qfmt(p.total))}${p.motivo?' · '+esc(p.motivo):''}</li>`).join(''):'<li class="mute">Aún no hay reportes generados.</li>';
  const lstEv=evs.length?evs.map((e,i)=>`<li>${agrLink(g,'ev',i,e.id+' · '+(e.nombre||'evidencia'))} · reporte v${e.pdfVersion} · ${esc(fmtDT(e.en))} · ${esc(e.por)}${e.nota?' · '+esc(e.nota):''}</li>`).join(''):'<li class="mute">Sin evidencia de la OT.</li>';
  const conf=g.confirmacion?`<div class="alertbox info" style="margin:8px 0"><b>OT recibida</b> · ${esc(g.confirmacion.ot||g.confirmacion.referencia||'—')} · ${esc(g.confirmacion.por)} · ${esc(fmtDT(g.confirmacion.en))} · reporte v${g.confirmacion.pdfVersion} · evidencia(s): ${esc((g.confirmacion.evidencias||[]).join(', '))}</div>`:'';
  const acc=[];
  if(edit&&hp('comercial_agrupar')){acc.push(B('agrPdfOpen','Generar PDF interno','','INTERNO'));acc.push(B('agrPdfOpen','Generar PDF para el cliente','primary','CLIENTE'));}
  if(edit&&hp('comercial_ot')){acc.push(B('agrEvidOpen','Adjuntar evidencia de la OT','',''));acc.push(`<button class="btn sm ok" data-act="agrConfirmarOpen" data-id="${g.id}" ${(ult&&evUlt.length&&!rechUlt)?'':'disabled title="Requiere el PDF del cliente vigente, su evidencia y que no esté rechazado"'}>Registrar OT</button> `);acc.push(`<button class="btn sm fix" data-act="agrRechazarOpen" data-id="${g.id}" ${(ult&&!rechUlt)?'':'disabled title="Requiere un reporte del cliente vigente sin rechazo"'}>El cliente rechazó</button> `);}
  acc.push(B('agrImportes','Importes y tarifas','ghost'));
  return `<dl class="kv" style="margin-bottom:10px">${kvr('Cliente',esc((PROYECTOS.find(p=>p.id===g.cliente)||{}).cliente||g.cliente))}${kvr('Estado',etapaBadge(etapaAgr(g)))}${kvr('Factura',g.numeroFactura?esc((g.serieFactura?g.serieFactura+'-':'')+g.numeroFactura):'<span class="warnl">pendiente</span>')}${kvr('Viajes',String(g.viajeIds.length))}${kvr('Creada por',esc(g.creadoPor||'—')+' · '+esc(fmtDT(g.creadoEn)))}</dl>${conf}
    <h3 style="margin:10px 0 4px">Reportes PDF (se conservan todas las versiones)</h3><ul class="feed" style="margin:0 0 8px">${lstPdf}</ul>
    ${rzs.length?`<h3 style="margin:10px 0 4px">Rechazos del cliente</h3><ul class="feed" style="margin:0 0 8px">${rzs.map((e,i)=>`<li><b>${e.id}</b> · reporte v${e.pdfVersion} · ${esc(fmtDT(e.en))} · ${esc(e.por)} · “${esc(e.motivo)}”${e.path||e.data||e.url?' · '+agrLink(g,'rz',i,'evidencia'):''}</li>`).join('')}</ul>`:''}
    <h3 style="margin:10px 0 4px">Evidencia de la OT (no se reemplaza)</h3><ul class="feed" style="margin:0 0 8px">${lstEv}</ul>
    <div class="acts-wrap">${acc.join('')}${B('agrHistorial','Ver historial','ghost')}</div>`;
}
const hsF=()=>({cli:S.hsCli||'',pc:S.hsPcat||'',d:S.hsDesde||'',h:S.hsHasta||'',q:String(S.hsQ||'').trim().toLowerCase()});
const hsFecha=(f,fe)=>(!f.d||(fe&&fe>=f.d))&&(!f.h||(fe&&fe<=f.h));
function hsTabla(heads,rows,vacio){
  if(!rows.length)return empty(vacio,'Prueba otros filtros.');
  return `<div class="xlwrap"><table class="xl" style="min-width:900px"><thead><tr>${heads.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function historialesHTML(){
  const f=hsF(),sub=S.tab.hs||'agr';
  const subs=[['agr','Agrupaciones y reportes'],['aut','Autorizaciones y rechazos'],['evid','Evidencias'],['viajes','Viajes']].concat(hp('oc_ver')?[['oc','Órdenes de compra']]:[]);
  const k=subs.some(x=>x[0]===sub)?sub:'agr';
  const filtros=`<div class="lfilters" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:10px 0">
    <input type="text" data-flt="hsQ" placeholder="Buscar factura, agrupación, viaje…" value="${esc(S.hsQ||'')}" aria-label="Buscar">
    <select data-flt="hsCli" aria-label="Cliente"><option value="">Todos los clientes</option>${PROYECTOS.map(p=>`<option value="${p.id}" ${f.cli===p.id?'selected':''}>${esc(p.cliente)}</option>`).join('')}</select>
    <select data-flt="hsPcat" aria-label="Proyecto"><option value="">Todos los proyectos</option>${CAT.proyectos.map(p=>`<option ${f.pc===p?'selected':''}>${esc(p)}</option>`).join('')}</select>
    ${k==='agr'?`<select data-flt="hsEst" aria-label="Estado del proceso"><option value="">Todos los estados</option>${EST_ANALISTA.filter(x=>x[0]).map(x=>`<option value="${x[0]}" ${S.hsEst===x[0]?'selected':''}>${esc(x[1])}</option>`).join('')}</select>`:''}
    <label class="dlab">Desde <input type="date" data-flt="hsDesde" value="${esc(f.d)}"></label><label class="dlab">Hasta <input type="date" data-flt="hsHasta" value="${esc(f.h)}"></label></div>`;
  let ags=[];try{ags=API.agrupaciones(S.user.id);}catch(e){}
  const proyDe=g=>[...new Set(g.viajeIds.map(id=>{const t=DB.trips.find(x=>x.id===id);return t?t.proyectoCat:'';}))];
  const pasaG=(g,fe)=>(!f.cli||g.cliente===f.cli)&&(!f.pc||proyDe(g).includes(f.pc))&&hsFecha(f,fe)&&(!S.hsEst||k!=='agr'||procesoAgr(g)===S.hsEst)&&(!f.q||(g.id+' '+(g.numeroFactura||'')+' '+(g.serieFactura||'')+' '+(g.creadoPor||'')+' '+g.viajeIds.join(' ')).toLowerCase().includes(f.q));
  let tabla='';
  if(k==='agr'){
    const rows=ags.filter(g=>pasaG(g,dLoc(g.creadoEn))).slice().reverse().map(g=>[`<b>${g.id}</b>`,esc((PROYECTOS.find(p=>p.id===g.cliente)||{}).cliente||g.cliente),esc(proyDe(g).join(', ')),esc(g.creadoPor)+'<div class="mute small">'+esc(fmtDT(g.creadoEn))+'</div>',etapaBadge(etapaAgr(g)),hsOk(g.numeroFactura),
      (g.pdfs||[]).length?(g.pdfs||[]).map((p,i)=>agrLink(g,'pdf',i,(p.tipo==='INTERNO'?'Int.':'Cli.')+' v'+p.version)).join(' · '):'<span class="mute">—</span>',
      `<button class="btn sm" data-act="agrPanel" data-id="${g.id}">Reportes</button> <button class="btn sm ghost" data-act="agrHistorial" data-id="${g.id}">Historial</button>`]);
    tabla=hsTabla(['Agrupación','Cliente','Proyecto','Creada por · fecha','Estado','Factura','Reportes PDF',''],rows,'Sin agrupaciones con estos filtros');
  }else if(k==='aut'){
    const ev=[];
    ags.forEach(g=>{
      if(g.confirmacion&&pasaG(g,dLoc(g.confirmacion.en)))ev.push({en:g.confirmacion.en,g,tipo:'<span class="stc tn-done">OT recibida</span>',por:g.confirmacion.por,pdf:'v'+g.confirmacion.pdfVersion,det:(g.confirmacion.evidencias||[]).map(id=>{const i=(g.evidenciasAutorizacion||[]).findIndex(e=>e.id===id);return i>=0?agrLink(g,'ev',i,id):esc(id);}).join(' · ')});
      (g.rechazos||[]).forEach((x,i)=>{if(pasaG(g,dLoc(x.en)))ev.push({en:x.en,g,tipo:'<span class="stc tn-alert">Cliente rechazó</span>',por:x.por,pdf:'v'+x.pdfVersion,det:esc(x.motivo)+((x.path||x.data||x.url)?' · '+agrLink(g,'rz',i,x.id):'')});});
    });
    const rows=ev.sort((a,b)=>b.en<a.en?-1:1).map(x=>[`<b>${x.g.id}</b>`,esc((PROYECTOS.find(p=>p.id===x.g.cliente)||{}).cliente||x.g.cliente),esc(proyDe(x.g).join(', ')),x.tipo,esc(x.por)+'<div class="mute small">'+esc(fmtDT(x.en))+'</div>',x.pdf,x.det,hsOk(x.g.numeroFactura)]);
    tabla=hsTabla(['Agrupación','Cliente','Proyecto','Resultado','Registró · fecha y hora','PDF','Evidencia / motivo','Factura'],rows,'Sin autorizaciones ni rechazos con estos filtros');
  }else if(k==='evid'){
    const ev=[];
    ags.forEach(g=>{
      (g.evidenciasAutorizacion||[]).forEach((e,i)=>{if(pasaG(g,dLoc(e.en)))ev.push({en:e.en,g,tipo:'Autorización del cliente',por:e.por,ref:'Reporte v'+e.pdfVersion,l:agrLink(g,'ev',i,e.id)});});
      (g.rechazos||[]).forEach((e,i)=>{if((e.path||e.data||e.url)&&pasaG(g,dLoc(e.en)))ev.push({en:e.en,g,tipo:'Rechazo del cliente',por:e.por,ref:'Reporte v'+e.pdfVersion,l:agrLink(g,'rz',i,e.id)});});
      if(g.emision&&g.emision.archivo&&pasaG(g,dLoc(g.emision.en)))ev.push({en:g.emision.en,g,tipo:'Envío de la factura',por:g.emision.por,ref:g.emision.evidencia||'',l:`<button class="linkbtn" data-act="agrAbrir" data-id="${g.id}" data-k="emision" data-i="0">comprobante</button>`});
      (g.cobros||[]).forEach((c,i)=>{if((c.url||c.archivo)&&pasaG(g,dLoc(c.en||c.fecha)))ev.push({en:c.en||c.fecha,g,tipo:'Cobro',por:c.por,ref:c.referencia||'',l:`<button class="linkbtn" data-act="agrAbrir" data-id="${g.id}" data-k="cobro" data-i="${i}">comprobante</button>`});});
    });
    const rows=ev.sort((a,b)=>b.en<a.en?-1:1).map(x=>[`<b>${x.g.id}</b>`,esc(x.tipo),esc(x.por||'—')+'<div class="mute small">'+esc(fmtDT(x.en))+'</div>',esc(x.ref),hsOk(x.g.numeroFactura),x.l]);
    tabla=hsTabla(['Agrupación','Evidencia','Registró · fecha y hora','Referencia','Factura','Archivo'],rows,'Sin evidencias con estos filtros');
  }else if(k==='viajes'){
    const AG={};ags.forEach(g=>{if(g.estado==='ACTIVA')g.viajeIds.forEach(id=>{AG[id]=g;});});
    const rows=comTrips().filter(t=>(!f.cli||t.proyecto===f.cli)&&(!f.pc||t.proyectoCat===f.pc)&&hsFecha(f,planD(t))&&(!f.q||(t.id+' '+(t.noViaje||'')+' '+(AG[t.id]?AG[t.id].id+' '+(AG[t.id].numeroFactura||''):'')+' '+(t.ocId||'')).toLowerCase().includes(f.q)))
      .sort((a,b)=>b.id.localeCompare(a.id)).slice(0,300).map(t=>{const g=AG[t.id];return [`<b>#${esc(t.id)}</b>`,esc(cliNombre(t.proyecto)),esc(t.proyectoCat||''),esc(fmtDate(planD(t))),badge(t.estado),hsOk(t.ocId),g?esc(g.id):'<span class="mute">—</span>',g?hsOk(g.numeroFactura):'<span class="mute">—</span>',`<button class="btn sm ghost" data-act="detalle" data-id="${esc(t.id)}">Ver</button>`];});
    tabla=hsTabla(['Viaje','Cliente','Proyecto','Fecha','Estado','OC','Agrupación','Factura',''],rows,'Sin viajes con estos filtros');
  }else{
    let ocs=[];try{ocs=API.ordenesCompra(S.user.id);}catch(e){}
    const rows=ocs.filter(o=>(!f.cli||o.cliente===f.cli)&&(!f.pc||o.proyecto===f.pc)&&hsFecha(f,dLoc(o.preparadoEn))&&(!f.q||(o.id+' '+(o.agrupacionId||'')+' '+((DB.agrupaciones||[]).find(g=>g.id===o.agrupacionId)||{}).numeroFactura).toLowerCase().includes(f.q)))
      .slice().reverse().map(o=>{const g=(DB.agrupaciones||[]).find(x=>x.id===o.agrupacionId);return [`<b>${esc(o.id)}</b>${o.version>1?' <span class="mute">v'+o.version+'</span>':''}`,esc(o.clienteNombre),esc(o.proyecto),ocEstadoChip(o),esc(o.preparadoPor)+'<div class="mute small">'+esc(fmtDT(o.preparadoEn))+'</div>',o.respuesta?esc(o.respuesta.por)+'<div class="mute small">'+esc(fmtDT(o.respuesta.en))+'</div>':'<span class="mute">—</span>',g?esc(g.id+(g.numeroFactura?' · '+g.numeroFactura:'')):'<span class="mute">—</span>',`<button class="btn sm ghost" data-act="ocDetalle" data-id="${esc(o.id)}">Ver historial</button>`];});
    tabla=hsTabla(['Orden','Cliente','Proyecto','Estado','Preparó · fecha','Respuesta del cliente','Agrupación · factura',''],rows,'Sin órdenes de compra con estos filtros');
  }
  return `<div class="chips">${subs.map(x=>`<button class="chip" aria-pressed="${x[0]===k}" data-act="hsSub" data-v="${x[0]}">${x[1]}</button>`).join('')}</div>${filtros}${tabla}`;
}

/* ---- Pestaña «Facturas / Agrupaciones»: la MISMA lista para Analista, Facturación y la vista general, con filtros reales ---- */
const EST_ANALISTA=[['','Todas las vigentes'],['PREPARADA','Preparadas (sin reporte)'],['REPORTE','Reporte enviado · espera OT'],['RECHAZADA','Rechazadas por el cliente'],['CONFIRMADA','Con OT'],['ENVIADO_A_FACTURAR','En facturación (sin factura enviada)'],['FACTURADO','Facturas enviadas'],['COBRO_PARCIAL','Cobro parcial'],['COBRADO','Cobradas'],['ANULADA','Anuladas']];
const EST_FACT=[['','Todas las recibidas'],['CONFIRMADA','Pendientes: facturar (con OT)'],['ENVIADO_A_FACTURAR','Pendientes: registrar envío de la factura'],['FACTURADO','Facturas enviadas'],['COBRO_PARCIAL','Cobro parcial'],['COBRADO','Cobradas'],['ANULADA','Anuladas']];
const proyDeAgr=g=>[...new Set(g.viajeIds.map(id=>{const t=DB.trips.find(x=>x.id===id);return t?t.proyectoCat:'';}).filter(Boolean))];
function agrFiltradas(ags,modo){
  const est=(S.fgEst||''),q=String(S.fgQ||'').trim().toLowerCase();
  return ags.filter(g=>{
    if(modo==='factcom'&&!(g.confirmacion||g.fase!=='PREPARADA'))return false;      /* Facturación solo recibe lo que el cliente ya confirmó */
    const p=procesoAgr(g);
    if(est?p!==est:g.estado!=='ACTIVA')return false;
    if(S.fgCli&&g.cliente!==S.fgCli)return false;
    if(S.fgPc&&!proyDeAgr(g).includes(S.fgPc))return false;
    const fe=dLoc(g.creadoEn);if(S.fgDesde&&fe<S.fgDesde)return false;if(S.fgHasta&&fe>S.fgHasta)return false;
    if(q&&!(g.id+' '+(g.numeroFactura||'')+' '+(g.serieFactura||'')+' '+g.viajeIds.join(' ')+' '+(g.creadoPor||'')).toLowerCase().includes(q))return false;
    return true;
  }).slice().reverse();
}
function factTabHTML(ags,acts,modo){
  const est=(S.fgEst||''),opts=modo==='factcom'?EST_FACT:EST_ANALISTA;
  const lista=agrFiltradas(ags,modo);
  const cont=(modo==='factcom'?ags.filter(g=>g.confirmacion||g.fase!=='PREPARADA'):ags);
  const cnt=k=>cont.filter(g=>k?procesoAgr(g)===k:g.estado==='ACTIVA').length;
  const filtros=`<div class="lfilters" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr));margin:0 0 12px">
    <input type="text" data-flt="fgQ" placeholder="Factura, agrupación o viaje…" value="${esc(S.fgQ||'')}" aria-label="Buscar factura o agrupación">
    <select data-flt="fgEst" aria-label="Estado del proceso">${opts.map(o=>`<option value="${o[0]}" ${est===o[0]?'selected':''}>${esc(o[1])} (${cnt(o[0])})</option>`).join('')}</select>
    <select data-flt="fgCli" aria-label="Cliente"><option value="">Todos los clientes</option>${PROYECTOS.map(p=>`<option value="${p.id}" ${S.fgCli===p.id?'selected':''}>${esc(p.cliente)}</option>`).join('')}</select>
    <select data-flt="fgPc" aria-label="Proyecto"><option value="">Todos los proyectos</option>${CAT.proyectos.map(p=>`<option ${S.fgPc===p?'selected':''}>${esc(p)}</option>`).join('')}</select>
    <label class="dlab">Desde <input type="date" data-flt="fgDesde" value="${esc(S.fgDesde||'')}"></label><label class="dlab">Hasta <input type="date" data-flt="fgHasta" value="${esc(S.fgHasta||'')}"></label></div>`;
  return filtros+agrTable(lista,acts);
}
function agrTable(list,acts){
  if(!list.length)return empty('Sin facturas','Cuando se prepare una factura aparecerá aquí.');
  const pg=paginar('agr',list);
  const vig=list.filter(g=>g.estado==='ACTIVA'&&g.fase!=='PREPARADA');
  const sum=fn=>r2(vig.reduce((s,g)=>s+(fn(g)||0),0));
  const emi=vig.filter(g=>g.fase==='EMITIDA'&&nn(g.importeFacturado)!=null);
  return `<div class="xlwrap"><table class="xl" style="min-width:1750px"><thead><tr><th>ID</th><th>Modalidad</th><th>Cliente</th><th>Viajes</th><th>N.º factura</th><th>Fecha factura</th><th>Enviado a facturar</th><th>Enviada por · fecha</th><th>Emitida (evidencia)</th><th>Facturado</th><th>Cobrado</th><th>Saldo por cobrar</th><th>Estado</th><th>Detalle</th>${acts?'<th class="stkR">Acciones</th>':''}</tr></thead><tbody>
  ${pg.filas.map(g=>{const et=procesoAgr(g),cob=cobradoDe(g),fa=g.fase==='EMITIDA'?nn(g.importeFacturado):null,okA=g.estado==='ACTIVA';
  const B=(a,l,c)=>`<button class="btn sm ${c||''}" data-act="${a}" data-id="${g.id}">${l}</button> `;
  let ac=B('agrDetalle','Ver viajes','ghost');
  /* En una factura anulada, decir dónde quedó cada viaje: libre para facturar o ya tomado por otra factura. */
  let reas='';
  if(g.estado==='ANULADA'){
    const c={};g.viajeIds.forEach(id=>{const t=DB.trips.find(x=>x.id===id);if(!t)return;
      const k=t.agrupacionId&&t.agrupacionId!==g.id?t.agrupacionId:'libre';(c[k]=c[k]||[]).push(id);});
    const partes=Object.keys(c).sort().map(k=>k==='libre'?`${c[k].length} libre${c[k].length===1?'':'s'}`:`${c[k].length} en ${k}`);
    if(partes.length)reas=`<div class="mute" style="font-size:11px;margin-top:3px">Ahora: ${partes.join(' · ')}</div>`;
  }
  if(okA){
    ac+=B('agrHistorial','Historial','ghost')+B('agrImportes','Importes','ghost');
    if(g.fase==='PREPARADA'){
      ac+=B('agrPanel','Reportes y OT',g.confirmacion?'':'primary');
      if(hp('comercial_ot')&&!g.confirmacion){
        const cli=(g.pdfs||[]).filter(p=>p.tipo==='CLIENTE'),ult=cli[cli.length-1];
        const evs=ult?(g.evidenciasAutorizacion||[]).filter(e=>e.pdfVersion===ult.version):[];
        if(ult&&evs.length)ac+=B('agrConfirmarOpen','Registrar OT','primary');
      }
      if(g.confirmacion&&hp('facturas_emitir')){if(!g.numeroFactura||!g.fechaFactura)ac+=B('facturaEditar','Datos de factura','primary');else ac+=B('agrRecibir','Enviar a facturación','primary');}
    }
    if(g.fase==='ENVIADA'&&hp('facturas_emitir'))ac+=B('emitirOpen','Registrar envío de la factura','primary');
    if(g.fase==='EMITIDA'){ac+=B('evidenciaVer','Ver comprobante','');if(fa!=null&&fa-cob>0.004&&hp('cobros_registrar'))ac+=B('cobroOpen','Registrar cobro','ok');}
    if(g.numeroFactura&&g.fase!=='PREPARADA'&&hp('comercial_corregir'))ac+=B('corregirOpen','Corregir nº','');
    /* Descartar una preparada lo puede hacer quien la arma (Facturación/Comercial); anular una ya
       enviada o emitida exige el permiso restringido de anulación. */
    if(g.fase==='PREPARADA'?(g.confirmacion?hp('comercial_ot'):hp('comercial_agrupar')):hp('comercial_anular'))ac+=B('anularOpen',g.fase==='PREPARADA'?'Descartar':'Anular','fix');
  }
  return `<tr class="${okA?'':'dim'}"><td><b>${g.id}</b></td><td>${g.modalidad==='AGRUPADA'?'Agrupada':'Individual'}</td><td>${esc((PROYECTOS.find(p=>p.id===g.cliente)||{}).cliente||g.cliente)}</td><td title="Viajes: ${g.viajeIds.join(', ')}">${g.viajeIds.slice(0,8).map(i=>`<button class="linkbtn" data-act="detalle" data-id="${i}">#${i}</button>`).join(' ')}${g.viajeIds.length>8?' <span class="mute">…</span>':''} <b class="mute">[${g.viajeIds.length}]</b>${reas}</td>
  <td>${g.numeroFactura?`<b>${esc(g.numeroFactura)}</b>`:(g.confirmacion?`<span class="mute">OT ${esc(g.confirmacion.ot||g.confirmacion.referencia||'—')}</span>`:'<span class="warnl">pendiente</span>')}</td><td>${g.fechaFactura?fmtDate(g.fechaFactura):'—'}</td>
  <td style="text-align:right">${g.fase==='PREPARADA'?'<span class="mute">sin enviar</span>':qfmt(g.importeEnviado)}</td><td>${g.envio?`${esc(g.envio.por)}<br><span class="mute">${fmtDT(g.envio.en)}</span>`:'—'}</td>
  <td style="white-space:normal;min-width:170px">${g.emision?`${fmtDate(g.emision.fecha)}<br><span class="mute">${esc(g.emision.evidencia)}</span>`:'<span class="mute">Sin emitir</span>'}</td>
  <td style="text-align:right">${g.fase==='EMITIDA'?qfmt(fa):'—'}</td><td style="text-align:right">${g.fase==='EMITIDA'?qfmt(cob):'—'}</td><td style="text-align:right">${fa==null?'—':qfmt(r2(fa-cob))}</td>
  <td>${etapaBadge(et)}</td><td style="white-space:normal;min-width:190px;font-size:12px">${g.anulada?`<span class="mute">Anulada por ${esc(g.anulada.por)} · ${fmtDT(g.anulada.en)} · “${esc(g.anulada.motivo)}”</span><br>`:''}${(g.cobros||[]).map(c=>`<span class="mute">Cobro ${qfmt(c.monto)} · ${fmtDate(c.fecha)} · ${esc(c.referencia)}</span><br>`).join('')}${g.correcciones.map(c=>`<span class="mute">Nº corregido: ${esc(c.anterior)} → ${esc(c.nuevo)} (${esc(c.por)})</span><br>`).join('')}</td>
  ${acts?`<td class="stkR" style="white-space:normal;min-width:220px"><div class="acts-wrap">${ac}</div></td>`:''}</tr>`;}).join('')}
  </tbody><tfoot><tr><td colspan="6"><b>Totales (cada factura se cuenta una sola vez; las preparadas no suman)</b></td><td style="text-align:right"><b>${qfmt(sum(g=>g.importeEnviado))}</b></td><td colspan="2"></td><td style="text-align:right"><b>${qfmt(sum(g=>g.fase==='EMITIDA'?nn(g.importeFacturado):0))}</b></td><td style="text-align:right"><b>${qfmt(sum(g=>cobradoDe(g)))}</b></td><td style="text-align:right"><b>${emi.length?qfmt(r2(emi.reduce((s,g)=>s+g.importeFacturado-cobradoDe(g),0))):'—'}</b></td><td colspan="${acts?3:2}"></td></tr></tfoot></table></div>${paginador('agr',pg)}
  <div class="mute" style="margin-top:8px;font-size:13px"><b>Preparada</b> = datos en armado, no enviada. <b>Con OT</b> = el cliente entregó su orden de trabajo. <b>Enviada a facturación</b> = validada y enviada. <b>Emitida</b> = factura oficial con su foto. <b>Cobrada</b> = dinero recibido. Son etapas distintas: no se marca una factura como emitida sin evidencia.</div>`;
}
/* ---- Facturación: historial de lo enviado a facturar, con filtros combinables ---- */
function weekRange(v){
  const m=/^(\d{4})-W(\d{2})$/.exec(v||'');if(!m)return null;
  const y=+m[1],w=+m[2],j4=new Date(Date.UTC(y,0,4)),dow=(j4.getUTCDay()+6)%7,mon=new Date(j4);
  mon.setUTCDate(j4.getUTCDate()-dow+(w-1)*7);const sun=new Date(mon);sun.setUTCDate(mon.getUTCDate()+6);
  const f=d=>d.toISOString().slice(0,10);return [f(mon),f(sun)];
}
const FC_COLS=[['cliente','Cliente',r=>r.cliente],['proyecto','Proyecto',r=>r.proyecto],['id','N.º de viaje',r=>r.id],['fechaViaje','Fecha del viaje',r=>r.fechaViaje],['fechaEnvio','Fecha de envío',r=>r.fechaBase],['factura','N.º de factura',r=>r.factura],['grupo','Grupo de viajes',r=>r.grupo],['importe','Importe',r=>r.importe==null?-1:r.importe],['etapa','Estado de facturación',r=>ETAPA_L[r.etapa]],['por','Responsable del envío',r=>r.por]];
function factRows(F){
  F=F||S;                         /* por omisión usa los filtros de la pantalla Facturación; Finanzas pasa los suyos */
  const AG=agrMap(),T={};vis().forEach(t=>{T[t.id]=t;});
  const rows=[];
  Object.keys(AG).forEach(k=>{const g=AG[k];
    if(F.fcEstado==='ENV'&&!(g.estado==='ACTIVA'&&['ENVIADA','EMITIDA'].includes(g.fase)))return;
    if(F.fcEstado==='PREP'&&!(g.estado==='ACTIVA'&&g.fase==='PREPARADA'))return;
    if(F.fcEstado==='ANU'&&g.estado!=='ANULADA')return;
    g.viajeIds.forEach(id=>{const t=T[id];if(!t)return;
      const cli=(PROYECTOS.find(p=>p.id===t.proyecto)||{}).cliente||t.proyecto,envio=g.envio?dLoc(g.envio.en):'';
      rows.push({g,t,cliente:cli,cid:t.proyecto,proyecto:t.proyectoCat,id,fechaViaje:planD(t),fechaEnvio:envio,fechaBase:envio||dLoc(g.creadoEn),factura:g.numeroFactura||'',grupo:g.modalidad==='AGRUPADA'?g.id:'',importe:(g.importesViaje&&g.importesViaje[id]!=null)?g.importesViaje[id]:(g.fase==='PREPARADA'?nn(t.tarifaCliente):null),etapa:etapaAgr(g),por:g.envio?g.envio.por:g.creadoPor});
    });});
  const wr=weekRange(F.fcSem),q=F.fcQ.trim().toLowerCase();
  return rows.filter(r=>{
    const f=F.fcBase==='viaje'?r.fechaViaje:r.fechaBase;
    return (!(esAdm()&&F.fcViaje)||r.id===F.fcViaje)&&(!F.fcCli||r.cid===F.fcCli)&&(!F.fcPcat||r.proyecto===F.fcPcat)
      &&(!F.fcMes||f.startsWith(F.fcMes))&&(!wr||(f>=wr[0]&&f<=wr[1]))&&(!F.fcFecha||f===F.fcFecha)
      &&(!F.fcDesde||f>=F.fcDesde)&&(!F.fcHasta||f<=F.fcHasta)&&(!F.fcFechas.length||F.fcFechas.includes(f))
      &&(!q||(r.id+' '+r.cliente+' '+r.proyecto+' '+r.factura+' '+r.grupo+' '+r.por).toLowerCase().includes(q));
  });
}
BODY.hist=()=>{
  const rows=factRows(),so=S.sortF||{k:'fechaEnvio',dir:-1},col=FC_COLS.find(c=>c[0]===so.k)||FC_COLS[4];
  rows.sort((a,b)=>{const x=col[2](a),y=col[2](b);return (x<y?-1:x>y?1:0)*so.dir||a.id.localeCompare(b.id);});
  const conImp=rows.filter(r=>r.importe!=null);
  if(!rows.length)return empty('No hay envíos con estos filtros','Cambia o limpia los filtros. Solo se listan viajes enviados a facturar.');
  const pg=paginar('hist',rows);
  return `<div class="exportbar"><div class="mute">${rows.length} ${rows.length===1?'viaje':'viajes'} · Importe total: <b>${qfmt(r2(conImp.reduce((s,r)=>s+r.importe,0)))}</b>${conImp.length<rows.length?` <span class="warnl">(${rows.length-conImp.length} sin importe)</span>`:''}</div>
  <div class="exportbtns"><span class="mute" style="font-size:12.5px">Se exporta lo que ves, con el detalle de cada factura y viaje</span><button class="btn sm" data-act="exportFactXlsx" title="Descargar Excel con todo el detalle">${icon('receipt',16)} Descargar Excel</button><button class="btn sm primary" data-act="exportFactPdf" title="Descargar PDF con todo el detalle">${icon('receipt',16)} Descargar PDF</button></div></div>
  <div class="xlwrap"><table class="xl" style="min-width:1300px"><thead><tr>${FC_COLS.map(c=>`<th aria-sort="${so.k===c[0]?(so.dir>0?'ascending':'descending'):'none'}"><button class="thbtn" data-act="sortF" data-k="${c[0]}">${c[1]} <span aria-hidden="true">${so.k===c[0]?(so.dir>0?'▲':'▼'):'↕'}</span></button></th>`).join('')}</tr></thead><tbody>
  ${pg.filas.map(r=>`<tr><td>${esc(r.cliente)}</td><td>${esc(r.proyecto)}</td><td><button class="linkbtn" data-act="detalle" data-id="${r.id}">#${r.id}</button></td><td>${fmtDate(r.fechaViaje)}</td><td>${r.fechaEnvio?fmtDate(r.fechaEnvio):'<span class="mute">sin enviar</span>'}</td><td>${r.factura?esc(r.factura):'—'}</td><td>${r.grupo||'—'}</td><td style="text-align:right">${r.importe==null?sinReg:qfmt(r.importe)}</td><td>${etapaBadge(r.etapa)}</td><td>${esc(r.por)}</td></tr>`).join('')}
  </tbody></table></div>${paginador('hist',pg)}`;
};
function histFiltros(){
  const hay=(esAdm()&&S.fcViaje)||S.fcCli||S.fcPcat||S.fcMes||S.fcSem||S.fcFecha||S.fcDesde||S.fcHasta||S.fcFechas.length||S.fcQ||S.fcEstado!=='ENV'||S.fcBase!=='envio';
  return `<div class="lfilters" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))">${esAdm()?viajeComboFact():''}<input type="text" data-live="fcQ" placeholder="Buscar viaje, factura, grupo…" value="${esc(S.fcQ)}" aria-label="Buscar">
    <select data-flt="fcCli" aria-label="Cliente"><option value="">Todos los clientes</option>${PROYECTOS.map(p=>`<option value="${p.id}" ${S.fcCli===p.id?'selected':''}>${esc(p.cliente)}</option>`).join('')}</select>
    <select data-flt="fcPcat" aria-label="Proyecto"><option value="">Todos los proyectos</option>${CAT.proyectos.map(p=>`<option ${S.fcPcat===p?'selected':''}>${esc(p)}</option>`).join('')}</select>
    <select data-flt="fcEstado" aria-label="Estado"><option value="ENV" ${S.fcEstado==='ENV'?'selected':''}>Enviadas y emitidas</option><option value="PREP" ${S.fcEstado==='PREP'?'selected':''}>Preparadas (sin enviar)</option><option value="ANU" ${S.fcEstado==='ANU'?'selected':''}>Anuladas</option><option value="TODAS" ${S.fcEstado==='TODAS'?'selected':''}>Todas</option></select>
    <select data-flt="fcBase" aria-label="Fecha a filtrar"><option value="envio" ${S.fcBase==='envio'?'selected':''}>Filtrar por fecha de envío</option><option value="viaje" ${S.fcBase==='viaje'?'selected':''}>Filtrar por fecha del viaje</option></select></div>
    <div class="lfilters" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><label class="dlab">Mes <input type="month" data-flt="fcMes" value="${esc(S.fcMes)}"></label><label class="dlab">Semana <input type="week" data-flt="fcSem" value="${esc(S.fcSem)}"></label><label class="dlab">Fecha <input type="date" data-flt="fcFecha" value="${esc(S.fcFecha)}"></label><label class="dlab">Desde <input type="date" data-flt="fcDesde" value="${esc(S.fcDesde)}"></label><label class="dlab">Hasta <input type="date" data-flt="fcHasta" value="${esc(S.fcHasta)}"></label>
    <span class="dlab">Varias fechas <input type="date" id="fcNueva"> <button class="btn sm" data-act="fcAddFecha">Agregar</button></span>${hay?`<button class="btn sm" data-act="fcLimpiar">Limpiar filtros</button>`:''}</div>
    ${S.fcFechas.length?`<div class="chips">${S.fcFechas.map(f=>`<span class="chip">${fmtDate(f)} <button class="cretry" data-act="fcQuitarFecha" data-f="${f}" aria-label="Quitar ${f}">×</button></span>`).join('')}</div>`:''}`;
}
/* ---- Tarifas ---- */
function tarData(){let t=[];try{t=API.tarifas(S.user.id);}catch(e){}return t;}
/* Rutas que se pueden tarifar: validadas (en tarifación), con tarifa pendiente de aprobación o activas (otra capacidad). */
/* Rutas del selector de tarifas. En ámbar las que no tienen ninguna tarifa activa
   y en naranja las que tienen tarifa pero les falta alguna capacidad de la flota. */
const optRutaTarifa=(cliente,proyecto)=>{
  if(!cliente||!proyecto)return [];
  const caps=capsCat();
  return API.rutasParaTarifa(S.user.id,cliente,proyecto).map(r=>{
    const tf=DB.tarifas.filter(x=>x.activa&&x.rutaId===r.id);
    const sin=tf.length===0,faltan=sin?[]:caps.filter(c=>!tf.some(x=>x.capacidad===c));
    const est=r.estado==='EN_TARIFACION'?' · en tarifación':(r.estado==='PENDIENTE_APROBACION'?' · pendiente de aprobación':'');
    const nota=sin?' · SIN TARIFA':(faltan.length?` · falta cap. ${faltan.join(', ')}`:'');
    return {id:r.id,nombre:`${r.codigo} · ${nombreOrigen(r.origen)} → ${nombreDestino(r.destino)}${est}${nota}`,
      cls:sin?'sinTarifa':(faltan.length?'capFalta':''),
      title:sin?'Esta ruta todavía no tiene ninguna tarifa activa.':(faltan.length?`Falta tarifa para la capacidad ${faltan.join(', ')} de la flota.`:'')};
  });
};
function rutaTxt(id){const r=DB.rutas.find(x=>x.id===id);return r?`${r.codigo} · ${nombreOrigen(r.origen)} → ${nombreDestino(r.destino)}`:id;}
BODY.tarifas=()=>{
  const q=S.tfQ.trim().toLowerCase();
  const rows=tarData().filter(t=>(!S.tfCli||t.cliente===S.tfCli)&&(!S.tfPcat||t.proyecto===S.tfPcat)&&(!S.tfCap||t.capacidad===S.tfCap)&&(!S.tfEst||(S.tfEst==='A'?t.activa:!t.activa))&&(!q||(t.cliente+' '+t.proyecto+' '+rutaTxt(t.rutaId)+' '+t.capacidad+' '+t.id).toLowerCase().includes(q)))
    .sort((a,b)=>a.cliente.localeCompare(b.cliente)||rutaTxt(a.rutaId).localeCompare(rutaTxt(b.rutaId))||b.vigenteDesde.localeCompare(a.vigenteDesde));
  const ed=hp('tarifas_editar'),dsv=hp('tarifas_desactivar');
  const pg=paginar('tar',rows);
  return rows.length?`<div class="mute" style="margin-bottom:8px">${rows.length} tarifas</div><div class="xlwrap"><table class="xl" style="min-width:1650px"><thead><tr><th>ID</th><th>Cliente</th><th>Proyecto</th><th>Ruta</th><th>Capacidad</th><th>Importe</th><th>Q diésel</th><th>% comb.</th><th>Importe prov.</th><th>Q diésel prov.</th><th>% comb. prov.</th><th>Vigente desde</th><th>Vigente hasta</th><th>Estado</th><th>Creada por · fecha</th><th>Modificada por · fecha</th>${ed||dsv?'<th>Acciones</th>':''}</tr></thead><tbody>
  ${pg.filas.map(t=>`<tr class="${t.activa?'':'dim'}"><td><b>${t.id}</b></td><td>${esc((PROYECTOS.find(p=>p.id===t.cliente)||{}).cliente||t.cliente)}</td><td>${esc(t.proyecto)}</td><td style="white-space:normal;min-width:240px">${esc(rutaTxt(t.rutaId))}</td><td>${esc(t.capacidad)}</td><td style="text-align:right"><b>${qfmt(t.importe)}</b></td><td style="text-align:right">${t.qDieselPactado!=null&&t.qDieselPactado!==''?esc(t.qDieselPactado):'<span class="mute">—</span>'}</td><td style="text-align:right">${t.combustiblePct!=null&&t.combustiblePct!==''?esc(t.combustiblePct)+'%':'<span class="mute">—</span>'}</td><td style="text-align:right">${t.importeOpl!=null&&t.importeOpl!==''?qfmt(t.importeOpl):'<span class="mute">—</span>'}</td><td style="text-align:right">${t.dieselPactadoOpl!=null&&t.dieselPactadoOpl!==''?esc(t.dieselPactadoOpl):'<span class="mute">—</span>'}</td><td style="text-align:right">${t.combustiblePctOpl!=null&&t.combustiblePctOpl!==''?esc(t.combustiblePctOpl)+'%':'<span class="mute">—</span>'}</td><td>${fmtDate(t.vigenteDesde)}</td><td>${t.vigenteHasta?fmtDate(t.vigenteHasta):'<span class="mute">sin fin</span>'}</td><td>${chip(t.activa?'done':'neutral',t.activa?'Activa':'Inactiva')}</td><td>${esc(t.creadoPor)}<br><span class="mute">${fmtDT(t.creadoEn)}</span></td><td>${t.modificadoPor?`${esc(t.modificadoPor)}<br><span class="mute">${fmtDT(t.modificadoEn)}</span>`:'—'}</td>
  ${ed||dsv?`<td style="white-space:nowrap">${ed?`<button class="btn sm" data-act="tarifaOpen" data-id="${t.id}">Editar</button> `:''}${dsv?`<button class="btn sm ${t.activa?'fix':'ok'}" data-act="tarifaEstado" data-id="${t.id}">${t.activa?'Desactivar':'Activar'}</button>`:''}</td>`:''}</tr>`).join('')}
  </tbody></table></div>${paginador('tar',pg)}`:empty('No hay tarifas con estos filtros','Crea una tarifa o cambia la búsqueda.');
};
function tarifasVista(){
  let sin=[];try{sin=API.viajesSinTarifa(S.user.id);}catch(e){}
  const disp=sin.filter(x=>x.disponible).length;
  let memRows=[];try{memRows=API.mem(S.user.id);}catch(e){}
  const memUlt=memRows.length?memRows[memRows.length-1]:null;
  return `${sin.length?`<div class="alertbox" style="margin-bottom:12px"><b>${sin.length} ${sin.length===1?'viaje sin tarifa válida':'viajes sin tarifa válida'}</b> · se requiere revisión; no se inventan importes.
    <ul style="margin:6px 0 0 18px;padding:0">${sin.slice(0,8).map(x=>`<li><button class="linkbtn" data-act="detalle" data-id="${x.id}">#${x.id}</button> · ${esc(x.cliente)} · ${esc(x.proyecto)}: ${esc(x.motivo)}</li>`).join('')}${sin.length>8?`<li class="mute">… y ${sin.length-8} más</li>`:''}</ul>
    ${disp&&hp('tarifa_registrar')?`<div style="margin-top:8px"><button class="btn sm primary" data-act="aplicarTarifasTodas">Aplicar las ${disp} tarifas vigentes disponibles</button></div>`:''}</div>`:''}
    <div class="lfilters" style="grid-template-columns:2fr repeat(4,1fr)"><input type="text" data-live="tfQ" placeholder="Buscar por cliente, proyecto, ruta, origen, destino o capacidad" value="${esc(S.tfQ)}" aria-label="Buscar">
    <select data-flt="tfCli" aria-label="Cliente"><option value="">Todos los clientes</option>${PROYECTOS.map(p=>`<option value="${p.id}" ${S.tfCli===p.id?'selected':''}>${esc(p.cliente)}</option>`).join('')}</select>
    <select data-flt="tfPcat" aria-label="Proyecto"><option value="">Todos los proyectos</option>${CAT.proyectos.map(p=>`<option ${S.tfPcat===p?'selected':''}>${esc(p)}</option>`).join('')}</select>
    <select data-flt="tfCap" aria-label="Capacidad"><option value="">Toda capacidad</option>${capsCat().map(c=>`<option ${S.tfCap===c?'selected':''}>${esc(c)}</option>`).join('')}</select>
    <select data-flt="tfEst" aria-label="Estado"><option value="">Activas e inactivas</option><option value="A" ${S.tfEst==='A'?'selected':''}>Solo activas</option><option value="I" ${S.tfEst==='I'?'selected':''}>Solo inactivas</option></select></div>
    <div class="row" style="align-items:center;gap:10px;margin:0 0 10px;flex-wrap:wrap">
      <span class="mute small">MEM (precio del diésel): ${memUlt?`${memRows.length} renglones · último ${fmtDate(memUlt.fecha)} · <b>Q ${esc(memUlt.precioDiesel)}</b>`:'sin cargar'}</span>
      <span class="spacer"></span>
      ${hp('tarifas_editar')?`<button class="btn sm" data-act="memOpen">Cargar tabla MEM</button>`:''}
    </div>
    <div id="vb">${BODY.tarifas()}</div>`;
}
/* TARIFAS es una sección del módulo COMERCIAL (antes era una pestaña dentro de Facturación). */
VIEWS.tarifas=()=>`<div class="inner" style="max-width:1500px">${pageHead('TARIFAS','Tarifa de cobro al cliente por ruta, capacidad y vigencia',hp('tarifas_crear')?`<button class="btn primary" data-act="tarifaOpen" data-id="">${icon('plus',18)} Nueva tarifa</button>`:'')}${tarifasVista()}</div>`;
function comView(modo){
  const verOc=hp('oc_ver')&&allowed('oc');   /* pestaña de OC dentro de este mismo espacio (no es otro módulo) */
  const TK=modo==='analista'?'comA':modo==='factcom'?'comF':'com';
  const canAct=hp('comercial_agrupar');
  const T={bandeja:{k:'bandeja',l:'Pendientes de gestión'},oc:{k:'oc',l:'Órdenes de compra'},
    fact:{k:'fact',l:modo==='analista'?'Agrupaciones':modo==='factcom'?'Por facturar y facturadas':'Facturas'},
    hist:{k:'hist',l:'Facturación'},historial:{k:'historial',l:'Historiales'},reg:{k:'reg',l:'Registros anteriores'}};
  const orden=modo==='analista'?['bandeja','oc','fact','historial','reg']:modo==='factcom'?['fact','hist','oc','historial','reg']:['bandeja','oc','fact','hist','historial','reg'];
  const tabsV=orden.filter(x=>x!=='oc'||verOc).map(x=>T[x]);
  const k=tabsV.some(t=>t.k===S.tab[TK])?S.tab[TK]:((verOc&&hp('oc_preparar')&&!canAct)?'oc':(modo==='factcom'?'fact':'bandeja'));
  const acts=canAct||hp('facturas_emitir')||hp('comercial_corregir')||hp('comercial_anular')||hp('cobros_registrar')||hp('comercial_ot');
  let ags=[];try{ags=API.agrupaciones(S.user.id);}catch(e){}
  let body;
  if(k==='bandeja'){
    body=`<div class="row2" style="margin:0 0 12px;grid-template-columns:1.4fr 1fr 1fr 1fr 1fr 1fr"><input type="text" id="q" placeholder="Buscar viaje, piloto, placa, destino, factura…" value="${esc(S.q)}" aria-label="Buscar"><select data-flt="fCli" aria-label="Cliente"><option value="">Todos los clientes</option>${PROYECTOS.map(p=>`<option value="${p.id}" ${S.fCli===p.id?'selected':''}>${esc(p.cliente)}</option>`).join('')}</select><select data-flt="fPcat" aria-label="Proyecto"><option value="">Todos los proyectos</option>${CAT.proyectos.map(p=>`<option ${S.fPcat===p?'selected':''}>${esc(p)}</option>`).join('')}</select><select data-flt="fCom" aria-label="Estado comercial"><option value="PEND" ${S.fCom==='PEND'?'selected':''}>Pendientes de gestión</option><option value="REG" ${S.fCom==='REG'?'selected':''}>Ya enviados a facturar</option><option value="" ${S.fCom===''?'selected':''}>Todos</option></select><label class="dlab">Desde <input type="date" data-flt="fDesde" value="${esc(S.fDesde||'')}"></label><label class="dlab">Hasta <input type="date" data-flt="fHasta" value="${esc(S.fHasta||'')}"></label></div><div id="vb">${BODY.comercial()}</div>`;
  }else if(k==='fact'){
    body=factTabHTML(ags,acts,modo);
  }else if(k==='historial'){
    body=historialesHTML();
  }else if(k==='oc'){
    body=ocPanelHTML();
  }else if(k==='hist'){
    body=`${histFiltros()}${esAdm()?viajeDetalleFact():''}<div id="vb">${BODY.hist()}</div>`;
  }else{
    let ev=[];try{ev=API.movimientosComerciales(S.user.id);}catch(e){}
    body=`<h2 style="margin-bottom:10px">Facturas anuladas</h2>${agrTable(ags.filter(g=>g.estado==='ANULADA').slice().reverse(),false)}<h2 style="margin:22px 0 10px">Movimientos comerciales</h2><div class="card">${ev.length?`<ul class="feed">${ev.slice().reverse().slice(0,60).map(x=>`<li><span class="avatar" style="width:30px;height:30px;font-size:12px">${initials(x.por)}</span><div><b>${esc(x.por)}</b> · ${esc(x.accion)}<br><span class="mute">${esc(x.ref)}${x.campo&&x.nuevo?' · '+esc(x.campo)+': '+esc(x.anterior||'(vacío)')+' → '+esc(x.nuevo):''}${x.motivo?' · “'+esc(x.motivo)+'”':''}</span></div><span class="when">${fmtDT(x.en)}</span></li>`).join('')}</ul>`:'<div class="mute">Sin movimientos.</div>'}</div>`;
  }
  const tit=modo==='analista'?'ASISTENTE COMERCIAL':modo==='factcom'?'FACTURACIÓN COMERCIAL':'COMERCIAL';
  const sub=modo==='analista'?'Viajes ya liquidados: agrúpalos por cliente, genera el reporte, envíalo al cliente y registra el número de OT.':modo==='factcom'?'Agrupaciones con OT: registra número y fecha de factura, sube la foto de la factura y valida el cobro.':(canAct?'Selecciona uno o varios viajes del mismo cliente y factúralos. Agrupar es opcional.':'Consulta de gestión comercial.');
  return `<div class="inner" style="max-width:1500px">${pageHead(tit,sub)}
    ${modo==='factcom'?'<div class="alertbox info" style="margin-bottom:12px">La <b>OT</b> la registra el Asistente Comercial. Aquí solo aparecen las agrupaciones que ya tienen OT; si falta alguna, pídesela al Asistente.</div>':''}
    ${tabs(TK,tabsV,k,null)}<div style="height:14px"></div>${body}</div>`;
}
VIEWS.comercial=()=>comView('');
VIEWS.analista=()=>comView('analista');
VIEWS.factcom=()=>comView('factcom');


/* ---- Acciones (handlers) de este módulo ---- */
Object.assign(ACT,{
  async cbToggle(d){S.cb=S.cb===d.k?null:d.k;S.cbq='';render();const i=document.querySelector('.cb[data-cb="'+d.k+'"] .cb-q');if(i)i.focus();},
  async cbPick(d){if(d.k==='rtCat'){S.rtOrig='';S.rtDest='';}if(String(d.k).startsWith('m:')){const M=curModel();if(M)aplicarCampo(M,d.k.slice(2),d.v);}else S[d.k]=d.v;S.cb=null;S.cbq='';render();},
  async selClear(){S.sel=[];refrescarComercial();},
  async facturaOpen(){
    const ts=S.sel.map(id=>DB.trips.find(t=>t.id===id)).filter(Boolean);if(!ts.length)return;
    const esAsist=S.view==='analista',cli=ts[0].proyecto;
    if(ts.some(t=>t.proyecto!==cli)){toast(`No se pueden ${esAsist?'agrupar':'facturar'} juntos viajes de clientes diferentes.`,'err');return;}
    const sinTar=ts.filter(t=>nn(t.tarifaCliente)==null);
    if(sinTar.length){toast(`No se puede agrupar: ${sinTar.map(t=>'#'+t.id).join(', ')} sin tarifa de cobro. Aplica o crea la tarifa en Tarifas.`,'err');return;}
    const nombre=(PROYECTOS.find(p=>p.id===cli)||{}).cliente,ids=ts.map(t=>t.id),tot=ts.reduce((a,t)=>a+(nn(t.tarifaCliente)||0),0);
    formM({title:esAsist?(ts.length===1?'Agrupar viaje y generar OT':'Agrupar viajes y generar OT'):(ts.length===1?'Facturar un solo viaje':'Facturar viajes agrupados'),
      text:esAsist?`Cliente: <b>${esc(nombre)}</b> · ${ts.length} ${ts.length===1?'viaje':'viajes'}. Se crea el grupo; después generas el reporte para el cliente y registras la OT.`:`Cliente: <b>${esc(nombre)}</b> · ${ts.length} ${ts.length===1?'viaje (factura individual, sin agrupar)':'viajes (se facturan juntos)'}`,
      summary:miniTable(['Viaje','Ruta','Piloto','Tarifa'],ts.map(t=>[`<b>#${t.id}</b>`,rutaHTML(t),esc(J(t).piloto),nn(t.tarifaCliente)==null?'<span class="warnl">⚠ sin tarifa</span>':qfmt(t.tarifaCliente)]),['Total','','',qfmt(tot)]),
      fields:[],
      buttons:[{label:esAsist?'CREAR GRUPO':'CREAR AGRUPACIÓN',act:'facturaPrep',cls:'primary'}],
      id:cli,data:{}});
  },
  async facturaPrep(d){const r=await run(()=>API.prepararFactura(S.user.id,{cliente:d.id,viajeIds:S.sel.slice()}),g=>`Agrupación ${g.id} creada. Genera el reporte para el cliente y registra la OT cuando te la envíe.`,true);if(r.ok){S.sel=[];afterWrite();}},
  async facturaEditar(d){
    const g=DB.agrupaciones.find(x=>x.id===d.id);if(!g)return;
    formM({title:`Datos de factura · ${g.id}`,text:`${g.viajeIds.length} ${g.viajeIds.length===1?'viaje':'viajes'} · ${g.modalidad==='AGRUPADA'?'agrupados':'factura individual'} · OT ${esc((g.confirmacion&&(g.confirmacion.ot||g.confirmacion.referencia))||'—')}. Registra serie, número y fecha de la factura.`,
      fields:[{k:'serieFactura',label:'Serie de factura',req:1},{k:'numeroFactura',label:'Número de factura',req:1},{k:'fechaFactura',label:'Fecha de la factura',type:'date',req:1}],
      live:x=>faltantesEnvio(g.cliente,g.viajeIds,x.numeroFactura,x.fechaFactura,g.id,x.serieFactura),
      buttons:[{label:'GUARDAR',act:'facturaEditarGuardar',cls:'primary'}],
      id:g.id,data:{serieFactura:g.serieFactura||'',numeroFactura:g.numeroFactura||'',fechaFactura:g.fechaFactura||''}});
  },
  async facturaEditarGuardar(d){const m=S.modal.data;const r=await run(()=>API.actualizarFactura(S.user.id,d.id,m),`Factura ${d.id} actualizada (sigue preparada).`,true);if(r.ok)afterWrite();},
  async emitirOpen(d){
    const g=DB.agrupaciones.find(x=>x.id===d.id);if(!g)return;
    formM({title:`Registrar envío de la factura · ${g.numeroFactura}`,text:`Hazlo después de enviar la factura al cliente por correo. Se exige la captura o comprobante del envío y la referencia de la factura. Enviado a facturar: <b>${qfmt(g.importeEnviado)}</b>.`,
      fields:[{k:'fechaEmision',label:'Fecha de emisión',type:'date',req:1},{k:'importe',label:'Importe emitido (Q)',type:'number',req:1},{k:'evidencia',label:'Evidencia de emisión (UUID, serie/número o autorización)',req:1},{k:'archivo',label:'Captura de pantalla o comprobante del envío de la factura al cliente (imagen o PDF)',type:'file',req:1},{k:'motivoDiferencia',label:'Motivo si el importe difiere de lo enviado',type:'textarea'}],
      data:{fechaEmision:todayStr(),importe:g.importeEnviado,evidencia:'',archivo:'',motivoDiferencia:''},ok:'REGISTRAR ENVÍO',act:'emitirOk',id:g.id});
  },
  async emitirOk(d){const m=S.modal.data;const r=await run(()=>API.emitirFactura(S.user.id,d.id,{fechaEmision:m.fechaEmision,importe:m.importe,evidencia:m.evidencia,archivo:m.archivo,motivoDiferencia:m.motivoDiferencia}),`Envío de la factura ${d.id} registrado con su comprobante.`,true);if(r.ok)afterWrite();},
  async evidenciaVer(d){
    const g=DB.agrupaciones.find(x=>x.id===d.id);if(!g||!g.emision)return;
    const e=g.emision;
    formM({title:`Evidencia de emisión · ${g.numeroFactura}`,text:`Emitida el ${fmtDate(e.fecha)} · registrada por ${esc(e.por)} (${fmtDT(e.en)}) · importe ${qfmt(e.importe)}`,
      summary:`<div class="alertbox info"><b>Evidencia:</b> ${esc(e.evidencia)}${e.motivoDiferencia?`<br><b>Motivo de diferencia:</b> ${esc(e.motivoDiferencia)}`:''}</div>${e.archivo?(e.archivo.startsWith('data:image')?`<img src="${e.archivo}" alt="Factura" style="max-width:100%;border:1px solid var(--line);border-radius:8px">`:`<a class="btn" href="${e.archivo}" download="factura-${esc(g.numeroFactura)}.pdf">Descargar PDF adjunto</a>`):'<div class="mute">Sin archivo adjunto: solo referencia.</div>'}`,noCancel:true,ok:'Cerrar',act:'closeModal'});
  },
  async corregirOpen(d){formM({title:`Corregir factura · ${d.id}`,text:'La corrección conserva el número anterior y queda auditada.',fields:[{k:'numero',label:'Nuevo número de factura',req:1},{k:'motivo',label:'Motivo de la corrección',type:'textarea',req:1}],ok:'GUARDAR CORRECCIÓN',act:'corregirOk',id:d.id});},
  async corregirOk(d){const r=await run(()=>API.corregirFactura(S.user.id,d.id,S.modal.data.numero,S.modal.data.motivo),`Factura de ${d.id} corregida.`,true);if(r.ok)afterWrite();},
  async anularOpen(d){let g=null;try{g=API.agrupaciones(S.user.id).find(x=>x.id===d.id);}catch(e){}const prep=!!g&&g.fase==='PREPARADA';
    formM({title:`${prep?'Descartar':'Anular'} factura ${d.id}`,text:prep?'Se descarta la factura preparada y sus viajes quedan libres para agruparlos en otra factura. No llegó a enviarse a facturación.':'Los viajes quedan libres para facturarse de nuevo. La factura se conserva marcada como anulada.',fields:[{k:'motivo',label:prep?'Motivo del descarte':'Motivo de la anulación',type:'textarea',req:1}],ok:prep?'DESCARTAR FACTURA':'ANULAR FACTURA',okCls:'fix',act:'anularOk',id:d.id});},
  async anularOk(d){const r=await run(()=>API.anularAgrupacion(S.user.id,d.id,S.modal.data.motivo),`Factura ${d.id} anulada.`,true);if(r.ok)afterWrite();},
  async hsSub(d){S.tab.hs=d.v;render();},
  async agrAbrir(d){
    const g=DB.agrupaciones.find(x=>x.id===d.id);if(!g)return;
    const it=d.k==='pdf'?(g.pdfs||[])[Number(d.i)]:d.k==='rz'?(g.rechazos||[])[Number(d.i)]:d.k==='emision'?(g.emision?(String(g.emision.archivo||'').startsWith('data:')?{data:g.emision.archivo,nombre:g.id+'-envio'}:{url:g.emision.archivo}):null):d.k==='cobro'?(()=>{const c=(g.cobros||[])[Number(d.i)];return c?(c.url?{url:c.url}:(String(c.archivo||'').startsWith('data:')?{data:c.archivo,nombre:g.id+'-cobro'}:null)):null;})():(g.evidenciasAutorizacion||[])[Number(d.i)];if(!it)return;
    if(it.url){const u=urlSegura(it.url);if(u)window.open(u,'_blank','noopener');else toast('El archivo no tiene un enlace válido.','err');return;}
    if(it.data){try{expDescargar(await (await fetch(it.data)).blob(),it.nombre||(g.id+'.pdf'));}catch(e){toast('No se pudo abrir el archivo.','err');}return;}
    toast('El archivo no está disponible por ahora: vuelve a abrir la pantalla.','err');
  },
  async agrPanel(d){
    const g=DB.agrupaciones.find(x=>x.id===d.id);if(!g)return;
    let gg=g;try{gg=API.agrupaciones(S.user.id).find(x=>x.id===d.id)||g;}catch(e){}
    formM({title:`Agrupación ${gg.id} · reportes y OT del cliente`,summary:agrPanelHTML(gg),ancho:'900px',noCancel:true,ok:'Cerrar',act:'closeModal'});
  },
  async agrHistorial(d){
    const g=DB.agrupaciones.find(x=>x.id===d.id);if(!g)return;
    const h=(g.historial||[]).slice().reverse();
    formM({title:`Historial · ${g.id}${g.numeroFactura?' · '+g.numeroFactura:''}`,summary:h.length?`<ul class="feed">${h.map(x=>`<li><span class="avatar" style="width:30px;height:30px;font-size:12px">${initials(x.por)}</span><div><b>${esc(x.por)}</b> · ${esc(fmtDT(x.en))}<br>${esc(x.accion)}${x.de||x.a?`<div class="mute small">${esc(x.de||'—')} → ${esc(x.a||'—')}</div>`:''}</div></li>`).join('')}</ul>`:'<div class="mute">Esta agrupación aún no tiene movimientos registrados.</div>',ancho:'760px',noCancel:true,ok:'Cerrar',act:'closeModal'});
  },
  async agrPdfOpen(d){
    const g=DB.agrupaciones.find(x=>x.id===d.id);if(!g)return;const tipo=d.t;
    const ver=(g.pdfs||[]).filter(p=>p.tipo===tipo).length+1,fields=[],data={};
    if(tipo==='CLIENTE'){
      [['capacidad','Capacidad'],['ruta','Ruta'],['origen','Origen']].concat((hp('oc_ver_combustible')||hp('finanzas_ver'))?[['combustible','Tarifa de combustible']]:[]).forEach(([k,l])=>{fields.push({k,label:l,type:'check'});data[k]=false;});
    }
    if(ver>1){fields.push({k:'motivo',label:'Motivo de la nueva versión',type:'textarea',req:1});data.motivo='';}
    formM({title:`Reporte ${tipo==='INTERNO'?'interno':'para el cliente'} · ${g.id} · versión ${ver}`,text:tipo==='CLIENTE'?'Columnas obligatorias: Fecha, No. de viaje, Placa, Tipo de unidad, Estado, Tarifa y Cobro. Activa las opcionales que quieras incluir. No incluye datos internos.':'Detalle completo disponible para tu perfil, solo para revisión interna. No se envía al cliente.',fields,data,ok:'GENERAR PDF',act:'agrPdfOk',id:g.id,tipo});
  },
  async agrPdfOk(d){
    const m=S.modal.data||{},tipo=S.modal.tipo;
    const opc=['capacidad','ruta','origen','combustible'].filter(k=>m[k]);
    let pv;try{pv=API.agrPrevisualizar(S.user.id,d.id,{tipo,opcionales:opc});}catch(e){S.modal.err=e.message;render();return;}
    if(!pv.ok){const p=pv.pendientes[0];S.modal.err=p?`${OC_TARIFA_MSG}: #${p.noViaje||p.viajeId} (No. de Transporte ${p.shipment||'—'}). ${p.motivo} No se genera un reporte de cobro con datos incompletos.`:'La agrupación no tiene viajes.';render();return;}
    const g=DB.agrupaciones.find(x=>x.id===d.id),ver=((g&&g.pdfs)||[]).filter(p=>p.tipo===tipo).length+1;
    try{
      const pdf=await expAgrPdf(pv,ver);
      const r=await run(()=>API.agrRegistrarPdf(S.user.id,d.id,{tipo,opcionales:opc,huella:pv.huella,hash:pdf.hash,archivo:pdf.dataUrl,nombre:pdf.nombre,motivo:m.motivo||''}),`Reporte ${tipo==='INTERNO'?'interno':'del cliente'} de ${d.id} guardado (versión ${ver}).`,true);
      if(r.ok){afterWrite();ACT.agrPanel({id:d.id});}
    }catch(e){if(S.modal){S.modal.err=e.message;render();}else toast('No se pudo generar el PDF: '+e.message,'err');}
  },
  async agrEvidOpen(d){
    formM({title:`Evidencia de la OT · ${d.id}`,text:'Adjunta la captura del correo, la orden de trabajo o el mensaje con que el cliente entregó la OT. Queda con tu usuario, fecha y hora; no se puede reemplazar ni borrar.',fields:[{k:'archivo',label:'Captura o archivo (imagen o PDF)',type:'file',req:1},{k:'nota',label:'Nota (opcional)'}],data:{archivo:'',nota:''},ok:'ADJUNTAR EVIDENCIA',act:'agrEvidOk',id:d.id});
  },
  async agrEvidOk(d){const m=S.modal.data;const r=await run(()=>API.agrAdjuntarEvidencia(S.user.id,d.id,{archivo:m.archivo,nota:m.nota}),'Evidencia de la OT adjuntada.',true);if(r.ok){afterWrite();ACT.agrPanel({id:d.id});}},
  async agrRechazarOpen(d){
    formM({title:`El cliente rechazó el reporte · ${d.id}`,text:'Registra el rechazo del reporte vigente con su motivo (y la captura del cliente, si la tienes). La agrupación sigue en preparación para corregirla y generar una nueva versión; las versiones y evidencias anteriores se conservan.',fields:[{k:'motivo',label:'Motivo del rechazo',type:'textarea',req:1},{k:'archivo',label:'Captura o correo del cliente (opcional)',type:'file'}],data:{motivo:'',archivo:''},ok:'REGISTRAR RECHAZO',okCls:'fix',act:'agrRechazarOk',id:d.id});
  },
  async agrRechazarOk(d){const m=S.modal.data;const r=await run(()=>API.agrRechazarCliente(S.user.id,d.id,{motivo:m.motivo,archivo:m.archivo||undefined}),'Rechazo del cliente registrado. Corrige la agrupación y genera una nueva versión del reporte.',true);if(r.ok){afterWrite();ACT.agrPanel({id:d.id});}},
  async agrImportes(d){
    let r;try{r=API.agrImportes(S.user.id,d.id);}catch(e){toast(e.message,'err');return;}
    const fila=l=>`<tr><td>${esc(fmtDate(l.fecha))}</td><td>#${esc(l.noViaje)}</td><td>${esc(l.placa||'—')}</td><td style="text-align:right">${qfmt(l.tarifa)}</td>${r.combustibleVisible?`<td style="text-align:right">${qfmt(l.combustible)}</td>`:''}<td style="text-align:right">${qfmt(l.cobro)}</td></tr>`;
    const tabla=(ls,tot)=>ls.length?`<div class="xlwrap"><table class="xl"><thead><tr><th>Fecha</th><th>Viaje</th><th>Placa</th><th>Tarifa</th>${r.combustibleVisible?'<th>Tarifa de combustible</th>':''}<th>Cobro</th></tr></thead><tbody>${ls.map(fila).join('')}</tbody><tfoot><tr><td colspan="${r.combustibleVisible?5:4}"><b>Total</b></td><td style="text-align:right"><b>${qfmt(tot)}</b></td></tr></tfoot></table></div>`:'<div class="mute">Sin líneas.</div>';
    const dif=r.diferencias.length?`<div class="alertbox warn" style="margin:8px 0"><b>Atención:</b> ${r.confirmada?'después de la OT':'respecto del reporte generado'} hay diferencias con el tarifario vigente. La agrupación NO se modifica; se conserva el importe autorizado.<ul>${r.diferencias.map(x=>`<li>#${esc(x.noViaje||x.viajeId)}: ${esc(x.motivo)}${x.autorizado!=null?` (autorizado ${qfmt(x.autorizado)} · vigente ${qfmt(x.vigente)})`:''}</li>`).join('')}</ul></div>`:'';
    formM({title:`Importes y tarifas · ${d.id}${r.numeroFactura?' · '+r.numeroFactura:''}`,summary:`${dif}${r.pdfVersion?`<h3 style="margin:6px 0">Autorizado por el cliente — reporte v${r.pdfVersion}${r.confirmada?'':' (aún sin confirmar)'}</h3>${tabla(r.autorizadas,r.totalAutorizado)}`:'<div class="mute">Todavía no hay un reporte del cliente generado.</div>'}<h3 style="margin:12px 0 6px">Tarifario vigente hoy (solo consulta)</h3>${tabla(r.vigentes,r.totalVigente)}${r.facturado?`<h3 style="margin:12px 0 6px">Facturado</h3><div>Total: <b>${qfmt(r.facturado.total)}</b></div>`:''}`,ancho:'980px',noCancel:true,ok:'Cerrar',act:'closeModal'});
  },
  async agrConfirmarOpen(d){
    formM({title:`Registrar OT del cliente · ${d.id}`,text:'Escribe el número de OT que entregó el cliente. Quedan tu usuario, la fecha y la hora, la evidencia y la versión del reporte. Con la OT, Facturación puede continuar.',fields:[{k:'ot',label:'Número de OT',req:1}],data:{ot:''},ok:'REGISTRAR OT',okCls:'ok',act:'agrConfirmarOk',id:d.id});
  },
  async agrConfirmarOk(d){const r=await run(()=>API.confirmarCliente(S.user.id,d.id,{ot:S.modal.data.ot}),`Agrupación ${d.id}: OT registrada. Facturación ya puede continuar.`,true);if(r.ok){afterWrite();}},
  async agrRecibir(d){const r=await run(()=>API.enviarFactura(S.user.id,d.id),g=>`Agrupación ${g.id} en facturación (factura ${g.numeroFactura}). Registra el envío de la factura con su comprobante cuando la envíes.`);if(r.ok)afterWrite();},
  async agrDetalle(d){
    const g=DB.agrupaciones.find(x=>x.id===d.id);if(!g)return;
    const rows=g.viajeIds.map(i=>{const t=DB.trips.find(x=>x.id===i),j=J(t);return [`<b>#${i}</b>`,rutaHTML(t),esc(j.piloto),g.importesViaje&&g.importesViaje[i]!=null?qfmt(g.importesViaje[i]):(nn(t.tarifaCliente)!=null?qfmt(t.tarifaCliente):sinReg)];});
    formM({title:`Factura ${g.id}`,text:`Cliente: <b>${esc((PROYECTOS.find(p=>p.id===g.cliente)||{}).cliente)}</b> · ${ETAPA_L[etapaAgr(g)]}${g.numeroFactura?' · Nº '+esc(g.numeroFactura):''}`,summary:miniTable(['Viaje','Ruta','Piloto','Importe'],rows,['Total','','',g.fase==='PREPARADA'?'sin enviar':qfmt(g.importeEnviado)]),noCancel:true,ok:'Cerrar',act:'closeModal'});
  },
  async factFase(d){S.tab.factFase=d.v;render();},
  async fcAddFecha(){const el=$('#fcNueva');if(el&&el.value&&!S.fcFechas.includes(el.value)){S.fcFechas=[...S.fcFechas,el.value].sort();render();}},
  async fcQuitarFecha(d){S.fcFechas=S.fcFechas.filter(x=>x!==d.f);render();},
  async exportFactXlsx(d,el){
    if(el)el.disabled=true;
    try{const r=expFactXlsx();toast(`Excel descargado: ${r.facturas.length} ${r.facturas.length===1?'factura':'facturas'} · ${r.viajes.length} ${r.viajes.length===1?'viaje':'viajes'}.`);}
    catch(e){toast(e.message==='SIN_DATOS'?'No hay nada que exportar con estos filtros.':'No se pudo generar el Excel: '+e.message,'err');}
    if(el)el.disabled=false;
  },
  async exportFactPdf(d,el){
    if(el){el.disabled=true;el.dataset.t=el.textContent;el.textContent='Generando…';}
    try{const r=await expFactPdf();toast(`PDF descargado: ${r.facturas.length} ${r.facturas.length===1?'factura':'facturas'} · ${r.viajes.length} ${r.viajes.length===1?'viaje':'viajes'}.`);}
    catch(e){toast(e.message==='SIN_DATOS'?'No hay nada que exportar con estos filtros.':'No se pudo generar el PDF: '+e.message,'err');}
    if(el){el.disabled=false;el.textContent=el.dataset.t;}
  },
  async fcLimpiar(){Object.assign(S,{fcViaje:'',fcCli:'',fcPcat:'',fcMes:'',fcSem:'',fcFecha:'',fcDesde:'',fcHasta:'',fcFechas:[],fcQ:'',fcEstado:'ENV',fcBase:'envio',sortF:null});render();},
  async tarifaOpen(d){
    const t=d.id?DB.tarifas.find(x=>x.id===d.id):null;
    if(t){
      formM({title:`Editar tarifa ${t.id}`,text:`${esc((PROYECTOS.find(p=>p.id===t.cliente)||{}).cliente)} · ${esc(t.proyecto)} · ${esc(rutaTxt(t.rutaId))} · ${esc(t.capacidad)}.<br>Cambiar la tarifa NO modifica el importe de viajes ya tarifados o facturados: conservan su importe.`,
        fields:[{k:'importe',label:'Importe cliente (Q)',type:'number',req:1},{k:'qDieselPactado',label:'Q diésel pactado cliente (opcional · activa el ajuste por combustible)',type:'number'},{k:'combustiblePct',label:'% de combustible cliente (opcional · 0 a 100)',type:'number'},{k:'importeOpl',label:'Importe proveedor / OPL (Q, opcional)',type:'number'},{k:'dieselPactadoOpl',label:'Q diésel pactado proveedor (opcional)',type:'number'},{k:'combustiblePctOpl',label:'% de combustible proveedor (opcional · 0 a 100)',type:'number'},{k:'vigenteDesde',label:'Vigente desde',type:'date',req:1},{k:'vigenteHasta',label:'Vigente hasta (opcional)',type:'date'},{k:'motivo',label:'Motivo del cambio (opcional)',type:'textarea'}],
        data:{importe:t.importe,qDieselPactado:t.qDieselPactado==null?'':t.qDieselPactado,combustiblePct:t.combustiblePct==null?'':t.combustiblePct,importeOpl:t.importeOpl==null?'':t.importeOpl,dieselPactadoOpl:t.dieselPactadoOpl==null?'':t.dieselPactadoOpl,combustiblePctOpl:t.combustiblePctOpl==null?'':t.combustiblePctOpl,vigenteDesde:t.vigenteDesde,vigenteHasta:t.vigenteHasta,motivo:''},ok:'GUARDAR CAMBIOS',act:'tarifaSave',id:t.id});
    }else{
      formM({title:'Nueva tarifa',text:'La tarifa aplica solo a la combinación cliente, proyecto, ruta y capacidad que elijas. Aparecen las rutas validadas (en tarifación), las que esperan aprobación y las activas (para otra capacidad).',
        fields:[{k:'cliente',label:'Cliente',type:'select',req:1,optsFn:()=>optsClientes(),ph:'Selecciona el cliente'},{k:'proyecto',label:'Proyecto',type:'select',req:1,optsFn:optsProyectos,ph:'Primero elige el cliente'},
          {k:'rutaId',label:'Ruta',type:'select',req:1,optsFn:x=>optRutaTarifa(x.cliente,x.proyecto),ph:'Primero elige el cliente y el proyecto',hint:'<span style="color:var(--warn)">Ámbar</span>: ruta sin tarifa · <span style="color:var(--fix)">naranja</span>: le falta tarifa para alguna capacidad de la flota.'},
          {k:'capacidad',label:'Capacidad',type:'select',req:1,optsFn:()=>capsCat().map(c=>({id:c,nombre:c})),ph:'Selecciona la capacidad'},
          {k:'importe',label:'Importe cliente (Q)',type:'number',req:1},{k:'qDieselPactado',label:'Q diésel pactado cliente (opcional · activa el ajuste por combustible)',type:'number'},{k:'combustiblePct',label:'% de combustible cliente (opcional · 0 a 100)',type:'number'},{k:'importeOpl',label:'Importe proveedor / OPL (Q, opcional)',type:'number'},{k:'dieselPactadoOpl',label:'Q diésel pactado proveedor (opcional)',type:'number'},{k:'combustiblePctOpl',label:'% de combustible proveedor (opcional · 0 a 100)',type:'number'},{k:'vigenteDesde',label:'Vigente desde',type:'date',req:1},{k:'vigenteHasta',label:'Vigente hasta (opcional)',type:'date'}],
        data:{cliente:optsClientes().length===1?optsClientes()[0].id:'',proyecto:'',rutaId:'',capacidad:'',importe:'',qDieselPactado:'',combustiblePct:'',importeOpl:'',dieselPactadoOpl:'',combustiblePctOpl:'',vigenteDesde:todayStr(),vigenteHasta:''},rerender:['cliente','proyecto'],ok:'GUARDAR TARIFA',act:'tarifaSave',id:''});
    }
  },
  /* Desde Rutas: abre la tarifa ya apuntando a la ruta que espera tarifación. */
  async tarifaRutaOpen(d){
    const r=DB.rutas.find(x=>x.id===d.id);if(!r){toast('Ruta no encontrada.','err');return;}
    await ACT.tarifaOpen({});
    if(!S.modal)return;
    S.modal.data.cliente=r.cliente;S.modal.data.proyecto=r.proyecto;S.modal.data.rutaId=r.id;
    if(!S.modal.data.capacidad)S.modal.data.capacidad=capsCat()[0]||'';
    render();
  },
  async tarifaSave(d){const m=S.modal.data;const r=await run(()=>d.id?API.editarTarifa(S.user.id,d.id,m):API.crearTarifa(S.user.id,m),t=>d.id?`Tarifa ${t.id} actualizada.`:`Tarifa ${t.id} creada.`,true);if(r.ok)afterWrite();},
  async tarifaEstado(d){const t=DB.tarifas.find(x=>x.id===d.id);if(!t)return;await run(()=>API.cambiarEstadoTarifa(S.user.id,d.id,!t.activa,''),x=>`Tarifa ${x.id} ${x.activa?'activada':'desactivada'}. El historial se conserva.`);render();},
  async cliLimpiar(){S.cliFiltro='';render();},
  async fcQuitarViaje(){S.fcViaje='';render();},
  async clienteOpen(d){
    const c=d.id?DB.clientes.find(x=>x.id===d.id):null;
    formM({title:c?`Editar cliente ${c.id}`:'Nuevo cliente',text:'Los datos fiscales que no tengas quedan como PENDIENTES: no se inventan. Un cliente nuevo no tiene rutas todavía; se asocian en Rutas.',
      fields:[{k:'id',label:'Código del cliente (ej. FRITOLAY)',req:1,ro:!!c},{k:'nombre',label:'Nombre corto',req:1},...(esAdm()?[]:[{k:'cliente',label:'Cliente (como aparece en la lista CLIENTES del catálogo)',req:1,hint:'Si es un cliente nuevo, agrégalo también a la hoja CATALOGO.'}]),
        {k:'nit',label:'Identificador fiscal (NIT) · pendiente si lo dejas vacío'},{k:'direccionFiscal',label:'Dirección fiscal'},{k:'correoFacturacion',label:'Correo de facturación',type:'email'},{k:'contacto',label:'Contacto comercial'},{k:'telefono',label:'Teléfono'},{k:'creditoDias',label:'Días de crédito',type:'number'},
        {k:'proyectos',label:'Proyectos del cliente',type:'addmulti',req:1,opts:CAT.proyectos.map(p=>({id:p,nombre:p}))},{k:'observaciones',label:'Observaciones',type:'textarea'},{k:'activo',label:'Cliente activo',type:'check'}],
      data:c?{id:c.id,nombre:c.nombre,cliente:c.cliente,nit:c.nit||'',direccionFiscal:c.direccionFiscal||'',correoFacturacion:c.correoFacturacion||'',contacto:c.contacto||'',telefono:c.telefono||'',creditoDias:c.creditoDias||'',proyectos:c.proyectos.slice(),observaciones:c.observaciones||'',activo:c.activo!==false}
        :{id:'',nombre:'',cliente:'',nit:'',direccionFiscal:'',correoFacturacion:'',contacto:'',telefono:'',creditoDias:'',proyectos:[],observaciones:'',activo:true},
      ok:c?'GUARDAR CAMBIOS':'CREAR CLIENTE',act:'clienteSave',id:d.id||''});
  },
  async clienteSave(d){const m=S.modal.data;
    if(esAdm()){                                   /* validación previa: se indica qué falta y no se guarda */
      const falta=[];if(!String(m.id||'').trim())falta.push('Código del cliente');if(!String(m.nombre||'').trim())falta.push('Nombre corto');if(!(m.proyectos||[]).length)falta.push('Proyectos del cliente (al menos uno)');
      if(falta.length){S.modal.err='Falta información obligatoria: '+falta.join(', ')+'. Completa los campos marcados con * antes de guardar.';render();return;}
      if(!String(m.cliente||'').trim())m.cliente=String(m.nombre).trim().toUpperCase().slice(0,60);   /* el valor «cliente» sigue existiendo en la base; se genera desde el nombre */
    }
    const r=await run(()=>API.guardarCliente(S.user.id,Object.assign({},m,{existente:!!d.id})),id=>d.id?`Cliente ${id} actualizado.`:`Cliente ${id} creado: ya aparece en los selectores.`,true);if(r.ok)afterWrite();else if(esAdm()&&S.modal&&S.modal.err){S.modal.err=S.modal.err.replace(/El cliente "[^"]*" del catálogo ya está registrado\./,'Ya existe un cliente con ese nombre.');render();}},
  async clienteEstado(d){const c=DB.clientes.find(x=>x.id===d.id);if(!c)return;await run(()=>API.guardarCliente(S.user.id,Object.assign({},c,{existente:true,activo:c.activo===false})),`Cliente ${c.id} ${c.activo===false?'activado':'desactivado'}.`);render();}
});
