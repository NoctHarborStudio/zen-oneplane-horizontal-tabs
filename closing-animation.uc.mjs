// Nocturne preview.36: early trace, independent Sine script order.
try{if(typeof window!=="undefined"){
  const event="disassembly.script",data={version:"0.3.0-preview.116"};
  if(window.__nocturneTrace)window.__nocturneTrace(event,data,{sample:1500});
  else{const q=window.__nocturneEarlyTrace??(window.__nocturneEarlyTrace=[]);if(q.length<32)q.push({event,t:window.performance?.now?.()??0,data});}
}}catch{}
/* Zen Refined — Center Disassembly. Explicit native close-window command only.
 * No interception of OS shutdown, window.close(), tab close, quit, beforeunload
 * or session persistence. All native confirmation decisions stay native.
 */
(() => {
  const KEY="__zenRefinedClosingAnimation",PREF="zen.refined.closing.animation",DURATION=760;
  const root=document.documentElement,prefs=Services.prefs;
  const MARK="data-zr-close-effect",MOVE="data-zr-close-move",CLIP="data-zr-close-clip",PROGRESS="--zr-close-progress";
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const get=id=>document.getElementById(id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  if(typeof window.addUnloadListener!=="function"||root.hasAttribute("popup-window"))return;
  window[KEY]?.();
  let dead=false,owner=null,original=null,wrapped=null,observer=null,style=null,sheet=null;
  const animations=new Set(),owned=new Map();let centerHandle=null,bookmarkHandle=null;

  function makeCloseController({eligible,begin,clear,seal=()=>{},isClosed=()=>false,later,cancelLater,invoke}){
    let pending=null,timer=null,committing=false,starting=false,finishing=false,queued=null;
    function finish(proceed){
      if(finishing||committing||!pending)return;
      if(starting){queued=queued===false?false:proceed;return;}
      const request=pending;pending=null;finishing=true;
      try{
        const oldTimer=timer;timer=null;
        if(oldTimer!==null)try{cancelLater(oldTimer);}catch{}
        if(!proceed||!request.animated){
          try{clear();}catch{}
          if(proceed)return invoke(request.receiver,request.args);
          return;
        }
        // Preserve sealed effects through the synchronous native close.
        committing=true;
        try{
          if(!request.sealed)try{seal();}catch{}
          return invoke(request.receiver,request.args);
        }finally{
          committing=false;
          if(!isClosed())try{clear();}catch{}
        }
      }finally{finishing=false;}
    }
    function sealRequest(request){
      if(pending!==request||finishing)return;
      // Reentrant close/flush during seal must not execute twice.
      starting=true;
      try{seal();}catch{}
      finally{starting=false;}
      if(pending!==request)return;
      request.sealed=true;
      const action=queued;queued=null;
      if(action!==null)return finish(action);
      try{timer=later(()=>{if(pending===request)finish(true);},110);}
      catch{if(pending===request)return finish(true);}
    }
    return {
      request(receiver,args){
        if(finishing||committing)return;
        if(pending)return finish(true);
        if(!eligible(args)){
          finishing=true;try{return invoke(receiver,args);}finally{finishing=false;}
        }
        const request={receiver,args,animated:false};pending=request;starting=true;
        try{request.animated=!!begin();}catch{}
        finally{starting=false;}
        const action=queued;queued=null;
        if(action!==null)return finish(action);
        if(request.animated){
          try{timer=later(()=>sealRequest(request),DURATION-110);return;}
          catch{}
        }
        return finish(true);
      },
      flush(){return finish(true);},
      dispose(){return finish(false);},
      get pending(){return pending!==null;},
      get committing(){return committing;},
      get busy(){return starting||finishing;}
    };
  }
  function visible(n){
    if(!n?.isConnected||n.hidden||n.collapsed)return null;
    const s=window.getComputedStyle(n),r=n.getBoundingClientRect();
    if(s.display==="none"||s.visibility!=="visible"||Number(s.opacity)<=0||r.width<2||r.height<2||
      r.right<=0||r.bottom<=0||r.left>=window.innerWidth||r.top>=window.innerHeight)return null;
    return {n,r,s};
  }
  function collect(engine){
    const row=get("oneplane-tabs"),island=row?.querySelector(".oneplane-title-island");
    const ir=visible(island),rr=visible(row),url=get("urlbar-container"),ur=visible(url);
    const center=ir?ir.r.left+ir.r.width/2:rr?rr.r.left+rr.r.width/2:ur?ur.r.left+ur.r.width/2:window.innerWidth/2;
    const result=[];
    function add(n,x=0,y=0,clip=false,delay=0,length=350){
      if(!n||result.length>=100||result.some(t=>t.n===n||t.n.contains(n)||n.contains(t.n)))return;
      const t=visible(n);if(!t)return;
      const move=t.s.translate==="none"||/^0(?:px|%)?(?: 0(?:px|%)?){0,2}$/.test(t.s.translate);
      result.push({n,x:move?x:0,y:move?y:0,clip,delay,length,opacity:Number(t.s.opacity)});
    }
    const floating=get("urlbar");
    const floatVisible=floating&&(floating.getAttribute("zen-floating-urlbar")==="true"||floating.hasAttribute("zen-newtab"));
    if(floatVisible)add(floating,0,0,true,0,280);
    if(typeof engine?.bookmarks!=="function")for(const n of Array.from(get("PlacesToolbarItems")?.children||[])){
      const t=visible(n);if(t)add(n,0,-14,false,Math.max(0,55-Math.abs(t.r.left+t.r.width/2-center)*.09),280);
    }
    if(rr){
      add(row.querySelector(".oneplane-new-tab"),-26,0,false,80,300);
      add(island,0,0,true,570,80);
    }else{
      const sidebar=get("zen-tabs-wrapper")||get("TabsToolbar");
      const t=visible(sidebar);if(t)add(sidebar,t.r.left<window.innerWidth/2?-18:18,0,false,95,330);
    }
    if(!floatVisible)add(url,0,0,true,165,330);
    const candidates=new Set();
    let captions=null;try{captions=window.gZenVerticalTabsManager?.actualWindowButtons;}catch{}
    for(const parent of [get("nav-bar-customization-target"),get("nav-bar"),captions,get("titlebar-buttonbox"),get("zen-sidebar-top-buttons")]){
      if(!parent)continue;
      for(const n of parent.querySelectorAll("toolbarbutton,button,.titlebar-button,[role=button]"))candidates.add(n);
    }
    const leaves=[...candidates].filter(n=>![...candidates].some(c=>c!==n&&n.contains(c)));
    for(const n of leaves){
      if(row?.contains(n)||url?.contains(n))continue;
      const t=visible(n);if(t)add(n,t.r.left+t.r.width/2<center?14:-14,-4,false,85+Math.min(90,Math.abs(t.r.left-center)*.12),310);
    }
    return result;
  }
  function restore(){
    let failed=0;const step=fn=>{try{fn();}catch{failed++;}};
    step(()=>window.__nocturneTrace?.("disassembly.restore",()=>({effects:animations.size,owned:owned.size,closing:root.hasAttribute("data-zr-closing")}),{sample:1000,flush:true}));
    for(const a of animations)step(()=>a.cancel());
    animations.clear();
    const center=centerHandle,bookmark=bookmarkHandle;centerHandle=null;bookmarkHandle=null;
    step(()=>center?.release());step(()=>bookmark?.release());
    for(const [n,record] of owned){
      for(const [k,v] of record.styles)step(()=>{if(v.value)n.style.setProperty(k,v.value,v.priority);else n.style.removeProperty(k);});
      for(const [k,v] of record.attrs)step(()=>{if(v===null)n.removeAttribute(k);else n.setAttribute(k,v);});
    }
    owned.clear();
    step(()=>{if(sheet)window.windowUtils.removeSheet(sheet,window.windowUtils.USER_SHEET);});
    sheet=null;step(()=>style?.remove());style=null;
    step(()=>root.removeAttribute("data-zr-closing"));
    step(()=>window.__zenMagneticBookmarksShared?.syncAddressState?.());
    step(()=>window.__nocturneTrace?.("disassembly.cleanup",{failed},{flush:true}));
  }
  function set(n,k,v){
    const rec=owned.get(n);
    if(!rec.styles.has(k))rec.styles.set(k,{value:n.style.getPropertyValue(k),priority:n.style.getPropertyPriority(k)});
    n.style.setProperty(k,v);
  }
  function attr(n,k){
    const rec=owned.get(n);if(!rec.attrs.has(k))rec.attrs.set(k,n.getAttribute(k));n.setAttribute(k,"true");
  }
  function begin(){
    const engine=window.__nocturneCenterMotion;
    const bypass=reason=>{try{window.__nocturneTrace?.("disassembly.bypass",{reason},{flush:true});}catch{}return false;};
    // Settle CSS tab hover and magnetic bookmarks before any geometry read.
    // The existing close gate owns cleanup even if collection fails.
    root.setAttribute("data-zr-closing","true");
    try{window.__zenMagneticBookmarksShared?.syncAddressState?.();}catch{return bypass("bookmark-preflight-failed");}
    if(window.__nocturneCenterMotion!==engine)return bypass("engine-replaced");
    const row=get("oneplane-tabs"),items=get("PlacesToolbarItems");
    const needsTabs=!!visible(row)&&Array.from(row.querySelectorAll(".oneplane-tab-list :is(.oneplane-tab,.oneplane-split-group)")).some(n=>!!visible(n));
    const needsBookmarks=!!visible(items)&&Array.from(items.children).some(n=>!!visible(n));
    const targets=collect(engine);if(!targets.length)return false;
    // Missing horizontal proxy support must not leave the visible strip
    // behind while other controls disappear. Native-only sidebar and the
    // existing no-bookmark-API fallback remain supported.
    if(needsTabs&&typeof engine?.start!=="function")return bypass("tab-engine-unavailable");
    typeof window!=="undefined"&&window.__nocturneTrace?.("disassembly.targets",()=>({count:targets.length,registered:typeof window.CSS?.registerProperty==='function'}),{sample:1800});
    let registered=false;
    try{window.CSS.registerProperty({name:PROGRESS,syntax:"<number>",inherits:false,initialValue:"1"});registered=true;}
    catch(e){registered=e.name==="InvalidModificationError";}
    if(registered){
      const scope=":root[data-zr-closing] [data-zr-close-effect]"+":is(#zr-close-specificity,[data-zr-close-effect])".repeat(8);
      const edge="calc(49% * (1 - var("+PROGRESS+")) - 8px * var("+PROGRESS+"))";
      const css=scope+" {transition-property:none !important;opacity:calc(var(--zr-close-opacity) * var("+PROGRESS+")) !important;}\n"+
        scope+"[data-zr-close-move] {translate:calc(var(--zr-close-x) * (1 - var("+PROGRESS+"))) calc(var(--zr-close-y) * (1 - var("+PROGRESS+"))) !important;}\n"+
        scope+"[data-zr-close-clip] {clip-path:inset(-8px "+edge+" -8px "+edge+" round 8px) !important;}";
      try{sheet=Services.io.newURI("data:text/css;charset=utf-8,"+encodeURIComponent(css));window.windowUtils.loadSheet(sheet,window.windowUtils.USER_SHEET);}
      catch{sheet=null;style=document.createElementNS("http://www.w3.org/1999/xhtml","style");style.textContent=css;root.append(style);}
    }
    centerHandle=engine?.start?.(row,{owner:"close",direction:"out",duration:620,retainOnDispose:()=>controller.committing});
    if(needsTabs&&!centerHandle?.count)return bypass("tab-acquisition-failed");
    bookmarkHandle=engine?.bookmarks?.({owner:"close",direction:"out",duration:650,retainOnDispose:()=>controller.committing});
    if(needsBookmarks&&typeof engine?.bookmarks==="function"&&!bookmarkHandle)return bypass("bookmark-acquisition-failed");
    if((centerHandle||bookmarkHandle)&&window.__nocturneCenterMotion!==engine)return bypass("engine-replaced");
    for(const {n,x,y,clip,delay,length,opacity} of targets){
      try{
        let frames;
        if(registered){
          owned.set(n,{styles:new Map(),attrs:new Map()});
          set(n,PROGRESS,"1");set(n,"--zr-close-opacity",String(opacity));attr(n,MARK);
          if(x||y){set(n,"--zr-close-x",x+"px");set(n,"--zr-close-y",y+"px");attr(n,MOVE);}
          if(clip)attr(n,CLIP);
          frames=[{[PROGRESS]:"1"},{[PROGRESS]:"0"}];
        }else{
          const from={opacity},to={opacity:0};
          if(x||y){from.translate="0px 0px";to.translate=x+"px "+y+"px";}
          if(clip){from.clipPath="inset(-8px round 8px)";to.clipPath="inset(-8px 49% -8px 49% round 8px)";}
          frames=[from,to];
        }
        const effect=n.animate(frames,{delay,duration:length,easing:"cubic-bezier(.4,0,.35,1)",fill:"both"});
        animations.add(effect);effect.finished.catch(()=>{});
      }catch{return bypass("control-acquisition-failed");}
    }
    typeof window!=="undefined"&&window.__nocturneTrace?.("disassembly.effects",()=>({count:animations.size,owned:owned.size,duration:DURATION}),{sample:1000,flush:true});
    return animations.size>0||!!centerHandle?.count||!!bookmarkHandle;
  }
  function eligible(args){
    const event=args[0];
    return !dead&&!window.closed&&!Services.startup.shuttingDown&&
      prefs.getBoolPref(PREF,true)&&!reduced.matches&&!!event?.isTrusted&&
      !root.hasAttribute("customizing")&&root.getAttribute("inDOMFullscreen")!=="true"&&
      !root.hasAttribute("data-zr-startup-phase")&&!root.hasAttribute("data-zr-workspace-phase");
  }
  const controller=makeCloseController({
    eligible,begin,clear:restore,isClosed:()=>window.closed,
    seal:()=>{
      centerHandle?.seal();bookmarkHandle?.seal();for(const a of animations)try{a.finish();}catch{}
      window.__nocturneTrace?.("disassembly.sealed",()=>({effects:animations.size,closing:root.hasAttribute("data-zr-closing")}),{flush:true});
    },
    later:(fn,ms)=>window.setTimeout(fn,ms),cancelLater:id=>window.clearTimeout(id),
    invoke:(receiver,args)=>{
      typeof window!=="undefined"&&window.__nocturneTrace?.("disassembly.native.before",()=>({closing:root.hasAttribute('data-zr-closing'),owned:owned.size}),{flush:true,sample:1200});
      const result=Reflect.apply(original,receiver,args);
      typeof window!=="undefined"&&window.__nocturneTrace?.("disassembly.native.after",()=>({resultType:typeof result,closed:window.closed}),{flush:true});
      return result;
    }
  });
  function preferenceChanged(){if(!dead&&(reduced.matches||!prefs.getBoolPref(PREF,true)))controller.flush();}
  function install(){
    if(dead||wrapped)return;
    owner=window.BrowserCommands;
    if(typeof owner?.tryToCloseWindow!=="function")return;
    original=owner.tryToCloseWindow;
    wrapped=function(...args){typeof window!=="undefined"&&window.__nocturneTrace?.("disassembly.request",()=>({trusted:!!args[0]?.isTrusted,pending:controller.pending,allowed:eligible(args)}),{sample:1600,flush:true});return controller.request(this,args);};
    try{owner.tryToCloseWindow=wrapped;if(owner.tryToCloseWindow!==wrapped)wrapped=null;}
    catch{wrapped=null;}
  }
  function dispose(){
    if(dead)return;dead=true;
    let failed=0;const step=fn=>{try{fn();}catch{failed++;}};
    if(!controller.committing&&!window.closed){
      step(()=>controller.dispose());
      if(!controller.busy)step(()=>{if(animations.size||owned.size||root.hasAttribute("data-zr-closing"))restore();});
    }
    step(()=>{if(owner&&wrapped&&owner.tryToCloseWindow===wrapped)owner.tryToCloseWindow=original;});
    step(()=>{if(observer)Services.obs.removeObserver(observer,"browser-delayed-startup-finished");});observer=null;
    step(()=>prefs.removeObserver(PREF,preferenceChanged));
    step(()=>reduced.removeEventListener("change",preferenceChanged));
    step(()=>window.removeEventListener("unload",dispose));
    if(window[KEY]===dispose)delete window[KEY];
    try{window.__nocturneTrace?.("disassembly.dispose",{failed,delegated:controller.committing},{flush:true});}catch{}
  }
  window[KEY]=dispose;window.addUnloadListener(dispose);window.addEventListener("unload",dispose,{once:true});
  prefs.addObserver(PREF,preferenceChanged);reduced.addEventListener("change",preferenceChanged);
  install();
  if(!wrapped&&!window.gBrowserInit?.delayedStartupFinished){
    observer=subject=>{if(subject!==window)return;Services.obs.removeObserver(observer,"browser-delayed-startup-finished");observer=null;install();};
    Services.obs.addObserver(observer,"browser-delayed-startup-finished");
  }
})();
