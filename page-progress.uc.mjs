// Nocturne preview.23: early trace, independent Sine script order.
try{if(typeof window!=="undefined"){
  const event="page-progress.script",data={version:"0.3.0-preview.23"};
  if(window.__nocturneTrace)window.__nocturneTrace(event,data,{sample:1500});
  else{const q=window.__nocturneEarlyTrace??(window.__nocturneEarlyTrace=[]);if(q.length<32)q.push({event,t:window.performance?.now?.()??0,data});}
}}catch{}
/* Nocturne — symmetric Page Progress. Native top-level network events only.
 * Estimates are never presented as exact page completion percentages. */
(() => {
  const root=document.documentElement,prefs=Services.prefs;
  const PREF="zen.refined.page-progress.enabled",KEY="__zenRefinedPageProgress";
  const NS="http://www.w3.org/1999/xhtml",F=Ci.nsIWebProgressListener;
  if(root.hasAttribute("popup-window")||typeof window.addUnloadListener!=="function")return;
  window[KEY]?.();
  const OWNER="data-zr-page-progress-owner";
  const SHOW_DELAY=90,OPEN_MS=260,COMPLETE_MS=280,CLOSE_MS=340;
  let dead=false,installed=false,initialized=false,observer=null,bar=null,fill=null;
  let browser=null,states=new WeakMap(),selected=null,shown=false,showTimer=0,phaseTimer=0,renderTimer=0,lastRender=0,phase="hidden",terminal=null;
  const now=()=>window.performance.now();
  const enabled=()=>prefs.getBoolPref(PREF,true);
  const make=(tag,cls)=>{const n=document.createElementNS(NS,tag);n.className=cls;return n;};
  function clearTimers(){
    for(const t of [showTimer,phaseTimer,renderTimer])if(t)window.clearTimeout(t);
    showTimer=phaseTimer=renderTimer=0;
  }
  function setPhase(next){
    phase=next;
    if(next==="hidden")bar?.removeAttribute("data-phase");
    else bar?.setAttribute("data-phase",next);
  }
  function later(ms,fn){
    if(phaseTimer)window.clearTimeout(phaseTimer);
    phaseTimer=window.setTimeout(()=>{phaseTimer=0;if(installed&&shown)fn();},ms);
  }
  function hide(){
    clearTimers();shown=false;terminal=null;setPhase("hidden");bar?.removeAttribute("data-visible");
    bar?.removeAttribute("data-indeterminate");bar?.removeAttribute("data-terminal");
    fill?.style.setProperty("--zr-page-progress","0");
  }
  function collapse(){
    bar.removeAttribute("data-indeterminate");setPhase("closing");
    later(CLOSE_MS,hide);
  }
  function finish(success){
    if(!shown){hide();return;}
    terminal=success;
    // A fast successful load completes only after the initial unfold.
    // Cancellation never fills to 100%.
    if(phase==="opening"){
      if(!success)collapse();
      return;
    }
    if(!success){collapse();return;}
    bar.removeAttribute("data-indeterminate");bar.setAttribute("data-terminal","true");
    setPhase("complete");fill.style.setProperty("--zr-page-progress","1");
    later(COMPLETE_MS,collapse);
  }
  function state(b){
    let s=states.get(b);
    if(!s){s={active:false,progress:null};states.set(b,s);}
    return s;
  }
  function selectedState(){return selected?states.get(selected):null;}
  function paint(){
    renderTimer=0;if(!bar||!shown||phase!=="loading")return;
    const s=selectedState();if(!s?.active)return;
    lastRender=now();
    bar.toggleAttribute("data-indeterminate",s.progress===null);
    fill.style.setProperty("--zr-page-progress",String(s.progress??.16));
  }
  function schedule(){
    if(!shown||phase!=="loading"||renderTimer)return;
    renderTimer=window.setTimeout(paint,Math.max(0,120-(now()-lastRender)));
  }
  function reveal(){
    if(showTimer||shown||!bar)return;
    const b=selected;
    showTimer=window.setTimeout(()=>{
      showTimer=0;if(!installed||selected!==b||!selectedState()?.active)return;
      shown=true;terminal=null;bar.removeAttribute("data-terminal");
      setPhase("opening");bar.setAttribute("data-visible","true");
      later(OPEN_MS,()=>{
        setPhase("loading");
        if(terminal!==null){finish(terminal);return;}
        paint();
      });
    },SHOW_DELAY);
  }
  function attachSelected(){
    // Match ZenProgressBar's selected-panel coordinate system.
    const panel=browser?.selectedTab?.linkedPanel&&document.getElementById(browser.selectedTab.linkedPanel);
    const target=panel||root;
    if(bar.parentNode!==target){
      if(target.firstChild)target.insertBefore(bar,target.firstChild);
      else target.append(bar);
    }
  }
  function resetFor(b){
    hide();selected=b;
    if(!b||!bar)return;
    attachSelected();
    let s=states.get(b);
    if(!s&&browser.selectedTab?.hasAttribute("busy")&&!browser.selectedTab?.hasAttribute("pending")){
      s=state(b);s.active=true;
    }
    if(s?.active)reveal();
  }
  function onSelect(){if(browser)resetFor(browser.selectedBrowser);}
  function successful(status){return status===0||status===undefined||(Number(status)>>>31)===0;}
  const listener={
    onStateChange(b,webProgress,request,flags,status){
      if(!installed||!b||!webProgress?.isTopLevel||!(flags&F.STATE_IS_NETWORK))return;
      const s=state(b);
      if(flags&F.STATE_START){
        if(!s.active){s.active=true;s.progress=null;if(b===selected){hide();attachSelected();reveal();}}
      }
      if(flags&F.STATE_STOP){
        if(!s.active)return;s.active=false;
        if(b!==selected)return;
        if(showTimer)window.clearTimeout(showTimer);showTimer=0;
        if(renderTimer)window.clearTimeout(renderTimer);renderTimer=0;
        finish(successful(status));
      }
    },
    onProgressChange(b,webProgress,request,curSelf,maxSelf,curTotal,maxTotal){
      if(!installed||!b||!webProgress?.isTopLevel)return;
      const s=states.get(b);if(!s?.active||!Number.isFinite(maxTotal)||maxTotal<=0||!Number.isFinite(curTotal)||curTotal<0)return;
      const estimate=Math.min(.94,Math.max(.025,curTotal/maxTotal));
      s.progress=Math.max(s.progress??0,estimate);
      if(b===selected)schedule();
    }
  };
  function install(){
    typeof window!=="undefined"&&window.__nocturneTrace?.("page-progress.install",()=>(null),{sample:1800});
    if(installed||dead||!enabled()||!window.gBrowser?.addTabsProgressListener)return;
    browser=window.gBrowser;
    bar=make("div","zr-page-progress");bar.id="zr-page-progress";bar.setAttribute("aria-hidden","true");
    bar.setAttribute("data-zr-center-progress","");
    const track=make("div","zr-page-progress-track");
    fill=make("div","zr-page-progress-fill");track.append(fill);bar.append(track);
    installed=true;
    try{
      browser.addTabsProgressListener(listener);
      browser.tabContainer.addEventListener("TabSelect",onSelect);
      resetFor(browser.selectedBrowser);
      root.setAttribute(OWNER,"center");
    }catch(error){console.warn("[Zen Refined] Page progress:",error);uninstall();}
  }
  function uninstall(){
    hide();
    if(installed){
      try{browser.removeTabsProgressListener(listener);}catch{}
      browser?.tabContainer?.removeEventListener("TabSelect",onSelect);
    }
    installed=false;root.removeAttribute(OWNER);bar?.remove();bar=fill=null;browser=selected=null;states=new WeakMap();
  }
  function sync(){if(!initialized||dead)return;if(enabled())install();else uninstall();}
  function dispose(){
    typeof window!=="undefined"&&window.__nocturneTrace?.("page-progress.dispose",()=>(null),{flush:true});
    if(dead)return;dead=true;uninstall();
    if(observer)try{Services.obs.removeObserver(observer,"browser-delayed-startup-finished");}catch{}
    observer=null;
    try{prefs.removeObserver(PREF,sync);}catch{}
    window.removeEventListener("unload",dispose);if(window[KEY]===dispose)delete window[KEY];
  }
  function start(){initialized=true;sync();}
  window[KEY]=dispose;window.addUnloadListener(dispose);window.addEventListener("unload",dispose,{once:true});
  prefs.addObserver(PREF,sync);
  if(window.gBrowserInit?.delayedStartupFinished)start();
  else{observer=subject=>{if(subject!==window)return;Services.obs.removeObserver(observer,"browser-delayed-startup-finished");observer=null;start();};Services.obs.addObserver(observer,"browser-delayed-startup-finished");}
})();
