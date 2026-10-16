import re

with open(r"C:\Users\manue\Master-App\js\ui.js", "r", encoding="utf-8") as f:
    code = f.read()

methods_to_extract = ["aplicarTarifasTodas", "opSoloOpl", "opClear", "opEmitir"]
extracted_methods = []

for method in methods_to_extract:
    match = re.search(r'\s*async\s+' + method + r'\s*\(\)\s*\{', code)
    if match:
        start_idx = match.start()
        brace_count = 0
        i = match.end() - 1
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
            
            remove_end = end_idx
            while remove_end < len(code) and code[remove_end] in (' ', '\n', '\r', '\t'):
                remove_end += 1
            if remove_end < len(code) and code[remove_end] == ',':
                remove_end += 1
            
            code = code[:start_idx] + code[remove_end:]

with open(r"C:\Users\manue\Master-App\js\modulos\finanzas.js", "r", encoding="utf-8") as f:
    finanzas_code = f.read()

# insert them before the last `});`
finanzas_code = finanzas_code.replace("});", "  " + ",\n  ".join(extracted_methods) + "\n});")

with open(r"C:\Users\manue\Master-App\js\modulos\finanzas.js", "w", encoding="utf-8") as f:
    f.write(finanzas_code)

with open(r"C:\Users\manue\Master-App\js\ui.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Métodos faltantes extraídos.")
