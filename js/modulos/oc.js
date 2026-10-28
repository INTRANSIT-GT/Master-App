/* =====================================================================
   MÓDULO: ÓRDENES DE COMPRA
   Sección del módulo COMERCIAL (no es otra aplicación ni sustituye a Facturación). Gerencia Comercial y Analista
   Comercial agrupan viajes aceptados de un cliente y proyecto —solo con tarifa de cobro válida—, generan el PDF de
   la orden, registran su envío al cliente y, cuando el cliente la acepta, Facturación continúa con el flujo de
   facturas de siempre (una factura por orden). Las reglas viven en el motor (engine.js): aquí solo se muestran.
   ===================================================================== */

const OC_GESTION=['oc_preparar','oc_enviar','oc_responder','oc_corregir'];
const OC_TABS=[{k:'prep',l:'Preparar orden'},{k:'PREPARADA',l:'Preparadas'},{k:'ENVIADA',l:'Enviadas'},{k:'ACEPTADA',l:'Confirmadas'},{k:'RECHAZADA',l:'Rechazadas'},{k:'ANULADA',l:'Anuladas'},{k:'REEMPLAZADA',l:'Reemplazadas'}];
const OC_TONO={PREPARADA:'neutral',ENVIADA:'progress',ACEPTADA:'done',RECHAZADA:'alert',ANULADA:'neutral',REEMPLAZADA:'neutral'};
const OC_ETAPA_L={EN_FACTURACION:'Factura en preparación',FACTURADA:'Facturada',COBRADA:'Cobrada'};
function ocLista(){try{return API.ordenesCompra(S.user.id);}catch(e){return [];}}
function ocEstadoChip(o){const e=ocEtapa(o);return chip(OC_TONO[o.estado]||'neutral',OC_ESTADOS[o.estado]||o.estado)+(e!==o.estado&&OC_ETAPA_L[e]?' '+chip('done',OC_ETAPA_L[e]):'');}
/* Clientes con los que se puede preparar una orden: todos los activos (el alcance real lo decide el motor). */
const ocClientes=()=>PROYECTOS.filter(p=>p.activo!==false).map(p=>({id:p.id,nombre:p.cliente||p.nombre}));
const ocProyectos=()=>S.ocCli?(PROYECTOS_X[S.ocCli]||[]):[];
function ocDisp(){
  if(!S.ocCli||!S.ocPcat)return [];
  try{return API.ocDisponibles(S.user.id,{cliente:S.ocCli,proyecto:S.ocPcat});}catch(e){return [];}
}
const ocColsSel=()=>(S.ocCols||[]).filter(c=>OC_COL_OPC[c]&&(c!=='combustible'||hp('oc_ver_combustible')));

