/* =====================================================================
   INTERFAZ  (solo muestra datos y llama a API.*; nunca escribe en DB)
   ===================================================================== */
Object.assign(ICON,{
  bell:'<path d="M6 9a6 6 0 1112 0c0 5 2 6 2 7H4c0-1 2-2 2-7z"/><path d="M10 20a2 2 0 004 0"/>',
  dollar:'<path d="M12 3v18M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 2.8 4 3.2 4 1.5 4 3.3-1.8 3-4 3-4-1.3-4-3"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'
});
const S={edit:null,user:null,view:'login',param:null,tab:{},form:null,draft:{},modal:null,menu:false,flash:false,q:'',fEstado:'',fProy:'',tProy:'',fCli:'',fPcat:'',fCom:'PEND',sel:[],from:null,loginErr:'',loginU:'',_lv:null,_lp:null,verif:null,aEnt:'',aRech:false,sortL:null,sortF:null,fDesde:'',fHasta:'',fProv:'',autoFail:{},fcCli:'',fcPcat:'',fcMes:'',fcSem:'',fcFecha:'',fcDesde:'',fcHasta:'',fcFechas:[],fcQ:'',fcEstado:'ENV',fcBase:'envio',tfQ:'',tfCli:'',tfPcat:'',tfCap:'',tfEst:'',rtQ:'',rtRuta:'',rtOri:'',rtDes:'',rtCli:'',rtPcat:'',rtEst:'',cb:null,cbq:''};
const hp=p=>hasPerm(S.user,p);
const vis=()=>API.listarViajes(S.user.id).slice().sort((a,b)=>b.id.localeCompare(a.id));
const mine=t=>asignado(S.user,t);
const cnt=(ts,fn)=>ts.filter(fn).length;
const rolL=r=>(ROLES[r]||{label:r||'Sistema'}).label;
const J=t=>{
  const pr=PROYECTOS.find(p=>p.id===t.proyecto)||{};
  return Object.assign({},t,{proyectoNombre:pr.nombre,cliente:pr.cliente,
    piloto:(PILOTOS.find(p=>p.id===t.pilotoId)||{}).nombre,
    f:FLOTA.find(f=>f.unidad===t.unidadId)||{},
    origen:(ORIGENES.find(o=>o.id===t.origenId)||{}).nombre,
    destino:(DESTINOS.find(d=>d.id===t.destinoId)||{}).nombre});
};
const homeOf=u=>ROLES[u.rol].home;
function allowed(v){
  if(!S.user)return false;
  if(v==='detalle')return true;
  if(v==='proyecto')return allowed('proyectos');
  return ROLES[S.user.rol].nav.includes(v)&&(!VIEW_PERM[v]||hp(VIEW_PERM[v]));
}
const navItems=()=>ROLES[S.user.rol].nav.filter(v=>allowed(v));

/* ---------- Componentes ---------- */
/* Colores de estado (Brandbook): punto de color + etiqueta. Cumplido = verde, En proceso = azul océano, Alerta = rojo; lo demás, gris neutro.
   UNA sola tabla para toda la aplicación: el mismo estado tiene el mismo color en todos los módulos. */
