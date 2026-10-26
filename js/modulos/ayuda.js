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
   «Mi guía de uso» · guías por perfil dentro del Centro de ayuda, leídas EN la aplicación.
   - Las guías están incorporadas al código: js/guias-data.js (texto, pasos, tablas, avisos) y assets/guias/ (capturas, rutas
     relativas). Se cargan al abrir esta pestaña. No usa PDF, ni descargas, ni Supabase, ni ninguna operación nueva de la API.
   - Cada usuario ve solo las guías de su perfil (S.user.rol viene del perfil que entrega el servidor al iniciar sesión; el
     Administrador ve las ocho). Es un filtro de PRESENTACIÓN: las guías no son un secreto y no conceden ningún permiso.
   - No usa ni modifica permisos de la matriz, y no toca «Reportar un problema» ni «Mis reportes».
   ===================================================================== */
const GU_TAGS=new Set(['p','h3','h4','ul','ol','li','b','strong','i','em','table','thead','tbody','tr','th','td','div','br','span','img','small']);
const GU_CLS=new Set(['call','warn','ver','rule','k','step','n','x','fig','c','t','si','no','box','cols','small','kicker','task','mute']);
const GU_IMG=/^[A-Za-z0-9_-]{1,60}\.(png|jpg|jpeg|webp)$/;
const guNorm=t=>String(t==null?'':t).normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase();
const guSt=()=>{
  if(!S.guiaUso||S.guiaUso.uid!==S.user.id)S.guiaUso={uid:S.user.id,estado:'',err:'',q:'',abierta:null,sec:'',ql:''};
  return S.guiaUso;
};
/* Guías del perfil del usuario (el Administrador, las ocho). Cada una trae su índice de búsqueda. */
function guiasDelUsuario(){
  const L=Array.isArray(window.GUIAS_USO)?window.GUIAS_USO:[];
  return L.filter(x=>x&&Array.isArray(x.roles)&&x.roles.includes(S.user.rol)).map(x=>Object.assign({},x,{indice:x.secciones.map(s=>({id:s.id,titulo:s.titulo,texto:s.busqueda||''}))}));
}
/* Limpieza (lista blanca) del HTML de cada sección; las capturas se resuelven a rutas locales de assets/guias/. */
function guSanear(html,gu){
  const doc=new DOMParser().parseFromString('<body>'+String(html||'')+'</body>','text/html');
  const permitidas=new Set((gu&&gu.imagenes)||[]);
  (function rec(el){
    for(const h of [...el.children]){
      const t=h.tagName.toLowerCase();
      if(!GU_TAGS.has(t)){h.remove();continue;}
      if(t==='img'){
        const n=h.getAttribute('data-img')||'',alt=h.getAttribute('alt')||'';
        for(const a of [...h.attributes])h.removeAttribute(a.name);
        if(!GU_IMG.test(n)||!permitidas.has(n)){const ph=doc.createElement('span');ph.className='mute';ph.textContent='[Captura no disponible]';h.replaceWith(ph);continue;}
        h.setAttribute('src','assets/guias/'+n);h.setAttribute('alt',alt);h.setAttribute('loading','lazy');h.setAttribute('class','gu-img');continue;
      }
      const cls=(h.getAttribute('class')||'').split(/\s+/).filter(c=>GU_CLS.has(c)).join(' ');
      for(const a of [...h.attributes])h.removeAttribute(a.name);
      if(cls)h.setAttribute('class',cls);
      rec(h);
    }
  })(doc.body);
  return doc.body.innerHTML;
}
/* Carga js/guias-data.js (mismo origen) la primera vez que se abre la pestaña. */
function guCargarDatos(){
  if(Array.isArray(window.GUIAS_USO))return Promise.resolve();
  return new Promise((ok,mal)=>{const s=document.createElement('script');s.src='js/guias-data.js';s.onload=()=>Array.isArray(window.GUIAS_USO)?ok():mal(new Error('vacío'));s.onerror=()=>mal(new Error('red'));document.head.appendChild(s);});
}
function guiaAlEntrar(){
  const g=guSt();
  if(g.estado==='')setTimeout(guiaCargar,0);
  setTimeout(()=>{const t=document.querySelector('.tabs [aria-selected="true"]');if(t&&t.scrollIntoView)t.scrollIntoView({block:'nearest',inline:'center'});},0);   /* en el móvil la pestaña activa queda a la vista */
}
async function guiaCargar(){
  const g=guSt();
  if(g.estado==='cargando')return;
  g.estado='cargando';g.err='';render();
  try{await guCargarDatos();g.estado='listo';}
  catch(e){g.estado='error';g.err='No se pudo cargar el contenido de las guías. Revisa tu conexión y vuelve a intentarlo.';}
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
function guiaResultadosHTML(guias,g){
  const r=guiaBuscar(guias,g.q);
  if(r===null)return '';
  if(!r.length)return `<div class="empty"><b>Sin resultados</b>Prueba con otra palabra (por ejemplo: viaje, factura, desvío, horario).</div>`;
  return `<div class="gu-res" role="list">${r.map(x=>`<button type="button" class="gu-hit" role="listitem" data-act="guiaAbrir" data-id="${esc(x.gu.id)}" data-sec="${esc(x.s.id)}"><b>${esc(x.s.titulo)}</b><span class="mute">Guía ${esc(x.gu.numero)} · ${esc(x.gu.titulo)}</span><span class="gu-fr">${esc(x.fr)}…</span></button>`).join('')}</div>`;
}
function guiaTarjetaHTML(x){
  const tareas=x.secciones.filter(s=>/^Tarea:/.test(s.titulo)).map(s=>s.titulo.replace(/^Tarea:\s*/,''));
  return `<div class="card gu-card"><div class="gu-num">${esc(x.numero)}</div><div style="flex:1;min-width:0"><b>${esc(x.titulo)}</b><div class="mute">Perfil: ${esc(x.perfil)} · versión ${esc(x.version)}${x.fecha?` · ${esc(x.fecha)}`:''} · ${x.secciones.length} secciones</div>
    ${tareas.length?`<div class="gu-chips" aria-label="Funcionalidades que explica">${tareas.slice(0,4).map(t=>`<span class="gu-chip">${esc(t)}</span>`).join('')}${tareas.length>4?`<span class="gu-chip mute">+${tareas.length-4} más</span>`:''}</div>`:''}
    <div class="gu-acc"><button type="button" class="btn primary" data-act="guiaAbrir" data-id="${esc(x.id)}">Leer guía</button></div></div></div>`;
}
function guiaListaHTML(guias){
  if(!guias.length)return empty('Aún no hay una guía para tu perfil','Cuando exista una guía para tu perfil aparecerá aquí.');
  const propias=guias.filter(x=>x.roles[0]===S.user.rol),otras=guias.filter(x=>x.roles[0]!==S.user.rol);
  const bloque=(t,l)=>l.length?`<h3 style="margin:14px 0 8px">${t}</h3><div class="gu-grid">${l.map(guiaTarjetaHTML).join('')}</div>`:'';
  return otras.length?bloque('Mi guía',propias)+bloque('Guías de los demás perfiles',otras):bloque(propias.length>1?'Guías de tu perfil':'Tu guía',propias);
}
/* Índice de secciones de la guía abierta; el campo «Buscar en esta guía» lo filtra (por título y por texto). */
function guiaTocHTML(g,gu,sec){
  const ok=guiaBuscar([gu],g.ql);
  const ids=ok?new Set(ok.map(x=>x.s.id)):null;
  const lista=gu.secciones.filter(s=>!ids||ids.has(s.id));
  return lista.length?lista.map(s=>`<button type="button" ${s.id===sec.id?'aria-current="true"':''} data-act="guiaSec" data-sec="${esc(s.id)}">${esc(s.titulo)}</button>`).join(''):`<div class="mute" style="padding:8px">Ninguna sección coincide.</div>`;
}
function guiaLectorHTML(g,guias){
  const gu=guias.find(x=>x.id===g.abierta);
  const volver=`<div class="gu-bar"><button type="button" class="btn" data-act="guiaCerrar">← Mis guías</button> <button type="button" class="btn" data-act="guiaVolverAyuda">Volver al Centro de ayuda</button></div>`;
  if(!gu)return volver+`<div class="alertbox" role="alert"><b>Esa guía no está disponible para tu perfil.</b></div>`;
  const n=gu.secciones.length,k=Math.max(0,gu.secciones.findIndex(s=>s.id===g.sec)),sec=gu.secciones[k];
  const abierto=(typeof matchMedia==='function'&&matchMedia('(min-width:821px)').matches)?' open':'';
  const nav=`<div class="gu-nav">${k>0?`<button type="button" class="btn" data-act="guiaSec" data-sec="${esc(gu.secciones[k-1].id)}">← ${esc(gu.secciones[k-1].titulo)}</button>`:'<span></span>'}${k<n-1?`<button type="button" class="btn primary" data-act="guiaSec" data-sec="${esc(gu.secciones[k+1].id)}">${esc(gu.secciones[k+1].titulo)} →</button>`:'<span></span>'}</div>`;
  return volver+`<div class="gu-lector"><details class="gu-tocwrap"${abierto}><summary>Secciones de la guía ${esc(gu.numero)} <span class="mute">(${n})</span></summary>
    <div class="gu-find"><label class="sr" for="gu_ql">Buscar en esta guía</label><input id="gu_ql" type="search" data-gu-ql="1" value="${esc(g.ql)}" placeholder="Buscar en esta guía" autocomplete="off"></div>
    <nav id="gu_toc" class="gu-toc" aria-label="Secciones de la guía">${guiaTocHTML(g,gu,sec)}</nav></details>
    <article class="card gu-art" tabindex="-1"><div class="gu-meta mute">Guía ${esc(gu.numero)} · ${esc(gu.titulo)} · versión ${esc(gu.version)} · Perfil ${esc(gu.perfil)} · Sección ${k+1} de ${n}</div><h2>${esc(sec.titulo)}</h2><div class="guiauso">${guSanear(sec.html,gu)}</div>${nav}</article></div>`;
}
function guiaHTML(){
  const g=guSt();
  if(g.estado===''||g.estado==='cargando')return `<div class="empty"><b>Cargando tus guías…</b></div>`;
  if(g.estado==='error')return `<div class="alertbox" role="alert"><b>${esc(g.err)}</b></div><div style="margin-top:10px"><button type="button" class="btn" data-act="guiaReintentar">Reintentar</button></div>`;
  const guias=guiasDelUsuario();
  if(g.abierta)return guiaLectorHTML(g,guias);
  return `<div style="max-width:980px">${guias.length?`<div class="fgroup"><label for="gu_q">Buscar por tarea o palabra clave</label><input id="gu_q" type="search" data-gu-q="1" value="${esc(g.q)}" placeholder="Ejemplo: desvío, horarios, factura, liquidación rechazada" autocomplete="off"></div><div id="gu_res" aria-live="polite">${guiaResultadosHTML(guias,g)}</div>`:''}
    ${guiaListaHTML(guias)}</div>`;
}
const guiaArriba=()=>{const m=document.getElementById('main');if(m)m.scrollTop=0;};
ACT.guiaReintentar=async()=>{guSt().estado='';guiaCargar();};
ACT.guiaAbrir=async d=>{
  const g=guSt(),gu=guiasDelUsuario().find(x=>x.id===d.id);
  if(!gu){toast('Esa guía no está disponible para tu perfil.','err');return;}
  g.abierta=gu.id;g.ql='';g.sec=gu.secciones.some(s=>s.id===d.sec)?d.sec:gu.secciones[0].id;render();guiaArriba();
};
ACT.guiaSec=async d=>{const g=guSt();g.sec=d.sec;render();guiaArriba();};
ACT.guiaCerrar=async()=>{const g=guSt();g.abierta=null;g.ql='';render();};
ACT.guiaVolverAyuda=async()=>{const g=guSt();g.abierta=null;g.ql='';S.tab.ayuda='nuevo';render();};
/* El buscador actualiza solo los resultados (sin redibujar toda la pantalla) para no perder el cursor. */
(()=>{
  const app=document.getElementById('app');if(!app)return;
  app.addEventListener('input',e=>{
    const t=e.target;if(!t||!t.dataset||!S.user)return;
    if(t.dataset.guQ){const g=guSt();g.q=t.value;const r=document.getElementById('gu_res');if(r)r.innerHTML=guiaResultadosHTML(guiasDelUsuario(),g);return;}
    if(t.dataset.guQl){const g=guSt(),gu=guiasDelUsuario().find(x=>x.id===g.abierta);g.ql=t.value;if(!gu)return;const sec=gu.secciones.find(s=>s.id===g.sec)||gu.secciones[0];const r=document.getElementById('gu_toc');if(r)r.innerHTML=guiaTocHTML(g,gu,sec);}
  });
})();
/* Si una captura no carga, se avisa en el texto (no se deja un hueco silencioso). */
(()=>{
  const app=document.getElementById('app');if(!app)return;
  app.addEventListener('error',e=>{const t=e.target;if(t&&t.tagName==='IMG'&&t.classList.contains('gu-img')){const ph=document.createElement('span');ph.className='mute';ph.textContent='[Captura no disponible]';t.replaceWith(ph);}},true);
})();
