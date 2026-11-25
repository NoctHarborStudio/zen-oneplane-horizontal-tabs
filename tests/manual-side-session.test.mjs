import test from "node:test";
import assert from "node:assert/strict";
import {captureManualSideCohort,inspectManualSide,commitManualSide,MANUAL_SIDE_KEY,planManualSideActivation} from "../src/native/manual-side-session.mjs";

function fixture(){
  const sync={},values=new Map(),writes=[],windows=[];
  let enabled=true,onlyPinned=false,owns=true,failAt=0,afterWrite=()=>{},afterRead=()=>{};
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
    getCustomTabValue(tab,key){assert.equal(key,MANUAL_SIDE_KEY);const value=values.get(tab)??"";afterRead();return value;},
    setCustomTabValue(tab,key,value){assert.equal(key,MANUAL_SIDE_KEY);writes.push(tab);values.set(tab,value);
      if(failAt===writes.length)throw Error("after write");afterWrite();}};
  const context={source:a.tab,sessionStore,prefs:{getBoolPref:k=>k==="zen.window-sync.enabled"?enabled:onlyPinned},
    getWindows:()=>windows,isPrivate:win=>win.private===true?true:win.unknownPrivacy?null:false};
  return {a,b,windows,values,writes,context,windowWithTab,owns:()=>owns,
    setPinnedOnly:v=>{onlyPinned=v},setEnabled:v=>{enabled=v},loseOwner:()=>{owns=false},
    failAt:v=>{failAt=v},afterWrite:fn=>{afterWrite=fn},afterRead:fn=>{afterRead=fn}};
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

test("unchanged copy count cannot conceal changed native scope or container identity",()=>{
  for(const fault of ["sync-pref","context","browser","container","store","sync-instance"]){
    const f=fixture();f.setPinnedOnly(true);
    const before=inspectManualSide(f.context);
    if(fault==="sync-pref")f.setEnabled(false);
    if(fault==="context")f.a.tab.userContextId=2;
    if(fault==="browser")f.a.win.gBrowser={...f.a.win.gBrowser};
    if(fault==="container"){
      const previous=f.a.win.gZenWorkspaces.workspaceElement;
      const element=previous();element.tabsContainer={...element.tabsContainer};
      f.a.win.gZenWorkspaces.workspaceElement=()=>element;
    }
    if(fault==="store")f.context.sessionStore={...f.context.sessionStore};
    if(fault==="sync-instance")f.a.win.gZenWindowSync={};
    assert.equal(commitManualSide(f.context,before,"left",f.owns).status,"rejected",fault);
    assert.equal(f.writes.length,0);
  }
});
test("a read callback that loses the lease cannot reach a native setter",()=>{
  const f=fixture(),before=inspectManualSide(f.context);
  f.afterRead(()=>f.loseOwner());
  assert.equal(commitManualSide(f.context,before,"right",f.owns).status,"rejected");
  assert.equal(f.writes.length,0);
});

const missing=()=>({status:"missing"});
const saved=side=>({status:"confirmed",side});
function unit(...reads){
  const nativeMembers=reads.map(()=>({}));
  return {node:{},nativeMembers,members:nativeMembers.map((tab,i)=>({tab,eligible:true,read:reads[i]}))};
}
function auto(units,sides){
  return {order:units.map(u=>u.node),projection:{mode:"automatic",sides}};
}
const activate=(units,automatic,intent="enable")=>planManualSideActivation({mode:"manual",intent,units,automatic});

test("first enable initializes only absent values from the exact Auto unit provenance",()=>{
  const units=[unit(missing()),unit(missing()),unit(missing())];
  const p=activate(units,auto(units,["left","left","right"]));
  assert.equal(p.status,"needs-initialization");
  assert.deepEqual(p.sides,["left","left","right"]);
  assert.equal(p.initializations.length,3);
  for(let i=0;i<3;i++){
    assert.equal(p.initializations[i].tab,units[i].members[0].tab);
    assert.equal(p.initializations[i].expected,units[i].members[0].read);
    units[i].members[0].read=saved(p.sides[i]);
  }
  assert.deepEqual(activate(units,null,"restore"),{status:"ready",sides:p.sides,initializations:[]});
});
test("Auto mode is dormant, re-enable preserves saved membership despite reordered and new units",()=>{
  const first=unit(saved("left")),second=unit(saved("right")),fresh=unit(missing());
  assert.equal(planManualSideActivation({mode:"automatic"}).status,"inactive");
  const units=[second,fresh,first];
  const p=activate(units,auto(units,["left","right","right"]));
  assert.equal(p.status,"needs-initialization");
  assert.deepEqual(p.sides,["right","right","left"]);
  assert.equal(p.initializations.length,1);
  assert.equal(p.initializations[0].tab,fresh.members[0].tab);
});
test("restoration never guesses from geometry and conflict suppresses the whole write proposal",()=>{
  for(const read of [missing(),{status:"conflict"},{status:"incomplete"},{status:"invalid"},{status:"stale"},{status:"unavailable"},saved("future")]){
    const units=[unit(saved("right")),unit(read)];
    const p=activate(units,auto(units,["left","right"]),"restore");
    assert.equal(p.status,"blocked");assert.deepEqual(p.initializations,[]);
  }
  const units=[unit(missing()),unit({status:"conflict"})];
  assert.deepEqual(activate(units,auto(units,["left","right"])).initializations,[]);
});
test("one verified Split unit has one side; mixed, missing or hidden members block guessing",()=>{
  const good=unit(saved("left"),saved("left"));
  assert.deepEqual(activate([good],null,"restore").sides,["left"]);
  for(const group of [unit(saved("left"),saved("right")),unit(saved("left"),missing())]){
    assert.equal(activate([group],auto([group],["right"])).reason,"group-conflict");
  }
  const hidden=unit(saved("left"),saved("left"));hidden.members.pop();
  assert.equal(activate([hidden],null,"restore").reason,"membership");
  const unsupported=unit(missing(),missing());unsupported.members[1].eligible=false;
  assert.equal(activate([unsupported],auto([unsupported],["left"])).reason,"role");
  const allMissing=unit(missing(),missing());
  const p=activate([allMissing],auto([allMissing],["right"]));
  assert.equal(p.status,"needs-initialization");assert.equal(p.initializations.length,2);
  assert.ok(p.initializations.every(x=>x.side==="right"));
});
test("stale Auto order, missing provenance, duplicate identities and empty workspace",()=>{
  const units=[unit(missing()),unit(missing())];
  for(const invalid of [null,auto([...units].reverse(),["left","right"]),auto(units,["left"]),auto(units,["left","bad"]),auto(units,Array(2))]){
    assert.equal(activate(units,invalid).reason,"auto-provenance");
  }
  const repeated=[units[0],units[0]];
  assert.equal(activate(repeated,auto(repeated,["left","right"])).reason,"membership");
  const a=unit(saved("left")),b=unit(saved("left"));
  b.nativeMembers=[a.members[0].tab];b.members=[a.members[0]];
  assert.equal(activate([a,b],null,"restore").reason,"membership");
  assert.deepEqual(activate([],auto([],[])),{status:"ready",sides:[],initializations:[]});
});

test("reentrant SessionStore replacement during a value read rejects the old transaction",()=>{
  const f=fixture(),before=inspectManualSide(f.context);
  f.afterRead(()=>{f.context.sessionStore={...f.context.sessionStore}});
  assert.equal(commitManualSide(f.context,before,"right",f.owns).status,"rejected");
  assert.equal(f.writes.length,0);
});
