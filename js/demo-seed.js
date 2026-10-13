/* =====================================================================
   DATOS Y USUARIOS DE DEMOSTRACIÓN (solo para probar la interfaz sin servidor).
   Contiene usuarios y contraseñas FICTICIOS. NO se carga en el despliegue real: index.html no lo incluye.
   Se usa únicamente en la versión de demostración de un solo archivo (master-app-demo.html).
   ===================================================================== */
function seedDB(){
  DB=blankDB();
  DB.usuarios=[
    {id:'U-001',usuario:'admin',clave:'admin123',nombre:'Administradora',rol:'ADMIN',activo:true},
    {id:'U-002',usuario:'pedro',clave:'colgate123',nombre:'Pedro Chaperon',rol:'ENCARGADO',activo:true},
    {id:'U-003',usuario:'bryan',clave:'cmi123',nombre:'Bryan Hernandez',rol:'ENCARGADO',activo:true},
    {id:'U-004',usuario:'felipe',clave:'torre123',nombre:'Felipe Lobos',rol:'TORRE',activo:true},
    {id:'U-005',usuario:'mar',clave:'liq123',nombre:'Mar Aguilar',rol:'LIQUIDACIONES',activo:true},
    {id:'U-006',usuario:'alejandra',clave:'comercial123',nombre:'Alejandra',rol:'COMERCIAL',activo:true},
    {id:'U-007',usuario:'gerencia',clave:'gerencia123',nombre:'Gerencia',rol:'GERENCIA',activo:true},
    {id:'U-008',usuario:'cocacola',clave:'cocacola123',nombre:'Encargado Coca-Cola',rol:'ENCARGADO',activo:true},
    {id:'U-009',usuario:'fritolay',clave:'fritolay123',nombre:'Encargado Frito Lay',rol:'ENCARGADO',activo:true},
    {id:'U-010',usuario:'implan',clave:'implan123',nombre:'Encargado COLGATE (IMPLAN)',rol:'ENCARGADO',activo:true,proyectos:['COLGATE']}
  ];
  DB.seq.usr=11;
  DB.acceso=[{userId:'U-002',cliente:'COLGATE'},{userId:'U-003',cliente:'CMI'},{userId:'U-008',cliente:'COCACOLA'},{userId:'U-009',cliente:'FRITOLAY'},{userId:'U-010',cliente:'COLGATE'}];
  const base={nit:'',direccionFiscal:'',correoFacturacion:'',contacto:'',telefono:'',creditoDias:'',observaciones:'',activo:true,creadoPor:'Datos de demostración',creadoEn:new Date().toISOString()};
  DB.clientes=[
    Object.assign({id:'COLGATE',nombre:'Colgate',cliente:'COLGATE',proyectos:['COLGATE'],torreEstatus:false},base),
    Object.assign({id:'CMI',nombre:'CMI',cliente:'CMI',proyectos:['ABASA','EMBOCEN','LV','CARGAS GLOBAL','ALPASA','METRO','OCCIDENTE'],torreEstatus:false},base),
    Object.assign({id:'COCACOLA',nombre:'Coca-Cola',cliente:'COCA-COLA',proyectos:['EMBOCEN'],torreEstatus:true},base),
    Object.assign({id:'FRITOLAY',nombre:'Frito Lay',cliente:'FRITO LAY',proyectos:['CARGAS GLOBAL'],torreEstatus:true},base)
  ];
  DB.config={torreEstatus:TORRE_ESTATUS_DEFECTO.slice()};
  Object.keys(ROLES).forEach(rol=>PERM_KEYS.forEach(p=>DB.permisos.push({rol,permiso:p,habilitado:(PERM_DEFAULT[rol]||[]).includes(p)&&!(PROHIBIDO[rol]||[]).includes(p)})));
  syncRefs();
  const now=Date.now(),lm=m=>toLocal(new Date(now-m*60000)),dd=m=>dstr(new Date(now-m*60000));
  const U={adm:'U-001',ped:'U-002',bry:'U-003',mar:'U-005',ale:'U-006',imp:'U-010'};
  const run=(m,fn)=>{CLOCK=()=>new Date(now-m*60000).toISOString();try{return fn();}finally{CLOCK=null;}};
  let n=0,rn=0;
  const rutas={},tars={};
  const PRE={COLGATE:'COL',CMI:'CMI',COCACOLA:'COC',FRITOLAY:'FRI'};
  const getRuta=(cli,pc,ori,des,c)=>{
    const k=[cli,pc,ori,des].join('|');
    if(!rutas[k]){rn++;rutas[k]=run(c+10,()=>API.registrarRuta(U.adm,{codigo:`${PRE[cli]}-${String(rn).padStart(3,'0')}`,nombre:`${ori} → ${nombreDestino(des)}`,cliente:cli,proyecto:pc,origenId:ori,destinoId:des})).id;}
    return rutas[k];
  };
  /* NOTA: los importes (tarifa, costo, pagos, cobros) y la evidencia de emisión son datos de DEMOSTRACIÓN; tu hoja VIAJES_TRANSPORTES no tiene tarifas. */
  const mk=(cli,pil,ori,des,o)=>{
    n++;const cmi=cli==='CMI',col=cli==='COLGATE',enc={COLGATE:U.ped,CMI:U.bry,COCACOLA:'U-008',FRITOLAY:'U-009'}[cli];
    const pc=o.pc||(col?'COLGATE':cmi?'ABASA':cli==='COCACOLA'?'EMBOCEN':'CARGAS GLOBAL');
    const d={cliente:cli,proyectoCat:pc,shipment:'SHP-'+(48200+n),noViaje:'NV-'+String(111+n).padStart(6,'0'),opl:o.opl||(cmi?'GRIJALVA':'INTRANSIT'),tipoViaje:cmi?'ROUD TRIP':'ONE WAY',tipoCarga:cmi?'CAJAS':'TARIMAS',noCarga:cmi?420:14,producto:'Producto terminado',
      fechaPlan:lm(o.pl!==undefined?o.pl:(o.s?o.s+30:o.c)),estatus:'EN ESPERA',pilotoId:pil,noDocRetorno:'',qViaticos:''};
    if(o.noRuta){d.rutaId='NO_ASIGNADA';d.rutaRef=o.noRuta;}else d.rutaId=getRuta(cli,pc,ori,des,o.c);
    TKEYS.forEach(k=>d[k]='');
    if(o.s&&!o.blank){const s=o.s;
      d.tIngresoPlanta=lm(s+60);d.tEsperaRampa=lm(s+55);d.tRampa=lm(s+40);d.tInicioCarga=lm(s+35);d.tFinCarga=lm(s+15);d.tSalidaPlanta=lm(s+5);d.tSalida=lm(s);
      if(o.arr!==undefined)d.tIngresoBodega=lm(o.arr);
      if(o.f){d.tIngresoBodega=lm(s-180);d.tInicioDescarga=lm(s-195);d.tFinDescarga=lm(s-250);d.qViaticos=cmi?200:150;if(n%2)d.noDocRetorno='RET-'+String(111+n).padStart(6,'0');}
    }
    const t=run(o.c,()=>API.crearViaje(enc,d)),id=t.id;
    if(o.s)run(o.s,()=>API.iniciar(enc,id));
    if(o.f)run(o.f,()=>API.finalizar(enc,id));
    if(o.cp!==undefined)run(o.f-5,()=>API.registrarImportes(U.adm,id,{costoProveedor:o.cp}));
    if(o.e)run(o.e,()=>API.enviarLiquidacion(enc,id,sampleSlip(id)));
    if(o.r)run(o.r,()=>API.devolver(U.mar,id,o.cm));
    if(o.e2)run(o.e2,()=>API.enviarLiquidacion(enc,id,sampleSlip(id)));
    if(o.a)run(o.a,()=>API.aprobar(U.mar,id));
    if(o.tf!==undefined){
      const cap=(FLOTA.find(f=>f.unidad===PILOTOS.find(p=>p.id===pil).unidad)||{}).capacidad,tk=[cli,pc,d.rutaId,cap].join('|');
      if(!tars[tk])tars[tk]=run(o.c+10,()=>API.crearTarifa(U.ale,{cliente:cli,proyecto:pc,rutaId:d.rutaId,capacidad:cap,importe:o.tf,vigenteDesde:dd(o.c+43200)}));
      run(o.a-5,()=>API.aplicarTarifa(U.ale,id));
    }
    if(o.es)run(o.est||20,()=>API.editarViaje(enc,id,{estatus:o.es},'Actualización de estatus operativo'));
    (o.pg||[]).forEach(p=>run(p.m,()=>API.registrarPago(U.adm,{tipo:p.t,viajeId:id,monto:p.v,fecha:dd(p.m),referencia:p.r})));
    return id;
  };
  mk('COLGATE','P-001','CP','D-C1',{c:4800,s:4740,f:4400,e:4300,a:4200,tf:4800,cp:3900,opl:'INTRANSIT',pg:[{t:'PROVEEDOR',v:2000,r:'TRF-1001',m:4000},{t:'PILOTO',v:150,r:'VIA-1001',m:3900}]});   // 000112
  mk('CMI','P-011','CMI DELTA BARCENAS','D-M1',{c:5000,s:4950,f:4600,e:4500,a:4350,pc:'ABASA',tf:6200,cp:5100,opl:'GRIJALVA',pg:[{t:'PROVEEDOR',v:5100,r:'TRF-1002',m:4000}]}); // 000113
  mk('CMI','P-012','PLANTA INHSA','D-M3',{c:2700,s:2650,f:2200,e:1300,r:200,cm:'Liquidación incompleta: falta el comprobante de descarga sellado por el cliente.',pc:'EMBOCEN'}); // 000114
  mk('COLGATE','P-002','CG','D-C2',{c:1800,s:1740,f:1200,e:600,a:240,cp:3000,opl:'GTL'});            // 000115 (sin tarifa)
  mk('CMI','P-013','INTRANSIT Z11','D-M2',{c:1500,s:1450,f:1000,e:500,a:180,pc:'LV',tf:7000,cp:5600,opl:'CATALAN'}); // 000116
  mk('COLGATE','P-003','CP','D-C3',{c:2900,s:2850,f:2400,e:1500,r:300,cm:'Falta la firma del piloto. Vuelve a tomar la foto con la firma visible.',cp:3200}); // 000117
  mk('CMI','P-011','CMI DELTA BARCENAS','D-M4',{c:800,s:760,f:60,pc:'ALPASA',cp:5300});            // 000118
  mk('COLGATE','P-001','CG','D-C4',{c:900,s:840,f:90,cp:3600});                                    // 000119
  mk('CMI','P-012','PLANTA INHSA','D-M1',{c:380,s:330,arr:60,es:'ESPERA DE DESCARGA',pc:'METRO'}); // 000120
  mk('COLGATE','P-002','CP','D-C1',{c:420,s:345});                                                 // 000121
  mk('COLGATE','P-003','CP','D-C2',{c:200,s:140});                                                 // 000122
  mk('CMI','P-013','INTRANSIT Z11','D-M2',{c:120,s:75,pc:'OCCIDENTE'});                            // 000123
  mk('COLGATE','P-001','CG','D-C3',{c:40,pl:-90});                                                 // 000124
  mk('CMI','P-011','PLANTA INHSA','D-M3',{c:25,pl:-150,es:'REPROGRAMADO',pc:'ALPASA'});            // 000125
  mk('COLGATE','P-002','CP','D-C4',{c:1400,s:1340,f:900,e:700,a:120,tf:5200,cp:4300,opl:'INTRANSIT'}); // 000126
  mk('COLGATE','P-003','CG','D-C1',{c:600,s:560,f:200,e:45,cp:3400});                              // 000127
  mk('CMI','P-012','CMI DELTA BARCENAS','D-M2',{c:1300,s:1250,f:850,e:650,a:100,pc:'ABASA',tf:6500,opl:'BATRES'}); // 000128 (sin costo)
  mk('CMI','P-013','PLANTA INHSA','D-M3',{c:900,s:860,f:300,e:150,r:120,cm:'Falta firma del piloto en la liquidación.',e2:30,pc:'EMBOCEN'}); // 000129
  mk('COCACOLA','P-021','CP','D-K1',{c:300,s:250,blank:1});                                        // 000130
  mk('COCACOLA','P-022','CG','D-K2',{c:150,s:100,blank:1});                                        // 000131
  mk('COCACOLA','P-021','CP','D-K2',{c:30,pl:-120});                                               // 000132
  mk('FRITOLAY','P-031','INTRANSIT Z11','D-F1',{c:280,s:230,blank:1});                             // 000133
  mk('FRITOLAY','P-032','INTRANSIT Z11','D-F2',{c:130,s:90,blank:1});                              // 000134
  mk('FRITOLAY','P-031','CP','D-F2',{c:20,pl:-100});                                               // 000135
  run(60,()=>API.solicitarRuta(U.imp,{cliente:'COLGATE',proyecto:'COLGATE',nombre:'Mixco – Chimaltenango (ruta nueva)',origenProp:'CEDIS Mixco',destinoProp:'Chimaltenango'}));
  mk('CMI','P-013','PLANTA INHSA',null,{c:55,pl:-200,pc:'ALPASA',noRuta:'Planta Amatitlán → cliente nuevo en Sololá (por confirmar)'});   // 000136 (ruta NO ASIGNADA)
  /* Facturas: una emitida y cobrada, una preparada incompleta y una enviada a facturación (sin emitir) */
  run(4010,()=>API.prepararFactura(U.ale,{cliente:'COLGATE',viajeIds:['000112'],numeroFactura:'FAC-1001',fechaFactura:dd(3990)}));   // AGR-0001
  run(4000,()=>API.enviarFactura(U.ale,'AGR-0001'));
  run(3990,()=>API.emitirFactura(U.ale,'AGR-0001',{fechaEmision:dd(3990),importe:4800,evidencia:'DEMO · UUID 0001-A1B2-C3D4'}));
  run(3500,()=>API.registrarCobro(U.ale,'AGR-0001',{fecha:dd(3500),monto:4800,referencia:'DEP-5501'}));
  run(4110,()=>API.prepararFactura(U.ale,{cliente:'CMI',viajeIds:['000113'],numeroFactura:'',fechaFactura:''}));                        // AGR-0002 (preparada, incompleta)
  run(100,()=>API.prepararFactura(U.ale,{cliente:'COLGATE',viajeIds:['000126'],numeroFactura:'FAC-1003',fechaFactura:dd(100)}));          // AGR-0003
  run(90,()=>API.enviarFactura(U.ale,'AGR-0003'));
  DB.seq.trip=137;
  rechain();
  save();
}
