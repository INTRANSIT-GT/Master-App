#!/usr/bin/env node
/* Genera supabase/migrations/004_permisos_base.sql con los permisos por perfil que define el motor (js/engine.js),
   para que la base de datos y la aplicación nunca difieran. Uso: node scripts/gen-sql-permisos.mjs */
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
import { createEngine } from '../supabase/functions/api/core.mjs';
const raíz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const E = createEngine(); const q = s => "'" + String(s).replace(/'/g, "''") + "'";
const filas = [], prohibidos = [];
for (const rol of Object.keys(E.ROLES)) for (const p of E.PERM_KEYS) {
  const vedado = (E.PROHIBIDO[rol] || []).includes(p);
  filas.push(`(${q(rol)},${q(p)},${(E.PERM_DEFAULT[rol] || []).includes(p) && !vedado})`);
  if (vedado) prohibidos.push(`(${q(rol)},${q(p)})`);
}
const sql = `-- =====================================================================
-- 004 · PERMISOS BASE (GENERADO por scripts/gen-sql-permisos.mjs — no editar a mano)
-- Estos son los permisos iniciales por perfil. La administradora puede cambiarlos desde la aplicación (Usuarios y permisos),
-- salvo los "prohibidos" (separación de funciones), que ni la matriz ni la base de datos permiten conceder.
-- Perfiles: ADMIN, ENCARGADO (= IMPLAN, un solo perfil), TORRE, LIQUIDACIONES, COMERCIAL, GERENCIA.
-- =====================================================================
insert into public.permisos (rol, permiso, habilitado) values
${filas.join(',\n')}
on conflict (rol, permiso) do nothing;

insert into public.permisos_prohibidos (rol, permiso) values
${prohibidos.join(',\n')}
on conflict do nothing;

-- Estatus operativos que Torre de Control puede actualizar (configurable por la administradora en la aplicación)
insert into public.config (clave, valor) values ('torreEstatus', ${q(JSON.stringify(E.TORRE_ESTATUS_DEFECTO))}::jsonb)
on conflict (clave) do nothing;

-- Contadores de identificadores. AJUSTA 'trip' al siguiente número de viaje que corresponda a tu operación real
-- (por ejemplo, si el último viaje de tu hoja es el 000111, usa 112) para no chocar con registros históricos.
insert into public.secuencias (clave, valor) values
 ('trip',1),('liq',1),('evi',1),('agr',1),('evt',1),('usr',1),('cob',1),('pag',1),('rut',1),('tar',1),('not',1)
on conflict (clave) do nothing;
`;
fs.writeFileSync(path.join(raíz, 'supabase/migrations/004_permisos_base.sql'), sql);
console.log('004_permisos_base.sql generado:', filas.length, 'permisos,', prohibidos.length, 'prohibidos');
