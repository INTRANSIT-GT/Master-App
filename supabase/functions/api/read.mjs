/* read.mjs · ventana de viajes, filtros de lectura y conteos de la API. */
export const VENTANA_MESES = 3;
export const VIAJES_PAGINA = 400;
export const BUSCA_LIMITE = 60;
export const ESTADOS_EN_CURSO = ['PLANIFICADO', 'EN_RUTA', 'ENTREGADO', 'LIQUIDADO', 'RECHAZADO', 'ACEPTADO'];
export const COLA_AUDITORIA = 4000;                 /* eventos recientes que se leen por lectura (la tabla crece sin límite) */
export const SOLO_RESUMEN = ['perfiles', 'permisos', 'acceso_cliente', 'clientes', 'viajes', 'agrupaciones', 'pagos'];
export const SOLO_HISTORICO = ['perfiles', 'permisos', 'acceso_cliente', 'clientes', 'viajes', 'liquidaciones', 'evidencias'];
/* Condiciones SQL de la ventana y de la página de histórico. Son un superconjunto deliberado de la regla final,
   que se aplica en memoria (enVentana): así el SQL no repite el criterio completo y no hay dos reglas que se separen. */
export const COND_VENTANA = `(v.estado = any($1::text[]) or coalesce(v.fecha_plan,'') >= $2 or (v.estado = 'FACTURADO' and exists (select 1 from master.viajes_tarifa tv where tv.viaje_id = v.id and tv.tarifa_opl > 0)))`;
/* Página del histórico por clave (fecha plan + id): así ninguna página repite ni se salta viajes,
   ni siquiera cuando muchos comparten la misma fecha (los que no tienen fecha van al final). */
export const condAntes = (conId) => `(coalesce(v.fecha_plan,'') < $1${conId ? ` or (coalesce(v.fecha_plan,'') = $1 and v.id < $2)` : ''}) and not (v.estado = any($${conId ? 3 : 2}::text[]))`;
export const idAntes = a => { const v = String(argsDe(a).antesId || '').trim(); return /^[A-Za-z0-9._-]{1,40}$/.test(v) ? v : ''; };
/* Búsqueda en TODO el histórico (no solo en la ventana cargada): por n.º de viaje, No. de transporte,
   No. de viaje interno, producto, unidad, placa del arrastre, proveedor (OPL), proyecto o factura. */
export const COND_BUSCA = `(v.id ilike $1 or coalesce(v.shipment,'') ilike $1 or coalesce(v.no_viaje,'') ilike $1 or coalesce(v.producto,'') ilike $1 or coalesce(v.unidad_id,'') ilike $1 or coalesce(v.placa_arrastre,'') ilike $1 or coalesce(v.opl,'') ilike $1 or coalesce(v.proyecto_cat,'') ilike $1 or coalesce(v.numero_factura,'') ilike $1)`;
export const textoDe = a => String(argsDe(a).texto || '').trim().slice(0, 60);
export const likeDe = t => '%' + t.replace(/[\\%_]/g, m => '\\' + m) + '%';
export const desdeVentana = () => { const d = new Date(); d.setMonth(d.getMonth() - VENTANA_MESES); return d.toISOString().slice(0, 10); };
/* Los argumentos llegan como lista: se toma el primer objeto (si lo hay). */
export const argsDe = a => Array.isArray(a)
  ? (a[0] && typeof a[0] === 'object' && !Array.isArray(a[0]) ? a[0] : {})
  : (a && typeof a === 'object' ? a : {});
export const antesDe = a => /^\d{4}-\d{2}-\d{2}$/.test(String(argsDe(a).antesDe || '')) ? String(argsDe(a).antesDe) : desdeVentana();
export const limitePagina = a => Math.min(Math.max(Number(argsDe(a).limite) || VIAJES_PAGINA, 1), 1000);

/* Regla exacta de la ventana (el SQL de arriba trae un superconjunto): lo que falta cerrar siempre, lo reciente
   por fecha y lo Facturado que todavía no tiene orden de pago (pendiente de pagar al proveedor). */
