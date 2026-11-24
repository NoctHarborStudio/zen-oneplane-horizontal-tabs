// Nocturne preview.45: early trace, independent Sine script order.
try{if(typeof window!=="undefined"){
  const event="downloads.script",data={version:"0.3.0-preview.164"};
  if(window.__nocturneTrace)window.__nocturneTrace(event,data,{sample:1500});
  else{const q=window.__nocturneEarlyTrace??(window.__nocturneEarlyTrace=[]);if(q.length<32)q.push({event,t:window.performance?.now?.()??0,data});}
}}catch{}
/* Zen Refined — Download Indicator. Native download events, no polling,
 * no interception of downloads or file content reads. Native file drag on explicit user gesture. One view per window.
 * Horizontal layout hosts the same view; native sidebar remains the fallback. */
(() => {
  const root=document.documentElement,prefs=Services.prefs;
  const PREF="zen.refined.downloads.indicator",STATS_PREF="zen.refined.downloads.statistics",KEY="__zenRefinedDownloadIndicator";
  const NS="http://www.w3.org/1999/xhtml",ACTIVE="data-zr-downloads-active";
  const make=(tag,cls)=>{const n=document.createElementNS(NS,tag);if(cls)n.className=cls;return n;};
  const get=id=>document.getElementById(id);
  const RATE=200,HOLD=2000,SIDE="zen.tabs.vertical.right-side";
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)");
  const enabled=()=>prefs.getBoolPref(PREF,true);
  if(root.hasAttribute("popup-window")||typeof window.addUnloadListener!=="function")return;
  window[KEY]?.dispose?.();
  let dead=false,epoch=0,unsubscribeDownloads=null,list=null,node=null,fill=null,speed=null,icon=null,host=null;
  let flight=null,flightAnimation=null,panelAnimation=null,panelToken=0,entering=false,manualHold=false,sidebarOrigin=false,overlayLayer=null;
  let layoutFrame=0,resizeObserver=null,observedSidebar=null,anchor=null,lastClick=null,cardOpen=false,flightToken=0,flightTimer=0,latest=null;
  let updateTimer=0,hideTimer=0,readyObserver=null,layoutObserver=null,initialized=false,hydrating=false;
  let lastDockRect=null,followFrame=0,followUntil=0,overlayUntil=0,heldWrapper=null;
  let dock=null,dockList=null,dockEmpty=null,dockMore=null,dockBackdrop=null,dockNotice=null,dockOpen=false,limit=30;
  const history=new Map(),rows=new Map();
  let externalDrag=null,fileDragSource=null,dragClickSource=null,fileBunny=null,fileIconWarm=null,filePopup=null,fileStage=null;
  let fileDragWatchTimer=0,fileDragMissing=0,fileDragUnknown=0;
  const FILE_CARD_W=186,FILE_CARD_H=51,FILE_LIFT=320,FILE_RETURN=480,FILE_GRIP_X=172,FILE_GRIP_Y=48;
  let historyOrder=null,recentOrder=null,dockHeight=0,allButton=null,dockTitle=null,dockSort=null;
  const OVERLAY_WIDTH=430,RECENT_LIMIT=4;
  let sortKey="time",sortDir=-1,headerNormal=null,headerConfirm=null,clearButton=null,sortTime=null,sortSize=null,yesButton=null,noButton=null,confirming=false,clearing=false;
  const CLEARABLE=d=>d.stopped&&!d.hasPartialData&&!d.hasBlockedData;
  let lastRender=0,snapshot=Object.freeze({active:0,progress:null,speed:0,state:"idle"}),batch=new Map(),fresh=new WeakSet();
  const number=x=>Number.isFinite(x)?Math.max(0,x):0;
  const current=()=>window.performance.now();
  function sample(d){
    return {active:!d.stopped&&!d.succeeded&&!d.error&&!d.canceled,success:!!d.succeeded,
      failed:!!d.error,canceled:!!d.canceled,known:!!d.hasProgress&&number(d.totalBytes)>0,
      total:number(d.totalBytes),bytes:number(d.currentBytes),speed:number(d.speed),time:number(Number(d.startTime)),
      name:String(d.target?.path||"").split(/[\\\\/]/).pop()||"Download"};
  }
  function summarize(entries){
    let active=0,known=true,total=0,bytes=0,rate=0,success=0,failed=0,canceled=0;
    for(const d of entries){
      if(d.active){active++;rate+=d.speed;}
      else if(d.success)success++;
      else if(d.failed)failed++;
      else canceled++;
      if(d.active||d.success){
        if(!d.known)known=false;
        else{total+=d.total;bytes+=d.success?d.total:Math.min(d.bytes,d.total);}
      }
    }
    return Object.freeze({active,progress:active?(known&&total>0?Math.min(.995,bytes/total):null):success&&!failed&&!canceled?1:null,
      speed:rate,state:active?"active":failed?"failed":canceled?"stopped":success?"complete":"idle",success,failed,canceled});
  }
  function sizeText(v,rate=false){
    const units=["B","KB","MB","GB","TB"];let i=0;
    while(v>=1000&&i<units.length-1){v/=1000;i++;}
    return (i&&v<100?v.toFixed(1):Math.round(v))+" "+units[i]+(rate?"/s":"");
  }
  function speedText(v){return sizeText(v,true);}
  function durationText(ms){
    if(ms<1000)return "<1 s";
    const sec=Math.round(ms/1000),h=Math.floor(sec/3600),m=Math.floor(sec%3600/60),s=sec%60;
    return (h?h+" h ":"")+(m?m+" min ":"")+s+" s";
  }
  function refreshStatistics(){if(cardOpen)renderRecent();if(dockOpen)renderDock();if(cardOpen||dockOpen)positionOverlays();}
  function sortBytes(v){return v.known?v.total:v.success?v.bytes:null;}
  function syncTheme(...targets){
    // Sample only on structural changes / opening, never on byte updates.
    // Zen stores actual compact palette on the toolbox; root overlays do
    // not inherit these local values. Copy the resolved theme tokens.
    const source=observedSidebar||get("navigator-toolbox")||root;
    const st=window.getComputedStyle(source);
    const surface=source.querySelector?.(".zen-toolbar-background");
    const native=surface?window.getComputedStyle(surface):null;
    const token=st.getPropertyValue("--zen-compact-mode-toolbar-background").trim();
    // Use the real rendered sidebar's paint if available, including a
    // workspace gradient. A transparent background must not obscure text.
    const color=native?.backgroundColor;
    const image=native?.backgroundImage;
    const solid=color&&color!=="transparent"&&!/^rgba\([^)]*,\s*0(?:\.0+)?\)$/.test(color);
    const paint=image&&image!=="none"?image+(solid?" "+color:""):solid?color:token;
    for(const n of targets){if(!n)continue;
      for(const [key,native] of [["--zr-native-surface","--zen-compact-mode-toolbar-background"],["--zr-native-outline","--zen-compact-mode-toolbar-outline-color"],["--zr-native-row","--zen-toolbar-element-bg"]]){
        const value=key==="--zr-native-surface"?paint:st.getPropertyValue(native).trim();
        if(value)n.style.setProperty(key,value);else n.style.removeProperty(key);
      }
      if(st.color)n.style.setProperty("--zr-native-fg",st.color);
    }
  }
    function visible(n){
    if(!n?.isConnected||n.hidden||n.collapsed)return false;
    const r=n.getBoundingClientRect(),st=window.getComputedStyle(n);
    return r.width>2&&r.height>2&&r.right>2&&r.left<window.innerWidth-2&&r.bottom>2&&r.top<window.innerHeight-2&&
      st.display!=="none"&&st.visibility!=="hidden"&&Number(st.opacity)!==0;
  }
  function onePlane(){
    // Match the horizontal stylesheet's real activation contract. A
    // narrow adaptive strip is still OnePlane; a not-ready strip is not.
    return root.getAttribute("oneplane-active")==="true"&&
      !root.hasAttribute("customizing")&&!root.hasAttribute("popup-window")&&
      root.getAttribute("inDOMFullscreen")!=="true"&&root.getAttribute("inFullscreen")!=="true"&&
      !!root.querySelector('#nav-bar-customization-target > #oneplane-tabs[data-ready="true"]');
  }
  function nativeAnchor(){
    const toolbox=get("navigator-toolbox");
    if(!toolbox)return null;
    // Never prefer Library or the menu in the footer: this control belongs
    // to the top of the native sidebar. Structural placement must not
    // depend on visibility (Compact Mode moves the entire sidebar).
    const top=get("zen-sidebar-top-buttons");
    const tabs=get("tabbrowser-tabs"),wrapper=get("zen-tabs-wrapper");
    for(const n of [top,tabs,wrapper]){
      if(n?.parentElement&&toolbox.contains(n)&&!n.closest?.("#zen-sidebar-foot-buttons,#zen-sidebar-bottom-buttons"))return {parent:n.parentElement,before:n};
    }
    // A different native layout still gets a top-of-toolbox slot.
    return {parent:toolbox,before:[...toolbox.children].find(n=>n!==node)||null};
  }
  function side(){
    if(onePlane())return "left";
    // Zen exposes the actual resolved side as a root attribute, while
    // the preference is a fallback during initialization.
    const value=root.getAttribute("zen-right-side");
    return value!==null&&value!=="false"?"right":value==="false"?"left":prefs.getBoolPref(SIDE,false)?"right":"left";
  }
  function dockRect(following=false){
    let resolved=side(),right=resolved==="right";const w=window.innerWidth;
    const native=node?.hasAttribute("data-zr-native")&&observedSidebar?.isConnected;
    // The toolbox's DOMRect includes Zen's actual animated CSS translate.
    // Even when titlebar visibility is hidden its geometry is available.
    // Clamp the inner edge to the viewport instead of reusing a stale
    // expanded x coordinate. Keep native y independent of the slide.
    if(native){
      const t=observedSidebar.getBoundingClientRect();
      // The physical toolbox side wins over a stale/empty root attribute.
      if(t.width>2&&t.width<w*.75){resolved=t.left+t.width/2>w/2?"right":"left";right=resolved==="right";}
      const edge=Math.max(0,Math.min(w,right?t.left:t.right));
      if(following&&lastDockRect?.side===resolved)return {...lastDockRect,edge,x:clamp(lastDockRect.x+edge-lastDockRect.edge,8,w-8)};
      const n=node.getBoundingClientRect(),i=icon.getBoundingClientRect();
      const y=n.height>0?n.top:(lastDockRect?.top??70),height=n.height||33;
      const iconY=i.height>0?i.top+i.height/2:y+height/2;
      const iconX=i.width>0?i.left+i.width/2:edge;
      const x=Math.max(8,Math.min(w-8,iconX));
      lastDockRect={edge,top:y,height,x,y:iconY,side:resolved,seedW:i.width||19,seedH:i.height||19};
      return lastDockRect;
    }
    if(node?.hasAttribute("data-zr-hosted")){
      const n=node.getBoundingClientRect(),i=icon.getBoundingClientRect();
      // Keep the panel below its real toolbar anchor and follow its reveal.
      if(n.width>2&&n.height>2){
        const x=clamp(i.width?i.left+i.width/2:n.left+n.width/2,8,w-8);
        const top=clamp(n.bottom+4,8,Math.max(8,window.innerHeight-160));
        const y=clamp(i.height?i.top+i.height/2:n.top+n.height/2,8,Math.max(8,window.innerHeight-8));
        lastDockRect={edge:clamp(n.left,0,w),top,height:n.height,x,y,side:"left",hosted:true,seedW:i.width||16,seedH:i.height||16};
        return lastDockRect;
      }
    }
    if(node&&visible(node)){
      const n=node.getBoundingClientRect(),i=icon.getBoundingClientRect();
      lastDockRect={edge:right?n.left:n.right,top:n.top,height:n.height,x:i.left+i.width/2,y:i.top+i.height/2,side:side(),seedW:i.width||19,seedH:i.height||19};
      return lastDockRect;
    }
    if(lastDockRect?.side===side())return lastDockRect;
    const edge=right?w:0,top=70;
    return {edge,top,height:33,x:right?w-8:8,y:top+16.5,side:side()};
  }
  const clamp=(v,lo,hi)=>Math.max(lo,Math.min(Math.max(lo,hi),v));
  function setVar(n,k,v){if(n.style.getPropertyValue(k)!==v)n.style.setProperty(k,v);}
  function wavePath(width,side,l,r,topL,topR,bottomL,bottomR,rL,rR){
    // The approved demo's asymmetric cubic contour. All frames have
    // identical commands, so Gecko interpolates paths without JS ticks.
    const w=r-l,tl=topL,tr=topR,bl=bottomL,br=bottomR;
    const rl=Math.min(rL,w/2,Math.max(0,bl-tl)/2),rr=Math.min(rR,w/2,Math.max(0,br-tr)/2),k=.55228475;
    const point=(x,y)=>side==="top"?`${y.toFixed(3)} ${(width-x).toFixed(3)}`:`${(side==="right"?x:width-x).toFixed(3)} ${y.toFixed(3)}`;
    const M=(x,y)=>"M "+point(x,y),C=(...p)=>"C "+point(p[0],p[1])+" "+point(p[2],p[3])+" "+point(p[4],p[5]);
    // Keep control points inside the straight-edge span. On a circular
    // seed these edges have zero length: no bulge or squared first frame.
    const h=x=>clamp(x,l+rl,r-rr),vL=y=>clamp(y,tl+rl,bl-rl),vR=y=>clamp(y,tr+rr,br-rr);
    const d=[
      M(r-rr,tr),
      C(h(r-w*.34),tr,h(l+w*.35),tl,l+rl,tl),
      C(l+rl*(1-k),tl,l,tl+rl*(1-k),l,tl+rl),
      C(l,vL(tl+(bl-tl)*.34),l,vL(bl-(bl-tl)*.25),l,bl-rl),
      C(l,bl-rl*(1-k),l+rl*(1-k),bl,l+rl,bl),
      C(h(l+w*.35),bl,h(r-w*.32),br,r-rr,br),
      C(r-rr*(1-k),br,r,br-rr*(1-k),r,br-rr),
      C(r,vR(br-(br-tr)*.33),r,vR(tr+(br-tr)*.33),r,tr+rr),
      C(r,tr+rr*(1-k),r-rr*(1-k),tr,r-rr,tr),"Z"
    ].join(" ");
    return `path("${d}")`;
  }
  const WAVE_EXTENSION=32;
  function panelGeometry(r,width,height,x,y){
    if(r.hosted){
      // Rotate the canonical contour within the RESTING border box.
      // The hosted seed sits just inside the top edge below the icon.
      // Unlike a sidebar, the toolbar must never be painted over.
      const seedX=clamp(r.x-x,Math.min(1,width/2),Math.max(width/2,width-1));
      const depth=Math.min(6,height/2),edge=height-depth;
      const g=sideWaveGeometry({side:"top",edge,x:edge,y:seedX},height,width,0,0);
      return {...g,x,y,width,height,orientation:"top"};
    }
    return sideWaveGeometry(r,width,height,x,y);
  }
  function sideWaveGeometry(r,width,height,x,y){
    // The animated border box really includes the bridge to the sidebar.
    // Coordinates are measured from the far edge of the resting panel.
    // No translating a clipped rectangle through the gap.
    const top=r.side==="top",extent=width+(top?0:WAVE_EXTENSION);
    const edge=Number.isFinite(r.edge)?r.edge:r.x;
    const anchor=clamp(r.side==="left"?x+width-edge:edge-x,0,extent-(top?Math.min(6,extent/2):13));
    const cy=clamp(r.y-y,1,Math.max(1,height-1));
    const strip=Math.min(12,cy,Math.max(0,height-cy));
    const bridge=Math.min(extent,anchor+12);
    const at="translate(0px,0px)",full="inset(0px 0px 0px 0px round 12px)";
    const dot=(p,rad,opacity)=>{
      const radius=Math.min(rad,cy,Math.max(.001,height-cy),Math.max(.001,extent-anchor));
      return [p,anchor-radius,anchor+radius,cy-radius,cy-radius,cy+radius,cy+radius,radius,radius,opacity];
    };
    const reach=(fraction)=>anchor*(1-fraction);
    const points=[
      dot(0,.35,0),
      dot(.045,1.7,1),
      dot(.095,Math.min(6,strip),1),
      [.18,reach(.22),bridge,cy-strip,cy-strip,cy+strip,cy+strip,strip,strip,1],
      [.30,reach(.67),bridge,Math.max(0,cy-strip*1.3),cy-strip,cy+strip,cy+strip,strip,strip,1],
      [.42,0,bridge,0,cy-strip,Math.max(cy+strip,height*.10),cy+strip,12,strip,1],
      [.55,0,bridge,0,Math.max(0,cy-strip)*.5,Math.max(cy+strip,height*.365),Math.max(cy+strip,height*.10),12,12,1],
      [.72,0,bridge,0,0,Math.max(cy+strip,height*.80),Math.max(cy+strip,height*.288),12,12,1],
      [.87,0,bridge,0,0,height,Math.max(cy+strip,height*.78),12,12,1],
      [.94,0,bridge,0,0,height,height,12,12,1],
      [1,0,width,0,0,height,height,12,12,1]
    ];
    const frames=points.map(([offset,l,rightEdge,tl,tr,bl,br,rl,rr,opacity])=>({
      offset,clipPath:wavePath(extent,r.side,l,rightEdge,tl,tr,Math.min(height,bl),Math.min(height,br),rl,rr),
      transform:at,opacity,easing:"cubic-bezier(.42,0,.58,1)"
    }));
    return {frames,at,full,x,y,width,height,extent,anchor,bridge};
  }
  function reverseWave(frames,progress=1){
    // Reverse the exact same contour and displacement, not a different
    // rectangular retract. When interrupted, start at the current segment.
    const p=clamp(progress,0,1);
    const out=frames.filter(f=>f.offset<p).reverse().map(f=>({...f,offset:p>0?(p-f.offset)/p:1}));
    return out;
  }
  function updateOverlayMask(r){
    if(!overlayLayer)return;
    // The wave lives in its own viewport layer. Its outer mask stops
    // exactly at the visible inner edge of native Zen's toolbox.
    // No changes to the browser's own stacking order or toolbar CSS.
    const native=!!node?.hasAttribute("data-zr-native")&&!!observedSidebar?.isConnected;
    const w=window.innerWidth,edge=clamp(r.edge,0,w);
    const left=native&&r.side==="left"?edge:0;
    const right=native&&r.side==="right"?w-edge:0;
    setVar(overlayLayer,"--zr-mask-left",left+"px");
    setVar(overlayLayer,"--zr-mask-right",right+"px");
  }
  function positionOverlays(following=false){
    if(!node||!dock||(!cardOpen&&!dockOpen&&current()>=overlayUntil))return;
    const r=dockRect(following),w=window.innerWidth,h=window.innerHeight,right=r.side==="right";
    updateOverlayMask(r);
    const width=Math.min(OVERLAY_WIDTH,Math.max(1,w-12));
    setVar(dock,"--zr-wave-extension",WAVE_EXTENSION+"px");
    const hosted=node.hasAttribute("data-zr-hosted");
    const x=clamp(hosted?r.x-20:right?r.edge-width-8:r.edge+8,6,w-width-6);
    // Both modes share the same top and x. Full mode fills the remaining
    // viewport, including the real bottom margin, with an inner scroll area.
    const y=clamp(r.top,8,Math.max(8,h-160));
    setVar(dock,"--zr-overlay-width",width+"px");
    setVar(dock,"--zr-overlay-x",x+"px");setVar(dock,"--zr-overlay-y",y+"px");
    const orientation=hosted?"top":r.side;
    if(dock.getAttribute("data-side")!==orientation)dock.setAttribute("data-side",orientation);
    if(!following||!dockHeight)dockHeight=dock.offsetHeight||Math.max(1,h-y-12);
    setVar(dockBackdrop,"--zr-outside-left",(hosted||right?0:Math.max(0,r.edge))+"px");
    setVar(dockBackdrop,"--zr-outside-right",(!hosted&&right?Math.max(0,w-r.edge):0)+"px");
    return following?undefined:panelGeometry({...r,hosted},width,dockHeight,x,y);
  }
  function cancelPanel(){
    ++panelToken;entering=false;
    if(panelAnimation){try{panelAnimation.cancel();}catch{}panelAnimation=null;}
    dock?.removeAttribute("data-entering");
  }
  function animatePanel(frames,duration,onDone){
    const token=++panelToken;
    const finish=()=>{if(token!==panelToken)return;panelAnimation=null;onDone?.();};
    if(reduced.matches||!dock?.animate){finish();return;}
    try{
      panelAnimation=dock.animate(frames,{duration,fill:"none",easing:"linear"});
      panelAnimation.finished.then(finish,()=>{});
    }catch{finish();}
  }
  function revealPanel(g){
    if(!g){entering=false;dock.removeAttribute("data-entering");armHide();return;}
    entering=true;dock.setAttribute("data-entering","true");
    animatePanel(g.frames,780,()=>{entering=false;dock?.removeAttribute("data-entering");armHide();});
  }
  function stopFollow(){
    if(followFrame)window.cancelAnimationFrame(followFrame);followFrame=0;followUntil=0;
  }
  function follow(ms=380){
    if(dead||!node||node.hasAttribute("data-fallback")||(!cardOpen&&!dockOpen&&current()>=overlayUntil))return;
    followUntil=Math.max(followUntil,current()+ms);
    if(followFrame)return;
    const tick=()=>{
      followFrame=0;
      if(dead||!node||(!cardOpen&&!dockOpen&&current()>=overlayUntil))return;
      positionOverlays(true);
      if(current()<followUntil)followFrame=window.requestAnimationFrame(tick);
    };
    followFrame=window.requestAnimationFrame(tick);
  }
  function mount(){
    if(!node||dead||fileDragSource||fileBunny?.ending)return;
    const one=onePlane(),candidate=host?.isConnected?host:get("oneplane-download-indicator-slot");
    const slot=one&&candidate?.isConnected&&candidate.ownerDocument===document?candidate:null;
    const placement=!one?nativeAnchor():null;
    const toolbox=get("navigator-toolbox");
    const native=!!placement;
    const parent=slot||placement?.parent||root;
    const before=placement?.before;
    anchor=slot||before||null;
    const changed=node.parentElement!==parent||(native&&!!before&&before!==node&&node.nextElementSibling!==before);
    const oldSide=node.getAttribute("data-side");
    if(changed){
      if(native&&before&&before!==node)parent.insertBefore(node,before);
      else if(native&&!before)parent.append(node);
      else parent.append(node);
    }
    node.toggleAttribute("data-zr-hosted",!!slot);
    node.toggleAttribute("data-zr-native",native);
    node.toggleAttribute("data-zr-oneplane",!!one&&!slot);
    node.setAttribute("data-side",side());
    syncDownloadHolds();
    // Only OnePlane without a host (or an unsupported missing toolbox)
    // uses the floating fallback. A hidden native sidebar never reparents.
    node.toggleAttribute("data-fallback",!slot&&!native);
    root.toggleAttribute("data-zr-downloads-native",native);
    if(changed||(oldSide&&oldSide!==side())){lastDockRect=null;syncTheme(node,dock); }
    if(toolbox!==observedSidebar||changed){
      resizeObserver?.disconnect();observedSidebar=toolbox;if(toolbox)resizeObserver?.observe(toolbox);
      if(dock)resizeObserver?.observe(dock);
      if(slot)resizeObserver?.observe(slot);
    }
    // Cache the last visible location on structural/visibility changes.
    if(cardOpen||dockOpen||current()<overlayUntil){positionOverlays();follow();}
    else updateOverlayMask(dockRect());
    if(flight&&(changed||(oldSide&&oldSide!==side()))){cancelFlight();openCard();}
  }
  function scheduleMount(){
    if(dead||!node||layoutFrame)return;
    layoutFrame=window.requestAnimationFrame(()=>{layoutFrame=0;mount();});
  }
  function setHost(next){
    if(next!==null&&(!next?.isConnected||next.ownerDocument!==document||node?.contains(next)))return false;
    host=next;mount();return true;
  }
  function trackClick(event){
    if(event.isTrusted===false||event.button!==0)return;
    dragClickSource=null;
    lastClick={x:event.clientX,y:event.clientY,at:current()};
  }
  function trackLayout(event){
    const n=event.target;
    if(n===observedSidebar||n===anchor||n===get("zen-appcontent-navbar-wrapper")||n===get("zen-main-app-wrapper")){
      if(event.type==="transitionrun"||event.type==="transitionstart")follow(420);else scheduleMount();
    }
  }
  function makeTrack(){
    const track=make("span","zr-download-track"),f=make("span","zr-download-fill");track.append(f);return [track,f];
  }
  function build(){
    typeof window!=="undefined"&&window.__nocturneTrace?.("downloads.build",()=>(null),{sample:1800});
    node=make("button","zr-download-indicator");node.id="zr-download-indicator";node.type="button";
    node.setAttribute("aria-label","Show download details");node.setAttribute("title","Downloads");node.setAttribute("aria-expanded","false");node.setAttribute("data-state","idle");
    speed=make("span","zr-download-speed");
    icon=make("span","zr-download-icon");icon.setAttribute("aria-hidden","true");
    const [track,f]=makeTrack();fill=f;node.append(speed,icon,track);
    bindFileDrag(node,()=>latestCompleted(history));
    node.addEventListener("click",e=>{
      if(ignoreFileDragClick(e))return;
      cancelFlight();
      if(dockOpen||cardOpen&&manualHold)closeDock();
      else if(cardOpen)pinPanel(true);
      else openCard(true);
    });
    buildDock();
    try{prepareFilePopup();}catch{}
    resizeObserver=typeof ResizeObserver==="function"?new ResizeObserver(scheduleMount):null;
    mount();
    layoutObserver=new MutationObserver(records=>{
      if(records.some(r=>{
        if(r.target===node||r.target===dock||r.target===dockBackdrop||r.target===overlayLayer||node.contains(r.target)||dock?.contains(r.target))return false;
        const selector="#navigator-toolbox,#zen-sidebar-top-buttons,#zen-tabs-wrapper,#tabbrowser-tabs,#oneplane-tabs,#oneplane-download-indicator-slot";
        const relevant=n=>n?.nodeType===1&&(n.matches?.(selector)||n.querySelector?.(selector));
        if(r.type==="attributes")return r.target===root||r.target===observedSidebar||r.target===anchor||r.target.matches?.(selector);
        return [...r.addedNodes,...r.removedNodes].some(n=>n!==node&&n!==dock&&relevant(n));
      }))scheduleMount();
    });
    layoutObserver.observe(root,{attributes:true,attributeFilter:["oneplane-active","customizing","popup-window","inDOMFullscreen","inFullscreen","zen-right-side","zen-compact-mode","zen-compact-animating","zen-sidebar-expanded","zen-has-hover","hidden","collapsed"],childList:true});
    const toolbar=get("nav-bar-customization-target");
    if(toolbar)layoutObserver.observe(toolbar,{subtree:true,childList:true,attributes:true,attributeFilter:["data-ready"]});
    const toolbox=get("navigator-toolbox");
    if(toolbox)layoutObserver.observe(toolbox,{subtree:true,childList:true,attributes:true,attributeFilter:["hidden","collapsed","zen-has-hover","zen-user-show","zen-has-empty-tab","flash-popup","has-popup-menu","movingtab","zen-compact-mode-active","zen-sidebar-expanded","animate"]});
    window.addEventListener("resize",scheduleMount);window.addEventListener("OnePlane:DownloadHostChanged",scheduleMount);
    window.addEventListener("ZenCompactMode:LayoutUpdate",scheduleMount);window.addEventListener("ZenCompactMode:Toggled",scheduleMount);
    for(const type of ["transitionrun","transitionstart","transitionend","transitioncancel"])window.addEventListener(type,trackLayout,true);
    window.addEventListener("pointerdown",trackClick,true);window.addEventListener("pointerdown",outsideDock,true);
    window.addEventListener("keydown",onKey,true);
    prefs.addObserver(SIDE,scheduleMount);prefs.addObserver(STATS_PREF,refreshStatistics);
  }
  function action(label,cls,handler){
    const b=make("button",cls);b.type="button";b.textContent=label;b.addEventListener("click",handler);return b;
  }
  function buildDock(){
    dockBackdrop=make("div","zr-download-outside");dockBackdrop.id="zr-download-outside";
    dockBackdrop.addEventListener("pointerdown",e=>{e.preventDefault();closeDock();});
    dock=make("section","zr-download-dock");dock.id="zr-download-dock";
    dock.setAttribute("role","region");dock.setAttribute("aria-label","Recent downloads");dock.setAttribute("aria-hidden","true");dock.inert=true;
    const header=make("div","zr-dock-header");dockTitle=make("span","zr-dock-title");
    dockTitle.textContent="Recent downloads";
    headerNormal=make("div","zr-dock-header-normal");headerConfirm=make("div","zr-dock-header-confirm");headerConfirm.hidden=true;
    const actions=make("div","zr-dock-header-actions");
    allButton=action("All downloads","zr-dock-all",()=>{if(window.__nocturneLibrary?.open("downloads"))return;openDock(true);});
    clearButton=action("Clear","zr-dock-clear",()=>setConfirm(true));clearButton.disabled=true;clearButton.hidden=true;
    const close=action("×","zr-dock-close",()=>closeDock(true));close.setAttribute("aria-label","Close downloads");close.setAttribute("title","Close downloads");
    actions.append(allButton,clearButton,close);headerNormal.append(dockTitle,actions);
    yesButton=action("Yes","zr-dock-yes",()=>void clearHistory());
    noButton=action("No","zr-dock-no",()=>setConfirm(false,true));
    const question=make("span","zr-dock-question");question.textContent="Clear downloads?";
    question.setAttribute("title","Remove finished entries only. Files on disk are kept.");
    headerConfirm.append(yesButton,question,noButton);header.append(headerNormal,headerConfirm);
    dockSort=make("div","zr-dock-sort");dockSort.hidden=true;
    sortTime=action("Time ↓","zr-dock-sort-time",()=>changeSort("time"));
    sortSize=action("Size","zr-dock-sort-size",()=>changeSort("size"));dockSort.append(sortTime,sortSize);
    dockList=make("div","zr-dock-list");dockList.setAttribute("role","list");
    dockEmpty=make("div","zr-dock-empty");dockEmpty.textContent="No downloads yet";
    dockNotice=make("div","zr-dock-notice");dockNotice.setAttribute("role","status");
    dockMore=action("Show more","zr-dock-more",()=>{limit+=30;renderDock();positionOverlays();});
    dockMore.hidden=true;
    dock.append(header,dockSort,dockList,dockEmpty,dockMore,dockNotice);
    dock.addEventListener("click",e=>{if(!ignoreFileDragClick(e)&&cardOpen&&!e.target.closest?.("button")&&e.target.closest?.(".zr-dock-row,.zr-dock-title"))openDock(true);});
    dock.addEventListener("pointerdown",e=>{if(cardOpen&&e.button===0&&!e.target.closest?.(".zr-dock-close"))pinPanel();});
    dock.addEventListener("pointerenter",cancelHide);
    dock.addEventListener("pointerleave",()=>armHide(true));
    overlayLayer=make("div","zr-download-layer");overlayLayer.id="zr-download-layer";
    overlayLayer.append(dock);root.append(dockBackdrop,overlayLayer);updateSort();
  }
  function updateSort(){
    for(const [button,key,title] of [[sortTime,"time","Time"],[sortSize,"size","Size"]]){
      if(!button)continue;
      const active=sortKey===key;
      button.textContent=title+(active?(sortDir<0?" ↓":" ↑"):"");
      button.setAttribute("aria-pressed",String(active));
      button.setAttribute("title",active?(sortDir<0?"Descending — click for ascending":"Ascending — click for descending"):"Sort by "+title.toLowerCase());
    }
  }
  function changeSort(key){
    if(sortKey===key)sortDir=-sortDir;else{sortKey=key;sortDir=-1;}
    historyOrder=null;updateSort();renderDock();
  }
  function setConfirm(value,restore=false){
    if(!headerNormal||!headerConfirm)return;
    if(value&&(clearing||!dockOpen||![...history.keys()].some(CLEARABLE)))return;
    confirming=value;
    headerNormal.hidden=value;headerConfirm.hidden=!value;
    if(value){yesButton.disabled=false;noButton.disabled=false;noButton.focus?.({preventScroll:true});}
    else if(restore&&dockOpen)clearButton.focus?.({preventScroll:true});
  }
  async function clearHistory(){
    if(!confirming||clearing||!list)return;
    const source=list,token=epoch;
    clearing=true;yesButton.disabled=true;noButton.disabled=true;
    let message="";
    try{
      // The shared native service owns one current bulk removal for both
      // Dock and Library. Preserve this Dock generation's cancellation gate.
      const result=await source.clearCompleted(()=>!dead&&token===epoch&&list===source);
      if(result===null)message="Downloads are already being cleared.";
      else{
        if(result.failed||result.skipped)message="Some entries could not be cleared.";
        window.__nocturneTrace?.("downloads.clear.result",{owner:"dock",requested:result.requested,removed:result.removed,skipped:result.skipped,failed:result.failed},{flush:true});
      }
    }catch{message="Some entries could not be cleared.";}
    finally{
      if(!dead&&token===epoch&&list===source){
        clearing=false;setConfirm(false,true);
        if(dockNotice)dockNotice.textContent=message;
        schedule(true);
      }
    }
  }
  function outsideDock(e){
    if(!dockOpen&&!(cardOpen&&manualHold))return;
    const path=e.composedPath?.()||[];
    if(path.includes(dock)||path.includes(node)||dock.contains(e.target)||node.contains(e.target))return;
    closeDock();
  }
  function closeDock(restoreFocus=false){
    if(fileDragSource||!dock||(!dockOpen&&!cardOpen))return;
    cancelHide();
    const previous=window.getComputedStyle(dock);
    const progress=entering&&panelAnimation?clamp(Number(panelAnimation.currentTime)/780,0,1):1;
    const startClip=previous.clipPath,startTransform=previous.transform==="none"?"translate(0px,0px)":previous.transform;
    const startOpacity=Number(previous.opacity);
    const g=positionOverlays();
    cancelPanel();
    // Keep native Compact Mode held through the ENTIRE closing wave.
    dock.setAttribute("data-closing","true");
    cardOpen=dockOpen=false;setConfirm(false);
    overlayUntil=current()+800;dock.removeAttribute("data-open");dockBackdrop?.removeAttribute("data-open");
    dock.inert=true;dock.setAttribute("aria-hidden","true");
    node?.setAttribute("aria-expanded","false");updateLive();
    if(restoreFocus&&visible(node))node.focus?.({preventScroll:true});
    const done=()=>{dock?.removeAttribute("data-closing");manualHold=false;sidebarOrigin=false;syncDownloadHolds();};
    if(!g||progress<=0){done();return;}
    const reverse=reverseWave(g.frames,progress);
    const start=progress<1&&startClip.startsWith("path(")?
      {clipPath:startClip,transform:startTransform,opacity:Number.isFinite(startOpacity)?startOpacity:1}:
      {...g.frames.at(-1)};
    animatePanel([{...start,offset:0,easing:"cubic-bezier(.42,0,.58,1)"},...reverse],Math.max(1,780*progress),done);
    follow(800);
  }
  function setPanelMode(full){
    cardOpen=!full;dockOpen=full;
    dock.toggleAttribute("data-full",full);
    dockTitle.textContent=full?"Downloads":"Recent downloads";
    dock.setAttribute("aria-label",dockTitle.textContent);
    dock.setAttribute("role",full?"dialog":"region");
    allButton.hidden=full;clearButton.hidden=!full;dockSort.hidden=!full;
    dockMore.hidden=true;setConfirm(false);
    if(full)renderDock();else renderRecent();
  }
  function openDock(){
    if(!dock||dead||dockOpen)return;
    if(window.__nocturneOverlay&&!window.__nocturneOverlay.request("downloads"))return;
    cancelHide();cancelFlight();
    // Full mode pins the downloads surface but must not acquire a native
    // sidebar hold. Preserve its original opening source.
    manualHold=true;
    const wasRecent=cardOpen;
    const before=wasRecent?{height:dock.offsetHeight,listY:dockList.getBoundingClientRect().top}:null;
    const keyboardFocus=document.activeElement===allButton;
    cancelPanel();dock.removeAttribute("data-closing");
    limit=30;sortKey="time";sortDir=-1;historyOrder=null;updateSort();
    setPanelMode(true);syncTheme(dock);updateLive();
    const g=positionOverlays();
    dock.setAttribute("data-open","true");dock.inert=false;dock.setAttribute("aria-hidden","false");
    dockBackdrop.setAttribute("data-open","true");node.setAttribute("aria-expanded","true");
    if(before&&g&&!reduced.matches){
      // One element, one row cache. Reveal the extra height without
      // restarting the entrance or changing the shared top/width.
      const bottom=Math.max(0,g.height-before.height);
      animatePanel([
        {clipPath:`inset(0px 0px ${bottom}px 0px round 12px)`,transform:g.at,opacity:1,offset:0,easing:"cubic-bezier(.3,.7,.2,1)"},
        {clipPath:g.full,transform:g.at,opacity:1,offset:1}
      ],420);
      const shift=before.listY-dockList.getBoundingClientRect().top;
      if(shift)try{dockList.animate([{transform:`translateY(${shift}px)`},{transform:"translateY(0px)"}],{duration:340,easing:"cubic-bezier(.3,.7,.2,1)"});}catch{}
      try{dockSort.animate([{opacity:0},{opacity:1}],{duration:340,easing:"ease-out"});}catch{}
    }else if(!wasRecent)revealPanel(g);
    if(keyboardFocus)clearButton.focus?.({preventScroll:true});
    follow(450);
  }
  function showActionError(message){
    const notice=dockOpen||cardOpen?dockNotice:null;
    if(notice)notice.textContent=message;
  }
  // The native DownloadsView uses the same file and URI flavors.
  // Only a completed download from this window's public/private list
  // is eligible. No source URL, partial path, or file contents are read.
  function canDragFile(d){
    return !!(d?.succeeded&&!d.error&&!d.canceled&&!d.hasPartialData&&!d.hasBlockedData&&
      d.target?.exists!==false&&typeof d.target?.path==="string"&&d.target.path.length);
  }
  function latestCompleted(entries){
    let result=null,when=-Infinity;
    for(const [d,v] of entries){
      if(!canDragFile(d))continue;
      const time=v.completedAt??v.time??0;
      if(time>=when){when=time;result=d;}
    }
    return result;
  }
  // Native Firefox downloads refresh moz-icon on successful completion.
  function fileIconURL(d,size=32){
    const path=d?.target?.path;
    return "moz-icon://"+(path||".unknown")+"?size="+size+(path&&d.succeeded?"&state=normal":"");
  }
  function createFileIcon(){
    const box=make("span","zr-file-icon"),fallback=make("span","zr-download-icon"),img=make("img","zr-file-icon-image");
    box.setAttribute("aria-hidden","true");img.alt="";img.draggable=false;
    img.addEventListener("load",()=>box.setAttribute("data-icon-ready",""));
    img.addEventListener("error",()=>box.removeAttribute("data-icon-ready"));
    box.append(fallback,img);return {box,img};
  }
  function syncFileIcon(icon,d,size=32){
    const uri=fileIconURL(d,size);
    if(icon.img.getAttribute("src")===uri)return;
    icon.box.removeAttribute("data-icon-ready");icon.img.src=uri;
    if(icon.img.complete&&icon.img.naturalWidth)icon.box.setAttribute("data-icon-ready","");
  }
  const fileMix=(a,b,t)=>a+(b-a)*t;
  const fileEase=p=>{p=clamp(p,0,1);return p*p*(3-2*p);};
  function fileSpring(s,target,k,c,dt){s.v+=(k*(target-s.x)-c*s.v)*dt;s.x+=s.v*dt;}
  // Reverse the prototype's rotation sign; keep top-center grip fixed.
  function fileSwingTarget(vx){return clamp(-vx*.023,-23,23);}
  function fileBunnyStep(q,now){
    const elapsed=Math.max(0,now-q.started),dt=clamp((now-q.last)/1000,.001,.04);q.last=now;
    const morph=fileEase(elapsed/300),grip=fileEase(elapsed/FILE_LIFT);
    q.vx*=Math.exp(-dt*9);
    const targets={x:fileMix(q.origin.x,q.point.x,grip),y:fileMix(q.origin.y,q.point.y,grip),
      w:FILE_CARD_W,h:FILE_CARD_H,angle:fileSwingTarget(q.vx),scale:1+.10*Math.sin(Math.PI*clamp(elapsed/330,0,1))};
    const steps=Math.max(1,Math.ceil(dt/.008)),h=dt/steps;
    for(let i=0;i<steps;i++)for(const key of Object.keys(targets)){
      const [k,c]=key==="angle"?[105,11.5]:key==="scale"?[170,14]:key==="x"||key==="y"?[560,39]:[235,23];
      fileSpring(q.s[key],targets[key],k,c,h);
    }
    const pose=Object.fromEntries(Object.entries(q.s).map(([k,v])=>[k,v.x]));
    const lock=fileEase((elapsed-240)/160);
    pose.x=fileMix(pose.x,q.point.x,lock);pose.y=fileMix(pose.y,q.point.y,lock);
    pose.angle=clamp(pose.angle,-28,28);pose.morph=morph;
    return pose;
  }
  function fileOrigin(source){
    const r=source.getBoundingClientRect();
    return {x:r.left+r.width/2,y:r.top,w:Math.max(1,r.width),h:Math.max(1,r.height)};
  }
  function fileDragSession(){
    try{
      const service=Cc["@mozilla.org/widget/dragservice;1"].getService(Ci.nsIDragService);
      return typeof service.getCurrentSession==="function"?service.getCurrentSession(window):undefined;
    }catch{return undefined;}
  }
  function fileBunnyTrace(event,data,opts={}){window.__nocturneTrace?.("downloads.drag."+event,data,opts);}
  function stopFileDragWatch(){
    if(fileDragWatchTimer)window.clearTimeout(fileDragWatchTimer);
    fileDragWatchTimer=0;fileDragMissing=0;fileDragUnknown=0;
  }
  // Native drag source lifecycle is independent of optional Bunny artwork.
  // The same timer also observes popup readiness; it never commits an OS drop.
  function watchFileDrag(source){
    stopFileDragWatch();
    const check=()=>{
      fileDragWatchTimer=0;
      if(dead||fileDragSource!==source)return;
      const session=fileDragSession();
      if(session){
        fileDragMissing=0;fileDragUnknown=0;
      }else if(session===null){
        fileDragUnknown=0;
        if(++fileDragMissing>=3){endFileDrag(source,undefined,"native-session-ended");return;}
      }else{
        fileDragMissing=0;
        if(++fileDragUnknown>=6){endFileDrag(source,undefined,"native-session-unavailable");return;}
      }
      const q=fileBunny;
      if(q?.source===source&&!q.ending&&q.mode==="popup"&&!q.shown){
        if(q.popup?.state==="open"){
          q.shown=true;q.started=q.last=current();
          fileBunnyTrace("popup-shown",{state:"open",via:"watch",surface:filePopupSurface(q.popup)});
          tickFilePopup(q);
        }else if(current()-q.started>700&&!q.reported){
          q.reported=true;fileBunnyTrace("popup-not-shown",{state:q.popup?.state??"missing",session:!!session},{flush:true});
        }
      }
      if(!dead&&fileDragSource===source)fileDragWatchTimer=window.setTimeout(check,200);
    };
    fileDragWatchTimer=window.setTimeout(check,200);
  }
  function createFileCard(d){
    const card=make("div","zr-file-bunny-card"),grip=make("span","zr-file-bunny-grip"),icon=createFileIcon(),body=make("span","zr-file-bunny-info"),name=make("span","zr-file-bunny-name"),meta=make("span","zr-file-bunny-meta");
    const v=history.get(d)||sample(d);name.textContent=v.name;meta.textContent=sizeText(v.total||v.bytes);
    syncFileIcon(icon,d,32);body.append(name,meta);card.append(grip,icon.box,body);
    return {card,icon,body,grip};
  }
  function filePopupSurface(popup){
    try{
      const s=window.getComputedStyle(popup),stage=window.getComputedStyle(fileStage);
      const inner=popup.shadowRoot?.querySelector('[part~="content"], .panel-arrowcontent, .panel-content');
      const part=inner?window.getComputedStyle(inner):null;
      return {background:s.backgroundColor,appearance:s.appearance,opacity:s.opacity,radius:s.borderTopLeftRadius,stage:stage.backgroundColor,part:part?.backgroundColor??null,panelBackground:s.getPropertyValue("--panel-background-color").trim(),flip:popup.getAttribute("flip")};
    }catch{return null;}
  }
  function prepareFilePopup(){
    if(filePopup?.isConnected)return true;
    const set=get("mainPopupSet");if(!set||typeof document.createXULElement!=="function")return false;
    const popup=document.createXULElement("panel");if(typeof popup.getOuterScreenRect!=="function")return false;
    popup.id="zr-file-bunny-popup";
    // Gecko GetFrameTransparency checks root opacity and corner radius
    // before inspecting theme/background. Select a transparent native
    // widget before it is created; a transparent child alone is not enough.
    for(const [k,v] of Object.entries({"appearance":"none","background":"transparent","border":"0","border-radius":"1px","opacity":".999","pointer-events":"none","--panel-background-color":"transparent","--panel-background":"transparent","--panel-padding":"0px","--panel-border-color":"transparent","--panel-border-radius":"0px","--panel-shadow":"none","--panel-box-shadow-margin":"0px"}))popup.style.setProperty(k,v,"important");
    for(const [k,v] of Object.entries({noautohide:"true",noautofocus:"true",level:"top",flip:"none",mousethrough:"always",consumeoutsideclicks:"false",animate:"false","aria-hidden":"true"}))popup.setAttribute(k,v);
    // Gecko nsMenuPopupFrame skips screen constraints for chrome panels
    // with flip="none". Set before widget creation: native DragMoved must
    // keep the grip under the pointer even when the stage crosses a screen edge.
    const stage=make("div","zr-file-bunny-stage");popup.append(stage);set.append(popup);filePopup=popup;fileStage=stage;
    popup.addEventListener("popupshown",()=>{
      const q=fileBunny;if(!q||q.popup!==popup||q.ending||q.shown)return;
      q.shown=true;q.started=q.last=current();fileBunnyTrace("popup-shown",{state:popup.state,surface:filePopupSurface(popup)},{sample:1500});tickFilePopup(q);
    });
    popup.addEventListener("popuphidden",()=>{
      const q=fileBunny;
      if(q?.popup!==popup)return;
      fileBunnyTrace("popup-hidden",{ending:q.ending,frames:q.frames},{flush:true});
      if(!q.ending){
        // An unexpectedly hidden native widget must not keep painting.
        q.shown=false;stopFileBunnyFrame(q);
      }
    });
    return true;
  }
  function paintFileBunny(q,p,alpha=1){
    q.pose=p;const s=q.visual.card.style;
    s.width=Math.max(8,p.w)+"px";s.height=Math.max(8,p.h)+"px";
    s.transform="translate3d("+p.x+"px,"+p.y+"px,0) translateX(-50%) rotate("+p.angle+"deg) scale("+p.scale+")";
    s.opacity=String(alpha);s.borderRadius=fileMix(q.fromIndicator?5:8,11,p.morph)+"px";
    q.visual.body.style.opacity=String(q.fromIndicator?clamp((p.morph-.18)/.62,0,1):1);
    q.visual.icon.box.style.opacity=String(q.fromIndicator?clamp((p.morph-.08)/.5,0,1):1);
    q.visual.grip.style.opacity=String(p.morph);
    if(q.glyph)q.glyph.style.opacity=String(1-clamp(p.morph*2.8,0,1));
  }
  function popupPoint(q){
    try{const r=q.popup.getOuterScreenRect();if(r.width<2||r.height<2||!Number.isFinite(r.x)||!Number.isFinite(r.y))return null;return {x:r.x+FILE_GRIP_X,y:r.y+FILE_GRIP_Y};}catch{return null;}
  }
  function filePointInside(p){
    return !!p&&p.x>=window.mozInnerScreenX&&p.y>=window.mozInnerScreenY&&p.x<window.mozInnerScreenX+window.innerWidth&&p.y<window.mozInnerScreenY+window.innerHeight;
  }
  function sampleFilePopup(q,p,now){
    if(!p)return;
    if(q.screenPoint){
      const dx=p.x-q.screenPoint.x,dy=p.y-q.screenPoint.y;
      if(dx||dy){const dt=Math.max(8,now-q.lastMove)/1000;q.vx=fileMix(q.vx,clamp(dx/dt,-1600,1600),.68);q.lastMove=now;q.moves++;}
    }
    q.screenPoint=p;const inside=filePointInside(p);
    if(q.inside!==inside){q.inside=inside;q.crossings++;fileBunnyTrace("boundary",{inside,frames:q.frames,moves:q.moves},{sample:600});}
  }
  // Gecko owns popup screen movement. Only flush the nested OLE widget when
  // relative artwork changes; keep its 16ms source timer unchanged.
  function fileBunnyVisualChanged(last,next){
    return !last||Math.abs(last.x-next.x)>.05||Math.abs(last.y-next.y)>.05||
      Math.abs(last.w-next.w)>.05||Math.abs(last.h-next.h)>.05||
      Math.abs(last.angle-next.angle)>.03||Math.abs(last.scale-next.scale)>.0005||
      Math.abs(last.morph-next.morph)>.002;
  }
  function tickFilePopup(q){
    if(fileBunny!==q||q.ending||!q.shown||q.timer)return;
    const step=()=>{
      q.timer=0;if(fileBunny!==q||q.ending||!q.shown)return;
      const now=current();q.maxGap=Math.max(q.maxGap,now-q.last);
      sampleFilePopup(q,popupPoint(q),now);
      const pose=fileBunnyStep(q,now);q.frames++;q.maxAngle=Math.max(q.maxAngle,Math.abs(pose.angle));
      if(fileBunnyVisualChanged(q.paintPose,pose)){
        paintFileBunny(q,pose);q.paintPose=pose;q.paints++;
        // Gecko's nested OLE loop stalls rAF; flush changed widget artwork.
        q.visual.card.getBoundingClientRect();
      }else{
        // Preserve the exact release pose without redundant layout.
        q.pose=pose;q.skips++;
      }
      if(now-q.lastReport>=300){q.lastReport=now;fileBunnyTrace("tick",{frames:q.frames,moves:q.moves,maxGap:q.maxGap,angle:pose.angle,morph:pose.morph,inside:q.inside,state:q.popup.state,paintCount:window.windowUtils?.paintCount??null,paints:q.paints,skips:q.skips,grip:q.screenPoint?[Math.round(q.screenPoint.x),Math.round(q.screenPoint.y)]:null,flip:q.popup.getAttribute("flip")});}
      q.timer=window.setTimeout(step,16);
    };
    q.timer=window.setTimeout(step,0);
  }
  function stopFileBunnyFrame(q){
    if(q.timer)window.clearTimeout(q.timer);q.timer=0;if(q.frame)window.cancelAnimationFrame(q.frame);q.frame=0;
  }
  function beginFileBunny(e,source,d){
    clearFileBunny();
    const origin=fileOrigin(source),visual=createFileCard(d),native=createFileCard(d);
    native.card.setAttribute("data-native-preview","");native.card.setAttribute("aria-hidden","true");native.card.setAttribute("inert","");
    let glyph=null;if(source===node){glyph=make("span","zr-download-icon zr-file-bunny-seed");visual.card.append(glyph);}
    const point={x:FILE_GRIP_X,y:FILE_GRIP_Y};
    const dx=origin.x-(Number.isFinite(e.clientX)?e.clientX:origin.x),dy=origin.y-(Number.isFinite(e.clientY)?e.clientY:origin.y);
    const seed={x:point.x+clamp(dx,-45,45),y:point.y+clamp(dy,-36,20),w:Math.min(250,origin.w),h:Math.min(76,origin.h)};
    const s=Object.fromEntries(Object.entries({...seed,angle:0,scale:1}).map(([k,x])=>[k,{x,v:0}]));s.scale.v=2.4;
    const now=current(),q=fileBunny={source,fromIndicator:source===node,origin:seed,point,s,started:now,last:now,lastMove:now,lastReport:now,vx:0,visual,native,glyph,popup:null,ghost:null,mode:"bitmap",frame:0,timer:0,ending:false,shown:false,frames:0,moves:0,crossings:0,maxGap:0,maxAngle:0,paints:0,skips:0,paintPose:null,screenPoint:null,inside:null};
    // Do not attach the native card until the scoped Bunny state owns it.
    // A failure during source/card construction must leave no orphan node.
    root.append(native.card);
    let popupReady=false;
    // nsBaseDragSession DrawDrag recognizes a XUL panel as a live drag
    // image. Windows QueryContinueDrag calls DragMoved even outside Zen.
    if(!reduced.matches&&Services.appinfo.OS==="WINNT")try{
      if(prepareFilePopup()){
        q.popup=filePopup;fileStage.replaceChildren(visual.card);
        paintFileBunny(q,{...seed,angle:0,scale:1,morph:0});
        filePopup.getBoundingClientRect();
        e.dataTransfer.setDragImage(filePopup,FILE_GRIP_X,FILE_GRIP_Y);q.mode="popup";popupReady=true;
      }
    }catch{q.popup=null;fileStage?.replaceChildren();}
    if(!popupReady)try{e.dataTransfer.setDragImage(native.card,FILE_CARD_W/2,0);}catch{}
    source.setAttribute("data-file-lift","");
    fileBunnyTrace("start",{indicator:q.fromIndicator,reduced:reduced.matches,mode:q.mode,os:Services.appinfo.OS,seed:[seed.w,seed.h]},{sample:1500});
  }
  function finishExternalDrag(){
    const held=externalDrag;if(!held)return;externalDrag=null;
    try{held.done();}catch{}
  }
  function beginExternalDrag(event,source,id,done){
    if(dead||!node||!list||fileDragSource||fileBunny?.ending||externalDrag||cardOpen||dockOpen||typeof done!=="function")return false;
    if(!source?.isConnected||source.ownerDocument!==document||!source.closest?.("#nocturne-library-preview"))return false;
    if(window.__nocturneOverlay?.current()!=="library")return false;
    const accepted=list.withNative(id,d=>beginFileDrag(event,source,d));
    if(!accepted)return false;
    externalDrag={source,done};return true;
  }
  function endExternalDrag(source,event){
    if(externalDrag?.source!==source)return false;
    endFileDrag(source,event);return true;
  }
  function clearFileBunny(){
    const q=fileBunny;if(!q)return;fileBunny=null;stopFileBunnyFrame(q);
    q.source.removeAttribute("data-file-lift");
    if(q.popup){try{if(q.popup.state!=="closed")q.popup.hidePopup();}catch{}fileStage?.replaceChildren();}
    q.visual.card.remove();q.ghost?.remove();q.native.card.remove();
    if(q.ending&&!dead&&node){syncDownloadHolds();schedule(true);scheduleMount();}
    if(externalDrag?.source===q.source&&!fileDragSource)finishExternalDrag();
  }
  function finishFileBunny(e,reason="dragend"){
    const q=fileBunny;if(!q)return;stopFileBunnyFrame(q);
    const cancelled=!e||e.dataTransfer?.mozUserCancelled||e.dataTransfer?.dropEffect==="none";
    const point=q.mode==="popup"?(popupPoint(q)||q.screenPoint):null;
    fileBunnyTrace("end",{reason,mode:q.mode,cancelled,shown:q.shown,frames:q.frames,paints:q.paints,skips:q.skips,moves:q.moves,crossings:q.crossings,maxGap:q.maxGap,maxAngle:q.maxAngle,inside:filePointInside(point),drop:e?.dataTransfer?.dropEffect??null},{flush:true});
    if(dead||reduced.matches||!q.shown||!q.source.isConnected||!q.pose||!filePointInside(point)){clearFileBunny();return;}
    q.ending=true;
    const from={...q.pose,x:point.x-window.mozInnerScreenX-FILE_GRIP_X+q.pose.x,y:point.y-window.mozInnerScreenY-FILE_GRIP_Y+q.pose.y};
    const to=cancelled?{...fileOrigin(q.source),angle:0,scale:1,morph:0}:{...from,angle:0,scale:.74,morph:1};
    // Gecko closes its popup immediately after dragend. Only then create
    // a local continuation; no duplicate image during the native drag.
    q.timer=window.setTimeout(()=>{
      q.timer=0;if(fileBunny!==q||dead)return;
      q.ghost=make("div","zr-file-bunny-ghost");q.ghost.setAttribute("aria-hidden","true");q.ghost.append(q.visual.card);root.append(q.ghost);paintFileBunny(q,from);
      const start=current(),duration=cancelled?FILE_RETURN:230;
      const tick=now=>{
        q.frame=0;if(fileBunny!==q)return;
        const p=clamp((now-start)/duration,0,1),ease=1-Math.pow(1-p,3);
        const pose=Object.fromEntries(Object.keys(to).map(k=>[k,fileMix(from[k],to[k],ease)]));
        if(cancelled)pose.angle+=Math.sin(p*Math.PI*2.5)*5*(1-p);
        if(cancelled&&p>.72)q.source.removeAttribute("data-file-lift");
        paintFileBunny(q,pose,cancelled?1-clamp((p-.78)/.22,0,1):1-fileEase(p));
        if(p<1)q.frame=window.requestAnimationFrame(tick);else{fileBunnyTrace("return-finish",{cancelled,duration:current()-start});clearFileBunny();}
      };q.frame=window.requestAnimationFrame(tick);
    },0);
  }
  function beginFileDrag(e,source,d){
    // Source membership is verified again by the sole Downloads service.
    // Private-window Dock drags remain supported; Library ID drag is denied.
    if(dead||e.isTrusted!==true||!history.has(d)||
       !list?.dragNative?.(d,e,source)){
      window.__nocturneTrace?.("downloads.drag.payload",{accepted:false,reason:"native-source-or-file-unavailable"},{throttle:250});
      e.preventDefault();return false;
    }
    e.stopPropagation();
    fileDragSource=dragClickSource=source;
    source.setAttribute("data-file-dragging","");
    // Arm native-source recovery before optional card/popup allocation.
    watchFileDrag(source);
    cancelHide();cancelFlight();
    if(source!==node&&cardOpen)pinPanel();
    try{beginFileBunny(e,source,d);}catch{fileBunnyTrace("start-error",{indicator:source===node},{flush:true});clearFileBunny();}
    syncDownloadHolds();return true;
  }
  function endFileDrag(source,e,reason){
    if(fileDragSource!==source)return;
    source.removeAttribute("data-file-dragging");fileDragSource=null;
    stopFileDragWatch();finishFileBunny(e,reason);syncDownloadHolds();
    if(externalDrag?.source===source&&!fileBunny?.ending)finishExternalDrag();
    // Reconcile queued rows only after the platform drag releases the source.
    if(!dead){schedule(true);scheduleMount();if(cardOpen)armHide();}
  }
  function ignoreFileDragClick(e){
    return e.detail>0&&!!dragClickSource&&(e.target===dragClickSource||dragClickSource.contains?.(e.target));
  }
  function bindFileDrag(source,resolve,{row=false}={}){
    let actionPress=false;
    source.addEventListener("pointerdown",e=>{actionPress=row&&!!e.target.closest?.("button");});
    source.addEventListener("dragstart",e=>{
      if(actionPress||row&&e.target.closest?.("button")){e.preventDefault();return;}
      beginFileDrag(e,source,resolve());
    });
    source.addEventListener("dragend",e=>endFileDrag(source,e));
  }
  function makeRow(download){
    const el=make("div","zr-dock-row");el.setAttribute("role","listitem");
    bindFileDrag(el,()=>download,{row:true});
    const fileIcon=createFileIcon(),glyph=fileIcon.box,body=make("div","zr-dock-row-body"),name=make("div","zr-dock-name"),meta=make("div","zr-dock-meta");
    const [track,fill]=makeTrack();
    const stats=make("div","zr-dock-stats");stats.hidden=true;
    const actions=make("div","zr-dock-row-actions");
    const open=action("Open","zr-dock-open-file",async()=>{
      // Explicit user click only; Gecko handles the target and OS policy.
      try{
        if(!list)return;
        await list.actionNative(download,"open");
      }catch{showActionError("Could not open the downloaded file.");}
    });
    const folder=action("Show in folder","zr-dock-folder",async()=>{
      // Gecko owns path resolution and platform file-manager integration.
      // No shell command, arbitrary path, or executable launch.
      try{
        if(!list)return;
        await list.actionNative(download,"reveal");
      }catch{showActionError("Could not open the containing folder.");}
    });
    open.setAttribute("title","Open downloaded file");folder.setAttribute("title","Show in folder");
    body.append(name,meta,stats,track);actions.append(open,folder);el.append(glyph,body,actions);
    return {el,name,meta,stats,track,fill,open,folder,fileIcon};
  }
  function renderDock(){
    if(!dockOpen||!dockList)return;
    // Keep all native session-list entries in memory; render only a
    // bounded page, active items first, then newest first. Reuse rows.
    if(!historyOrder){
      historyOrder=[...history.keys()].reverse();
      historyOrder.sort((a,b)=>{
        const av=history.get(a),bv=history.get(b);
        if(sortKey==="size"){
          const active=Number(bv.active)-Number(av.active);if(active)return active;
          const x=sortBytes(av),y=sortBytes(bv);
          if(x===null||y===null){if(x!==y)return x===null?1:-1;}
          else if(x!==y)return sortDir*(x-y);
        }
        if(av.time!==bv.time)return (sortKey==="time"?sortDir:-1)*(av.time-bv.time);
        return 0;
      });
    }
    const entries=historyOrder;
    renderRows(dockList,rows,entries.slice(0,limit));
    dockEmpty.hidden=entries.length>0;dockMore.hidden=entries.length<=limit;
    clearButton.disabled=clearing||![...history.keys()].some(CLEARABLE);
  }
  function renderRecent(){
    if(!cardOpen||!dockList)return;
    if(!recentOrder)recentOrder=[...history.keys()].reverse().sort((a,b)=>history.get(b).time-history.get(a).time).slice(0,RECENT_LIMIT);
    renderRows(dockList,rows,recentOrder);
    dockEmpty.hidden=recentOrder.length>0;
  }
  function renderRows(container,rowCache,wanted){
    if(fileDragSource&&fileDragSource!==node)return;
    if(fileBunny?.ending&&fileBunny.source!==node)return;
    const keep=new Set(wanted);
    for(const [d,row] of rowCache)if(!keep.has(d)){row.el.remove();rowCache.delete(d);}
    const showStats=prefs.getBoolPref(STATS_PREF,true);
    let index=0;
    for(const d of wanted){
      const v=history.get(d);
      let row=rowCache.get(d);
      if(!row){row=makeRow(d);rowCache.set(d,row);}
      const text=v.active?sizeText(v.bytes)+(v.known?" / "+sizeText(v.total):"")+" · "+speedText(v.speed):
        v.success?"Complete · "+sizeText(v.total||v.bytes):v.failed?"Failed":"Stopped";
      if(row.name.textContent!==v.name)row.name.textContent=v.name;
      if(row.tooltipTime!==v.time||row.tooltipName!==v.name){
        row.tooltipTime=v.time;row.tooltipName=v.name;
        const description=v.name+(v.time?" — "+new Date(v.time).toLocaleString():"");
        row.el.setAttribute("title",description);row.name.setAttribute("title",description);
      }
      if(row.meta.textContent!==text)row.meta.textContent=text;
      row.el.setAttribute("data-state",v.active?"active":v.success?"complete":v.failed?"failed":"stopped");
      row.el.draggable=canDragFile(d);syncFileIcon(row.fileIcon,d);
      row.el.toggleAttribute("data-indeterminate",v.active&&!v.known);
      setVar(row.fill,"--zr-download-progress",String(v.known?Math.min(1,v.bytes/v.total):0));
      row.folder.disabled=!v.success||typeof d.showContainingDirectory!=="function";
      row.open.hidden=!v.success;
      row.open.disabled=!v.success||d.target?.exists===false||typeof d.launch!=="function";
      const statistics=showStats&&v.success&&v.duration>0;
      row.stats.hidden=!statistics;
      if(statistics){
        const statsText="Avg. "+speedText((v.total||v.bytes)*1000/v.duration)+" · "+durationText(v.duration);
        if(row.stats.textContent!==statsText)row.stats.textContent=statsText;
        row.stats.title="Average over elapsed time, including pauses";
      }
      if(container.children[index]!==row.el)container.insertBefore(row.el,container.children[index]||null);
      index++;
    }
  }
  function cancelHide(){if(hideTimer)window.clearTimeout(hideTimer);hideTimer=0;}
  function armHide(pointerLeft=false){
    cancelHide();
    // Pointer alone controls the recent timeout; button focus must not
    // keep it alive after the mouse leaves. Full mode never auto-dismisses.
    if(fileDragSource||!cardOpen||manualHold||entering||(!pointerLeft&&dock?.matches(":hover")))return;
    hideTimer=window.setTimeout(()=>{hideTimer=0;if(cardOpen&&!manualHold&&!dock.matches(":hover"))closeDock();},HOLD);
  }
  function handleOverlayEscape(){
    if(fileDragSource||clearing)return false;
    if(dockOpen&&confirming)setConfirm(false,true);else if(dockOpen||cardOpen)closeDock(true);
    else if(flight)cancelFlight();
    return true;
  }
  function onKey(e){
    if(e.key!=="Escape"||e.defaultPrevented||window.__nocturneOverlay)return;
    handleOverlayEscape();
  }
  function yieldDownloads(){
    if(fileDragSource||clearing)return false;
    cancelHide();cancelFlight();cancelPanel();stopFollow();overlayUntil=0;
    cardOpen=dockOpen=false;manualHold=sidebarOrigin=false;setConfirm(false);
    dock?.removeAttribute("data-open");dock?.removeAttribute("data-closing");dockBackdrop?.removeAttribute("data-open");
    if(dock){dock.inert=true;dock.setAttribute("aria-hidden","true");}
    node?.setAttribute("aria-expanded","false");updateLive();return true;
  }
  let unregisterOverlay=()=>{};
  function bindOverlay(){
    unregisterOverlay();
    unregisterOverlay=window.__nocturneOverlay?.register("downloads",{
      priority:10,isActive:()=>!dead&&!!(cardOpen||dockOpen||flight||dock?.hasAttribute("data-closing")||fileDragSource&&!externalDrag),
      canYield:()=>!fileDragSource&&!clearing,
      yield:yieldDownloads,onEscape:handleOverlayEscape
    })||(()=>{});
  }
  function closeCard(){if(cardOpen)closeDock();}
  function syncSidebarHold(){
    // Zen watches native sidebar descendants with [panelopen] and
    // owns zen-compact-mode-active. We own only our button's attribute.
    const hold=!dead&&!!node?.hasAttribute("data-zr-native")&&!!(fileDragSource||fileBunny?.ending||sidebarOrigin&&(cardOpen||dockOpen||dock?.hasAttribute("data-closing")));
    if(node&&node.hasAttribute("panelopen")!==hold)node.toggleAttribute("panelopen",hold);
  }
  function syncHostedHold(){
    typeof window!=="undefined"&&window.__nocturneTrace?.("downloads.hold",()=>({cardOpen,dockOpen,flight:!!flight}),{throttle:150,sample:1000});
    const wrapper=get("zen-appcontent-navbar-wrapper");
    const hold=!dead&&onePlane()&&!!node?.hasAttribute("data-zr-hosted")&&
      !!(fileDragSource||fileBunny?.ending||cardOpen||dockOpen||flight||dock?.hasAttribute("data-closing"));
    if(heldWrapper&&(!hold||heldWrapper!==wrapper)){
      heldWrapper.removeAttribute("oneplane-download-hold");heldWrapper=null;
    }
    if(hold&&wrapper){
      heldWrapper=wrapper;
      if(!wrapper.hasAttribute("oneplane-download-hold"))wrapper.setAttribute("oneplane-download-hold","true");
    }
  }
  function syncDownloadHolds(){syncSidebarHold();syncHostedHold();}
  function updateLive(){
    node?.toggleAttribute("data-live",snapshot.active>0||cardOpen||dockOpen||!!flight);
    syncDownloadHolds();
  }
  function pinPanel(fromIndicator=false){
    if(!cardOpen&&!dockOpen)return;
    // A click inside an auto notification pins only the downloads surface.
    // Only an explicit indicator click is allowed to acquire the sidebar.
    manualHold=true;if(fromIndicator)sidebarOrigin=true;
    cancelHide();syncDownloadHolds();follow(800);
  }
  function openCard(manual=false){
    if(!dock||!node||dead||dockOpen)return;
    if(window.__nocturneOverlay&&!window.__nocturneOverlay.request("downloads",{passive:!manual}))return;
    if(cardOpen){if(manual)pinPanel(true);renderRecent();armHide();return;}
    if(!manual&&dock.hasAttribute("data-closing"))return;
    cancelHide();cancelPanel();dock.removeAttribute("data-closing");manualHold=manual;sidebarOrigin=manual;
    dockNotice.textContent="";setPanelMode(false);syncTheme(dock);updateLive();
    const g=positionOverlays();
    dock.setAttribute("data-open","true");dock.setAttribute("aria-hidden","false");dock.inert=false;
    node.setAttribute("aria-expanded","true");
    revealPanel(g);follow(800);
  }
  function cancelFlight(){
    ++flightToken;
    if(flightTimer)window.clearTimeout(flightTimer);flightTimer=0;
    if(flightAnimation)try{flightAnimation.cancel();}catch{}
    flightAnimation=null;flight?.remove();flight=null;updateLive();
  }
  function launchFlight(){
    if(dead||!node||fileDragSource)return;
    if(window.__nocturneOverlay&&!window.__nocturneOverlay.request("downloads",{passive:true}))return;
    cancelFlight();if(dockOpen||dock?.hasAttribute("data-closing"))return;if(cardOpen){renderRecent();armHide();return;}mount();
    const activeWindow=!document.hasFocus||document.hasFocus();
    if(!activeWindow)return;
    node.setAttribute("data-live","true");
    if(reduced.matches){openCard();return;}
    const r=dockRect(),tx=r.x,ty=r.y;updateOverlayMask(r);
    const native=window.gZenUIManager?._lastClickPosition;
    const click=lastClick&&current()-lastClick.at<5000?lastClick:
      native&&Number.isFinite(native.clientX)&&Number.isFinite(native.clientY)?{x:native.clientX,y:native.clientY}:null;
    const x=Math.max(12,Math.min(window.innerWidth-12,click?.x??window.innerWidth/2));
    const y=Math.max(12,Math.min(window.innerHeight-12,click?.y??window.innerHeight*.45));
    const dx=tx-x,dy=ty-y,arc=Math.min(86,Math.hypot(dx,dy)*.14);
    const token=flightToken;
    flight=make("span","zr-download-flight");flight.setAttribute("aria-hidden","true");
    const glyph=make("span","zr-download-icon");flight.append(glyph);
    flight.style.setProperty("left",x+"px");flight.style.setProperty("top",y+"px");overlayLayer.append(flight);syncTheme(flight);syncHostedHold();
    try{
      // A short compositor-friendly curved flight; no frame callbacks,
      // no bouncing, and the card opens only after it reaches the icon.
      const frames=[
        {transform:"translate(-50%,-50%) scale(.45)",opacity:0,offset:0},
        {transform:"translate(calc(-50% + "+dx*.12+"px),calc(-50% + "+(dy*.12-arc*.42)+"px)) scale(1)",opacity:1,offset:.26},
        {transform:"translate(calc(-50% + "+dx*.72+"px),calc(-50% + "+(dy*.72-arc*.62)+"px)) scale(.86)",opacity:1,offset:.73},
        {transform:"translate(calc(-50% + "+dx+"px),calc(-50% + "+dy+"px)) scale(.4)",opacity:.12,offset:1}
      ];
      flightAnimation=flight.animate(frames,{duration:780,easing:"cubic-bezier(.32,.04,.25,1)",fill:"forwards"});
      const land=()=>{if(dead||token!==flightToken)return;cancelFlight();openCard();};
      flightTimer=window.setTimeout(land,940);
      flightAnimation.finished.then(land,land);
    }catch{cancelFlight();openCard();}
  }
  function paint(){
    updateTimer=0;if(dead||!node)return;
    lastRender=current();snapshot=summarize(batch.values());const s=snapshot;
    node.setAttribute("data-state",s.state);
    const completed=latestCompleted(history);node.draggable=!!completed;
    if(completed){fileIconWarm??=createFileIcon();syncFileIcon(fileIconWarm,completed);}else fileIconWarm=null;
    updateLive();
    node.toggleAttribute("data-transferring",s.active>0);
    node.toggleAttribute("data-indeterminate",s.state==="active"&&s.progress===null);
    if(s.progress!==null)setVar(fill,"--zr-download-progress",String(s.progress));
    else fill.style.removeProperty("--zr-download-progress");
    const text=s.active?speedText(s.speed):"";
    if(speed.textContent!==text)speed.textContent=text;
    const label=(text?"Downloads — "+text:"Downloads")+(node.draggable?" · Drag latest file":"");
    if(node.getAttribute("title")!==label)node.setAttribute("title",label);
    if(node.getAttribute("aria-label")!==label)node.setAttribute("aria-label",label);
    if(cardOpen)renderRecent();
    if(dockOpen)renderDock();
    // No geometry reads on ordinary transfer updates.
  }
  function schedule(immediate=false){
    if(dead||!node||hydrating)return;
    if(immediate){if(updateTimer)window.clearTimeout(updateTimer);paint();return;}
    if(!updateTimer)updateTimer=window.setTimeout(paint,Math.max(0,RATE-(current()-lastRender)));
  }
  function changed(d){
    if(dead||!node)return;
    const previous=batch.get(d),next=sample(d);
    const old=history.get(d);
    // Completion time is observed only for new session downloads; do not
    // invent a duration for restored completed history.
    if(next.success)next.completedAt=old?.completedAt??(!hydrating&&fresh.has(d)?Date.now():next.time);
    if(old?.duration>0&&next.success)next.duration=old.duration;
    else if(!hydrating&&fresh.has(d)&&next.success&&next.time>0&&(!old||!old.success)){
      const elapsed=Date.now()-next.time;
      if(elapsed>0)next.duration=elapsed;
    }
    if(!old||old.time!==next.time)recentOrder=null;
    if(!old||old.active!==next.active||old.time!==next.time||sortKey==="size"&&sortBytes(old)!==sortBytes(next))historyOrder=null;
    history.set(d,next);
    if(next.active){
      if(!previous?.active){
        // A new batch after completion starts with clean totals.
        if(![...batch.values()].some(x=>x.active)){batch.clear();cancelHide();}
        batch.set(d,next);latest=d;schedule(!hydrating);if(!hydrating)launchFlight();return;
      }
      batch.set(d,next);schedule();return;
    }
    // Initial addView replays history. Only a transfer observed active in
    // this window can become a terminal notification.
    if(previous?.active){batch.set(d,next);latest=d;schedule(true);}
    else if(!hydrating&&!previous&&(next.success||next.failed)&&fresh.has(d)){
      if(![...batch.values()].some(x=>x.active))batch.clear();
      batch.set(d,next);latest=d;schedule(true);launchFlight();
    }else if(dockOpen||cardOpen||next.success||old?.success)schedule();
  }
  function added(d){if(!hydrating)fresh.add(d);changed(d);}
  function removed(d){if(history.delete(d)){historyOrder=null;recentOrder=null;}if(batch.delete(d)){if(latest===d)latest=null;schedule(true);}else schedule();}
  function teardown(){
    typeof window!=="undefined"&&window.__nocturneTrace?.("downloads.teardown",()=>(null),{flush:true});
    ++epoch;
    if(updateTimer)window.clearTimeout(updateTimer);updateTimer=0;cancelHide();cancelFlight();cancelPanel();cardOpen=dockOpen=false;manualHold=false;sidebarOrigin=false;dock?.removeAttribute("data-closing");syncDownloadHolds();stopFollow();overlayUntil=0;
    if(layoutFrame)window.cancelAnimationFrame(layoutFrame);layoutFrame=0;
    resizeObserver?.disconnect();resizeObserver=null;observedSidebar=anchor=null;
    unsubscribeDownloads?.();unsubscribeDownloads=null;list=null;hydrating=false;
    layoutObserver?.disconnect();layoutObserver=null;
    window.removeEventListener("resize",scheduleMount);window.removeEventListener("OnePlane:DownloadHostChanged",scheduleMount);
    window.removeEventListener("ZenCompactMode:LayoutUpdate",scheduleMount);window.removeEventListener("ZenCompactMode:Toggled",scheduleMount);
    for(const type of ["transitionrun","transitionstart","transitionend","transitioncancel"])window.removeEventListener(type,trackLayout,true);
    window.removeEventListener("pointerdown",trackClick,true);window.removeEventListener("pointerdown",outsideDock,true);window.removeEventListener("keydown",onKey,true);
    try{prefs.removeObserver(SIDE,scheduleMount);}catch{}
    try{prefs.removeObserver(STATS_PREF,refreshStatistics);}catch{}
    stopFileDragWatch();
    if(fileBunny)fileBunny.ending=false;clearFileBunny();filePopup?.remove();filePopup=fileStage=null;fileIconWarm=null;
    fileDragSource?.removeAttribute("data-file-dragging");fileDragSource=dragClickSource=null;syncDownloadHolds();finishExternalDrag();
    node?.remove();node=fill=speed=icon=null;host=null;batch.clear();fresh=new WeakSet();latest=lastClick=null;
    dock?.remove();overlayLayer?.remove();dockBackdrop?.remove();dock=dockList=dockEmpty=dockMore=dockBackdrop=dockNotice=overlayLayer=null;history.clear();rows.clear();historyOrder=recentOrder=null;limit=30;dockHeight=0;allButton=dockTitle=dockSort=null;
    sortKey="time";sortDir=-1;headerNormal=headerConfirm=clearButton=sortTime=sortSize=yesButton=noButton=null;confirming=clearing=false;
    snapshot=Object.freeze({active:0,progress:null,speed:0,state:"idle"});
    root.removeAttribute(ACTIVE);root.removeAttribute("data-zr-downloads-native");lastDockRect=null;
  }
  async function install(){
    if(dead||node||!enabled())return;
    const source=window.__nocturneLibraryServices?.downloads;
    // The independent service announces readiness in either Sine script order.
    // Never attach a second native Downloads view as a fallback.
    if(!source)return;
    const token=++epoch;
    const currentGeneration=()=>!dead&&token===epoch&&enabled()&&!window.closed&&window.__nocturneLibraryServices?.downloads===source;
    try{
      await source.start();
      if(!currentGeneration())return;
      build();list=source;hydrating=true;
      const guard=fn=>download=>{if(currentGeneration()&&list===source)fn(download);};
      unsubscribeDownloads=source.subscribeNative({onDownloadAdded:guard(added),onDownloadChanged:guard(changed),onDownloadRemoved:guard(removed)});
      if(!currentGeneration()){teardown();return;}
      hydrating=false;root.setAttribute(ACTIVE,"true");schedule(true);
    }catch(error){
      if(currentGeneration()){console.warn("[Nocturne] Download indicator service unavailable");teardown();}
    }
  }
  function onServicesGone(){if(!dead)teardown();}
  function onServicesReady(){if(!dead)sync();}
  function sync(){if(!initialized||dead)return;if(enabled())void install();else teardown();}
  function start(){initialized=true;sync();}
  function dispose(){
    if(dead)return;dead=true;unregisterOverlay();window.removeEventListener("Nocturne:OverlayReady",bindOverlay);teardown();
    if(readyObserver)try{Services.obs.removeObserver(readyObserver,"browser-delayed-startup-finished");}catch{}
    readyObserver=null;try{prefs.removeObserver(PREF,sync);}catch{}
    window.removeEventListener("unload",dispose);
    window.removeEventListener("Nocturne:ServicesGone",onServicesGone);window.removeEventListener("Nocturne:ServicesReady",onServicesReady);
    if(window[KEY]===api)delete window[KEY];
  }
  const api={getSnapshot:()=>snapshot,setHost,beginExternalDrag,endExternalDrag,dispose};
  window[KEY]=api;window.addUnloadListener(dispose);window.addEventListener("unload",dispose,{once:true});
  window.addEventListener("Nocturne:OverlayReady",bindOverlay);bindOverlay();
  window.addEventListener("Nocturne:ServicesGone",onServicesGone);window.addEventListener("Nocturne:ServicesReady",onServicesReady);
  prefs.addObserver(PREF,sync);
  if(window.gBrowserInit?.delayedStartupFinished)start();
  else{readyObserver=subject=>{if(subject!==window)return;Services.obs.removeObserver(readyObserver,"browser-delayed-startup-finished");readyObserver=null;start();};Services.obs.addObserver(readyObserver,"browser-delayed-startup-finished");}
})();
