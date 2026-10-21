/* =====================================================================
   EXPORTAR FACTURACIÓN · Excel (.xlsx) y PDF con todo el detalle de lo enviado a facturar.
   Se exporta EXACTAMENTE lo que se ve en pantalla (mismos filtros y orden). No sale nada que el usuario no pueda ver:
   los datos vienen de la misma lista que ya filtró el sistema por permisos y alcance.
   El Excel se genera aquí mismo (sin librerías); el PDF usa jsPDF + autoTable incluidos en js/vendor/.
   ===================================================================== */
/* ---------- ZIP sin compresión + XLSX ---------- */
const EXP_CRC=(()=>{const t=new Uint32Array(256);for(let n=0;n<256;n++){let c=n;for(let k=0;k<8;k++)c=c&1?0xEDB88320^(c>>>1):c>>>1;t[n]=c>>>0;}return t;})();
function expCrc32(b){let c=0xFFFFFFFF;for(let i=0;i<b.length;i++)c=EXP_CRC[(c^b[i])&255]^(c>>>8);return (c^0xFFFFFFFF)>>>0;}
function zipStore(files){
  const enc=new TextEncoder(),parts=[],cen=[];let off=0;
  const u16=n=>[n&255,(n>>8)&255],u32=n=>[n&255,(n>>8)&255,(n>>16)&255,(n>>>24)&255];
  const DT=u16(0),DD=u16(((2026-1980)<<9)|(1<<5)|1);
  files.forEach(f=>{
    const nm=enc.encode(f.name),d=f.data,crc=expCrc32(d);
    const lh=new Uint8Array([0x50,0x4b,3,4,...u16(20),...u16(0x0800),...u16(0),...DT,...DD,...u32(crc),...u32(d.length),...u32(d.length),...u16(nm.length),...u16(0)]);
    parts.push(lh,nm,d);
    cen.push(new Uint8Array([0x50,0x4b,1,2,...u16(20),...u16(20),...u16(0x0800),...u16(0),...DT,...DD,...u32(crc),...u32(d.length),...u32(d.length),...u16(nm.length),...u16(0),...u16(0),...u16(0),...u16(0),...u32(0),...u32(off)]),nm);
    off+=lh.length+nm.length+d.length;
  });
  const cenLen=cen.reduce((s,x)=>s+x.length,0);
  const eocd=new Uint8Array([0x50,0x4b,5,6,...u16(0),...u16(0),...u16(files.length),...u16(files.length),...u32(cenLen),...u32(off),...u16(0)]);
  const all=[...parts,...cen,eocd],out=new Uint8Array(all.reduce((s,x)=>s+x.length,0));let p=0;all.forEach(x=>{out.set(x,p);p+=x.length;});return out;
}
const expEsc=s=>String(s).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
function expCol(i){let s='';i++;while(i>0){const m=(i-1)%26;s=String.fromCharCode(65+m)+s;i=Math.floor((i-1)/26);}return s;}
/* hojas: [{nombre, filas:[[celda…]], cabecera:true, filtro:true, anchos:[…]}]  ·  celda = texto | número | {v, s:'m'|'b'|'T'|'mb'} */
const EXP_ESTILO={t:3,m:2,b:4,T:5,mb:6};
function xlsxBuild(hojas){
  const enc=new TextEncoder(),X=s=>enc.encode(s);
  const hojasXml=hojas.map(h=>{
    const filas=h.filas,ncol=Math.max(1,...filas.map(f=>f.length));
    const largo=c=>{const v=c&&typeof c==='object'?c.v:c;return v==null?0:(typeof v==='number'?14:String(v).length);};
    const an=h.anchos||Array.from({length:ncol},(_,j)=>Math.min(50,Math.max(10,...filas.slice(0,400).map(f=>largo(f[j])))+2));
    let sd='';
    filas.forEach((f,i)=>{
      sd+=`<row r="${i+1}"${h.cabecera&&i===0?' ht="30" customHeight="1"':''}>`;
      for(let j=0;j<ncol;j++){
        const c=f[j],r=expCol(j)+(i+1),esCab=h.cabecera&&i===0;
        let v=c&&typeof c==='object'?c.v:c,s=c&&typeof c==='object'?EXP_ESTILO[c.s]||3:3;if(esCab)s=1;
        if(v==null||v==='')sd+=`<c r="${r}" s="${s}"/>`;
        else if(typeof v==='number'&&isFinite(v))sd+=`<c r="${r}" s="${s}"><v>${v}</v></c>`;
        else sd+=`<c r="${r}" s="${s}" t="inlineStr"><is><t xml:space="preserve">${expEsc(v)}</t></is></c>`;
      }
      sd+='</row>';
    });
    const ref=`A1:${expCol(ncol-1)}${filas.length}`;
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><dimension ref="${ref}"/><sheetViews><sheetView workbookViewId="0" showGridLines="0">${h.cabecera?'<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>':''}</sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${an.map((w,j)=>`<col min="${j+1}" max="${j+1}" width="${w}" customWidth="1"/>`).join('')}</cols><sheetData>${sd}</sheetData>${h.filtro&&filas.length>1?`<autoFilter ref="${ref}"/>`:''}<pageMargins left="0.5" right="0.5" top="0.6" bottom="0.6" header="0.3" footer="0.3"/><pageSetup orientation="landscape" fitToHeight="0"/></worksheet>`;
  });
  const estilos=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="4"><font><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="10"/><color rgb="FFFFFFFF"/><name val="Calibri"/></font><font><b/><sz val="10"/><name val="Calibri"/></font><font><b/><sz val="14"/><color rgb="FF005697"/><name val="Calibri"/></font></fonts><fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF005697"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFD0D7DE"/></left><right style="thin"><color rgb="FFD0D7DE"/></right><top style="thin"><color rgb="FFD0D7DE"/></top><bottom style="thin"><color rgb="FFD0D7DE"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="7"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1"><alignment horizontal="center" vertical="center" wrapText="1"/></xf><xf numFmtId="4" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1"/><xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1" applyAlignment="1"><alignment vertical="top"/></xf><xf numFmtId="0" fontId="2" fillId="0" borderId="1" xfId="0" applyFont="1" applyBorder="1"/><xf numFmtId="0" fontId="3" fillId="0" borderId="0" xfId="0" applyFont="1"/><xf numFmtId="4" fontId="2" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyFont="1" applyBorder="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;
  const nom=h=>expEsc(h.nombre.replace(/[\\/?*\[\]:]/g,' ').slice(0,31));
  const archivos=[
    {name:'[Content_Types].xml',data:X(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${hojas.map((h,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`)},
    {name:'_rels/.rels',data:X(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`)},
    {name:'xl/workbook.xml',data:X(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView/></bookViews><sheets>${hojas.map((h,i)=>`<sheet name="${nom(h)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets></workbook>`)},
    {name:'xl/_rels/workbook.xml.rels',data:X(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${hojas.map((h,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}<Relationship Id="rId${hojas.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`)},
    {name:'xl/styles.xml',data:X(estilos)},
    ...hojasXml.map((x,i)=>({name:`xl/worksheets/sheet${i+1}.xml`,data:X(x)}))
  ];
  return zipStore(archivos);
}

/* ---------- Datos: lo que se ve en pantalla, con todo el detalle ---------- */
function expRowsOrdenadas(f){
  const rows=factRows(f),so=S.sortF||{k:'fechaEnvio',dir:-1},col=FC_COLS.find(c=>c[0]===so.k)||FC_COLS[4];
  rows.sort((a,b)=>{const x=col[2](a),y=col[2](b);return (x<y?-1:x>y?1:0)*so.dir||a.id.localeCompare(b.id);});
  return rows;
}
function expFiltrosTxt(){
  const a=[],est={ENV:'Enviadas y emitidas',PREP:'Preparadas (sin enviar)',ANU:'Anuladas',TODAS:'Todas'}[S.fcEstado]||S.fcEstado;
  a.push(['Estado de facturación',est]);
  if(S.fcCli)a.push(['Cliente',(PROYECTOS.find(p=>p.id===S.fcCli)||{}).cliente||S.fcCli]);
  if(S.fcPcat)a.push(['Proyecto',S.fcPcat]);
  const base=S.fcBase==='viaje'?'fecha del viaje':'fecha de envío';
  if(S.fcMes)a.push(['Mes ('+base+')',S.fcMes]);
  if(S.fcSem){const w=weekRange(S.fcSem);a.push(['Semana ('+base+')',S.fcSem+(w?' ('+fmtDate(w[0])+' al '+fmtDate(w[1])+')':'')]);}
  if(S.fcFecha)a.push(['Fecha ('+base+')',fmtDate(S.fcFecha)]);
  if(S.fcDesde||S.fcHasta)a.push(['Rango ('+base+')',(S.fcDesde?fmtDate(S.fcDesde):'inicio')+' al '+(S.fcHasta?fmtDate(S.fcHasta):'hoy')]);
  if(S.fcFechas.length)a.push(['Varias fechas ('+base+')',S.fcFechas.map(fmtDate).join(', ')]);
  if(S.fcQ.trim())a.push(['Búsqueda',S.fcQ.trim()]);
  return a;
}
const expFH=iso=>iso?fmtL(toLocal(new Date(iso))):'';
/* o (opcional): {f: filtros alternos, ids: facturas a incluir, filtros: texto de filtros}. Sin o, exporta lo de la pantalla Facturación de Comercial. */
function expFactDatos(o){
  o=o||{};
  const rows=expRowsOrdenadas(o.f).filter(r=>!o.ids||o.ids.has(r.g.id)),mapa=new Map();
  const viajes=rows.map(r=>{
    const t=r.t,g=r.g,P=PILOTOS.find(p=>p.id===t.pilotoId)||{},F=FLOTA.find(f=>f.unidad===(t.unidadId||P.unidad))||{},R=DB.rutas.find(x=>x.id===t.rutaId)||{};
    const v={cliente:r.cliente,proyecto:r.proyecto,id:t.id,fechaViaje:fmtDate(planD(t)),horaPlan:planT(t),shipment:t.shipment||'',noViaje:t.noViaje||'',producto:t.producto||'',tipoCarga:t.tipoCarga||'',
      rutaCod:R.codigo||'',rutaNom:R.nombre||t.rutaRef||'',origen:nombreOrigen(t.origen||R.origen),destino:nombreDestino(t.destino||R.destino),
      piloto:P.nombre||'',unidad:F.unidad||t.unidadId||'',placa:F.placa||'',capacidad:F.capacidad||'',
      factura:r.factura,grupo:r.grupo,fechaFactura:g.fechaFactura?fmtDate(g.fechaFactura):'',etapa:ETAPA_L[r.etapa]||'',registro:g.estado==='ANULADA'?'Anulada':'Vigente',
      envio:g.envio?expFH(g.envio.en):'',por:r.por||'',tarifa:nn(t.tarifaCliente),importe:r.importe,
      emitida:g.emision?fmtDate(g.emision.fecha):'',evidencia:g.emision?g.emision.evidencia||'':''};
    if(!mapa.has(g.id))mapa.set(g.id,{g,viajes:[]});mapa.get(g.id).viajes.push(v);return v;
  });
  const facturas=[...mapa.values()].map(({g,viajes:vs})=>{
    const cob=(g.cobros||[]),cobrado=r2(cob.reduce((s,c)=>s+(Number(c.monto)||0),0)),fact=g.importeFacturado==null?null:g.importeFacturado;
    const env=g.importeEnviado!=null?g.importeEnviado:null;
    return {g,viajes:vs,id:g.id,factura:g.numeroFactura||'',cliente:vs[0].cliente,modalidad:g.modalidad==='AGRUPADA'?'Agrupada':'Individual',etapa:ETAPA_L[etapaAgr(g)]||'',
      registro:g.estado==='ANULADA'?'Anulada':'Vigente',fechaFactura:g.fechaFactura?fmtDate(g.fechaFactura):'',totalViajes:g.viajeIds.length,enReporte:vs.length,
      importeEnviado:env,envio:g.envio?expFH(g.envio.en):'',envioPor:g.envio?g.envio.por:(g.creadoPor||''),
      emision:g.emision?{fecha:fmtDate(g.emision.fecha),por:g.emision.por,evidencia:g.emision.evidencia||'',motivo:g.emision.motivoDiferencia||''}:null,
      facturado:fact,diferencia:(fact!=null&&env!=null)?r2(fact-env):null,cobros:cob,cobrado:cobrado,saldo:fact!=null?r2(fact-cobrado):null,
      anulada:g.anulada?{por:g.anulada.por||'',en:expFH(g.anulada.en),motivo:g.anulada.motivo||''}:null};
  });
  const sum=(a,f)=>r2(a.reduce((s,x)=>s+(f(x)||0),0));
  const totales={facturas:facturas.length,viajes:viajes.length,importeViajes:sum(viajes,v=>v.importe),sinImporte:viajes.filter(v=>v.importe==null).length,
    enviado:sum(facturas,f=>f.importeEnviado),facturado:sum(facturas,f=>f.facturado),cobrado:sum(facturas,f=>f.cobrado),saldo:sum(facturas,f=>f.saldo)};
  return {filtros:o.filtros||expFiltrosTxt(),facturas,viajes,totales,generado:expFH(new Date().toISOString()),usuario:S.user?S.user.nombre:''};
}
const expM=v=>v==null||v===''?'':{v:v,s:'m'};
function expFactHojas(d){
  const T=d.totales;
  const resumen={nombre:'Resumen',cabecera:false,anchos:[38,60],filas:[
    [{v:'In Transit · Facturación: detalle de lo enviado a facturar',s:'T'}],[],
    [{v:'Generado',s:'b'},d.generado],[{v:'Generado por',s:'b'},d.usuario],[],
    [{v:'Filtros aplicados',s:'b'},''],...d.filtros.map(f=>[f[0],f[1]]),[],
    [{v:'Totales',s:'b'},''],
    ['Facturas incluidas',T.facturas],['Viajes listados',T.viajes],
    ['Importe de los viajes listados (Q)',expM(T.importeViajes)],
    ['Viajes sin importe',T.sinImporte],
    ['Importe enviado a facturar, facturas completas (Q)',expM(T.enviado)],['Importe facturado en facturas emitidas (Q)',expM(T.facturado)],
    ['Cobrado (Q)',expM(T.cobrado)],['Saldo por cobrar de facturas emitidas (Q)',expM(T.saldo)],[],
    [{v:'Nota',s:'b'},'Los totales de factura corresponden a la factura completa; el detalle por viaje muestra solo los viajes que coinciden con los filtros. Los datos faltantes se dejan en blanco (no se inventan importes).']]};
  const facturas={nombre:'Facturas',cabecera:true,filtro:true,filas:[
    ['N.º de factura','ID de agrupación','Cliente','Modalidad','Estado de facturación','Registro','Fecha de factura','Viajes en la factura','Viajes en este reporte','N.º de viajes','Fecha de envío a facturación','Enviada por','Importe enviado (Q)',
     'Fecha de emisión','Emitida por','UUID / serie / autorización','Importe facturado (Q)','Diferencia facturado − enviado (Q)','Motivo de la diferencia','Cobros registrados','Cobrado (Q)','Saldo (Q)','Anulada por','Fecha de anulación','Motivo de anulación'],
    ...d.facturas.map(f=>[f.factura,f.id,f.cliente,f.modalidad,f.etapa,f.registro,f.fechaFactura,f.totalViajes,f.enReporte,f.g.viajeIds.join(', '),f.envio,f.envioPor,expM(f.importeEnviado),
      f.emision?f.emision.fecha:'',f.emision?f.emision.por:'',f.emision?f.emision.evidencia:'',expM(f.facturado),expM(f.diferencia),f.emision?f.emision.motivo:'',
      f.cobros.map(c=>`${fmtDate(c.fecha)} · ${c.referencia||''} · Q ${Number(c.monto).toFixed(2)}`).join('\n'),expM(f.cobros.length?f.cobrado:''),expM(f.saldo),f.anulada?f.anulada.por:'',f.anulada?f.anulada.en:'',f.anulada?f.anulada.motivo:''])]};
  const detalle={nombre:'Detalle por viaje',cabecera:true,filtro:true,filas:[
    ['Cliente','Proyecto','N.º de viaje','Fecha del viaje','Hora planificada','Shipment','N.º de viaje (cliente)','Producto','Tipo de carga','Ruta (código)','Ruta','Origen','Destino','Piloto','Unidad','Placa','Capacidad',
     'N.º de factura','Grupo de viajes','Fecha de factura','Estado de facturación','Registro','Fecha de envío a facturación','Enviado por','Tarifa del cliente (Q)','Importe enviado del viaje (Q)','Fecha de emisión','UUID / serie / autorización'],
    ...d.viajes.map(v=>[v.cliente,v.proyecto,v.id,v.fechaViaje,v.horaPlan,v.shipment,v.noViaje,v.producto,v.tipoCarga,v.rutaCod,v.rutaNom,v.origen,v.destino,v.piloto,v.unidad,v.placa,v.capacidad,
      v.factura,v.grupo,v.fechaFactura,v.etapa,v.registro,v.envio,v.por,expM(v.tarifa),expM(v.importe),v.emitida,v.evidencia])]};
  return [resumen,facturas,detalle];
}
function expDescargar(blob,nombre){
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=nombre;a.rel='noopener';document.body.appendChild(a);a.click();
  setTimeout(()=>{URL.revokeObjectURL(url);a.remove();},4000);
}
const expSello=()=>{const d=new Date(),p=n=>String(n).padStart(2,'0');return `${d.getFullYear()}-${p(d.getMonth()+1)}-${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;};
function expFactXlsx(o){
  const d=expFactDatos(o);if(!d.viajes.length)throw new Error('SIN_DATOS');
  const bytes=xlsxBuild(expFactHojas(d));
  expDescargar(new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}),`Facturacion_${expSello()}.xlsx`);
  return d;
}

/* ---------- PDF ---------- */
/* La fuente estándar del PDF solo tiene caracteres Latin-1: se sustituyen flechas y guiones especiales para que nada salga corrupto */
const expPq=s=>String(s==null?'':s).replace(/[→⇒➜]/g,'>').replace(/[−–—]/g,'-').replace(/…/g,'...').replace(/[“”]/g,'"').replace(/[‘’]/g,"'").replace(/[^\u0000-\u00FF]/g,'?');
const expQ=v=>v==null||v===''?'-':'Q '+Number(v).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});
function expLogo(){return new Promise(res=>{try{const im=new Image();im.onload=()=>{try{const k=Math.min(1,720/im.naturalWidth),c=document.createElement('canvas');c.width=Math.round(im.naturalWidth*k);c.height=Math.round(im.naturalHeight*k);c.getContext('2d').drawImage(im,0,0,c.width,c.height);res({url:c.toDataURL('image/png'),w:c.width,h:c.height});   /* se reduce SOLO el tamaño en píxeles (misma proporción) para que el PDF no pese de más */}catch(e){res(null);}};im.onerror=()=>res(null);im.src=LOGO_COLOR;}catch(e){res(null);}});}
async function expFactPdf(o){
  const d=expFactDatos(o);if(!d.viajes.length)throw new Error('SIN_DATOS');
  if(!(window.jspdf&&window.jspdf.jsPDF))throw new Error('SIN_PDF');
  const doc=new window.jspdf.jsPDF({orientation:'landscape',unit:'pt',format:'a4',compress:true}),W=doc.internal.pageSize.getWidth(),H=doc.internal.pageSize.getHeight(),M=34;
  const AZ=[0,86,151],CL=[232,242,250];
  const logo=await expLogo();
  if(logo){const lw=118,lh=lw*logo.h/logo.w;doc.addImage(logo.url,'PNG',M,28,lw,lh);}
  doc.setFont('helvetica','normal').setFontSize(8).setTextColor(90);
  doc.text(`Generado: ${d.generado}`,W-M,36,{align:'right'});doc.text(`Generado por: ${d.usuario}`,W-M,47,{align:'right'});
  doc.setFont('helvetica','bold').setFontSize(16).setTextColor(...AZ).text('Facturación · Detalle de lo enviado a facturar',M,92);
  doc.setFont('helvetica','normal').setFontSize(8.5).setTextColor(60);
  const ft=expPq('Filtros aplicados: '+d.filtros.map(f=>f[0]+': '+f[1]).join('  |  '));
  const ftl=doc.splitTextToSize(ft,W-2*M);doc.text(ftl,M,108);
  let y=108+ftl.length*11+6;
  const T=d.totales,tbl={theme:'grid',styles:{font:'helvetica',fontSize:8,cellPadding:3,lineColor:[208,215,222],lineWidth:.5},headStyles:{fillColor:AZ,textColor:255,fontStyle:'bold',halign:'center',valign:'middle'},margin:{left:M,right:M,bottom:34},didParseCell:h=>{h.cell.text=h.cell.text.map(expPq);}};
  doc.autoTable({...tbl,startY:y,head:[['Facturas','Viajes listados','Importe de los viajes listados','Enviado a facturar (facturas completas)','Facturado (emitidas)','Cobrado','Saldo por cobrar']],
    body:[[T.facturas,T.viajes,expQ(T.importeViajes)+(T.sinImporte?`\n(${T.sinImporte} sin importe)`:''),expQ(T.enviado),expQ(T.facturado),expQ(T.cobrado),expQ(T.saldo)]],
    styles:{...tbl.styles,halign:'center',fontSize:9},didParseCell:h=>{h.cell.text=h.cell.text.map(expPq);if(h.section==='body')h.cell.styles.fontStyle='bold';}});
  y=doc.lastAutoTable.finalY+16;
  doc.setFont('helvetica','bold').setFontSize(11).setTextColor(...AZ).text('Facturas incluidas',M,y);
  doc.autoTable({...tbl,startY:y+6,styles:{...tbl.styles,fontSize:7.5},head:[['N.º de factura','Cliente','Modalidad','Estado','Fecha factura','Enviada','Enviada por','Viajes','Importe enviado','Facturado','Cobrado','Saldo']],
    body:d.facturas.map(f=>[f.factura||'(sin número)',f.cliente,f.modalidad,f.etapa+(f.registro==='Anulada'?' (anulada)':''),f.fechaFactura||'-',f.envio||'-',f.envioPor||'-',f.enReporte+(f.enReporte!==f.totalViajes?' de '+f.totalViajes:''),expQ(f.importeEnviado),expQ(f.facturado),f.facturado!=null?expQ(f.cobrado):'-',expQ(f.saldo)]),
    columnStyles:{8:{halign:'right'},9:{halign:'right'},10:{halign:'right'},11:{halign:'right'}}});
  /* una sección por factura con todo su detalle */
  d.facturas.forEach((f,ix)=>{
    let yy=M;                                   /* las facturas se acomodan una tras otra; solo salta de página si ya no cabe */
    if(ix===0)doc.addPage();else{yy=doc.lastAutoTable.finalY+22;if(yy>H-210){doc.addPage();yy=M;}}
    const info=[];
    info.push(['Cliente',f.cliente,'Modalidad',f.modalidad+(f.g.modalidad==='AGRUPADA'?' · '+f.id:'')]);
    info.push(['Estado',f.etapa+(f.registro==='Anulada'?' · ANULADA':''),'Fecha de factura',f.fechaFactura||'-']);
    info.push(['Enviada a facturación',(f.envio||'sin enviar')+(f.envio?' por '+f.envioPor:''),'Importe enviado',expQ(f.importeEnviado)]);
    if(f.emision){info.push(['Emitida',f.emision.fecha+' por '+f.emision.por,'Importe facturado',expQ(f.facturado)]);
      info.push(['UUID / serie / autorización',{content:f.emision.evidencia||'-',colSpan:3}]);
      if(f.diferencia)info.push(['Diferencia facturado - enviado',expQ(f.diferencia),'Motivo',f.emision.motivo||'-']);}
    if(f.cobros.length)info.push(['Cobros',{content:f.cobros.map(c=>`${fmtDate(c.fecha)} · ref. ${c.referencia||'-'} · ${expQ(c.monto)} (${c.por||''})`).join('\n'),colSpan:3}]);
    if(f.facturado!=null)info.push(['Cobrado',expQ(f.cobrado),'Saldo por cobrar',expQ(f.saldo)]);
    if(f.anulada)info.push(['Anulada',f.anulada.en+' por '+f.anulada.por,'Motivo',f.anulada.motivo||'-']);
    doc.autoTable({...tbl,startY:yy,styles:{...tbl.styles,fontSize:8},
      head:[[{content:`Factura ${f.factura||'(sin número)'}  ·  ${f.cliente}`,colSpan:4,styles:{halign:'left',fontSize:11}}]],
      body:info,columnStyles:{0:{fontStyle:'bold',fillColor:CL,cellWidth:150},2:{fontStyle:'bold',fillColor:CL,cellWidth:110}},
      didParseCell:h=>{h.cell.text=h.cell.text.map(expPq);if(h.section==='body'&&h.column.index===1&&h.row.raw&&h.row.raw[0]==='UUID / serie / autorización')h.cell.styles.fontStyle='normal';}});
    yy=doc.lastAutoTable.finalY+10;
    const vs=f.viajes;
    doc.autoTable({...tbl,startY:yy,styles:{...tbl.styles,fontSize:7,cellPadding:2.5},
      head:[['N.º viaje','Fecha del viaje','Proyecto','Shipment','Ruta','Origen / Destino','Piloto','Unidad (placa)','Capacidad','Tarifa cliente','Importe del viaje']],
      body:vs.map(v=>['#'+v.id,v.fechaViaje+' '+v.horaPlan,v.proyecto,v.shipment||'-',(v.rutaCod?v.rutaCod+'\n':'')+(v.rutaNom||''),(v.origen||'-')+'\na '+(v.destino||'-'),v.piloto||'-',(v.unidad||'-')+(v.placa?'\n('+v.placa+')':''),v.capacidad||'-',expQ(v.tarifa),expQ(v.importe)]),
      foot:[[{content:vs.length===1?'Total del viaje listado':`Total de los ${vs.length} viajes listados`,colSpan:10,styles:{halign:'right'}},expQ(r2(vs.reduce((s,v)=>s+(v.importe||0),0)))]],
      footStyles:{fillColor:CL,textColor:20,fontStyle:'bold'},columnStyles:{9:{halign:'right'},10:{halign:'right'}},showFoot:'lastPage'});
  });
  const n=doc.getNumberOfPages();
  for(let i=1;i<=n;i++){doc.setPage(i);doc.setFont('helvetica','normal').setFontSize(7.5).setTextColor(120);
    doc.text('In Transit · innovative outsourcing  ·  Facturación: detalle de lo enviado a facturar',M,H-16);doc.text(`Página ${i} de ${n}`,W-M,H-16,{align:'right'});}
  doc.save(`Facturacion_${expSello()}.pdf`);
  return d;
}

/* Finanzas → Facturación e ingresos (Gerencia y Administradora): exporta las facturas del periodo y filtros de esa pantalla */
function expFinOpts(){
  let R=null;try{R=API.resumenFinanciero(S.user.id,finFilters());}catch(x){}
  const ids=new Set(R?R.agrRows.map(r=>r.id):[]);
  const fil=[['Origen','Finanzas · Facturación e ingresos'],['Periodo (fecha del viaje)',(S.fDesde?fmtDate(S.fDesde):'inicio')+' al '+(S.fHasta?fmtDate(S.fHasta):'hoy')]];
  if(S.fCli)fil.push(['Cliente',(PROYECTOS.find(p=>p.id===S.fCli)||{}).cliente||S.fCli]);
  if(S.fPcat)fil.push(['Proyecto',S.fPcat]);
  if(S.fProv)fil.push(['Proveedor',S.fProv]);
  fil.push(['Estado de facturación','Enviadas y emitidas (facturas vigentes)']);
  return {f:{fcEstado:'ENV',fcBase:'envio',fcCli:'',fcPcat:'',fcMes:'',fcSem:'',fcFecha:'',fcDesde:'',fcHasta:'',fcFechas:[],fcQ:''},ids,filtros:fil};
}
