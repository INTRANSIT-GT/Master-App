import re
with open(r"C:\Users\manue\Master-App\js\ui.js", "r", encoding="utf-8") as f:
    text = f.read()

def replacer(m):
    return """function clientesAdminHTML(){
  const gest=hp('clientes_gestionar');
  const lista=DB.clientes.slice().sort((a,b)=>String(a.nombre).localeCompare(String(b.nombre),'es'));
  const q = (S.qCli||'').trim().toLowerCase();
  const filas=lista.filter(c=>!q || (c.id+' '+c.nombre+' '+c.cliente+' '+(c.nit||'')+' '+(c.proyectos||[]).join(' ')).toLowerCase().includes(q));
  const link=u=>/^https?:\/\//i.test(String(u||'').trim())?`<a href="${esc(String(u).trim())}" target="_blank" rel="noopener noreferrer">Abrir contrato</a>`:vacioTxt(u);
  const cab=['ID cliente','Cliente','Cliente padre','Servicio','Nombre usuario','Correo','Teléfono','Link contrato','NIT','Proyecto','Estado','Creado','Acciones'];
  const pg=paginar('cli',filas);
  const tabla=!lista.length
    ?`<div class="alertbox info"><b>No hay clientes registrados.</b> ${catalogoFalla()?esc(catalogoFalla()):'La base de datos no devolvió clientes.'}${REINTENTAR}</div>`
    :`<div class="xlwrap" style="max-height:none"><table class="xl" id="tablaClientes" style="min-width:1750px"><thead><tr>${cab.map(h=>`<th>${h}</th>`).join('')}</tr></thead><tbody>
      ${pg.filas.map(c=>`<tr class="${c.activo===false?'dim':''}"><td><b>${esc(c.id)}</b></td><td>${esc(c.nombre)}</td><td>${vacioTxt(c.clientePadre)}</td><td>${vacioTxt(c.servicio)}</td><td>${vacioTxt(c.contacto)}</td><td>${vacioTxt(c.correoFacturacion)}</td><td>${vacioTxt(c.telefono)}</td><td>${link(c.linkContrato)}</td><td>${c.nit?esc(c.nit):'<span class="warnl">Pendiente</span>'}</td><td style="white-space:normal;min-width:160px">${(c.proyectos||[]).length?esc(c.proyectos.join(', ')):'<span class="warnl">Sin proyectos</span>'}</td><td>${chip(c.activo===false?'neutral':'done',c.activo===false?'Inactivo':'Activo')}</td><td>${c.creadoEn?fmtDT(c.creadoEn):'<span class="mute">—</span>'}${c.creadoPor?`<br><span class="mute">${esc(c.creadoPor)}</span>`:''}</td><td style="white-space:nowrap">${gest?`<button class="btn sm" data-act="clienteOpen" data-id="${c.id}">Editar</button> <button class="btn sm ${c.activo===false?'ok':'fix'}" data-act="clienteEstado" data-id="${c.id}">${c.activo===false?'Activar':'Desactivar'}</button> `:''}<button class="btn sm ghost" data-act="proj" data-id="${c.id}">Ver viajes</button></td></tr>`).join('')}
      </tbody></table></div>${paginador('cli',pg)}`;
  return `<div class="inner" style="max-width:none">${pageHead('Clientes','Tabla de clientes: contacto, contrato, NIT y proyectos',gest?`<button class="btn primary" data-act="clienteOpen" data-id="">${icon('plus',18)} Nuevo cliente</button>`:'')}
    ${lista.length?`<div style="margin-bottom:12px;max-width:440px"><input type="text" id="qCli" placeholder="Buscar por cliente, NIT, código o proyecto" value="${esc(S.qCli||'')}" aria-label="Buscar clientes"></div>`:''}
    ${tabla}
    ${gest?`<details class="section" id="cfgTorre" style="margin-top:18px"><summary style="cursor:pointer;font-weight:700">Configuración de Torre de Control</summary>${torreCfgAdmin()}</details>`:''}</div>`;
}"""

text = re.sub(r'function clientesAdminHTML\(\)\{.*?return `.*?</div>`;\n\}', replacer, text, flags=re.DOTALL)

with open(r"C:\Users\manue\Master-App\js\ui.js", "w", encoding="utf-8") as f:
    f.write(text)

