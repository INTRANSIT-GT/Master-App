/* ---------- Iconos ---------- */
const ICON={
  home:'<path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  truck:'<path d="M2 6h11v10H2z"/><path d="M13 9h5l3 3v4h-8z"/><circle cx="6" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  tower:'<circle cx="12" cy="12" r="2"/><path d="M7.8 7.8a6 6 0 000 8.4M16.2 7.8a6 6 0 010 8.4M4.9 4.9a10 10 0 000 14.2M19.1 4.9a10 10 0 010 14.2"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/>',
  grid:'<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>',
  users:'<circle cx="9" cy="8" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 5a3 3 0 010 6M18 14c2 .8 3 2.8 3 6"/>',
  db:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/>',
  folder:'<path d="M3 6h6l2 2h10v11H3z"/>',
  list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  chart:'<path d="M4 20V4M4 20h16M8 16v-5M12 16V8M16 16v-3"/>',
  camera:'<path d="M4 8h3l2-3h6l2 3h3v12H4z"/><circle cx="12" cy="13" r="4"/>',
  back:'<path d="M15 5l-7 7 7 7"/>',
  gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  phone:'<rect x="7" y="2" width="10" height="20" rx="2"/><path d="M11 18h2"/>',
  code:'<path d="M8 7l-5 5 5 5M16 7l5 5-5 5"/>',
  undo:'<path d="M9 14L4 9l5-5"/><path d="M4 9h11a5 5 0 010 10h-3"/>',
  out:'<path d="M9 4H4v16h5M16 8l4 4-4 4M20 12H9"/>',
  check:'<path d="M5 12l5 5 9-10"/>',
  alert:'<path d="M12 3l10 18H2z"/><path d="M12 10v5M12 18h.01"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  lock:'<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  win:'<path d="M3 4l8-1v8H3zM13 3l8-1v9h-8zM3 13h8v8l-8-1zM13 13h8v9l-8-1z"/>'
};
const icon=(n,s=20)=>`<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]||''}</svg>`;

/* ---------- Utilidades ---------- */
const $=s=>document.querySelector(s);
const esc=s=>String(s==null?'':s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const dstr=d=>d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());
const todayStr=()=>dstr(new Date());
const fmtDT=iso=>iso?new Date(iso).toLocaleString('es-GT',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}):'—';
const fmtTime=iso=>iso?new Date(iso).toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit',hour12:false}):'—';
const fmtDate=s=>{if(!s)return'—';const [y,m,d]=s.split('-');return `${d}/${m}/${y}`;};
function elapsed(iso){if(!iso)return'—';let m=Math.max(0,Math.floor((Date.now()-new Date(iso))/60000));const h=Math.floor(m/60);m%=60;return h?`${h} h ${pad(m)} min`:`${m} min`;}
function ago(iso){const m=Math.max(0,Math.floor((Date.now()-new Date(iso))/60000));if(m<1)return'hace un momento';if(m<60)return`hace ${m} min`;if(m<1440)return`hace ${Math.floor(m/60)} h`;return`hace ${Math.floor(m/1440)} d`;}
const first=n=>String(n).split(' ')[0];
const initials=n=>String(n).split(' ').slice(0,2).map(x=>x[0]).join('').toUpperCase();
const toLocal=d=>dstr(d)+'T'+pad(d.getHours())+':'+pad(d.getMinutes());
const nowLocal=()=>toLocal(new Date());
const fmtL=v=>v?`${fmtDate(v.slice(0,10))} ${v.slice(11,16)}`:'—';
const planD=t=>(t.fechaPlan||'').slice(0,10),planT=t=>(t.fechaPlan||'').slice(11,16);
const since=t=>t.tSalida||t.iniciadoEn;
const est=t=>t.estatus?`<span class="est tn-${ESTATUS_TONO[t.estatus]||'neutral'}">${esc(t.estatus)}</span>`:'';
const topScroll=()=>{const m=document.querySelector('#main');if(m)m.scrollTop=0;};
function diff(a,b){if(!a||!b)return'—';const m=Math.round((new Date(b)-new Date(a))/60000);if(m<0)return'Revisar fechas';const h=Math.floor(m/60);return h?`${h} h ${pad(m%60)} min`:`${m} min`;}
/* Horarios (columnas FECHA_HORA ... de la hoja VIAJES), en orden cronológico */
const CAMPOS_TIEMPO=[['tIngresoPlanta','Ingreso a planta CP'],['tEsperaRampa','Espera en rampa'],['tRampa','Ingreso a rampa'],['tInicioCarga','Inicio de carga'],['tFinCarga','Fin de carga'],['tSalidaPlanta','Salida de planta'],['tSalida','Fecha y hora de salida'],['tIngresoBodega','Ingreso a bodega CG'],['tInicioDescarga','Inicio de descarga'],['tFinDescarga','Fin de descarga']];
const TKEYS=CAMPOS_TIEMPO.map(x=>x[0]);
/* Columnas de tiempo que se calculan solas */
const DUR=[['Espera de rampa','tEsperaRampa','tRampa'],['En rampa','tRampa','tSalidaPlanta'],['Espera de carga','tIngresoPlanta','tInicioCarga'],['Tiempo de carga','tInicioCarga','tFinCarga'],['Tiempo en tránsito','tSalida','tIngresoBodega'],['Espera de descarga','tIngresoBodega','tInicioDescarga'],['Tiempo de descarga','tInicioDescarga','tFinDescarga']];
const GRUPOKEYS={cliente:['proyectoCat','shipment','noViaje','opl','tipoViaje','tipoCarga','noCarga','producto','placaArrastre'],plan:['fechaPlan'],estatus:['estatus'],unidad:['pilotoId'],ruta:['rutaId'],tiempos:TKEYS,otros:['noDocRetorno','qViaticos']};
const LBL={proyectoCat:'Proyecto',shipment:'Shipment',noViaje:'No. de viaje',opl:'OPL',tipoViaje:'Tipo de viaje',tipoCarga:'Tipo de carga',noCarga:'No. de carga',producto:'Producto',fechaPlan:'Fecha plan',estatus:'Estatus',pilotoId:'Piloto',origenId:'Origen',destinoId:'Destino',noDocRetorno:'No. doc retorno',qViaticos:'Q viáticos'};
CAMPOS_TIEMPO.forEach(([k,l])=>LBL[k]=l);

