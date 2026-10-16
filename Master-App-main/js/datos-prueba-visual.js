/* =====================================================================
   DATOS DE EJEMPLO SOLO PARA LA REVISIÓN VISUAL (prueba-visual.html).
   Todo es ficticio: no hay conexión con Supabase, no hay contraseñas, y nada de esto se usa en index.html.
   Se crea con el propio motor de la aplicación (API.crearViaje, etc.) para que las pantallas se vean como en uso real.
   ===================================================================== */
(function(){
  DB=blankDB();
  const U=(id,usuario,nombre,rol)=>({id,usuario,clave:'',nombre,rol,activo:true,proyectos:[]});
  const ROL_NOMBRE={ADMIN:'Administradora (ejemplo)',TORRE:'Torre de control (ejemplo)',LIQUIDACIONES:'Liquidaciones (ejemplo)',COMERCIAL:'Comercial (ejemplo)',GERENCIA_COMERCIAL:'Gerencia comercial (ejemplo)',CONTABILIDAD:'Contabilidad (ejemplo)',GERENCIA_TRANSPORTE:'Gerencia de transporte (ejemplo)'};
  Object.keys(ROLES).filter(r=>r!=='ENCARGADO').forEach(r=>DB.usuarios.push(U('U-'+r,r.toLowerCase(),ROL_NOMBRE[r]||r,r)));
  DB.usuarios.push(U('U-ENC1','encargado1','Pedro Chaperon (ejemplo)','ENCARGADO'),U('U-ENC2','nora','Nora Rivera (ejemplo, 58 clientes)','ENCARGADO'),U('U-ENC3','sinproy','Encargado sin proyectos (ejemplo)','ENCARGADO'));
  /* permisos por rol: los valores iniciales del propio motor */
  Object.keys(ROLES).forEach(r=>PERM_KEYS.forEach(p=>{DB.permisos.push({rol:r,permiso:p,habilitado:r==='ADMIN'?true:((PERM_DEFAULT[r]||[]).includes(p)&&!((PROHIBIDO[r]||[]).includes(p)))});}));
  const cl=(id,n,pr)=>({id,nombre:n,cliente:n.toUpperCase(),proyectos:pr,torreEstatus:false,activo:true,nit:'',direccionFiscal:'',correoFacturacion:'',contacto:'',telefono:'',creditoDias:'',observaciones:''});
  DB.clientes.push(cl('COLGATE','Colgate',['COLGATE','LV']),cl('CMI','CMI',['ABASA']),cl('SINPROY','Cliente sin proyectos',[]));
  DB.acceso.push({userId:'U-ENC1',cliente:'COLGATE'},{userId:'U-ENC3',cliente:'SINPROY'});
  /* «Nora»: 58 clientes asignados con IDs técnicos (el caso de tu captura) */
  const ids=[];for(let i=1;i<=55;i++)ids.push('CIT-U'+String(i).padStart(4,'0'));['CLI-001','CLI-002','CLI-003'].forEach(x=>ids.push(x));
  ids.forEach(id=>{DB.clientes.push(cl(id,id,['P-'+id]));DB.acceso.push({userId:'U-ENC2',cliente:id});});
  const ruta=(id,cod,nom,cli,pr,o,d)=>({id,codigo:cod,nombre:nom,cliente:cli,proyecto:pr,origenId:o,destinoId:d,estado:'ACTIVA',origenProp:'',destinoProp:'',fuente:'CATALOGO',solicitadaPorId:'U-ADMIN',solicitadaPor:'Administradora (ejemplo)',solicitadaEn:'2026-01-01T00:00:00.000Z',validadaPor:'',validadaEn:'',rechazo:null,viajeRef:''});
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
  syncRefs();
  /* algunos viajes de ejemplo, creados por el propio motor */
  const b={cliente:'COLGATE',proyectoCat:'COLGATE',pilotoId:'P-1',estatus:'EN ESPERA',opl:'INTRANSIT',tipoViaje:'ONE WAY',tipoCarga:'KG',noCarga:'1',producto:'Producto de ejemplo',placaArrastre:'PA-1001'};
  const nuevo=(extra)=>{try{return API.crearViaje('U-ADMIN',Object.assign({},b,extra)).id;}catch(e){console.warn('Dato de ejemplo no creado:',e.message);return null;}};
  const v=[nuevo({rutaId:'R-0001',fechaPlan:'2031-03-01T08:00',shipment:'SHP-48201'}),nuevo({rutaId:'R-0004',pilotoId:'P-2',fechaPlan:'2031-03-02T08:00',shipment:'SHP-48202',tipoCarga:'CAJAS'}),
           nuevo({rutaId:'R-0006',fechaPlan:'2031-03-03T08:00',shipment:'SHP-48203',tipoCarga:'TARIMAS',noCarga:'12'}),nuevo({rutaId:'R-0008',proyectoCat:'LV',pilotoId:'P-2',fechaPlan:'2031-03-04T08:00',shipment:'SHP-48204'})];
  try{if(v[0])API.iniciar('U-ADMIN',v[0]);}catch(e){}
  /* datos de ejemplo para revisar la tabla de Clientes, el detalle de Facturación y la placa con varios pilotos */
  Object.assign(DB.clientes.find(c=>c.id==='COLGATE'),{clientePadre:'COLGATE PALMOLIVE (ejemplo)',servicio:'TRANSPORTE',linkContrato:'https://contratos.example.com/colgate.pdf',contacto:'María López (ejemplo)',correoFacturacion:'maria@ejemplo.test',telefono:'5555-1234',nit:'1234567-8',creadoEn:'2026-01-05T10:00:00.000Z',creadoPor:'Administradora (ejemplo)'});
  Object.assign(DB.clientes.find(c=>c.id==='CMI'),{clientePadre:'GRUPO CMI (ejemplo)',servicio:'ALMACENAJE',contacto:'Luis Ortiz (ejemplo)',correoFacturacion:'luis@ejemplo.test',telefono:'5555-9876'});
  PILOTOS.push({id:'P-5',nombre:'Pedro Ruiz (ejemplo)',unidad:'T-2',proyecto:'COLGATE'});      /* la unidad T-2 tiene dos pilotos: el formulario pide elegir */
  syncRefs();
  if(v[0])DB.agrupaciones.push({id:'AGR-0001',cliente:'COLGATE',modalidad:'INDIVIDUAL',fase:'ENVIADA',viajeIds:[v[0]],numeroFactura:'F-EJEMPLO-1',fechaFactura:'2031-03-05',importeEnviado:1500,importesViaje:{[v[0]]:1500},viajesSinImporte:[],importeFacturado:null,envio:{por:'Administradora (ejemplo)',en:'2031-03-05T10:00:00.000Z'},emision:null,cobros:[],estado:'ACTIVA',creadoPorId:'U-ADMIN',creadoPor:'Administradora (ejemplo)',creadoEn:'2031-03-05T09:00:00.000Z',anulada:null,correcciones:[]});
  /* utilidades de la barra de revisión */
  window.PRUEBA={
    verComo(id){const u=DB.usuarios.find(x=>x.id===id);if(!u)return;S.user=u;S.form=null;S.edit=null;S.modal=null;S.menu=false;S.q='';go(homeOf(u));},
    usuarios:()=>DB.usuarios.map(u=>({id:u.id,nombre:u.nombre,rol:u.rol}))
  };
})();
