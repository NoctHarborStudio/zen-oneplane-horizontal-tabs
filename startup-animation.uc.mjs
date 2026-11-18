// Nocturne preview.36: early trace, independent Sine script order.
try{if(typeof window!=="undefined"){
  const event="assembly.script",data={version:"0.3.0-preview.48"};
  if(window.__nocturneTrace)window.__nocturneTrace(event,data,{sample:1500});
  else{const q=window.__nocturneEarlyTrace??(window.__nocturneEarlyTrace=[]);if(q.length<32)q.push({event,t:window.performance?.now?.()??0,data});}
}}catch{}
/* Zen Refined — Center Assembly. Browser-chrome only; optional OnePlane
 * handshake. Never navigates, captures, or injects into a web page. */
(() => {
  const root=document.documentElement,prefs=Services.prefs;
  const ENABLE="zen.refined.startup.animation",DURATION="zen.refined.startup.animation-duration";
  const PHASE="data-zr-startup-phase",HOLD="oneplane-startup-hold",READY="data-op-startup-ready";
  const KEY="__zenRefinedStartupAnimation",SEEN="__zenRefinedStartupAnimationSeen";
  const html=(tag)=>document.createElementNS("http://www.w3.org/1999/xhtml",tag);
  const get=id=>document.getElementById(id);
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const now=()=>window.performance.now();
  function canStartBeforePaint(utils,readyState){
    // Never hide controls that Gecko has already painted.
    try{
      const count=utils?.paintCount;
      if(count!==undefined&&count!==null&&Number.isFinite(Number(count)))return Number(count)===0;
    }catch{}
    try{if(utils?.paintingSuppressed===true)return true;}catch{}
    return readyState==="loading";
  }
  // No replay on Sine hot update or an established window. Record the
  // early eligibility decision even before layout installs diagnostics.
  function decision(event,data){
    try{
      if(window.__nocturneTrace)window.__nocturneTrace(event,data,{sample:1800});
      else{const q=window.__nocturneEarlyTrace??(window.__nocturneEarlyTrace=[]);if(q.length<32)q.push({event,t:now(),data});}
    }catch{}
  }
  function startupEligible(painted,delayed,oneState,age,cold=null){
    const recentCold=!!(cold?.initial&&Number.isFinite(cold.readyAt)&&age-cold.readyAt>=0&&age-cold.readyAt<=1800);
    const beforeLayout=oneState===null&&!cold&&age<1800;
    return age<8000&&cold?.initial!==false&&(!painted||!delayed||oneState==="pending"||recentCold||beforeLayout);
  }
  let lateStart=!canStartBeforePaint(window.windowUtils,document.readyState);
  const check={paintCount:window.windowUtils?.paintCount,delayed:!!window.gBrowserInit?.delayedStartupFinished,ready:root.getAttribute(READY),cold:!!window.__nocturneLayoutStartup?.initial,age:now()};
  const reason=typeof window.addUnloadListener!=="function"?"no-unload-hook":window[SEEN]?"already-seen":root.hasAttribute("popup-window")?"popup":
    !prefs.getBoolPref(ENABLE,true)?"disabled":reduced.matches?"reduced-motion":window.closed?"closed":
    root.hasAttribute("customizing")||root.getAttribute("inDOMFullscreen")==="true"?"native-mode":
    !startupEligible(lateStart,check.delayed,check.ready,check.age,window.__nocturneLayoutStartup)?"late-established-window":null;
  decision("assembly.eligible.check",{...check,reason});
  if(reason){window.__nocturneEarlyBoot?.cleanup?.();return;}
  window[SEEN]=true;
  // Sine saves the previous default as a user value. Upgrade that exact
  // 760ms default once; preserve every other choice, and allow users to
  // select 760ms again after the migration.
  const MIGRATED="zen.refined.startup.duration-v2-migrated";
  try{
    if(!prefs.getBoolPref(MIGRATED,false)){
      if(prefs.getIntPref(DURATION,1050)===760)prefs.setIntPref(DURATION,1050);
      prefs.setBoolPref(MIGRATED,true);
    }
  }catch{}
  const duration=Math.max(400,Math.min(1500,prefs.getIntPref(DURATION,1050)));
  const scale=duration/1050;
  // Absolute offsets on one clock. The surface settles before card motion,
  // then Home reveals its three sections after the initial card burst.
  function startupTimeline(start,scale){
    return {start,scale,panel:0,panelLength:220,cards:245,cardsLength:650,bookmarks:470,home:650,homeLength:330,end:1190};
  }
  const started=now(),deadline=started+8000;
  let dead=false,playing=false,settling=false,raf=0,timer=0,settled=false,nativeReady=false,readyAt=0,holdNode=null;
  let nativeObserver=null,style=null,lateObserver=null,lateResize=null,lateFrame=0,playStart=0,finishAt=0,sheetURI=null,nativeTimer=0;
  const animations=new Map(),owned=new Map(),seen=new Set(),baseline=new Set();
  let centerHandle=null,bookmarkHandle=null,iconWaitAt=0,iconCheckAt=-Infinity,iconStatus=null,homeIcons=null;
  const EXISTING="data-zr-startup-existing";
  const MANAGED="data-zr-startup-managed",EFFECT="data-zr-startup-effect",MOVE="data-zr-startup-move",CLIP="data-zr-startup-clip",PROGRESS="--zr-startup-progress";
  let registered=false;
  try{window.CSS.registerProperty({name:PROGRESS,syntax:"<number>",inherits:false,initialValue:"1"});registered=true;}
  catch(e){registered=e.name==="InvalidModificationError";}
  const BOOT_PREF="zen.nocturne.boot.enabled",BOOT_MIN=1010,BOOT_EXIT=320,BOOT_LEAD=150,BOOT_ENTER=460;
  let boot=null,bootMark=null,bootEffects=[],bootAt=0,bootTimer=0,bootFrame=0,bootPreparing=false;
  const inputs=["pointerdown","keydown","wheel","dragstart","beforecustomization"];
  const EASE="cubic-bezier(.25,.55,.25,1)";
  const FADE="cubic-bezier(.32,.12,.3,1)";
  function bootReady(now,shown,min,quietSince,deadline){
    return now>=deadline||now-shown>=min&&now-quietSince>=120;
  }
  function mountBoot(){
    if(!prefs.getBoolPref(BOOT_PREF,true)){window.__nocturneEarlyBoot?.cleanup?.();return;}
    try{
      // Chrome-only, no network assets, no blur, no page mutation.
      const early=window.__nocturneEarlyBoot?.adopt?.();
      boot=early?.node||html("div");boot.id="nocturne-boot";boot.setAttribute("aria-hidden","true");boot.inert=true;
      Object.assign(boot.style,{position:"fixed",inset:"0",zIndex:"2147483647",display:"grid",placeItems:"center",background:"#111219",color:"#e4e5ef",pointerEvents:"none",overflow:"hidden",willChange:"opacity"});
      boot.style.setProperty("-moz-window-dragging","default","important");
      bootMark=html("div");
      Object.assign(bootMark.style,{display:"grid",justifyItems:"center",gap:"20px",willChange:"transform, opacity"});
      const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
      svg.setAttribute("viewBox","0 0 72 72");svg.setAttribute("width","72");svg.setAttribute("height","72");
      const moon=document.createElementNS(svg.namespaceURI,"path");
      moon.setAttribute("d","M43 8 A29 29 0 1 0 62 53 A26 26 0 0 1 43 8Z");moon.setAttribute("fill","#c4c8e5");
      const star=document.createElementNS(svg.namespaceURI,"path");
      star.setAttribute("d","M55 12 L57 19 L64 21 L57 23 L55 30 L53 23 L46 21 L53 19Z");star.setAttribute("fill","#e4e5ef");svg.append(moon,star);
      const label=html("div");label.textContent="NOCTURNE";
      Object.assign(label.style,{font:"300 24px system-ui, sans-serif",letterSpacing:"7px",paddingInlineStart:"7px"});
      bootMark.append(svg,label);boot.append(bootMark);if(!early)root.append(boot);
      root.setAttribute("data-nocturne-boot","waiting");bootAt=now();
      // First show the brand background, then ease in the mark. The
      // minimum readable hold is measured from this logo clock, not
      // from the earlier blank prelude.
      const lead=Math.max(0,BOOT_LEAD-(early?bootAt-early.at:0));
      bootEffects.push(bootMark.animate([{opacity:0,transform:"translateY(7px) scale(.96)"},{opacity:1,transform:"translateY(0) scale(1)"}],{delay:lead,duration:BOOT_ENTER,easing:"cubic-bezier(.2,.75,.25,1)",fill:"both"}));
      decision("boot.show",{age:bootAt-started,adopted:!!early,backgroundAt:early?.at??bootAt,lead,minimum:BOOT_MIN,exit:BOOT_EXIT});
    }catch(error){removeBoot();decision("boot.error",{name:error?.name});}
  }
  function removeBoot(){
    if(bootTimer)window.clearTimeout(bootTimer);bootTimer=0;
    if(bootFrame)window.cancelAnimationFrame(bootFrame);bootFrame=0;
    for(const a of bootEffects)try{a.cancel();}catch{}
    bootEffects=[];boot?.remove();boot=null;bootMark=null;
    root.removeAttribute("data-nocturne-boot");
  }
  function exitBoot(resume){
    if(!boot){resume();return;}
    const overlay=boot;
    root.setAttribute("data-nocturne-boot","exit");
    const done=()=>{
      if(dead||boot!==overlay)return;
      removeBoot();decision("boot.handoff",{elapsed:now()-bootAt});resume();
    };
    // Allow the frozen proxy tree to receive a paint before the exit.
    bootFrame=window.requestAnimationFrame(()=>{
      bootFrame=0;if(dead||boot!==overlay)return;
      try{
        bootEffects.push(bootMark.animate([{opacity:1,transform:"scale(1)"},{opacity:0,transform:"scale(.94)"}],{duration:260,easing:"ease-in-out",fill:"both"}));
        const fade=overlay.animate([{opacity:1},{opacity:0}],{delay:110,duration:BOOT_EXIT-110,easing:"ease-in-out",fill:"both"});
        bootEffects.push(fade);fade.finished.then(done,done);
        bootTimer=window.setTimeout(done,BOOT_EXIT+150);
      }catch{done();}
    });
  }
  function hold(){
    const w=get("zen-appcontent-navbar-wrapper");
    if(w&&w!==holdNode){
      holdNode?.removeAttribute(HOLD);holdNode=w;
      w.setAttribute(HOLD,"true");
    }
  }
  function finish(){
    typeof window!=="undefined"&&window.__nocturneTrace?.("assembly.finish",()=>({dead,playing,settling,seen:seen.size,effects:animations.size,age:now()-started}),{flush:true});
    if(dead)return;dead=true;
    if(raf)window.cancelAnimationFrame(raf);
    if(timer)window.clearTimeout(timer);
    if(nativeTimer)window.clearTimeout(nativeTimer);
    if(lateFrame)window.cancelAnimationFrame(lateFrame);
    lateObserver?.disconnect();lateObserver=null;lateResize?.disconnect();lateResize=null;
    if(nativeObserver)try{Services.obs.removeObserver(nativeObserver,"browser-delayed-startup-finished");}catch{}
    nativeObserver=null;
    for(const a of animations.keys())try{a.cancel();}catch{}
    animations.clear();
    centerHandle?.seal();centerHandle?.release();centerHandle=null;
    bookmarkHandle?.seal();bookmarkHandle?.release();bookmarkHandle=null;
    window.__nocturneCenterMotion?.releasePending();
    for(const n of [...owned.keys()])restore(n);
    for(const n of seen)n.removeAttribute(MANAGED);
    seen.clear();
    for(const n of baseline)n.removeAttribute(EXISTING);baseline.clear();
    if(sheetURI)try{window.windowUtils.removeSheet(sheetURI,window.windowUtils.USER_SHEET);}catch{}
    sheetURI=null;
    style?.remove();
    root.removeAttribute(PHASE);holdNode?.removeAttribute(HOLD);
    delete window.__nocturneStartupTimeline;
    window.__zenSharedHomeV1?.finishStartup?.();
    bootPreparing=false;removeBoot();
    for(const type of inputs)window.removeEventListener(type,interrupt,true);
    window.removeEventListener("resize",onResize);
    window.removeEventListener("unload",finish);
    window.removeEventListener("OnePlane:StartupState",schedule);
    reduced.removeEventListener("change",preferenceChanged);
    try{prefs.removeObserver(ENABLE,preferenceChanged);}catch{}
    if(window[KEY]===finish)delete window[KEY];
  }
  function settle(){
    typeof window!=="undefined"&&window.__nocturneTrace?.("assembly.settle",()=>({playing,settling,effects:animations.size}),{sample:1800});
    if(dead||settling)return;
    if(!playing||reduced.matches||!animations.size){finish();return;}
    settling=true;
    // The native background and page have never been touched.
    // Finish active effects from current values, not a different frame.
    root.setAttribute(PHASE,"settling");
    if(typeof centerHandle!=="undefined"){centerHandle?.seal();centerHandle?.release();centerHandle=null;}
    if(typeof bookmarkHandle!=="undefined"){bookmarkHandle?.seal();bookmarkHandle?.release();bookmarkHandle=null;}
    lateObserver?.disconnect();lateObserver=null;lateResize?.disconnect();lateResize=null;
    if(lateFrame)window.cancelAnimationFrame(lateFrame);lateFrame=0;
    if(timer)window.clearTimeout(timer);
    const pending=[];
    for(const [a,record] of animations){
      try{
        const cs=window.getComputedStyle(record.n),to=record.frames.at(-1),from={};
        for(const k of Object.keys(to)){
          const value=k.startsWith("--")?cs.getPropertyValue(k).trim():cs[k];
          from[k]=value!==undefined&&value!==""?value:to[k];
        }
        pending.push({a,record,from,to});
      }catch{pending.push({a,record,from:null,to:null});}
    }
    for(const {a,record,from,to} of pending){
      animations.delete(a);try{a.cancel();}catch{}
      if(!from||!play(record.n,[from,to],0,120,false,FADE,record.complete))record.complete?.();
    }
    timer=window.setTimeout(finish,155);
  }
  function interrupt(event){
    // Typing in Home or a web page must not terminate a chrome animation.
    // Explicit toolbar actions and customization can still interrupt it.
    const toolbar=!!event?.target?.closest?.("#nav-bar,#PersonalToolbar,#oneplane-tabs");
    const accepted=event?.isTrusted!==false&&(event?.type==="beforecustomization"||event?.type==="dragstart"||event?.type==="pointerdown"&&toolbar);
    decision("assembly.interrupt",{type:event?.type,trusted:event?.isTrusted,playing,toolbar,accepted});
    if(event?.isTrusted!==false&&boot&&["pointerdown","keydown","wheel","dragstart","beforecustomization"].includes(event?.type)){
      decision("boot.skip",{type:event.type});finish();return;
    }
    if(accepted)settle();
  }
  let viewport=[window.innerWidth,window.innerHeight];
  function onResize(){
    const next=[window.innerWidth,window.innerHeight];
    const changed=Math.abs(next[0]-viewport[0])>1||Math.abs(next[1]-viewport[1])>1;
    typeof window!=="undefined"&&window.__nocturneTrace?.("assembly.resize",()=>({changed,playing,size:next}),{throttle:100,sample:1500});
    viewport=next;if(playing&&changed){if(bootPreparing)finish();else settle();}
  }
  function preferenceChanged(){if(reduced.matches)finish();else if(!prefs.getBoolPref(ENABLE,true))settle();}
  function bounds(n,ignoreOpacity=false){
    if(!n||n.hidden||n.collapsed)return null;
    const s=window.getComputedStyle(n),r=n.getBoundingClientRect();
    return s.display!=="none"&&s.visibility!=="hidden"&&(ignoreOpacity||Number(s.opacity)!==0)&&r.width>1&&r.height>1&&
      r.right>0&&r.left<window.innerWidth&&r.bottom>0&&r.top<window.innerHeight?r:null;
  }
  function play(n,frames,delay,length,retain=false,easing=EASE,complete=null){
    if(!n)return false;
    try{
      const a=n.animate(frames,{delay,duration:length,easing,fill:"both"});
      if(bootPreparing){a.pause();a.currentTime=0;}
      animations.set(a,{n,frames,complete});
      a.finished?.then(()=>{
        if(dead||!animations.has(a)||retain)return;
        animations.delete(a);
        try{a.cancel();}catch{}
        complete?.();
      },()=>{});
      return true;
    }catch(error){console.warn("[Zen Refined] Startup animation effect:",error);return false;}
  }
  function save(n,k,value){
    let record=owned.get(n);
    if(!record){record=new Map();owned.set(n,record);}
    if(!record.has(k))record.set(k,{value:n.style.getPropertyValue(k),priority:n.style.getPropertyPriority(k)});
    n.style.setProperty(k,value,"important");
  }
  function restore(n){
    const record=owned.get(n);if(!record)return;
    for(const [k,v] of record){
      if(v.value)n.style.setProperty(k,v.value,v.priority);else n.style.removeProperty(k);
    }
    n.removeAttribute(EFFECT);n.removeAttribute(MOVE);n.removeAttribute(CLIP);
    owned.delete(n);
  }
  function reveal(n,{x=0,y=0,clip=false,delay=0,length=350,easing=EASE,late=false}={}){
    if(!n||seen.has(n)||!bounds(n,true))return false;
    // Remove the pending gate before sampling native opacity. All changes
    // occur synchronously, before the next paint.
    n.setAttribute(MANAGED,"true");
    // Keep transitions disabled while sampling the ungated resting style.
    // Re-enabling them here captures the previous zero-opacity transition.
    const cs=window.getComputedStyle(n),opacity=Number(cs.opacity);
    if(!Number.isFinite(opacity)||opacity<=0){n.removeAttribute(MANAGED);return false;}
    seen.add(n);
    if(n.matches?.(".oneplane-tab,.oneplane-split-group"))window.__nocturneTrace?.("assembly.card.rest",()=>({opacity,x,y}),{throttle:80});
    const alreadyPainted=baseline.has(n)||late&&!clip&&!n.matches?.("#PlacesToolbarItems > *");
    const initial=alreadyPainted ? .72 : 0;
    if(alreadyPainted)clip=false;
    const nativeTranslate=cs.translate||"none";
    const canMove=nativeTranslate==="none"||/^0(?:px|%)?(?: 0(?:px|%)?){0,2}$/.test(nativeTranslate);
    // Do not replace a nonzero native translation (notably the floating
    // URL bar). Clip and fade the actual popup instead.
    if(!canMove){x=0;y=0;}
    const start=late?Math.max(0,playStart+delay*scale-now()):Math.max(0,delay*scale);
    const time=late?Math.max(240,Math.min(length*scale,finishAt-now()-start-60)):length*scale;
    if(late)extendFinish(now()+start+time+65);
    if(registered){
      // Important theme opacity/translate/clip-path declarations defeat
      // ordinary animation effects. Animate a registered number instead;
      // important inline properties consume that same interpolated value.
      // The custom property itself must NOT be important.
      let record=owned.get(n);if(!record){record=new Map();owned.set(n,record);}
      record.set(PROGRESS,{value:n.style.getPropertyValue(PROGRESS),priority:n.style.getPropertyPriority(PROGRESS)});
      n.style.setProperty(PROGRESS,"1");
      save(n,"--zr-startup-base-opacity",String(opacity));
      n.setAttribute(EFFECT,"true");
      if(x||y){save(n,"--zr-startup-dx",x+"px");save(n,"--zr-startup-dy",y+"px");n.setAttribute(MOVE,"true");}
      if(clip)n.setAttribute(CLIP,"true");
      if(!play(n,[{[PROGRESS]:String(initial)},{[PROGRESS]:"1"}],start,time,false,easing,()=>restore(n)))restore(n);
    }else{
      const from={opacity:opacity*initial},to={opacity};
      if(x||y){from.translate=x*(1-initial)+"px "+y*(1-initial)+"px";to.translate="0px 0px";}
      if(clip){from.clipPath="inset(0 49% 0 49% round 8px)";to.clipPath="inset(-8px round 8px)";}
      play(n,[from,to],start,time,false,easing);
    }
    return true;
  }
  function extendFinish(until){
    // Late chrome may get a short reveal but cannot keep the startup hold
    // forever. All cleanup is still guaranteed by the final timer.
    const end=Math.min(playStart+duration+420,Math.max(finishAt,until));
    if(end===finishAt)return;
    finishAt=end;
    if(timer)window.clearTimeout(timer);
    timer=window.setTimeout(finish,Math.max(0,finishAt-now()));
  }
  function slide(n,x,y,delay,length){return reveal(n,{x,y,delay,length});}
  function openFromCenter(n,delay,length,late=false){return reveal(n,{clip:true,delay,length,late,easing:FADE});}
  function floatingBar(){
    const bar=get("urlbar");
    if(!bar)return null;
    const r=bounds(bar,true);
    // Some Zen builds mark the floating bar later than the actual layout.
    // A real input centered well below the toolbar is also a valid target.
    return bar.getAttribute("zen-floating-urlbar")==="true"||bar.hasAttribute("zen-newtab")||
      (r&&r.top>100&&r.width>100)?bar:null;
  }
  function controls(row,url,center,late=false){
    const nav=get("nav-bar"),target=get("nav-bar-customization-target"),candidates=new Set();
    const eligible=n=>n&&n!==row&&n!==url&&!row?.contains(n)&&!url?.contains(n)&&
      n.localName!=="toolbarspring"&&!n.id?.startsWith("oneplane-center-")&&bounds(n,true);
    // Native captions are moved outside customization-target by OnePlane.
    // Include the actual buttons, not the parent and child simultaneously.
    let captions=null;try{captions=window.gZenVerticalTabsManager?.actualWindowButtons;}catch{}
    const buttonSelector="toolbarbutton,button,.titlebar-button,[role=button],#titlebar-min,#titlebar-max,#titlebar-restore,#titlebar-close";
    const roots=[target,nav,captions,get("titlebar-buttonbox"),get("titlebar-buttonbox-container"),get("zen-window-controls"),get("zen-sidebar-top-buttons")].filter(Boolean);
    for(const parent of roots){
      for(const n of parent.querySelectorAll(buttonSelector))if(eligible(n))candidates.add(n);
    }
    // Animate controls, never whole toolbar wrappers or background surfaces.
    const leaves=[...candidates].filter(n=>![...candidates].some(c=>c!==n&&n.contains(c)));
    const left=[],right=[];
    for(const n of leaves){
      const r=bounds(n,true);if(!r)continue;
      (r.left+r.width/2<center?left:right).push({n,r});
    }
    left.sort((a,b)=>b.r.left-a.r.left);right.sort((a,b)=>a.r.left-b.r.left);
    for(const [side,group] of [[-1,left],[1,right]])for(let i=0;i<group.length;i++){
      const {n}=group[i];
      if(seen.has(n)||[...seen].some(other=>other.contains(n)||n.contains(other)))continue;
      reveal(n,{x:-side*14,y:-4,delay:260+Math.min(i*32,160),length:390,late});
    }
  }
  function revealBookmarks(center,late=false){
    const items=get("PlacesToolbarItems");
    const visible=Array.from(items?.children||[]).map(n=>({n,r:bounds(n,true)})).filter(x=>x.r);
    if(!visible.length)return;
    const bmCenter=(Math.min(...visible.map(x=>x.r.left))+Math.max(...visible.map(x=>x.r.right)))/2;
    const max=Math.max(1,...visible.map(x=>Math.abs(x.r.left+x.r.width/2-bmCenter)));
    for(const {n,r} of visible){
      const dx=Math.abs(r.left+r.width/2-bmCenter);
      reveal(n,{x:0,y:-16,delay:430+dx/max*115,length:430,easing:FADE,late});
    }
  }
  function scheduleLate(){
    if(dead||!playing||settling||bootPreparing||lateFrame)return;
    lateFrame=window.requestAnimationFrame(()=>{
      lateFrame=0;if(dead||settling)return;
      const bar=floatingBar();
      if(bar&&!seen.has(bar))openFromCenter(bar,590,440,true);
      if(!bookmarkHandle)revealBookmarks(window.innerWidth/2,true);
      else for(const n of get("PlacesToolbarItems")?.children||[]){n.setAttribute(MANAGED,"true");seen.add(n);}
      const row=get("oneplane-tabs"),url=get("urlbar-container"),center=window.innerWidth/2;
      controls(row,url,center,true);
      // Cards inserted after the snapshot appear in their real slots.
      // Never restart an already-playing train for late mirror mutations.
    });
  }
  function launch(one){
    typeof window!=="undefined"&&window.__nocturneTrace?.("assembly.launch",()=>({one,paintCount:window.windowUtils?.paintCount,phase:root.getAttribute(PHASE),ready:root.getAttribute(READY),age:now()-started}),{sample:1800});
    if(dead||playing||settling)return;playing=true;bootPreparing=!!boot;
    try{
      // Prime the resting contour while the startup gate is still held.
      const preflightAt=now();
      if(one)try{window.__oneplaneLayoutController?.prepareWorkspaceGeometry?.();}catch{}
      window.__nocturneTrace?.("assembly.preflight",{elapsed:now()-preflightAt},{sample:1000});
      const row=get("oneplane-tabs"),url=get("urlbar-container");
      const bookmarks=get("PersonalToolbar"),items=get("PlacesToolbarItems");
      const floating=floatingBar();
      // Retain the waiting gate until the initial effects own their nodes.
      // Bounds ignore the gate; each target is ungated synchronously by reveal().
      const ur=bounds(url,true),rr=one?bounds(row,true):null;
      const island=one?row?.querySelector(".oneplane-title-island"):null,ir=bounds(island,true);
      const center=ir?ir.left+ir.width/2:one&&rr?rr.left+rr.width/2:ur?ur.left+ur.width/2:window.innerWidth/2;
      playStart=now();
      const timeline=startupTimeline(playStart,scale);
      timeline.paused=bootPreparing;
      finishAt=playStart+Math.max(duration+80,timeline.end*scale);
      window.__nocturneStartupTimeline=timeline;
      const surface=one?get("oneplane-toolbar-surface"):null;
      // Animate the actual decorative surface, not a full-window cover.
      if(surface)reveal(surface,{y:-18,delay:timeline.panel,length:timeline.panelLength});
      decision("assembly.timeline",{panel:!!surface,cardsAt:timeline.cards*scale,homeAt:timeline.home*scale});
      // The native floating field may be a top-layer popover; never clip
      // its parent during its independent entrance.
      if(ur&&!floating)openFromCenter(url,45,410);
      if(one&&rr){
        const engine=window.__nocturneCenterMotion;
        const cards=[...row.querySelectorAll(".oneplane-tab,.oneplane-split-group")];
        const gated=root.hasAttribute("data-zr-center-pending");
        const cold=window.__nocturneLayoutStartup?.initial===true;
        const painted=!gated&&!cold&&cards.some(n=>baseline.has(n));
        // Remove per-card startup gates together, including split members.
        for(const n of cards){n.setAttribute(MANAGED,"true");seen.add(n);}
        if(!painted)centerHandle=engine?.start(row,{owner:"startup",direction:"in",duration:Math.round(timeline.cardsLength*scale),delay:Math.round(timeline.cards*scale),paused:bootPreparing});
        else engine?.releasePending();
        decision("assembly.center.result",{painted,gated,cold,engine:!!engine,count:centerHandle?.count||0});
        const plus=row.querySelector(".oneplane-new-tab");if(bounds(plus,true))slide(plus,-26,0,400,350);
        if(ir)reveal(island,{delay:150,length:190});
      }else{
        // Move actual native tabs instead of fading the acrylic sidebar.
        const sidebar=get("zen-tabs-wrapper")||get("TabsToolbar"),sr=bounds(sidebar,true);
        const dx=sr&&sr.left>=window.innerWidth/2?18:-18;
        let i=0;
        for(const tab of get("tabbrowser-tabs")?.querySelectorAll(".tabbrowser-tab")||[]){
          if(!bounds(tab,true))continue;
          slide(tab,dx,0,155+Math.min(i++*12,120),445);
        }
      }
      controls(row,url,center);
      if(centerHandle&&items){
        for(const n of items.children){n.setAttribute(MANAGED,"true");seen.add(n);}
        bookmarkHandle=window.__nocturneCenterMotion?.bookmarks({direction:"in",duration:Math.round(420*scale),delay:Math.round(timeline.bookmarks*scale),paused:bootPreparing});
      }
      if(!bookmarkHandle)revealBookmarks(center);
      if(floating)openFromCenter(floating,590,440);
      window.__zenSharedHomeV1?.playStartup?.(timeline);
      root.setAttribute(PHASE,"playing");
      // Places and Zen's floating input can initialize after chrome-ready.
      // Keep only these late nodes gated until they receive their effect.
      lateObserver=new MutationObserver(records=>{
        // Ignore page/Home churn, frozen proxy insertion and unrelated
        // chrome mutations. Only late native targets need a rescan.
        if(records.some(r=>{
          const t=r.target;
          return t?.closest?.("#nav-bar,#PersonalToolbar,#zen-sidebar-top-buttons,#titlebar-buttonbox,#urlbar")&&
            !t.closest("#oneplane-tabs");
        }))scheduleLate();
      });
      lateObserver.observe(root,{subtree:true,childList:true,attributes:true,
        attributeFilter:["zen-floating-urlbar","zen-newtab","hidden","collapsed","open","popover-open"]});
      if(typeof ResizeObserver==="function"){
        lateResize=new ResizeObserver(scheduleLate);
        for(const n of [get("urlbar"),items,bookmarks])if(n)lateResize.observe(n);
      }
    typeof window!=="undefined"&&window.__nocturneTrace?.("assembly.targets",()=>({seen:seen.size,effects:animations.size,duration,finishAt}),{sample:1800});
      const resume=()=>{
        if(dead)return;
        bootPreparing=false;
        playStart=now();timeline.start=playStart;timeline.paused=false;
        finishAt=playStart+Math.max(duration+80,timeline.end*scale);
        for(const a of animations.keys())try{a.play();}catch{}
        centerHandle?.resume?.();bookmarkHandle?.resume?.();
        window.__zenSharedHomeV1?.resumeStartup?.();
        decision("boot.assembly.start",{age:playStart-started,prepared:animations.size});
        scheduleLate();
        if(timer)window.clearTimeout(timer);
        timer=window.setTimeout(finish,Math.max(0,finishAt-now()));
      };
      if(bootPreparing){
        // Keep the hard fail-open deadline while waiting for the exit.
        timer=window.setTimeout(finish,Math.max(0,deadline-now()));
        exitBoot(resume);
      }else{
        scheduleLate();
        timer=window.setTimeout(finish,Math.max(0,finishAt-now()));
      }
    }catch(error){console.warn("[Zen Refined] Startup reveal failed:",error);finish();}
  }
  function schedule(){
    if(dead||playing||settling||raf)return;
    raf=window.requestAnimationFrame(tick);
  }
  let readinessKey="",quietSince=started;
  function tick(){
    raf=0;if(dead||playing)return;
    if(now()>=deadline){decision("assembly.skip",{reason:"deadline",nativeReady,settled,state:root.getAttribute(READY)});finish();return;}
    hold();
    // Warm icons while native restore is still running, not only after it.
    const earlyRow=get("oneplane-tabs");
    if(boot&&earlyRow&&now()-iconCheckAt>=75){
      iconCheckAt=now();iconStatus=window.__nocturneCenterMotion?.warmIcons?.(earlyRow)||null;
      homeIcons=window.__zenSharedHomeV1?.warmStartupIcons?.()||null;
    }
    if(!nativeReady||!settled){schedule();return;}
    const state=root.getAttribute(READY);
    const controller=window.__oneplaneLayoutController;
    const row=get("oneplane-tabs");
    const active=root.getAttribute("oneplane-active")==="true"&&row?.getAttribute("data-ready")==="true";
    const expected=Boolean(controller||state||active);
    // Wait for optional integration only if it is actually present. Old
    // OnePlane versions are accepted if already active and visible.
    if(state==="pending"||(expected&&!active&&state!=="true")){schedule();return;}
    if(!expected&&now()-readyAt<350){schedule();return;}
    if(active&&state==="true"&&root.getAttribute("zen-compact-mode")==="true"&&!holdNode?.hasAttribute("data-op-panel-open")){schedule();return;}
    const one=Boolean(active&&bounds(row,true)&&(root.getAttribute("zen-compact-mode")!=="true"||holdNode?.hasAttribute("data-op-panel-open")));
    if(active&&!one){schedule();return;}
    if(one){
      const engine=window.__nocturneCenterMotion;
      if(!iconWaitAt)iconWaitAt=now();
      if(now()-iconCheckAt>=75){
        iconCheckAt=now();iconStatus=engine?.warmIcons?.(row)||engine?.iconStats?.(row)||null;
        homeIcons=window.__zenSharedHomeV1?.warmStartupIcons?.()||null;
      }
      const waiting=!!(iconStatus&&(iconStatus.pending+iconStatus.missing)>0||homeIcons?.pending>0);
      if(waiting&&now()-iconWaitAt<(boot?1400:600)){schedule();return;}
      // Log readiness once, after the minimum splash duration has elapsed.
      // The frame loop must not fill the startup event buffer.

    }
 
    // A narrow/hidden legacy strip falls back to native UI, never forces
    // a layout preference. With pending integration, fail open on timeout.
    if(!get("nav-bar")&&!get("navigator-toolbox")){schedule();return;}
    if(boot){
      const key=JSON.stringify([state,one,iconStatus,homeIcons,row?.childElementCount,window.innerWidth,window.innerHeight]);
      if(key!==readinessKey){readinessKey=key;quietSince=now();}
      if(!bootReady(now(),bootAt,BOOT_MIN,quietSince,deadline-BOOT_EXIT-200)){schedule();return;}
      decision("boot.ready",{elapsed:now()-bootAt,quiet:now()-quietSince});
    }
    if(one)decision("assembly.icons.ready",{...iconStatus,homeIcons,wait:now()-iconWaitAt,timeout:!!(iconStatus&&(iconStatus.pending+iconStatus.missing)>0||homeIcons?.pending>0)});
    window.__nocturneTrace?.("assembly.ready",{one,active,state,expected,nativeReady,settled},{sample:2500});
    if(timer)window.clearTimeout(timer);
    console.info("[Zen Refined] Center Assembly launch: "+(one?"OnePlane":"native"));
    launch(one);
  }
  function onNativeReady(){
    if(dead||nativeReady)return;
    nativeReady=true;
    // These promises are native chrome/workspace initialization, not
    // network page loading. A hard deadline protects slow/broken mods.
    let queued=false;
    const markReady=()=>{
      if(dead||queued)return;queued=true;
      if(nativeTimer)window.clearTimeout(nativeTimer);nativeTimer=0;
      window.requestAnimationFrame(()=>window.requestAnimationFrame(()=>{
        if(dead)return;settled=true;readyAt=now();schedule();
      }));
    };
    nativeTimer=window.setTimeout(()=>{decision("assembly.native.timeout",{});markReady();},900);
    Promise.allSettled([window.SessionStore?.promiseAllWindowsRestored,window.gZenWorkspaces?.promiseInitialized]).then(markReady);
  }
  try{
    window[KEY]?.();window[KEY]=finish;
    window.addUnloadListener(finish);window.addEventListener("unload",finish,{once:true});
    for(const type of inputs)window.addEventListener(type,interrupt,true);
    window.addEventListener("resize",onResize);
    window.addEventListener("OnePlane:StartupState",schedule);
    reduced.addEventListener("change",preferenceChanged);
    prefs.addObserver(ENABLE,preferenceChanged);
    // Early startup gates only animated controls, never a window-sized layer.
    // Sine applies its chrome CSS at USER_SHEET origin. A user-important
    // declaration wins over author-important inline styles. Scope our
    // temporary user sheet to owned nodes and use deliberate specificity
    // to win over OnePlane's nested IDs. No global prefs or permanent CSS.
    const specificity=":is(#zr-startup-specificity,[data-zr-startup-effect])".repeat(8);
    const gate=":is(#zr-startup-specificity,:not([data-zr-startup-managed]))".repeat(8);
    const base=":root[data-zr-startup-phase] [data-zr-startup-effect]"+specificity;
    const edge="calc(49% * (1 - var("+PROGRESS+")) - 8px * var("+PROGRESS+"))";
    const waiting=':root[data-zr-startup-phase="waiting"]';
    const active=':root[data-zr-startup-phase="playing"]';
    const earlyTargets=[
      "#oneplane-toolbar-surface",
      "#urlbar-container",
      '#urlbar:is([zen-floating-urlbar="true"],[zen-newtab])',
      "#oneplane-tabs :is(.oneplane-tab,.oneplane-split-group,.oneplane-title-island,.oneplane-new-tab)",
      "#tabbrowser-tabs .tabbrowser-tab",
      "#PlacesToolbarItems > *",
      // OnePlane cards own their startup gate, including every child.
      // Never hide the tab-select button independently: its computed opacity
      // would be captured as zero by the shared shadow proxy.
      "#nav-bar :is(toolbarbutton,button,.titlebar-button,[role=button]):not(#oneplane-tabs *)",
      "#zen-sidebar-top-buttons :is(toolbarbutton,button,.titlebar-button,[role=button])",
      ":is(#titlebar-buttonbox,#titlebar-buttonbox-container,#zen-window-controls,.titlebar-buttonbox-container) .titlebar-button"
    ];
    const waitingGate=earlyTargets.map(s=>waiting+" "+s+":not([data-zr-startup-managed],[data-zr-startup-existing])"+gate).join(",\n");
    const cssText=`
      ${waitingGate},
      ${active} #urlbar:is([zen-floating-urlbar="true"],[zen-newtab]):not([data-zr-startup-managed],[data-zr-startup-existing])${gate},
      ${active} #PlacesToolbarItems > :not([data-zr-startup-managed],[data-zr-startup-existing])${gate} {
        opacity: 0 !important;
        transition-property: none !important;
      }
      :root[data-zr-startup-phase] [data-zr-startup-managed]${":is(#zr-startup-specificity,[data-zr-startup-managed])".repeat(8)} {
        transition-property: none !important;
      }
      ${base} {
        /* Do not let a native CSS transition chase each sampled value. */
        transition-property: none !important;
        opacity: calc(var(--zr-startup-base-opacity) * var(${PROGRESS})) !important;
      }
      ${base}[data-zr-startup-move] {
        translate: calc(var(--zr-startup-dx) * (1 - var(${PROGRESS}))) calc(var(--zr-startup-dy) * (1 - var(${PROGRESS}))) !important;
      }
      ${base}[data-zr-startup-clip] {
        clip-path: inset(-8px ${edge} -8px ${edge} round 8px) !important;
      }
    `;
    try{
      sheetURI=Services.io.newURI("data:text/css;charset=utf-8,"+encodeURIComponent(cssText));
      window.windowUtils.loadSheet(sheetURI,window.windowUtils.USER_SHEET);
    }catch{
      sheetURI=null;style=html("style");style.textContent=cssText;root.append(style);
    }
    // Already-painted controls are never hidden by a late loader. Newly
    // inserted controls remain eligible for the full center reveal.
    lateStart=lateStart||!canStartBeforePaint(window.windowUtils,document.readyState);
    if(lateStart)for(const selector of earlyTargets)for(const n of document.querySelectorAll(selector))if(!baseline.has(n)){baseline.add(n);n.setAttribute(EXISTING,"true");}
    root.setAttribute(PHASE,"waiting");hold();mountBoot();
    console.info("[Zen Refined] Center Assembly: "+(lateStart?"late chrome startup":"prepaint startup"));
    timer=window.setTimeout(finish,Math.max(0,deadline-now()));
    if(window.gBrowserInit?.delayedStartupFinished)onNativeReady();
    else{nativeObserver=subject=>{if(subject!==window)return;Services.obs.removeObserver(nativeObserver,"browser-delayed-startup-finished");nativeObserver=null;onNativeReady();};
      Services.obs.addObserver(nativeObserver,"browser-delayed-startup-finished");}
    schedule();
  }catch(error){console.warn("[Zen Refined] Startup controller:",error);finish();}
})();
