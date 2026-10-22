/* guias.mjs · «Mi guía de uso»: catálogo CERRADO de guías y regla de acceso por rol.
   Es la única fuente de verdad del acceso: el navegador nunca decide qué guía puede ver un perfil.
   - Los roles son los identificadores internos de master.perfiles.rol (no hay equivalencias inventadas).
   - Los archivos se localizan SOLO desde este catálogo (rutas fijas); nunca se acepta una ruta que venga del navegador.
   - Los roles sin guía (ANALISTA_COMERCIAL, COBROS, PAGO_OPL) no aparecen en ninguna fila: no ven ninguna.
   - ADMIN consulta las ocho guías. Eso NO le da ni quita permisos funcionales: es solo lectura de documentos.
   - Los PDF e índices viven en el bucket PRIVADO «manuales» de Supabase Storage (nunca en el repositorio ni en GitHub Pages). */
export const BUCKET_MANUALES = 'manuales';
export const TTL_ENLACE_SEG = 300;            /* los enlaces a los PDF y a las capturas caducan a los 5 minutos */

const TODAS = ['ADMIN'];
const g = (id, numero, titulo, perfil, rol, base) => ({
  id, numero, titulo, perfil, roles: [...new Set([rol, ...TODAS])],
  pdf: `pdf/${base}.pdf`, contenido: `json/${id}.json`,
});
export const CATALOGO = Object.freeze([
  g('g01', '01', 'Administradora', 'Administradora', 'ADMIN', 'MasterApp-01-Administradora_v2.0'),
  g('g02', '02', 'Encargado de proyecto', 'Proyectos', 'PROYECTOS', 'MasterApp-02-Encargado-de-Proyecto_v2.0'),
  g('g02b', '02B', 'Operativo', 'Operativo', 'OPERATIVO', 'MasterApp-02B-Operativo_v2.0'),
  g('g03', '03', 'Torre de control', 'Torre de control', 'TORRE', 'MasterApp-03-Torre-de-Control_v2.0'),
  g('g04', '04', 'Revisión de liquidaciones', 'Validador', 'VALIDADOR', 'MasterApp-04-Revision-de-Liquidaciones_v2.0'),
  g('g05', '05', 'Facturación', 'Facturación', 'FACTURACION', 'MasterApp-05-Facturacion_v2.0'),
  g('g06', '06', 'Gerencia Comercial', 'Gerencia Comercial', 'GERENTE_COMERCIAL', 'MasterApp-06-Gerencia-Comercial_v2.0'),
  g('g08', '08', 'Gerencia de Transporte', 'Gerente de Transporte', 'GERENTE_TRANSPORTE', 'MasterApp-08-Gerencia-de-Transporte_v2.0'),
]);

/* Guías que el rol puede consultar (lista vacía si no tiene ninguna). */
export const guiasDeRol = rol => CATALOGO.filter(x => typeof rol === 'string' && x.roles.includes(rol));
/* Devuelve la guía solo si el id es EXACTAMENTE uno del catálogo y el rol está autorizado; si no, null. */
export const guiaPermitida = (rol, id) => (typeof id === 'string' ? guiasDeRol(rol).find(x => x.id === id) : undefined) || null;
/* Las capturas solo se firman si su nombre es simple y figura en la lista de la propia guía. */
export const NOMBRE_IMAGEN = /^[A-Za-z0-9_-]{1,60}\.(png|jpg|jpeg|webp)$/;
export const rutaImagen = nombre => (typeof nombre === 'string' && NOMBRE_IMAGEN.test(nombre)) ? `img/${nombre}` : null;

/* Resumen público de una guía (sin rutas internas). */
export const fichaGuia = (x, extra = {}) => ({ id: x.id, numero: x.numero, titulo: x.titulo, perfil: x.perfil, ...extra });
