import re
with open(r"C:\Users\manue\Master-App\js\ui.js", "r", encoding="utf-8") as f:
    text = f.read()

# Replace the VIEWS.proyectos implementation
def replace_views_proyectos(m):
    return """VIEWS.proyectos=()=>{
  if(esAdm() || hp('clientes_gestionar')) return clientesAdminHTML();
  return clientesAdminHTML();
};
"""

text = re.sub(r'VIEWS\.proyectos=\(\)=>\{.*?\n\};\n', replace_views_proyectos, text, flags=re.DOTALL)

with open(r"C:\Users\manue\Master-App\js\ui.js", "w", encoding="utf-8") as f:
    f.write(text)

print("VIEWS.proyectos actualizado para usar clientesAdminHTML")