function sampleSlip(no){
  const bars=[0,1,2,3,4,5,6].map(i=>`<rect x="48" y="${250+i*34}" width="${300+((i*53)%180)}" height="9" rx="4" fill="#C9CFD8"/><rect x="430" y="${250+i*34}" width="120" height="9" rx="4" fill="#D8DDE4"/>`).join('');
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 800"><rect width="600" height="800" fill="#E8ECF1"/><rect x="24" y="20" width="552" height="760" rx="6" fill="#fff"/><text x="48" y="78" font-family="Arial" font-size="26" font-weight="700" fill="#10253F">LIQUIDACIÓN DE VIAJE</text><text x="48" y="108" font-family="Arial" font-size="17" fill="#44556B">Viaje #${no}</text><rect x="48" y="130" width="504" height="2" fill="#10253F"/><rect x="48" y="160" width="220" height="10" rx="4" fill="#B9C2CE"/><rect x="48" y="186" width="300" height="10" rx="4" fill="#B9C2CE"/><rect x="48" y="212" width="180" height="10" rx="4" fill="#B9C2CE"/>${bars}<rect x="48" y="520" width="504" height="1.5" fill="#B9C2CE"/><text x="48" y="580" font-family="Arial" font-size="15" fill="#44556B">Firma piloto</text><path d="M60 650c25-50 45 30 70-10s40 40 70-5 30 25 55 0" stroke="#1F5FA8" stroke-width="3" fill="none" stroke-linecap="round"/><rect x="48" y="670" width="200" height="1.5" fill="#44556B"/><text x="340" y="580" font-family="Arial" font-size="15" fill="#44556B">Sello / recibido</text><circle cx="440" cy="640" r="44" fill="none" stroke="#7C93B3" stroke-width="3"/><text x="300" y="750" font-family="Arial" font-size="13" fill="#8696AB">FOTO DE EJEMPLO · prototipo</text></svg>`;
  return 'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg);
}
function readPhoto(file){
  return new Promise(res=>{
    const r=new FileReader();
    r.onload=()=>{const img=new Image();
      img.onload=()=>{const m=1100;let w=img.width,h=img.height;const k=Math.min(1,m/Math.max(w,h));w=Math.round(w*k);h=Math.round(h*k);
        const c=document.createElement('canvas');c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);res(c.toDataURL('image/jpeg',.72));};
      img.onerror=()=>res(r.result);img.src=r.result;};
    r.onerror=()=>res(null);r.readAsDataURL(file);
  });
}
