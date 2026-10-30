-- Capacidad temporal del equipo de arrastre ARR-0029.
-- El usuario pidió mover el dato de prueba al equipo de arrastre mientras se carga la flota real.
-- Reemplazar este valor cuando llegue la capacidad oficial de la placa.
insert into master.flota (unidad, placa, tango, capacidad, tipo, extra)
values ('ARR-0029', 'ARR-0029', '', '40', 'RAS S', '{"prueba":true,"nota":"Capacidad temporal hasta cargar la flota real"}'::jsonb)
on conflict (unidad) do update
set placa = excluded.placa,
    capacidad = excluded.capacidad,
    tipo = excluded.tipo,
    extra = master.flota.extra || excluded.extra;
