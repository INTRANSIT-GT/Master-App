"""EOS · abre sesiones de Claude listas para trabajar en In Transit, con un solo clic.

Vive dentro de cada repositorio (eos/) para que cualquier operador lo reciba con git clone o rebase.
Los repositorios quedan juntos en la carpeta que contiene a este repo; lo propio de cada equipo
(última elección, manifiesto, registros, respaldos) va en <carpeta>/.eos, fuera de todo repositorio.

Al arrancar muestra un menú ASCII con el estado de cada repositorio y pregunta:
quién trabaja, qué abrir (OP, Transportes o los dos) y cómo. Enter repite la última elección.

Con cada repositorio elegido, en orden:
  1. Recarga el PATH desde Windows y comprueba Node, Git, Supabase CLI, GitHub CLI y VS Code
     (instala Node y Git con winget si faltan).
  2. Clona el repositorio o lo actualiza (solo fast-forward y si no hay cambios propios).
  3. Inyecta el kit de Claude desde eos/plantillas (reglas, hook de inicio, skills, documentos de estado)
     y copia eos/ al otro repositorio si el suyo es más viejo. Actualiza lo que EOS instaló y nadie tocó;
     nunca pisa un archivo modificado (salvo --forzar, que respalda).
  4. Declara el operador y abre su bitácora privada del día en .claude/privado (ignorado por Git).
  5. Instala dependencias npm faltantes o desactualizadas (no en modo rápido) y prueba el hook.
     Qué necesita cada repo (npm, herramientas, servicios) está en eos/dependencias.json.
  6. Revisa dependencias, herramientas y Git; si algo falta, avisa y deja el prompt de sincronización
     para Claude en .claude/privado/sync.md (y en el portapapeles).
  7. Abre VS Code.

No hace commits, push ni toca Supabase.
Opciones: --operador=ID  --repos=op|transportes|todos  --modo=completo|rapido|preparar
          --sin-menu  --menu  --forzar  --sin-abrir  --sin-pausa
"""
import datetime
import hashlib
import json
import os
import re
import shutil
import socket
import subprocess
import sys
import unicodedata
from pathlib import Path

VERSION = "2026.10.25.3"
EOS_DIR = Path(__file__).resolve().parent
REPOS = EOS_DIR.parent.parent
PRIVADO = REPOS / ".eos"
KIT = EOS_DIR / "plantillas"
PERFILES = EOS_DIR / "perfiles.json"
LOCAL = PRIVADO / "local"
REGISTROS = PRIVADO / "registros"
RESPALDOS = PRIVADO / "respaldos"

APPS = [
    {"clave": "op", "titulo": "OP (Operaciones)", "nombre": "Master-App---OP-",
     "url": "https://github.com/INTRANSIT-GT/Master-App---OP-"},
    {"clave": "transportes", "titulo": "Transportes (Master App)", "nombre": "Master-App",
     "url": "https://github.com/INTRANSIT-GT/Master-App"},
]
DEPENDENCIAS = EOS_DIR / "dependencias.json"   # npm, herramientas y servicios de cada repo (versionado)
OPERADORES = [
    {"id": "carmen", "nombre": "Carmen", "trato": "Ing. Carmen", "activo": True},
    {"id": "nora", "nombre": "NORA", "trato": "NORA", "activo": False},
]
MODOS = {
    "completo": "Completo: actualizar, kit, npm, probar y abrir",
    "rapido": "Rápido: kit y abrir (sin actualizar ni npm)",
    "preparar": "Solo preparar: completo, sin abrir VS Code",
}
HOOK = {"type": "command", "command": "node",
        "args": ["${CLAUDE_PROJECT_DIR}/scripts/intransit-startup.cjs"], "timeout": 10}
GITIGNORE = ["# Claude: configuración personal y recibos privados (nunca al repositorio)",
             ".claude/settings.local.json", ".claude/privado/"]
ANCHO = 66

ARGS = dict((a.split("=", 1) + [True])[:2] for a in sys.argv[1:])
AHORA = datetime.datetime.now()
log, problemas = [], []
avisos, faltan_globales = {}, []   # avisos por repositorio y herramientas opcionales ausentes, para el prompt
app_actual = None


