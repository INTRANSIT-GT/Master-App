/* =====================================================================
   PWA · instalación como aplicación independiente.
   No se promete que se instale igual en todos los dispositivos: se comprueban las capacidades del navegador.
   El service worker guarda SOLO archivos estáticos de la interfaz; nunca datos operativos.
   ===================================================================== */
const PWA={prompt:null,instalada:false,
  esStandalone(){return (window.matchMedia&&matchMedia('(display-mode: standalone)').matches)||navigator.standalone===true;},
  soporta(){return ('serviceWorker' in navigator)&&(location.protocol==='https:'||location.hostname==='localhost'||location.hostname==='127.0.0.1');},
  plataforma(){
    const ua=navigator.userAgent||'',p=navigator.platform||'';
    if(/iPhone|iPad|iPod/.test(ua)||(p==='MacIntel'&&navigator.maxTouchPoints>1))return 'ios';
    if(/Android/i.test(ua))return 'android';
    if(/Windows/i.test(ua))return 'windows';
    if(/Mac/i.test(ua))return 'mac';
    return 'otro';
  },
  puedeMostrarInstalar(){
    if(PWA.esStandalone()||PWA.instalada)return false;
    return PWA.soporta()||(PWA.plataforma()==='ios'&&location.protocol==='https:');
  },
  async instalar(){
    if(!PWA.prompt)return 'no_disponible';
    try{PWA.prompt.prompt();const r=await PWA.prompt.userChoice;PWA.prompt=null;return r.outcome;}catch(e){PWA.prompt=null;return 'error';}
  },
  ayudaHTML(){
    const p=PWA.plataforma(),nom={ios:'iPhone o iPad',android:'Android',windows:'Windows',mac:'Mac',otro:'otro dispositivo'}[p];
    const B=(id,t,pasos)=>`<div class="cyc" style="${p===id?'border-color:var(--brand)':''}"><b>${t}${p===id?' · tu dispositivo':''}</b><ol style="margin:8px 0 0 18px;padding:0;line-height:1.7">${pasos.map(x=>`<li>${x}</li>`).join('')}</ol></div>`;
    return `<div class="alertbox info" style="margin-bottom:10px">Tu dispositivo parece ser: <b>${nom}</b>. ${PWA.prompt?'Tu navegador permite instalarla directamente con el botón <b>Instalar aplicación</b>.':'Si tu navegador no muestra la opción de instalar, no la ofrece en este dispositivo.'}</div>
    ${B('windows','Windows (Edge o Chrome)',['Abre la dirección de la aplicación en <b>Microsoft Edge</b> o <b>Google Chrome</b>.','Toca el botón <b>Instalar aplicación</b> o el ícono de instalar al final de la barra de direcciones.','Confirma con <b>Instalar</b>. Se crea un acceso en el menú Inicio y puedes fijarlo a la barra de tareas o al escritorio.'])}
    ${B('android','Android (Chrome)',['Abre la dirección en <b>Chrome</b>.','Toca <b>Instalar aplicación</b>, o el menú <b>⋮</b> → <b>Instalar aplicación</b> (a veces dice <b>Agregar a la pantalla principal</b>).','Confirma. Aparece el ícono en tu pantalla de inicio y se abre sin la barra del navegador.'])}
    ${B('ios','iPhone / iPad (Safari)',['Abre la dirección en <b>Safari</b> (otros navegadores pueden no ofrecer la opción).','Toca el botón <b>Compartir</b> (el cuadro con una flecha hacia arriba).','Elige <b>Agregar a pantalla de inicio</b> y confirma con <b>Agregar</b>.'])}
    <div class="mute" style="font-size:12.5px">La aplicación necesita conexión para consultar y guardar datos. Sin conexión mostrará un aviso y no confirmará ninguna operación.</div>`;
  }
};
window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();PWA.prompt=e;if(typeof render==='function'&&typeof S!=='undefined')render();});
window.addEventListener('appinstalled',()=>{PWA.instalada=true;PWA.prompt=null;if(typeof render==='function')render();});
if(PWA.soporta()&&location.protocol!=='file:'){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('./service-worker.js',{updateViaCache:'none'}).then(r=>r.update()).catch(()=>{});});
}
