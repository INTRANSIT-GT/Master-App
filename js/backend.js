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
/* Sin servidor (demostración) no hay ventana ni histórico que cargar: lo que hay en pantalla es todo lo que hay. */
if(!API.viajesAnteriores)API.viajesAnteriores=async()=>({trips:[],liquidaciones:[],evidencias:[],audit:[],antesDe:'',pagina:0});
if(!API.buscarViajes)API.buscarViajes=async(uid,o)=>({trips:[],liquidaciones:[],evidencias:[],audit:[],texto:(o&&o.texto)||'',pagina:0});
if(!API.resumenHistorico)API.resumenHistorico=async(uid,o)=>API.resumenFinanciero(uid,o);
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
  const MUT=['crearViaje','editarViaje','iniciar','finalizar','torreMoverEstado','torreEditarHorarios','enviarLiquidacion','aprobar','devolver','aprobarShipmentDuplicado','prepararFactura','actualizarFactura','enviarFactura','emitirFactura','registrarCobro','corregirFactura','anularAgrupacion','registrarImportes','registrarPago','anularPago','crearOrdenPago','adjuntarDocumentoOrden','registrarTransferencia','anularOrdenPago','crearTarifa','editarTarifa','cambiarEstadoTarifa','aplicarTarifa','aplicarTarifasPendientes','cargarMem','solicitarRuta','registrarRuta','validarRuta','rechazarRuta','aprobarRutaComercial','aprobarRutaTransporte','marcarNotificacion','setPermiso','setAcceso','guardarUsuario','guardarCliente','guardarReglasTorre','activarUsuario','cambiarClave','guardarCatalogo','guardarPiloto','cambiarEstadoPiloto','crearReporteAyuda','cambiarEstadoReporteAyuda'];
  const err=b=>{const e=new ApiError(b.code||'SERVIDOR',b.message||'Operación rechazada por el servidor.');if(b.faltantes)e.faltantes=b.faltantes;return e;};
  async function llamar(op,args){
    if(!navigator.onLine)throw new ApiError('SIN_CONEXION','Sin conexión con el servidor. La operación NO se guardó.');
    let r;
    try{r=await sb.functions.invoke('api',{body:{op,args}});}
    catch(e){throw new ApiError('SIN_CONEXION','No se pudo contactar al servidor. La operación NO se guardó.');}
    if(r.error){
      const ctx=r.error.context,st=(ctx&&ctx.status)||'';let b=null;
      try{b=await ctx.clone().json();}catch(_){try{b=await ctx.clone().text();}catch(__){}}
      if(b&&typeof b==='object'&&b.ok===false)throw err(b);
      const det=typeof b==='string'?b.replace(/\s+/g,' ').slice(0,160):'';
      throw new ApiError('SERVIDOR','El servidor no respondió correctamente'+(st?' (HTTP '+st+')':'')+(det?' · '+det:'')+'. La operación NO se guardó.');
    }
    if(!r.data||r.data.ok===false)throw err(r.data||{});
    return r.data;
  }
  /* La ventana de viajes se puede ampliar a pedido (viajesAnteriores). Al refrescar —y se refresca después de
     cada guardado— se conserva lo que el usuario ya había cargado, para no perder su consulta. */
  function conservarViejos(db,previo){
    const pedidos=new Set(S.cargadosViejos||[]);      /* solo lo que el usuario pidió a mano con «cargar anteriores» */
    if(!pedidos.size||!previo||!previo.trips||!previo.trips.length)return;
    const actual=new Set((db.trips||[]).map(t=>t.id));
    const viejos=(previo.trips||[]).filter(t=>pedidos.has(t.id)&&!actual.has(t.id));
    if(!viejos.length)return;
    db.trips.push(...viejos);
    for(const k of ['liquidaciones','evidencias','audit']){
      const ya=new Set((db[k]||[]).map(x=>x.id));
      for(const x of (previo[k]||[])) if(!ya.has(x.id)) (db[k]=db[k]||[]).push(x);
    }
    if(db.audit)db.audit.sort((a,b)=>a.id<b.id?-1:1);
  }
  function hidratar(sn){
    const previo=DB;
    const db=blankDB();
    ['usuarios','acceso','permisos','clientes','liquidaciones','evidencias','agrupaciones','audit','pagos','ordenesPago','rutas','tarifas','mem','notificaciones','reportesAyuda'].forEach(k=>{db[k]=sn[k]||[];});
    db.trips=sn.trips||[];db.config=sn.config||{};
    /* Ventana de viajes que llegó del servidor (null en demostración): la pantalla la muestra y ofrece cargar más. */
    db.ventana=sn.ventana||null;
    conservarViejos(db,previo);
    S.finHist=undefined;S.finHistErr='';        /* los totales del histórico se vuelven a pedir al servidor */
    db.catalogosListas=(sn.catalogos&&sn.catalogos.listas)||{};   /* las listas del sistema vienen de la base */
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
    if(op==='adjuntarDocumentoOrden'&&args[1]&&args[1].data){
      const up=await subir('pagos/'+args[0],args[1].data);
      args[1]={path:up.path,nombre:String(args[1].nombre||'').slice(0,80)};
    }
    if(op==='registrarTransferencia'&&args[1]){
      const d=Object.assign({},args[1]);
      for(const k of ['evidencia','factura']) if(d[k]&&d[k].data){const b=await subir('pagos/'+args[0],d[k].data);d[k]={path:b.path,nombre:String(d[k].nombre||'').slice(0,80)};}
      args[1]=d;
    }
    const r=await llamar(op,args);
    /* La escritura y la lectura completa se separan: así el guardado no excede el límite de CPU de la Edge Function. */
    try{await BACKEND.refrescar();}catch(e){console.warn('El cambio se guardó; no se pudo refrescar la vista todavía.',e);}
    return r.result;
  };});
  API.verificarAuditoria=async()=>(await llamar('verificarAuditoria',[])).result;
  API.mantenimientos=async(uid,o)=>(await llamar('mantenimientos',[o||{}])).result;
  /* Totales de TODO el histórico (los calcula el servidor con el mismo motor): no dependen de la ventana cargada. */
  API.resumenHistorico=async(uid,o)=>(await llamar('resumenHistorico',[o||{}])).result;
  /* Trae viajes que no están en la ventana (páginas del histórico o resultados de una búsqueda) y los une a lo
     que ya está en pantalla: viajes, liquidaciones, evidencias y bitácora. */
  const unirPagina=r=>{
    const unir=(arr,clave)=>{const m=new Map((DB[clave]||[]).map(x=>[x.id,x]));for(const x of (arr||[]))m.set(x.id,x);DB[clave]=[...m.values()];};
    unir(r.trips,'trips');unir(r.liquidaciones,'liquidaciones');unir(r.evidencias,'evidencias');unir(r.audit,'audit');
    DB.audit.sort((a,b)=>a.id<b.id?-1:1);
    if(DB.ventana)DB.ventana.cargados=(DB.trips||[]).length;
    /* Se recuerda lo cargado a mano para no perderlo en los refrescos (cada guardado refresca la pantalla). */
    S.cargadosViejos=[...new Set([...(S.cargadosViejos||[]),...(r.trips||[]).map(t=>t.id)])];
    syncRefs();
  };
  API.viajesAnteriores=async(uid,o)=>{
    const r=(await llamar('viajesAnteriores',[o||{}])).result||{};
    unirPagina(r);
    return r;
  };
  /* Busca en TODO el histórico (n.º de viaje, No. de transporte, producto, unidad, placa, proveedor, proyecto,
     factura): así un viaje cerrado de hace meses se encuentra sin cargar todo el histórico. */
  API.buscarViajes=async(uid,o)=>{
    const r=(await llamar('buscarViajes',[o||{}])).result||{};
    unirPagina(r);
    return r;
  };
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
