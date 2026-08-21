// Módulo Archivos V1: carpetas libres + renombrar + subir + abrir archivos privados
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
  document.querySelectorAll('.main-tabs button').forEach(b=>b.classList.toggle('active',norm(b.textContent)==='archivos'));
  const box=document.getElementById('tabContent');
  const uncategorized=(z.files||[]).filter(f=>!f.carpeta_id);
  const folders=(z.folders||[]).map(folder=>{
    const fs=(z.files||[]).filter(f=>f.carpeta_id===folder.id);
    return `<div class="card folder-card"><div class="row"><div><b>📁 ${esc(folder.nombre)}</b><div class="muted">${fs.length} archivo${fs.length===1?'':'s'}</div></div><button class="ghost compact" onclick="renameFolder('${folder.id}','${esc(folder.nombre).replaceAll("'","&#39;")}')">Renombrar</button></div><div class="file-list">${fs.map(fileRow).join('')||'<div class="muted">Carpeta vacía</div>'}</div><button class="ghost full" onclick="chooseFile('${folder.id}')">+ Subir archivo</button></div>`;
  }).join('');
  box.innerHTML=`<div class="section-head"><h3>Archivos</h3><button class="compact" onclick="newFolder('${z.id}')">+ Carpeta</button></div>${folders||msg('Todavía no hay carpetas. Creá la primera con el nombre que quieras.')}<div class="section-head"><h3>Sin carpeta</h3><button class="compact" onclick="chooseFile(null)">+ Archivo</button></div>${uncategorized.length?`<div class="card"><div class="file-list">${uncategorized.map(fileRow).join('')}</div></div>`:msg('No hay archivos sueltos.')}`;
};

function fileRow(f){
  const size=f.tamano_bytes?formatBytes(f.tamano_bytes):'';
  return `<button class="file-row" onclick="openStoredFile('${f.storage_path}')"><span>📄</span><span class="file-name">${esc(f.nombre)}</span><small>${esc(f.mime_type||'')}${size?' · '+size:''}</small></button>`;
}
function formatBytes(bytes){const n=Number(bytes)||0;if(n<1024)return `${n} B`;if(n<1048576)return `${(n/1024).toFixed(1)} KB`;return `${(n/1048576).toFixed(1)} MB`}

async function newFolder(zafra_id){
  const nombre=prompt('Nombre de la carpeta');
  if(!nombre||!nombre.trim())return;
  const {error}=await db.from('carpetas').insert({owner_id:user.id,zafra_id,nombre:nombre.trim()});
  if(error){alert(error.message);return}
  await openSeason(zafra_id,'archivos');
}

async function renameFolder(folder_id,currentName){
  const nombre=prompt('Nuevo nombre de la carpeta',currentName);
  if(!nombre||!nombre.trim())return;
  const {error}=await db.from('carpetas').update({nombre:nombre.trim(),updated_at:new Date().toISOString()}).eq('id',folder_id);
  if(error){alert(error.message);return}
  await openSeason(currentSeason.id,'archivos');
}

function chooseFile(folder_id){
  const input=document.createElement('input');input.type='file';input.accept='*/*';
  input.onchange=()=>{if(input.files?.[0])uploadFile(input.files[0],folder_id)};
  input.click();
}

async function uploadFile(file,folder_id){
  const z=currentSeason;if(!z)return;
  const clean=file.name.replace(/[^a-zA-Z0-9._-]/g,'_');
  const path=`${user.id}/${z.id}/${folder_id||'sin-carpeta'}/${Date.now()}_${clean}`;
  const box=document.getElementById('tabContent');
  if(box)box.insertAdjacentHTML('afterbegin',msg('Subiendo archivo…'));
  const up=await db.storage.from('archivos-chacras').upload(path,file,{cacheControl:'3600',upsert:false,contentType:file.type||undefined});
  if(up.error){alert(up.error.message);await openSeason(z.id,'archivos');return}
  const row={owner_id:user.id,zafra_id:z.id,carpeta_id:folder_id||null,nombre:file.name,storage_path:path,mime_type:file.type||null,tamano_bytes:file.size||null};
  const ins=await db.from('archivos').insert(row);
  if(ins.error){await db.storage.from('archivos-chacras').remove([path]);alert(ins.error.message);await openSeason(z.id,'archivos');return}
  await openSeason(z.id,'archivos');
}

async function openStoredFile(path){
  const {data,error}=await db.storage.from('archivos-chacras').createSignedUrl(path,60*10);
  if(error){alert(error.message);return}
  window.open(data.signedUrl,'_blank','noopener,noreferrer');
}
