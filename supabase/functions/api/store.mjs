/* store.mjs · persistencia del motor en las tablas de Postgres.
   Es independiente del controlador de base de datos: recibe q(texto, parámetros) → Promise<{rows}>.
   - loadState: lee TODAS las tablas y arma el objeto DB que usa el motor (y los catálogos).
   - saveState: compara contra lo leído y escribe solo lo que cambió (upsert; la auditoría solo se agrega).
   Tipos de columna: t texto · tn texto nulable ('' ↔ NULL) · n numérico ('' ↔ NULL) · i entero · b booleano · ts timestamptz ('' ↔ NULL)
                     u uuid · j jsonb nulable · jo jsonb objeto ({} por omisión) · ja jsonb arreglo ([] por omisión) · a text[] */
const S = (tabla, lista, key, cols, extra = {}) => ({ tabla, lista, key, cols, ...extra });
const FIJOS = { tabla: null };

export const TABLAS = [
  S('clientes', 'clientes', ['id'], [['id', 'id', 't'], ['nombre', 'nombre', 't'], ['cliente', 'cliente', 't'], ['proyectos', 'proyectos', 'a'], ['torreEstatus', 'torre_estatus', 'b'], ['activo', 'activo', 'b'],
    ['creadoPor', 'creado_por', 'tn'], ['creadoEn', 'creado_en', 'ts'], ['modificadoPor', 'modificado_por', 'tn'], ['modificadoEn', 'modificado_en', 'ts']],
    { partes: [{ tabla: 'clientes_fiscal', fk: 'cliente_id', cols: [['nit', 'nit', 't'], ['direccionFiscal', 'direccion_fiscal', 't'], ['correoFacturacion', 'correo_facturacion', 't'], ['contacto', 'contacto', 't'], ['telefono', 'telefono', 't'], ['creditoDias', 'credito_dias', 't'], ['observaciones', 'observaciones', 't']], siempre: true }] }),
  S('perfiles', 'usuarios', ['id'], [['id', 'id', 'u'], ['usuario', 'usuario', 't'], ['email', 'email', 'tn'], ['nombre', 'nombre', 't'], ['rol', 'rol', 't'], ['activo', 'activo', 'b'], ['proyectos', 'proyectos', 'a']], { sinExtra: true }),
  S('acceso_cliente', 'acceso', ['userId', 'cliente'], [['userId', 'user_id', 'u'], ['cliente', 'cliente_id', 't']], { sinExtra: true, borrable: true }),
  S('permisos', 'permisos', ['rol', 'permiso'], [['rol', 'rol', 't'], ['permiso', 'permiso', 't'], ['habilitado', 'habilitado', 'b']], { sinExtra: true }),
  S('rutas', 'rutas', ['id'], [['id', 'id', 't'], ['codigo', 'codigo', 't'], ['nombre', 'nombre', 't'], ['cliente', 'cliente_id', 't'], ['proyecto', 'proyecto', 't'], ['origen', 'origen', 't'], ['destino', 'destino', 't'], ['estado', 'estado', 't'],
    ['origenProp', 'origen_prop', 't'], ['destinoProp', 'destino_prop', 't'], ['fuente', 'fuente', 't'], ['solicitadaPorId', 'solicitada_por_id', 'tn'], ['solicitadaPor', 'solicitada_por', 'tn'], ['solicitadaEn', 'solicitada_en', 'ts'],
     ['validadaPor', 'validada_por', 't'], ['validadaEn', 'validada_en', 'ts'], ['aprobacionComercial', 'aprobacion_comercial', 'j'], ['aprobacionTransporte', 'aprobacion_transporte', 'j'], ['rechazo', 'rechazo', 'j'], ['viajeRef', 'viaje_ref', 't'],
     ['capacidad', 'capacidad', 't'], ['km', 'km', 'n']]),
  S('tarifas', 'tarifas', ['id'], [['id', 'id', 't'], ['cliente', 'cliente_id', 't'], ['proyecto', 'proyecto', 't'], ['rutaId', 'ruta_id', 't'], ['capacidad', 'capacidad', 't'], ['importe', 'importe', 'n'], ['importeOpl', 'importe_opl', 'n'],
    ['combustiblePctOpl', 'combustible_pct_opl', 'n'], ['dieselPactadoOpl', 'diesel_pactado_opl', 'n'], ['vigenteDesde', 'vigente_desde', 't'],
    ['vigenteHasta', 'vigente_hasta', 't'], ['activa', 'activa', 'b'], ['creadoPorId', 'creado_por_id', 'tn'], ['creadoPor', 'creado_por', 'tn'], ['creadoEn', 'creado_en', 'ts'], ['modificadoPor', 'modificado_por', 't'], ['modificadoEn', 'modificado_en', 'ts']]),
  S('mem', 'mem', ['fecha'], [['fecha', 'fecha', 't'], ['precioDiesel', 'precio_diesel', 'n']], { sinExtra: true }),
  S('viajes', 'trips', ['id'], [['id', 'id', 't'], ['proyecto', 'cliente_id', 't'], ['proyectoCat', 'proyecto_cat', 't'], ['shipment', 'shipment', 't'], ['noViaje', 'no_viaje', 't'], ['opl', 'opl', 't'], ['tipoViaje', 'tipo_viaje', 't'],
     ['tipoCarga', 'tipo_carga', 't'], ['noCarga', 'no_carga', 't'], ['producto', 'producto', 't'], ['fechaPlan', 'fecha_plan', 't'], ['pilotoId', 'piloto_id', 't'], ['unidadId', 'unidad_id', 'tn'], ['placaArrastre', 'placa_arrastre', 't'],
    ['origen', 'origen', 't'], ['destino', 'destino', 't'], ['rutaId', 'ruta_id', 'tn'], ['rutaRef', 'ruta_ref', 't'], ['noDocRetorno', 'no_doc_retorno', 't'],
    ['tIngresoPlanta', 't_ingreso_planta', 't'], ['tEsperaRampa', 't_espera_rampa', 't'], ['tRampa', 't_rampa', 't'], ['tInicioCarga', 't_inicio_carga', 't'], ['tFinCarga', 't_fin_carga', 't'], ['tSalidaPlanta', 't_salida_planta', 't'],
    ['tSalida', 't_salida', 't'], ['tIngresoBodega', 't_ingreso_bodega', 't'], ['tInicioDescarga', 't_inicio_descarga', 't'], ['tFinDescarga', 't_fin_descarga', 't'], ['estado', 'estado', 't'],
    ['creadoPor', 'creado_por', 'tn'], ['creadoPorId', 'creado_por_id', 'tn'], ['creadoEn', 'creado_en', 'ts'], ['iniciadoPor', 'iniciado_por', 'tn'], ['iniciadoEn', 'iniciado_en', 'ts'], ['finalizadoPor', 'finalizado_por', 'tn'], ['finalizadoEn', 'finalizado_en', 'ts'],
    ['enviadoPor', 'enviado_por', 'tn'], ['enviadoEn', 'enviado_en', 'ts'], ['revisadoPor', 'revisado_por', 'tn'], ['revisadoEn', 'revisado_en', 'ts'], ['aprobadoPor', 'aprobado_por', 'tn'], ['aprobadoEn', 'aprobado_en', 'ts'],
    ['editadoPor', 'editado_por', 'tn'], ['editadoEn', 'editado_en', 'ts'], ['comentarioRevision', 'comentario_revision', 't'], ['liqIntentos', 'liq_intentos', 'i'], ['liqActualId', 'liq_actual_id', 't'], ['liqAprobadaEn', 'liq_aprobada_en', 'ts'],
    ['agrupacionId', 'agrupacion_id', 't'], ['numeroFactura', 'numero_factura', 't']],
    { partes: [
      { tabla: 'viajes_tarifa', fk: 'viaje_id', cols: [['tarifaCliente', 'tarifa_cliente', 'n'], ['tarifaId', 'tarifa_id', 't'], ['tarifaOpl', 'tarifa_opl', 'n'], ['tarifaOplBase', 'tarifa_opl_base', 'n'], ['ajusteOpl', 'ajuste_opl', 'n'], ['precioMemOpl', 'precio_mem_opl', 't'], ['tarifaAplicadaPor', 'tarifa_aplicada_por', 't'], ['tarifaAplicadaEn', 'tarifa_aplicada_en', 'ts']] },
      { tabla: 'viajes_costos', fk: 'viaje_id', cols: [['costoProveedor', 'costo_proveedor', 'n']] },
      { tabla: 'viajes_viaticos', fk: 'viaje_id', cols: [['qViaticos', 'q_viaticos', 'n']] }] }),
  S('liquidaciones', 'liquidaciones', ['id'], [['id', 'id', 't'], ['viajeId', 'viaje_id', 't'], ['ciclo', 'ciclo', 'i'], ['envioPorId', 'envio_por_id', 'tn'], ['envioPor', 'envio_por', 'tn'], ['envioEn', 'envio_en', 'ts'], ['evidenciaId', 'evidencia_id', 't'],
    ['decision', 'decision', 't'], ['revisorId', 'revisor_id', 't'], ['revisor', 'revisor', 't'], ['revisionEn', 'revision_en', 'ts'], ['comentario', 'comentario', 't']]),
  S('evidencias', 'evidencias', ['id'], [['id', 'id', 't'], ['viajeId', 'viaje_id', 't'], ['liqId', 'liq_id', 't'], ['path', 'path', 't'], ['porId', 'por_id', 'tn'], ['por', 'por', 'tn'], ['en', 'en', 'ts']], { sinDataUrl: true }),
  S('agrupaciones', 'agrupaciones', ['id'], [['id', 'id', 't'], ['cliente', 'cliente_id', 't'], ['modalidad', 'modalidad', 't'], ['fase', 'fase', 't'], ['viajeIds', 'viaje_ids', 'a'], ['serieFactura', 'serie_factura', 't'], ['numeroFactura', 'numero_factura', 't'], ['fechaFactura', 'fecha_factura', 't'],
    ['importeEnviado', 'importe_enviado', 'n'], ['importesViaje', 'importes_viaje', 'jo'], ['viajesSinImporte', 'viajes_sin_importe', 'ja'], ['importeFacturado', 'importe_facturado', 'n'], ['envio', 'envio', 'j'], ['emision', 'emision', 'j'],
    ['cobros', 'cobros', 'ja'], ['estado', 'estado', 't'], ['creadoPorId', 'creado_por_id', 'tn'], ['creadoPor', 'creado_por', 'tn'], ['creadoEn', 'creado_en', 'ts'], ['anulada', 'anulada', 'j'], ['correcciones', 'correcciones', 'ja']]),
  S('pagos', 'pagos', ['id'], [['id', 'id', 't'], ['tipo', 'tipo', 't'], ['viajeId', 'viaje_id', 't'], ['beneficiario', 'beneficiario', 't'], ['monto', 'monto', 'n'], ['fecha', 'fecha', 't'], ['referencia', 'referencia', 't'], ['porId', 'por_id', 'tn'], ['por', 'por', 'tn'], ['en', 'en', 'ts'], ['anulado', 'anulado', 'j']]),
  S('ordenes_pago', 'ordenesPago', ['id'], [['id', 'id', 't'], ['proveedor', 'proveedor', 't'], ['viajeIds', 'viaje_ids', 'a'], ['fase', 'fase', 't'], ['importe', 'importe', 'n'], ['importesViaje', 'importes_viaje', 'jo'],
    ['fechaEmision', 'fecha_emision', 't'], ['emision', 'emision', 'j'], ['transferencia', 'transferencia', 'j'], ['estado', 'estado', 't'], ['creadoPorId', 'creado_por_id', 'tn'], ['creadoPor', 'creado_por', 'tn'], ['creadoEn', 'creado_en', 'ts'], ['anulada', 'anulada', 'j'], ['correcciones', 'correcciones', 'ja']]),
  /* Órdenes de compra (migración 034): tabla opcional, así el servidor sigue funcionando aunque la migración aún no se haya aplicado. */
  S('ordenes_compra', 'ordenesCompra', ['id'], [['id', 'id', 't'], ['cliente', 'cliente_id', 't'], ['clienteNombre', 'cliente_nombre', 't'], ['proyecto', 'proyecto', 't'], ['estado', 'estado', 't'], ['moneda', 'moneda', 't'],
    ['columnas', 'columnas', 'a'], ['viajeIds', 'viaje_ids', 'a'], ['lineas', 'lineas', 'ja'], ['total', 'total', 'n'], ['combustible', 'combustible', 'jo'], ['documentos', 'documentos', 'ja'], ['envio', 'envio', 'j'], ['respuesta', 'respuesta', 'j'], ['anulada', 'anulada', 'j'],
    ['agrupacionId', 'agrupacion_id', 'tn'], ['historial', 'historial', 'ja'], ['preparadoPorId', 'preparado_por_id', 'tn'], ['preparadoPor', 'preparado_por', 'tn'], ['preparadoEn', 'preparado_en', 'ts']], { opcional: true, migracion: '034_ordenes_compra.sql' }),
  S('notificaciones', 'notificaciones', ['id'], [['id', 'id', 't'], ['tipo', 'tipo', 't'], ['destinatarios', 'destinatarios', 'a'], ['usuarios', 'usuarios', 'a'], ['asunto', 'asunto', 't'], ['detalle', 'detalle', 'jo'], ['creadaPor', 'creada_por', 'tn'], ['creadaPorId', 'creada_por_id', 'tn'],
    ['creadaEn', 'creada_en', 'ts'], ['leidaPor', 'leida_por', 'a'], ['canal', 'canal', 't'], ['externo', 'externo', 'jo']]),
  /* Ayuda: reportes de fallas. OPCIONAL: si la migración 027 aún no se aplicó, la tabla no existe y el resto de la aplicación sigue funcionando (la lista queda vacía). */
  S('pilotos', 'pilotos', ['id'], [['id', 'id', 't'], ['nombre', 'nombre', 't'], ['unidad', 'unidad', 'tn'], ['proyecto', 'cliente_id', 't'],
    ['licencia', 'licencia', 't'], ['licenciaTipo', 'licencia_tipo', 't'], ['licenciaVence', 'licencia_vence', 'd'],
    ['saludVence', 'salud_vence', 'd'], ['penalesVence', 'penales_vence', 'd'], ['policiacosVence', 'policiacos_vence', 'd'],
    ['activo', 'activo', 'b'], ['notas', 'notas', 't'], ['actualizadoEn', 'actualizado_en', 'ts']], { sinExtra: true }),
  S('reportes_ayuda', 'reportesAyuda', ['id'], [['id', 'id', 't'], ['usuarioId', 'usuario_id', 't'], ['usuario', 'usuario', 't'], ['rol', 'rol', 't'], ['modulo', 'modulo', 't'], ['tipo', 'tipo', 't'], ['descripcion', 'descripcion', 't'],
    ['intento', 'intento', 't'], ['estado', 'estado', 't'], ['creadoEn', 'creado_en', 'ts'], ['actualizadoEn', 'actualizado_en', 'ts'], ['actualizadoPor', 'actualizado_por', 'tn'], ['historial', 'historial', 'ja']], { opcional: true }),
  S('auditoria', 'audit', ['id'], [['id', 'id', 't'], ['entidad', 'entidad', 't'], ['viajeId', 'viaje_id', 't'], ['accion', 'accion', 't'], ['campo', 'campo', 't'], ['anterior', 'anterior', 't'], ['nuevo', 'nuevo', 't'], ['porId', 'por_id', 't'], ['por', 'por', 't'], ['rol', 'rol', 't'],
    ['en', 'en', 'ts'], ['motivo', 'motivo', 't'], ['ref', 'ref', 't'], ['prev', 'prev', 't'], ['hash', 'hash', 't']], { soloAgregar: true })
];
const CATALOGOS = [
  { tabla: 'flota', lista: 'flota', cols: [['unidad', 'unidad', 't'], ['placa', 'placa', 't'], ['tango', 'tango', 't'], ['capacidad', 'capacidad', 't'], ['tipo', 'tipo', 't']] },
];
const ISO = c => `to_char(${c} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const sel = ([f, c, t]) => (t === 'ts' ? `${ISO(c)} as ${c}` : t === 'n' ? `${c}::float8 as ${c}` : t === 'd' ? `to_char(${c},'YYYY-MM-DD') as ${c}` : c);

const enc = (t, v) => {
  switch (t) {
    case 't': return v == null ? '' : String(v);
    case 'tn': return v == null || v === '' ? null : String(v);
    case 'n': return v == null || v === '' ? null : Number(v);
    case 'i': return Number(v) || 0;
    case 'b': return !!v;
    case 'ts': return v == null || v === '' ? null : String(v);
    case 'd': return v == null || v === '' ? null : String(v);
    case 'u': return String(v);
    case 'a': return Array.isArray(v) ? v.map(String) : [];   // el driver lo envía como arreglo de Postgres (text[])
    case 'j': return v == null ? null : v;                    // objeto/arreglo/escalar real: el driver lo serializa a jsonb
    case 'jo': return v == null ? {} : v;
    case 'ja': return v == null ? [] : v;
  }
  throw new Error('tipo ' + t);
};
const dec = (t, v) => {
  switch (t) {
    case 't': case 'tn': case 'ts': case 'd': return v == null ? '' : v;
    case 'n': return v == null ? '' : Number(v);
    case 'i': return Number(v);
    case 'b': return !!v;
    case 'u': return String(v);
    case 'a': return Array.isArray(v) ? v : [];
    default: return v == null ? null : (typeof v === 'string' ? JSON.parse(v) : v);   // j, jo, ja
  }
};
const ph = (t, i) => ({ a: `$${i}::text[]`, j: `$${i}::jsonb`, jo: `$${i}::jsonb`, ja: `$${i}::jsonb`,
  ts: `$${i}::timestamptz`, d: `$${i}::date`, n: `$${i}::numeric`, i: `$${i}::int`, b: `$${i}::boolean`, u: `$${i}::uuid` }[t] || `$${i}`);

async function leerTabla(q, tabla, cols, extra, orden) {
  const { rows } = await q(`select ${cols.map(sel).join(', ')}${extra ? ', extra' : ''} from master.${tabla} order by ${orden}`);
  return rows;
}
const claveDe = (spec, r) => spec.key.map(k => r[k]).join('\u0001');

async function existeTabla(q, tabla) {
  const r = await q('select to_regclass($1) is not null as ok', ['master.' + tabla]);
  return !!(r.rows[0] && r.rows[0].ok);
}

export async function loadState(q, opts = {}) {
  const db = { v: 6, usuarios: [], acceso: [], permisos: [], clientes: [], trips: [], liquidaciones: [], evidencias: [], agrupaciones: [], audit: [], pagos: [], ordenesPago: [], ordenesCompra: [], rutas: [], tarifas: [], mem: [], notificaciones: [], reportesAyuda: [], config: {}, seq: {} };
  for (const spec of TABLAS) {
    /* opts.solo: carga solo esas tablas (para cálculos de conjunto que no necesitan todo el estado, como
       los totales del histórico financiero). */
    if (opts.solo && !opts.solo.includes(spec.tabla)) continue;
    if (spec.opcional && !(await existeTabla(q, spec.tabla))) { db[spec.lista] = []; continue; }
    const orden = spec.key.map(k => spec.cols.find(c => c[0] === k)[1]).join(', ');
    let rows;
    /* La auditoría es de solo agregar y crece sin límite. Para operaciones que escriben solo se necesita el último
       registro (para encadenar el hash de los eventos nuevos): se lee solo la cola. En lectura completa (snapshot,
       verificación de la cadena) se lee entera. */
    if (spec.tabla === 'auditoria' && opts.auditoriaTail) {
      const cols = spec.cols.map(sel).join(', ') + (spec.sinExtra ? '' : ', extra');
      rows = (await q(`select ${cols} from master.auditoria order by id desc limit ${Number(opts.auditoriaTail)}`)).rows;
    } else if (spec.tabla === 'viajes' && opts.viajesFiltro) {
      /* Carga solo los viajes que cumplen la condición (ventana de trabajo o página de histórico), para no leer
         toda la tabla en cada lectura. Las condiciones vienen del handler y los valores van parametrizados. */
      const f = opts.viajesFiltro;
      rows = (await q(`select ${spec.cols.map(sel).join(', ')}${spec.sinExtra ? '' : ', extra'} from master.viajes v where ${f.sql} order by ${f.orden || orden}${f.limite ? ` limit ${Number(f.limite)}` : ''}`, f.params || [])).rows;
    } else rows = await leerTabla(q, spec.tabla, spec.cols, !spec.sinExtra, orden);
    const partes = {};
    for (const p of spec.partes || []) {
      const pr = await q(`select ${p.fk}, ${p.cols.map(sel).join(', ')} from master.${p.tabla}`);
      partes[p.tabla] = new Map(pr.rows.map(r => [r[p.fk], r]));
    }
    db[spec.lista] = rows.map(r => {
      const o = {};
      for (const [f, c, t] of spec.cols) o[f] = dec(t, r[c]);
      if (r.extra) Object.assign(o, typeof r.extra === 'string' ? JSON.parse(r.extra) : r.extra);
      for (const p of spec.partes || []) {
        const pr = partes[p.tabla].get(o[spec.key[0]]);
        for (const [f, c, t] of p.cols) o[f] = dec(t, pr ? pr[c] : null);
      }
      if (spec.lista === 'usuarios') o.clave = '';
      if (spec.lista === 'evidencias') o.dataUrl = '';
      return o;
    });
  }
  (await q('select clave, valor::bigint as valor from master.secuencias')).rows.forEach(r => { db.seq[r.clave] = Number(r.valor); });
  (await q('select clave, valor from master.config')).rows.forEach(r => { db.config[r.clave] = typeof r.valor === 'string' ? JSON.parse(r.valor) : r.valor; });
  const catalogos = {};
  for (const c of CATALOGOS) {
    const rows = await leerTabla(q, c.tabla, c.cols, false, c.cols[0][1]);
    catalogos[c.lista] = rows.map(r => Object.fromEntries(c.cols.map(([f, col, t]) => [f, dec(t, r[col])])));
  }
  /* Listas del sistema (tipo de unidad, OPL, tipo de carga, tipo de viaje, orígenes). */
  catalogos.listas = {};
  (await q('select clave, valores from master.catalogos')).rows.forEach(r => {
    catalogos.listas[r.clave] = typeof r.valores === 'string' ? JSON.parse(r.valores) : r.valores;
  });
  db.catalogosListas = catalogos.listas;            /* el motor las aplica al catálogo en syncRefs */
  return { db, catalogos };
}

/* Fotografía de filas (en el formato de la base) para detectar qué cambió. */
export function fotografia(db) {
  const foto = {};
  for (const spec of TABLAS) {
    const m = new Map();
    for (const rec of db[spec.lista] || []) m.set(claveDe(spec, rec), filas(spec, rec));
    foto[spec.tabla] = m;
  }
  foto.__seq = JSON.stringify(db.seq); foto.__config = JSON.stringify(db.config);
  foto.__listas = JSON.stringify(db.catalogosListas || {});
  return foto;
}
function filas(spec, rec) {
  const principal = {};
  for (const [f, c, t] of spec.cols) principal[c] = enc(t, rec[f]);
  const conocidos = new Set(spec.cols.map(c => c[0]));
  const partes = {};
  for (const p of spec.partes || []) { p.cols.forEach(c => conocidos.add(c[0])); partes[p.tabla] = Object.fromEntries(p.cols.map(([f, c, t]) => [c, enc(t, rec[f])])); }
  if (!spec.sinExtra) {
    const extra = {};
    for (const k of Object.keys(rec)) if (!conocidos.has(k) && !(spec.sinDataUrl && k === 'dataUrl')) extra[k] = rec[k];
    principal.extra = extra;
  }
  return { principal, partes, texto: JSON.stringify([principal, partes]) };
}
async function upsert(q, tabla, cols, claves, fila, tipos) {
  const nombres = Object.keys(fila);
  const params = nombres.map(n => fila[n]);
  const marcas = nombres.map((n, i) => ph(n === 'extra' ? 'jo' : tipos[n], i + 1));
  const upd = nombres.filter(n => !claves.includes(n)).map(n => `${n}=excluded.${n}`);
  await q(`insert into master.${tabla} (${nombres.join(', ')}) values (${marcas.join(', ')}) on conflict (${claves.join(', ')}) ${upd.length ? 'do update set ' + upd.join(', ') : 'do nothing'}`, params);
}
export async function saveState(q, antes, db, rechazo) {
  const tipos = {};
  for (const spec of TABLAS) {
    const tp = Object.fromEntries(spec.cols.map(([f, c, t]) => [c, t]));
    const claves = spec.key.map(k => spec.cols.find(c => c[0] === k)[1]);
    const nuevos = new Map(); for (const rec of db[spec.lista]) nuevos.set(claveDe(spec, rec), filas(spec, rec));
    const previos = antes[spec.tabla];
    for (const [k, f] of nuevos) {
      const p = previos.get(k);
      if (p && p.texto === f.texto) continue;
      if (p && spec.soloAgregar) throw new Error('La auditoría es de solo agregar: intento de modificar ' + k);
      /* Si el motor rechazó la operación, no debe haber tocado datos de negocio: solo la auditoría (el registro del
         intento) y las secuencias pueden cambiar. El fallo se detecta aquí, reusando el mismo recorrido del diff. */
      if (rechazo && spec.tabla !== 'auditoria') throw new Error('Operación rechazada con cambios parciales: se descarta para no guardar datos a medias.');
      if (spec.opcional && !(await existeTabla(q, spec.tabla))) throw new Error('Falta crear la tabla master.' + spec.tabla + ': aplica la migración SQL correspondiente (' + (spec.migracion || '027_reportes_ayuda.sql') + ') antes de usar esta función.');
      await upsert(q, spec.tabla, spec.cols, claves, f.principal, tp);
      for (const part of spec.partes || []) {
        const fp = f.partes[part.tabla], pp = p && p.partes[part.tabla];
        const vacia = Object.values(fp).every(v => v == null || v === '');
        if (vacia && !pp && !part.siempre) continue;
        const tpp = Object.fromEntries(part.cols.map(([ff, c, t]) => [c, t]));
        await upsert(q, part.tabla, part.cols, [part.fk], { [part.fk]: f.principal[claves[0]], ...fp }, tpp);
      }
    }
    if (spec.borrable) for (const [k, p] of previos) if (!nuevos.has(k)) {
      if (rechazo) throw new Error('Operación rechazada con cambios parciales: se descarta para no guardar datos a medias.');
      const w = claves.map((c, i) => `${c}=$${i + 1}${tp[c] === 'u' ? '::uuid' : ''}`).join(' and ');
      await q(`delete from master.${spec.tabla} where ${w}`, claves.map(c => p.principal[c]));
    }
  }
  if (JSON.stringify(db.seq) !== antes.__seq)
    for (const [k, v] of Object.entries(db.seq)) await q('insert into master.secuencias (clave, valor) values ($1,$2) on conflict (clave) do update set valor=excluded.valor', [k, v]);
  if (JSON.stringify(db.config) !== antes.__config)
    for (const [k, v] of Object.entries(db.config)) await q('insert into master.config (clave, valor) values ($1,$2::jsonb) on conflict (clave) do update set valor=excluded.valor', [k, JSON.stringify(v)]);
  if (JSON.stringify(db.catalogosListas || {}) !== antes.__listas)
    for (const [k, v] of Object.entries(db.catalogosListas || {}))
      await q(`insert into master.catalogos (clave, etiqueta, valores, actualizado_en) values ($1,$1,$2::jsonb, now())
               on conflict (clave) do update set valores = excluded.valores, actualizado_en = now()`, [k, JSON.stringify(v)]);
}
