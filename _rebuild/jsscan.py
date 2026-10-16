# Analizador de bloques JavaScript (llaves) con soporte de cadenas, plantillas anidadas y expresiones regulares.
_ANTES = set("([{,;:=!&|?+-*%~^<>")

def _scan(s, i0):
    """Devuelve el indice del '}' que cierra la '{' en i0."""
    n = len(s)
    assert s[i0] == "{", s[i0:i0+40]
    stack = [["code", 0]]
    i = i0 + 1
    prev = "{"          # ultimo caracter significativo en contexto de codigo
    while i < n:
        fr = stack[-1]
        c = s[i]
        if fr[0] == "tmpl":
            if c == "\\": i += 2; continue
            if c == "`": stack.pop(); prev = "`"; i += 1; continue
            if c == "$" and i + 1 < n and s[i+1] == "{":
                stack.append(["code", 0]); i += 2; prev = "{"; continue
            i += 1; continue
        if c in " \t\r\n": i += 1; continue
        if c == "/" and i + 1 < n and s[i+1] == "/":
            j = s.find("\n", i); i = n if j < 0 else j + 1; continue
        if c == "/" and i + 1 < n and s[i+1] == "*":
            j = s.find("*/", i + 2); i = n if j < 0 else j + 2; continue
        if c in "\"'":
            q = c; i += 1
            while i < n:
                if s[i] == "\\": i += 2; continue
                if s[i] == q: i += 1; break
                i += 1
            prev = q; continue
        if c == "`":
            stack.append(["tmpl", 0]); i += 1; prev = "`"; continue
        if c == "/" and prev in _ANTES:
            # expresion regular
            i += 1; clase = False
            while i < n:
                d = s[i]
                if d == "\\": i += 2; continue
                if d == "[": clase = True; i += 1; continue
                if d == "]": clase = False; i += 1; continue
                if d == "/" and not clase: i += 1; break
                if d == "\n": break
                i += 1
            while i < n and s[i].isalpha(): i += 1
            prev = "r"; continue
        if c == "{":
            if fr[0] == "code": fr[1] += 1
            prev = "{"; i += 1; continue
        if c == "}":
            if fr[1] == 0:
                stack.pop()
                if not stack: return i
                prev = "}"; i += 1; continue
            fr[1] -= 1; prev = "}"; i += 1; continue
        prev = c; i += 1
    raise ValueError("no cierra")


def find_object(s, start_pat):
    i = s.index(start_pat)
    j = s.index("{", i + len(start_pat) - 1)
    return j, _scan(s, j)


def parse_methods(s, obj_open, obj_close):
    """Lista de (nombre, texto) de los metodos de primer nivel del objeto."""
    import re
    base = obj_open + 1
    body = s[base:obj_close]
    pat = re.compile(r"(?:^|\n)  (?:async\s+)?([A-Za-z0-9_]+)\s*\(")
    out = []
    prev_end = -1
    for m in pat.finditer(body):
        ini = m.start() + (1 if m.group(0).startswith("\n") else 0)
        if ini <= prev_end:
            continue
        name = m.group(1)
        p = base + m.end() - 1
        d = 0
        while p < len(s):
            if s[p] == "(": d += 1
            elif s[p] == ")":
                d -= 1
                if d == 0: break
            p += 1
        q = p + 1
        while q < len(s) and s[q] in " \t\r\n": q += 1
        if s[q] != "{":
            continue
        r = _scan(s, q)
        out.append((name, s[base + ini:r + 1].strip()))
        prev_end = r - base
    return out, obj_close
