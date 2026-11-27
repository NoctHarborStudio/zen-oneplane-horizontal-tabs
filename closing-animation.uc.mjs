// Home Island variant B, approved in the comparison prototype.
const HOME_ISLAND_DURATION=540;
const HOME_ISLAND_TRAVEL="--zr-island-travel",HOME_ISLAND_SCALE="--zr-island-scale";
function registerHomeIslandMotion(css){
  for(const name of [HOME_ISLAND_TRAVEL,HOME_ISLAND_SCALE]){
    try{css.registerProperty({name,syntax:"<number>",inherits:false,initialValue:"1"});}
    catch(e){if(e.name!=="InvalidModificationError")return false;}
  }
  return true;
}
function homeIslandDistance(bottom){return -Math.max(66,bottom+2);}
function homeIslandPose(t){
  const clamp=x=>Math.min(1,Math.max(0,x));
  const bezier=(t,x1,y1,x2,y2)=>{
    t=clamp(t);if(t===0||t===1)return t;
    let l=0,r=1;
    const b=(u,a,c)=>3*(1-u)*(1-u)*u*a+3*(1-u)*u*u*c+u*u*u;
    for(let i=0;i<24;i++){const m=(l+r)/2;if(b(m,x1,x2)<t)l=m;else r=m;}
    return b((l+r)/2,y1,y2);
  };
  t=clamp(t);
  const a=clamp(t/.3);
  return {travel:bezier(t,.25,.8,.22,1),scale:.02+.98*bezier((t-.2)/.8,.3,0,.12,1),opacity:a*a*(3-2*a)};
}
function homeIslandFrames(reverse=false){
  return Array.from({length:81},(_,i)=>({offset:i/80,...homeIslandPose((reverse?80-i:i)/80)}));
}

// Shared horizontal edge choreography. Each side travels as one group;
// the widest measured extent determines the offscreen starting position.
const EDGE_CONTROL_EASE="cubic-bezier(.45,0,.55,1)";
const EDGE_CONTROL_SELECTOR="toolbarbutton,button,.titlebar-button,[role=button],#titlebar-min,#titlebar-max,#titlebar-restore,#titlebar-close";
function edgeControlOffsets(rects,center,width){
  if(!Number.isFinite(center)||!Number.isFinite(width)||width<=0)throw RangeError("edge-control-viewport");
  const sides=rects.map(r=>{
    if(![r.left,r.right].every(Number.isFinite)||r.right<=r.left)throw RangeError("edge-control-rect");
    return (r.left+r.right)/2<center?-1:1;
  });
  const left=Math.max(0,...rects.filter((_,i)=>sides[i]<0).map(r=>r.right))+8;
  const right=Math.max(0,...rects.filter((_,i)=>sides[i]>0).map(r=>width-r.left))+8;
  return sides.map(side=>side<0?-left:right);
}

