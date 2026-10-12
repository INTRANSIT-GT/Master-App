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
  S('rutas', 'rutas', ['id'], [['id', 'id', 't'], ['codigo', 'codigo', 't'], ['nombre', 'nombre', 't'], ['cliente', 'cliente_id', 't'], ['proyecto', 'proyecto', 't'], ['origenId', 'origen_id', 't'], ['destinoId', 'destino_id', 't'], ['estado', 'estado', 't'],
    ['origenProp', 'origen_prop', 't'], ['destinoProp', 'destino_prop', 't'], ['fuente', 'fuente', 't'], ['solicitadaPorId', 'solicitada_por_id', 'tn'], ['solicitadaPor', 'solicitada_por', 'tn'], ['solicitadaEn', 'solicitada_en', 'ts'],
    ['validadaPor', 'validada_por', 't'], ['validadaEn', 'validada_en', 'ts'], ['rechazo', 'rechazo', 'j'], ['viajeRef', 'viaje_ref', 't']]),
  S('tarifas', 'tarifas', ['id'], [['id', 'id', 't'], ['cliente', 'cliente_id', 't'], ['proyecto', 'proyecto', 't'], ['rutaId', 'ruta_id', 't'], ['capacidad', 'capacidad', 't'], ['importe', 'importe', 'n'], ['vigenteDesde', 'vigente_desde', 't'],
    ['vigenteHasta', 'vigente_hasta', 't'], ['activa', 'activa', 'b'], ['creadoPorId', 'creado_por_id', 'tn'], ['creadoPor', 'creado_por', 'tn'], ['creadoEn', 'creado_en', 'ts'], ['modificadoPor', 'modificado_por', 't'], ['modificadoEn', 'modificado_en', 'ts']]),
  S('viajes', 'trips', ['id'], [['id', 'id', 't'], ['proyecto', 'cliente_id', 't'], ['proyectoCat', 'proyecto_cat', 't'], ['shipment', 'shipment', 't'], ['noViaje', 'no_viaje', 't'], ['opl', 'opl', 't'], ['tipoViaje', 'tipo_viaje', 't'],
    ['tipoCarga', 'tipo_carga', 't'], ['noCarga', 'no_carga', 't'], ['producto', 'producto', 't'], ['fechaPlan', 'fecha_plan', 't'], ['estatus', 'estatus', 't'], ['pilotoId', 'piloto_id', 't'], ['unidadId', 'unidad_id', 'tn'],
    ['origenId', 'origen_id', 't'], ['destinoId', 'destino_id', 't'], ['rutaId', 'ruta_id', 't'], ['rutaRef', 'ruta_ref', 't'], ['noDocRetorno', 'no_doc_retorno', 't'],
    ['tIngresoPlanta', 't_ingreso_planta', 't'], ['tEsperaRampa', 't_espera_rampa', 't'], ['tRampa', 't_rampa', 't'], ['tInicioCarga', 't_inicio_carga', 't'], ['tFinCarga', 't_fin_carga', 't'], ['tSalidaPlanta', 't_salida_planta', 't'],
    ['tSalida', 't_salida', 't'], ['tIngresoBodega', 't_ingreso_bodega', 't'], ['tInicioDescarga', 't_inicio_descarga', 't'], ['tFinDescarga', 't_fin_descarga', 't'], ['estado', 'estado', 't'],
    ['creadoPor', 'creado_por', 'tn'], ['creadoPorId', 'creado_por_id', 'tn'], ['creadoEn', 'creado_en', 'ts'], ['iniciadoPor', 'iniciado_por', 'tn'], ['iniciadoEn', 'iniciado_en', 'ts'], ['finalizadoPor', 'finalizado_por', 'tn'], ['finalizadoEn', 'finalizado_en', 'ts'],
    ['enviadoPor', 'enviado_por', 'tn'], ['enviadoEn', 'enviado_en', 'ts'], ['revisadoPor', 'revisado_por', 'tn'], ['revisadoEn', 'revisado_en', 'ts'], ['aprobadoPor', 'aprobado_por', 'tn'], ['aprobadoEn', 'aprobado_en', 'ts'],
    ['editadoPor', 'editado_por', 'tn'], ['editadoEn', 'editado_en', 'ts'], ['comentarioRevision', 'comentario_revision', 't'], ['liqIntentos', 'liq_intentos', 'i'], ['liqActualId', 'liq_actual_id', 't'], ['liqAprobadaEn', 'liq_aprobada_en', 'ts'],
    ['agrupacionId', 'agrupacion_id', 't'], ['numeroFactura', 'numero_factura', 't']],
    { partes: [
      { tabla: 'viajes_tarifa', fk: 'viaje_id', cols: [['tarifaCliente', 'tarifa_cliente', 'n'], ['tarifaId', 'tarifa_id', 't'], ['tarifaAplicadaPor', 'tarifa_aplicada_por', 't'], ['tarifaAplicadaEn', 'tarifa_aplicada_en', 'ts']] },
      { tabla: 'viajes_costos', fk: 'viaje_id', cols: [['costoProveedor', 'costo_proveedor', 'n']] },
      { tabla: 'viajes_viaticos', fk: 'viaje_id', cols: [['qViaticos', 'q_viaticos', 'n']] }] }),
  S('liquidaciones', 'liquidaciones', ['id'], [['id', 'id', 't'], ['viajeId', 'viaje_id', 't'], ['ciclo', 'ciclo', 'i'], ['envioPorId', 'envio_por_id', 'tn'], ['envioPor', 'envio_por', 'tn'], ['envioEn', 'envio_en', 'ts'], ['evidenciaId', 'evidencia_id', 't'],
    ['decision', 'decision', 't'], ['revisorId', 'revisor_id', 't'], ['revisor', 'revisor', 't'], ['revisionEn', 'revision_en', 'ts'], ['comentario', 'comentario', 't']]),
  S('evidencias', 'evidencias', ['id'], [['id', 'id', 't'], ['viajeId', 'viaje_id', 't'], ['liqId', 'liq_id', 't'], ['path', 'path', 't'], ['porId', 'por_id', 'tn'], ['por', 'por', 'tn'], ['en', 'en', 'ts']], { sinDataUrl: true }),
  S('agrupaciones', 'agrupaciones', ['id'], [['id', 'id', 't'], ['cliente', 'cliente_id', 't'], ['modalidad', 'modalidad', 't'], ['fase', 'fase', 't'], ['viajeIds', 'viaje_ids', 'a'], ['numeroFactura', 'numero_factura', 't'], ['fechaFactura', 'fecha_factura', 't'],
    ['importeEnviado', 'importe_enviado', 'n'], ['importesViaje', 'importes_viaje', 'jo'], ['viajesSinImporte', 'viajes_sin_importe', 'ja'], ['importeFacturado', 'importe_facturado', 'n'], ['envio', 'envio', 'j'], ['emision', 'emision', 'j'],
    ['cobros', 'cobros', 'ja'], ['estado', 'estado', 't'], ['creadoPorId', 'creado_por_id', 'tn'], ['creadoPor', 'creado_por', 'tn'], ['creadoEn', 'creado_en', 'ts'], ['anulada', 'anulada', 'j'], ['correcciones', 'correcciones', 'ja']]),
  S('pagos', 'pagos', ['id'], [['id', 'id', 't'], ['tipo', 'tipo', 't'], ['viajeId', 'viaje_id', 't'], ['beneficiario', 'beneficiario', 't'], ['monto', 'monto', 'n'], ['fecha', 'fecha', 't'], ['referencia', 'referencia', 't'], ['porId', 'por_id', 'tn'], ['por', 'por', 'tn'], ['en', 'en', 'ts'], ['anulado', 'anulado', 'j']]),
  S('notificaciones', 'notificaciones', ['id'], [['id', 'id', 't'], ['tipo', 'tipo', 't'], ['destinatarios', 'destinatarios', 'a'], ['usuarios', 'usuarios', 'a'], ['asunto', 'asunto', 't'], ['detalle', 'detalle', 'jo'], ['creadaPor', 'creada_por', 'tn'], ['creadaPorId', 'creada_por_id', 'tn'],
    ['creadaEn', 'creada_en', 'ts'], ['leidaPor', 'leida_por', 'a'], ['canal', 'canal', 't'], ['externo', 'externo', 'jo']]),
  S('auditoria', 'audit', ['id'], [['id', 'id', 't'], ['entidad', 'entidad', 't'], ['viajeId', 'viaje_id', 't'], ['accion', 'accion', 't'], ['campo', 'campo', 't'], ['anterior', 'anterior', 't'], ['nuevo', 'nuevo', 't'], ['porId', 'por_id', 't'], ['por', 'por', 't'], ['rol', 'rol', 't'],
    ['en', 'en', 'ts'], ['motivo', 'motivo', 't'], ['ref', 'ref', 't'], ['prev', 'prev', 't'], ['hash', 'hash', 't']], { soloAgregar: true })
];
const CATALOGOS = [
  { tabla: 'pilotos', lista: 'pilotos', cols: [['id', 'id', 't'], ['nombre', 'nombre', 't'], ['unidad', 'unidad', 'tn'], ['proyecto', 'cliente_id', 't']] },
  { tabla: 'flota', lista: 'flota', cols: [['unidad', 'unidad', 't'], ['placa', 'placa', 't'], ['tango', 'tango', 't'], ['capacidad', 'capacidad', 't'], ['tipo', 'tipo', 't']] },
  { tabla: 'destinos', lista: 'destinos', cols: [['id', 'id', 't'], ['nombre', 'nombre', 't'], ['proyecto', 'cliente_id', 't']] }
];
const ISO = c => `to_char(${c} at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`;
const sel = ([f, c, t]) => (t === 'ts' ? `${ISO(c)} as ${c}` : t === 'n' ? `${c}::float8 as ${c}` : c);

