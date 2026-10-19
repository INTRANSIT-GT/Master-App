/* =====================================================================
   INTERFAZ  (solo muestra datos y llama a API.*; nunca escribe en DB)
   ===================================================================== */
Object.assign(ICON,{
  bell:'<path d="M6 9a6 6 0 1112 0c0 5 2 6 2 7H4c0-1 2-2 2-7z"/><path d="M10 20a2 2 0 004 0"/>',
  dollar:'<path d="M12 3v18M16 7.5c0-1.7-1.8-3-4-3s-4 1.3-4 3 1.8 2.8 4 3.2 4 1.5 4 3.3-1.8 3-4 3-4-1.3-4-3"/>',
  shield:'<path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M9 12l2 2 4-4"/>',
  file:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>'
});
const S={edit:null,user:null,view:'login',param:null,tab:{},form:null,draft:{},modal:null,menu:false,flash:false,q:'',fEstado:'',fProy:'',tProy:'',fCli:'',fPcat:'',fCom:'PEND',sel:[],from:null,loginErr:'',loginU:'',_lv:null,_lp:null,verif:null,aEnt:'',aRech:false,sortL:null,sortF:null,fDesde:'',fHasta:'',fProv:'',autoFail:{},fcCli:'',fcPcat:'',fcMes:'',fcSem:'',fcFecha:'',fcDesde:'',fcHasta:'',fcFechas:[],fcQ:'',fcEstado:'ENV',fcBase:'envio',tfQ:'',tfCli:'',tfPcat:'',tfCap:'',tfEst:'',rtQ:'',rtRuta:'',rtOri:'',rtDes:'',rtCli:'',rtPcat:'',rtEst:'',cb:null,cbq:'',opSoloOpl:false,opSel:{},pag:{}};
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
const rolDe=r=>(ROLES[r]||{label:String(r||'Sistema'),home:'inicio',nav:[]});
const homeOf=u=>rolDe(u&&u.rol).home;
function allowed(v){
  if(!S.user)return false;
  if(v==='detalle')return true;
  if(v==='proyecto')return allowed('proyectos');
  return rolDe(S.user.rol).nav.includes(v)&&(!VIEW_PERM[v]||hp(VIEW_PERM[v]));
}
const navItems=()=>rolDe(S.user.rol).nav.filter(v=>allowed(v));

/* ---------- Componentes ---------- */
/* Colores de estado: UNA sola tabla. Cada estado del proceso trae su color en ESTADOS (clase CSS st-<ESTADO>). */
const TONO_RUTA={PENDIENTE:'alert',EN_TARIFACION:'progress',PENDIENTE_APROBACION:'progress',ACTIVA:'done',RECHAZADA:'alert'};
const chip=(tono,label)=>`<span class="stc tn-${tono}">${esc(label)}</span>`;
const badge=e=>`<span class="stc st-${esc(e)}">${esc(ESTADOS[e]?ESTADOS[e].l:e)}</span>`;
const rutaChip=e=>chip(TONO_RUTA[e]||'neutral',{PENDIENTE:'PENDIENTE',EN_TARIFACION:'EN TARIFACIÓN',PENDIENTE_APROBACION:'PENDIENTE APROBACIÓN',ACTIVA:'ACTIVA',RECHAZADA:'RECHAZADA'}[e]||e);
const vroute=j=>`<div class="vroute"><span class="d o"></span><span>${esc(j.origen)}</span><span class="d t"></span><span>${esc(j.destino)}</span></div>`;
/* El botón de usuario muestra SOLO el perfil: la lista de clientes no va ahí (quedaba con códigos internos
   del tipo CIT-U0001 y no aporta: los clientes de cada perfil se ven en Usuarios y permisos). */
const cliLista=()=>'';

