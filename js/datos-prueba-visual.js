/* =====================================================================
   DATOS DE EJEMPLO SOLO PARA LA REVISIÓN VISUAL (prueba-visual.html).
   Todo es ficticio: no hay conexión con Supabase, no hay contraseñas, y nada de esto se usa en index.html.
   Se crea con el propio motor de la aplicación (API.crearViaje, etc.) para que las pantallas se vean como en uso real.
   ===================================================================== */
(function(){
  DB=blankDB();
  const U=(id,usuario,nombre,rol)=>({id,usuario,clave:'',nombre,rol,activo:true,proyectos:[]});
  const ROL_NOMBRE={ADMIN:'Administradora (ejemplo)',TORRE:'Torre de control (ejemplo)',VALIDADOR:'Validador (ejemplo)',FACTURACION:'Facturación (ejemplo)',GERENTE_COMERCIAL:'Gerencia comercial (ejemplo)',COBROS:'Cobros (ejemplo)',GERENTE_TRANSPORTE:'Gerencia de transporte (ejemplo)',ANALISTA_COMERCIAL:'Analista comercial (ejemplo)',PAGO_OPL:'Pago OPL (ejemplo)',PROYECTOS:'Proyectos (ejemplo)'};
  Object.keys(ROLES).filter(r=>r!=='OPERATIVO').forEach(r=>DB.usuarios.push(U('U-'+r,r.toLowerCase(),ROL_NOMBRE[r]||r,r)));
  DB.usuarios.push(U('U-OPE1','operativo1','Pedro Chaperon (ejemplo)','OPERATIVO'),U('U-OPE2','nora','Nora Rivera (ejemplo, 58 clientes)','OPERATIVO'),U('U-OPE3','sinproy','Operativo sin proyectos (ejemplo)','OPERATIVO'));
  /* permisos por rol: los valores iniciales del propio motor */
  Object.keys(ROLES).forEach(r=>PERM_KEYS.forEach(p=>{DB.permisos.push({rol:r,permiso:p,habilitado:r==='ADMIN'?true:((PERM_DEFAULT[r]||[]).includes(p)&&!((PROHIBIDO[r]||[]).includes(p)))});}));
  const cl=(id,n,pr)=>({id,nombre:n,cliente:n.toUpperCase(),proyectos:pr,torreEstatus:false,activo:true,nit:'',direccionFiscal:'',correoFacturacion:'',contacto:'',telefono:'',creditoDias:'',observaciones:''});
  DB.clientes.push(cl('COLGATE','Colgate',['COLGATE','LV']),cl('CMI','CMI',['ABASA']),cl('SINPROY','Cliente sin proyectos',[]));
  DB.acceso.push({userId:'U-OPE1',cliente:'COLGATE'},{userId:'U-OPE3',cliente:'SINPROY'});
  /* «Nora»: 58 clientes asignados con IDs técnicos (el caso de tu captura) */
  const ids=[];for(let i=1;i<=55;i++)ids.push('CIT-U'+String(i).padStart(4,'0'));['CLI-001','CLI-002','CLI-003'].forEach(x=>ids.push(x));
  ids.forEach(id=>{DB.clientes.push(cl(id,id,['P-'+id]));DB.acceso.push({userId:'U-OPE2',cliente:id});});
  const DEST_NOM={'D-1':'Mayorista Escuintla','D-2':'Distribuidora Los Andes','D-3':'Centro de Distribución Norte'};
  const ruta=(id,cod,nom,cli,pr,o,d)=>({id,codigo:cod,nombre:nom,cliente:cli,proyecto:pr,origen:o,destino:(DEST_NOM[d]||d),estado:'ACTIVA',origenProp:'',destinoProp:'',fuente:'CATALOGO',solicitadaPorId:'U-ADMIN',solicitadaPor:'Administradora (ejemplo)',solicitadaEn:'2026-01-01T00:00:00.000Z',validadaPor:'',validadaEn:'',rechazo:null,viajeRef:''});
  DB.rutas.push(
    ruta('R-0001','COL-001','CP → Mayorista Escuintla','COLGATE','COLGATE','CP','D-1'),ruta('R-0002','COL-001','CP → Mayorista Escuintla','COLGATE','COLGATE','CP','D-1'),ruta('R-0003','COL-001','CP → Mayorista Escuintla','COLGATE','COLGATE','CP','D-1'),   /* mismo nombre repetido: se verá una sola vez */
    ruta('R-0004','COL-002','CP → Los Andes','COLGATE','COLGATE','CP','D-2'),
    ruta('R-0005','COL-003','Ruta Norte','COLGATE','COLGATE','CP','D-1'),ruta('R-0006','COL-003','Ruta Norte','COLGATE','COLGATE','CP','D-2'),   /* una ruta con dos destinos posibles */
    ruta('R-0007','COL-004','Ruta sin destino registrado','COLGATE','COLGATE','CP',''),
    ruta('R-0008','COL-LV1','CP → Distribuidora LV','COLGATE','LV','CP','D-2'),
    ruta('R-0009','CMI-001','CP → CMI Delta','CMI','ABASA','CP','D-3'));
  ids.forEach(id=>DB.rutas.push(ruta('R-'+id,'RC-'+id,'Ruta '+id,id,'P-'+id,'CP','D-1')));
  PILOTOS.length=0;PILOTOS.push({id:'P-1',nombre:'Juan Pérez (ejemplo)',unidad:'T-1',proyecto:'COLGATE'},{id:'P-2',nombre:'Carlos Mejía (ejemplo)',unidad:'T-2',proyecto:'COLGATE'},{id:'P-3',nombre:'Marvin López (ejemplo)',unidad:'T-3',proyecto:'CMI'});
  FLOTA.length=0;FLOTA.push({unidad:'T-1',placa:'C-482KLM',tango:'TG-01',capacidad:'10 Ton',tipo:'10TON'},{unidad:'T-2',placa:'C-517PQR',tango:'TG-02',capacidad:'12 Ton',tipo:'12TON'},{unidad:'T-3',placa:'C-221HJK',tango:'TG-03',capacidad:'10 Ton',tipo:'10TON'});
  DESTINOS.length=0;DESTINOS.push({id:'D-1',nombre:'Mayorista Escuintla',proyecto:'COLGATE'},{id:'D-2',nombre:'Distribuidora Los Andes',proyecto:'COLGATE'},{id:'D-3',nombre:'Centro de Distribución Norte',proyecto:'CMI'});
  /* Las listas del sistema viven en la base (master.catalogos): aquí van las de ejemplo, para que la
     revisión visual muestre los desplegables y pueda crear viajes (si no, la validación los rechaza). */
  DB.catalogosListas={opl:['GTL','INTRANSIT','J&J','GRIJALVA','TRANS. HERNANDEZ','CATALAN'],
    origen:['PET','SRG','VN','Z18','ATA','CHIM','CHIQ','EMB','GTY','ABASA','CENTRAL','INTRANSIT PETAPA','INTRANSIT Z11','SEREGUA','LP','LV','MZT','CMI DELTA BARCENAS','PLANTA INHSA','PLANTA MODERNOS','CG','CP','MALACATAN','XELA','OMNIA','HUEHUE','SANTA CATARINA'],
    tipoCarga:['KG','CAJAS','TARIMAS'],tipoUnidad:['RAS S','RAS L','RAS A','RAS','FUR','5TON','10TON','12TON','53"'],tipoViaje:['ONE WAY','ROUD TRIP','MAYOREO','DETALLE','NA'],
    arrastre:['TC-100','TC-200']};
  syncRefs();
  /* algunos viajes de ejemplo, creados por el propio motor */
  const b={cliente:'COLGATE',proyectoCat:'COLGATE',pilotoId:'P-1',opl:'INTRANSIT',tipoViaje:'ONE WAY',tipoCarga:'KG',noCarga:'1',producto:'Producto de ejemplo',placaArrastre:'PA-1001'};
  const nuevo=(extra)=>{try{return API.crearViaje('U-ADMIN',Object.assign({},b,extra)).id;}catch(e){console.warn('Dato de ejemplo no creado:',e.message);return null;}};
  const v=[nuevo({rutaId:'R-0001',fechaPlan:'2031-03-01T08:00',shipment:'SHP-48201'}),nuevo({rutaId:'R-0004',pilotoId:'P-2',fechaPlan:'2031-03-02T08:00',shipment:'SHP-48202',tipoCarga:'CAJAS'}),
           nuevo({rutaId:'R-0006',fechaPlan:'2031-03-03T08:00',shipment:'SHP-48203',tipoCarga:'TARIMAS',noCarga:'12'}),nuevo({rutaId:'R-0008',proyectoCat:'LV',pilotoId:'P-2',fechaPlan:'2031-03-04T08:00',shipment:'SHP-48204'})];
  try{if(v[0])API.iniciar('U-ADMIN',v[0]);}catch(e){}
  /* utilidades de la barra de revisión */
  window.PRUEBA={
    verComo(id){const u=DB.usuarios.find(x=>x.id===id);if(!u)return;S.user=u;S.form=null;S.edit=null;S.modal=null;S.menu=false;S.q='';go(homeOf(u));},
    usuarios:()=>DB.usuarios.map(u=>({id:u.id,nombre:u.nombre,rol:u.rol}))
  };
})();
