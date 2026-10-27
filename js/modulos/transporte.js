/* =====================================================================
   MÓDULO: TRANSPORTE · viajes, liquidaciones y rutas
   Registrar/editar viajes, enviarlos a ruta, entregarlos, liquidar y gestionar rutas.
   ===================================================================== */

/* ---- Viajes del encargado ---- */
const VT=[
  {k:'plan',l:'Planificados',f:t=>t.estado==='PLANIFICADO',d:'Viajes iniciales: requieren cliente y ruta; se completan antes de salir.'},
  {k:'ruta',l:'En ruta',f:t=>t.estado==='EN_RUTA',d:'Viajes en recorrido con los datos operativos completos.'},
  {k:'liq',l:'Por liquidar',f:t=>['ENTREGADO','RECHAZADO'].includes(t.estado),d:'Entregados pendientes de evidencia, o rechazados que Operaciones debe corregir.'},
  {k:'val',l:'Por validar',f:t=>t.estado==='LIQUIDADO',d:'Liquidaciones enviadas, pendientes de aceptación o devolución.'},
  {k:'cierre',l:'Cerrados',f:t=>['LIQUIDADO','ACEPTADO','FACTURADO','COBRADO'].includes(t.estado),d:'Viajes en validación, facturación o cobro.'}
];
/* La revisión de liquidaciones (aprobar o devolver con comentario) vive en VIAJES → «Por validar».
   En LIQUIDACIONES quedan solo las pestañas de trabajo: por liquidar, rechazados y aceptados. */
VIEWS.viajes=()=>{
  const vt=VT.filter(t=>t.k!=='val'||hp('liq_ver'));
  const ts=vis(),k0=S.tab.viajes||'plan',k=vt.some(x=>x.k===k0)?k0:vt[0].k,cur=vt.find(x=>x.k===k)||vt[0],list=ts.filter(cur.f);
  if(k==='val')return `<div class="inner" style="max-width:1400px">${pageHead('Viajes',`${list.length} ${list.length===1?'liquidación':'liquidaciones'} por validar`)}${tabs('viajes',vt,k,ts)}<div class="tabdesc">${cur.d}</div>
    <div class="lfilters"><input type="text" id="q" placeholder="Buscar por viaje, cliente, piloto o fecha (dd/mm/aaaa)" value="${esc(S.q)}" aria-label="Buscar">
    <select data-flt="fCli" aria-label="Cliente"><option value="">Todos los clientes</option>${PROYECTOS.map(p=>`<option value="${p.id}" ${S.fCli===p.id?'selected':''}>${esc(p.cliente)}</option>`).join('')}</select>
    <select data-flt="fPcat" aria-label="Proyecto"><option value="">Todos los proyectos</option>${CAT.proyectos.map(p=>`<option ${S.fPcat===p?'selected':''}>${esc(p)}</option>`).join('')}</select>
    <label class="dlab">Desde <input type="date" data-flt="fDesde" value="${esc(S.fDesde)}"></label><label class="dlab">Hasta <input type="date" data-flt="fHasta" value="${esc(S.fHasta)}"></label>
    <button class="btn sm" data-act="limpiarFiltros">Limpiar filtros</button></div>
    <div id="vb">${BODY.viajes()}</div></div>`;
  return `<div class="inner" style="max-width:none">${pageHead('Viajes',`${list.length} ${list.length===1?'viaje':'viajes'} en esta pestaña`,hp('viajes_crear')?`<button class="btn primary" data-act="nav" data-v="nuevo">${icon('plus',18)} Nuevo viaje</button>`:'')}
    ${tabs('viajes',vt,k,ts)}<div class="tabdesc">${cur.d}</div>
    ${viajesTable(list)}</div>`;
};


/* Cuerpo actualizable de la pestaña «Por validar» (para que el buscador filtre sin recargar la pantalla).
   En las otras pestañas de Viajes no hay #vb, así que devolver '' no afecta a nada. */
BODY.viajes=()=>{
  const cur=VT.find(x=>x.k===(S.tab.viajes||'plan'));
  if(!cur||cur.k!=='val')return '';
  return liqTable(liqFilter(vis().filter(cur.f)),'rev');
};

const curModel=()=>S.edit?S.edit.data:S.form;
function initForm(){
  const d=new Date();d.setMinutes(Math.ceil(d.getMinutes()/5)*5);
    const m={proyecto:esEnc()?(clientesAsig(S.user).length===1?clientesAsig(S.user)[0]:''):(S.user.rol==='ADMIN'?'':(clientesAsig(S.user)[0]||'')),proyectoCat:'',estado:'',shipment:'',noViaje:'',opl:'',tipoViaje:'',tipoCarga:'',noCarga:'',producto:'',placaArrastre:'',placaArrastreOtro:'',
    fechaPlanD:todayStr(),fechaPlanT:pad(d.getHours())+':'+pad(d.getMinutes()),pilotoId:'',placaSel:'',rutaId:'',rutaRef:'',sinRuta:false,desvio:false,desvioDestino:'',noDocRetorno:'',qViaticos:'',gastosAdicionales:[],savedId:null,err:''};
  TKEYS.forEach(k=>m[k]='');DVKEYS.forEach(k=>m[k]='');
  const pc=usaCombo()?(m.proyecto?proyectosAsig(S.user,m.proyecto):[]):PROYECTOS_X[m.proyecto];if(pc&&pc.length===1)m.proyectoCat=pc[0];
  return m;
}
function toModel(t){
  const m={proyecto:t.proyecto,fechaPlanD:planD(t),fechaPlanT:planT(t),err:''};
  ['proyectoCat','estado','shipment','noViaje','opl','tipoViaje','tipoCarga','noCarga','producto','placaArrastre','placaArrastreOtro','pilotoId','rutaId','rutaRef','noDocRetorno','qViaticos',...TKEYS].forEach(k=>m[k]=t[k]==null?'':t[k]);
  m.gastosAdicionales=Array.isArray(t.gastosAdicionales)?t.gastosAdicionales.map(x=>({concepto:x.concepto,importe:x.importe,detalle:x.detalle||''})):[];
  m.placaSel=t.unidadId||'';                      /* la unidad del viaje se edita como «placa» */
  return m;
}

/* ---- Encargado de proyecto · Proyecto y Ruta del formulario: solo datos reales, sin repetidos, con mensajes claros ---- */
const FALTA='__falta__';
const normTxt=x=>String(x==null?'':x).normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
const rutaEtiqueta=r=>String(r.nombre||'').trim()||String(r.codigo||'').trim()||r.id;
function catalogoFalla(){
  if(BACKEND.modo==='supabase'){
    if(!navigator.onLine)return 'Sin conexión con el servidor: no se pueden cargar los proyectos ni las rutas.';
    if(!BACKEND.conectado)return 'No se pudieron cargar los datos desde el servidor.';
  }
  return '';
}
const REINTENTAR=' <button type="button" class="linkbtn" data-act="reintentarCatalogos">Reintentar</button>';
const claveRuta=r=>r.cliente+'|'+r.proyecto+'|'+normTxt(rutaEtiqueta(r));
/* Rutas activas que el usuario puede elegir. Se puede empezar por la ruta; al elegirla se completan cliente y proyecto.
   Cada ruta se muestra UNA vez (los registros repetidos se agrupan sin borrar nada) y conserva sus combinaciones origen/destino. */
function rutasGrupos(M){
  const A=S.user,clis=M.proyecto?[M.proyecto]:clientesAsig(A);
  const rs=catalogoFalla()?[]:DB.rutas.filter(r=>r.estado==='ACTIVA'&&clis.includes(r.cliente)&&(!M.proyectoCat||r.proyecto===M.proyectoCat)&&rutaVisible(A,r));
  const actual=(M.rutaId&&M.rutaId!=='NO_ASIGNADA')?DB.rutas.find(x=>x.id===M.rutaId):null;
  const filas=(actual&&!rs.some(r=>r.id===actual.id))?[...rs,actual]:rs;
  const mapa=new Map();
  filas.forEach(r=>{const k=claveRuta(r);if(!mapa.has(k))mapa.set(k,{key:k,cliente:r.cliente,proyecto:r.proyecto,nombre:rutaEtiqueta(r),filas:[]});mapa.get(k).filas.push(r);});
  const grupos=[...mapa.values()].map(g=>{
    const vistos=new Map();
    g.filas.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id))).forEach(r=>{const o=r.origen||FALTA,d=r.destino||FALTA;if(!vistos.has(o+'|'+d))vistos.set(o+'|'+d,{o,d,id:r.id});});
    return {key:g.key,cliente:g.cliente,proyecto:g.proyecto,nombre:g.nombre,combos:[...vistos.values()]};
  });
  const veces={};grupos.forEach(g=>{const n=normTxt(g.nombre);veces[n]=(veces[n]||0)+1;});
  grupos.forEach(g=>{g.etiqueta=veces[normTxt(g.nombre)]>1?`${g.nombre} · ${(PROYECTOS.find(p=>p.id===g.cliente)||{}).cliente||g.cliente} / ${g.proyecto}`:g.nombre;});
  return grupos.sort((a,b)=>a.etiqueta.localeCompare(b.etiqueta,'es'));
}
function estadoRuta(M){
  const grupos=rutasGrupos(M),actual=(M.rutaId&&M.rutaId!=='NO_ASIGNADA')?DB.rutas.find(x=>x.id===M.rutaId):null;
  const key=M.rutaGrupo||(actual?claveRuta(actual):''),g=grupos.find(x=>x.key===key)||null;
  if(!g)return {grupos,g:null};
  const os=[...new Set(g.combos.map(c=>c.o))];
  let o=(M.rutaO&&os.includes(M.rutaO))?M.rutaO:(os.length===1?os[0]:'');
  if(!o&&actual){const c=g.combos.find(x=>x.id===actual.id);if(c)o=c.o;}
  const ds=[...new Set(g.combos.filter(c=>!o||c.o===o).map(c=>c.d))];
  let d=(M.rutaD&&ds.includes(M.rutaD))?M.rutaD:(ds.length===1?ds[0]:'');
  if(!d&&actual){const c=g.combos.find(x=>x.id===actual.id&&x.o===o);if(c)d=c.d;}
  const combo=(o&&d)?(g.combos.find(c=>c.o===o&&c.d===d)||null):null;
  return {grupos,g,os,o,ds,d,combo};
}
function resolverRuta(M){const e=estadoRuta(M);M.rutaId=e.combo?e.combo.id:'';}
function aplicarCampo(M,k,v){
  M[k]=v;if('err' in M)M.err='';
  const limpiaRuta=()=>{M.rutaId='';M.rutaRef='';M.rutaGrupo='';M.rutaO='';M.rutaD='';};
  if(k==='proyecto'){M.desvioDestino='';M.proyectoCat='';M.pilotoId='';M.placaSel='';limpiaRuta();const pc=M.proyecto?proyectosAsig(S.user,M.proyecto):[];if(pc.length===1)M.proyectoCat=pc[0];}
  if(k==='proyectoCat')limpiaRuta();
  if(k==='rutaGrupo'){
    M.rutaO='';M.rutaD='';if(v)M.sinRuta=false;
    if(v==='NO_ASIGNADA')M.rutaId='NO_ASIGNADA';
    else{M.rutaRef='';const g=rutasGrupos(M).find(x=>x.key===v);if(g){if(M.proyecto!==g.cliente){M.proyecto=g.cliente;M.pilotoId='';M.placaSel='';M.desvioDestino='';}M.proyectoCat=g.proyecto;}resolverRuta(M);}   /* cliente y proyecto salen de la ruta elegida */
  }
  if(k==='rutaO'||k==='rutaD')resolverRuta(M);
  if(k==='placaSel'){
    /* El piloto asignado a la unidad se propone solo; si hay más de uno (o ninguno) se elige a mano.
       Se conserva el piloto actual si puede ir con esa unidad (los pilotos sin unidad también pueden). */
    const ps=pilotosElegibles(M.proyecto,v),asig=pilotosDePlaca(M.proyecto,v);
    if(!ps.some(p=>p.id===M.pilotoId)){
      M.pilotoId='';
      if(asig.length===1)M.pilotoId=asig[0].id;                 /* el asignado a la unidad */
      else if(!asig.length&&ps.length===1)M.pilotoId=ps[0].id;  /* unidad sin piloto: único piloto disponible */
    }
    /* El arrastre se propone con el último que usó esa unidad. */
    const ua=ultimoArrastreDeUnidad(v);if(ua)M.placaArrastre=ua;
  }
  if(k==='pilotoId'&&v){const P=PILOTOS.find(p=>p.id===v);if(P&&P.unidad)M.placaSel=P.unidad;}   /* la placa arranca con la del piloto; se puede cambiar, siempre del mismo cliente */
  if(k==='pilotoAlt')M.pilotoId=v;                                                                              /* solo si la placa tiene más de un piloto asignado */
  if(k==='pilotoId'&&v)S.flash=true;
}