const enc = (t, v) => {
  switch (t) {
    case 't': return v == null ? '' : String(v);
    case 'tn': return v == null || v === '' ? null : String(v);
    case 'n': return v == null || v === '' ? null : Number(v);
    case 'i': return Number(v) || 0;
    case 'b': return !!v;
    case 'ts': return v == null || v === '' ? null : String(v);
    case 'u': return String(v);
    case 'a': return JSON.stringify(Array.isArray(v) ? v.map(String) : []);
    case 'j': return v == null ? null : JSON.stringify(v);
    case 'jo': return JSON.stringify(v == null ? {} : v);
    case 'ja': return JSON.stringify(v == null ? [] : v);
  }
  throw new Error('tipo ' + t);
};
const dec = (t, v) => {
  switch (t) {
    case 't': case 'tn': case 'ts': return v == null ? '' : v;
    case 'n': return v == null ? '' : Number(v);
    case 'i': return Number(v);
    case 'b': return !!v;
    case 'u': return String(v);
    case 'a': return Array.isArray(v) ? v : [];
    default: return v == null ? null : (typeof v === 'string' ? JSON.parse(v) : v);   // j, jo, ja
  }
};
const ph = (t, i) => ({ a: `(select coalesce(array_agg(x),'{}'::text[]) from jsonb_array_elements_text($${i}::jsonb) x)`, j: `$${i}::jsonb`, jo: `$${i}::jsonb`, ja: `$${i}::jsonb`,
  ts: `$${i}::timestamptz`, n: `$${i}::numeric`, i: `$${i}::int`, b: `$${i}::boolean`, u: `$${i}::uuid` }[t] || `$${i}`);

