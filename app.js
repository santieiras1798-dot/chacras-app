const content=document.querySelector('#content');
const logout=document.querySelector('#logout');
let db=null,user=null,currentSeason=null;

function msg(t,c='muted'){return `<p class="${c}">${t}</p>`}
function fmtDate(v){if(!v)return '—';const [y,m,d]=v.split('-');return `${d}/${m}/${y}`}
function val(v,suffix=''){return v===null||v===undefined||v===''?'—':`${v}${suffix}`}
function esc(v=''){return String(v).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;')}
function norm(v=''){return String(v).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'')}
function cropKey(v=''){
  const n=norm(v);
  if(n.includes('trigo'))return 'Trigo';
  if(n.includes('cebada'))return 'Cebada';
  if(n.includes('colza')||n.includes('canola'))return 'Colza';
  if(n.includes('maiz'))return 'Maíz';
  if(n.includes('soja'))return 'Soja';
  if(n.includes('sorgo'))return 'Sorgo';
  if(n.includes('girasol'))return 'Girasol';
  return String(v).trim();
}
const CULTIVOS=['Trigo','Cebada','Colza','Maíz','Soja','Sorgo','Girasol'];

async function boot(){
  const cfg=window.CHACRAS_CONFIG;
  if(!cfg?.SUPABASE_URL||!cfg?.SUPABASE_ANON_KEY){content.innerHTML=`<div class="card"><h2>Conexión pendiente</h2>${msg('Falta configurar Supabase.')}</div>`;return}
  db=supabase.createClient(cfg.SUPABASE_URL,cfg.SUPABASE_ANON_KEY);
  ({data:{user}}=await db.auth.getUser());
  user?home():auth();
}

function auth(){
  logout.hidden=true;
  content.innerHTML=`<div class="card auth-card"><h2>Ingresar</h2><input id="email" type="email" placeholder="Email"><input id="pass" type="password" placeholder="Contraseña"><button id="login">Entrar</button><button id="signup" class="ghost full">Crear cuenta</button><div id="status"></div></div>`;
  document.getElementById('login').onclick=()=>doAuth('signInWithPassword');
  document.getElementById('signup').onclick=()=>doAuth('signUp');
}

async function doAuth(m){
  const statusEl=document.getElementById('status');
  const emailValue=(document.getElementById('email')?.value||'').trim();
  const passwordValue=document.getElementById('pass')?.value||'';
  if(!emailValue||!passwordValue){statusEl.innerHTML=msg('Ingresá email y contraseña.','error');return}
  if(passwordValue.length<6){statusEl.innerHTML=msg('La contraseña debe tener al menos 6 caracteres.','error');return}
  statusEl.innerHTML=msg('Procesando…');
  const r=await db.auth[m]({email:emailValue,password:passwordValue});
  if(r.error){statusEl.innerHTML=msg(r.error.message,'error');return}
  ({data:{user}}=await db.auth.getUser());
  user?home():statusEl.innerHTML=msg('Cuenta creada. Revisá tu correo para confirmarla.','ok');
}

async function home(){
  currentSeason=null;logout.hidden=false;
  logout.onclick=async()=>{await db.auth.signOut();user=null;auth()};
  const {data:chacras,error}=await db.from('chacras').select('*,zafras(*)').order('created_at',{ascending:false});
  if(error){content.innerHTML=msg(error.message,'error');return}
  content.innerHTML=`<div class="row top-actions"><div><small>CAMPAÑAS</small><h2>Mis chacras</h2></div><button id="newField" class="compact">+ Chacra</button></div><div id="list">${(chacras||[]).map(c=>`<div class="card field-card"><div class="row"><div><h3>${esc(c.nombre)}</h3><div class="muted">${esc(c.establecimiento||'')}</div></div><div class="ha">${val(c.superficie_ha,' ha')}</div></div><div class="season-list">${(c.zafras||[]).map(z=>`<button class="season-chip" onclick="openSeason('${z.id}')"><b>${esc(z.zafra)}</b><span>${esc(z.cultivo)}${z.variedad?' · '+esc(z.variedad):''}</span></button>`).join('')}<button class="season-chip add" onclick="newSeason('${c.id}')">+ Nueva zafra</button></div></div>`).join('')||msg('Todavía no hay chacras cargadas.')}</div>`;
  document.getElementById('newField').onclick=newFieldForm;
}

