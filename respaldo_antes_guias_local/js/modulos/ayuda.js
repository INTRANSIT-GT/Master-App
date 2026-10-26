/* ayuda.js · Sección «Ayuda» (todos los perfiles).
   Cualquier usuario puede reportar una falla (módulo, tipo, descripción y qué intentaba hacer) y consultar SUS reportes.
   El Administrador y el perfil Proyectos ven todos los reportes y cambian su estado (Pendiente · En revisión · Resuelto).
   No requiere ningún permiso de la matriz y no abre ningún módulo restringido: solo guarda y lee reportes. */
const AYUDA_TONO={PENDIENTE:'alert',EN_REVISION:'progress',RESUELTO:'done'};
const ayudaSt=()=>{
  if(!S.ayuda||S.ayuda.uid!==S.user.id)S.ayuda={uid:S.user.id,tipo:'',modulo:'',descripcion:'',intento:'',err:'',ok:'',enviando:false,filtro:''};
  return S.ayuda;
};
const ayudaEstadoChip=e=>chip(AYUDA_TONO[e]||'neutral',AYUDA_ESTADOS[e]||e);
function ayudaFormHTML(a){
  const mods=ayudaModulosDe(S.user);              /* solo los módulos autorizados para el perfil actual (misma regla que el menú) */
  if(a.modulo&&!mods.includes(a.modulo))a.modulo='';
  const opt=(lista,v,ph)=>`<option value="">${ph}</option>`+lista.map(x=>`<option value="${esc(x)}" ${x===v?'selected':''}>${esc(x)}</option>`).join('');
  return `<div class="card fsec" style="max-width:760px"><h3>Reportar un problema</h3>
    ${a.ok?`<div class="alertbox okb" role="status" style="margin-bottom:12px"><b>${esc(a.ok)}</b></div>`:''}
    ${a.err?`<div class="alertbox" role="alert" style="margin-bottom:12px"><b>${esc(a.err)}</b></div>`:''}
    <div class="fgroup"><label for="ay_tipo">Tipo de problema <span class="mute">*</span></label><select id="ay_tipo" data-ay="tipo">${opt(AYUDA_TIPOS,a.tipo,'Selecciona el tipo de problema')}</select></div>
    <div class="fgroup"><label for="ay_modulo">Módulo afectado <span class="mute">*</span></label><select id="ay_modulo" data-ay="modulo">${opt(mods,a.modulo,'Selecciona el módulo')}</select></div>
    <div class="fgroup"><label for="ay_descripcion">Descripción del problema <span class="mute">*</span></label><textarea id="ay_descripcion" data-ay="descripcion" rows="5" maxlength="2000" placeholder="Cuéntanos qué pasó y qué mensaje viste, si hubo alguno.">${esc(a.descripcion)}</textarea></div>
    <div class="fgroup"><label for="ay_intento">¿Qué estabas intentando hacer? <span class="mute">(opcional)</span></label><textarea id="ay_intento" data-ay="intento" rows="3" maxlength="1000" placeholder="Por ejemplo: guardar un viaje nuevo.">${esc(a.intento)}</textarea></div>
    <dl class="kv" style="grid-template-columns:160px 1fr;font-size:13px;margin:10px 0"><dt>Usuario que reporta</dt><dd>${esc(S.user.nombre)}</dd><dt>Fecha y hora</dt><dd>Se registran automáticamente al enviar</dd></dl>
    <button type="button" class="btn primary lg" data-act="ayudaEnviar" ${a.enviando?'disabled':''}>${a.enviando?'Enviando…':'Enviar reporte'}</button>
    </div>`;
}
function ayudaHistorialHTML(r){
  const h=r.historial||[];
  if(!h.length)return '';
  return `<details style="margin-top:6px"><summary class="mute" style="cursor:pointer">Historial (${h.length})</summary><ul style="margin:6px 0 0 18px;padding:0;font-size:12.5px">${h.map(x=>`<li>${esc(AYUDA_ESTADOS[x.estado]||x.estado)} · ${esc(x.por||'')} · ${esc(fmtDT(x.en))}</li>`).join('')}</ul></details>`;
}
function ayudaListaHTML(a,adm){
  let L=[];try{L=API.reportesAyuda(S.user.id);}catch(e){L=[];}
  const total=L.length;
  if(adm&&a.filtro)L=L.filter(r=>r.estado===a.filtro);
  const filtro=adm?`<div style="margin-bottom:12px"><label class="mute" for="ay_filtro" style="margin-right:6px">Estado</label><select id="ay_filtro" data-ay-filtro="1" aria-label="Filtrar por estado"><option value="">Todos (${total})</option>${Object.keys(AYUDA_ESTADOS).map(k=>`<option value="${k}" ${a.filtro===k?'selected':''}>${AYUDA_ESTADOS[k]}</option>`).join('')}</select></div>`:'';
  if(!L.length)return filtro+empty(adm?'No hay reportes con ese filtro':'Aún no has enviado reportes','Cuando envíes un reporte aparecerá aquí con su estado.');
  const fila=r=>`<tr>
    <td data-l="Reporte"><b>${esc(r.id)}</b><div class="mute">${esc(fmtDT(r.creadoEn))}</div></td>
    ${adm?`<td data-l="Usuario">${esc(r.usuario)}<div class="mute">${esc(rolL(r.rol))}</div></td>`:''}
    <td data-l="Módulo">${esc(r.modulo)}</td>
    <td data-l="Problema"><b>${esc(r.tipo)}</b><div style="white-space:pre-wrap">${esc(r.descripcion)}</div>${r.intento?`<div class="mute" style="white-space:pre-wrap">Intentaba: ${esc(r.intento)}</div>`:''}${ayudaHistorialHTML(r)}</td>
    <td data-l="Estado">${adm?`<select data-ay-estado="${esc(r.id)}" aria-label="Estado del reporte ${esc(r.id)}">${Object.keys(AYUDA_ESTADOS).map(k=>`<option value="${k}" ${r.estado===k?'selected':''}>${AYUDA_ESTADOS[k]}</option>`).join('')}</select>`:ayudaEstadoChip(r.estado)}${r.actualizadoEn?`<div class="mute">${esc(fmtDT(r.actualizadoEn))}</div>`:''}</td>
  </tr>`;
  return filtro+`<div class="tablewrap scrollx"><table><thead><tr><th>Reporte</th>${adm?'<th>Usuario</th>':''}<th>Módulo</th><th>Problema</th><th>Estado</th></tr></thead><tbody>${L.map(fila).join('')}</tbody></table></div>`;
}
VIEWS.ayuda=()=>{
  const a=ayudaSt(),adm=AYUDA_GESTORES.includes(S.user.rol);
  let n=0;try{n=API.reportesAyuda(S.user.id).length;}catch(e){}
  const k=S.tab.ayuda==='lista'?'lista':S.tab.ayuda==='guia'?'guia':'nuevo';
  if(k==='guia')guiaAlEntrar();
  return `<div class="inner" style="max-width:1100px">${pageHead('Ayuda',adm?'Reportes de fallas enviados por los usuarios':'Reporta una falla o problema de la aplicación y consulta el estado de tus reportes')}
    ${tabs('ayuda',[{k:'nuevo',l:'Reportar un problema'},{k:'lista',l:adm?`Todos los reportes (${n})`:`Mis reportes (${n})`},{k:'guia',l:'Mi guía de uso'}],k)}
    <div style="margin-top:14px">${k==='nuevo'?ayudaFormHTML(a):k==='lista'?ayudaListaHTML(a,adm):guiaHTML()}</div></div>`;
};
ACT.ayudaEnviar=async()=>{
  const a=ayudaSt();
  if(a.enviando)return;
  a.err='';a.ok='';a.enviando=true;render();
  try{
    const r=await API.crearReporteAyuda(S.user.id,{tipo:a.tipo,modulo:a.modulo,descripcion:a.descripcion,intento:a.intento});
    Object.assign(a,{tipo:'',modulo:'',descripcion:'',intento:'',err:'',ok:`Reporte ${r.id} enviado. Se notificó a Administrador y Proyectos; puedes ver su estado en «${AYUDA_GESTORES.includes(S.user.rol)?'Todos los reportes':'Mis reportes'}».`});
    toast(`Reporte ${r.id} enviado.`);
  }catch(e){
    a.err=(e instanceof ApiError)?e.message:'No se pudo enviar el reporte: '+(e&&e.message?e.message:'error desconocido')+'. No se guardó nada; inténtalo de nuevo.';
  }
  a.enviando=false;render();
};
/* Los campos se guardan en memoria al escribir (sin re-dibujar la pantalla para no perder el cursor). */
(()=>{
  const app=document.getElementById('app');if(!app)return;
  const campo=e=>{const t=e.target;if(t&&t.dataset&&t.dataset.ay&&S.user){const a=ayudaSt();a[t.dataset.ay]=t.value;a.err='';a.ok='';}};
  app.addEventListener('input',campo);
  app.addEventListener('change',async e=>{
    const t=e.target;if(!t||!t.dataset||!S.user)return;
    campo(e);
    if(t.dataset.ayFiltro){ayudaSt().filtro=t.value;render();return;}
    if(t.dataset.ayEstado){
      const r=await run(()=>API.cambiarEstadoReporteAyuda(S.user.id,t.dataset.ayEstado,t.value),`Reporte ${t.dataset.ayEstado}: estado actualizado.`);
      render();return r;
    }
  });
})();

