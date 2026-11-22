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
export function createMediaService({scan,barrier=Promise.resolve(),allowed=()=>true,windows=false,describe,perform,onRefresh=()=>{}}){
 let dead=false,serial=0,viewSerial=0,generation=0,pending=Promise.resolve(barrier);const handles=new Map();
 const report=(section,status,count=0)=>{try{onRefresh({section,status,count});}catch{}};
 function open(section,downloadPaths=()=>new Set()){
   if(dead||!allowed()||!MEDIA_EXTENSIONS[section])throw Error("Media unavailable");
   let closed=false,owned=new Map(),cache=null,revision=0;
   const openedAt=generation;
   const available=()=>!closed&&!dead&&openedAt===generation&&allowed();
   async function refresh(){
     if(!available())return null;
     const token=++revision;
     const task=pending.catch(()=>{}).then(()=>!available()||token!==revision?[]:scan(section));
     pending=task.catch(()=>{});
     let files;
     try{files=await task;}catch(error){if(available()&&token===revision)report(section,"error");throw error;}
     if(!available()||token!==revision)return null;
     let next,result;
     try{
       next=new Map();result=[];const seen=new Set(downloadPaths());
       for(const f of files.slice(0,300)){
         if(!f?.path||f.cloudPlaceholder||mediaKind(f.path)!==section)continue;
         const key=mediaPathKey(f.path,windows);if(seen.has(key))continue;seen.add(key);
         const prior=owned.get(key),id="local-"+(++serial),viewKey=prior?.viewKey??"local-view-"+(++viewSerial),row=describe(f,id);
         if(!row)continue;
         next.set(key,{id,path:f.path,viewKey});result.push(Object.freeze({...row,id,viewKey}));
       }
     }catch(error){if(available()&&token===revision)report(section,"error");throw error;}
     if(!available()||token!==revision)return null;
     for(const {id} of owned.values())handles.delete(id);
     owned=next;
     for(const {id,path} of owned.values())handles.set(id,path);
     cache=Object.freeze(result);report(section,"committed",cache.length);return cache;
   }
   return {refresh,rows:()=>{if(!available())return [];const known=downloadPaths();return (cache||[]).filter(r=>!known.has(mediaPathKey(handles.get(r.id),windows)));},close(){closed=true;++revision;for(const {id} of owned.values())handles.delete(id);owned.clear();cache=null;}};
 }
 function action(id,kind){if(dead||!allowed()||!handles.has(id)||!["open","reveal"].includes(kind))return false;return perform(handles.get(id),kind);}
 function invalidate(){++generation;handles.clear();}
 function dispose(){dead=true;invalidate();return pending.catch(()=>{});}
 return {open,action,invalidate,dispose};
}