function newFieldForm(){
  content.innerHTML=`<div class="card"><h2>Nueva chacra</h2><div class="grid"><input id="nombre" placeholder="Nombre"><input id="establecimiento" placeholder="Establecimiento"><input id="superficie" type="number" step="0.01" placeholder="Superficie (ha)"><input id="departamento" placeholder="Departamento"><input id="localidad" placeholder="Localidad"><input id="paraje" placeholder="Paraje (opcional)"></div><textarea id="descripcion" placeholder="Descripción (opcional)"></textarea><button id="save">Guardar chacra</button><button onclick="home()" class="ghost full">Cancelar</button><div id="status"></div></div>`;
  document.getElementById('save').onclick=async()=>{
    const {error}=await db.from('chacras').insert({owner_id:user.id,nombre:document.getElementById('nombre').value,establecimiento:document.getElementById('establecimiento').value,superficie_ha:+document.getElementById('superficie').value||null,departamento:document.getElementById('departamento').value,localidad:document.getElementById('localidad').value,paraje:document.getElementById('paraje').value,descripcion:document.getElementById('descripcion').value});
    error?document.getElementById('status').innerHTML=msg(error.message,'error'):home();
  };
}

async function newSeason(chacra_id){
  content.innerHTML=`<div class="card"><h2>Nueva zafra</h2><input id="zafra" placeholder="Ej. INV 2026"><label>Cultivo</label><select id="cultivo"><option value="">Seleccionar cultivo</option>${CULTIVOS.map(c=>`<option value="${c}">${c}</option>`).join('')}</select><input id="variedad" placeholder="Variedad / híbrido"><input id="antecesor" placeholder="Antecesor"><button id="save">Guardar zafra</button><button onclick="home()" class="ghost full">Cancelar</button><div id="status"></div></div>`;
  document.getElementById('save').onclick=async()=>{
    const cultivo=document.getElementById('cultivo').value;
    if(!cultivo){document.getElementById('status').innerHTML=msg('Seleccioná un cultivo.','error');return}
    const {error}=await db.from('zafras').insert({owner_id:user.id,chacra_id,zafra:document.getElementById('zafra').value,cultivo,variedad:document.getElementById('variedad').value,antecesor:document.getElementById('antecesor').value});
    error?document.getElementById('status').innerHTML=msg(error.message,'error'):home();
  };
}

async function loadSeason(id){
  const {data:z,error}=await db.from('zafras').select('*,chacras(*)').eq('id',id).single();if(error)throw error;
  const {data:rec}=await db.from('recorridas').select('*').eq('zafra_id',id).order('fecha',{ascending:false});
  const {data:lab}=await db.from('labores').select('*').eq('zafra_id',id).order('fecha',{ascending:false});
  const laborIds=(lab||[]).map(x=>x.id);let sow=null,harvest=null,ferts=[];
  if(laborIds.length){
    const {data:sows}=await db.from('siembras').select('*').in('labor_id',laborIds);
    const {data:harvests}=await db.from('cosechas').select('*').in('labor_id',laborIds);
    const {data:fertRows}=await db.from('fertilizaciones').select('*').in('labor_id',laborIds);
    if(sows?.length){const x=sows[0];sow={...x,labor:(lab||[]).find(l=>l.id===x.labor_id)}}
    if(harvests?.length){const x=harvests[0];harvest={...x,labor:(lab||[]).find(l=>l.id===x.labor_id)}}
    ferts=fertRows||[];
  }
  return {...z,recorridas:rec||[],labores:lab||[],sow,harvest,ferts};
}
function laborCounts(rows=[]){const out={aplicacion:0,fertilizacion:0,laboreo:0,siembra:0,cosecha:0};rows.forEach(r=>{if(out[r.tipo_labor]!==undefined)out[r.tipo_labor]++});return out}

