/* Manual Mirror Layout native evidence probe. Developer-only Browser Console
 * script, NOT a Sine entrypoint. Review before pasting; use a disposable Zen
 * profile. Loading this script performs no native writes or listener setup.
 * Only the separate probe key may be set/deleted by explicit commands.
 * Armed search observation temporarily shadows exact instance methods;
 * it never changes the native navigation destination or writes metadata. */
var nocturneSideProbe = (() => {
  const KEY="nocturne.manual-side.probe.v1", ARM="disposable-profile";
  const {SessionStore:store}=ChromeUtils.importESModule("moz-src:///browser/components/sessionstore/SessionStore.sys.mjs");
  const {PrivateBrowsingUtils:privacy}=ChromeUtils.importESModule("resource://gre/modules/PrivateBrowsingUtils.sys.mjs");
  const {BrowserWindowTracker:tracker}=ChromeUtils.importESModule("resource:///modules/BrowserWindowTracker.sys.mjs");
  const regular=t=>!!t&&t.isConnected&&!t.closing&&!t.pinned&&!t.group&&!t.splitView&&
    !["zen-empty-tab","zen-essential","zen-glance-tab","split-view"].some(k=>t.hasAttribute(k));
  const classify=v=>v===""?"missing":v==="left"||v==="right"?v:"other";
  function eligibleWindow(w){
    return !!w&&!w.closed&&!w._zenClosingWindow&&privacy.isWindowPrivate(w)===false&&
      w.gZenStartup?.isReady===true&&w.gZenWorkspaces?.workspaceEnabled===true&&
      w.gZenWorkspaces.currentWindowIsSyncing===true&&!w.gZenWorkspaces.isChangingWorkspace&&
      !!store.getWindowId(w)&&!!w.gZenWindowSync;
  }
  function exactTab(w,t,id,workspace){
    if(!eligibleWindow(w)||!regular(t)||!id||!workspace||
       t.id!==id||t.ownerDocument?.defaultView!==w||t.getAttribute("zen-workspace-id")!==workspace||
       w.document.getElementById(id)!==t||!w.gBrowser.isTab(t))return false;
    const all=w.gZenWorkspaces.allStoredTabs;
    const container=w.gZenWorkspaces.workspaceElement(workspace)?.tabsContainer;
    return Array.isArray(all)&&all.filter(x=>x.id===id).length===1&&all.includes(t)&&
      !!container?.isConnected&&container.contains(t);
  }
  function selected(){
    const w=Services.wm.getMostRecentWindow("navigator:browser");
    if(!eligibleWindow(w))return null;
    const t=w.gBrowser.selectedTab,id=t?.id,workspace=t?.getAttribute("zen-workspace-id");
    return exactTab(w,t,id,workspace)?{w,t,id,workspace,manager:w.gZenWorkspaces,browser:w.gBrowser,sync:w.gZenWindowSync,context:t.userContextId}:null;
  }
  function current(s){
    const n=selected();
    return !!n&&["w","t","id","workspace","manager","browser","sync","context"].every(k=>s[k]===n[k]);
  }
  function collect(s){
    const enabled=Services.prefs.getBoolPref("zen.window-sync.enabled",true);
    const pinnedOnly=Services.prefs.getBoolPref("zen.window-sync.sync-only-pinned-tabs",true);
    const scope=enabled&&!pinnedOnly?"all":"local";
    const counts={left:0,right:0,missing:0,other:0,unavailable:0,absent:0,excluded:0,windows:0};
    const windows=[...new Set([s.w,...tracker.orderedWindows])];
    for(const w of windows){
      try{
        if(!w||w.closed||w._zenClosingWindow||privacy.isWindowPrivate(w)===true||
           w.gZenWorkspaces?.privateWindowOrDisabled===true){counts.excluded++;continue;}
        counts.windows++;
        if(!eligibleWindow(w)||w.gZenWindowSync!==s.sync){counts.unavailable++;continue;}
        const t=w.document.getElementById(s.id);
        if(!t){counts.absent++;continue;}
        if(!exactTab(w,t,s.id,s.workspace)||t.userContextId!==s.context){counts.unavailable++;continue;}
        counts[classify(store.getCustomTabValue(t,KEY))]++;
      }catch{counts.unavailable++;}
    }
    return {scope,local:classify(store.getCustomTabValue(s.t,KEY)),...counts};
  }
  function report(stage,status,s,details={}){
    const result={stage,status,...details};
    // Existing bounded diagnostics, if installed. No URL, label, ID,
    // selected text, raw custom value or exception message is exported.
    try{
      if(s&&privacy.isWindowPrivate(s.w)===false)
        s.w.__nocturneTrace?.("manual.side.probe",result,{flush:true});
    }catch{}
    return JSON.stringify(result);
  }
  function snapshot(){
    let s=null;
    try{
      s=selected();
      if(!s)return report("snapshot","unavailable",null);
      const details=collect(s);
      return current(s)?report("snapshot","read",s,details):report("snapshot","stale",s);
    }catch{return report("snapshot","unavailable",s);}
  }
  function mutate(operation,value,arm){
    let s=null;
    if(arm!==ARM||operation==="write"&&!["left","right"].includes(value))
      return report(operation,"rejected",null);
    try{
      s=selected();
      if(!s)return report(operation,"unavailable",null);
      const before=store.getCustomTabValue(s.t,KEY);
      if(classify(before)==="other"||!current(s))return report(operation,"rejected",s);
      if(operation==="write"){
        if(before!==value)store.setCustomTabValue(s.t,KEY,value);
      }else if(before!=="")store.deleteCustomTabValue(s.t,KEY);
      if(!current(s)||store.getCustomTabValue(s.t,KEY)!==value)return report(operation,"unverified",s);
      const details=collect(s);
      return current(s)&&details.local===classify(value)?report(operation,"verified",s,details):report(operation,"unverified",s);
    }catch{return report(operation,"unverified",s);}
  }
  // Developer-only experiment. Observe a callback on the exact synchronous
  // native result dispatch, not the next TabOpen. Never assign a side.
  let searchProbe=null,lastSearch=null;
  function shadow(target,key,make){
    if(!target||Object.hasOwn(target,key)||typeof target[key]!=="function")return null;
    const original=target[key],wrapper=make(original);
    Object.defineProperty(target,key,{value:wrapper,writable:true,configurable:true});
    return ()=>{
      const d=Object.getOwnPropertyDescriptor(target,key);
      if(d?.value!==wrapper)return false;
      if(!d.configurable)return false;
      return delete target[key];
    };
  }
  function finishSearch(s,status){
    if(!s||searchProbe!==s)return;
    searchProbe=null;
    let released=true;
    for(const cleanup of s.cleanup.reverse()){
      try{if(cleanup()===false)released=false;}catch{released=false;}
    }
    s.cleanup.length=0;
    lastSearch={stage:"search",status,released,loads:s.loads,callbacks:s.callbacks,exact:s.exact};
    report("search",status,s,{released,loads:s.loads,callbacks:s.callbacks,exact:s.exact});
  }
  function stopSearch(){
    if(!searchProbe)return JSON.stringify({stage:"search",status:"inactive"});
    finishSearch(searchProbe,"stopped");
    return JSON.stringify({stage:"search",status:"stopped"});
  }
  function startSearch(arm){
    if(arm!==ARM||searchProbe)return report("search","rejected",null);
    let s=null;
    try{
      const w=Services.wm.getMostRecentWindow("navigator:browser"),bar=w?.gURLBar,ui=w?.gZenUIManager;
      const parent=bar?.parentController,browser=w?.gBrowser,manager=w?.gZenWorkspaces;
      if(!eligibleWindow(w)||!bar||bar.hasAttribute("zen-newtab")||
         typeof ui?.handleNewTab!=="function"||typeof ui._isOwner!=="function"||
         typeof ui.matchesCloseToken!=="function"||parent?.browserWindow!==w||
         parent.rendersInContentProcess!==false||typeof parent.loadURL!=="function"||
         Object.hasOwn(parent,"loadURL")||typeof browser?.getTabForBrowser!=="function"||
         typeof browser.isTab!=="function")return report("search","unsupported",null);
      s={w,bar,ui,parent,browser,manager,workspace:manager.activeWorkspace,token:{},
        cleanup:[],loads:0,callbacks:0,exact:false};
      const current=()=>searchProbe===s&&eligibleWindow(w)&&w.gURLBar===bar&&w.gZenUIManager===ui&&
        w.gBrowser===browser&&w.gZenWorkspaces===manager&&manager.activeWorkspace===s.workspace&&
        bar.parentController===parent&&Number.isSafeInteger(s.token.id)&&ui._isOwner(s.token.id)&&
        bar.hasAttribute("zen-newtab");
      const releasePick=shadow(bar,"pickResult",original=>function(...args){
        if(searchProbe!==s||this!==bar)return Reflect.apply(original,this,args);
        // A buffered or old asynchronous input is not a current dispatch.
        const event=args[0]?.event;
        let releaseLoad=null,active=false,before=null,ownerAtLoad=false;
        try{
          if(!current()||event?.isTrusted!==true||!event.eventPhase){
            finishSearch(s,"uncorrelated");
          }else{
            before=new Set([...browser.tabs,...manager.allStoredTabs]);
            releaseLoad=shadow(parent,"loadURL",load=>function(...loadArgs){
              if(!active||this!==parent||!current())return Reflect.apply(load,this,loadArgs);
              const request=loadArgs[0],params=request?.params;
              s.loads++;
              if(s.loads!==1||!["tab","tabshifted"].includes(request?.where)||!params||
                 "resolveOnNewTabCreated" in params||!Object.isExtensible(params))
                return Reflect.apply(load,this,loadArgs);
              ownerAtLoad=true;
              const callback=target=>{
                if(!active||searchProbe!==s)return;
                s.callbacks++;
                try{
                  const tab=browser.getTabForBrowser(target);
                  s.exact=s.callbacks===1&&!!tab&&!before.has(tab)&&browser.isTab(tab)&&
                    tab.linkedBrowser===target&&tab.ownerDocument?.defaultView===w&&
                    !tab.closing&&tab.isConnected;
                }catch{s.exact=false;}
              };
              // Exact call only. Preserve any foreign callback; never
              // replace resolveOnContentBrowserCreated (native telemetry).
              try{Object.defineProperty(params,"resolveOnNewTabCreated",{value:callback,configurable:true,writable:true,enumerable:true});}
              catch{return Reflect.apply(load,this,loadArgs);}
              try{return Reflect.apply(load,this,loadArgs);}
              finally{
                try{
                  const d=Object.getOwnPropertyDescriptor(params,"resolveOnNewTabCreated");
                  if(d?.value!==callback||!d.configurable||!delete params.resolveOnNewTabCreated)s.exact=false;
                }catch{s.exact=false;}
              }
            });
            if(!releaseLoad)finishSearch(s,"unsupported");
            else active=true;
          }
        }catch{
          if(releaseLoad)try{releaseLoad();}catch{}
          releaseLoad=null;active=false;finishSearch(s,"unsupported");
        }
        let completed=false;
        try{
          const result=Reflect.apply(original,this,args);
          completed=true;
          return result;
        }finally{
          active=false;
          let released=true;
          if(releaseLoad)try{released=releaseLoad();}catch{released=false;}
          if(searchProbe===s)finishSearch(s,!released?"cleanup-failed":
            completed&&ownerAtLoad&&s.loads===1&&s.callbacks===1&&s.exact?"observed":"uncorrelated");
        }
      });
      if(!releasePick)return report("search","unsupported",null);
      s.cleanup.push(releasePick);searchProbe=s;lastSearch=null;
      const closed=event=>{
        try{if(ui.matchesCloseToken(s.token,event))finishSearch(s,"closed");}catch{finishSearch(s,"uncorrelated");}
      };
      const unload=event=>{if(event.target===w||event.target===w.document)finishSearch(s,"unloaded");};
      s.cleanup.push(()=>w.removeEventListener("ZenURLBarClosed",closed));
      w.addEventListener("ZenURLBarClosed",closed);
      s.cleanup.push(()=>w.removeEventListener("unload",unload));
      w.addEventListener("unload",unload);
      // Test-only lifetime cap. Never cancels the native search or creates
      // a tab; merely detaches this explicitly armed instrumentation.
      const timer=w.setTimeout(()=>finishSearch(s,"expired"),120000);
      s.cleanup.push(()=>w.clearTimeout(timer));
      const handled=ui.handleNewTab(false,false,"tab",false,s.token);
      if(!handled||!current()){
        finishSearch(s,"unsupported");
        return JSON.stringify({stage:"search",status:"unsupported"});
      }
      return report("search","armed",s);
    }catch{
      if(s)finishSearch(s,"unsupported");
      return report("search","unsupported",null);
    }
  }
  return Object.freeze({
    startSearch,stopSearch,
    searchResult:()=>JSON.stringify(lastSearch??{stage:"search",status:searchProbe?"armed":"inactive"}),
    snapshot,
    write:(side,arm)=>mutate("write",side,arm),
    clear:arm=>mutate("clear","",arm),
  });
})();
