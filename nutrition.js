// Módulo Nutrición V1: análisis + fertilizantes aplicados + sumatoria de nutrientes
const _baseLoadSeason=loadSeason;
loadSeason=async function(id){
  const z=await _baseLoadSeason(id);
  const {data:analyses}=await db.from('analisis').select('*').eq('zafra_id',id).order('fecha',{ascending:false});
  const analysisIds=(analyses||[]).map(a=>a.id);
  let results=[];
  if(analysisIds.length){const r=await db.from('resultados_analisis').select('*').in('analisis_id',analysisIds);results=r.data||[]}
  return {...z,analyses:analyses||[],analysisResults:results};
};

const _baseRenderSeasonTab=renderSeasonTab;
renderSeasonTab=function(tab){
  if(tab!=='nutricion')return _baseRenderSeasonTab(tab);
  const z=currentSeason;if(!z)return;
  document.querySelectorAll('.main-tabs button').forEach(b=>b.classList.toggle('active',norm(b.textContent)==='nutricion'));
  const box=document.getElementById('tabContent');
  const sum=z.ferts.reduce((a,f)=>({n:a.n+(+f.n_kg_ha||0),p:a.p+(+f.p2o5_kg_ha||0),k:a.k+(+f.k2o_kg_ha||0),s:a.s+(+f.s_kg_ha||0)}),{n:0,p:0,k:0,s:0});
  const fertilizerRows=(z.ferts||[]).map(f=>{const labor=z.labores.find(l=>l.id===f.labor_id);return `<div class="card"><div class="row"><div><b>${esc(f.fertilizante)}</b><div class="muted">${fmtDate(labor?.fecha)} · ${Number(f.dosis_kg_ha||0).toLocaleString('es-UY')} kg/ha</div></div><span class="stage">Fertilización</span></div><div class="nutrition-line"><span>N <b>${num(f.n_kg_ha)}</b></span><span>P₂O₅ <b>${num(f.p2o5_kg_ha)}</b></span><span>K₂O <b>${num(f.k2o_kg_ha)}</b></span><span>S <b>${num(f.s_kg_ha)}</b></span></div></div>`}).join('');
  const analysisRows=(z.analyses||[]).map(a=>{const rs=(z.analysisResults||[]).filter(r=>r.analisis_id===a.id);return `<div class="card"><div class="row"><div><b>${esc(a.tipo)}</b><div class="muted">${fmtDate(a.fecha)}${a.estadio?' · '+esc(a.estadio):''}${a.profundidad?' · '+esc(a.profundidad):''}</div></div><span class="stage">Análisis</span></div>${rs.length?`<div class="analysis-results">${rs.map(r=>`<span><b>${esc(r.parametro)}</b> ${r.valor??esc(r.valor_texto||'—')} ${esc(r.unidad||'')}</span>`).join('')}</div>`:''}${a.observaciones?`<div class="muted">${esc(a.observaciones)}</div>`:''}</div>`}).join('');
  box.innerHTML=`<div class="section-head"><h3>Nutrición</h3></div><div class="nutrient-grid"><div><span>N</span><b>${sum.n.toFixed(1)}</b><small>kg/ha</small></div><div><span>P₂O₅</span><b>${sum.p.toFixed(1)}</b><small>kg/ha</small></div><div><span>K₂O</span><b>${sum.k.toFixed(1)}</b><small>kg/ha</small></div><div><span>S</span><b>${sum.s.toFixed(1)}</b><small>kg/ha</small></div></div><div class="nutrition-actions"><button class="compact" onclick="newAnalysis('${z.id}')">+ Análisis</button><button class="compact" onclick="newNutritionFertilizer('${z.id}')">+ Fertilizante</button></div><div class="section-head"><h3>Análisis</h3></div>${analysisRows||msg('Todavía no hay análisis cargados.')}<div class="section-head"><h3>Fertilizantes aplicados</h3></div>${fertilizerRows||msg('Todavía no hay fertilizaciones cargadas.')}`;
};

function num(v){return Number(v||0).toFixed(1)}

