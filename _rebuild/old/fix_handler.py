import re
with open(r"C:\Users\manue\Master-App\js\ui.js", "r", encoding="utf-8") as f:
    text = f.read()

# find body listeners
def rep(m):
    return m.group(0).replace(
        "if(e.target.id==='q')h=1;else if(e.target.id==='q_liq')h=2;else if(e.target.id==='q_com')h=3;",
        "if(e.target.id==='q')h=1;else if(e.target.id==='q_liq')h=2;else if(e.target.id==='q_com')h=3;else if(e.target.id==='qCli')h=5;"
    ).replace(
        "if(h===3){S.q_com=v;r=1;}",
        "if(h===3){S.q_com=v;r=1;}\n    if(h===5){S.qCli=v;r=1;}"
    )

text = re.sub(r'document\.body\.addEventListener\(\'input\',e=>\{.*?\n  \}\)', rep, text, flags=re.DOTALL)

with open(r"C:\Users\manue\Master-App\js\ui.js", "w", encoding="utf-8") as f:
    f.write(text)
