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
// Pure timing plan for Center Assembly; base offsets are unscaled milliseconds.
// The runtime owns the epoch and lifecycle; this module owns no DOM or timers.
function startupTimeline(start,scale,mode="fold"){
  if(mode==="bloom")return startupBloomAssemblyPlan(start,scale);
  if(mode!=="fold")throw RangeError("unknown startup motion mode");
  const duration=Math.round(scale*1050);
  return {
    start,scale,panel:0,panelLength:220,cards:245,cardsLength:650,
    bookmarks:470,home:650,homeLength:330,end:1190,
    finishLength:Math.max(duration+80,1190*scale),
    lateLimit:duration+420
  };
}

function startupFits(plan,now,deadline,overhead=0){
  return Number.isFinite(now)&&Number.isFinite(deadline)&&Number.isFinite(overhead)&&
    overhead>=0&&now+plan.finishLength+overhead<deadline;
}

// A late target either has enough time to reach its resting frame or is
// left ungated. Never schedule a minimum-length effect past the hard cap.
function startupLateEffect(plan,start,finishAt,deadline,now,delay,length,elapsed=now-start){
  if(!Number.isFinite(elapsed))return null;
  const wait=Math.max(0,delay*plan.scale-elapsed);
  const cap=Math.min(deadline,start+plan.lateLimit);
  const available=cap-now-wait-65;
  if(!Number.isFinite(available)||available<240)return null;
  const time=Math.min(available,Math.max(240,Math.min(length*plan.scale,finishAt-now-wait-60)));
  return {delay:wait,length:time,finishAt:now+wait+time+65};
}

// One Assembly-owned outcome ledger. Consumers supply exact ownership
// predicates; intentional retirement is not a successful WAAPI finish.
function createStartupOutcome(onCancel,onProgress=()=>{}){
  const records=new Map();
  let closed=false;
  const current=record=>{try{return record.isCurrent();}catch{return false;}};
  function observe(effect,surface,isCurrent){
    if(closed||records.has(effect))return;
    const promise=effect.finished;
    const record={effect,promise,surface,isCurrent,state:"pending"};
    records.set(effect,record);
    const done=cancelled=>{
      if(closed||records.get(effect)!==record||record.state!=="pending"&&!(cancelled&&record.state==="finished"))return;
      if(!current(record)){
        // Direct effects intentionally release their completed fill.
        // Keep their successful outcome instead of counting retirement.
        if(record.state==="finished")return;
        record.state="retired";
      }else{
        record.state=cancelled?"cancelled":"finished";
        if(cancelled){onCancel(surface);return;}
      }
      onProgress();
    };
    // Attach before any pause/seek/startTime mutation. Never convert an
    // unexpected rejection into a normal successful transaction.
    promise.then(()=>done(false),()=>done(true));
    // A retained finished animation can be cancelled after its original
    // finished promise already resolved. Observe that event as well.
    if(typeof effect.addEventListener==="function"){
      record.onCancel=()=>done(true);
      effect.addEventListener("cancel",record.onCancel);
    }
  }
  function snapshot(){
    const counts={pending:0,finished:0,cancelled:0,retired:0};
    for(const record of records.values()){
      let state=record.state;
      if(state==="pending"||state==="finished"){
        if(!current(record)){if(state==="pending")state="retired";}
        else try{
          const playState=record.effect.playState;
          if(playState==="finished")state="finished";
          else if(playState==="idle")state="cancelled";
        }catch{}
      }
      counts[state]++;
    }
    return counts;
  }
  // Freeze the exact active cohort after candidate preparation. Retired
  // trial effects (e.g. the discarded real-slot attempt) are not members.
  // Recheck the same cohort immediately before the common epoch; a Boot
  // hold must not allow a completed, replaced or advanced effect to replay.
  function capturePrepared(clock){
    const cohort=[...records.values()].filter(current);
    const verify=()=>{
      if(closed||!Number.isFinite(clock?.currentTime))throw Error("startup-prepared-clock");
      const active=[...records.values()].filter(current);
      if(active.length!==cohort.length||active.some((r,i)=>r!==cohort[i]))
        throw Error("startup-prepared-cohort");
      for(const record of cohort){
        const a=record.effect;
        if(record.state!=="pending"||a.timeline!==clock||a.playState!=="paused"||a.pending||
           a.playbackRate!==1||a.currentTime!==0||a.finished!==record.promise)
          throw Error("startup-prepared-effect");
      }
      return cohort.length;
    };
    verify();return verify;
  }
  function close(){
    closed=true;
    for(const {effect,onCancel} of records.values())if(onCancel)
      try{effect.removeEventListener("cancel",onCancel);}catch{}
    records.clear();
  }
  return {observe,snapshot,capturePrepared,close};
}