/* ---- Preparar ---- */
function ocPrepararHTML(){
  const cli=S.ocCli||'';
  if(S.ocPcat&&!ocProyectos().includes(S.ocPcat))S.ocPcat='';
  const pc=S.ocPcat||'';
  const filtros=`<div class="row2" style="margin:0 0 12px;grid-template-columns:1fr 1fr"><select data-flt="ocCli" aria-label="Cliente"><option value="">Selecciona el cliente</option>${ocClientes().map(c=>`<option value="${esc(c.id)}" ${cli===c.id?'selected':''}>${esc(c.nombre)}</option>`).join('')}</select><select data-flt="ocPcat" aria-label="Proyecto" ${cli?'':'disabled'}><option value="">Selecciona el proyecto</option>${ocProyectos().map(p=>`<option ${pc===p?'selected':''}>${esc(p)}</option>`).join('')}</select></div>`;
  if(!cli||!pc)return filtros+'<div class="alertbox info">Elige el cliente y el proyecto para ver sus viajes aceptados. Una orden de compra es de un solo cliente y un solo proyecto.</div>';
  const disp=ocDisp(),ok=disp.filter(x=>x.tipo==='OK'),pend=disp.filter(x=>x.tipo==='PEND'),enOtra=disp.filter(x=>x.tipo==='NO'&&x.ocId).length;
  S.ocSel=(S.ocSel||[]).filter(id=>ok.some(x=>x.viajeId===id));
  const sel=ok.filter(x=>S.ocSel.includes(x.viajeId)),total=r2(sel.reduce((a,x)=>a+x.tarifa,0)),anio=ocUsaAnio(ok);
  const todos=ok.length>0&&sel.length===ok.length;
  const filas=ok.map(x=>`<tr><td><input type="checkbox" data-ocsel="${esc(x.viajeId)}" ${S.ocSel.includes(x.viajeId)?'checked':''} aria-label="Seleccionar el viaje ${esc(x.viajeId)}"></td><td>${esc(ocCelda(x,'semana',anio))}</td><td>${esc(x.fecha)}</td><td>${esc(x.hora||'—')}</td><td>#${esc(x.viajeId)}</td><td>${esc(x.shipment||'—')}</td><td>${esc(x.placa||'—')}</td><td>${esc(x.tipoUnidad||'—')}</td><td>${esc(x.estado)}</td><td style="text-align:right">${esc(ocQ(x.tarifa))}</td></tr>`).join('');
  const tabla=ok.length?`<div class="xlwrap" style="max-height:46vh"><table class="xl" style="min-width:900px"><thead><tr><th><input type="checkbox" data-ocselall="1" ${todos?'checked':''} aria-label="Seleccionar todos"></th><th>Semana</th><th>Fecha planificada</th><th>Hora planificada</th><th>Viaje</th><th>Shipment</th><th>Placa</th><th>Tipo de unidad</th><th>Estado</th><th>Tarifa de cobro</th></tr></thead><tbody>${filas}</tbody></table></div>`:'<div class="mute">No hay viajes aceptados con tarifa válida para este cliente y proyecto.</div>';
  const pendHTML=pend.length?`<div class="card" style="margin:14px 0;border-left:4px solid #EC220F"><h3 style="margin:0 0 6px">${esc(OC_TARIFA_MSG)} (${pend.length})</h3><div class="mute small" style="margin-bottom:8px">Estos viajes no pueden incluirse en una orden de compra hasta que el responsable de tarifas les asigne una tarifa válida.</div><div class="xlwrap" style="max-height:30vh"><table class="xl" style="min-width:760px"><thead><tr><th>No. de viaje</th><th>Número de Transporte</th><th>Cliente</th><th>Proyecto</th><th>Fecha plan</th><th>Motivo</th></tr></thead><tbody>${pend.map(x=>`<tr><td>#${esc(x.noViaje||x.viajeId)}</td><td>${esc(x.shipment||'—')}</td><td>${esc(ocClienteNombre(cli))}</td><td>${esc(pc)}</td><td>${esc(x.fecha)}</td><td>${esc(x.motivo)}</td></tr>`).join('')}</tbody></table></div></div>`:'';
  const opc=ocColsSel();
  const cols=`<div class="card" style="margin:14px 0"><b>Columnas opcionales del PDF</b><div class="chips" style="margin-top:8px">${Object.entries(OC_COL_OPC).filter(([k])=>k!=='combustible'||hp('oc_ver_combustible')).map(([k,l])=>`<label class="chip" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-occol="${k}" ${opc.includes(k)?'checked':''}> ${esc(l)}</label>`).join('')}</div><div class="mute small" style="margin-top:6px">Siempre incluye: ${OC_COL_OBLIG.map(c=>c[1]).join(', ')}.</div></div>`;
  let prev='';
  if(S.ocPrevOn&&sel.length){
    let r=null,err='';
    try{r=API.ocPrevisualizar(S.user.id,{cliente:cli,proyecto:pc,viajeIds:S.ocSel,columnas:opc});}catch(e){err=e.message;}
    if(r){
      const cs=ocColumnas(r.columnas),an=ocUsaAnio(r.lineas);
      prev=`<div class="card" style="margin:14px 0"><h3 style="margin:0 0 4px">Vista previa · ${esc(r.clienteNombre)} · ${esc(r.proyecto)}</h3><div class="mute small" style="margin-bottom:8px">${r.lineas.length} viaje(s) · Total ${esc(ocQ(r.total))}${r.ok?'':' · <b>la selección tiene problemas</b>'}</div>${r.pendientes.concat(r.errores).map(x=>`<div class="alertbox warn">${esc(x.mensaje||'')} ${esc(x.motivo)}</div>`).join('')}<div class="xlwrap" style="max-height:40vh"><table class="xl"><thead><tr>${cs.map(c=>`<th>${esc(c[1])}</th>`).join('')}</tr></thead><tbody>${r.lineas.map(l=>`<tr>${cs.map(c=>`<td${c[0]==='tarifa'||c[0]==='combustible'?' style="text-align:right"':''}>${esc(ocCelda(l,c[0],an))}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr>${cs.map((c,i)=>`<td><b>${i===0?'Total':c[0]==='tarifa'?esc(ocQ(r.total)):''}</b></td>`).join('')}</tr></tfoot></table></div></div>`;
    }else prev=`<div class="alertbox warn" style="margin:14px 0">${esc(err||'No se pudo armar la vista previa.')}</div>`;
  }
  const barra=`<div class="exportbar" style="margin:14px 0"><div><b>${sel.length}</b> viaje(s) seleccionado(s) · Total <b>${esc(ocQ(total))}</b>${enOtra?` <span class="mute small">· ${enOtra} viaje(s) ya están en otra orden</span>`:''}</div><div class="exportbtns"><button class="btn" data-act="ocPrev" ${sel.length?'':'disabled'}>${S.ocPrevOn?'Ocultar vista previa':'Vista previa'}</button><button class="btn primary" data-act="ocGenerar" ${sel.length?'':'disabled'}>Generar orden de compra</button></div></div>`;
  return filtros+tabla+pendHTML+cols+barra+prev;
}

/* ---- Listas por estado ---- */
function ocListaHTML(est){
  const todas=ocLista().filter(o=>o.estado===est).slice().reverse();
  const aviso='';
  if(!todas.length)return aviso+'<div class="mute">No hay órdenes de compra en este estado.</div>';
  const fila=o=>{
    const g=o.agrupacionId?(DB.agrupaciones||[]).find(x=>x.id===o.agrupacionId&&x.estado==='ACTIVA'):null;
    const acc=[`<button class="btn sm" data-act="ocDetalle" data-id="${o.id}">Ver</button>`];
    if((o.documentos||[]).length)acc.push(`<button class="btn sm" data-act="ocPdf" data-id="${o.id}">PDF</button>`);
    if(o.estado==='PREPARADA'&&hp('oc_preparar'))acc.push(`<button class="btn sm" data-act="ocPdfGen" data-id="${o.id}">${(o.documentos||[]).length?'Nueva versión del PDF':'Generar PDF'}</button>`);
    if(o.estado==='PREPARADA'&&hp('oc_enviar')&&(o.documentos||[]).length)acc.push(`<button class="btn sm primary" data-act="ocEnviarOpen" data-id="${o.id}">Registrar envío</button>`);
    if(o.estado==='ENVIADA'&&hp('oc_responder'))acc.push(`<button class="btn sm primary" data-act="ocConfirmarOpen" data-id="${o.id}">Confirmado</button><button class="btn sm" data-act="ocRechazarOpen" data-id="${o.id}">Rechazado</button>`);
    if(o.estado==='ACEPTADA'&&hp('comercial_agrupar')&&!g)acc.push(`<button class="btn sm primary" data-act="ocFacturar" data-id="${o.id}">Preparar factura</button>`);
    if(['ENVIADA','ACEPTADA','RECHAZADA'].includes(o.estado)&&!g&&hp('oc_corregir')&&hp('oc_preparar'))acc.push(`<button class="btn sm" data-act="ocCorregirOpen" data-id="${o.id}">${o.estado==='RECHAZADA'?'Gestionar rechazo / nueva versión':'Corregir / nueva versión'}</button>`);
    if(o.estado!=='ANULADA'&&o.estado!=='REEMPLAZADA'&&!g&&((o.estado==='PREPARADA'&&hp('oc_preparar'))||(o.estado!=='PREPARADA'&&hp('oc_corregir'))))acc.push(`<button class="btn sm" data-act="ocAnularOpen" data-id="${o.id}">Anular</button>`);
    return `<tr><td><b>${esc(o.id)}</b></td><td>${esc(o.clienteNombre)}</td><td>${esc(o.proyecto)}</td><td>${o.lineas.length}</td><td style="text-align:right">${esc(ocQ(o.total))}</td><td>${esc(o.preparadoPor)}<div class="mute small">${esc(fmtDT(o.preparadoEn))}</div></td><td>${ocEstadoChip(o)}</td><td>${g?esc(g.id)+(g.numeroFactura?' · '+esc(g.numeroFactura):''):'<span class="mute">—</span>'}</td><td><div class="row" style="gap:6px;flex-wrap:wrap">${acc.join('')}</div></td></tr>`;
  };
  return aviso+`<div class="xlwrap"><table class="xl" style="min-width:980px"><thead><tr><th>Orden</th><th>Cliente</th><th>Proyecto</th><th>Viajes</th><th>Total</th><th>Preparó</th><th>Estado</th><th>Factura</th><th></th></tr></thead><tbody>${todas.map(fila).join('')}</tbody></table></div>`;
}

BODY.oc=()=>{
  const k=ocTabKey();
  return k==='prep'?ocPrepararHTML():ocListaHTML(k);
};
function ocTabKey(){
  const L=ocTabsVisibles();
  return L.some(t=>t.k===S.tab.oc)?S.tab.oc:L[0].k;
}
function ocTabsVisibles(){
  const n=ocLista(),cnt=e=>n.filter(o=>o.estado===e).length;
  /* Quien solo consulta (Facturación) ve únicamente las confirmadas; el ciclo completo es de Comercial. */
  const solo=!OC_GESTION.some(hp);
  return OC_TABS.filter(t=>(t.k!=='prep'||hp('oc_preparar'))&&(!solo||t.k==='ACEPTADA')).map(t=>t.k==='prep'?t:Object.assign({},t,{l:`${t.l} (${cnt(t.k)})`}));
}
/* Las órdenes de compra NO son un módulo aparte: son una pestaña del espacio COMERCIAL (ver VIEWS.comercial). */
function ocPanelHTML(){
  const L=ocTabsVisibles(),k=ocTabKey();
  const nota=hp('oc_preparar')?'Agrupa viajes aceptados con tarifa válida, genera la orden en PDF, regístrala como enviada y marca «Confirmado» cuando el cliente la acepte (con su evidencia).':'Órdenes de compra confirmadas por Comercial: continúa desde aquí con «Preparar factura» y el flujo de Facturación.';
  return `<div class="mute" style="margin:0 0 10px">${nota}</div>${tabs('oc',L,k,null)}<div style="height:14px"></div><div id="vb">${BODY.oc()}</div>`;
}

/* ---- Detalle ---- */
function ocDetalleHTML(o){
  const cs=ocColumnas(o.columnas),an=ocUsaAnio(o.lineas);
  const docs=(o.documentos||[]).map(d=>`v${d.version} · ${esc(fmtDT(d.en))} · ${esc(d.por)}${d.motivo?' · '+esc(d.motivo):''}`).join('<br>')||'<span class="mute">sin PDF</span>';
  const hist=(o.historial||[]).map(h=>`${esc(fmtDT(h.en))} · ${esc(h.por)} · ${esc(h.accion)}`).join('<br>');
  const tbl=`<div class="xlwrap" style="max-height:34vh"><table class="xl"><thead><tr>${cs.map(c=>`<th>${esc(c[1])}</th>`).join('')}</tr></thead><tbody>${o.lineas.map(l=>`<tr>${cs.map(c=>`<td>${esc(ocCelda(l,c[0],an))}</td>`).join('')}</tr>`).join('')}</tbody><tfoot><tr>${cs.map((c,i)=>`<td><b>${i===0?'Total':c[0]==='tarifa'?esc(ocQ(o.total)):''}</b></td>`).join('')}</tr></tfoot></table></div>`;
  return `<dl class="kv" style="margin-bottom:10px">${kvr('Cliente',esc(o.clienteNombre))}${kvr('Proyecto',esc(o.proyecto))}${kvr('Estado',ocEstadoChip(o))}${kvr('Total',esc(ocQ(o.total)))}${kvr('Envío',o.envio?esc(fmtDT(o.envio.en))+' · '+esc(o.envio.por)+(o.envio.destinatario?' · '+esc(o.envio.destinatario):''):'<span class="mute">no enviada</span>')}${kvr('Respuesta del cliente',o.respuesta?esc(OC_ESTADOS[o.respuesta.resultado])+' · '+esc(o.respuesta.por)+(o.respuesta.referencia?' · '+esc(o.respuesta.referencia):'')+(o.respuesta.motivo?' · '+esc(o.respuesta.motivo):''):'<span class="mute">pendiente</span>')}${o.reemplazaA?kvr('Versión',esc('v'+(o.version||2)+' · reemplaza a '+o.reemplazaA)):''}${o.reemplazadaPor?kvr('Reemplazada por',esc(o.reemplazadaPor)+(o.correccion?' · '+esc(o.correccion.por)+' · '+esc(fmtDT(o.correccion.en))+' · '+esc(o.correccion.motivo):'')):''}${kvr('Documentos',docs)}${kvr('Historial',hist)}</dl>${tbl}`;
}

/* ---- Acciones ---- */
Object.assign(ACT,{
  /* casillas: viajes, «todos» y columnas opcionales */
  ocCambio(t){
    if(t.dataset.ocsel){const id=t.dataset.ocsel;S.ocSel=t.checked?[...new Set([...(S.ocSel||[]),id])]:(S.ocSel||[]).filter(x=>x!==id);}
    else if(t.dataset.ocselall){const ok=ocDisp().filter(x=>x.tipo==='OK').map(x=>x.viajeId);S.ocSel=t.checked?ok:[];}
    else if(t.dataset.occol){const c=t.dataset.occol;S.ocCols=t.checked?[...new Set([...(S.ocCols||[]),c])]:(S.ocCols||[]).filter(x=>x!==c);}
    render();
  },
  async ocPrev(){S.ocPrevOn=!S.ocPrevOn;render();},
  async ocGenerar(){
    const d={cliente:S.ocCli,proyecto:S.ocPcat,viajeIds:(S.ocSel||[]).slice(),columnas:ocColsSel()};
    const r=await run(()=>API.ocGenerar(S.user.id,d));
    if(!r.ok)return;
    const oc=r.r;
    try{
      const pdf=await expOcPdf(oc,1);
      await API.ocRegistrarPdf(S.user.id,oc.id,{archivo:pdf.dataUrl,hash:pdf.hash,nombre:pdf.nombre,columnas:oc.columnas});
      toast(`Orden de compra ${oc.id} generada y PDF guardado.`);
    }catch(e){
      toast(`La orden ${oc.id} se generó, pero su PDF no se pudo guardar${e&&e.message?': '+e.message:''}. Genéralo desde «Preparadas».`,'err');
    }
    S.ocSel=[];S.ocPrevOn=false;S.tab.oc='PREPARADA';render();
  },
  async ocPdfGen(d){
    const oc=ocLista().find(x=>x.id===d.id);if(!oc)return;
    const ver=(oc.documentos||[]).length+1;
    if(ver===1)return ACT.ocPdfGenOk({id:d.id});
    formM({title:`Nueva versión del PDF · ${oc.id}`,text:'La versión anterior se conserva. Indica por qué se genera otra.',fields:[{k:'motivo',label:'Motivo',type:'textarea',req:1}],ok:'GENERAR PDF',act:'ocPdfGenOk',id:oc.id});
  },
  async ocPdfGenOk(d){
    const oc=ocLista().find(x=>x.id===d.id);if(!oc)return;
    const ver=(oc.documentos||[]).length+1,motivo=S.modal&&S.modal.data?S.modal.data.motivo:'';
    try{
      const pdf=await expOcPdf(oc,ver);
      const r=await run(()=>API.ocRegistrarPdf(S.user.id,oc.id,{archivo:pdf.dataUrl,hash:pdf.hash,nombre:pdf.nombre,columnas:oc.columnas,motivo}),`PDF de ${oc.id} guardado (versión ${ver}).`,true);
      if(r.ok)afterWrite();
    }catch(e){if(S.modal){S.modal.err=e.message;render();}else toast('No se pudo generar el PDF: '+e.message,'err');}
  },
  async ocPdf(d){
    const oc=ocLista().find(x=>x.id===d.id);if(!oc||!(oc.documentos||[]).length)return;
    const doc=oc.documentos[oc.documentos.length-1];
    if(doc.url){window.open(doc.url,'_blank','noopener');return;}
    if(doc.data){try{expDescargar(await (await fetch(doc.data)).blob(),doc.nombre||(oc.id+'.pdf'));}catch(e){toast('No se pudo abrir el PDF.','err');}return;}
    toast('El PDF no está disponible por ahora: vuelve a abrir la pantalla.','err');
  },
  async ocDetalle(d){
    const oc=ocLista().find(x=>x.id===d.id);if(!oc)return;
    formM({title:`Orden de compra ${oc.id}`,text:ocDetalleHTML(oc),ancho:'1000px',noCancel:true,ok:'Cerrar',act:'closeModal'});
  },
  async ocEnviarOpen(d){
    formM({title:`Registrar envío · ${d.id}`,text:'Confirma que la orden de compra ya se envió al cliente. Se guarda quién y cuándo, y se avisa a Facturación que queda pendiente la confirmación del cliente.',fields:[{k:'destinatario',label:'Enviada a (contacto del cliente)'},{k:'medio',label:'Medio (correo, portal, entrega…)'}],ok:'CONFIRMAR ENVÍO',act:'ocEnviarOk',id:d.id});
  },
  async ocEnviarOk(d){const r=await run(()=>API.ocEnviar(S.user.id,d.id,{destinatario:S.modal.data.destinatario,medio:S.modal.data.medio}),`Envío de ${d.id} registrado. Facturación fue notificada.`,true);if(r.ok){S.tab.oc='ENVIADA';afterWrite();}},
  async ocConfirmarOpen(d){
    formM({title:`Confirmado por el cliente · ${d.id}`,text:'Registra que el cliente aceptó la orden de compra. La evidencia es obligatoria; quedan tu usuario, la fecha y la hora. El envío de la factura es un evento distinto, de Facturación.',fields:[{k:'referencia',label:'Referencia del cliente (No. de orden, correo…)',req:1},{k:'evidencia',label:'Evidencia de la aceptación (correo, orden firmada o captura)',type:'file',req:1}],ok:'CONFIRMADO',act:'ocConfirmarOk',id:d.id});
  },
  async ocRechazarOpen(d){
    formM({title:`Rechazada por el cliente · ${d.id}`,text:'Registra el rechazo con su motivo. La orden y su PDF se conservan; después puedes corregirla y preparar una nueva versión.',fields:[{k:'motivo',label:'Motivo del rechazo',type:'textarea',req:1},{k:'evidencia',label:'Evidencia (opcional)',type:'file'}],ok:'REGISTRAR RECHAZO',act:'ocRechazarOk',id:d.id});
  },
  async ocConfirmarOk(d){return ACT.ocResponderOk(Object.assign({},d,{res:'ACEPTADA'}));},
  async ocRechazarOk(d){return ACT.ocResponderOk(Object.assign({},d,{res:'RECHAZADA'}));},
  async ocResponderOk(d){
    const m=S.modal.data,ev=m.evidencia?[m.evidencia]:[],res=d.res||m.resultado;
    const r=await run(()=>API.ocResponder(S.user.id,d.id,{resultado:res,referencia:m.referencia,motivo:m.motivo,evidencias:ev}),`Respuesta de ${d.id} registrada.`,true);
    if(r.ok){S.tab.oc=res==='ACEPTADA'?'ACEPTADA':'RECHAZADA';afterWrite();}
  },
  async ocCorregirOpen(d){
    formM({title:`Nueva versión de ${d.id}`,text:'La orden actual (con sus PDF, respuesta e historial) se conserva como «Reemplazada» y se prepara una nueva versión con los mismos viajes y la tarifa vigente. Genera luego su PDF y regístrala de nuevo.',fields:[{k:'motivo',label:'Motivo de la corrección',type:'textarea',req:1}],ok:'CREAR NUEVA VERSIÓN',act:'ocCorregirOk',id:d.id,okCls:'ok'});
  },
  async ocCorregirOk(d){const r=await run(()=>API.ocCorregir(S.user.id,d.id,{motivo:S.modal.data.motivo}),`Nueva versión de ${d.id} preparada.`,true);if(r.ok){S.tab.oc='PREPARADA';afterWrite();}},
  async ocAnularOpen(d){
    formM({title:`Anular orden de compra ${d.id}`,text:'Los viajes quedan libres para otra orden. La orden y su PDF se conservan marcados como anulados.',fields:[{k:'motivo',label:'Motivo de la anulación',type:'textarea',req:1}],ok:'ANULAR ORDEN',act:'ocAnularOk',id:d.id,okCls:'ok'});
  },
  async ocAnularOk(d){const r=await run(()=>API.ocAnular(S.user.id,d.id,S.modal.data.motivo),`Orden ${d.id} anulada.`,true);if(r.ok){S.tab.oc='ANULADA';afterWrite();}},
  async ocFacturar(d){
    const oc=ocLista().find(x=>x.id===d.id);if(!oc)return;
    confirmM(`Preparar factura de ${oc.id}`,`Se prepara UNA factura con los ${oc.lineas.length} viaje(s) de la orden (Total ${ocQ(oc.total)}). El número, serie y fecha se completan, y la factura se envía y emite en Facturación como siempre.`,'PREPARAR FACTURA','ocFacturarOk',oc.id);
  },
  async ocFacturarOk(d){
    const oc=ocLista().find(x=>x.id===d.id);if(!oc)return;
    const r=await run(()=>API.prepararFactura(S.user.id,{cliente:oc.cliente,ocId:oc.id,viajeIds:oc.lineas.map(l=>l.viajeId)}),g=>`Factura ${g.id} preparada desde ${oc.id}. Complétala en Facturación → Facturas.`,true);
    if(r.ok)afterWrite();
  }
});
