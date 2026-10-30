// =====================================================================
// Edge Function "sync-flota" · Master App de Transportes
// ---------------------------------------------------------------------
// Trae de la API de Fleetio los vehículos, sus mantenimientos
// (service_entries) y sus gastos (expense_entries), y los deja en el
// esquema `master` (mismo proyecto Supabase que AP_VIAJES).
//
// Despliegue:  supabase functions deploy sync-flota
//
// SECRETOS (Supabase → Edge Functions → Secrets; NUNCA van al navegador):
//   FLEETIO_API_KEY        = API key de Fleetio (sin la palabra "Token")
//   FLEETIO_ACCOUNT_TOKEN  = Account-Token de Fleetio
//   SUPABASE_DB_URL        = la pone Supabase sola en el entorno de la función
//
// Solo un usuario con rol ADMIN puede ejecutarla.
//
// NOTA: en el listado de Fleetio la unidad viene en `name` (p. ej. C833CFJ);
// no hay `license_plate`. Se usa `name` como unidad y se guardan los detalles
// del vehículo en `master.flota.extra`.
// =====================================================================
import postgres from "npm:postgres@3.4.4";

const FLEETIO_BASE = "https://secure.fleetio.com/api/v1";
const DB_URL = Deno.env.get("SUPABASE_DB_URL")!;
const ORIGEN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const sql = postgres(DB_URL, { max: 3, prepare: false, idle_timeout: 20 });

const cors = { "Access-Control-Allow-Origin": ORIGEN, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

const txt = (v: unknown) => (v === null || v === undefined ? "" : String(v));
const ahora = () => new Date().toISOString();
// Monto → número. Prueba varias llaves; si termina en "_cents", divide entre 100.
function monto(o: any, keys: string[]): number | null {
  for (const k of keys) {
    if (!o) continue;
    const v = o[k];
    if (v === undefined || v === null || v === "") continue;
    const n = Number(v);
    if (isNaN(n)) continue;
    return k.endsWith("_cents") ? n / 100 : n;
  }
  return null;
}
const norm = (s: unknown) => txt(s).toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, "").trim();

async function fleetioPage(path: string, params: Record<string, string>): Promise<any> {
  const key = Deno.env.get("FLEETIO_API_KEY")!;
  const acct = Deno.env.get("FLEETIO_ACCOUNT_TOKEN")!;
  const url = new URL(FLEETIO_BASE + path);
  for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { headers: { Authorization: `Token ${key}`, "Account-Token": acct, Accept: "application/json" } });
  const t = await res.text();
  if (!res.ok) throw new Error(`Fleetio ${path}: ${res.status} ${t.slice(0, 300)}`);
  return t ? JSON.parse(t) : null;
}
async function fleetioAll(path: string): Promise<any[]> {
  const out: any[] = [];
  let cursor = "";
  for (let i = 0; i < 500; i++) {
    const data = await fleetioPage(path, { per_page: "100", start_cursor: cursor });
    const recs: any[] = (data && data.records) || (Array.isArray(data) ? data : []);
    out.push(...recs);
    cursor = (data && data.next_cursor) || "";
    if (!cursor || recs.length === 0) break;
  }
  return out;
}
async function mapLimit<T>(items: T[], limit: number, fn: (x: T) => Promise<any>): Promise<any[]> {
  const out: any[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) { const idx = i++; try { out[idx] = await fn(items[idx]); } catch { out[idx] = null; } }
  }));
  return out;
}
const trozos = <T,>(a: T[], n: number): T[][] => { const o: T[][] = []; for (let i = 0; i < a.length; i += n) o.push(a.slice(i, i + n)); return o; };