async function leerTabla(q, tabla, cols, extra, orden) {
  const { rows } = await q(`select ${cols.map(sel).join(', ')}${extra ? ', extra' : ''} from public.${tabla} order by ${orden}`);
  return rows;
}
const claveDe = (spec, r) => spec.key.map(k => r[k]).join('\u0001');

export async function loadState(q) {
  const db = { v: 6, usuarios: [], acceso: [], permisos: [], clientes: [], trips: [], liquidaciones: [], evidencias: [], agrupaciones: [], audit: [], pagos: [], rutas: [], tarifas: [], notificaciones: [], config: { torreEstatus: [] }, seq: {} };
  for (const spec of TABLAS) {
    const orden = spec.key.map(k => spec.cols.find(c => c[0] === k)[1]).join(', ');
    const rows = await leerTabla(q, spec.tabla, spec.cols, !spec.sinExtra, orden);
    let partes = {};
    for (const p of spec.partes || []) {
      const idCol = spec.cols.find(c => c[0] === spec.key[0])[1];
      const pr = await q(`select ${p.fk}, ${p.cols.map(sel).join(', ')} from public.${p.tabla}`);
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
  (await q('select clave, valor::bigint as valor from public.secuencias')).rows.forEach(r => { db.seq[r.clave] = Number(r.valor); });
  (await q('select clave, valor from public.config')).rows.forEach(r => { db.config[r.clave] = typeof r.valor === 'string' ? JSON.parse(r.valor) : r.valor; });
  const catalogos = {};
  for (const c of CATALOGOS) {
    const rows = await leerTabla(q, c.tabla, c.cols, false, c.cols[0][1]);
    catalogos[c.lista] = rows.map(r => Object.fromEntries(c.cols.map(([f, col, t]) => [f, dec(t, r[col])])));
  }
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
    principal.extra = JSON.stringify(extra);
  }
  return { principal, partes, texto: JSON.stringify([principal, partes]) };
}
async function upsert(q, tabla, cols, claves, fila, tipos) {
  const nombres = Object.keys(fila);
  const params = nombres.map(n => fila[n]);
  const marcas = nombres.map((n, i) => ph(n === 'extra' ? 'jo' : tipos[n], i + 1));
  const upd = nombres.filter(n => !claves.includes(n)).map(n => `${n}=excluded.${n}`);
  await q(`insert into public.${tabla} (${nombres.join(', ')}) values (${marcas.join(', ')}) on conflict (${claves.join(', ')}) ${upd.length ? 'do update set ' + upd.join(', ') : 'do nothing'}`, params);
}
export async function saveState(q, antes, db) {
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
      const w = claves.map((c, i) => `${c}=$${i + 1}${tp[c] === 'u' ? '::uuid' : ''}`).join(' and ');
      await q(`delete from public.${spec.tabla} where ${w}`, claves.map(c => p.principal[c]));
    }
  }
  if (JSON.stringify(db.seq) !== antes.__seq)
    for (const [k, v] of Object.entries(db.seq)) await q('insert into public.secuencias (clave, valor) values ($1,$2) on conflict (clave) do update set valor=excluded.valor', [k, v]);
  if (JSON.stringify(db.config) !== antes.__config)
    for (const [k, v] of Object.entries(db.config)) await q('insert into public.config (clave, valor) values ($1,$2::jsonb) on conflict (clave) do update set valor=excluded.valor', [k, JSON.stringify(v)]);
}