export function enVentana(t, desde, enOrden) {
  if (ESTADOS_EN_CURSO.includes(t.estado)) return true;
  const f = String(t.fechaPlan || '').slice(0, 10);
  if (f && f >= desde) return true;
  return t.estado === 'FACTURADO' && Number(t.tarifaOpl) > 0 && !enOrden.has(t.id);
}
export function aplicarVentana(E) {
  const DB = E.getDB(), enOrden = new Set();
  for (const o of DB.ordenesPago) if (o.estado === 'ACTIVA') for (const id of o.viajeIds) enOrden.add(id);
  const desde = desdeVentana();
  DB.trips = DB.trips.filter(t => enVentana(t, desde, enOrden));
  return { desde, meses: VENTANA_MESES };
}
/* La bitácora de los viajes que sí se envían se lee aparte (no se carga la tabla completa). */
export async function auditoriaDeViajes(q, ids) {
  if (!ids.length) return [];
  const { rows } = await q('select id,entidad,viaje_id,accion,campo,anterior,nuevo,por_id,por,rol,en,motivo,ref,prev,hash,extra from master.auditoria where viaje_id = any($1::text[])', [ids]);
  return rows.map(r => Object.assign({
    id: r.id, entidad: r.entidad, viajeId: r.viaje_id, accion: r.accion, campo: r.campo, anterior: r.anterior, nuevo: r.nuevo,
    porId: r.por_id, por: r.por, rol: r.rol, en: r.en instanceof Date ? r.en.toISOString() : r.en, motivo: r.motivo, ref: r.ref, prev: r.prev, hash: r.hash,
  }, r.extra && typeof r.extra === 'object' ? r.extra : {}));
}
export const fusionarAuditoria = (cola, viajes) => {
  const m = new Map();
  for (const e of cola) m.set(e.id, e);
  for (const e of viajes) m.set(e.id, e);
  return [...m.values()].sort((x, y) => x.id < y.id ? -1 : 1);
};
/* Cuántos viajes ve este usuario en TODA la base (para poder decir «N de M» en la pantalla). */
/* Condición SQL con la MISMA visibilidad que el motor: los clientes y proyectos del perfil, más lo que ve un
   perfil comercial (viajes ya aceptados/facturados/cobrados). Devuelve null si el perfil no ve ningún viaje.
   La usan el conteo de «Cargados N de M» y el resumen por mes de la gráfica: así no hace falta cargar y recorrer
   los 7.000 viajes para contestar esas dos cosas. */
export function filtroVisible(A, db, E) {
  const cli = [...new Set(db.acceso.filter(a => a.userId === A.id).map(a => a.cliente))];
  const proy = [...new Set((A.proyectos || []).filter(Boolean))];
  const partes = [], params = [];
  if (cli.length) {
    params.push(cli);
    let c = `v.cliente_id = any($${params.length}::text[])`;
    if (proy.length) { params.push(proy); c += ` and v.proyecto_cat = any($${params.length}::text[])`; }
    partes.push('(' + c + ')');
  }
  if (E.hasPerm(A, 'comercial_ver')) partes.push(`v.estado = any(array['ACEPTADO','FACTURADO','COBRADO'])`);
  return partes.length ? { sql: partes.join(' or '), params } : null;
}
/* Filtros de la pantalla de Finanzas (cliente, proyecto, proveedor y fechas plan) traducidos a SQL: la gráfica
   por mes se calcula en la base, así que el filtro tiene que viajar hasta la consulta. */
export function filtrosGrafica(f) {
  const sql = [], params = [];
  const t = v => (v == null ? '' : String(v).trim());
  const add = (col, val) => { params.push(val); sql.push(`${col} = $${params.length}`); };
  if (t(f.desde)) { params.push(t(f.desde)); sql.push(`v.fecha_plan >= $${params.length}`); }
  if (t(f.hasta)) { params.push(t(f.hasta)); sql.push(`v.fecha_plan <= $${params.length}`); }
  if (t(f.cliente)) add('v.cliente_id', t(f.cliente));
  if (t(f.proyecto)) add('v.proyecto_cat', t(f.proyecto));
  if (t(f.proveedor)) add('v.opl', t(f.proveedor));
  return { sql, params };
}
/* Cuántos viajes abarca la base para este perfil (el «M» de «Cargados N de M»). Antes se contaba evaluando la
   función de RLS viaje por viaje: 2,7 s de promedio con 7.000 viajes y creciendo. */
export async function contarVisibles(q, A, db, E) {
  if (E.hasPerm(A, 'viajes_ver_todos')) { const { rows } = await q('select count(*)::int n from master.viajes'); return rows[0] ? rows[0].n : 0; }
  const f = filtroVisible(A, db, E);
  if (!f) return 0;
  const { rows } = await q(`select count(*)::int n from master.viajes v where ${f.sql}`, f.params);
  return rows[0] ? rows[0].n : 0;
}
