import re
with open(r"C:\Users\manue\Master-App\js\engine.js", "r", encoding="utf-8") as f:
    text = f.read()

# Add 'estado' to DATA_KEYS
text = text.replace("const DATA_KEYS=['proyectoCat',", "const DATA_KEYS=['estado','proyectoCat',")

# Fix crearViaje
def fix_crear(m):
    return m.group(0).replace(
        "const t=Object.assign({id", 
        "if(v.estado && !hasPerm(A,'viajes_editar_estado')) v.estado='PLANIFICADO';\n     if(v.estado && !ESTADOS[v.estado]) deny('Estado inválido.');\n     const t=Object.assign({id"
    ).replace(
        "auditAdd({viajeId:id,accion:'Viaje creado',campo:'Estado',nuevo:ESTADOS.PLANIFICADO.l",
        "auditAdd({viajeId:id,accion:'Viaje creado',campo:'Estado',nuevo:ESTADOS[t.estado||'PLANIFICADO'].l"
    )

text = re.sub(r'crearViaje\(uid,d\)\{return exec\(uid,\'crearViaje\',\'\',A=>\{.*?return t;\n   \}\);\},', fix_crear, text, flags=re.DOTALL)

# Fix editarViaje
def fix_editar(m):
    block = m.group(0)
    # inside ks.forEach validation loop
    block = block.replace(
        "if(TIEMPO_KEYS.includes(k)){",
        "if(k==='estado'){ need(A,'viajes_editar_estado','modificar manualmente el estado del viaje'); if(cambios[k] && !ESTADOS[cambios[k]]) deny('Estado inválido.'); } else if(TIEMPO_KEYS.includes(k)){"
    )
    # inside dif.push
    block = block.replace(
        "if(['proyectoCat','fechaPlan','pilotoId','rutaId'].includes(k)",
        "if(['estado','proyectoCat','fechaPlan','pilotoId','rutaId'].includes(k)"
    )
    return block

text = re.sub(r'editarViaje\(uid,id,cambios,motivo\)\{return exec\(uid,\'editarViaje\',id,A=>\{.*?return \{cambios:dif\.length\};\n   \}\);\},', fix_editar, text, flags=re.DOTALL)

with open(r"C:\Users\manue\Master-App\js\engine.js", "w", encoding="utf-8") as f:
    f.write(text)

print("Viaje funciones actualizadas.")