const TONO_ESTADO={PLANIFICADO:'neutral',EN_RUTA:'progress',ENTREGADO:'warn',LIQUIDADO:'progress',ACEPTADO:'done',RECHAZADO:'alert',FACTURADO:'progress',COBRADO:'done'};
const ESTATUS_TONO={'EN ESPERA':'neutral','DISPONIBLE':'neutral','NO DISPONIBLE':'neutral','PROCESO DE CARGA':'progress','CARGADO':'progress','EN RAMPA':'progress','EN CAMINO':'progress','ESPERA CON CLIENTE':'progress','ESPERA DE DESCARGA':'progress','ESPERANDO CALIDAD':'progress','ESPERANDO CUSTODIO':'progress','RETORNO':'progress','REPROGRAMADO':'progress','PENDIENTE LIQUIDAR':'progress','COMPLETADO':'done','LIQUIDADO':'done','CANCELADO':'alert','NO SALIO A RUTA':'alert','NO ENTREGADO':'alert','DEVOLUCION':'alert'};
const TONO_RUTA={PENDIENTE:'alert',EN_TARIFACION:'progress',PENDIENTE_APROBACION:'progress',ACTIVA:'done',RECHAZADA:'alert'};
const chip=(tono,label)=>`<span class="stc tn-${tono}">${esc(label)}</span>`;
/* Quien no trabaja en Comercial ve esas etapas como "Liquidación aprobada": Liquidaciones termina al aprobar. */
const badge=e=>{
  return chip(TONO_ESTADO[e]||'neutral',ESTADOS[e].l);
};
const rutaChip=e=>chip(TONO_RUTA[e]||'neutral',{PENDIENTE:'PENDIENTE',EN_TARIFACION:'EN TARIFACIÓN',PENDIENTE_APROBACION:'PENDIENTE APROBACIÓN',ACTIVA:'ACTIVA',RECHAZADA:'RECHAZADA'}[e]||e);
const vroute=j=>`<div class="vroute"><span class="d o"></span><span>${esc(j.origen)}</span><span class="d t"></span><span>${esc(j.destino)}</span></div>`;
/* ---- Perfil «Encargado de proyecto»: los ajustes de esta versión SOLO se aplican a este rol; los demás perfiles ven exactamente lo mismo que antes ---- */
const esEnc=()=>!!S.user&&S.user.rol==='ENCARGADO';
/* ---- Perfil «Administrador»: Clientes, Facturación, Nuevo viaje y Rutas. Cada cambio está condicionado a este rol; los demás perfiles quedan igual. ---- */
const esAdm=()=>!!S.user&&S.user.rol==='ADMIN';
const usaCombo=()=>esEnc()||esAdm();                   /* desplegables de Proyecto y Ruta del formulario de viaje */
const CBLIM={fcViaje:300};                              /* listas muy largas: se muestran las primeras N y se invita a escribir para acotar */
const lblT=l=>esEnc()?String(l).replace(/ (CP|CG)$/,''):l;                                   /* «Ingreso a planta CP» → «Ingreso a planta» · «Ingreso a bodega CG» → «Ingreso a bodega» */
const sinPerfil=m=>esEnc()?String(m).replace(/Tu perfil \([^)]*\) no puede /,'No puedes ').replace(/\btu perfil\b/gi,'tu usuario'):m;
const src=s=>(esEnc()&&(s==='CATALOGO'||s==='PERFIL'))?'':`<span class="src">${s}</span>`;
const pageHead=(t,sub,right)=>`<div class="pagehead"><div><h1>${t}</h1>${sub?`<div class="sub">${sub}</div>`:''}</div>${right?`<div class="right">${right}</div>`:''}</div>`;
const empty=(t,s)=>`<div class="empty"><b>${t}</b>${s||''}</div>`;
function tabs(key,list,active,ts){
  return `<div class="tabs" role="tablist">${list.map(x=>`<button role="tab" aria-selected="${x.k===active}" data-act="tab" data-k="${key}" data-v="${x.k}">${x.l}${x.f?`<span class="c">${ts?cnt(ts,x.f):0}</span>`:''}</button>`).join('')}</div>`;
}
function tripCard(t){
  const j=J(t);
  return `<article class="tcard" role="button" tabindex="0" data-act="detalle" data-id="${t.id}">
    <div class="tc-top"><span class="num">Viaje #${t.id}</span><span class="bgs">${badge(t.estado)}${est(t)}</span></div>
    <div class="tc-proj"><span class="pchip sm">${esc(j.proyectoNombre)}</span>${t.estado==='EN_RUTA'?`<span><span class="pulse"></span><span data-since="${since(t)}">${elapsed(since(t))}</span></span>`:`<span class="mute">Plan ${fmtL(t.fechaPlan)}</span>`}</div>
    ${vroute(j)}
    <dl class="meta"><dt>Piloto</dt><dd>${esc(j.piloto)}</dd><dt>Unidad / placa</dt><dd>${esc(j.f.unidad)} · ${esc(j.f.placa)}</dd></dl>
    ${t.estado==='RECHAZADO'?`<div class="alertbox"><b>Rechazo #${t.rechazos||1}:</b> ${esc(t.comentarioRevision)}</div>`:''}
    <div class="actions"><button class="btn primary sm" data-act="detalle" data-id="${t.id}">VER DETALLE</button></div>
  </article>`;
}
function tableHTML(ts,extra){
  if(!ts.length)return empty('Sin viajes con este filtro','Cambia el estado o el cliente para ver más resultados.');
  return `<div class="tablewrap scrollx"><table class="resp"><thead><tr><th>Viaje</th><th>Fecha plan</th><th>Cliente</th><th>Origen → destino</th><th>Piloto</th><th>Unidad / placa</th>${extra?`<th>${extra.h}</th>`:''}<th>Estado</th></tr></thead><tbody>
  ${ts.map(t=>{const j=J(t);return `<tr role="button" tabindex="0" data-act="detalle" data-id="${t.id}"><td data-l="Viaje"><span class="num">#${t.id}</span></td><td data-l="Fecha plan">${fmtL(t.fechaPlan)}</td><td data-l="Cliente"><span class="pchip sm">${esc(j.proyectoNombre)}</span></td><td data-l="Ruta">${esc(j.origen)} → ${esc(j.destino)}</td><td data-l="Piloto">${esc(j.piloto)}</td><td data-l="Unidad">${esc(j.f.unidad)} · ${esc(j.f.placa)}</td>${extra?`<td data-l="${extra.h}">${extra.f(t)}</td>`:''}<td data-l="Estado">${badge(t.estado)} ${est(t)}</td></tr>`;}).join('')}
  </tbody></table></div>`;
}
function statBar(ts){
  const tot=ts.length||1,ks=Object.keys(ESTADOS);
  return `<div class="pbar" role="img" aria-label="Distribución por estado">${ks.map(e=>{const n=cnt(ts,t=>t.estado===e);return n?`<i style="width:${n/tot*100}%;background:var(${ESTADOS[e].c})" title="${ESTADOS[e].l}: ${n}"></i>`:'';}).join('')}</div>
  <div class="legend">${ks.map(e=>{const n=cnt(ts,t=>t.estado===e);return n?`<span><i class="dot" style="background:var(${ESTADOS[e].c})"></i>${ESTADOS[e].l} ${n}</span>`:'';}).join('')}</div>`;
}
const matchE=(t,f)=>!f||(f==='FIN'?FIN.includes(t.estado):t.estado===f);
function histHTML(evs){
  if(!evs.length)return `<div class="mute">Sin eventos registrados.</div>`;
  return `<ul class="tl">${evs.map(h=>`<li><b>${esc(h.accion)}</b>${h.campo?` <span class="mute">· ${esc(lblT(h.campo))}</span>`:''}${h.campo&&(h.anterior||h.nuevo)?`<div>${esc(h.anterior||'(vacío)')} → <b>${esc(h.nuevo||'(vacío)')}</b></div>`:''}<div class="by">${esc(h.por)} · ${esc(rolL(h.rol))} · ${fmtDT(h.en)}</div>${h.motivo?`<div class="nt">“${esc(h.motivo)}”</div>`:''}${h.ref?`<div class="by">Ref. ${esc(h.ref)}</div>`:''}</li>`).join('')}</ul>`;
}

/* ---------- Notas de arquitectura (Power Apps) ---------- */
const ARCH={
  login:{s:'scr_Login',d:'USUARIOS',f:'Set(gblUsuario; LookUp(USUARIOS; Usuario=txtUsuario.Text))',n:'Fase 2: Microsoft 365 (User().Email). La contraseña de demostración desaparece.'},
  inicio:{s:'scr_InicioEncargado',d:'VIAJES · ACCESO_CLIENTE',f:'Filter(VIAJES; Cliente in gblClientesAsignados)',n:'El alcance sale de ACCESO_CLIENTE; en producción se filtra también del lado del servidor.'},
  nuevo:{s:'scr_NuevoViaje',d:'PILOTOS · FLOTA · ORIGEN · DESTINOS · CATALOGO',f:'LookUp(FLOTA; Unidad=ddPiloto.Selected.UnidadAsignada)',n:'El alta debe ejecutarse con un flujo/validación servidor (Power Automate / plugin Dataverse).'},
  viajes:{s:'scr_Viajes',d:'VIAJES',f:'Filter(VIAJES; Estado.Value="EN_RUTA")',n:''},
  detalle:{s:'scr_DetalleViaje',d:'VIAJES · LIQUIDACIONES · AUDITORIA',f:'Patch(VIAJES; gblViaje; {...})  // solo desde un flujo que valide rol, estado y campos',n:'Torre solo puede escribir las columnas de fecha/hora. Se valida en servidor, no solo con DisplayMode.'},
  torre:{s:'scr_TorreControl',d:'VIAJES',f:'Filter(VIAJES; Estado.Value="EN_RUTA")',n:'Solo lectura salvo fechas/horas. Sin botón de confirmar entrega.'},
  liquidaciones:{s:'scr_Liquidaciones',d:'VIAJES · LIQUIDACIONES · EVIDENCIAS',f:'Filter(LIQUIDACIONES; Decision="")',n:'Cada envío es un renglón nuevo en LIQUIDACIONES; no se sobrescribe.'},
  comercial:{s:'scr_Comercial',d:'VIAJES · AGRUPACIONES_COMERCIALES',f:'Filter(VIAJES; Estado.Value="ACEPTADO")',n:'La validación de un solo cliente por factura debe vivir en el servidor.'},
  proyectos:{s:'scr_Proyectos',d:'CLIENTES · VIAJES',f:'GroupBy(VIAJES; "Cliente"; "Viajes")',n:''},
  proyecto:{s:'scr_Proyecto',d:'VIAJES',f:'Filter(VIAJES; Cliente=gblClienteSel)',n:''},
  todos:{s:'scr_Viajes_Todos',d:'VIAJES',f:'Search(VIAJES; txtBuscar.Text; "IdViaje"; "Piloto")',n:''},
  catalogos:{s:'scr_Catalogos',d:'PILOTOS · FLOTA · ORIGEN · DESTINOS',f:'PILOTOS; FLOTA; ORIGEN; DESTINOS',n:'Solo lectura.'},
  usuarios:{s:'scr_Usuarios',d:'USUARIOS · ACCESO_CLIENTE · PERMISOS',f:'LookUp(PERMISOS; Rol=gblRol && Permiso="liq_aprobar").Habilitado',n:'Solo el rol con permisos_gestionar puede cambiar la matriz; cada cambio queda en AUDITORIA.'},
  auditoria:{s:'scr_Auditoria',d:'AUDITORIA',f:'SortByColumns(AUDITORIA; "FechaHora"; Descending)',n:'La tabla debe ser de solo agregar (sin permiso de editar/eliminar para nadie).'},
  finanzas:{s:'scr_Finanzas',d:'VIAJES · AGRUPACIONES_COMERCIALES · COBROS · PAGOS',f:'finCalc(VIAJES; AGRUPACIONES; PAGOS; filtros)',n:'Cada factura se suma una sola vez; un dato faltante nunca se toma como cero. Cálculo y permisos deben ejecutarse en el servidor.'},
  rutas:{s:'scr_Rutas',d:'RUTAS · NOTIFICACIONES',f:'Filter(RUTAS; Cliente in gblClientesAsignados && Proyecto in gblProyectosAsignados)',n:'Las notificaciones requieren un flujo de Power Automate (correo/Teams) para salir de la aplicación.'},
  modelo:{s:'scr_Modelo',d:'—',f:'',n:'Pantalla de documentación.'}
};
function archBar(){
  if(!PREF.arch)return'';const a=ARCH[S.view];if(!a)return'';
  return `<aside class="arch"><b>Power Apps</b> · Pantalla <code>${a.s}</code> · Origen de datos <code>${a.d}</code>${a.f?`<br><code>${esc(a.f)}</code>`:''}${a.n?`<br>${esc(a.n)}`:''}</aside>`;
}

const VIEWS={},BODY={};
/* ---- Login ---- */
function loginHTML(){
  const sb=BACKEND.modo==='supabase';
  let host='';if(sb){try{host=new URL(MASTER_CONFIG.SUPABASE_URL).host;}catch(e){}}
  const demo=sb?'':DB.usuarios.filter(u=>u.activo).map(u=>`<button type="button" data-act="fill" data-u="${u.usuario}"><b>${esc(first(u.nombre))}</b><small>${esc(ROLES[u.rol].label)}${(u.rol!=='ADMIN'&&clientesAsig(u).length)?' · '+esc(clientesAsig(u).join(', ')):''}</small></button>`).join('');
  const inst=PWA.puedeMostrarInstalar()?`<button class="btn" type="button" data-act="${PWA.prompt?'instalar':'instalarAyuda'}" style="width:100%;margin-top:14px">${icon('phone',18)} ${PWA.prompt?'Instalar aplicación':'Cómo instalar la aplicación'}</button>`:'';
  return `<div class="login">
    <section class="lp">
      <button class="protogear" data-act="menu" aria-label="Opciones">${icon('gear',18)} Opciones</button>
      <img class="logo" src="${LOGO_BLANCO}" alt="In Transit · innovative outsourcing" width="300" height="102">
      <div><h1>Control de viajes</h1><p>Desde la asignación del viaje hasta la gestión comercial, con un historial completo.</p></div>
      <svg class="route" viewBox="0 0 440 150" fill="none" aria-hidden="true"><path class="draw" d="M14 120C90 120 90 40 170 40S250 110 320 90 400 30 426 30" stroke="#14A1FF" stroke-width="3" stroke-linecap="round" stroke-dasharray="640"/><circle cx="14" cy="120" r="9" fill="#005697" stroke="#BFE0F7" stroke-width="3"/><circle cx="170" cy="40" r="6" fill="#14A1FF"/><circle cx="426" cy="30" r="10" fill="#fff"/></svg>
    </section>
    <section class="lf"><div class="box">
      <img class="brandc" src="${LOGO_COLOR}" alt="In Transit · innovative outsourcing" width="280" height="95">
      <h2>Ingresar</h2>
      <div class="cnx ${sb?'':'demo'}">${sb?`Servidor configurado: <b>${esc(host)}</b>`:(SIN_DEMO?'<b>Sin configurar.</b> Falta la conexión con Supabase: escribe la URL y la clave publishable en <code>js/config.js</code> (consulta el README).':'<b>Modo demostración.</b> Los datos son de ejemplo y viven solo en este navegador: no es una base de datos real.')}</div>
      <form id="loginform" autocomplete="off">
        <div class="fgroup"><label for="u">${sb?'Correo electrónico':'Usuario'}</label><input type="${sb?'email':'text'}" id="u" value="${esc(S.loginU)}" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="${sb?'username':'off'}" enterkeyhint="next"></div>
        <div class="fgroup"><label for="p">Contraseña</label><input type="password" id="p" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="${sb?'current-password':'off'}" enterkeyhint="go"></div>
        ${S.loginErr?`<div class="err" role="alert">${esc(S.loginErr)}${sb?'':'<br><span class="mute" style="font-weight:400">Toca uno de los usuarios de prueba de abajo para llenar los datos.</span>'}</div>`:''}
        <button class="btn primary lg" type="button" data-act="login" style="width:100%;margin-top:8px">INGRESAR</button>
      </form>
      ${inst}
      ${sb?'':`<div class="section" style="margin-top:20px"><div class="mute" style="font-size:13px;margin-bottom:8px">Usuarios de prueba (toca uno para llenar los datos)</div><div class="demo">${demo}</div><div class="mute" style="font-size:12px;margin-top:10px">Contraseñas de demostración guardadas en el navegador: no es autenticación segura.</div></div>`}
      ${PREF.arch?`<aside class="arch" style="margin:16px 0 0"><b>Arquitectura</b> · <code>${ARCH.login.s}</code><br>${esc(ARCH.login.n)}</aside>`:''}
    </div></section></div>`;
}

/* ---- Inicio del encargado ---- */
VIEWS.inicio=()=>{
  const u=S.user,cls=clientesAsig(u).map(id=>PROYECTOS.find(p=>p.id===id)).filter(Boolean),all=vis(),ts=S.inicioProy?all.filter(t=>t.proyecto===S.inicioProy):all;
  const w={RECHAZADO:0,ENTREGADO:1,PLANIFICADO:2};
  const act=ts.filter(t=>w[t.estado]!==undefined).sort((a,b)=>w[a.estado]-w[b.estado]);
  const fix=cnt(ts,t=>t.estado==='RECHAZADO');
  return `<div class="inner">
    <div class="hello"><h1>Bienvenido, ${esc(first(u.nombre))}</h1><div class="projline">${cls.length?comboHTML('inicioProy',S.inicioProy||'',[{id:'',nombre:'Todos mis proyectos'},...cls.map(p=>({id:p.id,nombre:p.nombre+' · '+p.cliente}))],'Buscar proyecto'):'<span class="mute">Sin cliente asignado</span>'}<span class="mute">Solo ves la información de tu proyecto</span></div></div>
    <div class="bigbtns">
      <button class="bigbtn main1" data-act="nav" data-v="nuevo"><span class="ico">${icon('plus',24)}</span><span><b>NUEVO VIAJE</b><br><span class="h">Registrar un viaje</span></span></button>
      <button class="bigbtn" data-act="nav" data-v="viajes"><span class="ico">${icon('truck',24)}</span><span><b>VIAJES</b><br><span class="h">${cnt(ts,t=>t.estado==='PLANIFICADO')} planificados · ${cnt(ts,t=>t.estado==='EN_RUTA')} en ruta</span></span></button>
      <button class="bigbtn" data-act="nav" data-v="liquidaciones"><span class="ico">${icon('receipt',24)}</span><span><b>LIQUIDACIONES</b><br><span class="h">${cnt(ts,t=>t.estado==='ENTREGADO')} por liquidar · ${fix} rechazados</span></span></button>
    </div>
    ${fix?`<div class="alertbox" style="margin-top:18px;display:flex;gap:10px;align-items:center">${icon('alert',20)}<span><b>${fix} ${fix===1?'viaje fue rechazado':'viajes fueron rechazados'}</b>. Ábrelos para ver los comentarios y corregirlos.</span></div>`:''}
    <section class="section"><h2>Requiere tu atención</h2>${act.length?`<div class="cards">${act.map(tripCard).join('')}</div>`:empty('Todo al día','No tienes viajes esperando una acción.')}</section>
  </div>`;
};

/* ---- Selector desplegable con búsqueda (listas largas de clientes/proyectos) ---- */
const CBOPTS={},CBVAL={};
function cbListHTML(flt){
  const opts=CBOPTS[flt]||[],q=(S.cbq||'').toLowerCase(),cur=String(flt).startsWith('m:')?CBVAL[flt]:S[flt];
  const list=opts.filter(o=>!q||String(o.nombre).toLowerCase().includes(q));
  const lim=CBLIM[flt],vista=lim?list.slice(0,lim):list;
  return list.length?vista.map(o=>`<button type="button" role="option" data-act="cbPick" data-k="${flt}" data-v="${esc(o.id)}" aria-selected="${o.id===cur}">${esc(o.nombre)}</button>`).join('')+(lim&&list.length>lim?`<div class="cb-empty">Mostrando ${lim} de ${list.length}: escribe para acotar</div>`:''):'<div class="cb-empty">Sin resultados</div>';
}
function comboHTML(flt,value,opts,ph){
  CBOPTS[flt]=opts;if(String(flt).startsWith('m:'))CBVAL[flt]=value;
  const cur=opts.find(o=>o.id===value),open=S.cb===flt;
  return `<div class="cb" data-cb="${flt}">
    <button type="button" class="cb-btn" data-act="cbToggle" data-k="${flt}" aria-haspopup="listbox" aria-expanded="${open}"><span>${esc(cur?cur.nombre:(ph||'Todos'))}</span><span class="cb-c">▾</span></button>
    ${open?`<div class="cb-panel" role="listbox"><input type="text" class="cb-q" data-cbq="${flt}" placeholder="Buscar…" value="${esc(S.cbq||'')}" aria-label="Buscar opción" autocomplete="off"><div class="cb-list">${cbListHTML(flt)}</div></div>`:''}</div>`;
}
/* ---- Tabla de viajes: acciones fijas a la derecha al desplazar ---- */
function accionesViaje(t){
  const b=(act,lbl,cls)=>`<button class="btn sm ${cls||''}" data-act="${act}" data-id="${t.id}">${lbl}</button>`;
  let a=b('detalle','Ver','ghost');
  if(canEdit(t))a+=b('editar','Editar','');
  if(t.estado==='PLANIFICADO'&&hp('viajes_iniciar')&&mine(t))a+=b('iniciarAsk','En ruta','primary');
  if(t.estado==='EN_RUTA'&&hp('viajes_finalizar')&&mine(t))a+=b('finalizarAsk','Entregado','primary');
  if(['ENTREGADO','RECHAZADO'].includes(t.estado)&&hp('liq_enviar')&&mine(t))a+=b('detalle',t.estado==='RECHAZADO'?'Corregir':'Liquidar','primary');
  if(t.estado==='LIQUIDADO'&&hp('liq_aprobar'))a+=b('aprobarAsk','Aceptar','ok');
  if(t.estado==='LIQUIDADO'&&hp('liq_devolver'))a+=b('devolverOpen','Rechazar','fix');
  if(['ENTREGADO','RECHAZADO'].includes(t.estado)&&hp('viajes_aprobar_duplicado')&&String(t.shipment||'').trim()&&!/^DUP-/i.test(t.shipment))a+=b('shipmentDupOpen','Aprobar DUP','fix');
  return a;
}
function viajesTable(list){
  if(!list.length)return empty('No hay viajes en esta pestaña','Cuando un viaje cambie de estado aparecerá aquí.');
  return `<div class="xlwrap"><table class="xl" style="min-width:1500px"><thead><tr><th class="stk">Viaje</th><th>Fecha plan</th><th>Cliente</th><th>Proyecto</th><th>Ruta</th><th>Piloto</th><th>Unidad · placa</th><th>Estatus</th><th>Estado</th><th class="stkR">Acciones</th></tr></thead><tbody>
  ${list.map(t=>{const j=J(t),dup=String(t.shipment||'').trim()&&!/^DUP-/i.test(t.shipment)&&DB.trips.some(x=>x.id!==t.id&&String(x.shipment||'').trim().toLowerCase()===String(t.shipment||'').trim().toLowerCase());return `<tr><td class="stk"><button class="linkbtn" data-act="detalle" data-id="${t.id}">#${t.id}</button></td><td>${fmtL(t.fechaPlan)}</td><td>${esc(j.cliente)}</td><td>${esc(t.proyectoCat)}</td><td style="white-space:normal;min-width:220px">${rutaHTML(t)}</td><td>${esc(j.piloto)}</td><td>${esc(j.f.unidad)} · ${esc(j.f.placa)}</td><td class="${dup?'warnl':''}">${est(t)||'<span class="mute">—</span>'}${dup?' <b>Shipment duplicado</b>':''}</td><td>${badge(t.estado)}</td><td class="stkR">${accionesViaje(t)}</td></tr>`;}).join('')}
  </tbody></table></div>`;
}

/* ---- Viajes del encargado ---- */
const VT=[
  {k:'plan',l:'Planificados',f:t=>t.estado==='PLANIFICADO',d:'Viajes iniciales: requieren cliente y ruta; se completan antes de salir.'},
  {k:'ruta',l:'En ruta',f:t=>t.estado==='EN_RUTA',d:'Viajes en recorrido con los datos operativos completos.'},
  {k:'liq',l:'Por liquidar',f:t=>['ENTREGADO','RECHAZADO'].includes(t.estado),d:'Entregados pendientes de evidencia, o rechazados que Operaciones debe corregir.'},
  {k:'cierre',l:'Cerrados',f:t=>['LIQUIDADO','ACEPTADO','FACTURADO','COBRADO'].includes(t.estado),d:'Viajes en validación, facturación o cobro.'}
];
VIEWS.viajes=()=>{
  const ts=vis(),k=S.tab.viajes||'plan',cur=VT.find(x=>x.k===k)||VT[0],list=ts.filter(cur.f);
  return `<div class="inner" style="max-width:none">${pageHead('Viajes',`${list.length} ${list.length===1?'viaje':'viajes'} en esta pestaña`,hp('viajes_crear')?`<button class="btn primary" data-act="nav" data-v="nuevo">${icon('plus',18)} Nuevo viaje</button>`:'')}
    ${tabs('viajes',VT,k,ts)}<div class="tabdesc">${cur.d}</div>
    ${viajesTable(list)}</div>`;
};


const curModel=()=>S.edit?S.edit.data:S.form;
function initForm(){
  const d=new Date();d.setMinutes(Math.ceil(d.getMinutes()/5)*5);
    const m={proyecto:esEnc()?(clientesAsig(S.user).length===1?clientesAsig(S.user)[0]:''):(S.user.rol==='ADMIN'?'':(clientesAsig(S.user)[0]||'')),proyectoCat:'',shipment:'',noViaje:'',opl:'',tipoViaje:'',tipoCarga:'',noCarga:'',producto:'',placaArrastre:'',
    fechaPlanD:todayStr(),fechaPlanT:pad(d.getHours())+':'+pad(d.getMinutes()),estatus:'EN ESPERA',pilotoId:'',rutaId:'',rutaRef:'',noDocRetorno:'',qViaticos:'',savedId:null,err:''};
  TKEYS.forEach(k=>m[k]='');
  const pc=usaCombo()?(m.proyecto?proyectosAsig(S.user,m.proyecto):[]):PROYECTOS_X[m.proyecto];if(pc&&pc.length===1)m.proyectoCat=pc[0];
  return m;
}
function toModel(t){
  const m={proyecto:t.proyecto,fechaPlanD:planD(t),fechaPlanT:planT(t),err:''};
  ['proyectoCat','shipment','noViaje','opl','tipoViaje','tipoCarga','noCarga','producto','placaArrastre','estatus','pilotoId','rutaId','rutaRef','noDocRetorno','qViaticos',...TKEYS].forEach(k=>m[k]=t[k]==null?'':t[k]);
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
    g.filas.slice().sort((a,b)=>String(a.id).localeCompare(String(b.id))).forEach(r=>{const o=r.origenId||FALTA,d=r.destinoId||FALTA;if(!vistos.has(o+'|'+d))vistos.set(o+'|'+d,{o,d,id:r.id});});
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
  if(k==='proyecto'){M.proyectoCat='';M.pilotoId='';M.placaSel='';limpiaRuta();const pc=M.proyecto?proyectosAsig(S.user,M.proyecto):[];if(pc.length===1)M.proyectoCat=pc[0];}
  if(k==='proyectoCat')limpiaRuta();
  if(k==='rutaGrupo'){
    M.rutaO='';M.rutaD='';
    if(v==='NO_ASIGNADA')M.rutaId='NO_ASIGNADA';
    else{M.rutaRef='';const g=rutasGrupos(M).find(x=>x.key===v);if(g){if(M.proyecto!==g.cliente){M.proyecto=g.cliente;M.pilotoId='';M.placaSel='';}M.proyectoCat=g.proyecto;}resolverRuta(M);}   /* cliente y proyecto salen de la ruta elegida */
  }
  if(k==='rutaO'||k==='rutaD')resolverRuta(M);
  if(k==='placaSel'){M.pilotoId='';const ps=pilotosDePlaca(M.proyecto,v);if(ps.length===1)M.pilotoId=ps[0].id;}   /* el piloto sale de la relación placa → unidad → piloto; no se elige a mano */
  if(k==='pilotoAlt')M.pilotoId=v;                                                                              /* solo si la placa tiene más de un piloto asignado */
  if(k==='pilotoId'&&v)S.flash=true;
}

/* =====================================================================
   ADMINISTRADOR · Clientes (tabla), Facturación (viaje), Nuevo viaje (placa), Rutas (catálogo desplegable)
   ===================================================================== */
const cliNombre=id=>(DB.clientes.find(c=>c.id===id)||{}).nombre||(PROYECTOS.find(p=>p.id===id)||{}).cliente||id;
const kvr=(k,x)=>`<dt>${k}</dt><dd>${x}</dd>`;      /* (en el detalle de viaje existe una versión local idéntica) */
const vacioTxt=v=>(v==null||String(v).trim()==='')?'<span class="mute">—</span>':esc(v);
function torreCfgAdmin(){return `<section class="section"><h2>Torre de Control</h2><div class="mute" style="margin:-6px 0 10px;font-size:13px">Torre solo puede cambiar el estatus operativo, y solo de los clientes marcados. Los estatus que implican cierre, cancelación o liquidación nunca se delegan.</div>
      <div class="grid g2"><div class="card"><h3>Clientes cuyo estatus puede actualizar</h3>${DB.clientes.map(c=>`<label style="display:flex;gap:10px;align-items:center;min-height:36px"><input type="checkbox" data-torre="${c.id}" ${c.torreEstatus?'checked':''}> <b>${esc(c.nombre)}</b></label>`).join('')}</div>
      <div class="card"><h3>Estatus que puede asignar</h3><div class="bgs">${CAT.estatus.map(e=>{const veda=ESTATUS_VEDADOS.includes(e);return `<label class="chip" style="display:flex;gap:6px;align-items:center;${veda?'opacity:.5':''}"><input type="checkbox" data-torreop="${esc(e)}" ${DB.config.torreEstatus.includes(e)?'checked':''} ${veda?'disabled title="No se delega a Torre de Control"':''}> ${esc(e)}</label>`;}).join('')}</div></div></div></section>`;}
function clientesAdminHTML(){
  const gest=hp('clientes_gestionar');
  const lista=DB.clientes.slice().sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));
  if(S.cliFiltro&&!lista.some(c=>c.id===S.cliFiltro))S.cliFiltro='';
  const f=S.cliFiltro||'',filas=lista.filter(c=>!f||c.id===f);
  const opts=[{id:'',nombre:'Todos los clientes'}].concat(lista.map(c=>({id:c.id,nombre:c.nombre})));
  const link=u=>/^https?:\/\//i.test(String(u||'').trim())?`<a href="${esc(String(u).trim())}" target="_blank" rel="noopener noreferrer">Abrir contrato</a>`:vacioTxt(u);
  const cab=['ID cliente','Cliente','Cliente padre','Servicio','Nombre usuario','Correo','Teléfono','Link contrato','NIT','Proyecto','Estado','Creado','Acciones'];
  const tabla=!lista.length
    ?`<div class="alertbox info"><b>No hay clientes registrados.</b> ${catalogoFalla()?esc(catalogoFalla()):'La base de datos no devolvió clientes.'}${REINTENTAR}</div>`
    :`<div class="xlwrap" style="max-height:none"><table class="xl" id="tablaClientes" style="min-width:1750px"><thead><tr>${cab.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>
      ${filas.map(c=>`<tr class="${c.activo===false?'dim':''}"><td><b>${esc(c.id)}</b></td><td>${esc(c.nombre)}</td><td>${vacioTxt(c.clientePadre)}</td><td>${vacioTxt(c.servicio)}</td><td>${vacioTxt(c.contacto)}</td><td>${vacioTxt(c.correoFacturacion)}</td><td>${vacioTxt(c.telefono)}</td><td>${link(c.linkContrato)}</td><td>${c.nit?esc(c.nit):'<span class="warnl">Pendiente</span>'}</td><td style="white-space:normal;min-width:160px">${(c.proyectos||[]).length?esc(c.proyectos.join(', ')):'<span class="warnl">Sin proyectos</span>'}</td><td>${chip(c.activo===false?'neutral':'done',c.activo===false?'Inactivo':'Activo')}</td><td>${c.creadoEn?fmtDT(c.creadoEn):'<span class="mute">—</span>'}${c.creadoPor?`<br><span class="mute">${esc(c.creadoPor)}</span>`:''}</td><td style="white-space:nowrap">${gest?`<button class="btn sm" data-act="clienteOpen" data-id="${c.id}">Editar</button> <button class="btn sm ${c.activo===false?'ok':'fix'}" data-act="clienteEstado" data-id="${c.id}">${c.activo===false?'Activar':'Desactivar'}</button> `:''}<button class="btn sm ghost" data-act="proj" data-id="${c.id}">Ver viajes</button></td></tr>`).join('')}
      </tbody></table></div>`;
  return `<div class="inner" style="max-width:none">${pageHead('Clientes','Tabla de clientes: contacto, contrato, NIT y proyectos',gest?`<button class="btn primary" data-act="clienteOpen" data-id="">${icon('plus',18)} Nuevo cliente</button>`:'')}
    ${lista.length?`<div class="lfilters" style="grid-template-columns:minmax(220px,360px) auto 1fr;align-items:center"><div>${comboHTML('cliFiltro',f,opts,'Todos los clientes')}</div>${f?`<button class="btn sm" data-act="cliLimpiar">Limpiar filtro</button>`:'<span></span>'}<span class="mute">${filas.length} de ${lista.length} ${lista.length===1?'cliente':'clientes'}</span></div>`:''}
    ${tabla}
    ${gest?`${torreCfgAdmin()}`:''}</div>`;
}
/* ---- Nuevo viaje · placa del equipo: la relación placa → unidad → piloto se resuelve sola ---- */
function pilotosDePlaca(cliente,unidad){return PILOTOS.filter(p=>p.proyecto===cliente&&p.unidad&&p.unidad===unidad);}
function placasDe(cliente){const m=new Map();PILOTOS.filter(p=>p.proyecto===cliente&&p.unidad).forEach(p=>{const f=FLOTA.find(x=>x.unidad===p.unidad);if(f&&!m.has(f.unidad))m.set(f.unidad,f);});return [...m.values()].sort((a,b)=>String(a.placa).localeCompare(String(b.placa),'es'));}
function autoPlaca(M,plSel,ps){
  const U=plSel?FLOTA.find(x=>x.unidad===plSel):null;
  if(!U)return `<div class="auto empty2">Elige la placa: la unidad, el Tango, el tipo de unidad, la capacidad y el piloto asignado se cargan solos.</div>`;
  const P=PILOTOS.find(p=>p.id===M.pilotoId);
  const aviso=!ps.length?`<div class="auto" style="border-color:var(--fix);background:var(--fix-bg);margin-bottom:10px"><div class="ah" style="color:var(--fix)">${icon('alert',18)} Esta placa no tiene un piloto asignado para este cliente</div><div>El viaje necesita un piloto. Pide a administración que asigne la unidad ${esc(U.unidad)} a un piloto en la lista de pilotos.</div></div>`:'';
  return aviso+`<div class="auto ${S.flash?'flash':''}"><div class="ah">${icon('check',18)} Datos cargados automáticamente</div><div class="cells">
    <div class="cell"><small>Placa ${src('FLOTA')}</small><b>${esc(U.placa)}</b></div>
    <div class="cell"><small>Unidad ${src('PILOTOS')}</small><b>${esc(U.unidad)}</b></div>
    <div class="cell"><small>Tango ${src('FLOTA')}</small><b>${esc(U.tango)}</b></div>
    <div class="cell"><small>Tipo de unidad ${src('FLOTA')}</small><b>${esc(U.tipo)}</b></div>
    <div class="cell"><small>Capacidad ${src('FLOTA')}</small><b>${esc(U.capacidad)}</b></div>
    <div class="cell"><small>Piloto asignado ${src('PILOTOS')}</small><b>${P?esc(P.nombre):'<span class="mute">por definir</span>'}</b></div></div></div>`;
}
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
      ${kvr('Ruta',R?esc(rutaEtiqueta(R)):'<span class="mute">—</span>')}${kvr('Origen',t.origenId?esc(nombreOrigen(t.origenId)):'<span class="mute">—</span>')}${kvr('Destino',t.destinoId?esc(nombreDestino(t.destinoId)):'<span class="mute">—</span>')}
      ${kvr('Piloto',P.nombre?esc(P.nombre):'<span class="mute">—</span>')}${kvr('Placa · unidad',U.placa?esc(U.placa)+' · '+esc(U.unidad):'<span class="mute">—</span>')}${kvr('Estado',badge(t.estado))}
      ${kvr('Tarifa del cliente',tar==null?'<span class="mute">sin registrar</span>':qfmt(tar))}${kvr('Factura',g&&g.numeroFactura?esc(g.numeroFactura):'<span class="mute">sin factura</span>')}${kvr('Estado de facturación',g?etapaBadge(etapaAgr(g)):'<span class="mute">Aún no se envió a facturar</span>')}
      ${kvr('Grupo de viajes',g&&g.modalidad==='AGRUPADA'?esc(g.id):'<span class="mute">—</span>')}${kvr('Enviado a facturar',g&&g.envio?esc(fmtDT(g.envio.en)):'<span class="mute">—</span>')}${kvr('Importe enviado',imp==null?'<span class="mute">—</span>':qfmt(imp))}</dl>
    ${g?'':'<div class="mute" style="margin-top:8px;font-size:13px">Este viaje todavía no se ha enviado a facturar, por eso no aparece en la tabla de abajo.</div>'}</div>`;
}
/* ---- Rutas · catálogo desplegable (cada ruta una vez) con origen/destino ---- */
function agruparRutas(filas){
  const mapa=new Map();
  filas.forEach(r=>{const k=claveRuta(r);if(!mapa.has(k))mapa.set(k,{key:k,cliente:r.cliente,proyecto:r.proyecto,nombre:rutaEtiqueta(r),filas:[]});mapa.get(k).filas.push(r);});
  const gs=[...mapa.values()].map(g=>{const v=new Map();g.filas.forEach(r=>{const o=r.origenId||FALTA,d=r.destinoId||FALTA;if(!v.has(o+'|'+d))v.set(o+'|'+d,{o,d});});return {key:g.key,cliente:g.cliente,proyecto:g.proyecto,nombre:g.nombre,filas:g.filas,combos:[...v.values()],activa:g.filas.some(r=>r.estado==='ACTIVA')};});
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
  const P=PILOTOS.find(p=>p.id===M.pilotoId),U=P&&P.unidad?FLOTA.find(x=>x.unidad===P.unidad):null;
  let h;
  if(!P)h=`<div class="auto empty2">Elige un piloto: la unidad, la placa, el Tango, el tipo de unidad y la capacidad se cargan solos.</div>`;
  else if(!U)h=`<div class="auto" style="border-color:var(--fix);background:var(--fix-bg)"><div class="ah" style="color:var(--fix)">${icon('alert',18)} ${esc(P.nombre)} no tiene unidad asignada en PILOTOS</div><div>Pide a administración que actualice la asignación para poder registrar el viaje.</div></div>`;
  else h=`<div class="auto ${S.flash?'flash':''}"><div class="ah">${icon('check',18)} Datos cargados automáticamente · no hay que escribirlos</div><div class="cells">
    <div class="cell"><small>Unidad ${src('PILOTOS')}</small><b>${esc(U.unidad)}</b></div>
    <div class="cell"><small>Placa ${src('FLOTA')}</small><b>${esc(U.placa)}</b></div>
    <div class="cell"><small>Tango ${src('FLOTA')}</small><b>${esc(U.tango)}</b></div>
    <div class="cell"><small>Tipo de unidad ${src('FLOTA')}</small><b>${esc(U.tipo)}</b></div>
    <div class="cell"><small>Capacidad ${src('FLOTA')}</small><b>${esc(U.capacidad)}</b></div></div></div>`;
  S.flash=false;return h;
}
function dursHTML(M){
  return `<div class="durs">${DUR.map(([l,a,b])=>{const v=diff(M[a],M[b]);return `<div class="dur"><small>${l}</small><b class="${v==='Revisar fechas'?'bad':''}">${v}</b></div>`;}).join('')}</div>`;
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
      <div class="row2">${sel('tipoViaje','Tipo de viaje',CAT.tipoViaje,{src:'CATALOGO'})}${sel('tipoCarga','Tipo de carga',CAT.tipoCarga,{src:'CATALOGO'})}</div>
      <div class="row2">${txt('placaArrastre','Placa del equipo de arrastre')}${txt('noCarga','No. de carga',{type:'number',num:1,hint:'Cantidad, según el tipo de carga'})}</div>
      <div class="row2">${txt('producto','Producto')}${txt('noViaje','Referencia interna (opcional)')}</div></div>`;
  }
  if(has('plan')){
    h+=`<div class="card fsec"><h3>${has('estatus')?'Fecha plan y estatus':'Fecha plan'}</h3>
      <div class="row2"><div class="fgroup"><label for="m_fechaPlanD">Fecha plan <span class="mute">*</span></label><input type="date" id="m_fechaPlanD" data-m="fechaPlanD" value="${esc(M.fechaPlanD)}" ${d}><span class="hint">Hoy por defecto; puedes cambiarla</span></div>
      <div class="fgroup"><label for="m_fechaPlanT">Hora plan <span class="mute">*</span></label><input type="time" id="m_fechaPlanT" data-m="fechaPlanT" value="${esc(M.fechaPlanT)}" ${d}></div></div>
      ${has('estatus')?sel('estatus','Estatus',CAT.estatus,{src:'CATALOGO',hint:'Cámbialo según avanza el viaje (en rampa, espera con cliente, reprogramado…)'}):''}</div>`;
  }
  if(has('unidad')&&esAdm()){
    const falla=catalogoFalla(),plSel=M.placaSel||((PILOTOS.find(p=>p.id===M.pilotoId)||{}).unidad||'');
    const placas=(ready&&!falla)?placasDe(M.proyecto):[],actual=(plSel&&!placas.some(x=>x.unidad===plSel))?FLOTA.find(x=>x.unidad===plSel):null;
    const opts=placas.concat(actual?[actual]:[]).map(f=>({id:f.unidad,nombre:`${f.placa} · ${f.unidad}${f.capacidad?' · '+f.capacidad:''}`}));
    const ps=plSel?pilotosDePlaca(M.proyecto,plSel):[],sinPlacas=ready&&!falla&&!opts.length;
    h+=`<div class="card fsec"><h3>Placa y unidad</h3>
      ${falla?`<div class="alertbox" role="alert" style="margin-bottom:10px"><b>${esc(falla)}</b>${REINTENTAR}</div>`:''}
      ${fcombo('placaSel','Placa del equipo',opts,plSel,{req:1,src:'FLOTA',dis:!ready||!!falla||sinPlacas,ph:!ready?'Primero elige el cliente o la ruta':(falla?'No disponible':(sinPlacas?'Sin placas disponibles':'Selecciona o escribe la placa')),hint:sinPlacas?'Este cliente no tiene placas disponibles: ninguno de sus pilotos tiene una unidad asignada en la flota.':''})}
      ${ps.length>1?`<div class="fgroup"><label for="m_pilotoAlt">Piloto de esta placa <span class="mute">*</span></label><select id="m_pilotoAlt" data-m="pilotoAlt" ${d}><option value="">Esta placa tiene ${ps.length} pilotos asignados: elige uno</option>${ps.map(p=>`<option value="${esc(p.id)}" ${p.id===M.pilotoId?'selected':''}>${esc(p.nombre)}</option>`).join('')}</select></div>`:''}
      ${autoPlaca(M,plSel,ps)}</div>`;
  }
  if(has('unidad')&&!esAdm()){
    h+=`<div class="card fsec"><h3>Piloto y unidad</h3>
      ${sel('pilotoId','Piloto',PILOTOS.filter(p=>p.proyecto===M.proyecto).map(p=>({id:p.id,nombre:p.nombre})),{req:1,src:'PILOTOS',dis:!ready,ph:ready?'Selecciona un piloto':'Primero elige el cliente'})}
      ${autoCard(M)}</div>`;
  }
  if(has('ruta')&&!usaCombo()){
    const rs=(ready&&M.proyectoCat)?API.rutasParaViaje(S.user.id,M.proyecto,M.proyectoCat):[];
    const pend=M.rutaId==='NO_ASIGNADA',R=(!pend&&M.rutaId)?DB.rutas.find(x=>x.id===M.rutaId):null;
    const opts=rs.map(r=>({id:r.id,nombre:`${r.codigo} · ${nombreOrigen(r.origenId)} → ${nombreDestino(r.destinoId)}`})).concat(S.edit||!hp('rutas_solicitar')?[]:[{id:'NO_ASIGNADA',nombre:'NUEVA RUTA · requiere validación, tarifa y doble aprobación'}]);
    h+=`<div class="card fsec"><h3>Ruta</h3>
      ${sel('rutaId','Ruta',opts,{req:1,src:'RUTAS',dis:!ready||!M.proyectoCat,ph:(ready&&M.proyectoCat)?'Selecciona la ruta':'Primero elige el cliente y el proyecto',hint:(ready&&M.proyectoCat)?rs.length+' rutas asignadas de '+esc(M.proyectoCat):''})}
      ${pend?`${txt('rutaRef','Referencia de la ruta pendiente',{req:1,hint:'Describe qué ruta necesitas. No se inventa origen ni destino: Comercial y Gerencia la revisan y la asignan.'})}<div class="alertbox info" style="margin-bottom:10px"><b>Ruta NO ASIGNADA:</b> el viaje se guarda, se avisa a Comercial y Gerencia (dentro de la aplicación) y no recibe tarifa automática hasta que la ruta se valide.</div>`:''}
      <div class="${R?'auto'+(S.flash?' flash':''):'auto empty2'}">${R?`<div class="ah">${icon('check',18)} Origen y destino tomados de la ruta · no se escriben a mano</div><div class="cells"><div class="cell"><small>Código ${src('RUTAS')}</small><b>${esc(R.codigo)}</b></div><div class="cell"><small>Origen ${src('RUTAS')}</small><b>${esc(nombreOrigen(R.origenId))}</b></div><div class="cell"><small>Destino ${src('RUTAS')}</small><b>${esc(nombreDestino(R.destinoId))}</b></div></div>`:(pend?'Origen y destino: pendientes de asignar.':'Elige la ruta: el origen y el destino se completan solos.')}</div></div>`;
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
    if(pend)od=`<div class="auto empty2">Origen y destino: pendientes de asignar.</div>`;
    else if(R.g)od=`<div class="row2">${campoOD('Origen',R.os,R.o,'rutaO',nomO)}${campoOD('Destino',R.ds,R.d,'rutaD',nomD)}</div>`;
    else od=`<div class="auto empty2">Elige la ruta: el origen y el destino se completan solos.</div>`;
    h+=`<div class="card fsec"><h3>Ruta</h3>
      ${falla?`<div class="alertbox" role="alert" style="margin-bottom:10px"><b>${esc(falla)}</b>${REINTENTAR}</div>`:''}
      ${fcombo('rutaGrupo','Ruta',opts,val,{req:1,src:'RUTAS',dis:!listo,ph:listo?'Selecciona la ruta':'No disponible',hint:(listo&&R.grupos.length&&!elegido&&!R.g)?'Puedes elegir la ruta primero: el cliente y el proyecto se completan solos.':''})}
      ${sinRutas?`<div class="alertbox info" style="margin-bottom:10px">${elegido?`No hay rutas activas para ${esc(M.proyectoCat)}.${puedeNuevaAqui?' Puedes solicitar una nueva con la opción «NUEVA RUTA».':' Pide a Comercial que active una ruta para este proyecto.'}`:'No hay rutas activas disponibles para tu usuario. Pide a Comercial que active una ruta, o elige primero el cliente y el proyecto para solicitar una nueva.'}${esAdm()?REINTENTAR:''}</div>`:''}
      ${pend?`${txt('rutaRef','Referencia de la ruta pendiente',{req:1,hint:'Describe qué ruta necesitas. No se inventa origen ni destino: Comercial y Gerencia la revisan y la asignan.'})}<div class="alertbox info" style="margin-bottom:10px"><b>Ruta NO ASIGNADA:</b> el viaje se guarda, se avisa a Comercial y Gerencia (dentro de la aplicación) y no recibe tarifa automática hasta que la ruta se valide.</div>`:''}
      ${od}</div>`;
  }
  if(has('tiempos')){
    h+=`<div class="card fsec"><h3>Horarios del viaje</h3><div class="lead">Llena cada hora cuando ocurra: toca “Ahora” o escríbela. Puedes dejarlas vacías al registrar el viaje y completarlas después. Los tiempos de abajo se calculan solos.</div>
      <div class="tgrid">${CAMPOS_TIEMPO.map(([k,l])=>`<div class="fgroup"><label for="m_${k}">${lblT(l)}</label><div class="trow"><input type="datetime-local" id="m_${k}" data-m="${k}" value="${esc(M[k])}" ${d}><button type="button" class="btn sm" data-act="ahora" data-k="${k}" ${d}>Ahora</button><button type="button" class="btn ghost sm" data-act="limpiar" data-k="${k}" aria-label="Borrar ${lblT(l)}" ${d}>×</button></div></div>`).join('')}</div>
      <h3 style="margin-top:8px;font-size:14px">Tiempos calculados</h3>${dursHTML(M)}</div>`;
  }
  if(has('otros')){
    h+=`<div class="card fsec"><h3>Retorno y viáticos</h3><div class="row2">${txt('noDocRetorno','No. doc retorno')}${txt('qViaticos','Q viáticos',{type:'number',num:1,hint:'Monto en quetzales'})}</div></div>`;
  }
  return h;
}

VIEWS.nuevo=()=>{
  if(!S.form)S.form=initForm();
  const f=S.form,dis=!!f.savedId,Pl=PILOTOS.find(p=>p.id===f.pilotoId);
  return `<div class="inner form">${pageHead('Registrar nuevo viaje','Incluye todos los campos de VIAJES TRANSPORTES. Lo que ya existe en otras hojas se completa solo. * obligatorio.')}
    ${f.savedId?`<div class="alertbox okb" style="margin-bottom:16px;display:flex;gap:10px;align-items:center">${icon('check',20)}<span><b>Viaje #${f.savedId} guardado.</b> Quedó en estado Pendiente. Puedes registrar otro, abrirlo para actualizar horarios o terminar.</span></div>`:''}
    ${f.err?`<div class="alertbox" style="margin-bottom:16px" role="alert"><b>${esc(f.err)}</b></div>`:''}
    ${fieldsHTML(f,['cliente','plan','estatus','unidad','ruta','tiempos','otros'],dis)}
    <div class="formbtns">
      ${f.savedId?`<button class="btn primary lg" data-act="otro">${icon('plus',18)} REGISTRAR OTRO VIAJE</button><button class="btn lg" data-act="detalle" data-id="${f.savedId}">Abrir viaje #${f.savedId}</button>`:`<button class="btn primary lg" data-act="guardar" ${Pl&&!Pl.unidad?'disabled':''}>GUARDAR VIAJE</button>`}
      <button class="btn lg" data-act="terminar">TERMINAR</button>
    </div></div>`;
};


/* ---- Torre de Control: hoja tipo Excel · solo el estatus operativo de los clientes autorizados ---- */
const TT=[
  {k:'curso',l:'En ruta',f:t=>t.estado==='EN_RUTA'},
  {k:'pend',l:'Planificados',f:t=>t.estado==='PLANIFICADO'},
  {k:'fin',l:'Finalizados',f:t=>FIN.includes(t.estado)},
  {k:'todos',l:'Todos',f:()=>true}
];
const clienteDe=t=>DB.clientes.find(x=>x.id===t.proyecto)||{};
const puedeEstatusTorre=t=>hp('viajes_estatus_torre')&&!!clienteDe(t).torreEstatus&&['PLANIFICADO','EN_RUTA'].includes(t.estado);
function torreList(){
  const base=vis().filter(t=>!S.tProy||t.proyecto===S.tProy),k=S.tab.torre||'curso',cur=TT.find(x=>x.k===k)||TT[0],q=S.q.trim().toLowerCase();
  let l=base.filter(cur.f).filter(t=>!q||(t.id+' '+(J(t).piloto||'')+' '+(J(t).f.placa||'')+' '+(J(t).cliente||'')+' '+(J(t).destino||'')+' '+(t.estatus||'')).toLowerCase().includes(q));
  l.sort((a,b)=>a.proyecto.localeCompare(b.proyecto)||a.id.localeCompare(b.id));
  return l;
}
function estatusOpciones(t){const op=DB.config.torreEstatus.slice();if(t.estatus&&!op.includes(t.estatus))op.unshift(t.estatus);return op;}
function torreSheet(list){
  if(!list.length)return empty('No hay viajes en esta pestaña','Cuando un viaje cambie de estado aparecerá aquí.');
  return `<div class="xlwrap sheet"><table class="xl" style="min-width:1500px"><thead><tr><th class="stk">Viaje</th><th>Cliente</th><th>Proyecto</th><th>Piloto</th><th>Unidad · placa</th><th>Ruta</th><th>Estado</th><th>En ruta</th><th>Estatus operativo</th><th>Fecha plan</th><th>Inicio real (salida)</th><th>Fin descarga</th></tr></thead><tbody>
  ${list.map(t=>{const j=J(t),ed=puedeEstatusTorre(t);
    return `<tr><td class="stk"><button class="linkbtn" data-act="detalle" data-id="${t.id}">#${t.id}</button></td><td>${esc(j.cliente)}</td><td>${esc(t.proyectoCat)}</td><td>${esc(j.piloto)}</td><td>${esc(j.f.unidad)} · ${esc(j.f.placa)}</td><td>${rutaHTML(t)}</td><td>${badge(t.estado)}</td><td>${t.estado==='EN_CURSO'?`<span class="elapsed" style="font-size:14px" data-since="${since(t)}">${elapsed(since(t))}</span>`:'—'}</td>
    <td class="${ed?'ed':'ro'}" style="min-width:250px">${ed?`<div class="trow"><select class="cin sel" data-status="${t.id}" aria-label="Estatus operativo del viaje ${t.id}">${estatusOpciones(t).map(o=>`<option ${o===t.estatus?'selected':''}>${esc(o)}</option>`).join('')}</select>${est(t)}<span class="cst" id="ss_${t.id}" aria-live="polite"></span></div>`:`${est(t)} <span class="mute" style="font-size:12px">${clienteDe(t).torreEstatus?'(no editable en este estado)':'solo consulta'}</span>`}</td>
    <td>${fmtL(t.fechaPlan)}</td><td>${t.tSalida?fmtL(t.tSalida):'—'}</td><td>${t.tFinDescarga?fmtL(t.tFinDescarga):'—'}</td></tr>`;}).join('')}
  </tbody></table></div>`;
}
BODY.torre=()=>`<div class="mute" style="margin-bottom:8px">${torreList().length} viajes</div>${torreSheet(torreList())}`;
VIEWS.torre=()=>{
  const all=vis(),base=S.tProy?all.filter(t=>t.proyecto===S.tProy):all,k=S.tab.torre||'curso';
  const kp=(n,l,c)=>`<div class="kpi"><span class="n">${n}</span><span class="l"><i class="dot" style="background:var(${c})"></i>${l}</span></div>`;
  const chips=comboHTML('tProy',S.tProy,[{id:'',nombre:'Todos los clientes'},...PROYECTOS.map(p=>({id:p.id,nombre:p.nombre}))]);
  const aut=DB.clientes.filter(c=>c.torreEstatus).map(c=>c.nombre);
  const rules=`<div class="rulebar"><span><b>Puedes actualizar el estatus operativo de:</b> ${esc(aut.join(', ')||'ningún cliente')}.</span><span class="mute">Torre no cambia el estado del viaje ni otros datos.</span></div>`;
  return `<div class="inner" style="max-width:none">${pageHead('TORRE DE CONTROL','Hoja de viajes de todos los proyectos · el estatus se guarda solo al elegirlo',`<span class="clock" id="clock">${new Date().toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit',hour12:false})}</span>`)}
    <div class="grid g4" style="margin-bottom:16px">${kp(cnt(base,t=>t.estado==='PLANIFICADO'),'Planificados','--pend')}${kp(cnt(base,t=>t.estado==='EN_RUTA'),'En ruta','--cur')}${kp(cnt(base,t=>puedeEstatusTorre(t)),'Con estatus editable','--ok')}${kp(cnt(base,t=>t.estado==='ENTREGADO'),'Pendientes de liquidación','--warn')}</div>
    ${chips}${rules}${tabs('torre',TT,k,base)}
    <div style="margin:12px 0"><input type="text" id="q" placeholder="Buscar por viaje, piloto, placa, cliente, destino o estatus" value="${esc(S.q)}" aria-label="Buscar" style="max-width:440px"></div>
    <div id="vb">${BODY.torre()}</div></div>`;
};
function refreshSheet(){
  const w=document.querySelector('.xlwrap.sheet'),sl=w?w.scrollLeft:0,st=w?w.scrollTop:0,vb=document.getElementById('vb');
  if(vb){vb.innerHTML=BODY.torre();const w2=document.querySelector('.xlwrap.sheet');if(w2){w2.scrollLeft=sl;w2.scrollTop=st;}}
}
/* Guardado automático del estatus (celda de la hoja) */
const AUTOBUSY={};
async function statusSave(id,el){
  const v=el.value,key=id+'|estatus',st=document.getElementById('ss_'+id);
  const set=(c,msg)=>{el.classList.remove('saving','saved','error');el.classList.add(c);el.title=c==='error'?msg:'';
    if(st){st.className='cst '+c;st.innerHTML=c==='saving'?'…':c==='saved'?'✓':`<button class="cretry" data-act="statusRetry" data-id="${id}" title="${esc(msg)} Toca para reintentar" aria-label="Error: ${esc(msg)}. Reintentar">⚠</button>`;}};
  if(AUTOBUSY[key]===v)return;
  let cur;try{cur=API.viaje(S.user.id,id);}catch(e){set('error',e.message);return;}
  if(String(cur.estatus||'')===v){set('saved');return;}
  AUTOBUSY[key]=v;set('saving');
  try{await API.editarViaje(S.user.id,id,{estatus:v},'');refreshSheet();const c2=document.getElementById('ss_'+id);if(c2){c2.className='cst saved';c2.textContent='✓';}}
  catch(e){set('error',e.message);}
  finally{delete AUTOBUSY[key];}
}


/* ---- Liquidaciones: tabla compacta tipo Excel ---- */
const rutaHTML=t=>{
  const r=DB.rutas.find(x=>x.id===t.rutaId);
  if(!r)return '<span class="mute">—</span>';
  if(['EN_TARIFACION','PENDIENTE_APROBACION','ACTIVA'].includes(r.estado))return `${rutaChip(r.estado)} ${esEnc()?'':esc(r.codigo)+' · '}${esc(nombreOrigen(r.origenId))} → ${esc(nombreDestino(r.destinoId))}`;
  return `${rutaChip(r.estado)} <span class="mute">${esc(r.nombre)}</span>`;
};
function liqsOf(t){try{return API.liquidaciones(S.user.id,t.id);}catch(e){return [];}}
function liqTabs(){
  const T={
    sub:{k:'sub',l:'Por liquidar',f:t=>t.estado==='ENTREGADO',d:'Viajes entregados que esperan la fotografía de liquidación.'},
    corr:{k:'corr',l:'Rechazados',f:t=>t.estado==='RECHAZADO',d:'Rechazados con comentarios. Operaciones los corrige y vuelve a liquidar; se conserva cada rechazo.'},
    rev:{k:'rev',l:'Por validar',f:t=>t.estado==='LIQUIDADO',d:'Liquidaciones enviadas, pendientes de aceptación o rechazo.'},
    apr:{k:'apr',l:'Aceptados',f:t=>LIQ_APROBADA.includes(t.estado),d:'Historial de viajes aceptados.'}
  };
  if(hp('liq_enviar')&&!hp('liq_aprobar'))return [T.sub,T.corr,T.rev,T.apr];
  if(hp('liq_aprobar')||hp('liq_devolver'))return hp('liq_enviar')?[T.rev,T.sub,T.corr,T.apr]:[{...T.rev,l:'Por revisar',d:'Revisa la evidencia: aprueba o devuelve con un comentario obligatorio.'},{...T.corr,l:'Pendientes de corrección',d:'Devueltas al responsable del proyecto; vuelven a "Por revisar" cuando las reenvíe.'},T.apr];
  return [T.sub,T.rev,T.corr,T.apr];
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
  return `<div class="mute" style="margin-bottom:8px">${rows.length} ${rows.length===1?'liquidación':'liquidaciones'}</div><div class="xlwrap"><table class="xl" style="min-width:1150px"><thead><tr>${LQ_COLS.map(c=>`<th aria-sort="${so.k===c[0]?(so.dir>0?'ascending':'descending'):'none'}"><button class="thbtn" data-act="sortL" data-k="${c[0]}">${c[1]} <span aria-hidden="true">${so.k===c[0]?(so.dir>0?'▲':'▼'):'↕'}</span></button></th>`).join('')}<th>Acciones</th></tr></thead><tbody>
  ${rows.map(t=>{
    const ls=liqsOf(t),lq=ls[ls.length-1],dec=ls.filter(x=>x.decision).pop();
    let acts=lq&&lq.evidencia?`<button class="btn sm" data-act="photoEv" data-id="${t.id}" data-ev="${lq.evidenciaId}">Ver evidencia</button> `:'';
    if(t.estado==='LIQUIDADO'&&revisor)acts+=(hp('liq_aprobar')?`<button class="btn sm ok" data-act="aprobarAsk" data-id="${t.id}">Aceptar</button> `:'')+(hp('liq_devolver')?`<button class="btn sm fix" data-act="devolverOpen" data-id="${t.id}">Rechazar</button>`:'');
    else if(['ENTREGADO','RECHAZADO'].includes(t.estado)&&hp('liq_enviar')&&mine(t))acts+=`<button class="btn sm primary" data-act="detalle" data-id="${t.id}">${t.estado==='RECHAZADO'?'Corregir y liquidar':'Liquidar'}</button>`;
    return `<tr role="button" tabindex="0" data-act="detalle" data-id="${t.id}"><td><b>#${t.id}</b></td><td>${esc(J(t).cliente)}</td><td>${esc(t.proyectoCat)}</td><td>${esc(J(t).piloto)}</td><td>${fmtDate(planD(t))}</td><td>${badge(t.estado)}</td><td>${t.enviadoEn?fmtDT(t.enviadoEn):'—'}</td>
    <td style="white-space:normal;min-width:210px">${dec?`<b>${dec.decision==='APROBADA'?'Aprobada':'Devuelta'}</b> · ${esc(dec.revisor)}<br><span class="mute">${fmtDT(dec.revisionEn)}</span>${dec.comentario?`<br><span class="mute">“${esc(dec.comentario.slice(0,70))}”</span>`:''}`:'<span class="mute">Sin revisar</span>'}</td><td style="white-space:nowrap">${acts}</td></tr>`;}).join('')}
  </tbody></table></div>`;
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

/* ---- Detalle del viaje ---- */
function uploadBlock(t){
  const d=S.draft[t.id],corr=t.estado==='PENDIENTE_CORRECCION';
  return `<div class="upzone"><span class="ico">${icon('camera',28)}</span>
    <div><b style="font-size:16px">Subir fotografía de liquidación</b><div class="mute" style="font-size:13.5px">Una sola foto. Asegúrate de que se lea y se vea la firma.${corr?' Los envíos anteriores se conservan en el historial.':''}</div></div>
    ${d?`<div class="preview"><img src="${d}" alt="Vista previa de la liquidación"></div>`:''}
    <div class="upbtns">
      <label class="btn primary" for="cam-${t.id}">${icon('camera',18)} Tomar fotografía</label>
      <label class="btn" for="gal-${t.id}">Elegir de la galería</label>
      <button class="btn ghost" data-act="sample" data-id="${t.id}">Usar foto de ejemplo</button>
    </div>
    <input class="hidden" id="cam-${t.id}" type="file" accept="image/*" capture="environment" data-photo="${t.id}">
    <input class="hidden" id="gal-${t.id}" type="file" accept="image/*" data-photo="${t.id}">
    <button class="btn primary lg" data-act="enviarLiq" data-id="${t.id}" ${d?'':'disabled'} style="width:100%;max-width:340px">${corr?'REENVIAR LIQUIDACIÓN':'ENVIAR LIQUIDACIÓN'}</button>
  </div>`;
}
function nextStep(t){
  const e=t.estado,m=mine(t),j=J(t);
  if(e==='PLANIFICADO')return hp('viajes_iniciar')&&m
    ?`<p>Completa los datos operativos obligatorios antes de enviar el viaje a ruta.</p><button class="btn primary lg" data-act="iniciarAsk" data-id="${t.id}">ENVIAR A RUTA</button>`
    :`<p>Planificado por el encargado de ${esc(j.proyectoNombre)}.</p>`;
  if(e==='EN_RUTA')return hp('viajes_finalizar')&&m
    ?`<p>Cuando completes los horarios de viaje, confirma la entrega.</p><button class="btn primary lg" data-act="finalizarAsk" data-id="${t.id}">CONFIRMAR ENTREGA</button>`
    :`<p>El viaje está en ruta. Solo el encargado asignado puede finalizarlo; Torre de Control actualiza fechas y horas, no el estado.</p>`;
  if(e==='ENTREGADO')return hp('liq_enviar')&&m?`<p>El viaje fue entregado. Adjunta la evidencia para liquidarlo.</p>${uploadBlock(t)}`:`<p>Esperando la evidencia de liquidación.</p>`;
  if(e==='RECHAZADO')return hp('liq_enviar')&&m?`<p>Rechazo #${t.rechazos||1}: ${esc(t.comentarioRevision)}. Corrige y vuelve a liquidar.</p>${uploadBlock(t)}`:`<p>Devuelto a ${esc(t.creadoPor)} para corrección.</p>`;
  if(e==='LIQUIDADO')return (hp('liq_aprobar')||hp('liq_devolver'))
    ?`<p>Revisa la evidencia y decide.</p><div style="display:flex;gap:10px;flex-wrap:wrap">${hp('liq_aprobar')?`<button class="btn ok lg" data-act="aprobarAsk" data-id="${t.id}">${icon('check',18)} APROBAR LIQUIDACIÓN</button>`:''}${hp('liq_devolver')?`<button class="btn fix lg" data-act="devolverOpen" data-id="${t.id}">REQUIERE CORRECCIÓN</button>`:''}</div>`
    :`<p>La liquidación fue enviada y está en revisión.</p>`;
  if(e==='ACEPTADO')return `<p>Viaje aceptado y disponible para facturación.</p>${hp('comercial_agrupar')?`<button class="btn primary" data-act="nav" data-v="comercial">Ir a Facturación</button>`:''}`;
  if(e==='FACTURADO')return `<p>Factura registrada${t.numeroFactura?` · ${esc(t.numeroFactura)}`:''}. Pendiente de cobro.</p>`;
  if(e==='COBRADO')return `<p>Cobro registrado. Ciclo completo.</p>`;
  return `<p>Ciclo completo.</p>`;
}
const esDuenoUI=t=>{if(!t.creadoPorId)return true;if(t.creadoPorId===S.user.id)return true;const u=DB.usuarios.find(x=>x.id===t.creadoPorId);return !u||u.rol==='ADMIN'||hp('viajes_ver_todos');};
const canEditT=t=>hp('viajes_editar_tiempos')&&mine(t)&&esDuenoUI(t)&&!['LIQUIDADO','ACEPTADO','FACTURADO','COBRADO'].includes(t.estado);
const canEditD=t=>hp('viajes_editar_datos')&&mine(t)&&esDuenoUI(t)&&DATA_EDIT_STATES.includes(t.estado);
const canEdit=t=>canEditT(t)||canEditD(t);
const editGroups=t=>['cliente','plan','estatus','unidad','ruta','tiempos','otros'].filter(g=>g==='plan'||g==='tiempos'?canEditT(t):canEditD(t));
function editView(t){
  const E=S.edit,soloT=!canEditD(t);
  return `<div class="inner form" style="max-width:860px">
    <button class="btn ghost sm" data-act="editCancel" style="margin-bottom:12px">${icon('back',16)} Cancelar edición</button>
    ${pageHead('Editar viaje #'+t.id,soloT?'Puedes actualizar la fecha plan y los horarios. El estado, el estatus y los demás datos son de solo lectura'+(esEnc()?'.':' para tu perfil.'):'Actualiza datos, fechas y horarios del viaje.')}
    ${E.data.err?`<div class="alertbox" style="margin-bottom:16px" role="alert"><b>${esc(E.data.err)}</b></div>`:''}
    ${fieldsHTML(E.data,editGroups(t),false)}
    <div class="card fsec"><h3>Motivo del cambio</h3><div class="fgroup"><label for="m_motivo">Motivo (opcional; queda en el historial junto al valor anterior)</label><textarea id="m_motivo" data-motivo="1" style="min-height:70px">${esc(E.motivo||'')}</textarea></div></div>
    <div class="formbtns"><button class="btn primary lg" data-act="editSave">GUARDAR CAMBIOS</button><button class="btn lg" data-act="editCancel">CANCELAR</button></div></div>`;
}
/* Torre de Control (y quien solo edita fechas/horas): registro de horarios con guardado automático */
const AUTO=()=>false;
function setInd(k,st,msg){
  const el=document.getElementById('sv_'+k);if(!el)return;
  el.className='sv '+st;
  el.innerHTML=st==='saving'?'Guardando…':st==='saved'?'✓ Guardado':`<span>⚠ ${esc(msg||'No se guardó')}</span> <button class="linkbtn" data-act="autoRetry" data-k="${k}" data-id="${esc(S.param)}">Reintentar</button>`;
}
function refreshDurs(id){const b=document.getElementById('durs_box');if(!b)return;try{b.innerHTML=dursHTML(API.viaje(S.user.id,id));}catch(e){}}
async function autoSave(id,k,v){
  v=String(v==null?'':v).trim();
  const key=id+'|'+k;
  if(AUTOBUSY[key]===v)return;                                   /* evita registros duplicados */
  if(k!=='estatus'&&v!==''&&!RX_DT.test(v)){S.autoFail[key]=v;setInd(k,'error','Fecha y hora no válidas.');return;}
  if(k==='fechaPlan'&&v===''){S.autoFail[key]=v;setInd(k,'error','La fecha plan no puede quedar vacía.');return;}
  let cur;try{cur=API.viaje(S.user.id,id);}catch(e){setInd(k,'error',e.message);return;}
  if(String(cur[k]||'')===v){delete S.autoFail[key];setInd(k,'saved');return;}      /* sin cambios: no se registra nada */
  AUTOBUSY[key]=v;setInd(k,'saving');
  try{
    await API.editarViaje(S.user.id,id,{[k]:v},'');                      /* sin comentario ni botón de guardar */
    delete S.autoFail[key];setInd(k,'saved');refreshDurs(id);if(k==='estatus')render();
  }catch(e){
    S.autoFail[key]=v;setInd(k,'error',e.message);               /* el valor se conserva en el campo para reintentar */
  }finally{delete AUTOBUSY[key];}
}
const estatusCard=t=>{
  if(!hp('viajes_estatus_torre')||hp('viajes_editar_datos'))return '';
  const cl=clienteDe(t);
  if(!puedeEstatusTorre(t))return `<div class="card"><h3>Estatus operativo</h3><div>${est(t)}</div><div class="mute" style="margin-top:8px;font-size:13px">${cl.torreEstatus?'Este viaje ya no admite cambios de estatus por Torre de Control.':`Para ${esc(cl.cliente||t.proyecto)} Torre de Control solo tiene consulta.`}</div></div>`;
  return `<div class="card"><h3>Estatus operativo</h3><div class="trow"><select id="a_estatus" data-auto="estatus" data-id="${t.id}" style="max-width:320px" aria-label="Estatus operativo">${estatusOpciones(t).map(o=>`<option ${o===t.estatus?'selected':''}>${esc(o)}</option>`).join('')}</select></div><span class="sv" id="sv_estatus" aria-live="polite"></span><div class="mute" style="margin-top:6px;font-size:13px">Se guarda solo al elegirlo. Solo puedes usar los estatus autorizados.</div></div>`;
};
const moneyCard=(t)=>{
  const verF=hp('finanzas_ver'),dash='<span class="mute">Sin registrar</span>';
  const tf=nn(t.tarifaCliente),cp=nn(t.costoProveedor),vi=nn(t.qViaticos);
  const falta=[tf==null?'tarifa del cliente':'',cp==null?'costo de proveedor':'',vi==null?'viáticos':''].filter(Boolean);
  let pagos=[];if(verF)try{pagos=API.pagosDeViaje(S.user.id,t.id);}catch(e){}
  const tp=tarifaPara(t),puedeAplicar=hp('tarifa_registrar')&&t.estado==='ACEPTADO'&&!t.agrupacionId;
  return `<div class="card"><h3>Importes del viaje</h3><dl class="kv">
    <dt>Tarifa del cliente</dt><dd>${tf==null?(tp.err?`<span class="warnl">⚠ Sin tarifa válida</span>`:dash):qfmt(tf)}${t.tarifaId?` <span class="mute" style="font-weight:500">· ${esc(t.tarifaId)}</span>`:''} ${puedeAplicar&&!tp.err&&String(tf)!==String(tp.t.importe)?`<button class="btn sm primary" data-act="aplicarTarifaViaje" data-id="${t.id}">Aplicar tarifa vigente</button>`:''}</dd>
    ${tf==null&&tp.err&&hp('comercial_ver')?`<dt>Revisión</dt><dd class="mute" style="font-weight:500">${esc(tp.err)}</dd>`:''}
    ${verF?`<dt>Costo proveedor (${esc(t.opl||'sin OPL')})</dt><dd>${cp==null?dash:qfmt(cp)} ${hp('costos_registrar')&&FIN.includes(t.estado)?`<button class="btn sm" data-act="importeOpen" data-id="${t.id}" data-k="costoProveedor">${cp==null?'Registrar':'Cambiar'}</button>`:''}</dd>
    <dt>Viáticos del piloto</dt><dd>${vi==null?dash:qfmt(vi)}</dd>
    <dt>Margen estimado</dt><dd>${falta.length?`<span class="mute">No calculable · falta: ${falta.join(', ')}</span>`:`<b>${qfmt(tf-cp-vi)}</b>`}</dd>`:''}</dl>
    ${verF&&pagos.length?`<h3 style="margin:12px 0 6px;font-size:14px">Pagos registrados</h3><div class="tablewrap scrollx"><table style="font-size:13px"><thead><tr><th>Pago</th><th>Tipo</th><th>Monto</th><th>Fecha</th><th>Referencia</th><th></th></tr></thead><tbody>${pagos.map(p=>`<tr class="${p.anulado?'dim':''}"><td>${p.id}</td><td>${p.tipo==='PROVEEDOR'?'Proveedor':'Piloto'}</td><td>${qfmt(p.monto)}</td><td>${fmtDate(p.fecha)}</td><td>${esc(p.referencia)}</td><td>${p.anulado?'<span class="mute">Anulado</span>':(hp('pagos_registrar')?`<button class="btn sm fix" data-act="anularPagoOpen" data-id="${p.id}">Anular</button>`:'')}</td></tr>`).join('')}</tbody></table></div>`:''}</div>`;
};
VIEWS.detalle=()=>{
  let t;try{t=API.viaje(S.user.id,S.param);}catch(e){return `<div class="inner">${empty('Viaje no disponible','No existe o no tienes acceso a este viaje.')}</div>`;}
  if(S.edit&&S.edit.id===t.id)return editView(t);
  const j=J(t),f=j.f,fromLbl=S.from&&NAVLBL[S.from.view]?NAVLBL[S.from.view][0]:'Volver';
  const dash='<span class="mute" style="font-weight:500">—</span>',v=x=>x!==''&&x!=null?esc(x):dash;
  const kvr=(k,x)=>`<dt>${k}</dt><dd>${x}</dd>`;
  const tr=(l,por,en)=>`<dt>${l}</dt><dd>${por?`${esc(por)} <span class="mute" style="font-weight:500">· ${fmtDT(en)}</span>`:dash}</dd>`;
  const rev=(hp('liq_aprobar')||hp('liq_devolver'))&&!hp('viajes_editar_tiempos');   /* revisor de liquidaciones */
  const auto=false;
  const sinHist=hp('comercial_ver')&&!hp('historial_ver');                               /* Comercial: sin trazabilidad interna */
  const verLiq=hp('liq_ver')||hp('liq_enviar');
  const editBtn=!auto&&canEdit(t)?`<button class="btn primary" data-act="editar" data-id="${t.id}">${icon('clock',18)} Editar viaje y horarios</button>`:'';
  const ls=verLiq?liqsOf(t):[];
  let hist=null;try{hist=API.historial(S.user.id,t.id);}catch(e){}
  if(hist&&rev)hist=hist.filter(e=>!TIEMPO_KEYS.some(k=>LBL[k]===e.campo)&&e.accion!=='Dato actualizado (automático)');
  let agrs=[];if(hp('comercial_ver')){try{agrs=API.agrupaciones(S.user.id).filter(g=>g.viajeIds.includes(t.id));}catch(e){}}
  const liqHTML=ls.length?ls.slice().reverse().map(l=>`<div class="cyc"><div class="tc-top"><b>Envío ${l.ciclo}</b><span class="badge ${l.decision==='APROBADA'?'st-APROBADA':l.decision==='DEVUELTA'?'st-PENDIENTE_CORRECCION':'st-EN_REVISION'}">${l.decision==='APROBADA'?'Aprobada':l.decision==='DEVUELTA'?'Devuelta':'En revisión'}</span></div>
      <div class="cycb">${l.evidencia?`<button class="thumb" style="width:92px;min-height:110px" data-act="photoEv" data-id="${t.id}" data-ev="${l.evidenciaId}" aria-label="Ampliar evidencia"><img src="${l.evidencia}" alt="Evidencia del envío ${l.ciclo}"></button>`:''}
      <div class="mute" style="font-size:13px">Enviada por ${esc(l.envioPor)} · ${fmtDT(l.envioEn)}${l.decision?`<br>${l.decision==='APROBADA'?'Aprobada':'Devuelta'} por ${esc(l.revisor)} · ${fmtDT(l.revisionEn)}`:''}${l.comentario?`<div class="alertbox" style="margin-top:6px;color:var(--ink)"><b>Comentario:</b> ${esc(l.comentario)}</div>`:''}</div></div></div>`).join(''):`<div class="empty" style="padding:22px">Todavía no hay envíos de liquidación.</div>`;
  const inicio=t.tSalida||t.iniciadoEn,fin=t.tFinDescarga||t.finalizadoEn;
  const datos=rev
    ?`${kvr('ID de viaje','<span class="num">#'+t.id+'</span>')}${kvr('No. de viaje',v(t.noViaje))}${kvr('Cliente',esc(j.cliente))}${kvr('Proyecto',v(t.proyectoCat))}${kvr('Producto',v(t.producto))}${kvr('Fecha plan',fmtL(t.fechaPlan))}${kvr('Inicio del viaje',inicio?fmtL(inicio.length>16?toLocal(new Date(inicio)):inicio):dash)}${kvr('Finalización del viaje',fin?fmtL(fin.length>16?toLocal(new Date(fin)):fin):dash)}`
    :`${kvr('ID de viaje','<span class="num">#'+t.id+'</span>')}${kvr('No. de viaje',v(t.noViaje))}${kvr('Cliente',esc(j.cliente))}${kvr('Proyecto',v(t.proyectoCat))}${kvr('Shipment',v(t.shipment))}
        ${kvr('Tipo de viaje',v(t.tipoViaje))}${kvr('Tipo de carga',v(t.tipoCarga))}${kvr('No. de carga',v(t.noCarga))}${kvr('Producto',v(t.producto))}${kvr('OPL',v(t.opl))}
        ${kvr('Ruta',rutaHTML(t))}${kvr('Fecha plan',fmtL(t.fechaPlan))}${kvr('Estatus',t.estatus?est(t):dash)}${kvr('Estado del proceso',badge(t.estado))}
        ${t.estado==='EN_CURSO'?kvr('Tiempo transcurrido',`<span class="elapsed" data-since="${since(t)}">${elapsed(since(t))}</span>`):''}
        ${kvr('No. doc retorno',v(t.noDocRetorno))}${'qViaticos' in t?kvr('Q viáticos',t.qViaticos!==''&&t.qViaticos!=null?'Q '+esc(t.qViaticos):dash):''}`;
  const horarios=rev?'':`<div class="card" style="grid-column:1/-1"><h3>Horarios del viaje</h3>
        <dl class="kv" style="grid-template-columns:repeat(2,minmax(0,170px) minmax(0,1fr));gap:8px 14px">${CAMPOS_TIEMPO.map(([k,l])=>kvr(lblT(l),t[k]?fmtL(t[k]):dash)).join('')}</dl>
        ${hp('comercial_agrupar')?'<div class="mute" style="margin-top:8px;font-size:13px">Datos del viaje: solo lectura para tu perfil.</div>':`<h3 style="margin:14px 0 0;font-size:14px">Tiempos calculados</h3><div id="durs_box">${dursHTML(t)}</div>`}</div>`;
  return `<div class="inner">
    <button class="btn ghost sm" data-act="back" style="margin-bottom:12px">${icon('back',16)} ${esc(fromLbl)}</button>
    ${pageHead('Viaje #'+t.id,`<span class="pchip sm">${esc(j.proyectoNombre)}</span> &nbsp;${esc(j.cliente)}`,`<span class="bgs">${badge(t.estado)}${rev?'':est(t)}</span>${editBtn}`)}
    ${t.estado==='RECHAZADO'?`<div class="alertbox" style="margin-bottom:14px;padding:14px 16px"><b>Rechazo #${t.rechazos||1}</b><div style="margin:6px 0;font-size:16px">${esc(t.comentarioRevision)}</div><span class="mute" style="font-size:13px">${esc(t.revisadoPor)} · ${fmtDT(t.revisadoEn)}</span></div>`:''}
    <div class="hroute"><div class="pt"><small>Origen</small><b>${esc(j.origen)||'Pendiente de asignar'}</b></div><div class="line"></div><div class="pt"><small>Destino</small><b>${esc(j.destino)||'Pendiente de asignar'}</b></div></div>
    <div class="card next"><h3>Siguiente paso</h3>${nextStep(t)}</div>
    <div class="detgrid">
      <div class="card"><h3>Datos del viaje</h3><dl class="kv">${datos}</dl></div>
      <div class="card"><h3>Piloto y unidad</h3><dl class="kv">
        ${kvr('Piloto',esc(j.piloto)+' '+src('PILOTOS'))}${kvr('Unidad',esc(f.unidad)+' '+src('PILOTOS'))}${kvr('Placa',esc(f.placa)+' '+src('FLOTA'))}${rev?'':kvr('Tango',esc(f.tango)+' '+src('FLOTA'))}${rev?'':kvr('Tipo de unidad',esc(f.tipo)+' '+src('FLOTA'))}${kvr('Capacidad',esc(f.capacidad)+' '+src('FLOTA'))}</dl></div>
      ${horarios}
      ${estatusCard(t)}
      ${hp('comercial_ver')||hp('finanzas_ver')?moneyCard(t):''}
      ${verLiq?`<div class="card" style="grid-column:1/-1"><h3>Liquidación · historial de envíos</h3>${liqHTML}</div>`:''}
       ${hp('comercial_ver')&&(agrs.length||t.estado==='ACEPTADO')?`<div class="card" style="grid-column:1/-1"><h3>Facturación</h3>${agrs.length?`<div class="tablewrap scrollx"><table><thead><tr><th>ID de agrupación</th><th>Estado</th><th>N° de factura</th><th>Viajes asociados</th><th>Creada por</th></tr></thead><tbody>${agrs.map(g=>`<tr><td><b>${g.id}</b></td><td>${g.estado==='ACTIVA'?`<span class="badge st-FACTURADO">${ETAPA_L[etapaAgr(g)]}</span>`:'<span class="badge st-RECHAZADO">Anulada</span>'}</td><td>${g.numeroFactura?esc(g.numeroFactura):'<span class="mute">pendiente</span>'}</td><td>${g.viajeIds.map(i=>'#'+i).join(', ')}</td><td>${esc(g.creadoPor)} · ${fmtDT(g.creadoEn)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="mute">Aún sin factura preparada.</div>'}</div>`:''}
      ${sinHist?'':`<div class="card" style="grid-column:1/-1"><h3>${rev?'Decisiones e historial':'Trazabilidad e historial'}</h3>${rev?'':`<dl class="kv">${tr('Creó',t.creadoPor,t.creadoEn)}${tr('Inició',t.iniciadoPor,t.iniciadoEn)}${tr('Finalizó',t.finalizadoPor,t.finalizadoEn)}${tr('Envió liquidación',t.enviadoPor,t.enviadoEn)}${tr('Revisó',t.revisadoPor,t.revisadoEn)}${tr('Aprobó',t.aprobadoPor,t.aprobadoEn)}${t.editadoPor?tr('Última edición',t.editadoPor,t.editadoEn):''}</dl>`}
        ${hist?`<details style="margin-top:12px" ${rev?'':'open'}><summary>Historial (${hist.length} eventos)</summary><div style="margin-top:10px">${histHTML(hist)}</div></details>`:'<div class="mute" style="margin-top:10px">'+(esEnc()?'No tienes':'Tu perfil no tiene')+' acceso al historial completo.</div>'}</div>`}
    </div></div>`;
};

/* ---- Resumen global / tablero gerencial ---- */
VIEWS.resumen=()=>{
  const all=vis(),cli=S.fProy,base=cli?all.filter(t=>t.proyecto===cli):all,ger=S.user.rol==='GERENCIA';
  let ags=[];if(hp('comercial_ver'))try{ags=API.agrupaciones(S.user.id).filter(g=>g.estado==='ACTIVA'&&(!cli||g.cliente===cli));}catch(e){}
  const kp=(n,l,c,e)=>`<button class="kpi" data-act="kpi" data-v="${e}"><span class="n">${n}</span><span class="l">${c?`<i class="dot" style="background:var(${c})"></i>`:''}${l}</span></button>`;
  const chips=comboHTML('fProy',cli,[{id:'',nombre:'Todos los clientes'},...PROYECTOS.map(p=>({id:p.id,nombre:p.nombre}))]);
  let feed=[];if(hp('historial_ver'))try{feed=API.actividad(S.user.id,8);}catch(e){}
  return `<div class="inner">${pageHead(ger?'Tablero gerencial':'Resumen general',ger?'Consulta global de todos los proyectos, con su recorrido completo':'Vista global de todos los proyectos')}
    ${chips}
    <div class="grid g4">
      ${kp(base.length,'Total de viajes','','')}${kp(cnt(base,t=>t.estado==='PENDIENTE'),'Pendientes','--pend','PENDIENTE')}${kp(cnt(base,t=>t.estado==='EN_CURSO'),'En curso','--cur','EN_CURSO')}${kp(cnt(base,t=>FIN.includes(t.estado)),'Finalizados','--ok','FIN')}
      ${kp(cnt(base,t=>t.estado==='PENDIENTE_LIQUIDACION'),'Liquidaciones pendientes','--warn','PENDIENTE_LIQUIDACION')}${kp(cnt(base,t=>t.estado==='EN_REVISION'),'Liquidaciones en revisión','--rev','EN_REVISION')}${kp(cnt(base,t=>t.estado==='PENDIENTE_CORRECCION'),'Liquidaciones por corregir','--fix','PENDIENTE_CORRECCION')}${kp(cnt(base,t=>LIQ_APROBADA.includes(t.estado)),'Liquidaciones aprobadas','--ok','APROBADAS')}
      ${kp(cnt(base,t=>t.estado==='PENDIENTE_COMERCIAL'),'Pendientes de Comercial','--com','PENDIENTE_COMERCIAL')}${kp(cnt(base,t=>t.estado==='COMERCIAL_REGISTRADA'),'Gestión comercial registrada','--ok','COMERCIAL_REGISTRADA')}
      <div class="kpi"><span class="n">${ags.length}</span><span class="l"><i class="dot" style="background:var(--com)"></i>Agrupaciones activas</span></div>
      <div class="kpi"><span class="n">${ags.filter(g=>g.numeroFactura).length}</span><span class="l"><i class="dot" style="background:var(--ok)"></i>Facturas registradas</span></div>
    </div>
    <section class="section"><h2>Proyectos</h2><div class="cards">${PROYECTOS.filter(p=>!cli||p.id===cli).map(p=>{const pt=all.filter(t=>t.proyecto===p.id);return `<button class="pcard" data-act="proj" data-id="${p.id}"><div class="tc-top"><span class="pchip">${esc(p.nombre)}</span><span class="num">${pt.length} viajes</span></div>${statBar(pt)}</button>`;}).join('')}</div></section>
    ${feed.length?`<section class="section"><h2>Actividad reciente</h2><div class="card"><ul class="feed">${feed.map(x=>`<li><span class="avatar" style="width:30px;height:30px;font-size:12px">${initials(x.por)}</span><div><b>${esc(x.por)}</b> · ${esc(x.accion)}${x.campo&&x.nuevo?` <span class="mute">(${esc(x.campo)}: ${esc(x.nuevo)})</span>`:''}<br><span class="mute">${x.viajeId?'Viaje #'+x.viajeId+' · ':''}${esc(rolL(x.rol))}${x.motivo?' · “'+esc(x.motivo.slice(0,70))+'”':''}</span></div><span class="when">${ago(x.en)}</span></li>`).join('')}</ul></div></section>`:''}</div>`;
};
const clientePend=c=>[!c.nit?'identificador fiscal':'',!c.direccionFiscal?'dirección fiscal':'',!c.correoFacturacion?'correo de facturación':''].filter(Boolean);
VIEWS.proyectos=()=>{
  if(esAdm())return clientesAdminHTML();
  const all=vis(),gest=hp('clientes_gestionar');
  return `<div class="inner" style="max-width:1300px">${pageHead('Clientes','Selecciona un cliente para ver sus viajes',gest?`<button class="btn primary" data-act="clienteOpen" data-id="">${icon('plus',18)} Nuevo cliente</button>`:'')}
    <div class="cards">${PROYECTOS.map(p=>{const c=DB.clientes.find(x=>x.id===p.id)||{},pt=all.filter(t=>t.proyecto===p.id);return `<button class="pcard" data-act="proj" data-id="${p.id}"><div class="tc-top"><span class="pchip">${esc(p.nombre)}</span><span class="num">${pt.length} viajes</span></div><div class="bgs">${chip(c.activo===false?'neutral':'done',c.activo===false?'Inactivo':'Activo')}${clientePend(c).length?`<span class="warnl">⚠ Datos fiscales pendientes</span>`:''}</div><div class="mute">${esc(p.cliente)} · Encargado: ${esc(p.encargado)}</div><div class="mute" style="font-size:13px">Proyectos: ${esc((PROYECTOS_X[p.id]||[]).join(', '))}</div>${statBar(pt)}</button>`;}).join('')}</div>
    ${gest?`<section class="section"><h2>Datos de los clientes</h2><div class="xlwrap" style="max-height:none"><table class="xl" style="min-width:1100px"><thead><tr><th>Código</th><th>Cliente</th><th>Nombre</th><th>Identificador fiscal</th><th>Datos de facturación</th><th>Proyectos</th><th>Estado</th><th>Creado</th><th>Acciones</th></tr></thead><tbody>
      ${DB.clientes.map(c=>`<tr class="${c.activo===false?'dim':''}"><td><b>${esc(c.id)}</b></td><td>${esc(c.cliente)}</td><td>${esc(c.nombre)}</td><td>${c.nit?esc(c.nit):'<span class="warnl">Pendiente</span>'}</td><td style="white-space:normal;min-width:200px">${clientePend(c).length?`<span class="warnl">Pendiente: ${clientePend(c).join(', ')}</span>`:'<span class="mute">Completos</span>'}</td><td style="white-space:normal;min-width:160px">${esc(c.proyectos.join(', '))}</td><td>${chip(c.activo===false?'neutral':'done',c.activo===false?'Inactivo':'Activo')}</td><td>${esc(c.creadoPor||'—')}<br><span class="mute">${c.creadoEn?fmtDT(c.creadoEn):''}</span></td><td style="white-space:nowrap"><button class="btn sm" data-act="clienteOpen" data-id="${c.id}">Editar</button> <button class="btn sm ${c.activo===false?'ok':'fix'}" data-act="clienteEstado" data-id="${c.id}">${c.activo===false?'Activar':'Desactivar'}</button></td></tr>`).join('')}
      </tbody></table></div></section>
    <section class="section"><h2>Torre de Control</h2><div class="mute" style="margin:-6px 0 10px;font-size:13px">Torre solo puede cambiar el estatus operativo, y solo de los clientes marcados. Los estatus que implican cierre, cancelación o liquidación nunca se delegan.</div>
      <div class="grid g2"><div class="card"><h3>Clientes cuyo estatus puede actualizar</h3>${DB.clientes.map(c=>`<label style="display:flex;gap:10px;align-items:center;min-height:36px"><input type="checkbox" data-torre="${c.id}" ${c.torreEstatus?'checked':''}> <b>${esc(c.nombre)}</b></label>`).join('')}</div>
      <div class="card"><h3>Estatus que puede asignar</h3><div class="bgs">${CAT.estatus.map(e=>{const veda=ESTATUS_VEDADOS.includes(e);return `<label class="chip" style="display:flex;gap:6px;align-items:center;${veda?'opacity:.5':''}"><input type="checkbox" data-torreop="${esc(e)}" ${DB.config.torreEstatus.includes(e)?'checked':''} ${veda?'disabled title="No se delega a Torre de Control"':''}> ${esc(e)}</label>`;}).join('')}</div></div></div></section>`:''}</div>`;
};
VIEWS.proyecto=()=>{
  const p=PROYECTOS.find(x=>x.id===S.param);if(!p)return empty('Proyecto no encontrado');
  const pt=vis().filter(t=>t.proyecto===p.id),list=pt.filter(t=>matchEst(t,S.fEstado));
  return `<div class="inner"><button class="btn ghost sm" data-act="nav" data-v="${hp('tablero_ver')?'proyectos':ROLES[S.user.rol].home}" style="margin-bottom:12px">${icon('back',16)} Proyectos</button>
    ${pageHead(esc(p.nombre),`${esc(p.cliente)} · Encargado: ${esc(p.encargado)}`)}<div class="card" style="margin-bottom:16px">${statBar(pt)}</div>${estadoChips()}${tableHTML(list)}</div>`;
};
function estadoChips(){
  const opts=[{id:'',nombre:'Todos'},{id:'PLANIFICADO',nombre:'Planificados'},{id:'EN_RUTA',nombre:'En ruta'},{id:'ENTREGADO',nombre:'Entregados'},{id:'LIQUIDADO',nombre:'Liquidados'},{id:'ACEPTADO',nombre:'Aceptados'},{id:'RECHAZADO',nombre:'Rechazados'},{id:'FACTURADO',nombre:'Facturados'},{id:'COBRADO',nombre:'Cobrados'}];
  return comboHTML('fEstado',S.fEstado,opts,'Todos los estados');
}
const matchEst=(t,f)=>!f||(f==='FIN'?FIN.includes(t.estado):f==='APROBADAS'?LIQ_APROBADA.includes(t.estado):t.estado===f);
function todosList(){
  const q=S.q.trim().toLowerCase();
  return vis().filter(t=>matchEst(t,S.fEstado)&&(!S.fProy||t.proyecto===S.fProy)&&(!q||(t.id+' '+(J(t).piloto||'')+' '+(J(t).destino||'')+' '+(J(t).f.placa||'')+' '+(t.numeroFactura||'')+' '+(t.agrupacionId||'')).toLowerCase().includes(q)));
}
BODY.todos=()=>tableHTML(todosList());
VIEWS.todos=()=>`<div class="inner">${pageHead('Todos los viajes','Sin filtro de proyecto: '+vis().length+' viajes visibles para tu perfil')}
  <div class="row2" style="margin-bottom:12px"><input type="text" id="q" placeholder="Buscar por n.º de viaje, piloto, placa, destino o factura" value="${esc(S.q)}" aria-label="Buscar viajes"><select data-flt="fProy" aria-label="Filtrar por cliente"><option value="">Todos los clientes</option>${PROYECTOS.map(p=>`<option value="${p.id}" ${S.fProy===p.id?'selected':''}>${esc(p.nombre)}</option>`).join('')}</select></div>
  ${estadoChips()}<div id="vb">${BODY.todos()}</div></div>`;



function fleTabla(h,rows){return `<div class="tablewrap scrollx"><table><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;}
function flePanel(){
  const d=S.fle;
  const head=`<div class="row" style="align-items:center;gap:10px;margin:0 0 10px;flex-wrap:wrap"><b>Flota · Fleetio</b><span class="spacer"></span>
    <button class="btn sm" data-act="fleLoad" ${d&&d.cargando?'disabled':''}>${d&&d.cargando?'Cargando…':'Consultar'}</button>
    ${BACKEND.modo==='supabase'&&hp('catalogos_ver')?`<button class="btn sm primary" data-act="fleSync" ${d&&d.cargando?'disabled':''}>Sincronizar con Fleetio</button>`:''}</div>`;
  const nota=BACKEND.modo==='supabase'?'':'<div class="alertbox info">Estás en modo demostración: la sincronización con Fleetio requiere Supabase configurado.</div>';
  if(!d)return `${nota}${head}<div class="mute">Pulsa «Consultar» para ver los mantenimientos y gastos traídos de Fleetio.</div>`;
  if(d.err)return `${nota}${head}<div class="alertbox warn">${esc(d.err)}</div>`;
  const fch=v=>esc(String(v||'').slice(0,10));
  const tm=d.mant.length?fleTabla(['Fecha','Unidad','Referencia','Estado','Proveedor','Mano de obra','Repuestos','Total','Notas'],
      d.mant.map(m=>[fch(m.fecha),esc(m.unidad),esc(m.referencia),esc(m.estado),esc(m.proveedor),m.mano_obra!=null?qfmt(m.mano_obra):'—',m.repuestos!=null?qfmt(m.repuestos):'—',m.total!=null?qfmt(m.total):'—',esc(m.notas)])):'<div class="mute">Sin mantenimientos.</div>';
  const tg=d.gast.length?fleTabla(['Fecha','Unidad','Tipo','Proveedor','Monto','Notas'],
      d.gast.map(g=>[fch(g.fecha),esc(g.unidad),esc(g.tipo),esc(g.proveedor),g.monto!=null?qfmt(g.monto):'—',esc(g.notas)])):'<div class="mute">Sin gastos.</div>';
  return `${nota}${head}<div class="mute small" style="margin-bottom:10px">Mantenimientos: <b>${d.mant.length}</b> · Gastos: <b>${d.gast.length}</b></div>
    <h3>Mantenimientos <span class="mute" style="font-weight:500">· servicio</span></h3>${tm}
    <h3 style="margin:18px 0 8px">Gastos <span class="mute" style="font-weight:500">· egresos por unidad</span></h3>${tg}`;
}
VIEWS.catalogos=()=>{
  const k0=S.tab.cat||'pil',verFle=hp('catalogos_ver')||hp('finanzas_ver'),k=(k0==='fle'&&!verFle)?'pil':k0;
  const T=[{k:'pil',l:'PILOTOS',f:()=>true},{k:'flo',l:'FLOTA',f:()=>true},{k:'ori',l:'ORIGEN',f:()=>true},{k:'des',l:'DESTINOS',f:()=>true},{k:'cat',l:'CATALOGO (listas)',f:()=>true},...(verFle?[{k:'fle',l:'FLEETIO',f:()=>true}]:[])];
  const tb=(h,rows)=>`<div class="tablewrap scrollx"><table><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const pn=id=>esc((PROYECTOS.find(p=>p.id===id)||{}).nombre||id);
  const body={
    pil:tb(['Id','Piloto','Unidad asignada','Proyecto'],PILOTOS.map(p=>[p.id,esc(p.nombre),p.unidad?esc(p.unidad):'<span class="mute">Sin unidad</span>',pn(p.proyecto)])),
    flo:tb(['Unidad','Placa','Tango','Capacidad','Tipo'],FLOTA.map(f=>[esc(f.unidad),esc(f.placa),esc(f.tango),esc(f.capacidad),esc(f.tipo)])),
    ori:tb(['Origen'],ORIGENES.map(o=>[esc(o.nombre)])),
    cat:`<div class="grid g2">${Object.entries({'CLIENTES':CAT.clientes,'PROYECTOS':CAT.proyectos,'TIPO DE UNIDAD':CAT.tipoUnidad,'OPL':CAT.opl,'TIPO CARGA':CAT.tipoCarga,'TIPO DE VIAJE':CAT.tipoViaje,'ESTATUS':CAT.estatus}).map(([n,a])=>`<div class="card"><h3>${n} <span class="mute" style="font-weight:500">· ${a.length}</span></h3><div class="bgs">${a.map(x=>`<span class="est">${esc(x)}</span>`).join('')}</div></div>`).join('')}</div>`,
    des:tb(['Id','Destino','Proyecto'],DESTINOS.map(d=>[d.id,esc(d.nombre),pn(d.proyecto)])),fle:flePanel()}[k];
  return `<div class="inner">${pageHead('Catálogos','Datos maestros que la aplicación consulta; no se editan ni se duplican aquí')}${tabs('cat',T,k,null).replace(/<span class="c">0<\/span>/g,'')}<div style="height:14px"></div>${body}
    <div class="alertbox info" style="margin-top:14px"><b>Nota:</b> PILOTOS, FLOTA y DESTINOS son ficticios (todavía no tengo esos archivos); las listas de CATALOGO y ORIGEN sí son las reales de tu hoja. En Power Apps cada catálogo se leerá directo de su hoja (Excel/SharePoint) y el filtro por proyecto asume una columna Proyecto en PILOTOS, ORIGEN y DESTINOS.</div></div>`;
};

/* ---- Comercial ---- */
const COMTABS=[{k:'bandeja',l:'Pendientes de gestión'},{k:'fact',l:'Facturas'},{k:'hist',l:'Facturación'},{k:'tar',l:'Tarifas'},{k:'reg',l:'Registros anteriores'}];
const comTrips=()=>vis().filter(t=>['ACEPTADO','FACTURADO','COBRADO'].includes(t.estado));
const qfmt=v=>v===''||v==null?'—':'Q '+Number(v).toLocaleString('es-GT',{minimumFractionDigits:2,maximumFractionDigits:2});
const sinReg='<span class="mute">Sin registrar</span>';
function agrMap(){let a=[];try{a=API.agrupaciones(S.user.id);}catch(e){}const m={};a.forEach(g=>{m[g.id]=g;});return m;}
function comFiltered(){
  const q=S.q.trim().toLowerCase();
  return comTrips().filter(t=>(!S.fCli||t.proyecto===S.fCli)&&(!S.fPcat||t.proyectoCat===S.fPcat)&&(S.fCom===''||(S.fCom==='PEND'?t.estado==='ACEPTADO':t.estado==='FACTURADO'))
    &&(!q||(t.id+' '+(t.noViaje||'')+' '+(J(t).piloto||'')+' '+(J(t).f.placa||'')+' '+(J(t).origen||'')+' '+(J(t).destino||'')+' '+(t.numeroFactura||'')+' '+(t.agrupacionId||'')).toLowerCase().includes(q))).sort((a,b)=>a.id.localeCompare(b.id));
}
const etapaCls={PREPARADA:'neutral',ENVIADO_A_FACTURAR:'progress',FACTURADO:'progress',COBRO_PARCIAL:'progress',COBRADO:'done',ANULADA:'alert'};
const etapaBadge=e=>chip(etapaCls[e],ETAPA_L[e]);
function tarifaCelda(t,pend){
  if(nn(t.tarifaCliente)!=null)return qfmt(t.tarifaCliente);
  const r=tarifaPara(t);
  return r.err?`<span class="warnl" title="${esc(r.err)}">⚠ Sin tarifa válida</span>`:`<span class="warnl" title="Hay una tarifa vigente sin aplicar">Tarifa por aplicar</span> ${hp('tarifa_registrar')&&pend&&!t.agrupacionId?`<button class="ib" data-act="aplicarTarifaViaje" data-id="${t.id}" title="Aplicar tarifa vigente" aria-label="Aplicar tarifa vigente al viaje ${t.id}">${icon('check',14)}</button>`:''}`;
}
BODY.comercial=()=>{
  const canAct=hp('comercial_agrupar'),rows=comFiltered(),AG=agrMap();
  const el=comTrips().filter(t=>t.estado==='ACEPTADO'&&!t.agrupacionId);
  S.sel=S.sel.filter(id=>el.some(t=>t.id===id));
  const selT=S.sel.map(id=>el.find(t=>t.id===id)),cli0=selT[0]&&selT[0].proyecto;
  const conT=selT.filter(t=>nn(t.tarifaCliente)!=null),tot=conT.reduce((a,t)=>a+Number(t.tarifaCliente),0);
  const sinTar=comTrips().filter(t=>t.estado==='ACEPTADO'&&!t.agrupacionId&&nn(t.tarifaCliente)==null).length;
  const bar=canAct?`<div class="selbar"><b>${selT.length} ${selT.length===1?'viaje seleccionado':'viajes seleccionados'}</b><span>${cli0?'· Cliente: <b>'+esc((PROYECTOS.find(p=>p.id===cli0)||{}).cliente)+'</b>':'· Selecciona uno o varios viajes del mismo cliente'}</span>${selT.length?`<span>· ${selT.length===1?'Factura individual (no hace falta agrupar)':'Factura de viajes agrupados'} · Tarifa: <b>${qfmt(tot)}</b>${selT.length>conT.length?` <span class="warnl">(${selT.length-conT.length} sin tarifa)</span>`:''}</span>`:''}<span class="spacer"></span>${hp('tarifa_registrar')?`<button class="btn sm" data-act="aplicarTarifasTodas">Aplicar tarifas vigentes${sinTar?` (${sinTar} sin tarifa)`:''}</button>`:''}<button class="btn sm ghost" data-act="selClear" ${selT.length?'':'disabled'}>Limpiar</button><button class="btn primary" data-act="facturaOpen" ${selT.length?'':'disabled'}>FACTURAR</button></div>`:'';
  const pendRows=rows.filter(t=>t.estado==='ACEPTADO'&&!t.agrupacionId);
  const allSel=canAct&&pendRows.length&&pendRows.every(t=>S.sel.includes(t.id));
  const tbl=rows.length?`<div class="xlwrap"><table class="xl" style="min-width:1700px"><thead><tr><th>${canAct?`<input type="checkbox" data-selall="1" ${allSel?'checked':''} aria-label="Seleccionar todos los pendientes visibles">`:''}</th><th>Cliente</th><th>Proyecto</th><th>Fecha plan</th><th>ID viaje</th><th>No. viaje</th><th>Piloto</th><th>Unidad · placa</th><th>Capacidad</th><th>Ruta</th><th>Salida</th><th>Fin descarga</th><th>Tarifa cliente</th><th>Estado comercial</th><th>Factura</th><th>No. factura</th></tr></thead><tbody>
    ${rows.map(t=>{const j=J(t),pend=t.estado==='ACEPTADO',res=!!t.agrupacionId,g=AG[t.agrupacionId],chk=S.sel.includes(t.id),bloq=cli0&&t.proyecto!==cli0,libre=pend&&!res;
      return `<tr class="${chk?'sel':''} ${libre?'':'dim'}"><td>${canAct&&libre?`<input type="checkbox" data-sel="${t.id}" ${chk?'checked':''} ${bloq?'disabled title="Solo puedes facturar viajes de un mismo cliente"':''} aria-label="Seleccionar viaje ${t.id}">`:''}</td>
      <td>${esc(j.cliente)}</td><td>${esc(t.proyectoCat)}</td><td>${fmtL(t.fechaPlan)}</td><td><button class="linkbtn" data-act="detalle" data-id="${t.id}">#${t.id}</button></td><td>${esc(t.noViaje||'—')}</td><td>${esc(j.piloto)}</td><td>${esc(j.f.unidad)} · ${esc(j.f.placa)}</td><td>${esc(j.f.capacidad||'—')}</td><td style="white-space:normal;min-width:220px">${rutaHTML(t)}</td><td>${t.tSalida?fmtL(t.tSalida):'—'}</td><td>${t.tFinDescarga?fmtL(t.tFinDescarga):'—'}</td>
      <td style="text-align:right">${tarifaCelda(t,pend)}</td>
      <td>${g?etapaBadge(etapaAgr(g)):chip('neutral','Pendiente')}</td><td>${g?(g.modalidad==='AGRUPADA'?`<b>${g.id}</b> · agrupada`:`${g.id} · individual`):'—'}</td><td>${t.numeroFactura?esc(t.numeroFactura):'—'}</td></tr>`;}).join('')}
    </tbody></table></div>`:empty('No hay viajes con estos filtros','Solo aparecen viajes con la liquidación aprobada.');
  return bar+tbl;
};
function agrTable(list,acts){
  if(!list.length)return empty('Sin facturas','Cuando se prepare una factura aparecerá aquí.');
  const vig=list.filter(g=>g.estado==='ACTIVA'&&g.fase!=='PREPARADA');
  const sum=fn=>r2(vig.reduce((s,g)=>s+(fn(g)||0),0));
  const emi=vig.filter(g=>g.fase==='EMITIDA'&&nn(g.importeFacturado)!=null);
  return `<div class="xlwrap"><table class="xl" style="min-width:1750px"><thead><tr><th>ID</th><th>Modalidad</th><th>Cliente</th><th>Viajes</th><th>N.º factura</th><th>Fecha factura</th><th>Enviado a facturar</th><th>Enviada por · fecha</th><th>Emitida (evidencia)</th><th>Facturado</th><th>Cobrado</th><th>Saldo por cobrar</th><th>Estado</th><th>Detalle</th>${acts?'<th>Acciones</th>':''}</tr></thead><tbody>
  ${list.map(g=>{const et=etapaAgr(g),cob=cobradoDe(g),fa=g.fase==='EMITIDA'?nn(g.importeFacturado):null,okA=g.estado==='ACTIVA';
  const B=(a,l,c)=>`<button class="btn sm ${c||''}" data-act="${a}" data-id="${g.id}">${l}</button> `;
  let ac=B('agrDetalle','Ver viajes','ghost');
  if(okA){
    if(g.fase==='PREPARADA'&&hp('comercial_agrupar'))ac+=B('facturaEditar','Completar / enviar','primary');
    if(g.fase==='ENVIADA'&&hp('facturas_emitir'))ac+=B('emitirOpen','Marcar emitida','primary');
    if(g.fase==='EMITIDA'){ac+=B('evidenciaVer','Ver evidencia','');if(fa!=null&&fa-cob>0.004&&hp('cobros_registrar'))ac+=B('cobroOpen','Registrar cobro','ok');}
    if(g.numeroFactura&&g.fase!=='PREPARADA'&&hp('comercial_corregir'))ac+=B('corregirOpen','Corregir nº','');
    if(hp('comercial_anular'))ac+=B('anularOpen','Anular','fix');
  }
  return `<tr class="${okA?'':'dim'}"><td><b>${g.id}</b></td><td>${g.modalidad==='AGRUPADA'?'Agrupada':'Individual'}</td><td>${esc((PROYECTOS.find(p=>p.id===g.cliente)||{}).cliente||g.cliente)}</td><td>${g.viajeIds.map(i=>`<button class="linkbtn" data-act="detalle" data-id="${i}">#${i}</button>`).join(' ')}</td>
  <td>${g.numeroFactura?`<b>${esc(g.numeroFactura)}</b>`:'<span class="warnl">pendiente</span>'}</td><td>${g.fechaFactura?fmtDate(g.fechaFactura):'—'}</td>
  <td style="text-align:right">${g.fase==='PREPARADA'?'<span class="mute">sin enviar</span>':qfmt(g.importeEnviado)}</td><td>${g.envio?`${esc(g.envio.por)}<br><span class="mute">${fmtDT(g.envio.en)}</span>`:'—'}</td>
  <td style="white-space:normal;min-width:170px">${g.emision?`${fmtDate(g.emision.fecha)}<br><span class="mute">${esc(g.emision.evidencia)}</span>`:'<span class="mute">Sin emitir</span>'}</td>
  <td style="text-align:right">${g.fase==='EMITIDA'?qfmt(fa):'—'}</td><td style="text-align:right">${g.fase==='EMITIDA'?qfmt(cob):'—'}</td><td style="text-align:right">${fa==null?'—':qfmt(r2(fa-cob))}</td>
  <td>${etapaBadge(et)}</td><td style="white-space:normal;min-width:190px;font-size:12px">${g.anulada?`<span class="mute">Anulada por ${esc(g.anulada.por)} · ${fmtDT(g.anulada.en)} · “${esc(g.anulada.motivo)}”</span><br>`:''}${(g.cobros||[]).map(c=>`<span class="mute">Cobro ${qfmt(c.monto)} · ${fmtDate(c.fecha)} · ${esc(c.referencia)}</span><br>`).join('')}${g.correcciones.map(c=>`<span class="mute">Nº corregido: ${esc(c.anterior)} → ${esc(c.nuevo)} (${esc(c.por)})</span><br>`).join('')}</td>
  ${acts?`<td style="white-space:normal;min-width:220px">${ac}</td>`:''}</tr>`;}).join('')}
  </tbody><tfoot><tr><td colspan="6"><b>Totales (cada factura se cuenta una sola vez; las preparadas no suman)</b></td><td style="text-align:right"><b>${qfmt(sum(g=>g.importeEnviado))}</b></td><td colspan="2"></td><td style="text-align:right"><b>${qfmt(sum(g=>g.fase==='EMITIDA'?nn(g.importeFacturado):0))}</b></td><td style="text-align:right"><b>${qfmt(sum(g=>cobradoDe(g)))}</b></td><td style="text-align:right"><b>${emi.length?qfmt(r2(emi.reduce((s,g)=>s+g.importeFacturado-cobradoDe(g),0))):'—'}</b></td><td colspan="${acts?3:2}"></td></tr></tfoot></table></div>
  <div class="mute" style="margin-top:8px;font-size:13px"><b>Preparada</b> = datos en armado, no enviada. <b>Enviada a facturación</b> = validada y enviada. <b>Emitida</b> = factura oficial con su evidencia. <b>Cobrada</b> = dinero recibido. Son etapas distintas: no se marca una factura como emitida sin evidencia.</div>`;
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
  return `<div class="exportbar"><div class="mute">${rows.length} ${rows.length===1?'viaje':'viajes'} · Importe total: <b>${qfmt(r2(conImp.reduce((s,r)=>s+r.importe,0)))}</b>${conImp.length<rows.length?` <span class="warnl">(${rows.length-conImp.length} sin importe)</span>`:''}</div>
  <div class="exportbtns"><span class="mute" style="font-size:12.5px">Se exporta lo que ves, con el detalle de cada factura y viaje</span><button class="btn sm" data-act="exportFactXlsx" title="Descargar Excel con todo el detalle">${icon('receipt',16)} Descargar Excel</button><button class="btn sm primary" data-act="exportFactPdf" title="Descargar PDF con todo el detalle">${icon('receipt',16)} Descargar PDF</button></div></div>
  <div class="xlwrap"><table class="xl" style="min-width:1300px"><thead><tr>${FC_COLS.map(c=>`<th aria-sort="${so.k===c[0]?(so.dir>0?'ascending':'descending'):'none'}"><button class="thbtn" data-act="sortF" data-k="${c[0]}">${c[1]} <span aria-hidden="true">${so.k===c[0]?(so.dir>0?'▲':'▼'):'↕'}</span></button></th>`).join('')}</tr></thead><tbody>
  ${rows.map(r=>`<tr><td>${esc(r.cliente)}</td><td>${esc(r.proyecto)}</td><td><button class="linkbtn" data-act="detalle" data-id="${r.id}">#${r.id}</button></td><td>${fmtDate(r.fechaViaje)}</td><td>${r.fechaEnvio?fmtDate(r.fechaEnvio):'<span class="mute">sin enviar</span>'}</td><td>${r.factura?esc(r.factura):'—'}</td><td>${r.grupo||'—'}</td><td style="text-align:right">${r.importe==null?sinReg:qfmt(r.importe)}</td><td>${etapaBadge(r.etapa)}</td><td>${esc(r.por)}</td></tr>`).join('')}
  </tbody></table></div>`;
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
function rutaTxt(id){const r=DB.rutas.find(x=>x.id===id);return r?`${r.codigo} · ${nombreOrigen(r.origenId)} → ${nombreDestino(r.destinoId)}`:id;}
BODY.tarifas=()=>{
  const q=S.tfQ.trim().toLowerCase();
  const rows=tarData().filter(t=>(!S.tfCli||t.cliente===S.tfCli)&&(!S.tfPcat||t.proyecto===S.tfPcat)&&(!S.tfCap||t.capacidad===S.tfCap)&&(!S.tfEst||(S.tfEst==='A'?t.activa:!t.activa))&&(!q||(t.cliente+' '+t.proyecto+' '+rutaTxt(t.rutaId)+' '+t.capacidad+' '+t.id).toLowerCase().includes(q)))
    .sort((a,b)=>a.cliente.localeCompare(b.cliente)||rutaTxt(a.rutaId).localeCompare(rutaTxt(b.rutaId))||b.vigenteDesde.localeCompare(a.vigenteDesde));
  const ed=hp('tarifas_editar'),dsv=hp('tarifas_desactivar');
  return rows.length?`<div class="mute" style="margin-bottom:8px">${rows.length} tarifas</div><div class="xlwrap"><table class="xl" style="min-width:1400px"><thead><tr><th>ID</th><th>Cliente</th><th>Proyecto</th><th>Ruta</th><th>Capacidad</th><th>Importe</th><th>Q diésel</th><th>% comb.</th><th>Vigente desde</th><th>Vigente hasta</th><th>Estado</th><th>Creada por · fecha</th><th>Modificada por · fecha</th>${ed||dsv?'<th>Acciones</th>':''}</tr></thead><tbody>
  ${rows.map(t=>`<tr class="${t.activa?'':'dim'}"><td><b>${t.id}</b></td><td>${esc((PROYECTOS.find(p=>p.id===t.cliente)||{}).cliente||t.cliente)}</td><td>${esc(t.proyecto)}</td><td style="white-space:normal;min-width:240px">${esc(rutaTxt(t.rutaId))}</td><td>${esc(t.capacidad)}</td><td style="text-align:right"><b>${qfmt(t.importe)}</b></td><td style="text-align:right">${t.qDieselPactado!=null&&t.qDieselPactado!==''?esc(t.qDieselPactado):'<span class="mute">—</span>'}</td><td style="text-align:right">${t.combustiblePct!=null&&t.combustiblePct!==''?esc(t.combustiblePct)+'%':'<span class="mute">—</span>'}</td><td>${fmtDate(t.vigenteDesde)}</td><td>${t.vigenteHasta?fmtDate(t.vigenteHasta):'<span class="mute">sin fin</span>'}</td><td>${chip(t.activa?'done':'neutral',t.activa?'Activa':'Inactiva')}</td><td>${esc(t.creadoPor)}<br><span class="mute">${fmtDT(t.creadoEn)}</span></td><td>${t.modificadoPor?`${esc(t.modificadoPor)}<br><span class="mute">${fmtDT(t.modificadoEn)}</span>`:'—'}</td>
  ${ed||dsv?`<td style="white-space:nowrap">${ed?`<button class="btn sm" data-act="tarifaOpen" data-id="${t.id}">Editar</button> `:''}${dsv?`<button class="btn sm ${t.activa?'fix':'ok'}" data-act="tarifaEstado" data-id="${t.id}">${t.activa?'Desactivar':'Activar'}</button>`:''}</td>`:''}</tr>`).join('')}
  </tbody></table></div>`:empty('No hay tarifas con estos filtros','Crea una tarifa o cambia la búsqueda.');
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
VIEWS.comercial=()=>{
  const tabsV=COMTABS.filter(t=>t.k!=='tar'||hp('tarifas_ver'));
  const k=tabsV.some(t=>t.k===S.tab.com)?S.tab.com:'bandeja',canAct=hp('comercial_agrupar');
  const acts=canAct||hp('facturas_emitir')||hp('comercial_corregir')||hp('comercial_anular')||hp('cobros_registrar');
  let ags=[];try{ags=API.agrupaciones(S.user.id);}catch(e){}
  let body;
  if(k==='bandeja'){
    body=`<div class="row2" style="margin:0 0 12px;grid-template-columns:1.4fr 1fr 1fr 1fr"><input type="text" id="q" placeholder="Buscar viaje, piloto, placa, destino, factura…" value="${esc(S.q)}" aria-label="Buscar"><select data-flt="fCli" aria-label="Cliente"><option value="">Todos los clientes</option>${PROYECTOS.map(p=>`<option value="${p.id}" ${S.fCli===p.id?'selected':''}>${esc(p.cliente)}</option>`).join('')}</select><select data-flt="fPcat" aria-label="Proyecto"><option value="">Todos los proyectos</option>${CAT.proyectos.map(p=>`<option ${S.fPcat===p?'selected':''}>${esc(p)}</option>`).join('')}</select><select data-flt="fCom" aria-label="Estado comercial"><option value="PEND" ${S.fCom==='PEND'?'selected':''}>Pendientes de gestión</option><option value="REG" ${S.fCom==='REG'?'selected':''}>Ya enviados a facturar</option><option value="" ${S.fCom===''?'selected':''}>Todos</option></select></div><div id="vb">${BODY.comercial()}</div>`;
  }else if(k==='fact'){
    const fase=S.tab.factFase||'VIG';
    const lista=ags.filter(g=>fase==='VIG'?g.estado==='ACTIVA':fase==='PREP'?(g.estado==='ACTIVA'&&g.fase==='PREPARADA'):g.estado==='ANULADA').slice().reverse();
    body=`<div class="chips"><button class="chip" aria-pressed="${fase==='VIG'}" data-act="factFase" data-v="VIG">Vigentes</button><button class="chip" aria-pressed="${fase==='PREP'}" data-act="factFase" data-v="PREP">Solo preparadas</button><button class="chip" aria-pressed="${fase==='ANU'}" data-act="factFase" data-v="ANU">Anuladas</button></div>${agrTable(lista,acts)}`;
  }else if(k==='hist'){
    body=`${histFiltros()}${esAdm()?viajeDetalleFact():''}<div id="vb">${BODY.hist()}</div>`;
  }else if(k==='tar'){
    body=tarifasVista();
  }else{
    let ev=[];try{ev=API.movimientosComerciales(S.user.id);}catch(e){}
    body=`<h2 style="margin-bottom:10px">Facturas anuladas</h2>${agrTable(ags.filter(g=>g.estado==='ANULADA').slice().reverse(),false)}<h2 style="margin:22px 0 10px">Movimientos comerciales</h2><div class="card">${ev.length?`<ul class="feed">${ev.slice().reverse().slice(0,60).map(x=>`<li><span class="avatar" style="width:30px;height:30px;font-size:12px">${initials(x.por)}</span><div><b>${esc(x.por)}</b> · ${esc(x.accion)}<br><span class="mute">${esc(x.ref)}${x.campo&&x.nuevo?' · '+esc(x.campo)+': '+esc(x.anterior||'(vacío)')+' → '+esc(x.nuevo):''}${x.motivo?' · “'+esc(x.motivo)+'”':''}</span></div><span class="when">${fmtDT(x.en)}</span></li>`).join('')}</ul>`:'<div class="mute">Sin movimientos.</div>'}</div>`;
  }
  const head=k==='tar'&&hp('tarifas_crear')?`<button class="btn primary" data-act="tarifaOpen" data-id="">${icon('plus',18)} Nueva tarifa</button>`:'';
  return `<div class="inner" style="max-width:1500px">${pageHead('COMERCIAL',canAct?'Selecciona uno o varios viajes del mismo cliente y factúralos. Agrupar es opcional.':'Consulta de gestión comercial.',head)}
    ${tabs('com',tabsV,k,null)}<div style="height:14px"></div>${body}</div>`;
};

/* ---- Rutas (catálogo, solicitudes y seguimiento) ---- */
let RUTAS_ERR='';
function rutasData(){let r=[];RUTAS_ERR='';try{r=API.rutas(S.user.id);}catch(e){RUTAS_ERR=e.message||'Error al consultar las rutas.';}return r;}
BODY.rutas=()=>{
  const q=S.rtQ.trim().toLowerCase(),fo=S.rtOri.trim().toLowerCase(),fd=S.rtDes.trim().toLowerCase(),fr=S.rtRuta.trim().toLowerCase();
  const txtO=r=>r.origenId?nombreOrigen(r.origenId):r.origenProp,txtD=r=>r.destinoId?nombreDestino(r.destinoId):r.destinoProp;
  const todas=rutasData();
  const rows=todas.filter(r=>(!(esAdm()&&S.rtCat)||(claveRuta(r)===S.rtCat&&(!S.rtOrig||(r.origenId||FALTA)===S.rtOrig)&&(!S.rtDest||(r.destinoId||FALTA)===S.rtDest)))&&(!S.rtCli||r.cliente===S.rtCli)&&(!S.rtPcat||r.proyecto===S.rtPcat)&&(!S.rtEst||r.estado===S.rtEst)
    &&(!fr||(r.codigo+' '+r.nombre).toLowerCase().includes(fr))&&(!fo||String(txtO(r)).toLowerCase().includes(fo))&&(!fd||String(txtD(r)).toLowerCase().includes(fd))
    &&(!q||(r.codigo+' '+r.nombre+' '+r.cliente+' '+r.proyecto+' '+txtO(r)+' '+txtD(r)).toLowerCase().includes(q))).sort((a,b)=>({PENDIENTE:0,EN_TARIFACION:1,PENDIENTE_APROBACION:2,ACTIVA:3,RECHAZADA:4}[a.estado]-{PENDIENTE:0,EN_TARIFACION:1,PENDIENTE_APROBACION:2,ACTIVA:3,RECHAZADA:4}[b.estado])||a.cliente.localeCompare(b.cliente)||a.codigo.localeCompare(b.codigo));
  const val=hp('rutas_validar')||hp('rutas_aprobar_comercial')||hp('rutas_aprobar_transporte');
  return rows.length?`<div class="mute" style="margin-bottom:8px">${rows.length} ${rows.length===1?'ruta':'rutas'}</div><div class="xlwrap"><table class="xl" style="min-width:1400px"><thead><tr>${esEnc()?'':'<th>Código</th>'}<th>Ruta</th><th>Cliente</th><th>Proyecto</th><th>Origen</th><th>Destino</th><th>Estado</th><th>Solicitada por · fecha</th><th>Validada por · fecha</th><th>Viajes</th>${val?'<th>Acciones</th>':''}</tr></thead><tbody>
  ${rows.map(r=>`<tr class="${r.estado==='ACTIVA'?'':'warnrow'}">${esEnc()?'':`<td>${r.codigo?`<b>${esc(r.codigo)}</b>`:'<span class="mute">sin código</span>'}</td>`}<td style="white-space:normal;min-width:220px">${esc(r.nombre)}</td><td>${esc((PROYECTOS.find(p=>p.id===r.cliente)||{}).cliente||r.cliente)}</td><td>${esc(r.proyecto)}</td>
  <td style="white-space:normal;min-width:150px">${r.origenId?esc(nombreOrigen(r.origenId)):(r.origenProp?`${esc(r.origenProp)} <span class="mute">(propuesto)</span>`:'<span class="mute">pendiente</span>')}</td><td style="white-space:normal;min-width:170px">${r.destinoId?esc(nombreDestino(r.destinoId)):(r.destinoProp?`${esc(r.destinoProp)} <span class="mute">(propuesto)</span>`:'<span class="mute">pendiente</span>')}</td>
  <td>${rutaChip(r.estado)}${r.rechazo?`<br><span class="mute" style="font-size:12px">“${esc(r.rechazo.motivo)}”</span>`:''}${r.aprobacionComercial?'<br><span class="mute">Comercial ✓</span>':''}${r.aprobacionTransporte?'<br><span class="mute">Transporte ✓</span>':''}</td><td>${esc(r.solicitadaPor)}<br><span class="mute">${fmtDT(r.solicitadaEn)}${r.fuente==='VIAJE'?' · desde un viaje':''}</span></td><td>${r.validadaPor?`${esc(r.validadaPor)}<br><span class="mute">${fmtDT(r.validadaEn)}</span>`:'—'}</td><td>${r.viajes||0}</td>
  ${val?`<td style="white-space:nowrap">${r.estado==='PENDIENTE'&&hp('rutas_validar')?`<button class="btn sm primary" data-act="rutaValidarOpen" data-id="${r.id}">Validar</button> <button class="btn sm fix" data-act="rutaRechazarOpen" data-id="${r.id}">Rechazar</button>`:''}${r.estado==='PENDIENTE_APROBACION'&&hp('rutas_aprobar_comercial')&&!r.aprobacionComercial?`<button class="btn sm ok" data-act="rutaAprobarComOpen" data-id="${r.id}">Aprobar Comercial</button>`:''}${r.estado==='PENDIENTE_APROBACION'&&hp('rutas_aprobar_transporte')&&!r.aprobacionTransporte?`<button class="btn sm ok" data-act="rutaAprobarTraOpen" data-id="${r.id}">Aprobar Transporte</button>`:''}</td>`:''}</tr>`).join('')}
  </tbody></table></div>`:(esAdm()?rutasVacioAdmin(todas):empty('No hay rutas con estos filtros','Cambia la búsqueda o registra una ruta nueva.'));
};
VIEWS.rutas=()=>{
  const all=rutasData(),pend=all.filter(r=>r.estado!=='ACTIVA'&&r.estado!=='RECHAZADA').length;
  const botones=(hp('rutas_solicitar')?`<button class="btn ${hp('rutas_gestionar')?'':'primary'}" data-act="rutaSolicitarOpen">${icon('plus',18)} Solicitar ruta nueva</button>`:'')+(hp('rutas_gestionar')?`<button class="btn primary" data-act="rutaRegistrarOpen">${icon('plus',18)} Registrar ruta validada</button>`:'');
  const cls=[...new Set(all.map(r=>r.cliente))];
  return `<div class="inner" style="max-width:1450px">${pageHead('RUTAS',S.user.rol==='ENCARGADO'?'Rutas de tu proyecto y estado de las que solicitaste':'Catálogo de rutas, solicitudes pendientes y su seguimiento',botones)}
    ${pend?`<div class="alertbox" style="margin-bottom:12px"><b>${pend} ${pend===1?'ruta pendiente':'rutas pendientes'} de activación.</b> Requieren validación, tarifa y aprobación de Gerencia Comercial y Transporte antes de usarse.</div>`:''}
    ${esAdm()?rutasCatalogoAdmin(all):''}<div class="lfilters" style="grid-template-columns:repeat(auto-fit,minmax(150px,1fr))"><input type="text" data-live="rtQ" placeholder="🔍 Buscar ruta" value="${esc(S.rtQ)}" aria-label="Buscar ruta"><input type="text" data-live="rtRuta" placeholder="Filtrar por ruta" value="${esc(S.rtRuta)}" aria-label="Filtrar por ruta"><input type="text" data-live="rtOri" placeholder="Filtrar por origen" value="${esc(S.rtOri)}" aria-label="Filtrar por origen"><input type="text" data-live="rtDes" placeholder="Filtrar por destino" value="${esc(S.rtDes)}" aria-label="Filtrar por destino">
    ${cls.length>1?`<select data-flt="rtCli" aria-label="Cliente"><option value="">Todos los clientes</option>${cls.map(c=>`<option value="${c}" ${S.rtCli===c?'selected':''}>${esc((PROYECTOS.find(p=>p.id===c)||{}).cliente||c)}</option>`).join('')}</select>`:''}
    <select data-flt="rtPcat" aria-label="Proyecto"><option value="">Todos los proyectos</option>${[...new Set(all.map(r=>r.proyecto))].map(p=>`<option ${S.rtPcat===p?'selected':''}>${esc(p)}</option>`).join('')}</select>
    <select data-flt="rtEst" aria-label="Estado"><option value="">Todos los estados</option><option value="PENDIENTE" ${S.rtEst==='PENDIENTE'?'selected':''}>Pendientes</option><option value="EN_TARIFACION" ${S.rtEst==='EN_TARIFACION'?'selected':''}>En tarifación</option><option value="PENDIENTE_APROBACION" ${S.rtEst==='PENDIENTE_APROBACION'?'selected':''}>Pendientes de aprobación</option><option value="ACTIVA" ${S.rtEst==='ACTIVA'?'selected':''}>Activas</option><option value="RECHAZADA" ${S.rtEst==='RECHAZADA'?'selected':''}>Rechazadas</option></select>
    <button class="btn sm" data-act="limpiarRutas">Limpiar filtros</button></div>
    <div id="vb">${BODY.rutas()}</div></div>`;
};
/* ---- Notificaciones (solo dentro de la aplicación) ---- */
function notifData(){try{return API.notificaciones(S.user.id);}catch(e){return [];}}
const NOT_L={proyecto:'Proyecto',cliente:'Cliente',ruta:'Ruta propuesta',origen:'Origen',destino:'Destino',solicitadoPor:'Registrada por',fecha:'Fecha de solicitud',viaje:'Viaje',codigo:'Código',motivo:'Motivo'};
function notifHTML(){
  const ns=notifData();
  if(!ns.length)return '<div class="mute">No tienes notificaciones.</div>';
  return ns.slice(0,30).map(n=>`<div class="cyc" style="${n.leida?'opacity:.7':''}"><div class="tc-top"><b>${esc(n.asunto)}</b>${n.leida?'':'<span class="badge tn-progress">Nueva</span>'}</div>
    <dl class="kv" style="grid-template-columns:130px 1fr;margin-top:6px;font-size:13px">${Object.keys(n.detalle).filter(k=>n.detalle[k]!==''&&NOT_L[k]).map(k=>`<dt>${NOT_L[k]}</dt><dd>${esc(k==='fecha'?fmtDT(n.detalle[k]):n.detalle[k])}</dd>`).join('')}</dl>
    <div class="mute" style="font-size:12px;margin-top:6px">${fmtDT(n.creadaEn)} · Aviso solo dentro de la aplicación: ${esc(n.externo.motivo)}</div>
    ${n.leida?'':`<button class="btn sm" style="margin-top:6px" data-act="notifLeer" data-id="${n.id}">Marcar como leída</button>`}</div>`).join('');
}

/* ---- Finanzas (Gerencia) ---- */
const FINTABS=[{k:'res',l:'Resumen financiero'},{k:'prov',l:'Proveedores'},{k:'fact',l:'Facturación e ingresos'},{k:'pil',l:'Pilotos'}];
const finFilters=()=>({desde:S.fDesde,hasta:S.fHasta,cliente:S.fCli,proyecto:S.fPcat,proveedor:S.fProv});
const PAGO_L={SIN_IMPORTE:'Sin importe registrado',PENDIENTE:'Pendiente',PARCIAL:'Pago parcial',PAGADO:'Pagado'};
const PAGO_C={SIN_IMPORTE:'st-PENDIENTE',PENDIENTE:'st-PENDIENTE_LIQUIDACION',PARCIAL:'st-EN_CURSO',PAGADO:'st-APROBADA'};
const pagoBadge=e=>`<span class="badge ${PAGO_C[e]}">${PAGO_L[e]}</span>`;
const nc='<span class="mute">No calculable</span>';
const qOrNc=v=>v==null?nc:qfmt(v);
function miniTable(cols,rows,foot){
  if(!rows.length)return '<div class="mute">Sin registros en este filtro.</div>';
  return `<div class="xlwrap" style="max-height:50vh"><table class="xl" style="min-width:560px"><thead><tr>${cols.map(c=>`<th>${c}</th>`).join('')}</tr></thead><tbody>${rows.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>${foot?`<tfoot><tr>${foot.map(c=>`<td><b>${c}</b></td>`).join('')}</tr></tfoot>`:''}</table></div>`;
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
  }else if(k==='prov'){
    const rows=R.tripRows.filter(r=>r.proveedor).sort((a,b)=>a.proveedor.localeCompare(b.proveedor)||a.id.localeCompare(b.id));
    const by={};rows.forEach(r=>{const p=by[r.proveedor]=by[r.proveedor]||{por:0,pag:0,sal:0,sin:0,n:0};p.n++;if(r.costo==null)p.sin++;else{p.por+=r.costo;p.sal+=r.saldoProv;}p.pag+=r.pagadoProv;});
    body=`<h2 style="margin-bottom:10px">Saldo por proveedor</h2>${miniTable(['Proveedor','Viajes','Por pagar','Pagado','Saldo pendiente','Sin costo registrado'],Object.keys(by).sort().map(p=>[esc(p),by[p].n,qfmt(r2(by[p].por)),qfmt(r2(by[p].pag)),`<b>${qfmt(r2(by[p].sal))}</b>`,by[p].sin||'—']))}
      <h2 style="margin:22px 0 10px">Detalle por viaje</h2>${rows.length?`<div class="xlwrap"><table class="xl" style="min-width:1300px"><thead><tr><th>Proveedor</th><th>Periodo</th><th>Cliente · proyecto</th><th>Viaje</th><th>Importe por pagar</th><th>Pagado</th><th>Saldo</th><th>Estado de pago</th><th>Fecha del pago</th><th>Referencia</th>${canPay||canCost?'<th>Acciones</th>':''}</tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${esc(r.proveedor)}</td><td>${r.periodo}</td><td>${esc(r.cliente)} · ${esc(r.proyecto)}</td><td><button class="linkbtn" data-act="detalle" data-id="${r.id}">#${r.id}</button></td><td style="text-align:right">${r.costo==null?sinReg:qfmt(r.costo)}</td><td style="text-align:right">${qfmt(r.pagadoProv)}</td><td style="text-align:right">${r.saldoProv==null?'—':qfmt(r.saldoProv)}</td><td>${pagoBadge(r.estadoProv)}</td><td>${r.fechaProv?fmtDate(r.fechaProv):'—'}</td><td>${esc(r.refProv)||'—'}</td>${canPay||canCost?`<td>${canCost?`<button class="btn sm" data-act="importeOpen" data-id="${r.id}" data-k="costoProveedor">Costo</button> `:''}${canPay&&r.costo!=null&&r.saldoProv>0.004?`<button class="btn sm ok" data-act="pagoOpen" data-id="${r.id}" data-tipo="PROVEEDOR">Pagar</button>`:''}</td>`:''}</tr>`).join('')}
      </tbody></table></div>`:empty('Sin servicios de proveedores en este filtro','Solo se listan viajes finalizados con proveedor (OPL).')}
      <div class="mute" style="margin-top:8px;font-size:13px">No se marca un pago como realizado por tener un importe calculado: el pago se registra con fecha y referencia.</div>`;
  }else if(k==='fact'){
    const nAg=R.agrRows.length;
    body=`<div class="exportbar"><div class="mute">${nAg} ${nAg===1?'factura':'facturas'} del periodo · se exporta con todo el detalle de cada viaje</div>
      <div class="exportbtns">${nAg?`<button class="btn sm" data-act="exportFinXlsx" title="Descargar Excel con todo el detalle">${icon('receipt',16)} Descargar Excel</button><button class="btn sm primary" data-act="exportFinPdf" title="Descargar PDF con todo el detalle">${icon('receipt',16)} Descargar PDF</button>`:''}</div></div>
      ${agrTable(R.agrRows.map(r=>DB.agrupaciones.find(g=>g.id===r.id)).filter(Boolean).reverse(),canPay?false:false)}
      <div class="mute" style="margin-top:8px;font-size:13px">Totales del periodo: enviado ${qfmt(M.enviado)} · facturado ${qfmt(M.facturado)} · cobrado ${qfmt(M.cobrado)} · pendiente de cobro ${M.pendCobro==null?'no calculable':qfmt(M.pendCobro)}.</div>`;
  }else{
    const rows=R.tripRows.sort((a,b)=>a.pilotoId.localeCompare(b.pilotoId)||a.id.localeCompare(b.id));
    body=`${rows.length?`<div class="xlwrap"><table class="xl" style="min-width:1250px"><thead><tr><th>Piloto</th><th>Viaje</th><th>Cliente · proyecto</th><th>Ingreso del viaje</th><th>Importe a pagar</th><th>Pagado</th><th>Saldo</th><th>Estado de pago</th><th>Fecha del pago</th><th>Referencia</th>${canPay?'<th>Acciones</th>':''}</tr></thead><tbody>
      ${rows.map(r=>`<tr><td>${esc((PILOTOS.find(p=>p.id===r.pilotoId)||{}).nombre)}</td><td><button class="linkbtn" data-act="detalle" data-id="${r.id}">#${r.id}</button></td><td>${esc(r.cliente)} · ${esc(r.proyecto)}</td><td style="text-align:right">${r.ingreso==null?sinReg:qfmt(r.ingreso)}</td><td style="text-align:right">${r.viaticos==null?sinReg:qfmt(r.viaticos)}</td><td style="text-align:right">${qfmt(r.pagadoPil)}</td><td style="text-align:right">${r.saldoPil==null?'—':qfmt(r.saldoPil)}</td><td>${pagoBadge(r.estadoPil)}</td><td>${r.fechaPil?fmtDate(r.fechaPil):'—'}</td><td>${esc(r.refPil)||'—'}</td>${canPay?`<td>${r.viaticos!=null&&r.saldoPil>0.004?`<button class="btn sm ok" data-act="pagoOpen" data-id="${r.id}" data-tipo="PILOTO">Pagar</button>`:''}</td>`:''}</tr>`).join('')}
      </tbody></table></div>`:empty('Sin viajes en este filtro')}
      <div class="mute" style="margin-top:8px;font-size:13px">El importe a pagar al piloto es el valor de Q_VIATICOS del viaje. Tu hoja no tiene una tarifa de pago a pilotos y no se inventa; el ingreso mostrado es la tarifa enviada a facturar.</div>`;
  }
  return `<div class="inner" style="max-width:1500px">${pageHead('Finanzas','Control de ingresos, costos y rentabilidad · solo lectura salvo permisos de registro')}${tabs('fin',FINTABS,k,null)}<div style="height:12px"></div>${filt}${body}</div>`;
};

/* ---- Usuarios y permisos ---- */
VIEWS.usuarios=()=>{
  const grupos=[...new Set(PERMS.map(p=>p[2]))],roles=Object.keys(ROLES),canP=hp('permisos_gestionar');
  return `<div class="inner" style="max-width:1300px">${pageHead('Usuarios y permisos','Cada acción se valida contra esta matriz y contra las reglas fijas de separación de funciones',hp('usuarios_gestionar')?`<button class="btn primary" data-act="usuarioOpen" data-id="">${icon('plus',18)} Nuevo usuario</button>`:'')}
    <div class="tablewrap scrollx"><table class="resp"><thead><tr><th>ID</th><th>Nombre</th><th>Usuario</th><th>Rol</th><th>Clientes asignados</th><th>Estado</th><th></th></tr></thead><tbody>
    ${DB.usuarios.map(u=>`<tr><td data-l="ID"><code>${u.id}</code></td><td data-l="Nombre"><b>${esc(u.nombre)}</b></td><td data-l="Usuario"><code>${esc(u.usuario)}</code></td><td data-l="Rol">${esc(ROLES[u.rol].label)}</td><td data-l="Clientes">${clientesAsig(u).length?esc(clientesAsig(u).join(', ')):(u.rol==='ENCARGADO'?'<span class="mute">ninguno</span>':'<span class="mute">todos / no aplica</span>')}</td><td data-l="Estado">${u.activo?'<span class="badge st-COMERCIAL_REGISTRADA">Activo</span>':'<span class="badge st-PENDIENTE">Inactivo</span>'}</td><td data-l="">${hp('usuarios_gestionar')?`<button class="btn sm" data-act="usuarioOpen" data-id="${u.id}">Editar</button>`:''}</td></tr>`).join('')}</tbody></table></div>
    <section class="section"><h2>Matriz de permisos por rol</h2><div class="mute" style="margin:-6px 0 10px;font-size:13px">${icon('lock',14)} = permiso que ese rol nunca puede tener (separación de funciones). Cada cambio queda en la auditoría.</div>
    <div class="tablewrap scrollx"><table class="pm"><thead><tr><th>Permiso</th>${roles.map(r=>`<th>${esc(ROLES[r].label)}</th>`).join('')}</tr></thead><tbody>
    ${grupos.map(g=>`<tr class="grp"><td colspan="${roles.length+1}">${g}</td></tr>${PERMS.filter(p=>p[2]===g).map(p=>`<tr><td>${p[1]}<br><code class="mute">${p[0]}</code></td>${roles.map(r=>{const proh=(PROHIBIDO[r]||[]).includes(p[0]),sie=(SIEMPRE[r]||[]).includes(p[0]),on=hasPerm({activo:true,rol:r},p[0]);return `<td>${proh?`<span class="mute" title="No permitido para este rol">${icon('lock',14)}</span>`:`<input type="checkbox" data-perm="${r}|${p[0]}" ${on?'checked':''} ${!canP||sie?'disabled':''} aria-label="${esc(p[1])} · ${esc(ROLES[r].label)}">`}</td>`;}).join('')}</tr>`).join('')}`).join('')}
    </tbody></table></div></section></div>`;
};

/* ---- Auditoría ---- */
function audList(){
  const q=S.q.trim().toLowerCase();let ev=[];try{ev=API.auditoria(S.user.id);}catch(e){}
  return ev.filter(e=>(!S.aEnt||e.entidad===S.aEnt)&&(!S.aRech||e.entidad==='SEGURIDAD')&&(!q||(e.viajeId+' '+e.accion+' '+e.campo+' '+e.por+' '+e.motivo+' '+e.ref+' '+e.anterior+' '+e.nuevo).toLowerCase().includes(q))).slice().reverse();
}
BODY.auditoria=()=>{
  const ev=audList(),show=ev.slice(0,300);
  return `<div class="mute" style="margin-bottom:8px">${ev.length} eventos${ev.length>300?' (se muestran los 300 más recientes)':''}</div>
  <div class="xlwrap"><table class="xl" style="min-width:1000px"><thead><tr><th>Fecha y hora</th><th>Evento</th><th>Viaje</th><th>Entidad</th><th>Acción</th><th>Campo</th><th>Valor anterior</th><th>Valor nuevo</th><th>Usuario</th><th>Motivo / ref.</th></tr></thead><tbody>
  ${show.map(e=>`<tr class="${e.entidad==='SEGURIDAD'?'dim':''}"><td>${fmtDT(e.en)}</td><td><code>${e.id}</code></td><td>${e.viajeId?`<button class="linkbtn" data-act="detalle" data-id="${e.viajeId}">#${e.viajeId}</button>`:'—'}</td><td>${e.entidad}</td><td style="white-space:normal;min-width:170px">${esc(e.accion)}</td><td>${esc(e.campo)}</td><td style="white-space:normal;max-width:200px">${esc(e.anterior)}</td><td style="white-space:normal;max-width:200px">${esc(e.nuevo)}</td><td>${esc(e.por)}<br><span class="mute">${esc(rolL(e.rol))}</span></td><td style="white-space:normal;min-width:180px">${esc(e.motivo)}${e.ref?`<br><span class="mute">${esc(e.ref)}</span>`:''}</td></tr>`).join('')}
  </tbody></table></div>`;
};
VIEWS.auditoria=()=>{
  const v=S.verif;
  return `<div class="inner" style="max-width:1400px">${pageHead('Auditoría','Bitácora de solo agregar: cada evento guarda valor anterior, valor nuevo, usuario, fecha y motivo',`<button class="btn primary" data-act="verificarAud">${icon('shield',18)} Verificar integridad</button>`)}
    ${v?`<div class="alertbox ${v.ok?'okb':''}" style="margin-bottom:14px"><b>${v.ok?'Integridad correcta':'Se detectó una alteración'}</b> · ${v.ok?`${v.total} eventos encadenados sin cambios.`:`El evento ${v.id} (posición ${v.indice+1}) no coincide con su huella. Alguien modificó el historial.`}</div>`:''}
    <div class="row2" style="margin-bottom:10px;grid-template-columns:1.6fr 1fr auto"><input type="text" id="q" placeholder="Buscar por viaje, usuario, acción, motivo…" value="${esc(S.q)}" aria-label="Buscar"><select data-flt="aEnt" aria-label="Entidad"><option value="">Todas las entidades</option>${['VIAJE','AGRUPACION','PERMISO','USUARIO','CLIENTE','SESION','SEGURIDAD'].map(e=>`<option ${S.aEnt===e?'selected':''}>${e}</option>`).join('')}</select><label style="display:flex;gap:8px;align-items:center;font-weight:600"><input type="checkbox" data-fltchk="aRech" ${S.aRech?'checked':''}> Solo rechazos y errores</label></div>
    <div id="vb">${BODY.auditoria()}</div></div>`;
};

/* ---- Modelo de datos ---- */
VIEWS.modelo=()=>{
  const T=[
    ['USUARIOS','Identidad estable',[['IdUsuario','Texto (clave) U-001','Estable; se usa en la auditoría'],['Usuario · NombreCompleto','Texto',''],['Rol','Opción','ADMIN · ENCARGADO · TORRE · LIQUIDACIONES · COMERCIAL · GERENCIA'],['Activo','Sí/No','Sustituir por cuenta Microsoft']]],
    ['ACCESO_CLIENTE','Alcance de encargados',[['IdUsuario','Búsqueda → USUARIOS',''],['Cliente','Búsqueda → CLIENTES','Un encargado solo opera sus clientes']]],
    ['PERMISOS','Matriz rol × permiso',[['Rol','Opción',''],['Permiso','Opción','22 permisos'],['Habilitado','Sí/No','Cambios auditados']]],
    ['CLIENTES','Clientes y proyectos',[['IdCliente · Nombre · Cliente','Texto','Código y nombre únicos'],['Proyectos','Lista → CATALOGO','Proyectos permitidos'],['NIT · DireccionFiscal · CorreoFacturacion · Contacto · Telefono · CreditoDias','Texto','Vacío = PENDIENTE; no se inventa'],['Activo · TorreEstatus · CreadoPor/El','—','Torre solo actualiza el estatus de los clientes marcados']]],
    ['VIAJES (hoja VIAJES_TRANSPORTES)','Un registro por viaje, para siempre',[['ID VIAJE, CLIENTE, PROYECTO, SHIPMENT, NO. VIAJE, TIPO VIAJE, TIPO CARGA, NO. CARGA, PRODUCTO, OPL, PILOTO, ORIGEN, DESTINO, FECHA PLAN','Columnas reales',''],['Horarios (10) · ESTATUS · NO. DOC RETORNO · Q_VIATICOS','Columnas reales',''],['PLACA · TANGO · TIPO UNIDAD','Desde FLOTA','No se copian'],['Estado','Opción','9 estados; solo cambia por transiciones válidas'],['AgrupacionId · NumeroFactura','Búsqueda / Texto','Proyección de la agrupación activa'],['CreadoPor/El · Iniciado · Finalizado · Enviado · Revisado · Aprobado','Persona + fecha','Resumen; la fuente es AUDITORIA']]],
    ['LIQUIDACIONES','Un renglón por envío (ciclo)',[['IdLiquidacion LIQ-0001','Texto (clave)',''],['IdViaje · Ciclo','Búsqueda · Número',''],['EnvioPor/El · EvidenciaId','Persona/fecha · Búsqueda',''],['Decision · Revisor · RevisionEn · Comentario','Opción · Persona · fecha · texto','Nunca se sobrescribe un ciclo anterior']]],
    ['EVIDENCIAS','Fotografías',[['IdEvidencia EVI-0001','Texto (clave)',''],['IdViaje · IdLiquidacion','Búsquedas',''],['Imagen','Archivo adjunto','Una por envío; las anteriores se conservan']]],
    ['AGRUPACIONES_COMERCIALES','Agrupación ≠ factura',[['IdAgrupacion AGR-0001','Texto (clave)','Identifica el conjunto'],['Cliente','Búsqueda → CLIENTES','Un solo cliente por agrupación'],['IdViajes','Relación 1..n → VIAJES','Sin duplicados'],['NumeroFactura','Texto único','Identifica la factura; distinto del ID de agrupación'],['Estado · Anulada{por,en,motivo} · Correcciones[]','Opción · registro','Nunca se borra la asignación anterior']]],
    ['COBROS (dentro de agrupación)','Dinero recibido',[['IdCobro COB-0001','Texto (clave)',''],['IdAgrupacion · Monto · Fecha · Referencia','—','Referencia obligatoria; no puede exceder lo facturado']]],
    ['PAGOS','Pagos a proveedores y pilotos',[['IdPago PAG-0001','Texto (clave)',''],['Tipo · IdViaje · Beneficiario','PROVEEDOR / PILOTO','Proveedor = OPL del viaje; piloto = piloto del viaje'],['Monto · Fecha · Referencia','—','No puede exceder el importe por pagar'],['Anulado{por,en,motivo}','registro','Los pagos no se borran']]],
    ['RUTAS','Catálogo y solicitudes',[['IdRuta R-0001 · Codigo · Nombre','Texto','Código único entre rutas asignadas'],['Cliente · Proyecto','Búsquedas','Una ruta pertenece a un cliente y proyecto'],['IdOrigen · IdDestino','Búsquedas → ORIGEN / DESTINOS','Se completan SOLO al asignar la ruta'],['Estado','ASIGNADA · NO_ASIGNADA · RECHAZADA','Una ruta NO ASIGNADA no recibe tarifa ni se factura'],['Solicitada por/el · Validada por/el · Rechazo','—','Trazabilidad']]],
    ['TARIFAS','Tarifas con vigencia',[['IdTarifa TAR-0001','Texto (clave)',''],['Cliente · Proyecto · IdRuta · Capacidad','Búsquedas','Combinación a la que aplica'],['Importe · VigenteDesde · VigenteHasta','Moneda · fechas','No se solapan dos tarifas activas iguales'],['Activa · CreadaPor/El · ModificadaPor/El','—','Se desactiva, no se borra; el viaje conserva su importe histórico']]],
    ['FACTURAS (AGRUPACIONES_COMERCIALES)','Preparada → Enviada → Emitida',[['IdAgrupacion · Modalidad','INDIVIDUAL / AGRUPADA','Agrupar es opcional'],['Fase','PREPARADA · ENVIADA · EMITIDA','Emitida exige evidencia'],['NumeroFactura · FechaFactura','Texto · fecha','Obligatorios para enviar'],['Envio{por,en,resultado} · Emision{por,fecha,importe,evidencia,archivo}','registros',''],['Cobros[] · Anulada · Correcciones[]','registros','']]],
    ['NOTIFICACIONES','Avisos dentro de la aplicación',[['IdNotificacion · Tipo · Asunto · Detalle','—','Ruta pendiente, asignada o rechazada'],['Destinatarios (roles) · Usuarios · LeidaPor','—','Comercial y Gerencia reciben las rutas pendientes'],['Externo{enviado:false,motivo}','—','Correo o Teams requieren un servicio configurado']]],
    ['AUDITORIA','Solo agregar',[['IdEvento · IdViaje · Entidad · Accion · Campo','Texto',''],['ValorAnterior · ValorNuevo','Texto',''],['IdUsuario · Rol · FechaHora · Motivo · Ref','—',''],['Prev · Hash','Texto','Cadena de huellas para detectar alteraciones']]]
  ];
  const E=[['PENDIENTE','Encargado inicia','EN_CURSO'],['EN_CURSO','Encargado finaliza','FINALIZADO → PENDIENTE_LIQUIDACION (automático)'],['PENDIENTE_LIQUIDACION','Encargado envía evidencia','EN_REVISION'],['EN_REVISION','Mar aprueba o devuelve','APROBADA → PENDIENTE_COMERCIAL (auto) · o PENDIENTE_CORRECCION'],['PENDIENTE_CORRECCION','Encargado corrige y reenvía','EN_REVISION'],['PENDIENTE_COMERCIAL','Alejandra agrupa','COMERCIAL_REGISTRADA'],['COMERCIAL_REGISTRADA','Anulación autorizada (admin)','PENDIENTE_COMERCIAL']];
  return `<div class="inner">${pageHead('Modelo de datos','Cómo se relaciona la información y cómo se mapea a SharePoint o Dataverse')}
    <div class="alertbox info" style="margin-bottom:16px"><b>Regla:</b> un único registro por viaje durante todo su ciclo de vida. Las tablas VIAJES, LIQUIDACIONES, EVIDENCIAS, AGRUPACIONES_COMERCIALES y AUDITORIA se relacionan por IdViaje; nada se borra, todo cambio es un evento nuevo.</div>
    <div class="grid g2">${T.map(t=>`<div class="card"><h3>${t[0]}</h3><div class="mute" style="margin:-8px 0 10px;font-size:13px">${t[1]}</div><div class="scrollx"><table style="font-size:13px"><thead><tr><th>Campo</th><th>Tipo sugerido</th><th>Nota</th></tr></thead><tbody>${t[2].map(r=>`<tr><td><code>${r[0]}</code></td><td>${r[1]}</td><td class="mute">${r[2]}</td></tr>`).join('')}</tbody></table></div></div>`).join('')}</div>
    <section class="section"><h2>Flujo de estados</h2><div class="tablewrap scrollx"><table><thead><tr><th>Estado actual</th><th>Quién lo mueve</th><th>Siguiente</th></tr></thead><tbody>${E.map(r=>`<tr><td>${badge(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join('')}</tbody></table></div>
    <div class="mute" style="margin-top:8px;font-size:13px"><b>ESTATUS</b> (columna de tu hoja, 20 valores) es el estatus operativo del viaje y es independiente del Estado del proceso. Torre de Control no modifica el Estado ni el ESTATUS: solo fechas y horas.</div></section></div>`;
};

/* =====================================================================
   RENDER
   ===================================================================== */
function menuHTML(){
  if(!S.menu)return'';
  const u=S.user;
  return `<div class="mback" data-act="menuClose"></div><div class="menu" role="menu">
    ${u?`<div class="mh"><b>${esc(u.nombre)}</b><small>${esc(ROLES[u.rol].label)}</small></div>`:`<div class="mh"><b>Opciones</b></div>`}
    <button data-act="togglePhone">${icon('phone',18)} Vista teléfono<span class="tag">${PREF.phone?'Activada':'Desactivada'}</span></button>
    <button data-act="toggleArch">${icon('code',18)} Notas de arquitectura<span class="tag">${PREF.arch?'Activadas':'Desactivadas'}</span></button>
    ${PWA.puedeMostrarInstalar()?`<button data-act="${PWA.prompt?'instalar':'instalarAyuda'}">${icon('phone',18)} ${PWA.prompt?'Instalar aplicación':'Cómo instalar la aplicación'}</button>`:''}
    ${(BACKEND.modo==='demo'&&typeof seedDB==='function'&&(!u||u.rol==='ADMIN'))?`<button data-act="reset">${icon('undo',18)} Reiniciar datos de ejemplo</button>`:''}
    ${u?`<button data-act="logout">${icon('out',18)} Cerrar sesión</button>`:''}</div>`;
}
function fieldM(f,data){
  const val=data[f.k]==null?'':data[f.k],id='mf_'+f.k,miss=(S.modal&&S.modal.live?S.modal.live(S.modal.data):[]).some(x=>x.campo===f.k)||((S.modal&&S.modal.missing)||[]).includes(f.k);
  const lab=`<label for="${id}">${f.label}${f.req?' <span class="mute">*</span>':''}</label>`,W=`<div class="fgroup ${miss?'fmissing':''}" data-fk="${f.k}">`;
  if(f.type==='textarea')return `${W}${lab}<textarea id="${id}" data-mf="${f.k}" placeholder="${esc(f.ph||'')}">${esc(val)}</textarea>${f.hint?`<span class="hint">${f.hint}</span>`:''}</div>`;
  if(f.type==='select'){const op=f.optsFn?f.optsFn(data):f.opts;return `${W}${lab}<select id="${id}" data-mf="${f.k}"><option value="">${esc(f.ph||'Selecciona')}</option>${op.map(o=>`<option value="${esc(o.id)}" ${o.id===val?'selected':''}>${esc(o.nombre)}</option>`).join('')}</select></div>`;}
  if(f.type==='check')return `<div class="fgroup"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-mf="${f.k}" ${val?'checked':''}> ${f.label}</label></div>`;
  if(f.type==='checks')return `<div class="fgroup"><label>${f.label}${f.req?' <span class="mute">*</span>':''}</label><div class="chips">${f.opts.map(o=>`<label class="chip" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-mfm="${f.k}" value="${esc(o.id)}" ${(val||[]).includes(o.id)?'checked':''}> ${esc(o.nombre)}</label>`).join('')}</div></div>`;
  if(f.type==='file')return `${W}${lab}<input type="file" id="${id}" data-mfile="${f.k}" accept="image/*,application/pdf">${val?`<span class="hint">✓ Archivo cargado</span>`:''}</div>`;
  return `${W}${lab}<input type="${f.type||'text'}" id="${id}" data-mf="${f.k}" value="${esc(val)}" autocomplete="off" ${f.ro?'readonly':''} ${f.type==='number'?'step="any" min="0" inputmode="decimal"':''}>${f.hint?`<span class="hint">${f.hint}</span>`:''}</div>`;
}
function liveHTML(f){
  return f.length?`<div class="alertbox" role="alert" style="margin:10px 0"><b>Falta completar para poder enviar:</b><ul style="margin:4px 0 0 18px;padding:0">${f.map(x=>`<li>${esc(x.msg)}</li>`).join('')}</ul></div>`:`<div class="alertbox okb" style="margin:10px 0"><b>Información completa:</b> ya puedes enviar.</div>`;
}
function updateLive(){
  const m=S.modal;if(!m||!m.live)return;
  const f=m.live(m.data),box=document.getElementById('mlive');
  if(box)box.innerHTML=liveHTML(f);
  document.querySelectorAll('.dlg [data-needs="1"]').forEach(b=>{b.disabled=f.length>0;});
  document.querySelectorAll('.dlg .fgroup[data-fk]').forEach(g=>g.classList.toggle('fmissing',f.some(x=>x.campo===g.dataset.fk)));
}
function modalHTML(){
  const m=S.modal;if(!m)return'';
  if(m.type==='photo'){const z=m.z||1;return `<div class="back" data-act="backdrop"><div class="dlg photo" role="dialog" aria-modal="true" aria-label="Visor de evidencia">${m.titulo?`<div class="mute" style="padding:2px 4px 8px;color:#444">${esc(m.titulo)}</div>`:''}<div class="zoomwrap"><img src="${m.src}" alt="Evidencia ampliada" style="width:${100*z}%;max-width:none"></div><div class="btns" style="justify-content:space-between"><span class="zoombar"><button class="btn sm" data-act="zoom" data-d="-0.5" aria-label="Alejar">−</button><button class="btn sm" data-act="zoom" data-d="0" aria-label="Tamaño original">${Math.round(z*100)}%</button><button class="btn sm" data-act="zoom" data-d="0.5" aria-label="Acercar">+</button></span><button class="btn" data-act="closeModal">Cerrar</button></div></div></div>`;}
  const live=m.live?m.live(m.data):null;
  const btns=m.buttons?m.buttons.map(b=>`<button class="btn ${b.cls||''}" data-act="${b.act}" data-id="${esc(m.id||'')}" data-needs="${b.needsComplete?1:0}" ${b.needsComplete&&live&&live.length?'disabled':''}>${b.label}</button>`).join(''):`<button class="btn ${m.okCls||'primary'}" data-act="${m.act}" data-id="${esc(m.id||'')}">${esc(m.ok)}</button>`;
  return `<div class="back" data-act="backdrop"><div class="dlg" role="dialog" aria-modal="true" aria-label="${esc(m.title)}" style="${m.ancho?'max-width:'+m.ancho:''}"><h2>${esc(m.title)}</h2>${m.text?`<p>${m.text}</p>`:''}${m.summary||''}
    ${m.chips?`<div class="chips">${m.chips.map(c=>`<button class="chip" data-act="chip" data-t="${esc(c)}">${esc(c)}</button>`).join('')}</div>`:''}
    ${(m.fields||[]).map(f=>fieldM(f,m.data)).join('')}
    ${live?`<div id="mlive">${liveHTML(live)}</div>`:''}
    ${m.err?`<div class="err" role="alert" style="margin-top:8px">${esc(m.err)}</div>`:''}
    <div class="btns">${m.noCancel?'':'<button class="btn" data-act="closeModal">Cancelar</button>'}${btns}</div></div></div>`;
}
function bannerHTML(){
  if(BACKEND.modo==='supabase'&&!navigator.onLine)return `<div class="offbar" role="alert">Sin conexión con el servidor. <b>Nada de lo que hagas se guarda</b> hasta que vuelva la conexión; no se confirmará ninguna operación.</div>`;
  return '';
}
function headerHTML(){
  const u=S.user;
  return `<header class="top"><div class="brand"><span class="isotile"><img src="${ISOLOGO}" alt="In Transit"></span><span>Control de viajes<small>In Transit · innovative outsourcing</small></span></div><span class="spacer"></span>${(BACKEND.modo==='demo'&&!SIN_DEMO)?'<span class="demotag" title="Los datos son de demostración y viven solo en este navegador">Modo demostración</span>':''}
    <button class="bell" data-act="notifOpen" aria-label="Notificaciones${notifData().filter(n=>!n.leida).length?' ('+notifData().filter(n=>!n.leida).length+' sin leer)':''}">${icon('bell',20)}${notifData().filter(n=>!n.leida).length?`<span class="bcount">${notifData().filter(n=>!n.leida).length}</span>`:''}</button>
    <button class="userchip" data-act="menu" aria-haspopup="menu" aria-label="Menú de usuario"><span class="avatar">${initials(u.nombre)}</span><span class="t"><b>${esc(u.nombre)}</b><span>${esc(ROLES[u.rol].label)}${(!esEnc()&&u.rol!=='ADMIN'&&clientesAsig(u).length)?' · '+esc(clientesAsig(u).join(', ')):''}</span></span></button></header>`;
}
function navHTML(){
  const items=navItems();
  if(items.length<2)return'';
  const act=S.view==='detalle'&&S.from?S.from.view:(S.view==='proyecto'?'proyectos':S.view);
  return `<nav class="side" aria-label="Navegación principal">${items.map(v=>`${v==='catalogos'?'<div class="sep"></div>':''}<button data-act="nav" data-v="${v}" ${act===v?'aria-current="page"':''}>${icon(NAVLBL[v][1],18)}${NAVLBL[v][0]}</button>`).join('')}</nav>`;
}
function render(){
  document.body.classList.toggle('phone',PREF.phone);
  const root=$('#app');
  if(!S.user||S.view==='login'){root.innerHTML=bannerHTML()+loginHTML()+menuHTML();return;}
  if(!allowed(S.view)){S.view=homeOf(S.user);S.param=null;}
  const prev=$('#main'),keep=prev&&S._lv===S.view&&S._lp===S.param,st=keep?prev.scrollTop:0;
  root.innerHTML=bannerHTML()+headerHTML()+`<div class="body">${navHTML()}<main id="main" class="main">${archBar()}${VIEWS[S.view]()}</main></div>`+modalHTML()+menuHTML();
  S._lv=S.view;S._lp=S.param;
  if(keep){const m=$('#main');if(m)m.scrollTop=st;}
}
function toast(msg,type){
  const el=document.createElement('div');el.className='toast'+(type==='err'?' err':'');el.textContent=msg;$('#toasts').appendChild(el);
  setTimeout(()=>el.remove(),type==='err'?6500:4200);
}
function go(view,param){
  if(!S.user){S.view='login';render();return;}
  if(!allowed(view)){toast(esEnc()?'No tienes acceso a esa pantalla.':'Tu perfil no tiene acceso a esa pantalla.','err');view=homeOf(S.user);param=null;}
  if(view==='detalle')S.from={view:S.view,param:S.param};
  if(view==='nuevo'&&S.view!=='nuevo')S.form=null;
  S.view=view;S.param=param||null;S.menu=false;S.modal=null;S.edit=null;S._lv=null;
  try{history.pushState(null,'','#'+view+(param?'/'+param:''));}catch(e){}
  render();const m=$('#main');if(m)m.scrollTop=0;
}

/* =====================================================================
   ACCIONES  (cada una llama a API.*, que valida de nuevo todo)
   ===================================================================== */
async function run(fn,ok,modalErr){
  try{const r=await fn();if(ok)toast(typeof ok==='function'?ok(r):ok);return {ok:true,r};}
  catch(e){
    if(e instanceof ApiError){if(modalErr&&S.modal){S.modal.err=sinPerfil(e.message);}else toast(sinPerfil(e.message),'err');}
    else{console.error(e);toast('Error inesperado: '+e.message,'err');}
    render();return {ok:false};
  }
}
const confirmM=(title,text,ok,act,id,okCls)=>{S.modal={type:'form',title,text,ok,act,id,okCls:okCls||'primary',fields:[],data:{},err:''};render();};
const formM=(o)=>{S.modal=Object.assign({type:'form',fields:[],data:{},err:'',okCls:'primary'},o);render();};
const afterWrite=()=>{S.modal=null;render();};
async function doLogin(){
  S.loginU=($('#u').value||'').trim();
  try{
    const u=await BACKEND.login($('#u').value,$('#p').value);
    S.user=u;S.loginErr='';S.tab={};S.draft={};S.fEstado='';S.fProy='';S.tProy='';S.q='';S.fCli='';S.fPcat='';S.sel=[];S.form=null;S.from=null;
    go(homeOf(u));
  }catch(e){S.loginErr=e instanceof ApiError?e.message:'No se pudo ingresar.';render();}
}
const optsClientes=()=>clientesAsig(S.user).map(id=>{const c=DB.clientes.find(x=>x.id===id);return c&&c.activo!==false?{id,nombre:c.cliente+' ('+c.nombre+')'}:null;}).filter(Boolean);
const optsProyectos=d=>d.cliente?proyectosAsig(S.user,d.cliente).map(p=>({id:p,nombre:p})):[];
const optsDestinos=d=>DESTINOS.filter(x=>x.proyecto===d.cliente).map(x=>({id:x.id,nombre:x.nombre}));
const optsOrigenes=()=>ORIGENES.map(o=>({id:o.id,nombre:o.nombre}));
const ACT={
  login:doLogin,
  async fill(d){const u=DB.usuarios.find(x=>x.usuario===d.u);$('#u').value=u.usuario;$('#p').value=u.clave;S.loginU=u.usuario;},
  async instalar(){await PWA.instalar();render();},
  async instalarAyuda(){formM({title:'Instalar la aplicación',text:'Elige tu dispositivo. La instalación depende del navegador; no todos los navegadores la ofrecen.',summary:PWA.ayudaHTML(),noCancel:true,ok:'Cerrar',act:'closeModal',ancho:'640px'});},
  async menu(){S.menu=!S.menu;render();},
  async menuClose(){S.menu=false;render();},
  async togglePhone(){PREF.phone=!PREF.phone;savePref();S.menu=false;render();},
  async toggleArch(){PREF.arch=!PREF.arch;savePref();S.menu=false;render();},
  async reset(){
    if(S.user&&S.user.rol!=='ADMIN')return;
    seedDB();syncRefs();S.form=null;S.draft={};S.sel=[];S.menu=false;S.modal=null;S.edit=null;
    if(S.user){S.user=DB.usuarios.find(u=>u.id===S.user.id)||null;if(!S.user)S.view='login';}
    render();toast('Datos de ejemplo reiniciados.');
  },
  async logout(){if(S.user)await BACKEND.logout();S.edit=null;S.user=null;S.view='login';S.menu=false;S.modal=null;S.form=null;S.loginErr='';S.loginU='';S.tab={};S.fEstado='';S.fProy='';S.tProy='';S.sel=[];try{history.pushState(null,'','#login');}catch(e){}render();},
  async nav(d){S.fEstado='';S.q='';S.fCli='';S.fPcat='';S.fProy='';S.fDesde='';S.fHasta='';S.fProv='';S.sortL=null;go(d.v);},
  async detalle(d){go('detalle',d.id);},
  async back(){const f=S.from;if(f&&f.view&&allowed(f.view))go(f.view,f.param);else go(homeOf(S.user));},
  async proj(d){S.fEstado='';go('proyecto',d.id);},
  async kpi(d){S.fEstado=d.v;S.fProy='';S.q='';go(allowed('todos')?'todos':homeOf(S.user));},
  async tab(d){S.tab[d.k]=d.v;S.q='';render();if(d.k==='cat'&&d.v==='fle'&&!S.fle)ACT.fleLoad();},
  async tproy(d){S.tProy=d.v;render();},
  async fproy(d){S.fProy=d.v;render();},
  async cbToggle(d){S.cb=S.cb===d.k?null:d.k;S.cbq='';render();const i=document.querySelector('.cb[data-cb="'+d.k+'"] .cb-q');if(i)i.focus();},
  async cbPick(d){if(d.k==='rtCat'){S.rtOrig='';S.rtDest='';}if(String(d.k).startsWith('m:')){const M=curModel();if(M)aplicarCampo(M,d.k.slice(2),d.v);}else S[d.k]=d.v;S.cb=null;S.cbq='';render();},
  async reintentarCatalogos(){try{await BACKEND.refrescar();toast('Datos actualizados desde el servidor.');}catch(e){toast(e.message||'No se pudo actualizar desde el servidor.','err');}render();},
  async festado(d){S.fEstado=d.v;render();},
  async backdrop(d,el,e){if(e.target===el){S.modal=null;render();}},
  async closeModal(){S.modal=null;render();},
  async photoEv(d){const l=liqsOf({id:d.id}).find(x=>x.evidenciaId===d.ev);if(l&&l.evidencia){S.modal={type:'photo',src:l.evidencia,z:1,titulo:`Evidencia · viaje #${d.id} · envío ${l.ciclo}`};render();}},
  async zoom(d){if(S.modal&&S.modal.type==='photo'){S.modal.z=d.d==='0'?1:Math.max(1,Math.min(4,(S.modal.z||1)+Number(d.d)));render();}},
  async sample(d){S.draft[d.id]=sampleSlip(d.id);render();},
  async limpiarFiltros(){S.q='';S.fCli='';S.fPcat='';S.fDesde='';S.fHasta='';S.sortL=null;render();},
  async sortL(d){const def=liqCurrent().k==='apr'?{k:'revision',dir:-1}:{k:'fecha',dir:1},c=S.sortL||def;S.sortL=c.k===d.k?{k:d.k,dir:-c.dir}:{k:d.k,dir:1};render();},
  async sortF(d){const c=S.sortF||{k:'fechaEnvio',dir:-1};S.sortF=c.k===d.k?{k:d.k,dir:-c.dir}:{k:d.k,dir:1};render();},
  /* estados */
  async iniciarAsk(d){confirmM(`¿Iniciar el viaje #${d.id}?`,'Pasará a En curso y Torre de Control podrá monitorearlo. Esta acción queda registrada.','INICIAR VIAJE','iniciarOk',d.id);},
  async iniciarOk(d){const r=await run(()=>API.iniciar(S.user.id,d.id),`Viaje #${d.id} en curso.`,true);if(r.ok)afterWrite();},
  async finalizarAsk(d){const t=J(API.viaje(S.user.id,d.id));confirmM(`¿Finalizar el viaje #${d.id}?`,`${esc(t.piloto)} · ${esc(t.f.unidad)}<br>${esc(t.origen)||'Ruta pendiente'} → ${esc(t.destino)||'Ruta pendiente'}<br>Quedará finalizado y pasará a liquidación. No se elimina: se conserva en el historial.`,'FINALIZAR VIAJE','finalizarOk',d.id);},
  async finalizarOk(d){const r=await run(()=>API.finalizar(S.user.id,d.id),`Viaje #${d.id} finalizado. Pasó a pendiente de liquidación.`,true);if(r.ok)afterWrite();},
  async enviarLiq(d){const r=await run(()=>API.enviarLiquidacion(S.user.id,d.id,S.draft[d.id]),`Liquidación del viaje #${d.id} enviada. Quedó en revisión.`);if(r.ok)delete S.draft[d.id];render();},
  async aprobarAsk(d){confirmM(`¿Aprobar la liquidación del viaje #${d.id}?`,'El viaje quedará disponible para Comercial. La decisión se registra con tu usuario, fecha y hora.','APROBAR LIQUIDACIÓN','aprobarOk',d.id,'ok');},
  async aprobarOk(d){const r=await run(()=>API.aprobar(S.user.id,d.id),`Viaje #${d.id}: liquidación aprobada.`,true);if(r.ok)afterWrite();},
  async devolverOpen(d){formM({title:'¿Qué debe corregirse?',text:`Viaje #${d.id}. El comentario es obligatorio y le llegará al responsable del proyecto.`,chips:['Falta firma del piloto','Liquidación incompleta','Falta comprobante'],fields:[{k:'comentario',label:'Comentario de revisión',type:'textarea',req:1,ph:'Escribe qué falta o qué está incorrecto'}],ok:'DEVOLVER PARA CORRECCIÓN',okCls:'fix',act:'devolverSend',id:d.id});},
  async chip(d){const ta=$('#mf_comentario');if(ta){ta.value=d.t;S.modal.data.comentario=d.t;ta.focus();}},
  async devolverSend(d){const r=await run(()=>API.devolver(S.user.id,d.id,S.modal.data.comentario),`Viaje #${d.id} devuelto al responsable con tu comentario.`,true);if(r.ok)afterWrite();},
  async shipmentDupOpen(d){formM({title:`Aprobar Shipment duplicado · viaje #${d.id}`,text:'Esta es una aprobación excepcional de Gerencia de Transporte. El valor se convertirá en <b>DUP-</b> + el Shipment actual. Si ese DUP- ya existe, no se podrá aprobar ni liquidar.',ok:'APROBAR DUPLICADO',okCls:'fix',act:'shipmentDupOk',id:d.id});},
  async shipmentDupOk(d){const r=await run(()=>API.aprobarShipmentDuplicado(S.user.id,d.id),`Shipment aprobado como ${r.shipment}.`,true);if(r.ok)afterWrite();},
  async statusRetry(d){const el=document.querySelector('select[data-status="'+d.id+'"]');if(el)statusSave(d.id,el);},
  /* alta y edición de viajes */
  async guardar(){
    const f=S.form;f.err='';
    if(esAdm()&&!f.pilotoId){f.err=!f.placaSel?'Selecciona la placa del equipo.':(pilotosDePlaca(f.proyecto,f.placaSel).length>1?'Esta placa tiene más de un piloto asignado: elige el piloto de la placa.':'La placa seleccionada no tiene un piloto asignado para este cliente: no se puede guardar el viaje hasta que se relacione una unidad con un piloto.');render();topScroll();return;}
    const d={cliente:f.proyecto,fechaPlan:f.fechaPlanD&&f.fechaPlanT?f.fechaPlanD+'T'+f.fechaPlanT:'',rutaRef:f.rutaRef||''};
    [...DATA_KEYS,...TKEYS].forEach(k=>{d[k]=f[k];});
    try{const t=await API.crearViaje(S.user.id,d);f.savedId=t.id;render();topScroll();toast(f.rutaId==='NO_ASIGNADA'?`Viaje #${t.id} guardado con ruta NO ASIGNADA. Se avisó a Comercial y Gerencia dentro de la aplicación.`:`Viaje #${t.id} guardado.`);}
    catch(e){f.err=sinPerfil(e.message);render();topScroll();}
  },
  async otro(){S.form=initForm();render();},
  async terminar(){
    const f=S.form||{};
    if(!f.savedId&&(f.pilotoId||f.rutaId)){confirmM('¿Salir sin guardar?','Hay datos del formulario que no se han guardado. Los viajes ya guardados no se pierden.','Salir sin guardar','terminarOk');return;}
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
    editGroups(t).flatMap(g=>GRUPOKEYS[g]).forEach(k=>{cambios[k]=k==='fechaPlan'?(M.fechaPlanD&&M.fechaPlanT?M.fechaPlanD+'T'+M.fechaPlanT:''):M[k];});
    try{const r=await API.editarViaje(S.user.id,E.id,cambios,E.motivo);S.edit=null;render();topScroll();toast(r.cambios?`Viaje #${E.id} actualizado (${r.cambios} ${r.cambios===1?'cambio':'cambios'}).`:'No hubo cambios.');
      const t2=API.viaje(S.user.id,E.id);if(DUR.some(([l,a,b])=>diff(t2[a],t2[b])==='Revisar fechas'))toast('Ojo: hay horarios fuera de orden.','err');}
    catch(e){M.err=e.message;render();topScroll();}
  },
  /* comercial: facturar (agrupar es opcional) */
  async selClear(){S.sel=[];$('#vb').innerHTML=BODY.comercial();},
  async facturaOpen(){
    const ts=S.sel.map(id=>DB.trips.find(t=>t.id===id)).filter(Boolean);if(!ts.length)return;
    const cli=ts[0].proyecto;
    if(ts.some(t=>t.proyecto!==cli)){toast('No se pueden facturar juntos viajes de clientes diferentes.','err');return;}
    const nombre=(PROYECTOS.find(p=>p.id===cli)||{}).cliente,ids=ts.map(t=>t.id),tot=ts.reduce((a,t)=>a+(nn(t.tarifaCliente)||0),0);
    formM({title:ts.length===1?'Facturar un solo viaje':'Facturar viajes agrupados',
      text:`Cliente: <b>${esc(nombre)}</b> · ${ts.length} ${ts.length===1?'viaje (factura individual, sin agrupar)':'viajes (se facturan juntos)'}`,
      summary:miniTable(['Viaje','Ruta','Piloto','Tarifa'],ts.map(t=>[`<b>#${t.id}</b>`,rutaHTML(t),esc(J(t).piloto),nn(t.tarifaCliente)==null?'<span class="warnl">⚠ sin tarifa</span>':qfmt(t.tarifaCliente)]),['Total','','',qfmt(tot)]),
      fields:[{k:'serieFactura',label:'Serie de factura',req:1},{k:'numeroFactura',label:'Número de factura',req:1},{k:'fechaFactura',label:'Fecha de la factura',type:'date',req:1}],
      live:d=>faltantesEnvio(cli,ids,d.numeroFactura,d.fechaFactura,null,d.serieFactura),
      buttons:[{label:'GUARDAR COMO PREPARADA',act:'facturaPrep',cls:''},{label:'ENVIAR A FACTURACIÓN',act:'facturaEnviar',cls:'primary',needsComplete:true}],
      id:cli,data:{serieFactura:'',numeroFactura:'',fechaFactura:''}});
  },
  async facturaPrep(d){const m=S.modal.data;const r=await run(()=>API.prepararFactura(S.user.id,{cliente:d.id,viajeIds:S.sel.slice(),serieFactura:m.serieFactura,numeroFactura:m.numeroFactura,fechaFactura:m.fechaFactura}),g=>`Factura ${g.id} preparada. Aún NO se ha enviado a facturación.`,true);if(r.ok){S.sel=[];afterWrite();}},
  async facturaEnviar(d){
    const m=S.modal.data;let g;
    const falt=S.modal.live?S.modal.live(m):[];
    if(falt.length){S.modal.err='No se envió nada. Falta: '+falt.map(x=>x.msg).join('; ')+'.';S.modal.missing=falt.map(x=>x.campo);render();return;}
    try{g=await API.prepararFactura(S.user.id,{cliente:d.id,viajeIds:S.sel.slice(),serieFactura:m.serieFactura,numeroFactura:m.numeroFactura,fechaFactura:m.fechaFactura});}
    catch(e){S.modal.err=e.message;render();return;}
    S.sel=[];
    try{await API.enviarFactura(S.user.id,g.id);afterWrite();toast(`Factura ${g.numeroFactura} enviada a facturación (${g.id}). Aún no está emitida.`);}
    catch(e){S.modal.err=e.message+' La factura quedó preparada (NO enviada).';S.modal.missing=(e.faltantes||[]).map(x=>x.campo);render();}
  },
  async facturaEditar(d){
    const g=DB.agrupaciones.find(x=>x.id===d.id);if(!g)return;
    formM({title:`Completar factura ${g.id}`,text:`${g.viajeIds.length} ${g.viajeIds.length===1?'viaje':'viajes'} · ${g.modalidad==='AGRUPADA'?'agrupados':'factura individual'}. Faltan datos antes de poder enviarla.`,
      fields:[{k:'serieFactura',label:'Serie de factura',req:1},{k:'numeroFactura',label:'Número de factura',req:1},{k:'fechaFactura',label:'Fecha de la factura',type:'date',req:1}],
      live:x=>faltantesEnvio(g.cliente,g.viajeIds,x.numeroFactura,x.fechaFactura,g.id,x.serieFactura),
      buttons:[{label:'GUARDAR',act:'facturaEditarGuardar',cls:''},{label:'GUARDAR Y ENVIAR A FACTURACIÓN',act:'facturaEditarEnviar',cls:'primary',needsComplete:true}],
      id:g.id,data:{serieFactura:g.serieFactura||'',numeroFactura:g.numeroFactura||'',fechaFactura:g.fechaFactura||''}});
  },
  async facturaEditarGuardar(d){const m=S.modal.data;const r=await run(()=>API.actualizarFactura(S.user.id,d.id,m),`Factura ${d.id} actualizada (sigue preparada).`,true);if(r.ok)afterWrite();},
  async facturaEditarEnviar(d){
    const m=S.modal.data;
    const falt=S.modal.live?S.modal.live(m):[];
    if(falt.length){S.modal.err='No se envió nada. Falta: '+falt.map(x=>x.msg).join('; ')+'.';S.modal.missing=falt.map(x=>x.campo);render();return;}
    try{await API.actualizarFactura(S.user.id,d.id,m);await API.enviarFactura(S.user.id,d.id);afterWrite();toast(`Factura ${m.numeroFactura} enviada a facturación. Aún no está emitida.`);}
    catch(e){S.modal.err=e.message;S.modal.missing=(e.faltantes||[]).map(x=>x.campo);render();}
  },
  async emitirOpen(d){
    const g=DB.agrupaciones.find(x=>x.id===d.id);if(!g)return;
    formM({title:`Marcar como emitida · ${g.numeroFactura}`,text:`Hazlo solo si ya existe la factura oficial. Se exige evidencia (UUID, serie y número o autorización) y, si puedes, el archivo. Enviado a facturar: <b>${qfmt(g.importeEnviado)}</b>.`,
      fields:[{k:'fechaEmision',label:'Fecha de emisión',type:'date',req:1},{k:'importe',label:'Importe emitido (Q)',type:'number',req:1},{k:'evidencia',label:'Evidencia de emisión (UUID, serie/número o autorización)',req:1},{k:'archivo',label:'Archivo de la factura (imagen o PDF, opcional)',type:'file'},{k:'motivoDiferencia',label:'Motivo si el importe difiere de lo enviado',type:'textarea'}],
      data:{fechaEmision:todayStr(),importe:g.importeEnviado,evidencia:'',archivo:'',motivoDiferencia:''},ok:'MARCAR COMO EMITIDA',act:'emitirOk',id:g.id});
  },
  async emitirOk(d){const m=S.modal.data;const r=await run(()=>API.emitirFactura(S.user.id,d.id,{fechaEmision:m.fechaEmision,importe:m.importe,evidencia:m.evidencia,archivo:m.archivo,motivoDiferencia:m.motivoDiferencia}),`Factura ${d.id} marcada como emitida con su evidencia.`,true);if(r.ok)afterWrite();},
  async evidenciaVer(d){
    const g=DB.agrupaciones.find(x=>x.id===d.id);if(!g||!g.emision)return;
    const e=g.emision;
    formM({title:`Evidencia de emisión · ${g.numeroFactura}`,text:`Emitida el ${fmtDate(e.fecha)} · registrada por ${esc(e.por)} (${fmtDT(e.en)}) · importe ${qfmt(e.importe)}`,
      summary:`<div class="alertbox info"><b>Evidencia:</b> ${esc(e.evidencia)}${e.motivoDiferencia?`<br><b>Motivo de diferencia:</b> ${esc(e.motivoDiferencia)}`:''}</div>${e.archivo?(e.archivo.startsWith('data:image')?`<img src="${e.archivo}" alt="Factura" style="max-width:100%;border:1px solid var(--line);border-radius:8px">`:`<a class="btn" href="${e.archivo}" download="factura-${esc(g.numeroFactura)}.pdf">Descargar PDF adjunto</a>`):'<div class="mute">Sin archivo adjunto: solo referencia.</div>'}`,noCancel:true,ok:'Cerrar',act:'closeModal'});
  },
  async corregirOpen(d){formM({title:`Corregir factura · ${d.id}`,text:'La corrección conserva el número anterior y queda auditada.',fields:[{k:'numero',label:'Nuevo número de factura',req:1},{k:'motivo',label:'Motivo de la corrección',type:'textarea',req:1}],ok:'GUARDAR CORRECCIÓN',act:'corregirOk',id:d.id});},
  async corregirOk(d){const r=await run(()=>API.corregirFactura(S.user.id,d.id,S.modal.data.numero,S.modal.data.motivo),`Factura de ${d.id} corregida.`,true);if(r.ok)afterWrite();},
  async anularOpen(d){formM({title:`Anular factura ${d.id}`,text:'Los viajes quedan libres para facturarse de nuevo. La factura se conserva marcada como anulada.',fields:[{k:'motivo',label:'Motivo de la anulación',type:'textarea',req:1}],ok:'ANULAR FACTURA',okCls:'fix',act:'anularOk',id:d.id});},
  async anularOk(d){const r=await run(()=>API.anularAgrupacion(S.user.id,d.id,S.modal.data.motivo),`Factura ${d.id} anulada.`,true);if(r.ok)afterWrite();},
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
  async exportFactPdf(d,el){
    if(el){el.disabled=true;el.dataset.t=el.textContent;el.textContent='Generando…';}
    try{const r=await expFactPdf();toast(`PDF descargado: ${r.facturas.length} ${r.facturas.length===1?'factura':'facturas'} · ${r.viajes.length} ${r.viajes.length===1?'viaje':'viajes'}.`);}
    catch(e){toast(e.message==='SIN_DATOS'?'No hay nada que exportar con estos filtros.':'No se pudo generar el PDF: '+e.message,'err');}
    if(el){el.disabled=false;el.textContent=el.dataset.t;}
  },
  async fcLimpiar(){Object.assign(S,{fcViaje:'',fcCli:'',fcPcat:'',fcMes:'',fcSem:'',fcFecha:'',fcDesde:'',fcHasta:'',fcFechas:[],fcQ:'',fcEstado:'ENV',fcBase:'envio',sortF:null});render();},
  async cobroOpen(d){const g=DB.agrupaciones.find(x=>x.id===d.id);formM({title:`Registrar cobro · ${d.id}`,text:`Factura ${esc(g.numeroFactura)} · facturado ${qfmt(g.importeFacturado)} · cobrado ${qfmt(cobradoDe(g))}. Registra solo dinero efectivamente recibido.`,fields:[{k:'monto',label:'Monto cobrado (Q)',type:'number',req:1},{k:'fecha',label:'Fecha del cobro',type:'date',req:1},{k:'referencia',label:'Referencia del cobro (depósito, transferencia…)',req:1}],data:{monto:'',fecha:todayStr(),referencia:''},ok:'REGISTRAR COBRO',okCls:'ok',act:'cobroOk',id:d.id});},
  async cobroOk(d){const m=S.modal.data;const r=await run(()=>API.registrarCobro(S.user.id,d.id,m),c=>`Cobro ${c.id} registrado.`,true);if(r.ok)afterWrite();},
  /* tarifas */
  async aplicarTarifaViaje(d){const r=await run(()=>API.aplicarTarifa(S.user.id,d.id),x=>`Tarifa aplicada al viaje #${d.id}: ${qfmt(x.importe)}.`);render();},
  async aplicarTarifasTodas(){const r=await run(()=>API.aplicarTarifasPendientes(S.user.id,[]),x=>`Tarifas aplicadas: ${x.aplicadas.length}. Sin tarifa válida (requieren revisión): ${x.sinTarifa.length}.`);render();},
  async tarifaOpen(d){
    const t=d.id?DB.tarifas.find(x=>x.id===d.id):null;
    if(t){
      formM({title:`Editar tarifa ${t.id}`,text:`${esc((PROYECTOS.find(p=>p.id===t.cliente)||{}).cliente)} · ${esc(t.proyecto)} · ${esc(rutaTxt(t.rutaId))} · ${esc(t.capacidad)}.<br>Cambiar la tarifa NO modifica el importe de viajes ya tarifados o facturados: conservan su importe.`,
        fields:[{k:'importe',label:'Importe (Q)',type:'number',req:1},{k:'qDieselPactado',label:'Q diésel pactado (opcional · activa el ajuste por combustible)',type:'number'},{k:'combustiblePct',label:'% de combustible (opcional · 0 a 100)',type:'number'},{k:'vigenteDesde',label:'Vigente desde',type:'date',req:1},{k:'vigenteHasta',label:'Vigente hasta (opcional)',type:'date'},{k:'motivo',label:'Motivo del cambio (opcional)',type:'textarea'}],
        data:{importe:t.importe,qDieselPactado:t.qDieselPactado==null?'':t.qDieselPactado,combustiblePct:t.combustiblePct==null?'':t.combustiblePct,vigenteDesde:t.vigenteDesde,vigenteHasta:t.vigenteHasta,motivo:''},ok:'GUARDAR CAMBIOS',act:'tarifaSave',id:t.id});
    }else{
      formM({title:'Nueva tarifa',text:'La tarifa aplica solo a la combinación cliente, proyecto, ruta (asignada) y capacidad que elijas.',
        fields:[{k:'cliente',label:'Cliente',type:'select',req:1,optsFn:()=>optsClientes(),ph:'Selecciona el cliente'},{k:'proyecto',label:'Proyecto',type:'select',req:1,optsFn:optsProyectos,ph:'Primero elige el cliente'},
          {k:'rutaId',label:'Ruta',type:'select',req:1,optsFn:x=>(x.cliente&&x.proyecto?API.rutasParaViaje(S.user.id,x.cliente,x.proyecto):[]).map(r=>({id:r.id,nombre:`${r.codigo} · ${nombreOrigen(r.origenId)} → ${nombreDestino(r.destinoId)}`})),ph:'Selecciona la ruta (solo rutas asignadas)'},
          {k:'capacidad',label:'Capacidad',type:'select',req:1,optsFn:()=>capsCat().map(c=>({id:c,nombre:c})),ph:'Selecciona la capacidad'},
          {k:'importe',label:'Importe (Q)',type:'number',req:1},{k:'qDieselPactado',label:'Q diésel pactado (opcional · activa el ajuste por combustible)',type:'number'},{k:'combustiblePct',label:'% de combustible (opcional · 0 a 100)',type:'number'},{k:'vigenteDesde',label:'Vigente desde',type:'date',req:1},{k:'vigenteHasta',label:'Vigente hasta (opcional)',type:'date'}],
        data:{cliente:optsClientes().length===1?optsClientes()[0].id:'',proyecto:'',rutaId:'',capacidad:'',importe:'',qDieselPactado:'',combustiblePct:'',vigenteDesde:todayStr(),vigenteHasta:''},rerender:['cliente','proyecto'],ok:'GUARDAR TARIFA',act:'tarifaSave',id:''});
    }
  },
  async tarifaSave(d){const m=S.modal.data;const r=await run(()=>d.id?API.editarTarifa(S.user.id,d.id,m):API.crearTarifa(S.user.id,m),t=>d.id?`Tarifa ${t.id} actualizada.`:`Tarifa ${t.id} creada.`,true);if(r.ok)afterWrite();},
  async tarifaEstado(d){const t=DB.tarifas.find(x=>x.id===d.id);if(!t)return;await run(()=>API.cambiarEstadoTarifa(S.user.id,d.id,!t.activa,''),x=>`Tarifa ${x.id} ${x.activa?'activada':'desactivada'}. El historial se conserva.`);render();},
  async memOpen(){
    let actual=[];try{actual=API.mem(S.user.id);}catch(e){}
    formM({title:'Tabla MEM · precio del diésel',text:'Pega los renglones <b>fecha</b> y <b>precio</b> (separados por tabulación, coma o punto y coma), uno por línea. Ejemplo: <code>2026-10-01,34.50</code>.<br><b>Cargar reemplaza toda la tabla.</b> El ajuste por combustible usa el precio de la fecha plan del viaje (o el más reciente anterior).',
      fields:[{k:'filas',label:'Renglones (fecha, precio del diésel)',type:'textarea',req:1}],
      data:{filas:actual.map(r=>`${r.fecha}\t${r.precioDiesel}`).join('\n')},ok:'CARGAR MEM',act:'memSave'});
  },
  async memSave(){
    const raw=String(S.modal.data.filas||'');
    const filas=raw.split(/\r?\n/).map(l=>{const m=l.split(/[\t,;]+|\s{2,}/).map(x=>x.trim()).filter(Boolean);return {fecha:m[0]||'',precioDiesel:m[1]||''};}).filter(x=>x.fecha);
    const r=await run(()=>API.cargarMem(S.user.id,filas),x=>`Tabla MEM cargada: ${x.renglones} renglones.`,true);
    if(r.ok)afterWrite();
  },
  async fleLoad(){
    S.fle={cargando:true,mant:[],gast:[],err:''};render();
    try{const mant=(await API.mantenimientos(S.user.id,{limite:1000}))||[];const gast=(await API.gastos(S.user.id,{limite:1000}))||[];S.fle={cargando:false,mant,gast,err:''};}
    catch(e){S.fle={cargando:false,mant:[],gast:[],err:e.message||'No se pudo consultar la flota.'};}
    render();
  },
  async fleSync(){
    const r=await run(()=>BACKEND.sincronizarFlota(),x=>`Fleetio: ${x.unidades} unidades, ${x.mantenimientos} mantenimientos, ${x.gastos} gastos sincronizados.`);
    if(r.ok)ACT.fleLoad();
  },
  /* rutas */
  async cliLimpiar(){S.cliFiltro='';render();},
  async fcQuitarViaje(){S.fcViaje='';render();},
  async limpiarRutas(){Object.assign(S,{rtQ:'',rtRuta:'',rtOri:'',rtDes:'',rtCli:'',rtPcat:'',rtEst:'',rtCat:'',rtOrig:'',rtDest:''});render();},
  async rutaSolicitarOpen(){
    const oc=optsClientes(),c0=oc.length===1?oc[0].id:'',p0=c0&&optsProyectos({cliente:c0}).length===1?optsProyectos({cliente:c0})[0].id:'';
    formM({title:'Solicitar ruta nueva',text:'La ruta quedará NO ASIGNADA hasta que Comercial o Gerencia la revisen. No se inventa un código, un origen ni un destino: escribe lo que conoces.',
      fields:[{k:'cliente',label:'Cliente',type:'select',req:1,optsFn:()=>optsClientes(),ph:'Selecciona el cliente'},{k:'proyecto',label:'Proyecto',type:'select',req:1,optsFn:optsProyectos,ph:'Primero elige el cliente'},{k:'nombre',label:'Nombre o referencia de la ruta',req:1},{k:'origenProp',label:'Origen propuesto (si lo conoces)'},{k:'destinoProp',label:'Destino propuesto (si lo conoces)'}],
      data:{cliente:c0,proyecto:p0,nombre:'',origenProp:'',destinoProp:''},rerender:['cliente'],ok:'ENVIAR SOLICITUD',act:'rutaSolicitarSave'});
  },
  async rutaSolicitarSave(){const m=S.modal.data;const r=await run(()=>API.solicitarRuta(S.user.id,m),x=>`Ruta solicitada (${x.id}): queda NO ASIGNADA. Se avisó a Comercial y Gerencia dentro de la aplicación.`,true);if(r.ok)afterWrite();},
  async rutaRegistrarOpen(){
    formM({title:'Registrar ruta validada',text:'Se agrega directamente al catálogo como ASIGNADA.',
      fields:[{k:'codigo',label:'Código de la ruta',req:1},{k:'nombre',label:'Nombre de la ruta',req:1},{k:'cliente',label:'Cliente',type:'select',req:1,optsFn:()=>optsClientes(),ph:'Selecciona el cliente'},{k:'proyecto',label:'Proyecto',type:'select',req:1,optsFn:optsProyectos,ph:'Primero elige el cliente'},{k:'origenId',label:'Origen',type:'select',req:1,optsFn:optsOrigenes,ph:'Selecciona el origen'},{k:'destinoId',label:'Destino',type:'select',req:1,optsFn:optsDestinos,ph:'Primero elige el cliente'}],
      data:{codigo:'',nombre:'',cliente:'',proyecto:'',origenId:'',destinoId:''},rerender:['cliente'],ok:'REGISTRAR RUTA',act:'rutaRegistrarSave'});
  },
  async rutaRegistrarSave(){const m=S.modal.data;const r=await run(()=>API.registrarRuta(S.user.id,m),x=>`Ruta ${x.codigo} registrada.`,true);if(r.ok)afterWrite();},
  async rutaValidarOpen(d){
    const r=DB.rutas.find(x=>x.id===d.id);if(!r)return;
    formM({title:`Validar y asignar · ${r.nombre}`,text:`${esc((PROYECTOS.find(p=>p.id===r.cliente)||{}).cliente)} · ${esc(r.proyecto)}. Solicitada por ${esc(r.solicitadaPor)}.<br>Origen propuesto: <b>${esc(r.origenProp||'no indicado')}</b> · Destino propuesto: <b>${esc(r.destinoProp||'no indicado')}</b>. Al asignarla se completan el origen y el destino de los viajes que la usan.`,
      fields:[{k:'codigo',label:'Código de la ruta',req:1},{k:'origenId',label:'Origen (catálogo)',type:'select',req:1,optsFn:optsOrigenes,ph:'Selecciona el origen'},{k:'destinoId',label:'Destino (catálogo del cliente)',type:'select',req:1,optsFn:()=>optsDestinos({cliente:r.cliente}),ph:'Selecciona el destino'}],
      data:{codigo:'',origenId:'',destinoId:''},ok:'VALIDAR Y ASIGNAR',okCls:'ok',act:'rutaValidarOk',id:r.id});
  },
  async rutaValidarOk(d){const m=S.modal.data;const r=await run(()=>API.validarRuta(S.user.id,d.id,m),x=>`Ruta ${x.codigo} asignada: los viajes asociados ya tienen origen y destino.`,true);if(r.ok)afterWrite();},
  async rutaRechazarOpen(d){formM({title:'Rechazar ruta solicitada',text:'Explica por qué no se asigna. Quien la solicitó recibirá el aviso.',fields:[{k:'motivo',label:'Motivo del rechazo',type:'textarea',req:1}],ok:'RECHAZAR RUTA',okCls:'fix',act:'rutaRechazarOk',id:d.id});},
  async rutaRechazarOk(d){const r=await run(()=>API.rechazarRuta(S.user.id,d.id,S.modal.data.motivo),'Ruta rechazada.',true);if(r.ok)afterWrite();},
  async rutaAprobarComOpen(d){confirmM('¿Aprobar ruta por Gerencia Comercial?','La ruta solo se activará cuando Gerencia de Transporte también la apruebe. La tarifa definida y esta decisión quedan auditadas.','APROBAR RUTA','rutaAprobarComOk',d.id,'ok');},
  async rutaAprobarComOk(d){const r=await run(()=>API.aprobarRutaComercial(S.user.id,d.id),x=>x.estado==='ACTIVA'?'Ruta activa.':'Aprobación Comercial registrada; falta Transporte.',true);if(r.ok)afterWrite();},
  async rutaAprobarTraOpen(d){confirmM('¿Aprobar ruta por Gerencia de Transporte?','La ruta solo se activará cuando Gerencia Comercial también la apruebe. Esta decisión queda auditada.','APROBAR RUTA','rutaAprobarTraOk',d.id,'ok');},
  async rutaAprobarTraOk(d){const r=await run(()=>API.aprobarRutaTransporte(S.user.id,d.id),x=>x.estado==='ACTIVA'?'Ruta activa.':'Aprobación Transporte registrada; falta Comercial.',true);if(r.ok)afterWrite();},
  /* notificaciones */
  async notifOpen(){formM({title:'Notificaciones',text:'Los avisos aparecen solo dentro de la aplicación. Para enviarlos por correo o Teams hace falta configurar un servicio (por ejemplo, un flujo de Power Automate); hoy no hay ninguno.',summary:`<div id="notifbox">${notifHTML()}</div>`,noCancel:true,ok:'Cerrar',act:'closeModal'});},
  async notifLeer(d){await run(()=>API.marcarNotificacion(S.user.id,d.id));ACT.notifOpen();},
  /* clientes */
  async clienteOpen(d){
    const c=d.id?DB.clientes.find(x=>x.id===d.id):null;
    formM({title:c?`Editar cliente ${c.id}`:'Nuevo cliente',text:'Los datos fiscales que no tengas quedan como PENDIENTES: no se inventan. Un cliente nuevo no tiene rutas todavía; se asocian en Rutas.',
      fields:[{k:'id',label:'Código del cliente (ej. FRITOLAY)',req:1,ro:!!c},{k:'nombre',label:'Nombre corto',req:1},...(esAdm()?[]:[{k:'cliente',label:'Cliente (como aparece en la lista CLIENTES del catálogo)',req:1,hint:'Si es un cliente nuevo, agrégalo también a la hoja CATALOGO.'}]),
        {k:'nit',label:'Identificador fiscal (NIT) · pendiente si lo dejas vacío'},{k:'direccionFiscal',label:'Dirección fiscal'},{k:'correoFacturacion',label:'Correo de facturación',type:'email'},{k:'contacto',label:'Contacto comercial'},{k:'telefono',label:'Teléfono'},{k:'creditoDias',label:'Días de crédito',type:'number'},
        {k:'proyectos',label:'Proyectos del cliente',type:'checks',req:1,opts:CAT.proyectos.map(p=>({id:p,nombre:p}))},{k:'observaciones',label:'Observaciones',type:'textarea'},{k:'activo',label:'Cliente activo',type:'check'}],
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
  async clienteEstado(d){const c=DB.clientes.find(x=>x.id===d.id);if(!c)return;await run(()=>API.guardarCliente(S.user.id,Object.assign({},c,{existente:true,activo:c.activo===false})),`Cliente ${c.id} ${c.activo===false?'activado':'desactivado'}.`);render();},
  /* finanzas */
  async importeOpen(d){
    const t=DB.trips.find(x=>x.id===d.id);if(!t)return;
    formM({title:`Costo del proveedor · viaje #${d.id}`,text:`Importe por pagar a ${esc(t.opl||'el proveedor (OPL)')}.`,fields:[{k:'monto',label:'Costo (Q)',type:'number',req:1}],data:{monto:t[d.k]===''||t[d.k]==null?'':t[d.k]},ok:'GUARDAR',act:'importeOk',id:d.id,k:d.k});
  },
  async importeOk(d){const r=await run(()=>API.registrarImportes(S.user.id,d.id,{[S.modal.k]:S.modal.data.monto}),'Importe registrado.',true);if(r.ok)afterWrite();},
  async pagoOpen(d){
    const pil=d.tipo==='PILOTO';
    formM({title:pil?`Pago a piloto · viaje #${d.id}`:`Pago a proveedor · viaje #${d.id}`,text:'Registra un pago realizado. Un importe calculado no cuenta como pagado hasta que se registre aquí con su referencia.',fields:[{k:'monto',label:'Monto pagado (Q)',type:'number',req:1},{k:'fecha',label:'Fecha del pago',type:'date',req:1},{k:'referencia',label:'Referencia del pago',req:1}],data:{monto:'',fecha:todayStr(),referencia:''},ok:'REGISTRAR PAGO',okCls:'ok',act:'pagoOk',id:d.id,tipo:d.tipo});
  },
  async pagoOk(d){const m=S.modal.data,tipo=S.modal.tipo;const r=await run(()=>API.registrarPago(S.user.id,{tipo,viajeId:d.id,monto:m.monto,fecha:m.fecha,referencia:m.referencia}),p=>`Pago ${p.id} registrado.`,true);if(r.ok)afterWrite();},
  async anularPagoOpen(d){formM({title:`Anular pago ${d.id}`,text:'El pago se conserva marcado como anulado y deja de contar en los saldos.',fields:[{k:'motivo',label:'Motivo',type:'textarea',req:1}],ok:'ANULAR PAGO',okCls:'fix',act:'anularPagoOk',id:d.id});},
  async anularPagoOk(d){const r=await run(()=>API.anularPago(S.user.id,d.id,S.modal.data.motivo),'Pago anulado.',true);if(r.ok)afterWrite();},
  async finDet(d){let R;try{R=API.resumenFinanciero(S.user.id,finFilters());}catch(e){toast(e.message,'err');return;}const [title,html]=finDetail(d.k,R);formM({title,text:'Detalle que explica este total.',summary:html,noCancel:true,ok:'Cerrar',act:'closeModal'});},
  async autoNow(d){const el=document.getElementById('a_'+d.k);if(el){el.value=nowLocal();autoSave(d.id,d.k,el.value);}},
  async autoRetry(d){const el=document.getElementById('a_'+d.k);autoSave(d.id,d.k,el?el.value:(S.autoFail[d.id+'|'+d.k]||''));},
  /* administración */
  async usuarioOpen(d){
    const u=d.id?DB.usuarios.find(x=>x.id===d.id):null;
    formM({title:u?`Editar usuario ${u.id}`:'Nuevo usuario',text:'Contraseña de demostración: se guarda en el navegador y no es segura para producción.',
      fields:[{k:'nombre',label:'Nombre completo',req:1},{k:'usuario',label:'Usuario (nombre corto)',req:1},{k:'email',label:BACKEND.modo==='supabase'?'Correo con el que ingresa':'Correo (opcional)',type:'email',req:BACKEND.modo==='supabase'&&!u,ro:BACKEND.modo==='supabase'&&!!u},{k:'clave',label:u?(BACKEND.modo==='supabase'?'(la contraseña se cambia desde Supabase Auth)':'Nueva contraseña (opcional)'):(BACKEND.modo==='supabase'?'Contraseña inicial (mínimo 8 caracteres)':'Contraseña'),type:'password',req:!u,ro:BACKEND.modo==='supabase'&&!!u},
        {k:'rol',label:'Rol',type:'select',req:1,opts:Object.keys(ROLES).map(r=>({id:r,nombre:ROLES[r].label}))},
        {k:'clientes',label:'Clientes asignados (encargado de proyecto)',type:'checks',opts:DB.clientes.map(c=>({id:c.id,nombre:c.nombre}))},
        {k:'proyectos',label:'Proyectos asignados (si eliges alguno, solo verá los viajes y rutas de esos proyectos)',type:'checks',opts:CAT.proyectos.map(p=>({id:p,nombre:p}))},
        {k:'activo',label:'Usuario activo',type:'check'}],
      data:u?{nombre:u.nombre,usuario:u.usuario,email:u.email||'',clave:'',rol:u.rol,clientes:clientesAsig(u).slice(),proyectos:(u.proyectos||[]).slice(),activo:u.activo}:{nombre:'',usuario:'',email:'',clave:'',rol:'ENCARGADO',clientes:[],proyectos:[],activo:true},
      ok:'GUARDAR',act:'usuarioSave',id:d.id});
  },
  async usuarioSave(d){const m=S.modal.data;const r=await run(()=>API.guardarUsuario(S.user.id,{id:d.id||'',nombre:m.nombre,usuario:m.usuario,email:m.email,clave:m.clave,rol:m.rol,clientes:m.clientes,proyectos:m.proyectos,activo:m.activo}),'Usuario guardado.',true);if(r.ok)afterWrite();},
  async verificarAud(){try{S.verif=await API.verificarAuditoria(S.user.id);}catch(e){toast(e.message,'err');}render();}
};


/* ---------- Eventos ---------- */
const app=$('#app');
app.addEventListener('click',e=>{
  const el=e.target.closest('[data-act]');
  if(!el){if(S.cb&&!e.target.closest('.cb')){S.cb=null;S.cbq='';render();}return;}
  const fn=ACT[el.dataset.act];
  if(fn)Promise.resolve().then(()=>fn(el.dataset,el,e)).catch(err=>{console.error(err);toast('Error inesperado: '+err.message,'err');render();});
});
app.addEventListener('keydown',e=>{
  if((e.key==='Enter'||e.key===' ')&&e.target.matches('[role=button][data-act]')){e.preventDefault();e.target.click();}
  if(e.key==='Escape'&&(S.modal||S.menu)){S.modal=null;S.menu=false;render();}
  if(e.key==='Enter'&&(e.target.id==='u'||e.target.id==='p')){e.preventDefault();doLogin();}
});
app.addEventListener('submit',e=>{e.preventDefault();doLogin();});
app.addEventListener('change',async e=>{
  const t=e.target;
  if(t.dataset.status){statusSave(t.dataset.status,t);return;}
  if(t.dataset.torre){await run(()=>API.guardarReglasTorre(S.user.id,{cliente:t.dataset.torre,torreEstatus:t.checked}),'Regla de Torre actualizada.');render();return;}
  if(t.dataset.torreop){const ops=[...document.querySelectorAll('input[data-torreop]:checked')].map(x=>x.dataset.torreop);await run(()=>API.guardarOpcionesTorre(S.user.id,{opciones:ops}),'Estatus autorizados actualizados.');render();return;}
  if(t.dataset.mfile&&S.modal){const f=t.files&&t.files[0];if(!f)return;if(f.size>2000000){S.modal.err='El archivo supera 2 MB.';render();return;}const k=t.dataset.mfile;const rd=new FileReader();rd.onload=()=>{S.modal.data[k]=rd.result;S.modal.err='';render();};rd.readAsDataURL(f);return;}
  if(t.dataset.auto){autoSave(t.dataset.id,t.dataset.auto,t.value);return;}
  if(t.dataset.photo){const f=t.files&&t.files[0];if(!f)return;const d=await readPhoto(f);if(d){S.draft[t.dataset.photo]=d;render();}return;}
  if(t.dataset.m){
    const M=curModel();if(!M)return;
    if(usaCombo()){aplicarCampo(M,t.dataset.m,t.value);if(t.tagName==='SELECT'||t.type==='datetime-local')render();return;}
    const k=t.dataset.m;M[k]=t.value;if('err' in M)M.err='';
    if(k==='proyecto'){M.proyectoCat='';M.pilotoId='';M.rutaId='';M.rutaRef='';const pc=PROYECTOS_X[M.proyecto];if(pc&&pc.length===1)M.proyectoCat=pc[0];}
    if(k==='proyectoCat'){M.rutaId='';M.rutaRef='';}
    if(k==='pilotoId'&&t.value)S.flash=true;
    if(t.tagName==='SELECT'||t.type==='datetime-local')render();
    return;
  }
  if(t.dataset.mf&&S.modal){const k=t.dataset.mf;S.modal.data[k]=t.type==='checkbox'?t.checked:t.value;
    if(S.modal.rerender&&S.modal.rerender.includes(k)){if(k==='cliente'){S.modal.data.proyecto='';S.modal.data.rutaId='';S.modal.data.destinoId='';}if(k==='proyecto')S.modal.data.rutaId='';render();return;}
    updateLive();return;}
  if(t.dataset.mfm&&S.modal){const k=t.dataset.mfm,a=S.modal.data[k]||[];S.modal.data[k]=t.checked?[...new Set([...a,t.value])]:a.filter(x=>x!==t.value);return;}
  if(t.dataset.sel){const id=t.dataset.sel;S.sel=t.checked?[...new Set([...S.sel,id])]:S.sel.filter(x=>x!==id);$('#vb').innerHTML=BODY.comercial();return;}
  if(t.dataset.selall){
    const pend=comFiltered().filter(x=>x.estado==='ACEPTADO');
    if(!t.checked){S.sel=S.sel.filter(id=>!pend.some(x=>x.id===id));}
    else if(new Set(pend.map(x=>x.proyecto)).size>1){toast('Filtra por un cliente para seleccionar todos: no se pueden mezclar clientes.','err');}
    else S.sel=[...new Set([...S.sel,...pend.map(x=>x.id)])];
    $('#vb').innerHTML=BODY.comercial();return;
  }
  if(t.dataset.flt){S[t.dataset.flt]=t.value;render();return;}
  if(t.dataset.fltchk){S[t.dataset.fltchk]=t.checked;render();return;}
  if(t.dataset.perm){
    const [rol,perm]=t.dataset.perm.split('|');
    await run(()=>API.setPermiso(S.user.id,rol,perm,t.checked),'Permiso actualizado.');
    render();return;
  }
});
app.addEventListener('input',e=>{
  const t=e.target;
  if(t.dataset.cbq){S.cbq=t.value;const l=document.querySelector('.cb[data-cb="'+t.dataset.cbq+'"] .cb-list');if(l)l.innerHTML=cbListHTML(t.dataset.cbq);return;}
  if(t.dataset.mf&&S.modal&&t.type!=='checkbox'&&t.tagName!=='SELECT'){S.modal.data[t.dataset.mf]=t.value;updateLive();}
  if(t.dataset.live){S[t.dataset.live]=t.value;const fn=S.view==='comercial'?(S.tab.com==='hist'?BODY.hist:S.tab.com==='tar'?BODY.tarifas:BODY.comercial):BODY[S.view];const vb=document.getElementById('vb');if(fn&&vb)vb.innerHTML=fn();}
  if(t.dataset.motivo&&S.edit)S.edit.motivo=t.value;
  if(t.id==='q'){S.q=t.value;if(BODY[S.view]&&$('#vb'))$('#vb').innerHTML=BODY[S.view]();}
});
window.addEventListener('popstate',()=>{
  if(!S.user)return;
  const h=(location.hash||'').replace('#','').split('/');const v=h[0]||homeOf(S.user);
  S.view=VIEWS[v]&&allowed(v)?v:homeOf(S.user);S.param=h[1]||null;S.modal=null;S.menu=false;S.edit=null;S._lv=null;render();
});
setInterval(()=>{
  document.querySelectorAll('[data-since]').forEach(el=>{el.textContent=elapsed(el.dataset.since);});
  const c=$('#clock');if(c)c.textContent=new Date().toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit',hour12:false});
},30000);

BACKEND.iniciar();
