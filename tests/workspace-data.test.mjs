import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {readWorkspaceOwnership,inspectWorkspaceTabMove,inspectWorkspaceTabRemoval,workspaceTabJournal,workspaceJournalComplete,runWorkspaceCommand,requireWorkspaceDataCommand,workspaceCommandError,designateWorkspaceFree} from "../src/core/workspace-commands.mjs";
import {hubTrashTabEligible,hubTrashAgeMatches,hubWorkspaceOrder,hubWorkspaceSnapshot} from "../src/algorithms/hub-workspaces.mjs";
const code=readFileSync(new URL("../src/hub/controller.js.part",import.meta.url),"utf8");
const extract=(a,b)=>code.slice(code.indexOf(a),code.indexOf(b,code.indexOf(a)));
function fixture(){
 const elements=new Map(),entries=["free","work","trash"].map(uuid=>({uuid,name:uuid})),events=[],calls=[],stamps=new Map(),all=[];
 let cached=null,single=true,free="free",trash="trash",destroyed=false;
 function container(){
  const tabs=[];
  return {isConnected:true,tabs,querySelectorAll:()=>tabs.slice(),contains:t=>tabs.includes(t)};
 }
 for(const s of entries)elements.set(s.uuid,{isConnected:true,tabsContainer:container(),pinnedTabsContainer:container()});
 const browser={isTab:t=>all.includes(t),selectedTab:null,tabContainer:{_invalidateCachedTabs(){cached=null;}}};
 function add(id,attrs={}){
  const tab={isConnected:true,closing:false,pinned:false,linkedBrowser:{},attrs:new Map([["zen-workspace-id",id],...Object.entries(attrs)]),
    getAttribute(k){return this.attrs.get(k)??null;},hasAttribute(k){return this.attrs.has(k);},querySelector:()=>null};
  all.push(tab);elements.get(id).tabsContainer.tabs.push(tab);cached=null;return tab;
 }
 function detach(tab){
  for(const e of elements.values())for(const c of [e.tabsContainer,e.pinnedTabsContainer]){
   const i=c.tabs.indexOf(tab);if(i>=0)c.tabs.splice(i,1);
  }
 }
 function move(tab,id){detach(tab);tab.attrs.set("zen-workspace-id",id);elements.get(id).tabsContainer.tabs.push(tab);cached=null;}
 function remove(tab){detach(tab);tab.isConnected=false;tab.closing=true;tab.linkedBrowser=null;cached=null;}
 const native={workspaceEnabled:true,isChangingWorkspace:false,activeWorkspace:"free",getWorkspaces:()=>entries.slice(),
  getWorkspaceFromId:id=>entries.find(s=>s.uuid===id),workspaceElement:id=>elements.get(id)||null,
  get allStoredTabs(){return cached??(cached=[...elements.values()].flatMap(e=>[...e.tabsContainer.tabs,...e.pinnedTabsContainer.tabs]));},
  changeWorkspaceWithID(){},
  moveTabsToWorkspace(tabs,id){calls.push("move");for(const t of tabs)move(t,id);return true;},
  async removeWorkspace(id){calls.push("delete");entries.splice(entries.findIndex(s=>s.uuid===id),1);elements.delete(id);cached=null;}};
 browser.removeTab=tab=>{calls.push("remove");remove(tab);};
 const window={gZenWorkspaces:native,gBrowser:browser,__nocturneTrace:(event,data)=>events.push({event,data})};
 const anchor={},store={setCustomTabValue(t,k,v){stamps.set(t,v);},deleteCustomTabValue(t){stamps.delete(t);}};
 const api={window,native,browser,anchor,store,add,move,remove,detach,calls,events,stamps,elements,
  setSingle:v=>single=v,setFree:v=>free=v,setTrash:v=>trash=v,setDestroyed:v=>destroyed=v,
  setCache:v=>cached=v,singleWindow:()=>single,freeId:()=>free,trashId:()=>trash,current:()=>!destroyed};
 // Exercise actual Hub command bodies and real lease/inspection helpers.
 const bindings={window,browser,manager:()=>window.gZenWorkspaces,singleWindow:api.singleWindow,
  freeId:api.freeId,trashId:api.trashId,canManage:()=>true,requireWorkspaceDataCommand,
  workspaceCommandError,readWorkspaceOwnership,inspectWorkspaceTabMove,inspectWorkspaceTabRemoval,
  workspaceTabJournal,workspaceJournalComplete,hubTrashTabEligible,hubTrashAgeMatches,hubWorkspaceOrder,hubWorkspaceSnapshot,
  trashSessionStore:()=>store,trashStamp:t=>Number(stamps.get(t)||1),TRASH_TIME:"stamp",
  ensureTrash:async()=>trash,switchGuard:()=>{},
  ownedTabs:(n,id)=>n.allStoredTabs.filter(t=>t.getAttribute("zen-workspace-id")===id),
  operation:fn=>runWorkspaceCommand(window,native,"hub-data",api.current,fn,{data:true,anchor}),
  render:()=>{},switchWorkspaceWithin:async()=>{native.activeWorkspace=free;}};
 const segment=extract("    function workspaceDataGuard(","    function deletionDetails(")+
 extract("    async function removeSpace(id){","    function trashMotionEnabled")+
 extract("    function purgeEligible(","    function setTrashAgeOpen(")+
 extract("    async function executePurge(){","    function trashTabUrl(");
 const runtime=new Function(...Object.keys(bindings),`
 let busy=false,destroyed=false,open=true,hubSession=1,trashOpen=false,contextId=null,confirmation=null,purgePlan=null;
 const status={textContent:""};
 function deletionDetails(id){
  const n=manager(),ownership=readWorkspaceOwnership(window,n,id);
  return ownership?{id,native:n,free:freeId(),trash:trashId(),description:"delete",plan:ownership.tabs}:null;
 }
 ${segment}
 return {approveDelete:id=>{confirmation=deletionDetails(id);},removeSpace,
  approvePurge:tabs=>{purgePlan={age:"all",native:manager(),source:trashId(),free:freeId(),tabs};},
  executePurge,restoreTrashTab,status,moveNativeTab};
 `)(...Object.values(bindings));
 return {...api,runtime};
}
test("fresh native cache and physical ownership must agree",()=>{
 const f=fixture(),tab=f.add("work");
 f.setCache([]);assert.equal(readWorkspaceOwnership(f.window,f.native,"work"),null);
 assert.deepEqual(readWorkspaceOwnership(f.window,f.native,"work",{fresh:true}).tabs,[tab]);
 tab.attrs.set("zen-workspace-id","trash");
 assert.equal(readWorkspaceOwnership(f.window,f.native,"work",{fresh:true}),null);
 assert.equal(readWorkspaceOwnership(f.window,f.native,"trash"),null);
});
test("only the exact native ungrouped placeholder is exempt; unexpected Essentials block deletion",()=>{
 const f=fixture(),empty=f.add("work",{"zen-empty-tab":"true"});
 assert.equal(readWorkspaceOwnership(f.window,f.native,"work"),null);
 f.native._emptyTab=empty;
 assert.deepEqual(readWorkspaceOwnership(f.window,f.native,"work").tabs,[]);
 f.add("work",{"zen-essential":"true"});assert.equal(readWorkspaceOwnership(f.window,f.native,"work"),null);
});
test("ID-only and physical-only moves are unknown, never successful",()=>{
 for(const mode of ["id","physical"]){
  const f=fixture(),tab=f.add("work");
  if(mode==="id")tab.attrs.set("zen-workspace-id","trash");
  else {f.move(tab,"trash");tab.attrs.set("zen-workspace-id","work");}
  assert.equal(inspectWorkspaceTabMove(f.window,f.native,tab,"work","trash"),"unknown");
 }
});
test("Hub deletion moves all approved tabs physically before native remove",async()=>{
 const f=fixture(),a=f.add("work"),b=f.add("work");
 f.runtime.approveDelete("work");await f.runtime.removeSpace("work");
 assert.deepEqual(f.calls,["move","move","delete"]);assert.ok(!f.native.getWorkspaceFromId("work"));
 assert.deepEqual(readWorkspaceOwnership(f.window,f.native,"trash").tabs,[a,b]);assert.ok(f.stamps.has(a)&&f.stamps.has(b));
});
test("Hub stops on ID-only second move, preserves source Workspace and reports partial progress",async()=>{
 const f=fixture(),a=f.add("work"),b=f.add("work"),c=f.add("work");let count=0;
 f.native.moveTabsToWorkspace=([tab],id)=>{f.calls.push("move");if(++count===1)f.move(tab,id);else tab.attrs.set("zen-workspace-id",id);return true;};
 f.runtime.approveDelete("work");await assert.rejects(f.runtime.removeSpace("work"),/1 of 3 moved; 0 retained, 1 unconfirmed, 1 not attempted/);
 assert.deepEqual(f.calls,["move","move"]);assert.ok(f.native.getWorkspaceFromId("work"));
 assert.ok(f.stamps.has(a));assert.ok(!f.stamps.has(b)&&!f.stamps.has(c));
});
test("Hub stops on thrown native move even if physical mutation completed",async()=>{
 const f=fixture(),a=f.add("work");f.add("work");
 f.native.moveTabsToWorkspace=([tab],id)=>{f.calls.push("move");f.move(tab,id);throw Error("native partial");};
 f.runtime.approveDelete("work");await assert.rejects(f.runtime.removeSpace("work"),/1 of 2 moved/);
 assert.deepEqual(f.calls,["move"]);assert.ok(f.native.getWorkspaceFromId("work"));assert.ok(!f.stamps.has(a));
});
test("Hub metadata failure does not undo native move or delete workspace",async()=>{
 const f=fixture(),a=f.add("work");f.store.setCustomTabValue=()=>{throw Error("metadata");};
 f.runtime.approveDelete("work");await assert.rejects(f.runtime.removeSpace("work"),/metadata/);
 assert.deepEqual(f.calls,["move"]);assert.equal(a.getAttribute("zen-workspace-id"),"trash");assert.ok(f.native.getWorkspaceFromId("work"));
});
test("a new source tab or second window during transfer prevents native deletion",async()=>{
 for(const mode of ["tab","window"]){
  const f=fixture();f.add("work");
  f.native.moveTabsToWorkspace=([tab],id)=>{f.calls.push("move");f.move(tab,id);if(mode==="tab")f.add("work");else f.setSingle(false);};
  f.runtime.approveDelete("work");await assert.rejects(f.runtime.removeSpace("work"),/Workspace kept/);
  assert.deepEqual(f.calls,["move"]);assert.ok(f.native.getWorkspaceFromId("work"));
 }
});
test("native close veto is retained and stops purge without retrying stale approval",async()=>{
 const f=fixture(),a=f.add("trash"),b=f.add("trash");
 f.browser.removeTab=()=>{f.calls.push("remove");};
 f.runtime.approvePurge([a,b]);await f.runtime.executePurge();await f.runtime.executePurge();
 assert.deepEqual(f.calls,["remove"]);assert.match(f.runtime.status.textContent,/0 of 2 removed; 1 retained, 0 unconfirmed, 1 not attempted/);
});
test("purge counts only detached browser-released tabs; partial removal is unknown",async()=>{
 const f=fixture(),a=f.add("trash"),b=f.add("trash"),c=f.add("trash");
 f.browser.removeTab=tab=>{f.calls.push("remove");if(tab===a)f.remove(tab);else{f.detach(tab);tab.isConnected=false;f.browser.tabContainer._invalidateCachedTabs();}};
 f.runtime.approvePurge([a,b,c]);await f.runtime.executePurge();
 assert.deepEqual(f.calls,["remove","remove"]);assert.match(f.runtime.status.textContent,/1 of 3 removed; 0 retained, 1 unconfirmed, 1 not attempted/);
 assert.equal(inspectWorkspaceTabRemoval(f.window,f.native,a,"trash",f.browser),"confirmed");
 assert.equal(inspectWorkspaceTabRemoval(f.window,f.native,b,"trash",f.browser),"unknown");
});
test("stale purge role or newly selected tab cannot use previous approval",async()=>{
 const f=fixture(),a=f.add("trash");f.runtime.approvePurge([a]);f.setTrash("work");
 await assert.rejects(f.runtime.executePurge());assert.deepEqual(f.calls,[]);
 f.setTrash("trash");f.runtime.approvePurge([a]);f.browser.selectedTab=a;
 await assert.rejects(f.runtime.executePurge(),/Trash changed/);assert.deepEqual(f.calls,[]);
});
test("restore returns success only after physical move and clears its timestamp",async()=>{
 const f=fixture(),a=f.add("trash");f.stamps.set(a,"1");
 assert.equal(await f.runtime.restoreTrashTab(a,"work"),true);assert.ok(!f.stamps.has(a));assert.deepEqual(f.calls,["move"]);
 const b=f.add("trash");f.stamps.set(b,"2");f.native.moveTabsToWorkspace=([tab],id)=>{tab.attrs.set("zen-workspace-id",id);};
 await assert.rejects(f.runtime.restoreTrashTab(b,"work"),/unconfirmed/);assert.ok(f.stamps.has(b));
});
test("data mutation helpers reject a selection-only lease",async()=>{
 const f=fixture(),prefs={getStringPref:()=>""};
 await assert.rejects(runWorkspaceCommand(f.window,f.native,"selection",()=>true,
  lease=>designateWorkspaceFree(f.window,f.native,prefs,lease,"work")),e=>e.code==="data-lease-required");
 assert.deepEqual(f.calls,[]);
});