function startupBoundaryOutcome(counts,legacy=0){
  if(counts?.cancelled)return "effect-cancelled";
  if(counts?.pending)return "boundary-incomplete";
  if(legacy)return "completed-unverified";
  if(counts?.retired)return "completed-with-retired";
  return "completed";
}
// Nocturne preview.36: early trace, independent Sine script order.
try{if(typeof window!=="undefined"){
  const event="assembly.script",data={version:"0.3.0-preview.127"};
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
  // 760 ms is still a supported user choice. Legacy saved defaults and
  // explicit selections cannot be distinguished: never rewrite either.
  // New installs retain the manifest default (1050 ms).
  const duration=Math.max(400,Math.min(1500,prefs.getIntPref(DURATION,1050)));
  const scale=duration/1050;
  // Source-only candidate switch. Do not expose a new preference or
  // enable Bloom before native comparison and the topology gate.
  const BLOOM_CANDIDATE=false;
  let plan=startupTimeline(0,scale);
  const started=now();let deadline=started+8000,timerEpoch=0;
  let dead=false,playing=false,settling=false,raf=0,timer=0,settled=false,nativeReady=false,readyAt=0,holdNode=null;
  let nativeObserver=null,style=null,lateObserver=null,lateResize=null,lateFrame=0,playStart=0,finishAt=0,sheetURI=null,nativeTimer=0;
  let nativeFrame=0,nativeFrame2=0,ownedTimeline=null,homeRegistry=null,pendingEngine=null;
  let earlyBoot=null,phaseBaseline=null,bootBaseline=null,phaseOwned=false,bootOwned=false,holdBaseline=null;
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
  const restoreMark=(node,key,value)=>{if(value===null)node.removeAttribute(key);else node.setAttribute(key,value);};
  function claimBoot(){
    const prelude=window.__nocturneEarlyBoot;
    if(Number.isFinite(prelude?.deadline))deadline=Math.min(deadline,prelude.deadline);
    if(!prefs.getBoolPref(BOOT_PREF,true))prelude?.cleanup?.();
    else earlyBoot=prelude?.adopt?.()||null;
    if(Number.isFinite(earlyBoot?.deadline))deadline=Math.min(deadline,earlyBoot.deadline);
    phaseBaseline=earlyBoot?(earlyBoot.phaseBaseline??null):root.getAttribute(PHASE);
    bootBaseline=earlyBoot?(earlyBoot.bootBaseline??null):root.getAttribute("data-nocturne-boot");
    if(earlyBoot){boot=earlyBoot.node;phaseOwned=true;bootOwned=true;}
  }
  // One Assembly timer serves both the absolute watchdog and the earlier
  // normal completion. Rearming never extends the inherited deadline.
  function armFinish(until=deadline){
    if(dead)return;
    const epoch=++timerEpoch,old=timer;timer=0;
    if(old)try{window.clearTimeout(old);}catch{}
    const end=Math.min(deadline,until);
    const complete=()=>{
      const watchdog=end===deadline||now()>=deadline;
      if(watchdog)decision("assembly.watchdog",{age:now()-started,playing,settling,bootPreparing});
      if(watchdog||settling){finish(watchdog?"watchdog":"interrupted");return;}
      const timeline=ownedTimeline,counts=timeline?.outcome?.snapshot();
      if(counts?.pending&&!counts.cancelled&&!timeline.boundaryReached){
        // One bounded grace interval, on the same timer. No new targets
        // may join after the nominal end; a finished promise can end it.
        timeline.boundaryReached=true;timeline.closed=true;
        const cap=Math.min(deadline,playStart+plan.lateLimit,now()+120);
        decision("assembly.boundary.wait",{pending:counts.pending,remaining:Math.max(0,cap-now())});
        if(cap>now()){armFinish(cap);return;}
      }
      finish("boundary");
    };
    if(now()>=end){complete();return;}
    try{
      timer=window.setTimeout(()=>{
        if(dead||epoch!==timerEpoch)return;
        timer=0;complete();
      },Math.max(0,end-now()));
    }catch(error){decision("assembly.timer.error",{name:error?.name});finish("setup-failed");}
  }
  function mountBoot(){
    if(!prefs.getBoolPref(BOOT_PREF,true)){removeBoot();return;}
    try{
      // Chrome-only, no network assets, no blur, no page mutation.
      const early=earlyBoot;
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
      if(dead)return;
      bootOwned=true;root.setAttribute("data-nocturne-boot","waiting");bootAt=now();
      if(dead)return;
      // First show the brand background, then ease in the mark. The
      // minimum readable hold is measured from this logo clock, not
      // from the earlier blank prelude.
      const lead=Math.max(0,BOOT_LEAD-(early?bootAt-early.at:0));
      const logo=bootMark.animate([{opacity:0,transform:"translateY(7px) scale(.96)"},{opacity:1,transform:"translateY(0) scale(1)"}],{delay:lead,duration:BOOT_ENTER,easing:"cubic-bezier(.2,.75,.25,1)",fill:"both"});
      if(dead){try{logo.finished.catch(()=>{});}catch{}try{logo.cancel();}catch{}return;}
      bootEffects.push(logo);logo.finished.catch(()=>{});
      decision("boot.show",{age:bootAt-started,adopted:!!early,backgroundAt:early?.at??bootAt,lead,minimum:BOOT_MIN,exit:BOOT_EXIT});
    }catch(error){removeBoot();decision("boot.error",{name:error?.name});}
  }
  function removeBoot(){
    let failed=0;
    const step=fn=>{try{fn();}catch{failed++;}};
    step(()=>{if(bootTimer)window.clearTimeout(bootTimer);});bootTimer=0;
    step(()=>{if(bootFrame)window.cancelAnimationFrame(bootFrame);});bootFrame=0;
    for(const a of bootEffects)step(()=>a.cancel());
    bootEffects=[];
    step(()=>boot?.remove());boot=null;bootMark=null;
    if(window[KEY]===finish&&bootOwned)step(()=>restoreMark(root,"data-nocturne-boot",bootBaseline));
    bootOwned=false;earlyBoot=null;
    if(failed)decision("boot.cleanup",{failed});
  }
  function exitBoot(resume){
    if(!boot){resume();return;}
    const overlay=boot;
    root.setAttribute("data-nocturne-boot","exit");
    const done=()=>{
      if(dead||boot!==overlay)return;
      removeBoot();decision("boot.handoff",{elapsed:now()-bootAt});
      try{resume();}catch(error){decision("assembly.resume.error",{name:error?.name});finish("setup-failed");}
    };
    // Allow the frozen proxy tree to receive a paint before the exit.
    bootFrame=window.requestAnimationFrame(()=>{
      bootFrame=0;if(dead||boot!==overlay)return;
      try{
        const logo=bootMark.animate([{opacity:1,transform:"scale(1)"},{opacity:0,transform:"scale(.94)"}],{duration:260,easing:"ease-in-out",fill:"both"});
        if(dead||boot!==overlay){try{logo.finished.catch(()=>{});}catch{}try{logo.cancel();}catch{}return;}
        bootEffects.push(logo);logo.finished.catch(()=>{});
        const fade=overlay.animate([{opacity:1},{opacity:0}],{delay:110,duration:BOOT_EXIT-110,easing:"ease-in-out",fill:"both"});
        if(dead||boot!==overlay){try{fade.finished.catch(()=>{});}catch{}try{fade.cancel();}catch{}return;}
        bootEffects.push(fade);fade.finished.then(done,()=>{
          if(!dead&&boot===overlay)finish("boot-cancelled");
        });
        bootTimer=window.setTimeout(done,BOOT_EXIT+150);
      }catch{done();}
    });
  }
  function hold(){
    const w=get("zen-appcontent-navbar-wrapper");
    if(w&&w!==holdNode){
      if(holdNode)restoreMark(holdNode,HOLD,holdBaseline);
      holdNode=w;holdBaseline=w.getAttribute(HOLD);
      w.setAttribute(HOLD,"true");
    }
  }
  function finish(reason="disposed"){
    if(dead||finish.finalizing)return;
    finish.finalizing=true;
    if(!["disposed","boundary","completed","watchdog","interrupted","effect-cancelled","boot-cancelled","setup-failed","insufficient-budget","geometry-unready"].includes(reason))reason="disposed";
    if(reason==="boundary"&&centerHandle?.validateTopology?.()===false)reason="interrupted";
    const outcome=ownedTimeline?.outcome;
    // Snapshot while exact ownership predicates still see live effects.
    // Setting dead first misclassifies every pending effect as retired.
    let counts,failed=0;
    const step=fn=>{try{fn();}catch{failed++;}};
    step(()=>{counts=outcome?.snapshot();});
    const currentHome=window.__zenSharedHomeV1;
    const lateLegacy=ownedTimeline&&currentHome&&currentHome!==homeRegistry&&currentHome.startupOutcomeVersion!==1?1:0;
    const legacy=(ownedTimeline?.legacy??0)+lateLegacy;
    if(reason==="boundary")reason=outcome&&!counts?"boundary-incomplete":startupBoundaryOutcome(counts,legacy);
    dead=true;
    if(ownedTimeline)ownedTimeline.closed=true;
    step(()=>outcome?.close());
    const owns=window[KEY]===finish;
    step(()=>window.__nocturneTrace?.("assembly.finish",()=>({playing,settling,seen:seen.size,effects:animations.size,age:now()-started,reason,counts,legacy}),{flush:true}));
    step(()=>{if(raf)window.cancelAnimationFrame(raf);});
    step(()=>{if(timer)window.clearTimeout(timer);});timer=0;
    step(()=>{if(nativeTimer)window.clearTimeout(nativeTimer);});nativeTimer=0;
    step(()=>{if(nativeFrame)window.cancelAnimationFrame(nativeFrame);});nativeFrame=0;
    step(()=>{if(nativeFrame2)window.cancelAnimationFrame(nativeFrame2);});nativeFrame2=0;
    step(()=>{if(lateFrame)window.cancelAnimationFrame(lateFrame);});
    step(()=>lateObserver?.disconnect());lateObserver=null;
    step(()=>lateResize?.disconnect());lateResize=null;
    step(()=>{if(nativeObserver)Services.obs.removeObserver(nativeObserver,"browser-delayed-startup-finished");});
    nativeObserver=null;
    for(const a of animations.keys()){
      // A rejected candidate seek may have replaced the originally
      // observed promise. Retire it before cancelling the current effect.
      if(ownedTimeline?.mode==="bloom")step(()=>a.finished.catch(()=>{}));
      step(()=>a.cancel());
    }
    animations.clear();
    if(ownedTimeline?.mode==="bloom")ownedTimeline.bloomDirect=null;
    // Only a normal boundary seals a still-owned surface. Abort must
    // not resurrect an externally cancelled animation via finish().
    const seal=reason.startsWith("completed");
    if(seal)step(()=>centerHandle?.seal());
    step(()=>centerHandle?.release());centerHandle=null;
    if(seal)step(()=>bookmarkHandle?.seal());
    step(()=>bookmarkHandle?.release());bookmarkHandle=null;
    if(owns)step(()=>{if(!pendingEngine)pendingEngine=window.__nocturneCenterMotion;pendingEngine?.releasePending();});
    for(const n of [...owned.keys()])step(()=>restore(n));
    for(const n of seen)step(()=>n.removeAttribute(MANAGED));
    seen.clear();
    for(const n of baseline)step(()=>n.removeAttribute(EXISTING));baseline.clear();
    step(()=>{if(sheetURI)window.windowUtils.removeSheet(sheetURI,window.windowUtils.USER_SHEET);});
    sheetURI=null;
    step(()=>style?.remove());style=null;
    const timeline=ownedTimeline;
    if(timeline){
      timeline.closed=true;
      const lease=timeline.homeLease;
      if(lease)step(()=>lease.release());
      else if(homeRegistry&&homeRegistry.startupLeaseVersion!==1&&window.__zenSharedHomeV1===homeRegistry)step(()=>homeRegistry.finishStartup?.());
      if(window.__nocturneStartupTimeline===timeline)delete window.__nocturneStartupTimeline;
    }
    ownedTimeline=null;homeRegistry=null;
    if(owns){
      if(phaseOwned)step(()=>restoreMark(root,PHASE,phaseBaseline));
      step(()=>window.__zenMagneticBookmarksShared?.syncAddressState?.());
      if(holdNode)step(()=>restoreMark(holdNode,HOLD,holdBaseline));
    }
    phaseOwned=false;holdNode=null;
    bootPreparing=false;step(removeBoot);
    for(const type of inputs)step(()=>window.removeEventListener(type,interrupt,true));
    step(()=>window.removeEventListener("resize",onResize));
    step(()=>window.removeEventListener("unload",finish));
    step(()=>window.removeEventListener("OnePlane:StartupState",schedule));
    step(()=>reduced.removeEventListener("change",preferenceChanged));
    step(()=>prefs.removeObserver(ENABLE,preferenceChanged));
    if(window[KEY]===finish)delete window[KEY];
    step(()=>window.__nocturneTrace?.("assembly.cleanup",{failed,owns},{flush:true}));
  }
  function settle(){
    typeof window!=="undefined"&&window.__nocturneTrace?.("assembly.settle",()=>({playing,settling,effects:animations.size}),{sample:1800});
    if(dead||settling)return;
    if(ownedTimeline?.mode==="bloom"||!playing||bootPreparing||ownedTimeline?.paused||reduced.matches||!animations.size){finish("interrupted");return;}
    settling=true;
    // Stop further stage admission immediately, including a late Home.
    if(ownedTimeline)ownedTimeline.closed=true;
    try{
    // The native background and page have never been touched.
    // Finish active effects from current values, not a different frame.
    root.setAttribute(PHASE,"settling");
    const homeLease=ownedTimeline?.homeLease;
    if(homeLease)homeLease.release();
    if(dead)return;
    // Interruption releases surfaces; do not finish() a potentially
    // cancelled proxy before its queued cancellation has been delivered.
    if(typeof centerHandle!=="undefined"){centerHandle?.release();centerHandle=null;}
    if(typeof bookmarkHandle!=="undefined"){bookmarkHandle?.release();bookmarkHandle=null;}
    if(dead)return;
    lateObserver?.disconnect();lateObserver=null;lateResize?.disconnect();lateResize=null;
    if(lateFrame)window.cancelAnimationFrame(lateFrame);lateFrame=0;
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
    armFinish(now()+155);
    }catch(error){decision("assembly.settle.error",{name:error?.name});finish("setup-failed");}
  }
  function interrupt(event){
    // Typing in Home or a web page must not terminate a chrome animation.
    // Explicit toolbar actions and customization can still interrupt it.
    const toolbar=!!event?.target?.closest?.("#nav-bar,#PersonalToolbar,#oneplane-tabs");
    const accepted=event?.isTrusted!==false&&(event?.type==="beforecustomization"||event?.type==="dragstart"||event?.type==="pointerdown"&&toolbar);
    decision("assembly.interrupt",{type:event?.type,trusted:event?.isTrusted,playing,toolbar,accepted});
    if(event?.isTrusted!==false&&boot&&["pointerdown","keydown","wheel","dragstart","beforecustomization"].includes(event?.type)){
      decision("boot.skip",{type:event.type});finish("interrupted");return;
    }
    if(accepted)settle();
  }
  let viewport=[window.innerWidth,window.innerHeight];
  function onResize(){
    const next=[window.innerWidth,window.innerHeight];
    const changed=Math.abs(next[0]-viewport[0])>1||Math.abs(next[1]-viewport[1])>1;
    typeof window!=="undefined"&&window.__nocturneTrace?.("assembly.resize",()=>({changed,playing,size:next}),{throttle:100,sample:1500});
    viewport=next;if(playing&&changed){if(bootPreparing)finish("interrupted");else settle();}
  }
  function preferenceChanged(){if(reduced.matches||bootPreparing&&!prefs.getBoolPref(ENABLE,true))finish("interrupted");else if(!prefs.getBoolPref(ENABLE,true))settle();}
  function bounds(n,ignoreOpacity=false){
    if(!n||n.hidden||n.collapsed)return null;
    const s=window.getComputedStyle(n),r=n.getBoundingClientRect();
    return s.display!=="none"&&s.visibility!=="hidden"&&(ignoreOpacity||Number(s.opacity)!==0)&&r.width>1&&r.height>1&&
      r.right>0&&r.left<window.innerWidth&&r.bottom>0&&r.top<window.innerHeight?r:null;
  }
  function play(n,frames,delay,length,retain=false,easing=EASE,complete=null,prepare=bootPreparing,startEffect=null,verify=null){
    if(!n||dead)return false;
    let a=null;
    try{
      a=n.animate(frames,{delay,duration:length,easing,fill:"both"});
      const timeline=ownedTimeline,record={n,frames,complete};
      // Observe cancellation and own the effect before pause/currentTime
      // can fail. External cancellation settles this exact record only.
      animations.set(a,record);
      const done=(cancelled=false)=>{
        if(dead||animations.get(a)!==record||!cancelled&&retain)return;
        animations.delete(a);
        if(!cancelled)try{a.cancel();}catch{}
        try{complete?.();}catch(error){decision("assembly.effect.cleanup-error",{name:error?.name});}
        if(cancelled)decision("assembly.effect.cancel",{retained:retain});
      };
      const promise=a.finished;
      if(!dead)timeline?.observeEffect?.(a,"direct",()=>!dead&&animations.get(a)===record&&
        (timeline.mode!=="bloom"||ownedTimeline===timeline&&window.__nocturneStartupTimeline===timeline));
      promise?.then(()=>done(),()=>done(true));
      if(dead)throw Error("assembly-disposed");
      if(prepare){a.pause();a.currentTime=0;}
      else if(startEffect)startEffect(a);
      if(verify)verify(a,promise);
      if(dead||animations.get(a)!==record)throw Error("assembly-disposed");
      return true;
    }catch(error){
      if(a){animations.delete(a);if(verify)try{a.finished.catch(()=>{});}catch{}try{a.cancel();}catch{}}
      decision("assembly.effect.error",{name:error?.name,paused:bootPreparing});
      return false;
    }
  }
  function save(n,k,value){
    let record=owned.get(n);
    if(!record){record=new Map();owned.set(n,record);}
    if(!record.has(k))record.set(k,{value:n.style.getPropertyValue(k),priority:n.style.getPropertyPriority(k)});
    n.style.setProperty(k,value,"important");
  }
  function restore(n){
    const record=owned.get(n);if(!record)return;
    owned.delete(n);
    let failed=0;const step=fn=>{try{fn();}catch{failed++;}};
    for(const [k,v] of record)step(()=>{if(v.value)n.style.setProperty(k,v.value,v.priority);else n.style.removeProperty(k);});
    for(const mark of [EFFECT,MOVE,CLIP])step(()=>n.removeAttribute(mark));
    step(()=>{if(n.hasAttribute?.("data-zr-startup-bloom-shape"))n.removeAttribute("data-zr-startup-bloom-shape");});
    if(failed)decision("assembly.effect.cleanup",{failed});
  }
  function reveal(n,{x=0,y=0,clip=false,delay=0,length=350,easing=EASE,late=false,bloomTiming=null,bloomShape=false}={}){
    if(dead||ownedTimeline?.closed||!n||seen.has(n)||!bounds(n,true))return false;
    // Remove the pending gate before sampling native opacity. All changes
    // occur synchronously, before the next paint.
    const candidate=bloomTiming?ownedTimeline:null;
    const candidateCurrent=()=>!candidate||!dead&&ownedTimeline===candidate&&
      window.__nocturneStartupTimeline===candidate&&!candidate.closed&&candidate.paused;
    if(!candidateCurrent())return false;
    if(candidate)seen.add(n);
    n.setAttribute(MANAGED,"true");
    // Keep transitions disabled while sampling the ungated resting style.
    // Re-enabling them here captures the previous zero-opacity transition.
    const cs=window.getComputedStyle(n),opacity=Number(cs.opacity);
    if(!candidateCurrent())return false;
    if(!Number.isFinite(opacity)||opacity<=0){n.removeAttribute(MANAGED);if(candidate)seen.delete(n);return false;}
    seen.add(n);
    if(bloomTiming&&(!registered||baseline.has(n)||opacity>1||n.getAnimations().length||
      bloomShape&&cs.scale!=="none"&&!/^1(?: 1){0,2}$/.test(cs.scale)))return false;
    if(n.matches?.(".oneplane-tab,.oneplane-split-group"))window.__nocturneTrace?.("assembly.card.rest",()=>({opacity,x,y}),{throttle:80});
    const alreadyPainted=baseline.has(n)||late&&!clip&&!n.matches?.("#PlacesToolbarItems > *");
    const initial=bloomTiming?0:alreadyPainted ? .72 : 0;
    if(alreadyPainted)clip=false;
    const nativeTranslate=cs.translate||"none";
    const canMove=nativeTranslate==="none"||/^0(?:px|%)?(?: 0(?:px|%)?){0,2}$/.test(nativeTranslate);
    // Do not replace a nonzero native translation (notably the floating
    // URL bar). Clip and fade the actual popup instead.
    if(!canMove){x=0;y=0;}
    const timeline=ownedTimeline;
    const offset=late?timeline?.elapsed?.():0;
    const lateEffect=late?startupLateEffect(plan,playStart,finishAt,deadline,now(),delay,length,offset):null;
    if(late&&!lateEffect){
      decision("assembly.late.skip",{reason:"insufficient-budget"});
      return false;
    }
    const start=bloomTiming?.delay??lateEffect?.delay??Math.max(0,delay*scale);
    const time=bloomTiming?.duration??lateEffect?.length??length*scale;
    if(lateEffect)extendFinish(lateEffect.finishAt);
    if(dead||timeline?.closed)return false;
    const startLate=late&&timeline?.startEffect? a=>timeline.startEffect(a,offset):null;
    let acquired=false;
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
      if(bloomShape)n.setAttribute("data-zr-startup-bloom-shape","true");
      const resting=bloomTiming&&bloomShape?n.getBoundingClientRect():null;
      const verify=bloomTiming?(a,promise)=>prepareBloomDirect(n,a,promise,timeline,start,time,opacity,resting):null;
      acquired=play(n,[{[PROGRESS]:String(initial)},{[PROGRESS]:"1"}],start,time,false,easing,()=>restore(n),!late,startLate,verify);
      if(!acquired)restore(n);
    }else{
      const from={opacity:opacity*initial},to={opacity};
      if(x||y){from.translate=x*(1-initial)+"px "+y*(1-initial)+"px";to.translate="0px 0px";}
      if(clip){from.clipPath="inset(0 49% 0 49% round 8px)";to.clipPath="inset(-8px round 8px)";}
      acquired=play(n,[from,to],start,time,false,easing,null,!late,startLate);
    }
    // Keep a failed direct target ungated and at its resting style.
    return acquired;
  }
  // The direct effects stay in Assembly's existing animations Map.
  // Batch sampled writes before reads across all direct targets. The
  // temporary list is only a preparation index, not a second owner.
  function bloomEffectCurrent(entry,timeline){
    const {a,promise}=entry;
    if(dead||ownedTimeline!==timeline||window.__nocturneStartupTimeline!==timeline||
       timeline.closed||!timeline.paused||!animations.has(a)||a.timeline!==document.timeline||
       a.playState!=="paused"||a.pending||a.playbackRate!==1||a.finished!==promise)
      throw Error("assembly-bloom-effect");
  }
  function prepareBloomDirect(n,a,promise,timeline,delay,duration,opacity,resting){
    const entry={n,a,promise,delay,duration,opacity,resting};
    bloomEffectCurrent(entry,timeline);
    const list=timeline.bloomDirect??(timeline.bloomDirect=[]);
    if(list.length>=256)throw Error("assembly-bloom-direct-limit");
    list.push(entry);
  }
  function verifyBloomDirect(timeline){
    const list=timeline.bloomDirect||[];
    const near=(a,b,eps)=>Number.isFinite(a)&&Math.abs(a-b)<=eps;
    for(const fraction of [0,.5,0]){
      for(const entry of list){
        bloomEffectCurrent(entry,timeline);
        const {a,delay,duration}=entry;
        a.currentTime=fraction?delay+duration*fraction:0;
        bloomEffectCurrent(entry,timeline);
      }
      for(const entry of list){
        bloomEffectCurrent(entry,timeline);
        const {n,opacity,resting}=entry;
        const cs=window.getComputedStyle(n),progress=Number(cs.getPropertyValue(PROGRESS)),alpha=Number(cs.opacity);
        if(!Number.isFinite(progress)||fraction===0&&!near(progress,0,.005)||
           fraction!==0&&(progress<=0||progress>=1)||!near(alpha,opacity*progress,.005))
          throw Error("assembly-bloom-alpha");
        if(resting){
          const r=n.getBoundingClientRect(),parts=String(cs.scale).trim().split(/\s+/).map(Number),sx=.45+.55*progress;
          if(parts.length!==2||!near(parts[0],sx,.005)||!near(parts[1],1,.005)||
             !near(r.width,resting.width*sx,.75)||!near(r.height,resting.height,.75)||
             !near(r.left+r.width/2,resting.left+resting.width/2,.75)||!near(r.top+r.height/2,resting.top+resting.height/2,.75))
            throw Error("assembly-bloom-shape");
        }
      }
    }
    timeline.bloomDirect=null;
    decision("assembly.bloom.direct",{count:list.length,checks:3});
  }
  function bloomDirect(n,timing,kind="fade"){
    if(!n||!bounds(n,true))return false;
    const timeline=ownedTimeline;
    if(dead||timeline?.mode!=="bloom"||timeline.closed||!timeline.paused||
       window.__nocturneStartupTimeline!==timeline||!Number.isFinite(timing.delay)||
       !Number.isFinite(timing.duration)||timing.delay<0||timing.duration<=0||
       timing.delay+timing.duration>timeline.finishLength+1e-7)throw Error("assembly-bloom-admission");
    if(baseline.has(n)){seen.add(n);n.setAttribute(MANAGED,"true");return false;}
    const shape=kind==="islandShape",frames=startupBloomFrames(kind);
    if(!reveal(n,{bloomTiming:timing,bloomShape:shape,easing:frames[0].easing||"linear"}))
      throw Error("assembly-bloom-direct");
    return true;
  }
  function bloomStage(n,stage,kind="fade"){
    return bloomDirect(n,{delay:stage.start,duration:stage.end-stage.start},kind);
  }
  function bloomIsland(island,stages){
    if(!island||!bounds(island,true))return;
    // Measure the visible label before the parent is scaled. Its delay
    // starts exactly at the end of the shape stage, so alpha never doubles.
    const labels=[...island.children].filter(n=>n.matches(".oneplane-island-title,svg")&&bounds(n,true));
    if(labels.length!==1)throw Error("assembly-bloom-island-structure");
    bloomStage(labels[0],stages.islandLabel);
    bloomStage(island,stages.islandShape,"islandShape");
  }
  function extendFinish(until){
    // Late chrome may get a short reveal but cannot keep the startup hold
    // forever. All cleanup is still guaranteed by the final timer.
    const end=Math.min(deadline,playStart+plan.lateLimit,Math.max(finishAt,until));
    if(end===finishAt)return;
    finishAt=end;
    armFinish(finishAt);
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
    if(ownedTimeline?.mode==="bloom"){
      const group=[...left,...right].filter(({n})=>!seen.has(n)&&![...seen].some(other=>other.contains(n)||n.contains(other)));
      if(late){for(const {n} of group){seen.add(n);n.setAttribute(MANAGED,"true");}return;}
      const timing=startupBloomStagger(group.length,ownedTimeline.bloom.tabs);
      group.forEach(({n},i)=>bloomDirect(n,timing[i]));return;
    }
    for(const [side,group] of [[-1,left],[1,right]])for(let i=0;i<group.length;i++){
      const {n}=group[i];
      if(seen.has(n)||[...seen].some(other=>other.contains(n)||n.contains(other)))continue;
      reveal(n,{x:-side*14,y:-4,delay:260+Math.min(i*32,160),length:390,late});
    }
  }
  function revealBookmarks(center,late=false){
    const items=get("PlacesToolbarItems");
    const visible=Array.from(items?.children||[]).map(n=>({n,r:bounds(n,true)})).filter(x=>x.r);
    if(ownedTimeline?.mode==="bloom"){
      // Ungate all new children (including hidden ones) without replaying
      // an already-started wave. Existing direct effects keep ownership.
      if(late){for(const n of items?.children||[])if(!seen.has(n)){seen.add(n);n.setAttribute(MANAGED,"true");}return;}
      const group=visible.filter(({n})=>!seen.has(n)),timing=startupBloomStagger(group.length,ownedTimeline.bloom.bookmarks);
      group.forEach(({n},i)=>bloomDirect(n,timing[i]));return;
    }
    if(!visible.length)return;
    const bmCenter=(Math.min(...visible.map(x=>x.r.left))+Math.max(...visible.map(x=>x.r.right)))/2;
    const max=Math.max(1,...visible.map(x=>Math.abs(x.r.left+x.r.width/2-bmCenter)));
    for(const {n,r} of visible){
      const dx=Math.abs(r.left+r.width/2-bmCenter);
      reveal(n,{x:0,y:-16,delay:430+dx/max*115,length:430,easing:FADE,late});
    }
  }
  function acquireStartupBookmarks(engine,items,timeline){
    if(dead||!centerHandle||!items||!engine||window.__nocturneCenterMotion!==engine)return null;
    const prepared=[];
    let handle=null;
    try{
      for(const n of items.children){
        if(seen.has(n))continue;
        prepared.push({n,mark:n.getAttribute(MANAGED)});
        seen.add(n);n.setAttribute(MANAGED,"true");
      }
      handle=engine.bookmarks?.({owner:"startup",direction:"in",duration:Math.round(420*scale),delay:Math.round(timeline.bookmarks*scale),paused:timeline.paused,observeEffect:timeline.observeEffect})||null;
      if(dead||window.__nocturneCenterMotion!==engine){handle?.release();handle=null;}
      return handle;
    }catch(error){
      try{handle?.release();}catch{}
      handle=null;decision("assembly.bookmarks.error",{name:error?.name});return null;
    }finally{
      if(!handle&&!dead){
        for(const {n,mark} of prepared){
          seen.delete(n);
          if(mark===null)n.removeAttribute(MANAGED);else n.setAttribute(MANAGED,mark);
        }
        decision("assembly.bookmarks.fallback",{count:prepared.length});
      }
    }
  }
  function scheduleLate(){
    if(dead||!playing||settling||bootPreparing||ownedTimeline?.paused||ownedTimeline?.closed||lateFrame)return;
    const timeline=ownedTimeline;
    lateFrame=window.requestAnimationFrame(()=>{
      lateFrame=0;if(dead||settling||ownedTimeline?.closed)return;
      if(timeline?.mode==="bloom"&&(ownedTimeline!==timeline||window.__nocturneStartupTimeline!==timeline)){finish("interrupted");return;}
      try{
      const bar=floatingBar();
      if(bar&&!seen.has(bar)){
        if(ownedTimeline?.mode==="bloom"){seen.add(bar);bar.setAttribute(MANAGED,"true");}
        else openFromCenter(bar,590,440,true);
      }
      if(!bookmarkHandle)revealBookmarks(window.innerWidth/2,true);
      else for(const n of get("PlacesToolbarItems")?.children||[]){n.setAttribute(MANAGED,"true");seen.add(n);}
      const row=get("oneplane-tabs"),url=get("urlbar-container"),center=window.innerWidth/2;
      controls(row,url,center,true);
      // Cards inserted after the snapshot appear in their real slots.
      // Never restart an already-playing train for late mirror mutations.
      }catch(error){decision("assembly.late.error",{name:error?.name});finish("setup-failed");}
    });
  }
  // WAAPI startTime is a document-timeline time, not performance.now().
  // Assign the exact epoch to prepared effects rather than enqueueing
  // independent play tasks.
  function bindStartupEpoch(timeline,clock){
    const epoch=clock?.currentTime;
    if(!Number.isFinite(epoch))throw Error("startup-timeline-inactive");
    timeline.epoch=epoch;
    timeline.elapsed=()=>{
      const value=clock.currentTime;
      return Number.isFinite(value)?Math.max(0,value-epoch):Infinity;
    };
    timeline.startEffect=(a,offset=0)=>{
      if(dead||ownedTimeline!==timeline||timeline.closed||timeline.paused||
         timeline.mode==="bloom"&&window.__nocturneStartupTimeline!==timeline)throw Error("startup-epoch-stale");
      if(!Number.isFinite(offset)||offset<0||!Number.isFinite(clock.currentTime)||a.timeline!==clock||a.playState==="idle")
        throw Error("startup-effect-timeline");
      a.startTime=epoch+offset;
      if(dead||ownedTimeline!==timeline||timeline.closed||
         timeline.mode==="bloom"&&window.__nocturneStartupTimeline!==timeline)throw Error("startup-epoch-stale");
    };
  }
  function resumePrepared(timeline){
    const check=()=>{if(dead||timeline.closed||ownedTimeline!==timeline||timeline.paused)throw Error("startup-epoch-stale");};
    check();let legacy=0;
    for(const a of animations.keys())timeline.startEffect(a);
    for(const handle of [centerHandle,bookmarkHandle,timeline.homeLease]){
      if(!handle)continue;
      check();
      const exactEpoch=typeof handle.resumeAt==="function";
      if(!exactEpoch||handle.startupOutcomeVersion!==1)legacy++;
      if(exactEpoch)handle.resumeAt(timeline.startEffect);
      else handle.resume?.();
    }
    check();
    if(!timeline.homeLease&&homeRegistry&&window.__zenSharedHomeV1===homeRegistry){
      if(homeRegistry.startupOutcomeVersion!==1)legacy++;
      if(homeRegistry.startupLeaseVersion!==1)homeRegistry.resumeStartup?.();
    }
    check();return legacy;
  }
  function launch(one){
    typeof window!=="undefined"&&window.__nocturneTrace?.("assembly.launch",()=>({one,paintCount:window.windowUtils?.paintCount,phase:root.getAttribute(PHASE),ready:root.getAttribute(READY),age:now()-started}),{sample:1800});
    if(dead||playing||settling)return;playing=true;bootPreparing=!!boot;
    try{
      // Prime the resting contour while the startup gate is still held.
      const preflightAt=now();
      window.__zenMagneticBookmarksShared?.syncAddressState?.();
      const layout=window.__oneplaneLayoutController;
      const prepared=one?layout?.prepareWorkspaceGeometry?.():undefined;
      if(dead)return;
      const ready=!one||!!layout&&typeof layout.prepareWorkspaceGeometry==="function"&&window.__oneplaneLayoutController===layout&&prepared!==false&&
        (layout.geometryPreflightVersion!==1||prepared===true);
      window.__nocturneTrace?.("assembly.preflight",{elapsed:now()-preflightAt,ready,legacy:!!one&&!!layout&&layout.geometryPreflightVersion!==1},{sample:1000});
      if(dead)return;
      if(!ready||one&&window.__oneplaneLayoutController!==layout){finish("geometry-unready");return;}
      const engine=window.__nocturneCenterMotion;pendingEngine=engine;
      const row=get("oneplane-tabs"),url=get("urlbar-container");
      const bookmarks=get("PersonalToolbar"),items=get("PlacesToolbarItems");
      const floating=floatingBar();
      // Retain the waiting gate until the initial effects own their nodes.
      // Bounds ignore the gate; each target is ungated synchronously by reveal().
      const ur=bounds(url,true),rr=one?bounds(row,true):null;
      const island=one?row?.querySelector(".oneplane-title-island"):null,ir=bounds(island,true);
      const center=ir?ir.left+ir.width/2:one&&rr?rr.left+rr.width/2:ur?ur.left+ur.width/2:window.innerWidth/2;
      playStart=now();
      const overhead=bootPreparing?BOOT_EXIT+150:0;
      if(!startupFits(plan,playStart,deadline,overhead)){
        decision("assembly.skip",{reason:"insufficient-budget",stage:"launch",remaining:deadline-playStart,needed:plan.finishLength+overhead});finish("insufficient-budget");return;
      }
      const timeline={...plan,start:playStart};
      timeline.paused=true;
      timeline.outcome=createStartupOutcome(surface=>{
        if(dead||ownedTimeline!==timeline)return;
        decision("assembly.outcome.cancel",{surface});
        finish("effect-cancelled");
      },()=>{
        if(dead||ownedTimeline!==timeline||!timeline.boundaryReached||settling)return;
        if(now()>=deadline){finish("watchdog");return;}
        if(!timeline.outcome.snapshot().pending)finish("boundary");
      });
      timeline.observeEffect=timeline.outcome.observe;
      finishAt=playStart+timeline.finishLength;
      ownedTimeline=timeline;window.__nocturneStartupTimeline=timeline;
      homeRegistry=window.__zenSharedHomeV1;
      const surface=one?get("oneplane-toolbar-surface"):null,bloom=timeline.mode==="bloom";
      if(bloom&&(!one||!rr||!registered||engine?.startupBloomVersion!==1||homeRegistry?.startupBloomVersion!==1))
        throw Error("assembly-bloom-owner");
      // Fold preserves its original order. Bloom measures the resting
      // strip/Island before any direct shape effects are prepared.
      if(!bloom&&surface)reveal(surface,{y:-18,delay:timeline.panel,length:timeline.panelLength});
      decision("assembly.timeline",{mode:bloom?"bloom":"fold",panel:!!surface,cardsAt:timeline.cards*scale,homeAt:timeline.home*scale});
      // The native floating field may be a top-layer popover; never clip
      // its parent during its independent entrance.
      if(!bloom&&ur&&!floating)openFromCenter(url,45,410);
      if(dead)return;
      if(one&&rr){
        const cards=[...row.querySelectorAll(".oneplane-tab,.oneplane-split-group")];
        const gated=root.hasAttribute("data-zr-center-pending");
        const cold=window.__nocturneLayoutStartup?.initial===true;
        const painted=!gated&&!cold&&cards.some(n=>baseline.has(n));
        // Remove per-card startup gates together, including split members.
        for(const n of cards){n.setAttribute(MANAGED,"true");seen.add(n);}
        if(!painted){
          const options={owner:"startup",direction:"in",duration:Math.round(timeline.cardsLength*scale),delay:Math.round(timeline.cards*scale),paused:timeline.paused,observeEffect:timeline.observeEffect,
            onTopologyInvalidated:()=>{if(!dead&&ownedTimeline===timeline)finish("interrupted");}};
          if(bloom){
            const fold=startupTimeline(0,scale);
            options.duration=Math.round(fold.cardsLength*scale);options.delay=Math.round(fold.cards*scale);
            options.bloomTimeline=timeline;
          }
          const handle=engine?.start(row,options);
          if(dead||window.__nocturneCenterMotion!==engine){handle?.release();finish();return;}
          centerHandle=handle;
        }else engine?.releasePending();
        decision("assembly.center.result",{painted,gated,cold,engine:!!engine,count:centerHandle?.count||0,mode:centerHandle?.mode||"none"});
        const plus=row.querySelector(".oneplane-new-tab");
        if(bloom){
          if(painted||cards.length&&!centerHandle)throw Error("assembly-bloom-center");
          if(surface)bloomStage(surface,timeline.bloom.panel);
          if(ur&&!floating)bloomStage(url,timeline.bloom.search);
          if(bounds(plus,true))bloomStage(plus,timeline.bloom.tabs);
          if(ir)bloomIsland(island,timeline.bloom);
        }else{
          if(bounds(plus,true))slide(plus,-26,0,400,350);
          if(ir)reveal(island,{delay:150,length:190});
        }
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
      if(dead)return;
      if(!bloom)bookmarkHandle=acquireStartupBookmarks(engine,items,timeline);
      if(dead)return;
      if(one&&window.__nocturneCenterMotion!==engine){finish();return;}
      if(!bookmarkHandle)revealBookmarks(center);
      if(floating){if(bloom)bloomStage(floating,timeline.bloom.search);else openFromCenter(floating,590,440);}
      if(dead)return;
      if(bloom)verifyBloomDirect(timeline);
      if(dead)return;
      const stagedHome=bloom&&get("zen-shared-home")?.hasAttribute("data-zh-startup");
      homeRegistry?.playStartup?.(timeline);
      if(dead)return;
      if(bloom&&(window.__nocturneStartupTimeline!==timeline||window.__nocturneCenterMotion!==engine||
         window.__zenSharedHomeV1!==homeRegistry||stagedHome&&!timeline.homeLease))
        throw Error("assembly-bloom-home");
      const preparedHome=bloom?timeline.homeLease:null;
      let verifyPrepared=null;
      if(bloom){
        // Close candidate admission, not the outcome ledger. Home shown
        // during the remaining Boot hold must not append a second cohort.
        timeline.bloomPrepared=true;
        verifyPrepared=timeline.outcome.capturePrepared(document.timeline);
      }
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
        if(dead||timeline.closed||ownedTimeline!==timeline||!timeline.paused)return;
        const resumedAt=now();
        if(!startupFits(plan,resumedAt,deadline)){
          decision("assembly.skip",{reason:"insufficient-budget",stage:"resume",remaining:deadline-resumedAt,needed:plan.finishLength});finish("insufficient-budget");return;
        }
        const fromBoot=bootPreparing;
        if(bloom){
          if(window.__nocturneStartupTimeline!==timeline||window.__nocturneCenterMotion!==engine||
             window.__zenSharedHomeV1!==homeRegistry||timeline.homeLease!==preparedHome||
             get("oneplane-tabs")!==row||row.hasAttribute("data-op-dragging")||
             root.hasAttribute("customizing")||root.getAttribute("inDOMFullscreen")==="true"||
             root.getAttribute("inFullscreen")==="true"||window.closed)
            throw Error("assembly-bloom-owner");
          verifyPrepared();
        }
        bindStartupEpoch(timeline,document.timeline);
        bootPreparing=false;
        playStart=resumedAt;timeline.start=playStart;timeline.paused=false;
        finishAt=playStart+timeline.finishLength;
        const legacy=resumePrepared(timeline);
        if(dead)return;
        if(bloom&&(legacy||window.__nocturneStartupTimeline!==timeline||
           window.__nocturneCenterMotion!==engine||window.__zenSharedHomeV1!==homeRegistry))
          throw Error("assembly-bloom-epoch");
        timeline.legacy=legacy;
        decision("assembly.epoch",{mode:bloom?"bloom":"fold",prepared:animations.size,legacy,fromBoot});
        if(fromBoot)decision("boot.assembly.start",{age:playStart-started,prepared:animations.size});
        scheduleLate();
        armFinish(finishAt);
      };
      if(dead)return;
      if(bootPreparing){
        // Keep the hard fail-open deadline while waiting for the exit.
        armFinish();
        if(!dead)exitBoot(resume);
      }else resume();
    }catch(error){decision("assembly.launch.error",{name:error?.name});console.warn("[Zen Refined] Startup reveal failed:",error);finish("setup-failed");}
  }
  function schedule(){
    if(dead||playing||settling||raf)return;
    try{raf=window.requestAnimationFrame(tick);}catch(error){decision("assembly.readiness.error",{name:error?.name});finish("setup-failed");}
  }
  let readinessKey="",quietSince=started,resourceRevision=0,resourceOwners=null,resourceNodes=[];
  function sampleStartupResources(row,force=false){
    const engine=window.__nocturneCenterMotion,home=window.__zenSharedHomeV1;
    const owners=[row,engine,home];
    const changed=!resourceOwners||owners.some((v,i)=>v!==resourceOwners[i]);
    if(!force&&!changed&&now()-iconCheckAt<75)return;
    iconCheckAt=now();
    // Compare local DOM identities, not the strip's fixed lane count.
    // Do not serialize nodes or favicon URLs into diagnostics.
    const nodes=Array.from(row?.querySelectorAll(".oneplane-tab,.oneplane-split-group,.oneplane-tab-icon img")||[]);
    if(changed||nodes.length!==resourceNodes.length||nodes.some((n,i)=>n!==resourceNodes[i]))resourceRevision++;
    resourceOwners=owners;resourceNodes=nodes;
    iconStatus=row?(engine?.warmIcons?.(row)||engine?.iconStats?.(row)||null):null;
    homeIcons=home?.warmStartupIcons?.()||null;
  }
  function tick(){
    raf=0;if(dead||playing)return;
    try{checkReadiness();}catch(error){decision("assembly.readiness.error",{name:error?.name});finish("setup-failed");}
  }
  function selectStartupPlan(one,overhead){
    const fold=startupTimeline(0,scale);
    if(!BLOOM_CANDIDATE||!one||lateStart||!registered||window.__nocturneLayoutStartup?.initial!==true||
       window.__nocturneCenterMotion?.startupBloomVersion!==1||window.__zenSharedHomeV1?.startupBloomVersion!==1)
      return fold;
    const candidate=startupTimeline(0,scale,"bloom");
    if(startupFits(candidate,now(),deadline,overhead))return candidate;
    decision("assembly.bloom.fallback",{reason:"budget"});
    return fold;
  }
  function checkReadiness(){
    if(now()>=deadline){decision("assembly.skip",{reason:"deadline",nativeReady,settled,state:root.getAttribute(READY)});finish("watchdog");return;}
    if(window.closed||root.hasAttribute("customizing")||root.getAttribute("inDOMFullscreen")==="true"){finish();return;}
    hold();pendingEngine=window.__nocturneCenterMotion;
    // Warm icons while native restore is still running, not only after it.
    const earlyRow=get("oneplane-tabs");
    if(!nativeReady||!settled){if(boot)sampleStartupResources(earlyRow);schedule();return;}
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
    if(!iconWaitAt)iconWaitAt=now();
    sampleStartupResources(one?row:null);
    if(dead)return;
    const homeState=window.__nocturneLayoutStartup?.homeState||"unavailable";
    const waiting=homeState==="pending"||!!(iconStatus&&(iconStatus.pending+iconStatus.missing)>0||homeIcons?.pending>0);
    if(waiting&&now()-iconWaitAt<(boot?1400:600)){schedule();return;}
    // Missing/late Home and favicons share the existing bounded budget.
    // A fallback never authorizes replay of the startup stage later.

    // A narrow/hidden legacy strip falls back to native UI, never forces
    // a layout preference. With pending integration, fail open on timeout.
    if(!get("nav-bar")&&!get("navigator-toolbox")){schedule();return;}
    if(boot){
      const key=JSON.stringify([state,one,homeState,resourceRevision,iconStatus,homeIcons,window.innerWidth,window.innerHeight]);
      if(key!==readinessKey){readinessKey=key;quietSince=now();}
      if(!bootReady(now(),bootAt,BOOT_MIN,quietSince,deadline-BOOT_EXIT-200)){schedule();return;}
      decision("boot.ready",{elapsed:now()-bootAt,quiet:now()-quietSince});
    }
    decision("assembly.icons.ready",{...iconStatus,homeIcons,homeState,revision:resourceRevision,wait:now()-iconWaitAt,timeout:waiting});
    window.__nocturneTrace?.("assembly.ready",{one,active,state,expected,nativeReady,settled,homeState,resourceTimeout:waiting},{sample:2500});
    if(dead)return;
    // Do not start a full sequence which cannot fit the remaining budget.
    const overhead=boot?BOOT_EXIT+150:0;
    plan=selectStartupPlan(one,overhead);
    const needed=plan.finishLength+overhead;
    if(!startupFits(plan,now(),deadline,overhead)){decision("assembly.skip",{reason:"insufficient-budget",remaining:deadline-now(),needed});finish("insufficient-budget");return;}
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
      if(nativeTimer)try{window.clearTimeout(nativeTimer);}catch{}nativeTimer=0;
      try{
        nativeFrame=window.requestAnimationFrame(()=>{
          nativeFrame=0;if(dead)return;
          try{nativeFrame2=window.requestAnimationFrame(()=>{
            nativeFrame2=0;if(dead)return;settled=true;readyAt=now();schedule();
          });}catch{finish();}
        });
      }catch{finish();}
    };
    nativeTimer=window.setTimeout(()=>{decision("assembly.native.timeout",{});markReady();},900);
    try{Promise.allSettled([window.SessionStore?.promiseAllWindowsRestored,window.gZenWorkspaces?.promiseInitialized]).then(markReady,markReady);}
    catch{markReady();}
  }
  try{
    window[KEY]?.();window[KEY]=finish;
    claimBoot();pendingEngine=window.__nocturneCenterMotion;
    Object.defineProperty(finish,"deadline",{get:()=>deadline});
    armFinish();if(dead)return;
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
      ${base}[data-zr-startup-bloom-shape] {
        scale: calc(.45 + .55 * var(${PROGRESS})) 1 !important;
        transform-origin: center center !important;
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
    phaseOwned=true;root.setAttribute(PHASE,"waiting");try{window.__zenMagneticBookmarksShared?.syncAddressState?.();}catch{}
    if(dead)return;hold();if(dead)return;mountBoot();if(dead)return;
    console.info("[Zen Refined] Center Assembly: "+(lateStart?"late chrome startup":"prepaint startup"));
    if(window.gBrowserInit?.delayedStartupFinished)onNativeReady();
    else{nativeObserver=subject=>{if(subject!==window)return;Services.obs.removeObserver(nativeObserver,"browser-delayed-startup-finished");nativeObserver=null;onNativeReady();};
      Services.obs.addObserver(nativeObserver,"browser-delayed-startup-finished");}
    schedule();
  }catch(error){console.warn("[Zen Refined] Startup controller:",error);finish("setup-failed");}
})();
