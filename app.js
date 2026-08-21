const content=document.querySelector('#content');
const logout=document.querySelector('#logout');
let db=null,user=null,currentSeason=null;

function esc(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function norm(v=''){return String(v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function fmtDate(v){if(!v)return '—';const p=String(v).slice(0,10).split('-');return p.length===3?`${p[2]}/${p[1]}/${p[0]}`:v}
function val(v,s=''){return v===null||v===undefined||v===''?'—':`${v}${s}`}
function msg(t,c='muted'){return `<p class="${c}">${esc(t)}</p>`}
function icon(name,cls=''){return `<i data-lucide="${name}" class="${cls}"></i>`}
function refreshIcons(){if(window.lucide)requestAnimationFrame(()=>lucide.createIcons())}
function cropKey(v=''){const n=norm(v);if(n.includes('trigo'))return'Trigo';if(n.includes('cebada'))return'Cebada';if(n.includes('colza')||n.includes('canola'))return'Colza';if(n.includes('maiz'))return'Maíz';if(n.includes('soja'))return'Soja';if(n.includes('sorgo'))return'Sorgo';if(n.includes('girasol'))return'Girasol';return String(v).trim()}
const CULTIVOS=['Trigo','Cebada','Colza','Maíz','Soja','Sorgo','Girasol'];
const CROP_ICONS={Trigo:'wheat',Cebada:'wheat',Colza:'flower-2','Maíz':'sprout',Soja:'leaf',Sorgo:'sprout',Girasol:'sun'};

function setHeader(title='Mis chacras',eyebrow='GESTIÓN AGRÍCOLA'){
  document.querySelector('#appHeaderTitle').textContent=title;
  document.querySelector('#appHeaderEyebrow').textContent=eyebrow;
}
function bottomNav(active='chacras'){
  return `<nav class="bottom-nav">
    <button class="${active==='chacras'?'active':''}" onclick="home()">${icon('land-plot')}<span>Chacras</span></button>
    <button class="${active==='recorridas'?'active':''}" onclick="jumpActive('recorridas')">${icon('clipboard-list')}<span>Recorridas</span></button>
    <button class="${active==='nutricion'?'active':''}" onclick="jumpActive('nutricion')">${icon('leaf')}<span>Nutrición</span></button>
    <button class="${active==='labores'?'active':''}" onclick="jumpActive('labores')">${icon('tractor')}<span>Labores</span></button>
    <button>${icon('ellipsis')}<span>Más</span></button>
  </nav>`;
}
function jumpActive(tab){if(currentSeason?.id)openSeason(currentSeason.id,tab)}

async function boot(){
  const cfg=window.CHACRAS_CONFIG;
  if(!cfg?.SUPABASE_URL||!cfg?.SUPABASE_ANON_KEY){content.innerHTML=`<div class="center-card"><h2>Conexión pendiente</h2>${msg('Falta configurar Supabase.')}</div>`;return}
  db=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  ({data:{user}}=await db.auth.getUser());
  user?home():auth();
}

function auth(){
  currentSeason=null;logout.hidden=true;setHeader('Chacras','GESTIÓN AGRÍCOLA');
  content.innerHTML=`<div class="auth-wrap"><div class="brand-lockup"><div class="brand-mark">C</div><h2>Gestión de chacras</h2><p>Ingresá para continuar con tus campañas.</p></div><div class="form-card"><label>Email</label><input id="email" type="email" autocomplete="email" placeholder="tu@email.com"><label>Contraseña</label><input id="pass" type="password" autocomplete="current-password" placeholder="••••••••"><button id="login" class="primary-cta">Entrar</button><button id="signup" class="secondary-cta">Crear cuenta</button><div id="status"></div></div></div>`;
  document.getElementById('login').onclick=()=>doAuth('signInWithPassword');
  document.getElementById('signup').onclick=()=>doAuth('signUp');
}
async function doAuth(m){
  const s=document.getElementById('status'),e=(document.getElementById('email')?.value||'').trim(),p=document.getElementById('pass')?.value||'';
  if(!e||!p){s.innerHTML=msg('Ingresá email y contraseña.','error');return}
  if(p.length<6){s.innerHTML=msg('La contraseña debe tener al menos 6 caracteres.','error');return}
  s.innerHTML=msg('Procesando…');const r=await db.auth[m]({email:e,password:p});
  if(r.error){s.innerHTML=msg(r.error.message,'error');return}
  ({data:{user}}=await db.auth.getUser());user?home():s.innerHTML=msg('Cuenta creada. Revisá tu correo para confirmarla.','ok');
}

async function home(){
  currentSeason=null;logout.hidden=false;setHeader('Mis chacras','GESTIÓN AGRÍCOLA');
  logout.onclick=async()=>{await db.auth.signOut();user=null;auth()};
  const {data:chacras,error}=await db.from('chacras').select('*,zafras(*)').order('created_at',{ascending:false});
  if(error){content.innerHTML=msg(error.message,'error');return}
  const enriched=[];
  for(const c of (chacras||[])){
    for(const z of (c.zafras||[])){
      const {data:r}=await db.from('recorridas').select('fecha,estadio_fenologico,estado_cultivo').eq('zafra_id',z.id).order('fecha',{ascending:false}).limit(1);
      z._last=r?.[0]||null;
    }
    enriched.push(c);
  }
  content.innerHTML=`
    <section class="home-tools">
      <div class="searchbox">${icon('search')}<input id="fieldSearch" placeholder="Buscar chacra, cultivo o variedad..."></div>
      <button class="filter-btn" id="filterBtn">${icon('sliders-horizontal')}<span>Filtrar</span></button>
    </section>
    <section class="fields-stack" id="fieldsStack">
      ${enriched.map(fieldCard).join('')||`<div class="empty-state">${icon('land-plot')}<h3>Todavía no hay chacras</h3><p>Creá la primera para empezar a registrar campañas.</p></div>`}
    </section>
    <button class="fab" id="newField">${icon('plus')}<span>Nueva chacra</span></button>
    ${bottomNav('chacras')}`;
  document.getElementById('newField').onclick=newFieldForm;
  const search=document.getElementById('fieldSearch');search.oninput=()=>filterFieldCards(search.value);
  document.getElementById('filterBtn').onclick=()=>{search.focus()};
  refreshIcons();
}
function fieldCard(c){
  const z=(c.zafras||[])[0]||null,last=z?z._last:null;
  const crop=z?.cultivo||'Sin zafra';const ci=CROP_ICONS[cropKey(crop)]||'leaf';
  return `<article class="field-row-card" data-search="${esc(`${c.nombre} ${c.establecimiento||''} ${crop} ${z?.variedad||''}`.toLowerCase())}">
    <button class="field-main" ${z?`onclick="openSeason('${z.id}')"`:`onclick="newSeason('${c.id}')"`}>
      <div class="field-copy">
        <h3>${esc(c.nombre)}</h3>
        <p>${esc(c.establecimiento||'')}${c.superficie_ha?` · <strong>${esc(c.superficie_ha)} ha</strong>`:''}</p>
        <div class="field-crop-line">${icon(ci)}<span>${esc(crop)}${z?.variedad?` · ${esc(z.variedad)}`:''}</span>${z?.zafra?`<em>${esc(z.zafra)}</em>`:''}</div>
        ${z?.sow_date?`<small>Siembra: ${fmtDate(z.sow_date)}</small>`:''}
      </div>
      <div class="field-side">
        <span class="phenology-pill">${esc(last?.estadio_fenologico||'—')}</span>
        <small>Última recorrida</small>
        <b>${last?fmtDate(last.fecha):'Sin recorridas'}</b>
        <span class="details-link">Ver detalles ${icon('chevron-right')}</span>
      </div>
    </button>
    <div class="season-mini-row">${(c.zafras||[]).slice(1).map(x=>`<button onclick="openSeason('${x.id}')">${esc(x.zafra)} · ${esc(x.cultivo)}</button>`).join('')}<button class="add-season" onclick="newSeason('${c.id}')">${icon('plus')} Nueva zafra</button></div>
  </article>`;
}
function filterFieldCards(q){const n=norm(q);document.querySelectorAll('.field-row-card').forEach(el=>el.style.display=!n||norm(el.dataset.search).includes(n)?'block':'none')}

function newFieldForm(){
  setHeader('Nueva chacra','CHACRAS');
  content.innerHTML=`<button class="back-link" onclick="home()">${icon('arrow-left')} Volver</button>
  <div class="intro-banner">${icon('land-plot')}<div><b>Las chacras son permanentes</b><span>Aquí registrás tus lotes o potreros. Luego podrás crear zafras para cada cultivo.</span></div></div>
  <section class="form-section"><div class="section-title"><span>1</span><h3>Datos generales</h3></div><div class="form-grid"><div><label>Nombre de la chacra *</label><input id="nombre" placeholder="Ej. Potrero 30.1"></div><div><label>Establecimiento / Campo *</label><input id="establecimiento" placeholder="Ej. Las Avenidas"></div><div><label>Superficie total (ha)</label><input id="superficie" type="number" step="0.01" placeholder="20"></div><div><label>Descripción (opcional)</label><input id="descripcion" placeholder="Descripción breve"></div></div></section>
  <section class="form-section"><div class="section-title"><span>2</span><h3>Ubicación</h3></div><div class="form-grid"><div><label>Departamento</label><input id="departamento" placeholder="San José"></div><div><label>Localidad</label><input id="localidad" placeholder="Escribir localidad"></div><div class="full"><label>Paraje (opcional)</label><input id="paraje" placeholder="Zona / paraje"></div></div></section>
  <div class="form-actions"><button class="secondary-cta" onclick="home()">Cancelar</button><button id="save" class="primary-cta">Crear chacra ${icon('plus-circle')}</button></div><div id="status"></div>${bottomNav('chacras')}`;
  document.getElementById('save').onclick=async()=>{
    const s=document.getElementById('status');const nombre=document.getElementById('nombre').value.trim();
    if(!nombre){s.innerHTML=msg('Ingresá el nombre de la chacra.','error');return}
    s.innerHTML=msg('Guardando…');const {error}=await db.from('chacras').insert({owner_id:user.id,nombre,establecimiento:document.getElementById('establecimiento').value,superficie_ha:+document.getElementById('superficie').value||null,departamento:document.getElementById('departamento').value,localidad:document.getElementById('localidad').value,paraje:document.getElementById('paraje').value,descripcion:document.getElementById('descripcion').value});error?s.innerHTML=msg(error.message,'error'):home();
  };refreshIcons();
}

async function newSeason(chacra_id){
  setHeader('Nueva zafra','CAMPAÑAS');
  const {data:c}=await db.from('chacras').select('*').eq('id',chacra_id).single();
  content.innerHTML=`<button class="back-link" onclick="home()">${icon('arrow-left')} Cancelar</button>
  <div class="intro-banner">${icon('sprout')}<div><b>Cada zafra corresponde a un cultivo en una chacra.</b><span>Las fechas de siembra y cosecha se cargarán desde Labores.</span></div></div>
  <div class="selected-field-card">${icon('map-pin')}<div><b>${esc(c?.nombre||'Chacra')}</b><span>${esc(c?.establecimiento||'')}${c?.superficie_ha?` · ${c.superficie_ha} ha`:''}</span></div></div>
  <section class="form-section"><div class="section-title"><span>1</span><h3>Información general</h3></div><label>Zafra *</label><input id="zafra" placeholder="Ej. INV 2026"></section>
  <section class="form-section"><div class="section-title"><span>2</span><h3>Cultivo y variedad</h3></div><div class="form-grid"><div><label>Cultivo *</label><select id="cultivo"><option value="">Seleccionar</option>${CULTIVOS.map(x=>`<option>${x}</option>`).join('')}</select></div><div><label>Variedad / Híbrido</label><input id="variedad" placeholder="Ej. Aromo"></div></div></section>
  <section class="form-section"><div class="section-title"><span>3</span><h3>Antecesor</h3></div><label>Antecesor inmediato</label><input id="antecesor" placeholder="Ej. Soja"></section>
  <div class="info-note">${icon('info')}<span>Las fechas de siembra y cosecha, y el rendimiento, se cargarán cuando registres las labores correspondientes.</span></div>
  <div class="form-actions"><button class="secondary-cta" onclick="home()">Cancelar</button><button id="save" class="primary-cta">Crear zafra ${icon('plus-circle')}</button></div><div id="status"></div>${bottomNav('chacras')}`;
  document.getElementById('save').onclick=async()=>{const s=document.getElementById('status'),cultivo=document.getElementById('cultivo').value,zafra=document.getElementById('zafra').value.trim();if(!zafra||!cultivo){s.innerHTML=msg('Completá zafra y cultivo.','error');return}const {error}=await db.from('zafras').insert({owner_id:user.id,chacra_id,zafra,cultivo,variedad:document.getElementById('variedad').value,antecesor:document.getElementById('antecesor').value});error?s.innerHTML=msg(error.message,'error'):home()};refreshIcons();
}

async function loadSeason(id){
  const {data:z,error}=await db.from('zafras').select('*,chacras(*)').eq('id',id).single();if(error)throw error;
  const {data:rec}=await db.from('recorridas').select('*').eq('zafra_id',id).order('fecha',{ascending:false});
  const {data:lab}=await db.from('labores').select('*').eq('zafra_id',id).order('fecha',{ascending:false});
  const laborIds=(lab||[]).map(x=>x.id);let sow=null,harvest=null,ferts=[],products=[];
  if(laborIds.length){
    const [{data:sows},{data:harvests},{data:fertRows},{data:prodRows}]=await Promise.all([
      db.from('siembras').select('*').in('labor_id',laborIds),db.from('cosechas').select('*').in('labor_id',laborIds),db.from('fertilizaciones').select('*').in('labor_id',laborIds),db.from('productos_aplicados').select('*').in('labor_id',laborIds)]);
    if(sows?.length){const x=sows[0];sow={...x,labor:(lab||[]).find(l=>l.id===x.labor_id)}}
    if(harvests?.length){const x=harvests[0];harvest={...x,labor:(lab||[]).find(l=>l.id===x.labor_id)}}
    ferts=fertRows||[];products=prodRows||[];
  }
  return {...z,recorridas:rec||[],labores:lab||[],sow,harvest,ferts,products};
}
function laborCounts(rows=[]){const out={aplicacion:0,fertilizacion:0,laboreo:0,siembra:0,cosecha:0};rows.forEach(r=>{if(out[r.tipo_labor]!==undefined)out[r.tipo_labor]++});return out}
function laborLabel(t){return {siembra:'Siembra',aplicacion:'Aplicación',fertilizacion:'Fertilización',laboreo:'Laboreo',cosecha:'Cosecha'}[t]||t}
function cropIcon(c){return CROP_ICONS[cropKey(c)]||'leaf'}

async function openSeason(id,tab='recorridas'){
  try{currentSeason=await loadSeason(id)}catch(e){content.innerHTML=msg(e.message,'error');return}
  const z=currentSeason,last=z.recorridas[0];setHeader(z.chacras.nombre,'FICHA DE CHACRA');
  content.innerHTML=`
    <button class="back-link" onclick="home()">${icon('arrow-left')} Volver a chacras</button>
    <section class="campaign-top">
      <div class="campaign-heading"><h2>${esc(z.chacras.establecimiento||z.chacras.nombre)} · ${esc(z.chacras.nombre)}</h2><div class="campaign-tags"><span>${icon(cropIcon(z.cultivo))}${esc(z.cultivo)}</span><span>${esc(z.variedad||'Sin variedad')}</span><em>${esc(z.zafra)}</em></div><p>${esc(z.chacras.nombre)}${z.chacras.superficie_ha?` · <strong>${z.chacras.superficie_ha} ha</strong>`:''}</p></div>
      <div class="field-photo-placeholder">${icon('image')}<span>Foto de chacra</span><button>${icon('camera')}</button></div>
    </section>
    <section class="campaign-card">
      <div class="card-title">${icon('clipboard-list')}<span>Ficha de campaña</span></div>
      <div class="campaign-grid">
        ${campaignInfo('calendar','Fecha de siembra',fmtDate(z.sow?.labor?.fecha))}
        ${campaignInfo('sprout','Variedad',esc(z.variedad||'—'))}
        ${campaignInfo('between-horizontal-start','Densidad',z.sow?`${val(z.sow.densidad)} ${esc(z.sow.unidad_densidad||'')}`:'—')}
        ${campaignInfo('rotate-ccw','Antecesor',esc(z.antecesor||'—'))}
        ${campaignInfo('ruler','Distancia entre hileras',z.sow?val(z.sow.distancia_hileras_cm,' cm'):'—')}
        ${campaignInfo('land-plot','Superficie',val(z.chacras.superficie_ha,' ha'))}
      </div>
      <div class="harvest-strip"><div>${icon('calendar-check')}<span>Fecha de cosecha</span><b>${z.harvest?fmtDate(z.harvest.labor?.fecha):'—'}</b><small>${z.harvest?'Cosecha registrada':'Pendiente de cosecha'}</small></div><div>${icon('chart-no-axes-column-increasing')}<span>Rendimiento</span><b>${z.harvest?.rendimiento_kg_ha?`${Number(z.harvest.rendimiento_kg_ha).toLocaleString('es-UY')} kg/ha`:'—'}</b><small>${z.harvest?'Rendimiento registrado':'Pendiente de cosecha'}</small></div></div>
    </section>
    <section class="last-visit-card" onclick="renderSeasonTab('recorridas')">
      <div class="card-title">${icon('leaf')}<span>Última recorrida</span></div>
      <div class="last-visit-grid">
        <div>${icon('calendar-days')}<span>Fecha</span><b>${last?fmtDate(last.fecha):'—'}</b><small>${last?'Último registro':'Sin recorridas'}</small></div>
        <div>${icon('sprout')}<span>Estado fenológico</span><b class="accent-big">${esc(last?.estadio_fenologico||'—')}</b><small>${esc(last?.descripcion||'')}</small></div>
        <div>${icon('leaf')}<span>Estado del cultivo</span><b class="accent-big">${last?.estado_cultivo?`${last.estado_cultivo}/5`:'—'}</b><small>${last?.estado_cultivo?'Estado registrado':'Sin dato'}</small></div>
      </div>
      ${last?.observaciones?`<p class="visit-observation"><b>Observación:</b> ${esc(last.observaciones)}</p>`:''}
      ${icon('chevron-right','visit-chevron')}
    </section>
    <nav class="section-tabs">
      <button class="${tab==='recorridas'?'active':''}" onclick="renderSeasonTab('recorridas')">${icon('clipboard-list')}<span>Recorridas</span></button>
      <button class="${tab==='nutricion'?'active':''}" onclick="renderSeasonTab('nutricion')">${icon('leaf')}<span>Nutrición</span></button>
      <button class="${tab==='labores'?'active':''}" onclick="renderSeasonTab('labores')">${icon('tractor')}<span>Labores</span></button>
      <button class="${tab==='archivos'?'active':''}" onclick="renderSeasonTab('archivos')">${icon('folder')}<span>Archivos</span></button>
    </nav>
    <div id="tabContent"></div>
    ${bottomNav(tab==='archivos'?'chacras':tab)}
  `;
  renderSeasonTab(tab);refreshIcons();
}
function campaignInfo(i,label,value){return `<div class="campaign-info">${icon(i)}<span>${label}</span><b>${value}</b></div>`}

function renderSeasonTab(tab){
  const z=currentSeason;if(!z)return;
  document.querySelectorAll('.section-tabs button').forEach(b=>b.classList.toggle('active',norm(b.textContent)===tab));
  const box=document.getElementById('tabContent');
  if(tab==='recorridas'){
    box.innerHTML=`<section class="tab-panel"><div class="panel-heading"><div><h3>Recorridas</h3><p>Historial de recorridas realizadas en esta campaña.</p></div><button class="small-action" onclick="newVisit('${z.id}','${esc(z.cultivo)}')">${icon('plus')} Nueva</button></div>${z.recorridas.length?`<div class="timeline-list">${z.recorridas.map(r=>`<article class="timeline-item"><div class="timeline-icon">${icon('clipboard-check')}</div><div><span>${fmtDate(r.fecha)}</span><h4>${esc(r.estadio_fenologico||'Sin estadio')} · Estado ${r.estado_cultivo||'—'}/5</h4>${r.observaciones?`<p>${esc(r.observaciones)}</p>`:''}</div><span class="row-chevron">${icon('chevron-right')}</span></article>`).join('')}</div>`:`<div class="illustrated-empty">${icon('land-plot')}<p>Aquí verás el historial de recorridas realizadas en esta campaña.</p></div>`}<button class="wide-cta" onclick="newVisit('${z.id}','${esc(z.cultivo)}')">${icon('plus-circle')} Nueva recorrida</button></section>`;
  } else if(tab==='labores'){
    const c=laborCounts(z.labores);
    box.innerHTML=`<section class="tab-panel"><div class="labour-counts"><div><b>${c.aplicacion}</b><span>Aplicaciones</span></div><div><b>${c.fertilizacion}</b><span>Fertilizaciones</span></div><div><b>${c.laboreo}</b><span>Laboreos</span></div><div><b>${c.siembra}</b><span>Siembra</span></div><div><b>${c.cosecha}</b><span>Cosecha</span></div></div><div class="panel-heading"><div><h3>Historial de labores</h3><p>Todo lo realizado en la chacra durante la zafra.</p></div><button class="small-action" onclick="newLabor('${z.id}')">${icon('plus')} Labor</button></div>${z.labores.length?`<div class="timeline-list">${z.labores.map(l=>`<article class="timeline-item"><div class="timeline-icon">${icon(l.type==='aplicacion'?'spray-can':'tractor')}</div><div><span>${fmtDate(l.fecha)}</span><h4>${esc(laborLabel(l.tipo_labor))}</h4>${laborDetail(l,z)}${l.observaciones?`<p>${esc(l.observaciones)}</p>`:''}</div><span class="row-chevron">${icon('chevron-right')}</span></article>`).join('')}</div>`:`<div class="illustrated-empty">${icon('tractor')}<p>Todavía no hay labores registradas.</p></div>`}<button class="wide-cta" onclick="newLabor('${z.id}')">${icon('plus-circle')} Registrar labor</button></section>`;
  } else if(tab==='nutricion'){
    const sum=z.ferts.reduce((a,f)=>({n:a.n+(+f.n_kg_ha||0),p:a.p+(+f.p2o5_kg_ha||0),k:a.k+(+f.k2o_kg_ha||0),s:a.s+(+f.s_kg_ha||0)}),{n:0,p:0,k:0,s:0});
    box.innerHTML=`<section class="tab-panel"><div class="panel-heading"><div><h3>Nutrición</h3><p>Análisis, fertilizantes y nutrientes acumulados.</p></div></div><div class="nutrient-cards"><div><span>N</span><b>${sum.n.toFixed(1)}</b><small>Nitrógeno</small></div><div><span>P</span><b>${sum.p.toFixed(1)}</b><small>Fósforo</small></div><div><span>K</span><b>${sum.k.toFixed(1)}</b><small>Potasio</small></div><div><span>S</span><b>${sum.s.toFixed(1)}</b><small>Azufre</small></div></div></section>`;
  } else {
    box.innerHTML=`<section class="tab-panel"><div class="panel-heading"><div><h3>Archivos</h3><p>Carpetas y documentos de la zafra.</p></div></div><div class="illustrated-empty">${icon('folder-open')}<p>Gestioná aquí tus carpetas y archivos.</p></div></section>`;
  }
  refreshIcons();
}
function laborDetail(l,z){if(l.tipo_labor==='siembra'&&z.sow?.labor_id===l.id)return `<p>${val(z.sow.densidad)} ${esc(z.sow.unidad_densidad||'')} · ${val(z.sow.distancia_hileras_cm,' cm entre hileras')}</p>`;if(l.tipo_labor==='cosecha'&&z.harvest?.labor_id===l.id)return `<p><b>${Number(z.harvest.rendimiento_kg_ha||0).toLocaleString('es-UY')} kg/ha</b>${z.harvest.humedad_pct?` · ${z.harvest.humedad_pct}% humedad`:''}</p>`;if(l.tipo_labor==='fertilizacion'){const f=z.ferts.find(x=>x.labor_id===l.id);return f?`<p>${esc(f.fertilizante)} · ${f.dosis_kg_ha} kg/ha</p>`:''}if(l.tipo_labor==='aplicacion'){const ps=z.products.filter(x=>x.labor_id===l.id);return ps.length?`<p>${ps.map(p=>`${esc(p.producto)} — ${p.dosis} ${esc(p.unidad_dosis)}`).join(' · ')}</p>`:''}return ''}

async function newVisit(zafra_id,cultivo){
  setHeader('Nueva recorrida','RECORRIDAS');
  const canonical=cropKey(cultivo);const {data:allFen}=await db.from('fenologia_cultivos').select('cultivo,estadio,descripcion,orden').order('orden');const fen=(allFen||[]).filter(f=>norm(f.cultivo)===norm(canonical));
  content.innerHTML=`<button class="back-link" onclick="openSeason('${zafra_id}','recorridas')">${icon('arrow-left')} Volver</button><section class="form-section"><div class="section-title"><span>${icon('clipboard-list')}</span><h3>Nueva recorrida</h3></div><label>Fecha</label><input id="fecha" type="date" value="${new Date().toISOString().slice(0,10)}"><label>Estado fenológico</label>${fen.length?`<select id="estadio"><option value="">Seleccionar</option>${fen.map(f=>`<option value="${esc(f.estadio)}">${esc(f.estadio)}${f.descripcion?' — '+esc(f.descripcion):''}</option>`).join('')}</select>`:`<input id="estadio" placeholder="Estado fenológico">`}<label>Estado del cultivo</label><select id="estado"><option value="">Seleccionar</option><option value="1">1/5 · Muy malo</option><option value="2">2/5 · Malo</option><option value="3">3/5 · Regular</option><option value="4">4/5 · Bueno</option><option value="5">5/5 · Muy bueno</option></select><label>Observaciones</label><textarea id="observaciones" placeholder="Observaciones de la recorrida"></textarea><button id="save" class="primary-cta">Guardar recorrida</button><div id="status"></div></section>${bottomNav('recorridas')}`;
  document.getElementById('save').onclick=async()=>{const s=document.getElementById('status');s.innerHTML=msg('Guardando…');const {error}=await db.from('recorridas').insert({owner_id:user.id,zafra_id,fecha:document.getElementById('fecha').value,estadio_fenologico:document.getElementById('estadio').value,estado_cultivo:+document.getElementById('estado').value||null,observaciones:document.getElementById('observaciones').value});error?s.innerHTML=msg(error.message,'error'):openSeason(zafra_id,'recorridas')};refreshIcons();
}

function newLabor(zafra_id){
  setHeader('Nueva labor','LABORES');
  content.innerHTML=`<button class="back-link" onclick="openSeason('${zafra_id}','labores')">${icon('arrow-left')} Volver</button><section class="form-section"><div class="section-title"><span>${icon('tractor')}</span><h3>Registrar labor</h3></div><label>Tipo de labor</label><select id="laborType"><option value="">Seleccionar</option><option value="siembra">Siembra</option><option value="aplicacion">Aplicación</option><option value="fertilizacion">Fertilización</option><option value="laboreo">Laboreo</option><option value="cosecha">Cosecha</option></select><label>Fecha</label><input id="laborDate" type="date" value="${new Date().toISOString().slice(0,10)}"><div id="specificFields"></div><label>Observaciones</label><textarea id="laborObs" placeholder="Observaciones (opcional)"></textarea><button id="saveLabor" class="primary-cta">Guardar labor</button><div id="status"></div></section>${bottomNav('labores')}`;
  document.getElementById('laborType').onchange=e=>renderLaborFields(e.target.value);
  document.getElementById('saveLabor').onclick=()=>saveLabor(zafra_id);refreshIcons();
}
function renderLaborFields(type){
  const b=document.getElementById('specificFields');if(!b)return;
  if(type==='siembra')b.innerHTML=`<div class="form-grid"><div><label>Densidad</label><input id="densidad" type="number" step="any" placeholder="Densidad"></div><div><label>Unidad</label><input id="unidadDensidad" placeholder="sem/ha o kg/ha"></div><div class="full"><label>Distancia entre hileras (cm)</label><input id="distancia" type="number" step="any"></div></div>`;
  else if(type==='fertilizacion')b.innerHTML=`<label>Fertilizante</label><input id="fertNombre" placeholder="Ej. Urea"><label>Dosis (kg/ha)</label><input id="fertDosis" type="number" step="any"><div class="form-grid"><div><label>N kg/ha</label><input id="fertN" type="number" step="any"></div><div><label>P₂O₅ kg/ha</label><input id="fertP" type="number" step="any"></div><div><label>K₂O kg/ha</label><input id="fertK" type="number" step="any"></div><div><label>S kg/ha</label><input id="fertS" type="number" step="any"></div></div>`;
  else if(type==='aplicacion')b.innerHTML=`<div id="productRows"></div><button type="button" class="secondary-cta" id="addProduct">${icon('plus')} Agregar producto</button>`;
  else if(type==='cosecha')b.innerHTML=`<div class="form-grid"><div><label>Rendimiento (kg/ha)</label><input id="rendimiento" type="number" step="any"></div><div><label>Humedad (%)</label><input id="humedad" type="number" step="any"></div><div class="full"><label>Toneladas totales (opcional)</label><input id="toneladas" type="number" step="any"></div></div>`;
  else b.innerHTML='';
  if(type==='aplicacion'){addProductRow();document.getElementById('addProduct').onclick=addProductRow}refreshIcons();
}
function addProductRow(){const box=document.getElementById('productRows');if(!box)return;const d=document.createElement('div');d.className='product-row';d.innerHTML=`<input class="prodName" placeholder="Producto"><input class="prodDose" type="number" step="any" placeholder="Dosis"><input class="prodUnit" placeholder="Unidad">`;box.appendChild(d)}
async function saveLabor(zafra_id){
  const s=document.getElementById('status'),type=document.getElementById('laborType').value;if(!type){s.innerHTML=msg('Seleccioná el tipo de labor.','error');return}s.innerHTML=msg('Guardando…');
  const {data:l,error}=await db.from('labores').insert({owner_id:user.id,zafra_id,fecha:document.getElementById('laborDate').value,tipo_labor:type,observaciones:document.getElementById('laborObs').value}).select().single();if(error){s.innerHTML=msg(error.message,'error');return}
  let e=null;
  if(type==='siembra'){e=(await db.from('siembras').insert({owner_id:user.id,labor_id:l.id,densidad:+document.getElementById('densidad').value||null,unidad_densidad:document.getElementById('unidadDensidad').value,distancia_hileras_cm:+document.getElementById('distancia').value||null})).error}
  if(type==='fertilizacion'){e=(await db.from('fertilizaciones').insert({owner_id:user.id,labor_id:l.id,fertilizante:document.getElementById('fertNombre').value,dosis_kg_ha:+document.getElementById('fertDosis').value||0,n_kg_ha:+document.getElementById('fertN').value||0,p2o5_kg_ha:+document.getElementById('fertP').value||0,k2o_kg_ha:+document.getElementById('fertK').value||0,s_kg_ha:+document.getElementById('fertS').value||0})).error}
  if(type==='cosecha'){e=(await db.from('cosechas').insert({owner_id:user.id,labor_id:l.id,rendimiento_kg_ha:+document.getElementById('rendimiento').value||null,humedad_pct:+document.getElementById('humedad').value||null,toneladas_totales:+document.getElementById('toneladas').value||null})).error}
  if(type==='aplicacion'){const rows=[...document.querySelectorAll('.product-row')].map(r=>({owner_id:user.id,labor_id:l.id,producto:r.querySelector('.prodName').value,dosis:+r.querySelector('.prodDose').value||0,unidad_dosis:r.querySelector('.prodUnit').value})).filter(x=>x.producto);if(rows.length)e=(await db.from('productos_aplicados').insert(rows)).error}
  if(e){await db.from('labores').delete().eq('id',l.id);s.innerHTML=msg(e.message,'error');return}
  openSeason(zafra_id,'labores');
}

boot();
