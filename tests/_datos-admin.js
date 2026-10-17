(()=>{
  DB=blankDB();
  const U=(id,usuario,nombre,rol,pr)=>({id,usuario,clave:'x',nombre,rol,activo:true,proyectos:pr||[]});
  DB.usuarios.push(U('U-1','admin','Admin Master','ADMIN'),U('U-2','pedro','Pedro Chaperon','ENCARGADO'),U('U-3','sinp','Encargado Sin Proyectos','ENCARGADO'));
  Object.keys(ROLES).forEach(r=>PERM_KEYS.forEach(p=>{DB.permisos.push({rol:r,permiso:p,habilitado:r==='ADMIN'?true:((PERM_DEFAULT[r]||[]).includes(p)&&!((PROHIBIDO[r]||[]).includes(p)))});}));
  const cl=(id,n,pr)=>({id,nombre:n,cliente:n.toUpperCase(),proyectos:pr,torreEstatus:false,activo:true,nit:'',direccionFiscal:'',correoFacturacion:'',contacto:'',telefono:'',creditoDias:'',observaciones:''});
  DB.clientes.push(cl('COLGATE','Colgate',['COLGATE','LV']),cl('SINPROY','Cliente sin proyectos',[]));
  DB.acceso.push({userId:'U-2',cliente:'COLGATE'},{userId:'U-3',cliente:'SINPROY'});
  const ruta=(id,cod,nom,o,d,pr,est)=>({id,codigo:cod,nombre:nom,cliente:'COLGATE',proyecto:pr||'COLGATE',origenId:o,destinoId:d,estado:est||'ACTIVA',origenProp:'',destinoProp:'',fuente:'CATALOGO',solicitadaPorId:'U-1',solicitadaPor:'Admin',solicitadaEn:'2026-01-01T00:00:00.000Z',validadaPor:'',validadaEn:'',rechazo:null,viajeRef:''});
  DB.rutas.push(ruta('R-0001','COL-001','CP → Mayorista Escuintla','CP','D-1'),ruta('R-0002','COL-001','CP → Mayorista Escuintla','CP','D-1'),ruta('R-0003','COL-001','CP → Mayorista Escuintla','CP','D-1'),
    ruta('R-0004','COL-002','CP → Los Andes','CP','D-2'),ruta('R-0005','COL-003','Ruta Norte','CP','D-1'),ruta('R-0006','COL-003','Ruta Norte','CP','D-2'),ruta('R-0007','COL-004','Ruta sin destino','CP',''),ruta('R-0008','COL-LV','CP → LV','CP','D-1','LV'));
  PILOTOS.length=0;PILOTOS.push({id:'P-1',nombre:'Piloto Uno',unidad:'T-1',proyecto:'COLGATE'},{id:'P-2',nombre:'Piloto Dos',unidad:'T-2',proyecto:'COLGATE'});
  FLOTA.length=0;FLOTA.push({unidad:'T-1',placa:'C-1',tango:'TG-1',capacidad:'10 Ton',tipo:'10TON'},{unidad:'T-2',placa:'C-2',tango:'TG-2',capacidad:'12 Ton',tipo:'12TON'});
  DESTINOS.length=0;DESTINOS.push({id:'D-1',nombre:'Mayorista Escuintla',proyecto:'COLGATE'},{id:'D-2',nombre:'Distribuidora Los Andes',proyecto:'COLGATE'});
  /* Las listas del sistema ahora viven en la base (master.catalogos): sin esto la validación rechaza
     el OPL, el tipo de viaje y el tipo de carga de los viajes de ejemplo. */
  DB.catalogosListas=Object.assign({},DB.catalogosListas,{tipoUnidad:['RAS S','RAS L','RAS A','RAS','FUR','5TON','10TON','12TON','53"'],
    opl:['J&J','GRIJALVA','GTL','CATALAN','BATRES','INTRANSIT','TRANS. CHAVELITA','TRANS. GAEL','TRANS. MILITO JCR','TRANS. REGALO DE DIOS','TRANS. STEFANI','TRANS. FERS','TRANS. HERNANDEZ','TRANS. NUEVO MUNDO','TRANS. REYNOSO','TRANS. XICARA','DIEGO CHICHICASTENANGO'],
    tipoCarga:['KG','CAJAS','TARIMAS'],tipoViaje:['ONE WAY','ROUD TRIP','MAYOREO','DETALLE','NA']});
  syncRefs();
})()

;/* viajes de ejemplo para que las listas y el detalle tengan contenido (los crea el propio motor) */
(()=>{const b={cliente:'COLGATE',proyectoCat:'COLGATE',pilotoId:'P-1',shipment:'S',opl:'INTRANSIT',tipoViaje:'ONE WAY',tipoCarga:'KG',noCarga:'1',producto:'P',placaArrastre:'PA-1'};
  window.__V1=API.crearViaje('U-1',Object.assign({},b,{rutaId:'R-0001',fechaPlan:'2031-03-01T08:00',shipment:'S-1'})).id;
  window.__V2=API.crearViaje('U-1',Object.assign({},b,{rutaId:'R-0004',pilotoId:'P-2',fechaPlan:'2031-03-02T08:00',shipment:'S-2'})).id;})();

;/* ---- datos extra para las pruebas del administrador ---- */
(()=>{
  const c=DB.clientes.find(x=>x.id==='COLGATE');
  Object.assign(c,{clientePadre:'COLGATE PALMOLIVE',servicio:'TRANSPORTE',linkContrato:'https://contratos.example.com/colgate.pdf',contacto:'María López',correoFacturacion:'maria@colgate.test',telefono:'5555-1234',nit:'1234567-8',creadoEn:'2026-01-05T10:00:00.000Z',creadoPor:'Admin Master'});
  Object.assign(DB.clientes.find(x=>x.id==='SINPROY'),{linkContrato:'sin-enlace-valido',servicio:'ALMACEN'});
  ['ALFA','BRAVO','CHARLIE','DELTA','ECO','FOXTROT','GOLF','HOTEL','INDIA','JULIET'].forEach(n=>DB.clientes.push({id:'C-'+n,nombre:'Cliente '+n,cliente:('CLIENTE '+n),proyectos:[],torreEstatus:false,activo:true,nit:'',direccionFiscal:'',correoFacturacion:'',contacto:'',telefono:'',creditoDias:'',observaciones:''}));
  PILOTOS.push({id:'P-5',nombre:'Piloto Cinco',unidad:'T-2',proyecto:'COLGATE'});          /* T-2 tiene dos pilotos */
  syncRefs();
  /* una factura enviada del primer viaje */
  DB.agrupaciones.push({id:'AGR-0001',cliente:'COLGATE',modalidad:'INDIVIDUAL',fase:'ENVIADA',viajeIds:[window.__V1],numeroFactura:'F-1001',fechaFactura:'2031-03-05',importeEnviado:1500,importesViaje:{[window.__V1]:1500},viajesSinImporte:[],importeFacturado:null,envio:{por:'Admin Master',en:'2031-03-05T10:00:00.000Z'},emision:null,cobros:[],estado:'ACTIVA',creadoPorId:'U-1',creadoPor:'Admin Master',creadoEn:'2031-03-05T09:00:00.000Z',anulada:null,correcciones:[]});
})();