def say(estado, texto):
    linea = f"[{estado:^5}] {texto}"
    print(linea, flush=True)
    log.append(linea)
    if estado in ("ERROR", "!!"):
        problemas.append(texto)
        avisos.setdefault(app_actual, []).append(texto.strip())


def run(cmd, cwd=None, entrada=None, timeout=900):
    return subprocess.run(cmd, cwd=cwd, input=entrada, capture_output=True, text=True,
                          encoding="utf-8", errors="replace", timeout=timeout)


def sha(ruta):
    return hashlib.sha256(ruta.read_bytes()).hexdigest()


def leer_json(ruta, defecto):
    try:
        return json.loads(ruta.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return defecto


def guardar_json(ruta, datos):
    ruta.parent.mkdir(parents=True, exist_ok=True)
    ruta.write_text(json.dumps(datos, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def version_de(script):
    """VERSION de otro EOS.py como tupla comparable; () si no existe."""
    try:
        m = re.search(r'^VERSION = "([\d.]+)"', script.read_text(encoding="utf-8"), re.M)
    except OSError:
        return ()
    return tuple(int(x) for x in m.group(1).split(".")) if m else ()


def deps(nombre):
    """Sección de eos/dependencias.json: 'comun' o el nombre del repositorio."""
    return leer_json(DEPENDENCIAS, {}).get(nombre, {})


def encontrar(h):
    """Ruta del comando de una herramienta: en el PATH o en sus rutas conocidas (que se suman al PATH)."""
    exe = shutil.which(h["comando"])
    if exe:
        return exe
    for carpeta in h.get("rutas", []):
        if shutil.which(h["comando"], path=carpeta):
            os.environ["PATH"] = str(Path(carpeta)) + os.pathsep + os.environ["PATH"]   # VS Code lo hereda
            return shutil.which(h["comando"])
    return None


def como_instalar(h):
    return f" (winget install -e --id {h['winget']})" if h.get("winget") else ""


def escucha(puerto):
    try:
        with socket.create_connection(("127.0.0.1", puerto), timeout=1):
            return True
    except OSError:
        return False


def estado_npm(carpeta):
    """None si está al día; 'falta' o 'vieja' (package-lock.json más nuevo que lo instalado)."""
    if not (carpeta / "package.json").exists():
        return None
    if not (carpeta / "node_modules").exists():
        return "falta"
    lock, instalado = carpeta / "package-lock.json", carpeta / "node_modules" / ".package-lock.json"
    if lock.exists() and (not instalado.exists() or lock.stat().st_mtime > instalado.stat().st_mtime):
        return "vieja"
    return None


# ---------------------------------------------------------------- menú ASCII

def leer(texto):
    """input() que no revienta si la entrada se acaba (devuelve None)."""
    try:
        return input(texto).strip()
    except EOFError:
        return None


def borde(c="-"):
    return "+" + c * (ANCHO - 2) + "+"


def fila(texto=""):
    return "| " + texto[:ANCHO - 4].ljust(ANCHO - 4) + " |"


def estado_repo(app):
    raiz = REPOS / app["nombre"]
    if not (raiz / ".git").exists():
        return ["-", "-", "-", "no clonado"]
    git = shutil.which("git")

    def g(*args):
        r = run([git, "-C", str(raiz), *args], timeout=10) if git else None
        return r.stdout.strip() if r and r.returncode == 0 else None

    cambios = g("status", "--porcelain")
    dias = sorted((raiz / ".claude" / "privado" / "bitacora").glob("????-??-??.md"))
    ultima = dias[-1].stem if dias else None
    npm = "!" if any(estado_npm(raiz / sub) for sub in deps(app["nombre"]).get("npm", [])) else ""
    return [(g("branch", "--show-current") or "?")[:7], g("rev-parse", "--short", "HEAD") or "?",
            ("?" if cambios is None else str(len(cambios.splitlines()))) + npm,
            "hoy" if ultima == f"{AHORA:%Y-%m-%d}" else (ultima or "sin bitácora")]


def pantalla(elegido=()):
    if sys.stdout.isatty():
        os.system("cls" if os.name == "nt" else "clear")
    titulo, fecha = "EOS  -  In Transit", f"{AHORA:%Y-%m-%d %H:%M}"
    print(borde("="))
    print(fila(titulo + fecha.rjust(ANCHO - 4 - len(titulo))))
    print(fila("Sesiones de Claude listas para trabajar"))
    print(borde("="))
    print(fila(f"{'REPOSITORIO':<25}{'RAMA':<8}{'REV':<9}{'CAMBIOS':<8}BITÁCORA"))
    print(borde())
    marcas = False
    for app in APPS:
        rama, rev, cambios, bitacora = estado_repo(app)
        marcas = marcas or cambios.endswith("!")
        print(fila(f"{app['titulo']:<25}{rama:<8}{rev:<9}{cambios:<8}{bitacora}"))
    print(borde())
    if marcas:
        print("  ! = faltan dependencias npm o están desactualizadas")
    for etiqueta, valor in elegido:
        print(f"  {etiqueta:<9} {valor}")


def preguntar(titulo, opciones, defecto=None, extras=()):
    """opciones: [(clave, texto, nota)]. Devuelve la clave, la tecla extra, o None para salir."""
    print(f"\n  {titulo}\n")
    teclas = {}
    ancho = max(len(texto) for _, texto, _ in opciones) + 3
    for i, (clave, texto, nota) in enumerate(opciones, 1):
        teclas[str(i)] = clave
        marca = "<- Enter" if clave == defecto else ""
        print(f"    [{i}] {texto:<{ancho}}{(nota + '  ' if nota else '')}{marca}".rstrip())
    for tecla, texto in extras:
        teclas[tecla] = tecla
        print(f"    [{tecla}] {texto}")
    print("    [Q] Salir")
    pista = next((f"  (Enter = {t})" for t, c in teclas.items() if c == defecto), "")
    while True:
        r = leer(f"\n  >{pista} ")
        if r is None or r.upper() == "Q":
            return None
        if not r and pista:
            return defecto
        if r.upper() in teclas:
            return teclas[r.upper()]
        print("    Opción no válida.")


def slug(nombre):
    plano = unicodedata.normalize("NFKD", nombre).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", plano.lower()).strip("-")


def alta(perfiles):
    """Dar de alta a un operador pendiente (NORA) o a uno nuevo. Lo hace Carmen."""
    pantalla([("Alta", "operador nuevo o pendiente")])
    pendientes = [o for o in perfiles["operadores"] if not o["activo"]]
    r = preguntar("¿A quién se da de alta?",
                  [(o["id"], o["nombre"], "pendiente") for o in pendientes] + [("nuevo", "Operador nuevo", "")])
    if r is None:
        return
    if r == "nuevo":
        nombre = leer("    Nombre: ")
        if not nombre or not slug(nombre):
            return
        operador = {"id": slug(nombre), "nombre": nombre, "trato": nombre, "activo": False}
        if any(o["id"] == operador["id"] for o in perfiles["operadores"]):
            leer(f"    Ya existe un operador «{operador['id']}». Enter para volver...")
            return
    else:
        operador = next(o for o in pendientes if o["id"] == r)
    trato = leer(f"    ¿Cómo debe tratarle Claude? (Enter = {operador['trato']}): ")
    if trato is None:
        return
    if (leer(f"    Confirmar alta de {operador['nombre']} como «{trato or operador['trato']}» [S/N]: ")
            or "").upper() != "S":
        return
    operador.update(trato=trato or operador["trato"], activo=True)
    if operador not in perfiles["operadores"]:
        perfiles["operadores"].append(operador)
    # perfiles.json es el mismo en los dos repositorios: queda pendiente de commit en cada uno
    for destino in {PERFILES, *(REPOS / a["nombre"] / "eos" / "perfiles.json" for a in APPS)}:
        if destino.parent.exists():
            guardar_json(destino, perfiles)
    say("OK", f"alta de operador: {operador['nombre']} ({operador['id']}); falta commit de eos/perfiles.json")


def repos_de(valor):
    claves = {a["clave"] for a in APPS} if valor == "todos" else set(str(valor).split(","))
    apps = [a for a in APPS if a["clave"] in claves]
    return apps if apps and len(apps) == len(claves) else None


def menu(perfiles, op_def, repos_def, modo_def):
    while True:
        pantalla()
        r = preguntar("1/3  ¿Quién trabaja?",
                      [(o["id"], o["trato"], "" if o["activo"] else "pendiente de alta")
                       for o in perfiles["operadores"]],
                      op_def, [("A", "Dar de alta a un operador (lo hace Carmen)")])
        if r is None:
            return None
        if r == "A":
            alta(perfiles)
            continue
        operador = next(o for o in perfiles["operadores"] if o["id"] == r)
        if not operador["activo"]:
            leer(f"\n    {operador['nombre']} todavía no tiene alta: usar [A]. Enter para volver...")
            continue
        op_def = r
        elegido = [("Operador", operador["trato"])]

        pantalla(elegido)
        repos = preguntar("2/3  ¿Qué abrir?",
                          [(a["clave"], a["titulo"], "") for a in APPS] + [("todos", "Los dos", "")],
                          repos_def if repos_de(repos_def) else None)
        if repos is None:
            return None
        repos_def = repos
        elegido.append(("Abrir", ", ".join(a["titulo"] for a in repos_de(repos))))

        pantalla(elegido)
        modo = preguntar("3/3  ¿Cómo?", [(k, v, "") for k, v in MODOS.items()],
                         modo_def if modo_def in MODOS else None)
        if modo is None:
            return None
        modo_def = modo
        elegido.append(("Modo", MODOS[modo]))

        pantalla(elegido)
        r = leer("\n  Enter = lanzar    [V] volver a empezar    [Q] salir\n\n  > ")
        if r is None or r.upper() == "Q":
            return None
        if r.upper() != "V":
            return operador, repos, modo


def elegir(perfiles, ultima):
    """Devuelve (operador, repos, modo) desde el menú o desde las opciones; None si se cancela."""
    op_def = ARGS.get("--operador") or ultima.get("operador") or next(
        (o["id"] for o in perfiles["operadores"] if o["activo"]), None)
    repos_def = ARGS.get("--repos") or ultima.get("repos") or "todos"
    modo_def = ARGS.get("--modo") or ultima.get("modo") or "completo"
    dados = all(isinstance(ARGS.get(k), str) for k in ("--operador", "--repos", "--modo"))
    if not dados and "--sin-menu" not in ARGS and ("--menu" in ARGS or sys.stdin.isatty()):
        return menu(perfiles, op_def, repos_def, modo_def)
    operador = next((o for o in perfiles["operadores"] if o["id"] == op_def), None)
    if not operador or not operador["activo"]:
        say("ERROR", f"operador «{op_def}» no existe o no tiene alta (ver eos/perfiles.json)")
    elif not repos_de(repos_def):
        say("ERROR", f"--repos={repos_def} no es válido (op, transportes o todos)")
    elif modo_def not in MODOS:
        say("ERROR", f"--modo={modo_def} no es válido ({', '.join(MODOS)})")
    else:
        return operador, repos_def, modo_def
    return None


# ---------------------------------------------------------------- preparación

def recargar_path():
    """El PATH que heredan VS Code y las terminales puede ser viejo: se relee del registro."""
    import winreg
    partes = []
    for raiz, sub in ((winreg.HKEY_LOCAL_MACHINE, r"SYSTEM\CurrentControlSet\Control\Session Manager\Environment"),
                      (winreg.HKEY_CURRENT_USER, "Environment")):
        try:
            with winreg.OpenKey(raiz, sub) as k:
                partes.append(os.path.expandvars(winreg.QueryValueEx(k, "Path")[0]))
        except OSError:
            pass
    os.environ["PATH"] = ";".join(partes)


def herramientas(rapido):
    print("\n== 1. Herramientas")
    recargar_path()
    lista = deps("comun").get("herramientas", [])
    if not lista:
        say("!!", "eos/dependencias.json no encontrado o sin herramientas: no se revisaron")
    for h in lista:
        if h.get("obligatoria") and h.get("winget") and not encontrar(h) and shutil.which("winget"):
            say("..", f"{h['comando']} no está: instalando con winget")
            run(["winget", "install", "--id", h["winget"], "-e", "--silent",
                 "--accept-package-agreements", "--accept-source-agreements"])
            recargar_path()
    for h in lista:
        exe = encontrar(h)
        if not exe:
            if h.get("opcional"):
                say("..", f"{h['comando']}: no instalado (opcional)")
                continue
            say("ERROR" if h.get("obligatoria") else "!!", f"{h['comando']}: no encontrado")
            faltan_globales.append(f"{h['para']}: no instalado{como_instalar(h)}")
            continue
        if not rapido:
            salida = run([exe, "--version"], timeout=30).stdout.strip().splitlines()
            say("OK", f"{h['comando']}: {salida[0] if salida else 'instalado'}")
    if rapido:
        say("OK", "herramientas revisadas (modo rápido: sin versiones)")
    github()
    return bool(shutil.which("git") and shutil.which("node"))


def github():
    """Sesión de GitHub: gh con login y git usando esa misma sesión (no imprime el token)."""
    gh, git = shutil.which("gh"), shutil.which("git")
    if not gh or not git:
        return
    if run([gh, "auth", "status", "--hostname", "github.com"], timeout=20).returncode != 0:
        say("!!", "GitHub: gh sin sesión")
        faltan_globales.append(f"GitHub sin sesión: {deps('comun').get('github', 'gh auth login --web')}")
        return
    ayudante = run([git, "config", "--global", "--get-all", "credential.https://github.com.helper"], timeout=10)
    if "gh" in ayudante.stdout:
        say("OK", "GitHub: sesión activa y git la usa")
    else:
        say("!!", "GitHub: git no usa la sesión de gh")
        faltan_globales.append("git no usa la sesión de GitHub CLI: gh auth setup-git")


def repositorio(app, actualizar):
    raiz = REPOS / app["nombre"]
    git = shutil.which("git")
    if not (raiz / ".git").exists():
        REPOS.mkdir(parents=True, exist_ok=True)
        r = run([git, "clone", "-q", app["url"], str(raiz)])
        say("OK" if r.returncode == 0 else "ERROR", f"clonado {app['nombre']}" if r.returncode == 0 else r.stderr.strip())
        return raiz if r.returncode == 0 else None
    if actualizar:
        # git rechaza por sí mismo un fast-forward que pisaría cambios locales
        r = run([git, "-C", str(raiz), "pull", "--ff-only", "-q"], timeout=120)
        say("OK" if r.returncode == 0 else "!!", f"{app['nombre']}: actualizado" if r.returncode == 0
            else f"{app['nombre']}: no se pudo actualizar ({r.stderr.strip()[:120]})")
    sha_corto = run([git, "-C", str(raiz), "rev-parse", "--short", "HEAD"]).stdout.strip()
    say("OK", f"{app['nombre']} en {sha_corto}")
    return raiz


def copiar(origen, destino, rel, vivo, manifiesto, clave):
    """manifiesto guarda el hash de lo que EOS instaló: si el destino sigue igual, se puede actualizar."""
    nuevo = sha(origen)
    if not destino.exists():
        destino.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(origen, destino)
        say("OK", f"  + {rel}")
    elif sha(destino) == nuevo:
        pass
    elif vivo:
        say("OK", f"  = {rel} (documento vivo, se conserva)")
        return
    elif manifiesto.get(clave) == sha(destino):
        shutil.copy2(origen, destino)
        say("OK", f"  ^ {rel} (kit actualizado)")
    elif "--forzar" in ARGS:
        respaldo = RESPALDOS / AHORA.strftime("%Y%m%d-%H%M%S") / destino.relative_to(REPOS)
        respaldo.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(destino, respaldo)
        shutil.copy2(origen, destino)
        say("OK", f"  ~ {rel} (reemplazado; respaldo en {respaldo.relative_to(REPOS)})")
    else:
        say("!!", f"  {rel} fue modificado: se conserva (usar --forzar para reemplazarlo)")
        return
    if not vivo:
        manifiesto[clave] = nuevo


def destino_kit(rel):
    """En las plantillas, _claude y CLAUDE.plantilla.md evitan que Claude Code las tome por la configuración real."""
    partes = [".claude" if p == "_claude" else p for p in rel.parts]
    partes[-1] = "CLAUDE.md" if partes[-1] == "CLAUDE.plantilla.md" else partes[-1]
    return Path(*partes)


def inyectar(app, raiz, manifiesto):
    archivos = []
    for origen in (KIT / "comun", KIT / app["nombre"]):
        archivos += [(f, destino_kit(f.relative_to(origen))) for f in sorted(origen.rglob("*")) if f.is_file()]
    # EOS mismo viaja en los dos repositorios; nunca se copia uno más viejo encima de uno más nuevo
    if raiz != EOS_DIR.parent:
        otro = version_de(raiz / "eos" / "EOS.py")
        if otro > version_de(Path(__file__)):
            say("!!", f"  eos/ de {app['nombre']} es más nuevo: correr EOS desde ese repositorio")
        else:
            archivos += [(f, "eos" / f.relative_to(EOS_DIR)) for f in sorted(EOS_DIR.rglob("*"))
                         if f.is_file() and "__pycache__" not in f.parts]
    for f, rel in archivos:
        vivo = rel.parts[:2] == ("docs", "ai") or rel.as_posix() == "eos/perfiles.json"
        copiar(f, raiz / rel, rel.as_posix(), vivo, manifiesto, f"{app['nombre']}/{rel.as_posix()}")

    # hook: se combina con lo que ya tenga settings.json
    ajustes = raiz / ".claude" / "settings.json"
    datos = {}
    if ajustes.exists():
        try:
            datos = json.loads(ajustes.read_text(encoding="utf-8"))
        except ValueError:
            say("ERROR", "  .claude/settings.json no es JSON válido: no se tocó")
            return
    grupos = datos.setdefault("hooks", {}).setdefault("SessionStart", [])
    if not any("intransit-startup.cjs" in " ".join(h.get("args", [])) + h.get("command", "")
               for g in grupos for h in g.get("hooks", [])):
        grupos.append({"hooks": [HOOK]})
        guardar_json(ajustes, datos)
        say("OK", "  + hook SessionStart en .claude/settings.json")

    ignore = raiz / ".gitignore"
    actual = ignore.read_text(encoding="utf-8").splitlines() if ignore.exists() else []
    faltan = [l for l in GITIGNORE if l not in actual]
    if faltan:
        with ignore.open("a", encoding="utf-8", newline="\n") as fh:
            fh.write(("\n" if actual and actual[-1] else "") + "\n".join(faltan) + "\n")
        say("OK", "  + rutas privadas en .gitignore")


def declarar_operador(raiz, operador, modo):
    """operador.json y la bitácora del día quedan en .claude/privado: ignorados por Git, propios de este equipo."""
    privado = raiz / ".claude" / "privado"
    guardar_json(privado / "operador.json", {k: operador[k] for k in ("id", "nombre", "trato")}
                 | {"desde": AHORA.isoformat(timespec="seconds")})
    dia = privado / "bitacora" / f"{AHORA:%Y-%m-%d}.md"
    nuevo = not dia.exists()
    dia.parent.mkdir(parents=True, exist_ok=True)
    rev = run([shutil.which("git"), "-C", str(raiz), "rev-parse", "--short", "HEAD"]).stdout.strip()
    with dia.open("a", encoding="utf-8", newline="\n") as fh:
        if nuevo:
            fh.write(f"# Bitácora privada · {raiz.name} · {AHORA:%Y-%m-%d}\n\n"
                     "Fuera de Git. Al cerrar, resumen público con la skill intransit-bitacora.\n\n")
        fh.write(f"- {AHORA:%H:%M} · INICIO · {operador['trato']} abre sesión con EOS (modo {modo}, rev {rev})\n")
    say("OK", f"  operador {operador['nombre']} · bitácora {dia.relative_to(raiz).as_posix()}")


def dependencias(app, raiz):
    npm = shutil.which("npm")
    for sub in deps(app["nombre"]).get("npm", []):
        carpeta = raiz / sub
        if not estado_npm(carpeta):
            continue
        orden = "ci" if (carpeta / "package-lock.json").exists() else "install"
        say("..", f"  npm {orden} en {app['nombre']}/{sub} (puede tardar)")
        r = run([npm, orden, "--no-fund", "--no-audit"], cwd=carpeta)
        say("OK" if r.returncode == 0 else "ERROR", f"  dependencias {sub}" if r.returncode == 0
            else f"  npm falló en {sub}: {r.stderr.strip()[-200:]}")


def probar_hook(app, raiz):
    entrada = json.dumps({"hook_event_name": "SessionStart", "source": "startup"})
    r = run([shutil.which("node"), str(raiz / "scripts" / "intransit-startup.cjs")], entrada=entrada, timeout=15)
    try:
        recibo = json.loads(r.stdout.splitlines()[0])
        faltan = recibo.get("missing", [])
        say("OK" if not faltan else "!!", f"  hook responde ({len(r.stdout)} caracteres, operador "
            f"{recibo.get('operator', 'NO_DECLARADO')})" + (f", faltan: {', '.join(faltan)}" if faltan else ""))
    except (ValueError, IndexError):
        say("ERROR", f"  el hook no devolvió un recibo válido: {r.stderr.strip()[:200]}")


def revisar(app, raiz, rapido):
    """Lo que falta para trabajar en sincronía. Avisa cada dependencia; devuelve todo para el prompt."""
    previos = list(avisos.get(app["clave"], []))
    d = deps(app["nombre"])
    faltas = []
    for sub in d.get("npm", []):
        estado = estado_npm(raiz / sub)
        lugar = "la raíz" if sub == "." else sub
        if estado == "falta":
            faltas.append(f"dependencias npm sin instalar en {lugar} (npm ci)")
        elif estado == "vieja":
            faltas.append(f"dependencias npm desactualizadas en {lugar}: cambió package-lock.json (npm ci)")
    faltas += [f"{h['para']}: no instalado{como_instalar(h)}"
               for h in d.get("herramientas", []) if not h.get("opcional") and not encontrar(h)]
    faltas += [f"{s['para']}: no responde" for s in d.get("servicios", []) if not escucha(s["puerto"])]
    for f in faltas:
        say("!!", f"  {f}")

    git = shutil.which("git")
    cuenta = run([git, "-C", str(raiz), "rev-list", "--left-right", "--count", "@{u}...HEAD"], timeout=10)
    if cuenta.returncode == 0:
        atras, adelante = (int(x) for x in cuenta.stdout.split())
        donde = " (según el último fetch)" if rapido else ""
        if atras:
            faltas.append(f"Git: {atras} commit(s) del remoto sin traer{donde}")
        if adelante:
            faltas.append(f"Git: {adelante} commit(s) locales sin subir")
    cambios = run([git, "-C", str(raiz), "status", "--porcelain"], timeout=10).stdout.splitlines()
    if cambios:
        faltas.append(f"Git: {len(cambios)} archivo(s) con cambios sin commit")
    return faltas + previos + faltan_globales


def prompt_sync(app, raiz, operador, modo, faltas):
    """El texto que el operador pega en su sesión de Claude para ponerla en sincronía."""
    rev = run([shutil.which("git"), "-C", str(raiz), "rev-parse", "--short", "HEAD"]).stdout.strip()
    lineas = [f"Soy {operador['trato']}. EOS preparó esta sesión en {app['titulo']} "
              f"({AHORA:%Y-%m-%d %H:%M}, modo {modo}, rev {rev}). Ponte en sincronía antes de trabajar:",
              "1. Lee AGENTS.md, docs/ai/ESTADO.md y docs/ai/TRASPASO.md y confirma el recibo de inicio."]
    if faltas:
        lineas += ["2. EOS detectó esto pendiente (lista completa en eos/dependencias.json):"]
        lineas += [f"   - {f}" for f in dict.fromkeys(faltas)]
        if deps(app["nombre"]).get("base"):
            lineas.append(f"   Base de datos del proyecto: {deps(app['nombre'])['base']}")
        lineas += [
            "3. Instala lo local y reversible (npm ci en las carpetas indicadas) y compruébalo con las pruebas",
            "   del proyecto. Para herramientas del sistema (PostgreSQL, Docker, CLIs) dame los pasos y espera",
            "   mi autorización.",
            "4. Antes de pull, rebase o tocar cambios sin commit, explícame la situación. Sin commit ni push",
            "   salvo que lo pida.",
            "5. Anota lo hecho y lo pendiente en la bitácora del día (skill intransit-bitacora)."]
    else:
        lineas.append("2. EOS no detectó pendientes: dame el estado en una línea y sigamos con la "
                      "siguiente acción de ESTADO.md.")
    texto = "\n".join(lineas) + "\n"
    ruta = raiz / ".claude" / "privado" / "sync.md"
    ruta.write_text(texto, encoding="utf-8")
    return texto, ruta


def portapapeles(ruta):
    r = run(["powershell", "-NoProfile", "-Command",
             f"Get-Content -Raw -Encoding UTF8 -LiteralPath '{ruta}' | Set-Clipboard"], timeout=30)
    return r.returncode == 0


def acceso_directo():
    escritorio = Path(os.environ.get("USERPROFILE", "")) / "Desktop"
    lnk = escritorio / "EOS - In Transit.lnk"
    lanzador = EOS_DIR / "EOS.cmd"
    if lnk.exists() or not lanzador.exists() or not escritorio.exists():
        return
    ps = (f"$s=(New-Object -ComObject WScript.Shell).CreateShortcut('{lnk}');"
          f"$s.TargetPath='{lanzador}';$s.WorkingDirectory='{EOS_DIR}';$s.Save()")
    r = run(["powershell", "-NoProfile", "-Command", ps], timeout=30)
    say("OK" if r.returncode == 0 else "!!", "acceso directo en el escritorio: EOS - In Transit"
        if r.returncode == 0 else "no se pudo crear el acceso directo")


def lanzar(operador, repos, modo):
    global app_actual
    print(f"\nEOS {VERSION} · {operador['trato']} · modo {modo} · {AHORA:%Y-%m-%d %H:%M}")
    say("OK", f"operador {operador['id']} · repos {repos} · modo {modo}")
    if not herramientas(modo == "rapido"):
        return
    manifiesto = leer_json(LOCAL / "manifiesto.json", {})
    raices, prompts = [], []
    for app in repos_de(repos):
        app_actual = app["clave"]
        print(f"\n== {app['titulo']} · {app['nombre']}")
        raiz = repositorio(app, modo != "rapido")
        if raiz:
            inyectar(app, raiz, manifiesto)
            declarar_operador(raiz, operador, modo)
            if modo != "rapido":
                dependencias(app, raiz)
            probar_hook(app, raiz)
            faltas = revisar(app, raiz, modo == "rapido")
            prompts.append((app, *prompt_sync(app, raiz, operador, modo, faltas), bool(faltas)))
            raices.append(raiz)
    app_actual = None
    guardar_json(LOCAL / "manifiesto.json", manifiesto)

    copiado = None
    for app, texto, ruta, pendiente in prompts:
        if not pendiente:
            print(f"\n  {app['titulo']}: sin pendientes. Prompt en {ruta.relative_to(REPOS).as_posix()}")
            continue
        print(f"\n+-- PROMPT PARA CLAUDE · {app['titulo']} ".ljust(ANCHO - 1, "-") + "+")
        print(texto.rstrip())
        print(borde())
        if copiado is None and portapapeles(ruta):
            copiado = app
            print("  Copiado al portapapeles: pegarlo en Claude Code con Ctrl+V.")
        print(f"  Guardado en {ruta.relative_to(REPOS).as_posix()}")

    print()
    acceso_directo()
    code = shutil.which("code")
    if raices and code and modo != "preparar" and "--sin-abrir" not in ARGS:
        for raiz in raices:
            subprocess.Popen([code, "-n", str(raiz)], env=os.environ)
        say("OK", "VS Code abierto: abrir Claude Code y empezar (el recibo ya trae operador y bitácora)")


def main():
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    recargar_path()
    perfiles = leer_json(PERFILES, None)
    if not perfiles:
        perfiles = {"operadores": [dict(o) for o in OPERADORES]}
        guardar_json(PERFILES, perfiles)
    ultima = leer_json(LOCAL / "ultima.json", {})

    eleccion = elegir(perfiles, ultima)
    if eleccion:
        operador, repos, modo = eleccion
        guardar_json(LOCAL / "ultima.json", {"operador": operador["id"], "repos": repos, "modo": modo})
        lanzar(operador, repos, modo)
    elif not problemas:
        print("\nSalida sin cambios.")
        return 0

    print("\n" + ("LISTO." if not problemas else f"TERMINÓ CON {len(problemas)} AVISO(S):"))
    for p in problemas:
        print(f"  - {p}")
    REGISTROS.mkdir(parents=True, exist_ok=True)
    (REGISTROS / f"eos-{AHORA:%Y%m%d-%H%M%S}.txt").write_text("\n".join(log) + "\n", encoding="utf-8")
    for viejo in sorted(REGISTROS.glob("eos-*.txt"))[:-20]:
        viejo.unlink()
    if "--sin-pausa" not in ARGS:
        leer("\nEnter para cerrar...")
    return 1 if any("ERROR" in l[:8] for l in log) else 0


if __name__ == "__main__":
    sys.exit(main())
