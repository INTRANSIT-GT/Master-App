import re
with open(r"C:\Users\manue\Master-App\js\ui.js", "r", encoding="utf-8") as f:
    code = f.read()

admin_match1 = re.search(r'(/\* ---- Tarifas.*?\n)(/\* ---- Usuarios y permisos)', code, re.DOTALL)
admin_match2 = re.search(r'(/\* ---- Usuarios y permisos.*?\n)(/\* ---------- Eventos)', code, re.DOTALL)

admin_block = ""
if admin_match1:
    admin_block += admin_match1.group(1)
    code = code.replace(admin_match1.group(1), "")
if admin_match2:
    admin_block += admin_match2.group(1)
    code = code.replace(admin_match2.group(1), "")

admin_methods = [
    "usuarioOpen", "usuarioSave", "verificarAud", "clienteOpen", "clienteSave", 
    "clienteEstado", "memOpen", "memSave", "fleLoad", "fleSync", "cliLimpiar"
]
act_admin = []

for method in admin_methods:
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
            act_admin.append(code[start_idx:end_idx].strip())
            remove_end = end_idx
            while remove_end < len(code) and code[remove_end] in (' ', '\n', '\r', '\t'): remove_end += 1
            if remove_end < len(code) and code[remove_end] == ',': remove_end += 1
            code = code[:start_idx] + code[remove_end:]

admin_js = f"""/* =====================================================================
   MÓDULO: Administración, Tarifas, Usuarios y Auditoría
   ===================================================================== */
{admin_block}
Object.assign(window.ACT, {{
  {', '.join(act_admin)}
}});
"""
with open(r"C:\Users\manue\Master-App\js\modulos\admin.js", "w", encoding="utf-8") as out:
    out.write(admin_js)

with open(r"C:\Users\manue\Master-App\js\ui.js", "w", encoding="utf-8") as f:
    f.write(code)

print("Admin extraído.")
