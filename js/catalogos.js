const CAT={
  clientes:['CMI','COLGATE','FRITO LAY','COCA-COLA'],
  proyectos:['ABASA','EMBOCEN','LV','COLGATE','CARGAS GLOBAL','ALPASA','METRO','OCCIDENTE'],
  tipoUnidad:['RAS S','RAS L','RAS A','RAS','FUR','5TON','10TON','12TON','53"'],
  opl:['J&J','GRIJALVA','GTL','CATALAN','BATRES','INTRANSIT','TRANS. CHAVELITA','TRANS. GAEL','TRANS. MILITO JCR','TRANS. REGALO DE DIOS','TRANS. STEFANI','TRANS. FERS','TRANS. HERNANDEZ','TRANS. NUEVO MUNDO','TRANS. REYNOSO','TRANS. XICARA','DIEGO CHICHICASTENANGO'],
  tipoCarga:['KG','CAJAS','TARIMAS'],
  tipoViaje:['ONE WAY','ROUD TRIP','MAYOREO','DETALLE','NA'],
  estatus:['COMPLETADO','EN CAMINO','CANCELADO','LIQUIDADO','EN ESPERA','CARGADO','PROCESO DE CARGA','DISPONIBLE','ESPERA CON CLIENTE','ESPERA DE DESCARGA','PENDIENTE LIQUIDAR','ESPERANDO CALIDAD','NO DISPONIBLE','NO SALIO A RUTA','NO ENTREGADO','DEVOLUCION','REPROGRAMADO','RETORNO','EN RAMPA','ESPERANDO CUSTODIO'],
  origen:['PET','SRG','VN','Z18','ATA','CHIM','CHIQ','EMB','GTY','ABASA','CENTRAL','INTRANSIT PETAPA','INTRANSIT Z11','SEREGUA','LP','LV','MZT','CMI DELTA BARCENAS','PLANTA INHSA','PLANTA MODERNOS','CG','CP','MALACATAN','XELA','OMNIA','HUEHUE','SANTA CATARINA']
};
/* Supuesto: qué PROYECTO del catálogo corresponde a cada cliente (confirmar) */
const FLOTA=[
  {unidad:'T-2084',placa:'C-482KLM',tango:'TNG-0412',capacidad:'10 Ton',tipo:'10TON'},
  {unidad:'T-2091',placa:'C-517PQR',tango:'TNG-0427',capacidad:'12 Ton',tipo:'12TON'},
  {unidad:'T-2102',placa:'C-390DFG',tango:'TNG-0433',capacidad:'5 Ton',tipo:'5TON'},
  {unidad:'T-3010',placa:'C-221HJK',tango:'TNG-0518',capacidad:'10 Ton',tipo:'RAS L'},
  {unidad:'T-3015',placa:'C-648TUV',tango:'TNG-0524',capacidad:'20 Ton',tipo:'53"'},
  {unidad:'T-3022',placa:'C-705WXY',tango:'TNG-0531',capacidad:'8 Ton',tipo:'RAS S'}
];
const PILOTOS=[
  {id:'P-001',nombre:'Juan Pérez',unidad:'T-2084',proyecto:'COLGATE'},
  {id:'P-002',nombre:'Carlos Mejía',unidad:'T-2091',proyecto:'COLGATE'},
  {id:'P-003',nombre:'Luis Ordóñez',unidad:'T-2102',proyecto:'COLGATE'},
  {id:'P-004',nombre:'Oscar Girón',unidad:null,proyecto:'COLGATE'},
  {id:'P-011',nombre:'Marvin López',unidad:'T-3010',proyecto:'CMI'},
  {id:'P-012',nombre:'Edwin Castillo',unidad:'T-3015',proyecto:'CMI'},
  {id:'P-013',nombre:'Hugo Barrios',unidad:'T-3022',proyecto:'CMI'}
];
const ORIGENES=CAT.origen.map(n=>({id:n,nombre:n}));
const DESTINOS=[
  {id:'D-C1',nombre:'Distribuidora Los Andes · Quetzaltenango',proyecto:'COLGATE'},
  {id:'D-C2',nombre:'Supermercados La Torre · Zona 10',proyecto:'COLGATE'},
  {id:'D-C3',nombre:'Distribuidora del Petén · Santa Elena',proyecto:'COLGATE'},
  {id:'D-C4',nombre:'Mayorista Escuintla · Escuintla',proyecto:'COLGATE'},
  {id:'D-M1',nombre:'Centro de Distribución Norte · Cobán',proyecto:'CMI'},
  {id:'D-M2',nombre:'Cadena Retail · Zona 4',proyecto:'CMI'},
  {id:'D-M3',nombre:'Distribuidor Occidente · Huehuetenango',proyecto:'CMI'},
  {id:'D-M4',nombre:'Mayorista Puerto Barrios · Izabal',proyecto:'CMI'}
];
