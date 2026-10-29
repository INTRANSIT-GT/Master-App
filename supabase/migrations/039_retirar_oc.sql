-- 039 · Retiro del módulo de órdenes de compra
-- Se conserva el historial en master.ordenes_compra y el permiso de desglose de
-- combustible (oc_ver_combustible), que también usan los reportes de agrupación.
update master.permisos
set habilitado = false
where permiso in ('oc_ver','oc_preparar','oc_enviar','oc_responder','oc_corregir','sec_oc');
