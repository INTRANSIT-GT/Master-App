/* =====================================================================
   BACKEND · decide de dónde salen y adónde van los datos.
   - 'demo': motor local con datos de ejemplo en este navegador (no es una base real).
   - 'supabase': autenticación de Supabase + Edge Function "api". El navegador NUNCA decide permisos:
       todas las lecturas y escrituras las valida el servidor con el usuario autenticado (JWT).
   Solo se usa la clave publishable/anon. Si detecta una clave service_role, se niega a funcionar.
   ===================================================================== */
const BACKEND={modo:'demo',sb:null,bloqueado:'',
  async iniciar(){loadAll();render();},
  async login(u,p){return API.login(u,p);},
  async logout(){if(S.user)API.logout(S.user.id);},
  async refrescar(){},
  async sincronizarFlota(){throw new ApiError('DEMO','La sincronización con Fleetio solo funciona con Supabase configurado.');}
};
if(!API.mantenimientos)API.mantenimientos=async()=>[];
if(!API.gastos)API.gastos=async()=>[];
(function(){
  const C=MASTER_CONFIG;
  if(!(C.SUPABASE_URL&&C.SUPABASE_PUBLISHABLE_KEY))return;                       /* sin configurar → demostración */
  const k=String(C.SUPABASE_PUBLISHABLE_KEY).trim();
  let rol='';try{rol=JSON.parse(atob(k.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).role||'';}catch(e){}
  if(/^sb_secret_/i.test(k)||rol==='service_role'){BACKEND.bloqueado='La clave configurada es SECRETA (service_role). No se usa nunca en el navegador: reemplázala por la clave publishable.';BACKEND.modo='bloqueado';
    BACKEND.iniciar=async()=>{loadAll();render();alert(BACKEND.bloqueado);};return;}
  if(!/^https:\/\/[a-z0-9-]+\.supabase\.(co|in)\/?$/i.test(C.SUPABASE_URL.trim())&&!/^http:\/\/(localhost|127\.0\.0\.1)/.test(C.SUPABASE_URL.trim())){console.warn('SUPABASE_URL no parece válida');}
  if(!(window.supabase&&window.supabase.createClient)){console.warn('No se cargó supabase-js: modo demostración');return;}
  BACKEND.modo='supabase';
  const sb=BACKEND.sb=window.supabase.createClient(C.SUPABASE_URL.trim(),k,{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:false}});
  const MUT=['crearViaje','editarViaje','iniciar','finalizar','enviarLiquidacion','aprobar','devolver','aprobarShipmentDuplicado','prepararFactura','actualizarFactura','enviarFactura','emitirFactura','registrarCobro','corregirFactura','anularAgrupacion','registrarImportes','registrarPago','anularPago','crearTarifa','editarTarifa','cambiarEstadoTarifa','aplicarTarifa','aplicarTarifasPendientes','cargarMem','solicitarRuta','registrarRuta','validarRuta','rechazarRuta','aprobarRutaComercial','aprobarRutaTransporte','marcarNotificacion','setPermiso','guardarUsuario','guardarCliente','guardarReglasTorre','guardarOpcionesTorre'];
  const err=b=>{const e=new ApiError(b.code||'SERVIDOR',b.message||'Operación rechazada por el servidor.');if(b.faltantes)e.faltantes=b.faltantes;return e;};
  async function llamar(op,args){
    if(!navigator.onLine)throw new ApiError('SIN_CONEXION','Sin conexión con el servidor. La operación NO se guardó.');
    let r;
    try{r=await sb.functions.invoke('api',{body:{op,args}});}
    catch(e){throw new ApiError('SIN_CONEXION','No se pudo contactar al servidor. La operación NO se guardó.');}
    if(r.error){
      let b=null;try{b=await r.error.context.json();}catch(_){}
      if(b&&b.ok===false)throw err(b);
      throw new ApiError('SERVIDOR','El servidor no respondió correctamente. La operación NO se guardó.');
    }
    if(!r.data||r.data.ok===false)throw err(r.data||{});
    return r.data;
  }
  function hidratar(sn){
    const db=blankDB();
    ['usuarios','acceso','permisos','clientes','liquidaciones','evidencias','agrupaciones','audit','pagos','rutas','tarifas','mem','notificaciones'].forEach(k=>{db[k]=sn[k]||[];});
    db.trips=sn.trips||[];db.config=sn.config||{torreEstatus:[]};
    DB=db;
    [[PILOTOS,sn.catalogos.pilotos],[FLOTA,sn.catalogos.flota],[DESTINOS,sn.catalogos.destinos]].forEach(([a,n])=>{a.length=0;a.push(...(n||[]));});
    syncRefs();
    S.user=DB.usuarios.find(u=>u.id===sn.yo)||S.user;
    BACKEND.conectado=true;
  }
  async function subir(prefijo,dataUrl){
    const blob=await (await fetch(dataUrl)).blob();
    const ext={'image/jpeg':'jpg','image/png':'png','image/webp':'webp','application/pdf':'pdf','image/svg+xml':'svg'}[blob.type]||'bin';
    const path=`${prefijo}/${crypto.randomUUID()}.${ext}`;
    const {error}=await sb.storage.from('evidencias').upload(path,blob,{contentType:blob.type,upsert:false});
    if(error)throw new ApiError('ALMACENAMIENTO','No se pudo subir el archivo al almacenamiento protegido. No se guardó nada.');
    return {path};
  }
  MUT.forEach(op=>{API[op]=async(uid,...args)=>{
    if(op==='enviarLiquidacion'&&typeof args[1]==='string'&&args[1].startsWith('data:'))args[1]=await subir('viajes/'+args[0],args[1]);
    if(op==='emitirFactura'&&args[1]&&typeof args[1].archivo==='string'&&args[1].archivo.startsWith('data:'))args[1]=Object.assign({},args[1],{archivo:await subir('facturas/'+args[0],args[1].archivo)});
    const r=await llamar(op,args);
    if(r.snapshot)hidratar(r.snapshot);
    return r.result;
  };});
  API.verificarAuditoria=async()=>(await llamar('verificarAuditoria',[])).result;
  API.mantenimientos=async(uid,o)=>(await llamar('mantenimientos',[o||{}])).result;
  API.gastos=async(uid,o)=>(await llamar('gastos',[o||{}])).result;
  BACKEND.sincronizarFlota=async()=>{
    let r;try{r=await sb.functions.invoke('sync-flota',{body:{}});}catch(e){throw new ApiError('SIN_CONEXION','No se pudo contactar al servidor.');}
    if(r.error){let b=null;try{b=await r.error.context.json();}catch(_){}throw new ApiError('SERVIDOR',(b&&b.message)||'No se pudo sincronizar con Fleetio.');}
    if(!r.data||r.data.ok===false)throw new ApiError('SERVIDOR',(r.data&&r.data.message)||'No se pudo sincronizar con Fleetio.');
    return r.data.result;
  };
  BACKEND.refrescar=async()=>{const r=await llamar('snapshot',[]);hidratar(r.snapshot);};
  BACKEND.login=async(email,pass)=>{
    const {data,error}=await sb.auth.signInWithPassword({email:String(email||'').trim(),password:String(pass||'')});
    if(error||!data||!data.user)throw new ApiError('LOGIN','Correo o contraseña incorrectos.');
    try{await BACKEND.refrescar();}catch(e){await sb.auth.signOut();throw e;}
    const u=DB.usuarios.find(x=>x.id===data.user.id);
    if(!u||!u.activo){await sb.auth.signOut();throw new ApiError('LOGIN','Tu cuenta no tiene un perfil activo en la aplicación. Pide a la administradora que la habilite.');}
    return u;
  };
  BACKEND.logout=async()=>{try{await sb.auth.signOut();}catch(e){}DB=blankDB();syncRefs();};
  BACKEND.iniciar=async()=>{
    DB=blankDB();syncRefs();
    try{const p=JSON.parse(localStorage.getItem(LSP)||'null');if(p)PREF=Object.assign(PREF,p);}catch(e){}
    try{
      const {data}=await sb.auth.getSession();
      if(data&&data.session&&navigator.onLine){await BACKEND.refrescar();if(S.user&&S.user.activo){go(homeOf(S.user));return;}}
    }catch(e){/* sesión vencida o sin conexión: se muestra el ingreso */}
    S.user=null;S.view='login';render();
  };
})();
window.addEventListener('online',()=>{if(typeof render==='function')render();});
window.addEventListener('offline',()=>{if(typeof render==='function')render();});
