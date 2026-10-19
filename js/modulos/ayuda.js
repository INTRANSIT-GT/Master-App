/* ayuda.js · Sección «Ayuda» (todos los perfiles).
   Cualquier usuario puede reportar una falla (módulo, tipo, descripción y qué intentaba hacer) y consultar SUS reportes.
   Solo el Administrador ve todos los reportes y cambia su estado (Pendiente · En revisión · Resuelto).
   No requiere ningún permiso de la matriz y no abre ningún módulo restringido: solo guarda y lee reportes. */
const AYUDA_TONO={PENDIENTE:'alert',EN_REVISION:'progress',RESUELTO:'done'};
const ayudaSt=()=>{
  if(!S.ayuda||S.ayuda.uid!==S.user.id)S.ayuda={uid:S.user.id,tipo:'',modulo:'',descripcion:'',intento:'',err:'',ok:'',enviando:false,filtro:''};
  return S.ayuda;
};
const ayudaEstadoChip=e=>chip(AYUDA_TONO[e]||'neutral',AYUDA_ESTADOS[e]||e);
function ayudaFormHTML(a){
  const opt=(lista,v,ph)=>`<option value="">${ph}</option>`+lista.map(x=>`<option value="${esc(x)}" ${x===v?'selected':''}>${esc(x)}</option>`).join('');
  return `<div class="card fsec" style="max-width:760px"><h3>Reportar un problema</h3>
    ${a.ok?`<div class="alertbox okb" role="status" style="margin-bottom:12px"><b>${esc(a.ok)}</b></div>`:''}
    ${a.err?`<div class="alertbox" role="alert" style="margin-bottom:12px"><b>${esc(a.err)}</b></div>`:''}
    <div class="fgroup"><label for="ay_tipo">Tipo de problema <span class="mute">*</span></label><select id="ay_tipo" data-ay="tipo">${opt(AYUDA_TIPOS,a.tipo,'Selecciona el tipo de problema')}</select></div>
    <div class="fgroup"><label for="ay_modulo">Módulo afectado <span class="mute">*</span></label><select id="ay_modulo" data-ay="modulo">${opt(AYUDA_MODULOS,a.modulo,'Selecciona el módulo')}</select></div>
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
  const a=ayudaSt(),adm=S.user.rol==='ADMIN';
  let n=0;try{n=API.reportesAyuda(S.user.id).length;}catch(e){}
  const k=S.tab.ayuda==='lista'?'lista':'nuevo';
  return `<div class="inner" style="max-width:1100px">${pageHead('Ayuda',adm?'Reportes de fallas enviados por los usuarios':'Reporta una falla o problema de la aplicación y consulta el estado de tus reportes')}
    ${tabs('ayuda',[{k:'nuevo',l:'Reportar un problema'},{k:'lista',l:adm?`Todos los reportes (${n})`:`Mis reportes (${n})`}],k)}
    <div style="margin-top:14px">${k==='nuevo'?ayudaFormHTML(a):ayudaListaHTML(a,adm)}</div></div>`;
};
ACT.ayudaEnviar=async()=>{
  const a=ayudaSt();
  if(a.enviando)return;
  a.err='';a.ok='';a.enviando=true;render();
  try{
    const r=await API.crearReporteAyuda(S.user.id,{tipo:a.tipo,modulo:a.modulo,descripcion:a.descripcion,intento:a.intento});
    Object.assign(a,{tipo:'',modulo:'',descripcion:'',intento:'',err:'',ok:`Reporte ${r.id} enviado. El Administrador fue notificado; puedes ver su estado en «${S.user.rol==='ADMIN'?'Todos los reportes':'Mis reportes'}».`});
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
