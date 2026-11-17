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
/* L3: disabled by default. No native commands or privileged data requests. */
(()=>{
  const win=window,doc=win.document,root=doc.documentElement,KEY="__nocturneLibrary",PREF="zen.nocturne.library.preview",OWNER="library";
  if(typeof win.addUnloadListener!=="function"||root.hasAttribute("popup-window"))return;
  win[KEY]?.dispose?.();
  const prefs=Services.prefs,NS="http://www.w3.org/1999/xhtml";
  const labels={downloads:"All Downloads",documents:"Documents",history:"History",pictures:"Pictures",closed:"Recently Closed"};
  const summaries={downloads:"Download records and file actions",documents:"Downloaded documents and opted-in folders",history:"Browsing history and search",pictures:"Downloaded pictures and opted-in folders",closed:"Recently closed tabs in this window"};
  let state=createLibraryState(),dead=false,lease=()=>{},shell=null,animations=[],frame=0,returnFocus=null;
  const enabled=()=>prefs.getBoolPref(PREF,false),active=()=>state.phase!=="closed";
  const duration=n=>libraryDuration(win.matchMedia("(prefers-reduced-motion: reduce)").matches,prefs.getIntPref("zen.oneplane.animation-duration",160)!==0,n);
  const make=(tag,cls,text)=>{const n=doc.createElementNS(NS,tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
  function privateWindow(){try{return ChromeUtils.importESModule("resource://gre/modules/PrivateBrowsingUtils.sys.mjs").PrivateBrowsingUtils.isWindowPrivate(win);}catch{return true;}}
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
    if(!active()||frame)return;frame=win.requestAnimationFrame(()=>{frame=0;if(active()&&!geometry())closeNow();});
  }
  function mount(){
    if(shell)return true;
    const layer=make("div");layer.id="nocturne-library-preview";layer.hidden=true;
    if(typeof layer.showPopover!=="function"||typeof layer.hidePopover!=="function")return false;
    layer.setAttribute("popover","manual");
    const shade=make("div","nl-shade");shade.setAttribute("aria-hidden","true");
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
    nav.append(left,tabs.get("history"),right);
    const search=make("input","nl-search");search.type="search";search.autocomplete="off";search.setAttribute("aria-label","Search Library");
    search.addEventListener("input",()=>{state=reduceLibrary(state,{type:"QUERY",value:search.value});});
    const body=make("div","nl-body");body.id="nl-body";body.setAttribute("role","tabpanel");body.tabIndex=0;
    panel.append(header,nav,search,body);layer.append(shade,panel);root.append(layer);
    shade.addEventListener("pointerdown",e=>{if(e.button===0){e.preventDefault();close();}});
    panel.addEventListener("keydown",e=>{
      if(e.key!=="Tab")return;
      const nodes=[dismiss,tabs.get(state.section),search,body],i=nodes.indexOf(doc.activeElement);
      const next=e.shiftKey?(i<=0?nodes.length-1:i-1):(i<0||i===nodes.length-1?0:i+1);
      e.preventDefault();nodes[next].focus();
    });
    shell={layer,shade,panel,title,tabs,search,body};return true;
  }
  function renderHeader(){
    const {title,tabs,search,body}=shell;title.textContent=labels[state.section];
    for(const [id,b] of tabs){const selected=id===state.section;b.setAttribute("aria-selected",String(selected));b.tabIndex=selected?0:-1;}
    search.placeholder="Search "+labels[state.section].toLowerCase();search.value=state.query;body.setAttribute("aria-labelledby","nl-tab-"+state.section);
  }
  function renderBody(){
    const empty=make("div","nl-placeholder");empty.append(make("strong","",summaries[state.section]),make("p","","Preview shell — native data and actions will be connected in L4–L6."));
    shell.body.replaceChildren(empty);
  }
  function sample(n){const c=win.getComputedStyle(n);return {opacity:c.opacity,transform:c.transform};}
  function cancelMotion(){for(const a of animations)try{a.cancel();}catch{}animations=[];}
  function play(n,frames,ms){
    if(!ms||typeof n.animate!=="function")return Promise.resolve();
    try{const a=n.animate(frames,{duration:ms,easing:"cubic-bezier(.2,.75,.2,1)",fill:"both"});animations.push(a);return a.finished.catch(()=>{});}catch{return Promise.resolve();}
  }
  const current=epoch=>!dead&&state.motionEpoch===epoch;
  function settle(epoch){if(current(epoch)){state=reduceLibrary(state,{type:"MOTION_DONE",epoch});cancelMotion();}}
  function hide(restore=true){
    cancelMotion();if(frame)win.cancelAnimationFrame(frame);frame=0;
    if(shell){try{if(shell.layer.matches(":popover-open"))shell.layer.hidePopover();}catch{}shell.layer.hidden=true;shell.panel.inert=false;shell.body.replaceChildren();shell.search.value="";}
    const target=returnFocus;returnFocus=null;if(!restore||win.closed)return;
    try{if(target?.isConnected&&typeof target.focus==="function")target.focus({preventScroll:true});else win.gBrowser?.selectedBrowser?.focus();}catch{}
  }
  function closeNow(restore=true){
    if(!active())return;state=reduceLibrary(state,{type:"CLOSE"});state=reduceLibrary(state,{type:"MOTION_DONE",epoch:state.motionEpoch});hide(restore);
  }
  function close(){
    const next=reduceLibrary(state,{type:"CLOSE"});if(next===state)return false;
    state=next;const epoch=state.motionEpoch,panel=sample(shell.panel),shade=sample(shell.shade);
    cancelMotion();shell.panel.inert=true;
    void Promise.all([play(shell.panel,[panel,{opacity:0,transform:"translateY(8px) scale(.97)"}],duration(210)),play(shell.shade,[shade,{opacity:0}],duration(180))]).then(()=>{
      if(!current(epoch))return;state=reduceLibrary(state,{type:"MOTION_DONE",epoch});hide();
    });return true;
  }
  function open(section="history"){
    if(dead||!enabled()||!LIBRARY_SECTIONS.includes(section)||!win.gBrowserInit?.delayedStartupFinished||win.fullScreen||privateWindow())return false;
    const overlay=win.__nocturneOverlay;
    if(!overlay||!mount()||!geometry()||!overlay.request(OWNER))return false;
    const before=state,next=reduceLibrary(state,{type:"OPEN",section});if(next===state)return true;
    const first=before.phase==="closed",reopening=before.phase==="closing";
    const panel=first?{opacity:0,transform:"translateY(8px) scale(.97)"}:sample(shell.panel),shade=first?{opacity:0}:sample(shell.shade),body=sample(shell.body);
    cancelMotion();state=next;const epoch=state.motionEpoch;shell.panel.inert=false;
    if(first){returnFocus=doc.activeElement;shell.layer.hidden=false;try{shell.layer.showPopover();}catch{closeNow();return false;}}
    renderHeader();
    if(state.phase==="opening"){
      renderBody();shell.search.focus({preventScroll:true});
      void Promise.all([play(shell.panel,[panel,{opacity:1,transform:"none"}],duration(reopening?220:300)),play(shell.shade,[shade,{opacity:1}],duration(200))]).then(()=>settle(epoch));
    }else{
      void play(shell.body,[body,{opacity:0,transform:"translateX(-6px)"}],duration(90)).then(()=>{
        if(!current(epoch))return;cancelMotion();renderBody();
        return play(shell.body,[{opacity:0,transform:"translateX(6px)"},{opacity:1,transform:"none"}],duration(160)).then(()=>settle(epoch));
      });
    }
    return true;
  }
  function toggle(section="history"){return active()&&state.phase!=="closing"&&state.section===section?close():open(section);}
  function bindOverlay(){
    lease();const overlay=win.__nocturneOverlay;
    lease=overlay?.register(OWNER,{priority:60,isActive:active,canYield:()=>true,yield(){closeNow(false);return true;},onEscape(){return close()||active();}})||(()=>{});
    if(active()&&!overlay?.request(OWNER))closeNow();
  }
  function onPref(){if(!enabled())closeNow();}
  function onTab(){if(active())closeNow(false);}
  function onWorkspace(e){if(active()&&e.detail?.phase!=="idle")closeNow(false);}
  function dispose(){
    if(dead)return;closeNow(false);dead=true;lease();cancelMotion();if(frame)win.cancelAnimationFrame(frame);
    for(const [name,fn] of listeners)win.removeEventListener(name,fn,true);
    try{prefs.removeObserver(PREF,onPref);}catch{}shell?.layer.remove();shell=null;if(win[KEY]===api)delete win[KEY];
  }
  const listeners=[["Nocturne:OverlayReady",bindOverlay],["resize",resize],["TabSelect",onTab],["ZenRefined:WorkspaceTransition",onWorkspace],["dragstart",onTab],["unload",dispose]];
  const api={open,toggle,close,getState:()=>({...state}),dispose};
  win[KEY]=api;for(const [name,fn] of listeners)win.addEventListener(name,fn,true);
  win.addUnloadListener(dispose);prefs.addObserver(PREF,onPref);bindOverlay();
})();
