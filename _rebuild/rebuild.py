# Reconstruye js/ui.js + js/modulos/*.js desde la base original (HEAD),
# re-aplicando los ajustes propios y el cambio de GitHub (menu ADMIN por modulos).
import re, os, sys

ROOT = r"C:\Users\manue\Master-App"
sys.path.insert(0, os.path.join(ROOT, "_rebuild"))
def ruta(*p): return os.path.join(ROOT, *p)
def leer(p): return open(ruta(p), encoding="utf-8").read()

from jsscan import find_object, parse_methods

t = leer(r"_rebuild\base_ui.js")

def rep(text, old, new, label):
    n = text.count(old)
    assert n >= 1, "NO ENCONTRADO -> " + label
    print("  [ok] " + label + " (" + str(n) + ")")
    return text.replace(old, new)

def grab_fn(src, start):
    i = src.index(start)
    j = src.index("{", i)
    from jsscan import _scan
    return src[i:_scan(src, j) + 1]

ui_actual = leer(r"js\ui.js")
trans_act = leer(r"js\modulos\transporte.js")
admin_act = leer(r"js\ui.js")
comercial_act = leer(r"js\modulos\comercial.js")

P_VIEWS_PROYECTOS = grab_fn(ui_actual, "VIEWS.proyectos=")
P_CLIENTES_ADMIN  = grab_fn(trans_act, "function clientesAdminHTML(){")
P_FIELDM          = grab_fn(admin_act, "function fieldM(f,data){")
P_CLIENTEOPEN     = grab_fn(comercial_act, "async clienteOpen(d){")
assert "clientesAdminHTML" in P_VIEWS_PROYECTOS
assert "qCli" in P_CLIENTES_ADMIN and "clientesAdminHTML" in P_CLIENTES_ADMIN
assert "multiselect" in P_FIELDM and "multiselect" in P_CLIENTEOPEN

print("Aplicando ajustes propios...")
t = rep(t, "u.rol==='ENCARGADO'", "u.rol==='OPERATIVO'", "rol ENCARGADO->OPERATIVO (u.)")
t = rep(t, "S.user.rol==='ENCARGADO'", "S.user.rol==='OPERATIVO'", "rol ENCARGADO->OPERATIVO (S.user)")
t = rep(t, "rol:'ENCARGADO'", "rol:'OPERATIVO'", "rol por defecto del alta")
t = rep(t, "S.user.rol==='GERENCIA'", "S.user.rol==='GERENTE_TRANSPORTE'", "rol GERENCIA->GERENTE_TRANSPORTE")
t = rep(t, "ADMIN · ENCARGADO · TORRE · LIQUIDACIONES · COMERCIAL · GERENCIA",
           "ADMIN · OPERATIVO · TORRE · VALIDADOR · FACTURACION · GERENTE_TRANSPORTE", "doc modelo de datos")
t = rep(t, "Quedó en estado Pendiente", "Se asignó su estado inicial", "mensaje viaje guardado")

tok = "/*__CLIENTES_ADMIN__*/"
t = rep(t, "function clientesAdminHTML(){", tok + "{", "marcar clientesAdminHTML")
i = t.index(tok); j = t.index("\n/* ---- ", i)
t = t[:i] + P_CLIENTES_ADMIN + "\n\n" + t[j+1:]

i = t.index("VIEWS.proyectos="); j = t.index("VIEWS.proyecto=", i)
t = t[:i] + P_VIEWS_PROYECTOS + "\n" + t[j:]

i = t.index("function fieldM(f,data){"); j = t.index("function liveHTML(f){", i)
t = t[:i] + P_FIELDM + "\n" + t[j:]

i = t.index("async clienteOpen(d){"); j = t.index("async clienteSave(d){", i)
t = t[:i] + P_CLIENTEOPEN + "\n  " + t[j:]

