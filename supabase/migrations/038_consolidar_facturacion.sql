-- 038 · Una sola pantalla de Facturación
-- La sección vieja «comercial» se retira del menú; Gerencia Comercial usa
-- la pantalla nueva, donde ya tiene los permisos de facturar y cobrar.
insert into master.permisos (rol, permiso, habilitado)
values ('GERENTE_COMERCIAL', 'sec_factcom', true)
on conflict (rol, permiso) do update set habilitado = true;