/* ---- Perfil «Encargado de proyecto»: los ajustes de esta versión SOLO se aplican a este rol; los demás perfiles ven exactamente lo mismo que antes ---- */
const esEnc=()=>!!S.user&&S.user.rol==='OPERATIVO';
/* ---- Perfil «Administrador»: Clientes, Facturación, Nuevo viaje y Rutas. Cada cambio está condicionado a este rol; los demás perfiles quedan igual. ---- */
const esAdm=()=>!!S.user&&S.user.rol==='ADMIN';
const usaCombo=()=>esEnc()||esAdm();                   /* desplegables de Proyecto y Ruta del formulario de viaje */
const CBLIM={fcViaje:300},CBEMPTY={cliFiltro:'No se encontraron clientes'},CBNORM={cliFiltro:1};   /* mensajes y búsqueda sin acentos propios de cada desplegable; los demás no cambian */                              /* listas muy largas: se muestran las primeras N y se invita a escribir para acotar */
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
    <div class="tc-top"><span class="num">Viaje #${t.id}</span><span class="bgs">${badge(t.estado)}</span></div>
    <div class="tc-proj"><span class="pchip sm">${esc(j.proyectoNombre)}</span>${t.estado==='EN_RUTA'?`<span><span class="pulse"></span><span data-since="${since(t)}">${elapsed(since(t))}</span></span>`:`<span class="mute">Plan ${fmtL(t.fechaPlan)}</span>`}</div>
    ${vroute(j)}
    <dl class="meta"><dt>Piloto</dt><dd>${esc(j.piloto)}</dd><dt>Unidad / placa</dt><dd>${esc(j.f.unidad)} · ${esc(j.f.placa)}</dd></dl>
    ${t.estado==='RECHAZADO'?`<div class="alertbox"><b>Rechazo #${t.rechazos||1}:</b> ${esc(t.comentarioRevision)}</div>`:''}
    <div class="actions"><button class="btn primary sm" data-act="detalle" data-id="${t.id}">VER DETALLE</button></div>
  </article>`;
}
function tableHTML(ts,extra,key='todos'){
  if(!ts.length)return empty('Sin viajes con este filtro','Cambia el estado o el cliente para ver más resultados.');
  const pg=paginar(key,ts);
  return `<div class="tablewrap scrollx"><table class="resp"><thead><tr><th>Viaje</th><th>Fecha plan</th><th>Cliente</th><th>Origen → destino</th><th>Piloto</th><th>Unidad / placa</th>${extra?`<th>${extra.h}</th>`:''}<th>Estado</th></tr></thead><tbody>
  ${pg.filas.map(t=>{const j=J(t);return `<tr role="button" tabindex="0" data-act="detalle" data-id="${t.id}"><td data-l="Viaje"><span class="num">#${t.id}</span></td><td data-l="Fecha plan">${fmtL(t.fechaPlan)}</td><td data-l="Cliente"><span class="pchip sm">${esc(j.proyectoNombre)}</span></td><td data-l="Ruta">${esc(j.origen)} → ${esc(j.destino)}</td><td data-l="Piloto">${esc(j.piloto)}</td><td data-l="Unidad">${esc(j.f.unidad)} · ${esc(j.f.placa)}</td>${extra?`<td data-l="${extra.h}">${extra.f(t)}</td>`:''}<td data-l="Estado">${badge(t.estado)}</td></tr>`;}).join('')}
  </tbody></table></div>${paginador(key,pg)}`;
}
function statBar(ts){
  const tot=ts.length||1,ks=Object.keys(ESTADOS);
  return `<div class="pbar" role="img" aria-label="Distribución por estado">${ks.map(e=>{const n=cnt(ts,t=>t.estado===e);return n?`<i style="width:${n/tot*100}%;background:${ESTADOS[e].c}" title="${ESTADOS[e].l}: ${n}"></i>`:'';}).join('')}</div>
  <div class="legend">${ks.map(e=>{const n=cnt(ts,t=>t.estado===e);return n?`<span><i class="dot" style="background:${ESTADOS[e].c}"></i>${ESTADOS[e].l} ${n}</span>`:'';}).join('')}</div>`;
}
const matchE=(t,f)=>!f||(f==='FIN'?FIN.includes(t.estado):t.estado===f);
/* ---------- Paginación de listas largas ----------
   En equipos con miles de filas, pintar la tabla completa traba el navegador. Cada lista larga se muestra por
   páginas. Con listas pequeñas (menos que PAGINA) se devuelve el MISMO arreglo y sin controles, así la salida es
   idéntica a la de antes (no cambia lo que ya funcionaba). */
const PAGINA=100;
const paginar=(k,a)=>{const total=a?a.length:0,n=Math.max(1,Math.ceil(total/PAGINA)),p=Math.min(Math.max(1,Math.floor(S.pag[k]||1)),n);return{filas:total<=PAGINA?a:(a||[]).slice((p-1)*PAGINA,p*PAGINA),p,n,total};};
const paginador=(k,pg)=>{
  if(pg.n<=1)return'';
  const desde=(pg.p-1)*PAGINA+1,hasta=Math.min(pg.p*PAGINA,pg.total);
  const b=(np,l,dis)=>`<button type="button" class="btn sm" data-act="pagina" data-k="${k}" data-p="${np}" ${dis?'disabled':''}>${l}</button>`;
  return `<div class="pager" style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:10px 0"><span class="mute">Mostrando ${desde}–${hasta} de ${pg.total}</span>${b(1,'«',pg.p<=1)}${b(pg.p-1,'‹ Anterior',pg.p<=1)}<span class="mute">Página ${pg.p} de ${pg.n}</span>${b(pg.p+1,'Siguiente ›',pg.p>=pg.n)}${b(pg.n,'»',pg.p>=pg.n)}</div>`;
};
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
  opl:{s:'scr_OPL',d:'TARIFAS · VIAJES · ÓRDENES_PAGO',f:'Filter(TARIFAS; Proyecto in gblProyectosAsignados)',n:'Solo el proceso del proveedor (OPL): no expone la tarifa de cobro al cliente.'},
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
  const demo=sb?'':DB.usuarios.filter(u=>u.activo).map(u=>`<button type="button" data-act="fill" data-u="${u.usuario}"><b>${esc(first(u.nombre))}</b><small>${esc(rolL(u.rol))}${cliLista(u)}</small></button>`).join('');
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
  const u=S.user;cargaHistorico();
  const cls=clientesAsig(u).map(id=>PROYECTOS.find(p=>p.id===id)).filter(Boolean),all=vis(),ts=S.inicioProy?all.filter(t=>t.proyecto===S.inicioProy):all;
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
    <section class="section"><h2>Viajes por mes · por estado</h2>
      <div class="card"><div id="chartMes">${historicoMeses()||(S.finHistCargando?'<div class="mute">Calculando el resumen de tus viajes…</div>':histVacio())}</div>
      <div class="mute" style="font-size:12.5px;margin-top:8px">Tus viajes por <b>fecha plan</b> (todos, no solo los cargados en pantalla), divididos por estado con el color de cada estado. Pasa el cursor por un tramo para ver el número; un mes «todo verde» ya está liquidado, facturado o cobrado.</div></div>
    </section>
    <section class="section"><h2>Requiere tu atención</h2>${act.length?`<div class="cards">${act.map(tripCard).join('')}</div>`:empty('Todo al día','No tienes viajes esperando una acción.')}</section>
  </div>`;
};

/* ---- Selector desplegable con búsqueda (listas largas de clientes/proyectos) ---- */
const CBOPTS={},CBVAL={};
function cbListHTML(flt){
  const opts=CBOPTS[flt]||[],q=CBNORM[flt]?normTxt(S.cbq||''):(S.cbq||'').toLowerCase(),cur=String(flt).startsWith('m:')?CBVAL[flt]:S[flt];
  const list=opts.filter(o=>!q||(CBNORM[flt]?normTxt(o.nombre):String(o.nombre).toLowerCase()).includes(q));
  const lim=CBLIM[flt],vista=lim?list.slice(0,lim):list;
  return list.length?vista.map(o=>`<button type="button" role="option" data-act="cbPick" data-k="${flt}" data-v="${esc(o.id)}" aria-selected="${o.id===cur}">${esc(o.nombre)}</button>`).join('')+(lim&&list.length>lim?`<div class="cb-empty">Mostrando ${lim} de ${list.length}: escribe para acotar</div>`:''):'<div class="cb-empty">'+(CBEMPTY[flt]||'Sin resultados')+'</div>';
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
  if(t.estado==='PLANIFICADO'&&hp('viajes_iniciar')&&mine(t))a+=b('iniciarAsk','En ruta','primary');
  if(t.estado==='EN_RUTA'&&hp('viajes_finalizar')&&mine(t))a+=b('finalizarAsk','Entregado','primary');
  if(['ENTREGADO','RECHAZADO'].includes(t.estado)&&hp('liq_enviar')&&mine(t))a+=b('detalle',t.estado==='RECHAZADO'?'Corregir':'Liquidar','primary');
  if(t.estado==='LIQUIDADO'&&hp('liq_aprobar'))a+=b('aprobarAsk','Aceptar','ok');
  if(t.estado==='LIQUIDADO'&&hp('liq_devolver'))a+=b('devolverOpen','Rechazar','fix');
  if(['ENTREGADO','RECHAZADO'].includes(t.estado)&&hp('viajes_aprobar_duplicado')&&String(t.shipment||'').trim()&&!/^DUP-/i.test(t.shipment))a+=b('shipmentDupOpen','Aprobar DUP','fix');
  return a;
}
/* ---- Gráfica de barras apiladas: viajes por mes, divididos por estado ----
   Sin librerías: SVG a mano. Cada segmento usa el color del estado (la clase .st-XXX define --tone),
   así la gráfica respeta los mismos colores que las etiquetas de la app. */
function chartMeses(porMes,meses,opts){
  opts=opts||{};
  const orden=(typeof ESTADOS==='object'?Object.keys(ESTADOS):['PLANIFICADO','EN_RUTA','ENTREGADO','LIQUIDADO','RECHAZADO','ACEPTADO','FACTURADO','COBRADO']);
  const lista=(meses||Object.keys(porMes||{}).sort()).filter(m=>porMes&&porMes[m]);
  if(!lista.length)return '';
  const total=m=>orden.reduce((s,k)=>s+(porMes[m][k]||0),0);
  const max=Math.max(1,...lista.map(total));
  const W=760,H=240,PB=26,PT=18,ancho=W/lista.length;
  const barra=Math.max(10,ancho*0.62);
  const mesL=m=>{const [a,b]=m.split('-');return ['ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'][Number(b)-1]+' '+a.slice(2);};
  let svg=`<svg class="chart-meses" viewBox="0 0 ${W} ${H}" width="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Viajes por mes según su estado" style="display:block">`;
  lista.forEach((m,i)=>{
    const x=i*ancho+ancho/2, t=total(m), altoTot=(H-PT-PB)*(t/max);
    let y=H-PB-altoTot;
    orden.forEach(k=>{
      const n=porMes[m][k]||0;if(!n)return;
      const alto=(H-PT-PB)*(n/max);
      svg+=`<rect class="st-${k}" x="${(x-barra/2).toFixed(1)}" y="${y.toFixed(1)}" width="${barra.toFixed(1)}" height="${alto.toFixed(1)}" ><title>${mesL(m)} · ${(ESTADOS[k]||{}).l||k}: ${n}</title></rect>`;
      y+=alto;
    });
    svg+=`<text x="${x.toFixed(1)}" y="${(H-PB-altoTot-5).toFixed(1)}" text-anchor="middle" font-size="12" fill="#44556B">${t}</text>`;
    svg+=`<text x="${x.toFixed(1)}" y="${H-8}" text-anchor="middle" font-size="12" fill="#44556B">${mesL(m)}</text>`;
  });
  svg+='</svg>';
  return svg;
}
function leyendaMeses(){
  return `<div class="bgs" style="margin-top:8px">${Object.keys(ESTADOS).map(k=>`<span class="est leyenda-est st-${k}">${esc(ESTADOS[k].l)}</span>`).join('')}</div>`;
}
/* ---- Resumen de toda la base: se pide una sola vez por sesión y lo usan Inicio y Finanzas ----
   (El servidor lo calcula sobre los viajes que este usuario puede ver, así que respeta el alcance del perfil.) */
function cargaHistorico(){
  if(S.finHist!==undefined||S.finHistCargando||typeof API.resumenHistorico!=='function')return;
  S.finHistCargando=true;S.finHistErr='';
  Promise.resolve().then(()=>API.resumenHistorico(S.user.id,{}))
    .then(h=>{
      S.finHist=h||null;S.finHistCargando=false;
      /* Se actualiza solo la gráfica (no toda la pantalla): así no se pierde el clic de quien está navegando. */
      const el=$('#chartMes');
      if(el)el.innerHTML=historicoMeses()||histVacio();
      else render();
    })
    /* Si el resumen no se pudo calcular se guarda el motivo y se muestra en la gráfica: así el problema
       (servidor sin desplegar, sin permiso, dato raro) se ve en pantalla y no queda un hueco mudo. */
    .catch(e=>{S.finHist=null;S.finHistCargando=false;S.finHistErr=(e&&e.message)||(typeof e==='string'?e:'No se pudo consultar el resumen.');});
}
function historicoMeses(){
  const pm=S.finHist&&S.finHist.porMes;if(!pm)return '';
  const ms=Object.keys(pm).sort().slice(-12);if(!ms.length)return '';
  return chartMeses(pm,ms)+leyendaMeses();
}
/* Motivo por el que la gráfica no tiene datos + botón para volver a pedirlos. */
function histVacio(){
  const n=S.finHist&&Number(S.finHist.viajes)||0;
  const motivo=S.finHistErr?'No se pudo consultar el resumen en el servidor.'
    :n?'Se leyeron '+n+' viajes, pero ninguno tiene fecha plan (la gráfica los agrupa por esa fecha).'
    :'Aún no hay viajes registrados.';
  return '<div class="mute">'+esc(motivo)+'</div>'
    +(S.finHistErr?'<div class="mute" style="margin-top:6px;font-size:12.5px">'+esc(String(S.finHistErr).slice(0,240))+'</div>':'')
    +'<div style="margin-top:10px"><button class="btn sm" data-act="histReintentar">Reintentar</button></div>';
}

/* ---- Ventana de viajes: qué está cargado y poder traer los anteriores ----
   Solo aparece cuando el servidor informa la ventana (Supabase). En demostración no hay ventana: se ve todo. */
const PAGINA_VIEJOS=400;
function ventanaBar(){
  const v=DB.ventana;if(!v)return '';
  const restantes=Math.max(0,(v.enBase||0)-(DB.trips||[]).length);
  const btn=S.cargandoViejos?'<button class="btn sm ghost" disabled>Cargando…</button>'
    :(restantes&&!S.viejoFin?`<button class="btn sm" data-act="cargarViejos">Cargar anteriores (${Math.min(restantes,PAGINA_VIEJOS)})</button>`:'<span class="mute">Histórico completo cargado</span>');
  return `<div class="alertbox info" style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-bottom:10px">
    <span>Cargados <b>${(DB.trips||[]).length}</b> de <b>${v.enBase||(DB.trips||[]).length}</b> viajes · últimos ${v.meses||VENTANA_MESES_PANTALLA} meses y los que están en curso${restantes?` · <b>${restantes}</b> más antiguos sin cargar`:''}</span>
    <span style="margin-left:auto">${btn}</span></div>`;
}
const VENTANA_MESES_PANTALLA=3;
function viajesTable(list,key='viajes'){
  if(!list.length)return empty('No hay viajes en esta pestaña','Cuando un viaje cambie de estado aparecerá aquí.');
  const pg=paginar(key,list);
  /* Los Shipment duplicados se cuentan UNA vez por pantalla: antes se recorría toda la tabla de viajes por cada
     fila dibujada, y con miles de viajes eso se notaba en cada render. */
  const cuenta=new Map();
  for(const t of DB.trips){const s=String(t.shipment||'').trim().toLowerCase();if(!s||s.startsWith('dup-'))continue;cuenta.set(s,(cuenta.get(s)||0)+1);}
  const esDup=t=>{const s=String(t.shipment||'').trim().toLowerCase();return !!s&&!s.startsWith('dup-')&&(cuenta.get(s)||0)>1;};
  return ventanaBar()+`<div class="xlwrap"><table class="xl" style="min-width:1400px"><thead><tr><th class="stk">Viaje</th><th>Fecha plan</th><th>Cliente</th><th>Proyecto</th><th>Ruta</th><th>Piloto</th><th>Unidad · placa</th><th>Estado</th><th class="stkR">Acciones</th></tr></thead><tbody>
  ${pg.filas.map(t=>{const j=J(t),dup=esDup(t);return `<tr><td class="stk"><button class="linkbtn" data-act="detalle" data-id="${t.id}">#${t.id}</button></td><td>${fmtL(t.fechaPlan)}</td><td>${esc(j.cliente)}</td><td>${esc(t.proyectoCat)}</td><td style="white-space:normal;min-width:220px">${rutaHTML(t)}</td><td>${esc(j.piloto)}</td><td>${esc(j.f.unidad)} · ${esc(j.f.placa)}</td><td class="${dup?'warnl':''}">${badge(t.estado)}${dup?' <b>Shipment duplicado</b>':''}</td><td class="stkR">${accionesViaje(t)}</td></tr>`;}).join('')}
  </tbody></table></div>${paginador(key,pg)}`;
}

/* ---- Detalle del viaje ---- */
function uploadBlock(t){
  const d=S.draft[t.id],corr=t.estado==='RECHAZADO';
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
const editGroups=t=>['cliente','plan','unidad','ruta','tiempos','otros'].filter(g=>g==='plan'||g==='tiempos'?canEditT(t):canEditD(t));
function editView(t){
  const E=S.edit,soloT=!canEditD(t);
  return `<div class="inner form" style="max-width:860px">
    <button class="btn ghost sm" data-act="editCancel" style="margin-bottom:12px">${icon('back',16)} Cancelar edición</button>
    ${pageHead('Editar viaje #'+t.id,soloT?'Puedes actualizar la fecha plan y los horarios. El estado y los demás datos son de solo lectura'+(esEnc()?'.':' para tu perfil.'):'Actualiza datos, fechas y horarios del viaje.')}
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
  el.innerHTML=st==='saving'?'Guardando…':st==='saved'?'✓ Guardado':`<span>⚠ ${esc(msg||'No se guardó')}</span> <button class="linkbtn" data-act="autoRetry" data-k="${esc(k)}" data-id="${esc(S.param)}">Reintentar</button>`;
}
function refreshDurs(id){const b=document.getElementById('durs_box');if(!b)return;try{b.innerHTML=dursHTML(API.viaje(S.user.id,id));}catch(e){}}
async function autoSave(id,k,v){
  v=String(v==null?'':v).trim();
  const key=id+'|'+k;
  if(AUTOBUSY[key]===v)return;                                   /* evita registros duplicados */
  if(v!==''&&!RX_DT.test(v)){S.autoFail[key]=v;setInd(k,'error','Fecha y hora no válidas.');return;}
  if(k==='fechaPlan'&&v===''){S.autoFail[key]=v;setInd(k,'error','La fecha plan no puede quedar vacía.');return;}
  let cur;try{cur=API.viaje(S.user.id,id);}catch(e){setInd(k,'error',e.message);return;}
  if(String(cur[k]||'')===v){delete S.autoFail[key];setInd(k,'saved');return;}      /* sin cambios: no se registra nada */
  AUTOBUSY[key]=v;setInd(k,'saving');
  try{
    await API.editarViaje(S.user.id,id,{[k]:v},'');                      /* sin comentario ni botón de guardar */
    delete S.autoFail[key];setInd(k,'saved');refreshDurs(id);
  }catch(e){
    S.autoFail[key]=v;setInd(k,'error',e.message);               /* el valor se conserva en el campo para reintentar */
  }finally{delete AUTOBUSY[key];}
}
const moneyCard=(t)=>{
  const verF=hp('finanzas_ver'),dash='<span class="mute">Sin registrar</span>';
  const tf=nn(t.tarifaCliente),cp=nn(t.costoProveedor),vi=nn(t.qViaticos);
  const falta=[tf==null?'tarifa del cliente':'',cp==null?'costo de proveedor':'',vi==null?'viáticos':''].filter(Boolean);
  let pagos=[];if(verF)try{pagos=API.pagosDeViaje(S.user.id,t.id);}catch(e){}
  const tp=tarifaPara(t),puedeAplicar=hp('tarifa_registrar')&&t.estado==='ACEPTADO'&&!t.agrupacionId;
  return `<div class="card"><h3>Importes del viaje</h3><dl class="kv">
    <dt>Tarifa del cliente</dt><dd>${tf==null?(tp.err?`<span class="warnl">⚠ Sin tarifa válida</span>`:dash):qfmt(tf)}${t.tarifaId?` <span class="mute" style="font-weight:500">· ${esc(t.tarifaId)}</span>`:''} ${puedeAplicar&&!tp.err&&String(tf)!==String(tp.t.importe)?`<button class="btn sm primary" data-act="aplicarTarifaViaje" data-id="${t.id}">Aplicar tarifa vigente</button>`:''}</dd>
    ${tf==null&&tp.err&&hp('comercial_ver')?`<dt>Revisión</dt><dd class="mute" style="font-weight:500">${esc(tp.err)}</dd>`:''}
    ${verF?`<dt>Tarifa proveedor (${esc(t.opl||'sin OPL')})</dt><dd>${nn(t.tarifaOpl)==null?'<span class="mute">Sin tarifa de OPL</span>':qfmt(t.tarifaOpl)}${nn(t.tarifaOpl)!=null&&nn(t.tarifaOplBase)!=null&&nn(t.ajusteOpl)?` <span class="mute" style="font-weight:500">· base ${qfmt(t.tarifaOplBase)} + combustible ${qfmt(t.ajusteOpl)}</span>`:''}</dd>
    <dt>Costo proveedor registrado</dt><dd>${cp==null?dash:qfmt(cp)} ${hp('costos_registrar')&&FIN.includes(t.estado)?`<button class="btn sm" data-act="importeOpen" data-id="${t.id}" data-k="costoProveedor">${cp==null?'Registrar':'Cambiar'}</button>`:''}</dd>
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
        ${kvr('Ruta',rutaHTML(t))}${kvr('Fecha plan',fmtL(t.fechaPlan))}${kvr('Estado',badge(t.estado))}
        ${t.estado==='EN_RUTA'?kvr('Tiempo transcurrido',`<span class="elapsed" data-since="${since(t)}">${elapsed(since(t))}</span>`):''}
        ${kvr('No. doc retorno',v(t.noDocRetorno))}${'qViaticos' in t?kvr('Q viáticos',t.qViaticos!==''&&t.qViaticos!=null?'Q '+esc(t.qViaticos):dash):''}`;
  const horarios=rev?'':`<div class="card" style="grid-column:1/-1"><h3>Horarios del viaje</h3>
        <dl class="kv" style="grid-template-columns:repeat(2,minmax(0,170px) minmax(0,1fr));gap:8px 14px">${CAMPOS_TIEMPO.map(([k,l])=>kvr(lblT(l),t[k]?fmtL(t[k]):dash)).join('')}</dl>
        ${hp('comercial_agrupar')?'<div class="mute" style="margin-top:8px;font-size:13px">Datos del viaje: solo lectura para tu perfil.</div>':`<h3 style="margin:14px 0 0;font-size:14px">Tiempos calculados</h3><div id="durs_box">${dursHTML(t)}</div>`}</div>`;
  return `<div class="inner">
    <button class="btn ghost sm" data-act="back" style="margin-bottom:12px">${icon('back',16)} ${esc(fromLbl)}</button>
    ${pageHead('Viaje #'+t.id,`<span class="pchip sm">${esc(j.proyectoNombre)}</span> &nbsp;${esc(j.cliente)}`,`<span class="bgs">${badge(t.estado)}</span>${editBtn}`)}
    ${t.estado==='RECHAZADO'?`<div class="alertbox" style="margin-bottom:14px;padding:14px 16px"><b>Rechazo #${t.rechazos||1}</b><div style="margin:6px 0;font-size:16px">${esc(t.comentarioRevision)}</div><span class="mute" style="font-size:13px">${esc(t.revisadoPor)} · ${fmtDT(t.revisadoEn)}</span></div>`:''}
    <div class="hroute"><div class="pt"><small>Origen</small><b>${esc(j.origen)||'Pendiente de asignar'}</b></div><div class="line"></div><div class="pt"><small>Destino</small><b>${esc(j.destino)||'Pendiente de asignar'}</b></div></div>
    <div class="card next"><h3>Siguiente paso</h3>${nextStep(t)}</div>
    <div class="detgrid">
      <div class="card"><h3>Datos del viaje</h3><dl class="kv">${datos}</dl></div>
      <div class="card"><h3>Piloto y unidad</h3><dl class="kv">
        ${kvr('Piloto',esc(j.piloto)+' '+src('PILOTOS'))}${kvr('Unidad',esc(f.unidad)+' '+src('PILOTOS'))}${kvr('Placa',esc(f.placa)+' '+src('FLOTA'))}${rev?'':kvr('Tango',esc(f.tango)+' '+src('FLOTA'))}${rev?'':kvr('Tipo de unidad',esc(f.tipo)+' '+src('FLOTA'))}${kvr('Capacidad',esc(f.capacidad)+' '+src('FLOTA'))}</dl>
        ${t.notaPiloto?`<div class="alertbox" id="notaPilotoViaje" role="note" style="margin-top:10px"><b>${esc(t.notaPiloto)}</b><div class="mute" style="font-size:13px;margin-top:2px">El piloto del viaje no es el asignado a la unidad ${esc(f.unidad||'')}; la nota queda guardada en el viaje.</div></div>`:''}</div>
      ${horarios}
      ${hp('comercial_ver')||hp('finanzas_ver')?moneyCard(t):''}
      ${verLiq?`<div class="card" style="grid-column:1/-1"><h3>Liquidación · historial de envíos</h3>${liqHTML}</div>`:''}
       ${hp('comercial_ver')&&(agrs.length||t.estado==='ACEPTADO')?`<div class="card" style="grid-column:1/-1"><h3>Facturación</h3>${agrs.length?`<div class="tablewrap scrollx"><table><thead><tr><th>ID de agrupación</th><th>Estado</th><th>N° de factura</th><th>Viajes asociados</th><th>Creada por</th></tr></thead><tbody>${agrs.map(g=>`<tr><td><b>${g.id}</b></td><td>${g.estado==='ACTIVA'?etapaBadge(etapaAgr(g)):chip('alert','Anulada')}</td><td>${g.numeroFactura?esc(g.numeroFactura):'<span class="mute">pendiente</span>'}</td><td>${g.viajeIds.map(i=>'#'+i).join(', ')}</td><td>${esc(g.creadoPor)} · ${fmtDT(g.creadoEn)}</td></tr>`).join('')}</tbody></table></div>`:'<div class="mute">Aún sin factura preparada.</div>'}</div>`:''}
      ${sinHist?'':`<div class="card" style="grid-column:1/-1"><h3>${rev?'Decisiones e historial':'Trazabilidad e historial'}</h3>${rev?'':`<dl class="kv">${tr('Creó',t.creadoPor,t.creadoEn)}${tr('Inició',t.iniciadoPor,t.iniciadoEn)}${tr('Finalizó',t.finalizadoPor,t.finalizadoEn)}${tr('Envió liquidación',t.enviadoPor,t.enviadoEn)}${tr('Revisó',t.revisadoPor,t.revisadoEn)}${tr('Aprobó',t.aprobadoPor,t.aprobadoEn)}${t.editadoPor?tr('Última edición',t.editadoPor,t.editadoEn):''}</dl>`}
        ${hist?`<details style="margin-top:12px" ${rev?'':'open'}><summary>Historial (${hist.length} eventos)</summary><div style="margin-top:10px">${histHTML(hist)}</div></details>`:'<div class="mute" style="margin-top:10px">'+(esEnc()?'No tienes':'Tu perfil no tiene')+' acceso al historial completo.</div>'}</div>`}
    </div></div>`;
};

/* ---- Resumen global / tablero gerencial ---- */
VIEWS.resumen=()=>{
  const all=vis(),cli=S.fProy,base=cli?all.filter(t=>t.proyecto===cli):all,ger=S.user.rol==='GERENTE_TRANSPORTE';
  let ags=[];if(hp('comercial_ver'))try{ags=API.agrupaciones(S.user.id).filter(g=>g.estado==='ACTIVA'&&(!cli||g.cliente===cli));}catch(e){}
  const kp=(n,l,c,e)=>`<button class="kpi" data-act="kpi" data-v="${e}"><span class="n">${n}</span><span class="l">${c?`<i class="dot" style="background:var(${c})"></i>`:''}${l}</span></button>`;
  const chips=comboHTML('fProy',cli,[{id:'',nombre:'Todos los clientes'},...PROYECTOS.map(p=>({id:p.id,nombre:p.nombre}))]);
  let feed=[];if(hp('historial_ver'))try{feed=API.actividad(S.user.id,8);}catch(e){}
  return `<div class="inner">${pageHead(ger?'Tablero gerencial':'Resumen general',ger?'Consulta global de todos los proyectos, con su recorrido completo':'Vista global de todos los proyectos')}
    ${chips}
    <div class="grid g4">
      ${kp(base.length,'Total de viajes','','')}${kp(cnt(base,t=>t.estado==='PLANIFICADO'),'Planificados','--pend','PLANIFICADO')}${kp(cnt(base,t=>t.estado==='EN_RUTA'),'En ruta','--cur','EN_RUTA')}${kp(cnt(base,t=>FIN.includes(t.estado)),'Finalizados','--ok','FIN')}
      ${kp(cnt(base,t=>t.estado==='ENTREGADO'),'Liquidaciones pendientes','--warn','ENTREGADO')}${kp(cnt(base,t=>t.estado==='LIQUIDADO'),'Liquidaciones en revisión','--rev','LIQUIDADO')}${kp(cnt(base,t=>t.estado==='RECHAZADO'),'Liquidaciones por corregir','--fix','RECHAZADO')}${kp(cnt(base,t=>LIQ_APROBADA.includes(t.estado)),'Liquidaciones aprobadas','--ok','APROBADAS')}
      ${kp(cnt(base,t=>t.estado==='ACEPTADO'),'Pendientes de facturar','--com','ACEPTADO')}${kp(cnt(base,t=>t.estado==='FACTURADO'),'Facturados','--ok','FACTURADO')}
      <div class="kpi"><span class="n">${ags.length}</span><span class="l"><i class="dot" style="background:var(--com)"></i>Agrupaciones activas</span></div>
      <div class="kpi"><span class="n">${ags.filter(g=>g.numeroFactura).length}</span><span class="l"><i class="dot" style="background:var(--ok)"></i>Facturas registradas</span></div>
    </div>
    <section class="section"><h2>Proyectos</h2><div class="cards">${PROYECTOS.filter(p=>!cli||p.id===cli).map(p=>{const pt=all.filter(t=>t.proyecto===p.id);return `<button class="pcard" data-act="proj" data-id="${p.id}"><div class="tc-top"><span class="pchip">${esc(p.nombre)}</span><span class="num">${pt.length} viajes</span></div>${statBar(pt)}</button>`;}).join('')}</div></section>
    ${feed.length?`<section class="section"><h2>Actividad reciente</h2><div class="card"><ul class="feed">${feed.map(x=>`<li><span class="avatar" style="width:30px;height:30px;font-size:12px">${initials(x.por)}</span><div><b>${esc(x.por)}</b> · ${esc(x.accion)}${x.campo&&x.nuevo?` <span class="mute">(${esc(x.campo)}: ${esc(x.nuevo)})</span>`:''}<br><span class="mute">${x.viajeId?'Viaje #'+x.viajeId+' · ':''}${esc(rolL(x.rol))}${x.motivo?' · “'+esc(x.motivo.slice(0,70))+'”':''}</span></div><span class="when">${ago(x.en)}</span></li>`).join('')}</ul></div></section>`:''}</div>`;
};
const clientePend=c=>[!c.nit?'identificador fiscal':'',!c.direccionFiscal?'dirección fiscal':'',!c.correoFacturacion?'correo de facturación':''].filter(Boolean);
VIEWS.proyectos=()=>{
  if(esAdm() || hp('clientes_gestionar')) return clientesAdminHTML();
  return clientesAdminHTML();
}
VIEWS.proyecto=()=>{
  const p=PROYECTOS.find(x=>x.id===S.param);if(!p)return empty('Proyecto no encontrado');
  const pt=vis().filter(t=>t.proyecto===p.id),list=pt.filter(t=>matchEst(t,S.fEstado));
  return `<div class="inner"><button class="btn ghost sm" data-act="nav" data-v="${hp('tablero_ver')?'proyectos':homeOf(S.user)}" style="margin-bottom:12px">${icon('back',16)} Proyectos</button>
    ${pageHead(esc(p.nombre),`${esc(p.cliente)} · Encargado: ${esc(p.encargado)}`)}<div class="card" style="margin-bottom:16px">${statBar(pt)}</div>${estadoChips()}${tableHTML(list,null,'proyecto')}</div>`;
};
function estadoChips(){
  const opts=[{id:'',nombre:'Todos'},{id:'PLANIFICADO',nombre:'Planificados'},{id:'EN_RUTA',nombre:'En ruta'},{id:'ENTREGADO',nombre:'Entregados'},{id:'LIQUIDADO',nombre:'Liquidados'},{id:'ACEPTADO',nombre:'Aceptados'},{id:'RECHAZADO',nombre:'Rechazados'},{id:'FACTURADO',nombre:'Facturados'},{id:'COBRADO',nombre:'Cobrados'}];
  return comboHTML('fEstado',S.fEstado,opts,'Todos los estados');
}
const matchEst=(t,f)=>!f||(f==='FIN'?FIN.includes(t.estado):f==='APROBADAS'?LIQ_APROBADA.includes(t.estado):t.estado===f);
function todosList(){
  const q=S.q.trim().toLowerCase();
  const campos=t=>[t.id,J(t).piloto,J(t).destino,J(t).f.placa,J(t).f.unidad,t.numeroFactura,t.agrupacionId,t.shipment,t.noViaje,t.producto,t.opl,t.proyectoCat,t.placaArrastre].join(' ');
  return vis().filter(t=>matchEst(t,S.fEstado)&&(!S.fProy||t.proyecto===S.fProy)&&(!q||campos(t).toLowerCase().includes(q)));
}
BODY.todos=()=>`${S.buscaRes?`<div class="alertbox info" style="margin-bottom:8px">Se buscó también en <b>todo el histórico</b> («${esc(S.buscaRes.texto)}»): ${S.buscaRes.n?`<b>${S.buscaRes.n}</b> viaje(s) fuera de la ventana cargada`:'sin más coincidencias'}.</div>`:''}${tableHTML(todosList())}`;
VIEWS.todos=()=>`<div class="inner">${pageHead('Todos los viajes','Sin filtro de proyecto: '+vis().length+' viajes visibles para tu perfil')}
  <div class="row2" style="margin-bottom:12px"><input type="text" id="q" placeholder="Buscar por n.º de viaje, piloto, placa, destino o factura" value="${esc(S.q)}" aria-label="Buscar viajes"><select data-flt="fProy" aria-label="Filtrar por cliente"><option value="">Todos los clientes</option>${PROYECTOS.map(p=>`<option value="${p.id}" ${S.fProy===p.id?'selected':''}>${esc(p.nombre)}</option>`).join('')}</select></div>
  ${estadoChips()}<div id="vb">${BODY.todos()}</div></div>`;



function fleTabla(h,rows,key){const pg=paginar(key||'fle',rows);return `<div class="tablewrap scrollx"><table><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${pg.filas.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${paginador(key||'fle',pg)}`;}
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
      d.mant.map(m=>[fch(m.fecha),esc(m.unidad),esc(m.referencia),esc(m.estado),esc(m.proveedor),m.mano_obra!=null?qfmt(m.mano_obra):'—',m.repuestos!=null?qfmt(m.repuestos):'—',m.total!=null?qfmt(m.total):'—',esc(m.notas)]),'flemant'):'<div class="mute">Sin mantenimientos.</div>';
  const tg=d.gast.length?fleTabla(['Fecha','Unidad','Tipo','Proveedor','Monto','Notas'],
      d.gast.map(g=>[fch(g.fecha),esc(g.unidad),esc(g.tipo),esc(g.proveedor),g.monto!=null?qfmt(g.monto):'—',esc(g.notas)]),'flegast'):'<div class="mute">Sin gastos.</div>';
  return `${nota}${head}<div class="mute small" style="margin-bottom:10px">Mantenimientos: <b>${d.mant.length}</b> · Gastos: <b>${d.gast.length}</b></div>
    <h3>Mantenimientos <span class="mute" style="font-weight:500">· servicio</span></h3>${tm}
    <h3 style="margin:18px 0 8px">Gastos <span class="mute" style="font-weight:500">· egresos por unidad</span></h3>${tg}`;
}
VIEWS.catalogos=()=>{
  const k0=S.tab.cat||'pil',verFle=hp('catalogos_ver')||hp('finanzas_ver'),k=(k0==='fle'&&!verFle)?'pil':k0;
  const T=[{k:'pil',l:'PILOTOS',f:()=>true},{k:'flo',l:'FLOTA',f:()=>true},{k:'ori',l:'ORIGEN',f:()=>true},{k:'des',l:'DESTINOS',f:()=>true},{k:'cat',l:'CATALOGO (listas)',f:()=>true},...(verFle?[{k:'fle',l:'FLEETIO',f:()=>true}]:[])];
  const tb=(h,rows,key)=>{const pg=paginar(key||'cat',rows);return `<div class="tablewrap scrollx"><table><thead><tr>${h.map(x=>`<th>${x}</th>`).join('')}</tr></thead><tbody>${pg.filas.map(r=>`<tr>${r.map(c=>`<td>${c}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${paginador(key||'cat',pg)}`;};
  const pn=id=>esc((PROYECTOS.find(p=>p.id===id)||{}).nombre||id);
  const body={
    pil:tb(['Id','Piloto','Unidad asignada','Proyecto'],PILOTOS.map(p=>[p.id,esc(p.nombre),p.unidad?esc(p.unidad):'<span class="mute">Sin unidad</span>',pn(p.proyecto)]),'catpil'),
    flo:tb(['Unidad','Placa','Tango','Capacidad','Tipo'],FLOTA.map(f=>[esc(f.unidad),esc(f.placa),esc(f.tango),esc(f.capacidad),esc(f.tipo)]),'catflo'),
    ori:`${puedeEditarListas()?`<div style="margin-bottom:8px"><button class="btn sm" data-act="catalogoOpen" data-k="origen">Editar orígenes</button></div>`:''}${tb(['Origen'],ORIGENES.map(o=>[esc(o.nombre)]),'catori')}`,
    cat:`<div class="grid g2">${Object.entries({'clientes':'CLIENTES','proyectos':'PROYECTOS','tipoUnidad':'TIPO DE UNIDAD','opl':'OPL · TRANSPORTISTAS','tipoCarga':'TIPO CARGA','tipoViaje':'TIPO DE VIAJE','arrastre':'EQUIPOS DE ARRASTRE (PLACAS)'}).map(([k,n])=>`<div class="card"><h3>${n} <span class="mute" style="font-weight:500">· ${(CAT[k]||[]).length}</span>${puedeEditarListas()?` <button class="btn sm ghost" data-act="catalogoOpen" data-k="${k}">Editar</button>`:''}</h3><div class="bgs">${(CAT[k]||[]).map(x=>`<span class="est">${esc(x)}</span>`).join('')||'<span class="mute">Sin valores</span>'}</div>${LISTAS_SISTEMA.includes(k)?'<div class="mute" style="font-size:12px;margin-top:6px">Se guarda en la base y la app lo usa de inmediato.</div>':'<div class="mute" style="font-size:12px;margin-top:6px">Se arma solo con la ficha de cada cliente.</div>'}</div>`).join('')}</div>`,
    des:tb(['Id','Destino','Proyecto'],DESTINOS.map(d=>[d.id,esc(d.nombre),pn(d.proyecto)]),'catdes'),fle:flePanel()}[k];
  return `<div class="inner">${pageHead('Catálogos','Datos maestros que la aplicación consulta; todos vienen de la base (Supabase)')}${tabs('cat',T,k,null).replace(/<span class="c">0<\/span>/g,'')}<div style="height:14px"></div>${body}
    <div class="alertbox info" style="margin-top:14px"><b>Nota:</b> PILOTOS, FLOTA y DESTINOS se leen de sus tablas; las listas del sistema (tipo de unidad, OPL, tipo de carga, tipo de viaje y orígenes) se guardan en la tabla <code>catalogos</code> y se editan desde aquí. CLIENTES y PROYECTOS se arman con la ficha de cada cliente.</div></div>`;
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

/* =====================================================================
   RENDER
   ===================================================================== */
function menuHTML(){
  if(!S.menu)return'';
  const u=S.user;
  return `<div class="mback" data-act="menuClose"></div><div class="menu" role="menu">
    ${u?`<div class="mh"><b>${esc(u.nombre)}</b><small>${esc(rolL(u.rol))}</small></div>`:`<div class="mh"><b>Opciones</b></div>`}
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
    if(f.type==='multiselect'){const op=f.optsFn?f.optsFn(data):(f.opts||[]);return `<div class="fgroup"><label>${f.label}${f.req?' <span class="mute">*</span>':''}</label><select id="${id}" data-mfm="${f.k}" multiple size="6" style="height:auto">${op.map(o=>`<option value="${esc(o.id)}" ${(val||[]).includes(o.id)?'selected':''}>${esc(o.nombre)}</option>`).join('')}</select><span class="hint">Mantén presionada la tecla Ctrl (o Cmd en Mac) para elegir varios proyectos.</span></div>`;}
  if(f.type==='mover'){
    const op=(f.optsFn?f.optsFn(data):(f.opts||[]));
    const asg=(val||[]).filter(id=>op.some(o=>o.id===id));
    const no=op.filter(o=>!asg.includes(o.id));
    const col=(id,items,ph)=>`<select id="${id}" multiple size="8" aria-label="${esc(ph)}" style="width:100%;height:auto">${items.length?items.map(o=>`<option value="${esc(o.id)}">${esc(o.nombre)}</option>`).join(''):`<option disabled value="">${esc(ph)}</option>`}</select>`;
    const b=(dir,lab,tip,cls)=>`<button type="button" class="btn sm ${cls||''}" data-act="mvMove" data-k="${f.k}" data-dir="${dir}" title="${esc(tip)}" aria-label="${esc(tip)}">${lab}</button>`;
    return `${W}${lab}<div class="mv">
      <div class="mv-col"><div class="mv-t">Sin asignar · ${no.length}</div>${col('mv_'+f.k+'_no',no,'No queda nada por asignar')}</div>
      <div class="mv-btns">${b('to','\u203A','Asignar lo seleccionado')}${b('from','\u2039','Quitar lo seleccionado')}${b('toall','\u00BB','Asignar todo','ghost')}${b('fromall','\u00AB','Quitar todo','ghost')}</div>
      <div class="mv-col"><div class="mv-t">Asignados · ${asg.length}</div>${col('mv_'+f.k+'_si',asg,'Todavía no hay nada asignado')}</div>
    </div>${f.hint?`<span class="hint">${f.hint}</span>`:''}</div>`;
  }
  if(f.type==='checks'){const op=f.optsFn?f.optsFn(data):(f.opts||[]);return `<div class="fgroup"><label>${f.label}${f.req?' <span class="mute">*</span>':''}</label><div class="chips">${op.length?op.map(o=>`<label class="chip" style="display:flex;gap:6px;align-items:center"><input type="checkbox" data-mfm="${f.k}" value="${esc(o.id)}" ${(val||[]).includes(o.id)?'checked':''}> ${esc(o.nombre)}</label>`).join(''):'<span class="mute">Primero elige el cliente para ver sus proyectos</span>'}</div></div>`;}
  if(f.type==='file')return `${W}${lab}<input type="file" id="${id}" data-mfile="${f.k}" accept="image/*,application/pdf">${val?`<span class="hint">✓ Archivo cargado</span>`:''}</div>`;
  return `${W}${lab}<input type="${f.type||'text'}" id="${id}" data-mf="${f.k}" value="${esc(val)}" autocomplete="off" ${f.ro?'readonly':''} ${f.type==='number'?'step="any" min="0" inputmode="decimal"':''}>${f.hint?`<span class="hint">${f.hint}</span>`:''}</div>`;
}
function liveHTML(f){
  return f.length?`<div class="alertbox" role="alert" style="margin:10px 0"><b>Falta completar para poder enviar:</b><ul style="margin:4px 0 0 18px;padding:0">${f.map(x=>`<li>${esc(x.msg)}</li>`).join('')}</ul></div>`:`<div class="alertbox okb" style="margin:10px 0"><b>Información completa:</b> ya puedes enviar.</div>`;
}
function updateLive(){
  const m=S.modal;if(!m||!m.live)return;
  const f=m.live(m.data),box=document.getElementById('mlive');
  if(box)box.innerHTML=(m.liveRender||liveHTML)(f);
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
    ${live?`<div id="mlive">${(m.liveRender||liveHTML)(live)}</div>`:''}
    ${m.err?`<div class="err" role="alert" style="margin-top:8px">${esc(m.err)}</div>`:''}
    <div class="btns">${m.noCancel?'':`<button class="btn" data-act="closeModal">${esc(m.cancelLabel||'Cancelar')}</button>`}${btns}</div></div></div>`;
}
function bannerHTML(){
  if(BACKEND.modo==='supabase'&&!navigator.onLine)return `<div class="offbar" role="alert">Sin conexión con el servidor. <b>Nada de lo que hagas se guarda</b> hasta que vuelva la conexión; no se confirmará ninguna operación.</div>`;
  return '';
}
/* ¿Pantalla angosta? En el teléfono el menú se guarda en un botón de tres líneas.
   En escritorio (y en las pruebas, que corren con ventana ancha) el menú se ve igual que siempre. */
function esMovil(){
  try{
    if(typeof window.matchMedia==='function')return window.matchMedia('(max-width:899px)').matches||PREF.phone===true;
    return (window.innerWidth||9999)<900;
  }catch(e){return false;}
}
function headerHTML(){
  const u=S.user;
  const botonMenu=(esMovil()&&navItems().length>=2)?`<button class="navbtn" data-act="navToggle" aria-label="Abrir menú" aria-expanded="${S.nav?'true':'false'}">${icon('menu',22)}</button>`:'';
  return `<header class="top">${botonMenu}<div class="brand"><span class="isotile"><img src="${ISOLOGO}" alt="In Transit"></span><span>Control de viajes<small>In Transit · innovative outsourcing</small></span></div><span class="spacer"></span>${(BACKEND.modo==='demo'&&!SIN_DEMO)?'<span class="demotag" title="Los datos son de demostración y viven solo en este navegador">Modo demostración</span>':''}
    <button class="bell" data-act="notifOpen" aria-label="Notificaciones${notifData().filter(n=>!n.leida).length?' ('+notifData().filter(n=>!n.leida).length+' sin leer)':''}">${icon('bell',20)}${notifData().filter(n=>!n.leida).length?`<span class="bcount">${notifData().filter(n=>!n.leida).length}</span>`:''}</button>
    <button class="userchip" data-act="menu" aria-haspopup="menu" aria-label="Menú de usuario"><span class="avatar">${initials(u.nombre)}</span><span class="t"><b>${esc(u.nombre)}</b><span>${esc(rolL(u.rol))}${cliLista(u)}</span></span></button></header>`;
}
/* ---- Perfil «Administrador»: menú lateral agrupado por módulos. Solo reordena el acceso a pantallas que YA existen;
   cada opción respeta los mismos permisos de siempre (allowed) y los demás perfiles conservan su menú tal cual. ----
   v: pantalla existente · l: etiqueta si difiere de la habitual · k: clave propia cuando dos opciones abren la misma pantalla · tab: pestaña con la que abre */
const ADM_MODULOS=[
  {t:'VIAJES',    items:[{v:'nuevo'},{v:'liquidaciones'},{v:'todos'},{v:'viajes',l:'Viajes por estado'}]},
  {t:'TORRE',     items:[{v:'torre',k:'torre',l:'Viajes',tab:['torre','curso']},{v:'torre',k:'horarios',l:'Horarios y fechas',ic:'clock',tab:['torre','todos']}]},
  {t:'COMERCIAL', items:[{v:'comercial'},{v:'proyectos'},{v:'tarifas'},{v:'finanzas'},{v:'catalogos'}]},
  {t:'OPL',       items:[{v:'opl',l:'Proveedores'}]},
  {t:'FLOTAS',    items:[{v:'catalogos',k:'pilotos',l:'Pilotos',ic:'users',tab:['cat','pil']}]},
  {t:'ADMINISTRACIÓN', items:[{v:'rutas'},{v:'usuarios'},{v:'auditoria'},{v:'modelo'}]}   /* pantallas que existen y no pertenecen a los otros módulos: siguen accesibles */
];
const CHEV='<svg class="chev" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
function admNavHTML(items,act){
  const pilAct=S.navK==='pilotos'&&(S.tab.cat||'pil')==='pil';
  const ok=its=>its.filter(it=>items.includes(it.v));
  /* opción activa: si dos opciones comparten pantalla, manda la clave k; la que no tiene k es la «por defecto» de esa pantalla */
  const on=it=>{
    if(it.v!==act)return false;
    if(it.k==='pilotos')return pilAct;
    const hermanas=ADM_MODULOS.flatMap(m=>m.items).filter(x=>x.v===it.v&&x.k);
    if(it.k)return S.navK===it.k;
    return it.v==='catalogos'?!pilAct:!hermanas.some(x=>S.navK===x.k);
  };
  const mods=ADM_MODULOS.map((m,i)=>({m,i,its:ok(m.items)})).filter(x=>x.its.length);
  /* al llegar a una pantalla nueva se abre el módulo que la contiene; después el usuario abre/cierra a mano */
  const clave=act+'|'+S.navK+'|'+(pilAct?1:0);
  if(S.navKey!==clave){S.navKey=clave;const x=mods.find(x=>x.its.some(on));if(x)S.navOpen=x.i;}
  if(S.navOpen===undefined)S.navOpen=-1;
  const btn=it=>`<button data-act="nav" data-v="${it.v}" ${it.k?`data-k="${it.k}"`:''} ${it.tab?`data-tabk="${it.tab[0]}" data-tabv="${it.tab[1]}"`:''} ${on(it)?'aria-current="page"':''}>${icon(it.ic||NAVLBL[it.v][1],18)}${esc(it.l||NAVLBL[it.v][0])}</button>`;
  const grupo=({m,i,its})=>{const ab=S.navOpen===i,act_=its.some(on);
    return `<div class="grp${ab?' open':''}${act_?' has-cur':''}" data-mod="${i}"><button class="grp-t" id="gm_${i}" data-act="navMod" data-i="${i}" aria-expanded="${ab}" aria-controls="gp_${i}"><span>${esc(m.t)}</span>${CHEV}</button><div class="grp-p" id="gp_${i}" role="group" aria-labelledby="gm_${i}" ${ab?'':'hidden'}>${its.map(btn).join('')}</div></div>`;};
  const ini=ok([{v:'inicio'}]).map(btn).join('');
  return `<nav class="side side-acc" aria-label="Navegación principal">${ini}${mods.map(grupo).join('')}</nav>`;
}
function navHTML(){
  const items=navItems();
  if(items.length<2)return'';
  const act=S.view==='detalle'&&S.from?S.from.view:(S.view==='proyecto'?'proyectos':S.view);
  if(S.user.rol==='ADMIN')return admNavHTML(items,act);
  return `<nav class="side" aria-label="Navegación principal">${items.map(v=>`${v==='catalogos'?'<div class="sep"></div>':''}<button data-act="nav" data-v="${v}" ${act===v?'aria-current="page"':''}>${icon(NAVLBL[v][1],18)}${NAVLBL[v][0]}</button>`).join('')}</nav>`;
}
function render(){
  const movil=esMovil();
  document.body.classList.toggle('phone',PREF.phone);
  document.body.classList.toggle('mob',movil);
  document.body.classList.toggle('nav-open',!!(movil&&S.nav));
  const root=$('#app');
  if(!S.user||S.view==='login'){root.innerHTML=bannerHTML()+loginHTML()+menuHTML();return;}
  if(!allowed(S.view)){S.view=homeOf(S.user);S.param=null;}
  const prev=$('#main'),keep=prev&&S._lv===S.view&&S._lp===S.param,st=keep?prev.scrollTop:0;
  root.innerHTML=bannerHTML()+headerHTML()+`<div class="body">${navHTML()}${movil&&S.nav?'<div class="mback" data-act="navClose"></div>':''}<main id="main" class="main">${archBar()}${VIEWS[S.view]()}</main></div>`+modalHTML()+menuHTML();
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
  S.view=view;S.param=param||null;S.menu=false;S.nav=false;S.modal=null;S.edit=null;S._lv=null;
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
const puedeEditarListas=()=>hp('catalogos_editar');
const ACT={
  /* Entrar a la aplicación (botón INGRESAR del formulario de acceso) */
  login:doLogin,
  /* editar una lista del sistema (tipo de unidad, OPL, tipo de carga, tipo de viaje, orígenes) */
  async catalogoOpen(d){
    if(!puedeEditarListas()){toast('Tu perfil no puede editar las listas.','err');return;}
    const clave=String(d.k||'');
    if(!LISTAS_SISTEMA.includes(clave))return;
    formM({title:'Lista · '+(LISTAS_ETIQUETA[clave]||clave),
      text:'Un valor por línea (o separados por coma). Se guarda en la base de datos y la aplicación lo usa de inmediato.',
      fields:[{k:'valores',label:'Valores',type:'textarea',req:1}],
      data:{valores:(CAT[clave]||[]).join('\n')},ancho:'620px',ok:'GUARDAR LISTA',act:'catalogoSave',id:clave});
  },
  async catalogoSave(d){
    const m=S.modal;if(!m)return;
    const valores=String(m.data.valores||'').split(/[\n,;]+/).map(x=>x.trim()).filter(Boolean);
    const r=await run(()=>API.guardarCatalogo(S.user.id,d.id,valores),v=>`Lista guardada (${v.valores.length} valores).`);
    if(r.ok){try{await BACKEND.refrescar();}catch(e){/* la lista ya quedó guardada */}afterWrite();}
  },
  /* mover elementos entre las dos listas (clientes / proyectos asignados) */
  async mvMove(d){
    const m=S.modal;if(!m||!d.k)return;
    const k=d.k,dir=d.dir||'to',cur=(m.data[k]||[]).slice();
    const leer=id=>{const el=document.getElementById(id);return el?[...el.selectedOptions].map(o=>o.value).filter(Boolean):[];};
    const op=(m.fields||[]).find(x=>x.k===k);
    const todos=(op?(op.optsFn?op.optsFn(m.data):(op.opts||[])):[]).map(o=>o.id);
    if(dir==='to')m.data[k]=[...new Set(cur.concat(leer('mv_'+k+'_no')))];
    else if(dir==='from'){const q=leer('mv_'+k+'_si');m.data[k]=cur.filter(x=>!q.includes(x));}
    else if(dir==='toall')m.data[k]=[...new Set(cur.concat(todos))];
    else if(dir==='fromall')m.data[k]=[];
    /* al cambiar los clientes, se quitan los proyectos que ya no corresponden */
    if(k==='clientes'&&m.data.proyectos){
      const val=new Set();(m.data.clientes||[]).forEach(c=>(PROYECTOS_X[c]||[]).forEach(p=>val.add(p)));
      const pr=(m.fields||[]).find(x=>x.k==='proyectos');
      const todosP=(pr?(pr.optsFn?pr.optsFn(m.data):(pr.opts||[])):[]).map(o=>o.id);
      m.data.proyectos=m.data.proyectos.filter(p=>val.has(p)&&todosP.includes(p));
    }
    render();
  },
  async fill(d){const u=DB.usuarios.find(x=>x.usuario===d.u);$('#u').value=u.usuario;$('#p').value=u.clave;S.loginU=u.usuario;},
  async instalar(){await PWA.instalar();render();},
  async instalarAyuda(){formM({title:'Instalar la aplicación',text:'Elige tu dispositivo. La instalación depende del navegador; no todos los navegadores la ofrecen.',summary:PWA.ayudaHTML(),noCancel:true,ok:'Cerrar',act:'closeModal',ancho:'640px'});},
  async menu(){S.menu=!S.menu;if(S.menu)S.nav=false;render();},
  async menuClose(){S.menu=false;render();},
  /* menú lateral en el teléfono (botón de tres líneas) */
  async navToggle(){S.nav=!S.nav;if(S.nav)S.menu=false;render();},
  async navClose(){S.nav=false;render();},
  async histReintentar(){S.finHist=undefined;S.finHistErr='';S.finHistCargando=false;render();},
  async togglePhone(){PREF.phone=!PREF.phone;savePref();S.menu=false;render();},
  async toggleArch(){PREF.arch=!PREF.arch;savePref();S.menu=false;render();},
  async reset(){
    if(S.user&&S.user.rol!=='ADMIN')return;
    seedDB();syncRefs();S.form=null;S.draft={};S.sel=[];S.menu=false;S.modal=null;S.edit=null;
    if(S.user){S.user=DB.usuarios.find(u=>u.id===S.user.id)||null;if(!S.user)S.view='login';}
    render();toast('Datos de ejemplo reiniciados.');
  },
  async logout(){if(S.user)await BACKEND.logout();S.edit=null;S.user=null;S.view='login';S.menu=false;S.modal=null;S.form=null;S.loginErr='';S.loginU='';S.tab={};S.fEstado='';S.fProy='';S.tProy='';S.sel=[];try{history.pushState(null,'','#login');}catch(e){}render();},
  navMod(d){const i=+d.i,ab=S.navOpen!==i;S.navOpen=ab?i:-1;
    document.querySelectorAll('nav.side .grp').forEach(g=>{const o=ab&&+g.dataset.mod===i;g.classList.toggle('open',o);const h=g.querySelector('.grp-t'),p=g.querySelector('.grp-p');if(h)h.setAttribute('aria-expanded',o);if(p)p.hidden=!o;});},
  async nav(d){S.fEstado='';S.q='';S.fCli='';S.fPcat='';S.fProy='';S.fDesde='';S.fHasta='';S.fProv='';S.sortL=null;S.navK=d.k||'';if(d.tabk)S.tab[d.tabk]=d.tabv;go(d.v);},
  async detalle(d){go('detalle',d.id);},
  async back(){const f=S.from;if(f&&f.view&&allowed(f.view))go(f.view,f.param);else go(homeOf(S.user));},
  async proj(d){S.fEstado='';go('proyecto',d.id);},
  async kpi(d){S.fEstado=d.v;S.fProy='';S.q='';go(allowed('todos')?'todos':homeOf(S.user));},
  async tab(d){S.tab[d.k]=d.v;S.q='';render();if(d.k==='cat'&&d.v==='fle'&&!S.fle)ACT.fleLoad();},
  async tproy(d){S.tProy=d.v;render();},
  async fproy(d){S.fProy=d.v;render();},
  async reintentarCatalogos(){try{await BACKEND.refrescar();toast('Datos actualizados desde el servidor.');}catch(e){toast(e.message||'No se pudo actualizar desde el servidor.','err');}render();},
  async pagina(d){S.pag[d.k]=Math.max(1,Number(d.p)||1);render();topScroll();},
  async festado(d){S.fEstado=d.v;render();},
  async backdrop(d,el,e){if(e.target===el){S.modal=null;render();}},
  async closeModal(){S.modal=null;render();},
  async photoEv(d){const l=liqsOf({id:d.id}).find(x=>x.evidenciaId===d.ev);if(l&&l.evidencia){S.modal={type:'photo',src:l.evidencia,z:1,titulo:`Evidencia · viaje #${d.id} · envío ${l.ciclo}`};render();}},
  async zoom(d){if(S.modal&&S.modal.type==='photo'){S.modal.z=d.d==='0'?1:Math.max(1,Math.min(4,(S.modal.z||1)+Number(d.d)));render();}},
  async sample(d){S.draft[d.id]=sampleSlip(d.id);render();},
  /* Trae la página siguiente del histórico (viajes anteriores a lo que ya está en pantalla). */
  async cargarViejos(){
    if(S.cargandoViejos)return;
    S.cargandoViejos=true;render();
    try{
      const antes=S.viejoAntes||(DB.ventana&&DB.ventana.desde)||'';
      const r=await API.viajesAnteriores(S.user.id,{antesDe:antes,antesId:S.viejoId||'',limite:PAGINA_VIEJOS});
      const n=(r.trips||[]).length;
      if(!n)S.viejoFin=true;
      else{
        const last=r.trips[r.trips.length-1];
        S.viejoAntes=String(last.fechaPlan||'').slice(0,10)||antes;
        S.viejoId=last.id;
        if(n<r.limite)S.viejoFin=true;
      }
      toast(n?`Se cargaron ${n} viaje(s) anteriores.`:'No hay más viajes anteriores.');
    }catch(e){toast(e.message,'err');}
    S.cargandoViejos=false;render();
  },
  /* El buscador filtra lo que está cargado; con 3 letras o más se pregunta al servidor por TODO el histórico,
     así un viaje cerrado de hace meses aparece sin necesidad de cargar el histórico completo. */
  async buscarHistorico(){
    const term=(S.q||'').trim();
    if(term.length<3||BACKEND.modo!=='supabase'){S.buscaRes=null;return;}
    if(S.buscaT)clearTimeout(S.buscaT);
    S.buscaT=setTimeout(async()=>{
      if((S.q||'').trim()!==term)return;                      /* escribió otra cosa: se descarta */
      try{
        const r=await API.buscarViajes(S.user.id,{texto:term});
        if((S.q||'').trim()!==term)return;
        S.buscaRes={texto:term,n:(r.trips||[]).length};
        const el=$('#vb');if(el&&BODY[S.view])el.innerHTML=BODY[S.view]();   /* solo el cuerpo: no se pierde el foco */
      }catch(e){/* sin conexión o sin permiso: se queda con lo que ya está en pantalla */}
    },450);
  },
  async limpiarFiltros(){S.q='';S.fCli='';S.fPcat='';S.fDesde='';S.fHasta='';S.sortL=null;render();},
  async sortL(d){const def=liqCurrent().k==='apr'?{k:'revision',dir:-1}:{k:'fecha',dir:1},c=S.sortL||def;S.sortL=c.k===d.k?{k:d.k,dir:-c.dir}:{k:d.k,dir:1};render();},
  async sortF(d){const c=S.sortF||{k:'fechaEnvio',dir:-1};S.sortF=c.k===d.k?{k:d.k,dir:-c.dir}:{k:d.k,dir:1};render();},
  async chip(d){const ta=$('#mf_comentario');if(ta){ta.value=d.t;S.modal.data.comentario=d.t;ta.focus();}},
  async notifOpen(){formM({title:'Notificaciones',text:'Los avisos aparecen solo dentro de la aplicación. Para enviarlos por correo o Teams hace falta configurar un servicio (por ejemplo, un flujo de Power Automate); hoy no hay ninguno.',summary:`<div id="notifbox">${notifHTML()}</div>`,noCancel:true,ok:'Cerrar',act:'closeModal'});},
  async notifLeer(d){await run(()=>API.marcarNotificacion(S.user.id,d.id));ACT.notifOpen();},
  async autoNow(d){const el=document.getElementById('a_'+d.k);if(el){el.value=nowLocal();autoSave(d.id,d.k,el.value);}},
  async autoRetry(d){const el=document.getElementById('a_'+d.k);autoSave(d.id,d.k,el?el.value:(S.autoFail[d.id+'|'+d.k]||''));}
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
  if(e.key==='Escape'&&(S.modal||S.menu||S.nav)){S.modal=null;S.menu=false;S.nav=false;render();}
  if(e.key==='Enter'&&(e.target.id==='u'||e.target.id==='p')){e.preventDefault();doLogin();}
});
app.addEventListener('submit',e=>{e.preventDefault();doLogin();});
app.addEventListener('change',async e=>{
  const t=e.target;
  if(t.dataset.torre){await run(()=>API.guardarReglasTorre(S.user.id,{cliente:t.dataset.torre,torreEstatus:t.checked}),'Regla de Torre actualizada.');render();return;}
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
  if(t.dataset.mfm&&S.modal){const k=t.dataset.mfm;
    if(t.tagName==='SELECT'&&t.multiple){S.modal.data[k]=Array.from(t.selectedOptions).map(o=>o.value);}
    else{const a=S.modal.data[k]||[];S.modal.data[k]=t.checked?[...new Set([...a,t.value])]:a.filter(x=>x!==t.value);}
    if(S.modal.rerender&&S.modal.rerender.includes(k)){if(k==='clientes'&&S.modal.data.proyectos){const valid=new Set();(S.modal.data.clientes||[]).forEach(c=>(PROYECTOS_X[c]||[]).forEach(p=>valid.add(p)));if(valid.size)S.modal.data.proyectos=S.modal.data.proyectos.filter(p=>valid.has(p));}render();return;}
    return;}
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
  if(t.id==='qCli'){S.qCli=t.value;render();const el=document.getElementById('qCli');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}return;}
  if(t.id==='q'){S.q=t.value;if(BODY[S.view]&&$('#vb'))$('#vb').innerHTML=BODY[S.view]();if(S.view==='todos')ACT.buscarHistorico();}
});
window.addEventListener('popstate',()=>{
  if(!S.user)return;
  const h=(location.hash||'').replace('#','').split('/');const v=h[0]||homeOf(S.user);
  S.view=VIEWS[v]&&allowed(v)?v:homeOf(S.user);S.param=h[1]||null;S.modal=null;S.menu=false;S.nav=false;S.edit=null;S._lv=null;render();
});
/* al girar el teléfono o cambiar de tamaño, se elige el menú que corresponde */
window.addEventListener('resize',()=>{try{const m=esMovil();if(m!==document.body.classList.contains('mob'))render();}catch(e){}});
setInterval(()=>{
  document.querySelectorAll('[data-since]').forEach(el=>{el.textContent=elapsed(el.dataset.since);});
  const c=$('#clock');if(c)c.textContent=new Date().toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit',hour12:false});
},30000);

BACKEND.iniciar();
