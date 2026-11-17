/* Zen Refined — workspace transition; explicit Home/Hub integration.
 * Native workspace ownership, page surfaces and theme animation stay in Zen. */
(()=>{
  const win=window,root=document.documentElement,prefs=Services.prefs;
  const KEY="__zenRefinedWorkspaceTransition",PREF="zen.refined.workspace.transition";
  const PHASE="data-zr-workspace-phase",MARK="data-zr-workspace-motion",PROGRESS="--zr-workspace-progress";
  const get=id=>document.getElementById(id);
  if(typeof win.addUnloadListener!=="function"||root.hasAttribute("popup-window"))return;
  win[KEY]?.dispose?.();
  let dead=false,active=null,request=null,uri=null,style=null,registered=false;
  // This gate survives replacement of the visual controller in the same
  // window. Native work already in flight cannot be cancelled by WAAPI.
  const GATE="__nocturneWorkspaceCommandGate";
  const gate=win[GATE]??(win[GATE]={pending:null});
  function invokeNative(req,nativeSwitch){
    if(dead||win.closed||req.superseded)return;
    const pending=Promise.resolve().then(()=>{
      if(dead||win.closed||req.superseded)return;
      return nativeSwitch();
    });
    gate.pending=pending;
    const release=()=>{if(gate.pending===pending)gate.pending=null;};
    pending.then(release,release);
    return pending;
  }
  const reduced=win.matchMedia("(prefers-reduced-motion: reduce)");
  function eligible(state){return !state.dead&&!state.busy&&!state.reduced&&!state.startup&&state.enabled&&!state.fullscreen&&!state.interacting;}
  function units(){
    // Stable surface targets survive tab mirror repartition and Places rebuild.
    const row=get("oneplane-tabs"),one=root.getAttribute("oneplane-active")==="true"&&row?.getAttribute("data-ready")==="true";
    const candidates=[one?row:get("tabbrowser-tabs"),get("PlacesToolbarItems")];
    return candidates.filter(n=>{
      if(!n||n.hidden||n.collapsed||!n.isConnected)return false;
      const r=n.getBoundingClientRect(),s=win.getComputedStyle(n);
      return r.width>1&&r.height>1&&r.right>0&&r.left<win.innerWidth&&r.bottom>0&&r.top<win.innerHeight&&s.display!=="none"&&s.visibility!=="hidden";
    });
  }
  let geometryLock=null;
  const GEOMETRY="data-zr-workspace-geometry",SURFACE="data-zr-workspace-surface",PAGE="data-zr-workspace-page",MOVE="data-zr-workspace-row-move";
  const HEIGHT="--zr-workspace-height",SURFACE_HEIGHT="--zr-workspace-surface-height";
  function rect(n){return n?.isConnected?n.getBoundingClientRect():null;}
  function lockGeometry(){
    if(geometryLock||root.getAttribute("oneplane-active")!=="true")return;
    const wrapper=get("zen-appcontent-navbar-wrapper"),surface=get("oneplane-toolbar-surface");
    const wr=rect(wrapper),sr=rect(surface);
    if(!wr||!sr||wr.height<2||sr.height<2)return;
    geometryLock={wrapper,surface,height:wr.height,surfaceHeight:sr.height,
      bookmarkTop:rect(get("PlacesToolbarItems"))?.top??null,pageTop:rect(get("tabbrowser-tabpanels"))?.top??null};
    wrapper.style.setProperty(HEIGHT,wr.height+"px");
    surface.style.setProperty(SURFACE_HEIGHT,sr.height+"px");
    wrapper.setAttribute(GEOMETRY,"true");
  }
  function releaseGeometry(){
    const old=geometryLock;geometryLock=null;
    if(!old)return null;
    old.wrapper.removeAttribute(GEOMETRY);old.wrapper.style.removeProperty(HEIGHT);
    old.surface.style.removeProperty(SURFACE_HEIGHT);
    return old;
  }
  function phase(value){
    if((root.getAttribute(PHASE)||null)===(value||null))return;
    if(value==="swap")lockGeometry();
    if(value)root.setAttribute(PHASE,value);else {releaseGeometry();root.removeAttribute(PHASE);}
    try{win.__zenMagneticBookmarksShared?.syncAddressState?.();}catch(error){console.warn("[Nocturne] Workspace bookmarks:",error);}
    win.dispatchEvent(new win.CustomEvent("ZenRefined:WorkspaceTransition",{detail:{phase:value||"idle"}}));
  }
  function restore(tx){
    for(const [n,old] of tx.styles){
      for(const [k,v,p] of old){if(v)n.style.setProperty(k,v,p);else n.style.removeProperty(k);}
      n.removeAttribute(MARK);n.removeAttribute(SURFACE);n.removeAttribute(PAGE);n.removeAttribute(MOVE);
    }
    tx.styles.clear();
  }
  function cancelEffects(tx){for(const a of tx.animations)try{a.cancel();}catch{}tx.animations.clear();restore(tx);}
  function cleanup(tx,keepGate=false){
    if(active!==tx)return;
    tx.cancelled=true;
    cancelEffects(tx);
    for(const t of tx.timers)win.clearTimeout(t);
    for(const resolve of tx.waiters)resolve();
    tx.timers.clear();tx.waiters.clear();
    active=null;if(!keepGate)phase(null);
  }
  function pause(tx,ms){
    if(tx.cancelled)return Promise.resolve();
    return new Promise(resolve=>{
      const done=()=>{win.clearTimeout(t);tx.waiters.delete(done);tx.timers.delete(t);resolve();};
      const t=win.setTimeout(done,ms);tx.timers.add(t);tx.waiters.add(done);
    });
  }
  function saveEffect(tx,n,mark,properties){
    if(!n?.isConnected)return false;
    tx.styles.set(n,Object.keys(properties).map(k=>[k,n.style.getPropertyValue(k),n.style.getPropertyPriority(k)]));
    for(const [k,v] of Object.entries(properties))n.style.setProperty(k,String(v));
    n.setAttribute(mark,"true");return true;
  }
  function playEffect(tx,n,from,to,length,easing){
    try{
      const a=n.animate([{[PROGRESS]:String(from)},{[PROGRESS]:String(to)}],{duration:length,easing,fill:"both"});
      tx.animations.add(a);return a.finished.catch(()=>{});
    }catch{return Promise.resolve();}
  }
  function heightScale(oldHeight,newHeight){
    return oldHeight>0&&newHeight>0?Math.max(.25,Math.min(4,oldHeight/newHeight)):1;
  }
  function neutralTranslate(n){
    const t=win.getComputedStyle(n).translate;
    return !t||t==="none"||/^0(?:px|%)?(?: 0(?:px|%)?){0,2}$/.test(t);
  }
  function animate(tx,items,outgoing,old=null){
    const length=outgoing?180:300,effects=[],ease="cubic-bezier(.22,.75,.25,1)";
    for(const n of items){
      const dy=!outgoing&&n===get("PlacesToolbarItems")&&old?.bookmarkTop!=null?old.bookmarkTop-n.getBoundingClientRect().top:0;
      const move=neutralTranslate(n),offset=Math.max(-180,Math.min(180,dy+(outgoing?-6:8)));
      if(!saveEffect(tx,n,MARK,{[PROGRESS]:outgoing?1:0,"--zr-workspace-row-y":offset+"px"}))continue;
      if(move)n.setAttribute(MOVE,"true");
      effects.push(playEffect(tx,n,outgoing?1:0,outgoing?0:1,length,ease));
    }
    if(!outgoing){
      const surface=get("oneplane-toolbar-surface"),sr=rect(surface);
      if(old&&sr&&saveEffect(tx,surface,SURFACE,{[PROGRESS]:0,"--zr-workspace-height-scale":heightScale(old.surfaceHeight,sr.height)}))
        effects.push(playEffect(tx,surface,0,1,length,ease));
      const page=get("tabbrowser-tabpanels"),pr=rect(page);
      // Keep the page opaque. Animate chrome deck only, no web DOM or captures.
      if(root.getAttribute("oneplane-active")==="true"&&pr&&pr.width>1&&pr.height>1&&!page.hasAttribute("data-zr-home-covered")&&neutralTranslate(page)){
        const dy=old?.pageTop!=null?old.pageTop-pr.top:0;
        if(saveEffect(tx,page,PAGE,{[PROGRESS]:0,"--zr-workspace-page-y":Math.max(-180,Math.min(180,dy+8))+"px"}))
          effects.push(playEffect(tx,page,0,1,length,ease));
      }
    }
    return Promise.race([Promise.all(effects),pause(tx,length+60)]);
  }
  async function settled(tx){
    // Native Places invalidation is asynchronous. Wait for a short
    // mutation-quiet interval, with a hard upper bound.
    let changed=win.performance.now(),start=changed,observer=null;
    try{
      observer=new win.MutationObserver(()=>{changed=win.performance.now();});
      for(const n of [get("PlacesToolbarItems"),get("oneplane-tabs")||get("tabbrowser-tabs")])if(n)observer.observe(n,{
        childList:true,subtree:true,attributes:true,
        attributeFilter:["hidden","collapsed","data-selected","data-op-overflow-row","data-op-split-active"]
      });
      // Bounded quiet interval after the native switch and mirror update.
      await pause(tx,105);
      while(!tx.cancelled&&win.performance.now()-start<525&&win.performance.now()-changed<100)await pause(tx,35);
    }finally{observer?.disconnect();}
  }
  async function run(nativeSwitch){
    if(typeof nativeSwitch!=="function")throw TypeError("Native workspace callback required");
    if(dead||win.closed)return;
    if(request)request.superseded=true;
    const carrySwap=root.getAttribute(PHASE)==="swap";
    if(active){
      active.superseded=true;
      if(carrySwap&&gate.pending)active.skipMotion=true;
      else cleanup(active,carrySwap);
    }
    const req={superseded:false,carrySwap};request=req;
    try{
      // Coalesce waiting requests to the latest intent; never start a
      // second native operation while an earlier one is unresolved.
      while(gate.pending){
        try{await gate.pending;}catch{}
        if(dead||win.closed||req.superseded)return;
      }
      if(dead||win.closed||req.superseded)return;
      if(active)cleanup(active,req.carrySwap);
      return await perform(req,nativeSwitch);
    }finally{if(request===req)request=null;}
  }
  async function perform(req,nativeSwitch){
    const invoke=()=>invokeNative(req,nativeSwitch);
    const row=get("oneplane-tabs"),url=get("urlbar");
    const interacting=!!(row?.hasAttribute("data-op-dragging")||row?.hasAttribute("data-op-cascade")||
      url?.hasAttribute("open")||url?.getAttribute("focused")==="true"||root.hasAttribute("data-op-bookmark-wave"));
    if(!registered||!eligible({dead,busy:!!active,reduced:reduced.matches,startup:root.hasAttribute("data-zr-startup-phase")||root.getAttribute("data-op-startup-ready")==="pending",enabled:prefs.getBoolPref(PREF,true),fullscreen:root.hasAttribute("customizing")||root.getAttribute("inDOMFullscreen")==="true"||root.getAttribute("inFullscreen")==="true"||root.hasAttribute("data-zr-closing"),interacting})){
      phase(null);return invoke();
    }
    const tx={animations:new Set(),styles:new Map(),timers:new Set(),waiters:new Set(),cancelled:false,superseded:false,skipMotion:false};active=tx;
    // Native switching owns its own promise; visual gating must never
    // remain stuck if that promise is slow or fails to settle.
    tx.timers.add(win.setTimeout(()=>cleanup(tx),2500));
    let called=false,result;
    try{
      const old=units();
      if(!old.length&&!req.carrySwap){cleanup(tx);called=true;return await invoke();}
      if(!req.carrySwap){phase("out");await animate(tx,old,true);}
      if(tx.superseded||req.superseded||dead||win.closed)return;
      if(!tx.cancelled){phase("swap");cancelEffects(tx);}
      called=true;result=await invoke();
      if(tx.cancelled||req.superseded)return result;
      await settled(tx);
      if(tx.cancelled||req.superseded)return result;
      const geometry=releaseGeometry();
      try{win.__oneplaneLayoutController?.prepareWorkspaceGeometry?.();}catch(error){console.warn("[Nocturne] Workspace geometry:",error);}
      if(tx.skipMotion)return result;
      const incoming=units(),motion=animate(tx,incoming,false,geometry);
      phase("in");
      await motion;
      return result;
    }catch(error){
      if(!called){called=true;cleanup(tx);return tx.superseded||req.superseded||dead||win.closed?undefined:invoke();}
      throw error;
    }finally{
      const successor=!dead&&request&&request!==req&&!request.superseded&&request.carrySwap;
      cleanup(tx,!!successor&&root.getAttribute(PHASE)==="swap");
    }
  }
  function abort(){if(active)cleanup(active);else phase(null);}
  function onKey(e){
    if(e.key!=="Escape"||!active)return;
    const tx=active;tx.skipMotion=true;
    // Escape skips decorative motion, not the native command or swap gate.
    if(root.getAttribute(PHASE)==="out"){
      phase("swap");cancelEffects(tx);
      for(const resolve of [...tx.waiters])resolve();
    }
    // During swap wait for settled; during incoming let its short fade end.
  }
  function dispose(){
    if(dead)return;dead=true;if(request)request.superseded=true;abort();phase(null);
    win.removeEventListener("unload",dispose);win.removeEventListener("keydown",onKey,true);win.removeEventListener("beforecustomization",abort);
    reduced.removeEventListener("change",abort);try{prefs.removeObserver(PREF,abort);}catch{}
    if(uri)try{win.windowUtils.removeSheet(uri,win.windowUtils.USER_SHEET);}catch{}
    style?.remove();if(win[KEY]===api)delete win[KEY];
  }
  const api={run,dispose};
  try{
    try{win.CSS.registerProperty({name:PROGRESS,syntax:"<number>",inherits:false,initialValue:"1"});registered=true;}catch(e){registered=e.name==="InvalidModificationError";}
    // Scope important overrides to the animated chrome only; Magnetic
    // Bookmarks uses important translate/transform in its normal state.
    const spec=":is(#zr-workspace-specificity,["+MARK+"],["+GEOMETRY+"],["+SURFACE+"],["+PAGE+"],#oneplane-toolbar-surface)".repeat(8);
    const motion=":root[data-zr-workspace-phase] ["+MARK+"]"+spec;
    const sheet=motion+"{transition-property:none!important;opacity:var("+PROGRESS+")!important;scale:calc(.97 + .03 * var("+PROGRESS+"))!important;transform-origin:center top!important;pointer-events:none!important;}"+
      motion+'['+MOVE+']{translate:0 calc(var(--zr-workspace-row-y)*(1 - var('+PROGRESS+')))!important;}'+
      ':root[data-zr-workspace-phase="swap"] :is(#oneplane-tabs,#PlacesToolbarItems,#tabbrowser-tabs){opacity:0!important;pointer-events:none!important;}'+
      ':root[data-zr-workspace-phase="swap"] :is(#oneplane-tabs *,#PlacesToolbarItems *){transition-property:none!important;pointer-events:none!important;}'+
      ':root[data-zr-workspace-phase] #zen-appcontent-navbar-wrapper{transition-property:none!important;}'+
      ':root[data-zr-workspace-phase] #zen-appcontent-navbar-wrapper['+GEOMETRY+']'+spec+'{height:var('+HEIGHT+')!important;min-height:var('+HEIGHT+')!important;max-height:var('+HEIGHT+')!important;}'+
      ':root[data-zr-workspace-phase] #zen-appcontent-navbar-wrapper['+GEOMETRY+'] > #oneplane-toolbar-surface'+spec+'{height:var('+SURFACE_HEIGHT+')!important;}'+
      ':root[data-zr-workspace-phase] ['+SURFACE+']'+spec+'{scale:1 calc(var(--zr-workspace-height-scale) + (1 - var(--zr-workspace-height-scale))*var('+PROGRESS+'))!important;transform-origin:top center!important;transition-property:none!important;}'+
      ':root[data-zr-workspace-phase] ['+PAGE+']'+spec+'{translate:0 calc(var(--zr-workspace-page-y)*(1 - var('+PROGRESS+')))!important;transition-property:none!important;}';
    try{uri=Services.io.newURI("data:text/css;charset=utf-8,"+encodeURIComponent(sheet));win.windowUtils.loadSheet(uri,win.windowUtils.USER_SHEET);}
    catch{uri=null;style=document.createElementNS("http://www.w3.org/1999/xhtml","style");style.textContent=sheet;root.append(style);}
    win[KEY]=api;win.addUnloadListener(dispose);win.addEventListener("unload",dispose,{once:true});
    win.addEventListener("keydown",onKey,true);win.addEventListener("beforecustomization",abort);
    reduced.addEventListener("change",abort);prefs.addObserver(PREF,abort);
  }catch(error){console.warn("[Zen Refined] Workspace transition:",error);dispose();}
})();