t = rep(t,
  """      <div class="row2">${txt('noViaje','No. de viaje')}${sel('opl','OPL',CAT.opl,{src:'CATALOGO'})}</div>""",
  """      <div class="row2">${txt('noViaje','No. de viaje')}${sel('opl','OPL',CAT.opl,{src:'CATALOGO'})}</div>
      ${hp('viajes_editar_estado')?`<div class="row2">${sel('estado','Estado',Object.keys(ESTADOS).map(k=>({id:k,nombre:ESTADOS[k].l})))}</div>`:''}""",
  "campo Estado en el formulario")
t = rep(t, "proyectoCat:'',shipment:''", "proyectoCat:'',estado:'',shipment:''", "initForm: estado")
t = rep(t,
  "['proyectoCat','shipment','noViaje','opl','tipoViaje','tipoCarga','noCarga','producto','placaArrastre','pilotoId','rutaId','rutaRef','noDocRetorno','qViaticos',...TKEYS]",
  "['proyectoCat','estado','shipment','noViaje','opl','tipoViaje','tipoCarga','noCarga','producto','placaArrastre','pilotoId','rutaId','rutaRef','noDocRetorno','qViaticos',...TKEYS]",
  "toModel: estado actual")
t = rep(t, "  if(t.id==='q'){S.q=t.value;",
  "  if(t.id==='qCli'){S.qCli=t.value;render();const el=document.getElementById('qCli');if(el){el.focus();el.setSelectionRange(el.value.length,el.value.length);}return;}\n  if(t.id==='q'){S.q=t.value;",
  "listener buscador de clientes")
t = rep(t,
  """  if(t.dataset.mfm&&S.modal){const k=t.dataset.mfm,a=S.modal.data[k]||[];S.modal.data[k]=t.checked?[...new Set([...a,t.value])]:a.filter(x=>x!==t.value);""",
  """  if(t.dataset.mfm&&S.modal){const k=t.dataset.mfm;
    if(t.tagName==='SELECT'&&t.multiple){S.modal.data[k]=Array.from(t.selectedOptions).map(o=>o.value);}
    else{const a=S.modal.data[k]||[];S.modal.data[k]=t.checked?[...new Set([...a,t.value])]:a.filter(x=>x!==t.value);}""",
  "listener mfm con select multiple")

adm_nav = leer(r"_rebuild\adm_nav.txt")
t = rep(t, "function navHTML(){", adm_nav + "function navHTML(){", "insertar admNavHTML + ADM_MODULOS")
t = rep(t,
  "  const act=S.view==='detalle'&&S.from?S.from.view:(S.view==='proyecto'?'proyectos':S.view);\n  return `<nav class=\"side\" aria-label=\"Navegación principal\">${items.map(",
  "  const act=S.view==='detalle'&&S.from?S.from.view:(S.view==='proyecto'?'proyectos':S.view);\n  if(S.user.rol==='ADMIN')return admNavHTML(items,act);\n  return `<nav class=\"side\" aria-label=\"Navegación principal\">${items.map(",
  "navHTML: menu agrupado para ADMIN")
t = rep(t,
  "async nav(d){S.fEstado='';S.q='';S.fCli='';S.fPcat='';S.fProy='';S.fDesde='';S.fHasta='';S.fProv='';S.sortL=null;go(d.v);},",
  "async nav(d){S.fEstado='';S.q='';S.fCli='';S.fPcat='';S.fProy='';S.fDesde='';S.fHasta='';S.fProv='';S.sortL=null;S.navK=d.k||'';if(d.tabk)S.tab[d.tabk]=d.tabv;go(d.v);},",
  "ACT.nav con navK")