/* =====================================================================
   ADMINISTRADOR · Clientes (tabla), Facturación (viaje), Nuevo viaje (placa), Rutas (catálogo desplegable)
   ===================================================================== */
const cliNombre=id=>(DB.clientes.find(c=>c.id===id)||{}).nombre||(PROYECTOS.find(p=>p.id===id)||{}).cliente||id;
const kvr=(k,x)=>`<dt>${k}</dt><dd>${x}</dd>`;      /* (en el detalle de viaje existe una versión local idéntica) */
const vacioTxt=v=>(v==null||String(v).trim()==='')?'<span class="mute">—</span>':esc(v);
function torreCfgAdmin(){return `<section class="section"><h2>Torre de Control</h2><div class="mute" style="margin:-6px 0 10px;font-size:13px">Torre solo avanza el estado (En ruta / Entregado) de los viajes de los clientes marcados; no edita otros datos.</div>
      <div class="grid g2"><div class="card"><h3>Clientes cuyo estado puede avanzar</h3>${DB.clientes.map(c=>`<label style="display:flex;gap:10px;align-items:center;min-height:36px"><input type="checkbox" data-torre="${c.id}" ${c.torreEstatus?'checked':''}> <b>${esc(c.nombre)}</b></label>`).join('')}</div></div></section>`;}
function clientesAdminHTML(){
  const gest=hp('clientes_gestionar');
  const lista=DB.clientes.slice().sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));
  const q = (S.qCli||'').trim().toLowerCase();
  const filas=lista.filter(c=>!q || (c.id+' '+c.nombre+' '+c.cliente+' '+(c.nit||'')+' '+(c.proyectos||[]).join(' ')).toLowerCase().includes(q));
  const link=u=>/^https?:\/\//i.test(String(u||'').trim())?`<a href="${esc(String(u).trim())}" target="_blank" rel="noopener noreferrer">Abrir contrato</a>`:vacioTxt(u);
  const cab=['ID cliente','Cliente','Cliente padre','Servicio','Nombre usuario','Correo','Teléfono','Link contrato','NIT','Proyecto','Estado','Creado','Acciones'];
  const pg=paginar('cli',filas);
  const tabla=!lista.length
    ?`<div class="alertbox info"><b>No hay clientes registrados.</b> ${catalogoFalla()?esc(catalogoFalla()):'La base de datos no devolvió clientes.'}${REINTENTAR}</div>`
    :`<div class="xlwrap" style="max-height:none"><table class="xl" id="tablaClientes" style="min-width:1750px"><thead><tr>${cab.map(h=>`<th${h==='Acciones'?' class="stkR"':''}>${h}</th>`).join('')}</tr></thead><tbody>
      ${pg.filas.map(c=>`<tr class="${c.activo===false?'dim':''}"><td><b>${esc(c.id)}</b></td><td>${esc(c.nombre)}</td><td>${vacioTxt(c.clientePadre)}</td><td>${vacioTxt(c.servicio)}</td><td>${vacioTxt(c.contacto)}</td><td>${vacioTxt(c.correoFacturacion)}</td><td>${vacioTxt(c.telefono)}</td><td>${link(c.linkContrato)}</td><td>${c.nit?esc(c.nit):'<span class="warnl">Pendiente</span>'}</td><td style="white-space:normal;min-width:160px">${(c.proyectos||[]).length?esc(c.proyectos.join(', ')):'<span class="warnl">Sin proyectos</span>'}</td><td>${chip(c.activo===false?'neutral':'done',c.activo===false?'Inactivo':'Activo')}</td><td>${c.creadoEn?fmtDT(c.creadoEn):'<span class="mute">—</span>'}${c.creadoPor?`<br><span class="mute">${esc(c.creadoPor)}</span>`:''}</td><td class="stkR" style="white-space:nowrap">${gest?`<button class="btn sm" data-act="clienteOpen" data-id="${c.id}">Editar</button> <button class="btn sm ${c.activo===false?'ok':'fix'}" data-act="clienteEstado" data-id="${c.id}">${c.activo===false?'Activar':'Desactivar'}</button> `:''}<button class="btn sm ghost" data-act="proj" data-id="${c.id}">Ver viajes</button></td></tr>`).join('')}
      </tbody></table></div>${paginador('cli',pg)}`;
  return `<div class="inner" style="max-width:none">${pageHead('Clientes','Tabla de clientes: contacto, contrato, NIT y proyectos',gest?`<button class="btn primary" data-act="clienteOpen" data-id="">${icon('plus',18)} Nuevo cliente</button>`:'')}
    ${lista.length?`<div style="margin-bottom:12px;max-width:440px"><input type="text" id="qCli" placeholder="Buscar por cliente, NIT, código o proyecto" value="${esc(S.qCli||'')}" aria-label="Buscar clientes"></div>`:''}
    ${tabla}
    ${gest?`<details class="section" id="cfgTorre" style="margin-top:18px"><summary style="cursor:pointer;font-weight:700">Configuración de Torre de Control</summary>${torreCfgAdmin()}</details>`:''}</div>`;
}

/* Aviso (no bloquea) si el piloto elegido tiene documentos vencidos o por vencer. */
function docAviso(id){
  const P=PILOTOS.find(p=>p.id===id);if(!P)return '';
  const E=estadoDocumentos(P);if(E.ok)return '';
  const t=E.docs.filter(d=>d.estado!=='VIGENTE').map(d=>d.label+' '+DOC_ESTADO_LBL[d.estado].toLowerCase()+(d.vence?' ('+fmtDate(d.vence)+')':'')).join(' · ');
  return `<div class="alertbox" role="alert" style="margin-top:8px"><b>Documentos del piloto:</b> ${esc(t)}</div>`;
}
/* ---- Nuevo viaje · placa del equipo: la relación placa → unidad → piloto se resuelve sola ---- */
function pilotosDePlaca(cliente,unidad){return PILOTOS.filter(p=>p.activo!==false&&p.proyecto===cliente&&p.unidad&&p.unidad===unidad);}
/* Pilotos que se pueden elegir para esa unidad: los asignados a ella y los que no tienen unidad asignada.
   El piloto asignado a la unidad se propone solo, pero se puede cambiar para ese viaje:
   en ese caso el viaje guarda la nota «piloto no asignado a unidad». */
function pilotosElegibles(cliente,unidad){
  if(!unidad)return [];
  const dePlaca=pilotosDePlaca(cliente,unidad);
  const sinUnidad=PILOTOS.filter(p=>p.activo!==false&&p.proyecto===cliente&&!p.unidad);
  return [...dePlaca,...sinUnidad];
}
/* Equipo de arrastre que no está en la lista: se escribe la placa a mano. */
const ARRASTRE_OTRO='__OTRO__';
const arrastreFinal=M=>String(M.placaArrastre===ARRASTRE_OTRO?(M.placaArrastreOtro||''):(M.placaArrastre||'')).trim();
const esPilotoDeUnidad=(pilotoId,unidad)=>{const P=PILOTOS.find(p=>p.id===pilotoId);return !!(P&&unidad&&String(P.unidad||'')===unidad);};
/* Equipos de arrastre (placas de remolque) disponibles: la lista del sistema (Catálogos), las placas de
   flota que parecen arrastre (empiezan con TC) y las que ya se usaron en viajes. */
function arrastresDisponibles(){
  const set=new Set();
  (CAT.arrastre||[]).forEach(v=>{const s=String(v==null?'':v).trim();if(s)set.add(s);});
  FLOTA.forEach(f=>{const p=String(f.placa||'').trim();if(/^TC/i.test(p))set.add(p);});
  DB.trips.forEach(t=>{const p=String(t.placaArrastre||'').trim();if(p)set.add(p);});
  return [...set].sort((a,b)=>a.localeCompare(b,'es'));
}
/* Último arrastre que usó esa unidad: se propone al registrar el viaje. */
function ultimoArrastreDeUnidad(unidad){
  if(!unidad)return '';
  const usados=DB.trips.filter(t=>t.unidadId===unidad&&String(t.placaArrastre||'').trim())
    .sort((a,b)=>String(b.fechaPlan||'').localeCompare(String(a.fechaPlan||'')));
  return usados.length?String(usados[0].placaArrastre).trim():'';
}
/* Placa del equipo de arrastre: va en la sección de la unidad. Se propone el último arrastre que usó esa
   unidad y se elige de la lista; si el equipo no está en la lista se escribe la placa a mano (queda en la
   lista para los próximos viajes, porque la lista también incluye las placas ya usadas en viajes). */
