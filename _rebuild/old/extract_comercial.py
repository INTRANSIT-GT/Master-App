import re
with open(r"C:\Users\manue\Master-App\js\ui.js", "r", encoding="utf-8") as f:
    code = f.read()

comercial_match = re.search(r'(/\* ---- Comercial.*?\n)(/\* ---- Tarifas)', code, re.DOTALL)
comercial_methods = [
    "facturaOpen", "facturaPrep", "facturaEnviar", "facturaEditar", 
    "facturaEditarGuardar", "facturaEditarEnviar", "emitirOpen", "emitirOk", 
    "evidenciaVer", "corregirOpen", "corregirOk", "anularOpen", "anularOk", 
    "agrDetalle", "factFase", "fcAddFecha", "fcQuitarFecha", "exportFactXlsx", 
    "exportFinXlsx", "exportFinPdf", "exportFactPdf", "fcLimpiar", "cbToggle", 
    "cbPick", "selClear"
]
act_com = []

if comercial_match:
    comercial_block = comercial_match.group(1)
    code = code.replace(comercial_block, "")
    for method in comercial_methods:
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
                act_com.append(code[start_idx:end_idx].strip())
                remove_end = end_idx
                while remove_end < len(code) and code[remove_end] in (' ', '\n', '\r', '\t'): remove_end += 1
                if remove_end < len(code) and code[remove_end] == ',': remove_end += 1
                code = code[:start_idx] + code[remove_end:]

    comercial_js = f"""/* =====================================================================
   MÓDULO: Comercial y Facturación
   ===================================================================== */
{comercial_block}
Object.assign(window.ACT, {{
  {', '.join(act_com)}
}});
"""
    with open(r"C:\Users\manue\Master-App\js\modulos\comercial.js", "w", encoding="utf-8") as out:
        out.write(comercial_js)

    with open(r"C:\Users\manue\Master-App\js\ui.js", "w", encoding="utf-8") as f:
        f.write(code)
    print("Comercial extraído.")
