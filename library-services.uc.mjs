// Synchronous acquisition scope. Each release is attempted at most once;
// the original outcome is retained. Native failures are never retried implicitly.
function createDisposableScope({onError=()=>{}}={}){
  let closed=false,disposing=null;
  const releases=new Set();
  function defer(label,cleanup){
    if(typeof cleanup!=="function")throw new TypeError("Expected cleanup function");
    let active=true,outcome=false;
    const release=()=>{
      if(!active)return outcome;
      active=false;releases.delete(release);
      const run=cleanup;cleanup=null;
      try{run();outcome=true;}
      catch(error){try{onError(label,error);}catch{}}
      // Count nested and late releases during the same disposal, too.
      if(disposing)disposing[outcome?"released":"failed"]++;
      return outcome;
    };
    if(closed)release();else releases.add(release);
    return release;
  }
  function listen(node,type,fn,options){
    if(closed)throw Error("Disposable scope closed");
    const capture=typeof options==="boolean"?options:!!options?.capture;
    let callback=fn;
    const guarded=function(event){
      if(closed||!callback)return;
      if(typeof callback==="function")return callback.call(this,event);
      return callback.handleEvent(event);
    };
    // Keep the exact registered wrapper and invalidate it even if native
    // removal fails. Register cleanup after add so synchronous disposal
    // inside acquisition immediately releases the newly attached wrapper.
    try{node.addEventListener(type,guarded,options);}
    catch(error){
      defer("listener",()=>{callback=null;node.removeEventListener(type,guarded,capture);})();
      throw error;
    }
    return defer("listener",()=>{callback=null;node.removeEventListener(type,guarded,capture);});
  }
  function dispose(){
    if(closed)return {released:0,failed:0};
    closed=true;
    const result={released:0,failed:0};disposing=result;
    try{
      for(const release of [...releases].reverse()){
        if(releases.has(release))release();
      }
    }finally{disposing=null;}
    return result;
  }
  return {defer,listen,dispose,get closed(){return closed;},get size(){return releases.size;}};
}
// Local file classification and explicitly enabled scan sessions.
const MEDIA_EXTENSIONS=Object.freeze({
 documents:Object.freeze(["pdf","txt","md","rtf","doc","docx","odt","xls","xlsx","ods","ppt","pptx","odp","csv","epub"]),
 pictures:Object.freeze(["png","jpg","jpeg","webp","gif","bmp","avif","heic","heif","tiff","tif","ico","svg"])
});
function mediaKind(name){
 const match=/\.([^.\\/]+)$/.exec(String(name));const ext=match?.[1].toLowerCase();
 return Object.keys(MEDIA_EXTENSIONS).find(k=>MEDIA_EXTENSIONS[k].includes(ext))||null;
}
function mediaPathKey(path,windows=false){
 const value=String(path);return windows?value.replace(/\\/g,"/").toLowerCase():value;
}
function safeRaster(name,size){
 return /\.(png|jpe?g|webp|avif|gif|bmp)$/i.test(String(name))&&Number.isFinite(size)&&size>0&&size<=2097152;
}
function downloadFileStatus(row){
 return row.blocked?"Blocked":row.active?"Downloading":row.failed?"Failed":row.canceled?"Canceled":row.partial?"Paused":row.success?(row.exists?"Completed":"File missing"):"Stopped";
}
function queryDownloadRows(rows,{section="downloads",text="",limit=50,sort="new",filter="all"}={}){
 const term=String(text).trim().toLowerCase();
 const list=rows.filter(r=>(section==="downloads"||(r.success&&r.exists&&!r.partial&&!r.blocked&&mediaKind(r.name)===section))&&
   (!term||r.name.toLowerCase().includes(term))&&(filter==="all"||(filter==="active"?r.active:filter==="completed"?r.success:!r.active&&!r.success)));
 list.sort((a,b)=>Number(!!b.active)-Number(!!a.active)||(sort==="size"?((b.total||b.bytes||0)-(a.total||a.bytes||0)):sort==="old"?a.time-b.time:b.time-a.time)||a.id.localeCompare(b.id));
 return Object.freeze({rows:Object.freeze(list.slice(0,limit)),limit,hasMore:list.length>limit});
}
function createMediaService({scan,barrier=Promise.resolve(),allowed=()=>true,windows=false,describe,perform}){
 let dead=false,serial=0,pending=Promise.resolve(barrier);const handles=new Map();
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
 function dispose(){dead=true;handles.clear();return pending.catch(()=>{});}
 return {open,action,dispose};
}
// One native list subscription per window, independent of any view.
  function createDownloadsService({loadList,barrier=Promise.resolve(),lease=null,onError=()=>{},onDetach=()=>{},idPrefix="download",describeFile=()=>({}),dragFile=()=>false}){
    let dead=false,source=null,pending=null,detaching=null,ready=false,accepting=false,serial=0;
    const records=new Map(),byId=new Map(),listeners=new Set(),nativeListeners=new Set();
    const report=()=>{try{onError();}catch{}};
    const safe=(fn,...args)=>{try{fn(...args);}catch{report();}};
    const number=n=>Number.isFinite(n)?Math.max(0,n):0;
    const clearable=d=>!!(d.stopped&&!d.hasPartialData&&!d.hasBlockedData);
    const completed=d=>!!(d.succeeded&&!d.error&&!d.canceled&&!d.hasPartialData&&!d.hasBlockedData);
    function normalize(d,id){
      return Object.freeze({id,name:String(d.target?.path||"").split(/[\\/]/).pop()||"Download",
        time:number(Number(d.startTime)),bytes:number(d.currentBytes),total:number(d.totalBytes),speed:number(d.speed),
        known:!!d.hasProgress&&number(d.totalBytes)>0,active:!d.stopped&&!d.succeeded&&!d.error&&!d.canceled,
        success:!!d.succeeded,failed:!!d.error,canceled:!!d.canceled,partial:!!d.hasPartialData,blocked:!!d.hasBlockedData,
        exists:d.target?.exists!==false,clearable:clearable(d),kind:"download",...describeFile(d)});
    }
    function emit(kind,d){
      if(dead||!accepting)return;
      let rec=records.get(d);
      if(kind==="onDownloadRemoved"){
        if(!rec)return;
        records.delete(d);byId.delete(rec.id);
      }else{
        if(!rec){rec={id:idPrefix+"-"+(++serial),value:null};records.set(d,rec);byId.set(rec.id,d);}
        rec.value=normalize(d,rec.id);
      }
      if(!ready)return;
      for(const l of [...nativeListeners])if(nativeListeners.has(l))safe(l[kind]||(()=>{}),d);
      for(const fn of [...listeners])if(listeners.has(fn))safe(fn,{type:kind,id:rec.id});
    }
    const view={onDownloadAdded:d=>emit("onDownloadAdded",d),onDownloadChanged:d=>emit("onDownloadChanged",d),onDownloadRemoved:d=>emit("onDownloadRemoved",d)};
    function releaseLease(){if(lease?.release===dispose)lease.release=null;}
    async function detach(){
      accepting=false;
      const list=source;
      if(!list){releaseLease();return true;}
      let released=false;
      // Gecko DownloadList.removeView deletes the exact view from a Set;
      // retrying this identity is safe even if an earlier attempt removed it.
      try{await list.removeView(view);released=true;source=null;releaseLease();}
      catch{report();}
      try{onDetach({released,retained:!released});}catch{}
      return released;
    }
    function start(){
      if(dead)return Promise.reject(Error("Downloads service disposed"));
      if(ready)return Promise.resolve();
      if(pending)return pending;
      pending=(async()=>{
        if(await barrier===false)throw Error("Previous Downloads detach unresolved");
        if(dead)throw Error("Downloads service disposed");
        // One stable per-window lease survives a failed detach and any number
        // of reloads. No second native view may attach until release succeeds.
        while(lease?.release&&lease.release!==dispose){
          if(!await lease.release())throw Error("Previous Downloads detach unresolved");
          if(dead)throw Error("Downloads service disposed");
        }
        if(source&&!await detach())throw Error("Downloads detach unresolved");
        if(dead)throw Error("Downloads service disposed");
        // Retrying our own failed acquisition releases the lease; another
        // generation may have claimed it during that await.
        while(lease?.release&&lease.release!==dispose){
          if(!await lease.release())throw Error("Previous Downloads detach unresolved");
          if(dead)throw Error("Downloads service disposed");
        }
        if(lease)lease.release=dispose;
        try{
          const list=await loadList();
          if(dead)throw Error("Downloads service disposed");
          if(typeof list?.addView!=="function"||typeof list?.removeView!=="function")throw Error("Native Downloads list unavailable");
          source=list;accepting=true;
          await list.addView(view);
          if(dead)throw Error("Downloads service disposed");
          ready=true;
        }catch(error){
          accepting=false;
          // Disposal owns the pending addView rollback when cancellation won.
          if(!dead)await detach();
          records.clear();byId.clear();throw error;
        }
      })().finally(()=>{pending=null;});
      return pending;
    }
    function subscribeNative(observer){
      if(dead||!ready)throw Error("Downloads service not ready");
      nativeListeners.add(observer);
      // Initial replay is synchronous, exactly once per subscriber.
      // The Dock's hydration guard suppresses historical notifications.
      for(const d of [...records.keys()])if(nativeListeners.has(observer))safe(observer.onDownloadAdded||(()=>{}),d);
      return ()=>nativeListeners.delete(observer);
    }
    function subscribe(fn){
      if(dead||!ready)throw Error("Downloads service not ready");
      listeners.add(fn);return ()=>listeners.delete(fn);
    }
    function getSnapshot(){
      if(dead||!ready)return Object.freeze([]);
      return Object.freeze([...records.values()].map(r=>r.value));
    }
    async function actionNative(d,action){
      if(dead||!ready||!source||!records.has(d))return false;
      if(action==="remove"){
        if(!clearable(d))return false;
        await source.remove(d);return true;
      }
      if(!completed(d))return false;
      if(action==="open"&&d.target?.exists!==false&&typeof d.launch==="function"){await d.launch();return true;}
      if(action==="reveal"&&typeof d.showContainingDirectory==="function"){await d.showContainingDirectory();return true;}
      return false;
    }
    function action(id,kind){return actionNative(byId.get(id),kind);}
    function pathKeys(windows=false){return new Set([...records.keys()].filter(d=>completed(d)&&d.target?.exists!==false).map(d=>d.target?.path).filter(Boolean).map(p=>windows?String(p).replace(/\\/g,"/").toLowerCase():String(p)));}
    function withNative(id,fn){const d=byId.get(id);return !!(!dead&&ready&&d&&completed(d)&&typeof fn==="function"&&fn(d));}
    function drag(id,event,node){const d=byId.get(id);return !!(!dead&&ready&&d&&completed(d)&&dragFile(d,event,node));}
    async function clearCompleted(){
      const targets=[...records.keys()].filter(clearable);let removed=0,failed=0;
      for(const d of targets)try{if(await actionNative(d,"remove"))removed++;}catch{failed++;}
      return {removed,failed};
    }
    function isReady(){return !dead&&ready;}
    function dispose(){
      if(detaching)return detaching;
      dead=true;ready=false;accepting=false;listeners.clear();nativeListeners.clear();records.clear();byId.clear();
      // A generation awaiting only a barrier or loadList owns no native
      // view. Its late continuation checks dead before addView. Do not make
      // a replacement wait for a read that can no longer attach anything.
      if(!source){releaseLease();return Promise.resolve(true);}
      // Once addView has begun, finish it before removing the exact view.
      // Failed removal retains its handle and lease for explicit retry.
      detaching=(async()=>{try{await pending;}catch{}return detach();})().finally(()=>{detaching=null;});
      return detaching;
    }
    return {start,subscribeNative,subscribe,getSnapshot,action,actionNative,pathKeys,withNative,drag,clearCompleted,isReady,remove:d=>actionNative(d,"remove"),dispose};
  }
