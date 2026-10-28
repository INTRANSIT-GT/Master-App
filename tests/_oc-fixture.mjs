/* Datos de prueba compartidos por las pruebas de Órdenes de Compra (motor y pantalla). */
export const FIXTURE = `
(()=>{
  DB=blankDB();CAT.opl.push('INTRANSIT');CAT.tipoViaje.push('ONE WAY');CAT.tipoCarga.push('KG');CAT.tipoUnidad.push('10TON');CAT.origen.push('CP');
  const U=(id,usuario,nombre,rol)=>({id,usuario,clave:'x',nombre,rol,activo:true,proyectos:[]});
  DB.usuarios.push(U('U-1','admin','Admin Master','ADMIN'),U('U-G','gc','Gerente Comercial','GERENTE_COMERCIAL'),U('U-N','analista','Analista Comercial','ANALISTA_COMERCIAL'),U('U-F','fact','Facturación','FACTURACION'),U('U-T','torre','Torre','TORRE'),U('U-O','oper','Operativo','OPERATIVO'),U('U-V','valid','Validador','VALIDADOR'),U('U-C','cobros','Cobros','COBROS'),U('U-P','pago','Pago OPL','PAGO_OPL'),U('U-GT','gt','Gerente Transporte','GERENTE_TRANSPORTE'));
  Object.keys(ROLES).forEach(rol=>PERM_KEYS.forEach(p=>DB.permisos.push({rol,permiso:p,habilitado:(PERM_DEFAULT[rol]||[]).includes(p)&&!(PROHIBIDO[rol]||[]).includes(p)})));
  const cl=(id,n,pr)=>({id,nombre:n,cliente:n.toUpperCase(),proyectos:pr,torreEstatus:false,activo:true,nit:'',direccionFiscal:'',correoFacturacion:'',contacto:'',telefono:'',creditoDias:'',observaciones:''});
  DB.clientes.push(cl('COLGATE','Colgate',['COLGATE','COLGATE-B']),cl('COCACOLA','Coca-Cola',['COCACOLA']));
  DB.acceso.push({userId:'U-O',cliente:'COLGATE'});
  const ruta=(id,cod,nom,cli,pr,est)=>({id,codigo:cod,nombre:nom,cliente:cli,proyecto:pr,origen:'Ciudad de Guatemala',destino:'Mayorista',estado:est||'ACTIVA',origenProp:'',destinoProp:'',fuente:'CATALOGO',solicitadaPorId:'U-1',solicitadaPor:'Admin',solicitadaEn:'2026-01-01T00:00:00.000Z',validadaPor:'',validadaEn:'',aprobCom:{},aprobTra:{}});
  DB.rutas.push(ruta('R-0001','COL-001','CP → Mayorista','COLGATE','COLGATE'),ruta('R-0002','COCA-001','CP → Central','COCACOLA','COCACOLA'),ruta('R-0003','COL-002','CP → Minorista','COLGATE','COLGATE-B'),ruta('R-0004','COL-003','Ruta nueva','COLGATE','COLGATE','PENDIENTE'));
  PILOTOS.length=0;PILOTOS.push({id:'P-1',nombre:'Piloto Uno',unidad:'T-1',proyecto:'COLGATE'},{id:'P-2',nombre:'Piloto Dos',unidad:'T-2',proyecto:'COLGATE'},{id:'P-3',nombre:'Piloto Tres',unidad:'T-3',proyecto:'COLGATE'},{id:'P-4',nombre:'Piloto Cuatro',unidad:'T-4',proyecto:'COCACOLA'});
  FLOTA.length=0;FLOTA.push({unidad:'T-1',placa:'C-111AAA',tango:'1',capacidad:'10 Ton',tipo:'10TON'},{unidad:'T-2',placa:'C-222BBB',tango:'2',capacidad:'10 Ton',tipo:'10TON'},{unidad:'T-3',placa:'C-333CCC',tango:'3',capacidad:'10 Ton',tipo:'10TON'},{unidad:'T-4',placa:'C-444DDD',tango:'4',capacidad:'10 Ton',tipo:'10TON'});
  DESTINOS.length=0;DESTINOS.push({id:'D-1',nombre:'Mayorista',proyecto:'COLGATE'});
  syncRefs();
  const b={cliente:'COLGATE',proyectoCat:'COLGATE',pilotoId:'P-1',rutaId:'R-0001',shipment:'S',opl:'INTRANSIT',tipoViaje:'ONE WAY',tipoCarga:'KG',noCarga:'1',producto:'P',placaArrastre:'PA-1'};
  window.__mk=(over,tarifa)=>{const id=API.crearViaje('U-1',Object.assign({},b,{fechaPlan:'2031-03-01T08:00'},over)).id;const t=DB.trips.find(x=>x.id===id);if(over.fechaPlan)t.fechaPlan=over.fechaPlan;t.estado='ACEPTADO';t.liqAprobadaEn='2031-03-10T10:00:00.000Z';if(tarifa!==undefined)t.tarifaCliente=tarifa;return id;};
  /* viajes con tarifa válida (Colgate/COLGATE): en límites de año ISO */
  window.__V={};
  window.__V.a=__mk({shipment:'SH-A',pilotoId:'P-1',fechaPlan:'2031-12-28T08:00'},1000);     /* 2031 semana 52 */
  window.__V.b=__mk({shipment:'SH-B',pilotoId:'P-2',fechaPlan:'2031-12-29T14:30'},1500);     /* 2032 semana 1 */
  window.__V.c=__mk({shipment:'SH-C',pilotoId:'P-3',fechaPlan:'2032-01-04T06:15'},2000);     /* 2032 semana 1 */
  window.__V.comb=__mk({shipment:'SH-COMB',pilotoId:'P-1',fechaPlan:'2031-04-07T08:00'},1100);
  { const t=DB.trips.find(x=>x.id===__V.comb);t.tarifaBase=1000;t.ajusteCombustible=100;t.precioMem=30; }
  window.__V.col=__mk({shipment:'SH-COL',pilotoId:'P-2',fechaPlan:'2031-04-08T08:00'},1100);
  { const t=DB.trips.find(x=>x.id===__V.col);t.tarifaBase=1000;t.ajusteCombustible=100;t.precioMem=30; }
  /* sin tarifa: vacío, cero, negativa, ruta no activa */
  window.__V.vacio=__mk({shipment:'SH-VAC',pilotoId:'P-2',fechaPlan:'2031-05-05T08:00'},'');
  window.__V.cero=__mk({shipment:'SH-CERO',pilotoId:'P-3',fechaPlan:'2031-05-06T08:00'},0);
  window.__V.neg=__mk({shipment:'SH-NEG',pilotoId:'P-1',fechaPlan:'2031-05-07T08:00'},-50);
  window.__V.rutaPend=__mk({shipment:'SH-RP',pilotoId:'P-2',fechaPlan:'2031-05-08T08:00'},900);
  DB.trips.find(x=>x.id===__V.rutaPend).rutaId='R-0004';
  /* otro proyecto y otro cliente */
  window.__V.otroProy=__mk({shipment:'SH-B2',pilotoId:'P-3',proyectoCat:'COLGATE-B',rutaId:'R-0003',fechaPlan:'2031-06-02T08:00'},700);
  window.__V.coca=__mk({shipment:'SH-K',cliente:'COCACOLA',proyectoCat:'COCACOLA',rutaId:'R-0002',pilotoId:'P-4',fechaPlan:'2031-06-03T08:00'},800);
  /* viaje no aceptado */
  window.__V.plan=API.crearViaje('U-1',Object.assign({},b,{shipment:'SH-PLAN',pilotoId:'P-3',fechaPlan:'2031-07-01T08:00'})).id;
  SECCIONES.forEach(x=>Object.keys(ROLES).forEach(r=>{if(r==='ADMIN')return;DB.permisos.push({rol:r,permiso:'sec_'+x[0],habilitado:true});}));
  window.__try=(f)=>{try{const r=f();return {ok:true,r};}catch(e){return {ok:false,code:e.code,msg:e.message,pend:e.pendientes,err:e.errores};}};
})();`;
