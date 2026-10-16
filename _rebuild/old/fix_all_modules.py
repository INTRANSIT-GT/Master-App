import re
import os

with open(r"C:\Users\manue\GensparkCode\master\js\ui.js", "r", encoding="utf-8") as f:
    code = f.read()

code = re.sub(r'const VIEWS=\{\},BODY=\{\};', r'window.VIEWS={}; window.BODY={};', code)
code = re.sub(r'const ACT=\{', r'window.ACT={', code)

# Extract Torre
torre_match = re.search(r'(/\* ---- Torre de Control.*?\n)(/\* ---- Liquidaciones)', code, re.DOTALL)
torre_methods = ["torreEstado", "estadoRetry"]
act_torre = []

if torre_match:
    torre_block = torre_match.group(1)
    code = code.replace(torre_block, "")
    for method in torre_methods:
        # Match `async method(d){...},`
        m = re.search(r'\s*async\s+' + method + r'\s*\(d\)\s*\{', code)
        if m:
            start_idx = m.start()
            brace_count = 0
            i = m.end() - 1
            end_idx = -1
            while i < len(code):
                if code[i] == '{': brace_count += 1
                elif code[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_idx = i + 1
                        break
                i += 1
            if end_idx != -1:
                act_torre.append(code[start_idx:end_idx].strip())
                remove_end = end_idx
                while remove_end < len(code) and code[remove_end] in (' ', '\n', '\r', '\t'): remove_end += 1
                if remove_end < len(code) and code[remove_end] == ',': remove_end += 1
                code = code[:start_idx] + code[remove_end:]

    torre_js = f"""/* =====================================================================
   MÓDULO: Torre de Control
   ===================================================================== */
{torre_block}
Object.assign(window.ACT, {{
  {', '.join(act_torre)}
}});
"""
    with open(r"C:\Users\manue\Master-App\js\modulos\torre.js", "w", encoding="utf-8") as out:
        out.write(torre_js)

# Extract Finanzas
finanzas_match = re.search(r'(/\* ---- Finanzas \(Gerencia\).*?\n)(/\* ---- Usuarios y permisos)', code, re.DOTALL)
finanzas_methods = [
    "cobroOpen", "cobroOk", "aplicarTarifaViaje", "aplicarTarifasTodas", 
    "opSoloOpl", "tarifaOpenOpl", "tarifaSaveOpl", "tarifaOpen", "tarifaSave", 
    "tarifaEstado", "opTog", "opClear", "opAbrir", "opEmitir", "opTransferOpen", 
    "opTransferOk", "opAnularOpen", "opAnularOk", "pagoOpen", "pagoOk", 
    "anularPagoOpen", "anularPagoOk", "finDet", "importeOpen", "importeOk"
]
act_fin = []

if finanzas_match:
    finanzas_block = finanzas_match.group(1)
    code = code.replace(finanzas_block, "")
    for method in finanzas_methods:
        # Match `async method(d){...},` or `async method(){...},`
        m = re.search(r'\s*async\s+' + method + r'\s*\([a-zA-Z0-9_]*\)\s*\{', code)
        if m:
            start_idx = m.start()
            brace_count = 0
            i = m.end() - 1
            end_idx = -1
            while i < len(code):
                if code[i] == '{': brace_count += 1
                elif code[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_idx = i + 1
                        break
                i += 1
            if end_idx != -1:
                act_fin.append(code[start_idx:end_idx].strip())
                remove_end = end_idx
                while remove_end < len(code) and code[remove_end] in (' ', '\n', '\r', '\t'): remove_end += 1
                if remove_end < len(code) and code[remove_end] == ',': remove_end += 1
                code = code[:start_idx] + code[remove_end:]

    finanzas_js = f"""/* =====================================================================
   MÓDULO: Finanzas, Tarifas y Pago OPL
   ===================================================================== */
{finanzas_block}
Object.assign(window.ACT, {{
  {', '.join(act_fin)}
}});
"""
    with open(r"C:\Users\manue\Master-App\js\modulos\finanzas.js", "w", encoding="utf-8") as out:
        out.write(finanzas_js)

with open(r"C:\Users\manue\Master-App\js\ui.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Módulos extraídos desde el original.")