MARCADORES = [
 ("/* ---------- Componentes ---------- */", "ui"),
 ("/* ---- Perfil «Encargado de proyecto»", "ui"),
 ("/* ---- Perfil «Administrador»", "ui"),
 ("/* ---------- Paginación", "ui"),
 ("/* ---------- Notas de arquitectura", "ui"),
 ("/* ---- Login ----", "ui"),
 ("/* ---- Inicio del encargado ----", "ui"),
 ("/* ---- Selector desplegable", "ui"),
 ("/* ---- Tabla de viajes: acciones fijas", "ui"),
 ("/* ---- Viajes del encargado ----", "transporte"),
 ("/* ---- Encargado de proyecto · Proyecto y Ruta", "transporte"),
 ("/* ---- Nuevo viaje · placa del equipo", "transporte"),
 ("/* ---- Facturación · desplegable", "comercial"),
 ("/* ---- Rutas · catálogo desplegable", "transporte"),
 ("/* ---- Torre de Control: hoja tipo Excel", "torre"),
 ("/* ---- Liquidaciones: tabla compacta", "transporte"),
 ("/* ---- Detalle del viaje ----", "ui"),
 ("/* ---- Resumen global / tablero gerencial ----", "ui"),
 ("/* ---- Comercial ----", "comercial"),
 ("/* ---- Facturación: historial de lo enviado a facturar", "comercial"),
 ("/* ---- Tarifas ----", "comercial"),
 ("/* ---- Rutas (catálogo, solicitudes y seguimiento) ----", "transporte"),
 ("/* ---- Notificaciones (solo dentro de la aplicación) ----", "ui"),
 ("/* ---- Finanzas (Gerencia) ----", "finanzas"),
 ("/* ---- Órdenes de pago a proveedores (OPL)", "finanzas"),
 ("/* ---- Sección OPL (proveedores)", "finanzas"),
 ("/* ---- Usuarios y permisos ----", "admin"),
 ("/* ---- Auditoría ----", "admin"),
 ("/* ---- Modelo de datos ----", "admin"),
 ("/* =====================================================================\n   RENDER", "ui"),
 ("/* ---------- Eventos ---------- */", "ui"),
]
idx = []; pos = 0
for marca, mod in MARCADORES:
    k = t.index(marca, pos); idx.append((k, mod)); pos = k + 1

segs = {"ui": [t[:idx[0][0]]]}
for n, (k, mod) in enumerate(idx):
    fin = idx[n+1][0] if n+1 < len(idx) else len(t)
    segs.setdefault(mod, []).append(t[k:fin])

ACT_MOD = {
 "torreEstado":"torre","estadoRetry":"torre",
 "cobroOpen":"finanzas","cobroOk":"finanzas","aplicarTarifaViaje":"finanzas","aplicarTarifasTodas":"finanzas",
 "opSoloOpl":"finanzas","tarifaOpenOpl":"finanzas","tarifaSaveOpl":"finanzas","opTog":"finanzas","opClear":"finanzas",
 "opAbrir":"finanzas","opEmitir":"finanzas","opTransferOpen":"finanzas","opTransferOk":"finanzas",
 "opAnularOpen":"finanzas","opAnularOk":"finanzas","pagoOpen":"finanzas","pagoOk":"finanzas",
 "anularPagoOpen":"finanzas","anularPagoOk":"finanzas","finDet":"finanzas","importeOpen":"finanzas","importeOk":"finanzas",
 "exportFinXlsx":"finanzas","exportFinPdf":"finanzas",
 "facturaOpen":"comercial","facturaPrep":"comercial","facturaEnviar":"comercial","facturaEditar":"comercial",
 "facturaEditarGuardar":"comercial","facturaEditarEnviar":"comercial","emitirOpen":"comercial","emitirOk":"comercial",
 "evidenciaVer":"comercial","corregirOpen":"comercial","corregirOk":"comercial","anularOpen":"comercial","anularOk":"comercial",
 "agrDetalle":"comercial","factFase":"comercial","fcAddFecha":"comercial","fcQuitarFecha":"comercial",
 "exportFactXlsx":"comercial","exportFactPdf":"comercial","fcLimpiar":"comercial","fcQuitarViaje":"comercial",
 "cbToggle":"comercial","cbPick":"comercial","selClear":"comercial",
 "tarifaOpen":"comercial","tarifaSave":"comercial","tarifaEstado":"comercial",
 "clienteOpen":"comercial","clienteSave":"comercial","clienteEstado":"comercial","cliLimpiar":"comercial",
 "iniciarAsk":"transporte","iniciarOk":"transporte","finalizarAsk":"transporte","finalizarOk":"transporte",
 "enviarLiq":"transporte","aprobarAsk":"transporte","aprobarOk":"transporte","devolverOpen":"transporte","devolverSend":"transporte",
 "guardar":"transporte","otro":"transporte","terminar":"transporte","terminarOk":"transporte","ahora":"transporte",
 "limpiar":"transporte","editar":"transporte","editCancel":"transporte","editSave":"transporte",
 "rutaSolicitarOpen":"transporte","rutaSolicitarSave":"transporte","rutaRegistrarOpen":"transporte","rutaRegistrarSave":"transporte",
 "rutaValidarOpen":"transporte","rutaValidarOk":"transporte","rutaRechazarOpen":"transporte","rutaRechazarOk":"transporte",
 "rutaAprobarComOpen":"transporte","rutaAprobarComOk":"transporte","rutaAprobarTraOpen":"transporte","rutaAprobarTraOk":"transporte",
 "shipmentDupOpen":"transporte","shipmentDupOk":"transporte","limpiarRutas":"transporte",
 "usuarioOpen":"admin","usuarioSave":"admin","verificarAud":"admin","memOpen":"admin","memSave":"admin",
 "fleLoad":"admin","fleSync":"admin",
}

