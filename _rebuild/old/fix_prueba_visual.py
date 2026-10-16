import re
with open(r"C:\Users\manue\Master-App\js\datos-prueba-visual.js", "r", encoding="utf-8") as f:
    text = f.read()

text = text.replace("r!=='ENCARGADO'", "r!=='OPERATIVO'")
text = text.replace("U('U-ENC1','encargado1','Pedro Chaperon (ejemplo)','ENCARGADO')", "U('U-OPE1','operativo1','Pedro Chaperon (ejemplo)','OPERATIVO')")
text = text.replace("U('U-ENC2','nora','Nora Rivera (ejemplo, 58 clientes)','ENCARGADO')", "U('U-OPE2','nora','Nora Rivera (ejemplo, 58 clientes)','OPERATIVO')")
text = text.replace("U('U-ENC3','sinproy','Encargado sin proyectos (ejemplo)','ENCARGADO')", "U('U-OPE3','sinproy','Operativo sin proyectos (ejemplo)','OPERATIVO')")
text = text.replace("userId:'U-ENC1'", "userId:'U-OPE1'")
text = text.replace("userId:'U-ENC2'", "userId:'U-OPE2'")
text = text.replace("userId:'U-ENC3'", "userId:'U-OPE3'")
text = text.replace("u.rol==='ENCARGADO'", "u.rol==='OPERATIVO'")

# Update ROL_NOMBRE map
new_rol_nombre = """const ROL_NOMBRE={ADMIN:'Administradora (ejemplo)',TORRE:'Torre de control (ejemplo)',VALIDADOR:'Validador (ejemplo)',FACTURACION:'Facturación (ejemplo)',GERENTE_COMERCIAL:'Gerencia comercial (ejemplo)',COBROS:'Cobros (ejemplo)',GERENTE_TRANSPORTE:'Gerencia de transporte (ejemplo)',ANALISTA_COMERCIAL:'Analista comercial (ejemplo)',PAGO_OPL:'Pago OPL (ejemplo)'};"""
text = re.sub(r'const ROL_NOMBRE=\{.*?\};', new_rol_nombre, text)

# update UI groups mapping at the end
text = text.replace("u.rol==='ENCARGADO'", "u.rol==='OPERATIVO'")
text = text.replace("u.rol!=='ENCARGADO'", "u.rol!=='OPERATIVO'")

with open(r"C:\Users\manue\Master-App\js\datos-prueba-visual.js", "w", encoding="utf-8") as f:
    f.write(text)
