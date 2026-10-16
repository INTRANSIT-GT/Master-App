import re

with open(r"C:\Users\manue\Master-App\js\ui.js", "r", encoding="utf-8") as f:
    code = f.read()

act_match = re.search(r'const ACT=\{(.*?)\n\};\n', code, re.DOTALL)
if not act_match:
    print("ACT block not found")
    exit()

act_body = act_match.group(1)

methods = {}
current_method = None
current_body = []
brace_count = 0
in_string = False
string_char = None
escape = False

i = 0
while i < len(act_body):
    c = act_body[i]
    if escape:
        current_body.append(c)
        escape = False
        i += 1
        continue
    if c == "\\":
        current_body.append(c)
        escape = True
        i += 1
        continue
    if in_string:
        current_body.append(c)
        if c == string_char:
            in_string = False
        i += 1
        continue
    if c in ("'", '"', '`'):
        in_string = True
        string_char = c
        current_body.append(c)
        i += 1
        continue

    if c == '{':
        brace_count += 1
        current_body.append(c)
    elif c == '}':
        brace_count -= 1
        current_body.append(c)
        if brace_count == 0 and current_method:
            methods[current_method] = "".join(current_body).strip()
            current_method = None
            current_body = []
            i += 1
            while i < len(act_body) and act_body[i] in (' ', '\n', '\t', '\r', ','):
                i += 1
            continue
    else:
        if brace_count == 0 and current_method is None:
            match = re.match(r'\s*(async\s+)?([a-zA-Z0-9_]+)\s*\(', act_body[i:])
            if match:
                current_method = match.group(2)
            current_body.append(c)
        else:
            current_body.append(c)
    i += 1

print("Parsed", len(methods), "methods from ACT.")
# print("Methods:", ", ".join(methods.keys()))