const etiquetaPlaca=f=>f?(String(f.placa||f.unidad||'')+(f.capacidad?' · '+f.capacidad:'')):'';
function placasDe(cliente){const m=new Map();PILOTOS.filter(p=>p.activo!==false&&p.proyecto===cliente&&p.unidad).forEach(p=>{const f=FLOTA.find(x=>x.unidad===p.unidad);if(f&&!m.has(f.unidad))m.set(f.unidad,f);});return [...m.values()].sort((a,b)=>String(a.placa).localeCompare(String(b.placa),'es'));}
function autoPlaca(M,plSel,ps){
  const U=plSel?FLOTA.find(x=>x.unidad===plSel):null;
  if(!U)return `<div class="auto empty2">Elige la placa: la unidad, el Tango, el tipo de unidad, la capacidad y el piloto asignado se cargan solos.</div>`;
  const P=PILOTOS.find(p=>p.id===M.pilotoId);
  const aviso=!ps.length?`<div class="auto" style="border-color:var(--fix);background:var(--fix-bg);margin-bottom:10px"><div class="ah" style="color:var(--fix)">${icon('alert',18)} Esta placa no tiene un piloto asignado para este cliente</div><div>El viaje necesita un piloto. Pide a administración que asigne la unidad ${esc(U.unidad)} a un piloto en la lista de pilotos.</div></div>`:'';
  const fuera=!!P&&!esPilotoDeUnidad(M.pilotoId,U.unidad);
  const avisoNota=fuera?`<div class="auto" id="notaPilotoUnidad" style="border-color:var(--fix);background:var(--fix-bg);margin-bottom:10px"><div class="ah" style="color:var(--fix)">${icon('alert',18)} ${esc(NOTA_PILOTO)}</div><div>${esc(P.nombre)} no está asignado a la unidad ${esc(U.placa||U.unidad)}; se puede usar en este viaje y la nota queda guardada en el viaje.</div></div>`:'';
  return aviso+avisoNota+`<div class="auto ${S.flash?'flash':''}"><div class="ah">${icon('check',18)} Datos cargados automáticamente</div><div class="cells">
    <div class="cell"><small>Placa ${src('FLOTA')}</small><b>${esc(U.placa)}</b></div>
    <div class="cell"><small>Capacidad ${src('FLOTA')}</small><b>${esc(U.capacidad)}</b></div>
    <div class="cell"><small>${fuera?'Piloto del viaje':'Piloto asignado'} ${src('PILOTOS')}</small><b>${P?esc(P.nombre):'<span class="mute">por definir</span>'}</b></div></div></div>`;
}
/* ---- Rutas · catálogo desplegable (cada ruta una vez) con origen/destino ---- */
function agruparRutas(filas){
  const mapa=new Map();
  filas.forEach(r=>{const k=claveRuta(r);if(!mapa.has(k))mapa.set(k,{key:k,cliente:r.cliente,proyecto:r.proyecto,nombre:rutaEtiqueta(r),filas:[]});mapa.get(k).filas.push(r);});
  const gs=[...mapa.values()].map(g=>{const v=new Map();g.filas.forEach(r=>{const o=r.origen||FALTA,d=r.destino||FALTA;if(!v.has(o+'|'+d))v.set(o+'|'+d,{o,d});});return {key:g.key,cliente:g.cliente,proyecto:g.proyecto,nombre:g.nombre,filas:g.filas,combos:[...v.values()],activa:g.filas.some(r=>r.estado==='ACTIVA')};});
  const veces={};gs.forEach(g=>{const n=normTxt(g.nombre);veces[n]=(veces[n]||0)+1;});
  gs.forEach(g=>{g.etiqueta=(veces[normTxt(g.nombre)]>1?`${g.nombre} · ${cliNombre(g.cliente)} / ${g.proyecto}`:g.nombre)+(g.activa?'':' (no activa)');});
  return gs.sort((a,b)=>a.etiqueta.localeCompare(b.etiqueta,'es'));
}
function rutasCatalogoAdmin(todas){
  const falla=catalogoFalla()||RUTAS_ERR;
  if(falla)return `<div class="alertbox" role="alert" style="margin-bottom:12px"><b>No se pudieron cargar las rutas.</b> ${esc(falla)}${REINTENTAR}</div>`;
  if(!todas.length)return `<div class="alertbox info" style="margin-bottom:12px"><b>No hay rutas registradas.</b> La base de datos no devolvió ninguna ruta para tu usuario: puede que aún no se hayan cargado o registrado.${REINTENTAR}</div>`;
  const gs=agruparRutas(todas),g=gs.find(x=>x.key===S.rtCat)||null;
  const opts=[{id:'',nombre:'Todas las rutas'}].concat(gs.map(x=>({id:x.key,nombre:x.etiqueta})));
  let det='';
  if(g){
    const os=[...new Set(g.combos.map(c=>c.o))],o=(S.rtOrig&&os.includes(S.rtOrig))?S.rtOrig:(os.length===1?os[0]:'');
    const ds=[...new Set(g.combos.filter(c=>!o||c.o===o).map(c=>c.d))],d=(S.rtDest&&ds.includes(S.rtDest))?S.rtDest:(ds.length===1?ds[0]:'');
    const nO=x=>x===FALTA?'Sin registrar':nombreOrigen(x),nD=x=>x===FALTA?'Sin registrar':nombreDestino(x);
    const selOD=(k,vals,cur,fn,rot)=>vals.length>1?`<select data-flt="${k}" aria-label="${rot}"><option value="">Selecciona el ${rot.toLowerCase()} (${vals.length} opciones)</option>${vals.map(x=>`<option value="${esc(x)}" ${x===cur?'selected':''}>${esc(fn(x))}</option>`).join('')}</select>`:`<b>${vals[0]===FALTA?'<span class="warnl">No registrado</span>':esc(fn(vals[0]))}</b>`;
    det=`<div class="card" style="margin-bottom:12px" id="detalleRuta"><h3 style="margin:0 0 8px">${esc(g.nombre)}</h3><dl class="kv" style="grid-template-columns:repeat(2,minmax(0,150px) minmax(0,1fr));gap:8px 14px">${kvr('Cliente',esc(cliNombre(g.cliente)))}${kvr('Proyecto',esc(g.proyecto))}${kvr('Origen',selOD('rtOrig',os,o,nO,'Origen'))}${kvr('Destino',selOD('rtDest',ds,d,nD,'Destino'))}${kvr('Estado',[...new Set(g.filas.map(r=>r.estado))].map(e=>rutaChip(e)).join(' '))}${kvr('Viajes',String(g.filas.reduce((n,r)=>n+(r.viajes||0),0)))}</dl></div>`;
  }
  return `<div class="lfilters" style="grid-template-columns:minmax(240px,420px) 1fr;align-items:center;margin-bottom:10px"><div>${comboHTML('rtCat',S.rtCat||'',opts,'Todas las rutas')}</div><span class="mute">${gs.length} ${gs.length===1?'ruta':'rutas'} · cada ruta se muestra una sola vez</span></div>${det}`;
}
function rutasVacioAdmin(todas){
  const falla=catalogoFalla()||RUTAS_ERR;
  if(falla)return `<div class="alertbox" role="alert"><b>No se pudieron cargar las rutas.</b> ${esc(falla)}${REINTENTAR}</div>`;
  if(!todas.length)return `<div class="alertbox info"><b>No hay rutas registradas.</b> La base de datos no devolvió ninguna ruta para tu usuario.${REINTENTAR}</div>`;
  return empty('No hay rutas con estos filtros','Cambia la búsqueda o limpia los filtros.');
}
function autoCard(M){
  const P=PILOTOS.find(p=>p.id===M.pilotoId);
  const U=(M.placaSel?FLOTA.find(x=>x.unidad===M.placaSel):null)||(P&&P.unidad?FLOTA.find(x=>x.unidad===P.unidad):null);
  let h;
  if(!P)h=`<div class="auto empty2">Elige un piloto: se carga su placa y su capacidad. Puedes cambiarle la placa dentro del mismo cliente.</div>`;
  else if(!U)h=`<div class="auto" style="border-color:var(--fix);background:var(--fix-bg)"><div class="ah" style="color:var(--fix)">${icon('alert',18)} La placa elegida no está en la flota</div><div>Elige otra placa de este cliente o pide a administración que revise la asignación.</div></div>`;
  else h=`<div class="auto ${S.flash?'flash':''}"><div class="ah">${icon('check',18)} Datos cargados automáticamente · no hay que escribirlos</div><div class="cells">
    <div class="cell"><small>Placa ${src('FLOTA')}</small><b>${esc(U.placa)}</b></div>
    <div class="cell"><small>Capacidad ${src('FLOTA')}</small><b>${esc(U.capacidad)}</b></div>
    <div class="cell"><small>Piloto ${src('PILOTOS')}</small><b>${esc(P.nombre)}</b></div></div></div>`;
  if(h&&U&&P&&!esPilotoDeUnidad(M.pilotoId,U.unidad))h=`<div class="auto" id="notaPilotoUnidad" style="border-color:var(--fix);background:var(--fix-bg);margin-bottom:10px"><div class="ah" style="color:var(--fix)">${icon('alert',18)} ${esc(NOTA_PILOTO)}</div><div>${esc(P.nombre)} no está asignado a la unidad ${esc(U.placa||U.unidad)}; se puede usar en este viaje y la nota queda guardada en el viaje.</div></div>`+h;
  S.flash=false;return h;
}
function arrastreCampo(M,plSel,arrastres,fcombo){
  const falta=!plSel,otro=M.placaArrastre===ARRASTRE_OTRO;
  const opts=arrastres.map(p=>({id:p,nombre:p}));
  if(M.placaArrastre&&!otro&&!arrastres.includes(M.placaArrastre))opts.push({id:M.placaArrastre,nombre:M.placaArrastre});   /* el valor del viaje, aunque ya no esté en la lista */
  opts.push({id:ARRASTRE_OTRO,nombre:'OTRO EQUIPO · escribir la placa (no está en la lista)'});
  const ph=falta?'Primero elige la placa del equipo':(otro?'OTRO EQUIPO · escribe la placa abajo':'Selecciona la placa del arrastre');
  const hint=falta?'Se propone el último arrastre que usó la unidad.':(otro?'Escribe la placa del equipo de arrastre. Queda disponible en la lista para los próximos viajes.'
    :'Se propone el último arrastre que usó esta unidad. Si el equipo no está en la lista, elige «OTRO EQUIPO» y escríbela.');
  return fcombo('placaArrastre','Placa del equipo de arrastre',opts,M.placaArrastre,{src:'FLOTA',dis:falta,ph,hint})
    +(otro?`<div class="fgroup"><label for="m_placaArrastreOtro">Placa del arrastre (escrita a mano) <span class="mute">*</span></label><input type="text" id="m_placaArrastreOtro" data-m="placaArrastreOtro" value="${esc(M.placaArrastreOtro||'')}" maxlength="60" placeholder="Ej. TC-123ABC" ${M.placaArrastre?'':'disabled'}><span class="hint">Queda guardada en el viaje y disponible en la lista para los próximos viajes.</span></div>`:'');
}
function dursHTML(M){
  return `<div class="durs">${DUR.map(([l,a,b])=>{const v=diff(M[a],M[b]);return `<div class="dur"><small>${l}</small><b class="${v==='Revisar fechas'?'bad':''}">${v}</b></div>`;}).join('')}</div>`;
}
/* ---- SIN RUTA: botón del formulario Nuevo viaje (el viaje se registra sin ruta asignada y se avisa a Gerencia) ---- */
function sinRutaHTML(M,d){
  if(S.edit)return '';
  return `<div class="fgroup"><button type="button" class="btn ${M.sinRuta?'primary':''}" data-act="sinRuta" aria-pressed="${!!M.sinRuta}" ${d}>SIN RUTA</button><span class="hint">Úsalo cuando el viaje no tiene una ruta asignada.</span></div>
    ${M.sinRuta?`<div class="alertbox info" style="margin-bottom:10px"><b>Viaje SIN RUTA:</b> se guarda sin ruta asignada, queda identificado como «registrado sin ruta» y se envía una notificación a Gerencia. Elige el cliente y el proyecto en el formulario. Para quitarlo, vuelve a pulsar SIN RUTA o elige una ruta.</div>`:''}`;
}