async function newAnalysis(zafra_id){
  const z=currentSeason||await loadSeason(zafra_id);
  content.innerHTML=`<button class="back" onclick="openSeason('${zafra_id}','nutricion')">← Volver</button><div class="card"><h2>Nuevo análisis</h2><label>Fecha</label><input id="ana_fecha" type="date" value="${new Date().toISOString().slice(0,10)}"><label>Tipo</label><select id="ana_tipo"><option>Suelo</option><option>Planta</option><option>Tejido</option><option>Otro</option></select><label>Estado fenológico</label><input id="ana_estadio" placeholder="Ej. Z22, C1, V6"><label>Profundidad</label><input id="ana_prof" placeholder="Ej. 0–20 cm"><label>Resultados</label><div id="resultRows"></div><button type="button" class="ghost full" id="addResult">+ Agregar parámetro</button><label>Observaciones</label><textarea id="ana_obs" placeholder="Observaciones"></textarea><button id="saveAnalysis">Guardar análisis</button><div id="status"></div></div>`;
  const rows=document.getElementById('resultRows');
  function addRow(){const d=document.createElement('div');d.className='analysis-row';d.innerHTML=`<input class="param" placeholder="Parámetro (ej. NO₃)"><input class="value" type="number" step="any" placeholder="Valor"><input class="unit" placeholder="Unidad (ppm, %, kg/ha)">`;rows.appendChild(d)}
  addRow();document.getElementById('addResult').onclick=addRow;
  document.getElementById('saveAnalysis').onclick=async()=>{
    const status=document.getElementById('status');status.innerHTML=msg('Guardando…');
    const {data:a,error}=await db.from('analisis').insert({owner_id:user.id,zafra_id,fecha:document.getElementById('ana_fecha').value,tipo:document.getElementById('ana_tipo').value,estadio:document.getElementById('ana_estadio').value,profundidad:document.getElementById('ana_prof').value,observaciones:document.getElementById('ana_obs').value}).select().single();
    if(error){status.innerHTML=msg(error.message,'error');return}
    const resultData=[...document.querySelectorAll('.analysis-row')].map(r=>({owner_id:user.id,analisis_id:a.id,parametro:r.querySelector('.param').value.trim(),valor:r.querySelector('.value').value===''?null:+r.querySelector('.value').value,unidad:r.querySelector('.unit').value.trim()})).filter(r=>r.parametro);
    if(resultData.length){const rr=await db.from('resultados_analisis').insert(resultData);if(rr.error){status.innerHTML=msg(rr.error.message,'error');return}}
    openSeason(zafra_id,'nutricion');
  };
}

async function newNutritionFertilizer(zafra_id){
  content.innerHTML=`<button class="back" onclick="openSeason('${zafra_id}','nutricion')">← Volver</button><div class="card"><h2>Fertilizante aplicado</h2><label>Fecha</label><input id="fert_fecha" type="date" value="${new Date().toISOString().slice(0,10)}"><label>Fertilizante</label><input id="fert_nombre" placeholder="Ej. Urea azufrada"><label>Dosis de fertilizante</label><input id="fert_dosis" type="number" step="any" placeholder="kg/ha"><h3>Nutrientes aplicados</h3><div class="grid"><input id="fert_n" type="number" step="any" placeholder="N kg/ha"><input id="fert_p" type="number" step="any" placeholder="P₂O₅ kg/ha"><input id="fert_k" type="number" step="any" placeholder="K₂O kg/ha"><input id="fert_s" type="number" step="any" placeholder="S kg/ha"></div><label>Observaciones</label><textarea id="fert_obs"></textarea><button id="saveFert">Guardar fertilización</button><div id="status"></div></div>`;
  document.getElementById('saveFert').onclick=async()=>{
    const s=document.getElementById('status');s.innerHTML=msg('Guardando…');
    const {data:labor,error}=await db.from('labores').insert({owner_id:user.id,zafra_id,fecha:document.getElementById('fert_fecha').value,tipo_labor:'fertilizacion',observaciones:document.getElementById('fert_obs').value}).select().single();
    if(error){s.innerHTML=msg(error.message,'error');return}
    const payload={labor_id:labor.id,owner_id:user.id,fertilizante:document.getElementById('fert_nombre').value,dosis_kg_ha:+document.getElementById('fert_dosis').value||0,n_kg_ha:+document.getElementById('fert_n').value||0,p2o5_kg_ha:+document.getElementById('fert_p').value||0,k2o_kg_ha:+document.getElementById('fert_k').value||0,s_kg_ha:+document.getElementById('fert_s').value||0};
    const r=await db.from('fertilizaciones').insert(payload);if(r.error){await db.from('labores').delete().eq('id',labor.id);s.innerHTML=msg(r.error.message,'error');return}
    openSeason(zafra_id,'nutricion');
  };
}
