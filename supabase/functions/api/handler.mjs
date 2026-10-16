/* handler.mjs · lógica de la API, independiente del entorno (Deno en producción, Node en las pruebas).
   Todas las operaciones se ejecutan con el motor de reglas (core.mjs) sobre el estado leído de la base, con el actor
   tomado del token verificado, y se guardan en UNA transacción. Si algo falla, no se guarda nada. */
import { createEngine } from './core.mjs';
import { loadState, saveState, fotografia } from './store.mjs';

export const OPS_ESCRITURA = ['crearViaje', 'editarViaje', 'iniciar', 'finalizar', 'torreMoverEstado', 'enviarLiquidacion', 'aprobar', 'devolver', 'aprobarShipmentDuplicado', 'prepararFactura', 'actualizarFactura', 'enviarFactura', 'emitirFactura',
  'registrarCobro', 'corregirFactura', 'anularAgrupacion', 'registrarImportes', 'registrarPago', 'anularPago', 'crearOrdenPago', 'adjuntarDocumentoOrden', 'registrarTransferencia', 'anularOrdenPago', 'crearTarifa', 'editarTarifa', 'cambiarEstadoTarifa', 'aplicarTarifa', 'aplicarTarifasPendientes',
  'solicitarRuta', 'registrarRuta', 'validarRuta', 'rechazarRuta', 'aprobarRutaComercial', 'aprobarRutaTransporte', 'marcarNotificacion', 'setPermiso', 'guardarUsuario', 'guardarCliente', 'guardarReglasTorre'];
export const OPS_LECTURA = ['snapshot', 'verificarAuditoria', 'mantenimientos', 'gastos'];
const MAX_ARGS = 300 * 1024;
const falla = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

function rutasDeArchivos(args) {
  const out = [];
  const visita = v => { if (v && typeof v === 'object') { if (typeof v.path === 'string') out.push(v.path); Object.values(v).forEach(visita); } };
  visita(args); return [...new Set(out)];
}

/* deps: { transaccion(fn(q)), firmar(paths)→Map, crearUsuarioAuth({email,password})→id, borrarUsuarioAuth(id) } */
export async function ejecutar(deps, actorId, { op, args } = {}) {
  if (![...OPS_ESCRITURA, ...OPS_LECTURA].includes(op)) return falla('OP_INVALIDA', 'Operación no reconocida.');
  args = args == null ? [] : args;
  if (!Array.isArray(args)) return falla('ARGUMENTOS', 'Los argumentos deben ser una lista.');
  if (JSON.stringify(args).length > MAX_ARGS) return falla('ARGUMENTOS', 'La solicitud es demasiado grande.');
  if (!actorId || !/^[0-9a-f-]{36}$/i.test(String(actorId))) return falla('NO_AUTENTICADO', 'Sesión no válida.');
  let authCreado = null;
  try {
    const salida = await deps.transaccion(async q => {
      /* Una operación de ESCRITURA a la vez (exclusivo): sin carreras ni duplicados. Las LECTURAS toman un lock
         compartido: pueden correr en paralelo entre sí, pero nunca a la vez que una escritura (así el snapshot se
         arma sobre un estado consistente sin bloquear a las demás lecturas). */
      const soloLectura = OPS_LECTURA.includes(op);
      await q(`select pg_advisory_xact_lock${soloLectura ? '_shared' : ''}(727001)`);
      /* La auditoría solo se necesita completa para el snapshot y para verificar la cadena; el resto de operaciones
         (incluidas las de escritura, que solo encadenan el hash del último evento) leen solo la cola. */
      const fullAudit = op === 'snapshot' || op === 'verificarAuditoria';
      const { db, catalogos } = await loadState(q, fullAudit ? {} : { auditoriaTail: 1 });
      const E = createEngine();
      E.PILOTOS.push(...catalogos.pilotos); E.FLOTA.push(...catalogos.flota); E.DESTINOS.push(...catalogos.destinos);
      E.setDB(db);
      const A = db.usuarios.find(u => u.id === actorId);
      if (!A || !A.activo) return { resp: falla('NO_AUTENTICADO', 'Tu cuenta no tiene un perfil activo en la aplicación.'), commit: false };
      let resultado = null, rechazo = null;
      if (op === 'snapshot') return { resp: { ok: true, snapshot: await armarSnapshot(E, actorId, deps) }, commit: false };
      /* flota (Fleetio): se consultan bajo demanda, NO entran al snapshot (pueden ser miles de filas) */
      if (op === 'mantenimientos' || op === 'gastos') {
        if (!(E.hasPerm(A, 'catalogos_ver') || E.hasPerm(A, 'finanzas_ver'))) return { resp: falla('SIN_PERMISO', 'Tu perfil no puede consultar la flota.'), commit: false };
        const tabla = op === 'mantenimientos' ? 'mantenimientos' : 'gastos';
        const f = (args[0] && typeof args[0] === 'object') ? args[0] : {};
        const lim = Math.min(Math.max(Number(f.limite) || 500, 1), 2000);
        const unidad = f.unidad ? String(f.unidad) : '';
        const rows = (await q(`select * from master.${tabla}${unidad ? ' where unidad=$1' : ''} order by fecha desc limit ${lim}`, unidad ? [unidad] : [])).rows;
        return { resp: { ok: true, result: rows }, commit: false };
      }
      if (op === 'verificarAuditoria') {
        try { resultado = E.API.verificarAuditoria(actorId); } catch (e) { if (!(e instanceof E.ApiError)) throw e; return { resp: falla(e.code, e.message), commit: false }; }
        return { resp: { ok: true, result: resultado }, commit: false };
      }
      /* evidencias en almacenamiento: el motor solo acepta archivos que existan de verdad en el bucket */
      const rutas = rutasDeArchivos(args);
      const existentes = new Set(rutas.length ? (await q("select name from storage.objects where bucket_id='evidencias' and name = any(string_to_array($1,'|'))", [rutas.join('|')])).rows.map(r => r.name) : []);
      E.ENV.storageExists = p => existentes.has(p);
      /* alta de usuarios: la cuenta de acceso se crea en Supabase Auth (solo la administradora, con la clave de servicio del servidor) */
      if (op === 'guardarUsuario' && args[0] && !args[0].id) {
        if (!E.hasPerm(A, 'usuarios_gestionar')) rechazo = falla('SIN_PERMISO', 'Tu perfil no puede gestionar usuarios.');
        else {
          const d = args[0];
          if (!/^\S+@\S+\.\S+$/.test(String(d.email || '').trim())) rechazo = falla('VALIDACION', 'Escribe un correo válido para el acceso.');
          else if (String(d.clave || '').length < 8) rechazo = falla('VALIDACION', 'La contraseña inicial debe tener al menos 8 caracteres.');
          else {
            authCreado = await deps.crearUsuarioAuth({ email: String(d.email).trim().toLowerCase(), password: String(d.clave) });
            args = [{ ...d, authId: authCreado, clave: '' }, ...args.slice(1)];
          }
        }
      }
      if (rechazo) return { resp: rechazo, commit: false };
      /* fotografia() recorre TODAS las filas y las serializa: es caro, así que solo se calcula para operaciones que escriben (no en lecturas como snapshot). */
      const antes = fotografia(db);
      try { resultado = E.API[op](actorId, ...args); }
      catch (e) {
        if (!(e instanceof E.ApiError)) throw e;
        rechazo = falla(e.code, e.message, e.faltantes ? { faltantes: e.faltantes } : {});
      }
      if (db.evidencias.some(e => e.dataUrl)) throw new Error('Las evidencias deben estar en el almacenamiento protegido, no incrustadas.');
      await saveState(q, antes, db, rechazo);                                  // si el motor rechazó, solo se guarda el registro de seguridad; saveState verifica que no haya cambios parciales
      /* Un guardado ya consumió CPU comparando y persistiendo el estado completo. No se arma otro snapshot
         dentro de la misma petición: con miles de viajes Superbase corta la respuesta antes de confirmar al cliente. */
      return { resp: rechazo ? rechazo : { ok: true, result: resultado === undefined ? null : resultado }, commit: true };
    });
    if (salida.resp.ok === false && authCreado && deps.borrarUsuarioAuth) { try { await deps.borrarUsuarioAuth(authCreado); } catch (_) { /* se informa abajo */ } }
    return salida.resp;
  } catch (e) {
    if (authCreado && deps.borrarUsuarioAuth) { try { await deps.borrarUsuarioAuth(authCreado); } catch (_) { /* cuenta huérfana: revisar en Auth */ } }
    return falla('ERROR_SERVIDOR', 'El servidor no pudo completar la operación; no se guardó nada.', { detalle: String(e && e.message || e).slice(0, 300) });
  }
}

