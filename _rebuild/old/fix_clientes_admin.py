import re
with open(r"C:\Users\manue\Master-App\js\ui.js", "r", encoding="utf-8") as f:
    text = f.read()

# 1. Hacer que la columna Acciones sea sticky (stkR)
text = text.replace(
    "const cab=['ID cliente','Cliente','Cliente padre','Servicio','Nombre usuario','Correo','Teléfono','Link contrato','NIT','Proyecto','Estado','Creado','Acciones'];",
    "const cab=['ID cliente','Cliente','Cliente padre','Servicio','Nombre usuario','Correo','Teléfono','Link contrato','NIT','Proyecto','Estado','Creado','Acciones'];"
)
# Actually replace the th generation to add class="stkR" if it's 'Acciones'
text = text.replace(
    "${cab.map(h=>`<th>${h}</th>`).join('')}",
    "${cab.map(h=>`<th${h==='Acciones'?' class=\"stkR\"':''}>${h}</th>`).join('')}"
)
text = text.replace(
    "<td style=\"white-space:nowrap\">${gest?`<button class=\"btn sm\" data-act=\"clienteOpen\"",
    "<td class=\"stkR\" style=\"white-space:nowrap\">${gest?`<button class=\"btn sm\" data-act=\"clienteOpen\""
)

# 2. Agregar soporte para multiselect en fieldM
multiselect_code = """  if(f.type==='multiselect'){const op=f.optsFn?f.optsFn(data):(f.opts||[]);return `<div class="fgroup"><label>${f.label}${f.req?' <span class="mute">*</span>':''}</label><select id="${id}" data-mfm="${f.k}" multiple size="6" style="height:auto">${op.map(o=>`<option value="${esc(o.id)}" ${(val||[]).includes(o.id)?'selected':''}>${esc(o.nombre)}</option>`).join('')}</select><span class="hint">Mantén presionada la tecla Ctrl (o Cmd en Mac) para elegir varios proyectos.</span></div>`;}"""

text = text.replace(
    "if(f.type==='checks'){",
    multiselect_code + "\n  if(f.type==='checks'){"
)

# 3. Cambiar clienteOpen para usar multiselect
text = text.replace(
    "{k:'proyectos',label:'Proyectos del cliente',type:'checks',req:1,opts:CAT.proyectos.map(p=>({id:p,nombre:p}))}",
    "{k:'proyectos',label:'Proyectos del cliente',type:'multiselect',req:1,opts:CAT.proyectos.map(p=>({id:p,nombre:p}))}"
)

# 4. Arreglar el listener mfm para que soporte SELECT multiple
listener_old = "if(t.dataset.mfm&&S.modal){const k=t.dataset.mfm,a=S.modal.data[k]||[];S.modal.data[k]=t.checked?[...new Set([...a,t.value])]:a.filter(x=>x!==t.value);"
listener_new = """if(t.dataset.mfm&&S.modal){
    const k=t.dataset.mfm;
    if(t.tagName==='SELECT'&&t.multiple){
      S.modal.data[k] = Array.from(t.selectedOptions).map(o=>o.value);
    } else {
      const a=S.modal.data[k]||[];S.modal.data[k]=t.checked?[...new Set([...a,t.value])]:a.filter(x=>x!==t.value);
    }"""
text = text.replace(listener_old, listener_new)

with open(r"C:\Users\manue\Master-App\js\ui.js", "w", encoding="utf-8") as f:
    f.write(text)

