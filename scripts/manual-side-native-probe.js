/* Manual Mirror Layout native evidence probe. Developer-only Browser Console
 * script, NOT a Sine entrypoint. Review before pasting; use a disposable Zen
 * profile. Loading this script performs no native writes or listener setup.
 * Only the separate probe key may be set/deleted by explicit commands. */
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
  return Object.freeze({
    snapshot,
    write:(side,arm)=>mutate("write",side,arm),
    clear:arm=>mutate("clear","",arm),
  });
})();
