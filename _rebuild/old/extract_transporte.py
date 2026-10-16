import re
with open(r"C:\Users\manue\Master-App\js\ui.js", "r", encoding="utf-8") as f:
    code = f.read()

transporte_match1 = re.search(r'(/\* ---- Viajes del encargado.*?\n)(/\* ---- Detalle del viaje)', code, re.DOTALL)
transporte_match2 = re.search(r'(/\* ---- Rutas \(catálogo.*?\n)(/\* ---- Notificaciones)', code, re.DOTALL)

trans_block = ""
if transporte_match1:
    trans_block += transporte_match1.group(1)
    code = code.replace(transporte_match1.group(1), "")
if transporte_match2:
    trans_block += transporte_match2.group(1)
    code = code.replace(transporte_match2.group(1), "")

transporte_methods = [
    "iniciarAsk", "iniciarOk", "finalizarAsk", "finalizarOk", "enviarLiq", 
    "aprobarAsk", "aprobarOk", "devolverOpen", "devolverSend", "guardar", 
    "otro", "terminar", "terminarOk", "ahora", "limpiar", "editar", 
    "editCancel", "editSave", "rutaSolicitarOpen", "rutaSolicitarSave", 
    "rutaRegistrarOpen", "rutaRegistrarSave", "rutaValidarOpen", "rutaValidarOk", 
    "rutaRechazarOpen", "rutaRechazarOk", "rutaAprobarComOpen", "rutaAprobarComOk", 
    "rutaAprobarTraOpen", "rutaAprobarTraOk", "shipmentDupOpen", "shipmentDupOk"
]
act_trans = []

for method in transporte_methods:
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
            act_trans.append(code[start_idx:end_idx].strip())
            remove_end = end_idx
            while remove_end < len(code) and code[remove_end] in (' ', '\n', '\r', '\t'): remove_end += 1
            if remove_end < len(code) and code[remove_end] == ',': remove_end += 1
            code = code[:start_idx] + code[remove_end:]

transporte_js = f"""/* =====================================================================
   MÓDULO: Transporte, Viajes, Liquidaciones y Rutas
   ===================================================================== */
{trans_block}
Object.assign(window.ACT, {{
  {', '.join(act_trans)}
}});
"""
with open(r"C:\Users\manue\Master-App\js\modulos\transporte.js", "w", encoding="utf-8") as out:
    out.write(transporte_js)

with open(r"C:\Users\manue\Master-App\js\ui.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Transporte extraído.")