// PlacesQuery uses a Map of grouped visits or an array of search results.
  function createHistorySession({createQuery,allowed=()=>true,onChange=()=>{},now=Date.now}){
    if(!allowed())throw Error("History unavailable in this window");
    const native=createQuery();let closed=false,epoch=0;
    if(typeof native?.getHistory!=="function"||typeof native.searchHistory!=="function"||typeof native.close!=="function"){
      native?.close?.();throw Error("PlacesQuery unavailable");
    }
    try{native.observeHistory?.(()=>{if(!closed&&allowed())onChange();});}catch(error){native.close();throw error;}
    async function query({text="",days=120,limit=100,sort="date"}={}){
      if(closed||!allowed())throw Error("History session unavailable");
      const token=++epoch,term=String(text).trim().slice(0,1024);
      const count=Math.min(5000,Math.max(1,Math.trunc(Number(limit)||100)));
      const range=Math.min(36500,Math.max(1,Math.trunc(Number(days)||120)));
      const order=["date","site","lastvisited"].includes(sort)?sort:"date";
      const result=term?await native.searchHistory(term,count):await native.getHistory({daysOld:range,limit:count,sortBy:order});
      if(closed||token!==epoch||!allowed())return null;
      const rows=[],seen=new Set();let rawCount=0;
      const groups=Array.isArray(result)?[[null,result]]:result instanceof Map?[...result]:[];
      for(const [group,items] of groups)for(const v of items){
        rawCount++;
        const time=Number(v?.date);
        if(typeof v?.url!=="string"||!v.url||!Number.isFinite(time)||time<now()-range*86400000)continue;
        const id=String(v.guid??v.url)+"-"+time;
        if(seen.has(id))continue;seen.add(id);
        rows.push(Object.freeze({id,url:v.url,title:String(v.title||v.url),time,
          group:group==null?null:String(group),kind:"history",identity:"native-url-date"}));
      }
      return Object.freeze({rows:Object.freeze(rows),limit:count,hasMore:rawCount>=count});
    }
    function close(){if(closed)return;closed=true;epoch++;native.close();}
    return {query,close};
  }
