/* handler.mjs · lógica de la API, independiente del entorno (Deno en producción, Node en las pruebas).
   Todas las operaciones se ejecutan con el motor de reglas (core.mjs) sobre el estado leído de la base, con el actor
   tomado del token verificado, y se guardan en UNA transacción. Si algo falla, no se guarda nada. */
import { createEngine } from './core.mjs';
import { loadState, saveState, fotografia } from './store.mjs';

export const OPS_ESCRITURA = ['crearViaje', 'editarViaje', 'iniciar', 'finalizar', 'torreMoverEstado', 'torreEditarHorarios', 'enviarLiquidacion', 'aprobar', 'devolver', 'aprobarShipmentDuplicado', 'prepararFactura', 'actualizarFactura',  'enviarFactura', 'emitirFactura',
  'registrarCobro', 'corregirFactura', 'anularAgrupacion', 'registrarImportes', 'registrarPago', 'anularPago', 'crearOrdenPago', 'adjuntarDocumentoOrden', 'registrarTransferencia', 'anularOrdenPago', 'crearTarifa', 'editarTarifa', 'cambiarEstadoTarifa', 'aplicarTarifa', 'aplicarTarifasPendientes',
  'solicitarRuta', 'registrarRuta', 'validarRuta', 'rechazarRuta', 'aprobarRutaComercial', 'aprobarRutaTransporte', 'marcarNotificacion', 'setPermiso', 'guardarUsuario', 'guardarCliente', 'guardarReglasTorre', 'activarUsuario', 'cambiarClave', 'guardarCatalogo', 'crearReporteAyuda', 'cambiarEstadoReporteAyuda'];
export const OPS_LECTURA = ['snapshot', 'verificarAuditoria', 'mantenimientos', 'gastos', 'resumenHistorico', 'viajesAnteriores', 'buscarViajes'];
const MAX_ARGS = 300 * 1024;
const falla = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

/* ---- Escala: con ~3.000 viajes al mes, cargar y enviar TODO el histórico en cada lectura es inviable
   (decenas de MB de respuesta y la Edge Function al límite de CPU). Se separa en tres:
     · snapshot         → los viajes que se trabajan: en curso (sin importar la fecha), los últimos
                          VENTANA_MESES de los cerrados y los Facturados pendientes de pago al proveedor.
     · viajesAnteriores → páginas del histórico, a pedido.
     · resumenHistorico → totales de TODO el histórico, calculados por el mismo motor sobre los viajes visibles. */
const VENTANA_MESES = 3;
const VIAJES_PAGINA = 400;
const BUSCA_LIMITE = 60;
const ESTADOS_EN_CURSO = ['PLANIFICADO', 'EN_RUTA', 'ENTREGADO', 'LIQUIDADO', 'RECHAZADO', 'ACEPTADO'];
const COLA_AUDITORIA = 4000;                 /* eventos recientes que se leen por lectura (la tabla crece sin límite) */
const SOLO_RESUMEN = ['perfiles', 'permisos', 'acceso_cliente', 'clientes', 'viajes', 'agrupaciones', 'pagos'];
const SOLO_HISTORICO = ['perfiles', 'permisos', 'acceso_cliente', 'clientes', 'viajes', 'liquidaciones', 'evidencias'];
/* Condiciones SQL de la ventana y de la página de histórico. Son un superconjunto deliberado de la regla final,
   que se aplica en memoria (enVentana): así el SQL no repite el criterio completo y no hay dos reglas que se separen. */
const COND_VENTANA = `(v.estado = any($1::text[]) or coalesce(v.fecha_plan,'') >= $2 or (v.estado = 'FACTURADO' and exists (select 1 from master.viajes_tarifa tv where tv.viaje_id = v.id and tv.tarifa_opl > 0)))`;
/* Página del histórico por clave (fecha plan + id): así ninguna página repite ni se salta viajes,
   ni siquiera cuando muchos comparten la misma fecha (los que no tienen fecha van al final). */