function usuarioDelToken(req: Request): string | null {
  const t = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  try { const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/"))); return p.role === "authenticated" && p.sub ? String(p.sub) : null; }
  catch { return null; }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, message: "Usa POST." }, 405);
  const uid = usuarioDelToken(req);
  if (!uid || !/^[0-9a-f-]{36}$/i.test(uid)) return json({ ok: false, message: "Inicia sesión para continuar." }, 401);

  try {
    // 1) Solo un ADMIN activo puede sincronizar.
    const perfil = (await sql`select rol from master.perfiles where id=${uid}::uuid and activo limit 1`)[0];
    if (!perfil) return json({ ok: false, message: "Tu cuenta no tiene un perfil activo." }, 403);
    if (perfil.rol !== "ADMIN") return json({ ok: false, message: "Solo la administración puede sincronizar la flota." }, 403);

    // 2) Traer de Fleetio.
    const [vehicles, equipment, services, expenses] = await Promise.all([fleetioAll("/vehicles"), fleetioAll("/equipment"), fleetioAll("/service_entries"), fleetioAll("/expense_entries")]);
    const detalles = await mapLimit(vehicles, 4, (v: any) => fleetioPage(`/vehicles/${v.id}`, {}));
    const detById = new Map<number, any>();
    detalles.forEach((d: any) => { if (d && d.id != null) detById.set(Number(d.id), d); });

    const unidadDe = (o: any) => txt(o.name || o.license_plate);
    function mapStatus(s: unknown): string {
      const t = norm(s); if (!t) return "";
      if (/(shop|taller|manten|repar|servicio|service)/.test(t)) return "Mantenimiento";
      if (/(inactiv|inactive|outofservice|fueradeservicio|sold|vendid|disposed|baja|desincorporad)/.test(t)) return "Inactiva";
      return "Activa";
    }

    const ahora = new Date().toISOString();
    const flotaRows = vehicles.map((v: any) => {
      const d = detById.get(Number(v.id)) || {};
      return {
        unidad: unidadDe(v),
        placa: txt(d.license_plate || v.license_plate || v.name),
        extra: JSON.stringify({
          fleetioId: txt(v.id), nombre: txt(v.name || d.name), vin: txt(d.vin || v.vin),
          marca: txt(d.make || v.make), modelo: txt(d.model || v.model), anio: txt(d.year || v.year),
          tipoUnidad: txt(v.vehicle_type_name || d.vehicle_type_name), estado: txt(v.vehicle_status_name || d.vehicle_status_name),
          medidor: txt(v.primary_meter_value != null ? v.primary_meter_value : d.current_meter_value),
          medidorUnidad: txt(v.primary_meter_unit || d.meter_unit), medidorFecha: txt(v.primary_meter_date || d.current_meter_date),
          propiedad: txt(v.ownership || d.ownership), grupo: txt(v.group_name || d.group_name),
          color: txt(v.color || d.color), combustible: txt(v.fuel_type_name || d.fuel_type_name),
          statusApp: mapStatus(v.vehicle_status_name || d.vehicle_status_name), actualizado: ahora,
        }),
      };
    }).filter((r: any) => r.unidad !== "");

    // Tools de Fleetio = /equipment. Se excluye Cabezal para no duplicar vehículos.
    const tiposEquipo = new Set(["furgon", "remolque", "semiremolque", "dollytrailer", "plataforma"]);
    const nombreVehiculo = new Set(flotaRows.map((r: any) => r.unidad));
    const capFleetio = (e: any): string => {
      const c = txt(e.custom_fields && e.custom_fields.cap_medida).trim();
      const m1 = c.match(/(\d+(?:[.,]\d+)?)/);
      if (m1) return m1[1].replace(",", ".");
      const m2 = txt(e.model).match(/(\d+(?:[.,]\d+)?)\s*(?:ton|toneladas?)/i);
      return m2 ? m2[1].replace(",", ".") : "";
    };
    const equipoRows = equipment.map((e: any) => {
      const tipo = txt(e.type_name).trim();
      const key = norm(tipo);
      const nombre = txt(e.name).trim();
      if (!nombre || nombreVehiculo.has(nombre) || !tiposEquipo.has(key)) return null;
      const linked = e.linked_vehicle || {};
      const custom = e.custom_fields || {};
      return {
        unidad: nombre,
        placa: nombre,
        tipo,
        capacidad: capFleetio(e),
        extra: JSON.stringify({
          fleetioEquipmentId: txt(e.id), nombre, tipoEquipo: tipo, estado: txt(e.status_name),
          linkedVehicle: txt(linked.license_plate || linked.name), linkedVehicleId: txt(linked.id),
          propietario: txt(custom.propietario), marca: txt(e.brand), modelo: txt(e.model),
          capMedida: txt(custom.cap_medida), esEquipo: true, actualizado: ahora,
        }),
      };
    }).filter((r: any) => r && r.unidad !== "");

    const mantRows = services.map((s: any) => ({
      id_mantenimiento: txt(s.id),
      unidad: txt((s.vehicle && (s.vehicle.license_plate || s.vehicle.name)) || ""),
      fleetio_vehicle_id: txt(s.vehicle_id),
      fecha: txt(s.completed_at || s.started_at),
      referencia: txt(s.reference),
      estado: txt(s.status),
      proveedor: txt((s.vendor && s.vendor.name) || ""),
      medidor: txt((s.primary_meter_entry && s.primary_meter_entry.value) || ""),
      subtotal: monto(s, ["subtotal_cents", "subtotal"]),
      mano_obra: monto(s, ["labor_subtotal_cents", "labor_subtotal"]),
      repuestos: monto(s, ["parts_subtotal_cents", "parts_subtotal"]),
      total: monto(s, ["total_amount_cents", "total_cents", "total_amount", "subtotal_cents", "subtotal"]),
      notas: txt(s.general_notes),
      actualizado: ahora,
    })).filter((r: any) => r.id_mantenimiento !== "");
    // Unidades desconocidas en el listado: se completan con la matrícula del vehículo cuando se pueda.
    mantRows.forEach((r: any) => { if (!r.unidad) { const v = vehicles.find((x: any) => txt(x.id) === r.fleetio_vehicle_id); if (v) r.unidad = unidadDe(v); } });

    const gastoRows = expenses.map((e: any) => ({
      id_gasto: txt(e.id),
      unidad: txt((e.vehicle && (e.vehicle.license_plate || e.vehicle.name)) || ""),
      fleetio_vehicle_id: txt(e.vehicle_id),
      fecha: txt(e.occurred_at),
      tipo: txt(e.expense_entry_type_name),
      monto: monto(e, ["total_amount_cents", "total_cents", "total_amount"]),
      proveedor: txt((e.vendor && e.vendor.name) || ""),
      notas: txt(e.notes),
      actualizado: ahora,
    })).filter((r: any) => r.id_gasto !== "");
    gastoRows.forEach((r: any) => { if (!r.unidad) { const v = vehicles.find((x: any) => txt(x.id) === r.fleetio_vehicle_id); if (v) r.unidad = unidadDe(v); } });

    // 3) Guardar (upsert por clave; no se tocan las columnas manuales de flota).
    const COLS_F = ["unidad", "placa", "extra"];
    const updF = "placa=excluded.placa, extra=excluded.extra";
    for (const c of trozos(flotaRows, 500)) await sql`insert into master.flota ${sql(c, ...COLS_F)} on conflict (unidad) do update set ${sql.unsafe(updF)}`;

    // 3.b) Tango: solo lo llevan las unidades del proyecto CMI (el Tango es un dato manual,
    //      no viene de Fleetio). A las unidades de los demás proyectos se les deja vacío.
    const cmi = (await sql`select unidad from master.pilotos where cliente_id = 'CMI' and coalesce(unidad,'') <> ''`)
      .map((r: any) => String(r.unidad));
    await sql`update master.flota set tango = '' where coalesce(tango,'') <> '' and unidad not in ${sql(cmi.length ? cmi : [""])}`;

    const COLS_E = ["unidad", "placa", "tipo", "capacidad", "extra"];
    const updE = "placa=excluded.placa, tipo=excluded.tipo, capacidad=excluded.capacidad, extra=master.flota.extra || excluded.extra";
    for (const c of trozos(equipoRows, 500)) await sql`insert into master.flota ${sql(c, ...COLS_E)} on conflict (unidad) do update set ${sql.unsafe(updE)}`;

    const COLS_M = ["id_mantenimiento", "unidad", "fleetio_vehicle_id", "fecha", "referencia", "estado", "proveedor", "medidor", "subtotal", "mano_obra", "repuestos", "total", "notas", "actualizado"];
    const updM = COLS_M.filter((c) => c !== "id_mantenimiento").map((c) => `${c}=excluded.${c}`).join(", ");
    for (const c of trozos(mantRows, 500)) await sql`insert into master.mantenimientos ${sql(c, ...COLS_M)} on conflict (id_mantenimiento) do update set ${sql.unsafe(updM)}`;

    const COLS_G = ["id_gasto", "unidad", "fleetio_vehicle_id", "fecha", "tipo", "monto", "proveedor", "notas", "actualizado"];
    const updG = COLS_G.filter((c) => c !== "id_gasto").map((c) => `${c}=excluded.${c}`).join(", ");
    for (const c of trozos(gastoRows, 500)) await sql`insert into master.gastos ${sql(c, ...COLS_G)} on conflict (id_gasto) do update set ${sql.unsafe(updG)}`;

    return json({ ok: true, result: { unidades: flotaRows.length, equipos: equipoRows.length, mantenimientos: mantRows.length, gastos: gastoRows.length, ejecutado: ahora } });
  } catch (e) {
    return json({ ok: false, message: String((e as Error)?.message || e) }, 500);
  }
});