// Closed tab identity is SessionStore's closedId, never a URL substitute.
  function createClosedTabsService({getClosed,restoreNative,forgetNative,allowed=()=>true,observe=()=>()=>{},now=Date.now,onError=()=>{}}){
    let dead=false;const subscriptions=createDisposableScope({onError});
    function query({text="",days=120,limit=100}={}){
      if(dead||!allowed())throw Error("Closed tabs unavailable in this window");
      const term=String(text).trim().toLowerCase().slice(0,1024),range=Math.min(36500,Math.max(1,Math.trunc(Number(days)||120)));
      const count=Math.min(5000,Math.max(1,Math.trunc(Number(limit)||100))),rows=[];
      for(const tab of getClosed()){
        const entry=tab.state?.entries?.[tab.state.index-1],time=Number(tab.closedAt);
        if(!entry?.url||tab.closedId==null||!Number.isFinite(time)||time<now()-range*86400000)continue;
        const title=String(tab.title||entry.title||entry.url);
        if(term&&!((title+" "+entry.url).toLowerCase().includes(term)))continue;
        rows.push(Object.freeze({id:"closed-"+tab.closedId,closedId:tab.closedId,url:entry.url,title,time,kind:"closed"}));
      }
      rows.sort((a,b)=>b.time-a.time);
      return Object.freeze({rows:Object.freeze(rows.slice(0,count)),limit:count,hasMore:rows.length>count});
    }
    function restore(id,{background=false}={}){
      if(dead||!allowed()||typeof restoreNative!=="function")return false;
      if(!getClosed().some(tab=>tab.closedId===id))return false;
      return restoreNative(id,!!background)!==false;
    }
    function forget(id){if(dead||!allowed()||typeof forgetNative!=="function"||!getClosed().some(tab=>tab.closedId===id))return false;return forgetNative(id)!==false;}
    function subscribe(fn){
      if(dead||!allowed())throw Error("Closed tabs unavailable in this window");
      let active=true,notify=fn;
      // A consumer exception must not abort native registration before
      // the removal handle is returned.
      const report=error=>{try{onError("closed-tabs-callback",error);}catch{}};
      const off=observe(()=>{if(active&&!dead&&allowed()&&notify)try{notify();}catch(error){report(error);}});
      return subscriptions.defer("closed-tabs-observer",()=>{active=false;notify=null;off();});
    }
    function dispose(){dead=true;return subscriptions.dispose();}
    return {query,subscribe,restore,forget,dispose};
  }
