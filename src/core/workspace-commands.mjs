/* Nocturne mod-origin native command boundary. Zen remains authoritative.
 * Window lease survives visual/entrypoint reload; data mutations additionally
 * use a process-local primitive token on the native module identity. */
const WORKSPACE_GATE="__nocturneWorkspaceCommandGate";
const WORKSPACE_DATA_GATE=Symbol.for("nocturne.workspace.data-command.v1");
export function workspaceCommandError(code,message="Workspace command could not be confirmed."){
  const error=new Error(message);error.name="WorkspaceCommandError";error.code=code;return error;
}
function commandTrace(win,event,data){try{win.__nocturneTrace?.("workspace.command."+event,data,{flush:true});}catch{}}
function dataAnchor(){
  try{return ChromeUtils.importESModule("resource:///modules/BrowserWindowTracker.sys.mjs").BrowserWindowTracker;}catch{return null;}
}
export function workspaceCommandGate(win){return win[WORKSPACE_GATE]??(win[WORKSPACE_GATE]={pending:null});}
export function requireWorkspaceCommand(win,native,lease){
  if(!lease||lease.native!==native||lease.win!==win||workspaceCommandGate(win).owner!==lease||
    win.closed||win.gZenWorkspaces!==native||!native?.workspaceEnabled||!lease.current())
    throw workspaceCommandError("stale","Workspace command is no longer current.");
  if(lease.token&&lease.anchor[WORKSPACE_DATA_GATE]!==lease.token)throw workspaceCommandError("data-lease-lost");
  if(native.isChangingWorkspace!==false)throw workspaceCommandError("native-busy","Native Workspace switch is still in progress.");
}
export function requireWorkspaceDataCommand(win,native,lease){
  requireWorkspaceCommand(win,native,lease);
  if(!lease.token)throw workspaceCommandError("data-lease-required");
}
export function runWorkspaceCommand(win,native,kind,current,execute,{data=false,anchor=data?dataAnchor():null}={}){
  const gate=workspaceCommandGate(win);
  const reject=code=>{commandTrace(win,"rejected",{kind,code});return Promise.reject(workspaceCommandError(code,"Workspace command is busy or unavailable. Try again when ready."));};
  if(win.closed||win.gZenWorkspaces!==native||!native?.workspaceEnabled||!current())return reject("stale");
  if(gate.pending||gate.owner)return reject("busy");
  if(native.isChangingWorkspace!==false)return reject("native-busy");
  const token=data?Symbol("Nocturne data command"):null;
  if(data){
    if(!anchor)return reject("data-unavailable");
    try{
      if(anchor[WORKSPACE_DATA_GATE])return reject("data-busy");
      Object.defineProperty(anchor,WORKSPACE_DATA_GATE,{value:token,configurable:true});
      if(anchor[WORKSPACE_DATA_GATE]!==token)return reject("data-unavailable");
    }catch{return reject("data-unavailable");}
  }
  const lease={win,native,kind,current,anchor,token};
  let resolve,rejectResult;const pending=new Promise((a,b)=>{resolve=a;rejectResult=b;});
  // Publish before any native/visual callback can synchronously re-enter.
  gate.owner=lease;gate.pending=pending;
  const finish=(ok,value)=>{
    if(data)try{if(anchor[WORKSPACE_DATA_GATE]===token)delete anchor[WORKSPACE_DATA_GATE];}catch{}
    if(gate.owner===lease&&gate.pending===pending){gate.owner=null;gate.pending=null;}
    commandTrace(win,"end",{kind,ok,code:ok?null:value?.name==="WorkspaceCommandError"?value.code:"error"});
    if(ok)resolve(value);else rejectResult(value);
  };
  try{
    commandTrace(win,"begin",{kind,data});
    requireWorkspaceCommand(win,native,lease);
    Promise.resolve(execute(lease)).then(v=>finish(true,v),e=>finish(false,e));
  }catch(error){finish(false,error);}
  return pending;
}
// Only read authoritative native structure. _shouldShowTab is NOT a safe
// predicate for unassigned tabs: Zen can move them as a side effect.
export function inspectWorkspaceSwitch(win,native,id){
  try{
    if(win.closed||win.gZenWorkspaces!==native||!native?.workspaceEnabled)return "stale";
    if(native.isChangingWorkspace!==false)return "native-busy";
    if(!native.getWorkspaceFromId(id)||native.activeWorkspace!==id)return "active-mismatch";
    const element=native.workspaceElement(id),spaces=native.getWorkspaces();
    if(!element?.isConnected||!element.active||!element.tabsContainer?.isConnected||
      !element.pinnedTabsContainer?.isConnected||!element.scrollbox||!Array.isArray(spaces))return "container-unready";
    if(spaces.some(s=>{const node=native.workspaceElement(s.uuid);return !node?.isConnected||!!node.active!==(s.uuid===id);}))return "container-mismatch";
    const browser=win.gBrowser,tc=browser?.tabContainer,tab=browser?.selectedTab;
    if(!tc||tc.arrowScrollbox!==element.scrollbox||tc.pinnedTabsContainer!==element.pinnedTabsContainer||
      browser.pinnedTabsContainer!==element.pinnedTabsContainer)return "binding-mismatch";
    if(!tab?.isConnected||tab.closing)return "selection-unverified";
    const empty=tab===native._emptyTab&&tab.hasAttribute("zen-empty-tab");
    if(!empty&&!Array.from(browser.visibleTabs||[]).includes(tab))return "selection-unverified";
    const essential=tab.getAttribute("zen-essential")==="true",glance=tab.hasAttribute("zen-glance-tab");
    if(essential&&!glance&&native.containerSpecificEssentials){
      const context=tab.getAttribute("usercontextid")||"0",space=native.getWorkspaceFromId(id);
      if(space.containerTabId?String(space.containerTabId)!==context:context!=="0"&&spaces.some(s=>s.containerTabId===Number(context)))return "selection-mismatch";
    }
    if(!essential&&!glance&&(tab.getAttribute("zen-workspace-id")!==id||
      !(element.tabsContainer.contains(tab)||element.pinnedTabsContainer.contains(tab))))return "selection-mismatch";
    return "confirmed";
  }catch{return "inspection-error";}
}
export const switchWorkspaceWithin=async function(win,native,id,lease,{motion=false}={}){
  const verify=()=>{
    requireWorkspaceCommand(win,native,lease);
    const outcome=inspectWorkspaceSwitch(win,native,id);
    commandTrace(win,"switch-result",{kind:lease.kind,outcome});
    if(outcome!=="confirmed")throw workspaceCommandError(outcome);
    return {status:"confirmed"};
  };
  requireWorkspaceCommand(win,native,lease);
  if(!native.getWorkspaceFromId(id)||typeof native.changeWorkspaceWithID!=="function")throw workspaceCommandError("missing-target");
  if(native.activeWorkspace===id)return verify();
  const invoke=async()=>{
    requireWorkspaceCommand(win,native,lease);
    if(!native.getWorkspaceFromId(id))throw workspaceCommandError("missing-target");
    if(native.activeWorkspace!==id)await native.changeWorkspaceWithID(id);
    // Fulfilled native promise and ID alone do not certify a native switch.
    return verify();
  };
  const transition=motion?win.__zenRefinedWorkspaceTransition:null;
  const result=await (typeof transition?.run==="function"?transition.run(invoke,{lease}):invoke());
  if(result?.status!=="confirmed")throw workspaceCommandError("not-started");
  return verify();
}
export function requestWorkspaceSwitch(win,native,id,kind,current,{motion=true}={}){
  return runWorkspaceCommand(win,native,kind,current,lease=>switchWorkspaceWithin(win,native,id,lease,{motion}));
}
const FREE_ROLE="zen.oneplane.free-space-id",TRASH_ROLE="zen.oneplane.trash-space-id";
export const designateWorkspaceFree=async function(win,native,prefs,lease,id=null){
  requireWorkspaceDataCommand(win,native,lease);
  const previous=prefs.getStringPref(FREE_ROLE,""),trash=prefs.getStringPref(TRASH_ROLE,"");
  if(previous&&native.getWorkspaceFromId(previous))throw workspaceCommandError("free-exists","Free is already designated.");
  // Automatic creation must not silently claim an ambiguous existing Free.
  if(!id&&native.getWorkspaces().some(s=>String(s.name||"").trim().toLowerCase()==="free"))
    throw workspaceCommandError("free-ambiguous","Choose the existing Free workspace manually.");
  const ws=id?native.getWorkspaceFromId(id):await native.createAndSaveWorkspace("Free","⌂",true);
  requireWorkspaceCommand(win,native,lease);
  const valid=()=>ws?.uuid&&ws.uuid!==prefs.getStringPref(TRASH_ROLE,"")&&
    !!native.getWorkspaceFromId(ws.uuid);
  const beforeRole=()=>valid()&&prefs.getStringPref(FREE_ROLE,"")===previous&&prefs.getStringPref(TRASH_ROLE,"")===trash;
  if(!beforeRole())throw workspaceCommandError("free-changed");
  if(id){
    if(typeof native.saveWorkspace!=="function")throw workspaceCommandError("rename-unavailable");
    native.saveWorkspace({...ws,name:"Free"});
    requireWorkspaceCommand(win,native,lease);
    if(!beforeRole()||native.getWorkspaceFromId(ws.uuid)?.name!=="Free")throw workspaceCommandError("free-changed");
  }
  prefs.setStringPref(FREE_ROLE,ws.uuid);
  requireWorkspaceCommand(win,native,lease);
  const owns=()=>valid()&&prefs.getStringPref(FREE_ROLE,"")===ws.uuid;
  if(!owns())throw workspaceCommandError("free-changed");
  if(typeof native.reorderWorkspace==="function")await native.reorderWorkspace(ws.uuid,0);
  requireWorkspaceCommand(win,native,lease);
  if(!owns())throw workspaceCommandError("free-changed");
  if(typeof native.reorderWorkspace==="function"&&native.getWorkspaces()[0]?.uuid!==ws.uuid)throw workspaceCommandError("free-order-unverified","Free was designated but its order could not be confirmed.");
  return ws.uuid;
}

