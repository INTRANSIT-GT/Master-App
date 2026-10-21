/* =====================================================================
   MÓDULO: TORRE DE CONTROL
   Seguimiento de viajes en ruta: horas y estado Entregado.
   ===================================================================== */

/* ---- Torre de Control: hoja tipo Excel · avanza el estado de los clientes autorizados ---- */
const TT=[
  {k:'curso',l:'En ruta',f:t=>t.estado==='EN_RUTA'},
  {k:'pend',l:'Planificados',f:t=>t.estado==='PLANIFICADO'},
  {k:'fin',l:'Finalizados',f:t=>FIN.includes(t.estado)},
  {k:'todos',l:'Todos',f:()=>true}
];
const clienteDe=t=>DB.clientes.find(x=>x.id===t.proyecto)||{};
/* Torre de Control avanza el estado de sus clientes autorizados: Planificado → En ruta → Entregado */
const TORRE_SIGUIENTE={PLANIFICADO:'EN_RUTA',EN_RUTA:'ENTREGADO'};
const torreAccion=t=>!!clienteDe(t).torreEstatus&&!!TORRE_SIGUIENTE[t.estado];
function torreList(){
  const base=vis().filter(t=>!S.tProy||t.proyecto===S.tProy),k=S.tab.torre||'curso',cur=TT.find(x=>x.k===k)||TT[0],q=S.q.trim().toLowerCase();
  let l=base.filter(cur.f).filter(t=>!q||(t.id+' '+(J(t).piloto||'')+' '+(J(t).f.placa||'')+' '+(J(t).cliente||'')+' '+(J(t).destino||'')+' '+((ESTADOS[t.estado]||{}).l||'')).toLowerCase().includes(q));
  l.sort((a,b)=>a.proyecto.localeCompare(b.proyecto)||a.id.localeCompare(b.id));
  return l;
}
function torreSheet(list){
  if(!list.length)return empty('No hay viajes en esta pestaña','Cuando un viaje cambie de estado aparecerá aquí.');
  const puede=hp('viajes_estatus_torre');
  const pg=paginar('torre',list);
  return `<div class="xlwrap sheet"><table class="xl" style="min-width:1400px"><thead><tr><th class="stk">Viaje</th><th>Cliente</th><th>Proyecto</th><th>Piloto</th><th>Unidad · placa</th><th>Ruta</th><th>Estado</th><th>En ruta</th><th>Fecha plan</th><th>Inicio real (salida)</th><th>Fin descarga</th></tr></thead><tbody>
  ${pg.filas.map(t=>{const j=J(t),sig=TORRE_SIGUIENTE[t.estado],aut=clienteDe(t).torreEstatus,ed=puede&&aut&&!!sig;
    const ctrl=ed?`<button class="btn primary sm" data-act="torreEstado" data-torreestado="${t.id}" data-dest="${sig}">${sig==='EN_RUTA'?'Enviar a ruta':'Confirmar entrega'}</button><span class="cst" id="ss_${t.id}" aria-live="polite"></span>`
      :`<span class="mute" style="font-size:12px">${aut?'(sin acción en este estado)':'solo consulta'}</span>`;
    return `<tr><td class="stk"><button class="linkbtn" data-act="detalle" data-id="${t.id}">#${t.id}</button></td><td>${esc(j.cliente)}</td><td>${esc(t.proyectoCat)}</td><td>${esc(j.piloto)}</td><td>${esc(j.f.unidad)} · ${esc(j.f.placa)}</td><td>${rutaHTML(t)}</td>
    <td class="${ed?'ed':'ro'}" style="min-width:230px"><div class="trow">${badge(t.estado)}${ctrl}</div></td>
    <td>${t.estado==='EN_RUTA'?`<span class="elapsed" style="font-size:14px" data-since="${since(t)}">${elapsed(since(t))}</span>`:'—'}</td>
    <td>${fmtL(t.fechaPlan)}</td><td>${t.tSalida?fmtL(t.tSalida):'—'}</td><td>${t.tFinDescarga?fmtL(t.tFinDescarga):'—'}</td></tr>`;}).join('')}
  </tbody></table></div>${paginador('torre',pg)}`;
}
/* ---- Torre de Control: horarios y fechas (consultar, agregar y corregir) ---- */
const torreHor=()=>S.navK==='horarios';
/* Misma regla que el servidor (torreEditarHorarios): permiso de Torre + cliente autorizado + viaje aún no facturado */
const torreEdita=t=>hp('viajes_estatus_torre')&&!!clienteDe(t).torreEstatus&&!['FACTURADO','COBRADO'].includes(t.estado);
function torreHorarios(list){
  if(!list.length)return empty('No hay viajes en esta pestaña','Cuando haya viajes aparecerán aquí con sus horarios.');
  const pg=paginar('torre',list);
  const celda=v=>v?fmtL(v):'<span class="mute" title="Sin registrar">—</span>';
  return `<div class="xlwrap sheet"><table class="xl" id="tablaHorarios" style="min-width:${1100+CAMPOS_TIEMPO.length*130}px"><thead><tr><th class="stk">Viaje</th><th>Cliente</th><th>Proyecto</th><th>Placa</th><th>Fecha plan</th>${CAMPOS_TIEMPO.map(([k,l])=>`<th>${esc(l)}</th>`).join('')}<th>Estado</th><th>Acciones</th></tr></thead><tbody>
  ${pg.filas.map(t=>{const j=J(t);
    return `<tr><td class="stk"><button class="linkbtn" data-act="detalle" data-id="${t.id}">#${t.id}</button></td><td>${esc(j.cliente)}</td><td>${esc(t.proyectoCat)}</td><td>${esc(j.f.placa||'—')}</td><td>${celda(t.fechaPlan)}</td>${CAMPOS_TIEMPO.map(([k])=>`<td>${celda(t[k])}</td>`).join('')}<td>${badge(t.estado)}</td>
    <td style="white-space:nowrap">${torreEdita(t)?`<button class="btn primary sm" data-act="torreHorOpen" data-id="${t.id}">Editar horarios</button>`:`<span class="mute" style="font-size:12px">${['FACTURADO','COBRADO'].includes(t.estado)?'viaje facturado':'solo consulta'}</span>`}</td></tr>`;}).join('')}
  </tbody></table></div>${paginador('torre',pg)}`;
}
BODY.torre=()=>`<div class="mute" style="margin-bottom:8px">${torreList().length} viajes</div>${torreHor()?torreHorarios(torreList()):torreSheet(torreList())}`;
VIEWS.torre=()=>{
  const all=vis(),base=S.tProy?all.filter(t=>t.proyecto===S.tProy):all,k=S.tab.torre||'curso';
  const kp=(n,l,c)=>`<div class="kpi"><span class="n">${n}</span><span class="l"><i class="dot" style="background:${c}"></i>${l}</span></div>`;
  const chips=comboHTML('tProy',S.tProy,[{id:'',nombre:'Todos los clientes'},...PROYECTOS.map(p=>({id:p.id,nombre:p.nombre}))]);
  const aut=DB.clientes.filter(c=>c.torreEstatus).map(c=>c.nombre);
  const rules=`<div class="rulebar"><span><b>Puedes avanzar el estado de:</b> ${esc(aut.join(', ')||'ningún cliente')}.</span><span class="mute">Torre mueve el estado (En ruta / Entregado) y puede agregar o corregir fechas y horarios; no edita otros datos.</span></div>`;
  return `<div class="inner" style="max-width:none">${pageHead('TORRE DE CONTROL','Hoja de viajes de todos los proyectos · avanza el estado de los clientes autorizados',`<span class="clock" id="clock">${new Date().toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit',hour12:false})}</span>`)}
    <div class="grid g4" style="margin-bottom:16px">${kp(cnt(base,t=>t.estado==='PLANIFICADO'),'Planificados',ESTADOS.PLANIFICADO.c)}${kp(cnt(base,t=>t.estado==='EN_RUTA'),'En ruta',ESTADOS.EN_RUTA.c)}${kp(cnt(base,t=>hp('viajes_estatus_torre')&&torreAccion(t)),'Con acción disponible',ESTADOS.ENTREGADO.c)}${kp(cnt(base,t=>t.estado==='ENTREGADO'),'Pendientes de liquidación',ESTADOS.LIQUIDADO.c)}</div>
    ${chips}${rules}<div class="chips" role="group" aria-label="Vista de Torre" style="margin:0 0 10px"><button class="chip" data-act="torreVista" data-v="e" aria-pressed="${!torreHor()}">Viajes y estado</button><button class="chip" data-act="torreVista" data-v="h" aria-pressed="${torreHor()}">Horarios y fechas</button></div>${tabs('torre',TT,k,base)}
    <div style="margin:12px 0"><input type="text" id="q" placeholder="Buscar por viaje, piloto, placa, cliente, destino o estado" value="${esc(S.q)}" aria-label="Buscar" style="max-width:440px"></div>
    <div id="vb">${BODY.torre()}</div></div>`;
};
function refreshSheet(){
  const w=document.querySelector('.xlwrap.sheet'),sl=w?w.scrollLeft:0,st=w?w.scrollTop:0,vb=document.getElementById('vb');
  if(vb){vb.innerHTML=BODY.torre();const w2=document.querySelector('.xlwrap.sheet');if(w2){w2.scrollLeft=sl;w2.scrollTop=st;}}
}
/* Torre de Control: avanzar el estado (se guarda solo al pulsar) */
const AUTOBUSY={};
async function torreEstadoSave(id,dest,btn){
  const st=document.getElementById('ss_'+id);
  const set=(c,msg)=>{if(btn){btn.classList.remove('saving','saved','error');btn.classList.add(c);btn.title=c==='error'?msg:'';}
    if(st){st.className='cst '+c;st.innerHTML=c==='saving'?'…':c==='saved'?'✓':`<button class="cretry" data-act="estadoRetry" data-id="${esc(id)}" data-dest="${esc(dest)}" title="${esc(msg)} Toca para reintentar" aria-label="Error: ${esc(msg)}. Reintentar">⚠</button>`;}};
  const key=id+'|estado';
  if(AUTOBUSY[key]===dest)return;
  AUTOBUSY[key]=dest;if(btn)btn.disabled=true;set('saving');
  try{await API.torreMoverEstado(S.user.id,id,dest);refreshSheet();const c2=document.getElementById('ss_'+id);if(c2){c2.className='cst saved';c2.textContent='✓';}}
  catch(e){set('error',e.message);if(btn)btn.disabled=false;}
  finally{delete AUTOBUSY[key];}
}


/* ---- Acciones (handlers) de este módulo ---- */
Object.assign(ACT,{
  async torreVista(d){S.navK=d.v==='h'?'horarios':'';render();},
  /* Editar horarios: ventana con la identificación del viaje, todos sus campos de fecha/hora y el resumen de lo que cambia */
  async torreHorOpen(d){
    const t=DB.trips.find(x=>x.id===d.id);if(!t)return;
    const j=J(t),ini={},KS=t.desvio?TIEMPO_DV_KEYS:TIEMPO_KEYS;KS.forEach(k=>{ini[k]=t[k]||'';});
    const difs=m=>KS.filter(k=>String(m[k]||'')!==String(ini[k]||'')).map(k=>({campo:'chg:'+k,msg:`${LBL[k]||k}: ${ini[k]?fmtL(ini[k]):'(vacío)'} → ${m[k]?fmtL(m[k]):'(vacío)'}`}))
      .concat(m.estadoNuevo?[{campo:'chg:estado',msg:`Estatus: ${ESTADOS[t.estado].l} → ${ESTADOS[m.estadoNuevo].l}`}]:[]);
    /* Estatus: solo el paso siguiente que ya permite Torre (mismas reglas y validaciones que «Enviar a ruta / Confirmar entrega») */
    const sig=TORRE_SIGUIENTE[t.estado];
    const campoEstatus=sig?[{k:'estadoNuevo',label:'Estatus del viaje',type:'select',ph:`Mantener: ${ESTADOS[t.estado].l} (actual)`,opts:[{id:sig,nombre:ESTADOS[sig].l}],hint:'Pasar a «'+ESTADOS[sig].l+'» exige que el viaje tenga sus datos y horarios completos.'}]:[];
    formM({title:`Horarios del viaje #${t.id}`,
      text:`Escribe un horario que falte o corrige uno existente. Se guarda en el viaje y otros usuarios verán el cambio; queda registrado quién lo hizo y el valor anterior.`,
      summary:`<div class="alertbox info" style="margin-bottom:10px"><b>Viaje #${esc(t.id)}</b> · ${esc(j.cliente)} · ${esc(t.proyectoCat)} · Placa <b>${esc(j.f.placa||'—')}</b> · ${esc(ESTADOS[t.estado].l)}</div>`,
      fields:[...campoEstatus,{k:'fechaPlan',label:'Fecha plan',type:'datetime-local',req:1},...CAMPOS_TIEMPO.map(([k,l])=>({k,label:l,type:'datetime-local'})),...(t.desvio?CAMPOS_TIEMPO_DESVIO.map(([k,l])=>({k,label:l,type:'datetime-local'})):[])],
      data:Object.assign({estadoNuevo:''},ini),ancho:'760px',
      live:difs,liveRender:f=>f.length?`<div class="alertbox info" style="margin:10px 0"><b>Cambios por guardar (${f.length}):</b><ul style="margin:4px 0 0 18px;padding:0">${f.map(x=>`<li>${esc(x.msg)}</li>`).join('')}</ul></div>`:`<div class="mute" style="margin:10px 0">Todavía no has cambiado ningún horario.</div>`,
      ok:'GUARDAR CAMBIOS',act:'torreHorGuardar',id:t.id,ini});
  },
  async torreHorGuardar(d){
    const m=S.modal;if(!m)return;
    if(m.guardando)return;                                   /* un doble clic no guarda dos veces */
    const cambios={};TIEMPO_DV_KEYS.forEach(k=>{if(!(k in m.ini))return;if(String(m.data[k]||'')!==String(m.ini[k]||''))cambios[k]=m.data[k]||'';});
    const nuevo=m.data.estadoNuevo||'';
    if(!Object.keys(cambios).length&&!nuevo){m.err='No hay cambios que guardar.';render();return;}
    if('fechaPlan' in cambios&&!cambios.fechaPlan){m.err='La fecha plan es obligatoria.';render();return;}
    m.guardando=true;
    let nh=0;
    try{
      if(Object.keys(cambios).length){
        const r=await API.torreEditarHorarios(S.user.id,d.id,cambios);nh=r.cambios;
        Object.assign(m.ini,cambios);                         /* ya guardado: un reintento no lo vuelve a enviar */
      }
      if(nuevo)await API.torreMoverEstado(S.user.id,d.id,nuevo);
      S.modal=null;render();refreshSheet();
      toast(`Viaje #${d.id} guardado correctamente`+(nh?` · ${nh} ${nh===1?'horario':'horarios'}`:'')+(nuevo?` · estatus: ${ESTADOS[nuevo].l}`:'')+'.');
    }catch(e){
      m.guardando=false;
      m.err=(nh?`Los horarios sí se guardaron, pero el estatus no cambió. `:'No se guardó nada. ')+(e.message||'Ocurrió un error.');
      if(nh)refreshSheet();
      render();
    }
  },
  async torreEstado(d,el){await torreEstadoSave(d.torreestado,d.dest,el);},
  async estadoRetry(d,el){const btn=document.querySelector('button[data-torreestado="'+d.id+'"]');await torreEstadoSave(d.id,d.dest,btn);}
});