async function openSeason(id,tab='recorridas'){
  try{currentSeason=await loadSeason(id)}catch(e){content.innerHTML=msg(e.message,'error');return}
  const z=currentSeason,last=z.recorridas[0];
  content.innerHTML=`<button class="back" onclick="home()">← Mis chacras</button><section class="season-hero"><div class="row"><div><small>${esc(z.zafra)}</small><h2>${esc(z.chacras.nombre)}</h2><div class="muted">${esc(z.chacras.establecimiento||'')}</div></div><div class="crop-badge">${esc(z.cultivo)}</div></div><div class="info-grid"><div class="info"><span>Variedad</span><b>${esc(z.variedad||'—')}</b></div><div class="info"><span>Antecesor</span><b>${esc(z.antecesor||'—')}</b></div><div class="info"><span>Fecha de siembra</span><b>${fmtDate(z.sow?.labor?.fecha)}</b></div><div class="info"><span>Densidad</span><b>${z.sow?`${val(z.sow.densidad)} ${esc(z.sow.unidad_densidad||'')}`:'—'}</b></div><div class="info"><span>Distancia hileras</span><b>${z.sow?val(z.sow.distancia_hileras_cm,' cm'):'—'}</b></div><div class="info"><span>Superficie</span><b>${val(z.chacras.superficie_ha,' ha')}</b></div></div><div class="summary-grid"><div class="summary-card"><span>Última recorrida</span><b>${last?fmtDate(last.fecha):'Sin recorridas'}</b><small>${last?`${esc(last.estadio_fenologico||'Sin estadio')} · Estado ${last.estado_cultivo||'—'}/5`:''}</small></div><div class="summary-card"><span>Cosecha</span><b>${z.harvest?fmtDate(z.harvest.labor?.fecha):'Pendiente'}</b><small>${z.harvest?.rendimiento_kg_ha?`${Number(z.harvest.rendimiento_kg_ha).toLocaleString('es-UY')} kg/ha`:''}</small></div></div></section><nav class="main-tabs"><button class="${tab==='recorridas'?'active':''}" onclick="renderSeasonTab('recorridas')">Recorridas</button><button class="${tab==='labores'?'active':''}" onclick="renderSeasonTab('labores')">Labores</button><button class="${tab==='nutricion'?'active':''}" onclick="renderSeasonTab('nutricion')">Nutrición</button><button class="${tab==='archivos'?'active':''}" onclick="renderSeasonTab('archivos')">Archivos</button></nav><div id="tabContent"></div>`;
  renderSeasonTab(tab);
}

