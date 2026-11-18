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
export function workspaceCommandGate(win){
  if(win[WORKSPACE_GATE])return win[WORKSPACE_GATE];
  // Allocate in the target chrome realm when possible. A peer reservation
  // must not turn its gate into an object owned by a closing child realm.
  const gate=typeof win.Object==="function"?new win.Object():{};
  gate.pending=null;
  return win[WORKSPACE_GATE]??(win[WORKSPACE_GATE]=gate);
}
// A reservation is a primitive on the surviving peer's existing gate;
// never retain a destroyed child Window/Promise in that peer.
const WORKSPACE_PENDING_NOTICE=5000;
function workspaceCommandNow(win){
  try{const p=win.performance,t=p?.timeOrigin+p?.now();if(Number.isFinite(t))return t;}catch{}
  return Date.now();
}
export function workspacePendingState(startedAt,now,reserved=false,projection=false){
  const remaining=Number.isFinite(startedAt)?Math.max(0,Math.min(WORKSPACE_PENDING_NOTICE,WORKSPACE_PENDING_NOTICE-(now-startedAt))):0;
  return {blocked:true,phase:remaining?"pending":"unknown",remaining,reserved,projection};
}
export function workspaceCommandState(win,now=workspaceCommandNow(win)){
  try{
    const gate=win[WORKSPACE_GATE],reserved=!!gate?.reservation;
    if(gate?.pending||gate?.owner||reserved){
      return workspacePendingState(gate.startedAt,now,reserved);
    }
    if(win.gZenWorkspaces?.isChangingWorkspace===true)return {blocked:true,phase:"native-busy",remaining:0,reserved:false};
    return {blocked:false,phase:"idle",remaining:0,reserved:false};
  }catch{return {blocked:true,phase:"unknown",remaining:0,reserved:false};}
}
function notifyWorkspaceCommand(win){
  try{if(!win.closed)win.dispatchEvent(new win.CustomEvent("Nocturne:WorkspaceCommandChanged"));}catch{}
}
// Native-only busy has no Nocturne lease to observe on settlement.
// Keep controls retryable; their real command preflight still fails closed.
export function workspaceCommandPresentationBlocked(state){return state.blocked&&state.phase!=="native-busy";}
export function workspaceCommandMessage(state){
  if(state.projection)return state.phase==="unknown"?
    "Synced window setup is still pending. You can close this panel; interact with the new window to stop automatic setup.":
    "Opening a synced window…";
  if(state.phase==="pending")return state.reserved?"Returning a synced window…":"Workspace command in progress…";
  if(state.phase==="unknown")return "Native command is still pending. You can close this panel; workspace commands remain blocked. If it never settles, restart Zen.";
  if(state.phase==="native-busy")return "Zen is changing workspace. Try again when ready.";
  return "";
}
// Presentation observes the existing gate; timeout changes the message,
// not admission or ownership. No persistent polling, no promise race.
export function watchWorkspaceCommand(win,active,update,read=()=>workspaceCommandState(win)){
  let disposed=false,timer=0,generation=0,lastPhase=null,nativeDeadline=null;
  const refresh=()=>{
    const token=++generation;
    if(timer)try{win.clearTimeout(timer);}catch{}
    timer=0;if(disposed||!active()){lastPhase=null;nativeDeadline=null;return;}
    let state;
    try{state=read();}catch{commandTrace(win,"presentation-error",{});return;}
    // Zen emits UI updates before its native isChangingWorkspace flag
    // clears. Probe only within a bounded visible-view interval, not for
    // the lifetime of a native command.
    if(state.phase==="native-busy"){
      nativeDeadline??=workspaceCommandNow(win)+WORKSPACE_PENDING_NOTICE;
    }else nativeDeadline=null;
    if(state.phase!==lastPhase){
      lastPhase=state.phase;
      if(state.phase==="unknown")commandTrace(win,"presentation-unknown",{reserved:state.reserved,projection:!!state.projection});
    }
    if(disposed||generation!==token||!active())return;
    try{update(state);}catch{commandTrace(win,"presentation-error",{});}
    if(disposed||generation!==token||!active())return;
    const remaining=state.phase==="native-busy"?Math.min(250,Math.max(0,nativeDeadline-workspaceCommandNow(win))):state.remaining;
    if(!remaining)return;
    try{timer=win.setTimeout(()=>{if(!disposed&&generation===token){timer=0;refresh();}},Math.ceil(remaining));}catch{}
  };
  const dispose=()=>{
    if(disposed)return;disposed=true;generation++;
    if(timer)try{win.clearTimeout(timer);}catch{}timer=0;
    try{win.removeEventListener("Nocturne:WorkspaceCommandChanged",refresh);}catch{}
  };
  try{win.addEventListener("Nocturne:WorkspaceCommandChanged",refresh);}catch(error){dispose();throw error;}
  return {refresh,dispose};
}
export function requireWorkspaceCommand(win,native,lease){
  if(!lease||lease.native!==native||lease.win!==win||workspaceCommandGate(win).owner!==lease||
    win.closed||win.gZenWorkspaces!==native||!native?.workspaceEnabled||!lease.current())
    throw workspaceCommandError("stale","Workspace command is no longer current.");
  // current() may synchronously re-enter through native getters or a
  // lifecycle callback. Validate exact ownership again after it returns.
  const gate=workspaceCommandGate(win);
  if(gate.owner!==lease||gate.pending!==lease.pending||!gate.pending||gate.reservation||win.closed||win.gZenWorkspaces!==native)
    throw workspaceCommandError("stale");
  if(lease.token&&lease.anchor[WORKSPACE_DATA_GATE]!==lease.token)throw workspaceCommandError("data-lease-lost");
  if(lease.peer&&(!lease.peer.win||lease.peer.win.closed||lease.peer.win.gZenWorkspaces!==lease.peer.native||
    !lease.peer.native?.workspaceEnabled||lease.peer.native.isChangingWorkspace!==false||
    workspaceCommandGate(lease.peer.win)!==lease.peer.gate||lease.peer.gate.reservation!==lease.token))
    throw workspaceCommandError("peer-lease-lost");
  if(native.isChangingWorkspace!==false)throw workspaceCommandError("native-busy","Native Workspace switch is still in progress.");
  if(workspaceCommandGate(win)!==gate||gate.owner!==lease||gate.pending!==lease.pending||
    gate.reservation||win.closed||win.gZenWorkspaces!==native)
    throw workspaceCommandError("stale");
  if(lease.token&&lease.anchor[WORKSPACE_DATA_GATE]!==lease.token)throw workspaceCommandError("data-lease-lost");
  // A later native getter can replace the peer manager or its entire gate.
  // Read the published gate again; an old reservation alone proves nothing.
  if(lease.peer&&(lease.peer.win.closed||lease.peer.win.gZenWorkspaces!==lease.peer.native||
    lease.peer.win[WORKSPACE_GATE]!==lease.peer.gate||lease.peer.gate.reservation!==lease.token||
    lease.peer.gate.pending||lease.peer.gate.owner))throw workspaceCommandError("peer-lease-lost");
}
export function requireWorkspaceDataCommand(win,native,lease){
  requireWorkspaceCommand(win,native,lease);
  if(!lease.token)throw workspaceCommandError("data-lease-required");
}
export function runWorkspaceCommand(win,native,kind,current,execute,{data=false,anchor=data?dataAnchor():null,peer=null}={}){
  const gate=workspaceCommandGate(win);
  const reject=code=>{commandTrace(win,"rejected",{kind,code});return Promise.reject(workspaceCommandError(code,
    code==="data-busy"?"Another native Workspace data command is pending. If it never settles, restart Zen.":
    "Workspace command is busy or unavailable. Try again when ready."));};
  if(win.closed||win.gZenWorkspaces!==native||!native?.workspaceEnabled||!current())return reject("stale");
  if(gate.pending||gate.owner||gate.reservation)return reject("busy");
  if(native.isChangingWorkspace!==false)return reject("native-busy");
  let peerLease=null;
  if(peer){
    if(!data||!peer.win||peer.win===win||peer.win.closed||peer.win.gZenWorkspaces!==peer.native||
      !peer.native?.workspaceEnabled||peer.native.isChangingWorkspace!==false)return reject("peer-unavailable");
    const peerGate=workspaceCommandGate(peer.win);
    if(peerGate.pending||peerGate.owner||peerGate.reservation)return reject("peer-busy");
    peerLease={win:peer.win,native:peer.native,gate:peerGate};
  }
  const startedAt=workspaceCommandNow(win);
  // Peer admission and clock access can call native getters. Re-read
  // both exact gates immediately before publishing any owner.
  if(workspaceCommandGate(win)!==gate||gate.pending||gate.owner||gate.reservation)return reject("busy");
  if(peerLease&&(workspaceCommandGate(peerLease.win)!==peerLease.gate||peerLease.gate.pending||peerLease.gate.owner||peerLease.gate.reservation))
    return reject("peer-busy");
  const token=data?Symbol("Nocturne data command"):null;
  if(data){
    if(!anchor)return reject("data-unavailable");
    try{
      if(anchor[WORKSPACE_DATA_GATE])return reject("data-busy");
      Object.defineProperty(anchor,WORKSPACE_DATA_GATE,{value:token,configurable:true});
      if(anchor[WORKSPACE_DATA_GATE]!==token)return reject("data-unavailable");
    }catch{return reject("data-unavailable");}
  }
  const lease={win,native,kind,current,anchor,token,peer:peerLease};
  let resolve,rejectResult;const pending=new Promise((a,b)=>{resolve=a;rejectResult=b;});
  lease.pending=pending;
  // Publish both gates before any native/visual callback can re-enter.
  let finished=false;
  const finish=(ok,value)=>{
    if(finished)return;finished=true;
    if(peerLease)try{if(peerLease.gate.reservation===token){delete peerLease.gate.reservation;delete peerLease.gate.startedAt;}}catch{}
    if(data)try{if(anchor[WORKSPACE_DATA_GATE]===token)delete anchor[WORKSPACE_DATA_GATE];}catch{}
    try{
      if((!gate.owner||gate.owner===lease)&&gate.pending===pending){gate.pending=null;delete gate.startedAt;}
      if(gate.owner===lease){
        if(!gate.pending&&gate.startedAt===startedAt)delete gate.startedAt;
        gate.owner=null;
      }
    }catch{}
    commandTrace(win,"end",{kind,ok,peer:!!peerLease,elapsed:Math.max(0,workspaceCommandNow(win)-startedAt),code:ok?null:value?.name==="WorkspaceCommandError"?value.code:"error"});
    notifyWorkspaceCommand(win);if(peerLease)notifyWorkspaceCommand(peerLease.win);
    if(ok)resolve(value);else rejectResult(value);
  };
  try{
    if(workspaceCommandGate(win)!==gate||gate.pending||gate.owner||gate.reservation)throw workspaceCommandError("busy");
    if(peerLease&&(workspaceCommandGate(peerLease.win)!==peerLease.gate||peerLease.gate.pending||peerLease.gate.owner||peerLease.gate.reservation))
      throw workspaceCommandError("peer-busy");
    gate.owner=lease;gate.pending=pending;gate.startedAt=startedAt;
    if(gate.owner!==lease||gate.pending!==pending)throw workspaceCommandError("gate-unavailable");
    if(peerLease){
      peerLease.gate.reservation=token;peerLease.gate.startedAt=startedAt;
      if(peerLease.gate.reservation!==token)throw workspaceCommandError("peer-unavailable");
    }
    commandTrace(win,"begin",{kind,data,peer:!!peerLease});
    notifyWorkspaceCommand(win);if(peerLease)notifyWorkspaceCommand(peerLease.win);
    requireWorkspaceCommand(win,native,lease);
    Promise.resolve(execute(lease)).then(v=>finish(true,v),e=>finish(false,e));
  }catch(error){finish(false,error);}
  return pending;
}
// Read the native Essentials section without calling getEssentialsSection:
// that API may CREATE a container and change its visibility.
export function workspaceEssentialSection(win,native,tab){
  try{
    if(tab.getAttribute("zen-essential")!=="true"||!tab.pinned)return null;
    const context=Number(tab.getAttribute("usercontextid")||0);
    if(!Number.isSafeInteger(context)||context<0)return null;
    const expected=String(native.containerSpecificEssentials?context:0);
    const sections=Array.from(win.document.querySelectorAll("#zen-essentials .zen-workspace-tabs-section"));
    const containing=sections.filter(section=>section.isConnected&&section.contains(tab));
    return containing.length===1&&containing[0].getAttribute("container")===expected?containing[0]:null;
  }catch{return null;}
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
      !element.pinnedTabsContainer?.isConnected||!element.scrollbox||!Array.isArray(spaces)||
      spaces.some(s=>!s?.uuid)||new Set(spaces.map(s=>s.uuid)).size!==spaces.length)return "container-unready";
    if(!spaces.some(s=>s.uuid===id)||element.tabsContainer===element.pinnedTabsContainer||
      spaces.some(s=>{const node=native.workspaceElement(s.uuid);return !node?.isConnected||!!node.active!==(s.uuid===id);}))return "container-mismatch";
    const browser=win.gBrowser,tc=browser?.tabContainer,tab=browser?.selectedTab;
    if(!tc||tc.arrowScrollbox!==element.scrollbox||tc.pinnedTabsContainer!==element.pinnedTabsContainer||
      browser.pinnedTabsContainer!==element.pinnedTabsContainer)return "binding-mismatch";
    if(!tab?.isConnected||tab.closing)return "selection-unverified";
    const empty=tab===native._emptyTab&&tab.hasAttribute("zen-empty-tab");
    if(!empty&&!Array.from(browser.visibleTabs||[]).includes(tab))return "selection-unverified";
    // Glance is physically nested under its parent and Zen's visibility
    // predicate intentionally always returns true for a Glance child.
    // Prove the parent's workspace rather than accepting any visible child.
    let owner=tab;
    if(tab.hasAttribute("zen-glance-tab")){
      owner=tab.parentNode?.closest?.(".tabbrowser-tab");
      const glanceId=tab.getAttribute("glance-id");
      if(!owner||owner===tab||!owner.isConnected||owner.closing||owner.hasAttribute("zen-glance-tab")||
        !glanceId||owner.getAttribute("glance-id")!==glanceId||!owner.contains(tab)||
        (typeof browser.isTab==="function"&&!browser.isTab(owner)))return "selection-mismatch";
    }
    const essential=owner.getAttribute("zen-essential")==="true";
    if(essential){
      if(!workspaceEssentialSection(win,native,owner))return "selection-mismatch";
      if(native.containerSpecificEssentials){
        const context=Number(owner.getAttribute("usercontextid")||0),space=native.getWorkspaceFromId(id),target=Number(space.containerTabId||0);
        if(target?target!==context:context!==0&&spaces.some(s=>Number(s.containerTabId||0)===context))return "selection-mismatch";
      }
    }else{
      if(owner.hasAttribute("zen-essential")||owner.getAttribute("zen-workspace-id")!==id)return "selection-mismatch";
      // Native Zen places the outermost folder/group by its own pin role,
      // which can differ from an individual member tab. A Glance child
      // was resolved to its parent above. Verify the exact physical chain.
      let item=owner;const seen=new Set([owner]);
      for(let group=owner.group;group;group=group.group){
        if(seen.has(group)||!group.isConnected||!group.contains(item))return "selection-mismatch";
        seen.add(group);item=group;
      }
      const normal=element.tabsContainer,pinned=element.pinnedTabsContainer;
      const expected=item.pinned?pinned:normal,other=item.pinned?normal:pinned;
      if(!expected.contains(owner)||!expected.contains(item)||other.contains(owner)||other.contains(item))return "selection-mismatch";
    }
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
    const normalTabs=Array.from(normal.querySelectorAll(".tabbrowser-tab")),pinnedTabs=Array.from(pinned.querySelectorAll(".tabbrowser-tab"));
    const physical=[...normalTabs,...pinnedTabs];
    if(normalTabs.some(t=>t.pinned)||pinnedTabs.some(t=>!t.pinned))return null;
    if(new Set(physical).size!==physical.length||physical.some(t=>!browser.isTab(t)||!t.isConnected))return null;
    // Essentials are not supposed to live in these containers. Only the
    // exact native empty placeholder can be ignored by this safety guard.
    if(physical.some(t=>t.hasAttribute("zen-essential")||
      (!workspaceOwned(t)&&(t!==native._emptyTab||!t.hasAttribute("zen-empty-tab")))))return null;
    const owned=physical.filter(workspaceOwned);
    if(owned.some(t=>t.getAttribute("zen-workspace-id")!==id))return null;
    const listed=cached.filter(t=>t.getAttribute("zen-workspace-id")===id);
    if(listed.some(t=>!workspaceOwned(t)&&!t.hasAttribute("zen-essential")&&t!==native._emptyTab))return null;
    const listedOwned=listed.filter(workspaceOwned);
    if(!sameWorkspaceTabs(owned,listedOwned))return null;
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
