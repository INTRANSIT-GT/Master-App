/* =====================================================================
   MÓDULO: FINANZAS · OPL, órdenes de pago y cobros
   Tarifas de proveedor (OPL), órdenes de pago y cobros.
   ===================================================================== */

/* ---- Finanzas (Gerencia) ---- */
/* Documento de la orden de pago a proveedor (se genera al emitirla). */
function ordenPagoPDF(o){
  const lib=window.jspdf||{};if(!lib.jsPDF)throw new Error('No se pudo generar el PDF (jsPDF no disponible).');
  const doc=new lib.jsPDF({unit:'pt',format:'letter'});
  const ver=v=>v==null?'':('Q '+Number(v).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2}));
  doc.setFontSize(16);doc.text('ORDEN DE PAGO A PROVEEDOR',40,50);
  doc.setFontSize(11);
  doc.text('Orden: '+o.id,40,80);doc.text('Proveedor (OPL): '+o.proveedor,40,98);
  doc.text('Fecha: '+fmtDate(o.fechaEmision),40,116);doc.text('Total: '+ver(o.importe),40,134);
  let y=162;doc.setFontSize(10);
  doc.text('Viaje',40,y);doc.text('Cliente',120,y);doc.text('Proyecto',260,y);doc.text('Importe',430,y);y+=15;
  o.viajeIds.forEach(id=>{const t=DB.trips.find(x=>x.id===id)||{};const cli=(PROYECTOS.find(p=>p.id===t.proyecto)||{}).cliente||t.proyecto||'';
    doc.text('#'+id,40,y);doc.text(String(cli).slice(0,24),120,y);doc.text(String(t.proyectoCat||'').slice(0,26),260,y);doc.text(ver(o.importesViaje[id]),430,y);y+=15;
    if(y>720){doc.addPage();y=52;}});
  y+=6;doc.setFontSize(11);doc.text('TOTAL: '+ver(o.importe),400,y);
  return doc.output('datauristring');
}
const FINTABS=[{k:'res',l:'Resumen financiero'},{k:'mes',l:'Viajes por mes'},{k:'prov',l:'Proveedores'},{k:'ord',l:'Órdenes de pago'},{k:'fact',l:'Facturación e ingresos'},{k:'pil',l:'Pilotos'}];
/* ---- Órdenes de pago a proveedores (OPL): piezas reutilizadas por Finanzas y por la sección OPL ---- */
function opSelIds(porPagar){const sel=S.opSel||{};return Object.keys(sel).filter(id=>sel[id]&&porPagar.some(r=>r.id===id));}
function opSelBar(selIds,porPagar,canPay){
  if(!canPay||!selIds.length)return'';
  const imp=selIds.reduce((s,id)=>s+((porPagar.find(r=>r.id===id)||{}).importe||0),0);
  const provs=[...new Set(selIds.map(id=>(porPagar.find(r=>r.id===id)||{}).proveedor).filter(Boolean))];
  const unProv=provs.length===1?provs[0]:'';
  return `<div class="selbar"><b>${selIds.length} viaje(s) seleccionado(s)</b><span>· Proveedor: <b>${esc(unProv||'—')}</b> · Total: <b>${qfmt(r2(imp))}</b></span><span class="spacer"></span>${unProv?`<button class="btn primary" data-act="opEmitir">EMITIR ORDEN DE PAGO</button>`:'<span class="warnl">Selecciona viajes de un solo proveedor</span>'}<button class="btn sm ghost" data-act="opClear">Limpiar</button></div>`;
}
function opSelTable(porPagar,prov,sel){
  if(!prov)return `<div class="alertbox info">Elige un <b>proveedor (OPL)</b> en el filtro de arriba para ver los viajes ya facturados al cliente que se le pueden pagar.</div>`;
  const elig=porPagar.filter(r=>r.proveedor===prov);
  if(!elig.length)return `<div class="mute">No hay viajes por pagar de ${esc(prov)} (facturados al cliente, con tarifa OPL, sin orden activa).</div>`;
  const pg=paginar('opsel',elig);
  return `<div class="xlwrap"><table class="xl" style="min-width:900px"><thead><tr><th></th><th>Viaje</th><th>Cliente · proyecto</th><th>Fecha plan</th><th>Importe a pagar</th></tr></thead><tbody>
    ${pg.filas.map(r=>`<tr><td><input type="checkbox" data-act="opTog" data-id="${r.id}" ${sel[r.id]?'checked':''}></td><td><button class="linkbtn" data-act="detalle" data-id="${r.id}">#${r.id}</button></td><td>${esc((PROYECTOS.find(p=>p.id===r.cliente)||{}).cliente||r.cliente)} · ${esc(r.proyecto)}</td><td>${fmtDate(r.fecha)}</td><td style="text-align:right">${r.sinTarifa?'<span class="warnl">sin tarifa OPL</span>':qfmt(r.importe)}</td></tr>`).join('')}
    </tbody></table></div>${paginador('opsel',pg)}`;
}
function opOrdenesTable(ordenes,canPay){
  if(!ordenes.length)return `<div class="mute">Aún no hay órdenes de pago.</div>`;
  const pg=paginar('op',ordenes.slice().reverse());
  return `<div class="xlwrap"><table class="xl" style="min-width:1250px"><thead><tr><th>Orden</th><th>Proveedor</th><th>Viajes</th><th>Importe</th><th>Estado</th><th>Emitida</th><th>Documento</th><th>Pago · evidencia · factura del proveedor</th>${canPay?'<th class="stkR">Acciones</th>':''}</tr></thead><tbody>
    ${pg.filas.map(o=>{const pag=o.fase==='PAGADA';return `<tr class="${o.estado==='ANULADA'?'dim':''}"><td><b>${o.id}</b></td><td>${esc(o.proveedor)}</td><td>${o.viajeIds.slice(0,6).map(i=>`<button class="linkbtn" data-act="detalle" data-id="${i}">#${i}</button>`).join(' ')}${o.viajeIds.length>6?' <span class="mute">…</span>':''} <b class="mute">[${o.viajeIds.length}]</b></td><td style="text-align:right">${qfmt(o.importe)}</td><td>${chip(o.estado==='ANULADA'?'neutral':(pag?'done':'progress'),o.estado==='ANULADA'?'Anulada':(pag?'Pagada':'Emitida'))}</td><td>${o.fechaEmision?fmtDate(o.fechaEmision):'—'}</td>
    <td>${o.emision&&o.emision.documentoUrl?`<button class="linkbtn" data-act="opAbrir" data-url="${esc(o.emision.documentoUrl)}">Ver documento</button>`:(o.emision?'<span class="mute">sin documento</span>':'—')}</td>
    <td>${pag&&o.transferencia?`${fmtDate(o.transferencia.fecha)} · ${qfmt(o.transferencia.monto)} · ${esc(o.transferencia.referencia)}${o.transferencia.evidenciaUrl||o.transferencia.facturaUrl?'<br>':''}${o.transferencia.evidenciaUrl?`<button class="linkbtn" data-act="opAbrir" data-url="${esc(o.transferencia.evidenciaUrl)}">Evidencia</button> `:''}${o.transferencia.facturaUrl?`<button class="linkbtn" data-act="opAbrir" data-url="${esc(o.transferencia.facturaUrl)}">Factura proveedor</button>`:''}`:'<span class="mute">Pendiente de pago</span>'}${o.anulada?`<br><span class="mute">Anulada por ${esc(o.anulada.por)} · “${esc(o.anulada.motivo)}”</span>`:''}</td>
    ${canPay?`<td class="stkR"><div class="acts-wrap">${o.estado==='ANULADA'?'<span class="mute">—</span>':(o.fase==='EMITIDA'?`<button class="btn sm ok" data-act="opTransferOpen" data-id="${o.id}">Registrar pago</button><button class="btn sm fix" data-act="opAnularOpen" data-id="${o.id}">Anular</button>`:'<span class="mute">Pagada</span>')}</div></td>`:''}</tr>`;}).join('')}
    </tbody></table></div>${paginador('op',pg)}`;
}
/* ---- Sección OPL (proveedores): todo el proceso del operador logístico, sin exponer el cobro al cliente ---- */
const OPLTABS=[{k:'prov',l:'Proveedores (OPL)'},{k:'tar',l:'Tarifas OPL'},{k:'pagar',l:'Viajes por pagar'},{k:'ord',l:'Órdenes de pago'}];
VIEWS.opl=()=>{
  const k=OPLTABS.some(t=>t.k===S.tab.opl)?S.tab.opl:'prov',prov=S.fProv;
  const canPay=hp('pagos_registrar'),canTar=hp('tarifas_editar');
  let R=null,err='';try{R=API.resumenFinanciero(S.user.id,{proveedor:prov,cliente:S.fCli,proyecto:S.fPcat});}catch(e){err=e.message;}
  if(!R)return `<div class="inner">${empty('Sin acceso al proceso OPL',esc(err))}</div>`;
  let porPagar=[],ordenes=[];try{porPagar=API.viajesPorPagar(S.user.id);}catch(e){}try{ordenes=API.ordenesPago(S.user.id);}catch(e){}
  const filt=`<div class="lfilters" style="grid-template-columns:repeat(auto-fit,minmax(155px,1fr))">
    <select data-flt="fProv" aria-label="Proveedor (OPL)"><option value="">Todos los proveedores (OPL)</option>${CAT.opl.map(p=>`<option ${prov===p?'selected':''}>${esc(p)}</option>`).join('')}</select>
    <select data-flt="fCli" aria-label="Cliente"><option value="">Todos los clientes</option>${PROYECTOS.map(p=>`<option value="${p.id}" ${S.fCli===p.id?'selected':''}>${esc(p.cliente)}</option>`).join('')}</select>
    <select data-flt="fPcat" aria-label="Proyecto"><option value="">Todos los proyectos</option>${CAT.proyectos.map(p=>`<option ${S.fPcat===p?'selected':''}>${esc(p)}</option>`).join('')}</select></div>
    <div class="mute" style="font-size:12.5px;margin:-4px 0 12px">Sección del proveedor (OPL): aquí se gestiona <b>todo lo que se paga al proveedor</b>. No se muestra la tarifa de cobro al cliente.</div>`;
  let body='';
  if(k==='prov'){
    const rows=R.tripRows.filter(r=>r.proveedor&&(!S.fCli||r.cliente===S.fCli)&&(!S.fPcat||r.proyecto===S.fPcat));
    const by={};rows.forEach(r=>{const p=by[r.proveedor]=by[r.proveedor]||{n:0,por:0,pag:0,sal:0,sin:0};p.n++;if(r.costo==null)p.sin++;else{p.por+=r.costo;p.sal+=r.saldoProv;}p.pag+=r.pagadoProv;});
    const activas=ordenes.filter(o=>o.estado==='ACTIVA');
    body=`<h2 style="margin-bottom:10px">Saldo por proveedor (OPL)</h2>${miniTable(['Proveedor','Viajes finalizados','Por pagar','Pagado','Saldo pendiente','Viajes por pagar','Órdenes activas','Sin costo'],Object.keys(by).sort().map(p=>{const pp=porPagar.filter(r=>r.proveedor===p).length,no=activas.filter(o=>o.proveedor===p).length;return [esc(p),by[p].n,qfmt(r2(by[p].por)),qfmt(r2(by[p].pag)),`<b>${qfmt(r2(by[p].sal))}</b>`,pp||'—',no||'—',by[p].sin||'—'];}))}
      <div class="mute" style="margin-top:8px;font-size:13px">«Por pagar» es el costo registrado del proveedor (tarifa OPL). «Viajes por pagar» son los viajes ya facturados al cliente que aún no están en una orden.</div>`;
  }else if(k==='tar'){
    const conOpl=t=>t.importeOpl!=null&&t.importeOpl!=='';
    const todas=tarData().filter(t=>(!S.fCli||t.cliente===S.fCli)&&(!S.fPcat||t.proyecto===S.fPcat));
    const rows=todas.filter(t=>!S.opSoloOpl||conOpl(t)).sort((a,b)=>a.cliente.localeCompare(b.cliente)||rutaTxt(a.rutaId).localeCompare(rutaTxt(b.rutaId))||b.vigenteDesde.localeCompare(a.vigenteDesde));
    const sinOpl=todas.filter(t=>!conOpl(t)).length;
    body=`<div class="chips"><button class="chip" aria-pressed="${!!S.opSoloOpl}" data-act="opSoloOpl">Solo con tarifa OPL</button></div>
      ${sinOpl&&!S.opSoloOpl?`<div class="alertbox" style="margin:10px 0"><b>${sinOpl} tarifa(s) sin importe de proveedor (OPL).</b> Defínelo con «Editar OPL»: sin importe OPL no se puede pagar al proveedor.</div>`:''}
      ${rows.length?`<div class="mute" style="margin:6px 0 8px">${rows.length} tarifas · solo importes del proveedor</div><div class="xlwrap"><table class="xl" style="min-width:1250px"><thead><tr><th>ID</th><th>Cliente</th><th>Proyecto</th><th>Ruta</th><th>Capacidad</th><th>Importe proveedor (OPL)</th><th>% comb. prov.</th><th>Q diésel prov.</th><th>Vigente desde</th><th>Vigente hasta</th><th>Estado</th>${canTar?'<th>Acciones</th>':''}</tr></thead><tbody>
      ${rows.map(t=>`<tr class="${t.activa?'':'dim'}"><td><b>${t.id}</b></td><td>${esc((PROYECTOS.find(p=>p.id===t.cliente)||{}).cliente||t.cliente)}</td><td>${esc(t.proyecto)}</td><td style="white-space:normal;min-width:220px">${esc(rutaTxt(t.rutaId))}</td><td>${esc(t.capacidad)}</td><td style="text-align:right">${conOpl(t)?`<b>${qfmt(t.importeOpl)}</b>`:'<span class="warnl">sin tarifa OPL</span>'}</td><td style="text-align:right">${t.combustiblePctOpl!=null&&t.combustiblePctOpl!==''?esc(t.combustiblePctOpl)+'%':'<span class="mute">—</span>'}</td><td style="text-align:right">${t.dieselPactadoOpl!=null&&t.dieselPactadoOpl!==''?esc(t.dieselPactadoOpl):'<span class="mute">—</span>'}</td><td>${fmtDate(t.vigenteDesde)}</td><td>${t.vigenteHasta?fmtDate(t.vigenteHasta):'<span class="mute">sin fin</span>'}</td><td>${chip(t.activa?'done':'neutral',t.activa?'Activa':'Inactiva')}</td>${canTar?`<td><button class="btn sm" data-act="tarifaOpenOpl" data-id="${t.id}">Editar OPL</button></td>`:''}</tr>`).join('')}
      </tbody></table></div>`:empty('No hay tarifas con estos filtros','Crea la tarifa en Comercial → Tarifas y define aquí el importe del proveedor.')}
      <div class="mute" style="margin-top:8px;font-size:13px">Las tarifas de cobro al cliente se administran en <b>Comercial → Tarifas</b>. Aquí solo se edita el importe y el combustible del proveedor (OPL).</div>`;
  }else if(k==='pagar'){
    const sel=S.opSel||{},selIds=opSelIds(porPagar);
    body=`<h2 style="margin-bottom:6px">Emitir orden de pago (etapa 1)</h2>
      <div class="mute" style="font-size:13px;margin-bottom:10px">Solo viajes <b>facturados al cliente</b> y con <b>tarifa OPL</b>. Se agrupan por proveedor; al emitir se genera el documento de la orden.</div>
      ${opSelBar(selIds,porPagar,canPay)}${opSelTable(porPagar,prov,sel)}`;
  }else{
    body=opOrdenesTable(prov?ordenes.filter(o=>o.proveedor===prov):ordenes,canPay)+
      `<div class="alertbox info" style="margin-top:14px"><b>Ciclo de la orden:</b> Emitida → Pagada. Al emitir se genera el documento de la orden; al pagar se exigen la <b>evidencia de la transferencia</b> y la <b>factura del proveedor</b>.</div>`;
  }
  return `<div class="inner" style="max-width:1500px">${pageHead('OPL · Proveedores','Proceso completo del operador logístico: tarifa de proveedor, viajes por pagar y órdenes de pago')}${tabs('opl',OPLTABS,k,null)}<div style="height:12px"></div>${filt}${body}</div>`;
};
const finFilters=()=>({desde:S.fDesde,hasta:S.fHasta,cliente:S.fCli,proyecto:S.fPcat,proveedor:S.fProv});
const PAGO_L={SIN_IMPORTE:'Sin importe registrado',PENDIENTE:'Pendiente',PARCIAL:'Pago parcial',PAGADO:'Pagado'};
const PAGO_C={SIN_IMPORTE:'st-PENDIENTE',PENDIENTE:'st-PENDIENTE_LIQUIDACION',PARCIAL:'st-EN_CURSO',PAGADO:'st-APROBADA'};
const pagoBadge=e=>`<span class="badge ${PAGO_C[e]}">${PAGO_L[e]}</span>`;
const nc='<span class="mute">No calculable</span>';
const qOrNc=v=>v==null?nc:qfmt(v);
function miniTable(cols,rows,foot){
  if(!rows.length)return '<div class="mute">Sin registros en este filtro.</div>';
  const pg=paginar('mini',rows);
  return `<div class="xlwrap" style="max-height:50vh"><table class="xl" style="min-width:560px"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${pg.filas.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>${foot?`<tfoot><tr>${foot.map(c=>`<td><b>${c}</b></td>`).join('')}</tr></tfoot>`:''}</table></div>${paginador('mini',pg)}`;
}
function finDetail(k,R){
  const M=R.M,ar=R.agrRows,tr=R.tripRows,T=(cols,rows,foot)=>miniTable(cols,rows,foot);
  const prov=tr.filter(r=>r.costo!=null),pil=tr.filter(r=>r.viaticos!=null);
  const D={
    enviado:['Total enviado a facturar',T(['Agrupación','Cliente','Viajes','Enviado','Sin tarifa'],ar.map(r=>[r.id,esc(r.cliente),r.nViajes,qfmt(r.enviado),r.sinImporte||'—']),['Total','','',qfmt(M.enviado),''])],
    facturado:['Total facturado',T(['Agrupación','Factura','Fecha','Facturado'],ar.filter(r=>r.factura).map(r=>[r.id,esc(r.factura),r.fechaFactura?fmtDate(r.fechaFactura):'—',r.facturado==null?'monto sin registrar':qfmt(r.facturado)]),['Total (cada factura una vez)','','',qfmt(M.facturado)])],
    cobrado:['Total cobrado',T(['Agrupación','Cobro','Fecha','Referencia','Monto'],ar.flatMap(r=>r.cobros.map(c=>[r.id,c.id,fmtDate(c.fecha),esc(c.referencia),qfmt(c.monto)])),['Total','','','',qfmt(M.cobrado)])],
    pendCobro:['Pendiente de cobro',T(['Agrupación','Facturado','Cobrado','Saldo'],ar.filter(r=>r.facturado!=null).map(r=>[r.id,qfmt(r.facturado),qfmt(r.cobrado),qfmt(r.saldo)]),['Total','','',qfmt(M.pendCobro)])],
    porPagarProv:['Total por pagar a proveedores',T(['Viaje','Proveedor','Costo'],prov.map(r=>['#'+r.id,esc(r.proveedor),qfmt(r.costo)]),['Total','',qfmt(M.porPagarProv)])],
    pagadoProv:['Total pagado a proveedores',T(['Viaje','Proveedor','Pagado','Referencia'],tr.filter(r=>r.pagadoProv>0).map(r=>['#'+r.id,esc(r.proveedor),qfmt(r.pagadoProv),esc(r.refProv)]),['Total','',qfmt(M.pagadoProv),''])],
    pendProv:['Pendiente de pago a proveedores',T(['Viaje','Proveedor','Costo','Pagado','Saldo'],prov.map(r=>['#'+r.id,esc(r.proveedor),qfmt(r.costo),qfmt(r.pagadoProv),qfmt(r.saldoProv)]),['Total','','','',qfmt(M.pendProv)])],
    porPagarPil:['Viáticos por pagar a pilotos',T(['Viaje','Piloto','Viáticos'],pil.map(r=>['#'+r.id,esc((PILOTOS.find(p=>p.id===r.pilotoId)||{}).nombre),qfmt(r.viaticos)]),['Total','',qfmt(M.porPagarPil)])],
    pagadoPil:['Total pagado a pilotos',T(['Viaje','Piloto','Pagado','Referencia'],tr.filter(r=>r.pagadoPil>0).map(r=>['#'+r.id,esc((PILOTOS.find(p=>p.id===r.pilotoId)||{}).nombre),qfmt(r.pagadoPil),esc(r.refPil)]),['Total','',qfmt(M.pagadoPil),''])],
    costoTotal:['Costo total registrado',T(['Viaje','Costo proveedor','Viáticos','Total'],tr.map(r=>['#'+r.id,qOrNc(r.costo),qOrNc(r.viaticos),(r.costo==null&&r.viaticos==null)?nc:qfmt((r.costo||0)+(r.viaticos||0))]),['Suma de lo registrado','','',qOrNc(M.costoTotal)])],
    margenEst:['Margen estimado sobre monto enviado a facturar',T(['Viaje','Agrupación','Ingreso','Costo prov.','Viáticos','Margen','Falta'],R.margenRows.map(r=>['#'+r.id,r.agr,qOrNc(r.ingreso),qOrNc(r.costo),qOrNc(r.viaticos),r.margen==null?nc:qfmt(r.margen),esc(r.falta)||'—']),['Total (solo viajes completos)','','','','',qOrNc(M.margenEst),''])],
    gananciaReal:['Ganancia real (cobrado − costos registrados)',T(['Agrupación','Cobrado','Costos','Ganancia','Falta'],R.realRows.map(r=>[r.id,qfmt(r.cobrado),qOrNc(r.costos),r.ganancia==null?nc:qfmt(r.ganancia),esc(r.falta)||'—']),['Total','','',qOrNc(M.gananciaReal),''])]
  };
  return D[k]||['Detalle',''];
}
VIEWS.finanzas=()=>{
  const k=S.tab.fin||'res';let R=null,err='';
  try{R=API.resumenFinanciero(S.user.id,finFilters());}catch(e){err=e.message;}
  if(!R)return `<div class="inner">${empty('Sin acceso al control financiero',esc(err))}</div>`;
  const M=R.M,canPay=hp('pagos_registrar'),canCost=hp('costos_registrar');
  /* Los totales de costos y margen se calculan sobre los viajes cargados en pantalla (la ventana), así que
     se piden al servidor los de TODO el histórico y se muestran esos. Con filtros puestos mandan los del filtro. */
  const sinFiltro=!S.fDesde&&!S.fHasta&&!S.fCli&&!S.fPcat&&!S.fProv;
  const H=sinFiltro&&S.finHist&&S.finHist.financiero?S.finHist.financiero.M:null;
  if(H)['porPagarProv','pendProv','porPagarPil','pendPil','costoTotal','costoIncompletos','provSinCosto','pilSinImporte','margenEst','margenPct','margenIngreso','margenCostos'].forEach(x=>{if(x in H)M[x]=H[x];});
  cargaHistorico();cargaGrafica();
  const histErr=S.finHist&&S.finHist.finError?`<div class="alertbox" style="margin-bottom:10px"><b>No se pudieron calcular los totales del histórico.</b> La gráfica por mes sí está al día. Motivo: ${esc(S.finHist.finError)}</div>`:'';
  const histNota=histErr||(k==='res'&&H?`<div class="alertbox info" style="margin-bottom:10px">Costos y margen: <b>toda la base</b> (histórico completo), no solo los viajes cargados en pantalla. Los detalles de cada total listan los viajes que están cargados.</div>`
    :(k==='res'&&S.finHistCargando?'<div class="mute" style="margin-bottom:10px">Calculando los totales del histórico…</div>':''));
  const filt=`<div class="lfilters" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))"><label class="dlab">Desde <input type="date" data-flt="fDesde" value="${esc(S.fDesde)}"></label><label class="dlab">Hasta <input type="date" data-flt="fHasta" value="${esc(S.fHasta)}"></label>
    <select data-flt="fCli" aria-label="Cliente"><option value="">Todos los clientes</option>${PROYECTOS.map(p=>`<option value="${p.id}" ${S.fCli===p.id?'selected':''}>${esc(p.cliente)}</option>`).join('')}</select>
    <select data-flt="fPcat" aria-label="Proyecto"><option value="">Todos los proyectos</option>${CAT.proyectos.map(p=>`<option ${S.fPcat===p?'selected':''}>${esc(p)}</option>`).join('')}</select>
    <select data-flt="fProv" aria-label="Proveedor"><option value="">Todos los proveedores</option>${CAT.opl.map(p=>`<option ${S.fProv===p?'selected':''}>${esc(p)}</option>`).join('')}</select></div>
    <div class="mute" style="font-size:12.5px;margin:-4px 0 12px">Periodo = fecha plan del viaje (costos y pagos) y fecha de envío a facturar (facturación y cobros). El filtro de proveedor no aplica a facturación.</div>`;
  let body='';
  const tile=(k,l,v,note,warn)=>`<button class="kpi fk" data-act="finDet" data-k="${k}"><span class="l">${l}</span><span class="n" style="font-size:${v==null?15:25}px">${v==null?'No calculable':qfmt(v)}</span><span class="mute" style="font-size:12px">${note}</span>${warn?`<span class="warnl">⚠ ${warn}</span>`:''}</button>`;
  if(k==='res'){
    body=`<h2 style="margin-bottom:10px">Ingresos</h2><div class="grid g4">
      ${tile('enviado','Enviado a facturar',M.enviado,R.agrRows.length+' agrupaciones',M.enviadoIncompleto?M.enviadoIncompleto+' con viajes sin tarifa: total incompleto':'')}
      ${tile('facturado','Facturado',M.nFacturas?M.facturado:0,M.nFacturas+' facturas',M.facturasSinMonto?M.facturasSinMonto+' factura(s) sin monto registrado':'')}
      ${tile('cobrado','Cobrado',M.cobrado,'Cobros efectivamente registrados','')}
      ${tile('pendCobro','Pendiente de cobro',M.pendCobro,M.pendCobro==null?'Falta el monto facturado':'Facturado − cobrado','')}</div>
      <h2 style="margin:22px 0 10px">Costos</h2><div class="grid g4">
      ${tile('porPagarProv','Por pagar a proveedores',M.porPagarProv,'Costo registrado por viaje',M.provSinCosto?M.provSinCosto+' viaje(s) sin costo registrado':'')}
      ${tile('pagadoProv','Pagado a proveedores',M.pagadoProv,'Pagos con referencia','')}
      ${tile('pendProv','Pendiente a proveedores',M.pendProv,'Costo − pagado','')}
      ${tile('costoTotal','Costo total registrado',M.costoTotal,'Proveedores + viáticos registrados',M.costoIncompletos?M.costoIncompletos+' viaje(s) con costos incompletos':'')}
      ${tile('porPagarPil','Viáticos por pagar a pilotos',M.porPagarPil,'Q viáticos registrado',M.pilSinImporte?M.pilSinImporte+' viaje(s) sin importe':'')}
      ${tile('pagadoPil','Pagado a pilotos',M.pagadoPil,'Pagos con referencia','')}
      ${tile('pendPil','Pendiente a pilotos',M.pendPil,'Viáticos − pagado','')}</div>
      <h2 style="margin:22px 0 10px">Rentabilidad</h2><div class="grid g2">
      ${tile('margenEst','Margen estimado sobre monto enviado a facturar',M.margenEst,M.margenEst==null?'Ningún viaje enviado a facturar tiene ingreso y costos completos':`${M.margenPct}% sobre ${qfmt(M.margenIngreso)} · ${R.margenRows.length-M.margenExcluidos} viajes incluidos`,M.margenExcluidos?M.margenExcluidos+' viaje(s) excluidos por datos faltantes':'')}
      ${tile('gananciaReal','Ganancia real',M.gananciaReal,M.gananciaReal==null?'Requiere factura cobrada por completo y costos registrados':`${M.realIncluidas} agrupación(es) cobradas por completo`,M.realPendientes?M.realPendientes+' agrupación(es) aún sin cobrar por completo (no cuentan)':'')}</div>
      <div class="alertbox info" style="margin-top:14px"><b>Cómo se calcula:</b> las facturas se suman una sola vez aunque incluyan varios viajes. Un dato faltante no se toma como cero: el viaje o la agrupación se excluye y se señala. Los viáticos (Q_VIATICOS) se tratan como importe por pagar al piloto. Toca cualquier indicador para ver el detalle que lo explica.</div>`;
  }else if(k==='mes'){
    /* Resumen por mes de TODA la base, acotado por los filtros de arriba (lo calcula el servidor con todos los
       viajes, no solo la ventana cargada): al cambiar cliente, proyecto, proveedor o fechas, la gráfica cambia. */
    const G=graficaActual(),PM=(G&&G.porMes)||null;
    const cargando=claveGrafica()?!!(S.graf&&S.graf.cargando):S.finHistCargando;
    const errG=claveGrafica()?String((S.graf&&S.graf.err)||'').slice(0,240):(S.finHistErr?String(S.finHistErr).slice(0,240):'');
    const meses=PM?Object.keys(PM).sort().slice(-12):[];
    body=PM&&meses.length
      ? `<h2 style="margin-bottom:10px">Viajes por mes · por estado</h2>
      <div class="card"><div id="chartMes">${chartMeses(PM,meses)}</div>
        ${leyendaMeses()}
        <div class="mute" style="font-size:12.5px;margin-top:8px">Cada barra es un mes (por <b>fecha plan</b> del viaje) y cada color, un estado. Un mes «todo verde» significa que todos sus viajes ya están liquidados/facturados/cobrados; si queda un tramo de otro color, hay viajes pendientes en ese mes. Pasa el cursor sobre un tramo para ver el número. Se muestran los últimos 12 meses con actividad.</div></div>
      <div class="mute" style="margin-top:10px">Total ${claveGrafica()?'según los filtros':'en la base'}: <b>${G.viajes}</b> viajes · ${Object.entries(G.porEstado||{}).map(([e,n])=>`${esc((ESTADOS[e]||{}).l||e)}: ${n}`).join(' · ')}</div>`
      : (cargando?empty('Calculando el resumen por mes…',claveGrafica()?'Se está consultando la base con los filtros elegidos.':'Se está consultando toda la base.')
        : empty(claveGrafica()?'Sin viajes con esos filtros':'Sin datos para el resumen por mes',errG||(claveGrafica()?'Prueba con otro cliente, proyecto, proveedor o periodo.':(S.finHist&&S.finHist.viajes?'Se leyeron '+S.finHist.viajes+' viajes, pero ninguno tiene fecha plan.':'')))
          +'<div style="margin-top:10px"><button class="btn sm" data-act="histReintentar">Reintentar</button></div>');
  }else if(k==='prov'){
    const rows=R.tripRows.filter(r=>r.proveedor).sort((a,b)=>a.proveedor.localeCompare(b.proveedor)||a.id.localeCompare(b.id));
    const by={};rows.forEach(r=>{const p=by[r.proveedor]=by[r.proveedor]||{por:0,pag:0,sal:0,sin:0,n:0};p.n++;if(r.costo==null)p.sin++;else{p.por+=r.costo;p.sal+=r.saldoProv;}p.pag+=r.pagadoProv;});
    const pg=paginar('finprov',rows);
    body=`<h2 style="margin-bottom:10px">Saldo por proveedor</h2>${miniTable(['Proveedor','Viajes','Por pagar','Pagado','Saldo pendiente','Sin costo registrado'],Object.keys(by).sort().map(p=>[esc(p),by[p].n,qfmt(r2(by[p].por)),qfmt(r2(by[p].pag)),`<b>${qfmt(r2(by[p].sal))}</b>`,by[p].sin||'—']))}
      <h2 style="margin:22px 0 10px">Detalle por viaje</h2>${rows.length?`<div class="xlwrap"><table class="xl" style="min-width:1300px"><thead><tr><th>Proveedor</th><th>Periodo</th><th>Cliente · proyecto</th><th>Viaje</th><th>Importe por pagar</th><th>Pagado</th><th>Saldo</th><th>Estado de pago</th><th>Fecha del pago</th><th>Referencia</th>${canPay||canCost?'<th>Acciones</th>':''}</tr></thead><tbody>
      ${pg.filas.map(r=>`<tr><td>${esc(r.proveedor)}</td><td>${r.periodo}</td><td>${esc(r.cliente)} · ${esc(r.proyecto)}</td><td><button class="linkbtn" data-act="detalle" data-id="${r.id}">#${r.id}</button></td><td style="text-align:right">${r.costo==null?sinReg:qfmt(r.costo)}</td><td style="text-align:right">${qfmt(r.pagadoProv)}</td><td style="text-align:right">${r.saldoProv==null?'—':qfmt(r.saldoProv)}</td><td>${pagoBadge(r.estadoProv)}</td><td>${r.fechaProv?fmtDate(r.fechaProv):'—'}</td><td>${esc(r.refProv)||'—'}</td>${canCost?`<td>${canCost?`<button class="btn sm" data-act="importeOpen" data-id="${r.id}" data-k="costoProveedor">Costo</button>`:''}</td>`:''}</tr>`).join('')}
      </tbody></table></div>${paginador('finprov',pg)}`:empty('Sin servicios de proveedores en este filtro','Solo se listan viajes finalizados con proveedor (OPL).')}
      <div class="mute" style="margin-top:8px;font-size:13px">El pago a proveedores se hace con <b>órdenes de pago</b> (pestaña «Órdenes de pago»): primero se emite la orden y, cuando el proveedor factura, se registra la transferencia con su evidencia y la factura del proveedor.</div>`;
  }else if(k==='fact'){
    const nAg=R.agrRows.length;
    body=`<div class="exportbar"><div class="mute">${nAg} ${nAg===1?'factura':'facturas'} del periodo · se exporta con todo el detalle de cada viaje</div>
      <div class="exportbtns">${nAg?`<button class="btn sm" data-act="exportFinXlsx" title="Descargar Excel con todo el detalle">${icon('receipt',16)} Descargar Excel</button><button class="btn sm primary" data-act="exportFinPdf" title="Descargar PDF con todo el detalle">${icon('receipt',16)} Descargar PDF</button>`:''}</div></div>
      ${agrTable(R.agrRows.map(r=>DB.agrupaciones.find(g=>g.id===r.id)).filter(Boolean).reverse(),canPay?false:false)}
      <div class="mute" style="margin-top:8px;font-size:13px">Totales del periodo: enviado ${qfmt(M.enviado)} · facturado ${qfmt(M.facturado)} · cobrado ${qfmt(M.cobrado)} · pendiente de cobro ${M.pendCobro==null?'no calculable':qfmt(M.pendCobro)}.</div>`;
  }else if(k==='ord'){
    let porPagar=[],ordenes=[];try{porPagar=API.viajesPorPagar(S.user.id);}catch(e){}try{ordenes=API.ordenesPago(S.user.id);}catch(e){}
    const selIds=opSelIds(porPagar);
    body=`<h2 style="margin-bottom:6px">Etapa 1 · Emitir orden de pago</h2>
      <div class="mute" style="font-size:13px;margin-bottom:10px">Solo viajes <b>facturados al cliente</b> y con <b>tarifa de OPL</b>. Se agrupan por proveedor; al emitir se genera el documento de la orden.</div>
      ${opSelBar(selIds,porPagar,canPay)}${opSelTable(porPagar,S.fProv,S.opSel||{})}
      <h2 style="margin:22px 0 10px">Órdenes de pago</h2>${opOrdenesTable(ordenes,canPay)}
      <div class="alertbox info" style="margin-top:14px"><b>Etapa 2 · Registrar el pago:</b> cuando el proveedor factura, se registra la transferencia con <b>dos archivos esenciales</b>: la evidencia de la transferencia y la factura del proveedor. Con ambos la orden queda <b>Pagada</b>.</div>`;
  }else{
    const rows=R.tripRows.sort((a,b)=>a.pilotoId.localeCompare(b.pilotoId)||a.id.localeCompare(b.id));
    const pg=paginar('finpil',rows);
    body=`${rows.length?`<div class="xlwrap"><table class="xl" style="min-width:1250px"><thead><tr><th>Piloto</th><th>Viaje</th><th>Cliente · proyecto</th><th>Ingreso del viaje</th><th>Importe a pagar</th><th>Pagado</th><th>Saldo</th><th>Estado de pago</th><th>Fecha del pago</th><th>Referencia</th>${canPay?'<th>Acciones</th>':''}</tr></thead><tbody>
      ${pg.filas.map(r=>`<tr><td>${esc((PILOTOS.find(p=>p.id===r.pilotoId)||{}).nombre)}</td><td><button class="linkbtn" data-act="detalle" data-id="${r.id}">#${r.id}</button></td><td>${esc(r.cliente)} · ${esc(r.proyecto)}</td><td style="text-align:right">${r.ingreso==null?sinReg:qfmt(r.ingreso)}</td><td style="text-align:right">${r.viaticos==null?sinReg:qfmt(r.viaticos)}</td><td style="text-align:right">${qfmt(r.pagadoPil)}</td><td style="text-align:right">${r.saldoPil==null?'—':qfmt(r.saldoPil)}</td><td>${pagoBadge(r.estadoPil)}</td><td>${r.fechaPil?fmtDate(r.fechaPil):'—'}</td><td>${esc(r.refPil)||'—'}</td>${canPay?`<td>${r.viaticos!=null&&r.saldoPil>0.004?`<button class="btn sm ok" data-act="pagoOpen" data-id="${r.id}" data-tipo="PILOTO">Pagar</button>`:''}</td>`:''}</tr>`).join('')}
      </tbody></table></div>${paginador('finpil',pg)}`:empty('Sin viajes en este filtro')}
      <div class="mute" style="margin-top:8px;font-size:13px">El importe a pagar al piloto es el valor de Q_VIATICOS del viaje. Tu hoja no tiene una tarifa de pago a pilotos y no se inventa; el ingreso mostrado es la tarifa enviada a facturar.</div>`;
  }
  return `<div class="inner" style="max-width:1500px">${pageHead('Finanzas','Control de ingresos, costos y rentabilidad · solo lectura salvo permisos de registro')}${tabs('fin',FINTABS,k,null)}<div style="height:12px"></div>${filt}${histNota}${body}</div>`;
};


/* ---- Acciones (handlers) de este módulo ---- */
Object.assign(ACT,{
  async exportFinXlsx(d,el){
    if(el)el.disabled=true;
    try{const r=expFactXlsx(expFinOpts());toast(`Excel descargado: ${r.facturas.length} ${r.facturas.length===1?'factura':'facturas'} · ${r.viajes.length} ${r.viajes.length===1?'viaje':'viajes'}.`);}
    catch(e){toast(e.message==='SIN_DATOS'?'No hay nada que exportar en este periodo.':'No se pudo generar el Excel: '+e.message,'err');}
    if(el)el.disabled=false;
  },
  async exportFinPdf(d,el){
    if(el){el.disabled=true;el.dataset.t=el.textContent;el.textContent='Generando…';}
    try{const r=await expFactPdf(expFinOpts());toast(`PDF descargado: ${r.facturas.length} ${r.facturas.length===1?'factura':'facturas'} · ${r.viajes.length} ${r.viajes.length===1?'viaje':'viajes'}.`);}
    catch(e){toast(e.message==='SIN_DATOS'?'No hay nada que exportar en este periodo.':'No se pudo generar el PDF: '+e.message,'err');}
    if(el){el.disabled=false;el.textContent=el.dataset.t;}
  },
  async cobroOpen(d){const g=DB.agrupaciones.find(x=>x.id===d.id);formM({title:`Cobrado · ${d.id}`,text:`Factura ${esc(g.numeroFactura)} · facturado ${qfmt(g.importeFacturado)} · cobrado ${qfmt(cobradoDe(g))}. Registra solo dinero efectivamente recibido.`,fields:[{k:'monto',label:'Monto cobrado (Q)',type:'number',req:1},{k:'fecha',label:'Fecha del cobro',type:'date',req:1},{k:'referencia',label:'Referencia del cobro (depósito, transferencia…)',req:1},{k:'archivo',label:'Comprobante del pago (imagen o PDF, opcional)',type:'file'}],data:{monto:r2(Math.max(0,(nn(g.importeFacturado)||0)-cobradoDe(g))),archivo:'',fecha:todayStr(),referencia:''},ok:'COBRADO',okCls:'ok',act:'cobroOk',id:d.id});},
  async cobroOk(d){const m=S.modal.data;const r=await run(()=>API.registrarCobro(S.user.id,d.id,m),c=>`Cobro ${c.id} registrado.`,true);if(r.ok)afterWrite();},
  async aplicarTarifaViaje(d){const r=await run(()=>API.aplicarTarifa(S.user.id,d.id),x=>`Tarifa aplicada al viaje #${d.id}: ${qfmt(x.importe)}.`);render();},
  async aplicarTarifasTodas(){const r=await run(()=>API.aplicarTarifasPendientes(S.user.id,[]),x=>`Tarifas aplicadas: ${x.aplicadas.length}. Sin tarifa válida (requieren revisión): ${x.sinTarifa.length}.`);render();},
  async opSoloOpl(){S.opSoloOpl=!S.opSoloOpl;render();},
  async tarifaOpenOpl(d){const t=DB.tarifas.find(x=>x.id===d.id);if(!t)return;
    formM({title:`Tarifa del proveedor (OPL) · ${t.id}`,text:`${esc((PROYECTOS.find(p=>p.id===t.cliente)||{}).cliente)} · ${esc(t.proyecto)} · ${esc(rutaTxt(t.rutaId))} · ${esc(t.capacidad)}.<br>Solo se define lo que se <b>paga al proveedor</b>; el importe de cobro al cliente no se cambia desde aquí.`,
      fields:[{k:'importeOpl',label:'Importe proveedor / OPL (Q)',type:'number'},{k:'dieselPactadoOpl',label:'Q diésel pactado proveedor (opcional)',type:'number'},{k:'combustiblePctOpl',label:'% de combustible proveedor (opcional · 0 a 100)',type:'number'},{k:'motivo',label:'Motivo del cambio (opcional)',type:'textarea'}],
      data:{importeOpl:t.importeOpl==null?'':t.importeOpl,dieselPactadoOpl:t.dieselPactadoOpl==null?'':t.dieselPactadoOpl,combustiblePctOpl:t.combustiblePctOpl==null?'':t.combustiblePctOpl,motivo:''},ok:'GUARDAR TARIFA OPL',act:'tarifaSaveOpl',id:t.id});},
  async tarifaSaveOpl(d){const t=DB.tarifas.find(x=>x.id===d.id);if(!t)return;const m=S.modal.data;
    const r=await run(()=>API.editarTarifa(S.user.id,d.id,{importe:t.importe,vigenteDesde:t.vigenteDesde,vigenteHasta:t.vigenteHasta,qDieselPactado:t.qDieselPactado==null?'':t.qDieselPactado,combustiblePct:t.combustiblePct==null?'':t.combustiblePct,importeOpl:m.importeOpl,dieselPactadoOpl:m.dieselPactadoOpl,combustiblePctOpl:m.combustiblePctOpl,motivo:m.motivo}),`Tarifa OPL de ${d.id} actualizada.`,true);if(r.ok)afterWrite();},
  async importeOpen(d){
    const t=DB.trips.find(x=>x.id===d.id);if(!t)return;
    formM({title:`Costo del proveedor · viaje #${d.id}`,text:`Importe por pagar a ${esc(t.opl||'el proveedor (OPL)')}.`,fields:[{k:'monto',label:'Costo (Q)',type:'number',req:1}],data:{monto:t[d.k]===''||t[d.k]==null?'':t[d.k]},ok:'GUARDAR',act:'importeOk',id:d.id,k:d.k});
  },
  async importeOk(d){const r=await run(()=>API.registrarImportes(S.user.id,d.id,{[S.modal.k]:S.modal.data.monto}),'Importe registrado.',true);if(r.ok)afterWrite();},
  async opTog(d){S.opSel=S.opSel||{};S.opSel[d.id]=!S.opSel[d.id];render();},
  async opClear(){S.opSel={};render();},
  async opAbrir(d){const u=urlSegura(d.url);if(u)window.open(u,'_blank','noopener');else toast('El archivo no tiene un enlace válido.','err');},
  async opEmitir(){
    const sel=S.opSel||{},ids=Object.keys(sel).filter(id=>sel[id]);
    if(!ids.length)return;
    const provs=[...new Set(ids.map(id=>{const t=DB.trips.find(x=>x.id===id);return t?t.opl:'';}))];
    if(provs.length!==1||!provs[0])return toast('Selecciona viajes de un solo proveedor (OPL).','err');
    const o=await run(async()=>{
      const ord=await API.crearOrdenPago(S.user.id,{proveedor:provs[0],viajeIds:ids});
      try{const dataUrl=ordenPagoPDF(ord);await API.adjuntarDocumentoOrden(S.user.id,ord.id,{data:dataUrl,nombre:'Orden-'+ord.id+'.pdf'});}
      catch(e){toast('La orden se creó, pero no se pudo adjuntar el documento: '+e.message,'err');}
      return ord;},null);
    if(o){S.opSel={};toast(`Orden ${o.id} emitida por ${qfmt(o.importe)}.`);afterWrite();}
  },
  async opTransferOpen(d){const o=DB.ordenesPago.find(x=>x.id===d.id);if(!o)return;
    formM({title:`Registrar pago al proveedor · ${o.id}`,text:`${esc(o.proveedor)} · ${(o.viajeIds||[]).length} viaje(s) · <b>${qfmt(o.importe)}</b>.<br>La orden se paga completa: el monto debe ser <b>${qfmt(o.importe)}</b> (si el pago fuera distinto, anula la orden y emítela de nuevo).<br>Se cierra con <b>dos archivos</b>: la evidencia de la transferencia y la factura del proveedor.`,
      fields:[{k:'fecha',label:'Fecha de la transferencia',type:'date',req:1},{k:'monto',label:'Monto pagado (Q)',type:'number',req:1},{k:'referencia',label:'Referencia / número de transferencia',req:1},{k:'evidencia',label:'Evidencia de la transferencia (foto o PDF)',type:'file'},{k:'factura',label:'Factura del proveedor (foto o PDF)',type:'file'}],
      data:{fecha:todayStr(),monto:o.importe,referencia:'',evidencia:'',factura:''},ok:'REGISTRAR PAGO',okCls:'ok',act:'opTransferOk',id:o.id});},
  async opTransferOk(d){const m=S.modal.data,id=S.modal.id;
    if(!m.evidencia){S.modal.err='Adjunta la evidencia de la transferencia.';render();return;}
    if(!m.factura){S.modal.err='Adjunta la factura del proveedor.';render();return;}
    const ext=x=>/^data:application\/pdf/.test(x)?'.pdf':'.png';
    const r=await run(()=>API.registrarTransferencia(S.user.id,id,{fecha:m.fecha,monto:m.monto,referencia:m.referencia,evidencia:{data:m.evidencia,nombre:'transferencia'+ext(m.evidencia)},factura:{data:m.factura,nombre:'factura-proveedor'+ext(m.factura)}}),`Pago de la orden ${id} registrado; la orden quedó PAGADA.`,true);if(r.ok)afterWrite();},
  async opAnularOpen(d){formM({title:`Anular orden de pago ${d.id}`,text:'Solo se anulan órdenes aún no pagadas. Los viajes quedan disponibles para una nueva orden.',fields:[{k:'motivo',label:'Motivo',type:'textarea',req:1}],ok:'ANULAR ORDEN',okCls:'fix',act:'opAnularOk',id:d.id});},
  async opAnularOk(d){const r=await run(()=>API.anularOrdenPago(S.user.id,d.id,S.modal.data.motivo),`Orden ${d.id} anulada.`,true);if(r.ok)afterWrite();},
  async pagoOpen(d){
    const pil=d.tipo==='PILOTO';
    formM({title:pil?`Pago a piloto · viaje #${d.id}`:`Pago a proveedor · viaje #${d.id}`,text:'Registra un pago realizado. Un importe calculado no cuenta como pagado hasta que se registre aquí con su referencia.',fields:[{k:'monto',label:'Monto pagado (Q)',type:'number',req:1},{k:'fecha',label:'Fecha del pago',type:'date',req:1},{k:'referencia',label:'Referencia del pago',req:1}],data:{monto:'',fecha:todayStr(),referencia:''},ok:'REGISTRAR PAGO',okCls:'ok',act:'pagoOk',id:d.id,tipo:d.tipo});
  },
  async pagoOk(d){const m=S.modal.data,tipo=S.modal.tipo;const r=await run(()=>API.registrarPago(S.user.id,{tipo,viajeId:d.id,monto:m.monto,fecha:m.fecha,referencia:m.referencia}),p=>`Pago ${p.id} registrado.`,true);if(r.ok)afterWrite();},
  async anularPagoOpen(d){formM({title:`Anular pago ${d.id}`,text:'El pago se conserva marcado como anulado y deja de contar en los saldos.',fields:[{k:'motivo',label:'Motivo',type:'textarea',req:1}],ok:'ANULAR PAGO',okCls:'fix',act:'anularPagoOk',id:d.id});},
  async anularPagoOk(d){const r=await run(()=>API.anularPago(S.user.id,d.id,S.modal.data.motivo),'Pago anulado.',true);if(r.ok)afterWrite();},
  async finDet(d){let R;try{R=API.resumenFinanciero(S.user.id,finFilters());}catch(e){toast(e.message,'err');return;}const [title,html]=finDetail(d.k,R);formM({title,text:DB.ventana?'El detalle lista los viajes cargados en pantalla (los más recientes); el total de arriba es de toda la base.':'Detalle que explica este total.',summary:html,noCancel:true,ok:'Cerrar',act:'closeModal'});}
});
