import re
import os

scripts_to_add = """<script src="js/modulos/torre.js"></script>
<script src="js/modulos/finanzas.js"></script>
<script src="js/modulos/comercial.js"></script>
<script src="js/modulos/transporte.js"></script>
<script src="js/modulos/admin.js"></script>"""

base = r"C:\Users\manue\Master-App"
for file in ["index.html", "prueba-visual.html"]:
    path = os.path.join(base, file)
    with open(path, "r", encoding="utf-8") as f:
        html = f.read()
    
    if "js/modulos/torre.js" not in html:
        html = html.replace('<script src="js/ui.js"></script>', f'<script src="js/ui.js"></script>\n{scripts_to_add}')
        with open(path, "w", encoding="utf-8") as f:
            f.write(html)

sw_path = os.path.join(base, "service-worker.js")
with open(sw_path, "r", encoding="utf-8") as f:
    sw = f.read()

sw = re.sub(r"const VERSION = 'v1\.0\.\d+';", "const VERSION = 'v1.0.22';", sw)

if "'js/modulos/torre.js'," not in sw:
    sw = sw.replace("'js/ui.js',", "'js/ui.js',\n  'js/modulos/torre.js',\n  'js/modulos/finanzas.js',\n  'js/modulos/comercial.js',\n  'js/modulos/transporte.js',\n  'js/modulos/admin.js',")

with open(sw_path, "w", encoding="utf-8") as f:
    f.write(sw)

print("HTML and SW updated.")
