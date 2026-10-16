p = r"C:\Users\manue\Master-App\js\engine.js"
s = open(p, encoding="utf-8").read()

def rep1(old, new, label):
    global s
    n = s.count(old)
    assert n == 1, (label, n)
    s = s.replace(old, new)
    print("[ok]", label)

rep1(
 "    const v={};keys.forEach(k=>{v[k]=d[k]==null?'':(typeof d[k]==='string'?d[k].trim():d[k]);});",
 "    const v={};keys.forEach(k=>{v[k]=d[k]==null?'':(typeof d[k]==='string'?d[k].trim():d[k]);});\n"
 "    /* Estado inicial: Planificado por defecto; solo quien tiene permiso puede fijar otro (y siempre uno válido). */\n"
 "    if(!v.estado||!ESTADOS[v.estado]||!hasPerm(A,'viajes_editar_estado'))v.estado='PLANIFICADO';",
 "crearViaje: normalizar el estado inicial")

rep1(
 "auditAdd({viajeId:id,accion:'Viaje creado',campo:'Estado',nuevo:ESTADOS.PLANIFICADO.l,por:A,",
 "auditAdd({viajeId:id,accion:'Viaje creado',campo:'Estado',nuevo:ESTADOS[t.estado].l,por:A,",
 "crearViaje: auditar el estado real")

rep1(
 "      if(TIEMPO_KEYS.includes(k)){",
 "      if(k==='estado'){\n"
 "        need(A,'viajes_editar_estado','modificar manualmente el estado del viaje');\n"
 "        if(!(cambios[k]===''||cambios[k]==null)&&!ESTADOS[cambios[k]])deny('Estado no válido.','VALIDACION');\n"
 "      }else if(TIEMPO_KEYS.includes(k)){",
 "editarViaje: rama propia para 'estado'")

rep1(
 "      const ov=t[k]==null?'':t[k];\n      if(String(nv==null?'':nv)===String(ov))return;",
 "      const ov=t[k]==null?'':t[k];\n"
 "      if(k==='estado'&&(nv===''||nv==null))return;   /* sin estado elegido: se conserva el actual */\n"
 "      if(String(nv==null?'':nv)===String(ov))return;",
 "editarViaje: estado vacio conserva el actual")

open(p, "w", encoding="utf-8", newline="\n").write(s)
print("engine.js actualizado")