/* ---- DESVÍO: botón en el espacio Ruta + «¿Hacia dónde fue el desvío?» (texto libre con sugerencias del cliente) ---- */
const destinosDesvio=M=>M.proyecto?DESTINOS.filter(x=>x.proyecto===M.proyecto).slice().sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es')):[];
function desvioHTML(M,d){
  if(S.edit)return '';
  const listo=!!M.proyecto,ds=destinosDesvio(M);
  return `<div class="fgroup"><button type="button" class="btn ${M.desvio?'primary':''}" data-act="desvio" aria-pressed="${!!M.desvio}" ${d}>Desvío</button><span class="hint">Actívalo si el viaje se desvió hacia otro destino. No cambia la ruta ni los demás datos del viaje.</span></div>
    ${M.desvio?`<div class="fgroup"><label for="m_desvioDestino">¿Hacia dónde fue el desvío? <span class="mute">*</span></label><div class="dd" data-dd><input id="m_desvioDestino" data-m="desvioDestino" value="${esc(M.desvioDestino||'')}" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="dd_desvioDestino" autocomplete="off" placeholder="${listo?'Escribe o elige un destino ya usado':'Primero elige el cliente o la ruta'}" ${(d||!listo)?'disabled':''}><div class="cb-panel" id="dd_desvioDestino" role="listbox" hidden><div class="cb-list">${[...new Map(ds.map(x=>[String(x.nombre),x])).values()].map(x=>`<button type="button" role="option" data-ddpick="${esc(x.nombre)}">${esc(x.nombre)}</button>`).join('')}</div><div class="cb-empty" hidden>Sin coincidencias: se guardará el texto que escribiste</div></div></div><span class="hint">Texto libre: el destino del desvío queda guardado en el viaje.</span></div>`:''}`;
}

/* ---- Gastos adicionales (Retorno y viáticos): varias filas concepto + importe; se guardan con el viaje ---- */
const gastosLista=M=>Array.isArray(M.gastosAdicionales)?M.gastosAdicionales:(M.gastosAdicionales=[]);
const gastosTotal=l=>Math.round(l.reduce((s,x)=>s+(Number(x.importe)>0?Number(x.importe):0),0)*100)/100;
/* Conceptos de siempre (Parqueo, Alimentación, Peaje, Otro). Si un gasto ya guardado trae otro texto, se conserva como opción para no perderlo. */
const GASTOS_CONCEPTOS=['Parqueo','Alimentación','Peaje','Otro'];
const gastosOpciones=c=>{const v=String(c==null?'':c);return v&&!GASTOS_CONCEPTOS.includes(v)?[...GASTOS_CONCEPTOS,v]:GASTOS_CONCEPTOS;};
function gastosFormHTML(M,d){
  const l=gastosLista(M);
  return `<h3 style="margin:14px 0 6px;font-size:14px">Gastos adicionales</h3>
    <div class="hint" style="margin-bottom:8px">Parqueo, alimentación, peaje u otros. Son aparte de los viáticos: no los reemplazan ni cambian sus cálculos.</div>
    ${l.map((x,i)=>`<div class="row2" style="align-items:end"><div class="fgroup"><label for="ga_c${i}">Concepto ${i+1}</label><select id="ga_c${i}" data-gasto="${i}|concepto" ${d}><option value="">Selecciona</option>${gastosOpciones(x.concepto).map(o=>`<option value="${esc(o)}" ${o===x.concepto?'selected':''}>${esc(o)}</option>`).join('')}</select></div>
      <div class="fgroup"><label for="ga_i${i}">Importe (Q)</label><div class="trow"><input type="number" id="ga_i${i}" data-gasto="${i}|importe" value="${esc(x.importe)}" inputmode="decimal" min="0" step="any" placeholder="0.00" ${d}><button type="button" class="btn sm" data-act="gastoDel" data-i="${i}" aria-label="Quitar gasto ${i+1}" ${d}>Quitar</button></div></div></div>${esGastoOtro(x.concepto)?`<div class="fgroup"><label for="ga_d${i}">Especifique el gasto <span class="mute">*</span></label><input type="text" id="ga_d${i}" data-gasto="${i}|detalle" value="${esc(x.detalle||'')}" maxlength="200" autocomplete="off" aria-required="true" ${d}><span class="hint">Describa qué gasto adicional necesita reportar</span></div>`:''}`).join('')}
    <button type="button" class="btn sm" data-act="gastoAdd" ${d}>+ Agregar gasto adicional</button>`;
}
function gastosDetalleHTML(t){
  const l=Array.isArray(t.gastosAdicionales)?t.gastosAdicionales:[];
  if(!l.length)return '<span class="mute">Sin registrar</span>';
  return `<ul style="margin:0;padding-left:18px">${l.map(x=>`<li>${esc(x.concepto)}${x.detalle?` <span class="mute">(${esc(x.detalle)})</span>`:''} — <b>Q ${Number(x.importe).toFixed(2)}</b></li>`).join('')}</ul><div class="mute" style="font-size:13px">Total: Q ${gastosTotal(l).toFixed(2)}</div>`;
}
function gastoSet(clave,valor){
  const M=curModel();if(!M)return;
  const [i,campo]=clave.split('|'),l=gastosLista(M);if(!l[i])return;
  const eraOtro=esGastoOtro(l[i].concepto);l[i][campo]=valor;if('err' in M)M.err='';
  if(campo==='concepto'&&esGastoOtro(valor)!==eraOtro){if(!esGastoOtro(valor))l[i].detalle='';render();}   /* «Otros» muestra u oculta «Especifique el gasto»; con otro concepto la explicación se descarta */
}

