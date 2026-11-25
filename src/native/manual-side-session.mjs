// ML2a source-only candidate. Native SessionStore remains the only
// persistent owner. Cohorts and value witnesses are transaction-local.
import {readWorkspaceOwnership} from "../core/workspace-commands.mjs";
export const MANUAL_SIDE_KEY="nocturne.manual-side.v1";
const sideValid=v=>v==="left"||v==="right";
const regular=t=>!!t&&!t.closing&&t.isConnected&&!t.pinned&&!t.group&&!t.splitView&&
  !["zen-empty-tab","zen-essential","zen-glance-tab","split-view"].some(k=>t.hasAttribute(k));

// Staging scope: ordinary tabs in ready nonprivate synced-capable windows.
// Excluded roles are not a final product decision.
export function captureManualSideCohort({source,sessionStore,prefs,getWindows,isPrivate}){
  try{
    const owner=source?.ownerDocument?.defaultView,id=source?.id,workspace=source?.getAttribute("zen-workspace-id");
    const ready=w=>w?.gZenStartup?.isReady===true&&w.gZenWorkspaces?.workspaceEnabled===true&&
      w.gZenWorkspaces.currentWindowIsSyncing===true&&!w.gZenWorkspaces.isChangingWorkspace&&
      !!sessionStore.getWindowId(w)&&!!w.gZenWindowSync;
    if(!owner||owner.closed||owner._zenClosingWindow||isPrivate(owner)!==false||
       !ready(owner)||!regular(source)||typeof id!=="string"||!id||typeof workspace!=="string"||!workspace)return null;
    const syncAll=prefs.getBoolPref("zen.window-sync.enabled",true)&&
      !prefs.getBoolPref("zen.window-sync.sync-only-pinned-tabs",true);
    const windows=syncAll?Array.from(getWindows()):[owner];
    if(new Set(windows).size!==windows.length||!windows.includes(owner))return null;
    const copies=[];
    for(const win of windows){
      if(!win||win.closed||win._zenClosingWindow)continue;
      const privacy=isPrivate(win);
      if(privacy===true)continue;
      if(privacy!==false)return null;
      const manager=win.gZenWorkspaces;
      if(manager?.privateWindowOrDisabled===true)continue;
      if(!ready(win)||win.gZenWindowSync!==owner.gZenWindowSync)return null;
      const ownership=readWorkspaceOwnership(win,manager,workspace,{fresh:true});
      if(!ownership)return null;
      const candidates=ownership.tabs.filter(t=>t.id===id);
      const tab=win.document.getElementById(id);
      if(candidates.length!==1||candidates[0]!==tab||!regular(tab)||
         tab.ownerDocument?.defaultView!==win||!ownership.normal.contains(tab)||
         tab.userContextId!==source.userContextId||(win===owner&&tab!==source))return null;
      copies.push({tab,win,manager,id,workspace});
    }
    return copies.some(c=>c.tab===source)?copies:null;
  }catch{return null;}
}
function sameCohort(a,b){
  if(!a||!b||a.length!==b.length)return false;
  const byTab=new Map(b.map(c=>[c.tab,c]));
  return byTab.size===b.length&&a.every(c=>{
    const x=byTab.get(c.tab);
    return x&&x.win===c.win&&x.manager===c.manager&&x.id===c.id&&x.workspace===c.workspace;
  });
}
function readValues(store,copies){return copies.map(c=>store.getCustomTabValue(c.tab,MANUAL_SIDE_KEY));}
function status(values){
  if(values.some(v=>v!==""&&!sideValid(v)))return "invalid";
  const sides=new Set(values.filter(sideValid));
  return sides.size>1?"conflict":!sides.size?"missing":values.includes("")?"incomplete":"confirmed";
}
export function inspectManualSide(context){
  try{
    if(typeof context.sessionStore?.getCustomTabValue!=="function")return {status:"unavailable"};
    const copies=captureManualSideCohort(context);
    if(!copies)return {status:"unavailable"};
    const values=readValues(context.sessionStore,copies);
    if(!sameCohort(copies,captureManualSideCohort(context))||
       !readValues(context.sessionStore,copies).every((v,i)=>v===values[i]))return {status:"stale"};
    const state=status(values);
    return {status:state,side:state==="confirmed"?values[0]:null,copies,values};
  }catch{return {status:"unavailable"};}
}
// Only an explicit current command can write. No automatic conflict
// repair, rollback, retries or full native tab-state replacement.
export function commitManualSide(context,expected,side,owns){
  let written=0;
  const result=(status,count=0)=>({status,written,count});
  if(!sideValid(side)||!expected?.copies||!Array.isArray(expected.values)||
     typeof owns!=="function"||typeof context.sessionStore?.setCustomTabValue!=="function")return result("rejected");
  const store=context.sessionStore,copies=expected.copies,count=copies.length;
  const current=()=>owns()&&sameCohort(copies,captureManualSideCohort(context))&&owns();
  try{
    if(!count||expected.values.length!==count||status(expected.values)==="invalid"||!current()||
       !readValues(store,copies).every((v,i)=>v===expected.values[i]))return result("rejected",count);
    const desired=expected.values.slice();
    for(let i=0;i<count;i++){
      if(!current()||!readValues(store,copies).every((v,j)=>v===desired[j]))return result(written?"partial":"stale",count);
      if(desired[i]===side)continue;
      // A setter can throw after mutating; count only returned writes.
      store.setCustomTabValue(copies[i].tab,MANUAL_SIDE_KEY,side);
      written++;desired[i]=side;
    }
    if(!current()||!readValues(store,copies).every(v=>v===side))return result("unverified",count);
    return result("confirmed",count);
  }catch{return result("unverified",count);}
}
