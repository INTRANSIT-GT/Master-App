import re

with open(r"C:\Users\manue\Master-App\js\ui.js", "r", encoding="utf-8") as f:
    code = f.read()

# Make VIEWS, BODY, ACT global instead of const
code = re.sub(r'const VIEWS=\{\},BODY=\{\};', r'window.VIEWS={}; window.BODY={};', code)
code = re.sub(r'const ACT=\{', r'window.ACT={', code)

# We want to extract Torre:
# Markers:
# /* ---- Torre de Control: hoja tipo Excel · avanza el estado de los clientes autorizados ---- */
# ... up to ...
# /* ---- Liquidaciones: tabla compacta tipo Excel ---- */

torre_match = re.search(r'(/\* ---- Torre de Control.*?\n)(/\* ---- Liquidaciones)', code, re.DOTALL)
if torre_match:
    torre_block = torre_match.group(1)
    code = code.replace(torre_block, "")
    
    # We also need to extract ACT.torreEstado and ACT.estadoRetry
    # I'll use simple regex for these two since they are known
    
    torre_estado_match = re.search(r'\s*async torreEstado\(d\)\{.*?\n  \},', code, re.DOTALL)
    estado_retry_match = re.search(r'\s*async estadoRetry\(d\)\{.*?\n  \},', code, re.DOTALL)
    
    act_methods = []
    if torre_estado_match:
        act_methods.append(torre_estado_match.group(0).strip().rstrip(','))
        code = code.replace(torre_estado_match.group(0), "")
        
    if estado_retry_match:
        act_methods.append(estado_retry_match.group(0).strip().rstrip(','))
        code = code.replace(estado_retry_match.group(0), "")
        
    torre_js = f"""/* =====================================================================
   MÓDULO: Torre de Control
   ===================================================================== */

{torre_block}

Object.assign(window.ACT, {{
  {', '.join(act_methods)}
}});
"""
    import os
    os.makedirs(r"C:\Users\manue\Master-App\js\modulos", exist_ok=True)
    with open(r"C:\Users\manue\Master-App\js\modulos\torre.js", "w", encoding="utf-8") as out:
        out.write(torre_js)
        
    with open(r"C:\Users\manue\Master-App\js\ui.js", "w", encoding="utf-8") as out:
        out.write(code)
    
    print("Torre extraído exitosamente.")
else:
    print("No se encontró el bloque de Torre.")

