// Nocturne preview.36: early trace, independent Sine script order.
try{if(typeof window!=="undefined"){
  const event="workspace.script",data={version:"0.3.0-preview.127"};
  if(window.__nocturneTrace)window.__nocturneTrace(event,data,{sample:1500});
  else{const q=window.__nocturneEarlyTrace??(window.__nocturneEarlyTrace=[]);if(q.length<32)q.push({event,t:window.performance?.now?.()??0,data});}
}}catch{}
/* Zen Refined — workspace transition; explicit Home/Hub integration.
 * Native workspace ownership, page surfaces and theme animation stay in Zen. */
(()=>{
  const win=window,root=document.documentElement,prefs=Services.prefs;
  const KEY="__zenRefinedWorkspaceTransition",PREF="zen.refined.workspace.transition";
  const PHASE="data-zr-workspace-phase",MARK="data-zr-workspace-motion",PROGRESS="--zr-workspace-progress";
  const get=id=>document.getElementById(id);
  if(typeof win.addUnloadListener!=="function"||root.hasAttribute("popup-window"))return;
  win[KEY]?.dispose?.();
  let dead=false,active=null,request=null,registered=false,transitionCount=0;
  // This gate survives replacement of the visual controller in the same
  // window. Native work already in flight cannot be cancelled by WAAPI.
  const GATE="__nocturneWorkspaceCommandGate";
  const gate=win[GATE]??(win[GATE]={pending:null});
  let syncDepth=0;
  function visualStep(fn){syncDepth++;try{return fn();}finally{syncDepth--;}}
  function invokeNative(req,nativeSwitch){
    if(dead||win.closed||req.superseded||request!==req)return;
    if(req.lease){
      if(gate.owner!==req.lease||!gate.pending)throw Error("Workspace command lease lost");
      return nativeSwitch();
    }
    if(gate.pending||gate.reservation)throw Error("Workspace command already pending");
    const pending=Promise.resolve().then(()=>{
      if(dead||win.closed||req.superseded||request!==req||gate.reservation)return;
      return nativeSwitch();
    });
    gate.pending=pending;gate.startedAt=Number.isFinite(win.performance?.timeOrigin)?win.performance.timeOrigin+win.performance.now():Date.now();
    const notify=()=>{try{if(!win.closed)win.dispatchEvent(new win.CustomEvent("Nocturne:WorkspaceCommandChanged"));}catch{}};
    const release=()=>{if(gate.pending===pending){gate.pending=null;delete gate.startedAt;notify();}};
    notify();
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
  const GEOMETRY="data-zr-workspace-geometry",SURFACE="data-zr-workspace-surface",PAGE="data-zr-workspace-page",MOVE="data-zr-workspace-row-move",BACKING="data-zr-workspace-backing";
  const HEIGHT="--zr-workspace-height",SURFACE_HEIGHT="--zr-workspace-surface-height";
  function rect(n){return n?.isConnected?n.getBoundingClientRect():null;}
  function lockGeometry(){
    if(geometryLock||root.getAttribute("oneplane-active")!=="true")return;
    const wrapper=get("zen-appcontent-navbar-wrapper"),surface=get("oneplane-toolbar-surface");
    const wr=rect(wrapper),sr=rect(surface);
    if(!wr||!sr||wr.height<2||sr.height<2)return;
    typeof window!=="undefined"&&window.__nocturneTrace?.("workspace.geometry.lock",()=>({height:wr.height,surfaceHeight:sr.height}),{sample:1800});
    geometryLock={wrapper,surface,height:wr.height,surfaceHeight:sr.height,
      bookmarkTop:rect(get("PlacesToolbarItems"))?.top??null,pageTop:rect(get("tabbrowser-tabpanels"))?.top??null};
    wrapper.style.setProperty(HEIGHT,wr.height+"px");
    surface.style.setProperty(SURFACE_HEIGHT,sr.height+"px");
    wrapper.setAttribute(GEOMETRY,"true");
  }
  function releaseGeometry(){
    const old=geometryLock;geometryLock=null;
    typeof window!=="undefined"&&window.__nocturneTrace?.("workspace.geometry.release",()=>({locked:!!old,height:old?.height,surfaceHeight:old?.surfaceHeight}),{sample:1800});
    if(!old)return null;
    let failed=0;
    const step=fn=>{try{fn();}catch{failed++;}};
    step(()=>old.wrapper.removeAttribute(GEOMETRY));
    step(()=>old.wrapper.style.removeProperty(HEIGHT));
    step(()=>old.surface.style.removeProperty(SURFACE_HEIGHT));
    if(failed)try{window.__nocturneTrace?.("workspace.geometry.cleanup",{failed},{flush:true});}catch{}
    return old;
  }
  function phase(value){return visualStep(()=>setPhase(value));}
  function setPhase(value){
    if(value&&dead)return;
    if(!value)releaseGeometry();
    if((root.getAttribute(PHASE)||null)===(value||null))return;
    typeof window!=="undefined"&&window.__nocturneTrace?.("workspace.phase",()=>({from:root.getAttribute(PHASE),to:value,locked:!!geometryLock}),{sample:1800});
    if(value)root.setAttribute(PHASE,value);else root.removeAttribute(PHASE);
    try{win.__zenMagneticBookmarksShared?.syncAddressState?.();}catch(error){console.warn("[Nocturne] Workspace bookmarks:",error);}
    win.dispatchEvent(new win.CustomEvent("ZenRefined:WorkspaceTransition",{detail:{phase:value||"idle"}}));
    if(dead||root.getAttribute(PHASE)!==(value||null))return;
    // First collapse hover decorations and acquire the panel hold, then
    // snapshot resting geometry. No extra painted frame between these steps.
    if(value==="out"||value==="swap")lockGeometry();
    win.__nocturneTrace?.("workspace.visual.boundary",()=>({phase:value||"idle",sequence:active?.sequence||transitionCount,panelOpen:get("zen-appcontent-navbar-wrapper")?.hasAttribute("data-op-panel-open"),height:rect(get("zen-appcontent-navbar-wrapper"))?.height,surface:rect(get("oneplane-toolbar-surface"))?.height,bookmarkTop:rect(get("PlacesToolbarItems"))?.top}),{sample:1200});
  }
  function restore(tx){
    let failed=0;
    const step=fn=>{try{fn();}catch{failed++;}};
    for(const [n,old] of tx.styles){
      for(const [k,v,p] of old)step(()=>{if(v)n.style.setProperty(k,v,p);else n.style.removeProperty(k);});
      for(const mark of [MARK,SURFACE,PAGE,MOVE,BACKING,"data-zr-workspace-card","data-zr-workspace-height-motion"])
        step(()=>n.removeAttribute(mark));
    }
    tx.styles.clear();return failed;
  }
  function cancelEffects(tx){
    let failed=0;
    const step=fn=>{try{fn();}catch{failed++;}};
    const center=tx.center;tx.center=null;step(()=>center?.release());
    for(const a of tx.animations)step(()=>a.cancel());
    tx.animations.clear();failed+=restore(tx);
    if(failed)try{window.__nocturneTrace?.("workspace.effects.cleanup",{failed},{flush:true});}catch{}
    return failed;
  }
  function cleanup(tx,keepGate=false){return visualStep(()=>cleanupNow(tx,keepGate));}
  function cleanupNow(tx,keepGate=false){
    if(active!==tx||tx.cleaning)return;
    tx.cancelled=true;tx.cleaning=true;
    let failed=0;
    const step=fn=>{try{fn();}catch{failed++;}};
    step(()=>{failed+=cancelEffects(tx);});
    for(const t of tx.timers)step(()=>win.clearTimeout(t));
    for(const resolve of [...tx.waiters])step(resolve);
    tx.timers.clear();tx.waiters.clear();
    active=null;tx.cleaning=false;
    if(!keepGate||dead)step(()=>phase(null));
    try{win.__nocturneTrace?.("workspace.cleanup",{failed,keepGate:!!keepGate,sequence:tx.sequence},{flush:true});}catch{}
  }
  function pause(tx,ms){
    if(tx.cancelled)return Promise.resolve();
    return new Promise(resolve=>{
      const done=()=>{
        try{win.clearTimeout(t);}catch{}
        tx.waiters.delete(done);tx.timers.delete(t);resolve();
      };
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
    const length=outgoing?460:560,effects=[],ease="cubic-bezier(.25,.55,.25,1)";
    const row=get("oneplane-tabs");
    // Read all final geometry before any effect changes its painted rect.
    const surface=get("oneplane-toolbar-surface"),sr=rect(surface),wrapper=get("zen-appcontent-navbar-wrapper"),wr=rect(wrapper);
    const finalSurfaceHeight=surface?Number(surface.offsetHeight)||sr?.height:0;
    const page=get("tabbrowser-tabpanels"),pr=rect(page);
    if(row&&items.includes(row)){
      tx.center=win.__nocturneCenterMotion?.start(row,{owner:"workspace",direction:outgoing?"out":"in",duration:length,
        onTopologyInvalidated:()=>{if(active===tx&&!tx.cancelled)cleanup(tx);}});
      if(tx.center)effects.push(tx.center.finished);
    }
    typeof window!=="undefined"&&window.__nocturneTrace?.("workspace.animate",()=>({outgoing,length,targets:items.length,locked:!!old}),{sample:1800});
    for(const n of items){
      const dy=!outgoing&&n===get("PlacesToolbarItems")&&old?.bookmarkTop!=null?old.bookmarkTop-n.getBoundingClientRect().top:0;
      const move=n!==row&&neutralTranslate(n),offset=Math.max(-180,Math.min(180,dy));
      if(!saveEffect(tx,n,MARK,{[PROGRESS]:outgoing?1:0,"--zr-workspace-row-y":offset+"px"}))continue;
      if(move)n.setAttribute(MOVE,"true");
      effects.push(playEffect(tx,n,outgoing?1:0,outgoing?0:1,length,ease));
    }
    // The shared contour is the sole compact shelf background.
    if(!outgoing){
      if(old&&sr&&saveEffect(tx,surface,SURFACE,{[PROGRESS]:0,"--zr-workspace-height-scale":heightScale(old.surfaceHeight,finalSurfaceHeight),"--zr-workspace-final-surface-height":finalSurfaceHeight+"px"}))
        effects.push(playEffect(tx,surface,0,1,length,ease));
      // Compact chrome is an overlay. Match its hitbox height to the same
      // timeline as the shelf and bookmarks without touching page layout.
      if(old&&wr&&root.getAttribute("zen-compact-mode")==="true"&&Math.abs(old.height-wr.height)>1&&
        saveEffect(tx,wrapper,"data-zr-workspace-height-motion",{[PROGRESS]:0,"--zr-workspace-start-height":old.height+"px","--zr-workspace-final-height":wr.height+"px"}))
        effects.push(playEffect(tx,wrapper,0,1,length,ease));
      // Keep the page opaque and stationary (Magnetic Fold Lab B).
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
        attributeFilter:["hidden","collapsed","src","data-selected","data-ready","data-op-overflow-row","data-op-adaptive-compact","data-op-home-open","data-op-split-active"]
      });
      // Bounded quiet interval after the native switch and mirror update.
      const quiet=tx.sequence===1?100:65;
      await pause(tx,quiet+10);
      let icons=null;
      while(!tx.cancelled&&win.performance.now()-start<400){
        // The first incoming workspace may lazily initialize its chrome
        // images. Keep the swap gate until geometry and icon readiness
        // agree, with the same bounded fail-open deadline.
        if(tx.sequence===1)icons=win.__nocturneCenterMotion?.warmIcons?.(get("oneplane-tabs"))||null;
        if(win.performance.now()-changed>=quiet&&(!icons||icons.pending+icons.missing===0))break;
        await pause(tx,25);
      }
      win.__nocturneTrace?.("workspace.preflight.icons",()=>({sequence:tx.sequence,pending:icons?.pending??null,missing:icons?.missing??null}),{sample:800});
      win.__nocturneTrace?.("workspace.settled",()=>({sequence:tx.sequence,elapsed:win.performance.now()-start,quiet:win.performance.now()-changed}),{sample:1000});
    }finally{try{observer?.disconnect();}catch{try{win.__nocturneTrace?.("workspace.settle.cleanup",{failed:1},{flush:true});}catch{}}}
  }
  async function run(nativeSwitch,{lease=null}={}){
    if(typeof nativeSwitch!=="function")throw TypeError("Native workspace callback required");
    typeof window!=="undefined"&&window.__nocturneTrace?.("workspace.run",()=>({active:!!active,pending:!!gate.pending,phase:root.getAttribute(PHASE)}),{sample:1800});
    if(dead||win.closed)return;
    // Production callers hold the same gate from admission to settlement.
    // Unowned compatibility callbacks cannot interrupt a managed command.
    if(lease?gate.owner!==lease:!!(gate.owner||gate.reservation))return;
    // Register intent before any synchronous native/visual callbacks.
    if(request)request.superseded=true;
    const req={superseded:false,carrySwap:root.getAttribute(PHASE)==="swap",lease};request=req;
    const current=()=>!dead&&!win.closed&&!req.superseded&&request===req;
    try{
      if(syncDepth){await Promise.resolve();if(!current())return;}
      if(active){
        active.superseded=true;
        if(req.carrySwap&&gate.pending)active.skipMotion=true;
        else cleanup(active,req.carrySwap);
      }
      if(!current())return;
      // A native command gate survives generation replacement.
      while(gate.pending&&!req.lease){
        try{await gate.pending;}catch{}
        if(!current())return;
      }
      if(!current()||(!req.lease&&gate.reservation))return;
      if(active)cleanup(active,req.carrySwap);
      if(!current())return;
      return await perform(req,nativeSwitch);
    }finally{if(request===req)request=null;}
  }
  async function perform(req,nativeSwitch){
    const invoke=()=>invokeNative(req,nativeSwitch);
    const row=get("oneplane-tabs"),url=get("urlbar");
    const interacting=!!(row?.hasAttribute("data-op-dragging")||row?.hasAttribute("data-op-cascade")||
      url?.hasAttribute("open")||url?.getAttribute("focused")==="true"||root.hasAttribute("data-op-bookmark-wave"));
    if(!registered||!eligible({dead,busy:!!active,reduced:reduced.matches,startup:root.hasAttribute("data-zr-startup-phase")||root.getAttribute("data-op-startup-ready")==="pending",enabled:prefs.getBoolPref(PREF,true),fullscreen:root.hasAttribute("customizing")||root.getAttribute("inDOMFullscreen")==="true"||root.getAttribute("inFullscreen")==="true"||root.hasAttribute("data-zr-closing"),interacting})){
    typeof window!=="undefined"&&window.__nocturneTrace?.("workspace.bypass",()=>({registered,interacting,reduced:reduced.matches,startup:root.getAttribute('data-zr-startup-phase'),ready:root.getAttribute('data-op-startup-ready')}),{sample:1800});
      phase(null);return invoke();
    }
    const tx={animations:new Set(),styles:new Map(),timers:new Set(),waiters:new Set(),cancelled:false,superseded:false,skipMotion:false,sequence:++transitionCount};active=tx;
    // Native switching owns its own promise; visual gating must never
    // remain stuck if that promise is slow or fails to settle.
    let called=false,nativeResolved=false,result;
    try{
      tx.timers.add(win.setTimeout(()=>cleanup(tx),3500));
      const old=units();
      if(!old.length&&!req.carrySwap){cleanup(tx);called=true;return await invoke();}
      if(!req.carrySwap){phase("out");if(!tx.cancelled&&!dead&&!req.superseded)await visualStep(()=>animate(tx,old,true));}
      if(!tx.cancelled&&tx.center?.validateTopology?.()===false)cleanup(tx);
      if(tx.superseded||req.superseded||dead||win.closed)return;
      if(!tx.cancelled){phase("swap");if(!tx.cancelled&&!dead&&!req.superseded)visualStep(()=>cancelEffects(tx));}
      if(req.superseded||dead||win.closed)return;
      called=true;result=await invoke();nativeResolved=true;
    typeof window!=="undefined"&&window.__nocturneTrace?.("workspace.native.end",()=>({cancelled:tx.cancelled,superseded:req.superseded}),{sample:1800});
      if(tx.cancelled||req.superseded)return result;
      await settled(tx);
      if(tx.cancelled||req.superseded)return result;
      // Release and measure in one task under the hidden swap gate.
      const geometry=releaseGeometry();
    typeof window!=="undefined"&&window.__nocturneTrace?.("workspace.reveal",()=>({skip:tx.skipMotion,oldHeight:geometry?.height,oldSurface:geometry?.surfaceHeight}),{sample:1800});
      const layout=win.__oneplaneLayoutController;
      const one=root.getAttribute("oneplane-active")==="true";
      let prepared,failed=false;
      try{if(one)prepared=visualStep(()=>layout?.prepareWorkspaceGeometry?.());}
      catch(error){failed=true;console.warn("[Nocturne] Workspace geometry:",error);}
      const ready=!one||get("oneplane-tabs")?.getAttribute("data-ready")==="true"&&!!layout&&typeof layout.prepareWorkspaceGeometry==="function"&&!failed&&win.__oneplaneLayoutController===layout&&prepared!==false&&
        (layout.geometryPreflightVersion!==1||prepared===true);
      win.__nocturneTrace?.("workspace.preflight.geometry",{sequence:tx.sequence,ready,legacy:!!one&&!!layout&&layout.geometryPreflightVersion!==1},{sample:1000});
      if(!ready||one&&win.__oneplaneLayoutController!==layout||tx.skipMotion||tx.cancelled||dead||req.superseded)return result;
      const incoming=units(),motion=visualStep(()=>animate(tx,incoming,false,geometry));
      if(tx.cancelled||dead||req.superseded)return result;
      phase("in");
      win.__nocturneTrace?.("workspace.applied",()=>({
        rows:incoming.map(n=>({opacity:win.getComputedStyle(n).opacity,scale:win.getComputedStyle(n).scale,progress:win.getComputedStyle(n).getPropertyValue?.(PROGRESS)})),
        height:rect(get("zen-appcontent-navbar-wrapper"))?.height
      }),{sample:1000});
      await motion;
      if(tx.cancelled||dead||req.superseded)return result;
      if(tx.center?.validateTopology?.()===false){cleanup(tx);return result;}
      tx.center?.seal();
      // Commit terminal styles while native CSS transitions are still disabled.
      for(const a of tx.animations)try{a.finish();}catch{}
      return result;
    }catch(error){
      if(!called){called=true;cleanup(tx);return tx.superseded||req.superseded||dead||win.closed?undefined:invoke();}
      if(nativeResolved){try{win.__nocturneTrace?.("workspace.visual.error",{name:error?.name||"Error"},{flush:true});}catch{}return result;}
      throw error;
    }finally{
      const successor=!dead&&request&&request!==req&&!request.superseded&&request.carrySwap;
      cleanup(tx,!!successor&&root.getAttribute(PHASE)==="swap");
    }
  }
  function abort(){if(dead)return;if(active)cleanup(active);else phase(null);}
  function onKey(e){
    if(dead||e.key!=="Escape"||!active)return;
    const tx=active;tx.skipMotion=true;
    typeof window!=="undefined"&&window.__nocturneTrace?.("workspace.escape",()=>({phase:root.getAttribute(PHASE)}),{sample:1800});
    // Escape skips decorative motion, not the native command or swap gate.
    if(root.getAttribute(PHASE)==="out"){
      phase("swap");if(tx.cancelled||dead)return;visualStep(()=>cancelEffects(tx));
      for(const resolve of [...tx.waiters])resolve();
    }
    // During swap wait for settled; during incoming let its short fade end.
  }
  function dispose(){
    if(dead)return;dead=true;if(request)request.superseded=true;
    let failed=0;const step=fn=>{try{fn();}catch{failed++;}};
    step(()=>{if(active)cleanup(active);});
    if(!active?.cleaning)step(()=>phase(null));
    step(()=>win.removeEventListener("unload",dispose));
    step(()=>win.removeEventListener("keydown",onKey,true));
    step(()=>win.removeEventListener("beforecustomization",abort));
    step(()=>reduced.removeEventListener("change",abort));
    step(()=>prefs.removeObserver(PREF,abort));
    if(win[KEY]===api)delete win[KEY];
    try{win.__nocturneTrace?.("workspace.dispose",{failed},{flush:true});}catch{}
  }
  const api={run,dispose};
  try{
    try{win.CSS.registerProperty({name:PROGRESS,syntax:"<number>",inherits:false,initialValue:"1"});registered=true;}catch(e){registered=e.name==="InvalidModificationError";}
    // Motion rules ship in chrome.css with the rest of OnePlane.
    // No separately loaded temporary user sheet.
    win[KEY]=api;win.addUnloadListener(dispose);win.addEventListener("unload",dispose,{once:true});
    win.addEventListener("keydown",onKey,true);win.addEventListener("beforecustomization",abort);
    reduced.addEventListener("change",abort);prefs.addObserver(PREF,abort);
  }catch(error){console.warn("[Zen Refined] Workspace transition:",error);dispose();}
})();
