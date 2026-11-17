// Local file classification and explicitly enabled scan sessions.
export const MEDIA_EXTENSIONS=Object.freeze({
 documents:Object.freeze(["pdf","txt","md","rtf","doc","docx","odt","xls","xlsx","ods","ppt","pptx","odp","csv","epub"]),
 pictures:Object.freeze(["png","jpg","jpeg","webp","gif","bmp","avif","heic","heif","tiff","tif","ico","svg"])
});
export function mediaKind(name){
 const match=/\.([^.\\/]+)$/.exec(String(name));const ext=match?.[1].toLowerCase();
 return Object.keys(MEDIA_EXTENSIONS).find(k=>MEDIA_EXTENSIONS[k].includes(ext))||null;
}
export function mediaPathKey(path,windows=false){
 const value=String(path);return windows?value.replace(/\\/g,"/").toLowerCase():value;
}
export function safeRaster(name,size){
 return /\.(png|jpe?g|webp|avif|gif|bmp)$/i.test(String(name))&&Number.isFinite(size)&&size>0&&size<=2097152;
}
export function downloadFileStatus(row){
 return row.blocked?"Blocked":row.active?"Downloading":row.failed?"Failed":row.canceled?"Canceled":row.partial?"Paused":row.success?(row.exists?"Completed":"File missing"):"Stopped";
}
export function queryDownloadRows(rows,{section="downloads",text="",limit=50,sort="new",filter="all"}={}){
 const term=String(text).trim().toLowerCase();
 const list=rows.filter(r=>(section==="downloads"||(r.success&&r.exists&&!r.partial&&!r.blocked&&mediaKind(r.name)===section))&&
   (!term||r.name.toLowerCase().includes(term))&&(filter==="all"||(filter==="active"?r.active:filter==="completed"?r.success:!r.active&&!r.success)));
 list.sort((a,b)=>Number(!!b.active)-Number(!!a.active)||(sort==="size"?((b.total||b.bytes||0)-(a.total||a.bytes||0)):sort==="old"?a.time-b.time:b.time-a.time)||a.id.localeCompare(b.id));
 return Object.freeze({rows:Object.freeze(list.slice(0,limit)),limit,hasMore:list.length>limit});
}
export function createMediaService({scan,allowed=()=>true,windows=false,describe,perform}){
 let dead=false,serial=0,pending=Promise.resolve();const handles=new Map();
 function open(section,downloadPaths=()=>new Set()){
   if(dead||!allowed()||!MEDIA_EXTENSIONS[section])throw Error("Media unavailable");
   let closed=false,owned=new Set(),cache=null,revision=0;
   async function refresh(){
     const token=++revision;
     const task=pending.catch(()=>{}).then(()=>closed||dead||!allowed()||token!==revision?[]:scan(section));
     pending=task.catch(()=>{});const files=await task;
     if(closed||dead||!allowed()||token!==revision)return null;
     for(const id of owned)handles.delete(id);owned.clear();
     const result=[],seen=new Set(downloadPaths());
     for(const f of files.slice(0,300)){
       if(!f?.path||f.cloudPlaceholder||mediaKind(f.path)!==section)continue;
       const key=mediaPathKey(f.path,windows);if(seen.has(key))continue;seen.add(key);
       const id="local-"+(++serial),row=describe(f,id);
       if(!row)continue;
       handles.set(id,f.path);owned.add(id);result.push(Object.freeze(row));
     }
     cache=Object.freeze(result);return cache;
   }
   return {refresh,rows:()=>{const known=downloadPaths();return (cache||[]).filter(r=>!known.has(mediaPathKey(handles.get(r.id),windows)));},close(){closed=true;++revision;for(const id of owned)handles.delete(id);owned.clear();cache=null;}};
 }
 function action(id,kind){if(dead||!allowed()||!handles.has(id)||!["open","reveal"].includes(kind))return false;return perform(handles.get(id),kind);}
 function dispose(){dead=true;handles.clear();}
 return {open,action,dispose};
}