ui_txt = "".join(segs["ui"])
i0, i1 = find_object(ui_txt, "const ACT={")
metodos, _ = parse_methods(ui_txt, i0, i1)
print("  ACT: " + str(len(metodos)) + " metodos")
assert len(metodos) > 100, "muy pocos metodos: " + str(len(metodos))
ui_txt = ui_txt[:ui_txt.index("const ACT={")] + "const ACT={" + ui_txt[i1:]
assert ui_txt.count("const ACT={}") == 1

por_mod = {}
for nombre, cuerpo in metodos:
    por_mod.setdefault(ACT_MOD.get(nombre, "ui"), []).append(cuerpo)

cuerpo_ui = ",\n  ".join(por_mod.get("ui", []))
ui_txt = ui_txt.replace("const ACT={}", "const ACT={\n  " + cuerpo_ui + "\n}", 1)

os.makedirs(ruta("js", "modulos"), exist_ok=True)
encabezado = {
 "transporte": ("TRANSPORTE · viajes, liquidaciones y rutas", "Registrar/editar viajes, enviarlos a ruta, entregarlos, liquidar y gestionar rutas."),
 "torre": ("TORRE DE CONTROL", "Seguimiento de viajes en ruta: horas y estado Entregado."),
 "comercial": ("COMERCIAL · clientes, tarifas y facturación", "Clientes, tarifario del cliente y facturación."),
 "finanzas": ("FINANZAS · OPL, órdenes de pago y cobros", "Tarifas de proveedor (OPL), órdenes de pago y cobros."),
 "admin": ("ADMINISTRACIÓN · usuarios, auditoría y modelo", "Usuarios, permisos, auditoría, catálogos y modelo de datos."),
}
for mod, texto in segs.items():
    if mod == "ui": continue
    titulo, desc = encabezado[mod]
    out = "/* =====================================================================\n   MÓDULO: " + titulo + "\n   " + desc + "\n   ===================================================================== */\n\n" + "".join(texto).strip() + "\n"
    extra = por_mod.get(mod, [])
    if extra:
        out += "\n\n/* ---- Acciones (handlers) de este módulo ---- */\nObject.assign(ACT,{\n  " + ",\n  ".join(extra) + "\n});\n"
    open(ruta("js", "modulos", mod + ".js"), "w", encoding="utf-8", newline="\n").write(out)
    print("  escrito js/modulos/" + mod + ".js (" + str(out.count("\n") + 1) + " lineas)")

open(ruta("js", "ui.js"), "w", encoding="utf-8", newline="\n").write(ui_txt.strip() + "\n")
print("  escrito js/ui.js (" + str(ui_txt.count("\n") + 1) + " lineas)")

defs = {}
for nombre, _ in metodos:
    defs[nombre] = defs.get(nombre, 0) + 1
dups = [k for k, v in defs.items() if v > 1]
assert not dups, "metodos ACT duplicados: " + str(dups)
print("VERIFICACION: " + str(len(metodos)) + " metodos ACT repartidos, sin duplicados")
print("LISTO")