const condAntes = (conId) => `(coalesce(v.fecha_plan,'') < $1${conId ? ` or (coalesce(v.fecha_plan,'') = $1 and v.id < $2)` : ''}) and not (v.estado = any($${conId ? 3 : 2}::text[]))`;
const idAntes = a => { const v = String(argsDe(a).antesId || '').trim(); return /^[A-Za-z0-9._-]{1,40}$/.test(v) ? v : ''; };
/* Búsqueda en TODO el histórico (no solo en la ventana cargada): por n.º de viaje, No. de transporte,
   No. de viaje interno, producto, unidad, placa del arrastre, proveedor (OPL), proyecto o factura. */
const COND_BUSCA = `(v.id ilike $1 or coalesce(v.shipment,'') ilike $1 or coalesce(v.no_viaje,'') ilike $1 or coalesce(v.producto,'') ilike $1 or coalesce(v.unidad_id,'') ilike $1 or coalesce(v.placa_arrastre,'') ilike $1 or coalesce(v.opl,'') ilike $1 or coalesce(v.proyecto_cat,'') ilike $1 or coalesce(v.numero_factura,'') ilike $1)`;
const textoDe = a => String(argsDe(a).texto || '').trim().slice(0, 60);
const likeDe = t => '%' + t.replace(/[\\%_]/g, m => '\\' + m) + '%';
const desdeVentana = () => { const d = new Date(); d.setMonth(d.getMonth() - VENTANA_MESES); return d.toISOString().slice(0, 10); };
/* Los argumentos llegan como lista: se toma el primer objeto (si lo hay). */
const argsDe = a => Array.isArray(a)
  ? (a[0] && typeof a[0] === 'object' && !Array.isArray(a[0]) ? a[0] : {})
  : (a && typeof a === 'object' ? a : {});
const antesDe = a => /^\d{4}-\d{2}-\d{2}$/.test(String(argsDe(a).antesDe || '')) ? String(argsDe(a).antesDe) : desdeVentana();
const limitePagina = a => Math.min(Math.max(Number(argsDe(a).limite) || VIAJES_PAGINA, 1), 1000);

/* Regla exacta de la ventana (el SQL de arriba trae un superconjunto): lo que falta cerrar siempre, lo reciente
   por fecha y lo Facturado que todavía no tiene orden de pago (pendiente de pagar al proveedor). */
