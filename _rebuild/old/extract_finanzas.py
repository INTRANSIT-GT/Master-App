import re

with open(r"C:\Users\manue\Master-App\js\ui.js", "r", encoding="utf-8") as f:
    code = f.read()

finanzas_match = re.search(r'(/\* ---- Finanzas \(Gerencia\).*?\n)(/\* ---- Usuarios y permisos)', code, re.DOTALL)
if finanzas_match:
    finanzas_block = finanzas_match.group(1)
    code = code.replace(finanzas_block, "")
    
    act_methods_to_extract = [
        "cobroOpen", "cobroOk", "aplicarTarifaViaje", "aplicarTarifasTodas", 
        "opSoloOpl", "tarifaOpenOpl", "tarifaSaveOpl", "tarifaOpen", "tarifaSave", 
        "tarifaEstado", "opTog", "opClear", "opAbrir", "opEmitir", "opTransferOpen", 
        "opTransferOk", "opAnularOpen", "opAnularOk", "pagoOpen", "pagoOk", 
        "anularPagoOpen", "anularPagoOk", "finDet", "importeOpen", "importeOk"
    ]
    
    extracted_methods = []
    
    for method in act_methods_to_extract:
        # Regex to match `async method(d){ ... },`
        # Need to handle nested braces. This is risky with simple regex if the method has multiple braces.
        # But our methods are mostly simple or we can use a small brace-matching logic.
        
        # Let's find the start
        match = re.search(r'\s*async\s+' + method + r'\s*\(d\)\s*\{', code)
        if match:
            start_idx = match.start()
            brace_count = 0
            i = match.end() - 1 # points to '{'
            end_idx = -1
            while i < len(code):
                if code[i] == '{':
                    brace_count += 1
                elif code[i] == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        end_idx = i + 1
                        break
                i += 1
                
            if end_idx != -1:
                method_code = code[start_idx:end_idx]
                extracted_methods.append(method_code.strip())
                
                # Check for trailing comma
                remove_end = end_idx
                while remove_end < len(code) and code[remove_end] in (' ', '\n', '\r', '\t'):
                    remove_end += 1
                if remove_end < len(code) and code[remove_end] == ',':
                    remove_end += 1
                
                code = code[:start_idx] + code[remove_end:]
            else:
                print(f"Could not find end of method {method}")
        else:
            print(f"Method {method} not found")

    finanzas_js = f"""/* =====================================================================
   MÓDULO: Finanzas, Tarifas y Pago OPL
   ===================================================================== */

{finanzas_block}

Object.assign(window.ACT, {{
  {', '.join(extracted_methods)}
}});
"""
    with open(r"C:\Users\manue\Master-App\js\modulos\finanzas.js", "w", encoding="utf-8") as out:
        out.write(finanzas_js)
        
    with open(r"C:\Users\manue\Master-App\js\ui.js", "w", encoding="utf-8") as out:
        out.write(code)
    
    print("Finanzas extraído exitosamente.")
else:
    print("No se encontró el bloque de Finanzas.")