/* ---------- Foto de datos que ve ESTE usuario (misma autorización del motor + enlaces firmados de las evidencias) ---------- */
async function armarSnapshot(E, uid, deps) {
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
  const paths = [...evs.map(e => e.path), ...agr.map(g => g.emision && g.emision.archivoPath), ...ordPaths].filter(Boolean).slice(-400);
  const urls = paths.length ? await deps.firmar(paths) : new Map();
  evs.forEach(e => evidencias.push({ id: e.id, viajeId: e.viajeId, liqId: e.liqId, dataUrl: urls.get(e.path) || '', path: '', porId: e.porId, por: e.por, en: e.en }));
  const agrupaciones = agr.map(g => g.emision && g.emision.archivoPath ? { ...g, emision: { ...g.emision, archivo: urls.get(g.emision.archivoPath) || '', archivoPath: '' } } : g);
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
    yo: uid, usuarios, acceso: DB.acceso, permisos: DB.permisos, clientes, trips, liquidaciones, evidencias, agrupaciones,
    audit: [...audit.values()].sort((a, b) => a.id < b.id ? -1 : 1),
    pagos: has('finanzas_ver') ? DB.pagos : [],
    ordenesPago: ord.map(o => { const c = JSON.parse(JSON.stringify(o));
      if (c.emision && c.emision.documento) c.emision.documentoUrl = urls.get(c.emision.documento.path) || '';
      if (c.transferencia) { if (c.transferencia.evidencia) c.transferencia.evidenciaUrl = urls.get(c.transferencia.evidencia.path) || ''; if (c.transferencia.factura) c.transferencia.facturaUrl = urls.get(c.transferencia.factura.path) || ''; }
      return c; }), rutas: has('rutas_ver') ? seguro(() => API.rutas(uid), []) : [],
    tarifas: has('tarifas_ver') ? seguro(() => API.tarifas(uid), []) : [],
    mem: has('tarifas_ver') ? seguro(() => API.mem(uid), []) : [],
    notificaciones: DB.notificaciones.filter(n => A.rol === 'ADMIN' || n.destinatarios.includes(A.rol) || (n.usuarios || []).includes(A.id)),
    config: DB.config, catalogos: { pilotos: E.PILOTOS, flota: E.FLOTA, destinos: E.DESTINOS }
  };
}