function fieldsHTML(M,groups,dis){
  const has=g=>groups.includes(g),d=dis?'disabled':'',ready=!!M.proyecto;
  const lab=(k,l,req,sc)=>`<label for="m_${k}">${l}${req?' <span class="mute">*</span>':''}${sc?' '+src(sc):''}</label>`;
  const txt=(k,l,o={})=>`<div class="fgroup">${lab(k,l,o.req,o.src)}<input type="${o.type||'text'}" id="m_${k}" data-m="${k}" value="${esc(M[k])}" ${o.num?'inputmode="decimal" min="0"':''} ${d}>${o.hint?`<span class="hint">${o.hint}</span>`:''}</div>`;
  const sel=(k,l,arr,o={})=>{const op=arr.map(x=>typeof x==='string'?{id:x,nombre:x}:x);
    return `<div class="fgroup">${lab(k,l,o.req,o.src)}<select id="m_${k}" data-m="${k}" ${d||o.dis?'disabled':''}><option value="">${o.ph||'Selecciona'}</option>${op.map(x=>`<option value="${esc(x.id)}" ${x.id===M[k]?'selected':''}>${esc(x.nombre)}</option>`).join('')}</select>${o.hint?`<span class="hint">${o.hint}</span>`:''}</div>`;};
  const fcombo=(k,l,opts,val,o={})=>`<div class="fgroup">${lab(k,l,o.req,o.src)}${(d||o.dis)?`<div class="cb"><button type="button" class="cb-btn" disabled><span>${esc(o.ph||'Selecciona')}</span><span class="cb-c">▾</span></button></div>`:comboHTML('m:'+k,val,opts,o.ph||'Selecciona')}${o.hint?`<span class="hint">${o.hint}</span>`:''}</div>`;
  const pr=PROYECTOS.find(p=>p.id===M.proyecto);
  let h='';
  if(has('cliente')){
    const clis=clientesAsig(S.user),locked=S.edit||clis.length===1;
    const cli=locked?`<div class="locked">${icon('lock',16)}<span class="pchip sm">${esc(pr?pr.nombre:'—')}</span><span>${esc(pr?pr.cliente:'')}</span><span class="mute" style="margin-left:auto;font-size:12.5px">${S.edit?'no editable':(esEnc()?'':'según tu perfil')}</span></div>`
      :`<select id="m_proyecto" data-m="proyecto" ${d}><option value="">Selecciona el cliente</option>${PROYECTOS.filter(p=>clis.includes(p.id)&&p.activo!==false).map(p=>`<option value="${p.id}" ${p.id===M.proyecto?'selected':''}>${esc(p.cliente)}</option>`).join('')}</select>`;
    h+=`<div class="card fsec"><h3>Cliente y datos del viaje</h3>
      <div class="fgroup"><label>Cliente ${src('PERFIL')}</label>${cli}</div>
      <div class="row2">${usaCombo()?(()=>{
        const falla=catalogoFalla(),aut=ready?proyectosAsig(S.user,M.proyecto):[],po=aut.slice();
        if(M.proyectoCat&&!po.includes(M.proyectoCat))po.push(M.proyectoCat);
        const sin=ready&&!falla&&!po.length;
        return sel('proyectoCat','Proyecto',po.map(x=>({id:x,nombre:x})),{req:1,dis:!ready||!!falla||sin,ph:!ready?'Primero elige el cliente':(falla?'No disponible':(sin?'Sin proyectos disponibles':'Selecciona el proyecto')),
          hint:falla?esc(falla)+REINTENTAR:(sin?'Este cliente no tiene proyectos registrados o autorizados para tu usuario. Pide a la administradora que los agregue en Clientes.':'')});
      })():sel('proyectoCat','Proyecto',PROYECTOS_X[M.proyecto]||[],{req:1,src:'CATALOGO',dis:!ready,ph:ready?'Selecciona el proyecto':'Primero elige el cliente'})}${txt('shipment','No. de Transporte')}</div>
      <div class="row2">${txt('noViaje','No. de viaje')}${sel('opl','OPL',CAT.opl,{src:'CATALOGO'})}</div>
      ${hp('viajes_editar_estado')&&S.edit?`<div class="row2">${sel('estado','Estado',Object.keys(ESTADOS).map(k=>({id:k,nombre:ESTADOS[k].l})))}</div>`:''}
      <div class="row2">${sel('tipoViaje','Tipo de viaje',CAT.tipoViaje,{src:'CATALOGO'})}${sel('tipoCarga','Tipo de carga',CAT.tipoCarga,{src:'CATALOGO'})}</div>
      <div class="row2">${txt('noCarga','Cantidad de carga',{type:'number',num:1,hint:'Cantidad, según el tipo de carga'})}</div>
      <div class="row2">${txt('producto','Producto')}</div></div>`;
  }
  if(has('plan')){
    h+=`<div class="card fsec"><h3>Fecha plan</h3>
      <div class="row2"><div class="fgroup"><label for="m_fechaPlanD">Fecha plan <span class="mute">*</span></label><input type="date" id="m_fechaPlanD" data-m="fechaPlanD" value="${esc(M.fechaPlanD)}" ${d}><span class="hint">Hoy por defecto; puedes cambiarla</span></div>
      <div class="fgroup"><label for="m_fechaPlanT">Hora plan <span class="mute">*</span></label><input type="time" id="m_fechaPlanT" data-m="fechaPlanT" value="${esc(M.fechaPlanT)}" ${d}></div></div></div>`;
  }
  if(has('unidad')&&esAdm()){
    const falla=catalogoFalla(),plSel=M.placaSel||((PILOTOS.find(p=>p.id===M.pilotoId)||{}).unidad||'');
    const placas=(ready&&!falla)?placasDe(M.proyecto):[],actual=(plSel&&!placas.some(x=>x.unidad===plSel))?FLOTA.find(x=>x.unidad===plSel):null;
    const opts=placas.concat(actual?[actual]:[]).map(f=>({id:f.unidad,nombre:etiquetaPlaca(f)}));
    const ps=plSel?pilotosElegibles(M.proyecto,plSel):[],sinPlacas=ready&&!falla&&!opts.length;
    h+=`<div class="card fsec"><h3>Placa y unidad</h3>
      ${falla?`<div class="alertbox" role="alert" style="margin-bottom:10px"><b>${esc(falla)}</b>${REINTENTAR}</div>`:''}
      ${sel('pilotoId','Piloto',PILOTOS.filter(p=>p.activo!==false&&p.proyecto===M.proyecto).map(p=>({id:p.id,nombre:p.nombre})),{req:1,src:'PILOTOS',dis:!ready,ph:ready?(PILOTOS.some(p=>p.proyecto===M.proyecto)?'Selecciona un piloto':'Este cliente no tiene pilotos'):'Primero elige el cliente',hint:'Puedes elegir cualquier piloto del cliente; la placa se ajusta a su unidad y luego puedes cambiarla.'})}${docAviso(M.pilotoId)}
      ${fcombo('placaSel','Placa del equipo',opts,plSel,{req:1,src:'FLOTA',dis:!ready||!!falla||sinPlacas,ph:!ready?'Primero elige el cliente o la ruta':(falla?'No disponible':(sinPlacas?'Sin placas disponibles':'Selecciona o escribe la placa')),hint:sinPlacas?'Este cliente no tiene placas disponibles: ninguno de sus pilotos tiene una unidad asignada en la flota.':'Se propone la placa del piloto; si la cambias, el piloto se ajusta a esa unidad.'})}
      ${autoPlaca(M,plSel,ps)}
      ${arrastreCampo(M,plSel,arrastresDisponibles(),fcombo)}</div>`;
  }
  if(has('unidad')&&!esAdm()){
    const falla=catalogoFalla(),plSel=M.placaSel||((PILOTOS.find(p=>p.id===M.pilotoId)||{}).unidad||'');
    const placas=(ready&&!falla)?placasDe(M.proyecto):[],actual=(plSel&&!placas.some(x=>x.unidad===plSel))?FLOTA.find(x=>x.unidad===plSel):null;
    const opts=placas.concat(actual?[actual]:[]).map(f=>({id:f.unidad,nombre:etiquetaPlaca(f)}));
    const sinPlacas=ready&&!falla&&!opts.length;
    h+=`<div class="card fsec"><h3>Piloto y unidad</h3>
      ${fcombo('placaSel','Placa del equipo',opts,plSel,{req:1,src:'FLOTA',dis:!ready||!!falla||sinPlacas,ph:!ready?'Primero elige el cliente':(falla?'No disponible':(sinPlacas?'Sin placas disponibles':'Selecciona la placa')),hint:sinPlacas?'Este cliente no tiene placas disponibles: ninguno de sus pilotos tiene una unidad asignada en la flota.':'Puedes cambiar la placa (unidad) del piloto: siempre dentro de este cliente. El cliente no se cambia.'})}
      ${sel('pilotoId','Piloto',PILOTOS.filter(p=>p.activo!==false&&p.proyecto===M.proyecto).map(p=>({id:p.id,nombre:p.nombre})),{req:1,src:'PILOTOS',dis:!ready,ph:ready?'Selecciona un piloto':'Primero elige el cliente'})}${docAviso(M.pilotoId)}
      ${autoCard(M)}
      ${arrastreCampo(M,plSel,arrastresDisponibles(),fcombo)}</div>`;
  }
  if(has('ruta')&&!usaCombo()){
    const rs=(ready&&M.proyectoCat)?API.rutasParaViaje(S.user.id,M.proyecto,M.proyectoCat):[];
    const pend=M.rutaId==='NO_ASIGNADA',R=(!pend&&M.rutaId)?DB.rutas.find(x=>x.id===M.rutaId):null;
    const opts=rs.map(r=>({id:r.id,nombre:`${r.codigo} · ${nombreOrigen(r.origen)} → ${nombreDestino(r.destino)}`})).concat(S.edit||!hp('rutas_solicitar')?[]:[{id:'NO_ASIGNADA',nombre:'NUEVA RUTA · requiere validación, tarifa y doble aprobación'}]);
    h+=`<div class="card fsec"><h3>Ruta</h3>
      ${sel('rutaId','Ruta',opts,{req:1,src:'RUTAS',dis:!ready||!M.proyectoCat,ph:(ready&&M.proyectoCat)?'Selecciona la ruta':'Primero elige el cliente y el proyecto',hint:(ready&&M.proyectoCat)?rs.length+' rutas asignadas de '+esc(M.proyectoCat):''})}
      ${sinRutaHTML(M,d)}
      ${desvioHTML(M,d)}
      ${pend?`${txt('rutaRef','Referencia de la ruta pendiente',{req:1,hint:'Describe qué ruta necesitas. No se inventa origen ni destino: Comercial y Gerencia la revisan y la asignan.'})}<div class="alertbox info" style="margin-bottom:10px"><b>Ruta NO ASIGNADA:</b> el viaje se guarda, se avisa a Comercial y Gerencia (dentro de la aplicación) y no recibe tarifa automática hasta que la ruta se valide.</div>`:''}
      <div class="${R?'auto'+(S.flash?' flash':''):'auto empty2'}">${R?`<div class="ah">${icon('check',18)} Origen y destino tomados de la ruta · no se escriben a mano</div><div class="cells"><div class="cell"><small>Código ${src('RUTAS')}</small><b>${esc(R.codigo)}</b></div><div class="cell"><small>Origen ${src('RUTAS')}</small><b>${esc(nombreOrigen(R.origen))}</b></div><div class="cell"><small>Destino ${src('RUTAS')}</small><b>${esc(nombreDestino(R.destino))}</b></div></div>`:(pend?'Origen y destino: pendientes de asignar.':'Elige la ruta: el origen y el destino se completan solos.')}</div></div>`;
  }
  if(has('ruta')&&usaCombo()){
    const falla=catalogoFalla(),listo=!falla;
    const pend=M.rutaId==='NO_ASIGNADA'||M.rutaGrupo==='NO_ASIGNADA',R=estadoRuta(M),puedeNueva=!S.edit&&hp('rutas_solicitar'),elegido=ready&&!!M.proyectoCat,puedeNuevaAqui=puedeNueva&&elegido;
    const opts=R.grupos.map(g=>({id:g.key,nombre:g.etiqueta})).concat(puedeNuevaAqui?[{id:'NO_ASIGNADA',nombre:'NUEVA RUTA · requiere validación, tarifa y doble aprobación'}]:[]);
    const val=pend?'NO_ASIGNADA':(R.g?R.g.key:''),sinRutas=listo&&!R.grupos.length;
    const nomO=id=>id===FALTA?'Sin registrar':nombreOrigen(id),nomD=id=>id===FALTA?'Sin registrar':nombreDestino(id);
    const campoOD=(rot,vals,cur,key,fn)=>{
      if(vals.length>1)return `<div class="fgroup"><label for="m_${key}">${rot} <span class="mute">*</span> ${src('RUTAS')}</label><select id="m_${key}" data-m="${key}" ${d?'disabled':''}><option value="">Selecciona ${rot==='Origen'?'el origen':'el destino'}</option>${vals.map(x=>`<option value="${esc(x)}" ${x===cur?'selected':''}>${esc(fn(x))}</option>`).join('')}</select><span class="hint">Esta ruta tiene ${vals.length} opciones de ${rot.toLowerCase()}.</span></div>`;
      const v=vals[0];
      return `<div class="fgroup"><label>${rot} ${src('RUTAS')}</label><div class="locked">${v===FALTA?`<span class="warnl"><b>No registrado en la ruta</b></span>`:esc(fn(v))}</div>${v===FALTA?`<span class="hint">Falta este dato en el registro de la ruta; no se inventa. Avisa a Comercial o a la administradora para completarlo.</span>`:''}</div>`;
    };
    let od;
    if(M.sinRuta)od=`<div class="auto empty2">Viaje SIN RUTA: no tiene origen ni destino asignados.</div>`;
    else if(pend)od=`<div class="auto empty2">Origen y destino: pendientes de asignar.</div>`;
    else if(R.g)od=`<div class="row2">${campoOD('Origen',R.os,R.o,'rutaO',nomO)}${campoOD('Destino',R.ds,R.d,'rutaD',nomD)}</div>`;
    else od=`<div class="auto empty2">Elige la ruta: el origen y el destino se completan solos.</div>`;
    h+=`<div class="card fsec"><h3>Ruta</h3>
      ${falla?`<div class="alertbox" role="alert" style="margin-bottom:10px"><b>${esc(falla)}</b>${REINTENTAR}</div>`:''}
      ${fcombo('rutaGrupo','Ruta',opts,val,{req:1,src:'RUTAS',dis:!listo,ph:listo?'Selecciona la ruta':'No disponible',hint:(listo&&R.grupos.length&&!elegido&&!R.g)?'Puedes elegir la ruta primero: el cliente y el proyecto se completan solos.':''})}
      ${sinRutas?`<div class="alertbox info" style="margin-bottom:10px">${elegido?`No hay rutas activas para ${esc(M.proyectoCat)}.${puedeNuevaAqui?' Puedes solicitar una nueva con la opción «NUEVA RUTA».':' Pide a Comercial que active una ruta para este proyecto.'}`:'No hay rutas activas disponibles para tu usuario. Pide a Comercial que active una ruta, o elige primero el cliente y el proyecto para solicitar una nueva.'}${esAdm()?REINTENTAR:''}</div>`:''}
      ${sinRutaHTML(M,d)}
      ${desvioHTML(M,d)}
      ${pend?`${txt('rutaRef','Referencia de la ruta pendiente',{req:1,hint:'Describe qué ruta necesitas. No se inventa origen ni destino: Comercial y Gerencia la revisan y la asignan.'})}<div class="alertbox info" style="margin-bottom:10px"><b>Ruta NO ASIGNADA:</b> el viaje se guarda, se avisa a Comercial y Gerencia (dentro de la aplicación) y no recibe tarifa automática hasta que la ruta se valide.</div>`:''}
      ${od}</div>`;
  }
  if(has('tiempos')){
    h+=`<div class="card fsec"><h3>Horarios del viaje</h3><div class="lead">Llena cada hora cuando ocurra: toca “Ahora” o escríbela. Puedes dejarlas vacías al registrar el viaje y completarlas después. Los tiempos de abajo se calculan solos.</div>
      <div class="tgrid">${CAMPOS_TIEMPO.map(([k,l])=>`<div class="fgroup"><label for="m_${k}">${lblT(l)}</label><div class="trow"><input type="datetime-local" id="m_${k}" data-m="${k}" value="${esc(M[k])}" ${d}><button type="button" class="btn sm" data-act="ahora" data-k="${k}" ${d}>Ahora</button><button type="button" class="btn ghost sm" data-act="limpiar" data-k="${k}" aria-label="Borrar ${lblT(l)}" ${d}>×</button></div></div>`).join('')}</div>
      <h3 style="margin-top:8px;font-size:14px">Tiempos calculados</h3>${dursHTML(M)}</div>`;
    if(M.desvio&&!S.edit)h+=`<div class="card fsec"><h3>Horarios de descarga del desvío</h3><div class="lead">Solo las horas de la descarga en el destino del desvío. Son aparte de los horarios del viaje y no los reemplazan. Puedes dejarlas vacías y completarlas después.</div>
      <div class="tgrid">${CAMPOS_TIEMPO_DESVIO.map(([k,l])=>`<div class="fgroup"><label for="m_${k}">${lblT(l)}</label><div class="trow"><input type="datetime-local" id="m_${k}" data-m="${k}" value="${esc(M[k])}" ${d}><button type="button" class="btn sm" data-act="ahora" data-k="${k}" ${d}>Ahora</button><button type="button" class="btn ghost sm" data-act="limpiar" data-k="${k}" aria-label="Borrar ${lblT(l)}" ${d}>×</button></div></div>`).join('')}</div></div>`;
  }
  if(has('otros')){
    h+=`<div class="card fsec"><h3>Retorno y viáticos</h3><div class="row2">${txt('noDocRetorno','No. doc retorno')}${txt('qViaticos','Q viáticos',{type:'number',num:1,hint:'Monto en quetzales'})}</div>${gastosFormHTML(M,d)}</div>`;
  }
  return h;
}