// Center Flow: visible choreography only; Boot and the branded close
// finale have independent native-readiness/confirmation ownership.
const CENTER_FLOW_MS=2400;
const CENTER_FLOW_CLOSE_MS=1600;
const CENTER_FLOW_STAGES=Object.freeze({
  panel:[48,552],island:[216,996],tabs:[824,1968],edges:[840,1680],
  bookmarks:[1152,2016],search:[936,1656],pinLabel:[1176,1728],
  workspaceLabel:[1560,2064],footer:[1944,2400],body:[936,1968]
});
function centerFlowDuration(value){
  if([450,600,760,1000,1050,1250,1500].includes(value))
    return Math.round(CENTER_FLOW_MS*value/1050);
  return Number.isFinite(value)?Math.max(900,Math.min(3600,value)):CENTER_FLOW_MS;
}
function centerFlowStage(name,duration=CENTER_FLOW_MS,reverse=false,rank=0){
  if(!Number.isFinite(duration)||duration<=0)throw RangeError("center-flow-duration");
  rank=Math.max(0,Math.min(1,Number.isFinite(rank)?rank:0));
  const a=name==="pin"?[1224+312*rank,1872+312*rank]:
    name==="workspace"?[1584+132*rank,2160+132*rank]:CENTER_FLOW_STAGES[name];
  if(!a)throw RangeError("center-flow-stage");
  return {delay:(reverse?CENTER_FLOW_MS-a[1]:a[0])*duration/CENTER_FLOW_MS,
    duration:(a[1]-a[0])*duration/CENTER_FLOW_MS};
}
function centerFlowTimeline(start,scale){
  if(!Number.isFinite(start)||!Number.isFinite(scale)||scale<=0)throw RangeError("center-flow-plan");
  const [panel,island,tabs,edges,bookmarks,search]=["panel","island","tabs","edges","bookmarks","search"].map(n=>centerFlowStage(n));
  return {start,scale,mode:"fold",flow:true,panel:panel.delay,panelLength:panel.duration,
    islandStart:island.delay,islandLength:island.duration,islandShift:0,
    cards:tabs.delay,cardsLength:tabs.duration,edges:edges.delay,edgesLength:edges.duration,
    bookmarks:bookmarks.delay,bookmarksLength:bookmarks.duration,home:search.delay,homeLength:search.duration,
    end:CENTER_FLOW_MS,finishLength:CENTER_FLOW_MS*scale,lateLimit:(CENTER_FLOW_MS+420)*scale};
}
function homeFlowFrames(kind,opacity=1,reverse=false){
  const a={opacity:0},b={opacity};
  if(kind==="search"){a.transform="scale(.89,.96)";b.transform="scale(1,1)";}
  else if(kind==="pin"){a.transform="translateY(14px) scale(.93)";b.transform="translateY(0px) scale(1)";}
  else if(kind==="workspace"||kind==="body"){a.transform="translateY(9px)";b.transform="translateY(0px)";}
  return reverse?[b,a]:[a,b];
}
function homeFlowTargets(content,duration,reverse=false){
  if(!content)return [];
  const nodes=[...content.children],search=nodes.shift(),footer=nodes.pop(),pins=nodes.shift(),spaces=nodes.shift();
  const fallback=()=>[{node:content,kind:"body",...centerFlowStage("body",duration,reverse)}];
  if(nodes.length||!search?.matches(".zh-search")||!footer?.matches(".zh-footer")||
    !pins?.matches(".zh-section")||spaces&&!spaces.matches(".zh-section"))return fallback();
  const [pinLabel,pinGrid,...pinExtra]=pins.children;
  const [spaceLabel,spaceGrid,...spaceExtra]=spaces?[...spaces.children]:[];
  if(!pinLabel?.matches("h3")||!pinGrid?.matches(".zh-pins")||pinExtra.length||
     spaces&&(!spaceLabel?.matches("h3")||!spaceGrid?.matches(".zh-spaces")||
       spaceExtra.some(n=>!n.hidden)))return fallback();
  const targets=[];
  const add=(node,kind,stage=kind,rank=0)=>targets.push({node,kind,...centerFlowStage(stage,duration,reverse,rank)});
  const wave=(grid,kind)=>{
    const list=[...grid.children],rect=grid.getBoundingClientRect(),center=rect.left+rect.width/2;
    const scores=list.map(n=>{const r=n.getBoundingClientRect();return Math.abs(r.left+r.width/2-center)+Math.max(0,r.top-rect.top);});
    const max=Math.max(1,...scores);
    list.forEach((node,i)=>add(node,node.matches(".zh-empty")?"fade":kind,kind,scores[i]/max));
  };
  add(search,"search");add(pinLabel,"fade","pinLabel");wave(pinGrid,"pin");
  if(spaces){add(spaceLabel,"fade","workspaceLabel");wave(spaceGrid,"workspace");}
  add(footer,"fade","footer");
  return targets.length<=256?targets:fallback();
}
// Chrome-only brand mark shared by Boot and Center Disassembly.
function createNocturneBrandMark(document){
  const html=tag=>document.createElementNS("http://www.w3.org/1999/xhtml",tag);
  const bootMark=html("div");
  Object.assign(bootMark.style,{display:"grid",justifyItems:"center",gap:"20px",willChange:"transform, opacity"});
  const svg=document.createElementNS("http://www.w3.org/2000/svg","svg");
  svg.setAttribute("viewBox","0 0 72 72");svg.setAttribute("width","72");svg.setAttribute("height","72");
  const moon=document.createElementNS(svg.namespaceURI,"path");
  moon.setAttribute("d","M43 8 A29 29 0 1 0 62 53 A26 26 0 0 1 43 8Z");moon.setAttribute("fill","#c4c8e5");
  const star=document.createElementNS(svg.namespaceURI,"path");
  star.setAttribute("d","M55 12 L57 19 L64 21 L57 23 L55 30 L53 23 L46 21 L53 19Z");star.setAttribute("fill","#e4e5ef");svg.append(moon,star);
  const label=html("div");label.textContent="NOCTURNE";
  Object.assign(label.style,{font:"300 24px system-ui, sans-serif",letterSpacing:"7px",paddingInlineStart:"7px"});
  bootMark.append(svg,label);
  return bootMark;
}
// Experimental whole-window alpha; CSS fade remains the unsupported/error path.
const CLOSE_COVER_MS=320,CLOSE_LOGO_MS=460,CLOSE_FADE_MS=500;
const LAYERED=0x80000,NO_REDIRECTION=0x200000,CLASS_DC=0x60;
function closeWindowAlpha(t){
  t=Math.max(0,Math.min(1,t));
  if(t===0)return 255;if(t===1)return 0;
  const b=(u,a,c)=>3*(1-u)*(1-u)*u*a+3*(1-u)*u*u*c+u*u*u;
  let l=0,r=1;
  for(let i=0;i<18;i++){const m=(l+r)/2;if(b(m,.42,.58)<t)l=m;else r=m;}
  return Math.round(255*(1-b((l+r)/2,0,1)));
}
// An exact-window, single-use lease. No changes to the backdrop, class style,
// focus, geometry, hit-testing style or global prefs. Never log HWND/paths.
function createLayeredWindowLease(api){
  let owns=false,closed=false,busy=0,retire=null,lastAlpha=null,failed=0;
  const releaseNow=commit=>{
    if(closed)return failed;closed=true;
    if(!commit&&owns){
      try{
        if(api.valid()){
          const style=api.style();
          if(style&LAYERED){
            // Keep unrelated extended style bits; this lease never adopts
            // a window that was layered before acquisition.
            try{api.alpha(255);}catch{}
            api.setStyle(style&~LAYERED);
            if(api.style()&LAYERED)failed++;
          }
        }
      }catch{failed++;}
    }
    try{api.close();}catch{failed++;}
    return failed;
  };
  const retireLease=commit=>{
    if(busy){retire=retire===false?false:commit;return 0;}
    return releaseNow(commit);
  };
  const use=fn=>{
    if(closed||retire!==null)return false;
    busy++;
    try{return fn();}catch{return false;}
    finally{if(--busy===0&&retire!==null)releaseNow(retire);}
  };
  return {
    acquire:()=>use(()=>{
      if(!api.valid())return false;
      const style=api.style(),classStyle=api.classStyle();
      if(!Number.isInteger(style)||!Number.isInteger(classStyle)||
         (style&(LAYERED|NO_REDIRECTION))||(classStyle&CLASS_DC))return false;
      // Claim before calling User32, which may dispatch messages synchronously.
      owns=true;api.setStyle(style|LAYERED);
      if(retire!==null||!api.valid()||!(api.style()&LAYERED))return false;
      if(!api.alpha(255))return false;
      lastAlpha=255;return api.readAlpha()===255;
    }),
    set:alpha=>use(()=>{
      if(!owns||!Number.isInteger(alpha)||alpha<0||alpha>255||
         !api.valid()||!(api.style()&LAYERED))return false;
      if(alpha===lastAlpha)return true;
      if(!api.alpha(alpha))return false;
      lastAlpha=alpha;return true;
    }),
    read:()=>{try{return !closed&&api.valid()?api.readAlpha():null;}catch{return null;}},
    release:()=>retireLease(false),commit:()=>retireLease(true)
  };
}
function createWindowsWindowAlpha({win,services,interfaces,loadCtypes}){
  const nativeHandle=()=>{
    if(win.closed)return null;
    const owner=win.docShell.treeOwner;
    let base;
    try{base=owner.QueryInterface(interfaces.nsIBaseWindow);}
    catch{base=owner.QueryInterface(interfaces.nsIInterfaceRequestor).getInterface(interfaces.nsIBaseWindow);}
    const value=base.nativeHandle;
    return typeof value==="string"&&/^0x[0-9a-f]+$/i.test(value)&&!/^0x0+$/i.test(value)?value:null;
  };
  const handle=nativeHandle();if(!handle)return null;
  const c=loadCtypes(),hwnd=c.voidptr_t(c.UInt64(handle));
  if(hwnd.isNull())return null;
  const file=services.dirsvc.get("SysD",interfaces.nsIFile).clone();file.append("user32.dll");
  const lib=c.open(file.path);
  try{
    const declare=(name,ret,...args)=>lib.declare(name,c.winapi_abi,ret,c.voidptr_t,...args);
    const get=declare("GetWindowLongW",c.int32_t,c.int32_t);
    const set=declare("SetWindowLongW",c.int32_t,c.int32_t,c.int32_t);
    const cls=declare("GetClassLongW",c.uint32_t,c.int32_t);
    const alpha=declare("SetLayeredWindowAttributes",c.int32_t,c.uint32_t,c.uint8_t,c.uint32_t);
    const read=declare("GetLayeredWindowAttributes",c.int32_t,c.uint32_t.ptr,c.uint8_t.ptr,c.uint32_t.ptr);
    return createLayeredWindowLease({
      valid:()=>nativeHandle()===handle,
      style:()=>{const v=get(hwnd,-20);return v===0?null:v;},
      classStyle:()=>{const v=cls(hwnd,-26);return v===0?null:v;},
      setStyle:value=>set(hwnd,-20,value),
      alpha:value=>!!alpha(hwnd,0,value,2),
      readAlpha:()=>{
        const a=c.uint8_t(),flags=c.uint32_t(),key=c.uint32_t();
        return read(hwnd,key.address(),a.address(),flags.address())&&flags.value===2?a.value:null;
      },
      close:()=>lib.close()
    });
  }catch(e){lib.close();throw e;}
}
function createCloseFinale({win,doc,root,start,onModal,windows=false,nativeFactory=null}){
  let cover=null,mark=null,active=true,listening=false,sealed=false,frame=null,native=null;
  let rootFade=null,epoch=null,fadeAt=0,end=0,frames=0,lastAlpha=255;
  const trace=(event,data)=>{try{win.__nocturneTrace?.(event,data,{flush:true});}catch{}};
  const effects=[];
  const animate=(node,keyframes,delay,duration,easing)=>{
    const effect=node.animate(keyframes,{delay,duration,easing,fill:"both"});
    effects.push(effect);effect.finished.catch(()=>{});
    if(Number.isFinite(epoch))effect.startTime=epoch;
    return effect;
  };
  const cssFade=()=>animate(root,[{opacity:1},{opacity:0}],fadeAt,CLOSE_FADE_MS,"ease-in-out");
  const stopFrame=()=>{const id=frame;frame=null;if(id!==null)try{win.cancelAnimationFrame(id);}catch{}};
  const dropNative=commit=>{
    const lease=native;native=null;if(!lease)return 0;
    let failed=0;try{failed=(commit?lease.commit():lease.release())||0;}catch{failed=1;}
    trace("disassembly.alpha.release",{committed:commit,failed});return failed;
  };
  const fallback=()=>{
    dropNative(false);
    if(active&&!rootFade){try{rootFade=cssFade();}catch{}}
    trace("disassembly.alpha.fallback",{frames,lastAlpha});
  };
  const release=()=>{
    if(!active)return 0;active=false;let failed=0;
    const step=fn=>{try{fn();}catch{failed++;}};
    stopFrame();
    if(listening)step(()=>win.removeEventListener("DOMWillOpenModalDialog",onModal,true));
    listening=false;
    // Restore native alpha before removing the opaque cover in the same task.
    failed+=dropNative(!!win.closed);
    step(()=>cover?.remove());
    for(const effect of effects)step(()=>effect.cancel());
    effects.length=0;cover=null;mark=null;return failed;
  };
  try{
    if(!Number.isFinite(start)||start<0||Number(win.getComputedStyle(root).opacity)!==1)return null;
    win.addEventListener("DOMWillOpenModalDialog",onModal,true);listening=true;
    cover=doc.createElementNS("http://www.w3.org/1999/xhtml","div");
    cover.id="nocturne-close-brand";cover.inert=true;cover.setAttribute("aria-hidden","true");
    Object.assign(cover.style,{position:"fixed",inset:"0",zIndex:"2147483647",display:"grid",placeItems:"center",background:"#111219",color:"#e4e5ef",pointerEvents:"none",overflow:"hidden",opacity:"0"});
    cover.style.setProperty("-moz-window-dragging","default","important");
    mark=createNocturneBrandMark(doc);mark.style.opacity="0";cover.append(mark);root.append(cover);
    epoch=doc.timeline.currentTime;
    const coverEffect=animate(cover,[{opacity:0},{opacity:1}],start,CLOSE_COVER_MS,"ease-in-out");
    const logoAt=start+CLOSE_COVER_MS;fadeAt=logoAt+CLOSE_LOGO_MS;end=fadeAt+CLOSE_FADE_MS;
    const logoEffect=animate(mark,[{opacity:0,transform:"translateY(7px) scale(.96)"},{opacity:1,transform:"translateY(0) scale(1)"}],logoAt,CLOSE_LOGO_MS,"cubic-bezier(.2,.75,.25,1)");
    rootFade=cssFade();
    const elapsed=()=>doc.timeline.currentTime-epoch;
    const queue=fn=>{frame=win.requestAnimationFrame(()=>{frame=null;if(active&&!sealed)fn();});};
    const allowed=()=>active&&!sealed&&!win.closed&&Number.isFinite(doc.timeline.currentTime);
    const tick=()=>{
      if(!allowed()||!native)return;
      const value=closeWindowAlpha((elapsed()-fadeAt)/CLOSE_FADE_MS);
      const lease=native;
      if(!lease.set(value)){if(active&&native===lease)fallback();return;}
      if(!active||sealed||native!==lease)return;
      frames++;lastAlpha=value;
      if(value!==0&&elapsed()<end){try{queue(tick);}catch{fallback();}}
      else trace("disassembly.alpha.end",{frames,alpha:value,read:lease.read()});
    };
    if(windows&&nativeFactory&&Number.isFinite(epoch)){
      const prepare=()=>{
        if(!allowed()||elapsed()>fadeAt-100||Number(win.getComputedStyle(root).opacity)!==1||
           Number(win.getComputedStyle(cover).opacity)!==1)return;
        let lease;
        try{lease=nativeFactory();}catch{}
        if(!allowed()){try{lease?.release();}catch{}return;}
        native=lease||null;
        let acquired=false;try{acquired=!!lease?.acquire();}catch{}
        if(!active||sealed||native!==lease){try{lease?.release();}catch{}return;}
        trace("disassembly.alpha.acquire",{acquired,available:!!lease,read:lease?.read()??null});
        if(!acquired){dropNative(false);return;}
        try{rootFade.cancel();effects.splice(effects.indexOf(rootFade),1);rootFade=null;}catch{fallback();return;}
        // No animation frame loop until the logo interval ends.
        logoEffect.finished.then(()=>{if(allowed()&&native===lease){try{queue(tick);}catch{fallback();}}},()=>{});
      };
      coverEffect.finished.then(()=>{
        if(!allowed())return;
        try{queue(()=>{try{queue(prepare);}catch{}});}catch{}
      },()=>{});
    }
    return {end,logoAt,fadeAt,release,
      commit(){stopFrame();dropNative(true);},
      seal(){
        if(!active)return null;
        sealed=true;stopFrame();
        if(native){
          const lease=native;
          let ok=false;try{ok=lease.set(0)&&lease.read()===0;}catch{}
          if(!active)return null;
          trace("disassembly.alpha.seal",{confirmed:ok,frames,alpha:ok?0:lastAlpha});
          if(!ok&&native===lease)fallback();
        }
        for(const effect of effects)try{effect.finish();}catch{}
        // A cancelled root fade must not be finished again on native path.
        const read=node=>{try{const a=Number(win.getComputedStyle(node).opacity);return Number.isFinite(a)?a:null;}catch{return null;}};
        return {rootOpacity:read(root),coverOpacity:read(cover),logoOpacity:read(mark)};
      }};
  }catch{release();return null;}
}
// Nocturne preview.36: early trace, independent Sine script order.
try{if(typeof window!=="undefined"){
  const event="disassembly.script",data={version:"0.3.0-preview.218"};
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
  const reduced={get matches(){return !prefs.getBoolPref("zen.nocturne.motion.enabled",true);}};
  const get=id=>document.getElementById(id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  if(typeof window.addUnloadListener!=="function"||root.hasAttribute("popup-window"))return;
  window[KEY]?.();
  let dead=false,owner=null,original=null,wrapped=null,observer=null,style=null,sheet=null;
  const animations=new Set(),owned=new Map();let centerHandle=null,bookmarkHandle=null,finale=null;

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
        const request={receiver,args,animated:false,duration:DURATION};pending=request;starting=true;
        try{const result=begin();request.animated=!!result;if(typeof result==="number"&&Number.isFinite(result)&&result>=DURATION)request.duration=result;}catch{}
        finally{starting=false;}
        const action=queued;queued=null;
        if(action!==null)return finish(action);
        if(request.animated){
          try{timer=later(()=>sealRequest(request),request.duration-110);return;}
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
  function collect(engine,flow=false){
    const row=get("oneplane-tabs"),island=row?.querySelector(".oneplane-title-island");
    const ir=visible(island),rr=visible(row),url=get("urlbar-container"),ur=visible(url);
    const center=ir?ir.r.left+ir.r.width/2:rr?rr.r.left+rr.r.width/2:ur?ur.r.left+ur.r.width/2:window.innerWidth/2;
    const result=[];
    function add(n,x=0,y=0,clip=false,delay=0,length=350,islandY=null,edge=false){
      if(!n||result.length>=100||result.some(t=>t.n===n||t.n.contains(n)||n.contains(t.n)))return;
      const t=visible(n);if(!t)return;
      const move=t.s.translate==="none"||/^0(?:px|%)?(?: 0(?:px|%)?){0,2}$/.test(t.s.translate);
      result.push({n,x:move?x:0,y:move?y:0,clip,delay,length,islandY,edge,opacity:Number(t.s.opacity)});
    }
    const floating=get("urlbar");
    const floatVisible=floating&&(floating.getAttribute("zen-floating-urlbar")==="true"||floating.hasAttribute("zen-newtab"));
    const timing=name=>centerFlowStage(name,CENTER_FLOW_CLOSE_MS,true);
    const searchTiming=timing("search");
    if(floatVisible)add(floating,0,0,true,flow?searchTiming.delay:0,flow?searchTiming.duration:280,null,flow);
    if(typeof engine?.bookmarks!=="function")for(const n of Array.from(get("PlacesToolbarItems")?.children||[])){
      const t=visible(n);if(t)add(n,0,-14,false,Math.max(0,55-Math.abs(t.r.left+t.r.width/2-center)*.09),280);
    }
    if(rr){
      // The plus button exits with the measured edge group.
      if(ir){const t=timing("island");add(island,0,0,true,flow?t.delay:570,flow?t.duration:80,homeIslandDistance(ir.r.bottom));}
    }else{
      const sidebar=get("zen-tabs-wrapper")||get("TabsToolbar");
      const t=visible(sidebar);if(t)add(sidebar,t.r.left<window.innerWidth/2?-18:18,0,false,95,330);
    }
    if(!floatVisible)add(url,0,0,true,flow?searchTiming.delay:165,flow?searchTiming.duration:330,null,flow);
    if(flow){
      const t=timing("panel");add(get("oneplane-toolbar-surface"),0,0,false,t.delay,t.duration,null,true);
      const home=get("zen-shared-home");
      if(visible(home)&&!home.hasAttribute("data-zh-search")){
        for(const target of homeFlowTargets(home.querySelector(".zh-content"),CENTER_FLOW_CLOSE_MS,true)){
          const v=visible(target.node);if(v)result.push({n:target.node,homeKind:target.kind,opacity:Number(v.s.opacity),delay:target.delay,length:target.duration});
        }
      }
    }
    const candidates=new Set();
    let captions=null;try{captions=window.gZenVerticalTabsManager?.actualWindowButtons;}catch{}
    const plus=row?.querySelector(".oneplane-new-tab");
    for(const parent of [get("nav-bar-customization-target"),get("nav-bar"),captions,get("titlebar-buttonbox"),get("titlebar-buttonbox-container"),get("zen-window-controls"),get("zen-sidebar-top-buttons")]){
      if(!parent)continue;
      for(const n of parent.querySelectorAll(EDGE_CONTROL_SELECTOR)){
        if(row?.contains(n)||url?.contains(n)||n===url||n.id?.startsWith("oneplane-center-")||n.localName==="toolbarspring"||!visible(n))continue;
        candidates.add(n);
      }
    }
    if(visible(plus))candidates.add(plus);
    const group=[...candidates].filter(n=>![...candidates].some(c=>c!==n&&c.contains(n))).map(n=>visible(n)).filter(Boolean);
    const offsets=edgeControlOffsets(group.map(t=>t.r),center,window.innerWidth);
    const t=timing("edges");
    group.forEach(({n},i)=>add(n,offsets[i],0,false,flow?t.delay:120,flow?t.duration:390,null,true));
    window.__nocturneTrace?.("disassembly.controls.edge",{left:offsets.filter(x=>x<0).length,right:offsets.filter(x=>x>0).length});
    return result;
  }
  function restore(){
    let failed=0;const step=fn=>{try{fn();}catch{failed++;}};
    step(()=>window.__nocturneTrace?.("disassembly.restore",()=>({effects:animations.size,owned:owned.size,closing:root.hasAttribute("data-zr-closing")}),{sample:1000,flush:true}));
    const ending=finale;finale=null;
    step(()=>{failed+=ending?.release()||0;});
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
    const flow=engine?.centerFlowVersion===1&&!!visible(row);
    const targets=collect(engine,flow);if(!targets.length)return false;
    // Missing horizontal proxy support must not leave the visible strip
    // behind while other controls disappear. Native-only sidebar and the
    // existing no-bookmark-API fallback remain supported.
    if(needsTabs&&typeof engine?.start!=="function")return bypass("tab-engine-unavailable");
    typeof window!=="undefined"&&window.__nocturneTrace?.("disassembly.targets",()=>({count:targets.length,registered:typeof window.CSS?.registerProperty==='function'}),{sample:1800});
    let registered=false;
    try{window.CSS.registerProperty({name:PROGRESS,syntax:"<number>",inherits:false,initialValue:"1"});registered=true;}
    catch(e){registered=e.name==="InvalidModificationError";}
    const islandRegistered=registered&&registerHomeIslandMotion(window.CSS);
    if(registered){
      const scope=":root[data-zr-closing] [data-zr-close-effect]"+":is(#zr-close-specificity,[data-zr-close-effect])".repeat(8);
      const edge="calc(49% * (1 - var("+PROGRESS+")) - 8px * var("+PROGRESS+"))";
      const css=scope+" {transition-property:none !important;opacity:calc(var(--zr-close-opacity) * var("+PROGRESS+")) !important;}\n"+
        scope+"[data-zr-close-move] {translate:calc(var(--zr-close-x) * (1 - var("+PROGRESS+"))) calc(var(--zr-close-y) * (1 - var("+PROGRESS+"))) !important;}\n"+
        scope+"[data-zr-close-clip] {clip-path:inset(-8px "+edge+" -8px "+edge+" round 8px) !important;}\n"+
        scope+"[data-zr-close-island-exit] {transform:translateY(calc(var(--zr-close-island-y) * (1 - var(--zr-island-travel)))) scale(var(--zr-island-scale)) !important;transform-origin:center center !important;}";
      try{sheet=Services.io.newURI("data:text/css;charset=utf-8,"+encodeURIComponent(css));window.windowUtils.loadSheet(sheet,window.windowUtils.USER_SHEET);}
      catch{sheet=null;style=document.createElementNS("http://www.w3.org/1999/xhtml","style");style.textContent=css;root.append(style);}
    }
    const tabTiming=centerFlowStage("tabs",CENTER_FLOW_CLOSE_MS,true),bookmarkTiming=centerFlowStage("bookmarks",CENTER_FLOW_CLOSE_MS,true);
    centerHandle=engine?.start?.(row,{owner:"close",direction:"out",duration:flow?tabTiming.duration:620,delay:flow?tabTiming.delay:0,paused:flow,retainOnDispose:()=>controller.committing});
    if(needsTabs&&!centerHandle?.count)return bypass("tab-acquisition-failed");
    bookmarkHandle=engine?.bookmarks?.({owner:"close",direction:"out",duration:flow?bookmarkTiming.duration:650,delay:flow?bookmarkTiming.delay:0,paused:flow,flow,retainOnDispose:()=>controller.committing});
    if(needsBookmarks&&typeof engine?.bookmarks==="function"&&!bookmarkHandle)return bypass("bookmark-acquisition-failed");
    if((centerHandle||bookmarkHandle)&&window.__nocturneCenterMotion!==engine)return bypass("engine-replaced");
    let sealAt=flow?CENTER_FLOW_CLOSE_MS:DURATION-110;
    for(const {n,x,y,clip,delay:baseDelay,length:baseLength,opacity,islandY,edge,homeKind} of targets){
      const foldIsland=islandRegistered&&Number.isFinite(islandY)&&islandY<0;
      const delay=foldIsland&&!flow?DURATION-110:baseDelay,length=foldIsland&&!flow?HOME_ISLAND_DURATION:baseLength;
      try{
        if(homeKind){
          const effect=n.animate(homeFlowFrames(homeKind,opacity,true),{delay,duration:length,easing:EDGE_CONTROL_EASE,fill:"both"});
          animations.add(effect);effect.finished.catch(()=>{});effect.pause();effect.currentTime=0;
          continue;
        }
        let frames;
        if(registered){
          owned.set(n,{styles:new Map(),attrs:new Map()});
          set(n,PROGRESS,"1");set(n,"--zr-close-opacity",String(opacity));attr(n,MARK);
          if(x||y){set(n,"--zr-close-x",x+"px");set(n,"--zr-close-y",y+"px");attr(n,MOVE);}
          if(foldIsland){
            set(n,"--zr-close-island-y",islandY+"px");set(n,HOME_ISLAND_TRAVEL,"1");set(n,HOME_ISLAND_SCALE,"1");attr(n,"data-zr-close-island-exit");
            frames=homeIslandFrames(true).map(f=>({offset:f.offset,[PROGRESS]:String(f.opacity),[HOME_ISLAND_TRAVEL]:String(f.travel),[HOME_ISLAND_SCALE]:String(f.scale)}));
          }else{
            if(clip)attr(n,CLIP);
            frames=[{[PROGRESS]:"1"},{[PROGRESS]:"0"}];
          }
        }else{
          const from={opacity},to={opacity:0};
          if(x||y){from.translate="0px 0px";to.translate=x+"px "+y+"px";}
          if(clip){from.clipPath="inset(-8px round 8px)";to.clipPath="inset(-8px 49% -8px 49% round 8px)";}
          frames=[from,to];
        }
        const effect=n.animate(frames,{delay,duration:length,easing:foldIsland?"linear":edge?EDGE_CONTROL_EASE:"cubic-bezier(.4,0,.35,1)",fill:"both"});
        animations.add(effect);effect.finished.catch(()=>{});
        if(flow){effect.pause();effect.currentTime=0;}
        if(foldIsland){sealAt=Math.max(sealAt,delay+length);window.__nocturneTrace?.("disassembly.island.exit",{curve:"delayed-reveal",y:islandY,delay,duration:length},{flush:true});}
      }catch{return bypass("control-acquisition-failed");}
    }
    if(flow){
      try{
        const epoch=document.timeline.currentTime;
        if(!Number.isFinite(epoch))throw Error("close-flow-clock");
        const start=a=>{if(a.timeline!==document.timeline||a.playState==="idle")throw Error("close-flow-effect");a.startTime=epoch;};
        centerHandle?.resumeAt(start);bookmarkHandle?.resumeAt(start);
        for(const a of animations)start(a);
        window.__nocturneTrace?.("disassembly.flow.epoch",{duration:CENTER_FLOW_CLOSE_MS,effects:animations.size},{flush:true});
      }catch{return bypass("flow-epoch-failed");}
    }
    // Keep the previous close path if the experimental finale cannot be acquired.
    finale=createCloseFinale({win:window,doc:document,root,start:sealAt,onModal:modalOpened,windows:Services.appinfo?.OS==="WINNT",
      nativeFactory:()=>createWindowsWindowAlpha({win:window,services:Services,interfaces:Ci,
        loadCtypes:()=>ChromeUtils.importESModule("resource://gre/modules/ctypes.sys.mjs").ctypes})});
    if(finale){
      window.__nocturneTrace?.("disassembly.finale.begin",{coverAt:sealAt,logoAt:finale.logoAt,fadeAt:finale.fadeAt,end:finale.end},{flush:true});
      sealAt=finale.end;
    }else window.__nocturneTrace?.("disassembly.finale.skip",{acquired:false},{flush:true});
    typeof window!=="undefined"&&window.__nocturneTrace?.("disassembly.effects",()=>({count:animations.size,owned:owned.size,duration:sealAt+110}),{sample:1000,flush:true});
    return animations.size>0||!!centerHandle?.count||!!bookmarkHandle||!!finale?sealAt+110:false;
  }
  function modalOpened(){
    // Native prompts must never inherit the chrome-root fade. If a prompt
    // appears during preparation, cancel the visual close; during native
    // delegation release the visual owners without reentering the command.
    if(!finale)return;
    window.__nocturneTrace?.("disassembly.finale.modal",{committing:controller.committing},{flush:true});
    if(controller.committing)restore();else controller.dispose();
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
      try{centerHandle?.seal();}catch{}try{bookmarkHandle?.seal();}catch{}for(const a of animations)try{a.finish();}catch{}
      const probe=finale?.seal();if(probe)window.__nocturneTrace?.("disassembly.finale.seal",probe,{flush:true});
      window.__nocturneTrace?.("disassembly.sealed",()=>({effects:animations.size,closing:root.hasAttribute("data-zr-closing")}),{flush:true});
    },
    later:(fn,ms)=>window.setTimeout(fn,ms),cancelLater:id=>window.clearTimeout(id),
    invoke:(receiver,args)=>{
      typeof window!=="undefined"&&window.__nocturneTrace?.("disassembly.native.before",()=>({closing:root.hasAttribute('data-zr-closing'),owned:owned.size}),{flush:true,sample:1200});
      // A synchronous modal may run a nested event loop. A bounded
      // recovery watchdog restores the entire chrome if the command stays
      // pending even when no modal event reaches this window.
      const ending=finale;let recovery=null;
      if(ending){
        try{recovery=window.setTimeout(()=>{
          if(finale===ending&&controller.committing&&!window.closed){
            window.__nocturneTrace?.("disassembly.finale.recover",{pending:true},{flush:true});restore();
          }
        },180);}catch{restore();}
      }
      try{
        const result=Reflect.apply(original,receiver,args);
        typeof window!=="undefined"&&window.__nocturneTrace?.("disassembly.native.after",()=>({resultType:typeof result,closed:window.closed}),{flush:true});
        return result;
      }finally{if(recovery!==null)try{window.clearTimeout(recovery);}catch{}if(window.closed)ending?.commit();}
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
    if(window.closed)step(()=>finale?.commit());
    if(!controller.committing&&!window.closed){
      step(()=>controller.dispose());
      if(!controller.busy)step(()=>{if(animations.size||owned.size||root.hasAttribute("data-zr-closing"))restore();});
    }
    step(()=>{if(owner&&wrapped&&owner.tryToCloseWindow===wrapped)owner.tryToCloseWindow=original;});
    step(()=>{if(observer)Services.obs.removeObserver(observer,"browser-delayed-startup-finished");});observer=null;
    step(()=>prefs.removeObserver(PREF,preferenceChanged));
    step(()=>prefs.removeObserver("zen.nocturne.motion.enabled",preferenceChanged));
    step(()=>window.removeEventListener("unload",dispose));
    if(window[KEY]===dispose)delete window[KEY];
    try{window.__nocturneTrace?.("disassembly.dispose",{failed,delegated:controller.committing},{flush:true});}catch{}
  }
  window[KEY]=dispose;window.addUnloadListener(dispose);window.addEventListener("unload",dispose,{once:true});
  prefs.addObserver(PREF,preferenceChanged);prefs.addObserver("zen.nocturne.motion.enabled",preferenceChanged);
  install();
  if(!wrapped&&!window.gBrowserInit?.delayedStartupFinished){
    observer=subject=>{if(subject!==window)return;Services.obs.removeObserver(observer,"browser-delayed-startup-finished");observer=null;install();};
    Services.obs.addObserver(observer,"browser-delayed-startup-finished");
  }
})();
