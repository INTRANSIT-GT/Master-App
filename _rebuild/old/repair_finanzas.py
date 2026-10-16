import re
with open(r"C:\Users\manue\Master-App\js\modulos\finanzas.js", "r", encoding="utf-8") as f:
    text = f.read()

# Fix the broken line
text = text.replace(
    "const doc=new lib.jsPDF({unit:'pt',format:'letter'  async aplicarTarifasTodas(){",
    "const doc=new lib.jsPDF({unit:'pt',format:'letter'});\n"
)
text = text.replace(
    "if(o){S.opSel={};toast(`Orden ${o.id} emitida por ${qfmt(o.importe)}.`);afterWrite();}\n  }\n});",
    "if(o){S.opSel={};toast(`Orden ${o.id} emitida por ${qfmt(o.importe)}.`);afterWrite();}\n  }"
)

# And append the block to the ACTUAL end of the Object.assign
text = re.sub(r'(\}\);[\s\n]*)$', r', async aplicarTarifasTodas(){const r=await run(()=>API.aplicarTarifasPendientes(S.user.id,[]),x=>`Tarifas aplicadas: ${x.aplicadas.length}. Sin tarifa válida (requieren revisión): ${x.sinTarifa.length}.`);render();}, async opSoloOpl(){S.opSoloOpl=!S.opSoloOpl;render();}, async opClear(){S.opSel={};render();}, async opEmitir(){ const sel=S.opSel||{},ids=Object.keys(sel).filter(id=>sel[id]); if(!ids.length)return; const provs=[...new Set(ids.map(id=>{const t=DB.trips.find(x=>x.id===id);return t?t.opl:'';}))]; if(provs.length!==1||!provs[0])return toast("Selecciona viajes de un solo proveedor (OPL).","err"); const o=await run(async()=>{ const ord=await API.crearOrdenPago(S.user.id,{proveedor:provs[0],viajeIds:ids}); try{const dataUrl=ordenPagoPDF(ord);await API.adjuntarDocumentoOrden(S.user.id,ord.id,{data:dataUrl,nombre:"Orden-"+ord.id+".pdf"});} catch(e){toast("La orden se creó, pero no se pudo adjuntar el documento: "+e.message,"err");} return ord;},null); if(o){S.opSel={};toast(`Orden ${o.id} emitida por ${qfmt(o.importe)}.`);afterWrite();} } \1', text)

with open(r"C:\Users\manue\Master-App\js\modulos\finanzas.js", "w", encoding="utf-8") as f:
    f.write(text)

