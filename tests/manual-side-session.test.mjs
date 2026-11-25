import test from "node:test";
import assert from "node:assert/strict";
import {captureManualSideCohort,inspectManualSide,commitManualSide,MANUAL_SIDE_KEY} from "../src/native/manual-side-session.mjs";

function fixture(){
  const sync={},values=new Map(),writes=[],windows=[];
  let enabled=true,onlyPinned=false,owns=true,failAt=0,afterWrite=()=>{};
  function windowWithTab(){
    const win={closed:false,gZenStartup:{isReady:true},gZenWindowSync:sync};
    const normal={isConnected:true,querySelectorAll:()=>[tab],contains:t=>t===tab};
    const pinned={isConnected:true,querySelectorAll:()=>[]};
    const attrs=new Map([["zen-workspace-id","ws"]]);
    const tab={id:"native-id",ownerDocument:{defaultView:win},isConnected:true,pinned:false,userContextId:0,
      hasAttribute:k=>attrs.has(k),getAttribute:k=>attrs.get(k)??null};
    win.gBrowser={isTab:t=>t===tab,tabContainer:{_invalidateCachedTabs(){}}};
    win.gZenWorkspaces={workspaceEnabled:true,currentWindowIsSyncing:true,privateWindowOrDisabled:false,
      getWorkspaceFromId:id=>id==="ws"?{uuid:id}:null,workspaceElement:()=>({isConnected:true,tabsContainer:normal,pinnedTabsContainer:pinned}),
      allStoredTabs:[tab]};
    win.document={getElementById:id=>tab.id===id?tab:null};
    windows.push(win);return {win,tab,attrs};
  }
  const a=windowWithTab(),b=windowWithTab();
  const sessionStore={getWindowId:win=>win.closed?null:"tracked",
    getCustomTabValue(tab,key){assert.equal(key,MANUAL_SIDE_KEY);return values.get(tab)??"";},
    setCustomTabValue(tab,key,value){assert.equal(key,MANUAL_SIDE_KEY);writes.push(tab);values.set(tab,value);
      if(failAt===writes.length)throw Error("after write");afterWrite();}};
  const context={source:a.tab,sessionStore,prefs:{getBoolPref:k=>k==="zen.window-sync.enabled"?enabled:onlyPinned},
    getWindows:()=>windows,isPrivate:win=>win.private===true?true:win.unknownPrivacy?null:false};
  return {a,b,windows,values,writes,context,windowWithTab,owns:()=>owns,
    setPinnedOnly:v=>{onlyPinned=v},setEnabled:v=>{enabled=v},loseOwner:()=>{owns=false},
    failAt:v=>{failAt=v},afterWrite:fn=>{afterWrite=fn}};
}

