// Archivos V3 — carpetas libres + almacenamiento privado con diseño aprobado
const _filesBaseLoadSeason=loadSeason;
loadSeason=async function(id){
  const z=await _filesBaseLoadSeason(id);
  const {data:folders}=await db.from('carpetas').select('*').eq('zafra_id',id).order('created_at',{ascending:true});
  const {data:files}=await db.from('archivos').select('*').eq('zafra_id',id).order('created_at',{ascending:false});
  return {...z,folders:folders||[],files:files||[]};
};
const _filesBaseRenderSeasonTab=renderSeasonTab;
renderSeasonTab=function(tab){
  if(tab!=='archivos')return _filesBaseRenderSeasonTab(tab);
  const z=currentSeason;if(!z)return;
  document.querySelectorAll('.section-tabs button').forEach(b=>b.classList.toggle('active',norm(b.textContent)==='archivos'));
  const box=document.getElementById('tabContent');
  const uncategorized=(z.files||[]).filter(f=>!f.carpeta_id);
  const folders=(z.folders||[]).map(folder=>{const fs=(z.files||[]).filter(f=>f.carpeta_id===folder.id);return `<article class="folder-card"><div class="folder-head"><div class="folder-icon">${icon('folder')}</div><div><h4>${esc(folder.nombre)}</h4><span>${fs.length} archivo${fs.length===1?'':'s'}</span></div><button onclick="renameFolder('${folder.id}','${esc(folder.nombre).replaceAll("'","&#39;")}')">${icon('pencil')}</button></div><div class="file-list">${fs.map(fileRow).join('')||'<p class="folder-empty">Carpeta vacía</p>'}</div><button class="folder-upload" onclick="chooseFile('${folder.id}')">${icon('upload')} Subir archivo</button></article>`}).join('');
  box.innerHTML=`<section class="tab-panel"><div class="panel-heading"><div><h3>Archivos</h3><p>Organizá documentos, mapas, fotos y planillas.</p></div><button class="small-action" onclick="newFolder('${z.id}')">${icon('folder-plus')} Carpeta</button></div><div class="file-search-row"><div class="searchbox">${icon('search')}<input id="fileSearch" placeholder="Buscar archivos..."></div><button class="filter-btn">${icon('sliders-horizontal')}<span>Filtros</span></button></div><div class="folder-grid">${folders||`<div class="illustrated-empty compact-empty">${icon('folders')}<p>Todavía no hay carpetas.</p></div>`}</div><div class="panel-heading section-separator"><div><h3>Archivos sin carpeta</h3></div><button class="small-action" onclick="chooseFile(null)">${icon('upload')} Archivo</button></div>${uncategorized.length?`<div class="file-list recent-files">${uncategorized.map(fileRow).join('')}</div>`:`<div class="illustrated-empty compact-empty">${icon('file')}<p>No hay archivos sueltos.</p></div>`}<div class="quick-actions"><button onclick="chooseFile(null)">${icon('upload')}<span>Subir archivo</span></button><button onclick="newFolder('${z.id}')">${icon('folder-plus')}<span>Nueva carpeta</span></button></div></section>`;
  const search=document.getElementById('fileSearch');if(search)search.oninput=()=>filterFiles(search.value);
  refreshIcons();
};
function fileRow(f){const size=f.tamano_bytes?formatBytes(f.tamano_bytes):'';return `<button class="file-row" data-file-name="${esc((f.nombre||'').toLowerCase())}" onclick="openStoredFile('${f.storage_path}')"><span class="doc-icon">${icon(fileIcon(f.mime_type,f.nombre))}</span><span class="file-name"><b>${esc(f.nombre)}</b><small>${esc(f.mime_type||'Archivo')}${size?' · '+size:''}</small></span>${icon('chevron-right')}</button>`}
function fileIcon(mime='',name=''){const n=norm(`${mime} ${name}`);if(n.includes('pdf'))return'file-text';if(n.includes('sheet')||n.includes('excel')||n.includes('xlsx'))return'sheet';if(n.includes('image')||n.includes('jpg')||n.includes('png'))return'image';return'file'}
function formatBytes(bytes){const n=Number(bytes)||0;if(n<1024)return`${n} B`;if(n<1048576)return`${(n/1024).toFixed(1)} KB`;return`${(n/1048576).toFixed(1)} MB`}
function filterFiles(q){const n=norm(q);document.querySelectorAll('.file-row').forEach(el=>el.style.display=!n||norm(el.dataset.fileName).includes(n)?'grid':'none')}
async function newFolder(zafra_id){
  setHeader('Nueva carpeta','ARCHIVOS');
  content.innerHTML=`<button class="back-link" onclick="openSeason('${zafra_id}','archivos')">${icon('arrow-left')} Volver</button><section class="form-section"><div class="section-title"><span>${icon('folder-plus')}</span><h3>Nueva carpeta</h3></div><label>Nombre de la carpeta</label><input id="folderName" placeholder="Ej. Análisis de suelo"><button id="saveFolder" class="primary-cta">Crear carpeta</button><div id="status"></div></section>${bottomNav('chacras')}`;
  document.getElementById('saveFolder').onclick=async()=>{const s=document.getElementById('status'),nombre=document.getElementById('folderName').value.trim();if(!nombre){s.innerHTML=msg('Ingresá un nombre.','error');return}s.innerHTML=msg('Guardando…');const {error}=await db.from('carpetas').insert({owner_id:user.id,zafra_id,nombre});error?s.innerHTML=msg(error.message,'error'):openSeason(zafra_id,'archivos')};refreshIcons();
}
async function renameFolder(folder_id,currentName){const nombre=window.prompt('Nuevo nombre de la carpeta',currentName);if(!nombre||!nombre.trim())return;const {error}=await db.from('carpetas').update({nombre:nombre.trim(),updated_at:new Date().toISOString()}).eq('id',folder_id);if(error){alert(error.message);return}await openSeason(currentSeason.id,'archivos')}
function chooseFile(folder_id){const input=document.createElement('input');input.type='file';input.accept='*/*';input.onchange=()=>{if(input.files?.[0])uploadFile(input.files[0],folder_id)};input.click()}
async function uploadFile(file,folder_id){const z=currentSeason;if(!z)return;const clean=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');const path=`${user.id}/${z.id}/${folder_id||'sin-carpeta'}/${Date.now()}_${clean}`;const up=await db.storage.from('archivos-chacras').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||undefined});if(up.error){alert(up.error.message);return}const row={owner_id:user.id,zafra_id:z.id,carpeta_id:folder_id||null,nombre:file.name,storage_path:path,mime_type:file.type||null,tamano_bytes:file.size||null};const ins=await db.from('archivos').insert(row);if(ins.error){await db.storage.from('archivos-chacras').remove([path]);alert(ins.error.message);return}await openSeason(z.id,'archivos')}
async function openStoredFile(path){const {data,error}=await db.storage.from('archivos-chacras').createSignedUrl(path,600);if(error){alert(error.message);return}window.open(data.signedUrl,'_blank','noopener,noreferrer')}
