/* snapshot.mjs · construye la foto de datos que ve un usuario, con enlaces firmados. */
export async function armarSnapshot(E, uid, deps, ventana) {
  const DB = E.getDB(), A = DB.usuarios.find(u => u.id === uid), has = p => E.hasPerm(A, p), API = E.API;
  const seguro = (f, d) => { try { return f(); } catch (e) { return d; } };
  const trips = seguro(() => API.listarViajes(uid), []);
  const vis = new Set(trips.map(t => t.id));
  const puedeLiq = has('liq_ver') || has('liq_enviar');
  const liquidaciones = [], evidencias = [], audit = new Map();
  if (puedeLiq) {
    /* Agrupar las liquidaciones por viaje UNA sola vez. Antes se llamaba API.liquidaciones(uid,t.id) por cada viaje,
       y cada llamada hacía un find lineal sobre los viajes y un filter lineal → O(viajes²). Con miles de viajes eso
       revienta el límite de CPU de la Edge Function (error 546). */
    const liqPorViaje = new Map();
    for (const l of DB.liquidaciones) { let a = liqPorViaje.get(l.viajeId); if (!a) { a = []; liqPorViaje.set(l.viajeId, a); } a.push(l); }
    for (const t of trips) for (const l of (liqPorViaje.get(t.id) || [])) { const { evidencia, ...r } = l; liquidaciones.push(r); }
  }
  const evs = puedeLiq ? DB.evidencias.filter(e => vis.has(e.viajeId)) : [];
  const agr = (has('comercial_ver') || has('finanzas_ver')) ? seguro(() => API.agrupaciones(uid), []) : [];
  const puedeOrd = has('finanzas_ver') || has('comercial_ver') || has('pagos_registrar');
  const ord = puedeOrd ? seguro(() => API.ordenesPago(uid), []) : [];
  const ordPaths = [];
  ord.forEach(o => { const em = o.emision && o.emision.documento, tr = o.transferencia;
    if (em && em.path) ordPaths.push(em.path);
    if (tr && tr.evidencia && tr.evidencia.path) ordPaths.push(tr.evidencia.path);
    if (tr && tr.factura && tr.factura.path) ordPaths.push(tr.factura.path); });
  /* Órdenes de compra: PDF por versiones y evidencias de la respuesta del cliente, siempre en el bucket privado (URL firmada de 1 h). */
  const ocs = has('oc_ver') ? seguro(() => API.ordenesCompra(uid), []) : [];
  const ocPaths = [];
  ocs.forEach(o => { (o.documentos || []).forEach(d => d.path && ocPaths.push(d.path)); ((o.respuesta && o.respuesta.evidencias) || []).forEach(e => e.path && ocPaths.push(e.path)); });
  /* Agrupaciones de cobro: PDF interno/cliente por versiones, evidencias de autorización y comprobantes de cobro, todo privado. */
  const agrPaths = [];
  agr.forEach(g => { (g.pdfs || []).forEach(p => p.path && agrPaths.push(p.path)); (g.evidenciasAutorizacion || []).forEach(e => e.path && agrPaths.push(e.path)); (g.rechazos || []).forEach(e => e.path && agrPaths.push(e.path)); (g.cobros || []).forEach(c => c.archivoPath && agrPaths.push(c.archivoPath)); });
  const paths = [...evs.map(e => e.path), ...agr.map(g => g.emision && g.emision.archivoPath), ...agrPaths, ...ordPaths, ...ocPaths].filter(Boolean).slice(-600);
  const urls = paths.length ? await deps.firmar(paths) : new Map();
  evs.forEach(e => evidencias.push({ id: e.id, viajeId: e.viajeId, liqId: e.liqId, dataUrl: urls.get(e.path) || '', path: '', porId: e.porId, por: e.por, en: e.en }));
  const agrupaciones = agr.map(g => {
    const x = g.emision && g.emision.archivoPath ? { ...g, emision: { ...g.emision, archivo: urls.get(g.emision.archivoPath) || '', archivoPath: '' } } : { ...g };
    if (g.pdfs) x.pdfs = g.pdfs.map(p => ({ ...p, url: p.path ? (urls.get(p.path) || '') : '' }));
    if (g.evidenciasAutorizacion) x.evidenciasAutorizacion = g.evidenciasAutorizacion.map(e => ({ ...e, url: e.path ? (urls.get(e.path) || '') : '' }));
    if (g.rechazos) x.rechazos = g.rechazos.map(e => ({ ...e, url: e.path ? (urls.get(e.path) || '') : '' }));
    if (g.cobros) x.cobros = g.cobros.map(c => c.archivoPath ? { ...c, url: urls.get(c.archivoPath) || '' } : c);
    return x;
  });
  if (has('auditoria_ver')) DB.audit.slice(-2000).forEach(e => audit.set(e.id, e));
  else {
    if (has('comercial_ver')) DB.audit.filter(e => e.entidad === 'AGRUPACION').forEach(e => audit.set(e.id, e));
    /* Un solo recorrido de la auditoría para TODOS los viajes (antes: API.historial por viaje → O(viajes²)). */
    const histPorViaje = API.historiales(uid, !has('historial_ver') && has('viajes_editar_tiempos'));
    for (const t of trips) for (const e of (histPorViaje.get(t.id) || [])) audit.set(e.id, e);
  }
  const fiscal = has('clientes_gestionar') || has('comercial_ver') || has('finanzas_ver') || has('tablero_ver');
  const clientes = DB.clientes.map(c => fiscal ? c : { ...c, nit: '', direccionFiscal: '', correoFacturacion: '', contacto: '', telefono: '', creditoDias: '', observaciones: '' });
  const admin = has('usuarios_gestionar');
  const usuarios = DB.usuarios.map(u => admin ? { ...u, clave: '' } : { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol, activo: u.activo, proyectos: u.proyectos, clave: '' });
  return {
    yo: uid, ventana: ventana || null, usuarios, acceso: DB.acceso, permisos: DB.permisos, clientes, trips, liquidaciones, evidencias, agrupaciones,
    audit: [...audit.values()].sort((a, b) => a.id < b.id ? -1 : 1),
    pagos: has('finanzas_ver') ? DB.pagos : [],
    ordenesCompra: ocs.map(o => ({ ...o,
      documentos: (o.documentos || []).map(d => ({ ...d, url: d.path ? (urls.get(d.path) || '') : '' })),
      respuesta: o.respuesta ? { ...o.respuesta, evidencias: (o.respuesta.evidencias || []).map(e => ({ ...e, url: e.path ? (urls.get(e.path) || '') : '' })) } : o.respuesta })),
    ordenesPago: ord.map(o => { const c = JSON.parse(JSON.stringify(o));
      if (c.emision && c.emision.documento) c.emision.documentoUrl = urls.get(c.emision.documento.path) || '';
      if (c.transferencia) { if (c.transferencia.evidencia) c.transferencia.evidenciaUrl = urls.get(c.transferencia.evidencia.path) || ''; if (c.transferencia.factura) c.transferencia.facturaUrl = urls.get(c.transferencia.factura.path) || ''; }
      return c; }), rutas: has('rutas_ver') ? seguro(() => API.rutas(uid), []) : [],
    tarifas: has('tarifas_ver') ? seguro(() => API.tarifas(uid), []) : [],
    mem: has('tarifas_ver') ? seguro(() => API.mem(uid), []) : [],
    reportesAyuda: seguro(() => API.reportesAyuda(uid), []),
    notificaciones: DB.notificaciones.filter(n => A.rol === 'ADMIN' || n.destinatarios.includes(A.rol) || (n.usuarios || []).includes(A.id)),
    config: DB.config, catalogos: { pilotos: E.PILOTOS, flota: E.FLOTA, destinos: E.DESTINOS,
      listas: { tipoUnidad: E.CAT.tipoUnidad, opl: E.CAT.opl, tipoCarga: E.CAT.tipoCarga, tipoViaje: E.CAT.tipoViaje, arrastre: E.CAT.arrastre, tipoLicencia: E.CAT.tipoLicencia } }
  };
}