test("ordinary cohort honors sync-all versus pinned-only or disabled sync",()=>{
  const f=fixture();assert.equal(captureManualSideCohort(f.context).length,2);
  f.setPinnedOnly(true);assert.equal(captureManualSideCohort(f.context).length,1);
  assert.equal(captureManualSideCohort(f.context)[0].tab,f.a.tab);
  f.setPinnedOnly(false);f.setEnabled(false);assert.equal(captureManualSideCohort(f.context).length,1);
});
test("private, unsynced, unknown, pending and wrong-identity peers are not writable cohorts",()=>{
  for(const fault of ["source-private","source-unsynced","source-role","peer-unknown","peer-not-ready","peer-id","peer-workspace","peer-container","peer-manager","peer-cache"]){
    const f=fixture();
    if(fault==="source-private")f.a.win.private=true;
    if(fault==="source-unsynced")f.a.win.gZenWorkspaces.currentWindowIsSyncing=false;
    if(fault==="source-role")f.a.attrs.set("zen-essential","true");
    if(fault==="peer-unknown")f.b.win.unknownPrivacy=true;
    if(fault==="peer-not-ready")f.b.win.gZenStartup.isReady=false;
    if(fault==="peer-id")f.b.tab.id="other";
    if(fault==="peer-workspace")f.b.attrs.set("zen-workspace-id","other");
    if(fault==="peer-container")f.b.tab.userContextId=1;
    if(fault==="peer-manager")f.b.win.gZenWindowSync={};
    if(fault==="peer-cache")f.b.win.gZenWorkspaces.allStoredTabs=[];
    assert.equal(inspectManualSide(f.context).status,"unavailable",fault);
    assert.equal(f.writes.length,0);
  }
  const f=fixture();f.b.win.private=true;assert.equal(captureManualSideCohort(f.context).length,1);
  f.b.win.private=false;f.b.win.gZenWorkspaces.privateWindowOrDisabled=true;
  assert.equal(captureManualSideCohort(f.context).length,1);
});
test("missing, incomplete, conflict, invalid and confirmed reads remain distinct",()=>{
  const f=fixture(),inspect=()=>inspectManualSide(f.context);
  assert.equal(inspect().status,"missing");
  f.values.set(f.a.tab,"left");assert.equal(inspect().status,"incomplete");assert.equal(inspect().side,null);
  f.values.set(f.b.tab,"right");assert.equal(inspect().status,"conflict");assert.equal(inspect().side,null);
  f.values.set(f.b.tab,"future");assert.equal(inspect().status,"invalid");
  f.values.set(f.b.tab,"left");assert.equal(inspect().status,"confirmed");assert.equal(inspect().side,"left");
  assert.equal(f.writes.length,0);
});
test("explicit intent writes exact copies once and confirms all readbacks; no-op does not write",()=>{
  const f=fixture();
  assert.deepEqual(commitManualSide(f.context,inspectManualSide(f.context),"right",f.owns),{status:"confirmed",written:2,count:2});
  assert.equal(f.writes[0],f.a.tab);assert.equal(f.writes[1],f.b.tab);
  assert.deepEqual(commitManualSide(f.context,inspectManualSide(f.context),"right",f.owns),{status:"confirmed",written:0,count:2});
});
test("stale admission, native scope change, value race and owner loss do not overwrite",()=>{
  for(const fault of ["new-peer","changed-value","owner","sync-pref","manager"]){
    const f=fixture(),before=inspectManualSide(f.context);
    if(fault==="new-peer")f.windowWithTab();
    if(fault==="changed-value")f.values.set(f.b.tab,"left");
    if(fault==="owner")f.loseOwner();
    if(fault==="sync-pref")f.setPinnedOnly(true);
    if(fault==="manager")f.b.win.gZenWorkspaces={...f.b.win.gZenWorkspaces};
    assert.equal(commitManualSide(f.context,before,"right",f.owns).status,"rejected",fault);
    assert.equal(f.writes.length,0);
  }
});
test("partial or thrown writes are not confirmed or rolled back",()=>{
  const f=fixture(),before=inspectManualSide(f.context);f.afterWrite(()=>f.loseOwner());
  assert.deepEqual(commitManualSide(f.context,before,"right",f.owns),{status:"partial",written:1,count:2});
  assert.equal(f.values.get(f.a.tab),"right");assert.equal(f.values.has(f.b.tab),false);
  const g=fixture();g.failAt(1);
  assert.deepEqual(commitManualSide(g.context,inspectManualSide(g.context),"left",g.owns),{status:"unverified",written:0,count:2});
  assert.equal(g.values.get(g.a.tab),"left");assert.equal(g.writes.length,1);
});
test("late full-state copy is observed as incomplete/conflict and never silently repaired",()=>{
  const f=fixture();assert.equal(commitManualSide(f.context,inspectManualSide(f.context),"right",f.owns).status,"confirmed");
  f.values.delete(f.b.tab);assert.equal(inspectManualSide(f.context).status,"incomplete");
  f.values.set(f.b.tab,"left");assert.equal(inspectManualSide(f.context).status,"conflict");
  assert.equal(f.writes.length,2);
});
test("focus-order changes preserve identity, unknown values cannot be overwritten",()=>{
  const f=fixture(),before=inspectManualSide(f.context);f.windows.reverse();
  assert.equal(commitManualSide(f.context,before,"left",f.owns).status,"confirmed");
  f.values.set(f.b.tab,"future");
  assert.equal(commitManualSide(f.context,inspectManualSide(f.context),"right",f.owns).status,"rejected");
  assert.equal(f.writes.length,2);
});