function renderSeasonTab(tab){
  const z=currentSeason;if(!z)return;
  document.querySelectorAll('.main-tabs button').forEach(b=>b.classList.toggle('active',norm(b.textContent)===tab));
  const box=document.getElementById('tabContent');
  if(tab==='recorridas'){
    box.innerHTML=`<div class="section-head"><h3>Recorridas</h3><button class="compact" onclick="newVisit('${z.id}','${esc(z.cultivo)}')">+ Nueva</button></div>${z.recorridas.map(r=>`<div class="card visit"><div class="row"><b>${fmtDate(r.fecha)}</b><span class="stage">${esc(r.estadio_fenologico||'—')}</span></div><p>Estado del cultivo: <b>${r.estado_cultivo||'—'}/5</b></p>${r.observaciones?`<div class="muted">${esc(r.observaciones)}</div>`:''}</div>`).join('')||msg('Sin recorridas todavía.')}`;return;
  }
  if(tab==='labores'){
    const c=laborCounts(z.labores);box.innerHTML=`<div class="counter-grid"><div><b>${c.aplicacion}</b><span>Aplicaciones</span></div><div><b>${c.fertilizacion}</b><span>Fertilizaciones</span></div><div><b>${c.laboreo}</b><span>Laboreos</span></div><div><b>${c.siembra}</b><span>Siembra</span></div><div><b>${c.cosecha}</b><span>Cosecha</span></div></div><div class="section-head"><h3>Historial de labores</h3><button class="compact" disabled>+ Labor</button></div>${z.labores.map(l=>`<div class="card"><div class="row"><b>${fmtDate(l.fecha)}</b><span class="stage">${esc(l.tipo_labor)}</span></div>${l.observaciones?`<div class="muted">${esc(l.observaciones)}</div>`:''}</div>`).join('')||msg('Todavía no hay labores registradas.')}`;return;
  }
  if(tab==='nutricion'){
    const sum=z.ferts.reduce((a,f)=>({n:a.n+(+f.n_kg_ha||0),p:a.p+(+f.p2o5_kg_ha||0),k:a.k+(+f.k2o_kg_ha||0),s:a.s+(+f.s_kg_ha||0)}),{n:0,p:0,k:0,s:0});box.innerHTML=`<h3>Nutrición</h3><div class="nutrient-grid"><div><span>N</span><b>${sum.n.toFixed(1)}</b><small>kg/ha</small></div><div><span>P₂O₅</span><b>${sum.p.toFixed(1)}</b><small>kg/ha</small></div><div><span>K₂O</span><b>${sum.k.toFixed(1)}</b><small>kg/ha</small></div><div><span>S</span><b>${sum.s.toFixed(1)}</b><small>kg/ha</small></div></div>`;return;
  }
  box.innerHTML=`<h3>Archivos</h3>${msg('La estructura de carpetas y archivos ya existe en la base.')}`;
}

async function newVisit(zafra_id,cultivo){
  const canonical=cropKey(cultivo);
  const {data:allFen,error:fenError}=await db.from('fenologia_cultivos').select('cultivo,estadio,descripcion,orden').order('orden');
  const fen=(allFen||[]).filter(f=>norm(f.cultivo)===norm(canonical));
  const stageControl=fen.length?`<select id="estadio"><option value="">Seleccionar</option>${fen.map(f=>`<option value="${esc(f.estadio)}">${esc(f.estadio)}${f.descripcion?' — '+esc(f.descripcion):''}</option>`).join('')}</select>`:`<input id="estadio" placeholder="Ingresar estado fenológico"><p class="error">No encontré una escala cargada para “${esc(cultivo)}”. Podés ingresar el estadio manualmente.</p>`;
  content.innerHTML=`<button class="back" onclick="openSeason('${zafra_id}')">← Volver</button><div class="card"><h2>Nueva recorrida</h2><div class="muted">Cultivo: <b>${esc(canonical||cultivo)}</b></div><label>Fecha</label><input id="fecha" type="date" value="${new Date().toISOString().slice(0,10)}"><label>Estado fenológico</label>${stageControl}<label>Estado del cultivo</label><select id="estado"><option value="">Seleccionar</option>${[1,2,3,4,5].map(n=>`<option value="${n}">${n}/5</option>`).join('')}</select><label>Observaciones</label><textarea id="observaciones" placeholder="Observaciones de la recorrida"></textarea><button id="save">Guardar recorrida</button><div id="status">${fenError?msg(fenError.message,'error'):''}</div></div>`;
  document.getElementById('save').onclick=async()=>{
    const {error}=await db.from('recorridas').insert({owner_id:user.id,zafra_id,fecha:document.getElementById('fecha').value,estadio_fenologico:document.getElementById('estadio').value,estado_cultivo:+document.getElementById('estado').value||null,observaciones:document.getElementById('observaciones').value});
    error?document.getElementById('status').innerHTML=msg(error.message,'error'):openSeason(zafra_id);
  };
}

boot();