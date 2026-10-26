-- =====================================================================
-- 031 · «Mi guía de uso» · bucket PRIVADO "manuales"   (PREPARADA · NO EJECUTADA)
-- (La 030 ya existe: 030_origen_destino_texto.sql.)
--   json/<guia>.json    contenido de cada guía (secciones, pasos, texto) e índice de búsqueda; se lee dentro de la app
--   img/<captura>.png   capturas (modo demostración)
-- El bucket NO es público y NO se crea ninguna política en storage.objects: ni «anon» ni «authenticated» pueden listar,
-- leer, subir, sobrescribir ni borrar. Solo la Edge Function «api» (clave de servicio, que nunca sale del servidor) lee el contenido y
-- firma enlaces de 5 minutos para las capturas, y únicamente tras validar en cada solicitud el rol real del usuario (master.perfiles.rol).
-- La carga de archivos se hace desde el panel de Supabase (Storage) con la sesión de la administradora del proyecto.
-- No toca ninguna tabla, permiso ni política existente. Es seguro volver a ejecutarla (idempotente).
-- =====================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('manuales','manuales',false,10485760,array['application/json','image/png','image/jpeg','image/webp'])
on conflict (id) do update set public=false, file_size_limit=excluded.file_size_limit, allowed_mime_types=excluded.allowed_mime_types;
-- Sin políticas a propósito (RLS de storage.objects ya está activa en Supabase: sin política = sin acceso para los usuarios).
