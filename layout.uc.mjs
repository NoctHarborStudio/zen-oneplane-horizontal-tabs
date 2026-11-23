/* Nocturne boot prelude: cover the chrome before layout or telemetry work.
 * The assembly controller adopts this exact node; a missing controller
 * cannot leave the browser covered. No profile or OS changes. */
(()=>{
  const win=window,root=document.documentElement,prefs=Services.prefs;
  const KEY="__nocturneEarlyBoot",PHASE="data-zr-startup-phase",BOOT="data-nocturne-boot";
  // Finish the previous Layout generation before any replacement resources.
  if(typeof win.addUnloadListener==="function"&&!win.closed&&!root.hasAttribute("popup-window"))win.__oneplaneLayoutController?.cleanup?.();
  if(win[KEY]||win.__zenRefinedStartupAnimationSeen||win.__nocturneLayoutStartup||
     typeof win.addUnloadListener!=="function"||win.closed||root.hasAttribute("popup-window")||
     root.hasAttribute("customizing")||root.getAttribute("inDOMFullscreen")==="true"||
     win.performance.now()>=3500||!prefs.getBoolPref("zen.refined.startup.animation",true)||
     !prefs.getBoolPref("zen.nocturne.boot.enabled",true)||win.matchMedia("(prefers-reduced-motion: reduce)").matches)return;
  let node=null,timer=0,claimed=false,cleaned=false,phaseOwned=false,bootOwned=false;
  const oldPhase=root.getAttribute(PHASE),oldBoot=root.getAttribute(BOOT);
  const restore=(key,value)=>{if(value===null)root.removeAttribute(key);else root.setAttribute(key,value);};
  function stopTimer(){const id=timer;timer=0;if(id)try{win.clearTimeout(id);}catch{}}
  const cleanup=()=>{
    if(claimed||cleaned)return;cleaned=true;
    stopTimer();let failed=0;const step=fn=>{try{fn();}catch{failed++;}};
    step(()=>node?.remove());
    if(win[KEY]===record){
      if(bootOwned&&root.getAttribute(BOOT)==="waiting")step(()=>restore(BOOT,oldBoot));
      if(phaseOwned&&root.getAttribute(PHASE)==="waiting")step(()=>restore(PHASE,oldPhase));
      delete win[KEY];
      step(()=>win.__zenMagneticBookmarksShared?.syncAddressState?.());
    }
    if(failed)try{win.__nocturneTrace?.("boot.prelude.cleanup",{failed},{flush:true});}catch{}
  };
  const record={node:null,at:0,deadline:0,adopt(){
    if(claimed||cleaned||win[KEY]!==record||!node?.isConnected)return null;
    if(win.performance.now()>=record.deadline){expire();return null;}
    claimed=true;stopTimer();delete win[KEY];
    return {node,at:record.at,deadline:record.deadline,phaseBaseline:oldPhase,bootBaseline:oldBoot};
  },cleanup};
  function expire(){
    if(claimed||cleaned||win[KEY]!==record)return;
    // The orphan cover's budget has expired. A late Assembly must not replay.
    win.__zenRefinedStartupAnimationSeen=true;cleanup();
  }
  try{
    node=document.createElementNS("http://www.w3.org/1999/xhtml","div");
    node.id="nocturne-boot";node.setAttribute("aria-hidden","true");node.inert=true;
    Object.assign(node.style,{position:"fixed",inset:"0",zIndex:"2147483647",display:"grid",placeItems:"center",background:"#111219",color:"#e4e5ef",pointerEvents:"none",overflow:"hidden",willChange:"opacity"});
    node.style.setProperty("-moz-window-dragging","default","important");
    record.node=node;record.at=win.performance.now();record.deadline=record.at+8000;win[KEY]=record;
    root.append(node);
    if(cleaned||claimed||win[KEY]!==record)return;
    bootOwned=true;root.setAttribute(BOOT,"waiting");
    if(cleaned||claimed||win[KEY]!==record)return;
    phaseOwned=true;root.setAttribute(PHASE,"waiting");
    if(cleaned||claimed||win[KEY]!==record)return;
    const data={age:record.at,paintCount:win.windowUtils?.paintCount,delayed:!!win.gBrowserInit?.delayedStartupFinished};
    if(win.__nocturneTrace)win.__nocturneTrace("boot.prelude",data,{sample:1800});
    else{const q=win.__nocturneEarlyTrace??(win.__nocturneEarlyTrace=[]);if(q.length<32)q.push({event:"boot.prelude",t:record.at,data});}
    if(cleaned||claimed||win[KEY]!==record)return;
    timer=win.setTimeout(expire,Math.max(0,record.deadline-win.performance.now()));win.addUnloadListener(cleanup);
  }catch{cleanup();}
})();
/* Nocturne preview.18 diagnostic recorder — read-only chrome telemetry.
 * No content, URLs, titles, input values or native identifiers. */
(()=>{
  const win=window,doc=document,root=doc.documentElement,VERSION="0.3.0-preview.152",PREF="zen.nocturne.diagnostics.enabled";
  if(typeof win.addUnloadListener!=="function"||root.hasAttribute("popup-window"))return;
  try{win.__nocturneDiagnostics?.dispose?.();}catch{}
  const started=Date.now(),id=started.toString(36)+"-"+Math.random().toString(36).slice(2,8);
  const fileName="nocturne-diagnostics.json",entries=[],last=new Map(),nodes=new Map(),removers=[];
  // Native module identity survives even a zero-window interval. The only
  // expando is our own non-enumerable process queue; no native state changes.
  const STORE="__nocturneDiagnosticStore",PROCESS=Symbol.for("nocturne.diagnostics.writer.v1");
  let anchor=null,store=null,legacy=null,conflict=false,anchored=false;
  function consider(candidate){
    if(!candidate)return;
    if(candidate.contract!==1||typeof candidate.submit!=="function"){legacy=legacy||candidate;return;}
    if(!store)store=candidate;
    else if(store!==candidate)conflict=true;
  }
  try{consider(win[STORE]);}catch{}
  try{
    anchor=ChromeUtils.importESModule("resource:///modules/BrowserWindowTracker.sys.mjs").BrowserWindowTracker;
    consider(anchor?.[PROCESS]);
  }catch{}
  // Inspect all visible peers, even after finding a usable modern writer.
  // Mixed generations or distinct active queues require a process restart.
  try{
    const windows=Services.wm.getEnumerator("navigator:browser");
    while(windows.hasMoreElements()){
      const w=windows.getNext();if(w===win)continue;
      try{consider(w[STORE]);}catch{}
    }
  }catch{}
  if(legacy)store=legacy;
  else if(conflict)store=null;
  else{
    if(!store)store=makeWriter();
    if(store&&!store.local&&anchor)try{
      if(!anchor[PROCESS])Object.defineProperty(anchor,PROCESS,{value:store,configurable:true});
      anchored=anchor[PROCESS]===store;
    }catch{}
  }
  if(store)win[STORE]=store;
  const writerMode=legacy?"legacy-blocked":conflict?"conflict-blocked":store?.contract===1?(store.local?"local":anchored?"process":"independent"):"unavailable";
  let previousMetrics={},sampleIndex=0;
  const startupEvents=[];
  const changedAttrs=new WeakMap();
  let seq=0,dropped=0,dead=false,quiescing=false,timer=0,writeTimer=0,writing=null,dirty=false,until=0,raf=0,frameLast=0,gaps=[],ioError=false,observer=null,nativeContainer=null;
  const now=()=>win.performance.now(),get=id=>doc.getElementById(id);
  const enabled=()=>{try{return Services.prefs.getBoolPref(PREF,true);}catch{return true;}};
  const round=v=>Number.isFinite(v)?Math.round(v*100)/100:null;
  // Trace metadata is structural, not a channel for page/file/user strings.
  const EVENT_NAME=/^[a-z][a-z0-9_-]{0,31}(?:\.[A-Za-z0-9_][A-Za-z0-9_:-]{0,31}){0,4}$/;
  const FIELD_NAME=/^[A-Za-z][A-Za-z0-9_.:-]{0,63}$/;
  const PRIVATE_FIELD=/^(?:url|uri|href|path|title|query|search(?:Text|Term|Query)|text|input|content|file(?:name|path)?|payload|clipboard|secret|password|cookie|credentials?)(?:$|[_-]|[A-Z])|(?:URL|URI|Url|Uri|Path|Title|Query|QueryString|SearchText|SearchTerm|FileName|Filename|InputValue|TextContent|Payload|Secret|Password|Cookie)$/;
  const MARK_LABEL=/^[a-z][a-z0-9_-]{0,39}$/;
  const SAFE_TOKEN=/^[A-Za-z0-9_.:-]{1,80}$/;
  const STRING_FIELDS=new Set(["owner","reason","stage","status","phase","mode","state","kind","type","section","operation","action","result","outcome","resource","source","target","direction","writer","version","label","name","context","scope","placement","transition","effect","substage","settlement","strategy","decision","method","cause","gesture","origin","policy","side"]);
  const STRING_ENUMS=new Map([
    ["previous",new Set(["inline","content","outside"])],
    ["requested",new Set(["inline","content","outside"])],
    ["drop",new Set(["none","copy","move","link"])],
    ["code",new Set(["busy","confirmed","data-busy","data-lease-lost","data-lease-required","data-unavailable","free-ambiguous","free-changed","free-exists","free-order-unverified","gate-unavailable","missing-target","native-busy","not-started","peer-busy","peer-lease-lost","peer-unavailable","rename-unavailable","stale","error","rejected","unverified","selection-unverified","selection-mismatch","inspection-error","trash-readiness-cancelled","workspace-data-changed","move-preflight","delete-preflight","delete-transfer-changed","close-unavailable","return-target","return-unverified","return-unavailable","native-target-stale","native-hidden-or-empty","native-glance-remap","native-split-unavailable","native-essentials-unsupported","native-may-clone","native-split-group-unready","native-split-limit"])],
    ["engine",new Set(["waapi-shape","waapi-polygon"])],
    ["easing",new Set(["ease-out"])],
    ["from",new Set(["out","swap","in"])],
    ["to",new Set(["out","swap","in"])],
    ["startup",new Set(["waiting","playing","settling"])],
    ["ready",new Set(["pending","true"])],
    ["homeState",new Set(["unavailable","pending","skipped","ready","failed"])],
    ["resultType",new Set(["undefined","object","boolean","number","string","function","symbol","bigint"])],
    ["os",new Set(["WINNT","Darwin","Linux","Android","FreeBSD","OpenBSD","NetBSD"])]
  ]);
  // Event-specific codes come only from fixed Nocturne producers, never user/native text.
  // Unlisted events keep their previous bounded grammar until separately audited.
  const EVENT_STRING_ENUMS=new Map([
    ["library.open.rejected",{reason:new Set(["busy","disabled","section","startup","window","overlay-missing","services-missing","exception","mount","geometry","overlay-busy","surface-hidden"])}],
    ["library.shortcut",{reason:new Set(["busy","disabled","section","startup","window","overlay-missing","services-missing","exception","mount","geometry","overlay-busy","surface-hidden","private","history-unready","downloads-unready","toggle-rejected"])}],
    ["library.media.scan.wait",{status:new Set(["deadline","late-complete","late-error"])}],
    ["library.media.refresh",{status:new Set(["committed","error"])}],
    ["downloads.native.transfer",{reason:new Set(["ineligible","file-unavailable","payload-written","native-error"])}],
    ["downloads.drag.payload",{reason:new Set(["native-source-or-file-unavailable"])}],
    ["home.search.close-start",{reason:new Set(["escape","home-background","native-close","native-event","native-observer"])}],
    ["home.search.close-finish",{reason:new Set(["escape","home-background","native-close","native-event","native-observer"])}],
    ["home.search.snapshot-unavailable",{reason:new Set()}],
    ["page-progress.network",{reason:new Set(["overlap-start","stale-stop"])}],
    ["library.file.drag.recovered",{reason:new Set(["native-session-ended","native-session-unavailable"])}],
    ["library.surface.fallback",{reason:new Set(["popover-unavailable"])}],
    ["center.bloom.fallback",{reason:new Set(["preflight","budget"])}],
    ["center.motion.skip",{reason:new Set(["no-row","no-visible-cards"])}],
    ["center.fold.reject",{reason:new Set(["partial-clip","coordinate-frame"])}],
    ["workspace.startup.wait",{reason:new Set(["user-takeover","deadline","setup-error","settled","error","layout-dispose"])}],
    ["address.cascade.finish",{reason:new Set(["cancelled","setup-failed","finished","watchdog","watchdog-unavailable"])}],
    ["address.finish",{reason:new Set(["finished","cancelled","watchdog","fallback-failed","setup-failed"])}],
    ["drag.incoming.release",{reason:new Set(["source-gone","geometry-or-phase","new-preview","drop-rejected","leave-strip","source-unresolved","outside-toolbar"])}],
    ["hub.projection.search-cancelled",{reason:new Set(["stale-preparation"])}],
    ["hub.projection.search-error",{reason:new Set(["native-error"])}],
    ["hub.projection.failed",{reason:new Set(["native-error"])}],
    ["hub.projection.return-rejected",{reason:new Set(["return-target","return-unverified","unavailable"])}],
    ["drag.placement.preview",{reason:new Set(["work-area-change"])}]
  ]);
  const CSS_FIELDS=new Set(["opacity","visibility","display","translate","scale","transform","transition","height","width","hoverProgress","centerX","centerAlpha","startupBase","mask","bmMask","contour","bmContour","measure","progress","startupProgress"]);
  const CSS_VALUE=/^[#A-Za-z0-9.,()%+ :-]{1,180}$/;
  // Popup CSS is sampled from known chrome elements, not page content.
  // Reject URLs, custom text and unstructured CSS declarations.
  const POPUP_COLOR=/^(?:transparent|currentcolor|#[0-9a-fA-F]{3,8}|rgba?\([0-9.% ,/]+\)|color\((?:srgb|display-p3) [0-9.% /]+\))$/i;
  const POPUP_RADIUS=/^(?:0|[0-9]+(?:\.[0-9]{1,3})?(?:px|em|rem|%))$/;
  const POPUP_APPEARANCE=new Set(["none","auto","-moz-panel","panel","menulist","textfield","button"]);
  const POPUP_FLIP=new Set(["both","slide","none","vertical","horizontal"]);
  // MutationObserver records only these structural lifecycle markers.
  // Unknown values are omitted, not treated as user-controlled text.
  const ATTRIBUTE_STATES=new Set(["true","false","pending","waiting","playing","settling","out","swap","in","idle","open","closed","opening","closing","showing","hiding","hidden","ready","complete","completed","done","exit","enter","leaving","entering","before","after","native","content","inline","outside","fold","unfold","expanded","compact","active","inactive"]);
  let pb=null;try{pb=win.PrivateBrowsingUtils||ChromeUtils.importESModule("resource://gre/modules/PrivateBrowsingUtils.sys.mjs").PrivateBrowsingUtils;}catch{}
  const privateWindow=()=>{try{return root.hasAttribute("privatebrowsingmode")&&root.getAttribute("privatebrowsingmode")!=="false"||!pb||pb.isWindowPrivate(win);}catch{return true;}};
  function safe(v,d=0,key="",budget={left:1024},event="",parent=""){
    if(--budget.left<0)return null;
    if(v==null||typeof v==="boolean")return v;
    if(typeof v==="number")return round(v);
    if(typeof v==="string"){
      // No free-form text, URI schemes, paths, file names or raw page values.
      if(/[\\\\/@?#]/.test(v)||/^(?:about|data|chrome|resource|file|https?|ftp|javascript):/i.test(v))return null;
      if(event==="downloads.drag.popup-shown"&&parent==="surface"){
        if(["background","stage","part","panelBackground"].includes(key))return v.length<=120&&POPUP_COLOR.test(v)?v:null;
        if(key==="radius")return POPUP_RADIUS.test(v)?v:null;
        if(key==="appearance")return POPUP_APPEARANCE.has(v)?v:null;
        if(key==="flip")return POPUP_FLIP.has(v)?v:null;
      }
      if(event==="downloads.drag.popup-shown"&&key==="via")return v==="watch"?v:null;
      if(event.startsWith("downloads.drag.")&&key==="flip")return POPUP_FLIP.has(v)?v:null;
      if(parent===""&&(key==="reason"||key==="status")){const values=EVENT_STRING_ENUMS.get(event)?.[key];if(values&&!values.has(v))return null;}
      if(key==="name"&&!/^(?:Error|[A-Z][A-Za-z0-9]{0,45}(?:Error|Exception)|NS_ERROR_[A-Z0-9_]{1,45})$/.test(v))return null;
      if(key==="label"&&!MARK_LABEL.test(v))return null;
      if(STRING_ENUMS.has(key))return STRING_ENUMS.get(key).has(v)?v:null;
      if(!CSS_FIELDS.has(key)&&!STRING_FIELDS.has(key)&&!key.startsWith("data-")&&!key.startsWith("zen-")&&!["customizing","inDOMFullscreen","inFullscreen"].includes(key))return null;
      return (CSS_FIELDS.has(key)?CSS_VALUE:SAFE_TOKEN).test(v)?v:null;
    }
    if(d>=6)return null;
    if(Array.isArray(v))return v.slice(0,32).map(x=>safe(x,d+1,key,budget,event,parent));
    if(typeof v!=="object"||Object.getPrototypeOf(v)!==Object.prototype&&Object.getPrototypeOf(v)!==null)return null;
    const out=Object.create(null);
    for(const [name,value] of Object.entries(v).slice(0,45)){
      if(!FIELD_NAME.test(name)||PRIVATE_FIELD.test(name))continue;
      out[name]=safe(value,d+1,name,budget,event,key);
      if(budget.left<=0)break;
    }
    return out;
  }
  function safeChromeChanges(changes){
    if(!Array.isArray(changes))return null;
    const result=[];
    for(const item of changes.slice(0,32)){
      if(!item||typeof item!=="object"||Object.getPrototypeOf(item)!==Object.prototype&&Object.getPrototypeOf(item)!==null)continue;
      const {node,attr,value}=item;
      if(typeof node!=="string"||typeof attr!=="string"||(node!=="root"&&!nodes.has(node))||
        !(node==="root"?rootAttrs:attrs).includes(attr))continue;
      result.push({node,attr,value:value===null?null:value===""?"":typeof value==="string"&&ATTRIBUTE_STATES.has(value)?value:null});
    }
    return result;
  }
  function exportData(){return {schema:2,version:VERSION,window:id,started,dropped,startup:startupEvents.slice(),events:entries.slice()};}
  function dump(){return JSON.stringify(exportData(),null,2);}
  // Trusted static package code, executed in an independent Gecko global.
  // The queue retains only parsed JSON, never a browser window or callback.
  function createWriter(){
    let sessions=null,dir=null,running=false,cleaned=false;
    const pending=new Map();
    const MAX_FILE_BYTES=2000000,SESSION_BYTES=620000,STARTUP_BYTES=120000;
    const bytes=value=>new TextEncoder().encode(value).length;
    function trimEvents(s){
      if(s.events.length<=1)return false;
      const count=Math.min(s.events.length-1,Math.max(1,Math.ceil(s.events.length*.15)));
      s.events.splice(0,count);s.dropped=(s.dropped||0)+count;return true;
    }
    function packSessions(sessions,version){
      const pack=()=>JSON.stringify({schema:2,version,sessions},null,2);
      for(let i=0;i<sessions.length;i++){
        const s=sessions[i]={...sessions[i],startup:Array.isArray(sessions[i].startup)?sessions[i].startup.slice():[],events:sessions[i].events.slice()};
        // Keep the earliest archive evidence within a separate byte budget.
        while(s.startup.length&&bytes(JSON.stringify(s.startup,null,2))>STARTUP_BYTES){
          s.startup.pop();s.startupDropped=(s.startupDropped||0)+1;
        }
        while(bytes(JSON.stringify(s,null,2))>SESSION_BYTES&&trimEvents(s)){}
        if(bytes(JSON.stringify(s,null,2))>SESSION_BYTES&&s.events.length===1){
          s.events.pop();s.dropped=(s.dropped||0)+1;
        }
      }
      let data=pack();
      while(bytes(data)>MAX_FILE_BYTES){
        const s=sessions.filter(s=>s.events.length>1).sort((a,b)=>b.events.length-a.events.length)[0];
        if(!s||!trimEvents(s))break;
        data=pack();
      }
      return {data,sessions};
    }
  
    const birth=s=>s.started||parseInt(String(s.window).split("-")[0],36)||s.updated||0;
    async function write(session){
      if(!dir){const path=PathUtils.join(PathUtils.profileDir,"nocturne-diagnostics");await IOUtils.makeDirectory(path,{ignoreExisting:true});dir=path;}
      const path=PathUtils.join(dir,"nocturne-diagnostics.json");
      if(!sessions){
        let old=null;try{old=JSON.parse(await IOUtils.readUTF8(path));}catch{}
        sessions=old?.schema===2&&Array.isArray(old.sessions)?old.sessions.filter(x=>x&&Array.isArray(x.events)):[];
      }
      const next=sessions.filter(x=>x.window!==session.window);
      next.push(session);next.sort((a,b)=>birth(a)-birth(b));while(next.length>3)next.shift();
      if(!next.includes(session))return false;
      const packed=packSessions(next,session.version);
      if(bytes(packed.data)>MAX_FILE_BYTES)throw Error("Diagnostic session exceeds byte budget");
      await IOUtils.writeUTF8(path,packed.data,{tmpPath:path+".tmp"});
      sessions=packed.sessions;
      if(!cleaned){
        cleaned=true;
        try{for(const p of await IOUtils.getChildren(dir))if(/^nocturne-[a-z0-9]+-[a-z0-9]+\.json$/.test(PathUtils.filename(p))&&PathUtils.filename(p)!=="nocturne-diagnostics.json")await IOUtils.remove(p,{ignoreAbsent:true});}catch{}
      }
      return true;
    }
    async function drain(){
      if(running)return;running=true;
      try{
        while(pending.size){
          const [id,entry]=pending.entries().next().value;pending.delete(id);
          let ok=false;try{ok=await write(entry.session);}catch{}
          entry.resolve(ok);
        }
      }finally{running=false;}
    }
    function submit(json){
      let session;try{session=JSON.parse(json);}catch{return Promise.resolve(false);}
      if(session?.schema!==2||typeof session.window!=="string"||typeof session.version!=="string"||!Array.isArray(session.events))return Promise.resolve(false);
      const existing=pending.get(session.window);
      if(existing){existing.session=session;return existing.promise;}
      let resolve;const promise=new Promise(r=>{resolve=r;});
      pending.set(session.window,{session,promise,resolve});
      // One active write and at most three queued latest snapshots.
      if(pending.size>3){
        const [key,old]=[...pending].sort((a,b)=>birth(a[1].session)-birth(b[1].session))[0];
        pending.delete(key);old.resolve(false);
      }
      void drain();return promise;
    }
    return {contract:1,submit};
  }
  function makeWriter(){
    try{
      const cu=Components.utils;
      const sandbox=cu.Sandbox(Services.scriptSecurityManager.getSystemPrincipal(),{
        sandboxName:"Nocturne diagnostic writer",freshZone:true,wantComponents:false,
        wantGlobalProperties:["IOUtils","PathUtils","TextEncoder"]
      });
      return cu.evalInSandbox("("+createWriter.toString()+")()",sandbox);
    }catch{
      // Reduced guarantee: the same queue accepts snapshots immediately,
      // but a window-local fallback may not survive destruction.
      try{if(typeof IOUtils!=="undefined"&&typeof PathUtils!=="undefined")return {...createWriter(),local:true};}catch{}
      return null;
    }
  }
  const MAX_EVENTS=3200;
  function persist(){
    if(privateWindow()||!enabled()||legacy||conflict||store?.contract!==1)return Promise.resolve(false);
    try{
      const job=store.submit(JSON.stringify({...exportData(),updated:Date.now()}));
      return Promise.resolve(job).then(ok=>{
        if(!ok&&!ioError){ioError=true;try{win.console.warn("[Nocturne diag] Local snapshot not retained; use __nocturneDiagnostics.dump()");}catch{}}
        return ok;
      },()=>false);
    }catch{return Promise.resolve(false);}
  }
  function startupPlaying(){return root.getAttribute("data-zr-startup-phase")==="playing"||root.hasAttribute("data-nocturne-boot");}
  function scheduleWrite(){if(!writeTimer&&!dead&&!quiescing&&!privateWindow())writeTimer=win.setTimeout(()=>{
    writeTimer=0;if(startupPlaying()){scheduleWrite();return;}void flush();
  },2200);}
  function flush(){
    if(writeTimer){win.clearTimeout(writeTimer);writeTimer=0;}
    if(!dirty)return writing||Promise.resolve(false);
    dirty=false;
    // Snapshot and submit now even if the previous disk write is pending.
    const job=persist();writing=job;
    job.then(()=>{if(writing===job)writing=null;},()=>{if(writing===job)writing=null;});
    return job;
  }
  function record(event,detail=null,options={}){
    if(dead||!enabled()||typeof event!=="string"||event.length>96||!EVENT_NAME.test(event))return;
    try{
      const t=now(),interval=Number.isFinite(options?.throttle)&&options.throttle>0?Math.min(options.throttle,60000):0;
      const key=typeof options?.key==="string"&&options.key.length<=96&&EVENT_NAME.test(options.key)?options.key:event;
      if(interval){
        if(last.has(key)&&t-last.get(key)<interval)return;
        // Only active throttle identities need retention; old keys age out.
        last.delete(key);
        if(last.size>=256)last.delete(last.keys().next().value);
        last.set(key,t);
      }
      const raw=typeof detail==="function"?detail():detail;
      const data=event==="chrome.attributes"?safeChromeChanges(raw):safe(raw,0,"",{left:1024},event);
      // Lazy detail may synchronously trace, disable or dispose this recorder.
      // Commit sequence/time only after it returns; a dead recorder is terminal.
      if(dead||!enabled())return;
      const item={n:++seq,t:round(now()),event,data};
      if(startupEvents.length<100&&(/^(assembly\.|layout\.|boot\.)/.test(event)||event.startsWith("center.")&&item.data?.owner==="startup"))startupEvents.push(item);
      entries.push(item);if(entries.length>MAX_EVENTS){entries.shift();dropped++;}
      dirty=true;
      if(event!=="sample")win.console.info("[Nocturne diag "+id+"] "+JSON.stringify(item));
      if(options.flush||quiescing)void flush();else scheduleWrite();
      if(options.sample)arm(options.sample===true?1600:options.sample);
    }catch{}
  }
  const rootAttrs=["data-zr-center-handoff","data-zr-center-motion","data-zr-center-pending","oneplane-active","data-op-startup-ready","data-zr-startup-phase","data-nocturne-boot","data-zr-closing","data-zr-workspace-phase","data-op-bookmark-wave","zen-compact-mode","customizing","inDOMFullscreen","inFullscreen"];
  const attrs=[...rootAttrs,"data-op-panel-open","oneplane-url-hold","oneplane-drag-hold","oneplane-startup-hold","oneplane-hub-hold","oneplane-tab-menu-hold","oneplane-home-hold","oneplane-workspace-hold","oneplane-download-hold","zen-has-hover","has-popup-menu","zen-compact-mode-active","data-ready","data-op-overflow-row","data-op-adaptive-compact","data-op-dragging","data-op-inline-drag","data-op-lane-drag","data-op-group-pull","data-op-live-drag","data-op-drag-commit","data-op-url-phase","data-op-home-open","data-op-lane-ghost","data-op-magnetic-pull","data-op-magnetic-source","data-op-detached","data-op-pulling","data-op-drag-follow","data-op-reinsert","data-zr-workspace-geometry","data-zr-workspace-motion","data-zr-center-card","data-zr-workspace-height-motion","data-zr-workspace-surface","data-zr-workspace-page","data-zr-home-covered","data-zr-startup-effect","data-zr-close-effect","hidden","collapsed","open","focused"];
  const targets=["titlebar-buttonbox","titlebar-max","titlebar-restore","titlebar-close","zr-page-progress","oneplane-tab-indicator","oneplane-overflow-slider","zen-appcontent-navbar-wrapper","zen-appcontent-navbar-container","oneplane-toolbar-surface","nav-bar","oneplane-tabs","oneplane-overflow-tabs","PersonalToolbar","PlacesToolbarItems","urlbar-container","urlbar","tabbrowser-tabpanels","zen-shared-home","zr-download-indicator"];
  function attrState(n,keys=attrs){const out={};for(const k of keys)if(n.hasAttribute(k))out[k]=n.getAttribute(k)||true;return out;}
  function observeTargets(){
    if(!observer)return;
    const wanted=new Map(targets.map(k=>[k,get(k)]).filter(x=>x[1]));
    const row=get("oneplane-tabs"),drag=row?.querySelector("[data-op-drag-follow],[data-op-detached],[data-op-pulling]");
    const ghost=doc.querySelector(".oneplane-bunny-ghost"),card=row?.querySelector(".oneplane-tab[data-selected]")||row?.querySelector(".oneplane-tab");
    const group=row?.querySelector(".oneplane-split-group"),handle=group?.querySelector(".oneplane-split-handle");
    if(group)wanted.set("split-group",group);if(handle)wanted.set("split-handle",handle);
    if(drag)wanted.set("source",drag);if(ghost){wanted.set("ghost",ghost);const body=ghost.querySelector(".oneplane-bunny-card");if(body)wanted.set("ghost-body",body);}if(card)wanted.set("card",card);
    const island=row?.querySelector(".oneplane-title-island"),label=island?.querySelector(".oneplane-island-title");
    if(island)wanted.set("home-island",island);if(label)wanted.set("home-label",label);
    const hovered=row?.querySelector(".oneplane-tab[data-op-hovered]");if(hovered){wanted.set("hover-card",hovered);const lane=hovered.closest(".oneplane-overflow-lane,.oneplane-island-lane");if(lane)wanted.set("hover-lane",lane);}
    if(wanted.size===nodes.size&&[...wanted].every(([k,n])=>nodes.get(k)===n))return;
    observer.disconnect();nodes.clear();observer.observe(root,{attributes:true,attributeFilter:rootAttrs});
    for(const [k,n] of wanted){nodes.set(k,n);observer.observe(n,{attributes:true,attributeFilter:attrs});}
  }
  function describe(n){
    if(!n?.isConnected)return null;
    const r=n.getBoundingClientRect(),s=win.getComputedStyle(n);
    let anim=[];try{anim=n.getAnimations().slice(0,6).map(a=>({state:a.playState,t:round(Number(a.currentTime)),duration:round(Number(a.effect?.getTiming()?.duration)),type:a.constructor?.name}));}catch{}
    const mask=n.style?.getPropertyValue("--op-contour-mask")||"",bm=n.style?.getPropertyValue("--zr-bm-contour-mask")||"";
    const hash=x=>{let h=0;for(let i=0;i<x.length;i++)h=(Math.imul(h,31)+x.charCodeAt(i))|0;return x.length?x.length+":"+h:null;};
    return {rect:[round(r.left),round(r.top),round(r.width),round(r.height)],opacity:s.opacity,visibility:s.visibility,display:s.display,translate:s.translate,scale:s.scale,transform:s.transform,transition:s.transitionProperty,height:s.height,width:s.width,margin:[s.marginInlineStart,s.marginInlineEnd],hoverProgress:s.getPropertyValue("--op-hover-progress").trim()||null,
      measure:n.style?.getPropertyValue("--op-measured-toolbar-height")||null,contour:n.style?.getPropertyValue("--op-contour-height")||null,bmContour:n.style?.getPropertyValue("--zr-bm-contour-height")||null,
      mask:hash(mask),bmMask:hash(bm),centerX:s.getPropertyValue("--zr-center-x").trim()||null,centerAlpha:s.getPropertyValue("--zr-center-alpha").trim()||null,progress:s.getPropertyValue("--zr-workspace-progress").trim()||null,startupProgress:s.getPropertyValue("--zr-startup-progress").trim()||null,startupBase:n.style?.getPropertyValue("--zr-startup-base-opacity")||null,attrs:attrState(n),animations:anim};
  }
  function frameSummary(){const frame={count:gaps.length,max:gaps.length?round(Math.max(...gaps)):null,over25:gaps.filter(v=>v>25).length};gaps=[];return frame;}
  function snapshot(){
    // The cold start itself is the workload under investigation. Don't
    // force dozens of style/layout reads or animation enumerations mid-run.
    // Keep the frame-gap stream and resume full geometry on handoff.
    if(startupPlaying())return {root:attrState(root,rootAttrs),frame:frameSummary(),full:false,metrics:{},light:true};
    observeTargets();
    const row=get("oneplane-tabs"),browser=win.gBrowser;
    const counts={native:browser?.tabs?.length??null,visible:browser?.visibleTabs?.length??null,mirror:row?.querySelectorAll(".oneplane-tab").length??null,
      selected:row?.querySelectorAll(".oneplane-tab[data-selected]").length??null,ghosts:doc.querySelectorAll(".oneplane-bunny-ghost").length};
    const metrics={};for(const [key,n] of nodes)metrics[key]=describe(n);
    // Counts, not labels or favicon URLs. Identify partially applied
    // startup/closing effects and the simultaneous source/ghost case.
    if(row){
      const marked=selector=>row.querySelectorAll(selector).length;
      counts.startup=marked("[data-zr-startup-effect]");counts.closing=marked("[data-zr-close-effect]");counts.center=marked("[data-zr-center-card]");
      counts.splitGroups=marked(".oneplane-split-group");counts.splitHandles=marked(".oneplane-split-handle");
      const images=[...row.querySelectorAll(".oneplane-tab-icon img")];counts.iconsReady=images.filter(n=>!n.hidden&&n.complete&&n.naturalWidth>0).length;counts.iconsTotal=images.length;
      counts.detached=marked("[data-op-detached]");counts.laneGhost=marked("[data-op-lane-ghost]");
    }
    const frame=frameSummary();
    // Periodic keyframes permit reconstructing a delta stream after ring
    // trimming. Changed properties only; missing nodes are explicit nulls.
    const full=sampleIndex++%10===0,delta={};
    if(full)Object.assign(delta,metrics);
    else{
      for(const key of new Set([...Object.keys(previousMetrics),...Object.keys(metrics)])){
        const old=previousMetrics[key],next=metrics[key];
        if(!next){if(old)delta[key]=null;continue;}
        if(!old){delta[key]=next;continue;}
        const diff={};for(const k of Object.keys(next))if(JSON.stringify(next[k])!==JSON.stringify(old[k]))diff[k]=next[k];
        if(Object.keys(diff).length)delta[key]=diff;
      }
    }
    previousMetrics=metrics;
    return {root:attrState(root,rootAttrs),counts,frame,full,metrics:delta};
  }
  function frameTick(t){raf=0;if(dead||quiescing||!enabled()||now()>until)return;if(frameLast&&gaps.length<300)gaps.push(t-frameLast);frameLast=t;raf=win.requestAnimationFrame(frameTick);}
  function sample(){timer=0;if(dead||quiescing||!enabled()||now()>until){frameLast=0;return;}record("sample",snapshot);timer=win.setTimeout(sample,180);}
  function arm(ms=1600){if(dead||quiescing||!enabled())return;until=Math.max(until,now()+Math.min(3000,Math.max(100,ms)));if(!timer)timer=win.setTimeout(sample,50);if(!raf){frameLast=0;raf=win.requestAnimationFrame(frameTick);}}
  function listen(target,type,fn){const guarded=(...args)=>{if(!dead&&!quiescing)fn(...args);};target.addEventListener(type,guarded,true);removers.push(()=>target.removeEventListener(type,guarded,true));}
  function bindNative(){
    const tc=win.gBrowser?.tabContainer;if(!tc||nativeContainer===tc)return;nativeContainer=tc;
    for(const type of ["TabSelect","TabOpen","TabClose","TabMove","TabPinned","TabUnpinned"])listen(tc,type,()=>record("native."+type,()=>({total:win.gBrowser?.tabs?.length,visible:win.gBrowser?.visibleTabs?.length}),{sample:1800}));
  }
  function stopSampling(){
    if(quiescing)return;
    quiescing=true;
    let failed=0;
    const release=fn=>{try{fn();}catch{failed++;}};
    release(()=>observer?.disconnect());observer=null;
    for(const off of removers.splice(0))release(off);
    if(timer)release(()=>win.clearTimeout(timer));if(writeTimer)release(()=>win.clearTimeout(writeTimer));if(raf)release(()=>win.cancelAnimationFrame(raf));
    timer=writeTimer=raf=0;nodes.clear();
    record("diagnostics.quiesce",{failed},{flush:true});
  }
  // The registered Layout generation, not a microtask checkpoint, owns
  // the terminal cleanup boundary. No window is kept alive for disk IO.
  let layoutOwner=null,handoff=false,disposeQueued=false,disposing=false;
  function claimLayout(owner){
    if(dead||quiescing||layoutOwner||typeof owner!=="function")return null;
    layoutOwner=owner;
    return ()=>{
      if(dead||layoutOwner!==owner)return;
      layoutOwner=null;
      requestDispose();
    };
  }
  function dispose(){
    if(dead||disposing)return;
    disposing=true;layoutOwner=null;
    stopSampling();
    record("diagnostics.dispose",()=>({closed:win.closed,phase:attrState(root,rootAttrs)}),{flush:true});
    dead=true;void flush();
    if(win.__nocturneTrace===record)delete win.__nocturneTrace;if(win.__nocturneDiagnostics===api)delete win.__nocturneDiagnostics;
  }
  function requestDispose(nativeExit=false){
    if(dead||disposing||handoff)return;
    const owner=layoutOwner;
    if(owner){
      handoff=true;
      try{
        stopSampling();
        // Delegate directly from the real chrome-window unload callback.
        // A deferred preference release calls its completion when ready.
        if(layoutOwner===owner){
          record("diagnostics.layout.handoff",{nativeExit:nativeExit===true},{flush:true});
          owner(nativeExit===true);
        }
      }catch(error){
        record("diagnostics.layout.handoff-error",{name:error?.name||"Error"},{flush:true});
        if(layoutOwner===owner)layoutOwner=null;
      }finally{handoff=false;}
      if(layoutOwner)return;
    }else stopSampling();
    // Only after explicit owner completion (or partial init without one).
    // A microtask retains same-stack independent producers; their later
    // listener checkpoints are not part of the Layout completion contract.
    if(!disposeQueued){disposeQueued=true;void Promise.resolve().then(dispose);}
  }
  function windowEvent(event){
    const own=target=>target===win||target===doc;
    return own(event?.target)&&(!event.originalTarget||own(event.originalTarget));
  }
  const api={version:VERSION,fileName,dump,flush,dispose,requestDispose,claimLayout,mark:label=>{if(typeof label!=="string"||!MARK_LABEL.test(label))return false;record("user.mark",{label},{sample:2500,flush:true});return true;}};
  win.__nocturneDiagnostics=api;win.__nocturneTrace=record;
  const earlyBoot=win.__nocturneEarlyBoot;
  try{
    // If later Layout fragments fail, this registration still owns boot.
    win.addUnloadListener(()=>{try{earlyBoot?.cleanup?.();}finally{requestDispose();}});
    observer=new win.MutationObserver(records=>{
      if(dead||quiescing||!enabled())return;
      const changes=[];for(const r of records){const key=r.target===root?"root":[...nodes].find(x=>x[1]===r.target)?.[0];if(key){const value=r.target.getAttribute(r.attributeName),cache=changedAttrs.get(r.target)||new Map();if(cache.has(r.attributeName)&&cache.get(r.attributeName)===value)continue;cache.set(r.attributeName,value);changedAttrs.set(r.target,cache);changes.push({node:key,attr:r.attributeName,value});}}
      if(changes.length)record("chrome.attributes",()=>changes);
    });
    observer.observe(root,{attributes:true,attributeFilter:rootAttrs});
    for(const type of ["OnePlane:StartupState","ZenRefined:WorkspaceTransition","ZenWorkspaceDataChanged","ZenCompactMode:Toggled","ZenCompactMode:LayoutUpdate","OnePlane:DownloadHostChanged","ZenViewSplitter:SplitViewActivated","ZenViewSplitter:SplitViewDeactivated","sizemodechange","resize","activate","deactivate","beforecustomization","aftercustomization"]){
      listen(win,type,()=>{if(!enabled())return;bindNative();observeTargets();record("event."+type,()=>({phase:attrState(root,rootAttrs),size:[win.innerWidth,win.innerHeight]}),{sample:2000,throttle:70});});
    }
    for(const type of ["beforeunload","pagehide","unload"])listen(win,type,event=>{
      if(!windowEvent(event))return;
      record("window."+type,()=>({phase:attrState(root,rootAttrs),closed:win.closed}),{flush:true});
      if(type==="unload")requestDispose(true);
    });
    bindNative();observeTargets();
    record("diagnostics.ready",()=>({version:VERSION,writer:writerMode,paintCount:win.windowUtils?.paintCount,delayed:!!win.gBrowserInit?.delayedStartupFinished,size:[win.innerWidth,win.innerHeight],private:privateWindow()}),{sample:6000,flush:true});
    const early=win.__nocturneEarlyTrace||[];delete win.__nocturneEarlyTrace;
    for(const item of early)record(item.event,()=>({earlyAt:item.t,...item.data}),{sample:2000});
  }catch(error){record("diagnostics.setup-error",{name:error?.name});dispose();}
})();
/* A pure diagnostic boundary for browser/extension exception names.
 * Native exception objects can embed URLs, file paths, titles and queries. */
const NOCTURNE_EXCEPTION_CLASSES=new Set([
  "Error","TypeError","RangeError","ReferenceError","SyntaxError","URIError","EvalError","AggregateError",
  "DOMException","AbortError","NotAllowedError","InvalidStateError","NotFoundError","NotSupportedError",
  "SecurityError","DataCloneError","NetworkError","TimeoutError","QuotaExceededError","WorkspaceCommandError",
  "NS_ERROR_FAILURE","NS_ERROR_ABORT","NS_ERROR_NOT_AVAILABLE","NS_ERROR_UNEXPECTED","NS_ERROR_NOT_INITIALIZED",
  "NS_ERROR_FILE_NOT_FOUND","NS_ERROR_XPC_BAD_CONVERT_JS"
]);
function nocturneErrorClass(error){
  try{
    const name=error?.name;
    return typeof name==="string"&&NOCTURNE_EXCEPTION_CLASSES.has(name)?name:"Error";
  }catch{return "Error";}
}
// Existing Magnetic Fold math; shared by Center Motion and the comparison Lab.
// Preserve the original sampled curve and portal clipping exactly.
function createMagneticFoldMath(){
  // Magnetic Fold, ported from Motion Lab B. p=0 docked, p=1 resting.
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const smooth=p=>{p=clamp(p);return p*p*(3-2*p);};
  function rawMagnetState(c,p){
    const q=1-p,d=Math.abs(c.x-c.cx),unit=c.unit,lower=c.lower;
    if(lower&&d<12*unit){
      const f=1-smooth(q/.12);
      return {x:(c.cx-c.x)*(1-f),y:(c.cy-c.y)*(1-f),s:Math.max(.02,f),a:f*c.opacity};
    }
    const f=1-smooth((q-(lower?.12:0))/(lower?.88:1));
    const remaining=d*f,threshold=Math.min(d,(lower?26:65)*unit);
    const dock=smooth(remaining/Math.max(.001,threshold));
    const alpha=d<.001?f:smooth(remaining/Math.max(.001,Math.min(d,20*unit)));
    const shrink=d<.001?f:Math.min(1,remaining/Math.max(.001,Math.min(d,(lower?26:48)*unit)));
    return {x:(c.cx-c.x)*(1-f),y:lower?(c.cy-c.y)*(1-dock):0,s:clamp(f*shrink,.02,1),a:alpha*c.opacity};
  }
  // The portal has real dimensions, not just a mathematical center.
  // Fade outside its edge; a transparent Home must never reveal a card
  // traveling behind its title or icon.
  function portalGap(c,f){
    const h=c.hub;
    if(!h)return Infinity;
    const x=c.x+f.x,y=c.y+f.y,w=c.r.width*f.s/2,z=c.r.height*f.s/2;
    return Math.max(h.left-x-w,x-w-h.right,h.top-y-z,y-z-h.bottom);
  }
  function magnetState(c,p){
    const f=rawMagnetState(c,p);
    if(!c.hub)return f;
    const resting=portalGap(c,{x:0,y:0,s:1});
    // A preexisting intersection belongs to native layout, not this effect.
    if(resting<=0)return f;
    const fade=Math.min(resting,24*c.unit);
    return {...f,a:f.a*smooth(portalGap(c,f)/fade)};
  }
  function portalClip(h,rr,width,height){
    // Even-odd hole: final safety net for between-keyframe interpolation
    // and the translucent Home background. Do not clip the overflow lane.
    const extent=Math.ceil(Math.max(width,height,rr.width,rr.height)+32);
    const l=h.left-rr.left,t=h.top-rr.top,r=h.right-rr.left,b=h.bottom-rr.top;
    return 'path(evenodd, "M '+(-extent)+' '+(-extent)+' H '+extent+' V '+extent+' H '+(-extent)+' Z M '+l+' '+t+' H '+r+' V '+b+' H '+l+' Z")';
  }
  function keyframes(c,reverse=false){
    // Sample the shared continuous curve once, not during playback. Linear
    // interpolation between samples preserves the Lab timing and reversal.
    return Array.from({length:41},(_,i)=>{
      const offset=i/40,p=(reverse?40-i:i)/40,f=magnetState(c,p);
      return {offset,transform:"translate("+f.x+"px,"+f.y+"px) scale("+f.s+")",opacity:f.a};
    });
  }
  return {smooth,magnetState,keyframes,portalGap,portalClip};
}
// Reconstructed Magnetic Bloom candidate, not the lost approved HTML.
// All windows are relative to the first panel stage (reference 940ms).
// Boot is deliberately outside this visible choreography; no production
// timing or native geometry changes are implied by this comparison.
function startupBloomTimeline(scale=1){
  if(!Number.isFinite(scale)||scale<400/1050||scale>1500/1050)throw RangeError("invalid bloom scale");
  const window=(start,end,min,step)=>Object.freeze({
    start:(start-940)*scale,end:(end-940)*scale,min:min*scale,step:step*scale
  });
  return Object.freeze({
    scale, panel:window(940,1160,220,0),
    islandShape:window(1080,1450,370,0),islandLabel:window(1450,1640,190,0),
    tabs:window(1330,1940,280,42),bookmarks:window(1600,2060,220,28),
    search:window(1710,2230,520,0),pins:window(1930,2500,260,55),
    workspaces:window(2220,2690,240,45),footer:window(2480,2790,310,0),
    end:(2860-940)*scale
  });
}

// A larger collection compresses stagger, never the minimum item duration.
// Input order is already the desired visual order. Every item has one effect.
function startupBloomStagger(count,stage){
  if(!Number.isSafeInteger(count)||count<0)throw RangeError("invalid bloom count");
  const {start,end,min,step}=stage;
  if(![start,end,min,step].every(Number.isFinite)||start<0||end<=start||min<=0||step<0||min>end-start+1e-7)
    throw RangeError("invalid bloom stage");
  if(!count)return [];
  const span=end-start;
  const spread=Math.max(0,Math.min(span-min,(count-1)*step));
  const duration=span-spread;
  return Array.from({length:count},(_,i)=>({delay:start+(count>1?spread*i/(count-1):0),duration}));
}

// Visible, already-measured slots only; split groups arrive as one slot.
// Distance is from the resting Home center, not the previous moving card.
function startupBloomOrder(slots,center){
  if(!Number.isFinite(center?.x)||!Number.isFinite(center?.y))throw RangeError("invalid bloom center");
  if(!Array.isArray(slots)||slots.some(slot=>!Number.isFinite(slot?.x)||!Number.isFinite(slot?.y)))
    throw RangeError("invalid bloom slot");
  return slots.map((slot,index)=>({slot,index})).sort((a,b)=>
    Math.abs(a.slot.x-center.x)-Math.abs(b.slot.x-center.x)||
    Math.abs(a.slot.y-center.y)-Math.abs(b.slot.y-center.y)||a.index-b.index
  ).map(x=>x.slot);
}

// Individual scale about the slot center stays in [0,1]. With disjoint
// resting rectangles, every interpolated card rectangle is contained
// in its own slot. No travel through Home, no overshoot outside a slot.
function startupBloomFrames(kind="card",opacity=1){
  if(!Number.isFinite(opacity)||opacity<0||opacity>1)throw RangeError("invalid resting opacity");
  if(kind==="card")return [
    {offset:0,scale:"0.72",opacity:0,easing:"cubic-bezier(.2,.75,.25,1)"},
    {offset:.58,scale:"1",opacity,easing:"ease-in-out"},
    {offset:.78,scale:"0.96",opacity,easing:"ease-out"},
    {offset:1,scale:"1",opacity}
  ];
  if(kind==="search")return [
    {offset:0,scale:"0.86",opacity:0,easing:"cubic-bezier(.2,.75,.25,1)"},
    {offset:1,scale:"1",opacity}
  ];
  if(kind==="islandShape")return [
    {offset:0,scale:"0.45 1",opacity:0,easing:"cubic-bezier(.2,.75,.25,1)"},
    {offset:1,scale:"1 1",opacity}
  ];
  if(kind==="fade")return [{offset:0,opacity:0},{offset:1,opacity}];
  throw RangeError("unknown bloom surface");
}

/* Shared Home schedule for native slots and the comparison Lab. Labels
 * never multiply their children's alpha; the empty Pins state is a fade. */
function startupBloomHomeSchedule(plan,pinCount,workspaceCount){
  const stage=w=>({delay:w.start,duration:w.end-w.start});
  return {
    search:stage(plan.search),pinLabel:stage(plan.pins),
    pins:startupBloomStagger(pinCount,plan.pins),
    workspaceLabel:stage(plan.workspaces),
    workspaces:startupBloomStagger(workspaceCount,plan.workspaces),
    footer:stage(plan.footer)
  };
}

// The common Assembly epoch is the first visible panel frame, after any
// Boot exit. Boot remains outside the visible clock and is charged as
// pre-resume overhead against the same inherited absolute watchdog.
function startupBloomAssemblyPlan(start,scale){
  const bloom=startupBloomTimeline(scale);
  if(!Number.isFinite(start))throw RangeError("invalid bloom epoch");
  const base=w=>w.start/scale,length=w=>(w.end-w.start)/scale;
  return {
    start,scale,mode:"bloom",bloom,panel:base(bloom.panel),panelLength:length(bloom.panel),
    cards:base(bloom.tabs),cardsLength:length(bloom.tabs),bookmarks:base(bloom.bookmarks),
    home:base(bloom.search),homeLength:length(bloom.search),end:bloom.end/scale,
    finishLength:bloom.end,lateLimit:bloom.end+420
  };
}
/* Nocturne Center Motion — shared deterministic card choreography.
 * One geometry snapshot, inert chrome copies, no per-frame trajectory JS. */
(()=>{
  const win=window,root=document.documentElement,KEY="__nocturneCenterMotion";
  if(typeof win.addUnloadListener!=="function"||root.hasAttribute("popup-window"))return;
  if(win[KEY]?.dispose?.({replacement:true})===false)return;
  const MARK="data-zr-center-card",OWNER="data-zr-center-motion",PENDING="data-zr-center-pending";
  const B="--zr-fold-bookmark-progress";
  const MODE="data-zr-center-mode",BLOOM_MARK="data-zr-center-bloom-card";
  try{win.CSS.registerProperty({name:B,syntax:"<number>",inherits:false,initialValue:"1"});}catch{}
  // Gecko user sheets may not register @property. The JS registration
  // guarantees smooth interpolation of the shared hover slot.
  try{win.CSS.registerProperty({name:"--op-hover-progress",syntax:"<number>",inherits:false,initialValue:"0"});}catch{}
  let active=null,activeBookmark=null,pendingTimer=0,dead=false,motionBusy=false,disposing=false,disposed=false,pendingDispose=null,bookmarkSequence=0,tabSequence=0;
  const current=()=>win[KEY]===api;
  function trace(event,data,options){try{win.__nocturneTrace?.(event,data,options);}catch{}}
  function retire(){if(disposed&&!disposing&&!active&&!activeBookmark&&current())delete win[KEY];}
  function drainDispose(){if(!motionBusy&&!disposing&&pendingDispose){const options=pendingDispose;pendingDispose=null;dispose(options);}}
  const {smooth,keyframes,portalClip}=createMagneticFoldMath();
  const GEOMETRY_EPS=.5;
  const rectError=(a,b)=>Math.max(...["left","top","width","height"].map(k=>
    Number.isFinite(a?.[k])&&Number.isFinite(b?.[k])?Math.abs(a[k]-b[k]):Infinity));
  function translationOnly(n){
    const s=win.getComputedStyle(n);
    if(s.perspective&&s.perspective!=="none")return false;
    if(s.scale&&s.scale!=="none"&&!String(s.scale).trim().split(/\s+/).every(x=>Number(x)===1))return false;
    if(s.rotate&&s.rotate!=="none"&&!/^0(?:deg|rad|grad|turn)$/.test(s.rotate))return false;
    const t=s.transform;
    if(!t||t==="none")return true;
    const m=/^matrix\(([^)]+)\)$/.exec(t);
    if(m){const v=m[1].split(",").map(Number);return v.length===6&&v.every(Number.isFinite)&&
      v[0]===1&&v[1]===0&&v[2]===0&&v[3]===1;}
    const m3=/^matrix3d\(([^)]+)\)$/.exec(t);
    if(!m3)return false;
    const v=m3[1].split(",").map(Number);
    return v.length===16&&v.every(Number.isFinite)&&v.every((x,i)=>i===12||i===13||x===(i%5===0?1:0));
  }
  function foldFrameCurrent(row,cards){
    // Viewport lengths can only be reused as local CSS lengths in a
    // translation-only coordinate frame. Check unique ancestors once
    // at transaction boundaries, not on every ResizeObserver delivery.
    const seen=new Set();
    for(const start of [row,...cards.map(c=>c.n)])
      for(let n=start;n&&!seen.has(n);n=n.parentElement){
        seen.add(n);if(!translationOnly(n))return false;
      }
    return true;
  }
  function clipped(r,clip){
    return r.left<clip.left-GEOMETRY_EPS||r.top<clip.top-GEOMETRY_EPS||
      r.right>clip.right+GEOMETRY_EPS||r.bottom>clip.bottom+GEOMETRY_EPS;
  }
  function collect(row){
    const list=row?.querySelector(".oneplane-tab-list");
    if(!list)return [];
    const rr=row.getBoundingClientRect(),island=row.querySelector(".oneplane-title-island"),ir=island?.getBoundingClientRect();
    const hub=ir?.width>1&&ir.height>1&&win.getComputedStyle(island).visibility!=="hidden"?{left:ir.left,right:ir.right,top:ir.top,bottom:ir.bottom}:null;
    const cx=ir?.width>1?ir.left+ir.width/2:rr.left+rr.width/2;
    const candidates=[];
    for(const n of list.querySelectorAll(".oneplane-tab,.oneplane-split-group")){
      if(n.classList.contains("oneplane-tab")&&n.closest(".oneplane-split-group"))continue;
      const r=n.getBoundingClientRect(),s=win.getComputedStyle(n);
      if(r.width<2||r.height<2||s.visibility==="hidden"||s.display==="none"||!Number(s.opacity))continue;
      const lane=n.closest(".oneplane-island-lane")||n.closest("#oneplane-overflow-tabs")||list,lr=lane.getBoundingClientRect();
      const clip=lr.width>1?lr:list.getBoundingClientRect();
      if(r.right<=clip.left||r.left>=clip.right||r.bottom<=clip.top||r.top>=clip.bottom)continue;
      // A scrollport clips at its client box, not the outer border box.
      // Do not copy a partial edge card as a full card outside that clip.
      const client=lane.clientWidth>0&&lane.clientHeight>0&&lr.width>1?
        {left:lr.left+lane.clientLeft,top:lr.top+lane.clientTop,
         right:lr.left+lane.clientLeft+lane.clientWidth,bottom:lr.top+lane.clientTop+lane.clientHeight}:clip;
      if(r.right<=client.left||r.left>=client.right||r.bottom<=client.top||r.top>=client.bottom)continue;
      const portalOverlap=!!hub&&Math.min(r.right,hub.right)-Math.max(r.left,hub.left)>GEOMETRY_EPS&&
        Math.min(r.bottom,hub.bottom)-Math.max(r.top,hub.top)>GEOMETRY_EPS;
      candidates.push({n,r,opacity:Number(s.opacity),partial:clipped(r,client)||portalOverlap});
    }
    const cy=ir?.height>1?ir.top+ir.height/2:Math.min(...candidates.map(c=>c.r.top+c.r.height/2));
    const unit=Math.max(.7,Math.min(2, (Math.min(...candidates.map(c=>c.r.height))||30)/20));
    return candidates.map(c=>({...c,x:c.r.left+c.r.width/2,y:c.r.top+c.r.height/2,cx,cy,unit,hub,lower:c.r.top+c.r.height/2>cy+12*unit}));
  }
  // Only chrome mirror cards are copied. A shadow tree isolates them from
  // projection queries and lane scroll clips. No page snapshots or native
  // tabs are copied, and the proxies cannot receive focus or pointer input.
  const paintProps=["display","position","inset","top","right","bottom","left","box-sizing","width","height","min-width","max-width","min-height","max-height","flex","flex-direction","flex-wrap","align-items","align-self","justify-content","place-items","gap","padding","margin","overflow","border","border-radius","box-shadow","background","color","font","font-family","font-size","font-weight","font-style","line-height","white-space","text-overflow","text-align","object-fit","fill","stroke","stroke-width","opacity","visibility","filter","transform","translate","scale","grid-template-columns","grid-template-rows","grid-auto-flow","grid-auto-columns","grid-auto-rows","align-content","justify-items","justify-self","place-content","row-gap","column-gap"];
  const decodeSources=new WeakMap();
  function warmIcons(row){
    if(dead)return iconStats(row);
    for(const img of row?.querySelectorAll(".oneplane-tab-icon img")||[]){
      const value=img.getAttribute("src");if(!value||decodeSources.get(img)===value)continue;
      decodeSources.set(img,value);try{img.decode?.()?.catch(()=>{});}catch{}
    }
    return iconStats(row);
  }
  function iconStats(row){
    const images=[...row?.querySelectorAll(".oneplane-tab-icon img")||[]];
    let ready=0,pending=0,missing=0,failed=0,cached=0;
    for(const img of images){
      const value=img.getAttribute("src");
      if(!value)missing++;
      else if(!img.hidden&&img.complete&&img.naturalWidth>0)ready++;
      else if(img.complete&&!img.naturalWidth)failed++;
      else pending++;
      if(value?.startsWith("page-icon:"))cached++;
    }
    return {total:images.length,ready,pending,missing,failed,cached};
  }
  // Fixed local geometry prevents native button/grid defaults in the
  // shadow tree from reflowing a Split View handle or its member cards.
  function freezeBox(n,r,parent){
    Object.assign(n.style,{position:"absolute",inset:"auto",left:(r.left-parent.left)+"px",top:(r.top-parent.top)+"px",
      width:r.width+"px",height:r.height+"px",boxSizing:"border-box",margin:"0",minWidth:"0",minHeight:"0",
      maxWidth:"none",maxHeight:"none",transform:"none",translate:"none",scale:"none"});
  }
  function proxy(c,layer,rr,cleanups,stats,geometryPairs){
    const clone=c.n.cloneNode(true);
    const originals=[c.n,...c.n.querySelectorAll("*")],copies=[clone,...clone.querySelectorAll("*")];
    for(let i=0;i<copies.length;i++){
      const n=copies[i],style=win.getComputedStyle(originals[i]);
      for(const attr of [...n.attributes])if(attr.name==="id"||attr.name==="tabindex"||attr.name.startsWith("on"))n.removeAttribute(attr.name);
      for(const k of paintProps){const v=style.getPropertyValue(k);if(v)n.style.setProperty(k,v);}
      n.style.setProperty("transition","none");n.style.setProperty("animation","none");n.style.setProperty("pointer-events","none");
    }
    if(c.n.classList.contains("oneplane-split-group")){
      const handle=c.n.querySelector(".oneplane-split-handle");
      for(const child of c.n.children){
        const copy=copies[originals.indexOf(child)],r=child.getBoundingClientRect();
        if(copy){freezeBox(copy,r,c.r);geometryPairs.push({source:child,copy});}
      }
      if(handle){
        const hr=handle.getBoundingClientRect();
        for(const dot of handle.children){const copy=copies[originals.indexOf(dot)];if(copy){freezeBox(copy,dot.getBoundingClientRect(),hr);geometryPairs.push({source:dot,copy});}}
        stats.groups++;stats.handles++;
        stats.handleOffset=Math.max(stats.handleOffset,Math.abs(hr.top+hr.height/2-(c.r.top+c.r.height/2)));
      }
    }
    // Keep favicons live without allowing the real tab projection to move.
    // A local placeholder survives until an image actually decodes.
    for(let i=0;i<originals.length;i++){
      const src=originals[i],img=copies[i];
      if(!src.matches?.(".oneplane-tab-icon img"))continue;
      const fallback=document.createElementNS("http://www.w3.org/1999/xhtml","span");
      fallback.textContent="•";Object.assign(fallback.style,{position:"absolute",inset:"0",display:"grid",placeItems:"center",fontSize:"17px",opacity:".6",pointerEvents:"none"});
      const canvas=document.createElementNS("http://www.w3.org/1999/xhtml","canvas");
      canvas.width=canvas.height=32;
      Object.assign(canvas.style,{position:"absolute",inset:"0",width:"16px",height:"16px",display:"none",pointerEvents:"none"});
      img.parentNode.append(canvas,fallback);
      Object.assign(img.style,{position:"absolute",inset:"0",width:"16px",height:"16px",objectFit:"contain"});
      let current=null,wasReady=false,bitmapSource=null,alive=true;
      cleanups.push(()=>{alive=false;});
      function paint(){
        if(!alive)return;
        // Paint an already decoded chrome favicon directly. A detached
        // clone can otherwise have its own asynchronous image request.
        // No canvas readback, disk cache, content or URL telemetry.
        if(current&&bitmapSource!==current&&!src.hidden&&src.complete&&src.naturalWidth>0){
          try{
            const ctx=canvas.getContext("2d");
            if(ctx){
              const w=src.naturalWidth,h=src.naturalHeight||w,k=32/Math.max(w,h);
              ctx.clearRect(0,0,32,32);ctx.drawImage(src,(32-w*k)/2,(32-h*k)/2,w*k,h*k);
              bitmapSource=current;stats.bitmapIcons++;
            }
          }catch{stats.bitmapFailures++;}
        }
        const bitmap=!!current&&bitmapSource===current;
        const image=!!current&&img.complete&&img.naturalWidth>0;
        const ready=bitmap||image;
        canvas.style.display=bitmap?"block":"none";
        img.style.display=!bitmap&&image?"block":"none";img.style.visibility="visible";
        fallback.style.visibility=ready?"hidden":"visible";
        if(ready&&!wasReady){stats.iconLoads++;trace("center.icon.ready",()=>({owner:root.getAttribute(OWNER),ready:stats.iconLoads,total:stats.icons,bitmap}),{throttle:100});}
        wasReady=ready;
      }
      function update(){
        if(!alive)return;
        const value=src.getAttribute("src");
        if(value!==current){current=value;bitmapSource=null;wasReady=false;img.hidden=false;if(value)img.setAttribute("src",value);else img.removeAttribute("src");}
        paint();
      }
      stats.icons++;
      const observer=new win.MutationObserver(update);
      cleanups.push(()=>observer.disconnect());
      observer.observe(src,{attributes:true,attributeFilter:["src","hidden"]});
      for(const [target,type,fn] of [[src,"load",update],[src,"error",update],[img,"load",paint],[img,"error",paint]]){
        cleanups.push(()=>target.removeEventListener(type,fn));
        target.addEventListener(type,fn);
      }
      update();
    }
    const outer=document.createElementNS("http://www.w3.org/1999/xhtml","div");
    Object.assign(outer.style,{position:"absolute",left:(c.r.left-rr.left)+"px",top:(c.r.top-rr.top)+"px",width:c.r.width+"px",height:c.r.height+"px",transformOrigin:"center",willChange:"transform, opacity",pointerEvents:"none"});
    Object.assign(clone.style,{position:"relative",inset:"auto",margin:"0",width:"100%",height:"100%",minWidth:"0",maxWidth:"none",minHeight:"0",maxHeight:"none",transform:"none",translate:"none",scale:"none",opacity:"1"});
    outer.append(clone);layer.append(outer);return outer;
  }
  // A decoded image is not necessarily paintable: a captured zero-alpha
  // ancestor, hidden display or collapsed icon box can still hide it.
  // Inspect only local chrome geometry, never pixels or image addresses.
  function iconPaintState(icon,boundary){
    if(!icon||!boundary)return {visible:false,alpha:0,geometry:false};
    let alpha=1,hidden=false;
    for(let n=icon;n&&n!==boundary;n=n.parentElement){
      const s=win.getComputedStyle(n);
      alpha*=Number(s.opacity);
      if(s.display==="none"||s.visibility!=="visible")hidden=true;
    }
    const r=icon.getBoundingClientRect(),geometry=r.width>0&&r.height>0;
    return {visible:!hidden&&geometry&&alpha>0,alpha,geometry};
  }
  function releasePending(){
    const id=pendingTimer;pendingTimer=0;
    if(id)try{win.clearTimeout(id);}catch{}
    if(current())root.removeAttribute(PENDING);
  }
  let handoffFrame=0,handoffFrame2=0,handoffGeneration=0,handoffOwned=false;
  function finishHandoff(){
    handoffGeneration++;
    const a=handoffFrame,b=handoffFrame2;handoffFrame=handoffFrame2=0;
    try{if(a)win.cancelAnimationFrame(a);}catch{}
    try{if(b)win.cancelAnimationFrame(b);}catch{}
    if(handoffOwned){handoffOwned=false;if(current())root.removeAttribute("data-zr-center-handoff");}
  }
  function holdHandoff(sample=null){
    finishHandoff();if(dead||!current())return;
    const generation=handoffGeneration;
    handoffOwned=true;root.setAttribute("data-zr-center-handoff","true");
    const valid=()=>!dead&&current()&&generation===handoffGeneration;
    try{
      handoffFrame=win.requestAnimationFrame(()=>{
        if(!valid())return;handoffFrame=0;
        try{handoffFrame2=win.requestAnimationFrame(()=>{
          if(!valid())return;
          handoffFrame2=0;
          try{sample?.();}finally{if(valid())finishHandoff();}
        });}catch{if(valid())finishHandoff();}
      });
    }catch{finishHandoff();}
  }
  // Explicit, dormant candidate contract. Only the exact current paused
  // Assembly may request it; production callers still request Fold.
  function bloomEligible(row,options){
    const t=options.bloomTimeline;
    return !dead&&current()&&t&&win.__nocturneStartupTimeline===t&&!t.closed&&t.paused===true&&
      options.owner==="startup"&&(options.direction??"in")==="in"&&options.paused===true&&
      typeof t.observeEffect==="function"&&options.observeEffect===t.observeEffect&&
      root.getAttribute("data-zr-startup-phase")==="waiting"&&
      !["data-zr-closing","data-zr-workspace-phase","customizing","inDOMFullscreen","inFullscreen"].some(k=>root.hasAttribute(k))&&
      row&&document.getElementById("oneplane-tabs")===row&&!row.hasAttribute("data-op-dragging")&&
      !win.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function start(row,options={}){
    if(dead||motionBusy||disposing||!current())return null;
    motionBusy=true;
    try{
      if(options.bloomTimeline===undefined)return acquireTabs(row,options);
      if(!bloomEligible(row,options))return null;
      const t=options.bloomTimeline,attempt={safe:false};
      let plan=null;
      try{plan=startupBloomTimeline(t.scale);}catch{}
      const budget=Number.isFinite(t.finishLength)&&Number.isFinite(t.lateLimit)&&
        t.finishLength>0&&t.lateLimit>=t.finishLength;
      if(!plan||!budget)return null;
      if(t.finishLength>=plan.end){
        const handle=acquireTabs(row,options,plan.tabs,attempt);
        if(handle)return handle;
        if(!attempt.safe)return null;
      }
      // A failed candidate is fully retired before Fold can collect its
      // resting cards. Never fall back into an expired or foreign Assembly.
      const duration=options.duration??520,delay=options.delay??0;
      if(!bloomEligible(row,options)||root.hasAttribute(MODE)||![duration,delay].every(Number.isFinite)||
        duration<=0||delay<0||duration+delay>t.finishLength)return null;
      trace("center.bloom.fallback",{reason:t.finishLength>=plan.end?"preflight":"budget"},{flush:true});
      return acquireTabs(row,options);
    }catch(error){trace("center.motion.error",{stage:"prepare",name:nocturneErrorClass(error)},{flush:true});return null;}finally{motionBusy=false;drainDispose();}
  }
  function invalidateTopology(row){
    const handle=active;
    if(!handle||handle.row!==row||handle.owner==="close"||handle.validateNativeTopology())return false;
    return handle.invalidateTopology();
  }
  function invalidateGeometry(row,stage){
    const handle=active;
    if(!handle||handle.row!==row||handle.owner==="close"||handle.validateGeometry(stage))return false;
    return handle.invalidateTopology("geometry");
  }
  function acquireTabs(row,{owner,direction="in",duration=520,delay=0,paused=false,retainOnDispose=null,observeEffect=null,bloomTimeline=null,onTopologyInvalidated=null}={},bloomStage=null,attempt=null){
    const explicitOptions={owner,direction,paused,observeEffect,bloomTimeline};
    const eligible=()=>!bloomTimeline||bloomEligible(row,explicitOptions);
    if(!eligible())return null;
    stopSelection();active?.release("superseded");finishHandoff();releasePending();
    if(dead||!current()||!eligible())return null;
    if(!row){trace("center.motion.skip",{owner,reason:"no-row"});return null;}
    const layout=win.__oneplaneLayoutController;
    const topology=typeof layout?.captureCenterTopology==="function"?layout.captureCenterTopology(row):undefined;
    if(topology===null){trace("center.topology.reject",{owner,stage:"capture"},{flush:true});return null;}
    const id=++tabSequence,effects=[],saved=[],cleanups=[],running=[],stats={groups:0,handles:0,handleOffset:0,icons:0,iconLoads:0,bitmapIcons:0,bitmapFailures:0};
    let host=null,cards=[],rr,hub,measuring=false,measuringMark=null,ownerMark=null,ownerWritten=false,modeMark=null,modeWritten=false,committed=false,released=false,epochStarted=false;
    const exact=()=>!released&&!dead&&current()&&active===handle&&
      (!bloomTimeline||win.__nocturneStartupTimeline===bloomTimeline);
    let topologyInvalid=false,geometryInvalid=false,invalidating=false,geometry;
    const geometryCurrent=(stage="checkpoint")=>{
      if(geometryInvalid)return false;
      let valid=false;
      try{valid=(bloomStage||stage!=="checkpoint"||foldFrameCurrent(row,cards))&&(geometry===undefined||
        win.__oneplaneLayoutController===layout&&geometry()===true);}catch{}
      if(!valid){geometryInvalid=true;trace("center.geometry.invalidate",{id,owner,mode:handle.mode,stage,count:cards.length},{flush:true});}
      return valid;
    };
    const topologyCurrent=()=>{
      if(topologyInvalid)return false;
      if(topology===undefined)return true; // older Layout owner
      try{return win.__oneplaneLayoutController===layout&&topology()===true;}catch{return false;}
    };
    function terminalCurrent(){
      if(bloomStage||direction!=="in"||!running.length||!running.every(a=>a.playState==="finished"))return true;
      let error=0;
      try{
        for(const {n,c} of effects){
          const style=win.getComputedStyle(n),alpha=Number(style.opacity);
          if(!Number.isFinite(alpha)||Math.abs(alpha-c.opacity)>.005){error=Infinity;break;}
          error=Math.max(error,rectError(n.getBoundingClientRect(),c.n.getBoundingClientRect()));
        }
      }catch{error=Infinity;}
      if(error<=GEOMETRY_EPS)return true;
      geometryInvalid=true;
      trace("center.fold.terminal",{id,owner,count:effects.length,maxError:Number.isFinite(error)?error:null,valid:false},{flush:true});
      return false;
    }
    function sampleRestingHandoff(){
      // The existing second RAF runs after the caller removes its phase
      // markers and Layout has had a frame to reconcile. Diagnostic only:
      // never freeze or change the authoritative layout to fit a proxy.
      trace("center.fold.handoff",()=>{
        const phase=["data-zr-startup-phase","data-zr-workspace-phase","data-zr-closing",
          OWNER,"customizing"].some(k=>root.hasAttribute(k))||
          root.getAttribute("inDOMFullscreen")==="true"||root.getAttribute("inFullscreen")==="true";
        if(phase||document.getElementById("oneplane-tabs")!==row||!row.isConnected||
          layout&&win.__oneplaneLayoutController!==layout)
          return {id,owner,count:cards.length,status:"not-comparable"};
        const after=row.getBoundingClientRect();
        if(!(after.width>0&&after.height>0))return {id,owner,count:cards.length,status:"not-comparable"};
        let error=0;
        for(const c of cards){
          if(!c.n.isConnected||!row.contains(c.n))return {id,owner,count:cards.length,status:"membership-changed"};
          const r=c.n.getBoundingClientRect();
          error=Math.max(error,rectError({left:r.left-after.left,top:r.top-after.top,width:r.width,height:r.height},
            {left:c.r.left-rr.left,top:c.r.top-rr.top,width:c.r.width,height:c.r.height}));
        }
        const rowShift=Math.hypot(after.left-rr.left,after.top-rr.top);
        return {id,owner,count:cards.length,status:error<=GEOMETRY_EPS?"local-stable":"geometry-changed",
          maxError:Number.isFinite(error)?error:null,rowShift:Number.isFinite(rowShift)?rowShift:null};
      });
    }
    const projectionCurrent=()=>topologyCurrent()&&geometryCurrent()&&terminalCurrent();
    const preparing=()=>exact()&&eligible()&&!topologyInvalid&&!geometryInvalid;
    const restoreMark=(node,key,value)=>{if(value===null)node.removeAttribute(key);else node.setAttribute(key,value);};
    const handle={owner,row,retainOnDispose,startupOutcomeVersion:1,mode:bloomStage?"magnetic-bloom":"magnetic-fold",count:0,finished:Promise.resolve(),
      // Historical boundary API also checks geometry. Icon-only sync
      // validates native identity without forcing layout reads.
      validateTopology(){return !released&&projectionCurrent();},
      validateNativeTopology(){return !released&&topologyCurrent();},
      validateGeometry(stage){return !released&&geometryCurrent(stage);},
      invalidateTopology(reason="topology"){
        if(released||invalidating||active!==handle||!current())return false;
        const first=!topologyInvalid;
        topologyInvalid=true;
        const wasBusy=motionBusy;motionBusy=true;invalidating=true;
        try{
          if(first&&reason==="topology")trace("center.topology.invalidate",{id,owner,mode:handle.mode,count:cards.length},{flush:true});
          // Setup invalidation is sticky; the acquisition will roll back.
          // A busy sibling surface may defer notification until the next
          // checkpoint. Never call the owner twice under nested callbacks.
          if(!committed||wasBusy)return true;
          try{if(exact())onTopologyInvalidated?.();}catch(error){trace("center.topology.error",{owner,name:nocturneErrorClass(error)},{flush:true});}
          finally{if(!released)handle.release(reason==="geometry"?"geometry-changed":"topology-changed");}
          return true;
        }finally{invalidating=false;motionBusy=wasBusy;drainDispose();}
      },
      resume(){if(bloomTimeline)throw Error("center-bloom-requires-epoch");if(!released)for(const a of running)try{a.play();}catch{}},
      resumeAt(start){
        const ready=()=>exact()&&(!bloomTimeline||!bloomTimeline.closed&&bloomTimeline.paused===false);
        if(!ready()||!projectionCurrent()||bloomTimeline&&epochStarted)throw Error("center-epoch-stale");
        if(bloomTimeline)epochStarted=true;
        for(const a of running){
          if(!ready())throw Error("center-epoch-stale");
          start(a);
          if(!ready())throw Error("center-epoch-stale");
        }
        if(!projectionCurrent())throw Error("center-epoch-stale");
      },
      seal(){if(!released)for(const a of running)try{a.finish();}catch{}},
      release(reason="release"){
        if(released)return;
        released=true;
        // Claim both the handle and engine before validation/trace can
        // reenter start/dispose. No successor may acquire our live marks.
        const wasBusy=motionBusy;motionBusy=true;
        let failed=0,reconcile=false;const step=fn=>{try{fn();}catch{failed++;}};
        try{
          if(committed&&owner!=="close"){
            reconcile=true;
            step(()=>{reconcile=!projectionCurrent();});
          }
          if(committed&&!dead&&current()){
            step(()=>{
              const sample=!reconcile&&!bloomStage&&direction==="in"&&running.length&&
                running.every(a=>a.playState==="finished")?sampleRestingHandoff:null;
              holdHandoff(sample);
            });
          }
          for(const a of running){
            // A failed seek may replace the promise that was observed at
            // acquisition. Retire the current one too, before cancelling.
            if(bloomTimeline)step(()=>a.finished.catch(()=>{}));
            step(()=>a.cancel());
          }
          for(const off of cleanups)step(off);
          if(host)step(()=>host.remove());
          for(const {n,mark,key=MARK} of saved)step(()=>restoreMark(n,key,mark));
          if(active===handle){
            active=null;
            if(current()){
              if(measuring)step(()=>restoreMark(root,"data-zr-fold-measuring",measuringMark));
              if(ownerWritten)step(()=>restoreMark(root,OWNER,ownerMark));
              if(modeWritten)step(()=>restoreMark(root,MODE,modeMark));
              if(ownerWritten&&!dead&&!win.closed)step(()=>win.dispatchEvent(new win.CustomEvent("Nocturne:CenterMotionEnd",{detail:{owner,reconcile}})));
            }
          }
          retire();
          if(attempt)attempt.safe=failed===0&&attempt.allowFallback!==false;
          trace("center.motion.release",()=>({id,owner,direction,mode:handle.mode,count:cards.length,...stats,sourceIcons:iconStats(row),failed,reason}),{sample:600,flush:failed>0});
        }finally{motionBusy=wasBusy;drainDispose();}
      }};
    active=handle;
    try{
      if(root.getAttribute("data-zr-workspace-phase")==="swap"){
        measuringMark=root.getAttribute("data-zr-fold-measuring");measuring=true;root.setAttribute("data-zr-fold-measuring","true");
      }
      if(!topologyCurrent())throw Error("center-topology-stale");
      cards=collect(row);handle.count=cards.length;
      if(!cards.length){handle.release("no-visible-cards");trace("center.motion.skip",{owner,reason:"no-visible-cards"});return null;}
      if(typeof layout?.captureCenterGeometry==="function"){
        geometry=layout.captureCenterGeometry(row,bloomStage?"bloom":"fold");
        if(typeof geometry!=="function"){geometryInvalid=true;trace("center.geometry.reject",{owner,stage:"capture"},{flush:true});throw Error("center-geometry-capture");}
      }
      if(!bloomStage){
        const partial=cards.filter(c=>c.partial).length;
        if(partial||!foldFrameCurrent(row,cards)){
          trace("center.fold.reject",{id,owner,reason:partial?"partial-clip":"coordinate-frame",count:cards.length,partial},{flush:true});
          throw Error("fold-resting-admission");
        }
      }
      if(bloomStage){
        const check=()=>{if(!preparing())throw Error("bloom-stale");};
        check();
        // Bound the one-time pairwise geometry check; no per-frame layout.
        if(cards.length>256||root.hasAttribute(MODE)||cards.some(c=>c.n.hasAttribute(BLOOM_MARK)))throw Error("bloom-slot-admission");
        for(let i=0;i<cards.length;i++)for(let j=0;j<i;j++){
          const a=cards[i].r,b=cards[j].r;
          if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>.5&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.5)
            throw Error("bloom-slot-overlap");
        }
        const ordered=startupBloomOrder(cards,{x:cards[0].cx,y:cards[0].cy});
        const timing=startupBloomStagger(ordered.length,bloomStage);
        // Existing ownership/freeze marker; distinct visual mode.
        modeMark=root.getAttribute(MODE);modeWritten=true;root.setAttribute(MODE,"bloom");
        ownerMark=root.getAttribute(OWNER);ownerWritten=true;root.setAttribute(OWNER,owner);
        for(const c of ordered){saved.push({n:c.n,key:BLOOM_MARK,mark:c.n.getAttribute(BLOOM_MARK)});c.n.setAttribute(BLOOM_MARK,"true");}
        const near=(a,b,epsilon)=>Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=epsilon;
        function sample(c,scale,opacity){
          const s=win.getComputedStyle(c.n),r=c.n.getBoundingClientRect();
          const scales=s.scale==="none"?[1]:String(s.scale).trim().split(/\s+/).map(Number);
          if(!scales.length||scales.length>2||scales.some(v=>!near(v,scale,.005))||
            !near(Number(s.opacity),opacity,.005)||s.visibility!=="visible"||s.display==="none"||
            !near(r.width,c.r.width*scale,.75)||!near(r.height,c.r.height*scale,.75)||
            !near(r.left+r.width/2,c.x,.75)||!near(r.top+r.height/2,c.y,.75))
            throw Error("bloom-computed-conflict");
        }
        for(const c of ordered){
          if(c.n.getAnimations().length){
            // A competing animation may also corrupt the Fold snapshot.
            // Fail open instead of cloning an actively animated card.
            attempt.allowFallback=false;throw Error("bloom-competing-effect");
          }
          sample(c,1,c.opacity);
        }
        const promises=[];
        for(let i=0;i<ordered.length;i++){
          check();const c=ordered[i],t=timing[i],frames=startupBloomFrames("card",c.opacity);
          const a=c.n.animate(frames,{...t,easing:"linear",fill:"both"});
          running.push(a);const promise=a.finished;promises.push(promise);promise.catch(()=>{});
          observeEffect?.(a,"tabs",exact);
          a.pause();a.currentTime=0;check();
          if(a.playState!=="paused"||a.pending||a.timeline!==document.timeline||a.playbackRate!==1||a.finished!==promise)
            throw Error("bloom-effect-not-paused");
        }
        // Sample exact interior keyframes, well away from the terminal
        // boundary. The final pose is the resting pose checked above.
        // Seeking after pause must not replace the observed finished promise.
        for(const [fraction,scale] of [[0,.72],[.58,1],[.78,.96],[0,.72]]){
          check();
          running.forEach((a,i)=>{a.currentTime=fraction===0?0:timing[i].delay+timing[i].duration*fraction;});
          ordered.forEach(c=>sample(c,scale,fraction===0?0:c.opacity));
          if(running.some((a,i)=>a.playState!=="paused"||a.pending||a.finished!==promises[i]))
            throw Error("bloom-effect-seek-state");
        }
        check();if(!projectionCurrent())throw Error("center-projection-stale");
        handle.finished=Promise.all(promises.map(p=>p.catch(()=>{})));
        committed=true;
        trace("center.bloom.acquire",()=>({id,owner,count:cards.length,effects:running.length,proxies:0,checks:4,stageEnd:bloomStage.end}),{sample:Math.ceil(bloomStage.end)+250});
        check();if(!projectionCurrent())throw Error("center-projection-stale");return handle;
      }
      rr=row.getBoundingClientRect();host=document.createElementNS("http://www.w3.org/1999/xhtml","div");
      host.setAttribute("data-zr-magnetic-layer","true");host.setAttribute("aria-hidden","true");host.inert=true;
      Object.assign(host.style,{position:"absolute",inset:"0",zIndex:"14",pointerEvents:"none",overflow:"visible"});
      hub=cards[0].hub;
      const layer=host.attachShadow({mode:"closed"});
      // Own every resource before acquisition; never hide cards until all
      // detached proxies have been prepared.
      const geometryPairs=[];
      for(const c of cards){const n=proxy(c,layer,rr,cleanups,stats,geometryPairs),frames=keyframes(c,direction==="out");effects.push({n,frames,c});}
      if(measuring){restoreMark(root,"data-zr-fold-measuring",measuringMark);measuring=false;}
      if(!preparing()||!projectionCurrent()){handle.release("disposed");return null;}
      ownerMark=root.getAttribute(OWNER);ownerWritten=true;root.setAttribute(OWNER,owner);
      row.append(host);
      for(const c of cards){saved.push({n:c.n,mark:c.n.getAttribute(MARK)});c.n.setAttribute(MARK,"true");}
      // The absolute containing block can start at a different origin
      // than the row border box. Correct using the actual mounted host,
      // then verify every unanimated outer rect before creating effects.
      const origin=host.getBoundingClientRect();
      if(![origin.left,origin.top,origin.width,origin.height].every(Number.isFinite)||origin.width<=0||origin.height<=0)
        throw Error("fold-host-geometry");
      for(const {n,c} of effects){
        n.style.left=(c.r.left-origin.left)+"px";
        n.style.top=(c.r.top-origin.top)+"px";
      }
      if(hub)host.style.clipPath=portalClip(hub,origin,win.innerWidth,win.innerHeight);
      let maxError=0;
      for(const {n,c} of effects)maxError=Math.max(maxError,rectError(n.getBoundingClientRect(),c.r),
        rectError(c.n.getBoundingClientRect(),c.r));
      for(const {source,copy} of geometryPairs)maxError=Math.max(maxError,rectError(copy.getBoundingClientRect(),source.getBoundingClientRect()));
      trace("center.fold.geometry",{id,owner,count:effects.length,splitParts:geometryPairs.length,maxError:Number.isFinite(maxError)?maxError:null,
        valid:maxError<=GEOMETRY_EPS},{flush:maxError>GEOMETRY_EPS});
      if(maxError>GEOMETRY_EPS)throw Error("fold-proxy-geometry");
    // Inspect the mounted proxy in its unanimated coordinate space once.
    // No titles, image URLs, or DOM identifiers are logged.
    let handleError=0,measuredHandles=0;
    for(const {n,c} of effects){
      const source=c.n.querySelector(".oneplane-split-handle"),copy=n.querySelector(".oneplane-split-handle");
      if(!source||!copy)continue;
      const a=source.getBoundingClientRect(),b=copy.getBoundingClientRect(),o=n.getBoundingClientRect();
      handleError=Math.max(handleError,Math.abs((a.left-c.r.left)-(b.left-o.left)),Math.abs((a.top-c.r.top)-(b.top-o.top)));
      measuredHandles++;
    }
    if(measuredHandles)trace("center.group.geometry",()=>({owner,count:measuredHandles,maxOffsetError:handleError}),{sample:800,flush:handleError>GEOMETRY_EPS});
    if(handleError>GEOMETRY_EPS)throw Error("fold-split-handle-geometry");
    // Inspect the actual mounted shadow copies before WAAPI changes
    // their outer alpha and scale. Ignore the intentional real-card gate.
    trace("center.icon.paint",()=>{
      let total=0,paintable=0,zeroAlpha=0,zeroGeometry=0,sourceButtonZero=0,minAlpha=1;
      for(const {n,c} of effects){
        for(const b of c.n.querySelectorAll(".oneplane-tab-select"))
          if(Number(win.getComputedStyle(b).opacity)===0)sourceButtonZero++;
        for(const icon of n.querySelectorAll(".oneplane-tab-icon")){
          const image=[...icon.children].find(x=>["canvas","img"].includes(x.localName)&&win.getComputedStyle(x).display!=="none");
          const state=iconPaintState(image||icon,n);
          total++;if(state.visible&&image)paintable++;
          if(state.alpha===0)zeroAlpha++;if(!state.geometry)zeroGeometry++;
          minAlpha=Math.min(minAlpha,state.alpha);
        }
      }
      return {owner,total,paintable,zeroAlpha,zeroGeometry,sourceButtonZero,minAlpha};
    },{sample:800});
      for(const {n,frames} of effects){
        if(!preparing()){handle.release("disposed");return null;}
        n.style.transform=frames[0].transform;n.style.opacity=String(frames[0].opacity);
        const a=n.animate(frames,{duration,delay,easing:"linear",fill:"both"});
        // Install cancellation handling immediately, even when pause or
        // currentTime subsequently throws. Fail open as one surface.
        running.push(a);a.finished.catch(()=>{});
        if(owner==="startup")observeEffect?.(a,"tabs",exact);
        if(paused){a.pause();a.currentTime=0;}
      }
      handle.finished=Promise.all(running.map(a=>a.finished.catch(()=>{})));
      if(!preparing()||!projectionCurrent()){handle.release("disposed");return null;}
      committed=true;
      trace("center.motion",()=>({id,owner,direction,count:cards.length,duration,mode:"magnetic-fold",portal:hub?[hub.right-hub.left,hub.bottom-hub.top]:null,center:[cards[0].cx,cards[0].cy],lower:cards.filter(c=>c.lower).length,groups:stats.groups,handles:stats.handles,handleOffset:stats.handleOffset,icons:iconStats(row),bitmapIcons:stats.bitmapIcons,bitmapFailures:stats.bitmapFailures,animated:running.length}),{sample:duration+250});
      if(!preparing()||!projectionCurrent()){handle.release("disposed");return null;}
      return handle;
    }catch(error){
      handle.release("setup-failed");
      trace("center.motion.error",{id,owner,mode:handle.mode,stage:"setup",name:nocturneErrorClass(error)},{flush:true});return null;
    }
  }
  // Bookmarks use the Lab's center squeeze, not individual vertical slides.
  function bookmarks(options={}){
    if(dead||motionBusy||disposing||!current())return null;
    motionBusy=true;
    try{return acquireBookmark(options);}catch(error){trace("center.bookmarks.error",{stage:"prepare",name:nocturneErrorClass(error)},{flush:true});return null;}finally{motionBusy=false;drainDispose();}
  }
  function acquireBookmark({owner="unknown",direction="in",duration=520,delay=0,paused=false,retainOnDispose=null,observeEffect=null}={}){
    activeBookmark?.release("superseded");
    if(dead||!current())return null;
    const n=document.getElementById("PlacesToolbarItems"),markKey="data-zr-fold-bookmarks";
    if(!n||!n.getBoundingClientRect().width)return null;
    const id=++bookmarkSequence,frames=Array.from({length:21},(_,i)=>{const p=smooth(direction==="out"?1-i/20:i/20);return {offset:i/20,[B]:String(p)};});
    const old=n.style.getPropertyValue(B),priority=n.style.getPropertyPriority(B),mark=n.getAttribute(markKey);
    let a=null,released=false;
    const handle={owner,retainOnDispose,startupOutcomeVersion:1,finished:Promise.resolve(),
      resume(){if(!released)try{a?.play();}catch{}},
      resumeAt(start){
        if(released||dead||!current()||activeBookmark!==handle||!a)throw Error("bookmark-epoch-stale");
        start(a);
      },
      seal(){if(!released)try{a?.finish();}catch{}},
      release(reason="release"){
        if(released)return;released=true;
        const wasBusy=motionBusy;motionBusy=true;
        let failed=0;const step=fn=>{try{fn();}catch{failed++;}};
        try{
          step(()=>a?.cancel());
          if(activeBookmark===handle){
            activeBookmark=null;
            if(current()){
              step(()=>{if(old)n.style.setProperty(B,old,priority);else n.style.removeProperty(B);});
              step(()=>{if(mark===null)n.removeAttribute(markKey);else n.setAttribute(markKey,mark);});
              step(()=>win.__zenMagneticBookmarksShared?.syncAddressState?.());
            }
          }
          retire();trace("center.bookmarks.release",{id,owner,reason,failed},{flush:failed>0});
        }finally{motionBusy=wasBusy;drainDispose();}
      }};
    activeBookmark=handle;
    try{
      n.style.setProperty(B,frames[0][B]);n.setAttribute(markKey,"true");
      win.__zenMagneticBookmarksShared?.syncAddressState?.();
      if(dead||!current()){handle.release("disposed");return null;}
      a=n.animate(frames,{duration,delay,easing:"linear",fill:"both"});
      handle.finished=a.finished.catch(()=>{});
      if(owner==="startup")observeEffect?.(a,"bookmarks",()=>!released&&!dead&&current()&&activeBookmark===handle);
      if(paused){a.pause();a.currentTime=0;}
      trace("center.bookmarks.acquire",{id,owner,direction,duration},{sample:duration+250});
      if(dead||released||!current()){handle.release("disposed");return null;}
      return handle;
    }catch(error){handle.release("setup-failed");trace("center.bookmarks.error",{id,owner,name:nocturneErrorClass(error)},{flush:true});return null;}
  }
  function dispose({replacement=false}={}){
    if(disposing)return false;
    if(motionBusy){
      dead=true;pendingDispose={replacement:replacement||pendingDispose?.replacement===true};
      return false;
    }
    if(!current()||disposed&&!replacement)return true;
    dead=true;disposed=true;disposing=true;
    let failed=0;
    const step=fn=>{try{fn();}catch{failed++;}};
    try{
      step(releasePending);step(stopSelection);
      step(()=>selectionContainer?.removeEventListener("TabSelect",onSelect));selectionContainer=null;
      step(()=>win.removeEventListener("OnePlane:StartupState",bindSelection));
      // Preserve the existing close-seal contract, but only for exact
      // close-owned handles. Replacement always reclaims retained handles.
      const closing=!replacement&&root.hasAttribute("data-zr-closing");
      const retain=handle=>{
        if(!closing||handle?.owner!=="close")return false;
        try{return handle.retainOnDispose?.()===true;}catch{return false;}
      };
      const delegated=retain(active),bookmarkDelegated=retain(activeBookmark);
      if(!delegated)step(()=>active?.release());
      if(!bookmarkDelegated)step(()=>activeBookmark?.release("dispose"));
      step(finishHandoff);
      trace("center.dispose",{failed,delegated,bookmarkDelegated,replacement},{flush:true});
    }finally{disposing=false;retire();drainDispose();}
    return true;
  }
  // Ordinary selection uses the same ownership boundary but never delays
  // native TabSelect. Animate the chrome deck, not remote page DOM.
  let selection=null,selectionContainer=null,lastTab=null;
  function stopSelection(){if(selection){try{selection.cancel();}catch{}selection=null;}}
  function onSelect(){
    if(dead)return;
    const browser=win.gBrowser,next=browser?.selectedTab,previous=lastTab;lastTab=next;
    stopSelection();
    if(!next||!previous||next===previous||active||root.hasAttribute(PENDING)||
       ["data-zr-startup-phase","data-zr-workspace-phase","data-zr-closing","customizing","inDOMFullscreen","inFullscreen"].some(k=>root.hasAttribute(k))||
       win.matchMedia("(prefers-reduced-motion: reduce)").matches||Services.prefs.getIntPref("zen.oneplane.animation-duration",160)===0||
       next.hasAttribute("zen-empty-tab")||next.hasAttribute("split-view")||previous.hasAttribute("split-view"))return;
    const deck=document.getElementById("tabbrowser-tabpanels");
    if(!deck||deck.hasAttribute("data-zr-home-covered")||deck.querySelector(".browserSidebarContainer[zen-split='true']"))return;
    const tabs=Array.from(browser.visibleTabs||browser.tabs||[]),from=tabs.indexOf(previous),to=tabs.indexOf(next);
    if(from<0||to<0||from===to)return;
    // Lab B: preserve opaque, stationary content. Native card indicator owns selection.
    win.__nocturneTrace?.("selection.native",{direction:to>from?1:-1});
  }
  function bindSelection(){
    if(dead)return;
    const tc=win.gBrowser?.tabContainer;if(!tc||tc===selectionContainer)return;
    selectionContainer?.removeEventListener("TabSelect",onSelect);
    selectionContainer=tc;lastTab=win.gBrowser.selectedTab;tc.addEventListener("TabSelect",onSelect);
  }
  const api={startupBloomVersion:1,start,bookmarks,iconStats,warmIcons,releasePending,invalidateTopology,invalidateGeometry,dispose};win[KEY]=api;
  const earlyBoot=win.__nocturneEarlyBoot,diagnostics=win.__nocturneDiagnostics;
  // This is the last Sine slot if subsequent Layout fragments fail.
  win.addUnloadListener(()=>{
    try{dispose();}finally{try{earlyBoot?.cleanup?.();}finally{diagnostics?.requestDispose?.();}}
  });
  win.addEventListener("OnePlane:StartupState",bindSelection);
  bindSelection();
  // The layout entrypoint runs before its own projection. Gate only a
  // genuinely new window, never a Sine reload. Fail open on missing Assembly.
  try{
    if(!win.__nocturneLayoutStartup&&(!win.__zenRefinedStartupAnimationSeen||win.__zenRefinedStartupAnimation)&&win.performance.now()<3500&&Services.prefs.getBoolPref("zen.refined.startup.animation",true)&&!win.matchMedia("(prefers-reduced-motion: reduce)").matches){
      win.__nocturneTrace?.("assembly.gate",{age:win.performance.now(),pending:true},{flush:true});
      root.setAttribute(PENDING,"true");
      const deadline=win.__nocturneEarlyBoot?.deadline??win.__zenRefinedStartupAnimation?.deadline??(win.performance.now()+8000);
      const id=win.setTimeout(()=>{if(dead||!current()||pendingTimer!==id)return;trace("assembly.gate.timeout",{age:win.performance.now()},{flush:true});releasePending();},Math.max(0,deadline-win.performance.now()));
      pendingTimer=id;
    }
  }catch{try{releasePending();}catch{}}
})();
/* OnePlane — local, reversible Zen layout configuration.
 * Runs only in browser.xhtml via Sine; no network or page access.
 */
// Services and SessionStore are native browser-chrome globals.

const KEY = "zen.oneplane.original-layout";
const CONTROLLER = "__oneplaneLayoutController";
const TARGET = {
  "zen.view.use-single-toolbar": false,
  "zen.tabs.vertical.right-side": false,
  "zen.view.sidebar-expanded": true,
  "zen.view.compact.hide-tabbar": false,
  "zen.view.compact.hide-toolbar": true,
};
const STARTUP = "zen.view.compact.enable-at-startup";
const root = document.documentElement;
const prefs = Services.prefs;
let disposed = false;
let applied = false;
let ownsPreferences = false;
let preferenceMutation=false,pendingCleanup=null;
let closing = false,closeTimer=0;
let startupObserver = null;
let removeTabStrip = null;

function snapshot() {
  const capture=name=>{
    if (prefs.getPrefType(name) !== prefs.PREF_BOOL)
      throw new Error("Unsupported Zen preference: " + name);
    return { value: prefs.getBoolPref(name), user: prefs.prefHasUserValue(name), owned:false };
  };
  const raw = prefs.getStringPref(KEY, "");
  if (raw) {
    const saved = JSON.parse(raw);
    if (Object.keys({...TARGET, [STARTUP]: true}).every(name =>
      typeof saved[name]?.value === "boolean" && typeof saved[name]?.user === "boolean")) {
      // A partial release may leave a complete backup. Reacquire only
      // previously released keys from their current user/default state.
      let changed=false;
      for (const name of Object.keys(TARGET)) {
        if (saved[name].released===true) { saved[name]=capture(name); changed=true; }
      }
      if (changed) prefs.setStringPref(KEY, JSON.stringify(saved));
      return saved;
    }
    throw new Error("Invalid OnePlane layout backup; refusing to overwrite it.");
  }
  const saved = {};
  for (const name of [...Object.keys(TARGET), STARTUP]) saved[name]=capture(name);
  prefs.setStringPref(KEY, JSON.stringify(saved));
  return saved;
}

function otherActiveWindow() {
  const windows = Services.wm.getEnumerator("navigator:browser");
  while (windows.hasMoreElements()) {
    const other = windows.getNext();
    if (other === window || other.closed) continue;
    const lease=other[CONTROLLER];
    // A disposing window retains its lease until local teardown finishes.
    // Older generations expose only active.
    if (lease && (lease.ownsPreferences ?? lease.active)) return true;
  }
  return false;
}

function restorePrefs() {
  const raw = prefs.getStringPref(KEY, "");
  if (!raw) return;
  const saved = JSON.parse(raw);
  // Compact Mode is a user-owned setting.
  let restored=0,skipped=0,failed=0,alreadyReleased=0,checkpointFailed=false;
  for (const name of Object.keys(TARGET)) {
    try {
      const original = saved[name];
      if (!original || typeof original.value !== "boolean" || typeof original.user !== "boolean")
        throw new Error("Invalid saved preference");
      if (original.released===true) { alreadyReleased++; continue; }
      // New snapshots distinguish a no-op acquisition from a native write.
      // Legacy backups retain their old value-based restoration contract.
      if (original.owned===false ||
          prefs.getBoolPref(name) !== TARGET[name] ||
          (original.owned===true&&!prefs.prefHasUserValue(name))) {
        skipped++; original.released=true; continue;
      }
      if (original.user) prefs.setBoolPref(name, original.value);
      else prefs.clearUserPref(name);
      restored++;
      original.released=true;
    } catch (error) {
      failed++;
      console.warn("[Nocturne] Layout preference restore:", name, nocturneErrorClass(error));
    }
  }
  // Keep original values and release progress when a native key or backup
  // removal fails. Retrying must not touch keys we already relinquished.
  if (!failed) {
    try { prefs.clearUserPref(KEY); }
    catch (error) { failed++; console.warn("[Nocturne] Layout backup release:", nocturneErrorClass(error)); }
  }
  if (failed) {
    try { prefs.setStringPref(KEY,JSON.stringify(saved)); }
    catch (error) { checkpointFailed=true; console.warn("[Nocturne] Layout backup checkpoint:",nocturneErrorClass(error)); }
  }
  try { window.__nocturneTrace?.("layout.prefs.restore",{restored,skipped,failed,alreadyReleased,checkpointFailed,backupRetained:failed>0},{flush:true}); } catch {}
  return failed===0;
}

function isLayoutWindowEvent(event){
  const own=target=>target===document||target===window;
  return own(event?.target)&&(!event.originalTarget||own(event.originalTarget));
}
function markClosing(event) {
  if(!isLayoutWindowEvent(event))return;
  closing=true;
  if(closeTimer)window.clearTimeout(closeTimer);
  closeTimer=window.setTimeout(()=>{
    closeTimer=0;closing=false;
    try{window.__nocturneTrace?.("layout.close.pending-expired",{active:!disposed},{flush:true});}catch{}
  },1000);
  try{window.__nocturneTrace?.("layout.markClosing",{closing},{flush:true});}catch{}
}
function nativeUnload(event){if(isLayoutWindowEvent(event))cleanup(true);}
function updateNativeAfterCleanup(pendingClose,nativeExit){
  if(nativeExit||window.closed||Services.startup?.shuttingDown)return;
  const update=()=>{
    if(window.closed||Services.startup?.shuttingDown||window[CONTROLLER])return;
    window.dispatchEvent(new window.CustomEvent("ZenCompactMode:LayoutUpdate"));
  };
  // Sine 2.3.3 may unload on beforeunload, even if close is cancelled.
  // This is a bounded native fallback, not a proof of cancellation or a
  // request to remount Sine scripts.
  if(pendingClose)window.setTimeout(()=>cleanupStep("native layout fallback",update),1000);
  else update();
}


/* Nocturne mod-origin native command boundary. Zen remains authoritative.
 * Window lease survives visual/entrypoint reload; data mutations additionally
 * use a process-local primitive token on the native module identity. */
const WORKSPACE_GATE="__nocturneWorkspaceCommandGate";
const WORKSPACE_DATA_GATE=Symbol.for("nocturne.workspace.data-command.v1");
function workspaceCommandError(code,message="Workspace command could not be confirmed."){
  const error=new Error(message);error.name="WorkspaceCommandError";error.code=code;return error;
}
function commandTrace(win,event,data){try{win.__nocturneTrace?.("workspace.command."+event,data,{flush:true});}catch{}}
function dataAnchor(){
  try{return ChromeUtils.importESModule("resource:///modules/BrowserWindowTracker.sys.mjs").BrowserWindowTracker;}catch{return null;}
}
function workspaceCommandGate(win){
  if(win[WORKSPACE_GATE])return win[WORKSPACE_GATE];
  // Allocate in the target chrome realm when possible. A peer reservation
  // must not turn its gate into an object owned by a closing child realm.
  const gate=typeof win.Object==="function"?new win.Object():{};
  gate.pending=null;
  return win[WORKSPACE_GATE]??(win[WORKSPACE_GATE]=gate);
}
// A reservation is a primitive on the surviving peer's existing gate;
// never retain a destroyed child Window/Promise in that peer.
const WORKSPACE_PENDING_NOTICE=5000;
function workspaceCommandNow(win){
  try{const p=win.performance,t=p?.timeOrigin+p?.now();if(Number.isFinite(t))return t;}catch{}
  return Date.now();
}
function workspacePendingState(startedAt,now,reserved=false,projection=false){
  const remaining=Number.isFinite(startedAt)?Math.max(0,Math.min(WORKSPACE_PENDING_NOTICE,WORKSPACE_PENDING_NOTICE-(now-startedAt))):0;
  return {blocked:true,phase:remaining?"pending":"unknown",remaining,reserved,projection};
}
function workspaceCommandState(win,now=workspaceCommandNow(win)){
  try{
    const gate=win[WORKSPACE_GATE],reserved=!!gate?.reservation;
    if(gate?.pending||gate?.owner||reserved){
      return workspacePendingState(gate.startedAt,now,reserved);
    }
    if(win.gZenWorkspaces?.isChangingWorkspace===true)return {blocked:true,phase:"native-busy",remaining:0,reserved:false};
    return {blocked:false,phase:"idle",remaining:0,reserved:false};
  }catch{return {blocked:true,phase:"unknown",remaining:0,reserved:false};}
}
function notifyWorkspaceCommand(win){
  try{if(!win.closed)win.dispatchEvent(new win.CustomEvent("Nocturne:WorkspaceCommandChanged"));}catch{}
}
// Native-only busy has no Nocturne lease to observe on settlement.
// Keep controls retryable; their real command preflight still fails closed.
function workspaceCommandPresentationBlocked(state){return state.blocked&&state.phase!=="native-busy";}
function workspaceCommandMessage(state){
  if(state.projection)return state.phase==="unknown"?
    "Synced window setup is still pending. You can close this panel; interact with the new window to stop automatic setup.":
    "Opening a synced window…";
  if(state.phase==="pending")return state.reserved?"Returning a synced window…":"Workspace command in progress…";
  if(state.phase==="unknown")return "Native command is still pending. You can close this panel; workspace commands remain blocked. If it never settles, restart Zen.";
  if(state.phase==="native-busy")return "Zen is changing workspace. Try again when ready.";
  return "";
}
// Presentation observes the existing gate; timeout changes the message,
// not admission or ownership. No persistent polling, no promise race.
function watchWorkspaceCommand(win,active,update,read=()=>workspaceCommandState(win)){
  let disposed=false,timer=0,generation=0,lastPhase=null,nativeDeadline=null;
  const refresh=()=>{
    const token=++generation;
    if(timer)try{win.clearTimeout(timer);}catch{}
    timer=0;if(disposed||!active()){lastPhase=null;nativeDeadline=null;return;}
    let state;
    try{state=read();}catch{commandTrace(win,"presentation-error",{});return;}
    // Zen emits UI updates before its native isChangingWorkspace flag
    // clears. Probe only within a bounded visible-view interval, not for
    // the lifetime of a native command.
    if(state.phase==="native-busy"){
      nativeDeadline??=workspaceCommandNow(win)+WORKSPACE_PENDING_NOTICE;
    }else nativeDeadline=null;
    if(state.phase!==lastPhase){
      lastPhase=state.phase;
      if(state.phase==="unknown")commandTrace(win,"presentation-unknown",{reserved:state.reserved,projection:!!state.projection});
    }
    if(disposed||generation!==token||!active())return;
    try{update(state);}catch{commandTrace(win,"presentation-error",{});}
    if(disposed||generation!==token||!active())return;
    const remaining=state.phase==="native-busy"?Math.min(250,Math.max(0,nativeDeadline-workspaceCommandNow(win))):state.remaining;
    if(!remaining)return;
    try{timer=win.setTimeout(()=>{if(!disposed&&generation===token){timer=0;refresh();}},Math.ceil(remaining));}catch{}
  };
  const dispose=()=>{
    if(disposed)return;disposed=true;generation++;
    if(timer)try{win.clearTimeout(timer);}catch{}timer=0;
    try{win.removeEventListener("Nocturne:WorkspaceCommandChanged",refresh);}catch{}
  };
  try{win.addEventListener("Nocturne:WorkspaceCommandChanged",refresh);}catch(error){dispose();throw error;}
  return {refresh,dispose};
}
function requireWorkspaceCommand(win,native,lease){
  if(!lease||lease.native!==native||lease.win!==win||workspaceCommandGate(win).owner!==lease||
    win.closed||win.gZenWorkspaces!==native||!native?.workspaceEnabled||!lease.current())
    throw workspaceCommandError("stale","Workspace command is no longer current.");
  // current() may synchronously re-enter through native getters or a
  // lifecycle callback. Validate exact ownership again after it returns.
  const gate=workspaceCommandGate(win);
  if(gate.owner!==lease||gate.pending!==lease.pending||!gate.pending||gate.reservation||win.closed||win.gZenWorkspaces!==native)
    throw workspaceCommandError("stale");
  if(lease.token&&lease.anchor[WORKSPACE_DATA_GATE]!==lease.token)throw workspaceCommandError("data-lease-lost");
  if(lease.peer&&(!lease.peer.win||lease.peer.win.closed||lease.peer.win.gZenWorkspaces!==lease.peer.native||
    !lease.peer.native?.workspaceEnabled||lease.peer.native.isChangingWorkspace!==false||
    workspaceCommandGate(lease.peer.win)!==lease.peer.gate||lease.peer.gate.reservation!==lease.token))
    throw workspaceCommandError("peer-lease-lost");
  if(native.isChangingWorkspace!==false)throw workspaceCommandError("native-busy","Native Workspace switch is still in progress.");
  if(workspaceCommandGate(win)!==gate||gate.owner!==lease||gate.pending!==lease.pending||
    gate.reservation||win.closed||win.gZenWorkspaces!==native)
    throw workspaceCommandError("stale");
  if(lease.token&&lease.anchor[WORKSPACE_DATA_GATE]!==lease.token)throw workspaceCommandError("data-lease-lost");
  // A later native getter can replace the peer manager or its entire gate.
  // Read the published gate again; an old reservation alone proves nothing.
  if(lease.peer&&(lease.peer.win.closed||lease.peer.win.gZenWorkspaces!==lease.peer.native||
    lease.peer.win[WORKSPACE_GATE]!==lease.peer.gate||lease.peer.gate.reservation!==lease.token||
    lease.peer.gate.pending||lease.peer.gate.owner))throw workspaceCommandError("peer-lease-lost");
}
function requireWorkspaceDataCommand(win,native,lease){
  requireWorkspaceCommand(win,native,lease);
  if(!lease.token)throw workspaceCommandError("data-lease-required");
}
function runWorkspaceCommand(win,native,kind,current,execute,{data=false,anchor=data?dataAnchor():null,peer=null}={}){
  const gate=workspaceCommandGate(win);
  const reject=code=>{commandTrace(win,"rejected",{kind,code});return Promise.reject(workspaceCommandError(code,
    code==="data-busy"?"Another native Workspace data command is pending. If it never settles, restart Zen.":
    "Workspace command is busy or unavailable. Try again when ready."));};
  if(win.closed||win.gZenWorkspaces!==native||!native?.workspaceEnabled||!current())return reject("stale");
  if(gate.pending||gate.owner||gate.reservation)return reject("busy");
  if(native.isChangingWorkspace!==false)return reject("native-busy");
  let peerLease=null;
  if(peer){
    if(!data||!peer.win||peer.win===win||peer.win.closed||peer.win.gZenWorkspaces!==peer.native||
      !peer.native?.workspaceEnabled||peer.native.isChangingWorkspace!==false)return reject("peer-unavailable");
    const peerGate=workspaceCommandGate(peer.win);
    if(peerGate.pending||peerGate.owner||peerGate.reservation)return reject("peer-busy");
    peerLease={win:peer.win,native:peer.native,gate:peerGate};
  }
  const startedAt=workspaceCommandNow(win);
  // Peer admission and clock access can call native getters. Re-read
  // both exact gates immediately before publishing any owner.
  if(workspaceCommandGate(win)!==gate||gate.pending||gate.owner||gate.reservation)return reject("busy");
  if(peerLease&&(workspaceCommandGate(peerLease.win)!==peerLease.gate||peerLease.gate.pending||peerLease.gate.owner||peerLease.gate.reservation))
    return reject("peer-busy");
  const token=data?Symbol("Nocturne data command"):null;
  if(data){
    if(!anchor)return reject("data-unavailable");
    try{
      if(anchor[WORKSPACE_DATA_GATE])return reject("data-busy");
      Object.defineProperty(anchor,WORKSPACE_DATA_GATE,{value:token,configurable:true});
      if(anchor[WORKSPACE_DATA_GATE]!==token)return reject("data-unavailable");
    }catch{return reject("data-unavailable");}
  }
  const lease={win,native,kind,current,anchor,token,peer:peerLease};
  let resolve,rejectResult;const pending=new Promise((a,b)=>{resolve=a;rejectResult=b;});
  lease.pending=pending;
  // Publish both gates before any native/visual callback can re-enter.
  let finished=false;
  const finish=(ok,value)=>{
    if(finished)return;finished=true;
    if(peerLease)try{if(peerLease.gate.reservation===token){delete peerLease.gate.reservation;delete peerLease.gate.startedAt;}}catch{}
    if(data)try{if(anchor[WORKSPACE_DATA_GATE]===token)delete anchor[WORKSPACE_DATA_GATE];}catch{}
    try{
      if((!gate.owner||gate.owner===lease)&&gate.pending===pending){gate.pending=null;delete gate.startedAt;}
      if(gate.owner===lease){
        if(!gate.pending&&gate.startedAt===startedAt)delete gate.startedAt;
        gate.owner=null;
      }
    }catch{}
    commandTrace(win,"end",{kind,ok,peer:!!peerLease,elapsed:Math.max(0,workspaceCommandNow(win)-startedAt),code:ok?null:value?.name==="WorkspaceCommandError"?value.code:"error"});
    notifyWorkspaceCommand(win);if(peerLease)notifyWorkspaceCommand(peerLease.win);
    if(ok)resolve(value);else rejectResult(value);
  };
  try{
    if(workspaceCommandGate(win)!==gate||gate.pending||gate.owner||gate.reservation)throw workspaceCommandError("busy");
    if(peerLease&&(workspaceCommandGate(peerLease.win)!==peerLease.gate||peerLease.gate.pending||peerLease.gate.owner||peerLease.gate.reservation))
      throw workspaceCommandError("peer-busy");
    gate.owner=lease;gate.pending=pending;gate.startedAt=startedAt;
    if(gate.owner!==lease||gate.pending!==pending)throw workspaceCommandError("gate-unavailable");
    if(peerLease){
      peerLease.gate.reservation=token;peerLease.gate.startedAt=startedAt;
      if(peerLease.gate.reservation!==token)throw workspaceCommandError("peer-unavailable");
    }
    commandTrace(win,"begin",{kind,data,peer:!!peerLease});
    notifyWorkspaceCommand(win);if(peerLease)notifyWorkspaceCommand(peerLease.win);
    requireWorkspaceCommand(win,native,lease);
    Promise.resolve(execute(lease)).then(v=>finish(true,v),e=>finish(false,e));
  }catch(error){finish(false,error);}
  return pending;
}
// Read the native Essentials section without calling getEssentialsSection:
// that API may CREATE a container and change its visibility.
function workspaceEssentialSection(win,native,tab){
  try{
    if(tab.getAttribute("zen-essential")!=="true"||!tab.pinned)return null;
    const context=Number(tab.getAttribute("usercontextid")||0);
    if(!Number.isSafeInteger(context)||context<0)return null;
    const expected=String(native.containerSpecificEssentials?context:0);
    const sections=Array.from(win.document.querySelectorAll("#zen-essentials .zen-workspace-tabs-section"));
    const containing=sections.filter(section=>section.isConnected&&section.contains(tab));
    return containing.length===1&&containing[0].getAttribute("container")===expected?containing[0]:null;
  }catch{return null;}
}
// Only read authoritative native structure. _shouldShowTab is NOT a safe
// predicate for unassigned tabs: Zen can move them as a side effect.
function inspectWorkspaceSwitch(win,native,id){
  try{
    if(win.closed||win.gZenWorkspaces!==native||!native?.workspaceEnabled)return "stale";
    if(native.isChangingWorkspace!==false)return "native-busy";
    if(!native.getWorkspaceFromId(id)||native.activeWorkspace!==id)return "active-mismatch";
    const element=native.workspaceElement(id),spaces=native.getWorkspaces();
    if(!element?.isConnected||!element.active||!element.tabsContainer?.isConnected||
      !element.pinnedTabsContainer?.isConnected||!element.scrollbox||!Array.isArray(spaces)||
      spaces.some(s=>!s?.uuid)||new Set(spaces.map(s=>s.uuid)).size!==spaces.length)return "container-unready";
    if(!spaces.some(s=>s.uuid===id)||element.tabsContainer===element.pinnedTabsContainer||
      spaces.some(s=>{const node=native.workspaceElement(s.uuid);return !node?.isConnected||!!node.active!==(s.uuid===id);}))return "container-mismatch";
    const browser=win.gBrowser,tc=browser?.tabContainer,tab=browser?.selectedTab;
    if(!tc||tc.arrowScrollbox!==element.scrollbox||tc.pinnedTabsContainer!==element.pinnedTabsContainer||
      browser.pinnedTabsContainer!==element.pinnedTabsContainer)return "binding-mismatch";
    if(!tab?.isConnected||tab.closing)return "selection-unverified";
    const empty=tab===native._emptyTab&&tab.hasAttribute("zen-empty-tab");
    if(!empty&&!Array.from(browser.visibleTabs||[]).includes(tab))return "selection-unverified";
    // Glance is physically nested under its parent and Zen's visibility
    // predicate intentionally always returns true for a Glance child.
    // Prove the parent's workspace rather than accepting any visible child.
    let owner=tab;
    if(tab.hasAttribute("zen-glance-tab")){
      owner=tab.parentNode?.closest?.(".tabbrowser-tab");
      const glanceId=tab.getAttribute("glance-id");
      if(!owner||owner===tab||!owner.isConnected||owner.closing||owner.hasAttribute("zen-glance-tab")||
        !glanceId||owner.getAttribute("glance-id")!==glanceId||!owner.contains(tab)||
        (typeof browser.isTab==="function"&&!browser.isTab(owner)))return "selection-mismatch";
    }
    const essential=owner.getAttribute("zen-essential")==="true";
    if(essential){
      if(!workspaceEssentialSection(win,native,owner))return "selection-mismatch";
      if(native.containerSpecificEssentials){
        const context=Number(owner.getAttribute("usercontextid")||0),space=native.getWorkspaceFromId(id),target=Number(space.containerTabId||0);
        if(target?target!==context:context!==0&&spaces.some(s=>Number(s.containerTabId||0)===context))return "selection-mismatch";
      }
    }else{
      if(owner.hasAttribute("zen-essential")||owner.getAttribute("zen-workspace-id")!==id)return "selection-mismatch";
      // Native Zen places the outermost folder/group by its own pin role,
      // which can differ from an individual member tab. A Glance child
      // was resolved to its parent above. Verify the exact physical chain.
      let item=owner;const seen=new Set([owner]);
      for(let group=owner.group;group;group=group.group){
        if(seen.has(group)||!group.isConnected||!group.contains(item))return "selection-mismatch";
        seen.add(group);item=group;
      }
      const normal=element.tabsContainer,pinned=element.pinnedTabsContainer;
      const expected=item.pinned?pinned:normal,other=item.pinned?normal:pinned;
      if(!expected.contains(owner)||!expected.contains(item)||other.contains(owner)||other.contains(item))return "selection-mismatch";
    }
    return "confirmed";
  }catch{return "inspection-error";}
}
const switchWorkspaceWithin=async function(win,native,id,lease,{motion=false}={}){
  const verify=()=>{
    requireWorkspaceCommand(win,native,lease);
    const outcome=inspectWorkspaceSwitch(win,native,id);
    commandTrace(win,"switch-result",{kind:lease.kind,outcome});
    if(outcome!=="confirmed")throw workspaceCommandError(outcome);
    return {status:"confirmed"};
  };
  requireWorkspaceCommand(win,native,lease);
  if(!native.getWorkspaceFromId(id)||typeof native.changeWorkspaceWithID!=="function")throw workspaceCommandError("missing-target");
  if(native.activeWorkspace===id)return verify();
  const invoke=async()=>{
    requireWorkspaceCommand(win,native,lease);
    if(!native.getWorkspaceFromId(id))throw workspaceCommandError("missing-target");
    if(native.activeWorkspace!==id)await native.changeWorkspaceWithID(id);
    // Fulfilled native promise and ID alone do not certify a native switch.
    return verify();
  };
  const transition=motion?win.__zenRefinedWorkspaceTransition:null;
  const result=await (typeof transition?.run==="function"?transition.run(invoke,{lease}):invoke());
  if(result?.status!=="confirmed")throw workspaceCommandError("not-started");
  return verify();
}
function requestWorkspaceSwitch(win,native,id,kind,current,{motion=true}={}){
  return runWorkspaceCommand(win,native,kind,current,lease=>switchWorkspaceWithin(win,native,id,lease,{motion}));
}
const FREE_ROLE="zen.oneplane.free-space-id",TRASH_ROLE="zen.oneplane.trash-space-id";
const designateWorkspaceFree=async function(win,native,prefs,lease,id=null){
  requireWorkspaceDataCommand(win,native,lease);
  const previous=prefs.getStringPref(FREE_ROLE,""),trash=prefs.getStringPref(TRASH_ROLE,"");
  if(previous&&native.getWorkspaceFromId(previous))throw workspaceCommandError("free-exists","Free is already designated.");
  // Automatic creation must not silently claim an ambiguous existing Free.
  if(!id&&native.getWorkspaces().some(s=>String(s.name||"").trim().toLowerCase()==="free"))
    throw workspaceCommandError("free-ambiguous","Choose the existing Free workspace manually.");
  const ws=id?native.getWorkspaceFromId(id):await native.createAndSaveWorkspace("Free","⌂",true);
  requireWorkspaceCommand(win,native,lease);
  const valid=()=>ws?.uuid&&ws.uuid!==prefs.getStringPref(TRASH_ROLE,"")&&
    !!native.getWorkspaceFromId(ws.uuid);
  const beforeRole=()=>valid()&&prefs.getStringPref(FREE_ROLE,"")===previous&&prefs.getStringPref(TRASH_ROLE,"")===trash;
  if(!beforeRole())throw workspaceCommandError("free-changed");
  if(id){
    if(typeof native.saveWorkspace!=="function")throw workspaceCommandError("rename-unavailable");
    native.saveWorkspace({...ws,name:"Free"});
    requireWorkspaceCommand(win,native,lease);
    if(!beforeRole()||native.getWorkspaceFromId(ws.uuid)?.name!=="Free")throw workspaceCommandError("free-changed");
  }
  prefs.setStringPref(FREE_ROLE,ws.uuid);
  requireWorkspaceCommand(win,native,lease);
  const owns=()=>valid()&&prefs.getStringPref(FREE_ROLE,"")===ws.uuid;
  if(!owns())throw workspaceCommandError("free-changed");
  if(typeof native.reorderWorkspace==="function")await native.reorderWorkspace(ws.uuid,0);
  requireWorkspaceCommand(win,native,lease);
  if(!owns())throw workspaceCommandError("free-changed");
  if(typeof native.reorderWorkspace==="function"&&native.getWorkspaces()[0]?.uuid!==ws.uuid)throw workspaceCommandError("free-order-unverified","Free was designated but its order could not be confirmed.");
  return ws.uuid;
}

/* Destructive operations: reconcile exact native identity with physical
 * membership. No shadow tab store, no automatic retry or rollback. */
function workspaceOwned(tab){
  return !tab.hasAttribute("zen-essential")&&!(tab.hasAttribute("zen-empty-tab")&&!tab.group);
}
function sameWorkspaceTabs(a,b){
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return false;
  const listed=new Set(b);
  return listed.size===a.length&&new Set(a).size===a.length&&a.every(t=>listed.has(t));
}
function readWorkspaceOwnership(win,native,id,{fresh=false}={}){
  try{
    if(win.closed||win.gZenWorkspaces!==native||!native?.workspaceEnabled||!native.getWorkspaceFromId(id))return null;
    const browser=win.gBrowser,element=native.workspaceElement(id),normal=element?.tabsContainer,pinned=element?.pinnedTabsContainer;
    if(!element?.isConnected||!normal?.isConnected||!pinned?.isConnected||normal===pinned||!browser?.isTab)return null;
    if(fresh){
      if(typeof browser.tabContainer?._invalidateCachedTabs!=="function")return null;
      browser.tabContainer._invalidateCachedTabs();
    }
    const cached=native.allStoredTabs;
    if(!Array.isArray(cached))return null;
    const normalTabs=Array.from(normal.querySelectorAll(".tabbrowser-tab")),pinnedTabs=Array.from(pinned.querySelectorAll(".tabbrowser-tab"));
    const physical=[...normalTabs,...pinnedTabs];
    if(normalTabs.some(t=>t.pinned)||pinnedTabs.some(t=>!t.pinned))return null;
    if(new Set(physical).size!==physical.length||physical.some(t=>!browser.isTab(t)||!t.isConnected))return null;
    // Essentials are not supposed to live in these containers. Only the
    // exact native empty placeholder can be ignored by this safety guard.
    if(physical.some(t=>t.hasAttribute("zen-essential")||
      (!workspaceOwned(t)&&(t!==native._emptyTab||!t.hasAttribute("zen-empty-tab")))))return null;
    const owned=physical.filter(workspaceOwned);
    if(owned.some(t=>t.getAttribute("zen-workspace-id")!==id))return null;
    const listed=cached.filter(t=>t.getAttribute("zen-workspace-id")===id);
    if(listed.some(t=>!workspaceOwned(t)&&!t.hasAttribute("zen-essential")&&t!==native._emptyTab))return null;
    const listedOwned=listed.filter(workspaceOwned);
    if(!sameWorkspaceTabs(owned,listedOwned))return null;
    return {element,normal,pinned,tabs:owned,browser};
  }catch{return null;}
}
function inspectWorkspaceTabMove(win,native,tab,source,destination){
  try{
    const from=readWorkspaceOwnership(win,native,source,{fresh:true}),to=readWorkspaceOwnership(win,native,destination);
    if(!from||!to||from.browser!==to.browser||!tab.isConnected||!from.browser.isTab(tab)||tab.closing)return "unknown";
    const id=tab.getAttribute("zen-workspace-id"),target=tab.pinned?to.pinned:to.normal,origin=tab.pinned?from.pinned:from.normal;
    if(id===destination&&to.tabs.includes(tab)&&target.contains(tab)&&!from.tabs.includes(tab))return "confirmed";
    if(id===source&&from.tabs.includes(tab)&&origin.contains(tab)&&!to.tabs.includes(tab))return "retained";
    return "unknown";
  }catch{return "unknown";}
}
function inspectWorkspaceTabRemoval(win,native,tab,source,browser){
  try{
    if(win.gBrowser!==browser||win.gZenWorkspaces!==native||win.closed)return "unknown";
    const owned=readWorkspaceOwnership(win,native,source,{fresh:true});
    if(!owned||owned.browser!==browser)return "unknown";
    if(tab.isConnected&&!tab.closing&&owned.tabs.includes(tab))return "retained";
    if(!tab.isConnected&&tab.linkedBrowser===null&&!owned.tabs.includes(tab)&&!native.allStoredTabs.includes(tab))return "confirmed";
    return "unknown";
  }catch{return "unknown";}
}
function workspaceTabJournal(tabs,step){
  const result={planned:tabs.length,attempted:0,confirmed:0,retained:0,unknown:0,notAttempted:tabs.length,reason:null};
  for(const tab of tabs){
    let outcome;
    try{outcome=step(tab);}catch{outcome={attempted:false,state:"unknown",reason:"preflight-error"};}
    if(outcome.attempted){
      result.attempted++;result.notAttempted--;
      result[outcome.state==="confirmed"||outcome.state==="retained"?outcome.state:"unknown"]++;
    }
    if(!outcome.attempted||outcome.state!=="confirmed"||outcome.reason){
      result.reason=outcome.reason||"unconfirmed";break;
    }
  }
  return result;
}
function workspaceJournalComplete(result){
  return result.confirmed===result.planned&&!result.reason;
}

function inspectWorkspaceDeletion(win,native,id,roles,browser){
  try{
    if(win.closed||win.gZenWorkspaces!==native||win.gBrowser!==browser||!native.workspaceEnabled||
      native.isChangingWorkspace!==false||id===roles.free||id===roles.trash)return "unknown";
    // getWorkspaceFromId swallows native lookup failures. Require an
    // actual authoritative list rather than interpreting null as absence.
    const spaces=native.getWorkspaces();
    if(!Array.isArray(spaces)||spaces.some(s=>!s?.uuid)||new Set(spaces.map(s=>s.uuid)).size!==spaces.length||
      !spaces.some(s=>s.uuid===roles.free)||(roles.trash&&!spaces.some(s=>s.uuid===roles.trash)))return "unknown";
    if(spaces.some(s=>s.uuid===id)||native.workspaceElement(id))return "unknown";
    return "confirmed";
  }catch{return "unknown";}
}
// Shared Zen Home v1: portable core, independent of both mod hosts.
function acquireZenHome(win, services) {
  const KEY="__zenSharedHomeV1", PREF="zen.home.shortcuts.v1", STARTUP="__zenSharedHomeStartupV1";
  const existing=win[KEY];
  if(existing)return existing.apiVersion===1?existing.acquire():null;
  const doc=win.document, root=doc.documentElement, prefs=services.prefs;
  const host=doc.getElementById("zen-tabbox-wrapper"), panels=doc.getElementById("tabbrowser-tabpanels"), browser=win.gBrowser;
  if(!host||!panels||!host.contains(panels)||!browser?.tabContainer)return null;
  try{
    const {PrivateBrowsingUtils}=ChromeUtils.importESModule("resource://gre/modules/PrivateBrowsingUtils.sys.mjs");
    if(PrivateBrowsingUtils.isWindowPrivate(win))return null;
  }catch{return null;}
  const html=(tag,cls,text)=>{
    const n=doc.createElementNS("http://www.w3.org/1999/xhtml",tag);
    if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;
  };
  function safeURL(value){
    if(typeof value!=="string"||!value.trim())return null;
    try{
      const input=value.trim(), url=new win.URL(/^[a-z][a-z\d+.-]*:/i.test(input)?input:"https://"+input);
      return /^(https?):$/.test(url.protocol)&&url.hostname&&!url.username&&!url.password?url.href:null;
    }catch{return null;}
  }
  function normalize(raw){
    if(!raw||raw.version!==1||!Array.isArray(raw.items))return [];
    const seen=new Set(),result=[];
    for(const item of raw.items.slice(0,100)){
      const url=safeURL(item?.url),id=item?.id;
      if(item?.type!=="shortcut"||typeof id!=="string"||!id||seen.has(id)||!url)continue;
      seen.add(id);result.push({id,type:"shortcut",title:String(item.title||new win.URL(url).hostname).slice(0,80),url});
    }
    return result;
  }
  // Prefer high-resolution cached Places icons; use a local scalable Steam
  // mark where the tab favicon is commonly a 16px bitmap. Simple Icons (CC0).
  const steamVector="data:image/svg+xml,"+encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\"><defs><linearGradient id=\"s\" x1=\"0\" y1=\"0\" x2=\"0.4\" y2=\"1\"><stop stop-color=\"#102139\"/><stop offset=\"1\" stop-color=\"#176a9b\"/></linearGradient></defs><circle cx=\"12\" cy=\"12\" r=\"11.9\" fill=\"#eaf4ff\"/><path fill=\"url(#s)\" d=\"M11.979 0C5.678 0 .511 4.86.022 11.037l6.432 2.658c.545-.371 1.203-.59 1.912-.59.063 0 .125.004.188.006l2.861-4.142V8.91c0-2.495 2.028-4.524 4.524-4.524 2.494 0 4.524 2.031 4.524 4.527s-2.03 4.525-4.524 4.525h-.105l-4.076 2.911c0 .052.004.105.004.159 0 1.875-1.515 3.396-3.39 3.396-1.635 0-3.016-1.173-3.331-2.727L.436 15.27C1.862 20.307 6.486 24 11.979 24c6.627 0 11.999-5.373 11.999-12S18.605 0 11.979 0zM7.54 18.21l-1.473-.61c.262.543.714.999 1.314 1.25 1.297.539 2.793-.076 3.332-1.375.263-.63.264-1.319.005-1.949s-.75-1.121-1.377-1.383c-.624-.26-1.29-.249-1.878-.03l1.523.63c.956.4 1.409 1.5 1.009 2.455-.397.957-1.497 1.41-2.454 1.012H7.54zm11.415-9.303c0-1.662-1.353-3.015-3.015-3.015-1.665 0-3.015 1.353-3.015 3.015 0 1.665 1.35 3.015 3.015 3.015 1.663 0 3.015-1.35 3.015-3.015zm-5.273-.005c0-1.252 1.013-2.266 2.265-2.266 1.249 0 2.266 1.014 2.266 2.266 0 1.251-1.017 2.265-2.266 2.265-1.253 0-2.265-1.014-2.265-2.265z\"/></svg>");
  const gmailVector="data:image/svg+xml,"+encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 48 48\"><path fill=\"#4285f4\" d=\"M3 16l9 7v15H6a3 3 0 0 1-3-3z\"/><path fill=\"#34a853\" d=\"M45 16l-9 7v15h6a3 3 0 0 0 3-3z\"/><path fill=\"#fbbc04\" d=\"M36 11.75l3.6-2.7A3.38 3.38 0 0 1 45 11.75V16l-9 7z\"/><path fill=\"#ea4335\" d=\"M12 11.75l12 9 12-9V23l-12 9-12-9z\"/><path fill=\"#c5221f\" d=\"M3 11.75a3.38 3.38 0 0 1 5.4-2.7l3.6 2.7V23l-9-7z\"/></svg>");
  const genericVector="data:image/svg+xml,"+encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"#969cac\" stroke-width=\"1.6\"><circle cx=\"12\" cy=\"12\" r=\"9\"/><ellipse cx=\"12\" cy=\"12\" rx=\"4\" ry=\"9\"/><path d=\"M3 12h18M5 7h14M5 17h14\"/></svg>");
  function homeIconURL(value,cssSize=30){
    const url=new win.URL(value);
    const host=url.hostname.toLowerCase();
    if(/(?:^|\.)(?:steampowered\.com|steamcommunity\.com)$/.test(host))return steamVector;
    if(host==="mail.google.com"||/(?:^|\.)gmail\.com$/.test(host))return gmailVector;
    url.hash="";
    const preferred=Math.min(192,Math.max(cssSize>=30?96:48,Math.ceil(cssSize*(Number(win.devicePixelRatio)||1))));
    return "page-icon:"+url.href+"#size="+preferred;
  }
  function setHomeIcon(img,url,size){
    const page=new win.URL(url);page.hash="";
    const candidates=[...new Set([homeIconURL(url,size),"page-icon:"+url,"page-icon:"+page.href,genericVector])];
    let index=0;
    const retry=()=>{
      if(++index<candidates.length)img.src=candidates[index];
      else img.removeEventListener("error",retry);
    };
    img.addEventListener("error",retry);img.src=candidates[0];
  }
  const style=html("style");style.id="zen-shared-home-style";
  style.textContent=`
#zen-tabbox-wrapper[data-zr-home-host]{position:relative!important}
#tabbrowser-tabpanels[data-zr-home-covered],#tabbrowser-tabpanels[data-zr-home-covered] browser{visibility:hidden!important;pointer-events:none!important}
#zen-shared-home[hidden]{display:none!important}
#zen-shared-home{position:absolute;inset:0;z-index:4;display:flex;align-items:safe center;justify-content:center;overflow:auto;box-sizing:border-box;padding:72px 24px 32px;background:transparent;color:var(--toolbox-textcolor,currentColor);font:menu;scrollbar-width:thin}
#zen-shared-home *{box-sizing:border-box}
#zen-shared-home button,#zen-shared-home input{font:inherit;color:inherit}
#zen-shared-home button{appearance:none;cursor:pointer;border:0;background:none;padding:0}
#zen-shared-home button:focus-visible,#zen-shared-home input:focus-visible{outline:2px solid AccentColor;outline-offset:3px}
/* Gecko subtracts every explicit no-drag rectangle from all drag rectangles.
   A full-screen Home no-drag box erases the overlapping toolbar. Default
   contributes neither region; only real Home controls subtract their boxes. */
#zen-shared-home,#zen-shared-home *{-moz-window-dragging:default!important}
#zen-shared-home :is(button,input,textarea,select,summary,a,[draggable=true],.zh-recommendations){-moz-window-dragging:no-drag!important}
#zen-shared-home .zh-content{width:min(100%,720px);margin:auto;transition:opacity 180ms ease,translate 220ms cubic-bezier(.2,.75,.25,1)}
:root[data-zr-startup-phase="waiting"] #zen-shared-home[data-zh-startup] .zh-content{opacity:0!important;pointer-events:none}
#zen-shared-home[data-zh-startup] .zh-search:focus-visible{outline:none}
/* The collapsed button, native editor and cancellation fallback share
   these exact tokens. No separate hover/focus frame at the handoff. */
:root{
  --zh-search-color:var(--toolbox-textcolor,var(--toolbar-color,currentColor));
  --zh-search-glass:color-mix(in srgb,var(--zh-search-color) 8%,transparent);
  --zh-search-stroke:color-mix(in srgb,var(--zh-search-color) 14%,transparent);
  --zh-search-label:color-mix(in srgb,var(--zh-search-color) 76%,transparent);
  --zh-search-radius:14px;
  --zh-search-font:400 14px system-ui,sans-serif;
  --zh-search-icon:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='1.6' stroke-linecap='round'%3E%3Ccircle cx='10.5' cy='10.5' r='6.5'/%3E%3Cpath d='m16 16 4 4'/%3E%3C/svg%3E");
}
#zen-shared-home .zh-search,#zen-home-search-return .zh-return-header{
  display:flex;align-items:center;gap:12px;padding:0 19px;
  font:var(--zh-search-font);color:var(--zh-search-label);text-align:start;white-space:nowrap;
}
#zen-shared-home .zh-search{
  width:100%;height:56px;border:1px solid var(--zh-search-stroke);
  background:var(--zh-search-glass);border-radius:var(--zh-search-radius);
  transition:none;
}
#zen-shared-home .zh-search:hover{background:var(--zh-search-glass)}
#zen-shared-home .zh-search svg,#zen-home-search-return .zh-return-header svg{width:17px;height:17px;flex:none;opacity:1}
#zen-shared-home .zh-search span{min-width:0;overflow:hidden;text-overflow:ellipsis}
#zen-shared-home .zh-search:focus-visible{outline-offset:2px}
@media(prefers-reduced-transparency:reduce){:root{--zh-search-glass:light-dark(#f4f4f8,#252632)}}
#zen-shared-home .zh-section{margin-block-start:36px}
#zen-shared-home h3{font-size:13px;font-weight:500;opacity:.68;margin:0 0 14px}
#zen-shared-home .zh-pins{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
#zen-shared-home .zh-pin{position:relative;flex:0 0 min(165px,calc((100% - 36px)/4));min-width:0}
#zen-shared-home .zh-tile{width:100%;height:102px;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:10px;border-radius:14px;background:color-mix(in srgb,currentColor 5%,transparent);border:1px solid color-mix(in srgb,currentColor 8%,transparent);transition:background 160ms,translate 180ms}
#zen-shared-home .zh-tile:not(:disabled):hover{background:color-mix(in srgb,currentColor 10%,transparent);translate:0 -2px}
#zen-shared-home .zh-tile img{width:30px;height:30px;object-fit:contain}
#zen-shared-home .zh-tile span{max-width:90%;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}
#zen-shared-home .zh-remove{position:absolute;right:5px;top:5px;border-radius:50%;width:21px;height:21px;background:color-mix(in srgb,currentColor 16%,transparent)}
#zen-shared-home .zh-order{display:flex;justify-content:center;gap:7px;margin-top:5px}
#zen-shared-home .zh-spaces{display:flex;flex-wrap:wrap;justify-content:center;gap:12px}
#zen-shared-home .zh-space{flex:1 1 160px;max-width:232px;min-width:0;display:flex;align-items:center;gap:10px;text-align:start;min-height:48px;padding:13px;border:1px solid color-mix(in srgb,currentColor 8%,transparent);background:color-mix(in srgb,currentColor 5%,transparent);border-radius:11px}
#zen-shared-home .zh-space span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
#zen-shared-home .zh-space[aria-current=true]{border-color:color-mix(in srgb,currentColor 25%,transparent)}
/* A command notice must never change the Home section/footer layout. */
#zen-shared-home .zh-workspace-section{position:relative}
#zen-shared-home .zh-workspace-section > .zh-workspace-pending{position:absolute;inset-inline:0;top:100%;margin:6px 0 0;max-width:100%;overflow:hidden;white-space:nowrap;text-overflow:ellipsis}
#zen-shared-home .zh-footer,#zen-shared-home .zh-editbar{display:flex;justify-content:center;gap:8px;margin-top:34px}
#zen-shared-home .zh-small{padding:8px 12px;border-radius:8px;font-size:11px;opacity:.8}
#zen-shared-home .zh-small:hover{background:color-mix(in srgb,currentColor 8%,transparent);opacity:1}
#zen-shared-home .zh-empty{font-size:12px;opacity:.55;text-align:center;padding:26px}
#zen-shared-home .zh-picker{margin:0 auto;padding:16px;border:1px solid color-mix(in srgb,currentColor 12%,transparent);border-radius:14px;background:color-mix(in srgb,currentColor 4%,transparent)}
#zen-shared-home .zh-picker-head{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:12px}
#zen-shared-home .zh-picker-head h3{margin:0}
#zen-shared-home[data-zh-adding] .zh-section:first-child{margin-block-start:0}
#zen-shared-home[data-zh-adding] .zh-section{margin-block-start:24px}
#zen-shared-home[data-zh-adding] .zh-footer{margin-top:22px}
#zen-shared-home .zh-recommendations{--zh-row:64px;--zh-row-gap:8px;display:grid;grid-template-columns:repeat(3,minmax(0,1fr));grid-auto-rows:var(--zh-row);align-content:start;gap:var(--zh-row-gap);padding:2px;height:calc(2 * var(--zh-row) + var(--zh-row-gap) + 4px);overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:thin;scrollbar-gutter:stable;scrollbar-color:color-mix(in srgb,currentColor 25%,transparent) transparent}
#zen-shared-home .zh-recommendations:focus-visible{outline:1px solid AccentColor;outline-offset:2px}
#zen-shared-home .zh-recommendations .zh-empty{align-self:center;padding:8px}
#zen-shared-home [data-zh-enter]{animation:zh-picker-enter 200ms cubic-bezier(.2,.75,.25,1) both}
@keyframes zh-picker-enter{from{opacity:0;transform:translateY(7px)}to{opacity:1;transform:translateY(0)}}
#zen-shared-home .zh-recommendations .zh-empty{grid-column:1/-1}
#zen-shared-home .zh-picker-actions{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:10px;flex-wrap:wrap}
#zen-shared-home .zh-picker-count{font-size:11px;opacity:.6}
#zen-shared-home .zh-custom-actions{display:flex;justify-content:flex-end;gap:8px}
#zen-shared-home .zh-custom-actions button{background:color-mix(in srgb,currentColor 7%,transparent)}
#zen-shared-home .zh-suggestion{display:flex;align-items:center;gap:10px;min-width:0;min-height:0;height:100%;padding:10px;text-align:start;border-radius:10px;border:1px solid color-mix(in srgb,currentColor 9%,transparent);background:color-mix(in srgb,currentColor 4%,transparent);transition:background 160ms ease,border-color 160ms ease,scale 140ms ease}
#zen-shared-home .zh-suggestion:hover{background:color-mix(in srgb,currentColor 11%,transparent);border-color:color-mix(in srgb,currentColor 19%,transparent)}
#zen-shared-home .zh-suggestion:active{scale:.97}
#zen-shared-home .zh-suggestion-plus{transition:opacity 160ms ease,scale 160ms ease}
#zen-shared-home .zh-suggestion:hover .zh-suggestion-plus{opacity:1;scale:1.12}
#zen-shared-home .zh-suggestion img{width:23px;height:23px;object-fit:contain;flex:none}
#zen-shared-home .zh-suggestion-copy{display:flex;flex-direction:column;gap:4px;min-width:0;flex:1}
#zen-shared-home .zh-suggestion-copy span{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;font-size:12px}
#zen-shared-home .zh-suggestion-copy small{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;opacity:.58;font-size:10px}
#zen-shared-home .zh-suggestion-plus{font-size:17px;opacity:.7;flex:none}
#zen-shared-home .zh-picker-note{font-size:11px;opacity:.6;margin:0 0 12px}
#zen-shared-home .zh-form{display:grid;gap:8px;margin:8px auto 0;max-width:420px}
@media(max-width:520px){#zen-shared-home .zh-recommendations{grid-template-columns:repeat(2,minmax(0,1fr));--zh-row:52px}#zen-shared-home .zh-suggestion{padding:7px 8px;gap:6px}}
@media(max-width:340px){#zen-shared-home .zh-recommendations{grid-template-columns:1fr}}
@media(max-height:560px){#zen-shared-home[data-zh-adding]{padding-block:46px 12px}#zen-shared-home[data-zh-adding] .zh-section{margin-block-start:14px}#zen-shared-home[data-zh-adding] .zh-footer{margin-top:12px}#zen-shared-home .zh-picker{padding:10px}#zen-shared-home .zh-recommendations{--zh-row:48px}#zen-shared-home .zh-picker-note{margin-bottom:6px}}
#zen-shared-home .zh-form input{width:100%;padding:9px 12px;border:1px solid color-mix(in srgb,currentColor 15%,transparent);border-radius:8px;background:color-mix(in srgb,currentColor 6%,transparent)}
#zen-shared-home .zh-error{font-size:11px;color:light-dark(#a22,#ffb2b2)}
#zen-shared-home .zh-pin[data-drop]{outline:1px solid AccentColor;border-radius:14px}
/* One surface: the Home button is replaced by the real native editor.
   No overlapping dummy bar and no separate native background silhouette. */
#zen-shared-home[data-zh-search] .zh-content{pointer-events:none;transition:none}
#zen-shared-home .zh-section,#zen-shared-home .zh-footer{transition:opacity 240ms ease}
#zen-shared-home[data-zh-search] .zh-section,#zen-shared-home[data-zh-search] .zh-footer{opacity:0;pointer-events:none}
#zen-shared-home[data-zh-search-ready] .zh-search{visibility:hidden}
#zen-shared-home[data-zh-search] .zh-search{outline:none!important}
@property --zh-reveal-height{syntax:"<length>";inherits:false;initial-value:56px}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"]{
  --zh-glass:var(--zh-search-glass);
  --zh-stroke:var(--zh-search-stroke);
  --urlbar-background-color:transparent!important;
  --urlbar-background-color-focus:transparent!important;
  --zen-urlbar-background-base:transparent!important;
  --zen-urlbar-background-transparent:transparent!important;
  --urlbar-background-overhang-open:0px!important;
  --urlbar-input-growth-open-inline:0px!important;
  --urlbar-input-growth-open-block:0px!important;
  --urlbar-background-border-radius:14px!important;
  --urlbar-background-border-top-radius-open:14px!important;
  --urlbar-container-height:var(--zh-search-header,56px)!important;
  --urlbar-margin-inline:0px!important;
  --urlbar-container-padding:0px!important;
  position:fixed!important;inset:auto!important;
  left:clamp(12px,var(--zh-search-left,12px),max(12px,calc(100vw - var(--zh-search-width,720px) - 12px)))!important;
  top:var(--zh-search-top,80px)!important;
  width:min(var(--zh-search-width,720px),calc(100vw - 24px))!important;
  min-width:0!important;max-width:none!important;
  height:auto!important;min-height:0!important;max-height:var(--zh-search-room,calc(100vh - 96px))!important;
  margin:0!important;padding:0!important;box-sizing:border-box!important;
  position-anchor:none!important;position-area:none!important;
  background:var(--zh-glass)!important;border:1px solid var(--zh-stroke)!important;
  border-radius:var(--zh-search-radius)!important;outline:0!important;box-shadow:none!important;
  overflow:clip!important;clip-path:none!important;transform:none!important;translate:none!important;scale:1!important;
  animation:none!important;transition:none!important;opacity:1!important;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] > .urlbar-background,
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] .urlbarView-background{
  background:transparent!important;border:0!important;outline:0!important;box-shadow:none!important;backdrop-filter:none!important;
  inset:0!important;margin:0!important;transform:none!important;scale:1!important;border-radius:14px!important;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] > .urlbar-input-container{
  box-sizing:border-box!important;min-height:calc(var(--zh-search-header,56px) - 2px)!important;height:calc(var(--zh-search-header,56px) - 2px)!important;
  max-height:calc(var(--zh-search-header,56px) - 2px)!important;flex-shrink:0!important;
  background:transparent!important;margin:0!important;padding:0 19px!important;border:0!important;outline:0!important;box-shadow:none!important;border-radius:var(--zh-search-radius)!important;
  gap:12px!important;align-items:center!important;
}
/* Use the same header typography and icon footprint as the Home button.
   Native search mode controls remain available when a mode is selected. */
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] .urlbar-input-box{
  margin:0!important;padding:0!important;min-width:0!important;font:var(--zh-search-font)!important;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] #urlbar-input{
  margin:0!important;padding:0!important;font:var(--zh-search-font)!important;
  color:var(--zh-search-color)!important;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] #urlbar-input::placeholder{
  color:var(--zh-search-label)!important;opacity:1!important;font:var(--zh-search-font)!important;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"]:not([searchmode]) > .urlbar-input-container::before{
  content:"";display:block;width:17px;height:17px;flex:0 0 17px;background:var(--zh-search-label);
  mask:var(--zh-search-icon) center/contain no-repeat;pointer-events:none;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"]:not([searchmode]) #identity-box{display:none!important}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] .urlbarView{
  background:transparent!important;border:0!important;outline:0!important;box-shadow:none!important;border-radius:0 0 14px 14px!important;
  flex-shrink:0!important;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] #urlbar-results,
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] #urlbar-results[data-zr-smart-grid]{
  max-height:max(56px,calc(var(--zh-search-room,calc(100vh - 96px)) - var(--zh-search-header,56px) - 40px))!important;
  overflow-y:auto!important;scrollbar-width:thin;
}
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] #urlbar-results .urlbarView-row{
  --urlbarview-row-min-height:40px;
}
/* Home already animates the whole result view. Keep both chronological
   rails stable; ordinary non-Home search retains its own timeline motion. */
#urlbar[data-zr-home-search][zen-floating-urlbar="true"] #urlbar-results[data-zr-smart-grid][data-zr-timeline] > .urlbarView-row[data-zr-rail]::after{
  animation:none!important;background-position:center bottom,center!important;opacity:.43!important;
}
#urlbar[data-zr-home-search-motion="prepare"][zen-floating-urlbar="true"],
#urlbar[data-zr-home-search-motion="run"][zen-floating-urlbar="true"]{
  height:var(--zh-reveal-height,var(--zh-search-header,56px))!important;
}
/* Keep the original button painted until the real editor is ready.
   Both changes happen in the same frame, so there is no blank handoff. */
#urlbar[data-zr-home-search-motion="prepare"][zen-floating-urlbar="true"]{opacity:0!important}
#urlbar[data-zr-home-search-motion="prepare"][zen-floating-urlbar="true"] .urlbarView{opacity:0!important}
#urlbar[data-zr-home-search-motion="run"][zen-floating-urlbar="true"] .urlbarView{opacity:var(--zh-results-alpha,1)!important}
#urlbar[data-zr-home-search-motion="closed"][zen-floating-urlbar="true"],
#urlbar[data-zr-home-search][data-zh-closing]{opacity:0!important;visibility:hidden!important;transition:none!important;animation:none!important}
#urlbar[data-zr-home-search][data-zh-closing] .urlbarView{pointer-events:none!important}
#zen-home-search-return{
  position:fixed;z-index:2147483000;box-sizing:border-box;overflow:hidden;pointer-events:none;
  background:var(--zh-search-glass);border:1px solid var(--zh-search-stroke);
  border-radius:var(--zh-search-radius);color:var(--zh-search-label);font:var(--zh-search-font);
}
#zen-home-search-return .zh-return-header{box-sizing:border-box}
#zen-shared-home[data-zh-return] .zh-search{visibility:hidden}
#zen-shared-home[data-zh-return] .zh-section{opacity:1;transition:none!important;animation:none!important;pointer-events:none}
#zen-shared-home[data-zh-return] :is(.zh-section h3,.zh-pin,.zh-pins .zh-empty,.zh-editbar,.zh-space,.zh-footer){
  opacity:calc(var(--zh-return-alpha,0) * var(--zh-return-base,1));
  clip-path:inset(var(--zh-return-clip,0px) 0 0 0);
  translate:0 var(--zh-return-shift,0px);
  transition:none!important;animation:none!important;pointer-events:none
}
#zen-home-search-return .zh-return-results{position:absolute;pointer-events:none;overflow:hidden}
#zen-home-search-return,#zen-home-search-return *{-moz-window-dragging:no-drag!important;pointer-events:none!important}
@media(max-width:600px){#zen-shared-home{padding:62px 16px 20px}#zen-shared-home .zh-pin{flex-basis:calc((100% - 24px)/3)}#zen-shared-home .zh-tile{height:84px}#zen-shared-home .zh-space{flex-basis:120px}}
@media(prefers-reduced-motion:reduce){#zen-shared-home *{transition:none!important;animation:none!important}#zen-shared-home .zh-suggestion:active,#zen-shared-home .zh-suggestion:hover .zh-suggestion-plus{scale:1}}
`;
  const panel=html("div");panel.id="zen-shared-home";panel.hidden=true;
  panel.setAttribute("role","region");panel.setAttribute("aria-label","Home");
  const content=html("main","zh-content");panel.append(content);
  let open=false,editing=false,dead=false,switching=false,adding=false,dragId=null,focusHome=null,oldInert=false,covered=false,motion=null,searchToken=null,startupHome=false,homeOnPlaceholder=false;
  let searchFrame=0,searchMotion=null,searchTimer=0,searchBar=null,nativeCancelTab=null;
  let searchGeometry=null,searchLastHeight=0,searchCurrentHeight=0,searchClosing=false,searchReturn=null,searchReturnFrame=0;
  let searchInput=null,searchOriginalPlaceholder=null,searchSessionLabel=null;
  let searchSnapshot=null,searchSnapshotTimer=0,searchSnapshotObserver=null,searchSnapshotDirty=true,searchSnapshotView=null;
  let searchReturnParts=[],searchLastRect=null;
  let pinScrollTop=0,pinCustom=false,pinViewMode="home",pendingWatch=null;
  function updateWorkspacePending(state){
    const status=content.querySelector(".zh-workspace-pending");
    if(status){const message=workspaceCommandMessage(state);status.textContent=message;status.title=message;status.hidden=!message;}
    for(const b of Array.from(content.querySelectorAll?.(".zh-space[data-zh-workspace-id]")||[]))b.disabled=switching||workspaceCommandPresentationBlocked(state);
  }
  const leases=new Set(),cleanups=[];
  function listen(node,type,fn,options){node.addEventListener(type,fn,options);cleanups.push(()=>node.removeEventListener(type,fn,options));}
  const button=(cls,label,fn)=>{const n=html("button",cls,label);n.type="button";n.addEventListener("click",fn);return n;};
  function load(){try{return normalize(JSON.parse(prefs.getStringPref(PREF,'{"version":1,"items":[]}')));}catch{return [];}}
  function save(items){prefs.setStringPref(PREF,JSON.stringify({version:1,items:normalize({version:1,items})}));}
  function notify(){for(const l of [...leases])for(const fn of [...l.listeners])try{fn(open);}catch(error){win.console.warn("[Zen Home] subscriber",nocturneErrorClass(error));}}
  function allowed(){return !dead&&host.isConnected&&panels.isConnected&&!root.hasAttribute("customizing")&&root.getAttribute("inDOMFullscreen")!=="true"&&root.getAttribute("inFullscreen")!=="true"&&!root.hasAttribute("popup-window");}
  // Home is a primary destination, not a modal toggle.
  function isHomePlaceholder(tab,uri){
    if(!tab||tab.closing||tab.hasAttribute("zen-glance-tab"))return false;
    // Zen explicitly creates its permanent empty tab before selection.
    if(tab.hasAttribute("zen-empty-tab"))return true;
    if(tab.hasAttribute("pending")||tab.hasAttribute("discarded")||tab.hasAttribute("busy"))return false;
    try{
      const b=tab.linkedBrowser, spec=uri?.spec||b?.currentURI?.spec||"";
      const empty=/^about:(blank|newtab|home)(?:[?#].*)?$/i;
      if(!empty.test(spec)||b?.webProgress?.isLoadingDocument||
         (b?.userTypedValue&&!empty.test(b.userTypedValue)))return false;
      // An ordinary new browser begins with an INITIAL about:blank even
      // when its requested destination is a real URL. Never expose Home
      // until the parent-process WindowGlobal confirms a committed page.
      const global=b?.browsingContext?.currentWindowGlobal;
      return global?.isInitialDocument===false&&global.documentURI?.spec===spec;
    }catch{return false;}
  }
  function ensurePrimaryHome(){
    typeof win!=="undefined"&&win.__nocturneTrace?.("home.ensure",()=>(null),{sample:1800});
    if(open||switching||!allowed()||win.__oneplaneWorkspaceProjection||
       root.getAttribute("data-op-startup-ready")==="pending"||
       nativeSearchOpen(win.gURLBar)||!isHomePlaceholder(browser.selectedTab))return false;
    return show();
  }
  function leaveHome(focus=false){
    if(!open)return false;
    if(isHomePlaceholder(browser.selectedTab)){
      homeOnPlaceholder=true;finishSearchVisual();return false;
    }
    close(focus);return true;
  }
  function onSelectedTab(){
    typeof win!=="undefined"&&win.__nocturneTrace?.("home.selected",()=>({open}),{sample:1800});
    nativeCancelTab=null;
    if(switching||!allowed())return;
    if(isHomePlaceholder(browser.selectedTab)){
      if(open)homeOnPlaceholder=true;else ensurePrimaryHome();
    }else if(browser.selectedTab)close();
  }
  function restore(){if(!covered)return;covered=false;panels.removeAttribute("data-zr-home-covered");if(!oldInert)panels.removeAttribute("inert");host.removeAttribute("data-zr-home-host");}
  let startupRun=null,startupIconSources=new WeakMap();
  function finishStartupHome(expected=null,flush=true){
    if(expected&&startupRun!==expected)return;
    const run=startupRun;startupRun=null;
    if(run&&run.timeline.homeLease===run.lease)delete run.timeline.homeLease;
    for(const a of run?.effects||[]){
      if(run.timeline.mode==="bloom")try{a.finished.catch(()=>{});}catch{}
      try{a.cancel();}catch{}
    }
    if(startupRun)return;
    panel.removeAttribute("data-zh-startup");
    if(flush&&run?.dirty&&open&&!dead&&!searchToken)render();
  }
  function refreshHomeStructure(){
    if(!open||dead)return;
    if(startupRun){startupRun.dirty=true;return;}
    render();
  }
  function warmStartupIcons(){
    let total=0,pending=0;
    if(!open||!panel.hasAttribute("data-zh-startup"))return {total,pending};
    for(const img of content.querySelectorAll(".zh-tile img")){
      total++;
      const src=img.getAttribute("src");
      if(src&&startupIconSources.get(img)!==src){
        startupIconSources.set(img,src);try{img.decode?.()?.catch(()=>{});}catch{}
      }
      if(!img.complete||!img.naturalWidth)pending++;
    }
    return {total,pending};
  }
  function bloomHomeTargets(timeline){
    const plan=timeline.bloom;
    if(!plan||plan.scale!==timeline.scale||!Number.isFinite(timeline.finishLength)||
       !Number.isFinite(timeline.lateLimit)||timeline.finishLength<plan.end||
       timeline.lateLimit<timeline.finishLength||editing||adding)return null;
    // The actual rendered structure owns target identity. Reject an
    // unrecognized structure rather than fading a parent and child twice.
    const nodes=[...content.children],search=nodes.shift(),footer=nodes.pop(),pins=nodes.shift(),spaces=nodes.shift();
    if(nodes.length||!search?.matches(".zh-search")||!footer?.matches(".zh-footer")||
       !pins?.matches(".zh-section")||spaces&&!spaces.matches(".zh-section"))return null;
    const [pinLabel,pinGrid,...extraPins]=pins.children;
    const [spaceLabel,spaceGrid,...extraSpaces]=spaces?[...spaces.children]:[];
    if(!pinLabel?.matches("h3")||!pinGrid?.matches(".zh-pins")||extraPins.length||
       spaces&&(!spaceLabel?.matches("h3")||!spaceGrid?.matches(".zh-spaces")||
       extraSpaces.some(n=>!n.matches(".zh-workspace-pending")||!n.hidden)))return null;
    const pinNodes=[...pinGrid.children],spaceNodes=spaces?[...spaceGrid.children]:[];
    if(pinNodes.some(n=>!n.matches(".zh-pin,.zh-empty"))||
       pinNodes.some(n=>n.matches(".zh-empty"))&&pinNodes.length!==1||
       spaceNodes.some(n=>!n.matches(".zh-space")))return null;
    const s=startupBloomHomeSchedule(plan,pinNodes.length,spaceNodes.length);
    const targets=[{node:search,kind:"search",timing:s.search},{node:pinLabel,kind:"fade",timing:s.pinLabel}];
    pinNodes.forEach((node,i)=>targets.push({node,kind:node.matches(".zh-empty")?"fade":"card",timing:s.pins[i]}));
    if(spaces){
      targets.push({node:spaceLabel,kind:"fade",timing:s.workspaceLabel});
      spaceNodes.forEach((node,i)=>targets.push({node,kind:"card",timing:s.workspaces[i]}));
    }
    targets.push({node:footer,kind:"fade",timing:s.footer});
    return targets;
  }
  function playStartupHome(timeline){
    if(!open||dead||!panel.hasAttribute("data-zh-startup")||searchToken||!timeline)return null;
    if(startupRun)return startupRun.timeline===timeline?startupRun.lease:null;
    // A late native placeholder may still display Home normally, but
    // must not replay the startup wave after its scheduled stage began.
    const bloom=timeline.mode==="bloom";
    const elapsed=timeline.paused?0:timeline.elapsed?.()??Math.max(0,(win.performance?.now?.()??timeline.start)-timeline.start);
    // A stale explicit request must not ungate a successor's Home.
    if(bloom&&win.__nocturneStartupTimeline!==timeline)return null;
    if(timeline.closed||bloom&&(timeline.bloomPrepared||!timeline.paused||typeof timeline.observeEffect!=="function")||
       !timeline.paused&&elapsed>=timeline.home*timeline.scale){finishStartupHome();return null;}
    if(win.matchMedia("(prefers-reduced-motion: reduce)").matches||timeline.homeLease){finishStartupHome();return null;}
    const run={timeline,effects:[],lease:null,dirty:false,epochStarted:false};
    const exact=()=>startupRun===run&&!dead&&open&&(!bloom||win.__nocturneStartupTimeline===timeline);
    const lease={
      startupOutcomeVersion:1,
      resume(){if(bloom)throw Error("home-bloom-requires-epoch");if(startupRun===run)for(const a of run.effects)try{a.play();}catch{}},
      resumeAt(start){
        const ready=()=>startupRun===run&&!timeline.closed&&(!bloom||exact()&&timeline.paused===false);
        if(bloom&&(!ready()||run.epochStarted))throw Error("home-epoch-stale");
        if(bloom)run.epochStarted=true;
        for(const a of run.effects){
          if(!ready())throw Error("home-epoch-stale");
          start(a);
          if(bloom&&!ready())throw Error("home-epoch-stale");
        }
      },
      release(){finishStartupHome(run);}
    };
    run.lease=lease;startupRun=run;timeline.homeLease=lease;
    try{
      if(bloom){
        const targets=bloomHomeTargets(timeline);
        if(!targets||targets.length>256)throw Error("home-bloom-structure");
        const check=()=>{if(!exact()||timeline.closed||timeline.paused!==true)throw Error("home-bloom-stale");};
        const prepared=targets.map(({node,kind,timing})=>{
          check();const cs=win.getComputedStyle(node),opacity=Number(cs.opacity),r=node.getBoundingClientRect();
          const scale=cs.scale==="none"||/^1(?: 1){0,2}$/.test(cs.scale);
          if(node.getAnimations().length||cs.visibility!=="visible"||cs.display==="none"||
             !Number.isFinite(opacity)||opacity<=0||opacity>1||!r.width||!r.height||kind!=="fade"&&!scale||
             !Number.isFinite(timing.delay)||!Number.isFinite(timing.duration)||
             timing.delay<0||timing.duration<=0||timing.delay+timing.duration>timeline.finishLength+1e-7)
            throw Error("home-bloom-target");
          return {node,kind,timing,opacity,r,frames:startupBloomFrames(kind,opacity)};
        });
        const promises=[];
        for(const {node,frames,timing} of prepared){
          check();const a=node.animate(frames,{...timing,easing:"linear",fill:"both"});
          // animate() can synchronously retire this lease before returning.
          if(!exact()){try{a.finished.catch(()=>{});a.cancel();}catch{}throw Error("home-bloom-stale");}
          run.effects.push(a);const promise=a.finished;promises.push(promise);promise.catch(()=>{});
          timeline.observeEffect(a,"home",exact);
          check();a.pause();a.currentTime=0;check();
          if(a.timeline!==doc.timeline||a.playState!=="paused"||a.pending||a.playbackRate!==1||a.finished!==promise)
            throw Error("home-bloom-effect");
        }
        // Check the effective cascade at the initial pose and an interior
        // keyframe; never seek to finished during preparation.
        const near=(a,b,eps)=>Number.isFinite(a)&&Math.abs(a-b)<=eps;
        for(const fraction of [0,.58,0]){
          check();
          run.effects.forEach((a,i)=>{const t=prepared[i].timing;a.currentTime=fraction?t.delay+t.duration*fraction:0;});
          prepared.forEach(({node,kind,opacity,r,frames},i)=>{
            const a=run.effects[i],cs=win.getComputedStyle(node),box=node.getBoundingClientRect();
            // Search has an eased continuous scale; verify its start
            // exactly, and bound its interior geometry instead of assuming linear easing.
            const initial=Number(frames[0].scale??1);
            const scales=cs.scale==="none"?[1]:String(cs.scale).trim().split(/\s+/).map(Number);
            const effective=scales[0],alpha=Number(cs.opacity);
            const expectedAlpha=fraction===0?0:kind==="card"?opacity:kind==="fade"?opacity*fraction:null;
            const expectedScale=kind==="fade"?1:fraction===0?initial:kind==="card"?1:null;
            if(a.playState!=="paused"||a.pending||a.finished!==promises[i]||
               !Number.isFinite(alpha)||expectedAlpha!==null&&!near(alpha,expectedAlpha,.005)||
               expectedAlpha===null&&(alpha<=0||alpha>=opacity)||
               !scales.length||scales.length>2||scales.some(v=>!near(v,effective,.005))||
               expectedScale!==null&&!near(effective,expectedScale,.005)||
               expectedScale===null&&(effective<=initial||effective>=1)||
               !near(box.width,r.width*effective,.75)||!near(box.height,r.height*effective,.75)||
               !near(box.left+box.width/2,r.left+r.width/2,.75)||!near(box.top+box.height/2,r.top+r.height/2,.75))
              throw Error("home-bloom-computed-conflict");
          });
        }
        check();
        try{win.__nocturneTrace?.("home.bloom.acquire",{effects:run.effects.length,stageEnd:timeline.bloom.footer.end},{sample:Math.ceil(timeline.finishLength)+250});}catch{}
        check();return lease;
      }
      const nodes=[...content.children];
      for(const [i,node] of nodes.entries()){
        // Current owners use the original absolute delay against the
        // shared epoch. Legacy timelines retain their relative delay.
        const delay=Math.max(0,(timeline.home+Math.min(i*65,195))*timeline.scale-(timeline.startEffect?0:elapsed));
        const a=node.animate([{opacity:0,transform:"translateY(12px)"},{opacity:1,transform:"translateY(0)"}],{delay,duration:timeline.homeLength*timeline.scale,easing:"cubic-bezier(.2,.75,.25,1)",fill:"both"});
        run.effects.push(a);a.finished.catch(()=>{});
        timeline.observeEffect?.(a,"home",()=>startupRun===run&&!dead&&open);
        if(startupRun!==run){try{a.cancel();}catch{}return null;}
        if(timeline.closed){finishStartupHome(run);return null;}
        if(timeline.paused){a.pause();a.currentTime=0;}
        else if(timeline.startEffect)timeline.startEffect(a);
        if(startupRun!==run)return null;
        if(timeline.closed){finishStartupHome(run);return null;}
      }
      if(run.effects.length){
        // New Assembly owns the common boundary, including deferred
        // structural refresh. Legacy Assembly retains its local completion.
        if(!timeline.observeEffect)Promise.all(run.effects.map(a=>a.finished.catch(()=>{}))).then(()=>{if(startupRun===run)finishStartupHome(run);});
        return lease;
      }
    }catch(error){try{win.__nocturneTrace?.("home.startup.error",{name:error?.name},{flush:true});}catch{}}
    finishStartupHome(run);return null;
  }
  function resumeStartupHome(){startupRun?.lease.resume();}
  function stopMotion(){motion?.cancel();motion=null;finishStartupHome();}
  function close(restoreFocus=false){
    typeof win!=="undefined"&&win.__nocturneTrace?.("home.close",()=>({restoreFocus,open}),{sample:1800});
    if(!open)return;open=false;pendingWatch?.refresh();editing=false;adding=false;pinScrollTop=0;pinCustom=false;pinViewMode="home";panel.removeAttribute("data-zh-adding");dragId=null;startupHome=false;homeOnPlaceholder=false;finishSearchVisual();stopMotion();panel.hidden=true;restore();notify();
    if(restoreFocus)try{if(focusHome?.isConnected)focusHome.focus({preventScroll:true});else browser.selectedBrowser?.focus();}catch{}
    focusHome=null;
  }
  function navigate(item){
    try{win.openTrustedLinkIn(item.url,"tab");leaveHome();}catch(error){win.console.warn("[Zen Home] shortcut navigation",nocturneErrorClass(error));}
  }
  // Animate only the Home-origin native floating search session.
  function searchActive(){
    const bar=win.gURLBar;
    return Boolean(bar&&(bar.view?.isOpen||bar.hasAttribute("zen-newtab")||bar.hasAttribute("open")||bar.hasAttribute("focused")));
  }
  function nativeSearchOpen(bar){
    return Boolean(bar&&(bar.view?.isOpen||bar.hasAttribute("zen-newtab")||bar.hasAttribute("open")));
  }
  function finishSearchMotion(){
    if(searchFrame)win.cancelAnimationFrame(searchFrame);
    searchFrame=0;
    const a=searchMotion;searchMotion=null;
    searchBar?.removeAttribute("data-zr-home-search-motion");
    searchBar?.style?.removeProperty("--zh-reveal-height");
    searchBar?.style?.removeProperty("--zh-results-alpha");
    try{a?.cancel();}catch{}
  }
  function finishSearchVisual(){
    finishSearchMotion();
    if(searchTimer)win.clearTimeout(searchTimer);searchTimer=0;
    if(searchReturnFrame)win.cancelAnimationFrame(searchReturnFrame);searchReturnFrame=0;
    searchReturn?.remove();searchReturn=null;
    stopSearchSnapshot();
    for(const part of searchReturnParts)for(const key of ["alpha","base","clip","shift"])part.node.style.removeProperty("--zh-return-"+key);
    searchReturnParts=[];searchLastRect=null;
    if(searchBar){
      searchBar.removeAttribute("data-zr-home-search");searchBar.removeAttribute("data-zh-closing");
      for(const key of ["left","top","width","header","room"])searchBar.style?.removeProperty("--zh-search-"+key);
    }
    if(searchInput&&searchInput.getAttribute("placeholder")===searchSessionLabel){
      if(searchOriginalPlaceholder===null)searchInput.removeAttribute("placeholder");
      else searchInput.setAttribute("placeholder",searchOriginalPlaceholder);
    }
    searchInput=null;searchOriginalPlaceholder=null;searchSessionLabel=null;
    searchBar=null;searchToken=null;searchGeometry=null;searchLastHeight=0;searchCurrentHeight=0;searchClosing=false;
    panel.removeAttribute("data-zh-search");panel.removeAttribute("data-zh-search-ready");panel.removeAttribute("data-zh-return");content.removeAttribute("inert");
  }
  function homeSearchGeometry(from,viewportWidth,viewportHeight){
    if(!from||!(from.width>0)||!(from.height>0))return null;
    const w=Math.max(24,Number(viewportWidth)||1280),h=Math.max(24,Number(viewportHeight)||800);
    const width=Math.min(from.width,Math.max(1,w-24)),header=from.height;
    const left=Math.min(Math.max(12,from.left+(from.width-width)/2),Math.max(12,w-width-12));
    // Keep the original header position. Results scroll in the remaining
    // viewport instead of moving the entire interface on activation.
    const top=Math.min(Math.max(12,from.top),Math.max(12,h-header-16));
    return {left,top,width,header,room:Math.max(header,h-top-16)};
  }
  function applySearchGeometry(bar,geometry){
    if(!geometry)return;
    for(const [key,value] of Object.entries(geometry))bar.style?.setProperty("--zh-search-"+key,value+"px");
  }
  // Use an explicit bounded frame driver instead of depending on Gecko
  // interpolating a registered custom property. The only per-frame work
  // is writing two values to this one search surface; no layout reads.
  function revealValue(from,to,progress){
    const t=Math.max(0,Math.min(1,progress)),eased=t*t*(3-2*t);
    return from+(to-from)*eased;
  }
  function paintSearchHeight(bar,height,alpha){
    searchCurrentHeight=height;
    bar.style?.setProperty("--zh-reveal-height",height+"px");
    bar.style?.setProperty("--zh-results-alpha",String(Math.max(0,Math.min(1,alpha))));
  }
  function naturalSearchHeight(bar,geometry){
    // Remove the height constraint for this synchronous measurement only;
    // restore before painting. Unlike measuring the prepared header, this
    // includes the asynchronous native results and the actual box border.
    const phase=bar.getAttribute("data-zr-home-search-motion");
    bar.removeAttribute("data-zr-home-search-motion");
    const h=bar.getBoundingClientRect().height;
    if(phase)bar.setAttribute("data-zr-home-search-motion",phase);
    return Math.max(geometry.header,Math.min(geometry.room,h||geometry.header));
  }
  function animateSearchHeight(token,from,to,duration,closing,done){
    if(searchFrame)win.cancelAnimationFrame(searchFrame);
    searchFrame=0;
    const bar=searchBar;if(!bar)return;
    bar.setAttribute("data-zr-home-search-motion","run");
    const header=searchGeometry?.header||56;
    const alpha=h=>Math.min(1,Math.max(0,(h-header)/Math.max(120,Math.abs(to-from)*.55)));
    paintSearchHeight(bar,from,alpha(from));
    let start=null;
    const tick=now=>{
      searchFrame=0;
      if(!open||searchToken!==token||searchBar!==bar||searchClosing!==closing)return;
      if(start===null)start=now;
      const p=Math.min(1,(now-start)/duration),height=revealValue(from,to,p);
      paintSearchHeight(bar,height,alpha(height));
      if(p<1)searchFrame=win.requestAnimationFrame(tick);else done();
    };
    searchFrame=win.requestAnimationFrame(tick);
  }
  function startSearchMorph(token,geometry){
    if(!searchBar||!geometry||win.matchMedia("(prefers-reduced-motion: reduce)").matches){
      panel.setAttribute("data-zh-search-ready","");finishSearchMotion();return;
    }
    // Keep the source visible until the native floating box is ready.
    // Then reveal the results from the same header without a flash.
    let attempts=0;
    const step=()=>{
      searchFrame=0;
      if(!open||searchToken!==token||!searchBar||searchClosing)return;
      const bar=searchBar;
      if(bar.hasAttribute("open")&&bar.getAttribute("zen-floating-urlbar")==="true"){
        const target=naturalSearchHeight(bar,geometry);
        if(!panel.hasAttribute("data-zh-search-ready")){
          panel.setAttribute("data-zh-search-ready","");
          bar.setAttribute("data-zr-home-search-motion","run");
        }
        if(target>geometry.header+8){
          searchLastHeight=target;
          const reveal=(from,to,round)=>{
            animateSearchHeight(token,from,to,round?280:560,false,()=>{
              const latest=naturalSearchHeight(bar,geometry);
              searchLastHeight=latest;
              if(Math.abs(latest-to)>5&&round<2){reveal(to,latest,round+1);return;}
              finishSearchMotion();scheduleSearchSnapshot();
            });
          };
          reveal(geometry.header,target,0);return;
        }
      }
      if(++attempts<120&&nativeSearchOpen(bar))searchFrame=win.requestAnimationFrame(step);
      else{panel.setAttribute("data-zh-search-ready","");finishSearchMotion();}
    };
    searchFrame=win.requestAnimationFrame(step);
  }
  function search(){
    if(!open||searchToken||nativeSearchOpen(win.gURLBar))return;
    if(win.__nocturneOverlay&&!win.__nocturneOverlay.request("home-search"))return;
    if(panel.hasAttribute("data-zh-startup"))stopMotion();
    const bar=win.gURLBar;if(!bar)return;
    const source=content.querySelector(".zh-search");
    const from=source?.getBoundingClientRect();
    const geometry=homeSearchGeometry(from,win.innerWidth,win.innerHeight);
    const token={};searchToken=token;searchBar=bar;searchGeometry=geometry;
    searchLastHeight=searchCurrentHeight=geometry?.header||56;
    applySearchGeometry(bar,geometry);
    bar.setAttribute("data-zr-home-search","");
    if(geometry&&!win.matchMedia("(prefers-reduced-motion: reduce)").matches){
      paintSearchHeight(bar,geometry.header,0);
      bar.setAttribute("data-zr-home-search-motion","prepare");
    }
    panel.setAttribute("data-zh-search","");content.setAttribute("inert","");
    try{
      if(win.gZenUIManager?.handleNewTab(false,false,"tab",true,token)!==true){
        finishSearchVisual();win.console.warn("[Zen Home] floating search unavailable");return;
      }
      searchInput=bar.inputField||doc.getElementById("urlbar-input");
      if(searchInput){
        searchOriginalPlaceholder=searchInput.getAttribute("placeholder");
        searchSessionLabel=source?.querySelector("span")?.textContent||"Search or enter address";
        searchInput.setAttribute("placeholder",searchSessionLabel);
      }
      startSearchSnapshot();startSearchMorph(token,geometry);
    }catch(error){finishSearchVisual();win.console.warn("[Zen Home] native search",nocturneErrorClass(error));}
  }
  // Freeze the visual result tree only: no native custom elements,
  // event handlers, selectable IDs or interactive links.
  // Resolved longhands preserve one-sided separators and multi-layer
  // pseudo-elements. Mixed border shorthands were empty in the old copy.
  const snapshotProperties=("display position box-sizing width height min-width min-height max-width max-height top right bottom left margin-top margin-right margin-bottom margin-left padding-top padding-right padding-bottom padding-left border-top-width border-right-width border-bottom-width border-left-width border-top-style border-right-style border-bottom-style border-left-style border-top-color border-right-color border-bottom-color border-left-color border-top-left-radius border-top-right-radius border-bottom-right-radius border-bottom-left-radius outline-width outline-style outline-color outline-offset box-shadow background-color background-image background-size background-position background-position-x background-position-y background-repeat background-origin background-clip color opacity font-family font-size font-weight font-style font-stretch font-variant-numeric font-feature-settings line-height letter-spacing text-align text-overflow white-space overflow-x overflow-y overflow-wrap direction writing-mode align-items align-self align-content justify-items justify-self justify-content flex-direction flex-wrap flex-grow flex-shrink flex-basis order row-gap column-gap grid-template-columns grid-template-rows grid-auto-rows grid-auto-columns grid-auto-flow grid-row-start grid-row-end grid-column-start grid-column-end vertical-align object-fit object-position list-style-image fill stroke -moz-context-properties mask-image mask-size mask-position mask-repeat transform transform-origin scale translate visibility z-index scrollbar-width scrollbar-color").split(" ");
  function snapshotNow(){return win.performance?.now?.()??Date.now();}
  function snapshotReady(bar){
    // Zen removes zen-newtab before notifying Home of cancellation.
    // Preserve the last live grid instead of copying its teardown state.
    return Boolean(bar?.hasAttribute("zen-newtab")&&bar.view?.isOpen&&bar.getAttribute("zen-floating-urlbar")==="true");
  }
  function snapshotPseudoText(value,source){
    if(!value||value==="none"||value==="normal")return null;
    const attr=value.match(/^attr\(([^)]+)\)$/);
    return attr?source.getAttribute(attr[1])||"":value.replace(/^["']|["']$/g,"");
  }

  function searchLog(event,fields={}){
    win.console.info?.("[Zen Home] search "+event);
    win.__nocturneTrace?.("home.search."+event,fields,{sample:800});
  }
  // A card starts appearing when any of its height is uncovered, rather
  // than waiting for the top of the entire Pinned section to clear.
  function returnCardState(top,height,bottom,progress,finalBottom){
    const clamp=v=>Math.max(0,Math.min(1,v)),smooth=v=>{const t=clamp(v);return t*t*(3-2*t);};
    const h=Math.max(1,height),p=clamp(progress);
    const overlap=Math.max(0,bottom-top+3)-Math.max(0,finalBottom-top+3);
    const clip=Math.min(h,Math.max(0,overlap));
    const exposed=h-clip;
    const alpha=smooth(exposed/Math.min(h,38))*smooth(p/.48);
    return {alpha,clip,shift:6*(1-alpha)};
  }
  function prepareReturnParts(){
    // Measure all visible cards and headings once. Rows at equal y share
    // the same reveal timing automatically, including wrapped workspaces.
    const bounds=panel.getBoundingClientRect();
    const parts=[];
    for(const node of content.querySelectorAll(".zh-section h3,.zh-pin,.zh-pins .zh-empty,.zh-editbar,.zh-space,.zh-footer")){
      const rect=node.getBoundingClientRect();
      if(rect.height<=0||rect.bottom<=bounds.top||rect.top>=bounds.bottom)continue;
      // Footer itself is hidden by data-zh-search; its resting opacity is 1.
      const base=node.classList.contains("zh-footer")?1:Number.parseFloat(win.getComputedStyle(node).opacity);
      parts.push({node,top:rect.top,height:rect.height,base:Number.isFinite(base)?base:1,last:null});
    }
    return parts;
  }
  function paintReturnParts(parts,bottom,progress,finalBottom){
    for(const part of parts){
      const state=returnCardState(part.top,part.height,bottom,progress,finalBottom);
      const alpha=state.alpha.toFixed(3),clip=state.clip.toFixed(2)+"px",shift=state.shift.toFixed(2)+"px";
      const key=alpha+"/"+clip+"/"+shift;if(part.last===key)continue;part.last=key;
      part.node.style.setProperty("--zh-return-alpha",alpha);
      part.node.style.setProperty("--zh-return-clip",clip);
      part.node.style.setProperty("--zh-return-shift",shift);
    }
  }
  function freezeSearchResults(view,barRect){
    const rect=view.getBoundingClientRect();
    if(!(rect.width>0&&rect.height>0))return null;
    const scroll=[];let budget=900,pseudos=0,rails=0;
    function styleCopy(target,style){
      for(const key of snapshotProperties){
        const value=style.getPropertyValue(key);
        if(value)target.style.setProperty(key,value);
      }
      for(const key of ["animation","transition","pointer-events"])target.style.setProperty(key,"none","important");
    }
    function pseudo(source,target,which){
      const style=win.getComputedStyle(source,which),label=snapshotPseudoText(style.content,source);
      if(label===null||style.display==="none")return;
      const n=html("span");styleCopy(n,style);n.textContent=label;pseudos++;
      if(which==="::after"&&source.hasAttribute("data-zr-rail"))rails++;
      if(which==="::before")target.prepend(n);else target.append(n);
    }
    function copy(source){
      if(--budget<0)return null;
      const style=win.getComputedStyle(source);
      if(style.display==="none"||style.visibility==="collapse"||source.hidden)return null;
      const image=source.localName==="img"||source.localName==="image";
      const src=image&&(source.currentSrc||source.getAttribute("src"));
      const tag=src?"img":(!image&&["span","b","strong","em","small"].includes(source.localName)?source.localName:"div");
      const target=html(tag);styleCopy(target,style);
      if(src){target.src=src;target.alt="";target.draggable=false;target.style.setProperty("-moz-context-properties",style.getPropertyValue("-moz-context-properties")||"fill, stroke");}
      else if(image&&style.listStyleImage&&style.listStyleImage!=="none"){
        Object.assign(target.style,{backgroundImage:style.listStyleImage,backgroundSize:"contain",backgroundRepeat:"no-repeat",backgroundPosition:"center"});
        target.style.setProperty("-moz-context-properties",style.getPropertyValue("-moz-context-properties")||"fill, stroke");
      }
      if(!image){
        for(const child of source.childNodes){
          if(child.nodeType===3)target.append(doc.createTextNode(child.nodeValue||""));
          else if(child.nodeType===1){const n=copy(child);if(n)target.append(n);}
        }
        pseudo(source,target,"::before");pseudo(source,target,"::after");
      }
      if(source.scrollTop||source.scrollLeft)scroll.push({node:target,top:source.scrollTop,left:source.scrollLeft});
      return target;
    }
    const frozen=copy(view);if(!frozen||budget<0)return null;
    const holder=html("div","zh-return-results");
    Object.assign(holder.style,{left:(rect.left-barRect.left-1)+"px",top:(rect.top-barRect.top-1)+"px",width:rect.width+"px",height:rect.height+"px"});
    Object.assign(frozen.style,{position:"relative",inset:"auto",margin:"0",boxSizing:"border-box",width:rect.width+"px",height:rect.height+"px",opacity:"1"});
    holder.append(frozen);
    return {node:holder,scroll,rows:view.querySelectorAll(".urlbarView-row:not([hidden])").length,pseudos,rails,rect:{left:barRect.left,top:barRect.top,width:barRect.width,height:barRect.height}};
  }
  function captureSearchSnapshot(){
    if(!searchToken||!searchBar||searchClosing||searchReturn||!searchGeometry||
       !snapshotReady(searchBar))return;
    if(searchSnapshot&&!searchSnapshotDirty)return;
    try{
      const view=searchBar.querySelector?.(".urlbarView");
      if(!view?.querySelector(".urlbarView-row:not([hidden])"))return;
      const began=snapshotNow(),frozen=freezeSearchResults(view,searchBar.getBoundingClientRect());
      if(frozen?.rows){frozen.capturedAt=snapshotNow();frozen.captureMs=frozen.capturedAt-began;searchSnapshot=frozen;searchSnapshotDirty=false;}
    }catch(error){searchLog("snapshot-unavailable",{name:error?.name||"Error"});}
  }
  function scheduleSearchSnapshot(){
    if(!searchToken||searchClosing||searchReturn||!snapshotReady(searchBar))return;
    searchSnapshotDirty=true;
    if(searchSnapshotTimer)return;
    searchSnapshotTimer=win.setTimeout(()=>{searchSnapshotTimer=0;captureSearchSnapshot();},80);
  }
  function startSearchSnapshot(){
    if(win.matchMedia("(prefers-reduced-motion: reduce)").matches||!searchBar||!win.MutationObserver)return;
    const view=searchBar.querySelector?.(".urlbarView");if(!view)return;
    searchSnapshotView=view;view.addEventListener("scroll",scheduleSearchSnapshot,true);
    searchSnapshotObserver=new win.MutationObserver(records=>{
      // Identical attribute writes from a query refresh are not visual changes.
      if(records.some(r=>r.type!=="attributes"||r.oldValue!==r.target.getAttribute(r.attributeName)))scheduleSearchSnapshot();
    });
    searchSnapshotObserver.observe(view,{subtree:true,childList:true,characterData:true,attributes:true,attributeOldValue:true,attributeFilter:["hidden","src","selected","style","stale","data-zr-group","data-zr-cell","data-zr-first","data-zr-rail","data-zr-column","data-zr-top","data-zr-narrow","data-zr-smart-grid","data-zr-timeline"]});
    scheduleSearchSnapshot();
  }
  function stopSearchSnapshot(){
    if(searchSnapshotTimer)win.clearTimeout(searchSnapshotTimer);searchSnapshotTimer=0;
    searchSnapshotObserver?.disconnect();searchSnapshotObserver=null;
    searchSnapshotView?.removeEventListener("scroll",scheduleSearchSnapshot,true);searchSnapshotView=null;
    searchSnapshot=null;searchSnapshotDirty=true;
  }
  function finishNativeCancel(){
    const bar=searchBar;
    // Use Zen's own session closure; do not replace its provider or patch
    // its methods. Native cancellation still runs even if animation fails.
    try{
      if(typeof bar?._zenHandleUrlbarClose==="function")bar._zenHandleUrlbarClose(false,false);
      else bar?.view?.close();
      bar?.blur?.();
    }catch(error){win.console.warn("[Zen Home] search cancel",nocturneErrorClass(error));finishSearchVisual();}
  }
  function cancelHomeSearch(reason="escape"){
    if(!searchToken||!searchBar||!searchGeometry||searchClosing||!nativeSearchOpen(searchBar))return false;
    if(win.matchMedia("(prefers-reduced-motion: reduce)").matches)return false;
    if(searchBar.getAttribute("zen-floating-urlbar")!=="true")return false;
    captureSearchSnapshot();
    animateSearchReturn(reason,true);
    if(!searchReturn)return false;
    finishNativeCancel();
    return true;
  }
  function animateSearchReturn(reason="native-close",live=false){
    if(!searchToken||searchReturn)return;
    if(!searchGeometry||win.matchMedia("(prefers-reduced-motion: reduce)").matches){finishSearchVisual();return;}
    const handoffStarted=snapshotNow(),g=searchGeometry,bar=searchBar;
    captureSearchSnapshot();
    const measured=live?bar?.getBoundingClientRect():(searchLastRect||searchSnapshot?.rect);
    const height=Math.max(g.header,Math.min(g.room,measured?.height||searchLastHeight||g.header));
    const startBox={left:measured?.left??g.left,top:measured?.top??g.top,width:measured?.width||g.width};
    const resultAlpha=live?Number.parseFloat(win.getComputedStyle(bar.querySelector(".urlbarView")||bar).opacity):1;
    const initialAlpha=Math.max(0,Math.min(1,Number.isFinite(resultAlpha)?resultAlpha:1));
    searchClosing=true;
    // Keep a dedicated close gate even when Zen removes its floating
    // attribute. Never expose the resting native geometry mid-handoff.
    bar?.setAttribute("data-zh-closing","");
    finishSearchMotion();
    if(searchTimer)win.clearTimeout(searchTimer);searchTimer=0;
    if(bar)bar.setAttribute("data-zr-home-search-motion","closed");
    const shell=html("div");shell.id="zen-home-search-return";shell.setAttribute("aria-hidden","true");shell.setAttribute("inert","");
    const source=content.querySelector(".zh-search"),header=html("div","zh-return-header");
    const icon=source?.querySelector("svg")?.cloneNode(true);
    if(icon)header.append(icon);
    header.append(html("span","",source?.querySelector("span")?.textContent||"Search or enter address"));shell.append(header);
    const dest=source?.getBoundingClientRect()||{left:g.left,top:g.top,width:g.width,height:g.header};
    Object.assign(shell.style,{left:startBox.left+"px",top:startBox.top+"px",width:startBox.width+"px",height:height+"px"});
    header.style.height=Math.max(0,g.header-2)+"px";
    const frozen=searchSnapshot;
    if(frozen){frozen.node.style.opacity=String(initialAlpha);shell.append(frozen.node);}
    root.append(shell);searchReturn=shell;
    if(frozen)for(const s of frozen.scroll){s.node.scrollTop=s.top;s.node.scrollLeft=s.left;}
    searchReturnParts=prepareReturnParts();
    const parts=searchReturnParts,finalBottom=dest.top+dest.height;
    for(const part of parts)part.node.style.setProperty("--zh-return-base",String(part.base));
    // Remove completed entry animations so they cannot replay at handoff.
    for(const node of content.querySelectorAll("[data-zh-enter]"))node.removeAttribute("data-zh-enter");
    paintReturnParts(parts,startBox.top+height,0,finalBottom);
    panel.setAttribute("data-zh-search-ready","");panel.setAttribute("data-zh-return","");
    const duration=height>dest.height+8?460:180;
    searchLog("close-start",{reason,rows:frozen?.rows||0,rails:frozen?.rails||0,pseudos:frozen?.pseudos||0,height:Math.round(height),header:Math.round(dest.height),duration,parts:parts.length,snapshotDirty:searchSnapshotDirty,snapshotAge:frozen?Math.round(snapshotNow()-frozen.capturedAt):null,captureMs:frozen?Math.round(frozen.captureMs):null,handoffMs:Math.round(snapshotNow()-handoffStarted)});
    const token=searchToken;let start=null,previous=null,maxFrameGap=0,firstFrameDelay=0;
    const moveTop=Math.abs(startBox.top-dest.top)>.1,moveLeft=Math.abs(startBox.left-dest.left)>.1,moveWidth=Math.abs(startBox.width-dest.width)>.1;
    const tick=now=>{
      searchReturnFrame=0;if(!open||searchToken!==token||searchReturn!==shell)return;
      if(start===null){start=now;firstFrameDelay=Math.max(0,snapshotNow()-handoffStarted);}
      if(previous!==null)maxFrameGap=Math.max(maxFrameGap,now-previous);previous=now;
      const p=Math.min(1,(now-start)/duration),h=revealValue(height,dest.height,p),top=revealValue(startBox.top,dest.top,p);
      shell.style.height=h+"px";
      if(moveTop)shell.style.top=top+"px";
      if(moveLeft)shell.style.left=revealValue(startBox.left,dest.left,p)+"px";
      if(moveWidth)shell.style.width=revealValue(startBox.width,dest.width,p)+"px";
      if(frozen)frozen.node.style.opacity=String(initialAlpha*Math.min(1,Math.max(0,(h-dest.height)/80)));
      paintReturnParts(parts,top+h,p,finalBottom);
      if(p<1)searchReturnFrame=win.requestAnimationFrame(tick);
      else{
        searchLog("close-finish",{reason,rows:frozen?.rows||0,elapsed:Math.round(now-start),maxFrameGap:Math.round(maxFrameGap),firstFrameDelay:Math.round(firstFrameDelay)});
        finishSearchVisual();content.querySelector(".zh-search")?.focus({preventScroll:true});
      }
    };
    searchReturnFrame=win.requestAnimationFrame(tick);
  }
  function onSearchClosed(event){
    const detail=event.detail;
    if(!open){
      // A result pick or tab switch is navigation, not a Home request.
      // Zen can dispatch this before the native view has finished closing.
      nativeCancelTab=null;
      if(detail&&!detail.onElementPicked&&!detail.onSwitch&&isHomePlaceholder(browser.selectedTab)){
        nativeCancelTab=browser.selectedTab;
        if(ensurePrimaryHome())nativeCancelTab=null;
      }
      return;
    }
    if(!searchToken||detail?.closeSeq!==searchToken.id)return;
    if(detail.onElementPicked||detail.onSwitch)leaveHome();
    else animateSearchReturn("native-event");
  }
  function observeSearch(){
    if(!searchToken||!searchBar){
      if(!open&&nativeCancelTab&&nativeCancelTab===browser.selectedTab&&!nativeSearchOpen(win.gURLBar)){
        nativeCancelTab=null;ensurePrimaryHome();
      }
      return;
    }
    if(searchReturn)return;
    if(nativeSearchOpen(searchBar)){
      if(searchTimer)win.clearTimeout(searchTimer);searchTimer=0;return;
    }
    // MutationObserver already runs after the native synchronous close
    // event. Do not leave an extra two-frame gap before the return shell.
    if(searchToken&&!nativeSearchOpen(searchBar))animateSearchReturn("native-observer");
  }
  function move(id,targetId){
    const items=load(),from=items.findIndex(x=>x.id===id),to=items.findIndex(x=>x.id===targetId);
    if(from<0||to<0||from===to)return;const [item]=items.splice(from,1);items.splice(to,0,item);save(items);
  }
  // Rank actual toolbar bookmarks first, then the most recently used
  // visible native tabs. No history query, network requests or mod dependency.
  function recommendedPins(bookmarks,tabs,items,limit=16){
    const seen=new Set(items.map(item=>safeURL(item.url)).filter(Boolean)),result=[];
    const add=(entry,source)=>{
      if(result.length>=limit)return;
      const url=safeURL(entry?.url);
      if(!url||seen.has(url))return;
      seen.add(url);
      result.push({url,title:String(entry.title||new win.URL(url).hostname).trim().slice(0,80)||new win.URL(url).hostname,source});
    };
    for(const entry of bookmarks)add(entry,"Bookmark");
    for(const entry of [...tabs].sort((a,b)=>(Number(b.last)||0)-(Number(a.last)||0)))add(entry,"Open tab");
    return result;
  }
  function collectRecommendations(items){
    const bookmarks=[],tabs=[];
    // Native Places toolbarbuttons already contain the bookmark's title
    // and URI, including items hidden by overflow. Skip folders/separators.
    for(const node of doc.getElementById("PlacesToolbarItems")?.children||[]){
      try{
        if(!node.matches("toolbarbutton.bookmark-item")||node.hasAttribute("container"))continue;
        const place=node._placesNode;
        const url=place?.uri||node.getAttribute("targetURI");
        if(url)bookmarks.push({url,title:place?.title||node.getAttribute("label")||node.label});
      }catch{}
    }
    for(const tab of Array.from(browser.visibleTabs||browser.tabs||[])){
      try{
        if(tab.closing||tab.hidden||tab.hasAttribute("zen-empty-tab"))continue;
        const url=tab.linkedBrowser?.currentURI?.spec;
        const lazy=tab.hasAttribute("pending")||tab.hasAttribute("discarded");
        const target=lazy?(win.SessionStore?.getLazyTabValue?.(tab,"url")||url):url;
        tabs.push({url:target,title:tab.label||tab.getAttribute("label"),last:tab===browser.selectedTab?Number.MAX_SAFE_INTEGER:Number(tab.lastSeenActive||tab.lastAccessed)||0});
      }catch{}
    }
    return recommendedPins(bookmarks,tabs,items);
  }
  function addPin(rawURL,rawTitle){
    const url=safeURL(rawURL),items=load();
    if(!url)return "Enter a valid HTTP or HTTPS URL.";
    if(items.length>=100)return "Shortcut limit reached.";
    if(items.some(i=>i.url===url))return "This site is already pinned.";
    const title=String(rawTitle||"").trim().slice(0,80)||new win.URL(url).hostname;
    let id;try{id=services.uuid.generateUUID().toString();}catch{id=String(Date.now())+"-"+Math.random().toString(36).slice(2);}
    save([...items,{id,type:"shortcut",title,url}]);
    return "";
  }
  // Keep a native two-row scroll viewport; preserve its position on
  // preference-driven re-render and when visiting the custom form.
  function leavePinPicker(){
    adding=false;pinScrollTop=0;pinCustom=false;render();
    content.querySelector(".zh-add-pin")?.focus({preventScroll:true});
  }
  function restorePinScroll(grid,top){
    if(!grid)return 0;
    const max=Math.max(0,grid.scrollHeight-grid.clientHeight);
    grid.scrollTop=Math.min(max,Math.max(0,Number(top)||0));
    return grid.scrollTop;
  }
  function addForm(parent){
    const picker=html("div","zh-picker"),head=html("div","zh-picker-head"),error=html("div","zh-error");
    error.setAttribute("role","status");
    const count=html("span","zh-picker-count",load().length+" pinned");
    head.append(html("h3","",pinCustom?"Add a custom URL":"Recommended"),count);
    picker.append(head);
    if(pinCustom){
      const form=html("form","zh-form"),url=html("input"),name=html("input"),submit=html("button","zh-small","Add"),actions=html("div","zh-custom-actions");
      url.placeholder="https://example.com";url.setAttribute("aria-label","Website URL");url.required=true;url.maxLength=2048;
      name.placeholder="Name (optional)";name.setAttribute("aria-label","Optional shortcut name");name.maxLength=80;
      submit.type="submit";
      actions.append(button("zh-small","Back",()=>{pinCustom=false;render();content.querySelector(".zh-suggestion, .zh-custom-link")?.focus({preventScroll:true});}),submit);
      form.append(url,name,actions);
      form.addEventListener("submit",e=>{
        e.preventDefault();if(!open||!editing||!adding)return;
        const message=addPin(url.value,name.value);
        if(message){error.textContent=message;return;}
        // Return to recommendations after a successful manual addition.
        pinCustom=false;render();content.querySelector(".zh-suggestion, .zh-custom-link")?.focus({preventScroll:true});
      });
      picker.append(form,error);parent.append(picker);return;
    }
    const grid=html("div","zh-recommendations"),suggestions=collectRecommendations(load());
    grid.setAttribute("role","region");grid.setAttribute("aria-label","Recommended sites");grid.tabIndex=0;
    picker.append(html("p","zh-picker-note","Choose a bookmark or open tab to pin it instantly."),grid,error);
    if(!suggestions.length)grid.append(html("div","zh-empty","No more recommended sites."));
    for(const [index,item] of suggestions.entries()){
      const row=button("zh-suggestion","",()=>{
        if(!open||!editing||!adding)return;
        const message=addPin(item.url,item.title);
        if(message){error.textContent=message;return;}
        // The preference observer replaces the old grid synchronously.
        // Restore focus near the removed item, not at the beginning.
        const rows=content.querySelectorAll(".zh-suggestion");
        (rows[Math.min(index,rows.length-1)]||content.querySelector(".zh-custom-link"))?.focus({preventScroll:true});
      });
      row.title=item.url;row.setAttribute("aria-label","Pin "+item.title);
      const img=html("img");img.alt="";img.draggable=false;setHomeIcon(img,item.url,23);
      const copy=html("span","zh-suggestion-copy"),domain=new win.URL(item.url).hostname;
      copy.append(html("span","",item.title),html("small","",domain+" · "+item.source));
      row.append(img,copy,html("span","zh-suggestion-plus","+"));grid.append(row);
    }
    const actions=html("div","zh-picker-actions");
    actions.append(button("zh-small zh-custom-link","Add a custom URL",()=>{pinCustom=true;render();content.querySelector(".zh-form input")?.focus({preventScroll:true});}));
    picker.append(actions);parent.append(picker);
  }
  // Shared Home's workspace controls are keyed by native identity. A switch
  // changes their selection, not the stable search and pinned shortcuts.
  function refreshWorkspaceSelection(){
    if(!open||dead)return;
    const manager=win.gZenWorkspaces;
    const buttons=Array.from(content.querySelectorAll(".zh-space[data-zh-workspace-id]"));
    let spaces=[];try{spaces=(manager?.getWorkspaces?.()||[]).filter(ws=>ws?.uuid);}catch{return;}
    if(buttons.length!==spaces.length||buttons.some((b,i)=>b.getAttribute("data-zh-workspace-id")!==spaces[i].uuid||b.getAttribute("data-zh-workspace-name")!==String(spaces[i].name||"Workspace"))){refreshHomeStructure();return;}
    for(const b of buttons){
      if(b.getAttribute("data-zh-workspace-id")===manager.activeWorkspace)b.setAttribute("aria-current","true");
      else b.removeAttribute("aria-current");
    }
  }
  function switchHomeWorkspace(manager,id){
    typeof win!=="undefined"&&win.__nocturneTrace?.("home.workspace.request",()=>({hasTransition:!!win.__zenRefinedWorkspaceTransition}),{sample:1800});
    return requestWorkspaceSwitch(win,manager,id,"home",()=>!dead&&win.gZenWorkspaces===manager);
  }
  function render(){
    if(!open||dead||searchToken)return;
    // Explicit interaction may replace the children immediately. Passive
    // updates use refreshHomeStructure and coalesce under the startup lease.
    if(startupRun)finishStartupHome(startupRun,false);
    const oldGrid=content.querySelector(".zh-recommendations");
    if(adding&&oldGrid)pinScrollTop=oldGrid.scrollTop;
    const nextMode=adding?(pinCustom?"custom-url":"add-pin"):(editing?"customize":"home");
    const animateMode=nextMode!==pinViewMode;pinViewMode=nextMode;
    content.replaceChildren();
    panel.toggleAttribute("data-zh-adding",adding);
    if(adding){
      const section=html("section","zh-section");if(animateMode)section.setAttribute("data-zh-enter","");section.append(html("h3","","Add Pin"));addForm(section);content.append(section);
    }else{
    const searchButton=button("zh-search","",search),svg=doc.createElementNS("http://www.w3.org/2000/svg","svg");
    svg.setAttribute("viewBox","0 0 24 24");svg.setAttribute("fill","none");svg.setAttribute("stroke","currentColor");svg.setAttribute("stroke-width","1.6");
    for(const [tag,attrs] of [["circle",{cx:10.5,cy:10.5,r:6.5}],["path",{d:"m16 16 4 4"}]]){const node=doc.createElementNS("http://www.w3.org/2000/svg",tag);for(const [k,v] of Object.entries(attrs))node.setAttribute(k,v);svg.append(node);}
    searchButton.append(svg,html("span","","Search or enter address"));if(animateMode)searchButton.setAttribute("data-zh-enter","");content.append(searchButton);
    const section=html("section","zh-section"),grid=html("div","zh-pins"),items=load();section.append(html("h3","","Pinned"),grid);if(animateMode)section.setAttribute("data-zh-enter","");
    if(!items.length)grid.append(html("div","zh-empty",editing?"Add a pinned site to get started.":"Click Customize Home to add your first pinned site."));
    for(const [index,item] of items.entries()){
      const card=html("div","zh-pin"),tile=button("zh-tile","",()=>{if(!editing)navigate(item);});
      tile.title=item.title;const img=html("img");img.alt="";img.draggable=false;setHomeIcon(img,item.url,30);
      tile.append(img,html("span","",item.title));card.append(tile);
      if(editing){
        tile.disabled=true;
        const remove=button("zh-remove","×",()=>save(load().filter(x=>x.id!==item.id)));remove.setAttribute("aria-label","Remove "+item.title);card.append(remove);
        const order=html("div","zh-order");
        if(index>0){const prev=button("zh-small","←",()=>move(item.id,items[index-1].id));prev.setAttribute("aria-label","Move "+item.title+" left");order.append(prev);}
        if(index<items.length-1){const next=button("zh-small","→",()=>move(item.id,items[index+1].id));next.setAttribute("aria-label","Move "+item.title+" right");order.append(next);}
        card.append(order);card.draggable=true;
        card.addEventListener("dragstart",e=>{dragId=item.id;e.dataTransfer.setData("application/x-zen-home-shortcut",item.id);e.dataTransfer.effectAllowed="move";e.stopPropagation();});
        card.addEventListener("dragover",e=>{if(!dragId)return;e.preventDefault();e.stopPropagation();card.setAttribute("data-drop","");});
        card.addEventListener("dragleave",()=>card.removeAttribute("data-drop"));
        card.addEventListener("dragend",e=>{dragId=null;card.removeAttribute("data-drop");e.stopPropagation();});
        card.addEventListener("drop",e=>{if(!dragId)return;e.preventDefault();e.stopPropagation();const id=dragId;dragId=null;move(id,item.id);});
      }
      grid.append(card);
    }
    if(editing){
      const editbar=html("div","zh-editbar");editbar.append(button("zh-small zh-add-pin","+ Add Pin",()=>{adding=true;pinScrollTop=0;pinCustom=false;render();content.querySelector(".zh-suggestion, .zh-custom-link")?.focus({preventScroll:true});}));section.append(editbar);
    }
    content.append(section);
    }
    const manager=win.gZenWorkspaces;
    if(manager?.workspaceEnabled&&typeof manager.getWorkspaces==="function"){
      const spaces=html("section","zh-section zh-workspace-section"),list=html("div","zh-spaces");spaces.append(html("h3","","Workspaces"),list);
      let workspaces=[];try{workspaces=manager.getWorkspaces()||[];}catch{}
      for(const ws of workspaces){
        if(!ws?.uuid)continue;
        const b=button("zh-space","",async()=>{
          if(switching||manager.activeWorkspace===ws.uuid)return;
          if(workspaceCommandState(win).blocked){pendingWatch?.refresh();return;}
          switching=true;
          pendingWatch?.refresh();
          try{await switchHomeWorkspace(manager,ws.uuid);}catch(error){win.console.warn("[Zen Home] workspace",nocturneErrorClass(error));}
          finally{switching=false;if(open){refreshWorkspaceSelection();pendingWatch?.refresh();}}
        });
        b.setAttribute("data-zh-workspace-id",ws.uuid);b.setAttribute("data-zh-workspace-name",String(ws.name||"Workspace"));
        b.append(html("span","","◦"),html("span","",String(ws.name||"Workspace")));
        if(manager.activeWorkspace===ws.uuid)b.setAttribute("aria-current","true");list.append(b);
      }
      if(list.childElementCount){
        const pending=html("p","zh-workspace-pending zh-picker-note");pending.setAttribute("role","status");pending.setAttribute("aria-live","polite");pending.hidden=true;
        spaces.append(pending);content.append(spaces);
      }
    }
    const footer=html("div","zh-footer");footer.append(button("zh-small",editing?"Done":"Customize Home",()=>{if(adding){leavePinPicker();return;}editing=!editing;render();}));content.append(footer);
    const grid=content.querySelector(".zh-recommendations");
    if(grid)pinScrollTop=restorePinScroll(grid,pinScrollTop);
    pendingWatch?.refresh();
  }
  function show(startup=false){
    typeof win!=="undefined"&&win.__nocturneTrace?.("home.show",()=>({startup,open}),{sample:1800});
    if(open||!allowed())return open;focusHome=doc.activeElement;startupHome=startup;homeOnPlaceholder=isHomePlaceholder(browser.selectedTab);
    try{
      // End an existing native startup search through its token-aware handler.
      const bar=win.gURLBar;
      if(startup&&bar?.hasAttribute("zen-newtab"))bar._zenHandleUrlbarClose?.();
      bar?.view?.close();bar?.blur();
      oldInert=panels.hasAttribute("inert");covered=true;host.setAttribute("data-zr-home-host","");panels.setAttribute("data-zr-home-covered","");panels.setAttribute("inert","");
      const staged=(startup||win.__nocturneLayoutStartup?.initial===true)&&!!root.getAttribute("data-zr-startup-phase")&&!win.matchMedia("(prefers-reduced-motion: reduce)").matches;
      if(staged)panel.setAttribute("data-zh-startup","");
      panel.hidden=false;open=true;render();notify();
      if(staged){
        if(win.__nocturneStartupTimeline)playStartupHome(win.__nocturneStartupTimeline);
      }else if(!win.matchMedia("(prefers-reduced-motion: reduce)").matches&&typeof content.animate==="function"){
        motion=content.animate([{opacity:0,transform:"translateY(9px)"},{opacity:1,transform:"translateY(0)"}],{duration:300,easing:"cubic-bezier(.2,.75,.25,1)"});
        const a=motion;a.finished.then(()=>{if(motion===a)motion=null;},()=>{});
      }
      // Startup is not a keyboard navigation action. Avoid a native
      // focus outline flashing before the search field enters.
      if(!startup&&!staged)content.querySelector(".zh-search")?.focus({preventScroll:true});return true;
    }catch(error){close();restore();win.console.warn("[Zen Home] open",nocturneErrorClass(error));return false;}
  }
  function destroy(){
    if(dead)return;close();dead=true;for(const fn of cleanups.splice(0))try{fn();}catch{}
    panel.remove();style.remove();if(win[KEY]===registry)delete win[KEY];
  }
  const registry={apiVersion:1,startupLeaseVersion:1,startupOutcomeVersion:1,startupBloomVersion:1,warmStartupIcons,playStartup:playStartupHome,resumeStartup:resumeStartupHome,finishStartup:finishStartupHome,acquire(){
    if(dead)return null;const lease={listeners:new Set()};leases.add(lease);let released=false;
    return {get open(){return !released&&open;},show:()=>!released&&show(),close:(focus=false)=>{if(!released)leaveHome(focus);},
      showOnStartup(){
        if(released||win[STARTUP])return false;
        if(show(true)){win[STARTUP]=true;return true;}return false;
      },
      // Legacy lease name remains compatible, but no longer hides Home.
      toggle:()=>!released&&show(),
      subscribe(fn){if(released)return()=>{};lease.listeners.add(fn);fn(open);return()=>lease.listeners.delete(fn);},
      release(){if(released)return;released=true;lease.listeners.clear();leases.delete(lease);if(!leases.size)destroy();}};
  }};
  try{
    root.append(style);host.append(panel);
    pendingWatch=watchWorkspaceCommand(win,()=>open&&!dead,updateWorkspacePending);cleanups.push(()=>pendingWatch.dispose());
    // Idle Home is a destination, not an exclusive overlay. Only its
    // native search handoff owns this registration.
    let unregisterOverlay=()=>{};
    const bindOverlay=()=>{
      unregisterOverlay();
      unregisterOverlay=win.__nocturneOverlay?.register("home-search",{
        priority:30,isActive:()=>!dead&&!!(searchToken||searchReturn),
        canYield:()=>false
      })||(()=>{});
    };
    listen(win,"Nocturne:OverlayReady",bindOverlay);cleanups.push(()=>unregisterOverlay());bindOverlay();
    const observer={observe(){if(open)refreshHomeStructure();}};prefs.addObserver(PREF,observer);cleanups.push(()=>prefs.removeObserver(PREF,observer));
    listen(browser.tabContainer,"TabSelect",onSelectedTab);
    // A selected, intentionally blank ordinary tab may finish loading
    // after TabSelect. Recheck only the selected tab, never background opens.
    listen(browser.tabContainer,"TabAttrModified",e=>{
      if(!open&&e.target===browser.selectedTab&&e.detail?.changed?.some?.(name=>name==="busy"||name==="pending"||name==="discarded"||name==="zen-empty-tab"))ensurePrimaryHome();
    });
    listen(win,"ZenWorkspaceDataChanged",()=>{if(open&&!switching)refreshHomeStructure();});
    listen(win,"ZenWorkspacesUIUpdate",()=>{if(open&&!switching){refreshWorkspaceSelection();pendingWatch?.refresh();}});
    listen(win,"ZenURLBarClosed",onSearchClosed);
    listen(win,"resize",()=>{
      if(!searchToken||!searchBar)return;
      if(searchClosing||searchReturn){finishNativeCancel();finishSearchVisual();return;}
      panel.setAttribute("data-zh-search-ready","");finishSearchMotion();
      const from=content.querySelector(".zh-search")?.getBoundingClientRect();
      searchGeometry=homeSearchGeometry(from,win.innerWidth,win.innerHeight);
      applySearchGeometry(searchBar,searchGeometry);scheduleSearchSnapshot();
    });
    if(win.gURLBar){
      // Remember the latest painted height for native blur/popover teardown.
      if(typeof win.ResizeObserver==="function"){
        const sizes=new win.ResizeObserver(()=>{
          if(searchToken&&!searchClosing&&!searchReturn&&snapshotReady(searchBar)){
            const rect=searchBar.getBoundingClientRect();
            if(rect.height>0){searchLastHeight=rect.height;searchLastRect=rect;}
          }
        });sizes.observe(win.gURLBar);cleanups.push(()=>sizes.disconnect());
      }
      const searchObserver=new win.MutationObserver(observeSearch);
      searchObserver.observe(win.gURLBar,{attributes:true,attributeFilter:["open","zen-newtab","focused","zen-floating-urlbar","popover-open"]});
      cleanups.push(()=>searchObserver.disconnect());
    }
    // Explicit native navigation still leaves Home. Background restore does not.
    listen(win,"command",e=>{
      if(!open)return;
      if(e.target?.closest?.("#PlacesToolbarItems .bookmark-item:not([container]),#OtherBookmarks .bookmark-item:not([container]),#back-button,#forward-button,#reload-button,#stop-reload-button"))leaveHome();
    },true);
    listen(win,"keydown",e=>{
      if(e.key==="Escape"&&(e.defaultPrevented||win.__nocturneOverlay?.allowsEscape("home-search",e)===false))return;
      if(open&&e.key==="Escape"&&searchReturn){e.preventDefault();e.stopImmediatePropagation();return;}
      if(open&&e.key==="Escape"&&searchToken&&!searchReturn){
        // Do not swallow Escape belonging to an autocomplete sub-popup or
        // search mode picker; ordinary Home search cancellation folds first.
        if(!e.defaultPrevented&&!e.altKey&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&
           !searchBar?.searchMode&&!searchBar?.hasAttribute("has-popup-open")&&
           (searchClosing||cancelHomeSearch("escape"))){e.preventDefault();e.stopImmediatePropagation();return;}
      }
      if(open&&e.key==="Escape"&&!searchActive()){e.preventDefault();e.stopPropagation();if(adding&&pinCustom){pinCustom=false;render();content.querySelector(".zh-suggestion, .zh-custom-link")?.focus({preventScroll:true});}else if(adding){leavePinPicker();}else if(editing){editing=false;render();}else content.querySelector(".zh-search")?.focus({preventScroll:true});}},true);
    listen(win,"pointerdown",e=>{
      if(searchToken&&!searchClosing&&!searchReturn&&searchBar&&!searchBar.contains?.(e.target))captureSearchSnapshot();
    },true);
    listen(win,"focusout",e=>{
      if(searchToken&&!searchClosing&&!searchReturn&&searchBar?.contains?.(e.target))captureSearchSnapshot();
    },true);
    listen(panel,"pointerdown",e=>{if(e.target===panel&&searchToken&&!searchClosing&&cancelHomeSearch("home-background")){e.preventDefault();e.stopPropagation();}},true);
    const stateObserver=new win.MutationObserver(()=>{
      if(panel.hasAttribute("data-zh-startup")&&!root.hasAttribute("data-zr-startup-phase"))finishStartupHome();
      if(open&&!allowed())close();else if(!open)ensurePrimaryHome();
    });
    stateObserver.observe(root,{attributes:true,attributeFilter:["customizing","inDOMFullscreen","inFullscreen","popup-window","data-op-startup-ready","data-zr-startup-phase"]});cleanups.push(()=>stateObserver.disconnect());
    listen(win,"unload",destroy,{once:true});
    const progress={onLocationChange(b,wp,uri){
      if(switching||b!==browser.selectedBrowser||!wp?.isTopLevel)return;
      if(isHomePlaceholder(browser.selectedTab,uri)){
        if(open)homeOnPlaceholder=true;else ensurePrimaryHome();
        return;
      }
      if(open&&(!startupHome||homeOnPlaceholder)&&!searchActive())leaveHome();
    },onStateChange(b,wp,request,flags){
      // nsIWebProgressListener STATE_STOP | STATE_IS_NETWORK.
      // The committed WindowGlobal can arrive after onLocationChange.
      if(!open&&!switching&&b===browser.selectedBrowser&&wp?.isTopLevel&&
         (flags&0x00000010)&&(flags&0x00040000))ensurePrimaryHome();
    }};
    if(typeof browser.addTabsProgressListener==="function"){browser.addTabsProgressListener(progress);cleanups.push(()=>browser.removeTabsProgressListener(progress));}
    win[KEY]=registry;const lease=registry.acquire();ensurePrimaryHome();return lease;
  }catch(error){destroy();win.console.warn("[Zen Home] init",nocturneErrorClass(error));return null;}
}

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
// The horizontal strip is a view of native tabs, not a second tab session.
function installTabStrip() {
  const browser = window.gBrowser;
  const target = document.getElementById("nav-bar-customization-target");
  const url = document.getElementById("urlbar-container");
  if (!browser?.tabContainer || !target || url?.parentElement !== target) {
    throw new Error("OnePlane: native toolbar or tabs not available");
  }

  const mountScope=createDisposableScope({onError:(resource,error)=>{
    try{window.__nocturneTrace?.("layout.scope.error",{owner:"layout",resource,name:error?.name||"Error"},{flush:true});}catch{}
  }});
  let releaseDragController=()=>true;
  const html = (tag, cls) => {
    const node = document.createElementNS("http://www.w3.org/1999/xhtml", tag);
    if (cls) node.className = cls;
    return node;
  };
  const row = html("div");
  row.id = "oneplane-tabs";
  // A fixed-size feature slot, independent of tab mirror membership.
  // Empty slots consume no space. The Downloads controller owns its button.
  const downloadHost=html("div","oneplane-download-host");
  downloadHost.id="oneplane-download-indicator-slot";
  downloadHost.setAttribute("skipintoolbarset","true");
  downloadHost.setAttribute("removable","false");
  function ensureDownloadHost(){
    if(downloadHost.parentElement===target)return;
    target.append(downloadHost);
    window.dispatchEvent(new window.CustomEvent("OnePlane:DownloadHostChanged"));
  }
  function releaseDownloadHost(){
    downloadHost.remove();
    window.__zenRefinedDownloadIndicator?.setHost?.(null);
    window.dispatchEvent(new window.CustomEvent("OnePlane:DownloadHostChanged"));
  }
  row.setAttribute("skipintoolbarset", "true");
  row.setAttribute("removable", "false");
  const compactSearch=html("button","oneplane-compact-search");
  compactSearch.id="oneplane-compact-search";compactSearch.type="button";compactSearch.title="Search or enter address";
  compactSearch.setAttribute("aria-label","Search or enter address");
  const searchGlyph=document.createElementNS("http://www.w3.org/2000/svg","svg");searchGlyph.setAttribute("viewBox","0 0 24 24");searchGlyph.setAttribute("aria-hidden","true");
  const searchPath=document.createElementNS(searchGlyph.namespaceURI,"path");searchPath.setAttribute("d","M16 16l5 5M18 10a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z");searchGlyph.append(searchPath);compactSearch.append(searchGlyph);
  compactSearch.addEventListener("click",()=>{window.gURLBar?.focus();window.gURLBar?.select();});
  const list = html("div", "oneplane-tab-list");
  list.setAttribute("role", "tablist");
  list.setAttribute("aria-label", "Browser tabs");
  const plus = html("button", "oneplane-new-tab");
  plus.type = "button";
  plus.textContent = "+";
  plus.title = "New tab";
  plus.setAttribute("aria-label", "New tab");
  plus.addEventListener("click", () => {
    const command = document.getElementById("cmd_newNavigatorTab");
    if (typeof command?.doCommand === "function") command.doCommand();
    else window.BrowserCommands?.openTab();
  });
  const indicator = html("div");
  indicator.id = "oneplane-tab-indicator";
  indicator.setAttribute("aria-hidden", "true");
  const leftLane = html("div","oneplane-island-lane oneplane-island-left");
  const rightLane = html("div","oneplane-island-lane oneplane-island-right");
  const bottomLane = html("div","oneplane-island-lane oneplane-overflow-lane");
  bottomLane.hidden=true;
  bottomLane.setAttribute("role","group");bottomLane.setAttribute("aria-label","Overflow tabs");
  bottomLane.id="oneplane-overflow-tabs";
  const overflowSlider=html("input","oneplane-overflow-slider");
  overflowSlider.type="range";overflowSlider.min="0";overflowSlider.max="1000";overflowSlider.step="1";overflowSlider.value="0";overflowSlider.hidden=true;
  overflowSlider.setAttribute("aria-label","Scroll overflow tabs");overflowSlider.setAttribute("aria-controls",bottomLane.id);
  const island = html("button","oneplane-title-island");
  island.type="button";island.disabled=true;island.setAttribute("aria-label","Toggle Home");island.setAttribute("aria-expanded","false");
  const homeGlyph=document.createElementNS("http://www.w3.org/2000/svg","svg");
  homeGlyph.setAttribute("viewBox","0 0 24 24");homeGlyph.setAttribute("aria-hidden","true");
  const homePath=document.createElementNS("http://www.w3.org/2000/svg","path");homePath.setAttribute("d","m3 10 9-7 9 7v10h-6v-7H9v7H3z");homeGlyph.append(homePath);island.append(homeGlyph);
  const islandTitle = html("span","oneplane-island-title");
  island.append(islandTitle);
  row.append(list, plus, indicator, island, overflowSlider);
  let stripOrderSnapshot=[];
  function stripNodes() {
    // The painted row order is not the native order once overflow is active.
    return stripOrderSnapshot.filter(node=>list.contains(node));
  }
  function isStripNode(node) {
    return Boolean(node && (node.parentElement === list ||
      node.parentElement === leftLane || node.parentElement === rightLane || node.parentElement===bottomLane));
  }
  function compactSlotWidth(node, tabWidth) {
    return node.classList.contains("oneplane-split-group") ?
      22 + node.querySelectorAll(".oneplane-tab").length*(tabWidth+3) : tabWidth;
  }
  function laneNodes(lane){
    return Array.from(lane.children).filter(isStripNode);
  }
  function islandBoundary(widths, plusWidth, gap=3) {
    if (widths.length < 2) return widths.length;
    const total=widths.reduce((sum,w)=>sum+w+gap,0);
    let left=0,best=1,score=Infinity;
    for(let i=1;i<widths.length;i++){
      left+=widths[i-1]+gap;
      const diff=Math.abs(left-(total-left+plusWidth));
      if(diff<score){score=diff;best=i;}
    }
    return best;
  }
  // Pure collapsed-slot allocation for the second-row controller.
  // Each slot represents one tab or one entire Split View group.
  function planTabOverflow(widths,boundary,leftCapacity,rightCapacity,gap=3){
    if(!Array.isArray(widths)||widths.some(w=>!Number.isFinite(w)||w<=0)||
       !Number.isInteger(boundary)||boundary<0||boundary>widths.length||
       ![leftCapacity,rightCapacity,gap].every(v=>Number.isFinite(v)&&v>=0))
      throw new TypeError("Invalid collapsed slot geometry");
    let leftStart=boundary,leftUsed=0;
    while(leftStart>0){
      const next=widths[leftStart-1]+(leftStart===boundary?0:gap);
      if(leftUsed+next>leftCapacity)break;
      leftStart--;leftUsed+=next;
    }
    let rightEnd=boundary,rightUsed=0;
    while(rightEnd<widths.length){
      const next=widths[rightEnd]+(rightEnd===boundary?0:gap);
      if(rightUsed+next>rightCapacity)break;
      rightUsed+=next;rightEnd++;
    }
    const indices=(a,b)=>Array.from({length:b-a},(_,i)=>a+i);
    const lowerLeft=indices(0,leftStart),lowerRight=indices(rightEnd,widths.length);
    return {topLeft:indices(leftStart,boundary),topRight:indices(boundary,rightEnd),
      lowerLeft,lowerRight,lower:[...lowerLeft,...lowerRight],
      hasSecondRow:lowerLeft.length+lowerRight.length>0,leftUsed,rightUsed};
  }

  // A fixed center has two independently budgeted sides. Compact mode
  // keeps at most two ordinary slots on either side; groups are atomic.
  function planAdaptiveTabRows(widths,groups,boundary,available,title,tab,gap=3,returnReserve=0){
    const lane=(sideTitle)=>Math.max(0,(available-sideTitle-2*gap)/2-2*gap);
    const wideCap=Math.max(0,lane(title)-returnReserve/2),rightCap=Math.max(0,wideCap-tab-gap);
    const full=planTabOverflow(widths,boundary,wideCap,rightCap,gap);
    if(!full.hasSecondRow&&available>=title+2*gap+2*(tab+gap)+returnReserve){
      return {...full,mode:"wide",title,topPlus:true};
    }
    const minTitle=32;
    const compactTitle=available>=title+2*gap?title:minTitle;
    const compactLane=sideTitle=>Math.max(0,(available-sideTitle-2*gap)/2-2);
    const pick=(cap,start,end,step)=>{
      const picked=[];let used=0;
      for(let i=start;i!==end&&picked.length<2;i+=step){
        if(groups[i])continue;
        const extent=widths[i]+(picked.length?gap:0);
        if(used+extent>cap)continue;
        picked.push(i);used+=extent;
      }
      if(step<0)picked.reverse();
      return {picked,used};
    };
    const slots=sideTitle=>{
      const cap=compactLane(sideTitle);
      return {left:pick(cap,boundary-1,-1,-1),right:pick(cap,boundary,widths.length,1)};
    };
    const titled=slots(compactTitle),icon=slots(minTitle);
    // Keep the full title unless the icon can reveal another actual tab.
    const count=s=>s.left.picked.length+s.right.picked.length;
    const chosenTitle=count(icon)>count(titled)||available<compactTitle+2*gap?minTitle:compactTitle;
    const compactCap=compactLane(chosenTitle);
    const chosen=chosenTitle===minTitle?icon:titled;
    const left=chosen.left.picked,right=chosen.right.picked;
    const kept=new Set([...left,...right]);
    const lower=widths.map((_,i)=>i).filter(i=>!kept.has(i));
    const singleCap=lane(chosenTitle);
    const topPlus=lower.length===0&&chosen.left.used<=singleCap&&
      chosen.right.used+tab+gap<=singleCap&&available>=chosenTitle+2*gap+2*(tab+gap+2*gap);
    return {mode:chosenTitle===minTitle&&compactCap<tab?"ultra":"compact",title:chosenTitle,
      topLeft:left,topRight:right,lower,hasSecondRow:lower.length>0||!topPlus,topPlus};
  }
  function adaptiveAddressWidth(preferred,windowWidth,leftWithoutAddress,centerReserve,margin=8,forceCompact=false){
    const budget=Math.max(0,Math.floor(windowWidth/2-leftWithoutAddress-centerReserve-margin));
    const desired=forceCompact||budget<preferred?Math.round(preferred*.7):preferred;
    return Math.max(36,Math.min(desired,budget));
  }

  function visibleLaneDropIndex(slots,left,right,x){
    const visible=slots.map((s,index)=>({index,left:Math.max(left,s.left),right:Math.min(right,s.right)}))
      .filter(s=>s.right>s.left);
    if(!visible.length)return null;
    for(const s of visible)if(x<(s.left+s.right)/2)return {index:s.index,before:true};
    return {index:visible.at(-1).index,before:false};
  }
  function laneScrollVelocity(x,left,right,edge=32){
    if(!(edge>0))return 0;
    const l=Math.max(0,Math.min(1,(left+edge-x)/edge));
    const r=Math.max(0,Math.min(1,(x-(right-edge))/edge));
    return Math.round((r*r-l*l)*18);
  }

  function centeredRowCorrection(windowWidth,left,right,rowCenter,rowWidth){
    const min=left+rowWidth/2,max=windowWidth-right-rowWidth/2;
    // If the edges overlap there is no exact safe midpoint; stay as close
    // as possible to the real available center rather than crossing controls.
    const target=min<=max?Math.max(min,Math.min(max,windowWidth/2)):(min+max)/2;
    return Math.round(target-rowCenter);
  }

  function overflowScrollMetrics(viewport,content,offset){
    const max=Math.max(0,content-viewport),visible=viewport>0&&max>1;
    const position=visible?Math.max(0,Math.min(1,offset/max)):0;
    return {visible,max,position,value:Math.round(position*1000),
      thumb:visible?Math.min(viewport,Math.max(20,viewport*viewport/content)):0};
  }

  // Direct dragging bypasses this short, interruptible ease-out.
  function overflowScrollEase(start,target,elapsed,duration=145){
    const t=duration>0?Math.max(0,Math.min(1,elapsed/duration)):1;
    return t===1?target:start+(target-start)*(1-(1-t)**3);
  }

  // Spend only the surplus around a centered strip. The compact width
  // is a starting point, not a hard cap. Keep the configured preference
  // as the ceiling and preserve title, native slots, plus and row count.
  function reclaimAddressWidth(preferred,baseline,planAtWidth,safety=4){
    const low=Math.round(baseline),limit=Math.max(low,Math.floor(preferred));
    if(limit<=low)return low;
    const reference=planAtWidth(low);
    const same=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);
    const preserves=p=>p.mode===reference.mode&&p.title===reference.title&&
      p.topPlus===reference.topPlus&&p.hasSecondRow===reference.hasSecondRow&&
      same(p.topLeft,reference.topLeft)&&same(p.topRight,reference.topRight);
    const fits=w=>preserves(planAtWidth(w))&&preserves(planAtWidth(w+Math.max(0,safety)));
    // A conservative bounded search: extra room is optional. Never
    // return a width unless its actual and padded plans both fit.
    let l=low,h=limit;
    while(l<h){
      const mid=Math.ceil((l+h)/2);
      if(fits(mid))l=mid;else h=mid-1;
    }
    return l;
  }
  let adaptiveHeightDirty=false,overflowRevealAnimation=null;
  function mountLaneNodes(lane,nodes,current=()=>!dead){
    for(let i=0;i<nodes.length;i++){
      if(!current())return false;
      const node=nodes[i],before=lane.children[i]||null;
      if(before===node)continue;
      if(node.isConnected&&typeof lane.moveBefore==="function"){
        try{lane.moveBefore(node,before);continue;}catch{}
      }
      lane.insertBefore(node,before);
    }
    return current();
  }
  function applyStripPartition(plan,order=stripOrderSnapshot,current=()=>!dead&&stripOrderSnapshot===order){
    // Materialize all three lanes before any native focus/reparent callback.
    const lanes=[plan.topLeft,plan.topRight,plan.lower].map(indices=>indices.map(i=>order[i]));
    if(!current())return false;
    if(leftLane.parentElement!==list)list.append(leftLane,rightLane,bottomLane);
    const active=document.activeElement;
    const selected=entries.get(browser.selectedTab)?.item,previousLane=selected?.closest(".oneplane-island-lane");
    for(const [lane,nodes] of [[leftLane,lanes[0]],[rightLane,lanes[1]],[bottomLane,lanes[2]]]){
      if(!current())return false;
      if(!mountLaneNodes(lane,nodes,current))return false;
    }
    if(!current())return false;
    const changed=row.hasAttribute("data-op-overflow-row")!==plan.hasSecondRow;
    row.toggleAttribute("data-op-overflow-row",plan.hasSecondRow);
    row.toggleAttribute("data-op-adaptive-compact",plan.mode!=="wide");
    row.toggleAttribute("data-op-bottom-plus",!plan.topPlus);
    if(bottomLane.hidden===plan.hasSecondRow)bottomLane.hidden=!plan.hasSecondRow;
    if(changed){
    typeof window!=="undefined"&&window.__nocturneTrace?.("tabs.partition.height",()=>({second:plan.hasSecondRow,mode:plan.mode,left:plan.topLeft.length,right:plan.topRight.length,lower:plan.lower.length,phase:root.getAttribute('data-zr-workspace-phase')}),{sample:1800});
      overflowRevealAnimation?.cancel();overflowRevealAnimation=null;
      if(plan.hasSecondRow&&!root.hasAttribute("data-zr-workspace-phase")&&!root.hasAttribute("data-zr-startup-phase")&&row.hasAttribute("data-ready")&&cascadeState==="idle"&&!reducedMotion.matches&&prefs.getIntPref("zen.oneplane.animation-duration",160)!==0){
        try{overflowRevealAnimation=bottomLane.animate([{opacity:0},{opacity:1}],{duration:160,easing:"ease-out"});}catch{}
      }
      adaptiveHeightDirty=true;contourKey=null;
      // Real layout height changes once. Never repartition on hover.
      scheduleGeometry();scheduleContour();
    }
    if(!current())return false;
    if(active&&list.contains(active)&&document.activeElement!==active)active.focus?.({preventScroll:true});
    if(!current())return false;
    if(selected&&previousLane!==selected.closest(".oneplane-island-lane")&&!row.hasAttribute("data-op-home-open"))window.requestAnimationFrame(revealSelectedInStrip);
    return current();
  }
  function placeStripOrder(order) {
    if(row.hasAttribute("data-op-dragging"))return;
    const snapshot=stripOrderSnapshot=order.slice();
    const useLanes=row.hasAttribute("data-op-show-island");
    if(useLanes){
      if(leftLane.parentElement!==list)list.append(leftLane,rightLane,bottomLane);
      if(row.hasAttribute("data-ready")&&hoverSupported()){
        centerToolbar();
      }else{
        const tabWidth=parseFloat(window.getComputedStyle(row).getPropertyValue("--op-tab"))||36;
        const boundary=islandBoundary(order.map(n=>compactSlotWidth(n,tabWidth)),tabWidth+3);
        if(!applyStripPartition({topLeft:order.slice(0,boundary).map((_,i)=>i),
          topRight:order.slice(boundary).map((_,i)=>i+boundary),lower:[],hasSecondRow:false,mode:"wide",topPlus:true},snapshot))scheduleGeometry();
      }
    }else{
      if(!mountLaneNodes(list,order,()=>!dead&&stripOrderSnapshot===snapshot))return;
      leftLane.remove();rightLane.remove();bottomLane.remove();if(!bottomLane.hidden)bottomLane.hidden=true;
      if(row.hasAttribute("data-op-overflow-row")){adaptiveHeightDirty=true;contourKey=null;scheduleGeometry();}
      for(const attr of ["data-op-overflow-row","data-op-adaptive-compact","data-op-bottom-plus"])row.removeAttribute(attr);
    }
  }

  // Keep native page actions and popup anchors, moving only their actual nodes.
  const actions = document.createXULElement("hbox");
  actions.id = "oneplane-page-actions";
  actions.setAttribute("skipintoolbarset", "true");
  actions.setAttribute("removable", "false");
  actions.setAttribute("align", "center");
  const actionIds = ["translations-button", "zen-site-data-icon-button", "urlbar-zoom-button"];
  const actionHomes = new Map();
  function movePageActions() {
    if (root.hasAttribute("customizing")) return;
    if(window.innerWidth<=700){if(actions.isConnected||actionHomes.size)restorePageActions();return;}
    if (actions.parentElement !== target || actions !== target.lastElementChild) {
      target.append(actions);
    }
    for (const id of actionIds) {
      const node = document.getElementById(id);
      if (!node || node.parentElement === actions) continue;
      if (!url.contains(node)) continue;
      const anchor = document.createComment("OnePlane original position: " + id);
      node.before(anchor);
      actionHomes.set(node, anchor);
      if (typeof actions.moveBefore === "function") actions.moveBefore(node, null);
      else actions.append(node);
    }
  }
  function restorePageActions() {
    for (const [node, anchor] of actionHomes) {
      if (anchor.parentNode && node.parentElement === actions) {
        const parent = anchor.parentNode;
        if (typeof parent.moveBefore === "function") parent.moveBefore(node, anchor);
        else parent.insertBefore(node, anchor);
      }
      anchor.remove();
    }
    actionHomes.clear();
    actions.remove();
  }

  // Shield the web content, not the toolbar. Keep it until the complete click
  // has been consumed, even if a native focus handler closes the URL view early.
  const tabbox = document.getElementById("zen-tabbox-wrapper");
  if (!tabbox) throw new Error("OnePlane: native content wrapper not available");
  const shield = html("div");
  shield.id = "oneplane-url-dismiss";
  shield.setAttribute("aria-hidden", "true");
  let shieldPointer = null;
  let shieldTimer = 0;
  function stopInput(event) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
  function releaseShield() {
    shieldPointer = null;
    shield.removeAttribute("data-pressed");
    if (shieldTimer) window.clearTimeout(shieldTimer);
    shieldTimer = 0;
  }
  function dismissUrl() {
    releaseShield();
    if (startAddressClose()) return;
    finishDismissUrl();
  }
  function finishDismissUrl() {
    const bar = window.gURLBar;
    // Restart the hold after the visual closing sequence.
    holdToolbarAfterDismiss();
    try {
      bar?.view?.close();
      bar?.blur();
      if(row.hasAttribute("data-op-home-open"))document.getElementById("zen-shared-home")?.querySelector(".zh-search")?.focus({preventScroll:true});
      else browser.selectedBrowser?.focus();
    } finally {
      releaseShield();
    }
  }
  shield.addEventListener("pointerdown", event => {
    stopInput(event);
    shieldPointer = event.pointerId;
    shield.setAttribute("data-pressed", "true");
    holdToolbarAfterDismiss();
    try { shield.setPointerCapture(event.pointerId); } catch {}
  });
  shield.addEventListener("pointerup", event => {
    stopInput(event);
    // Click follows pointerup. Delay fallback for gestures that do not produce one.
    if (shieldPointer === event.pointerId) {
      shieldTimer = window.setTimeout(dismissUrl, 250);
    }
  });
  shield.addEventListener("pointercancel", () => releaseShield());
  for (const type of ["mousedown", "mouseup", "dblclick", "contextmenu", "auxclick", "dragstart"]) {
    shield.addEventListener(type, stopInput);
  }
  shield.addEventListener("click", event => {
    stopInput(event);
    dismissUrl();
  });
  // A native double-click can generate a second independent pointer sequence.
  // Only the first dismissing click is intentionally intercepted.
  const addressInput = () => window.gURLBar?.inputField || document.getElementById("urlbar-input");
  let addressFrame = 0;
  let addressObserver = null;
  let addressAnimation=null, addressIdentityAnimation=null, addressSelectionAnimation=null;
  let addressDiagnosticsFrame=0;
  let addressTransition = null;
  let addressWasOpen = false;
  let addressCompactWidth = 0;
  let addressAnchor = null;
  const ADDRESS_WAVE_OPEN = 420, ADDRESS_WAVE_CLOSE = 380;
  const ADDRESS_WAVE_SPREAD = .24;
  let addressSettling = false;
  let addressSettleTimer = 0;
  let addressFallbackFrame=0, addressClipHome=null,addressPhaseTimer=0,addressSettleOwner=null;
  function stopAddressAnimations(){
    const diagnostic=addressDiagnosticsFrame,fallback=addressFallbackFrame,timer=addressPhaseTimer;
    addressDiagnosticsFrame=addressFallbackFrame=addressPhaseTimer=0;
    const animations=[addressAnimation,addressIdentityAnimation,addressSelectionAnimation];
    addressAnimation=addressIdentityAnimation=addressSelectionAnimation=null;
    const clip=addressClipHome;addressClipHome=null;
    let failed=0;const step=fn=>{try{fn();}catch{failed++;}};
    if(diagnostic)step(()=>window.cancelAnimationFrame(diagnostic));
    if(fallback)step(()=>window.cancelAnimationFrame(fallback));
    if(timer)step(()=>window.clearTimeout(timer));
    for(const animation of animations)step(()=>animation?.cancel());
    if(clip){
      const {bar,value,priority}=clip;
      step(()=>{if(value)bar.style.setProperty("clip-path",value,priority);else bar.style.removeProperty("clip-path");});
    }
    if(failed)try{window.__nocturneTrace?.("address.cleanup.error",{failed},{flush:true});}catch{}
  }
  function cancelAddressSettle(){
    const timer=addressSettleTimer;addressSettleTimer=0;addressSettleOwner=null;addressSettling=false;
    if(timer)try{window.clearTimeout(timer);}catch{}
  }
  function clearAddressBarMarks(bar){
    if(!bar)return;
    for(const key of ["data-op-url-animating","data-op-url-selection-fade","data-op-url-fluid"])
      try{bar.removeAttribute(key);}catch{}
    for(const key of ["--op-url-live-width","--op-url-live-clip","--op-url-selection-alpha"])
      try{bar.style.removeProperty(key);}catch{}
  }

  function addressBar() { return document.getElementById("urlbar"); }
  function nativeInlineOpen(bar) {
    return Boolean(bar && bar.hasAttribute("breakout-extend") &&
      !bar.hasAttribute("zen-floating-urlbar") &&
      (bar.hasAttribute("open") || bar.hasAttribute("focused")));
  }
  function inlinePopoverPresent(bar) {
    return Boolean(bar && !bar.hasAttribute("zen-floating-urlbar") &&
      (bar.hasAttribute("breakout-extend") || bar.matches(":popover-open")));
  }
  function addressMotionEnabled() {
    return hoverSupported() &&
      prefs.getIntPref("zen.oneplane.animation-duration", 160) !== 0 &&
      !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
  function addressWidths() {
    const base = parseFloat(window.getComputedStyle(url).getPropertyValue("--op-url")) || 180;
    const bar = addressBar();
    const anchor = url.getBoundingClientRect();
    const compact = (url.hasAttribute("data-op-empty") || url.hasAttribute("data-op-home")) ? 0 : (anchor.width || addressCompactWidth || base);
    const left = anchor.left + (addressAnchor?.dx || 0);
    const top = anchor.top + (addressAnchor?.dy || 0);
    url.style.setProperty("--op-url-anchor-left", left.toFixed(2) + "px");
    url.style.setProperty("--op-url-anchor-top", top.toFixed(2) + "px");
    url.style.setProperty("--op-url-header-height", Math.max(24, addressAnchor?.height || anchor.height || 30).toFixed(2) + "px");
    // Zen has several caption containers, including hidden sidebar copies.
    // Prefer the live right-hand group; never cover the minimize button.
    const groups = Array.from(document.querySelectorAll(".titlebar-buttonbox-container"));
    let nativeGroup;
    try { nativeGroup = window.gZenVerticalTabsManager?.actualWindowButtons; } catch {}
    if (nativeGroup && !groups.includes(nativeGroup)) groups.unshift(nativeGroup);
    let right = window.innerWidth;
    for (const group of groups) {
      const box = group.getBoundingClientRect();
      const style = window.getComputedStyle(group);
      if (box.width > 0 && box.height > 0 && box.left > window.innerWidth / 2 &&
          box.right <= window.innerWidth + 2 && style.visibility === "visible" &&
          style.display !== "none" && Number(style.opacity || 1) > 0) {
        right = Math.min(right, box.left);
      }
    }
    const expanded = Math.max(1, Math.min(window.innerWidth-12, right - Math.max(0, left) - 6));
    url.style.setProperty("--op-url-expanded-width", expanded.toFixed(2) + "px");
    url.style.setProperty("--op-url-compact-width", Math.max(1, compact).toFixed(2) + "px");
    return { compact, expanded };
  }
  function rememberCompactAddress() {
    const bar = addressBar();
    if (!bar || inlinePopoverPresent(bar) ||
        bar.hasAttribute("zen-floating-urlbar") || url.hasAttribute("data-op-empty") || url.hasAttribute("data-op-home")) return;
    const box = bar.getBoundingClientRect();
    const anchor = url.getBoundingClientRect();
    if (box.width > 0 && box.height > 0) {
      addressCompactWidth = box.width;
      addressAnchor = { dx: box.left - anchor.left, dy: box.top - anchor.top,
        height: box.height };
      addressWidths();
    }
  }
  function clearAddressAnimation() {
    const previous=addressTransition?.bar||addressSettleOwner?.bar;
    addressTransition = null;
    stopAddressAnimations();
    cancelAddressSettle();
    url.removeAttribute("data-op-url-phase");
    url.toggleAttribute("data-op-url-ready", nativeInlineOpen(addressBar()));
    root.removeAttribute("oneplane-address-unblur");
    // A replaced bar has no ownership relationship to the old phase.
    clearAddressBarMarks(previous||addressBar());
    reconcileTabCascade();
  }
  function addressWaveDepth(progress,x){
    const t=Math.max(0,Math.min(1,(progress-ADDRESS_WAVE_SPREAD*x)/(1-ADDRESS_WAVE_SPREAD)));
    return t*t*(3-2*t);
  }
  function addressWaveClip(width,height,header,progress,radius=8,layoutWidth=width){
    width=Math.max(1,width);height=Math.max(1,height);
    const rightInset=Math.max(0,layoutWidth-width);
    header=Math.min(height,Math.max(1,header));
    const r=Math.min(radius,width/2,header/2);
    const depth=x=>header+(height-header)*addressWaveDepth(progress,x);
    if(progress<=0 || progress>=1 || height-header<.5){
      const bottom=progress>=1?0:Math.max(0,height-header);
      return "inset(0px "+rightInset.toFixed(2)+"px "+bottom.toFixed(2)+"px 0px round var(--op-url-radius))";
    }
    const f=n=>n.toFixed(2);
    const left=depth(0),right=depth(1);
    let path="M"+f(r)+" 0 H"+f(width-r)+" Q"+f(width)+" 0 "+f(width)+" "+f(r)+
      " V"+f(right-r)+" Q"+f(width)+" "+f(right)+" "+f(width-r)+" "+f(depth((width-r)/width));
    for(let i=1;i<=24;i++){
      const x=(width-r)-(width-2*r)*i/24;
      path+=" L"+f(x)+" "+f(depth(x/width));
    }
    path+=" Q0 "+f(left)+" 0 "+f(left-r)+" V"+f(r)+" Q0 0 "+f(r)+" 0 Z";
    return 'path("'+path+'")';
  }
  function addressWaveDuration(from,to,full,duration){
    const fraction=Math.max(Math.abs(to.reveal-from.reveal),
      Math.abs(to.width-from.width)/Math.max(1,full.expanded-full.compact));
    return Math.max(80,duration*Math.min(1,fraction));
  }
  // Prepare all keyframes once. Both axes share the same smooth timeline.
  // The lower edge is relative to the live border-box height: native
  // suggestions can arrive after opening without restarting the animation.
  function addressMotionSample(name,from,to,t){
    t=Math.max(0,Math.min(1,t));
    const s=t*t*(3-2*t);
    const horizontal=name==="opening"?s+.35*s*(1-s):s-.35*s*(1-s);
    const alpha=from.selection??1;
    return {width:from.width+(to.width-from.width)*horizontal,
      reveal:from.reveal+(to.reveal-from.reveal)*s,
      selection:name==="opening"?alpha+(1-alpha)*s:alpha*(1-Math.min(1,s/.82))};
  }
  function addressFluidClip(width,header,progress,radius=8,shape=false){
    const w=Math.max(1,width),r=Math.max(0,Math.min(radius,w/2,header/2));
    const px=n=>Number(n.toFixed(3))+"px";
    const y=(x,dy=0)=>{
      const depth=addressWaveDepth(progress,Math.max(0,Math.min(1,x/w)));
      return "calc("+px(header*(1-depth)+dy)+" + "+Number((100*depth).toFixed(4))+"%)";
    };
    if(shape){
      // Identical command topology at every offset, including both endpoints.
      const pt=(x,dy=0)=>px(x)+" "+y(x,dy);
      const edge=(w-r);
      const commands=["from "+px(r)+" 0px","hline to "+px(edge),
        "curve to "+px(w)+" "+px(r)+" with "+px(w)+" 0px",
        "vline to "+y(w,-r),
        "curve to "+pt(edge)+" with "+px(w)+" "+y(w)];
      for(let i=0;i<4;i++){
        const x0=edge-(edge-r)*i/4,x1=edge-(edge-r)*(i+1)/4;
        commands.push("curve to "+pt(x1)+" with "+pt(x0+(x1-x0)/3)+" / "+pt(x0+2*(x1-x0)/3));
      }
      commands.push("curve to 0px "+y(0,-r)+" with 0px "+y(0),
        "vline to "+px(r),"curve to "+px(r)+" 0px with 0px 0px","close");
      return "shape("+commands.join(", ")+")";
    }
    // Compatible polygon fallback. Fixed topology, rounded-corner samples
    // and relative heights. No per-frame path serialization or layout reads.
    const p=[],point=(x,v)=>p.push(px(x)+" "+v);
    for(let i=0;i<=4;i++){
      const t=i*Math.PI/8;point(r-r*Math.cos(t),px(r-r*Math.sin(t)));
    }
    for(let i=0;i<=4;i++){
      const t=i*Math.PI/8;point(w-r+r*Math.sin(t),px(r-r*Math.cos(t)));
    }
    for(let i=0;i<=4;i++){
      const t=i*Math.PI/8;point(w-r+r*Math.cos(t),y(w,-r+r*Math.sin(t)));
    }
    for(let i=0;i<=8;i++){
      const x=(w-r)-(w-2*r)*i/8;point(x,y(x));
    }
    for(let i=0;i<=4;i++){
      const t=i*Math.PI/8;point(r-r*Math.sin(t),y(0,-r+r*Math.cos(t)));
    }
    return "polygon("+p.join(", ")+")";
  }
  function addressFluidFrames(name,from,to,layoutWidth,header,radius=8,shape=false){
    // These are interpolation knots, not frames or an FPS limit.
    return Array.from({length:17},(_,i)=>{
      const offset=i/16,v=addressMotionSample(name,from,to,offset);
      return {offset,clipPath:addressFluidClip(v.width,header,v.reveal,radius,shape),
        translate:""+(v.width-layoutWidth).toFixed(3)+"px 0px",
        selection:(v.selection*100).toFixed(3)+"%"};
    });
  }
  function emptyAddressState(explicitEmpty,uri,pending,restoring){
    if(explicitEmpty)return true;
    if(pending||restoring)return false;
    return /^(about:(blank|newtab|home|privatebrowsing))(?:[?#].*)?$/i.test(uri);
  }
  function cascadeWaveSchedule(items,phase,geometry,opening){
    const span=phase?.duration??(opening?180:0);
    const step=Math.min(opening?24:32,(opening?Math.max(0,span-85):240)/Math.max(1,items.length-1));
    let previous=-step;
    return items.map((v,i)=>{
      let edge=opening?span:0;
      if(phase){
        const covered=t=>{
          const sample=addressMotionSample(phase.name,phase.from,phase.to,t);
          if(geometry.left+sample.width<v.left)return false;
          if(!v.bookmark)return true;
          const depth=addressWaveDepth(sample.reveal,Math.max(0,Math.min(1,(v.left-geometry.left)/Math.max(1,sample.width))));
          return geometry.top+geometry.header+Math.max(0,geometry.height-geometry.header)*depth>=v.top;
        };
        const crossed=t=>opening?covered(t):!covered(t);
        let lo=0,hi=1;
        if(crossed(0))hi=0;
        else if(!crossed(1))lo=1;
        else for(let j=0;j<16;j++){
          const m=(lo+hi)/2;
          if(crossed(m))hi=m;else lo=m;
        }
        edge=(lo+hi)/2*span;
      }
      let delay,duration;
      if(opening){
        duration=Math.min(85,Math.max(1,span));
        const limit=Math.max(0,span-duration-step*(items.length-1-i));
        delay=Math.min(limit,Math.max(previous+step,edge-duration));
      }else{
        duration=190;
        delay=Math.max(previous+step,edge);
      }
      previous=delay;
      return {delay,duration};
    });
  }
  function cascadeRevealFrames(v={}){
    const opacity=Math.max(0,Math.min(1,v.opacity??0));
    const x=Math.max(0,Math.min(1,v.x??0)),y=Math.max(0,Math.min(1,v.y??0));
    // The whole painted card remains within its resting slot. All
    // easing control points are monotonic and have no external overshoot.
    if(x>=.999&&y>=.999&&opacity>=.999)
      return [{offset:0,scale:"1 1",opacity:1},{offset:1,scale:"1 1",opacity:1}];
    return [
      {offset:0,scale:x+" "+y,opacity,easing:"cubic-bezier(.18,.7,.25,1)"},
      {offset:.55,scale:"1 1",opacity:1,easing:"cubic-bezier(.3,0,.5,1)"},
      {offset:.78,scale:"0.93 0.93",opacity:1,easing:"cubic-bezier(.2,.7,.3,1)"},
      {offset:1,scale:"1 1",opacity:1}
    ];
  }
  function cascadeFadeFrames(opacity,opening){
    return [{opacity:Math.max(0,Math.min(1,opacity))},{opacity:opening?0:1}];
  }
  // Shared address-wave choreography. Each visible item gets a fixed
  // small set of keyframes; all measurement is batched before writes.
  const TAB_WAVE_SELECTOR=".oneplane-tab,.oneplane-split-handle,.oneplane-title-island,.oneplane-new-tab";
  const BOOKMARK_WAVE_SELECTOR="#PlacesToolbarItems > :is(toolbarbutton,toolbaritem,toolbarseparator),#PlacesChevron,#OtherBookmarks";
  let cascadeState="idle",cascadeGeneration=0,cascadeHandoffFrame=0,cascadeTimer=0,cascadePhase=null;
  const cascadeAnimations=new Map(),cascadeDecorations=new Set();
  let cascadePointer=null,bookmarkInertHome=null;
  function setBookmarkWave(state){
    if(!bookmarks)return;
    if(state){
      if(bookmarkInertHome===null)bookmarkInertHome={present:bookmarks.hasAttribute("inert"),value:bookmarks.getAttribute("inert")};
      bookmarks.setAttribute("inert","");
      root.setAttribute("data-op-bookmark-wave",state);
      bookmarks.setAttribute("data-op-bookmark-wave",state);
    }else{
      bookmarks.removeAttribute("data-op-bookmark-wave");
      root.removeAttribute("data-op-bookmark-wave");
      if(bookmarkInertHome!==null){
        if(bookmarkInertHome.present)bookmarks.setAttribute("inert",bookmarkInertHome.value);
        else bookmarks.removeAttribute("inert");
      }
      bookmarkInertHome=null;
    }
    try{window.__zenMagneticBookmarksShared?.syncAddressState?.();}catch(error){
      try{window.__nocturneTrace?.("address.cascade.bookmarks.error",{name:error?.name},{flush:true});}catch{}
    }
  }
  function cancelCascadeAnimations(){
    const animations=[...cascadeAnimations],decorations=[...cascadeDecorations];
    cascadeAnimations.clear();cascadeDecorations.clear();
    let failed=0;const step=fn=>{try{fn();}catch{failed++;}};
    for(const [node,anim] of animations){
      step(()=>anim.cancel());
      for(const key of ["data-op-cascade-member","data-op-cascade-frame","data-op-bookmark-wave-member"])
        step(()=>node.removeAttribute(key));
    }
    for(const {node,anim} of decorations){
      step(()=>anim.cancel());step(()=>node.removeAttribute("data-op-bookmark-wave-card"));
    }
    if(failed)try{window.__nocturneTrace?.("address.cascade.cleanup",{failed},{flush:true});}catch{}
  }
  function cancelCascadeHandoff(){
    const frame=cascadeHandoffFrame,timer=cascadeTimer;
    cascadeHandoffFrame=cascadeTimer=0;
    if(frame)try{window.cancelAnimationFrame(frame);}catch{}
    if(timer)try{window.clearTimeout(timer);}catch{}
  }
  function resetTabCascade(){
    cascadeGeneration++;
    cancelCascadeHandoff();
    row.removeAttribute("data-op-cascade");
    cascadeState="idle";cascadePhase=null;
    row.inert=false;
    cancelCascadeAnimations();
    setBookmarkWave(null);
    if(!dead){refreshIndicator();schedule();scheduleGeometry();scheduleContour();}
  }
  function settleHidden(generation){
    if(dead||generation!==cascadeGeneration)return;
    cancelCascadeHandoff();cascadePhase=null;
    cascadeState="hidden";
    row.setAttribute("data-op-cascade","hidden");
    cancelCascadeAnimations();
    setBookmarkWave("hidden");
    clearTabHover();hideIndicator();islandTextAnimation?.cancel();
    // Hidden is a stable, noninteractive phase: replay deferred projection.
    if(!dead){schedule();scheduleGeometry();}
  }
  function finishCascadeHandoff(generation){
    if(dead||generation!==cascadeGeneration)return;
    cancelCascadeHandoff();
    const done=()=>{
      if(dead||generation!==cascadeGeneration)return;
      resetTabCascade();clearTabHover();
    };
    try{
      const frame=window.requestAnimationFrame(()=>{
        if(dead||generation!==cascadeGeneration||cascadeHandoffFrame!==frame)return;
        done();
      });
      cascadeHandoffFrame=frame;
      const timer=window.setTimeout(()=>{
        if(dead||generation!==cascadeGeneration||cascadeTimer!==timer)return;
        done();
      },150);
      cascadeTimer=timer;
    }catch{done();}
  }
  function collectCascadeSlots(previous){
    const viewport=row.getBoundingClientRect(),cache=new Map();
    const bounds=node=>{
      if(!cache.has(node))cache.set(node,node.getBoundingClientRect());
      return cache.get(node);
    };
    const tabNodes=Array.from(row.querySelectorAll(TAB_WAVE_SELECTOR));
    const bmNodes=bookmarks&&!bookmarks.hidden&&!bookmarks.collapsed?
      Array.from(bookmarks.querySelectorAll(BOOKMARK_WAVE_SELECTOR)).filter(n=>!n.parentElement?.closest(BOOKMARK_WAVE_SELECTOR)):[];
    const result=[];
    for(const [nodes,bookmark] of [[tabNodes,false],[bmNodes,true]]){
      for(const node of nodes){
        if(!node.isConnected||node.hidden||node.collapsed)continue;
        const rect=node.getBoundingClientRect();
        // XUL bookmarks need not expose HTMLElement.offsetWidth.
        // Their native text is never scaled by our wave.
        const width=bookmark?rect.width:node.offsetWidth,height=bookmark?rect.height:node.offsetHeight;
        if(!(width>0&&height>0))continue;
        const css=window.getComputedStyle(node);
        if(css.display==="none"||bookmark&&css.visibility!=="visible")continue;
        const scale=!css.scale||css.scale==="none"?[1,1]:css.scale.split(/\s+/).map(Number);
        const tracked=cascadeAnimations.has(node);
        const hidden=previous!=="idle"&&!tracked;
        const fullyHidden=hidden||previous==="hidden";
        const center=(rect.left+rect.right)/2,cy=(rect.top+rect.bottom)/2;
        const left=center-width/2,right=center+width/2,top=cy-height/2;
        const lane=bookmark?null:node.closest(".oneplane-island-lane");
        const region=bookmark?bookmarks:(lane&&lane.offsetWidth>0?lane:node.closest(".oneplane-tab-list")||row);
        const clip=region===row?viewport:bounds(region);
        const group=bookmark?null:node.closest(".oneplane-split-group");
        if(right<=clip.left||left>=clip.right)continue;
        result.push({node,bookmark,group,left,right,top,
          x:fullyHidden?0:(Number.isFinite(scale[0])?scale[0]:1),
          y:fullyHidden?0:(Number.isFinite(scale[1])?scale[1]:Number.isFinite(scale[0])?scale[0]:1),
          opacity:fullyHidden?0:Math.max(0,Math.min(1,parseFloat(css.opacity)||0))});
      }
    }
    return result;
  }
  function completeCascade(generation,opening,reason){
    if(dead||generation!==cascadeGeneration)return;
    if(cascadeState!==(opening?"hiding":"showing"))return;
    // Invalidate every queued completion from this wave before releasing
    // its effects. A closing handoff gets its own exact generation.
    const next=++cascadeGeneration;
    try{window.__nocturneTrace?.("address.cascade.finish",{generation,opening,reason},{sample:1800});}catch{}
    if(opening)settleHidden(next);else finishCascadeHandoff(next);
  }
  function animateTabCascade(opening,phase=null){
    if(dead||!hoverSupported()){resetTabCascade();return;}
    const previous=cascadeState;
    if(opening&&previous==="hidden"||!opening&&previous==="idle")return;
    if(previous===(opening?"hiding":"showing")&&(!phase||cascadePhase===phase))return;
    if(row.hasAttribute("data-op-dragging"))return;
    cancelCascadeHandoff();
    if(panelLastPointer)cascadePointer={...panelLastPointer};
    cancelHoverTimer();
    const generation=++cascadeGeneration;cascadePhase=phase;
    if(!addressMotionEnabled()){
      if(opening){row.inert=true;settleHidden(generation);}else resetTabCascade();
      return;
    }
    try{
    // Suspend Magnetic Hover synchronously, before reading resting slots.
    // Preserve the tab hover geometry until the opening fade is invisible.
    if(bookmarks){
      root.setAttribute("data-op-bookmark-wave",opening?"hiding":"showing");
      window.__zenMagneticBookmarksShared?.syncAddressState?.();
    }
    const slots=collectCascadeSlots(previous);
    const groupAlpha=new Map();
    for(const v of slots)if(v.group&&!groupAlpha.has(v.group)){
      groupAlpha.set(v.group,previous==="idle"?1:cascadeAnimations.has(v.group)?
        parseFloat(window.getComputedStyle(v.group).opacity)||0:0);
    }
    const bar=addressBar(),rect=bar?.getBoundingClientRect();
    const geometry={left:parseFloat(url.style.getPropertyValue("--op-url-anchor-left"))||url.getBoundingClientRect().left,
      top:parseFloat(url.style.getPropertyValue("--op-url-anchor-top"))||rect?.top||0,
      header:parseFloat(url.style.getPropertyValue("--op-url-header-height"))||30,
      height:rect?.height||30};
    const hadIndicator=indicatorShown,indicatorOpacity=previous==="idle"?1:
      cascadeAnimations.has(indicator)?parseFloat(window.getComputedStyle(indicator).opacity)||0:0;
    cancelCascadeAnimations();
    cascadeState=opening?"hiding":"showing";
    typeof window!=="undefined"&&window.__nocturneTrace?.("address.cascade",()=>({state:cascadeState,generation:cascadeGeneration,opening}),{sample:1800});
    row.setAttribute("data-op-cascade",cascadeState);
    row.inert=true;
    setBookmarkWave(cascadeState);
    if(!opening){
      indicatorHover=null;hoverX=null;
      hideIndicator();refreshIndicator(true);
    }
    if(indicatorFrame)window.cancelAnimationFrame(indicatorFrame);
    indicatorFrame=0;iv=0;last=0;
    islandTextAnimation?.cancel();
    const start=phase?.epoch;
    const jobs=[],groupTiming=new Map();
    let failed=false,end=0;
    const watch=(anim,timing,required=true)=>{
      const job=anim.finished.then(()=>true,()=>!required);
      jobs.push(job);
      end=Math.max(end,timing.delay+timing.duration);
      if(required)job.then(ok=>{if(!ok)completeCascade(generation,opening,"cancelled");});
    };
    const play=(node,frames,timing,attr)=>{
      let anim=null;
      try{
        node.setAttribute(attr,"true");
        anim=node.animate(frames,{...timing,fill:"both",easing:"linear"});
        cascadeAnimations.set(node,anim);
        watch(anim,timing);
        if(Number.isFinite(start))anim.startTime=start;
        return true;
      }catch(error){
        failed=true;
        if(anim){cascadeAnimations.delete(node);try{anim.cancel();}catch{}}
        try{node.removeAttribute(attr);}catch{}
        window.console.warn("[OnePlane] Wave animation fallback:",nocturneErrorClass(error));
        return false;
      }
    };
    const selected=entries.get(browser.selectedTab)?.item;
    const indicatorItem=opening&&indicatorHover&&list.contains(indicatorHover)?indicatorHover:selected;
    let indicatorPlayed=false;
    // Two rows share the same address trajectory but independent stagger.
    // No quadratic global timeline and no repeated geometry sampling.
    for(const bookmark of [false,true]){
      const ordered=slots.filter(v=>v.bookmark===bookmark).sort((a,b)=>opening?a.left-b.left:b.left-a.left);
      const timings=cascadeWaveSchedule(ordered,phase,geometry,opening);
      for(let i=0;i<ordered.length;i++){
        const v=ordered[i],timing=timings[i];
        let frames=opening||bookmark?cascadeFadeFrames(v.opacity,opening):cascadeRevealFrames(v);
        // Preserve the sampled scale on every interrupted hide, including
        // a same-direction phase replacing an earlier reversed wave.
        if(opening&&!bookmark&&previous!=="idle")
          frames=frames.map(k=>({...k,scale:v.x+" "+v.y}));
        play(v.node,frames,timing,bookmark?"data-op-bookmark-wave-member":"data-op-cascade-member");
        if(v.group){
          const old=groupTiming.get(v.group);
          if(!old||opening&&old.delay<timing.delay)groupTiming.set(v.group,timing);
        }
        if(!opening&&bookmark&&v.node.matches("toolbarbutton.bookmark-item")){
          // Native XUL labels/icons only fade. The decorative card alone
          // has a bounded spring; it never alters the native text metrics.
          let decoration=null;
          try{
            v.node.setAttribute("data-op-bookmark-wave-card","true");
            const effect=new window.KeyframeEffect(v.node,[
              {offset:0,transform:"scale(0)",opacity:0},
              {offset:.55,transform:"scale(1)",opacity:.18},
              {offset:.78,transform:"scale(.93)",opacity:.12},
              {offset:1,transform:"scale(1)",opacity:0}
            ],{...timing,fill:"both",easing:"ease-out",pseudoElement:"::before"});
            if(effect.pseudoElement!=="::before")throw Error("pseudo unsupported");
            const anim=new window.Animation(effect,document.timeline);
            decoration={node:v.node,anim};cascadeDecorations.add(decoration);
            watch(anim,timing,false);anim.play();
            if(Number.isFinite(start))anim.startTime=start;
          }catch{
            if(decoration){cascadeDecorations.delete(decoration);try{decoration.anim.cancel();}catch{}}
            v.node.removeAttribute("data-op-bookmark-wave-card");
          }
        }
        if(v.node===indicatorItem&&(opening?hadIndicator:indicatorShown)){
          indicatorPlayed=play(indicator,cascadeFadeFrames(indicatorOpacity,opening),
            opening?timing:{delay:timing.delay+28,duration:105},"data-op-cascade-member");
        }
      }
    }
    if(!indicatorPlayed&&opening)hideIndicator();
    for(const [group,timing] of groupTiming)
      play(group,cascadeFadeFrames(groupAlpha.get(group)??0,opening),
        {delay:timing.delay,duration:opening?timing.duration:85},"data-op-cascade-frame");
    if(failed){completeCascade(generation,opening,"setup-failed");return;}
    Promise.all(jobs).then(results=>completeCascade(generation,opening,results.every(Boolean)?"finished":"cancelled"));
    try{
      const timer=window.setTimeout(()=>{
        if(dead||generation!==cascadeGeneration||cascadeTimer!==timer)return;
        cascadeTimer=0;completeCascade(generation,opening,"watchdog");
      },end+150);
      cascadeTimer=timer;
    }catch{completeCascade(generation,opening,"watchdog-unavailable");}
    }catch(error){
      // If even preparation fails, converge to the intended native-facing
      // state instead of leaving old effects or a stale inert strip.
      if(dead||generation!==cascadeGeneration)return;
      cascadeState=opening?"hiding":"showing";
      if(opening){row.inert=true;settleHidden(generation);}
      else resetTabCascade();
      try{window.__nocturneTrace?.("address.cascade.error",{name:error?.name},{flush:true});}catch{}
    }
  }
  function reconcileTabCascade(){
    if(dead||!hoverSupported()){if(cascadeState!=="idle")resetTabCascade();return;}
    if(addressTransition||addressSettling)return;
    const open=nativeInlineOpen(addressBar());
    if(open&&(cascadeState==="idle"||cascadeState==="showing"))animateTabCascade(true);
    else if(!open&&(cascadeState==="hidden"||cascadeState==="hiding")){
      holdToolbarAfterDismiss();
      animateTabCascade(false);
    }
  }

  function currentAddressVisual(){
    const a=addressTransition;
    if(!a)return null;
    const elapsed=addressAnimation?Number(addressAnimation.currentTime??0):window.performance.now()-a.start;
    return addressMotionSample(a.name,a.from,a.to,elapsed/a.duration);
  }
  function startAddressDiagnostics(a){
    if(!prefs.getBoolPref("zen.oneplane.address-diagnostics",false))return;
    let last=null;
    const intervals=[];
    function sample(now){
      if(dead||addressTransition!==a)return;
      if(last!==null)intervals.push(now-last);
      last=now;
      addressDiagnosticsFrame=window.requestAnimationFrame(sample);
    }
    a.report=()=>{
      if(addressDiagnosticsFrame)window.cancelAnimationFrame(addressDiagnosticsFrame);
      addressDiagnosticsFrame=0;
      const sorted=intervals.slice().sort((x,y)=>x-y);
      const percentile=p=>sorted.length?Number(sorted[Math.min(sorted.length-1,Math.floor(p*(sorted.length-1)))].toFixed(2)):null;
      window.console.info("[OnePlane address]",{phase:a.name,engine:a.engine,frames:intervals.length,
        medianMs:percentile(.5),p95Ms:percentile(.95),maxMs:percentile(1),
        approximateHz:sorted.length?Math.round(1000/(intervals.reduce((x,y)=>x+y,0)/intervals.length)):null,
        frameRatePref:prefs.getIntPref("layout.frame_rate",-1)});
    };
    addressDiagnosticsFrame=window.requestAnimationFrame(sample);
  }
  function finishAddressPhase(a,reason="finished"){
    if(dead||addressTransition!==a)return;
    try{window.__nocturneTrace?.("address.finish",{phase:a.name,engine:a.engine,reason},{sample:1800});}catch{}
    if(a.bar!==addressBar()){
      clearAddressAnimation();addressWasOpen=nativeInlineOpen(addressBar());return;
    }
    try{a.report?.();}catch{}
    if(a.name!=="closing-wave"){
      clearAddressAnimation();
      return;
    }
    // Keep the last compact silhouette while native focus and popover
    // dismissal settle. The layout changes once, at the end of motion.
    addressTransition=null;
    addressSettling=true;addressSettleOwner=a;
    try{
    url.setAttribute("data-op-url-phase","settling");
    const bar=a.bar;
    stopAddressAnimations();
    if(bar){
      bar.style.setProperty("--op-url-live-width",Math.max(1,a.to.width).toFixed(3)+"px");
      bar.style.setProperty("--op-url-live-clip","inset(0 0 max(0px, calc(100% - var(--op-url-header-height))) 0 round var(--op-url-radius))");
      bar.style.setProperty("--op-url-selection-alpha","0%");
    }
      if(dead||addressSettleOwner!==a)return;
      if(addressBar()!==bar){clearAddressAnimation();addressWasOpen=nativeInlineOpen(addressBar());return;}
      finishDismissUrl();
      if(!addressSettling||addressSettleOwner!==a)return;
      if(!inlinePopoverPresent(addressBar())){
        clearAddressAnimation();
        addressWasOpen=false;
      }else{
        addressSettleTimer=window.setTimeout(()=>{
          if(dead||!addressSettling||addressSettleOwner!==a)return;
          clearAddressAnimation();
          addressWasOpen=nativeInlineOpen(addressBar());
        },600);
      }
    }catch(error){
      if(addressSettleOwner!==a)return;
      clearAddressAnimation();addressWasOpen=nativeInlineOpen(addressBar());
      try{window.__nocturneTrace?.("address.dismiss.error",{name:error?.name},{flush:true});}catch{}
    }
  }
  function watchAddressEffect(a,animation,isCurrent,primary=false){
    // Attach rejection handling immediately, before pause, seek or startTime.
    // stopAddressAnimations clears identity before intentional cancellation.
    animation.finished.then(()=>{
      if(primary&&!dead&&addressTransition===a&&isCurrent())finishAddressPhase(a);
    },()=>{
      if(!dead&&addressTransition===a&&isCurrent())finishAddressPhase(a,"cancelled");
    });
  }
  function armAddressPhase(a){
    const timer=window.setTimeout(()=>{
      if(dead||addressTransition!==a||addressPhaseTimer!==timer)return;
      addressPhaseTimer=0;finishAddressPhase(a,"watchdog");
    },Math.max(0,a.duration)+150);
    addressPhaseTimer=timer;
  }
  function beginAddressPhase(name,from,to,duration,layoutWidth=Math.max(from.width,to.width)){
    typeof window!=="undefined"&&window.__nocturneTrace?.("address.begin",()=>({phase:name,fromWidth:from.width,toWidth:to.width,duration,layoutWidth}),{sample:1800});
    // Cancel only after sampling the previous visual position. Keep
    // the native editor, selection, results and popup anchors intact.
    const previous=addressTransition?.bar||addressSettleOwner?.bar;
    stopAddressAnimations();cancelAddressSettle();
    const bar=addressBar();
    if(previous&&previous!==bar)clearAddressBarMarks(previous);
    if(!bar){clearAddressAnimation();return;}
    const full=Math.max(1,layoutWidth);
    const header=Math.max(1,parseFloat(url.style.getPropertyValue("--op-url-header-height"))||addressAnchor?.height||30);
    const radius=parseFloat(window.getComputedStyle(bar).getPropertyValue("--op-url-radius"))||8;
    const shape=window.CSS?.supports("clip-path",addressFluidClip(Math.max(1,from.width),header,from.reveal,radius,true))??false;
    const frames=addressFluidFrames(name,from,to,full,header,radius,shape);
    const a={name,from,to,duration,bar,start:window.performance.now(),engine:shape?"waapi-shape":"waapi-polygon"};
    addressTransition=a;
    url.setAttribute("data-op-url-phase",name);
    root.toggleAttribute("oneplane-address-unblur",name.startsWith("closing"));
    bar.setAttribute("data-op-url-animating","true");
    bar.setAttribute("data-op-url-fluid","true");
    bar.toggleAttribute("data-op-url-selection-fade",name==="closing-wave"||(from.selection??1)<1);
    bar.style.setProperty("--op-url-live-width",full.toFixed(3)+"px");
    bar.style.setProperty("--op-url-live-clip",frames[0].clipPath);
    bar.style.setProperty("--op-url-selection-alpha",frames[0].selection);
    const timing={duration,easing:"linear",fill:"both"};
    const identity=bar.querySelector("#identity-box");
    try{
      const primary=bar.animate(frames.map(({offset,clipPath})=>({offset,clipPath})),timing);
      addressAnimation=primary;
      watchAddressEffect(a,primary,()=>addressAnimation===primary,true);
      // Verify the cascade, not just support for Element.animate().
      // A user theme can still override clip-path with !important.
      addressAnimation.pause();
      addressAnimation.currentTime=duration/2;
      const mid=window.getComputedStyle(bar).clipPath;
      addressAnimation.currentTime=0;
      const first=window.getComputedStyle(bar).clipPath;
      if(mid===first)throw new Error("Native clip animation overridden");
      const epoch=document.timeline?.currentTime;
      if(!Number.isFinite(epoch)||primary.timeline!==document.timeline)throw Error("Address timeline unavailable");
      primary.startTime=epoch;
      a.epoch=epoch;
      const start=epoch;
      if(identity){
        const effect=identity.animate(frames.map(({offset,translate})=>({offset,translate})),timing);
        addressIdentityAnimation=effect;
        watchAddressEffect(a,effect,()=>addressIdentityAnimation===effect);
        effect.startTime=start;
      }
      if(bar.hasAttribute("data-op-url-selection-fade")){
        const effect=bar.animate(frames.map(({offset,selection})=>({offset,"--op-url-selection-alpha":selection})),timing);
        addressSelectionAnimation=effect;
        watchAddressEffect(a,effect,()=>addressSelectionAnimation===effect);
        effect.startTime=start;
      }
    }catch(error){
      // Compatibility fallback for a conflicting user theme or old Gecko.
      // Normally unused. Preserve a functional native editor.
      stopAddressAnimations();
      a.engine="fallback";delete a.epoch;
      window.console.warn("[OnePlane] Native address animation unavailable:",nocturneErrorClass(error));
      addressClipHome={bar,value:bar.style.getPropertyValue("clip-path"),priority:bar.style.getPropertyPriority("clip-path")};
      a.start=window.performance.now();
      const draw=now=>{
        if(dead||addressTransition!==a)return;
        try{
          const t=Math.max(0,Math.min(1,(now-a.start)/duration));
          const v=addressMotionSample(name,from,to,t);
          bar.style.setProperty("clip-path",addressFluidClip(v.width,header,v.reveal,radius,shape),"important");
          bar.style.setProperty("--op-url-selection-alpha",(v.selection*100).toFixed(3)+"%");
          if(t<1)addressFallbackFrame=window.requestAnimationFrame(draw);
          else finishAddressPhase(a);
        }catch{finishAddressPhase(a,"fallback-failed");}
      };
      draw(a.start);
    }
    if(dead||addressTransition!==a)return;
    try{
      armAddressPhase(a);
      startAddressDiagnostics(a);
      animateTabCascade(name==="opening",a);
    }catch(error){
      try{window.__nocturneTrace?.("address.phase.error",{name:error?.name},{flush:true});}catch{}
      finishAddressPhase(a,"setup-failed");
    }
  }
  function updateAddressAnimation() {
    const bar = addressBar();
    const open = nativeInlineOpen(bar);
    if(addressTransition&&addressTransition.bar!==bar||addressSettleOwner&&addressSettleOwner.bar!==bar){
      clearAddressAnimation();addressWasOpen=open;return;
    }
    if (addressSettling) {
      if (!inlinePopoverPresent(bar)) {
        clearAddressAnimation();
        addressWasOpen = false;
      }
      return;
    }
    if (!open || !addressMotionEnabled()) {
      if (addressTransition) {
        const closing = addressTransition.name.startsWith("closing");
        clearAddressAnimation();
        if(closing&&open&&bar===addressBar()&&!addressTransition&&!addressSettling)finishDismissUrl();
      }
      addressWasOpen = open;
      url.toggleAttribute("data-op-url-ready", open);
      return;
    }
    if (addressWasOpen) return;
    addressWasOpen = true;
    url.removeAttribute("data-op-url-ready");
    const widths = addressWidths();
    // Zen may have already expanded the placeholder before its popover
    // mutation is delivered. Start at the actual compact target, not a
    // potentially fully expanded placeholder.
    beginAddressPhase("opening", { width: widths.compact, reveal: 0 },
      { width: widths.expanded, reveal: 1 }, ADDRESS_WAVE_OPEN);
  }
  function startAddressClose() {
    const bar = addressBar();
    if (!nativeInlineOpen(bar) || !addressMotionEnabled()) return false;
    if (addressSettling || addressTransition?.name.startsWith("closing")) return true;
    holdToolbarAfterDismiss();
    const widths = addressWidths();
    const from = currentAddressVisual() || { width: widths.expanded, reveal: 1, selection:1 };
    // Reverse an interrupted opening from its current visual position.
    // Shrink the width and the result wave together, in one phase.
    const to={width:widths.compact,reveal:0};
    beginAddressPhase("closing-wave",from,to,addressWaveDuration(from,to,widths,ADDRESS_WAVE_CLOSE),widths.expanded);
    return true;
  }
  function onAddressMutation() {
    if (dead) return;
    retireBlockedNativeTabDrag("address-phase");
    retireIncomingDrag();
    updateAddressAnimation();
    reconcileTabCascade();
    if(!addressTransition&&!addressSettling&&!nativeInlineOpen(addressBar()))alignAddressStart();
  }
  function onAddressInput(event) {
    if(event?.isTrusted && (event.type==="pointerdown" || event.type==="input") && restoreSearchTimer)
      cancelStartupSearchRestore("native-address-input");
    // Typing or clicking the real input during closing reverses the close.
    if (!addressSettling && !addressTransition?.name.startsWith("closing")) {
      if(!addressTransition)rememberCompactAddress();
      return;
    }
    const from = currentAddressVisual() || { width: addressWidths().compact, reveal: 0, selection:0 };
    // beginAddressPhase retires the exact old settling owner.
    const widths=addressWidths(),to={width:widths.expanded,reveal:1};
    beginAddressPhase("opening",from,to,addressWaveDuration(from,to,widths,ADDRESS_WAVE_OPEN));
  }
  function alignAddressStart() {
    if (addressFrame) return;
    addressFrame = window.requestAnimationFrame(() => {
      addressFrame = 0;
      if(addressTransition||addressSettling)return;
      const bar = document.getElementById("urlbar");
      const input = addressInput();
      updateEmptyAddress();
      rememberCompactAddress();
      if (!bar?.hasAttribute("focused") && !bar?.hasAttribute("open") && input) {
        input.scrollLeft = 0;
      }
    });
  }
  let restoringAddressTab=null, restoringAddressUntil=0, restoringAddressTimer=0;
  function guardRestoredAddress(tab){
    if(!tab || tab.hasAttribute("zen-empty-tab"))return;
    const mirrored=entries.get(tab)?.item;
    if(!tab.hasAttribute("pending")&&!tab.hasAttribute("discarded")&&
       !mirrored?.hasAttribute("data-op-unloaded"))return;
    restoringAddressTab=tab;
    restoringAddressUntil=window.performance.now()+1500;
    if(restoringAddressTimer)window.clearTimeout(restoringAddressTimer);
    restoringAddressTimer=window.setTimeout(()=>{
      restoringAddressTimer=0;
      restoringAddressTab=null;
      if(dead)return;
      updateEmptyAddress();
      scheduleGeometry();
    },1501);
  }
  function updateEmptyAddress() {
    const tab = browser.selectedTab;
    const spec = tab?.linkedBrowser?.currentURI?.spec || "";
    const pending=Boolean(tab?.hasAttribute("pending")||tab?.hasAttribute("discarded"));
    const restoring=tab===restoringAddressTab && window.performance.now()<restoringAddressUntil;
    const empty=emptyAddressState(Boolean(tab?.hasAttribute("zen-empty-tab")),spec,pending,restoring);
    if(url.hasAttribute("data-op-empty")!==empty){
      url.toggleAttribute("data-op-empty",empty);
      // CSS changes the anchor width synchronously; update its matching
      // spacer bias in the same transaction, before the next paint.
      centerToolbar();
      scheduleGeometry();
    }
  }
  const progressListener = {
    onLocationChange() { updateEmptyAddress(); alignAddressStart(); }
  };
  const actionObserver = new MutationObserver(records => {
    // Native suggestion rows mutate many times during opening. They
    // cannot change the page-action placement; ignore those mutations.
    const selector=actionIds.map(id=>"#"+id).join(",");
    const relevant=records.some(record=>[...record.addedNodes,...record.removedNodes].some(node=>
      node.nodeType===1&&(node.matches?.(selector)||node.querySelector?.(selector))));
    if(!dead&&relevant){movePageActions();if(!addressTransition&&!addressSettling)alignAddressStart();}
  });


  // Keep native customizable toolbar items in their original parent. Only
  // insert two flexible spacers and use CSS ordering for the center group.
  const leftSpacer = html("div");
  leftSpacer.id = "oneplane-center-start";
  const rightSpacer = html("div");
  rightSpacer.id = "oneplane-center-end";
  for (const spacer of [leftSpacer, rightSpacer]) {
    spacer.setAttribute("skipintoolbarset", "true");
    spacer.setAttribute("removable", "false");
    spacer.setAttribute("aria-hidden", "true");
  }
  const navbar = document.getElementById("nav-bar");
  const toolbarWrapper = document.getElementById("zen-appcontent-navbar-wrapper");
  const bookmarks = document.getElementById("PersonalToolbar");
  const surface = html("div");
  surface.id = "oneplane-toolbar-surface";
  surface.setAttribute("aria-hidden", "true");
  // A real element, not a native theme pseudo-element. Keep the background
  // behind the controls and above the web surface without receiving input.
  for (const [name, value] of Object.entries({
    position: "absolute", top: "0", left: "0", right: "0",
    "pointer-events": "none", "z-index": "0",
    "background-color": "var(--op-surface-tint, rgba(21, 23, 30, .34))"
  })) surface.style.setProperty(name, value, "important");
  // Unified Contour: composite the solid silhouette and vertical ramp
  // into ONE alpha mask. Applying opacity to their union prevents the
  // gradient from darkening the already translucent bookmark shelf.
  let captionHome=null, captionNode=null;
  function ensureWindowCaptions(){
    const toolbox=document.getElementById("navigator-toolbox");
    let node;
    try{node=window.gZenVerticalTabsManager?.actualWindowButtons;}catch{}
    if(!navbar||!node||!toolbox?.contains(node))return;
    captionHome?.remove();
    captionHome=document.createComment("OnePlane native captions");
    node.before(captionHome);
    captionNode=node;node.setAttribute("data-zr-native-captions","true");
    if(typeof navbar.moveBefore==="function")navbar.moveBefore(node,null);
    else navbar.append(node);
  }
  function restoreWindowCaptions(){
    if(captionHome?.parentNode && captionNode?.parentNode===navbar){
      const parent=captionHome.parentNode;
      if(typeof parent.moveBefore==="function")parent.moveBefore(captionNode,captionHome);
      else parent.insertBefore(captionNode,captionHome);
    }
    captionNode?.removeAttribute("data-zr-native-captions");
    captionHome?.remove();
    captionHome=captionNode=null;
  }
  function hubPanelWidth(left,right,viewport){
    const room=Math.max(1,viewport-left-8);
    return Math.max(1,Math.min(Math.round(room),Math.max(180,Math.round(right-left))));
  }
  function hubWorkspaceBrowserEligible(tab,active){
    if(!tab||!active||tab.closing||tab.hasAttribute("zen-empty-tab"))return false;
    if(tab.hasAttribute("zen-essential"))return !tab.hidden&&!tab.collapsed;
    return tab.getAttribute("zen-workspace-id")===active;
  }
  function hubWorkspaceSnapshot(manager) {
    try {
      if (!manager || manager.workspaceEnabled === false ||
          typeof manager.getWorkspaces !== "function" || typeof manager.changeWorkspaceWithID !== "function") return null;
      const native = manager.getWorkspaces();
      if (!Array.isArray(native)) return null;
      const seen = new Set(), spaces = [];
      for (const space of native) {
        if (typeof space?.uuid !== "string" || !space.uuid || seen.has(space.uuid)) continue;
        seen.add(space.uuid);
        spaces.push({id:space.uuid,name:typeof space.name==="string" && space.name.trim()?space.name:"Unnamed space",
          icon:typeof space.icon==="string" && space.icon.length<=24 && !space.icon.includes(".svg")?space.icon:"",
          active:space.uuid===manager.activeWorkspace});
      }
      return spaces;
    } catch { return null; }
  }
  function hubTrashAgeMatches(stamp,age,now){
    if(age==="all")return true;
    const duration={"5m":300000,"1h":3600000,"1d":86400000,"7d":604800000,"30d":2592000000,"1y":31536000000}[age];
    return Number.isFinite(duration)&&Number.isFinite(stamp)&&stamp>0&&Number.isFinite(now)&&now-stamp>=duration;
  }
  function hubWorkspaceOrder(spaces,free,trash){
    return Array.isArray(spaces)?spaces.filter(s=>s.id!==trash).sort((a,b)=>Number(b.id===free)-Number(a.id===free)):null;
  }
  function hubTrashTabEligible(tab){
    return !!tab&&!tab.closing&&!tab.group&&!tab.hasAttribute("zen-essential")&&!tab.hasAttribute("zen-empty-tab")&&
      !tab.hasAttribute("split-view")&&!tab.hasAttribute("glance-id")&&!tab.hasAttribute("zen-glance-tab")&&
      !tab.querySelector?.(".tabbrowser-tab[glance-id],.tabbrowser-tab[zen-glance-tab]");
  }
  function hubTrashRange(count,scroll,height,row=54,overscan=3){
    const n=Math.max(0,Math.floor(count)||0),size=Math.max(1,row||54);
    const first=Math.min(n,Math.max(0,Math.floor(Math.max(0,scroll||0)/size)-overscan));
    const end=Math.min(n,Math.max(first,Math.ceil((Math.max(0,scroll||0)+Math.max(0,height||0))/size)+overscan));
    return {first,end,top:first*size,bottom:(n-end)*size};
  }
  function hubTrashRelativeAge(stamp,now){
    if(!Number.isFinite(stamp)||stamp<=0)return "Unknown";
    const m=Math.max(0,Math.floor((now-stamp)/60000));
    return m<1?"Just now":m<60?m+" min":m<1440?Math.floor(m/60)+" h":m<525600?Math.floor(m/1440)+" d":Math.floor(m/525600)+" y";
  }
  function hubTrashAgeOptions(){
    return [["all","All tabs","All tabs"],["5m","5 min+","Older than 5 minutes"],["1h","1 hour+","Older than 1 hour"],["1d","1 day+","Older than 1 day"],["7d","7 days+","Older than 7 days"],["30d","30 days+","Older than 30 days"],["1y","1 year+","Older than 1 year"]];
  }
  function hubTrashFlightGeometry(rect,release,dest,panel){
    if(!rect||!release||!dest||!panel||![rect.width,rect.height,release.x,release.y,dest.left,dest.top,dest.width,dest.height,panel.left,panel.top,panel.right,panel.bottom].every(Number.isFinite)||rect.width<=0||rect.height<=0)return null;
    if(release.x<panel.left||release.x>panel.right||release.y<panel.top||release.y>panel.bottom)return null;
    const x=Math.max(panel.left,Math.min(panel.right-rect.width,release.x-Math.min(20,rect.width/2)));
    const y=Math.max(panel.top,Math.min(panel.bottom-rect.height,release.y-rect.height/2));
    return {x,y,dx:dest.left+dest.width/2-x-rect.width/2,dy:dest.top+dest.height/2-y-rect.height/2};
  }
  // One owner/token per window, invalidated before callbacks run. A late
  // pointerup, dragend or timeout cannot complete a cancelled/new gesture.
  function createDragLifecycle(){
    let active=null,sequence=0;
    return {
      current:()=>active,
      begin(kind,handlers={}){
        if(active) return null;
        const token=++sequence;
        active={...handlers,kind,token};return token;
      },
      owns(token,kind){return !!active&&active.token===token&&(!kind||active.kind===kind);},
      finish(token){
        if(!active||active.token!==token)return false;
        active=null;return true;
      },
      cancel(reason,token=active?.token){
        if(!active||active.token!==token)return false;
        const previous=active;active=null;previous.onCancel?.(reason);return true;
      }
    };
  }
  function dragPointerSignal(event,pointerId){
    if(event.pointerId!==pointerId)return "ignore";
    if(event.type==="pointercancel"||event.type==="lostpointercapture")return "cancel";
    if(event.type==="pointerup")return event.button===0?"drop":"cancel";
    if(event.type==="pointermove"&&!(event.buttons&1))return "cancel";
    return event.type==="pointermove"?"move":"ignore";
  }
  function dragInterruptionKey(event){
    return event.key==="Escape"||event.key==="PrintScreen"||
      Boolean((event.metaKey||event.osKey)&&event.shiftKey&&String(event.key).toLowerCase()==="s");
  }
  function dragEndMatches(identity,event,tab){
    return !!identity&&identity.target===event?.target&&identity.tab===tab;
  }
  // Drag Engine: lifecycle only. Geometry/rendering and native tab
  // operations remain separate. No polling while idle.
  const dragLifecycle=createDragLifecycle();
  let nativeDragToken=null,nativeDragIdentity=null,dragWatchTimer=0,dragMissingSessions=0,dragUnknownSessions=0,dragFallbackTimer=0;
  // Gesture-local native topology witness, not a second tab data store.
  let nativeDragTopology=null;
  function readNativeDragTopology(source){
    try{
      const manager=window.gZenWorkspaces??null;
      return {source,manager,workspace:manager?.activeWorkspace??null,
        tabs:readStripTopology().tabs.map(({tab,group,split,pinned})=>({
          tab,group,split,pinned,parent:tab.parentElement,
          workspaceId:tab.getAttribute?.("zen-workspace-id")??null
        }))};
    }catch{return null;}
  }
  function nativeDragStructureMatches(){
    const a=nativeDragTopology;
    if(!a||!validNativeTab(a.source)||tabOwner(a.source)!==window)return false;
    const b=readNativeDragTopology(a.source);
    return !!b&&a.manager===b.manager&&a.workspace===b.workspace&&
      a.tabs.length===b.tabs.length&&a.tabs.every((v,i)=>{
        const n=b.tabs[i];
        return v.tab===n.tab&&v.group===n.group&&v.split===n.split&&v.pinned===n.pinned&&
          v.parent===n.parent&&v.workspaceId===n.workspaceId;
      });
  }
  function nativeDragTopologyCurrent(){
    return nativeDragToken!==null&&nativeDragIdentity?.token===nativeDragToken&&
      dragLifecycle.owns(nativeDragToken,"tab")&&nativeDragStructureMatches();
  }
  function retireChangedNativeDragTopology(stage="native-change"){
    const active=nativeDragToken!==null&&dragLifecycle.owns(nativeDragToken,"tab");
    const tail=!active&&dragInsertPending&&!!nativeDragTopology;
    if(!active&&!tail)return false;
    // The native TabMove generated by our own accepted local drop belongs
    // to its in-flight transaction; do not cancel the commit from its event.
    if(active&&row.hasAttribute("data-op-drag-commit"))return false;
    if(nativeDragStructureMatches())return false;
    window.__nocturneTrace?.("drag.topology.changed",()=>({
      stage,token:active?nativeDragToken:null,tail,previous:nativeDragTopology?.tabs.length??0,
      sourceValid:!!nativeDragTopology?.source&&validNativeTab(nativeDragTopology.source)
    }),{sample:1200});
    if(active)cancelActiveDrag("native-topology-changed");
    else endDragVisual();
    return true;
  }
  const dragService=()=>Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService);
  function stopNativeDragWatch(){
    if(dragWatchTimer)window.clearTimeout(dragWatchTimer);
    dragWatchTimer=0;dragMissingSessions=0;dragUnknownSessions=0;
    if(dragFallbackTimer)window.clearTimeout(dragFallbackTimer);dragFallbackTimer=0;
  }
  function watchNativeDrag(token){
    stopNativeDragWatch();
    const check=()=>{
      dragWatchTimer=0;
      if(!dragLifecycle.owns(token,"tab"))return;
      // A parent-process native session spans browser windows. A short
      // grace period avoids transient gaps at native drag startup/teardown.
      let session;
      try{
        const service=dragService();
        session=typeof service.getCurrentSession==="function"?service.getCurrentSession(window):undefined;
      }catch{session=undefined;}
      if(session){
        dragMissingSessions=0;dragUnknownSessions=0;
      }else if(session===null){
        dragUnknownSessions=0;
        if(++dragMissingSessions>=3){dragLifecycle.cancel("native-session-ended",token);return;}
      }else{
        // Missing API/throws are UNKNOWN, not evidence of a live session.
        // Bound local cleanup without ever synthesizing an OS drop.
        dragMissingSessions=0;
        if(++dragUnknownSessions>=6){dragLifecycle.cancel("native-session-unavailable",token);return;}
      }
      if(dragLifecycle.owns(token,"tab"))dragWatchTimer=window.setTimeout(check,250);
    };
    dragWatchTimer=window.setTimeout(check,250);
  }
  function clearSourceIncoming(token,exceptWindow=null){
    if(token===null)return;
    try{
      const wins=Services.wm.getEnumerator("navigator:browser");
      while(wins.hasMoreElements()){
        const win=wins.getNext();
        if(win!==window&&win!==exceptWindow&&!win.closed){
          try{win[DRAG_CONTROLLER]?.clearIncoming?.(dragController,token);}catch{}
        }
      }
    }catch{}
  }
  function cancelNativeDrag(reason){
    const cancelledToken=nativeDragToken;
    typeof window!=="undefined"&&window.__nocturneTrace?.("drag.lifecycle.cancel",()=>({reason,token:nativeDragToken,mode:dragImageMode}),{sample:1800});
    nativeDragToken=null;nativeDragIdentity=null;stopNativeDragWatch();
    dragHandled=true;dragStartPoint=null;draggedTab=null;draggedGroup=null;
    // Do not reopen the start-page search after an interrupted OS gesture.
    dragSearch=null;pointerSearch=null;
    cancelStartupSearchRestore("drag-cancel");
    try{endDragVisual();}finally{clearSourceIncoming(cancelledToken);}
  }
  function startNativeDragLifecycle(event,tab){
    if(dragLifecycle.current())dragLifecycle.cancel("superseded");
    const topology=readNativeDragTopology(tab);
    if(!topology||!topology.tabs.some(slot=>slot.tab===tab)||
       !validNativeTab(tab)||tabOwner(tab)!==window)return false;
    nativeDragToken=dragLifecycle.begin("tab",{onCancel:cancelNativeDrag});
    nativeDragTopology=nativeDragToken!==null?topology:null;
    typeof window!=="undefined"&&window.__nocturneTrace?.("drag.lifecycle.begin",()=>({token:nativeDragToken}),{sample:1800});
    if(nativeDragToken!==null){nativeDragIdentity={target:event.target,tab,token:nativeDragToken};watchNativeDrag(nativeDragToken);}
    return nativeDragToken!==null;
  }
  function finishNativeDragLifecycle(event=null,tab=null){
    if(event&&!dragEndMatches(nativeDragIdentity,event,tab))return false;
    const token=nativeDragToken;
    if(token===null||nativeDragIdentity?.token!==token||!dragLifecycle.owns(token,"tab"))return false;
    nativeDragToken=null;nativeDragIdentity=null;stopNativeDragWatch();
    return dragLifecycle.finish(token);
  }
  function cancelActiveDrag(reason){
    if(dragInsertPending)endDragVisual();
    return dragLifecycle.cancel(reason);
  }
  function installDragEngine(){
    const capture=true,handlers=[];
    const listen=(node,type,fn)=>{node.addEventListener(type,fn,capture);handlers.push([node,type,fn]);};
    function pointer(event){
      const current=dragLifecycle.current();
      if(!current||!["workspace","trash"].includes(current.kind)||!event.isTrusted)return;
      const signal=dragPointerSignal(event,current.pointerId);
      if(signal==="cancel")dragLifecycle.cancel(event.type,current.token);
      else if(signal==="move")current.onMove?.(event);
      else if(signal==="drop")current.onUp?.(event);
    }
    function freshPointer(event){
      if(!event.isTrusted)return;
      if(restoreSearchTimer)cancelStartupSearchRestore("new-pointerdown");
      if(dragLifecycle.current()||dragInsertPending)cancelActiveDrag("new-pointerdown");
    }
    function mouseFallback(event){
      if(!event.isTrusted)return;
      const current=dragLifecycle.current();
      if(["workspace","trash"].includes(current?.kind)&&(event.type==="mouseup"||!(event.buttons&1)))
        dragLifecycle.cancel("mouse-release-without-pointerup",current.token);
      // Native HTML DnD owns its own button state: drag events often report
      // buttons=0. Never infer a tab drop from mousemove.
    }
    function keyboard(event){
      if(!event.isTrusted)return;
      if(restoreSearchTimer)cancelStartupSearchRestore("new-keydown");
      if(!dragLifecycle.current()||!dragInterruptionKey(event))return;
      const kind=dragLifecycle.current().kind;
      cancelActiveDrag("keyboard-interruption");
      if(event.key==="Escape"&&["workspace","trash"].includes(kind)){event.preventDefault();event.stopImmediatePropagation();}
      // Let Gecko/OS receive Escape for a native tab drag and screenshot keys.
    }
    function focusLost(event){
      // Descendant focus transitions must not cancel an active gesture.
      if(event.type==="blur"&&event.target!==window&&event.target!==document)return;
      // Native DnD can move across windows without ending its OS session.
      // Cancel the workspace pointer gesture immediately; for tab drag,
      // hide the transient chrome and let its session watchdog/dragend own
      // completion. Explicit OS interruption keys cancel both.
      if(["workspace","trash"].includes(dragLifecycle.current()?.kind))cancelActiveDrag("focus-lost");
      else if(dragLifecycle.current()?.kind==="tab"){
        clearPlacementPreview(true);
        // Deactivation can also be an ordinary native cross-window drag.
        // Do not commit/abort solely on focus change while the OS owns it.
      }
    }
    function hidden(){if(document.hidden)cancelActiveDrag("document-hidden");}
    function nativeEnd(event){
      const current=dragLifecycle.current();
      if(current?.kind!=="tab"||!event.isTrusted)return;
      if(event.type==="dragend"&&event.target!==nativeDragIdentity?.target)return;
      // The source node's own dragend/drop listeners must run first.
      // A fallback timeout is token-scoped if they never run.
      if(dragFallbackTimer)window.clearTimeout(dragFallbackTimer);
      dragFallbackTimer=window.setTimeout(()=>{
        dragFallbackTimer=0;
        dragLifecycle.cancel("unhandled-native-end",current.token);
      },0);
    }
    for(const type of ["pointermove","pointerup","pointercancel","lostpointercapture"])listen(window,type,pointer);
    listen(window,"pointerdown",freshPointer);
    listen(window,"mousemove",mouseFallback);listen(window,"mouseup",mouseFallback);
    listen(window,"keydown",keyboard);
    listen(window,"blur",focusLost);listen(window,"deactivate",focusLost);
    listen(document,"visibilitychange",hidden);listen(window,"pagehide",()=>cancelActiveDrag("pagehide"));
    listen(window,"dragend",nativeEnd);listen(window,"drop",nativeEnd);
    return ()=>{
      for(const [node,type,fn] of handlers)node.removeEventListener(type,fn,capture);
      cancelActiveDrag("unload");stopNativeDragWatch();
    };
  }
  let releaseDragEngine=()=>{};
  // All geometry below is in global desktop pixels; no CSS coordinates.
  function displayContains(rect,x,y){
    return !!rect&&[rect.x,rect.y,rect.width,rect.height,x,y].every(Number.isFinite)&&
      rect.width>0&&rect.height>0&&x>=rect.x&&x<rect.x+rect.width&&y>=rect.y&&y<rect.y+rect.height;
  }
  function displayCssPoint(x,y,cssToDevice,desktopToDevice){
    if(![x,y,cssToDevice,desktopToDevice].every(Number.isFinite)||cssToDevice<=0||desktopToDevice<=0)return null;
    const scale=cssToDevice/desktopToDevice;
    return {x:Math.round(x*scale),y:Math.round(y*scale)};
  }
  function displayRectEqual(a,b){
    return !!a&&!!b&&["x","y","width","height"].every(k=>a[k]===b[k]);
  }
  function displaySnapTarget(full,work,x,y){
    if(!displayContains(full,x,y)||!displayContains(full,work?.x,work?.y)||
       !displayContains(full,work.x+work.width-1,work.y+work.height-1))return null;
    // Classify on the physical display, not the inset work area. A taskbar
    // is part of the hit surface, but never part of the target window.
    const horizontalEdge=Math.max(1,Math.round(full.width*.22)),verticalEdge=Math.max(1,Math.round(full.height*.18));
    const l=x-full.x,r=full.x+full.width-1-x,t=y-full.y,b=full.y+full.height-1-y;
    const h=l<horizontalEdge?"left":r<horizontalEdge?"right":"";
    const v=t<verticalEdge?"top":b<verticalEdge?"bottom":"";
    const {x:wx,y:wy,width:w,height:ht}=work,hw=Math.floor(w/2),hh=Math.floor(ht/2);
    let rect;
    if(h&&v)rect={x:h==="left"?wx:wx+hw,y:v==="top"?wy:wy+hh,width:h==="left"?hw:w-hw,height:v==="top"?hh:ht-hh,mode:h+"-"+v};
    else if(v==="top")rect={...work,mode:"maximize"};
    else if(h)rect={x:h==="left"?wx:wx+hw,y:wy,width:h==="left"?hw:w-hw,height:ht,mode:h};
    else if(v==="bottom")rect={x:wx,y:wy+hh,width:w,height:ht-hh,mode:"bottom"};
    else {
      const width=Math.round(w*.72),height=Math.round(ht*.74);
      rect={x:wx+Math.floor((w-width)/2),y:wy+Math.floor((ht-height)/2),width,height,mode:"center"};
    }
    return {...rect,full:{...full},work:{...work}};
  }
  function displayNativeRect(rect,desktopToDevice){
    if(!rect||![rect.x,rect.y,rect.width,rect.height,desktopToDevice].every(Number.isFinite)||
       rect.width<=0||rect.height<=0||desktopToDevice<=0)return null;
    return {x:Math.round(rect.x*desktopToDevice),y:Math.round(rect.y*desktopToDevice),
      width:Math.round(rect.width*desktopToDevice),height:Math.round(rect.height*desktopToDevice)};
  }
  // Preview identity must include the current work area: taskbar/dock
  // changes can move the same snap mode within an unchanged monitor.
  // This is a presentation cache key, never an authority for OS placement.
  function displayPreviewKey(target,label){
    if(!target?.full||!target?.work||typeof target.mode!=="string"||typeof label!=="string")return null;
    const f=target.full,w=target.work;
    const dimensions=[f.x,f.y,f.width,f.height,w.x,w.y,w.width,w.height,
      target.x,target.y,target.width,target.height];
    if(!dimensions.every(Number.isFinite)||f.width<=0||f.height<=0||
       w.width<=0||w.height<=0||target.width<=0||target.height<=0)return null;
    return [label,target.mode,...dimensions].join(":");
  }
  function displayPreviewFraction(target){
    if(!target||!displayContains(target.full,target.x,target.y)||
       !displayContains(target.full,target.x+target.width-1,target.y+target.height-1))return null;
    const f=target.full;
    return {x:(target.x-f.x)/f.width,y:(target.y-f.y)/f.height,width:target.width/f.width,height:target.height/f.height};
  }
  function displayReleaseMatches(sample,token,x,y,now){
    return !!sample&&sample.token===token&&[x,y,now,sample.x,sample.y,sample.time].every(Number.isFinite)&&
      now>=sample.time&&now-sample.time<=400&&Math.hypot(x-sample.x,y-sample.y)<=16;
  }
  function tabReturnZone(x,y,rect,height){
    return !!rect&&[x,y,rect.left,rect.right,rect.top,height].every(Number.isFinite)&&
      x>=rect.left&&x<rect.right&&y>=Math.max(0,rect.top)&&y<Math.max(0,rect.top)+Math.max(0,height);
  }
  // Native creation uses the selected rectangle, not a uniform center seed.
  // For maximize, start at the work area and apply native maximize separately.
  function displayStartupFeatures(target,openerScale,destinationScale,openerZoom=1){
    const w=target?.work;
    if(!w||!displayContains(w,target.x,target.y)||
       !displayContains(w,target.x+target.width-1,target.y+target.height-1)||
       ![openerScale,destinationScale,openerZoom].every(n=>Number.isFinite(n)&&n>0)||
       !Number.isFinite(target.width)||!Number.isFinite(target.height)||target.width<=0||target.height<=0)return null;
    return {left:Math.round(target.x/openerScale),top:Math.round(target.y/openerScale),
      outerWidth:Math.max(1,Math.round(target.width/(destinationScale*openerZoom))),
      outerHeight:Math.max(1,Math.round(target.height/(destinationScale*openerZoom)))};
  }
  function displayPlacementMatches(target,actual,maximized=false,tolerance=8){
    if(!target?.full||!actual||![actual.x,actual.y,actual.width,actual.height,tolerance].every(Number.isFinite)||
       actual.width<=0||actual.height<=0||tolerance<0||
       !displayContains(target.full,actual.x+actual.width/2,actual.y+actual.height/2))return false;
    if(target.mode==="maximize")return maximized;
    return !maximized&&["x","y","width","height"].every(k=>Number.isFinite(target[k])&&Math.abs(actual[k]-target[k])<=tolerance);
  }
  // Display Engine: Windows first. Gecko's chrome MouseEvent.screen and
  // nsIBaseWindow expose the native monitor and desktop/device pixel scales.
  // A compact native panel is allowed on the target display; never a desktop-sized overlay.
  const DISPLAY_SNAP_PREF="zen.oneplane.experimental-display-snap";
  let placementPreview=null,placementMap=null,placementArea=null,placementLabel=null,placementKey="",placementMonitor=null,placementSample=null,placementPopupPoint=null;
  const screenManager=()=>Cc["@mozilla.org/gfx/screenmanager;1"].getService(Ci.nsIScreenManager);
  function nativeBase(win){
    const owner=win.docShell.QueryInterface(Ci.nsIDocShellTreeItem).treeOwner;
    try{return owner.QueryInterface(Ci.nsIBaseWindow);}
    catch{return owner.QueryInterface(Ci.nsIInterfaceRequestor).getInterface(Ci.nsIBaseWindow);}
  }
  function displaySnapEnabled(){
    return Services.appinfo.OS==="WINNT"&&prefs.getBoolPref(DISPLAY_SNAP_PREF,true);
  }
  function screenRect(screen,work=false){
    if(!screen)return null;
    const l={},t={},w={},h={};
    if(work)screen.GetAvailRectDisplayPix(l,t,w,h);else screen.GetRectDisplayPix(l,t,w,h);
    const rect={x:l.value,y:t.value,width:w.value,height:h.value};
    return displayContains(rect,rect.x,rect.y)?rect:null;
  }
  function nativeWindowRect(win){
    try{
      const base=nativeBase(win),x={},y={},w={},h={},scale=base.devicePixelsPerDesktopPixel;
      if(!Number.isFinite(scale)||scale<=0)return null;
      base.getPositionAndSize(x,y,w,h);
      const rect={x:Math.round(x.value/scale),y:Math.round(y.value/scale),width:Math.round(w.value/scale),height:Math.round(h.value/scale)};
      return displayContains(rect,rect.x,rect.y)?rect:null;
    }catch{return null;}
  }
  function displayEventPoint(event){
    if(!displaySnapEnabled()||!event?.isTrusted)return null;
    try{
      const eventWin=event.view?.gBrowser?event.view:event.target?.ownerDocument?.defaultView;
      const source=eventWin?.gBrowser?eventWin:window;
      const base=nativeBase(source);
      const point=displayCssPoint(event.screenX,event.screenY,source.devicePixelRatio,base.devicePixelsPerDesktopPixel);
      if(!point)return null;
      // Gecko's screen getter uses the same CSS->desktop conversion as
      // MouseEvent::ScreenPointDesktopPix. Validate it against our result.
      const resolved=event.screen;
      if(!resolved)return null;
      const full=screenRect(resolved),work=screenRect(resolved,true);
      if(!displayContains(full,point.x,point.y)||!work)return null;
      const checked=screenRect(screenManager().screenForRect(point.x,point.y,1,1));
      if(!displayRectEqual(full,checked))return null;
      return {...point,full,work};
    }catch{return null;}
  }
  function pointInSourceWindow(event){
    const p=displayEventPoint(event),rect=nativeWindowRect(window);
    if(p&&rect)return displayContains(rect,p.x,p.y);
    const x=event.screenX,y=event.screenY;
    return x>=window.screenX&&x<window.screenX+window.outerWidth&&y>=window.screenY&&y<window.screenY+window.outerHeight;
  }
  function placementAt(event,release=false){
    if(!displaySnapEnabled())return null;
    const p=displayEventPoint(event),rect=nativeWindowRect(window);
    if(p&&rect)return displayContains(rect,p.x,p.y)?null:displaySnapTarget(p.full,p.work,p.x,p.y);
    // Some native dragend events lose the screen/widget context. Only
    // reuse a recent observation of the SAME gesture and release point.
    const token=dragLifecycle.current()?.token;
    if(release&&event?.isTrusted&&displayReleaseMatches(placementSample,token,event.screenX,event.screenY,window.performance.now()))
      return placementSample.target;
    return null;
  }
  function clearPlacementPreview(remove=false){
    placementKey="";placementSample=null;placementMonitor=null;placementPopupPoint=null;
    if(placementPreview){
      const popup=placementPreview;
      try{if(popup.state!=="closed")popup.hidePopup();}catch{}
      if(remove){popup.remove();placementPreview=placementMap=placementArea=placementLabel=null;}
    }
  }
  function showPlacementPreview(event,label){
    const previousWork=placementSample?.target?.work;
    const p=placementAt(event),fraction=displayPreviewFraction(p),token=dragLifecycle.current()?.token;
    if(!p||!fraction||token==null){clearPlacementPreview();return;}
    placementSample={token,x:event.screenX,y:event.screenY,time:window.performance.now(),target:p};
    const monitor=[p.full.x,p.full.y,p.full.width,p.full.height].join(":");
    const key=displayPreviewKey(p,label);
    if(!key){clearPlacementPreview();return;}
    if(key===placementKey)return;
    try{
      if(!placementPreview){
        const set=document.getElementById("mainPopupSet");if(!set)return;
        placementPreview=document.createXULElement("panel");placementPreview.id="oneplane-placement-preview";
        for(const [k,v] of Object.entries({noautohide:"true",noautofocus:"true",mousethrough:"always",level:"top","aria-hidden":"true"}))placementPreview.setAttribute(k,v);
        const content=html("div","op-placement-content");
        placementMap=html("div","op-placement-map");placementArea=html("div","op-placement-area");
        placementLabel=html("div","op-placement-label");
        placementMap.append(placementArea);content.append(placementMap,placementLabel);placementPreview.append(content);set.append(placementPreview);
        placementPreview.addEventListener("popupshown",()=>{
          if(!placementSample||!dragLifecycle.owns(placementSample.token)){clearPlacementPreview(true);return;}
          // If Gecko constrained the small popup to another monitor,
          // hide it instead of misleading the user. The drop target is
          // still valid independently of popup rendering.
          try{
            const r=placementPreview.getOuterScreenRect(),scale=window.devicePixelRatio/nativeBase(window).devicePixelsPerDesktopPixel;
            const target=placementSample.target.full;
            if(!r.width||!r.height||!displayContains(target,(r.x+r.width/2)*scale,(r.y+r.height/2)*scale)){
              placementPreview.hidePopup();
            }
          }catch{try{placementPreview.hidePopup();}catch{}}
        });
      }
      const ratio=p.full.width/p.full.height;
      placementMap.style.width=Math.round(Math.min(160,92*ratio))+"px";
      placementMap.style.height=Math.round(Math.min(92,160/ratio))+"px";
      for(const [name,value] of Object.entries({left:fraction.x,top:fraction.y,width:fraction.width,height:fraction.height}))
        placementArea.style[name]=value*100+"%";
      const mode=p.mode==="maximize"?"Maximize":p.mode==="center"?"Centered":p.mode;
      placementLabel.textContent=label+" · "+mode;
      // XULPopupElement takes CSS screen coordinates in the SOURCE
      // document's scale, not destination desktop or CSS coordinates.
      const scale=window.devicePixelRatio/nativeBase(window).devicePixelsPerDesktopPixel;
      if(!Number.isFinite(scale)||scale<=0)return;
      const x=Math.round((p.work.x+p.work.width/2)/scale-105);
      const y=Math.round((p.work.y+Math.min(90,p.work.height*.12))/scale);
      const changedMonitor=placementMonitor!==monitor;
      const movedAnchor=changedMonitor||!placementPopupPoint||
        placementPopupPoint.x!==x||placementPopupPoint.y!==y;
      placementPopupPoint={x,y};placementMonitor=monitor;placementKey=key;
      if(!changedMonitor&&previousWork&&!displayRectEqual(previousWork,p.work))
        window.__nocturneTrace?.("drag.placement.preview",{reason:"work-area-change",movedAnchor},{throttle:1000});
      if(placementPreview.state==="open"){
        if(movedAnchor)placementPreview.moveTo(x,y);
      }else if(placementPreview.state==="showing"){
        if(movedAnchor)placementPreview.addEventListener("popupshown",()=>{
          if(placementSample&&placementPopupPoint&&placementPreview?.state==="open")placementPreview.moveTo(placementPopupPoint.x,placementPopupPoint.y);
        },{once:true});
      }else if(placementPreview.state==="hiding"){
        placementPreview.addEventListener("popuphidden",()=>{
          if(placementSample&&placementPopupPoint&&placementPreview?.state==="closed")placementPreview.openPopupAtScreen(placementPopupPoint.x,placementPopupPoint.y,false);
        },{once:true});
      }else placementPreview.openPopupAtScreen(x,y,false);
    }catch(error){console.warn("[OnePlane] Display preview:",nocturneErrorClass(error));try{placementPreview?.hidePopup();}catch{}}
  }
  function targetScreen(target){
    if(!target)return null;
    const f=target.full;
    const screen=screenManager().screenForRect(f.x+Math.floor(f.width/2),f.y+Math.floor(f.height/2),1,1);
    return displayRectEqual(f,screenRect(screen))&&displayRectEqual(target.work,screenRect(screen,true))?screen:null;
  }
  function nativeStartupFeatures(target){
    if(!displaySnapEnabled()||!target)return null;
    try{
      const screen=targetScreen(target);
      if(!screen)return null;
      const openerScale=window.devicePixelRatio/nativeBase(window).devicePixelsPerDesktopPixel;
      const destinationScale=screen.defaultCSSScaleFactor/screen.contentsScaleFactor;
      const zoom=window.browsingContext?.fullZoom||1;
      return displayStartupFeatures(target,openerScale,destinationScale,zoom);
    }catch(error){console.warn("[OnePlane] Startup display features:",nocturneErrorClass(error));return null;}
  }
  function logPlacement(stage,target,actual=null,extra=null){
    console.info("[OnePlane] Display placement "+stage,JSON.stringify({target:target?.full,rect:target?{x:target.x,y:target.y,width:target.width,height:target.height}:null,mode:target?.mode,actual,extra}));
  }
  // The startup window already has the selected target rectangle. If
  // nsIBaseWindow geometry is unavailable, check the child's native Screen
  // rectangle using the target's CSS scale, never guess the display.
  function childOnTargetScreen(win,target){
    try{
      const screen=targetScreen(target);
      if(!screen)return false;
      const scale=screen.defaultCSSScaleFactor/screen.contentsScaleFactor;
      if(!Number.isFinite(scale)||scale<=0)return false;
      const actual=win.screen,full=target.full;
      return ["x","y","width","height"].every((k,i)=>{
        const v=actual[["left","top","width","height"][i]];
        return Number.isFinite(v)&&Math.abs(v*scale-full[k])<=3;
      });
    }catch{return false;}
  }
  async function placeNativeWindow(win,target,alive,wait){
    if(!displaySnapEnabled()||!win||!target||!alive())return false;
    const valid=()=>alive()&&!!targetScreen(target)&&alive();
    const requireCurrent=()=>{if(!valid())throw Error("Placement no longer current");};
    const stateMax=()=>win.windowState===win.STATE_MAXIMIZED;
    const matches=()=>displayPlacementMatches(target,nativeWindowRect(win),stateMax())||
      (target.mode==="maximize"&&stateMax()&&childOnTargetScreen(win,target));
    const validTarget=valid;
    const confirmed=()=>valid()&&matches()&&valid();
    try{
      const full=target.full,work=target.work;
      const onTarget=rect=>rect&&displayContains(full,rect.x+Math.floor(rect.width/2),rect.y+Math.floor(rect.height/2));
      if(!validTarget()){logPlacement("target-disconnected",target);return false;}
      logPlacement("before",target,nativeWindowRect(win),win.windowState);
      if(confirmed()){logPlacement("already-matched",target,nativeWindowRect(win));return confirmed();}
      // Maximize a correctly positioned window directly; do not make this
      // depend on a subsequent resize, tab loading or a workspace switch.
      if(target.mode==="maximize"&&(onTarget(nativeWindowRect(win))||childOnTargetScreen(win,target))&&win.windowState!==win.STATE_MINIMIZED){
        for(let attempt=0;attempt<3;attempt++){
          if(!alive()||!validTarget())return false;
          if(!stateMax()){logPlacement("maximize-request",target,nativeWindowRect(win),win.windowState);requireCurrent();win.maximize();}
          await wait();
          if(!alive())return false;
          if(confirmed()){logPlacement("maximize",target,nativeWindowRect(win),win.windowState);return confirmed();}
        }
      }
      requireCurrent();
      const base=nativeBase(win);
      requireCurrent();
      if(stateMax()||win.windowState===win.STATE_MINIMIZED){requireCurrent();win.restore();await wait();}
      if(!alive())return false;
      const seed=displaySnapTarget(full,work,full.x+Math.floor(full.width/2),full.y+Math.floor(full.height/2));
      function nativeSize(rect){
        const n=displayNativeRect(rect,base.devicePixelsPerDesktopPixel);
        if(!n)throw Error("Invalid native display scale");
        requireCurrent();base.setSize(n.width,n.height,true);
      }
      function cssApply(rect,resize=true){
        const scale=win.devicePixelRatio/base.devicePixelsPerDesktopPixel;
        if(!Number.isFinite(scale)||scale<=0)throw Error("Invalid CSS display scale");
        requireCurrent();
        if(resize)win.resizeTo(Math.round(rect.width/scale),Math.round(rect.height/scale));
        requireCurrent();win.moveTo(Math.round(rect.x/scale),Math.round(rect.y/scale));
      }
      // Retain .23's working monitor-selection path, but only use the
      // center seed for recovering an off-monitor window.
      if(!onTarget(nativeWindowRect(win))){
        try{nativeSize(seed);}catch{cssApply(seed);}
        for(let attempt=0;attempt<4;attempt++){
          if(!alive()||!validTarget())return false;
          try{
            requireCurrent();
            if(attempt<2)base.setPositionDesktopPix(seed.x,seed.y);
            else cssApply(seed,false);
          }catch{cssApply(seed,false);}
          await wait();
          const actual=nativeWindowRect(win);
          logPlacement("move-"+(attempt+1),target,actual);
          if(onTarget(actual))break;
          if(attempt===3)return false;
        }
      }
      if(!alive()||!validTarget())return false;
      if(target.mode==="maximize"){
        requireCurrent();win.maximize();await wait();
        logPlacement("maximize",target,nativeWindowRect(win),win.windowState);
        return confirmed();
      }
      for(let attempt=0;attempt<2;attempt++){
        if(!alive()||!validTarget())return false;
        try{
          if(attempt===0){nativeSize(target);requireCurrent();base.setPositionDesktopPix(target.x,target.y);}
          else cssApply(target);
        }catch{cssApply(target);}
        await wait();
        if(!alive())return false;
        const actual=nativeWindowRect(win);
        logPlacement("size-"+(attempt+1),target,actual);
        if(confirmed())return true;
      }
      // An OS minimum size may make the exact quarter impossible. Keep
      // the real window/tab intact, but do not call this a successful snap.
      const actual=nativeWindowRect(win);
      if(alive()&&onTarget(actual)&&actual.width<=work.width&&actual.height<=work.height){
        const x=Math.max(work.x,Math.min(work.x+work.width-actual.width,target.x));
        const y=Math.max(work.y,Math.min(work.y+work.height-actual.height,target.y));
        if(Math.abs(actual.x-x)>2||Math.abs(actual.y-y)>2)try{requireCurrent();base.setPositionDesktopPix(x,y);}catch{}
      }
      logPlacement("size-unverified",target,nativeWindowRect(win));
      return false;
    }catch(error){if(alive()){logPlacement("exception",target,nativeWindowRect(win),{reason:"native-error"});console.warn("[OnePlane] Native display placement:",nocturneErrorClass(error));}return false;}
  }
  // Both creation paths schedule this immediately. Native window placement
  // must finish even when workspace initialization or activation fails.
  // Cancel on genuine interaction, close, teardown or startup timeout.
  function placeAfterStartup(win,target,stillWanted=()=>true){
    if(!displaySnapEnabled()||!win||!target||dead||mountScope.closed)return Promise.resolve(false);
    return new Promise(resolve=>{
      let done=false,applying=false,armed=false,observed=false,release=()=>{},timer=0,poll=0;
      const scope=createDisposableScope({onError:()=>{try{logPlacement("startup-cleanup-error",target);}catch{}}});
      const alive=()=>{
        try{return !done&&!dead&&!mountScope.closed&&!window.closed&&!win.closed&&displaySnapEnabled()&&stillWanted();}
        catch{return false;}
      };
      const finish=(ok,reason)=>{
        if(done)return;done=true;
        const result=scope.dispose();
        try{release();}catch{}
        try{logPlacement("startup-settled",target,null,{ok,reason,...result});}catch{}
        resolve(ok);
      };
      const cancel=reason=>finish(false,reason);
      // Every timed wait settles on cancellation too; no continuation
      // depends on a timer in a destroyed opener realm.
      const delay=ms=>new Promise(r=>{
        if(!alive()){r();return;}
        let id=0,off=()=>{};
        off=scope.defer("delay",()=>{try{if(id)window.clearTimeout(id);}finally{r();}});
        if(!alive()){off();return;}
        try{id=window.setTimeout(off,ms);if(scope.closed)window.clearTimeout(id);}catch{off();}
      });
      const input=event=>{if(event.isTrusted)cancel("child-input");};
      const closedObserver=subject=>{if(subject===win||subject===window)cancel("domwindowclosed");};
      const apply=async()=>{
        if(!alive()||applying)return;applying=true;
        try{
          if(poll)window.clearTimeout(poll);poll=0;
          logPlacement("startup-observed",target,null,{zenReady:!!win.gZenStartup?.isReady});
          if(target.mode==="maximize"&&!win.gZenStartup?.isReady&&win.gZenStartup?.promiseInitialized){
            await Promise.race([Promise.resolve(win.gZenStartup.promiseInitialized).catch(()=>{}),delay(600)]);
          }
          if(!alive()){cancel("stale");return;}
          // The 15s deadline governs startup only; geometry retries
          // keep their existing bounded native timing.
          if(timer)window.clearTimeout(timer);timer=0;
          const ok=await placeNativeWindow(win,target,alive,()=>delay(120));
          if(!alive()){cancel("stale");return;}
          if(!ok)console.warn("[OnePlane] Placement not verified; native window kept.");
          finish(!!ok,ok?"verified":"unverified");
        }catch{cancel("native-error");}
      };
      const observer=subject=>{if(subject===win){observed=true;if(armed)void apply();}};
      const observe=(fn,topic)=>{
        // Register inverse before acquisition; a throw after partial
        // registration still releases this exact observer.
        scope.defer("observer",()=>Services.obs.removeObserver(fn,topic));
        Services.obs.addObserver(fn,topic);
        if(!alive()){try{Services.obs.removeObserver(fn,topic);}catch{}throw Error("Placement cancelled");}
      };
      const check=()=>{
        if(done||applying)return;
        try{
          if(!alive()){cancel("closed-state");return;}
          if(win.gBrowserInit?.delayedStartupFinished||win.gZenStartup?.isReady){void apply();return;}
          poll=window.setTimeout(check,100);
        }catch{cancel("probe-error");}
      };
      try{
        release=mountScope.defer("display-placement",()=>cancel("layout-dispose"));
        if(!alive()){cancel("stale");return;}
        scope.defer("timers",()=>{try{if(timer)window.clearTimeout(timer);}finally{if(poll)window.clearTimeout(poll);}});
        scope.listen(win,"pointerdown",input,true);scope.listen(win,"keydown",input,true);
        if(!alive()){cancel("stale");return;}
        observe(observer,"browser-delayed-startup-finished");
        observe(closedObserver,"domwindowclosed");
        if(!alive()){cancel("stale");return;}
        timer=window.setTimeout(()=>cancel("timeout"),15000);
        if(!alive()){window.clearTimeout(timer);cancel("stale");return;}
        armed=true;if(observed)void apply();else check();
      }catch{cancel("acquisition-error");}
    });
  }
  function onSourceDrag(event){
    if(retireChangedDragViewport()||retireBlockedNativeTabDrag("source-phase")||!draggedTab||draggedGroup||(!event.screenX&&!event.screenY))return;
    if(!pointInSourceWindow(event)){
      if(dragImageMode!=="outside")setDragImageMode("outside",event);
      showPlacementPreview(event,"Tab");
    }else clearPlacementPreview();
  }

  // Native Hub, window-scoped. Zen owns all workspace/session state.
  function createHubController({target,root,toolbarWrapper,supported,hold,switchGuard}) {
    const button=html("button","op-hub-trigger");
    button.id="oneplane-hub-button";button.type="button";
    const glyph=document.createElementNS("http://www.w3.org/2000/svg","svg");
    glyph.setAttribute("viewBox","0 0 20 20");glyph.setAttribute("aria-hidden","true");
    const shape=document.createElementNS(glyph.namespaceURI,"path");
    shape.setAttribute("d","M4 3.5h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2ZM2 8h16M7 8v8.5M10 11h5M10 14h5");
    glyph.append(shape);button.append(glyph);button.title="One Plane Hub";
    for(const [key,value] of Object.entries({skipintoolbarset:"true",removable:"false",tooltiptext:"One Plane Hub","aria-label":"One Plane Hub","aria-haspopup":"dialog","aria-expanded":"false"}))button.setAttribute(key,value);
    const panel=html("div","op-hub-panel");
    panel.hidden=true;
    const topLayer=typeof panel.showPopover==="function"&&typeof panel.hidePopover==="function";
    if(topLayer)panel.setAttribute("popover","manual");
    panel.id="oneplane-hub-panel";
    for(const [key,value] of Object.entries({role:"dialog","aria-label":"One Plane Hub"}))panel.setAttribute(key,value);
    const make=(tag,cls,text)=>{const n=html(tag,cls);if(text!==undefined)n.textContent=text;return n;};
    const content=make("div","op-hub-content");
    const spaces=make("div","op-hub-spaces"),status=make("div","op-hub-status"),pendingStatus=make("div","op-hub-status");
    status.setAttribute("role","status");status.setAttribute("aria-live","polite");
    pendingStatus.setAttribute("role","status");pendingStatus.setAttribute("aria-live","polite");pendingStatus.hidden=true;
    const form=make("form","op-hub-create"),name=make("input","op-hub-name"),add=make("button","op-hub-add","+");
    name.type="text";name.maxLength=80;name.placeholder="New workspace";name.setAttribute("aria-label","New workspace name");
    add.type="submit";add.setAttribute("aria-label","Create workspace");form.append(name,add);
    const mode=make("button","op-hub-mode");mode.type="button";
    const titleRow=make("div","op-hub-title-row"),trashToggle=make("button","op-hub-trash-toggle");
    trashToggle.type="button";trashToggle.title="Trash";trashToggle.setAttribute("aria-label","Trash");
    trashToggle.setAttribute("aria-expanded","false");
    const trashIcon=document.createElementNS(glyph.namespaceURI,"svg");
    trashIcon.setAttribute("viewBox","0 0 20 20");trashIcon.setAttribute("aria-hidden","true");
    const trashPath=document.createElementNS(glyph.namespaceURI,"path");
    trashPath.setAttribute("d","M3 5h14M7 5V3h6v2M5 5l1 12h8l1-12M8 8v6M12 8v6");
    trashIcon.append(trashPath);
    const trashSymbol=make("span","op-hub-trash-symbol"),trashCount=make("span","op-hub-trash-count","0");
    trashSymbol.append(trashIcon,trashCount);
    trashToggle.append(make("span","op-hub-trash-title","Trash"),trashSymbol);
    titleRow.append(make("h2","op-hub-title","One Plane Hub"));
    const freeSetup=make("div","op-hub-free-setup"),trashPanel=make("section","op-hub-trash-panel");
    trashPanel.setAttribute("aria-label","Trash");
    const trashList=make("div","op-hub-trash-list"),trashTools=make("div","op-hub-trash-tools");
    const ageSelect=make("button","op-hub-age"),clearTrash=make("button","op-hub-action","Clear");
    clearTrash.type=ageSelect.type="button";
    ageSelect.setAttribute("aria-label","Clear tabs older than");ageSelect.setAttribute("aria-expanded","false");
    ageSelect.setAttribute("aria-controls","oneplane-trash-age-menu");
    const ageLabel=make("span","op-hub-age-label","All tabs"),ageChevron=make("span","op-hub-age-chevron","⌄");
    ageChevron.setAttribute("aria-hidden","true");ageSelect.append(ageLabel,ageChevron);
    const ageMenu=make("div","op-hub-age-menu");ageMenu.id="oneplane-trash-age-menu";ageMenu.hidden=true;
    ageMenu.setAttribute("role","group");ageMenu.setAttribute("aria-label","Clear tabs older than");
    const ageChoices=new Map();
    for(const [value,short,label] of hubTrashAgeOptions()){
      const option=make("button","op-hub-age-option",label);option.type="button";option.setAttribute("aria-pressed",String(value==="all"));
      option.addEventListener("click",()=>selectTrashAge(value));ageChoices.set(value,{short,option});ageMenu.append(option);
    }
    trashTools.append(clearTrash,ageSelect);
    const trashConfirmation=make("div","op-hub-trash-confirm");
    const trashHead=make("div","op-hub-trash-head"),trashDrawer=make("div","op-hub-trash-drawer"),trashInner=make("div","op-hub-trash-inner");
    const trashNotice=make("div","op-hub-trash-notice"),trashRows=make("div","op-hub-trash-rows");
    trashList.append(trashRows);trashHead.append(trashToggle,trashTools);
    trashInner.append(ageMenu,trashConfirmation,trashNotice,trashList);trashDrawer.append(trashInner);trashDrawer.inert=true;
    trashPanel.append(trashHead,trashDrawer);
    trashToggle.addEventListener("click",()=>{
      if(trashDrag)return;
      trashOpen=!trashOpen;purgePlan=null;setTrashAgeOpen(false);renderTrash();
    });
    trashList.addEventListener("scroll",scheduleTrashRows,{passive:true});
    ageSelect.addEventListener("click",()=>{if(open&&trashOpen&&!ageSelect.disabled)setTrashAgeOpen(ageMenu.hidden,true);});
    clearTrash.addEventListener("click",()=>askPurge());
    const freeSlot=make("div","op-hub-free-slot"),freeDivider=make("div","op-hub-divider");
    freeDivider.hidden=true;
    content.append(titleRow,make("h3","op-hub-heading","Workspaces"),freeSetup,freeSlot,freeDivider,spaces,form,status,pendingStatus,make("div","op-hub-divider"),make("h3","op-hub-heading","Settings"),mode,trashPanel);
    const returnButton=make("button","op-hub-return","Return to main window");returnButton.type="button";returnButton.hidden=true;content.prepend(returnButton);
    panel.append(content);
    let destroyed=false,busy=false,open=false,contextId=null,hubSession=0;
    let trashOpen=false,purgePlan=null,trashDrag=null,editId=null;
    let trashData=[],trashAllowed=false,trashAgeTimer=0,trashFrame=0,trashRangeKey="",trashTarget=null;
    let trashAge="all";
    const TRASH_ROW_HEIGHT=54;
    const FREE_PREF="zen.oneplane.free-space-id",TRASH_PREF="zen.oneplane.trash-space-id",COLOR_PREF="zen.oneplane.workspace-colors",TRASH_TIME="oneplane-trashed-at";
    let geometryFrame=0,motion=null,confirmation=null,drag=null,suppressClickUntil=0,projectionBusy=false;
    let pendingWatch=null,pendingBlocked=null,projectionStartedAt=null;
    const commandBlocked=()=>workspaceCommandState(window).blocked;
    const hubCommandState=()=>{
      const state=workspaceCommandState(window);
      return !state.blocked&&projectionBusy?workspacePendingState(projectionStartedAt,workspaceCommandNow(window),false,true):state;
    };
    const hubViewCurrent=session=>!destroyed&&!window.closed&&open&&hubSession===session;
    function settleHubView(session){
      if(!destroyed&&!window.closed&&open){
        if(hubViewCurrent(session)||(!editId&&!drag&&!trashDrag))render();
        else pendingWatch?.refresh();
      }
    }
    function updatePending(state){
      const message=workspaceCommandMessage(state),blocked=workspaceCommandPresentationBlocked(state);
      pendingStatus.textContent=message;pendingStatus.hidden=!message;
      // Only the workspace command controls are blocked. Settings,
      // Escape, overlay yield and native browser interaction stay live.
      for(const entry of spaces.querySelectorAll(".op-hub-space"))entry.disabled=busy||blocked;
      for(const entry of freeSlot.querySelectorAll(".op-hub-space"))entry.disabled=busy||blocked;
      name.disabled=busy||blocked;add.disabled=busy||blocked||!name.value.trim();
      returnButton.disabled=busy||projectionBusy||blocked;
      for(const node of panel.querySelectorAll(".op-hub-context button,.op-hub-free-setup button")){
        if(node.textContent==="Cancel")continue;
        // Add the live gate restriction without clearing an existing
        // render-time disabled state.
        if(blocked&&!node.disabled){node.disabled=true;node.setAttribute("data-op-command-disabled","");}
        else if(!blocked&&node.hasAttribute("data-op-command-disabled")){node.removeAttribute("data-op-command-disabled");node.disabled=false;}
      }
      const changed=pendingBlocked!==blocked;pendingBlocked=blocked;
      if(blocked){clearTrash.disabled=true;ageSelect.disabled=true;}
      if(changed&&open&&trashOpen&&!trashDrag)renderTrash();
    }
    const PROJECTION="__oneplaneWorkspaceProjection";
    let projectionSequence=0;
    let dragBadge=null,dragBadgeFrame=0,dragBadgePoint=null;
    function hideDragBadge(remove=false){
      if(dragBadgeFrame)window.cancelAnimationFrame(dragBadgeFrame);dragBadgeFrame=0;dragBadgePoint=null;
      if(dragBadge){if(dragBadge.matches(":popover-open"))dragBadge.hidePopover();dragBadge.hidden=true;if(remove){dragBadge.remove();dragBadge=null;}}
    }
    function showDragBadge(event,label){
      if(!pointInSourceWindow(event)){hideDragBadge();return;}
      if(!dragBadge){dragBadge=make("div","op-hub-drag-badge");dragBadge.id="oneplane-workspace-drag-badge";dragBadge.setAttribute("aria-hidden","true");dragBadge.hidden=true;if(typeof dragBadge.showPopover==="function")dragBadge.setAttribute("popover","manual");root.append(dragBadge);}
      dragBadge.textContent=label;dragBadgePoint={x:event.clientX+16,y:event.clientY+16};
      if(dragBadgeFrame)return;
      dragBadgeFrame=window.requestAnimationFrame(()=>{dragBadgeFrame=0;if(!drag||!dragBadgePoint)return;
        const p=dragBadgePoint;dragBadge.style.transform="translate("+Math.max(0,Math.min(window.innerWidth-165,p.x))+"px,"+Math.max(0,Math.min(window.innerHeight-42,p.y))+"px)";
        dragBadge.hidden=false;if(typeof dragBadge.showPopover==="function"&&!dragBadge.matches(":popover-open"))try{dragBadge.showPopover();}catch{}
      });
    }
    const manager=()=>window.gZenWorkspaces;
    const command=()=>document.getElementById("cmd_toggleCompactModeIgnoreHover");
    function setHold(value){toolbarWrapper?.toggleAttribute("oneplane-hub-hold",value);hold();}
    function stopMotion(){if(motion){motion.cancel();motion=null;}}
    function hideNow(){
      stopMotion();
      if(topLayer&&panel.matches(":popover-open"))panel.hidePopover();
      panel.hidden=true;panel.inert=false;setHold(false);
    }
    function fluid(show,done){
      const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches||prefs.getIntPref("zen.oneplane.animation-duration",160)===0;
      if(reduced||typeof panel.animate!=="function"){stopMotion();done();return;}
      const computed=window.getComputedStyle(panel);
      const from=motion?{clipPath:computed.clipPath,opacity:computed.opacity,translate:computed.translate}:show?
        {clipPath:"inset(0 0 100% 0 round 8px)",opacity:0,translate:"0 -6px"}:
        {clipPath:"inset(0 0 0% 0 round 8px)",opacity:1,translate:"0 0px"};
      stopMotion();
      const to=show?{clipPath:"inset(0 0 0% 0 round 8px)",opacity:1,translate:"0 0px"}:
        {clipPath:"inset(0 0 100% 0 round 8px)",opacity:0,translate:"0 -6px"};
      try{
        const animation=panel.animate([from,to],{duration:show?460:390,easing:"cubic-bezier(.22,.72,.2,1)",fill:"both"});
        motion=animation;
        animation.finished.then(()=>{if(motion!==animation)return;motion=null;animation.cancel();done();},()=>{});
      }catch{done();}
    }
    function close(restoreFocus=false,immediate=false){
      const wasVisible=!panel.hidden;contextId=null;confirmation=null;editId=null;finishTrashDrag();setTrashAgeOpen(false);purgePlan=null;open=false;trashOpen=false;stopTrashUpdates();
      if(drag)cancelDrag();
      if(geometryFrame)window.cancelAnimationFrame(geometryFrame);geometryFrame=0;
      button.setAttribute("aria-expanded","false");
      pendingWatch?.refresh();
      if(restoreFocus&&!destroyed&&supported())button.focus({preventScroll:true});
      if(!wasVisible||immediate||destroyed||!supported()){hideNow();return;}
      panel.inert=true;fluid(false,()=>{if(!open)hideNow();});
    }
    function updateGeometry(){
      if(!open||!supported())return;
      const b=button.getBoundingClientRect(),a=url.getBoundingClientRect();
      const bar=document.getElementById("urlbar"),style=window.getComputedStyle(root);
      const compact=parseFloat(style.getPropertyValue("--op-url"))||180;
      // A blank tab collapses the address anchor. Reserve its usual width,
      // rather than collapsing the Hub or following a live search wave.
      const right=a.width>1?a.right:a.left+compact;
      const width=hubPanelWidth(b.left,right,window.innerWidth);
      panel.style.setProperty("--op-hub-width",width+"px");
      // Share the actual toolbar contour color rather than the address capsule.
      const bg=window.getComputedStyle(surface).backgroundColor;
      panel.style.setProperty("--op-hub-bg",bg&&bg!=="rgba(0, 0, 0, 0)"&&bg!=="transparent"?bg:
        window.getComputedStyle(toolbarWrapper).getPropertyValue("--op-surface-tint").trim()||"light-dark(#f4f5f9,#15171e)");
      const color=bar&&window.getComputedStyle(bar).color;
      if(color)panel.style.setProperty("--op-hub-fg",color);
      const x=Math.round(b.left),y=Math.round(b.bottom+4);
      panel.style.setProperty("--op-hub-left",x+"px");
      panel.style.setProperty("--op-hub-top",y+"px");
      return true;
    }
    function scheduleHubGeometry(){
      if(!open||geometryFrame)return;
      geometryFrame=window.requestAnimationFrame(()=>{geometryFrame=0;updateGeometry();});
    }
    function showPopup(){
      if(!updateGeometry())return false;
      panel.hidden=false;panel.inert=false;
      if(topLayer&&!panel.matches(":popover-open"))panel.showPopover();
      fluid(true,()=>{});return true;
    }
    function render(){
      if(destroyed||trashDrag)return;
      const snapshot=hubWorkspaceOrder(hubWorkspaceSnapshot(manager()),freeId(),trashId()),focusedId=document.activeElement?.dataset?.workspaceId;
      renderFreeSetup(snapshot);
      renderTrash();
      returnButton.hidden=!window[PROJECTION];returnButton.disabled=projectionBusy;
      spaces.replaceChildren();freeSlot.replaceChildren();freeDivider.hidden=!freeId();
      if(!snapshot?.length)spaces.append(make("p","op-hub-empty",snapshot?"No native workspaces":"Native workspaces unavailable"));
      else for(const space of snapshot){
        const entry=make("button","op-hub-space");entry.type="button";entry.dataset.workspaceId=space.id;entry.disabled=busy;
        entry.setAttribute("aria-current",space.active?"true":"false");
        const icon=make("span","op-hub-icon",space.icon||Array.from(space.name)[0]?.toUpperCase()||"·");icon.setAttribute("aria-hidden","true");
        const accent=workspaceColor(space.id);if(accent)icon.style.setProperty("--op-space-accent",accent);
        if(space.id===freeId())entry.setAttribute("data-op-free","true");
        entry.append(icon,make("span","op-hub-label",space.name));
        if(space.id===freeId()){
          const lock=make("span","op-hub-lock","");lock.title="Default workspace";lock.setAttribute("aria-label","Protected default workspace");
          const svg=document.createElementNS(glyph.namespaceURI,"svg");svg.setAttribute("viewBox","0 0 20 20");svg.setAttribute("aria-hidden","true");
          const path=document.createElementNS(glyph.namespaceURI,"path");path.setAttribute("d","M6 9V6a4 4 0 0 1 8 0v3M5 9h10v8H5z");svg.append(path);lock.append(svg);entry.append(lock);
        }
        if(space.active)entry.append(make("span","op-hub-current","•"));
        entry.addEventListener("click",()=>{if(window.performance.now()>=suppressClickUntil)void select(space.id);});
        entry.addEventListener("pointerdown",event=>beginDrag(event,space.id,entry));
        entry.addEventListener("contextmenu",event=>{event.preventDefault();event.stopPropagation();if(!busy){confirmation=null;editId=null;contextId=contextId===space.id?null:space.id;render();}});
        const slot=space.id===freeId()?freeSlot:spaces;
        slot.append(entry);
        if(contextId===space.id)slot.append(workspaceMenu(space,snapshot));
        if(focusedId===space.id&&open&&!busy)entry.focus({preventScroll:true});
      }
      form.hidden=!snapshot||typeof manager()?.createAndSaveWorkspace!=="function";
      name.disabled=busy;add.disabled=busy||!name.value.trim();
      const compact=root.getAttribute("zen-compact-mode")==="true";
      const modeLabel=make("span","op-hub-mode-label","Compact Mode"),modeState=make("span","op-hub-mode-state",compact?"On":"Off");mode.replaceChildren(modeLabel,modeState);
      mode.setAttribute("aria-pressed",String(compact));mode.disabled=typeof command()?.doCommand!=="function";
      pendingWatch?.refresh();
    }
    function workspaceMenu(space,snapshot){
      const menu=make("div","op-hub-context");menu.setAttribute("role","group");menu.setAttribute("aria-label","Workspace actions");
      const native=manager(),free=prefs.getStringPref("zen.oneplane.free-space-id","");
      const canDelete=snapshot.length>1&&!!freeId()&&space.id!==free&&singleWindow()&&canManage()&&typeof native?.removeWorkspace==="function";
      const detach=make("button","op-hub-action","Open in another window");detach.type="button";detach.disabled=busy||projectionBusy;
      detach.addEventListener("click",()=>void project(space.id,null));menu.append(detach);
      if(editId===space.id){menu.append(workspaceEditor(space));return menu;}
      if(!confirmation){
        const edit=action("Edit workspace",()=>{editId=space.id;render();});
        edit.disabled=!canManage()||typeof native?.saveWorkspace!=="function";menu.append(edit);
        if(!freeId()&&space.id!==trashId()){
          const designate=action("Make Free (rename)",()=>void designateFree(space.id));designate.disabled=!canManage();menu.append(designate);
        }
        const order=make("div","op-hub-confirm-controls");
        const up=action("Move up",()=>void moveWorkspace(space.id,-1)),down=action("Move down",()=>void moveWorkspace(space.id,1));
        const index=snapshot.findIndex(s=>s.id===space.id);
        up.disabled=!canManage()||space.id===freeId()||index<=Number(!!freeId())||typeof native?.reorderWorkspace!=="function";
        down.disabled=!canManage()||space.id===freeId()||index>=snapshot.length-1||typeof native?.reorderWorkspace!=="function";
        order.append(up,down);menu.append(order);
      }
      if(confirmation?.id===space.id){
        const message=make("p","op-hub-confirm-text",confirmation.description);
        const controls=make("div","op-hub-confirm-controls");
        const cancel=make("button","op-hub-action","Cancel"),ok=make("button","op-hub-delete","Delete");cancel.type=ok.type="button";
        cancel.addEventListener("click",()=>{confirmation=null;render();});
        ok.addEventListener("click",()=>void removeSpace(space.id));
        controls.append(cancel,ok);menu.append(message,controls);
      }else{
        const remove=make("button","op-hub-delete","Delete workspace");remove.type="button";remove.disabled=busy||!canDelete;
        remove.addEventListener("click",()=>askDelete(space.id));menu.append(remove);
      }
      return menu;
    }
    function ownedTabs(native,id){
      if(!Array.isArray(native?.allStoredTabs))return null;
      return native.allStoredTabs.filter(tab=>tab.getAttribute("zen-workspace-id")===id&&
        !tab.hasAttribute("zen-essential")&&!(tab.hasAttribute("zen-empty-tab")&&!tab.group));
    }
    // Native spaces own tabs and session data; prefs contain roles and Hub accent only.
    function storedId(key){const id=prefs.getStringPref(key,"");return id&&manager()?.getWorkspaceFromId?.(id)?id:"";}
    const freeId=()=>storedId(FREE_PREF),trashId=()=>storedId(TRASH_PREF);
    function canManage(){const native=manager();return !!native?.workspaceEnabled&&!native.privateWindowOrDisabled&&native.currentWindowIsSyncing&&privateState(window)===false;}
    function singleWindow(){
      try{const windows=Services.wm.getEnumerator("navigator:browser");
        let found=false;
        while(windows.hasMoreElements()){
          const win=windows.getNext();
          // FinalClose sets closed before the native window is unregistered.
          // Until then it is not a certified single-window operation.
          if(win!==window)return false;
          found=true;
        }
        return found&&!window.closed;
      }catch{return false;}
    }
    function action(label,fn){const btn=make("button","op-hub-action",label);btn.type="button";btn.addEventListener("click",fn);return btn;}
    function workspaceColor(id){try{const v=JSON.parse(prefs.getStringPref(COLOR_PREF,"{}"))[id];return /^#[0-9a-f]{6}$/i.test(v)?v:"";}catch{return "";}}
    function saveWorkspaceColor(id,value){
      let colors={};try{colors=JSON.parse(prefs.getStringPref(COLOR_PREF,"{}"));}catch{}
      if(!colors||typeof colors!=="object"||Array.isArray(colors))colors={};
      if(/^#[0-9a-f]{6}$/i.test(value))colors[id]=value;
      prefs.setStringPref(COLOR_PREF,JSON.stringify(colors));
    }
    async function operation(fn){
      if(busy||projectionBusy||destroyed||!canManage())return;
      if(commandBlocked()){pendingWatch?.refresh();return;}
      busy=true;status.textContent="";
      const session=hubSession,native=manager(),current=()=>!destroyed&&manager()===native&&canManage();
      try{return await runWorkspaceCommand(window,native,"hub-data",current,fn,{data:true});}catch(error){if(hubViewCurrent(session))status.textContent="Workspace command could not be completed.";console.warn("[OnePlane] Workspace Engine:",nocturneErrorClass(error));}
      finally{busy=false;settleHubView(session);}
    }
    function renderFreeSetup(snapshot){
      freeSetup.replaceChildren();freeSetup.hidden=!!freeId()||!snapshot?.length;
      if(freeSetup.hidden)return;
      const msg=make("p","op-hub-confirm-text","Choose an existing workspace → Make Free, or create a new Free.");
      const btn=action("Create Free",()=>void designateFree(null));btn.disabled=busy||!canManage();
      freeSetup.append(msg,btn);
    }
    async function designateFree(id){
      const session=hubSession;
      await operation(async lease=>{
        await designateWorkspaceFree(window,lease.native,prefs,lease,id);
        if(hubViewCurrent(session)){contextId=null;editId=null;}
      });
    }
    function workspaceEditor(space){
      const wrap=make("div","op-hub-edit"),label=make("input","op-hub-name"),icon=make("input","op-hub-name"),color=make("input","op-hub-color");
      label.value=space.name;label.maxLength=80;label.placeholder="Workspace name";label.setAttribute("aria-label","Workspace name");label.disabled=space.id===freeId();
      icon.value=space.icon;icon.maxLength=24;icon.placeholder="Icon / emoji";icon.setAttribute("aria-label","Workspace icon");
      color.type="color";color.value=workspaceColor(space.id)||"#7089b8";color.setAttribute("aria-label","Hub icon color");
      let colorEdited=false;color.addEventListener("input",()=>{colorEdited=true;});
      const session=hubSession;
      const controls=make("div","op-hub-confirm-controls"),cancel=action("Cancel",()=>{editId=null;render();});
      const save=action("Save",()=>void operation(async lease=>{
        const native=lease.native,ws=native.getWorkspaceFromId(space.id),value=label.value.trim();
        if(!ws||!value)throw Error("Enter a workspace name.");
        const next={...ws,name:space.id===freeId()?"Free":value};
        if(icon.value.trim()!==space.icon)next.icon=icon.value.trim()||undefined;
        requireWorkspaceDataCommand(window,native,lease);
        native.saveWorkspace(next);
        requireWorkspaceDataCommand(window,native,lease);
        const saved=native.getWorkspaceFromId(space.id);
        if(!saved||saved.name!==next.name||saved.icon!==next.icon)throw Error("Workspace changes could not be confirmed.");
        if(colorEdited)saveWorkspaceColor(space.id,color.value);
        if(hubViewCurrent(session))editId=null;
      }));
      controls.append(cancel,save);wrap.append(label,icon,color,controls);return wrap;
    }
    async function moveWorkspace(id,direction){
      await operation(async lease=>{
        const native=lease.native,ordered=hubWorkspaceOrder(hubWorkspaceSnapshot(native),freeId(),trashId());
        const index=ordered.findIndex(s=>s.id===id),destination=ordered[index+direction];
        if(id===freeId()||!destination||destination.id===freeId())return;
        const nativeIndex=native.getWorkspaces().findIndex(s=>s.uuid===destination.id);
        if(nativeIndex>=0){
          requireWorkspaceDataCommand(window,native,lease);
          await native.reorderWorkspace(id,nativeIndex);
          requireWorkspaceDataCommand(window,native,lease);
          if(native.getWorkspaces()[nativeIndex]?.uuid!==id)throw Error("Workspace order could not be confirmed.");
        }
      });
    }
    function trashSessionStore(){
      try{return ChromeUtils.importESModule("moz-src:///browser/components/sessionstore/SessionStore.sys.mjs").SessionStore;}
      catch{return ChromeUtils.importESModule("resource:///modules/sessionstore/SessionStore.sys.mjs").SessionStore;}
    }
    function trashStamp(tab){try{return Number(trashSessionStore().getCustomTabValue(tab,TRASH_TIME))||0;}catch{return 0;}}
    function waitTrashReadiness(scope=hubScope){
      return new Promise(resolve=>{
        let timer=0,elapsed=false;
        const release=scope.defer("trash-readiness",()=>{
          try{if(timer)window.clearTimeout(timer);}catch{}
          resolve(elapsed);
        });
        if(scope.closed)return;
        try{timer=window.setTimeout(()=>{elapsed=true;release();},50);}
        catch{release();}
      });
    }
    async function ensureTrash(lease,expected){
      const native=lease.native;
      workspaceDataGuard(lease,expected);
      let id=expected.trash;
      if(!id){
        const previous=prefs.getStringPref(TRASH_PREF,"");
        if(native.getWorkspaces().some(s=>String(s.name||"").trim().toLowerCase()==="trash"))throw Error("An existing Trash workspace needs review.");
        const result=await native.createAndSaveWorkspace("Trash","🗑",true);
        workspaceDataGuard(lease,expected);
        if(prefs.getStringPref(TRASH_PREF,"")!==previous||!result?.uuid||!native.getWorkspaceFromId(result.uuid)||result.uuid===expected.free)throw Error("Could not designate Trash.");
        id=result.uuid;prefs.setStringPref(TRASH_PREF,id);
      }
      const roles={free:expected.free,trash:id};
      workspaceDataGuard(lease,roles);
      for(let i=0;i<20&&!native.workspaceElement(id);i++){
        if(!await waitTrashReadiness())throw workspaceCommandError("trash-readiness-cancelled");
        workspaceDataGuard(lease,roles);
      }
      if(!readWorkspaceOwnership(window,native,id,{fresh:true}))throw Error("Trash is not ready.");
      return id;
    }
    function workspaceDataGuard(lease,roles){
      requireWorkspaceDataCommand(window,lease.native,lease);
      if(!singleWindow()||manager()!==lease.native||window.gBrowser!==browser||
        freeId()!==roles.free||trashId()!==roles.trash||!roles.free||roles.free===roles.trash)
        throw workspaceCommandError("workspace-data-changed","Workspace state changed. Review again.");
    }
    function moveNativeTab(tab,source,destination,lease,roles,afterMove){
      const native=lease.native;
      const guard=()=>{
        workspaceDataGuard(lease,roles);
        if(source===destination||!hubTrashTabEligible(tab)||tab===browser.selectedTab||
          typeof native.moveTabsToWorkspace!=="function"||inspectWorkspaceTabMove(window,native,tab,source,destination)!=="retained")
          throw workspaceCommandError("move-preflight","Tab cannot be moved safely.");
      };
      try{guard();workspaceDataGuard(lease,roles);}
      catch{return {attempted:false,state:"unknown",reason:"move-preflight"};}
      let reason=null;
      try{native.moveTabsToWorkspace([tab],destination);}catch{reason="native-move-error";}
      const state=inspectWorkspaceTabMove(window,native,tab,source,destination);
      if(state==="confirmed"&&!reason){
        try{workspaceDataGuard(lease,roles);afterMove?.();workspaceDataGuard(lease,roles);}
        catch{reason="move-metadata-or-state";}
        if(inspectWorkspaceTabMove(window,native,tab,source,destination)!=="confirmed")
          return {attempted:true,state:"unknown",reason:"move-reconcile"};
      }
      return {attempted:true,state,reason};
    }
    function reportWorkspaceJournal(kind,result){
      try{window.__nocturneTrace?.("workspace.data.journal",{kind,...result},{flush:true});}catch{}
    }
    function journalText(result,verb){
      return result.confirmed+" of "+result.planned+" "+verb+"; "+result.retained+" retained, "+
        result.unknown+" unconfirmed, "+result.notAttempted+" not attempted."+
        (result.reason==="move-metadata-or-state"?" Transfer metadata or workspace state changed.":"");
    }
    function deletionDetails(id){
      const native=manager(),snapshot=hubWorkspaceOrder(hubWorkspaceSnapshot(native),freeId(),trashId()),space=snapshot?.find(s=>s.id===id);
      if(!space||!freeId()||id===freeId()||snapshot.length<=1||!canManage()||!singleWindow()||
        typeof native.removeWorkspace!=="function"||typeof native.moveTabsToWorkspace!=="function")return null;
      const ownership=readWorkspaceOwnership(window,native,id);
      const tabs=ownership?.tabs;
      if(!tabs||tabs.some(t=>!hubTrashTabEligible(t)))return null;
      return {id,native,free:freeId(),trash:trashId(),plan:tabs,description:tabs.length?"Move "+tabs.length+" tab(s) to Trash and delete “"+space.name+"”?":"Delete empty workspace “"+space.name+"”?"};
    }
    function askDelete(id){
      if(busy||destroyed)return;
      confirmation=deletionDetails(id);contextId=id;editId=null;
      if(!confirmation)status.textContent="Cannot delete safely. Set up Free, close other windows, or resolve grouped tabs.";
      render();
    }
    async function removeSpace(id){
      if(busy||destroyed||confirmation?.id!==id)return;
      const approved=confirmation,now=deletionDetails(id);
      if(!now||now.native!==approved.native||now.free!==approved.free||now.trash!==approved.trash||
        now.description!==approved.description||now.plan.length!==approved.plan.length||now.plan.some(t=>!approved.plan.includes(t))){
        confirmation=now;status.textContent="Workspace changed. Review again.";render();return;
      }
      confirmation=null;contextId=null;
      const session=hubSession;
      await operation(async lease=>{
        const native=now.native;
        requireWorkspaceDataCommand(window,native,lease);
        const initial={free:now.free,trash:now.trash};
        workspaceDataGuard(lease,initial);
        const destination=now.plan.length?await ensureTrash(lease,initial):null;
        const roles={free:now.free,trash:destination||now.trash};
        workspaceDataGuard(lease,roles);
        if(native.activeWorkspace===id){switchGuard();await switchWorkspaceWithin(window,native,roles.free,lease);}
        workspaceDataGuard(lease,roles);
        if(native.activeWorkspace===id)throw Error("Workspace is still active.");
        const fresh=readWorkspaceOwnership(window,native,id,{fresh:true});
        if(!fresh||fresh.tabs.length!==now.plan.length||fresh.tabs.some(t=>!now.plan.includes(t))||
          fresh.tabs.some(t=>!hubTrashTabEligible(t)||t===browser.selectedTab))throw Error("Workspace changed. Nothing deleted.");
        const store=destination?trashSessionStore():null;
        const result=workspaceTabJournal(now.plan,tab=>{
          if(native.activeWorkspace===id)return {attempted:false,state:"unknown",reason:"source-active"};
          return moveNativeTab(tab,id,destination,lease,roles,()=>store.setCustomTabValue(tab,TRASH_TIME,String(Date.now())));
        });
        reportWorkspaceJournal("delete-transfer",result);
        if(!workspaceJournalComplete(result))throw Error(journalText(result,"moved")+" Workspace kept. Review again.");
        // A native deletion closes every residual owned tab. Recheck the
        // actual source immediately before invoking it, after switchGuard.
        try{
          workspaceDataGuard(lease,roles);
          switchGuard();
          workspaceDataGuard(lease,roles);
          const remaining=readWorkspaceOwnership(window,native,id,{fresh:true});
          if(!remaining||remaining.tabs.length!==0||native.activeWorkspace===id||
            id===roles.free||id===roles.trash||typeof native.removeWorkspace!=="function")
            throw workspaceCommandError("delete-preflight");
          // Verify every approved move still has physical destination
          // ownership, not merely an ID/cache update.
          if(now.plan.length){
            const target=readWorkspaceOwnership(window,native,destination);
            const moved=new Set(target?.tabs||[]);
            if(!target||now.plan.some(tab=>!moved.has(tab)||!tab.isConnected||tab.closing||
              !(tab.pinned?target.pinned:target.normal).contains(tab)))
              throw workspaceCommandError("delete-transfer-changed");
          }
          workspaceDataGuard(lease,roles);
          const final=readWorkspaceOwnership(window,native,id,{fresh:true});
          if(!final||final.tabs.length||native.activeWorkspace===id)throw workspaceCommandError("delete-preflight");
        }catch{throw Error(journalText(result,"moved")+" Workspace kept. Review again.");}
        let deletion="unknown";
        try{
          await native.removeWorkspace(id);
          deletion=inspectWorkspaceDeletion(window,native,id,roles,browser);
        }catch{
          // Native may already have applied part of the request. Never
          // retry it or suggest that no data changed.
          throw Error(journalText(result,"moved")+" Workspace removal unconfirmed.");
        }finally{try{window.__nocturneTrace?.("workspace.data.delete",{outcome:deletion,transferred:result.confirmed},{flush:true});}catch{}}
        if(deletion!=="confirmed")throw Error(journalText(result,"moved")+" Workspace removal unconfirmed.");
        if(!destroyed&&destination&&open&&hubSession===session)trashOpen=true;
      });
    }
    function trashTabs(){const id=trashId();return id?(ownedTabs(manager(),id)||[]):[];}
    function restoreTargets(){return hubWorkspaceOrder(hubWorkspaceSnapshot(manager()),freeId(),trashId())||[];}
    function restoreTrashTab(tab,id,approval){
      const source=approval?.trash,roles={free:approval?.free,trash:source},session=hubSession;
      return operation(async lease=>{
        if(!approval||approval.native!==lease.native||approval.browser!==browser||
          !source||!trashTabs().includes(tab)||id===source||!restoreTargets().some(s=>s.id===id))throw Error("Restore target changed.");
        workspaceDataGuard(lease,roles);
        const result=workspaceTabJournal([tab],t=>moveNativeTab(t,source,id,lease,roles,()=>trashSessionStore().deleteCustomTabValue(t,TRASH_TIME)));
        reportWorkspaceJournal("restore",result);
        if(!destroyed&&open&&hubSession===session)purgePlan=null;
        if(!workspaceJournalComplete(result))throw Error(journalText(result,"restored")+" Review again.");
        return true;
      });
    }
    function trashMotionEnabled(){
      return !window.matchMedia("(prefers-reduced-motion: reduce)").matches&&prefs.getIntPref("zen.oneplane.animation-duration",160)!==0;
    }
    function clearTrashTarget(){
      trashTarget?.removeAttribute("data-op-trash-target");trashTarget=null;
    }
    function finishTrashDrag(){
      const d=trashDrag;trashDrag=null;clearTrashTarget();
      if(!d)return;
      if(dragLifecycle.owns(d.token,"trash"))dragLifecycle.finish(d.token);
      if(d.frame)window.cancelAnimationFrame(d.frame);
      d.animation?.cancel();
      try{if(panel.hasPointerCapture(d.pointer))panel.releasePointerCapture(d.pointer);}catch{}
      // Restore the actual row to its original list slot; never clone it.
      d.row.removeAttribute("data-op-trash-floating");
      d.row.removeAttribute("data-op-trash-settling");
      for(const k of ["left","top","width","height","translate","scale"])d.row.style.removeProperty(k);
      if(d.placeholder?.isConnected)d.placeholder.replaceWith(d.row);
      else if(d.moved)d.row.remove();
      if(d.moved)suppressClickUntil=window.performance.now()+400;
    }
    function cancelTrashDrag(){
      finishTrashDrag();
      if(open&&!destroyed)render();
    }
    function beginTrashDrag(event,tab,row){
      if(!event.isTrusted||event.button!==0||!(event.buttons&1)||!open||!trashOpen||busy||projectionBusy||destroyed||commandBlocked()||
        !trashAllowed||!singleWindow()||!hubTrashTabEligible(tab)||tab===browser.selectedTab)return;
      const approval={native:manager(),browser,free:freeId(),trash:trashId()};
      if(!approval.trash||!approval.free||approval.trash===approval.free||
        !readWorkspaceOwnership(window,approval.native,approval.trash)?.tabs.includes(tab))return;
      if(trashDrag?.settling)finishTrashDrag();
      else if(trashDrag)return;
      if(dragLifecycle.current())cancelActiveDrag("superseded");
      event.preventDefault();event.stopPropagation();
      const token=dragLifecycle.begin("trash",{pointerId:event.pointerId,onMove:moveTrashDrag,onUp:endTrashDrag,onCancel:cancelTrashDrag});
      if(token===null)return;
      const rect=row.getBoundingClientRect();
      trashDrag={tab,row,token,approval,pointer:event.pointerId,rect,x:event.clientX,y:event.clientY,point:null,moved:false,frame:0,animation:null,placeholder:null,dx:0,dy:0,settling:false};
      try{panel.setPointerCapture(event.pointerId);}catch{dragLifecycle.cancel("trash-capture-failed",token);}
    }
    function trashDestination(x,y){
      const bounds=panel.getBoundingClientRect();
      if(x<bounds.left||x>bounds.right||y<bounds.top||y>bounds.bottom)return null;
      const hit=document.elementFromPoint(x,y)?.closest(".op-hub-space");
      return hit&&panel.contains(hit)&&!hit.disabled&&hit.dataset.workspaceId!==trashId()?hit:null;
    }
    function liftTrashRow(d){
      // The sole moving element is the real card. An empty spacer retains
      // its 54px virtual-list slot while the card is out of document flow.
      const p=panel.getBoundingClientRect();
      d.placeholder=make("div","op-hub-trash-placeholder");
      d.placeholder.setAttribute("aria-hidden","true");
      d.row.before(d.placeholder);
      d.baseX=d.rect.left-p.left+panel.scrollLeft;
      d.baseY=d.rect.top-p.top+panel.scrollTop;
      d.row.style.left=d.baseX+"px";d.row.style.top=d.baseY+"px";
      d.row.style.width=d.rect.width+"px";d.row.style.height=d.rect.height+"px";
      d.row.setAttribute("data-op-trash-floating","true");
      panel.append(d.row);d.moved=true;
      if(trashMotionEnabled())try{
        d.animation=d.row.animate([
          {scale:"1",offset:0},{scale:"1.12 .84",offset:.26},
          {scale:".94 1.12",offset:.5},{scale:"1.06 .97",offset:.75},{scale:"1.04",offset:1}
        ],{duration:360,easing:"linear",fill:"forwards"});
      }catch{}
    }
    function positionTrashRow(d,event){
      if(trashDrag!==d||!d.moved||d.settling)return;
      const p=panel.getBoundingClientRect();
      // Bound the card to the Hub so moving outside cannot expand its
      // scrollable area or leave any floating element over the page.
      const grabX=d.x-d.rect.left,grabY=d.y-d.rect.top;
      const left=Math.max(p.left,Math.min(p.right-d.rect.width,event.clientX-grabX));
      const top=Math.max(p.top,Math.min(p.bottom-d.rect.height,event.clientY-grabY));
      d.dx=left-p.left+panel.scrollLeft-d.baseX;
      d.dy=top-p.top+panel.scrollTop-d.baseY;
      d.row.style.translate=d.dx+"px "+d.dy+"px";
      const target=trashDestination(event.clientX,event.clientY);
      if(target!==trashTarget){clearTrashTarget();trashTarget=target;target?.setAttribute("data-op-trash-target","true");}
    }
    function moveTrashDrag(event){
      const d=trashDrag;
      if(!d||d.settling||!dragLifecycle.owns(d.token,"trash"))return;
      if(!d.row.isConnected||!singleWindow()){dragLifecycle.cancel("trash-invalid",d.token);return;}
      if(!d.moved&&Math.hypot(event.clientX-d.x,event.clientY-d.y)<6)return;
      event.preventDefault();event.stopPropagation();
      if(!d.moved)liftTrashRow(d);
      d.point={clientX:event.clientX,clientY:event.clientY};
      if(!d.frame)d.frame=window.requestAnimationFrame(()=>{d.frame=0;if(d.point)positionTrashRow(d,d.point);});
    }
    async function endTrashDrag(event){
      const d=trashDrag;
      if(!d||!dragLifecycle.owns(d.token,"trash")||!dragLifecycle.finish(d.token))return;
      if(d.frame)window.cancelAnimationFrame(d.frame);d.frame=0;
      if(!d.moved){finishTrashDrag();return;}
      event.preventDefault();event.stopPropagation();
      positionTrashRow(d,event);
      const target=trashDestination(event.clientX,event.clientY),id=target?.dataset.workspaceId;
      d.settling=true;clearTrashTarget();
      try{if(panel.hasPointerCapture(d.pointer))panel.releasePointerCapture(d.pointer);}catch{}
      // Commit native transfer once at release. Rendering remains frozen
      // until the SAME visual card has finished its absorption.
      const approval=d.approval;
      const current=()=>manager()===approval.native&&window.gBrowser===approval.browser&&
        trashId()===approval.trash&&freeId()===approval.free;
      const restored=id&&current()?await restoreTrashTab(d.tab,id,approval):false;
      if(trashDrag!==d)return;
      const outcome=!current()?"unknown":id?inspectWorkspaceTabMove(window,approval.native,d.tab,approval.trash,id):"retained";
      const moved=restored===true&&outcome==="confirmed";
      // An unconfirmed or metadata-failed transfer is not a visual
      // success, but neither should a card fly back into a false source.
      if(!moved&&outcome!=="retained"){finishTrashDrag();if(open)render();return;}
      const destination=moved?target:d.placeholder;
      if(!open||!destination?.isConnected||!trashMotionEnabled()){finishTrashDrag();if(open)render();return;}
      const dest=destination.getBoundingClientRect(),p=panel.getBoundingClientRect();
      const tx=dest.left+dest.width/2-d.rect.width/2-p.left+panel.scrollLeft-d.baseX;
      const ty=dest.top+dest.height/2-d.rect.height/2-p.top+panel.scrollTop-d.baseY;
      const pos=(x,y)=>x+"px "+y+"px";
      const start=window.getComputedStyle(d.row).scale||"1";
      d.animation?.cancel();d.row.setAttribute("data-op-trash-settling","true");
      try{
        d.animation=d.row.animate(moved?[
          {translate:pos(d.dx,d.dy),scale:start,opacity:1,offset:0},
          {translate:pos(d.dx+(tx-d.dx)*.3,d.dy+(ty-d.dy)*.3),scale:"1.14 .83",opacity:1,offset:.25},
          {translate:pos(d.dx+(tx-d.dx)*.85,d.dy+(ty-d.dy)*.85),scale:".45 .65",opacity:.95,offset:.72},
          {translate:pos(tx,ty),scale:".05 .1",opacity:0,offset:1}
        ]:[
          {translate:pos(d.dx,d.dy),scale:start,offset:0},
          {translate:pos(tx,ty),scale:".94 1.08",offset:.7},
          {translate:pos(tx,ty),scale:"1",offset:1}
        ],{duration:moved?420:340,easing:"cubic-bezier(.22,.75,.2,1)",fill:"both"});
        await d.animation.finished;
      }catch{}
      if(trashDrag!==d)return;
      finishTrashDrag();if(open)render();
      if(moved&&open&&trashMotionEnabled()){
        const entry=Array.from(panel.querySelectorAll(".op-hub-space")).find(n=>n.dataset.workspaceId===id);
        try{entry?.animate([{scale:"1.035 .94"},{scale:".99 1.045"},{scale:"1"}],{duration:240,easing:"ease-out"});}catch{}
      }
    }
    function purgeEligible(tab){
      return hubTrashTabEligible(tab)&&!tab.pinned&&tab!==browser.selectedTab&&
        !["busy","soundplaying","soundplaying-scheduledremoval","sharing","pictureinpicture"].some(k=>tab.hasAttribute(k));
    }
    function setTrashAgeOpen(value,focus=false){
      ageMenu.hidden=!value;ageSelect.setAttribute("aria-expanded",String(value));
      if(value&&focus)ageChoices.get(trashAge)?.option.focus({preventScroll:true});
    }
    function selectTrashAge(value){
      if(!open||!trashOpen||ageSelect.disabled||!ageChoices.has(value))return;
      trashAge=value;ageLabel.textContent=ageChoices.get(value).short;
      for(const [key,{option}] of ageChoices)option.setAttribute("aria-pressed",String(key===value));
      purgePlan=null;setTrashAgeOpen(false);renderTrash();ageSelect.focus({preventScroll:true});
    }
    function askPurge(){
      if(busy)return;
      // A failed replacement approval must never retain the previous one.
      purgePlan=null;
      if(!canManage()||!singleWindow()){renderTrash();return;}
      setTrashAgeOpen(false);
      const age=trashAge,now=Date.now();
      const native=manager(),source=trashId(),ownership=readWorkspaceOwnership(window,native,source,{fresh:true});
      if(!ownership){status.textContent="Trash is not ready. Review again.";renderTrash();return;}
      const stamps=new Map(),tabs=ownership.tabs.filter(t=>{
        if(!purgeEligible(t))return false;
        const stamp=trashStamp(t);
        if(!hubTrashAgeMatches(stamp,age,now))return false;
        stamps.set(t,stamp);return true;
      });
      purgePlan={age,native,source,free:freeId(),tabs,stamps};renderTrash();
    }
    async function executePurge(){
      const approved=purgePlan,session=hubSession;purgePlan=null;if(!approved)return;
      await operation(async lease=>{
        const native=lease.native,roles={free:approved.free,trash:approved.source};
        const eligible=(tab,ownership)=>{
          workspaceDataGuard(lease,roles);
          ownership??=readWorkspaceOwnership(window,native,roles.trash,{fresh:true});
          const stamp=trashStamp(tab);
          if(native!==approved.native||!ownership?.tabs.includes(tab)||!purgeEligible(tab)||
            !approved.stamps?.has(tab)||approved.stamps.get(tab)!==stamp||
            !hubTrashAgeMatches(stamp,approved.age,Date.now()))return false;
          workspaceDataGuard(lease,roles);
          return true;
        };
        workspaceDataGuard(lease,roles);
        const initial=readWorkspaceOwnership(window,native,roles.trash,{fresh:true});
        if(!initial||approved.tabs.some(t=>!eligible(t,initial)))throw Error("Trash changed. Review again.");
        const result=workspaceTabJournal(approved.tabs,tab=>{
          if(!eligible(tab))return {attempted:false,state:"unknown",reason:"purge-preflight"};
          let reason=null;
          try{browser.removeTab(tab,{animate:false,closeWindowWithLastTab:false});}catch{reason="native-remove-error";}
          const state=inspectWorkspaceTabRemoval(window,native,tab,roles.trash,browser);
          // Stop on veto, partial removal or invalidated ownership. Never
          // silently continue applying an old approval to a changed set.
          try{workspaceDataGuard(lease,roles);}catch{reason=reason||"purge-state-changed";}
          return {attempted:true,state,reason};
        });
        reportWorkspaceJournal("purge",result);
        if(!destroyed&&open&&hubSession===session)status.textContent=journalText(result,"removed")+(workspaceJournalComplete(result)?"":" Review again.");
      });
    }
    function trashTabUrl(tab){
      // Never load a remote favicon or navigate on behalf of this card.
      // The native tab may be lazy; its original URI is the display fallback.
      try{
        const current=tab.linkedBrowser?.currentURI?.spec;
        const value=(current&&current!=="about:blank"?current:tab._originalUrl||current)||"";
        if(typeof value!=="string")return "";
        try{const u=new URL(value);return ["http:","https:"].includes(u.protocol)?u.host+(u.pathname==="/"?"":u.pathname):u.protocol==="about:"?value:"";}catch{return "";}
      }catch{return "";}
    }
    function trashCard(item){
      const {tab,stamp}=item,row=make("div","op-hub-trash-item"),icon=make("span","op-hub-trash-site-icon");
      const image=tab.getAttribute("image");
      // Browser-owned favicon URI only; avoid new HTTP requests from chrome.
      if(image&&/^(?:data:image\/|moz-anno:|page-icon:|chrome:|resource:)/i.test(image)){
        const img=make("img","");img.alt="";img.draggable=false;img.src=image;img.addEventListener("error",()=>{img.remove();icon.textContent="◎";},{once:true});icon.append(img);
      }else icon.textContent="◎";
      const copy=make("span","op-hub-trash-copy"),title=make("span","op-hub-trash-site-title",tab.label||"Tab"),link=make("span","op-hub-trash-url",trashTabUrl(tab)||"No address");
      copy.append(title,link);
      const age=make("span","op-hub-trash-date",hubTrashRelativeAge(stamp,Date.now()));age._stamp=stamp;
      row.append(icon,copy,age);row.title=stamp?new Date(stamp).toLocaleString():"Unknown date";
      row.draggable=false;
      row.toggleAttribute("data-op-trash-draggable",trashAllowed&&hubTrashTabEligible(tab)&&tab!==browser.selectedTab);
      row.addEventListener("dragstart",event=>event.preventDefault());
      row.addEventListener("pointerdown",event=>beginTrashDrag(event,tab,row));
      return row;
    }
    function stopTrashUpdates(){
      if(trashAgeTimer)window.clearInterval(trashAgeTimer);trashAgeTimer=0;
      if(trashFrame)window.cancelAnimationFrame(trashFrame);trashFrame=0;
    }
    function updateTrashAges(){
      if(!open||!trashOpen||trashDrag)return;
      const now=Date.now();
      for(const age of trashRows.querySelectorAll(".op-hub-trash-date")){
        const value=hubTrashRelativeAge(age._stamp,now);if(age.textContent!==value)age.textContent=value;
      }
    }
    function scheduleTrashRows(){
      if(!open||!trashOpen||trashDrag||trashFrame)return;
      trashFrame=window.requestAnimationFrame(()=>{trashFrame=0;renderTrashRows();});
    }
    function renderTrashRows(){
      if(!open||!trashOpen||trashDrag)return;
      const range=hubTrashRange(trashData.length,trashList.scrollTop,trashList.clientHeight||270,TRASH_ROW_HEIGHT);
      const key=range.first+":"+range.end;if(key===trashRangeKey)return;trashRangeKey=key;
      const frag=document.createDocumentFragment();
      for(let i=range.first;i<range.end;i++)frag.append(trashCard(trashData[i]));
      trashRows.style.paddingTop=range.top+"px";trashRows.style.paddingBottom=range.bottom+"px";
      trashRows.replaceChildren(frag);
    }
    function renderTrash(){
      if(trashDrag)return;
      const tabs=trashTabs();
      trashCount.textContent=String(tabs.length);
      trashToggle.setAttribute("aria-expanded",String(trashOpen));
      trashToggle.setAttribute("aria-label",(trashOpen?"Collapse":"Expand")+" Trash ("+tabs.length+" tabs)");
      trashPanel.toggleAttribute("data-op-trash-open",trashOpen);trashDrawer.inert=!trashOpen;trashTools.inert=!trashOpen;
      if(!trashOpen)setTrashAgeOpen(false);
      if(!open||!trashOpen){stopTrashUpdates();return;}
      trashAllowed=!busy&&!projectionBusy&&canManage()&&singleWindow()&&!workspaceCommandPresentationBlocked(hubCommandState());
      trashData=tabs.map(tab=>({tab,stamp:trashStamp(tab)})).sort((a,b)=>b.stamp-a.stamp);
      trashRangeKey="";trashConfirmation.replaceChildren();trashNotice.replaceChildren();
      if(!tabs.length)trashNotice.append(make("p","op-hub-confirm-text","Trash is empty."));
      else if(!trashAllowed)trashNotice.append(make("p","op-hub-confirm-text",commandBlocked()?"Workspace command is pending.":"Close other browser windows to restore or clear tabs."));
      trashList.hidden=!tabs.length;
      renderTrashRows();scheduleTrashRows();
      if(!trashAgeTimer)trashAgeTimer=window.setInterval(updateTrashAges,60000);
      clearTrash.disabled=!trashAllowed||!tabs.some(purgeEligible);ageSelect.disabled=!trashAllowed;
      if(ageSelect.disabled)setTrashAgeOpen(false);
      if(purgePlan){
        const n=purgePlan.tabs.length;
        trashConfirmation.append(make("p","op-hub-confirm-text",n?"Close "+n+" matching tab(s)? Native recently closed history may retain them.":"No eligible tabs match this age."));
        const controls=make("div","op-hub-confirm-controls");
        controls.append(action("Cancel",()=>{purgePlan=null;renderTrash();}));
        if(n)controls.append(action("Confirm clear",()=>void executePurge()));
        trashConfirmation.append(controls);
      }
    }
    // A projection is a native synced window, not a copy or adoption of tabs.
    function canProject(){
      return !!manager()?.currentWindowIsSyncing&&!!window.gZenWindowSync&&
        prefs.getBoolPref("zen.window-sync.enabled",true)&&!prefs.getBoolPref("zen.window-sync.sync-only-pinned-tabs",true);
    }
    function beginDrag(event,id,entry){
      if(!event.isTrusted||event.button!==0||!(event.buttons&1)||busy||projectionBusy||destroyed||!open||trashDrag||commandBlocked())return;
      if(dragLifecycle.current())cancelActiveDrag("superseded");
      const token=dragLifecycle.begin("workspace",{pointerId:event.pointerId,onMove:moveDrag,onUp:endDrag,onCancel:()=>cleanupDrag()});
      if(token===null)return;
      drag={id,entry,token,pointer:event.pointerId,x:event.screenX,y:event.screenY,moved:false};
      try{entry.setPointerCapture(event.pointerId);}catch{dragLifecycle.cancel("capture-failed",token);}
    }
    function moveDrag(event){
      if(!drag||!dragLifecycle.owns(drag.token,"workspace")||event.pointerId!==drag.pointer)return;
      if(!(event.buttons&1)||!drag.entry.isConnected){cancelDrag();return;}
      if(!drag.moved&&Math.hypot(event.screenX-drag.x,event.screenY-drag.y)>=9){
        drag.moved=true;drag.entry.setAttribute("data-op-dragging","true");
        status.textContent="Drag outside the browser and release to open a synced window.";
      }
      if(drag.moved){
        event.preventDefault();
        const label=manager()?.getWorkspaceFromId(drag.id)?.name||"Workspace";
        showDragBadge(event,label);showPlacementPreview(event,label);
      }
    }
    function cleanupDrag(){
      const d=drag;drag=null;
      hideDragBadge();clearPlacementPreview(true);
      if(!d)return;
      d.entry.removeAttribute("data-op-dragging");
      if(d.moved){suppressClickUntil=window.performance.now()+400;status.textContent="";}
      try{if(d.entry.hasPointerCapture(d.pointer))d.entry.releasePointerCapture(d.pointer);}catch{}
    }
    function cancelDrag(){
      if(drag){const token=drag.token;if(!dragLifecycle.cancel("workspace-cancel",token))cleanupDrag();}
      else cleanupDrag();
    }
    function endDrag(event){
      if(!drag||event.pointerId!==drag.pointer||!dragLifecycle.owns(drag.token,"workspace"))return;
      const d=drag;
      if(!event.isTrusted||event.button!==0||!d.entry.isConnected){cancelDrag();return;}
      const outside=Number.isFinite(event.screenX)&&Number.isFinite(event.screenY)&&
        !(event.screenX===0&&event.screenY===0)&&!pointInSourceWindow(event);
      const point=placementAt(event,true);
      const external=outside||!!point;
      if(!dragLifecycle.finish(d.token))return;
      cleanupDrag();
      if(!d.moved)return;
      event.preventDefault();event.stopPropagation();
      // A genuine external release opens a native synced window. If the
      // screen coordinate contract cannot be verified, retain native placement.
      if(external){
        if(displaySnapEnabled()&&!point){status.textContent="Target monitor not verified. Try the drop again.";logPlacement("workspace-release-unverified",null);return;}
        void project(d.id,point);
      }else status.textContent="Release outside the browser, or use Open in another window.";
    }
    // A projection uses the native Zen empty tab, never a new visible
    // about:blank tab. Capture only the initial native startup identity.
    function projectionStartupCandidate(child){
      const spaces=child.gZenWorkspaces,b=child.gBrowser;
      const initial=spaces?._tabToRemoveForEmpty||spaces?._initialTab;
      if(initial&&b?.isTab(initial)&&!initial.hasAttribute("zen-empty-tab"))return initial;
      if(!child.gBrowserInit?.delayedStartupFinished&&b?.tabs?.length===1){
        const tab=b.tabs[0];
        if(tab&&!tab.hasAttribute("zen-empty-tab"))return tab;
      }
      return null;
    }
    function projectionLog(child,stage,extra={}){
      try{
        const data={
          sequence:child?.[PROJECTION]?.sequence??projectionSequence,
          ready:!!child?.gBrowserInit?.delayedStartupFinished,
          zenReady:!!child?.gZenStartup?.isReady,
          emptySelected:!!child?.gBrowser?.selectedTab?.hasAttribute("zen-empty-tab"),
          emptyAvailable:!!child?.gZenWorkspaces?._emptyTab,
          ...extra
        };
        window.__nocturneTrace?.("hub.projection."+stage,data,{flush:true});
        console.info("[OnePlane] Projection "+stage);
      }catch{} // Diagnostic failure must not interrupt a native operation.
    }
    // Zen's native selectEmptyTab can fall back to creating an ordinary
    // homepage tab. During this specific projection's startup, use its
    // existing transparent placeholder instead. Restore the exact original
    // method before normal user interaction; no profile preference changes.
    function installProjectionEmptyGuard(child,record,interacted){
      let owner=null,original=null,wrapped=null,own=false,stopped=false;
      function release(){
        const spaces=owner,previous=original,wrapper=wrapped,hadOwn=own;
        owner=original=wrapped=null;own=false;
        if(spaces&&spaces.selectEmptyTab===wrapper){
          if(hadOwn)spaces.selectEmptyTab=previous;else delete spaces.selectEmptyTab;
        }
      }
      function install(){
        if(stopped||interacted())return;
        const spaces=child.gZenWorkspaces;
        if(owner===spaces)return;
        if(owner)release();
        if(!spaces||typeof spaces.selectEmptyTab!=="function")return;
        const previous=spaces.selectEmptyTab;
        const wrapper=function(...args){
          if(this===spaces&&owner===spaces&&wrapped===wrapper&&child.gZenWorkspaces===spaces&&!stopped&&!interacted()&&!args[0]){
            const empty=this._emptyTab;
            if(empty?.isConnected&&!empty.closing&&empty.hasAttribute("zen-empty-tab")&&child.gBrowser?.isTab(empty)){
              child.gBrowser.selectedTab=empty;
              projectionLog(child,"native-empty-selected");
              return empty;
            }
            const before=new Set(child.gBrowser?.tabs||[]);
            const result=previous.apply(this,args);
            if(!stopped&&!interacted()&&child.gZenWorkspaces===spaces&&result&&!before.has(result)&&child.gBrowser?.isTab(result))record(result);
            return result;
          }
          return previous.apply(this,args);
        };
        owner=spaces;original=previous;own=Object.hasOwn(spaces,"selectEmptyTab");wrapped=wrapper;
        spaces.selectEmptyTab=wrapper;
        projectionLog(child,"startup-guard-installed");
      }
      function stop(){
        if(stopped)return;stopped=true;
        for(const [event,fn] of [["DOMContentLoaded",install],["load",install],["AfterWorkspacesSessionRestore",stop]]){
          try{child.removeEventListener(event,fn,true);}catch{}
        }
        release();
      }
      try{
        child.addEventListener("DOMContentLoaded",install,true);
        child.addEventListener("load",install,true);
        child.addEventListener("AfterWorkspacesSessionRestore",stop,true);
        install();
      }catch(error){stop();throw error;}
      stop.probe=install;
      return stop;
    }
    function prepareProjectionStart(child,id,startupTabs,native,browser,lease){
      requireWorkspaceCommand(child,native,lease);
      const empty=native._emptyTab;
      if(child.gBrowser!==browser||native.activeWorkspace!==id||!empty?.isConnected||empty.closing||
        !empty.hasAttribute("zen-empty-tab")||!browser?.isTab(empty)){projectionLog(child,"empty-unavailable");return null;}
      browser.selectedTab=empty;
      requireWorkspaceCommand(child,native,lease);
      if(child.gBrowser!==browser||native._emptyTab!==empty||native.activeWorkspace!==id||
        browser.selectedTab!==empty){projectionLog(child,"empty-selection-rejected");return null;}
      // Zen owns startup-tab cleanup. Its TabClose event is queued and
      // may later remove a synced peer whose state changed in the meantime.
      // No public native atomic/local-only close contract: keep residual
      // ordinary tabs rather than risk deleting a different live page.
      let retained=0;
      for(const tab of startupTabs)if(tab!==empty&&tab.isConnected&&browser.isTab(tab))retained++;
      projectionLog(child,"start-prepared",{candidates:startupTabs.size,retained,removed:0});
      return empty;
    }
    // A synced child can inherit an empty-page search session whose
    // zen-newtab attribute remains set even after native focus/rollup hides
    // its result view. Check the actual floating view, not just its flag.
    async function openProjectionSearch(child,id,native,browser,empty,scope,interacted){
      const eligible=()=>!scope.closed&&!child.closed&&!window.closed&&!destroyed&&!interacted()&&
        child.gZenWorkspaces===native&&child.gBrowser===browser&&native?.activeWorkspace===id&&
        !!empty?.isConnected&&!empty.closing&&native._emptyTab===empty&&browser.selectedTab===empty&&
        browser.isTab(empty)&&empty.hasAttribute("zen-empty-tab");
      const isVisible=bar=>!!bar?.hasAttribute("zen-newtab")&&
        !!(bar.view?.isOpen||bar.hasAttribute("open"));
      // A disposal must settle the wait even if the opener realm loses its timers.
      const wait=()=>new Promise(resolve=>{
        let timer=0,elapsed=false;
        const release=scope.defer("projection-search-delay",()=>{
          try{if(timer)window.clearTimeout(timer);}finally{resolve(elapsed);}
        });
        if(scope.closed)return;
        try{
          timer=window.setTimeout(()=>{elapsed=true;release();},100);
          if(scope.closed)window.clearTimeout(timer);
        }catch{release();}
      });
      if(!eligible()){projectionLog(child,"search-cancelled",{reason:"stale-preparation"});return false;}
      child.focus();
      // Let the real window activation/size-mode change and native URL-bar
      // rollup settle. Never steal focus again or toggle an existing search.
      for(let attempt=0;attempt<4;attempt++){
        if(!eligible()||!await wait()||!eligible()){projectionLog(child,"search-cancelled",{attempt});return false;}
        const bar=child.gURLBar;
        const focused=child.document?.hasFocus?.()??true;
        if(isVisible(bar)&&focused){projectionLog(child,"search-visible",{attempt});return true;}
        if(!bar||!focused)continue;
        const session=bar.hasAttribute("zen-newtab");
        try{
          if(session){
            // Resume the already-owned native new-tab session, rather than
            // calling handleNewTab again or creating an ordinary tab.
            bar.search("");
            if(!eligible()||child.gURLBar!==bar||!child.document?.hasFocus?.())return false;
            child.document.getElementById("Browser:OpenLocation")?.doCommand();
          }else child.gZenUIManager?.handleNewTab(false,false,"tab",true);
          projectionLog(child,"search-attempt",{attempt,resumed:session,viewOpen:isVisible(bar),focused});
        }catch(error){projectionLog(child,"search-error",{attempt,reason:"native-error"});}
      }
      if(!eligible()||!await wait()||!eligible()){projectionLog(child,"search-cancelled",{attempt:4});return false;}
      const visible=isVisible(child.gURLBar)&&(child.document?.hasFocus?.()??true);
      projectionLog(child,"search-result",{visible:!!visible});
      return !!visible;
    }
    // A newly opened chrome WindowProxy survives its initial document
    // replacement. Never use DOM unload as a window-close notification.
    // Keep probes alive until Zen's workspace promise resolves, even when
    // the Gecko startup notification arrives before our listener.
    function waitForProjectionReady(child,onProbe,scope=hubScope){
      return new Promise((resolve,reject)=>{
        let finished=false,waiting=null,nativeReady=false,poll=0,timer=0,release=()=>{};
        const cleanup=()=>{
          if(finished)return false;finished=true;
          try{if(poll)window.clearTimeout(poll);}catch{}
          try{if(timer)window.clearTimeout(timer);}catch{}
          try{Services.obs.removeObserver(startup,"browser-delayed-startup-finished");}catch{}
          try{Services.obs.removeObserver(closed,"domwindowclosed");}catch{}
          try{release();}catch{}
          return true;
        };
        const fail=error=>{if(cleanup())reject(error);};
        const closed=subject=>{if(subject===child||subject===window)fail(Error("Native window closed"));};
        const startup=subject=>{if(subject===child){nativeReady=true;check();}};
        const check=()=>{
          if(finished)return;
          if(poll)window.clearTimeout(poll);poll=0;
          if(child.closed||window.closed||destroyed){fail(Error("Native window closed or OnePlane disabled"));return;}
          try{
            onProbe?.();
            nativeReady||=!!child.gBrowserInit?.delayedStartupFinished||!!child.gZenStartup?.isReady;
            const spaces=child.gZenWorkspaces;
            if(nativeReady&&spaces?.promiseInitialized&&waiting!==spaces){
              waiting=spaces;
              Promise.resolve(spaces.promiseInitialized).then(()=>{
                if(finished||waiting!==spaces)return;
                if(child.closed||window.closed||destroyed){fail(Error("Native window closed"));return;}
                if(child.gZenWorkspaces!==spaces){waiting=null;check();return;}
                if(cleanup())resolve(spaces);
              },error=>{
                if(finished||waiting!==spaces)return;
                if(child.gZenWorkspaces!==spaces){waiting=null;check();return;}
                fail(error);
              });
            }
          }catch(error){fail(error);return;}
          if(!finished)try{poll=window.setTimeout(check,100);}catch(error){fail(error);}
        };
        try{
          release=scope.defer("projection-readiness",()=>fail(Error("Projection owner disposed")));
          if(finished)return;
          Services.obs.addObserver(startup,"browser-delayed-startup-finished");
          if(finished){try{Services.obs.removeObserver(startup,"browser-delayed-startup-finished");}catch{}return;}
          Services.obs.addObserver(closed,"domwindowclosed");
          if(finished){try{Services.obs.removeObserver(closed,"domwindowclosed");}catch{}return;}
          timer=window.setTimeout(()=>fail(Error("Workspace startup timeout")),20000);
          check();
        }catch(error){fail(error);}
      });
    }
    // Cancels only the opener's presentation/automatic setup. The
    // actual child command keeps its gate until its native promise settles.
    function waitProjectionSelection(scope,pending){
      return new Promise((resolve,reject)=>{
        let settled=false,release=()=>{};
        const finish=(ok,value)=>{
          if(settled)return;settled=true;release();
          if(ok)resolve(value);else reject(value);
        };
        release=scope.defer("projection-selection-wait",()=>finish(false,Error("Projection owner disposed")));
        Promise.resolve(pending).then(v=>finish(true,v),e=>finish(false,e));
      });
    }
    async function project(id,display){
      if(projectionBusy||busy||destroyed)return;
      if(commandBlocked()){pendingWatch?.refresh();return;}
      if(!canProject()){status.textContent="Enable native window sync for all tabs to use this feature.";return;}
      const native=manager();
      if(!native.getWorkspaceFromId(id))return;
      const sync=window.gZenWindowSync;
      const session=hubSession;
      projectionBusy=true;projectionStartedAt=workspaceCommandNow(window);status.textContent="";render();
      let child=null,interacted=false,projection=null;
      const projectionScope=createDisposableScope({onError:()=>projectionLog(child,"startup-cleanup-error")});
      const releaseProjection=hubScope.defer("projection-startup",()=>projectionScope.dispose());
      const current=()=>{
        try{return !interacted&&!projectionScope.closed&&!destroyed&&!window.closed&&manager()===native&&canProject()&&
          window.gZenWindowSync===sync&&!!native.getWorkspaceFromId(id)&&!!child&&!child.closed&&child[PROJECTION]===projection;}
        catch{return false;}
      };
      const childCurrent=(childNative,browser)=>{
        try{return current()&&child.gZenWorkspaces===childNative&&child.gBrowser===browser&&
          !!childNative?.currentWindowIsSyncing&&child.gZenWindowSync===sync&&!!childNative.getWorkspaceFromId(id);}
        catch{return false;}
      };
      const onInput=event=>{if(event.isTrusted){interacted=true;projectionScope.dispose();}};
      try{
        const {BrowserWindowTracker}=ChromeUtils.importESModule("resource:///modules/BrowserWindowTracker.sys.mjs");
        // Supply the final snap rectangle at native window creation,
        // before Zen can restore the opener monitor geometry.
        const seed=display?nativeStartupFeatures(display):null;
        if(display&&!seed){status.textContent="Target monitor changed. Try the drop again.";return;}
        const features=seed?Object.entries(seed).map(([k,v])=>k+"="+v).join(","):undefined;
        if(seed)logPlacement("workspace-open",display,null,seed);
        // Use the recognized native initial page, not a user navigation.
        const args=Cc["@mozilla.org/supports-string;1"].createInstance(Ci.nsISupportsString);args.data="about:blank";
        const options={openerWindow:window,private:false,zenSyncedWindow:!prefs.getBoolPref("zen.window-sync.prefer-unsynced-windows",false),args,features};
        child=BrowserWindowTracker.openWindow(options);
        if(!child||destroyed||hubScope.closed)throw Error("Native window did not open or owner disposed");
        projection={source:window,id,sequence:++projectionSequence};child[PROJECTION]=projection;
        projectionScope.listen(child,"pointerdown",onInput,true);projectionScope.listen(child,"keydown",onInput,true);
        // Keep real window-close cancellation through native selection
        // and search, not just through startup readiness.
        const closed=subject=>{if(subject===child||subject===window)projectionScope.dispose();};
        projectionScope.defer("projection-close-observer",()=>Services.obs.removeObserver(closed,"domwindowclosed"));
        Services.obs.addObserver(closed,"domwindowclosed");
        if(!current()){try{Services.obs.removeObserver(closed,"domwindowclosed");}catch{}throw Error("Projection owner changed");}
        const placementTask=display?placeAfterStartup(child,display,()=>!interacted):Promise.resolve(true);
        const startupTabs=new Set();
        const record=tab=>{if(tab)startupTabs.add(tab);};
        const captureStartup=()=>record(projectionStartupCandidate(child));
        captureStartup();
        const offDom=projectionScope.listen(child,"DOMContentLoaded",captureStartup,true);
        const offLoad=projectionScope.listen(child,"load",captureStartup,true);
        const stopEmptyGuard=installProjectionEmptyGuard(child,record,()=>!current());
        const offGuard=projectionScope.defer("empty-guard",stopEmptyGuard);
        projectionLog(child,"opened");
        const childNative=await waitForProjectionReady(child,()=>{
          captureStartup();stopEmptyGuard.probe?.();
        },projectionScope);
        if(!current())throw Error("Projection owner changed");
        captureStartup();offDom();offLoad();offGuard();
        projectionLog(child,"spaces-ready",{candidates:startupTabs.size});
        if(interacted){projectionLog(child,"takeover");await placementTask;return;}
        const browser=child.gBrowser;
        const eligible=()=>childCurrent(childNative,browser);
        if(!eligible())throw Error("Native sync unavailable");
        const alreadyActive=childNative.activeWorkspace===id;
        // Keep the same selection lease through switch and placeholder
        // preparation; no second independent native command boundary.
        const pending=runWorkspaceCommand(child,childNative,"projection",eligible,async lease=>{
          await switchWorkspaceWithin(child,childNative,id,lease,{motion:false});
          requireWorkspaceCommand(child,childNative,lease);
          projectionLog(child,"workspace-active",{alreadyActive,sourceActive:native.activeWorkspace===id});
          return prepareProjectionStart(child,id,startupTabs,childNative,browser,lease);
        });
        const preparedEmpty=await waitProjectionSelection(projectionScope,pending);
        if(interacted){projectionLog(child,"takeover");await placementTask;return;}
        if(!eligible())throw Error("Projection owner changed");
        // Keep empty-tab selection independent of placement. Open the
        // floating search AFTER window placement settles, because native
        // activation/maximize may otherwise dismiss it on the same space.
        const placed=await placementTask;
        const searchVisible=!!preparedEmpty&&await openProjectionSearch(child,id,childNative,browser,preparedEmpty,projectionScope,()=>!eligible());
        if(!eligible()){projectionLog(child,"takeover");return;}
        projectionLog(child,"projection-complete",{placed,searchVisible:!!searchVisible,alreadyActive});
        if(hubViewCurrent(session))status.textContent=placed?"":"Window opened; placement could not be verified.";
      }catch(error){
        if(interacted&&child&&!child.closed){projectionLog(child,"takeover");return;}
        if(child&&!child.closed&&child[PROJECTION]===projection)delete child[PROJECTION];
        if(hubViewCurrent(session))status.textContent="Could not open synced workspace. Check window sync settings.";
        projectionLog(child,"failed",{reason:"native-error"});
        console.warn("[OnePlane] Workspace projection:",nocturneErrorClass(error));
      }finally{
        releaseProjection();
        projectionBusy=false;projectionStartedAt=null;settleHubView(session);
      }
    }
    // Native synced-window close moves live docshells itself. Verify the
    // exact current tab identities in the intended surviving peer first.
    function inspectProjectionReturn(child,source,native,sourceNative,sync){
      try{
        if(!source||source===child||!sync||child.closed||source.closed||
          child._zenClosingWindow||source._zenClosingWindow||
          child.gZenWorkspaces!==native||source.gZenWorkspaces!==sourceNative||
          child.gZenWindowSync!==sync||source.gZenWindowSync!==sync||
          !native?.workspaceEnabled||!sourceNative?.workspaceEnabled||
          !native.currentWindowIsSyncing||!sourceNative.currentWindowIsSyncing||
          native.isChangingWorkspace!==false||sourceNative.isChangingWorkspace!==false||
          !child.gZenStartup?.isReady||!source.gZenStartup?.isReady)return false;
        const b=child.gBrowser,peerBrowser=source.gBrowser;
        const snapshot=(win,manager,browser)=>{
          if(typeof browser?.tabContainer?._invalidateCachedTabs!=="function"||typeof browser.isTab!=="function")return null;
          browser.tabContainer._invalidateCachedTabs();
          const tabs=manager.allStoredTabs;
          if(!Array.isArray(tabs)||new Set(tabs).size!==tabs.length)return null;
          // Independently scan physical containers; cache invalidation
          // alone cannot detect a tab with an inconsistent workspace ID
          // or a group omitted by the native cache traversal.
          const spaces=manager.getWorkspaces(),physical=new Map(),containers=new Set();
          if(!Array.isArray(spaces)||!spaces.length||spaces.some(s=>!s?.uuid)||
            new Set(spaces.map(s=>s.uuid)).size!==spaces.length)return null;
          const scan=(container,kind,id=null)=>{
            if(!container?.isConnected||containers.has(container))return false;
            containers.add(container);
            for(const tab of container.querySelectorAll(".tabbrowser-tab")){
              if(!tab?.isConnected||tab.closing||!browser.isTab(tab)||physical.has(tab))return false;
              // Zen intentionally skips syncing Glance position; a nested
              // child may not have its parent's pin/essential role.
              // Until a native transfer contract exists, Return must not
              // close a window with an active or retained Glance topology.
              if(tab.hasAttribute("zen-glance-tab")||tab.hasAttribute("glance-id"))return false;
              const essential=tab.getAttribute("zen-essential")==="true";
              if(kind==="essential"){
                if(!essential||workspaceEssentialSection(win,manager,tab)!==container)return false;
              }else if(tab.hasAttribute("zen-essential")||tab.getAttribute("zen-workspace-id")!==id)return false;
              physical.set(tab,{kind,container});
            }
            return true;
          };
          for(const space of spaces){
            const element=manager.workspaceElement(space.uuid);
            if(!element?.isConnected||!scan(element.tabsContainer,"normal",space.uuid)||!scan(element.pinnedTabsContainer,"pinned",space.uuid))return null;
          }
          for(const section of win.document.querySelectorAll("#zen-essentials .zen-workspace-tabs-section"))
            if(!scan(section,"essential"))return null;
          if(physical.size!==tabs.length||tabs.some(tab=>!physical.has(tab)))return null;
          const byId=new Map();
          for(const tab of tabs){
            if(tab===manager._emptyTab&&tab.hasAttribute("zen-empty-tab"))continue;
            if(!tab?.isConnected||tab.closing||!browser.isTab(tab)||tab.hasAttribute("zen-empty-tab")||
              !tab.id||byId.has(tab.id)||sync.getItemFromWindow(win,tab.id)!==tab)return null;
            const location=physical.get(tab),groups=[],seen=new Set();
            let root=tab;
            // Zen folders can be nested. Native places the OUTERMOST group
            // according to its pin role, not the individual child's role.
            for(let group=tab.group;group;group=group.group){
              if(seen.has(group)||!group.id||!group.isConnected||!group.contains(root)||
                sync.getItemFromWindow(win,group.id)!==group)return null;
              seen.add(group);groups.push([group.id,!!group.pinned,group.hasAttribute("split-view-group")]);root=group;
            }
            if(location.kind!=="essential"&&!!root.pinned!==(location.kind==="pinned"))return null;
            if(root!==tab&&typeof location.container.contains==="function"&&!location.container.contains(root))return null;
            if(tab.documentGlobal!==win)return null;
            byId.set(tab.id,{tab,kind:location.kind,groups});
          }
          // A native tab absent from the workspace cache is not certified.
          if(!browser.tabs||Array.from(browser.tabs).some(tab=>
            !(tab===manager._emptyTab&&tab.hasAttribute("zen-empty-tab"))&&byId.get(tab.id)?.tab!==tab))return null;
          return byId;
        };
        const own=snapshot(child,native,b),other=snapshot(source,sourceNative,peerBrowser);
        if(!own||!other||child.gBrowser!==b||source.gBrowser!==peerBrowser)return false;
        for(const [id,entry] of own){
          const peer=other.get(id),tab=entry.tab;
          if(!peer||peer.tab===tab||entry.kind!==peer.kind||JSON.stringify(entry.groups)!==JSON.stringify(peer.groups)||
            tab.getAttribute("zen-workspace-id")!==peer.tab.getAttribute("zen-workspace-id")||
            !!tab.pinned!==!!peer.tab.pinned||tab.getAttribute("usercontextid")!==peer.tab.getAttribute("usercontextid")||
            tab.getAttribute("zen-essential")!==peer.tab.getAttribute("zen-essential")||
            tab.getAttribute("glance-id")!==peer.tab.getAttribute("glance-id")||
            tab.hasAttribute("zen-glance-tab")!==peer.tab.hasAttribute("zen-glance-tab"))return false;
          // Match ZenWindowSync.#canSwapBrowsers for every visible child
          // docshell, not just DOM IDs. A process mismatch is a native
          // early return, so closing cannot be advertised as safe here.
          if(tab._zenContentsVisible){
            const from=tab.linkedBrowser,to=peer.tab.linkedBrowser;
            if(!from||!to||from===to||peer.tab._zenContentsVisible||
              typeof from.isRemoteBrowser!=="boolean"||from.isRemoteBrowser!==to.isRemoteBrowser)return false;
          }
        }
        return true;
      }catch{return false;}
    }
    // Zen chooses the first eligible surviving window in its own native
    // order. A focus-order snapshot cannot guarantee the target after a
    // native confirmation dialog; accept only the single intended survivor.
    function projectionReturnTarget(child,source,tracker,store){
      try{
        const windows=Array.from(tracker.orderedWindows);
        if(!windows.includes(child)||!windows.includes(source)||
          !store.getWindowId(child)||!store.getWindowId(source))return false;
        return windows.every(win=>win===child||win===source||win.closed||win.gZenWorkspaces?.privateWindowOrDisabled===true);
      }catch{return false;}
    }
    // Runs in the SURVIVING opener realm. Gecko FinalClose sets closed
    // before ReallyCloseWindow; SessionStore handles SSWindowClosing on
    // domwindowclosed, and AppWindow destroys/detaches its chrome context
    // before xul-window-destroyed. Do not release on a timer or mere flag.
    async function invokeProjectionClose(child,verify,invoke,obs=Services.obs){
      const context=child.browsingContext;
      if(!context||context.isDiscarded!==false)throw workspaceCommandError("close-unavailable");
      let active=true,observed=false,ownerClosed=false,resolveClosed;
      const closedPromise=new Promise(resolve=>{resolveClosed=resolve;});
      const cleanup=()=>{
        if(!active)return;active=false;
        for(const [fn,topic] of [[onClosed,"domwindowclosed"],[onDestroyed,"xul-window-destroyed"]]){
          try{obs.removeObserver(fn,topic);}catch{}
        }
      };
      const check=()=>{
        if(!active||!observed)return;
        try{if(context.isDiscarded===true){cleanup();resolveClosed({status:"closed"});}}catch{}
      };
      const onClosed=subject=>{
        if(!active)return;
        if(subject===child){observed=true;check();}
        else if(subject===window){
          // The surviving owner is being destroyed too. No native
          // completion certificate: retain the primitive data token.
          ownerClosed=true;cleanup();
          projectionLog(window,"return-owner-closed");
        }
      };
      const onDestroyed=()=>check();
      try{
        const observe=(fn,topic)=>{
          obs.addObserver(fn,topic);
          if(!active){
            try{obs.removeObserver(fn,topic);}catch{}
            throw workspaceCommandError("close-unavailable");
          }
        };
        observe(onClosed,"domwindowclosed");
        observe(onDestroyed,"xul-window-destroyed");
        verify();
        if(!active)throw workspaceCommandError("close-unavailable");
      }catch(error){cleanup();throw error;}
      let failure=null;
      try{const result=invoke();if(result&&typeof result.then==="function")await result;}
      catch(error){failure=error;}
      // Target Firefox 160 BrowserCommands.tryToCloseWindow is synchronous
      // through native confirmation and FinalClose. A false closed flag
      // with no observed close is a veto, not a pending native mutation.
      let accepted=true;
      try{accepted=ownerClosed||observed||child.closed===true||context.isDiscarded===true;}catch{}
      if(!accepted){cleanup();if(failure)throw failure;return {status:"not-closed"};}
      check();
      return closedPromise;
    }
    async function acceptProjectionReturn(child,projection){
      const native=manager(),childNative=child?.gZenWorkspaces,sync=window.gZenWindowSync;
      const current=()=>{
        try{return !destroyed&&!window.closed&&manager()===native&&canProject()&&
          workspaceCommandGate(window).returnEndpoint===acceptProjectionReturn&&
          !!child&&!child.closed&&child[PROJECTION]===projection&&projection?.source===window&&
          child.gZenWorkspaces===childNative&&child.gZenWindowSync===sync&&window.gZenWindowSync===sync&&
          !child._zenClosingWindow&&!window._zenClosingWindow;}
        catch{return false;}
      };
      const {BrowserWindowTracker}=ChromeUtils.importESModule("resource:///modules/BrowserWindowTracker.sys.mjs");
      return runWorkspaceCommand(window,native,"projection-return",current,async lease=>{
        const verify=()=>{
          requireWorkspaceDataCommand(window,native,lease);
          if(!projectionReturnTarget(child,window,BrowserWindowTracker,trashSessionStore()))
            throw workspaceCommandError("return-target","Return requires the original window to be the only eligible surviving window.");
          if(!inspectProjectionReturn(child,window,childNative,native,sync))
            throw workspaceCommandError("return-unverified","Tab ownership or browser transfer could not be verified. Close any Glance view and try again.");
          requireWorkspaceDataCommand(window,native,lease);
        };
        projectionLog(child,"return-request");
        const result=await invokeProjectionClose(child,verify,()=>{
          // The pinned native API performs its own beforeunload checks.
          // No trusted event is synthesized to enter close animation.
          if(typeof child.BrowserCommands?.tryToCloseWindow!=="function")
            throw workspaceCommandError("return-unavailable","Use the native close-window command.");
          return child.BrowserCommands.tryToCloseWindow();
        });
        projectionLog(window,"return-result",{outcome:result.status});
        if(result.status==="closed"&&!window.closed)try{window.focus();}catch{}
        return result;
      },{data:true,peer:{win:child,native:childNative}});
    }
    async function returnProjection(){
      const projection=window[PROJECTION],source=projection?.source,native=manager(),sync=window.gZenWindowSync;
      if(projectionBusy||busy||destroyed||commandBlocked()||!source||source.closed||!canProject()||source.gZenWindowSync!==sync){
        status.textContent="Main synced window unavailable.";return;
      }
      const session=hubSession;
      projectionBusy=true;projectionStartedAt=workspaceCommandNow(window);pendingWatch?.refresh();
      try{
        const endpoint=workspaceCommandGate(source).returnEndpoint;
        if(typeof endpoint!=="function")throw workspaceCommandError("return-unavailable","Open the native window close command instead.");
        const result=await endpoint(window,projection);
        if(hubViewCurrent(session)&&result?.status==="not-closed")status.textContent="Native window close was not completed.";
      }catch(error){
        if(hubViewCurrent(session))status.textContent=error?.code==="data-busy"?"Another native Workspace data command is pending.":error?.code==="return-unavailable"?"Use the native close-window command.":error?.code==="return-target"?"Return target changed. Try again.":error?.code==="return-unverified"?"Tab ownership could not be verified. Close any Glance view and try again.":"Could not return safely.";
        projectionLog(window,"return-rejected",{reason:["return-target","return-unverified"].includes(error?.code)?error.code:"unavailable"});
      }finally{projectionBusy=false;projectionStartedAt=null;settleHubView(session);}
    }
    async function select(id){
      if(busy||projectionBusy||destroyed)return;
      if(commandBlocked()){pendingWatch?.refresh();return;}
      const native=manager(),space=hubWorkspaceSnapshot(native)?.find(s=>s.id===id);
      if(!space){render();return;}if(space.active){contextId=null;confirmation=null;render();return;}
      const session=hubSession;
      busy=true;status.textContent="";render();
      try{switchGuard();const transition=window.__zenRefinedWorkspaceTransition;
    typeof window!=="undefined"&&window.__nocturneTrace?.("hub.workspace.request",()=>({hasTransition:!!transition}),{sample:1800});
        await requestWorkspaceSwitch(window,native,id,"hub-select",()=>!destroyed&&manager()===native);
        if(hubViewCurrent(session)){contextId=null;confirmation=null;scheduleHubGeometry();}
      }catch(error){if(hubViewCurrent(session))status.textContent="Could not switch workspace.";console.warn("[OnePlane] Hub switch:",nocturneErrorClass(error));}
      finally{busy=false;settleHubView(session);}
    }
    async function create(event){
      event.preventDefault();const value=name.value.trim(),native=manager();
      if(!value||busy||projectionBusy||destroyed||!hubWorkspaceSnapshot(native)||typeof native.createAndSaveWorkspace!=="function")return;
      if(commandBlocked()){pendingWatch?.refresh();return;}
      const session=hubSession;
      busy=true;status.textContent="";render();
      try{await runWorkspaceCommand(window,native,"hub-create",()=>!destroyed&&manager()===native&&canManage(),async lease=>{
        const result=await native.createAndSaveWorkspace(value,undefined,true);
        requireWorkspaceCommand(window,native,lease);
        if(!result?.uuid||!native.getWorkspaceFromId(result.uuid))throw Error("Native workspace creation unavailable");
      },{data:true});
        if(hubViewCurrent(session)){name.value="";contextId=null;confirmation=null;scheduleHubGeometry();}
      }catch(error){if(hubViewCurrent(session))status.textContent=error?.code==="data-busy"?"Another native Workspace data command is pending.":"Could not create workspace.";console.warn("[OnePlane] Hub create:",nocturneErrorClass(error));}
      finally{busy=false;settleHubView(session);}
    }
    function ensure(){
      if(destroyed)return;
      if(button.parentElement!==target)target.prepend(button);
      if(panel.parentElement!==root)root.append(panel);
    }
    function toggle(event){
      event.preventDefault();event.stopPropagation();
      if(!supported()||destroyed)return;
      if(open){close();return;}
      ensure();if(!panel.isConnected)return;
      if(window.__nocturneOverlay&&!window.__nocturneOverlay.request("hub"))return;
      status.textContent="";contextId=null;confirmation=null;open=true;hubSession++;trashOpen=false;
      // A fast reopen can interrupt the closing animation while the old drawer is visible.
      const resetVisibleTrash=!panel.hidden&&trashPanel.hasAttribute("data-op-trash-open");
      if(resetVisibleTrash)trashPanel.setAttribute("data-op-trash-reset","");
      button.setAttribute("aria-expanded","true");setHold(true);
      try{render();}finally{
        if(resetVisibleTrash){trashPanel.getBoundingClientRect();trashPanel.removeAttribute("data-op-trash-reset");}
      }
      try{
        if(!showPopup()){close();return;}
        (panel.querySelector('.op-hub-space[aria-current="true"]:not(:disabled)')||panel.querySelector(".op-hub-space:not(:disabled)")||mode).focus({preventScroll:true});
      }catch(error){close();console.warn("[OnePlane] Hub open:",nocturneErrorClass(error));}
    }
    function key(event){
      if(!open||event.key!=="Escape"||event.defaultPrevented||window.__nocturneOverlay?.allowsEscape("hub",event)===false)return;
      event.preventDefault();event.stopPropagation();
      if(!ageMenu.hidden){setTrashAgeOpen(false);ageSelect.focus({preventScroll:true});return;}
      if(trashDrag){cancelTrashDrag();return;}if(drag){cancelDrag();return;}if(confirmation){confirmation=null;render();return;}if(contextId){contextId=null;render();return;}close(true);
    }
    function changed(){if(open){if(drag&&!manager()?.getWorkspaceFromId(drag.id))cancelDrag();if(!drag&&!trashDrag&&!editId)render();scheduleHubGeometry();}}
    function onMode(){if(!supported())close(false,true);else if(open){setHold(true);changed();}}
    function deactivate(){if(drag)cancelDrag();if(trashDrag){finishTrashDrag();renderTrash();}if(open&&!busy&&!projectionBusy)close();}
    function toggleMode(){
      const cmd=command();if(typeof cmd?.doCommand!=="function"||!open)return;
      setHold(true);
      try{cmd.doCommand();changed();}catch(error){console.warn("[OnePlane] Compact Mode:",nocturneErrorClass(error));}
    }
    function onInput(){add.disabled=busy||workspaceCommandPresentationBlocked(hubCommandState())||!name.value.trim();}
    function onOutside(event){
      if(!open)return;const path=event.composedPath();
      if(!path.includes(panel)&&!path.includes(button)){close();return;}
      if(!ageMenu.hidden&&!path.includes(ageMenu)&&!path.includes(ageSelect))setTrashAgeOpen(false);
    }
    function stopDrag(event){event.stopPropagation();}
    function stopDouble(event){event.preventDefault();event.stopImmediatePropagation();}
    const listeners=[[button,"click",toggle],[button,"pointerdown",stopDrag],[button,"mousedown",stopDrag],[button,"dblclick",stopDouble],
      [panel,"keydown",key],[form,"submit",create],[mode,"click",toggleMode],[returnButton,"click",()=>void returnProjection()],[window,"deactivate",deactivate],[name,"input",onInput],[window,"resize",scheduleHubGeometry]];
    const hubScope=createDisposableScope({onError:(resource,error)=>{
      try{window.__nocturneTrace?.("layout.scope.error",{owner:"hub",resource,name:error?.name||"Error"},{flush:true});}catch{}
    }});
    let unregisterOverlay=()=>true,mounted=false,overlayGeneration=0;
    function bindOverlay(){
      if(destroyed||hubScope.closed)return;
      const generation=++overlayGeneration;
      unregisterOverlay();
      if(destroyed||hubScope.closed||generation!==overlayGeneration)return;
      const live=()=>!destroyed&&!hubScope.closed&&generation===overlayGeneration;
      const off=window.__nocturneOverlay?.register("hub",{
        priority:20,isActive:()=>live()&&(open||!panel.hidden),
        canYield:()=>live()&&!drag&&!trashDrag,
        yield:()=>{if(!live())return false;close(false,true);return panel.hidden;},
        onEscape:event=>{if(!live())return false;if(open)key(event);return true;}
      });
      const release=typeof off==="function"?hubScope.defer("overlay",off):()=>true;
      if(!live()){release();return;}
      unregisterOverlay=release;
    }
    listeners.push([window,"Nocturne:OverlayReady",bindOverlay]);
    for(const event of ["ZenWorkspaceDataChanged","ZenWorkspacesUIUpdate","ZenCompactMode:Toggled","ZenCompactMode:LayoutUpdate"])listeners.push([window,event,changed]);
    function mount(){
      if(destroyed||mounted)return;
      mounted=true;
      bindOverlay();
      const gate=workspaceCommandGate(window);
      gate.returnEndpoint=acceptProjectionReturn;
      hubScope.defer("projection-return-endpoint",()=>{if(gate.returnEndpoint===acceptProjectionReturn)delete gate.returnEndpoint;});
      pendingWatch=watchWorkspaceCommand(window,()=>open&&!destroyed,updatePending,hubCommandState);
      hubScope.defer("workspace-pending-view",()=>pendingWatch.dispose());
      hubScope.listen(window,"pointerdown",onOutside,true);
      for(const [node,event,fn] of listeners)hubScope.listen(node,event,fn);
    }
    function destroy(){
      if(destroyed)return;destroyed=true;
      cleanupStep("hub close",()=>close(false,true));
      const result=hubScope.dispose();
      try{window.__nocturneTrace?.("layout.scope.dispose",{owner:"hub",...result},{flush:true});}catch{}
      cleanupStep("hub badge",()=>hideDragBadge(true));
      cleanupStep("hub placement",()=>clearPlacementPreview(true));
      cleanupStep("hub panel",()=>panel.remove());
      cleanupStep("hub button",()=>button.remove());
    }
    return {mount,ensure,close,onMode,destroy};
  }
  const hub=createHubController({target,root,toolbarWrapper,supported:hoverSupported,hold:reconcilePanel,switchGuard:guardPanelSwitch});

  // Zen 1.24.2b URILoadingHelper enumerates allUsedBrowsers across windows.
  // Filter only for the duration of a synchronous reuse lookup. Never
  // change workspace ownership, provider databases, or the native getter
  // outside this call. Explicit tab selection continues to use Zen's API.
  function installWorkspaceLinkScope(){
    const nativeSwitch=window.switchToTabHavingURI;
    if(typeof nativeSwitch!=="function")return ()=>{};
    const helper=ChromeUtils.importESModule("resource:///modules/URILoadingHelper.sys.mjs").URILoadingHelper;
    const scopeKey=Symbol.for("oneplane.workspace-uri-getter");
    const transactionKey=Symbol.for("oneplane.workspace-uri-transaction");
    const busy=()=>helper[transactionKey]?.live===true;
    const blocked=Symbol("reentrant-uri-lookup");
    let released=false;
    const trace=(event,data)=>{try{window.__nocturneTrace?.(event,data,{flush:true});}catch{}};
    const active=()=>!released&&root.hasAttribute("oneplane-active")&&
      window.gZenWorkspaces?.workspaceEnabled&&!!window.gZenWorkspaces.activeWorkspace;
    function withScope(run,split=null){
      if(busy())return blocked;
      if(!active())return blocked;
      const transaction={live:true};
      // The native helper is shared across windows. Lock before touching
      // the first manager, including descriptor acquisition and rollback.
      try{Object.defineProperty(helper,transactionKey,{configurable:true,value:transaction});}
      catch{return undefined;}
      try{return scopedLookup(run,split);}
      finally{
        transaction.live=false;
        try{if(helper[transactionKey]===transaction&&!Reflect.deleteProperty(helper,transactionKey))throw Error("URI transaction release failed");}
        catch{trace("hub.uri.transaction.release",{failed:true});}
      }
    }
    function scopedLookup(run,split=null){
      const restores=[];
      let phase="acquire";
      function restoreAll(){
        let failed=0,foreign=0;
        // Invalidate every temporary getter before attempting any restore.
        // If a native descriptor becomes non-configurable, its remaining
        // getter delegates to the original native state, never a stale list.
        for(const entry of restores){entry.live=false;entry.list=null;}
        for(const entry of restores.reverse()){
          try{
            const {manager,descriptor,getter}=entry;
            if(Object.getOwnPropertyDescriptor(manager,"allUsedBrowsers")?.get!==getter){foreign++;continue;}
            if(descriptor)Object.defineProperty(manager,"allUsedBrowsers",descriptor);
            else if(!Reflect.deleteProperty(manager,"allUsedBrowsers"))throw Error("Native getter removal failed");
          }catch{failed++;}
        }
        if(failed||foreign||phase!=="run")trace("hub.uri.scope.restore",{phase,count:restores.length,failed,foreign});
      }
      try{
        const enumerator=Services.wm.getEnumerator("navigator:browser"),windows=new Set([window]);
        while(enumerator.hasMoreElements())windows.add(enumerator.getNext());
        for(const win of windows){
          if(win.closed||!win.gBrowser)continue;
          const manager=win.gZenWorkspaces;
          if(!manager)throw Error("Native workspace lookup unavailable");
          const descriptor=Object.getOwnPropertyDescriptor(manager,"allUsedBrowsers");
          if(descriptor?.get?.[scopeKey]){
            if(descriptor.get[scopeKey].live){phase="reentrant";return blocked;}
            // A failed restore must not accumulate layers of inert getters.
            throw Error("Previous native getter restore unresolved");
          }
          if(descriptor&&!descriptor.configurable)throw Error("Native workspace lookup cannot be scoped");
          const original=manager.allUsedBrowsers;
          if(!Array.isArray(original))throw Error("Native browser list unavailable");
          const list=win===window?original.filter(b=>{
            const t=win.gBrowser.getTabForBrowser(b);
            return hubWorkspaceBrowserEligible(t,manager.activeWorkspace);
          }):[];
          // Firefox 160 split-view selection indexes gBrowser.tabs, while
          // Zen's lookup enumerates allUsedBrowsers. Never move the wrong tab.
          if(win===window&&split&&list.some((b,i)=>win.gBrowser.getTabForBrowser(b)!==win.gBrowser.tabs[i])){
            phase="split-index";return undefined;
          }
          const entry={manager,descriptor,list,live:true,getter:null};
          const getter=function(){
            if(entry.live)return entry.list;
            if(descriptor)return "value" in descriptor?descriptor.value:descriptor.get?.call(this);
            return Reflect.get(Object.getPrototypeOf(manager),"allUsedBrowsers",this);
          };
          Object.defineProperty(getter,scopeKey,{value:entry});entry.getter=getter;
          // Track before defineProperty so a throwing proxy cannot strand
          // a successful partial acquisition.
          restores.push(entry);
          Object.defineProperty(manager,"allUsedBrowsers",{configurable:true,enumerable:descriptor?.enumerable??false,get:getter});
        }
        if(!active()){phase="cancelled";return blocked;}
        phase="run";
      }catch(error){
        console.warn("[OnePlane] Could not scope workspace URI lookup:",nocturneErrorClass(error));
        return undefined;
      }finally{
        if(phase!=="run")restoreAll();
      }
      // Preserve the native outcome even when a subsequent restore fails;
      // never issue a duplicate open after a successful native switch.
      try{return run();}finally{restoreAll();}
    }
    function fallback(uri,openNew,params={},context=null){
      if(!openNew)return false;
      const spec=typeof uri==="string"?uri:uri.spec;
      const options={...params};
      for(const key of ["ignoreFragment","ignoreQueryString","replaceQueryString","adoptIntoActiveWindow"])delete options[key];
      if(context!==null&&context!==undefined)options.userContextId=context;
      helper.openTrustedLinkIn(window,spec,"tab",options);return false;
    }
    function scopedSwitch(uri,openNew,params={},context=null,split=null){
      if(busy())return false;
      if(!active())return nativeSwitch.apply(this,arguments);
      const result=withScope(()=>nativeSwitch.call(this,uri,openNew,{...params},context,split),split);
      if(result===blocked||result===undefined&&!active())return false;
      return result===undefined?fallback(uri,openNew,params,context):result;
    }
    window.switchToTabHavingURI=scopedSwitch;
    let unregister=()=>{};
    try{
      const {UrlbarParentController}=ChromeUtils.importESModule("moz-src:///browser/components/urlbar/UrlbarParentController.sys.mjs");
      const proto=UrlbarParentController.prototype,key=Symbol.for("oneplane.workspace-urlbar-scope");
      let registry=proto[key];
      if(registry&&proto.switchToTab!==registry.wrapper)throw Error("Foreign URL bar wrapper");
      if(!registry){
        const descriptor=Object.getOwnPropertyDescriptor(proto,"switchToTab"),original=descriptor?.value;
        if(typeof original!=="function")throw Error("URL bar switch API unavailable");
        const clients=new Map();
        const wrapper=function(data){
          if(busy())return;
          const client=clients.get(this.browserWindow);
          return client?client(this,data,original):original.call(this,data);
        };
        registry={clients,original,wrapper,descriptor};
        Object.defineProperty(proto,key,{configurable:true,value:registry});
        try{Object.defineProperty(proto,"switchToTab",{...descriptor,value:wrapper});}
        catch(error){
          try{if(proto[key]===registry&&proto.switchToTab!==wrapper)Reflect.deleteProperty(proto,key);}catch{}
          throw error;
        }
      }
      const client=(controller,data,original)=>{
        if(busy())return;
        if(!active()||!data?.url)return original.call(controller,data);
        const context=data.userContextId??0;
        // Firefox 160 UrlbarShared.isNonPrivateUserContextId uses != -1.
        const userContext=context==-1?null:context;
        const previous=browser.selectedTab,split=previous?.splitview;
        // Use the same native URI matcher exactly once, without its
        // open-new or stale-provider-unregister branch. A local miss is not
        // evidence that a real tab in another workspace ceased to exist.
        const result=withScope(()=>typeof helper.switchToTabHavingURI==="function"?
          helper.switchToTabHavingURI(window,data.url,false,{},userContext,split):undefined,split);
        if(result===blocked||!active())return;
        if(result===true){
          if(!split&&previous?.isEmpty&&previous.isConnected!==false&&browser.selectedTab!==previous)browser.removeTab(previous);
        }else{
          const params=userContext===null?{}:{userContextId:userContext};
          helper.openTrustedLinkIn(window,data.url,"tab",params);
        }
        if(!data.heuristic)controller.addToInputHistory?.(data.url,data.searchString);
      };
      registry.clients.set(window,client);
      unregister=()=>{
        if(registry.clients.get(window)===client)registry.clients.delete(window);
        if(!registry.clients.size&&proto[key]===registry){
          if(proto.switchToTab===registry.wrapper){
            if(registry.descriptor)Object.defineProperty(proto,"switchToTab",registry.descriptor);
            else proto.switchToTab=registry.original;
          }
          if(!Reflect.deleteProperty(proto,key))throw Error("URL bar registry removal failed");
        }
      };
    }catch(error){console.warn("[OnePlane] URL bar workspace isolation unavailable:",nocturneErrorClass(error));}
    return ()=>{
      if(released)return;released=true;
      let failed=0;
      try{unregister();}catch{failed++;}
      try{if(window.switchToTabHavingURI===scopedSwitch)window.switchToTabHavingURI=nativeSwitch;}catch{failed++;}
      trace("hub.uri.dispose",{failed});
    };
  }
  let releaseWorkspaceLinkScope=()=>{};


  // Target Zen 1.24.2b TabContextMenu resolves triggerNode.tab.
  // Fail closed rather than accidentally acting on the selected tab.
  let nativeTabMenu=null,nativeTabMenuCleanup=null;
  function closeNativeTabMenu(){if(nativeTabMenu)nativeTabMenu.hidePopup();nativeTabMenuCleanup?.();}
  function openNativeTabMenu(event,tab,button){
    if(!hoverSupported()||!validNativeTab(tab))return;
    const popup=document.getElementById("tabContextMenu");
    if(!popup||typeof popup.openPopupAtScreen!=="function")return;
    event.preventDefault();event.stopPropagation();hub.close();closeNativeTabMenu();
    const trigger=event.target;if(!trigger||!button.parentElement?.contains(trigger))return;
    trigger.tab=tab;
    const guard=e=>{if(e.target===popup&&popup.triggerNode?.tab!==tab){e.preventDefault();e.stopImmediatePropagation();cleanup();}};
    const hidden=e=>{if(e.target===popup)cleanup();};
    const cleanup=()=>{
      popup.removeEventListener("popupshowing",guard,true);popup.removeEventListener("popuphidden",hidden);
      if(trigger.tab===tab)delete trigger.tab;
      if(nativeTabMenu===popup){nativeTabMenu=null;nativeTabMenuCleanup=null;toolbarWrapper?.removeAttribute("oneplane-tab-menu-hold");reconcilePanel();}
    };
    nativeTabMenu=popup;nativeTabMenuCleanup=cleanup;
    popup.addEventListener("popupshowing",guard,true);popup.addEventListener("popuphidden",hidden);
    toolbarWrapper?.setAttribute("oneplane-tab-menu-hold","true");reconcilePanel();
    const rect=button.getBoundingClientRect(),x=event.screenX||window.mozInnerScreenX+rect.left,y=event.screenY||window.mozInnerScreenY+rect.bottom;
    try{popup.openPopupAtScreen(x,y,true,event);}
    catch(error){cleanup();console.warn("[OnePlane] Native tab menu:",nocturneErrorClass(error));}
  }
  const contourPrefPrefix="zen.oneplane.fade-";
  let contourUntil=0, contourKey="",contourMode="",contourPainting=false,contourRevision=0,contourCommittedRevision=-1,contourProvider=null;
  let contourResize=null, contourObserver=null;
  const contourObserved=new Set();
  function contourSettings(){
    return readContourSettings((name,def)=>prefs.getIntPref(contourPrefPrefix+name,def));
  }
  const contourPreferenceObserver={observe(){scheduleContour();}};
  function contourPath(width,base,deep,left,right,radius){
    const r=Math.max(0,Math.min(radius,(deep-base)/2));
    const outside=radius+4;
    if(!r || left===null || right===null)
      return "M"+(-outside)+" "+base+"H"+(width+outside);
    const start=Math.min(-outside,left-2*r-outside);
    const end=Math.max(width+outside,right+2*r+outside);
    return "M"+start+" "+base+"H"+(left-2*r)+
      " A"+r+" "+r+" 0 0 1 "+(left-r)+" "+(base+r)+
      " V"+(deep-r)+" A"+r+" "+r+" 0 0 0 "+left+" "+deep+
      " H"+right+" A"+r+" "+r+" 0 0 0 "+(right+r)+" "+(deep-r)+
      " V"+(base+r)+" A"+r+" "+r+" 0 0 1 "+(right+2*r)+" "+base+
      " H"+end;
  }
  function contourAlpha(distance,settings){
    const t=Math.max(0,Math.min(1,(distance-settings.hold)/(settings.length-settings.hold)));
    return settings.strength/100*Math.pow(Math.max(0,1-t*t*(3-2*t)),settings.curve/100);
  }
  function contourImage(width,height,base,deep,left,right,settings){
    const edge=contourPath(width,base,deep,left,right,settings.radius);
    const startX=Number(edge.match(/^M(-?[\d.]+)/)[1]);
    const steps=64;
    const positions=Array.from({length:steps+1},(_,i)=>settings.length*i/steps);
    positions.push(settings.hold);
    positions.sort((a,b)=>a-b);
    const stops=positions.map(y=>'<stop offset="'+(y/settings.length).toFixed(6)+
      '" stop-color="black" stop-opacity="'+contourAlpha(y,settings).toFixed(6)+'"/>').join("");
    // Both shapes are opaque/partially opaque INSIDE the group. The
    // group itself gets the requested opacity exactly once. Thus the
    // silhouette is always the maximum alpha, never a sum of two tints.
    const svg='<svg xmlns="http://www.w3.org/2000/svg" width="'+width+'" height="'+height+'" viewBox="0 0 '+width+' '+height+'">'+
      '<defs><linearGradient id="fade" gradientUnits="userSpaceOnUse" x1="0" y1="'+base+'" x2="0" y2="'+(base+settings.length)+'">'+stops+'</linearGradient></defs>'+
      '<g opacity="'+(1-settings.transparency/100)+'"><rect x="0" y="'+base+'" width="'+width+'" height="'+settings.length+'" fill="url(#fade)"/>'+
      '<path fill="black" d="'+edge+'V-100H'+startX+'Z"/></g></svg>';
    return 'url("data:image/svg+xml,'+encodeURIComponent(svg)+'")';
  }

  // Geometry policy is independent of SVG rendering and of DOM ownership.
  // "visible" follows the clipped native shelf; "stable" reserves the
  // accepted maximum bookmark hover envelope. Do not merge these policies.
  function readContourSettings(read){
    const bounded=(name,def,min,max)=>{
      const v=read(name,def);
      return Math.max(min,Math.min(max,Number.isFinite(v)?v:def));
    };
    const length=bounded("length",69,10,160);
    return {transparency:bounded("transparency",4,0,40),strength:bounded("strength",100,0,100),
      length,hold:Math.min(length-1,bounded("hold",30,0,45)),curve:bounded("curve",65,25,300),
      radius:bounded("radius",24,4,24),padding:bounded("padding",0,0,20)};
  }
  function contourGeometry({wrapper,nav,row,bookmark=null,controls=[],shiftY=0,trim=5,settings,mode="visible",availableGrowth=0}){
    const finiteRect=r=>r&&["left","top","right","bottom","width","height"].every(k=>Number.isFinite(r[k]));
    if(!["visible","stable"].includes(mode)||!finiteRect(wrapper)||!finiteRect(nav)||!finiteRect(row)||
      !(wrapper.width>0&&nav.height>0)||![shiftY,trim,availableGrowth].every(Number.isFinite)||
      !settings||!["transparency","strength","length","hold","curve","radius","padding"].every(k=>Number.isFinite(settings[k]))||
      settings.length<=settings.hold||settings.length<=0)return null;
    const width=Math.max(1,Math.round(wrapper.width));
    const base=Math.max(1,Math.round(Math.max(nav.bottom,row.bottom)-wrapper.top-shiftY-trim));
    let left=null,right=null,deep=base,largest=0;
    if(finiteRect(bookmark)&&(mode==="stable"?bookmark.height>=1:bookmark.height>1)){
      for(const c of controls){
        const r=c.rect;
        if(!finiteRect(r)||r.width<1||r.height<1||r.right<=bookmark.left||r.left>=bookmark.right||
          r.bottom<=bookmark.top||r.top>=bookmark.bottom)continue;
        const stable=mode==="stable";
        const l=stable?r.left-wrapper.left:Math.max(0,r.left-wrapper.left,bookmark.left-wrapper.left);
        const h=stable?r.right-wrapper.left:Math.min(width,r.right-wrapper.left,bookmark.right-wrapper.left);
        if(h<=l)continue;
        const growth=stable?c.growthY??0:0,extra=stable?c.growthX??0:0;
        if(![growth,extra].every(Number.isFinite)||growth<0||extra<0)return null;
        left=left===null?l:Math.min(left,l);right=right===null?h:Math.max(right,h);
        deep=Math.max(deep,r.bottom-wrapper.top-shiftY+growth+settings.padding);
        largest=Math.max(largest,extra);
      }
    }
    if(left!==null){
      if(mode==="stable"){
        const extra=Math.min(largest,Math.max(0,availableGrowth));
        left=Math.max(0,left-extra);right=Math.min(width,right+extra);
      }
      if(right<=left){left=right=null;deep=base;}
      else{left=Math.floor(left-settings.padding);right=Math.ceil(right+settings.padding);deep=Math.ceil(deep);}
      if(deep<=base){left=right=null;deep=base;}
    }
    const height=Math.max(1,Math.ceil(Math.max(deep,base+settings.length)+1));
    const key=[width,height,base,deep,left,right,settings.transparency,settings.strength,settings.length,
      settings.hold,settings.curve,settings.radius,settings.padding].join(":");
    return {width,height,base,deep,left,right,key};
  }
  // A failed generator or inline style write must not publish a new key.
  // Restore both old values and priorities if a partial commit throws.
  function commitContourMask(surface,geometry,settings,render=contourImage){
    const style=surface.style,fields=["--op-contour-height","--op-contour-mask"];
    const prior=fields.map(k=>[k,style.getPropertyValue(k),style.getPropertyPriority(k)]);
    const {width,height,base,deep,left,right}=geometry;
    const mask=render(width,height,base,deep,left,right,settings);
    if(typeof mask!=="string"||!mask)throw Error("invalid contour mask");
    try{
      style.setProperty(fields[0],height+"px");style.setProperty(fields[1],mask);
      if(style.getPropertyValue(fields[0])!==height+"px"||style.getPropertyValue(fields[1])!==mask)throw Error("contour style rejected");
    }catch(error){
      for(const [k,v,p] of prior)try{if(v)style.setProperty(k,v,p);else style.removeProperty(k);}catch{}
      throw error;
    }
    return geometry.key;
  }
  function contourCandidates(){
    if(!bookmarks)return [];
    const items=document.getElementById("PlacesToolbarItems");
    const result=items?Array.from(items.children):[];
    const chevron=document.getElementById("PlacesChevron");
    if(chevron && bookmarks.contains(chevron))result.push(chevron);
    // Also cover native toolbar controls (e.g. Other Bookmarks) that
    // are placed beside the Places strip, not inside it.
    for(const node of bookmarks.querySelectorAll("toolbarbutton.bookmark-item, #OtherBookmarks")){
      if(!items?.contains(node) && !result.includes(node))result.push(node);
    }
    return result;
  }
  function observeContourNodes(){
    if(!contourResize)return;
    const wanted=new Set(contourCandidates());
    for(const node of contourObserved)if(!wanted.has(node)){
      contourResize.unobserve(node);contourObserved.delete(node);
    }
    for(const node of wanted)if(!contourObserved.has(node)){
      contourResize.observe(node);contourObserved.add(node);
    }
  }
  function bookmarkContourPolicy(force=false){
    if(!bookmarks)return "off";
    try{return window.__zenMagneticBookmarksShared?.contourPolicy?.(force,bookmarks)??"off";}
    catch{return "off";}
  }
  function paintContour(force=false,prehover=false,rows=null){
    if(contourPainting)return false;
    contourPainting=true;
    try{return paintContourNow(force,prehover,rows);}finally{contourPainting=false;}
  }
  function contourWriteAllowed(force){
    return !dead&&!!toolbarWrapper&&hoverSupported()&&!restingGeometryBlocked()&&!root.hasAttribute("data-zr-closing")&&!root.hasAttribute("data-zr-center-motion")&&!root.hasAttribute("data-op-bookmark-wave")&&!document.getElementById("PlacesToolbarItems")?.hasAttribute("data-zr-fold-bookmarks")&&
      (force||(!root.hasAttribute("data-zr-workspace-phase")&&root.getAttribute("data-zr-startup-phase")!=="playing"));
  }
  function paintContourNow(force,prehover,rows){
    if(!contourWriteAllowed(force))return false;
    // A switch can briefly hide or resize native bookmark controls.
    // Retain the last valid mask until the native layout settles.
    if(!force&&!prehover&&contourKey&&window.performance.now()<panelSwitchUntil)return false;
    const provider=window.__zenMagneticBookmarksShared,revision=contourRevision;
    const workspacePhase=root.getAttribute("data-zr-workspace-phase"),startupPhase=root.getAttribute("data-zr-startup-phase");
    const current=()=>contourWriteAllowed(force)&&provider===window.__zenMagneticBookmarksShared&&revision===contourRevision&&
      root.getAttribute("data-zr-workspace-phase")===workspacePhase&&root.getAttribute("data-zr-startup-phase")===startupPhase;
    if(prehover&&contourMode==="stable"&&contourProvider===provider&&contourCommittedRevision===revision&&
      bookmarkContourPolicy()==="ready")return current();
    let mode="visible",envelope=null;
    if(bookmarks&&provider?.readContourEnvelope){
      try{envelope=provider.readContourEnvelope(force,bookmarks,rows?.bookmark??null);}
      catch(error){
        window.__nocturneTrace?.("contour.provider.error",{name:error?.name||"Error"},{throttle:500});
        return false; // preserve last valid surface on provider failure
      }
      if(envelope?.status==="hold")return false;
      if(envelope?.status==="ready")mode="stable";
    }
    const wrapper=toolbarWrapper.getBoundingClientRect();
    const nav=rows?.nav??navbar?.getBoundingClientRect();
    if(wrapper.width<=0||!nav||nav.height<=0)return false;
    // The mask and controls share panel travel. Measure the unshifted
    // geometry, otherwise an in-flight reveal would distort the shelf.
    const container=document.getElementById("zen-appcontent-navbar-container");
    const translation=container?window.getComputedStyle(container).translate:"none";
    const shiftY=translation&&translation!=="none"?(parseFloat(translation.split(/\s+/)[1])||0):0;
    const settings=contourSettings(),rr=rows?.row??row.getBoundingClientRect();
    const compactRows=row.hasAttribute("data-op-overflow-row");
    const trim=parseFloat(window.getComputedStyle(row).getPropertyValue("--op-contour-trim"))||5;
    let bookmark=mode==="stable"?envelope.bookmark:null;
    const controls=mode==="stable"?envelope.controls:[];
    if(mode==="visible"&&bookmarks&&!bookmarks.hidden&&!bookmarks.collapsed){
      const style=window.getComputedStyle(bookmarks),bm=rows?.bookmark??bookmarks.getBoundingClientRect();
      if(style.display!=="none"&&style.visibility==="visible"&&bm.height>1){
        bookmark=bm;
        for(const node of contourCandidates()){
          if(node.hidden||node.collapsed||node.getAttribute("hidden")==="true"||node.getAttribute("collapsed")==="true")continue;
          const cs=window.getComputedStyle(node);
          if(cs.display==="none"||cs.visibility!=="visible"||(!force&&Number(cs.opacity)===0))continue;
          controls.push({rect:node.getBoundingClientRect()});
        }
      }
    }
    const geometry=contourGeometry({wrapper,nav,row:rr,bookmark,controls,shiftY,trim,settings,mode,
      availableGrowth:mode==="stable"?envelope.availableGrowth:0});
    if(!geometry||!current()||envelope?.current?.()===false||!current())return false;
    if(geometry.key===contourKey&&mode===contourMode){
      contourProvider=provider;contourCommittedRevision=revision;return true;
    }
    try{
      if(geometry.key!==contourKey)contourKey=commitContourMask(surface,geometry,settings);
      contourMode=mode;contourProvider=provider;contourCommittedRevision=revision;
    }
    catch(error){
      // Preserve the last committed key and retry on the next existing
      // invalidation. No independent retry timer or RAF.
      window.__nocturneTrace?.("contour.commit.error",{name:error?.name||"Error"},{throttle:500,flush:true});
      return false;
    }
    const {width,height,base,deep,left,right}=geometry;
    window.__nocturneTrace?.("contour.paint",()=>({force,mode,width,height,base,deep,left,right,overflow:compactRows,
      phase:root.getAttribute("data-zr-workspace-phase")}),{throttle:100,sample:1200});
    return current();
  }
  function stepContour(now,rows=null){
    if(dead)return;
    paintContour(false,false,rows);
    if(bookmarkContourPolicy()!=="off"){contourUntil=0;return;}
    if(now<contourUntil && hoverSupported()&&!restingGeometryBlocked()&&!root.hasAttribute("data-zr-closing")&&!root.hasAttribute("data-op-bookmark-wave")&&!root.hasAttribute("data-zr-workspace-phase")&&root.getAttribute("data-zr-startup-phase")!=="playing"&&!root.hasAttribute("data-zr-center-motion"))scheduleContour();
  }
  function scheduleContour(){
    if(dead)return;
    contourRevision++;
    queueGeometry(GEOMETRY_CONTOUR);
  }
  function onContourTransition(event){
    if(root.hasAttribute("data-op-bookmark-wave")||!contourObserved.has(event.target)||bookmarkContourPolicy()!=="off")return;
    if(!/^(margin|width|height|scale|translate|transform|padding)/.test(event.propertyName||""))return;
    // Magnetic Bookmarks can move through CSS transforms without a
    // resize notification. Follow only while its short transition runs.
    contourUntil=window.performance.now()+360;
    scheduleContour();
  }
  function toolbarCenterBias(left,right,trailingReserve,centered){
    const bias=right-left+(centered?0:trailingReserve);
    return {left:Math.max(0,Math.round(bias)),right:Math.max(0,Math.round(-bias))};
  }

  // One pass-local collapsed-slot budget; no live DOM or painted widths.
  function restingToolbarBudget({widths,groups,windowWidth,right,tabWidth,dragRoom,iconHome,returnReserve}){
    const naturalTabsWidth=widths.reduce((n,w)=>n+w+3,0);
    const boundary=islandBoundary(widths,tabWidth+3);
    const availableAt=leftEdge=>Math.max(0,2*Math.min(windowWidth/2-leftEdge,windowWidth/2-right)-4-2*dragRoom);
    const planAt=available=>{
      const title=iconHome?32:Math.max(100,Math.min(180,available-2*(tabWidth+9)));
      return planAdaptiveTabRows(widths,groups,boundary,available,title,tabWidth,3,returnReserve);
    };
    return {naturalTabsWidth,availableAt,planAt};
  }
  // The plus follows the occupied right lane, not the symmetric row's
  // far edge. Keep the existing expansion reserve in Expand mode.
  function rightPlusOffset(widths, expansion=0){
    return 3+widths.reduce((sum,w)=>sum+Math.max(0,w)+3,0)+Math.max(0,expansion);
  }

  // Compute every CSS length before partition moves or focus callbacks.
  function toolbarPartitionMetrics({layout,widths,available,windowWidth,tabWidth,openWidth,iconHome}){
    const widthOf=indices=>indices.reduce((n,i)=>n+widths[i]+3,6);
    const hoverReserve=Math.ceil(tabWidth*.20);
    const expandReserve=layout.mode==="wide"?(iconHome?Math.max(0,openWidth-tabWidth):hoverReserve):0;
    const half=Math.max(widthOf(layout.topLeft),widthOf(layout.topRight)+(layout.topPlus?tabWidth+3:0),tabWidth+9)+expandReserve;
    const topWidth=layout.mode==="wide"?Math.min(available,layout.title+6+2*half):Math.max(layout.title+6,available);
    const bottomBudget=Math.max(tabWidth+6,windowWidth-24);
    const lowerNatural=widthOf(layout.lower)+2*(tabWidth+3)+(iconHome?Math.max(0,openWidth-tabWidth):hoverReserve);
    const bottomWidth=Math.min(bottomBudget,Math.max(3*tabWidth+12,lowerNatural));
    return {islandWidth:layout.title,rowWidth:Math.max(layout.title+6,topWidth),
      plusOffset:rightPlusOffset(layout.topRight.map(i=>widths[i]),expandReserve),
      overflowWidth:bottomWidth,bottomOpen:Math.max(tabWidth,Math.min(openWidth,bottomWidth-2*(tabWidth+3)-6))};
  }
  const leftIds = new Set(["oneplane-hub-button", "oneplane-download-indicator-slot", "sidebar-button", "sidebar-toggle-button", "back-button",
    "forward-button", "stop-reload-button", "reload-button", "home-button", "urlbar-container"]);
  const centerIds = new Set(["oneplane-tabs", "oneplane-center-start", "oneplane-center-end"]);
  const GEOMETRY_HEIGHT=1,GEOMETRY_CONTOUR=2,GEOMETRY_CENTER=4;
  let geometryFrame=0,geometryDirty=0,geometryRunning=false,geometryTicket=0;
  let geometryObserver = null;
  let centering=false;
  const adaptiveGeometryPrefs={observe(){schedule();scheduleGeometry();}};
  // Center Motion consumes actual resting strip geometry, not a second
  // layout plan. Offset metrics ignore owned WAAPI scale and translate.
  function captureCenterGeometry(expectedRow,mode){
    if(dead||expectedRow!==row||!row.isConnected)return null;
    const nodes=[row,list,leftLane,rightLane,bottomLane,island,plus,
      ...list.querySelectorAll(".oneplane-tab,.oneplane-split-group,.oneplane-split-handle")];
    const viewport=()=>[window.innerWidth,window.innerHeight,window.devicePixelRatio];
    const measure=()=>{
      const rr=row.getBoundingClientRect();
      const slots=nodes.map(n=>{
        const connected=n.isConnected;
        if(!connected)return {connected,parent:n.parentElement}; // unused lanes
        const metrics=[n.offsetLeft,n.offsetTop,n.offsetWidth,n.offsetHeight,n.clientWidth,n.clientHeight];
        const scroll=n===list||n===leftLane||n===rightLane||n===bottomLane?
          [n.scrollLeft,n.scrollTop,n.scrollWidth,n.scrollHeight]:[];
        // Fold needs fractional row-local rectangles too. Assembly moves
        // the plus independently; Bloom intentionally scales real cards.
        const r=mode==="fold"&&n!==plus&&n!==row?n.getBoundingClientRect():null;
        const local=r?[r.left-rr.left,r.top-rr.top,r.width,r.height]:[];
        return {connected,parent:n.parentElement,offsetParent:n.offsetParent,metrics,scroll,local};
      });
      const flags=["data-op-show-island","data-op-island-tight","data-op-home-icon","data-op-overflow-row",
        "data-op-adaptive-compact","data-op-bottom-plus"].map(k=>row.hasAttribute(k));
      return {view:viewport(),outer:[rr.width,rr.height],slots,flags};
    };
    const finite=a=>a.every(Number.isFinite);
    const sane=s=>finite(s.view)&&s.view.every(v=>v>0)&&finite(s.outer)&&s.outer.every(v=>v>0)&&
      s.slots.every(x=>!x.connected||finite(x.metrics)&&finite(x.scroll)&&finite(x.local));
    const same=(a,b,epsilon=0)=>a.length===b.length&&a.every((v,i)=>Math.abs(v-b[i])<=epsilon);
    const before=measure();
    if(!sane(before))return null;
    return ()=>{
      if(dead||!row.isConnected)return false;
      const after=measure();
      return sane(after)&&same(before.view,after.view)&&same(before.outer,after.outer,.5)&&
        before.flags.every((v,i)=>v===after.flags[i])&&
        before.slots.every((a,i)=>{
          const b=after.slots[i];
          return a.connected===b.connected&&a.parent===b.parent&&(!a.connected||
            a.offsetParent===b.offsetParent&&same(a.metrics,b.metrics)&&same(a.scroll,b.scroll,.25)&&same(a.local,b.local,.5));
        });
    };
  }
  function checkCenterGeometry(stage){
    if(!dead&&root.hasAttribute("data-zr-center-motion"))
      window.__nocturneCenterMotion?.invalidateGeometry?.(row,stage);
  }
  function onLaneScroll(){
    checkCenterGeometry("scroll");
    refreshIndicator();
  }
  function restingGeometryBlocked(){
    // Only the interaction owner may move slots during a drag/cascade.
    // The fully hidden cascade may reconcile before its next reveal.
    return row.hasAttribute("data-op-dragging")||row.hasAttribute("data-op-island-incoming")||row.hasAttribute("data-op-lane-drag")||
      row.hasAttribute("data-op-live-drag")||row.hasAttribute("data-op-magnetic-pull")||cascadeState==="hiding"||cascadeState==="showing";
  }
  function centerToolbar(){
    if(centering||!geometryWriteAllowed())return false;
    centering=true;
    try {
      const windowWidth=window.innerWidth,order=stripOrderSnapshot;
      const targetRect = target.getBoundingClientRect();
      // Center the collapsed tabs against the WINDOW, not the remaining toolbar.
      // Native window buttons and all left/right controls consume edge space.
      let left = Math.max(0, targetRect.left);
      let right = Math.max(0, windowWidth - targetRect.right);
      let addressExtent=0,addressMarginsAtRead=null;
      for (const child of target.children) {
        if (centerIds.has(child.id) || child.localName === "toolbarspring") continue;
        const box = child.getBoundingClientRect();
        if (!box.width) continue;
        const style = window.getComputedStyle(child);
        const margins=(parseFloat(style.marginLeft)||0)+(parseFloat(style.marginRight)||0);
        const extent=box.width+margins;
        if(child===url){addressExtent=extent;addressMarginsAtRead=margins;continue;}
        if (leftIds.has(child.id)) left += extent;
        else right += extent;
      }
      const setLength = (node, name, value) => {
        const next = Math.max(0, Math.round(value)) + "px";
        if (node.style.getPropertyValue(name) !== next) node.style.setProperty(name, next);
      };
      const rowWidth = row.getBoundingClientRect().width;
      const style=window.getComputedStyle(row);
      const tabWidth=parseFloat(style.getPropertyValue("--op-tab"))||36;
      const openWidth=parseFloat(style.getPropertyValue("--op-tab-open"))||180;
      const dragRoom=parseFloat(style.getPropertyValue("--op-window-drag-room"))||4;
      const wantsIsland=row.hasAttribute("data-op-show-island");
      const iconHome=row.hasAttribute("data-op-home-icon");
      const addressHidden=url.hasAttribute("data-op-empty")||url.hasAttribute("data-op-home");
      const workspacePhase=root.getAttribute("data-zr-workspace-phase"),startupPhase=root.getAttribute("data-zr-startup-phase");
      if(!geometryWriteAllowed())return false;
      // Address budgeting and partition use one collapsed input snapshot.
      const widths=order.map(n=>compactSlotWidth(n,tabWidth));
      const groups=order.map(n=>n.classList.contains("oneplane-split-group"));
      const returnReserve=row.hasAttribute("data-op-adaptive-compact")?12:0;
      const {naturalTabsWidth,availableAt,planAt}=restingToolbarBudget({widths,groups,windowWidth,right,tabWidth,dragRoom,iconHome,returnReserve});
      const stillCurrent=()=>!dead&&stripOrderSnapshot===order&&window.innerWidth===windowWidth&&
        geometryWriteAllowed()&&
        row.hasAttribute("data-op-show-island")===wantsIsland&&row.hasAttribute("data-op-home-icon")===iconHome&&
        (url.hasAttribute("data-op-empty")||url.hasAttribute("data-op-home"))===addressHidden&&
        root.getAttribute("data-zr-workspace-phase")===workspacePhase&&root.getAttribute("data-zr-startup-phase")===startupPhase;
      const rejectStale=()=>{if(!dead){scheduleGeometry();window.__nocturneTrace?.("geometry.center.stale",{},{throttle:500});}return false;};
      {
        const preferred=prefs.getIntPref("zen.oneplane.address-width",180);
        const natural=naturalTabsWidth+(iconHome?32:180)+tabWidth+18;
        const fullBudget=2*Math.min(windowWidth/2-left-preferred-8,windowWidth/2-right)-8-2*dragRoom;
        const compactAddress=windowWidth<900||(fullBudget<natural&&left+preferred+8>=right);
        // Budget for up to two collapsed cards on each side of Home.
        const pairReserve=16+3+2*tabWidth+3+2+dragRoom+4;
        const singleReserve=16+3+tabWidth+2+dragRoom+4;
        const canFit=reserve=>windowWidth/2-right>=reserve&&windowWidth/2-left-36-8>=reserve;
        const reserve=compactAddress?(canFit(pairReserve)?pairReserve:canFit(singleReserve)?singleReserve:16+dragRoom+4):16+dragRoom+4;
        const baseline=adaptiveAddressWidth(preferred,windowWidth,left,reserve,8,compactAddress);
        const readAddressMargins=()=>{const style=window.getComputedStyle(url);return (parseFloat(style.marginLeft)||0)+(parseFloat(style.marginRight)||0);};
        const addressMargins=addressMarginsAtRead??readAddressMargins();
        // Only reclaim actual spare width, including native margins and
        // drag-room. Do not move Home, remove upper tabs or change rows.
        const desired=wantsIsland&&!addressHidden?
          reclaimAddressWidth(preferred,baseline,w=>planAt(availableAt(left+w+addressMargins))):baseline;
        const iconChanged=url.hasAttribute("data-op-address-icon")!==(desired<80);
        const widthChanged=url.style.getPropertyValue("--op-url")!==desired+"px";
        if(iconChanged)url.toggleAttribute("data-op-address-icon",desired<80);
        if(widthChanged){
          setLength(url,"--op-url",desired);
          addressCompactWidth=0;addressAnchor=null;alignAddressStart();
        }
        if(addressHidden)addressExtent=0;
        else if(iconChanged||widthChanged||addressMarginsAtRead===null)
          addressExtent=url.getBoundingClientRect().width+readAddressMargins();
      }
      if(!stillCurrent())return rejectStale();
      left+=addressExtent;
      const collapsedTabsWidth=Math.min(naturalTabsWidth,Math.max(0,rowWidth-tabWidth-3));
      const trailingReserve=Math.max(0,rowWidth-collapsedTabsWidth);
      const available=availableAt(left);
      const centered=wantsIsland;
      if(centered){
        const layout=planAt(available);
        const metrics=toolbarPartitionMetrics({layout,widths,available,windowWidth,tabWidth,openWidth,iconHome});
        row.removeAttribute("data-op-island-tight");
        // Lane reparent/focus may synchronously publish a new topology.
        if(!applyStripPartition(layout,order,stillCurrent)||!stillCurrent())return rejectStale();
        row.toggleAttribute("data-op-island-compact",!iconHome&&layout.title===32);
        setLength(row,"--op-island-width",metrics.islandWidth);
        setLength(row,"--op-island-row-width",metrics.rowWidth);
        setLength(row,"--op-right-plus-offset",metrics.plusOffset);
        setLength(row,"--op-overflow-width",metrics.overflowWidth);
        setLength(row,"--op-bottom-open",metrics.bottomOpen);
      }else if(!centered)row.style.removeProperty("--op-right-plus-offset");
      const bias=toolbarCenterBias(left,right,trailingReserve,centered);
      setLength(leftSpacer,"--op-center-bias",bias.left);
      setLength(rightSpacer,"--op-center-bias",bias.right);
      if(centered){
        const rect=row.getBoundingClientRect(),previous=parseFloat(row.style.getPropertyValue("--op-center-correction"))||0;
        const correction=centeredRowCorrection(windowWidth,left,right,rect.left+rect.width/2-previous,rect.width);
        if(previous!==correction)row.style.setProperty("--op-center-correction",correction+"px");
      }else if(!centered)row.style.removeProperty("--op-center-correction");
      // Cap leftward expansion at actual free space next to navigation.
      setLength(row, "--op-left-room", leftSpacer.getBoundingClientRect().width - 4);
      syncLaneScroll();
      refreshOverflowSlider();
      return stillCurrent()||rejectStale();
    } finally {centering=false;}
  }
  // Read actual resting rows only after centering/partition writes.
  // This snapshot is scoped to one synchronous pass, not a cross-frame cache.
  function readToolbarRows(){
    return {nav:navbar?.getBoundingClientRect()??null,row:row.getBoundingClientRect(),
      bookmark:bookmarks&&!bookmarks.collapsed&&!bookmarks.hidden?bookmarks.getBoundingClientRect():null};
  }
  function geometryWriteAllowed(){
    return !dead&&hoverSupported()&&!!toolbarWrapper&&!root.hasAttribute("data-zr-closing")&&!root.hasAttribute("data-zr-center-motion")&&!restingGeometryBlocked();
  }
  function measureToolbarGeometry(force=false,center=true){
    if(!geometryWriteAllowed())return null;
    if(center&&!centerToolbar()&&force)return null;
    if(!geometryWriteAllowed())return null;
    if(!force&&!adaptiveHeightDirty&&toolbarWrapper.style.getPropertyValue("--op-measured-toolbar-height") &&
       window.performance.now()<panelSwitchUntil)return null;
    const revision=contourRevision,rows=readToolbarRows();
    if(!geometryWriteAllowed()||contourRevision!==revision)return null;
    const next=Math.round(Math.max(rows.nav?.height||0,rows.row.height||0)+(rows.bookmark?.height||0))+"px";
    if(![rows.nav?.height??0,rows.row.height,rows.bookmark?.height??0].every(v=>Number.isFinite(v)&&v>=0)||!(parseFloat(next)>0))return null;
    const prior=toolbarWrapper.style.getPropertyValue("--op-measured-toolbar-height");
    const changed=prior!==next;
    if(changed){
      toolbarWrapper.style.setProperty("--op-measured-toolbar-height",next);
      if(toolbarWrapper.style.getPropertyValue("--op-measured-toolbar-height")!==next){
        window.__nocturneTrace?.("geometry.height.rejected",{force},{throttle:500});return null;
      }
      window.__nocturneTrace?.("geometry.height",()=>({old:prior,next,force,overflow:row.hasAttribute("data-op-overflow-row"),phase:root.getAttribute("data-zr-workspace-phase")}),{sample:1800});
    }
    if(!geometryWriteAllowed())return null;
    if(contourRevision!==revision){
      // Do not hand a snapshot predating an invalidation to contour.
      // A changed wrapper still needs the ordinary next-frame boundary.
      scheduleGeometry();
      return {rows:null,changed};
    }
    adaptiveHeightDirty=false;
    return {rows,changed};
  }
  function armGeometry(){
    if(dead||!geometryDirty||geometryFrame||geometryRunning)return;
    const ticket=++geometryTicket;
    geometryFrame=window.requestAnimationFrame(now=>flushGeometry(now,ticket));
  }
  function queueGeometry(bits){
    if(dead)return;
    geometryDirty|=bits;
    armGeometry();
  }
  function scheduleGeometry(){
    if(dead)return;
    contourRevision++;
    queueGeometry(GEOMETRY_CENTER|GEOMETRY_HEIGHT|GEOMETRY_CONTOUR);
  }
  // An immediate native-boundary center has already executed. Keep any
  // previously queued CENTER bit, but do not add a redundant one.
  function scheduleMeasuredGeometry(centered){
    if(!centered){scheduleGeometry();return;}
    if(dead)return;
    contourRevision++;
    queueGeometry(GEOMETRY_HEIGHT|GEOMETRY_CONTOUR);
  }
  function flushGeometry(now,ticket){
    if(ticket!==geometryTicket)return;
    geometryFrame=0;
    if(dead){geometryDirty=0;return;}
    if(geometryRunning)return;
    geometryRunning=true;
    const dirty=geometryDirty;geometryDirty=0;
    try{
      const measured=dirty&GEOMETRY_HEIGHT?measureToolbarGeometry(false,Boolean(dirty&GEOMETRY_CENTER)):null;
      if(dead)return;
      if(measured?.changed)queueGeometry(GEOMETRY_CONTOUR);
      else if(dirty&GEOMETRY_CONTOUR)stepContour(now,measured?.rows??null);
      if(measured&&!dead)refreshIndicator();
    }catch(error){
      window.__nocturneTrace?.("geometry.pass.error",{name:error?.name||"Error",dirty},{throttle:500,flush:true});
      // Do not retry a throwing layout unboundedly; later native
      // invalidation owns retry. In-pass requests remain queued.
    }finally{
      geometryRunning=false;
      armGeometry();
    }
  }
  function cancelGeometry(){
    geometryTicket++;
    if(geometryFrame)window.cancelAnimationFrame(geometryFrame);
    geometryFrame=0;geometryDirty=0;
  }
  // Explicit workspace/startup preflight remains synchronous, except
  // when a native callback reenters an already running write transaction.
  function prepareWorkspaceGeometry(){
    if(dead)return false;
    if(geometryRunning||centering||syncing||contourPainting){
      window.__nocturneTrace?.("geometry.preflight.reentry",{},{throttle:500,flush:true});
      if(syncing)schedule();
      scheduleGeometry();
      return false;
    }
    geometryRunning=true;
    const priorDirty=geometryDirty;
    const workspacePhase=root.getAttribute("data-zr-workspace-phase"),startupPhase=root.getAttribute("data-zr-startup-phase");
    const phaseCurrent=()=>geometryWriteAllowed()&&root.getAttribute("data-zr-workspace-phase")===workspacePhase&&root.getAttribute("data-zr-startup-phase")===startupPhase;
    let accepted=false;
    try{
      const queued=!!geometryFrame;
      // Cancel only work predating this transaction; callbacks can
      // publish fresh invalidations that must survive.
      cancelGeometry();
      window.__nocturneTrace?.("geometry.workspace.prepare",()=>({frame:!!frame,geometryFrame:queued}),{sample:1800});
      if(!phaseCurrent())return false;
      // Native changes can precede observer delivery; a zero RAF id does
      // not prove that the last projected topology is still current.
      if(frame||!sameStripTopology(syncedTopology,readStripTopology()))sync();
      if(!phaseCurrent())return false;
      window.__zenMagneticBookmarksShared?.syncAddressState?.();
      if(!phaseCurrent())return false;
      const measured=measureToolbarGeometry(true);
      if(!phaseCurrent())return false;
      const topology=measured?.rows?captureCenterTopology(row):null;
      const current=()=>phaseCurrent()&&topology?.()===true;
      const painted=!!measured&&!!topology&&paintContour(true,false,measured.changed?null:measured.rows)===true;
      if(painted&&current())refreshIndicator();
      const ready=painted&&current();
      window.__nocturneTrace?.("geometry.preflight.result",{ready,stage:!measured?"height":!topology?"topology":!painted?"contour":!ready?"stale":"ready"},{throttle:500,flush:true});
      accepted=ready&&current();
      if(!accepted&&measured&&(!topology||!topology()))schedule();
      return accepted;
    }finally{
      // A rejected force pass must not swallow preexisting invalidations.
      if(!accepted&&!dead)geometryDirty|=priorDirty;
      geometryRunning=false;
      armGeometry();
    }
  }
  function observeGeometry(centered=false) {
    if (!geometryObserver) return;
    geometryObserver.disconnect();
    // The wrapper's height is animated; observing it would trigger a
    // geometry/mask pass every frame of reveal. Observe real rows only.
    for (const element of [target, navbar, bookmarks, ...target.children]) {
      if(element&&!centerIds.has(element.id))geometryObserver.observe(element);
    }
    scheduleMeasuredGeometry(centered);
  }

  // Native Compact Mode may clear its hover flag during a tab expansion or
  // while entering a bookmarks row. Keep the entire visible toolbar interactive.
  let pointerInside = false;
  let panelTimer=0, panelSwitchTimer=0, panelSwitchUntil=0, panelCloseSince=null;
  let panelLastPointer=null;
  const PANEL_NATIVE_FLAGS=["zen-has-hover","has-popup-menu","zen-compact-mode-active"];
  const PANEL_HOLD_FLAGS=["oneplane-url-hold","oneplane-drag-hold","oneplane-startup-hold","oneplane-hub-hold","oneplane-tab-menu-hold","oneplane-home-hold","oneplane-workspace-hold","oneplane-download-hold"];
  const PANEL_SWITCH_GRACE=180, PANEL_CLOSE_GRACE=100;
  // One visual state for the wrapper, tint and controls. Native flags
  // can disappear/reappear during a native tab selection transaction.
  function panelDecision(open,direct,native,now,switchUntil,closeSince){
    if(direct)return {open:true,wait:0,closeSince:null};
    if(native){
      if(!open && now<switchUntil)return {open:false,wait:switchUntil-now,closeSince:null};
      return {open:true,wait:0,closeSince:null};
    }
    if(!open)return {open:false,wait:0,closeSince:null};
    const since=closeSince??now;
    const until=Math.max(since+PANEL_CLOSE_GRACE,switchUntil);
    return now<until?{open:true,wait:until-now,closeSince:since}:{open:false,wait:0,closeSince:null};
  }
  function reconcilePanel(){
    if(panelTimer)window.clearTimeout(panelTimer);
    panelTimer=0;
    if(!toolbarWrapper)return;
    if(!hoverSupported()){
      toolbarWrapper.removeAttribute("data-op-panel-open");
      panelCloseSince=null;
      return;
    }
    if(!compactLayout()){
      panelCloseSince=null;
      toolbarWrapper.setAttribute("data-op-panel-open","true");
      return;
    }
    const open=toolbarWrapper.hasAttribute("data-op-panel-open");
    const direct=pointerInside||PANEL_HOLD_FLAGS.some(a=>toolbarWrapper.hasAttribute(a));
    const native=PANEL_NATIVE_FLAGS.some(a=>toolbarWrapper.hasAttribute(a));
    const state=panelDecision(open,direct,native,window.performance.now(),panelSwitchUntil,panelCloseSince);
    panelCloseSince=state.closeSince;
    if(open!==state.open){
    typeof window!=="undefined"&&window.__nocturneTrace?.("panel.open.change",()=>({from:open,to:state.open,direct,native,holds:PANEL_HOLD_FLAGS.filter(k=>toolbarWrapper.hasAttribute(k)),pointerInside,wait:state.wait}),{sample:1800});
      toolbarWrapper.toggleAttribute("data-op-panel-open",state.open);
      if(state.open)scheduleContour();
      else clearTabHover(true);
    }
    if(state.wait>0)panelTimer=window.setTimeout(reconcilePanel,Math.ceil(state.wait)+1);
  }
  function onWorkspaceMotion(){
    typeof window!=="undefined"&&window.__nocturneTrace?.("panel.workspace.motion",()=>({phase:root.getAttribute('data-zr-workspace-phase')}),{sample:1800});
    const phase=root.getAttribute("data-zr-workspace-phase"),active=!!phase;
    toolbarWrapper?.toggleAttribute("oneplane-workspace-hold",active);
    if(active){retireBlockedNativeTabDrag("workspace-phase");retireIncomingDrag();cancelHoverTimer();cancelIndicatorReturn();}
    if(phase==="out"||phase==="swap"){islandTextAnimation?.cancel();clearTabHover();}
    if(phase==="in")refreshIslandTitle();
    reconcilePanel();
    if(!active){refreshIslandTitle();scheduleGeometry();scheduleContour();}
  }
  function guardPanelSwitch(){
    if(!hoverSupported())return;
    panelSwitchUntil=window.performance.now()+PANEL_SWITCH_GRACE;
    typeof window!=="undefined"&&window.__nocturneTrace?.("panel.switch.guard",()=>({until:panelSwitchUntil}),{throttle:120,sample:1200});
    if(panelSwitchTimer)window.clearTimeout(panelSwitchTimer);
    panelSwitchTimer=window.setTimeout(()=>{
      panelSwitchTimer=0;
      reconcilePanel();
      scheduleGeometry();
      scheduleContour();
    },PANEL_SWITCH_GRACE+1);
    reconcilePanel();
  }
  let hoverObserver = null;
  let modeObserver = null;
  let addressHoldTimer = 0;
  const ADDRESS_DISMISS_HOLD_MS = 2000;

  function releaseAddressHold() {
    if (addressHoldTimer) window.clearTimeout(addressHoldTimer);
    addressHoldTimer = 0;
    toolbarWrapper?.removeAttribute("oneplane-url-hold");
  }
  function holdToolbarAfterDismiss() {
    if (!hoverSupported() || !toolbarWrapper) return;
    releaseAddressHold();
    toolbarWrapper.setAttribute("oneplane-url-hold", "true");
    addressHoldTimer = window.setTimeout(() => {
      addressHoldTimer = 0;
      toolbarWrapper.removeAttribute("oneplane-url-hold");
      // Normal hover/popup state remains authoritative after the hold.
      if (pointerInside) maintainHover();
    }, ADDRESS_DISMISS_HOLD_MS);
  }
  function onWindowDeactivate() {
    closeNativeTabMenu();
    clearHover();
    releaseAddressHold();
    clearAddressAnimation();
  }
  function compactLayout(){
    return root.getAttribute("zen-compact-mode")==="true";
  }
  function hoverSupported() {
    return !dead && root.hasAttribute("oneplane-active") &&
      !root.hasAttribute("customizing") && root.getAttribute("inDOMFullscreen")!=="true" &&
      root.getAttribute("inFullscreen")!=="true" && !root.hasAttribute("popup-window");
  }
  function clearHover() {
    pointerInside = false;
    toolbarWrapper?.removeAttribute("oneplane-hover-lock");
    reconcilePanel();
  }
  function maintainHover() {
    if (!hoverSupported() || !pointerInside || !toolbarWrapper) return;
    toolbarWrapper.setAttribute("oneplane-hover-lock", "true");
    reconcilePanel();
  }
  function trackPointer(event) {
    if (!hoverSupported() || !toolbarWrapper) { clearHover(); return; }
    if(event.pointerType==="touch")return;
    const point={x:event.clientX,y:event.clientY};
    const moved=!panelLastPointer || Math.hypot(point.x-panelLastPointer.x,point.y-panelLastPointer.y)>=1;
    panelLastPointer=point;
    // Gecko can synthesize hover retargets when a tab changes layout
    // under a stationary pointer. They must not open/close the panel.
    if(!moved && window.performance.now()<panelSwitchUntil)return;
    const rect=toolbarWrapper.getBoundingClientRect();
    const open=toolbarWrapper.hasAttribute("data-op-panel-open");
    const measured=parseFloat(toolbarWrapper.style.getPropertyValue("--op-measured-toolbar-height"))||0;
    const height=open?Math.max(rect.height,measured):Math.max(2,Math.min(rect.height,8));
    const inside=point.x>=rect.left && point.x<rect.right &&
      point.y>=rect.top && point.y<rect.top+height;
    if(!inside){if(pointerInside)clearHover();return;}
    // Ignore synthetic enter events from descendants outside the
    // collapsed native hit strip; actual motion/edge hover can reopen.
    if(!open&&!moved&&!pointerInside)return;
    pointerInside=true;
    maintainHover();
  }
  function leaveWindow(event) {
    if (event.relatedTarget === null) {panelLastPointer=null;clearHover();}
  }
  // Native maximize/restore and monitor DPI changes can resize the
  // toolbar without a new pointer movement. Reconcile the current layout
  // and stale visual state, never synthesize a window move.
  function onWindowGeometryChanged(){
    if(dead)return;
    checkCenterGeometry("window");
    if(dead)return;
    retireChangedDragViewport();
    retireChangedDragChromeFrame("window-resize");
    retireIncomingDrag();
    if(dead)return;
    if(!row.hasAttribute("data-op-dragging")&&hoverTab)clearTabHover();
    if(addressTransition){
      const phase=addressTransition,closing=phase.name==="closing-wave";
      clearAddressAnimation();
      if(closing&&phase.bar===addressBar()&&!addressTransition&&!addressSettling)finishDismissUrl();
    }
    if(cascadeState==="hiding"||cascadeState==="showing"||!nativeInlineOpen(addressBar())&&cascadeState!=="idle"){
      resetTabCascade();
      if(nativeInlineOpen(addressBar())){row.inert=true;settleHidden(++cascadeGeneration);}
    }
    movePageActions();
    centerToolbar();
    onCompactChanged();
    schedule();
    window.requestAnimationFrame(revealSelectedInStrip);
  }
  function onCompactChanged() {
    retireChangedDragChromeFrame("compact-mode");
    retireBlockedNativeTabDrag("compact-phase");
    retireIncomingDrag();
    hub.onMode();
    if(!hoverSupported()){retireIncomingDrag();cancelActiveDrag("unsupported-layout");closeNativeTabMenu();}
    if(hoverSupported()){ensureWindowCaptions();ensureDownloadHost();}
    else restoreWindowCaptions();
    if (!hoverSupported()) { clearHover(); clearTabHover(); releaseAddressHold(); clearAddressAnimation(); addressWasOpen = false; }
    else if (nativeInlineOpen(addressBar()) && !addressTransition && !addressSettling) addressWidths();
    reconcilePanel();
    checkCenterGeometry("mode");
    scheduleGeometry();
  }

  const entries = new Map();
  const splitEntries = new Map();
  function measureSplitGroup(group) {
    const entry = splitEntries.get(group);
    if (!entry || !entry.box.isConnected) return;
    const members = Array.from(entry.box.children).filter(node => node.classList.contains("oneplane-tab"));
    const gap = 3;
    const widths = members.reduce((total, node) => {
      const style = window.getComputedStyle(node);
      // Include both reserved margins; never use the painted scale twice.
      return total + node.offsetWidth + (parseFloat(style.marginInlineStart) || 0) + (parseFloat(style.marginInlineEnd) || 0);
    }, 0);
    const width = 22 + widths + gap * members.length;
    const next = Math.max(0,width).toFixed(2) + "px";
    if (entry.box.style.getPropertyValue("--op-split-measured") !== next)
      entry.box.style.setProperty("--op-split-measured", next);
  }
  const splitMeasureObserver = new ResizeObserver(records => {
    const groups = new Set();
    for (const {target: node} of records) {
      const tab = tabFromItem(node);
      const group = splitGroup(tab);
      if (group) groups.add(group);
    }
    // Explicit pull/mode calls still measure their own group. Do not let
    // observer-driven resting measurements rewrite the other frozen slots.
    if(!restingGeometryBlocked())for (const group of groups) measureSplitGroup(group);
    // Existing observer sees slot size changes missed by the toolbar
    // observer. Validate once per delivery, only while Center owns motion.
    checkCenterGeometry("slots");
  });
  const splitColors = new WeakMap();
  const splitPalette = ["#8eafff", "#74d6b6", "#d6a5ff", "#efba78", "#ed8fa9"];
  let nextSplitColor = 0;
  let frame = 0;
  let dead = false;
  // Only OnePlane's chrome UI accepts this custom flavor. Do not advertise
  // Firefox's native tab drag flavor without its private drag bookkeeping.
  const DRAG_TYPE = "application/x-oneplane-native-tab";
  const DRAG_CONTROLLER = "__oneplaneTabDrag";
  let draggedTab = null;
  let draggedGroup = null;
  let dragNode = null, dragImageMode = null, dragGrabRatio = .5, dragGrabY = .5;
  const PULL_DISTANCE = 30, BUNNY_EDGE_PAD = 3, REORDER_BUFFER = 8, BUNNY_DETACH_THRESHOLD=.96;
  // Visual extraction belongs to the original card, not the native drop panel.
  function bunnyPullProgress(y,edge,distance=PULL_DISTANCE){
    return Math.max(0,Math.min(1,(y-edge)/distance));
  }
  let dragGhost = null, dragGhostBody = null, dragPull = 0, dragEdge = 0, dragWidth = 0;
  let dragLastPoint = null, dragReturnPoint = null;
  let dragBunnyAnchor=null, dragBunnyFull=null, dragBunnyLayout=null, dragInsertAnimation=null, dragInsertNode=null;
  let dragInsertPending=false; // visual tail only; native session is already finished
  let groupPullLayout = null;
  let pointerSearch = null, dragSearch = null, restoreSearchTimer = 0;
  const blankDragImage = html("canvas");
  blankDragImage.width = blankDragImage.height = 1;
  let dragHandled = false,dragDetachedOnce=false;
  let dragStartPoint = null,dragViewport=null;
  function dragViewportState(){
    return [window.innerWidth,window.innerHeight,window.devicePixelRatio,window.windowState];
  }
  // Do not reinterpret a native pointer in a new chrome coordinate frame.
  // Cancel only the exact local tab gesture/visual tail, never synthesize
  // native drop or detach. Moving the window without a resize is allowed.
  function retireChangedDragViewport(){
    if(!dragViewport)return false;
    const next=dragViewportState();
    if(dragViewport.every((value,i)=>Object.is(value,next[i])))return false;
    window.__nocturneTrace?.("drag.viewport.changed",{width:next[0],height:next[1],scale:next[2]},{throttle:500,flush:true});
    cancelActiveDrag("viewport-changed");
    return true;
  }
  // Shared native tab input admission, distinct from visual/OS drag ownership.
  function dragPhaseInputAllowed(){
    const bar=addressBar();
    return hoverSupported()&&cascadeState==="idle"&&!root.hasAttribute("data-zr-closing")&&
      !root.hasAttribute("data-zr-center-motion")&&!root.hasAttribute("data-zr-workspace-phase")&&
      !root.hasAttribute("data-zr-startup-phase")&&!shield.hasAttribute("data-pressed")&&
      !bar?.hasAttribute("focused")&&!bar?.hasAttribute("open");
  }
  function retireBlockedNativeTabDrag(reason="phase-conflict"){
    if(dragLifecycle.current()?.kind!=="tab"||dragPhaseInputAllowed())return false;
    cancelActiveDrag(reason);
    return true;
  }
  // Read native edge-control X geometry, excluding moving tab lanes.
  // No DOM measurements on ordinary dragover or animation frames.
  let dragChromeFrame=null;
  function readDragChromeFrame(){
    try{
      if(dead||!target?.isConnected)return null;
      const nodes=Array.from(target.children).filter(n=>n!==row&&!centerIds.has(n.id)&&n.localName!=="toolbarspring");
      const box=target.getBoundingClientRect(),numbers=[box.left,box.right];
      for(const node of nodes){
        const rect=node.getBoundingClientRect();
        numbers.push(rect.left,rect.right);
      }
      return numbers.every(Number.isFinite)&&box.width>0?{nodes,numbers}:null;
    }catch{return null;}
  }
  function sameDragChromeFrame(a,b){
    return !!a&&!!b&&a.nodes.length===b.nodes.length&&a.numbers.length===b.numbers.length&&
      a.nodes.every((node,i)=>node===b.nodes[i])&&
      a.numbers.every((value,i)=>Math.abs(value-b.numbers[i])<=.75);
  }
  function retireChangedDragChromeFrame(stage="drop"){
    if(!dragChromeFrame)return false;
    if(sameDragChromeFrame(dragChromeFrame,readDragChromeFrame()))return false;
    window.__nocturneTrace?.("drag.chrome-frame.changed",{stage},{throttle:500,flush:true});
    cancelActiveDrag("chrome-frame-changed");
    return true;
  }
  let dropMarker = null;
  let dragRevealTimer = 0;
  let liveDragTarget = null;
  let dragCommitFrame = 0;
  const dragShifted = new Set();
  const splitZone = html("div");
  splitZone.id = "oneplane-split-drop";
  splitZone.setAttribute("aria-hidden", "true");
  const splitPreview = html("div", "oneplane-split-preview");
  splitZone.append(splitPreview);

  function privateState(win) {
    try {
      return ChromeUtils.importESModule("resource://gre/modules/PrivateBrowsingUtils.sys.mjs")
        .PrivateBrowsingUtils.isWindowPrivate(win);
    } catch { return null; }
  }
  function tabOwner(tab) { return tab?.ownerDocument?.defaultView || null; }
  function validNativeTab(tab) {
    const owner = tabOwner(tab);
    return Boolean(owner?.gBrowser && !owner.closed && !tab.closing &&
      Array.from(owner.gBrowser.tabs).includes(tab));
  }
  function readDraggedTab(event) {
    // Synthetic or untrusted chrome drag events cannot command native tabs.
    if(!event?.isTrusted)return null;
    const dt = event.dataTransfer;
    if (!dt || !Array.from(dt.types || []).includes(DRAG_TYPE)) return null;
    try {
      let tab = null;
      try { tab = dt.mozGetDataAt(DRAG_TYPE, 0); } catch {}
      // Gecko may expose the custom flavor but protect the payload until
      // drop. A source controller is only an eligibility witness, not an
      // OS DataTransfer identity. Never adopt the first of two candidates.
      if (!tab && event.type === "dragover") {
        const windows=Services.wm.getEnumerator("navigator:browser");
        let eligible=null,eligibleController=null,ambiguous=false;
        while(windows.hasMoreElements()){
          const win=windows.getNext();
          try{
            if(!win||win.closed)continue;
            const controller=win[DRAG_CONTROLLER];
            const candidate=controller?.source?.(),token=controller?.sourceToken?.();
            if(!candidate||!Number.isSafeInteger(token)||token<=0||
              !validNativeTab(candidate)||tabOwner(candidate)?.[DRAG_CONTROLLER]!==controller)continue;
            if(eligible&&eligibleController!==controller){ambiguous=true;break;}
            eligible=candidate;eligibleController=controller;
          }catch{continue;}
        }
        if(ambiguous){
          window.__nocturneTrace?.("drag.source.resolve",{reason:"ambiguous"},{throttle:750});
          return null;
        }
        tab=eligible;
      }
      const owner = tabOwner(tab),controller=owner?.[DRAG_CONTROLLER];
      const token=controller?.sourceToken?.();
      if (!validNativeTab(tab) || controller?.source?.() !== tab||
          !Number.isSafeInteger(token)||token<=0)return null;
      // A delivered cross-window drop must still match the original native
      // source topology. Dragover stays on native event/observer admission.
      if(event.type==="drop"&&controller?.topologyCurrent?.()===false){
        controller?.retireTopology?.();return null;
      }
      // Moving the native group as a unit is supported within one window.
      // Individual members can still be adopted by another window.
      if (owner !== window && owner?.[DRAG_CONTROLLER]?.group()) return null;
      const ours = privateState(window), theirs = privateState(owner);
      if (owner !== window && (ours === null || theirs === null || ours !== theirs)) return null;
      return tab;
    } catch { return null; }
  }
  function splitGroup(tab) {
    const group = tab?.group;
    return group?.hasAttribute("split-view-group") ? group : null;
  }
  function isSplit(tab, group=undefined) { return Boolean(tab?.splitView || tab?.hasAttribute("split-view") || (group===undefined?splitGroup(tab):group)); }
  function unsplitTab(tab) {
    const owner = tabOwner(tab);
    if (!isSplit(tab)) return true;
    const splitter = owner?.gZenViewSplitter;
    if (typeof splitter?.removeTabFromGroup !== "function") return false;
    splitter.removeTabFromGroup(tab, undefined, { forUnsplit: true });
    return !isSplit(tab);
  }
  // Read the native projected order after an actual Zen command, not the
  // mirrored DOM nor an assumed void moveTabBefore/After return value.
  function nativeStripPlacement(element,dest){
    if(!element||!dest?.native)return false;
    const native=readStripTopology().tabs,order=native.map(x=>x.tab);
    const members=entity=>entity?.hasAttribute?.("split-view-group")?
      native.filter(x=>x.group===entity).map(x=>x.tab):
      order.includes(entity)?[entity]:[];
    const moved=members(element),target=members(dest.native);
    if(!moved.length||!target.length||moved.some(t=>target.includes(t)))return false;
    const range=list=>{
      const indices=list.map(t=>order.indexOf(t));
      if(indices.some(i=>i<0))return null;
      const start=Math.min(...indices),end=Math.max(...indices);
      return end-start+1===list.length?{start,end}:null;
    };
    const from=range(moved),to=range(target);
    return !!from&&!!to&&(dest.before?from.end+1===to.start:to.end+1===from.start);
  }
  // A zero-card projection is not proof of a zero-tab native workspace.
  // Only the active Zen-owned regular-tabs container can accept this drop.
  function emptyStripDestination(event,tab){
    try{
    if(!event?.isTrusted||tabOwner(tab)===window||!validNativeTab(tab)||tab.pinned||tab.group||
       tab.hidden||tab.hasAttribute("zen-empty-tab")||tab.hasAttribute("zen-essential")||
       tab.hasAttribute("zen-glance-tab")||tab.hasAttribute("split-view")||tab.splitView)return null;
    if(stripNodes().length||readStripTopology().tabs.length||row.hasAttribute("data-op-home-open"))return null;
    const x=event?.clientX,y=event?.clientY;
    if(!Number.isFinite(x)||!Number.isFinite(y)||event.target?.closest?.(
      ".oneplane-title-island, .oneplane-overflow-slider, .oneplane-split-group, .oneplane-tab"))return null;
    const hit=[list,plus].some(node=>{
      if(!node?.isConnected||node.hidden)return false;
      const r=node.getBoundingClientRect();
      return r.width>=6&&r.height>=6&&x>=r.left&&x<r.right&&y>=r.top&&y<r.bottom;
    });
    if(!hit)return null;
    const native=window.gZenWorkspaces,spaceId=native?.activeWorkspace;
    if(!native?.workspaceEnabled||typeof spaceId!=="string"||!spaceId||
       typeof native.getWorkspaceFromId!=="function"||
       typeof native.workspaceElement!=="function"||
       typeof native.moveTabToWorkspace!=="function")return null;
    const space=native.getWorkspaceFromId(spaceId),element=native.workspaceElement(spaceId);
    const container=element?.tabsContainer;
    if(space?.uuid!==spaceId||!container?.isConnected||
       native.activeWorkspaceStrip!==container)return null;
    // Hidden native tabs and groups in the active container are not empty.
    if(Array.from(container.querySelectorAll(".tabbrowser-tab")).some(node=>
       node.closing||!node.hasAttribute("zen-empty-tab")||node.group))return null;
    if(container.querySelector(".tab-group, tab-group, [split-view-group]"))return null;
    if(native.activeWorkspace!==spaceId)return null;
    return {empty:true,spaceId,container,manager:native};
    }catch{return null;}
  }
  function validEmptyStripDestination(dest,event,tab){
    if(!dest?.empty)return false;
    const current=emptyStripDestination(event,tab);
    return !!current&&current.spaceId===dest.spaceId&&current.container===dest.container&&
      current.manager===dest.manager;
  }
  function nativeEmptyAdoptionOutcome(adopted,dest){
    if(!adopted)return "rejected";
    if(!validNativeTab(adopted)||tabOwner(adopted)!==window)return "unverified";
    const native=window.gZenWorkspaces;
    if(native!==dest.manager||native.activeWorkspace!==dest.spaceId||
       native.activeWorkspaceStrip!==dest.container||
       adopted.getAttribute("zen-workspace-id")!==dest.spaceId||
       !dest.container.contains(adopted))return "transferred-off-target";
    return "confirmed";
  }
  function nativeAdoptionOutcome(adopted,dest){
    if(!adopted)return "rejected";
    if(!validNativeTab(adopted)||tabOwner(adopted)!==window)return "unverified";
    return nativeStripPlacement(adopted,dest)?"confirmed":"transferred-off-target";
  }
  function tabFromItem(item) {
    for (const [tab, entry] of entries) if (entry.item === item) return tab;
    return null;
  }
  function groupMembers(group) {
    return Array.from(group?.tabs || []).filter(validNativeTab);
  }
  function dropTarget(event) {
    if(useLaneDrop()){
      const tab=readDraggedTab(event),owner=tabOwner(tab),group=owner?.[DRAG_CONTROLLER]?.group();
      const source=owner===window?(group?splitEntries.get(group)?.box:entries.get(tab)?.item):null;
      return laneDropTarget(laneAtPoint({x:event.clientX,y:event.clientY}),event.clientX,isStripNode(source)?source:null);
    }
    const children = stripNodes();
    if (!children.length) return null;
    let element = event.target?.closest?.(".oneplane-split-group, .oneplane-tab");
    // The entire group is atomic for strip drops, including its internal tabs.
    element = element?.closest?.(".oneplane-split-group") || element;
    if (!isStripNode(element)) {
      element = children.find(child => event.clientX < child.getBoundingClientRect().right) || children.at(-1);
    }
    const box = element.getBoundingClientRect();
    const group = [...splitEntries].find(([, entry]) => entry.box === element)?.[0];
    const tab = group ? null : tabFromItem(element);
    const before = event.clientX < (box.left + box.right) / 2;
    return { element, native: group || tab, group, tab, before };
  }
  // Keep native drag-and-drop alive: do not move/remove the source DOM node
  // until drop. Visually reorder its slot and animate the other slots instead.
  function unshiftedRect(node) {
    const rect = node.getBoundingClientRect();
    let x = 0;
    try {
      const transform = window.getComputedStyle(node).transform;
      if (transform && transform !== "none") x = new DOMMatrixReadOnly(transform).m41;
    } catch {}
    // CSS individual scale can be animated during reinsertion; do not use
    // the painted width as the slot width or the reorder thresholds drift.
    const width = node.offsetWidth;
    const center = (rect.left + rect.right)/2 - x;
    return { left: center-width/2, right: center+width/2, width };
  }
  function dragSlotIndex(slots, x) {
    const midpoint = slot => (slot.rect.left + slot.rect.right) / 2;
    // Keep the current insertion boundary until the pointer crosses an
    // additional 8 CSS pixels. Do not chase the animated neighbors.
    const old = slots.findIndex(slot => nativeSlot(slot.node).native === liveDragTarget?.native);
    if (old >= 0) {
      let i = old + (liveDragTarget.before ? 0 : 1);
      while (i < slots.length && x > midpoint(slots[i]) + REORDER_BUFFER) i++;
      while (i > 0 && x < midpoint(slots[i - 1]) - REORDER_BUFFER) i--;
      return i;
    }
    return slots.findIndex(slot => x < midpoint(slot));
  }
  function nativeSlot(node) {
    const group = [...splitEntries].find(([, entry]) => entry.box === node)?.[0];
    const tab = group ? null : tabFromItem(node);
    return { element: node, native: group || tab, group, tab };
  }
  function clearLiveDrag() {
    clearLaneDrag();
    liveDragTarget = null;
    for (const node of dragShifted) {
      node.style.removeProperty("--op-drag-x");
      node.removeAttribute("data-op-drag-follow");
    }
    dragShifted.clear();
    const active=row.hasAttribute("data-op-live-drag")||row.hasAttribute("data-op-island-incoming")||
      row.hasAttribute("data-op-empty-incoming");
    row.removeAttribute("data-op-live-drag");
    row.removeAttribute("data-op-island-incoming");
    row.removeAttribute("data-op-empty-incoming");
    row.style.removeProperty("--op-drag-incoming");
    if(active&&!dead){schedule();scheduleGeometry();}
  }
  function finishStripCommit() {
    // The visual slots already occupy their destination. Apply the native
    // order and remove transforms together, without a second transition.
    clearLiveDrag();
    if (frame) window.cancelAnimationFrame(frame);
    frame = 0;
    sync();
    if (dragCommitFrame) window.cancelAnimationFrame(dragCommitFrame);
    dragCommitFrame = window.requestAnimationFrame(() => {
      dragCommitFrame = 0;
      row.removeAttribute("data-op-drag-commit");
    });
  }
  function shiftDragNode(node, x, follow = false) {
    node.style.setProperty("--op-drag-x", x.toFixed(2) + "px");
    node.toggleAttribute("data-op-drag-follow", follow);
    dragShifted.add(node);
  }
  function toolbarContainsPoint(x, y) {
    const rect = toolbarWrapper?.getBoundingClientRect();
    return Boolean(rect && x >= rect.left && x < rect.right &&
      y >= rect.top && y <= Math.max(rect.top + 8, rect.bottom));
  }
  function makeDragGhost() {
    if (dragGhost || !dragNode) return;
    dragGhost = html("div", "oneplane-bunny-ghost");
    dragGhost.setAttribute("aria-hidden", "true");
    dragGhostBody = html("div", "oneplane-bunny-card");
    const members = draggedGroup ? Array.from(dragNode.querySelectorAll(".oneplane-tab")) : [dragNode];
    if (draggedGroup) {
      // Reproduce the actual compact Split View surface, its accent,
      // six-dot handle, member cards and selected member. No interactive
      // elements or IDs from the original toolbar are copied.
      dragGhostBody.setAttribute("data-op-bunny-group","true");
      dragGhostBody.toggleAttribute("data-op-bunny-active",dragNode.hasAttribute("data-op-split-active"));
      dragGhostBody.style.setProperty("--op-bunny-accent",
        dragNode.style.getPropertyValue("--op-split-color") || "#8eafff");
      const style = window.getComputedStyle(row);
      dragGhostBody.style.setProperty("--op-bunny-tab-width",style.getPropertyValue("--op-tab").trim() || "36px");
      dragGhostBody.style.setProperty("--op-bunny-height",style.getPropertyValue("--op-height").trim() || "34px");
      const handle = html("span","oneplane-bunny-handle");
      for(let i=0;i<6;i++) handle.append(html("i"));
      dragGhostBody.append(handle);
    }
    for (const member of members) {
      const icon = html("span", "oneplane-bunny-icon");
      icon.toggleAttribute("data-op-bunny-unloaded",member.hasAttribute("data-unloaded") && !member.hasAttribute("data-selected"));
      const original = member.querySelector(".oneplane-tab-icon img:not([hidden])");
      if (original?.getAttribute("src")) {
        const img = html("img");
        img.src = original.getAttribute("src"); img.alt = ""; img.draggable = false;
        icon.append(img);
      } else icon.textContent = "•";
      if (draggedGroup) {
        const card = html("span","oneplane-bunny-member");
        card.toggleAttribute("data-op-bunny-selected",member.hasAttribute("data-selected"));
        card.append(icon); dragGhostBody.append(card);
      } else dragGhostBody.append(icon);
    }
    dragGhost.append(dragGhostBody);
    root.append(dragGhost);
    typeof window!=="undefined"&&window.__nocturneTrace?.("drag.ghost.create",()=>({group:!!draggedGroup,members:members.length}),{sample:1800});
  }
  function positionGhost(x, y) {
    if (!dragGhost) return;
    dragGhost.style.left = x + "px";
    dragGhost.style.top = y + "px";
  }
  function hideGhost() {
    if (dragGhost) dragGhost.hidden = true;
    typeof window!=="undefined"&&window.__nocturneTrace?.("drag.ghost.hide",()=>({exists:!!dragGhost,mode:dragImageMode}),{throttle:100,sample:1200});
    if (dragGhostBody) dragGhostBody.style.removeProperty("transform");
  }
  function showGhost(event) {
    makeDragGhost();
    if(!dragGhost)return;
    positionGhost(event.clientX,event.clientY);
    dragGhostBody.style.removeProperty("transform");
    dragGhost.hidden=false;
    window.__nocturneTrace?.("drag.ghost.show",{mode:dragImageMode},{sample:800});
  }
  function captureGroupPull(event) {
    if (groupPullLayout || !draggedGroup || !isStripNode(dragNode)) return;
    const nodes = stripNodes();
    const order = nodes.filter(node=>node!==dragNode);
    const target = liveDragTarget?.element;
    const targetIndex = order.indexOf(target);
    const index = targetIndex < 0 ? nodes.indexOf(dragNode) :
      targetIndex + (liveDragTarget.before ? 0 : 1);
    order.splice(Math.max(0,index),0,dragNode);
    const bounds = dragNode.getBoundingClientRect();
    groupPullLayout = {
      order, index:order.indexOf(dragNode),
      center:(bounds.left+bounds.right)/2,
      centerY:(bounds.top+bounds.bottom)/2,
      pointerX:event.clientX,
      gap:parseFloat(window.getComputedStyle(list).columnGap)||3
    };
  }
  function hasCenteredIsland(){
    return row.hasAttribute("data-op-show-island") && !row.hasAttribute("data-op-island-tight") &&
      leftLane.parentElement===list;
  }
  function lanePositions(widths,boundary,leftEdge,rightEdge,gap){
    const positions=[];
    const leftWidth=widths.slice(0,boundary).reduce((s,w)=>s+w,0)+Math.max(0,boundary-1)*gap;
    let x=leftEdge-leftWidth;
    for(let i=0;i<widths.length;i++){
      if(i===boundary)x=rightEdge;
      positions.push(x);x+=widths[i]+gap;
    }
    return positions;
  }
  function islandSlotPositions(widths,gap){
    if(!hasCenteredIsland()) return null;
    const boundary=Math.min(leftLane.children.length,widths.length);
    const l=leftLane.getBoundingClientRect(),r=rightLane.getBoundingClientRect();
    return {boundary,positions:lanePositions(widths,boundary,l.right-3,r.left+3,gap)};
  }
  function previewGroupPull(event) {
    const state = groupPullLayout;
    if (!state || !dragNode) return false;
    const {order,index,gap} = state;
    // Freeze the visual reorder slot, rather than reverting to the
    // original DOM position while the group shrinks.
    let center = state.center + (event.clientX-state.pointerX)*.4;
    const source = unshiftedRect(dragNode);
    const rects=order.map(unshiftedRect);
    const lanes=islandSlotPositions(rects.map(r=>r.width),gap);
    if(lanes){
      // Keep the whole group and its neighbours on their respective
      // sides of the fixed title. Preserve the captured center where
      // possible, without pushing the near edge into the island.
      const anchored=lanes.positions[index]+source.width/2;
      let delta=center-anchored;
      delta=index<lanes.boundary?Math.min(0,delta):Math.max(0,delta);
      const laneWidth=(index<lanes.boundary?leftLane:rightLane).getBoundingClientRect().width;
      delta=Math.max(-laneWidth/2,Math.min(laneWidth/2,delta));
      for(let i=0;i<order.length;i++){
        if((i<lanes.boundary)===(index<lanes.boundary))lanes.positions[i]+=delta;
      }
      center=lanes.positions[index]+source.width/2;
    }
    let left = center-source.width/2, right = center+source.width/2;
    row.setAttribute("data-op-group-pull","true");
    shiftDragNode(dragNode,left-source.left,true);
    // Shrink the full-size group artwork as a single object, not the
    // individual flex children. The invisible source only reserves space.
    makeDragGhost();
    if (dragGhost && dragGhostBody) {
      const sx = Math.max(.05,1-.95*dragPull);
      const sy = Math.max(.12,1.055-.91*dragPull);
      positionGhost(center,state.centerY+17*dragPull);
      dragGhostBody.style.transform = "scale("+sx+","+sy+")";
      dragGhost.hidden = false;
    }
    if(lanes){
      for(let i=0;i<order.length;i++) if(i!==index)
        shiftDragNode(order[i],lanes.positions[i]-rects[i].left);
      shiftDragNode(plus,0);
    }else{
      for(let i=index-1;i>=0;i--){
        const node=order[i], rect=rects[i];
        left-=gap+rect.width;
        shiftDragNode(node,left-rect.left);
      }
      for(let i=index+1;i<order.length;i++){
        const node=order[i], rect=rects[i];
        right+=gap;
        shiftDragNode(node,right-rect.left);
        right+=rect.width;
      }
      shiftDragNode(plus,right+gap-unshiftedRect(plus).left);
    }
    refreshIndicator();
    return true;
  }
  function clearGroupPull() {
    if (!groupPullLayout && !row.hasAttribute("data-op-group-pull")) return;
    groupPullLayout = null;
    row.removeAttribute("data-op-group-pull");
    hideGhost();
  }
  function setPull(progress,slot=1-.95*progress) {
    if (!dragNode) return;
    dragPull = progress;
    typeof window!=="undefined"&&window.__nocturneTrace?.("drag.pull.paint",()=>({progress,mode:dragImageMode,width:dragWidth,group:!!draggedGroup}),{throttle:100,sample:1200});
    dragNode.toggleAttribute("data-op-pulling", progress > 0);
    dragNode.style.setProperty("--op-pull-width", Math.max(0,dragWidth*slot).toFixed(2)+"px");
    dragNode.style.setProperty("--op-pull-y", (17*progress).toFixed(2)+"px");
    dragNode.style.setProperty("--op-pull-scale-y", String(Math.max(.12,1.055-.91*progress)));
    dragNode.style.setProperty("--op-pull-scale-x", String(Math.max(.08,1.055-.98*progress)));
    dragNode.style.setProperty("--op-pull-gap", (-3*progress).toFixed(2)+"px");
    if (draggedTab && !draggedGroup) measureSplitGroup(splitGroup(draggedTab));
    refreshIndicator();
  }
  function updateNativeDragImage(image, x, y, event) {
    try {
      const session = Cc["@mozilla.org/widget/dragservice;1"]
        .getService(Ci.nsIDragService).getCurrentSession(window);
      if (session?.updateDragImage) session.updateDragImage(image,x,y);
      else if (event?.dataTransfer?.updateDragImage) event.dataTransfer.updateDragImage(image,x,y);
      else return false;
      return true;
    } catch (error) { console.error("[OnePlane] Drag image transition:",nocturneErrorClass(error)); return false; }
  }
  function dragPaintedBox(){
    const n=dragGhost&&!dragGhost.hidden&&dragGhostBody?dragGhostBody:dragNode;
    if(!n)return null;
    const r=n.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height};
  }
  // Motion Lab / magnet: one anchored lane, no layout reflow while the
  // pointer owns the card. The slot and ghost share the same spatial curve.
  const bunnyClamp=v=>Math.max(0,Math.min(1,v));
  const bunnySmooth=v=>{v=bunnyClamp(v);return v*v*(3-2*v);};
  const bunnyMix=(a,b,t)=>a+(b-a)*t;
  function bunnySlot(progress,anchor,side,gap){
    const ratio=1-.96*bunnySmooth(progress),loss=(anchor.width+gap)*(1-ratio);
    return {ratio,loss,width:anchor.width*ratio,x:anchor.x+(side==="L"?1:-1)*anchor.width*(1-ratio)/2};
  }
  function bunnyNeighborShift(progress,anchor,side,gap,outer){
    return outer?(side==="L"?1:-1)*bunnySlot(progress,anchor,side,gap).loss:0;
  }
  function bunnyPose(progress,anchor,point,full,side="R",gap=3,edge=anchor.y+anchor.height/2+BUNNY_EDGE_PAD){
    const p=bunnyClamp(progress),neck=.62,slot=bunnySlot(p,anchor,side,gap);
    const compression=p<=neck?bunnySmooth(p/neck):bunnySmooth((1-p)/(1-neck)),scale=1-.82*compression;
    const h=bunnyMix(anchor.height,full.height,p)*scale;
    const y=bunnyMix(anchor.y,Math.max(edge+PULL_DISTANCE*BUNNY_DETACH_THRESHOLD,point.y),bunnySmooth(p));
    const free=bunnySmooth((y-h/2-(anchor.y+anchor.height/2))/7);
    const nominal=bunnyMix(anchor.width,full.width,p)*scale;
    const width=Math.max(1,Math.min(nominal,bunnyMix(slot.width,nominal,free)));
    return {x:bunnyMix(slot.x,point.x,free),y,width,height:h,slot:slot.ratio,free};
  }
  function bunnyProgress(p){return bunnyClamp(p/BUNNY_DETACH_THRESHOLD);}
  function bunnyRect(n){
    const r=n.getBoundingClientRect();
    return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height};
  }
  function captureBunnyAnchor(){
    if(dragBunnyLayout)return true;
    if(!dragNode)return false;
    clearGroupPull();clearLiveDrag();setPull(0);
    row.setAttribute("data-op-magnetic-pull","true");
    const r=bunnyRect(dragNode);
    if(r.width<1||r.height<1){row.removeAttribute("data-op-magnetic-pull");return false;}
    const anchor={x:r.left+r.width/2,y:r.top+r.height/2,width:r.width,height:r.height};
    const lane=dragNode.parentElement,topLevel=isStripNode(dragNode);
    const home=row.querySelector(".oneplane-title-island"),hr=home?bunnyRect(home):null;
    const center=hr?.width>1?(hr.left+hr.right)/2:row.getBoundingClientRect().left+row.getBoundingClientRect().width/2;
    const side=lane===leftLane?"L":lane===rightLane?"R":anchor.x<center?"L":"R";
    const gap=parseFloat(window.getComputedStyle(lane).columnGap)||3;
    const cards=stripNodes().filter(node=>node!==dragNode&&!node.contains(dragNode));
    if(!topLevel&&lane)cards.push(...Array.from(lane.children).filter(node=>node!==dragNode&&node.matches(".oneplane-tab")));
    if(home&&hr?.width>1&&hr.height>1)cards.push(home);
    if(plus&&!cards.includes(plus))cards.push(plus);
    const obstacles=[];
    for(const node of cards){
      const box=bunnyRect(node);
      if(box.width<1||box.height<1)continue;
      const parent=node.parentElement,viewport=parent&&[leftLane,rightLane,bottomLane].includes(parent)?bunnyRect(parent):null;
      const sameRow=Math.abs((box.top+box.bottom)/2-anchor.y)<Math.max(5,anchor.height/2);
      const outer=topLevel&&sameRow&&(node.parentElement===lane||node===plus)&&
        (side==="L"?box.right<=r.left+.5:box.left>=r.right-.5);
      obstacles.push({node,box,outer,viewport});
    }
    makeDragGhost();
    if(!dragGhost||!dragGhostBody){row.removeAttribute("data-op-magnetic-pull");return false;}
    dragGhost.hidden=false;dragGhostBody.style.removeProperty("transform");
    const full=dragGhostBody.getBoundingClientRect();hideGhost();
    if(!full.width||!full.height){row.removeAttribute("data-op-magnetic-pull");return false;}
    dragBunnyAnchor=anchor;dragBunnyFull={width:full.width,height:full.height};
    dragBunnyLayout={side,gap,obstacles,point:null,progress:0};
    dragNode.setAttribute("data-op-magnetic-source","true");
    dragNode.setAttribute("data-op-lane-ghost","true");
    return true;
  }
  // Disjoint rectangular holes in the ghost's local coordinates. Merge
  // overlapping obstacles per horizontal band so evenodd cannot reopen
  // a hole where two chrome surfaces happen to intersect.
  function bunnyClip(pose,full,boxes){
    const pad=20,left=pose.x-full.width/2,top=pose.y-full.height/2;
    const bounds={left:pose.x-pose.width/2-pad,right:pose.x+pose.width/2+pad,top:pose.y-pose.height/2-pad,bottom:pose.y+pose.height/2+pad};
    const hits=boxes.map(b=>({left:Math.max(b.left,bounds.left),right:Math.min(b.right,bounds.right),top:Math.max(b.top,bounds.top),bottom:Math.min(b.bottom,bounds.bottom)})).filter(b=>b.right>b.left&&b.bottom>b.top);
    if(!hits.length)return "";
    const ys=[...new Set(hits.flatMap(b=>[b.top,b.bottom]))].sort((a,b)=>a-b);
    const rect=(l,t,r,b)=>"M "+(l-left)+" "+(t-top)+" H "+(r-left)+" V "+(b-top)+" H "+(l-left)+" Z";
    const holes=[];
    for(let i=0;i<ys.length-1;i++){
      const t=ys[i],b=ys[i+1],intervals=hits.filter(h=>h.top<b&&h.bottom>t).map(h=>[h.left,h.right]).sort((a,b)=>a[0]-b[0]);
      let cur=null;
      for(const x of intervals){if(cur&&x[0]<=cur[1])cur[1]=Math.max(cur[1],x[1]);else{if(cur)holes.push(rect(cur[0],t,cur[1],b));cur=x.slice();}}
      if(cur)holes.push(rect(cur[0],t,cur[1],b));
    }
    return 'path(evenodd, "'+rect(bounds.left-1,bounds.top-1,bounds.right+1,bounds.bottom+1)+" "+holes.join(" ")+'")';
  }
  function paintBunnyAt(t,point,lateral=false){
    const state=dragBunnyLayout,anchor=dragBunnyAnchor,full=dragBunnyFull;
    if(!state||!dragNode||!dragGhost||!dragGhostBody)return false;
    const pose=bunnyPose(t,anchor,point,full,state.side,state.gap,dragEdge);
    if(lateral&&t===1){pose.x=point.x;pose.y=point.y;pose.width=full.width;pose.height=full.height;}
    const boxes=[];
    for(const {node,box,outer,viewport} of state.obstacles){
      const dx=bunnyNeighborShift(t,anchor,state.side,state.gap,outer);
      if(outer)node.style.setProperty("--op-bunny-x",dx.toFixed(3)+"px");
      const left=viewport?Math.max(viewport.left,box.left+dx):box.left+dx;
      const right=viewport?Math.min(viewport.right,box.right+dx):box.right+dx;
      if(right>left)boxes.push({...box,left,right});
    }
    state.progress=t;state.point={...point};state.pose=pose;dragPull=t;
    dragNode.setAttribute("data-op-lane-ghost","true");
    dragGhost.hidden=false;positionGhost(pose.x,pose.y);
    dragGhostBody.style.transform="scale("+pose.width/full.width+","+pose.height/full.height+")";
    const clip=bunnyClip(pose,full,boxes);
    if(clip)dragGhost.style.setProperty("clip-path",clip);else dragGhost.style.removeProperty("clip-path");
    refreshIndicator();
    window.__nocturneTrace?.("drag.bunny.pose",{p:t,slot:pose.slot,width:pose.width,height:pose.height,side:state.side,masked:!!clip,mode:dragImageMode},{throttle:85,sample:800});
    return true;
  }
  function paintBunnyPull(event,p,lateral=false){
    if(!captureBunnyAnchor())return false;
    return paintBunnyAt(lateral?1:bunnyProgress(p),{x:event.clientX,y:event.clientY},lateral);
  }
  function clearBunnyPull(){
    for(const o of dragBunnyLayout?.obstacles||[])if(o.outer)o.node.style.removeProperty("--op-bunny-x");
    row.removeAttribute("data-op-magnetic-pull");
    dragNode?.removeAttribute("data-op-magnetic-source");
    dragNode?.removeAttribute("data-op-lane-ghost");
    dragGhost?.style.removeProperty("clip-path");setPull(0);hideGhost();
    dragBunnyAnchor=null;dragBunnyFull=null;dragBunnyLayout=null;
  }
  function cancelInsertion(){
    const animation=dragInsertAnimation,node=dragInsertNode;
    dragInsertAnimation=null;dragInsertNode=null;
    if(animation)animation.cancel();
    node?.removeAttribute("data-op-reinsert");
  }
  function finishInsertionAfterDrop(){
    if(!dragInsertAnimation)return false;
    dragInsertPending=true;holdToolbarForReturn();
    dragInsertAnimation.play();return true;
  }
  function prepareBunnyDrop(event){
    // Remember the actual accepted pointer for the normal hover handoff.
    // This also covers a fully inserted card with no remaining animation.
    dragReturnPoint={x:event.clientX,y:event.clientY};
    const state=dragBunnyLayout;
    if(!dragNode||!state||dragImageMode==="outside"||state.progress<=0||reducedMotion.matches||
        prefs.getIntPref("zen.oneplane.animation-duration",160)===0)return false;
    if(dragImageMode==="content")setDragImageMode("inline",event);
    const from=state.progress,old=state.point,anchor=dragBunnyAnchor,node=dragNode;
    let frame=0,started=null;
    const duration=240+180*from;
    // The prototype's release uses the same curve for both the slot and
    // card. The only frame loop is a bounded accepted-drop visual tail.
    const animation={cancel(){if(frame)window.cancelAnimationFrame(frame);frame=0;},play(){
      const tick=now=>{
        frame=0;if(dragInsertAnimation!==animation)return;
        if(started===null)started=now;
        const u=bunnyClamp((now-started)/duration),k=bunnySmooth(u),p=from*(1-k);
        const dest={x:anchor.x,y:dragEdge+PULL_DISTANCE*BUNNY_DETACH_THRESHOLD*p};
        paintBunnyAt(p,{x:bunnyMix(old.x,dest.x,k),y:bunnyMix(old.y,dest.y,k)});
        if(u<1){frame=window.requestAnimationFrame(tick);return;}
        dragInsertAnimation=null;dragInsertNode=null;node.removeAttribute("data-op-reinsert");
        if(dragInsertPending)endDragVisual(true);
      };
      frame=window.requestAnimationFrame(tick);
    }};
    dragInsertAnimation=animation;dragInsertNode=node;
    return true;
  }
  function setDragImageMode(mode, event) {
    if (!dragNode || mode === dragImageMode) return;
    // Gecko owns the OS image for the rest of this gesture, even after re-entry.
    // Clearing/replacing it without a verified native contract risks duplicate art.
    if(dragImageMode==="outside")return;
    const previous = dragImageMode;
    if(dragBunnyLayout&&mode!=="outside"){
      dragImageMode=mode;
      dragNode.toggleAttribute("data-op-detached",mode==="content");
      row.toggleAttribute("data-op-inline-drag",mode==="inline");
      if(mode==="content")dragDetachedOnce=true;
      refreshIndicator();return;
    }
    typeof window!=="undefined"&&window.__nocturneTrace?.("drag.mode.request",()=>({previous,requested:mode,pull:dragPull,edge:dragEdge,ghost:!!dragGhost&&!dragGhost.hidden}),{sample:1800});
    if (mode === "outside") {
      // Only the OS drag image is painted beyond this browser window.
      makeDragGhost();
      if (!dragGhost) return;
      hideGhost();dragGhost.style.removeProperty("clip-path");
      const p = dragLastPoint || {x:window.innerWidth/2,y:dragEdge+PULL_DISTANCE};
      positionGhost(Math.max(20,Math.min(window.innerWidth-20,p.x)),
                    Math.max(20,Math.min(window.innerHeight-20,p.y)));
      dragGhost.hidden = false;
      const box = dragGhostBody.getBoundingClientRect();
      const ok = updateNativeDragImage(dragGhostBody,Math.round(box.width/2),Math.round(box.height/2),event);
    typeof window!=="undefined"&&window.__nocturneTrace?.("drag.native-image",()=>({ok,width:box.width,height:box.height}),{sample:1800});
      hideGhost();
      if (!ok) { if (dragBunnyLayout)paintBunnyAt(dragBunnyLayout.progress,dragBunnyLayout.point);else if (previous === "content") showGhost(event); return; }
    }
    cancelInsertion();
    const detached = mode === "content" || mode === "outside";
    if(!detached&&previous==="content")dragNode.setAttribute("data-op-lane-ghost","true");
    dragImageMode = mode;
    dragNode.toggleAttribute("data-op-detached", detached);
    row.toggleAttribute("data-op-inline-drag", !detached);
    if (detached) {
      dragDetachedOnce=true;
      clearGroupPull();
      cancelInsertion();
      if(!dragBunnyLayout){setPull(0);clearLiveDrag();}
      if (mode === "content") showGhost(event);
    } else {
      hideGhost();
      clearLiveDrag();
      dragNode.setAttribute("data-op-drag-follow","true");
      setPull(0);
    }
    if (draggedTab && !draggedGroup) measureSplitGroup(splitGroup(draggedTab));
    refreshIndicator();
    typeof window!=="undefined"&&window.__nocturneTrace?.("drag.mode.applied",()=>({mode:dragImageMode,previous,detached:dragNode?.hasAttribute('data-op-detached'),laneGhost:dragNode?.hasAttribute('data-op-lane-ghost'),ghost:!!dragGhost&&!dragGhost.hidden,unified:true}),{sample:1800});
    refreshIslandTitle();
  }
  function followLocalSource(event, node) {
    const rect = unshiftedRect(node);
    shiftDragNode(node, event.clientX - rect.width * dragGrabRatio - rect.left, true);
  }
  function onWindowDragLeave(event) {
    if (event.relatedTarget instanceof Node) return;
    // Internal strip -> page crossings must not turn on the OS ghost
    // or retire a foreign preview. Actual destination leave releases it.
    const x = event.clientX, y = event.clientY;
    const atEdge = x <= 1 || y <= 1 || x >= window.innerWidth-1 || y >= window.innerHeight-1;
    if (atEdge || event.target === window || event.target === document || event.target === root){
      if(clearIncomingDrag("leave-window"))return;
      if(draggedTab&&dragNode)setDragImageMode("outside",event);
    }
  }
  // Destination-local preview lease. Source token is not proof of a
  // native DataTransfer session; A5 owns that identity contract.
  let incomingDrag=null,incomingReleasing=false;
  function incomingMotionAllowed(){
    return !incomingReleasing&&dragPhaseInputAllowed()&&!draggedTab&&!dragInsertPending&&!dragLifecycle.current();
  }
  function incomingSourceCurrent(lease,tab=lease?.tab,owner=lease?.owner){
    try{return !!lease&&lease.tab===tab&&lease.owner===owner&&owner!==window&&!owner.closed&&
      owner[DRAG_CONTROLLER]===lease.source&&lease.source.source()===tab&&lease.source.sourceToken()===lease.token;}
    catch{return false;}
  }
  function incomingDropAllowed(tab,owner,lease=incomingDrag,strict=false){
    if(!lease||incomingDrag!==lease||lease.invalid||!incomingSourceCurrent(lease,tab,owner)||!incomingMotionAllowed())return false;
    const viewport=dragViewportState();
    return lease.viewport.every((value,i)=>Object.is(value,viewport[i]))&&
      lease.workspaceManager===(window.gZenWorkspaces??null)&&
      lease.workspaceId===(window.gZenWorkspaces?.activeWorkspace??null)&&
      (!strict||sameDragChromeFrame(lease.chrome,readDragChromeFrame()));
  }
  function releaseIncomingVisual(lease,reason,retain=false){
    if(!lease||incomingDrag!==lease)return false;
    if(!retain)incomingDrag=null;
    if(lease.invalid)return true;
    lease.invalid=true;incomingReleasing=true;
    try{
      clearLiveDrag();clearDropMarker();releaseDragReveal();refreshIndicator();
      window.__nocturneTrace?.("drag.incoming.release",{reason,retained:retain},{throttle:250});
    }finally{incomingReleasing=false;}
    return true;
  }
  function clearIncomingDrag(reason,lease=incomingDrag){
    return releaseIncomingVisual(lease,reason);
  }
  function retireIncomingDrag(){
    const lease=incomingDrag;
    if(!lease)return false;
    if(!incomingSourceCurrent(lease))return clearIncomingDrag("source-gone",lease);
    if(lease.invalid)return true;
    if(!incomingDropAllowed(lease.tab,lease.owner,lease,true))return releaseIncomingVisual(lease,"geometry-or-phase",true);
    return false;
  }
  function admitIncomingDrag(event,tab,owner){
    if(owner===window)return true;
    if(!event.isTrusted)return false;
    if(event.type!=="dragover")return incomingDropAllowed(tab,owner);
    if(!incomingMotionAllowed()){retireIncomingDrag();return false;}
    if(incomingDropAllowed(tab,owner))return true;
    clearIncomingDrag("new-preview");
    const source=owner?.[DRAG_CONTROLLER],token=source?.sourceToken?.();
    if(!incomingMotionAllowed()||!Number.isSafeInteger(token)||source?.source()!==tab)return false;
    const chrome=readDragChromeFrame();
    if(!chrome)return false;
    incomingDrag={tab,owner,source,token,viewport:dragViewportState(),chrome,
      workspaceManager:window.gZenWorkspaces??null,
      workspaceId:window.gZenWorkspaces?.activeWorkspace??null,invalid:false};
    return true;
  }
  function rejectIncomingDrop(event,tab,owner,lease){
    // Consume the rejected custom drop without native mutation. Only the
    // exact captured source lease may suppress its detach fallback.
    event.preventDefault();event.stopPropagation();
    const current=incomingSourceCurrent(lease,tab,owner);
    clearIncomingDrag("drop-rejected",lease);
    if(current&&incomingSourceCurrent(lease,tab,owner))lease.source.markHandled(false,lease.token,window);
  }
  // Use painted lane rectangles, not offscreen native-order slots.
  function useLaneDrop(){
    return row.hasAttribute("data-op-overflow-row")||row.hasAttribute("data-op-lane-drag")||
      (hasCenteredIsland()?[leftLane,rightLane]:[list]).some(l=>l.clientWidth>0&&l.scrollWidth>l.clientWidth+1);
  }
  function laneAtPoint(point){
    const lanes=hasCenteredIsland()?[leftLane,rightLane,...(bottomLane.hidden?[]:[bottomLane])]:[list];
    return lanes.find(lane=>{
      const b=lane.getBoundingClientRect();
      return b.width>0&&b.height>0&&point.y>=b.top&&point.y<b.bottom&&point.x>=b.left-5&&point.x<=b.right+5;
    })||null;
  }
  function laneDropTarget(lane,x,source=null){
    if(!lane)return null;
    const clip=lane.getBoundingClientRect(),nodes=laneNodes(lane).filter(n=>n!==source);
    const slots=nodes.map(node=>({node,rect:node.getBoundingClientRect()}));
    const picked=visibleLaneDropIndex(slots.map(s=>({left:s.rect.left,right:s.rect.right})),clip.left,clip.right,x);
    if(picked)return {...nativeSlot(slots[picked.index].node),before:picked.before};
    if(!nodes.length){
      const all=stripNodes().filter(n=>n!==source);
      if(!all.length)return null;
      const tabWidth=parseFloat(window.getComputedStyle(row).getPropertyValue("--op-tab"))||36;
      const boundary=islandBoundary(all.map(n=>compactSlotWidth(n,tabWidth)),tabWidth+3);
      if(lane===leftLane&&all[boundary])return {...nativeSlot(all[boundary]),before:true};
      if(lane===rightLane&&all[boundary-1])return {...nativeSlot(all[boundary-1]),before:false};
      return {...nativeSlot(all.at(-1)),before:false};
    }
    return null;
  }
  let laneDragFrame=0,laneDragPoint=null,laneDragSource=null,laneDragViewport=null,laneDragLast=0;
  function stopLaneAutoscroll(){
    if(laneDragFrame)window.cancelAnimationFrame(laneDragFrame);
    laneDragFrame=0;laneDragPoint=null;laneDragSource=null;laneDragViewport=null;laneDragLast=0;
  }
  function paintLaneDrop(dest){
    clearDropMarker();
    if(dest?.native){dropMarker=dest.element;dropMarker.setAttribute(dest.before?"data-op-drop-before":"data-op-drop-after","true");}
    liveDragTarget=dest;
  }
  function laneAutoStep(now){
    laneDragFrame=0;
    if(retireChangedDragViewport()||retireIncomingDrag())return;
    const lane=laneDragViewport,point=laneDragPoint;
    if(dead||!lane||!point||!row.hasAttribute("data-op-lane-drag"))return;
    const clip=lane.getBoundingClientRect(),edge=Math.min(42,clip.width/3);
    const velocity=laneScrollVelocity(point.x,clip.left,clip.right,edge);
    const dt=laneDragLast?Math.min(32,now-laneDragLast):16;laneDragLast=now;
    if(!velocity)return;
    const before=lane.scrollLeft;
    lane.scrollLeft+=velocity*dt/16;
    if(Math.abs(lane.scrollLeft-before)>.1){
      paintLaneDrop(laneDropTarget(lane,point.x,laneDragSource));
      laneDragFrame=window.requestAnimationFrame(laneAutoStep);
    }
  }
  function clearLaneDrag(){
    stopLaneAutoscroll();
    const active=row.hasAttribute("data-op-lane-drag");
    row.removeAttribute("data-op-lane-drag");
    if(active&&!dead){schedule();scheduleGeometry();}
    dragNode?.removeAttribute("data-op-lane-ghost");
    if(active&&dragImageMode==="inline")hideGhost();
  }
  function prepareLanePull(){
    // Do not clear an already-owned lane ghost on every dragover. That
    // hides the card, resets its transform and schedules another layout.
    if(!row.hasAttribute("data-op-lane-drag")||dragShifted.size||row.hasAttribute("data-op-live-drag"))
      clearLiveDrag();
    stopLaneAutoscroll();
    liveDragTarget=null;
    clearDropMarker();
    row.setAttribute("data-op-lane-drag","true");
  }
  function showLaneGhost(event,pull=0){
    if(!dragNode)return;
    makeDragGhost();
    if(!dragGhost||!dragGhostBody)return;
    dragNode.setAttribute("data-op-lane-ghost","true");
    dragGhost.hidden=false;
    positionGhost(event.clientX,event.clientY);
    dragGhostBody.style.transform=pull?"scale("+Math.max(.12,1-.8*pull)+")":"";
    typeof window!=="undefined"&&window.__nocturneTrace?.("drag.lane.ghost",()=>({pull,mode:dragImageMode,sourceHidden:dragNode.hasAttribute('data-op-lane-ghost'),detached:dragNode.hasAttribute('data-op-detached'),ghost:!dragGhost.hidden}),{throttle:100,sample:1200});
  }
  function previewLaneDrag(event,tab,entry){
    if(dragShifted.size||row.hasAttribute("data-op-live-drag"))clearLiveDrag();
    row.setAttribute("data-op-lane-drag","true");
    const local=tabOwner(tab)===window,source=local&&isStripNode(entry)?entry:null;
    const lane=laneAtPoint({x:event.clientX,y:event.clientY});
    const dest=laneDropTarget(lane,event.clientX,source);
    paintLaneDrop(dest);
    if(local&&entry===dragNode&&dragImageMode==="inline")showLaneGhost(event);
    if(lane&&lane.scrollWidth>lane.clientWidth+1){
      laneDragViewport=lane;laneDragPoint={x:event.clientX,y:event.clientY};laneDragSource=source;
      const b=lane.getBoundingClientRect();
      if(!laneDragFrame&&laneScrollVelocity(event.clientX,b.left,b.right,Math.min(42,b.width/3))){laneDragLast=0;laneDragFrame=window.requestAnimationFrame(laneAutoStep);}
    }else stopLaneAutoscroll();
    return dest;
  }
  function previewStripDrag(event, tab) {
    const owner = tabOwner(tab);
    if(owner!==window&&!incomingDropAllowed(tab,owner))return null;
    const group = owner?.[DRAG_CONTROLLER]?.group();
    const entry = group ? splitEntries.get(group)?.box : entries.get(tab)?.item;
    if(owner!==window&&!stripNodes().length){
      const empty=emptyStripDestination(event,tab);
      if(empty){
        if(!liveDragTarget?.empty||liveDragTarget.spaceId!==empty.spaceId){
          clearLiveDrag();
          row.setAttribute("data-op-empty-incoming","true");
          window.__nocturneTrace?.("drag.empty.preview",{admitted:true},{throttle:400});
        }
        liveDragTarget=empty;return empty;
      }
      // A rejected/left empty hit must also retire the visual in lane mode.
      if(liveDragTarget?.empty||row.hasAttribute("data-op-empty-incoming"))clearLiveDrag();
    }
    if(useLaneDrop())return previewLaneDrag(event,tab,entry);
    if(owner!==window && row.hasAttribute("data-op-show-island") &&
        !row.hasAttribute("data-op-island-incoming")){
      row.setAttribute("data-op-island-incoming","true");
      scheduleGeometry();
    }
    const nodes = stripNodes();
    if (!nodes.length) { clearLiveDrag(); return null; }
    const slots = nodes.map(node => ({ node, rect: unshiftedRect(node) }));
    const local = owner === window && isStripNode(entry);
    const inline = owner === window && dragImageMode === "inline" && entry === dragNode;
    const memberGroup = !local && owner === window && splitGroup(tab);
    if (memberGroup) {
      const own = slots.find(slot => slot.node === splitEntries.get(memberGroup)?.box);
      if (own && event.clientX >= own.rect.left && event.clientX <= own.rect.right) {
        clearLiveDrag();
        if (inline) followLocalSource(event, entry);
        return { ...nativeSlot(own.node), before: false };
      }
    }
    const moving = local ? slots.find(slot => slot.node === entry) : null;
    const rest = slots.filter(slot => slot !== moving);
    if (!rest.length) {
      clearLiveDrag();
      if (inline) followLocalSource(event, entry);
      return null;
    }
    const found = dragSlotIndex(rest, event.clientX);
    const index = found < 0 ? rest.length : found;
    const target = rest[Math.min(index, rest.length - 1)];
    const dest = { ...nativeSlot(target.node), before: index < rest.length };
    if (!dest.native) { clearLiveDrag(); return null; }

    row.setAttribute("data-op-live-drag", "true");
    const gap = parseFloat(window.getComputedStyle(list).columnGap) || 3;
    const base = slots[0].rect.left;
    const incomingWidth = Math.max(1, parseFloat(window.getComputedStyle(row).getPropertyValue("--op-tab")) || 36);
    // Only the actual source follows the pointer. Neighbors glide into
    // their future slots without painting an additional placeholder.
    const order = rest.slice();
    if (moving) order.splice(index, 0, moving);
    else order.splice(index, 0, { node: null, rect: { width: incomingWidth } });
    const used = new Set();
    const lanes=islandSlotPositions(order.map(slot=>slot.rect.width),gap);
    const positions=lanes?.positions||[];
    if(!lanes){
      let left=base;
      for(const slot of order){positions.push(left);left+=slot.rect.width+gap;}
    }
    // An elastic buffer follows the pointer before crossing the 8px
    // reorder hysteresis. Neighboring slots yield as a chain, with
    // decreasing pressure farther from the dragged item. The dragged
    // card has resistance at the edges of its slot, not a free overlap.
    let pressure = 0, direction = 0, followX = null;
    if (inline && moving) {
      const slotLeft = positions[index], width = moving.rect.width;
      const rawDelta = event.clientX - width*dragGrabRatio - slotLeft;
      direction = Math.sign(rawDelta);
      // The island is an immovable boundary. Do not yield toward it.
      if(lanes && ((index<lanes.boundary && direction>0) ||
          (index>=lanes.boundary && direction<0))) direction=0;
      const maxYield = Math.min(15,Math.max(8,width*.33));
      pressure = maxYield * (1-Math.exp(-Math.abs(rawDelta)/18));
      followX = slotLeft + direction * Math.min(Math.abs(rawDelta),pressure);
    }
    for (let i=0;i<order.length;i++) {
      const slot=order[i];
      if (!slot.node) continue;
      if (slot === moving && inline) {
        if (followX !== null) shiftDragNode(slot.node,followX-slot.rect.left,true);
        else followLocalSource(event,slot.node);
      } else {
        // Shift the whole chain equally for the first neighbor; the
        // same displacement keeps the existing gaps from collapsing.
        const sameLane=!lanes || (i<lanes.boundary)===(index<lanes.boundary);
        const onSide = sameLane && (direction > 0 ? i > index : direction < 0 && i < index);
        const elastic = onSide ? direction*pressure : 0;
        shiftDragNode(slot.node,positions[i]-slot.rect.left+elastic);
      }
      used.add(slot.node);
    }
    // Incoming tabs retain the original native group until successful drop.
    row.style.setProperty("--op-drag-incoming", (moving ? 0 : incomingWidth + gap) + "px");
    shiftDragNode(plus,!lanes && direction > 0 ? pressure : 0);
    used.add(plus);
    if (inline && !moving) { followLocalSource(event,entry); used.add(entry); }
    for (const node of [...dragShifted]) {
      if (used.has(node)) continue;
      node.style.removeProperty("--op-drag-x");
      node.removeAttribute("data-op-drag-follow");
      dragShifted.delete(node);
    }
    liveDragTarget = dest;
    refreshIndicator();
    return dest;
  }
  function onStripDragLeave(event) {
    if (event.relatedTarget instanceof Node && row.contains(event.relatedTarget)) return;
    if (toolbarContainsPoint(event.clientX,event.clientY)) return;
    if(clearIncomingDrag("leave-strip"))return;
    stopLaneAutoscroll();
    // The window capture listener owns pull and image transitions.
    // Do not erase a group's visual position mid-extraction.
    if (!(dragImageMode === "inline" && (groupPullLayout || dragBunnyLayout || dragPull > 0 || dragInsertAnimation))) clearLiveDrag();
    clearDropMarker();
  }
  function clearDropMarker() {
    dropMarker?.removeAttribute("data-op-drop-before");
    dropMarker?.removeAttribute("data-op-drop-after");
    dropMarker = null;
  }
  function markDrop(event) {
    clearDropMarker();
    const dest = dropTarget(event);
    if (!dest?.native || dest.group === draggedGroup && draggedGroup) return;
    if (!draggedGroup && draggedTab && dest.group && splitGroup(draggedTab) === dest.group) return;
    dropMarker = dest.element;
    dropMarker.setAttribute(dest.before ? "data-op-drop-before" : "data-op-drop-after", "true");
  }
  function releaseDragReveal() {
    if (dragRevealTimer) window.clearTimeout(dragRevealTimer);
    dragRevealTimer = 0;
    toolbarWrapper?.removeAttribute("oneplane-drag-hold");
  }
  function toolbarDragReturnZone(event){
    if(!toolbarWrapper)return false;
    const rect=toolbarWrapper.getBoundingClientRect();
    const measured=parseFloat(toolbarWrapper.style.getPropertyValue("--op-measured-toolbar-height"))||0;
    const navHeight=navbar?.getBoundingClientRect().height||0;
    // Reserve the actual expanded toolbar even while its compact height
    // is still animating. Do not include the decorative fade.
    const stripBottom=row.getBoundingClientRect().bottom;
    return tabReturnZone(event.clientX,event.clientY,rect,Math.max(rect.height,measured,navHeight,stripBottom-rect.top,36)+4);
  }
  function holdToolbarForReturn(){
    toolbarWrapper.setAttribute("oneplane-drag-hold","true");
    reconcilePanel();
    if(dragRevealTimer)window.clearTimeout(dragRevealTimer);
    dragRevealTimer=window.setTimeout(releaseDragReveal,500);
    splitZone.removeAttribute("data-op-side");
  }
  function revealForDrag(event) {
    if(retireChangedDragViewport()||retireBlockedNativeTabDrag("window-phase"))return;
    const tab = readDraggedTab(event);
    if(!tab)clearIncomingDrag("source-unresolved");
    if (!hoverSupported() || !tab || !toolbarWrapper) return;
    if(dragInsertPending)endDragVisual();
    const within = toolbarDragReturnZone(event),owner=tabOwner(tab);
    const local=owner===window;
    if(!local){
      // Source's OS ghost/placement remains independent of destination
      // admission. Reject only the destination preview, not source motion.
      owner?.[DRAG_CONTROLLER]?.preview?.(event);
      owner?.[DRAG_CONTROLLER]?.outside(event);
      if(!within){clearIncomingDrag("outside-toolbar");return;}
      if(!admitIncomingDrag(event,tab,owner))return;
    }
    if(within)holdToolbarForReturn();
    if(local)clearPlacementPreview();
    // A return still runs the visual state machine. Native cancellation
    // remains owned by onToolbarDrop; do not reorder after detachment.
    if (local && dragNode) {
      dragLastPoint = {x:event.clientX,y:event.clientY};
      // The broad native return/drop zone is deliberately independent of
      // Bunny's narrow source-card zone. Never zero pull just for entering
      // the toolbar, and never chase a changing wrapper/row rectangle.
      const p = bunnyPullProgress(event.clientY,dragEdge);
      const lateralExit = event.clientX < toolbarWrapper.getBoundingClientRect().left ||
                          event.clientX > toolbarWrapper.getBoundingClientRect().right;
      const threshold=BUNNY_DETACH_THRESHOLD;
      const detach=p>=threshold||lateralExit;
      window.__nocturneTrace?.("drag.pull.decision",()=>({mode:dragImageMode,within,p,threshold,detach,lateralExit,edge:dragEdge,y:event.clientY,detachedOnce:dragDetachedOnce,lane:useLaneDrop()}),{throttle:85,sample:1000});
      if(dragImageMode==="inline"&&(p>0||detach)&&!dragBunnyAnchor)captureBunnyAnchor();
      setDragImageMode(detach ? "content" : "inline",event);
      if(dragImageMode==="content"){
        if(!paintBunnyPull(event,p,lateralExit))positionGhost(event.clientX,event.clientY);
        clearDropMarker();
        if(within){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect="move";}
        else releaseDragReveal();
        return;
      }
      if(dragImageMode==="outside"){
        if(within){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect="move";previewStripDrag(event,tab);}
        else{clearLiveDrag();releaseDragReveal();}
        return;
      }
      if(p>0&&paintBunnyPull(event,p)){
        holdToolbarForReturn();
        if(within){event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect="move";}
        return;
      }
      if(dragBunnyAnchor)clearBunnyPull();
      if(dragDetachedOnce&&within){
        event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect="move";
        clearLaneDrag();clearDropMarker();
        // clearLiveDrag() during capture removed the old follow marker.
        // At zero progress the real source owns the drag artwork again,
        // including its border and icon state, even on repeated dragovers.
        dragNode.setAttribute("data-op-drag-follow","true");
        refreshIndicator();return;
      }
    }
    if (!within) {
      clearLiveDrag(); releaseDragReveal(); return;
    }
    toolbarWrapper.setAttribute("oneplane-drag-hold", "true");
    if (dragRevealTimer) window.clearTimeout(dragRevealTimer);
    dragRevealTimer = window.setTimeout(releaseDragReveal, 500);
    if (within) {
      event.preventDefault();
      event.stopPropagation();
      event.dataTransfer.dropEffect = "move";
    }
    clearDropMarker();
    previewStripDrag(event,tab);
  }
  function onToolbarDrop(event) {
    if(retireChangedDragViewport()||retireChangedDragChromeFrame("toolbar-drop"))return;
    const tab=readDraggedTab(event);
    if(!tab||!toolbarDragReturnZone(event))return;
    if(tabOwner(tab)===window&&!dragPhaseInputAllowed()){
      event.preventDefault();event.stopPropagation();cancelActiveDrag("toolbar-phase");return;
    }
    if(tabOwner(tab)===window&&(dragDetachedOnce||dragBunnyLayout)){
      event.preventDefault();event.stopImmediatePropagation();
      prepareBunnyDrop(event);
      sourceHandled(tab,true);schedule();return;
    }
    onStripDrop(event);
  }
  function emptySplitTarget(tab) {
    return Boolean(tab?.hasAttribute("zen-empty-tab") ||
      (dragSearch?.tab === tab && dragSearch.empty));
  }
  function readStartupSearch() {
    const tab = browser.selectedTab, bar = window.gURLBar;
    if (!tab || !bar) return null;
    const empty = tab.hasAttribute("zen-empty-tab") ||
      /^(about:(blank|newtab|home|privatebrowsing))(?:[?#].*)?$/i.test(tab.linkedBrowser?.currentURI?.spec || "");
    if (!empty || !(bar.hasAttribute("zen-newtab") || bar.hasAttribute("zen-floating-urlbar")) ||
        !(bar.hasAttribute("open") || bar.hasAttribute("focused") || bar.view?.isOpen)) return null;
    // The native document must still be the same one when restoration runs.
    // This transient identity is never logged or persisted.
    return {tab,empty,query:bar.value || "",newtab:bar.hasAttribute("zen-newtab"),
      uri:tab.linkedBrowser?.currentURI?.spec??null};
  }
  // One pending restoration belongs to one finished native tab gesture.
  // Increment even after a cleared timeout: an already queued callback from
  // a previous gesture must not clear or consume a successor's timer.
  let startupSearchEpoch=0;
  function cancelStartupSearchRestore(reason) {
    ++startupSearchEpoch;
    const pending=!!restoreSearchTimer;
    if(restoreSearchTimer)window.clearTimeout(restoreSearchTimer);
    restoreSearchTimer=0;
    if(pending)window.__nocturneTrace?.("drag.search.restore",{outcome:"invalidated",reason},{sample:1000});
  }
  function rememberStartupSearch(event) {
    if (event.button !== 0 || !event.isTrusted) return;
    cancelStartupSearchRestore("source-pointer");
    pointerSearch = readStartupSearch();
  }
  function restoreStartupSearch(state) {
    if (!state || dead || !Number.isSafeInteger(state.gestureToken)) return;
    cancelStartupSearchRestore("reschedule");
    const epoch=startupSearchEpoch;
    restoreSearchTimer = window.setTimeout(()=>{
      if(epoch!==startupSearchEpoch)return;
      restoreSearchTimer=0;
      // Native tab/search remain authoritative. An intervening gesture,
      // new input, navigation or incoming drag invalidates old intent.
      const tab=state.tab;
      const empty=tab?.hasAttribute("zen-empty-tab") ||
        /^(about:(blank|newtab|home|privatebrowsing))(?:[?#].*)?$/i.test(tab?.linkedBrowser?.currentURI?.spec || "");
      if (dead || dragLifecycle.current() || nativeDragToken!==null || dragInsertPending ||
          incomingDrag || row.hasAttribute("data-op-dragging") ||
          browser.selectedTab!==tab || !validNativeTab(tab) || !empty ||
          state.uri!==(tab?.linkedBrowser?.currentURI?.spec??null)) {
        window.__nocturneTrace?.("drag.search.restore",{outcome:"skipped",reason:"state-changed",token:state.gestureToken},{sample:1000});
        return;
      }
      const bar=window.gURLBar;
      if (!bar || bar.hasAttribute("open") || bar.hasAttribute("focused") || bar.view?.isOpen) return;
      try {
        if (state.newtab && typeof window.gZenUIManager?.handleNewTab === "function") {
          // Native Zen new-tab search, without toggling an already-open popup.
          if (!bar.hasAttribute("zen-newtab")) window.gZenUIManager.handleNewTab(false,false,"tab",true);
          else { bar.search(state.query); document.getElementById("Browser:OpenLocation")?.doCommand(); }
          if (state.query && bar.value!==state.query) bar.search(state.query);
        } else {
          bar.search(state.query);
          document.getElementById("Browser:OpenLocation")?.doCommand();
        }
        window.__nocturneTrace?.("drag.search.restore",{outcome:"requested",token:state.gestureToken},{sample:1000});
      } catch(error) { console.error("[OnePlane] Restore startup search:",nocturneErrorClass(error)); }
    },80);
  }
  function restoreReturnedHover(source,point){
    if(!source||!point||!hoverSupported()||!list.contains(source))return false;
    const hit=source.matches(".oneplane-tab")?source:
      Array.from(source.querySelectorAll(".oneplane-tab")).find(n=>{
        const r=n.getBoundingClientRect();
        return point.x>=r.left&&point.x<r.right&&point.y>=r.top&&point.y<r.bottom;
      });
    if(!hit)return false;
    const r=hit.getBoundingClientRect(),lane=hit.closest(".oneplane-island-lane")||list,clip=lane.getBoundingClientRect();
    if(point.x<Math.max(r.left,clip.left)||point.x>=Math.min(r.right,clip.right)||
        point.y<Math.max(r.top,clip.top)||point.y>=Math.min(r.bottom,clip.bottom))return false;
    selectHover(hit,point.x);
    lastHoverPointer={...point};
    return hoverTab===hit;
  }
  function endDragVisual(restoreReturn=false) {
    const returnedSource=restoreReturn?dragNode:null,returnedPoint=restoreReturn?dragReturnPoint:null;
    dragReturnPoint=null;
    dragInsertPending=false;dragViewport=null;dragChromeFrame=null;nativeDragTopology=null;
    typeof window!=="undefined"&&window.__nocturneTrace?.("drag.visual.end",()=>({mode:dragImageMode,pull:dragPull,detached:dragDetachedOnce,ghost:!!dragGhost&&!dragGhost.hidden,shifted:dragShifted.size}),{sample:1800});
    clearPlacementPreview();
    cancelInsertion();
    const search = dragSearch;
    dragSearch = null; pointerSearch = null;
    clearGroupPull();
    if(dragBunnyLayout)clearBunnyPull();
    dragNode?.removeAttribute("data-op-lane-ghost");
    dragNode?.removeAttribute("data-op-detached");
    dragNode?.removeAttribute("data-op-drag-follow");
    dragNode?.removeAttribute("data-op-pulling");
    for (const name of ["--op-pull-width","--op-pull-y","--op-pull-scale-y","--op-pull-scale-x","--op-pull-gap"])
      dragNode?.style.removeProperty(name);
    hideGhost();
    dragGhost?.remove(); dragGhost = null; dragGhostBody = null;
    dragPull = 0; dragLastPoint = null; dragBunnyAnchor=null;dragBunnyFull=null;dragDetachedOnce=false;
    dragNode = null;
    dragImageMode = null;
    row.removeAttribute("data-op-inline-drag");
    releaseDragReveal();
    clearLiveDrag();
    clearDropMarker();
    row.removeAttribute("data-op-dragging");
    if(!dead){applyHoverMode();scheduleGeometry();schedule();}
    for (const entry of splitEntries.values()) entry.box.removeAttribute("data-op-group-dragging");
    splitZone.removeAttribute("data-op-dragging");
    splitZone.removeAttribute("data-op-side");
    if(returnedSource){
      const restored=restoreReturnedHover(returnedSource,returnedPoint);
      window.__nocturneTrace?.("drag.return.highlight",{restored},{sample:800});
    }
    refreshIndicator();
    refreshIslandTitle();
    restoreStartupSearch(search);
    reconcileTabCascade();
  }
  function sourceHandled(tab,finishReturn=false,expectedToken=null) {
    const source=tabOwner(tab)?.[DRAG_CONTROLLER];
    source?.markHandled(finishReturn,expectedToken);
  }
  function onDragStart(event, tab, group = null) {
    if (incomingReleasing || !dragPhaseInputAllowed() || !validNativeTab(tab) || !event.dataTransfer) {
      event.preventDefault();
      return;
    }
    const image = group ? splitEntries.get(group)?.box : entries.get(tab)?.item;
    if (!image) { event.preventDefault(); return; }
    clearIncomingDrag("local-start");
    if(dragInsertPending)endDragVisual();
    cancelInsertion();
    cancelOverflowMotion();
    if(dragLifecycle.current())cancelActiveDrag("superseded");
    cancelStartupSearchRestore("dragstart");
    const grabbed = image.getBoundingClientRect();
    dragGrabRatio = Math.max(0,Math.min(1,(event.clientX-grabbed.left)/Math.max(1,grabbed.width)));
    dragGrabY = Math.max(0,Math.min(1,(event.clientY-grabbed.top)/Math.max(1,grabbed.height)));
    const compactWidth = parseFloat(window.getComputedStyle(row).getPropertyValue("--op-tab")) || 36;
    dragWidth = group ? (22 + image.querySelectorAll(".oneplane-tab").length*(compactWidth+3)) : compactWidth;
    // Freeze the unpulled card's lower edge for this gesture. The panel,
    // bookmarks and lower lane may change independently during native DnD.
    dragEdge = grabbed.bottom + BUNNY_EDGE_PAD;
    typeof window!=="undefined"&&window.__nocturneTrace?.("drag.start.geometry",()=>({group:!!group,edge:dragEdge,cardBottom:grabbed.bottom,edgePad:BUNNY_EDGE_PAD,width:dragWidth,grabX:dragGrabRatio,grabY:dragGrabY,pullDistance:PULL_DISTANCE,overflow:row.hasAttribute('data-op-overflow-row'),panelHeight:toolbarWrapper?.getBoundingClientRect().height}),{sample:1800});
    dragLastPoint = {x:event.clientX,y:event.clientY};
    clearTabHover();
    if (group && (splitGroup(tab) !== group || groupMembers(group).length < 2)) {
      event.preventDefault();
      return;
    }
    if(!startNativeDragLifecycle(event,tab)){event.preventDefault();return;}
    const startupSearch=pointerSearch?.tab === browser.selectedTab ? pointerSearch : readStartupSearch();
    dragSearch=startupSearch?{...startupSearch,gestureToken:nativeDragToken}:null;
    pointerSearch = null;
    groupPullLayout = null;
    draggedTab = tab;
    draggedGroup = group;
    dragHandled = false;dragDetachedOnce=false;
    dragStartPoint = { x: event.screenX, y: event.screenY };
    dragViewport=dragViewportState();
    try {
      event.dataTransfer.mozSetDataAt(DRAG_TYPE, tab, 0);
      event.dataTransfer.effectAllowed = "move";
      dragNode = image;
      dragImageMode = "inline";
      event.dataTransfer.setDragImage(blankDragImage, 0, 0);
      row.setAttribute("data-op-dragging", "true");
      scheduleGeometry();
      row.setAttribute("data-op-inline-drag", "true");
      image.setAttribute("data-op-drag-follow","true");
      makeDragGhost(); hideGhost();
      if (group) image.setAttribute("data-op-group-dragging", "true");
      if (!group && (browser.selectedTab !== tab || isSplit(tab))) {
        splitZone.setAttribute("data-op-dragging", "true");
      }
      previewStripDrag(event,tab);
      dragChromeFrame=readDragChromeFrame();
      if(!dragChromeFrame){cancelActiveDrag("chrome-frame-unready");return;}
      refreshIndicator();
      refreshIslandTitle();
      event.stopPropagation();
    } catch (error) {
      event.preventDefault();
      cancelActiveDrag("native-start-failed");
      console.error("[OnePlane] Tab drag start:",nocturneErrorClass(error));
    }
  }
  function onStripDragOver(event) {
    if(retireChangedDragViewport())return;
    if(!dragPhaseInputAllowed()){
      retireBlockedNativeTabDrag("strip-phase");retireIncomingDrag();return;
    }
    const tab = readDraggedTab(event);
    if(!tab){clearIncomingDrag("source-unresolved");return;}
    if(!admitIncomingDrag(event,tab,tabOwner(tab)))return;
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
    clearDropMarker();
    previewStripDrag(event, tab);
  }
  // Frozen mirrors can outlive a native close/group change. Validate the
  // destination at command time rather than mutating a stale native target.
  function validStripDropTarget(dest,event=null,tab=null){
    if(dest?.empty)return validEmptyStripDestination(dest,event,tab);
    if(!dest?.native)return false;
    const tabs=readStripTopology().tabs;
    if(dest.group)return dest.native===dest.group&&tabs.some(x=>x.group===dest.group&&tabOwner(x.tab)===window);
    return dest.native===dest.tab&&tabs.some(x=>x.tab===dest.tab&&!x.group&&tabOwner(x.tab)===window);
  }
  function moveNativeNextTo(element, dest) {
    if(!element||!dest?.native||element===dest.native)return false;
    // Already adjacent is a native no-op, not a failed commit.
    if(nativeStripPlacement(element,dest))return true;
    const method=dest.before?"moveTabBefore":"moveTabAfter";
    if(typeof browser[method]!=="function")return false;
    browser[method](element,dest.native);
    return nativeStripPlacement(element,dest);
  }
  function onStripDrop(event) {
    if(retireChangedDragViewport()||retireChangedDragChromeFrame("strip-drop"))return;
    const tab = readDraggedTab(event);
    if (!tab) return;
    const owner = tabOwner(tab),incoming=owner!==window?incomingDrag:null;
    if(!dragPhaseInputAllowed()){
      if(event.isTrusted){
        if(owner===window){event.preventDefault();event.stopPropagation();cancelActiveDrag("strip-phase");}
        else rejectIncomingDrop(event,tab,owner,incoming);
      }
      return;
    }
    if(owner!==window&&(!event.isTrusted||!toolbarDragReturnZone(event)||!incomingDropAllowed(tab,owner,incoming,true))){
      if(event.isTrusted)rejectIncomingDrop(event,tab,owner,incoming);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const source = owner?.[DRAG_CONTROLLER];
    // A delivered custom drop must consume the source even if native Zen
    // rejects a command: otherwise dragend can mistake it for OS detach.
    // This is cancellation/cleanup, not evidence of a successful mutation.
    const markSourceHandled=()=>owner===window?source?.markHandled():source?.markHandled(false,incoming.token,window);
    const group = source?.group();
    if (owner === window && dragNode) { setDragImageMode("inline",event); setPull(0); }
    const dest = previewStripDrag(event, tab) || dropTarget(event);
    typeof window!=="undefined"&&window.__nocturneTrace?.("drag.drop",()=>({local:owner===window,group:!!group,dest:!!dest?.native,empty:!!dest?.empty,before:dest?.before,mode:dragImageMode}),{sample:1800});
    if(retireChangedDragChromeFrame("strip-target"))return;
    if(owner!==window&&!incomingDropAllowed(tab,owner,incoming,true)){
      rejectIncomingDrop(event,tab,owner,incoming);return;
    }
    if(!validStripDropTarget(dest,event,tab)){
      markSourceHandled();
      if(!clearIncomingDrag("target-rejected",incoming)){clearLiveDrag();clearDropMarker();}
      return;
    }
    row.setAttribute("data-op-drag-commit", "true");
    let operation="none",outcome="rejected";
    try {
      if(dest?.empty){
        operation="adopt-empty-workspace";
        if(owner===window||!validEmptyStripDestination(dest,event,tab)||
           !incomingDropAllowed(tab,owner,incoming,true)){outcome="rejected";return;}
        // No synthetic tabIndex: Zen's native space owner chooses its
        // insertion position (including other hidden Workspaces).
        const adopted=browser.adoptTab(tab,{selectTab:true});
        if(adopted&&validNativeTab(adopted)&&tabOwner(adopted)===window&&
           dest.manager===window.gZenWorkspaces&&dest.manager.activeWorkspace===dest.spaceId&&
           dest.container.isConnected){
          try{
            // This existing Zen API enforces the native tabsContainer and
            // UUID even if the two windows happen to share a workspace ID.
            dest.manager.moveTabToWorkspace(adopted,dest.spaceId);
          }catch(error){console.error("[OnePlane] Native workspace adoption:",nocturneErrorClass(error));}
        }
        outcome=nativeEmptyAdoptionOutcome(adopted,dest);
        schedule();return;
      }
      if(group){
        operation="move-group";
        if(owner===window&&splitGroup(tab)===group&&dest.native!==group)
          outcome=moveNativeNextTo(group,dest)?"confirmed":"unverified";
        else if(owner===window&&dest.native===group)outcome="no-op";
        return;
      }
      if(dest?.tab===tab||(owner===window&&dest?.group&&splitGroup(tab)===dest.group)){
        outcome="no-op";return;
      }
      if(owner!==window&&!incomingDropAllowed(tab,owner,incoming,true))return;
      if(isSplit(tab)){
        operation="unsplit-before-move";
        if(!unsplitTab(tab)){outcome="rejected";return;}
      }
      if(!validStripDropTarget(dest))return;
      if(owner!==window&&!incomingDropAllowed(tab,owner,incoming,true))return;
      if(owner===window){
        operation="move-tab";
        outcome=moveNativeNextTo(tab,dest)?"confirmed":"unverified";
      }else{
        operation="adopt-tab";
        const all=Array.from(browser.tabs);
        const boundary=dest?.group?groupMembers(dest.group):dest?.tab?[dest.tab]:[];
        const boundaryIndex=all.indexOf(dest.before?boundary[0]:boundary.at(-1));
        if(!boundary.length||boundaryIndex<0)return;
        const index=boundaryIndex+(dest.before?0:1);
        if(!incomingDropAllowed(tab,owner,incoming,true))return;
        const adopted=browser.adoptTab(tab,{tabIndex:index,selectTab:true});
        // A new native tab in the destination proves ownership. Placement
        // can still differ when hidden/native tabs alter tabIndex semantics.
        outcome=nativeAdoptionOutcome(adopted,dest);
      }
      schedule();
    }catch(error){
      outcome="error";console.error("[OnePlane] Tab or split group move:",nocturneErrorClass(error));
    }finally{
      window.__nocturneTrace?.("drag.native.outcome",{operation,outcome},{sample:1600});
      try{markSourceHandled();}catch(error){console.error("[OnePlane] Drag source settle:",nocturneErrorClass(error));}
      if(incoming&&incomingDrag===incoming){incomingDrag=null;releaseDragReveal();}
      clearDropMarker();
      finishStripCommit();
    }
  }
  function splitDropPoint(event){
    const box=splitZone.getBoundingClientRect(),x=event.clientX,y=event.clientY;
    if(![box.left,box.top,box.width,box.height,x,y].every(Number.isFinite)||box.width<=0||box.height<=0||
      x<box.left||x>=box.left+box.width||y<box.top||y>=box.top+box.height)return null;
    return {x:(x-box.left)/box.width,y:(y-box.top)/box.height};
  }
  function splitDropAllowed(){
    return dragPhaseInputAllowed()&&splitZone.hasAttribute("data-op-dragging");
  }
  function splitSide(event) {
    if(toolbarDragReturnZone(event))return "";
    const point=splitDropPoint(event);
    if(!point)return "";
    const {x,y}=point;
    const sides = [["left", x], ["right", 1-x], ["top", y], ["bottom", 1-y]];
    sides.sort((a,b) => a[1]-b[1]);
    return sides[0][1] <= .25 ? sides[0][0] : "";
  }
  // Zen 1.24.2b splitTabs() filters hidden/empty tabs, maps Glance
  // children to parents and can duplicate pinned tabs when mixing pin roles,
  // Essentials or Live Folder items. A drag advertised as move must not
  // silently turn into a different native tab identity.
  // Native Zen owns both the internal Split data and the physical tab group.
  // Never filter invalid physical members: omission could certify partial state.
  function nativeSplitMembers(group){
    if(!group?.hasAttribute?.("split-view-group"))return null;
    let members;
    try{members=Array.from(group.tabs);}catch{return null;}
    if(members.length<2||new Set(members).size!==members.length||
       members.some(tab=>!validNativeTab(tab)||tabOwner(tab)!==window||
         splitGroup(tab)!==group||tab.splitView!==true))return null;
    return members;
  }
  function sameSplitMembers(a,b){
    return Array.isArray(a)&&Array.isArray(b)&&a.length===b.length&&
      new Set(a).size===a.length&&a.every(tab=>b.includes(tab));
  }
  function nativeSplitPostcondition(result,tab,current,before,oldGroup){
    // splitTabs() returns the Zen-owned Split data (including its tabs),
    // not a boolean certificate. Compare it to the physical group exactly.
    const group=splitGroup(tab);
    const expected=[tab,...before];
    return !!result&&group&&group===splitGroup(current)&&
      (!oldGroup||group===oldGroup)&&
      sameSplitMembers(result.tabs,expected)&&
      sameSplitMembers(nativeSplitMembers(group),expected);
  }
  function nativeUnsplitPostcondition(tab,before,oldGroup){
    if(!validNativeTab(tab)||tabOwner(tab)!==window||isSplit(tab))return false;
    const remaining=before.filter(other=>other!==tab);
    if(before.length===2){
      // Zen removes the entire two-member Split group on unsplit.
      return remaining.length===1&&remaining.every(other=>
        validNativeTab(other)&&tabOwner(other)===window&&!isSplit(other));
    }
    return sameSplitMembers(nativeSplitMembers(oldGroup),remaining);
  }
  function nativeSplitPreflight(tab,current){
    if(!validNativeTab(tab)||!validNativeTab(current)||tab===current||
       tabOwner(tab)!==window||tabOwner(current)!==window)return "native-target-stale";
    if(tab.hidden||current.hidden||
       tab.hasAttribute("zen-empty-tab")||current.hasAttribute("zen-empty-tab"))return "native-hidden-or-empty";
    if(tab.hasAttribute("zen-glance-tab")||current.hasAttribute("zen-glance-tab"))return "native-glance-remap";
    const splitter=window.gZenViewSplitter;
    if(typeof splitter?.splitTabs!=="function")return "native-split-unavailable";
    const pinned=Boolean(tab.pinned),otherPinned=Boolean(current.pinned);
    const essential=tab.hasAttribute("zen-essential")||current.hasAttribute("zen-essential");
    const folder=tab.hasAttribute("zen-live-folder-item-id")||current.hasAttribute("zen-live-folder-item-id");
    // Native Zen's splitter explicitly does not support Essentials yet.
    // Never reinterpret an Essentials command as a successful ordinary move.
    if(essential)return "native-essentials-unsupported";
    if((pinned||otherPinned)&&(folder||pinned!==otherPinned))return "native-may-clone";
    if(isSplit(current)){
      const group=splitGroup(current);
      if(!group)return "native-split-group-unready";
      const members=nativeSplitMembers(group);
      if(!members||!members.includes(current))return "native-split-group-unready";
      if(Number.isSafeInteger(splitter.MAX_TABS)&&
         members.length>=splitter.MAX_TABS)return "native-split-limit";
    }
    return "";
  }
  function splitSourceCurrent(tab,token){
    return Number.isSafeInteger(token)&&token>0&&dragLifecycle.owns(token,"tab")&&
      draggedTab===tab&&!draggedGroup&&validNativeTab(tab)&&tabOwner(tab)===window;
  }
  function onSplitDragOver(event) {
    if(retireChangedDragViewport()||!splitDropAllowed()||!splitDropPoint(event)){splitZone.removeAttribute("data-op-side");return;}
    const tab = readDraggedTab(event);
    if (!tab || tabOwner(tab) !== window || draggedGroup ||
        (tab === browser.selectedTab && !isSplit(tab))) return;
    // Zen's native splitter does not accept its empty workspace tab.
    // Keep the start-page search instead of calling splitTabs with one
    // real tab (Zen filters the empty tab out).
    if(toolbarDragReturnZone(event)){splitZone.removeAttribute("data-op-side");return;}
    const current=browser.selectedTab;
    const side=emptySplitTarget(current)?"":isSplit(tab)?"unsplit":splitSide(event);
    if(side&&(side==="unsplit"?
      !nativeSplitMembers(splitGroup(tab))?.includes(tab):
      !!nativeSplitPreflight(tab,current))){
      splitZone.removeAttribute("data-op-side");
      return;
    }
    splitZone.setAttribute("data-op-side", side);
    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = "move";
  }
  function onSplitDrop(event) {
    if(retireChangedDragViewport()||retireChangedDragChromeFrame("split-drop"))return;
    const tab=readDraggedTab(event),current=browser.selectedTab,token=nativeDragToken;
    if(!tab||tabOwner(tab)!==window||draggedGroup||
      (tab===current&&!isSplit(tab)))return;
    if(!splitDropAllowed()||!splitDropPoint(event)){
      event.preventDefault();event.stopPropagation();
      cancelActiveDrag("split-hit-rejected");return;
    }
    event.preventDefault();event.stopPropagation();
    if(!splitSourceCurrent(tab,token)){
      window.__nocturneTrace?.("drag.native.outcome",{operation:"split-source",outcome:"rejected",reason:"stale-source"},{sample:1600});
      return;
    }
    let operation="none",outcome="rejected",reason="";
    try{
      if(toolbarDragReturnZone(event)){
        operation="return-to-strip";outcome="no-op";
        schedule();return;
      }
      const side=splitSide(event);
      if(emptySplitTarget(current)){
        operation="select-empty-partner";
        browser.selectedTab=tab;
        outcome=browser.selectedTab===tab?"confirmed":"rejected";
        schedule();return;
      }
      if(isSplit(tab)){
        operation="unsplit";
        const oldGroup=splitGroup(tab),before=nativeSplitMembers(oldGroup);
        if(!before||!before.includes(tab)){outcome="unverified";reason="native-split-group-unready";return;}
        const applied=unsplitTab(tab);
        outcome=applied&&nativeUnsplitPostcondition(tab,before,oldGroup)?"confirmed":"unverified";
        if(outcome!=="confirmed")reason="native-postcondition";
        schedule();
      }else if(side){
        operation="split";
        reason=nativeSplitPreflight(tab,current);
        if(reason)return;
        const originalTabGroup=splitGroup(tab),originalTargetGroup=splitGroup(current);
        const before=originalTargetGroup?nativeSplitMembers(originalTargetGroup):[current];
        if(!before){outcome="unverified";reason="native-split-group-unready";return;}
        const first=side==="left"||side==="top";
        const grid=side==="left"||side==="right"?"vsep":"hsep";
        // Selecting the dragged tab can synchronously run Zen observers.
        // Recheck the exact source and native partners before splitTabs().
        browser.selectedTab=tab;
        if(browser.selectedTab!==tab||!splitSourceCurrent(tab,token)||
           !dragPhaseInputAllowed()||retireChangedDragViewport()||
           retireChangedDragChromeFrame("split-selection")||
           !validNativeTab(current)||tabOwner(current)!==window||
           splitGroup(tab)!==originalTabGroup||splitGroup(current)!==originalTargetGroup||
           (originalTargetGroup&&!sameSplitMembers(nativeSplitMembers(originalTargetGroup),before))){
          outcome="unverified";reason="selection-retargeted";
          if(splitSourceCurrent(tab,token)&&browser.selectedTab===tab&&validNativeTab(current)&&
             tabOwner(current)===window&&splitGroup(tab)===originalTabGroup&&
             splitGroup(current)===originalTargetGroup&&
             (!originalTargetGroup||sameSplitMembers(nativeSplitMembers(originalTargetGroup),before)))
            browser.selectedTab=current;
          return;
        }
        const result=window.gZenViewSplitter.splitTabs(first?[tab,current]:[current,tab],grid,first?0:1);
        const confirmed=nativeSplitPostcondition(result,tab,current,before,originalTargetGroup);
        const unchanged=splitGroup(tab)===originalTabGroup&&
          splitGroup(current)===originalTargetGroup&&!isSplit(tab)&&
          (!originalTargetGroup||sameSplitMembers(nativeSplitMembers(originalTargetGroup),before));
        outcome=confirmed?"confirmed":result||!unchanged?"unverified":"rejected";
        if(outcome==="unverified")reason="native-postcondition";
        // Only restore the earlier pane if Zen performed no split at all.
        // Never rollback partially changed native Split state.
        if(!result&&!isSplit(tab)&&!isSplit(current)&&validNativeTab(current)&&
           tabOwner(current)===window&&browser.selectedTab===tab)browser.selectedTab=current;
        schedule();
      }else if(validNativeTab(tab)){
        operation="select";
        browser.selectedTab=tab;
        outcome=browser.selectedTab===tab?"confirmed":"rejected";
        schedule();
      }
    }catch(error){
      outcome="error";
      // A thrown native command may already have mutated Split state.
      // Do not restore selection against a partial native transaction.
      if(!isSplit(tab)&&!isSplit(current)&&validNativeTab(current)&&
         tabOwner(current)===window&&browser.selectedTab===tab)browser.selectedTab=current;
      console.error("[OnePlane] Split View:",nocturneErrorClass(error));
    }finally{
      window.__nocturneTrace?.("drag.native.outcome",{operation,outcome,...(reason?{reason}:{})},{sample:1600});
      // Only the captured source may complete this delivered OS drop.
      // If native callbacks replaced/cancelled it, never clear new visuals.
      if(splitSourceCurrent(tab,token)){
        try{sourceHandled(tab,false,token);}
        catch(error){console.error("[OnePlane] Split drop source settle:",nocturneErrorClass(error));}
        if(dragLifecycle.owns(token,"tab"))cancelActiveDrag("split-settle-incomplete");
      }
    }
  }
  function onDragEnd(event, tab) {
    if(!event?.isTrusted||!dragEndMatches(nativeDragIdentity,event,tab)||
      nativeDragIdentity?.token!==nativeDragToken||!dragLifecycle.owns(nativeDragToken,"tab")||retireChangedDragViewport()||
      retireChangedDragChromeFrame("dragend")||retireBlockedNativeTabDrag("dragend-phase")||
      retireChangedNativeDragTopology("dragend"))return;
    const dt = event.dataTransfer;
    // Ignore late or duplicate dragend after cancel/handled drop.
    const placement=placementAt(event,true);
    const returned=!placement&&pointInSourceWindow(event)&&(dragDetachedOnce||dragBunnyLayout)&&toolbarDragReturnZone(event);
    typeof window!=="undefined"&&window.__nocturneTrace?.("drag.end",()=>({returned,placement:!!placement,detached:dragDetachedOnce,handled:dragHandled,drop:dt?.dropEffect,cancelled:!!dt?.mozUserCancelled}),{sample:1800});
    const finishedToken=nativeDragToken;
    if(!finishNativeDragLifecycle(event,tab))return;
    const handled = dragHandled;
    const wasGroup = Boolean(draggedGroup);
    const start = dragStartPoint;
    if(returned&&!dt?.mozUserCancelled)prepareBunnyDrop(event);
    const keep=returned&&!dt?.mozUserCancelled&&dragImageMode==="inline"&&!!dragInsertAnimation;
    draggedTab = null; draggedGroup = null; dragHandled = false; dragStartPoint = null;
    try{if(keep)finishInsertionAfterDrop();else endDragVisual(returned&&!dt?.mozUserCancelled);}
    finally{clearSourceIncoming(finishedToken);}
    if (returned || wasGroup || !start || handled || dt?.mozUserCancelled || dt?.dropEffect !== "none" ||
        !validNativeTab(tab) || tabOwner(tab) !== window) return;
    // A cancelled drag or a drop within this window must never create
    // another window. screenX/Y are browser-chrome desktop CSS coordinates.
    const x = event.screenX, y = event.screenY;
    if (!Number.isFinite(x) || !Number.isFinite(y) || (x === 0 && y === 0) ||
        Math.hypot(x-start.x,y-start.y) < 12) return;
    const inside=!placement&&pointInSourceWindow(event);
    if (inside) {
      if(!toolbarContainsPoint(event.clientX,event.clientY)&&emptySplitTarget(browser.selectedTab))browser.selectedTab=tab;
      return;
    }
    try {
      // Native session adoption preserves the live browser, history, audio
      // and private-window state. Zen chooses its native window-sync mode.
      const p=placement;
      const seed=p?nativeStartupFeatures(p):null;
      if(displaySnapEnabled()&&!seed){logPlacement("tab-release-unverified",p);return;}
      if (isSplit(tab) && !unsplitTab(tab)) return;
      if(seed)logPlacement("tab-open",p,null,seed);
      const win=browser.replaceTabWithWindow(tab,{replaceLastTab:true,...(seed||{})});
      if(win&&p)placeAfterStartup(win,p);
    } catch (error) { console.error("[OnePlane] Detach tab:",nocturneErrorClass(error)); }
  }
  const dragController = {
    source: () => draggedTab,
    sourceToken: () => nativeDragToken,
    topologyCurrent: () => nativeDragTopologyCurrent(),
    retireTopology: () => retireChangedNativeDragTopology("remote-drop"),
    group: () => draggedGroup,
    outside: event => setDragImageMode("outside",event),
    preview: event => {if(draggedTab&&!draggedGroup)showPlacementPreview(event,"Tab");},
    clearIncoming: (source,token) => {
      const lease=incomingDrag;
      if(dead||!lease||lease.source!==source||lease.token!==token)return;
      clearIncomingDrag("source-ended",lease);
    },
    markHandled: (finishReturn=false,expectedToken=null,destination=null) => {
      if(expectedToken!==null&&expectedToken!==nativeDragToken)return;
      const finishedToken=nativeDragToken;
      if(!finishNativeDragLifecycle())return;
      dragHandled = true;
      const keep=finishReturn&&dragImageMode==="inline"&&!!dragInsertAnimation;
      try{
        if(!keep)endDragVisual(finishReturn);
        draggedTab = null;
        draggedGroup = null;
        dragStartPoint=null;
        // This delivered drop was consumed; its native result may be
        // confirmed, unverified or rejected by the destination. Only the
        // isolated return visual can survive a finished drag session.
        if(keep)finishInsertionAfterDrop();
      }finally{clearSourceIncoming(finishedToken,destination);}
    }
  };

  // Single hover target; preserve momentum across tabs and short gaps.
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const clamp = (x, min, max) => Math.max(min, Math.min(max, x));
  let hoverTab = null, hoverX = null, hoverTimer = 0, indicatorFrame = 0;
  let lastHoverPointer = null, indicatorHover = null, indicatorReturnTimer = 0;
  const INDICATOR_RETURN_DELAY = 2000;
  function cancelIndicatorReturn(){
    if(indicatorReturnTimer)window.clearTimeout(indicatorReturnTimer);
    indicatorReturnTimer=0;
  }
  let indicatorShown = false, ix = 0, iy = 0, iw = 14, ih = 3, iv = 0, last = 0, until = 0;
  const hoverDelay = () => reducedMotion.matches ? 0 :
    clamp(prefs.getIntPref("zen.oneplane.hover-close-delay", 260), 0, 600);

  function cancelHoverTimer() {
    if (hoverTimer) window.clearTimeout(hoverTimer);
    hoverTimer = 0;
  }
  function pullIndicatorFactor(progress){
    const t=Math.max(0,Math.min(1,(progress-.06)/.56));
    return (1-t)*(1-t);
  }
  function indicatorTarget() {
    const s=row.getBoundingClientRect();
    if(s.width<=0||s.height<=0||row.hasAttribute("data-op-lane-drag")||row.hasAttribute("data-op-overflow-row"))return null;
    const dragging=Boolean(dragNode && row.hasAttribute("data-op-dragging"));
    const homeOpen=row.hasAttribute("data-op-home-open");
    const item=dragging?dragNode:indicatorHover && list.contains(indicatorHover)?
      indicatorHover:homeOpen?null:entries.get(browser.selectedTab)?.item;
    if(!item||!list.contains(item)||item.hasAttribute("data-op-detached")||
        item.closest(".oneplane-split-group[data-op-detached]"))return null;
    if(dragging && (dragImageMode!=="inline" || dragPull>=.62 || dragNode.hasAttribute("data-op-reinsert") || row.hasAttribute("data-op-magnetic-pull")))return null;
    // For a shrinking group use the visible ghost rather than its
    // invisible layout placeholder when determining vertical clearance.
    const visual=dragging && dragPull>0 && draggedGroup && dragGhost &&
      !dragGhost.hidden && dragGhostBody ? dragGhostBody : item;
    let a=visual.getBoundingClientRect(),center=(a.left+a.right)/2;
    if(a.width<=0)return null;
    // A scrolled-off card must not paint its underline over Home or controls.
    if(!dragging){
      const lane=item.closest(".oneplane-island-lane")||list;
      const clip=lane.getBoundingClientRect();
      if(clip.width>0&&(center<clip.left+3||center>clip.right-3))return null;
    }
    let w=clamp(a.width*.14,12,18),h=3;
    if(dragging){
      if(draggedGroup){
        const members=Array.from(item.querySelectorAll(".oneplane-tab"));
        if(dragPull===0 && members.length){
          const first=members[0].getBoundingClientRect(),last=members.at(-1).getBoundingClientRect();
          center=(first.left+last.right)/2;
          w=Math.max(12,last.right-first.left-4);
        }else{
          center+=10*(1-dragPull);
          w=Math.max(12,dragWidth-22-4);
        }
      }
      const factor=pullIndicatorFactor(dragPull);
      // Collapse before the descending card can intersect the underline.
      const clearance=s.bottom-a.bottom-2;
      const visibility=Math.min(factor,clamp(clearance/5,0,1));
      if(visibility<.015)return null;
      w*=visibility;h*=visibility;
      return {x:center-s.left-row.clientLeft,y:Math.min(s.height-2,a.bottom-s.top+3),
        w,h,drag:true,pulling:dragPull>0};
    }
    const bias=item!==indicatorHover||hoverX===null?0:
      clamp((hoverX-center)/Math.max(1,a.width/2),-1,1);
    return {x:center-s.left-row.clientLeft+bias*Math.min(12,a.width*.12),
      y:Math.min(s.height-2,a.bottom-s.top+2),w,h};
  }
  function paintIndicator() {
    const tail = clamp(iv * .0035, -5, 5);
    indicator.style.width = iw.toFixed(2) + "px";
    indicator.style.height = ih.toFixed(2) + "px";
    indicator.style.transform = "translate3d(" + (ix - iw / 2 - tail).toFixed(2) +
      "px," + (iy - ih / 2).toFixed(2) + "px,0)";
  }
  function tickIndicator(now) {
    indicatorFrame = 0;
    const p = indicatorTarget();
    if (dead || !p || !indicatorShown) { hideIndicator(); return; }
    const dt = last ? clamp((now - last) / 1000, .001, .05) : 1 / 60;
    last = now;
    if(p.drag){
      // Track the painted drag card directly, with no horizontal spring
      // lag. The width expands quickly on pickup, but collapses without
      // lag during the pull so the indicator cannot cross the card.
      ix=p.x;iy=p.y;iv=0;
      const blend=reducedMotion.matches||p.pulling?1:1-Math.exp(-28*dt);
      iw+=(p.w-iw)*blend;ih=p.h;
    } else if (reducedMotion.matches) {
      ix = p.x; iy = p.y; iv = 0; iw = p.w; ih = p.h;
    } else {
      const steps = Math.max(1, Math.ceil(dt * 120)), step = dt / steps;
      for (let i = 0; i < steps; i++) {
        iv += (p.x - ix) * 350 * step;
        iv *= Math.exp(-23 * step);
        ix += iv * step;
      }
      const stretch = Math.min(18, Math.abs(iv) * .025);
      const blend = 1 - Math.exp(-24 * dt);
      iw += (p.w + stretch - iw) * blend;
      ih += (3 - stretch * .035 - ih) * blend;
      iy += (p.y - iy) * (1 - Math.exp(-30 * dt));
    }
    paintIndicator();
    if (p.drag || (!reducedMotion.matches && (now < until || Math.abs(ix-p.x) > .08 ||
        Math.abs(iy-p.y) > .08 || Math.abs(iv) > .2 || Math.abs(iw-p.w) > .08 ||
        Math.abs(ih-p.h) > .04))) {
      indicatorFrame = window.requestAnimationFrame(tickIndicator);
    }
  }
  function scheduleIndicator() {
    if (!indicatorShown || dead) return;
    until = window.performance.now() + 450;
    if (!indicatorFrame) { last = 0; indicatorFrame = window.requestAnimationFrame(tickIndicator); }
  }
  const indicatorPreferenceObserver = { observe() { refreshIndicator(); } };
  function hideIndicator() {
    indicatorShown = false;
    indicator.removeAttribute("data-visible");
    if (indicatorFrame) window.cancelAnimationFrame(indicatorFrame);
    indicatorFrame = 0; iv = 0; last = 0;
  }
  function refreshIndicator(force=false) {
    if(cascadeState!=="idle"&&force!==true)return;
    if (dead || !prefs.getBoolPref("zen.oneplane.tab-indicator", true)) {
      hideIndicator(); return;
    }
    const p = indicatorTarget();
    if (!p) { hideIndicator(); return; }
    if (!indicatorShown) {
      ix=p.x; iy=p.y; iw=p.w; ih=p.h; iv=0;
      paintIndicator();
      indicatorShown=true;
      indicator.setAttribute("data-visible","true");
    }
    scheduleIndicator();
  }
  // OnePlane-only trigger and Compact Mode adapter; core is host-neutral.
  let homeLease=null, homeUnsubscribe=null, homeStartupRecord=null, homeIdleTimer=0, homeIdle=false, homeTitleKey=null, homeNativeTitle="";
  function clearHomeIdle(){if(homeIdleTimer)window.clearTimeout(homeIdleTimer);homeIdleTimer=0;}
  function markHomeTitleActivity(){
    clearHomeIdle();homeIdle=false;if(!homeLease||homeLease.open)return;
    homeIdleTimer=window.setTimeout(()=>{homeIdleTimer=0;homeIdle=true;refreshIslandTitle();},5000);
  }
  function mountHome(){
    typeof window!=="undefined"&&window.__nocturneTrace?.("home.mount",()=>(null),{sample:1800});
    try{homeLease=acquireZenHome(window,Services);}catch(error){console.warn("[OnePlane] Home unavailable",nocturneErrorClass(error));}
    island.toggleAttribute("data-op-home-enabled",!!homeLease);island.disabled=!homeLease;
    const startup=homeStartupRecord=window.__nocturneLayoutStartup;
    if(startup?.initial)startup.homeState=homeLease&&!window.__oneplaneWorkspaceProjection?"pending":"skipped";
    if(!homeLease)return;
    homeUnsubscribe=homeLease.subscribe(open=>{
      row.toggleAttribute("data-op-home-open",open);island.setAttribute("aria-expanded",String(open));
      url.toggleAttribute("data-op-home",open);
      toolbarWrapper?.toggleAttribute("oneplane-home-hold",open);
      // Update the mirror and geometry without changing native tab selection.
      if(open){clearTabHover();hideIndicator();}
      centerToolbar();schedule();scheduleGeometry();refreshIndicator();
      if(open){clearHomeIdle();homeIdle=true;}else markHomeTitleActivity();
      refreshIslandTitle();reconcilePanel();
    });
    island.addEventListener("click",onHomeTrigger);island.addEventListener("dblclick",stopHomeDoubleClick);island.addEventListener("pointerdown",stopHomePointer);
    window.addEventListener("OnePlane:StartupState",onHomeStartup);
  }
  async function onHomeStartup(){
    if(root.getAttribute("data-op-startup-ready")!=="true")return;
    window.removeEventListener("OnePlane:StartupState",onHomeStartup);
    const startup=window.__nocturneLayoutStartup,lease=homeLease,selected=browser.selectedTab;
    let outcome="skipped";
    const current=()=>!dead&&!disposed&&!reloadingLayout&&!window.closed&&
      !window.__oneplaneWorkspaceProjection&&hoverSupported()&&browser.selectedTab===selected&&
      homeLease===lease&&window.__nocturneLayoutStartup===startup;
    // Assembly owns the launch boundary. A late search-service promise
    // cannot auto-open Home after that boundary (or after an abort).
    // With Assembly disabled/absent, retain the existing native startup path.
    const beforeReveal=()=>!window.__zenRefinedStartupAnimationSeen||
      !!window.__zenRefinedStartupAnimation&&!window.__nocturneStartupTimeline;
    try{
      if(!lease||!current()||!beforeReveal())return;
      if(lease.open){outcome="ready";return;}
      if(Services.search&&!Services.search.isInitialized)await Services.search.init();
      if(!current()||!beforeReveal())return;
      if(lease.open){outcome="ready";return;}
      if(lease.showOnStartup?.())outcome="ready";
    }catch(error){outcome="failed";window.console.warn("[OnePlane] Startup search initialization:",nocturneErrorClass(error));}
    finally{
      if(startup&&window.__nocturneLayoutStartup===startup){
        startup.homeState=outcome;
        try{window.__nocturneTrace?.("home.startup.ready",{state:outcome},{flush:true});}catch{}
      }
    }
  }
  function stopHomeDoubleClick(e){e.preventDefault();e.stopPropagation();}
  function stopHomePointer(e){e.stopPropagation();}
  function onHomeTrigger(e){
    e.stopPropagation();
    if(!hoverSupported()||cascadeState!=="idle"||row.hasAttribute("data-op-dragging"))return;
    homeLease?.show();
  }
  function destroyHome(){
    typeof window!=="undefined"&&window.__nocturneTrace?.("home.destroy",()=>(null),{sample:1800});
    const startup=homeStartupRecord;homeStartupRecord=null;
    if(startup?.homeState==="pending"&&window.__nocturneLayoutStartup===startup)startup.homeState="skipped";
    clearHomeIdle();homeUnsubscribe?.();homeUnsubscribe=null;
    window.removeEventListener("OnePlane:StartupState",onHomeStartup);
    island.removeEventListener("click",onHomeTrigger);island.removeEventListener("dblclick",stopHomeDoubleClick);island.removeEventListener("pointerdown",stopHomePointer);
    url.removeAttribute("data-op-home");
    toolbarWrapper?.removeAttribute("oneplane-home-hold");homeLease?.release();homeLease=null;
  }

  let islandTextAnimation = null, islandTextTarget = null;
  // One owner for all label changes. Keep the old label until it has
  // faded; commit the newest target only if this transaction still owns it.
  function setIslandTitle(title,animate){
    if(islandTextTarget===title)return;
    islandTextAnimation?.cancel();
    const previous=islandTitle.textContent;
    islandTextTarget=title;island.title=title;
    if(!animate||!previous||!title||previous===title){
      islandTitle.textContent=title;return;
    }
    const phase=root.getAttribute("data-zr-workspace-phase");
    const duration=phase==="in"?280:150;
    let effect=null,cancelled=false;
    const token={cancel(){
      cancelled=true;try{effect?.cancel();}catch{}
      if(islandTextAnimation===token){islandTextAnimation=null;islandTextTarget=null;}
    }};
    islandTextAnimation=token;
    const finish=()=>{
      if(cancelled||islandTextAnimation!==token)return;
      islandTitle.textContent=title;try{effect?.cancel();}catch{}
      islandTextAnimation=null;
    };
    window.__nocturneTrace?.("island.title.motion",{phase,changed:true,duration},{sample:500});
    try{
      // Normal hover/selection stays immediate, as before. Only the
      // workspace transition defers the label commit until the old fade.
      if(phase!=="in"){
        islandTitle.textContent=title;
        effect=islandTitle.animate([{opacity:.35,translate:"0 2px"},{opacity:1,translate:"0 0"}],
          {duration,easing:"ease-out"});
        effect.finished.then(finish,finish);return;
      }
      effect=islandTitle.animate([{opacity:1,translate:"0 0"},{opacity:0,translate:"0 -2px"}],
        {duration:Math.round(duration*.36),easing:"ease-in",fill:"both"});
      effect.finished.then(()=>{
        if(cancelled||dead||islandTextAnimation!==token)return;
        const old=effect;islandTitle.textContent=title;
        effect=islandTitle.animate([{opacity:0,translate:"0 2px"},{opacity:1,translate:"0 0"}],
          {duration:Math.round(duration*.64),easing:"ease-out",fill:"both"});
        old.cancel();return effect.finished.then(finish,finish);
      }).catch(finish);
    }catch{finish();}
  }
  function refreshIslandTitle(){
    if(dead || !row.hasAttribute("data-op-show-island")) return;
    const item=dragNode && row.hasAttribute("data-op-dragging")?dragNode:
      indicatorHover && list.contains(indicatorHover)?indicatorHover:entries.get(browser.selectedTab)?.item;
    const nativeTitle=item?.classList.contains("oneplane-split-group")?
      Array.from(item.querySelectorAll(".oneplane-tab-title")).map(n=>n.textContent).filter(Boolean).join(" · "):
      item?.querySelector(".oneplane-tab-title")?.textContent || "";
    const key=item||null;
    if(homeLease && (homeTitleKey!==key || homeNativeTitle!==nativeTitle)){homeTitleKey=key;homeNativeTitle=nativeTitle;markHomeTitleActivity();}
    const title=homeLease&&(homeLease.open||homeIdle||!nativeTitle)?"Home":nativeTitle;
    const phase=root.getAttribute("data-zr-workspace-phase");
    // Native selection may change several times during a workspace swap.
    // Only the settled incoming selection may replace the visible label.
    if(phase==="out"||phase==="swap")return;
    const animate=cascadeState==="idle"&&!root.hasAttribute("data-zr-startup-phase")&&!root.hasAttribute("data-zr-closing")&&
      !reducedMotion.matches&&prefs.getIntPref("zen.oneplane.animation-duration",160)!==0;
    setIslandTitle(title,animate);
  }
  let hoverModePending=false;
  function applyHoverMode(){
    if(dead)return;
    if(restingGeometryBlocked()){hoverModePending=true;return;}
    hoverModePending=false;
    const mode=prefs.getIntPref("zen.oneplane.hover-mode",0)===1?"island":"expand";
    const titleMode=mode==="island" && prefs.getBoolPref("zen.oneplane.show-center-island",true);
    const show=titleMode||!!homeLease;
    row.toggleAttribute("data-op-home-icon",show&&!titleMode);
    if(row.getAttribute("data-op-hover-mode")===mode && row.hasAttribute("data-op-show-island")===show){scheduleGeometry();return;}
    clearTabHover();
    row.setAttribute("data-op-hover-mode",mode);
    row.toggleAttribute("data-op-show-island",show);
    if(!show) row.removeAttribute("data-op-island-tight");
    placeStripOrder(stripNodes());
    refreshIslandTitle();
    scheduleGeometry();
    schedule();
  }
  const hoverModePreferenceObserver={observe(){applyHoverMode();}};
  function selectHover(item, x = null) {
    if (root.hasAttribute("data-zr-center-motion")||root.hasAttribute("data-zr-closing")||root.hasAttribute("data-zr-workspace-phase") || cascadeState!=="idle" || !item || !list.contains(item)) return;
    cancelHoverTimer();
    cancelIndicatorReturn();
    hoverX = x;
    if (hoverTab !== item) {
      hoverTab?.removeAttribute("data-op-expanded");
      hoverTab?.removeAttribute("data-op-hovered");
      hoverTab = item;
      item.setAttribute("data-op-hovered", "true");
      item.toggleAttribute("data-op-expanded",row.getAttribute("data-op-hover-mode")!=="island");
      window.__nocturneTrace?.("tabs.hover",()=>({mode:row.getAttribute("data-op-hover-mode"),lower:item.closest(".oneplane-overflow-lane")===bottomLane,group:!!item.closest(".oneplane-split-group")}),{sample:800,throttle:100});
    }
    indicatorHover = item;
    refreshIndicator();
    refreshIslandTitle();
  }
  function clearTabHover(keepIndicator=false) {
    cancelHoverTimer();
    hoverTab?.removeAttribute("data-op-expanded");
    hoverTab?.removeAttribute("data-op-hovered");
    hoverTab = null; hoverX = null; lastHoverPointer = null;
    if(keepIndicator===true)releaseIndicatorHover();
    else {cancelIndicatorReturn();indicatorHover=null;}
    refreshIndicator();
    refreshIslandTitle();
  }
  function queueTabCollapse() {
    if (cascadeState!=="idle" || !hoverTab || hoverTimer) return;
    hoverTimer = window.setTimeout(() => {
      hoverTimer = 0;
      // Keep the plus stationary until the pointer actually leaves it.
      if (plus.matches(":hover") || plus.matches(":active")) return;
      clearTabHover(true);
    }, hoverDelay());
  }
  function pointOverTabStrip(event) {
    return [list,...(bottomLane.hidden?[]:[bottomLane])].some(l=>{
      const a=l.getBoundingClientRect();
      return a.width>0&&a.height>0&&event.clientX>=a.left-3&&event.clientX<=a.right+3&&event.clientY>=a.top-2&&event.clientY<=a.bottom+2;
    });
  }
  function releaseIndicatorHover() {
    if(!indicatorHover||indicatorReturnTimer)return;
    indicatorReturnTimer=window.setTimeout(()=>{
      indicatorReturnTimer=0;indicatorHover=null;hoverX=null;
      if(!dead){refreshIndicator();refreshIslandTitle();}
    },INDICATOR_RETURN_DELAY);
  }
  function indicatorSelectionChanged(){
    // An explicit selection during the cooldown should retarget from the
    // held position to the newly selected tab, not wait for the old timer.
    if(!indicatorReturnTimer)return;
    cancelIndicatorReturn();indicatorHover=null;hoverX=null;refreshIndicator();refreshIslandTitle();
  }
  function trackTabPointer(event) {
    if(event.pointerType==="touch"||root.hasAttribute("data-zr-workspace-phase"))return;
    const pointNow={x:event.clientX,y:event.clientY};
    if(cascadeState!=="idle"){cascadePointer=pointNow;return;}
    if(cascadePointer){
      if(Math.hypot(pointNow.x-cascadePointer.x,pointNow.y-cascadePointer.y)<1)return;
      cascadePointer=null;
    }
    if (!hoverSupported() || draggedTab || root.hasAttribute("data-zr-startup-phase")) return;
    if(event.target?.closest?.(".oneplane-title-island")===island){
      if(hoverTab||indicatorHover)clearTabHover();
      return;
    }
    const hit = event.target?.closest?.(".oneplane-tab");
    if (hit && list.contains(hit)) {
      const point = {x:event.clientX,y:event.clientY};
      // Ignore synthetic retargets from geometry changes under a stationary mouse.
      if (hoverTab && hoverTab !== hit && lastHoverPointer &&
          Math.hypot(point.x-lastHoverPointer.x,point.y-lastHoverPointer.y) < 1) return;
      lastHoverPointer = point;
      selectHover(hit,event.clientX); return;
    }
    if (event.target === plus || (event.target instanceof Node && plus.contains(event.target))) {
      releaseIndicatorHover();
      cancelHoverTimer(); return;
    }
    // Gaps, split handles and group padding are part of the same hover
    // session. Do not briefly retarget the selected tab in these areas.
    if (pointOverTabStrip(event)) {
      cancelHoverTimer(); return;
    }
    releaseIndicatorHover();
    queueTabCollapse();
  }
  function focusTab(event) {
    if(cascadeState!=="idle"||root.hasAttribute("data-zr-startup-phase"))return;
    const item = event.target?.closest?.(".oneplane-tab");
    if (item && event.target.matches(":focus-visible")) selectHover(item);
  }
  function blurTab(event) {
    if (!row.contains(event.relatedTarget) && !row.matches(":hover")) queueTabCollapse();
  }
  function leaveTabPointer(event) {
    // The translated strip can extend beyond the row's original box.
    // A pointerleave from the plus or row is not necessarily a departure.
    if (cascadeState!=="idle" || (event && pointOverTabStrip(event))) return;
    releaseIndicatorHover();
    queueTabCollapse();
  }
  // Scroll only the viewport beneath the pointer, never the other lane
  // or the web page. A trackpad's horizontal axis takes precedence.
  function onLaneWheel(event){
    const lane=event.currentTarget;
    // The list is a grid wrapper while centered lanes are active. It must
    // never consume an event bubbling from a non-overflowing child lane.
    if(lane===list&&row.hasAttribute("data-op-show-island")&&!row.hasAttribute("data-op-island-tight"))return;
    if(!hoverSupported()||cascadeState!=="idle"||restingGeometryBlocked()||root.hasAttribute("data-zr-center-motion")||
       event.ctrlKey||event.metaKey||lane.scrollWidth<=lane.clientWidth+1)return;
    const raw=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
    if(!raw||!Number.isFinite(raw))return;
    const unit=event.deltaMode===1?32:event.deltaMode===2?lane.clientWidth:1;
    event.preventDefault();event.stopPropagation();
    if(lane.id==="oneplane-overflow-tabs")scrollOverflowBy(raw*unit,event.deltaMode===0&&Math.abs(event.deltaX)>Math.abs(event.deltaY));
    else lane.scrollLeft+=raw*unit;
    refreshIndicator();
  }
  let leftScrollMax=null;
  function syncLaneScroll(){
    if(!row.hasAttribute("data-op-show-island")||row.hasAttribute("data-op-island-tight")||
       row.hasAttribute("data-op-dragging")||!leftLane.clientWidth)return;
    const max=Math.max(0,leftLane.scrollWidth-leftLane.clientWidth);
    // The first overflowing left lane reveals its center-facing edge.
    // Preserve a manually scrolled position when subsequent tabs arrive.
    if(leftScrollMax===null||leftScrollMax<=1||Math.abs(leftLane.scrollLeft-leftScrollMax)<=1)
      leftLane.scrollLeft=max;
    leftScrollMax=max;
  }
  function onNewTabClick() { clearTabHover(); }


  let overflowSliderFrame=0,overflowSliderUntil=0;
  let overflowMotionFrame=0,overflowMotion=null,overflowPointer=null;
  function cancelOverflowMotion(){
    if(overflowMotionFrame)window.cancelAnimationFrame(overflowMotionFrame);
    overflowMotionFrame=0;overflowMotion=null;
  }
  function overflowMotionAllowed(){
    return !dead&&!bottomLane.hidden&&cascadeState==="idle"&&!restingGeometryBlocked()&&!root.hasAttribute("data-zr-center-motion");
  }
  function tickOverflowMotion(now){
    overflowMotionFrame=0;
    if(!overflowMotion||!overflowMotionAllowed()){cancelOverflowMotion();return;}
    const m=overflowMotion,max=Math.max(0,bottomLane.scrollWidth-bottomLane.clientWidth);
    const target=Math.max(0,Math.min(max,m.target)),elapsed=Math.max(0,now-m.startTime);
    bottomLane.scrollLeft=overflowScrollEase(m.start,target,elapsed,m.duration);
    refreshOverflowSlider();
    if(!overflowMotion)return;
    if(elapsed<m.duration&&Math.abs(bottomLane.scrollLeft-target)>.5)
      overflowMotionFrame=window.requestAnimationFrame(tickOverflowMotion);
    else{bottomLane.scrollLeft=target;cancelOverflowMotion();refreshOverflowSlider();}
  }
  function scrollOverflowTo(target,direct=false){
    if(!overflowMotionAllowed())return;
    const max=Math.max(0,bottomLane.scrollWidth-bottomLane.clientWidth);
    target=Math.max(0,Math.min(max,target));
    cancelOverflowMotion();
    if(direct||reducedMotion.matches||prefs.getIntPref("zen.oneplane.animation-duration",160)===0||Math.abs(target-bottomLane.scrollLeft)<1){
      bottomLane.scrollLeft=target;refreshOverflowSlider();return;
    }
    overflowMotion={start:bottomLane.scrollLeft,target,startTime:window.performance.now(),duration:145};
    overflowMotionFrame=window.requestAnimationFrame(tickOverflowMotion);
  }
  function scrollOverflowBy(delta,direct=false){
    const from=direct?bottomLane.scrollLeft:overflowMotion?.target??bottomLane.scrollLeft;
    scrollOverflowTo(from+delta,direct);
  }
  function onOverflowPointerDown(event){
    if(event.button!==0||!overflowMotionAllowed())return;
    cancelOverflowMotion();
    const r=overflowSlider.getBoundingClientRect(),m=overflowScrollMetrics(bottomLane.clientWidth,bottomLane.scrollWidth,bottomLane.scrollLeft);
    const center=r.left+m.thumb/2+m.position*Math.max(0,r.width-m.thumb);
    overflowPointer={id:event.pointerId,x:event.clientX,direct:Math.abs(event.clientX-center)<=m.thumb/2+2};
  }
  function onOverflowPointerMove(event){
    if(!overflowPointer||overflowPointer.id!==event.pointerId||overflowPointer.direct)return;
    if(Math.abs(event.clientX-overflowPointer.x)>3){
      overflowPointer.direct=true;cancelOverflowMotion();
    }
  }
  function onOverflowPointerEnd(event){
    if(overflowPointer?.id===event.pointerId)overflowPointer=null;
  }
  function refreshOverflowSlider(){
    if(dead)return;
    const m=overflowScrollMetrics(bottomLane.clientWidth,bottomLane.scrollWidth,bottomLane.scrollLeft);
    overflowSlider.hidden=bottomLane.hidden||!row.hasAttribute("data-op-overflow-row")||!m.visible;
    if(overflowSlider.hidden){cancelOverflowMotion();return;}
    const width=m.thumb.toFixed(2)+"px";
    if(overflowSlider.style.getPropertyValue("--op-scroll-thumb")!==width)overflowSlider.style.setProperty("--op-scroll-thumb",width);
    if(Number(overflowSlider.value)!==m.value)overflowSlider.value=String(m.value);
    const label=Math.round(m.position*100)+"% scrolled";
    if(overflowSlider.getAttribute("aria-valuetext")!==label)overflowSlider.setAttribute("aria-valuetext",label);
  }
  function onOverflowSliderInput(){
    if(!overflowMotionAllowed())return;
    const m=overflowScrollMetrics(bottomLane.clientWidth,bottomLane.scrollWidth,bottomLane.scrollLeft);
    scrollOverflowTo(m.max*Number(overflowSlider.value)/1000,overflowPointer?.direct===true);
  }
  function onOverflowSliderWheel(event){
    if(event.ctrlKey||event.metaKey||!overflowMotionAllowed())return;
    const m=overflowScrollMetrics(bottomLane.clientWidth,bottomLane.scrollWidth,bottomLane.scrollLeft);
    if(!m.visible)return;
    const raw=Math.abs(event.deltaX)>Math.abs(event.deltaY)?event.deltaX:event.deltaY;
    if(!raw)return;
    event.preventDefault();event.stopPropagation();
    scrollOverflowBy(raw*(event.deltaMode===1?32:event.deltaMode===2?bottomLane.clientWidth:1),
      event.deltaMode===0&&Math.abs(event.deltaX)>Math.abs(event.deltaY));
  }
  function onOverflowSliderEnter(){if(hoverTab||indicatorHover)clearTabHover();}
  function onOverflowSliderDragStart(event){event.preventDefault();event.stopPropagation();}
  function tickOverflowSlider(now){
    overflowSliderFrame=0;if(dead)return;
    refreshOverflowSlider();
    if(!bottomLane.hidden&&now<overflowSliderUntil)overflowSliderFrame=window.requestAnimationFrame(tickOverflowSlider);
  }
  function onOverflowWidthTransition(event){
    if(bottomLane.hidden||!["width","flex-basis","max-width","--op-hover-progress"].includes(event.propertyName))return;
    if(event.type==="transitionrun"){
      overflowSliderUntil=window.performance.now()+500;
      if(!overflowSliderFrame)overflowSliderFrame=window.requestAnimationFrame(tickOverflowSlider);
    }else refreshOverflowSlider();
  }
  function mountOverflowSlider(){
    overflowSlider.addEventListener("input",onOverflowSliderInput);
    overflowSlider.addEventListener("pointerdown",onOverflowPointerDown);
    window.addEventListener("pointermove",onOverflowPointerMove,true);
    window.addEventListener("pointerup",onOverflowPointerEnd,true);
    window.addEventListener("pointercancel",onOverflowPointerEnd,true);
    window.addEventListener("blur",cancelOverflowPointer);
    overflowSlider.addEventListener("wheel",onOverflowSliderWheel,{passive:false});
    overflowSlider.addEventListener("pointerenter",onOverflowSliderEnter);
    overflowSlider.addEventListener("dragstart",onOverflowSliderDragStart);
    bottomLane.addEventListener("scroll",refreshOverflowSlider,{passive:true});
    for(const type of ["transitionrun","transitionend","transitioncancel"])bottomLane.addEventListener(type,onOverflowWidthTransition);
  }
  function cancelOverflowPointer(){overflowPointer=null;cancelOverflowMotion();}
  function destroyOverflowSlider(){
    cancelOverflowPointer();
    if(overflowSliderFrame)window.cancelAnimationFrame(overflowSliderFrame);
    overflowSliderFrame=0;
    overflowSlider.removeEventListener("input",onOverflowSliderInput);
    overflowSlider.removeEventListener("pointerdown",onOverflowPointerDown);
    window.removeEventListener("pointermove",onOverflowPointerMove,true);
    window.removeEventListener("pointerup",onOverflowPointerEnd,true);
    window.removeEventListener("pointercancel",onOverflowPointerEnd,true);
    window.removeEventListener("blur",cancelOverflowPointer);
    overflowSlider.removeEventListener("wheel",onOverflowSliderWheel);
    overflowSlider.removeEventListener("pointerenter",onOverflowSliderEnter);
    overflowSlider.removeEventListener("dragstart",onOverflowSliderDragStart);
    bottomLane.removeEventListener("scroll",refreshOverflowSlider);
    for(const type of ["transitionrun","transitionend","transitioncancel"])bottomLane.removeEventListener(type,onOverflowWidthTransition);
  }
  // Lazy Zen/Gecko tabs may not yet have a linked browser with a real URI.
  // Read the session's local lazy URL without restoring or navigating it.
  let faviconSessionStore=null;
  try{faviconSessionStore=window.SessionStore||ChromeUtils.importESModule("resource:///modules/sessionstore/SessionStore.sys.mjs").SessionStore;}catch{}
  function faviconPage(tab){
    const valid=v=>typeof v==="string"&&/^https?:\/\//i.test(v);
    let lazy=null,current=null;
    try{lazy=(tab.ownerDocument.defaultView.SessionStore||faviconSessionStore)?.getLazyTabValue?.(tab,"url");}catch{}
    try{current=tab.linkedBrowser?.currentURI?.spec;}catch{}
    return [lazy,current,tab._originalUrl].find(valid)||"";
  }
  function favicon(tab) {
    const local=t=>{
      const sources=[t.getAttribute("image"),t.querySelector(".tab-icon-image")?.getAttribute("src")];
      try{sources.push(t.ownerDocument.defaultView.gBrowser.getIcon(t));}catch{}
      return sources.find(src=>/^(data:image\/|chrome:|resource:|moz-anno:|page-icon:|blob:)/i.test(src||"")&&!/defaultFavicon\.svg(?:$|[?#])/i.test(src))||"";
    };
    const direct=local(tab);
    if(direct)return direct;
    // Resolve the native synchronized tab identity, not its URL/title.
    if(tab.id&&window.gZenWindowSync&&window.gZenWorkspaces?.currentWindowIsSyncing){
      const wins=Services.wm.getEnumerator("navigator:browser");
      while(wins.hasMoreElements()){
        const win=wins.getNext();
        if(win===window||win.closed||win.gZenWindowSync!==window.gZenWindowSync||!win.gZenWorkspaces?.currentWindowIsSyncing)continue;
        const peer=win.gZenWindowSync.getItemFromWindow(win,tab.id);
        if(!peer||!win.gBrowser?.isTab(peer)||peer.closing||peer.getAttribute("zen-workspace-id")!==tab.getAttribute("zen-workspace-id"))continue;
        const icon=local(peer);if(icon&&!icon.startsWith("blob:"))return icon;
        const page=faviconPage(peer);
        if(/^https?:/i.test(page))return "page-icon:"+page;
      }
    }
    const page=faviconPage(tab);
    return /^https?:/i.test(page)?"page-icon:"+page:"";
  }

  function createEntry(tab) {
    const item = html("div", "oneplane-tab");
    const button = html("button", "oneplane-tab-select");
    button.type = "button";
    button.draggable = true;
    button.setAttribute("role", "tab");
    const icon = html("span", "oneplane-tab-icon");
    const img = html("img");
    img.alt = "";
    img.draggable = false;
    img.addEventListener("error", () => {
      const page=faviconPage(tab),fallback=page?"page-icon:"+page:"";
      if(fallback&&img.getAttribute("src")!==fallback){img.hidden=false;img.setAttribute("src",fallback);}
      else img.hidden=true;
    });
    img.decoding="async";
    img.addEventListener("load", () => { img.hidden = false; });
    icon.append(img);
    const audio = html("span", "oneplane-tab-audio");
    audio.setAttribute("aria-hidden", "true");
    for (let i = 0; i < 3; i++) audio.append(html("i"));
    const title = html("span", "oneplane-tab-title");
    button.append(icon, title);
    item.addEventListener("contextmenu", event => openNativeTabMenu(event, tab, button));
    button.addEventListener("click", () => {
      if(!tab.closing)homeLease?.close();
      if (!tab.closing && tab!==browser.selectedTab) {
        guardRestoredAddress(tab);
        guardPanelSwitch();
        browser.selectedTab = tab;
      }
    });
    item.addEventListener("auxclick", event => {
      if (event.button === 1 && !tab.closing) {
        event.preventDefault();
        browser.removeTab(tab, { animate: true });
      }
    });
    item.addEventListener("dragstart", event => onDragStart(event, tab));
    item.addEventListener("dragend", event => onDragEnd(event, tab));
    item.append(button, audio);
    return { item, button, title, img, audio, src: null };
  }

  function createSplitEntry(group) {
    const box = html("div", "oneplane-split-group");
    box.setAttribute("role", "group");
    const handle = html("button", "oneplane-split-handle");
    handle.type = "button";
    handle.draggable = true;
    handle.title = "Move entire Split View";
    handle.setAttribute("aria-label", "Move entire Split View");
    for (let i = 0; i < 6; i++) handle.append(html("i"));
    handle.addEventListener("dragstart", event => {
      const member = groupMembers(group)[0];
      if (member) onDragStart(event, member, group);
      else event.preventDefault();
    });
    handle.addEventListener("dragend", event => onDragEnd(event, draggedTab));
    handle.addEventListener("click", event => {
      event.stopPropagation();
      const member = groupMembers(group)[0];
      if(member)homeLease?.close();
      if (member && splitGroup(browser.selectedTab) !== group) browser.selectedTab = member;
    });
    // Keyboard alternative to drag. Move the whole group one top-level slot.
    handle.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight"].includes(event.key)) return;
      const before = event.key === "ArrowLeft";
      const slots=stripNodes(),index=slots.indexOf(box);
      const other=slots[index+(before?-1:1)];
      if (!other) return;
      const native = [...splitEntries].find(([, entry]) => entry.box === other)?.[0] || tabFromItem(other);
      if (!native) return;
      event.preventDefault();
      event.stopPropagation();
      moveNativeNextTo(group, { native, before });
      schedule();
    });
    box.append(handle);
    return {box, handle};
  }
  function refreshEntryIcon(tab,entry){
    const src= favicon(tab);
    if(entry.src===src)return false;
    entry.src=src;entry.img.hidden=!src;
    if(src)entry.img.setAttribute("src",src);else entry.img.removeAttribute("src");
    return true;
  }
  // Native order and group identity are authoritative. Keep only the
  // last committed projection signature, never a second tab data store.
  let syncedTopology=null,syncing=false;
  function readStripTopology(){
    const tabs=Array.from(browser.visibleTabs||browser.tabs||[]).filter(
      tab=>!tab.closing&&!tab.hidden&&!tab.hasAttribute("zen-empty-tab"));
    return {selected:browser.selectedTab,home:row.hasAttribute("data-op-home-open"),
      tabs:tabs.map(tab=>{const group=splitGroup(tab);return {tab,group,split:isSplit(tab,group),pinned:!!tab.pinned};})};
  }
  function sameStripTopology(a,b){
    return !!a&&!!b&&a.selected===b.selected&&a.home===b.home&&a.tabs.length===b.tabs.length&&
      a.tabs.every((x,i)=>{const y=b.tabs[i];return x.tab===y.tab&&x.group===y.group&&x.split===y.split&&x.pinned===y.pinned;});
  }
  function captureCenterTopology(expectedRow){
    if(dead||syncing||expectedRow!==row||!row.isConnected||row.hasAttribute("data-op-dragging")||
       !sameStripTopology(syncedTopology,readStripTopology()))return null;
    const native=syncedTopology;
    const selector=".oneplane-tab,.oneplane-split-group";
    const mirrors=[...list.querySelectorAll(selector)].map(node=>({node,parent:node.parentElement}));
    // The native signature alone is insufficient if the projection was
    // interrupted or a wrapper was detached/replaced at equal count.
    const groups=new Set(native.tabs.map(x=>x.group).filter(Boolean));
    const expected=new Set([...native.tabs.map(({tab})=>entries.get(tab)?.item),...Array.from(groups,g=>splitEntries.get(g)?.box)]);
    if(expected.has(undefined)||mirrors.length!==expected.size||mirrors.some(({node})=>!expected.has(node))||
       entries.size!==native.tabs.length||native.tabs.some(({tab,group})=>{
      const n=entries.get(tab)?.item;
      return !n||!list.contains(n)||group&&n.parentElement!==splitEntries.get(group)?.box||
        !group&&n.closest(".oneplane-split-group");
    }))return null;
    return ()=>{
      if(dead||!row.isConnected||row.hasAttribute("data-op-dragging")||syncedTopology!==native||
         !sameStripTopology(native,readStripTopology()))return false;
      const current=[...list.querySelectorAll(selector)];
      return current.length===mirrors.length&&mirrors.every(({node,parent},i)=>current[i]===node&&node.parentElement===parent);
    };
  }
  function onCenterMotionEnd(event){
    if(dead)return;
    if(syncing){schedule();return;}
    // A changed native signature must reconcile in this task, before a
    // stale proxy/real-card handoff can reach the next paint.
    if(event?.detail?.owner!=="close"&&(event?.detail?.reconcile||!sameStripTopology(syncedTopology,readStripTopology()))){
      if(frame)window.cancelAnimationFrame(frame);
      sync();
    }else schedule();
  }
  function sync() {
    if(dead)return;
    if(syncing){schedule();return;}
    if(frame)window.cancelAnimationFrame(frame);
    frame=0;
    syncing=true;
    try{syncNow();}finally{syncing=false;}
  }
  function syncNow(){
    // Retire stale native gesture before the mirror can remove/reparent the
    // OS drag source, including a delayed Center/Workspace reconciliation.
    retireChangedNativeDragTopology("projection-sync");
    if(root.hasAttribute("data-zr-center-motion")){
      // Native changes are handled by the exact motion owner. Reconcile
      // only once the owner has released its freeze, never under it.
      const invalidated=window.__nocturneCenterMotion?.invalidateTopology?.(row);
      if(dead)return;
      if(invalidated&&root.hasAttribute("data-zr-center-motion"))schedule();
    }
    if(root.hasAttribute("data-zr-center-motion")){
      // Icon-only updates are safe while chrome geometry is frozen.
      let changed=0;for(const [tab,entry] of entries)if(!tab.closing&&refreshEntryIcon(tab,entry))changed++;
      if(changed)window.__nocturneTrace?.("center.icons.sync",{changed,owner:root.getAttribute("data-zr-center-motion")},{throttle:100});
      return;
    }
    if(restingGeometryBlocked()){
      // Leave structural projection and measurements with the active owner.
      // Icon changes do not affect collapsed slot geometry.
      for(const [tab,entry] of entries)if(!tab.closing)refreshEntryIcon(tab,entry);
      return;
    }
    if(hoverModePending)applyHoverMode();
    if(dead||restingGeometryBlocked())return;
    const nativeTopology=readStripTopology();
    const homeOpen=nativeTopology.home;
    // Respect the current workspace and native visibility.
    const tabs=nativeTopology.tabs.map(x=>x.tab);
    const selected=nativeTopology.selected;
    const selectedSlot=nativeTopology.tabs.find(x=>x.tab===selected);
    const selectedGroup=selectedSlot?selectedSlot.group:splitGroup(selected);
    const count = String(tabs.length);
    if (row.style.getPropertyValue("--op-tab-count") !== count) {
      row.style.setProperty("--op-tab-count", count);
      scheduleGeometry();
    }
    updateEmptyAddress();
    const keep = new Set(tabs);
    for (const [tab, entry] of entries) {
      if (!keep.has(tab)) {
        if (hoverTab === entry.item || indicatorHover === entry.item) clearTabHover();
        splitMeasureObserver.unobserve(entry.item);
        entry.item.remove(); entries.delete(tab);
      }
    }
    const groups = [...new Set(nativeTopology.tabs.map(x=>x.group).filter(Boolean))];
    const groupCount = String(groups.length);
    if (row.style.getPropertyValue("--op-split-count") !== groupCount) {
      row.style.setProperty("--op-split-count", groupCount);
      scheduleGeometry();
    }
    const order = [];
    const groupItems = new Map();
    for (const group of groups) {
      if (!splitEntries.has(group)) splitEntries.set(group, createSplitEntry(group));
      if (!splitColors.has(group)) splitColors.set(group, splitPalette[nextSplitColor++ % splitPalette.length]);
      const entry = splitEntries.get(group);
      entry.box.style.setProperty("--op-split-color", splitColors.get(group));
      entry.box.toggleAttribute("data-op-split-active", !homeOpen && group === selectedGroup);
      groupItems.set(group, []);
    }
    for (let index = 0; index < tabs.length; index++) {
      const {tab,group,split,pinned}=nativeTopology.tabs[index];
      let entry = entries.get(tab);
      if (!entry) {
        entry = createEntry(tab);
        entries.set(tab, entry);
        splitMeasureObserver.observe(entry.item);
      }
      const label = tab.label || tab.getAttribute("label") || "New tab";
      const nativeSelected = tab === nativeTopology.selected;
      const selected = !homeOpen && nativeSelected;
      entry.item.toggleAttribute("data-selected", selected);
      entry.item.toggleAttribute("data-op-split", split);
      entry.item.toggleAttribute("data-op-split-active", !homeOpen && split && Boolean(group && group === selectedGroup));
      // First/last flags are assigned after groups are laid out in visual order.
      entry.item.removeAttribute("data-op-split-prev");
      entry.item.removeAttribute("data-op-split-next");
      if (split) entry.item.style.setProperty("--op-split-color", splitColors.get(group) || splitPalette[0]);
      else entry.item.style.removeProperty("--op-split-color");
      entry.item.toggleAttribute("data-pinned", pinned);
      entry.item.toggleAttribute("data-busy", tab.hasAttribute("busy"));
      entry.item.toggleAttribute("data-unloaded", !nativeSelected && (tab.hasAttribute("pending") || tab.hasAttribute("discarded")));
      const muted = tab.hasAttribute("muted");
      const audible = tab.hasAttribute("soundplaying") || tab.hasAttribute("soundplaying-scheduledremoval");
      entry.item.toggleAttribute("data-audio", audible && !muted);
      entry.item.toggleAttribute("data-muted", muted);
      entry.audio.title = muted ? "Tab muted" : audible ? "Playing audio" : "";
      entry.button.setAttribute("aria-selected", String(selected));
      entry.button.title=label;
      entry.button.setAttribute("aria-label", label + (split ? ", Split View" : "") + (muted ? ", muted" : audible ? ", playing audio" : ""));
      if (entry.title.textContent !== label) entry.title.textContent = label;
      refreshEntryIcon(tab,entry);
      if (group && splitEntries.has(group)) {
        const members = groupItems.get(group);
        if (!members.length) order.push(splitEntries.get(group).box);
        members.push(entry.item);
      } else {
        order.push(entry.item);
      }
    }
    // Reparent the mirrored UI only when membership actually changes.
    // Native tabs and their native Split View containers are not reparented.
    for (const [group, items] of groupItems) {
      const entry = splitEntries.get(group);
      entry.box.setAttribute("aria-label", "Split View, " + items.length + " tabs");
      entry.box.style.setProperty("--op-split-members", String(items.length));
      for (let i = 0; i < items.length; i++) {
        const node = items[i];
        if (entry.box.children[i + 1] !== node) entry.box.insertBefore(node, entry.box.children[i + 1] || null);
      }
    }
    placeStripOrder(order);
    for (const [group, entry] of splitEntries) {
      if (!groupItems.has(group)) { entry.box.remove(); splitEntries.delete(group); }
      else measureSplitGroup(group);
    }
    // Count each actual visible tab, including split members, but never
    // the group wrapper, handle or plus. Use rendered order, not native
    // indexes, because a split can collect non-adjacent native tabs.
    const visualTabs=stripNodes().flatMap(n=>n.classList.contains("oneplane-tab")?[n]:Array.from(n.querySelectorAll(".oneplane-tab")));
    row.toggleAttribute("data-op-small-strip", visualTabs.length <= 3);
    for (let i = 0; i < visualTabs.length; i++) {
      visualTabs[i].toggleAttribute("data-op-first", i === 0);
      visualTabs[i].toggleAttribute("data-op-last", i === visualTabs.length - 1);
    }
    centerToolbar();
    refreshIndicator();
    refreshIslandTitle();
    // Only publish after the complete structural sync. A drag owns its
    // temporary order and cannot authorize a Center Motion snapshot.
    syncedTopology=row.hasAttribute("data-op-dragging")?null:nativeTopology;
    typeof window!=="undefined"&&window.__nocturneTrace?.("tabs.sync",()=>({native:tabs.length,mirror:visualTabs.length,groups:groups.length,entries:entries.size,overflow:row.hasAttribute('data-op-overflow-row'),homeOpen,phase:root.getAttribute('data-zr-workspace-phase')}),{throttle:120,sample:1200});
    scheduleGeometry();
    if(selectedRevealPending&&!restingGeometryBlocked()&&cascadeState==="idle")window.requestAnimationFrame(revealSelectedInStrip);
  }

  function schedule() {
    if(dead||frame)return;
    const id=window.requestAnimationFrame(()=>{
      if(frame!==id)return;
      frame=0;sync();
    });
    frame=id;
  }
  let selectedRevealPending=false;
  function revealSelectedInStrip(){
    if(dead)return;
    if(restingGeometryBlocked()||cascadeState!=="idle"||root.hasAttribute("data-zr-center-motion")){selectedRevealPending=true;return;}
    selectedRevealPending=false;
    const item=entries.get(browser.selectedTab)?.item;
    if(!item||!list.contains(item))return;
    // Never scroll ancestors (native toolbar, page, or window).
    const viewport=item.closest(".oneplane-island-lane")||list;
    if(viewport.scrollWidth<=viewport.clientWidth+1)return;
    const a=item.getBoundingClientRect(),b=viewport.getBoundingClientRect();
    const delta=a.left<b.left?a.left-b.left:a.right>b.right?a.right-b.right:0;
    if(Math.abs(delta)>1){
      if(viewport===bottomLane)cancelOverflowMotion();
      viewport.scrollLeft+=delta;
    }
  }
  function onSelect() {
    retireChangedNativeDragTopology("native-tab-select");
    if(restoreSearchTimer)cancelStartupSearchRestore("native-tab-select");
    typeof window!=="undefined"&&window.__nocturneTrace?.("tabs.select",()=>({home:row.hasAttribute('data-op-home-open'),phase:root.getAttribute('data-zr-workspace-phase'),overflow:row.hasAttribute('data-op-overflow-row')}),{sample:1800});
    markHomeTitleActivity();
    indicatorSelectionChanged();
    guardRestoredAddress(browser.selectedTab);
    guardPanelSwitch();
    updateEmptyAddress();
    schedule();
    alignAddressStart();
    window.requestAnimationFrame(revealSelectedInStrip);
  }
  function onTabOpenOrClose(){
    retireChangedNativeDragTopology("native-tab-change");
    if(restoreSearchTimer)cancelStartupSearchRestore("native-tab-change");
    guardPanelSwitch();
    schedule();
  }
  function onNativeIconChanged(event){
    schedule();
    if(!window.gZenWindowSync||!window.gZenWorkspaces?.currentWindowIsSyncing)return;
    const wins=Services.wm.getEnumerator("navigator:browser");
    while(wins.hasMoreElements()){
      const win=wins.getNext();
      if(win!==window&&!win.closed&&win.gZenWindowSync===window.gZenWindowSync&&win.gZenWorkspaces?.currentWindowIsSyncing)
        win.dispatchEvent(new win.CustomEvent("OnePlane:SyncedIconChanged"));
    }
  }
  function onNativeTabEvent(event){
    retireChangedNativeDragTopology(event?.type||"native-tab-event");
    schedule();
  }
  const events = ["SSTabRestoring", "SSTabRestored", "TabOpen", "TabClose", "TabMove", "TabAttrModified", "TabPinned", "TabUnpinned", "TabShow", "TabHide", "TabBrowserInserted", "TabBrowserDiscarded", "ZenTabRemovedFromSplit"];
  const tabObserver = new MutationObserver(()=>{
    retireChangedNativeDragTopology("native-tab-observer");
    schedule();
  });
  const workspaceObserver = new MutationObserver(()=>{
    retireChangedNativeDragTopology("native-workspace-observer");
    schedule();
  });
  const toolbarObserver = new MutationObserver(() => {
    if(dead)return;
    retireChangedDragChromeFrame("toolbar-children");
    retireIncomingDrag();
    if(root.hasAttribute("customizing"))return;
    if (url.parentElement === target && row.parentElement !== target) url.after(row);
    if (leftSpacer.parentElement !== target) target.prepend(leftSpacer);
    if (rightSpacer.parentElement !== target) row.after(rightSpacer);
    hub.ensure();ensureDownloadHost();
    movePageActions();
    const centered=centerToolbar();
    observeGeometry(centered);
  });

  function destroy() {
    typeof window!=="undefined"&&window.__nocturneTrace?.("layout.strip.destroy",()=>({dead}),{flush:true});
    if (dead) return;
    dead = true;
    cleanupStep("destroyHome()",()=>{destroyHome();});
    cleanupStep("destroyOverflowSlider()",()=>{destroyOverflowSlider();});
    cleanupStep("overflowRevealAnimation?.cancel()",()=>{overflowRevealAnimation?.cancel();});
    cleanupStep("overflowRevealAnimation=null",()=>{overflowRevealAnimation=null;});
    cleanupStep("resetTabCascade()",()=>{resetTabCascade();});
    cleanupStep("if (frame) window.cancelAnimationFrame(frame)",()=>{if (frame) window.cancelAnimationFrame(frame);});
    cleanupStep("if (dragCommitFrame) window.cancelAnimationFrame(dragCommitFrame)",()=>{if (dragCommitFrame) window.cancelAnimationFrame(dragCommitFrame);});
    dragCommitFrame = 0;
    cleanupStep("tabObserver.disconnect()",()=>{tabObserver.disconnect();});
    cleanupStep("splitMeasureObserver.disconnect()",()=>{splitMeasureObserver.disconnect();});
    cleanupStep("workspaceObserver.disconnect()",()=>{workspaceObserver.disconnect();});
    cleanupStep("toolbarObserver.disconnect()",()=>{toolbarObserver.disconnect();});
    cleanupStep("actionObserver.disconnect()",()=>{actionObserver.disconnect();});
    cleanupStep("geometryObserver?.disconnect()",()=>{geometryObserver?.disconnect();});
    cleanupStep("contourResize?.disconnect()",()=>{contourResize?.disconnect();});
    cleanupStep("contourObserver?.disconnect()",()=>{contourObserver?.disconnect();});
    cleanupStep("prefs.removeObserver(contourPrefPrefix,contourPreferenceObserver)",()=>{prefs.removeObserver(contourPrefPrefix,contourPreferenceObserver);});
    cleanupStep("contourObserved.clear()",()=>{contourObserved.clear();});
    if(bookmarks)for(const event of ["transitionrun","transitionend","transitioncancel"])
      cleanupStep("bookmark "+event,()=>bookmarks.removeEventListener(event,onContourTransition,true));
    cleanupStep("hoverObserver?.disconnect()",()=>{hoverObserver?.disconnect();});
    cleanupStep("modeObserver?.disconnect()",()=>{modeObserver?.disconnect();});
    cleanupStep("if(panelTimer)window.clearTimeout(panelTimer)",()=>{if(panelTimer)window.clearTimeout(panelTimer);});
    cleanupStep("if(panelSwitchTimer)window.clearTimeout(panelSwitchTimer)",()=>{if(panelSwitchTimer)window.clearTimeout(panelSwitchTimer);});
    cleanupStep("panelTimer=panelSwitchTimer=0",()=>{panelTimer=panelSwitchTimer=0;});
    cleanupStep("toolbarWrapper?.removeAttribute(\"data-op-panel-open\")",()=>{toolbarWrapper?.removeAttribute("data-op-panel-open");});
    cleanupStep("cancelGeometry()",()=>{cancelGeometry();});
    cleanupStep("clearHover()",()=>{clearHover();});
    cleanupStep("releaseAddressHold()",()=>{releaseAddressHold();});
    cleanupStep("clearTabHover()",()=>{clearTabHover();});
    cleanupStep("releaseDragEngine()",()=>{releaseDragEngine();});
    cleanupStep("incoming preview lease",()=>{incomingDrag=null;});
    cleanupStep("endDragVisual()",()=>{endDragVisual();});
    cleanupStep("cancelInsertion()",()=>{cancelInsertion();});
    draggedTab = null;
    draggedGroup = null;
    cleanupStep("drag controller publication",releaseDragController);
    cleanupStep("window.removeEventListener(\"dragover\", revealForDrag, true)",()=>{window.removeEventListener("dragover", revealForDrag, true);});
    cleanupStep("window.removeEventListener(\"drag\",onSourceDrag,true)",()=>{window.removeEventListener("drag",onSourceDrag,true);});
    cleanupStep("clearPlacementPreview(true)",()=>{clearPlacementPreview(true);});
    cleanupStep("window.removeEventListener(\"drop\", onToolbarDrop, true)",()=>{window.removeEventListener("drop", onToolbarDrop, true);});
    cleanupStep("window.removeEventListener(\"dragleave\", onWindowDragLeave, true)",()=>{window.removeEventListener("dragleave", onWindowDragLeave, true);});
    cleanupStep("window.removeEventListener(\"dragexit\", onWindowDragLeave, true)",()=>{window.removeEventListener("dragexit", onWindowDragLeave, true);});
    cleanupStep("row.removeEventListener(\"pointerdown\", rememberStartupSearch, true)",()=>{row.removeEventListener("pointerdown", rememberStartupSearch, true);});
    cleanupStep("cancelStartupSearchRestore()",()=>{cancelStartupSearchRestore("destroy");});
    cleanupStep("row.removeEventListener(\"dragover\", onStripDragOver)",()=>{row.removeEventListener("dragover", onStripDragOver);});
    cleanupStep("row.removeEventListener(\"drop\", onStripDrop)",()=>{row.removeEventListener("drop", onStripDrop);});
    cleanupStep("row.removeEventListener(\"dragleave\", onStripDragLeave)",()=>{row.removeEventListener("dragleave", onStripDragLeave);});
    cleanupStep("splitZone.removeEventListener(\"dragover\", onSplitDragOver)",()=>{splitZone.removeEventListener("dragover", onSplitDragOver);});
    cleanupStep("splitZone.removeEventListener(\"drop\", onSplitDrop)",()=>{splitZone.removeEventListener("drop", onSplitDrop);});
    cleanupStep("splitZone.remove()",()=>{splitZone.remove();});
    for(const lane of [list,leftLane,rightLane,bottomLane]){
      cleanupStep("lane.removeEventListener(\"scroll\",onLaneScroll)",()=>{lane.removeEventListener("scroll",onLaneScroll);});
      cleanupStep("lane.removeEventListener(\"wheel\",onLaneWheel)",()=>{lane.removeEventListener("wheel",onLaneWheel);});
    }
    cleanupStep("islandTextAnimation?.cancel()",()=>{islandTextAnimation?.cancel();});
    cleanupStep("prefs.removeObserver(\"zen.oneplane.hover-mode\",hoverModePreferenceObserver)",()=>{prefs.removeObserver("zen.oneplane.hover-mode",hoverModePreferenceObserver);});
    for(const key of ["tab-width","expanded-tab-width","address-width"]) cleanupStep("prefs.removeObserver(\"zen.oneplane.\"+key,adaptiveGeometryPrefs)",()=>{prefs.removeObserver("zen.oneplane."+key,adaptiveGeometryPrefs);});
    cleanupStep("prefs.removeObserver(\"zen.oneplane.show-center-island\",hoverModePreferenceObserver)",()=>{prefs.removeObserver("zen.oneplane.show-center-island",hoverModePreferenceObserver);});
    cleanupStep("prefs.removeObserver(\"zen.oneplane.tab-indicator\", indicatorPreferenceObserver)",()=>{prefs.removeObserver("zen.oneplane.tab-indicator", indicatorPreferenceObserver);});
    cleanupStep("window.removeEventListener(\"pointermove\", trackTabPointer, true)",()=>{window.removeEventListener("pointermove", trackTabPointer, true);});
    cleanupStep("window.removeEventListener(\"deactivate\", clearTabHover)",()=>{window.removeEventListener("deactivate", clearTabHover);});
    cleanupStep("row.removeEventListener(\"pointerleave\", leaveTabPointer)",()=>{row.removeEventListener("pointerleave", leaveTabPointer);});
    cleanupStep("row.removeEventListener(\"focusin\", focusTab)",()=>{row.removeEventListener("focusin", focusTab);});
    cleanupStep("row.removeEventListener(\"focusout\", blurTab)",()=>{row.removeEventListener("focusout", blurTab);});
    cleanupStep("plus.removeEventListener(\"pointerleave\", leaveTabPointer)",()=>{plus.removeEventListener("pointerleave", leaveTabPointer);});
    cleanupStep("plus.removeEventListener(\"click\", onNewTabClick)",()=>{plus.removeEventListener("click", onNewTabClick);});
    try { browser.removeProgressListener(progressListener); } catch {}
    cleanupStep("url.removeAttribute(\"data-op-empty\")",()=>{url.removeAttribute("data-op-empty");});
    cleanupStep("url.removeAttribute(\"data-op-url-ready\")",()=>{url.removeAttribute("data-op-url-ready");});
    cleanupStep("url.removeAttribute(\"data-op-address-icon\")",()=>{url.removeAttribute("data-op-address-icon");});
    cleanupStep("compactSearch.remove()",()=>{compactSearch.remove();});
    cleanupStep("url.style.removeProperty(\"--op-url\")",()=>{url.style.removeProperty("--op-url");});
    for (const name of ["--op-url-expanded-width", "--op-url-compact-width", "--op-url-anchor-left", "--op-url-anchor-top", "--op-url-header-height"]) cleanupStep("url.style.removeProperty(name)",()=>{url.style.removeProperty(name);});
    cleanupStep("toolbarWrapper?.style.removeProperty(\"--op-measured-toolbar-height\")",()=>{toolbarWrapper?.style.removeProperty("--op-measured-toolbar-height");});
    cleanupStep("surface.remove()",()=>{surface.remove();});
    cleanupStep("leftSpacer.remove()",()=>{leftSpacer.remove();});
    cleanupStep("rightSpacer.remove()",()=>{rightSpacer.remove();});
    cleanupStep("releaseWorkspaceLinkScope()",()=>{releaseWorkspaceLinkScope();});
    cleanupStep("mount scope",()=>{
      const result=mountScope.dispose();
      try{window.__nocturneTrace?.("layout.scope.dispose",{owner:"layout",...result},{flush:true});}catch{}
    });
    cleanupStep("closeNativeTabMenu()",()=>{closeNativeTabMenu();});
    cleanupStep("window.removeEventListener(\"pointermove\", trackPointer, true)",()=>{window.removeEventListener("pointermove", trackPointer, true);});
    cleanupStep("toolbarWrapper?.removeEventListener(\"pointerover\", trackPointer)",()=>{toolbarWrapper?.removeEventListener("pointerover", trackPointer);});
    cleanupStep("document.documentElement.removeEventListener(\"mouseleave\", leaveWindow)",()=>{document.documentElement.removeEventListener("mouseleave", leaveWindow);});
    cleanupStep("window.removeEventListener(\"deactivate\", onWindowDeactivate)",()=>{window.removeEventListener("deactivate", onWindowDeactivate);});
    cleanupStep("window.removeEventListener(\"ZenCompactMode:Toggled\", onCompactChanged)",()=>{window.removeEventListener("ZenCompactMode:Toggled", onCompactChanged);});
    cleanupStep("window.removeEventListener(\"ZenCompactMode:LayoutUpdate\", onCompactChanged)",()=>{window.removeEventListener("ZenCompactMode:LayoutUpdate", onCompactChanged);});
    cleanupStep("window.removeEventListener(\"resize\", onWindowGeometryChanged)",()=>{window.removeEventListener("resize", onWindowGeometryChanged);});
    cleanupStep("window.removeEventListener(\"sizemodechange\", onWindowGeometryChanged)",()=>{window.removeEventListener("sizemodechange", onWindowGeometryChanged);});
    cleanupStep("addressObserver?.disconnect()",()=>{addressObserver?.disconnect();});
    cleanupStep("clearAddressAnimation()",()=>{clearAddressAnimation();});
    cleanupStep("addressBar()?.removeEventListener(\"pointerdown\", onAddressInput, true)",()=>{addressBar()?.removeEventListener("pointerdown", onAddressInput, true);});
    cleanupStep("addressBar()?.removeEventListener(\"input\", onAddressInput, true)",()=>{addressBar()?.removeEventListener("input", onAddressInput, true);});
    cleanupStep("addressBar()?.removeEventListener(\"toggle\", onAddressMutation)",()=>{addressBar()?.removeEventListener("toggle", onAddressMutation);});
    cleanupStep("if (addressFrame) window.cancelAnimationFrame(addressFrame)",()=>{if (addressFrame) window.cancelAnimationFrame(addressFrame);});
    cleanupStep("if(restoringAddressTimer)window.clearTimeout(restoringAddressTimer)",()=>{if(restoringAddressTimer)window.clearTimeout(restoringAddressTimer);});
    cleanupStep("restoringAddressTimer=0",()=>{restoringAddressTimer=0;});
    cleanupStep("restoringAddressTab=null",()=>{restoringAddressTab=null;});
    cleanupStep("releaseShield()",()=>{releaseShield();});
    cleanupStep("shield.remove()",()=>{shield.remove();});
    cleanupStep("url.removeEventListener(\"focusout\", onAddressMutation)",()=>{url.removeEventListener("focusout", onAddressMutation);});
    cleanupStep("restorePageActions()",()=>{restorePageActions();});
    cleanupStep("restoreWindowCaptions()",()=>{restoreWindowCaptions();});
    for (const event of events) cleanupStep("browser.tabContainer.removeEventListener(event, onNativeTabEvent)",()=>{browser.tabContainer.removeEventListener(event, onNativeTabEvent);});
    cleanupStep("browser.tabContainer.removeEventListener(\"TabSelect\", onSelect)",()=>{browser.tabContainer.removeEventListener("TabSelect", onSelect);});
    for(const event of ["TabOpen","TabClose"]) cleanupStep("browser.tabContainer.removeEventListener(event,onTabOpenOrClose,true)",()=>{browser.tabContainer.removeEventListener(event,onTabOpenOrClose,true);});
    cleanupStep("window.removeEventListener(\"ZenWorkspaceDataChanged\", schedule)",()=>{window.removeEventListener("ZenWorkspaceDataChanged", onNativeTabEvent);});
    cleanupStep("window.removeEventListener(\"ZenRefined:WorkspaceTransition\",onWorkspaceMotion)",()=>{window.removeEventListener("ZenRefined:WorkspaceTransition",onWorkspaceMotion);});
    cleanupStep("center motion listener",()=>window.removeEventListener("Nocturne:CenterMotionEnd",onCenterMotionEnd));
    cleanupStep("toolbarWrapper?.removeAttribute(\"oneplane-workspace-hold\")",()=>{toolbarWrapper?.removeAttribute("oneplane-workspace-hold");});
    cleanupStep("window.removeEventListener(\"ZenTabIconChanged\",onNativeIconChanged,true)",()=>{window.removeEventListener("ZenTabIconChanged",onNativeIconChanged,true);});
    cleanupStep("window.removeEventListener(\"OnePlane:SyncedIconChanged\",schedule)",()=>{window.removeEventListener("OnePlane:SyncedIconChanged",schedule);});
    cleanupStep("window.removeEventListener(\"ZenViewSplitter:SplitViewActivated\", schedule)",()=>{window.removeEventListener("ZenViewSplitter:SplitViewActivated", onNativeTabEvent);});
    cleanupStep("window.removeEventListener(\"ZenViewSplitter:SplitViewDeactivated\", schedule)",()=>{window.removeEventListener("ZenViewSplitter:SplitViewDeactivated", onNativeTabEvent);});
    cleanupStep("window.removeEventListener(\"aftercustomization\", schedule)",()=>{window.removeEventListener("aftercustomization", schedule);});
    cleanupStep("download host",releaseDownloadHost);
    cleanupStep("download hold",()=>toolbarWrapper?.removeAttribute("oneplane-download-hold"));
    cleanupStep("row.remove()",()=>{row.remove();});
    cleanupStep("entries.clear()",()=>{entries.clear();});
    cleanupStep("splitEntries.clear()",()=>{splitEntries.clear();});
  }

  const checkMount=()=>{
    if(disposed||window.closed||window[CONTROLLER]!==controller)
      throw Error("Stale strip mount");
  };
  try {
    // No globally visible Hub/drag owner before all strip declarations
    // are initialized and the existing rollback guard is active.
    mountScope.defer("hub",()=>hub.destroy());
    releaseDragController=mountScope.defer("drag-controller",()=>{
      if(window[DRAG_CONTROLLER]===dragController)delete window[DRAG_CONTROLLER];
    });
    window[DRAG_CONTROLLER]=dragController;
    hub.mount();checkMount();
    url.after(row);url.append(compactSearch);
    hub.ensure();ensureDownloadHost();checkMount();
    releaseDragEngine=installDragEngine();
    try{releaseWorkspaceLinkScope=installWorkspaceLinkScope();}catch(error){console.warn("[OnePlane] Workspace link isolation:",nocturneErrorClass(error));}
    target.prepend(leftSpacer);
    row.after(rightSpacer);
    tabbox.append(shield, splitZone);
    window.addEventListener("dragover", revealForDrag, true);
    window.addEventListener("drag",onSourceDrag,true);
    window.addEventListener("drop", onToolbarDrop, true);
    window.addEventListener("dragleave", onWindowDragLeave, true);
    window.addEventListener("dragexit", onWindowDragLeave, true);
    row.addEventListener("pointerdown", rememberStartupSearch, true);
    row.addEventListener("dragover", onStripDragOver);
    row.addEventListener("drop", onStripDrop);
    row.addEventListener("dragleave", onStripDragLeave);
    splitZone.addEventListener("dragover", onSplitDragOver);
    splitZone.addEventListener("drop", onSplitDrop);
    toolbarWrapper?.prepend(surface);
    movePageActions();
    const bar = document.getElementById("urlbar");
    if (bar) {
      addressObserver = new MutationObserver(onAddressMutation);
      bar.addEventListener("pointerdown", onAddressInput, true);
      bar.addEventListener("input", onAddressInput, true);
      bar.addEventListener("toggle", onAddressMutation);
      addressObserver.observe(bar, { attributes: true, attributeFilter: ["focused", "open", "textoverflow", "pageproxystate", "zen-floating-urlbar", "breakout-extend", "popover-open"] });
    }
    url.addEventListener("focusout", onAddressMutation);
    actionObserver.observe(url, { subtree: true, childList: true });
    alignAddressStart();
    mountHome();checkMount();
    applyHoverMode();
    sync();checkMount();
    try { browser.addProgressListener(progressListener); } catch {}
    for(const lane of [list,leftLane,rightLane,bottomLane]){
      lane.addEventListener("scroll",onLaneScroll,{passive:true});
      lane.addEventListener("wheel",onLaneWheel,{passive:false});
    }
    prefs.addObserver("zen.oneplane.hover-mode",hoverModePreferenceObserver);
    for(const key of ["tab-width","expanded-tab-width","address-width"])prefs.addObserver("zen.oneplane."+key,adaptiveGeometryPrefs);
    prefs.addObserver("zen.oneplane.show-center-island",hoverModePreferenceObserver);
    prefs.addObserver("zen.oneplane.tab-indicator", indicatorPreferenceObserver);
    window.addEventListener("pointermove", trackTabPointer, true);
    window.addEventListener("deactivate", clearTabHover);
    row.addEventListener("pointerleave", leaveTabPointer);
    row.addEventListener("focusin", focusTab);
    row.addEventListener("focusout", blurTab);
    plus.addEventListener("pointerleave", leaveTabPointer);
    plus.addEventListener("click", onNewTabClick);
    mountOverflowSlider();
    for (const event of events) browser.tabContainer.addEventListener(event, onNativeTabEvent);
    browser.tabContainer.addEventListener("TabSelect", onSelect);
    for(const event of ["TabOpen","TabClose"])browser.tabContainer.addEventListener(event,onTabOpenOrClose,true);
    window.addEventListener("ZenWorkspaceDataChanged", onNativeTabEvent);
    window.addEventListener("ZenRefined:WorkspaceTransition",onWorkspaceMotion);
    window.addEventListener("Nocturne:CenterMotionEnd",onCenterMotionEnd);
    onWorkspaceMotion();
    window.addEventListener("ZenTabIconChanged",onNativeIconChanged,true);
    window.addEventListener("OnePlane:SyncedIconChanged",schedule);
    window.addEventListener("ZenViewSplitter:SplitViewActivated", onNativeTabEvent);
    window.addEventListener("ZenViewSplitter:SplitViewDeactivated", onNativeTabEvent);
    window.addEventListener("aftercustomization", schedule);
    tabObserver.observe(browser.tabContainer, {
      subtree: true, childList: true, attributes: true,
      attributeFilter: ["label", "image", "selected", "hidden", "busy", "pinned", "active", "zen-workspace-id", "pending", "discarded", "soundplaying", "soundplaying-scheduledremoval", "muted", "zen-empty-tab", "split-view", "split-view-group"]
    });
    const wrapper = document.getElementById("zen-tabs-wrapper");
    if (wrapper && !browser.tabContainer.contains(wrapper)) {
      workspaceObserver.observe(wrapper, { subtree: true, childList: true, attributes: true, attributeFilter: ["active", "hidden"] });
    }
    toolbarObserver.observe(target, { childList: true });
    geometryObserver = new ResizeObserver(()=>{
      checkCenterGeometry("resize-observer");
      if(dead)return;
      retireChangedDragChromeFrame("native-edge-resize");
      retireIncomingDrag();
      // ResizeObserver delivery occurs before paint. Compensate edge
      // width changes now rather than a frame later.
      scheduleMeasuredGeometry(centerToolbar());
    });
    observeGeometry();
    if(bookmarks){
      contourResize=new ResizeObserver(scheduleContour);
      observeContourNodes();
      contourObserver=new MutationObserver(records=>{
        if(records.some(r=>r.type==="childList"))observeContourNodes();
        if(records.some(r=>r.type==="childList"||r.target===bookmarks||
          contourObserved.has(r.target)||r.target.id==="PlacesToolbarItems"||
          r.target.id==="PlacesToolbar"||r.target.id==="personal-bookmarks"))scheduleContour();
      });
      contourObserver.observe(bookmarks,{subtree:true,childList:true,attributes:true,
        attributeFilter:["hidden","collapsed","style","class","label","overflowed","data-zr-bm-active","data-zr-bm-room"]});
      for(const event of ["transitionrun","transitionend","transitioncancel"])
        bookmarks.addEventListener(event,onContourTransition,true);
    }
    prefs.addObserver(contourPrefPrefix,contourPreferenceObserver);
    scheduleContour();
    if (toolbarWrapper) {
      hoverObserver = new MutationObserver(reconcilePanel);
      hoverObserver.observe(toolbarWrapper, { attributes: true, attributeFilter: [...PANEL_NATIVE_FLAGS,...PANEL_HOLD_FLAGS] });
      window.requestAnimationFrame(reconcilePanel);
      toolbarWrapper.addEventListener("pointerover", trackPointer);
    }
    modeObserver = new MutationObserver(onCompactChanged);
    modeObserver.observe(root, { attributes: true, attributeFilter: ["oneplane-active", "zen-compact-mode", "customizing", "inDOMFullscreen", "inFullscreen"] });
    window.addEventListener("pointermove", trackPointer, true);
    document.documentElement.addEventListener("mouseleave", leaveWindow);
    window.addEventListener("deactivate", onWindowDeactivate);
    window.addEventListener("ZenCompactMode:Toggled", onCompactChanged);
    window.addEventListener("ZenCompactMode:LayoutUpdate", onCompactChanged);
    window.addEventListener("resize", onWindowGeometryChanged);
    window.addEventListener("sizemodechange", onWindowGeometryChanged);
    checkMount();
    row.setAttribute("data-ready", "true");
  } catch (error) {
    destroy();
    throw error;
  }
  destroy.prepareWorkspaceGeometry=prepareWorkspaceGeometry;
  destroy.invalidateBookmarkContour=scheduleContour;
  destroy.prepareBookmarkContour=()=>paintContour(false,true);
  destroy.captureCenterTopology=captureCenterTopology;
  destroy.captureCenterGeometry=captureCenterGeometry;
  return destroy;
}

// Sine 2.3.3 replaces callbacks registered for the same script/window.
// The final Layout callback owns normal teardown; early fragment callbacks
// are partial-initialization fallbacks only.
const layoutResources={boot:window.__nocturneEarlyBoot,center:window.__nocturneCenterMotion,diagnostics:window.__nocturneDiagnostics};
let cleanupErrors=0,cleanupErrorStart=0,completeDiagnostics=null,cancelFreeStartupWait=null;
// Each release is isolated: one feature failure must not prevent native
// preference restoration or the remaining controller cleanup.
function cleanupStep(label,fn){
  try{fn();}catch(error){cleanupErrors++;console.warn("[Nocturne] Cleanup "+label+":",nocturneErrorClass(error));try{window.__nocturneTrace?.("layout.cleanup.error",{resource:label,name:nocturneErrorClass(error)});}catch{}}
}
function cleanup(nativeExit=false) {
  if (disposed) return;
  disposed = true;
  cleanupErrorStart=cleanupErrors;
  cleanupStep("Free startup wait",()=>cancelFreeStartupWait?.("layout-dispose"));
  try{window.__nocturneTrace?.("layout.cleanup.begin",{applied,closing,nativeExit:nativeExit===true},{flush:true});}catch{}
  // Stop the active Assembly consumer before releasing its Layout hosts.
  cleanupStep("startup animation",()=>{if(window[CONTROLLER]===controller)window.__zenRefinedStartupAnimation?.();});
  cleanupStep("early boot",()=>layoutResources.boot?.cleanup?.());
  cleanupStep("center motion",()=>layoutResources.center?.dispose?.());
  cleanupStep("active flag",()=>root.removeAttribute("oneplane-active"));
  cleanupStep("ready flag",()=>root.removeAttribute("data-op-startup-ready"));
  cleanupStep("startup event",()=>window.dispatchEvent(new window.CustomEvent("OnePlane:StartupState")));
  cleanupStep("tab strip",()=>removeTabStrip?.());
  removeTabStrip = null;
  if (startupObserver) {
    cleanupStep("startup observer",()=>Services.obs.removeObserver(startupObserver, "browser-delayed-startup-finished"));
    startupObserver = null;
  }
  cleanupStep("beforeunload",()=>window.removeEventListener("beforeunload", markClosing, true));
  cleanupStep("unload",()=>window.removeEventListener("unload", nativeUnload));
  cleanupStep("close timer",()=>{if(closeTimer)window.clearTimeout(closeTimer);closeTimer=0;});
  pendingCleanup={wasApplied:applied,pendingClose:closing,nativeExit:nativeExit===true};
  applied=false;closing=false;
  finishCleanup();
}
function finishCleanup(){
  // Native preference writes notify observers synchronously. Keep the lease
  // until that call returns, even when cleanup is invoked by an observer.
  if(preferenceMutation||!pendingCleanup)return;
  const {wasApplied,pendingClose,nativeExit}=pendingCleanup;
  pendingCleanup=null;
  const wasOwner=ownsPreferences;
  ownsPreferences=false;
  const registered=window[CONTROLLER]===controller;
  if(registered)delete window[CONTROLLER];
  if(wasOwner)cleanupStep("layout preferences",()=>{
    const shared=otherActiveWindow()||!!window[CONTROLLER]?.ownsPreferences;
    if(!shared)restorePrefs();
    try{window.__nocturneTrace?.("layout.prefs.lease",{action:"release",last:!shared},{flush:true});}catch{}
  });
  if(wasApplied&&registered)cleanupStep("native layout update",()=>updateNativeAfterCleanup(pendingClose,nativeExit===true));
  try{window.__nocturneTrace?.("layout.cleanup.end",{wasApplied,wasOwner,registered,pendingClose,nativeExit,failedSteps:cleanupErrors-cleanupErrorStart},{flush:true});}catch{}
  cleanupStep("diagnostics",()=>{
    if(completeDiagnostics){const complete=completeDiagnostics;completeDiagnostics=null;complete();}
    else layoutResources.diagnostics?.requestDispose?.();
  });
}

const controller = { get active() { return applied && !disposed; },
  get ownsPreferences(){return ownsPreferences;}, cleanup,
  geometryPreflightVersion:1,
  prepareWorkspaceGeometry(){return !disposed&&removeTabStrip?.prepareWorkspaceGeometry?.()===true;},
  invalidateBookmarkContour(){if(!disposed)removeTabStrip?.invalidateBookmarkContour?.();},
  prepareBookmarkContour(){if(!disposed)removeTabStrip?.prepareBookmarkContour?.();},
  captureCenterTopology(row){return removeTabStrip?.captureCenterTopology?.(row)??null;},
  captureCenterGeometry(row,mode){return removeTabStrip?.captureCenterGeometry?.(row,mode)??null;} };

// One startup selection per browser process. Never redirect a projected
// child, a private/unsynced window or a live reload of this mod.
async function initializeFreeAtStartup(allowed=()=>true){
  try{
    const native=window.gZenWorkspaces;
    const current=()=>allowed()&&!disposed&&!window.closed&&!window.__oneplaneWorkspaceProjection&&
      window.gZenWorkspaces===native&&native?.workspaceEnabled&&!native.privateWindowOrDisabled&&native.currentWindowIsSyncing;
    if(!current())return;
    const runtime=Services.prefs.getDefaultBranch("");
    const key="zen.oneplane.runtime.free-startup-claimed";
    if(runtime.getBoolPref(key,false))return;
    await runWorkspaceCommand(window,native,"free-startup",current,async lease=>{
      requireWorkspaceCommand(window,native,lease);
      if(runtime.getBoolPref(key,false))return;
      const stored=prefs.getStringPref("zen.oneplane.free-space-id","");
      const trash=prefs.getStringPref("zen.oneplane.trash-space-id","");
      let id=stored&&stored!==trash&&native.getWorkspaceFromId(stored)?stored:"";
      if(!id){
        if(stored&&stored===trash)throw workspaceCommandError("free-role-conflict");
        if(native.getWorkspaces().some(s=>String(s.name||"").trim().toLowerCase()==="free")){
          runtime.setBoolPref(key,true);return; // explicit manual designation
        }
        id=await designateWorkspaceFree(window,native,prefs,lease);
      }
      requireWorkspaceCommand(window,native,lease);
      if(prefs.getStringPref("zen.oneplane.free-space-id","")!==id||prefs.getStringPref("zen.oneplane.trash-space-id","")===id)throw workspaceCommandError("free-changed");
      await switchWorkspaceWithin(window,native,id,lease);
      requireWorkspaceCommand(window,native,lease);
      // Only a confirmed selection (or deliberate ambiguity) consumes the
      // process startup claim. Native partial creation is never rolled back.
      if(prefs.getStringPref("zen.oneplane.free-space-id","")!==id||prefs.getStringPref("zen.oneplane.trash-space-id","")===id)throw workspaceCommandError("free-changed");
      runtime.setBoolPref(key,true);
      console.info("[OnePlane] Free startup",JSON.stringify({selected:true}));
    },{data:true});
  }catch(error){console.warn("[OnePlane] Free startup:",nocturneErrorClass(error));}
}

// A slow Free command must not prevent the entire Layout from mounting.
// This deadline ends only startup intent, never the actual native lease.
function waitFreeAtStartup(){
  return new Promise(resolve=>{
    let active=true,timer=0;
    const scope=createDisposableScope();
    const finish=reason=>{
      if(!active)return;active=false;
      scope.dispose();
      if(timer)try{window.clearTimeout(timer);}catch{}
      if(cancelFreeStartupWait===finish)cancelFreeStartupWait=null;
      try{window.__nocturneTrace?.("workspace.startup.wait",{reason},{flush:true});}catch{}
      resolve();
    };
    cancelFreeStartupWait=finish;
    const onInput=event=>{if(event.isTrusted)finish("user-takeover");};
    try{
      scope.listen(window,"pointerdown",onInput,true);
      scope.listen(window,"keydown",onInput,true);
      if(!active)return;
      timer=window.setTimeout(()=>finish("deadline"),5000);
      if(!active){window.clearTimeout(timer);return;}
    }catch{finish("setup-error");return;}
    Promise.resolve(initializeFreeAtStartup(()=>active)).then(()=>finish("settled"),()=>finish("error"));
  });
}

async function activate() {
    typeof window!=="undefined"&&window.__nocturneTrace?.("layout.activate.begin",()=>({reloadingLayout}),{sample:1800});
  const current=()=>!disposed&&!window.closed&&window[CONTROLLER]===controller;
  try {
    await window.SessionStore?.promiseAllWindowsRestored;
    await window.gZenWorkspaces?.promiseInitialized;
    typeof window!=="undefined"&&window.__nocturneTrace?.("layout.native.ready",()=>({closed:window.closed}),{sample:1800});
    if (!current() || root.hasAttribute("popup-window")) return;
    if(!reloadingLayout)await waitFreeAtStartup();
    if(!current())return;
    const manager = window.gZenCompactModeManager;
    if (!manager || typeof manager.hideToolbar !== "function") {
      throw new Error("Unsupported Zen Compact Mode API.");
    }
    const shared=otherActiveWindow();
    if(!current())return;
    preferenceMutation=true;
    ownsPreferences=true;
    try{
      let saved;
      try{saved=shared?null:snapshot();}
      catch(error){
        // No native target has been written by this acquisition yet.
        // Do not restore an unvalidated backup.
        ownsPreferences=false;throw error;
      }
      if(!current())return;
      applied=true;
      try{window.__nocturneTrace?.("layout.prefs.lease",{action:"acquire",shared},{flush:true});}catch{}
      // Only the first live window applies global native preferences.
      if(!shared)for (const [name, value] of Object.entries(TARGET)) {
        if(!current())return;
        const actual=prefs.getBoolPref(name);
        if(actual===value)continue;
        if(saved[name].owned!==undefined){
          saved[name]={value:actual,user:prefs.prefHasUserValue(name),owned:true};
          prefs.setStringPref(KEY,JSON.stringify(saved));
          if(!current())return;
        }
        prefs.setBoolPref(name,value);
      }
    }finally{
      preferenceMutation=false;
      finishCleanup();
    }
    if(!current())return;
    // Zen 1.24.2b hideToolbar() unconditionally writes both hide prefs,
    // including on joining windows. TARGET already owns these writes;
    // emit only its native layout notification, without duplicate mutation.
    window.dispatchEvent(new window.CustomEvent("ZenCompactMode:LayoutUpdate"));
    if(!current())return;
    const strip=installTabStrip();
    // Mount dispatches synchronous native/UI events. Cleanup may have run
    // before installTabStrip returned its handle.
    if(!current()){
      cleanupStep("stale strip mount",strip);
      try{window.__nocturneTrace?.("layout.mount.stale",{stage:"return"},{flush:true});}catch{}
      return;
    }
    removeTabStrip = strip;
    typeof window!=="undefined"&&window.__nocturneTrace?.("layout.strip.installed",()=>({installed:!!removeTabStrip}),{sample:1800});
    // Native state changes and animations remain owned by Zen.
    root.setAttribute("oneplane-active", "true");
    if(!current())return;
    // Publish readiness after activation has allowed geometry and the
    // native toolbar to settle. No dependency on Zen Refined.
    window.dispatchEvent(new window.CustomEvent("ZenCompactMode:LayoutUpdate"));
    if(!current())return;
    window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{
      if(!current())return;
      root.setAttribute("data-op-startup-ready","true");
    typeof window!=="undefined"&&window.__nocturneTrace?.("layout.ready",()=>({paintCount:window.windowUtils?.paintCount}),{sample:3000,flush:true});
      if(window.__nocturneLayoutStartup===startupRecord)startupRecord.readyAt=window.performance.now();
      window.dispatchEvent(new window.CustomEvent("OnePlane:StartupState"));
    }));
  } catch (error) {
    console.error("[OnePlane] Layout activation failed:",nocturneErrorClass(error));
    cleanup();
  }
}

const reloadingLayout=!!(window[CONTROLLER]||window.__nocturneLayoutStartup);
const startupRecord={initial:!reloadingLayout&&!window.__nocturneLayoutStartup,readyAt:null,homeState:"skipped"};
if (!root.hasAttribute("popup-window") && typeof window.addUnloadListener === "function") {
  window[CONTROLLER]?.cleanup();
  window[CONTROLLER] = controller;
  const current=()=>!disposed&&!window.closed&&window[CONTROLLER]===controller;
  try{
    // Claim this generation and register teardown before publishing
    // StartupState: synchronous consumers may dispose this controller.
    completeDiagnostics=layoutResources.diagnostics?.claimLayout?.(cleanup)||null;
    window.addEventListener("beforeunload", markClosing, true);
    // Idempotent fallback for unavailable/forced-disposed Diagnostics.
    // A descendant unload must not consume a one-shot window listener.
    window.addEventListener("unload", nativeUnload);
    window.addUnloadListener(cleanup);
    window.__nocturneLayoutStartup=startupRecord;
    root.setAttribute("data-op-startup-ready","pending");
    if(!current())cleanup();
    else{
      window.dispatchEvent(new window.CustomEvent("OnePlane:StartupState"));
      if(!current())cleanup();
      else if(window.gBrowserInit?.delayedStartupFinished)void activate();
      else{
        startupObserver=subject=>{
          if(subject!==window||!current())return;
          Services.obs.removeObserver(startupObserver,"browser-delayed-startup-finished");
          startupObserver=null;
          void activate();
        };
        Services.obs.addObserver(startupObserver,"browser-delayed-startup-finished");
      }
    }
  }catch(error){
    console.error("[OnePlane] Layout registration failed:",nocturneErrorClass(error));
    cleanup();
  }
}