/* Destructive operations: reconcile exact native identity with physical
 * membership. No shadow tab store, no automatic retry or rollback. */
function workspaceOwned(tab){
  return !tab.hasAttribute("zen-essential")&&!(tab.hasAttribute("zen-empty-tab")&&!tab.group);
}
function sameWorkspaceTabs(a,b){
  if(!Array.isArray(a)||!Array.isArray(b)||a.length!==b.length)return false;
  const listed=new Set(b);
  return listed.size===a.length&&new Set(a).size===a.length&&a.every(t=>listed.has(t));
}
export function readWorkspaceOwnership(win,native,id,{fresh=false}={}){
  try{
    if(win.closed||win.gZenWorkspaces!==native||!native?.workspaceEnabled||!native.getWorkspaceFromId(id))return null;
    const browser=win.gBrowser,element=native.workspaceElement(id),normal=element?.tabsContainer,pinned=element?.pinnedTabsContainer;
    if(!element?.isConnected||!normal?.isConnected||!pinned?.isConnected||normal===pinned||!browser?.isTab)return null;
    if(fresh){
      if(typeof browser.tabContainer?._invalidateCachedTabs!=="function")return null;
      browser.tabContainer._invalidateCachedTabs();
    }
    const cached=native.allStoredTabs;
    if(!Array.isArray(cached))return null;
    const physical=[...normal.querySelectorAll(".tabbrowser-tab"),...pinned.querySelectorAll(".tabbrowser-tab")];
    if(new Set(physical).size!==physical.length||physical.some(t=>!browser.isTab(t)||!t.isConnected))return null;
    // Essentials are not supposed to live in these containers. Only the
    // exact native empty placeholder can be ignored by this safety guard.
    if(physical.some(t=>t.hasAttribute("zen-essential")||
      (!workspaceOwned(t)&&(t!==native._emptyTab||!t.hasAttribute("zen-empty-tab")))))return null;
    const owned=physical.filter(workspaceOwned);
    if(owned.some(t=>t.getAttribute("zen-workspace-id")!==id))return null;
    const listed=cached.filter(t=>workspaceOwned(t)&&t.getAttribute("zen-workspace-id")===id);
    if(!sameWorkspaceTabs(owned,listed))return null;
    return {element,normal,pinned,tabs:owned,browser};
  }catch{return null;}
}
export function inspectWorkspaceTabMove(win,native,tab,source,destination){
  try{
    const from=readWorkspaceOwnership(win,native,source,{fresh:true}),to=readWorkspaceOwnership(win,native,destination);
    if(!from||!to||from.browser!==to.browser||!tab.isConnected||!from.browser.isTab(tab)||tab.closing)return "unknown";
    const id=tab.getAttribute("zen-workspace-id"),target=tab.pinned?to.pinned:to.normal,origin=tab.pinned?from.pinned:from.normal;
    if(id===destination&&to.tabs.includes(tab)&&target.contains(tab)&&!from.tabs.includes(tab))return "confirmed";
    if(id===source&&from.tabs.includes(tab)&&origin.contains(tab)&&!to.tabs.includes(tab))return "retained";
    return "unknown";
  }catch{return "unknown";}
}
export function inspectWorkspaceTabRemoval(win,native,tab,source,browser){
  try{
    if(win.gBrowser!==browser||win.gZenWorkspaces!==native||win.closed)return "unknown";
    const owned=readWorkspaceOwnership(win,native,source,{fresh:true});
    if(!owned||owned.browser!==browser)return "unknown";
    if(tab.isConnected&&!tab.closing&&owned.tabs.includes(tab))return "retained";
    if(!tab.isConnected&&tab.linkedBrowser===null&&!owned.tabs.includes(tab)&&!native.allStoredTabs.includes(tab))return "confirmed";
    return "unknown";
  }catch{return "unknown";}
}
export function workspaceTabJournal(tabs,step){
  const result={planned:tabs.length,attempted:0,confirmed:0,retained:0,unknown:0,notAttempted:tabs.length,reason:null};
  for(const tab of tabs){
    let outcome;
    try{outcome=step(tab);}catch{outcome={attempted:false,state:"unknown",reason:"preflight-error"};}
    if(outcome.attempted){
      result.attempted++;result.notAttempted--;
      result[outcome.state==="confirmed"||outcome.state==="retained"?outcome.state:"unknown"]++;
    }
    if(!outcome.attempted||outcome.state!=="confirmed"||outcome.reason){
      result.reason=outcome.reason||"unconfirmed";break;
    }
  }
  return result;
}
export function workspaceJournalComplete(result){
  return result.confirmed===result.planned&&!result.reason;
}

export function inspectWorkspaceDeletion(win,native,id,roles,browser){
  try{
    if(win.closed||win.gZenWorkspaces!==native||win.gBrowser!==browser||!native.workspaceEnabled||
      native.isChangingWorkspace!==false||id===roles.free||id===roles.trash)return "unknown";
    // getWorkspaceFromId swallows native lookup failures. Require an
    // actual authoritative list rather than interpreting null as absence.
    const spaces=native.getWorkspaces();
    if(!Array.isArray(spaces)||spaces.some(s=>!s?.uuid)||new Set(spaces.map(s=>s.uuid)).size!==spaces.length||
      !spaces.some(s=>s.uuid===roles.free)||(roles.trash&&!spaces.some(s=>s.uuid===roles.trash)))return "unknown";
    if(spaces.some(s=>s.uuid===id)||native.workspaceElement(id))return "unknown";
    return "confirmed";
  }catch{return "unknown";}
}
