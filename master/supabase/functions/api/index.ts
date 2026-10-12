// Edge Function "api" · Master App de Transportes
// Despliegue:  supabase functions deploy api            (verify_jwt activado: solo usuarios con sesión válida)
// Secretos (los define Supabase automáticamente en el entorno de la función; NUNCA van en el navegador ni en el repositorio):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL      (los tres ya existen en el entorno de las Edge Functions)
// Opcional:  supabase secrets set ALLOWED_ORIGIN=https://TU-USUARIO.github.io     (restringe CORS a tu sitio publicado)
import postgres from "npm:postgres@3.4.4";
import { ejecutar } from "./handler.mjs";

const URL_ = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const DB_URL = Deno.env.get("SUPABASE_DB_URL")!;
const ORIGEN = Deno.env.get("ALLOWED_ORIGIN") || "*";
const cors = { "Access-Control-Allow-Origin": ORIGEN, "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type", "Access-Control-Allow-Methods": "POST, OPTIONS", "Vary": "Origin" };
const sql = postgres(DB_URL, { max: 3, prepare: false, idle_timeout: 20 });

const adminHeaders = { Authorization: `Bearer ${SERVICE}`, apikey: SERVICE, "Content-Type": "application/json" };
const deps = {
  transaccion: (fn: (q: any) => Promise<any>) => sql.begin(async (tx: any) => fn(async (t: string, p: unknown[] = []) => ({ rows: await tx.unsafe(t, p as any[]) }))),
  async firmar(paths: string[]) {
    const r = await fetch(`${URL_}/storage/v1/object/sign/evidencias`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ expiresIn: 3600, paths }) });
    const out = new Map<string, string>();
    if (r.ok) for (const x of await r.json()) if (x.signedURL) out.set(x.path, `${URL_}/storage/v1${x.signedURL}`);
    return out;
  },
  async crearUsuarioAuth({ email, password }: { email: string; password: string }) {
    const r = await fetch(`${URL_}/auth/v1/admin/users`, { method: "POST", headers: adminHeaders, body: JSON.stringify({ email, password, email_confirm: true }) });
    const j = await r.json();
    if (!r.ok || !j.id) throw new Error(j.msg || j.message || "No se pudo crear la cuenta de acceso");
    return j.id as string;
  },
  async borrarUsuarioAuth(id: string) { await fetch(`${URL_}/auth/v1/admin/users/${id}`, { method: "DELETE", headers: adminHeaders }); },
};

function usuarioDelToken(req: Request): string | null {
  // verify_jwt ya validó la firma; aquí solo se lee el "sub" y se exige un usuario autenticado (no la clave anon).
  const t = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "");
  try {
    const p = JSON.parse(atob(t.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return p.role === "authenticated" && p.sub ? String(p.sub) : null;
  } catch { return null; }
}
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ ok: false, code: "METODO", message: "Usa POST." }, 405);
  const uid = usuarioDelToken(req);
  if (!uid) return json({ ok: false, code: "NO_AUTENTICADO", message: "Inicia sesión para continuar." }, 401);
  let body: any; try { body = await req.json(); } catch { return json({ ok: false, code: "ARGUMENTOS", message: "Solicitud inválida." }, 400); }
  return json(await ejecutar(deps, uid, body));
});
