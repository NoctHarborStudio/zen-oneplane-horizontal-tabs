// Pure per-window Library state. Native IO and animations live outside.
const LIBRARY_SECTIONS=Object.freeze(["downloads","documents","history","pictures","closed"]);
const valid=section=>LIBRARY_SECTIONS.includes(section);
function createLibraryState(){
  return {phase:"closed",section:"history",query:"",filter:"all",sort:"new",motionEpoch:0,queryEpoch:0};
}
function enter(s,section,phase){
  return {...s,phase,section,query:"",filter:"all",sort:"new",
    motionEpoch:s.motionEpoch+1,queryEpoch:s.queryEpoch+1};
}
function reduceLibrary(s,event){
  switch(event.type){
    case "OPEN":{
      if(!valid(event.section))return s;
      if(s.phase==="closed"||s.phase==="closing")return enter(s,event.section,"opening");
      if(s.section===event.section)return s;
      return enter(s,event.section,s.phase==="opening"?"opening":"switching");
    }
    case "TOGGLE":{
      if(!valid(event.section))return s;
      if(s.phase!=="closed"&&s.phase!=="closing"&&s.section===event.section)
        return reduceLibrary(s,{type:"CLOSE"});
      return reduceLibrary(s,{type:"OPEN",section:event.section});
    }
    case "CLOSE":
      if(s.phase==="closed"||s.phase==="closing")return s;
      return {...s,phase:"closing",motionEpoch:s.motionEpoch+1,queryEpoch:s.queryEpoch+1};
    case "MOTION_DONE":
      if(event.epoch!==s.motionEpoch)return s;
      if(s.phase==="closing")return {...s,phase:"closed",section:"history",query:"",filter:"all",sort:"new"};
      if(s.phase==="opening"||s.phase==="switching")return {...s,phase:"open"};
      return s;
    case "QUERY":
    case "FILTER":
    case "SORT":{
      if(s.phase==="closed"||s.phase==="closing"||typeof event.value!=="string")return s;
      const key=event.type.toLowerCase();
      return s[key]===event.value?s:{...s,[key]:event.value,queryEpoch:s.queryEpoch+1};
    }
    case "INVALIDATE":
      return s.phase==="closed"||s.phase==="closing"?s:{...s,queryEpoch:s.queryEpoch+1};
    case "DISPOSE":
      return {...createLibraryState(),motionEpoch:s.motionEpoch+1,queryEpoch:s.queryEpoch+1};
    default:return s;
  }
}
function isCurrentLibraryQuery(s,epoch,section){
  return s.phase!=="closed"&&s.phase!=="closing"&&s.queryEpoch===epoch&&s.section===section;
}
// Browser client coordinates, never physical screen pixels.
function libraryClientRect(rect,width,height){
  if(!rect||![rect.left,rect.top,rect.right,rect.bottom,width,height].every(Number.isFinite))return null;
  const left=Math.max(0,Math.ceil(rect.left)),top=Math.max(0,Math.ceil(rect.top));
  const right=Math.min(Math.floor(width),Math.floor(rect.right)),bottom=Math.min(Math.floor(height),Math.floor(rect.bottom));
  return right-left<220||bottom-top<200?null:{left,top,width:right-left,height:bottom-top};
}
function libraryDuration(reduced,enabled,normal){return reduced||!enabled?0:normal;}
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
function createMediaService({scan,barrier=Promise.resolve(),allowed=()=>true,windows=false,describe,perform,onRefresh=()=>{}}){
 let dead=false,serial=0,viewSerial=0,generation=0,pending=Promise.resolve(barrier);const handles=new Map();
 const report=(section,status,count=0)=>{try{onRefresh({section,status,count});}catch{}};
 function open(section,downloadPaths=()=>new Set()){
   if(dead||!allowed()||!MEDIA_EXTENSIONS[section])throw Error("Media unavailable");
   let closed=false,owned=new Map(),cache=null,revision=0,refreshWork=null;
   const openedAt=generation;
   const available=()=>!closed&&!dead&&openedAt===generation&&allowed();
   async function refreshCurrent(){
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
   function refresh(){
     if(!available())return Promise.resolve(null);
     // Share one native scan per live session; do not build an unbounded
     // chain of queued retries while Zen has not called back.
     if(refreshWork)return refreshWork;
     const task=refreshCurrent();refreshWork=task;
     void task.then(()=>{if(refreshWork===task)refreshWork=null;},
                    ()=>{if(refreshWork===task)refreshWork=null;});
     return task;
   }
   return {refresh,rows:()=>{if(!available())return [];const known=downloadPaths();return (cache||[]).filter(r=>!known.has(mediaPathKey(handles.get(r.id),windows)));},close(){closed=true;++revision;refreshWork=null;for(const {id} of owned.values())handles.delete(id);owned.clear();cache=null;}};
 }
 function action(id,kind){if(dead||!allowed()||!handles.has(id)||!["open","reveal"].includes(kind))return false;return perform(handles.get(id),kind);}
 function invalidate(){++generation;handles.clear();}
 function dispose(){dead=true;invalidate();return pending.catch(()=>{});}
 return {open,action,invalidate,dispose};
}
// Own one bounded query session, reject stale results before rendering.
const MEDIA_SCAN_UI_DEADLINE_MS=15000;
const MEDIA_SCAN_SLOW_NOTICE="Local folder scan is still running. Downloaded files remain available.";
function createLibraryData({getServices,onResult,onError,onNotice=()=>{},onScanWait=()=>{},schedule,cancel}){
  let section=null,source=null,session=null,off=null,timer=null,epoch=0,sessionEpoch=0,limit=50,text="",sort="new",filter="all",dead=false,media=null,mediaWork=null;
  const files=s=>["downloads","documents","pictures"].includes(s);
  function stop(){
    ++epoch;++sessionEpoch;if(timer!==null){cancel(timer);timer=null;}
    if(mediaWork){const old=mediaWork;mediaWork=null;if(old.timer!==null)cancel(old.timer);old.resolve(false);}
    try{off?.();}catch{}off=null;try{if(section==="history")session?.close();}catch{}
    try{media?.close();}catch{}media=null;session=null;source=null;section=null;limit=50;text="";sort="new";filter="all";
  }
  const current=(token,owner)=>!dead&&token===epoch&&source===owner&&getServices()===owner;
  async function load(){
    if(dead||!session||!source)return;
    const token=++epoch,owner=source;
    try{const result=await session.query(files(section)?{text,limit,sort,filter}:section==="history"?{text,limit,...(sort!=="new"?{sort}:{}),...(filter!=="all"?{period:filter}:{})}:{text,limit});if(current(token,owner)&&result)onResult(result);}
    catch{if(current(token,owner))onError();}
  }
  function queue(throttle=false){
    if(throttle&&timer!==null)return;
    ++epoch;if(timer!==null)cancel(timer);
    timer=schedule(()=>{timer=null;void load();},160);
  }
  function immediate(){if(timer!==null)cancel(timer);timer=null;void load();}
  function refresh(){
    const owner=source,token=sessionEpoch,m=media;if(!m)return Promise.resolve(false);
    if(mediaWork){if(mediaWork.expired)onNotice(MEDIA_SCAN_SLOW_NOTICE);return mediaWork.promise;}
    const valid=()=>!dead&&sessionEpoch===token&&source===owner&&media===m&&getServices()===owner;
    let resolve;
    const promise=new Promise(done=>{resolve=done;});
    const work={promise,resolve,timer:null,expired:false};mediaWork=work;
    const release=()=>{
      if(work.timer!==null){cancel(work.timer);work.timer=null;}
      if(mediaWork===work)mediaWork=null;
    };
    // This deadline bounds only the UI wait. The Gecko native scan and the
    // MediaService disposal barrier retain ownership until real settlement.
    work.timer=schedule(()=>{
      work.timer=null;work.expired=true;
      if(valid()){onScanWait("deadline");onNotice(MEDIA_SCAN_SLOW_NOTICE);}
      resolve(false);
    },MEDIA_SCAN_UI_DEADLINE_MS);
    void Promise.resolve().then(()=>valid()?m.refresh():null).then(result=>{
      release();
      if(result===null||!valid()){resolve(false);return;}
      immediate();
      if(work.expired){onScanWait("late-complete");onNotice("",MEDIA_SCAN_SLOW_NOTICE);}
      resolve(true);
    },()=>{
      release();
      if(valid()){
        if(work.expired)onScanWait("late-error");
        onNotice("Local folders could not be scanned. Showing downloaded files.");
      }
      resolve(false);
    });
    return promise;
  }
  function start(next,query="",options={}){
    stop();if(dead||!["history","closed","downloads","documents","pictures"].includes(next))return false;
    section=next;text=query;sort=options.sort||"new";filter=options.filter||"all";source=getServices();
    if(!source){onError();return false;}
    const owner=source,sessionToken=sessionEpoch;
    const valid=()=>!dead&&source===owner&&section===next&&sessionToken===sessionEpoch&&getServices()===owner;
    const changed=()=>{if(valid())queue(files(next));};
    if(files(next)){
      if(!owner.downloads){onError();return false;}
      void (async()=>{
        try{
          await owner.downloads.start();if(!valid())return;
          off=owner.downloads.subscribe(changed);
          session={query:args=>queryDownloadRows([...owner.downloads.getSnapshot(),...(media?.rows()||[])],{...args,section:next})};
          if(next!=="downloads")try{media=owner.openMedia?.(next)||null;}catch{onNotice("Local folders unavailable.");}
          immediate();if(media)void refresh();
        }catch{if(valid())onError();}
      })();
      return true;
    }
    try{
      if(next==="history")session=owner.openHistory(changed);
      else{session=owner.closedTabs;off=session.subscribe(changed);}
      void load();return true;
    }catch{stop();onError();return false;}
  }
  function search(query,now=false){
    if(!section)return;const next=String(query).slice(0,1024);
    if(next!==text){text=next;limit=50;}
    if(!session)return;if(now)immediate();else queue();
  }
  function options(nextSort,nextFilter){sort=nextSort;filter=nextFilter;limit=50;immediate();}
  function more(){if(!session||limit>=500)return false;limit=Math.min(500,limit+50);immediate();return true;}
  return {start,stop,search,options,more,refresh,retry:immediate,dispose(){stop();dead=true;}};
}
function libraryWebURL(value){
  try{const u=new URL(value);return ["http:","https:"].includes(u.protocol)&&!u.username&&!u.password?u.href:null;}catch{return null;}
}
function libraryHistoryCommand(event){
  return !!event&&!event.defaultPrevented&&["Browser:ShowAllHistory","key_gotoHistory"].includes(event.target?.id);
}
function libraryDownloadsCommand(event){
  return !!event&&!event.defaultPrevented&&["Tools:Downloads","key_openDownloads"].includes(event.target?.id);
}

function libraryShortcutSection(event,os="WINNT"){
  if(!event||event.defaultPrevented||event.isComposing||event.repeat||event.altKey||event.shiftKey)return null;
  if(os==="Darwin"?(!event.metaKey||event.ctrlKey):(!event.ctrlKey||event.metaKey))return null;
  const key=String(event.key||"").toLowerCase();
  // Native Zen shortcuts can remain bound to a physical key while Gecko's
  // event.key changes with the active keyboard layout (e.g. Cyrillic).
  if(key==="h")return "history";
  if(key==="j")return "downloads";
  return event.code==="KeyH"?"history":event.code==="KeyJ"?"downloads":null;
}
/* L5–L6: one Library shell for five native-backed sections. */
(()=>{
  const win=window,doc=win.document,root=doc.documentElement,KEY="__nocturneLibrary",PREF="zen.nocturne.library.preview",OWNER="library",SHORTCUT="zen.nocturne.library.history-shortcut",DOWNLOADS_SHORTCUT="zen.nocturne.library.downloads-shortcut",MEDIA_PREF="zen.nocturne.library.local-media";
  function trace(event,detail={},options={flush:true}){
    try{if(win.__nocturneTrace)win.__nocturneTrace("library."+event,detail,options);
      else{const q=win.__nocturneEarlyTrace??(win.__nocturneEarlyTrace=[]);if(q.length<32)q.push({event:"library."+event,data:detail,t:win.performance?.now?.()??0});}}catch{}
  }
  trace("script",{version:"0.3.0-preview.169",unload:typeof win.addUnloadListener==="function"});
  if(typeof win.addUnloadListener!=="function"||root.hasAttribute("popup-window"))return;
  win[KEY]?.dispose?.();
  const prefs=Services.prefs,NS="http://www.w3.org/1999/xhtml";
  const labels={downloads:"All Downloads",documents:"Documents",history:"History",pictures:"Pictures",closed:"Recently Closed"};
  const summaries={downloads:"Download records and file actions",documents:"Downloaded documents and opted-in folders",history:"Browsing history and search",pictures:"Downloaded pictures and opted-in folders",closed:"Recently closed tabs in this window"};
  let state=createLibraryState(),dead=false,lease=()=>{},shell=null,animations=[],motionProbe=null,frame=0,returnFocus=null,rows=new Map(),backgroundAction=false,renderedSection=null,dragSource=null,pendingResult=null,clearing=false,confirmation=false,actionSerial=0,pendingClose=false,dragOwner=null,indicatorReady=false,lastFailure=null,fallbackDragTimer=0,fallbackDragMissing=0,fallbackDragUnknown=0;
  const data=createLibraryData({getServices:()=>win.__nocturneLibraryServices,onResult:result=>{const measure=state.phase==="opening"||state.phase==="switching",start=measure?win.performance.now():0;renderResults(result);if(measure)trace("render",{section:state.section,phase:state.phase,rows:result.rows.length,duration:win.performance.now()-start},{flush:false});},onError:renderError,onNotice:notice,onScanWait:status=>trace("media.scan.wait",{status,section:state.section}),schedule:(fn,ms)=>win.setTimeout(fn,ms),cancel:id=>win.clearTimeout(id)});
  const fileSection=()=>["downloads","documents","pictures"].includes(state.section);
  const enabled=()=>prefs.getBoolPref(PREF,false),active=()=>state.phase!=="closed";
  const duration=n=>libraryDuration(win.matchMedia("(prefers-reduced-motion: reduce)").matches,prefs.getIntPref("zen.oneplane.animation-duration",160)!==0,n);
  const make=(tag,cls,text)=>{const n=doc.createElementNS(NS,tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
  function privateWindow(){try{return ChromeUtils.importESModule("resource://gre/modules/PrivateBrowsingUtils.sys.mjs").PrivateBrowsingUtils.isWindowPrivate(win);}catch{return true;}}
  function fail(reason){lastFailure=reason;trace("open.rejected",{reason,section:state.section});return false;}
  function diagnostics(probe=true){return {enabled:enabled(),historyShortcut:prefs.getBoolPref(SHORTCUT,false),downloadsShortcut:prefs.getBoolPref(DOWNLOADS_SHORTCUT,false),delayed:!!win.gBrowserInit?.delayedStartupFinished,private:privateWindow(),overlay:!!win.__nocturneOverlay,services:!!win.__nocturneLibraryServices,historyReady:probe?!!win.__nocturneLibraryServices?.historyReady?.():null,phase:state.phase,section:state.section,lastFailure};}
  function geometry(){
    if(!shell)return false;
    for(const id of ["tabbrowser-tabpanels","browser"]){
      const n=doc.getElementById(id);if(!n)continue;
      const r=libraryClientRect(n.getBoundingClientRect(),win.innerWidth,win.innerHeight);if(!r)continue;
      Object.assign(shell.layer.style,{left:r.left+"px",top:r.top+"px",width:r.width+"px",height:r.height+"px"});return true;
    }
    return false;
  }
  function resize(){
    if(!active()||frame)return;frame=win.requestAnimationFrame(()=>{frame=0;if(active()){if(!geometry())closeNow();else syncIndicator(false);}});
  }
  function mount(){
    if(shell)return true;
    const layer=make("div");layer.id="nocturne-library-preview";layer.hidden=true;
    const topLayer=typeof layer.showPopover==="function"&&typeof layer.hidePopover==="function";
    if(topLayer)layer.setAttribute("popover","manual");
    const shade=make("div","nl-shade");shade.setAttribute("aria-hidden","true");
    const glass=make("div","nl-glass");glass.setAttribute("aria-hidden","true");
    const panel=make("section","nl-panel");panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");panel.setAttribute("aria-labelledby","nl-title");panel.tabIndex=-1;
    const header=make("header","nl-header"),brand=make("span","nl-brand","Nocturne Library");
    const title=make("h2","nl-title","History");title.id="nl-title";
    const dismiss=make("button","nl-dismiss","×");dismiss.type="button";dismiss.setAttribute("aria-label","Close Library");dismiss.addEventListener("click",close);
    header.append(brand,title,dismiss);
    const nav=make("nav","nl-nav");nav.setAttribute("role","tablist");nav.setAttribute("aria-label","Library sections");
    const left=make("div","nl-nav-side"),right=make("div","nl-nav-side nl-nav-right"),tabs=new Map();
    left.setAttribute("role","presentation");right.setAttribute("role","presentation");
    for(const section of LIBRARY_SECTIONS){
      const button=make("button","nl-tab",labels[section]);button.type="button";button.id="nl-tab-"+section;
      button.setAttribute("role","tab");button.setAttribute("aria-controls","nl-body");
      button.addEventListener("click",()=>open(section));
      button.addEventListener("keydown",e=>{
        let i=LIBRARY_SECTIONS.indexOf(section);
        if(e.key==="ArrowLeft")i=(i+4)%5;else if(e.key==="ArrowRight")i=(i+1)%5;
        else if(e.key==="Home")i=0;else if(e.key==="End")i=4;else return;
        e.preventDefault();e.stopPropagation();const next=LIBRARY_SECTIONS[i];if(open(next))tabs.get(next).focus();
      });
      tabs.set(section,button);
      if(section==="history")button.classList.add("nl-primary");else (["downloads","documents"].includes(section)?left:right).append(button);
    }
    const indicator=make("span","nl-nav-indicator");indicator.hidden=true;indicator.setAttribute("aria-hidden","true");nav.append(left,tabs.get("history"),right,indicator);
    const search=make("input","nl-search");search.type="search";search.autocomplete="off";search.maxLength=1024;search.setAttribute("aria-label","Search Library");
    search.addEventListener("input",()=>{state=reduceLibrary(state,{type:"QUERY",value:search.value});if(renderedSection===state.section)data.search(state.query);});
    search.addEventListener("keydown",e=>{if(e.key==="Enter"){e.preventDefault();if(renderedSection===state.section)data.search(state.query,true);}});
    const body=make("div","nl-body");body.id="nl-body";body.setAttribute("role","tabpanel");body.tabIndex=0;
    const tools=make("div","nl-tools"),status=make("div","nl-status");status.setAttribute("role","status");status.hidden=true;
    const sort=make("select","nl-select");sort.setAttribute("aria-label","Sort files");
    for(const [v,t] of [["new","Newest"],["old","Oldest"],["size","Largest"]]){const o=make("option","",t);o.value=v;sort.append(o);}
    const filter=make("select","nl-select");filter.setAttribute("aria-label","Filter downloads");
    for(const [v,t] of [["all","All"],["active","Active"],["completed","Completed"],["other","Other"]]){const o=make("option","",t);o.value=v;filter.append(o);}
    function options(){state=reduceLibrary(reduceLibrary(state,{type:"SORT",value:sort.value}),{type:"FILTER",value:filter.value});data.options(state.sort,state.filter);}
    sort.addEventListener("change",options);filter.addEventListener("change",options);
    const button=(name,fn)=>{const b=make("button","nl-action",name);b.type="button";b.addEventListener("click",fn);return b;};
    const clear=button("Clear finished records",()=>{confirmation=true;syncTools();});
    const yes=button("Confirm clear",()=>void clearDownloads());
    const no=button("Cancel",()=>{confirmation=false;syncTools();clear.focus();});
    const historyFilter=button("Filter",()=>setHistoryDrawer(shell.historyDrawer.inert));
    historyFilter.setAttribute("aria-expanded","false");historyFilter.setAttribute("aria-controls","nl-history-filter");
    const historyDrawer=make("section","nl-history-filter");historyDrawer.id="nl-history-filter";historyDrawer.inert=true;historyDrawer.hidden=true;
    historyDrawer.setAttribute("aria-label","Filter history");
    const drawerHead=make("div","nl-filter-head");
    const done=button("Done",()=>setHistoryDrawer(false,true));drawerHead.append(make("strong","","Filter history"),done);
    const periodButtons=new Map(),orderButtons=new Map();
    function choices(label,values,buttons,type){
      const group=make("div","nl-filter-group"),heading=make("h3","",label),items=make("div","nl-filter-options");
      for(const [value,title] of values){
        const choice=button(title,()=>{
          state=reduceLibrary(state,{type,value});
          syncHistoryFilter();shell.body.scrollTop=0;
          if(renderedSection==="history")data.options(state.sort,state.filter);
          trace("filter.changed",{section:"history",mode:state.sort==="new"?"date":state.sort,scope:state.filter},{flush:false});
        });
        choice.setAttribute("aria-pressed","false");buttons.set(value,choice);items.append(choice);
      }
      group.append(heading,items);return group;
    }
    historyDrawer.append(drawerHead,
      choices("When was it visited?",[["all","Any time"],["today","Today"],["week","This Week"],["month","This Month"]],periodButtons,"FILTER"),
      choices("Sort by",[["date","By Date"],["site","By Site"],["mostvisited","By Most Visited"],["lastvisited","By Last Visited"]],orderButtons,"SORT"));
    const historyRange=make("select","nl-select");historyRange.setAttribute("aria-label","History clearing time range");
    for(const [v,t] of [[1,"Last hour"],[24,"Last day"],[168,"Last 7 days"]]){const o=make("option","",t);o.value=String(v);historyRange.append(o);}
    const clearHistory=button("Clear history…",()=>void clearRecentHistory(Number(historyRange.value)));
    const addFolder=button("Add folder…",()=>void changeFolders(false));
    const resetFolders=button("Reset extra folders",()=>void changeFolders(true));
    const refresh=button("Refresh folders",()=>{if(win.__nocturneLibraryServices?.mediaScanAvailable!==true)return;const epoch=state.motionEpoch;notice("Scanning opted-in folders…");void data.refresh().then(ok=>{if(ok&&current(epoch))notice("");});});
    const more=button("Load more",()=>{more.disabled=true;if(!data.more())more.disabled=false;});more.classList.add("nl-more");
    tools.append(sort,filter,clear,yes,no,historyFilter,historyRange,clearHistory,refresh,addFolder,resetFolders);
    const contentArea=make("div","nl-content-area");contentArea.append(body,historyDrawer);
    panel.append(header,nav,search,tools,status,contentArea);layer.append(shade,glass,panel);root.append(layer);
    shade.addEventListener("pointerdown",e=>{if(e.button===0){e.preventDefault();close();}});
    panel.addEventListener("keydown",e=>{
      if(e.key!=="Tab")return;
      const nodes=[dismiss,tabs.get(state.section),...(search.disabled?[]:[search]),...tools.querySelectorAll("button:not([disabled]):not([hidden]),select:not([disabled]):not([hidden])"),...(!historyDrawer.inert&&!historyDrawer.hidden?[...historyDrawer.querySelectorAll("button:not([disabled])")]:[body,...body.querySelectorAll("button:not([disabled])")])],i=nodes.indexOf(doc.activeElement);
      const next=e.shiftKey?(i<=0?nodes.length-1:i-1):(i<0||i===nodes.length-1?0:i+1);
      e.preventDefault();nodes[next].focus();
    });
    shell={layer,shade,glass,panel,title,tabs,search,body,tools,status,sort,filter,clear,yes,no,refresh,more,nav,indicator,historyFilter,historyDrawer,periodButtons,orderButtons,historyRange,clearHistory,addFolder,resetFolders,topLayer};return true;
  }
  function syncIndicator(animate=true){
    if(!shell||!active())return;
    const {nav,tabs,indicator}=shell,tab=tabs.get(state.section);
    // Offset geometry is independent of the panel's opening transform.
    const width=Math.max(12,tab.offsetWidth*.5),x=tab.offsetLeft+(tab.offsetWidth-width)/2,y=tab.offsetTop+tab.offsetHeight-3;
    if(!tab.offsetWidth)return;
    if(!animate||!indicatorReady){indicator.style.transition="none";}else indicator.style.transition=duration(220)?"transform 220ms cubic-bezier(.2,.75,.2,1), width 220ms cubic-bezier(.2,.75,.2,1)":"none";
    indicator.style.transform="translate("+x+"px,"+y+"px)";indicator.style.width=width+"px";indicatorReady=true;indicator.hidden=false;
  }
  function renderHeader(){
    const {title,tabs,search,body}=shell;title.textContent=labels[state.section];
    for(const [id,b] of tabs){const selected=id===state.section;b.setAttribute("aria-selected",String(selected));b.tabIndex=selected?0:-1;}
    search.placeholder="Search "+labels[state.section].toLowerCase();search.value=state.query;body.setAttribute("aria-labelledby","nl-tab-"+state.section);syncTools();syncIndicator();
  }
  function notice(message,onlyIf){
    if(!shell||!active()||state.phase==="closing")return;
    if(onlyIf!==undefined&&shell.status.textContent!==onlyIf)return;
    shell.status.textContent=message;shell.status.hidden=!message;
  }
  function syncHistoryFilter(){
    if(!shell)return;
    for(const [value,button] of shell.periodButtons)button.setAttribute("aria-pressed",String(value===state.filter));
    for(const [value,button] of shell.orderButtons)button.setAttribute("aria-pressed",String(value===(state.sort==="new"?"date":state.sort)));
  }
  function setHistoryDrawer(open,focus=false){
    if(!shell)return;
    const {historyDrawer,historyFilter}=shell;
    open=!!open&&state.section==="history"&&active()&&state.phase!=="closing";
    historyDrawer.inert=!open;shell.body.inert=open;historyDrawer.toggleAttribute("data-open",open);
    historyFilter.setAttribute("aria-expanded",String(open));
    if(!open&&focus)historyFilter.focus({preventScroll:true});
    syncHistoryFilter();
  }
  function syncTools(){
    if(!shell)return;const f=fileSection(),d=state.section==="downloads",local=f&&!d&&prefs.getBoolPref(MEDIA_PREF,false)&&win.__nocturneLibraryServices?.mediaScanAvailable===true;
    shell.tools.hidden=!f&&state.section!=="history";shell.sort.hidden=!f;shell.sort.value=state.sort;
    shell.filter.hidden=!d;shell.filter.value=state.filter;
    shell.clear.hidden=!d||confirmation;shell.clear.disabled=clearing||!win.__nocturneLibraryServices?.downloads?.getSnapshot().some(r=>r.clearable);
    shell.yes.hidden=shell.no.hidden=!d||!confirmation;shell.yes.disabled=shell.no.disabled=clearing;
    shell.refresh.hidden=shell.addFolder.hidden=shell.resetFolders.hidden=!local;
    const isHistory=state.section==="history";shell.historyFilter.hidden=shell.historyRange.hidden=shell.clearHistory.hidden=!isHistory;
    if(!isHistory)setHistoryDrawer(false);shell.historyDrawer.hidden=!isHistory;syncHistoryFilter();
    shell.clearHistory.disabled=clearing;
  }
  async function clearDownloads(){
    if(!confirmation||clearing||state.section!=="downloads")return;
    const source=win.__nocturneLibraryServices,token=++actionSerial;clearing=true;syncTools();
    try{
      const result=await source.downloads.clearCompleted(()=>!dead&&token===actionSerial&&active()&&state.section==="downloads");
      if(token===actionSerial&&active()&&state.section==="downloads"){
        if(result===null)notice("Downloads are already being cleared.");
        else{
          trace("downloads.clear.result",{requested:result.requested,removed:result.removed,skipped:result.skipped,failed:result.failed});
          notice(result.failed||result.skipped?"Some records were not cleared. Files were not deleted.":"Cleared "+result.removed+" finished records. Files were not deleted.");
        }
      }
    }catch{if(token===actionSerial)notice("Could not clear completed records.");}
    finally{if(token===actionSerial){clearing=false;confirmation=false;syncTools();data.retry();}}
  }
  async function changeFolders(reset){
    if(!active()||dragSource||clearing||!["documents","pictures"].includes(state.section)||!prefs.getBoolPref(MEDIA_PREF,false)||win.__nocturneLibraryServices?.mediaScanAvailable!==true)return;
    const service=win.__nocturneLibraryServices;
    if(reset&&!win.confirm("Remove all extra Library folders? No files will be deleted."))return;
    try{if(reset)service.clearFolders();else await service.chooseFolder();}catch{}
  }
  async function clearRecentHistory(hours){
    if(!active()||state.section!=="history"||clearing)return;
    const epoch=state.motionEpoch;
    if(!win.confirm("Remove browser history from the last "+hours+" hour(s)? This cannot be undone.")||clearing||!current(epoch))return;
    const token=++actionSerial;clearing=true;
    try{
      syncTools();
      const ok=await win.__nocturneLibraryServices?.clearHistoryRange(hours);
      if(current(epoch)){notice(ok?"History cleared.":"History could not be cleared.");data.retry();}
    }catch{if(current(epoch))notice("History could not be cleared.");}
    finally{if(token===actionSerial){clearing=false;syncTools();}}
  }
  async function historyAction(entry,kind){
    const row=entry.record,service=win.__nocturneLibraryServices,epoch=state.motionEpoch;
    if(!row||!service||rows.get(row.id)!==entry||renderedSection!==state.section||!active()||state.phase==="closing")return;
    try{
      if(kind==="copy"){if(service.copyHistoryURL(row.url))notice("Address copied.");return;}
      if(clearing)return;
      const msg=row.kind==="closed"?"Forget this recently closed tab? It will no longer be restorable.":"Remove this page and its visits from browser history?";
      if(!win.confirm(msg)||clearing||!current(epoch)||rows.get(row.id)!==entry||entry.record!==row)return;
      const token=++actionSerial;clearing=true;
      try{
        syncTools();
        const ok=row.kind==="closed"?service.closedTabs.forget(row.closedId):await service.removeHistoryURL(row.url);
        if(current(epoch)){notice(ok?"Record removed.":"Record could not be removed.");data.retry();}
      }finally{if(token===actionSerial){clearing=false;syncTools();}}
    }catch{if(current(epoch))notice("History action unavailable.");}
  }
  function rowKey(row){return row.kind==="local"&&row.viewKey?row.viewKey:row.id;}
  function fileBytes(n){if(!Number.isFinite(n)||n<=0)return "0 B";let i=0;while(n>=1024&&i<3){n/=1024;i++;}return n.toFixed(i?1:0)+" "+["B","KB","MB","GB"][i];}
  async function fileAction(entry,kind){
    const row=entry.record,source=win.__nocturneLibraryServices,epoch=state.motionEpoch;
    if(!row||!source||rows.get(rowKey(row))!==entry||!active()||dragSource||clearing||state.phase==="closing"||renderedSection!==state.section)return;
    try{
      const ok=await (row.kind==="local"?source.media.action(row.id,kind):source.downloads.action(row.id,kind));
      if(!ok&&current(epoch))notice("File unavailable or action not permitted.");
    }catch{if(current(epoch))notice("Could not "+kind+" the file.");}
  }
  function stopFallbackDragWatch(){
    if(fallbackDragTimer)win.clearTimeout(fallbackDragTimer);
    fallbackDragTimer=0;fallbackDragMissing=0;fallbackDragUnknown=0;
  }
  // Used only if the Downloads Dock bridge did not accept the gesture.
  // Never infer an OS drop from a missing or unreadable native session.
  function watchFallbackDrag(source){
    stopFallbackDragWatch();
    const check=()=>{
      fallbackDragTimer=0;
      if(dead||dragSource!==source||dragOwner)return;
      let session;
      try{
        const service=Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService);
        session=typeof service.getCurrentSession==="function"?service.getCurrentSession(win):undefined;
      }catch{session=undefined;}
      if(session){
        fallbackDragMissing=0;fallbackDragUnknown=0;
      }else if(session===null){
        fallbackDragUnknown=0;
        if(++fallbackDragMissing>=3){trace("file.drag.recovered",{reason:"native-session-ended"});finishDrag(source);return;}
      }else{
        fallbackDragMissing=0;
        if(++fallbackDragUnknown>=6){trace("file.drag.recovered",{reason:"native-session-unavailable"});finishDrag(source);return;}
      }
      if(!dead&&dragSource===source&&!dragOwner)fallbackDragTimer=win.setTimeout(check,200);
    };
    fallbackDragTimer=win.setTimeout(check,200);
  }
  function createFileRow(){
    const node=make("div","nl-file-record"),icon=make("img","nl-file-icon"),copy=make("div","nl-record-text"),title=make("span","nl-record-title"),url=make("span","nl-record-url"),track=make("progress","nl-progress"),actions=make("div","nl-file-actions");
    icon.alt="";icon.loading="lazy";icon.decoding="async";icon.draggable=false;track.max=100;track.setAttribute("aria-label","Download progress");
    const entry={node,icon,title,url,track,record:null};
    const button=(name,kind)=>{const b=make("button","nl-action",name);b.type="button";b.addEventListener("click",()=>void fileAction(entry,kind));actions.append(b);return b;};
    entry.open=button("Open","open");entry.reveal=button("Folder","reveal");entry.remove=button("Remove","remove");
    copy.append(title,url,track);node.append(icon,copy,actions);
    icon.addEventListener("error",()=>{const fallback=entry.record?.icon;if(fallback&&icon.getAttribute("src")!==fallback)icon.src=fallback;else icon.hidden=true;});
    let actionPress=false;
    node.addEventListener("pointerdown",e=>{actionPress=!!e.target.closest?.("button");});
    node.addEventListener("dragstart",e=>{
      if(actionPress||e.target.closest?.("button")||entry.record?.kind!=="download"||dragSource||clearing){e.preventDefault();return;}
      const finish=()=>finishDrag(node);
      const dock=win.__zenRefinedDownloadIndicator;
      let fallback=false;
      if(dock?.beginExternalDrag?.(e,node,entry.record.id,finish)){dragOwner=dock;}
      else if(!win.__nocturneLibraryServices?.downloads.drag(entry.record.id,e,node)){e.preventDefault();return;}
      else fallback=true;
      dragSource=node;e.stopPropagation();node.setAttribute("data-file-dragging","");
      if(fallback)watchFallbackDrag(node);
    });
    node.addEventListener("dragend",e=>{
      if(dragSource!==node)return;
      if(dragOwner?.endExternalDrag?.(node,e))return;
      finishDrag(node);
    });
    return entry;
  }
  function finishDrag(node){
    if(dragSource!==node)return;stopFallbackDragWatch();dragSource=null;dragOwner=null;node.removeAttribute("data-file-dragging");
    const p=pendingResult;pendingResult=null;if(pendingClose){pendingClose=false;closeNow(false);return;}if(p?.error)renderError();else if(p)renderResults(p);
  }
  function updateFileRow(entry,row){
    entry.record=row;entry.node.dataset.recordId=rowKey(row);entry.title.textContent=row.name;
    const completed=row.success&&!row.failed&&!row.canceled&&!row.partial&&!row.blocked&&row.exists;
    const status=row.kind==="local"?"Local folder":downloadFileStatus(row);
    entry.url.textContent=status+" · "+fileBytes(row.total||row.bytes)+(row.active&&row.speed?" · "+fileBytes(row.speed)+"/s":"");
    entry.track.hidden=!row.active;if(row.known)entry.track.value=Math.min(100,100*row.bytes/row.total);else entry.track.removeAttribute("value");
    entry.open.disabled=entry.reveal.disabled=!completed;entry.remove.hidden=row.kind==="local";entry.remove.disabled=!row.clearable;
    entry.node.draggable=!!(completed&&row.kind==="download");
    const src=row.thumbnail||row.icon;if(src&&entry.icon.getAttribute("src")!==src){entry.icon.hidden=false;entry.icon.src=src;}
  }
  function placeholder(title,note,action){
    const box=make("div","nl-placeholder");box.append(make("strong","",title),make("p","",note));
    if(action){const b=make("button","nl-action","Retry");b.type="button";b.addEventListener("click",action);box.append(b);}
    shell.body.replaceChildren(box);
  }
  function renderError(){
    if(!active()||state.phase==="closing"||renderedSection!==state.section)return;
    if(dragSource){pendingResult={error:true};return;}
    rows.clear();placeholder("Library data unavailable","Try again or use the native Zen Library.",()=>renderBody());
  }
  function activateRow(row,background){
    if(!row||!active()||state.phase==="closing"||renderedSection!==state.section||rows.get(row.id)?.record!==row)return;
    const service=win.__nocturneLibraryServices;if(!service)return;
    let success=false;backgroundAction=background;
    try{success=row.kind==="closed"?service.closedTabs.restore(row.closedId,{background}):service.openHistoryURL(row.url,{background});}
    catch{}finally{backgroundAction=false;}
    if(success){if(!background)closeNow(false);else if(row.kind==="closed")data.retry();}
    else renderError();
  }
  function createRow(){
    const node=make("div","nl-history-row"),main=make("button","nl-record");main.type="button";
    const icon=make("img","nl-favicon");icon.alt="";icon.loading="lazy";icon.decoding="async";icon.draggable=false;
    const copy=make("span","nl-record-text"),title=make("span","nl-record-title"),url=make("span","nl-record-url"),time=make("time","nl-time");
    copy.append(title,url);main.append(icon,copy,time);node.append(main);
    const entry={node,main,icon,title,url,time,record:null};
    const actions=make("div","nl-history-actions");
    const button=(name,kind)=>{const b=make("button","nl-action",name);b.type="button";b.addEventListener("click",()=>void historyAction(entry,kind));actions.append(b);return b;};
    entry.copy=button("Copy","copy");entry.forget=button("Remove","forget");node.append(actions);
    main.addEventListener("click",e=>activateRow(entry.record,e.ctrlKey||e.metaKey));
    main.addEventListener("auxclick",e=>{if(e.button===1){e.preventDefault();activateRow(entry.record,true);}});
    icon.addEventListener("error",()=>{icon.hidden=true;});return entry;
  }
  function renderResults(result){
    if(!active()||state.phase==="closing"||renderedSection!==state.section)return;
    if(dragSource){pendingResult=result;return;}syncTools();
    const body=shell.body,focusId=doc.activeElement?.closest?.("[data-record-id]")?.dataset?.recordId,focused=doc.activeElement;
    const oldScroll=body.scrollTop,ordered=[],live=new Set(),headings=new Map(),dayRuns=new Map();let lastDay=null;
    // The current DOM owns date headings. Reuse its exact nodes across
    // History updates; no parallel cache or observer survives section reset.
    if(!fileSection())for(const child of body.children)
      if(child.classList?.contains("nl-day")&&child.dataset.dayKey)
        headings.set(child.dataset.dayKey,child);
    for(const row of result.rows){
      const key=rowKey(row);if(live.has(key))continue;live.add(key);
      let entry=rows.get(key);if(!entry){entry=fileSection()?createFileRow():createRow();rows.set(key,entry);}
      if(fileSection()){updateFileRow(entry,row);ordered.push(entry.node);continue;}
      entry.record=row;entry.node.dataset.recordId=row.id;
      entry.title.textContent=row.title;entry.url.textContent=row.url;
      const safe=libraryWebURL(row.url);entry.main.disabled=row.kind==="history"&&!safe;entry.forget.disabled=row.kind==="history"&&!safe;entry.forget.textContent=row.kind==="closed"?"Forget":"Remove";
      if(safe&&entry.icon.getAttribute("src")!=="page-icon:"+safe){entry.icon.hidden=false;entry.icon.src="page-icon:"+safe;}
      if(!safe){entry.icon.removeAttribute("src");entry.icon.hidden=true;}
      const date=new Date(row.time),bySite=state.section==="history"&&state.sort==="site",ranked=state.section==="history"&&["mostvisited","lastvisited"].includes(state.sort);
      const day=bySite?(row.group||(()=>{try{return new URL(row.url).hostname||"Other";}catch{return "Other";}})()):date.toLocaleDateString();
      entry.time.textContent=(bySite||ranked?date.toLocaleDateString()+" ":"")+date.toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"});
      if(Number.isFinite(date.getTime()))entry.time.dateTime=date.toISOString();
      if(!ranked&&day!==lastDay){
        // Site-sorted results can return to the same date later. Distinguish
        // repeated runs without merging the separate visual groups.
        const run=dayRuns.get(day)||0;dayRuns.set(day,run+1);
        const dayKey=day+"#"+run;
        let heading=headings.get(dayKey);
        if(!heading){heading=make("h3","nl-day",day);heading.dataset.dayKey=dayKey;}
        ordered.push(heading);lastDay=day;
      }
      ordered.push(entry.node);
    }
    for(const id of rows.keys())if(!live.has(id))rows.delete(id);
    if(!ordered.length&&!result.hasMore){placeholder(state.query?"No matching results":"Nothing to show","No records in this section for the selected period.");return;}
    if(!ordered.length&&state.section==="history"){
      ordered.push(make("p","nl-limit","No visits from the last 120 days in these results."));
    }
    if(result.hasMore&&result.limit<500){
      shell.more.disabled=false;ordered.push(shell.more);
    }else if(result.hasMore){ordered.push(make("p","nl-limit",state.section==="history"?"Checked the first 500 history records. Refine your search or filter.":"Showing up to 500 records. Use search to narrow results."));}
    // Keep the same DOM node in place for progress-only updates.
    const unchanged=body.children.length===ordered.length&&ordered.every((n,i)=>body.children[i]===n);
    if(!unchanged){const keep=new Set(ordered);for(const child of [...body.children])if(!keep.has(child))child.remove();
      for(let i=0;i<ordered.length;i++)if(body.children[i]!==ordered[i])body.insertBefore(ordered[i],body.children[i]||null);body.scrollTop=oldScroll;
      if(focusId&&rows.has(focusId)){if(focused?.isConnected)focused.focus({preventScroll:true});else rows.get(focusId).node.querySelector?.("button:not([disabled])")?.focus({preventScroll:true});}}

  }
  function renderBody(){
    rows.clear();shell.body.scrollTop=0;renderedSection=state.section;
    shell.search.disabled=false;notice("");syncTools();
    if(["documents","pictures"].includes(state.section)&&prefs.getBoolPref(MEDIA_PREF,false)&&win.__nocturneLibraryServices?.mediaScanAvailable!==true)
      notice("Local folder scanning is temporarily paused for safety. Downloaded files remain available.");
    placeholder("Loading…","Reading native browser records.");data.start(state.section,state.query,{sort:state.sort,filter:state.filter});
  }
  function sample(n){const c=win.getComputedStyle(n);return {opacity:c.opacity,transform:c.transform};}
  function startMotionProbe(ms){
    if(!ms||!prefs.getBoolPref("zen.nocturne.diagnostics.enabled",true))return;
    const probe={section:state.section,phase:state.phase,epoch:state.motionEpoch,start:win.performance.now(),last:null,gaps:[],frame:0};
    motionProbe=probe;
    const tick=t=>{
      probe.frame=0;
      if(motionProbe!==probe||dead||!prefs.getBoolPref("zen.nocturne.diagnostics.enabled",true))return;
      if(probe.last!==null&&t>probe.last)probe.gaps.push(t-probe.last);
      probe.last=t;
      if(probe.gaps.length<300&&t-probe.start<ms+120)probe.frame=win.requestAnimationFrame(tick);
    };
    probe.frame=win.requestAnimationFrame(tick);
  }
  function stopMotionProbe(completed){
    const p=motionProbe;motionProbe=null;if(!p)return;
    if(p.frame)win.cancelAnimationFrame(p.frame);
    if(!prefs.getBoolPref("zen.nocturne.diagnostics.enabled",true))return;
    const gaps=p.gaps.slice().sort((a,b)=>a-b);
    const percentile=q=>gaps.length?gaps[Math.max(0,Math.ceil(gaps.length*q)-1)]:null;
    trace("motion.frames",{section:p.section,phase:p.phase,epoch:p.epoch,completed,frames:gaps.length,
      elapsed:win.performance.now()-p.start,p50:percentile(.5),p95:percentile(.95),p99:percentile(.99),max:percentile(1),over25:gaps.filter(g=>g>25).length},{flush:false});
  }
  function cancelMotion(completed=false){stopMotionProbe(completed);for(const a of animations)try{a.cancel();}catch{}animations=[];}
  function play(n,frames,ms){
    if(!ms||typeof n.animate!=="function")return Promise.resolve();
    try{const a=n.animate(frames,{duration:ms,easing:"cubic-bezier(.2,.75,.2,1)",fill:"both"});animations.push(a);return a.finished.catch(()=>{});}catch{return Promise.resolve();}
  }
  const current=epoch=>!dead&&state.motionEpoch===epoch;
  function settle(epoch){
    if(!current(epoch))return;
    // Compare the computed terminal pose across the WAAPI-to-CSS handoff.
    // Do not sample frames or collect text, and skip reads when opted out.
    const probe=prefs.getBoolPref("zen.nocturne.diagnostics.enabled",true)&&state.phase==="opening";
    let before=null;
    if(probe)try{before=sample(shell.panel);}catch{}
    state=reduceLibrary(state,{type:"MOTION_DONE",epoch});cancelMotion(true);
    if(before)try{
      const after=sample(shell.panel);
      trace("motion.settled",{section:state.section,opacityStable:before.opacity===after.opacity,transformStable:before.transform===after.transform,beforeOpacity:Number(before.opacity),afterOpacity:Number(after.opacity)});
    }catch{}
  }
  function hide(restore=true,completed=false){
    stopFallbackDragWatch();
    data.stop();rows.clear();renderedSection=null;dragSource=null;dragOwner=null;indicatorReady=false;pendingResult=null;pendingClose=false;confirmation=false;clearing=false;++actionSerial;cancelMotion(completed);if(frame)win.cancelAnimationFrame(frame);frame=0;
    if(shell){setHistoryDrawer(false);try{if(shell.topLayer&&shell.layer.matches(":popover-open"))shell.layer.hidePopover();}catch{}shell.layer.removeAttribute("data-library-open");shell.layer.hidden=true;shell.indicator.hidden=true;shell.panel.inert=false;shell.body.replaceChildren();shell.search.value="";}
    const target=returnFocus;returnFocus=null;if(!restore||win.closed)return;
    try{if(target?.isConnected&&typeof target.focus==="function")target.focus({preventScroll:true});else win.gBrowser?.selectedBrowser?.focus();}catch{}
  }
  function closeNow(restore=true){
    if(!active())return;state=reduceLibrary(state,{type:"CLOSE"});state=reduceLibrary(state,{type:"MOTION_DONE",epoch:state.motionEpoch});hide(restore);
  }
  function close(){
    if(dragSource||clearing)return false;
    if(confirmation){confirmation=false;syncTools();return true;}
    const next=reduceLibrary(state,{type:"CLOSE"});if(next===state)return false;
    state=next;setHistoryDrawer(false);data.stop();const epoch=state.motionEpoch,panel=sample(shell.panel),shade=sample(shell.shade),glass=sample(shell.glass);
    cancelMotion();shell.panel.inert=true;
    trace("motion.begin",{phase:"closing",section:state.section,duration:duration(360)},{flush:false});startMotionProbe(duration(360));
    void Promise.all([play(shell.panel,[panel,{opacity:0,transform:"translateY(8px)"}],duration(360)),play(shell.glass,[glass,{opacity:0}],duration(360)),play(shell.shade,[shade,{opacity:0}],duration(320))]).then(()=>{
      if(!current(epoch))return;state=reduceLibrary(state,{type:"MOTION_DONE",epoch});hide(true,true);
    });return true;
  }
  function showLayer(){
    const {layer}=shell;layer.hidden=false;layer.setAttribute("data-library-open","");
    if(shell.topLayer)try{layer.showPopover();if(!layer.matches(":popover-open"))throw Error("not open");}
    catch{layer.removeAttribute("popover");shell.topLayer=false;trace("surface.fallback",{reason:"popover-unavailable"});}
    const rect=shell.panel.getBoundingClientRect();
    return rect.width>0&&rect.height>0&&win.getComputedStyle(layer).display!=="none";
  }
  function open(section="history"){
    lastFailure=null;
    if(dead||dragSource||clearing)return fail("busy");
    if(!enabled())return fail("disabled");
    if(!LIBRARY_SECTIONS.includes(section))return fail("section");
    if(!win.gBrowserInit?.delayedStartupFinished)return fail("startup");
    if(win.fullScreen||privateWindow())return fail("window");
    const overlay=win.__nocturneOverlay;
    if(!overlay)return fail("overlay-missing");
    if(!win.__nocturneLibraryServices)return fail("services-missing");
    try{return openInternal(section,overlay);}catch(error){trace("open.error",{name:error?.name||"Error"});try{closeNow(false);}catch{}return fail("exception");}
  }
  function openInternal(section,overlay){
    if(!mount())return fail("mount");
    if(!geometry())return fail("geometry");
    if(!overlay.request(OWNER))return fail("overlay-busy");
    const before=state,next=reduceLibrary(state,{type:"OPEN",section});if(next===state)return true;
    const first=before.phase==="closed",reopening=before.phase==="closing";
    const panel=first?{opacity:0,transform:"translateY(8px)"}:sample(shell.panel),shade=first?{opacity:0}:sample(shell.shade),glass=first?{opacity:0}:sample(shell.glass),body=sample(shell.body);
    data.stop();renderedSection=null;confirmation=false;pendingResult=null;++actionSerial;cancelMotion();state=next;const epoch=state.motionEpoch;shell.panel.inert=false;
    if(first){returnFocus=doc.activeElement;if(!showLayer()){closeNow();return fail("surface-hidden");}}
    setHistoryDrawer(false);renderHeader();
    if(state.phase==="opening"){
      trace("motion.begin",{phase:"opening",section:state.section,duration:duration(reopening?360:480)},{flush:false});startMotionProbe(duration(reopening?360:480));
      void Promise.all([play(shell.panel,[panel,{opacity:1,transform:"translateY(0px)"}],duration(reopening?360:480)),play(shell.glass,[glass,{opacity:1}],duration(reopening?360:480)),play(shell.shade,[shade,{opacity:1}],duration(340))]).then(()=>settle(epoch));
      renderBody();(shell.search.disabled?shell.tabs.get(state.section):shell.search).focus({preventScroll:true});
    }else{
      void play(shell.body,[body,{opacity:0,transform:"translateX(-6px)"}],duration(140)).then(()=>{
        if(!current(epoch))return;cancelMotion();renderBody();
        return play(shell.body,[{opacity:0,transform:"translateX(6px)"},{opacity:1,transform:"none"}],duration(240)).then(()=>settle(epoch));
      });
    }
    trace("open.accepted",{section,phase:state.phase,topLayer:shell.topLayer},{flush:false});return true;
  }
  function toggle(section="history"){return active()&&state.phase!=="closing"&&state.section===section?close():open(section);}
  function bindOverlay(){
    lease();const overlay=win.__nocturneOverlay;
    lease=overlay?.register(OWNER,{priority:60,isActive:active,canYield:()=>!dragSource&&!clearing,yield(){if(dragSource||clearing)return false;closeNow(false);return true;},onEscape(){if(shell&&!shell.historyDrawer.inert){setHistoryDrawer(false,true);return true;}return close()||active();}})||(()=>{});
    if(active()&&!overlay?.request(OWNER))closeNow();
  }
  function onPref(){if(!enabled()){if(dragSource)pendingClose=true;else closeNow();}}
  function onTab(){if(active()&&!backgroundAction){if(dragSource)pendingClose=true;else closeNow(false);}}
  function onDragStart(e){if(active()&&!shell?.body.contains(e.target))onTab();}
  // Pref observers of independent Sine scripts have no guaranteed order.
  // Wait until all synchronous Gecko pref notifications finish before opening
  // the new media session, otherwise a later service observer revokes it.
  let mediaRefreshQueued=false;
  function onMediaPref(){
    if(dead||!active()||state.phase==="closing"||!["documents","pictures"].includes(state.section))return;
    if(dragSource){pendingClose=true;return;}
    if(mediaRefreshQueued)return;
    mediaRefreshQueued=true;
    win.queueMicrotask(()=>{
      mediaRefreshQueued=false;
      if(dead||!active()||state.phase==="closing"||!["documents","pictures"].includes(state.section))return;
      if(dragSource){pendingClose=true;return;}
      trace("media.scope.reload",{section:state.section});
      renderBody();
    });
  }
  function onWorkspace(e){if(active()&&e.detail?.phase!=="idle"){if(dragSource)pendingClose=true;else closeNow(false);}}
  function route(e,section,origin){
    if(!section)return false;
    const pref=section==="history"?SHORTCUT:DOWNLOADS_SHORTCUT,service=win.__nocturneLibraryServices;
    let reason=null;
    if(!enabled()||!prefs.getBoolPref(pref,false))reason="disabled";
    else if(privateWindow())reason="private";
    else if(!service)reason="services-missing";
    else if(section==="history"&&!service.historyReady?.())reason="history-unready";
    else if(section==="downloads"&&!service.downloads?.isReady?.()){reason="downloads-unready";void service.downloads?.start?.().catch(()=>{});}
    if(!reason&&!toggle(section))reason=lastFailure||"toggle-rejected";
    trace("shortcut",{section,origin,accepted:!reason,reason},{flush:false});
    // While our Library is enabled, never dispatch a rejected request to Zen.
    // The native preference is leased by Layout during opt-in cutover.
    if(reason&&!enabled()&&prefs.getBoolPref("zen.library.enabled",true))return false;
    e.preventDefault();e.stopImmediatePropagation();return true;
  }
  function onCommand(e){
    route(e,libraryHistoryCommand(e)?"history":libraryDownloadsCommand(e)?"downloads":null,"command");
  }
  function onKey(e){
    const section=libraryShortcutSection(e,Services.appinfo.OS);
    if(!section)return;
    // XUL commands are still supported for menus and customized keys.
    // A handled physical key is consumed before Zen's command dispatch.
    route(e,section,"keydown");
  }
  function onServicesGone(){if(dragSource){pendingClose=true;return;}if(active())closeNow();}
  // A captured descendant unload is not a chrome-window exit.
  let ignoredUnload=false;
  function onUnload(event){
    const own=target=>target===win||target===doc;
    if(!own(event?.target)||(event.originalTarget&&!own(event.originalTarget))){
      if(!ignoredUnload){ignoredUnload=true;trace("unload.ignored",{reason:"foreign-document"});}
      return;
    }
    dispose("window-unload");
  }
  function dispose(reason="replacement"){
    if(dead)return;
    dead=true;let failed=0;
    const step=fn=>{try{fn();}catch{failed++;}};
    trace("dispose.begin",{reason,phase:state.phase,owns:win[KEY]===api});
    step(()=>closeNow(false));step(stopFallbackDragWatch);step(()=>data.dispose());step(()=>lease());step(()=>cancelMotion());
    if(frame)step(()=>win.cancelAnimationFrame(frame));frame=0;
    for(const [name,fn] of listeners)step(()=>win.removeEventListener(name,fn,true));
    for(const [pref,fn] of [[PREF,onPref],[MEDIA_PREF,onMediaPref],["zen.nocturne.library.custom-folders",onMediaPref]])step(()=>prefs.removeObserver(pref,fn));
    step(()=>shell?.layer.remove());shell=null;
    if(win[KEY]===api)delete win[KEY];
    trace("dispose.end",{reason,failed});
  }
  const listeners=[["keydown",onKey],["command",onCommand],["Nocturne:ServicesGone",onServicesGone],["Nocturne:OverlayReady",bindOverlay],["resize",resize],["TabSelect",onTab],["ZenRefined:WorkspaceTransition",onWorkspace],["dragstart",onDragStart],["unload",onUnload]];
  const api={open,toggle,close,getState:()=>({...state}),getDiagnostics:diagnostics,dispose:()=>dispose("replacement")};
  win[KEY]=api;for(const [name,fn] of listeners)win.addEventListener(name,fn,true);
  win.addUnloadListener(()=>dispose("sine-unload"));prefs.addObserver(PREF,onPref);prefs.addObserver(MEDIA_PREF,onMediaPref);prefs.addObserver("zen.nocturne.library.custom-folders",onMediaPref);bindOverlay();trace("ready",diagnostics(false));
})();
