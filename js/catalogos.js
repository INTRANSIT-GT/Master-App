/* =====================================================================
   CATÁLOGOS DE LA APLICACIÓN.
   Las listas del sistema (tipo de unidad, OPL, tipo de carga, tipo de viaje y
   orígenes) YA NO VIVEN AQUÍ: se leen de la tabla master.catalogos en Supabase
   y se editan desde la pantalla Catálogos → «CATALOGO (listas)».
   Lo mismo con PILOTOS, FLOTA y DESTINOS, que se leen de sus tablas.
   Este archivo solo deja los arreglos vacíos que el motor llena al conectar.
   ===================================================================== */
const CAT={
  clientes:[],      /* se arma con los clientes reales */
  proyectos:[],     /* se arma con los proyectos reales */
  tipoUnidad:[],
  opl:[],
  tipoCarga:[],
  tipoViaje:[],
  origen:[]
};
const FLOTA=[];
const PILOTOS=[];
const ORIGENES=[];
const DESTINOS=[];