VIEWS.nuevo=()=>{
  if(!S.form)S.form=initForm();
  const f=S.form,dis=!!f.savedId,Pl=PILOTOS.find(p=>p.id===f.pilotoId);
  return `<div class="inner form">${pageHead('Registrar nuevo viaje','Incluye todos los campos de VIAJES TRANSPORTES. Lo que ya existe en otras hojas se completa solo. * obligatorio.')}
    ${f.savedId?`<div class="alertbox okb" style="margin-bottom:16px;display:flex;gap:10px;align-items:center">${icon('check',20)}<span><b>Viaje #${f.savedId} guardado.</b> Se asignó su estado inicial. Puedes registrar otro, abrirlo para actualizar horarios o terminar.</span></div>`:''}
    ${f.err?`<div class="alertbox" style="margin-bottom:16px" role="alert"><b>${esc(f.err)}</b></div>`:''}
    ${fieldsHTML(f,['cliente','plan','unidad','ruta','tiempos','otros'],dis)}
    <div class="formbtns">
      ${f.savedId?`<button class="btn primary lg" data-act="otro">${icon('plus',18)} REGISTRAR OTRO VIAJE</button><button class="btn lg" data-act="detalle" data-id="${f.savedId}">Abrir viaje #${f.savedId}</button>`:`<button class="btn primary lg" data-act="guardar" ${(!f.pilotoId||!f.placaSel)?'disabled':''}>GUARDAR VIAJE</button>`}
      <button class="btn lg" data-act="terminar">TERMINAR</button>
    </div></div>`;
};


/* ---- Liquidaciones: tabla compacta tipo Excel ---- */
const rutaHTML=t=>{
  const r=DB.rutas.find(x=>x.id===t.rutaId);
  if(!r)return t.sinRuta?'<span class="badge" title="Registrado sin ruta">SIN RUTA</span>':'<span class="mute">—</span>';
  if(['EN_TARIFACION','PENDIENTE_APROBACION','ACTIVA'].includes(r.estado))return `${rutaChip(r.estado)} ${esEnc()?'':esc(r.codigo)+' · '}${esc(nombreOrigen(r.origen))} → ${esc(nombreDestino(r.destino))}`;
  return `${rutaChip(r.estado)} <span class="mute">${esc(r.nombre)}</span>`;
};
function liqsOf(t){try{return API.liquidaciones(S.user.id,t.id);}catch(e){return [];}}
function liqTabs(){
  const T={
    sub:{k:'sub',l:'Por liquidar',f:t=>t.estado==='ENTREGADO',d:'Viajes entregados que esperan la fotografía de liquidación.'},
    corr:{k:'corr',l:'Rechazados',f:t=>t.estado==='RECHAZADO',d:'Rechazados con comentarios. Operaciones los corrige y vuelve a liquidar; se conserva cada rechazo.'},
    apr:{k:'apr',l:'Aceptados',f:t=>LIQ_APROBADA.includes(t.estado),d:'Historial de viajes aceptados.'}
  };
  /* «Por validar» se movió a VIAJES (es una pestaña del módulo de viajes). Aquí queda solo el trabajo de liquidaciones. */
  return [T.sub,T.corr,T.apr];
}
const fecha2=t=>{const d=planD(t);return d?fmtDate(d)+' '+d:'';};
function liqFilter(list){
  const q=S.q.trim().toLowerCase();
  return list.filter(t=>(!S.fCli||t.proyecto===S.fCli)&&(!S.fPcat||t.proyectoCat===S.fPcat)&&(!S.fDesde||planD(t)>=S.fDesde)&&(!S.fHasta||planD(t)<=S.fHasta)&&(!q||(t.id+' '+(J(t).cliente||'')+' '+(t.proyectoCat||'')+' '+(J(t).piloto||'')+' '+fecha2(t)).toLowerCase().includes(q)));
}
const LQ_COLS=[['id','ID viaje',t=>t.id],['cliente','Cliente',t=>J(t).cliente||''],['proyecto','Proyecto',t=>t.proyectoCat||''],['piloto','Piloto',t=>J(t).piloto||''],['fecha','Fecha del viaje',t=>t.fechaPlan||''],['estado','Estado',t=>ESTADOS[t.estado].l],['enviada','Enviada el',t=>t.enviadoEn||''],['revision','Revisión',t=>{const l=liqsOf(t).filter(x=>x.decision).pop();return l?l.revisionEn:'';}]];
function liqTable(list,k){
  const def=k==='apr'?{k:'revision',dir:-1}:{k:'fecha',dir:1},so=S.sortL||def;
  const col=LQ_COLS.find(c=>c[0]===so.k)||LQ_COLS[4];
  const rows=list.slice().sort((a,b)=>{const x=col[2](a),y=col[2](b);return (x<y?-1:x>y?1:0)*so.dir||a.id.localeCompare(b.id);});
  if(!rows.length)return empty('No hay liquidaciones con estos filtros','Cambia la búsqueda, el cliente, el proyecto o las fechas, o limpia los filtros.');
  const revisor=hp('liq_aprobar')||hp('liq_devolver');
  const pg=paginar('liq',rows);
  return `<div class="mute" style="margin-bottom:8px">${rows.length} ${rows.length===1?'liquidación':'liquidaciones'}</div><div class="xlwrap"><table class="xl" style="min-width:1150px"><thead><tr>${LQ_COLS.map(c=>`<th aria-sort="${so.k===c[0]?(so.dir>0?'ascending':'descending'):'none'}"><button class="thbtn" data-act="sortL" data-k="${c[0]}">${c[1]} <span aria-hidden="true">${so.k===c[0]?(so.dir>0?'▲':'▼'):'↕'}</span></button></th>`).join('')}<th>Acciones</th></tr></thead><tbody>
  ${pg.filas.map(t=>{
    const ls=liqsOf(t),lq=ls[ls.length-1],dec=ls.filter(x=>x.decision).pop();
    let acts=lq&&lq.evidencia?`<button class="btn sm" data-act="photoEv" data-id="${t.id}" data-ev="${lq.evidenciaId}">Ver evidencia</button> `:'';
    if(t.estado==='LIQUIDADO'&&revisor)acts+=(hp('liq_aprobar')?`<button class="btn sm ok" data-act="aprobarAsk" data-id="${t.id}">Aceptar</button> `:'')+(hp('liq_devolver')?`<button class="btn sm fix" data-act="devolverOpen" data-id="${t.id}">Rechazar</button>`:'');
    else if(['ENTREGADO','RECHAZADO'].includes(t.estado)&&hp('liq_enviar')&&mine(t))acts+=`<button class="btn sm primary" data-act="detalle" data-id="${t.id}">${t.estado==='RECHAZADO'?'Corregir y liquidar':'Liquidar'}</button>`;
    return `<tr role="button" tabindex="0" data-act="detalle" data-id="${t.id}"><td><b>#${t.id}</b></td><td>${esc(J(t).cliente)}</td><td>${esc(t.proyectoCat)}</td><td>${esc(J(t).piloto)}</td><td>${fmtDate(planD(t))}</td><td>${badge(t.estado)}</td><td>${t.enviadoEn?fmtDT(t.enviadoEn):'—'}</td>
    <td style="white-space:normal;min-width:210px">${dec?`<b>${dec.decision==='APROBADA'?'Aprobada':'Devuelta'}</b> · ${esc(dec.revisor)}<br><span class="mute">${fmtDT(dec.revisionEn)}</span>${dec.comentario?`<br><span class="mute">“${esc(dec.comentario.slice(0,70))}”</span>`:''}`:'<span class="mute">Sin revisar</span>'}</td><td style="white-space:nowrap">${acts}</td></tr>`;}).join('')}
  </tbody></table></div>${paginador('liq',pg)}`;
}
function liqCurrent(){const L=liqTabs(),k=S.tab.liq&&L.find(x=>x.k===S.tab.liq)?S.tab.liq:L[0].k;return {L,k,cur:L.find(x=>x.k===k)};}
BODY.liquidaciones=()=>{const {k,cur}=liqCurrent();return liqTable(liqFilter(vis().filter(cur.f)),k);};
VIEWS.liquidaciones=()=>{
  const ts=vis(),{L,k,cur}=liqCurrent();
  const sub=hp('liq_aprobar')?'Revisa la evidencia: aprueba o devuelve con un comentario obligatorio.':hp('liq_enviar')?'Sube la fotografía de liquidación de tus viajes finalizados.':'Vista de consulta de liquidaciones.';
  return `<div class="inner" style="max-width:1400px">${pageHead('LIQUIDACIONES',sub)}${tabs('liq',L,k,ts)}<div class="tabdesc">${cur.d}</div>
    <div class="lfilters"><input type="text" id="q" placeholder="Buscar por viaje, cliente, piloto o fecha (dd/mm/aaaa)" value="${esc(S.q)}" aria-label="Buscar">
    <select data-flt="fCli" aria-label="Cliente"><option value="">Todos los clientes</option>${PROYECTOS.map(p=>`<option value="${p.id}" ${S.fCli===p.id?'selected':''}>${esc(p.cliente)}</option>`).join('')}</select>
    <select data-flt="fPcat" aria-label="Proyecto"><option value="">Todos los proyectos</option>${CAT.proyectos.map(p=>`<option ${S.fPcat===p?'selected':''}>${esc(p)}</option>`).join('')}</select>
    <label class="dlab">Desde <input type="date" data-flt="fDesde" value="${esc(S.fDesde)}"></label><label class="dlab">Hasta <input type="date" data-flt="fHasta" value="${esc(S.fHasta)}"></label>
    <button class="btn sm" data-act="limpiarFiltros">Limpiar filtros</button></div>
    <div id="vb">${BODY.liquidaciones()}</div></div>`;
};

/* ---- Rutas (catálogo, solicitudes y seguimiento) ---- */
let RUTAS_ERR='';
/* Capacidades de la flota que todavía no tienen tarifa activa en esta ruta. */
function faltanCapRuta(r){const tf=DB.tarifas.filter(x=>x.activa&&x.rutaId===r.id);return capsCat().filter(c=>!tf.some(x=>x.capacidad===c));}
const faltaCapTxt=r=>{if(r.estado!=='ACTIVA')return '';const f=faltanCapRuta(r);return f.length?`<br><span class="warnl" style="font-size:12px">falta tarifa cap. ${f.join(', ')}</span>`:'';};
function rutasData(){let r=[];RUTAS_ERR='';try{r=API.rutas(S.user.id);}catch(e){RUTAS_ERR=e.message||'Error al consultar las rutas.';}return r;}
BODY.rutas=()=>{
  const q=S.rtQ.trim().toLowerCase(),fo=S.rtOri.trim().toLowerCase(),fd=S.rtDes.trim().toLowerCase(),fr=S.rtRuta.trim().toLowerCase();
  const txtO=r=>r.origen?nombreOrigen(r.origen):r.origenProp,txtD=r=>r.destino?nombreDestino(r.destino):r.destinoProp;
  const todas=rutasData();
  const rows=todas.filter(r=>(!(esAdm()&&S.rtCat)||(claveRuta(r)===S.rtCat&&(!S.rtOrig||(r.origen||FALTA)===S.rtOrig)&&(!S.rtDest||(r.destino||FALTA)===S.rtDest)))&&(!S.rtCli||r.cliente===S.rtCli)&&(!S.rtPcat||r.proyecto===S.rtPcat)&&(!S.rtEst||r.estado===S.rtEst)
    &&(!fr||(r.codigo+' '+r.nombre).toLowerCase().includes(fr))&&(!fo||String(txtO(r)).toLowerCase().includes(fo))&&(!fd||String(txtD(r)).toLowerCase().includes(fd))
    &&(!q||(r.codigo+' '+r.nombre+' '+r.cliente+' '+r.proyecto+' '+txtO(r)+' '+txtD(r)).toLowerCase().includes(q))).sort((a,b)=>({PENDIENTE:0,EN_TARIFACION:1,PENDIENTE_APROBACION:2,ACTIVA:3,RECHAZADA:4}[a.estado]-{PENDIENTE:0,EN_TARIFACION:1,PENDIENTE_APROBACION:2,ACTIVA:3,RECHAZADA:4}[b.estado])||a.cliente.localeCompare(b.cliente)||a.codigo.localeCompare(b.codigo));
  const val=hp('rutas_validar')||hp('rutas_aprobar_comercial')||hp('rutas_aprobar_transporte');
  const pg=paginar('rutas',rows);
  return rows.length?`<div class="mute" style="margin-bottom:8px">${rows.length} ${rows.length===1?'ruta':'rutas'}</div><div class="xlwrap"><table class="xl" style="min-width:1400px"><thead><tr>${esEnc()?'':'<th>Código</th>'}<th>Ruta</th><th>Cliente</th><th>Proyecto</th><th>Origen</th><th>Destino</th><th>Estado</th><th>Solicitada por · fecha</th><th>Validada por · fecha</th><th>Viajes</th>${val?'<th>Acciones</th>':''}</tr></thead><tbody>
  ${pg.filas.map(r=>`<tr class="${r.estado==='ACTIVA'?'':'warnrow'}">${esEnc()?'':`<td>${r.codigo?`<b>${esc(r.codigo)}</b>`:'<span class="mute">sin código</span>'}</td>`}<td style="white-space:normal;min-width:220px">${esc(r.nombre)}</td><td>${esc((PROYECTOS.find(p=>p.id===r.cliente)||{}).cliente||r.cliente)}</td><td>${esc(r.proyecto)}</td>
  <td style="white-space:normal;min-width:150px">${r.origen?esc(nombreOrigen(r.origen)):(r.origenProp?`${esc(r.origenProp)} <span class="mute">(propuesto)</span>`:'<span class="mute">pendiente</span>')}</td><td style="white-space:normal;min-width:170px">${r.destino?esc(nombreDestino(r.destino)):(r.destinoProp?`${esc(r.destinoProp)} <span class="mute">(propuesto)</span>`:'<span class="mute">pendiente</span>')}</td>
  <td>${rutaChip(r.estado)}${r.estado==='EN_TARIFACION'?'<br><span class="mute" style="font-size:12px">falta tarifa (Comercial)</span>':''}${faltaCapTxt(r)}${r.estado==='PENDIENTE_APROBACION'?'<br><span class="mute" style="font-size:12px">faltan aprobaciones</span>':''}${r.rechazo?`<br><span class="mute" style="font-size:12px">“${esc(r.rechazo.motivo)}”</span>`:''}${r.aprobacionComercial?'<br><span class="mute">Comercial ✓</span>':''}${r.aprobacionTransporte?'<br><span class="mute">Transporte ✓</span>':''}</td><td>${esc(r.solicitadaPor)}<br><span class="mute">${fmtDT(r.solicitadaEn)}${r.fuente==='VIAJE'?' · desde un viaje':''}</span></td><td>${r.validadaPor?`${esc(r.validadaPor)}<br><span class="mute">${fmtDT(r.validadaEn)}</span>`:'—'}</td><td>${r.viajes||0}</td>
  ${val?`<td style="white-space:nowrap">${r.estado==='EN_TARIFACION'&&hp('tarifas_crear')?`<button class="btn sm" data-act="tarifaRutaOpen" data-id="${r.id}">Definir tarifa</button>`:''}${r.estado==='PENDIENTE'&&hp('rutas_validar')?`<button class="btn sm primary" data-act="rutaValidarOpen" data-id="${r.id}">Validar</button> <button class="btn sm fix" data-act="rutaRechazarOpen" data-id="${r.id}">Rechazar</button>`:''}${r.estado==='PENDIENTE_APROBACION'&&hp('rutas_aprobar_comercial')&&!r.aprobacionComercial?`<button class="btn sm ok" data-act="rutaAprobarComOpen" data-id="${r.id}">Aprobar Comercial</button>`:''}${r.estado==='PENDIENTE_APROBACION'&&hp('rutas_aprobar_transporte')&&!r.aprobacionTransporte?`<button class="btn sm ok" data-act="rutaAprobarTraOpen" data-id="${r.id}">Aprobar Transporte</button>`:''}</td>`:''}</tr>`).join('')}
  </tbody></table></div>${paginador('rutas',pg)}`:(esAdm()?rutasVacioAdmin(todas):empty('No hay rutas con estos filtros','Cambia la búsqueda o registra una ruta nueva.'));
};
VIEWS.rutas=()=>{
  const all=rutasData(),pend=all.filter(r=>r.estado!=='ACTIVA'&&r.estado!=='RECHAZADA').length;
  const sinTarifa=all.filter(r=>r.estado==='EN_TARIFACION').length,sinAprob=all.filter(r=>r.estado==='PENDIENTE_APROBACION').length;
  const botones=(hp('rutas_solicitar')?`<button class="btn ${hp('rutas_gestionar')?'':'primary'}" data-act="rutaSolicitarOpen">${icon('plus',18)} Solicitar ruta nueva</button>`:'')+(hp('rutas_gestionar')?`<button class="btn primary" data-act="rutaRegistrarOpen">${icon('plus',18)} Registrar ruta validada</button>`:'');
  const cls=[...new Set(all.map(r=>r.cliente))];
  return `<div class="inner" style="max-width:1450px">${pageHead('RUTAS',S.user.rol==='OPERATIVO'?'Rutas de tu proyecto y estado de las que solicitaste':'Catálogo de rutas, solicitudes pendientes y su seguimiento',botones)}
    ${pend?`<div class="alertbox" style="margin-bottom:12px"><b>${pend} ${pend===1?'ruta pendiente':'rutas pendientes'} de activación.</b> ${sinTarifa?`${sinTarifa} esperando que Comercial defina la tarifa. `:''}${sinAprob?`${sinAprob} con tarifa, esperando la aprobación de Gerencia Comercial y de Transporte. `:''}Sin tarifa no se puede aprobar.</div>`:''}
    ${esAdm()?rutasCatalogoAdmin(all):''}<div class="lfilters" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><input type="text" data-live="rtQ" placeholder="🔍 Buscar ruta" value="${esc(S.rtQ)}" aria-label="Buscar ruta"><input type="text" data-live="rtRuta" placeholder="Filtrar por ruta" value="${esc(S.rtRuta)}" aria-label="Filtrar por ruta"><input type="text" data-live="rtOri" placeholder="Filtrar por origen" value="${esc(S.rtOri)}" aria-label="Filtrar por origen"><input type="text" data-live="rtDes" placeholder="Filtrar por destino" value="${esc(S.rtDes)}" aria-label="Filtrar por destino">
    ${cls.length>1?`<select data-flt="rtCli" aria-label="Cliente"><option value="">Todos los clientes</option>${cls.map(c=>`<option value="${c}" ${S.rtCli===c?'selected':''}>${esc((PROYECTOS.find(p=>p.id===c)||{}).cliente||c)}</option>`).join('')}</select>`:''}
    <select data-flt="rtPcat" aria-label="Proyecto"><option value="">Todos los proyectos</option>${[...new Set(all.map(r=>r.proyecto))].map(p=>`<option ${S.rtPcat===p?'selected':''}>${esc(p)}</option>`).join('')}</select>
    <select data-flt="rtEst" aria-label="Estado"><option value="">Todos los estados</option><option value="PENDIENTE" ${S.rtEst==='PENDIENTE'?'selected':''}>Pendientes</option><option value="EN_TARIFACION" ${S.rtEst==='EN_TARIFACION'?'selected':''}>En tarifación</option><option value="PENDIENTE_APROBACION" ${S.rtEst==='PENDIENTE_APROBACION'?'selected':''}>Pendientes de aprobación</option><option value="ACTIVA" ${S.rtEst==='ACTIVA'?'selected':''}>Activas</option><option value="RECHAZADA" ${S.rtEst==='RECHAZADA'?'selected':''}>Rechazadas</option></select>
    <button class="btn sm" data-act="limpiarRutas">Limpiar filtros</button></div>
    <div id="vb">${BODY.rutas()}</div></div>`;
};


/* ---- Acciones (handlers) de este módulo ---- */
Object.assign(ACT,{
  async iniciarAsk(d){confirmM(`¿Iniciar el viaje #${d.id}?`,'Pasará a En curso y Torre de Control podrá monitorearlo. Esta acción queda registrada.','INICIAR VIAJE','iniciarOk',d.id);},
  async iniciarOk(d){const r=await run(()=>API.iniciar(S.user.id,d.id),`Viaje #${d.id} en curso.`,true);if(r.ok)afterWrite();},
  async finalizarAsk(d){const t=J(API.viaje(S.user.id,d.id));confirmM(`¿Finalizar el viaje #${d.id}?`,`${esc(t.piloto)} · ${esc(t.f.unidad)}<br>${esc(t.origen)||'Ruta pendiente'} → ${esc(t.destino)||'Ruta pendiente'}<br>Quedará finalizado y pasará a liquidación. No se elimina: se conserva en el historial.`,'FINALIZAR VIAJE','finalizarOk',d.id);},
  async finalizarOk(d){const r=await run(()=>API.finalizar(S.user.id,d.id),`Viaje #${d.id} finalizado. Pasó a pendiente de liquidación.`,true);if(r.ok)afterWrite();},
  async enviarLiq(d){const r=await run(()=>API.enviarLiquidacion(S.user.id,d.id,S.draft[d.id]),`Liquidación del viaje #${d.id} enviada. Quedó en revisión.`);if(r.ok)delete S.draft[d.id];render();},
  async aprobarAsk(d){confirmM(`¿Aprobar la liquidación del viaje #${d.id}?`,'El viaje quedará disponible para Comercial. La decisión se registra con tu usuario, fecha y hora.','APROBAR LIQUIDACIÓN','aprobarOk',d.id,'ok');},
  async aprobarOk(d){const r=await run(()=>API.aprobar(S.user.id,d.id),`Viaje #${d.id}: liquidación aprobada.`,true);if(r.ok)afterWrite();},
  async devolverOpen(d){formM({title:'¿Qué debe corregirse?',text:`Viaje #${d.id}. El comentario es obligatorio y le llegará al responsable del proyecto.`,chips:['Falta firma del piloto','Liquidación incompleta','Falta comprobante'],fields:[{k:'comentario',label:'Comentario de revisión',type:'textarea',req:1,ph:'Escribe qué falta o qué está incorrecto'}],ok:'DEVOLVER PARA CORRECCIÓN',okCls:'fix',act:'devolverSend',id:d.id});},
  async devolverSend(d){const r=await run(()=>API.devolver(S.user.id,d.id,S.modal.data.comentario),`Viaje #${d.id} devuelto al responsable con tu comentario.`,true);if(r.ok)afterWrite();},
  async shipmentDupOpen(d){formM({title:`Aprobar Shipment duplicado · viaje #${d.id}`,text:'Esta es una aprobación excepcional de Gerencia de Transporte. El valor se convertirá en <b>DUP-</b> + el Shipment actual. Si ese DUP- ya existe, no se podrá aprobar ni liquidar.',ok:'APROBAR DUPLICADO',okCls:'fix',act:'shipmentDupOk',id:d.id});},
  /* El mensaje del aviso tiene que ser una función del resultado: con la plantilla directa, `r` todavía no existía. */
  async shipmentDupOk(d){const r=await run(()=>API.aprobarShipmentDuplicado(S.user.id,d.id),x=>`Shipment aprobado como ${x.shipment}.`,true);if(r.ok)afterWrite();},
  async guardar(){
    const f=S.form;f.err='';
    if(!f.placaSel){f.err='Selecciona la placa del equipo.';render();topScroll();return;}
    if(!f.pilotoId){const ps=pilotosElegibles(f.proyecto,f.placaSel);
      f.err=ps.length>1?'Esta placa tiene más de un piloto asignado: elige el piloto del viaje.':'Esta placa no tiene un piloto asignado para este cliente: elige otra placa o pide a la administradora que asigne la unidad a un piloto.';render();topScroll();return;}
    const d={cliente:f.proyecto,fechaPlan:f.fechaPlanD&&f.fechaPlanT?f.fechaPlanD+'T'+f.fechaPlanT:'',rutaRef:f.rutaRef||''};
    [...DATA_KEYS,...TKEYS].forEach(k=>{d[k]=f[k];});
    d.desvio=!!f.desvio;if(f.desvio){d.desvioDestino=f.desvioDestino||'';DVKEYS.forEach(k=>{d[k]=f[k]||'';});}   /* Desvío: sin él activo no se envía nada más */
    d.sinRuta=!!f.sinRuta;                         /* SIN RUTA: se guarda con el viaje y avisa a Gerencia */
    if(f.sinRuta)d.rutaId='';
    d.unidadId=f.placaSel||'';                     /* la placa elegida es la unidad del viaje */
    d.placaArrastre=arrastreFinal(f);              /* de la lista o escrita a mano */
    try{const t=await API.crearViaje(S.user.id,d);f.savedId=t.id;render();topScroll();toast(f.sinRuta?`Viaje #${t.id} guardado SIN RUTA. Se notificó a Gerencia.`:(f.rutaId==='NO_ASIGNADA'?`Viaje #${t.id} guardado con ruta NO ASIGNADA. Se avisó a Comercial y Gerencia dentro de la aplicación.`:`Viaje #${t.id} guardado.`));}
    catch(e){f.err=sinPerfil(e.message);render();topScroll();}
  },
  async otro(){S.form=initForm();render();},
  async desvio(){
    if(S.edit)return;
    const M=curModel();if(!M)return;
    M.desvio=!M.desvio;if(!M.desvio){M.desvioDestino='';DVKEYS.forEach(k=>{M[k]='';});}   /* solo se muestra/oculta el campo: no se toca ningún otro dato */
    if('err' in M)M.err='';render();
  },
  async sinRuta(){
    const M=curModel();if(!M||S.edit)return;
    if(M.sinRuta)M.sinRuta=false;
    else{M.sinRuta=true;M.rutaId='';M.rutaRef='';M.rutaGrupo='';M.rutaO='';M.rutaD='';}
    if('err' in M)M.err='';render();
  },
  async gastoAdd(){const M=curModel();if(!M)return;gastosLista(M).push({concepto:'',importe:''});render();},
  async gastoDel(d){const M=curModel();if(!M)return;gastosLista(M).splice(Number(d.i),1);render();},
  async terminar(){
    const f=S.form||{};
    if(!f.savedId&&(f.pilotoId||f.rutaId||f.sinRuta||f.desvio)){confirmM('¿Salir sin guardar?','Hay datos del formulario que no se han guardado. Los viajes ya guardados no se pierden.','Salir sin guardar','terminarOk');return;}
    ACT.terminarOk();
  },
  async terminarOk(){S.form=null;S.modal=null;go(homeOf(S.user));},
  async ahora(d){const M=curModel();if(M){M[d.k]=nowLocal();render();}},
  async limpiar(d){const M=curModel();if(M){M[d.k]='';render();}},
  async editar(d){let t;try{t=API.viaje(S.user.id,d.id);}catch(e){return;}if(!canEdit(t))return;S.edit={id:t.id,data:toModel(t),motivo:''};render();topScroll();},
  async editCancel(){S.edit=null;render();topScroll();},
  async editSave(){
    const E=S.edit,M=E.data;let t;try{t=API.viaje(S.user.id,E.id);}catch(e){return;}
    const cambios={};
    editGroups(t).flatMap(g=>GRUPOKEYS[g]).forEach(k=>{cambios[k]=k==='fechaPlan'?(M.fechaPlanD&&M.fechaPlanT?M.fechaPlanD+'T'+M.fechaPlanT:''):(k==='unidadId'?(M.placaSel||''):(k==='placaArrastre'?arrastreFinal(M):M[k]));});
    try{const r=await API.editarViaje(S.user.id,E.id,cambios,E.motivo);S.edit=null;render();topScroll();toast(r.cambios?`Viaje #${E.id} actualizado (${r.cambios} ${r.cambios===1?'cambio':'cambios'}).`:'No hubo cambios.');
      const t2=API.viaje(S.user.id,E.id);if(DUR.some(([l,a,b])=>diff(t2[a],t2[b])==='Revisar fechas'))toast('Ojo: hay horarios fuera de orden.','err');}
    catch(e){M.err=e.message;render();topScroll();}
  },
  async limpiarRutas(){Object.assign(S,{rtQ:'',rtRuta:'',rtOri:'',rtDes:'',rtCli:'',rtPcat:'',rtEst:'',rtCat:'',rtOrig:'',rtDest:''});render();},
  async rutaSolicitarOpen(){
    const oc=optsClientes(),c0=oc.length===1?oc[0].id:'',p0=c0&&optsProyectos({cliente:c0}).length===1?optsProyectos({cliente:c0})[0].id:'';
    formM({title:'Solicitar ruta nueva',text:'La ruta quedará NO ASIGNADA hasta que Comercial o Gerencia la revisen. No se inventa un código, un origen ni un destino: escribe lo que conoces.',
      fields:[{k:'cliente',label:'Cliente',type:'select',req:1,optsFn:()=>optsClientes(),ph:'Selecciona el cliente'},{k:'proyecto',label:'Proyecto',type:'select',req:1,optsFn:optsProyectos,ph:'Primero elige el cliente'},{k:'nombre',label:'Nombre o referencia de la ruta',req:1},{k:'origenProp',label:'Origen propuesto (si lo conoces)'},{k:'destinoProp',label:'Destino propuesto (si lo conoces)'}],
      data:{cliente:c0,proyecto:p0,nombre:'',origenProp:'',destinoProp:''},rerender:['cliente'],ok:'ENVIAR SOLICITUD',act:'rutaSolicitarSave'});
  },
  async rutaSolicitarSave(){const m=S.modal.data;const r=await run(()=>API.solicitarRuta(S.user.id,m),x=>`Ruta solicitada (${x.id}): queda NO ASIGNADA. Se avisó a Comercial y Gerencia dentro de la aplicación.`,true);if(r.ok)afterWrite();},
  async rutaRegistrarOpen(){
    formM({title:'Registrar ruta validada',text:'Se agrega directamente al catálogo como ASIGNADA. El <b>código se asigna solo</b> con la sigla del cliente y un correlativo (por ejemplo COL-001).',
      fields:[{k:'nombre',label:'Nombre de la ruta',req:1},{k:'cliente',label:'Cliente',type:'select',req:1,optsFn:()=>optsClientes(),ph:'Selecciona el cliente'},{k:'proyecto',label:'Proyecto',type:'select',req:1,optsFn:optsProyectos,ph:'Primero elige el cliente'},{k:'origen',label:'Origen',req:1,datalist:d=>sugerenciasOrigen(d.cliente),ph:'Escribe el origen (o elige uno ya usado)'},{k:'destino',label:'Destino',req:1,datalist:d=>sugerenciasDestino(d.cliente),ph:'Escribe el destino (o elige uno ya usado)'}],
      data:{nombre:'',cliente:'',proyecto:'',origen:'',destino:''},rerender:['cliente'],ok:'REGISTRAR RUTA',act:'rutaRegistrarSave'});
  },
  async rutaRegistrarSave(){const m=S.modal.data;const r=await run(()=>API.registrarRuta(S.user.id,m),x=>`Ruta ${x.codigo} registrada.`,true);if(r.ok)afterWrite();},
  async rutaValidarOpen(d){
    const r=DB.rutas.find(x=>x.id===d.id);if(!r)return;
    formM({title:`Validar y asignar · ${r.nombre}`,text:`${esc((PROYECTOS.find(p=>p.id===r.cliente)||{}).cliente)} · ${esc(r.proyecto)}. Solicitada por ${esc(r.solicitadaPor)}.<br>Origen propuesto: <b>${esc(r.origenProp||'no indicado')}</b> · Destino propuesto: <b>${esc(r.destinoProp||'no indicado')}</b>. Al asignarla se completan el origen y el destino de los viajes que la usan. El <b>código se asigna solo</b> (sigla del cliente y correlativo).`,
      fields:[{k:'origen',label:'Origen',req:1,datalist:()=>sugerenciasOrigen(r.cliente),ph:'Escribe el origen'},{k:'destino',label:'Destino',req:1,datalist:()=>sugerenciasDestino(r.cliente),ph:'Escribe el destino'}],
      data:{origen:r.origenProp||'',destino:r.destinoProp||''},ok:'VALIDAR Y ASIGNAR',okCls:'ok',act:'rutaValidarOk',id:r.id});
  },
  async rutaValidarOk(d){const m=S.modal.data;const r=await run(()=>API.validarRuta(S.user.id,d.id,m),x=>`Ruta ${x.codigo} asignada: los viajes asociados ya tienen origen y destino.`,true);if(r.ok)afterWrite();},
  async rutaRechazarOpen(d){formM({title:'Rechazar ruta solicitada',text:'Explica por qué no se asigna. Quien la solicitó recibirá el aviso.',fields:[{k:'motivo',label:'Motivo del rechazo',type:'textarea',req:1}],ok:'RECHAZAR RUTA',okCls:'fix',act:'rutaRechazarOk',id:d.id});},
  async rutaRechazarOk(d){const r=await run(()=>API.rechazarRuta(S.user.id,d.id,S.modal.data.motivo),'Ruta rechazada.',true);if(r.ok)afterWrite();},
  async rutaAprobarComOpen(d){confirmM('¿Aprobar ruta por Gerencia Comercial?','La ruta solo se activará cuando Gerencia de Transporte también la apruebe. La tarifa definida y esta decisión quedan auditadas.','APROBAR RUTA','rutaAprobarComOk',d.id,'ok');},
  async rutaAprobarComOk(d){const r=await run(()=>API.aprobarRutaComercial(S.user.id,d.id),x=>x.estado==='ACTIVA'?'Ruta activa.':'Aprobación Comercial registrada; falta Transporte.',true);if(r.ok)afterWrite();},
  async rutaAprobarTraOpen(d){confirmM('¿Aprobar ruta por Gerencia de Transporte?','La ruta solo se activará cuando Gerencia Comercial también la apruebe. Esta decisión queda auditada.','APROBAR RUTA','rutaAprobarTraOk',d.id,'ok');},
  async rutaAprobarTraOk(d){const r=await run(()=>API.aprobarRutaTransporte(S.user.id,d.id),x=>x.estado==='ACTIVA'?'Ruta activa.':'Aprobación Transporte registrada; falta Comercial.',true);if(r.ok)afterWrite();}
});
