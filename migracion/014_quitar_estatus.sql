-- =====================================================================
-- 014 · Un solo estado por viaje
-- El viaje antes tenía DOS estados: "Estatus" (operativo, 20 valores de la
-- hoja) y "Estado del proceso" (flujo). Se conserva únicamente el Estado
-- del proceso y se elimina el campo operativo "estatus" (columna y config).
-- =====================================================================

alter table master.viajes drop column if exists estatus;

-- La lista de estatus autorizados para Torre de Control ya no existe.
delete from master.config where clave = 'torreEstatus';
