/* handler.mjs · lógica de la API, independiente del entorno (Deno en producción, Node en las pruebas).
   Todas las operaciones se ejecutan con el motor de reglas (core.mjs) sobre el estado leído de la base, con el actor
   tomado del token verificado, y se guardan en UNA transacción. Si algo falla, no se guarda nada. */
import { createEngine } from './core.mjs';
import { loadState, saveState, fotografia } from './store.mjs';

export const OPS_ESCRITURA = ['crearViaje', 'editarViaje', 'iniciar', 'finalizar', 'enviarLiquidacion', 'aprobar', 'devolver', 'prepararFactura', 'actualizarFactura', 'enviarFactura', 'emitirFactura',
  'registrarCobro', 'corregirFactura', 'anularAgrupacion', 'registrarImportes', 'registrarPago', 'anularPago', 'crearTarifa', 'editarTarifa', 'cambiarEstadoTarifa', 'aplicarTarifa', 'aplicarTarifasPendientes',
  'solicitarRuta', 'registrarRuta', 'validarRuta', 'rechazarRuta', 'marcarNotificacion', 'setPermiso', 'guardarUsuario', 'guardarCliente', 'guardarReglasTorre', 'guardarOpcionesTorre'];
export const OPS_LECTURA = ['snapshot', 'verificarAuditoria'];
const MAX_ARGS = 300 * 1024;
const falla = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });
const sinAuditoria = db => JSON.stringify({ ...db, audit: undefined, seq: undefined });

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
      await q('select pg_advisory_xact_lock(727001)');                     // una operación a la vez: sin carreras ni duplicados
      const { db, catalogos } = await loadState(q);
      const E = createEngine();
      E.PILOTOS.push(...catalogos.pilotos); E.FLOTA.push(...catalogos.flota); E.DESTINOS.push(...catalogos.destinos);
      E.setDB(db);
      const A = db.usuarios.find(u => u.id === actorId);
      if (!A || !A.activo) return { resp: falla('NO_AUTENTICADO', 'Tu cuenta no tiene un perfil activo en la aplicación.'), commit: false };
      const antes = fotografia(db);
      const base = sinAuditoria(db);
      let resultado = null, rechazo = null;
      if (op === 'snapshot') return { resp: { ok: true, snapshot: await armarSnapshot(E, actorId, deps) }, commit: false };
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
      try { resultado = E.API[op](actorId, ...args); }
      catch (e) {
        if (!(e instanceof E.ApiError)) throw e;
        rechazo = falla(e.code, e.message, e.faltantes ? { faltantes: e.faltantes } : {});
      }
      if (rechazo && sinAuditoria(db) !== base) throw new Error('Operación rechazada con cambios parciales: se descarta para no guardar datos a medias.');
      if (db.evidencias.some(e => e.dataUrl)) throw new Error('Las evidencias deben estar en el almacenamiento protegido, no incrustadas.');
      await saveState(q, antes, db);                                           // si el motor rechazó, solo se guarda el registro de seguridad
      const snap = rechazo ? null : await armarSnapshot(E, actorId, deps);
      return { resp: rechazo ? rechazo : { ok: true, result: resultado === undefined ? null : resultado, snapshot: snap }, commit: true };
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
  if (puedeLiq) for (const t of trips) seguro(() => API.liquidaciones(uid, t.id), []).forEach(l => { const { evidencia, ...r } = l; liquidaciones.push(r); });
  const evs = puedeLiq ? DB.evidencias.filter(e => vis.has(e.viajeId)) : [];
  const agr = (has('comercial_ver') || has('finanzas_ver')) ? seguro(() => API.agrupaciones(uid), []) : [];
  const paths = [...evs.map(e => e.path), ...agr.map(g => g.emision && g.emision.archivoPath)].filter(Boolean).slice(-400);
  const urls = paths.length ? await deps.firmar(paths) : new Map();
  evs.forEach(e => evidencias.push({ id: e.id, viajeId: e.viajeId, liqId: e.liqId, dataUrl: urls.get(e.path) || '', path: '', porId: e.porId, por: e.por, en: e.en }));
  const agrupaciones = agr.map(g => g.emision && g.emision.archivoPath ? { ...g, emision: { ...g.emision, archivo: urls.get(g.emision.archivoPath) || '', archivoPath: '' } } : g);
  if (has('auditoria_ver')) DB.audit.slice(-2000).forEach(e => audit.set(e.id, e));
  else {
    if (has('comercial_ver')) DB.audit.filter(e => e.entidad === 'AGRUPACION').forEach(e => audit.set(e.id, e));
    for (const t of trips) {
      const h = has('historial_ver') ? seguro(() => API.historial(uid, t.id), []) : has('viajes_editar_tiempos') ? seguro(() => API.historial(uid, t.id, true), []) : [];
      h.forEach(e => audit.set(e.id, e));
    }
  }
  const fiscal = has('clientes_gestionar') || has('comercial_ver') || has('finanzas_ver') || has('tablero_ver');
  const clientes = DB.clientes.map(c => fiscal ? c : { ...c, nit: '', direccionFiscal: '', correoFacturacion: '', contacto: '', telefono: '', creditoDias: '', observaciones: '' });
  const admin = has('usuarios_gestionar');
  const usuarios = DB.usuarios.map(u => admin ? { ...u, clave: '' } : { id: u.id, usuario: u.usuario, nombre: u.nombre, rol: u.rol, activo: u.activo, proyectos: u.proyectos, clave: '' });
  return {
    yo: uid, usuarios, acceso: DB.acceso, permisos: DB.permisos, clientes, trips, liquidaciones, evidencias, agrupaciones,
    audit: [...audit.values()].sort((a, b) => a.id < b.id ? -1 : 1),
    pagos: has('finanzas_ver') ? DB.pagos : [], rutas: has('rutas_ver') ? seguro(() => API.rutas(uid), []) : [],
    tarifas: has('tarifas_ver') ? seguro(() => API.tarifas(uid), []) : [],
    mem: has('tarifas_ver') ? seguro(() => API.mem(uid), []) : [],
    notificaciones: DB.notificaciones.filter(n => A.rol === 'ADMIN' || n.destinatarios.includes(A.rol) || (n.usuarios || []).includes(A.id)),
    config: DB.config, catalogos: { pilotos: E.PILOTOS, flota: E.FLOTA, destinos: E.DESTINOS }
  };
}