function enVentana(t, desde, enOrden) {
  if (ESTADOS_EN_CURSO.includes(t.estado)) return true;
  const f = String(t.fechaPlan || '').slice(0, 10);
  if (f && f >= desde) return true;
  return t.estado === 'FACTURADO' && Number(t.tarifaOpl) > 0 && !enOrden.has(t.id);
}
function aplicarVentana(E) {
  const DB = E.getDB(), enOrden = new Set();
  for (const o of DB.ordenesPago) if (o.estado === 'ACTIVA') for (const id of o.viajeIds) enOrden.add(id);
  const desde = desdeVentana();
  DB.trips = DB.trips.filter(t => enVentana(t, desde, enOrden));
  return { desde, meses: VENTANA_MESES };
}
/* La bitácora de los viajes que sí se envían se lee aparte (no se carga la tabla completa). */
async function auditoriaDeViajes(q, ids) {
  if (!ids.length) return [];
  const { rows } = await q('select id,entidad,viaje_id,accion,campo,anterior,nuevo,por_id,por,rol,en,motivo,ref,prev,hash,extra from master.auditoria where viaje_id = any($1::text[])', [ids]);
  return rows.map(r => Object.assign({
    id: r.id, entidad: r.entidad, viajeId: r.viaje_id, accion: r.accion, campo: r.campo, anterior: r.anterior, nuevo: r.nuevo,
    porId: r.por_id, por: r.por, rol: r.rol, en: r.en instanceof Date ? r.en.toISOString() : r.en, motivo: r.motivo, ref: r.ref, prev: r.prev, hash: r.hash,
  }, r.extra && typeof r.extra === 'object' ? r.extra : {}));
}
const fusionarAuditoria = (cola, viajes) => {
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
function filtroVisible(A, db, E) {
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
function filtrosGrafica(f) {
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
async function contarVisibles(q, A, db, E) {
  if (E.hasPerm(A, 'viajes_ver_todos')) { const { rows } = await q('select count(*)::int n from master.viajes'); return rows[0] ? rows[0].n : 0; }
  const f = filtroVisible(A, db, E);
  if (!f) return 0;
  const { rows } = await q(`select count(*)::int n from master.viajes v where ${f.sql}`, f.params);
  return rows[0] ? rows[0].n : 0;
}

function rutasDeArchivos(args) {
  const out = [];
  const visita = v => { if (v && typeof v === 'object') { if (typeof v.path === 'string') out.push(v.path); Object.values(v).forEach(visita); } };
  visita(args); return [...new Set(out)];
}

/* deps: { transaccion(fn(q)), firmar(paths)→Map, crearUsuarioAuth({email,password})→id, borrarUsuarioAuth(id), cambiarClaveAuth({id,password}) } */
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
      /* Solo las ESCRITURAS toman el lock. Serializan su «leer → calcular → guardar» (y la cadena de la
         auditoría), que es donde sí hay carrera. Las LECTURAS no lo toman: la transacción ya ve un estado
         consistente por MVCC, y así un resumen largo no deja esperando a quien está guardando (esa espera de
         hasta 12 s era el primer motivo de «consultas lentas» en Supabase). */
      if (!OPS_LECTURA.includes(op)) await q('select pg_advisory_xact_lock(727001)');
      /* La auditoría crece sin límite: para verificar la cadena se lee entera; en el snapshot se lee la cola (más
         la bitácora de los viajes que se envían, que se agrega después); al escribir basta el último evento. */
      const fullAudit = op === 'verificarAuditoria';
      const opciones = op === 'resumenHistorico' ? { solo: SOLO_RESUMEN }
        : op === 'buscarViajes' ? { solo: SOLO_HISTORICO, auditoriaTail: COLA_AUDITORIA, viajesFiltro: textoDe(args)
            ? { sql: COND_BUSCA, params: [likeDe(textoDe(args))], orden: 'v.fecha_plan desc, v.id desc', limite: BUSCA_LIMITE }
            : { sql: 'false', params: [] } }
          : op === 'viajesAnteriores' ? { solo: SOLO_HISTORICO, auditoriaTail: COLA_AUDITORIA, viajesFiltro: idAntes(args)
            ? { sql: condAntes(true), params: [antesDe(args), idAntes(args), ESTADOS_EN_CURSO], orden: 'v.fecha_plan desc, v.id desc', limite: limitePagina(args) }
            : { sql: condAntes(false), params: [antesDe(args), ESTADOS_EN_CURSO], orden: 'v.fecha_plan desc, v.id desc', limite: limitePagina(args) } }
          : fullAudit ? {}
            : op === 'snapshot' ? { auditoriaTail: COLA_AUDITORIA, viajesFiltro: { sql: COND_VENTANA, params: [ESTADOS_EN_CURSO, desdeVentana()] } }
              : { auditoriaTail: 1 };
      const { db, catalogos } = await loadState(q, opciones);
      const E = createEngine();
      E.PILOTOS.push(...catalogos.pilotos); E.FLOTA.push(...catalogos.flota); E.DESTINOS.push(...catalogos.destinos);
      E.setDB(db);
      const A = db.usuarios.find(u => u.id === actorId);
      if (!A || !A.activo) return { resp: falla('NO_AUTENTICADO', 'Tu cuenta no tiene un perfil activo en la aplicación.'), commit: false };
      let resultado = null, rechazo = null;
      if (op === 'snapshot') {
        const ventana = aplicarVentana(E);
        const ids = E.getDB().trips.map(t => t.id);
        if (ids.length) E.getDB().audit = fusionarAuditoria(E.getDB().audit, await auditoriaDeViajes(q, ids));
        const enBase = await contarVisibles(q, A, db, E);
        return { resp: { ok: true, snapshot: await armarSnapshot(E, actorId, deps, Object.assign(ventana, { viajes: ids.length, enBase })) }, commit: false };
      }
      /* Totales de TODO el histórico (no de la ventana que se ve en pantalla): los calcula el mismo motor sobre
         los viajes que este usuario puede ver. Respuesta pequeña y no se guarda nada. */
      if (op === 'resumenHistorico') {
        /* El resumen por mes y por estado lo puede ver cualquiera que vea viajes; los NÚMEROS financieros solo
           quien tiene permiso de finanzas (por eso viajan por separado: puede venir `financiero: null`). */
        const puedeFin = E.hasPerm(A, 'finanzas_ver') || E.hasPerm(A, 'tarifas_opl_ver');
        if (!puedeFin && !E.hasPerm(A, 'viajes_ver') && !E.hasPerm(A, 'viajes_ver_todos') && !E.hasPerm(A, 'comercial_ver'))
          return { resp: falla('SIN_PERMISO', 'Tu perfil no puede consultar los viajes.'), commit: false };
        const todo = E.hasPerm(A, 'viajes_ver_todos');
        const fv = todo ? null : filtroVisible(A, db, E);
        /* La gráfica se resume en la base (una sola consulta, agrupada por estado y mes): es lo que ve todo el
           mundo y así no depende de cargar el histórico entero en memoria. */
        /* Los filtros de la pantalla (cliente, proyecto, proveedor, fechas plan) acotan la gráfica: así el
           resumen del mes cambia cuando se ajustan, sin cargar el histórico en memoria. */
        const fm = filtrosGrafica((args[0] && typeof args[0] === 'object') ? args[0] : {});
        const cond = [fv ? `(${fv.sql})` : '', ...fm.sql].filter(Boolean);
        const params = [...(fv ? fv.params : []), ...fm.params];
        const consulta = `select v.estado, substring(coalesce(v.fecha_plan,''),1,7) mes, count(*)::int n from master.viajes v`
          + (cond.length ? ` where ${cond.join(' and ')}` : '') + ' group by 1,2';
        const filas = (await q(consulta, params)).rows;
        const porEstado = {}, porMes = {};
        let total = 0;
        for (const r of filas) {
          porEstado[r.estado] = (porEstado[r.estado] || 0) + r.n;
          total += r.n;
          if (/^\d{4}-\d{2}$/.test(r.mes)) { const m = porMes[r.mes] = porMes[r.mes] || {}; m[r.estado] = (m[r.estado] || 0) + r.n; }
        }
        /* El bloque financiero SÍ necesita el motor (son las mismas reglas que la pantalla de Finanzas), así que
           se le dejan solo los viajes que este perfil puede ver. */
        const vis = new Set(E.API.listarViajes(actorId).map(t => t.id));
        const B = E.getDB();
        B.trips = B.trips.filter(t => vis.has(t.id));
        if (!(E.hasPerm(A, 'comercial_ver') || E.hasPerm(A, 'finanzas_ver'))) B.agrupaciones = [];
        if (!E.hasPerm(A, 'finanzas_ver')) B.pagos = [];
        /* Los números financieros van aparte y protegidos: si algún dato del histórico los rompe, la gráfica
           (que es lo que ve todo el mundo) igual se devuelve, y el motivo viaja en `finError` para mostrarlo. */
        let financiero = null, finError = '';
        if (puedeFin) { try { financiero = E.API.resumenFinanciero(actorId, argsDe(args)); } catch (e) { finError = String((e && e.message) || e).slice(0, 300); } }
        return { resp: { ok: true, result: { financiero, finError, porEstado, porMes, viajes: total } }, commit: false };
      }
      /* Una página del histórico (los viajes que quedan fuera de la ventana) o los resultados de una búsqueda en
         toda la base, con su liquidación, su evidencia y su bitácora, para mostrarlos igual que los recientes. */
      if (op === 'viajesAnteriores' || op === 'buscarViajes') {
        const B = E.getDB();
        const ids = B.trips.map(t => t.id);
        if (ids.length) B.audit = fusionarAuditoria(B.audit, await auditoriaDeViajes(q, ids));
        const s = await armarSnapshot(E, actorId, deps, null);
        const esBusca = op === 'buscarViajes';
        return { resp: { ok: true, result: { trips: s.trips, liquidaciones: s.liquidaciones, evidencias: s.evidencias, audit: s.audit,
          antesDe: esBusca ? '' : antesDe(args), texto: esBusca ? textoDe(args) : '', limite: esBusca ? BUSCA_LIMITE : limitePagina(args), pagina: ids.length } }, commit: false };
      }
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
      /* reasignar la contraseña de un usuario: el cambio real vive en Supabase Auth (clave de servicio del servidor).
         Primero se valida aqui; el evento queda en la auditoria al ejecutar la operacion del motor. */
      if (op === 'cambiarClave' && !rechazo) {
        if (!E.hasPerm(A, 'usuarios_gestionar')) rechazo = falla('SIN_PERMISO', 'Tu perfil no puede gestionar usuarios.');
        else {
          const u = db.usuarios.find(x => x.id === String(args[0] || ''));
          if (!u) rechazo = falla('NO_EXISTE', 'Usuario no encontrado.');
          else if (!u.email) rechazo = falla('VALIDACION', 'Ese usuario no tiene correo de acceso.');
          else if (String(args[1] || '').length < 8) rechazo = falla('VALIDACION', 'La contraseña debe tener al menos 8 caracteres.');
          else if (String(args[1] || '').length > 72) rechazo = falla('VALIDACION', 'La contraseña es demasiado larga (máximo 72 caracteres).');
          else if (typeof deps.cambiarClaveAuth !== 'function') rechazo = falla('SERVIDOR', 'El servidor no tiene configurado el cambio de contraseñas.');
          else await deps.cambiarClaveAuth({ id: u.id, password: String(args[1]) });
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
async function armarSnapshot(E, uid, deps, ventana) {
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
    yo: uid, ventana: ventana || null, usuarios, acceso: DB.acceso, permisos: DB.permisos, clientes, trips, liquidaciones, evidencias, agrupaciones,
    audit: [...audit.values()].sort((a, b) => a.id < b.id ? -1 : 1),
    pagos: has('finanzas_ver') ? DB.pagos : [],
    ordenesPago: ord.map(o => { const c = JSON.parse(JSON.stringify(o));
      if (c.emision && c.emision.documento) c.emision.documentoUrl = urls.get(c.emision.documento.path) || '';
      if (c.transferencia) { if (c.transferencia.evidencia) c.transferencia.evidenciaUrl = urls.get(c.transferencia.evidencia.path) || ''; if (c.transferencia.factura) c.transferencia.facturaUrl = urls.get(c.transferencia.factura.path) || ''; }
      return c; }), rutas: has('rutas_ver') ? seguro(() => API.rutas(uid), []) : [],
    tarifas: has('tarifas_ver') ? seguro(() => API.tarifas(uid), []) : [],
    mem: has('tarifas_ver') ? seguro(() => API.mem(uid), []) : [],
    reportesAyuda: seguro(() => API.reportesAyuda(uid), []),
    notificaciones: DB.notificaciones.filter(n => A.rol === 'ADMIN' || n.destinatarios.includes(A.rol) || (n.usuarios || []).includes(A.id)),
    config: DB.config, catalogos: { pilotos: E.PILOTOS, flota: E.FLOTA, destinos: E.DESTINOS,
      listas: { tipoUnidad: E.CAT.tipoUnidad, opl: E.CAT.opl, tipoCarga: E.CAT.tipoCarga, tipoViaje: E.CAT.tipoViaje, origen: E.CAT.origen } }
  };
}
