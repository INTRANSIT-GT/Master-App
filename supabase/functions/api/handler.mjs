/* handler.mjs · lógica de la API, independiente del entorno (Deno en producción, Node en las pruebas).
   Todas las operaciones se ejecutan con el motor de reglas (core.mjs) sobre el estado leído de la base, con el actor
   tomado del token verificado, y se guardan en UNA transacción. Si algo falla, no se guarda nada. */
import { createEngine } from './core.mjs';
import { loadState, saveState, fotografia } from './store.mjs';
import { armarSnapshot } from './snapshot.mjs';
import { OPS_ESCRITURA, OPS_LECTURA } from './ops.mjs';
import { VENTANA_MESES, VIAJES_PAGINA, BUSCA_LIMITE, ESTADOS_EN_CURSO, COLA_AUDITORIA, SOLO_RESUMEN, SOLO_HISTORICO, COND_VENTANA, condAntes, idAntes, COND_BUSCA, textoDe, likeDe, desdeVentana, argsDe, antesDe, limitePagina, enVentana, aplicarVentana, auditoriaDeViajes, fusionarAuditoria, filtroVisible, filtrosGrafica, contarVisibles } from './read.mjs';

const MAX_ARGS = 300 * 1024;
const falla = (code, message, extra = {}) => ({ ok: false, code, message, ...extra });

/* ---- Escala: con ~3.000 viajes al mes, cargar y enviar TODO el histórico en cada lectura es inviable
   (decenas de MB de respuesta y la Edge Function al límite de CPU). Se separa en tres:
     · snapshot         → los viajes que se trabajan: en curso (sin importar la fecha), los últimos
                          VENTANA_MESES de los cerrados y los Facturados pendientes de pago al proveedor.
     · viajesAnteriores → páginas del histórico, a pedido.
     · resumenHistorico → totales de TODO el histórico, calculados por el mismo motor sobre los viajes visibles. */
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
      E.PILOTOS.push(...(db.pilotos || [])); E.FLOTA.push(...catalogos.flota);
      E.setDB(db);
      const A = db.usuarios.find(u => u.id === actorId);
      if (!A || !A.activo) return { resp: falla('NO_AUTENTICADO', 'Tu cuenta no tiene un perfil activo en la aplicación.'), commit: false };
      let resultado = null, rechazo = null;
      if (op === 'snapshot') {
        const ventana = aplicarVentana(E);
        const ids = E.getDB().trips.map(t => t.id);
        if (ids.length) E.getDB().audit = fusionarAuditoria(E.getDB().audit, await auditoriaDeViajes(q, ids));
        const enBase = await contarVisibles(q, A, db, E);
        const snap = await armarSnapshot(E, actorId, deps, Object.assign(ventana, { viajes: ids.length, enBase }));
        /* Conteo de TODO el histórico por unidad y día: el formulario calcula el No. de viaje del día
           sin depender de la ventana de viajes cargada en pantalla. Solo se entrega a quien puede crear viajes. */
        snap.conteosUnidadDia = {};
        if (E.hasPerm(A, 'viajes_crear')) {
          const cu = (await q(`select unidad_id, left(fecha_plan,10) as dia, count(*)::int as n from master.viajes where coalesce(unidad_id,'') <> '' and coalesce(fecha_plan,'') <> '' group by unidad_id, left(fecha_plan,10)`)).rows;
          snap.conteosUnidadDia = Object.fromEntries(cu.map(r => [String(r.unidad_id) + '|' + String(r.dia), Number(r.n)]));
        }
        return { resp: { ok: true, snapshot: snap }, commit: false };
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
      E.ENV.soloAlmacenamiento = true;    /* el servidor nunca guarda archivos dentro de la base: solo rutas del bucket privado */
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