/* =====================================================================
   «Mi guía de uso» · guías por perfil dentro del Centro de ayuda, leídas EN la aplicación (sin PDF ni descargas).
   - El navegador NO decide qué guía ve cada perfil: pide la lista y cada guía al servidor (API.guiasUso / API.abrirGuia),
     que valida el rol del usuario en CADA solicitud. Aquí no existe ninguna tabla de roles→guías.
   - El texto y las capturas viven en un bucket privado; las capturas llegan por enlaces firmados que caducan a los 5 minutos y
     no se guardan en el dispositivo (el service worker no los cachea).
   - No usa ni modifica permisos de la matriz, y no toca «Reportar un problema» ni «Mis reportes».
   ===================================================================== */
const GU_TAGS=new Set(['p','h3','h4','ul','ol','li','b','strong','i','em','table','thead','tbody','tr','th','td','div','br','span','img','small']);
const GU_CLS=new Set(['call','warn','ver','rule','k','step','n','x','fig','c','t','si','no','box','cols','small','kicker','task','mute']);
const guNorm=t=>String(t==null?'':t).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const guSt=()=>{
  if(!S.guiaUso||S.guiaUso.uid!==S.user.id)S.guiaUso={uid:S.user.id,estado:'',guias:[],err:'',q:'',abierta:null,cont:null,sec:'',cargandoCont:false,errCont:'',ql:''};
  return S.guiaUso;
};
/* Mensaje claro y honesto según el motivo real (no se oculta el error). */
function guMsg(e,dflt){
  if(e instanceof ApiError){
    if(e.code==='OP_INVALIDA')return 'Las guías todavía no están activadas en el servidor (la API instalada no reconoce esta operación). Avisa a la Administradora.';
    return e.message;
  }
  return dflt;
}
/* Limpieza propia (lista blanca) del HTML recibido: aunque el servidor lo entrega ya limpio, aquí se vuelve a depurar. */
function guSanear(html,imagenes){
  const doc=new DOMParser().parseFromString('<body>'+String(html||'')+'</body>','text/html');
  (function rec(el){
    for(const h of [...el.children]){
      const t=h.tagName.toLowerCase();
      if(!GU_TAGS.has(t)){h.remove();continue;}
      if(t==='img'){
        const n=h.getAttribute('data-img')||'',alt=h.getAttribute('alt')||'',u=imagenes&&imagenes[n];
        for(const a of [...h.attributes])h.removeAttribute(a.name);
        if(!u||!/^https:\/\//i.test(u)){const ph=doc.createElement('span');ph.className='mute';ph.textContent='[Captura no disponible por ahora]';h.replaceWith(ph);continue;}
        h.setAttribute('src',u);h.setAttribute('alt',alt);h.setAttribute('loading','lazy');continue;
      }
      const cls=(h.getAttribute('class')||'').split(/\s+/).filter(c=>GU_CLS.has(c)).join(' ');
      for(const a of [...h.attributes])h.removeAttribute(a.name);
      if(cls)h.setAttribute('class',cls);
      rec(h);
    }
  })(doc.body);
  return doc.body.innerHTML;
}
function guiaAlEntrar(){
  const g=guSt();
  if(g.estado==='')setTimeout(guiaCargar,0);      /* primera vez en la sesión: se piden las guías al servidor */
  setTimeout(()=>{const t=document.querySelector('.tabs [aria-selected="true"]');if(t&&t.scrollIntoView)t.scrollIntoView({block:'nearest',inline:'center'});},0);   /* en el móvil la pestaña activa queda a la vista */
}
async function guiaCargar(){
  const g=guSt();
  if(g.estado==='cargando')return;
  if(typeof API.guiasUso!=='function'){g.estado='demo';render();return;}
  g.estado='cargando';g.err='';render();
  try{const r=await API.guiasUso(S.user.id);g.guias=(r&&r.guias)||[];g.estado='listo';}
  catch(e){g.estado='error';g.err=guMsg(e,'No se pudieron cargar las guías.');}
  render();
}
/* Busca por palabras (sin acentos ni mayúsculas) en el índice de las guías indicadas; todas las palabras deben aparecer. */
function guiaBuscar(guias,q){
  const terms=guNorm(q).split(/\s+/).filter(t=>t.length>1);
  if(!terms.length)return null;
  const out=[];
  for(const gu of guias)for(const s of gu.indice||[]){
    const tit=guNorm(s.titulo),txt=guNorm(s.titulo+' '+s.texto);
    if(!terms.every(t=>txt.includes(t)))continue;
    const i=txt.indexOf(terms[0]),fr=(s.titulo+' '+s.texto).slice(Math.max(0,i-40),i+110).replace(/\s+/g,' ').trim();
    out.push({gu,s,peso:terms.every(t=>tit.includes(t))?0:1,fr});
  }
  return out.sort((a,b)=>a.peso-b.peso).slice(0,25);
}
function guiaResultadosHTML(g){
  const r=guiaBuscar(g.guias,g.q);
  if(r===null)return '';
  if(!r.length)return `<div class="empty"><b>Sin resultados</b>Prueba con otra palabra (por ejemplo: viaje, factura, desvío, horario).</div>`;
  return `<div class="gu-res" role="list">${r.map(x=>`<button type="button" class="gu-hit" role="listitem" data-act="guiaAbrir" data-id="${esc(x.gu.id)}" data-sec="${esc(x.s.id)}"><b>${esc(x.s.titulo)}</b><span class="mute">Guía ${esc(x.gu.numero)} · ${esc(x.gu.titulo)}</span><span class="gu-fr">${esc(x.fr)}…</span></button>`).join('')}</div>`;
}
function guiaListaHTML(g){
  if(!g.guias.length)return empty('Aún no hay una guía para tu perfil','Cuando exista una guía para tu perfil aparecerá aquí.');
  return `<div class="gu-grid">${g.guias.map(x=>`<div class="card gu-card"><div class="gu-num">${esc(x.numero)}</div><div style="flex:1;min-width:0"><b>${esc(x.titulo)}</b><div class="mute">Perfil: ${esc(x.perfil)}${x.version?` · versión ${esc(x.version)}`:''}${x.fecha?` · ${esc(x.fecha)}`:''}${x.disponible?` · ${x.indice.length} secciones`:''}</div>
    ${x.disponible?'':'<div class="mute">Todavía no está cargada en el servidor. Avisa a la Administradora.</div>'}
    <div class="gu-acc"><button type="button" class="btn primary" data-act="guiaAbrir" data-id="${esc(x.id)}" ${x.disponible?'':'disabled'}>Leer guía</button></div></div></div>`).join('')}</div>`;
}
/* Índice de secciones de la guía abierta; el campo «Buscar en esta guía» lo filtra (por título y por texto). */
function guiaTocHTML(g,c,sec){
  const ind=((g.guias.find(x=>x.id===g.abierta)||{}).indice)||[];
  const ok=guiaBuscar([{indice:ind}],g.ql);
  const ids=ok?new Set(ok.map(x=>x.s.id)):null;
  const lista=c.secciones.filter(s=>!ids||ids.has(s.id));
  return lista.length?lista.map(s=>`<button type="button" ${s.id===sec.id?'aria-current="true"':''} data-act="guiaSec" data-sec="${esc(s.id)}">${esc(s.titulo)}</button>`).join(''):`<div class="mute" style="padding:8px">Ninguna sección coincide.</div>`;
}
function guiaLectorHTML(g){
  const gu=g.guias.find(x=>x.id===g.abierta),c=g.cont;
  const volver=`<div class="gu-bar"><button type="button" class="btn" data-act="guiaCerrar">← Mis guías</button> <button type="button" class="btn" data-act="guiaVolverAyuda">Volver al Centro de ayuda</button></div>`;
  if(g.cargandoCont)return volver+`<div class="empty"><b>Abriendo la guía…</b></div>`;
  if(g.errCont||!c)return volver+`<div class="alertbox" role="alert"><b>${esc(g.errCont||'No se pudo abrir la guía.')}</b></div>`;
  const n=c.secciones.length,k=Math.max(0,c.secciones.findIndex(s=>s.id===g.sec)),sec=c.secciones[k];
  const abierto=(typeof matchMedia==='function'&&matchMedia('(min-width:821px)').matches)?' open':'';
  const nav=`<div class="gu-nav">${k>0?`<button type="button" class="btn" data-act="guiaSec" data-sec="${esc(c.secciones[k-1].id)}">← ${esc(c.secciones[k-1].titulo)}</button>`:'<span></span>'}${k<n-1?`<button type="button" class="btn primary" data-act="guiaSec" data-sec="${esc(c.secciones[k+1].id)}">${esc(c.secciones[k+1].titulo)} →</button>`:'<span></span>'}</div>`;
  return volver+`<div class="gu-lector"><details class="gu-tocwrap"${abierto}><summary>Secciones de la guía ${esc(c.guia.numero)} <span class="mute">(${n})</span></summary>
    <div class="gu-find"><label class="sr" for="gu_ql">Buscar en esta guía</label><input id="gu_ql" type="search" data-gu-ql="1" value="${esc(g.ql)}" placeholder="Buscar en esta guía" autocomplete="off"></div>
    <nav id="gu_toc" class="gu-toc" aria-label="Secciones de la guía">${guiaTocHTML(g,c,sec)}</nav></details>
    <article class="card gu-art" tabindex="-1"><div class="gu-meta mute">Guía ${esc(c.guia.numero)} · ${esc(c.guia.titulo)}${c.guia.version?` · versión ${esc(c.guia.version)}`:''}${gu&&gu.perfil?` · Perfil ${esc(gu.perfil)}`:''} · Sección ${k+1} de ${n}</div><h2>${esc(sec.titulo)}</h2><div class="guiauso">${guSanear(sec.html,c.imagenes)}</div>${nav}</article></div>`;
}
function guiaHTML(){
  const g=guSt();
  if(g.estado==='demo')return `<div class="card fsec" style="max-width:760px"><h3>Mi guía de uso</h3><p>Las guías por perfil están disponibles cuando la aplicación está conectada al servidor. En modo demostración no se muestran.</p></div>`;
  if(g.estado===''||g.estado==='cargando')return `<div class="empty"><b>Cargando tus guías…</b></div>`;
  if(g.estado==='error')return `<div class="alertbox" role="alert"><b>${esc(g.err||'No se pudieron cargar las guías.')}</b></div><div style="margin-top:10px"><button type="button" class="btn" data-act="guiaReintentar">Reintentar</button></div>`;
  if(g.abierta)return guiaLectorHTML(g);
  return `<div style="max-width:980px">${g.guias.length?`<div class="fgroup"><label for="gu_q">Buscar por tarea o palabra clave</label><input id="gu_q" type="search" data-gu-q="1" value="${esc(g.q)}" placeholder="Ejemplo: desvío, horarios, factura, liquidación rechazada" autocomplete="off"></div><div id="gu_res" aria-live="polite">${guiaResultadosHTML(g)}</div>`:''}
    <h3 style="margin:14px 0 8px">${g.guias.length>1?'Guías disponibles para tu perfil':'Tu guía'}</h3>${guiaListaHTML(g)}</div>`;
}
const guiaArriba=()=>{const m=document.getElementById('main');if(m)m.scrollTop=0;};
ACT.guiaReintentar=async()=>{guSt().estado='';guiaCargar();};
ACT.guiaAbrir=async d=>{
  const g=guSt();
  g.abierta=d.id;g.sec=d.sec||'';g.ql='';g.cont=null;g.errCont='';g.cargandoCont=true;render();
  try{g.cont=await API.abrirGuia(S.user.id,d.id,'contenido');if((!g.sec||!g.cont.secciones.some(s=>s.id===g.sec))&&g.cont.secciones[0])g.sec=g.cont.secciones[0].id;}
  catch(e){g.errCont=guMsg(e,'No se pudo abrir la guía.');}
  g.cargandoCont=false;render();guiaArriba();
};
ACT.guiaSec=async d=>{const g=guSt();g.sec=d.sec;render();guiaArriba();};
ACT.guiaCerrar=async()=>{const g=guSt();g.abierta=null;g.cont=null;g.errCont='';g.ql='';render();};
ACT.guiaVolverAyuda=async()=>{const g=guSt();g.abierta=null;g.cont=null;g.errCont='';g.ql='';S.tab.ayuda='nuevo';render();};
/* El buscador actualiza solo los resultados (sin redibujar toda la pantalla) para no perder el cursor. */
(()=>{
  const app=document.getElementById('app');if(!app)return;
  app.addEventListener('input',e=>{
    const t=e.target;if(!t||!t.dataset||!S.user)return;
    if(t.dataset.guQ){const g=guSt();g.q=t.value;const r=document.getElementById('gu_res');if(r)r.innerHTML=guiaResultadosHTML(g);return;}
    if(t.dataset.guQl){const g=guSt();g.ql=t.value;const c=g.cont;if(!c)return;const sec=c.secciones.find(s=>s.id===g.sec)||c.secciones[0];const r=document.getElementById('gu_toc');if(r)r.innerHTML=guiaTocHTML(g,c,sec);}
  });
})();