/* Independent native data owner. No UI, startup scans or disk cache. */
(()=>{
  const win=window,KEY="__nocturneLibraryServices";
  const trace=(event,data)=>{try{if(win.__nocturneTrace)win.__nocturneTrace(event,data,{flush:true});else{const q=win.__nocturneEarlyTrace??(win.__nocturneEarlyTrace=[]);if(q.length<32)q.push({event,data,t:win.performance?.now?.()??0});}}catch{}};
  trace("library.services.script",{version:"0.3.0-preview.78"});
  if(typeof win.addUnloadListener!=="function"||win.document.documentElement.hasAttribute("popup-window"))return;
  const BARRIER="__nocturneDownloadsDisposal",MEDIA_BARRIER="__nocturneMediaDisposal";
  const previous=win[KEY],previousClosing=previous?.dispose?.(),existing=win[BARRIER];
  // Migrate the legacy Promise barrier once. New generations retain a single
  // lease object (not a chain of rejected promises or obsolete services).
  const lease=existing&&typeof existing==="object"&&"release" in existing?existing:{release:null,barrier:previousClosing||existing||Promise.resolve()};
  const barrier=lease.barrier||Promise.resolve();
  win[BARRIER]=lease;
  // Keep a pending legacy barrier across multiple reloads, including an
  // intervening generation that never started Downloads.
  void Promise.resolve(barrier).then(result=>{if(result!==false&&lease.barrier===barrier)lease.barrier=null;},()=>{});
  const mediaBarrier=win[MEDIA_BARRIER]||Promise.resolve();
  let dead=false,closing=null,historySessions=new Set();
  const load=(path,key)=>ChromeUtils.importESModule(path)[key];
  const privateWindow=()=>load("resource://gre/modules/PrivateBrowsingUtils.sys.mjs","PrivateBrowsingUtils").isWindowPrivate(win);
  const allowed=()=>!dead&&!win.closed&&!privateWindow();
  const mediaAllowed=()=>allowed()&&Services.prefs.getBoolPref("zen.nocturne.library.local-media",false);
  const windows=Services.appinfo.OS==="WINNT";
  const fileFor=path=>new (load("resource://gre/modules/FileUtils.sys.mjs","FileUtils").File)(path);
  const scanner=()=>Cc["@mozilla.org/zen/library-files;1"].getService(Ci.nsIZenLibraryFiles);
  const iconFor=path=>"moz-icon://"+(path||".unknown")+"?size=32";
  const folderPref="zen.nocturne.library.custom-folders";
  function customFolders(){
    try{const value=JSON.parse(Services.prefs.getStringPref(folderPref,"[]"));
      return Array.isArray(value)?value.filter(v=>typeof v==="string"&&v.length>0&&v.length<=4096).slice(0,8):[];
    }catch{return [];}
  }
  async function chooseFolder(){
    if(!mediaAllowed()||!win.browsingContext)return false;
    try{
      const picker=Cc["@mozilla.org/filepicker;1"].createInstance(Ci.nsIFilePicker);
      picker.init(win.browsingContext,"Choose a Library folder",Ci.nsIFilePicker.modeGetFolder);
      const result=await new Promise(resolve=>picker.open(resolve));
      if(result!==Ci.nsIFilePicker.returnOK||!mediaAllowed()||!picker.file?.isDirectory())return false;
      const path=picker.file.path,paths=customFolders();
      if(paths.some(p=>mediaPathKey(p,windows)===mediaPathKey(path,windows)))return true;
      if(paths.length>=8)return false;
      Services.prefs.setStringPref(folderPref,JSON.stringify([...paths,path]));return true;
    }catch{return false;}
  }
  function clearFolders(){
    if(!mediaAllowed())return false;Services.prefs.clearUserPref(folderPref);return true;
  }
  function scanMedia(section){
    const roots=[];
    for(const key of section==="documents"?["DfltDwnld","Docs"]:["DfltDwnld","Pict"]){
      try{const f=Services.dirsvc.get(key,Ci.nsIFile);if(f?.path)roots.push(f.path);}catch{}
    }
    if(section==="pictures")try{const f=Services.dirsvc.get("Home",Ci.nsIFile);f.append("Pictures");roots.push(f.path);}catch{}
    return new Promise((resolve,reject)=>{try{scanner().scanMedia([...new Map([...roots,...customFolders()].map(p=>[mediaPathKey(p,windows),p])).values()],MEDIA_EXTENSIONS[section],2,60,300,files=>resolve(Array.from(files)));}catch(e){reject(e);}});
  }
  const media=createMediaService({scan:scanMedia,barrier:mediaBarrier,allowed:mediaAllowed,windows,
    describe(f,id){const name=f.path.split(/[\\/]/).pop();return {id,kind:"local",name,time:Number(f.lastModified)||0,bytes:Number(f.size)||0,total:Number(f.size)||0,success:true,exists:true,icon:iconFor(f.path),thumbnail:safeRaster(name,Number(f.size))?Services.io.newFileURI(fileFor(f.path)).spec:null};},
    perform(path,kind){try{const f=fileFor(path);if(!f.exists()||!f.isFile()||scanner().isCloudPlaceholder(path))return false;if(kind==="open")f.launch();else f.reveal();return true;}catch{return false;}}});
  function dragFile(d,event,node){
    if(!allowed()||!event?.isTrusted||!d.target?.path||d.target.exists===false)return false;
    try{const f=fileFor(d.target.path),dt=event.dataTransfer;if(!f.exists()||!f.isFile()||!dt?.mozSetDataAt)return false;
      dt.mozSetDataAt("application/x-moz-file",f,0);dt.setData("text/uri-list",Services.io.newFileURI(f).spec);dt.effectAllowed="copyMove";dt.addElement?.(node);return true;
    }catch{return false;}
  }
  const downloads=createDownloadsService({describeFile:d=>({icon:iconFor(d.target?.path)}),dragFile,barrier,lease,onDetach:result=>trace("library.downloads.detach",result),idPrefix:"download-"+(win.crypto?.randomUUID?.()||String(win.performance.now())),loadList:()=>{
    const D=win.Downloads||load("resource://gre/modules/Downloads.sys.mjs","Downloads");
    return D.getList(privateWindow()?D.PRIVATE:D.PUBLIC);
  },onError:()=>win.console.warn("[Nocturne] Downloads service listener failed")});
  const closedTabs=createClosedTabsService({allowed,onError:(resource,error)=>trace("library.scope.error",{owner:"closed-tabs",resource,error:error?.name||"Error"}),getClosed:()=>load("moz-src:///browser/components/sessionstore/SessionStore.sys.mjs","SessionStore").getClosedTabData({sourceWindow:win}),
    restoreNative(id,background){
      const store=load("moz-src:///browser/components/sessionstore/SessionStore.sys.mjs","SessionStore");
      if(typeof store.undoCloseById!=="function"||!win.gBrowser)return false;
      const selected=win.gBrowser.selectedTab;
      store.undoCloseById(id,true,win);
      if(background&&selected?.isConnected&&win.gBrowser.selectedTab!==selected)win.gBrowser.selectedTab=selected;
      return true;
    },
    forgetNative(id){const store=load("moz-src:///browser/components/sessionstore/SessionStore.sys.mjs","SessionStore");if(typeof store.forgetClosedTabById!=="function")return false;store.forgetClosedTabById(id);return true;},
    observe(fn){const topic="sessionstore-closed-objects-changed",observer={observe:fn};Services.obs.addObserver(observer,topic);return()=>Services.obs.removeObserver(observer,topic);}});
  function historyReady(){
    try{if(!allowed())return false;}catch{return false;}
    try{const p=load("resource://gre/modules/PlacesQuery.sys.mjs","PlacesQuery")?.prototype;
      return typeof p?.getHistory==="function"&&typeof p.searchHistory==="function"&&typeof p.close==="function"&&typeof win.openTrustedLinkIn==="function";
    }catch{return false;}
  }
  function openHistoryURL(value,{background=false}={}){
    if(!allowed()||typeof win.openTrustedLinkIn!=="function")return false;
    let url;try{url=new URL(value);}catch{return false;}
    if(!["http:","https:"].includes(url.protocol)||url.username||url.password)return false;
    win.openTrustedLinkIn(url.href,"tab",{inBackground:!!background});return true;
  }
  function copyHistoryURL(value){
    if(!allowed()||typeof value!=="string"||!value||value.length>65536)return false;
    try{Cc["@mozilla.org/widget/clipboardhelper;1"].getService(Ci.nsIClipboardHelper).copyString(value);return true;}catch{return false;}
  }
  async function removeHistoryURL(value){
    if(!allowed())return false;let url;
    try{url=new URL(value);}catch{return false;}
    if(!["http:","https:"].includes(url.protocol)||url.username||url.password)return false;
    await load("moz-src:///browser/components/places/PlacesUtils.sys.mjs","PlacesUtils").history.remove(url.href);return true;
  }
  async function clearHistoryRange(hours){
    if(!allowed()||![1,24,168].includes(hours))return false;
    const endDate=new Date(),beginDate=new Date(endDate.getTime()-hours*3600000);
    await load("moz-src:///browser/components/places/PlacesUtils.sys.mjs","PlacesUtils").history.removeVisitsByFilter({beginDate,endDate});return true;
  }
  function openHistory(onChange){
    const session=createHistorySession({allowed,onChange,createQuery:()=>{
      const PlacesQuery=load("resource://gre/modules/PlacesQuery.sys.mjs","PlacesQuery");return new PlacesQuery();
    }});
    let closed=false;
    const handle={query:session.query,close(){if(closed)return;closed=true;historySessions.delete(handle);session.close();}};
    historySessions.add(handle);return handle;
  }
  function dispose(){
    if(closing)return closing;
    dead=true;
    win.removeEventListener("unload",dispose);
    for(const s of [...historySessions])try{s.close();}catch{}
    try{trace("library.scope.dispose",{owner:"closed-tabs",...closedTabs.dispose()});}catch{}
    const mediaClosing=media.dispose();win[MEDIA_BARRIER]=mediaClosing;
    mediaClosing.finally(()=>{if(win[MEDIA_BARRIER]===mediaClosing)delete win[MEDIA_BARRIER];});
    closing=downloads.dispose();
    if(win[KEY]===api){delete win[KEY];win.dispatchEvent(new win.CustomEvent("Nocturne:ServicesGone"));}
    return closing;
  }
  const api={downloads,openHistory,historyReady,openHistoryURL,closedTabs,copyHistoryURL,removeHistoryURL,clearHistoryRange,media,chooseFolder,clearFolders,openMedia:section=>mediaAllowed()?media.open(section,()=>downloads.pathKeys(windows)):null,dispose};
  win[KEY]=api;win.addUnloadListener(dispose);win.addEventListener("unload",dispose,{once:true});
  trace("library.services.ready",{registered:true});win.dispatchEvent(new win.CustomEvent("Nocturne:ServicesReady"));
})();
